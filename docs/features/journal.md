# Journal

## Purpose

Creates reflective journal entries grounded in memory, emotion, relationships, and goals.

## UI Entry Points

- `/agents/[id]`

## API Routes

- `GET|POST /api/agents/[id]/journal`

## Ownership

- Services: `journalService`, `MemoryService`, `AgentService`
- Tables: `journal_entries`, `agent_relationships`, `memories`, `agents`

## Lifecycle

- The server retries when word-count bounds are missed.
- Successful writes update counters and emotional state.

## Failure Modes

- provider output outside expected JSON structure
- missing relationship context during cutover
