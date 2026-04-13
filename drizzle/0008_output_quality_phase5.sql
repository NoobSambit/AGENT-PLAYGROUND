ALTER TABLE "memories"
  ADD COLUMN IF NOT EXISTS "canonical_key" text,
  ADD COLUMN IF NOT EXISTS "canonical_value" text,
  ADD COLUMN IF NOT EXISTS "confidence" double precision,
  ADD COLUMN IF NOT EXISTS "evidence_refs" text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS "supersedes" text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS "last_confirmed_at" timestamptz;

CREATE INDEX IF NOT EXISTS "memories_agent_canonical_key_active_idx"
  ON "memories" ("agent_id", "canonical_key", "is_active");

ALTER TABLE "creative_sessions"
  ADD COLUMN IF NOT EXISTS "quality_status" text NOT NULL DEFAULT 'legacy_unvalidated',
  ADD COLUMN IF NOT EXISTS "repair_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "prompt_version" text,
  ADD COLUMN IF NOT EXISTS "failure_reason" text;

ALTER TABLE "creative_artifacts"
  ADD COLUMN IF NOT EXISTS "artifact_role" text,
  ADD COLUMN IF NOT EXISTS "normalization_status" text NOT NULL DEFAULT 'legacy_unvalidated',
  ADD COLUMN IF NOT EXISTS "quality_score" integer,
  ADD COLUMN IF NOT EXISTS "source_artifact_id" text;

ALTER TABLE "profile_analysis_runs"
  ADD COLUMN IF NOT EXISTS "quality_status" text NOT NULL DEFAULT 'legacy_unvalidated',
  ADD COLUMN IF NOT EXISTS "quality_score" integer,
  ADD COLUMN IF NOT EXISTS "prompt_version" text,
  ADD COLUMN IF NOT EXISTS "profile_version" text;

ALTER TABLE "journal_sessions"
  ADD COLUMN IF NOT EXISTS "quality_status" text NOT NULL DEFAULT 'legacy_unvalidated',
  ADD COLUMN IF NOT EXISTS "repair_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "prompt_version" text;

ALTER TABLE "journal_entries"
  ADD COLUMN IF NOT EXISTS "artifact_role" text,
  ADD COLUMN IF NOT EXISTS "normalization_status" text NOT NULL DEFAULT 'legacy_unvalidated',
  ADD COLUMN IF NOT EXISTS "quality_score" integer,
  ADD COLUMN IF NOT EXISTS "source_entry_id" text;

ALTER TABLE "dream_sessions"
  ADD COLUMN IF NOT EXISTS "quality_status" text NOT NULL DEFAULT 'legacy_unvalidated',
  ADD COLUMN IF NOT EXISTS "repair_count" integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "prompt_version" text;

ALTER TABLE "dreams"
  ADD COLUMN IF NOT EXISTS "artifact_role" text,
  ADD COLUMN IF NOT EXISTS "normalization_status" text NOT NULL DEFAULT 'legacy_unvalidated',
  ADD COLUMN IF NOT EXISTS "quality_score" integer,
  ADD COLUMN IF NOT EXISTS "source_dream_id" text;

ALTER TABLE "scenario_runs"
  ADD COLUMN IF NOT EXISTS "quality_status" text NOT NULL DEFAULT 'legacy_unvalidated',
  ADD COLUMN IF NOT EXISTS "quality_score" integer,
  ADD COLUMN IF NOT EXISTS "failure_reason" text,
  ADD COLUMN IF NOT EXISTS "prompt_version" text;
