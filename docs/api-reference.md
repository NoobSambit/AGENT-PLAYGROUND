# API Reference

## Agent And Core State

- `GET /api/agents`
- `POST /api/agents`
- `GET /api/agents/[id]`
- `PATCH /api/agents/[id]`
- `POST /api/agents/[id]/chat`
- `GET /api/messages`
- `POST /api/messages`
- `GET /api/agents/[id]/memories`
- `GET /api/agents/[id]/memories/stats`
- `POST /api/agents/[id]/memories/recall`
- `DELETE /api/agents/[id]/memories/[memoryId]`
- `GET /api/memory`
- `POST /api/memory`
- `GET /api/agents/[id]/memory-graph`

## Agent Feature Routes

- `GET|POST /api/agents/[id]/creative`
- `GET|POST /api/agents/[id]/dream`
- `GET|POST /api/agents/[id]/journal`
- `GET|POST /api/agents/[id]/learning`
- `GET|POST /api/agents/[id]/profile`
- `GET /api/agents/[id]/profile/evolution`

## Social And Network Routes

- `GET|POST /api/relationships`
- `GET|POST /api/conflicts`
- `GET|POST /api/collective-intelligence`
- `GET|POST /api/knowledge`
- `GET|POST /api/mentorship`
- `GET|POST /api/challenges`

## Simulation

- `GET|POST /api/simulation`
- `POST /api/multiagent`

## Contract Notes

- API shapes remain stable across persistence modes.
- Dual-write behavior is hidden behind services and route helpers.
- Counters and derived stats are updated server-side; clients should not compute them optimistically as source of truth.
- `POST /api/agents/[id]/chat` now returns `changedDomains` and `staleDomains` so tabs can refresh selectively.
- `GET /api/agents/[id]/memories` can now return canonical `fact` memories created from chat turns.
- `POST /api/agents/[id]/memories/recall` returns mixed conversational and fact matches, with reasons that include canonical fact hits.
- `POST /api/agents/[id]/chat` now also drives learning side effects: observation capture, follow-up resolution, pattern confirmation, and adaptation refresh.
- `GET /api/agents/[id]/learning` returns learning state built from patterns, goals, adaptations, skills, and recent observations.
- `POST /api/agents/[id]/learning` remains available for explicit feature actions such as manual conversation analysis, goal generation, skill updates, and manual adaptation creation.
