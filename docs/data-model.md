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
- Output-quality rollout is additive. Top-level indexed state such as `quality_status`, `normalization_status`, `quality_score`, `repair_count`, and `prompt_version` is stored beside payload contracts that still carry `rawModelOutput`, `validation`, `evaluation`, `sourceRefs`, and feature-specific normalized content.
- Store raw conversation turns as bounded episode rows in `memories`, then store durable semantic abstractions in parallel `memories` rows using top-level canonical fields: `canonicalKey`, `canonicalValue`, `confidence`, `evidenceRefs`, `supersedes`, and `lastConfirmedAt`.
- Use semantic memory types such as `preference`, `project`, `relationship`, `identity`, `operating_constraint`, `artifact_summary`, and `tension_snapshot` so downstream prompts do not depend only on transcript recall.
- Use `memory_graphs` as the inspectable concept/link layer over those memory rows rather than as a replacement for the canonical memory store.
- Store creative work as separate sessions, artifacts, and pipeline events so briefs, revisions, rubric output, and publication state remain inspectable.
- `creative_sessions` now index quality gates with `quality_status`, `repair_count`, `prompt_version`, and `failure_reason`.
- `creative_artifacts` now index lineage and normalization state with `artifact_role`, `normalization_status`, `quality_score`, and `source_artifact_id`.
- Store deep profile refreshes as separate runs, interview turns, and pipeline events so evidence, transcript, quality evaluation, and final profile output remain inspectable instead of being overwritten invisibly.
- `profile_analysis_runs` now persist additive quality-state fields (`qualityStatus`, `qualityScore`, `promptVersion`, `profileVersion`) plus payload-level validation, raw synthesis output, evidence coverage, stage findings with evidence refs, and the blocked-vs-passing terminal state needed to prevent unsafe live profile updates.
- Active `agents.psychologicalProfile` payloads now carry additive metadata (`sourceRunId`, `qualityStatus`, `profileVersion`) plus claim-level evidence refs so legacy profiles remain readable while new validated runs stay inspectable.
- Store dream work as separate sessions, versioned dream artifacts, and pipeline events so compose intent, bounded context, quality evaluation, repair history, and explicit save state remain inspectable.
- `dream_sessions` now index `quality_status`, `repair_count`, and `prompt_version`; `dreams` now index `artifact_role`, `normalization_status`, `quality_score`, and `source_dream_id`.
- `dreams` now represent Dream V2 session artifacts. Only rows with `saved=true` count toward archive history, counters, timeline visibility, behavioral residue, and downstream context reuse.
- Store the active dream residue directly on `agents.activeDreamImpression` instead of creating a separate impression history table.
- Store journal work as separate sessions, versioned entries, and pipeline events so compose intent, bounded context, voice conditioning, evaluation, repair, and explicit save state remain inspectable.
- `journal_sessions` now index `quality_status`, `repair_count`, and `prompt_version`; `journal_entries` now index `artifact_role`, `normalization_status`, `quality_score`, and `source_entry_id`.
- `journal_entries` now represent V2 session artifacts. Only rows with `saved=true` count toward archive history, counters, timeline visibility, and downstream context reuse.
- Store scenario branch experiments in `scenario_runs` rather than overloading `simulations`, because branch experiments and primary simulation runs have different product meaning and lifecycle.
- `scenario_runs` now also index `quality_status`, `quality_score`, `failure_reason`, and `prompt_version`.
- Legacy rows are intentionally preserved. If the new quality fields are absent, services and route serializers should treat them as `legacy_unvalidated` rather than rewriting historical payloads in place.

## Detailed References

- [`database/postgresql-schema.md`](./database/postgresql-schema.md)
- [`database/firestore-to-postgres-mapping.md`](./database/firestore-to-postgres-mapping.md)
