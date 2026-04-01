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
- `challenges` -> `challenges`
- `mentorships` -> `mentorships`

## Agent Subcollections

- `agents/{id}/relationships` -> `agent_relationships`
- `agents/{id}/creative_works` -> `creative_works`
- `agents/{id}/dreams` -> `dreams`
- `agents/{id}/journal_entries` -> `journal_entries`
- `agents/{id}/learning_patterns` -> `learning_patterns`
- `agents/{id}/learning_goals` -> `learning_goals`
- `agents/{id}/learning_adaptations` -> `learning_adaptations`
- `agents/{id}/learning_events` -> `learning_events`
- `agents/{id}/skill_progressions` -> `skill_progressions`
- `agents/{id}/rate_limits` -> `agent_rate_limits`

## Special Cases

- Relationship mirrors are deduplicated into one sorted pair row.
- Skill progression IDs become `${agentId}:${category}`.
- Rate limit IDs become `${feature}:${agentId}`.
- Agent counters remain on `agents` and are verified against imported child records.
