# API Reference

## Agent And Core State

- `GET /api/agents`
- `POST /api/agents`
- `GET /api/agents/[id]`
- `PATCH /api/agents/[id]`
- `POST /api/agents/[id]/chat`
- `GET /api/messages`
- `POST /api/messages`
- `GET /api/memory`
- `POST /api/memory`
- `GET /api/agents/[id]/memory-graph`

## Agent Feature Routes

- `GET|POST /api/agents/[id]/creative`
- `GET|POST /api/agents/[id]/dream`
- `GET|POST /api/agents/[id]/journal`
- `GET|POST /api/agents/[id]/learning`
- `GET|POST /api/agents/[id]/profile`

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
