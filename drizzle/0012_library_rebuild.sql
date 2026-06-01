CREATE TABLE IF NOT EXISTS "library_items" (
  "id" text PRIMARY KEY NOT NULL,
  "agent_id" text REFERENCES "agents"("id") ON DELETE cascade,
  "scope" text NOT NULL,
  "title" text NOT NULL,
  "claim" text NOT NULL,
  "body" text NOT NULL,
  "category" text NOT NULL,
  "status" text NOT NULL,
  "confidence" double precision DEFAULT 0.5 NOT NULL,
  "quality_status" text DEFAULT 'legacy_unvalidated' NOT NULL,
  "visibility" text DEFAULT 'agent' NOT NULL,
  "created_by_agent_id" text REFERENCES "agents"("id") ON DELETE set null,
  "created_by_name" text,
  "created_from_feature" text NOT NULL,
  "primary_source_type" text NOT NULL,
  "primary_source_id" text NOT NULL,
  "tags" text[] DEFAULT '{}'::text[] NOT NULL,
  "related_agent_ids" text[] DEFAULT '{}'::text[] NOT NULL,
  "usage_count" integer DEFAULT 0 NOT NULL,
  "last_used_at" timestamp with time zone,
  "accepted_at" timestamp with time zone,
  "accepted_by" text,
  "rejected_at" timestamp with time zone,
  "rejected_by" text,
  "retired_at" timestamp with time zone,
  "retired_by" text,
  "supersedes_item_id" text,
  "merged_into_item_id" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "library_item_sources" (
  "id" text PRIMARY KEY NOT NULL,
  "item_id" text NOT NULL REFERENCES "library_items"("id") ON DELETE cascade,
  "source_type" text NOT NULL,
  "source_id" text NOT NULL,
  "source_title" text,
  "source_url" text,
  "source_timestamp" timestamp with time zone,
  "evidence_summary" text NOT NULL,
  "quote" text,
  "created_at" timestamp with time zone NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "library_item_validations" (
  "id" text PRIMARY KEY NOT NULL,
  "item_id" text NOT NULL REFERENCES "library_items"("id") ON DELETE cascade,
  "actor_type" text NOT NULL,
  "agent_id" text REFERENCES "agents"("id") ON DELETE set null,
  "actor_name" text,
  "verdict" text NOT NULL,
  "rationale" text NOT NULL,
  "confidence_delta" double precision DEFAULT 0 NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "library_item_usage_events" (
  "id" text PRIMARY KEY NOT NULL,
  "item_id" text NOT NULL REFERENCES "library_items"("id") ON DELETE cascade,
  "agent_id" text REFERENCES "agents"("id") ON DELETE set null,
  "consumer_feature" text NOT NULL,
  "consumer_source_id" text,
  "query" text,
  "relevance_score" double precision DEFAULT 0 NOT NULL,
  "used_at" timestamp with time zone NOT NULL,
  "payload" jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "library_items_agent_status_updated_idx" ON "library_items" ("agent_id","status","updated_at");
CREATE INDEX IF NOT EXISTS "library_items_scope_status_confidence_idx" ON "library_items" ("scope","status","confidence");
CREATE INDEX IF NOT EXISTS "library_items_category_status_confidence_idx" ON "library_items" ("category","status","confidence");
CREATE INDEX IF NOT EXISTS "library_items_primary_source_idx" ON "library_items" ("primary_source_type","primary_source_id");
CREATE INDEX IF NOT EXISTS "library_items_created_from_feature_idx" ON "library_items" ("created_from_feature","created_at");
CREATE INDEX IF NOT EXISTS "library_items_tags_gin_idx" ON "library_items" USING gin ("tags");
CREATE INDEX IF NOT EXISTS "library_item_sources_item_idx" ON "library_item_sources" ("item_id");
CREATE INDEX IF NOT EXISTS "library_item_sources_source_idx" ON "library_item_sources" ("source_type","source_id");
CREATE INDEX IF NOT EXISTS "library_item_validations_item_created_idx" ON "library_item_validations" ("item_id","created_at");
CREATE INDEX IF NOT EXISTS "library_item_validations_agent_created_idx" ON "library_item_validations" ("agent_id","created_at");
CREATE INDEX IF NOT EXISTS "library_item_validations_verdict_created_idx" ON "library_item_validations" ("verdict","created_at");
CREATE INDEX IF NOT EXISTS "library_item_usage_events_item_used_idx" ON "library_item_usage_events" ("item_id","used_at");
CREATE INDEX IF NOT EXISTS "library_item_usage_events_agent_feature_used_idx" ON "library_item_usage_events" ("agent_id","consumer_feature","used_at");
