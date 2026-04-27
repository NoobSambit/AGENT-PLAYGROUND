import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { generateId } from '@/lib/db/utils'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { ChallengeLabRepository, toChallengeRunSummary } from '@/lib/repositories/challengeLabRepository'
import { ArenaRepository } from '@/lib/repositories/arenaRepository'
import { RelationshipRepository } from '@/lib/repositories/relationshipRepository'
import {
  getArenaRunFromFirestore,
  listArenaEventsFromFirestore,
  listArenaRunsFromFirestore,
} from '@/lib/arena/firestoreStore'
import {
  getActiveChallengeRunForAgentFromFirestore,
  getChallengeRunFromFirestore,
  listChallengeEventsFromFirestore,
  listChallengeParticipantResultsFromFirestore,
  listChallengeResultHistoryFromFirestore,
  listChallengeRunsForAgentFromFirestore,
  writeChallengeEventToFirestore,
  writeChallengeParticipantResultToFirestore,
  writeChallengeRunToFirestore,
} from '@/lib/challenges/firestoreStore'
import { AgentService } from '@/lib/services/agentService'
import { agentProgressService } from '@/lib/services/agentProgressService'
import { MemoryService } from '@/lib/services/memoryService'
import { relationshipOrchestrator } from '@/lib/services/relationshipOrchestrator'
import { generateText } from '@/lib/llm/provider'
import { resolveProviderInfoModel } from '@/lib/llm/ollama'
import type { LLMProviderInfo } from '@/lib/llmConfig'
import { detectTextLeakage } from '@/lib/services/outputQuality/flags'
import { normalizeStringList, normalizeWhitespace, safeParseJsonWithExtraction } from '@/lib/services/outputQuality/normalizers'
import type {
  AgentRecord,
  ChallengeArenaFollowupCandidate,
  ChallengeDeterministicCheck,
  ChallengeEvent,
  ChallengeEventKind,
  ChallengeExecutionBudget,
  ChallengeLabBootstrap,
  ChallengeParticipantResult,
  ChallengeRelationshipCandidate,
  ChallengeRolePacket,
  ChallengeRun,
  ChallengeRunDetail,
  ChallengeRunMode,
  ChallengeRunReport,
  ChallengeScorecard,
  ChallengeStage,
  ChallengeTemplate,
  ChallengeTemplateId,
  ChallengeTurn,
  ArenaEvent,
  ArenaRun,
  RelationshipSignalKind,
} from '@/types/database'

const PROMPT_VERSION = 'challenge-lab-v1'

export const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  {
    id: 'solo_memory_precision',
    mode: 'solo_capability',
    group: 'solo',
    title: 'Memory Precision',
    purpose: 'Tests grounded recall, source use, and hallucination resistance.',
    brief: 'Answer a recall prompt using only known context and cite source-style anchors when possible.',
    minParticipants: 1,
    maxParticipants: 1,
    scoringFocus: ['grounded recall', 'source discipline', 'uncertainty handling'],
  },
  {
    id: 'solo_decision_pressure',
    mode: 'solo_capability',
    group: 'solo',
    title: 'Decision Pressure',
    purpose: 'Tests tradeoff reasoning under constraints.',
    brief: 'Make a bounded recommendation under competing goals, risks, and limited time.',
    minParticipants: 1,
    maxParticipants: 1,
    scoringFocus: ['tradeoffs', 'constraint satisfaction', 'decision clarity'],
  },
  {
    id: 'solo_creation_to_spec',
    mode: 'solo_capability',
    group: 'solo',
    title: 'Creation To Spec',
    purpose: 'Tests creative output against a concrete brief.',
    brief: 'Produce a compact artifact that satisfies explicit constraints and style requirements.',
    minParticipants: 1,
    maxParticipants: 1,
    scoringFocus: ['brief adherence', 'specificity', 'creative usefulness'],
  },
  {
    id: 'pair_collaboration_delivery',
    mode: 'pair_trial',
    group: 'relationship',
    title: 'Collaboration Delivery',
    purpose: 'Tests cooperation, handoff quality, synthesis, and follow-through.',
    brief: 'Two agents divide work, coordinate, and deliver a shared answer.',
    minParticipants: 2,
    maxParticipants: 2,
    scoringFocus: ['handoff quality', 'synthesis', 'follow-through'],
    relationshipSignals: ['coalition', 'support', 'follow_through'],
  },
  {
    id: 'pair_conflict_repair',
    mode: 'pair_trial',
    group: 'relationship',
    title: 'Conflict Repair',
    purpose: 'Tests disagreement, repair skill, tension handling, and respect.',
    brief: 'Two agents surface a disagreement, challenge each other, and repair toward a usable agreement.',
    minParticipants: 2,
    maxParticipants: 2,
    scoringFocus: ['constructive disagreement', 'repair', 'respect'],
    relationshipSignals: ['repair', 'constructive_disagreement', 'conflict'],
  },
  {
    id: 'arena_claim_proof',
    mode: 'arena_followup',
    group: 'arena_followup',
    title: 'Arena Claim Proof',
    purpose: 'Converts an arena claim or unresolved thread into an operational proof challenge.',
    brief: 'Prove or stress-test a claim from an arena thread, or use a manual claim when no arena source exists.',
    minParticipants: 1,
    maxParticipants: 2,
    scoringFocus: ['proof quality', 'counterargument handling', 'operational clarity'],
    relationshipSignals: ['competition', 'admiration', 'constructive_disagreement'],
  },
]

interface CreateChallengeRunInput {
  templateId: string
  participantIds: string[]
  scenario?: string
  sourceArenaRunId?: string
  sourceEventIds?: string[]
  executionBudget?: ChallengeExecutionBudget
}

function clampScore(value: unknown): number {
  const score = Number(value)
  if (!Number.isFinite(score)) return 0
  return Math.max(0, Math.min(100, Math.round(score)))
}

function clean(value: unknown, fallback = ''): string {
  return normalizeWhitespace(String(value || fallback)).slice(0, 4000)
}

function escapeRegExp(value: string) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function cleanAgentTurnOutput(content: unknown, agentName: string, participantNames: string[]): string {
  let text = clean(content)
  const labelPattern = participantNames.map(escapeRegExp).join('|')
  if (labelPattern) {
    text = text.replace(new RegExp(`^\\s*(?:(?:${labelPattern})\\s*[:,-]\\s*)+`, 'i'), '')
  }
  const selfPattern = escapeRegExp(agentName)
  text = text.replace(new RegExp(`\\b${selfPattern}\\s*[’']s\\b`, 'gi'), 'my')
  text = text.replace(new RegExp(`\\b${selfPattern}\\s+will\\b`, 'gi'), 'I will')
  text = text.replace(new RegExp(`\\b${selfPattern}\\s+should\\b`, 'gi'), 'I should')
  text = text.replace(new RegExp(`\\b${selfPattern}\\s+can\\b`, 'gi'), 'I can')
  text = text.replace(new RegExp(`\\bCould you,?\\s+${selfPattern},?\\s+help\\s+`, 'i'), 'I will help ')
  text = text.replace(new RegExp(`\\bCould you,?\\s+${selfPattern},?\\s+`, 'i'), 'I will ')
  text = text.replace(new RegExp(`\\b${selfPattern}\\b`, 'gi'), 'me')
  text = text.replace(/^\s*(?:certainly|sure|of course)[,.]?\s+/i, '')
  return clean(text)
}

function normalizeJudgeScorecards(value: unknown): Array<Partial<ChallengeScorecard> & { agentId: string }> {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const candidate = entry as Partial<ChallengeScorecard>
      const agentId = clean(candidate.agentId)
      return agentId ? { ...candidate, agentId } : null
    })
    .filter((entry): entry is Partial<ChallengeScorecard> & { agentId: string } => Boolean(entry))
}

function normalizeJudgeRelationshipDrafts(value: unknown): Array<Partial<ChallengeRunReport['relationshipSignals'][number]>> {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is Partial<ChallengeRunReport['relationshipSignals'][number]> => Boolean(entry && typeof entry === 'object'))
}

function templateFor(id: string): ChallengeTemplate | undefined {
  return CHALLENGE_TEMPLATES.find((template) => template.id === id)
}

function shouldUseFirestore(mode = getPersistenceMode()) {
  return !readsFromPostgres(mode)
}

async function persistRun(run: ChallengeRun): Promise<ChallengeRun> {
  const mode = getPersistenceMode()
  if (mode === 'firestore') {
    await writeChallengeRunToFirestore(run)
    return run
  }

  return runMirroredWrite({
    entityType: 'challenge_run',
    entityId: run.id,
    operation: 'upsert',
    payload: run as unknown as Record<string, unknown>,
    primary: async () => readsFromPostgres(mode) ? ChallengeLabRepository.upsertRun(run) : (await writeChallengeRunToFirestore(run), run),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => { await writeChallengeRunToFirestore(run) }
      : mode === 'dual-write-firestore-read'
        ? async () => ChallengeLabRepository.upsertRun(run)
        : undefined,
  })
}

async function persistEvent(event: ChallengeEvent): Promise<ChallengeEvent> {
  const mode = getPersistenceMode()
  if (mode === 'firestore') {
    await writeChallengeEventToFirestore(event)
    return event
  }

  return runMirroredWrite({
    entityType: 'challenge_event',
    entityId: event.id,
    operation: 'upsert',
    payload: event as unknown as Record<string, unknown>,
    primary: async () => readsFromPostgres(mode) ? ChallengeLabRepository.saveEvent(event) : (await writeChallengeEventToFirestore(event), event),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => { await writeChallengeEventToFirestore(event) }
      : mode === 'dual-write-firestore-read'
        ? async () => ChallengeLabRepository.saveEvent(event)
        : undefined,
  })
}

async function persistResult(result: ChallengeParticipantResult): Promise<ChallengeParticipantResult> {
  const mode = getPersistenceMode()
  if (mode === 'firestore') {
    await writeChallengeParticipantResultToFirestore(result)
    return result
  }

  return runMirroredWrite({
    entityType: 'challenge_result',
    entityId: result.id,
    operation: 'upsert',
    payload: result as unknown as Record<string, unknown>,
    primary: async () => readsFromPostgres(mode) ? ChallengeLabRepository.saveParticipantResult(result) : (await writeChallengeParticipantResultToFirestore(result), result),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => { await writeChallengeParticipantResultToFirestore(result) }
      : mode === 'dual-write-firestore-read'
        ? async () => ChallengeLabRepository.saveParticipantResult(result)
        : undefined,
  })
}

async function loadRun(runId: string): Promise<ChallengeRun | null> {
  return shouldUseFirestore()
    ? getChallengeRunFromFirestore(runId)
    : ChallengeLabRepository.getRun(runId)
}

async function loadEvents(runId: string): Promise<ChallengeEvent[]> {
  return shouldUseFirestore()
    ? listChallengeEventsFromFirestore(runId)
    : ChallengeLabRepository.listEvents(runId)
}

async function loadResults(runId: string): Promise<ChallengeParticipantResult[]> {
  return shouldUseFirestore()
    ? listChallengeParticipantResultsFromFirestore(runId)
    : ChallengeLabRepository.listParticipantResults(runId)
}

async function listRunsForAgent(agentId: string, limitCount: number): Promise<ChallengeRun[]> {
  return shouldUseFirestore()
    ? listChallengeRunsForAgentFromFirestore(agentId, limitCount)
    : ChallengeLabRepository.listRecentForAgent(agentId, limitCount)
}

async function getActiveRun(agentId: string): Promise<ChallengeRun | null> {
  return shouldUseFirestore()
    ? getActiveChallengeRunForAgentFromFirestore(agentId)
    : ChallengeLabRepository.getActiveRunForAgent(agentId)
}

async function listResultHistory(agentId: string, limitCount: number): Promise<ChallengeParticipantResult[]> {
  return shouldUseFirestore()
    ? listChallengeResultHistoryFromFirestore(agentId, limitCount)
    : ChallengeLabRepository.listResultHistory(agentId, limitCount)
}

async function listRecentArenaRuns(limitCount: number): Promise<ArenaRun[]> {
  return shouldUseFirestore()
    ? listArenaRunsFromFirestore(limitCount)
    : ArenaRepository.listRecentRuns(limitCount)
}

async function getArenaRun(runId: string): Promise<ArenaRun | null> {
  return shouldUseFirestore()
    ? getArenaRunFromFirestore(runId)
    : ArenaRepository.getRun(runId)
}

async function listArenaEvents(runId: string): Promise<ArenaEvent[]> {
  return shouldUseFirestore()
    ? listArenaEventsFromFirestore(runId)
    : ArenaRepository.listEvents(runId)
}

function makeEvent(
  run: ChallengeRun,
  kind: ChallengeEventKind,
  stage: ChallengeStage,
  title: string,
  content: string,
  overrides: Partial<ChallengeEvent> = {}
): ChallengeEvent {
  return {
    id: generateId('challenge_event'),
    runId: run.id,
    sequence: run.eventCount + 1,
    stage,
    kind,
    speakerType: 'system',
    title,
    content,
    createdAt: new Date().toISOString(),
    ...overrides,
  }
}

async function appendEvent(run: ChallengeRun, events: ChallengeEvent[], event: ChallengeEvent) {
  await persistEvent(event)
  events.push(event)
  run.eventCount = event.sequence
  run.updatedAt = new Date().toISOString()
  await persistRun(run)
}

function defaultScenario(template: ChallengeTemplate, participants: ChallengeRun['participants']): string {
  if (template.id === 'solo_memory_precision') {
    return `Recall a grounded detail from ${participants[0].name}'s persona, goals, or recent memories. If the evidence is thin, say what is known and what is uncertain.`
  }
  if (template.id === 'solo_decision_pressure') {
    return 'Choose between speed, quality, and relationship impact for a high-stakes agent workflow. Give a decision, tradeoffs, and a guardrail.'
  }
  if (template.id === 'solo_creation_to_spec') {
    return 'Create a concise field note for an inspectable agent console: 120-180 words, concrete, no generic assistant framing.'
  }
  if (template.id === 'pair_conflict_repair') {
    return 'The agents disagree on whether to prioritize truthfulness or emotional safety. Surface the disagreement and repair toward a usable protocol.'
  }
  if (template.id === 'arena_claim_proof') {
    return 'Turn an unresolved claim into a proof: state the claim, evidence, counterpoint, and what would change the conclusion.'
  }
  return 'Deliver a shared answer by dividing responsibilities, handing off clearly, and synthesizing the final recommendation.'
}

function buildRolePackets(template: ChallengeTemplate, run: ChallengeRun, relationshipSummary = ''): ChallengeRolePacket[] {
  return run.participants.map((participant, index) => {
    const isSkeptic = template.id === 'arena_claim_proof' && run.participants.length === 2 && index === 1
    return {
      agentId: participant.id,
      role: isSkeptic
        ? 'skeptic'
        : template.mode === 'pair_trial' && index === 1
          ? 'synthesizer'
          : template.mode === 'pair_trial'
            ? 'lead collaborator'
            : 'primary respondent',
      objective: isSkeptic
        ? 'Stress-test the claim with a concrete counterexample and request operational proof.'
        : template.brief,
      constraints: [
        'Stay in character with the agent persona.',
        'Use concrete evidence or acknowledge uncertainty.',
        'Avoid markdown tables and schema wrappers.',
        relationshipSummary ? `Relationship context: ${relationshipSummary}` : '',
      ].filter(Boolean),
      successCriteria: template.scoringFocus,
    }
  })
}

async function buildContext(run: ChallengeRun): Promise<string> {
  const memoryGroups = await Promise.all(run.participantIds.map(async (agentId) => {
    try {
      const memories = await MemoryService.getRecentMemories(agentId, 4)
      return memories.map((memory) => `${memory.summary || memory.content} [memory:${memory.id}]`).join('\n')
    } catch {
      return ''
    }
  }))
  const relationship = run.participantIds.length === 2
    ? await RelationshipRepository.getPair(run.participantIds[0], run.participantIds[1])
    : null

  const agentBlock = run.participants.map((participant, index) => [
    `${participant.name}: ${participant.persona}`,
    `Goals: ${participant.goals.join('; ') || 'none recorded'}`,
    memoryGroups[index] ? `Recent memories:\n${memoryGroups[index]}` : '',
  ].filter(Boolean).join('\n')).join('\n\n')

  const relationshipBlock = relationship
    ? `Relationship: ${relationship.status}; types ${relationship.relationshipTypes.join(', ') || 'none'}; trust ${Math.round(relationship.metrics.trust * 100)}; tension ${Math.round(relationship.derived.tension * 100)}.`
    : ''
  let arenaBlock = ''
  if (run.sourceArenaRunId) {
    const [arenaRun, arenaEvents] = await Promise.all([
      getArenaRun(run.sourceArenaRunId).catch(() => null),
      listArenaEvents(run.sourceArenaRunId).catch(() => []),
    ])
    const sourceEventIds = new Set(run.sourceEventIds || [])
    const selectedEvents = arenaEvents
      .filter((event) => sourceEventIds.size === 0 || sourceEventIds.has(event.id))
      .slice(0, 6)
    arenaBlock = [
      arenaRun ? `Arena source: ${arenaRun.config.topic}` : `Arena source: ${run.sourceArenaRunId}`,
      arenaRun?.finalReport?.verdictSummary ? `Arena verdict: ${arenaRun.finalReport.verdictSummary}` : '',
      selectedEvents.length
        ? `Source events:\n${selectedEvents.map((event) => `[arena:${event.id}] ${event.title}: ${event.summary || event.content}`).join('\n')}`
        : '',
    ].filter(Boolean).join('\n')
  }

  return [agentBlock, relationshipBlock, arenaBlock, run.scenario ? `Scenario: ${run.scenario}` : ''].filter(Boolean).join('\n\n')
}

async function generateAgentTurn(params: {
  run: ChallengeRun
  agent: ChallengeRun['participants'][number]
  role: ChallengeRolePacket
  round: number
  context: string
  previousTurns: ChallengeTurn[]
  providerInfo?: LLMProviderInfo | null
}) {
  const response = await generateText({
    providerInfo: params.providerInfo,
    temperature: 0.45,
    maxTokens: params.run.executionBudget === 'deep' ? 900 : 650,
    timeoutMs: 120000,
    messages: [
      {
        role: 'system',
        content: [
          `You are ${params.agent.name}. Respond only as this agent for a Challenge Lab run.`,
          'Write in first person from this agent perspective. Do not write dialogue labels, stage directions, JSON, scoring rubrics, or another participant response.',
          'Use "I will" for your own commitments, never "[your name] will". Do not refer to yourself by name anywhere. Do not begin with any participant name followed by a colon. Do not ask yourself to do work by name. If you address a partner, speak to them once, then give your own concrete contribution.',
        ].join(' '),
      },
      {
        role: 'user',
        content: [
          `Template: ${params.run.templateId}`,
          `Role: ${params.role.role}`,
          `Objective: ${params.role.objective}`,
          `Constraints:\n${params.role.constraints.map((item) => `- ${item}`).join('\n')}`,
          `Scenario:\n${params.run.scenario || ''}`,
          `Context:\n${params.context}`,
          params.previousTurns.length
            ? `Previous turns:\n${params.previousTurns.map((turn) => `${turn.agentName}: ${turn.content}`).join('\n\n')}`
            : '',
          'Write one self-contained challenge turn in 140-260 words. Use concrete details from the scenario/context, state uncertainty when evidence is thin, and end with an actionable next step.',
        ].filter(Boolean).join('\n\n'),
      },
    ],
  })

  return {
    content: cleanAgentTurnOutput(response.content, params.agent.name, params.run.participants.map((participant) => participant.name)),
    providerInfo: response.providerInfo,
  }
}

function deterministicChecks(run: ChallengeRun): ChallengeDeterministicCheck[] {
  const text = run.turns.map((turn) => turn.content).join('\n')
  const words = text.split(/\s+/).filter(Boolean).length
  const roleCoverage = run.rolePackets.every((role) => run.turns.some((turn) => turn.agentId === role.agentId))
  const evidenceRefs = /\[(memory|arena|event|source):/i.test(text) || /uncertain|known|evidence|because/i.test(text)
  const leakage = detectTextLeakage(text)
  const checks: ChallengeDeterministicCheck[] = [
    { id: 'completion', label: 'All assigned agents produced usable output', passed: roleCoverage, score: roleCoverage ? 100 : 20, details: roleCoverage ? 'Every participant has at least one turn.' : 'One or more participants did not produce a turn.' },
    { id: 'specificity', label: 'Specific, non-empty answer', passed: words >= 80, score: words >= 160 ? 100 : words >= 80 ? 72 : 25, details: `${words} words generated across the run.` },
    { id: 'length_bounds', label: 'Output stayed within bounded size', passed: words <= 1800, score: words <= 1800 ? 100 : 58, details: words <= 1800 ? 'Output stayed bounded.' : 'Output exceeded the preferred upper bound.' },
    { id: 'role_adherence', label: 'Role objectives were represented', passed: roleCoverage, score: roleCoverage ? 88 : 30, details: 'Role packets mapped to generated turns.' },
    { id: 'evidence_references', label: 'Evidence or uncertainty discipline', passed: evidenceRefs, score: evidenceRefs ? 82 : 48, details: evidenceRefs ? 'The response references evidence or uncertainty.' : 'The response lacks explicit evidence handling.' },
    { id: 'leakage', label: 'No wrapper or schema leakage', passed: leakage.length === 0, score: leakage.length === 0 ? 100 : 35, details: leakage.length ? leakage.join(', ') : 'No leakage detected.' },
  ]
  return checks
}

function averageScore(checks: ChallengeDeterministicCheck[]) {
  return Math.round(checks.reduce((sum, check) => sum + check.score, 0) / Math.max(1, checks.length))
}

interface JudgePayload {
  overallScore?: number
  capabilityScore?: number
  relationshipScore?: number
  perAgentScorecards?: Array<Partial<ChallengeScorecard> & { agentId: string }>
  keyEvidenceEventIds?: string[]
  weaknesses?: string[]
  strengths?: string[]
  verdictSummary?: string
  recommendedNextChallenge?: ChallengeTemplateId
  relationshipSignalDrafts?: Array<Partial<ChallengeRunReport['relationshipSignals'][number]>>
}

async function judgeRun(run: ChallengeRun, events: ChallengeEvent[], providerInfo?: LLMProviderInfo | null): Promise<{ parsed: JudgePayload | null; raw?: string }> {
  const response = await generateText({
    providerInfo,
    temperature: 0.15,
    maxTokens: 1100,
    timeoutMs: 120000,
    messages: [
      { role: 'system', content: 'You are a strict Challenge Lab judge. Return one valid JSON object only. No markdown, prose, or code fences.' },
      {
        role: 'user',
        content: `Evaluate this run. Clamp scores 0-100. Use only eventIds from the supplied eventIds list for evidence. Return exactly this JSON shape:
{
  "overallScore": 0,
  "capabilityScore": 0,
  "relationshipScore": 0,
  "perAgentScorecards": [{"agentId": "agent id from participants", "totalScore": 0, "capabilityScore": 0, "relationshipScore": 0, "strengths": ["specific strength"], "weaknesses": ["specific weakness"], "evidenceEventIds": ["challenge_event id"]}],
  "keyEvidenceEventIds": ["challenge_event id"],
  "weaknesses": ["specific weakness"],
  "strengths": ["specific strength"],
  "verdictSummary": "one concise paragraph",
  "recommendedNextChallenge": "solo_decision_pressure",
  "relationshipSignalDrafts": [{"agentId1": "left id", "agentId2": "right id", "signalKind": "constructive_disagreement", "valence": 0.1, "weight": 0.5, "confidence": 0.6, "summary": "traceable relationship signal", "excerptRefs": ["challenge_event id"]}]
}

Run:
${JSON.stringify({
          templateId: run.templateId,
          mode: run.mode,
          scenario: run.scenario,
          participants: run.participants,
          turns: run.turns,
          deterministicChecks: run.deterministicChecks,
          eventIds: events.map((event) => ({ id: event.id, kind: event.kind, speakerAgentId: event.speakerAgentId, summary: event.summary || event.title })),
        }, null, 2)}`,
      },
    ],
  })
  return {
    parsed: safeParseJsonWithExtraction<JudgePayload>(response.content).parsed,
    raw: response.content,
  }
}

function fallbackReport(run: ChallengeRun, events: ChallengeEvent[], degraded: boolean, judge?: JudgePayload | null, raw?: string): ChallengeRunReport {
  const deterministicScore = averageScore(run.deterministicChecks)
  const judgeScorecards = normalizeJudgeScorecards(judge?.perAgentScorecards)
  const overallScore = clampScore(judge?.overallScore ?? deterministicScore)
  const capabilityScore = clampScore(judge?.capabilityScore ?? deterministicScore)
  const relationshipScore = run.participantIds.length > 1 ? clampScore(judge?.relationshipScore ?? Math.round(deterministicScore * 0.88)) : undefined
  const agentEvents = events.filter((event) => event.kind === 'agent_turn_generated')
  const keyEvidenceEventIds = normalizeStringList(judge?.keyEvidenceEventIds || agentEvents.slice(-4).map((event) => event.id))
    .filter((id) => events.some((event) => event.id === id))
  const scorecards: ChallengeScorecard[] = run.participants.map((participant) => {
    const fromJudge = judgeScorecards.find((entry) => entry.agentId === participant.id)
    const totalScore = clampScore(fromJudge?.totalScore ?? overallScore)
    return {
      agentId: participant.id,
      agentName: participant.name,
      outcome: totalScore >= 70 ? 'passed' : 'failed',
      totalScore,
      capabilityScore: clampScore(fromJudge?.capabilityScore ?? capabilityScore),
      relationshipScore: relationshipScore === undefined ? undefined : clampScore(fromJudge?.relationshipScore ?? relationshipScore),
      strengths: normalizeStringList(fromJudge?.strengths || judge?.strengths || ['Produced a usable challenge response.']).slice(0, 4),
      weaknesses: normalizeStringList(fromJudge?.weaknesses || judge?.weaknesses || ['Needs more explicit evidence references in future runs.']).slice(0, 4),
      evidenceEventIds: normalizeStringList(fromJudge?.evidenceEventIds || keyEvidenceEventIds).filter((id) => events.some((event) => event.id === id)).slice(0, 6),
    }
  })
  if (run.mode === 'arena_followup' && run.participantIds.length === 2) {
    const winner = scorecards.reduce((best, scorecard) => scorecard.totalScore > best.totalScore ? scorecard : best, scorecards[0])
    for (const scorecard of scorecards) {
      scorecard.outcome = scorecard.agentId === winner.agentId ? 'winner' : 'runner_up'
    }
  }

  const relationshipSignals = normalizeRelationshipSignals(run, judge, keyEvidenceEventIds)

  return {
    id: generateId('challenge_report'),
    runId: run.id,
    templateId: run.templateId,
    overallScore,
    capabilityScore,
    relationshipScore,
    passed: scorecards.every((scorecard) => scorecard.outcome === 'passed' || scorecard.outcome === 'winner' || scorecard.outcome === 'runner_up') && overallScore >= 70,
    degraded,
    deterministicChecks: run.deterministicChecks,
    scorecards,
    strengths: normalizeStringList(judge?.strengths || ['The run completed with inspectable turns and a deterministic scoring trail.']).slice(0, 5),
    weaknesses: normalizeStringList(judge?.weaknesses || ['The judge used deterministic fallback for at least part of the report.']).slice(0, 5),
    verdictSummary: clean(judge?.verdictSummary, degraded ? 'Completed with deterministic fallback scoring.' : 'Completed with judge and deterministic rubric scoring.'),
    keyEvidenceEventIds,
    recommendedNextChallenge: templateFor(String(judge?.recommendedNextChallenge || '')) ? judge?.recommendedNextChallenge : recommendNext(run),
    relationshipSignals,
    judgeRawOutput: raw ? { raw } : undefined,
    validationWarnings: degraded ? ['judge_unavailable_or_invalid_json'] : [],
    promptVersion: PROMPT_VERSION,
    createdAt: new Date().toISOString(),
  }
}

function normalizeRelationshipSignals(run: ChallengeRun, judge: JudgePayload | null | undefined, fallbackRefs: string[]) {
  if (run.participantIds.length !== 2) return []
  const template = templateFor(run.templateId)
  const [left, right] = run.participantIds
  const allowed = template?.relationshipSignals || []
  const refs = fallbackRefs.length ? fallbackRefs : run.turns.map((turn) => turn.id).slice(0, 2)
  const fromJudge = normalizeJudgeRelationshipDrafts(judge?.relationshipSignalDrafts)
    .map((draft) => ({
      agentId1: String(draft.agentId1 || left),
      agentId2: String(draft.agentId2 || right),
      actorAgentId: draft.actorAgentId ? String(draft.actorAgentId) : undefined,
      targetAgentId: draft.targetAgentId ? String(draft.targetAgentId) : undefined,
      signalKind: allowed.includes(draft.signalKind as RelationshipSignalKind)
        ? draft.signalKind as RelationshipSignalKind
        : allowed[0],
      valence: Math.max(-1, Math.min(1, Number(draft.valence ?? 0.12))),
      weight: Math.max(0.1, Math.min(1, Number(draft.weight ?? 0.55))),
      confidence: Math.max(0.1, Math.min(1, Number(draft.confidence ?? 0.68))),
      summary: clean(draft.summary, `${template?.title || 'Challenge'} produced relationship evidence.`).slice(0, 300),
      excerptRefs: normalizeStringList(draft.excerptRefs || refs).filter((id) => refs.includes(id)).slice(0, 6),
    }))
    .filter((draft) => draft.agentId1 !== draft.agentId2 && draft.signalKind && draft.excerptRefs.length > 0)

  if (fromJudge.length > 0) return fromJudge

  return [{
    agentId1: left,
    agentId2: right,
    signalKind: allowed[0] || 'constructive_disagreement',
    valence: run.templateId === 'pair_conflict_repair' ? 0.08 : 0.16,
    weight: 0.52,
    confidence: 0.66,
    summary: `${template?.title || 'Challenge'} completed with traceable pair interaction.`,
    excerptRefs: refs,
  }]
}

function recommendNext(run: ChallengeRun): ChallengeTemplateId {
  if (run.templateId.startsWith('solo_')) return 'pair_collaboration_delivery'
  if (run.templateId === 'pair_collaboration_delivery') return 'pair_conflict_repair'
  if (run.templateId === 'pair_conflict_repair') return 'arena_claim_proof'
  return 'solo_decision_pressure'
}

async function applyProgressOnce(run: ChallengeRun, results: ChallengeParticipantResult[]) {
  if (run.progressAppliedAt) return
  for (const result of results) {
    await agentProgressService.applyChallengeOutcome(
      result.agentId,
      result.outcome === 'passed' || result.outcome === 'winner'
    )
  }
  run.progressAppliedAt = new Date().toISOString()
  await persistRun(run)
}

function makeParticipantResults(run: ChallengeRun, report: ChallengeRunReport): ChallengeParticipantResult[] {
  return report.scorecards.map((scorecard) => ({
    id: generateId('challenge_result'),
    runId: run.id,
    agentId: scorecard.agentId,
    templateId: run.templateId,
    mode: run.mode,
    outcome: scorecard.outcome,
    totalScore: scorecard.totalScore,
    capabilityScore: scorecard.capabilityScore,
    relationshipScore: scorecard.relationshipScore,
    createdAt: report.createdAt,
    payload: scorecard,
  }))
}

export class ChallengeLabService {
  getTemplates() {
    return CHALLENGE_TEMPLATES
  }

  async bootstrap(agentId: string): Promise<ChallengeLabBootstrap> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) throw new Error('Agent not found.')

    const [runs, activeRun, history, relationships, arenas] = await Promise.all([
      listRunsForAgent(agentId, 16),
      getActiveRun(agentId),
      listResultHistory(agentId, 20),
      RelationshipRepository.listForAgent(agentId).catch(() => []),
      listRecentArenaRuns(24).catch(() => []),
    ])

    const activeEvents = activeRun ? await loadEvents(activeRun.id) : []
    const scored = history.filter((result) => Number.isFinite(result.totalScore))
    const relationshipTrialCount = runs.filter((run) => run.mode === 'pair_trial' || run.participantIds.length === 2).length
    const completedCount = runs.filter((run) => run.status === 'completed').length
    const failedCount = runs.filter((run) => run.status === 'failed').length
    const relationshipCandidates: ChallengeRelationshipCandidate[] = relationships
      .map((relationship) => {
        const partnerId = relationship.agentId1 === agentId ? relationship.agentId2 : relationship.agentId1
        return {
          partnerId,
          partnerName: partnerId,
          relationshipTypes: relationship.relationshipTypes,
          status: relationship.status,
          tension: relationship.derived.tension,
          bondStrength: relationship.derived.bondStrength,
          recentSourceCounts: relationship.sourceStats,
          whyRecommended: relationship.derived.tension > 0.45
            ? 'High tension makes this pair useful for a repair trial.'
            : 'Existing bond makes this pair a good collaboration trial.',
        }
      })
      .sort((a, b) => (b.tension + b.bondStrength) - (a.tension + a.bondStrength))
      .slice(0, 6)

    const agentsById = new Map((await AgentService.getAllAgents()).map((entry) => [entry.id, entry.name]))
    for (const candidate of relationshipCandidates) {
      candidate.partnerName = agentsById.get(candidate.partnerId) || candidate.partnerId
    }

    const arenaFollowupCandidates: ChallengeArenaFollowupCandidate[] = arenas
      .filter((run) => run.status === 'completed')
      .filter((run) => run.participantIds.includes(agentId))
      .slice(0, 8)
      .map((run) => ({
        arenaRunId: run.id,
        title: run.config.topic,
        participantIds: run.participantIds,
        participantNames: run.participants.map((participant) => participant.name),
        winnerAgentId: run.winnerAgentId,
        completedAt: run.completedAt,
        suggestedScenario: run.finalReport?.unresolvedQuestions?.[0]
          ? `Prove or resolve this arena thread: ${run.finalReport.unresolvedQuestions[0]}`
          : `Prove the strongest unresolved claim from arena "${run.config.topic}".`,
        sourceEventIds: run.finalReport?.decisiveMoments?.map((moment) => moment.eventId).filter(Boolean) || [],
      }))

    return {
      agent: {
        id: agent.id,
        name: agent.name,
        challengesCompleted: agent.challengesCompleted || 0,
        challengeWins: agent.challengeWins || 0,
      },
      templates: CHALLENGE_TEMPLATES,
      recentRuns: runs.map((run) => toChallengeRunSummary(run, CHALLENGE_TEMPLATES)),
      activeRun,
      activeEvents,
      aggregateStats: {
        completedCount,
        failedCount,
        runningCount: runs.filter((run) => run.status === 'running').length,
        averageScore: scored.length ? Math.round(scored.reduce((sum, result) => sum + result.totalScore, 0) / scored.length) : 0,
        recentScore: scored[0]?.totalScore,
        relationshipTrialCount,
      },
      recommendedNextTemplates: [history[0]?.payload ? recommendNext({ templateId: history[0].templateId } as ChallengeRun) : 'solo_memory_precision', 'pair_collaboration_delivery'],
      relationshipCandidates,
      arenaFollowupCandidates,
    }
  }

  async getRunDetail(runId: string): Promise<ChallengeRunDetail | null> {
    const run = await loadRun(runId)
    if (!run) return null
    const [events, participantResults] = await Promise.all([
      loadEvents(runId),
      loadResults(runId),
    ])
    return { run, events, participantResults }
  }

  async createRun(primaryAgentId: string, input: CreateChallengeRunInput): Promise<ChallengeRunDetail> {
    const template = templateFor(input.templateId)
    if (!template) throw new Error('Unsupported challenge template.')

    const participantIds = [...new Set((input.participantIds || []).filter(Boolean))]
    if (participantIds.length !== (input.participantIds || []).length) throw new Error('Duplicate participant ids are not allowed.')
    if (!participantIds.includes(primaryAgentId)) throw new Error('participantIds must include the selected route agent.')
    if (participantIds.length < template.minParticipants || participantIds.length > template.maxParticipants) {
      throw new Error(`${template.title} requires ${template.minParticipants === template.maxParticipants ? template.minParticipants : `${template.minParticipants}-${template.maxParticipants}`} participant(s).`)
    }

    const allAgents = await AgentService.getAllAgents()
    const selectedAgents = participantIds
      .map((id) => allAgents.find((agent) => agent.id === id))
      .filter((agent): agent is AgentRecord => Boolean(agent))
    if (selectedAgents.length !== participantIds.length) throw new Error('One or more selected agents could not be found.')

    const now = new Date().toISOString()
    const participants = selectedAgents.map((agent) => ({
      id: agent.id,
      name: agent.name,
      persona: agent.persona,
      goals: agent.goals || [],
    }))
    const run: ChallengeRun = {
      id: generateId('challenge_run'),
      primaryAgentId,
      mode: template.mode,
      templateId: template.id,
      status: 'draft',
      latestStage: 'compose',
      participantIds,
      participants,
      scenario: clean(input.scenario) || defaultScenario(template, participants),
      sourceArenaRunId: clean(input.sourceArenaRunId) || undefined,
      sourceEventIds: normalizeStringList(input.sourceEventIds),
      executionBudget: input.executionBudget || 'fast',
      eventCount: 0,
      rolePackets: [],
      turns: [],
      deterministicChecks: [],
      qualityStatus: 'pending',
      cancellationRequested: false,
      promptVersion: PROMPT_VERSION,
      createdAt: now,
      updatedAt: now,
    }

    await persistRun(run)
    const event = makeEvent(run, 'run_created', 'compose', 'Run created', `${template.title} draft created for ${participants.map((participant) => participant.name).join(', ')}.`)
    const events: ChallengeEvent[] = []
    await appendEvent(run, events, event)
    return { run, events, participantResults: [] }
  }

  async requestCancel(runId: string): Promise<ChallengeRunDetail> {
    const detail = await this.getRunDetail(runId)
    if (!detail) throw new Error('Challenge run not found.')
    const { run, events } = detail
    run.cancellationRequested = true
    if (run.status === 'draft') {
      run.status = 'cancelled'
      run.latestStage = 'completed'
      run.completedAt = new Date().toISOString()
      const event = makeEvent(run, 'run_cancelled', 'completed', 'Run cancelled', 'Cancelled before execution began.')
      await appendEvent(run, events, event)
    } else {
      run.updatedAt = new Date().toISOString()
      await persistRun(run)
    }
    return { run, events, participantResults: detail.participantResults }
  }

  async executeRun(runId: string, providerInfo?: LLMProviderInfo | null): Promise<ChallengeRunDetail> {
    const detail = await this.getRunDetail(runId)
    if (!detail) throw new Error('Challenge run not found.')
    const { run } = detail
    const events = [...detail.events]

    if (run.status === 'completed' || run.status === 'failed' || run.status === 'cancelled') return detail
    if (run.status === 'running') return detail

    const resolvedProviderInfo = providerInfo ? await resolveProviderInfoModel(providerInfo) : providerInfo
    run.status = 'running'
    run.latestStage = 'prepare_context'
    run.provider = resolvedProviderInfo?.provider || run.provider
    run.model = resolvedProviderInfo?.model || run.model
    run.updatedAt = new Date().toISOString()
    await persistRun(run)

    const startStage = async (stage: ChallengeStage, content: string) => {
      if (await this.isCancelled(run.id)) {
        await this.finishCancelled(run, events)
        return false
      }
      run.latestStage = stage
      run.updatedAt = new Date().toISOString()
      await persistRun(run)
      await appendEvent(run, events, makeEvent(run, 'stage_started', stage, `${stage.replace(/_/g, ' ')} started`, content))
      return true
    }

    const completeStage = async (stage: ChallengeStage, content: string) => {
      await appendEvent(run, events, makeEvent(run, 'stage_completed', stage, `${stage.replace(/_/g, ' ')} completed`, content))
    }

    try {
      if (!await startStage('prepare_context', 'Collecting persona, goals, memory, relationship, and source context.')) return { run, events, participantResults: [] }
      run.contextSummary = await buildContext(run)
      await completeStage('prepare_context', 'Context packet prepared.')

      if (!await startStage('assign_roles', 'Assigning deterministic role packets.')) return { run, events, participantResults: [] }
      run.rolePackets = buildRolePackets(templateFor(run.templateId)!, run, run.contextSummary)
      for (const role of run.rolePackets) {
        const participant = run.participants.find((entry) => entry.id === role.agentId)
        await appendEvent(run, events, makeEvent(run, 'role_assigned', 'assign_roles', `${participant?.name || role.agentId} assigned ${role.role}`, role.objective, {
          speakerType: 'system',
          speakerAgentId: role.agentId,
          speakerName: participant?.name,
          payload: { role },
        }))
      }
      await completeStage('assign_roles', 'Role packets locked.')

      if (!await startStage('execute_turns', 'Waiting on local or remote model calls for participant turns.')) return { run, events, participantResults: [] }
      const turnCount = this.turnCountFor(run.mode, run.executionBudget, run.participantIds.length)
      let latestProviderInfo = resolvedProviderInfo
      for (let round = 1; round <= turnCount; round++) {
        for (const role of run.rolePackets) {
          if (await this.isCancelled(run.id)) {
            await this.finishCancelled(run, events)
            return { run, events, participantResults: [] }
          }
          const participant = run.participants.find((entry) => entry.id === role.agentId)
          if (!participant) continue
          const turnResult = await generateAgentTurn({
            run,
            agent: participant,
            role,
            round,
            context: run.contextSummary || '',
            previousTurns: run.turns,
            providerInfo: latestProviderInfo,
          })
          latestProviderInfo = turnResult.providerInfo
          run.provider = latestProviderInfo.provider
          run.model = latestProviderInfo.model
          const turn: ChallengeTurn = {
            id: generateId('challenge_turn'),
            agentId: participant.id,
            agentName: participant.name,
            role: role.role,
            content: turnResult.content,
            round,
            stage: 'execute_turns',
            createdAt: new Date().toISOString(),
          }
          run.turns.push(turn)
          await appendEvent(run, events, makeEvent(run, 'agent_turn_generated', 'execute_turns', `${participant.name} turn ${round}`, turn.content, {
            speakerType: 'agent',
            speakerAgentId: participant.id,
            speakerName: participant.name,
            payload: { turn },
          }))
        }
      }
      if (run.turns.length === 0) throw new Error('No usable agent output was generated.')
      await completeStage('execute_turns', 'Participant turns completed.')

      if (!await startStage('evaluate_outputs', 'Running deterministic rubric checks and one judge pass.')) return { run, events, participantResults: [] }
      run.deterministicChecks = deterministicChecks(run)
      await appendEvent(run, events, makeEvent(run, 'score_update', 'evaluate_outputs', 'Deterministic score updated', `Rubric baseline: ${averageScore(run.deterministicChecks)}.`, {
        speakerType: 'judge',
        scoreSnapshot: { overallScore: averageScore(run.deterministicChecks) },
        payload: { checks: run.deterministicChecks },
      }))

      let judge: JudgePayload | null = null
      let rawJudge: string | undefined
      let degraded = false
      try {
        const judged = await judgeRun(run, events, latestProviderInfo)
        judge = judged.parsed
        rawJudge = judged.raw
        degraded = !judge
      } catch (error) {
        degraded = true
        rawJudge = error instanceof Error ? error.message : String(error)
      }
      const report = fallbackReport(run, events, degraded, judge, rawJudge)
      await appendEvent(run, events, makeEvent(run, 'judge_evaluation', 'evaluate_outputs', degraded ? 'Judge fallback applied' : 'Judge evaluation completed', report.verdictSummary, {
        speakerType: 'judge',
        scoreSnapshot: { overallScore: report.overallScore, perAgent: Object.fromEntries(report.scorecards.map((entry) => [entry.agentId, entry.totalScore])) },
        payload: { report },
      }))
      await completeStage('evaluate_outputs', 'Evaluation completed.')

      if ((run.mode === 'pair_trial' || run.participantIds.length === 2) && report.relationshipSignals.length > 0) {
        if (!await startStage('synthesize_relationship_evidence', 'Preparing traceable relationship evidence.')) return { run, events, participantResults: [] }
        await appendEvent(run, events, makeEvent(run, 'relationship_evidence_prepared', 'synthesize_relationship_evidence', 'Relationship evidence prepared', `${report.relationshipSignals.length} evidence draft(s) prepared from event refs.`, {
          payload: { relationshipSignals: report.relationshipSignals },
        }))
        await completeStage('synthesize_relationship_evidence', 'Relationship evidence prepared.')
      }

      if (!await startStage('report', 'Publishing final report and participant rows.')) return { run, events, participantResults: [] }
      run.report = report
      run.status = 'completed'
      run.latestStage = 'completed'
      run.qualityStatus = degraded ? 'degraded' : report.passed ? 'passed' : 'failed'
      run.qualityScore = report.overallScore
      run.winnerAgentId = report.scorecards.find((scorecard) => scorecard.outcome === 'winner')?.agentId
      run.completedAt = new Date().toISOString()
      run.updatedAt = run.completedAt
      await persistRun(run)
      const results = makeParticipantResults(run, report)
      for (const result of results) await persistResult(result)
      await applyProgressOnce(run, results)
      if (report.relationshipSignals.length > 0) {
        await relationshipOrchestrator.applyChallengeRunOutcome(run, results, events)
      }
      await appendEvent(run, events, makeEvent(run, 'report_published', 'completed', 'Report published', report.verdictSummary, {
        speakerType: 'judge',
        scoreSnapshot: { overallScore: report.overallScore, perAgent: Object.fromEntries(report.scorecards.map((entry) => [entry.agentId, entry.totalScore])) },
        payload: { report },
      }))
      return { run, events, participantResults: results }
    } catch (error) {
      run.status = 'failed'
      run.latestStage = 'failed'
      run.failureReason = error instanceof Error ? error.message : 'Challenge execution failed.'
      run.completedAt = new Date().toISOString()
      run.updatedAt = run.completedAt
      await persistRun(run)
      await appendEvent(run, events, makeEvent(run, 'run_failed', 'failed', 'Run failed', run.failureReason))
      if (!run.progressAppliedAt) {
        const failedResults = run.participants.map((participant) => ({
          id: generateId('challenge_result'),
          runId: run.id,
          agentId: participant.id,
          templateId: run.templateId,
          mode: run.mode,
          outcome: 'failed' as const,
          totalScore: 0,
          capabilityScore: 0,
          createdAt: run.completedAt || new Date().toISOString(),
          payload: {
            agentId: participant.id,
            agentName: participant.name,
            outcome: 'failed' as const,
            totalScore: 0,
            capabilityScore: 0,
            strengths: [],
            weaknesses: [run.failureReason || 'Run failed.'],
            evidenceEventIds: [],
          },
        }))
        for (const result of failedResults) await persistResult(result)
        await applyProgressOnce(run, failedResults)
        return { run, events, participantResults: failedResults }
      }
      return { run, events, participantResults: [] }
    }
  }

  private turnCountFor(mode: ChallengeRunMode, budget: ChallengeExecutionBudget, participantCount: number) {
    if (mode === 'solo_capability') return budget === 'deep' ? 2 : 1
    if (mode === 'pair_trial') return budget === 'deep' ? 3 : 2
    return participantCount === 1 ? (budget === 'deep' ? 2 : 1) : (budget === 'deep' ? 2 : 1)
  }

  private async isCancelled(runId: string) {
    const latest = await loadRun(runId)
    return Boolean(latest?.cancellationRequested)
  }

  private async finishCancelled(run: ChallengeRun, events: ChallengeEvent[]) {
    run.status = 'cancelled'
    run.latestStage = 'completed'
    run.completedAt = new Date().toISOString()
    run.updatedAt = run.completedAt
    await persistRun(run)
    await appendEvent(run, events, makeEvent(run, 'run_cancelled', 'completed', 'Run cancelled', 'Stopped at the next safe boundary before another model call.'))
  }
}

export const challengeLabService = new ChallengeLabService()
