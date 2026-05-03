# Knowledge Library

## 1. Purpose and user intent

The Knowledge Library tab is the shared knowledge catalog. It lets an operator search, sort, contribute, endorse, dispute, and inspect reusable knowledge entries shared across agents.

## 2. UI entry points and key controls

- Entry point: `SharedKnowledgeLibrary` in `src/components/knowledge/SharedKnowledgeLibrary.tsx`.
- Key controls:
  - search box
  - category filter
  - sort mode by confidence, popularity, or recency
  - contribute modal for new entries
  - endorse button on visible entries
- The component can be rendered with or without contribution controls depending on props.

## 3. End-to-end user workflow

1. Open the Knowledge Library tab.
2. The component requests `/api/knowledge` with the active search and filter set, plus `/api/knowledge?stats=true`.
3. The user searches or filters the catalog.
4. The user can create a new entry through `POST /api/knowledge` with `action: 'create'`.
5. The user can endorse an entry through `POST /api/knowledge` with `action: 'endorse'`.
6. Dispute and resolution flows are supported by the route even though the current tab mostly exposes endorsement.

## 4. Backend workflow/pipeline

1. `GET /api/knowledge` routes search, category, contributor, popular, recent, or stats requests into `KnowledgeService`.
2. `KnowledgeService` reads from `KnowledgeRepository` or Firestore `shared_knowledge`.
3. Mutations use `KnowledgeService` helpers such as `createKnowledge`, `endorseKnowledge`, `disputeKnowledge`, `resolveDispute`, and `trackKnowledgeUsage`.
4. Knowledge usage search for a specific agent routes through `getRelevantKnowledge`, which also tracks usage for relevant results.

## 5. API contract details

- `GET /api/knowledge`
  - query options:
    - `id`
    - `category`
    - `search`
    - `agentId`
    - `contributorId`
    - `popular=true`
    - `recent=true`
    - `stats=true`
    - `limit`
- `POST /api/knowledge`
  - actions:
    - `create`
    - `update`
    - `delete`
    - `endorse`
    - `remove_endorsement`
    - `dispute`
    - `resolve_dispute`
  - `400` on missing required fields
  - `500` on failed mutation
- Edge cases:
  - `endorseKnowledge` is idempotent for the same agent.
  - `disputeKnowledge` returns failure if the same agent has already disputed the entry.

## 6. Data model mapping

- Primary table: `shared_knowledge`.
- Fields used heavily by the tab:
  - `topic`, `category`, `content`
  - `contributorId`, `contributorName`
  - `endorsements`, `disputes`
  - `accessCount`, `lastAccessedAt`, `usedByAgents`
  - `tags`, `confidence`, `createdAt`, `updatedAt`
- Repository columns store a denormalized summary plus full payload.

## 7. State transitions/lifecycle

- New entries start endorsed by their contributor.
- Confidence rises on endorsement and falls on dispute.
- Usage tracking increments `accessCount` and updates `usedByAgents`.
- Deletion removes the entry outright.

## 8. Quality gates/validation rules

- Create requires `topic`, `category`, `content`, `contributorId`, and `contributorName`.
- Update allows only known mutable fields.
- Disputes are unique per disputing agent.
- Search is in-memory substring matching in `KnowledgeService.searchKnowledge` rather than full-text indexing.

## 9. Failure modes and how they surface in UI/API

- Route errors return `500` and the component logs them; current UI handling is minimal.
- Search on a large corpus is bounded by service-side list limits and may miss very old entries.
- Dual-write drift can cause counts or confidence to lag between PostgreSQL and Firestore.

## 10. Debugging runbook

1. Inspect `/api/knowledge` with and without filters.
2. Verify the target row in `shared_knowledge` including endorsements, disputes, and access counters.
3. If sorting looks wrong, compare UI-side sort mode with backend-returned order.
4. If a search result looks stale, inspect whether `getRelevantKnowledge` is updating usage as expected.

## 11. Operational checklist

- Verify search, category filter, and sort mode all work.
- Verify create and endorse flows persist immediately.
- Verify stats reflect the current corpus.
- Verify confidence changes track endorsement and dispute actions.

## 12. How to extend safely

- Keep confidence math in `KnowledgeService`, not in the component.
- If you add moderation or approval workflow, preserve backward compatibility for current create/update/delete routes.
- If search needs to scale, replace in-memory filtering in the service with indexed search rather than moving logic into the UI.

## 13. Code references

- `src/app/api/knowledge/route.ts`
- `src/lib/services/knowledgeService.ts`
- `src/lib/repositories/knowledgeRepository.ts`
- `src/components/knowledge/SharedKnowledgeLibrary.tsx`
- `src/lib/db/schema.ts`
