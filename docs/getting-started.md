# Getting Started

## Prerequisites

- Node.js 20+
- PostgreSQL 15+
- Firebase project access only if you need export or parity checks against existing Firestore data
- One configured LLM provider for generation-heavy features

## Environment

Create `.env.local` from `.env.example`.

Runtime variables:

- `DATABASE_URL`
- `PERSISTENCE_MODE`
- `GOOGLE_AI_API_KEY` or `GROQ_API_KEY` or `OLLAMA_BASE_URL`

Migration-only variables:

- `FIREBASE_SERVICE_ACCOUNT_JSON`, or
- `FIREBASE_ADMIN_PROJECT_ID`
- `FIREBASE_ADMIN_CLIENT_EMAIL`
- `FIREBASE_ADMIN_PRIVATE_KEY`

## Local Boot

```bash
npm install
npm run db:migrate
npm run dev
```

`npm run dev` checks whether the local PostgreSQL instance in `DATABASE_URL` is reachable before starting Next.js. If it is down and the host is local, the script can initialize a repo-local PostgreSQL data directory, start PostgreSQL, run migrations, and later stop PostgreSQL for you.

Recommended `.env.local` values:

```bash
DATABASE_URL=postgresql://agent_playground:devpassword@127.0.0.1:5433/agent_playground
LOCAL_PG_DATA_DIR=~/.agent-playground/postgres/data
LOCAL_PG_LOG_FILE=~/.agent-playground/postgres/postgres.log
LOCAL_PG_SOCKET_DIR=~/.agent-playground/postgres/socket
```

If you prefer using an existing OS-managed PostgreSQL instance, set `LOCAL_PG_START_CMD` and `LOCAL_PG_STOP_CMD` instead.

## Recommended Migration Sequence

```bash
npm run db:migrate
npm run db:export-firestore -- --out=./tmp/firestore-export.json
npm run db:backfill -- --input=./tmp/firestore-export.json --dry-run
npm run db:backfill -- --input=./tmp/firestore-export.json
npm run db:verify-parity -- --input=./tmp/firestore-export.json
```

## Persistence Modes

- `firestore`: legacy mode. Use only before the backfill starts.
- `dual-write-firestore-read`: first deployment after schema creation and import.
- `dual-write-postgres-read`: read cutover while Firestore still mirrors writes.
- `postgres`: final mode after parity and regression checks are clean.
