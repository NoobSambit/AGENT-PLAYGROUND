# Memory

## 1. Purpose and user intent

The Memory tab is the operator console for stored memory rows and their graph summary. It is used to inspect recent memories, filter by type and origin, run recall queries, delete bad memories, and sanity-check how conversational facts are being retained.

## 2. UI entry points and key controls

- Entry point: `MemoryConsole` in `src/components/memory/MemoryConsole.tsx`.
- Read controls: search query, type filter, origin filter, minimum importance filter, sort, and selection of a specific memory.
- Action controls: recall query submit, memory deletion, and graph summary inspection.
- The page also has a legacy helper `loadMemories` that calls `useAgentStore.fetchAgentMemories`; this still uses the top-level `/api/memory` compatibility path rather than the newer nested workspace routes.

## 3. End-to-end user workflow

1. Open the Memory tab.
2. `MemoryConsole` requests `GET /api/agents/[id]/memories` and `GET /api/agents/[id]/memories/stats`.
3. The user filters the memory list or selects a memory to inspect full details.
4. The user can submit a recall query through `POST /api/agents/[id]/memories/recall`.
5. The user can delete a memory through `DELETE /api/agents/[id]/memories/[memoryId]`.
6. The UI refreshes list, stats, and graph summary after mutations.

## 4. Backend workflow/pipeline

1. `GET /api/agents/[id]/memories` verifies the agent exists through `AgentService.getAgentById`.
2. The route parses a `MemoryListQuery` from URL params.
3. `MemoryService.listConsoleMemories` returns filtered active memory rows.
4. `MemoryGraphService.getConsoleSummary` returns graph health and highlight statistics.
5. `GET /api/agents/[id]/memories/stats` calls `MemoryService.getConsoleMemoryStats`.
6. `POST /api/agents/[id]/memories/recall` validates `query` and calls `MemoryService.recallMemories`.
7. `DELETE /api/agents/[id]/memories/[memoryId]` checks ownership and then calls `MemoryService.deleteMemory`.
8. Memory graph reads and maintenance run through `MemoryGraphService` and `MemoryGraphRepository`.

## 5. API contract details

- `GET /api/agents/[id]/memories`
- Query params:
  - `q`
  - `type` with `'all'` or a `MemoryRecord['type']`
  - `origin` with `'all'` or a `MemoryOrigin`
  - `minImportance`
  - `sort`
  - `limit`
  - `before`
  - `beforeId`
- Success response:
  - `200` with `{ memories: MemoryRecord[], graph: MemoryGraphConsoleSummary | null }`.
- `GET /api/agents/[id]/memories/stats`
  - `200` with `{ stats: MemoryStatsSummary }`.
- `POST /api/agents/[id]/memories/recall`
  - body `{ query: string, limit?: number }`
  - `200` with `{ results: MemoryRecallResult[] }`
  - `400` when `query` is blank.
- `DELETE /api/agents/[id]/memories/[memoryId]`
  - `200` with `{ success: true }`
  - `404` if the memory is missing or belongs to another agent.
- Legacy compatibility path:
  - `useAgentStore` still uses `/api/memory?action=get|getStats|delete`. Treat that as compatibility, not the preferred workspace contract.

## 6. Data model mapping

- Tables:
  - `memories`
  - `memory_graphs`
  - `agents.memoryCount`
- Key `memories` fields used by this tab:
  - `id`, `agentId`, `type`, `origin`, `summary`, `content`, `importance`, `context`, `timestamp`
  - `keywords`, `linkedMessageIds`, `canonicalKey`, `canonicalValue`, `confidence`, `evidenceRefs`, `isActive`
- Deletion behavior:
  - `MemoryService.deleteMemory` removes the row and decrements `agents.memoryCount`.
- Graph data:
  - `memory_graphs.payload.concepts`
  - `memory_graphs.payload.links`
  - `memory_graphs.updatedAt`
- PostgreSQL tables and indexes are defined in `src/lib/db/schema.ts` under `memories` and `memory_graphs`.

## 7. State transitions/lifecycle

- A memory row usually starts as active and visible.
- Deletion removes the row entirely instead of soft-archiving it in PostgreSQL mode.
- `isActive` exists on the record and is used by list logic, so older flows may still treat inactivity as a logical tombstone.
- Graph state is rebuilt or incrementally updated after memory writes.

## 8. Quality gates/validation rules

- Recall requires a non-empty query.
- Console lists hide `personality_insight` rows and inactive rows through `isConsoleMemory`.
- Semantic memory types are treated specially by recall and graph logic.
- Ownership is enforced before deletion.

## 9. Failure modes and how they surface in UI/API

- Agent missing: list and stats routes return `404`.
- Recall with blank query: `400`.
- Graph corruption or absence: the console still renders memories and shows a null or empty graph summary.
- Legacy route drift: the page-level `useAgentStore.fetchAgentMemories` can disagree with `MemoryConsole` because it still hits `/api/memory` instead of the newer nested routes.

## 10. Debugging runbook

1. Inspect `GET /api/agents/[id]/memories` with the same query params the UI uses.
2. Verify the target row in `memories` including `isActive`, `type`, `origin`, `canonicalKey`, and `linkedMessageIds`.
3. Check `agents.memoryCount` if list length and displayed counter diverge.
4. Inspect `memory_graphs.payload` when graph highlights look stale.
5. If the page header and Memory tab disagree, compare `/api/memory` and `/api/agents/[id]/memories` results to confirm a legacy compatibility drift.

## 11. Operational checklist

- Verify filters change the result set correctly.
- Verify stats match the filtered memory population expectations.
- Verify recall returns ranked results with relevant excerpts.
- Verify deletion removes the row and updates `memoryCount`.
- Verify graph summary still loads after memory mutations.

## 12. How to extend safely

- Prefer the nested `/api/agents/[id]/memories*` routes for new workspace work.
- If you introduce a new memory type or origin, update `MemoryRecord` typing, console filters, stats logic, and graph rules together.
- If you change deletion semantics, keep `agents.memoryCount` synchronized.
- Do not duplicate ranking logic in the UI; keep it in `MemoryService`.

## 13. Code references

- `src/components/memory/MemoryConsole.tsx`
- `src/app/api/agents/[id]/memories/route.ts`
- `src/app/api/agents/[id]/memories/[memoryId]/route.ts`
- `src/app/api/agents/[id]/memories/recall/route.ts`
- `src/app/api/agents/[id]/memories/stats/route.ts`
- `src/app/api/agents/[id]/memory-graph/route.ts`
- `src/lib/services/memoryService.ts`
- `src/lib/services/memoryGraphService.ts`
- `src/lib/repositories/memoryRepository.ts`
- `src/lib/repositories/memoryGraphRepository.ts`
- `src/stores/agentStore.ts`
- `src/lib/db/schema.ts`
