CREATE TABLE IF NOT EXISTS "relationship_evidence" (
  "id" text PRIMARY KEY NOT NULL,
  "pair_id" text NOT NULL REFERENCES "agent_relationships"("id") ON DELETE cascade,
  "agent_id_1" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "agent_id_2" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "source_kind" text NOT NULL,
  "source_id" text NOT NULL,
  "signal_kind" text NOT NULL,
  "actor_agent_id" text,
  "target_agent_id" text,
  "valence" real DEFAULT 0 NOT NULL,
  "weight" real DEFAULT 0 NOT NULL,
  "confidence" real DEFAULT 0.5 NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "relationship_revisions" (
  "id" text PRIMARY KEY NOT NULL,
  "pair_id" text NOT NULL REFERENCES "agent_relationships"("id") ON DELETE cascade,
  "agent_id_1" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "agent_id_2" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "source_kind" text NOT NULL,
  "source_id" text NOT NULL,
  "synthesis_run_id" text NOT NULL,
  "confidence" real DEFAULT 0.5 NOT NULL,
  "created_at" timestamp with time zone NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE TABLE IF NOT EXISTS "relationship_synthesis_runs" (
  "id" text PRIMARY KEY NOT NULL,
  "pair_id" text NOT NULL REFERENCES "agent_relationships"("id") ON DELETE cascade,
  "agent_id_1" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "agent_id_2" text NOT NULL REFERENCES "agents"("id") ON DELETE cascade,
  "trigger_source_kind" text NOT NULL,
  "trigger_source_id" text NOT NULL,
  "status" text NOT NULL,
  "prompt_version" text NOT NULL,
  "provider" text,
  "model" text,
  "created_at" timestamp with time zone NOT NULL,
  "updated_at" timestamp with time zone NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "relationship_evidence_pair_created_idx" ON "relationship_evidence" ("pair_id","created_at");
CREATE INDEX IF NOT EXISTS "relationship_evidence_source_idx" ON "relationship_evidence" ("source_kind","source_id","created_at");
CREATE INDEX IF NOT EXISTS "relationship_evidence_agent1_created_idx" ON "relationship_evidence" ("agent_id_1","created_at");
CREATE INDEX IF NOT EXISTS "relationship_evidence_agent2_created_idx" ON "relationship_evidence" ("agent_id_2","created_at");

CREATE INDEX IF NOT EXISTS "relationship_revisions_pair_created_idx" ON "relationship_revisions" ("pair_id","created_at");
CREATE INDEX IF NOT EXISTS "relationship_revisions_source_idx" ON "relationship_revisions" ("source_kind","source_id","created_at");
CREATE INDEX IF NOT EXISTS "relationship_revisions_agent1_created_idx" ON "relationship_revisions" ("agent_id_1","created_at");
CREATE INDEX IF NOT EXISTS "relationship_revisions_agent2_created_idx" ON "relationship_revisions" ("agent_id_2","created_at");

CREATE INDEX IF NOT EXISTS "relationship_synthesis_pair_created_idx" ON "relationship_synthesis_runs" ("pair_id","created_at");
CREATE INDEX IF NOT EXISTS "relationship_synthesis_trigger_idx" ON "relationship_synthesis_runs" ("trigger_source_kind","trigger_source_id","created_at");
CREATE INDEX IF NOT EXISTS "relationship_synthesis_status_idx" ON "relationship_synthesis_runs" ("status","created_at");
