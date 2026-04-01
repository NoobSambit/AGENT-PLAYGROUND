# Emotions

## Purpose

Tracks dormant versus active emotional state, emotional event history, and response shaping for agent behavior.

## UI Entry Points

- `/agents/[id]`

## API Routes

- surfaced through chat, creative, dream, and journal flows

## Ownership

- Services: `emotionalService`, `AgentService`
- Tables: `agents`

## Lifecycle

- Emotional events are embedded on the agent record.
- Internal actions can update state after generation-heavy features complete.

## Failure Modes

- legacy emotional payloads requiring normalization
