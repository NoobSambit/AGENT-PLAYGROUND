# Neural Activity

## 1. Purpose and user intent

The Neural Activity tab builds a synthetic “thought map” from recent messages, recent memories, the memory graph, and current emotional lead. It is an inspectability surface for attention and reasoning context, not an execution engine.

## 2. UI entry points and key controls

- Entry point: `NeuralActivityView` in `src/components/neural/NeuralActivityView.tsx`.
- The tab auto-refreshes every 15 seconds.
- The UI shows three summary cards and a force-style SVG graph with node descriptions.
- There are no mutation controls.

## 3. End-to-end user workflow

1. Open the Neural tab.
2. The component calls `GET /api/agents/[id]/neural-activity`.
3. The route gathers the agent, six recent memories, ten recent messages, and the memory graph.
4. `neuralActivityService.buildSnapshot` converts those inputs into nodes, edges, attention topics, and a reasoning summary.
5. The client renders the snapshot and refreshes it every 15 seconds.

## 4. Backend workflow/pipeline

1. `GET /api/agents/[id]/neural-activity` loads:
  - `AgentService.getAgentById`
  - `MemoryService.getRecentMemories(agentId, 6)`
  - `MessageService.getMessagesByAgentId(agentId)`
  - `MemoryGraphService.getMemoryGraph(agentId)`
2. The route slices recent messages to the last ten entries.
3. `neuralActivityService.buildSnapshot` derives:
  - dominant emotion and intensity from `emotionalService`
  - attention themes from recent message and memory text
  - memory nodes, concept nodes, attention nodes, and a `decision-hub`
4. The route returns a `NeuralActivitySnapshot`.

## 5. API contract details

- `GET /api/agents/[id]/neural-activity`
- Success response:
  - `200` with `NeuralActivitySnapshot` containing:
    - `dominantEmotion`
    - `emotionalIntensity`
    - `nodes: NeuralActivityNode[]`
    - `edges: NeuralActivityEdge[]`
    - `activeThemes`
    - `reasoningSummary`
    - `attentionFocus`
    - `generatedAt`
- Error response:
  - `404` when the agent is missing.
  - `500` when the snapshot cannot be built.
- Edge cases:
  - Missing graph is tolerated; the snapshot still uses messages and memories.
  - Empty recent context yields a thinner graph and a generic reasoning summary.

## 6. Data model mapping

- Reads from:
  - `agents` for emotional state and identity
  - `messages` for recent conversational text
  - `memories` for recent memory summaries
  - `memory_graphs` for concept clusters
- Important fields:
  - `messages.content`, `messages.type`, `messages.timestamp`
  - `memories.summary`, `memories.content`, `memories.importance`, `memories.context`
  - `memory_graphs.payload.concepts[].name`, `.importance`, `.description`

## 7. State transitions/lifecycle

- No persistent lifecycle exists for this tab.
- Each refresh creates a fresh snapshot from current persisted state.
- The snapshot is ephemeral and not written back to the database.

## 8. Quality gates/validation rules

- There is no explicit route-level validator beyond agent existence.
- `neuralActivityService` clamps weights and strengths into stable rendering ranges.
- Attention extraction ignores tokens shorter than four characters.

## 9. Failure modes and how they surface in UI/API

- Agent not found: `404`.
- Snapshot fetch failure: the component logs the error and renders “No neural activity available yet.” after loading ends.
- Sparse context: graph renders with only the emotion core and decision hub.

## 10. Debugging runbook

1. Call `/api/agents/[id]/neural-activity` directly.
2. Verify the route is receiving messages, memories, and memory graph data.
3. If attention themes are nonsense, inspect the last four message contents and top four memory summaries.
4. If the graph seems emotionally wrong, check `agents.emotionalState` and `agents.emotionalProfile` first.

## 11. Operational checklist

- Verify auto-refresh runs without duplicate timers.
- Verify the dominant emotion card matches the emotional tab.
- Verify recent memory summaries influence the rendered nodes.
- Verify the tab degrades cleanly when the memory graph is empty.

## 12. How to extend safely

- Keep the snapshot ephemeral unless there is a clear operational reason to persist it.
- If you add new node kinds, update both `NeuralActivitySnapshot` typing and SVG layout logic.
- Do not reuse this snapshot as a source of truth for agent reasoning; it is a projection for inspection.

## 13. Code references

- `src/app/api/agents/[id]/neural-activity/route.ts`
- `src/lib/services/neuralActivityService.ts`
- `src/components/neural/NeuralActivityView.tsx`
- `src/lib/services/memoryService.ts`
- `src/lib/services/messageService.ts`
- `src/lib/services/memoryGraphService.ts`
- `src/lib/services/emotionalService.ts`
