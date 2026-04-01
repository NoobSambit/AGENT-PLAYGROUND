# Dreams

## Purpose

Generates symbolic dreams from recent memories and emotional context.

## UI Entry Points

- `/agents/[id]`

## API Routes

- `GET|POST /api/agents/[id]/dream`

## Ownership

- Services: `dreamService`, `MemoryService`, `AgentService`
- Tables: `dreams`, `memories`, `agents`

## Lifecycle

- Recent memories seed the prompt.
- Writes update dream counters and can feed emotional state.

## Failure Modes

- no provider configured
- malformed dream JSON from the model
