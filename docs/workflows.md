# Workflows

## Create A New Agent

1. Open `/agents/new`.
2. Submit name, persona, and goals.
3. The server derives personality, linguistic, emotional, progression, and profile state.
4. The agent record is persisted to PostgreSQL, or mirrored during cutover.

## Run Chat

1. Open `/agents/[id]`.
2. Send a message through the chat panel.
3. The server writes messages, updates emotional state, progression, and counters, then returns the refreshed agent snapshot.

## Generate Agent Content

1. Use the creative, dream, journal, or learning tabs on `/agents/[id]`.
2. Rate limits are checked server-side.
3. Generated output is persisted and reflected into agent counters and emotional state where applicable.

## Run Multi-Agent Simulation

1. Open `/simulation`.
2. Choose agents and a prompt.
3. The server generates turns, updates relationships, captures conflicts and broadcasts, then stores the final simulation record.

## Firestore To PostgreSQL Cutover

1. Apply schema with `npm run db:migrate`.
2. Export Firestore data.
3. Dry-run import into PostgreSQL.
4. Run full backfill.
5. Run parity verification.
6. Deploy with `PERSISTENCE_MODE=dual-write-firestore-read`.
7. Promote to `dual-write-postgres-read`.
8. Finish with `PERSISTENCE_MODE=postgres`.
