# Creative

## 1. Purpose and user intent

The Creative tab is the agent’s long-form artifact studio. It is used to draft, evaluate, repair, and publish stories, poems, songs, dialogues, and essays grounded in recent agent context.

## 2. UI entry points and key controls

- Entry point: `CreativeStudio` in `src/components/creative/CreativeStudio.tsx`.
- Key controls:
  - format, tone, and length selectors
  - brief fields such as intent, audience, must-include, avoid, and raw prompt
  - session selection
  - generate action
  - publish action
  - library mode for published artifacts
- The selected provider from `LLMProviderToggle` determines the generation model.

## 3. End-to-end user workflow

1. Open the Creative tab.
2. `GET /api/agents/[id]/creative` loads defaults, candidate context signals, recent sessions, and library items.
3. The user edits a brief and creates a session with `POST /api/agents/[id]/creative`.
4. The user generates artifacts through `POST /api/agents/[id]/creative/sessions/[sessionId]/generate`.
5. The UI reviews quality metrics and draft artifacts.
6. If the draft passes publish checks, the user publishes through `POST /api/agents/[id]/creative/sessions/[sessionId]/publish`.

## 4. Backend workflow/pipeline

1. `creativityService.getBootstrap` or the Firestore fallback builds a suggested brief and context packet.
2. `creativityService.createSession` normalizes the brief and creates a `CreativeSession`.
3. `generateSession` builds context from recent messages, memories, and other feature signals.
4. The service calls `generateText`, normalizes output, validates required fields and source refs, and applies `applyFinalQualityGate`.
5. The service writes the session, artifacts, and pipeline events through `CreativeStudioRepository` or Firestore store helpers.
6. `publishSession` blocks publication if the final artifact or session quality state does not pass required checks.
7. On publish, the session updates `publishedArtifactId` and the agent’s `creativeWorks` counter is advanced through progress services.

## 5. API contract details

- `GET /api/agents/[id]/creative`
  - returns agent summary, supported `formats`, `tones`, `lengths`, `defaults`, `candidateSignals`, `recentSessions`, and `library`.
- `POST /api/agents/[id]/creative`
  - accepts `format`, `intent`, `audience`, `tone`, `length`, `mustInclude`, `avoid`, `referenceNotes`, `rawPrompt`.
  - returns `{ session }` with `201`.
- `GET /api/agents/[id]/creative/sessions/[sessionId]`
  - returns `{ session, artifacts, pipelineEvents }`.
- `POST /api/agents/[id]/creative/sessions/[sessionId]/generate`
  - returns updated session detail.
- `POST /api/agents/[id]/creative/sessions/[sessionId]/publish`
  - returns updated session detail on success.
  - returns `409` with `publishBlockers` when publication is blocked.
- Edge cases:
  - In non-Postgres modes the route still mirrors session/artifact/event writes into Firestore compatibility stores.
  - Firestore mode uses a compatibility bootstrap path instead of `creativityService.getBootstrap` for some reads.

## 6. Data model mapping

- Tables:
  - `creative_sessions`
  - `creative_artifacts`
  - `creative_pipeline_events`
  - `agents.creativeWorks`
- Important session fields:
  - `status`, `qualityStatus`, `repairCount`, `promptVersion`, `failureReason`
  - `format`, `brief`, `normalizedBrief`, `contextPacket`, `latestEvaluation`
  - `draftArtifactId`, `finalArtifactId`, `publishedArtifactId`, `provider`, `model`, `publishedAt`
- Important artifact fields:
  - `status`, `artifactRole`, `normalizationStatus`, `qualityScore`, `version`, `title`, `summary`, `wordCount`, `published`, `provider`, `model`

## 7. State transitions/lifecycle

- Session state progresses from draft composition to generated draft to publishable output.
- Artifacts version within a session through `version` and role fields like draft/final/published.
- Publication is explicit and blocked until quality requirements pass.

## 8. Quality gates/validation rules

- Brief fields are normalized before generation.
- Format-specific and shared text validation runs before final evaluation.
- `applyFinalQualityGate` sets `qualityStatus`, `repairCount`, and evaluator output.
- `CreativePublishBlockedError` prevents publishing when the final artifact is not acceptable.

## 9. Failure modes and how they surface in UI/API

- Missing or invalid brief data: session creation fails with `500` and an explicit message.
- Generation failure: the route returns `500`; pipeline events and `failureReason` are the main trace.
- Publication block: `409` with structured blockers.
- Firestore/Postgres drift: in dual-write modes a session can exist in one store but lag in the mirror.

## 10. Debugging runbook

1. Inspect `/api/agents/[id]/creative` and confirm bootstrap defaults and candidate signals.
2. Inspect `creative_sessions` and `creative_artifacts` for the target session.
3. Check `creative_pipeline_events` for the failing stage.
4. Inspect `validation`, `evaluation`, `qualityStatus`, and `normalizationStatus` on the latest artifact when publication is blocked.
5. If library mode is empty, verify `creative_artifacts.published = true` and `publishedAt`.

## 11. Operational checklist

- Verify supported formats and default brief load.
- Verify generation produces at least one draft artifact.
- Verify publish blockers are explicit and stable.
- Verify published artifacts appear in the library view.
- Verify `agents.creativeWorks` stays in sync after successful publish.

## 12. How to extend safely

- Treat sessions, artifacts, and pipeline events as one unit; update all three when the pipeline changes.
- If you add a new format, update format guidance, length expectations, validation, and UI selectors together.
- Keep Firestore compatibility paths updated until the project is fully PostgreSQL-only.

## 13. Code references

- `src/app/api/agents/[id]/creative/route.ts`
- `src/app/api/agents/[id]/creative/sessions/[sessionId]/route.ts`
- `src/app/api/agents/[id]/creative/sessions/[sessionId]/generate/route.ts`
- `src/app/api/agents/[id]/creative/sessions/[sessionId]/publish/route.ts`
- `src/lib/services/creativityService.ts`
- `src/lib/repositories/creativeStudioRepository.ts`
- `src/components/creative/CreativeStudio.tsx`
- `src/lib/db/schema.ts`
