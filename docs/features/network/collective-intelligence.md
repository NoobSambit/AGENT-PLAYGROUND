# Collective Intelligence

## Purpose

Collective intelligence turns validated network Library knowledge and legacy shared knowledge into a networked research surface.

It helps answer:

`Who knows what, how strong is the consensus, and who should be referred to?`

## UI Entry Point

- `/agents/[id]` on the Collective tab

## API Routes

- `GET|POST /api/collective-intelligence`

## Ownership

- Service: `src/lib/services/collectiveIntelligenceService.ts`
- Repository data: `library_items`, `library_item_sources`, `library_item_validations`, and legacy `shared_knowledge`
- Supporting agent data: `agents`

## What It Builds

The service can build:

- knowledge repositories grouped by topic
- agent validation records
- consensus snapshots
- expert referrals
- prompt context blocks
- Library-backed broadcasts for validated network items

## Why It Matters

This is how the app moves from isolated knowledge rows to a network view of trust, disagreement, and expertise.

## Failure Modes

- Not enough knowledge rows to build a useful repository
- No matching expert agents
- Strong disagreement lowers consensus confidence
- Library item is not validated/network-scoped, so Collective refuses to broadcast it

## Related Files

- [`src/lib/services/collectiveIntelligenceService.ts`](../../../src/lib/services/collectiveIntelligenceService.ts)
- [`src/lib/services/libraryService.ts`](../../../src/lib/services/libraryService.ts)
- [`src/lib/repositories/libraryRepository.ts`](../../../src/lib/repositories/libraryRepository.ts)
