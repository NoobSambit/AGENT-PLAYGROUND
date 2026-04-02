# Memory

## Purpose

The Memory feature gives an agent usable continuity across turns.

In simple terms:

- conversation memories keep recent interaction history
- fact memories keep stable user facts like name, project, or preference
- interaction memories keep notable tool usage or system actions

The Memory tab is meant to answer this question:

`What does this agent actually know well enough to recall later?`

## What Memory Is Responsible For

Memory owns:

- storing recallable records in the `memories` table
- keeping `agents.memory_count` in sync
- exposing a searchable memory console in the agent page
- returning recall results with simple reasons
- feeding memory context back into the chat prompt

Memory does not own:

- personality trait evolution
- psychological profile generation
- emotional state

Those now live in Profile and Emotions.

## UI Entry Points

- `/agents/[id]`
- Memory tab on the agent page

## API Routes

- `GET /api/agents/[id]/memories`
- `GET /api/agents/[id]/memories/stats`
- `POST /api/agents/[id]/memories/recall`
- `DELETE /api/agents/[id]/memories/[memoryId]`
- `GET|POST /api/memory`
  This is still available as a compatibility path for older callers, but the main UI should use the agent-scoped routes.

## Ownership

- UI: `src/components/memory/MemoryConsole.tsx`
- Services: `MemoryService`, `chatTurnService`
- Prompt layer: `MemoryChain`
- Persistence: `MemoryRepository`
- Tables: `memories`, `agents`

## Main Concepts

### Memory Types

- `conversation`
  A normal stored turn or meaningful exchange.
- `fact`
  A canonical stable fact such as user name, project, or preference.
- `interaction`
  A notable tool or system interaction.
- `personality_insight`
  Legacy type kept for compatibility and migration handling. It is not part of the new console model.

### Memory Origin

- `conversation`
- `tool`
- `manual`
- `system`
- `imported`

Origin tells us where the memory came from.

This matters because a `fact` memory created by the system after extraction should not be confused with a manually authored note or a raw transcript.

### Canonical Fact Memory

A canonical fact memory is a structured memory row with:

- `type = fact`
- a stable `factKey` inside `metadata`
- a compact summary
- a canonical fact statement in `content`

Example:

- summary: `User name: Riya`
- content: `User name is Riya.`

This is better than only storing a long conversation blob because the prompt can reuse this fact directly.

## Data Shape

The main memory record fields used by the current system are:

- `id`
- `agentId`
- `type`
- `content`
- `summary`
- `keywords`
- `importance`
- `context`
- `timestamp`
- `origin`
- `linkedMessageIds`
- `metadata`
- `isActive`

Important metadata used by the refactored flow:

- `factKey`
  Stable identifier used to upsert the same fact instead of duplicating it.
- `factType`
  High-level category like `identity`, `project`, or `preference`.
- `canonicalValue`
  The normalized fact value.
- `lastConfirmedAt`
  Last time this fact was observed again in a chat turn.

## End-To-End Workflow

### 1. User Sends A Chat Message

The message goes through `POST /api/agents/[id]/chat`.

Inside the chat turn:

1. the user message is stored in `messages`
2. the emotion pipeline appraises the message
3. the model generates a response
4. the response message is stored in `messages`
5. memory side effects run after both message IDs exist

This ordering matters because memory rows now link back to real message IDs.

### 2. Conversation Memory Is Written

After the assistant reply is generated, `chatTurnService` writes a `conversation` memory.

That memory contains:

- combined user and assistant content
- a summary
- extracted keywords
- importance score
- origin
- linked message IDs

This gives the system a readable conversation record for later inspection.

### 3. Structured Fact Extraction Runs

The same chat turn also tries to extract stable facts from the user message.

Current extraction focuses on:

- user identity
- current project
- simple preferences

If the prompt contains:

`My name is Riya`

the system writes or updates a fact memory for:

- `factKey = identity:name`

If the prompt contains:

`I am building a tea subscription app`

the system writes or updates a fact memory for:

- `factKey = project:a-tea-subscription-app`

### 4. Fact Upsert Prevents Duplication

Fact memory creation is not blind append-only storage.

The service first checks for an existing fact memory with the same `factKey`.

If found:

- content can be refreshed
- keywords can be merged
- linked message IDs can be merged
- metadata gets a new `lastConfirmedAt`

If not found:

- a new `fact` memory row is created

This is one of the biggest quality improvements in the refactor because it prevents the memory system from filling up with many copies of the same fact.

### 5. Agent Memory Count Is Updated

Every active memory write increments `agents.memory_count`.

Every soft delete decrements it.

The UI should treat the server-side value as the source of truth.

## How Memory Feeds Back Into Chat

The prompt layer uses `MemoryChain`.

Before each chat generation:

1. the memory cache is cleared for fresh reads
2. high-importance fact memories are loaded first
3. recent memories are loaded next
4. the combined memory context is injected into the system prompt

This is intentional.

Fact memories should be the strongest memory layer for direct factual recall.

Recent conversation memories are still useful, but they should not be the only memory source for things like user name or current project.

## Recall Workflow

The recall endpoint is:

- `POST /api/agents/[id]/memories/recall`

The current recall flow:

1. load console memories
2. score them by:
   - keyword overlap
   - shared terms
   - summary match
   - content match
   - context match
   - importance
   - fact-memory bonus
3. return sorted results
4. include simple reasons for why each memory matched

This is still heuristic ranking, not semantic retrieval.

But it is now stronger than before because canonical facts get a dedicated boost.

## Delete Workflow

Memory delete is soft delete, not immediate hard delete.

Route:

- `DELETE /api/agents/[id]/memories/[memoryId]`

What happens:

1. memory is marked inactive
2. `agents.memory_count` is decremented
3. console reads stop showing the memory
4. stats recalculate from active rows only

This keeps the feature safer and easier to reason about than hard deleting everything by default.

## Console Workflow

The Memory tab now acts like a real memory console.

It loads:

- summary stats
- filtered memory list
- selected memory details
- recall results

It supports:

- search
- filtering by type
- filtering by origin
- sorting
- minimum importance filter
- recall query
- delete

The console excludes legacy `personality_insight` rows from normal display.

## Update Model

Memory does not live-refresh every expensive view after every turn.

Current update model:

1. chat turn returns `changedDomains` and `staleDomains`
2. memory domain is marked changed when a conversation or fact memory is written
3. if Memory is open, the page can refresh the console
4. if Memory is not open, the next load still sees fresh DB state

This is the correct model for local Postgres plus local LLM work because it avoids wasteful full-page recompute.

## Scenario Examples

### Scenario 1: User Name Recall

User says:

`My name is Riya.`

What happens:

1. a conversation memory is created
2. a fact memory is created with `factKey = identity:name`
3. later, if the user asks:
   `What is my name?`
4. prompt memory includes the canonical fact row
5. the model can answer directly from the fact memory

Expected result:

- more reliable identity recall
- less hallucination risk than relying on a transcript summary alone

### Scenario 2: Project Recall

User says:

`Please remember that I am building a tea subscription app.`

What happens:

1. a project fact memory is created
2. if the same fact appears later in another phrasing, the same `factKey` is updated
3. recall can now surface:
   - `Project: a tea subscription app`
   - the original conversation memory

Expected result:

- stronger project recall
- less duplication

### Scenario 3: Memory Console Search

User opens Memory tab and searches:

`tea subscription`

What happens:

1. list filtering matches conversation and fact memories
2. recall query can separately rank the best memories
3. the fact row often becomes one of the top matches because it is canonical and important

### Scenario 4: Delete A Bad Memory

If a memory is not useful:

1. user deletes it from the console
2. memory becomes inactive
3. `memory_count` updates
4. it no longer appears in console or stats

## How It Updates In Practice

A normal turn may create:

- 1 conversation memory
- 0 to N fact memories

A second turn may not create new fact memory rows if the facts already exist.

Instead, it may:

- refresh the existing fact memory
- merge keywords
- add linked message IDs
- update `lastConfirmedAt`

This means the memory system is now moving from:

`store every mention forever`

toward:

`store a stable memory object and reinforce it over time`

## Known Limits

- fact extraction is regex-driven right now, so unusual phrasing can be missed
- recall is still heuristic, not vector or embedding based
- conversation summaries are still lightweight and can be rough
- memory ranking can still place a strong conversation row above a fact row in some cases

## Failure Modes

- counter drift if memory writes or deletes are only partially mirrored
- malformed legacy Firestore payloads requiring normalization
- weak fact extraction for indirect phrasing
- stale UI if clients ignore `changedDomains` and `staleDomains`

## Practical Reading Of The Current System

The current memory system is no longer just transcript storage.

It now has two useful layers:

- conversational memory for history
- canonical fact memory for stable recall

That is the main reason quality improved.
