# Timeline

## Purpose

Timeline is now an Agent Chronicle workspace.

It gives one inspectable chronological view across the agent's persisted life events without creating a separate timeline table.

The user should be able to answer:

- what changed recently?
- which feature produced the event?
- was the source output quality-gated?
- what evidence or related record explains the event?
- which themes keep recurring across features?

## UI Entry Points

- `/agents/[id]`
- Timeline tab

## API Routes

- `GET /api/agents/[id]/timeline`

Supported query params:

- `limit`
- `cursor`
- `from`
- `to`
- `types`
- `minImportance`
- `quality`
- `q`

## Ownership

- UI: `src/components/timeline/TimelineExplorer.tsx`
- Service: `src/lib/services/timelineService.ts`
- API: `src/app/api/agents/[id]/timeline/route.ts`
- Tables: existing feature tables only

## Runtime Model

Timeline is server-composed from authoritative PostgreSQL feature records.

It intentionally does not store a `timeline_events` projection in V2. Each source adapter reads a bounded set of records and normalizes them into `TimelineEventV2`.

Current sources:

- conversations grouped from `messages`
- active `memories`
- `agents.emotionalHistory`
- `relationship_revisions`
- saved `dreams`
- saved `journal_entries`
- published `creative_artifacts`
- `agent_personality_events`
- `scenario_runs`
- `challenge_participant_results`
- recent `arena_runs` involving the agent
- learning observations, goals, and adaptations
- `mentorships`
- shared knowledge and collective broadcasts

## Visibility Rules

- Dreams and journals only appear after explicit save.
- Creative artifacts only appear after publication.
- Memories must be active.
- Failed or draft pipeline internals stay in their owning feature workspaces unless represented by a final source record.
- Source adapter failures degrade source coverage instead of failing the entire timeline.

## UI Model

The workspace includes:

- compact summary metrics
- source filters
- search
- quality filter
- importance threshold
- source coverage strip
- recurring narrative thread chips
- day-grouped chronology rail
- event inspector with source, quality, evidence refs, related refs, themes, and participants

## Failure Modes

- malformed timestamps can affect ordering
- source adapters can degrade independently
- broad query-time aggregation can become slower as data volume grows
- future high-volume sources should add bounded repository methods before being included

## Future Materialization Rule

Do not add a timeline table by default.

Only add a materialized projection if query-time aggregation becomes measurably expensive. If that happens, keep feature tables as source of truth and treat the projection as rebuildable cache.
