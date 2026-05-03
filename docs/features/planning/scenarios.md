# Scenarios

## Purpose

Scenarios are the what-if lab.

They help compare the current path against an alternate path without mutating live agent state.

## UI Entry Point

- `/agents/[id]` on the Scenarios tab

## API Routes

- `GET /api/scenarios?agentId=...`
- `POST /api/scenarios`
- `GET /api/scenarios/[id]`

## Ownership

- Service: `src/lib/services/scenarioService.ts`
- Repository: `src/lib/repositories/scenarioRunRepository.ts`
- Supporting repositories and services:
  - `MessageService`
  - `MemoryService`
  - `relationshipService`
  - `SimulationService`
  - `learningService`
  - `emotionalService`

## What A Scenario Run Contains

- branch point
- intervention
- branch context
- baseline state
- alternate state
- probe set
- turn results
- comparison output
- quality fields

## Supported Branch Sources

- recent messages
- high-importance memories
- relationship events
- simulation turns

## Supported Intervention Ideas

- rewrite the next reply
- shift emotional baseline
- inject a memory
- flip a goal outcome
- shift a relationship

## Workflow

1. Choose a real branch point.
2. Choose one intervention.
3. Build a branch context packet.
4. Run a short probe set.
5. Compare baseline and alternate results.
6. Save the scenario run.

## Why It Matters

Scenarios are for product debugging, behavior testing, and reasoning about change before you change the system.

## Failure Modes

- Weak branch point
- Intervention too broad
- Run creates generic output
- Quality gate fails or result is too shallow

## Related Files

- [`src/lib/services/scenarioService.ts`](../../../src/lib/services/scenarioService.ts)

