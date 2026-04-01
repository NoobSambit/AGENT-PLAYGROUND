# Relationships

## Purpose

Tracks social state between agents: trust, respect, affection, familiarity, conflict, and significant events.

## UI Entry Points

- `/agents/[id]`
- `/simulation`

## API Routes

- `GET|POST /api/relationships`

## Ownership

- Services: `relationshipService`
- Tables: `agent_relationships`

## Lifecycle

- Writes normalize each pair to one PostgreSQL row.
- Firestore mirrors remain agent-scoped during cutover.

## Failure Modes

- pair deduplication bugs
- stale mirrored subcollection records
