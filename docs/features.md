# Feature Guide

This guide explains the product by capability instead of by file. It is meant for both product readers and engineers who need a practical view of what the system actually does.

## Product Model

The platform revolves around one core unit: the agent.

An agent starts with:

- a name
- a persona
- a set of goals

The system then expands that seed into a richer runtime object with:

- personality traits
- a linguistic profile
- an emotional baseline
- progression state
- psychological profile data
- room to accumulate memories, relationships, creative work, and learning signals

## Primary User Surfaces

### Landing page

Route: `/`

Purpose:

- explain the product story
- direct users into agent creation, the agent directory, and simulations

### Dashboard

Route: `/dashboard`

Purpose:

- give system-wide visibility into the roster
- show aggregate agent, message, and memory counts
- route users into the next operational action

### Agent directory

Route: `/agents`

Purpose:

- search and filter the full roster
- compare status, memory growth, and enhancement coverage before opening a workspace

### Agent creation

Route: `/agents/new`

Purpose:

- create a new agent from name, persona, and goals
- automatically scaffold the personality, emotional baseline, linguistic profile, progression state, and psychological profile

### Agent workspace

Route: `/agents/[id]`

Purpose:

- operate one agent from a single surface
- inspect live state, long-term history, and advanced enhancement modules

### Simulation lab

Route: `/simulation`

Purpose:

- run multi-agent discussions
- review transcript output and metadata such as referrals, consensus, broadcasts, and conflict analysis

## Core Feature Areas

### 1. Agent identity and initialization

When a new agent is created, the backend does more than store form input.

It derives:

- core personality traits
- dynamic traits
- linguistic profile
- emotional baseline and default emotional state
- default achievement progress
- default stats counters
- psychological profile

This makes new agents immediately usable across the workspace instead of waiting for each subsystem to initialize later.

### 2. Chat and message persistence

Single-agent chat is handled through `/api/messages`.

What happens:

- user and agent messages are stored in Firestore
- agent stats are updated after message creation
- emotional state can shift based on user input
- achievements can unlock as usage grows
- current agent state is pushed back into the store

Important message metadata can include:

- model name
- reasoning context
- tool usage
- room or simulation context

### 3. Memory system

The memory layer gives agents continuity across interactions.

Supported memory types:

- conversation
- fact
- interaction
- personality insight

Capabilities:

- create, read, update, and soft delete memories
- keep memory counts synchronized on the agent record
- score memory importance
- retrieve recent memories
- retrieve relevant memories through lightweight scoring
- summarize batches of memories with an LLM

The current implementation uses Firestore plus ranking logic in the service layer rather than a vector database.

### 4. Personality and emotional state

The system separates relatively stable identity from adaptive state.

Personality includes:

- core traits
- dynamic traits
- linguistic profile

Emotion includes:

- baseline mood
- current mood values across eight emotions
- dominant emotion
- emotional event history

Message creation and other feature actions can feed into emotional changes and stat progression.

### 5. Progression and achievements

Agents accumulate progression through usage.

The progression model includes:

- levels
- experience points
- skill points
- unlocked achievements
- operational stats

Stats cover things like:

- total messages
- conversation count
- unique topics
- helpful responses
- dreams generated
- creative works created
- relationships formed

This gives the system a usable feedback loop for visibility and future feature hooks.

### 6. Timeline and inspectability

The workspace is designed to make agent evolution inspectable.

Timeline-related features combine signals from:

- messages
- memories
- achievements
- emotions
- dreams
- journals
- relationships

This makes the agent easier to reason about over time instead of treating every interaction as isolated.

## Advanced Workspace Modules

These modules are exposed from the main agent page and make up the larger product story.

### Relationships

Tracks how agents relate to other agents through:

- trust
- respect
- affection
- familiarity
- interaction count
- relationship type and status
- significant social events

The system stores mirrored relationship state under each participating agent.

### Learning and meta-learning

The learning layer analyzes conversations and turns them into:

- learning patterns
- active learning goals
- adaptations
- skill progressions

It also includes daily rate limiting to stay compatible with free-tier constraints.

### Planning and scenario exploration

The workspace includes future-oriented views so agents are not only reactive.

These features cover:

- future planning
- projected risks and actions
- alternate scenarios
- parallel reality exploration

### Creative work

Agents can generate creative outputs such as stories, poems, essays, jokes, and other formats.

Outputs are stored in an agent subcollection and reflected back into agent counters.

### Dreams

Dream generation uses recent memories and emotional context to create symbolic outputs.

The feature is rate limited and persisted so dream history becomes part of the agent’s long-term state.

### Journal

Journal generation creates longer reflective entries using:

- recent memories
- emotional state
- relationships
- persona context

The endpoint enforces a daily generation limit per agent.

### Psychological profile

The profile route generates and caches a personality analysis from existing agent data instead of making it an expensive always-on LLM dependency.

### Knowledge graph and memory graph

The graph layer turns memories into connected concepts and links.

It supports:

- graph visualization
- contradiction detection
- concept insights
- graph-assisted relevant memory retrieval

### Collective intelligence

This area moves the system from single-agent behavior into network behavior.

It includes:

- expert referrals
- consensus snapshots
- knowledge repositories
- knowledge broadcasts

### Conflict resolution

The conflict layer analyzes disagreements between agents and stores:

- conflict style
- resolution style
- common ground
- friction points
- action items
- relationship impact

### Mentorship

The mentorship system supports structured agent-to-agent development.

Capabilities include:

- mentorship creation
- session creation and completion
- focus changes
- compatibility scoring
- lesson generation

### Challenges

Challenges are structured collaborative or competitive tasks for agents.

The API supports:

- challenge creation
- start and advance
- message submission
- objective completion
- response generation
- completion or abandonment

## Multi-Agent Simulation

Simulation is one of the most important product workflows because it ties multiple systems together.

A simulation run can produce:

- a conversation transcript
- relationship-aware prompts
- conflict analysis
- knowledge referrals
- consensus signals
- collective broadcasts
- a saved simulation record

That makes simulation more than group chat. It acts as a test environment for social, knowledge, and planning behavior.

## Design Intent

The product is not trying to be only:

- a chatbot shell
- a prompt playground
- a visual demo

It is trying to be an inspectable AI agent platform where identity, memory, emotion, relationships, and collaboration are first-class features.
