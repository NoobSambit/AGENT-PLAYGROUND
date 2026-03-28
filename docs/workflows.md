# Workflow Guide

This guide documents the main product and engineering workflows. It answers a practical question: how does work actually move through the system?

## 1. Create A New Agent

Main route:

- `/agents/new`

User flow:

1. Enter a name.
2. Describe the persona.
3. Add one or more goals.
4. Submit the form.

System flow:

1. The form calls `useAgentStore.createAgent()`.
2. The store sends a `POST` request to `/api/agents`.
3. `AgentService.createAgent()` generates the first full agent state.
4. Firestore stores the new agent document.
5. The UI redirects to the dashboard.

What gets initialized automatically:

- personality traits
- linguistic profile
- emotional baseline
- default progress
- default stats
- psychological profile
- enhancement counters

## 2. Chat With One Agent

Main route:

- `/agents/[id]`

User flow:

1. Open an agent workspace.
2. Go to the chat tab.
3. Send a message.

System flow:

1. `messageStore.sendMessage()` posts to `/api/messages`.
2. The message is saved through `MessageService`.
3. The route updates the agent’s stats and emotional state.
4. Achievement checks run.
5. The updated message and agent record are returned.
6. The store updates local UI state.

Why this matters:

The chat workflow is not only message persistence. It is also one of the main triggers for evolution in:

- stats
- achievements
- emotions
- long-term identity signals

## 3. Review Memory And Growth

Main route:

- `/agents/[id]` -> memory tab

User flow:

1. Open the memory tab.
2. Inspect memory records and summary statistics.
3. Delete or review important memories.

System flow:

1. The page loads memories through `/api/memory?action=get`.
2. Stats load through `/api/memory?action=getStats`.
3. `MemoryService` pulls active records and computes memory stats.
4. Soft deletion marks memories inactive and decrements `memoryCount`.

Related workflow:

Memory summarization can be triggered through the memory API for compact recall.

## 4. Inspect Emotion, Progress, And Timeline

Main route:

- `/agents/[id]`

User flow:

1. Open tabs such as emotions, achievements, or timeline.
2. Review how the agent has changed over time.

System flow:

- emotional state comes from agent fields updated during feature actions
- progress and achievements come from agent-level counters and unlock logic
- timeline events are aggregated from stored events and histories

These tabs are important because they make agent behavior explainable rather than opaque.

## 5. Generate Creative Work, Dreams, And Journals

Main routes:

- `/agents/[id]` -> creative
- `/agents/[id]` -> dreams
- `/agents/[id]` -> journal

Shared flow pattern:

1. The user triggers generation from the workspace.
2. The route loads the current agent plus relevant context.
3. The server calls Gemini or Groq.
4. The response is parsed into a structured record.
5. The record is stored in an agent subcollection.
6. Agent counters are updated through progress services.

Important safeguards:

- journal generation has a daily per-agent limit
- learning analysis has a daily per-agent limit
- bounded generation protects free-tier usage

## 6. Build Relationship State

Main routes:

- `/agents/[id]` -> relationships
- `/api/relationships`
- `/api/conflicts`

User flow:

1. Open relationship views inside an agent workspace.
2. Inspect trust, respect, affection, and familiarity.
3. Review conflict analysis when disagreements happen.

System flow:

1. Relationship data is stored under each agent’s relationship subcollection.
2. Updates can be triggered by interactions and simulation outcomes.
3. Conflict analysis stores structured diagnostics in the `conflicts` collection.

This workflow matters because multi-agent behavior becomes more believable when prior social state changes future prompts.

## 7. Run A Multi-Agent Simulation

Main route:

- `/simulation`

User flow:

1. Select at least two agents.
2. Enter a discussion topic.
3. Set the round limit.
4. Start the simulation.
5. Review transcript and metadata.

System flow:

1. The page posts to `/api/multiagent`.
2. The route builds round prompts with relationship and consensus context.
3. Agents respond in sequence across rounds.
4. The system detects conflicts when language suggests disagreement.
5. Collective intelligence artifacts are generated.
6. The simulation is stored in Firestore.

Outputs you can inspect after a run:

- transcript messages
- conflict analyses
- expert referrals
- consensus snapshots
- broadcasts

## 8. Manage Shared Knowledge

Main routes:

- `/api/knowledge`
- `/agents/[id]` knowledge tabs

Workflow:

1. Create or promote knowledge records.
2. Endorse or dispute them.
3. resolve disputes when consensus changes.
4. retrieve relevant knowledge for later reasoning.

This turns useful conclusions into reusable system memory instead of leaving them buried in transcripts.

## 9. Run Learning And Mentorship Loops

Main routes:

- `/api/agents/[id]/learning`
- `/api/mentorship`

Learning workflow:

1. Analyze conversation history.
2. Detect patterns.
3. Generate learning goals.
4. Update skill progression.
5. Create adaptations.

Mentorship workflow:

1. Create a mentorship pairing.
2. Start a session.
3. Complete the session.
4. change focus or status if needed.
5. Generate prompts or lessons for the next step.

These features move the platform beyond static agents and toward developmental behavior.

## 10. Typical Product Journey

For a new user, the cleanest flow is:

1. Create one strong agent.
2. Chat with it and generate some memory.
3. Open its workspace and inspect emotions, memory, and profile tabs.
4. Create a second agent.
5. Run a simulation.
6. Inspect relationships, conflicts, and knowledge outputs.
7. Add creative, journal, dream, learning, and mentorship activity as needed.

## 11. Typical Engineering Change Workflow

When changing the product:

1. identify the primary layer being changed
2. check the dependent layers
3. update types and API contracts together
4. verify loading, empty, and error states
5. run `npm run lint`
6. run `npm run build` for non-trivial changes
7. update these docs if behavior changed

Cross-layer review is important in this repository because many features write summary fields back onto the main agent record.
