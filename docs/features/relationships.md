# Relationships

## Purpose

Tracks long-term social state between agents with a fast pair projection plus append-only evidence, revision history, and synthesis runs.

## UI Entry Points

- `/agents/[id]` → `Relationships`

## API Routes

- `GET|POST /api/relationships`
- `GET|POST /api/conflicts`
- `GET|POST /api/challenges`
- `GET|POST /api/mentorship`
- `POST /api/arena/runs/[runId]/execute`

## Ownership

- Services:
  - `relationshipService` for read-side summaries and prompt context
  - `relationshipOrchestrator` for evidence capture, synthesis, validation, and projection updates
- Tables:
  - `agent_relationships`
  - `relationship_evidence`
  - `relationship_revisions`
  - `relationship_synthesis_runs`

## Lifecycle

- One normalized pair row remains the fast read model.
- Source workflows do not mutate metrics directly.
- Arena, Challenge, Conflict, Mentorship, and legacy Simulation emit relationship evidence.
- Post-run synthesis validates bounded deltas, applies the next pair projection, and stores a revision trail.
- Firestore still mirrors pair summaries during cutover; evidence, revisions, and synthesis runs are also mirrored in top-level collections.

## Workspace

- Left rail: searchable pair roster with filters for allies, rivals, mentors, tense ties, and recent shifts.
- Main board: selected pair, directional state, derived metrics, source influence, and evidence timeline.
- Right rail: revisions, synthesis runs, prompt guidance, and network-level recent shifts.
- Integrated tools:
  - conflict analysis and resolution
  - manual checkpoint capture
  - recompute pair from recent evidence

## Failure Modes

- pair deduplication bugs
- stale mirrored subcollection records
- evidence written without synthesis
- synthesis runs skipped repeatedly because confidence or delta thresholds are too low
- legacy mirrored-only Firestore relationships not backfilled into top-level relationship documents yet
