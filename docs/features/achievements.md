# Achievements

## Purpose

Tracks level progression, experience, achievements, and operational stats.

## UI Entry Points

- `/agents/[id]`
- `/dashboard`

## API Routes

- updated indirectly through chat, challenges, creativity, dreams, and journals

## Ownership

- Services: `achievementService`, `agentProgressService`
- Tables: `agents`

## Lifecycle

- Progress lives on the agent record.
- Feature flows update stats and unlocks server-side.

## Failure Modes

- double-awards if terminal challenge paths are replayed incorrectly
