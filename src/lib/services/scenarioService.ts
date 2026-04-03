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
import { MessageService } from './messageService'
import { MemoryService } from './memoryService'
import { SimulationService } from './simulationService'
import { emotionalService } from './emotionalService'
import { relationshipService } from './relationshipService'
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
  ScenarioRunRecord,
  ScenarioTurnResult,
} from '@/types/database'

const SCENARIO_RUNS_COLLECTION = 'scenario_runs'
const DEFAULT_MAX_TURNS = 3

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
    branchPoint: record.branchPoint,
    intervention: record.intervention,
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
  }
}

function normalizeScenarioRun(record: ScenarioRunRecord): ScenarioRunRecord {
  return {
    ...record,
    comparison: normalizeScenarioComparison(record.comparison),
  }
}

function firestoreDocToScenarioRun(docSnap: { id: string; data: () => Record<string, unknown> }): ScenarioRunRecord {
  const data = docSnap.data()
  return normalizeScenarioRun({
    id: docSnap.id,
    agentId: data.agentId as string,
    agentName: data.agentName as string,
    status: data.status as ScenarioRunRecord['status'],
    branchPoint: data.branchPoint as ScenarioRunRecord['branchPoint'],
    intervention: data.intervention as ScenarioRunRecord['intervention'],
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

function buildInterventionDirectives(
  intervention: ScenarioIntervention,
  relationships: AgentRelationship[],
  agentLookup: Map<string, string>,
): string[] {
  const directives: string[] = []

  switch (intervention.type) {
    case 'rewrite_reply':
      directives.push(`Respond in a ${intervention.responseStyle || 'more collaborative'} style than the original path.`)
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
}): string {
  const sections = [
    `Branch point: ${params.branchPoint.title} at ${params.branchPoint.timestamp}.`,
    `Branch summary: ${params.branchPoint.summary}`,
  ]

  if (params.relevantMemoryContext && params.relevantMemoryContext.length > 0) {
    sections.push(`Relevant memories:\n- ${params.relevantMemoryContext.join('\n- ')}`)
  }

  if (params.relationshipContext) {
    sections.push(`Relationship context:\n${params.relationshipContext}`)
  }

  if (params.intervention && params.directives && params.directives.length > 0) {
    sections.push(`Scenario assumption:\n- ${params.directives.join('\n- ')}`)
  }

  sections.push(`Task: ${params.probePrompt}`)
  sections.push('Respond as the agent directly. Do not describe what you would say. Do not write stage directions. Avoid filler, keep the answer concrete, and include at least one specific next step, decision, or recommendation.')

  return sections.join('\n\n')
}

function buildProbePrompts(
  agent: AgentRecord,
  branchPoint: ScenarioBranchPoint,
  relationships: AgentRelationship[]
): Array<{ label: string; prompt: string }> {
  const primaryGoal = agent.goals[0] || 'stay useful and coherent'
  const mostRelevantRelationship = [...relationships]
    .sort((left, right) => right.metrics.familiarity - left.metrics.familiarity)[0]

  const immediatePrompt = branchPoint.kind === 'message'
    ? `Reply directly to this branch point message: "${branchPoint.summary}". Write the exact next reply in the agent voice.`
    : `Continue from this remembered event: "${branchPoint.summary}". Write the exact next reply or action statement in the agent voice.`

  const relationshipPrompt = mostRelevantRelationship
    ? 'Write the next message you would send to the person most affected by this branch. Show how you would handle the relationship directly.'
    : 'Write the exact message you would send to rebuild trust if this branch created tension with another person.'

  return [
    {
      label: 'Immediate continuation',
      prompt: immediatePrompt,
    },
    {
      label: 'Goal pressure test',
      prompt: `You still need to pursue the goal "${primaryGoal}". Write the next response or action plan you would actually give under that pressure.`,
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

  return {
    firstDivergence: firstTurn?.divergenceNotes[0] || 'The first alternate answer changed tone and priorities immediately.',
    baselineSummary: normalizeBranchSummary(firstTurn?.baselineResponse || 'Baseline path stayed close to the current agent behavior.', 180),
    alternateSummary: normalizeBranchSummary(firstTurn?.alternateResponse || 'Alternate path introduced a different tone or priority set.', 180),
    keyDifferences: turns.flatMap((turn) => turn.divergenceNotes).slice(0, 6),
    recommendation: 'Use the alternate path if the stronger tradeoffs are intentional; otherwise keep the current path and borrow only the clearer parts.',
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
          content: 'You analyze alternate scenario runs for an AI agent product. Return strict JSON only. Keep language plain and concrete.',
        },
        {
          role: 'user',
          content: [
            `Agent: ${params.agent.name}`,
            `Branch point: ${params.branchPoint.title} | ${params.branchPoint.summary}`,
            `Intervention: ${params.intervention.label} | ${params.intervention.description}`,
            `Transcript:\n${transcript}`,
            'Return JSON with keys: firstDivergence, baselineSummary, alternateSummary, keyDifferences, recommendation, riskNotes, qualityNotes, qualityScore, outcomeScore, qualityBreakdown, qualityFlags, diffHighlights.',
            'qualityScore and outcomeScore must each be objects with baseline and alternate numbers from 0 to 100.',
            'qualityBreakdown must have baseline and alternate objects with clarity, warmth, specificity, consistency.',
            'qualityFlags must have baseline and alternate string arrays.',
            'diffHighlights must be an array of { label, baseline, alternate }.',
          ].join('\n\n'),
        },
      ],
    })

    const parsed = extractJsonObject(result.content)
    if (!parsed) {
      return null
    }

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
    commonQualityFlags.includes('meta_response') ? 'Keep prompts asking for the exact reply, not commentary about the reply.' : null,
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

    const [messages, memories, relationships, allAgents, simulations] = await Promise.all([
      MessageService.getMessagesByAgentId(params.agentId),
      MemoryService.getAllMemoriesForAgent(params.agentId),
      listRelationshipsForAgent(params.agentId),
      AgentService.getAllAgents(),
      SimulationService.getSimulationsByAgent(params.agentId),
    ])

    const agentLookup = new Map(allAgents.map((entry) => [entry.id, entry.name]))
    const branchPoints = deriveBranchPoints(messages, memories, relationships, agentLookup, params.agentId, simulations)
    const branchPoint = branchPoints.find((point) =>
      point.id === params.branchPointId && point.kind === params.branchPointKind
    )

    if (!branchPoint) {
      throw new Error('Branch point not found')
    }

    const maxTurns = Math.max(1, Math.min(params.maxTurns || DEFAULT_MAX_TURNS, 4))
    const recentMessages = messages
      .filter((message) => new Date(message.timestamp).getTime() <= new Date(branchPoint.timestamp).getTime())
      .slice(-6)
    const relevantMemories = memories
      .filter((memory) => new Date(memory.timestamp).getTime() <= new Date(branchPoint.timestamp).getTime())
      .sort((left, right) => right.importance - left.importance)
      .slice(0, 4)
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
    const draftRecord: ScenarioRunRecord = {
      id: generateId('scenario'),
      agentId: agent.id,
      agentName: agent.name,
      status: 'running',
      branchPoint,
      intervention: params.intervention,
      branchContext: {
        recentMessages: recentMessages.map((message) => ({
          id: message.id,
          role: message.type === 'user' ? 'user' : 'assistant',
          content: message.content,
          timestamp: message.timestamp,
        })),
        relevantMemories: relevantMemories.map((memory) => ({
          id: memory.id,
          summary: memory.summary,
          importance: memory.importance,
          timestamp: memory.timestamp,
        })),
        relationshipSummary: relationshipSummary ? normalizeBranchSummary(relationshipSummary, 320) : undefined,
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
    const memoryContext = relevantMemories.map((memory) => memory.summary)
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

    for (const probe of probes) {
      const baselinePrompt = buildScenarioPrompt({
        probePrompt: probe.prompt,
        branchPoint,
        relevantMemoryContext: memoryContext,
        relationshipContext: relationshipSummary,
      })

      const alternatePrompt = buildScenarioPrompt({
        probePrompt: probe.prompt,
        branchPoint,
        intervention: params.intervention,
        directives,
        relevantMemoryContext: memoryContext,
        relationshipContext: relationshipSummary,
      })

      const baselineResponse = await AgentChain.getInstance(agent.id).generateResponse(
        baselinePrompt,
        baselineHistory,
        llmConfig,
        {
          emotionalProfile: agent.emotionalProfile,
          emotionalState: workingBaselineAgent.emotionalState,
        }
      )

      const alternateResponse = await AgentChain.getInstance(agent.id).generateResponse(
        alternatePrompt,
        alternateHistory,
        llmConfig,
        {
          emotionalProfile: agent.emotionalProfile,
          emotionalState: workingAlternateAgent.emotionalState,
        }
      )

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

      const divergenceNotes = [
        baselineResponse.response === alternateResponse.response
          ? 'Both branches stayed very close on this probe.'
          : 'The alternate branch changed wording, priorities, or confidence.',
      ]

      if (baselineFinal.emotionalState.dominantEmotion !== alternateFinal.emotionalState.dominantEmotion) {
        divergenceNotes.push(`Dominant emotion shifted from ${baselineFinal.emotionalState.dominantEmotion || 'dormant'} to ${alternateFinal.emotionalState.dominantEmotion || 'dormant'}.`)
      }

      turns.push({
        id: generateId('scenario_turn'),
        probeLabel: probe.label,
        probePrompt: probe.prompt,
        baselineResponse: baselineResponse.response,
        alternateResponse: alternateResponse.response,
        baselineEmotion: baselineFinal.emotionalState,
        alternateEmotion: alternateFinal.emotionalState,
        divergenceNotes,
      })
    }

    const comparison = await summarizeComparisonWithModel({
      agent,
      branchPoint,
      intervention: params.intervention,
      turns,
      providerInfo: params.providerInfo,
    }) || buildFallbackComparison(turns)

    const completedRecord: ScenarioRunRecord = {
      ...draftRecord,
      status: 'complete',
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
      updatedAt: new Date().toISOString(),
    }

    await this.upsertScenarioRun(completedRecord)
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
