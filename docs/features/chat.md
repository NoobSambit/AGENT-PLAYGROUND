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
- If an active saved dream impression exists and is still unexpired, prompt assembly can include it as subtle behavioral residue.
- When that residue is used, the stored assistant message includes `metadata.dreamImpression = { sourceDreamId, behaviorTilt, expiresAt }`.

## Failure Modes

- provider not configured
- partial mirror write during cutover

## Prompt Context Notes

Chat prompt assembly can now layer:

- memory context
- personality context
- emotional context
- psychological context
- learning context
- active dream residue

Dream residue must remain subordinate to persona and profile. It can bias emphasis, caution, urgency, or introspection, but it must not overwrite identity.
