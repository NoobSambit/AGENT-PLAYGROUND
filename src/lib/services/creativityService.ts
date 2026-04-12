import { desc, eq } from 'drizzle-orm'
import { buildMessageRenderData } from '@/lib/chat/rendering'
import { getDb } from '@/lib/db/client'
import { generateId } from '@/lib/db/utils'
import { messages, memories } from '@/lib/db/schema'
import type { LLMProviderInfo } from '@/lib/llmConfig'
import { generateText } from '@/lib/llm/provider'
import { CreativeStudioRepository } from '@/lib/repositories/creativeStudioRepository'
import { FeatureContentRepository } from '@/lib/repositories/featureContentRepository'
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
import { AgentService } from './agentService'
import { agentStatsService } from './agentStatsService'
import { emotionalService } from './emotionalService'

const DAILY_LIMIT = 20
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000

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

function normalizeTextList(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.map((entry) => String(entry).trim()).filter(Boolean)
  }

  if (typeof value === 'string') {
    return splitList(value)
  }

  return []
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

function safeParseJson<T>(value: string): T | null {
  const match = value.match(/\{[\s\S]*\}/)
  if (!match) {
    return null
  }

  try {
    return JSON.parse(match[0]) as T
  } catch {
    return null
  }
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

class CreativityService {
  async getBootstrap(agentId: string): Promise<BootstrapPayload> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const defaults = this.createSuggestedBrief(agent)
    const contextPacket = await this.buildContextPacket(agent, defaults)
    const recentSessions = await CreativeStudioRepository.listSessions(agentId, { limit: 6 })
    const library = await CreativeStudioRepository.listPublishedLibrary(agentId)

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
    const generatingSession: CreativeSession = {
      ...existing,
      status: 'generating',
      contextPacket,
      provider: providerInfo.provider,
      model: providerInfo.model,
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

    const draftArtifact = this.parseArtifactFromResponse({
      agentId,
      sessionId,
      format: existing.normalizedBrief.format,
      tone: existing.normalizedBrief.tone,
      audience: existing.normalizedBrief.audience,
      llmResponse: draftResponse.content,
      providerInfo,
      version: 1,
      status: 'draft',
    })
    const savedDraft = await CreativeStudioRepository.saveArtifact(draftArtifact)
    await CreativeStudioRepository.savePipelineEvent({
      id: generateId('creative_event'),
      sessionId,
      stage: 'draft_generated',
      status: 'completed',
      summary: `Generated draft artifact "${savedDraft.title}".`,
      payload: {
        artifactId: savedDraft.id,
        wordCount: savedDraft.wordCount,
      },
      createdAt: new Date().toISOString(),
    })

    const draftEvaluation = await this.evaluateArtifact(agent, existing.normalizedBrief, contextPacket, savedDraft, providerInfo)
    await CreativeStudioRepository.savePipelineEvent({
      id: generateId('creative_event'),
      sessionId,
      stage: 'draft_evaluated',
      status: 'completed',
      summary: draftEvaluation.evaluatorSummary,
      payload: {
        evaluation: draftEvaluation,
      },
      createdAt: new Date().toISOString(),
    })

    let finalArtifact: CreativeArtifact = {
      ...savedDraft,
      evaluation: draftEvaluation,
      updatedAt: new Date().toISOString(),
    }
    finalArtifact = await CreativeStudioRepository.updateArtifact(finalArtifact.id, finalArtifact)

    if (!draftEvaluation.pass) {
      const revisionResponse = await generateText({
        providerInfo,
        temperature: 0.85,
        maxTokens: 2200,
        messages: [
          { role: 'system', content: this.buildGeneratorSystemPrompt(agent, existing.normalizedBrief, contextPacket) },
          {
            role: 'user',
            content: this.buildRevisionPrompt(existing.normalizedBrief, contextPacket, finalArtifact, draftEvaluation),
          },
        ],
      })

      const revisedArtifact = this.parseArtifactFromResponse({
        agentId,
        sessionId,
        format: existing.normalizedBrief.format,
        tone: existing.normalizedBrief.tone,
        audience: existing.normalizedBrief.audience,
        llmResponse: revisionResponse.content,
        providerInfo,
        version: 2,
        status: 'revised',
      })

      const savedRevision = await CreativeStudioRepository.saveArtifact(revisedArtifact)
      const revisionEvaluation = await this.evaluateArtifact(
        agent,
        existing.normalizedBrief,
        contextPacket,
        savedRevision,
        providerInfo
      )

      finalArtifact = await CreativeStudioRepository.updateArtifact(savedRevision.id, {
        ...savedRevision,
        evaluation: revisionEvaluation,
        updatedAt: new Date().toISOString(),
      })

      await CreativeStudioRepository.savePipelineEvent({
        id: generateId('creative_event'),
        sessionId,
        stage: 'revision_generated',
        status: 'completed',
        summary: revisionEvaluation.evaluatorSummary,
        payload: {
          artifactId: finalArtifact.id,
          evaluation: revisionEvaluation,
        },
        createdAt: new Date().toISOString(),
      })
    }

    const readySession: CreativeSession = {
      ...generatingSession,
      status: 'ready',
      latestEvaluation: finalArtifact.evaluation,
      draftArtifactId: savedDraft.id,
      finalArtifactId: finalArtifact.id,
      updatedAt: new Date().toISOString(),
    }
    const updatedSession = await CreativeStudioRepository.updateSession(sessionId, readySession)

    const artifacts = await CreativeStudioRepository.listArtifactsForSession(sessionId)
    const pipelineEvents = await CreativeStudioRepository.listPipelineEvents(sessionId)

    return {
      session: updatedSession,
      artifacts,
      pipelineEvents,
    }
  }

  async publishSession(agentId: string, sessionId: string): Promise<CreativeSessionDetail> {
    const session = await CreativeStudioRepository.getSession(sessionId)
    if (!session || session.agentId !== agentId) {
      throw new Error('Creative session not found')
    }

    if (!session.finalArtifactId) {
      throw new Error('Generate a creative artifact before publishing.')
    }

    const finalArtifact = await CreativeStudioRepository.getArtifact(session.finalArtifactId)
    if (!finalArtifact) {
      throw new Error('Final artifact not found.')
    }

    let artifact = finalArtifact
    if (artifact.status !== 'published') {
      artifact = await CreativeStudioRepository.updateArtifact(artifact.id, {
        ...artifact,
        status: 'published',
        publishedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      })

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
    }

    const publishedSession = await CreativeStudioRepository.updateSession(sessionId, {
      ...session,
      status: 'published',
      publishedArtifactId: artifact.id,
      publishedAt: artifact.publishedAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      latestEvaluation: artifact.evaluation,
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
      session: publishedSession,
      artifacts: await CreativeStudioRepository.listArtifactsForSession(sessionId),
      pipelineEvents: await CreativeStudioRepository.listPipelineEvents(sessionId),
    }
  }

  async getSessionDetail(agentId: string, sessionId: string): Promise<CreativeSessionDetail> {
    const session = await CreativeStudioRepository.getSession(sessionId)
    if (!session || session.agentId !== agentId) {
      throw new Error('Creative session not found')
    }

    return {
      session,
      artifacts: await CreativeStudioRepository.listArtifactsForSession(sessionId),
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
        snippet: summarizeText(dream.narrative, 180),
        reason: 'Dream fragments can enrich imagery and symbolism.',
        weight: 0.62 - index * 0.04,
        linkedEntityId: dream.id,
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
      `Voice directives: ${contextPacket.voiceDirectives.join(' | ')}`,
      `Psychological directives: ${contextPacket.psychologicalDirectives.join(' | ') || 'Maintain internal coherence and curiosity.'}`,
      'Return valid JSON with keys: title, summary, content, themes, inspiration.',
      'The content field must contain markdown-safe prose only. No HTML. No code fences.',
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
      'Return valid JSON with keys: title, summary, content, themes, inspiration.',
    ].join('\n\n')
  }

  private parseArtifactFromResponse(params: {
    agentId: string
    sessionId: string
    format: CreativeFormat
    tone: CreativeTone
    audience: string
    llmResponse: string
    providerInfo: LLMProviderInfo
    version: number
    status: CreativeArtifact['status']
  }): CreativeArtifact {
    const parsed = safeParseJson<{
      title?: string
      summary?: string
      content?: string
      themes?: string[]
      inspiration?: string
    }>(params.llmResponse) || parseLabeledCreativeResponse(params.llmResponse)

    const content = stripDecorativeBreaks((parsed?.content || params.llmResponse).trim())
    const now = new Date().toISOString()

    const resolvedTitle = parsed?.title?.trim() || deriveFallbackTitle(content, params.format)

    return {
      id: generateId('creative_artifact'),
      agentId: params.agentId,
      sessionId: params.sessionId,
      format: params.format,
      status: params.status,
      version: params.version,
      title: resolvedTitle,
      summary: parsed?.summary?.trim() || summarizeText(content, 150),
      content,
      render: buildMessageRenderData(content),
      themes: normalizeTextList(parsed?.themes),
      inspiration: normalizeSingleText(parsed?.inspiration) || 'Derived from the selected creative context.',
      audience: params.audience,
      tone: params.tone,
      wordCount: countWords(content),
      provider: params.providerInfo.provider,
      model: params.providerInfo.model,
      createdAt: now,
      updatedAt: now,
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
    const hasUntitledTitle = /^untitled\b/i.test(artifact.title)
    const leakedLabeledSections = /\*\*title:\*\*|\*\*summary:\*\*|\*\*content:\*\*/i.test(artifact.content)

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

      const parsed = safeParseJson<CreativeRubricEvaluation & {
        dimensions?: Partial<Record<CreativeRubricDimension, { score?: number; rationale?: string }>>
      }>(response.content)

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

        const strengths = normalizeTextList(parsed.strengths).slice(0, 4)
        const weaknesses = normalizeTextList(parsed.weaknesses).slice(0, 4)
        const repairInstructions = normalizeTextList(parsed.repairInstructions).slice(0, 4)

        return {
          pass: Boolean(parsed.pass) && overallScore >= 80 && !hasUntitledTitle && !leakedLabeledSections,
          overallScore,
          dimensions: mergedDimensions,
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

    return {
      pass: overallScore >= 80 && weaknesses.length <= 2 && !hasUntitledTitle && !leakedLabeledSections,
      overallScore,
      dimensions,
      strengths: strengths.slice(0, 4),
      weaknesses: weaknesses.slice(0, 4),
      repairInstructions: repairInstructions.slice(0, 4),
      evaluatorSummary: overallScore >= 72
        ? `The piece is publishable with an overall score of ${overallScore}.`
        : `The piece missed the quality gate with an overall score of ${overallScore}.`,
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
