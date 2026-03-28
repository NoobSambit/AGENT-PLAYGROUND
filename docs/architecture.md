# Architecture Guide

This guide explains how the application is put together in production terms: what lives where, how requests move, where data is stored, and which layers own which responsibilities.

## High-Level Shape

The app follows a layered full-stack pattern built on the Next.js App Router.

```text
UI Pages and Components
  -> Zustand client stores
  -> Next.js API routes
  -> Service layer
  -> Firebase Firestore and external LLM providers
```

## Main Layers

### 1. Presentation layer

Location:

- `src/app`
- `src/components`

Responsibilities:

- route rendering
- user interaction
- loading, empty, and error states
- feature-specific visualizations such as relationship graphs and neural activity views

Examples:

- [src/app/dashboard/page.tsx](/home/noobsambit/Documents/AGENT-PLAYGROUND/src/app/dashboard/page.tsx)
- [src/app/agents/[id]/page.tsx](/home/noobsambit/Documents/AGENT-PLAYGROUND/src/app/agents/[id]/page.tsx)
- [src/app/simulation/page.tsx](/home/noobsambit/Documents/AGENT-PLAYGROUND/src/app/simulation/page.tsx)

### 2. Client state layer

Location:

- `src/stores`

Current stores:

- `agentStore`
- `messageStore`

Responsibilities:

- hold client-side collections and loading state
- call API routes
- keep UI state in sync with backend responses

The stores are intentionally light. They orchestrate calls and cache results, but business logic stays mostly in the API and service layers.

### 3. API layer

Location:

- `src/app/api`

Responsibilities:

- validate request input
- coordinate multiple service calls
- apply rate limiting where needed
- serialize responses for the frontend
- isolate the client from direct persistence details

The API layer is where many cross-feature flows come together. A good example is `/api/multiagent`, which coordinates relationships, collective intelligence, conflicts, and saved simulations in one run.

### 4. Service layer

Location:

- `src/lib/services`

Responsibilities:

- own business logic
- encapsulate Firestore access
- compute domain-specific state
- provide reusable functions across routes and features

Important services include:

- `agentService`
- `messageService`
- `memoryService`
- `achievementService`
- `emotionalService`
- `relationshipService`
- `knowledgeService`
- `mentorshipService`
- `simulationService`
- `memoryGraphService`

### 5. LLM orchestration layer

Location:

- `src/lib/langchain`
- selected API routes that call Gemini or Groq directly

Responsibilities:

- build prompts
- invoke model providers
- support agent response generation and memory-aware flows

Important note:

The repository mixes LangChain-based orchestration and direct provider HTTP calls. That is part of the current architecture and should be treated as an implementation reality, not ignored in docs or future refactors.

### 6. Persistence layer

Location:

- Firestore through `src/lib/firebase.ts`

Responsibilities:

- persist core entities
- persist enhancement subcollections
- support query-based retrieval across agent lifecycle data

## Route Architecture

### UI routes

Key route groups:

- `/`
- `/dashboard`
- `/agents`
- `/agents/new`
- `/agents/[id]`
- `/simulation`

The agent workspace is the densest route because it acts as the main operating surface for one agent and aggregates multiple enhancement APIs.

### API routes

API routes are split into:

- core entity routes such as agents, messages, and memory
- cross-agent routes such as relationships, mentorship, conflicts, and simulations
- agent-scoped enhancement routes such as dreams, journals, profile, learning, memory graph, creative work, and neural activity

## Data Flow Patterns

### Pattern 1: single-agent interaction flow

```text
UI -> Zustand store -> /api/messages -> MessageService
   -> AgentService + EmotionalService + AchievementService
   -> Firestore
   -> updated message + updated agent returned to UI
```

This is the core operational loop for direct agent chat.

### Pattern 2: agent creation flow

```text
UI form -> /api/agents -> AgentService.createAgent()
        -> personality generation
        -> linguistic profile generation
        -> emotional baseline creation
        -> progress/stat defaults
        -> psychological profile generation
        -> Firestore agent document
```

### Pattern 3: simulation flow

```text
Simulation page -> /api/multiagent
                -> load agent state
                -> build prompts with relationship and consensus context
                -> run multi-round conversation
                -> analyze conflicts
                -> produce broadcasts and referrals
                -> save simulation record
```

## Firestore Structure

The app uses a combination of top-level collections and agent-scoped subcollections.

### Main top-level collections

- `agents`
- `messages`
- `memories`
- `simulations`
- `knowledge`
- `challenges`
- `mentorships`
- `memory_graphs`
- `collective_broadcasts`
- `conflicts`

### Agent subcollections

- `agents/{agentId}/relationships`
- `agents/{agentId}/creative_works`
- `agents/{agentId}/dreams`
- `agents/{agentId}/journal_entries`
- `agents/{agentId}/learning_patterns`
- `agents/{agentId}/learning_goals`
- `agents/{agentId}/learning_adaptations`
- `agents/{agentId}/learning_events`
- `agents/{agentId}/skill_progressions`
- `agents/{agentId}/rate_limits`

This split keeps core shared entities easy to query while still allowing feature-specific histories to stay local to an agent.

## Key Domain Design Decisions

### Agents are denormalized on purpose

The `AgentRecord` stores counters and summaries such as:

- `memoryCount`
- `relationshipCount`
- `creativeWorks`
- `dreamCount`
- `journalCount`
- `progress`
- `stats`

This avoids expensive recalculation on every screen load and fits the project’s free-tier-first constraint.

### Query fallback is built in

Some services catch Firestore missing-index errors and fall back to broader queries plus in-memory sort/filter.

This improves resilience during development but should not replace proper production indexing.

### Rate limiting is local to features

Some enhancement routes use per-agent rate limiting with Firestore-backed counters. This keeps expensive LLM-backed features bounded without needing background workers or external quota tooling.

### Inspectability is a first-class architectural concern

The app is designed to expose internal state, not just produce output. That is why so many features store structured records instead of only rendering ephemeral chat.

## State Ownership

### Frontend owns

- page-specific UI state
- transient loading and selection state
- local optimistic display where safe

### API and services own

- persistence rules
- derived agent updates
- rate limiting
- progression logic
- relationship and knowledge calculations

This boundary is important. It keeps the frontend simpler and prevents business logic from fragmenting across the stack.

## Runtime Dependencies

### Firebase

Used for:

- agent records
- conversations
- long-term memory
- enhancement histories
- rate limiting documents

### Gemini and Groq

Used for:

- response generation
- memory summarization
- dream generation
- journal generation
- some creative and simulation-related flows

### LangChain

Used where chain abstractions help with agent-oriented orchestration.

## What Makes This Architecture Different

The application is not a plain CRUD dashboard over LLM prompts.

Its architecture is shaped around three ideas:

- persistent agent state matters
- cross-agent behavior matters
- inspectability matters

That is why the architecture leans heavily on typed records, service modules, and route-level orchestration instead of keeping behavior purely inside UI components or ad hoc prompt calls.
