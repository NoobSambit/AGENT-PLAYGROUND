# AGENTS.md

Shared operating instructions for AI coding agents working in this repository, including Codex, OpenCode, Antigravity, and similar tools.

## Scope

- Apply these instructions for every task in this repo unless the user explicitly overrides them.
- Treat this file as project-level guidance, not as a replacement for direct user requirements.
- Keep the format generic and plain Markdown so it remains usable across agent tools.

## Project Snapshot

- Product: `AGENT-PLAYGROUND`, an AI agent platform with personality, memory, emotion, creativity, and multi-agent features.
- Stack: Next.js 15, React 19, TypeScript, Tailwind CSS v4, Firebase/Firestore, Zustand, LangChain, Gemini, Groq.
- Architecture shape:
  - Frontend UI in `src/app` and `src/components`
  - API routes in `src/app/api`
  - Shared business logic in `src/lib/services`
  - LLM orchestration in `src/lib/langchain`
  - Shared types in `src/types`
  - Client state in `src/stores`

## Core Expectations

- Work like a senior software engineer: direct, practical, careful, and accountable.
- Prefer the smallest complete change that solves the problem without creating architectural debt.
- Use strong engineering judgment, not quick hacks.
- Favor maintainability, readability, debuggability, and long-term scalability over clever shortcuts.
- Reuse existing patterns before introducing new abstractions.
- Preserve consistency across naming, file structure, data flow, and UI behavior.
- Make decisions that remain solid as the codebase grows.

## Cross-Layer Change Rule

When one layer changes, check the dependent layers in the same task. Do not leave the system partially updated.

- If backend or API logic changes, review whether frontend screens, client state, shared types, validation, and docs must also change.
- If Firestore or data shape changes, update TypeScript types, serializers, deserializers, default values, affected queries, and any UI assumptions.
- If database behavior changes, review indexes, security rules, migrations, and compatibility with older documents if relevant.
- If frontend behavior changes, review API contracts, loading states, empty states, error states, accessibility, and responsiveness.
- If shared types or contracts change, update both producers and consumers together.
- If configuration or environment requirements change, update setup docs and examples in the same task.

## Free-Tier And Open-Source First

This project is intentionally built around free-tier infrastructure and open-source-friendly choices.

- Prefer free-tier, open-source, or self-hostable solutions whenever practical.
- Do not introduce paid services, premium-only dependencies, or vendor lock-in unless the user explicitly approves it.
- Optimize for low infrastructure usage:
  - minimize LLM calls
  - minimize Firestore reads and writes
  - minimize bundle size
  - minimize unnecessary server round trips
- Prefer client-side computation when it meaningfully reduces cost without hurting UX or security.
- Use caching, memoization, batching, and request deduplication where appropriate.
- Design for graceful degradation when quotas, rate limits, or external APIs fail.

## Platform Constraints

Design with the current project constraints in mind.

- Assume free-tier hosting constraints matter.
- Avoid solutions that require cron jobs, background workers, or always-on paid infrastructure unless explicitly requested.
- Keep request-time work bounded and performant.
- Prefer request-driven flows over background automation.
- Be conservative about memory use, cold-start impact, and long-running server work.

## Implementation Standards

- Keep TypeScript types accurate and close to the domain.
- Avoid `any` unless there is a clearly justified boundary that cannot be typed reasonably.
- Validate inputs at trust boundaries, especially in API routes and persistence paths.
- Do not trust client input for security-sensitive behavior.
- Handle errors explicitly and return actionable failure states.
- Avoid duplicated business logic across UI, API routes, and services.
- Add comments only where the reasoning is not obvious from the code itself.
- Respect existing abstractions and improve them instead of bypassing them.
- Prefer scalable patterns over one-off local fixes when the affected area is clearly reused.

## Performance, Reliability, And UX

- Optimize for real user experience, not synthetic complexity.
- Keep the UI responsive and predictable.
- Always consider loading, empty, success, and error states.
- Preserve accessibility basics: keyboard access, semantic markup, readable contrast, and clear states.
- Avoid regressions in mobile layouts and smaller screens.
- Be careful with expensive renders, heavy client bundles, and unnecessary network chatter.

## Security And Secrets

- Never expose secrets in client code.
- Keep server-only credentials on the server side.
- Use `NEXT_PUBLIC_` environment variables only for values that are safe to expose.
- Sanitize and validate untrusted input before persistence or model usage.
- Avoid logging sensitive user data, API keys, or private payloads.

## Verification

Before finishing meaningful code changes, verify them.

- Run `npm run lint` at minimum when code changes are made.
- Run `npm run build` for non-trivial changes, especially when touching routing, types, configuration, or shared logic.
- If a full verification step is too expensive or blocked, say exactly what was not verified.
- Do not claim something is fixed without checking the relevant code path.

## Documentation Expectations

Update docs when the change affects behavior, setup, architecture, or developer workflow.

- Update `README.md` for setup, usage, or environment changes.
- Update `API_REFERENCE.md` for API contract changes.
- Update architecture or feature docs when the design meaningfully changes.
- Keep documentation aligned with the actual implementation.

## Working Style

- Start by reading the relevant files before editing.
- Make assumptions explicit when they materially affect the solution.
- Prefer focused edits over broad, unnecessary refactors.
- If you find unrelated issues, note them briefly but do not derail the task unless they block correctness.
- If a requested approach is weak, unsafe, or unscalable, propose a better one and explain why.

## Definition Of Done

A task is not done until most of the following are true when applicable:

- The requested change is implemented end to end.
- Related frontend, backend, and data-layer impacts were reviewed.
- Relevant types, validation, and state flows were updated.
- Free-tier and open-source constraints were respected.
- Verification was run or any gap was stated clearly.
- Documentation was updated if needed.

