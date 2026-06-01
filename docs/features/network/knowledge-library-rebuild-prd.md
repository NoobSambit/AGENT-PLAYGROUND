# Knowledge Library Rebuild PRD

Date: 2026-06-01

Status: implementation-ready product and capability plan

Owner surface: `/agents/[id]` -> `Library`

Related docs:

- `docs/features/network/shared-knowledge.md`
- `docs/workspace-sections/knowledge-library.md`
- `docs/agent-tab-refresh-plan.md`
- `docs/data-model.md`
- `docs/database/postgresql-schema.md`

## 1. Capability Statement

Rebuild the Library tab into an inspectable Knowledge Vault for agents. The Library stores reusable, source-backed knowledge that can safely influence future agent workflows without turning every chat, challenge, dream, journal, arena, or profile event into permanent truth.

The Library must answer:

- What does this agent know that is reusable?
- Where did that knowledge come from?
- Is it trusted, disputed, outdated, or still waiting for review?
- Which other workflows have used it?
- Should it be allowed to influence future model prompts?

The Library is not a dumping ground for raw output. It is the promotion layer between feature-specific evidence and future prompt context.

## 2. Product Problem

The current Library behaves like a shared CRUD catalog. It supports search, contribution, endorsement, disputes, and usage counters, but it does not match the newer rebuilt tabs in the product.

Recent rebuilt sections are now:

- run-based or event-based
- source-backed
- quality-aware
- inspectable
- PostgreSQL-first
- careful about local LLM cost
- explicit about draft, review, ready, failed, and legacy states

The Library should now become the shared knowledge control plane for those sections. It should not silently recompute itself after every action or overload local models.

## 3. Product Principles

### 3.1 Candidate First, Trusted Later

Feature outputs may suggest Library knowledge, but they must not directly create trusted reusable knowledge by default.

Required lifecycle:

```text
Feature output
  -> library candidate
  -> review queue
  -> validated library item
  -> selective use by other workflows
  -> usage event recorded
```

### 3.2 LLM Suggests, System Governs

The LLM may extract candidate claims. It is not the final authority.

The final decision should come from:

- deterministic validation rules
- user review
- explicit manual save
- safe automated metadata updates

### 3.3 Validated Items Only Affect Outputs

Other sections may read Library data only through a bounded retrieval API that returns a small number of relevant, validated items. Review, rejected, retired, and low-confidence disputed items must not be injected into prompts unless a workflow explicitly asks for them for inspection.

### 3.4 Local LLM Safety

The Library must be designed for local and weaker LLMs.

Rules:

- no model calls during render
- no Library summarization on every chat turn
- no automatic full-library reanalysis
- no broad prompt injection of all Library records
- maximum 1 to 3 candidate claims from a completed feature run
- maximum 3 to 5 validated Library items supplied to downstream prompts
- cheap database updates are allowed; expensive extraction is deferred or optional

### 3.5 Source-Backed Knowledge

Every reusable claim must have at least one source reference. A source reference should point back to the feature, run, item, or timeline event that justifies the claim.

## 4. Non-Goals

The rebuild must not:

- store full raw chat logs in the Library
- store full journal, dream, creative, arena, or challenge transcripts as Library items
- replace Memory, Timeline, Profile, Knowledge Graph, or Collective Intelligence
- make the Library a live background agent that constantly rewrites itself
- require hosted infrastructure, queues, daemons, or paid services
- expose provider secrets or raw private prompts to client code
- let unreviewed LLM claims affect future outputs
- make every feature wait on Library extraction before completing
- migrate or preserve the exact current Library UI

## 5. Terminology

### Library Item

A durable reusable knowledge record. It may be in review, validated, disputed, rejected, or retired state.

### Candidate

A Library item with `status = 'review'`. It has been suggested by a feature, user, or extraction step but is not trusted yet.

### Validated Knowledge

A Library item with `status = 'validated'`. Only validated items can be used as normal prompt context for other workflows.

### Source Ref

A pointer to the evidence behind an item. Examples:

- chat message id
- memory id
- journal session id
- dream id
- creative artifact id
- profile run id
- challenge run id
- challenge event id
- arena run id
- relationship evidence id
- timeline event id
- manual note id

### Usage Event

A cheap persisted record that says a workflow used a Library item as context.

## 6. Actors

### Operator

The human user inspecting and managing the agent. Can accept, edit, reject, dispute, retire, merge, and manually create Library items.

### Agent

The current agent whose knowledge is being viewed. Can be contributor, subject, endorser, disputer, or consumer of a Library item.

### Feature Workflow

A product section such as Challenge Lab, Arena, Journal, Dreams, Profile, Relationships, Creative Studio, Chat, or Memory. It may produce candidate knowledge after meaningful completed work.

### Library Service

The server-side service responsible for lifecycle transitions, validation, search, dedupe, context packing, and usage tracking.

### Local LLM Provider

Optional extractor/generator. It may produce candidate claims from completed feature outputs. Its output must be filtered and saved as review, not trusted immediately.

## 7. Library Scope

The Library should store reusable knowledge such as:

- stable behavioral observations
- known strengths
- known weaknesses
- learned preferences
- recurring emotional patterns
- recurring creative motifs
- challenge performance lessons
- arena debate tendencies
- relationship insights
- validated facts shared by the agent network
- durable user-specified rules or instructions
- reusable techniques or strategies

The Library should not store:

- raw messages
- full transcripts
- full generated artifacts
- temporary UI state
- one-off feelings without recurrence
- ungrounded personality judgments
- hallucinated conclusions
- low-quality failed output
- duplicated claims with different wording
- private provider payloads
- secrets

## 8. Status Model

Use a single Library item lifecycle with these statuses:

```ts
type LibraryItemStatus =
  | 'review'
  | 'validated'
  | 'disputed'
  | 'rejected'
  | 'retired'
```

### 8.1 review

Suggested but not trusted. Appears in Review Queue. Not used by downstream prompts.

Common creators:

- completed challenge run
- completed arena run
- profile analysis result
- relationship synthesis
- explicit user save
- manual contribution
- memory pattern promotion

### 8.2 validated

Trusted enough to reuse. Can be returned by context retrieval APIs.

Allowed transitions:

- `review -> validated`
- `disputed -> validated` after resolution
- manual direct create by user if they select trusted save

### 8.3 disputed

Contested or conflicting. Not used as normal prompt context.

Allowed transitions:

- `validated -> disputed`
- `review -> disputed`

### 8.4 rejected

Rejected candidate. Kept for audit if useful, but hidden by default.

Allowed transitions:

- `review -> rejected`

### 8.5 retired

Previously useful but outdated or superseded. Not used by prompts.

Allowed transitions:

- `validated -> retired`
- `disputed -> retired`

## 9. Confidence And Trust Rules

Confidence is not the same as status.

- `status` controls whether an item can affect outputs.
- `confidence` ranks trusted items during retrieval.

Rules:

- New LLM-extracted candidates default to `0.45` to `0.70`.
- Manual trusted user entries may start at `0.85`.
- Endorsements can raise confidence by a bounded amount.
- Disputes can lower confidence and move status to `disputed`.
- Confidence must be clamped to `0.0` to `1.0`.
- A high-confidence item can still be `review` or `disputed`.
- A low-confidence item must never be injected into prompts just because it matches a query.

Recommended formula for phase 1:

```ts
nextConfidence = clamp(
  baseConfidence
  + endorsementCount * 0.05
  - disputeCount * 0.08
  + usageSuccessCount * 0.02,
  0,
  1
)
```

Keep formula changes in `LibraryService`, not UI components.

## 10. Category Model

Use categories that match the agent platform rather than the current generic set.

```ts
type LibraryCategory =
  | 'fact'
  | 'preference'
  | 'behavior_pattern'
  | 'strength'
  | 'weakness'
  | 'strategy'
  | 'relationship'
  | 'creative_style'
  | 'emotional_pattern'
  | 'skill'
  | 'risk'
  | 'lesson'
```

Category rules:

- `fact`: stable factual knowledge.
- `preference`: user or agent preference.
- `behavior_pattern`: repeated behavior across evidence.
- `strength`: capability demonstrated by evidence.
- `weakness`: limitation demonstrated by evidence.
- `strategy`: reusable method or tactic.
- `relationship`: insight involving multiple agents.
- `creative_style`: style, motif, tone, or composition pattern.
- `emotional_pattern`: repeated emotional tendency.
- `skill`: capability or learned skill.
- `risk`: warning about failure mode or unsafe tendency.
- `lesson`: generalizable learning from a run.

## 11. Source Types

```ts
type LibrarySourceType =
  | 'manual'
  | 'chat'
  | 'memory'
  | 'emotion'
  | 'journal'
  | 'dream'
  | 'creative'
  | 'profile'
  | 'challenge'
  | 'arena'
  | 'relationship'
  | 'learning'
  | 'scenario'
  | 'knowledge_graph'
  | 'collective'
  | 'mentorship'
  | 'timeline'
```

Source refs must be lightweight. They should include IDs and summaries, not whole raw artifacts.

Recommended shape:

```ts
interface LibrarySourceRef {
  sourceType: LibrarySourceType
  sourceId: string
  sourceTitle?: string
  sourceUrl?: string
  sourceTimestamp?: string
  evidenceSummary: string
  quote?: string
}
```

`quote` must be short and optional. Do not store long private transcripts as quotes.

## 12. Data Model

The rebuild should move from the current `shared_knowledge` concept to a richer Library model. PostgreSQL remains canonical runtime persistence.

### 12.1 Tables

Recommended tables:

1. `library_items`
2. `library_item_sources`
3. `library_item_validations`
4. `library_item_usage_events`

This keeps item lifecycle, source evidence, trust actions, and usage tracking separate.

### 12.2 library_items

Required columns:

```ts
id: text primary key
agent_id: text nullable
scope: text not null
title: text not null
claim: text not null
body: text not null
category: text not null
status: text not null
confidence: double precision not null default 0.5
quality_status: text not null default 'legacy_unvalidated'
visibility: text not null default 'agent'
created_by_agent_id: text nullable
created_by_name: text nullable
created_from_feature: text not null
primary_source_type: text not null
primary_source_id: text not null
tags: text[] not null default '{}'
related_agent_ids: text[] not null default '{}'
usage_count: integer not null default 0
last_used_at: timestamp with time zone nullable
accepted_at: timestamp with time zone nullable
accepted_by: text nullable
rejected_at: timestamp with time zone nullable
rejected_by: text nullable
retired_at: timestamp with time zone nullable
retired_by: text nullable
supersedes_item_id: text nullable
merged_into_item_id: text nullable
created_at: timestamp with time zone not null
updated_at: timestamp with time zone not null
payload: jsonb not null
```

`scope` values:

```ts
type LibraryScope = 'agent' | 'network'
```

`visibility` values:

```ts
type LibraryVisibility = 'agent' | 'network' | 'private'
```

Notes:

- `agent_id` is the primary subject agent when the item belongs to one agent.
- `scope = 'network'` is for shared knowledge usable across agents.
- `related_agent_ids` covers relationship, arena, mentorship, and collective items.
- `payload` stores future-compatible metadata such as extraction prompt version, dedupe hash, validation report, and source-specific details.

Recommended indexes:

```sql
library_items_agent_status_updated_idx on (agent_id, status, updated_at)
library_items_scope_status_confidence_idx on (scope, status, confidence)
library_items_category_status_confidence_idx on (category, status, confidence)
library_items_primary_source_idx on (primary_source_type, primary_source_id)
library_items_created_from_feature_idx on (created_from_feature, created_at)
library_items_tags_gin_idx on tags using gin
```

Optional later index:

```sql
library_items_claim_search_idx using gin(to_tsvector('english', claim || ' ' || body))
```

Only add full-text indexing when needed. Phase 1 can use bounded SQL plus service-side scoring.

### 12.3 library_item_sources

Required columns:

```ts
id: text primary key
item_id: text not null references library_items(id) on delete cascade
source_type: text not null
source_id: text not null
source_title: text nullable
source_url: text nullable
source_timestamp: timestamp with time zone nullable
evidence_summary: text not null
quote: text nullable
created_at: timestamp with time zone not null
payload: jsonb not null default '{}'
```

Recommended indexes:

```sql
library_item_sources_item_idx on (item_id)
library_item_sources_source_idx on (source_type, source_id)
```

### 12.4 library_item_validations

Required columns:

```ts
id: text primary key
item_id: text not null references library_items(id) on delete cascade
actor_type: text not null
agent_id: text nullable
actor_name: text nullable
verdict: text not null
rationale: text not null
confidence_delta: double precision not null default 0
created_at: timestamp with time zone not null
payload: jsonb not null default '{}'
```

`actor_type` values:

```ts
type LibraryValidationActorType = 'user' | 'agent' | 'system'
```

`verdict` values:

```ts
type LibraryValidationVerdict =
  | 'accept'
  | 'reject'
  | 'endorse'
  | 'dispute'
  | 'resolve'
  | 'retire'
  | 'merge'
```

Recommended indexes:

```sql
library_item_validations_item_created_idx on (item_id, created_at)
library_item_validations_agent_created_idx on (agent_id, created_at)
library_item_validations_verdict_created_idx on (verdict, created_at)
```

### 12.5 library_item_usage_events

Required columns:

```ts
id: text primary key
item_id: text not null references library_items(id) on delete cascade
agent_id: text nullable
consumer_feature: text not null
consumer_source_id: text nullable
query: text nullable
relevance_score: double precision not null default 0
used_at: timestamp with time zone not null
payload: jsonb not null default '{}'
```

Recommended indexes:

```sql
library_item_usage_events_item_used_idx on (item_id, used_at)
library_item_usage_events_agent_feature_used_idx on (agent_id, consumer_feature, used_at)
```

### 12.6 TypeScript Types

Add stable types to `src/types/database.ts` or a new domain-specific file if that is the emerging pattern.

Recommended types:

```ts
export type LibraryItemStatus = 'review' | 'validated' | 'disputed' | 'rejected' | 'retired'
export type LibraryScope = 'agent' | 'network'
export type LibraryVisibility = 'agent' | 'network' | 'private'
export type LibraryCategory =
  | 'fact'
  | 'preference'
  | 'behavior_pattern'
  | 'strength'
  | 'weakness'
  | 'strategy'
  | 'relationship'
  | 'creative_style'
  | 'emotional_pattern'
  | 'skill'
  | 'risk'
  | 'lesson'
export type LibrarySourceType =
  | 'manual'
  | 'chat'
  | 'memory'
  | 'emotion'
  | 'journal'
  | 'dream'
  | 'creative'
  | 'profile'
  | 'challenge'
  | 'arena'
  | 'relationship'
  | 'learning'
  | 'scenario'
  | 'knowledge_graph'
  | 'collective'
  | 'mentorship'
  | 'timeline'
export type LibraryQualityStatus = 'pending' | 'passed' | 'failed' | 'legacy_unvalidated'
```

Main item interface:

```ts
export interface LibraryItem {
  id: string
  agentId?: string
  scope: LibraryScope
  title: string
  claim: string
  body: string
  category: LibraryCategory
  status: LibraryItemStatus
  confidence: number
  qualityStatus: LibraryQualityStatus
  visibility: LibraryVisibility
  createdByAgentId?: string
  createdByName?: string
  createdFromFeature: LibrarySourceType
  primarySourceType: LibrarySourceType
  primarySourceId: string
  tags: string[]
  relatedAgentIds: string[]
  usageCount: number
  lastUsedAt?: string
  acceptedAt?: string
  acceptedBy?: string
  rejectedAt?: string
  rejectedBy?: string
  retiredAt?: string
  retiredBy?: string
  supersedesItemId?: string
  mergedIntoItemId?: string
  createdAt: string
  updatedAt: string
  payload: LibraryItemPayload
}
```

Payload:

```ts
export interface LibraryItemPayload {
  extraction?: {
    extractor: 'deterministic' | 'llm' | 'manual'
    promptVersion?: string
    model?: string
    rawCandidate?: unknown
  }
  validation?: {
    errors: string[]
    warnings: string[]
    checkedAt: string
  }
  dedupe?: {
    normalizedClaimHash: string
    possibleDuplicateIds: string[]
  }
  contextPolicy?: {
    allowPromptUse: boolean
    maxPromptChars: number
  }
  sourceSpecific?: Record<string, unknown>
}
```

### 12.7 Non-Library Schema Touchpoints

The Library rebuild should not force every feature table to be redesigned in Phase 1. Most cross-feature links should be represented by `library_item_sources`, `library_item_usage_events`, and source refs.

However, producer and consumer features may need small schema or payload updates when Library integration is added.

Use this rule:

- If a field is only needed for inspection of one run/artifact, keep it in that feature's existing `payload`.
- If a field is queried frequently across many rows, promote it to a typed column with an index.
- If a field describes Library lifecycle state, prefer storing it in Library tables and referencing source IDs rather than duplicating it in every feature.

Recommended optional payload fields for feature outputs that produce Library candidates:

```ts
interface LibraryProducerMetadata {
  libraryCandidateStatus?: 'not_applicable' | 'pending' | 'created' | 'skipped' | 'failed'
  libraryCandidateIds?: string[]
  libraryCandidateError?: string
  libraryCandidateCreatedAt?: string
  libraryCandidateExtractor?: 'deterministic' | 'llm' | 'manual'
}
```

Recommended optional payload fields for feature outputs that consume Library context:

```ts
interface LibraryConsumerMetadata {
  libraryContextStatus?: 'not_requested' | 'loaded' | 'skipped' | 'failed'
  libraryContextItemIds?: string[]
  libraryContextError?: string
  libraryUsageRecordedAt?: string
}
```

Likely feature schema/payload touchpoints by phase:

- Challenge Lab: add Library candidate IDs/status to `challenge_runs.payload` or final report payload in Phase 2.
- Arena: add Library candidate IDs/status to arena run payload or final report payload in Phase 2.
- Profile: add Library candidate IDs/status to profile run payload in Phase 2; add consumed Library item IDs to profile run evidence payload in Phase 3.
- Relationships: add Library candidate IDs/status to relationship synthesis run payload in Phase 2; do not duplicate relationship state in Library.
- Creative: add consumed Library context IDs to creative session payload in Phase 3; add candidate IDs only after published artifacts in Phase 2.
- Journal: add consumed Library context IDs to journal session payload in Phase 3; add candidate IDs only after saved entries in Phase 2.
- Chat: add consumed Library context IDs to chat turn quality/trace payload only if Library retrieval is enabled in Phase 3.
- Timeline: no source schema change required unless Library lifecycle events become first-class timeline events in Phase 4.
- Collective: add Library item IDs to broadcast/validation payloads in Phase 4.

Do not add columns such as `libraryCandidateIds` to every table by default. Start with payload metadata and only promote to typed columns if list queries or dashboards require it.

## 13. Migration Strategy

### 13.1 Current Data

Current table: `shared_knowledge`

Current service: `KnowledgeService`

Current component: `SharedKnowledgeLibrary`

### 13.2 Migration Goal

Do not preserve the old UI contract. Preserve useful rows where possible.

Migration should:

1. Create new Library tables.
2. Backfill `shared_knowledge` rows into `library_items`.
3. Convert current endorsements/disputes into `library_item_validations`.
4. Convert `accessCount`, `lastAccessedAt`, and `usedByAgents` into aggregate fields and optional usage events.
5. Keep old `shared_knowledge` reads available only through compatibility wrappers until all callers move.
6. Retire or rewrite `/api/knowledge` after new API adoption.

Backfill mapping:

```text
shared_knowledge.id -> library_items.id or legacy-prefixed id
topic -> title
content -> body
topic/content -> claim
category -> mapped LibraryCategory
contributorId -> created_by_agent_id
contributorName -> created_by_name
confidence -> confidence
tags -> tags
endorsements -> validation rows with verdict 'endorse'
disputes -> validation rows with verdict 'dispute'
accessCount -> usage_count
lastAccessedAt -> last_used_at
createdAt -> created_at
updatedAt -> updated_at
```

Legacy category mapping:

```text
fact -> fact
opinion -> lesson
theory -> strategy
experience -> lesson
skill -> skill
wisdom -> lesson
```

Legacy status mapping:

- If disputes exist and disputes outnumber endorsements: `disputed`
- Else if confidence >= 0.7 or endorsements length > 1: `validated`
- Else: `review`

### 13.3 Firestore Compatibility

Firestore remains legacy/mirror support. New runtime logic should be PostgreSQL-first.

Implementation options:

- Phase 1 may keep existing `KnowledgeService` for legacy routes.
- New `LibraryService` should use PostgreSQL repository first.
- If dual-write compatibility is still needed, mirror only compact item payloads, not every usage event.

Do not add Firestore-first Library behavior unless explicitly required.

## 14. Backend Architecture

### 14.1 Repository

Add:

- `src/lib/repositories/libraryRepository.ts`

Responsibilities:

- CRUD for Library items
- source ref persistence
- validation event persistence
- usage event persistence
- status-filtered list queries
- bounded context retrieval queries
- duplicate candidate lookup

Repository must not:

- build prompts
- run LLM calls
- decide business transitions
- expose raw SQL errors to API routes

### 14.2 Service

Add:

- `src/lib/services/libraryService.ts`

Responsibilities:

- lifecycle transitions
- candidate creation
- review accept/reject
- endorsement/dispute/resolve/retire
- merge/supersede
- confidence updates
- source validation
- context packing
- dedupe policy
- usage recording
- stats calculation

### 14.3 Candidate Extractor

Add:

- `src/lib/services/libraryCandidateExtractor.ts`

Responsibilities:

- accept completed feature outputs
- produce 0 to 3 candidate claims
- use deterministic rules when enough structure exists
- optionally call LLM when enabled and useful
- return candidates only, never persist trusted knowledge directly

Recommended interface:

```ts
interface ExtractLibraryCandidatesInput {
  agentId: string
  agentName: string
  sourceType: LibrarySourceType
  sourceId: string
  sourceTitle?: string
  sourceSummary: string
  sourceTimestamp?: string
  featurePayload: unknown
  preferredModel?: string
  mode: 'deterministic' | 'llm' | 'disabled'
  maxCandidates?: number
}

interface ExtractedLibraryCandidate {
  title: string
  claim: string
  body: string
  category: LibraryCategory
  confidence: number
  tags: string[]
  evidenceSummary: string
  relatedAgentIds: string[]
}
```

### 14.4 Context Retrieval

Add:

- `src/lib/services/libraryContextService.ts` or keep inside `libraryService.ts` if small.

Responsibilities:

- return small prompt-safe context packets
- record usage after successful workflow start or completion
- exclude non-validated statuses by default
- enforce prompt budget

Recommended interface:

```ts
interface LibraryContextRequest {
  agentId: string
  consumerFeature: LibrarySourceType
  query: string
  categories?: LibraryCategory[]
  relatedAgentIds?: string[]
  limit?: number
  maxChars?: number
  includeNetwork?: boolean
}

interface LibraryContextPacket {
  items: Array<{
    id: string
    title: string
    claim: string
    category: LibraryCategory
    confidence: number
    sourceSummary: string
    promptText: string
    relevanceScore: number
  }>
  promptBlock: string
}
```

Default limits:

```ts
limit = 3
maxChars = 1200
minConfidence = 0.55
status = 'validated'
```

## 15. API Contract

Prefer agent-scoped routes for the tab and shared internal routes for cross-feature context.

### 15.1 Bootstrap Library Workspace

```http
GET /api/agents/[id]/library
```

Query params:

```text
status=review|validated|disputed|rejected|retired|all
category=<LibraryCategory>
sourceType=<LibrarySourceType>
search=<string>
sort=updated|confidence|usage|created
scope=agent|network|all
limit=<number>
cursor=<string>
```

Response:

```ts
interface LibraryBootstrapResponse {
  agent: {
    id: string
    name: string
  }
  items: LibraryItemSummary[]
  selectedItem?: LibraryItemDetail
  stats: LibraryStats
  filters: {
    statuses: LibraryItemStatus[]
    categories: LibraryCategory[]
    sourceTypes: LibrarySourceType[]
  }
  stale: boolean
}
```

### 15.2 Get Item Detail

```http
GET /api/agents/[id]/library/items/[itemId]
```

Response:

```ts
interface LibraryItemDetailResponse {
  item: LibraryItem
  sources: LibrarySourceRef[]
  validations: LibraryValidation[]
  usageEvents: LibraryUsageEvent[]
  relatedItems: LibraryItemSummary[]
}
```

### 15.3 Create Manual Item

```http
POST /api/agents/[id]/library/items
```

Body:

```ts
{
  title: string
  claim: string
  body: string
  category: LibraryCategory
  status?: 'review' | 'validated'
  scope?: LibraryScope
  visibility?: LibraryVisibility
  tags?: string[]
  relatedAgentIds?: string[]
  sourceRef?: LibrarySourceRef
}
```

Rules:

- Manual trusted create may use `status = 'validated'`.
- Missing source ref should create a `manual` source ref.
- Server must validate fields and clamp confidence.

### 15.4 Create Candidate From Feature

Internal service-first preferred. If an API is needed:

```http
POST /api/agents/[id]/library/candidates
```

Body:

```ts
{
  sourceType: LibrarySourceType
  sourceId: string
  sourceTitle?: string
  sourceSummary: string
  candidates: ExtractedLibraryCandidate[]
}
```

Rules:

- Saves items as `status = 'review'`.
- Rejects invalid categories.
- Rejects source-less candidates.
- Runs dedupe before insert.
- Max 3 candidates per source by default.

### 15.5 Review Actions

```http
POST /api/agents/[id]/library/items/[itemId]/actions
```

Body:

```ts
type LibraryItemActionBody =
  | { action: 'accept'; actorName?: string; editedItem?: Partial<LibraryItemEditableFields>; rationale?: string }
  | { action: 'reject'; actorName?: string; rationale: string }
  | { action: 'endorse'; actorAgentId?: string; actorName?: string; rationale?: string }
  | { action: 'dispute'; actorAgentId?: string; actorName?: string; rationale: string }
  | { action: 'resolve'; actorName?: string; rationale: string }
  | { action: 'retire'; actorName?: string; rationale: string }
  | { action: 'merge'; targetItemId: string; actorName?: string; rationale: string }
```

Response:

```ts
{
  success: true
  item: LibraryItemDetail
  stats: LibraryStats
}
```

### 15.6 Context Retrieval For Other Features

```http
POST /api/agents/[id]/library/context
```

Body:

```ts
{
  consumerFeature: LibrarySourceType
  query: string
  categories?: LibraryCategory[]
  relatedAgentIds?: string[]
  limit?: number
  maxChars?: number
  includeNetwork?: boolean
  consumerSourceId?: string
}
```

Response:

```ts
{
  context: LibraryContextPacket
}
```

Rules:

- Only returns validated items by default.
- Records usage only when `consumerSourceId` is provided or when caller explicitly calls the usage endpoint.
- Must never return raw secret-bearing payloads.

### 15.7 Usage Tracking

```http
POST /api/agents/[id]/library/usage
```

Body:

```ts
{
  itemIds: string[]
  consumerFeature: LibrarySourceType
  consumerSourceId?: string
  query?: string
  relevanceScores?: Record<string, number>
}
```

This must be a cheap DB update. No LLM calls.

## 16. UI Requirements

Replace `SharedKnowledgeLibrary` with a rebuilt workspace component.

Recommended component:

- `src/components/library/KnowledgeLibraryWorkspace.tsx`

Supporting components:

- `LibraryStatsStrip`
- `LibraryFilterBar`
- `LibraryItemList`
- `LibraryItemDetail`
- `LibraryReviewQueue`
- `LibrarySourceTrail`
- `LibraryValidationPanel`
- `LibraryUsageTrail`
- `LibraryManualCreateModal`
- `LibraryMergeDialog`
- `LibraryDisputeDialog`

### 16.1 Layout

Desktop:

```text
Top stats strip
Filter/search/action bar
Main grid:
  left: item list / review queue
  center: selected item detail
  right: sources, validations, usage, related agents
```

Mobile:

```text
Stats
Filters
Item list
Tap item -> detail view
Detail sections stacked
```

### 16.2 Primary Tabs

Use tabs or segmented controls:

- Review
- Validated
- Disputed
- Retired

Optional:

- All

Default tab:

- If review count > 0: Review
- Else: Validated

### 16.3 Stats

Show:

- Review candidates
- Validated items
- Disputed items
- Used this week
- Average confidence

Stats must match API names exactly. Avoid the current mismatch where UI expects `stats.total` while service returns `totalKnowledge`.

Recommended shape:

```ts
interface LibraryStats {
  total: number
  review: number
  validated: number
  disputed: number
  rejected: number
  retired: number
  usedThisWeek: number
  averageConfidence: number
  byCategory: Record<LibraryCategory, number>
  bySourceType: Record<LibrarySourceType, number>
}
```

### 16.4 Item Card

Each list item should show:

- title
- short claim
- category
- status
- confidence
- source type
- updated date
- usage count
- dispute indicator if present

### 16.5 Detail View

Detail should show:

- title
- claim
- full body
- status
- category
- confidence
- tags
- source refs
- related agents
- validation history
- usage trail
- duplicate/merge suggestions
- prompt eligibility

### 16.6 Review Queue Actions

For `review` items:

- Accept
- Edit and accept
- Reject
- Mark disputed
- Merge with existing

Accept should be the primary action. Reject and dispute should require rationale.

### 16.7 Validated Item Actions

For `validated` items:

- Endorse
- Dispute
- Retire
- Merge
- Broadcast to Collective
- Copy prompt-safe summary

### 16.8 Disputed Item Actions

For `disputed` items:

- Resolve as validated
- Retire
- Merge
- Add evidence

### 16.9 Empty States

Review empty:

```text
No knowledge waiting for review.
Completed challenges, arena runs, profile analyses, and relationship updates can suggest candidates here.
```

Validated empty:

```text
No validated knowledge yet.
Accept review candidates or add a trusted item manually.
```

Disputed empty:

```text
No disputed knowledge.
Conflicts will appear here when agents or workflows challenge a claim.
```

### 16.10 Loading And Error States

The workspace must show:

- initial loading state
- filter loading state
- action pending state per button
- failed fetch state with retry
- failed action state with actionable error text

Do not rely only on `console.error`.

### 16.11 Accessibility

Requirements:

- semantic buttons for all actions
- keyboard reachable tabs
- visible focus states
- modal focus trapping
- `aria-label` for icon-only actions
- no hover-only critical information
- responsive text wrapping

### 16.12 Interaction And Pending-State Rules

Every user action must provide visible feedback. A button click must never look like nothing happened.

Required button states:

- idle
- pending
- success confirmation when useful
- failed with actionable error text
- disabled with reason when unavailable

Examples:

- `Accept` becomes `Accepting...` and disables only that item action row.
- `Reject` opens rationale modal, then shows `Rejecting...` during submit.
- `Create item` shows field validation before submit and `Creating...` during submit.
- `Refresh` shows a compact refresh indicator without blanking the whole workspace.
- `Load detail` shows a detail skeleton while keeping the list visible.

Rules:

- Do not clear the whole screen for item-level actions.
- Do not make unrelated buttons pending when one item action is running.
- Preserve the selected item when filters refresh unless it no longer exists in the result set.
- On failure, keep user input intact.
- Use optimistic UI only for reversible low-risk updates. Accept/reject/dispute/retire should wait for server success or show a clearly reversible pending state.

### 16.13 Long-Running Process UI

Any Library operation that can take more than a fast database write must show process state inside the relevant section.

This applies to:

- candidate extraction from a completed feature
- optional LLM extraction
- dedupe scan
- context retrieval before generation
- long-running downstream workflows that use Library context

Required process states:

```ts
type LibraryProcessStepStatus = 'pending' | 'running' | 'completed' | 'skipped' | 'failed'
```

Recommended UI pattern:

```text
Preparing Library candidates
  completed: Source output summarized
  running: Extracting reusable claims
  pending: Checking duplicates
  pending: Saving review candidates
```

The section that started the work owns the visible process feedback. For example:

- Challenge Lab shows Library candidate extraction as a final stage event after scoring.
- Arena shows Library extraction in the final report event stream.
- Profile shows Library extraction in the run progress/trace panel.
- Creative shows Library candidate creation after publish, not while drafting.
- Journal shows Library candidate creation after save/generation completion.
- Relationships shows Library candidate creation after synthesis completes.

If extraction is skipped, show a compact reason such as:

- `Library update skipped: no reusable claim found.`
- `Library update skipped: local model unavailable.`
- `Library update skipped: output quality failed.`

If extraction fails, the parent feature must still show its completed output and a non-blocking warning:

```text
Output saved. Library candidate extraction failed and can be retried from Library.
```

Do not leave long-running sections blank. Use staged progress, skeletons, event feeds, or trace panels that match the local feature's existing pattern.

### 16.14 Cross-Section UI Requirements

Library integration must update the UI of producer and consumer sections where the user needs to understand what happened.

Producer sections should show:

- whether Library candidates were created
- how many candidates were created
- link/button to open Library Review Queue
- skipped or failed extraction reason when applicable
- source-backed candidate summary when space allows

Consumer sections should show:

- whether Library context was used
- which validated items influenced the run
- a compact "Library context" disclosure or trace section
- usage recording status only when it fails or is useful for debugging

Required per-section UI updates by integration phase:

- Chat: if Library context is used, show a compact trace in any existing inspectable turn metadata panel. Do not clutter the normal chat bubble.
- Memory: add a "Promote to Library" affordance only for stable/high-value memories, not every memory row.
- Profile: show Library context and generated Library candidates in the run evidence/progress area.
- Challenge Lab: add Library extraction as a final event feed stage and show generated candidates in the completed run summary.
- Arena: add Library extraction to the debate/final report event feed and candidate summaries per participant.
- Relationships: show Library candidate creation in relationship synthesis provenance, not as a separate disconnected toast.
- Creative: after publish, show a candidate creation state and link to Review Queue.
- Journal: after save/generate, show candidate creation state only if candidates were created or extraction failed.
- Dreams: show candidate creation only for recurring-symbol promotion or explicit user save.
- Collective: show when a validation changes a Library item and link back to the Library detail.
- Timeline: show Library lifecycle events with source refs after Phase 4.

Every cross-section UI change must preserve the rebuilt workspace style: source-backed traces, clear status, no generic spinner-only blank states, and no hidden background mutation.

## 17. Workflow Integration Policy

### 17.1 Update Timing

Library data updates at exactly these moments:

1. Candidate creation after meaningful feature completion.
2. User or policy review action.
3. Cheap metadata/usage update after a workflow uses Library context.

Library must not update permanent trusted knowledge during live generation.

### 17.2 Feature Producer Policy

Each feature must decide whether candidate extraction is allowed. This is code policy, not LLM policy.

Default:

- completed high-signal run: may produce candidates
- ordinary render/load: never produce candidates
- failed/low-quality run: usually no candidates
- draft output: no candidates unless user explicitly saves
- published/saved artifact: may produce candidates

### 17.3 Section-by-Section Candidate Rules

#### Chat

Create candidates only when:

- user explicitly says to remember/save knowledge
- a stable user preference is stated clearly
- the system detects repeated behavior across multiple memories

Do not create candidates after every chat turn.

Candidate examples:

- "User prefers blunt feedback over encouragement."
- "Agent needs direct constraints before offering advice."

#### Memory

Create candidates when:

- multiple memory records support the same stable pattern
- a memory is manually promoted
- a recall/evaluation step identifies a durable lesson

Do not turn every memory into Library knowledge.

#### Emotions

Create candidates rarely.

Allowed only when:

- repeated emotional pattern is observed across time
- a profile/journal/challenge result supports the same pattern

#### Journal

Create candidates after:

- a saved journal entry
- a completed session with quality status passed or acceptable fallback

Limit:

- max 1 candidate per entry
- focus on recurring patterns or lessons, not one-off mood

#### Dreams

Create candidates rarely.

Allowed when:

- recurring symbol/theme appears across multiple dreams
- user explicitly promotes a dream insight

#### Creative Studio

Create candidates after:

- published creative artifact
- successful evaluation/repair pass
- user marks output as useful

Candidate focus:

- style preferences
- successful motifs
- format strengths

#### Profile

Create candidates after:

- profile run reaches ready/validated state
- trait has source refs and evidence

Candidate focus:

- stable traits
- risk patterns
- strengths/weaknesses

#### Challenge Lab

Create candidates after every completed challenge run if quality is not failed.

Limit:

- max 3 candidates per run
- prefer 1 strength, 1 weakness, 1 lesson

Candidate focus:

- demonstrated strengths
- demonstrated weaknesses
- constraint failures
- strategy lessons

#### Arena

Create candidates after completed arena/debate run.

Limit:

- max 2 candidates per participant

Candidate focus:

- debate role tendency
- argument quality
- evidence usage
- conflict behavior

#### Relationships

Create candidates only when relationship synthesis changes materially.

Candidate focus:

- trust change
- collaboration pattern
- conflict pattern
- relationship-specific strategy

#### Learning

Learning should mostly consume Library and produce candidates only for durable skill progression.

Candidate focus:

- learned skill
- repeated improvement
- unresolved weakness

#### Scenarios

Create candidates only after saved or completed scenario analysis.

Candidate focus:

- decision tendency
- risk under alternate branch
- useful strategy

#### Knowledge Graph

Knowledge Graph should not create new Library knowledge by default. It may surface related Library items and source refs.

#### Collective Intelligence

Collective should:

- read validated network Library items
- broadcast validated Library items
- apply endorsements/disputes to Library items

It should not bypass Library governance.

#### Mentorship

Create candidates after completed mentorship session.

Candidate focus:

- transferred skill
- mentor effectiveness insight
- mentee progress pattern

#### Timeline

Timeline should not create candidates. It should display Library item lifecycle events.

### 17.4 Downstream Consumption Policy

Other sections may request Library context before model calls.

Rules:

- retrieve only validated items by default
- limit to 3 items for local LLM baseline
- include short source summary
- include no raw private payloads
- record usage after the workflow uses the context
- feature must continue if Library retrieval fails

Recommended prompt block:

```text
Relevant validated knowledge:
1. [strength, 0.82] Agent performs better with explicit constraints.
   Source: Challenge Lab run "Decision Pressure", 2026-05-22.
2. [creative_style, 0.76] Agent's strongest creative drafts use reflective first person.
   Source: Creative artifact "Quiet Systems", 2026-05-25.

Use this only when relevant. Do not treat it as absolute if the current evidence contradicts it.
```

## 18. LLM Extraction Policy

### 18.1 Default Mode

Default extraction mode should be feature-dependent:

- Challenge Lab: deterministic + optional LLM
- Arena: deterministic + optional LLM
- Profile: deterministic from structured findings
- Relationships: deterministic from synthesis output
- Journal/Dream/Creative: optional LLM only after saved/published output
- Chat: disabled unless explicit save or repeated pattern

### 18.2 Extraction Prompt Requirements

LLM prompt must demand:

- max 1 to 3 claims
- no vague personality labels
- source-backed claims only
- no permanent conclusion from one weak event
- confidence score
- category from allowlist
- evidence summary
- no raw transcript copying

Suggested prompt contract:

```text
Extract up to 3 reusable Library knowledge candidates from this completed feature output.

Rules:
- Return JSON only.
- Each candidate must be specific, source-backed, and useful for future agent behavior.
- Do not create permanent personality judgments from one weak event.
- Do not include raw transcript text.
- Do not include secrets or private prompts.
- If there is no reusable knowledge, return an empty array.

Allowed categories:
fact, preference, behavior_pattern, strength, weakness, strategy, relationship,
creative_style, emotional_pattern, skill, risk, lesson
```

### 18.3 Output Validation

Reject candidate if:

- missing title, claim, body, category, source
- invalid category
- claim shorter than 20 chars
- body shorter than 40 chars
- confidence below 0.35
- confidence above 0.90 from LLM extraction
- source ref missing
- duplicate is very likely
- contains stack traces, env vars, or obvious secrets
- contains unsupported absolute claims like "always", "never" without evidence
- output parser fails

Malformed extraction should not fail the parent feature workflow.

### 18.4 Local LLM Guardrails

For local providers:

- lower candidate limit to 1 or 2 where needed
- keep extraction payload compact
- never pass full transcripts if a summary exists
- prefer structured feature summaries over raw model output
- skip extraction if provider is unavailable
- save a feature event that extraction was skipped only if useful for debugging

## 19. Dedupe And Merge

### 19.1 Dedupe On Create

Before saving a candidate:

1. Normalize claim.
2. Remove punctuation and stop words.
3. Hash normalized claim.
4. Search same agent/scope, same category, recent and high-confidence items.
5. If likely duplicate, attach candidate as source to existing item or mark possible duplicate.

Phase 1 can use simple lexical overlap. Do not add vector search unless separately approved.

### 19.2 Merge Behavior

When merging:

- source item gets `status = 'retired'`
- source item sets `mergedIntoItemId`
- target item keeps or improves confidence
- source refs are copied to target
- validation history remains auditable
- usage history remains attached to original and visible through related item trail

## 20. Impact On Other Sections

The Library can improve outputs, but only through bounded validated context.

### Chat

Impact:

- can recall validated preferences and stable behavior patterns

Limit:

- do not retrieve Library context for every trivial message if not needed
- prefer existing memory recall for immediate conversation context

### Memory

Impact:

- can promote stable memory patterns into Library
- can use Library to avoid storing duplicate semantic memories

Limit:

- Library is not a replacement for Memory

### Profile

Impact:

- can use validated Library items as evidence
- can produce review candidates from profile findings

Limit:

- profile must still cite direct evidence, not only Library claims

### Challenge Lab

Impact:

- can use validated weaknesses/strengths to configure challenge context
- produces high-signal candidates after completion

Limit:

- challenge scoring must not be biased solely by Library claims

### Arena

Impact:

- can use relationship and debate-style knowledge for participant context
- produces debate behavior candidates

Limit:

- validated Library context should not decide winners directly

### Relationships

Impact:

- can consume relationship Library items as historical context
- can create review candidates when trust/conflict materially changes

Limit:

- relationship state remains owned by relationship services

### Creative

Impact:

- can use creative style preferences and successful motifs
- can create candidates after publication

Limit:

- drafts do not auto-promote

### Journal

Impact:

- can use validated emotional patterns as context
- can create one candidate after saved high-quality entries

Limit:

- do not over-pathologize one entry

### Dreams

Impact:

- can use recurring symbols/patterns

Limit:

- rarely creates candidates

### Collective Intelligence

Impact:

- becomes the network search and broadcast layer over validated Library knowledge
- endorsements/disputes update Library validation records

Limit:

- Collective does not own Library persistence rules

### Timeline

Impact:

- displays Library lifecycle events

Limit:

- does not create or mutate Library items

## 21. Refresh And Performance Policy

Follow `docs/agent-tab-refresh-plan.md`.

Library tab policy:

- on open
- manual refresh
- stale refresh when relevant feature completes
- no live polling by default

Feature completion should return stale hints where applicable:

```json
{
  "changed": ["challenge"],
  "stale": ["timeline", "knowledge-library"]
}
```

Do not reload Library after every chat message. Only mark stale when a feature creates candidates or changes Library-relevant source data.

## 22. Security And Privacy

Rules:

- API routes validate all request bodies.
- Client cannot set trusted status for feature-generated candidates.
- Client cannot set confidence directly except through manual create/edit with server clamp.
- Provider secrets never leave server code.
- Raw provider payloads are not persisted unless sanitized and intentionally inspectable.
- Source quotes are short and optional.
- Do not store `.env`, stack traces, credentials, API keys, or private provider prompts.
- Prompt context API returns prompt-safe summaries only.
- Status transitions are server-side decisions.
- Retire/reject/dispute actions require rationale where appropriate.

## 23. Observability And Inspectability

The rebuild should expose:

- who/what created each item
- why it exists
- where evidence lives
- who accepted or disputed it
- when it was used
- which workflows consumed it
- why it is or is not prompt-eligible

Recommended internal debug fields:

- extraction mode
- extraction prompt version
- parser status
- validation errors/warnings
- dedupe match ids
- skipped extraction reason

Do not make debug fields dominate the UI. Surface them in compact detail sections.

## 24. Phased Implementation Plan

This rebuild should be divided into four phases. Do not attempt all phases in one PR unless the coding agent has enough budget and verification time.

### Phase 1: Foundation And Manual Knowledge Vault

Goal:

Create the new data model, repository, service, API, and rebuilt UI without integrating every other feature yet.

Scope:

- Add Library types.
- Add PostgreSQL schema and migration.
- Add `LibraryRepository`.
- Add `LibraryService`.
- Add agent-scoped Library API routes.
- Add new `KnowledgeLibraryWorkspace` UI.
- Add manual create.
- Add review/validated/disputed/retired tabs.
- Add accept/reject/endorse/dispute/retire actions.
- Add item detail view with source, validation, and usage sections.
- Add button-level pending, success, failure, retry, and disabled states for all Library actions.
- Add skeleton/detail loading states that do not blank the entire workspace.
- Backfill existing `shared_knowledge` into new tables if useful.
- Keep old `/api/knowledge` untouched or compatibility-only.
- Replace Library tab rendering with new workspace.
- Update docs for workspace section and API.

Must not:

- wire every feature as candidate producer
- inject Library context into prompts yet
- add vector search
- add background jobs

Acceptance criteria:

- User can open Library tab.
- User can create manual review item.
- User can accept item into validated state.
- User can reject review item.
- User can dispute validated item.
- User can retire item.
- Stats match visible lists.
- Detail panel shows source and validation history.
- Existing shared knowledge rows are either migrated or explicitly ignored with documentation.
- Every Library action visibly changes UI state while pending and preserves input on failure.

Verification:

- `npm run lint`
- `npm run build`
- migration dry run or `npm run db:migrate` if local DB is expected
- manual API checks for bootstrap, create, action, detail

### Phase 2: Candidate Producers

Goal:

Let completed high-signal workflows suggest Library candidates without making them trusted automatically.

Initial producer priority:

1. Challenge Lab
2. Arena
3. Profile
4. Relationships
5. Creative published artifacts
6. Journal saved entries

Scope:

- Add `libraryCandidateExtractor`.
- Add deterministic candidate creation helpers.
- Add optional LLM extraction for selected workflows.
- Add candidate creation calls after completed workflows only.
- Add source refs to candidates.
- Add dedupe checks.
- Add stale hint `knowledge-library` when candidates are created.
- Add UI source badges and review queue grouping by source.
- Add producer-section progress UI for Library candidate extraction.
- Add producer-section links to the Library Review Queue.
- Add producer payload metadata for candidate status/IDs where useful.

Must not:

- create candidates from every chat turn
- block parent workflow if extraction fails
- save extracted candidates as validated by default
- leave parent feature UI blank or unchanged while a long extraction step is running

Acceptance criteria:

- Completed Challenge Lab run can create 1 to 3 review candidates.
- Completed Arena run can create review candidates per participant.
- Completed Profile run can create stable trait/strength/risk candidates.
- Relationship synthesis can create review candidates when material change exists.
- Candidate failures do not fail parent workflow.
- Review queue clearly shows source feature and source summary.
- Producer feature UI shows created/skipped/failed Library candidate status.

Verification:

- `npm run lint`
- `npm run build`
- relevant feature evaluator if prompts changed
- targeted manual run for at least one producer

### Phase 3: Context Consumption And Usage Tracking

Goal:

Allow other features to safely use validated Library knowledge as small prompt context.

Initial consumer priority:

1. Chat
2. Creative Studio
3. Journal
4. Profile
5. Challenge Lab
6. Arena
7. Relationships

Scope:

- Add context retrieval API/service.
- Add prompt-safe context packet builder.
- Add usage recording.
- Integrate consumers one by one.
- Limit context to validated items.
- Add feature-level flags so Library context can be disabled if it hurts local performance.
- Add usage trail in UI.
- Add consumer-section UI traces showing which Library items influenced a run.
- Add consumer payload metadata for context item IDs where useful.

Must not:

- inject review/disputed/retired items into prompts by default
- inject more than configured prompt budget
- fail parent workflow if Library retrieval fails
- hide Library influence from inspectable workflow traces

Acceptance criteria:

- Consumer can request top validated Library items.
- Prompt block is short and source-backed.
- Usage events are recorded.
- UI shows where item was used.
- Workflows still complete when Library retrieval fails.
- Consumer feature UI makes Library influence inspectable without overwhelming normal output.

Verification:

- `npm run lint`
- `npm run build`
- targeted feature tests/evaluators for every modified consumer
- manual local LLM run with and without Library context

### Phase 4: Governance, Network Integration, And Polish

Goal:

Make Library robust as the long-term knowledge governance layer.

Scope:

- Merge duplicate items.
- Supersede/retire outdated items.
- Add richer dispute resolution.
- Add Collective broadcast from validated items.
- Let Collective validations write `library_item_validations`.
- Add Timeline events for Library lifecycle transitions.
- Add advanced filters.
- Add related item suggestions.
- Add optional full-text index if needed.
- Update docs comprehensively.

Must not:

- add vector database without explicit approval
- add background auto-cleanup that mutates user data without review

Acceptance criteria:

- Duplicate candidates can be merged.
- Retired/superseded items no longer affect prompts.
- Collective can broadcast validated Library items.
- Disputes appear in both Library and Collective where relevant.
- Timeline can show Library events.
- Docs match final API and data model.

Verification:

- `npm run lint`
- `npm run build`
- API route checks
- migration checks
- manual UI test on desktop and mobile viewport

## 25. Implementation Order Inside Each Phase

For each phase, use this order:

1. Types and contracts.
2. Database schema and migration.
3. Repository methods.
4. Service lifecycle rules.
5. API routes.
6. UI state and components.
7. Cross-feature integration.
8. Docs update.
9. Verification.
10. Diff review for unrelated changes.

Do not start UI wiring before service and API contracts are stable.

## 26. Files Likely To Change

Phase 1 likely changes:

- `src/types/database.ts`
- `src/lib/db/schema.ts`
- `drizzle/*_library_rebuild.sql`
- `src/lib/repositories/libraryRepository.ts`
- `src/lib/services/libraryService.ts`
- `src/app/api/agents/[id]/library/route.ts`
- `src/app/api/agents/[id]/library/items/[itemId]/route.ts`
- `src/app/api/agents/[id]/library/items/[itemId]/actions/route.ts`
- `src/components/library/KnowledgeLibraryWorkspace.tsx`
- `src/components/library/*`
- `src/app/agents/[id]/page.tsx`
- `docs/workspace-sections/knowledge-library.md`
- `docs/features/network/shared-knowledge.md`
- `docs/api-reference.md`
- `docs/data-model.md`
- `docs/database/postgresql-schema.md`

Phase 2 likely changes:

- `src/lib/services/libraryCandidateExtractor.ts`
- `src/lib/services/challengeLabService.ts`
- `src/lib/services/arenaService.ts`
- `src/lib/services/profileAnalysisService.ts`
- `src/lib/services/relationshipOrchestrator.ts`
- `src/lib/services/creativityService.ts`
- `src/lib/services/journalService.ts`
- related API response stale hints
- producer feature UI components that need extraction progress/status:
  - `src/components/challenges/ChallengeLab.tsx`
  - arena/simulation components
  - profile viewer components
  - relationship workspace components
  - creative/journal publish or completion surfaces

Phase 3 likely changes:

- `src/lib/services/libraryContextService.ts`
- `src/lib/services/chatTurnService.ts`
- `src/lib/services/creativityService.ts`
- `src/lib/services/journalService.ts`
- `src/lib/services/profileAnalysisService.ts`
- `src/lib/services/challengeLabService.ts`
- `src/lib/services/arenaService.ts`
- `src/lib/services/relationshipOrchestrator.ts`
- consumer feature UI components that need Library context trace/disclosure

Phase 4 likely changes:

- `src/lib/services/collectiveIntelligenceService.ts`
- `src/app/api/collective-intelligence/route.ts`
- `src/lib/services/timelineService.ts`
- `src/components/collective/CollectiveIntelligencePanel.tsx`
- `src/components/timeline/TimelineExplorer.tsx`
- Library UI components
- docs

## 27. Testing Strategy

### Unit/Service Tests

Add tests for:

- status transitions
- confidence clamping
- candidate validation
- source ref validation
- dedupe matching
- context retrieval filtering
- usage recording
- merge/retire behavior

### API Tests Or Manual Route Checks

Cover:

- bootstrap
- create manual item
- accept/reject
- endorse/dispute
- retire
- get detail
- context retrieval
- usage recording

### UI Checks

Cover:

- empty states
- review queue
- validated list
- disputed list
- item detail
- action pending states
- error states
- mobile layout
- keyboard navigation
- per-button pending states
- failed action states that preserve input
- long-running extraction process states
- producer feature candidate-created/skipped/failed indicators
- consumer feature Library-context trace indicators

### Integration Checks

By phase:

- Phase 2: at least one completed Challenge run creates candidates.
- Phase 2: one failed extraction does not fail parent feature.
- Phase 2: producer UI shows extraction progress and final status.
- Phase 3: one consumer uses context and records usage.
- Phase 3: consumer UI shows which Library items influenced the run.
- Phase 4: one Collective validation appears in Library.

## 28. Acceptance Criteria For Entire Rebuild

The rebuild is complete when:

- Library tab is no longer a simple CRUD catalog.
- Library has review, validated, disputed, rejected, and retired lifecycle.
- Every item has source-backed evidence.
- Feature-generated knowledge enters as review, not trusted.
- Validated items can safely influence future outputs through bounded context retrieval.
- Usage is recorded cheaply.
- Local LLM performance is protected by limits and skip paths.
- UI exposes provenance, validation, confidence, usage, and status.
- UI shows loading, pending, skipped, failed, and completed states for every Library action and long-running Library-related process.
- Producer and consumer sections show Library integration status where it affects the user-visible workflow.
- Collective, Timeline, and relevant workflows integrate without bypassing Library rules.
- Existing docs match the implementation.

## 29. Open Questions

These do not block Phase 1, but should be decided before later phases:

1. Should manual user-created items default to `validated` or `review`?
   - Recommendation: offer both, default to `review`, with an explicit "Save as trusted" option.

2. Should network-scope Library items require user approval before broadcast?
   - Recommendation: yes.

3. Should rejected items be visible by default?
   - Recommendation: no; show through filter only.

4. Should candidate extraction be enabled for local LLM by default?
   - Recommendation: enable only for Challenge, Arena, Profile, and Relationships first.

5. Should the old `/api/knowledge` route be retired immediately?
   - Recommendation: keep compatibility in Phase 1, retire or redirect after all callers move.

6. Should Library support full-text search in Phase 1?
   - Recommendation: no; add only if bounded search feels insufficient.

## 30. Coding Agent Handoff

Start with Phase 1 only.

Implementation prompt:

```text
Implement Phase 1 of docs/features/network/knowledge-library-rebuild-prd.md.

Scope:
- Add Library types.
- Add PostgreSQL schema and migration.
- Add Library repository and service.
- Add agent-scoped Library API routes.
- Replace the Library tab with a new KnowledgeLibraryWorkspace.
- Support manual create, detail view, review, accept, reject, endorse, dispute, and retire.
- Implement required loading, pending, skipped, failed, retry, and empty states for the Library workspace.
- Backfill or explicitly document handling of existing shared_knowledge rows.
- Update docs touched by API/data/workspace changes.

Do not implement candidate producers, prompt context consumption, cross-section UI integration, Collective integration, Timeline integration, vector search, or background jobs in Phase 1.

Verification:
- npm run lint
- npm run build
- database migration verification if available
```
