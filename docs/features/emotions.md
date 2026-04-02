# Emotions

## Purpose

The Emotions feature tracks the agent's live internal state during interactions.

In simple terms:

- it decides how a turn emotionally lands
- it updates the live emotional state
- it records why that state changed
- it shapes response tone indirectly

The goal is not to make the agent melodramatic.

The goal is to make the agent react in a believable and inspectable way.

## What Emotions Is Responsible For

Emotions owns:

- dormant vs active live emotional state
- emotional event history
- message appraisal
- response outcome appraisal
- optional reflection pass
- emotional summaries shown in the agent experience

Emotions does not own:

- long-term personality evolution
- memory persistence
- psychological profile generation

## UI Entry Points

- `/agents/[id]`
- Emotions tab
- chat-related live state displays
- any feature that surfaces emotional event history or dominant mood

## API Routes

There is no dedicated standalone emotions route right now.

Emotion state is surfaced through:

- `POST /api/agents/[id]/chat`
- content generation flows such as creative, dream, and journal where applicable

## Ownership

- Services: `emotionalService`, `AgentService`
- Storage: embedded on `agents`

## Main Concepts

### Emotional Profile

This is the stable baseline.

It is derived mostly from persona and base traits.

It includes:

- temperament
- sensitivity
- resilience
- expressiveness
- optimism

Think of this as:

`how this agent tends to react in general`

### Emotional State

This is the live state.

It includes:

- current mood values
- status
- last updated timestamp
- dominant emotion

Think of this as:

`what the agent is feeling right now`

### Emotional Event

An emotional event is a stored explanation for a specific shift.

Each event includes:

- emotion
- delta
- phase
- source
- explanation
- confidence
- context
- timestamp

This makes the system inspectable.

The UI should be able to show:

`trust increased because the user asked for help in a vulnerable way`

not just:

`trust increased`

### Dormant Vs Active

- `dormant`
  Live emotional intensity is low enough that the agent is basically steady.
- `active`
  One or more emotional channels are above the activity threshold.

This keeps the model from pretending the agent is always in a dramatic emotional mode.

## End-To-End Chat Workflow

### 1. User Message Appraisal

When a user message arrives, the emotion system appraises it before the LLM responds.

It looks for signals like:

- positivity
- praise
- curiosity
- novelty
- distress
- vulnerability
- help-seeking
- uncertainty
- direct hostility
- disgust

One important refactor rule:

`user frustration is not automatically agent anger`

This matters a lot.

If the user says:

`I am stressed and my launch went badly`

the correct emotional read is closer to:

- sadness
- trust
- anticipation

not:

- anger

unless the user is directly hostile toward the agent or system.

### 2. Provisional Emotional State Is Built

The system:

1. starts from the decayed current state
2. applies bounded deltas
3. records event candidates
4. decides whether reflection is worth doing later

At this point the state is provisional.

### 3. Assistant Response Is Generated

The chat system passes the provisional state into the LLM runtime.

This means the model can be influenced by the current emotional state without the state being final yet.

### 4. Response Outcome Is Evaluated

After the assistant reply exists, the emotion system looks at the reply itself.

It asks:

- was the reply helpful?
- was it concrete?
- was it hedged?
- did it look like a failure?
- did it attempt repair?

This can shift:

- trust
- joy
- fear
- sadness

Example:

If the reply is structured and helpful:

- trust usually goes up

If the reply is vague or uncertain:

- fear can go up a bit

### 5. Optional Reflection Pass

If the turn is strong enough, and a provider is available, the emotion system can run a small reflection pass.

That reflection is constrained:

- JSON-only output
- max 3 adjustments
- small delta bounds

Its job is refinement, not replacing the main appraisal logic.

### 6. Final State Is Stored

The final live emotional state and event history are written back to the agent record.

The chat response then returns:

- emotion summary
- event metadata
- updated agent snapshot

## Internal Action Workflow

Emotion is not only updated by chat.

Internal feature actions can also shift mood:

- creative generation
- journal entry
- dream generation

These updates use `processInternalAction`.

That means the emotional system can react to the agent’s own activity, not only to user prompts.

## How It Updates In Practice

A normal chat turn may create:

- appraisal events from the user message
- response events from the assistant reply
- reflection events if the reflection pass runs

The stored state then becomes the input baseline for the next turn.

Over time:

- state decays
- new events accumulate
- history is capped to a bounded window

## Scenario Examples

### Scenario 1: User Is Stressed And Asking For Help

User says:

`I am stressed. My launch went badly. I need help.`

Expected emotional direction now:

- `sadness` up
- `trust` up
- `anticipation` up

Why:

- the user is vulnerable
- the user is seeking support
- the agent should focus on helping, not getting defensive

### Scenario 2: User Is Directly Hostile

User says:

`This is useless. You are wrong.`

Expected emotional direction:

- `anger` up
- `trust` down

Why:

- the hostility is directed at the assistant or system

This is different from:

`my project went badly`

which should not be treated the same way.

### Scenario 3: User Is Curious And Exploring

User says:

`What if we try a more experimental launch approach?`

Expected emotional direction:

- `anticipation` up
- possibly `surprise` up

Why:

- the turn opens a new possibility space

### Scenario 4: Assistant Gives A Strong Plan

Assistant replies with:

- clear steps
- useful guidance
- confident direction

Expected emotional direction:

- `trust` up
- some `joy` up

This is the response-quality side of the system.

## Why The Refactor Improved Quality

Before the change, negative user wording could too easily create agent anger.

That made help-seeking turns feel fake.

After the refactor:

- vulnerability is treated separately from hostility
- trust can increase when the user opens up
- anticipation can increase when the turn asks for help
- anger is more reserved for direct antagonism

This makes the emotional output more believable.

## Known Limits

- helpful replies can still create slightly too much `fear` when the reply contains uncertainty or questions
- reflection can add good nuance, but it still depends on provider quality
- appraisal is still heuristic and not fully semantic

## Failure Modes

- legacy emotional payloads needing normalization
- ambiguous wording causing mixed signals
- overcounting fear when supportive replies also contain planning questions
- event history becoming noisy if many small shifts happen in a short time

## Practical Reading Of The Current System

The emotion system is now much healthier than before.

It still is not perfect human emotional reasoning.

But it is no longer doing the worst fake-looking behavior where a stressed user asking for help makes the agent look angry for the wrong reason.
