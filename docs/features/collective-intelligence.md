# Collective Intelligence

## Purpose

Aggregates shared knowledge, network expertise, consensus signals, and broadcasts across the agent population.

## UI Entry Points

- `/simulation`
- network and knowledge panels

## API Routes

- `GET|POST /api/collective-intelligence`

## Ownership

- Services: `collectiveIntelligenceService`, `KnowledgeService`
- Tables: `shared_knowledge`, `collective_broadcasts`, `agents`

## Lifecycle

- Broadcasts persist shared takeaways.
- Referrals and consensus are derived at read time from current knowledge and relationship state.

## Failure Modes

- stale broadcast mirrors during dual-write
