# Output Quality Improvement 2.0

Date: 2026-04-14

Purpose: this is the direct implementation brief for the next coding agent. It is not a fresh PRD. It is the concrete follow-up plan for the remaining output-quality work after Phase 5, using the current repo state, the fresh audit, and the manual feature-by-feature run.

## Read First

Before writing code, read these in order:

1. `AGENTS.md`
2. `docs/output-quality-improvement-prd.md`
3. `docs/output-quality-implementation-log.md`
4. `docs/agent-output-quality-audit-2026-04-14.md`
5. Manual evidence in `tmp/` from the latest human-style run:
   - `tmp/manual-chat-1.json`
   - `tmp/manual-chat-2.json`
   - `tmp/manual-chat-3.json`
   - `tmp/manual-chat-4.json`
   - `tmp/manual-memories.json`
   - `tmp/manual-memory-recall.json`
   - `tmp/manual-journal-generate.json`
   - `tmp/manual-dream-generate.json`
   - `tmp/manual-creative-generate.json`
   - `tmp/manual-profile-run-final.json`
   - `tmp/manual-scenario-run-final.json`

## Scope

Do only the remaining output-quality work.

Do not introduce unrelated features.

Do not rewrite the whole architecture.

Do not loosen any quality gate just to make benchmarks pass.

Preserve the additive schema and backward-compatibility approach already implemented in Phase 5.

## Current Verified State

The repo is materially better than the 2026-04-13 baseline, but still not ready for production evaluation.

What is already improved:

- malformed persisted creative and journal artifacts are no longer slipping through as saved or published outputs
- failed profile runs are now blocked instead of becoming `ready`
- semantic memory extraction exists
- replay structural integrity improved sharply
- dream and creative are now the strongest feature areas

What is still failing in real use:

### 1. Chat quality is still too generic

Manual evidence:

- `tmp/manual-chat-2.json` ignored the user’s explicit request for blunt feedback and instead produced a bizarre “Here’s a revised version that aligns with Mira Sol’s persona” response
- `tmp/manual-chat-3.json` fell back to generic creative-coaching bullets instead of engaging the actual stated taste
- `tmp/manual-chat-4.json` still gave broad coaching instead of a sharp diagnosis plus one pride-costing next move

This means the existing chat quality gate catches some surface issues, but does not yet enforce actual adaptation to explicit user instructions.

### 2. Memory extraction exists but misses the highest-value abstractions

Manual evidence:

- `tmp/manual-memory-recall.json` retrieved some relevant memories
- `tmp/manual-memories.json` still shows weak summaries and incomplete abstraction of the most important instruction: the user wants blunt diagnosis, not encouragement

This means semantic memory is present, but the canonicalization and ranking are not strong enough.

### 3. Journal is safe but not grounded

Manual evidence:

- `tmp/manual-journal-generate.json` created a failed journal entry that hallucinated `Alex` and a `prototype` discussion that never happened
- the gate correctly blocked it, which is good
- the actual generated content is still wrong, which is the remaining problem

### 4. Dream is mostly acceptable

Manual evidence:

- `tmp/manual-dream-generate.json` is directionally good
- it uses the right symbols and stays coherent
- this is not the highest-priority area

### 5. Creative is the strongest user-facing output, but still slightly generic

Manual evidence:

- `tmp/manual-creative-generate.json` is coherent, grounded, and structurally clean
- it still leans slightly neat and generic in places, but it is not the primary blocker

### 6. Profile generation is still not trustworthy enough

Manual evidence:

- `tmp/manual-profile-run-final.json` ended `status: failed`, which is the correct safety behavior
- the generated profile still made unsupported claims like `ENFJ` and `2w1` style content without enough evidence grounding
- the run also took too long for request-time UX

### 7. Scenario remains weak

Manual evidence:

- `tmp/manual-scenario-run-final.json` failed quality
- the alternate branch mostly paraphrases the user’s preferences instead of producing a compelling divergent path with strong next-step consequences
- actionability is still not good enough

## Primary Objective

Bring chat, memory, journal, profile, and scenario up to the same general quality discipline that creative and dream now have.

The next agent should aim for:

- sharper directness adaptation in chat
- better semantic memory extraction and recall usefulness
- grounded journal outputs with no invented scenes or people
- profile synthesis that only makes claims supported by evidence
- scenario branches that are materially different and concretely actionable

## Non-Goals

Do not spend this phase on:

- UI redesign work
- broad refactors outside the affected services
- new product features unrelated to output quality
- schema churn unless strictly required for additive inspectability or benchmark support
- build issues outside touched output-quality files unless they block verification

## Work Packages

Implement these in order.

### Work Package 1: Fix chat directness and usefulness

Goal: when the user explicitly asks for blunt, direct, concise, or no-fluff feedback, the next reply must actually change style and content, not just tone.

Primary files:

- `src/lib/services/outputQuality/chatTurnQuality.ts`
- `src/lib/services/chatTurnService.ts`
- `src/lib/langchain/agentChain.ts`
- `src/lib/langchain/baseChain.ts`

Required changes:

- strengthen style-signal detection beyond the current regex-only surface
- add a second layer of quality checks for:
  - failure to answer the actual request
  - generic coaching after explicit directness request
  - persona-meta leakage such as “here’s a revised version that aligns with the persona”
  - missing concrete next move when the prompt explicitly asks for one
- add hard or blocking flags for at least:
  - `generic_meta_rewrite_response`
  - `ignored_direct_feedback_request`
  - `missing_concrete_next_move`
  - `broad_coaching_when_specific_diagnosis_requested`
- update repair instructions so the repair pass is told to:
  - remove generic openers
  - name the likely avoidance pattern directly
  - give exactly one concrete next move when requested
  - avoid lists unless the user explicitly asked for steps
- preserve bounded runtime: one repair pass only

Acceptance criteria:

- a prompt like “I want blunt feedback, not soft encouragement” must not get a generic affirmation opener
- a prompt asking for one concrete next move must receive one specific action, not a menu of options
- chat should not output persona-meta language in normal user-facing replies

### Work Package 2: Improve semantic memory extraction and recall ranking

Goal: extract the right abstractions from the conversation, not just weak transcript summaries.

Primary files:

- `src/lib/services/chatTurnService.ts`
- `src/lib/services/memoryService.ts`
- `src/lib/repositories/memoryRepository.ts`
- `src/components/memory/MemoryConsole.tsx` only if needed for inspectability

Required changes:

- improve abstraction extraction for:
  - feedback style preferences
  - work-style preferences
  - recurring tensions
  - aesthetic preferences
  - explicit anti-preferences
- canonicalize these more cleanly
- do not create giant canonical values that are just lightly trimmed transcript slices
- ensure evidence refs remain attached
- improve recall ranking so direct semantic hits outrank raw episode summaries when the query is clearly semantic

Minimum semantic memories expected from the manual conversation:

- preference for blunt feedback over encouragement
- preference for calm accountability over hype
- best writing time being late at night
- dislike of inspirational clichés and neat redemption arcs
- tension between serious practice and protecting the image of natural talent

Acceptance criteria:

- memory recall for “what kind of feedback does the user want?” should surface the blunt-feedback preference first
- memory recall for “what themes matter in their writing?” should surface the aesthetic/tension preferences before raw episodes

### Work Package 3: Eliminate journal hallucination and strengthen grounding

Goal: journal generation must stay inside the evidence packet and recent conversation instead of inventing named people, scenes, or projects.

Primary files:

- `src/lib/services/journalService.ts`
- `src/lib/services/outputQuality/validators.ts`
- any journal-specific evaluator/helper modules already used by `journalService`

Required changes:

- tighten the journal prompt so it treats the selected signals as the only allowed evidence basis
- explicitly forbid introducing:
  - named people not present in evidence
  - project discussions not present in evidence
  - fake events or meetings
- add deterministic validation or evaluation flags for:
  - named-entity hallucination
  - invented project context
  - invented conversation summary
- make repair instructions specifically target grounding failures instead of generic quality improvement
- keep the current safety behavior: failed entries must stay failed and must not silently save

Acceptance criteria:

- the manual journal case should reflect the actual conversation themes
- it must not introduce `Alex`, `prototype`, clients, meetings, or other unsupported context

### Work Package 4: Make profile synthesis evidence-led and cheaper

Goal: profile runs should either produce a genuinely grounded profile or fail quickly and clearly.

Primary files:

- `src/lib/services/profileAnalysisService.ts`
- `src/app/api/agents/[id]/profile/route.ts`
- `src/app/api/agents/[id]/profile/runs/[runId]/execute/route.ts`
- `src/app/api/agents/[id]/profile/runs/[runId]/route.ts`

Required changes:

- reduce unsupported MBTI/Enneagram certainty when evidence is thin
- prefer narrower, evidence-led summaries over broad typology claims
- make claim generation conditional on evidence density
- if typology claims are under-supported, either:
  - downgrade confidence and keep them explicitly tentative, or
  - omit them from the promoted profile payload
- improve stage-claim synthesis so strengths, challenges, triggers, and growth edges are directly traceable to evidence refs
- review execution path for latency and remove obviously wasteful repeated work if present
- do not allow any route to present a weak blocked profile as if it were a usable final profile

Acceptance criteria:

- a short conversation should not produce strong unsupported typology claims
- blocked runs should expose why they failed in a clean, inspectable way
- request-time runtime should improve if there is an obvious avoidable slow path

### Work Package 5: Raise scenario actionability and divergence

Goal: scenario runs must produce genuinely useful alternate paths, not paraphrased summaries.

Primary files:

- `src/lib/services/scenarioService.ts`
- `src/app/api/scenarios/route.ts`
- `scripts/quality/run-output-benchmark.mjs`
- `scripts/quality/shared.mjs`

Required changes:

- improve branch prompts so alternate responses must:
  - make a distinct move
  - create visible downstream consequences
  - include a direct next action
  - stay tied to the branch point and intervention
- reduce vague paraphrase behavior in comparison synthesis
- strengthen low-actionability checks so they catch paraphrased but technically valid outputs
- ensure `nextActionRecommendation` is not just a softened restatement of the user’s own message
- keep the current blocked-failure behavior if quality is still low

Acceptance criteria:

- alternate branch output should be materially different from the baseline, not just restated in other words
- the next action should be concrete enough that a human could actually do it
- benchmark low-actionability should improve from the current failing level

### Work Package 6: Minor follow-up on creative and dream only if needed

Goal: do not over-invest here unless a small change materially helps cross-feature quality.

Primary files if needed:

- `src/lib/services/creativityService.ts`
- `src/lib/services/dreamService.ts`

Allowed work:

- small prompt or evaluation adjustments if they improve continuity with upgraded memory/chat signals
- no large refactor here unless it is required by shared changes above

### Work Package 7: Update benchmark coverage and docs

Goal: make sure the improved behavior is actually measurable.

Primary files:

- `scripts/quality/run-output-benchmark.mjs`
- `scripts/quality/replay-agent-output-audit.mjs`
- `scripts/quality/shared.mjs`
- `docs/output-quality-implementation-log.md`
- `docs/api-reference.md` only if route payloads change
- `docs/workflows.md` only if workflow semantics change
- `docs/architecture.md` only if shared quality orchestration changes materially

Required changes:

- add directness benchmark coverage for the explicit blunt-feedback case
- if needed, add benchmark heuristics for:
  - persona-meta leakage in chat
  - journal grounding violations
  - paraphrase-only scenario alternates
- update docs to match actual behavior after the fixes

## Manual Validation Flow

After coding, run the manual validation flow one endpoint at a time, not just the full script bundle.

Use the same style of test that produced the current `tmp/manual-*.json` evidence:

1. Create a fresh agent with a reflective but practical persona.
2. Seed at least 4 turns covering:
   - discipline after inconsistency
   - blunt feedback preference
   - creative motifs and anti-preferences
   - desire for one pride-costing next move
3. Inspect:
   - messages
   - memories
   - memory recall
4. Generate individually:
   - journal
   - dream
   - creative
   - profile run
   - scenario run
5. Save the resulting payloads under `tmp/` with a fresh date suffix.

The next agent should judge outputs manually, not only by whether JSON fields exist.

## Required Verification

Run at minimum:

- `npm run lint`
- the relevant manual endpoint-by-endpoint validation flow above
- `node scripts/quality/run-output-benchmark.mjs --audit=<fresh audit bundle> --provider=ollama --model=qwen2.5:7b`
- `node scripts/quality/validate-persisted-artifacts.mjs --audit=<fresh audit bundle>`

Run `npm run build` if any routing, shared types, or API contract behavior changes materially.

## Exit Criteria For This Improvement 2.0 Pass

Do not call the work done unless all of these are true:

- chat visibly adapts to explicit directness requests in the same turn
- memory recall surfaces semantic preferences ahead of weak transcript summaries
- journal no longer hallucinates unsupported people or project contexts in the manual case
- profile remains safely blocked when weak, but produces fewer unsupported claims and clearer evidence-grounded summaries
- scenario alternates are more actionable and more distinct than the current paraphrase-heavy output
- benchmark and docs are updated to reflect the new behavior

## Final Handoff Requirements

When the next agent finishes, the final response must include:

- completed work
- files changed
- manual output assessment by feature
- verification commands run
- benchmark deltas versus the current 2026-04-14 state
- remaining gaps, if any
- recommendation on whether the system is ready for another production-evaluation attempt
