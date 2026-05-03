# Knowledge Graph

## 1. Purpose and user intent

The Knowledge Graph tab visualizes the agent’s memory graph as concepts, memory nodes, and links. It is used to inspect concept clustering, shared-memory linkage, and contradiction hints derived from the memory graph.

## 2. UI entry points and key controls

- Entry point: `KnowledgeGraph` in `src/components/knowledge/KnowledgeGraph.tsx`.
- Key controls:
  - category filter
  - memory visibility toggle
  - node click callback for deeper inspection
- The component is visualization-heavy and read-only in the normal workspace.

## 3. End-to-end user workflow

1. Open the Knowledge Graph tab.
2. The component requests `GET /api/agents/[id]/memory-graph?contradictions=true`.
3. The route returns graph data, contradiction insights, and graph stats.
4. The client runs a local force-style simulation and renders visible nodes and edges.
5. The operator filters to a concept category or to memories only.

## 4. Backend workflow/pipeline

1. `GET /api/agents/[id]/memory-graph` optionally returns concept insights when `insights=true`.
2. The standard path calls `MemoryGraphService.getKnowledgeGraphData`.
3. The route also loads the raw memory graph and optional contradiction insights.
4. `POST /api/agents/[id]/memory-graph` supports backend actions:
  - `rebuild`
  - `get_linked`
  - `get_relevant`
5. Graph persistence itself lives in `MemoryGraphService` and `MemoryGraphRepository`.

## 5. API contract details

- `GET /api/agents/[id]/memory-graph`
  - query params:
    - `includeMemories`
    - `maxNodes`
    - `minLinkStrength`
    - `insights`
    - `contradictions`
  - success returns `{ graphData, contradictions, stats }` or `{ insights }` when `insights=true`
- `POST /api/agents/[id]/memory-graph`
  - `action: 'rebuild'` returns `{ success: true, stats }`
  - `action: 'get_linked'` requires `memoryId`
  - `action: 'get_relevant'` requires `query`; optional `maxMemories`
  - invalid action returns `400`
- Edge cases:
  - graph initialization can return an empty graph instead of failing.
  - contradiction detection is optional and can be disabled by query flag.

## 6. Data model mapping

- Primary table: `memory_graphs`.
- Reads from `memories` for rebuild and relevance operations.
- Graph payload fields used:
  - `concepts[]`
  - `links[]`
  - `stats.totalConcepts`, `stats.totalLinks`, `stats.averageLinkStrength`, `stats.conceptClusters`
  - `lastUpdated`
- Concept-derived UI fields include category, importance, descriptions, and related memory IDs.

## 7. State transitions/lifecycle

- Graph starts empty for a new agent.
- New memories incrementally update the graph through `processNewMemory`.
- Manual rebuild replaces the graph from current memory state.
- Visualization state on the client is ephemeral and recalculated locally.

## 8. Quality gates/validation rules

- `get_linked` requires `memoryId`.
- `get_relevant` requires `query`.
- Node and edge counts are bounded by query params and local client filters.

## 9. Failure modes and how they surface in UI/API

- Route failure: the component shows an error card.
- Empty graph: the component shows a “No knowledge graph data” state.
- Inconsistent graph after memory changes: usually indicates `processNewMemory` or rebuild drift rather than a rendering bug.

## 10. Debugging runbook

1. Call the memory-graph route directly and inspect `stats`.
2. Compare `memory_graphs.payload` against recent `memories` rows.
3. Run `POST /memory-graph` with `action: 'rebuild'` if links look stale.
4. Inspect contradiction payloads if the UI highlights impossible or noisy conflicts.

## 11. Operational checklist

- Verify graph data loads and category filters work.
- Verify contradiction count matches backend output.
- Verify rebuild refreshes stats and visible links.
- Verify node click integration still receives the right node payload.

## 12. How to extend safely

- Keep semantic extraction and graph persistence in `MemoryGraphService`; do not move it into the UI.
- If you add new concept categories, update both backend category mapping and client color mapping.
- Preserve the distinction between persisted graph structure and client-only layout simulation.

## 13. Code references

- `src/app/api/agents/[id]/memory-graph/route.ts`
- `src/lib/services/memoryGraphService.ts`
- `src/lib/repositories/memoryGraphRepository.ts`
- `src/components/knowledge/KnowledgeGraph.tsx`
- `src/lib/db/schema.ts`
