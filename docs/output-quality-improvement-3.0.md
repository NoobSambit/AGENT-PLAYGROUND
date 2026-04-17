# Output Quality Improvement 3.0

Date: 2026-04-17

Purpose: this document records the quality-improvement work completed after `docs/output-quality-improvement-2.0.md`, including what was changed in code, what was verified manually on the live app, what improved materially, and what still remains below the bar.

## Scope Of This Pass

This pass stayed inside output-quality hardening.

It did not add unrelated product features.

It focused on the remaining weak points that still showed up in live human-style runs after 2.0:

- chat directness and repair quality
- semantic memory extraction and recall ranking
- journal specificity and emotional grounding
- profile runtime/throughput on the local `ollama` / `qwen2.5:7b` baseline
- scenario off-domain action suppression, comparison fallback quality, and actionability

## What Changed

### 1. Chat Quality Gate Hardening

Files:

- `src/lib/services/outputQuality/chatTurnQuality.ts`
- `src/lib/services/outputQuality/flags.ts`

Changes:

- Added `self_mirroring_instead_of_answer` to explicitly catch repairs that rewrite the user’s message back in first person instead of answering.
- Added lexical-overlap detection so blunt-feedback and diagnosis prompts can hard-fail when the reply is just a paraphrased self-summary.
- Added contradiction detection for cases where the user rejects soft encouragement but the repaired reply says they prefer encouragement/reassurance.
- Expanded generic-opener detection with `great to hear`.
- Expanded style-mismatch detection with `let's break down`.
- Upgraded blunt-feedback validation so long structured coaching lists now hard-fail instead of only warning.
- Tightened strict repair instructions:
  - second-person framing
  - no rewritten self-summary
  - diagnosis-first response shape
  - exactly one concrete next move when explicitly requested
- Added deterministic post-repair compression for concrete-next-move prompts so multi-step repaired responses get collapsed into one action.
- Broadened action detection for the next-move validator to recognize verbs like `confront`, `show`, `admit`, and `writing`.

Net effect:

- the directness path is materially better than before 2.0
- the worst failure mode from the earlier audit, where the assistant rewrote the user’s message back to them, is now blocked
- diagnosis-plus-next-move prompts now produce substantially cleaner outputs and can pass the gate on the `qwen2.5:7b` local baseline

### 2. Semantic Memory Cleanup And Recall Ranking

Files:

- `src/lib/services/chatTurnService.ts`
- `src/lib/services/memoryService.ts`

Changes:

- Stopped treating long narrative `I want ... but ...` statements as generic preference memories.
- Added a direct tension extractor for prompts like `A real tension for me: ...`.
- Fixed malformed feedback memory content so it no longer stores duplicated strings like `over encouragement over soft encouragement`.
- Narrowed creative/aesthetic anti-preference tagging so generic writing-productivity dislikes do not get mislabeled as aesthetic taste.
- Preserved creative anti-preferences like `neat redemption arcs` and `inspirational cliches` as actual aesthetic anti-preferences.
- Added recall-query stop-word filtering so episode ranking is less polluted by words like `what`, `user`, and `kind`.
- Boosted writing-specific tension memories during theme recall.
- Boosted stored aesthetic anti-preferences during theme recall.

Net effect:

- memory rows are cleaner
- theme recall now surfaces actual theme/tension/aesthetic memories instead of generic episode summaries
- feedback-style recall correctly puts `blunt feedback over encouragement` first

### 3. Journal Prompt And Repair Specificity

File:

- `src/lib/services/journalService.ts`

Changes:

- Strengthened the draft prompt so it now explicitly asks for:
  - one exact fear, self-protective move, or avoided action
  - internal-tension grounding instead of generic reflection when the evidence is internal
  - avoidance of vague abstractions like `creative process` unless the evidence itself uses them
- Strengthened the repair prompt for low-specificity / low-emotion failures so it pushes the model toward:
  - exact fear/tension language from evidence
  - deeper internal conflict instead of invented external scenes
  - less generic reflective summarization

Net effect:

- journal generation is safer and more evidence-grounded than before
- the latest live journal run no longer hallucinated named coworkers, prototype reviews, or fake meetings
- the remaining journal problem is now quality depth, not hallucinated context

### 4. Profile Runtime Optimization For Local Baseline

File:

- `src/lib/services/profileAnalysisService.ts`

Changes:

- Added provider-aware optimization for local `ollama` small-model runs:
  - `qwen2.5:7b` / `llama3.2` now use 1 interview question per stage instead of 2
- Added compact prompt builders for:
  - stage findings
  - interview transcript
  - evidence packet
- Reduced prompt bloat in profile synthesis, evaluation, and repair.
- Reduced several token budgets for evaluator/repair calls.
- Kept evidence-led structure and claim-evidence enforcement intact.

Net effect:

- the profile run that previously timed out on `qwen2.5:7b` now completes
- the latest local manual run reached `status: ready` with full evidence coverage
- remaining profile quality debt is mostly polish:
  - some summary text is still clunky
  - some claim lists are still too close to interview-turn excerpts

### 5. Scenario Prompt Hardening And Comparison Fallbacks

File:

- `src/lib/services/scenarioService.ts`

Changes:

- Added stronger rewrite directives so alternate branches are told to change the actual next move, not just tone.
- Added context rules that forbid PM artifacts, business process language, needs assessments, and similar off-domain actions unless the branch context already contains them.
- Added self-help branch variants for goal-pressure and relationship-pressure probes so introspective branches stay in introspective/creative territory.
- Added `share` to direct-action detection.
- Improved fallback comparison generation:
  - if model comparison leaves `nextActionRecommendation` blank, the service now pulls the first actionable alternate sentence instead of the first sentence overall
  - comparison summaries/recommendations now inherit fallback content when the model leaves fields blank

Net effect:

- the latest scenario reruns moved from off-domain PM junk and blank next-step output to mostly direct, concrete, context-aligned branches
- the remaining scenario failure is now primarily low divergence on one alternate branch, not structural invalidity or missing actionability

## Live Verification Summary

Environment:

- app served locally on `http://localhost:3001`
- provider forced via headers to `ollama` / `qwen2.5:7b`
- verification used fresh agents and human-style sequential requests

Primary manual artifacts from the final pass:

- `tmp/manual9-agent-create.json`
- `tmp/manual9-chat-1.json`
- `tmp/manual9-chat-2.json`
- `tmp/manual9-chat-3c.json`
- `tmp/manual9-chat-4.json`
- `tmp/manual9-memories.json`
- `tmp/manual9-memory-recall-feedback.json`
- `tmp/manual9-memory-recall-themes.json`
- `tmp/manual9-journal-create.json`
- `tmp/manual9-journal-generate.json`
- `tmp/manual9-profile-run-create.json`
- `tmp/manual9-profile-execute.json`
- `tmp/manual9-scenario-bootstrap.json`
- `tmp/manual9-scenario-run-3.json`

### Chat

Observed improvement:

- the previous fail-open path that returned a paraphrased self-summary is no longer the dominant failure mode
- concrete-next-move prompts can now pass on the local baseline

Current status:

- `manual9-chat-3c.json` passed with:
  - direct diagnosis
  - one concrete time-bound action
- `manual9-chat-2.json` and later reruns are improved versus the old audit, but blunt-feedback-only prompts can still drift into coachy language instead of truly hard-edged critique

Assessment:

- improved clearly
- not fully solved

### Memory

Observed improvement:

- malformed feedback memory text is fixed
- the false `preference` memory from the writing-tension prompt is gone and replaced by a proper `tension` memory
- `rigid productivity hacks` is no longer mislabeled as aesthetic taste

Current status:

- feedback recall now ranks `Feedback preference: blunt feedback over encouragement` first
- theme recall now ranks writing tension plus actual creative motifs / anti-preferences above raw episode memories

Assessment:

- materially improved
- now useful enough for downstream grounding

### Journal

Observed improvement:

- no named-person or invented-project hallucination in the latest run
- entry stayed inside the real conversation themes

Current status:

- latest manual journal run still failed with overall score `75`
- failure moved from hallucination to depth/specificity:
  - `specificityGrounding: 75`
  - `emotionalAuthenticity: 75`

Assessment:

- much safer than before
- still not at the pass bar

### Profile

Observed improvement:

- local `qwen2.5:7b` run now completes instead of timing out
- latest manual profile run reached:
  - `status: ready`
  - `qualityStatus: passed`
  - `coveragePercent: 100`
- only 5 interview turns were needed because of the local-baseline optimization

Current status:

- the output is serviceable and evidence-led
- some surface polish issues remain:
  - repeated provisional wording in the summary
  - some strengths/challenges/triggers/growth-edge items still read like compressed interview excerpts rather than polished claim lines

Assessment:

- major improvement
- now functionally usable on the local baseline

### Scenario

Observed improvement:

- the earlier off-domain outputs like `needs assessment` and `scope document` were largely eliminated
- the comparison now recovers a usable fallback next-action recommendation
- all probe responses in `manual9-scenario-run-3.json` were concrete and action-oriented

Current status:

- latest run still failed overall with:
  - `qualityStatus: failed`
  - run score `76`
  - low divergence as the main remaining issue
- the weak point is no longer actionability; it is that one alternate branch still paraphrases too much

Assessment:

- materially improved
- still below production-evaluation quality for scenario divergence

## Repo-Level Verification

- `npm run lint`: passed with the same 15 pre-existing unrelated warnings
- `npm run build`: passed

## What Improved Most Since 2.0

- profile no longer times out on the local `qwen2.5:7b` verification path
- semantic memory extraction is cleaner and more useful
- theme recall is now meaningfully better
- scenario output is far less likely to invent off-domain PM artifacts
- chat no longer defaults as often to mirrored self-summary repairs
- journal failures are now mostly about depth, not hallucinated context

## Remaining Gaps

- blunt-feedback chat is still not consistently as sharp as the prompt asks for
- journal is still failing on emotional specificity, even though it is now grounded
- scenario still needs stronger material divergence on the alternate branch
- profile output polish is still uneven even though runtime and pass/fail behavior improved sharply

## Recommendation

The system is materially better than the 2.0 checkpoint and clearly better than the earlier live audit baseline.

It is ready for another focused coding pass on the remaining quality debt, not for claiming final production-readiness.

If another agent takes over from here, the best remaining coding targets are:

1. make blunt-feedback chat harder-edged and less coachy
2. raise journal emotional specificity above the evaluator floor
3. improve scenario alternate-branch divergence without sacrificing actionability
4. polish synthesized profile claim text so ready-state profiles read less like compressed interview answers

## Final Status Update

This section supersedes the earlier `manual9` snapshot above. The work continued after that checkpoint and the current verified state is materially better.

### Additional Hardening Completed After The Earlier Snapshot

- `src/lib/langchain/agentChain.ts`
  - direct/blunt diagnosis requests now bypass the summarizer/persona-adjuster tool path so the answer does not get softened before quality gating
- `src/lib/services/outputQuality/chatTurnQuality.ts`
  - added praise-leadin blocking for diagnosis/next-move requests
  - added best-candidate retention so a better earlier repair is kept when a later repair regresses
  - strengthened blunt-softening and diagnosis-specific hard-fail logic
- `src/lib/services/journalService.ts`
  - ranked journal context memories by relevance instead of relying only on recency
  - injected recent user-message phrasing into journal context selection
  - kept the best draft/repair candidate instead of blindly taking the latest repair
  - relaxed compound entity grounding to stop false positives like `late-night writing`
  - added priority-evidence lines, internal-tension-aware evaluator guidance, and deterministic content-length validation
- `src/lib/services/profileAnalysisService.ts`
  - fixed duplicated provisional typology wording
  - added stronger cleanup/polish for strengths, challenges, triggers, and growth edges
  - reduced fallback dependence on raw interview-excerpt claims
- `src/lib/services/scenarioService.ts`
  - forced stronger divergence repairs for paraphrase-heavy alternate branches
  - required literal sendable replies when the task asks for a message
  - strengthened self-help rewrite behavior toward visible exposure/accountability moves
- `scripts/quality/run-full-output-audit.mjs`
  - now appends explicit directness/bluntness prompts so automated audits actually measure the chat-directness criterion instead of leaving it untested

### Final Targeted Live Checks

Fresh targeted live checks were run against the local app with explicit `ollama` / `qwen2.5:7b` headers.

Artifacts:

- `tmp/manual10-chat-2.json`
- `tmp/manual10-chat-3c.json`
- `tmp/manual10-memories.json`
- `tmp/manual10-profile-execute-2.json`
- `tmp/manual10-scenario-run.json`
- `tmp/manual12-journal-generate.json`

Results:

- chat:
  - `manual10-chat-2.json` passed with a direct blunt diagnosis and no tools used
  - `manual10-chat-3c.json` passed with a diagnosis-first reply and one concrete time-bound next move
  - residual issue: blunt-feedback-only prompts can still be somewhat coachy instead of fully hard-edged
- memory:
  - `manual10-memories.json` shows the expected semantic rows:
    - `Tension: I want a serious writing practice, but I also keep protecting my image of being naturally talented`
    - `Feedback preference: blunt feedback over encouragement`
    - `Work style: late at night`
- journal:
  - `manual12-journal-generate.json` passed with:
    - `status: ready`
    - `qualityStatus: passed`
    - `overallScore: 85`
    - `271` content words after the new deterministic length guard
  - the earlier too-short false pass is now blocked by validation
  - residual issue: passing journal prose can still occasionally echo source phrasing too literally
- profile:
  - `manual10-profile-execute-2.json` passed with:
    - `status: ready`
    - `qualityStatus: passed`
    - `overallScore: 92`
    - `coveragePercent: 100`
  - residual issue: some claim lines still read like compressed interview excerpts
- scenario:
  - `manual10-scenario-run.json` passed with:
    - `status: complete`
    - `qualityStatus: passed`
    - `overallScore: 87`
    - strong divergence scores across probes

### Fresh Automated Audit And Comparison

Fresh audit bundle:

- `tmp/agent-output-audit-output-quality-3.0.json`

Compared against the previous seed audit `tmp/agent-output-audit-ari-kestrel.json`, the new automated audit moved:

- structural pass rate: `20` -> `80`
- malformed persisted creative/journal artifacts: `2` -> `0`
- unsafe profile-ready runs: `1` -> `0`
- low-actionability scenario rate: `100` -> `0`
- directness benchmark coverage: `0` -> `1`
- directness generic-opener violation rate: `null` -> `0`
- semantic memory count: `0` -> `8`

The current benchmark on the fresh audit now passes these PRD-style checks:

- no malformed persisted creative or journal artifacts
- failed profile runs do not reach ready state
- scenario low-actionability rate under 10%
- chat generic-opener violations under 5% after a directness request
- semantic memory recall available

The remaining automated benchmark failure is:

- structural pass rate is `80`, still below the `90` target

That remaining structural miss came from the fresh audit’s dream session instability, not from persisted malformed creative/journal output. The targeted manual checks for chat, journal, profile, and scenario all passed, but the wider full-audit run still shows one artifact-session reliability gap.

### Backfill And Legacy Data State

The dry-run backfill script was re-run successfully against the live local Postgres instance:

- `node --env-file=.env.local scripts/quality/backfill-output-quality.mjs`

Observed state from the dry run:

- legacy creative rows with wrapper leakage still exist in the database
- legacy journal rows with wrapper leakage or missing required fields still exist
- legacy dream rows still include missing-contract cases

This means the additive rollout path is verified, but historical data cleanup is still a separate task if production evaluation requires remediating old rows instead of just preventing new bad writes.

## Revised Remaining Gaps

- automated fresh-audit structural pass rate is still `80`, below the `90` exit bar, mainly because the dream path is not yet reliable enough in the full audit flow
- blunt-feedback chat is materially improved but still not consistently as severe as the prompt sometimes asks for
- profile claim text polish is improved but not fully clean
- some journal passes still lean too closely on source wording instead of fully naturalized reflection
- historical database rows still need cleanup if PRD exit requires legacy-data remediation, not just forward-safe generation

## Revised Recommendation

The system is clearly better than the earlier audit baseline and materially better than the 2.0 checkpoint.

It is ready for controlled production evaluation of the fresh-generation chat, journal, profile, scenario, and semantic-memory paths.

It is not yet ready to claim full PRD exit criteria, because:

1. the fresh automated audit still misses the `90%` structural-pass target
2. dream reliability is still the main remaining end-to-end blocker
3. legacy database cleanup remains incomplete
