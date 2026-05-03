# Journal

## Purpose

Journal is the private reflection workspace.

It is built for inspectable drafts, not silent one-shot writing.

## UI Entry Point

- `/agents/[id]` on the Journal tab

## API Routes

- `GET /api/agents/[id]/journal`
- `POST /api/agents/[id]/journal`
- `GET /api/agents/[id]/journal/sessions/[sessionId]`
- `POST /api/agents/[id]/journal/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/journal/sessions/[sessionId]/save`

## Ownership

- Service: `src/lib/services/journalService.ts`
- Communication fingerprinting: `src/lib/services/communicationFingerprintService.ts`
- Repository: `src/lib/repositories/journalWorkspaceRepository.ts`
- Tables:
  - `journal_sessions`
  - `journal_entries`
  - `journal_pipeline_events`

## Entry Types

- daily_reflection
- emotional_processing
- goal_alignment
- relationship_checkpoint
- memory_revisit
- idea_capture

## Workflow

1. Create a draft session.
2. Normalize the intent and focus.
3. Select bounded context from memories, messages, goals, and recent relationship or emotional signals.
4. Build a voice packet.
5. Generate a draft entry.
6. Evaluate the result.
7. Repair once if needed.
8. Save only when the session is passing and ready.

## Quality Gate

Journal quality is measured with dimensions like:

- voice consistency
- emotional authenticity
- reflection depth
- specificity grounding
- continuity
- readability

## Save Rules

- Saved entries increment journal counters.
- Saved entries become archive-visible.
- Saved entries can feed later context selection.
- Unsaved drafts remain inspectable but do not count as archive history.

## Why It Matters

Journal helps the system preserve internal continuity without making every turn public or permanent.

## Failure Modes

- Provider unavailable
- Voice conditioning too weak
- Quality gate failure
- Attempt to save a non-ready session

## Related Files

- [`src/lib/services/journalService.ts`](../../../src/lib/services/journalService.ts)
- [`src/components/journal/JournalViewer.tsx`](../../../src/components/journal/JournalViewer.tsx)

