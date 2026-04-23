import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  real,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type {
  AgentRecord,
  ArenaEvent,
  ArenaRun,
  AgentRelationship,
  AgentStats,
  CreativeArtifact,
  CreativePipelineEvent,
  CreativeSession,
  Dream,
  DreamPipelineEvent,
  DreamSession,
  EmotionalEvent,
  EmotionalProfile,
  EmotionalState,
  JournalEntry,
  JournalPipelineEvent,
  JournalSession,
  LinguisticProfile,
  MemoryGraph,
  MemoryRecord,
  Mentorship,
  MessageRecord,
  RelationshipEvidence,
  RelationshipRevision,
  RelationshipSynthesisRun,
  PersonalityEventRecord,
  ProfileAnalysisRun,
  ProfileInterviewTurn,
  ProfilePipelineEvent,
  PsychologicalProfile,
  SharedKnowledge,
  ScenarioRunRecord,
  SimulationRecord,
  Challenge,
} from '@/types/database'
import type {
  LearningAdaptation,
  LearningEvent,
  LearningGoal,
  LearningObservation,
  LearningPattern,
  SkillProgression,
} from '@/types/metaLearning'
import type { ConflictAnalysis, KnowledgeBroadcast } from '@/types/enhancements'

const createdAt = timestamp('created_at', { withTimezone: true, mode: 'string' }).notNull()
export const agents = pgTable('agents', {
  id: text('id').primaryKey(),
  name: text('name').notNull(),
  persona: text('persona').notNull(),
  goals: text('goals').array().notNull().default(sql`'{}'::text[]`),
  status: text('status').notNull(),
  userId: text('user_id'),
  settings: jsonb('settings').$type<Record<string, unknown> | null>(),
  coreTraits: jsonb('core_traits').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
  dynamicTraits: jsonb('dynamic_traits').$type<Record<string, number>>().notNull().default(sql`'{}'::jsonb`),
  memoryCount: integer('memory_count').notNull().default(0),
  totalInteractions: integer('total_interactions').notNull().default(0),
  linguisticProfile: jsonb('linguistic_profile').$type<LinguisticProfile | null>(),
  emotionalProfile: jsonb('emotional_profile').$type<EmotionalProfile | null>(),
  emotionalState: jsonb('emotional_state').$type<EmotionalState | null>(),
  emotionalHistory: jsonb('emotional_history').$type<EmotionalEvent[]>().notNull().default(sql`'[]'::jsonb`),
  stats: jsonb('stats').$type<AgentStats | null>(),
  psychologicalProfile: jsonb('psychological_profile').$type<PsychologicalProfile | null>(),
  relationshipCount: integer('relationship_count').notNull().default(0),
  creativeWorks: integer('creative_works').notNull().default(0),
  dreamCount: integer('dream_count').notNull().default(0),
  journalCount: integer('journal_count').notNull().default(0),
  activeDreamImpression: jsonb('active_dream_impression').$type<AgentRecord['activeDreamImpression'] | null>(),
  challengesCompleted: integer('challenges_completed').notNull().default(0),
  challengeWins: integer('challenge_wins').notNull().default(0),
  mentorshipStats: jsonb('mentorship_stats').$type<AgentRecord['mentorshipStats'] | null>(),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
  index('agents_status_idx').on(table.status),
  index('agents_updated_at_idx').on(table.updatedAt),
  index('agents_created_at_idx').on(table.createdAt),
])

export const messages = pgTable('messages', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  content: text('content').notNull(),
  type: text('type').notNull(),
  roomId: text('room_id'),
  metadata: jsonb('metadata').$type<MessageRecord['metadata'] | null>(),
  userId: text('user_id'),
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
  index('messages_agent_timestamp_idx').on(table.agentId, table.timestamp),
  index('messages_room_timestamp_idx').on(table.roomId, table.timestamp),
  index('messages_timestamp_idx').on(table.timestamp),
])

export const memories = pgTable('memories', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  content: text('content').notNull(),
  summary: text('summary').notNull(),
  keywords: text('keywords').array().notNull().default(sql`'{}'::text[]`),
  importance: integer('importance').notNull(),
  context: text('context').notNull(),
  origin: text('origin').notNull().default('imported'),
  linkedMessageIds: text('linked_message_ids').array().notNull().default(sql`'{}'::text[]`),
  canonicalKey: text('canonical_key'),
  canonicalValue: text('canonical_value'),
  confidence: real('confidence'),
  evidenceRefs: text('evidence_refs').array().notNull().default(sql`'{}'::text[]`),
  supersedes: text('supersedes').array().notNull().default(sql`'{}'::text[]`),
  lastConfirmedAt: timestamp('last_confirmed_at', { withTimezone: true, mode: 'string' }),
  metadata: jsonb('metadata').$type<MemoryRecord['metadata'] | null>(),
  userId: text('user_id'),
  isActive: boolean('is_active').notNull().default(true),
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
  index('memories_agent_type_active_timestamp_idx').on(table.agentId, table.type, table.isActive, table.timestamp),
  index('memories_agent_active_timestamp_idx').on(table.agentId, table.isActive, table.timestamp),
  index('memories_agent_origin_active_timestamp_idx').on(table.agentId, table.origin, table.isActive, table.timestamp),
  index('memories_agent_canonical_key_active_idx').on(table.agentId, table.canonicalKey, table.isActive),
])

export const memoryGraphs = pgTable('memory_graphs', {
  agentId: text('agent_id').primaryKey().references(() => agents.id, { onDelete: 'cascade' }),
  payload: jsonb('payload').$type<MemoryGraph>().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
})

export const agentPersonalityEvents = pgTable('agent_personality_events', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  source: text('source').notNull(),
  trigger: text('trigger').notNull(),
  summary: text('summary').notNull(),
  traitDeltas: jsonb('trait_deltas').$type<PersonalityEventRecord['traitDeltas']>().notNull().default(sql`'[]'::jsonb`),
  beforeTraits: jsonb('before_traits').$type<PersonalityEventRecord['beforeTraits'] | null>(),
  afterTraits: jsonb('after_traits').$type<PersonalityEventRecord['afterTraits'] | null>(),
  linkedMessageIds: text('linked_message_ids').array().notNull().default(sql`'{}'::text[]`),
  metadata: jsonb('metadata').$type<PersonalityEventRecord['metadata'] | null>(),
  createdAt,
}, (table) => [
  index('agent_personality_events_agent_created_idx').on(table.agentId, table.createdAt),
  index('agent_personality_events_source_created_idx').on(table.source, table.createdAt),
])

export const agentRelationships = pgTable('agent_relationships', {
  id: text('id').primaryKey(),
  agentId1: text('agent_id_1').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  agentId2: text('agent_id_2').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  relationshipTypes: text('relationship_types').array().notNull().default(sql`'{}'::text[]`),
  interactionCount: integer('interaction_count').notNull().default(0),
  firstMeeting: timestamp('first_meeting', { withTimezone: true, mode: 'string' }).notNull(),
  lastInteraction: timestamp('last_interaction', { withTimezone: true, mode: 'string' }).notNull(),
  metrics: jsonb('metrics').$type<AgentRelationship['metrics']>().notNull(),
  significantEvents: jsonb('significant_events').$type<AgentRelationship['significantEvents']>().notNull().default(sql`'[]'::jsonb`),
  payload: jsonb('payload').$type<AgentRelationship>().notNull(),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
  uniqueIndex('agent_relationships_pair_unique_idx').on(table.agentId1, table.agentId2),
  index('agent_relationships_agent1_idx').on(table.agentId1),
  index('agent_relationships_agent2_idx').on(table.agentId2),
  index('agent_relationships_status_idx').on(table.status),
])

export const relationshipEvidence = pgTable('relationship_evidence', {
  id: text('id').primaryKey(),
  pairId: text('pair_id').notNull().references(() => agentRelationships.id, { onDelete: 'cascade' }),
  agentId1: text('agent_id_1').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  agentId2: text('agent_id_2').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  sourceKind: text('source_kind').notNull(),
  sourceId: text('source_id').notNull(),
  signalKind: text('signal_kind').notNull(),
  actorAgentId: text('actor_agent_id'),
  targetAgentId: text('target_agent_id'),
  valence: real('valence').notNull().default(0),
  weight: real('weight').notNull().default(0),
  confidence: real('confidence').notNull().default(0.5),
  createdAt,
  payload: jsonb('payload').$type<RelationshipEvidence>().notNull(),
}, (table) => [
  index('relationship_evidence_pair_created_idx').on(table.pairId, table.createdAt),
  index('relationship_evidence_source_idx').on(table.sourceKind, table.sourceId, table.createdAt),
  index('relationship_evidence_agent1_created_idx').on(table.agentId1, table.createdAt),
  index('relationship_evidence_agent2_created_idx').on(table.agentId2, table.createdAt),
])

export const relationshipRevisions = pgTable('relationship_revisions', {
  id: text('id').primaryKey(),
  pairId: text('pair_id').notNull().references(() => agentRelationships.id, { onDelete: 'cascade' }),
  agentId1: text('agent_id_1').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  agentId2: text('agent_id_2').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  sourceKind: text('source_kind').notNull(),
  sourceId: text('source_id').notNull(),
  synthesisRunId: text('synthesis_run_id').notNull(),
  confidence: real('confidence').notNull().default(0.5),
  createdAt,
  payload: jsonb('payload').$type<RelationshipRevision>().notNull(),
}, (table) => [
  index('relationship_revisions_pair_created_idx').on(table.pairId, table.createdAt),
  index('relationship_revisions_source_idx').on(table.sourceKind, table.sourceId, table.createdAt),
  index('relationship_revisions_agent1_created_idx').on(table.agentId1, table.createdAt),
  index('relationship_revisions_agent2_created_idx').on(table.agentId2, table.createdAt),
])

export const relationshipSynthesisRuns = pgTable('relationship_synthesis_runs', {
  id: text('id').primaryKey(),
  pairId: text('pair_id').notNull().references(() => agentRelationships.id, { onDelete: 'cascade' }),
  agentId1: text('agent_id_1').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  agentId2: text('agent_id_2').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  triggerSourceKind: text('trigger_source_kind').notNull(),
  triggerSourceId: text('trigger_source_id').notNull(),
  status: text('status').notNull(),
  promptVersion: text('prompt_version').notNull(),
  provider: text('provider'),
  model: text('model'),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  payload: jsonb('payload').$type<RelationshipSynthesisRun>().notNull(),
}, (table) => [
  index('relationship_synthesis_pair_created_idx').on(table.pairId, table.createdAt),
  index('relationship_synthesis_trigger_idx').on(table.triggerSourceKind, table.triggerSourceId, table.createdAt),
  index('relationship_synthesis_status_idx').on(table.status, table.createdAt),
])

export const creativeSessions = pgTable('creative_sessions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  qualityStatus: text('quality_status').notNull().default('legacy_unvalidated'),
  repairCount: integer('repair_count').notNull().default(0),
  promptVersion: text('prompt_version'),
  failureReason: text('failure_reason'),
  format: text('format').notNull(),
  brief: jsonb('brief').$type<CreativeSession['brief']>().notNull(),
  normalizedBrief: jsonb('normalized_brief').$type<CreativeSession['normalizedBrief']>().notNull(),
  contextPacket: jsonb('context_packet').$type<CreativeSession['contextPacket'] | null>(),
  latestEvaluation: jsonb('latest_evaluation').$type<CreativeSession['latestEvaluation'] | null>(),
  draftArtifactId: text('draft_artifact_id'),
  finalArtifactId: text('final_artifact_id'),
  publishedArtifactId: text('published_artifact_id'),
  provider: text('provider'),
  model: text('model'),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
  payload: jsonb('payload').$type<CreativeSession>().notNull(),
}, (table) => [
  index('creative_sessions_agent_created_idx').on(table.agentId, table.createdAt),
  index('creative_sessions_agent_status_created_idx').on(table.agentId, table.status, table.createdAt),
  index('creative_sessions_agent_format_created_idx').on(table.agentId, table.format, table.createdAt),
])

export const creativeArtifacts = pgTable('creative_artifacts', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => creativeSessions.id, { onDelete: 'cascade' }),
  format: text('format').notNull(),
  status: text('status').notNull(),
  artifactRole: text('artifact_role'),
  normalizationStatus: text('normalization_status').notNull().default('legacy_unvalidated'),
  qualityScore: integer('quality_score'),
  sourceArtifactId: text('source_artifact_id'),
  version: integer('version').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  wordCount: integer('word_count').notNull().default(0),
  published: boolean('published').notNull().default(false),
  provider: text('provider'),
  model: text('model'),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  publishedAt: timestamp('published_at', { withTimezone: true, mode: 'string' }),
  payload: jsonb('payload').$type<CreativeArtifact>().notNull(),
}, (table) => [
  index('creative_artifacts_session_created_idx').on(table.sessionId, table.createdAt),
  index('creative_artifacts_agent_status_created_idx').on(table.agentId, table.status, table.createdAt),
  index('creative_artifacts_agent_published_created_idx').on(table.agentId, table.published, table.createdAt),
])

export const creativePipelineEvents = pgTable('creative_pipeline_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => creativeSessions.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  status: text('status').notNull(),
  summary: text('summary').notNull(),
  createdAt,
  payload: jsonb('payload').$type<CreativePipelineEvent>().notNull(),
}, (table) => [
  index('creative_pipeline_events_session_created_idx').on(table.sessionId, table.createdAt),
  index('creative_pipeline_events_stage_created_idx').on(table.stage, table.createdAt),
])

export const profileAnalysisRuns = pgTable('profile_analysis_runs', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  qualityStatus: text('quality_status').notNull().default('legacy_unvalidated'),
  qualityScore: integer('quality_score'),
  promptVersion: text('prompt_version'),
  profileVersion: text('profile_version'),
  latestStage: text('latest_stage').notNull(),
  sourceCount: integer('source_count').notNull().default(0),
  transcriptCount: integer('transcript_count').notNull().default(0),
  provider: text('provider'),
  model: text('model'),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  payload: jsonb('payload').$type<ProfileAnalysisRun>().notNull(),
  createdAt,
}, (table) => [
  index('profile_analysis_runs_agent_created_idx').on(table.agentId, table.createdAt),
  index('profile_analysis_runs_agent_status_created_idx').on(table.agentId, table.status, table.createdAt),
])

export const profileInterviewTurns = pgTable('profile_interview_turns', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => profileAnalysisRuns.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  order: integer('turn_order').notNull(),
  question: text('question').notNull(),
  answer: text('answer').notNull(),
  createdAt,
  payload: jsonb('payload').$type<ProfileInterviewTurn>().notNull(),
}, (table) => [
  index('profile_interview_turns_run_order_idx').on(table.runId, table.order),
  index('profile_interview_turns_stage_created_idx').on(table.stage, table.createdAt),
])

export const profilePipelineEvents = pgTable('profile_pipeline_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => profileAnalysisRuns.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  status: text('status').notNull(),
  summary: text('summary').notNull(),
  createdAt,
  payload: jsonb('payload').$type<ProfilePipelineEvent>().notNull(),
}, (table) => [
  index('profile_pipeline_events_run_created_idx').on(table.runId, table.createdAt),
  index('profile_pipeline_events_stage_created_idx').on(table.stage, table.createdAt),
])

export const dreamSessions = pgTable('dream_sessions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  qualityStatus: text('quality_status').notNull().default('legacy_unvalidated'),
  repairCount: integer('repair_count').notNull().default(0),
  promptVersion: text('prompt_version'),
  latestStage: text('latest_stage').notNull(),
  type: text('type').notNull(),
  normalizedInput: jsonb('normalized_input').$type<DreamSession['normalizedInput']>().notNull(),
  contextPacket: jsonb('context_packet').$type<DreamSession['contextPacket'] | null>(),
  latestEvaluation: jsonb('latest_evaluation').$type<DreamSession['latestEvaluation'] | null>(),
  finalDreamId: text('final_dream_id'),
  provider: text('provider'),
  model: text('model'),
  failureReason: text('failure_reason'),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  savedAt: timestamp('saved_at', { withTimezone: true, mode: 'string' }),
  payload: jsonb('payload').$type<DreamSession>().notNull(),
}, (table) => [
  index('dream_sessions_agent_created_idx').on(table.agentId, table.createdAt),
  index('dream_sessions_agent_status_created_idx').on(table.agentId, table.status, table.createdAt),
  index('dream_sessions_agent_type_created_idx').on(table.agentId, table.type, table.createdAt),
])

export const dreams = pgTable('dreams', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  sessionId: text('session_id').notNull().references(() => dreamSessions.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  artifactRole: text('artifact_role'),
  normalizationStatus: text('normalization_status').notNull().default('legacy_unvalidated'),
  qualityScore: integer('quality_score'),
  sourceDreamId: text('source_dream_id'),
  version: integer('version').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  saved: boolean('saved').notNull().default(false),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  savedAt: timestamp('saved_at', { withTimezone: true, mode: 'string' }),
  payload: jsonb('payload').$type<Dream>().notNull(),
}, (table) => [
  index('dreams_agent_created_idx').on(table.agentId, table.createdAt),
  index('dreams_agent_type_created_idx').on(table.agentId, table.type, table.createdAt),
  index('dreams_session_version_idx').on(table.sessionId, table.version),
  index('dreams_agent_saved_created_idx').on(table.agentId, table.saved, table.createdAt),
])

export const dreamPipelineEvents = pgTable('dream_pipeline_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => dreamSessions.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  status: text('status').notNull(),
  summary: text('summary').notNull(),
  createdAt,
  payload: jsonb('payload').$type<DreamPipelineEvent>().notNull(),
}, (table) => [
  index('dream_pipeline_events_session_created_idx').on(table.sessionId, table.createdAt),
  index('dream_pipeline_events_stage_created_idx').on(table.stage, table.createdAt),
])

export const journalSessions = pgTable('journal_sessions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  qualityStatus: text('quality_status').notNull().default('legacy_unvalidated'),
  repairCount: integer('repair_count').notNull().default(0),
  promptVersion: text('prompt_version'),
  latestStage: text('latest_stage').notNull(),
  type: text('type').notNull(),
  normalizedInput: jsonb('normalized_input').$type<JournalSession['normalizedInput']>().notNull(),
  contextPacket: jsonb('context_packet').$type<JournalSession['contextPacket'] | null>(),
  voicePacket: jsonb('voice_packet').$type<JournalSession['voicePacket'] | null>(),
  latestEvaluation: jsonb('latest_evaluation').$type<JournalSession['latestEvaluation'] | null>(),
  finalEntryId: text('final_entry_id'),
  provider: text('provider'),
  model: text('model'),
  failureReason: text('failure_reason'),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  savedAt: timestamp('saved_at', { withTimezone: true, mode: 'string' }),
  payload: jsonb('payload').$type<JournalSession>().notNull(),
}, (table) => [
  index('journal_sessions_agent_created_idx').on(table.agentId, table.createdAt),
  index('journal_sessions_agent_status_created_idx').on(table.agentId, table.status, table.createdAt),
  index('journal_sessions_agent_type_created_idx').on(table.agentId, table.type, table.createdAt),
])

export const journalEntries = pgTable('journal_entries', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  sessionId: text('session_id').notNull().references(() => journalSessions.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  status: text('status').notNull(),
  artifactRole: text('artifact_role'),
  normalizationStatus: text('normalization_status').notNull().default('legacy_unvalidated'),
  qualityScore: integer('quality_score'),
  sourceEntryId: text('source_entry_id'),
  version: integer('version').notNull(),
  title: text('title').notNull(),
  summary: text('summary').notNull(),
  saved: boolean('saved').notNull().default(false),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  savedAt: timestamp('saved_at', { withTimezone: true, mode: 'string' }),
  payload: jsonb('payload').$type<JournalEntry>().notNull(),
}, (table) => [
  index('journal_entries_agent_created_idx').on(table.agentId, table.createdAt),
  index('journal_entries_agent_type_created_idx').on(table.agentId, table.type, table.createdAt),
  index('journal_entries_session_version_idx').on(table.sessionId, table.version),
  index('journal_entries_agent_saved_created_idx').on(table.agentId, table.saved, table.createdAt),
])

export const journalPipelineEvents = pgTable('journal_pipeline_events', {
  id: text('id').primaryKey(),
  sessionId: text('session_id').notNull().references(() => journalSessions.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  status: text('status').notNull(),
  summary: text('summary').notNull(),
  createdAt,
  payload: jsonb('payload').$type<JournalPipelineEvent>().notNull(),
}, (table) => [
  index('journal_pipeline_events_session_created_idx').on(table.sessionId, table.createdAt),
  index('journal_pipeline_events_stage_created_idx').on(table.stage, table.createdAt),
])

export const learningPatterns = pgTable('learning_patterns', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  pattern: text('pattern').notNull(),
  lastObserved: timestamp('last_observed', { withTimezone: true, mode: 'string' }).notNull(),
  payload: jsonb('payload').$type<LearningPattern>().notNull(),
}, (table) => [
  index('learning_patterns_agent_last_observed_idx').on(table.agentId, table.lastObserved),
  uniqueIndex('learning_patterns_agent_type_pattern_unique_idx').on(table.agentId, table.type, table.pattern),
])

export const learningGoals = pgTable('learning_goals', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  status: text('status').notNull(),
  createdAt,
  targetDate: timestamp('target_date', { withTimezone: true, mode: 'string' }),
  payload: jsonb('payload').$type<LearningGoal>().notNull(),
}, (table) => [
  index('learning_goals_agent_status_idx').on(table.agentId, table.status),
  index('learning_goals_agent_created_idx').on(table.agentId, table.createdAt),
])

export const learningAdaptations = pgTable('learning_adaptations', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  isActive: boolean('is_active').notNull().default(true),
  eventTimestamp: timestamp('event_timestamp', { withTimezone: true, mode: 'string' }).notNull(),
  payload: jsonb('payload').$type<LearningAdaptation>().notNull(),
}, (table) => [
  index('learning_adaptations_agent_active_timestamp_idx').on(table.agentId, table.isActive, table.eventTimestamp),
])

export const learningEvents = pgTable('learning_events', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  eventType: text('event_type').notNull(),
  eventTimestamp: timestamp('event_timestamp', { withTimezone: true, mode: 'string' }).notNull(),
  payload: jsonb('payload').$type<LearningEvent>().notNull(),
}, (table) => [
  index('learning_events_agent_timestamp_idx').on(table.agentId, table.eventTimestamp),
])

export const learningObservations = pgTable('learning_observations', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  taskType: text('task_type').notNull(),
  category: text('category').notNull(),
  followUpStatus: text('follow_up_status').notNull(),
  createdAt,
  evaluatedAt: timestamp('evaluated_at', { withTimezone: true, mode: 'string' }),
  payload: jsonb('payload').$type<LearningObservation>().notNull(),
}, (table) => [
  index('learning_observations_agent_created_idx').on(table.agentId, table.createdAt),
  index('learning_observations_agent_status_created_idx').on(table.agentId, table.followUpStatus, table.createdAt),
])

export const skillProgressions = pgTable('skill_progressions', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  category: text('category').notNull(),
  payload: jsonb('payload').$type<SkillProgression>().notNull(),
}, (table) => [
  uniqueIndex('skill_progressions_agent_category_unique_idx').on(table.agentId, table.category),
])

export const agentRateLimits = pgTable('agent_rate_limits', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  feature: text('feature').notNull(),
  count: integer('count').notNull().default(0),
  windowStart: timestamp('window_start', { withTimezone: true, mode: 'string' }).notNull(),
  lastRequest: timestamp('last_request', { withTimezone: true, mode: 'string' }).notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
}, (table) => [
  uniqueIndex('agent_rate_limits_agent_feature_unique_idx').on(table.agentId, table.feature),
])

export const sharedKnowledge = pgTable('shared_knowledge', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  category: text('category').notNull(),
  contributorId: text('contributor_id').notNull(),
  confidence: doublePrecision('confidence').notNull().default(0.5),
  tags: text('tags').array().notNull().default(sql`'{}'::text[]`),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  payload: jsonb('payload').$type<SharedKnowledge>().notNull(),
}, (table) => [
  index('shared_knowledge_category_confidence_idx').on(table.category, table.confidence),
  index('shared_knowledge_contributor_created_idx').on(table.contributorId, table.createdAt),
  index('shared_knowledge_created_idx').on(table.createdAt),
])

export const collectiveBroadcasts = pgTable('collective_broadcasts', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull(),
  topic: text('topic').notNull(),
  knowledgeId: text('knowledge_id'),
  createdAt,
  payload: jsonb('payload').$type<KnowledgeBroadcast>().notNull(),
}, (table) => [
  index('collective_broadcasts_created_idx').on(table.createdAt),
  index('collective_broadcasts_agent_created_idx').on(table.agentId, table.createdAt),
])

export const conflicts = pgTable('conflicts', {
  id: text('id').primaryKey(),
  topic: text('topic').notNull(),
  status: text('status').notNull(),
  participantIds: text('participant_ids').array().notNull().default(sql`'{}'::text[]`),
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  createdAt,
  payload: jsonb('payload').$type<ConflictAnalysis>().notNull(),
}, (table) => [
  index('conflicts_updated_idx').on(table.updatedAt),
  index('conflicts_created_idx').on(table.createdAt),
])

export const challenges = pgTable('challenges', {
  id: text('id').primaryKey(),
  type: text('type').notNull(),
  status: text('status').notNull(),
  participantIds: text('participant_ids').array().notNull().default(sql`'{}'::text[]`),
  createdAt,
  payload: jsonb('payload').$type<Challenge>().notNull(),
}, (table) => [
  index('challenges_created_idx').on(table.createdAt),
  index('challenges_status_created_idx').on(table.status, table.createdAt),
])

export const mentorships = pgTable('mentorships', {
  id: text('id').primaryKey(),
  mentorId: text('mentor_id').notNull(),
  menteeId: text('mentee_id').notNull(),
  status: text('status').notNull(),
  currentFocus: text('current_focus').notNull(),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  payload: jsonb('payload').$type<Mentorship>().notNull(),
}, (table) => [
  index('mentorships_mentor_idx').on(table.mentorId),
  index('mentorships_mentee_idx').on(table.menteeId),
  index('mentorships_status_idx').on(table.status),
])

export const arenaRuns = pgTable('arena_runs', {
  id: text('id').primaryKey(),
  status: text('status').notNull(),
  latestStage: text('latest_stage').notNull(),
  participantIds: text('participant_ids').array().notNull().default(sql`'{}'::text[]`),
  sandboxed: boolean('sandboxed').notNull().default(true),
  cancellationRequested: boolean('cancellation_requested').notNull().default(false),
  roundCount: integer('round_count').notNull().default(10),
  currentRound: integer('current_round').notNull().default(0),
  eventCount: integer('event_count').notNull().default(0),
  winnerAgentId: text('winner_agent_id'),
  provider: text('provider'),
  model: text('model'),
  failureReason: text('failure_reason'),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  completedAt: timestamp('completed_at', { withTimezone: true, mode: 'string' }),
  payload: jsonb('payload').$type<ArenaRun>().notNull(),
}, (table) => [
  index('arena_runs_status_created_idx').on(table.status, table.createdAt),
  index('arena_runs_stage_created_idx').on(table.latestStage, table.createdAt),
  index('arena_runs_created_idx').on(table.createdAt),
])

export const arenaEvents = pgTable('arena_events', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => arenaRuns.id, { onDelete: 'cascade' }),
  sequence: integer('sequence').notNull(),
  stage: text('stage').notNull(),
  kind: text('kind').notNull(),
  speakerType: text('speaker_type').notNull(),
  speakerAgentId: text('speaker_agent_id'),
  round: integer('round'),
  createdAt,
  payload: jsonb('payload').$type<ArenaEvent>().notNull(),
}, (table) => [
  uniqueIndex('arena_events_run_sequence_unique_idx').on(table.runId, table.sequence),
  index('arena_events_run_created_idx').on(table.runId, table.createdAt),
  index('arena_events_kind_created_idx').on(table.kind, table.createdAt),
])

export const simulations = pgTable('simulations', {
  id: text('id').primaryKey(),
  agentIds: text('agent_ids').array().notNull().default(sql`'{}'::text[]`),
  createdAt,
  payload: jsonb('payload').$type<SimulationRecord>().notNull(),
}, (table) => [
  index('simulations_created_idx').on(table.createdAt),
])

export const scenarioRuns = pgTable('scenario_runs', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  status: text('status').notNull(),
  qualityStatus: text('quality_status').notNull().default('legacy_unvalidated'),
  qualityScore: integer('quality_score'),
  failureReason: text('failure_reason'),
  promptVersion: text('prompt_version'),
  branchKind: text('branch_kind').notNull(),
  branchRefId: text('branch_ref_id').notNull(),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  payload: jsonb('payload').$type<ScenarioRunRecord>().notNull(),
}, (table) => [
  index('scenario_runs_agent_created_idx').on(table.agentId, table.createdAt),
  index('scenario_runs_status_created_idx').on(table.status, table.createdAt),
  index('scenario_runs_branch_ref_idx').on(table.branchKind, table.branchRefId),
])

export const migrationOutbox = pgTable('migration_outbox', {
  id: text('id').primaryKey(),
  entityType: text('entity_type').notNull(),
  entityId: text('entity_id').notNull(),
  operation: text('operation').notNull(),
  payload: jsonb('payload').$type<Record<string, unknown>>().notNull(),
  errorMessage: text('error_message').notNull(),
  attempts: integer('attempts').notNull().default(1),
  createdAt,
  lastAttemptAt: timestamp('last_attempt_at', { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
  index('migration_outbox_entity_idx').on(table.entityType, table.entityId),
  index('migration_outbox_created_idx').on(table.createdAt),
])

export const schema = {
  agents,
  messages,
  memories,
  memoryGraphs,
  agentPersonalityEvents,
  agentRelationships,
  relationshipEvidence,
  relationshipRevisions,
  relationshipSynthesisRuns,
  creativeSessions,
  creativeArtifacts,
  creativePipelineEvents,
  profileAnalysisRuns,
  profileInterviewTurns,
  profilePipelineEvents,
  dreamSessions,
  dreams,
  dreamPipelineEvents,
  journalSessions,
  journalEntries,
  journalPipelineEvents,
  learningPatterns,
  learningGoals,
  learningAdaptations,
  learningEvents,
  learningObservations,
  skillProgressions,
  agentRateLimits,
  sharedKnowledge,
  collectiveBroadcasts,
  conflicts,
  challenges,
  mentorships,
  arenaRuns,
  arenaEvents,
  simulations,
  scenarioRuns,
  migrationOutbox,
}
