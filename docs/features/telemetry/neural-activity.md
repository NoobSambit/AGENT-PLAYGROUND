# Neural Activity

## Purpose

Neural activity is a dense diagnostic view.

It is not a primary task surface. It is a way to inspect how emotion, memory, and attention are interacting at a moment in time.

## UI Entry Point

- `/agents/[id]` on the Neural tab

## API Route

- `GET /api/agents/[id]/neural-activity`

## Ownership

- Service: `src/lib/services/neuralActivityService.ts`
- Supporting sources:
  - `emotionalService`
  - `messages`
  - `memories`
  - `memory_graphs`

## What It Builds

The neural activity snapshot includes:

- dominant emotion
- emotional intensity
- attention focus
- memory nodes
- concept nodes
- decision node
- edges between the nodes
- a reasoning summary

## Why It Exists

The goal is not biological accuracy.

The goal is to give the user a compact view of:

- what emotion is leading
- what memories are active
- what concepts are in focus
- where the agent is likely to decide next

## Failure Modes

- No memory graph available
- No recent messages
- Emotional state dormant

