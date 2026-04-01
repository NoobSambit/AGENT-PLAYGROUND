# Simulation

## Purpose

Runs and stores multi-agent simulations with transcripts, referrals, consensus, conflicts, and broadcasts.

## UI Entry Points

- `/simulation`

## API Routes

- `GET|POST /api/simulation`
- `POST /api/multiagent`

## Ownership

- Services: `SimulationService`, `collectiveIntelligenceService`, `conflictResolutionService`, `relationshipService`
- Tables: `simulations`, `agent_relationships`, `conflicts`, `collective_broadcasts`

## Lifecycle

- Agents generate turn-by-turn responses.
- Relationship and conflict state can mutate during the run.
- Final metadata is stored with the simulation record.

## Failure Modes

- provider failure mid-run
- mirrored write failure for conflict, broadcast, or simulation records
