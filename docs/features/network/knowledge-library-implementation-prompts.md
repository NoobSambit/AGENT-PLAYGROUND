# Knowledge Library Implementation Prompts

Date: 2026-06-01

Primary PRD:

- `docs/features/network/knowledge-library-rebuild-prd.md`

Purpose:

This file stores ready-to-paste prompts for implementing the Knowledge Library rebuild with an AI coding agent. Use them in order. Do not try to implement the full PRD in one prompt.

Recommended rule:

- Run verification after each implementation prompt.
- Fix each phase before starting the next one.
- Do not let later prompts paper over earlier schema, API, or UI mistakes.
- Keep `AGENTS.md` and unrelated worktree changes untouched unless the user explicitly asks.

## Prompt 1: Impact Audit And Implementation Plan

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Read:
- AGENTS.md
- docs/features/network/knowledge-library-rebuild-prd.md
- docs/features/network/shared-knowledge.md
- docs/workspace-sections/knowledge-library.md
- docs/agent-tab-refresh-plan.md
- src/components/knowledge/SharedKnowledgeLibrary.tsx
- src/app/api/knowledge/route.ts
- src/lib/services/knowledgeService.ts
- src/lib/repositories/knowledgeRepository.ts
- src/lib/db/schema.ts
- src/app/agents/[id]/page.tsx

Task:
Produce an implementation impact audit for Phase 1 only.

Do not edit files.

Output:
- Current Library architecture summary.
- Exact files Phase 1 should touch.
- Data migration/backfill recommendation for existing shared_knowledge rows.
- API route plan.
- UI component plan.
- Loading/pending/error state plan.
- Verification plan.
- Risks and decisions that must be preserved for later phases.

Scope boundary:
Do not implement candidate producers, prompt context consumption, Collective integration, Timeline integration, vector search, or background jobs.
```

## Prompt 2: Phase 1A - Types, Schema, Migration, Repository

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Implement Phase 1A from docs/features/network/knowledge-library-rebuild-prd.md.

Scope:
- Add Library TypeScript types.
- Add PostgreSQL Drizzle schema for:
  - library_items
  - library_item_sources
  - library_item_validations
  - library_item_usage_events
- Add SQL migration.
- Add src/lib/repositories/libraryRepository.ts.
- Add row mappers and insert/update helpers.
- Add indexed queries needed by Phase 1 UI:
  - list by agent/status/category/source/search/sort
  - get item detail
  - insert item with source refs
  - add validation event
  - update item status/confidence/timestamps
  - list usage events

Rules:
- PostgreSQL is canonical.
- Keep Firestore out of the new repository unless compatibility is explicitly required.
- Do not change UI yet.
- Do not wire API routes yet except where required for type compilation.
- Do not touch unrelated files.
- Preserve existing shared_knowledge code for now.

Verification:
- Run npm run lint if the repo can lint without DB access.
- Run npm run build if the type/schema changes require it and the environment supports it.
- If migration verification is available, run the relevant migration check.

Final response:
- Files changed.
- Schema summary.
- Commands run.
- Anything blocked or not verified.
```

## Prompt 3: Phase 1B - Library Service And API Routes

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Implement Phase 1B from docs/features/network/knowledge-library-rebuild-prd.md.

Prerequisite:
Phase 1A should already exist.

Scope:
- Add src/lib/services/libraryService.ts.
- Add lifecycle methods:
  - bootstrap workspace
  - create manual item
  - get item detail
  - accept review item
  - reject review item
  - endorse item
  - dispute item
  - resolve dispute if simple enough for Phase 1
  - retire item
  - calculate stats
- Add agent-scoped API routes:
  - GET /api/agents/[id]/library
  - POST /api/agents/[id]/library/items
  - GET /api/agents/[id]/library/items/[itemId]
  - POST /api/agents/[id]/library/items/[itemId]/actions
- Validate request body and query params.
- Return stable typed response shapes.
- Use proper status codes:
  - 400 invalid input
  - 404 missing item/agent
  - 409 invalid transition
  - 500 unexpected failure
- Never expose stack traces, SQL errors, provider payloads, or secrets.

Rules:
- Feature-generated candidates are not in scope yet.
- Context retrieval for other features is not in scope yet.
- Old /api/knowledge can remain unchanged.
- Keep confidence math in the service, not the UI.

Verification:
- Run npm run lint.
- Run npm run build if route/type changes require it.
- Manually inspect API route contracts for invalid transition behavior.

Final response:
- Files changed.
- API contract summary.
- Verification run.
- Gaps or risks.
```

## Prompt 4: Phase 1C - Rebuilt Library Workspace UI

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Implement Phase 1C from docs/features/network/knowledge-library-rebuild-prd.md.

Prerequisite:
Phase 1B API routes should already exist.

Scope:
- Create src/components/library/KnowledgeLibraryWorkspace.tsx.
- Add supporting components as needed under src/components/library/.
- Replace the current Library tab usage in src/app/agents/[id]/page.tsx.
- Support:
  - Review tab
  - Validated tab
  - Disputed tab
  - Retired tab
  - search/filter/sort
  - stats strip
  - item list
  - selected item detail panel
  - source trail
  - validation history
  - usage trail
  - manual create modal
  - accept
  - edit and accept if feasible
  - reject with rationale
  - endorse
  - dispute with rationale
  - retire with rationale
- Add full UI state handling:
  - initial loading
  - filter refresh loading
  - detail skeleton loading
  - per-button pending states
  - success feedback where useful
  - actionable failed fetch/action state
  - retry
  - empty states for review/validated/disputed/retired
  - disabled states with reason

UI rules:
- Do not blank the whole workspace for item-level actions.
- Keep the list visible while detail loads.
- Preserve user input on failed create/edit/reject/dispute.
- Do not use generic spinner-only blank states for long waits.
- Use semantic buttons, keyboard-reachable controls, visible focus states, and accessible modals.
- Match existing Tailwind/component style.
- Avoid nested cards inside cards.

Scope boundary:
- Do not implement producer integrations.
- Do not inject Library context into other features.
- Do not add Collective or Timeline integration.

Verification:
- Run npm run lint.
- Run npm run build.
- If a dev server is practical, manually inspect desktop and mobile layout.

Final response:
- Files changed.
- UI behavior implemented.
- Verification run.
- Anything not verified.
```

## Prompt 5: Phase 1D - Backfill, Docs, And Phase 1 Hardening

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Complete Phase 1 hardening for the Knowledge Library rebuild.

Prerequisite:
Phase 1A, 1B, and 1C should already exist.

Scope:
- Decide and implement Phase 1 handling for existing shared_knowledge rows:
  - migration/backfill script, or
  - documented compatibility decision if backfill is deferred.
- Fix any API/UI/schema issues found during Phase 1 verification.
- Update docs:
  - docs/workspace-sections/knowledge-library.md
  - docs/features/network/shared-knowledge.md
  - docs/api-reference.md
  - docs/data-model.md
  - docs/database/postgresql-schema.md
- Ensure old /api/knowledge compatibility is documented.
- Ensure the Library tab no longer depends on SharedKnowledgeLibrary.

Verification:
- Run npm run lint.
- Run npm run build.
- Run database migration verification if available.
- Manually test:
  - create review item
  - accept item
  - reject item
  - dispute item
  - retire item
  - filter/search
  - detail load
  - failed action state if easy to simulate

Final response:
- Phase 1 completion status.
- Files changed.
- Verification run.
- Known risks before Phase 2.
```

## Prompt 6: Phase 2A - Candidate Extractor Core

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Implement Phase 2A from docs/features/network/knowledge-library-rebuild-prd.md.

Scope:
- Add src/lib/services/libraryCandidateExtractor.ts.
- Support deterministic extraction helpers.
- Support optional LLM extraction where the caller explicitly enables it.
- Add candidate validation:
  - required title/claim/body/category/source
  - valid category
  - minimum claim/body length
  - confidence clamp
  - source ref required
  - reject obvious secrets/stack traces
  - reject unsupported absolute claims when possible
- Add simple lexical dedupe before creating candidates.
- Save extracted candidates as status review only.
- Max 1 to 3 candidates per source by default.
- Extraction failure must not fail the parent workflow.
- Add typed metadata for:
  - created candidate IDs
  - skipped reason
  - failed extraction reason
  - extractor mode

Rules:
- Do not wire every producer yet.
- Do not create validated items automatically.
- Do not add vector search.
- Do not run LLM extraction during render.

Verification:
- Run npm run lint.
- Run npm run build.
- Add or run targeted service tests if the repo has an established test pattern.

Final response:
- Extractor behavior summary.
- Files changed.
- Verification run.
- Remaining producer work.
```

## Prompt 7: Phase 2B - Producer Integrations Part 1

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Implement Phase 2B producer integrations for high-signal workflows.

Prerequisite:
Phase 2A extractor should already exist.

Producer scope:
- Challenge Lab
- Arena
- Profile

Requirements:
- After completed high-quality runs, create Library review candidates.
- Do not create candidates from failed or low-quality outputs unless the PRD explicitly allows it.
- Add source refs with run/artifact IDs and short evidence summaries.
- Add stale hint knowledge-library when candidates are created.
- Add producer payload metadata where useful:
  - libraryCandidateStatus
  - libraryCandidateIds
  - libraryCandidateError
  - libraryCandidateCreatedAt
  - libraryCandidateExtractor
- Add visible process UI in each producer section:
  - pending/running/completed/skipped/failed candidate extraction stage
  - non-blocking warning if extraction fails
  - link/button to open Library Review Queue when candidates are created

UI rules:
- The parent feature output must remain visible even if Library extraction fails.
- Do not leave the section blank while extraction runs.
- Use the feature's existing event feed, trace panel, or progress UI pattern.

Verification:
- Run npm run lint.
- Run npm run build.
- Manually exercise at least one producer flow if practical.
- Confirm failed extraction does not fail the parent workflow.

Final response:
- Producers integrated.
- UI process states added.
- Verification run.
- Remaining producer work.
```

## Prompt 8: Phase 2C - Producer Integrations Part 2

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Implement Phase 2C producer integrations.

Prerequisite:
Phase 2B should already exist.

Producer scope:
- Relationships
- Creative published artifacts
- Journal saved entries
- Optional: Dreams only for explicit user promotion or recurring-symbol evidence
- Optional: Memory promote-to-Library affordance for stable/high-value memories

Requirements:
- Follow the PRD's section-by-section candidate rules.
- Do not create candidates from every ordinary chat turn, draft, dream, journal thought, or memory row.
- Add source refs and evidence summaries.
- Save candidates as review only.
- Add stale hint knowledge-library when candidates are created.
- Add producer payload metadata where useful.
- Add visible UI states:
  - created
  - skipped
  - failed
  - link to Library Review Queue

Rules:
- Creative creates candidates after publish, not while drafting.
- Journal creates at most 1 candidate per saved/high-quality entry.
- Relationships creates candidates only when synthesis changes materially.
- Dreams should be rare and explicit.
- Memory should expose promotion affordance selectively.

Verification:
- Run npm run lint.
- Run npm run build.
- Manually inspect at least one integrated producer UI.

Final response:
- Producers integrated.
- UI states added.
- Verification run.
- Any producers intentionally deferred.
```

## Prompt 9: Phase 2D - Producer Verification And Hardening

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Harden and verify Phase 2 candidate producer integrations.

Scope:
- Review all Phase 2 producer code paths.
- Confirm extraction is never called during render.
- Confirm parent workflows do not fail when candidate extraction fails.
- Confirm review candidates have source refs.
- Confirm candidates are never saved as validated by default.
- Confirm dedupe prevents obvious duplicates.
- Confirm UI shows created/skipped/failed states.
- Confirm stale hints include knowledge-library where appropriate.
- Fix issues found.

Verification:
- Run npm run lint.
- Run npm run build.
- Run relevant feature evaluators if prompts or generation workflows changed:
  - npm run creative:evaluate if Creative changed substantially
  - npm run profile:evaluate if Profile changed substantially
  - npm run journal:evaluate if Journal changed substantially
  - relevant Challenge/Arena manual verification if no evaluator exists

Final response:
- Phase 2 verification result.
- Fixes made.
- Commands run.
- Residual risks before Phase 3.
```

## Prompt 10: Phase 3A - Context Retrieval And Usage Tracking

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Implement Phase 3A from docs/features/network/knowledge-library-rebuild-prd.md.

Scope:
- Add Library context retrieval service or extend LibraryService cleanly.
- Add API route:
  - POST /api/agents/[id]/library/context
- Add usage tracking route:
  - POST /api/agents/[id]/library/usage
- Return prompt-safe context packet:
  - only validated items by default
  - bounded item count
  - bounded max chars
  - source summary included
  - no raw private payloads
- Record usage cheaply:
  - item IDs
  - consumer feature
  - consumer source ID when provided
  - query
  - relevance scores
- Update Library item aggregate fields:
  - usageCount
  - lastUsedAt

Defaults:
- limit 3
- maxChars 1200
- minConfidence 0.55
- status validated only

Rules:
- Retrieval failure must not fail downstream workflows.
- Do not return review/disputed/retired/rejected items by default.
- Do not add vector search.
- Do not integrate consumers yet except for small test hooks if needed.

Verification:
- Run npm run lint.
- Run npm run build.
- Manually inspect route validation and failure behavior.

Final response:
- Context API summary.
- Usage tracking summary.
- Verification run.
- Consumer integration remaining.
```

## Prompt 11: Phase 3B - Consumer Integrations

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Implement Phase 3B consumer integrations.

Prerequisite:
Phase 3A context retrieval and usage tracking should already exist.

Consumer scope:
- Chat
- Creative Studio
- Journal
- Profile
- Challenge Lab
- Arena
- Relationships

Requirements:
- Each consumer may request a small Library context packet before model calls where useful.
- Use validated items only by default.
- Keep context prompt block short.
- Continue workflow if Library retrieval fails.
- Record usage after context is used.
- Add consumer payload metadata where useful:
  - libraryContextStatus
  - libraryContextItemIds
  - libraryContextError
  - libraryUsageRecordedAt
- Add UI trace/disclosure:
  - which Library items influenced the run
  - compact source-backed display
  - hidden from normal chat bubbles unless an inspectable metadata panel exists

Rules:
- Do not inject Library context into every trivial chat message.
- Do not let Library context override current direct evidence.
- Do not use review/disputed/retired/rejected items unless a workflow explicitly asks for inspection.
- Do not hide Library influence from inspectable traces.

Verification:
- Run npm run lint.
- Run npm run build.
- Manually run at least one local LLM workflow with Library context enabled.
- Manually run at least one workflow with Library retrieval failure or no context and confirm it still completes.

Final response:
- Consumers integrated.
- UI traces added.
- Verification run.
- Performance concerns or skipped consumers.
```

## Prompt 12: Phase 3C - Local LLM Performance And Output Quality Verification

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Verify and harden Phase 3 Library context consumption for local LLM performance.

Scope:
- Review all consumer prompt additions.
- Confirm Library prompt blocks are compact.
- Confirm max item and max char limits are enforced.
- Confirm local model paths can skip Library context when needed.
- Confirm workflows still run when Library context is unavailable.
- Confirm UI shows Library context influence where required.
- Fix overly large prompts, noisy retrieval, or unclear UI trace output.

Verification:
- Run npm run lint.
- Run npm run build.
- Run relevant feature evaluators for changed consumers when available.
- Manually test with the local provider if available.
- Compare at least one run with Library context and one run without it.

Final response:
- Local LLM performance findings.
- Fixes made.
- Commands run.
- Residual risks before Phase 4.
```

## Prompt 13: Phase 4A - Governance, Merge, Retire, Supersede

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Implement Phase 4A governance features from docs/features/network/knowledge-library-rebuild-prd.md.

Scope:
- Add merge duplicate items.
- Add supersede/retire outdated item behavior.
- Add richer dispute resolution if not already complete.
- Preserve audit history.
- Copy or link source refs during merge.
- Keep usage history inspectable.
- Ensure retired/superseded items do not affect prompt retrieval.
- Add UI:
  - merge dialog
  - duplicate suggestions
  - superseded/merged indicators
  - dispute resolution panel

Rules:
- Do not mutate user data in background without explicit action.
- Do not add vector search.
- Do not delete audit history.

Verification:
- Run npm run lint.
- Run npm run build.
- Manually test merge, retire, supersede, and dispute resolution.

Final response:
- Governance features implemented.
- Verification run.
- Remaining Phase 4 work.
```

## Prompt 14: Phase 4B - Collective, Timeline, Docs, Final Verification

```text
You are working in /home/noobsambit/Documents/AGENT-PLAYGROUND.

Complete Phase 4B integration and final verification for the Knowledge Library rebuild.

Scope:
- Integrate Collective Intelligence:
  - read validated network Library items
  - broadcast validated Library items
  - write endorsements/disputes to library_item_validations
  - link Collective UI back to Library detail
- Integrate Timeline:
  - show Library lifecycle events
  - include source refs
  - show accept/reject/dispute/retire/merge/broadcast events where useful
- Update docs:
  - docs/features/network/knowledge-library-rebuild-prd.md if implementation differs
  - docs/features/network/shared-knowledge.md
  - docs/workspace-sections/knowledge-library.md
  - docs/api-reference.md
  - docs/data-model.md
  - docs/database/postgresql-schema.md
  - docs/features/network/README.md
- Remove or clearly deprecate old Library paths/components if no longer used.
- Review for stale imports, dead code, and route conflicts.

Final verification:
- npm run lint
- npm run build
- database migration verification if available
- manual UI test:
  - desktop
  - mobile
  - Review Queue
  - Validated items
  - Disputed items
  - action pending states
  - failed action states
  - producer-created candidates
  - consumer context traces
  - Collective validation
  - Timeline event

Final response:
- Full rebuild completion summary.
- Files changed by area.
- Verification commands and results.
- Known residual risk.
- Follow-up cleanup, if any.
```

## Optional Shorter 10-Prompt Version

Use this only if the coding agent has a large context window and strong repo awareness.

1. Audit and implementation plan.
2. Phase 1 DB/types/repository.
3. Phase 1 service/API.
4. Phase 1 UI.
5. Phase 1 verification/docs.
6. Phase 2 extractor plus Challenge/Profile/Arena producers.
7. Phase 2 remaining producers plus verification.
8. Phase 3 context retrieval plus usage tracking.
9. Phase 3 consumers plus local LLM verification.
10. Phase 4 governance, Collective, Timeline, docs, final verification.

The 14-prompt version is safer for this repo.
