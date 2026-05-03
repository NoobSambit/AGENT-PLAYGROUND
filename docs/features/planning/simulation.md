# Simulation

## Purpose

Simulation is the legacy and compatibility entry point for multi-agent runs.

The newer product surfaces are Arena and Challenge Lab, but simulation remains relevant as a compatibility layer and as the main view for debates.

## UI Entry Point

- `/simulation`

## API Routes

- `GET /api/arena/runs`
- `POST /api/arena/runs`
- `GET /api/arena/runs/[runId]`
- `PUT /api/arena/runs/[runId]`
- `POST /api/arena/runs/[runId]/execute`
- `POST /api/arena/runs/[runId]/cancel`
- `GET /api/simulations`
- `POST /api/multiagent`

## Ownership

- Service: `src/lib/services/arenaService.ts`
- Repository: `src/lib/repositories/arenaRepository.ts`
- Tables:
  - `arena_runs`
  - `arena_events`
  - `simulations`

## Main Behavioral Rule

The arena run is the canonical inspectable debate flow.

Simulation should be treated as the legacy compatibility name for the same broader idea.

## Workflow

1. Draft a sandboxed run.
2. Edit the topic, objective, and seats.
3. Execute the debate with a shared provider/model preference.
4. Persist every stage and round event.
5. Allow cancellation at a safe boundary.
6. Save the run summary and scorecards.

## Why It Matters

Simulation is the most visible example of the app's multi-agent orchestration pattern, but the real state still lives in the arena run and event tables.

## Failure Modes

- Not enough participants
- Too few or too many rounds
- Provider unavailable during execution
- Event feed not available for replay

