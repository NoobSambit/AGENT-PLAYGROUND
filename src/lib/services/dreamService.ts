import { buildMessageRenderData } from '@/lib/chat/rendering'
import { generateId } from '@/lib/db/utils'
import { getPersistenceMode, readsFromPostgres, writesToFirestore, writesToPostgres } from '@/lib/db/persistence'
import { generateText } from '@/lib/llm/provider'
import type { LLMProviderInfo } from '@/lib/llmConfig'
import {
  getDreamSessionDetailFromFirestore,
  listDreamSessionsFromFirestore,
  listSavedDreamsFromFirestore,
  writeDreamPipelineEventToFirestore,
  writeDreamSessionToFirestore,
  writeDreamToFirestore,
} from '@/lib/dream/firestoreStore'
import { DreamWorkspaceRepository } from '@/lib/repositories/dreamWorkspaceRepository'
import {
  createPendingTrackedFields,
  syncTrackedQualityState,
} from '@/lib/services/outputQuality/contracts'
import { applyFinalQualityGate } from '@/lib/services/outputQuality/evaluators'
import {
  createRawModelOutput,
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
  Dream,
  DreamBehaviorTilt,
  DreamBootstrapPayload,
  DreamComposeInput,
  DreamContextSignal,
  DreamDisplayMetrics,
  DreamFocus,
  DreamHardFailureFlag,
  DreamImpression,
  DreamPipelineEvent,
  DreamQualityDimension,
  DreamQualityEvaluation,
  DreamScene,
  DreamSession,
  DreamSessionDetail,
  DreamType,
  EmotionType,
  MemoryRecord,
  MessageRecord,
} from '@/types/database'
import type { OutputArtifactRole, OutputQualityValidationReport } from '@/types/outputQuality'
import { AgentService } from './agentService'
import { agentProgressService } from './agentProgressService'
import { emotionalService } from './emotionalService'
import { journalService } from './journalService'
import { LearningService } from './learningService'
import { MemoryService } from './memoryService'
import { MessageService } from './messageService'

const DAILY_LIMIT = 12
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000
const DREAM_PROMPT_VERSION = 'phase4-dream-quality-v1'
const DREAM_VALIDATOR_VERSION = 'phase4-dream-validator-v1'
const DREAM_GATE_THRESHOLDS = {
  overallScoreMinimum: 80,
  dimensionFloor: 70,
}

const DREAM_TYPES: DreamType[] = [
  'symbolic',
  'nightmare',
  'memory_replay',
  'prophetic',
  'lucid',
  'recurring',
]

const QUALITY_DIMENSIONS: DreamQualityDimension[] = [
  'imageryVividness',
  'symbolicCoherence',
  'psychologicalGrounding',
  'agentSpecificity',
  'narrativeClarity',
  'interpretiveUsefulness',
]

const FOCUS_LABELS: Record<DreamFocus, string> = {
  memory: 'memory',
  emotion: 'emotion',
  future: 'future possibility',
  relationship: 'relationship tension',
  conflict: 'unresolved conflict',
}

const TILT_BY_TYPE: Record<DreamType, DreamBehaviorTilt> = {
  symbolic: 'reflective',
  nightmare: 'cautious',
  memory_replay: 'reflective',
  prophetic: 'anticipatory',
  lucid: 'agentic',
  recurring: 'fixated',
}

const TYPE_HINTS: Record<DreamType, string> = {
  symbolic: 'Best when the agent is emotionally mixed and meaning is more important than plot.',
  nightmare: 'Best when fear, caution, pressure, or avoidance need direct symbolic processing.',
  memory_replay: 'Best when one memory still colors present interpretation or behavior.',
  prophetic: 'Best when the agent is projecting consequences or reading fragile future signals.',
  lucid: 'Best when the agent wants control, agency, or self-direction inside the dream.',
  recurring: 'Best when motifs or unresolved loops keep returning across context.',
}

function normalizeNote(value?: string) {
  return value?.trim() || undefined
}

function summarizeText(value: string, maxLength = 180) {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function normalizeStringList(value: unknown, limit = 8) {
  if (!Array.isArray(value)) return []
  return value.map((entry) => String(entry).trim()).filter(Boolean).slice(0, limit)
}

function normalizeDreamFocus(value: unknown): DreamFocus[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is DreamFocus => ['memory', 'emotion', 'future', 'relationship', 'conflict'].includes(String(entry)))
    .slice(0, 4)
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function describeLinguisticProfile(agent: AgentRecord) {
  if (!agent.linguisticProfile) return 'No linguistic profile available.'
  return `Formality ${(agent.linguisticProfile.formality * 100).toFixed(0)}%, verbosity ${(agent.linguisticProfile.verbosity * 100).toFixed(0)}%, humor ${(agent.linguisticProfile.humor * 100).toFixed(0)}%, expressiveness ${(agent.linguisticProfile.expressiveness * 100).toFixed(0)}%.`
}

function deriveDisplayMetrics(evaluation?: DreamQualityEvaluation): DreamDisplayMetrics {
  const dimensions = evaluation?.dimensions
  return {
    imageryVividness: dimensions?.imageryVividness?.score || 0,
    symbolicCoherence: dimensions?.symbolicCoherence?.score || 0,
    psychologicalGrounding: dimensions?.psychologicalGrounding?.score || 0,
    narrativeClarity: dimensions?.narrativeClarity?.score || 0,
    interpretiveUsefulness: dimensions?.interpretiveUsefulness?.score || 0,
    lucidity: clamp(Math.round(((dimensions?.agentSpecificity?.score || 0) * 0.45) + ((dimensions?.narrativeClarity?.score || 0) * 0.55))),
    coherence: clamp(Math.round(((dimensions?.symbolicCoherence?.score || 0) * 0.55) + ((dimensions?.narrativeClarity?.score || 0) * 0.45))),
  }
}

function buildDreamMarkdown(dream: {
  title: string
  summary: string
  scenes: DreamScene[]
  interpretationSummary: string
  themes: string[]
}) {
  return [
    `# ${dream.title}`,
    '',
    dream.summary,
    '',
    ...dream.scenes.flatMap((scene) => [
      `## ${scene.heading}`,
      '',
      scene.summary,
      '',
      scene.body,
      '',
    ]),
    '## Interpretation',
    '',
    dream.interpretationSummary,
    '',
    dream.themes.length ? `Themes: ${dream.themes.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

interface DreamDraftPayload {
  title?: string
  summary?: string
  scenes?: Array<{
    heading?: string
    summary?: string
    body?: string
    symbols?: string[]
    emotions?: string[]
  }>
  symbols?: Array<{
    symbol?: string
    meaning?: string
    evidence?: string
    emotionalAssociation?: string
  }>
  themes?: string[]
  latentTensions?: Array<{ tension?: string; whyItMatters?: string }>
  interpretation?: {
    summary?: string
    insights?: string[]
    cautions?: string[]
    openLoops?: string[]
  }
  emotionalProcessing?: string
}

interface DreamBuildResult {
  dream: Dream
  validation: OutputQualityValidationReport
}

interface DreamSaveBlockedPayload {
  code: 'dream_save_blocked'
  sessionId: string
  dreamId?: string
  blockerReasons: string[]
  qualityStatus: DreamSession['qualityStatus']
  normalizationStatus?: Dream['normalizationStatus']
  validation?: OutputQualityValidationReport
  evaluation?: DreamQualityEvaluation
}

export class DreamSaveBlockedError extends Error {
  readonly payload: DreamSaveBlockedPayload

  constructor(payload: DreamSaveBlockedPayload, message = 'Dream is blocked from save until quality preconditions pass.') {
    super(message)
    this.name = 'DreamSaveBlockedError'
    this.payload = payload
  }
}

class DreamService {
  getAllowedTypes(): DreamType[] {
    return DREAM_TYPES
  }

  suggestType(agent: AgentRecord): DreamType {
    const dominant = emotionalService.getDominantEmotion(agent.emotionalState, agent.emotionalProfile)
    if (!dominant) return 'symbolic'
    if (dominant === 'fear' || dominant === 'anger' || dominant === 'disgust') return 'nightmare'
    if (dominant === 'anticipation') return 'prophetic'
    if (dominant === 'trust') return 'memory_replay'
    if (dominant === 'joy') return 'lucid'
    if (dominant === 'sadness') return 'recurring'
    return 'symbolic'
  }

  normalizeComposeInput(agent: AgentRecord, input: Partial<DreamComposeInput>): DreamComposeInput {
    return {
      type: DREAM_TYPES.includes(input.type as DreamType) ? input.type as DreamType : this.suggestType(agent),
      userNote: normalizeNote(input.userNote),
      focus: normalizeDreamFocus(input.focus),
    }
  }

  getActiveImpression(agent: AgentRecord): DreamImpression | null {
    const impression = agent.activeDreamImpression
    if (!impression?.expiresAt) return null
    return new Date(impression.expiresAt).getTime() > Date.now() ? impression : null
  }

  buildPromptContext(agent: AgentRecord): string | undefined {
    const impression = this.getActiveImpression(agent)
    if (!impression) return undefined
    return [
      `Active dream residue is still present until ${formatDateTime(impression.expiresAt)}.`,
      `Behavior tilt: ${impression.behaviorTilt}.`,
      `Residual summary: ${impression.summary}`,
      `Guidance: ${impression.guidance}`,
      `Dominant themes: ${impression.dominantThemes.join(', ') || 'none'}.`,
      'Let this subtly shape emphasis, caution, or introspection without overriding persona.',
    ].join('\n')
  }

  async getBootstrap(agentId: string): Promise<DreamBootstrapPayload> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) throw new Error('Agent not found')

    const recentSessions = readsFromPostgres(getPersistenceMode())
      ? await DreamWorkspaceRepository.listSessions(agentId, { limit: 8 })
      : await listDreamSessionsFromFirestore(agentId, 8)

    const recentSavedDreams = readsFromPostgres(getPersistenceMode())
      ? await DreamWorkspaceRepository.listDreamsForAgent(agentId, { savedOnly: true, limit: 8 })
      : await listSavedDreamsFromFirestore(agentId, 8)

    const readyToSaveCount = recentSessions.filter((session) => session.status === 'ready').length
    const failedSessions = recentSessions.filter((session) => session.status === 'failed').length
    const nightmareCount = recentSavedDreams.filter((dream) => dream.type === 'nightmare').length
    const symbolCounts = new Map<string, number>()
    const themeCounts = new Map<string, number>()

    for (const dream of recentSavedDreams) {
      for (const symbol of dream.symbols) {
        symbolCounts.set(symbol.symbol, (symbolCounts.get(symbol.symbol) || 0) + 1)
      }
      for (const theme of dream.themes) {
        themeCounts.set(theme, (themeCounts.get(theme) || 0) + 1)
      }
    }

    const recurringSymbols = Array.from(symbolCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([symbol, count]) => ({ symbol, count }))

    const recurringThemes = Array.from(themeCounts.entries())
      .sort((left, right) => right[1] - left[1])
      .slice(0, 6)
      .map(([theme, count]) => ({ theme, count }))

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        dreamCount: agent.dreamCount || 0,
      },
      availableTypes: this.getAllowedTypes(),
      suggestedType: this.suggestType(agent),
      defaults: {
        userNote: '',
        focus: [],
      },
      activeDreamImpression: this.getActiveImpression(agent),
      recentSessions,
      recentSavedDreams,
      archiveMetrics: {
        totalSavedDreams: recentSavedDreams.length,
        totalSessions: recentSessions.length,
        readyToSaveCount,
        failedSessions,
        nightmareRatio: recentSavedDreams.length ? nightmareCount / recentSavedDreams.length : 0,
        recurringSymbols,
        recurringThemes,
      },
      archiveFilters: {
        types: this.getAllowedTypes(),
      },
    }
  }

  async createSession(agentId: string, input: Partial<DreamComposeInput>): Promise<DreamSession> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) throw new Error('Agent not found')

    const usageCount = readsFromPostgres(getPersistenceMode())
      ? await DreamWorkspaceRepository.countSessionsSince(agentId, new Date(Date.now() - RATE_WINDOW_MS).toISOString())
      : (await listDreamSessionsFromFirestore(agentId, DAILY_LIMIT)).filter(
        (session) => new Date(session.createdAt).getTime() >= Date.now() - RATE_WINDOW_MS
      ).length

    if (usageCount >= DAILY_LIMIT) {
      throw new Error('Daily dream generation limit reached. Try again tomorrow.')
    }

    const normalizedInput = this.normalizeComposeInput(agent, input)
    const now = new Date().toISOString()
    const session: DreamSession = {
      id: generateId('dream_session'),
      agentId,
      status: 'draft',
      ...createPendingTrackedFields({ promptVersion: DREAM_PROMPT_VERSION }),
      latestStage: 'prepare_context',
      type: normalizedInput.type,
      normalizedInput,
      createdAt: now,
      updatedAt: now,
    }

    await this.saveSession(session)
    await this.savePipelineEvent(agentId, {
      id: generateId('dream_event'),
      sessionId: session.id,
      stage: 'prepare_context',
      status: 'completed',
      summary: 'Created a Dream V2 draft session and normalized the compose input.',
      payload: {
        normalizedInput,
      },
      createdAt: now,
    })

    return session
  }

  async getSessionDetail(agentId: string, sessionId: string): Promise<DreamSessionDetail> {
    if (readsFromPostgres(getPersistenceMode())) {
      const session = await DreamWorkspaceRepository.getSession(sessionId)
      if (!session || session.agentId !== agentId) {
        return { session: null, dreams: [], pipelineEvents: [] }
      }
      return {
        session,
        dreams: await DreamWorkspaceRepository.listDreamsForSession(sessionId),
        pipelineEvents: await DreamWorkspaceRepository.listPipelineEvents(sessionId),
      }
    }

    return getDreamSessionDetailFromFirestore(agentId, sessionId)
  }

  async generateSession(agentId: string, sessionId: string, providerInfo: LLMProviderInfo | null): Promise<DreamSessionDetail> {
    if (!providerInfo) throw new Error('LLM provider not configured')

    const agent = await AgentService.getAgentById(agentId)
    if (!agent) throw new Error('Agent not found')

    const existing = await this.getSessionRecord(agentId, sessionId)
    if (!existing) throw new Error('Dream session not found')

    const contextSignals = await this.buildContextSignals(agent, existing.normalizedInput)
    const recurringThemes = contextSignals
      .filter((signal) => signal.sourceType === 'dream')
      .map((signal) => signal.label)
      .slice(0, 4)
    const recurringSymbols = contextSignals
      .filter((signal) => signal.sourceType === 'dream')
      .flatMap((signal) => signal.snippet.split(',').map((entry) => entry.trim()))
      .slice(0, 4)

    const contextPacket: NonNullable<DreamSession['contextPacket']> = {
      selectedSignals: contextSignals,
      summary: `${contextSignals.length} ranked signals selected for ${existing.type.replaceAll('_', ' ')} dream generation.`,
      dominantEmotion: emotionalService.getDominantEmotion(agent.emotionalState, agent.emotionalProfile),
      recurringThemes,
      recurringSymbols,
      activeDreamImpression: this.getActiveImpression(agent),
    }

    let session: DreamSession = {
      ...existing,
      status: 'generating',
      latestStage: 'condition_subconscious',
      contextPacket,
      sourceRefs: contextPacket.selectedSignals.slice(0, 8).map((signal) => ({
        id: signal.id,
        sourceType: signal.sourceType,
        label: signal.label,
        reason: signal.reason,
        linkedEntityId: signal.linkedEntityId,
      })),
      provider: providerInfo.provider,
      model: providerInfo.model,
      promptVersion: DREAM_PROMPT_VERSION,
      qualityStatus: 'pending',
      failureReason: undefined,
      updatedAt: new Date().toISOString(),
    }
    await this.saveSession(session)
    await this.savePipelineEvent(agentId, {
      id: generateId('dream_event'),
      sessionId,
      stage: 'condition_subconscious',
      status: 'active',
      summary: 'Conditioning dream generation from persona, emotion, memory, journals, and recurring motifs.',
      payload: {
        signalCount: contextSignals.length,
      },
      createdAt: new Date().toISOString(),
    })

    await this.savePipelineEvent(agentId, {
      id: generateId('dream_event'),
      sessionId,
      stage: 'condition_subconscious',
      status: 'completed',
      summary: 'Prepared a bounded subconscious packet from recent agent state and saved materials.',
      payload: {
        contextPacket,
      },
      createdAt: new Date().toISOString(),
    })

    const draftResponse = await generateText({
      providerInfo,
      temperature: existing.type === 'nightmare' ? 0.8 : 0.86,
      maxTokens: 2600,
      messages: [
        { role: 'system', content: this.buildGeneratorSystemPrompt(agent, session) },
        { role: 'user', content: this.buildDraftPrompt(session, contextPacket) },
      ],
    })

    const draftBuild = this.parseDream({
      agent,
      session,
      llmResponse: draftResponse.content,
      providerInfo,
      version: 1,
      artifactRole: 'draft',
    })
    let candidateDream = await this.saveDream(draftBuild.dream)

    await this.savePipelineEvent(agentId, {
      id: generateId('dream_event'),
      sessionId,
      stage: 'draft_dream',
      status: 'completed',
      summary: `Generated draft "${candidateDream.title}".`,
      payload: {
        dreamId: candidateDream.id,
        sceneCount: candidateDream.scenes.length,
        normalization: candidateDream.normalization,
        validation: candidateDream.validation,
      },
      createdAt: new Date().toISOString(),
    })

    await this.savePipelineEvent(agentId, {
      id: generateId('dream_event'),
      sessionId,
      stage: 'extract_symbols',
      status: 'completed',
      summary: `Extracted ${candidateDream.symbols.length} symbols and ${candidateDream.latentTensions.length} latent tensions.`,
      payload: {
        dreamId: candidateDream.id,
        symbols: candidateDream.symbols,
        latentTensions: candidateDream.latentTensions,
      },
      createdAt: new Date().toISOString(),
    })

    let evaluation = candidateDream.validation?.pass
      ? await this.evaluateDream(agent, session, candidateDream, providerInfo)
      : this.createBlockedEvaluation(candidateDream.validation || createValidationReport({ validatorVersion: DREAM_VALIDATOR_VERSION }))
    candidateDream = await this.updateDream({
      ...candidateDream,
      evaluation,
      displayMetrics: deriveDisplayMetrics(evaluation),
      impressionPreview: evaluation.pass ? this.deriveImpressionPreview(candidateDream) : undefined,
      qualityScore: evaluation.overallScore,
      ...syncTrackedQualityState({
        ...candidateDream,
      }, { evaluationPass: evaluation.pass }),
      updatedAt: new Date().toISOString(),
    })

    await this.savePipelineEvent(agentId, {
      id: generateId('dream_event'),
      sessionId,
      stage: 'evaluate_quality',
      status: 'completed',
      summary: evaluation.evaluatorSummary,
      payload: {
        dreamId: candidateDream.id,
        evaluation,
        validation: candidateDream.validation,
      },
      createdAt: new Date().toISOString(),
    })

    const draftGate = applyFinalQualityGate({
      validation: candidateDream.validation,
      evaluation,
      thresholds: DREAM_GATE_THRESHOLDS,
    })

    if (!draftGate.pass) {
      const repairResponse = await generateText({
        providerInfo,
        temperature: 0.7,
        maxTokens: 2600,
        messages: [
          { role: 'system', content: this.buildGeneratorSystemPrompt(agent, session) },
          { role: 'user', content: this.buildRepairPrompt(session, candidateDream, evaluation) },
        ],
      })

      const repairBuild = this.parseDream({
        agent,
        session,
        llmResponse: repairResponse.content,
        providerInfo,
        version: 2,
        artifactRole: 'repair',
        sourceDreamId: candidateDream.id,
      })
      candidateDream = await this.saveDream(repairBuild.dream)

      evaluation = candidateDream.validation?.pass
        ? await this.evaluateDream(agent, session, candidateDream, providerInfo)
        : this.createBlockedEvaluation(candidateDream.validation || createValidationReport({ validatorVersion: DREAM_VALIDATOR_VERSION }))
      candidateDream = await this.updateDream({
        ...candidateDream,
        evaluation,
        displayMetrics: deriveDisplayMetrics(evaluation),
        impressionPreview: evaluation.pass ? this.deriveImpressionPreview(candidateDream) : undefined,
        qualityScore: evaluation.overallScore,
        repairCount: 1,
        ...syncTrackedQualityState({
          ...candidateDream,
          repairCount: 1,
        }, { evaluationPass: evaluation.pass }),
        updatedAt: new Date().toISOString(),
      })

      await this.savePipelineEvent(agentId, {
        id: generateId('dream_event'),
        sessionId,
        stage: 'repair_dream',
        status: applyFinalQualityGate({
          validation: candidateDream.validation,
          evaluation,
          thresholds: DREAM_GATE_THRESHOLDS,
        }).pass ? 'completed' : 'failed',
        summary: evaluation.pass ? 'Repair pass improved symbolism and grounding enough for review.' : 'Repair pass still failed the dream quality gate.',
        payload: {
          dreamId: candidateDream.id,
          evaluation,
          validation: candidateDream.validation,
        },
        createdAt: new Date().toISOString(),
      })
    }

    const { dream: finalDream, gate } = await this.finalizeDreamCandidate({
      session,
      sourceDream: candidateDream,
      evaluation,
    })
    const impressionPreview = finalDream.impressionPreview

    await this.savePipelineEvent(agentId, {
      id: generateId('dream_event'),
      sessionId,
      stage: 'derive_impression',
      status: gate.pass ? 'completed' : 'skipped',
      summary: gate.pass ? 'Derived a bounded behavioral residue preview for review.' : 'Skipped impression preview because the draft failed the quality gate.',
      payload: {
        dreamId: finalDream.id,
        impressionPreview,
      },
      createdAt: new Date().toISOString(),
    })

    session = {
      ...session,
      status: gate.pass ? 'ready' : 'failed',
      latestStage: gate.pass ? 'ready' : 'failed',
      qualityStatus: gate.qualityStatus,
      latestEvaluation: evaluation,
      finalDreamId: finalDream.id,
      repairCount: candidateDream.repairCount ?? 0,
      rawModelOutput: candidateDream.rawModelOutput,
      validation: candidateDream.validation,
      failureReason: gate.pass ? undefined : [evaluation.evaluatorSummary, ...gate.blockerReasons].filter(Boolean).join(' | '),
      updatedAt: new Date().toISOString(),
    }
    await this.saveSession(session)
    await this.savePipelineEvent(agentId, {
      id: generateId('dream_event'),
      sessionId,
      stage: gate.pass ? 'ready' : 'failed',
      status: gate.pass ? 'completed' : 'failed',
      summary: gate.pass ? 'Dream draft is ready for review and explicit save.' : 'Dream draft failed the quality gate and requires regeneration.',
      payload: {
        dreamId: finalDream.id,
        evaluation,
        validation: finalDream.validation,
        blockerReasons: gate.blockerReasons,
      },
      createdAt: new Date().toISOString(),
    })

    if (!gate.pass) {
      await this.recordQualityFailureObservation({
        agentId,
        feature: 'dream',
        description: `Dream session ${sessionId} was blocked by the final quality gate.`,
        blockerReasons: gate.blockerReasons,
        evidenceRefs: [sessionId, candidateDream.id, finalDream.id],
        rawExcerpt: candidateDream.rawModelOutput?.text,
        outputExcerpt: finalDream.summary,
        qualityScore: evaluation.overallScore,
      })
    }

    return this.getSessionDetail(agentId, sessionId)
  }

  async saveSessionDream(agentId: string, sessionId: string): Promise<DreamSessionDetail> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) throw new Error('Agent not found')

    const session = await this.getSessionRecord(agentId, sessionId)
    if (!session) throw new Error('Dream session not found')
    if (session.status !== 'ready' || !session.finalDreamId || !session.latestEvaluation?.pass) {
      throw new DreamSaveBlockedError({
        code: 'dream_save_blocked',
        sessionId,
        dreamId: session.finalDreamId,
        blockerReasons: ['dream_session_not_ready'],
        qualityStatus: session.qualityStatus,
        validation: session.validation,
        evaluation: session.latestEvaluation,
      })
    }

    const draft = await this.getDreamRecord(session.finalDreamId)
    if (!draft) throw new Error('Final dream not found')
    if (!draft.validation?.pass || !draft.evaluation?.pass || !draft.sourceRefs?.length) {
      throw new DreamSaveBlockedError({
        code: 'dream_save_blocked',
        sessionId,
        dreamId: draft.id,
        blockerReasons: [
          ...(!draft.validation?.pass ? ['validation_failed'] : []),
          ...(!draft.evaluation?.pass ? ['evaluation_failed'] : []),
          ...(!draft.sourceRefs?.length ? ['missing_source_ref'] : []),
        ],
        qualityStatus: session.qualityStatus,
        normalizationStatus: draft.normalizationStatus,
        validation: draft.validation,
        evaluation: draft.evaluation,
      })
    }

    const now = new Date().toISOString()
    const savedDream = await this.updateDream({
      ...draft,
      status: 'saved',
      qualityStatus: 'passed',
      impression: this.deriveSavedImpression(draft, now),
      savedAt: now,
      updatedAt: now,
    })

    const savedSession: DreamSession = {
      ...session,
      status: 'saved',
      qualityStatus: 'passed',
      latestStage: 'saved',
      finalDreamId: savedDream.id,
      savedAt: now,
      updatedAt: now,
    }
    await this.saveSession(savedSession)
    await this.savePipelineEvent(agentId, {
      id: generateId('dream_event'),
      sessionId,
      stage: 'saved',
      status: 'completed',
      summary: `Saved "${savedDream.title}" and activated its dream impression.`,
      payload: {
        dreamId: savedDream.id,
        impression: savedDream.impression,
      },
      createdAt: now,
    })

    await agentProgressService.recordDream(agentId)

    const refreshedAgent = await AgentService.getAgentById(agentId)
    if (refreshedAgent) {
      const emotionalUpdate = emotionalService.processInternalAction({
        agent: refreshedAgent,
        source: 'dream_generation',
        content: this.buildEmotionResiduePrompt(savedDream),
        linkedActionId: savedDream.id,
      })

      await AgentService.updateAgent(agentId, {
        emotionalState: emotionalUpdate.emotionalState,
        emotionalHistory: emotionalUpdate.emotionalHistory,
        activeDreamImpression: savedDream.impression,
      })
    }

    return this.getSessionDetail(agentId, sessionId)
  }

  async listSavedDreams(agentId: string, options?: { type?: DreamType; limit?: number }) {
    if (readsFromPostgres(getPersistenceMode())) {
      return DreamWorkspaceRepository.listDreamsForAgent(agentId, {
        savedOnly: true,
        type: options?.type,
        limit: options?.limit,
      })
    }

    const dreams = await listSavedDreamsFromFirestore(agentId, options?.limit || 20)
    return options?.type ? dreams.filter((dream) => dream.type === options.type) : dreams
  }

  private async getSessionRecord(agentId: string, sessionId: string) {
    const detail = await this.getSessionDetail(agentId, sessionId)
    return detail.session?.agentId === agentId ? detail.session : null
  }

  private async getDreamRecord(dreamId: string) {
    if (readsFromPostgres(getPersistenceMode())) {
      return DreamWorkspaceRepository.getDream(dreamId)
    }
    return null
  }

  private async saveSession(record: DreamSession) {
    if (writesToPostgres(getPersistenceMode())) {
      await (await DreamWorkspaceRepository.getSession(record.id)
        ? DreamWorkspaceRepository.updateSession(record.id, record)
        : DreamWorkspaceRepository.createSession(record))
    }

    if (writesToFirestore(getPersistenceMode())) {
      await writeDreamSessionToFirestore(record)
    }
  }

  private async saveDream(record: Dream) {
    let saved = record
    if (writesToPostgres(getPersistenceMode())) {
      saved = await DreamWorkspaceRepository.saveDream(record)
    }
    if (writesToFirestore(getPersistenceMode())) {
      await writeDreamToFirestore(saved)
    }
    return saved
  }

  private async updateDream(record: Dream) {
    let saved = record
    if (writesToPostgres(getPersistenceMode())) {
      saved = await DreamWorkspaceRepository.updateDream(record.id, record)
    }
    if (writesToFirestore(getPersistenceMode())) {
      await writeDreamToFirestore(saved)
    }
    return saved
  }

  private async savePipelineEvent(agentId: string, record: DreamPipelineEvent) {
    let saved = record
    if (writesToPostgres(getPersistenceMode())) {
      saved = await DreamWorkspaceRepository.savePipelineEvent(record)
    }
    if (writesToFirestore(getPersistenceMode())) {
      await writeDreamPipelineEventToFirestore(agentId, saved)
    }
    return saved
  }

  private async buildContextSignals(agent: AgentRecord, input: DreamComposeInput): Promise<DreamContextSignal[]> {
    const [messages, memories, savedJournals, savedDreams, learningPromptContext] = await Promise.all([
      this.listRecentMessages(agent.id),
      this.listRecentMemories(agent.id),
      journalService.listSavedEntries(agent.id, { limit: 3 }),
      this.listSavedDreams(agent.id, { limit: 3 }),
      LearningService.getPromptContext(agent.id),
    ])

    const signals: DreamContextSignal[] = [
      {
        id: 'persona',
        sourceType: 'persona',
        label: 'Persona',
        snippet: summarizeText(agent.persona, 220),
        reason: 'Dream language should still feel like this specific agent.',
        weight: 1,
      },
    ]

    for (const [index, goal] of agent.goals.slice(0, 3).entries()) {
      signals.push({
        id: `goal-${index}`,
        sourceType: 'goal',
        label: `Goal ${index + 1}`,
        snippet: goal,
        reason: 'Goals become latent pressure, conflict, or desire inside dreams.',
        weight: 0.78 - index * 0.06,
      })
    }

    if (agent.linguisticProfile) {
      signals.push({
        id: 'linguistic-profile',
        sourceType: 'linguistic_profile',
        label: 'Linguistic profile',
        snippet: describeLinguisticProfile(agent),
        reason: 'Keeps dream narration voiced by the agent rather than generic surreal filler.',
        weight: 0.91,
      })
    }

    if (agent.psychologicalProfile) {
      signals.push({
        id: 'psychological-profile',
        sourceType: 'psychological_profile',
        label: 'Psychological profile',
        snippet: summarizeText(`${agent.psychologicalProfile.summary} Growth areas: ${(agent.psychologicalProfile.growthAreas || []).join(', ')}`, 220),
        reason: 'Provides durable conflict patterns and attachment residue.',
        weight: 0.9,
      })
    }

    if (agent.emotionalState?.dominantEmotion) {
      signals.push({
        id: 'dominant-emotion',
        sourceType: 'emotion',
        label: 'Dominant emotion',
        snippet: `${agent.emotionalState.dominantEmotion} currently leads the emotional field.`,
        reason: 'Dream tone should process the live emotional weather without copying it literally.',
        weight: 0.93,
      })
    }

    if (agent.emotionalProfile) {
      signals.push({
        id: 'temperament',
        sourceType: 'emotional_temperament',
        label: 'Emotional temperament',
        snippet: `Sensitivity ${(agent.emotionalProfile.sensitivity * 100).toFixed(0)}%, resilience ${(agent.emotionalProfile.resilience * 100).toFixed(0)}%, optimism ${(agent.emotionalProfile.optimism * 100).toFixed(0)}%.`,
        reason: 'Temperament shapes how the dream absorbs stress or possibility.',
        weight: 0.76,
      })
    }

    if (learningPromptContext) {
      signals.push({
        id: 'learning-adaptations',
        sourceType: 'learning',
        label: 'Active learning adaptations',
        snippet: summarizeText(learningPromptContext, 220),
        reason: 'Recent learning adaptations should bias symbolism, specificity, and repair choices.',
        weight: 0.77,
      } as DreamContextSignal)
    }

    for (const [index, event] of (agent.emotionalHistory || []).slice(-4).reverse().entries()) {
      signals.push({
        id: `emotion-event-${event.id}`,
        sourceType: 'emotional_history',
        label: `Recent emotional residue ${index + 1}`,
        snippet: summarizeText(`${event.emotion}: ${event.explanation}`, 180),
        reason: 'Recent emotional events should surface as symbolic residue.',
        weight: 0.8 - index * 0.05,
        linkedEntityId: event.id,
      })
    }

    for (const [index, message] of messages.entries()) {
      signals.push({
        id: `message-${message.id}`,
        sourceType: 'message',
        label: `Recent message ${index + 1}`,
        snippet: summarizeText(message.content, 170),
        reason: 'Recent language makes the dream feel current and agent-specific.',
        weight: 0.79 - index * 0.05,
        linkedEntityId: message.id,
      })
    }

    for (const [index, memory] of memories.entries()) {
      signals.push({
        id: `memory-${memory.id}`,
        sourceType: 'memory',
        label: `Memory ${index + 1}`,
        snippet: summarizeText(memory.summary || memory.content, 170),
        reason: 'High-salience memory is a strong latent driver for dream imagery.',
        weight: 0.89 - index * 0.05,
        linkedEntityId: memory.id,
      })
    }

    for (const [index, journal] of savedJournals.entries()) {
      signals.push({
        id: `journal-${journal.id}`,
        sourceType: 'journal',
        label: `Journal reflection ${index + 1}`,
        snippet: summarizeText(journal.summary || journal.content, 170),
        reason: 'Saved reflections provide grounded introspection the dream can distort productively.',
        weight: 0.74 - index * 0.05,
        linkedEntityId: journal.id,
      })
    }

    for (const [index, dream] of savedDreams.entries()) {
      signals.push({
        id: `dream-${dream.id}`,
        sourceType: 'dream',
        label: `Prior dream ${index + 1}`,
        snippet: `${dream.symbols.map((symbol) => symbol.symbol).slice(0, 4).join(', ')} | ${dream.themes.slice(0, 3).join(', ')}`,
        reason: 'Saved V2 dreams help detect recurring motifs instead of random novelty.',
        weight: 0.68 - index * 0.05,
        linkedEntityId: dream.id,
      })
    }

    const activeImpression = this.getActiveImpression(agent)
    if (activeImpression) {
      signals.push({
        id: `active-impression-${activeImpression.sourceDreamId}`,
        sourceType: 'dream_impression',
        label: 'Active dream residue',
        snippet: `${activeImpression.behaviorTilt}: ${activeImpression.summary}`,
        reason: 'An active saved dream can lightly tint the current subconscious frame.',
        weight: 0.66,
        linkedEntityId: activeImpression.sourceDreamId,
      })
    }

    for (const focus of input.focus || []) {
      signals.push({
        id: `focus-${focus}`,
        sourceType: focus === 'relationship' ? 'relationship' : focus === 'memory' ? 'memory' : focus === 'emotion' ? 'emotion' : 'goal',
        label: `Focus: ${focus.replaceAll('_', ' ')}`,
        snippet: `The user explicitly wants the dream to lean toward ${FOCUS_LABELS[focus]}.`,
        reason: 'Explicit focus should gently rank matching material higher.',
        weight: 0.72,
      } as DreamContextSignal)
    }

    if (input.userNote) {
      signals.push({
        id: 'user-note',
        sourceType: 'persona',
        label: 'User note',
        snippet: summarizeText(input.userNote, 180),
        reason: 'The user note provides a direct review target for the dream workspace.',
        weight: 0.73,
      })
    }

    return signals
      .sort((left, right) => right.weight - left.weight)
      .slice(0, 12)
  }

  private buildGeneratorSystemPrompt(agent: AgentRecord, session: DreamSession) {
    return [
      `You are building a dream draft for ${agent.name}.`,
      `Persona anchor: ${agent.persona}`,
      'The result must read as a psychologically grounded dream artifact, not generic fantasy or assistant prose.',
      `Dream mode: ${session.type}.`,
      `Mode guidance: ${TYPE_HINTS[session.type]}`,
      this.buildPromptContext(agent),
      'Return JSON only.',
    ].filter(Boolean).join('\n')
  }

  private buildDraftPrompt(session: DreamSession, contextPacket: NonNullable<DreamSession['contextPacket']>) {
    const signalLines = contextPacket.selectedSignals
      .map((signal, index) => `${index + 1}. [${signal.sourceType}] ${signal.label}: ${signal.snippet} (${signal.reason})`)
      .join('\n')

    return [
      `Compose input: ${JSON.stringify(session.normalizedInput)}`,
      `Context summary: ${contextPacket.summary}`,
      `Selected signals:\n${signalLines}`,
      'Write a dream artifact with clear scene progression, psychologically useful symbolism, and an interpretation that remains specific to the agent.',
      'Avoid generic fantasy filler, schema leakage, random lore, and meaningless symbols.',
      'Return JSON with keys:',
      '{',
      '  "title": string,',
      '  "summary": string,',
      '  "scenes": [{ "heading": string, "summary": string, "body": string, "symbols": string[], "emotions": string[] }],',
      '  "symbols": [{ "symbol": string, "meaning": string, "evidence": string, "emotionalAssociation": string }],',
      '  "themes": string[],',
      '  "latentTensions": [{ "tension": string, "whyItMatters": string }],',
      '  "interpretation": { "summary": string, "insights": string[], "cautions": string[], "openLoops": string[] },',
      '  "emotionalProcessing": string',
      '}',
    ].join('\n')
  }

  private buildRepairPrompt(session: DreamSession, dream: Dream, evaluation: DreamQualityEvaluation) {
    return [
      `Repair the ${session.type} dream below so it passes the quality gate.`,
      `Current title: ${dream.title}`,
      `Validation blockers: ${(dream.validation?.hardFailureFlags || []).join(' | ') || 'none'}`,
      `Weaknesses: ${evaluation.weaknesses.join(' | ') || 'Insufficient specificity and interpretation.'}`,
      `Repair instructions: ${evaluation.repairInstructions.join(' | ') || 'Strengthen symbolism, grounding, and interpretation.'}`,
      `Current summary: ${dream.summary}`,
      `Current scenes: ${dream.scenes.map((scene) => `${scene.heading}: ${scene.summary}`).join(' | ')}`,
      'Return the same JSON schema as before, rewritten rather than patched.',
    ].join('\n')
  }

  private parseDream({
    agent,
    session,
    llmResponse,
    providerInfo,
    version,
    artifactRole,
    sourceDreamId,
  }: {
    agent: AgentRecord
    session: DreamSession
    llmResponse: string
    providerInfo: LLMProviderInfo
    version: number
    artifactRole: OutputArtifactRole
    sourceDreamId?: string
  }): DreamBuildResult {
    const parsedResult = safeParseJsonWithExtraction<DreamDraftPayload>(llmResponse)
    const parsed = parsedResult.parsed
    const now = new Date().toISOString()
    const scenes = (parsed?.scenes || [])
      .map((scene, index): DreamScene => ({
        id: `scene-${index + 1}`,
        heading: normalizeWhitespace(scene.heading?.trim() || `Scene ${index + 1}`),
        summary: normalizeWhitespace(scene.summary?.trim() || summarizeText(scene.body || '', 120) || `Dream sequence ${index + 1}.`),
        body: normalizeWhitespace(scene.body?.trim() || scene.summary?.trim() || 'The dream remained difficult to stabilize into words.'),
        symbols: normalizeStringList(scene.symbols, 5),
        emotions: normalizeStringList(scene.emotions, 4) as EmotionType[],
      }))
      .filter((scene) => scene.body)

    const normalizedScenes = scenes.length ? scenes : [{
      id: 'scene-1',
      heading: 'Dream fragment',
      summary: summarizeText(normalizeWhitespace(llmResponse), 120) || 'An unstable symbolic fragment.',
      body: normalizeWhitespace(llmResponse) || 'The dream did not stabilize.',
      symbols: [],
      emotions: [],
    }]

    const title = normalizeWhitespace(parsed?.title?.trim() || `${agent.name} dream`)
    const summary = normalizeWhitespace(parsed?.summary?.trim() || summarizeText(normalizedScenes.map((scene) => scene.summary).join(' '), 180))
    const themes = normalizeStringList(parsed?.themes, 6)
    const interpretation = {
      summary: normalizeWhitespace(parsed?.interpretation?.summary?.trim() || 'The dream points to unresolved emotional patterning and current behavioral pressure.'),
      insights: normalizeStringList(parsed?.interpretation?.insights, 4),
      cautions: normalizeStringList(parsed?.interpretation?.cautions, 3),
      openLoops: normalizeStringList(parsed?.interpretation?.openLoops, 3),
    }

    const dream: Dream = {
      id: generateId('dream'),
      agentId: agent.id,
      sessionId: session.id,
      type: session.type,
      status: artifactRole === 'final' ? 'draft' : artifactRole === 'repair' ? 'repaired' : 'draft',
      artifactRole,
      sourceDreamId,
      version,
      promptVersion: DREAM_PROMPT_VERSION,
      repairCount: artifactRole === 'repair' ? 1 : 0,
      title,
      summary,
      render: buildMessageRenderData(buildDreamMarkdown({
        title,
        summary,
        scenes: normalizedScenes,
        interpretationSummary: interpretation.summary,
        themes,
      })),
      scenes: normalizedScenes,
      symbols: (parsed?.symbols || []).map((symbol) => ({
        symbol: normalizeWhitespace(symbol.symbol?.trim() || 'symbol'),
        meaning: normalizeWhitespace(symbol.meaning?.trim() || 'Carries unresolved emotional meaning.'),
        evidence: normalizeWhitespace(symbol.evidence?.trim() || 'Appeared as a salient recurring image.'),
        emotionalAssociation: (symbol.emotionalAssociation as EmotionType | undefined),
      })).slice(0, 8),
      themes,
      latentTensions: (parsed?.latentTensions || []).map((entry) => ({
        tension: normalizeWhitespace(entry.tension?.trim() || 'Unresolved inner conflict'),
        whyItMatters: normalizeWhitespace(entry.whyItMatters?.trim() || 'It continues to shape near-term behavior.'),
      })).slice(0, 5),
      interpretation,
      emotionalProcessing: normalizeWhitespace(parsed?.emotionalProcessing?.trim() || 'The dream is metabolizing recent tension into symbolic form.'),
      contextReferences: (session.contextPacket?.selectedSignals || []).slice(0, 8).map((signal) => ({
        sourceType: signal.sourceType,
        label: signal.label,
        linkedEntityId: signal.linkedEntityId,
      })),
      displayMetrics: deriveDisplayMetrics(undefined),
      rawModelOutput: createRawModelOutput(llmResponse, {
        parserNotes: parsedResult.parserNotes,
        capturedAt: now,
        responseFormat: 'json_object',
        promptVersion: DREAM_PROMPT_VERSION,
      }),
      normalization: {
        status: parsed ? (artifactRole === 'repair' ? 'repaired' : 'normalized') : 'failed',
        parser: parsedResult.parser,
        violations: parsed ? parsedResult.parserNotes : ['dream_parse_failed', ...parsedResult.parserNotes],
        repairedFromId: sourceDreamId,
      },
      sourceRefs: (session.contextPacket?.selectedSignals || []).slice(0, 8).map((signal) => ({
        id: signal.id,
        sourceType: signal.sourceType,
        label: signal.label,
        reason: signal.reason,
        linkedEntityId: signal.linkedEntityId,
      })),
      provider: providerInfo.provider,
      model: providerInfo.model,
      createdAt: now,
      updatedAt: now,
    }

    const validation = this.validateDreamArtifact(dream)
    const tracked = syncTrackedQualityState({
      ...dream,
      validation,
    }, { evaluationPass: undefined })

    return {
      dream: {
        ...dream,
        ...tracked,
        normalizationStatus: tracked.normalization?.status,
      },
      validation,
    }
  }

  private validateDreamArtifact(dream: Dream): OutputQualityValidationReport {
    const hardFailureFlags = [
      ...validateRequiredTextFields({
        title: dream.title,
        summary: dream.summary,
        emotionalProcessing: dream.emotionalProcessing,
      }),
      ...validateSharedArtifactText({
        title: dream.title,
        summary: dream.summary,
        interpretation: dream.interpretation.summary,
        emotionalProcessing: dream.emotionalProcessing,
      }),
      ...(dream.scenes.length === 0 ? ['missing_scenes'] : []),
      ...(dream.symbols.length === 0 && dream.themes.length === 0 ? ['missing_symbols_and_themes'] : []),
      ...(!dream.interpretation.summary.trim() ? ['missing_interpretation'] : []),
      ...validateSourceRefs(dream.sourceRefs || []),
    ]

    return createValidationReport({
      hardFailureFlags,
      softWarnings: [
        ...(dream.latentTensions.length === 0 ? ['missing_latent_tensions'] : []),
        ...(dream.interpretation.insights.length === 0 ? ['missing_interpretive_insights'] : []),
      ],
      validatorVersion: DREAM_VALIDATOR_VERSION,
    })
  }

  private async evaluateDream(
    agent: AgentRecord,
    session: DreamSession,
    dream: Dream,
    providerInfo: LLMProviderInfo
  ): Promise<DreamQualityEvaluation> {
    const heuristic = this.heuristicEvaluation(agent, session, dream)

    try {
      const response = await generateText({
        providerInfo,
        temperature: 0.2,
        maxTokens: 1800,
        messages: [
          {
            role: 'system',
            content: [
              'Evaluate the dream artifact against a production rubric.',
              'Return JSON only with keys: pass, overallScore, dimensions, hardFailureFlags, strengths, weaknesses, repairInstructions, evaluatorSummary.',
              'Dimensions must include imageryVividness, symbolicCoherence, psychologicalGrounding, agentSpecificity, narrativeClarity, interpretiveUsefulness.',
              'Hard-failure flags must only use: generic_fantasy_filler, schema_leakage, weak_symbolism, disconnected_agent_context, incoherent_scene_progression, unusable_interpretation.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: JSON.stringify({
              agent: {
                name: agent.name,
                persona: summarizeText(agent.persona, 180),
                goals: agent.goals.slice(0, 3),
              },
              session: session.normalizedInput,
              contextSummary: session.contextPacket?.summary,
              dream: {
                title: dream.title,
                summary: dream.summary,
                scenes: dream.scenes,
                symbols: dream.symbols,
                themes: dream.themes,
                latentTensions: dream.latentTensions,
                interpretation: dream.interpretation,
                emotionalProcessing: dream.emotionalProcessing,
              },
            }),
          },
        ],
      })

      const parsed = safeParseJsonWithExtraction<{
        pass?: boolean
        overallScore?: number
        dimensions?: Record<DreamQualityDimension, { score?: number; rationale?: string }>
        hardFailureFlags?: string[]
        strengths?: string[]
        weaknesses?: string[]
        repairInstructions?: string[]
        evaluatorSummary?: string
      }>(response.content).parsed

      if (!parsed?.dimensions) {
        return heuristic
      }

      const dimensions = Object.fromEntries(
        QUALITY_DIMENSIONS.map((dimension) => [
          dimension,
          {
            score: clamp(Math.round(parsed.dimensions?.[dimension]?.score || heuristic.dimensions[dimension].score)),
            rationale: parsed.dimensions?.[dimension]?.rationale?.trim() || heuristic.dimensions[dimension].rationale,
          },
        ])
      ) as DreamQualityEvaluation['dimensions']

      const hardFailureFlags = normalizeStringList(parsed.hardFailureFlags, 6)
        .filter((flag): flag is DreamHardFailureFlag => [
          'generic_fantasy_filler',
          'schema_leakage',
          'weak_symbolism',
          'disconnected_agent_context',
          'incoherent_scene_progression',
          'unusable_interpretation',
        ].includes(flag))

      const overallScore = clamp(Math.round(parsed.overallScore || Object.values(dimensions).reduce((sum, entry) => sum + entry.score, 0) / QUALITY_DIMENSIONS.length))
      const pass = Boolean(parsed.pass)
        && overallScore >= 80
        && Object.values(dimensions).every((entry) => entry.score >= 70)
        && hardFailureFlags.length === 0

      return {
        pass,
        overallScore,
        dimensions,
        hardFailureFlags,
        strengths: normalizeStringList(parsed.strengths, 6),
        weaknesses: normalizeStringList(parsed.weaknesses, 6),
        repairInstructions: normalizeStringList(parsed.repairInstructions, 6),
        evaluatorSummary: parsed.evaluatorSummary?.trim() || heuristic.evaluatorSummary,
      }
    } catch (error) {
      console.error('Dream evaluation failed, using heuristic evaluator:', error)
      return heuristic
    }
  }

  private heuristicEvaluation(agent: AgentRecord, _session: DreamSession, dream: Dream): DreamQualityEvaluation {
    const sceneProgression = dream.scenes.length >= 3
    const symbolDepth = dream.symbols.length >= 3
    const interpretationDepth = dream.interpretation.insights.length >= 2 && Boolean(dream.interpretation.summary)
    const agentSpecificityScore = this.scoreAgentSpecificity(agent, dream)
    const schemaLeakage = /\bjson|schema|prompt|evaluation|repair instructions\b/i.test(buildDreamMarkdown({
      title: dream.title,
      summary: dream.summary,
      scenes: dream.scenes,
      interpretationSummary: dream.interpretation.summary,
      themes: dream.themes,
    }))
    const genericFantasy = /\bdragon|kingdom|wizard|castle|prophecy of the chosen\b/i.test(dream.summary + ' ' + dream.scenes.map((scene) => scene.body).join(' '))
      && !dream.themes.some((theme) => /memory|identity|trust|fear|goal|relationship/i.test(theme))

    const dimensions: DreamQualityEvaluation['dimensions'] = {
      imageryVividness: {
        score: clamp(60 + dream.scenes.length * 8 + dream.symbols.length * 2),
        rationale: sceneProgression ? 'Scenes contain enough concrete visual material to feel dreamlike without collapsing into vagueness.' : 'The dream needs more distinct scene imagery.',
      },
      symbolicCoherence: {
        score: clamp(58 + dream.symbols.length * 9 + dream.latentTensions.length * 4),
        rationale: symbolDepth ? 'Symbols connect to the interpretation instead of floating as decorative imagery.' : 'Symbolism remains too thin or unintegrated.',
      },
      psychologicalGrounding: {
        score: clamp(60 + dream.latentTensions.length * 10 + (dream.emotionalProcessing.length > 100 ? 8 : 0)),
        rationale: dream.latentTensions.length ? 'The dream names believable internal tension rather than arbitrary lore.' : 'The dream lacks grounded internal tension.',
      },
      agentSpecificity: {
        score: clamp(agentSpecificityScore),
        rationale: agentSpecificityScore >= 78 ? 'The dream reflects the agent’s goals, language, or psychological profile.' : 'The dream could belong to almost anyone and needs more agent-specific residue.',
      },
      narrativeClarity: {
        score: clamp(58 + dream.scenes.length * 8 + (sceneProgression ? 10 : 0)),
        rationale: sceneProgression ? 'Scene progression is readable enough to inspect and review.' : 'Scene order or transitions remain too unstable.',
      },
      interpretiveUsefulness: {
        score: clamp(55 + dream.interpretation.insights.length * 10 + (interpretationDepth ? 10 : 0)),
        rationale: interpretationDepth ? 'Interpretation provides usable insight and bounded behavioral meaning.' : 'Interpretation is too vague to support review or save.',
      },
    }

    const hardFailureFlags: DreamHardFailureFlag[] = []
    if (genericFantasy) hardFailureFlags.push('generic_fantasy_filler')
    if (schemaLeakage) hardFailureFlags.push('schema_leakage')
    if (!symbolDepth) hardFailureFlags.push('weak_symbolism')
    if (agentSpecificityScore < 65) hardFailureFlags.push('disconnected_agent_context')
    if (!sceneProgression) hardFailureFlags.push('incoherent_scene_progression')
    if (!interpretationDepth) hardFailureFlags.push('unusable_interpretation')

    const overallScore = clamp(Math.round(Object.values(dimensions).reduce((sum, entry) => sum + entry.score, 0) / QUALITY_DIMENSIONS.length))
    const pass = overallScore >= 80
      && Object.values(dimensions).every((entry) => entry.score >= 70)
      && hardFailureFlags.length === 0

    const weaknesses = [
      ...(!sceneProgression ? ['Scene progression remains too loose.'] : []),
      ...(agentSpecificityScore < 78 ? ['Agent-specific grounding needs stronger continuity with stored context.'] : []),
      ...(!interpretationDepth ? ['Interpretation needs clearer insight and behavioral usefulness.'] : []),
      ...(!symbolDepth ? ['Symbolism needs stronger recurrence and clearer meaning.'] : []),
    ]

    return {
      pass,
      overallScore,
      dimensions,
      hardFailureFlags,
      strengths: [
        ...(dream.scenes.length >= 3 ? ['The dream uses multiple inspectable scenes.'] : []),
        ...(dream.symbols.length >= 3 ? ['Symbol inventory is concrete enough to inspect.'] : []),
        ...(dream.latentTensions.length >= 2 ? ['Latent tensions feel psychologically grounded.'] : []),
      ],
      weaknesses,
      repairInstructions: [
        ...(!sceneProgression ? ['Clarify scene order and transitions so the dream reads as one progression.'] : []),
        ...(!symbolDepth ? ['Strengthen recurring symbols and explain why they matter emotionally.'] : []),
        ...(agentSpecificityScore < 78 ? ['Tie imagery more explicitly to agent goals, recent language, or unresolved memories.'] : []),
        ...(!interpretationDepth ? ['Rewrite the interpretation so it offers concrete insight, caution, and open loops.'] : []),
      ],
      evaluatorSummary: pass
        ? 'Dream passes the quality gate with grounded symbolism, readable progression, and useful interpretation.'
        : 'Dream does not yet meet the quality gate for symbolism, grounding, or interpretive usefulness.',
    }
  }

  private createBlockedEvaluation(validation: OutputQualityValidationReport): DreamQualityEvaluation {
    const summary = validation.hardFailureFlags.length > 0
      ? `Validation blocked evaluation: ${validation.hardFailureFlags.join(', ')}.`
      : 'Validation blocked evaluation.'

    return {
      pass: false,
      overallScore: 0,
      dimensions: Object.fromEntries(
        QUALITY_DIMENSIONS.map((dimension) => [
          dimension,
          {
            score: 0,
            rationale: summary,
          },
        ])
      ) as DreamQualityEvaluation['dimensions'],
      hardFailureFlags: validation.hardFailureFlags as DreamHardFailureFlag[],
      strengths: [],
      weaknesses: [summary],
      repairInstructions: validation.hardFailureFlags.map((flag) => `Fix ${flag.replace(/_/g, ' ')} before saving the dream.`),
      evaluatorSummary: summary,
    }
  }

  private async finalizeDreamCandidate(params: {
    session: DreamSession
    sourceDream: Dream
    evaluation: DreamQualityEvaluation
  }): Promise<{ dream: Dream; gate: ReturnType<typeof applyFinalQualityGate> }> {
    const gate = applyFinalQualityGate({
      validation: params.sourceDream.validation,
      evaluation: params.evaluation,
      thresholds: DREAM_GATE_THRESHOLDS,
    })

    const tracked = syncTrackedQualityState({
      ...params.sourceDream,
      qualityStatus: gate.qualityStatus,
      validation: params.sourceDream.validation,
      normalization: params.sourceDream.normalization,
      repairCount: params.sourceDream.repairCount ?? (params.sourceDream.artifactRole === 'repair' ? 1 : 0),
      promptVersion: params.sourceDream.promptVersion || DREAM_PROMPT_VERSION,
      rawModelOutput: params.sourceDream.rawModelOutput,
      sourceRefs: params.sourceDream.sourceRefs,
    }, { evaluationPass: gate.pass })

    const finalArtifact: Dream = {
      ...params.sourceDream,
      ...tracked,
      id: generateId('dream'),
      artifactRole: 'final',
      sourceDreamId: params.sourceDream.id,
      status: 'draft',
      version: Math.max(params.sourceDream.version + 1, params.sourceDream.artifactRole === 'repair' ? 3 : 2),
      evaluation: params.evaluation,
      displayMetrics: deriveDisplayMetrics(params.evaluation),
      impressionPreview: gate.pass ? this.deriveImpressionPreview(params.sourceDream) : undefined,
      normalizationStatus: tracked.normalization?.status,
      qualityScore: params.evaluation.overallScore,
      repairCount: params.sourceDream.repairCount ?? (params.sourceDream.artifactRole === 'repair' ? 1 : 0),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    return {
      dream: await this.saveDream(finalArtifact),
      gate,
    }
  }

  private async recordQualityFailureObservation(params: {
    agentId: string
    feature: 'dream' | 'scenario'
    description: string
    blockerReasons: string[]
    evidenceRefs?: string[]
    rawExcerpt?: string
    outputExcerpt?: string
    qualityScore?: number
  }) {
    try {
      await LearningService.recordQualityObservation({
        agentId: params.agentId,
        feature: params.feature,
        description: params.description,
        blockerReasons: params.blockerReasons,
        evidenceRefs: params.evidenceRefs,
        rawExcerpt: params.rawExcerpt,
        outputExcerpt: params.outputExcerpt,
        qualityScore: params.qualityScore,
        candidateAdaptations: [
          'Tighten output structure before considering the artifact ready.',
          'Prefer clearer evidence-linked symbolism and direct interpretation.',
        ],
      })
    } catch (error) {
      console.error('Failed to record dream/scenario quality observation:', error)
    }
  }

  private scoreAgentSpecificity(agent: AgentRecord, dream: Dream) {
    const haystack = [
      agent.persona,
      ...agent.goals,
      dream.summary,
      ...dream.scenes.map((scene) => `${scene.heading} ${scene.body}`),
      dream.interpretation.summary,
    ].join(' ').toLowerCase()

    const agentTokens = [...new Set([
      ...agent.goals.flatMap((goal) => goal.toLowerCase().split(/\W+/)),
      ...agent.persona.toLowerCase().split(/\W+/),
    ])].filter((token) => token.length >= 5)

    const hits = agentTokens.filter((token) => haystack.includes(token)).length
    return 58 + Math.min(28, hits * 4) + (dream.contextReferences.length >= 4 ? 6 : 0)
  }

  private deriveImpressionPreview(dream: Dream): Omit<DreamImpression, 'sourceDreamId'> {
    const createdAt = dream.updatedAt || dream.createdAt
    const expiresAt = new Date(new Date(createdAt).getTime() + (24 * 60 * 60 * 1000)).toISOString()
    return {
      summary: summarizeText(dream.interpretation.summary, 150),
      guidance: dream.interpretation.cautions[0]
        || dream.interpretation.openLoops[0]
        || dream.interpretation.insights[0]
        || 'Let the dream bias emphasis lightly without overriding established persona.',
      behaviorTilt: TILT_BY_TYPE[dream.type],
      dominantThemes: dream.themes.slice(0, 4),
      createdAt,
      expiresAt,
    }
  }

  private deriveSavedImpression(dream: Dream, createdAt: string): DreamImpression {
    const preview = this.deriveImpressionPreview(dream)
    return {
      sourceDreamId: dream.id,
      ...preview,
      createdAt,
      expiresAt: new Date(new Date(createdAt).getTime() + (24 * 60 * 60 * 1000)).toISOString(),
    }
  }

  private buildEmotionResiduePrompt(dream: Dream) {
    return [
      dream.type,
      dream.summary,
      dream.emotionalProcessing,
      dream.interpretation.summary,
      ...dream.themes,
      ...dream.latentTensions.map((entry) => entry.tension),
    ].join(' | ')
  }

  private async listRecentMessages(agentId: string): Promise<MessageRecord[]> {
    return (await MessageService.getMessagesByAgentId(agentId))
      .filter((message) => message.type === 'agent' || message.type === 'user')
      .slice(-8)
      .reverse()
  }

  private async listRecentMemories(agentId: string): Promise<MemoryRecord[]> {
    return MemoryService.getRecentMemories(agentId, 8)
  }
}

export const dreamService = new DreamService()
