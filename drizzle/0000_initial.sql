CREATE TABLE IF NOT EXISTS "agents" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "persona" text NOT NULL,
  "goals" text[] NOT NULL DEFAULT '{}'::text[],
  "status" text NOT NULL,
  "user_id" text,
  "settings" jsonb,
  "core_traits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "dynamic_traits" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "memory_count" integer NOT NULL DEFAULT 0,
  "total_interactions" integer NOT NULL DEFAULT 0,
  "linguistic_profile" jsonb,
  "emotional_profile" jsonb,
  "emotional_state" jsonb,
  "emotional_history" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "progress" jsonb,
  "stats" jsonb,
  "psychological_profile" jsonb,
  "relationship_count" integer NOT NULL DEFAULT 0,
  "creative_works" integer NOT NULL DEFAULT 0,
  "dream_count" integer NOT NULL DEFAULT 0,
  "journal_count" integer NOT NULL DEFAULT 0,
  "challenges_completed" integer NOT NULL DEFAULT 0,
  "challenge_wins" integer NOT NULL DEFAULT 0,
  "mentorship_stats" jsonb,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "agents_status_idx" ON "agents" ("status");
CREATE INDEX IF NOT EXISTS "agents_updated_at_idx" ON "agents" ("updated_at");
CREATE INDEX IF NOT EXISTS "agents_created_at_idx" ON "agents" ("created_at");

CREATE TABLE IF NOT EXISTS "messages" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "content" text NOT NULL,
  "type" text NOT NULL,
  "room_id" text,
  "metadata" jsonb,
  "user_id" text,
  "timestamp" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "messages_agent_timestamp_idx" ON "messages" ("agent_id", "timestamp");
CREATE INDEX IF NOT EXISTS "messages_room_timestamp_idx" ON "messages" ("room_id", "timestamp");
CREATE INDEX IF NOT EXISTS "messages_timestamp_idx" ON "messages" ("timestamp");

CREATE TABLE IF NOT EXISTS "memories" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "content" text NOT NULL,
  "summary" text NOT NULL,
  "keywords" text[] NOT NULL DEFAULT '{}'::text[],
  "importance" integer NOT NULL,
  "context" text NOT NULL,
  "metadata" jsonb,
  "user_id" text,
  "is_active" boolean NOT NULL DEFAULT true,
  "timestamp" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "memories_agent_type_active_timestamp_idx" ON "memories" ("agent_id", "type", "is_active", "timestamp");
CREATE INDEX IF NOT EXISTS "memories_agent_active_timestamp_idx" ON "memories" ("agent_id", "is_active", "timestamp");

CREATE TABLE IF NOT EXISTS "memory_graphs" (
  "agent_id" text PRIMARY KEY REFERENCES "agents"("id") ON DELETE CASCADE,
  "payload" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL
);

CREATE TABLE IF NOT EXISTS "agent_relationships" (
  "id" text PRIMARY KEY,
  "agent_id_1" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "agent_id_2" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "relationship_types" text[] NOT NULL DEFAULT '{}'::text[],
  "interaction_count" integer NOT NULL DEFAULT 0,
  "first_meeting" timestamptz NOT NULL,
  "last_interaction" timestamptz NOT NULL,
  "metrics" jsonb NOT NULL,
  "significant_events" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_relationships_pair_unique_idx" ON "agent_relationships" ("agent_id_1", "agent_id_2");
CREATE INDEX IF NOT EXISTS "agent_relationships_agent1_idx" ON "agent_relationships" ("agent_id_1");
CREATE INDEX IF NOT EXISTS "agent_relationships_agent2_idx" ON "agent_relationships" ("agent_id_2");
CREATE INDEX IF NOT EXISTS "agent_relationships_status_idx" ON "agent_relationships" ("status");

CREATE TABLE IF NOT EXISTS "creative_works" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "creative_works_agent_created_idx" ON "creative_works" ("agent_id", "created_at");
CREATE INDEX IF NOT EXISTS "creative_works_agent_type_created_idx" ON "creative_works" ("agent_id", "type", "created_at");

CREATE TABLE IF NOT EXISTS "dreams" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "dreams_agent_created_idx" ON "dreams" ("agent_id", "created_at");
CREATE INDEX IF NOT EXISTS "dreams_agent_type_created_idx" ON "dreams" ("agent_id", "type", "created_at");

CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "journal_entries_agent_created_idx" ON "journal_entries" ("agent_id", "created_at");
CREATE INDEX IF NOT EXISTS "journal_entries_agent_type_created_idx" ON "journal_entries" ("agent_id", "type", "created_at");

CREATE TABLE IF NOT EXISTS "learning_patterns" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "type" text NOT NULL,
  "pattern" text NOT NULL,
  "last_observed" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "learning_patterns_agent_last_observed_idx" ON "learning_patterns" ("agent_id", "last_observed");
CREATE UNIQUE INDEX IF NOT EXISTS "learning_patterns_agent_type_pattern_unique_idx" ON "learning_patterns" ("agent_id", "type", "pattern");

CREATE TABLE IF NOT EXISTS "learning_goals" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "status" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "target_date" timestamptz,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "learning_goals_agent_status_idx" ON "learning_goals" ("agent_id", "status");
CREATE INDEX IF NOT EXISTS "learning_goals_agent_created_idx" ON "learning_goals" ("agent_id", "created_at");

CREATE TABLE IF NOT EXISTS "learning_adaptations" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "is_active" boolean NOT NULL DEFAULT true,
  "event_timestamp" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "learning_adaptations_agent_active_timestamp_idx" ON "learning_adaptations" ("agent_id", "is_active", "event_timestamp");

CREATE TABLE IF NOT EXISTS "learning_events" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "event_type" text NOT NULL,
  "event_timestamp" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "learning_events_agent_timestamp_idx" ON "learning_events" ("agent_id", "event_timestamp");

CREATE TABLE IF NOT EXISTS "skill_progressions" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "category" text NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS "skill_progressions_agent_category_unique_idx" ON "skill_progressions" ("agent_id", "category");

CREATE TABLE IF NOT EXISTS "agent_rate_limits" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "feature" text NOT NULL,
  "count" integer NOT NULL DEFAULT 0,
  "window_start" timestamptz NOT NULL,
  "last_request" timestamptz NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb
);

CREATE UNIQUE INDEX IF NOT EXISTS "agent_rate_limits_agent_feature_unique_idx" ON "agent_rate_limits" ("agent_id", "feature");

CREATE TABLE IF NOT EXISTS "shared_knowledge" (
  "id" text PRIMARY KEY,
  "topic" text NOT NULL,
  "category" text NOT NULL,
  "contributor_id" text NOT NULL,
  "confidence" double precision NOT NULL DEFAULT 0.5,
  "tags" text[] NOT NULL DEFAULT '{}'::text[],
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "shared_knowledge_category_confidence_idx" ON "shared_knowledge" ("category", "confidence");
CREATE INDEX IF NOT EXISTS "shared_knowledge_contributor_created_idx" ON "shared_knowledge" ("contributor_id", "created_at");
CREATE INDEX IF NOT EXISTS "shared_knowledge_created_idx" ON "shared_knowledge" ("created_at");

CREATE TABLE IF NOT EXISTS "collective_broadcasts" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL,
  "topic" text NOT NULL,
  "knowledge_id" text,
  "created_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "collective_broadcasts_created_idx" ON "collective_broadcasts" ("created_at");
CREATE INDEX IF NOT EXISTS "collective_broadcasts_topic_created_idx" ON "collective_broadcasts" ("topic", "created_at");

CREATE TABLE IF NOT EXISTS "conflicts" (
  "id" text PRIMARY KEY,
  "topic" text NOT NULL,
  "status" text NOT NULL,
  "participant_ids" text[] NOT NULL DEFAULT '{}'::text[],
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "conflicts_status_updated_idx" ON "conflicts" ("status", "updated_at");
CREATE INDEX IF NOT EXISTS "conflicts_created_idx" ON "conflicts" ("created_at");

CREATE TABLE IF NOT EXISTS "challenges" (
  "id" text PRIMARY KEY,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "participant_ids" text[] NOT NULL DEFAULT '{}'::text[],
  "created_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "challenges_status_created_idx" ON "challenges" ("status", "created_at");
CREATE INDEX IF NOT EXISTS "challenges_type_created_idx" ON "challenges" ("type", "created_at");

CREATE TABLE IF NOT EXISTS "mentorships" (
  "id" text PRIMARY KEY,
  "mentor_id" text NOT NULL REFERENCES "agents"("id"),
  "mentee_id" text NOT NULL REFERENCES "agents"("id"),
  "status" text NOT NULL,
  "current_focus" text,
  "focus_areas" text[] NOT NULL DEFAULT '{}'::text[],
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "mentorships_mentor_idx" ON "mentorships" ("mentor_id", "status");
CREATE INDEX IF NOT EXISTS "mentorships_mentee_idx" ON "mentorships" ("mentee_id", "status");

CREATE TABLE IF NOT EXISTS "simulations" (
  "id" text PRIMARY KEY,
  "agent_ids" text[] NOT NULL DEFAULT '{}'::text[],
  "created_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "simulations_created_idx" ON "simulations" ("created_at");

CREATE TABLE IF NOT EXISTS "migration_outbox" (
  "id" text PRIMARY KEY,
  "entity_type" text NOT NULL,
  "entity_id" text NOT NULL,
  "operation" text NOT NULL,
  "payload" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "error_message" text NOT NULL,
  "attempts" integer NOT NULL DEFAULT 1,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "last_attempt_at" timestamptz
);

CREATE INDEX IF NOT EXISTS "migration_outbox_entity_idx" ON "migration_outbox" ("entity_type", "entity_id");
CREATE INDEX IF NOT EXISTS "migration_outbox_created_idx" ON "migration_outbox" ("created_at");
