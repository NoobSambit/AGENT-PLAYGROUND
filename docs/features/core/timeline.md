# Timeline

## Purpose

Timeline is the agent chronicle view.

It turns otherwise scattered events into a single chronological surface that can be filtered, grouped, and inspected.

## UI Entry Point

- `/agents/[id]` on the Timeline tab

## API Route

- `GET /api/agents/[id]/timeline`

## Ownership

- Service: `src/lib/services/timelineService.ts`
- Tables / sources:
  - `messages`
  - `memories`
  - `agents.emotionalHistory`
  - `agent_personality_events`
  - `creative_*`
  - `dream_*`
  - `journal_*`
  - `profile_*`
  - `scenario_runs`
  - `challenge_runs`
  - `arena_runs`
  - `learning_*`
  - `mentorships`
  - `shared_knowledge`
  - `collective_broadcasts`

## What Timeline Does

Timeline is not a separate source of truth.

It is a derived view built from the important events that already exist elsewhere.

That means:

- no duplicate event store is needed
- no timeline sync job is needed
- the view can evolve as source features evolve

## Event Types

The timeline covers source types like:

- conversation
- memory
- emotion
- relationship
- dream
- creative
- journal
- profile
- scenario
- challenge
- arena
- learning
- mentorship
- knowledge

## Query Behavior

The timeline route can filter by:

- time range
- event types
- minimum importance
- quality status
- free-text search
- pagination cursor

## Event Construction

The service builds events from source rows and normalizes them into:

- title
- summary
- importance
- source
- source id
- status
- quality status
- themes
- participants
- evidence refs
- source refs
- related refs
- detail payload

This keeps the event card readable while still letting the UI inspect the raw context.

## Why This Matters

The timeline is the easiest place to answer:

- what changed first?
- what happened around the same time?
- what source feature caused this state shift?
- which events are still low quality or legacy?

## Failure Modes

- Source table has no data
- Event quality is legacy or unknown
- Query is too broad
- Cursor filters remove all visible events

## Related Files

- [`src/lib/services/timelineService.ts`](../../../src/lib/services/timelineService.ts)
- [`src/components/timeline/TimelineExplorer.tsx`](../../../src/components/timeline/TimelineExplorer.tsx)

