import { sql } from 'drizzle-orm'
import {
  boolean,
  doublePrecision,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uniqueIndex,
} from 'drizzle-orm/pg-core'
import type {
  AgentRecord,
  AgentRelationship,
  AgentStats,
  CreativeWork,
  Dream,
  EmotionalEvent,
  EmotionalProfile,
  EmotionalState,
  JournalEntry,
  LinguisticProfile,
  MemoryGraph,
  MemoryRecord,
  Mentorship,
  MessageRecord,
  PersonalityEventRecord,
  PsychologicalProfile,
  SharedKnowledge,
  SimulationRecord,
  Challenge,
} from '@/types/database'
import type {
  LearningAdaptation,
  LearningEvent,
  LearningGoal,
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
  metadata: jsonb('metadata').$type<MemoryRecord['metadata'] | null>(),
  userId: text('user_id'),
  isActive: boolean('is_active').notNull().default(true),
  timestamp: timestamp('timestamp', { withTimezone: true, mode: 'string' }).notNull(),
}, (table) => [
  index('memories_agent_type_active_timestamp_idx').on(table.agentId, table.type, table.isActive, table.timestamp),
  index('memories_agent_active_timestamp_idx').on(table.agentId, table.isActive, table.timestamp),
  index('memories_agent_origin_active_timestamp_idx').on(table.agentId, table.origin, table.isActive, table.timestamp),
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

export const creativeWorks = pgTable('creative_works', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  createdAt,
  payload: jsonb('payload').$type<CreativeWork>().notNull(),
}, (table) => [
  index('creative_works_agent_created_idx').on(table.agentId, table.createdAt),
  index('creative_works_agent_type_created_idx').on(table.agentId, table.type, table.createdAt),
])

export const dreams = pgTable('dreams', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  createdAt,
  payload: jsonb('payload').$type<Dream>().notNull(),
}, (table) => [
  index('dreams_agent_created_idx').on(table.agentId, table.createdAt),
  index('dreams_agent_type_created_idx').on(table.agentId, table.type, table.createdAt),
])

export const journalEntries = pgTable('journal_entries', {
  id: text('id').primaryKey(),
  agentId: text('agent_id').notNull().references(() => agents.id, { onDelete: 'cascade' }),
  type: text('type').notNull(),
  createdAt,
  updatedAt: timestamp('updated_at', { withTimezone: true, mode: 'string' }).notNull(),
  payload: jsonb('payload').$type<JournalEntry>().notNull(),
}, (table) => [
  index('journal_entries_agent_created_idx').on(table.agentId, table.createdAt),
  index('journal_entries_agent_type_created_idx').on(table.agentId, table.type, table.createdAt),
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

export const simulations = pgTable('simulations', {
  id: text('id').primaryKey(),
  agentIds: text('agent_ids').array().notNull().default(sql`'{}'::text[]`),
  createdAt,
  payload: jsonb('payload').$type<SimulationRecord>().notNull(),
}, (table) => [
  index('simulations_created_idx').on(table.createdAt),
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
  creativeWorks,
  dreams,
  journalEntries,
  learningPatterns,
  learningGoals,
  learningAdaptations,
  learningEvents,
  skillProgressions,
  agentRateLimits,
  sharedKnowledge,
  collectiveBroadcasts,
  conflicts,
  challenges,
  mentorships,
  simulations,
  migrationOutbox,
}
