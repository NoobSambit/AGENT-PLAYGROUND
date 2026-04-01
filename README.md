# AGENT-PLAYGROUND

`AGENT-PLAYGROUND` is an inspectable AI agent platform built with Next.js, React, TypeScript, PostgreSQL, Drizzle, and LLM-backed workflows.

The app centers on agents with persistent identity, emotional state, memory, relationships, mentorship, creativity, challenges, and multi-agent simulation features.

## Quick Start

```bash
npm install
npm run db:migrate
npm run dev
```

Create `.env.local` from `.env.example` before running the app. Runtime now uses `DATABASE_URL` and `PERSISTENCE_MODE`; Firestore admin credentials are only needed for export and backfill scripts.

## Core Commands

```bash
npm run dev
npm run lint
npm run build
npm run db:migrate
npm run db:export-firestore -- --out=./tmp/firestore-export.json
npm run db:backfill -- --input=./tmp/firestore-export.json --dry-run
npm run db:verify-parity -- --input=./tmp/firestore-export.json
npm run db:reset -- --confirm-reset
```

## Persistence Modes

- `firestore`: legacy runtime, Firestore only.
- `dual-write-firestore-read`: Firestore is primary for reads and writes; PostgreSQL mirrors writes.
- `dual-write-postgres-read`: PostgreSQL is primary for reads and writes; Firestore mirrors writes.
- `postgres`: PostgreSQL only.

## Documentation

The documentation set is in [`docs/`](./docs/README.md).

- [Documentation Home](./docs/README.md)
- [Getting Started](./docs/getting-started.md)
- [Feature Index](./docs/features.md)
- [Architecture](./docs/architecture.md)
- [Data Model](./docs/data-model.md)
- [API Reference](./docs/api-reference.md)
- [Workflows](./docs/workflows.md)
- [Development](./docs/development.md)
- [PostgreSQL Schema](./docs/database/postgresql-schema.md)
- [Cutover Runbook](./docs/database/cutover-runbook.md)

## Main Routes

- `/`
- `/dashboard`
- `/agents`
- `/agents/new`
- `/agents/[id]`
- `/simulation`

## Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS v4
- PostgreSQL
- Drizzle ORM
- Firebase Firestore and Firebase Admin for migration tooling
- Zustand
- LangChain
- Google Gemini
- Groq
- Ollama
