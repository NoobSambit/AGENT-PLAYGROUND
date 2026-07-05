# Knowledge Library

## 1. Purpose and user intent

The Knowledge Library tab is the agent-scoped review workspace for reusable knowledge. It lets an operator create review candidates, accept them into prompt-eligible context, reject weak candidates, dispute contested claims, merge duplicates, supersede or retire outdated items, search/filter the corpus, and inspect source/validation/usage history.

## 2. UI entry points and key controls

- Entry point: `KnowledgeLibraryWorkspace` in `src/components/library/KnowledgeLibraryWorkspace.tsx`.
- The `/agents/[id]` Library tab renders `KnowledgeLibraryWorkspace`; it no longer depends on `SharedKnowledgeLibrary`.
- Key controls:
  - status tabs for `review`, `validated`, `disputed`, and `retired`
  - search, category, source type, scope, and sort filters
  - detail panel with claim, body, confidence, quality status, prompt eligibility, tags, governance links, source trail, duplicate suggestions, dispute resolution, validation history, and usage events
  - Add Item modal for manual candidates or trusted entries
  - action controls for accept, edit-and-accept, reject, endorse, dispute, resolve, retire, merge, and supersede

## 3. End-to-end user workflow

1. Open `/agents/[id]` and select the Library tab.
2. The workspace requests `GET /api/agents/[id]/library` with the active status/search/filter set.
3. The response includes list items, stats, filters, the selected detail record, and the active agent summary.
4. Operators can create a candidate through `POST /api/agents/[id]/library/items`.
5. Review candidates can be accepted, edited-and-accepted, rejected, or disputed through `POST /api/agents/[id]/library/items/[itemId]/actions`.
6. Validated items can be endorsed, disputed, or retired.
7. Disputed items can be resolved back to validated or retired.
8. Duplicate or outdated items can be merged/superseded only through explicit operator action; suggestions are read-only until confirmed.
9. Detail reloads use `GET /api/agents/[id]/library/items/[itemId]`.
10. Consumer workflows can request prompt-safe validated context through `POST /api/agents/[id]/library/context`.
11. Consumers that use a context packet can record cheap usage events through `POST /api/agents/[id]/library/usage`.
12. Collective Intelligence can broadcast validated network Library items and write support/dispute decisions into the item validation history.
13. Timeline displays Library item lifecycle events, validation decisions, source refs, and Library-backed Collective broadcasts in the Knowledge source.

## 4. Backend workflow/pipeline

1. Agent-scoped Library routes parse and validate request shape in `routeUtils.ts`.
2. `LibraryService` validates access, lifecycle transitions, rationale requirements, confidence changes, prompt eligibility, and stats.
3. `LibraryRepository` owns PostgreSQL reads and writes for Library tables.
4. Mutations append validation events and update `library_items` lifecycle fields in the same logical action.
5. Old `/api/knowledge` remains a compatibility API backed by `KnowledgeService` and `shared_knowledge`; it is not the current Library tab contract.

## 5. API contract details

- `GET /api/agents/[id]/library`
  - query options: `status`, `category`, `sourceType`, `search`, `sort`, `scope`, `limit`, `cursor`
  - returns `LibraryBootstrapResponse`
  - `400` for invalid filters, `404` for missing agent, `500` for unexpected failures
- `POST /api/agents/[id]/library/items`
  - creates a manual Library item
  - body fields: `title`, `claim`, `body`, `category`, optional `status`, `scope`, `visibility`, `tags`, `relatedAgentIds`, `sourceRef`
  - returns `LibraryMutationResponse`
- `POST /api/agents/[id]/library/context`
  - body fields: optional `query`, `limit`, `maxChars`, `minConfidence`, `category`, `sourceType`, `scope`
  - defaults: `limit=3`, `maxChars=1200`, `minConfidence=0.55`, validated items only
  - returns `LibraryContextPacket` with bounded `items`, `itemIds`, `promptText`, source evidence summaries, and no raw private payloads
  - internal retrieval failures return a non-blocking `status='failed'` packet after the agent is validated
- `POST /api/agents/[id]/library/usage`
  - body fields: `itemIds`, `consumerFeature`, optional `consumerSourceId`, `query`, and either `relevanceScores` or `items: [{ itemId, relevanceScore }]`
  - records usage events only for accessible prompt-eligible validated items
  - updates `usageCount` and `lastUsedAt` on recorded items
- `GET /api/agents/[id]/library/items/[itemId]`
  - returns one `LibraryItemDetailResponse`
  - returns `404` when the item does not exist or is not accessible to the agent
- `POST /api/agents/[id]/library/items/[itemId]/actions`
  - actions: `accept`, `reject`, `endorse`, `dispute`, `resolve`, `retire`, `merge`, `supersede`
  - `reject`, `dispute`, `resolve`, `retire`, `merge`, and `supersede` require a rationale
  - `merge` and `supersede` require `targetItemId`
  - `resolve` accepts optional `resolution='validated'|'retired'`
  - returns `409` for invalid lifecycle transitions
- Legacy compatibility:
  - `GET|POST /api/knowledge` remains available for `shared_knowledge` callers.
  - It is not used by `KnowledgeLibraryWorkspace`.
- Cross-section integration:
  - `GET /api/collective-intelligence` reads validated prompt-eligible network Library items.
  - `POST /api/collective-intelligence` writes Library-backed support/dispute events through `LibraryService`.
  - `GET /api/agents/[id]/timeline` derives Library lifecycle events from `library_items`, `library_item_sources`, `library_item_validations`, and `collective_broadcasts`.

## 6. Data model mapping

- Primary tables:
  - `library_items`
  - `library_item_sources`
  - `library_item_validations`
  - `library_item_usage_events`
- Phase 1 legacy handling:
  - Existing `shared_knowledge` rows can be copied into Library tables with `npm run db:backfill-library` for a dry run and `npm run db:backfill-library -- --apply` to write rows.
  - Backfilled item IDs use `legacy_shared_${shared_knowledge.id}`.
  - Backfilled items are `scope='network'`, `visibility='network'`, `qualityStatus='legacy_unvalidated'`, and `createdFromFeature='collective'`.
  - Legacy rows with disputes become `disputed`; other legacy rows become `validated`.
  - The backfill inserts missing rows only and does not overwrite curated Library items.

## 7. State transitions/lifecycle

- Manual review candidates start as `review`, confidence `0.55`, and are excluded from prompt context.
- Trusted manual entries can start as `validated`, confidence `0.85`, with an accept validation event.
- `accept` moves `review -> validated`, enables prompt context, and records accepted metadata.
- `reject` moves `review -> rejected`, sets confidence to `0`, and disables prompt context.
- `dispute` moves `review|validated -> disputed`, lowers confidence, and disables prompt context.
- `resolve` moves `disputed -> validated` and re-enables prompt context, or `disputed -> retired` when the operator resolves by retiring the claim.
- `retire` moves `validated|disputed -> retired` and disables prompt context.
- `merge` moves an active duplicate item to `retired`, sets `mergedIntoItemId`, disables prompt context on the duplicate, copies non-duplicate source refs to the target with governance payload links, and appends merge validation events to both items. Existing usage events stay on the original item for audit.
- `supersede` moves an outdated `validated|disputed` item to `retired`, sets `supersedesItemId` to the replacement, disables prompt context on the outdated item, links source refs to the replacement, and records the decision in validation/payload metadata.
- `endorse` keeps `validated` status and raises confidence slightly.

## 8. Quality gates/validation rules

- Agent ID must resolve before list/detail/mutation work.
- Create requires non-empty title, claim, body, and a known Library category.
- Create `status` is limited to `review` or `validated`.
- Scope and visibility values are allowlisted.
- Invalid action names return `400`.
- Invalid lifecycle transitions return `409`.
- Rationale-required actions fail before repository mutation when rationale is empty.
- Duplicate suggestions are computed for inspection only and do not mutate data until the operator submits merge or supersede.

## 9. Failure modes and how they surface in UI/API

- Workspace fetch failures render an actionable retry state.
- Detail fetch failures render a detail-level retry state.
- Mutation failures are shown in the workspace live region and keep the current detail visible.
- Modal validation errors keep form state intact.
- Backfill is dry-run-first and requires `--apply`; missing `DATABASE_URL` or missing Library tables fails before writes.

## 10. Debugging runbook

1. Inspect `GET /api/agents/[id]/library?status=review`.
2. Inspect `GET /api/agents/[id]/library/items/[itemId]` for detail, source, validation, and usage history.
3. Verify lifecycle rows in `library_items` and appended events in `library_item_validations`.
4. For legacy compatibility, inspect `/api/knowledge` and `shared_knowledge` separately.
5. For backfill plans, run `npm run db:backfill-library` before `npm run db:backfill-library -- --apply`.

## 11. Operational checklist

- Verify create review item.
- Verify accept, reject, dispute, resolve, endorse, retire, merge, and supersede actions.
- Verify merged/superseded indicators, duplicate suggestions, merge dialog, and dispute resolution panel.
- Verify search, category, source type, scope, and sort filters.
- Verify detail reload and retry states.
- Verify context retrieval returns validated prompt-safe packets and excludes review/disputed/rejected/retired/merged/superseded rows.
- Verify usage recording appends `library_item_usage_events` and updates aggregate fields.
- Verify Collective can broadcast validated network Library items and support/dispute actions appear in validation history.
- Verify Timeline shows Library lifecycle and Library-backed broadcast events with source refs.
- Verify legacy `/api/knowledge` still returns shared knowledge compatibility responses.

## 12. How to extend safely

- Keep lifecycle and confidence rules in `LibraryService`.
- Keep SQL and transaction boundaries in `LibraryRepository`.
- Add new source producers by writing Library items/sources directly instead of routing through `/api/knowledge`.
- Phase 2 producers write review-only candidates from high-signal completed outputs. Current producers include Challenge, Arena, Profile, Relationships, Creative publish, and Journal save. Creative drafts, ordinary journal thoughts, ordinary chat turns, every dream, and every memory row are intentionally not automatic producers.
- Phase 3B/3C consumers can request small validated context packets before useful model calls. Current consumers are Chat, Creative Studio, Journal, Profile, Challenge Lab, Arena, and relationship synthesis provenance. They keep Library context lower priority than direct run evidence, continue when retrieval fails or returns no context, record usage only after the prompt block is used, and surface `libraryContextStatus`, `libraryContextItemIds`, `libraryContextError`, `libraryUsageRecordedAt`, and compact source-backed influence traces in existing inspector panels. Local-model prompt budgets stay intentionally small: single-agent consumers use short per-packet character caps, while Challenge Lab and Arena combine participant Library blocks under one bounded prompt addition.
- Preserve `legacy_unvalidated` for backfilled records until Phase 2 revalidation or source-specific promotion work exists.

## 13. Code references

- `src/components/library/KnowledgeLibraryWorkspace.tsx`
- `src/app/api/agents/[id]/library/route.ts`
- `src/app/api/agents/[id]/library/context/route.ts`
- `src/app/api/agents/[id]/library/usage/route.ts`
- `src/app/api/agents/[id]/library/items/route.ts`
- `src/app/api/agents/[id]/library/items/[itemId]/route.ts`
- `src/app/api/agents/[id]/library/items/[itemId]/actions/route.ts`
- `src/lib/services/libraryService.ts`
- `src/lib/repositories/libraryRepository.ts`
- `scripts/backfill-shared-knowledge-library.mjs`
- `src/app/api/knowledge/route.ts`
