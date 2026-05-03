# Mentorship

## 1. Purpose and user intent

The Mentorship tab manages mentor-mentee relationships, compatibility matches, focus areas, generated lessons, and completion-driven progress updates.

## 2. UI entry points and key controls

- Entry point: `MentorshipHub` in `src/components/mentorship/MentorshipHub.tsx`.
- Key controls:
  - mentoring/learning/find tabs
  - start mentorship modal
  - focus-area selection
  - generate lesson action
  - update status action
- The UI loads mentorships, stats, and suggested matches on mount.

## 3. End-to-end user workflow

1. Open the Mentorship tab.
2. The component loads:
  - `/api/mentorship?agentId=<id>`
  - `/api/mentorship?agentId=<id>&stats=true`
  - `/api/mentorship?agentId=<id>&findMatches=true`
3. The user starts a mentorship with `POST /api/mentorship` using `action: 'create'`.
4. The user can generate a lesson via `action: 'generate_lesson'`, which creates a session with LLM-generated lesson content.
5. The user can update status or complete sessions through route actions.
6. Completed sessions can emit relationship outcomes through `relationshipOrchestrator.applyMentorshipOutcome`.

## 4. Backend workflow/pipeline

1. `GET /api/mentorship` branches into stats, direct ID lookup, mentor matching, agent-specific mentorship list, or global list.
2. `MentorshipService.findMentorMatches` computes compatibility from traits, profiles, and communication style.
3. `POST /api/mentorship` supports actions such as `create`, `create_session`, `complete_session`, `change_focus`, `update_status`, `calculate_compatibility`, `generate_session_prompt`, and `generate_lesson`.
4. `generate_lesson` uses the selected provider through `generateText` to create a lesson, extracts exercises heuristically, then persists a new session.
5. `complete_session` updates objectives, XP, mentor effectiveness, mentee progress, and skills transferred.
6. On session completion, the route applies mentorship outcomes to the relationship layer.

## 5. API contract details

- `GET /api/mentorship`
  - query options:
    - `id`
    - `agentId`
    - `status`
    - `findMatches=true`
    - `stats=true`
- `POST /api/mentorship`
  - `action: 'create'` requires `mentorId`, `menteeId`, `focusAreas`
  - `action: 'create_session'` requires `mentorshipId`, `topic`, `lessonContent`
  - `action: 'complete_session'` requires `mentorshipId`, `sessionId`
  - `action: 'change_focus'` requires `mentorshipId`, `newFocus`
  - `action: 'update_status'` requires `mentorshipId`, `status`
  - `action: 'generate_session_prompt'` requires `mentorshipId`, `topic`
  - `action: 'generate_lesson'` requires `mentorshipId`, `topic`
- Edge cases:
  - `generate_lesson` fails with `500` if no provider is configured.
  - `change_focus` returns failure when the requested focus is not part of the mentorship’s declared focus areas.

## 6. Data model mapping

- Primary table: `mentorships`.
- Key columns:
  - `mentorId`, `menteeId`, `status`, `currentFocus`, `createdAt`, `updatedAt`, `payload`
- Important payload fields used by the UI and service:
  - `focusAreas`, `sessions`, `totalSessions`, `completedSessions`, `mentorEffectiveness`, `menteeProgress`, `skillsTransferred`
- Side-effect table family:
  - relationship tables through `relationshipOrchestrator.applyMentorshipOutcome`
- Agent-level stats are surfaced from `agents.mentorshipStats` when available, but the main mentorship records live in `mentorships`.

## 7. State transitions/lifecycle

- Mentorship status can move among `active`, `completed`, `paused`, and `terminated`.
- Sessions start as created lessons and become completed when feedback/objective completion is recorded.
- Relationship side effects occur after successful session completion, not on session creation.

## 8. Quality gates/validation rules

- Required IDs and focus arrays are enforced by the route.
- `update_status` validates against a fixed list of allowed statuses.
- Mentor matching is heuristic; it is not a hard constraint and does not block manual creation.
- LLM-backed lesson generation requires provider configuration.

## 9. Failure modes and how they surface in UI/API

- Missing agent or mentorship: `404` on GET and some POST actions.
- Missing provider for `generate_lesson`: `500`.
- Invalid focus change or status: `400` or `500` depending on the branch.
- Current UI error handling is lightweight and mostly console-based.

## 10. Debugging runbook

1. Inspect `/api/mentorship?agentId=<id>` and `&stats=true`.
2. Inspect the `mentorships` row payload, especially sessions and status.
3. If lessons are blank or malformed, inspect the prompt path and provider configuration used by `generate_lesson`.
4. If relationship side effects are missing, trace `complete_session` and `relationshipOrchestrator.applyMentorshipOutcome`.

## 11. Operational checklist

- Verify mentorships, stats, and matches all load.
- Verify mentorship creation persists and appears under the right tab.
- Verify lesson generation creates a session and updates totals.
- Verify status changes and session completion persist.
- Verify mentorship completion can influence relationship state when intended.

## 12. How to extend safely

- Keep all persisted mentorship state inside the `Mentorship` payload and repository writes.
- If you add new focus areas, update service skill mappings, compatibility logic, and UI labels together.
- Surface stronger UI errors before adding more route actions; the API surface is already broad.

## 13. Code references

- `src/app/api/mentorship/route.ts`
- `src/lib/services/mentorshipService.ts`
- `src/lib/repositories/mentorshipRepository.ts`
- `src/components/mentorship/MentorshipHub.tsx`
- `src/lib/services/relationshipOrchestrator.ts`
- `src/lib/db/schema.ts`
