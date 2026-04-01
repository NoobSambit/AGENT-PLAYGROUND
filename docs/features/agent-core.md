# Agent Core

## Purpose

Creates and maintains the canonical agent record: identity, persona, goals, traits, counters, progression, and profile state.

## UI Entry Points

- `/agents`
- `/agents/new`
- `/agents/[id]`

## API Routes

- `GET|POST /api/agents`
- `GET|PATCH /api/agents/[id]`

## Ownership

- Services: `AgentService`, `PersonalityService`
- Tables: `agents`

## Lifecycle

- Reads come from `agents`.
- Writes create or update the full agent record and keep counters server-side.

## Failure Modes

- Invalid `DATABASE_URL`
- stale mirrored counters during dual-write if outbox is not drained
