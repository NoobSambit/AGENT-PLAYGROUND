# Scenarios

## Purpose

Handles alternate scenario and what-if style exploration for agents.

## UI Entry Points

- `/agents/[id]`

## API Routes

- simulation-adjacent and workspace-derived flows

## Ownership

- Services: scenario exploration logic, simulation helpers
- Tables: no standalone table in v1; reuse `simulations`, `messages`, `agents`

## Lifecycle

- Scenario exploration is persisted through simulation-style records when saved.

## Failure Modes

- ambiguity between transient and persisted scenario state
