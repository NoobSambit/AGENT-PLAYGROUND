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

### Learning Side

The chat turn now also drives the learning system.

The server:

- records a `learning_observation` for the turn
- resolves the previous pending observation using the new user message as follow-up evidence
- groups repeated observations into confirmed `learning_patterns`
- turns strong patterns into active `learning_adaptations`
- feeds active adaptations back into later prompts

This matters because the learning tab no longer creates its own learning data on page load.

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
