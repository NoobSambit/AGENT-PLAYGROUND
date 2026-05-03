# Documentation Home

This docs set is organized around the product, the runtime architecture, the persisted data model, the API surface, and the major user workflows.

## Start Here

- [`getting-started.md`](./getting-started.md): local setup, env vars, runtime modes.
- [`architecture/README.md`](./architecture/README.md): runtime layers, service boundaries, persistence flow, and provider selection.
- [`workflows/README.md`](./workflows/README.md): how the major user and system flows actually execute.
- [`api/README.md`](./api/README.md): route groups, request/response behavior, and workflow contracts.
- [`data-model/README.md`](./data-model/README.md): canonical PostgreSQL storage model and table families.
- [`features/README.md`](./features/README.md): feature map grouped by product area.
- [`workspace-sections/README.md`](./workspace-sections/README.md): section-by-section manuals for every `/agents/[id]` tab plus the `/simulation` arena, with real route, service, repository, and schema mapping.
- [`development.md`](./development.md): repo conventions and migration-era development rules.

## Feature Docs

Use [`features/README.md`](./features/README.md) as the main index for per-feature files under [`docs/features/`](./features/).

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
