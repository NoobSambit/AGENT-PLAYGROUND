# Learning

## Purpose

Learning is the meta-learning system.

It records what the agent repeatedly learns from turns and turns those observations into:

- patterns
- goals
- adaptations
- event logs
- skill progression

It answers:

`What does the agent keep learning, and what should later prompts do with that?`

## UI Entry Point

- `/agents/[id]` on the Learning tab

## API Routes

- `GET /api/agents/[id]/learning`
- `POST /api/agents/[id]/learning`

## Ownership

- Service: `src/lib/services/learningService.ts`
- Meta-learning engine: `src/lib/services/metaLearningService.ts`
- Repository: `src/lib/repositories/learningRepository.ts`
- Tables:
  - `learning_observations`
  - `learning_patterns`
  - `learning_goals`
  - `learning_adaptations`
  - `learning_events`
  - `skill_progressions`

## Important Concepts

| Concept | Meaning |
| --- | --- |
| Observation | A single turn-level learning note. |
| Pattern | A repeated observation that looks stable. |
| Goal | A learning objective the agent should pursue. |
| Adaptation | A prompt-time or behavioral adjustment that is currently active. |
| Event | A durable log of learning activity. |
| Skill progression | The current level for a named capability. |

## Turn-Driven Flow

Learning is driven by chat turns.

When a turn completes, the system can:

1. record a learning observation
2. resolve the previous pending observation if the new turn answers it
3. group repeated observations into patterns
4. create or update goals
5. activate or refresh adaptations
6. persist learning events
7. update skill progression if the evidence is strong enough

## Why Learning Is Separate

Learning is not the same as memory or personality.

- Memory stores what happened.
- Personality records how traits move.
- Learning records what the system should keep doing next.

That separation keeps the product inspectable.

## Read Behavior

The learning tab should show:

- current patterns
- active goals
- active adaptations
- recent observations
- skill state

The current state can come from either Firestore or PostgreSQL depending on persistence mode.

## Failure Modes

- No prior observations to resolve
- Pattern thresholds not met
- Provider unavailable during explicit analysis
- Stale dual-write state in migration mode

## Related Files

- [`src/lib/services/learningService.ts`](../../../src/lib/services/learningService.ts)
- [`src/lib/services/metaLearningService.ts`](../../../src/lib/services/metaLearningService.ts)

