CREATE TABLE IF NOT EXISTS "creative_sessions" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "format" text NOT NULL,
  "brief" jsonb NOT NULL,
  "normalized_brief" jsonb NOT NULL,
  "context_packet" jsonb,
  "latest_evaluation" jsonb,
  "draft_artifact_id" text,
  "final_artifact_id" text,
  "published_artifact_id" text,
  "provider" text,
  "model" text,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "published_at" timestamptz,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "creative_sessions_agent_created_idx"
  ON "creative_sessions" ("agent_id", "created_at");
CREATE INDEX IF NOT EXISTS "creative_sessions_agent_status_created_idx"
  ON "creative_sessions" ("agent_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "creative_sessions_agent_format_created_idx"
  ON "creative_sessions" ("agent_id", "format", "created_at");

CREATE TABLE IF NOT EXISTS "creative_artifacts" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "session_id" text NOT NULL REFERENCES "creative_sessions"("id") ON DELETE CASCADE,
  "format" text NOT NULL,
  "status" text NOT NULL,
  "version" integer NOT NULL,
  "title" text NOT NULL,
  "summary" text NOT NULL,
  "word_count" integer NOT NULL DEFAULT 0,
  "published" boolean NOT NULL DEFAULT false,
  "provider" text,
  "model" text,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "published_at" timestamptz,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "creative_artifacts_session_created_idx"
  ON "creative_artifacts" ("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "creative_artifacts_agent_status_created_idx"
  ON "creative_artifacts" ("agent_id", "status", "created_at");
CREATE INDEX IF NOT EXISTS "creative_artifacts_agent_published_created_idx"
  ON "creative_artifacts" ("agent_id", "published", "created_at");

CREATE TABLE IF NOT EXISTS "creative_pipeline_events" (
  "id" text PRIMARY KEY NOT NULL,
  "session_id" text NOT NULL REFERENCES "creative_sessions"("id") ON DELETE CASCADE,
  "stage" text NOT NULL,
  "status" text NOT NULL,
  "summary" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "creative_pipeline_events_session_created_idx"
  ON "creative_pipeline_events" ("session_id", "created_at");
CREATE INDEX IF NOT EXISTS "creative_pipeline_events_stage_created_idx"
  ON "creative_pipeline_events" ("stage", "created_at");

ALTER TABLE "agents"
  ALTER COLUMN "creative_works" SET DEFAULT 0;

UPDATE "agents" SET "creative_works" = 0;

DROP TABLE IF EXISTS "creative_works" CASCADE;
