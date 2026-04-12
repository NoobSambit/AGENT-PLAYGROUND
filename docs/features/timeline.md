# Timeline

## Purpose

Provides inspectability across messages, memories, relationships, dreams, journals, and emotional changes.

## UI Entry Points

- `/agents/[id]`

## API Routes

- derived from existing feature APIs

## Ownership

- Services: timeline and aggregation logic in workspace consumers
- Tables: `messages`, `memories`, `agent_relationships`, `dreams`, `journal_entries`, `journal_sessions`, `agents`

## Lifecycle

- Timeline is assembled from persisted feature records rather than a standalone event table.
- Journal events are sourced only from saved V2 journal entries; draft, ready-but-unsaved, and failed sessions are excluded.

## Failure Modes

- inconsistent ordering if timestamps are malformed
