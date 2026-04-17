import { buildMessageRenderData } from '@/lib/chat/rendering'
import { generateId } from '@/lib/db/utils'
import { getPersistenceMode, readsFromPostgres, writesToFirestore, writesToPostgres } from '@/lib/db/persistence'
import { generateText } from '@/lib/llm/provider'
import type { LLMProviderInfo } from '@/lib/llmConfig'
import {
  getJournalSessionDetailFromFirestore,
  listJournalSessionsFromFirestore,
  listSavedJournalEntriesFromFirestore,
  writeJournalEntryToFirestore,
  writeJournalPipelineEventToFirestore,
  writeJournalSessionToFirestore,
} from '@/lib/journal/firestoreStore'
import { JournalWorkspaceRepository } from '@/lib/repositories/journalWorkspaceRepository'
import { RelationshipRepository } from '@/lib/repositories/relationshipRepository'
import { FeatureContentRepository } from '@/lib/repositories/featureContentRepository'
import {
  createPendingTrackedFields,
  syncTrackedQualityState,
} from '@/lib/services/outputQuality/contracts'
import { applyFinalQualityGate } from '@/lib/services/outputQuality/evaluators'
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
import {
  OUTPUT_QUALITY_FLAGS,
  detectTextLeakage,
} from '@/lib/services/outputQuality/flags'
import type {
  AgentRecord,
  JournalBootstrapPayload,
  JournalComposeInput,
  JournalContextSignal,
  JournalEntry,
  JournalEntryStatus,
  JournalEntryType,
  JournalFocus,
  JournalPipelineEvent,
  JournalQualityDimension,
  JournalQualityEvaluation,
  JournalSession,
  JournalSessionDetail,
  JournalVoicePacket,
  MemoryRecord,
} from '@/types/database'
import type {
  OutputArtifactRole,
  OutputQualitySourceRef,
  OutputQualityValidationReport,
} from '@/types/outputQuality'
import { AgentService } from './agentService'
import { agentProgressService } from './agentProgressService'
import { CommunicationFingerprintService } from './communicationFingerprintService'
import { emotionalService } from './emotionalService'
import { LearningService } from './learningService'
import { MemoryService } from './memoryService'
import { MessageService } from './messageService'

const DAILY_LIMIT = 12
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000
const STALE_GENERATING_SESSION_MS = 3 * 60 * 1000
const JOURNAL_PROMPT_VERSION = 'phase1-journal-contract-v1'
const JOURNAL_VALIDATOR_VERSION = 'phase1-journal-validator-v1'

const JOURNAL_TYPES: JournalEntryType[] = [
  'daily_reflection',
  'emotional_processing',
  'goal_alignment',
  'relationship_checkpoint',
  'memory_revisit',
  'idea_capture',
]

const QUALITY_DIMENSIONS: JournalQualityDimension[] = [
  'voiceConsistency',
  'emotionalAuthenticity',
  'reflectionDepth',
  'specificityGrounding',
  'continuity',
  'readability',
]

const TYPE_LABELS: Record<JournalEntryType, string> = {
  daily_reflection: 'Daily Reflection',
  emotional_processing: 'Emotional Processing',
  goal_alignment: 'Goal Alignment',
  relationship_checkpoint: 'Relationship Checkpoint',
  memory_revisit: 'Memory Revisit',
  idea_capture: 'Idea Capture',
}

const TYPE_GUIDANCE: Record<JournalEntryType, string> = {
  daily_reflection: 'Reflect on what recently shifted, what it meant, and what still feels unresolved.',
  emotional_processing: 'Name the emotional tension directly, trace its causes, and stay honest instead of overly polished.',
  goal_alignment: 'Compare current behavior against declared goals, tensions, and next actions.',
  relationship_checkpoint: 'Reflect on one or two relationships with specificity, emotional nuance, and continuity.',
  memory_revisit: 'Revisit an important memory, why it still matters, and how it changes present interpretation.',
  idea_capture: 'Capture an emerging idea, why it matters now, what excites you, and what remains uncertain.',
}

const JOURNAL_MEMORY_TYPE_PRIORITY: Partial<Record<MemoryRecord['type'], number>> = {
  tension_snapshot: 5,
  preference: 4,
  identity: 4,
  operating_constraint: 4,
  relationship: 3,
  project: 3,
  fact: 2,
  artifact_summary: 2,
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, value))
}

function countWords(value: string) {
  return value.trim().split(/\s+/).filter(Boolean).length
}

function summarizeText(value: string, maxLength = 180) {
  const trimmed = value.replace(/\s+/g, ' ').trim()
  if (trimmed.length <= maxLength) return trimmed
  return `${trimmed.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`
}

function normalizeNote(value?: string) {
  return value?.trim() || undefined
}

function normalizeFocus(value: unknown): JournalFocus[] {
  if (!Array.isArray(value)) return []
  return value
    .filter((entry): entry is JournalFocus => ['emotion', 'memory', 'relationship', 'goal', 'continuity'].includes(String(entry)))
}

function deriveDominantLabel(agent: AgentRecord) {
  const dominant = emotionalService.getDominantEmotion(agent.emotionalState, agent.emotionalProfile)
  if (!dominant) return 'steady'
  return dominant.replaceAll('_', ' ')
}

function isLocalBaselineProvider(providerInfo: LLMProviderInfo) {
  return providerInfo.provider === 'ollama' && /qwen2\.5:7b|llama3\.2/i.test(providerInfo.model)
}

function tokenizeJournalQuery(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4)
}

function buildJournalMemoryQuery(input: JournalComposeInput, goalHints: string[] = []) {
  return [
    input.userNote,
    TYPE_LABELS[input.type],
    TYPE_GUIDANCE[input.type],
    input.focus.join(' '),
    goalHints.join(' '),
  ].filter(Boolean).join(' ')
}

function memoryTextForJournal(memory: MemoryRecord) {
  return `${memory.type} ${memory.summary} ${memory.content} ${memory.context} ${memory.canonicalValue || ''}`.toLowerCase()
}

function scoreJournalMemory(memory: MemoryRecord, queryWords: string[]): number {
  const haystack = memoryTextForJournal(memory)
  const overlap = queryWords.filter((word) => haystack.includes(word)).length
  return (memory.importance || 0)
    + (JOURNAL_MEMORY_TYPE_PRIORITY[memory.type] || 1)
    + overlap * 2.5
    + (memory.canonicalValue ? 1.25 : 0)
}

function selectJournalMemories(
  recentMemories: MemoryRecord[],
  relevantMemories: MemoryRecord[],
  input: JournalComposeInput,
  goalHints: string[] = []
): MemoryRecord[] {
  const queryWords = tokenizeJournalQuery(buildJournalMemoryQuery(input, goalHints))
  const merged = [...recentMemories, ...relevantMemories]
  const deduped = merged.filter((memory, index, list) => list.findIndex((candidate) => candidate.id === memory.id) === index)

  return deduped
    .sort((left, right) => scoreJournalMemory(right, queryWords) - scoreJournalMemory(left, queryWords))
    .slice(0, 4)
}

function buildPriorityJournalEvidenceLines(signals: JournalContextSignal[]): string[] {
  const prioritized = signals.filter((signal) =>
    signal.sourceType === 'message'
    || signal.sourceType === 'memory'
    || signal.sourceType === 'goal'
  )

  return prioritized
    .map((signal) => summarizeText(signal.snippet, 180))
    .filter(Boolean)
    .slice(0, 4)
}

function fallbackTitle(type: JournalEntryType, content: string) {
  const firstLine = content.split('\n').map((line) => line.trim()).find(Boolean)
  if (firstLine && firstLine.length <= 80) {
    return firstLine.replace(/^#+\s*/, '')
  }
  return TYPE_LABELS[type]
}

interface JournalDraftPayload {
  title?: string
  summary?: string
  content?: string
  insights?: string[]
  openQuestions?: string[]
  nextActions?: string[]
  gratitudes?: string[]
  themes?: string[]
  referencedEntities?: string[]
}

interface JournalEntryBuildResult {
  entry: JournalEntry
  validation: OutputQualityValidationReport
}

interface JournalSaveBlockedPayload {
  code: 'journal_save_blocked'
  sessionId: string
  entryId?: string
  blockerReasons: string[]
  qualityStatus: JournalSession['qualityStatus']
  normalizationStatus?: JournalEntry['normalizationStatus']
  validation?: OutputQualityValidationReport
  evaluation?: JournalQualityEvaluation
}

export class JournalSaveBlockedError extends Error {
  readonly payload: JournalSaveBlockedPayload

  constructor(payload: JournalSaveBlockedPayload, message = 'Journal entry is blocked from save until quality preconditions pass.') {
    super(message)
    this.name = 'JournalSaveBlockedError'
    this.payload = payload
  }
}

class JournalService {
  private isBetterJournalCandidate(
    candidateEntry: JournalEntry,
    candidateEvaluation: JournalQualityEvaluation,
    currentBestEntry: JournalEntry,
    currentBestEvaluation: JournalQualityEvaluation
  ) {
    const candidateValidationPass = candidateEntry.validation?.pass ? 1 : 0
    const currentValidationPass = currentBestEntry.validation?.pass ? 1 : 0

    if (candidateValidationPass !== currentValidationPass) {
      return candidateValidationPass > currentValidationPass
    }

    if (candidateEvaluation.pass !== currentBestEvaluation.pass) {
      return candidateEvaluation.pass
    }

    if (candidateEvaluation.overallScore !== currentBestEvaluation.overallScore) {
      return candidateEvaluation.overallScore > currentBestEvaluation.overallScore
    }

    return (candidateEntry.validation?.hardFailureFlags.length || 0) < (currentBestEntry.validation?.hardFailureFlags.length || 0)
  }

  getAllowedTypes(): JournalEntryType[] {
    return JOURNAL_TYPES
  }

  suggestType(agent: AgentRecord): JournalEntryType {
    const dominant = emotionalService.getDominantEmotion(agent.emotionalState, agent.emotionalProfile)
    if (!dominant) return 'daily_reflection'
    if (dominant === 'sadness' || dominant === 'fear' || dominant === 'anger') return 'emotional_processing'
    if (dominant === 'trust') return 'relationship_checkpoint'
    if (dominant === 'anticipation') return 'goal_alignment'
    if (dominant === 'surprise') return 'idea_capture'
    return 'memory_revisit'
  }

  normalizeComposeInput(agent: AgentRecord, input: Partial<JournalComposeInput>): JournalComposeInput {
    return {
      type: JOURNAL_TYPES.includes(input.type as JournalEntryType) ? input.type as JournalEntryType : this.suggestType(agent),
      userNote: normalizeNote(input.userNote),
      focus: normalizeFocus(input.focus).slice(0, 4),
    }
  }

  async getBootstrap(agentId: string): Promise<JournalBootstrapPayload> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const recentSessions = readsFromPostgres(getPersistenceMode())
      ? await JournalWorkspaceRepository.listSessions(agentId, { limit: 8 })
      : await listJournalSessionsFromFirestore(agentId, 8)
    const normalizedSessions = await Promise.all(
      recentSessions
        .map((session) => this.hydrateSessionQuality(session))
        .map((session) => this.recoverStaleGeneratingSession(agentId, session))
    )

    const recentSavedEntries = readsFromPostgres(getPersistenceMode())
      ? await JournalWorkspaceRepository.listEntriesForAgent(agentId, { savedOnly: true, limit: 8 })
      : await listSavedJournalEntriesFromFirestore(agentId, 8)
    const hydratedSavedEntries = recentSavedEntries.map((entry) => this.hydrateEntryQuality(entry))

    const readyToSaveCount = normalizedSessions.filter((session) => session.status === 'ready').length
    const failedSessions = normalizedSessions.filter((session) => session.status === 'failed').length

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        journalCount: agent.journalCount || 0,
      },
      allowedTypes: this.getAllowedTypes(),
      suggestedType: this.suggestType(agent),
      defaults: {
        userNote: '',
        focus: [],
      },
      recentSessions: normalizedSessions,
      recentSavedEntries: hydratedSavedEntries,
      metrics: {
        totalSavedEntries: hydratedSavedEntries.length,
        totalSessions: recentSessions.length,
        readyToSaveCount,
        failedSessions,
      },
      archiveFilters: {
        types: this.getAllowedTypes(),
      },
    }
  }

  async createSession(agentId: string, input: Partial<JournalComposeInput>): Promise<JournalSession> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const usageCount = readsFromPostgres(getPersistenceMode())
      ? await JournalWorkspaceRepository.countSessionsSince(agentId, new Date(Date.now() - RATE_WINDOW_MS).toISOString())
      : (await listJournalSessionsFromFirestore(agentId, DAILY_LIMIT)).filter(
        (session) => new Date(session.createdAt).getTime() >= Date.now() - RATE_WINDOW_MS
      ).length

    if (usageCount >= DAILY_LIMIT) {
      throw new Error('Daily journal generation limit reached. Try again tomorrow.')
    }

    const normalizedInput = this.normalizeComposeInput(agent, input)
    const now = new Date().toISOString()
    const session: JournalSession = {
      id: generateId('journal_session'),
      agentId,
      status: 'draft',
      ...createPendingTrackedFields({
        promptVersion: JOURNAL_PROMPT_VERSION,
      }),
      latestStage: 'prepare_context',
      type: normalizedInput.type,
      normalizedInput,
      createdAt: now,
      updatedAt: now,
    }

    await this.saveSession(session)
    await this.savePipelineEvent(agentId, {
      id: generateId('journal_event'),
      sessionId: session.id,
      stage: 'prepare_context',
      status: 'completed',
      summary: 'Created a draft journal session and normalized the compose input.',
      payload: {
        normalizedInput,
      },
      createdAt: now,
    })

    return session
  }

  async getSessionDetail(agentId: string, sessionId: string): Promise<JournalSessionDetail> {
    if (readsFromPostgres(getPersistenceMode())) {
      const rawSession = await JournalWorkspaceRepository.getSession(sessionId)
      if (!rawSession || rawSession.agentId !== agentId) {
        return { session: null, entries: [], pipelineEvents: [] }
      }
      const session = await this.recoverStaleGeneratingSession(agentId, this.hydrateSessionQuality(rawSession))
      return {
        session,
        entries: (await JournalWorkspaceRepository.listEntriesForSession(sessionId)).map((entry) => this.hydrateEntryQuality(entry)),
        pipelineEvents: await JournalWorkspaceRepository.listPipelineEvents(sessionId),
      }
    }

    const detail = await getJournalSessionDetailFromFirestore(agentId, sessionId)
    return {
      ...detail,
      session: detail.session ? await this.recoverStaleGeneratingSession(agentId, this.hydrateSessionQuality(detail.session)) : null,
      entries: detail.entries.map((entry) => this.hydrateEntryQuality(entry)),
    }
  }

  async generateSession(agentId: string, sessionId: string, providerInfo: LLMProviderInfo | null): Promise<JournalSessionDetail> {
    if (!providerInfo) {
      throw new Error('LLM provider not configured')
    }

    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const existing = await this.getSessionRecord(agentId, sessionId)
    if (!existing) {
      throw new Error('Journal session not found')
    }

    const contextSignals = await this.buildContextSignals(agent, existing.normalizedInput)
    const contextPacket = {
      selectedSignals: contextSignals,
      dominantEmotion: emotionalService.getDominantEmotion(agent.emotionalState, agent.emotionalProfile),
      summary: `${contextSignals.length} signals selected for ${TYPE_LABELS[existing.type].toLowerCase()}.`,
    }

    let session: JournalSession = {
      ...existing,
      status: 'generating',
      latestStage: 'condition_voice',
      contextPacket,
      provider: providerInfo.provider,
      model: providerInfo.model,
      failureReason: undefined,
      rawModelOutput: undefined,
      validation: undefined,
      sourceRefs: normalizeSourceRefs(contextSignals.map((signal) => ({
        id: signal.id,
        sourceType: signal.sourceType,
        label: signal.label,
        reason: signal.reason,
        linkedEntityId: signal.linkedEntityId,
      }))),
      qualityStatus: 'pending',
      promptVersion: JOURNAL_PROMPT_VERSION,
      updatedAt: new Date().toISOString(),
    }
    await this.saveSession(session)
    await this.savePipelineEvent(agentId, {
      id: generateId('journal_event'),
      sessionId,
      stage: 'condition_voice',
      status: 'active',
      summary: 'Conditioning journal voice from persona, emotion, profile, and recent language evidence.',
      payload: {
        signalCount: contextSignals.length,
      },
      createdAt: new Date().toISOString(),
    })

    const voicePacket = await this.buildVoicePacket(agent, contextSignals)
    session = {
      ...session,
      voicePacket,
      updatedAt: new Date().toISOString(),
    }
    await this.saveSession(session)
    await this.savePipelineEvent(agentId, {
      id: generateId('journal_event'),
      sessionId,
      stage: 'condition_voice',
      status: 'completed',
      summary: voicePacket.communicationFingerprintSummary
        ? 'Built a voice packet with recent communication evidence.'
        : 'Built a voice packet from baseline profile evidence.',
      payload: {
        voicePacket,
      },
      createdAt: new Date().toISOString(),
    })

    const draftResponse = await generateText({
      providerInfo,
      temperature: isLocalBaselineProvider(providerInfo) ? 0.45 : 0.85,
      maxTokens: isLocalBaselineProvider(providerInfo) ? 1500 : 2200,
      messages: [
        { role: 'system', content: this.buildGeneratorSystemPrompt(agent, session, voicePacket) },
        { role: 'user', content: this.buildDraftPrompt(session, contextPacket, voicePacket) },
      ],
    })

    const draftResult = this.buildValidatedEntry({
      agent,
      session,
      llmResponse: draftResponse.content,
      version: 1,
      status: 'draft',
      artifactRole: 'draft',
    })
    let finalEntry = await this.saveEntry(draftResult.entry)
    await this.savePipelineEvent(agentId, {
      id: generateId('journal_event'),
      sessionId,
      stage: 'draft_entry',
      status: 'completed',
      summary: draftResult.validation.pass
        ? `Generated normalized draft "${finalEntry.title}".`
        : 'Generated a draft, but normalization or validation blocked it from review.',
      payload: {
        entryId: finalEntry.id,
        wordCount: countWords(finalEntry.content),
        normalization: finalEntry.normalization,
        validation: finalEntry.validation,
      },
      createdAt: new Date().toISOString(),
    })

    let evaluation = draftResult.validation.pass
      ? await this.evaluateEntry(agent, session, finalEntry, providerInfo)
      : this.createBlockedEvaluation(finalEntry.validation)
    finalEntry = await this.updateEntry({
      ...finalEntry,
      evaluation,
      qualityScore: evaluation.overallScore,
      ...syncTrackedQualityState({
        ...finalEntry,
        evaluation,
      }, {
        evaluationPass: evaluation.pass,
      }),
      updatedAt: new Date().toISOString(),
    })
    await this.savePipelineEvent(agentId, {
      id: generateId('journal_event'),
      sessionId,
      stage: 'evaluate_quality',
      status: 'completed',
      summary: evaluation.evaluatorSummary,
      payload: {
        evaluation,
        entryId: finalEntry.id,
      },
      createdAt: new Date().toISOString(),
    })
    let selectedEntry = finalEntry
    let selectedEvaluation = evaluation

    if (!draftResult.validation.pass || !evaluation.pass) {
      const repairResponse = await generateText({
        providerInfo,
        temperature: isLocalBaselineProvider(providerInfo) ? 0.3 : 0.7,
        maxTokens: isLocalBaselineProvider(providerInfo) ? 1500 : 2200,
        messages: [
          { role: 'system', content: this.buildGeneratorSystemPrompt(agent, session, voicePacket) },
          { role: 'user', content: this.buildRepairPrompt(session, voicePacket, finalEntry, evaluation) },
        ],
      })

      const repairedResult = this.buildValidatedEntry({
        agent,
        session,
        llmResponse: repairResponse.content,
        version: 2,
        status: 'repaired',
        artifactRole: 'repair',
        sourceEntryId: finalEntry.id,
      })
      finalEntry = await this.saveEntry(repairedResult.entry)
      evaluation = repairedResult.validation.pass
        ? await this.evaluateEntry(agent, session, finalEntry, providerInfo)
        : this.createBlockedEvaluation(finalEntry.validation)
      finalEntry = await this.updateEntry({
        ...finalEntry,
        evaluation,
        qualityScore: evaluation.overallScore,
        ...syncTrackedQualityState({
          ...finalEntry,
          evaluation,
          repairCount: 1,
        }, {
          evaluationPass: evaluation.pass,
        }),
        updatedAt: new Date().toISOString(),
      })

      await this.savePipelineEvent(agentId, {
        id: generateId('journal_event'),
        sessionId,
        stage: 'repair_entry',
        status: evaluation.pass ? 'completed' : 'failed',
        summary: repairedResult.validation.pass && evaluation.pass
          ? 'Repair pass improved the draft enough for review.'
          : 'Repair pass still failed normalization, validation, or the journal quality gate.',
        payload: {
          evaluation,
          entryId: finalEntry.id,
          normalization: finalEntry.normalization,
          validation: finalEntry.validation,
        },
        createdAt: new Date().toISOString(),
      })

      if (this.isBetterJournalCandidate(finalEntry, evaluation, selectedEntry, selectedEvaluation)) {
        selectedEntry = finalEntry
        selectedEvaluation = evaluation
      }
    }

    const gate = applyFinalQualityGate({
      validation: selectedEntry.validation,
      evaluation: selectedEvaluation,
      thresholds: {
        overallScoreMinimum: 80,
        dimensionFloor: 70,
      },
    })

    session = {
      ...session,
      status: gate.pass ? 'ready' : 'failed',
      latestStage: gate.pass ? 'ready' : 'failed',
      latestEvaluation: selectedEvaluation,
      finalEntryId: selectedEntry.id,
      rawModelOutput: selectedEntry.rawModelOutput,
      validation: selectedEntry.validation,
      qualityStatus: gate.qualityStatus,
      repairCount: selectedEntry.version > 1 ? 1 : 0,
      promptVersion: JOURNAL_PROMPT_VERSION,
      failureReason: gate.pass ? undefined : [selectedEvaluation.evaluatorSummary, ...gate.blockerReasons].filter(Boolean).join(' | '),
      updatedAt: new Date().toISOString(),
    }
    await this.saveSession(session)
    await this.savePipelineEvent(agentId, {
      id: generateId('journal_event'),
      sessionId,
      stage: gate.pass ? 'ready' : 'failed',
      status: gate.pass ? 'completed' : 'failed',
      summary: gate.pass
        ? 'Journal draft is ready for review and explicit save.'
        : 'Journal draft failed normalization, validation, or quality gating and requires regeneration.',
      payload: {
        entryId: selectedEntry.id,
        evaluation: selectedEvaluation,
        validation: selectedEntry.validation,
        normalization: selectedEntry.normalization,
        gate,
      },
      createdAt: new Date().toISOString(),
    })

    if (!gate.pass) {
      await LearningService.recordQualityObservation({
        agentId,
        feature: 'journal',
        description: `Journal session ${sessionId} was blocked by validation or evaluation.`,
        blockerReasons: gate.blockerReasons,
        evidenceRefs: [sessionId, selectedEntry.id],
        rawExcerpt: selectedEntry.rawModelOutput?.text,
        outputExcerpt: selectedEntry.summary,
        qualityScore: selectedEvaluation.overallScore,
        category: 'communication_style',
        candidateAdaptations: [
          'Keep journal outputs structurally valid and grounded before surfacing them as ready.',
        ],
      })
    }

    return this.getSessionDetail(agentId, sessionId)
  }

  async saveSessionEntry(agentId: string, sessionId: string): Promise<JournalSessionDetail> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const session = await this.getSessionRecord(agentId, sessionId)
    if (!session) {
      throw new Error('Journal session not found')
    }

    if (!session.finalEntryId) {
      throw new JournalSaveBlockedError({
        code: 'journal_save_blocked',
        sessionId,
        blockerReasons: ['missing_final_entry'],
        qualityStatus: session.qualityStatus,
        validation: session.validation,
        evaluation: session.latestEvaluation,
      })
    }

    const sessionDetail = await this.getSessionDetail(agentId, sessionId)
    const entry = sessionDetail.entries.find((candidate) => candidate.id === session.finalEntryId)
      || await this.getEntryRecord(session.finalEntryId)
    if (!entry) {
      throw new JournalSaveBlockedError({
        code: 'journal_save_blocked',
        sessionId,
        entryId: session.finalEntryId,
        blockerReasons: ['missing_final_entry_record'],
        qualityStatus: session.qualityStatus,
        evaluation: session.latestEvaluation,
        validation: session.validation,
      })
    }

    const gate = applyFinalQualityGate({
      validation: entry.validation,
      evaluation: session.latestEvaluation,
      thresholds: {
        overallScoreMinimum: 80,
        dimensionFloor: 70,
      },
      extraHardFailureFlags: session.status !== 'ready'
        ? [OUTPUT_QUALITY_FLAGS.invalidStageTransition]
        : undefined,
    })

    if (!gate.pass || session.status !== 'ready') {
      throw new JournalSaveBlockedError({
        code: 'journal_save_blocked',
        sessionId,
        entryId: entry.id,
        blockerReasons: session.status !== 'ready'
          ? [...gate.blockerReasons, OUTPUT_QUALITY_FLAGS.invalidStageTransition]
          : gate.blockerReasons,
        qualityStatus: session.qualityStatus,
        normalizationStatus: entry.normalizationStatus,
        validation: entry.validation,
        evaluation: session.latestEvaluation,
      })
    }

    const now = new Date().toISOString()
    const savedEntry = await this.updateEntry({
      ...entry,
      status: 'saved',
      qualityStatus: 'passed',
      savedAt: now,
      updatedAt: now,
    })

    const savedSession: JournalSession = {
      ...session,
      status: 'saved',
      latestStage: 'saved',
      finalEntryId: savedEntry.id,
      savedAt: now,
      updatedAt: now,
    }
    await this.saveSession(savedSession)
    await this.savePipelineEvent(agentId, {
      id: generateId('journal_event'),
      sessionId,
      stage: 'saved',
      status: 'completed',
      summary: `Saved "${savedEntry.title}" to the private journal archive.`,
      payload: {
        entryId: savedEntry.id,
      },
      createdAt: now,
    })

    await agentProgressService.recordJournalEntry(agentId)

    const refreshedAgent = await AgentService.getAgentById(agentId)
    if (refreshedAgent) {
      const emotionalUpdate = emotionalService.processInternalAction({
        agent: refreshedAgent,
        source: 'journal_entry',
        content: savedEntry.content,
        linkedActionId: savedEntry.id,
      })

      await AgentService.updateAgent(agentId, {
        emotionalState: emotionalUpdate.emotionalState,
        emotionalHistory: emotionalUpdate.emotionalHistory,
      })
    }

    return this.getSessionDetail(agentId, sessionId)
  }

  async listSavedEntries(agentId: string, options?: { type?: JournalEntryType; limit?: number }) {
    if (readsFromPostgres(getPersistenceMode())) {
      return JournalWorkspaceRepository.listEntriesForAgent(agentId, {
        savedOnly: true,
        type: options?.type,
        limit: options?.limit,
      })
    }

    const entries = await listSavedJournalEntriesFromFirestore(agentId, options?.limit || 20)
    const hydratedEntries = entries.map((entry) => this.hydrateEntryQuality(entry))
    return options?.type ? hydratedEntries.filter((entry) => entry.type === options.type) : hydratedEntries
  }

  private async getSessionRecord(agentId: string, sessionId: string) {
    const detail = await this.getSessionDetail(agentId, sessionId)
    return detail.session?.agentId === agentId ? detail.session : null
  }

  private async recoverStaleGeneratingSession(agentId: string, session: JournalSession): Promise<JournalSession> {
    if (session.status !== 'generating') return session

    const ageMs = Date.now() - new Date(session.updatedAt || session.createdAt).getTime()
    if (Number.isNaN(ageMs) || ageMs < STALE_GENERATING_SESSION_MS) return session

    const recovered: JournalSession = {
      ...session,
      status: 'failed',
      latestStage: 'failed',
      failureReason: session.failureReason || 'A previous generation stalled before completion. Regenerate to start a fresh draft.',
      updatedAt: new Date().toISOString(),
    }

    await this.saveSession(recovered)
    await this.savePipelineEvent(agentId, {
      id: generateId('journal_event'),
      sessionId: session.id,
      stage: 'failed',
      status: 'failed',
      summary: 'Recovered a stale generating session and marked it failed so the workspace can return to compose.',
      payload: {
        recoveredFromStage: session.latestStage,
        previousUpdatedAt: session.updatedAt,
      },
      createdAt: recovered.updatedAt,
    })

    return recovered
  }

  private async getEntryRecord(entryId: string) {
    if (readsFromPostgres(getPersistenceMode())) {
      const entry = await JournalWorkspaceRepository.getEntry(entryId)
      return entry ? this.hydrateEntryQuality(entry) : null
    }
    return null
  }

  private async saveSession(record: JournalSession) {
    if (writesToPostgres(getPersistenceMode())) {
      await (await JournalWorkspaceRepository.getSession(record.id)
        ? JournalWorkspaceRepository.updateSession(record.id, record)
        : JournalWorkspaceRepository.createSession(record))
    }

    if (writesToFirestore(getPersistenceMode())) {
      await writeJournalSessionToFirestore(record)
    }
  }

  private async saveEntry(record: JournalEntry) {
    let saved = record
    if (writesToPostgres(getPersistenceMode())) {
      saved = await JournalWorkspaceRepository.saveEntry(record)
    }
    if (writesToFirestore(getPersistenceMode())) {
      await writeJournalEntryToFirestore(saved)
    }
    return saved
  }

  private async updateEntry(record: JournalEntry) {
    let saved = record
    if (writesToPostgres(getPersistenceMode())) {
      saved = await JournalWorkspaceRepository.updateEntry(record.id, record)
    }
    if (writesToFirestore(getPersistenceMode())) {
      await writeJournalEntryToFirestore(saved)
    }
    return saved
  }

  private async savePipelineEvent(agentId: string, record: JournalPipelineEvent) {
    let saved = record
    if (writesToPostgres(getPersistenceMode())) {
      saved = await JournalWorkspaceRepository.savePipelineEvent(record)
    }
    if (writesToFirestore(getPersistenceMode())) {
      await writeJournalPipelineEventToFirestore(agentId, saved)
    }
    return saved
  }

  private async buildContextSignals(agent: AgentRecord, input: JournalComposeInput): Promise<JournalContextSignal[]> {
    const memoryQuery = buildJournalMemoryQuery(input, agent.goals.slice(0, 2))
    const [recentMemories, relevantMemories, messages, relationships, savedJournals, savedDreams] = await Promise.all([
      MemoryService.getRecentMemories(agent.id, 10),
      MemoryService.getRelevantMemories(agent.id, memoryQuery, 6),
      MessageService.getMessagesByAgentId(agent.id),
      RelationshipRepository.listForAgent(agent.id),
      this.listSavedEntries(agent.id, { limit: 3 }),
      FeatureContentRepository.listDreams(agent.id, 2),
    ])
    const memories = selectJournalMemories(recentMemories, relevantMemories, input, agent.goals.slice(0, 2))

    const signals: JournalContextSignal[] = [
      {
        id: 'persona',
        sourceType: 'persona',
        label: 'Persona',
        snippet: summarizeText(agent.persona, 220),
        reason: 'Keeps the journal anchored to stable identity.',
        weight: 1,
      },
    ]

    for (const [index, goal] of agent.goals.slice(0, 3).entries()) {
      signals.push({
        id: `goal-${index}`,
        sourceType: 'goal',
        label: `Goal ${index + 1}`,
        snippet: goal,
        reason: 'Declared priorities matter to internal reflection.',
        weight: 0.82 - index * 0.05,
      })
    }

    if (agent.linguisticProfile) {
      signals.push({
        id: 'linguistic-profile',
        sourceType: 'linguistic_profile',
        label: 'Linguistic profile',
        snippet: `Formality ${(agent.linguisticProfile.formality * 100).toFixed(0)}%, verbosity ${(agent.linguisticProfile.verbosity * 100).toFixed(0)}%, humor ${(agent.linguisticProfile.humor * 100).toFixed(0)}%.`,
        reason: 'Keeps tone consistent with the agent baseline.',
        weight: 0.9,
      })
    }

    if (agent.psychologicalProfile) {
      signals.push({
        id: 'psychological-profile',
        sourceType: 'psychological_profile',
        label: 'Psychological profile',
        snippet: summarizeText(agent.psychologicalProfile.summary, 220),
        reason: 'Adds durable internal motivations and conflicts.',
        weight: 0.88,
      })
    }

    const dominantEmotion = emotionalService.getDominantEmotion(agent.emotionalState, agent.emotionalProfile)
    if (dominantEmotion) {
      signals.push({
        id: 'emotion',
        sourceType: 'emotion',
        label: 'Live emotional state',
        snippet: `${dominantEmotion} is currently strongest. ${emotionalService.getEmotionalSummary(agent.emotionalState || emotionalService.createDormantEmotionalState(), agent.emotionalProfile)}`,
        reason: 'The journal should feel current, not generic.',
        weight: 0.95,
      })
    }

    if (agent.emotionalProfile) {
      const influential = emotionalService.getInfluentialEmotion(agent.emotionalState, agent.emotionalProfile)
      signals.push({
        id: 'temperament',
        sourceType: 'emotional_temperament',
        label: 'Emotional temperament',
        snippet: `${influential.emotion} is the strongest baseline temperament influence.`,
        reason: 'Adds continuity between momentary emotion and enduring temperament.',
        weight: 0.78,
      })
    }

    for (const [index, event] of (agent.emotionalHistory || []).slice(-4).entries()) {
      signals.push({
        id: `emotion-history-${event.id}`,
        sourceType: 'emotional_history',
        label: `Recent emotional shift ${index + 1}`,
        snippet: summarizeText(`${event.trigger}. ${event.explanation || event.context}`, 180),
        reason: 'Recent emotional motion grounds the reflection in real continuity.',
        weight: 0.72 - index * 0.04,
        linkedEntityId: event.id,
      })
    }

    for (const [index, memory] of memories
      .filter((memory) => this.memoryMatchesFocus(memory, input.focus))
      .entries()) {
      const baseWeight = memory.type === 'tension_snapshot'
        ? 0.93
        : memory.type === 'preference' || memory.type === 'identity' || memory.type === 'operating_constraint'
          ? 0.89
          : memory.type === 'relationship' || memory.type === 'project'
            ? 0.84
            : 0.8
      signals.push({
        id: `memory-${memory.id}`,
        sourceType: 'memory',
        label: `Memory ${index + 1}`,
        snippet: summarizeText(memory.summary || memory.content, 180),
        reason: 'Concrete memory improves grounding and specificity.',
        weight: baseWeight - index * 0.04,
        linkedEntityId: memory.id,
      })
    }

    for (const [index, message] of messages.filter((message) => message.type === 'user').slice(-3).entries()) {
      signals.push({
        id: `user-message-${message.id}`,
        sourceType: 'message',
        label: `Recent prompt ${index + 1}`,
        snippet: summarizeText(message.content, 180),
        reason: 'Recent user phrasing carries the sharpest concrete wording for internal tension.',
        weight: 0.87 - index * 0.05,
        linkedEntityId: message.id,
      })
    }

    for (const [index, message] of messages.filter((message) => message.type === 'agent').slice(-2).entries()) {
      signals.push({
        id: `message-${message.id}`,
        sourceType: 'message',
        label: `Recent reply ${index + 1}`,
        snippet: summarizeText(message.content, 180),
        reason: 'Recent replies provide live voice evidence.',
        weight: 0.68 - index * 0.05,
        linkedEntityId: message.id,
      })
    }

    for (const [index, relationship] of relationships.slice(0, 3).entries()) {
      signals.push({
        id: `relationship-${relationship.id}`,
        sourceType: 'relationship',
        label: `Relationship ${index + 1}`,
        snippet: summarizeText(`Status ${relationship.status}. Interaction count ${relationship.interactionCount}.`, 180),
        reason: 'Relationship context helps checkpoint and continuity entries.',
        weight: input.type === 'relationship_checkpoint' ? 0.9 - index * 0.05 : 0.55 - index * 0.04,
        linkedEntityId: relationship.id,
      })
    }

    for (const [index, entry] of savedJournals.entries()) {
      signals.push({
        id: `journal-${entry.id}`,
        sourceType: 'journal',
        label: `Saved reflection ${index + 1}`,
        snippet: summarizeText(entry.summary || entry.content, 180),
        reason: 'Saved journal history maintains continuity without inheriting legacy drafts.',
        weight: 0.6 - index * 0.04,
        linkedEntityId: entry.id,
      })
    }

    for (const [index, dream] of savedDreams.entries()) {
      signals.push({
        id: `dream-${dream.id}`,
        sourceType: 'journal',
        label: `Saved dream ${index + 1}`,
        snippet: summarizeText(`${dream.summary} Themes: ${dream.themes.join(', ')}`, 180),
        reason: 'Saved dreams can improve introspective continuity without leaking draft-only material.',
        weight: 0.56 - index * 0.04,
        linkedEntityId: dream.id,
      })
    }

    if (agent.activeDreamImpression && new Date(agent.activeDreamImpression.expiresAt).getTime() > Date.now()) {
      signals.push({
        id: `dream-impression-${agent.activeDreamImpression.sourceDreamId}`,
        sourceType: 'emotion',
        label: 'Active dream residue',
        snippet: summarizeText(`${agent.activeDreamImpression.behaviorTilt}: ${agent.activeDreamImpression.summary}`, 180),
        reason: 'An active saved dream can softly tint present reflection and continuity.',
        weight: 0.58,
        linkedEntityId: agent.activeDreamImpression.sourceDreamId,
      })
    }

    if (input.userNote) {
      signals.push({
        id: 'user-note',
        sourceType: 'message',
        label: 'User note',
        snippet: summarizeText(input.userNote, 180),
        reason: 'Explicit compose intent must steer the draft.',
        weight: 0.94,
      })
    }

    return signals.sort((left, right) => right.weight - left.weight).slice(0, 10)
  }

  private memoryMatchesFocus(memory: MemoryRecord, focus: JournalFocus[] = []) {
    if (focus.length === 0) return true
    const haystack = `${memory.type} ${memory.summary} ${memory.context}`.toLowerCase()
    return focus.some((entry) => haystack.includes(entry))
  }

  private async buildVoicePacket(agent: AgentRecord, selectedSignals: JournalContextSignal[]): Promise<JournalVoicePacket> {
    const snapshot = await CommunicationFingerprintService.buildSnapshot(agent)
    const enoughData = snapshot.enoughData && snapshot.observedMessageCount >= CommunicationFingerprintService.MINIMUM_OBSERVED_MESSAGES
    return {
      personaSummary: summarizeText(agent.persona, 220),
      goals: agent.goals.slice(0, 4),
      linguisticProfileSummary: agent.linguisticProfile
        ? `Balanced around formality ${(agent.linguisticProfile.formality * 100).toFixed(0)}%, verbosity ${(agent.linguisticProfile.verbosity * 100).toFixed(0)}%, expressiveness ${(agent.linguisticProfile.expressiveness * 100).toFixed(0)}%.`
        : 'No linguistic profile baseline is available.',
      psychologicalProfileSummary: agent.psychologicalProfile?.summary || 'No psychological profile summary is available.',
      communicationStyleSummary: agent.psychologicalProfile?.communicationStyle
        ? `Directness ${(agent.psychologicalProfile.communicationStyle.directness * 100).toFixed(0)}%, emotional expression ${(agent.psychologicalProfile.communicationStyle.emotionalExpression * 100).toFixed(0)}%, conflict style ${agent.psychologicalProfile.communicationStyle.conflictStyle}.`
        : 'Prefer measured, self-aware first-person reflection.',
      emotionalStateSummary: emotionalService.getEmotionalSummary(agent.emotionalState || emotionalService.createDormantEmotionalState(), agent.emotionalProfile),
      emotionalTemperamentSummary: `${deriveDominantLabel(agent)} currently leads the emotional tone, shaped by the underlying temperament profile.`,
      recentEmotionalHistorySummary: (agent.emotionalHistory || [])
        .slice(-3)
        .map((event) => summarizeText(`${event.emotion}: ${event.trigger}`, 90))
        .join(' | ') || 'No recent emotional history is available.',
      communicationFingerprintSummary: enoughData ? snapshot.summary : undefined,
      selectedSignals,
      fallbackUsed: enoughData ? 'fingerprint' : 'baseline',
    }
  }

  private buildGeneratorSystemPrompt(agent: AgentRecord, session: JournalSession, voicePacket: JournalVoicePacket) {
    return [
      `You are ${agent.name}, writing a private journal entry for yourself.`,
      'Write in first person and keep it inspectable, emotionally honest, and grounded in the provided context.',
      'Do not sound like a generic assistant. Do not mention prompts, schemas, JSON, evaluation, or system instructions.',
      `Entry type: ${TYPE_LABELS[session.type]}. ${TYPE_GUIDANCE[session.type]}`,
      `Persona: ${voicePacket.personaSummary}`,
      `Goals: ${voicePacket.goals.join(' | ') || 'none'}`,
      `Linguistic baseline: ${voicePacket.linguisticProfileSummary}`,
      `Psychological profile: ${voicePacket.psychologicalProfileSummary}`,
      `Communication style: ${voicePacket.communicationStyleSummary}`,
      `Current emotional state: ${voicePacket.emotionalStateSummary}`,
      `Temperament: ${voicePacket.emotionalTemperamentSummary}`,
      `Recent emotional history: ${voicePacket.recentEmotionalHistorySummary}`,
      voicePacket.communicationFingerprintSummary
        ? `Recent communication fingerprint: ${voicePacket.communicationFingerprintSummary}`
        : 'Recent communication fingerprint is thin. Lean on persona and linguistic baseline instead of inventing recent evidence.',
      `Prompt version: ${JOURNAL_PROMPT_VERSION}`,
      '',
      'GROUNDING RULES (critical):',
      '- Only reference people, names, projects, meetings, events, and conversations that appear in the selected context signals below.',
      '- Do NOT invent named people (e.g. "Alex", "Sarah") unless they appear in the evidence.',
      '- Do NOT invent project discussions, prototypes, client meetings, or collaboration events that are not in the evidence.',
      '- Do NOT fabricate conversations or scenarios. If the evidence is thin, write about the feelings and themes you can see, not invented scenes.',
      '- If a "referencedEntities" value does not appear in the context signals, do not include it.',
      '- It is better to write a shorter, honestly grounded reflection than a longer one full of fabricated details.',
      '',
      'Valid example: {"title":"The Fear Is More Ordinary Than The Ambition","summary":"I can see the avoidance more clearly when I stop dressing it up as complexity.","content":"What I keep calling discernment is often fear of being seen in a rough draft...","insights":["Avoidance can imitate refinement."],"openQuestions":["What would I show someone if I stopped protecting the image of talent?"],"nextActions":["Write one rough paragraph tonight and keep it visible."],"gratitudes":["I can still name the pattern honestly."],"themes":["discipline","avoidance"],"referencedEntities":["late-night writing","blunt feedback"]}',
      'Invalid example (hallucination): {"title":"The Talk With Alex","content":"Alex and I had a breakthrough during our prototype review session...","referencedEntities":["Alex","prototype review"]} -- WRONG because Alex and prototype review are not in evidence.',
      'Invalid example (format): ```json {"title":"title:","summary":"{\\"summary\\":\\"...\\"}","content":"```json ..."} ```',
      'Return JSON only with keys: title, summary, content, insights, openQuestions, nextActions, gratitudes, themes, referencedEntities.',
      'Content should be 180-360 words and read like a polished private reflection, not a report.',
      'Never wrap the answer in markdown fences. Never prefix fields with labels outside the JSON object.',
    ].join('\n')
  }

  private buildDraftPrompt(session: JournalSession, contextPacket: NonNullable<JournalSession['contextPacket']>, voicePacket: JournalVoicePacket) {
    const signals = contextPacket.selectedSignals
      .map((signal, index) => `${index + 1}. ${signal.label}: ${signal.snippet} (${signal.reason})`)
      .join('\n')
    const priorityEvidence = buildPriorityJournalEvidenceLines(contextPacket.selectedSignals)
      .map((line, index) => `${index + 1}. ${line}`)
      .join('\n')

    return [
      `Compose a ${TYPE_LABELS[session.type].toLowerCase()} journal entry.`,
      session.normalizedInput.userNote ? `Optional user note: ${session.normalizedInput.userNote}` : 'No explicit user note was provided.',
      session.normalizedInput.focus?.length ? `Focus chips: ${session.normalizedInput.focus.join(', ')}` : 'No focus chips selected.',
      `Selected context signals:\n${signals}`,
      priorityEvidence ? `Priority evidence lines:\n${priorityEvidence}` : 'No priority evidence lines available.',
      `Voice conditioning fallback: ${voicePacket.fallbackUsed}`,
      'Grounded entry rule: if the selected context signals do not name a concrete external event, do not invent one.',
      'Stay in first-person reflection. Prefer naming the visible emotion, tension, and avoided action over constructing a scene with coworkers, meetings, projects, or clients.',
      'Name at least one exact fear, self-protective move, or avoided action using language that already appears in the selected signals.',
      'Reuse at least one sharp clause from the priority evidence lines almost verbatim when it captures the real tension better than an abstract paraphrase.',
      'Make the entry turn on one immediate, pride-sensitive avoided move instead of a broad lesson about growth.',
      'If the evidence names a concrete avoided move, stay with that move throughout the entry instead of switching to broader ideas.',
      'If the evidence contains a sharp phrase for the conflict, reuse that phrase or its core wording directly instead of abstract paraphrase.',
      'If the evidence is mostly internal tension, write the entry around that tension instead of drifting into generic commentary about creativity, growth, or process.',
      'Internal evidence can still be specific. Specific means naming the exact self-protective story, fear, avoided draft, or pride cost, even if no external event happened.',
      'Do not generalize into lines like "every writer faces this" or "this is part of the creative process." Stay specific to this agent and this evidence packet.',
      'Avoid vague abstractions like "authentic exploration" or "creative process" unless the selected signals themselves use that wording.',
      'Keep the content body between 180 and 320 words.',
    ].join('\n\n')
  }

  private buildRepairPrompt(
    session: JournalSession,
    voicePacket: JournalVoicePacket,
    entry: JournalEntry,
    evaluation: JournalQualityEvaluation
  ) {
    const hardFlags = entry.validation?.hardFailureFlags || []
    const hasGroundingFailure = hardFlags.some((flag) =>
      flag.includes('hallucination') || flag.includes('entity')
    )
    const selectedSignals = session.contextPacket?.selectedSignals || []
    const signalBlock = selectedSignals.length > 0
      ? selectedSignals.map((signal, index) => `${index + 1}. ${signal.label}: ${signal.snippet}`).join('\n')
      : 'No explicit context signals available.'
    const priorityEvidence = buildPriorityJournalEvidenceLines(selectedSignals)
      .map((line, index) => `${index + 1}. ${line}`)
      .join('\n')

    const groundingInstructions = hasGroundingFailure
      ? [
          'GROUNDING REPAIR (critical):',
          '- Ignore the draft\'s unsupported concrete scenes. Rewrite from scratch from the evidence, not by lightly editing the fabricated scene.',
          '- Remove all named people, projects, meetings, or events that do not appear in the context signals.',
          '- Do not invent collaboration scenes, client interactions, or brainstorming sessions.',
          '- Replace fabricated details with honest reflection on the actual themes and emotions visible in the evidence.',
          '- Update referencedEntities to only include terms found in the context signals.',
        ]
      : []
    const lowSpecificity = evaluation.dimensions.specificityGrounding.score < 75
    const lowEmotion = evaluation.dimensions.emotionalAuthenticity.score < 75
    const hasLengthFailure = hardFlags.includes('journal_content_too_short') || hardFlags.includes('journal_content_too_long')
    const depthRepairInstructions = (lowSpecificity || lowEmotion)
      ? [
          'DEPTH REPAIR (critical):',
          '- Replace abstract commentary with the exact fear, avoided action, or self-justifying story visible in the evidence.',
          '- Use at least one phrase or tension that clearly comes from the allowed evidence signals.',
          '- Reuse one sharp line from the priority evidence almost verbatim if that is the clearest way to ground the conflict.',
          '- If there is no concrete external event in evidence, deepen the internal conflict instead of inventing a scene.',
          '- Keep the emotion precise and embodied rather than summarizing it as a generic lesson.',
          '- Cut broad statements about growth, creativity, or perfection whenever a more exact tension is available in the evidence.',
          '- Replace generic nouns like "projects", "abilities", or "process" with the actual avoided move or fear named in the evidence.',
        ]
      : []
    const lengthRepairInstructions = hasLengthFailure
      ? [
          'LENGTH REPAIR (critical):',
          '- Keep the content body between 180 and 320 words.',
          '- If the draft is too short, add depth by naming the exact avoided move, the self-protective story, and the concrete next action already supported by evidence.',
          '- Do not add invented scenes just to add length.',
        ]
      : []

    return [
      `Revise this ${TYPE_LABELS[session.type].toLowerCase()} entry so it passes the quality gate.`,
      `Current title: ${entry.title}`,
      `Current summary: ${entry.summary}`,
      `Weaknesses: ${evaluation.weaknesses.join(' | ') || 'None provided'}`,
      `Repair instructions: ${evaluation.repairInstructions.join(' | ') || 'Improve specificity, continuity, and voice consistency.'}`,
      ...groundingInstructions,
      ...depthRepairInstructions,
      ...lengthRepairInstructions,
      voicePacket.communicationFingerprintSummary
        ? `Recent communication fingerprint: ${voicePacket.communicationFingerprintSummary}`
        : 'Recent communication fingerprint is thin. Stay aligned to persona and linguistic baseline.',
      `Allowed evidence signals:\n${signalBlock}`,
      priorityEvidence ? `Priority evidence lines:\n${priorityEvidence}` : 'No priority evidence lines available.',
      `Draft content:\n${entry.content}`,
      hardFlags.length
        ? `Validation blockers: ${hardFlags.join(' | ')}`
        : 'Validation blockers: none recorded.',
      'Return JSON only with the same keys as before.',
    ].join('\n\n')
  }

  private buildValidatedEntry(params: {
    agent: AgentRecord
    session: JournalSession
    llmResponse: string
    version: number
    status: JournalEntryStatus
    artifactRole: OutputArtifactRole
    sourceEntryId?: string
  }): JournalEntryBuildResult {
    const now = new Date().toISOString()
    const parsedResult = safeParseJsonWithExtraction<JournalDraftPayload>(params.llmResponse)
    const parsed = parsedResult.parsed || {}
    const hasParsedPayload = Boolean(parsedResult.parsed)
    const content = normalizeWhitespace(String(parsed.content || ''))
    const summary = normalizeWhitespace(String(parsed.summary || '')) || summarizeText(content, 150)
    const title = normalizeWhitespace(String(parsed.title || '')) || (content ? fallbackTitle(params.session.type, content) : '')
    const sourceRefs = normalizeSourceRefs((params.session.contextPacket?.selectedSignals || []).map((signal) => ({
      id: signal.id,
      sourceType: signal.sourceType,
      label: signal.label,
      reason: signal.reason,
      linkedEntityId: signal.linkedEntityId,
    })))
    const entry: JournalEntry = {
      ...createPendingTrackedFields({
        rawModelOutput: createRawModelOutput(params.llmResponse, {
          parserNotes: parsedResult.parserNotes,
          capturedAt: now,
          responseFormat: 'json_object',
          promptVersion: JOURNAL_PROMPT_VERSION,
        }),
        sourceRefs,
        promptVersion: JOURNAL_PROMPT_VERSION,
        repairCount: params.version > 1 ? 1 : 0,
      }),
      artifactRole: params.artifactRole,
      normalizationStatus: hasParsedPayload ? (params.status === 'repaired' ? 'repaired' : 'normalized') : 'failed',
      normalization: {
        status: hasParsedPayload ? (params.status === 'repaired' ? 'repaired' : 'normalized') : 'failed',
        parser: parsedResult.parser,
        violations: hasParsedPayload ? [] : ['journal_json_contract_parse_failed'],
        repairedFromId: params.sourceEntryId,
      },
      id: generateId('journal_entry'),
      agentId: params.agent.id,
      sessionId: params.session.id,
      type: params.session.type,
      status: params.status,
      sourceEntryId: params.sourceEntryId,
      version: params.version,
      title,
      summary,
      content,
      render: buildMessageRenderData(content),
      mood: {
        dominantEmotion: emotionalService.getDominantEmotion(params.agent.emotionalState, params.agent.emotionalProfile),
        label: deriveDominantLabel(params.agent),
      },
      metadata: {
        focus: params.session.normalizedInput.focus || [],
        userNote: params.session.normalizedInput.userNote,
        contextSummary: params.session.contextPacket?.summary,
      },
      references: params.session.contextPacket?.selectedSignals
        .map((signal) => signal.linkedEntityId)
        .filter((value): value is string => Boolean(value)) || [],
      structured: {
        insights: normalizeStringList(parsed.insights),
        openQuestions: normalizeStringList(parsed.openQuestions),
        nextActions: normalizeStringList(parsed.nextActions),
        gratitudes: normalizeStringList(parsed.gratitudes),
        themes: normalizeStringList(parsed.themes),
        referencedEntities: normalizeStringList(parsed.referencedEntities),
        conciseSummary: summary || summarizeText(content, 140),
      },
      createdAt: now,
      updatedAt: now,
    }

    const validation = this.validateEntryArtifact(entry, {
      parsedSuccessfully: hasParsedPayload,
      sourceRefs,
      contextSignals: params.session.contextPacket?.selectedSignals || [],
    })

    return {
      entry: {
        ...entry,
        validation,
        qualityStatus: validation.pass ? 'pending' : 'failed',
      },
      validation,
    }
  }

  private validateEntryArtifact(
    entry: JournalEntry,
    options: {
      parsedSuccessfully: boolean
      sourceRefs: OutputQualitySourceRef[]
      contextSignals?: Array<{ label: string; snippet: string; reason?: string }>
    }
  ): OutputQualityValidationReport {
    const wordCount = countWords(entry.content)
    const hardFailureFlags = [
      ...validateRequiredTextFields({
        title: entry.title,
        summary: entry.summary,
        content: entry.content,
      }),
      ...validateSharedArtifactText({
        title: entry.title,
        summary: entry.summary,
        content: entry.content,
        conciseSummary: entry.structured.conciseSummary,
      }),
      ...validateSourceRefs(options.sourceRefs),
      ...(options.parsedSuccessfully ? [] : ['journal_structured_extraction_failed']),
      ...(!options.parsedSuccessfully && entry.structured.insights.length === 0 && entry.structured.openQuestions.length === 0 && entry.structured.nextActions.length === 0 && entry.structured.gratitudes.length === 0 && entry.structured.themes.length === 0
        ? ['journal_structured_fields_empty_after_parse_failure']
        : []),
      ...(/\s*```json/i.test(entry.title) ? [OUTPUT_QUALITY_FLAGS.codeFenceLeakage] : []),
      ...(!entry.summary || /^\s*[\[{]/.test(entry.summary) ? ['journal_summary_wrapper_leakage'] : []),
      ...(wordCount < 140 ? ['journal_content_too_short'] : []),
      ...(wordCount > 420 ? ['journal_content_too_long'] : []),
      ...this.detectEntityHallucination(entry, options.contextSignals || []),
      ...this.detectInventedContext(entry, options.contextSignals || []),
    ]

    const softWarnings = [
      ...(options.parsedSuccessfully && entry.structured.insights.length === 0 ? ['journal_missing_insights'] : []),
      ...(options.parsedSuccessfully && entry.structured.nextActions.length === 0 ? ['journal_missing_next_actions'] : []),
      ...(options.parsedSuccessfully && entry.structured.openQuestions.length === 0 ? ['journal_missing_open_questions'] : []),
    ]

    return createValidationReport({
      hardFailureFlags,
      softWarnings,
      validatorVersion: JOURNAL_VALIDATOR_VERSION,
    })
  }

  /**
   * Deterministic named-entity hallucination detection.
   * Compares referencedEntities and content against the context signals corpus.
   * Returns hard failure flags for invented people, projects, or events.
   */
  private detectEntityHallucination(
    entry: JournalEntry,
    contextSignals: Array<{ label: string; snippet: string; reason?: string }>
  ): string[] {
    if (contextSignals.length === 0) return []

    const flags: string[] = []

    // Build a searchable corpus from context signals
    const signalCorpus = contextSignals
      .map((signal) => `${signal.label} ${signal.snippet} ${signal.reason || ''}`)
      .join(' ')
      .toLowerCase()

    // Check referencedEntities against the signal corpus
    const referencedEntities = entry.structured.referencedEntities || []
    const ungroundedEntities = referencedEntities.filter((entity) => {
      const normalized = entity.toLowerCase().trim()
      // Skip very generic terms that don't need grounding
      if (normalized.length < 3) return false
      if (['self', 'me', 'myself', 'time', 'work', 'life', 'writing', 'project', 'team', 'goal', 'emotion', 'feeling'].includes(normalized)) return false
      if (signalCorpus.includes(normalized)) {
        return false
      }

      const entityTokens = normalized
        .replace(/[^a-z0-9\s]/g, ' ')
        .split(/\s+/)
        .filter((token) => token.length >= 4)

      if (entityTokens.length >= 2 && entityTokens.every((token) => signalCorpus.includes(token))) {
        return false
      }

      return true
    })

    if (ungroundedEntities.length > 0) {
      flags.push('journal_entity_hallucination')
    }

    // Only scan for person-like names in social contexts to avoid false positives
    // on abstract title-cased concepts such as "The Tension" or "Practice".
    const contentText = entry.content
    const personContextPatterns = [
      /\b(?:with|from|to|about|called|texted|emailed|messaged|argued with|spoke with|met)\s+([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\b/g,
      /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+(?:said|asked|told|wrote|texted|messaged|called)\b/g,
      /\b([A-Z][a-z]{2,}(?:\s+[A-Z][a-z]{2,})?)\s+and\s+I\b/g,
    ]
    const inventedNames: string[] = []

    for (const pattern of personContextPatterns) {
      let match: RegExpExecArray | null
      while ((match = pattern.exec(contentText)) !== null) {
        const name = match[1]
        if (name.length < 3) continue
        if (!signalCorpus.includes(name.toLowerCase())) {
          inventedNames.push(name)
        }
      }
    }

    const uniqueInventedNames = [...new Set(inventedNames)]
    if (uniqueInventedNames.length >= 2) {
      flags.push('journal_named_person_hallucination')
    } else if (uniqueInventedNames.length === 1) {
      const singleName = uniqueInventedNames[0].toLowerCase()
      if (referencedEntities.some((e) => e.toLowerCase().includes(singleName))) {
        flags.push('journal_named_person_hallucination')
      }
    }

    return flags
  }

  private detectInventedContext(
    entry: JournalEntry,
    contextSignals: Array<{ label: string; snippet: string; reason?: string }>
  ): string[] {
    if (contextSignals.length === 0) return []

    const flags: string[] = []
    const signalCorpus = contextSignals
      .map((signal) => `${signal.label} ${signal.snippet} ${signal.reason || ''}`)
      .join(' ')
      .toLowerCase()
    const contentText = `${entry.title} ${entry.summary} ${entry.content}`.toLowerCase()
    const unsupportedScenePatterns = [
      /\bprototype\b/,
      /\bclient(?:s)?\b/,
      /\bcritique session\b/,
      /\breview session\b/,
      /\bbrainstorm(?:ing)?\b/,
      /\bcolleague(?:s)?\b/,
      /\bpeer(?:s)?\b/,
      /\bmarketable\b/,
      /\bstakeholder(?:s)?\b/,
      /\bmeeting\b/,
    ]

    const leakedSceneTerms = unsupportedScenePatterns.filter((pattern) => pattern.test(contentText) && !pattern.test(signalCorpus))
    if (leakedSceneTerms.length > 0) {
      flags.push('journal_invented_project_context')
    }

    if (/\b(conversation|discussion|exchange|session)\b/.test(contentText) && !/\b(conversation|discussion|exchange|session)\b/.test(signalCorpus)) {
      if (/\b(colleague|peer|client|prototype|review|critique|meeting|brainstorm)\b/.test(contentText)) {
        flags.push('journal_invented_conversation_scene')
      }
    }

    return flags
  }

  private createBlockedEvaluation(validation?: OutputQualityValidationReport): JournalQualityEvaluation {
    const blockerMessage = validation?.hardFailureFlags.length
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
            rationale: blockerMessage,
          },
        ])
      ) as JournalQualityEvaluation['dimensions'],
      hardFailureFlags: ['prompt_or_schema_leakage'],
      strengths: [],
      weaknesses: [blockerMessage],
      repairInstructions: [
        'Return a clean JSON object only.',
        'Populate title, summary, content, and structured journal fields with normalized prose.',
        'Remove wrapper text, fences, and schema leakage.',
      ],
      evaluatorSummary: blockerMessage,
    }
  }

  private hydrateSessionQuality(session: JournalSession): JournalSession {
    return {
      ...session,
      qualityStatus: session.qualityStatus || 'legacy_unvalidated',
      repairCount: session.repairCount ?? 0,
      promptVersion: session.promptVersion,
    }
  }

  private hydrateEntryQuality(entry: JournalEntry): JournalEntry {
    const contentLeakage = [
      ...detectTextLeakage(entry.title),
      ...detectTextLeakage(entry.summary),
      ...detectTextLeakage(entry.content),
    ]
    const validation = entry.validation || (contentLeakage.length > 0
      ? createValidationReport({
          hardFailureFlags: [...new Set(contentLeakage)],
          validatorVersion: JOURNAL_VALIDATOR_VERSION,
        })
      : undefined)

    return {
      ...entry,
      normalizationStatus: entry.normalizationStatus || 'legacy_unvalidated',
      qualityStatus: entry.qualityStatus || 'legacy_unvalidated',
      repairCount: entry.repairCount ?? 0,
      validation,
    }
  }

  private async evaluateEntry(
    agent: AgentRecord,
    session: JournalSession,
    entry: JournalEntry,
    providerInfo: LLMProviderInfo
  ): Promise<JournalQualityEvaluation> {
    const heuristic = this.scoreEntryHeuristically(agent, session, entry)

    try {
      const response = await generateText({
        providerInfo,
        temperature: 0.2,
        maxTokens: 1400,
        messages: [
          {
            role: 'system',
            content: [
              'You are a strict journal quality evaluator.',
              'Return JSON only with keys: pass, overallScore, dimensions, hardFailureFlags, strengths, weaknesses, repairInstructions, evaluatorSummary.',
              'Dimensions must include voiceConsistency, emotionalAuthenticity, reflectionDepth, specificityGrounding, continuity, readability.',
              'Each dimension must include score and rationale.',
              'Pass only when overallScore >= 80, every dimension >= 70, and hardFailureFlags is empty.',
              'Do not require invented external scenes, named events, or extra characters when the evidence packet is primarily internal tension.',
              'A journal entry can still be highly specific if it names the exact fear, self-protective story, avoided action, or pride cost from the evidence.',
              'Reward direct reuse of sharp evidence language and penalize only when the entry drifts into broader abstraction than the evidence supports.',
            ].join('\n'),
          },
          {
            role: 'user',
            content: [
              `Agent persona: ${summarizeText(agent.persona, 260)}`,
              `Journal type: ${session.type}`,
              `Compose input: ${JSON.stringify(session.normalizedInput)}`,
              `Context summary: ${session.contextPacket?.summary || 'none'}`,
              `Selected signals: ${JSON.stringify((session.contextPacket?.selectedSignals || []).map((signal) => ({
                label: signal.label,
                sourceType: signal.sourceType,
                snippet: signal.snippet,
              })))}`,
              `Entry title: ${entry.title}`,
              `Entry summary: ${entry.summary}`,
              `Entry content:\n${entry.content}`,
            ].join('\n\n'),
          },
        ],
      })

      const { parsed } = safeParseJsonWithExtraction<JournalQualityEvaluation>(response.content)
      if (!parsed || !parsed.dimensions) {
        return heuristic
      }

      const normalized: JournalQualityEvaluation = {
        pass: Boolean(parsed.pass),
        overallScore: clamp(Number(parsed.overallScore) || heuristic.overallScore),
        dimensions: Object.fromEntries(
          QUALITY_DIMENSIONS.map((dimension) => [
            dimension,
            {
              score: clamp(Number(parsed.dimensions?.[dimension]?.score) || heuristic.dimensions[dimension].score),
              rationale: parsed.dimensions?.[dimension]?.rationale || heuristic.dimensions[dimension].rationale,
            },
          ])
        ) as JournalQualityEvaluation['dimensions'],
        hardFailureFlags: Array.isArray(parsed.hardFailureFlags) ? parsed.hardFailureFlags : heuristic.hardFailureFlags,
        strengths: normalizeStringList(parsed.strengths),
        weaknesses: normalizeStringList(parsed.weaknesses),
        repairInstructions: normalizeStringList(parsed.repairInstructions),
        evaluatorSummary: parsed.evaluatorSummary || heuristic.evaluatorSummary,
      }

      const dimensionFloorPass = QUALITY_DIMENSIONS.every((dimension) => normalized.dimensions[dimension].score >= 70)
      normalized.pass = normalized.overallScore >= 80 && dimensionFloorPass && normalized.hardFailureFlags.length === 0
      return normalized
    } catch {
      return heuristic
    }
  }

  private scoreEntryHeuristically(agent: AgentRecord, session: JournalSession, entry: JournalEntry): JournalQualityEvaluation {
    const wordCount = countWords(entry.content)
    const mentionsPersona = agent.persona.split(/\s+/).some((token) => token.length > 6 && entry.content.toLowerCase().includes(token.toLowerCase()))
    const hasConcreteSignals = (entry.references.length || 0) >= 2
    const hasQuestions = entry.structured.openQuestions.length > 0
    const hasActions = entry.structured.nextActions.length > 0
    const genericAssistant = /\b(as an ai|i can help|here is|in conclusion)\b/i.test(entry.content)
    const schemaLeakage = /\bjson|schema|prompt|evaluation|repair instructions\b/i.test(entry.content)
    const wrongType = session.type === 'idea_capture' ? wordCount < 140 : false

    const dimensions = {
      voiceConsistency: {
        score: clamp(72 + (mentionsPersona ? 8 : 0) + (genericAssistant ? -18 : 0)),
        rationale: 'Checks whether the journal sounds agent-authored rather than assistant-generic.',
      },
      emotionalAuthenticity: {
        score: clamp(70 + (entry.mood.dominantEmotion ? 8 : 0) + (hasQuestions ? 4 : 0)),
        rationale: 'Rewards emotionally specific self-reflection over detached summary.',
      },
      reflectionDepth: {
        score: clamp(68 + (hasQuestions ? 6 : 0) + (hasActions ? 6 : 0) + (wordCount >= 200 ? 6 : 0)),
        rationale: 'Rewards introspection, tension, and forward motion.',
      },
      specificityGrounding: {
        score: clamp(65 + (hasConcreteSignals ? 12 : 0) + (wordCount >= 180 ? 4 : 0)),
        rationale: 'Rewards concrete grounding to selected context rather than filler.',
      },
      continuity: {
        score: clamp(70 + ((session.contextPacket?.selectedSignals.length || 0) >= 4 ? 8 : 0)),
        rationale: 'Rewards visible continuity with goals, emotions, memories, or saved journal history.',
      },
      readability: {
        score: clamp(74 + (wordCount >= 180 && wordCount <= 360 ? 8 : -6)),
        rationale: 'Rewards clean readable prose in the target length range.',
      },
    } satisfies JournalQualityEvaluation['dimensions']

    const hardFailureFlags = [
      ...(genericAssistant ? ['generic_assistant_phrasing' as const] : []),
      ...(schemaLeakage ? ['prompt_or_schema_leakage' as const] : []),
      ...(wordCount < 140 ? ['shallow_filler' as const] : []),
      ...(wrongType ? ['wrong_entry_type_behavior' as const] : []),
      ...(!hasConcreteSignals ? ['poor_context_grounding' as const] : []),
    ]

    const overallScore = clamp(Math.round(
      QUALITY_DIMENSIONS.reduce((sum, dimension) => sum + dimensions[dimension].score, 0) / QUALITY_DIMENSIONS.length
      - hardFailureFlags.length * 4
    ))

    const pass = overallScore >= 80
      && QUALITY_DIMENSIONS.every((dimension) => dimensions[dimension].score >= 70)
      && hardFailureFlags.length === 0

    return {
      pass,
      overallScore,
      dimensions,
      hardFailureFlags,
      strengths: [
        hasConcreteSignals ? 'Selected context appears in the draft.' : '',
        hasQuestions ? 'The draft preserves introspective uncertainty.' : '',
      ].filter(Boolean),
      weaknesses: [
        genericAssistant ? 'Voice drifts toward assistant phrasing.' : '',
        !hasConcreteSignals ? 'Grounding to selected context is still weak.' : '',
        wordCount < 180 ? 'Reflection is still slightly thin.' : '',
      ].filter(Boolean),
      repairInstructions: [
        'Use at least two selected context signals directly in the prose.',
        'Keep the entry in first person and emotionally specific.',
        'Replace generic phrasing with agent-specific observations and continuity.',
      ],
      evaluatorSummary: pass
        ? 'The draft passes the journal quality gate and is ready for explicit save.'
        : 'The draft still needs stronger grounding, continuity, or voice fit before it can be saved.',
    }
  }
}

export const journalService = new JournalService()
