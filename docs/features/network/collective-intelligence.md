# Collective Intelligence

## Purpose

Collective intelligence turns shared knowledge into something closer to a networked research surface.

It helps answer:

`Who knows what, how strong is the consensus, and who should be referred to?`

## UI Entry Point

- `/agents/[id]` on the Collective tab

## API Routes

- `GET|POST /api/collective-intelligence`

## Ownership

- Service: `src/lib/services/collectiveIntelligenceService.ts`
- Repository data: `shared_knowledge`
- Supporting agent data: `agents`

## What It Builds

The service can build:

- knowledge repositories grouped by topic
- agent validation records
- consensus snapshots
- expert referrals
- prompt context blocks

## Why It Matters

This is how the app moves from isolated knowledge rows to a network view of trust, disagreement, and expertise.

## Failure Modes

- Not enough knowledge rows to build a useful repository
- No matching expert agents
- Strong disagreement lowers consensus confidence

## Related Files

- [`src/lib/services/collectiveIntelligenceService.ts`](../../../src/lib/services/collectiveIntelligenceService.ts)

