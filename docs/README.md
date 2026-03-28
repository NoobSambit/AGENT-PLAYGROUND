# AGENT-PLAYGROUND Documentation

This folder is the main documentation system for `AGENT-PLAYGROUND`.

The goal is simple: make the product easy to understand without flattening the technical detail that matters when you need to build, debug, or extend it.

## What This Product Is

`AGENT-PLAYGROUND` is a Next.js application for creating AI agents that do more than answer prompts once.

Agents in this system have:

- identity through persona, goals, and generated profiles
- state through emotions, progress, and counters
- continuity through persisted messages, memories, and journals
- social context through relationships, mentorship, and conflict analysis
- collaborative behavior through simulations, shared knowledge, and collective intelligence

## Read This First

- [Getting Started](./getting-started.md)
- [Feature Guide](./features.md)
- [Architecture Guide](./architecture.md)
- [Workflow Guide](./workflows.md)
- [API Reference](./api-reference.md)
- [Data Model](./data-model.md)
- [Development Guide](./development.md)

## Documentation Map

### For product understanding

- [Feature Guide](./features.md): what the platform does and how the feature set fits together
- [Workflow Guide](./workflows.md): how users and developers move through the system end to end

### For engineering understanding

- [Architecture Guide](./architecture.md): app layers, service boundaries, persistence flow, and runtime behavior
- [Data Model](./data-model.md): important Firestore collections, agent shape, and feature-specific records
- [API Reference](./api-reference.md): route-level contract overview for the app router API endpoints

### For onboarding and contribution

- [Getting Started](./getting-started.md): local setup, environment variables, and verification
- [Development Guide](./development.md): engineering expectations, repository conventions, and change checklist

## Current Product Surface

Main UI routes:

- `/`
- `/dashboard`
- `/agents`
- `/agents/new`
- `/agents/[id]`
- `/simulation`

Main API groups:

- `/api/agents`
- `/api/messages`
- `/api/memory`
- `/api/multiagent`
- `/api/relationships`
- `/api/knowledge`
- `/api/collective-intelligence`
- `/api/conflicts`
- `/api/challenges`
- `/api/mentorship`
- `/api/llm`
- `/api/agents/[id]/*` enhancement endpoints

## Documentation Principles

This docs system follows a few rules:

- describe the implementation that exists in the repository
- use easy language first, then precise terminology
- explain both the user-facing behavior and the engineering shape behind it
- keep root-level documentation noise low by centralizing long-form docs here
