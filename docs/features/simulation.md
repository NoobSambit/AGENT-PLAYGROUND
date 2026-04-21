# Arena

## Purpose

Runs and stores head-led multi-agent arena debates with editable seats, a live event feed, score snapshots, compacted round state, and a final verdict report.

## UI Entry Points

- `/simulation`

## API Routes

- `GET|POST /api/arena/runs`
- `GET|PUT /api/arena/runs/[runId]`
- `POST /api/arena/runs/[runId]/execute`
- `POST /api/arena/runs/[runId]/cancel`

Legacy simulation routes remain in the repo for compatibility:

- `GET /api/simulations`
- `POST /api/multiagent`

## Ownership

- Services: `arenaService`
- Tables: `arena_runs`, `arena_events`

## Lifecycle

1. The user prepares a draft arena run with 2-4 participants, a debate topic, a round budget, and a response budget.
2. The server generates editable seat briefs that define how each debater should argue.
3. The user optionally edits those seats before launch.
4. `POST /execute` runs the debate with one shared provider/model handling the head and every debater sequentially.
5. The server persists each head directive, debater turn, round summary, score update, and final report as append-only arena events.
6. The client polls run detail while status is `running` and renders the live event feed.
7. The head publishes a final report with a winner, decisive moments, unresolved questions, and improvement notes.

## Data Rules

- Arena runs are sandboxed in v1.
- Arena execution must not write to long-term memories, emotions, relationships, broadcasts, or agent counters.
- Long-form 10-12 round debates stay viable by persisting compacted round summaries plus per-agent notebooks instead of replaying the full transcript into every later prompt.

## Failure Modes

- provider failure mid-run
- structured-output parse or validation failure after one repair attempt
- cancellation request observed at the next safe turn boundary
- mirrored write failure for arena run or event persistence
