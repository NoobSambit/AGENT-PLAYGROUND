# Agent Tab Refresh Plan

## Purpose

Keep the agent detail page feeling live without reloading every tab after every agent action.

This is the preferred model for the PostgreSQL-based runtime. It replaces the older Firebase-first instinct to make every section live all the time.

## Simple Idea

When the agent does something:

1. Update the small fast things immediately.
2. Mark the big slow tabs as stale.
3. Reload the big slow tabs only when needed.

Short version:

`agent action -> update core state now -> mark heavy tabs stale -> reload heavy tabs only when needed`

## What Updates Right Away

These should feel live after a chat turn or other core agent action:

- chat messages
- current agent snapshot
- emotional state
- mini stats and counters
- memory count
- relationship count
- recent event summaries when cheap to compute

These updates should happen through the normal action response and local store updates.

## What Should Not Recompute Every Turn

These areas are heavier and may trigger extra model work or more expensive aggregation:

- learning synthesis
- planning
- scenarios
- mentorship summaries
- knowledge graph views
- other LLM-heavy or derived tabs

These should not be recomputed on every action unless the user is actively viewing them and the refresh policy explicitly allows it.

## Recommended Refresh Model

Each agent action should return:

- core updated data
- a list of domains that changed
- a list of domains that are now stale

Example:

```json
{
  "changed": ["chat", "emotion", "stats"],
  "stale": ["timeline", "learning", "planning"]
}
```

This contract is now also used by the chat turn route to help Memory and Profile refresh selectively instead of reloading every tab.

The frontend should then:

- update cheap state immediately
- mark stale tabs in the store
- refresh heavy tabs only if they are open or manually requested

## Tab Policy

Recommended per-tab refresh policy:

- `chat`: live
- `emotions`: live
- `neural`: live or short-interval refresh only while open
- `memory`: on open plus stale refresh
- `relationships`: on open plus stale refresh
- `timeline`: stale refresh
- `learning`: stale or manual refresh
- `planning`: stale or manual refresh
- `scenarios`: manual refresh
- `creative`: on open
- `dreams`: on open
- `journal`: on open
- `profile`: on open
- `knowledge-graph`: stale or manual refresh
- `knowledge-library`: on open
- `collective`: stale or manual refresh
- `mentorship`: stale or manual refresh

## Why This Fits PostgreSQL

With Firebase, broad live listeners were easy to justify.

With local PostgreSQL, the better default is:

- local store updates for the current action
- selective refetch
- optional polling while the page is visible
- refresh on focus
- lazy loading for heavy tabs

This keeps the UI responsive without wasting local model time or recomputing expensive derived views after every turn.

## Practical Implementation Direction

The agent page should move toward:

1. a tab registry/config instead of hardcoded tab logic
2. per-tab refresh policies
3. shared stale/dirty invalidation in a store instead of page-local wiring
4. action responses that declare `changed` and `stale`

## Decision

Do not refresh every tab after every agent action.

Use:

- live core state
- lazy heavy tabs
- stale invalidation
- selective refresh when the user actually needs the data
