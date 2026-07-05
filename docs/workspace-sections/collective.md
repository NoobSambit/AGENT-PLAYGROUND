# Collective Intelligence

## 1. Purpose and user intent

The Collective Intelligence tab is the network-level reasoning view. It aggregates validated network Library knowledge, legacy shared knowledge, consensus signals, expert referrals, and broadcasts so an operator can see what the broader agent ecosystem knows about a topic.

## 2. UI entry points and key controls

- Entry point: `CollectiveIntelligencePanel` in `src/components/collective/CollectiveIntelligencePanel.tsx`.
- Key controls:
  - query box for network search
  - support/dispute validation buttons on relevant knowledge
  - Library detail links for Library-backed knowledge
  - per-item broadcast action for validated network Library items
  - broadcast topic and summary inputs
  - broadcast publish action
- The current tab is topic-driven rather than agent-history-driven.

## 3. End-to-end user workflow

1. Open the Collective tab.
2. The component requests `GET /api/collective-intelligence?agentId=<id>`.
3. The user enters a query and reruns the request with `query=<text>`.
4. The route builds a network snapshot from agents, validated network Library items, legacy shared knowledge, and recent broadcasts.
5. The user can validate knowledge through support or dispute actions. Library-backed validations append `library_item_validations`; legacy rows still mutate `shared_knowledge`.
6. The user can publish a manual broadcast or broadcast a validated network Library item.

## 4. Backend workflow/pipeline

1. `GET /api/collective-intelligence` loads all agents, validated prompt-eligible network Library items, legacy shared knowledge, and recent broadcasts.
2. `collectiveIntelligenceService.createSnapshot` derives:
  - repositories of grouped knowledge
  - relevant knowledge ranking
  - expert referrals
  - consensus snapshots
  - recent broadcasts
3. `POST /api/collective-intelligence` supports:
  - `broadcast`
  - `validate`
4. Broadcast writes flow through `BroadcastRepository` or Firestore `collective_broadcasts`.
5. Library-backed validation delegates to `LibraryService.recordCollectiveValidation`; legacy validation delegates to `KnowledgeService.endorseKnowledge` or `KnowledgeService.disputeKnowledge`.

## 5. API contract details

- `GET /api/collective-intelligence`
  - query params:
    - `query`
    - `agentId`
    - `limit`
  - success returns `CollectiveIntelligenceSnapshot`
  - Library-backed knowledge entries include `knowledgeSource`, `libraryItemId`, lifecycle metadata, and `libraryDetailHref`
- `POST /api/collective-intelligence`
  - `action: 'broadcast'`
    - requires `agentId`, `topic`, `summary`
    - optional `knowledgeId`
    - Library-backed broadcasts require a validated network Library item
  - `action: 'validate'`
    - requires `knowledgeId`, `agentId`, `verdict`
    - optional `rationale`
- Errors:
  - `400` for missing required fields or invalid action
  - `404` if broadcasting from a missing agent
  - `500` for unexpected failures

## 6. Data model mapping

- Tables:
  - `library_items`
  - `library_item_sources`
  - `library_item_validations`
  - `shared_knowledge`
  - `collective_broadcasts`
  - `agents` for referral heuristics and names
- Broadcast fields:
  - `agentId`, `topic`, `knowledgeId`, `createdAt`, `payload`
- Snapshot fields are derived only; there is no dedicated `collective_intelligence` table.

## 7. State transitions/lifecycle

- Snapshot generation is read-only and ephemeral.
- Broadcasts persist as durable network events.
- Library-backed knowledge validations persist through `library_item_validations`; legacy shared knowledge validations persist through `shared_knowledge`.

## 8. Quality gates/validation rules

- Broadcast creation validates that the broadcasting agent exists.
- Validation actions require a verdict of `support` or `dispute`.
- Collective can only broadcast Library items that are validated, prompt-eligible, and network-scoped.
- Referral and consensus scores are heuristic outputs from `CollectiveIntelligenceService`; they are not canonical rankings.

## 9. Failure modes and how they surface in UI/API

- Empty query returns a general snapshot with no referrals.
- Missing agent on broadcast: `404`.
- Broadcast persistence failure: `500`; current UI does not show a rich error state.
- Heuristic drift: referral and consensus scores can feel surprising because they rely on confidence, endorsements, agent stats, and topic-token overlap rather than explicit adjudication.

## 10. Debugging runbook

1. Inspect the raw snapshot from `/api/collective-intelligence`.
2. Compare relevant knowledge ranking against `LibraryRepository.listItems({ scope: 'network', status: 'validated' })` and `KnowledgeService.searchKnowledge`.
3. Inspect `library_item_validations` when Library-backed support/dispute actions do not appear in Library detail.
4. Inspect `collective_broadcasts` if recent broadcasts are missing.
5. If referrals look wrong, inspect the agent’s contributions and the scoring inputs in `CollectiveIntelligenceService`.

## 11. Operational checklist

- Verify a blank-load snapshot renders repositories, consensus, and broadcasts.
- Verify topic search adds referrals and relevant knowledge.
- Verify support/dispute actions refresh the snapshot.
- Verify Library-backed support/dispute actions appear in the Library validation history.
- Verify published Library broadcasts appear at the top of the broadcast list and link to the Library item.

## 12. How to extend safely

- Treat snapshot scoring as heuristic and keep it explainable.
- Persist only reusable primitives like broadcasts and knowledge validations, not the whole snapshot.
- If you change ranking math, keep the rationale text in sync so operators can understand why a referral was surfaced.
- Do not let Collective bypass Library lifecycle rules; add new Library mutations through `LibraryService`.

## 13. Code references

- `src/app/api/collective-intelligence/route.ts`
- `src/lib/services/collectiveIntelligenceService.ts`
- `src/lib/services/knowledgeService.ts`
- `src/lib/services/libraryService.ts`
- `src/lib/repositories/libraryRepository.ts`
- `src/lib/repositories/broadcastRepository.ts`
- `src/components/collective/CollectiveIntelligencePanel.tsx`
- `src/lib/db/schema.ts`
