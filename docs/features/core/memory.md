# Memory

## Purpose

Memory gives an agent continuity.

It stores:

- raw conversation episodes
- stable facts
- projects
- preferences
- relationships
- identity facts
- operational constraints
- artifact summaries
- tension snapshots

It answers:

`What should this agent remember, and how should it retrieve it later?`

## UI Entry Point

- `/agents/[id]` on the Memory tab

## API Routes

- `GET /api/agents/[id]/memories`
- `GET /api/agents/[id]/memories/stats`
- `POST /api/agents/[id]/memories/recall`
- `DELETE /api/agents/[id]/memories/[memoryId]`
- `GET|POST /api/memory`

## Ownership

- Service: `src/lib/services/memoryService.ts`
- Graph service: `src/lib/services/memoryGraphService.ts`
- Repository: `src/lib/repositories/memoryRepository.ts`
- Table: `memories`
- Summary projection: `memory_graphs`
- Counter source: `agents.memoryCount`

## Memory Types

| Type | Meaning |
| --- | --- |
| `conversation` | Raw or compact turn memory. |
| `fact` | Stable extracted fact. |
| `interaction` | Tool or system interaction worth keeping. |
| `personality_insight` | Legacy type kept for compatibility. |
| `preference` | Stable user or agent preference. |
| `project` | Active project or work context. |
| `relationship` | Pair or social state note. |
| `identity` | Identity fact. |
| `operating_constraint` | Rule or boundary that should stay visible. |
| `artifact_summary` | Summary of a saved work product. |
| `tension_snapshot` | A visible tension worth remembering. |

## Memory Shape

Important fields:

- `id`
- `agentId`
- `type`
- `content`
- `summary`
- `keywords`
- `importance`
- `context`
- `origin`
- `linkedMessageIds`
- `canonicalKey`
- `canonicalValue`
- `confidence`
- `evidenceRefs`
- `supersedes`
- `lastConfirmedAt`
- `metadata`
- `isActive`
- `timestamp`

The canonical semantic fields are especially important:

- `canonicalKey`: stable id for the fact
- `canonicalValue`: normalized value
- `confidence`: confidence in the fact
- `evidenceRefs`: what supports it
- `supersedes`: earlier rows that it replaces
- `lastConfirmedAt`: when it was last re-validated

## End-To-End Flow

### 1. Chat creates the memory

The chat turn service creates a conversation episode after both messages exist.

### 2. Fact extraction runs

The system attempts to extract stable facts from the prompt.

Examples:

- name
- project
- preference
- relationship hint
- operating constraint

### 3. Semantic rows upsert instead of duplicating

If the same fact is confirmed later, the service updates the existing semantic row rather than blindly appending a new one.

That keeps the memory store useful instead of noisy.

### 4. The memory graph is refreshed

The graph is a projection, not the canonical store.

Its job is to make concept relationships inspectable in the UI.

### 5. Recall ranks the best matches

Recall is heuristic:

- keyword overlap
- summary match
- content match
- context match
- importance
- semantic memory bonus

## Write Rules

- Every memory write should keep `agents.memoryCount` accurate.
- Linked message ids should exist before the memory row is written.
- Active semantic memory types should be easy to query later.
- Old or inactive rows should not disappear from history unless explicitly deleted by design.

## Delete Rules

Memory deletes are server-side operations.

The system should:

- mark or remove the memory according to the current persistence strategy
- adjust the counter
- keep the UI consistent

## Failure Modes

- No memory row exists for the requested id
- Firestore / PostgreSQL mismatch in dual-write mode
- Recall query too broad
- Legacy `personality_insight` rows in old documents

## Related Files

- [`src/lib/services/memoryService.ts`](../../../src/lib/services/memoryService.ts)
- [`src/lib/services/memoryGraphService.ts`](../../../src/lib/services/memoryGraphService.ts)
- [`src/lib/repositories/memoryRepository.ts`](../../../src/lib/repositories/memoryRepository.ts)

