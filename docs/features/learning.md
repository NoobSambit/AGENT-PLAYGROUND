# Learning

## Purpose

Turns conversation and behavior into learning patterns, goals, adaptations, skill progressions, and rate-limited learning events.

## UI Entry Points

- `/agents/[id]`

## API Routes

- `GET|POST /api/agents/[id]/learning`

## Ownership

- Services: `metaLearningService`
- Tables: `learning_patterns`, `learning_goals`, `learning_adaptations`, `learning_events`, `skill_progressions`, `agent_rate_limits`

## Lifecycle

- Conversation analysis upserts patterns, logs events, and advances skills.
- Rate limiting is enforced per agent and feature.

## Failure Modes

- stale pattern merges
- rate-limit state drift between stores during cutover
