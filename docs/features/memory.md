# Memory

## Purpose

Gives agents continuity by storing conversation facts, interactions, and personality insights.

## UI Entry Points

- `/agents/[id]`

## API Routes

- `GET|POST /api/memory`

## Ownership

- Services: `MemoryService`
- Tables: `memories`, `agents`

## Lifecycle

- Memory writes adjust `agents.memory_count`.
- Reads use recent, typed, or relevance-scored retrieval.

## Failure Modes

- counter drift if deletes are not mirrored cleanly
- malformed memory payloads from old Firestore documents
