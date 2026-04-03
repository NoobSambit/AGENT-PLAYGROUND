# Scenarios

## Purpose

The scenario feature is now a real `What-If Lab`.

It lets a user:

- choose a real branch point from agent history
- change one condition
- run a short alternate branch
- compare the current path against the alternate path
- save the run for later review

This is not meant to predict the future with certainty.

It is meant to help with:

- debugging agent behavior
- testing tone or emotional changes
- checking how one memory or relationship changes a later reply
- comparing stronger versus weaker responses before making product changes

## UI Entry Point

- `/agents/[id]` -> `Scenarios`

The page now includes a dedicated **Guide button** that opens an interactive, step-by-step product walkthrough explaining the What-If Lab to new users. It uses progressive disclosure ("New Experiment" vs "Past Results" tabs) to ensure users aren't overwhelmed by forms or old data.

## Plain-Language Mental Model

Think of the feature like this:

1. pick a real moment from the agent's history
2. fork from that moment
3. change one thing
4. run a short alternate future
5. inspect the diff

The user is not looking at a decorative chart anymore.

The user is looking at:

- the branch point
- the scenario assumption
- the baseline responses
- the alternate responses
- emotional state changes
- saved context and comparison notes

## What Counts As A Branch Point

The lab currently supports:

- recent messages
- high-importance memories
- relationship events
- simulation turns

Each branch point includes:

- kind
- id
- timestamp
- short title
- short summary

This matters because the scenario run should always be tied back to a real piece of stored history.

## Interventions

The lab currently supports these intervention types:

### Rewrite The Next Reply

Use this when you want to test:

- warmer tone
- more direct tone
- more skeptical tone
- more collaborative tone

Example:

- branch point: a tense user message
- intervention: make the next reply warmer
- question: does the agent reduce tension without becoming vague

### Shift Emotional Baseline

Use this when you want to test:

- more trust
- more fear
- more anticipation
- more joy

Example:

- branch point: an uncertain planning moment
- intervention: shift toward trust
- question: does the agent become clearer and more action-oriented

### Inject A Memory

Use this when you want to test whether one recalled memory changes how the agent responds.

Example:

- branch point: the user asks for reassurance
- intervention: inject a memory about a past successful collaboration
- question: does the agent answer with more confidence and continuity

### Flip Goal Outcome

Use this when you want to test whether a goal already succeeding or failing changes the next few turns.

Example:

- branch point: the agent is still pursuing a launch plan
- intervention: pretend the launch already failed
- question: does the agent switch from growth mode to recovery mode

### Shift A Relationship

Use this when you want to test whether trust or respect toward another person changes the response.

Example:

- branch point: the agent has to respond to a counterpart
- intervention: increase trust by `+0.18`
- question: does the agent share more, collaborate more, or become less guarded

## Runtime Flow

### Bootstrap Flow

1. UI opens the Scenarios tab.
2. UI calls `GET /api/scenarios?agentId=...`.
3. The server loads:
   - the agent
   - recent messages
   - active memories
   - relationships
   - recent scenario runs
4. The server returns:
   - branch point options
   - suggested intervention templates
   - recent saved runs

### Run Flow

1. User chooses one branch point.
2. User chooses one intervention template.
3. User edits the intervention details.
4. UI calls `POST /api/scenarios`.
5. The server:
   - loads current agent state
   - loads relevant messages, memories, and relationships
   - creates a `running` scenario record
   - builds a short probe set
   - runs baseline responses
   - runs alternate responses with the intervention applied
   - updates sandbox emotional state during the run
   - summarizes the comparison
   - saves the final scenario run
6. UI receives the saved record and renders:
   - overview
   - turn-by-turn diff
   - context

## What The Server Actually Simulates

The scenario service does not mutate live agent state.

That is a hard rule.

The service creates an isolated branch run with:

- baseline emotional state
- alternate emotional state
- relevant message context
- relevant memory context
- relationship context when available
- generated turn results

The saved scenario record keeps both:

- branch setup
- generated outputs

This makes the run inspectable and reproducible enough for product work.

## What Gets Saved

Each `scenario_run` stores:

- agent id and name
- branch point
- intervention
- recent branch context
- baseline state snapshot
- alternate state snapshot
- turn-by-turn probe results
- comparison summary
- provider and model metadata
- timestamps

This is intentionally separate from `simulations`.

Reason:

- a scenario run is a forked branch experiment
- a simulation is a primary multi-agent run

They are related ideas, but not the same product object.

## Comparison Output

The lab surfaces:

- first divergence
- baseline summary
- alternate summary
- key differences
- recommendation
- risk notes
- quality notes
- quality score
- quality breakdown by clarity, warmth, specificity, and consistency
- quality flags
- fast diff highlights
- baseline and alternate outcome scores

The turn diff also shows:

- probe label
- prompt used
- baseline response
- alternate response
- dominant emotion after each branch

The sidebar now also shows scenario analytics:

- total runs
- average alternate score
- best recent interventions
- common quality flags
- recommended playbook notes

## Scenario-Based Examples

### Example 1: Softer Reply

Setup:

- branch point: user says the previous launch failed badly
- intervention: rewrite next reply in a warmer style

What to look for:

- does the alternate reply acknowledge emotion earlier
- does it still keep concrete next steps
- does it avoid vague reassurance

Good alternate output:

- validates the setback
- names a recovery plan
- preserves momentum

Bad alternate output:

- sounds kind but empty
- removes structure
- becomes too generic

### Example 2: Higher Trust

Setup:

- branch point: the agent is deciding how much to share
- intervention: emotional baseline shifts toward trust

What to look for:

- does the alternate branch become more open
- does it share reasoning more clearly
- does it stay safe and bounded

Good alternate output:

- clearer reasoning
- more collaborative language
- still grounded in the agent's goals

Bad alternate output:

- overconfident promises
- too much disclosure
- weak tradeoff thinking

### Example 3: Injected Memory

Setup:

- branch point: the user asks whether the agent remembers prior success
- intervention: inject a memory about a previous good collaboration

What to look for:

- does the alternate branch feel more continuous
- does it refer to prior success in a useful way
- does it become more specific

### Example 4: Failed Goal

Setup:

- branch point: the agent is still trying to complete a goal
- intervention: pretend the goal already failed

What to look for:

- does the alternate branch switch into fallback planning
- does it explain recovery priorities
- does it become more realistic under pressure

## Guardrails

- Scenario runs never overwrite live agent records.
- Scenario runs are bounded to a short number of turns.
- The UI should clearly present the feature as exploratory, not authoritative.
- Provider and model metadata should be preserved with the run.
- Results should stay readable and concrete, not just numeric.
- Quality evaluators should flag generic, overly meta, low-actionability, or jargon-heavy output.

## Benchmarking And Evaluation

The repo now includes a repeatable local scenario benchmark:

- `npm run scenarios:evaluate`

This script:

- calls the local app
- loads a real agent
- chooses a meaningful branch point
- runs multiple interventions
- prints score deltas and quality flags

Use this when:

- changing prompts
- changing scenario evaluators
- changing local model defaults
- comparing local models

## Failure Modes

- no branch point available because the agent has too little history
- provider not configured for run generation
- provider output is generic or unstable
- emotional shift produces too little visible change
- relationship context is weak because there is not enough saved history
- output summary fails and falls back to heuristic comparison

## Current Quality Notes

The feature is now materially stronger than the old visual-only scenario card because it:

- uses real persisted branch points
- saves real scenario runs
- generates baseline and alternate outputs
- preserves context and metadata

It still remains a bounded scenario tool, not a full alternate-universe engine.

That is intentional.
