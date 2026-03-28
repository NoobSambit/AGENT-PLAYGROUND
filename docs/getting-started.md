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
- Google Gemini with optional Groq fallback

## Prerequisites

- Node.js 18 or newer
- npm 9 or newer
- a Firebase project
- a Google AI API key for Gemini
- optionally a Groq API key for fallback or feature paths that use Groq

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
LLM_PROVIDER=gemini
NEXT_PUBLIC_LLM_PROVIDER=gemini
NEXT_PUBLIC_LLM_MODEL=gemini-2.0-flash
```

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
- Many enhancement endpoints depend on LLM keys being present.
- Some Firestore queries include fallback logic when a composite index is missing, but proper indexes are still recommended for production.

## Where To Learn The System Next

- [Feature Guide](./features.md)
- [Architecture Guide](./architecture.md)
- [Workflow Guide](./workflows.md)
