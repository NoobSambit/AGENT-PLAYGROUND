# Overview

## 1. Purpose and user intent

The Overview tab is the workspace landing state for a single agent. It gives an operator a compact read on identity, status, goals, counters, emotional lead, and high-level health before they move into deeper tabs.

## 2. UI entry points and key controls

- Entry point: the default `overview` tab inside `src/app/agents/[id]/page.tsx`.
- The tab rail is defined in `TAB_CONFIG` and switches local React state with `setActiveTab`.
- The page-level `LLMProviderToggle` affects later generation actions in Chat, Creative, Dreams, Journal, Profile, Challenges, and Arena. It does not trigger Overview-specific writes.
- Overview surfaces agent stats from `currentAgent.stats`, trait summaries, emotional summaries, and counter fields such as `memoryCount`, `relationshipCount`, `creativeWorks`, `dreamCount`, `journalCount`, `challengesCompleted`, and `challengeWins`.

## 3. End-to-end user workflow

1. Open `/agents/[id]`.
2. `useAgentStore.fetchAgentById` resolves the agent from `/api/agents?id=<agentId>` if it is not already cached.
3. The page normalizes fallback values with `agentStatsService.createDefaultStats`, `emotionalService.createEmotionalProfile`, and `emotionalService.createDefaultEmotionalState`.
4. The operator reviews health, goals, interaction totals, and current emotional posture.
5. The operator moves into a deeper tab based on what they want to inspect or change.

## 4. Backend workflow/pipeline

1. `GET /api/agents?id=<id>` calls `AgentService.getAgentById`.
2. `AgentService` chooses PostgreSQL or Firestore based on `getPersistenceMode()` and `readsFromPostgres()`.
3. `AgentService.normalizeAgent` repairs legacy emotional payloads through `normalizeEmotionFields`.
4. The normalized `AgentRecord` is returned to the page and reused by child tabs.
5. Chat bootstrap also loads `GET /api/messages?agentId=<id>` through `useMessageStore`, so the workspace shell has recent message context available even before the Chat tab is opened.

## 5. API contract details

- `GET /api/agents?id=<id>`
- Request params:
  - `id`: required for single-agent read.
- Success response:
  - `200` with `{ success: true, data: AgentRecord }`.
- Error response:
  - `404` with `{ success: false, error: 'Agent not found' }`.
  - `500` with `{ success: false, error: 'Failed to fetch agents' }`.
- Edge cases:
  - Missing `stats`, `emotionalProfile`, or `emotionalState` do not break the tab because the page builds defaults locally.
  - Legacy emotional payloads are reset to a dormant normalized shape by `AgentService`.

## 6. Data model mapping

- Primary table: `agents`.
- Fields read directly by Overview:
  - `id`, `name`, `persona`, `goals`, `status`, `createdAt`, `updatedAt`
  - `coreTraits`, `dynamicTraits`
  - `stats`
  - `emotionalProfile`, `emotionalState`, `emotionalHistory`
  - `memoryCount`, `totalInteractions`, `relationshipCount`, `creativeWorks`, `dreamCount`, `journalCount`, `challengesCompleted`, `challengeWins`
  - `psychologicalProfile`, `activeDreamImpression`, `mentorshipStats`
- Read path:
  - PostgreSQL: `AgentRepository.getById`.
  - Firestore compatibility: `agents` collection through `getAgentByIdFromFirestore`.
- Derived fields in UI:
  - `agentStats` fallback from `agentStatsService.createDefaultStats()`.
  - `agentTemperamentLead` from `emotionalService.getInfluentialEmotion`.
  - `temperamentRanking` from sorted `emotionalProfile.temperament`.

## 7. State transitions/lifecycle

Overview itself has no independent lifecycle. It mirrors agent lifecycle fields that are written elsewhere.

- `status` is stored on the agent record and changed through `PUT /api/agents` or higher-level services.
- Counters change as side effects of Chat, Creative, Dreams, Journal, Relationships, Challenges, and Mentorship workflows.
- Emotional state changes after chat and reflection workflows.

## 8. Quality gates/validation rules

- No Overview-specific gate exists.
- `GET /api/agents` only validates presence of `id` when a single agent is requested.
- Agent normalization enforces a valid emotional structure even for legacy documents.

## 9. Failure modes and how they surface in UI/API

- Missing agent ID or deleted agent: page stays unresolved until `fetchAgentById` returns `null`; downstream tabs generally render empty or loading states.
- Corrupt emotional payloads: repaired by `AgentService`; the UI will show dormant emotional state instead of failing.
- API failure: `useAgentStore.fetchAgentById` logs to console and returns `null`; the page remains sparse rather than crashing.

## 10. Debugging runbook

1. Call `/api/agents?id=<agentId>` directly and inspect the returned `AgentRecord`.
2. Verify `agents` row values in `src/lib/db/schema.ts` match the expected counters and timestamps.
3. Check `AgentService.normalizeEmotionFields` if the page keeps showing a dormant emotional state.
4. Confirm the workspace shell cached the right record in `useAgentStore`.
5. If only one counter is wrong, trace the section that owns that counter instead of patching Overview.

## 11. Operational checklist

- Verify `/agents/[id]` resolves the intended agent.
- Verify goals, status, counters, and last-updated timestamps render.
- Verify missing emotional/profile fields degrade safely.
- Verify switching to deeper tabs reuses the same current agent record.

## 12. How to extend safely

- Add new high-level counters to `agents` only if a single owner updates them consistently.
- Keep Overview read-only; do not add business logic here that belongs in a service or route.
- If you add a new workspace tab with its own counter, update both `AgentRecord` and every writer that can mutate it.
- If you change emotional serialization, keep `AgentService.normalizeEmotionFields` backward compatible.

## 13. Code references

- `src/app/agents/[id]/page.tsx`
- `src/stores/agentStore.ts`
- `src/app/api/agents/route.ts`
- `src/lib/services/agentService.ts`
- `src/lib/services/agentStatsService.ts`
- `src/lib/services/emotionalService.ts`
- `src/lib/db/schema.ts`
