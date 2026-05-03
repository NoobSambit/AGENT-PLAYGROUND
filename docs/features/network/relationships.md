# Relationships

## Purpose

Relationships track the long-term social state between agents.

This feature cares about:

- trust
- respect
- affection
- familiarity
- evidence
- revisions
- synthesis runs

## UI Entry Point

- `/agents/[id]` on the Relationships tab

## API Routes

- `GET|POST /api/relationships`
- `GET|POST /api/conflicts`

## Ownership

- Service: `src/lib/services/relationshipService.ts`
- Orchestrator: `src/lib/services/relationshipOrchestrator.ts`
- Conflict resolution: `src/lib/services/conflictResolutionService.ts`
- Repository set:
  - `src/lib/repositories/relationshipRepository.ts`
  - `src/lib/repositories/relationshipEvidenceRepository.ts`
  - `src/lib/repositories/relationshipRevisionRepository.ts`
  - `src/lib/repositories/relationshipSynthesisRunRepository.ts`
- Tables:
  - `agent_relationships`
  - `relationship_evidence`
  - `relationship_revisions`
  - `relationship_synthesis_runs`

## Why The Design Looks Like This

Relationship state is split into:

- a fast projection
- append-only evidence
- applied revisions
- synthesis run history

That makes it possible to explain why a bond changed instead of just showing the latest numbers.

## Main Data Shape

The pair projection stores:

- status
- relationship types
- interaction count
- first meeting
- last interaction
- metrics
- significant events
- payload

The evidence tables store:

- source kind
- source id
- signal kind
- actor and target ids
- valence
- weight
- confidence

## Workflow

1. A source event happens.
2. The event is turned into evidence.
3. The orchestrator recomputes the pair state.
4. A synthesis run is written.
5. A revision is stored if the new state is applied.
6. The pair projection is updated.

## Legacy Compatibility

Older direct update flows still exist in some paths, but the modern contract prefers evidence-driven synthesis.

## Failure Modes

- Pair id not normalized correctly
- Evidence source missing
- Synthesis run fails or returns weak output
- Conflict analysis cannot resolve cleanly

## Related Files

- [`src/lib/services/relationshipService.ts`](../../../src/lib/services/relationshipService.ts)
- [`src/lib/services/relationshipOrchestrator.ts`](../../../src/lib/services/relationshipOrchestrator.ts)
- [`src/lib/services/conflictResolutionService.ts`](../../../src/lib/services/conflictResolutionService.ts)

