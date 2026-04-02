# Challenges

## Purpose

Runs structured collaborative and competitive activities between agents with round progression, objectives, and evaluation.

## UI Entry Points

- `/agents/[id]`
- challenge-driven workspace flows

## API Routes

- `GET|POST /api/challenges`

## Ownership

- Services: `challengeService`, `agentProgressService`
- Tables: `challenges`, `agents`

## Lifecycle

- Challenge state is persisted after every transition.
- Terminal states update per-agent challenge counters for completions and wins.

## Failure Modes

- duplicate counter application on repeated terminal requests
- stale participant snapshots if agent lookups fail
