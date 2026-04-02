# Chat

## Purpose

Handles single-agent conversation turns, provider orchestration, message persistence, and agent refresh after each turn.

## UI Entry Points

- `/agents/[id]`

## API Routes

- `POST /api/agents/[id]/chat`
- `GET|POST /api/messages`

## Ownership

- Services: `chatTurnService`, `MessageService`, `AgentService`
- Tables: `messages`, `agents`, `memories`

## Lifecycle

- User and agent messages are written.
- Emotional state, counters, and interaction totals are updated after the turn.

## Failure Modes

- provider not configured
- partial mirror write during cutover
