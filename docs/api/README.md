# API Reference

This section groups the route surface by product area and explains the behavior patterns that repeat across endpoints.

## Common API Patterns

Most routes follow one of these shapes:

| Pattern | Typical verbs | Example |
| --- | --- | --- |
| Bootstrap | `GET` | `GET /api/agents/[id]/creative` |
| Draft creation | `POST` | `POST /api/agents/[id]/journal` |
| Detail fetch | `GET` | `GET /api/agents/[id]/dream/sessions/[sessionId]` |
| Generate or execute | `POST` | `POST /api/agents/[id]/profile/runs/[runId]/execute` |
| Save or publish | `POST` | `POST /api/agents/[id]/dream/sessions/[sessionId]/save` |
| Update draft state | `PUT` | `PUT /api/arena/runs/[runId]` |
| Delete | `DELETE` | `DELETE /api/agents/[id]/memories/[memoryId]` |

The important contract rule is that routes are thin. They validate input, call a service, and serialize the result. They do not own the business rules.

## Core Agent Routes

### Agents

- `GET /api/agents`
- `POST /api/agents`
- `GET /api/agents/[id]`
- `PATCH /api/agents/[id]`
- `PUT /api/agents`
- `DELETE /api/agents`

These cover roster reads, creation, updates, and deletion. `AgentService` owns the actual record lifecycle.

### Chat And Messages

- `POST /api/agents/[id]/chat`
- `GET /api/messages`
- `POST /api/messages`
- `DELETE /api/messages`

`POST /api/agents/[id]/chat` is the canonical turn endpoint. It returns:

- user and agent messages
- refreshed agent state
- `changedDomains`
- `staleDomains`
- emotion summary
- reasoning metadata
- tools and memory usage

### Memory

- `GET /api/agents/[id]/memories`
- `GET /api/agents/[id]/memories/stats`
- `POST /api/agents/[id]/memories/recall`
- `DELETE /api/agents/[id]/memories/[memoryId]`
- `GET|POST /api/memory`

The agent-scoped routes are the preferred surface. `GET|POST /api/memory` remains a compatibility path for older callers.

## Agent Workspace Routes

### Timeline, emotion, and neural activity

- `GET /api/agents/[id]/timeline`
- `GET /api/agents/[id]/neural-activity`
- `GET /api/agents/[id]/memories/stats`

These routes power the Chronicle, emotion, and neural views. They are read-heavy and should stay bounded.

### Learning

- `GET /api/agents/[id]/learning`
- `POST /api/agents/[id]/learning`

`GET` returns the current learning state. `POST` remains available for manual or explicit feature actions such as analysis, goal generation, and adaptation creation.

### Profile

- `GET /api/agents/[id]/profile`
- `POST /api/agents/[id]/profile`
- `GET /api/agents/[id]/profile/evolution`
- `POST /api/agents/[id]/profile/runs`
- `GET /api/agents/[id]/profile/runs/[runId]`
- `POST /api/agents/[id]/profile/runs/[runId]/execute`

The compatibility `POST /profile` route delegates to the run-based workflow. The run endpoints are the canonical deep-profile contract.

## Session-Based Feature Routes

### Creative Studio

- `GET|POST /api/agents/[id]/creative`
- `GET /api/agents/[id]/creative/sessions/[sessionId]`
- `POST /api/agents/[id]/creative/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/creative/sessions/[sessionId]/publish`

### Dream V2

- `GET|POST /api/agents/[id]/dream`
- `GET /api/agents/[id]/dream/sessions/[sessionId]`
- `POST /api/agents/[id]/dream/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/dream/sessions/[sessionId]/save`

### Journal V2

- `GET|POST /api/agents/[id]/journal`
- `GET /api/agents/[id]/journal/sessions/[sessionId]`
- `POST /api/agents/[id]/journal/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/journal/sessions/[sessionId]/save`

These workspaces all use the same inspectable contract:

- draft session row
- stage events
- evaluation payload
- optional repair pass
- explicit final save or publish

## Social And Network Routes

- `GET|POST /api/relationships`
- `GET|POST /api/conflicts`
- `GET|POST /api/collective-intelligence`
- `GET|POST /api/knowledge`
- `GET|POST /api/mentorship`

These routes are the main bridge between agent-to-agent state and broader network state.

Important behavior:

- `POST /api/relationships` supports controlled recomputation and evidence ingestion.
- `POST /api/conflicts` can analyze or resolve, and the resolve path saves the result and emits relationship evidence.
- `POST /api/mentorship` and challenge or arena flows can emit relationship evidence after completion.

## Simulation, Scenario, Arena, And Challenges

### Scenarios

- `GET /api/scenarios`
- `POST /api/scenarios`
- `GET /api/scenarios/[id]`

### Arena

- `GET /api/arena/runs`
- `POST /api/arena/runs`
- `GET /api/arena/runs/[runId]`
- `PUT /api/arena/runs/[runId]`
- `POST /api/arena/runs/[runId]/execute`
- `POST /api/arena/runs/[runId]/cancel`

### Challenge Lab

- `GET /api/agents/[id]/challenges`
- `POST /api/agents/[id]/challenges/runs`
- `GET /api/agents/[id]/challenges/runs/[runId]`
- `POST /api/agents/[id]/challenges/runs/[runId]/execute`
- `POST /api/agents/[id]/challenges/runs/[runId]/cancel`
- `GET|POST /api/challenges` returns `410` and is legacy-only.

### Legacy Simulation Compatibility

- `GET /api/simulations`
- `POST /api/multiagent`

These stay available for compatibility, but the newer arena and scenario routes are the better documented surfaces.

## LLM Preference And Provider Surface

- `GET /api/llm`
- `POST /api/llm`

These routes expose or update the client-visible provider preference used by the UI. The server still resolves the actual provider from request preference plus configured availability.

## Quality And Error Conventions

- `400` for invalid input.
- `409` for blocked state transitions, especially on quality-gated save or publish operations.
- `410` for intentionally retired legacy surfaces.
- `500` for unexpected server failures.

For quality-gated routes, the response should include the blockers instead of silently accepting the transition.

## Detailed References

- [`../workflows/agent-lifecycle.md`](../workflows/agent-lifecycle.md)
- [`../workflows/premium-workspaces.md`](../workflows/premium-workspaces.md)
- [`../architecture/runtime.md`](../architecture/runtime.md)

