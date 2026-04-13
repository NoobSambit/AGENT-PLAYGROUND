# Architecture

## Runtime Layers

- `src/app`: App Router pages and API routes.
- `src/stores`: thin Zustand stores that call the API.
- `src/lib/services`: domain logic, provider orchestration, scoring, and state updates.
- `src/lib/repositories`: PostgreSQL persistence adapters.
- `src/lib/db`: Drizzle schema, connection setup, persistence mode helpers.

## Persistence Model

The app now supports four runtime modes:

- Firestore only
- dual-write with Firestore reads
- dual-write with PostgreSQL reads
- PostgreSQL only

Services own the branch between Firestore and PostgreSQL for core entities. Route-level helpers are only used where feature-specific persistence had not yet been centralized.

The Phase 5 output-quality rollout stays additive across those modes:

- SQL migrations add indexed quality columns without rewriting legacy payloads.
- Services remain the authority for status transitions such as `draft -> ready -> saved/published` and `draft -> ready/blocked`.
- Legacy rows are still readable and should surface as `legacy_unvalidated` until regenerated or backfilled.

## Design Rules

- UI renders state and triggers API calls.
- Routes validate input, call services, and serialize responses.
- Services own business rules, ranking, counters, and model prompts.
- Repositories own PostgreSQL reads and writes only.
- Firestore remains available only for migration and short-lived dual-write cutover paths.
- Agent chat is the canonical write point for chat-turn side effects such as trait updates, memory persistence, and stale-domain invalidation.
- Chat-turn side effects now include structured fact extraction, canonical fact-memory upserts, emotion appraisal, and evidence-based trait analysis.
- Chat-turn side effects now also include evidence-based learning observation capture, confirmed pattern rebuilds, adaptation refresh, and prompt-time learning policy injection.
- Shared output-quality helpers under `src/lib/services/outputQuality/` now provide deterministic normalization, validation, status derivation, and final-gate evaluation across journal, creative, dream, profile, scenario, and chat surfaces.
- Premium generation features follow the same inspectable pattern: session row, versioned artifact rows, pipeline trace rows, and explicit publish/save boundaries.
- Dream V2 follows the same pattern as Creative Studio and Journal Workspace, with one extra agent-level field: `activeDreamImpression`.

## Migration-Specific Components

- `src/lib/db/persistence.ts`: mode selection.
- `src/lib/persistence/writeMirror.ts`: mirrored writes and outbox capture.
- `src/lib/repositories/outboxRepository.ts`: failed mirror write queue.
- `scripts/*.mjs`: schema apply, Firestore export, Postgres import, parity verification, reset.
- `drizzle/0008_output_quality_phase5.sql`: additive quality-state migration for the Phase 5 rollout.
- `scripts/quality/backfill-output-quality.mjs`: dry-run-first backfill for quality columns and semantic memory fields.
- `scripts/quality/replay-agent-output-audit.mjs`: audit-fixture replay summary.
- `scripts/quality/run-output-benchmark.mjs`: qwen2.5:7b benchmark summary against PRD exit criteria.
- `scripts/quality/validate-persisted-artifacts.mjs`: fixture or PostgreSQL artifact validation.

## Feature Docs

Every major feature has its own file in [`docs/features/`](./features/). Use those files for end-to-end ownership details instead of guessing from routes alone.
