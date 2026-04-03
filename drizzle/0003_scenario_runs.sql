CREATE TABLE IF NOT EXISTS "scenario_runs" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "status" text NOT NULL,
  "branch_kind" text NOT NULL,
  "branch_ref_id" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "updated_at" timestamptz NOT NULL,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "scenario_runs_agent_created_idx"
  ON "scenario_runs" ("agent_id", "created_at");

CREATE INDEX IF NOT EXISTS "scenario_runs_status_created_idx"
  ON "scenario_runs" ("status", "created_at");

CREATE INDEX IF NOT EXISTS "scenario_runs_branch_ref_idx"
  ON "scenario_runs" ("branch_kind", "branch_ref_id");
