# Documentation Home

This docs set is organized around operating the app, changing the codebase, and running the Firestore to PostgreSQL migration safely.

## Start Here

- [`getting-started.md`](./getting-started.md): local setup, env vars, runtime modes.
- [`architecture.md`](./architecture.md): service boundaries, route responsibilities, persistence flow.
- [`agent-tab-refresh-plan.md`](./agent-tab-refresh-plan.md): simple refresh model for live core state and lazy heavy tabs on the agent page.
- [`arena-creation-and-output-quality-report.md`](./arena-creation-and-output-quality-report.md): how arena was built, how debate quality was hardened, and what still limits output quality.
- [`data-model.md`](./data-model.md): canonical PostgreSQL storage model.
- [`api-reference.md`](./api-reference.md): route contracts and major query modes.
- [`workflows.md`](./workflows.md): common operator and cutover workflows.
- [`development.md`](./development.md): repo conventions and migration-era development rules.

## Feature Docs

Use [`features.md`](./features.md) as the index for per-feature files under [`docs/features/`](./features/).

Each feature file documents:

- purpose
- UI entry points
- API routes
- service and repository ownership
- PostgreSQL tables
- read and write lifecycle
- workflow details
- update timing
- scenario-based examples
- limits, provider dependencies, and failure modes

## Database Docs

- [`database/postgresql-schema.md`](./database/postgresql-schema.md)
- [`database/firestore-to-postgres-mapping.md`](./database/firestore-to-postgres-mapping.md)
- [`database/cutover-runbook.md`](./database/cutover-runbook.md)
