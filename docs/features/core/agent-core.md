# Agent Core

## Purpose

Agent Core owns the canonical agent record. It is the source of truth for identity, persona, goals, counters, trait baselines, emotional state, and deep profile state.

It answers the question:

`What is this agent, and what state should every other feature start from?`

## UI Entry Points

- `/agents`
- `/agents/new`
- `/agents/[id]`

## API Routes

- `GET /api/agents`
- `POST /api/agents`
- `GET /api/agents/[id]`
- `PATCH /api/agents/[id]`

## Ownership

- UI: roster cards, creation form, workspace header
- Store: `src/stores/agentStore.ts`
- Service: `src/lib/services/agentService.ts`
- Personality bootstrap: `src/lib/services/personalityService.ts`
- Emotion bootstrap: `src/lib/services/emotionalService.ts`
- Stats bootstrap: `src/lib/services/agentStatsService.ts`
- Table: `agents`

## What Lives In The Agent Record

The `agents` table stores:

- `id`
- `name`
- `persona`
- `goals`
- `status`
- `settings`
- `coreTraits`
- `dynamicTraits`
- `memoryCount`
- `totalInteractions`
- `linguisticProfile`
- `emotionalProfile`
- `emotionalState`
- `emotionalHistory`
- `stats`
- `psychologicalProfile`
- `relationshipCount`
- `creativeWorks`
- `dreamCount`
- `journalCount`
- `activeDreamImpression`
- `challengesCompleted`
- `challengeWins`
- `mentorshipStats`

That mix is intentional. The agent record is not just profile text. It is a compact runtime model that other features can read quickly.

## Creation Workflow

When a user creates an agent:

1. The user submits a name, persona, goals, and optional settings.
2. `AgentService.createAgent()` generates a new id.
3. `PersonalityService.generateInitialPersonality()` derives core trait defaults from the persona.
4. `PersonalityService.generateLinguisticProfile()` derives language style.
5. `emotionalService.generateProfileFromTraits()` derives a stable emotional profile.
6. `emotionalService.createDormantEmotionalState()` creates a dormant live state.
7. `agentStatsService.createDefaultStats()` creates baseline stats.
8. The server persists the full record.

Important detail:

- No messages exist yet.
- No memories exist yet.
- No personality evolution events exist yet.
- No deep profile run exists yet.

So the creation flow should stay clean and not over-attach derived data that belongs to later workflows.

## Read Workflow

Agent reads happen constantly from:

- roster
- dashboard
- agent detail page
- workspace tabs
- route handlers
- services that need context

The read behavior depends on persistence mode:

- Firestore when the app is in legacy or dual-write-read mode
- PostgreSQL when the app is in postgres-only or postgres-read mode

The service normalizes emotion fields on the way out so old records do not break the current runtime.

## Update Workflow

Agent updates are server-side only.

Typical updates include:

- status changes
- counter increments
- emotional state updates
- memory count changes
- creative, dream, or journal counters
- dynamic trait movement
- psychological profile refreshes
- active dream impression replacement

The client should never be the source of truth for those counters.

## Important State Rules

- `coreTraits` are stable after creation.
- `dynamicTraits` move slowly and are evidence-backed.
- `emotionalState` starts dormant and changes during turns or internal actions.
- `psychologicalProfile` updates only through the profile analysis workflow.
- `activeDreamImpression` is bounded and expires.

## Failure Modes

- Invalid environment configuration for PostgreSQL or Firestore
- Legacy records with old emotion shape
- Partial mirrored writes in dual-write mode
- Missing agent id on a route or store call

## Related Files

- [`src/lib/services/agentService.ts`](../../../src/lib/services/agentService.ts)
- [`src/lib/services/personalityService.ts`](../../../src/lib/services/personalityService.ts)
- [`src/lib/services/emotionalService.ts`](../../../src/lib/services/emotionalService.ts)
- [`src/lib/services/agentStatsService.ts`](../../../src/lib/services/agentStatsService.ts)
- [`src/lib/db/schema.ts`](../../../src/lib/db/schema.ts)

