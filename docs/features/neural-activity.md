# Neural Activity

## Purpose

Provides inspectable derived views of attention, emotion, concepts, and reasoning emphasis.

## UI Entry Points

- `/agents/[id]`

## API Routes

- derived from existing state and graph data

## Ownership

- Services: `neuralActivityService`
- Tables: no dedicated table in v1; derived from `agents`, `memories`, `memory_graphs`

## Lifecycle

- Neural activity is generated on demand from persisted state.

## Failure Modes

- misleading snapshots if source state is partially stale
