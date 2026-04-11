CREATE TABLE IF NOT EXISTS "profile_analysis_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "status" text NOT NULL,
  "latest_stage" text NOT NULL,
  "source_count" integer NOT NULL DEFAULT 0,
  "transcript_count" integer NOT NULL DEFAULT 0,
  "provider" text,
  "model" text,
  "completed_at" timestamptz,
  "updated_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL,
  "created_at" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "profile_analysis_runs_agent_created_idx"
  ON "profile_analysis_runs" ("agent_id", "created_at");

CREATE INDEX IF NOT EXISTS "profile_analysis_runs_agent_status_created_idx"
  ON "profile_analysis_runs" ("agent_id", "status", "created_at");

CREATE TABLE IF NOT EXISTS "profile_interview_turns" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL REFERENCES "profile_analysis_runs"("id") ON DELETE cascade,
  "stage" text NOT NULL,
  "turn_order" integer NOT NULL,
  "question" text NOT NULL,
  "answer" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "profile_interview_turns_run_order_idx"
  ON "profile_interview_turns" ("run_id", "turn_order");

CREATE INDEX IF NOT EXISTS "profile_interview_turns_stage_created_idx"
  ON "profile_interview_turns" ("stage", "created_at");

CREATE TABLE IF NOT EXISTS "profile_pipeline_events" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL REFERENCES "profile_analysis_runs"("id") ON DELETE cascade,
  "stage" text NOT NULL,
  "status" text NOT NULL,
  "summary" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "profile_pipeline_events_run_created_idx"
  ON "profile_pipeline_events" ("run_id", "created_at");

CREATE INDEX IF NOT EXISTS "profile_pipeline_events_stage_created_idx"
  ON "profile_pipeline_events" ("stage", "created_at");
