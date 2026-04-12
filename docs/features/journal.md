# Journal

## Purpose

Journal is now a private session-based workspace rather than a one-shot writer. It creates reviewed drafts, persists live pipeline stages, and only saves entries after explicit user confirmation.

## UI Entry Points

- `/agents/[id]`

## API Routes

- `GET /api/agents/[id]/journal`
- `POST /api/agents/[id]/journal`
- `GET /api/agents/[id]/journal/sessions/[sessionId]`
- `POST /api/agents/[id]/journal/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/journal/sessions/[sessionId]/save`

## Ownership

- Services: `journalService`, `emotionalService`, `communicationFingerprintService`
- Tables: `journal_sessions`, `journal_entries`, `journal_pipeline_events`, `agents`
- Firestore mirrors: `agents/{id}/journal_sessions`, `journal_entries`, `journal_pipeline_events`

## Lifecycle

1. `POST /journal` creates a draft session and stores normalized compose input.
2. `POST /generate` runs the journal pipeline:
   - prepare bounded context
   - condition voice from persona, goals, profiles, emotion, and recent communication evidence
   - generate draft
   - evaluate against the six-dimension rubric
   - run one repair pass if the draft misses the gate
   - mark the session `ready` only when it passes
3. The client polls session detail while status is `generating` and renders the real stage rail from persisted pipeline events.
4. `POST /save` marks the final reviewed entry as saved, increments journal counters, updates emotional state, and makes the entry visible to archive and downstream consumers.

## Data Rules

- Allowed entry types: `daily_reflection`, `emotional_processing`, `goal_alignment`, `relationship_checkpoint`, `memory_revisit`, `idea_capture`
- Saved entries only:
  - increment `agents.journalCount`
  - increment `agent.stats.journalEntries`
  - appear in archive history
  - appear in timeline aggregation
  - feed downstream context consumers
  - trigger `emotionalService.processInternalAction`
- Failed sessions stay unsaved and can only be regenerated.
- The V2 rollout is intentionally destructive: legacy journal history is deleted instead of migrated.

## Quality Gate

- Dimensions: `voiceConsistency`, `emotionalAuthenticity`, `reflectionDepth`, `specificityGrounding`, `continuity`, `readability`
- Pass criteria:
  - overall score `>= 80`
  - no dimension below `70`
  - no hard-failure flags
- Hard-failure flags:
  - generic assistant phrasing
  - prompt or schema leakage
  - shallow filler
  - wrong entry-type behavior
  - contradiction with known agent state
  - poor context grounding

## Failure Modes

- provider missing or unavailable during generation
- evaluator still failing after one repair pass
- destructive cutover run without correct environment confirmation
