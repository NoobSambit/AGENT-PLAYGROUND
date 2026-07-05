# Shared Knowledge

## Purpose

Shared knowledge stores the legacy reusable conclusions that older network callers can still promote and inspect.

It answers:

`What should be available to more than one agent?`

## UI Entry Point

- Deprecated compatibility UI only: `SharedKnowledgeLibrary` in `src/components/knowledge/SharedKnowledgeLibrary.tsx`.
- The current `/agents/[id]` Library tab uses `KnowledgeLibraryWorkspace` and the new `library_*` tables instead of this component.

## API Routes

- `GET|POST /api/knowledge`
- This route remains for old shared-knowledge compatibility.
- New Library workspace routes live under `/api/agents/[id]/library`.

## Ownership

- Service: `src/lib/services/knowledgeService.ts`
- Repository: `src/lib/repositories/knowledgeRepository.ts`
- Table: `shared_knowledge`
- Phase 1 backfill: `scripts/backfill-shared-knowledge-library.mjs`

## Data Shape

The main fields include:

- topic
- category
- content
- contributor id and name
- endorsements
- disputes
- access count
- last accessed time
- used-by agents
- tags
- confidence

## Workflow

1. An agent contributes knowledge.
2. The entry is stored with a confidence score.
3. Other agents can endorse or dispute it.
4. Access count and last accessed time track actual usage.
5. The collective intelligence layer can group it into repositories or referrals.

## Phase 1 Library Compatibility

- Existing `shared_knowledge` rows are not rewritten in place.
- Run `npm run db:backfill-library` to preview the copy plan into `library_items`, `library_item_sources`, and `library_item_validations`.
- Run `npm run db:backfill-library -- --apply` to insert missing Library rows.
- Backfilled records use `legacy_shared_${shared_knowledge.id}` as the Library item ID and preserve the original shared knowledge ID in `primarySourceId` and payload metadata.
- Legacy rows without disputes become validated network Library items; rows with disputes become disputed Library items.
- Backfilled records keep `qualityStatus='legacy_unvalidated'` until a later validation phase upgrades them.
- `/api/knowledge` continues to read and mutate `shared_knowledge`; the backfill does not redirect that route.
- Collective Intelligence now reads validated network Library items first and keeps `shared_knowledge` as compatibility input.
- Collective support/dispute actions on Library-backed cards write `library_item_validations`; support/dispute actions on legacy cards still mutate `shared_knowledge`.
- Timeline shows both legacy shared knowledge events and current Library lifecycle events.

## Failure Modes

- Search query too broad
- Low confidence contested entry
- Duplicate knowledge topic with different wording
- Drift between `shared_knowledge` and backfilled Library rows if old compatibility callers continue mutating `/api/knowledge` after the one-way backfill
