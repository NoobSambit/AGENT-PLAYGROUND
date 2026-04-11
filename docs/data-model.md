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

- `creative_sessions`
- `creative_artifacts`
- `creative_pipeline_events`
- `dreams`
- `journal_entries`
- `learning_patterns`
- `learning_goals`
- `learning_adaptations`
- `learning_events`
- `learning_observations`
- `skill_progressions`
- `agent_rate_limits`

## Shared And Network Tables

- `shared_knowledge`
- `collective_broadcasts`
- `conflicts`
- `challenges`
- `mentorships`
- `simulations`
- `scenario_runs`
- `migration_outbox`

## Modeling Approach

- Use text primary keys so Firestore IDs can be preserved.
- Keep timestamps as `timestamptz`.
- Keep nested, high-variance payloads in `jsonb`.
- Keep query-critical fields typed and indexed beside the payload column.
- Keep relationship pairs normalized to one row per sorted agent pair.
- Store structured memory facts in `memories` as `type='fact'` rows, with canonical identifiers such as `factKey` and `factType` inside `metadata`.
- Store creative work as separate sessions, artifacts, and pipeline events so briefs, revisions, rubric output, and publication state remain inspectable.
- Store scenario branch experiments in `scenario_runs` rather than overloading `simulations`, because branch experiments and primary simulation runs have different product meaning and lifecycle.
- Store scenario quality scores, flags, and diff-ready summaries inside the scenario payload so evaluation remains inspectable after the run completes.

## Detailed References

- [`database/postgresql-schema.md`](./database/postgresql-schema.md)
- [`database/firestore-to-postgres-mapping.md`](./database/firestore-to-postgres-mapping.md)
