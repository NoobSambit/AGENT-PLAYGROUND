# Emotions

## 1. Purpose and user intent

The Emotions tab exposes the agent’s current emotional state, baseline temperament, and recent emotional events. It is for reading emotional causality, not for manually editing mood values.

## 2. UI entry points and key controls

- Entry point: `emotions` tab in `src/app/agents/[id]/page.tsx`.
- Main controls are read-only visualizations:
  - `EmotionRadar` in `live` mode for `emotionalState.currentMood`
  - `EmotionRadar` or `EmotionBars` in temperament mode for `emotionalProfile.temperament`
  - `EmotionTimeline` for recent `emotionalHistory`
- No dedicated mutation controls exist in this tab.

## 3. End-to-end user workflow

1. Open the Emotions tab.
2. The page reads `currentAgent.emotionalState`, `currentAgent.emotionalProfile`, and `currentAgent.emotionalHistory` loaded from `/api/agents`.
3. The operator inspects dominant live emotion, temperament ranking, and recent emotion events.
4. To change emotional state, the operator uses Chat, Dreams, or other upstream workflows that emit emotional events.

## 4. Backend workflow/pipeline

1. `GET /api/agents?id=<id>` loads the agent record through `AgentService.getAgentById`.
2. `AgentService.normalizeEmotionFields` repairs or resets malformed emotional payloads.
3. `emotionalService` derives display state such as dominant emotion, influential emotion, summaries, and color coding.
4. Chat and reflection workflows write new emotional events; this tab only reads them.

## 5. API contract details

- No dedicated emotions route exists for the workspace.
- The tab relies on `GET /api/agents?id=<id>` returning an `AgentRecord` with:
  - `emotionalProfile`
  - `emotionalState`
  - `emotionalHistory`
- Edge cases:
  - Missing or legacy fields are normalized by `AgentService` before the client sees them.
  - If `emotionalHistory` is empty, `EmotionTimeline` renders an empty-state message.

## 6. Data model mapping

- Primary table: `agents`.
- Fields read:
  - `emotionalProfile.temperament`, `sensitivity`, `resilience`, `expressiveness`, `optimism`
  - `emotionalState.currentMood`, `status`, `dominantEmotion`, `lastUpdated`
  - `emotionalHistory[]` including `emotion`, `phase`, `delta`, `intensity`, `confidence`, `source`, `trigger`, `linkedMessageId`, `linkedMemoryIds`, `evidenceRefs`, `downstreamHints`
- Derived UI data:
  - dominant temperament lead via `emotionalService.getInfluentialEmotion`
  - sorted temperament ranking via local `temperamentRanking`

## 7. State transitions/lifecycle

- Emotional lifecycle is event-driven.
- Typical path:
  - provisional appraisal during chat
  - finalized emotional state after response generation
  - event appended to `agents.emotionalHistory`
  - dormant state restored when no active signal dominates
- This tab itself does not introduce new states.

## 8. Quality gates/validation rules

- Normalization enforces a valid mood object and a consistent dormant fallback.
- Legacy emotional rows lacking `delta`, `source`, or `phase` are treated as requiring reset by `AgentService.normalizeEmotionFields`.

## 9. Failure modes and how they surface in UI/API

- Corrupt emotional payload: the UI falls back to dormant defaults.
- Empty emotional history: the timeline explicitly says there is no lived emotional activity yet.
- Upstream workflows fail to persist events: the current emotional posture will look stale even though the tab renders normally.

## 10. Debugging runbook

1. Inspect `GET /api/agents?id=<id>` and verify emotional fields.
2. Check whether `AgentService.normalizeEmotionFields` is resetting the payload.
3. Inspect the last few entries in `agents.emotionalHistory` for `phase`, `source`, `delta`, and `linkedMessageId`.
4. If emotional events are missing after chat, debug `chatTurnService` and `emotionalService.finalizeConversationTurn` instead of this tab.

## 11. Operational checklist

- Verify live emotion and temperament are both readable.
- Verify recent emotional events render with phase, intensity, and evidence hints.
- Verify empty-state rendering works when `emotionalHistory` is empty.
- Verify new chat turns visibly change the dominant emotional state when expected.

## 12. How to extend safely

- Keep emotional writes centralized in `emotionalService` and upstream workflows.
- If you add new emotion metadata, update `EmotionalEvent` typing and `EmotionTimeline` rendering together.
- Do not add direct client-side emotion mutation controls without a server-side owner.

## 13. Code references

- `src/app/agents/[id]/page.tsx`
- `src/lib/services/agentService.ts`
- `src/lib/services/emotionalService.ts`
- `src/components/emotions/EmotionRadar.tsx`
- `src/components/emotions/EmotionTimeline.tsx`
- `src/lib/db/schema.ts`
