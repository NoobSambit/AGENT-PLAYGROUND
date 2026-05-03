# Agent Workspace And Arena Manuals

This index covers the `/agents/[id]` workspace tabs and the `/simulation` arena workspace.

## Workspace Map

```mermaid
flowchart LR
  A[/agents/[id]/] --> O[Overview]
  A --> C[Chat]
  A --> M[Memory]
  A --> E[Emotions]
  A --> N[Neural Activity]
  A --> T[Timeline]
  A --> R[Relationships]
  A --> L[Learning]
  A --> S[Scenarios]
  A --> CR[Creative]
  A --> D[Dreams]
  A --> J[Journal]
  A --> P[Profile]
  A --> CH[Challenges]
  A --> KG[Knowledge Graph]
  A --> KL[Knowledge Library]
  A --> CI[Collective Intelligence]
  A --> MH[Mentorship]
  SIM[/simulation/] --> AR[Arena]
```

## Manuals

- [Overview](./overview.md)
- [Chat](./chat.md)
- [Memory](./memory.md)
- [Emotions](./emotions.md)
- [Neural Activity](./neural.md)
- [Timeline](./timeline.md)
- [Relationships](./relationships.md)
- [Learning](./learning.md)
- [Scenarios](./scenarios.md)
- [Creative](./creative.md)
- [Dreams](./dreams.md)
- [Journal](./journal.md)
- [Profile](./profile.md)
- [Challenges](./challenges.md)
- [Knowledge Graph](./knowledge-graph.md)
- [Knowledge Library](./knowledge-library.md)
- [Collective Intelligence](./collective.md)
- [Mentorship](./mentorship.md)
- [Arena](./arena.md)

## Source Boundaries

- Workspace shell: `src/app/agents/[id]/page.tsx`
- Arena shell: `src/app/simulation/page.tsx`
- Agent reads and writes: `src/app/api/agents`, `src/lib/services/agentService.ts`, `src/lib/repositories/agentRepository.ts`
- Persistence schema: `src/lib/db/schema.ts`

## Reading Order

- Start with [Overview](./overview.md) for the shared workspace shell.
- Read [Chat](./chat.md), [Memory](./memory.md), [Emotions](./emotions.md), and [Timeline](./timeline.md) together if you are debugging core agent state.
- Read [Creative](./creative.md), [Dreams](./dreams.md), [Journal](./journal.md), and [Profile](./profile.md) together if you are working on long-form generation pipelines.
- Read [Relationships](./relationships.md), [Challenges](./challenges.md), [Collective Intelligence](./collective.md), [Mentorship](./mentorship.md), and [Arena](./arena.md) together if you are changing multi-agent behavior.
