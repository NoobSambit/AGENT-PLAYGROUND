# AGENT-PLAYGROUND

`AGENT-PLAYGROUND` is an inspectable AI agent platform built with Next.js, React, TypeScript, Firestore, and LLM-backed workflows.

It focuses on agents that have:

- persistent identity
- emotional and personality state
- memory and progression
- relationship and mentorship systems
- multi-agent simulation and shared knowledge workflows

## Quick Start

```bash
npm install
npm run dev
```

Create `.env.local` from `.env.example` before running feature flows that depend on Firebase or model providers.

## Documentation

The full documentation system now lives in [`docs/`](./docs/README.md).

Start here:

- [Documentation Home](./docs/README.md)
- [Getting Started](./docs/getting-started.md)
- [Feature Guide](./docs/features.md)
- [Architecture Guide](./docs/architecture.md)
- [Workflow Guide](./docs/workflows.md)
- [API Reference](./docs/api-reference.md)
- [Data Model](./docs/data-model.md)
- [Development Guide](./docs/development.md)

## Main Routes

- `/`
- `/dashboard`
- `/agents`
- `/agents/new`
- `/agents/[id]`
- `/simulation`

## Core Commands

```bash
npm run dev
npm run lint
npm run build
npm run db:reset -- --confirm-project=your_project_id
```

## Tech Stack

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS v4
- Firebase Firestore
- Zustand
- LangChain
- Google Gemini
- Groq

---

**Built with passion to create truly intelligent AI agents** ✨
