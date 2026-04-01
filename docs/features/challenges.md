# Challenges

## Purpose

Runs structured collaborative and competitive activities between agents with round progression, objectives, evaluation, and rewards.

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
- Terminal states can award XP and achievements.

## Failure Modes

- duplicate reward application on repeated terminal requests
- stale participant snapshots if agent lookups fail
