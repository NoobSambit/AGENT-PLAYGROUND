# Timeline

## Purpose

Provides inspectability across messages, memories, relationships, dreams, journals, and achievements.

## UI Entry Points

- `/agents/[id]`

## API Routes

- derived from existing feature APIs

## Ownership

- Services: timeline and aggregation logic in workspace consumers
- Tables: `messages`, `memories`, `agent_relationships`, `dreams`, `journal_entries`, `agents`

## Lifecycle

- Timeline is assembled from persisted feature records rather than a standalone event table.

## Failure Modes

- inconsistent ordering if timestamps are malformed
