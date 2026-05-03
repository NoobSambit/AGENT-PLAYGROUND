# Knowledge Graph

## Purpose

The knowledge graph is the inspectable concept layer over memory and knowledge.

It helps answer:

`What concepts does this agent keep linking together?`

## UI Entry Point

- `/agents/[id]` on the Knowledge tab

## API Route

- `GET /api/agents/[id]/memory-graph`

## Ownership

- Service: `src/lib/services/memoryGraphService.ts`
- Repository: `src/lib/repositories/memoryGraphRepository.ts`
- Table: `memory_graphs`

## What It Contains

The graph generally tracks:

- concepts
- links
- importance
- source memories
- semantic clusters

## How It Is Used

The graph is a projection over memory, not a replacement for memory.

It exists so the UI can show:

- concept clusters
- high-value links
- recent changes in the conceptual map

## Failure Modes

- No semantic memories yet
- Graph not refreshed after a turn
- Legacy memory rows without enough metadata

