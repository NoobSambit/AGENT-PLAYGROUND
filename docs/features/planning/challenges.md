# Challenges

## Purpose

Challenge Lab measures capability and relationship behavior in a controlled run.

It is a more structured evaluation surface than chat and more focused than arena.

## UI Entry Point

- `/agents/[id]` on the Challenges tab

## API Routes

- `GET /api/agents/[id]/challenges`
- `POST /api/agents/[id]/challenges/runs`
- `GET /api/agents/[id]/challenges/runs/[runId]`
- `POST /api/agents/[id]/challenges/runs/[runId]/execute`
- `POST /api/agents/[id]/challenges/runs/[runId]/cancel`

## Ownership

- Service: `src/lib/services/challengeLabService.ts`
- Repository: `src/lib/repositories/challengeLabRepository.ts`
- Tables:
  - `challenge_runs`
  - `challenge_events`
  - `challenge_participant_results`

## Templates

The template set includes solo and pair trials such as:

- memory precision
- decision pressure
- creation to spec
- collaboration delivery
- conflict repair
- arena claim proof

## Workflow

1. Create a run from a template.
2. Assemble participants.
3. Prepare the run state.
4. Execute stage by stage.
5. Persist event records.
6. Store participant results.
7. Save the final report.
8. Allow cooperative cancellation when requested.

## Why It Matters

Challenge Lab is the product's structured test harness for agent capability and pair behavior.

It is also a source of relationship evidence when the run involves more than one agent.

## Failure Modes

- Template mismatch
- Not enough participants
- Cancellation requested mid-run
- Stage output leakage or low-quality turn output

