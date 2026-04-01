# AGENTS.md

Shared operating instructions for AI coding agents working in this repository, including Codex, OpenCode, Antigravity, and similar tools.

## Scope

- Apply these instructions to every task in this repo unless the user explicitly overrides them.
- Treat this file as project-level guidance, not as a replacement for direct user requirements.
- Use it as a default decision framework when prompts are brief, ambiguous, or under-specified.

## Project Snapshot

- Product: `AGENT-PLAYGROUND`
- Purpose: an inspectable AI agent platform with personality, emotion, memory, creativity, mentorship, relationships, and multi-agent simulation features
- Stack: Next.js 15 App Router, React 19, TypeScript, Tailwind CSS v4, Firebase Firestore, Zustand, LangChain, Gemini, Groq, Ollama
- Main code areas include `src/app`, `src/components`, `src/stores`, `src/lib/services`, `src/lib/langchain`, `src/types`, and `docs/`.

## Engineering Quality Bar

- Operate with senior-level engineering judgment on every task, even when the user prompt is short.
- Prefer the smallest complete solution that solves the problem without creating architectural debt.
- Default to production-grade fixes over superficial patches or prompt-literal hacks.
- Preserve readability, debuggability, and maintainability over clever shortcuts.
- Reuse sound existing patterns before introducing new abstractions.
- Make decisions that will still hold up as agents, data volume, features, and contributors grow.

## Architecture Expectations

- Keep responsibilities in the correct layer.
- UI code should render state and handle interaction, not own business rules or persistence logic.
- Zustand stores should stay thin and coordinate API usage, caching, and local loading state.
- API routes should validate input, compose services, serialize responses, and protect trust boundaries.
- `src/lib/services` should remain the main home for reusable domain logic and Firestore behavior.
- `src/lib/langchain` and provider-specific integrations should stay isolated from presentation code where practical.
- Avoid duplicating the same business rule across components, stores, routes, and services.

## Cross-Layer Sync Contract

When one layer changes, review the dependent layers in the same task. Do not leave the system partially updated.

- If a frontend flow changes, review API payloads, loading states, empty states, error states, accessibility, and mobile behavior.
- If a store changes, review the API route contracts it calls and the components that consume its state.
- If an API route changes, review request validation, response types, services, frontend callers, and docs.
- If a service changes, review all routes, stores, and components that rely on it.
- If a shared type changes, update both producers and consumers together.
- If Firestore document shape changes, update serializers, parsers, defaults, counters, queries, compatibility with existing documents, and UI assumptions.
- If an LLM workflow changes, review prompt construction, provider fallback behavior, rate limits, persisted outputs, and the screens that surface the result.
- If setup or environment behavior changes, update `README.md` and the relevant docs in `docs/`.

## Data And Persistence Rules

- Respect the current Firestore-first architecture and free-tier constraints.
- Assume denormalized agent counters and summaries are intentional unless you verify otherwise.
- Be careful when changing collection names, subcollection names, stored summaries, or aggregate counters.
- Review both top-level collections and agent-scoped subcollections when changing persisted behavior.
- Maintain compatibility with older documents where practical, or clearly document migration requirements.
- Do not rely on expensive full-collection scans if a bounded query, cached value, or denormalized field can solve the problem more safely.

## LLM And Provider Discipline

- Minimize unnecessary model calls and keep request-time work bounded.
- Do not spread provider-specific logic across unrelated files when it can live in a shared helper or service boundary.
- Keep server-only credentials on the server side. Never expose Gemini, Groq, Firebase admin, or other secrets to the client.
- Treat Ollama as an optional local provider and do not assume it is always available in production.
- Design degraded behavior for missing keys, quota exhaustion, rate limits, timeouts, and malformed model responses.
- Preserve inspectability. If a workflow produces meaningful internal state, prefer storing structured results rather than only transient text output.

## Free-Tier And Platform Constraints

- Prefer free-tier, open-source, or self-hostable solutions whenever practical.
- Do not introduce paid services, premium-only dependencies, or always-on infrastructure unless the user explicitly approves it.
- Optimize for low Firestore reads and writes, low model usage, low bundle size, and minimal round trips.
- Prefer request-driven flows over cron jobs, workers, or background daemons unless explicitly required.
- Be conservative about memory use, server compute time, and cold-start impact.

## Implementation Standards

- Keep TypeScript types accurate and close to the domain.
- Avoid `any` unless there is a justified boundary that cannot be typed reasonably.
- Validate untrusted input at API and persistence boundaries.
- Do not trust client input for authorization, quota, or security-sensitive behavior.
- Handle errors explicitly and return actionable failure states.
- Centralize validation, serialization, defaults, and shared rules when they are reused.
- Add comments only when the reasoning is not obvious from the code itself.
- Preserve established naming, folder structure, and data flow unless there is a strong reason to improve them.

## Security And Secrets

- Never expose secrets in client code.
- Use `NEXT_PUBLIC_` environment variables only for values that are safe to expose.
- Sanitize and validate untrusted input before persistence or model usage.
- Avoid logging sensitive user data, raw provider payloads, API keys, or private configuration.
- Treat authorization, quota enforcement, and data integrity as server-side concerns.

## UX And Product Expectations

- Optimize for clear, responsive, inspectable product behavior.
- Always consider loading, empty, success, and error states for user-facing changes.
- Preserve basic accessibility: semantic markup, keyboard reachability, readable contrast, and understandable states.
- Avoid regressions in mobile layouts and narrow screens.
- Be cautious with expensive client renders, oversized payloads, and unnecessary refetching.
- Remember that this app surfaces internal agent state, not just final chat output. Do not simplify away inspectability without a reason.

## Documentation Expectations

- Update docs when behavior, setup, architecture, or developer workflow changes.
- Use the existing docs set in `docs/` instead of scattering new one-off notes.
- Update `README.md` for setup, usage, or environment changes.
- Update `docs/api-reference.md` for API contract changes.
- Update `docs/data-model.md` for Firestore shape or persistence changes.
- Update `docs/architecture.md`, `docs/features.md`, `docs/workflows.md`, or `docs/development.md` when the change affects those topics.
- Keep documentation aligned with the implementation in the same task.

## Verification

Before finishing meaningful code changes:

- Read the relevant files before editing.
- Run `npm run lint` at minimum.
- Run `npm run build` for non-trivial changes, especially when touching routing, types, configuration, shared logic, or persistence behavior.
- If a verification step is too expensive, blocked, or not run, state exactly what was not verified.
- Do not claim something is fixed without checking the relevant code path.

## Working Style

- Make assumptions explicit when they materially affect the solution.
- Prefer focused edits over broad refactors unless a broader change is clearly necessary.
- If you discover unrelated issues, note them briefly but do not derail the task unless they block correctness.
- If the requested approach is weak, unsafe, or unscalable, propose a better one and explain why.
- Explicit user instructions override this document.

## Definition Of Done

A task is not done until most of the following are true when applicable:

- The requested change is implemented end to end.
- Impacted frontend, API, service, type, and persistence layers were reviewed.
- Validation, serialization, defaults, and state flows were updated where needed.
- Free-tier and provider constraints were respected.
- Relevant documentation was updated when behavior or contracts changed.
- Verification was run, or verification gaps were stated clearly.
- The final handoff identifies the main files changed and the validation performed.
