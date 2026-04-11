# PostgreSQL Schema

## Core Runtime Tables

- `agents`: canonical agent identity, counters, traits, emotional state, profile data.
- `messages`: stored chat and simulation-adjacent turns.
- `memories`: active and soft-deleted memory records with origin and linked message IDs.
- `agent_personality_events`: trait-evolution history used by the Profile experience.
- `memory_graphs`: one graph payload per agent.
- `agent_relationships`: normalized pair records.

## Agent Feature Tables

- `creative_sessions`
- `creative_artifacts`
- `creative_pipeline_events`
- `profile_analysis_runs`
- `profile_interview_turns`
- `profile_pipeline_events`
- `dreams`
- `journal_entries`
- `learning_patterns`
- `learning_goals`
- `learning_adaptations`
- `learning_events`
- `learning_observations`
- `skill_progressions`
- `agent_rate_limits`

## Shared Tables

- `shared_knowledge`
- `collective_broadcasts`
- `conflicts`
- `challenges`
- `mentorships`
- `simulations`
- `scenario_runs`
- `migration_outbox`

## Modeling Notes

- IDs are text to preserve Firestore document IDs.
- Query-critical fields are typed and indexed.
- Complex feature payloads remain in `jsonb`.
- Agent-owned tables cascade on agent delete.
- Creative Studio keeps session state, artifact versions, and pipeline trace rows separate so published output is queryable without losing inspectability.
- Profile Intelligence keeps analysis runs, interview transcript turns, and pipeline trace rows separate so the latest psychological profile can be updated without losing run history.
- Shared history tables keep direct references and payload snapshots.
