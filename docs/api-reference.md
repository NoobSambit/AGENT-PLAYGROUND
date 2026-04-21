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

## Arena

- `GET /api/arena/runs`
- `POST /api/arena/runs`
- `GET /api/arena/runs/[runId]`
- `PUT /api/arena/runs/[runId]`
- `POST /api/arena/runs/[runId]/execute`
- `POST /api/arena/runs/[runId]/cancel`

Legacy simulation compatibility routes still exist:

- `GET /api/simulations`
- `POST /api/multiagent`

## Scenarios

- `GET /api/scenarios?agentId=...`
- `POST /api/scenarios`
- `GET /api/scenarios/[id]`

## Contract Notes

- API shapes remain stable across persistence modes.
- Dual-write behavior is hidden behind services and route helpers.
- Counters and derived stats are updated server-side; clients should not compute them optimistically as source of truth.
- Output-quality rollout is additive: when a row predates the new contract, detail routes should return `qualityStatus: legacy_unvalidated` and artifact-like rows should expose `normalizationStatus: legacy_unvalidated` until they are regenerated or backfilled.
- `POST /api/agents/[id]/chat` now returns `changedDomains` and `staleDomains` so tabs can refresh selectively.
- `POST /api/agents/[id]/chat` quality behavior is now bounded by a pre-persist response gate. The saved assistant message may carry repair metadata in `metadata.outputQuality`, but the route response remains backward-compatible.
- `GET /api/agents/[id]/memories` now returns both `memories` and an optional `graph` summary so the UI can inspect top concepts, link counts, and concept clusters.
- `GET /api/agents/[id]/memories` can return semantic memory types such as `preference`, `project`, `relationship`, `identity`, `operating_constraint`, `artifact_summary`, and `tension_snapshot` in addition to raw conversation episodes and facts.
- `POST /api/agents/[id]/memories/recall` now distinguishes `semantic` hits from `episode` hits, includes graph concept matches when available, and returns reasons that call out canonical semantic matches explicitly.
- `POST /api/agents/[id]/chat` now also drives learning side effects: observation capture, follow-up resolution, pattern confirmation, and adaptation refresh.
- `GET /api/agents/[id]/learning` returns learning state built from patterns, goals, adaptations, skills, and recent observations.
- `POST /api/agents/[id]/learning` remains available for explicit feature actions such as manual conversation analysis, goal generation, skill updates, and manual adaptation creation.
- `GET /api/agents/[id]/creative` now returns Creative Studio bootstrap state: allowed controls, defaults, candidate context signals, recent sessions, and published library items.
- `POST /api/agents/[id]/creative` now creates a normalized creative session draft instead of generating and publishing immediately.
- `POST /api/agents/[id]/creative/sessions/[sessionId]/generate` runs the two-pass draft -> evaluate -> repair workflow and returns the full session detail.
- `POST /api/agents/[id]/creative/sessions/[sessionId]/publish` publishes the final artifact and increments agent creative counters at publish time only. When preconditions fail it returns `409` with `error`, `code`, `qualityStatus`, `hardFailureFlags`, `softWarnings`, and `publishBlockers`.
- `GET /api/agents/[id]/creative/sessions/[sessionId]` returns one session with artifacts and pipeline trace events. Session and artifact payloads now carry additive `qualityStatus`, `normalizationStatus`, `repairCount`, `promptVersion`, `validation`, `evaluation`, `rawModelOutput`, and lineage refs when available.
- `GET /api/agents/[id]/dream` now returns Dream Workspace bootstrap state: available dream types, suggested type, minimal compose defaults, active dream impression, recent sessions, recent saved dreams, and archive metrics.
- `POST /api/agents/[id]/dream` now creates a Dream V2 draft session instead of generating and saving immediately.
- `POST /api/agents/[id]/dream/sessions/[sessionId]/generate` runs the prepare-context -> conditioning -> draft -> extraction -> evaluation -> optional repair -> impression-preview workflow and persists real stage events.
- `POST /api/agents/[id]/dream/sessions/[sessionId]/save` only succeeds for passing ready sessions and is the only dream write that increments counters, updates live emotion, activates the dream impression, and makes the artifact visible downstream. Blocked saves return `409` with machine-readable save blockers.
- `GET /api/agents/[id]/dream/sessions/[sessionId]` returns one dream session with artifact versions and pipeline trace events, including additive quality metadata and draft/repair/final lineage.
- `GET /api/agents/[id]/journal` now returns Journal Workspace bootstrap state: allowed types, suggested type, minimal compose defaults, recent sessions, recent saved entries, metrics, and archive filters.
- `POST /api/agents/[id]/journal` now creates a draft journal session with explicit compose intent instead of generating and saving immediately.
- `POST /api/agents/[id]/journal/sessions/[sessionId]/generate` runs the prepare-context -> voice-conditioning -> normalize -> validate -> evaluate -> optional repair -> final-gate workflow and persists pipeline events for real loading UI.
- `POST /api/agents/[id]/journal/sessions/[sessionId]/save` only succeeds for passing ready sessions with a validated normalized final entry; blocked saves now return `409` with a machine-readable `saveBlockers` payload.
- `GET /api/agents/[id]/journal/sessions/[sessionId]` returns one journal session with entry versions, live pipeline events, and additive quality metadata needed to render draft vs repaired vs saved vs legacy/unvalidated state.
- `GET /api/agents/[id]/profile` now returns Profile workspace bootstrap state: latest psychological profile, freshness, recent analysis runs, communication fingerprint telemetry, and page readiness metrics.
- `POST /api/agents/[id]/profile` remains a compatibility endpoint and now delegates to the run-based analysis orchestration before returning the refreshed bootstrap.
- `POST /api/agents/[id]/profile/runs` creates a draft profile analysis run.
- `POST /api/agents/[id]/profile/runs/[runId]/execute` runs the evidence -> interview -> synthesis -> validation -> evaluation -> bounded repair -> final-gate workflow using the current provider/model request headers.
- `GET /api/agents/[id]/profile/runs/[runId]` returns one stored profile analysis run with transcript turns, compatibility aliases (`prompt` and `response`), pipeline trace events, additive quality metadata, and evidence coverage summary.
- Profile runs now keep `question` and `answer` as the canonical transcript contract, require evidence refs in stage findings plus top-level profile claim groups, and refuse to update `agents.psychologicalProfile` unless the run passes validation and evaluation.
- `POST /api/arena/runs` creates a sandboxed draft arena run with generated seat briefs and no model calls.
- `PUT /api/arena/runs/[runId]` is draft-only and updates the topic, objective, round budget, response budget, reference brief, and user-edited seat fields.
- `POST /api/arena/runs/[runId]/execute` runs the head-led debate using one shared provider/model request preference for the entire run.
- `GET /api/arena/runs/[runId]` returns one arena run plus its append-only event feed for live polling or replay.
- `POST /api/arena/runs/[runId]/cancel` requests cooperative cancellation; the active executor stops at the next safe boundary and persists a cancellation event.
- `GET /api/scenarios` returns branch point options, intervention templates, and recent saved runs for one agent.
- `GET /api/scenarios` also returns `analytics` with best interventions, common quality flags, and playbook notes.
- `POST /api/scenarios` requires `agentId`, `branchPointId`, `branchPointKind`, and `intervention`, then returns a saved `scenarioRun`.
- `GET /api/scenarios/[id]` returns one persisted scenario run with branch context, turn diffs, comparison output, and additive `qualityStatus`, `qualityScore`, `promptVersion`, `validation`, and `evaluation` fields when the run was created by the upgraded pipeline.
