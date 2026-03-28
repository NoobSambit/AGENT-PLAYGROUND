# Data Model

This guide summarizes the main domain records and how they are persisted.

## Core Record: Agent

Type source:

- [src/types/database.ts](/home/noobsambit/Documents/AGENT-PLAYGROUND/src/types/database.ts)

Important fields:

- `id`
- `name`
- `persona`
- `goals`
- `status`
- `createdAt`
- `updatedAt`
- `coreTraits`
- `dynamicTraits`
- `memoryCount`
- `totalInteractions`
- `linguisticProfile`
- `emotionalState`
- `emotionalHistory`
- `progress`
- `stats`
- `psychologicalProfile`
- enhancement counters such as relationships, dreams, journals, and creative works

Why it matters:

The agent record is both the identity document and the summary document for the rest of the system.

## Message Record

Top-level collection:

- `messages`

Important fields:

- `agentId`
- `content`
- `type`
- `timestamp`
- `roomId`
- `metadata`

Messages drive:

- chat history
- stats updates
- emotional updates
- simulation transcripts

## Memory Record

Top-level collection:

- `memories`

Important fields:

- `agentId`
- `type`
- `content`
- `summary`
- `keywords`
- `importance`
- `context`
- `timestamp`
- `metadata`
- `isActive`

Design note:

Deletion is usually soft deletion through `isActive`.

## Simulation Record

Top-level collection:

- `simulations`

Important fields:

- participating agents
- round-by-round messages
- `maxRounds`
- `createdAt`
- `isComplete`
- `finalRound`
- simulation `metadata`

Simulation metadata can include conflict and collective-intelligence artifacts.

## Relationship Record

Stored under:

- `agents/{agentId}/relationships`

Important fields:

- `agentId1`
- `agentId2`
- `relationshipTypes`
- `metrics`
- `status`
- `interactionCount`
- `lastInteraction`
- `firstMeeting`
- `significantEvents`

Relationship metrics include:

- trust
- respect
- affection
- familiarity

## Psychological And Linguistic Data

Stored mostly on the main agent record.

### Linguistic profile

Captures:

- formality
- verbosity
- humor
- technical level
- expressiveness
- preferred words
- signature expressions
- punctuation style

### Psychological profile

Stored as generated structured analysis and used to enrich the workspace.

## Progress And Stats

Stored on the main agent record.

### Progress

Includes:

- level
- experience points
- next level XP
- achievements
- skill points
- allocated skills

### Stats

Includes:

- conversation volume
- topic diversity
- helpfulness counts
- emotional recognitions
- relationship counts
- dream, creative, and journal counts

## Learning Records

Stored under agent subcollections:

- `learning_patterns`
- `learning_goals`
- `learning_adaptations`
- `learning_events`
- `skill_progressions`

These subcollections back the meta-learning system.

## Creative, Dream, And Journal Records

Stored under:

- `creative_works`
- `dreams`
- `journal_entries`

These are content-heavy records that belong to one agent and should not bloat the main agent document.

## Knowledge And Collective Records

Top-level collections:

- `knowledge`
- `collective_broadcasts`
- `conflicts`

These collections represent network-level behavior rather than one isolated agent.

## Rate Limiting Records

Stored under:

- `agents/{agentId}/rate_limits`

Current examples:

- meta-learning rate limit documents

The repository uses Firestore documents for feature-local quota tracking instead of external infrastructure.

## Practical Modeling Rules

- Keep shared summaries on the main agent record when they materially improve dashboard and directory performance.
- Keep large histories in subcollections or dedicated top-level collections.
- Update producer and consumer types together when changing a record shape.
- Review UI assumptions whenever a counter or derived field changes.
