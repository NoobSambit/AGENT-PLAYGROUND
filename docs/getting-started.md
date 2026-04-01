# Getting Started

This guide gets the app running locally and explains the minimum environment needed to use the main product flows.

## Stack Summary

- Next.js 15
- React 19
- TypeScript
- Tailwind CSS v4
- Firebase Firestore
- Zustand
- LangChain
- Google Gemini, Groq, or local Ollama models

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- a Firebase project
- either a Google AI API key, a Groq API key, or a local Ollama runtime

## Installation

1. Install dependencies.

```bash
npm install
```

2. Create `.env.local` from `.env.example`.

3. Fill in the required values.

## Environment Variables

### Firebase

These public variables are used by the client-side Firebase SDK:

```env
NEXT_PUBLIC_FIREBASE_API_KEY=
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=
NEXT_PUBLIC_FIREBASE_PROJECT_ID=
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=
NEXT_PUBLIC_FIREBASE_APP_ID=
```

The server can also read the non-public equivalents:

```env
FIREBASE_API_KEY=
FIREBASE_AUTH_DOMAIN=
FIREBASE_PROJECT_ID=
FIREBASE_STORAGE_BUCKET=
FIREBASE_MESSAGING_SENDER_ID=
FIREBASE_APP_ID=
```

### LLM configuration

```env
GOOGLE_AI_API_KEY=
GOOGLE_AI_MODEL=gemini-2.0-flash
GROQ_API_KEY=
GROQ_MODEL=llama-3-3-70b-versatile
OLLAMA_BASE_URL=http://127.0.0.1:11434
OLLAMA_MODEL=llama3.2
LLM_PROVIDER=gemini
NEXT_PUBLIC_LLM_PROVIDER=gemini
NEXT_PUBLIC_LLM_MODEL=gemini-2.0-flash
```

For a local Ollama setup, change the provider values to `ollama`, keep `NEXT_PUBLIC_LLM_MODEL` aligned with `OLLAMA_MODEL`, and make sure the model is already available locally, for example:

```bash
ollama pull llama3.2
```

After the app loads, use the provider toggle in the navigation or the main LLM workspaces to switch between Gemini, Groq, and Ollama. The selected provider is sent with LLM-backed requests so chat, simulations, creative generation, dreams, journals, challenges, and mentorship lessons all use the same choice.

## Run The App

```bash
npm run dev
```

Open `http://localhost:3000`.

## Minimum Smoke Test

After the app boots:

1. Open `/agents/new`
2. Create one agent
3. Open `/dashboard`
4. Open that agent workspace at `/agents/[id]`
5. Send a message
6. Open `/simulation` and confirm the page loads the roster

## Useful Commands

```bash
npm run dev
npm run lint
npm run build
npm run db:reset -- --confirm-project=your_project_id
npm run db:reset -- --execute --confirm-project=your_project_id
```

## Operational Notes

- The build script uses a split Next.js compile and generate flow.
- Many enhancement endpoints depend on one configured LLM provider being present.
- When using Ollama from a containerized or remote Next.js runtime, set `OLLAMA_BASE_URL` to a host the server process can actually reach.
- Some Firestore queries include fallback logic when a composite index is missing, but proper indexes are still recommended for production.

## Where To Learn The System Next

- [Feature Guide](./features.md)
- [Architecture Guide](./architecture.md)
- [Workflow Guide](./workflows.md)
