# Development Guide

## Commands

```bash
npm run lint
npm run build
npm run db:migrate
npm run db:export-firestore -- --out=./tmp/firestore-export.json
npm run db:backfill -- --input=./tmp/firestore-export.json --dry-run
npm run db:verify-parity -- --input=./tmp/firestore-export.json
```

## Persistence Rules

- Add new persisted features through repositories and services first.
- Keep Firestore fallback code limited to migration-era compatibility paths.
- Preserve stable API contracts while storage changes behind the route.
- Record mirror failures in `migration_outbox`; do not ignore them.

## Adding A New Feature

1. Add or extend the table in `src/lib/db/schema.ts` and the baseline SQL migration.
2. Add or extend a repository in `src/lib/repositories`.
3. Update the service layer.
4. Update routes and any affected stores.
5. Add or update the matching feature doc in `docs/features/`.

## Verification

- Run `npm run lint`.
- Run `npm run build` for non-trivial changes.
- If the change affects persistence, run `npm run db:verify-parity` against a representative export.
