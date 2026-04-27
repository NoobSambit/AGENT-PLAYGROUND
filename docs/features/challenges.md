# Challenges

## Purpose

Challenge Lab is an agent-scoped testing console for capability evaluation and relationship trials. It replaces the legacy manual challenge hub and does not render or migrate old challenge records.

## UI Entry Point

- `/agents/[id]` -> `Challenges`

There is no global challenges route in v1.

## Templates

- `solo_memory_precision`
- `solo_decision_pressure`
- `solo_creation_to_spec`
- `pair_collaboration_delivery`
- `pair_conflict_repair`
- `arena_claim_proof`

Templates are static in code for v1. Runs are persisted; templates are not DB-backed.

## API Routes

- `GET /api/agents/[id]/challenges`
- `POST /api/agents/[id]/challenges/runs`
- `GET /api/agents/[id]/challenges/runs/[runId]`
- `POST /api/agents/[id]/challenges/runs/[runId]/execute`
- `POST /api/agents/[id]/challenges/runs/[runId]/cancel`

The legacy `GET|POST /api/challenges` route returns `410` and is not an active product contract.

## Ownership

- Service: `challengeLabService`
- Repository: `challengeLabRepository`
- Tables: `challenge_runs`, `challenge_events`, `challenge_participant_results`
- Firestore mirror: `challenge_runs`, `challenge_runs/{runId}/events`, `challenge_runs/{runId}/participant_results`

## Lifecycle

1. The selected agent page bootstraps templates, recent runs, stats, partner candidates, and arena follow-up candidates.
2. The client creates a draft run with selected template, participants, scenario, and budget.
3. The client immediately calls `execute` and polls run detail while the request remains pending.
4. The server persists visible stage events before and after slow work.
5. Deterministic checks run first; one LLM judge pass produces the final report when available.
6. If the judge fails after usable agent output exists, the run completes with a degraded deterministic fallback report.
7. Pair-capable runs emit relationship evidence only after final report and only with traceable event refs.

## Scoring

- Scores are clamped to `0-100`.
- Passing threshold is `70`.
- Solo passes and cooperative pair passes increment `challengeWins`.
- Competitive arena follow-up pair runs only increment the winner.
- `challengesCompleted` increments once per participant for completed or failed runs.
- `progressAppliedAt` on `ChallengeRun` makes counter updates idempotent.
