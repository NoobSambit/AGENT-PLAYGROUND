# Workflows

This file explains the main runtime workflows in simple language.

The goal is to describe what actually happens across UI, route, service, and database layers.

## Create A New Agent

### High-Level Flow

1. Open `/agents/new`.
2. Submit name, persona, and goals.
3. The server derives:
   - core personality
   - dynamic trait defaults
   - linguistic profile
   - emotional profile
   - dormant emotional state
   - stats defaults
   - psychological profile
4. The agent record is persisted.

### What Updates

- `agents`

### What Does Not Exist Yet

At creation time there are no:

- messages
- memories
- evolution events
- live emotional events

## Run Chat

This is the most important workflow for the refactored system because chat is now the main write point for memory, emotion, and profile side effects.

### High-Level Flow

1. Open `/agents/[id]`.
2. Send a message in the chat panel.
3. `POST /api/agents/[id]/chat` runs.
4. The server:
   - stores the user message
   - appraises the emotional impact of the user message
   - loads memory context for the prompt
   - loads active learning adaptations for the prompt
   - generates the assistant response
   - evaluates the emotional effect of the response
   - stores the assistant message
   - updates stats and total interaction counters
   - writes conversation memory
   - extracts and upserts fact memories
    - analyzes trait evidence
   - resolves the previous pending learning observation if the new user message acts as follow-up feedback
   - writes a new learning observation for the current turn
   - rebuilds confirmed learning patterns, active goals, and adaptations
   - advances learning skills from the latest evidence
   - stores personality evolution event if applicable
   - returns the refreshed agent snapshot plus `changedDomains` and `staleDomains`

### What Updates On Every Normal Turn

- `messages`
- `agents.emotional_state`
- `agents.emotional_history`
- `agents.stats`
- `agents.total_interactions`

### What May Also Update

- `memories`
- `agents.memory_count`
- `agent_personality_events`
- `agents.dynamic_traits`

### Why Chat Is The Canonical Side-Effect Point

The agent chain no longer hides these writes internally.

That is important because:

- message IDs exist before memory and event rows are created
- the route response can accurately say what changed
- the UI can refresh only the tabs that need it

## Chat Turn Breakdown By Feature

### Emotion Side

The server first appraises the user message.

Then it appraises the assistant response.

Then it may run a small reflection pass.

Result:

- updated live mood
- updated emotional event history
- emotion summary returned to the UI

### Memory Side

The chat turn writes:

- one conversation memory
- zero or more fact memories

Fact memories are used for canonical recall such as:

- user name
- active project
- stated preference

### Profile Side

The chat turn analyzes:

- empathy evidence
- structured guidance
- topic retention
- confidence signals
- adaptability signals

Then it:

- slightly updates dynamic traits if warranted
- stores an evolution event
- marks deep psychological profile as stale when needed

The chat turn does not automatically rerun the deep profile interview workflow.

That slower workflow is now manual and inspectable:

1. UI creates a `profile_analysis_run`
2. the server compiles bounded evidence from traits, emotions, messages, memories, and journals
3. the server runs a staged live interview with the agent
4. each interview turn and pipeline event is persisted while the run is still in progress
5. the server synthesizes and evaluates the resulting profile
6. one bounded repair pass may run if quality misses the gate
7. the latest successful output is written back to `agents.psychological_profile`

### Learning Side

The chat turn now also drives the learning system.

The server:

- records a `learning_observation` for the turn
- resolves the previous pending observation using the new user message as follow-up evidence
- groups repeated observations into confirmed `learning_patterns`
- turns strong patterns into active `learning_adaptations`
- feeds active adaptations back into later prompts
- blocks generic or style-breaking assistant drafts with one bounded repair pass before persistence when the chat output-quality gate fails

The chat turn can also include active dream residue in prompt assembly when `agents.activeDreamImpression` exists and is still unexpired.

When that happens the stored assistant message writes lightweight inspectable metadata:

- `metadata.dreamImpression.sourceDreamId`
- `metadata.dreamImpression.behaviorTilt`
- `metadata.dreamImpression.expiresAt`

## Run Dream Workspace V2

### High-Level Flow

1. Open `/agents/[id]`.
2. Switch to `Dreams`.
3. `GET /api/agents/[id]/dream` returns bootstrap state.
4. User chooses dream type, optional note, and optional focus chips.
5. `POST /api/agents/[id]/dream` creates a draft session.
6. `POST /api/agents/[id]/dream/sessions/[sessionId]/generate` runs:
   - prepare context
   - condition subconscious
   - draft dream
   - extract symbols
   - evaluate quality
   - optional repair
   - derive impression preview
7. UI polls `GET /api/agents/[id]/dream/sessions/[sessionId]` for stage progress.
8. User reviews the result.
9. `POST /api/agents/[id]/dream/sessions/[sessionId]/save` persists the final artifact.

### What Updates

- `dream_sessions`
- `dreams`
- `dream_pipeline_events`

### What Only Save Updates

- `agents.dream_count`
- `agents.stats.dreamsGenerated`
- `agents.active_dream_impression`
- `agents.emotional_state`
- `agents.emotional_history`

### What Draft Generation Must Not Update

- timeline visibility
- archive metrics
- counters
- downstream context selection
- active behavioral residue

This matters because the learning tab no longer creates its own learning data on page load.

Dream detail responses now expose additive quality fields such as `qualityStatus`, `normalizationStatus`, `repairCount`, `promptVersion`, `validation`, and `evaluation`, plus the raw draft lineage needed for audit panels.

## Creative And Journal Quality Gates

Creative Studio and Journal Workspace now follow the same bounded contract:

1. Create a draft session.
2. Generate a raw draft.
3. Normalize the raw output into the artifact contract.
4. Run deterministic validation.
5. Run evaluation only when validation passes.
6. Attempt one bounded repair pass when needed.
7. Mark the session `ready` only when the final gate passes.
8. Save or publish only from that passing `ready` state.

If a save or publish precondition fails, the API returns `409` with machine-readable blockers instead of silently accepting the transition.

Historical creative and journal rows remain readable, but if they predate the upgraded payload contract the UI should show them as `legacy_unvalidated`.

## Profile Analysis Quality Gate

The deep profile workflow now has an explicit blocked terminal state:

1. Create a draft run.
2. Collect bounded evidence.
3. Run the interview transcript.
4. Synthesize profile claims with evidence refs.
5. Validate and evaluate the synthesis.
6. Optionally run one repair pass.
7. Update `agents.psychologicalProfile` only when the run passes the final gate.

The route still exposes `prompt` and `response` aliases for one release window, but `question` and `answer` are the canonical transcript fields.

## Phase 5 Verification Flow

Release verification now includes repo-level quality tooling in addition to lint/build:

1. Run `npm run quality:replay` against the audit fixture.
2. Run `npm run quality:benchmark` using the `ollama` / `qwen2.5:7b` baseline.
3. Run `npm run quality:validate` against either the audit fixture or the live PostgreSQL dataset.
4. Run `npm run lint`.
5. Run `npm run build`.

If PostgreSQL backfill is needed during rollout, run `npm run db:migrate` first and then `npm run quality:backfill` in dry-run mode before applying writes.

## Scenario: Stress + Identity + Project

User says:

`My name is Riya. I am stressed because my tea subscription app launch went badly today. Please remember that I am building a tea subscription app.`

What happens:

1. user message row is created
2. emotion system reads the turn as:
   - vulnerability
   - need for help
   - setback
3. assistant responds
4. assistant message row is created
5. conversation memory is written
6. fact memory `identity:name` is written or refreshed
7. fact memory for the tea subscription project is written or refreshed
8. empathy and knowledge evidence can be recorded in profile evolution
9. the learning system can record an emotional-support observation and later recommend a brevity or empathy adjustment
10. chat response returns updated agent, emotion summary, and changed domains

Expected outcome:

- Emotions should lean toward `trust`, `sadness`, and `anticipation`
- Memory should remember `Riya` and `tea subscription app`
- Profile may record empathy evidence without forcing a big trait jump

## Scenario: Immediate Recall On Next Turn

User then says:

`Without asking me again, tell me my name and what product I am building.`

What happens:

1. the chat system clears memory cache
2. fact memories are loaded first into prompt memory
3. recent conversation memories are loaded after that
4. the model sees canonical fact memory for:
   - `User name is Riya`
   - `User is building a tea subscription app`
5. assistant responds using those facts

Expected outcome:

- much lower hallucination risk than transcript-only memory
- the learning system should eventually confirm that memory-backed recall works well on recall-style turns

## Run A Scenario Branch

This workflow powers the new `What-If Lab`.

### High-Level Flow

1. Open `/agents/[id]`.
2. Switch to `Scenarios`.
3. UI loads scenario bootstrap data from `GET /api/scenarios?agentId=...`.
4. User chooses:
   - one branch point
   - one intervention
5. User runs the branch with `POST /api/scenarios`.
6. The server:
   - loads the agent
   - loads recent messages
   - loads relevant memories
   - loads relationships
   - loads relevant simulation turns
   - creates a `running` scenario record
   - runs baseline probes
   - runs alternate probes with the scenario assumption applied
   - updates sandbox emotional state during the run
   - evaluates quality, flags, and score deltas
   - summarizes differences
   - saves the final scenario run
7. UI renders:
   - overview
   - turn diff
   - context

### What Updates

- `scenario_runs`

### What Does Not Update

The scenario workflow does not mutate:

- `agents`
- `messages`
- `memories`
- `agent_relationships`

That isolation is important because scenario runs are experiments, not live history.

## Scenario Example: Warmer Recovery Reply

Setup:

- branch point: user message describing a failed launch
- intervention: rewrite next reply in a warmer style

Expected behavior:

1. baseline branch stays close to the current path
2. alternate branch should:
   - acknowledge tension earlier
   - offer clearer recovery framing
   - stay concrete
3. saved comparison should show:
   - first divergence
   - stronger or weaker outcome score
   - quality score changes
   - quality flags if the output became vague or overly meta
   - practical recommendation

## Scenario Example: Trust-Shifted Planning

Setup:

- branch point: planning turn with uncertainty
- intervention: shift emotional baseline toward `trust`

Expected behavior:

1. alternate branch becomes less guarded
2. response should explain priorities more openly
3. emotion state should often end more trust-forward than baseline
4. run should be saved for later comparison

## Memory Console Workflow

### List View

1. UI calls `GET /api/agents/[id]/memories`
2. filters are applied:
   - query
   - type
   - origin
   - minimum importance
   - sort
3. legacy `personality_insight` rows are excluded from normal console reads

### Stats View

1. UI calls `GET /api/agents/[id]/memories/stats`
2. service calculates:
   - total memories
   - memories by type
   - memories by origin
   - average importance
   - newest and oldest timestamps

### Recall Query

1. UI calls `POST /api/agents/[id]/memories/recall`
2. service scores memories by:
   - keyword overlap
   - shared terms
   - summary/content/context match
   - importance
   - fact-memory boost
3. results return with match reasons

### Delete

1. UI calls `DELETE /api/agents/[id]/memories/[memoryId]`
2. memory is soft-deleted
3. `agents.memory_count` is updated
4. the console refreshes

## Profile Workflow

### Evolution View

1. UI calls `GET /api/agents/[id]/profile/evolution`
2. response returns:
   - core traits
   - dynamic traits
   - total interactions
   - last trait update time
   - recent evolution events

### Psychological Profile View

1. UI calls `GET /api/agents/[id]/profile`
2. route checks whether the deep profile is older than the latest trait update
3. response includes:
   - profile document
   - `stale`
   - `lastTraitUpdateAt`

### Regenerate

1. UI calls `POST /api/agents/[id]/profile`
2. profile is recomputed from current agent state
3. embedded profile is updated
4. stale badge clears

## Generate Agent Content

1. Use creative, dream, journal, or learning tabs on `/agents/[id]`.
2. Rate limits are checked server-side.
3. Generated output is persisted.
4. Related counters and emotional state may update depending on the feature.

### Creative Studio

1. UI loads `GET /api/agents/[id]/creative`.
2. User saves a structured brief with `POST /api/agents/[id]/creative`.
3. The server normalizes the brief and creates a draft creative session.
4. UI triggers `POST /api/agents/[id]/creative/sessions/[sessionId]/generate`.
5. The server:
   - gathers ranked context from agent state, memories, messages, journals, dreams, and prior motifs
   - generates a draft artifact
   - evaluates it against the creative rubric
   - runs one repair pass when the draft misses the gate
   - stores artifacts and pipeline events
6. UI can publish with `POST /api/agents/[id]/creative/sessions/[sessionId]/publish`.
7. Only publish increments agent creative counters.

### Journal Workspace

1. UI loads `GET /api/agents/[id]/journal`.
2. User creates a draft session with `POST /api/agents/[id]/journal`.
3. UI immediately switches into the active session workspace and triggers `POST /api/agents/[id]/journal/sessions/[sessionId]/generate`.
4. The server:
   - ranks bounded context from persona, goals, profiles, emotion, messages, memories, relationships, and saved V2 journal history
   - builds a voice packet using recent communication fingerprint evidence when enough replies exist, otherwise falls back to profile baselines
   - generates a draft journal entry
   - evaluates the draft against the stored journal rubric
   - runs one repair pass if needed
   - persists pipeline events for every meaningful stage transition
5. While generation runs, the client polls `GET /api/agents/[id]/journal/sessions/[sessionId]` and renders the stage rail from real pipeline state.
6. `POST /api/agents/[id]/journal/sessions/[sessionId]/save` is the explicit second step. Only that save:
   - marks the final version as saved
   - increments journal counters
   - updates emotional state
   - makes the entry visible to timeline and downstream consumers

## Run Multi-Agent Simulation

1. Open `/simulation`.
2. Choose agents and a prompt.
3. The server generates turns, updates relationships, captures conflicts and broadcasts, then stores the final simulation record.

## Firestore To PostgreSQL Cutover

1. Apply schema with `npm run db:migrate`.
2. Export Firestore data.
3. Dry-run import into PostgreSQL.
4. Run full backfill.
5. Run parity verification.
6. Deploy with `PERSISTENCE_MODE=dual-write-firestore-read`.
7. Promote to `dual-write-postgres-read`.
8. Finish with `PERSISTENCE_MODE=postgres`.
