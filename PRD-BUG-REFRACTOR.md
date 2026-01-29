# AGENT-PLAYGROUND Bug Refactor PRD (Issue Inventory)

## Objective
Provide a complete, actionable inventory of build blockers, runtime bugs, and quality issues so a follow-up agent can systematically refactor and stabilize the app.

## Audit Evidence
- Commands run: `npm run lint`, `npm run build`, `npx tsc --noEmit`
- Result summary:
  - `npm run lint` reports 6 errors and 88 warnings.
  - `npm run build` fails during lint due to the 6 errors.
  - `npx tsc --noEmit` reports type errors across UI + 3D visualization code.

## Critical Build Blockers (must fix before any build succeeds)
1) ESLint no-explicit-any errors in meta-learning route  
   - Files: `src/app/api/agents/[id]/learning/route.ts:113`, `src/app/api/agents/[id]/learning/route.ts:303`, `src/app/api/agents/[id]/learning/route.ts:312`  
   - Impact: `next build` fails.  
   - Fix: replace `any` casts with typed interfaces (for adaptations, skill progressions). If necessary, introduce DTO types in `src/types/metaLearning.ts` and update `metaLearningService` return types.  
   - Acceptance: lint passes with no `@typescript-eslint/no-explicit-any` errors.

2) React hooks rule violations in thought flow visualization  
   - Files: `src/components/visualizations/neural/ThoughtFlows.tsx:108`, `src/components/visualizations/neural/ThoughtFlows.tsx:138`, `src/components/visualizations/neural/ThoughtFlows.tsx:174`  
   - Impact: lint fails; hook order is unstable at runtime.  
   - Fix: move `useMemo` calls above early returns; return empty arrays when inactive.  
   - Acceptance: lint passes for `react-hooks/rules-of-hooks`.

3) TypeScript errors from icon typing in multiple components  
   - Files: `src/components/learning/MetaLearningDashboard.tsx:112`, `src/components/parallel/ParallelRealityExplorer.tsx:111`, `src/components/planning/FuturePlanningView.tsx:58` (plus other lines in those files).  
   - Impact: `tsc --noEmit` fails.  
   - Root cause: icon configs typed as `React.ElementType`, which collapses props to `never` in strict mode.  
   - Fix: type icons as `LucideIcon` (from `lucide-react`) or `React.ComponentType<LucideProps>`.  
   - Acceptance: `tsc --noEmit` passes these files.

4) React Three Fiber JSX element mismatch (`line` resolves to SVG)  
   - Files: `src/components/visualizations/neural/Connections.tsx:146`, `src/components/visualizations/neural/Connections.tsx:165`  
   - Impact: `tsc --noEmit` fails, refs typed as `SVGLineElement`.  
   - Fix: replace `<line>` with `<threeLine>` (R3F alias) or use Drei's `<Line>` component, update refs accordingly.  
   - Acceptance: no ref-type errors in `Connections.tsx`.

5) Missing `args` on `<bufferAttribute>` in R3F  
   - Files: `src/components/visualizations/neural/Connections.tsx:148`, `src/components/visualizations/neural/Connections.tsx:167`, `src/components/visualizations/neural/ParticleSystem.tsx:144`, `src/components/visualizations/neural/ParticleSystem.tsx:150`, `src/components/visualizations/neural/ParticleSystem.tsx:156`, `src/components/visualizations/neural/ParticleSystem.tsx:243`  
   - Impact: `tsc --noEmit` fails.  
   - Fix: use `args={[positionsArray, 3]}` (or equivalent) for buffer attributes, or construct `new THREE.BufferAttribute(...)`.  
   - Acceptance: no `args` errors.

6) Post-processing JSX typing errors  
   - Files: `src/components/visualizations/neural/Effects.tsx:173`, `src/components/visualizations/neural/Effects.tsx:182`, `src/components/visualizations/neural/Effects.tsx:190`, `src/components/visualizations/neural/Effects.tsx:191`, `src/components/visualizations/neural/Effects.tsx:197`, `src/components/visualizations/neural/Effects.tsx:198`  
   - Impact: `tsc --noEmit` fails.  
   - Fix: avoid `false`/`undefined` children in `EffectComposer`. Render an element always (ex: `dofEnabled ? <DepthOfField ... /> : <DepthOfField enabled={false} ... />`) or cast via `as JSX.Element` where appropriate.  
   - Acceptance: no `EffectComposer` child-type errors.

7) Parallel reality type mismatch  
   - File: `src/lib/services/parallelRealityService.ts:121`  
   - Impact: `tsc --noEmit` fails.  
   - Root cause: `ParallelRealityExtended` extends `ParallelReality` but redefines `scenario` with incompatible shape.  
   - Fix: use `Omit<ParallelReality, 'scenario' | 'comparison'>` or align `ParallelReality.scenario` type to `WhatIfScenario`.  
   - Acceptance: `tsc --noEmit` passes for `parallelRealityService`.

8) `parentBranchId: null` violates type  
   - File: `src/lib/services/parallelRealityService.ts:558`  
   - Impact: `tsc --noEmit` fails.  
   - Fix: change to `undefined` or update `RealityBranch.parentBranchId` to allow `null`.  
   - Acceptance: no `null` assignment errors.

## Functional / Behavioral Bugs (runtime issues)
9) Agent detail fetch uses `sendMessage` to load history  
   - Files: `src/app/agents/[id]/page.tsx:90-98`, `src/stores/messageStore.ts:69-131`  
   - Impact: creates an empty message, triggers an AI response, and still does not load history properly.  
   - Fix: call `fetchMessages` instead; add agent-specific fetching (see issue 10).  
   - Acceptance: no empty messages created on page load, history loads correctly.

10) Message history is not scoped to an agent  
   - File: `src/stores/messageStore.ts:52-60`  
   - Impact: `fetchMessages` returns global recent messages, not per agent.  
   - Fix: add `fetchMessagesByAgentId(agentId)` using `MessageService.getMessagesByAgentId`, and update the agent detail page to call it.  
   - Acceptance: agent detail shows only messages for that agent.

11) Duplicate AI responses in agent chat  
   - Files: `src/app/agents/[id]/page.tsx:151-189`, `src/stores/messageStore.ts:92-121`  
   - Impact: user sends a message, message store auto-responds via `generateAgentResponse`, and the page also calls `/api/llm` and sends a second response.  
   - Fix: choose a single response path. Either remove auto-response from `sendMessage` or add a `suppressAutoResponse` flag used by the page.  
   - Acceptance: exactly one agent response per user message.

12) LLM streaming format mismatch  
   - Files: `src/utils/llm.ts:20-88`, `src/app/api/llm/route.ts:41-112`, `src/app/api/llm/route.ts:172-198`  
   - Impact: client expects `data: { content }` but provider SSE uses a different payload; LangChain streaming sends `type: token/complete`. Results can be empty or duplicated content.  
   - Fix: normalize SSE in `/api/llm` for both provider and LangChain (single JSON schema), or update the client parser to handle provider-specific SSE.  
   - Acceptance: streaming responses render correctly with no duplication.

13) Client model label always shows "fallback"  
   - Files: `src/utils/llm.ts:128-134`, `src/app/agents/[id]/page.tsx:371`  
   - Impact: `process.env.GOOGLE_AI_API_KEY` is not available in client, so UI reports wrong model.  
   - Fix: expose a `NEXT_PUBLIC_LLM_PROVIDER` or provide model via API.  
   - Acceptance: UI reflects real provider.

14) Multi-agent simulation depends on Firestore agent existence  
   - File: `src/app/api/multiagent/route.ts:49-102`  
   - Impact: if agents exist only in request payload (not Firestore), `AgentChain` fails.  
   - Fix: allow `AgentChain` to accept persona/goals directly (or validate and create ephemeral agents).  
   - Acceptance: multi-agent simulation works for payload-only agents.

15) Firebase client SDK used inside server routes  
   - Files: `src/app/api/**/route.ts`, `src/lib/services/*.ts` (server usage)  
   - Impact: server routes rely on client SDK and `NEXT_PUBLIC_*` keys, may fail under strict Firestore rules; also less secure.  
   - Fix: migrate server routes to Firebase Admin SDK with service account, or move Firestore calls to client-only paths.  
   - Acceptance: API routes work without client credentials and honor security rules.

16) In-memory rate limiting in meta-learning route  
   - File: `src/app/api/agents/[id]/learning/route.ts:24-45`  
   - Impact: rate limits reset on server restarts or multiple instances.  
   - Fix: persist rate limits in Firestore or Redis.  
   - Acceptance: rate limits are enforced across instances.

17) `getCurrentLLMModel` used in UI but API route does not set model  
   - Files: `src/utils/llm.ts:128-134`, `src/app/api/llm/route.ts:98-111`  
   - Impact: no authoritative model info in responses.  
   - Fix: include `model` in `/api/llm` JSON responses and propagate into UI state.  
   - Acceptance: model label reflects real response data.

## Type / Data Model Consistency Issues
18) `ParallelReality` vs `WhatIfScenario` schema mismatch  
   - Files: `src/types/database.ts:851-890`, `src/lib/services/parallelRealityService.ts:94-136`  
   - Impact: conflicting schema leads to TS errors and future runtime confusion.  
   - Fix: consolidate to a single scenario schema and update all references.  
   - Acceptance: one scenario shape across types + services.

19) `ParallelRealityService.createParallelReality` writes `comparison.relationshipChanges` using `statusChange` that can be `null`  
   - File: `src/lib/services/parallelRealityService.ts:581-584`  
   - Impact: inconsistent shape vs type definition (string array).  
   - Fix: ensure `statusChange` is always a string or filter nulls.  
   - Acceptance: no nullable relationship changes.

## Lint Warning Inventory (non-blocking but should fix)
These warnings are currently treated as non-fatal but should be addressed for stability and maintainability. Remove unused imports/vars and fix hook dependencies.

### Unused imports / variables
- `src/app/agents/[id]/page.tsx`: Users, ChevronRight, AnimatePresence, EmotionSummary, AchievementBadge, RelationshipGraph, notifyAchievement
- `src/app/api/agents/[id]/creative/route.ts`: DAILY_LIMIT
- `src/app/api/agents/[id]/dream/route.ts`: DAILY_LIMIT
- `src/app/api/agents/[id]/journal/route.ts`: DAILY_LIMIT
- `src/app/api/agents/[id]/learning/route.ts`: Timestamp, MetaLearningState, MessageRecord
- `src/app/api/agents/[id]/profile/route.ts`: PsychologicalProfile, regenerate
- `src/app/api/challenges/route.ts`: where, CHALLENGE_TEMPLATES
- `src/app/api/mentorship/route.ts`: query, where
- `src/app/api/relationships/route.ts`: query, where, AgentRecord
- `src/app/dashboard/page.tsx`: index
- `src/app/simulation/page.tsx`: index
- `src/components/emotions/EmotionTimeline.tsx`: _
- `src/components/knowledge/KnowledgeGraph.tsx`: KnowledgeGraphEdge
- `src/components/knowledge/SharedKnowledgeLibrary.tsx`: error, handleDispute
- `src/components/learning/MetaLearningDashboard.tsx`: LearningProfile
- `src/components/mentorship/MentorshipHub.tsx`: MentorshipSession
- `src/components/parallel/ParallelRealityExplorer.tsx`: Pause, Settings, depth
- `src/components/timeline/TimelineExplorer.tsx`: clusters
- `src/components/visualizations/neural/Effects.tsx`: GodRays
- `src/components/visualizations/neural/ParticleSystem.tsx`: dist
- `src/components/visualizations/neural/ThoughtFlows.tsx`: useState, index
- `src/components/visualizations/neural/UIOverlays.tsx`: useMemo, EMOTION_COLORS, Clock, processingStage; plus `import/no-anonymous-default-export`
- `src/hooks/useNeuralVisualization.ts`: isActive, event
- `src/lib/langchain/agentChain.ts`: _persona, agent
- `src/lib/langchain/memoryChain.ts`: _input, _output
- `src/lib/langchain/tools.ts`: agent, unused eslint-disable
- `src/lib/services/achievementService.ts`: UnlockedAchievement
- `src/lib/services/conceptService.ts`: EmotionType
- `src/lib/services/futurePlanningService.ts`: AgentProgress, dominantEmotions
- `src/lib/services/knowledgeService.ts`: AgentRecord
- `src/lib/services/memoryGraphService.ts`: collection, getDocs, updateDoc, query, where, Timestamp, CONCEPTS_COLLECTION, MEMORY_LINKS_COLLECTION
- `src/lib/services/mentorshipService.ts`: limit, MentorProfile, MenteeProfile, MENTOR_PROFILES_COLLECTION, MENTEE_PROFILES_COLLECTION
- `src/lib/services/metaLearningService.ts`: LearningSession, LearningRecommendation, MemoryRecord
- `src/lib/services/neuralVisualizationService.ts`: EmotionalState, i, type, _
- `src/lib/services/parallelRealityService.ts`: RealityBranch
- `src/lib/services/psychologicalProfileService.ts`: EmotionType, mbti, agreeablenessDiff
- `src/lib/services/relationshipService.ts`: RelationshipEvent, agentMap
- `src/lib/services/timelineService.ts`: _

### Missing hook dependencies
- `src/components/challenges/ChallengeHub.tsx:74` (missing `fetchData`)
- `src/components/creative/CreativePortfolio.tsx:51` (missing `fetchWorks`)
- `src/components/dreams/DreamJournal.tsx:49` (missing `fetchDreams`)
- `src/components/journal/JournalViewer.tsx:63` (missing `fetchEntries`)
- `src/components/profile/ProfileViewer.tsx:65` (missing `fetchProfile`)

## Validation Checklist After Fixes
1) `npm run lint` (expect 0 errors, 0 warnings).  
2) `npx tsc --noEmit` (expect 0 errors).  
3) `npm run build` (expect successful build).  
4) Manual smoke tests:
   - Create agent -> appears on dashboard.
   - Open agent detail -> history loads without empty messages.
   - Send message -> single response.
   - LLM model label reflects provider.
   - Neural visualization renders without console errors.
   - Meta-learning, planning, and parallel reality tabs render without crashes.

