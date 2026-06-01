# AGENTS.md

Shared operating instructions for AI coding agents working in `AGENT-PLAYGROUND`, including Codex, Claude Code, Cursor, OpenCode, Antigravity, and similar tools.

These instructions are intentionally tool-agnostic. If an agent-specific file also exists, this file is still the repository-level source of truth unless the user explicitly overrides it.

## Instruction Priority

Follow instructions in this order:

1. Direct user instructions in the current task.
2. Repository instructions in this file.
3. More specific instructions in nested `AGENTS.md` files, if present.
4. Existing code, docs, tests, and established project patterns.
5. General framework or library best practices.

When instructions conflict, obey the higher-priority instruction and call out the conflict if it affects correctness, safety, or scope.

## Project Snapshot

- Product: `AGENT-PLAYGROUND`.
- Purpose: an inspectable AI agent platform with persistent identity, personality, emotion, memory, creativity, mentorship, relationships, challenges, arena debates, and multi-agent simulation features.
- Runtime stack: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, PostgreSQL, Drizzle ORM, Zustand, LangChain, Gemini, Groq, Ollama.
- Migration support: Firebase Firestore and Firebase Admin remain for legacy runtime paths, export/backfill tooling, and dual-write cutover behavior.
- Canonical runtime persistence: PostgreSQL. Treat Firestore as legacy or migration mirror unless the current persistence mode or task explicitly requires otherwise.
- Main code areas: `src/app`, `src/components`, `src/stores`, `src/lib/services`, `src/lib/repositories`, `src/lib/db`, `src/lib/langchain`, `src/types`, `scripts`, `drizzle`, and `docs`.

## Core Agent Discipline

This repository follows the Karpathy-inspired agent workflow: think before coding, prefer simplicity, make surgical changes, and drive work through verifiable goals.

### Think Before Coding

- Do not silently guess when requirements, data shape, or control flow are ambiguous.
- State material assumptions before acting, especially when they affect API contracts, persistence, security, or product behavior.
- If multiple valid interpretations exist and the wrong choice would be costly, ask the user instead of implementing one silently.
- Push back when the requested approach is unsafe, brittle, expensive, or inconsistent with the architecture.
- If you are confused, stop and name the specific uncertainty. Do not hide confusion behind a broad implementation.

### Simplicity First

- Implement the smallest complete solution that solves the user goal.
- Do not add features, abstractions, configurability, dependencies, background jobs, or new infrastructure unless the task requires them.
- Do not build speculative extension points for hypothetical future work.
- Avoid single-use abstractions unless they materially improve clarity or correctness.
- If a solution starts becoming much larger than the problem, pause and simplify.

### Surgical Changes

- Touch only files needed for the task and dependent layers required by the cross-layer sync contract.
- Do not reformat, rename, rewrite, or "clean up" unrelated code.
- Match existing style and local patterns even if you would design them differently in a greenfield project.
- Remove imports, variables, functions, files, routes, migrations, and docs made obsolete by your own change.
- If you find unrelated dead code or bugs, mention them briefly instead of editing them unless they block the task.
- Every changed line should trace back to the user request, a direct dependency, or required verification cleanup.

### Goal-Driven Execution

- Convert vague tasks into clear success criteria before editing.
- For bugs, prefer reproducing the failure first, then fixing it, then verifying the fix.
- For refactors, preserve behavior and verify before and after when practical.
- For multi-step tasks, keep a short plan with an explicit verification step for each major change.
- Continue until the requested outcome is implemented and verified, or clearly state the blocker.

## Operating Workflow

Use this loop for non-trivial tasks:

1. Inspect the relevant files, docs, routes, types, schemas, and callers before changing anything.
2. Identify the owning layer and all dependent layers.
3. State assumptions or ask only the questions needed to avoid a bad implementation.
4. Make focused edits.
5. Update tests, docs, migrations, and examples when the behavior or contract changes.
6. Run the relevant verification commands.
7. Review the diff for accidental scope creep, unrelated edits, secrets, and stale docs.
8. Hand off with changed files, verification performed, and any residual risk.

For trivial tasks, use judgment. A typo fix does not need a long plan, but it still must avoid unrelated changes.

## Architecture Rules

- UI components render state, handle interaction, and expose clear loading, empty, success, and error states.
- UI components must not own business rules, persistence rules, provider selection, quota logic, or security-sensitive decisions.
- Zustand stores stay thin: coordinate API calls, local loading/error state, and cache refreshes.
- API routes validate input, enforce trust boundaries, compose services, serialize responses, and return actionable errors.
- Services own domain behavior, model orchestration, prompt construction, quality gates, ranking, counters, status transitions, and cross-entity side effects.
- Repositories own PostgreSQL reads and writes only. Keep SQL, Drizzle mapping, and transaction boundaries close to repository code.
- `src/lib/db` owns schema, migrations, connection setup, persistence mode helpers, and database-specific primitives.
- `src/lib/langchain`, `src/lib/llm`, and provider-specific code must stay isolated from presentation code.
- Shared types in `src/types` should describe stable contracts, not incidental implementation details.
- Avoid duplicating business rules across components, stores, routes, services, repositories, and docs.

## Cross-Layer Sync Contract

When one layer changes, inspect and update dependent layers in the same task.

- Frontend flow changes require review of API payloads, store state, loading states, empty states, error states, accessibility, and mobile behavior.
- Store changes require review of API route contracts, component consumers, cache invalidation, and stale loading/error paths.
- API route changes require review of request validation, response types, services, frontend callers, docs, and compatibility behavior.
- Service changes require review of routes, repositories, stores, components, and feature docs that rely on that service.
- Repository changes require review of Drizzle schema, SQL migrations, service callers, serialization, transactions, and query cost.
- Shared type changes require updating producers, consumers, fixtures, validation, docs, and legacy compatibility paths together.
- Persistence shape changes require migrations, serializers, parsers, defaults, counters, indexes, old-row compatibility, and UI assumptions.
- LLM workflow changes require prompt construction, provider fallback, timeout behavior, rate limits, malformed response handling, persisted trace output, and surfaces that render the result.
- Environment/setup changes require `README.md`, `docs/getting-started.md`, and `docs/development.md` updates where relevant.

Do not leave the app half-updated across layers.

## Persistence And Data Rules

- PostgreSQL is the canonical runtime store.
- Firestore is legacy support, migration input, or mirror path. Do not add new Firestore-first behavior unless explicitly required.
- Add new persisted features through `src/lib/db/schema.ts`, SQL migrations in `drizzle`, repositories, services, routes, stores, and docs.
- Keep Firestore IDs stable where preserved by existing migration behavior.
- Use text primary keys where existing tables do so for migration compatibility.
- Store query-critical fields in typed columns with indexes, not only in `jsonb`.
- Keep high-variance payloads in `jsonb` only when typed columns would create churn or excessive schema breadth.
- Avoid expensive full-table scans, unbounded relationship traversals, or client-side aggregation over large datasets.
- Prefer bounded queries, indexed lookups, persisted counters, denormalized projections, or rebuildable caches when they reduce read cost safely.
- Preserve legacy rows where practical. If old data cannot remain compatible, document the migration and user-visible behavior.
- Treat counters, derived stats, and status transitions as server-side concerns.
- Record mirror/outbox failures where the existing migration path expects them. Do not silently drop failed dual writes.

## LLM And Provider Rules

- Keep model calls bounded, intentional, and inspectable.
- Never expose Gemini, Groq, Ollama, Firebase Admin, database, or provider secrets to client code.
- Keep server-only provider logic behind API routes, services, or server utilities.
- Treat Ollama as optional local infrastructure. Production behavior must degrade when Ollama is unavailable.
- Handle missing keys, quota exhaustion, rate limits, timeouts, malformed JSON, low-quality output, and provider mismatch explicitly.
- Preserve existing provider fallback behavior unless the task is specifically to change it.
- Prefer structured persisted outputs for meaningful internal state: pipeline events, quality metadata, evidence refs, normalized artifacts, raw model output when safe, and final status.
- Do not store sensitive prompts, provider payloads, or user-private data unless the feature already requires inspectability and the data is sanitized appropriately.
- Avoid extra model calls in render paths, polling loops, or cache refreshes.

## Output Quality And Inspectability

This app is about inspectable agents, not opaque chat text. Preserve that product value.

- Do not simplify away pipeline traces, evidence refs, quality statuses, validation state, repair history, or source references.
- Use existing output-quality helpers in `src/lib/services/outputQuality` when adding or changing generation workflows.
- Keep draft, ready, blocked, saved, and published states semantically distinct.
- Respect explicit publish/save boundaries. Draft generation should not silently update long-term state unless that is already the workflow contract.
- Legacy or missing quality fields should surface as `legacy_unvalidated` where that is the documented contract.
- When final output depends on evidence, persist enough structure to explain why the agent changed.

## Security Rules

- Validate all untrusted input at API and persistence boundaries.
- Do not trust client input for authorization, quotas, counters, status transitions, provider choice, or security-sensitive behavior.
- Sanitize user-controlled text before persistence or model usage where injection or rendering risk exists.
- Never log secrets, raw credentials, API keys, private `.env` values, sensitive provider payloads, or private user data.
- Use `NEXT_PUBLIC_` only for values intentionally safe to expose in the browser.
- Keep Firebase Admin, database credentials, and provider keys server-only.
- Prefer explicit allowlists for action names, status values, route modes, provider IDs, and persistence mode handling.

## Frontend And UX Rules

- Preserve responsive behavior on desktop and narrow mobile screens.
- Use semantic markup and accessible controls.
- Ensure keyboard reachability for interactive UI.
- Provide clear loading, empty, success, blocked, and error states for user-facing flows.
- Prefer understandable, inspectable state over generic spinners.
- Avoid oversized client payloads, unnecessary refetching, and expensive renders.
- Keep components small enough to reason about, but do not split purely for aesthetics.
- Follow existing Tailwind v4 and component patterns before introducing new UI primitives.
- When a page surfaces internal agent state, show the relevant quality, evidence, status, or trace information rather than only the final prose.

## API Rules

- Validate method, params, query strings, and request body before calling services.
- Return stable, typed response shapes.
- Use appropriate status codes: `400` for invalid input, `404` for missing resources, `409` for blocked state transitions, `410` for retired legacy routes, and `500` only for unexpected failures.
- Include machine-readable error codes where existing routes do so.
- Do not leak internal stack traces, provider payloads, SQL errors, or secrets to clients.
- Keep backward compatibility when documented routes require it.
- Update `docs/api-reference.md` and the relevant `docs/api` files when contracts change.

## Repository And Database Rules

- Keep database reads and writes in repositories unless an existing feature-specific compatibility path has not been centralized yet.
- Use transactions for multi-row updates that must stay consistent.
- Keep idempotency in mind for retries, cancelled executions, mirror writes, and publish/save actions.
- Make migrations additive when possible.
- Do not rewrite historical payloads unless a migration explicitly owns that change.
- Index new query patterns intentionally.
- Keep reset, backfill, parity, and migration scripts dry-run-first when data loss or bulk mutation is possible.
- Do not run destructive database commands unless the user explicitly asks and the command includes the project’s confirmation flag.

## Documentation Rules

Update docs in the same task when behavior, setup, architecture, API contracts, persistence shape, or developer workflow changes.

- Use `README.md` for setup, commands, environment, and high-level usage.
- Use `docs/getting-started.md` for onboarding and local setup details.
- Use `docs/development.md` for developer workflow and verification.
- Use `docs/architecture.md` or `docs/architecture/` for runtime layer or design-rule changes.
- Use `docs/api-reference.md` and `docs/api/` for API contract changes.
- Use `docs/data-model.md`, `docs/data-model/`, and `docs/database/` for schema, migration, and persistence changes.
- Use `docs/features/` for feature behavior and ownership changes.
- Use `docs/workspace-sections/` when UI section behavior changes.
- Do not create scattered one-off notes when an existing docs area fits.

## Testing And Verification

Run verification that matches the risk of the change.

- Always read relevant files before editing them.
- For meaningful code changes, run `npm run lint` at minimum.
- Run `npm run build` for routing, type, configuration, persistence, API, shared logic, or non-trivial UI changes.
- Run targeted feature evaluators when changing their prompts, quality gates, or persisted output:
  - `npm run creative:evaluate`
  - `npm run profile:evaluate`
  - `npm run journal:evaluate`
  - `npm run dream:evaluate`
  - `npm run scenarios:evaluate`
- Run database verification when persistence changes:
  - `npm run db:migrate`
  - `npm run db:verify-parity -- --input=./tmp/firestore-export.json`
  - relevant dry-run backfill/export scripts when migration behavior changes
- If no automated test exists for a behavior, verify through code-path inspection and explain the gap.
- If a verification command is too expensive, blocked, or not run, state that clearly in the final handoff.
- Do not claim a fix is verified without running the relevant check or inspecting the exact path.

## Git And Workspace Rules

- The worktree may already contain user changes. Do not revert or overwrite changes you did not make.
- Check `git status --short` before and after meaningful edits.
- Do not use destructive commands such as `git reset --hard`, `git checkout --`, or broad file deletion unless the user explicitly asks.
- Do not amend commits unless explicitly requested.
- Avoid interactive git commands.
- Keep diffs small and reviewable.
- Do not commit generated artifacts, local database files, logs, `.env` files, caches, or temporary audit outputs unless the repository already tracks them intentionally.

## Dependency And Infrastructure Rules

- Prefer existing dependencies and platform capabilities.
- Do not add paid services, premium-only dependencies, hosted infrastructure, queues, cron jobs, workers, or daemons unless explicitly approved.
- Favor free-tier, open-source, self-hostable, and request-driven solutions.
- Consider bundle size, cold start impact, memory use, database query cost, and model-call cost.
- If a dependency is necessary, explain why the existing stack cannot solve the problem cleanly.

## Code Style Rules

- Keep TypeScript types accurate and close to the domain.
- Avoid `any` unless the boundary cannot be typed reasonably. Prefer narrowing unknown input.
- Keep validation, serialization, defaults, and shared domain rules centralized when reused.
- Use clear names over clever abstractions.
- Add comments only when the reasoning is not obvious from the code.
- Preserve established naming, folder structure, and data flow unless there is a strong reason to change them.
- Default to ASCII in new code and docs unless the file already uses non-ASCII or the content requires it.

## Review Mindset

When asked to review code, prioritize findings over summaries.

- List correctness bugs, regressions, security risks, data loss risks, API contract breaks, accessibility issues, missing tests, and migration hazards first.
- Include file and line references.
- Order findings by severity.
- If no findings are found, state that and mention residual testing gaps.
- Do not rewrite the code during a review unless the user asks for implementation.

## Task Handoff

Final responses should be concise and factual.

Include:

- What changed.
- Main files touched.
- Verification run.
- Anything not verified.
- Any follow-up the user should be aware of.

Do not include a long changelog when a short summary is enough.

## Definition Of Done

A task is done when the applicable items are true:

- The requested change is implemented end to end.
- Relevant frontend, store, API, service, repository, type, persistence, and docs layers were reviewed.
- Validation, serialization, defaults, counters, quality state, and status flows were updated where needed.
- Security and server-only secret boundaries are preserved.
- Free-tier and provider constraints are respected.
- Legacy data compatibility or migration requirements are handled.
- Relevant docs are updated.
- Verification was run, or verification gaps are stated clearly.
- The final handoff identifies the main files changed and validation performed.
