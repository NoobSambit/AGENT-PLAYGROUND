# Creative

## Purpose

Lets an agent generate stories, poems, songs, essays, jokes, and other creative outputs.

## UI Entry Points

- `/agents/[id]`

## API Routes

- `GET|POST /api/agents/[id]/creative`

## Ownership

- Services: `creativityService`, `AgentService`
- Tables: `creative_works`, `agents`

## Lifecycle

- Daily limits are enforced server-side.
- Successful writes update counters and can affect emotional state.

## Failure Modes

- provider quota exhaustion
- counter drift if write succeeds but follow-up agent update fails
