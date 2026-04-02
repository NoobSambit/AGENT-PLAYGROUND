# Learning

## Purpose

The learning system turns normal chat turns into an evidence-based feedback loop.

In simple terms:

1. the agent handles a real conversation turn
2. the server records what strategy it used
3. the next user turn is treated as follow-up evidence
4. repeated evidence becomes a confirmed learning pattern
5. confirmed patterns become active adaptations
6. active adaptations are fed back into future prompts as learned behavior policies

This makes the feature more than a dashboard. It becomes a lightweight behavior-improvement system.

## Main User Value

The user should be able to answer:

- what did the agent do?
- did that seem to help or hurt?
- what repeated enough to count as a pattern?
- what behavior did the system actually change because of that pattern?
- is the next response likely to improve because of what was learned?

## UI Entry Points

- `/agents/[id]`

The learning tab now shows:

- recent evidence
- confirmed patterns
- active learning goals
- active behavior changes
- skill progression

## API Routes

- `GET /api/agents/[id]/learning`
- `POST /api/agents/[id]/learning`
- `POST /api/agents/[id]/chat`

Important detail:

- `GET /api/agents/[id]/learning` is now read-only state retrieval
- real learning updates happen during `POST /api/agents/[id]/chat`
- the manual `POST /api/agents/[id]/learning` actions remain available for targeted feature operations

## Ownership

- Route orchestration: `src/app/api/agents/[id]/learning/route.ts`
- Chat-triggered learning orchestration: `src/lib/services/learningService.ts`
- Learning inference and scoring: `src/lib/services/metaLearningService.ts`
- Prompt application: `src/lib/langchain/agentChain.ts`
- Dashboard UI: `src/components/learning/MetaLearningDashboard.tsx`

## Working System

### 1. Turn Observation

Every completed chat turn can create one `LearningObservation`.

A learning observation stores:

- task type
- dominant learning category
- strategies used by the response
- evidence signals
- provisional score
- final score
- outcome
- follow-up status
- feedback signal
- linked message IDs

This is the key change in the feature.

The old system mostly guessed from keyword matches in conversation history.

The upgraded system first stores concrete turn evidence.

### 2. Follow-Up Resolution

When the next user message arrives, the server checks whether the previous learning observation is still `pending`.

If it is, the next user message is treated as follow-up evidence.

Examples:

- `Thanks, that helps` pushes the previous observation upward
- `Too vague` pushes the previous observation downward
- moving on without pushback gives a small neutral/positive bump

This is how the feature becomes outcome-based instead of purely heuristic.

### 3. Pattern Confirmation

Observations do not become patterns immediately.

The system groups repeated observations by:

- learning category
- task type
- dominant strategy

Once enough repeated evidence exists, the system creates or updates a `LearningPattern`.

A pattern includes:

- pattern sentence
- trigger summary
- effectiveness
- confidence
- evidence count
- examples
- first and last observed timestamps

### 4. Adaptation Generation

Confirmed patterns can produce `LearningAdaptation` records.

An adaptation is the system’s current learned policy.

Examples:

- use stored memory directly on recall requests
- ask one clarifying question before fully answering ambiguous requests
- prefer structured responses for complex help
- acknowledge emotion before advice on support-oriented turns
- keep thank-you and acknowledgement turns short instead of restarting the task
- treat explicit `brief` or `short` requests as a hard response-length constraint

Each adaptation includes:

- description
- instruction
- impact score
- confidence
- evidence count
- evaluation summary

### 5. Prompt Application

Active adaptations are converted into prompt-time guidance and injected into the system prompt.

That means learning is not only displayed.

It can change future responses.

### 6. Goals And Skills

The system also keeps:

- `LearningGoal` rows for weak or under-evidenced areas
- `SkillProgression` rows for practice over time

These are downstream views of the evidence layer, not the source of truth.

## When The System Updates

### Always

The learning system updates after every completed chat turn.

This happens inside the chat workflow, not when someone opens the learning tab.

### On The Next User Turn

The previous pending observation is resolved when the next user message arrives.

That makes the timing of updates:

1. current turn creates a provisional observation
2. next user turn resolves the previous observation
3. the server rebuilds patterns, goals, and adaptations

### On Learning Tab Read

The learning tab only reads and summarizes the current state.

It does not trigger fresh learning analysis anymore.

That avoids stale or misleading “learned” output created only because the dashboard was opened.

## Data Model

### Tables

- `learning_patterns`
- `learning_goals`
- `learning_adaptations`
- `learning_events`
- `learning_observations`
- `skill_progressions`
- `agent_rate_limits`

### Firestore Subcollections

- `agents/{id}/learning_patterns`
- `agents/{id}/learning_goals`
- `agents/{id}/learning_adaptations`
- `agents/{id}/learning_events`
- `agents/{id}/learning_observations`
- `agents/{id}/skill_progressions`
- `agents/{id}/rate_limits`

## End-To-End Workflow

### Chat Turn

1. User sends a message.
2. `POST /api/agents/[id]/chat` runs.
3. The normal chat flow stores messages, updates emotion, memory, and profile state.
4. `LearningService.processChatTurn(...)` runs.
5. The service resolves the previous pending observation if one exists.
6. The service creates a new observation for the current turn.
7. The service rebuilds confirmed patterns from recent observations.
8. The service upserts goals and adaptations.
9. The service can also create corrective adaptations directly from repeated high-signal failures such as ignored brevity requests or overextended acknowledgement turns.
10. The service advances skills from the observation evidence.
11. The route returns `changedDomains` including `learning`.

### Dashboard Read

1. UI calls `GET /api/agents/[id]/learning`.
2. The server loads patterns, goals, adaptations, skills, and observations.
3. `metaLearningService.getMetaLearningState(...)` builds the summary view.
4. The dashboard renders:
   - overview stats
   - capabilities
   - recommendations
   - active behavior changes
   - recent evidence
   - patterns
   - goals
   - skills

## Scenario-Based Example

### Scenario A: Ambiguous Request, Then Correction

User says:

`I need help with my launch.`

The agent answers with a generic response.

The server records an observation like:

- task type: `general_chat`
- strategy: `direct_answer`
- follow-up status: `pending`

Next user message:

`Too vague. I need a short recovery plan for my failed tea subscription app launch.`

Now the previous observation is resolved with negative evidence.

The new turn may create a better observation:

- task type: `factual_help`
- strategy: `structured_response`
- outcome: better than the previous turn

If that kind of structured response keeps working, a pattern can be confirmed and the system can create an adaptation like:

`For complex factual requests, answer with a short framing sentence and ordered steps.`

### Scenario B: Memory Recall Becomes A Learned Policy

User says:

`Remember that my name is Riya and I am building a tea subscription app.`

Later user says:

`What is my name and what am I building?`

If the agent answers directly from memory and the next message confirms it helped, the system can confirm a memory-retention pattern.

That pattern can produce an adaptation like:

`On recall questions, prefer retrieved memory and answer directly when confidence is reasonable.`

This adaptation is then injected into future prompts.

## Why This Is More Meaningful Than Before

The older version mainly did this:

- scan text
- guess patterns from keywords
- show heuristic scores

The upgraded version does this:

- log real turn evidence
- use the next user turn as follow-up validation
- promote repeated evidence into patterns
- convert patterns into active response policies
- feed those policies back into future prompts

That is still lightweight and heuristic-driven, but it is much closer to an inspectable learning loop.

## Known Limits

- The system still uses deterministic heuristics, not deep model-based reward learning.
- Follow-up resolution is based on observable user signals, not hidden user satisfaction.
- A pattern needs repeated evidence before it becomes trustworthy.
- Some task types will need more domain-specific heuristics over time.
- Ollama is useful for testing output quality locally, but the runtime learning system does not require Ollama in production.

## Failure Modes

- repeated observations never converge into patterns because the grouping is too strict
- overly noisy prompts can create low-confidence observations
- a helpful turn may remain `pending` until the next user message arrives
- adaptations can become stale if behavior changes but evidence volume stays low
- Firestore and PostgreSQL can drift during dual-write cutover if mirrored writes fail repeatedly

## Verification Notes

Meaningful verification should include both:

- state verification
- response verification

State verification checks:

- observations are created on chat
- follow-up feedback resolves the previous observation
- repeated observations become patterns
- patterns create active adaptations

Response verification checks:

- active adaptations appear in learning state
- later responses reflect those adaptations in a believable way
