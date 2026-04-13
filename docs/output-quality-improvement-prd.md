# Output Quality Improvement PRD

Date: 2026-04-13
Scope: emotion, memory, learning, scenarios, creative, dream, journal, profile
Primary objective: make output quality, structural validity, and cross-feature coherence production-grade without relying on model upgrades alone.

## 1. Executive Summary

The current agent feature set is not production-ready because the system does not enforce a shared output contract, does not reliably separate raw model output from normalized artifacts, and allows evaluators to pass or be ignored even when saved or published content is structurally wrong.

The strongest existing reference implementation is the dream pipeline in `src/lib/services/dreamService.ts`. The weakest integrity points are the journal, creative, and profile save/finalization flows:

- Journal can save fenced JSON as the user-facing artifact because `parseEntry` falls back to raw model text.
- Creative can mark a session ready and publish an artifact even when evaluation fails or the artifact is still a serialized wrapper.
- Profile can mark a run ready and update `agents.psychologicalProfile` even when the repaired profile still fails evaluation.

The highest-leverage implementation approach is:

1. Introduce a shared output quality core: normalize -> validate -> evaluate -> repair -> revalidate -> persist.
2. Apply hard save/publish gates to creative, journal, dream, and profile.
3. Tighten upstream chat quality and memory abstraction so downstream features stop inheriting generic, list-heavy, weakly grounded language.
4. Standardize inspectability so users can see raw draft vs normalized artifact vs repaired artifact vs saved/published result.
5. Add replayable benchmarks and production exit criteria so quality is measured continuously, not judged ad hoc.

## 2. Problem Statement

The repository currently treats several kinds of outputs as if they were final artifacts even when they are only raw model text or partially parsed drafts. This causes:

- malformed artifacts being saved or published
- evaluators passing structurally invalid content
- generic and weakly differentiated outputs across chat, scenario, and profile workflows
- limited continuity between memory, learning, emotion, and artifact-producing features
- inconsistent inspectability across workspaces

The product promise is inspectable agents with continuity, personality, memory, creativity, and simulation. The current system preserves some internal state, but the quality controls are not strong enough to ensure that what is surfaced to users is coherent, valid, and reliably in-character.

## 3. Evidence Summary

This PRD is based on the required audit artifacts and direct inspection of the current implementation.

### Audit evidence

- `docs/agent-output-quality-audit-2026-04-13.md` concludes the system is "not production-ready".
- `tmp/agent-output-audit-ari-kestrel.json` contains a saved journal entry with:
  - `title: "```json"`
  - `content` containing fenced JSON
  - `evaluation.pass: true`
- The same audit contains a published creative artifact with:
  - `title: "Title The Kestrel's Keen Eye"`
  - `summary` containing serialized JSON text
  - `content` containing a JSON wrapper rather than clean final prose
  - `evaluation.pass: true`
- The audit also contains a failed creative artifact with `overallScore: 89` but `pass: false`, showing evaluator inconsistency.
- The audited profile run ends with `overallScore: 74` and `pass: false`, but the run still completes and updates the profile.
- Scenario outputs in the audit are generic and low-actionability. Both baseline and alternate branches were flagged `low_actionability`.
- Memory evidence in the audit is dominated by raw conversation memories plus a small number of regex-extracted facts.

### Code evidence

- `src/lib/services/journalService.ts`
  - `safeParseJson` only performs direct `JSON.parse`.
  - `parseEntry` falls back to `content = llmResponse` when parsing fails.
  - This explains why fenced JSON can be saved as the final entry.
- `src/lib/services/creativityService.ts`
  - `parseArtifactFromResponse` accepts JSON, labeled sections, or raw text.
  - `generateSession` sets the session to `ready` regardless of whether the final artifact actually passed evaluation.
  - `publishSession` requires only `finalArtifactId`, not a passing final artifact.
- `src/lib/services/profileAnalysisService.ts`
  - `synthesizeProfile` uses a mostly deterministic scaffold, which explains generic outputs.
  - `executeRun` marks the run complete and updates the agent profile even after a failed repair evaluation.
- `src/lib/services/scenarioService.ts`
  - probe prompts are generic
  - quality scoring is lightweight and non-gating
  - no retry or regeneration path exists for low-quality scenario turns
- `src/lib/services/chatTurnService.ts`
  - chat output is stored after generation with no final response quality gate
  - memory extraction is mostly one conversation summary plus regex facts
- `src/lib/langchain/baseChain.ts` and `src/lib/langchain/agentChain.ts`
  - prompting is broad and persona-aware, but not strict enough to block generic assistant phrasing or weak adaptation to explicit user preferences
- `src/components/creative/CreativeStudio.tsx`
  - publish is disabled only when `!detail?.session.finalArtifactId`
  - the UI includes `getDisplayTitle` to strip malformed title prefixes instead of surfacing a validation failure
- `src/components/journal/JournalViewer.tsx` and `src/components/dreams/DreamJournal.tsx`
  - both already expose stage rails and rubric panels
  - dream save gating is stronger than creative and journal integrity in the backend
- `src/components/profile/ProfileViewer.tsx`
  - inspectability is already strong, but it currently visualizes runs that can still be semantically failed
- `src/components/memory/MemoryConsole.tsx`
  - exposes raw memory rows and recall results, but not higher-level semantic memory abstractions

## 4. Current System Diagnosis

### Current strengths

- The repository already has a staged workspace pattern for dream, journal, creative, and profile.
- The dream pipeline has the best normalization discipline and the best inspectability baseline.
- Learning already tracks observations, patterns, goals, and adaptations in a way that can support quality feedback loops.
- The schema already includes `memory_graphs`, which provides a suitable home for richer memory abstractions.
- Profile, dream, and journal UIs already understand pipeline events and quality panels.

### Current failures

| Area | Current strength | Current failure mode |
| --- | --- | --- |
| Upstream chat | Central turn pipeline with emotion and learning hooks | No hard response quality gate before persistence; generic phrasing still leaks through explicit user preferences |
| Memory | Conversation and fact persistence already exist | Too transcript-heavy; too little canonical semantic memory; poor recall abstraction |
| Learning | Detects style and quality issues over time | Not used as a first-class gating input for downstream artifact generation |
| Journal | Strong context packet and stage/event structure | Parsing fallback allows raw JSON/fenced text to become the artifact |
| Creative | Session/artifact lineage exists | Ready/publish semantics do not enforce quality; evaluator is not authoritative |
| Dream | Best current generate/evaluate/repair pattern | Still lacks a shared cross-feature validator library and consistent raw-vs-normalized storage |
| Profile | Evidence collection and transcript model already exist | Synthesis is too generic; failed runs can still update live profile state |
| Scenarios | Useful intervention concept and side-by-side UI | Relies on generic chat generation; no real actionability gate |
| Emotion | Coherent state modeling and history persistence | Appraisal reasons are templated; not deeply connected to artifact quality or inspectable evidence |

## 5. Root Cause Analysis by Feature

| Feature | Provider/model issue | Prompt/orchestration issue | Parsing/format issue | Evaluator/gating issue | Persistence/modeling issue | Frontend/inspectability issue | Diagnosis |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Emotion | Low | Medium | Low | Low | Medium | Medium | Mostly a reasoning richness and inspectability problem, not a structural generation blocker |
| Memory | Low | Low | Low | Medium | High | Medium | The main problem is missing semantic abstractions and weak recall ranking, not model capability |
| Learning | Low | Low | Low | Medium | Low | Low | The system is useful but underutilized as a quality feedback source |
| Scenarios | Low | High | Low | High | Medium | Medium | Scenario quality is mostly limited by upstream chat style plus weak probe/evaluation design |
| Creative | Low | Medium | High | High | High | High | Structural integrity failure: permissive parsing, non-authoritative evaluation, invalid publish path |
| Dream | Low | Medium | Medium | Medium | Medium | Low | Closest to target; mostly needs alignment with the shared quality core |
| Journal | Low | Medium | High | High | High | Medium | Structural integrity failure: parse fallback stores raw output as final artifact |
| Profile | Low | High | Medium | High | High | Medium | Evidence exists, but synthesis is generic and failed runs still mutate live state |

### Emotion

- Root cause class: orchestration and inspectability, not model weakness.
- `emotionalService.appraiseConversationTurn` and `evaluateResponseOutcome` are rule-heavy and coherent, but they produce repetitive reasoning patterns.
- The emotion system does not currently emit strong evidence references that other features can cite directly.

### Memory

- Root cause class: persistence/modeling.
- `chatTurnService` creates one conversation memory and a few regex facts (`extractStructuredFacts`), which is insufficient for cross-feature coherence.
- `memoryService.recallMemories` is lexical and shallow.
- The existing `memory_graphs` pathway is underused relative to the needs of the product.

### Learning

- Root cause class: integration gap.
- `metaLearningService` already detects issues like ignored brevity and overextended acknowledgements, but those signals are not used to gate or repair low-quality outputs in other features.

### Scenarios

- Root cause class: prompt/orchestration plus evaluator weakness.
- `scenarioService` asks generic probes and scores them with non-binding heuristics.
- It depends on `AgentChain.generateResponse`, so generic chat output becomes generic scenario output.

### Creative

- Root cause class: parsing, gating, persistence, and UI alignment.
- The parser accepts malformed wrappers.
- The evaluator does not hard-fail several structurally invalid outputs.
- Session and publish state semantics allow invalid artifacts to advance.
- The UI hides malformed titles instead of making the failure visible.

### Dream

- Root cause class: shared discipline gap, not feature design failure.
- Dream already uses a stronger parser, repair loop, and save gate.
- It should become the implementation reference for other artifact features, while also adopting the shared validator and raw-output persistence model described in this PRD.

### Journal

- Root cause class: parsing and gating.
- The current fallback path converts raw model output into the final saved artifact.
- The evaluator can still pass content that was never successfully normalized.

### Profile

- Root cause class: prompt/orchestration and persistence.
- The interview does not sufficiently force answers to stay anchored in collected evidence.
- The final profile is scaffolded more than synthesized, which produces generic language.
- Failed runs can still become the active profile.

## 6. Cross-Feature Architecture Gaps

1. There is no shared output quality pipeline across generative features.
2. Raw model output, normalized artifact content, and repaired artifact content are conflated.
3. Evaluators are advisory instead of authoritative.
4. Status semantics are inconsistent across workspaces.
5. The system lacks shared deterministic hard-fail rules for schema leakage, wrapper leakage, and invalid stage transitions.
6. Cross-feature context packets do not use a consistent evidence-reference shape.
7. Memory is persisted mostly as transcripts rather than canonical semantic memory units.
8. Learning observations are not fed back into quality gating or benchmark acceptance.
9. UI surfaces are inconsistent about draft vs repaired vs final vs saved/published.
10. Consumer contracts drift. The profile audit expected transcript fields that do not map cleanly to the current run detail shape.

## 7. Target Product Behavior

The target behavior is an inspectable, bounded-runtime artifact pipeline that makes invalid outputs impossible to save or publish.

### Target behavior by category

- Chat responses are still conversational, but they stop using generic assistant openers, adapt to explicit user style requests within one turn, and are screened before persistence.
- Memory stores both raw episodes and higher-level semantic abstractions so journal, dream, profile, and scenario prompts pull from stable identity and relationship signals rather than only recent transcripts.
- Emotion and learning become reusable signal sources: each provides evidence-backed summaries that downstream features can cite.
- Journal, creative, and dream workspaces all show:
  - context selection
  - raw draft generation
  - normalization result
  - evaluation result
  - repair attempt if needed
  - final validation gate
  - saved/published state only after passing all checks
- Profile runs show:
  - the evidence packet
  - question/answer transcript
  - stage findings
  - profile claim-to-evidence grounding
  - clear blocked state when the run fails quality
- Scenario runs produce materially different, actionable alternate branches with explicit quality scoring and divergence explanations.

## 8. Detailed Requirements

### Must-have requirements

- Introduce a shared output quality service layer under `src/lib/services` that all artifact-generating features use.
- Persist raw model output separately from normalized user-facing content.
- Add deterministic validation before any artifact can become `ready`, `saved`, `published`, or active on the agent record.
- Standardize session/artifact statuses and stage transitions across creative, dream, journal, and profile.
- Use one bounded repair pass after a validation or evaluation failure. Do not allow unlimited retries in request time.
- Add a chat-turn surface quality gate in `chatTurnService` before the assistant message is persisted.
- Expand memory modeling to include semantic abstractions: preferences, projects, relationships, identity/self-model, recurring tensions, and artifact-derived summaries.
- Reuse learning observations as quality feedback signals and benchmark labels.
- Expose validation and quality reports to the frontend for every affected feature.
- Ensure route responses include enough state for the UI to render draft vs repaired vs validated vs saved/published.
- Preserve compatibility with existing persisted rows and current routes during migration.

### Should-have requirements

- Add provider comparison support to the benchmark script, but keep production bounded to one chosen default plus one fallback.
- Add on-read repair helpers for legacy malformed creative and journal artifacts.
- Add quality metrics to scenario analytics rollups.
- Add stronger evidence cards to emotion and memory UIs.

### Nice-to-have requirements

- Add a manual admin action to re-run normalization and validation on legacy artifacts.
- Add a small visual diff between draft and repaired artifacts in workspaces that support repair.

## 9. Output Contract Specifications

### 9.1 Shared contract envelope

Every generated artifact or run result that can be reviewed, saved, published, or promoted must expose:

- `id`
- `agentId`
- `sessionId` or `runId`
- `provider`
- `model`
- `promptVersion`
- `status`
- `artifactRole` or `runStageResult`
- `rawModelOutput`
- `normalization`
- `validation`
- `evaluation`
- `sourceRefs`
- `payload`

Where:

- `rawModelOutput` contains the original text plus any parser notes. Store this in payload and pipeline event payloads to avoid wide top-level text-column expansion.
- `normalization` contains:
  - `status: normalized | repaired | failed | legacy_unvalidated`
  - `parser: strict_json | extracted_json | labeled_sections | direct_text`
  - `violations: string[]`
  - `repairedFromId?: string`
- `validation` contains:
  - `pass: boolean`
  - `hardFailureFlags: string[]`
  - `softWarnings: string[]`
  - `validatorVersion`
- `evaluation` contains:
  - `pass: boolean`
  - `overallScore`
  - `dimensions`
  - `strengths`
  - `weaknesses`
  - `repairInstructions`
  - `evaluatorSummary`
  - `evaluatorVersion`
- `sourceRefs` contains normalized evidence references with `id`, `sourceType`, `label`, `reason`, and optional `linkedEntityId`.

### 9.2 Emotion contract

Required output:

- `eventId`
- `source`
- `turnRef`
- `dominantEmotion`
- `topEmotions: Array<{ emotion, intensity }>`
- `confidence`
- `rationale: string[]`
- `triggers: string[]`
- `counterSignals: string[]`
- `linkedMessageIds`
- `linkedMemoryIds`
- `downstreamHints`

Hard fail conditions:

- no dominant emotion
- no rationale or trigger evidence
- intensity map missing for the dominant emotion

### 9.3 Memory contract

Memory types must expand beyond raw transcript rows. Supported normalized semantic types:

- `conversation_episode`
- `fact`
- `preference`
- `project`
- `relationship`
- `identity`
- `operating_constraint`
- `artifact_summary`
- `tension_snapshot`

Required semantic memory fields:

- `type`
- `canonicalKey`
- `canonicalValue`
- `summary`
- `confidence`
- `evidenceRefs`
- `sourceRefs`
- `supersedes?: string[]`
- `lastConfirmedAt`

Additional design requirement:

- `memory_graphs` becomes the canonical graph of stable concepts and relations.
- `memories` remains the append-only row store for episodes and semantic memory rows.

Hard fail conditions for semantic memories:

- missing `canonicalKey`
- missing `canonicalValue`
- confidence below feature minimum
- no evidence reference for a non-manual semantic memory

### 9.4 Learning contract

Required output:

- `observationId`
- `category`
- `severity`
- `description`
- `evidenceRefs`
- `candidateAdaptations`
- `resolvedStatus`
- `qualityImpact`

Requirement:

- quality failures from chat, creative, journal, profile, and scenario runs must emit learning observations so recurring issues become visible and queryable.

### 9.5 Scenario contract

A useful scenario run must contain:

- `branchPoint`
- `intervention`
- `probeSet`
- `turns[]` where each turn contains:
  - `probeLabel`
  - `probePrompt`
  - `baselineResponse`
  - `alternateResponse`
  - `baselineQuality`
  - `alternateQuality`
  - `qualityFlags`
  - `divergenceNotes`
  - `baselineEmotion`
  - `alternateEmotion`
- `comparison` with:
  - `firstDivergence`
  - `keyDifferences`
  - `recommendation`
  - `riskNotes`
  - `qualityNotes`
  - `diffHighlights`
  - `qualityScore`
  - `outcomeScore`
  - `nextActionRecommendation`

Hard fail conditions:

- fewer than 3 valid probe turns
- any turn response is empty or generic meta-advice instead of a direct next message or action
- baseline and alternate outputs are materially identical for 2 or more probes
- comparison missing a concrete recommendation

### 9.6 Creative artifact contract

A final creative artifact must contain:

- `title`
- `summary`
- `content`
- `format`
- `render`
- `themes`
- `inspiration`
- `audience`
- `tone`
- `wordCount`
- `sourceRefs`
- shared `normalization`, `validation`, and `evaluation`

Hard fail conditions:

- title begins with `Title`, `**Title:**`, or a code fence
- summary contains serialized JSON or labeled field markup
- content contains serialized wrapper fields instead of final prose/dialogue
- render output cannot be produced from normalized content
- missing or empty `content`

### 9.7 Dream artifact contract

A saved dream must contain:

- `title`
- `summary`
- `type`
- `scenes`
- `symbols`
- `themes`
- `latentTensions`
- `interpretation`
- `emotionalProcessing`
- `contextReferences`
- `impression`
- `displayMetrics`
- shared `normalization`, `validation`, and `evaluation`

Hard fail conditions:

- missing scenes
- missing symbols and themes together
- interpretation missing
- impression missing on a saved dream
- wrapper leakage or schema leakage in user-facing fields

### 9.8 Journal artifact contract

A saved journal entry must contain:

- `title`
- `summary`
- `content`
- `mood`
- `render`
- `references`
- `structured` with:
  - `themes`
  - `insights`
  - `gratitudes`
  - `nextActions`
  - `openQuestions`
  - `conciseSummary`
  - `referencedEntities`
- shared `normalization`, `validation`, and `evaluation`

Hard fail conditions:

- title is a code fence, JSON token, or labeled schema marker
- content begins with `{`, `[` or fenced JSON unless the journal type explicitly supports code, which current product scope does not
- structured fields are empty because parsing failed rather than because the content legitimately lacks them
- summary is just truncated serialized JSON

### 9.9 Profile run contract

A completed profile run must persist:

- `evidenceSignals`
- `interviewTurns[]`
- `stageFindings`
- `latestProfile`
- `latestEvaluation`
- `sourceCount`
- `transcriptCount`
- `provider`
- `model`
- `promptVersion`
- `qualityStatus`

Each `interviewTurn` must contain:

- `stage`
- `order`
- `question`
- `answer`
- `evidenceRefs`
- `promptVersion`

Each profile claim group should carry evidence references:

- `summary`
- `communicationStyle`
- `motivationalProfile`
- `strengths`
- `challenges`
- `triggers`
- `growthEdges`
- `bigFive`
- `mbti`
- `enneagram`

Hard fail conditions:

- evaluation fails
- fewer than 80 percent of top-level profile claims have evidence refs
- missing interview transcript or empty answers
- run attempts to update `agents.psychologicalProfile` without passing quality

## 10. Backend / Service Changes

### 10.1 Shared output quality core

Add a new shared module set under `src/lib/services/outputQuality/`:

- `contracts.ts`
- `normalizers.ts`
- `validators.ts`
- `evaluators.ts`
- `status.ts`
- `flags.ts`

Responsibilities:

- define shared artifact/run envelope types
- normalize raw model outputs into feature contracts
- run deterministic validation
- combine deterministic validation with feature-specific evaluator outputs
- standardize status transitions

Also update `src/types/database.ts` and, if needed, add `src/types/outputQuality.ts` for reusable quality payload types.

### 10.2 Upstream chat quality

Update:

- `src/lib/services/chatTurnService.ts`
- `src/lib/langchain/agentChain.ts`
- `src/lib/langchain/baseChain.ts`
- `src/lib/langchain/tools.ts`

Required changes:

- add a pre-persist `evaluateResponseSurfaceQuality` step after `generateResponse`
- allow one bounded repair/regenerate pass before storing the assistant message
- feed user style preferences and active learning adaptations into a compact `responseStylePacket`
- stop using generic tool-produced tone adjustments for voice-critical flows unless they are explicitly validated
- extract structured semantic memory candidates from the turn, not only raw conversation summaries and regex facts

### 10.3 Memory and memory graph

Update:

- `src/lib/services/memoryService.ts`
- `src/lib/services/chatTurnService.ts`
- `src/lib/services/memoryGraphService.ts`
- `src/app/api/agents/[id]/memories/route.ts`
- `src/app/api/agents/[id]/memories/recall/route.ts`
- `src/lib/repositories/memoryRepository.ts`
- `src/lib/repositories/memoryGraphRepository.ts`

Required changes:

- add semantic memory upsert helpers for preference, project, relationship, identity, artifact summary, and tension snapshot memories
- use `memory_graphs` as the home for canonical concept relations and contradiction tracking
- blend lexical recall with semantic graph hits
- include `confidence`, `canonicalKey`, and `evidenceRefs` in memory metadata
- generate artifact summaries from saved journal/dream/creative/profile outputs into memory

### 10.4 Emotion

Update:

- `src/lib/services/emotionalService.ts`
- `src/components/emotions/EmotionTimeline.tsx`
- `src/app/agents/[id]/page.tsx` emotion tab section

Required changes:

- persist richer appraisal reasons and evidence refs
- emit normalized downstream hints that journal, dream, and scenarios can consume
- reduce repetitive reason phrasing and track confidence per event

### 10.5 Learning

Update:

- `src/lib/services/learningService.ts`
- `src/lib/services/metaLearningService.ts`
- `src/app/api/agents/[id]/learning/route.ts`
- `src/components/learning/MetaLearningDashboard.tsx`

Required changes:

- record validation and evaluation failures as learning observations
- expose quality-related adaptations separately from topic/relationship learning
- allow dashboards to filter for output-quality observations and adaptations

### 10.6 Journal

Update:

- `src/lib/services/journalService.ts`
- `src/app/api/agents/[id]/journal/route.ts`
- `src/app/api/agents/[id]/journal/sessions/[sessionId]/generate/route.ts`
- `src/app/api/agents/[id]/journal/sessions/[sessionId]/save/route.ts`
- `src/lib/repositories/journalWorkspaceRepository.ts`

Required changes:

- replace current `safeParseJson` and `parseEntry` fallback with shared normalizer/validator calls
- never treat raw model text as the final normalized entry
- save the draft artifact and repaired artifact separately inside the session payload/artifact lineage
- only mark session `ready` after validation and evaluation both pass
- return machine-readable save blockers from the save route

### 10.7 Creative

Update:

- `src/lib/services/creativityService.ts`
- `src/app/api/agents/[id]/creative/route.ts`
- `src/app/api/agents/[id]/creative/sessions/[sessionId]/generate/route.ts`
- `src/app/api/agents/[id]/creative/sessions/[sessionId]/publish/route.ts`
- `src/lib/repositories/creativeStudioRepository.ts`
- `src/lib/creative/firestoreStore.ts`

Required changes:

- move creative parsing and validation to the shared quality core
- require a passing validated final artifact before session status can become `ready`
- require a passing validated final artifact before publish
- persist the draft artifact, repair artifact, and final artifact lineage explicitly
- mirror new quality fields through the Firestore serializer path for non-Postgres modes

### 10.8 Dream

Update:

- `src/lib/services/dreamService.ts`
- `src/app/api/agents/[id]/dream/route.ts`
- `src/app/api/agents/[id]/dream/sessions/[sessionId]/generate/route.ts`
- `src/app/api/agents/[id]/dream/sessions/[sessionId]/save/route.ts`
- `src/lib/repositories/dreamWorkspaceRepository.ts`

Required changes:

- keep the existing structure, but align it to the shared status, normalization, and validation model
- persist raw draft vs repaired dream separately in payload lineage
- expose promptVersion and repairCount

### 10.9 Profile

Update:

- `src/lib/services/profileAnalysisService.ts`
- `src/app/api/agents/[id]/profile/route.ts`
- `src/app/api/agents/[id]/profile/runs/route.ts`
- `src/app/api/agents/[id]/profile/runs/[runId]/route.ts`
- `src/app/api/agents/[id]/profile/runs/[runId]/execute/route.ts`
- `src/lib/repositories/profileAnalysisRepository.ts`

Required changes:

- strengthen evidence packet construction and pass evidence snippets into the interview prompt
- require claim-level evidence refs in `stageFindings` and `latestProfile`
- rework synthesis so it is evidence-led, not mostly deterministic scaffolding
- stop updating `agents.psychologicalProfile` unless the run passes validation and evaluation
- add compatibility aliases or explicit contract migration for transcript fields to prevent consumer drift

### 10.10 Scenarios

Update:

- `src/lib/services/scenarioService.ts`
- `src/app/api/scenarios/route.ts`
- `src/app/api/scenarios/[id]/route.ts`
- `src/lib/repositories/scenarioRunRepository.ts`

Required changes:

- move probe templates to stricter direct-output prompts
- add deterministic actionability checks
- allow one bounded regenerate pass for low-quality probe responses
- persist per-turn quality reports and overall `qualityStatus`
- pull memory abstractions and recent learning adaptations into scenario context selection

## 11. Prompt / Orchestration Changes

### Shared prompt rules

Apply these rules to all affected prompt builders:

- answer first; do not open with generic assistant filler
- explicitly honor known user style preferences and active learning adaptations
- forbid markdown field labels and JSON fences in user-facing artifact fields
- prefer grounded references to stored evidence over generic self-description
- use a compact, versioned context packet instead of dumping every memory/message

### Upstream chat

Update `baseChain.ts` and `agentChain.ts` to introduce a versioned style charter:

- no "Great question", "That sounds challenging", or similar generic assistant openers unless the persona explicitly requires it
- if the user has a directness preference, the default surface form must shift immediately
- if the user asks what changed, the answer must explicitly describe the adaptation
- list formatting should be chosen intentionally, not as the default answer shape

### Journal, dream, creative

Use a common orchestration pattern:

1. build bounded evidence/context packet
2. draft prompt with explicit feature contract
3. normalize and validate
4. if needed, repair prompt that includes validation failures and evaluator weaknesses
5. revalidate
6. evaluate normalized artifact
7. persist only if passed

Prompt requirements:

- include one positive example and one invalid-output example inside the system prompt for artifact features
- instruct the model to output only the target JSON object, but do not trust compliance without validation
- keep repair prompts focused on concrete violations, not generic "improve quality"

### Profile

Prompt changes:

- each interview question prompt should include a compact evidence packet plus prior answers
- stage extraction prompts must produce claims with evidence refs
- synthesis prompts must produce evidence-backed profile sections, not free-floating descriptors
- evaluator prompts must check evidence coverage as a first-class dimension

### Scenarios

Prompt changes:

- probe prompts must ask for the exact next reply or exact next action plan in the agent voice
- alternate prompts must specify what changed and what must remain constant
- comparison prompts must identify concrete divergence and user-facing consequence, not only tone shifts

## 12. Evaluation / Gating Changes

### 12.1 Shared gating pipeline

Every artifact/run-producing feature must follow:

1. Generate raw output.
2. Normalize to contract.
3. Run deterministic validation.
4. If deterministic validation fails, run one bounded repair pass.
5. Re-normalize and re-validate.
6. Run LLM evaluator on the normalized artifact only.
7. Apply deterministic final gate:
   - `validation.pass === true`
   - `evaluation.pass === true`
   - `overallScore >= threshold`
   - no dimension below floor
   - no hard failure flags
8. Only then allow `ready`, `saved`, `published`, or live profile update.

### 12.2 Shared hard-fail conditions

Hard-fail immediately when any of the following is detected:

- code fences or JSON/object wrapper leakage in user-facing artifact fields
- schema labels like `Title:`, `Summary:`, or `Content:` left in the final artifact
- empty required fields
- duplicated title/summary/content values that indicate parser collapse
- invalid stage transition such as publish without validated final artifact
- profile update attempt from a non-passing run

### 12.3 Feature thresholds

| Feature | Overall score minimum | Dimension floor | Extra deterministic gate |
| --- | --- | --- | --- |
| Chat turn surface quality | 70 | 65 | no generic opener when directness preference exists |
| Journal | 84 | 78 | normalized prose only; structured fields populated |
| Creative | 85 | 78 | no wrapper leakage; title and summary clean |
| Dream | 82 | 75 | required dream semantics present |
| Profile | 80 | 75 | evidence coverage >= 80 percent |
| Scenario turn quality | 75 | 70 | at least 2 of 3 probes materially diverge and stay actionable |

### 12.4 Evaluator criteria

Cross-feature criteria set:

- voice consistency
- specificity/grounding
- continuity with known memory/profile/emotion
- format fidelity
- actionability when relevant
- emotional coherence when relevant
- evidence grounding for profile and memory abstractions

### 12.5 Benchmark scripts

Add scripts under `scripts/quality/`:

- `run-output-benchmark.ts`
- `replay-agent-output-audit.ts`
- `validate-persisted-artifacts.ts`

Benchmark requirements:

- replay the audit prompts from `tmp/agent-output-audit-ari-kestrel.json`
- compare structural validity, pass rate, and quality score before and after changes
- support the default provider plus one low-cost fallback

### 12.6 Manual review workflow

Manual release review must inspect:

- 5 chat turns with explicit directness adaptation
- 5 journal runs
- 5 creative runs across at least 2 formats
- 5 dream runs
- 3 profile runs
- 5 scenario runs
- 20 sampled semantic memories

Reviewers must verify:

- no wrapper leakage
- no invalid saved/published artifacts
- evidence references are visible and believable
- scenario outputs are materially actionable

## 13. Persistence / DB Schema Changes

The recommended schema strategy is additive and minimal at the column level. Large raw outputs should live in payload and pipeline event payloads. Indexed state should live in top-level columns.

### 13.1 Table changes

| Table | New fields | Purpose |
| --- | --- | --- |
| `creative_sessions` | `quality_status text`, `repair_count integer default 0`, `prompt_version text`, `failure_reason text` | Normalize ready/publish gating and inspectability |
| `creative_artifacts` | `artifact_role text`, `normalization_status text`, `quality_score integer`, `source_artifact_id text` | Distinguish draft vs repaired vs final lineage |
| `dream_sessions` | `quality_status text`, `repair_count integer default 0`, `prompt_version text` | Align dream with shared quality model |
| `dreams` | `artifact_role text`, `normalization_status text`, `quality_score integer`, `source_dream_id text` | Explicit draft/repair/final lineage |
| `journal_sessions` | `quality_status text`, `repair_count integer default 0`, `prompt_version text` | Align journal with shared quality model |
| `journal_entries` | `artifact_role text`, `normalization_status text`, `quality_score integer`, `source_entry_id text` | Explicit draft/repair/final lineage |
| `profile_analysis_runs` | `quality_status text`, `quality_score integer`, `prompt_version text`, `profile_version text` | Prevent failed runs from looking complete |
| `scenario_runs` | `quality_status text`, `quality_score integer`, `failure_reason text`, `prompt_version text` | Persist scenario quality state |
| `memories` | no new columns required; expand `type` usage and `metadata` contract | Avoid unnecessary migration while enabling semantic memory |

### 13.2 Payload changes

Update payloads in:

- `CreativeSession`
- `CreativeArtifact`
- `DreamSession`
- `Dream`
- `JournalSession`
- `JournalEntry`
- `ProfileAnalysisRun`
- `ScenarioRunRecord`
- `MemoryRecord`

Add:

- `promptVersion`
- `rawModelOutput`
- `normalization`
- `validation`
- `qualityStatus`
- `repairCount`
- `sourceRefs`

### 13.3 Compatibility with existing rows

- Existing rows default to `qualityStatus = legacy_unvalidated` and `normalizationStatus = legacy_unvalidated` when the fields are absent.
- Existing saved creative/journal artifacts should remain readable, but the UI must visibly label them as legacy/unvalidated.
- No destructive migration of historical content should occur in the first rollout.

### 13.4 Migration strategy

Add an additive migration plus a backfill script:

- schema migration: add the columns above with safe defaults
- backfill script:
  - derive `quality_score` from existing evaluations when present
  - set `quality_status` to `passed`, `failed`, or `legacy_unvalidated`
  - set `normalization_status` to `legacy_unvalidated` for all historical artifacts
  - mark legacy malformed creative/journal artifacts as failed validation if obvious wrapper leakage is detected

### 13.5 Read/write path changes

- Repositories must read/write new top-level state fields plus payload changes together.
- Service write paths must become the only authority on session/artifact status transitions.
- Route serializers must include the new fields consistently.
- Firestore mirror paths for creative and memory graph must be updated so payloads stay aligned outside Postgres mode.

## 14. API Contract Changes

### 14.1 Cross-feature API rules

- Save and publish routes must return `409 Conflict` when preconditions fail.
- Validation failures should return a structured payload:
  - `error`
  - `code`
  - `qualityStatus`
  - `hardFailureFlags`
  - `softWarnings`
- All affected detail routes must include:
  - `qualityStatus`
  - `normalizationStatus` where applicable
  - `repairCount`
  - `promptVersion`
  - `validation`
  - `evaluation`

### 14.2 Feature-specific changes

#### Memories

Update:

- `GET /api/agents/:id/memories`
- `POST /api/agents/:id/memories/recall`

Changes:

- add optional filters for semantic memory type
- include `confidence`, `canonicalKey`, and `evidenceRefs`
- recall results should distinguish semantic hits from raw episode hits

#### Learning

Update:

- `GET /api/agents/:id/learning`

Changes:

- include output-quality observations and quality-linked adaptations in the response model

#### Journal, dream, creative

Update generate/detail/save/publish responses to include:

- session-level `qualityStatus`
- session-level `repairCount`
- artifact-level `artifactRole`
- artifact-level `normalizationStatus`
- validation report

Behavioral changes:

- save/publish endpoints return `409` instead of silently allowing invalid transitions

#### Profile

Update:

- `GET /api/agents/:id/profile/runs/:runId`
- `POST /api/agents/:id/profile/runs/:runId/execute`

Changes:

- include `qualityStatus`, `qualityScore`, `promptVersion`, and evidence coverage summary
- return transcript fields as `question`/`answer`, and include temporary compatibility aliases `prompt`/`response` in the response payload for one release if needed by existing consumers

#### Scenarios

Update:

- `GET /api/scenarios/:id`

Changes:

- include per-turn quality objects and run-level `qualityStatus`
- expose `failureReason` when the scenario run is structurally invalid or non-actionable

## 15. Frontend / UX Changes

### 15.1 Creative UI

Update `src/components/creative/CreativeStudio.tsx`.

Requirements:

- remove the UI assumption that malformed titles can be safely papered over
- publish button must require `session.qualityStatus === 'passed'` and a validated final artifact
- display draft, repaired, final, and published artifact lineage
- show validation failure messages when the final artifact is blocked
- expand pipeline visibility beyond the current lightweight recent-events treatment

### 15.2 Journal UI

Update `src/components/journal/JournalViewer.tsx`.

Requirements:

- show normalization status in addition to evaluation
- clearly distinguish draft vs repaired vs saved entry
- add an explicit invalid/legacy badge for malformed historical entries
- surface structured extraction failures instead of rendering malformed raw text as if it were a clean entry

### 15.3 Dream UI

Update `src/components/dreams/DreamJournal.tsx`.

Requirements:

- align with the shared normalization/validation model
- show repair count and prompt version
- preserve the current strong stage rail and quality visibility

### 15.4 Profile UI

Update `src/components/profile/ProfileViewer.tsx`.

Requirements:

- add claim-evidence coverage summary
- show blocked/failed runs distinctly from completed passing runs
- render transcript using the stable `question`/`answer` contract while tolerating temporary compatibility aliases
- show whether the active agent profile came from a passing run

### 15.5 Scenario UI

Update `src/components/parallel/ParallelRealityExplorer.tsx`.

Requirements:

- show per-probe actionability and genericness flags
- highlight when alternate output is not materially different from baseline
- show quality blocker state if the run fails validation
- preserve the current comparison/context tabs while making the quality state explicit

### 15.6 Memory UI

Update `src/components/memory/MemoryConsole.tsx`.

Requirements:

- add grouped semantic memory sections for preferences, projects, relationships, identity, tensions, and artifact summaries
- show canonical/confidence badges
- show evidence trace back to messages or saved artifacts
- separate raw conversation episodes from semantic memory abstractions

### 15.7 Emotion UI

Update:

- `src/components/emotions/EmotionTimeline.tsx`
- `src/components/emotions/EmotionRadar.tsx`
- emotion tab rendering in `src/app/agents/[id]/page.tsx`

Requirements:

- show richer appraisal reasons and linked evidence refs
- surface downstream hints that explain how emotion is affecting journal/dream/scenario behavior

### 15.8 Common UX requirements

- every workspace must show stage visibility
- every workspace must show draft vs repaired vs saved/published state
- every workspace must show validation failures distinctly from evaluator weaknesses
- users must be able to tell when they are looking at legacy/unvalidated content

## 16. Migration / Backward Compatibility Plan

### Phase 1 compatibility rules

- Keep all current route paths stable.
- Make schema changes additive.
- Continue reading legacy rows without requiring immediate data cleanup.

### Legacy artifact handling

- For historical creative and journal entries:
  - attempt best-effort read normalization on the server
  - if normalization is uncertain, render as legacy/unvalidated
  - do not silently rewrite persisted content during read

### Profile compatibility

- Preserve `question`/`answer` as the canonical transcript field names.
- If external consumers still expect `prompt`/`response`, provide aliases for one release window at the route layer only.

### Active profile compatibility

- Existing `agents.psychologicalProfile` values stay readable.
- Add metadata inside the profile payload identifying `sourceRunId`, `qualityStatus`, and `profileVersion`.
- If a legacy active profile came from an unvalidated run, mark it `legacy_unvalidated` until the next successful run replaces it.

## 17. Implementation Phases

### Phase 0: Shared quality foundation

Deliverables:

- shared output quality types and utilities
- status vocabulary
- deterministic validator library
- benchmark script scaffolding

Primary files:

- `src/lib/services/outputQuality/*`
- `src/types/database.ts`
- `src/lib/db/schema.ts`

### Phase 1: Integrity fixes for creative and journal

Deliverables:

- hard validation before ready/save/publish
- artifact lineage and normalization status
- API error contracts for blocked save/publish
- UI visibility for blocked state

Primary files:

- `src/lib/services/creativityService.ts`
- `src/lib/services/journalService.ts`
- creative/journal routes, repositories, and UIs

### Phase 2: Upstream chat and memory coherence

Deliverables:

- chat response surface quality gate
- stronger preference/directness handling
- semantic memory extraction
- memory graph integration

Primary files:

- `src/lib/services/chatTurnService.ts`
- `src/lib/langchain/baseChain.ts`
- `src/lib/langchain/agentChain.ts`
- `src/lib/services/memoryService.ts`
- `src/lib/services/memoryGraphService.ts`

### Phase 3: Profile and scenario quality upgrade

Deliverables:

- evidence-led profile interview/synthesis
- blocked profile update on failed runs
- actionable scenario probe set and quality gating

Primary files:

- `src/lib/services/profileAnalysisService.ts`
- `src/lib/services/scenarioService.ts`
- profile/scenario routes, repositories, and UIs

### Phase 4: Dream alignment and emotion/learning integration

Deliverables:

- dream alignment to shared quality model
- richer emotion evidence
- learning feedback from quality failures

Primary files:

- `src/lib/services/dreamService.ts`
- `src/lib/services/emotionalService.ts`
- `src/lib/services/learningService.ts`
- `src/lib/services/metaLearningService.ts`

### Phase 5: Migration, docs, and release verification

Deliverables:

- backfill script
- docs updates
- benchmark baselines
- production exit review

Primary files:

- `docs/api-reference.md`
- `docs/data-model.md`
- `docs/workflows.md`
- `docs/architecture.md`
- `scripts/quality/*`

## 18. Verification Plan

### Required automated checks

- `npm run lint`
- `npm run build`
- new quality replay script against the audit fixture

### Required automated test coverage

Add tests for:

- journal parser/validator rejecting fenced JSON and labeled wrappers
- creative parser/validator rejecting wrapper leakage and invalid publish transitions
- profile run refusing to update agent profile when evaluation fails
- scenario run marking low-actionability outputs as failed quality
- chat turn surface gate catching explicit directness violations
- semantic memory extraction and recall ranking

### Manual verification matrix

- Chat:
  - explicit directness preference case
  - contradiction/self-reflection case
- Journal:
  - one passing run
  - one forced malformed draft
- Creative:
  - one passing publish
  - one blocked publish
- Dream:
  - one save with derived impression
- Profile:
  - one passing run
  - one blocked run
- Scenario:
  - one high-quality branch
  - one blocked generic branch
- Memory:
  - inspect canonical semantic memory extraction from the above runs

### Docs verification

The implementation agent must update:

- `docs/api-reference.md`
- `docs/data-model.md`
- `docs/workflows.md`
- `docs/architecture.md`

## 19. Production Readiness Exit Criteria

The implementation is production-ready only when all of the following are true:

- No creative or journal artifact with wrapper leakage can reach `saved` or `published`.
- No profile run with failed evaluation can update `agents.psychologicalProfile`.
- No save/publish route accepts an invalid stage transition.
- Replay benchmarks on the audit fixture produce zero malformed persisted artifacts.
- At least 90 percent of replayed artifact generations pass structural validation on the first or repaired attempt.
- Scenario benchmarks show fewer than 10 percent `low_actionability` failures on the curated benchmark set.
- Chat directness benchmarks show fewer than 5 percent generic-opener violations after an explicit directness request.
- Memory recall returns semantic memories alongside episodes for benchmark queries that reference preferences, projects, relationships, or recurring tensions.
- All affected UIs show stage state, quality state, and legacy/unvalidated state where applicable.

## 20. Risks / Open Questions

### Risks

- Provider variability may still create more malformed drafts than desired, even after better prompts, so validators must remain authoritative.
- Additional raw-output persistence increases payload size and must stay bounded for free-tier storage.
- Evidence-heavy profile synthesis may become verbose unless prompts remain tightly scoped.
- Semantic memory extraction can create noisy abstractions if confidence thresholds are too low.
- Adding a chat-turn repair step may slightly increase latency and model cost.

### Product decisions

- Benchmark baseline:
  - Treat the local Ollama-backed `qwen2.5:7b` model as the only production benchmark baseline for this phase.
  - All acceptance criteria, replay benchmarks, and manual review flows should be measured against `qwen2.5:7b`.
  - Do not design the implementation around model switching or paid-provider-specific behavior.
- Legacy malformed creative/journal artifacts:
  - Do not auto-repair persisted legacy artifacts in place during the first rollout.
  - Flag them as `legacy_unvalidated` or failed validation on read, expose that state in the UI, and preserve the original stored content.
  - Add manual re-normalize/revalidate tooling later if needed, but keep rollout-one migration non-destructive.
- Raw model output visibility:
  - Persist raw model output for inspectability, but keep it in debug-oriented workspace sections rather than the primary end-user reading surface.
  - Primary artifact views should render normalized content only.
  - Raw output should be visible in stage/debug panels for failed drafts, repaired drafts, and audit workflows.
- Scenario failures and learning:
  - Scenario quality failures should create learning observations immediately.
  - Repeated failures should increase severity and adaptation priority, but first-instance failures should still be recorded so the system remains inspectable and self-correcting.

## 21. Task Breakdown For The Next Implementation Agent

1. Add shared output quality types and services in `src/lib/services/outputQuality/` and wire shared types into `src/types/database.ts`.
2. Add additive schema columns in `src/lib/db/schema.ts` and update the affected repositories to read/write them.
3. Refactor `chatTurnService.ts`, `baseChain.ts`, `agentChain.ts`, and `tools.ts` to add a response surface gate and a compact style packet.
4. Expand `memoryService.ts` and `memoryGraphService.ts` to create semantic memories and use them in recall and downstream context packets.
5. Refactor `journalService.ts` to use the shared normalizer/validator and block invalid saves.
6. Refactor `creativityService.ts` to enforce validated final artifacts before `ready` and `publish`, then update the creative Firestore mirror path.
7. Align `dreamService.ts` to the shared quality envelope and lineage fields without regressing current save behavior.
8. Refactor `profileAnalysisService.ts` so interview, findings, synthesis, evaluation, and live profile update all use evidence-backed quality gates.
9. Refactor `scenarioService.ts` to use stronger probe prompts, per-turn quality objects, and one bounded regenerate path.
10. Update `emotionalService.ts`, `learningService.ts`, and `metaLearningService.ts` so emotion evidence and quality failures feed downstream features and dashboards.
11. Update the relevant UIs:
    - `src/components/creative/CreativeStudio.tsx`
    - `src/components/journal/JournalViewer.tsx`
    - `src/components/dreams/DreamJournal.tsx`
    - `src/components/profile/ProfileViewer.tsx`
    - `src/components/parallel/ParallelRealityExplorer.tsx`
    - `src/components/memory/MemoryConsole.tsx`
    - `src/components/emotions/EmotionTimeline.tsx`
    - emotion tab rendering in `src/app/agents/[id]/page.tsx`
12. Add benchmark and validation scripts under `scripts/quality/`, run `npm run lint` and `npm run build`, and update docs in the same implementation task.
