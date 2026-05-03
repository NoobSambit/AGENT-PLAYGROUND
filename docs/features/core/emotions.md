# Emotions

## Purpose

Emotions track what the agent feels now and how that feeling changes over time.

The feature keeps three separate ideas apart:

- emotional profile: stable tendencies
- emotional state: live mood right now
- emotional history: recent events that changed the mood

## UI Entry Point

- `/agents/[id]` on the Emotions tab

## Ownership

- Service: `src/lib/services/emotionalService.ts`
- Data types: `src/types/database.ts`
- Store inputs: agent state and chat turn data
- Tables: `agents.emotionalProfile`, `agents.emotionalState`, `agents.emotionalHistory`

## Emotional Model

The emotional system uses eight core emotions:

- joy
- sadness
- anger
- fear
- surprise
- trust
- anticipation
- disgust

The live state stores a value for each of them.

## The Three Layers

### 1. Emotional Profile

The emotional profile is the stable baseline.

It comes from core traits and sets tendencies like:

- sensitivity
- resilience
- expressiveness
- optimism

### 2. Emotional State

The emotional state is the current mood.

It starts dormant and can become active during chat or internal actions.

### 3. Emotional History

The history stores individual emotional events with:

- phase
- source
- trigger
- explanation
- confidence
- linked messages
- linked memories
- downstream hints

## Update Paths

The emotion service can update state from:

- user messages
- assistant responses
- reflection passes
- creative generation
- dream generation
- journal entries
- relationship shifts
- memory recall
- other internal system actions

## Chat Turn Flow

1. Appraise the user prompt.
2. Generate a provisional state.
3. Generate the assistant reply.
4. Finalize the emotion after the reply exists.
5. Write the resulting emotional history.

## Why This Matters

Emotion is not just visual decoration.

It affects:

- response tone
- prompt assembly
- timeline events
- downstream features such as journal and dream context

## Failure Modes

- Legacy emotional state shape
- Missing emotional profile
- Overactive history growth
- Conflicting updates from old rows during migration

## Related Files

- [`src/lib/services/emotionalService.ts`](../../../src/lib/services/emotionalService.ts)
- [`src/components/emotions/EmotionTimeline.tsx`](../../../src/components/emotions/EmotionTimeline.tsx)
- [`src/components/emotions/EmotionRadar.tsx`](../../../src/components/emotions/EmotionRadar.tsx)

