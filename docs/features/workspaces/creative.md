# Creative Studio

## Purpose

Creative Studio turns an agent into an inspectable writing system.

It supports a structured creative brief, draft generation, rubric evaluation, one repair pass, and publication into a library.

## UI Entry Point

- `/agents/[id]` on the Creative tab

## API Routes

- `GET /api/agents/[id]/creative`
- `POST /api/agents/[id]/creative`
- `GET /api/agents/[id]/creative/sessions/[sessionId]`
- `POST /api/agents/[id]/creative/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/creative/sessions/[sessionId]/publish`

## Ownership

- Service: `src/lib/services/creativityService.ts`
- Repository: `src/lib/repositories/creativeStudioRepository.ts`
- Tables:
  - `creative_sessions`
  - `creative_artifacts`
  - `creative_pipeline_events`

## Supported Formats

- story
- poem
- song
- dialogue
- essay

## Session Lifecycle

### 1. Create a draft session

The brief is normalized, checked for enough detail, and saved as a session row.

### 2. Gather context

The service can pull from:

- persona
- goals
- linguistic profile
- psychological profile
- live emotional state
- emotional history
- recent messages
- recent memories
- recent journals
- saved dreams
- prior published motifs

### 3. Generate a draft

The first draft is stored as an artifact row, not just returned to the client.

### 4. Evaluate

The output is measured against the creative rubric.

### 5. Repair once

If the draft misses the gate, one bounded repair pass may run.

### 6. Publish

Only a passing ready artifact can be published.

## Quality Gate

Creative quality is evaluated with dimensions like:

- format fidelity
- originality
- voice consistency
- emotional coherence
- specificity
- readability

If the gate fails, the API should return the blockers instead of silently accepting the write.

## Data Model Notes

- Sessions store the brief, normalized brief, context packet, latest evaluation, provider, model, and status.
- Artifacts store versioned draft and final content, quality fields, lineage, and publication state.
- Pipeline events store the stage-by-stage trace so the UI can show real progress.

## Counter Rules

- Creative counters increment at publish time only.
- Draft generation should not count as a published work.

## Failure Modes

- Provider unavailable
- Rate limit reached
- Generated output leaks prompt or schema text
- Evaluation fails after repair
- Publish attempted before ready state

## Related Files

- [`src/lib/services/creativityService.ts`](../../../src/lib/services/creativityService.ts)
- [`src/components/creative/CreativeStudio.tsx`](../../../src/components/creative/CreativeStudio.tsx)

