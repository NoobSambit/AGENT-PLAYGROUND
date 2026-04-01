# Knowledge Graph

## Purpose

Builds inspectable concept and link structures over an agent's memory history.

## UI Entry Points

- `/agents/[id]`

## API Routes

- `GET /api/agents/[id]/memory-graph`

## Ownership

- Services: `MemoryGraphService`, `ConceptService`
- Tables: `memory_graphs`, `memories`

## Lifecycle

- Graph payloads are updated after memory processing.
- Contradictions and concept clusters are derived from persisted memories.

## Failure Modes

- stale graphs if memory writes succeed but graph updates fail
