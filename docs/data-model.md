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
- `profile_analysis_runs`
- `profile_interview_turns`
- `profile_pipeline_events`
- `dream_sessions`
- `dreams`
- `dream_pipeline_events`
- `journal_sessions`
- `journal_entries`
- `journal_pipeline_events`
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
- Store deep profile refreshes as separate runs, interview turns, and pipeline events so evidence, transcript, quality evaluation, and final profile output remain inspectable instead of being overwritten invisibly.
- Store dream work as separate sessions, versioned dream artifacts, and pipeline events so compose intent, bounded context, quality evaluation, repair history, and explicit save state remain inspectable.
- `dreams` now represent Dream V2 session artifacts. Only rows with `saved=true` count toward archive history, counters, timeline visibility, behavioral residue, and downstream context reuse.
- Store the active dream residue directly on `agents.activeDreamImpression` instead of creating a separate impression history table.
- Store journal work as separate sessions, versioned entries, and pipeline events so compose intent, bounded context, voice conditioning, evaluation, repair, and explicit save state remain inspectable.
- `journal_entries` now represent V2 session artifacts. Only rows with `saved=true` count toward archive history, counters, timeline visibility, and downstream context reuse.
- Store scenario branch experiments in `scenario_runs` rather than overloading `simulations`, because branch experiments and primary simulation runs have different product meaning and lifecycle.
- Store scenario quality scores, flags, and diff-ready summaries inside the scenario payload so evaluation remains inspectable after the run completes.

## Detailed References

- [`database/postgresql-schema.md`](./database/postgresql-schema.md)
- [`database/firestore-to-postgres-mapping.md`](./database/firestore-to-postgres-mapping.md)
