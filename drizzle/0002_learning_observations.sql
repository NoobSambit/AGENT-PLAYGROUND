CREATE TABLE IF NOT EXISTS "learning_observations" (
  "id" text PRIMARY KEY,
  "agent_id" text NOT NULL REFERENCES "agents"("id") ON DELETE CASCADE,
  "task_type" text NOT NULL,
  "category" text NOT NULL,
  "follow_up_status" text NOT NULL,
  "created_at" timestamptz NOT NULL,
  "evaluated_at" timestamptz,
  "payload" jsonb NOT NULL
);

CREATE INDEX IF NOT EXISTS "learning_observations_agent_created_idx"
  ON "learning_observations" ("agent_id", "created_at");

CREATE INDEX IF NOT EXISTS "learning_observations_agent_status_created_idx"
  ON "learning_observations" ("agent_id", "follow_up_status", "created_at");
