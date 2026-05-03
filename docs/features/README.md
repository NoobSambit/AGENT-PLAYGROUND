# Feature Index

This section is the main map for the product surface.

The docs are grouped by domain so the structure stays readable as the app grows:

- [`core/`](./core/README.md): agent identity, chat, memory, emotions, timeline, learning, and profile.
- [`workspaces/`](./workspaces/README.md): Creative Studio, Dream V2, and Journal V2.
- [`network/`](./network/README.md): relationships, knowledge, shared knowledge, collective intelligence, and mentorship.
- [`planning/`](./planning/README.md): scenarios, challenges, and simulation / arena flows.
- [`telemetry/`](./telemetry/README.md): neural activity and dense inspection views.

Each feature page is written to answer the same questions:

1. What is the feature for?
2. What screen does the user use?
3. Which API route owns the workflow?
4. Which service and table own the state?
5. What happens on read, write, repair, save, or publish?
6. What can fail, and how does the system respond?

## Reading Order

If you want to understand the system from the bottom up, read in this order:

1. [`../architecture/README.md`](../architecture/README.md)
2. [`../architecture/runtime.md`](../architecture/runtime.md)
3. [`core/agent-core.md`](./core/agent-core.md)
4. [`core/chat.md`](./core/chat.md)
5. [`core/memory.md`](./core/memory.md)
6. [`workspaces/creative.md`](./workspaces/creative.md)
7. [`workspaces/dreams.md`](./workspaces/dreams.md)
8. [`workspaces/journal.md`](./workspaces/journal.md)
9. [`network/relationships.md`](./network/relationships.md)
10. [`planning/scenarios.md`](./planning/scenarios.md)

