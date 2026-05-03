# Learning

## 1. Purpose and user intent

The Learning tab exposes the agent’s meta-learning state: active patterns, goals, adaptations, output-quality observations, and skill progression. It is an operator-facing view of how the system is learning from conversation outcomes.

## 2. UI entry points and key controls

- Entry point: `MetaLearningDashboard` rendered from the `learning` tab in `src/app/agents/[id]/page.tsx`.
- The current page only reads the workspace through `loadLearningData()` and passes the result into `MetaLearningDashboard`.
- The dashboard itself is read-only in the current workspace shell. Mutating POST actions exist on the route, but this tab does not expose them directly.

## 3. End-to-end user workflow

1. Open the Learning tab.
2. The page calls `GET /api/agents/[id]/learning`.
3. The route returns `state` and `skills` from `LearningService.getLearningState`.
4. The dashboard groups patterns by type, shows goals and adaptations, and visualizes skill progression.
5. If another workflow such as Chat creates new observations or patterns, reopening or refreshing the tab picks them up.

## 4. Backend workflow/pipeline

1. `GET /api/agents/[id]/learning` loads a composite state from `LearningService.getLearningState`.
2. `LearningService` reads patterns, goals, adaptations, observations, events, and skills from `LearningRepository` or Firestore subcollections.
3. The route optionally supports `filter=quality`, which narrows returned state to communication-style and problem-solving patterns plus output-quality observations.
4. `POST /api/agents/[id]/learning` supports mutation actions:
  - `analyze_conversation`
  - `generate_goals`
  - `update_skill`
  - `create_adaptation`
5. POST requests are rate-limited to 30 requests per 24 hours per agent through `RateLimitRepository` in PostgreSQL mode or a Firestore transaction fallback in Firestore mode.

## 5. API contract details

- `GET /api/agents/[id]/learning`
- Query params:
  - `filter=quality` optional.
- Success response:
  - `200` with `{ success: true, state: MetaLearningState, skills: SkillProgression[] }`.
- `POST /api/agents/[id]/learning`
- Shared behavior:
  - returns `429` with `X-RateLimit-Remaining: 0` when the daily window is exhausted.
  - returns `404` if the agent does not exist.
- Action contracts:
  - `analyze_conversation`: body requires `messages` array.
  - `generate_goals`: no extra required fields.
  - `update_skill`: requires `category`; optional `patterns`.
  - `create_adaptation`: requires `description`; optional `patternIds`.
- Error responses:
  - `400` on invalid action or missing required fields.
  - `500` if the learning operation fails.

## 6. Data model mapping

- Tables:
  - `learning_patterns`
  - `learning_goals`
  - `learning_adaptations`
  - `learning_events`
  - `learning_observations`
  - `skill_progressions`
  - `agent_rate_limits`
- Key fields:
  - patterns: `agentId`, `type`, `pattern`, `lastObserved`, `payload`
  - goals: `category`, `status`, `createdAt`, `targetDate`, `payload`
  - adaptations: `isActive`, `eventTimestamp`, `payload`
  - observations: `taskType`, `category`, `followUpStatus`, `createdAt`, `evaluatedAt`, `payload`
  - skills: `category`, `payload`
  - rate limit rows: `agentId`, `feature`, `count`, `windowStart`, `lastRequest`
- Firestore compatibility uses `agents/<id>/learning_*` subcollections and `agents/<id>/rate_limits/meta_learning`.

## 7. State transitions/lifecycle

- Observations typically move from pending follow-up to evaluated or adapted states inside `LearningService`.
- Goals and adaptations are durable records, not transient jobs.
- Skill progress is cumulative and keyed by `(agentId, category)`.

## 8. Quality gates/validation rules

- The route validates action names and required fields.
- Rate limiting is enforced before any POST action runs.
- Stable IDs are derived from agent and pattern keys for many learning records so repeated analysis updates instead of duplicating.

## 9. Failure modes and how they surface in UI/API

- Rate limit exhaustion: `429` with a human-readable message.
- Missing agent: `404`.
- Dashboard staleness: because the current tab is mostly read-only, learning mutations triggered elsewhere can appear delayed until refresh.
- Firestore transaction failure on rate limiting: the route falls back to a permissive `setDoc` path and still allows one request.

## 10. Debugging runbook

1. Inspect `GET /api/agents/[id]/learning` and compare the returned state to the dashboard.
2. Check `learning_observations` for fresh chat-derived observations if the tab looks stale.
3. Check `agent_rate_limits` or Firestore `rate_limits/meta_learning` when POST actions unexpectedly fail.
4. Verify skill rows in `skill_progressions` if the progression cards do not change.

## 11. Operational checklist

- Verify the dashboard loads with patterns, goals, and skills.
- Verify quality-only filtering returns only output-quality-relevant slices.
- Verify POST actions decrement the daily rate-limit budget.
- Verify pattern updates reuse the same stable pattern row when intended.

## 12. How to extend safely

- Add new learning record families through `LearningRepository` and `LearningService`, not directly in the route.
- Keep rate limiting per feature and per agent.
- If you expose POST actions in the UI later, surface `X-RateLimit-Remaining` and explicit error states.

## 13. Code references

- `src/app/agents/[id]/page.tsx`
- `src/app/api/agents/[id]/learning/route.ts`
- `src/lib/services/learningService.ts`
- `src/lib/services/metaLearningService.ts`
- `src/lib/repositories/learningRepository.ts`
- `src/components/learning/MetaLearningDashboard.tsx`
- `src/lib/db/schema.ts`
