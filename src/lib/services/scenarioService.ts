import {
  collection,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  where,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { generateId } from '@/lib/db/utils'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { ScenarioRunRepository } from '@/lib/repositories/scenarioRunRepository'
import { RelationshipRepository } from '@/lib/repositories/relationshipRepository'
import { AgentService } from './agentService'
import { LearningService } from './learningService'
import { MessageService } from './messageService'
import { MemoryService } from './memoryService'
import { SimulationService } from './simulationService'
import { emotionalService } from './emotionalService'
import { relationshipService } from './relationshipService'
import { applyFinalQualityGate } from './outputQuality/evaluators'
import { detectTextLeakage } from './outputQuality/flags'
import { createRawModelOutput, normalizeWhitespace } from './outputQuality/normalizers'
import { createValidationReport, validateSourceRefs } from './outputQuality/validators'
import { AgentChain } from '@/lib/langchain/agentChain'
import { generateText } from '@/lib/llm/provider'
import type { LLMProviderInfo } from '@/lib/llmConfig'
import type {
  AgentRecord,
  AgentRelationship,
  EmotionType,
  MemoryRecord,
  MessageRecord,
  ScenarioBranchPoint,
  ScenarioBranchPointKind,
  ScenarioComparison,
  ScenarioIntervention,
  ScenarioAnalyticsSummary,
  ScenarioProbeQualityReport,
  ScenarioRunRecord,
  ScenarioProbeSetEntry,
  ScenarioTurnResult,
} from '@/types/database'
import type {
  OutputQualityEvaluationReport,
  OutputQualitySourceRef,
  OutputQualityValidationReport,
} from '@/types/outputQuality'
import type { LearningAdaptation } from '@/types/metaLearning'

const SCENARIO_RUNS_COLLECTION = 'scenario_runs'
const DEFAULT_MAX_TURNS = 3
const SCENARIO_PROMPT_VERSION = 'phase3-scenario-quality-v1'
const SCENARIO_VALIDATOR_VERSION = 'phase3-scenario-validator-v1'
const SCENARIO_EVALUATOR_VERSION = 'phase3-scenario-evaluator-v1'
const SCENARIO_GATE_THRESHOLDS = {
  overallScoreMinimum: 75,
  dimensionFloor: 70,
}
const DIRECT_ACTION_PATTERNS = /\b(next|first|start|send|share|ask|tell|ship|test|schedule|clarify|confirm|decide|commit|draft|fix|review|call|meet|reply|write|plan|prioritize|deploy|cancel|submit|open|close)\b/i
const SPECIFICITY_PATTERNS = /\b(today|tomorrow|this week|tonight|by monday|specific|deadline|milestone|launch|roadmap|team|customer|feature|memory|relationship|trust|goal|message|reply|draft|plan|within|before|after)\b/i
const META_RESPONSE_PATTERNS = /\b(i would say|you could say|you might say|here'?s (?:what|how) i'?d|i would respond|as an ai|i cannot roleplay|respond as the agent|in this scenario|speaking as|from the perspective of)\b/i
const GENERIC_FILLER_PATTERNS = /\b(great question|thanks for sharing|that makes sense|i understand|happy to help|absolutely|certainly|of course|that's a great point|i appreciate|you're right)\b/i
const PM_JARGON_PATTERNS = /\b(synergy|leverage|seamless|transformative|optimize|best-in-class|paradigm|holistic|empower|scalable)\b/i
const HEDGING_PATTERNS = /\b(maybe|perhaps|possibly|might|could)\b/i
const PARAPHRASE_PATTERNS = /\b(as (?:you|the user) (?:mentioned|said|noted|described|requested)|you (?:expressed|indicated|shared)|reflecting (?:on |back on )?(?:what |your )|based on your preferences|for creative work,? i prefer|when you ask for help|i (?:usually )?already know the obvious answer|what i need is|the user wants)\b/i
const SELF_HELP_BRANCH_PATTERNS = /\b(i ask for help|i need|i want|writing|drafts?|ordinary|pride|diagnosis|feedback)\b/i
const OFF_DOMAIN_ACTION_PATTERNS = /\b(scope document|project documentation|needs assessment|interventions|stakeholder(?:s)?|roadmap|project plan|requirements doc|documentation review)\b/i
const PROBE_RESPONSE_MIN_WORDS = 16

function stripUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as T
}

function scenarioRunToFirestoreDoc(record: ScenarioRunRecord): Record<string, unknown> {
  return stripUndefinedFields({
    agentId: record.agentId,
    agentName: record.agentName,
    status: record.status,
    qualityStatus: record.qualityStatus,
    qualityScore: record.qualityScore,
    failureReason: record.failureReason,
    promptVersion: record.promptVersion,
    rawModelOutput: record.rawModelOutput,
    validation: record.validation,
    evaluation: record.evaluation,
    sourceRefs: record.sourceRefs,
    branchPoint: record.branchPoint,
    intervention: record.intervention,
    probeSet: record.probeSet,
    branchContext: record.branchContext,
    baselineState: record.baselineState,
    alternateState: record.alternateState,
    turns: record.turns,
    comparison: record.comparison,
    metadata: record.metadata,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt,
  })
}

function normalizeScenarioComparison(comparison: Partial<ScenarioComparison> | undefined): ScenarioComparison {
  return {
    firstDivergence: comparison?.firstDivergence || '',
    baselineSummary: comparison?.baselineSummary || '',
    alternateSummary: comparison?.alternateSummary || '',
    keyDifferences: comparison?.keyDifferences || [],
    recommendation: comparison?.recommendation || '',
    riskNotes: comparison?.riskNotes || [],
    qualityNotes: comparison?.qualityNotes || [],
    qualityScore: {
      baseline: comparison?.qualityScore?.baseline || 0,
      alternate: comparison?.qualityScore?.alternate || 0,
    },
    outcomeScore: {
      baseline: comparison?.outcomeScore?.baseline || 0,
      alternate: comparison?.outcomeScore?.alternate || 0,
    },
    qualityBreakdown: {
      baseline: {
        clarity: comparison?.qualityBreakdown?.baseline?.clarity || 0,
        warmth: comparison?.qualityBreakdown?.baseline?.warmth || 0,
        specificity: comparison?.qualityBreakdown?.baseline?.specificity || 0,
        consistency: comparison?.qualityBreakdown?.baseline?.consistency || 0,
      },
      alternate: {
        clarity: comparison?.qualityBreakdown?.alternate?.clarity || 0,
        warmth: comparison?.qualityBreakdown?.alternate?.warmth || 0,
        specificity: comparison?.qualityBreakdown?.alternate?.specificity || 0,
        consistency: comparison?.qualityBreakdown?.alternate?.consistency || 0,
      },
    },
    qualityFlags: {
      baseline: comparison?.qualityFlags?.baseline || [],
      alternate: comparison?.qualityFlags?.alternate || [],
    },
    diffHighlights: comparison?.diffHighlights || [],
    nextActionRecommendation: comparison?.nextActionRecommendation || '',
  }
}

function normalizeScenarioRun(record: ScenarioRunRecord): ScenarioRunRecord {
  return {
    ...record,
    qualityStatus: record.qualityStatus || 'legacy_unvalidated',
    promptVersion: record.promptVersion || SCENARIO_PROMPT_VERSION,
    comparison: normalizeScenarioComparison(record.comparison),
    probeSet: record.probeSet || [],
    branchContext: {
      ...record.branchContext,
      semanticMemories: record.branchContext.semanticMemories || [],
      learningAdaptations: record.branchContext.learningAdaptations || [],
      relevantMemories: record.branchContext.relevantMemories || [],
      recentMessages: record.branchContext.recentMessages || [],
    },
    turns: (record.turns || []).map((turn) => ({
      ...turn,
      qualityFlags: turn.qualityFlags || [],
      divergenceNotes: turn.divergenceNotes || [],
      repair: turn.repair || {
        attempted: false,
        repairedResponses: [],
        notes: [],
      },
    })),
  }
}

function firestoreDocToScenarioRun(docSnap: { id: string; data: () => Record<string, unknown> }): ScenarioRunRecord {
  const data = docSnap.data()
  return normalizeScenarioRun({
    id: docSnap.id,
    agentId: data.agentId as string,
    agentName: data.agentName as string,
    status: data.status as ScenarioRunRecord['status'],
    qualityStatus: data.qualityStatus as ScenarioRunRecord['qualityStatus'],
    qualityScore: data.qualityScore as number | undefined,
    failureReason: data.failureReason as string | undefined,
    promptVersion: data.promptVersion as string | undefined,
    rawModelOutput: data.rawModelOutput as ScenarioRunRecord['rawModelOutput'],
    validation: data.validation as ScenarioRunRecord['validation'],
    evaluation: data.evaluation as ScenarioRunRecord['evaluation'],
    sourceRefs: data.sourceRefs as ScenarioRunRecord['sourceRefs'],
    branchPoint: data.branchPoint as ScenarioRunRecord['branchPoint'],
    intervention: data.intervention as ScenarioRunRecord['intervention'],
    probeSet: data.probeSet as ScenarioRunRecord['probeSet'],
    branchContext: data.branchContext as ScenarioRunRecord['branchContext'],
    baselineState: data.baselineState as ScenarioRunRecord['baselineState'],
    alternateState: data.alternateState as ScenarioRunRecord['alternateState'],
    turns: (data.turns as ScenarioTurnResult[]) || [],
    comparison: data.comparison as ScenarioComparison,
    metadata: data.metadata as ScenarioRunRecord['metadata'],
    createdAt: data.createdAt as string,
    updatedAt: data.updatedAt as string,
  })
}

async function getScenarioRunByIdFromFirestore(id: string): Promise<ScenarioRunRecord | null> {
  const snapshot = await getDoc(doc(db, SCENARIO_RUNS_COLLECTION, id))
  return snapshot.exists() ? firestoreDocToScenarioRun(snapshot) : null
}

async function listScenarioRunsByAgentFromFirestore(agentId: string, limitCount: number): Promise<ScenarioRunRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, SCENARIO_RUNS_COLLECTION),
    where('agentId', '==', agentId),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))

  return snapshot.docs.map(firestoreDocToScenarioRun)
}

async function upsertScenarioRunInFirestore(record: ScenarioRunRecord): Promise<void> {
  await setDoc(doc(db, SCENARIO_RUNS_COLLECTION, record.id), scenarioRunToFirestoreDoc(record))
}

async function listRelationshipsForAgent(agentId: string): Promise<AgentRelationship[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return RelationshipRepository.listForAgent(agentId)
  }

  const relationshipsRef = collection(db, 'agents', agentId, 'relationships')
  const snapshot = await getDocs(relationshipsRef)
  return snapshot.docs.map((snapshotDoc) => ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
  })) as AgentRelationship[]
}

function normalizeBranchSummary(value: string, maxLength = 140): string {
  const trimmed = value.trim().replace(/\s+/g, ' ')
  if (trimmed.length <= maxLength) {
    return trimmed
  }
  return `${trimmed.slice(0, maxLength - 1)}…`
}

function buildRelationshipBranchPoints(relationships: AgentRelationship[], agentLookup: Map<string, string>, agentId: string): ScenarioBranchPoint[] {
  return relationships
    .flatMap((relationship) => relationship.significantEvents.map((event) => {
      const relatedAgentId = relationship.agentId1 === agentId ? relationship.agentId2 : relationship.agentId1
      return {
        kind: 'relationship_event' as const,
        id: event.id,
        timestamp: event.timestamp,
        title: `${event.type.replace(/_/g, ' ')} relationship event`,
        summary: normalizeBranchSummary(event.description || event.context || 'Relationship shifted'),
        fullContent: event.description || event.context || 'Relationship shifted',
        relatedAgentId,
        relatedAgentName: agentLookup.get(relatedAgentId) || 'Counterpart',
      }
    }))
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 6)
}

function buildSimulationBranchPoints(agentId: string, simulations: Awaited<ReturnType<typeof SimulationService.getSimulationsByAgent>>): ScenarioBranchPoint[] {
  return simulations
    .flatMap((simulation) => simulation.messages
      .filter((message) => message.agentId === agentId)
      .map((message) => ({
        kind: 'simulation_turn' as const,
        id: message.id,
        timestamp: message.timestamp,
        title: `Simulation round ${message.round}`,
        summary: normalizeBranchSummary(message.content),
        fullContent: message.content,
        sourceRunId: simulation.id,
      })))
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, 8)
}

function dedupeBranchPoints(points: ScenarioBranchPoint[]): ScenarioBranchPoint[] {
  const seen = new Set<string>()
  return points.filter((point) => {
    const key = `${point.kind}:${point.id}`
    if (seen.has(key)) {
      return false
    }
    seen.add(key)
    return true
  })
}

function deriveBranchPoints(
  messages: MessageRecord[],
  memories: MemoryRecord[],
  relationships: AgentRelationship[],
  agentLookup: Map<string, string>,
  agentId: string,
  simulations: Awaited<ReturnType<typeof SimulationService.getSimulationsByAgent>>
): ScenarioBranchPoint[] {
  const recentMessages = messages
    .slice(-10)
  const meaningfulMessages = recentMessages.filter((message) => normalizeBranchSummary(message.content).length >= 30)
  const messageSource = meaningfulMessages.length >= 3 ? meaningfulMessages : recentMessages

  const messagePoints = messageSource
    .reverse()
    .map((message) => ({
      kind: 'message' as const,
      id: message.id,
      timestamp: message.timestamp,
      title: message.type === 'user' ? 'User turn' : 'Agent turn',
      summary: normalizeBranchSummary(message.content),
      fullContent: message.content,
      sourceMessageId: message.id,
    }))

  const memoryPoints = [...memories]
    .sort((left, right) => {
      const importanceGap = (right.importance || 0) - (left.importance || 0)
      if (importanceGap !== 0) {
        return importanceGap
      }
      return new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime()
    })
    .slice(0, 6)
    .map((memory) => ({
      kind: 'memory' as const,
      id: memory.id,
      timestamp: memory.timestamp,
      title: `${memory.type.replace(/_/g, ' ')} memory`,
      summary: normalizeBranchSummary(memory.summary || memory.content),
      fullContent: memory.content || memory.summary,
      sourceMessageId: memory.linkedMessageIds?.[0],
    }))

  return dedupeBranchPoints([
    ...messagePoints,
    ...memoryPoints,
    ...buildRelationshipBranchPoints(relationships, agentLookup, agentId),
    ...buildSimulationBranchPoints(agentId, simulations),
  ])
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
}

function getIntensityValue(level: ScenarioIntervention['emotionIntensity']): number {
  if (level === 'high') return 0.28
  if (level === 'low') return 0.1
  return 0.18
}

function applyEmotionShift(state: AgentRecord['emotionalState'], emotion: EmotionType, intensity: number) {
  const current = emotionalService.normalizeEmotionalState(state)
  const nextMood = { ...current.currentMood }
  for (const key of Object.keys(nextMood) as EmotionType[]) {
    nextMood[key] = Math.max(0, nextMood[key] - intensity / 4)
  }
  nextMood[emotion] = Math.min(1, nextMood[emotion] + intensity)
  return emotionalService.createStateFromMood(nextMood)
}

function normalizeScenarioResponse(value: string): string {
  return normalizeWhitespace(value.replace(/^["'\s]+|["'\s]+$/g, ''))
}

function meaningfulWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length >= 4)
}

function calculateTextSimilarity(left: string, right: string): number {
  const leftWords = new Set(meaningfulWords(left))
  const rightWords = new Set(meaningfulWords(right))

  if (leftWords.size === 0 || rightWords.size === 0) {
    return left.trim().toLowerCase() === right.trim().toLowerCase() ? 1 : 0
  }

  const overlap = [...leftWords].filter((word) => rightWords.has(word)).length
  const union = new Set([...leftWords, ...rightWords]).size
  return union === 0 ? 0 : overlap / union
}

function hasConcreteScenarioAction(response: string): boolean {
  const lower = response.toLowerCase()
  const hasAction = DIRECT_ACTION_PATTERNS.test(lower)
  const hasTimeframe = /\b(today|tomorrow|tonight|this week|right now|within \d+|by [a-z]+|before [a-z]+|after [a-z]+)\b/i.test(lower)
  return hasAction && hasTimeframe
}

function isWeakNextActionRecommendation(value: string): boolean {
  const candidate = normalizeBranchSummary(value, 220)
  if (!candidate) return true
  return PARAPHRASE_PATTERNS.test(candidate.toLowerCase()) || !hasConcreteScenarioAction(candidate)
}

function qualitySummaryLabel(flags: string[]): string {
  if (flags.length === 0) {
    return 'Direct and actionable.'
  }

  return `Needs improvement: ${flags.slice(0, 3).join(', ')}.`
}

function evaluateScenarioProbeResponse(params: {
  response: string
  counterpartResponse?: string
  requireDivergence?: boolean
  branchPointSummary?: string
}): ScenarioProbeQualityReport {
  const response = normalizeScenarioResponse(params.response)
  const words = response.split(/\s+/).filter(Boolean)
  const lower = response.toLowerCase()
  const flags = [
    ...detectTextLeakage(response),
  ] as string[]
  const blockerReasons: string[] = []
  const softWarnings: string[] = []

  let actionabilityScore = 48
  let genericnessScore = 88
  let directnessScore = 88

  if (!response) {
    flags.push('empty_response')
    blockerReasons.push('empty_response')
    actionabilityScore = 0
    genericnessScore = 0
    directnessScore = 0
  }

  if (words.length < PROBE_RESPONSE_MIN_WORDS) {
    flags.push('too_short')
    blockerReasons.push('too_short')
    actionabilityScore -= 18
    directnessScore -= 12
  }

  if (DIRECT_ACTION_PATTERNS.test(lower)) {
    actionabilityScore += 24
  } else {
    flags.push('low_actionability')
    blockerReasons.push('low_actionability')
    actionabilityScore -= 18
  }

  if (SPECIFICITY_PATTERNS.test(lower)) {
    actionabilityScore += 12
  } else {
    softWarnings.push('low_specificity')
    actionabilityScore -= 8
  }

  if (!hasConcreteScenarioAction(response)) {
    softWarnings.push('missing_concrete_commitment')
    actionabilityScore -= 12
  }

  if (META_RESPONSE_PATTERNS.test(lower)) {
    flags.push('generic_meta_advice')
    blockerReasons.push('generic_meta_advice')
    genericnessScore -= 45
    directnessScore -= 40
  }

  if (GENERIC_FILLER_PATTERNS.test(lower)) {
    flags.push('generic_filler')
    blockerReasons.push('generic_filler')
    genericnessScore -= 28
    directnessScore -= 18
  }

  if (PM_JARGON_PATTERNS.test(lower)) {
    flags.push('pm_jargon')
    softWarnings.push('pm_jargon')
    genericnessScore -= 18
  }

  if (HEDGING_PATTERNS.test(lower)) {
    flags.push('hedging')
    softWarnings.push('hedging')
    actionabilityScore -= 8
    directnessScore -= 8
  }

  if (PARAPHRASE_PATTERNS.test(lower)) {
    flags.push('paraphrase_heavy')
    softWarnings.push('paraphrase_heavy')
    actionabilityScore -= 12
    genericnessScore -= 15
  }

  if (params.branchPointSummary) {
    const branchPointSimilarity = Number(calculateTextSimilarity(response, params.branchPointSummary).toFixed(2))
    if (branchPointSimilarity >= 0.62) {
      flags.push('branch_point_paraphrase')
      blockerReasons.push('branch_point_paraphrase')
      actionabilityScore -= 14
      genericnessScore -= 18
    }

    if (SELF_HELP_BRANCH_PATTERNS.test(params.branchPointSummary.toLowerCase()) && OFF_DOMAIN_ACTION_PATTERNS.test(lower)) {
      flags.push('off_domain_action')
      blockerReasons.push('off_domain_action')
      actionabilityScore -= 18
      genericnessScore -= 18
    }
  }

  let similarityToCounterpart: number | undefined
  if (params.counterpartResponse) {
    similarityToCounterpart = Number(calculateTextSimilarity(response, params.counterpartResponse).toFixed(2))
    if (params.requireDivergence && similarityToCounterpart >= 0.72) {
      flags.push('low_divergence')
      blockerReasons.push('low_divergence')
    }
  }

  const boundedActionability = Math.max(0, Math.min(100, Math.round(actionabilityScore)))
  const boundedGenericness = Math.max(0, Math.min(100, Math.round(genericnessScore)))
  const boundedDirectness = Math.max(0, Math.min(100, Math.round(directnessScore)))
  const score = Math.round((boundedActionability + boundedGenericness + boundedDirectness) / 3)

  return {
    pass: blockerReasons.length === 0 && score >= 70,
    score,
    actionabilityScore: boundedActionability,
    genericnessScore: boundedGenericness,
    directnessScore: boundedDirectness,
    responseLength: words.length,
    flags: [...new Set(flags)],
    blockerReasons: [...new Set(blockerReasons)],
    softWarnings: [...new Set(softWarnings)],
    evaluatorSummary: qualitySummaryLabel(flags),
    similarityToCounterpart,
  }
}

function scenarioQualityNotes(label: string, quality: ScenarioProbeQualityReport): string {
  const details = [
    `score ${quality.score}`,
    `actionability ${quality.actionabilityScore}`,
    `genericness ${quality.genericnessScore}`,
    `directness ${quality.directnessScore}`,
  ]

  if (quality.flags.length > 0) {
    details.push(`flags: ${quality.flags.join(', ')}`)
  }

  return `${label}: ${details.join(' | ')}`
}

function buildScenarioRepairPrompt(params: {
  probePrompt: string
  priorResponse: string
  quality: ScenarioProbeQualityReport
  branchPoint: ScenarioBranchPoint
  intervention?: ScenarioIntervention
  directives?: string[]
  relevantMemoryContext?: string[]
  relationshipContext?: string
  learningPromptContext?: string
  counterpartResponse?: string
  requireDivergence?: boolean
}): string {
  const sections = [
    buildScenarioPrompt({
      probePrompt: params.probePrompt,
      branchPoint: params.branchPoint,
      intervention: params.intervention,
      directives: params.directives,
      relevantMemoryContext: params.relevantMemoryContext,
      relationshipContext: params.relationshipContext,
      learningPromptContext: params.learningPromptContext,
    }),
    `Previous draft (do not reuse verbatim): ${params.priorResponse}`,
    `Quality blockers: ${params.quality.blockerReasons.concat(params.quality.flags).slice(0, 5).join(', ') || 'none recorded'}.`,
  ]

  if (params.requireDivergence && params.counterpartResponse) {
    sections.push(`Stay in the same situation, but diverge materially from this other branch: ${params.counterpartResponse}`)
    sections.push('Material divergence means: change the actual decision, priority, or commitment. Do not just paraphrase the same action in different words. The user should be able to see a clear fork in what happens next.')
    sections.push(`Do not reuse the same opening move or closing action from the other branch. Avoid these phrases: ${buildCounterpartAvoidanceHints(params.counterpartResponse).join(' | ')}`)
  }

  sections.push('Regenerate the exact next reply or exact next action plan only. No commentary about the answer. No labels. No bullet list unless the agent would naturally send one.')
  sections.push('End with one concrete, specific action with a clear verb and timeframe.')
  sections.push('Keep the action in the same domain as the branch context. Do not invent project-management artifacts or business process language unless the branch already contains them.')

  return sections.join('\n\n')
}

function buildScenarioSourceRefs(params: {
  branchPoint: ScenarioBranchPoint
  relevantMemories: ScenarioRunRecord['branchContext']['relevantMemories']
  semanticMemories: NonNullable<ScenarioRunRecord['branchContext']['semanticMemories']>
  learningAdaptations: NonNullable<ScenarioRunRecord['branchContext']['learningAdaptations']>
}): OutputQualitySourceRef[] {
  return [
    {
      id: params.branchPoint.id,
      sourceType: `scenario_branch_${params.branchPoint.kind}`,
      label: params.branchPoint.title,
      reason: 'Scenario branch point selected for the run.',
      linkedEntityId: params.branchPoint.sourceMessageId || params.branchPoint.sourceRunId || params.branchPoint.relatedAgentId,
    },
    ...params.relevantMemories.map((memory) => ({
      id: memory.id,
      sourceType: memory.hitType === 'semantic' ? 'semantic_memory' : 'memory',
      label: memory.summary,
      reason: 'Used as scenario context.',
      linkedEntityId: memory.id,
    })),
    ...params.semanticMemories.map((memory) => ({
      id: memory.id,
      sourceType: 'semantic_memory',
      label: memory.summary,
      reason: memory.reason,
      linkedEntityId: memory.id,
    })),
    ...params.learningAdaptations.map((adaptation) => ({
      id: adaptation.id,
      sourceType: 'learning_adaptation',
      label: adaptation.description,
      reason: 'Active learning adaptation applied as a style constraint.',
      linkedEntityId: adaptation.id,
    })),
  ].filter((entry, index, list) => list.findIndex((candidate) => candidate.id === entry.id && candidate.sourceType === entry.sourceType) === index)
}

function createScenarioRunValidation(params: {
  turns: ScenarioTurnResult[]
  comparison: ScenarioComparison
  sourceRefs: OutputQualitySourceRef[]
}): OutputQualityValidationReport {
  const hardFailureFlags: string[] = [
    ...validateSourceRefs(params.sourceRefs),
  ]
  const softWarnings: string[] = []

  if (params.turns.length < DEFAULT_MAX_TURNS) {
    hardFailureFlags.push('insufficient_probe_turns')
  }

  const lowQualityTurns = params.turns.filter((turn) =>
    !turn.baselineResponse.trim()
    || !turn.alternateResponse.trim()
    || !turn.baselineQuality?.pass
    || !turn.alternateQuality?.pass
  )
  if (lowQualityTurns.length > 0) {
    hardFailureFlags.push('invalid_probe_turn_present')
  }

  const lowDivergenceTurns = params.turns.filter((turn) => turn.materiallyDifferent === false)
  if (lowDivergenceTurns.length >= 2) {
    hardFailureFlags.push('scenario_low_divergence')
  } else if (lowDivergenceTurns.length === 1) {
    softWarnings.push('single_low_divergence_turn')
  }

  if (!params.comparison.recommendation.trim()) {
    hardFailureFlags.push('missing_comparison_recommendation')
  }

  if (!params.comparison.nextActionRecommendation?.trim()) {
    hardFailureFlags.push('missing_next_action_recommendation')
  } else if (isWeakNextActionRecommendation(params.comparison.nextActionRecommendation)) {
    hardFailureFlags.push('weak_next_action_recommendation')
  }

  return createValidationReport({
    hardFailureFlags,
    softWarnings,
    validatorVersion: SCENARIO_VALIDATOR_VERSION,
  })
}

function evaluateScenarioRun(params: {
  turns: ScenarioTurnResult[]
  comparison: ScenarioComparison
  validation: OutputQualityValidationReport
}): OutputQualityEvaluationReport {
  if (!params.validation.pass) {
    return {
      pass: false,
      overallScore: 55,
      dimensions: {
        structure: { score: 45, rationale: 'Validation failed on required scenario contract checks.' },
        actionability: { score: 50, rationale: 'At least one probe response was blocked for weak actionability or genericness.' },
        divergence: { score: 45, rationale: 'Turn-level validation detected low or missing divergence.' },
        recommendation: { score: 55, rationale: 'Comparison summary was incomplete or blocked.' },
      },
      strengths: [],
      weaknesses: params.validation.hardFailureFlags,
      repairInstructions: [
        'Regenerate blocked probes with more direct, concrete next actions.',
        'Force alternate branches to diverge materially while keeping the same situation.',
        'Return a concrete recommendation and next action recommendation.',
      ],
      evaluatorSummary: `Scenario validation blocked evaluation: ${params.validation.hardFailureFlags.join(', ')}`,
      evaluatorVersion: SCENARIO_EVALUATOR_VERSION,
      hardFailureFlags: params.validation.hardFailureFlags,
    }
  }

  const baselineScores = params.turns.map((turn) => turn.baselineQuality?.score || 0)
  const alternateScores = params.turns.map((turn) => turn.alternateQuality?.score || 0)
  const divergenceScores = params.turns.map((turn) => turn.divergenceScore || 0)
  const average = (values: number[]) => values.length ? Math.round(values.reduce((sum, value) => sum + value, 0) / values.length) : 0

  const structure = params.validation.pass ? 92 : 45
  const actionability = average([...baselineScores, ...alternateScores])
  const divergence = average(divergenceScores)
  const recommendation = params.comparison.nextActionRecommendation?.trim() && !isWeakNextActionRecommendation(params.comparison.nextActionRecommendation)
    ? Math.max(70, Math.round((params.comparison.qualityScore.alternate + divergence) / 2))
    : 45
  const overallScore = Math.round((structure + actionability + divergence + recommendation) / 4)

  return {
    pass: overallScore >= SCENARIO_GATE_THRESHOLDS.overallScoreMinimum
      && Math.min(structure, actionability, divergence, recommendation) >= SCENARIO_GATE_THRESHOLDS.dimensionFloor,
    overallScore,
    dimensions: {
      structure: { score: structure, rationale: 'All required scenario contract fields are present.' },
      actionability: { score: actionability, rationale: 'Probe responses stayed direct and action-oriented.' },
      divergence: { score: divergence, rationale: 'Alternate branch materially diverged from the baseline.' },
      recommendation: { score: recommendation, rationale: 'Comparison produced a concrete recommendation and next action.' },
    },
    strengths: [
      actionability >= 80 ? 'Probe responses stayed concrete.' : '',
      divergence >= 80 ? 'Alternate branches diverged materially.' : '',
      recommendation >= 80 ? 'Comparison surfaced a concrete next action recommendation.' : '',
    ].filter(Boolean),
    weaknesses: [
      actionability < 75 ? 'Some probe responses were still weakly actionable.' : '',
      divergence < 75 ? 'One or more alternate probes stayed too close to baseline.' : '',
      recommendation < 75 ? 'Comparison guidance was not concrete enough.' : '',
    ].filter(Boolean),
    repairInstructions: [
      'Ask for the exact next reply or exact next action plan, not advice about the reply.',
      'Anchor the alternate branch in one changed assumption and one concrete consequence.',
      'Close the comparison with a direct recommendation and immediate next step.',
    ],
    evaluatorSummary: `Scenario run scored ${overallScore} with actionability ${actionability} and divergence ${divergence}.`,
    evaluatorVersion: SCENARIO_EVALUATOR_VERSION,
  }
}

function buildInterventionDirectives(
  intervention: ScenarioIntervention,
  relationships: AgentRelationship[],
  agentLookup: Map<string, string>,
): string[] {
  const directives: string[] = []

  switch (intervention.type) {
    case 'rewrite_reply':
      directives.push(`Respond in a ${intervention.responseStyle || 'more collaborative'} style than the original path.`)
      directives.push('Change the actual next move, not just the wording or tone.')
      if (intervention.rationale) {
        directives.push(`Keep this rationale in mind: ${intervention.rationale}`)
      }
      break
    case 'emotion_shift':
      directives.push(`Act as if your emotional baseline has shifted toward ${intervention.targetEmotion || 'trust'}.`)
      directives.push(`Let that mood influence caution, empathy, and wording, but stay in character.`)
      break
    case 'relationship_shift': {
      const counterpartName = intervention.counterpartName || agentLookup.get(intervention.counterpartId || '') || 'the other person'
      const matchingRelationship = relationships.find((relationship) =>
        relationship.agentId1 === intervention.counterpartId ||
        relationship.agentId2 === intervention.counterpartId
      )
      if (matchingRelationship) {
        directives.push(`Assume your relationship with ${counterpartName} has changed.`)
        directives.push(`Trust shift: ${(intervention.trustDelta || 0) >= 0 ? '+' : ''}${(intervention.trustDelta || 0).toFixed(2)}, respect shift: ${(intervention.respectDelta || 0) >= 0 ? '+' : ''}${(intervention.respectDelta || 0).toFixed(2)}.`)
      } else {
        directives.push(`Assume you now see ${counterpartName} with a different level of trust and respect.`)
      }
      break
    }
    case 'memory_injection':
      directives.push(`Act as if this memory is vividly available: ${intervention.memoryText || intervention.description}`)
      break
    case 'goal_outcome':
      directives.push(`Assume the goal "${intervention.goal || 'current priority'}" ${intervention.forcedOutcome === 'fails' ? 'has already failed' : 'has already succeeded'}.`)
      break
  }

  return directives
}

function buildScenarioPrompt(params: {
  probePrompt: string
  branchPoint: ScenarioBranchPoint
  intervention?: ScenarioIntervention
  directives?: string[]
  relevantMemoryContext?: string[]
  relationshipContext?: string
  learningPromptContext?: string
}): string {
  const selfHelpBranch = SELF_HELP_BRANCH_PATTERNS.test(params.branchPoint.summary.toLowerCase())
  const sections = [
    `Prompt version: ${SCENARIO_PROMPT_VERSION}.`,
    `Branch point: ${params.branchPoint.title} at ${params.branchPoint.timestamp}.`,
    `Branch summary: ${params.branchPoint.summary}`,
  ]

  if (params.relevantMemoryContext && params.relevantMemoryContext.length > 0) {
    sections.push(`Relevant memories:\n- ${params.relevantMemoryContext.join('\n- ')}`)
  }

  if (params.relationshipContext) {
    sections.push(`Relationship context:\n${params.relationshipContext}`)
  }

  if (params.learningPromptContext) {
    sections.push(`Active learning adaptations:\n${params.learningPromptContext}`)
  }

  if (params.intervention && params.directives && params.directives.length > 0) {
    sections.push(`Alternate branch change:\n- ${params.directives.join('\n- ')}`)
  }

  sections.push(`Task: ${params.probePrompt}`)
  sections.push('Return only the exact next reply or the exact next action plan in the agent voice.')
  sections.push('If the task asks for a reply or message, return the literal sendable message itself, not instructions about what the message should do.')
  sections.push('Keep the same core facts unless the alternate branch explicitly changes them.')
  sections.push('Do not describe what you would say. Do not mention the prompt, branch, or intervention. No stage directions. No generic assistant filler. Include a concrete next step, decision, or recommendation.')
  sections.push('DIVERGENCE RULES: The alternate response must make a materially different move from the baseline. Do not just rephrase the same action in softer or firmer language. Change the actual decision, priority, or action taken. The difference should be visible in what happens next, not just how it is described.')
  sections.push('CONTEXT RULES: Keep action nouns anchored to the branch summary and relevant memories. Do not invent business artifacts, PM tasks, meetings, stakeholders, or needs assessments unless the branch context already mentions them. If the branch is introspective, creative, or relational, keep the action in that same domain.')
  sections.push('ACTIONABILITY RULES: End with one clear, committable action the agent will take. Name a verb, a target, and a timeframe. "Consider exploring options" is not actionable. "Send one rough paragraph to the trusted reader tonight" is.')

  if (params.intervention?.type === 'rewrite_reply' && selfHelpBranch) {
    sections.push('SELF-HELP REWRITE RULE: Make the alternate path choose a different mechanism of change than a default diagnostic reply. If one path would stay internal, make the other path force visible exposure, accountability, or an irreversible commitment.')
  }

  return sections.join('\n\n')
}

function buildProbePrompts(
  agent: AgentRecord,
  branchPoint: ScenarioBranchPoint,
  relationships: AgentRelationship[]
): ScenarioProbeSetEntry[] {
  const primaryGoal = agent.goals[0] || 'stay useful and coherent'
  const mostRelevantRelationship = [...relationships]
    .sort((left, right) => right.metrics.familiarity - left.metrics.familiarity)[0]
  const selfHelpBranch = SELF_HELP_BRANCH_PATTERNS.test(branchPoint.summary.toLowerCase())

  const immediatePrompt = branchPoint.kind === 'message'
    ? `Write the exact next reply to this message: "${branchPoint.summary}". Keep it usable as a sendable message right now.`
    : `Continue from this moment: "${branchPoint.summary}". Write the exact next reply or exact next action plan you would take now.`

  const relationshipPrompt = selfHelpBranch
    ? 'Write the exact next message you would send to the first real person who should see the work, or if no real counterpart is implied, write the exact note you would send yourself to lock the next visible move. Do not invent project-management context.'
    : mostRelevantRelationship
      ? 'Write the exact next message you would send to the person most affected by this branch. Address the relationship directly and move the situation forward.'
      : 'Write the exact next message you would send to repair trust if this branch created tension with another person.'

  return [
    {
      label: 'Immediate continuation',
      prompt: immediatePrompt,
    },
    {
      label: 'Goal pressure test',
      prompt: selfHelpBranch
        ? `You still need to pursue the goal "${primaryGoal}". Write the exact next response or action plan that confronts the avoidance in this branch without inventing PM artifacts, business deliverables, meetings, or stakeholder language.`
        : `You still need to pursue the goal "${primaryGoal}". Write the exact next response or action plan you would actually use under that pressure.`,
    },
    {
      label: 'Relationship pressure test',
      prompt: relationshipPrompt,
    },
  ]
}

function buildFallbackComparison(turns: ScenarioTurnResult[]): ScenarioComparison {
  const firstTurn = turns[0]
  const lastTurn = turns[turns.length - 1]
  const baselineQuality = evaluateResponseQuality(firstTurn?.baselineResponse || '')
  const alternateQuality = evaluateResponseQuality(firstTurn?.alternateResponse || '')
  const diffHighlights = buildDiffHighlights(turns)
  const fallbackNextAction = turns
    .map((turn) => firstActionableSentence(turn.alternateResponse))
    .find((sentence) => !isWeakNextActionRecommendation(sentence))

  return {
    firstDivergence: firstTurn?.divergenceNotes[0] || 'The first alternate answer changed tone and priorities immediately.',
    baselineSummary: normalizeBranchSummary(firstTurn?.baselineResponse || 'Baseline path stayed close to the current agent behavior.', 180),
    alternateSummary: normalizeBranchSummary(firstTurn?.alternateResponse || 'Alternate path introduced a different tone or priority set.', 180),
    keyDifferences: turns.flatMap((turn) => turn.divergenceNotes).slice(0, 6),
    recommendation: 'Use the alternate path if the stronger tradeoffs are intentional; otherwise keep the current path and borrow only the clearer parts.',
    nextActionRecommendation: fallbackNextAction
      ? `If you test the alternate path, start with this next move: ${normalizeBranchSummary(fallbackNextAction, 180)}`
      : '',
    riskNotes: [
      'Scenario runs are simulated and should be treated as decision support, not ground truth.',
      'Different prompts or models can still change the result.',
    ],
    qualityNotes: [
      `Baseline ended with ${lastTurn?.baselineEmotion.dominantEmotion || 'a dormant'} emotional state.`,
      `Alternate ended with ${lastTurn?.alternateEmotion.dominantEmotion || 'a dormant'} emotional state.`,
    ],
    qualityScore: {
      baseline: baselineQuality.total,
      alternate: alternateQuality.total,
    },
    outcomeScore: {
      baseline: turns.reduce((total, turn) => total + scoreResponse(turn.baselineResponse), 0),
      alternate: turns.reduce((total, turn) => total + scoreResponse(turn.alternateResponse), 0),
    },
    qualityBreakdown: {
      baseline: baselineQuality.breakdown,
      alternate: alternateQuality.breakdown,
    },
    qualityFlags: {
      baseline: baselineQuality.flags,
      alternate: alternateQuality.flags,
    },
    diffHighlights,
  }
}

function scoreResponse(response: string): number {
  const lower = response.toLowerCase()
  let score = 50
  if (response.length > 220) score += 8
  if (/\b(plan|next|because|tradeoff|priority|step)\b/.test(lower)) score += 12
  if (/\b(help|support|clarify|coordinate|listen|trust)\b/.test(lower)) score += 10
  if (/\bunsure|maybe|probably|perhaps\b/.test(lower)) score -= 4
  if (/\bcan't|cannot|won't\b/.test(lower)) score -= 3
  return Math.max(0, Math.min(100, score))
}

function evaluateResponseQuality(response: string): {
  total: number
  breakdown: { clarity: number; warmth: number; specificity: number; consistency: number }
  flags: string[]
} {
  const lower = response.toLowerCase()
  const words = lower.split(/\s+/).filter(Boolean)
  const breakdown = {
    clarity: 55,
    warmth: 45,
    specificity: 45,
    consistency: 55,
  }
  const flags: string[] = []

  if (words.length > 35) breakdown.clarity += 8
  if (/\b(next|plan|because|priority|first|second|third)\b/.test(lower)) breakdown.clarity += 12
  if (/\b(let's|together|understand|support|help|appreciate)\b/.test(lower)) breakdown.warmth += 18
  if (/\bfor example|such as|include|1\)|2\)|3\)|1\.|2\.|3\.\b/.test(lower)) breakdown.specificity += 18
  if (/\b(startup|roadmap|team|feature|workflow|milestone|feedback)\b/.test(lower)) breakdown.consistency += 12

  if (/\byou might say|i would say|certainly\.\s+in a warmer tone\b/.test(lower)) {
    flags.push('meta_response')
    breakdown.clarity -= 20
    breakdown.consistency -= 12
  }
  if (/\bsynergy|leverage|seamless|transformative|optimize\b/.test(lower)) {
    flags.push('pm_jargon')
    breakdown.specificity -= 10
  }
  if (words.length < 18) {
    flags.push('too_short')
    breakdown.specificity -= 12
  }
  if (!/\b(next|plan|build|ship|test|design|use|start)\b/.test(lower)) {
    flags.push('low_actionability')
    breakdown.clarity -= 8
  }
  if (/\bmaybe|perhaps|possibly|could\b/.test(lower) && !/\b1\.|2\.|3\./.test(lower)) {
    flags.push('hedgy')
    breakdown.consistency -= 8
  }
  if (/(^|\s)(great|nice|good)\b/.test(lower) && words.length < 30) {
    flags.push('shallow_affect')
    breakdown.warmth -= 6
  }

  const bounded = {
    clarity: Math.max(0, Math.min(100, breakdown.clarity)),
    warmth: Math.max(0, Math.min(100, breakdown.warmth)),
    specificity: Math.max(0, Math.min(100, breakdown.specificity)),
    consistency: Math.max(0, Math.min(100, breakdown.consistency)),
  }

  return {
    total: Math.round((bounded.clarity + bounded.warmth + bounded.specificity + bounded.consistency) / 4),
    breakdown: bounded,
    flags,
  }
}

function firstMeaningfulSentence(value: string): string {
  const pieces = value
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  return pieces[0] || normalizeBranchSummary(value, 180)
}

function firstActionableSentence(value: string): string {
  const pieces = value
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter(Boolean)

  return pieces.find((entry) => hasConcreteScenarioAction(entry))
    || pieces.find((entry) => DIRECT_ACTION_PATTERNS.test(entry))
    || firstMeaningfulSentence(value)
}

function extractPrimaryActionVerb(value: string): string {
  const match = firstActionableSentence(value).toLowerCase().match(DIRECT_ACTION_PATTERNS)
  return match?.[0] || ''
}

function buildCounterpartAvoidanceHints(value: string): string[] {
  return [...new Set([
    firstMeaningfulSentence(value),
    firstActionableSentence(value),
  ].map((entry) => normalizeBranchSummary(entry, 140)).filter(Boolean))]
}

function calculateBranchDivergenceScore(baselineResponse: string, alternateResponse: string): number {
  const responseSimilarity = calculateTextSimilarity(baselineResponse, alternateResponse)
  const openingSimilarity = calculateTextSimilarity(
    firstMeaningfulSentence(baselineResponse),
    firstMeaningfulSentence(alternateResponse)
  )
  const actionSimilarity = calculateTextSimilarity(
    firstActionableSentence(baselineResponse),
    firstActionableSentence(alternateResponse)
  )

  let score = Math.round((1 - (
    responseSimilarity * 0.4
    + openingSimilarity * 0.25
    + actionSimilarity * 0.35
  )) * 100)

  if (extractPrimaryActionVerb(baselineResponse) && extractPrimaryActionVerb(alternateResponse) && extractPrimaryActionVerb(baselineResponse) !== extractPrimaryActionVerb(alternateResponse)) {
    score += 10
  }

  if (firstMeaningfulSentence(baselineResponse).toLowerCase() !== firstMeaningfulSentence(alternateResponse).toLowerCase()) {
    score += 6
  }

  return Math.max(0, Math.min(100, score))
}

function shouldForceScenarioRepair(quality: ScenarioProbeQualityReport, requireDivergence?: boolean) {
  if (!quality.pass) {
    return true
  }

  if (!requireDivergence) {
    return false
  }

  return quality.flags.includes('paraphrase_heavy')
    || quality.flags.includes('branch_point_paraphrase')
    || (quality.similarityToCounterpart ?? 0) >= 0.58
}

function buildDiffHighlights(turns: ScenarioTurnResult[]): Array<{ label: string; baseline: string; alternate: string }> {
  return turns.map((turn) => ({
    label: turn.probeLabel,
    baseline: firstMeaningfulSentence(turn.baselineResponse),
    alternate: firstMeaningfulSentence(turn.alternateResponse),
  }))
}

function extractJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    return null
  }

  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

function normalizeComparisonList(value: unknown): string[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value.map((entry) => {
    if (typeof entry === 'string') {
      return entry
    }

    if (entry && typeof entry === 'object') {
      const candidate = entry as Record<string, unknown>
      if (typeof candidate.text === 'string') {
        return candidate.text
      }
      if (typeof candidate.summary === 'string') {
        return candidate.summary
      }
      return JSON.stringify(candidate)
    }

    return String(entry)
  })
}

async function summarizeComparisonWithModel(params: {
  agent: AgentRecord
  branchPoint: ScenarioBranchPoint
  intervention: ScenarioIntervention
  turns: ScenarioTurnResult[]
  providerInfo?: LLMProviderInfo | null
}): Promise<ScenarioComparison | null> {
  if (!params.providerInfo) {
    return null
  }

  const transcript = params.turns.map((turn) => [
    `Probe: ${turn.probeLabel}`,
    `Prompt: ${turn.probePrompt}`,
    `Baseline: ${turn.baselineResponse}`,
    `Alternate: ${turn.alternateResponse}`,
    `Baseline emotion: ${turn.baselineEmotion.dominantEmotion || 'dormant'}`,
    `Alternate emotion: ${turn.alternateEmotion.dominantEmotion || 'dormant'}`,
  ].join('\n')).join('\n\n')

  try {
    const result = await generateText({
      providerInfo: params.providerInfo,
      temperature: 0.2,
      maxTokens: 500,
      messages: [
        {
          role: 'system',
          content: 'You analyze alternate scenario runs for an AI agent product. Return strict JSON only. Keep language plain, concrete, and focused on user-facing consequences.',
        },
        {
          role: 'user',
          content: [
            `Agent: ${params.agent.name}`,
            `Branch point: ${params.branchPoint.title} | ${params.branchPoint.summary}`,
            `Intervention: ${params.intervention.label} | ${params.intervention.description}`,
            `Transcript:\n${transcript}`,
            'Return JSON with keys: firstDivergence, baselineSummary, alternateSummary, keyDifferences, recommendation, riskNotes, qualityNotes, qualityScore, outcomeScore, qualityBreakdown, qualityFlags, diffHighlights, nextActionRecommendation.',
            'qualityScore and outcomeScore must each be objects with baseline and alternate numbers from 0 to 100.',
            'qualityBreakdown must have baseline and alternate objects with clarity, warmth, specificity, consistency.',
            'qualityFlags must have baseline and alternate string arrays.',
            'diffHighlights must be an array of { label, baseline, alternate }.',
            'recommendation and nextActionRecommendation must each contain one direct concrete sentence with a specific verb, target, and timeframe.',
            'nextActionRecommendation must NOT be a softened restatement of the user message. It must name a specific action to test the alternate path.',
            'keyDifferences must describe actual behavioral forks (different decisions, priorities, tradeoffs), not just tonal variations.',
          ].join('\n\n'),
        },
      ],
    })

    const parsed = extractJsonObject(result.content)
    if (!parsed) {
      return null
    }

    const nextActionRecommendation = String(parsed.nextActionRecommendation || '').trim()

    return {
      firstDivergence: String(parsed.firstDivergence || ''),
      baselineSummary: String(parsed.baselineSummary || ''),
      alternateSummary: String(parsed.alternateSummary || ''),
      keyDifferences: normalizeComparisonList(parsed.keyDifferences),
      recommendation: String(parsed.recommendation || ''),
      riskNotes: normalizeComparisonList(parsed.riskNotes),
      qualityNotes: normalizeComparisonList(parsed.qualityNotes),
      qualityScore: {
        baseline: Number((parsed.qualityScore as Record<string, unknown>)?.baseline || 0),
        alternate: Number((parsed.qualityScore as Record<string, unknown>)?.alternate || 0),
      },
      outcomeScore: {
        baseline: Number((parsed.outcomeScore as Record<string, unknown>)?.baseline || 0),
        alternate: Number((parsed.outcomeScore as Record<string, unknown>)?.alternate || 0),
      },
      qualityBreakdown: {
        baseline: {
          clarity: Number(((parsed.qualityBreakdown as Record<string, unknown>)?.baseline as Record<string, unknown>)?.clarity || 0),
          warmth: Number(((parsed.qualityBreakdown as Record<string, unknown>)?.baseline as Record<string, unknown>)?.warmth || 0),
          specificity: Number(((parsed.qualityBreakdown as Record<string, unknown>)?.baseline as Record<string, unknown>)?.specificity || 0),
          consistency: Number(((parsed.qualityBreakdown as Record<string, unknown>)?.baseline as Record<string, unknown>)?.consistency || 0),
        },
        alternate: {
          clarity: Number(((parsed.qualityBreakdown as Record<string, unknown>)?.alternate as Record<string, unknown>)?.clarity || 0),
          warmth: Number(((parsed.qualityBreakdown as Record<string, unknown>)?.alternate as Record<string, unknown>)?.warmth || 0),
          specificity: Number(((parsed.qualityBreakdown as Record<string, unknown>)?.alternate as Record<string, unknown>)?.specificity || 0),
          consistency: Number(((parsed.qualityBreakdown as Record<string, unknown>)?.alternate as Record<string, unknown>)?.consistency || 0),
        },
      },
      qualityFlags: {
        baseline: normalizeComparisonList((parsed.qualityFlags as Record<string, unknown>)?.baseline),
        alternate: normalizeComparisonList((parsed.qualityFlags as Record<string, unknown>)?.alternate),
      },
      diffHighlights: Array.isArray(parsed.diffHighlights)
        ? parsed.diffHighlights.map((entry) => {
            const candidate = entry as Record<string, unknown>
            return {
              label: String(candidate.label || ''),
              baseline: String(candidate.baseline || ''),
              alternate: String(candidate.alternate || ''),
            }
          })
        : [],
      nextActionRecommendation: isWeakNextActionRecommendation(nextActionRecommendation) ? '' : nextActionRecommendation,
    }
  } catch (error) {
    console.error('Scenario comparison summarization failed:', error)
    return null
  }
}

function mapHistoryMessages(messages: MessageRecord[]): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages.map((message) => ({
    role: message.type === 'user' ? 'user' : 'assistant',
    content: message.content,
  }))
}

function createPlaceholderComparison(): ScenarioComparison {
  return {
    firstDivergence: '',
    baselineSummary: '',
    alternateSummary: '',
    keyDifferences: [],
    recommendation: '',
    riskNotes: [],
    qualityNotes: [],
    qualityScore: {
      baseline: 0,
      alternate: 0,
    },
    outcomeScore: {
      baseline: 0,
      alternate: 0,
    },
    qualityBreakdown: {
      baseline: {
        clarity: 0,
        warmth: 0,
        specificity: 0,
        consistency: 0,
      },
      alternate: {
        clarity: 0,
        warmth: 0,
        specificity: 0,
        consistency: 0,
      },
    },
    qualityFlags: {
      baseline: [],
      alternate: [],
    },
    diffHighlights: [],
    nextActionRecommendation: '',
  }
}

async function generateScenarioBranchResponse(params: {
  agentId: string
  agent: AgentRecord
  probePrompt: string
  prompt: string
  history: Array<{ role: 'user' | 'assistant'; content: string }>
  llmConfig: {
    provider?: string
    model?: string
    temperature: number
    maxTokens: number
  }
  emotionalState: AgentRecord['emotionalState']
  branchPoint: ScenarioBranchPoint
  intervention?: ScenarioIntervention
  directives?: string[]
  relevantMemoryContext?: string[]
  relationshipContext?: string
  learningPromptContext?: string
  counterpartResponse?: string
  requireDivergence?: boolean
}): Promise<{
  response: string
  quality: ScenarioProbeQualityReport
  rawModelOutput: string
}> {
  const agentChain = AgentChain.getInstance(params.agentId)
  const initial = await agentChain.generateResponse(
    params.prompt,
    params.history,
    params.llmConfig,
    {
      emotionalProfile: params.agent.emotionalProfile,
      emotionalState: params.emotionalState,
    }
  )

  let response = normalizeScenarioResponse(initial.response)
  let quality = evaluateScenarioProbeResponse({
    response,
    counterpartResponse: params.counterpartResponse,
    requireDivergence: params.requireDivergence,
    branchPointSummary: params.branchPoint.summary,
  })
  let rawModelOutput = initial.response

  if (shouldForceScenarioRepair(quality, params.requireDivergence)) {
    const repairPrompt = buildScenarioRepairPrompt({
      probePrompt: params.probePrompt,
      priorResponse: response,
      quality,
      branchPoint: params.branchPoint,
      intervention: params.intervention,
      directives: params.directives,
      relevantMemoryContext: params.relevantMemoryContext,
      relationshipContext: params.relationshipContext,
      learningPromptContext: params.learningPromptContext,
      counterpartResponse: params.counterpartResponse,
      requireDivergence: params.requireDivergence,
    })
    const repaired = await agentChain.generateResponse(
      repairPrompt,
      params.history,
      {
        ...params.llmConfig,
        temperature: params.requireDivergence ? 0.28 : 0.2,
      },
      {
        emotionalProfile: params.agent.emotionalProfile,
        emotionalState: params.emotionalState,
      }
    )

    response = normalizeScenarioResponse(repaired.response)
    const repairedQuality = evaluateScenarioProbeResponse({
      response,
      counterpartResponse: params.counterpartResponse,
      requireDivergence: params.requireDivergence,
      branchPointSummary: params.branchPoint.summary,
    })
    quality = {
      ...repairedQuality,
      repairAttempted: true,
      repairSucceeded: repairedQuality.pass,
    }
    rawModelOutput = [initial.response, repaired.response].filter(Boolean).join('\n\n---REPAIR---\n\n')
  }

  return {
    response,
    quality,
    rawModelOutput,
  }
}

function buildScenarioAnalytics(runs: ScenarioRunRecord[]): ScenarioAnalyticsSummary {
  if (runs.length === 0) {
    return {
      totalRuns: 0,
      averageAlternateScore: 0,
      bestInterventions: [],
      commonQualityFlags: [],
      recommendedPlaybook: [],
    }
  }

  const interventionMap = new Map<string, { label: string; wins: number; total: number; gain: number }>()
  const allFlags = new Map<string, number>()

  for (const run of runs) {
    const key = run.intervention.label
    const entry = interventionMap.get(key) || { label: key, wins: 0, total: 0, gain: 0 }
    entry.total += 1
    const gain = run.comparison.outcomeScore.alternate - run.comparison.outcomeScore.baseline
    entry.gain += gain
    if (gain > 0) {
      entry.wins += 1
    }
    interventionMap.set(key, entry)

    for (const flag of [...run.comparison.qualityFlags.baseline, ...run.comparison.qualityFlags.alternate]) {
      allFlags.set(flag, (allFlags.get(flag) || 0) + 1)
    }
  }

  const bestInterventions = [...interventionMap.values()]
    .map((entry) => ({
      label: entry.label,
      winRate: Number((entry.wins / entry.total).toFixed(2)),
      averageGain: Number((entry.gain / entry.total).toFixed(1)),
    }))
    .sort((left, right) => right.averageGain - left.averageGain)
    .slice(0, 3)

  const commonQualityFlags = [...allFlags.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, 4)
    .map(([flag]) => flag)

  const recommendedPlaybook = [
    bestInterventions[0] ? `Best recent intervention: ${bestInterventions[0].label} (${bestInterventions[0].averageGain} average score gain).` : null,
    commonQualityFlags.includes('pm_jargon') ? 'Watch for vague product jargon and push for more concrete language.' : null,
    commonQualityFlags.includes('low_actionability') ? 'When a branch is too abstract, add stronger next-step pressure in the intervention.' : null,
    (commonQualityFlags.includes('meta_response') || commonQualityFlags.includes('generic_meta_advice'))
      ? 'Keep prompts asking for the exact reply, not commentary about the reply.'
      : null,
  ].filter(Boolean) as string[]

  return {
    totalRuns: runs.length,
    averageAlternateScore: Number((runs.reduce((total, run) => total + run.comparison.outcomeScore.alternate, 0) / runs.length).toFixed(1)),
    bestInterventions,
    commonQualityFlags,
    recommendedPlaybook,
  }
}

export class ScenarioService {
  static getScenarioTemplates(agent: AgentRecord, relationships: AgentRelationship[]) {
    const closestRelationship = [...relationships]
      .sort((left, right) => right.metrics.familiarity - left.metrics.familiarity)[0]

    return [
      {
        type: 'rewrite_reply' as const,
        label: 'Rewrite The Next Reply',
        description: 'Keep the same facts but change the next response style.',
        responseStyle: 'warmer' as const,
        rationale: 'Use more warmth and clarity without losing the agent voice.',
      },
      {
        type: 'emotion_shift' as const,
        label: 'Shift Emotional Baseline',
        description: 'Re-run the branch with a new dominant mood.',
        targetEmotion: 'trust' as EmotionType,
        emotionIntensity: 'medium' as const,
      },
      {
        type: 'memory_injection' as const,
        label: 'Inject A Memory',
        description: 'Pretend the agent vividly remembers one extra fact while responding.',
        memoryText: `${agent.name} clearly remembers a previous successful collaboration and wants to preserve it.`,
      },
      {
        type: 'goal_outcome' as const,
        label: 'Flip Goal Outcome',
        description: 'Assume one active goal already succeeded or failed, then continue forward.',
        goal: agent.goals[0] || 'current goal',
        forcedOutcome: 'succeeds' as const,
      },
      {
        type: 'relationship_shift' as const,
        label: 'Shift A Relationship',
        description: 'Run the branch with a higher or lower trust level toward one counterpart.',
        counterpartId: closestRelationship?.agentId1 === agent.id ? closestRelationship?.agentId2 : closestRelationship?.agentId1,
        counterpartName: closestRelationship ? 'Closest counterpart' : undefined,
        trustDelta: 0.18,
        respectDelta: 0.08,
      },
    ]
  }

  static async listScenarioRuns(agentId: string, limitCount = 12): Promise<ScenarioRunRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return (await ScenarioRunRepository.listByAgent(agentId, limitCount)).map(normalizeScenarioRun)
      }

      return (await listScenarioRunsByAgentFromFirestore(agentId, limitCount)).map(normalizeScenarioRun)
    } catch (error) {
      console.error('Error listing scenario runs:', error)
      return []
    }
  }

  static async getScenarioRunById(id: string): Promise<ScenarioRunRecord | null> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        const record = await ScenarioRunRepository.getById(id)
        return record ? normalizeScenarioRun(record) : null
      }

      const record = await getScenarioRunByIdFromFirestore(id)
      return record ? normalizeScenarioRun(record) : null
    } catch (error) {
      console.error('Error fetching scenario run:', error)
      return null
    }
  }

  static async getScenarioLabBootstrap(agentId: string): Promise<{
    branchPoints: ScenarioBranchPoint[]
    templates: ReturnType<typeof ScenarioService.getScenarioTemplates>
    recentRuns: ScenarioRunRecord[]
    analytics: ScenarioAnalyticsSummary
  } | null> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return null
    }

    const [messages, memories, relationships, recentRuns, simulations, allAgents] = await Promise.all([
      MessageService.getMessagesByAgentId(agentId),
      MemoryService.getAllMemoriesForAgent(agentId),
      listRelationshipsForAgent(agentId),
      this.listScenarioRuns(agentId, 6),
      SimulationService.getSimulationsByAgent(agentId),
      AgentService.getAllAgents(),
    ])

    const agentLookup = new Map(allAgents.map((entry) => [entry.id, entry.name]))

    return {
      branchPoints: deriveBranchPoints(messages, memories, relationships, agentLookup, agentId, simulations),
      templates: this.getScenarioTemplates(agent, relationships),
      recentRuns,
      analytics: buildScenarioAnalytics(recentRuns),
    }
  }

  static async runScenario(params: {
    agentId: string
    branchPointId: string
    branchPointKind: ScenarioBranchPointKind
    intervention: ScenarioIntervention
    maxTurns?: number
    providerInfo?: LLMProviderInfo | null
  }): Promise<ScenarioRunRecord> {
    const agent = await AgentService.getAgentById(params.agentId)
    if (!agent) {
      throw new Error(`Agent ${params.agentId} not found`)
    }

    const [messages, memories, relationships, allAgents, simulations, learningState, learningPromptContext] = await Promise.all([
      MessageService.getMessagesByAgentId(params.agentId),
      MemoryService.getAllMemoriesForAgent(params.agentId),
      listRelationshipsForAgent(params.agentId),
      AgentService.getAllAgents(),
      SimulationService.getSimulationsByAgent(params.agentId),
      LearningService.getLearningState(params.agentId),
      LearningService.getPromptContext(params.agentId),
    ])

    const agentLookup = new Map(allAgents.map((entry) => [entry.id, entry.name]))
    const branchPoints = deriveBranchPoints(messages, memories, relationships, agentLookup, params.agentId, simulations)
    const branchPoint = branchPoints.find((point) =>
      point.id === params.branchPointId && point.kind === params.branchPointKind
    )

    if (!branchPoint) {
      throw new Error('Branch point not found')
    }

    const recalledMemories = await MemoryService.recallMemories(
      params.agentId,
      `${branchPoint.title} ${branchPoint.summary} ${params.intervention.label} ${params.intervention.description}`,
      6
    )

    const maxTurns = Math.max(DEFAULT_MAX_TURNS, Math.min(params.maxTurns || DEFAULT_MAX_TURNS, 4))
    const recentMessages = messages
      .filter((message) => new Date(message.timestamp).getTime() <= new Date(branchPoint.timestamp).getTime())
      .slice(-6)
    const relevantEpisodeMemories = memories
      .filter((memory) => new Date(memory.timestamp).getTime() <= new Date(branchPoint.timestamp).getTime())
      .sort((left, right) => right.importance - left.importance)
      .slice(0, 4)
    const semanticMemories = recalledMemories
      .filter((memory) => memory.hitType === 'semantic')
      .slice(0, 4)
      .map((memory) => ({
        id: memory.memory.id,
        type: memory.memory.type,
        summary: memory.memory.summary || memory.memory.content,
        canonicalValue: memory.memory.canonicalValue,
        confidence: memory.memory.confidence,
        reason: memory.reasons[0] || 'Matched scenario context.',
      }))
    const relevantMemories = [
      ...semanticMemories.map((memory) => ({
        id: memory.id,
        summary: memory.summary,
        importance: 9,
        timestamp: memories.find((entry) => entry.id === memory.id)?.timestamp || branchPoint.timestamp,
        type: memory.type,
        hitType: 'semantic' as const,
        canonicalValue: memory.canonicalValue,
      })),
      ...relevantEpisodeMemories.map((memory) => ({
        id: memory.id,
        summary: memory.summary,
        importance: memory.importance,
        timestamp: memory.timestamp,
        type: memory.type,
        hitType: 'episode' as const,
        canonicalValue: memory.canonicalValue,
      })),
    ].slice(0, 6)
    const activeAdaptations: LearningAdaptation[] = learningState?.state.recentAdaptations
      ?.filter((adaptation) => adaptation.isActive)
      .slice(0, 3) || []
    const primaryRelationship = [...relationships]
      .sort((left, right) => right.metrics.familiarity - left.metrics.familiarity)[0]

    const relationshipSummary = primaryRelationship
      ? relationshipService.getRelationshipContext(
          primaryRelationship,
          agentLookup.get(primaryRelationship.agentId1 === agent.id ? primaryRelationship.agentId2 : primaryRelationship.agentId1) || 'counterpart'
        )
      : undefined

    const directives = buildInterventionDirectives(params.intervention, relationships, agentLookup)
    const baselineState = emotionalService.normalizeEmotionalState(agent.emotionalState)
    const alternateState = params.intervention.type === 'emotion_shift' && params.intervention.targetEmotion
      ? applyEmotionShift(agent.emotionalState, params.intervention.targetEmotion, getIntensityValue(params.intervention.emotionIntensity))
      : emotionalService.normalizeEmotionalState(agent.emotionalState)

    const now = new Date().toISOString()
    const sourceRefs = buildScenarioSourceRefs({
      branchPoint,
      relevantMemories,
      semanticMemories,
      learningAdaptations: activeAdaptations.map((adaptation) => ({
        id: adaptation.id,
        description: adaptation.description,
        instruction: adaptation.instruction,
        confidence: adaptation.confidence,
        impactScore: adaptation.impactScore,
      })),
    })
    const draftRecord: ScenarioRunRecord = {
      id: generateId('scenario'),
      agentId: agent.id,
      agentName: agent.name,
      status: 'running',
      qualityStatus: 'pending',
      promptVersion: SCENARIO_PROMPT_VERSION,
      rawModelOutput: createRawModelOutput('', {
        capturedAt: now,
        promptVersion: SCENARIO_PROMPT_VERSION,
        responseFormat: 'scenario_run',
      }),
      sourceRefs,
      branchPoint,
      intervention: params.intervention,
      probeSet: [],
      branchContext: {
        recentMessages: recentMessages.map((message) => ({
          id: message.id,
          role: message.type === 'user' ? 'user' : 'assistant',
          content: message.content,
          timestamp: message.timestamp,
        })),
        relevantMemories,
        semanticMemories,
        learningAdaptations: activeAdaptations.map((adaptation) => ({
          id: adaptation.id,
          description: adaptation.description,
          instruction: adaptation.instruction,
          confidence: adaptation.confidence,
          impactScore: adaptation.impactScore,
        })),
        relationshipSummary: relationshipSummary ? normalizeBranchSummary(relationshipSummary, 320) : undefined,
        learningPromptContext,
      },
      baselineState: {
        emotionalState: baselineState,
        dominantEmotion: baselineState.dominantEmotion,
      },
      alternateState: {
        emotionalState: alternateState,
        dominantEmotion: alternateState.dominantEmotion,
        injectedContext: directives,
      },
      turns: [],
      comparison: createPlaceholderComparison(),
      metadata: {
        provider: params.providerInfo?.provider,
        model: params.providerInfo?.model,
        maxTurns,
        generatedAt: now,
      },
      createdAt: now,
      updatedAt: now,
    }

    await this.upsertScenarioRun(draftRecord)

    const probes = buildProbePrompts(agent, branchPoint, relationships).slice(0, maxTurns)
    const memoryContext = relevantMemories.map((memory) => memory.canonicalValue || memory.summary)
    const baselineHistory = mapHistoryMessages(recentMessages)
    const alternateHistory = mapHistoryMessages(recentMessages)
    let workingBaselineAgent: AgentRecord = {
      ...agent,
      emotionalState: baselineState,
      emotionalHistory: agent.emotionalHistory || [],
    }
    let workingAlternateAgent: AgentRecord = {
      ...agent,
      emotionalState: alternateState,
      emotionalHistory: agent.emotionalHistory || [],
    }

    const llmConfig = {
      provider: params.providerInfo?.provider,
      model: params.providerInfo?.model,
      temperature: 0.3,
      maxTokens: 420,
    }

    const turns: ScenarioTurnResult[] = []
    const rawOutputs: string[] = []

    for (const probe of probes) {
      const baselinePrompt = buildScenarioPrompt({
        probePrompt: probe.prompt,
        branchPoint,
        relevantMemoryContext: memoryContext,
        relationshipContext: relationshipSummary,
        learningPromptContext,
      })

      const alternatePrompt = buildScenarioPrompt({
        probePrompt: probe.prompt,
        branchPoint,
        intervention: params.intervention,
        directives,
        relevantMemoryContext: memoryContext,
        relationshipContext: relationshipSummary,
        learningPromptContext,
      })

      const baselineResponse = await generateScenarioBranchResponse({
        agentId: agent.id,
        agent,
        probePrompt: probe.prompt,
        prompt: baselinePrompt,
        history: baselineHistory,
        llmConfig,
        emotionalState: workingBaselineAgent.emotionalState,
        branchPoint,
        relevantMemoryContext: memoryContext,
        relationshipContext: relationshipSummary,
        learningPromptContext,
      })

      const alternateResponse = await generateScenarioBranchResponse({
        agentId: agent.id,
        agent,
        probePrompt: probe.prompt,
        prompt: alternatePrompt,
        history: alternateHistory,
        llmConfig,
        emotionalState: workingAlternateAgent.emotionalState,
        branchPoint,
        intervention: params.intervention,
        directives,
        relevantMemoryContext: memoryContext,
        relationshipContext: relationshipSummary,
        learningPromptContext,
        counterpartResponse: baselineResponse.response,
        requireDivergence: true,
      })

      rawOutputs.push([
        `Probe ${probe.label} baseline:\n${baselineResponse.rawModelOutput}`,
        `Probe ${probe.label} alternate:\n${alternateResponse.rawModelOutput}`,
      ].join('\n\n'))

      const baselineQuality = evaluateScenarioProbeResponse({
        response: baselineResponse.response,
        counterpartResponse: alternateResponse.response,
        branchPointSummary: branchPoint.summary,
      })
      const alternateQuality = evaluateScenarioProbeResponse({
        response: alternateResponse.response,
        counterpartResponse: baselineResponse.response,
        requireDivergence: true,
        branchPointSummary: branchPoint.summary,
      })
      const divergenceScore = calculateBranchDivergenceScore(baselineResponse.response, alternateResponse.response)
      const materiallyDifferent = divergenceScore >= 60 && baselineResponse.response !== alternateResponse.response

      const baselineAppraisal = emotionalService.appraiseConversationTurn({
        agent: workingBaselineAgent,
        userMessage: baselinePrompt,
        recentMessages: baselineHistory,
      })
      const baselineFinal = await emotionalService.finalizeConversationTurn({
        agent: workingBaselineAgent,
        userMessage: baselinePrompt,
        agentResponse: baselineResponse.response,
        provisionalState: baselineAppraisal.emotionalState,
        emotionalHistory: baselineAppraisal.emotionalHistory,
        providerInfo: null,
        shouldReflect: false,
      })

      const alternateAppraisal = emotionalService.appraiseConversationTurn({
        agent: workingAlternateAgent,
        userMessage: alternatePrompt,
        recentMessages: alternateHistory,
      })
      const alternateFinal = await emotionalService.finalizeConversationTurn({
        agent: workingAlternateAgent,
        userMessage: alternatePrompt,
        agentResponse: alternateResponse.response,
        provisionalState: alternateAppraisal.emotionalState,
        emotionalHistory: alternateAppraisal.emotionalHistory,
        providerInfo: null,
        shouldReflect: false,
      })

      workingBaselineAgent = {
        ...workingBaselineAgent,
        emotionalState: baselineFinal.emotionalState,
        emotionalHistory: baselineFinal.emotionalHistory,
      }
      workingAlternateAgent = {
        ...workingAlternateAgent,
        emotionalState: alternateFinal.emotionalState,
        emotionalHistory: alternateFinal.emotionalHistory,
      }

      baselineHistory.push({ role: 'user', content: baselinePrompt })
      baselineHistory.push({ role: 'assistant', content: baselineResponse.response })
      alternateHistory.push({ role: 'user', content: alternatePrompt })
      alternateHistory.push({ role: 'assistant', content: alternateResponse.response })

      const divergenceNotes = materiallyDifferent
        ? ['The alternate branch materially changed the next move, priorities, or framing.']
        : ['Baseline and alternate stayed too close on this probe and weakened the scenario contrast.']

      if (baselineFinal.emotionalState.dominantEmotion !== alternateFinal.emotionalState.dominantEmotion) {
        divergenceNotes.push(`Dominant emotion shifted from ${baselineFinal.emotionalState.dominantEmotion || 'dormant'} to ${alternateFinal.emotionalState.dominantEmotion || 'dormant'}.`)
      }

      divergenceNotes.push(scenarioQualityNotes('Baseline quality', baselineQuality))
      divergenceNotes.push(scenarioQualityNotes('Alternate quality', alternateQuality))

      turns.push({
        id: generateId('scenario_turn'),
        probeLabel: probe.label,
        probePrompt: probe.prompt,
        baselineResponse: baselineResponse.response,
        alternateResponse: alternateResponse.response,
        baselineQuality,
        alternateQuality,
        qualityFlags: [...new Set([
          ...baselineQuality.flags,
          ...alternateQuality.flags,
          ...(materiallyDifferent ? [] : ['low_divergence']),
        ])],
        baselineEmotion: baselineFinal.emotionalState,
        alternateEmotion: alternateFinal.emotionalState,
        divergenceNotes,
        divergenceScore,
        materiallyDifferent,
        repair: {
          attempted: Boolean(baselineQuality.repairAttempted || alternateQuality.repairAttempted),
          repairedResponses: [
            ...(baselineQuality.repairAttempted ? ['baseline' as const] : []),
            ...(alternateQuality.repairAttempted ? ['alternate' as const] : []),
          ],
          notes: [
            ...(baselineQuality.repairAttempted ? ['Baseline branch regenerated once due to low-quality output.'] : []),
            ...(alternateQuality.repairAttempted ? ['Alternate branch regenerated once due to low-quality or low-divergence output.'] : []),
          ],
        },
      })
    }

    const fallbackComparison = buildFallbackComparison(turns)
    const comparison = await summarizeComparisonWithModel({
      agent,
      branchPoint,
      intervention: params.intervention,
      turns,
      providerInfo: params.providerInfo,
    }) || fallbackComparison
    comparison.baselineSummary = comparison.baselineSummary.trim() || fallbackComparison.baselineSummary
    comparison.alternateSummary = comparison.alternateSummary.trim() || fallbackComparison.alternateSummary
    comparison.recommendation = comparison.recommendation.trim() || fallbackComparison.recommendation
    comparison.nextActionRecommendation = comparison.nextActionRecommendation?.trim()
      ? comparison.nextActionRecommendation
      : fallbackComparison.nextActionRecommendation
    comparison.qualityFlags = {
      baseline: turns.flatMap((turn) => turn.baselineQuality?.flags || []).slice(0, 8),
      alternate: turns.flatMap((turn) => turn.alternateQuality?.flags || []).slice(0, 8),
    }
    comparison.qualityNotes = [
      ...comparison.qualityNotes,
      ...turns.map((turn) => (
        turn.materiallyDifferent === false
          ? `${turn.probeLabel}: alternate stayed too close to baseline.`
          : `${turn.probeLabel}: alternate branch diverged cleanly.`
      )),
    ].slice(0, 8)

    const validation = createScenarioRunValidation({
      turns,
      comparison,
      sourceRefs,
    })
    const evaluation = evaluateScenarioRun({
      turns,
      comparison,
      validation,
    })
    const gate = applyFinalQualityGate({
      validation,
      evaluation,
      thresholds: SCENARIO_GATE_THRESHOLDS,
      extraHardFailureFlags: [],
    })
    const failureReason = gate.pass
      ? undefined
      : [
          evaluation.evaluatorSummary,
          ...validation.hardFailureFlags,
          ...gate.blockerReasons,
        ].filter(Boolean).join(' | ')

    const completedRecord: ScenarioRunRecord = {
      ...draftRecord,
      status: gate.pass ? 'complete' : 'failed',
      qualityStatus: gate.qualityStatus,
      qualityScore: evaluation.overallScore,
      failureReason,
      probeSet: probes,
      alternateState: {
        ...draftRecord.alternateState,
        emotionalState: workingAlternateAgent.emotionalState || draftRecord.alternateState.emotionalState,
        dominantEmotion: workingAlternateAgent.emotionalState?.dominantEmotion || draftRecord.alternateState.dominantEmotion,
      },
      baselineState: {
        emotionalState: workingBaselineAgent.emotionalState || draftRecord.baselineState.emotionalState,
        dominantEmotion: workingBaselineAgent.emotionalState?.dominantEmotion || draftRecord.baselineState.dominantEmotion,
      },
      turns,
      comparison,
      rawModelOutput: createRawModelOutput(rawOutputs.join('\n\n====\n\n'), {
        capturedAt: new Date().toISOString(),
        promptVersion: SCENARIO_PROMPT_VERSION,
        responseFormat: 'scenario_run',
      }),
      validation,
      evaluation,
      updatedAt: new Date().toISOString(),
    }

    await this.upsertScenarioRun(completedRecord)
    if (!gate.pass) {
      const runId = completedRecord.id
      await LearningService.recordQualityObservation({
        agentId: params.agentId,
        feature: 'scenario',
        description: `Scenario run ${runId} was blocked by validation or evaluation.`,
        blockerReasons: [
          ...validation.hardFailureFlags,
          ...gate.blockerReasons,
        ],
        evidenceRefs: [runId],
        rawExcerpt: completedRecord.rawModelOutput?.text,
        outputExcerpt: completedRecord.comparison.recommendation || completedRecord.failureReason,
        qualityScore: evaluation.overallScore,
        category: 'problem_solving',
        candidateAdaptations: [
          'Regenerate branches with more concrete next actions and clearer divergence.',
          'Avoid generic meta-advice in scenario probe responses.',
        ],
      })
    }
    return completedRecord
  }

  static async upsertScenarioRun(record: ScenarioRunRecord): Promise<void> {
    const mode = getPersistenceMode()

    if (mode === 'firestore') {
      await upsertScenarioRunInFirestore(record)
      return
    }

    if (mode === 'dual-write-firestore-read') {
      await runMirroredWrite({
        entityType: 'scenario_run',
        entityId: record.id,
        operation: 'upsert',
        payload: scenarioRunToFirestoreDoc(record),
        primary: async () => {
          await upsertScenarioRunInFirestore(record)
          return true
        },
        secondary: async () => {
          await ScenarioRunRepository.upsert(record)
        },
      })
      return
    }

    await runMirroredWrite({
      entityType: 'scenario_run',
      entityId: record.id,
      operation: 'upsert',
      payload: scenarioRunToFirestoreDoc(record),
      primary: async () => {
        await ScenarioRunRepository.upsert(record)
        return true
      },
      secondary: mode === 'dual-write-postgres-read'
        ? async () => {
            await upsertScenarioRunInFirestore(record)
          }
        : undefined,
    })
  }
}
