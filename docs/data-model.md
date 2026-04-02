# Data Model

The canonical runtime store is PostgreSQL. Firestore is now treated as a legacy source and migration mirror.

## Core Tables

- `agents`
- `messages`
- `memories`
- `agent_personality_events`
- `memory_graphs`
- `agent_relationships`

## Agent-Owned Feature Tables

- `creative_works`
- `dreams`
- `journal_entries`
- `learning_patterns`
- `learning_goals`
- `learning_adaptations`
- `learning_events`
- `skill_progressions`
- `agent_rate_limits`

## Shared And Network Tables

- `shared_knowledge`
- `collective_broadcasts`
- `conflicts`
- `challenges`
- `mentorships`
- `simulations`
- `migration_outbox`

## Modeling Approach

- Use text primary keys so Firestore IDs can be preserved.
- Keep timestamps as `timestamptz`.
- Keep nested, high-variance payloads in `jsonb`.
- Keep query-critical fields typed and indexed beside the payload column.
- Keep relationship pairs normalized to one row per sorted agent pair.
- Store structured memory facts in `memories` as `type='fact'` rows, with canonical identifiers such as `factKey` and `factType` inside `metadata`.

## Detailed References

- [`database/postgresql-schema.md`](./database/postgresql-schema.md)
- [`database/firestore-to-postgres-mapping.md`](./database/firestore-to-postgres-mapping.md)
