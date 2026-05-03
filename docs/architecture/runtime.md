# Runtime Details

This page describes the concrete runtime entry points, stores, services, and utility modules that shape the app.

## App Surfaces

| Route | Main purpose |
| --- | --- |
| `/` | Landing page and product framing. |
| `/dashboard` | Roster health, summary metrics, and next-action routing. |
| `/agents` | Filterable directory of all agents. |
| `/agents/new` | New agent creation flow. |
| `/agents/[id]` | Primary workspace with chat, memory, emotion, timeline, learning, scenarios, creative, dreams, journal, profile, challenges, knowledge, collective intelligence, and mentorship tabs. |
| `/simulation` | Arena workspace for multi-agent debate and orchestration. |

`src/components/ui/navigation.tsx` provides the main top-level navigation. `ThemeProvider`, `ThemeToggle`, and the animated background components are cross-cutting presentation utilities.

## Client State

| Store | Responsibility |
| --- | --- |
| `useAgentStore` | Agent roster, current agent, memory actions, and agent CRUD requests. |
| `useMessageStore` | Chat message loading and local message updates. |
| `useLLMPreferenceStore` | Provider/model selection for client-driven requests. |

The stores are intentionally thin. They call API routes and keep UI state, but they do not own business logic.

## Domain Services

### Core identity and state

- `AgentService`: create, fetch, update, and delete agents across the active persistence mode.
- `PersonalityService`: derive initial traits, inspect interaction evidence, and update dynamic traits slowly.
- `agentStatsService`: create and normalize counters.
- `emotionalService`: derive emotional profile, appraise turns, and update live emotional state.

### Chat and feedback

- `chatTurnService`: canonical chat orchestration and side-effect coordination.
- `MessageService`: message persistence and lookup.
- `MemoryService`: conversation memory, structured facts, recall, and deletes.
- `LearningService`: observation capture, goal/pattern/adaptation refresh, and learning state assembly.
- `PersonalityEventService`: explainable trait evolution history.

### Feature workspaces

- `creativityService`: Creative Studio drafts, evaluation, repair, and publish.
- `dreamService`: Dream V2 session generation, quality gating, and save-time impression updates.
- `journalService`: Journal session generation, evaluation, and save-time archive updates.
- `profileAnalysisService`: bounded profile interview runs and psychological profile updates.
- `scenarioService`: branch experiments and comparison output.
- `challengeLabService`: challenge templates, run execution, and participant results.
- `arenaService`: sandboxed debates and event feeds.

### Social and network

- `relationshipService`: pair state, evidence, and revision reads.
- `relationshipOrchestrator`: synthesis and repair of pair state.
- `conflictResolutionService`: conflict analysis and resolution.
- `collectiveIntelligenceService`: knowledge promotion and broadcast.
- `mentorshipService`: mentorship sessions and outcomes.
- `knowledgeService`: shared knowledge and graph-oriented retrieval.

## Utility Modules Worth Knowing

| File | Role |
| --- | --- |
| `src/lib/db/persistence.ts` | Chooses persistence mode and exposes read/write helpers. |
| `src/lib/persistence/writeMirror.ts` | Performs best-effort mirrored writes and queues failures. |
| `src/lib/llm/provider.ts` | Runs provider requests to Gemini, Groq, or Ollama. |
| `src/lib/llm/clientPreference.ts` | Writes client provider preferences to cookies and request headers. |
| `src/lib/llm/requestPreference.ts` | Reads provider preference from the incoming request. |
| `src/lib/chat/rendering.ts` | Normalizes assistant markdown into block data for the chat UI. |
| `src/lib/utils.ts` | Shared class-name merge helper. |

## Agent Workspace Tabs

The agent detail page is organized into tabs so users can inspect state without losing context:

- Overview: summary state and quick actions.
- Chat: conversational turns and response rendering.
- Emotions: state and recent shifts.
- Neural: thought flow and attention style views.
- Timeline: chronological event explorer.
- Memory: recallable memory records and counters.
- Relationships: pair state and revisions.
- Learning: meta-learning state and skills.
- Scenarios: alternate branch runs.
- Creative: published creative work and sessions.
- Dreams: dream sessions and saved artifacts.
- Journal: reflective entries and sessions.
- Profile: deep profile and evolution history.
- Challenges: challenge runs and results.
- Knowledge: graph and shared knowledge views.
- Collective: broadcasts and consensus-style signals.
- Mentorship: coaching and growth connections.

## Important Data Flow Notes

- Chat is the canonical write point for turn side effects.
- Memory and profile refreshes are derived from chat evidence, not from page load.
- Premium workspaces use draft sessions, generated artifacts, pipeline events, and explicit save/publish boundaries.
- Arena, challenge, scenario, and relationship workflows all favor inspectable event feeds over opaque single-result writes.

## Related References

- [`../workflows/agent-lifecycle.md`](../workflows/agent-lifecycle.md)
- [`../workflows/premium-workspaces.md`](../workflows/premium-workspaces.md)
