# Agent Output Quality Audit

Date: 2026-04-13

Agent under test: `Ari Kestrel Audit` (`agent_c5c4d49a058c4e00bda0772a3f1edb35`)

Runtime used: local app on `http://localhost:3001`

LLM used for the audit run: `ollama / qwen2.5:7b`

Raw evidence bundle: `tmp/agent-output-audit-ari-kestrel.json`

## Scope

This audit checked end-to-end output quality and cross-feature coherence for:

- emotion
- memory
- learning
- scenarios
- creative
- dream
- journal
- profile

The test flow created a fresh agent, ran 8 chat turns to seed pressure, project context, relationship tension, memory cues, and style preference, then ran dream, journal, creative, profile, and scenario flows on the same agent.

## Executive Verdict

Not production-ready yet.

The good news is that the system does show real cross-feature continuity. The same motifs recur across chat, dream, journal, creative, profile, and scenario outputs:

- unfinished work
- launch pressure
- cofounder drift / relationship tension
- emotional honesty
- directness under pressure
- anticipation as the dominant live emotion

The blocking issue is quality discipline, not total feature failure. The strongest problem is that multiple features produce structurally wrong output even when the evaluator says the result passed. That means the system can look coherent conceptually while still failing as a production artifact.

## Scorecard

| Area | Score | Verdict |
| --- | --- | --- |
| Emotion | 6/10 | Coherent direction, but too repetitive and mechanically patterned |
| Memory | 5/10 | Stores useful signals, but recall quality and summarization are weak |
| Learning | 7/10 | Best self-diagnostic layer; correctly spots chat weaknesses |
| Scenarios | 4/10 | Flow works, but outputs are too generic and low-actionability |
| Creative | 5/10 | Themes carry through, but format contract is broken and pass logic is unreliable |
| Dream | 8/10 | Strongest feature in this run |
| Journal | 6/10 | Strong reflective content, but storage/output formatting is broken |
| Profile | 4/10 | Pipeline runs, but output is generic and failed its own quality gate |

Overall: `5.6/10`

## What Worked

### 1. Cross-feature theme continuity is real

The system consistently carried these motifs from chat into downstream features:

- pressure distorting judgment
- unfinished plans / unfinished work
- cofounder tension
- fear hiding behind speed
- direct communication as both strength and risk
- anticipation and trust as the main emotional currents

This appears in:

- dream: `The Unfinished Blueprint`
- journal: launch pressure + drifting cofounder + emotional clarity
- creative: dialogue with the launch plan / prototype about speed hiding fear
- profile: directness, emotional honesty, practical usefulness
- scenarios: branching from the “emotional center” answer under pressure

### 2. Dream output is the strongest section

The saved dream is the cleanest example of production-direction quality.

Strengths:

- vivid symbolic language
- strong grounding to recent context
- useful interpretation
- valid downstream side effect through `activeDreamImpression`

The saved dream impression fed back into later chat metadata, which confirms real end-to-end coupling rather than isolated tab output.

### 3. Learning is catching real weaknesses

The learning system correctly identified that the agent overuses structured answer shapes and that this hurts general and creative turns.

This is one of the most credible outputs in the audit because it matches the actual chat quality problems visible in the conversation.

## Main Findings

### Critical 1. Journal output passes evaluation while storing broken artifact structure

The saved journal entry is not stored as a clean journal artifact. It is saved as fenced JSON text.

Evidence:

- saved title is literally `````json``
- saved summary begins with raw JSON
- saved content is a fenced JSON blob, not clean journal prose

Impact:

- UI quality will look broken
- downstream reuse will inherit wrapper noise
- evaluators are not enforcing the actual output contract

This is a production blocker.

### Critical 2. Creative output has the same contract problem

Creative artifacts are also being stored as JSON-like wrapper text rather than clean final content.

Evidence:

- published title is `Title The Kestrel’s Keen Eye`
- content is a JSON object string with embedded triple quotes
- failed creative attempt produced `Title The Kestrel's Feather Summary`

Impact:

- published artifacts are not presentation-ready
- content is harder to render, inspect, and repurpose
- creative success is overstated by the evaluator

This is also a production blocker.

### Critical 3. Creative evaluator / pass logic looks inconsistent

One creative session was published with `pass: true` and `overallScore: 89`.

Another creative session ended `pass: false` with the same `overallScore: 89`.

That suggests at least one of:

- pass threshold logic is wrong
- repair status handling is wrong
- artifact/session state is out of sync with evaluation state

This makes the quality gate untrustworthy.

### High 4. Profile output is the weakest major artifact

The profile run completed, but its own evaluator returned `pass: false` with `overallScore: 74`.

Main quality issues:

- too generic
- not distinctive enough
- communication hints do not fully match the seeded persona
- profile leans on broad personality labels instead of concrete evidence

Example mismatch:

- seeded persona: systems-minded creative strategist, direct, emotionally articulate, pressure-sharpened
- produced profile: generic helper-style `INFJ / Enneagram 2w1 / being loved and needed`

The result is plausible-sounding but not sharply grounded.

### High 5. Profile inspectability is incomplete

The stored run shows `transcriptCount: 10`, but `interviewTurns` have `prompt: null` and `response: null` for every turn.

Impact:

- you cannot audit how the profile was derived
- debugging profile weakness is much harder
- one of the product’s core promises, inspectability, is broken here

### High 6. Chat quality is still too generic, and that weakens every downstream feature

The initial conversation seeded the right themes, but the responses are still too assistant-generic.

Repeated issues:

- overuse of cheerful framing like “Great question!” or “That’s a common pattern I’ve seen before!”
- too many bullet lists
- not enough agent-specific language
- not enough pressure-specific nuance
- weak adaptation to the “blunt feedback” preference

The learning system correctly flagged this problem.

Because chat is the main write point for memory, emotion, and learning, this is upstream debt that spreads everywhere else.

### Medium 7. Memory stores useful facts, but recall quality is still transcript-heavy

Memory did capture two useful structured facts:

- project: AI storytelling workspace for design teams
- preference: blunt feedback over vague encouragement

But memory quality is still limited by weak summaries and transcript-heavy retrieval.

Examples:

- `relationship dynamic tends create internal tension being needed,`
- `admit contradiction style, would self-reflective question! contradiction comes`

The recall results mostly return long conversation chunks rather than refined, reusable memory abstractions.

### Medium 8. Emotion is directionally coherent but too templated

The emotion system did keep a believable high-level state:

- dominant emotion: `anticipation`
- strong `trust` secondary current
- dream and journal increased internal `anticipation` and `trust`

That part works.

The weakness is that many event explanations are visibly formulaic:

- repeated `joy + fear + trust` response pattern
- repeated appraisal explanation about “a problem to solve”
- not enough event-level specificity to the actual content

It feels more like a stable overlay than deep emotional reasoning.

### Medium 9. Scenario outputs are too generic to be very useful

The scenario flow completed and tracked emotional differences correctly, but the actual alternate responses were weak.

Issues:

- baseline and alternate both got `low_actionability`
- wording changes were shallow
- advice stayed generic
- branch comparison did not generate strong enough strategic difference

The scenario engine is inspectable, but not yet valuable enough.

## Cross-Feature Correlation Assessment

### Strong correlations

- Dream, journal, and creative all reused the same central conflict: speed masking fear under launch pressure.
- Dream and journal both carried the cofounder / relationship-tension thread.
- Journal and profile both preserved the “direct but emotionally aware” self-concept.
- Dream save created `activeDreamImpression`, and later chat included dream impression metadata.
- Scenario branching preserved the live emotional baseline and showed trust-shift effects.

### Weak or broken correlations

- Memory does not abstract enough of the agent’s own inner narrative into clean reusable state.
- Profile does not feel as specific as dream/journal/creative, despite having the most evidence.
- Scenario outputs reuse themes but flatten them into generic support language.
- Chat preference memory exists, but the agent still did not become meaningfully blunt.

## Performance Observations

These are not quality scores, but they matter for production viability.

Approximate generation times observed in this run:

- dream generate: ~42s
- journal generate: ~83s to ~105s
- creative generate: ~115s to ~125s
- profile execute: ~174s
- scenario run: ~26s

This is too slow for a production-feeling interactive workspace unless you introduce much stronger staging, progressive rendering, caching, or faster models.

## Priority Fixes

### Priority 1. Enforce clean artifact contracts before save/publish

Do not allow journal or creative save/publish if the artifact still contains:

- fenced JSON
- raw JSON object wrappers
- `**Title:**` / `**Summary:**` wrapper formatting
- malformed JSON
- synthetic title prefixes like `Title ...`

The evaluator must score format compliance as a hard gate, not a soft preference.

### Priority 2. Improve upstream chat voice before tuning downstream tabs

Focus on:

- fewer generic encouragement openers
- fewer default bullet lists
- stronger persona-specific diction
- better pressure-aware language
- real style adaptation when the user states a preference

This will improve memory, learning, profile, and scenario quality at once.

### Priority 3. Tighten profile distinctiveness and evidence grounding

The profile needs:

- stronger weighting toward recent conversation evidence
- less generic personality label drift
- clearer mapping from evidence to claims
- stored interview prompts and responses for auditability

### Priority 4. Upgrade memory abstraction quality

Add better synthesis for agent-self facts and recurring tensions, not just user facts and raw transcript chunks.

The system should be able to store memories like:

- `pressure pattern: speed used to mask uncertainty`
- `relationship trigger: cofounder drift causes vigilance and overfunctioning`
- `style contradiction: directness vs emotional nuance`

### Priority 5. Make scenario branches materially different

The branch runner should generate more than paraphrases.

A useful alternate branch should change:

- degree of directness
- action prioritization
- relational risk handling
- emotional stance
- concrete next step

## Recommended Acceptance Bar For Production

I would not call these sections production-grade until all of the following are true:

- saved journal and creative artifacts are always clean render-ready content
- profile passes its own evaluator reliably
- profile run detail stores non-null interview prompts and answers
- scenario branches stop producing `low_actionability` in common cases
- chat voice feels agent-specific across at least 10-15 turns
- memory recall returns compressed reusable beliefs, not mostly transcript chunks
- generation latency drops enough that the product does not feel stalled

## Final Verdict By Section

- Dream: closest to production direction
- Learning: useful and credible
- Journal: promising content, broken artifact contract
- Creative: promising themes, broken artifact contract and inconsistent gating
- Emotion: coherent but shallow
- Memory: functional but weakly abstracted
- Profile: not good enough yet
- Scenarios: inspectable but not strong enough yet

If you want one sentence: the system already has cross-feature thematic coherence, but the quality gates are still too weak and the artifact formatting is still too broken to call these outputs production-grade.
