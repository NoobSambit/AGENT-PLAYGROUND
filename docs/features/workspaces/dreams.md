# Dreams

## Purpose

Dreams is a V2 workspace for symbolic, reflective, and sometimes unsettling agent dream generation.

It creates:

- draft sessions
- versioned dream artifacts
- pipeline trace events
- a bounded active dream impression

## UI Entry Point

- `/agents/[id]` on the Dreams tab

## API Routes

- `GET /api/agents/[id]/dream`
- `POST /api/agents/[id]/dream`
- `GET /api/agents/[id]/dream/sessions/[sessionId]`
- `POST /api/agents/[id]/dream/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/dream/sessions/[sessionId]/save`

## Ownership

- Service: `src/lib/services/dreamService.ts`
- Firestore compatibility: `src/lib/dream/firestoreStore.ts`
- Repository: `src/lib/repositories/dreamWorkspaceRepository.ts`
- Tables:
  - `dream_sessions`
  - `dreams`
  - `dream_pipeline_events`

## Dream Types

- symbolic
- nightmare
- memory_replay
- prophetic
- lucid
- recurring

## Session Lifecycle

1. Create a draft session.
2. Normalize compose input.
3. Build bounded context from persona, goals, emotions, memories, journal history, and saved dreams.
4. Generate the dream draft.
5. Extract symbols and latent tensions.
6. Evaluate the draft.
7. Repair once if needed.
8. Derive a preview impression.
9. Save only if the session passes the final gate.

## Quality Gate

Dream quality is measured with dimensions like:

- imagery vividness
- symbolic coherence
- psychological grounding
- agent specificity
- narrative clarity
- interpretive usefulness

Passing rules are strict:

- overall score must clear the threshold
- no dimension should fall below the floor
- hard-failure flags block saving

## Active Dream Impression

Saving a passing dream can write a bounded active dream impression to the agent record.

That impression can later tint chat behavior in a subtle way.

Important rules:

- it should be bounded
- it should expire
- it should not overwrite core identity
- it should not mutate learning state directly

## Data Model Notes

- Sessions keep `qualityStatus`, `repairCount`, `promptVersion`, and `latestStage`.
- Dreams keep artifact role, normalization state, quality score, source dream id, saved flag, and version.
- Pipeline events keep the real stage log.

## Failure Modes

- Missing provider
- Bad structured payload
- Quality gate failure
- Save attempted before ready
- Expired or missing active impression

## Related Files

- [`src/lib/services/dreamService.ts`](../../../src/lib/services/dreamService.ts)
- [`src/components/dreams/DreamJournal.tsx`](../../../src/components/dreams/DreamJournal.tsx)

