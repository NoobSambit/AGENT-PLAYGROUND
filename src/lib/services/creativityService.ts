import { desc, eq } from 'drizzle-orm'
import { buildMessageRenderData } from '@/lib/chat/rendering'
import { getDb } from '@/lib/db/client'
import { generateId } from '@/lib/db/utils'
import { messages, memories } from '@/lib/db/schema'
import type { LLMProviderInfo } from '@/lib/llmConfig'
import { generateText } from '@/lib/llm/provider'
import { CreativeStudioRepository } from '@/lib/repositories/creativeStudioRepository'
import { FeatureContentRepository } from '@/lib/repositories/featureContentRepository'
import {
  createPendingTrackedFields,
  syncTrackedQualityState,
} from '@/lib/services/outputQuality/contracts'
import { applyFinalQualityGate } from '@/lib/services/outputQuality/evaluators'
import {
  detectTextLeakage,
  OUTPUT_QUALITY_FLAGS,
} from '@/lib/services/outputQuality/flags'
import {
  createRawModelOutput,
  normalizeSourceRefs,
  normalizeStringList,
  normalizeWhitespace,
  safeParseJsonWithExtraction,
} from '@/lib/services/outputQuality/normalizers'
import {
  createValidationReport,
  validateRequiredTextFields,
  validateSharedArtifactText,
  validateSourceRefs,
} from '@/lib/services/outputQuality/validators'
import type {
  AgentRecord,
  CreativeArtifact,
  CreativeBrief,
  CreativeContextPacket,
  CreativeContextSignal,
  CreativeFormat,
  CreativeLength,
  CreativeLibraryItem,
  CreativePipelineEvent,
  CreativeRubricDimension,
  CreativeRubricEvaluation,
  CreativeSession,
  CreativeTone,
  EmotionType,
  MemoryRecord,
  MessageRecord,
} from '@/types/database'
import type {
  OutputArtifactRole,
  OutputQualitySourceRef,
  OutputQualityValidationReport,
} from '@/types/outputQuality'
import { AgentService } from './agentService'
import { agentStatsService } from './agentStatsService'
import { emotionalService } from './emotionalService'
import { LearningService } from './learningService'

const DAILY_LIMIT = 20
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000
const CREATIVE_PROMPT_VERSION = 'phase1-creative-contract-v1'
const CREATIVE_VALIDATOR_VERSION = 'phase1-creative-validator-v1'

const CREATIVE_FORMATS: CreativeFormat[] = ['story', 'poem', 'song', 'dialogue', 'essay']
const CREATIVE_TONES: CreativeTone[] = [
  'cinematic',
  'lyrical',
  'playful',
  'intimate',
  'dramatic',
  'philosophical',
  'experimental',
  'hopeful',
  'melancholic',
]
const CREATIVE_LENGTHS: CreativeLength[] = ['short', 'medium', 'long']

const LENGTH_WORD_RANGE: Record<CreativeLength, { min: number; max: number }> = {
  short: { min: 80, max: 220 },
  medium: { min: 180, max: 480 },
  long: { min: 350, max: 900 },
}

const FORMAT_GUIDANCE: Record<CreativeFormat, string> = {
  story: 'Write a complete short narrative with a clear emotional turn and concrete imagery.',
  poem: 'Write a poem with deliberate line breaks, strong image choices, and a memorable closing line.',
  song: 'Write structured lyrics with a strong hook and at least one repeated phrase or chorus.',
  dialogue: 'Write a scene driven by spoken exchange, subtext, and character contrast.',
  essay: 'Write a reflective creative essay with a clear throughline and vivid specificity.',
}

function clamp(value: number, min = 0, max = 100): number {
  return Math.max(min, Math.min(max, value))
}

function isCreativeFormat(value: string | undefined): value is CreativeFormat {
  return Boolean(value && CREATIVE_FORMATS.includes(value as CreativeFormat))
}

function isCreativeTone(value: string | undefined): value is CreativeTone {
  return Boolean(value && CREATIVE_TONES.includes(value as CreativeTone))
}

function isCreativeLength(value: string | undefined): value is CreativeLength {
  return Boolean(value && CREATIVE_LENGTHS.includes(value as CreativeLength))
}

function toSentenceCase(value: string): string {
  const trimmed = value.trim()
  if (!trimmed) return ''
  return trimmed.charAt(0).toUpperCase() + trimmed.slice(1)
}

function splitList(value: string | string[] | undefined): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => entry.trim()).filter(Boolean)
  }

  if (!value) {
    return []
  }

  return value
    .split(/\n|,/g)
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function normalizeSingleText(value: unknown): string {
  if (typeof value === 'string') {
    return value.trim()
  }

  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean).join(' ')
  }

  if (value && typeof value === 'object') {
    return Object.values(value as Record<string, unknown>).map((entry) => String(entry).trim()).filter(Boolean).join(' ')
  }

  return ''
}

function stripDecorativeBreaks(value: string): string {
  return value
    .replace(/^\s*---+\s*$/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function extractSection(value: string, label: string, nextLabels: string[]): string {
  const escapedLabel = label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  const nextPattern = nextLabels
    .map((entry) => `\\*\\*${entry.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\*\\*:`)
    .join('|')
  const pattern = new RegExp(`\\*\\*${escapedLabel}\\*\\*:\\s*([\\s\\S]*?)(?=${nextPattern || '$'}|$)`, 'i')
  const match = value.match(pattern)
  return match?.[1]?.trim() || ''
}

function parseLabeledCreativeResponse(value: string): {
  title?: string
  summary?: string
  content?: string
  themes?: string[]
  inspiration?: string
} | null {
  const title = extractSection(value, 'Title', ['Summary', 'Content', 'Themes', 'Inspiration'])
  const summary = extractSection(value, 'Summary', ['Content', 'Themes', 'Inspiration'])
  const content = extractSection(value, 'Content', ['Themes', 'Inspiration'])
  const themesRaw = extractSection(value, 'Themes', ['Inspiration'])
  const inspiration = extractSection(value, 'Inspiration', [])

  if (!title && !content) {
    return null
  }

  return {
    title: title || undefined,
    summary: summary || undefined,
    content: stripDecorativeBreaks(content || value),
    themes: themesRaw
      ? themesRaw
          .split(/\n|,/g)
          .map((entry) => entry.replace(/^[-*]\s*/, '').trim())
          .filter(Boolean)
      : undefined,
    inspiration: inspiration || undefined,
  }
}

function summarizeText(value: string, limit = 160): string {
  const compact = value.replace(/\s+/g, ' ').trim()
  if (compact.length <= limit) {
    return compact
  }

  return `${compact.slice(0, limit - 1).trimEnd()}…`
}

function deriveFallbackTitle(content: string, format: CreativeFormat): string {
  const headingMatch = content.match(/^(?:#\s+)?([A-Z][^\n]{3,80})/)
  if (headingMatch?.[1]) {
    return headingMatch[1].replace(/[*_#"{}[\]]/g, '').trim()
  }

  const words = content
    .replace(/[*_#".,:;!?()[\]{}-]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 5)
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())

  if (words.length > 0) {
    return words.join(' ')
  }

  return `Untitled ${format}`
}

function countWords(value: string): number {
  return value.trim() ? value.trim().split(/\s+/).length : 0
}

function deriveToneFromEmotion(emotion?: EmotionType | null): CreativeTone {
  switch (emotion) {
    case 'joy':
      return 'hopeful'
    case 'sadness':
      return 'melancholic'
    case 'anger':
      return 'dramatic'
    case 'fear':
      return 'intimate'
    case 'surprise':
      return 'experimental'
    case 'trust':
      return 'lyrical'
    case 'anticipation':
      return 'cinematic'
    case 'disgust':
      return 'philosophical'
    default:
      return 'cinematic'
  }
}

interface BootstrapPayload {
  agent: Pick<AgentRecord, 'id' | 'name' | 'creativeWorks'>
  formats: CreativeFormat[]
  tones: CreativeTone[]
  lengths: CreativeLength[]
  defaults: CreativeBrief
  candidateSignals: CreativeContextSignal[]
  recentSessions: CreativeSession[]
  library: CreativeLibraryItem[]
}

interface CreativeSessionDetail {
  session: CreativeSession
  artifacts: CreativeArtifact[]
  pipelineEvents: CreativePipelineEvent[]
}

interface CreativeDraftPayload {
  title?: string
  summary?: string
  content?: string
  themes?: string[]
  inspiration?: string
}

interface CreativeArtifactBuildResult {
  artifact: CreativeArtifact
  validation: OutputQualityValidationReport
}

interface CreativePublishBlockedPayload {
  code: 'creative_publish_blocked'
  sessionId: string
  artifactId?: string
  blockerReasons: string[]
  qualityStatus: CreativeSession['qualityStatus']
  normalizationStatus?: CreativeArtifact['normalizationStatus']
  validation?: OutputQualityValidationReport
  evaluation?: CreativeRubricEvaluation
}

export class CreativePublishBlockedError extends Error {
  readonly payload: CreativePublishBlockedPayload

  constructor(
    payload: CreativePublishBlockedPayload,
    message = 'Creative artifact is blocked from publish until quality preconditions pass.'
  ) {
    super(message)
    this.name = 'CreativePublishBlockedError'
    this.payload = payload
  }
}

class CreativityService {
  async getBootstrap(agentId: string): Promise<BootstrapPayload> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const defaults = this.createSuggestedBrief(agent)
    const contextPacket = await this.buildContextPacket(agent, defaults)
    const recentSessions = (await CreativeStudioRepository.listSessions(agentId, { limit: 6 }))
      .map((session) => this.hydrateSessionQuality(session))
    const library = (await CreativeStudioRepository.listPublishedLibrary(agentId))
      .map((item) => ({
        session: this.hydrateSessionQuality(item.session),
        artifact: this.hydrateArtifactQuality(item.artifact),
      }))

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        creativeWorks: agent.creativeWorks,
      },
      formats: CREATIVE_FORMATS,
      tones: CREATIVE_TONES,
      lengths: CREATIVE_LENGTHS,
      defaults,
      candidateSignals: contextPacket.selectedSignals.slice(0, 8),
      recentSessions,
      library,
    }
  }

  createSuggestedBrief(agent: AgentRecord): CreativeBrief {
    const dominantEmotion = emotionalService.getDominantEmotion(agent.emotionalState, agent.emotionalProfile)

    return {
      format: 'story',
      intent: `Build a piece that sounds unmistakably like ${agent.name} instead of a generic assistant.`,
      audience: 'A curious product builder looking for a distinctive creative piece',
      tone: deriveToneFromEmotion(dominantEmotion),
      length: 'medium',
      mustInclude: [],
      avoid: ['generic motivational filler', 'empty abstractions'],
      referenceNotes: '',
    }
  }

  normalizeBrief(agent: AgentRecord, input: Partial<CreativeBrief> & { rawPrompt?: string }): CreativeBrief {
    const rawPrompt = input.rawPrompt?.trim() || ''
    const inferredIntent = input.intent?.trim() || rawPrompt
    const dominantEmotion = emotionalService.getDominantEmotion(agent.emotionalState, agent.emotionalProfile)

    if (!inferredIntent || inferredIntent.length < 12) {
      throw new Error('Creative intent must be specific enough to guide the piece.')
    }

    const format = isCreativeFormat(input.format) ? input.format : 'story'
    const tone = isCreativeTone(input.tone) ? input.tone : deriveToneFromEmotion(dominantEmotion)
    const length = isCreativeLength(input.length) ? input.length : 'medium'
    const mustInclude = splitList(input.mustInclude)
    const avoid = splitList(input.avoid)
    const referenceNotes = input.referenceNotes?.trim() || ''
    const audience = input.audience?.trim() || 'A thoughtful reader who wants something vivid and specific'

    return {
      format,
      intent: toSentenceCase(inferredIntent),
      audience,
      tone,
      length,
      mustInclude,
      avoid,
      referenceNotes,
      rawPrompt: rawPrompt || undefined,
    }
  }

  async createSession(
    agentId: string,
    input: Partial<CreativeBrief> & { rawPrompt?: string }
  ): Promise<CreativeSession> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const usageCount = await CreativeStudioRepository.countSessionsSince(
      agentId,
      new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    )

    if (usageCount >= DAILY_LIMIT) {
      throw new Error('Daily creative limit reached. Try again tomorrow.')
    }

    const normalizedBrief = this.normalizeBrief(agent, input)
    const now = new Date().toISOString()
    const session: CreativeSession = {
      id: generateId('creative_session'),
      agentId,
      status: 'draft',
      ...createPendingTrackedFields({
        promptVersion: CREATIVE_PROMPT_VERSION,
      }),
      brief: normalizedBrief,
      normalizedBrief,
      createdAt: now,
      updatedAt: now,
    }

    const created = await CreativeStudioRepository.createSession(session)
    await CreativeStudioRepository.savePipelineEvent({
      id: generateId('creative_event'),
      sessionId: created.id,
      stage: 'brief_normalized',
      status: 'completed',
      summary: 'Normalized creative brief and created a draft session.',
      payload: {
        brief: created.normalizedBrief,
      },
      createdAt: now,
    })

    return created
  }

  async generateSession(
    agentId: string,
    sessionId: string,
    providerInfo: LLMProviderInfo | null
  ): Promise<CreativeSessionDetail> {
    if (!providerInfo) {
      throw new Error('LLM provider not configured')
    }

    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const existing = await CreativeStudioRepository.getSession(sessionId)
    if (!existing || existing.agentId !== agentId) {
      throw new Error('Creative session not found')
    }

    const contextPacket = await this.buildContextPacket(agent, existing.normalizedBrief)
    const sourceRefs = normalizeSourceRefs(contextPacket.selectedSignals.map((signal) => ({
      id: signal.id,
      sourceType: signal.sourceType,
      label: signal.label,
      reason: signal.reason,
      linkedEntityId: signal.linkedEntityId,
    })))
    const generatingSession: CreativeSession = {
      ...existing,
      status: 'generating',
      contextPacket,
      sourceRefs,
      provider: providerInfo.provider,
      model: providerInfo.model,
      qualityStatus: 'pending',
      promptVersion: CREATIVE_PROMPT_VERSION,
      repairCount: 0,
      failureReason: undefined,
      rawModelOutput: undefined,
      validation: undefined,
      updatedAt: new Date().toISOString(),
    }
    await CreativeStudioRepository.updateSession(sessionId, generatingSession)
    await CreativeStudioRepository.savePipelineEvent({
      id: generateId('creative_event'),
      sessionId,
      stage: 'context_selected',
      status: 'completed',
      summary: `Selected ${contextPacket.selectedSignals.length} context signals for the session.`,
      payload: {
        contextPacket,
      },
      createdAt: new Date().toISOString(),
    })

    const draftResponse = await generateText({
      providerInfo,
      temperature: 0.95,
      maxTokens: 2200,
      messages: [
        { role: 'system', content: this.buildGeneratorSystemPrompt(agent, existing.normalizedBrief, contextPacket) },
        { role: 'user', content: this.buildDraftPrompt(existing.normalizedBrief, contextPacket) },
      ],
    })

    const draftResult = this.buildValidatedArtifact({
      agentId,
      sessionId,
      format: existing.normalizedBrief.format,
      tone: existing.normalizedBrief.tone,
      audience: existing.normalizedBrief.audience,
      llmResponse: draftResponse.content,
      providerInfo,
      version: 1,
      status: 'draft',
      artifactRole: 'draft',
      sourceRefs,
    })
    let finalArtifact = await CreativeStudioRepository.saveArtifact(draftResult.artifact)
    await CreativeStudioRepository.savePipelineEvent({
      id: generateId('creative_event'),
      sessionId,
      stage: 'draft_generated',
      status: 'completed',
      summary: draftResult.validation.pass
        ? `Generated normalized draft "${finalArtifact.title}".`
        : 'Generated a draft, but normalization or validation blocked it from review.',
      payload: {
        artifactId: finalArtifact.id,
        wordCount: finalArtifact.wordCount,
        normalization: finalArtifact.normalization,
        validation: finalArtifact.validation,
      },
      createdAt: new Date().toISOString(),
    })

    let evaluation = draftResult.validation.pass
      ? await this.evaluateArtifact(agent, existing.normalizedBrief, contextPacket, finalArtifact, providerInfo)
      : this.createBlockedEvaluation(finalArtifact.validation)
    await CreativeStudioRepository.savePipelineEvent({
      id: generateId('creative_event'),
      sessionId,
      stage: 'draft_evaluated',
      status: 'completed',
      summary: evaluation.evaluatorSummary,
      payload: {
        artifactId: finalArtifact.id,
        evaluation,
      },
      createdAt: new Date().toISOString(),
    })

    finalArtifact = await CreativeStudioRepository.updateArtifact(finalArtifact.id, {
      ...finalArtifact,
      evaluation,
      qualityScore: evaluation.overallScore,
      ...syncTrackedQualityState({
        ...finalArtifact,
        evaluation,
      }, {
        evaluationPass: evaluation.pass,
      }),
      updatedAt: new Date().toISOString(),
    })

    if (!draftResult.validation.pass || !evaluation.pass) {
      const revisionResponse = await generateText({
        providerInfo,
        temperature: 0.85,
        maxTokens: 2200,
        messages: [
          { role: 'system', content: this.buildGeneratorSystemPrompt(agent, existing.normalizedBrief, contextPacket) },
          {
            role: 'user',
            content: this.buildRevisionPrompt(existing.normalizedBrief, contextPacket, finalArtifact, evaluation),
          },
        ],
      })

      const repairedResult = this.buildValidatedArtifact({
        agentId,
        sessionId,
        format: existing.normalizedBrief.format,
        tone: existing.normalizedBrief.tone,
        audience: existing.normalizedBrief.audience,
        llmResponse: revisionResponse.content,
        providerInfo,
        version: 2,
        status: 'revised',
        artifactRole: 'repair',
        sourceArtifactId: finalArtifact.id,
        sourceRefs,
      })
      const repairedArtifact = await CreativeStudioRepository.saveArtifact(repairedResult.artifact)
      evaluation = repairedResult.validation.pass
        ? await this.evaluateArtifact(
        agent,
        existing.normalizedBrief,
        contextPacket,
        repairedArtifact,
        providerInfo
      )
        : this.createBlockedEvaluation(repairedArtifact.validation)
      const evaluatedRepairArtifact = await CreativeStudioRepository.updateArtifact(repairedArtifact.id, {
        ...repairedArtifact,
        evaluation,
        qualityScore: evaluation.overallScore,
        ...syncTrackedQualityState({
          ...repairedArtifact,
          evaluation,
          repairCount: 1,
        }, {
          evaluationPass: evaluation.pass,
        }),
        updatedAt: new Date().toISOString(),
      })

      await CreativeStudioRepository.savePipelineEvent({
        id: generateId('creative_event'),
        sessionId,
        stage: 'revision_generated',
        status: evaluation.pass ? 'completed' : 'failed',
        summary: repairedResult.validation.pass && evaluation.pass
          ? 'Repair pass improved the creative draft enough for final review.'
          : 'Repair pass still failed normalization, validation, or the creative quality gate.',
        payload: {
          artifactId: evaluatedRepairArtifact.id,
          evaluation,
          normalization: evaluatedRepairArtifact.normalization,
          validation: evaluatedRepairArtifact.validation,
        },
        createdAt: new Date().toISOString(),
      })

      finalArtifact = await CreativeStudioRepository.saveArtifact(this.promoteFinalArtifact({
        sourceArtifact: evaluatedRepairArtifact,
        sourceArtifactId: evaluatedRepairArtifact.id,
        evaluation,
        status: 'revised',
        artifactRole: 'final',
        version: 3,
      }))
    } else {
      finalArtifact = await CreativeStudioRepository.saveArtifact(this.promoteFinalArtifact({
        sourceArtifact: finalArtifact,
        sourceArtifactId: finalArtifact.id,
        evaluation,
        status: 'revised',
        artifactRole: 'final',
        version: 2,
      }))
    }

    const gate = applyFinalQualityGate({
      validation: finalArtifact.validation,
      evaluation,
      thresholds: {
        overallScoreMinimum: 80,
        dimensionFloor: 70,
      },
    })

    const readySession: CreativeSession = {
      ...generatingSession,
      status: gate.pass ? 'ready' : 'failed',
      latestEvaluation: evaluation,
      rawModelOutput: finalArtifact.rawModelOutput,
      validation: finalArtifact.validation,
      qualityStatus: gate.qualityStatus,
      repairCount: finalArtifact.repairCount ?? 0,
      promptVersion: CREATIVE_PROMPT_VERSION,
      failureReason: gate.pass ? undefined : [evaluation.evaluatorSummary, ...gate.blockerReasons].filter(Boolean).join(' | '),
      draftArtifactId: draftResult.artifact.id,
      finalArtifactId: finalArtifact.id,
      updatedAt: new Date().toISOString(),
    }
    const updatedSession = await CreativeStudioRepository.updateSession(sessionId, readySession)
    await CreativeStudioRepository.savePipelineEvent({
      id: generateId('creative_event'),
      sessionId,
      stage: gate.pass ? 'ready' : 'failed',
      status: gate.pass ? 'completed' : 'failed',
      summary: gate.pass
        ? 'Creative artifact passed normalization, validation, and evaluation and is ready to publish.'
        : 'Creative artifact failed normalization, validation, or evaluation and is blocked from publish.',
      payload: {
        artifactId: finalArtifact.id,
        evaluation,
        validation: finalArtifact.validation,
        normalization: finalArtifact.normalization,
        gate,
      },
      createdAt: new Date().toISOString(),
    })

    if (!gate.pass) {
      await LearningService.recordQualityObservation({
        agentId,
        feature: 'creative',
        description: `Creative session ${sessionId} was blocked by validation or evaluation.`,
        blockerReasons: gate.blockerReasons,
        evidenceRefs: [sessionId, finalArtifact.id],
        rawExcerpt: finalArtifact.rawModelOutput?.text,
        outputExcerpt: finalArtifact.summary,
        qualityScore: evaluation.overallScore,
        category: 'communication_style',
        candidateAdaptations: [
          'Prefer direct final prose over wrapper leakage in creative outputs.',
        ],
      })
    }

    const artifacts = await CreativeStudioRepository.listArtifactsForSession(sessionId)
    const pipelineEvents = await CreativeStudioRepository.listPipelineEvents(sessionId)

    return {
      session: this.hydrateSessionQuality(updatedSession),
      artifacts: artifacts.map((artifact) => this.hydrateArtifactQuality(artifact)),
      pipelineEvents,
    }
  }

  async publishSession(agentId: string, sessionId: string): Promise<CreativeSessionDetail> {
    const session = await CreativeStudioRepository.getSession(sessionId)
    if (!session || session.agentId !== agentId) {
      throw new Error('Creative session not found')
    }

    if (!session.finalArtifactId) {
      throw new CreativePublishBlockedError({
        code: 'creative_publish_blocked',
        sessionId,
        blockerReasons: ['missing_final_artifact'],
        qualityStatus: session.qualityStatus,
        validation: session.validation,
        evaluation: session.latestEvaluation,
      })
    }

    const finalArtifact = await CreativeStudioRepository.getArtifact(session.finalArtifactId)
    if (!finalArtifact) {
      throw new CreativePublishBlockedError({
        code: 'creative_publish_blocked',
        sessionId,
        artifactId: session.finalArtifactId,
        blockerReasons: ['missing_final_artifact_record'],
        qualityStatus: session.qualityStatus,
        validation: session.validation,
        evaluation: session.latestEvaluation,
      })
    }

    const gate = applyFinalQualityGate({
      validation: finalArtifact.validation,
      evaluation: finalArtifact.evaluation,
      thresholds: {
        overallScoreMinimum: 80,
        dimensionFloor: 70,
      },
      extraHardFailureFlags: session.status !== 'ready'
        ? [OUTPUT_QUALITY_FLAGS.invalidStageTransition]
        : undefined,
    })

    if (!gate.pass || session.status !== 'ready') {
      throw new CreativePublishBlockedError({
        code: 'creative_publish_blocked',
        sessionId,
        artifactId: finalArtifact.id,
        blockerReasons: session.status !== 'ready'
          ? [...gate.blockerReasons, OUTPUT_QUALITY_FLAGS.invalidStageTransition]
          : gate.blockerReasons,
        qualityStatus: session.qualityStatus,
        normalizationStatus: finalArtifact.normalizationStatus,
        validation: finalArtifact.validation,
        evaluation: finalArtifact.evaluation,
      })
    }

    const now = new Date().toISOString()
    const artifact = await CreativeStudioRepository.saveArtifact(this.promoteFinalArtifact({
      sourceArtifact: finalArtifact,
      sourceArtifactId: finalArtifact.id,
      evaluation: finalArtifact.evaluation || session.latestEvaluation || this.createBlockedEvaluation(finalArtifact.validation),
      status: 'published',
      artifactRole: 'published',
      version: (finalArtifact.version || 0) + 1,
      publishedAt: now,
    }))

    const agent = await AgentService.getAgentById(agentId)
    if (agent) {
      const nextStats = {
        ...agentStatsService.normalizeStats(agent.stats),
        creativeWorksCreated: (agent.stats?.creativeWorksCreated || 0) + 1,
      }

      await AgentService.updateAgent(agentId, {
        creativeWorks: (agent.creativeWorks || 0) + 1,
        stats: nextStats,
      })
    }

    const publishedSession = await CreativeStudioRepository.updateSession(sessionId, {
      ...session,
      status: 'published',
      qualityStatus: 'passed',
      publishedArtifactId: artifact.id,
      publishedAt: artifact.publishedAt || now,
      updatedAt: now,
      latestEvaluation: artifact.evaluation,
      rawModelOutput: artifact.rawModelOutput,
      validation: artifact.validation,
    })

    await CreativeStudioRepository.savePipelineEvent({
      id: generateId('creative_event'),
      sessionId,
      stage: 'published',
      status: 'completed',
      summary: `Published final artifact "${artifact.title}" to the creative library.`,
      payload: {
        artifactId: artifact.id,
      },
      createdAt: new Date().toISOString(),
    })

    return {
      session: this.hydrateSessionQuality(publishedSession),
      artifacts: (await CreativeStudioRepository.listArtifactsForSession(sessionId))
        .map((artifact) => this.hydrateArtifactQuality(artifact)),
      pipelineEvents: await CreativeStudioRepository.listPipelineEvents(sessionId),
    }
  }

  async getSessionDetail(agentId: string, sessionId: string): Promise<CreativeSessionDetail> {
    const session = await CreativeStudioRepository.getSession(sessionId)
    if (!session || session.agentId !== agentId) {
      throw new Error('Creative session not found')
    }

    return {
      session: this.hydrateSessionQuality(session),
      artifacts: (await CreativeStudioRepository.listArtifactsForSession(sessionId))
        .map((artifact) => this.hydrateArtifactQuality(artifact)),
      pipelineEvents: await CreativeStudioRepository.listPipelineEvents(sessionId),
    }
  }

  async buildContextPacket(agent: AgentRecord, brief: CreativeBrief): Promise<CreativeContextPacket> {
    const recentMessages = await this.listRecentMessages(agent.id)
    const recentMemories = await this.listRecentMemories(agent.id)
    const recentJournals = await FeatureContentRepository.listJournalEntries(agent.id, { limit: 2 })
    const recentDreams = await FeatureContentRepository.listDreams(agent.id, 1)
    const library = await CreativeStudioRepository.listPublishedLibrary(agent.id)
    const dominantEmotion = emotionalService.getDominantEmotion(agent.emotionalState, agent.emotionalProfile)
    const activeDreamImpression = agent.activeDreamImpression && new Date(agent.activeDreamImpression.expiresAt).getTime() > Date.now()
      ? agent.activeDreamImpression
      : null

    const signals: CreativeContextSignal[] = []

    signals.push({
      id: 'persona',
      sourceType: 'persona',
      label: 'Persona',
      snippet: summarizeText(agent.persona, 220),
      reason: 'Core behavioral anchor for voice and subject matter.',
      weight: 1,
    })

    for (const [index, goal] of (agent.goals || []).slice(0, 3).entries()) {
      signals.push({
        id: `goal-${index}`,
        sourceType: 'goal',
        label: `Goal ${index + 1}`,
        snippet: goal,
        reason: 'Active goals keep the creative output aligned with the agent’s priorities.',
        weight: 0.78 - index * 0.08,
      })
    }

    if (agent.linguisticProfile) {
      signals.push({
        id: 'linguistic-profile',
        sourceType: 'linguistic_profile',
        label: 'Linguistic profile',
        snippet: this.describeLinguisticProfile(agent),
        reason: 'Shapes diction, rhythm, and phrasing.',
        weight: 0.96,
      })
    }

    if (agent.psychologicalProfile) {
      signals.push({
        id: 'psychological-profile',
        sourceType: 'psychological_profile',
        label: 'Psychological profile',
        snippet: summarizeText(
          `${agent.psychologicalProfile.summary} Strengths: ${agent.psychologicalProfile.strengths.slice(0, 2).join(', ')}.`,
          220
        ),
        reason: 'Adds enduring creative biases and internal tension.',
        weight: 0.9,
      })
    }

    if (dominantEmotion) {
      signals.push({
        id: 'dominant-emotion',
        sourceType: 'emotion',
        label: 'Dominant emotion',
        snippet: `${dominantEmotion} is currently the strongest emotional influence.`,
        reason: 'Current mood should tint the piece without taking it over.',
        weight: 0.88,
      })
    }

    for (const [index, message] of recentMessages.entries()) {
      signals.push({
        id: `message-${message.id}`,
        sourceType: 'message',
        label: `Recent message ${index + 1}`,
        snippet: summarizeText(message.content, 180),
        reason: 'Recent language helps the piece sound current and agent-specific.',
        weight: 0.82 - index * 0.08,
        linkedEntityId: message.id,
      })
    }

    for (const [index, memory] of recentMemories.entries()) {
      signals.push({
        id: `memory-${memory.id}`,
        sourceType: 'memory',
        label: `Memory ${index + 1}`,
        snippet: summarizeText(memory.summary || memory.content, 180),
        reason: 'High-salience memory adds concrete continuity and specificity.',
        weight: 0.85 - index * 0.06,
        linkedEntityId: memory.id,
      })
    }

    for (const [index, journal] of recentJournals.entries()) {
      signals.push({
        id: `journal-${journal.id}`,
        sourceType: 'journal',
        label: `Journal reflection ${index + 1}`,
        snippet: summarizeText(journal.content, 180),
        reason: 'Journal context improves introspection and emotional coherence.',
        weight: 0.7 - index * 0.05,
        linkedEntityId: journal.id,
      })
    }

    for (const [index, dream] of recentDreams.entries()) {
      signals.push({
        id: `dream-${dream.id}`,
        sourceType: 'dream',
        label: `Dream image ${index + 1}`,
        snippet: summarizeText(`${dream.summary} Themes: ${dream.themes.join(', ')}`, 180),
        reason: 'Dream fragments can enrich imagery and symbolism.',
        weight: 0.62 - index * 0.04,
        linkedEntityId: dream.id,
      })
    }

    if (activeDreamImpression) {
      signals.push({
        id: `dream-impression-${activeDreamImpression.sourceDreamId}`,
        sourceType: 'dream',
        label: 'Active dream residue',
        snippet: summarizeText(`${activeDreamImpression.behaviorTilt}: ${activeDreamImpression.summary}`, 180),
        reason: 'A saved dream can softly bias emphasis or imagery without taking over.',
        weight: 0.57,
        linkedEntityId: activeDreamImpression.sourceDreamId,
      })
    }

    for (const [index, item] of library.slice(0, 2).entries()) {
      signals.push({
        id: `motif-${item.artifact.id}`,
        sourceType: 'motif',
        label: `Prior motif ${index + 1}`,
        snippet: summarizeText(`${item.artifact.title}: ${item.artifact.summary}`, 180),
        reason: 'Published motifs maintain continuity without repeating old lines.',
        weight: 0.58 - index * 0.04,
        linkedEntityId: item.artifact.id,
      })
    }

    const selectedSignals = signals
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 10)

    return {
      dominantEmotion,
      emotionalSummary: this.describeEmotionalContext(agent),
      voiceDirectives: this.buildVoiceDirectives(agent, brief),
      psychologicalDirectives: this.buildPsychologicalDirectives(agent),
      dreamDirectives: activeDreamImpression ? [
        `Active dream tilt: ${activeDreamImpression.behaviorTilt}.`,
        `Residual guidance: ${activeDreamImpression.guidance}`,
      ] : [],
      continuityMotifs: library.slice(0, 3).map((item) => item.artifact.title),
      selectedSignals,
    }
  }

  private buildGeneratorSystemPrompt(
    agent: AgentRecord,
    brief: CreativeBrief,
    contextPacket: CreativeContextPacket
  ): string {
    return [
      `You are ${agent.name}.`,
      `Persona anchor: ${agent.persona}`,
      'You are writing a creative piece, not answering like a generic assistant.',
      `Format: ${brief.format}. Tone: ${brief.tone}. Audience: ${brief.audience}.`,
      `Emotional summary: ${contextPacket.emotionalSummary}`,
      ...(contextPacket.dreamDirectives?.length ? [`Dream residue: ${contextPacket.dreamDirectives.join(' ')}`] : []),
      `Voice directives: ${contextPacket.voiceDirectives.join(' | ')}`,
      `Psychological directives: ${contextPacket.psychologicalDirectives.join(' | ') || 'Maintain internal coherence and curiosity.'}`,
      `Prompt version: ${CREATIVE_PROMPT_VERSION}`,
      'Valid example: {"title":"The Glass Elevator Remembers","summary":"A tense ascent turns into a confession about ambition and fear.","content":"The elevator kept its own weather...","themes":["ambition","pressure"],"inspiration":"Drawn from recent product urgency and lingering dream imagery."}',
      'Invalid example: ```json {"title":"Title: Launch","summary":"{\\"summary\\":\\"...\\"}","content":"**Content:** wrapper text"} ```',
      'Return JSON only with keys: title, summary, content, themes, inspiration.',
      'The content field must contain markdown-safe prose only. No HTML. No code fences.',
      'Do not prefix fields with Title:, Summary:, or Content: outside the JSON object.',
      'Do not mention the rubric, context packet, or that you are following instructions.',
    ].join('\n')
  }

  private buildDraftPrompt(brief: CreativeBrief, contextPacket: CreativeContextPacket): string {
    const wordRange = LENGTH_WORD_RANGE[brief.length]

    return [
      FORMAT_GUIDANCE[brief.format],
      `Creative intent: ${brief.intent}`,
      `Audience: ${brief.audience}`,
      `Tone target: ${brief.tone}`,
      `Length target: ${brief.length} (${wordRange.min}-${wordRange.max} words)`,
      brief.mustInclude.length > 0 ? `Must include: ${brief.mustInclude.join(', ')}` : 'Must include: none beyond the brief.',
      brief.avoid.length > 0 ? `Avoid: ${brief.avoid.join(', ')}` : 'Avoid: generic filler and vague abstractions.',
      brief.referenceNotes ? `Reference notes: ${brief.referenceNotes}` : 'Reference notes: none.',
      `Selected context signals:\n${contextPacket.selectedSignals.map((signal) => `- ${signal.label}: ${signal.snippet} (${signal.reason})`).join('\n')}`,
    ].join('\n\n')
  }

  private buildRevisionPrompt(
    brief: CreativeBrief,
    contextPacket: CreativeContextPacket,
    artifact: CreativeArtifact,
    evaluation: CreativeRubricEvaluation
  ): string {
    return [
      'Revise the draft using the evaluator feedback. Keep the strongest ideas, but repair weak areas.',
      `Original brief: ${brief.intent}`,
      `Repair instructions: ${evaluation.repairInstructions.join(' | ')}`,
      `Weaknesses: ${evaluation.weaknesses.join(' | ')}`,
      `Context signals to preserve:\n${contextPacket.selectedSignals.slice(0, 6).map((signal) => `- ${signal.label}: ${signal.snippet}`).join('\n')}`,
      `Current draft title: ${artifact.title}`,
      `Current draft content:\n${artifact.content}`,
      artifact.validation?.hardFailureFlags?.length
        ? `Validation blockers: ${artifact.validation.hardFailureFlags.join(' | ')}`
        : 'Validation blockers: none recorded.',
      'Return valid JSON with keys: title, summary, content, themes, inspiration.',
    ].join('\n\n')
  }

  private buildValidatedArtifact(params: {
    agentId: string
    sessionId: string
    format: CreativeFormat
    tone: CreativeTone
    audience: string
    llmResponse: string
    providerInfo: LLMProviderInfo
    version: number
    status: CreativeArtifact['status']
    artifactRole: OutputArtifactRole
    sourceRefs: OutputQualitySourceRef[]
    sourceArtifactId?: string
  }): CreativeArtifactBuildResult {
    const now = new Date().toISOString()
    const parsedResult = safeParseJsonWithExtraction<CreativeDraftPayload>(params.llmResponse)
    const labeledFallback = !parsedResult.parsed ? parseLabeledCreativeResponse(params.llmResponse) : null
    const parsed = parsedResult.parsed || labeledFallback || {}
    const usedLabeledFallback = Boolean(labeledFallback)
    const content = stripDecorativeBreaks(normalizeWhitespace(String(parsed.content || '')))
    const title = normalizeWhitespace(String(parsed.title || '')) || (content ? deriveFallbackTitle(content, params.format) : '')
    const summary = normalizeWhitespace(String(parsed.summary || '')) || summarizeText(content, 150)
    const parser = usedLabeledFallback ? 'labeled_sections' : parsedResult.parser
    const parsedSuccessfully = usedLabeledFallback || Boolean(parsedResult.parsed)
    const artifact: CreativeArtifact = {
      ...createPendingTrackedFields({
        rawModelOutput: createRawModelOutput(params.llmResponse, {
          parserNotes: parsedResult.parserNotes,
          capturedAt: now,
          responseFormat: 'json_object',
          promptVersion: CREATIVE_PROMPT_VERSION,
        }),
        sourceRefs: params.sourceRefs,
        promptVersion: CREATIVE_PROMPT_VERSION,
        repairCount: params.version > 1 ? 1 : 0,
      }),
      id: generateId('creative_artifact'),
      agentId: params.agentId,
      sessionId: params.sessionId,
      format: params.format,
      status: params.status,
      artifactRole: params.artifactRole,
      normalizationStatus: parsedSuccessfully ? (params.artifactRole === 'repair' ? 'repaired' : 'normalized') : 'failed',
      normalization: {
        status: parsedSuccessfully ? (params.artifactRole === 'repair' ? 'repaired' : 'normalized') : 'failed',
        parser,
        violations: parsedSuccessfully ? [] : ['creative_artifact_contract_parse_failed'],
        repairedFromId: params.sourceArtifactId,
      },
      sourceArtifactId: params.sourceArtifactId,
      version: params.version,
      title,
      summary,
      content,
      render: buildMessageRenderData(content),
      themes: normalizeStringList(parsed.themes),
      inspiration: normalizeSingleText(parsed?.inspiration) || 'Derived from the selected creative context.',
      audience: params.audience,
      tone: params.tone,
      wordCount: countWords(content),
      provider: params.providerInfo.provider,
      model: params.providerInfo.model,
      createdAt: now,
      updatedAt: now,
    }

    const validation = this.validateCreativeArtifact(artifact, {
      parsedSuccessfully,
      sourceRefs: params.sourceRefs,
    })

    return {
      artifact: {
        ...artifact,
        validation,
        qualityStatus: validation.pass ? 'pending' : 'failed',
      },
      validation,
    }
  }

  private async evaluateArtifact(
    agent: AgentRecord,
    brief: CreativeBrief,
    contextPacket: CreativeContextPacket,
    artifact: CreativeArtifact,
    providerInfo: LLMProviderInfo
  ): Promise<CreativeRubricEvaluation> {
    const heuristic = this.scoreArtifactHeuristically(brief, artifact)

    try {
      const response = await generateText({
        providerInfo,
        temperature: 0.2,
        maxTokens: 1200,
        messages: [
          {
            role: 'system',
            content: [
              'You are a strict creative editor.',
              'Evaluate the artifact against the requested brief and return JSON only.',
              'Use keys: pass, overallScore, dimensions, strengths, weaknesses, repairInstructions, evaluatorSummary.',
              'dimensions must include formatFidelity, originality, voiceConsistency, emotionalCoherence, specificity, readability.',
              'Each dimension must have score and rationale.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `Agent persona: ${agent.persona}`,
              `Brief intent: ${brief.intent}`,
              `Tone: ${brief.tone}, length: ${brief.length}, audience: ${brief.audience}`,
              `Dominant emotion: ${contextPacket.dominantEmotion || 'none'}`,
              `Signals used: ${contextPacket.selectedSignals.slice(0, 6).map((signal) => `${signal.label}: ${signal.snippet}`).join(' | ')}`,
              `Artifact title: ${artifact.title}`,
              `Artifact content:\n${artifact.content}`,
            ].join('\n\n'),
          },
        ],
      })

      const parsedResult = safeParseJsonWithExtraction<CreativeRubricEvaluation & {
        dimensions?: Partial<Record<CreativeRubricDimension, { score?: number; rationale?: string }>>
      }>(response.content)
      const parsed = parsedResult.parsed

      if (parsed?.dimensions) {
        const mergedDimensions = ([
          'formatFidelity',
          'originality',
          'voiceConsistency',
          'emotionalCoherence',
          'specificity',
          'readability',
        ] as CreativeRubricDimension[]).reduce((accumulator, key) => {
          const dimension = parsed.dimensions?.[key]
          accumulator[key] = {
            score: clamp(Math.round(dimension?.score || heuristic.dimensions[key].score)),
            rationale: dimension?.rationale?.trim() || heuristic.dimensions[key].rationale,
          }
          return accumulator
        }, {} as Record<CreativeRubricDimension, { score: number; rationale: string }>)

        const overallScore = clamp(Math.round(
          Object.values(mergedDimensions).reduce((total, entry) => total + entry.score, 0) / 6
        ))

        const strengths = normalizeStringList(parsed.strengths).slice(0, 4)
        const weaknesses = normalizeStringList(parsed.weaknesses).slice(0, 4)
        const repairInstructions = normalizeStringList(parsed.repairInstructions).slice(0, 4)
        const hardFailureFlags = [
          ...(artifact.validation?.hardFailureFlags || []),
          ...normalizeStringList(parsed.hardFailureFlags),
        ]

        return {
          pass: Boolean(parsed.pass) && overallScore >= 80 && hardFailureFlags.length === 0,
          overallScore,
          dimensions: mergedDimensions,
          hardFailureFlags,
          strengths: strengths.length > 0 ? strengths : heuristic.strengths,
          weaknesses: weaknesses.length > 0 ? weaknesses : heuristic.weaknesses,
          repairInstructions: repairInstructions.length > 0 ? repairInstructions : heuristic.repairInstructions,
          evaluatorSummary: parsed.evaluatorSummary?.trim() || heuristic.evaluatorSummary,
        }
      }
    } catch (error) {
      console.error('Creative evaluation fallback:', error)
    }

    return heuristic
  }

  private scoreArtifactHeuristically(brief: CreativeBrief, artifact: CreativeArtifact): CreativeRubricEvaluation {
    const wordRange = LENGTH_WORD_RANGE[brief.length]
    const content = artifact.content
    const lower = content.toLowerCase()
    const lineCount = content.split('\n').filter((line) => line.trim()).length
    const wordCount = artifact.wordCount
    const hasUntitledTitle = /^untitled\b/i.test(artifact.title)
    const leakedLabeledSections = /\*\*title:\*\*|\*\*summary:\*\*|\*\*content:\*\*/i.test(content)

    const dimensions: Record<CreativeRubricDimension, { score: number; rationale: string }> = {
      formatFidelity: {
        score: clamp(
          brief.format === 'poem'
            ? 60 + (lineCount >= 6 ? 20 : 0) + (content.includes('\n') ? 10 : 0)
            : brief.format === 'dialogue'
              ? 55 + ((content.match(/:/g) || []).length >= 4 ? 25 : 0)
              : brief.format === 'song'
                ? 58 + (/chorus|verse/i.test(content) ? 20 : 0)
                : 68 + (wordCount >= wordRange.min ? 10 : -8),
        ),
        rationale: 'Checks whether the piece behaves like the requested format.',
      },
      originality: {
        score: clamp(58 + (new Set(lower.split(/\W+/).filter(Boolean)).size > 80 ? 18 : 0) + (!/in conclusion|ultimately|journey of life/.test(lower) ? 10 : -6)),
        rationale: 'Rewards varied language and penalizes stock phrasing.',
      },
      voiceConsistency: {
        score: clamp(62 + (brief.tone === 'philosophical' && /because|therefore|perhaps/.test(lower) ? 12 : 0) + (brief.tone === 'playful' && /!|\?/.test(content) ? 8 : 0)),
        rationale: 'Checks whether the tone target is reflected in diction and rhythm.',
      },
      emotionalCoherence: {
        score: clamp(60 + (artifact.inspiration ? 8 : 0) + (artifact.themes.length > 0 ? 8 : 0) + (wordCount >= wordRange.min ? 8 : -12)),
        rationale: 'Measures emotional continuity and internal fit with the brief.',
      },
      specificity: {
        score: clamp(
          56
          + ((content.match(/\b[A-Za-z]{7,}\b/g) || []).length > 18 ? 14 : 0)
          + (brief.mustInclude.every((entry) => lower.includes(entry.toLowerCase())) ? 12 : -6)
          + (hasUntitledTitle ? -12 : 0)
        ),
        rationale: 'Rewards concrete details and adherence to requested anchors.',
      },
      readability: {
        score: clamp(
          64
          + (wordCount >= wordRange.min && wordCount <= wordRange.max ? 18 : -8)
          + (!/^\s*[-*]\s/m.test(content) ? 4 : 0)
          + (leakedLabeledSections ? -16 : 0)
        ),
        rationale: 'Checks length control and whether the text is cleanly readable.',
      },
    }

    const overallScore = clamp(Math.round(
      Object.values(dimensions).reduce((total, entry) => total + entry.score, 0) / 6
    ))
    const weaknesses: string[] = []
    const strengths: string[] = []

    for (const [key, entry] of Object.entries(dimensions) as Array<[CreativeRubricDimension, { score: number; rationale: string }]>) {
      if (entry.score < 70) {
        weaknesses.push(`${key} needs stronger execution.`)
      } else if (entry.score >= 82) {
        strengths.push(`${key} is convincingly strong.`)
      }
    }

    if (strengths.length === 0) {
      strengths.push('The piece has a usable foundation and coherent intent.')
    }
    if (weaknesses.length === 0) {
      weaknesses.push('No major structural weakness was detected.')
    }

    const repairInstructions = weaknesses[0] === 'No major structural weakness was detected.'
      ? ['Preserve the current structure and only sharpen standout lines if needed.']
      : weaknesses.map((entry) => `Repair ${entry.replace(' needs stronger execution.', '')} with more specificity and stronger format discipline.`)
    const hardFailureFlags = artifact.validation?.hardFailureFlags || []

    return {
      pass: overallScore >= 80 && weaknesses.length <= 2 && !hasUntitledTitle && !leakedLabeledSections && hardFailureFlags.length === 0,
      overallScore,
      dimensions,
      hardFailureFlags,
      strengths: strengths.slice(0, 4),
      weaknesses: weaknesses.slice(0, 4),
      repairInstructions: repairInstructions.slice(0, 4),
      evaluatorSummary: overallScore >= 72
        ? `The piece is publishable with an overall score of ${overallScore}.`
        : `The piece missed the quality gate with an overall score of ${overallScore}.`,
    }
  }

  private validateCreativeArtifact(
    artifact: CreativeArtifact,
    options: {
      parsedSuccessfully: boolean
      sourceRefs: OutputQualitySourceRef[]
    }
  ): OutputQualityValidationReport {
    const hardFailureFlags = [
      ...validateRequiredTextFields({
        title: artifact.title,
        summary: artifact.summary,
        content: artifact.content,
      }),
      ...validateSharedArtifactText({
        title: artifact.title,
        summary: artifact.summary,
        content: artifact.content,
      }),
      ...validateSourceRefs(options.sourceRefs),
      ...(options.parsedSuccessfully ? [] : ['creative_structured_extraction_failed']),
      ...(/^\s*(title|\*\*title:\*\*|```)/i.test(artifact.title) ? ['creative_title_prefix_leakage'] : []),
      ...(/^\s*[\[{]/.test(artifact.summary) ? ['creative_summary_wrapper_leakage'] : []),
      ...(/\b(title|summary|content)\b\s*:/i.test(artifact.summary) ? ['creative_summary_schema_leakage'] : []),
      ...(/\b(title|summary|content)\b\s*:/i.test(artifact.content) ? ['creative_content_wrapper_leakage'] : []),
      ...(!artifact.render?.blocks?.length && artifact.content.trim() ? ['creative_render_generation_failed'] : []),
    ]

    const softWarnings = [
      ...(artifact.themes.length === 0 ? ['creative_missing_themes'] : []),
      ...(!artifact.inspiration.trim() ? ['creative_missing_inspiration'] : []),
    ]

    return createValidationReport({
      hardFailureFlags,
      softWarnings,
      validatorVersion: CREATIVE_VALIDATOR_VERSION,
    })
  }

  private createBlockedEvaluation(validation?: OutputQualityValidationReport): CreativeRubricEvaluation {
    const blockerMessage = validation?.hardFailureFlags.length
      ? `Validation blocked evaluation: ${validation.hardFailureFlags.join(', ')}.`
      : 'Validation blocked evaluation.'

    return {
      pass: false,
      overallScore: 0,
      dimensions: {
        formatFidelity: { score: 0, rationale: blockerMessage },
        originality: { score: 0, rationale: blockerMessage },
        voiceConsistency: { score: 0, rationale: blockerMessage },
        emotionalCoherence: { score: 0, rationale: blockerMessage },
        specificity: { score: 0, rationale: blockerMessage },
        readability: { score: 0, rationale: blockerMessage },
      },
      hardFailureFlags: validation?.hardFailureFlags || ['prompt_or_schema_leakage'],
      strengths: [],
      weaknesses: [blockerMessage],
      repairInstructions: [
        'Return a clean JSON object only.',
        'Populate title, summary, and content with final user-facing prose.',
        'Remove wrapper labels, schema leakage, and fenced output.',
      ],
      evaluatorSummary: blockerMessage,
    }
  }

  private promoteFinalArtifact(params: {
    sourceArtifact: CreativeArtifact
    sourceArtifactId: string
    evaluation: CreativeRubricEvaluation
    status: CreativeArtifact['status']
    artifactRole: OutputArtifactRole
    version: number
    publishedAt?: string
  }): CreativeArtifact {
    const now = new Date().toISOString()

    return {
      ...params.sourceArtifact,
      id: generateId('creative_artifact'),
      status: params.status,
      artifactRole: params.artifactRole,
      sourceArtifactId: params.sourceArtifactId,
      version: params.version,
      evaluation: params.evaluation,
      qualityScore: params.evaluation.overallScore,
      repairCount: params.artifactRole === 'published'
        ? params.sourceArtifact.repairCount ?? 0
        : Math.max(params.sourceArtifact.repairCount ?? 0, params.sourceArtifact.version > 1 ? 1 : 0),
      normalizationStatus: params.sourceArtifact.normalizationStatus || 'normalized',
      normalization: {
        ...params.sourceArtifact.normalization,
        repairedFromId: params.sourceArtifactId,
      },
      publishedAt: params.publishedAt,
      createdAt: now,
      updatedAt: now,
      ...syncTrackedQualityState({
        ...params.sourceArtifact,
        evaluation: params.evaluation,
        repairCount: params.sourceArtifact.repairCount ?? 0,
      }, {
        evaluationPass: params.evaluation.pass,
      }),
    }
  }

  private describeLinguisticProfile(agent: AgentRecord): string {
    const profile = agent.linguisticProfile
    if (!profile) {
      return 'No linguistic profile available.'
    }

    const formality = profile.formality > 0.65 ? 'formal' : profile.formality < 0.35 ? 'casual' : 'balanced'
    const verbosity = profile.verbosity > 0.65 ? 'expansive' : profile.verbosity < 0.35 ? 'concise' : 'measured'
    const humor = profile.humor > 0.55 ? 'playful' : 'serious'
    const expressiveness = profile.expressiveness > 0.65 ? 'image-rich' : 'controlled'

    return `Voice trends ${formality}, ${verbosity}, ${humor}, and ${expressiveness}. Preferred words: ${(profile.preferredWords || []).slice(0, 5).join(', ') || 'none recorded'}.`
  }

  private describeEmotionalContext(agent: AgentRecord): string {
    const influential = emotionalService.getInfluentialEmotion(agent.emotionalState, agent.emotionalProfile)
    const recentHistory = (agent.emotionalHistory || [])
      .slice(-3)
      .map((entry) => `${entry.emotion} (${Math.round(entry.intensity * 100)}%)`)
      .join(', ')

    return `${influential.emotion} is the main influence at ${Math.round(influential.intensity * 100)}% from ${influential.source}. Recent emotional movement: ${recentHistory || 'no recent events recorded'}.`
  }

  private buildVoiceDirectives(agent: AgentRecord, brief: CreativeBrief): string[] {
    const directives = [
      `Sound like ${agent.name}, not a generic assistant.`,
      `Lean into a ${brief.tone} register while staying readable.`,
      `Aim for ${brief.length} length discipline.`,
    ]

    if (agent.linguisticProfile?.signatureExpressions?.length) {
      directives.push(`Borrow the agent's signature rhythm rather than copying stock phrasing.`)
    }

    if (brief.mustInclude.length > 0) {
      directives.push(`Work in these anchors naturally: ${brief.mustInclude.join(', ')}.`)
    }

    return directives
  }

  private buildPsychologicalDirectives(agent: AgentRecord): string[] {
    if (!agent.psychologicalProfile) {
      return []
    }

    return [
      `Cognitive style leans ${
        agent.psychologicalProfile.cognitiveStyle.analyticalVsIntuitive > 0 ? 'intuitive' : 'analytical'
      } and ${
        agent.psychologicalProfile.cognitiveStyle.abstractVsConcrete > 0 ? 'abstract' : 'concrete'
      }.`,
      `Communication style directness ${Math.round(agent.psychologicalProfile.communicationStyle.directness * 100)}%.`,
      `Attachment style ${agent.psychologicalProfile.attachmentStyle}.`,
      `Strengths to echo: ${agent.psychologicalProfile.strengths.slice(0, 2).join(', ')}.`,
    ]
  }

  private hydrateSessionQuality(session: CreativeSession): CreativeSession {
    return {
      ...session,
      qualityStatus: session.qualityStatus || 'legacy_unvalidated',
      repairCount: session.repairCount ?? 0,
      promptVersion: session.promptVersion,
    }
  }

  private hydrateArtifactQuality(artifact: CreativeArtifact): CreativeArtifact {
    const contentLeakage = [
      ...detectTextLeakage(artifact.title),
      ...detectTextLeakage(artifact.summary),
      ...detectTextLeakage(artifact.content),
    ]
    const validation = artifact.validation || (contentLeakage.length > 0
      ? createValidationReport({
          hardFailureFlags: [...new Set(contentLeakage)],
          validatorVersion: CREATIVE_VALIDATOR_VERSION,
        })
      : undefined)

    return {
      ...artifact,
      normalizationStatus: artifact.normalizationStatus || 'legacy_unvalidated',
      qualityStatus: artifact.qualityStatus || 'legacy_unvalidated',
      repairCount: artifact.repairCount ?? 0,
      validation,
    }
  }

  private async listRecentMessages(agentId: string): Promise<MessageRecord[]> {
    const rows = await getDb().query.messages.findMany({
      where: eq(messages.agentId, agentId),
      orderBy: desc(messages.timestamp),
      limit: 3,
    })

    return rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      content: row.content,
      type: row.type as MessageRecord['type'],
      timestamp: row.timestamp,
      roomId: row.roomId || undefined,
      metadata: row.metadata || undefined,
      userId: row.userId || undefined,
    }))
  }

  private async listRecentMemories(agentId: string): Promise<MemoryRecord[]> {
    const rows = await getDb().query.memories.findMany({
      where: eq(memories.agentId, agentId),
      orderBy: desc(memories.timestamp),
      limit: 3,
    })

    return rows.map((row) => ({
      id: row.id,
      agentId: row.agentId,
      type: row.type as MemoryRecord['type'],
      content: row.content,
      summary: row.summary,
      keywords: row.keywords || [],
      importance: row.importance,
      context: row.context,
      origin: row.origin as MemoryRecord['origin'],
      linkedMessageIds: row.linkedMessageIds || [],
      metadata: row.metadata || undefined,
      userId: row.userId || undefined,
      isActive: row.isActive,
      timestamp: row.timestamp,
    }))
  }
}

export const creativityService = new CreativityService()
export type { BootstrapPayload, CreativeSessionDetail }
