DROP TABLE IF EXISTS "challenges" CASCADE;

CREATE TABLE IF NOT EXISTS "challenge_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "primary_agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "mode" text NOT NULL,
  "template_id" text NOT NULL,
  "status" text NOT NULL,
  "latest_stage" text NOT NULL,
  "participant_ids" text[] DEFAULT '{}'::text[] NOT NULL,
  "event_count" integer DEFAULT 0 NOT NULL,
  "quality_status" text DEFAULT 'pending' NOT NULL,
  "quality_score" integer,
  "winner_agent_id" text,
  "provider" text,
  "model" text,
  "failure_reason" text,
  "cancellation_requested" boolean DEFAULT false NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "completed_at" timestamp with time zone,
  "payload" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "challenge_events" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL REFERENCES "challenge_runs"("id") ON DELETE cascade,
  "sequence" integer NOT NULL,
  "stage" text NOT NULL,
  "kind" text NOT NULL,
  "speaker_type" text NOT NULL,
  "speaker_agent_id" text,
  "created_at" timestamp with time zone NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "challenge_participant_results" (
  "id" text PRIMARY KEY NOT NULL,
  "run_id" text NOT NULL REFERENCES "challenge_runs"("id") ON DELETE cascade,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "template_id" text NOT NULL,
  "mode" text NOT NULL,
  "outcome" text NOT NULL,
  "total_score" integer NOT NULL,
  "capability_score" integer NOT NULL,
  "relationship_score" integer,
  "created_at" timestamp with time zone NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "challenge_runs_primary_updated_idx" ON "challenge_runs" ("primary_agent_id","updated_at");
CREATE INDEX IF NOT EXISTS "challenge_runs_updated_idx" ON "challenge_runs" ("updated_at");
CREATE INDEX IF NOT EXISTS "challenge_runs_participant_ids_idx" ON "challenge_runs" USING gin ("participant_ids");
CREATE INDEX IF NOT EXISTS "challenge_runs_status_updated_idx" ON "challenge_runs" ("status","updated_at");
CREATE INDEX IF NOT EXISTS "challenge_runs_template_updated_idx" ON "challenge_runs" ("template_id","updated_at");
CREATE UNIQUE INDEX IF NOT EXISTS "challenge_events_run_sequence_unique_idx" ON "challenge_events" ("run_id","sequence");
CREATE INDEX IF NOT EXISTS "challenge_events_run_sequence_idx" ON "challenge_events" ("run_id","sequence");
CREATE INDEX IF NOT EXISTS "challenge_results_agent_created_idx" ON "challenge_participant_results" ("agent_id","created_at");
CREATE INDEX IF NOT EXISTS "challenge_results_run_idx" ON "challenge_participant_results" ("run_id");
