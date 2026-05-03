# Profile

## Purpose

Profile owns long-term personality structure.

It answers:

`What kind of agent is this becoming over time?`

## UI Entry Point

- `/agents/[id]` on the Profile tab

## API Routes

- `GET /api/agents/[id]/profile`
- `POST /api/agents/[id]/profile`
- `GET /api/agents/[id]/profile/evolution`
- `POST /api/agents/[id]/profile/runs`
- `GET /api/agents/[id]/profile/runs/[runId]`
- `POST /api/agents/[id]/profile/runs/[runId]/execute`

## Ownership

- Service: `src/lib/services/personalityService.ts`
- Evolution records: `src/lib/services/personalityEventService.ts`
- Deep profile analysis: `src/lib/services/profileAnalysisService.ts`
- Communication fingerprinting: `src/lib/services/communicationFingerprintService.ts`
- Psychological profile shaping: `src/lib/services/psychologicalProfileService.ts`
- Tables:
  - `agents`
  - `agent_personality_events`
  - `profile_analysis_runs`
  - `profile_interview_turns`
  - `profile_pipeline_events`

## Profile Layers

### Core Traits

Core traits are set at creation and do not change.

Examples:

- curiosity
- helpfulness
- friendliness
- humor

### Dynamic Traits

Dynamic traits move slowly from evidence.

Examples:

- confidence
- knowledge
- empathy
- adaptability

### Psychological Profile

The psychological profile is the richer long-form description used by the UI and by other services.

It includes:

- Big Five
- MBTI
- Enneagram
- strengths
- challenges
- triggers
- growth edges
- communication style

### Evolution History

Evolution events explain why a trait moved.

The user should be able to see:

- what evidence caused the change
- what the value was before
- what the value is after
- which messages were involved

## Deep Profile Workflow

The deep profile run is a separate, bounded workflow:

1. Create a run record.
2. Collect evidence from messages, memories, emotions, learning, and journals.
3. Run a staged interview.
4. Persist every interview turn and pipeline event.
5. Synthesize the profile.
6. Validate and evaluate the result.
7. Repair once if needed.
8. Save only if the run passes the final gate.

## Why It Matters

The profile tab is not a generic summary panel.

It is the long-horizon record of how the agent is changing.

That makes it a key trust surface.

## Failure Modes

- Evidence coverage below threshold
- Synthesis that misses required claim refs
- Unsafe update attempt while quality gate fails
- Legacy profile data with older shapes

## Related Files

- [`src/lib/services/personalityService.ts`](../../../src/lib/services/personalityService.ts)
- [`src/lib/services/profileAnalysisService.ts`](../../../src/lib/services/profileAnalysisService.ts)
- [`src/lib/services/psychologicalProfileService.ts`](../../../src/lib/services/psychologicalProfileService.ts)

