CREATE TABLE IF NOT EXISTS "arena_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "status" text NOT NULL,
  "latest_stage" text NOT NULL,
  "participant_ids" text[] DEFAULT '{}'::text[] NOT NULL,
  "sandboxed" boolean DEFAULT true NOT NULL,
  "cancellation_requested" boolean DEFAULT false NOT NULL,
  "round_count" integer DEFAULT 10 NOT NULL,
  "current_round" integer DEFAULT 0 NOT NULL,
  "event_count" integer DEFAULT 0 NOT NULL,
  "winner_agent_id" text,
  "provider" text,
  "model" text,
  "failure_reason" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "payload" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "arena_events" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL REFERENCES "arena_runs"("id") ON DELETE cascade,
  "sequence" integer NOT NULL,
  "stage" text NOT NULL,
  "kind" text NOT NULL,
  "speaker_type" text NOT NULL,
  "speaker_agent_id" text,
  "round" integer,
  "created_at" timestamp with time zone NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "arena_runs_status_created_idx" ON "arena_runs" ("status","created_at");
CREATE INDEX IF NOT EXISTS "arena_runs_stage_created_idx" ON "arena_runs" ("latest_stage","created_at");
CREATE INDEX IF NOT EXISTS "arena_runs_created_idx" ON "arena_runs" ("created_at");
CREATE UNIQUE INDEX IF NOT EXISTS "arena_events_run_sequence_unique_idx" ON "arena_events" ("run_id","sequence");
CREATE INDEX IF NOT EXISTS "arena_events_run_created_idx" ON "arena_events" ("run_id","created_at");
CREATE INDEX IF NOT EXISTS "arena_events_kind_created_idx" ON "arena_events" ("kind","created_at");
