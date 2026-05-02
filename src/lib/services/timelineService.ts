import { AgentService } from '@/lib/services/agentService'
import { MessageRepository } from '@/lib/repositories/messageRepository'
import { MemoryRepository } from '@/lib/repositories/memoryRepository'
import { DreamWorkspaceRepository } from '@/lib/repositories/dreamWorkspaceRepository'
import { JournalWorkspaceRepository } from '@/lib/repositories/journalWorkspaceRepository'
import { CreativeStudioRepository } from '@/lib/repositories/creativeStudioRepository'
import { RelationshipRevisionRepository } from '@/lib/repositories/relationshipRevisionRepository'
import { PersonalityEventRepository } from '@/lib/repositories/personalityEventRepository'
import { ScenarioRunRepository } from '@/lib/repositories/scenarioRunRepository'
import { ChallengeLabRepository } from '@/lib/repositories/challengeLabRepository'
import { ArenaRepository } from '@/lib/repositories/arenaRepository'
import { LearningRepository } from '@/lib/repositories/learningRepository'
import { MentorshipRepository } from '@/lib/repositories/mentorshipRepository'
import { KnowledgeRepository } from '@/lib/repositories/knowledgeRepository'
import { BroadcastRepository } from '@/lib/repositories/broadcastRepository'
import type {
  AgentRecord,
  EmotionalEvent,
  MessageRecord,
  TimelineClusterV2,
  TimelineEvent,
  TimelineEventType,
  TimelineEventV2,
  TimelineEventV2Type,
  TimelineFilters,
  TimelineQualityFilter,
  TimelineSourceCoverage,
  TimelineThreadV2,
  TimelineWorkspacePayload,
  TimelineWorkspaceQuery,
} from '@/types/database'

export const EVENT_TYPE_ICONS: Record<TimelineEventType, string> = {
  conversation: '💬',
  memory: '🧠',
  emotion: '❤️',
  relationship: '👥',
  dream: '🌙',
  creative: '🎨',
  journal: '📝',
}

export const EVENT_TYPE_COLORS: Record<TimelineEventType, string> = {
  conversation: '#3B82F6',
  memory: '#8B5CF6',
  emotion: '#EC4899',
  relationship: '#10B981',
  dream: '#6366F1',
  creative: '#F97316',
  journal: '#64748B',
}

const SOURCE_LABELS: Record<TimelineEventV2Type, string> = {
  conversation: 'Conversation',
  memory: 'Memory',
  emotion: 'Emotion',
  relationship: 'Relationship',
  dream: 'Dream',
  creative: 'Creative',
  journal: 'Journal',
  profile: 'Profile',
  scenario: 'Scenario',
  challenge: 'Challenge',
  arena: 'Arena',
  learning: 'Learning',
  mentorship: 'Mentorship',
  knowledge: 'Knowledge',
}

const TIMELINE_SOURCES = Object.keys(SOURCE_LABELS) as TimelineEventV2Type[]
const DEFAULT_LIMIT = 80
const MAX_LIMIT = 160

type SourceResult = {
  source: TimelineEventV2Type
  events: TimelineEventV2[]
}

type TimelineSourceAdapter = {
  source: TimelineEventV2Type
  load: (agent: AgentRecord) => Promise<TimelineEventV2[]>
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value))
}

function summarize(value: string | undefined, max = 180) {
  const compact = (value || '').replace(/\s+/g, ' ').trim()
  if (!compact) return 'No summary recorded.'
  return compact.length > max ? `${compact.slice(0, max - 3).trim()}...` : compact
}

function normalizeImportance(value: number | undefined, fallback = 5) {
  if (typeof value !== 'number' || Number.isNaN(value)) return fallback
  return clamp(Math.round(value), 1, 10)
}

function scoreToImportance(score: number | undefined, fallback = 7) {
  if (typeof score !== 'number' || Number.isNaN(score)) return fallback
  return normalizeImportance(Math.round(score / 10), fallback)
}

function confidenceToImportance(confidence: number | undefined, fallback = 6) {
  if (typeof confidence !== 'number' || Number.isNaN(confidence)) return fallback
  return normalizeImportance(Math.round(confidence * 10), fallback)
}

function unique(values: Array<string | undefined | null>) {
  return Array.from(new Set(values.map((value) => value?.trim()).filter((value): value is string => Boolean(value)))).slice(0, 8)
}

function makeEvent(input: Omit<TimelineEventV2, 'themes' | 'participants' | 'evidenceRefs' | 'sourceRefs' | 'relatedRefs' | 'detail'> & Partial<Pick<TimelineEventV2, 'themes' | 'participants' | 'evidenceRefs' | 'sourceRefs' | 'relatedRefs' | 'detail'>>): TimelineEventV2 {
  return {
    ...input,
    themes: unique(input.themes || []),
    participants: input.participants || [],
    evidenceRefs: unique(input.evidenceRefs || []),
    sourceRefs: input.sourceRefs || [{ type: input.source, id: input.sourceId, label: SOURCE_LABELS[input.type] }],
    relatedRefs: input.relatedRefs || [],
    detail: input.detail || {},
  }
}

function conversationEpisodes(agent: AgentRecord, messages: MessageRecord[]): TimelineEventV2[] {
  const sorted = [...messages].sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
  const episodes: MessageRecord[][] = []
  let current: MessageRecord[] = []

  for (const message of sorted) {
    const previous = current.at(-1)
    if (!previous || Date.parse(message.timestamp) - Date.parse(previous.timestamp) <= 30 * 60 * 1000) {
      current.push(message)
    } else {
      episodes.push(current)
      current = [message]
    }
  }

  if (current.length) episodes.push(current)

  return episodes.slice(-40).map((episode) => {
    const first = episode[0]
    const last = episode.at(-1) || first
    const userTurns = episode.filter((message) => message.type === 'user').length
    const agentTurns = episode.filter((message) => message.type === 'agent').length
    const preview = episode.find((message) => message.type === 'user') || first

    return makeEvent({
      id: `conversation:${first.id}`,
      agentId: agent.id,
      type: 'conversation',
      timestamp: first.timestamp,
      title: `${episode.length}-message conversation`,
      summary: summarize(preview.content),
      importance: normalizeImportance(Math.ceil(episode.length / 3), 4),
      source: 'messages',
      sourceId: first.id,
      status: 'recorded',
      themes: extractLightTopics(episode.map((message) => message.content).join(' ')),
      participants: [{ id: agent.id, name: agent.name, role: 'agent' }],
      evidenceRefs: episode.map((message) => message.id).slice(0, 8),
      relatedRefs: [{ type: 'messages', id: last.id, label: 'Last message in episode' }],
      detail: { messageCount: episode.length, userTurns, agentTurns, endedAt: last.timestamp },
    })
  })
}

function extractLightTopics(text: string) {
  const words = text.toLowerCase().match(/[a-z][a-z-]{3,}/g) || []
  const stop = new Set(['this', 'that', 'with', 'from', 'have', 'what', 'when', 'where', 'would', 'could', 'should', 'there', 'their', 'about', 'because', 'agent'])
  const counts = new Map<string, number>()
  for (const word of words) {
    if (!stop.has(word)) counts.set(word, (counts.get(word) || 0) + 1)
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5).map(([word]) => word)
}

function emotionEvent(agent: AgentRecord, event: EmotionalEvent): TimelineEventV2 {
  const emotion = event.dominantEmotion || event.emotion
  return makeEvent({
    id: `emotion:${event.id}`,
    agentId: agent.id,
    type: 'emotion',
    timestamp: event.timestamp,
    title: `${emotion} shift`,
    summary: summarize(event.explanation || event.context),
    importance: confidenceToImportance(Math.max(event.confidence || 0, event.intensity || 0), 5),
    source: 'agents.emotionalHistory',
    sourceId: event.id,
    status: event.phase,
    themes: unique([emotion, event.source, event.trigger, ...(event.triggers || [])]),
    participants: [{ id: agent.id, name: agent.name, role: 'agent' }],
    evidenceRefs: unique([event.linkedMessageId, event.linkedActionId, ...(event.linkedMemoryIds || []), ...(event.evidenceRefs || [])]),
    detail: { intensity: event.intensity, delta: event.delta, confidence: event.confidence, downstreamHints: event.downstreamHints },
  })
}

function passesQuery(event: TimelineEventV2, query: TimelineWorkspaceQuery) {
  if (query.from && Date.parse(event.timestamp) < Date.parse(query.from)) return false
  if (query.to && Date.parse(event.timestamp) > Date.parse(query.to)) return false
  if (query.cursor && Date.parse(event.timestamp) >= Date.parse(query.cursor)) return false
  if (query.types?.length && !query.types.includes(event.type)) return false
  if (typeof query.minImportance === 'number' && event.importance < query.minImportance) return false
  if (query.quality && query.quality !== 'all') {
    const quality = event.qualityStatus || 'unknown'
    if (quality !== query.quality) return false
  }
  if (query.q) {
    const haystack = [
      event.title,
      event.summary,
      event.source,
      event.status,
      event.qualityStatus,
      ...event.themes,
      ...event.participants.map((participant) => participant.name || participant.id),
    ].join(' ').toLowerCase()
    if (!haystack.includes(query.q.toLowerCase())) return false
  }
  return true
}

function buildThreads(events: TimelineEventV2[]): TimelineThreadV2[] {
  const byTheme = new Map<string, TimelineEventV2[]>()
  for (const event of events) {
    for (const theme of event.themes) {
      const key = theme.toLowerCase()
      byTheme.set(key, [...(byTheme.get(key) || []), event])
    }
  }

  return [...byTheme.entries()]
    .filter(([, items]) => items.length >= 2)
    .map(([theme, items]) => {
      const sorted = [...items].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
      return {
        id: `thread:${theme}`,
        label: theme,
        eventIds: sorted.map((event) => event.id),
        count: sorted.length,
        startTime: sorted[0].timestamp,
        endTime: sorted.at(-1)?.timestamp || sorted[0].timestamp,
        importance: sorted.reduce((sum, event) => sum + event.importance, 0) / sorted.length,
      }
    })
    .sort((a, b) => b.importance - a.importance || b.count - a.count)
    .slice(0, 12)
}

function buildClusters(events: TimelineEventV2[]): TimelineClusterV2[] {
  const dayBuckets = new Map<string, TimelineEventV2[]>()
  for (const event of events) {
    const day = event.timestamp.slice(0, 10)
    dayBuckets.set(day, [...(dayBuckets.get(day) || []), event])
  }

  return [...dayBuckets.entries()].map(([day, items]) => {
    const sorted = [...items].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
    const dominantType = [...items.reduce((counts, item) => counts.set(item.type, (counts.get(item.type) || 0) + 1), new Map<TimelineEventV2Type, number>()).entries()]
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'memory'
    return {
      id: `cluster:${day}`,
      label: new Intl.DateTimeFormat('en', { dateStyle: 'medium' }).format(new Date(`${day}T00:00:00.000Z`)),
      eventIds: sorted.map((event) => event.id),
      startTime: sorted[0].timestamp,
      endTime: sorted.at(-1)?.timestamp || sorted[0].timestamp,
      dominantType,
      count: sorted.length,
    }
  }).sort((a, b) => Date.parse(b.startTime) - Date.parse(a.startTime))
}

function buildSummary(events: TimelineEventV2[], visibleEvents: TimelineEventV2[]) {
  const counts = visibleEvents.reduce((map, event) => map.set(event.type, (map.get(event.type) || 0) + 1), new Map<TimelineEventV2Type, number>())
  const topSource = [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  return {
    totalEvents: events.length,
    visibleEvents: visibleEvents.length,
    highImportanceEvents: visibleEvents.filter((event) => event.importance >= 8).length,
    averageImportance: visibleEvents.length ? visibleEvents.reduce((sum, event) => sum + event.importance, 0) / visibleEvents.length : 0,
    topSource,
    latestEventAt: visibleEvents[0]?.timestamp,
    oldestEventAt: visibleEvents.at(-1)?.timestamp,
  }
}

export class TimelineService {
  async getWorkspace(agentId: string, query: TimelineWorkspaceQuery = {}): Promise<TimelineWorkspacePayload> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) throw new Error('Agent not found')

    const sourceResults = await Promise.allSettled(this.adapters().map(async (adapter): Promise<SourceResult> => ({
      source: adapter.source,
      events: await adapter.load(agent),
    })))

    const events: TimelineEventV2[] = []
    const coverage: TimelineSourceCoverage[] = []

    sourceResults.forEach((result, index) => {
      const source = this.adapters()[index].source
      if (result.status === 'fulfilled') {
        events.push(...result.value.events)
        coverage.push({
          source,
          label: SOURCE_LABELS[source],
          count: result.value.events.length,
          status: result.value.events.length ? 'loaded' : 'empty',
        })
      } else {
        coverage.push({
          source,
          label: SOURCE_LABELS[source],
          count: 0,
          status: 'degraded',
          error: result.reason instanceof Error ? result.reason.message : 'Source failed to load',
        })
      }
    })

    const sorted = events.sort((a, b) => Date.parse(b.timestamp) - Date.parse(a.timestamp))
    const filtered = sorted.filter((event) => passesQuery(event, query))
    const limit = clamp(query.limit || DEFAULT_LIMIT, 1, MAX_LIMIT)
    const visible = filtered.slice(0, limit)
    const nextCursor = filtered.length > limit ? visible.at(-1)?.timestamp : undefined

    return {
      agent: { id: agent.id, name: agent.name },
      events: visible,
      summary: buildSummary(sorted, visible),
      threads: buildThreads(visible),
      clusters: buildClusters(visible),
      coverage,
      generatedAt: new Date().toISOString(),
      nextCursor,
    }
  }

  parseQuery(searchParams: URLSearchParams): TimelineWorkspaceQuery {
    const types = searchParams.get('types')?.split(',').filter(Boolean) as TimelineEventV2Type[] | undefined
    const quality = searchParams.get('quality') as TimelineQualityFilter | null
    return {
      limit: Number(searchParams.get('limit')) || undefined,
      cursor: searchParams.get('cursor') || undefined,
      from: searchParams.get('from') || undefined,
      to: searchParams.get('to') || undefined,
      types: types?.filter((type) => TIMELINE_SOURCES.includes(type)),
      minImportance: searchParams.get('minImportance') ? Number(searchParams.get('minImportance')) : undefined,
      quality: quality || undefined,
      q: searchParams.get('q') || undefined,
    }
  }

  private adapters(): TimelineSourceAdapter[] {
    return [
      {
        source: 'conversation',
        load: async (agent) => conversationEpisodes(agent, await MessageRepository.listByAgentId(agent.id)),
      },
      {
        source: 'memory',
        load: async (agent) => (await MemoryRepository.listByAgent(agent.id, { activeOnly: true, limit: 80 })).map((memory) => makeEvent({
          id: `memory:${memory.id}`,
          agentId: agent.id,
          type: 'memory',
          timestamp: memory.timestamp,
          title: memory.summary || 'Memory recorded',
          summary: summarize(memory.content),
          importance: normalizeImportance(memory.importance),
          source: 'memories',
          sourceId: memory.id,
          status: memory.origin,
          qualityStatus: memory.qualityStatus,
          qualityScore: memory.qualityScore,
          themes: [memory.type, memory.origin, ...(memory.keywords || [])],
          evidenceRefs: [...(memory.linkedMessageIds || []), ...(memory.evidenceRefs || [])],
          detail: { context: memory.context, canonicalKey: memory.canonicalKey, canonicalValue: memory.canonicalValue, confidence: memory.confidence },
        })),
      },
      {
        source: 'emotion',
        load: async (agent) => (agent.emotionalHistory || []).slice(-60).map((event) => emotionEvent(agent, event)),
      },
      {
        source: 'relationship',
        load: async (agent) => (await RelationshipRevisionRepository.listRecentByAgent(agent.id, 40)).map((revision) => makeEvent({
          id: `relationship:${revision.id}`,
          agentId: agent.id,
          type: 'relationship',
          timestamp: revision.createdAt,
          title: 'Relationship state changed',
          summary: summarize(revision.summary),
          importance: confidenceToImportance(revision.confidence, 6),
          source: 'relationship_revisions',
          sourceId: revision.id,
          status: revision.sourceKind,
          themes: ['relationship', ...revision.changedTypes, ...revision.changedAlerts],
          participants: [
            { id: revision.agentId1, role: revision.agentId1 === agent.id ? 'self' : 'related' },
            { id: revision.agentId2, role: revision.agentId2 === agent.id ? 'self' : 'related' },
          ],
          evidenceRefs: revision.supportingEvidenceIds,
          relatedRefs: [{ type: 'relationship_synthesis_runs', id: revision.synthesisRunId, label: 'Synthesis run' }],
          detail: { confidence: revision.confidence, sourceKind: revision.sourceKind, sourceId: revision.sourceId, changedTypes: revision.changedTypes },
        })),
      },
      {
        source: 'dream',
        load: async (agent) => (await DreamWorkspaceRepository.listDreamsForAgent(agent.id, { savedOnly: true, limit: 40 })).map((dream) => makeEvent({
          id: `dream:${dream.id}`,
          agentId: agent.id,
          type: 'dream',
          timestamp: dream.savedAt || dream.updatedAt || dream.createdAt,
          title: dream.title,
          summary: summarize(dream.summary),
          importance: scoreToImportance(dream.qualityScore || dream.evaluation?.overallScore, 7),
          source: 'dreams',
          sourceId: dream.id,
          status: dream.status,
          qualityStatus: dream.qualityStatus || dream.normalizationStatus,
          qualityScore: dream.qualityScore || dream.evaluation?.overallScore,
          themes: [dream.type, ...(dream.themes || [])],
          sourceRefs: dream.sourceRefs?.map((ref) => ({ type: ref.sourceType, id: ref.id, label: ref.label })) || undefined,
          relatedRefs: [{ type: 'dream_sessions', id: dream.sessionId, label: 'Dream session' }],
          detail: { symbols: dream.symbols?.slice(0, 5), emotionalProcessing: dream.emotionalProcessing, impression: dream.impression },
        })),
      },
      {
        source: 'journal',
        load: async (agent) => (await JournalWorkspaceRepository.listEntriesForAgent(agent.id, { savedOnly: true, limit: 40 })).map((entry) => makeEvent({
          id: `journal:${entry.id}`,
          agentId: agent.id,
          type: 'journal',
          timestamp: entry.savedAt || entry.updatedAt || entry.createdAt,
          title: entry.title,
          summary: summarize(entry.summary),
          importance: scoreToImportance(entry.qualityScore || entry.evaluation?.overallScore, 7),
          source: 'journal_entries',
          sourceId: entry.id,
          status: entry.status,
          qualityStatus: entry.qualityStatus || entry.normalizationStatus,
          qualityScore: entry.qualityScore || entry.evaluation?.overallScore,
          themes: [entry.type, entry.mood?.label, ...(entry.metadata?.focus || []), ...(entry.structured?.themes || [])],
          evidenceRefs: entry.references,
          sourceRefs: entry.sourceRefs?.map((ref) => ({ type: ref.sourceType, id: ref.id, label: ref.label })) || undefined,
          relatedRefs: [{ type: 'journal_sessions', id: entry.sessionId, label: 'Journal session' }],
          detail: { mood: entry.mood, focus: entry.metadata?.focus, evaluation: entry.evaluation },
        })),
      },
      {
        source: 'creative',
        load: async (agent) => (await CreativeStudioRepository.listPublishedLibrary(agent.id)).slice(0, 40).map(({ artifact, session }) => makeEvent({
          id: `creative:${artifact.id}`,
          agentId: agent.id,
          type: 'creative',
          timestamp: artifact.publishedAt || artifact.updatedAt || artifact.createdAt,
          title: artifact.title,
          summary: summarize(artifact.summary),
          importance: scoreToImportance(artifact.qualityScore || artifact.evaluation?.overallScore, 7),
          source: 'creative_artifacts',
          sourceId: artifact.id,
          status: artifact.status,
          qualityStatus: artifact.qualityStatus || artifact.normalizationStatus,
          qualityScore: artifact.qualityScore || artifact.evaluation?.overallScore,
          themes: [artifact.format, artifact.tone, ...(artifact.themes || [])],
          sourceRefs: artifact.sourceRefs?.map((ref) => ({ type: ref.sourceType, id: ref.id, label: ref.label })) || undefined,
          relatedRefs: [{ type: 'creative_sessions', id: session.id, label: 'Creative session' }],
          detail: { format: artifact.format, tone: artifact.tone, wordCount: artifact.wordCount, audience: artifact.audience },
        })),
      },
      {
        source: 'profile',
        load: async (agent) => (await PersonalityEventRepository.listByAgent(agent.id, 40)).map((event) => makeEvent({
          id: `profile:${event.id}`,
          agentId: agent.id,
          type: 'profile',
          timestamp: event.createdAt,
          title: 'Personality evolution',
          summary: summarize(event.summary),
          importance: normalizeImportance(6 + event.traitDeltas.length, 7),
          source: 'agent_personality_events',
          sourceId: event.id,
          status: event.source,
          themes: ['profile', ...event.traitDeltas.map((delta) => delta.trait)],
          evidenceRefs: event.linkedMessageIds,
          detail: { trigger: event.trigger, traitDeltas: event.traitDeltas },
        })),
      },
      {
        source: 'scenario',
        load: async (agent) => (await ScenarioRunRepository.listByAgent(agent.id, 30)).map((run) => makeEvent({
          id: `scenario:${run.id}`,
          agentId: agent.id,
          type: 'scenario',
          timestamp: run.updatedAt || run.createdAt,
          title: run.intervention?.label || 'Scenario branch run',
          summary: summarize(run.comparison?.summary || run.branchPoint?.summary || run.failureReason),
          importance: scoreToImportance(run.qualityScore, run.status === 'complete' ? 7 : 5),
          source: 'scenario_runs',
          sourceId: run.id,
          status: run.status,
          qualityStatus: run.qualityStatus,
          qualityScore: run.qualityScore,
          themes: ['scenario', run.branchPoint?.kind, run.intervention?.type],
          evidenceRefs: run.sourceRefs?.map((ref) => ref.id) || [],
          sourceRefs: run.sourceRefs?.map((ref) => ({ type: ref.sourceType, id: ref.id, label: ref.label })) || undefined,
          detail: { branchPoint: run.branchPoint, intervention: run.intervention, failureReason: run.failureReason },
        })),
      },
      {
        source: 'challenge',
        load: async (agent) => (await ChallengeLabRepository.listResultHistory(agent.id, 30)).map((result) => makeEvent({
          id: `challenge:${result.id}`,
          agentId: agent.id,
          type: 'challenge',
          timestamp: result.createdAt,
          title: `${result.outcome} challenge result`,
          summary: summarize(`${result.payload.strengths?.[0] || 'Challenge result recorded.'} Capability ${result.capabilityScore}, total ${result.totalScore}.`),
          importance: scoreToImportance(result.totalScore, 7),
          source: 'challenge_participant_results',
          sourceId: result.id,
          status: result.outcome,
          qualityScore: result.totalScore,
          themes: ['challenge', result.templateId, result.mode, result.outcome],
          relatedRefs: [{ type: 'challenge_runs', id: result.runId, label: 'Challenge run' }],
          detail: { capabilityScore: result.capabilityScore, relationshipScore: result.relationshipScore, scorecard: result.payload },
        })),
      },
      {
        source: 'arena',
        load: async (agent) => (await ArenaRepository.listRecentRuns(60))
          .filter((run) => run.participantIds.includes(agent.id))
          .slice(0, 30)
          .map((run) => makeEvent({
            id: `arena:${run.id}`,
            agentId: agent.id,
            type: 'arena',
            timestamp: run.completedAt || run.updatedAt || run.createdAt,
            title: run.config.topic || 'Arena debate',
            summary: summarize(run.finalReport?.executiveSummary || run.config.objective || run.failureReason),
            importance: normalizeImportance(run.winnerAgentId === agent.id ? 9 : run.status === 'complete' ? 7 : 5),
            source: 'arena_runs',
            sourceId: run.id,
            status: run.status,
            themes: ['arena', run.latestStage, ...(run.config.tags || [])],
            participants: run.participants.map((participant) => ({ id: participant.id, name: participant.name, role: participant.id === agent.id ? 'self' : 'participant' })),
            detail: { roundCount: run.config.roundCount, currentRound: run.currentRound, eventCount: run.eventCount, winnerAgentId: run.winnerAgentId },
          })),
      },
      {
        source: 'learning',
        load: async (agent) => {
          const [observations, goals, adaptations] = await Promise.all([
            LearningRepository.listObservations(agent.id, 24),
            LearningRepository.listGoals(agent.id, { limit: 20 }),
            LearningRepository.listAdaptations(agent.id, { activeOnly: false, limit: 20 }),
          ])
          return [
            ...observations.map((observation) => makeEvent({
              id: `learning-observation:${observation.id}`,
              agentId: agent.id,
              type: 'learning',
              timestamp: observation.evaluatedAt || observation.createdAt,
              title: `${observation.outcome} learning observation`,
              summary: summarize(observation.summary),
              importance: normalizeImportance(Math.abs(observation.finalScore || observation.provisionalScore || 0) || 5),
              source: 'learning_observations',
              sourceId: observation.id,
              status: observation.followUpStatus,
              themes: ['learning', observation.category, observation.taskType, observation.feature],
              evidenceRefs: [...(observation.evidenceRefs || []), ...(observation.linkedMessageIds || [])],
              detail: { outcome: observation.outcome, finalScore: observation.finalScore, evidence: observation.evidence },
            })),
            ...goals.map((goal) => makeEvent({
              id: `learning-goal:${goal.id}`,
              agentId: agent.id,
              type: 'learning',
              timestamp: goal.achievedAt || goal.createdAt,
              title: goal.title,
              summary: summarize(goal.description),
              importance: goal.priority === 'high' ? 8 : goal.priority === 'medium' ? 6 : 4,
              source: 'learning_goals',
              sourceId: goal.id,
              status: goal.status,
              themes: ['learning', 'goal', goal.category, goal.priority],
              detail: { progressPercentage: goal.progressPercentage, targetMetric: goal.targetMetric, strategy: goal.strategy },
            })),
            ...adaptations.map((adaptation) => makeEvent({
              id: `learning-adaptation:${adaptation.id}`,
              agentId: agent.id,
              type: 'learning',
              timestamp: adaptation.timestamp,
              title: `${adaptation.adaptationType} adaptation`,
              summary: summarize(adaptation.description),
              importance: normalizeImportance(Math.abs(adaptation.impactScore) * 10, 6),
              source: 'learning_adaptations',
              sourceId: adaptation.id,
              status: adaptation.isActive ? 'active' : 'inactive',
              themes: ['learning', 'adaptation', adaptation.adaptationType, ...adaptation.affectedAreas],
              evidenceRefs: [...(adaptation.triggeringPatterns || []), ...(adaptation.sourceObservationIds || [])],
              detail: { instruction: adaptation.instruction, impactScore: adaptation.impactScore, confidence: adaptation.confidence },
            })),
          ]
        },
      },
      {
        source: 'mentorship',
        load: async (agent) => (await MentorshipRepository.listByAgent(agent.id)).slice(0, 30).map((mentorship) => makeEvent({
          id: `mentorship:${mentorship.id}`,
          agentId: agent.id,
          type: 'mentorship',
          timestamp: mentorship.updatedAt || mentorship.createdAt,
          title: `${mentorship.currentFocus} mentorship`,
          summary: summarize(`${mentorship.completedSessions}/${mentorship.totalSessions} sessions complete.`),
          importance: normalizeImportance(Math.max(mentorship.mentorEffectiveness, mentorship.menteeProgress) * 10, 6),
          source: 'mentorships',
          sourceId: mentorship.id,
          status: mentorship.status,
          themes: ['mentorship', mentorship.currentFocus, ...mentorship.focusAreas, ...mentorship.skillsTransferred],
          participants: [
            { id: mentorship.mentorId, role: mentorship.mentorId === agent.id ? 'mentor self' : 'mentor' },
            { id: mentorship.menteeId, role: mentorship.menteeId === agent.id ? 'mentee self' : 'mentee' },
          ],
          detail: { totalSessions: mentorship.totalSessions, completedSessions: mentorship.completedSessions, mentorEffectiveness: mentorship.mentorEffectiveness, menteeProgress: mentorship.menteeProgress },
        })),
      },
      {
        source: 'knowledge',
        load: async (agent) => {
          const [knowledge, broadcasts] = await Promise.all([
            KnowledgeRepository.listAll(160),
            BroadcastRepository.listRecent(120),
          ])
          return [
            ...knowledge
              .filter((item) => item.contributorId === agent.id || item.usedByAgents?.includes(agent.id))
              .slice(0, 35)
              .map((item) => makeEvent({
                id: `knowledge:${item.id}`,
                agentId: agent.id,
                type: 'knowledge',
                timestamp: item.updatedAt || item.createdAt,
                title: item.topic,
                summary: summarize(item.content),
                importance: confidenceToImportance(item.confidence, 6),
                source: 'shared_knowledge',
                sourceId: item.id,
                status: item.contributorId === agent.id ? 'contributed' : 'used',
                themes: ['knowledge', item.category, ...(item.tags || [])],
                participants: [{ id: item.contributorId, name: item.contributorName, role: 'contributor' }],
                detail: { confidence: item.confidence, endorsements: item.endorsements?.length || 0, disputes: item.disputes?.length || 0 },
              })),
            ...broadcasts
              .filter((broadcast) => broadcast.agentId === agent.id)
              .slice(0, 24)
              .map((broadcast) => makeEvent({
                id: `knowledge-broadcast:${broadcast.id}`,
                agentId: agent.id,
                type: 'knowledge',
                timestamp: broadcast.createdAt,
                title: broadcast.topic,
                summary: summarize(broadcast.summary),
                importance: normalizeImportance(5 + Math.min(4, broadcast.endorsements || 0), 6),
                source: 'collective_broadcasts',
                sourceId: broadcast.id,
                status: 'broadcast',
                themes: ['knowledge', 'broadcast', broadcast.topic],
                relatedRefs: broadcast.knowledgeId ? [{ type: 'shared_knowledge', id: broadcast.knowledgeId, label: 'Knowledge record' }] : [],
                detail: { reach: broadcast.reach, endorsements: broadcast.endorsements },
              })),
          ]
        },
      },
    ]
  }

  async aggregateEvents(): Promise<TimelineEvent[]> {
    throw new Error('TimelineService.aggregateEvents is deprecated. Use GET /api/agents/[id]/timeline.')
  }

  applyFilters(events: TimelineEvent[], filters: TimelineFilters): TimelineEvent[] {
    return events.filter((event) => {
      if (filters.types && !filters.types.includes('all') && !filters.types.includes(event.type)) return false
      if (filters.dateRange.start && Date.parse(event.timestamp) < Date.parse(filters.dateRange.start)) return false
      if (filters.dateRange.end && Date.parse(event.timestamp) > Date.parse(filters.dateRange.end)) return false
      if (filters.minImportance > 0 && event.importance < filters.minImportance) return false
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        return event.title.toLowerCase().includes(query) || event.description.toLowerCase().includes(query)
      }
      return true
    })
  }
}

export const timelineService = new TimelineService()
