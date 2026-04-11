# Firestore To PostgreSQL Mapping

## Top-Level Collections

- `agents` -> `agents`
- `messages` -> `messages`
- `memories` -> `memories`
- `memory_graphs` -> `memory_graphs`
- `shared_knowledge` -> `shared_knowledge`
- `collective_broadcasts` -> `collective_broadcasts`
- `conflicts` -> `conflicts`
- `simulations` -> `simulations`
- `scenario_runs` -> `scenario_runs`
- `challenges` -> `challenges`
- `mentorships` -> `mentorships`

## Agent Subcollections

- `agents/{id}/relationships` -> `agent_relationships`
- `agents/{id}/creative_works` -> legacy only, dropped during Creative Studio hard reset
- `agents/{id}/creative_sessions` -> `creative_sessions`
- `agents/{id}/creative_artifacts` -> `creative_artifacts`
- `agents/{id}/creative_pipeline_events` -> `creative_pipeline_events`
- `agents/{id}/dreams` -> `dreams`
- `agents/{id}/journal_entries` -> `journal_entries`
- `agents/{id}/learning_patterns` -> `learning_patterns`
- `agents/{id}/learning_goals` -> `learning_goals`
- `agents/{id}/learning_adaptations` -> `learning_adaptations`
- `agents/{id}/learning_events` -> `learning_events`
- `agents/{id}/learning_observations` -> `learning_observations`
- `agents/{id}/skill_progressions` -> `skill_progressions`
- `agents/{id}/rate_limits` -> `agent_rate_limits`

## Special Cases

- Relationship mirrors are deduplicated into one sorted pair row.
- Legacy `creative_works` are intentionally not backfilled into the new Creative Studio tables.
- Skill progression IDs become `${agentId}:${category}`.
- Rate limit IDs become `${feature}:${agentId}`.
- Agent counters remain on `agents` and are verified against imported child records.
