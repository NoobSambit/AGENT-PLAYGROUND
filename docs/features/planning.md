# Planning

## Purpose

Supports future-oriented reasoning and projected actions for an agent.

## UI Entry Points

- `/agents/[id]`

## API Routes

- currently derived from agent state and workspace flows

## Ownership

- Services: planning-oriented workspace logic
- Tables: no dedicated table in v1; uses `agents`, `memories`, `journal_entries`

## Lifecycle

- Planning remains a derived feature in the PostgreSQL migration.

## Failure Modes

- stale context if upstream memory or goal data is incomplete
