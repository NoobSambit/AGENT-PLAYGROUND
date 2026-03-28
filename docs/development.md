# Development Guide

This guide replaces the old scattered contributor notes with one focused engineering reference.

## Engineering Expectations

The project expects production-minded changes.

That means:

- prefer the smallest complete fix
- keep types accurate
- validate input at API boundaries
- avoid duplicating business logic across UI and routes
- think across layers, not only inside one file

## Repository Shape

Important directories:

- `src/app`: pages and API routes
- `src/components`: feature and UI components
- `src/lib/services`: business logic
- `src/lib/langchain`: model orchestration helpers
- `src/stores`: Zustand state
- `src/types`: shared types

## Working Style

1. Read the relevant implementation first.
2. Change the smallest useful surface.
3. Update all dependent layers touched by the change.
4. Verify before finishing.
5. Update docs if behavior or architecture changed.

## Cross-Layer Checklist

When you change one layer, check the others.

- API change: update UI callers, route validation, and docs
- type change: update producers and consumers together
- Firestore shape change: update counters, serializers, queries, and UI assumptions
- frontend behavior change: check loading, empty, error, accessibility, and mobile states

## Verification

Minimum required for meaningful code changes:

```bash
npm run lint
```

Also run this for non-trivial work:

```bash
npm run build
```

If you could not run one of these, say so clearly in the final change summary.

## Environment And Cost Discipline

The project is intentionally free-tier friendly.

Prefer approaches that:

- reduce Firestore reads and writes
- avoid unnecessary LLM calls
- keep request-time work bounded
- do not require background workers

## Branch And Commit Guidance

Recommended branch prefixes:

- `feature/`
- `fix/`
- `docs/`
- `refactor/`
- `test/`
- `chore/`

Use commit messages that describe the real change, not just the file touched.

## Documentation Rule

If you add or materially change:

- a route
- a workflow
- a major feature
- a data shape
- a setup step

update the relevant file in `docs/` in the same change.
