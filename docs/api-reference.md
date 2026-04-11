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
- `GET|POST /api/agents/[id]/journal`
- `GET|POST /api/agents/[id]/learning`
- `GET|POST /api/agents/[id]/profile`
- `GET /api/agents/[id]/profile/evolution`

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
- `GET /api/scenarios` returns branch point options, intervention templates, and recent saved runs for one agent.
- `GET /api/scenarios` also returns `analytics` with best interventions, common quality flags, and playbook notes.
- `POST /api/scenarios` requires `agentId`, `branchPointId`, `branchPointKind`, and `intervention`, then returns a saved `scenarioRun`.
- `GET /api/scenarios/[id]` returns one persisted scenario run with branch context, turn diffs, and comparison output.
