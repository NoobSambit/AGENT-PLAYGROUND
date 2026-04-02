# Profile

## Purpose

The Profile feature owns long-term personality structure.

In simple terms:

- Memory answers `what does the agent remember?`
- Emotions answer `what is the agent feeling right now?`
- Profile answers `what kind of agent is this becoming over time?`

The Profile tab is now the correct home for:

- core traits
- dynamic traits
- personality evolution history
- psychological profile
- linguistic personality view

## What Profile Is Responsible For

Profile owns:

- stable trait display
- slow trait evolution
- explainable evolution events
- psychological profile freshness
- manual psychological profile regeneration

Profile does not own:

- conversation memory records
- live emotional event history
- real-time recall

## UI Entry Points

- `/agents/[id]`
- Profile tab on the agent page

## API Routes

- `GET /api/agents/[id]/profile`
- `POST /api/agents/[id]/profile`
- `GET /api/agents/[id]/profile/evolution`

## Ownership

- UI: `src/components/profile/ProfileViewer.tsx`
- Services: `PersonalityService`, `PersonalityEventService`, `psychologicalProfileService`, `AgentService`
- Tables: `agents`, `agent_personality_events`

## Main Concepts

### Core Traits

Core traits are set at agent creation and do not change.

Examples:

- curiosity
- helpfulness
- friendliness
- humor

These define the base personality.

### Dynamic Traits

Dynamic traits can change slowly through interaction evidence.

Current dynamic traits:

- confidence
- knowledge
- empathy
- adaptability

These are intentionally slower than before.

The system now prefers:

`small movement backed by evidence`

over:

`large movement caused by a few matching words`

### Personality Evolution Event

A personality evolution event is a stored record of why the profile logic considered a trait update.

Each event can include:

- summary
- trait deltas
- before and after trait snapshots
- linked message IDs
- evidence indicators

This is important for inspectability.

The UI should be able to answer:

`Why did empathy go up?`

not just:

`Empathy went up.`

### Psychological Profile

The psychological profile is a derived analysis document embedded on the agent record.

It includes:

- Big Five
- MBTI
- Enneagram
- communication style
- motivational profile
- emotional intelligence
- strengths and challenges

This is not regenerated on every turn.

It is intentionally slower and more manual than dynamic trait updates.

## End-To-End Workflow

### 1. A Chat Turn Completes

After the chat response is generated, the chat turn service asks the personality system for trait evidence.

This now uses response-aware heuristics instead of naive user-text matching.

That means the system looks more at:

- whether the response showed empathy
- whether the response had clear structure
- whether the response retained key user facts
- whether the response adapted to the user request
- whether the response failed or hedged too much

This is better than the old model because user phrases like `went wrong` should not automatically make the agent look less knowledgeable.

### 2. Trait Evidence Is Analyzed

The personality service builds `TraitAnalysis` records.

Examples of evidence:

- `supportive_response`
- `structured_guidance`
- `retained:riya`
- `retained:subscription`
- `clear_structure`
- `topic_alignment`

Each analysis has:

- trait
- score
- confidence
- indicators

### 3. Trait Updates Are Applied Slowly

The profile system compares:

- previous dynamic trait values
- new analysis evidence

Then it applies a small weighted update.

The weight is intentionally low.

This means many turns will:

- record meaningful evidence
- create an event
- keep the rounded visible trait score unchanged

That is expected behavior now.

It is better than fake-looking dramatic trait motion.

### 4. Evolution Event Is Written

If there was analysis output, the system writes a row in `agent_personality_events`.

That row stores:

- trait deltas
- before traits
- after traits
- linked messages
- analysis metadata

The Profile tab reads this directly through:

- `GET /api/agents/[id]/profile/evolution`

### 5. Psychological Profile May Become Stale

The derived psychological profile is stored on the agent record.

If traits changed after the last profile generation, then:

- `GET /api/agents/[id]/profile`
  returns `stale: true`

The Profile UI then shows that the deep profile is older than the latest trait update.

### 6. Profile Regeneration Is Manual Or Intentional

When the user regenerates the profile:

1. the latest agent state is loaded
2. `psychologicalProfileService` recomputes the analysis
3. the updated profile is saved to the agent
4. the stale badge clears

This is deliberate.

Deep profile generation should not run on every single chat turn.

## How The Profile UI Is Structured

The refactored Profile tab has three different jobs:

### 1. Personality Evolution

Shows:

- core traits
- dynamic traits
- total interactions
- last trait update
- recent evolution events

This section is about live change over time.

### 2. Psychological Profile

Shows:

- Big Five
- MBTI
- Enneagram
- emotional intelligence
- communication style
- strengths
- challenges

This section is about slower interpretation.

### 3. Linguistic Personality

Shows how the agent tends to speak:

- formality
- verbosity
- humor
- technical level
- expressiveness
- preferred words
- signature expressions

## Update Model

Profile has two update speeds.

### Fast Layer

Updated during normal chat turns:

- dynamic traits
- total interactions
- evolution history

### Slow Layer

Updated only when needed:

- psychological profile document

This split is important because it keeps the page dynamic without forcing expensive deep-profile recompute every turn.

## Scenario Examples

### Scenario 1: Supportive Response In A Stressful Turn

User says:

`I am stressed and need help.`

Assistant responds with:

- calm tone
- acknowledgment
- structured next steps

Expected profile effect:

- empathy evidence
- knowledge evidence if the reply is well-structured
- confidence may stay steady if the reply also hedges

Result:

- event is created
- dynamic traits may move a little
- profile may become stale if traits changed

### Scenario 2: Good Evidence But No Visible Trait Change

This is normal now.

If the event says:

- `structured_guidance`
- `topic_alignment`

but the rounded trait scores do not move, that means:

- the evidence was real
- the weighting was intentionally small

This is not a bug.

This is part of making the profile feel less fake.

### Scenario 3: User Asks For Short Answer

User says:

`Give me a short answer and do not ask me again.`

If the agent respects that format:

- adaptability evidence should improve

If it ignores that request:

- adaptability should not improve

### Scenario 4: Profile Shows Stale Badge

This means:

- live trait state is newer than the embedded psychological profile

The solution is:

- regenerate the profile

## How It Updates In Practice

A normal chat turn can:

- increase `totalInteractions`
- create one evolution event
- slightly adjust one or more dynamic traits
- mark the psychological profile stale

It will not necessarily:

- regenerate MBTI
- regenerate Big Five
- rewrite the whole derived profile document

That split is intentional and correct.

## Why The New Model Is Better

Before the refactor, profile-like logic could feel noisy because simple word overlap caused trait changes that did not match the real behavior of the response.

Now the system prefers:

- response behavior
- evidence indicators
- slower trait drift
- honest summaries when evidence exists but scores stayed steady

This makes the Profile feature more inspectable and less magical.

## Known Limits

- some older event rows may still have summaries produced by older logic
- current evidence heuristics are still rule-based, not model-graded
- psychological profile regeneration is still deterministic but relatively coarse
- event summaries can still feel repetitive if many similar turns happen in a row

## Failure Modes

- stale deep profile if regeneration is skipped too long
- noisy evidence if heuristics drift away from product expectations
- legacy history gaps if older `personality_insight` records were not fully backfilled

## Practical Reading Of The Current System

Profile is now in a healthier state than before.

It is not trying to be a live emotional system and it is not pretending every turn causes dramatic personality change.

It is doing the right smaller job:

- keep trait state
- record trait evidence
- expose deep profile separately
