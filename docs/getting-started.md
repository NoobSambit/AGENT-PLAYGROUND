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
