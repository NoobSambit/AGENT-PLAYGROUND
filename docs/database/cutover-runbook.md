# Cutover Runbook

## 1. Prepare PostgreSQL

1. Set `DATABASE_URL`.
2. Run `npm run db:migrate`.
3. Keep `PERSISTENCE_MODE=firestore` until import is verified.

## 2. Export Firestore

1. Provide Firebase admin credentials.
2. Run `npm run db:export-firestore -- --out=./tmp/firestore-export.json`.

## 3. Backfill PostgreSQL

1. Dry-run: `npm run db:backfill -- --input=./tmp/firestore-export.json --dry-run`
2. Execute: `npm run db:backfill -- --input=./tmp/firestore-export.json`

## 4. Verify Parity

1. Run `npm run db:verify-parity -- --input=./tmp/firestore-export.json`.
2. Resolve any count or counter mismatches before changing runtime mode.

## 5. Runtime Cutover

1. Deploy `PERSISTENCE_MODE=dual-write-firestore-read`.
2. Watch logs and `migration_outbox`.
3. Switch to `PERSISTENCE_MODE=dual-write-postgres-read`.
4. Re-run regression checks.
5. Move to `PERSISTENCE_MODE=postgres`.

## 6. Cleanup

- Keep Firestore export artifacts until rollback is no longer needed.
- Remove Firebase runtime dependence only after PostgreSQL-only mode is stable.
