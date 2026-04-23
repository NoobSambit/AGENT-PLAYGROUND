import {
  doc,
  getDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { generateId } from '@/lib/db/utils'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { ArenaRepository } from '@/lib/repositories/arenaRepository'
import {
  getArenaRunFromFirestore,
  listArenaEventsFromFirestore,
  listArenaRunSummariesFromFirestore,
  writeArenaEventToFirestore,
  writeArenaRunToFirestore,
} from '@/lib/arena/firestoreStore'
import { resolveProviderInfoModel } from '@/lib/llm/ollama'
import { AgentService } from '@/lib/services/agentService'
import { relationshipOrchestrator } from '@/lib/services/relationshipOrchestrator'
import { generateText } from '@/lib/llm/provider'
import type { LLMProviderInfo } from '@/lib/llmConfig'
import { detectTextLeakage } from '@/lib/services/outputQuality/flags'
import {
  normalizeStringList,
  normalizeWhitespace,
  safeParseJsonWithExtraction,
} from '@/lib/services/outputQuality/normalizers'
import type {
  AgentRecord,
  ArenaEvent,
  ArenaParticipant,
  ArenaParticipantNotebook,
  ArenaReport,
  ArenaResponseBudget,
  ArenaRun,
  ArenaRunSummary,
  ArenaScorecard,
  ArenaSeat,
  ArenaSeatOverride,
  ArenaStage,
} from '@/types/database'

const ARENA_COLLECTION = 'arena_runs'
const MIN_ARENA_ROUNDS = 10
const MAX_ARENA_ROUNDS = 12
const MAX_PARTICIPANTS = 4
const MIN_PARTICIPANTS = 2
const PROMPT_VERSION = 'arena-v1'

interface ArenaRunDetail {
  run: ArenaRun
  events: ArenaEvent[]
}

interface CreateArenaRunInput {
  topic: string
  objective?: string
  participantIds: string[]
  roundCount?: number
  responseBudget?: ArenaResponseBudget
  referenceBrief?: string
  seatOverrides?: ArenaSeatOverride[]
}

interface UpdateArenaRunInput {
  topic?: string
  objective?: string
  roundCount?: number
  responseBudget?: ArenaResponseBudget
  referenceBrief?: string
  seats?: Array<{
    agentId: string
    seatLabel?: string
    stanceBrief?: string
    winCondition?: string
  }>
}

interface HeadDirectiveResult {
  directive: string
  focusQuestion: string
  speakerOrder: string[]
  scoreSignals: string[]
  rationaleSummary: string
}

interface DebaterTurnResult {
  message: string
  claimSummary: string
  targetAgentIds: string[]
  concedes: string[]
  confidence: number
  nextPressurePoint: string
  alignmentTag?: string
  moveType?: string
}

interface FinalReportResult {
  winnerAgentId: string
  verdictSummary: string
  scorecards: Array<Partial<ArenaScorecard> & { agentId: string }>
  decisiveMoments: Array<{
    eventId?: string
    round?: number
    title?: string
    summary?: string
    agentId?: string
  }>
  headInterventionSummary: string[]
  unresolvedQuestions: string[]
  improvementNotes: string[]
}

type ArenaAlignmentTag = 'support' | 'oppose' | 'hybrid' | 'skeptic'
type DebateMoveType = 'thesis' | 'rebuttal' | 'example' | 'tradeoff' | 'closing'
type ArenaScoreDimension = 'clarity' | 'pressure' | 'responsiveness' | 'consistency'

const SEAT_ARCHETYPES: Record<number, Array<{ label: string; lens: string; win: string }>> = {
  2: [
    {
      label: 'Forward Thesis',
      lens: 'argue for the strongest high-conviction path forward and make the case for decisive action',
      win: 'showing that a focused, assertive direction creates the best overall outcome',
    },
    {
      label: 'Stress Test',
      lens: 'pressure-test the proposal, surface blind spots, and force proof on every optimistic claim',
      win: 'showing that the plan breaks unless tradeoffs and failure modes are handled directly',
    },
  ],
  3: [
    {
      label: 'Vision Driver',
      lens: 'push the most ambitious version of the idea and emphasize upside, novelty, and momentum',
      win: 'proving the bolder path is worth the added complexity',
    },
    {
      label: 'Systems Builder',
      lens: 'translate the idea into concrete systems, architecture, and execution constraints',
      win: 'showing that disciplined structure beats loose ambition',
    },
    {
      label: 'Human Reality Check',
      lens: 'argue from user experience, trust, clarity, and operator burden',
      win: 'showing that the better human outcome should dominate abstract technical elegance',
    },
  ],
  4: [
    {
      label: 'Vision Driver',
      lens: 'push the boldest strategic version of the idea and defend the upside',
      win: 'showing that ambition compounds faster than caution',
    },
    {
      label: 'Systems Builder',
      lens: 'argue from architecture, constraints, and production reliability',
      win: 'showing that disciplined systems thinking is the real leverage',
    },
    {
      label: 'Operations Bench',
      lens: 'argue from execution cost, latency, repeatability, and practical workflow burden',
      win: 'showing that the workable plan beats the elegant but fragile one',
    },
    {
      label: 'Stress Test',
      lens: 'attack assumptions, expose drift, and reject weak reasoning',
      win: 'showing that the strongest idea survives direct pressure, not just presentation',
    },
  ],
}

const SEAT_LEAKAGE_PATTERNS = [
  /\bvision driver argues that\b/i,
  /\bsystems builder argues that\b/i,
  /\bhuman reality check argues that\b/i,
  /\bstress test argues that\b/i,
  /\bforward thesis argues that\b/i,
]

function clampRoundCount(value?: number): number {
  if (!value || Number.isNaN(value)) {
    return MIN_ARENA_ROUNDS
  }

  return Math.max(MIN_ARENA_ROUNDS, Math.min(MAX_ARENA_ROUNDS, Math.round(value)))
}

function normalizeBudget(value?: ArenaResponseBudget): ArenaResponseBudget {
  return value === 'tight' || value === 'expanded' ? value : 'balanced'
}

function ensureParticipantIds(participantIds: string[]): string[] {
  return [...new Set(participantIds.map((id) => id.trim()).filter(Boolean))]
}

function summarizeGoals(goals: string[]): string {
  return goals.slice(0, 3).join('; ') || 'no explicit goals'
}

function getSeatAlignmentTag(orderIndex: number, totalParticipants: number): ArenaAlignmentTag {
  if (totalParticipants === 2) {
    return orderIndex === 0 ? 'support' : 'oppose'
  }

  if (totalParticipants === 3) {
    if (orderIndex === 0) {
      return 'support'
    }

    if (orderIndex === 1) {
      return 'oppose'
    }

    return 'hybrid'
  }

  if (orderIndex === 0) {
    return 'support'
  }

  if (orderIndex === 1) {
    return 'oppose'
  }

  if (orderIndex === 2) {
    return 'hybrid'
  }

  return 'skeptic'
}

function getAlignmentInstruction(tag: ArenaAlignmentTag): string {
  if (tag === 'support') {
    return 'Defend the topic statement and argue that the arena should endorse it.'
  }

  if (tag === 'oppose') {
    return 'Challenge the topic statement and argue that the arena should reject it.'
  }

  if (tag === 'hybrid') {
    return 'Argue for a conditional middle path rather than unconditional support or rejection.'
  }

  return 'Act as the hardest skeptic and reject weak support unless a rigorous case survives pressure.'
}

function getMoveInstruction(moveType: DebateMoveType): string {
  if (moveType === 'thesis') {
    return 'Establish your strongest case, define the decision criterion, and target one opposing weakness.'
  }

  if (moveType === 'rebuttal') {
    return 'Answer the sharpest live attack first, then counter with one concrete weakness in the opposing case.'
  }

  if (moveType === 'example') {
    return 'Advance the debate with one concrete mechanism, example, or failure mode rather than another abstract restatement.'
  }

  if (moveType === 'tradeoff') {
    return 'Compress the debate to one decisive tradeoff and tell the head why your side still wins it.'
  }

  return 'Land your strongest closing case and make the final contrast obvious.'
}

function compactPromptText(value: string, limit = 320): string {
  const cleaned = cleanOutput(value)
  if (cleaned.length <= limit) {
    return cleaned
  }

  return `${cleaned.slice(0, limit - 1).trim()}…`
}

function cleanPressureThread(value: string): string {
  let cleaned = cleanOutput(value)

  while (/^[^:]{1,80}\s+pressed:\s+/i.test(cleaned)) {
    cleaned = cleaned.replace(/^[^:]{1,80}\s+pressed:\s+/i, '').trim()
  }

  return cleaned
}

function cleanPressureCore(value: string): string {
  let cleaned = cleanPressureThread(value)

  let previous = ''
  while (cleaned && cleaned !== previous) {
    previous = cleaned
    cleaned = cleaned
      .replace(/^[^:]{1,80}\s+(?:must|should|needs to|has to|will)\s+(?:press\s+for\s+)?/i, '')
      .replace(/^(?:answer|respond)\s+(?:directly|clearly|plainly)\s*:\s*/i, '')
      .replace(/^(?:provide|show|demonstrate|address|answer)\s+/i, '')
      .replace(/^(?:with one concrete mechanism or failure mode:\s*)+/i, '')
      .replace(/^(?:with one concrete example or failure mode:\s*)+/i, '')
      .replace(/^(?:directly:\s*)+/i, '')
      .replace(/^(?:resolve the decisive tradeoff(?: around)?\s*)+/i, '')
      .replace(/^(?:the head should weigh it against\s*)+/i, '')
      .replace(/^[\s:;,-]+/, '')
      .trim()
  }

  return cleaned
}

function getSeatAlignmentInstruction(index: number, totalParticipants: number): string {
  if (totalParticipants === 2) {
    return index === 0
      ? 'Assigned side: defend the topic statement as the direction the arena should endorse.'
      : 'Assigned side: challenge the topic statement and argue the arena should reject it.'
  }

  if (totalParticipants === 3) {
    if (index === 0) {
      return 'Assigned side: defend the topic statement and push for adoption.'
    }

    if (index === 1) {
      return 'Assigned side: challenge the topic statement and argue against adoption.'
    }

    return 'Assigned side: hold a conditional middle position and argue for a stricter hybrid path instead of unconditional agreement.'
  }

  if (index === 0) {
    return 'Assigned side: defend the topic statement and push for adoption.'
  }

  if (index === 1) {
    return 'Assigned side: attack the topic statement on architecture and reliability grounds.'
  }

  if (index === 2) {
    return 'Assigned side: argue for a conditional hybrid path with operational constraints.'
  }

  return 'Assigned side: act as the hardest skeptic and reject weak support for the topic statement.'
}

function pickTopTraits(agent: AgentRecord): string[] {
  const traits = [
    ...Object.entries(agent.coreTraits || {}),
    ...Object.entries(agent.dynamicTraits || {}),
  ]

  return traits
    .sort((left, right) => right[1] - left[1])
    .slice(0, 3)
    .map(([trait]) => trait.replaceAll('_', ' '))
}

function createSeats(participants: ArenaParticipant[], agentsById: Map<string, AgentRecord>, overrides: ArenaSeatOverride[] = []): ArenaSeat[] {
  const archetypes = SEAT_ARCHETYPES[participants.length] || SEAT_ARCHETYPES[4]

  return participants.map((participant, index) => {
    const agent = agentsById.get(participant.id)
    const override = overrides.find((entry) => entry.agentId === participant.id)
    const archetype = archetypes[index % archetypes.length]
    const traitLine = agent ? pickTopTraits(agent).join(', ') : ''
    const personaCue = participant.persona.split('.').slice(0, 2).join('. ').trim()
    const stanceBrief = override?.stanceBrief?.trim() || [
      `Debate from the "${archetype.label}" seat.`,
      getSeatAlignmentInstruction(index, participants.length),
      `Primary lens: ${archetype.lens}.`,
      `Stay faithful to ${participant.name}'s identity: ${personaCue || participant.persona}.`,
      `Known goals: ${summarizeGoals(participant.goals)}.`,
      traitLine ? `Use these natural traits as pressure style: ${traitLine}.` : undefined,
    ].filter(Boolean).join(' ')

    const winCondition = override?.winCondition?.trim() || archetype.win

    return {
      agentId: participant.id,
      agentName: participant.name,
      seatLabel: override?.seatLabel?.trim() || archetype.label,
      stanceBrief,
      winCondition,
      orderIndex: index,
      source: override?.seatLabel || override?.stanceBrief || override?.winCondition ? 'manual' : 'auto',
    }
  })
}

function createInitialScorecards(participants: ArenaParticipant[]): ArenaScorecard[] {
  return participants.map((participant) => ({
    agentId: participant.id,
    agentName: participant.name,
    clarity: 0,
    pressure: 0,
    responsiveness: 0,
    consistency: 0,
    total: 0,
    summary: 'No scored turns yet.',
  }))
}

function createInitialNotebooks(participants: ArenaParticipant[]): ArenaParticipantNotebook[] {
  const now = new Date().toISOString()
  return participants.map((participant) => ({
    agentId: participant.id,
    commitments: [],
    attacksToAnswer: [],
    concessions: [],
    nextPressurePoints: [],
    lastUpdatedAt: now,
  }))
}

function getStageForRound(round: number, roundCount: number): ArenaStage {
  if (round <= 2) {
    return 'opening'
  }

  if (roundCount >= 12) {
    return round <= 8 ? 'crossfire' : 'narrowing'
  }

  return round <= 7 ? 'crossfire' : 'narrowing'
}

function stageLabel(stage: ArenaStage): string {
  return stage.replaceAll('_', ' ')
}

function budgetConfig(budget: ArenaResponseBudget) {
  if (budget === 'tight') {
    return {
      headTokens: 170,
      debaterTokens: 220,
      closingTokens: 160,
      reportTokens: 900,
      turnWords: '90 to 120 words',
      closingWords: '60 to 90 words',
    }
  }

  if (budget === 'expanded') {
    return {
      headTokens: 260,
      debaterTokens: 340,
      closingTokens: 220,
      reportTokens: 1200,
      turnWords: '150 to 200 words',
      closingWords: '90 to 120 words',
    }
  }

  return {
    headTokens: 220,
    debaterTokens: 280,
    closingTokens: 190,
    reportTokens: 1000,
    turnWords: '120 to 160 words',
    closingWords: '75 to 105 words',
  }
}

function trimList(values: unknown, limit = 6): string[] {
  return normalizeStringList(values, limit * 2)
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, limit)
}

const CLAIM_STOPWORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'but',
  'by',
  'for',
  'from',
  'has',
  'have',
  'in',
  'is',
  'it',
  'its',
  'of',
  'on',
  'or',
  'that',
  'the',
  'their',
  'this',
  'to',
  'while',
  'with',
])

function claimTokens(value: string): string[] {
  return cleanOutput(value)
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((token) => token.length > 2 && !CLAIM_STOPWORDS.has(token))
}

function claimSimilarity(left: string, right: string): number {
  const leftTokens = new Set(claimTokens(left))
  const rightTokens = new Set(claimTokens(right))

  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0
  }

  let shared = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      shared += 1
    }
  }

  return shared / Math.max(leftTokens.size, rightTokens.size)
}

function trimDistinctNarratives(values: unknown, limit = 6, similarityThreshold = 0.68): string[] {
  const cleaned = normalizeStringList(values, limit * 4)
    .map((value) => normalizeWhitespace(value))
    .filter(Boolean)

  const distinct: string[] = []
  for (const candidate of cleaned) {
    if (distinct.some((existing) => claimSimilarity(existing, candidate) >= similarityThreshold)) {
      continue
    }

    distinct.push(candidate)
    if (distinct.length >= limit) {
      break
    }
  }

  return distinct
}

function normalizeParticipantIdList(
  values: unknown,
  participantIds: string[],
  excludeId?: string
): string[] {
  return trimList(values, participantIds.length)
    .filter((agentId) => participantIds.includes(agentId))
    .filter((agentId) => agentId !== excludeId)
}

function getRecentRoundLedger(run: ArenaRun, limitCount = 2) {
  return run.ledger.rounds.slice(-limitCount)
}

function rotateList<T>(values: T[], offset: number): T[] {
  if (values.length === 0) {
    return values
  }

  const startIndex = ((offset % values.length) + values.length) % values.length
  return values.slice(startIndex).concat(values.slice(0, startIndex))
}

function summarizeLedger(rounds: ArenaRun['ledger']['rounds']): string {
  if (rounds.length === 0) {
    return 'No previous rounds.'
  }

  return rounds.map((round) => (
    `Round ${round.round} (${stageLabel(round.phase)}): ${round.summary} Focus: ${round.focusQuestion}. Unresolved: ${round.unresolvedThreads.join('; ') || 'none'}.`
  )).join('\n')
}

function detectRoundRepetition(claims: Array<{ agentId: string; claim: string }>): string[] {
  const repeatedPairs: string[] = []

  for (let leftIndex = 0; leftIndex < claims.length; leftIndex += 1) {
    for (let rightIndex = leftIndex + 1; rightIndex < claims.length; rightIndex += 1) {
      const left = claims[leftIndex]
      const right = claims[rightIndex]
      if (claimSimilarity(left.claim, right.claim) >= 0.62) {
        repeatedPairs.push(`${left.agentId}:${right.agentId}`)
      }
    }
  }

  return repeatedPairs
}

const SUPPORT_STANCE_CUES = [
  'enhanc',
  'improv',
  'support',
  'enable',
  'ensur',
  'strength',
  'maintain',
  'preserv',
  'worth',
  'crucial',
  'valuable',
  'transparen',
  'accountab',
  'align',
  'robust',
  'cohes',
  'clarity',
]

const OPPOSE_STANCE_CUES = [
  'hinder',
  'imped',
  'stifl',
  'delay',
  'break',
  'bottleneck',
  'bureaucracy',
  'bureaucr',
  'rigid',
  'rigidity',
  'britt',
  'fragil',
  'unsuit',
  'compromis',
  'hurt',
  'slow',
  'harm',
  'jeopard',
  'risk',
]

const HYBRID_STANCE_CUES = [
  'hybrid',
  'conditional',
  'tier',
  'selectiv',
  'depend',
  'balanced',
  'balance',
  'two-tier',
  'middle path',
  'phased',
  'gated',
]

function countCueMatches(value: string, cues: string[]): number {
  const lowerValue = cleanOutput(value).toLowerCase()
  return cues.reduce((count, cue) => count + (new RegExp(cue, 'i').test(lowerValue) ? 1 : 0), 0)
}

function detectStanceDrift(value: string, supportingText: string, expectedAlignment: ArenaAlignmentTag): string | null {
  const stanceText = `${cleanOutput(value)} ${cleanOutput(supportingText).split(/[.!?]/)[0]}`.trim()
  const positive = countCueMatches(stanceText, SUPPORT_STANCE_CUES)
  const negative = countCueMatches(stanceText, OPPOSE_STANCE_CUES)
  const hybrid = countCueMatches(stanceText, HYBRID_STANCE_CUES)

  if (expectedAlignment === 'support' && negative >= positive + 1 && hybrid === 0) {
    return 'claim undercuts the assigned support case'
  }

  if ((expectedAlignment === 'oppose' || expectedAlignment === 'skeptic') && positive >= negative + 1 && hybrid === 0) {
    return 'claim undercuts the assigned opposing case'
  }

  if (expectedAlignment === 'hybrid' && hybrid === 0 && Math.abs(positive - negative) >= 2) {
    return 'claim abandoned the conditional middle path'
  }

  return null
}

function detectRoleBleed(value: string, currentSpeaker: ArenaParticipant, participants: ArenaParticipant[]): string[] {
  const lowerValue = value.toLowerCase()
  const failures: string[] = []

  if (/(^|\b)(as the head|as moderator|i am the moderator|i am the judge)\b/i.test(value)) {
    failures.push('speaker switched into head role')
  }

  for (const participant of participants) {
    if (participant.id === currentSpeaker.id) {
      continue
    }

    const escaped = participant.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const namePattern = new RegExp(`\\bi am ${escaped}\\b`, 'i')
    if (namePattern.test(value)) {
      failures.push(`speaker claimed to be ${participant.name}`)
      break
    }
  }

  if (/^(certainly|absolutely|of course|sure|here(?:'|’)s|let(?:'|’)s break this down|alright|all right|okay[, ]|ok[, ]|let(?:'|’)s dive in|to answer this directly)/i.test(lowerValue)) {
    failures.push('generic assistant opener')
  }

  if (SEAT_LEAKAGE_PATTERNS.some((pattern) => pattern.test(value))) {
    failures.push('seat label leakage')
  }

  return failures
}

function findMentionedParticipantName(value: string, participants: ArenaParticipant[]): string | null {
  for (const participant of participants) {
    const escaped = participant.name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    if (new RegExp(`\\b${escaped}\\b`, 'i').test(value)) {
      return participant.name
    }
  }

  return null
}

function hasConcreteDebateSignal(value: string): boolean {
  return /(?:for example|for instance|specifically|because|if |when |workflow|review cycle|approval|handoff|incident|release|rollback|queue|owner|threshold|policy|checklist|slack|latency|operator|audit|debug|failure mode|mechanism|\d)/i.test(value)
}

function scoreTurn(params: {
  result: DebaterTurnResult
  speaker: ArenaParticipant
  participants: ArenaParticipant[]
  previousNotebook?: ArenaParticipantNotebook
  requiredTargetId?: string | null
}): ArenaScorecard {
  const { result, speaker, participants, previousNotebook, requiredTargetId } = params
  const fullText = cleanOutput(`${result.claimSummary} ${result.message}`)
  const priorSimilarities = (previousNotebook?.commitments || []).map((commitment) => claimSimilarity(commitment, result.claimSummary))
  const maxSimilarity = priorSimilarities.length > 0 ? Math.max(...priorSimilarities) : 0
  const answeredAttack = Boolean(previousNotebook?.attacksToAnswer[0]) && claimSimilarity(
    previousNotebook?.attacksToAnswer[0] || '',
    fullText
  ) >= 0.14
  const concrete = hasConcreteDebateSignal(fullText)
  const targetedRequired = requiredTargetId
    ? result.targetAgentIds.includes(requiredTargetId)
    : result.targetAgentIds.length > 0

  let clarity = result.claimSummary.length >= 30 && result.claimSummary.length <= 220 ? 3 : 2
  if (concrete) clarity += 1
  if (SEAT_LEAKAGE_PATTERNS.some((pattern) => pattern.test(fullText))) clarity -= 1
  clarity = Math.max(1, Math.min(4, clarity))

  let pressure = targetedRequired ? 3 : result.targetAgentIds.length > 0 ? 2 : 1
  if (concrete && cleanPressureCore(result.nextPressurePoint).length >= 22) pressure += 1
  pressure = Math.max(1, Math.min(4, pressure))

  let responsiveness = previousNotebook?.attacksToAnswer.length
    ? (answeredAttack ? 4 : 2)
    : (targetedRequired ? 3 : 2)
  if (result.concedes.length > 0 && targetedRequired) {
    responsiveness = Math.min(4, responsiveness + 1)
  }

  let consistency = 3
  if (maxSimilarity >= 0.86) consistency = 1
  else if (maxSimilarity >= 0.74) consistency = 2
  else if (maxSimilarity <= 0.35 && concrete) consistency = 4

  const total = clarity + pressure + responsiveness + consistency
  const summary = [
    `${speaker.name} pushed ${result.claimSummary.replace(/\.+$/, '').toLowerCase()}.`,
    result.targetAgentIds.length > 0
      ? `Pressure landed on ${result.targetAgentIds.map((id) => participants.find((participant) => participant.id === id)?.name || id).join(', ')}.`
      : 'Pressure stayed broad rather than targeted.',
  ].join(' ')

  return {
    agentId: speaker.id,
    agentName: speaker.name,
    clarity,
    pressure,
    responsiveness,
    consistency,
    total,
    summary,
  }
}

function mergeScorecards(current: ArenaScorecard[], delta: ArenaScorecard): ArenaScorecard[] {
  return current.map((scorecard) => {
    if (scorecard.agentId !== delta.agentId) {
      return scorecard
    }

    const next = {
      ...scorecard,
      clarity: scorecard.clarity + delta.clarity,
      pressure: scorecard.pressure + delta.pressure,
      responsiveness: scorecard.responsiveness + delta.responsiveness,
      consistency: scorecard.consistency + delta.consistency,
      total: scorecard.total + delta.total,
      summary: delta.summary,
    }

    return next
  })
}

function updateNotebook(
  notebook: ArenaParticipantNotebook,
  result: DebaterTurnResult,
  incomingAttacks: string[]
): ArenaParticipantNotebook {
  return {
    ...notebook,
    commitments: trimDistinctNarratives([result.claimSummary, ...notebook.commitments], 6, 0.72),
    attacksToAnswer: trimDistinctNarratives(incomingAttacks, 4, 0.7),
    concessions: trimList([...result.concedes, ...notebook.concessions], 6),
    nextPressurePoints: trimDistinctNarratives([result.nextPressurePoint, ...notebook.nextPressurePoints], 4, 0.72),
    lastUpdatedAt: new Date().toISOString(),
  }
}

function cleanOutput(value: unknown): string {
  if (value === null || value === undefined) {
    return ''
  }

  return normalizeWhitespace(String(value)).replace(/\s+/g, ' ').trim()
}

function stripSeatLeakage(value: string): string {
  return cleanOutput(value)
    .replace(/^(?:the )?(?:vision driver|systems builder|human reality check|stress test|forward thesis)\s+argues that\s+/i, '')
    .replace(/^the arena should (?:endorse|reject|take a conditional path on)\s+/i, '')
    .replace(/^yes[:,]?\s*/i, '')
    .replace(/^no[:,]?\s*/i, '')
    .replace(/^conditional(?:ly)?[:,]?\s*/i, '')
    .replace(/^"|"$/g, '')
    .trim()
}

function normalizeDebateSentence(value: string): string {
  const cleaned = stripSeatLeakage(value)
  if (!cleaned) {
    return ''
  }

  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1)
}

function extractLeadSentence(value: string): string {
  const cleaned = normalizeDebateSentence(value)
  if (!cleaned) {
    return ''
  }

  const match = cleaned.match(/^(.+?[.!?])(?:\s|$)/)
  return cleanOutput(match?.[1] || cleaned)
}

function getTopicSubject(topic: string): string {
  const cleaned = cleanOutput(topic).replace(/\?$/, '')
  return /^should\s+/i.test(cleaned)
    ? cleaned.replace(/^should\s+/i, '')
    : cleaned
}

function buildAlignmentClaimSummary(topic: string, alignmentTag: ArenaAlignmentTag, reason: string): string {
  const subject = getTopicSubject(topic)
  const compactReason = cleanOutput(reason).replace(/\.+$/, '')

  if (alignmentTag === 'support') {
    return normalizeDebateSentence(`Yes, ${subject} because ${compactReason}.`)
  }

  if (alignmentTag === 'oppose' || alignmentTag === 'skeptic') {
    return normalizeDebateSentence(`No, ${subject} because ${compactReason}.`)
  }

  return normalizeDebateSentence(`Conditionally, ${subject}, but only if ${compactReason}.`)
}

function buildAlignmentDefenseFrame(topic: string, alignmentTag: ArenaAlignmentTag): string {
  const subject = getTopicSubject(topic)

  if (alignmentTag === 'support') {
    return `${subject} still wins`
  }

  if (alignmentTag === 'oppose' || alignmentTag === 'skeptic') {
    return `${subject} should still be rejected`
  }

  return `${subject} should only be accepted conditionally`
}

function deriveClaimSummaryFromMessage(message: string, topic: string, alignmentTag: ArenaAlignmentTag, fallbackReason: string): string {
  const lead = extractLeadSentence(message)
  const candidate = lead ? compactPromptText(lead, 180) : ''
  if (candidate.length >= 20) {
    return candidate
  }

  return buildAlignmentClaimSummary(topic, alignmentTag, fallbackReason)
}

function pickAlignedNotebookClaim(
  notebook: ArenaParticipantNotebook,
  alignmentTag: ArenaAlignmentTag,
  topic: string,
  fallbackReason: string
): string {
  const strongestNotebookClaim = notebook.commitments
    .map((candidate) => normalizeDebateSentence(candidate))
    .find((candidate) => candidate.length >= 20 && !detectStanceDrift(candidate, candidate, alignmentTag))

  return strongestNotebookClaim || buildAlignmentClaimSummary(topic, alignmentTag, fallbackReason)
}

function buildFreshFocusQuestion(run: ArenaRun, stage: ArenaStage, fallback: string): string {
  const unresolved = trimDistinctNarratives(run.ledger.unresolvedThreads.map((item) => cleanPressureThread(item)), 5, 0.72)
  const recentFocuses = getRecentRoundLedger(run, 2).map((entry) => cleanPressureThread(entry.focusQuestion))
  const fresh = unresolved.find((candidate) => !recentFocuses.some((focus) => claimSimilarity(candidate, focus) >= 0.82))

  if (fresh) {
    return fresh
  }

  if (stage === 'crossfire') {
    return 'Which concrete release workflow, mechanism, or failure mode actually separates these positions?'
  }

  if (stage === 'narrowing') {
    return 'Which single release tradeoff should decide the verdict?'
  }

  return fallback
}

function compareScorecards(left: ArenaScorecard, right: ArenaScorecard): number {
  const dimensions: Array<'total' | ArenaScoreDimension> = ['total', 'responsiveness', 'pressure', 'clarity', 'consistency']
  for (const dimension of dimensions) {
    const leftValue = dimension === 'total' ? left.total : left[dimension]
    const rightValue = dimension === 'total' ? right.total : right[dimension]
    if (rightValue !== leftValue) {
      return rightValue - leftValue
    }
  }

  return left.agentName.localeCompare(right.agentName)
}

function getLeadingDimensions(winner?: ArenaScorecard | null): ArenaScoreDimension[] {
  if (!winner) {
    return []
  }

  return ([
    ['clarity', winner.clarity],
    ['pressure', winner.pressure],
    ['responsiveness', winner.responsiveness],
    ['consistency', winner.consistency],
  ] as const)
    .sort((left, right) => right[1] - left[1])
    .slice(0, 2)
    .map(([label]) => label)
}

function buildWinnerNarrative(winner: ArenaScorecard | undefined, runnerUp?: ArenaScorecard): string {
  if (!winner) {
    return 'The arena completed, but no score leader could be derived.'
  }

  const leadingDimensions = getLeadingDimensions(winner)
  if (!runnerUp) {
    return `${winner.agentName} finished ahead on the arena ledger, leading most clearly in ${leadingDimensions.join(' and ') || 'overall quality'}.`
  }

  if (winner.total === runnerUp.total) {
    return `${winner.agentName} edged a tied total score through stronger ${leadingDimensions.join(' and ') || 'overall pressure'}.`
  }

  return `${winner.agentName} won on total score (${winner.total} vs ${runnerUp.total}), leading most clearly in ${leadingDimensions.join(' and ') || 'overall pressure'}.`
}

function validateHeadDirective(parsed: HeadDirectiveResult, participantIds: string[]): string[] {
  const errors: string[] = []

  if (!cleanOutput(parsed.directive)) {
    errors.push('missing directive')
  }

  if (!cleanOutput(parsed.focusQuestion)) {
    errors.push('missing focus question')
  }

  const speakerOrder = Array.isArray(parsed.speakerOrder)
    ? parsed.speakerOrder.filter((agentId) => participantIds.includes(agentId))
    : []

  if (speakerOrder.length === 0) {
    errors.push('missing speaker order')
  }

  return errors
}

function validateDebaterResult(parsed: DebaterTurnResult, speaker: ArenaParticipant, participants: ArenaParticipant[]): string[] {
  const errors: string[] = []
  const message = cleanOutput(parsed.message)
  const claimSummary = cleanOutput(parsed.claimSummary)

  if (!message) {
    errors.push('missing message')
  }

  if (!claimSummary) {
    errors.push('missing claim summary')
  }

  errors.push(...detectTextLeakage(message).map((flag) => `message leakage: ${flag}`))
  errors.push(...detectTextLeakage(claimSummary).map((flag) => `claim leakage: ${flag}`))
  errors.push(...detectRoleBleed(message, speaker, participants))
  errors.push(...detectRoleBleed(claimSummary, speaker, participants))

  return errors
}

function validateDebaterResultForConstraints(params: {
  parsed: DebaterTurnResult
  speaker: ArenaParticipant
  participants: ArenaParticipant[]
  notebook: ArenaParticipantNotebook
  expectedAlignment: ArenaAlignmentTag
  requiredMoveType: DebateMoveType
  requiredTargetId: string | null
  round: number
}): string[] {
  const baseErrors = validateDebaterResult(params.parsed, params.speaker, params.participants)
  const errors = [...baseErrors]
  const claimSummary = cleanOutput(params.parsed.claimSummary)
  const message = cleanOutput(params.parsed.message)
  const alignmentTag = cleanOutput(params.parsed.alignmentTag).toLowerCase()
  const moveType = cleanOutput(params.parsed.moveType).toLowerCase()
  const mentionedParticipant = findMentionedParticipantName(claimSummary, params.participants)
  const maxCommitmentSimilarity = Math.max(
    0,
    ...(params.notebook.commitments || []).map((commitment) => claimSimilarity(commitment, claimSummary))
  )

  if (alignmentTag !== params.expectedAlignment) {
    errors.push(`alignment drift: expected ${params.expectedAlignment}`)
  }

  const stanceDrift = detectStanceDrift(claimSummary, message, params.expectedAlignment)
  if (stanceDrift) {
    errors.push(stanceDrift)
  }

  if (moveType !== params.requiredMoveType) {
    errors.push(`wrong move type: expected ${params.requiredMoveType}`)
  }

  if (params.requiredTargetId && params.round > 1) {
    const targets = Array.isArray(params.parsed.targetAgentIds)
      ? params.parsed.targetAgentIds.map(String)
      : []
    if (!targets.includes(params.requiredTargetId)) {
      errors.push('missing required target')
    }
  }

  if ((params.requiredMoveType === 'example' || params.requiredMoveType === 'tradeoff' || params.requiredMoveType === 'closing')
    && !hasConcreteDebateSignal(`${claimSummary} ${message}`)) {
    errors.push('missing concrete mechanism or example')
  }

  if (mentionedParticipant) {
    errors.push(`claim summary mentions participant name: ${mentionedParticipant}`)
  }

  if (params.round >= 3 && maxCommitmentSimilarity >= (params.requiredMoveType === 'closing' ? 0.93 : 0.88)) {
    errors.push('claim repeats prior commitment too closely')
  }

  return errors
}

function normalizeHeadDirective(parsed: HeadDirectiveResult, participantIds: string[]): HeadDirectiveResult {
  const speakerOrder = normalizeParticipantIdList(parsed.speakerOrder, participantIds)

  return {
    directive: cleanOutput(parsed.directive),
    focusQuestion: cleanOutput(parsed.focusQuestion),
    speakerOrder: speakerOrder.length > 0 ? speakerOrder : participantIds,
    scoreSignals: trimList(parsed.scoreSignals || [], 4),
    rationaleSummary: cleanOutput(parsed.rationaleSummary) || 'Keep pressure on the strongest unresolved tradeoff.',
  }
}

function normalizeDebaterResult(
  parsed: DebaterTurnResult,
  params: {
    speakerId: string
    participantIds: string[]
    alignmentTag: ArenaAlignmentTag
    topic: string
    fallbackReason: string
    participants?: ArenaParticipant[]
  }
): DebaterTurnResult {
  const targets = normalizeParticipantIdList(parsed.targetAgentIds, params.participantIds, params.speakerId)

  const confidence = typeof parsed.confidence === 'number'
    ? Math.max(0.1, Math.min(1, parsed.confidence))
    : 0.6

  const normalizedClaim = normalizeDebateSentence(parsed.claimSummary)
  const normalizedMessage = normalizeDebateSentence(parsed.message)
  const participantMention = params.participants
    ? findMentionedParticipantName(normalizedClaim, params.participants)
    : null
  const driftedClaim = normalizedClaim
    ? detectStanceDrift(normalizedClaim, normalizedMessage, params.alignmentTag)
    : 'missing claim summary'
  const baseClaim = normalizedClaim.length >= 20 && !participantMention && !driftedClaim
    ? normalizedClaim
    : deriveClaimSummaryFromMessage(normalizedMessage, params.topic, params.alignmentTag, params.fallbackReason)
  const rewrittenMention = params.participants
    ? findMentionedParticipantName(baseClaim, params.participants)
    : null
  const rewrittenDrift = detectStanceDrift(baseClaim, normalizedMessage || baseClaim, params.alignmentTag)
  const claimSummary = baseClaim.length >= 20 && !rewrittenMention && !rewrittenDrift
    ? baseClaim
    : buildAlignmentClaimSummary(params.topic, params.alignmentTag, params.fallbackReason)

  return {
    message: normalizedMessage || claimSummary,
    claimSummary,
    targetAgentIds: targets,
    concedes: trimList(parsed.concedes || [], 3),
    confidence,
    nextPressurePoint: cleanPressureThread(cleanOutput(parsed.nextPressurePoint)) || 'Press the weakest unresolved assumption.',
    alignmentTag: cleanOutput(parsed.alignmentTag).toLowerCase(),
    moveType: cleanOutput(parsed.moveType).toLowerCase(),
  }
}

function deriveDecisiveMoments(events: ArenaEvent[]): ArenaReport['decisiveMoments'] {
  const rankedTurns = events
    .filter((event) => event.kind === 'debater_turn')
    .map((event) => {
      const payload = getEventPayload(event)
      const scoreDelta = payload.scoreDelta && typeof payload.scoreDelta === 'object'
        ? payload.scoreDelta as Record<string, unknown>
        : {}

      return {
        event,
        total: typeof scoreDelta.total === 'number' ? scoreDelta.total : 0,
        degraded: Boolean(payload.degraded),
      }
    })
    .sort((left, right) => {
      if (right.total !== left.total) {
        return right.total - left.total
      }

      return (left.event.round || 0) - (right.event.round || 0)
    })

  const selected: ArenaReport['decisiveMoments'] = []
  const perAgentCount = new Map<string, number>()
  const seenRounds = new Set<number>()

  for (const candidate of rankedTurns) {
    if (candidate.degraded) {
      continue
    }

    const agentId = candidate.event.speakerAgentId || ''
    const round = candidate.event.round || 0
    if (agentId && (perAgentCount.get(agentId) || 0) >= 2) {
      continue
    }

    if (round > 0 && seenRounds.has(round) && selected.length >= 2) {
      continue
    }

    selected.push({
      eventId: candidate.event.id,
      round,
      title: candidate.event.speakerName ? `${candidate.event.speakerName} landed a key turn` : 'Key arena moment',
      summary: candidate.event.summary,
      agentId: candidate.event.speakerAgentId,
      agentName: candidate.event.speakerName,
    })

    if (agentId) {
      perAgentCount.set(agentId, (perAgentCount.get(agentId) || 0) + 1)
    }

    if (round > 0) {
      seenRounds.add(round)
    }

    if (selected.length >= 4) {
      break
    }
  }

  if (selected.length > 0) {
    return selected.sort((left, right) => (left.round || 0) - (right.round || 0))
  }

  return events
    .filter((event) => event.kind === 'debater_turn')
    .slice(-4)
    .map((event) => ({
      eventId: event.id,
      round: event.round || 0,
      title: event.speakerName ? `${event.speakerName} landed a key turn` : 'Key arena moment',
      summary: event.summary,
      agentId: event.speakerAgentId,
      agentName: event.speakerName,
    }))
}

function normalizeFinalReport(parsed: FinalReportResult, run: ArenaRun, events: ArenaEvent[]): ArenaReport {
  const fallbackWinner = [...run.scorecardSnapshot].sort(compareScorecards)[0]
  const winnerAgentId = fallbackWinner?.agentId || (
    run.participantIds.includes(parsed.winnerAgentId)
      ? parsed.winnerAgentId
      : run.participantIds[0]
  )
  const winnerAgentName = run.participants.find((participant) => participant.id === winnerAgentId)?.name || 'Unknown'

  const scorecards = run.scorecardSnapshot.map((existing) => {
    const next = parsed.scorecards.find((entry) => entry.agentId === existing.agentId)
    const nextSummary = cleanOutput(String(next?.summary || ''))
    const mentionsOtherAgent = run.participants.some((participant) => participant.id !== existing.agentId && nextSummary.includes(participant.name))
    return {
      ...existing,
      summary: nextSummary && !mentionsOtherAgent ? nextSummary : existing.summary,
    }
  })

  const decisiveMoments = (Array.isArray(parsed.decisiveMoments) ? parsed.decisiveMoments : [])
    .map((moment) => {
      const referencedEvent = moment.eventId
        ? events.find((event) => event.id === moment.eventId)
        : undefined
      const agentName = moment.agentId
        ? run.participants.find((participant) => participant.id === moment.agentId)?.name
        : referencedEvent?.speakerName

      if (!cleanOutput(String(moment.summary || referencedEvent?.summary || ''))) {
        return null
      }

      return {
        eventId: referencedEvent?.id || moment.eventId || generateId('arena_moment'),
        round: referencedEvent?.round || moment.round || 0,
        title: cleanOutput(String(moment.title || referencedEvent?.title || 'Decisive moment')),
        summary: cleanOutput(String(moment.summary || referencedEvent?.summary || '')),
        agentId: moment.agentId || referencedEvent?.speakerAgentId,
        agentName,
      }
    })
    .filter((moment): moment is ArenaReport['decisiveMoments'][number] => Boolean(moment))

  return {
    winnerAgentId,
    winnerAgentName,
    verdictSummary: cleanOutput(parsed.verdictSummary) || `${winnerAgentName} delivered the strongest overall arena performance.`,
    scorecards,
    decisiveMoments: decisiveMoments.length > 0 ? decisiveMoments.slice(0, 4) : deriveDecisiveMoments(events),
    headInterventionSummary: trimList(parsed.headInterventionSummary || [], 4),
    unresolvedQuestions: trimDistinctNarratives(parsed.unresolvedQuestions || run.ledger.unresolvedThreads, 5, 0.7),
    improvementNotes: trimList(parsed.improvementNotes || [], 5),
    createdAt: new Date().toISOString(),
  }
}

function buildFallbackHeadDirective(run: ArenaRun, round: number, stage: ArenaStage): HeadDirectiveResult {
  const focusQuestion = cleanOutput(run.ledger.unresolvedThreads[0] || run.config.topic)
  const speakerOrder = rotateList(run.seats.map((seat) => seat.agentId), round - 1)

  const directiveByStage: Record<ArenaStage, string> = {
    seat_generation: 'Lock each seat to its stance and make the conflict explicit.',
    opening: 'State the strongest case for your seat and define the main fault line early.',
    crossfire: 'Answer the sharpest attack directly and force one concrete weakness in the opposing case.',
    narrowing: 'Compress the argument to the decisive tradeoff and stop opening new branches.',
    closing: 'Deliver one final concise case and draw the clearest contrast.',
    report: 'Judge only from the run evidence and explain the winner plainly.',
    completed: 'Close the arena cleanly.',
  }

  return {
    directive: directiveByStage[stage] || 'Keep the debate pointed at the strongest unresolved issue.',
    focusQuestion,
    speakerOrder,
    scoreSignals: ['direct answers', 'specific pressure', 'clear contrast'],
    rationaleSummary: 'Fallback directive preserved the debate flow after a generation miss.',
  }
}

function buildFallbackDebaterTurn(params: {
  run: ArenaRun
  seat: ArenaSeat
  speaker: ArenaParticipant
  notebook: ArenaParticipantNotebook
  directive: HeadDirectiveResult
  requiredTargetId?: string | null
  requiredMoveType?: DebateMoveType
  closing?: boolean
}): DebaterTurnResult {
  const alignmentTag = getSeatAlignmentTag(params.seat.orderIndex, params.run.participants.length)
  const moveType = params.closing ? 'closing' : (params.requiredMoveType || 'rebuttal')
  const targetAgentIds = trimList(
    params.requiredTargetId
      ? [params.requiredTargetId]
      : params.run.seats
          .filter((seat) => seat.agentId !== params.speaker.id)
          .slice(0, 1)
          .map((seat) => seat.agentId),
    1
  )
  const nextPressurePoint = cleanOutput(
    params.notebook.attacksToAnswer[0] ||
    params.notebook.nextPressurePoints[0] ||
    params.directive.focusQuestion ||
    params.run.config.topic
  )
  const claimSummary = pickAlignedNotebookClaim(
    params.notebook,
    alignmentTag,
    params.run.config.topic,
    params.seat.winCondition
  )
  const targetSeat = targetAgentIds[0]
    ? params.run.seats.find((seat) => seat.agentId === targetAgentIds[0])
    : undefined
  const normalizedPressurePoint = normalizePressurePointForTarget({
    raw: nextPressurePoint,
    claimSummary,
    targetAgentName: targetSeat?.agentName,
    focusQuestion: params.directive.focusQuestion,
    moveType,
    topic: params.run.config.topic,
    targetAlignment: targetSeat
      ? getSeatAlignmentTag(targetSeat.orderIndex, params.run.participants.length)
      : alignmentTag,
  })
  const message = params.closing
    ? cleanOutput([
        `${claimSummary}`,
        targetSeat
          ? `${targetSeat.agentName} never closed the gap on ${cleanPressureCore(normalizedPressurePoint).replace(/\.$/, '')}.`
          : 'That is the clearest release decision left on the board.',
      ].join(' '))
    : cleanOutput([
        `${claimSummary}`,
        normalizedPressurePoint,
      ].join(' '))

  return {
    message,
    claimSummary,
    targetAgentIds,
    concedes: [],
    confidence: params.closing ? 0.58 : 0.54,
    nextPressurePoint: normalizedPressurePoint,
    alignmentTag,
    moveType,
  }
}

function buildDeterministicClosingTurn(params: {
  run: ArenaRun
  seat: ArenaSeat
  speaker: ArenaParticipant
  notebook: ArenaParticipantNotebook
  directive: HeadDirectiveResult
  requiredTargetId?: string | null
}): DebaterTurnResult {
  const alignmentTag = getSeatAlignmentTag(params.seat.orderIndex, params.run.participants.length)
  const targetAgentIds = trimList(
    params.requiredTargetId
      ? [params.requiredTargetId]
      : params.run.seats
          .filter((seat) => seat.agentId !== params.speaker.id)
          .slice(0, 1)
          .map((seat) => seat.agentId),
    1
  )
  const targetSeat = targetAgentIds[0]
    ? params.run.seats.find((seat) => seat.agentId === targetAgentIds[0])
    : undefined
  const claimSummary = pickAlignedNotebookClaim(
    params.notebook,
    alignmentTag,
    params.run.config.topic,
    params.seat.winCondition
  )
  const nextPressurePoint = normalizePressurePointForTarget({
    raw: params.notebook.attacksToAnswer[0] || params.notebook.nextPressurePoints[0] || params.directive.focusQuestion,
    claimSummary,
    targetAgentName: targetSeat?.agentName,
    focusQuestion: params.directive.focusQuestion,
    moveType: 'closing',
    topic: params.run.config.topic,
    targetAlignment: targetSeat
      ? getSeatAlignmentTag(targetSeat.orderIndex, params.run.participants.length)
      : alignmentTag,
  })
  const latestTargetClaim = targetSeat ? compactPromptText(getLatestClaimForAgent(params.run, targetSeat.agentId), 170) : ''
  const message = cleanOutput([
    claimSummary,
    targetSeat
      ? latestTargetClaim
        ? `${targetSeat.agentName}'s strongest counter was ${latestTargetClaim.replace(/\.$/, '').toLowerCase()}, but it never outweighed this case.`
        : `${targetSeat.agentName}'s case never outweighed this release decision.`
      : 'That remains the clearest verdict-ready case in the arena record.',
  ].join(' '))

  return {
    message,
    claimSummary,
    targetAgentIds,
    concedes: [],
    confidence: 0.7,
    nextPressurePoint,
    alignmentTag,
    moveType: 'closing',
  }
}

function buildFallbackFinalReport(run: ArenaRun, events: ArenaEvent[]): ArenaReport {
  const sortedScorecards = [...run.scorecardSnapshot].sort(compareScorecards)
  const winner = sortedScorecards[0] || run.scorecardSnapshot[0]
  const runnerUp = sortedScorecards[1]
  const winnerAgentId = winner?.agentId || run.participantIds[0]
  const winnerAgentName = winner?.agentName || run.participants.find((participant) => participant.id === winnerAgentId)?.name || 'Unknown'

  return {
    winnerAgentId,
    winnerAgentName,
    verdictSummary: `${buildWinnerNarrative(winner, runnerUp)} ${cleanOutput(winner?.summary || '')}`.trim(),
    scorecards: run.scorecardSnapshot.map((scorecard) => ({
      ...scorecard,
      summary: cleanOutput(scorecard.summary) || `${scorecard.agentName} completed the run with ${scorecard.total} total points.`,
    })),
    decisiveMoments: deriveDecisiveMoments(events),
    headInterventionSummary: trimList(
      events
        .filter((event) => event.kind === 'head_intervention')
        .map((event) => event.summary),
      4
    ),
    unresolvedQuestions: trimDistinctNarratives(run.ledger.unresolvedThreads.map((item) => cleanPressureThread(item)), 5, 0.7),
    improvementNotes: trimList([
      'Press the winner harder on the strongest remaining counterargument.',
      'Force one more direct answer on the unresolved operational tradeoff.',
      'Reduce repetition earlier when claims start converging.',
    ], 5),
    createdAt: new Date().toISOString(),
  }
}

function getRequiredTargetId(run: ArenaRun, events: ArenaEvent[], speakerId: string, round: number): string | null {
  if (run.participantIds.length < 2) {
    return null
  }

  const priorRoundAttack = [...events]
    .reverse()
    .find((event) => {
      if (event.kind !== 'debater_turn' || event.round !== round - 1 || !event.speakerAgentId || event.speakerAgentId === speakerId) {
        return false
      }

      const payload = getEventPayload(event)
      const targets = trimList(payload.targetAgentIds, run.participantIds.length)
      return targets.includes(speakerId)
    })

  if (priorRoundAttack?.speakerAgentId) {
    return priorRoundAttack.speakerAgentId
  }

  const scoreSortedOpponents = [...run.scorecardSnapshot]
    .filter((scorecard) => scorecard.agentId !== speakerId)
    .sort(compareScorecards)

  return scoreSortedOpponents[0]?.agentId || run.participantIds.find((participantId) => participantId !== speakerId) || null
}

function getRequiredMoveType(stage: ArenaStage, round: number, hasPendingAttack: boolean, closing = false): DebateMoveType {
  if (closing) {
    return 'closing'
  }

  if (stage === 'opening' && round === 1) {
    return 'thesis'
  }

  if (stage === 'opening') {
    return 'rebuttal'
  }

  if (stage === 'crossfire') {
    return round % 2 === 1 || !hasPendingAttack ? 'example' : 'rebuttal'
  }

  if (stage === 'narrowing') {
    return 'tradeoff'
  }

  return 'rebuttal'
}

function getOpponentClaimDigest(run: ArenaRun, speakerId: string): string[] {
  const previousRound = getRecentRoundLedger(run, 1)[0]
  if (!previousRound) {
    return []
  }

  return previousRound.claimHighlights
    .filter((claim) => claim.agentId !== speakerId)
    .map((claim) => `${claim.agentName}: ${claim.claim}`)
    .slice(0, 3)
}

function getLatestClaimForAgent(run: ArenaRun, agentId: string): string {
  for (const round of [...run.ledger.rounds].reverse()) {
    const claim = [...round.claimHighlights].reverse().find((entry) => entry.agentId === agentId)
    if (claim) {
      return claim.claim
    }
  }

  return ''
}

function normalizePressurePointForTarget(params: {
  raw: string
  claimSummary: string
  targetAgentName?: string
  focusQuestion?: string
  moveType: DebateMoveType
  topic: string
  targetAlignment: ArenaAlignmentTag
}): string {
  const targetLabel = cleanOutput(params.targetAgentName) || 'The opposing seat'
  const rawCore = cleanPressureCore(params.raw)
  const focusCore = cleanPressureCore(params.focusQuestion || '')
  const claimCore = cleanPressureCore(params.claimSummary)

  let core = rawCore
  if (!core || claimSimilarity(core, claimCore) >= 0.9) {
    core = focusCore || core
  }
  if (!core) {
    core = claimCore || 'the strongest unresolved tradeoff'
  }

  const defenseFrame = compactPromptText(buildAlignmentDefenseFrame(params.topic, params.targetAlignment), 120)
  const challengeCore = compactPromptText(core.replace(/\.$/, ''), 160)

  if (params.moveType === 'example') {
    return `${targetLabel} must show with one concrete mechanism or failure mode why ${defenseFrame}, despite this challenge: ${challengeCore}.`
  }

  if (params.moveType === 'tradeoff') {
    return `${targetLabel} must resolve the decisive tradeoff and show why ${defenseFrame}, despite this challenge: ${challengeCore}.`
  }

  if (params.moveType === 'closing') {
    return `${targetLabel} must explain why ${defenseFrame}, despite this challenge: ${challengeCore}.`
  }

  return `${targetLabel} must answer why ${defenseFrame}, despite this challenge: ${challengeCore}.`
}

function buildDeterministicHeadDirective(run: ArenaRun, round: number, stage: ArenaStage): HeadDirectiveResult {
  const previousRound = getRecentRoundLedger(run, 1)[0]
  const rotationOrder = rotateList(run.seats.map((seat) => seat.agentId), round - 1)
  const pressureOrder = run.seats
    .map((seat) => {
      const notebook = run.participantNotebooks.find((entry) => entry.agentId === seat.agentId)
      const scorecard = run.scorecardSnapshot.find((entry) => entry.agentId === seat.agentId)

      return {
        agentId: seat.agentId,
        attackPressure: notebook?.attacksToAnswer.length || 0,
        score: scorecard?.total || 0,
        rotationIndex: rotationOrder.indexOf(seat.agentId),
      }
    })
    .sort((left, right) => {
      if (right.attackPressure !== left.attackPressure) {
        return right.attackPressure - left.attackPressure
      }

      if (left.score !== right.score) {
        return left.score - right.score
      }

      return left.rotationIndex - right.rotationIndex
    })
    .map((entry) => entry.agentId)

  const strongestAttack = run.participantNotebooks
    .flatMap((notebook) => notebook.attacksToAnswer.slice(0, 1))
    .filter(Boolean)[0]
  const repeatedPairs = previousRound
    ? detectRoundRepetition(previousRound.claimHighlights.map((claim) => ({ agentId: claim.agentId, claim: claim.claim })))
    : []

  let focusQuestion = run.ledger.unresolvedThreads[0] || run.config.topic
  let directive = 'Drive the debate at the strongest unresolved issue.'
  let scoreSignals = ['direct answers', 'specific pressure', 'clear contrast']
  let rationaleSummary = 'Deterministic orchestration is keeping the round focused and distinct.'

  if (stage === 'opening' && round === 1) {
    focusQuestion = 'What is your strongest case for your assigned side, and what decision criterion should decide this debate?'
    directive = 'Establish your side clearly, define the decision criterion, and target one concrete weakness in the opposing case.'
    scoreSignals = ['clear thesis', 'decision criterion', 'targeted attack']
    rationaleSummary = 'Round one should establish distinct lanes instead of abstract agreement.'
  } else if (stage === 'opening') {
    focusQuestion = buildFreshFocusQuestion(
      run,
      stage,
      strongestAttack || previousRound?.focusQuestion || 'Which assumption from the previous round fails under scrutiny?'
    )
    directive = 'Stop broad framing. Answer the sharpest attack from the previous round first, then tighten the contrast.'
    scoreSignals = ['direct rebuttal', 'specific evidence', 'no stance drift']
    rationaleSummary = 'Round two should turn the opening claims into direct conflict.'
  } else if (stage === 'crossfire') {
    focusQuestion = buildFreshFocusQuestion(
      run,
      stage,
      strongestAttack || run.ledger.unresolvedThreads[0] || 'Which concrete mechanism or failure mode actually decides this question?'
    )
    directive = repeatedPairs.length > 0
      ? 'Differentiate your case from the others. Do not repeat the same consistency-versus-flexibility frame. Answer the live attack and add one concrete mechanism or failure mode.'
      : 'Answer the live attack first, then raise one concrete mechanism, example, or failure mode that shifts the debate.'
    scoreSignals = ['new evidence', 'direct answer', 'distinct framing']
    rationaleSummary = repeatedPairs.length > 0
      ? 'The prior round started converging, so this round forces differentiation.'
      : 'Crossfire rounds should convert abstract positions into concrete pressure.'
  } else if (stage === 'narrowing') {
    focusQuestion = buildFreshFocusQuestion(
      run,
      stage,
      run.ledger.unresolvedThreads[0] || 'Which single tradeoff should decide the verdict?'
    )
    directive = 'Compress the debate to one decisive tradeoff, give the head a verdict-ready contrast, and stop reopening old branches.'
    scoreSignals = ['decision-ready tradeoff', 'tight contrast', 'verdict clarity']
    rationaleSummary = 'Late rounds should narrow the argument to a final decision frame.'
  }

  return {
    directive,
    focusQuestion,
    speakerOrder: pressureOrder.length > 0 ? pressureOrder : rotationOrder,
    scoreSignals,
    rationaleSummary,
  }
}

function getEventPayload(event: ArenaEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object'
    ? event.payload as Record<string, unknown>
    : {}
}

function buildDeterministicFinalReport(run: ArenaRun, events: ArenaEvent[]): ArenaReport {
  const sortedScorecards = [...run.scorecardSnapshot].sort(compareScorecards)
  const winner = sortedScorecards[0] || run.scorecardSnapshot[0]
  const runnerUp = sortedScorecards[1]
  const winnerAgentId = winner?.agentId || run.participantIds[0]
  const winnerAgentName = winner?.agentName || run.participants.find((participant) => participant.id === winnerAgentId)?.name || 'Unknown'
  const decisiveMoments = deriveDecisiveMoments(events)

  return {
    winnerAgentId,
    winnerAgentName,
    verdictSummary: winner
      ? `${buildWinnerNarrative(winner, runnerUp)} ${cleanOutput(winner.summary)}`
      : 'The arena completed, but no score leader could be derived.',
    scorecards: run.scorecardSnapshot.map((scorecard) => ({
      ...scorecard,
      summary: cleanOutput(scorecard.summary),
    })),
    decisiveMoments,
    headInterventionSummary: trimList(
      events
        .filter((event) => event.kind === 'head_intervention')
        .map((event) => event.summary),
      4
    ),
    unresolvedQuestions: trimDistinctNarratives(run.ledger.unresolvedThreads.map((item) => cleanPressureThread(item)), 5, 0.72),
    improvementNotes: trimList([
      run.ledger.unresolvedThreads[0] ? `Force a cleaner answer to: ${cleanPressureThread(run.ledger.unresolvedThreads[0])}` : '',
      decisiveMoments.length < 2 ? 'Push for more concrete examples or failure modes earlier in the debate.' : '',
      'Reduce paraphrased restatements when two seats start converging on the same frame.',
    ], 5),
    createdAt: new Date().toISOString(),
  }
}

async function getArenaRunById(id: string): Promise<ArenaRun | null> {
  if (readsFromPostgres(getPersistenceMode())) {
    return ArenaRepository.getRun(id)
  }

  return getArenaRunFromFirestore(id)
}

async function listArenaEvents(runId: string): Promise<ArenaEvent[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return ArenaRepository.listEvents(runId)
  }

  return listArenaEventsFromFirestore(runId)
}

async function listArenaSummaries(limitCount: number): Promise<ArenaRunSummary[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return ArenaRepository.listRecent(limitCount)
  }

  return listArenaRunSummariesFromFirestore(limitCount)
}

async function saveRun(record: ArenaRun): Promise<ArenaRun> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeArenaRunToFirestore(record)
    return record
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'arena_run',
      entityId: record.id,
      operation: 'upsert',
      payload: { payload: record },
      primary: async () => {
        await writeArenaRunToFirestore(record)
        return record
      },
      secondary: async () => ArenaRepository.upsertRun(record),
    })
  }

  return runMirroredWrite({
    entityType: 'arena_run',
    entityId: record.id,
    operation: 'upsert',
    payload: { payload: record },
    primary: async () => ArenaRepository.upsertRun(record),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeArenaRunToFirestore(record)
        }
      : undefined,
  })
}

async function saveEvent(record: ArenaEvent): Promise<ArenaEvent> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeArenaEventToFirestore(record)
    return record
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'arena_event',
      entityId: record.id,
      operation: 'upsert',
      payload: { payload: record },
      primary: async () => {
        await writeArenaEventToFirestore(record)
        return record
      },
      secondary: async () => ArenaRepository.saveEvent(record),
    })
  }

  return runMirroredWrite({
    entityType: 'arena_event',
    entityId: record.id,
    operation: 'upsert',
    payload: { payload: record },
    primary: async () => ArenaRepository.saveEvent(record),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeArenaEventToFirestore(record)
        }
      : undefined,
  })
}

async function generateStructuredOutput<T>({
  system,
  user,
  maxTokens,
  temperature,
  providerInfo,
  validator,
}: {
  system: string
  user: string
  maxTokens: number
  temperature: number
  providerInfo?: LLMProviderInfo | null
  validator: (parsed: T) => string[]
}): Promise<T> {
  const runValidator = (parsed: T): string[] => {
    try {
      return validator(parsed)
    } catch {
      return ['structured output shape mismatch']
    }
  }

  const parseAndValidate = (value: string): { parsed: T | null; errors: string[] } => {
    const parsedResult = safeParseJsonWithExtraction<T>(value)
    if (!parsedResult.parsed) {
      return {
        parsed: null,
        errors: ['response was not valid JSON'],
      }
    }

    return {
      parsed: parsedResult.parsed,
      errors: runValidator(parsedResult.parsed),
    }
  }

  const initial = await generateText({
    providerInfo,
    maxTokens,
    temperature,
    messages: [
      { role: 'system', content: system },
      { role: 'user', content: user },
    ],
    timeoutMs: 120000,
  })

  const firstPass = parseAndValidate(initial.content)
  if (firstPass.parsed && firstPass.errors.length === 0) {
    return firstPass.parsed
  }

  const repair = await generateText({
    providerInfo,
    maxTokens,
    temperature: 0.2,
    messages: [
      { role: 'system', content: 'Repair the candidate so it becomes valid JSON only. Do not add commentary.' },
      {
        role: 'user',
        content: [
          'Return JSON only that satisfies the original contract.',
          `Validation failures to fix: ${(firstPass.errors || []).join('; ') || 'response was not valid JSON'}.`,
          'If the prior content was semantically wrong, rewrite it from scratch instead of lightly editing it.',
          'Original system prompt:',
          system,
          'Original user prompt:',
          user,
          'Candidate output:',
          initial.content,
        ].join('\n\n'),
      },
    ],
    timeoutMs: 120000,
  })

  const repaired = parseAndValidate(repair.content)
  if (repaired.parsed && repaired.errors.length === 0) {
    return repaired.parsed
  }

  const regeneration = await generateText({
    providerInfo,
    maxTokens,
    temperature: 0.15,
    messages: [
      { role: 'system', content: `${system}\n\nReturn corrected JSON only. Do not reuse invalid phrasing.` },
      {
        role: 'user',
        content: [
          user,
          `Previous attempt failed validation for: ${(repaired.errors.length > 0 ? repaired.errors : firstPass.errors).join('; ')}.`,
          'Regenerate the full JSON response from scratch and fix every listed issue.',
        ].join('\n\n'),
      },
    ],
    timeoutMs: 120000,
  })

  const regenerated = parseAndValidate(regeneration.content)
  if (!regenerated.parsed) {
    throw new Error('Arena JSON regeneration failed to parse.')
  }

  if (regenerated.errors.length > 0) {
    throw new Error(`Arena JSON validation failed: ${regenerated.errors.join(', ')}`)
  }

  return regenerated.parsed
}

function buildArenaConstitution(): string {
  return [
    'You are participating in an inspectable multi-agent arena.',
    'One local model is impersonating multiple speakers, so role isolation matters.',
    'Never speak as another debater.',
    'Never speak as the head unless explicitly told you are the head.',
    'Do not mention prompts, JSON, schemas, instructions, or hidden system behavior.',
    'Avoid generic assistant framing. Stay concrete, specific, and in-seat.',
    `Prompt version: ${PROMPT_VERSION}.`,
  ].join('\n')
}

function buildHeadPrompt(run: ArenaRun, round: number, stage: ArenaStage, events: ArenaEvent[]): { system: string; user: string } {
  const recentRounds = getRecentRoundLedger(run, 2)
  const intervention = events
    .filter((event) => event.kind === 'head_intervention')
    .slice(-1)[0]

  return {
    system: [
      buildArenaConstitution(),
      'You are the Arena Head. Your job is to direct the debate, tighten scope, and keep turns purposeful.',
      'Return JSON only with keys: directive, focusQuestion, speakerOrder, scoreSignals, rationaleSummary.',
      'speakerOrder must contain every participant id exactly once.',
      'Keep directives short, sharp, and debate-driving.',
      `JSON shape example: {"directive":"...","focusQuestion":"...","speakerOrder":["${run.participantIds[0]}"],"scoreSignals":["..."],"rationaleSummary":"..."}`,
    ].join('\n\n'),
    user: [
      `Topic: ${run.config.topic}`,
      `Objective: ${run.config.objective}`,
      `Round: ${round}/${run.config.roundCount}`,
      `Phase: ${stageLabel(stage)}`,
      `Response budget: ${run.config.responseBudget}`,
      run.config.referenceBrief ? `Reference brief: ${run.config.referenceBrief}` : undefined,
      `Participants:\n${run.seats.map((seat) => `- ${seat.agentName} (${seat.agentId}) as ${seat.seatLabel}: ${seat.stanceBrief}`).join('\n')}`,
      `Current standings:\n${run.scorecardSnapshot.map((scorecard) => `- ${scorecard.agentName}: ${scorecard.total} total points`).join('\n')}`,
      `Recent ledger:\n${summarizeLedger(recentRounds)}`,
      intervention ? `Latest intervention reminder: ${intervention.content}` : undefined,
      'Return JSON only.',
    ].filter(Boolean).join('\n\n'),
  }
}

function buildDebaterPrompt(params: {
  run: ArenaRun
  seat: ArenaSeat
  speaker: ArenaParticipant
  notebook: ArenaParticipantNotebook
  directive: HeadDirectiveResult
  stage: ArenaStage
  round: number
  requiredTargetId: string | null
  requiredMoveType: DebateMoveType
  closing?: boolean
}): { system: string; user: string } {
  const roundDigest = summarizeLedger(getRecentRoundLedger(params.run, 2))
  const budget = budgetConfig(params.run.config.responseBudget)
  const alignmentTag = getSeatAlignmentTag(params.seat.orderIndex, params.run.participants.length)
  const targetSeat = params.requiredTargetId
    ? params.run.seats.find((seat) => seat.agentId === params.requiredTargetId)
    : undefined
  const opponentClaims = getOpponentClaimDigest(params.run, params.speaker.id)
  const compactStance = compactPromptText(params.seat.stanceBrief, 260)
  const compactWinCondition = compactPromptText(params.seat.winCondition, 160)

  return {
    system: [
      buildArenaConstitution(),
      `You are ${params.speaker.name}.`,
      `Seat: ${params.seat.seatLabel}.`,
      `Alignment tag: ${alignmentTag}. ${getAlignmentInstruction(alignmentTag)}`,
      `Stance brief: ${compactStance}`,
      `Win condition: ${compactWinCondition}`,
      'Your seat is structurally adversarial. Do not defect to the opposing conclusion unless making a narrow concession.',
      'Your claimSummary must say why your own seat still wins. Do not use claimSummary to restate why the opposing side is right.',
      'claimSummary must be a single thesis sentence from your own side. Do not mention any participant by name in claimSummary.',
      'nextPressurePoint must describe what the opponent still has to prove while staying in their own assigned lane. Do not ask them to argue your side for you.',
      'If you concede a point, keep it to one clause and end the turn by reaffirming your assigned side.',
      `Required move type: ${params.requiredMoveType}. ${getMoveInstruction(params.requiredMoveType)}`,
      params.closing
        ? 'You are writing a closing statement. Compress your strongest position into a verdict-ready case. Do not end by assigning homework or reopening the debate.'
        : 'You are writing one debate turn. Stay aggressive, precise, and in-seat.',
      `Return JSON only with keys: message, claimSummary, targetAgentIds, concedes, confidence, nextPressurePoint, alignmentTag, moveType.`,
      `message should be ${params.closing ? budget.closingWords : budget.turnWords}.`,
      `JSON shape example: {"message":"...","claimSummary":"...","targetAgentIds":["${params.run.participantIds.find((id) => id !== params.speaker.id) || params.speaker.id}"],"concedes":[],"confidence":0.68,"nextPressurePoint":"...","alignmentTag":"${alignmentTag}","moveType":"${params.requiredMoveType}"}`,
      'Do not begin message with filler such as "Alright", "Okay", "Of course", "Certainly", or "Here\'s". Start with the claim itself.',
    ].join('\n\n'),
    user: [
      `Topic: ${params.run.config.topic}`,
      `Objective: ${params.run.config.objective}`,
      `Round: ${params.round}/${params.run.config.roundCount}`,
      `Phase: ${stageLabel(params.stage)}`,
      `Head directive: ${params.directive.directive}`,
      `Focus question: ${params.directive.focusQuestion}`,
      targetSeat ? `Required target: ${targetSeat.agentName} (${targetSeat.agentId}).` : 'Required target: name the sharpest opponent explicitly.',
      `Your notebook:\n- Latest commitments: ${params.notebook.commitments.slice(0, 2).join(' | ') || 'none'}\n- Attacks to answer: ${params.notebook.attacksToAnswer.slice(0, 2).join(' | ') || 'none'}\n- Concessions already made: ${params.notebook.concessions.slice(0, 2).join(' | ') || 'none'}\n- Next pressure points: ${params.notebook.nextPressurePoints.slice(0, 2).join(' | ') || 'none'}`,
      `Avoid repeating these claims: ${params.notebook.commitments.slice(0, 2).join(' | ') || 'none'}`,
      'Novelty requirement: do not reuse the same example domain or mechanism from your last commitments unless you are directly rebutting it. If needed, rotate to a different release workflow, failure mode, or operational example.',
      opponentClaims.length > 0 ? `Recent opposing claims:\n- ${opponentClaims.join('\n- ')}` : undefined,
      `Recent arena ledger:\n${roundDigest}`,
      `Other seats:\n${params.run.seats.filter((seat) => seat.agentId !== params.seat.agentId).map((seat) => `- ${seat.agentName}: ${seat.seatLabel}`).join('\n')}`,
      `Seat discipline reminder: ${getAlignmentInstruction(alignmentTag)}`,
      params.closing
        ? 'Land your final strongest case. Do not introduce a brand-new tangent. Do not ask the opponent another question in the closing.'
        : 'Answer the head focus question, defend your seat, target the required opponent, and add one new concrete mechanism, example, or failure mode if possible.',
    ].join('\n\n'),
  }
}

function buildReportPrompt(run: ArenaRun, events: ArenaEvent[]): { system: string; user: string } {
  return {
    system: [
      buildArenaConstitution(),
      'You are the Arena Head final evaluator.',
      'Return JSON only with keys: winnerAgentId, verdictSummary, scorecards, decisiveMoments, headInterventionSummary, unresolvedQuestions, improvementNotes.',
      'Each scorecard entry must include agentId and summary.',
      'Each decisive moment should reference an eventId when possible.',
      'Use the actual run evidence, not abstract judging language.',
      `JSON shape example: {"winnerAgentId":"${run.participantIds[0]}","verdictSummary":"...","scorecards":[{"agentId":"${run.participantIds[0]}","summary":"..."}],"decisiveMoments":[],"headInterventionSummary":[],"unresolvedQuestions":[],"improvementNotes":[]}`,
    ].join('\n\n'),
    user: [
      `Topic: ${run.config.topic}`,
      `Objective: ${run.config.objective}`,
      `Rounds completed: ${run.currentRound}/${run.config.roundCount}`,
      `Standings:\n${run.scorecardSnapshot.map((scorecard) => `- ${scorecard.agentName}: ${scorecard.total} total, summary: ${scorecard.summary}`).join('\n')}`,
      `Ledger:\n${summarizeLedger(run.ledger.rounds)}`,
      `Recent event references:\n${events.slice(-12).map((event) => `- ${event.id} | round ${event.round || 0} | ${event.title} | ${event.summary}`).join('\n')}`,
      'Crown one winner and explain why.',
      'Return JSON only.',
    ].join('\n\n'),
  }
}

async function isCancellationRequested(runId: string): Promise<boolean> {
  if (readsFromPostgres(getPersistenceMode())) {
    const run = await ArenaRepository.getRun(runId)
    return Boolean(run?.cancellationRequested)
  }

  const snapshot = await getDoc(doc(db, ARENA_COLLECTION, runId))
  return snapshot.exists() ? Boolean(snapshot.data().cancellationRequested) : false
}

export class ArenaService {
  async listRuns(limitCount = 12): Promise<ArenaRunSummary[]> {
    return listArenaSummaries(limitCount)
  }

  async getRunDetail(runId: string): Promise<ArenaRunDetail | null> {
    const run = await getArenaRunById(runId)
    if (!run) {
      return null
    }

    const events = await listArenaEvents(runId)
    return { run, events }
  }

  async createRun(input: CreateArenaRunInput): Promise<ArenaRunDetail> {
    const participantIds = ensureParticipantIds(input.participantIds)
    if (participantIds.length < MIN_PARTICIPANTS || participantIds.length > MAX_PARTICIPANTS) {
      throw new Error(`Arena requires ${MIN_PARTICIPANTS}-${MAX_PARTICIPANTS} participants.`)
    }

    const topic = cleanOutput(input.topic)
    if (!topic) {
      throw new Error('Arena topic is required.')
    }

    const agents = await AgentService.getAllAgents()
    const selectedAgents = participantIds
      .map((participantId) => agents.find((agent) => agent.id === participantId))
      .filter((agent): agent is AgentRecord => Boolean(agent))

    if (selectedAgents.length !== participantIds.length) {
      throw new Error('One or more selected agents could not be found.')
    }

    const participants: ArenaParticipant[] = selectedAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      persona: agent.persona,
      goals: agent.goals,
    }))

    const agentsById = new Map(selectedAgents.map((agent) => [agent.id, agent]))
    const seats = createSeats(participants, agentsById, input.seatOverrides)
    const now = new Date().toISOString()
    const run: ArenaRun = {
      id: generateId('arena'),
      status: 'draft',
      latestStage: 'seat_generation',
      currentRound: 0,
      eventCount: 0,
      participantIds,
      participants,
      config: {
        topic,
        objective: cleanOutput(input.objective || 'Expose the best path forward, the tradeoffs, and the strongest counter-position.'),
        participantIds,
        roundCount: clampRoundCount(input.roundCount),
        responseBudget: normalizeBudget(input.responseBudget),
        sandboxed: true,
        mode: 'debate_v1',
        referenceBrief: cleanOutput(input.referenceBrief || '') || undefined,
        seatOverrides: input.seatOverrides?.filter((override) => participantIds.includes(override.agentId)),
      },
      seats,
      scorecardSnapshot: createInitialScorecards(participants),
      ledger: {
        rounds: [],
        unresolvedThreads: [],
      },
      participantNotebooks: createInitialNotebooks(participants),
      sandboxed: true,
      cancellationRequested: false,
      createdAt: now,
      updatedAt: now,
    }

    await saveRun(run)

    const preparedEvent: ArenaEvent = {
      id: generateId('arena_event'),
      runId: run.id,
      sequence: 1,
      stage: 'prepare',
      kind: 'run_prepared',
      speakerType: 'system',
      title: 'Arena prepared',
      content: `Prepared a sandboxed debate run for ${participants.map((participant) => participant.name).join(', ')}.`,
      summary: `Topic: ${run.config.topic}`,
      payload: {
        topic: run.config.topic,
        objective: run.config.objective,
        roundCount: run.config.roundCount,
        responseBudget: run.config.responseBudget,
      },
      createdAt: now,
    }

    const seatEvent: ArenaEvent = {
      id: generateId('arena_event'),
      runId: run.id,
      sequence: 2,
      stage: 'seat_generation',
      kind: 'seat_generated',
      speakerType: 'system',
      title: 'Seats generated',
      content: seats.map((seat) => `${seat.agentName}: ${seat.seatLabel}`).join(' • '),
      summary: 'Generated editable debate seats for the roster.',
      payload: {
        seats,
      },
      createdAt: now,
    }

    await saveEvent(preparedEvent)
    await saveEvent(seatEvent)

    run.eventCount = 2
    run.updatedAt = new Date().toISOString()
    await saveRun(run)

    return {
      run,
      events: [preparedEvent, seatEvent],
    }
  }

  async updateRun(runId: string, input: UpdateArenaRunInput): Promise<ArenaRunDetail> {
    const run = await getArenaRunById(runId)
    if (!run) {
      throw new Error('Arena run not found.')
    }

    if (run.status !== 'draft') {
      throw new Error('Only draft arena runs can be edited.')
    }

    run.config.topic = cleanOutput(input.topic || run.config.topic)
    run.config.objective = cleanOutput(input.objective || run.config.objective)
    run.config.roundCount = clampRoundCount(input.roundCount || run.config.roundCount)
    run.config.responseBudget = normalizeBudget(input.responseBudget || run.config.responseBudget)
    run.config.referenceBrief = cleanOutput(input.referenceBrief || run.config.referenceBrief || '') || undefined

    if (input.seats?.length) {
      run.seats = run.seats.map((seat) => {
        const override = input.seats?.find((entry) => entry.agentId === seat.agentId)
        if (!override) {
          return seat
        }

        return {
          ...seat,
          seatLabel: cleanOutput(override.seatLabel || seat.seatLabel),
          stanceBrief: cleanOutput(override.stanceBrief || seat.stanceBrief),
          winCondition: cleanOutput(override.winCondition || seat.winCondition),
          source: 'manual',
        }
      })
    }

    run.updatedAt = new Date().toISOString()
    await saveRun(run)

    const events = await listArenaEvents(runId)
    return { run, events }
  }

  async requestCancel(runId: string): Promise<ArenaRunDetail> {
    const detail = await this.getRunDetail(runId)
    if (!detail) {
      throw new Error('Arena run not found.')
    }

    detail.run.cancellationRequested = true
    if (detail.run.status === 'draft') {
      detail.run.status = 'cancelled'
      detail.run.latestStage = 'completed'
      detail.run.completedAt = new Date().toISOString()
    }
    detail.run.updatedAt = new Date().toISOString()
    await saveRun(detail.run)

    if (detail.run.status === 'cancelled') {
      const event: ArenaEvent = {
        id: generateId('arena_event'),
        runId: detail.run.id,
        sequence: detail.run.eventCount + 1,
        stage: 'completed',
        kind: 'run_cancelled',
        speakerType: 'system',
        title: 'Arena cancelled',
        content: 'Cancelled before execution began.',
        summary: 'Draft arena run cancelled.',
        createdAt: new Date().toISOString(),
      }
      await saveEvent(event)
      detail.run.eventCount += 1
      await saveRun(detail.run)
      detail.events.push(event)
    }

    return detail
  }

  async executeRun(runId: string, providerInfo?: LLMProviderInfo | null): Promise<ArenaRunDetail> {
    const detail = await this.getRunDetail(runId)
    if (!detail) {
      throw new Error('Arena run not found.')
    }

    const events = [...detail.events]
    const run = detail.run

    if (run.status === 'completed' || run.status === 'cancelled') {
      return { run, events }
    }

    if (run.status === 'running') {
      return { run, events }
    }

    const resolvedProviderInfo = providerInfo ? await resolveProviderInfoModel(providerInfo) : providerInfo
    const useDeterministicHead = resolvedProviderInfo?.provider === 'ollama'
    const useDeterministicReport = resolvedProviderInfo?.provider === 'ollama'
    const debaterTemperature = resolvedProviderInfo?.provider === 'ollama' ? 0.28 : 0.5
    const closingTemperature = resolvedProviderInfo?.provider === 'ollama' ? 0.22 : 0.45

    run.status = 'running'
    run.latestStage = 'opening'
    run.provider = resolvedProviderInfo?.provider || run.provider
    run.model = resolvedProviderInfo?.model || run.model
    run.updatedAt = new Date().toISOString()
    await saveRun(run)

    let activeStage: ArenaStage | null = null

    try {
      for (let round = 1; round <= run.config.roundCount; round++) {
        if (await isCancellationRequested(run.id)) {
          run.status = 'cancelled'
          run.latestStage = 'completed'
          run.completedAt = new Date().toISOString()
          run.updatedAt = run.completedAt
          const cancelledEvent: ArenaEvent = {
            id: generateId('arena_event'),
            runId: run.id,
            sequence: run.eventCount + 1,
            stage: 'completed',
            kind: 'run_cancelled',
            speakerType: 'system',
            round,
            title: 'Arena cancelled',
            content: 'Stopped the arena at the next safe boundary.',
            summary: 'Arena execution cancelled.',
            createdAt: run.completedAt,
          }
          await saveEvent(cancelledEvent)
          events.push(cancelledEvent)
          run.eventCount += 1
          await saveRun(run)
          return { run, events }
        }

        const stage = getStageForRound(round, run.config.roundCount)
        if (activeStage !== stage) {
          if (activeStage) {
            const completedEvent: ArenaEvent = {
              id: generateId('arena_event'),
              runId: run.id,
              sequence: run.eventCount + 1,
              stage: activeStage,
              kind: 'phase_completed',
              speakerType: 'system',
              round: round - 1,
              title: `${stageLabel(activeStage)} phase completed`,
              content: `Completed ${stageLabel(activeStage)}.`,
              summary: `Phase closed after round ${round - 1}.`,
              createdAt: new Date().toISOString(),
            }
            await saveEvent(completedEvent)
            events.push(completedEvent)
            run.eventCount += 1
          }

          activeStage = stage
          run.latestStage = stage
          run.updatedAt = new Date().toISOString()
          await saveRun(run)

          const phaseEvent: ArenaEvent = {
            id: generateId('arena_event'),
            runId: run.id,
            sequence: run.eventCount + 1,
            stage,
            kind: 'phase_started',
            speakerType: 'system',
            round,
            title: `${stageLabel(stage)} phase started`,
            content: `Entering ${stageLabel(stage)} for round ${round}.`,
            summary: `Head is shifting the arena into ${stageLabel(stage)}.`,
            createdAt: new Date().toISOString(),
          }
          await saveEvent(phaseEvent)
          events.push(phaseEvent)
          run.eventCount += 1
        }

        let headDirective: HeadDirectiveResult
        let headDegradedReason: string | null = null
        if (useDeterministicHead) {
          headDirective = buildDeterministicHeadDirective(run, round, stage)
        } else {
          const headPrompt = buildHeadPrompt(run, round, stage, events)
          try {
            const headRaw = await generateStructuredOutput<HeadDirectiveResult>({
              system: headPrompt.system,
              user: headPrompt.user,
              maxTokens: budgetConfig(run.config.responseBudget).headTokens,
              temperature: 0.35,
              providerInfo: resolvedProviderInfo,
              validator: (parsed) => validateHeadDirective(parsed, run.participantIds),
            })
            headDirective = normalizeHeadDirective(headRaw, run.participantIds)
          } catch (error) {
            headDirective = buildFallbackHeadDirective(run, round, stage)
            headDegradedReason = error instanceof Error ? error.message : 'Head directive generation failed.'
          }
        }

        const headEvent: ArenaEvent = {
          id: generateId('arena_event'),
          runId: run.id,
          sequence: run.eventCount + 1,
          stage,
          kind: 'head_directive',
          speakerType: 'head',
          round,
          title: `Round ${round} directive`,
          content: headDirective.directive,
          summary: headDirective.focusQuestion,
          payload: {
            speakerOrder: headDirective.speakerOrder,
            scoreSignals: headDirective.scoreSignals,
            rationaleSummary: headDirective.rationaleSummary,
            degraded: Boolean(headDegradedReason),
            degradedReason: headDegradedReason,
            strategy: useDeterministicHead ? 'deterministic' : 'model',
          },
          createdAt: new Date().toISOString(),
        }
        await saveEvent(headEvent)
        events.push(headEvent)
        run.eventCount += 1
        run.ledger.latestDirective = headDirective.directive
        run.ledger.latestFocusQuestion = headDirective.focusQuestion

        const roundClaims: Array<{ agentId: string; agentName: string; claim: string }> = []
        const incomingAttackMap = new Map<string, string[]>()

        for (const speakerId of headDirective.speakerOrder) {
          if (await isCancellationRequested(run.id)) {
            run.cancellationRequested = true
            break
          }

          const speaker = run.participants.find((participant) => participant.id === speakerId)
          const seat = run.seats.find((entry) => entry.agentId === speakerId)
          const notebook = run.participantNotebooks.find((entry) => entry.agentId === speakerId)
          if (!speaker || !seat || !notebook) {
            continue
          }

          const requiredTargetId = getRequiredTargetId(run, events, speaker.id, round)
          const requiredMoveType = getRequiredMoveType(stage, round, notebook.attacksToAnswer.length > 0)

          const turnPrompt = buildDebaterPrompt({
            run,
            seat,
            speaker,
            notebook,
            directive: headDirective,
            stage,
            round,
            requiredTargetId,
            requiredMoveType,
          })
          let turn: DebaterTurnResult
          let turnDegradedReason: string | null = null
          try {
            const turnRaw = await generateStructuredOutput<DebaterTurnResult>({
              system: turnPrompt.system,
              user: turnPrompt.user,
              maxTokens: budgetConfig(run.config.responseBudget).debaterTokens,
              temperature: debaterTemperature,
              providerInfo: resolvedProviderInfo,
              validator: (parsed) => validateDebaterResultForConstraints({
                parsed,
                speaker,
                participants: run.participants,
                notebook,
                expectedAlignment: getSeatAlignmentTag(seat.orderIndex, run.participants.length),
                requiredMoveType,
                requiredTargetId,
                round,
              }),
            })
            turn = normalizeDebaterResult(turnRaw, {
              speakerId: speaker.id,
              participantIds: run.participantIds,
              alignmentTag: getSeatAlignmentTag(seat.orderIndex, run.participants.length),
              topic: run.config.topic,
              fallbackReason: seat.winCondition,
              participants: run.participants,
            })
          } catch (error) {
            turn = buildFallbackDebaterTurn({
              run,
              seat,
              speaker,
              notebook,
              directive: headDirective,
              requiredTargetId,
              requiredMoveType,
            })
            turnDegradedReason = error instanceof Error ? error.message : 'Debater turn generation failed.'
          }

          const primaryTargetId = turn.targetAgentIds[0] || requiredTargetId || undefined
          const primaryTargetSeat = primaryTargetId
            ? run.seats.find((entry) => entry.agentId === primaryTargetId)
            : undefined
          turn.nextPressurePoint = normalizePressurePointForTarget({
            raw: turn.nextPressurePoint,
            claimSummary: turn.claimSummary,
            targetAgentName: primaryTargetSeat?.agentName,
            focusQuestion: headDirective.focusQuestion,
            moveType: (turn.moveType as DebateMoveType) || requiredMoveType,
            topic: run.config.topic,
            targetAlignment: primaryTargetSeat
              ? getSeatAlignmentTag(primaryTargetSeat.orderIndex, run.participants.length)
              : alignmentTag,
          })

          const scoreDelta = scoreTurn({
            result: turn,
            speaker,
            participants: run.participants,
            previousNotebook: notebook,
            requiredTargetId,
          })
          run.scorecardSnapshot = mergeScorecards(run.scorecardSnapshot, scoreDelta)
          roundClaims.push({
            agentId: speaker.id,
            agentName: speaker.name,
            claim: turn.claimSummary,
          })

          for (const targetId of turn.targetAgentIds) {
            const targetSpeaker = run.participants.find((participant) => participant.id === targetId)
            const note = cleanPressureThread(turn.nextPressurePoint)
            incomingAttackMap.set(targetId, trimDistinctNarratives([note, ...(incomingAttackMap.get(targetId) || [])], 4, 0.7))
            if (!targetSpeaker) {
              continue
            }
          }

          const turnEvent: ArenaEvent = {
            id: generateId('arena_event'),
            runId: run.id,
            sequence: run.eventCount + 1,
            stage,
            kind: 'debater_turn',
            speakerType: 'debater',
            speakerAgentId: speaker.id,
            speakerName: speaker.name,
            round,
            title: `${speaker.name} takes the floor`,
            content: turn.message,
            summary: turn.claimSummary,
            payload: {
              targetAgentIds: turn.targetAgentIds,
              concedes: turn.concedes,
              confidence: turn.confidence,
              nextPressurePoint: turn.nextPressurePoint,
              alignmentTag: turn.alignmentTag,
              moveType: turn.moveType,
              requiredTargetId,
              requiredMoveType,
              scoreDelta,
              degraded: Boolean(turnDegradedReason),
              degradedReason: turnDegradedReason,
            },
            createdAt: new Date().toISOString(),
          }
          await saveEvent(turnEvent)
          events.push(turnEvent)
          run.eventCount += 1
        }

        if (run.cancellationRequested) {
          run.status = 'cancelled'
          run.latestStage = 'completed'
          run.completedAt = new Date().toISOString()
          run.updatedAt = run.completedAt
          const cancelledEvent: ArenaEvent = {
            id: generateId('arena_event'),
            runId: run.id,
            sequence: run.eventCount + 1,
            stage: 'completed',
            kind: 'run_cancelled',
            speakerType: 'system',
            round,
            title: 'Arena cancelled',
            content: 'Stopped the arena after the current partial round.',
            summary: 'Arena execution cancelled.',
            createdAt: run.completedAt,
          }
          await saveEvent(cancelledEvent)
          events.push(cancelledEvent)
          run.eventCount += 1
          await saveRun(run)
          return { run, events }
        }

        run.participantNotebooks = run.participantNotebooks.map((entry) => {
          const turnEvent = events
            .filter((event) => event.kind === 'debater_turn' && event.speakerAgentId === entry.agentId && event.round === round)
            .slice(-1)[0]
          if (!turnEvent) {
            return entry
          }

          const payload = (turnEvent.payload || {}) as Record<string, unknown>
          const normalizedTurn: DebaterTurnResult = {
            message: turnEvent.content,
            claimSummary: turnEvent.summary,
            targetAgentIds: Array.isArray(payload.targetAgentIds) ? payload.targetAgentIds.map(String) : [],
            concedes: Array.isArray(payload.concedes) ? payload.concedes.map(String) : [],
            confidence: typeof payload.confidence === 'number' ? payload.confidence : 0.6,
            nextPressurePoint: typeof payload.nextPressurePoint === 'string' ? payload.nextPressurePoint : '',
          }

          return updateNotebook(entry, normalizedTurn, incomingAttackMap.get(entry.agentId) || [])
        })

        const unresolvedThreads = trimDistinctNarratives([
          ...Array.from(incomingAttackMap.values()).flat().map((item) => cleanPressureThread(item)),
          cleanPressureThread(headDirective.focusQuestion),
          roundClaims.length > 0 && Array.from(incomingAttackMap.values()).flat().length === 0
            ? `What concrete evidence or failure mode best distinguishes these positions: ${roundClaims.map((claim) => `${claim.agentName} says ${claim.claim}`).join(' / ')}`
            : '',
        ], 5, 0.7)

        const roundSummary: ArenaEvent = {
          id: generateId('arena_event'),
          runId: run.id,
          sequence: run.eventCount + 1,
          stage,
          kind: 'round_summary',
          speakerType: 'system',
          round,
          title: `Round ${round} compressed`,
          content: `${headDirective.focusQuestion} ${roundClaims.map((claim) => `${claim.agentName}: ${claim.claim}`).join(' ')}`.trim(),
          summary: `Round ${round} captured ${roundClaims.length} active positions with ${unresolvedThreads.length} live pressure points.`,
          payload: {
            claimHighlights: roundClaims,
            unresolvedThreads,
          },
          createdAt: new Date().toISOString(),
        }
        await saveEvent(roundSummary)
        events.push(roundSummary)
        run.eventCount += 1

        const scoreUpdate: ArenaEvent = {
          id: generateId('arena_event'),
          runId: run.id,
          sequence: run.eventCount + 1,
          stage,
          kind: 'score_update',
          speakerType: 'system',
          round,
          title: `Round ${round} score update`,
          content: run.scorecardSnapshot.map((scorecard) => `${scorecard.agentName}: ${scorecard.total}`).join(' • '),
          summary: `Scores updated after round ${round}.`,
          payload: {
            scorecards: run.scorecardSnapshot,
          },
          createdAt: new Date().toISOString(),
        }
        await saveEvent(scoreUpdate)
        events.push(scoreUpdate)
        run.eventCount += 1

        const duplicatedClaims = detectRoundRepetition(roundClaims.map((claim) => ({ agentId: claim.agentId, claim: claim.claim })))
        if (duplicatedClaims.length > 0) {
          const interventionEvent: ArenaEvent = {
            id: generateId('arena_event'),
            runId: run.id,
            sequence: run.eventCount + 1,
            stage,
            kind: 'head_intervention',
            speakerType: 'head',
            round,
            title: 'Head intervention',
            content: 'Your claims are converging. Differentiate your case, answer the live attack directly, and add one concrete mechanism or failure mode.',
            summary: 'Head detected repetition and tightened the debate.',
            payload: {
              repeatedClaims: duplicatedClaims,
            },
            createdAt: new Date().toISOString(),
          }
          await saveEvent(interventionEvent)
          events.push(interventionEvent)
          run.eventCount += 1
        }

        run.currentRound = round
        run.ledger.rounds.push({
          round,
          phase: stage,
          focusQuestion: headDirective.focusQuestion,
          claimHighlights: roundClaims,
          unresolvedThreads,
          scoreSnapshot: run.scorecardSnapshot,
          summary: roundSummary.content,
        })
        run.ledger.unresolvedThreads = unresolvedThreads
        run.updatedAt = new Date().toISOString()
        await saveRun(run)
      }

      if (activeStage) {
        const completedEvent: ArenaEvent = {
          id: generateId('arena_event'),
          runId: run.id,
          sequence: run.eventCount + 1,
          stage: activeStage,
          kind: 'phase_completed',
          speakerType: 'system',
          round: run.currentRound,
          title: `${stageLabel(activeStage)} phase completed`,
          content: `Completed ${stageLabel(activeStage)}.`,
          summary: 'Debate rounds completed.',
          createdAt: new Date().toISOString(),
        }
        await saveEvent(completedEvent)
        events.push(completedEvent)
        run.eventCount += 1
      }

      run.latestStage = 'closing'
      run.updatedAt = new Date().toISOString()
      await saveRun(run)

      const closingDirective: HeadDirectiveResult = {
        directive: 'Deliver one closing statement that sharpens your strongest case and makes one final contrast.',
        focusQuestion: 'What should the head conclude after hearing your strongest final framing?',
        speakerOrder: run.seats.map((seat) => seat.agentId),
        scoreSignals: [],
        rationaleSummary: 'Closings should compress the case, not reopen the debate.',
      }

      const closingPhaseEvent: ArenaEvent = {
        id: generateId('arena_event'),
        runId: run.id,
        sequence: run.eventCount + 1,
        stage: 'closing',
        kind: 'phase_started',
        speakerType: 'system',
        round: run.currentRound,
        title: 'Closing phase started',
        content: 'The head has moved the arena into final closing statements.',
        summary: 'Each debater now lands a final concise case.',
        createdAt: new Date().toISOString(),
      }
      await saveEvent(closingPhaseEvent)
      events.push(closingPhaseEvent)
      run.eventCount += 1

      const useDeterministicClosing = resolvedProviderInfo?.provider === 'ollama'
      for (const seat of run.seats) {
        const speaker = run.participants.find((participant) => participant.id === seat.agentId)
        const notebook = run.participantNotebooks.find((entry) => entry.agentId === seat.agentId)
        if (!speaker || !notebook) {
          continue
        }

        const requiredClosingTargetId = getRequiredTargetId(run, events, speaker.id, run.currentRound)
        let closingResult: DebaterTurnResult
        let closingDegradedReason: string | null = null
        if (useDeterministicClosing) {
          closingResult = buildDeterministicClosingTurn({
            run,
            seat,
            speaker,
            notebook,
            directive: closingDirective,
            requiredTargetId: requiredClosingTargetId,
          })
        } else {
          const closingPrompt = buildDebaterPrompt({
            run,
            seat,
            speaker,
            notebook,
            directive: closingDirective,
            stage: 'closing',
            round: run.currentRound,
            requiredTargetId: requiredClosingTargetId,
            requiredMoveType: 'closing',
            closing: true,
          })
          try {
            const closingRaw = await generateStructuredOutput<DebaterTurnResult>({
              system: closingPrompt.system,
              user: closingPrompt.user,
              maxTokens: budgetConfig(run.config.responseBudget).closingTokens,
              temperature: closingTemperature,
              providerInfo: resolvedProviderInfo,
              validator: (parsed) => validateDebaterResultForConstraints({
                parsed,
                speaker,
                participants: run.participants,
                notebook,
                expectedAlignment: getSeatAlignmentTag(seat.orderIndex, run.participants.length),
                requiredMoveType: 'closing',
                requiredTargetId: requiredClosingTargetId,
                round: run.currentRound,
              }),
            })
            closingResult = normalizeDebaterResult(closingRaw, {
              speakerId: speaker.id,
              participantIds: run.participantIds,
              alignmentTag: getSeatAlignmentTag(seat.orderIndex, run.participants.length),
              topic: run.config.topic,
              fallbackReason: seat.winCondition,
              participants: run.participants,
            })
          } catch (error) {
            closingResult = buildFallbackDebaterTurn({
              run,
              seat,
              speaker,
              notebook,
              directive: closingDirective,
              requiredTargetId: requiredClosingTargetId,
              requiredMoveType: 'closing',
              closing: true,
            })
            closingDegradedReason = error instanceof Error ? error.message : 'Closing statement generation failed.'
          }
        }

        const closingEvent: ArenaEvent = {
          id: generateId('arena_event'),
          runId: run.id,
          sequence: run.eventCount + 1,
          stage: 'closing',
          kind: 'debater_turn',
          speakerType: 'debater',
          speakerAgentId: speaker.id,
          speakerName: speaker.name,
          round: run.currentRound,
          title: `${speaker.name} closing statement`,
          content: closingResult.message,
          summary: closingResult.claimSummary,
          payload: {
            closing: true,
            concedes: closingResult.concedes,
            nextPressurePoint: closingResult.nextPressurePoint,
            alignmentTag: closingResult.alignmentTag,
            moveType: closingResult.moveType,
            degraded: Boolean(closingDegradedReason),
            degradedReason: closingDegradedReason,
          },
          createdAt: new Date().toISOString(),
        }
        await saveEvent(closingEvent)
        events.push(closingEvent)
        run.eventCount += 1
      }

      const closingComplete: ArenaEvent = {
        id: generateId('arena_event'),
        runId: run.id,
        sequence: run.eventCount + 1,
        stage: 'closing',
        kind: 'phase_completed',
        speakerType: 'system',
        round: run.currentRound,
        title: 'Closing phase completed',
        content: 'All closing statements have been delivered.',
        summary: 'The arena is ready for final evaluation.',
        createdAt: new Date().toISOString(),
      }
      await saveEvent(closingComplete)
      events.push(closingComplete)
      run.eventCount += 1

      run.latestStage = 'report'
      run.updatedAt = new Date().toISOString()
      await saveRun(run)

      let report: ArenaReport
      let reportDegradedReason: string | null = null
      if (useDeterministicReport) {
        report = buildDeterministicFinalReport(run, events)
      } else {
        const reportPrompt = buildReportPrompt(run, events)
        try {
          const reportRaw = await generateStructuredOutput<FinalReportResult>({
            system: reportPrompt.system,
            user: reportPrompt.user,
            maxTokens: budgetConfig(run.config.responseBudget).reportTokens,
            temperature: 0.25,
            providerInfo: resolvedProviderInfo,
            validator: (parsed) => {
              const errors: string[] = []
              if (!cleanOutput(parsed.verdictSummary)) {
                errors.push('missing verdict summary')
              }
              if (!Array.isArray(parsed.scorecards)) {
                errors.push('missing scorecards')
              }
              return errors
            },
          })

          report = normalizeFinalReport(reportRaw, run, events)
        } catch (error) {
          report = buildFallbackFinalReport(run, events)
          reportDegradedReason = error instanceof Error ? error.message : 'Final report generation failed.'
        }
      }

      run.finalReport = report
      run.winnerAgentId = report.winnerAgentId
      run.status = 'completed'
      run.latestStage = 'completed'
      run.completedAt = new Date().toISOString()
      run.updatedAt = run.completedAt

      const reportEvent: ArenaEvent = {
        id: generateId('arena_event'),
        runId: run.id,
        sequence: run.eventCount + 1,
        stage: 'report',
        kind: 'report_published',
        speakerType: 'head',
        round: run.currentRound,
        title: `Head verdict: ${report.winnerAgentName}`,
        content: report.verdictSummary,
        summary: `Winner: ${report.winnerAgentName}`,
        payload: {
          report,
          degraded: Boolean(reportDegradedReason),
          degradedReason: reportDegradedReason,
          strategy: useDeterministicReport ? 'deterministic' : 'model',
        },
        createdAt: run.completedAt,
      }
      await saveEvent(reportEvent)
      events.push(reportEvent)
      run.eventCount += 1
      await saveRun(run)
      await relationshipOrchestrator.applyArenaOutcome(run, events)

      return { run, events }
    } catch (error) {
      const failureMessage = error instanceof Error ? error.message : 'Arena execution failed.'
      run.status = 'failed'
      run.latestStage = 'report'
      run.failureReason = failureMessage
      run.updatedAt = new Date().toISOString()
      run.completedAt = run.updatedAt

      const failedEvent: ArenaEvent = {
        id: generateId('arena_event'),
        runId: run.id,
        sequence: run.eventCount + 1,
        stage: run.latestStage,
        kind: 'run_failed',
        speakerType: 'system',
        round: run.currentRound,
        title: 'Arena failed',
        content: failureMessage,
        summary: 'Arena execution failed before completion.',
        createdAt: run.updatedAt,
      }
      await saveEvent(failedEvent)
      events.push(failedEvent)
      run.eventCount += 1
      await saveRun(run)
      return { run, events }
    }
  }
}

export const arenaService = new ArenaService()
