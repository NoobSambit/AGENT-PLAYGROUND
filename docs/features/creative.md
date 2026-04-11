# Creative

## Purpose

The Creative feature is now a real `Creative Studio`, not a one-shot generator.

It lets a user:

- write a structured creative brief
- inspect which agent signals were used
- generate a first draft
- review an explicit rubric evaluation
- trigger one bounded repair pass when quality misses the gate
- publish the final artifact into a library view

The feature is intentionally scoped to actual creative formats:

- `story`
- `poem`
- `song`
- `dialogue`
- `essay`

Legacy utility-writing formats are no longer part of the main Creative surface.

## UI Entry Point

- `/agents/[id]` -> `Creative`

The tab is split into:

- `New Session`
- `Library`

`New Session` is the working surface.
`Library` is the published artifact view.

## Main User Value

The user should be able to answer:

- what brief did I actually give the agent?
- what context from the agent was used?
- did the output sound like this agent or like a generic model?
- what quality issues were detected?
- did the system revise the draft before publication?
- what final artifact was published?

## API Routes

- `GET /api/agents/[id]/creative`
- `POST /api/agents/[id]/creative`
- `GET /api/agents/[id]/creative/sessions/[sessionId]`
- `POST /api/agents/[id]/creative/sessions/[sessionId]/generate`
- `POST /api/agents/[id]/creative/sessions/[sessionId]/publish`

## Runtime Flow

### Bootstrap

1. UI opens the Creative tab.
2. UI calls `GET /api/agents/[id]/creative`.
3. The server returns:
   - allowed formats, tones, and lengths
   - suggested defaults derived from the agent
   - candidate context signals
   - recent creative sessions
   - published library items

### Session Creation

1. User fills the structured brief.
2. UI calls `POST /api/agents/[id]/creative`.
3. The server:
   - normalizes the brief
   - rejects underspecified intent
   - creates a draft creative session
   - records a `brief_normalized` pipeline event

### Generation

1. UI calls `POST /api/agents/[id]/creative/sessions/[sessionId]/generate`.
2. The server:
   - gathers ranked agent context
   - saves a `context_selected` pipeline event
   - generates a first draft
   - evaluates the draft against the creative rubric
   - runs one repair pass if the draft fails the gate
   - saves all generated artifacts and pipeline events
   - updates the session with the latest evaluation and final artifact reference

### Publish

1. UI calls `POST /api/agents/[id]/creative/sessions/[sessionId]/publish`.
2. The server:
   - marks the final artifact as published
   - marks the session as published
   - increments agent creative counters only at publish time
   - records a `published` pipeline event

## Creative Context Packet

The new prompt builder does not rely only on `persona`.

It can pull from:

- persona
- goals
- linguistic profile
- psychological profile
- live emotional state and recent emotional history
- recent messages
- recent memories
- recent journal entries
- recent dreams
- prior published motifs

Each selected signal is stored with:

- source type
- label
- snippet
- reason
- weight

This makes the prompt-time creative context inspectable instead of hidden.

## Quality Evaluation

The quality gate is explicit.

The evaluator scores:

- `formatFidelity`
- `originality`
- `voiceConsistency`
- `emotionalCoherence`
- `specificity`
- `readability`

The stored evaluation includes:

- pass/fail
- overall score
- per-dimension rationale
- strengths
- weaknesses
- repair instructions
- evaluator summary

This replaces the older random creative/coherence/emotion percentages.

## Data Model

### Tables

- `creative_sessions`
- `creative_artifacts`
- `creative_pipeline_events`
- `agents`

### Firestore Mirrors

- `agents/{id}/creative_sessions`
- `agents/{id}/creative_artifacts`
- `agents/{id}/creative_pipeline_events`

## Hard Reset Behavior

The Creative Studio revamp intentionally does **not** preserve legacy `creative_works`.

Migration behavior:

- old `creative_works` rows are dropped
- agent `creative_works` counters are reset
- only new published studio artifacts count toward Creative totals

## Evaluation Workflow

The repo now includes a repeatable local creative evaluation script:

- `npm run creative:evaluate`

It:

- finds `Nova Forge`
- runs fixed creative briefs through the new session API
- records rubric results
- publishes at least one final artifact for rendering inspection

This is the expected local regression check for future Creative changes.
