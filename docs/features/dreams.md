# Dreams

## Purpose

Dreams is now a V2 workspace rather than a one-shot generator.

It creates inspectable dream sessions, versioned dream artifacts, stored pipeline trace events, archive-only saved output, and a bounded active dream impression that can tint later behavior for 24 hours.

## Product Defaults

- dream generation is explicit user intent only
- compose stays minimal: type, optional note, optional focus chips
- generation is always review before save
- only saved, passing dreams affect counters, archive history, timeline visibility, downstream context, emotional side effects, and behavior tint
- legacy dream history is intentionally cleared during Dream V2 cutover

## UI Entry Points

- `/agents/[id]`
- Dreams tab

## API Routes

- `GET /api/agents/[id]/dream`
- `POST /api/agents/[id]/dream`
- `GET /api/agents/[id]/dream/sessions/[sessionId]`
- `POST /api/agents/[id]/dream/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/dream/sessions/[sessionId]/save`

## Ownership

- Services: `dreamService`, `emotionalService`, `chatTurnService`
- Repositories: `dreamWorkspaceRepository`
- Firestore compatibility: `src/lib/dream/firestoreStore.ts`
- Tables: `dream_sessions`, `dreams`, `dream_pipeline_events`, `agents.active_dream_impression`

## Runtime Model

- `dream_sessions` stores compose intent, selected context packet, latest evaluation, stage state, provider/model, and final dream linkage.
- `dreams` stores versioned draft, repaired, and saved artifacts for one session.
- `dream_pipeline_events` stores real stage transitions so the loading UI reflects actual backend progress.
- `agents.activeDreamImpression` stores the currently active bounded dream residue. It is replaced on new save and ignored after expiry.

## Pipeline

1. Create draft session.
2. Normalize compose input.
3. Gather bounded context from persona, goals, linguistic profile, psychological profile, live emotion, emotional history, recent messages, recent memories, saved journals, and saved dreams.
4. Generate dream draft.
5. Extract symbols and latent tensions.
6. Evaluate against the stored dream rubric.
7. Run one repair pass if needed.
8. Derive impression preview.
9. Return a ready or failed session for review.
10. Save only if the session passes.

## Quality Gate

Stored rubric dimensions:

- `imageryVividness`
- `symbolicCoherence`
- `psychologicalGrounding`
- `agentSpecificity`
- `narrativeClarity`
- `interpretiveUsefulness`

Pass rules:

- overall score at least `80`
- every dimension at least `70`
- no hard-failure flags

Hard-failure flags:

- `generic_fantasy_filler`
- `schema_leakage`
- `weak_symbolism`
- `disconnected_agent_context`
- `incoherent_scene_progression`
- `unusable_interpretation`

## Behavioral Bridge

- a dream impression is derived only on save
- the impression stores `sourceDreamId`, `summary`, `guidance`, `behaviorTilt`, `dominantThemes`, `createdAt`, and `expiresAt`
- the tilt mapping is bounded:
  - `symbolic` -> `reflective`
  - `nightmare` -> `cautious`
  - `memory_replay` -> `reflective`
  - `prophetic` -> `anticipatory`
  - `lucid` -> `agentic`
  - `recurring` -> `fixated`
- the impression must not mutate core traits or learning adaptations

## Downstream Effects

- save updates `dreamCount` and `stats.dreamsGenerated`
- save updates live emotional state through `emotionalService.processInternalAction`
- saved dreams appear in timeline aggregation
- active dream residue is injected into chat prompt assembly
- chat replies influenced by dream residue write `message.metadata.dreamImpression`
- creative and journal context selection can read saved dreams and active residue as low-weight signals

## Failure Modes

- no provider configured
- rate limit reached
- provider timeout or malformed output
- failing dream quality gate after one repair pass
- save attempted on non-passing or non-ready session
