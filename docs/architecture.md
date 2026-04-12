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

## Design Rules

- UI renders state and triggers API calls.
- Routes validate input, call services, and serialize responses.
- Services own business rules, ranking, counters, and model prompts.
- Repositories own PostgreSQL reads and writes only.
- Firestore remains available only for migration and short-lived dual-write cutover paths.
- Agent chat is the canonical write point for chat-turn side effects such as trait updates, memory persistence, and stale-domain invalidation.
- Chat-turn side effects now include structured fact extraction, canonical fact-memory upserts, emotion appraisal, and evidence-based trait analysis.
- Chat-turn side effects now also include evidence-based learning observation capture, confirmed pattern rebuilds, adaptation refresh, and prompt-time learning policy injection.
- Premium generation features follow the same inspectable pattern: session row, versioned artifact rows, pipeline trace rows, and explicit publish/save boundaries.
- Dream V2 follows the same pattern as Creative Studio and Journal Workspace, with one extra agent-level field: `activeDreamImpression`.

## Migration-Specific Components

- `src/lib/db/persistence.ts`: mode selection.
- `src/lib/persistence/writeMirror.ts`: mirrored writes and outbox capture.
- `src/lib/repositories/outboxRepository.ts`: failed mirror write queue.
- `scripts/*.mjs`: schema apply, Firestore export, Postgres import, parity verification, reset.

## Feature Docs

Every major feature has its own file in [`docs/features/`](./features/). Use those files for end-to-end ownership details instead of guessing from routes alone.
