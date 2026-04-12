DROP TABLE IF EXISTS "journal_pipeline_events" CASCADE;
DROP TABLE IF EXISTS "journal_entries" CASCADE;
DROP TABLE IF EXISTS "journal_sessions" CASCADE;

CREATE TABLE IF NOT EXISTS "journal_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "status" text NOT NULL,
  "latest_stage" text NOT NULL,
  "type" text NOT NULL,
  "normalized_input" jsonb NOT NULL,
  "context_packet" jsonb,
  "voice_packet" jsonb,
  "latest_evaluation" jsonb,
  "final_entry_id" text,
  "provider" text,
  "model" text,
  "failure_reason" text,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "saved_at" timestamptz,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "journal_sessions_agent_created_idx"
  ON "journal_sessions" ("agent_id", "created_at");

CREATE INDEX IF NOT EXISTS "journal_sessions_agent_status_created_idx"
  ON "journal_sessions" ("agent_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "journal_sessions_agent_type_created_idx"
  ON "journal_sessions" ("agent_id", "type", "created_at");

CREATE TABLE IF NOT EXISTS "journal_entries" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "session_id" text NOT NULL REFERENCES "journal_sessions"("id") ON DELETE cascade,
  "type" text NOT NULL,
  "status" text NOT NULL,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "saved" boolean NOT NULL DEFAULT false,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "saved_at" timestamptz,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "journal_entries_agent_created_idx"
  ON "journal_entries" ("agent_id", "created_at");

CREATE INDEX IF NOT EXISTS "journal_entries_agent_type_created_idx"
  ON "journal_entries" ("agent_id", "type", "created_at");

CREATE INDEX IF NOT EXISTS "journal_entries_session_version_idx"
  ON "journal_entries" ("session_id", "version");

CREATE INDEX IF NOT EXISTS "journal_entries_agent_saved_created_idx"
  ON "journal_entries" ("agent_id", "saved", "created_at");

CREATE TABLE IF NOT EXISTS "journal_pipeline_events" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL REFERENCES "journal_sessions"("id") ON DELETE cascade,
  "stage" text NOT NULL,
  "status" text NOT NULL,
  "summary" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "journal_pipeline_events_session_created_idx"
  ON "journal_pipeline_events" ("session_id", "created_at");

CREATE INDEX IF NOT EXISTS "journal_pipeline_events_stage_created_idx"
  ON "journal_pipeline_events" ("stage", "created_at");
