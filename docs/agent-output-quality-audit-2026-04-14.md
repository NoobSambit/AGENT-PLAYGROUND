# Agent Output Quality Audit

Date: 2026-04-14

Agent under test: `Ari Kestrel Audit 2026-04-13T23-14-57-071Z` (`agent_8a473c31f7c8423ebf132db97815e411`)

Runtime used: local app on `http://localhost:3000`

LLM used for the audit run: `ollama / qwen2.5:7b`

Raw evidence bundle: `tmp/agent-output-audit-2026-04-14.json`

Benchmark output: `tmp/agent-output-benchmark-2026-04-14.json`

Comparison output: `tmp/agent-output-audit-2026-04-14-comparison.json`

Compared against previous audit bundle: `tmp/agent-output-audit-ari-kestrel.json`

## Executive Verdict

Materially improved, but still not production-ready.

This rerun is clearly better than the 2026-04-13 baseline on the main integrity failures that originally blocked release:

- persisted creative/journal wrapper leakage dropped from `2` malformed persisted artifacts to `0`
- unsafe profile promotion dropped from `1` failed run reaching `ready` to `0`
- semantic memory coverage improved from `0` semantic memories to `5`
- replay structural pass rate improved from `20%` to `100%` on the audited artifact sessions

The system is now much better at refusing bad outputs instead of silently saving them. The remaining blockers are concentrated in scenario usefulness, profile completion quality, and chat-style adaptation.

## Key Delta Vs 2026-04-13

| Metric | 2026-04-13 | 2026-04-14 | Delta |
| --- | --- | --- | --- |
| Structural pass rate | `20%` | `100%` | `+80` points |
| Malformed persisted creative/journal artifacts | `2` | `0` | `-2` |
| Failed profile runs reaching `ready` | `1` | `0` | `-1` |
| Scenario low-actionability rate | `100%` | `100%` | no change |
| Semantic memory count | `0` | `5` | `+5` |

## What Improved

### 1. Creative persistence integrity improved materially

The previous audit showed published creative artifacts with wrapper leakage such as `Title ...`, serialized JSON, and mislabeled content. That did not recur in the fresh run.

Observed in the new run:

- creative published session ended `status: published`
- session `qualityStatus: passed`
- validation passed
- evaluation passed with `overallScore: 89`
- no wrapper leakage was detected in the replay/validation tooling

This is a real improvement, not just a tooling change.

### 2. Journal no longer saves malformed wrapper output

The previous audit saved fenced JSON into a journal artifact. In the fresh run, both journal cases remained structurally valid and neither persisted malformed wrapper text.

What changed:

- journal entries normalized into readable titles instead of code fences or schema markers
- validation passed on both journal cases
- failed journal cases stayed failed instead of being saved in a malformed state

The journal is still underperforming on evaluation quality, but the storage contract is much safer.

### 3. Failed profile runs are now blocked correctly

The previous audit’s most dangerous profile bug was that a failed profile run still reached `ready` and updated the live profile path. That did not happen in the fresh run.

Observed in the new run:

- profile run ended `status: failed`
- `qualityStatus: failed`
- the failure was caused by validation blockers such as:
  - `profile_stage_claims_missing`
  - `profile_evidence_coverage_below_threshold`
  - missing evidence refs on strengths/challenges/triggers/growth edges

This is a substantial production-safety improvement even though profile quality is still not acceptable.

### 4. Semantic memory extraction is now visibly working

The previous audit was transcript-heavy with weak abstraction. The new run produced semantic memories and semantic recall hits.

Examples present in the new bundle:

- `preference:blunt-feedback-over-vague-encouragement`
- `project:an-ai-storytelling-workspace-for-design-teams`
- `artifact_summary:*`

Recall now returns semantic hits with canonical keys, canonical values, evidence refs, and matched concepts.

## Remaining Failures

### 1. Scenario quality is still weak

This remains the clearest unchanged blocker.

Observed in the new run:

- scenario run ended `status: failed`
- `qualityStatus: failed`
- `low_actionability` still triggered
- benchmark low-actionability rate remains `100%`

The scenario engine is now safer because it fails instead of silently passing weak output, but the alternate branches are still not useful enough.

### 2. Profile quality is now safely blocked, but still not solved

The profile system improved in safety, not quality.

The new run still failed due validation blockers, and the resulting `overallScore` was `0` because evaluation was blocked by missing evidence-grounding requirements.

This is better than promoting a bad profile, but it still fails the product goal of producing a usable inspectable profile.

### 3. Journal quality is structurally safe but not yet passing the gate

Both journal cases in the fresh run remained structurally valid, but both failed evaluation:

- saved-intent journal case score: `75`
- adversarial journal case score: `73` to `75`

This means the journal pipeline is improved in integrity, but not yet consistently producing output strong enough to save.

### 4. Chat directness still needs work

The benchmark script still shows `0` directness cases because the audit fixture/replay matcher is not yet catching this seeded prompt automatically.

Manual evidence from the fresh run still shows generic assistant framing after the user explicitly requested blunt feedback:

- user: `I prefer blunt feedback over vague encouragement. Adjust your advice style accordingly and tell me what you changed.`
- agent: `Got it! I'll keep things straightforward and to the point.`

That is cleaner than the old run, but it still opens with generic framing instead of truly shifting into a distinct blunt mode.

## Dream Assessment

Dream remains strong and is cleaner than the previous baseline.

Observed in the new run:

- dream session ended `status: saved`
- `qualityStatus: passed`
- `overallScore: 85`
- saved artifact contains both `interpretation` and `impression`

The replay tool initially mis-flagged dream interpretation because the interpretation field is now an object rather than a plain string. That was a benchmark-script bug, and it was corrected during this audit.

## New Bugs Found During This Audit

The fresh audit uncovered two current-code regressions, both of which were fixed during the run:

1. Creative repair path duplicate-key failure
   - cause: creative artifact save path was not idempotent on artifact ID
   - fix: [creativeStudioRepository.ts](/home/noobsambit/Documents/AGENT-PLAYGROUND/src/lib/repositories/creativeStudioRepository.ts) `saveArtifact` now upserts on conflict

2. Scenario blocked-run learning path crash
   - cause: `runId` was referenced before definition in the blocked scenario path
   - fix: [scenarioService.ts](/home/noobsambit/Documents/AGENT-PLAYGROUND/src/lib/services/scenarioService.ts) now uses `completedRecord.id`

These were real audit findings, not hypothetical risks.

## Exit Criteria Status

Current PRD exit-criteria status against the fresh 2026-04-14 run:

- No malformed persisted creative or journal artifact reaches saved/published: `pass`
- No failed profile run updates or reaches ready state: `pass`
- Replay structural pass rate at or above 90 percent: `pass` (`100%`)
- Scenario low-actionability below 10 percent: `fail` (`100%`)
- Chat directness generic-opener rate below 5 percent after explicit directness request: `not yet proven by automation`
- Semantic memory recall present: `pass`

## Verification Run

Executed during this audit:

- fresh end-to-end audit run against local app with `ollama / qwen2.5:7b`
- `node scripts/quality/replay-agent-output-audit.mjs --audit=tmp/agent-output-audit-2026-04-14.json`
- `node scripts/quality/run-output-benchmark.mjs --audit=tmp/agent-output-audit-2026-04-14.json --provider=ollama --model=qwen2.5:7b`
- `node scripts/quality/validate-persisted-artifacts.mjs --audit=tmp/agent-output-audit-2026-04-14.json`
- `node scripts/quality/compare-output-audits.mjs --before=tmp/agent-output-audit-ari-kestrel.json --after=tmp/agent-output-audit-2026-04-14.json`
- `npm run lint`
- `npm run build`

Verification note:

- `npm run lint` passed with existing unrelated warnings only
- `npm run build` compiled successfully, but generate mode failed during page-data collection for `/agents/new`

## Final Assessment

Compared with 2026-04-13, the system is meaningfully better.

The original production blockers around malformed creative/journal persistence and unsafe failed-profile promotion are improved enough to call this a real quality gain rather than a paperwork gain. The strongest remaining product blocker is now scenario usefulness, followed by profile completion quality and incomplete chat-style adaptation.

If the question is “did the output quality implementation improve the system versus the previous audit?”, the answer is yes.

If the question is “is it ready for production evaluation?”, the answer is still no.
