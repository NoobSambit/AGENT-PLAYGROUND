# Profile

## Purpose

Generates and serves the psychological profile derived from existing agent traits and state.

## UI Entry Points

- `/agents/[id]`

## API Routes

- `GET|POST /api/agents/[id]/profile`

## Ownership

- Services: `psychologicalProfileService`, `AgentService`
- Tables: `agents`

## Lifecycle

- Profile data is embedded on the agent record.
- Generation is deterministic from existing state and does not require a dedicated table.

## Failure Modes

- stale derived profile after major trait changes if regeneration is skipped
