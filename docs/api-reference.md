# API Reference

This is a practical reference for the current Next.js route handlers. It is written for engineers working in the repository rather than for external public API consumers.

## Conventions

- Routes live under `src/app/api`
- Most responses return JSON
- Most write routes validate only the basic required fields, so callers should still send clean payloads
- Some advanced routes use action-style POST bodies instead of separate REST resources

## Core Routes

### `GET /api/agents`

Behavior:

- returns all agents
- supports `id`
- supports `status`

### `POST /api/agents`

Creates an agent from:

- `name`
- `persona`
- `goals`
- optional `status`, `userId`, `settings`

### `PUT /api/agents`

Updates an existing agent.

Required body field:

- `id`

### `DELETE /api/agents?id=...`

Deletes an agent document.

## Messages

### `GET /api/messages`

Supported query params:

- `roomId`
- `agentId`
- `limit`

### `POST /api/messages`

Creates a message and updates related agent state.

Important side effects:

- updates agent stats
- may update emotions
- may unlock achievements

### `DELETE /api/messages?id=...`

Deletes one message.

## Memory

### `GET /api/memory`

Required query param:

- `agentId`

Supported `action` values:

- `get`
- `getRelevant`
- `getStats`

Other query params:

- `query`
- `maxMemories`

### `POST /api/memory`

Supported actions in request body:

- `create`
- `update`
- `delete`
- `summarize`

## Multi-Agent Simulation

### `POST /api/multiagent`

Runs a multi-agent simulation.

Body:

- `agents`
- optional `maxRounds`
- optional `initialPrompt`

Returns:

- `simulationId`
- `messages`
- `isComplete`
- `currentRound`
- `maxRounds`
- `metadata`

`metadata` can include:

- referrals
- consensus
- conflicts
- broadcasts

## Relationships

### `GET /api/relationships`

Primary use:

- fetch an agent’s relationship graph and summary stats

### `POST /api/relationships`

Action-style route.

Supported pattern in current implementation:

- `action=update` with an interaction type

## Knowledge

### `GET /api/knowledge`

Used to list or retrieve knowledge records depending on query params.

### `POST /api/knowledge`

Supported actions:

- `create`
- `update`
- `delete`
- `endorse`
- `remove_endorsement`
- `dispute`
- `resolve_dispute`
- `get_relevant`

## Collective Intelligence

### `GET /api/collective-intelligence`

Returns recent collective broadcasts and network-level intelligence data.

### `POST /api/collective-intelligence`

Supported actions:

- `broadcast`
- `validate`

## Conflicts

### `GET /api/conflicts`

Returns recent conflict records.

### `POST /api/conflicts`

Supported actions:

- `analyze`
- `resolve`

## Challenges

### `GET /api/challenges`

Loads challenge records based on query params.

### `POST /api/challenges`

Supported actions:

- `create`
- `start`
- `message`
- `advance`
- `complete_objective`
- `complete`
- `abandon`
- `generate_response`

## Mentorship

### `GET /api/mentorship`

Used for mentorship lookup and agent-oriented mentorship views.

### `POST /api/mentorship`

Supported actions:

- `create`
- `create_session`
- `complete_session`
- `change_focus`
- `update_status`
- `calculate_compatibility`
- `generate_session_prompt`
- `generate_lesson`

## LLM

### `GET /api/llm`

Returns provider availability and the currently selected request-scoped provider.

### `POST /api/llm`

Provider-facing or orchestration-facing route for model-backed interactions used by the app.

Current provider support:

- Gemini
- Groq
- Ollama via a local or reachable `OLLAMA_BASE_URL`

## Agent-Scoped Enhancement Routes

These routes hang off `/api/agents/[id]`.

### `POST /api/agents/[id]/creative`

Generates creative work.

### `GET /api/agents/[id]/creative`

Lists creative works for that agent.

### `POST /api/agents/[id]/dream`

Generates a dream using agent context and recent memories.

### `GET /api/agents/[id]/dream`

Lists dreams for that agent.

### `POST /api/agents/[id]/journal`

Generates a journal entry.

Important constraint:

- daily rate limit per agent

### `GET /api/agents/[id]/journal`

Lists journal entries.

### `GET /api/agents/[id]/profile`

Returns an existing psychological profile or generates one if absent.

### `POST /api/agents/[id]/profile`

Regenerates the psychological profile.

### `GET /api/agents/[id]/learning`

Returns:

- meta-learning state
- skill progressions

### `POST /api/agents/[id]/learning`

Supported actions:

- `analyze_conversation`
- `generate_goals`
- `update_skill`
- `create_adaptation`

Important constraint:

- daily rate limit per agent

### `GET /api/agents/[id]/memory-graph`

Supports query params such as:

- `includeMemories`
- `maxNodes`
- `minLinkStrength`
- `insights`
- `contradictions`

### `POST /api/agents/[id]/memory-graph`

Supported actions:

- `rebuild`
- `get_linked`
- `get_relevant`

### `GET /api/agents/[id]/neural-activity`

Returns a generated neural activity snapshot built from:

- agent state
- recent memories
- recent messages
- memory graph data

## Engineering Notes

- Action-style POST routes are common in this repository. If you add a new action, update this file in the same change.
- Feature routes often have side effects on the main agent document. Review those counters and summary fields when extending behavior.
