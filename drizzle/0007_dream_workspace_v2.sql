DROP TABLE IF EXISTS "dream_pipeline_events" CASCADE;
DROP TABLE IF EXISTS "dreams" CASCADE;
DROP TABLE IF EXISTS "dream_sessions" CASCADE;

ALTER TABLE "agents"
  ADD COLUMN IF NOT EXISTS "active_dream_impression" jsonb;

CREATE TABLE IF NOT EXISTS "dream_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "status" text NOT NULL,
  "latest_stage" text NOT NULL,
  "type" text NOT NULL,
  "normalized_input" jsonb NOT NULL,
  "context_packet" jsonb,
  "latest_evaluation" jsonb,
  "final_dream_id" text,
  "provider" text,
  "model" text,
  "failure_reason" text,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "saved_at" timestamptz,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "dream_sessions_agent_created_idx"
  ON "dream_sessions" ("agent_id", "created_at");

CREATE INDEX IF NOT EXISTS "dream_sessions_agent_status_created_idx"
  ON "dream_sessions" ("agent_id", "status", "created_at");

CREATE INDEX IF NOT EXISTS "dream_sessions_agent_type_created_idx"
  ON "dream_sessions" ("agent_id", "type", "created_at");

CREATE TABLE IF NOT EXISTS "dreams" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "session_id" text NOT NULL REFERENCES "dream_sessions"("id") ON DELETE cascade,
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

CREATE INDEX IF NOT EXISTS "dreams_agent_created_idx"
  ON "dreams" ("agent_id", "created_at");

CREATE INDEX IF NOT EXISTS "dreams_agent_type_created_idx"
  ON "dreams" ("agent_id", "type", "created_at");

CREATE INDEX IF NOT EXISTS "dreams_session_version_idx"
  ON "dreams" ("session_id", "version");

CREATE INDEX IF NOT EXISTS "dreams_agent_saved_created_idx"
  ON "dreams" ("agent_id", "saved", "created_at");

CREATE TABLE IF NOT EXISTS "dream_pipeline_events" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL REFERENCES "dream_sessions"("id") ON DELETE cascade,
  "stage" text NOT NULL,
  "status" text NOT NULL,
  "summary" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "dream_pipeline_events_session_created_idx"
  ON "dream_pipeline_events" ("session_id", "created_at");

CREATE INDEX IF NOT EXISTS "dream_pipeline_events_stage_created_idx"
  ON "dream_pipeline_events" ("stage", "created_at");
