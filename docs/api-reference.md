# API Reference

## Agent And Core State

- `GET /api/agents`
- `POST /api/agents`
- `GET /api/agents/[id]`
- `PATCH /api/agents/[id]`
- `POST /api/agents/[id]/chat`
- `GET /api/messages`
- `POST /api/messages`
- `GET /api/agents/[id]/memories`
- `GET /api/agents/[id]/memories/stats`
- `POST /api/agents/[id]/memories/recall`
- `DELETE /api/agents/[id]/memories/[memoryId]`
- `GET /api/memory`
- `POST /api/memory`
- `GET /api/agents/[id]/memory-graph`

## Agent Feature Routes

- `GET|POST /api/agents/[id]/creative`
- `GET /api/agents/[id]/creative/sessions/[sessionId]`
- `POST /api/agents/[id]/creative/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/creative/sessions/[sessionId]/publish`
- `GET|POST /api/agents/[id]/dream`
- `GET /api/agents/[id]/dream/sessions/[sessionId]`
- `POST /api/agents/[id]/dream/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/dream/sessions/[sessionId]/save`
- `GET|POST /api/agents/[id]/journal`
- `GET /api/agents/[id]/journal/sessions/[sessionId]`
- `POST /api/agents/[id]/journal/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/journal/sessions/[sessionId]/save`
- `GET|POST /api/agents/[id]/learning`
- `GET|POST /api/agents/[id]/profile`
- `GET /api/agents/[id]/profile/evolution`
- `POST /api/agents/[id]/profile/runs`
- `GET /api/agents/[id]/profile/runs/[runId]`
- `POST /api/agents/[id]/profile/runs/[runId]/execute`

## Social And Network Routes

- `GET|POST /api/relationships`
- `GET|POST /api/conflicts`
- `GET|POST /api/collective-intelligence`
- `GET|POST /api/knowledge`
- `GET|POST /api/mentorship`
- `GET|POST /api/challenges`

## Simulation

- `GET|POST /api/simulation`
- `POST /api/multiagent`

## Scenarios

- `GET /api/scenarios?agentId=...`
- `POST /api/scenarios`
- `GET /api/scenarios/[id]`

## Contract Notes

- API shapes remain stable across persistence modes.
- Dual-write behavior is hidden behind services and route helpers.
- Counters and derived stats are updated server-side; clients should not compute them optimistically as source of truth.
- `POST /api/agents/[id]/chat` now returns `changedDomains` and `staleDomains` so tabs can refresh selectively.
- `GET /api/agents/[id]/memories` can now return canonical `fact` memories created from chat turns.
- `POST /api/agents/[id]/memories/recall` returns mixed conversational and fact matches, with reasons that include canonical fact hits.
- `POST /api/agents/[id]/chat` now also drives learning side effects: observation capture, follow-up resolution, pattern confirmation, and adaptation refresh.
- `GET /api/agents/[id]/learning` returns learning state built from patterns, goals, adaptations, skills, and recent observations.
- `POST /api/agents/[id]/learning` remains available for explicit feature actions such as manual conversation analysis, goal generation, skill updates, and manual adaptation creation.
- `GET /api/agents/[id]/creative` now returns Creative Studio bootstrap state: allowed controls, defaults, candidate context signals, recent sessions, and published library items.
- `POST /api/agents/[id]/creative` now creates a normalized creative session draft instead of generating and publishing immediately.
- `POST /api/agents/[id]/creative/sessions/[sessionId]/generate` runs the two-pass draft -> evaluate -> repair workflow and returns the full session detail.
- `POST /api/agents/[id]/creative/sessions/[sessionId]/publish` publishes the final artifact and increments agent creative counters at publish time only.
- `GET /api/agents/[id]/creative/sessions/[sessionId]` returns one session with artifacts and pipeline trace events.
- `GET /api/agents/[id]/dream` now returns Dream Workspace bootstrap state: available dream types, suggested type, minimal compose defaults, active dream impression, recent sessions, recent saved dreams, and archive metrics.
- `POST /api/agents/[id]/dream` now creates a Dream V2 draft session instead of generating and saving immediately.
- `POST /api/agents/[id]/dream/sessions/[sessionId]/generate` runs the prepare-context -> conditioning -> draft -> extraction -> evaluation -> optional repair -> impression-preview workflow and persists real stage events.
- `POST /api/agents/[id]/dream/sessions/[sessionId]/save` only succeeds for passing ready sessions and is the only dream write that increments counters, updates live emotion, activates the dream impression, and makes the artifact visible downstream.
- `GET /api/agents/[id]/dream/sessions/[sessionId]` returns one dream session with artifact versions and pipeline trace events.
- `GET /api/agents/[id]/journal` now returns Journal Workspace bootstrap state: allowed types, suggested type, minimal compose defaults, recent sessions, recent saved entries, metrics, and archive filters.
- `POST /api/agents/[id]/journal` now creates a draft journal session with explicit compose intent instead of generating and saving immediately.
- `POST /api/agents/[id]/journal/sessions/[sessionId]/generate` runs the prepare-context -> voice-conditioning -> draft -> evaluation -> optional repair workflow and persists pipeline events for real loading UI.
- `POST /api/agents/[id]/journal/sessions/[sessionId]/save` only succeeds for passing ready sessions and is the only journal write that increments counters or feeds downstream consumers.
- `GET /api/agents/[id]/journal/sessions/[sessionId]` returns one journal session with entry versions and live pipeline events.
- `GET /api/agents/[id]/profile` now returns Profile workspace bootstrap state: latest psychological profile, freshness, recent analysis runs, communication fingerprint telemetry, and page readiness metrics.
- `POST /api/agents/[id]/profile` remains a compatibility endpoint and now delegates to the run-based analysis orchestration before returning the refreshed bootstrap.
- `POST /api/agents/[id]/profile/runs` creates a draft profile analysis run.
- `POST /api/agents/[id]/profile/runs/[runId]/execute` runs the evidence -> interview -> synthesis -> evaluation pipeline using the current provider/model request headers.
- `GET /api/agents/[id]/profile/runs/[runId]` returns one stored profile analysis run with transcript turns and pipeline trace events.
- `GET /api/scenarios` returns branch point options, intervention templates, and recent saved runs for one agent.
- `GET /api/scenarios` also returns `analytics` with best interventions, common quality flags, and playbook notes.
- `POST /api/scenarios` requires `agentId`, `branchPointId`, `branchPointKind`, and `intervention`, then returns a saved `scenarioRun`.
- `GET /api/scenarios/[id]` returns one persisted scenario run with branch context, turn diffs, and comparison output.
