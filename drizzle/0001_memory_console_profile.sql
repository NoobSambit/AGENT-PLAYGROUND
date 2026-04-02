ALTER TABLE "memories"
  ADD COLUMN IF NOT EXISTS "origin" text NOT NULL DEFAULT 'imported';

ALTER TABLE "memories"
  ADD COLUMN IF NOT EXISTS "linked_message_ids" text[] NOT NULL DEFAULT '{}'::text[];

UPDATE "memories"
SET "origin" = CASE
  WHEN "type" = 'conversation' THEN 'conversation'
  WHEN "type" = 'interaction' THEN 'tool'
  WHEN "type" = 'personality_insight' THEN 'system'
  ELSE 'imported'
END
WHERE "origin" = 'imported';

CREATE INDEX IF NOT EXISTS "memories_agent_origin_active_timestamp_idx"
  ON "memories" ("agent_id", "origin", "is_active", "timestamp");

CREATE TABLE IF NOT EXISTS "agent_personality_events" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "source" text NOT NULL,
  "trigger" text NOT NULL,
  "summary" text NOT NULL,
  "trait_deltas" jsonb NOT NULL DEFAULT '[]'::jsonb,
  "before_traits" jsonb,
  "after_traits" jsonb,
  "linked_message_ids" text[] NOT NULL DEFAULT '{}'::text[],
  "metadata" jsonb,
  "created_at" timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS "agent_personality_events_agent_created_idx"
  ON "agent_personality_events" ("agent_id", "created_at");

CREATE INDEX IF NOT EXISTS "agent_personality_events_source_created_idx"
  ON "agent_personality_events" ("source", "created_at");

INSERT INTO "agent_personality_events" (
  "id",
  "agent_id",
  "source",
  "trigger",
  "summary",
  "trait_deltas",
  "before_traits",
  "after_traits",
  "linked_message_ids",
  "metadata",
  "created_at"
)
SELECT
  'profile_event_' || "id",
  "agent_id",
  'migration',
  'legacy_personality_memory',
  COALESCE(NULLIF("summary", ''), 'Imported personality evolution event'),
  CASE
    WHEN jsonb_typeof("metadata"->'analyses') = 'array' THEN "metadata"->'analyses'
    ELSE '[]'::jsonb
  END,
  NULL,
  NULL,
  COALESCE("linked_message_ids", '{}'::text[]),
  jsonb_build_object(
    'migratedFromMemoryId', "id",
    'legacyType', "type",
    'legacyContext', "context",
    'legacyMetadata', COALESCE("metadata", '{}'::jsonb)
  ),
  "timestamp"
FROM "memories"
WHERE "type" = 'personality_insight'
ON CONFLICT ("id") DO NOTHING;

UPDATE "memories"
SET "is_active" = false
WHERE "type" = 'personality_insight'
  AND "is_active" = true;

UPDATE "agents"
SET "memory_count" = COALESCE((
  SELECT COUNT(*)
  FROM "memories"
  WHERE "memories"."agent_id" = "agents"."id"
    AND "memories"."is_active" = true
    AND "memories"."type" <> 'personality_insight'
), 0);
