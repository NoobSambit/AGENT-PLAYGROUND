# Arena Creation And Output Quality Report

## Scope

This document explains:

- how the arena feature was created
- how the execution model was designed around one shared local model
- what output-quality problems were discovered during live runs
- how each major downside was improved over time
- what still limits debate quality today
- what the best next upgrades are

The arena was built under a strict practical constraint:

- only one local LLM instance should be active at a time
- the same model must sequentially play the head, every debater, and the final evaluator
- the system must still remain inspectable, stable, and legible in the UI

That constraint shaped almost every architecture and prompt-engineering decision in v1.

## What We Built

Arena is a head-led, inspectable debate system with:

- a draft preparation flow on `/simulation`
- editable seat briefs for each selected agent
- one shared provider/model for the full run
- append-only debate events for live playback and replay
- score snapshots per round
- compacted round ledger state
- per-agent debate notebooks
- a final report with winner, decisive moments, unresolved questions, and improvement notes

Core implementation areas:

- UI: `src/app/simulation/page.tsx`
- API:
  - `src/app/api/arena/runs/route.ts`
  - `src/app/api/arena/runs/[runId]/route.ts`
  - `src/app/api/arena/runs/[runId]/execute/route.ts`
  - `src/app/api/arena/runs/[runId]/cancel/route.ts`
- Orchestration: `src/lib/services/arenaService.ts`
- Persistence:
  - `src/lib/repositories/arenaRepository.ts`
  - `src/lib/arena/firestoreStore.ts`
  - `src/lib/db/schema.ts`

## Architecture Decisions

### 1. Arena Runs Are Sandboxed

Arena debates are intentionally isolated from long-term agent state.

They do not write into:

- memories
- relationships
- emotions
- broadcasts
- agent counters

This prevents “simulation artifacts” from polluting real agent identity.

### 2. The Runtime Is Event-Sourced

The system persists each meaningful step as an event:

- run prepared
- seat generated
- phase started
- head directive
- debater turn
- round summary
- score update
- head intervention
- report published
- cancellation or failure

This solved two product needs at once:

- live polling UI could render exactly what was happening
- debugging output quality became possible because every failure left artifacts behind

### 3. Prompt Context Is Compacted, Not Replayed

A 10 to 12 round debate cannot keep replaying the full transcript into every prompt on a low-parameter local model.

Instead, the runtime keeps:

- compact round ledger summaries
- unresolved threads
- score snapshots
- per-agent notebooks with:
  - commitments
  - attacks to answer
  - concessions
  - next pressure points

This was the main context-engineering choice that made longer local debates feasible.

### 4. One Model, Many Roles

Because one model handles every role, the system had to add explicit role isolation:

- arena constitution prompt
- seat briefs
- alignment tags
- move type requirements
- required target opponent
- head-only prompt contract
- debater-only prompt contract
- report-only prompt contract

Without that separation, the model quickly blurred roles and reused the same voice across seats.

## How The Feature Was Built

### Phase 1. Arena Foundation

The first milestone was getting a complete end-to-end arena workflow working:

- prepare a draft run
- generate seats
- edit seats
- launch execution
- persist live events
- poll and render the transcript
- publish a final report

This phase established:

- the new `arena_runs` and `arena_events` storage model
- route contracts for create, update, execute, poll, and cancel
- a dedicated `arenaService`
- repository and Firestore support
- the live `/simulation` workspace

At this point the system worked functionally, but output quality was still weak.

### Phase 2. UI Rework

The original simulation page was not readable enough for a live multi-agent arena.

The page was reworked into a more inspectable workspace model inspired by the stronger agent-tab visual language:

- stronger panel structure
- clearer score and state hierarchy
- more explicit head activity
- improved transcript layout
- better live-run scanning

The goal was to make the page feel active and operational rather than like a generic log dump.

### Phase 3. Single-Model Debate Hardening

Once the arena ran end-to-end, the real work moved to output quality.

The first hardening layer focused on runtime stability:

- structured JSON generation
- extraction-based parsing
- bounded repair attempts
- final regeneration attempts
- deterministic fallbacks when the model failed

This prevented runs from collapsing on malformed JSON or minor contract drift.

### Phase 4. Quality-Guided Orchestration

The next phase focused on debate quality rather than basic runtime success.

The runtime added:

- deterministic head directives for local-model runs
- deterministic final reports for local-model runs
- explicit move schedules across long debates
- stronger per-seat alignment instructions
- opponent targeting requirements
- pressure-thread tracking
- head interventions on convergence

This stopped the debate from behaving like a loose chat loop.

### Phase 5. State Engineering For Long Runs

The next set of changes addressed a deeper problem:

the model was not only drifting, it was being fed stale, repetitive internal state.

The fixes included:

- compaction of notebook state
- deduping semantically similar claims
- deduping unresolved pressure points
- cleaning recursive “X pressed: Y pressed: ...” threads
- selecting decisive moments from scored turns rather than just the latest turns

This improved late-round readability and reduced state pollution.

### Phase 6. Stance-Drift Controls

Three-seat debates exposed the hardest remaining weakness:

- one seat could start arguing the opposing side while still sounding fluent

To address that, the runtime added:

- stance cue auditing
- stronger claim-summary discipline
- validation for alignment drift
- fallback substitution when a generated turn clearly undercut its assigned seat

This did not solve every semantic drift case, but it moved the system from “quietly wrong” to “detectable and recoverable.”

## Main Output Problems We Found

The arena did not fail in one single way. It failed in layers.

### 1. Report Integrity Failures

Early runs showed:

- winner id and verdict text disagreeing
- scorecards praising the wrong agent
- report arrays containing `"[object Object]"`

These were trust-breaking issues because the user could not rely on the final report even when the debate itself completed.

### 2. Late-Round Repetition

Once debates crossed several rounds, the model often converged onto one recycled frame.

Typical symptoms:

- same claim with minor paraphrase
- same unresolved question restated over and over
- same pressure point repeated without meaningful escalation

### 3. Weak Role Separation

With one shared model, the head and debaters could bleed into each other unless heavily constrained.

Typical symptoms:

- generic assistant phrasing
- one agent implicitly speaking like another
- seat personas flattening into the same argumentative style

### 4. Stance Drift

This was especially visible in 3-seat debates.

A debater assigned to support a proposition could produce a strong, coherent sentence that actually advanced the anti-position.

This is harder than JSON failure because the text looks fluent while still being strategically wrong.

### 5. Low-Value Pressure Threads

Pressure points often became:

- recursive
- over-scaffolded
- semantically duplicated
- too close to the original claim

This reduced the head’s ability to keep the debate moving.

## How Each Downside Was Improved

### A. Structured Output Recovery

Problem:

- local model sometimes returned invalid JSON or schema drift

Fixes:

- JSON extraction parser
- repair pass
- regeneration pass
- deterministic fallbacks

Impact:

- arena runs became much more stable
- malformed generation stopped being the main failure mode

### B. Deterministic Head And Report For Local Runs

Problem:

- the local model was overburdened when asked to be debater, moderator, and final judge with equal reliability

Fixes:

- deterministic head directive generation for Ollama path
- deterministic final report generation for Ollama path
- winner derived from score state instead of trusting inconsistent narrative output

Impact:

- final reports became internally consistent
- head direction became more predictable and useful

### C. Better Debate Scheduling

Problem:

- long debates stayed stuck in “rebuttal forever”

Fixes:

- explicit move types:
  - `thesis`
  - `rebuttal`
  - `example`
  - `tradeoff`
  - `closing`
- stage-aware scheduling for 10 to 12 round debates

Impact:

- debates now have a clearer rhythm
- later rounds are more likely to narrow toward a verdict instead of reopening the opening argument

### D. Notebook And Ledger Compaction

Problem:

- internal state kept too many near-duplicate claims and attacks

Fixes:

- semantic deduping for commitments
- semantic deduping for attacks to answer
- semantic deduping for next pressure points
- semantic deduping for unresolved questions

Impact:

- less self-poisoning context
- better late-round diversity

### E. Pressure-Thread Normalization

Problem:

- unresolved threads accumulated ugly helper phrases and recursive prefixes

Fixes:

- `cleanPressureThread`
- `cleanPressureCore`
- target-aware pressure normalization

Impact:

- pressure threads became more readable
- the head and report now surface cleaner unresolved questions

### F. Report Normalization

Problem:

- report arrays and scorecards could carry malformed or mismatched content

Fixes:

- object-safe string-list normalization
- scorecard summary safety checks
- decisive moment selection from scored evidence

Impact:

- final reports now feel like products of the debate state rather than random detached summaries

### G. Stance-Drift Detection

Problem:

- multi-seat runs exposed silent role inversion

Fixes:

- alignment tags
- stronger seat-discipline prompt instructions
- stance cue auditing over claim summary and lead sentence
- fallback substitution when a turn undercut its assigned seat

Impact:

- the system now catches some of the worst seat failures
- tradeoff: stricter validation can increase fallback frequency on a 7B local model

## Validation Snapshots

These runs were used as live checkpoints during iteration.

### Baseline Binary Debate

Run:

- `arena_32b73fb166b943d5a36453b34d1133e0`

Observed problems:

- final report inconsistencies
- wrong winner narrative
- weak turn targeting
- report fields degrading into object-string output

### First Quality-Hardened Binary Debate

Run:

- `arena_a15498a42f2f4386ba7dacfbbc622953`

Improvement:

- better report integrity
- better targeting

New downside:

- too many degraded turns because the repetition guard was too strict for the local model

### Stable Improved Binary Debate

Run:

- `arena_af8513f6ae2d4c018b14c435142f5535`

Key outcomes:

- 22 debater turns
- 20 out of 20 targeted non-closing turns
- 0 degraded turns
- unique-claim rate about `0.95`

This is the current reference point for “good” binary behavior on the local setup.

### Three-Seat Diversity Probe

Run:

- `arena_af0fceffe35148a699349b52c081f3a4`

Key outcomes:

- high diversity
- good targeting
- no degraded turns

Main failure:

- support-seat role drift still slipped through

### Three-Seat Run With Stronger Stance Guard

Run:

- `arena_38f9a19e5fa14452ad7232e852d71e07`

Key outcomes:

- 33 debater turns
- 30 out of 30 targeted non-closing turns
- unique-claim rate about `0.97`
- unique-pressure rate about `0.85`

Tradeoff:

- 4 degraded turns
- but those degraded turns were safer than letting wrong-seat content pass silently

## What Improved The Most

The biggest upgrades were not cosmetic. They were structural.

Most improved areas:

- report consistency
- head control over round shape
- turn targeting
- late-round debate structure
- debater state compaction
- inspectability of failures

## What Still Lacks

The arena is strong enough to ship as a meaningful v1, but it still has clear quality ceilings.

### 1. Semantic Seat Fidelity Is Still The Hardest Problem

The biggest remaining weakness is not syntax.

It is this:

- a seat can still produce text that is fluent, coherent, and superficially aligned
- but strategically weak or partially inverted relative to its assigned side

This is the hardest issue because small local models can mimic argument form while losing strategic loyalty.

### 2. Pressure Threads Are Better, But Still Not Elegant

They are much cleaner than before, but still sometimes feel over-scaffolded or slightly mechanical.

Remaining weaknesses:

- repeated framing
- awkward helper phrasing
- not enough escalation variety

### 3. Scorecards Are Functional, Not Sophisticated

The scoring system currently rewards:

- clarity
- pressure
- responsiveness
- consistency

That works for v1, but it is still a lightweight heuristic.

It does not yet deeply evaluate:

- actual evidential strength
- quality of concessions
- novelty of mechanisms
- whether a rebuttal truly answered the attack

### 4. Final Reports Are Consistent, But Not Yet Rich

The final report is now much more trustworthy, but it is still stronger on coherence than depth.

Missing richness:

- sharper summary of the central fault line
- stronger explanation of why the loser lost
- better synthesis of evolving tradeoffs across rounds

### 5. Multi-Seat Long Debates Still Stress A 7B Local Model

Binary debates are now in a good place.

Three-seat and four-seat debates over 10 to 12 rounds remain the real stress test because they require:

- role isolation
- memory compaction
- strategic differentiation
- consistent targeting
- stable closing synthesis

That is a demanding workload for one low-parameter local model.

## Highest-Value Next Upgrades

If quality work continues, these are the best next investments.

### 1. Seat-Aligned Rewrite Pass

Current behavior:

- drifted turn fails validation
- system drops to fallback turn

Better next step:

- if a turn drifts, run one short rewrite pass that preserves the target and move type but restores seat alignment

This would likely reduce degraded turns without reintroducing silent drift.

### 2. Arena-Specific Evaluator Harness

Add a dedicated benchmark runner with metrics for:

- seat fidelity
- targeting accuracy
- repetition rate
- unresolved-thread quality
- report consistency

This would make future changes measurable instead of anecdotal.

### 3. Stronger Semantic Contradiction Checks

Current stance checks rely on useful but still heuristic cues.

Next step:

- compare claim summary against the seat brief and win condition more directly
- detect when a debater is conceding the main decision frame instead of just making a narrow concession

### 4. Evidence-Aware Debates

Right now the arena is mostly reasoning-driven.

Next upgrade:

- allow optional evidence cards, docs, or product facts to be injected into the run
- require turns to anchor arguments to those facts

This would improve groundedness and reduce generic debate language.

### 5. UI Exposure Of Quality Metadata

The runtime now knows a lot that the UI still hides.

Useful next additions:

- show `moveType`
- show `alignmentTag`
- show `requiredTargetId`
- show `degradedReason`
- show when the head used deterministic strategy

That would make the page more inspectable and easier to debug.

### 6. Better Per-Seat Voice Separation

A future upgrade could add lightweight voice constraints per seat:

- more specific rhetorical lane
- lexical style hints
- concession style
- preferred mechanism style

That would reduce voice flattening across seats.

## Overall Assessment

Arena v1 is now more than a UI concept.

It is a real inspectable system with:

- dedicated storage
- dedicated APIs
- sequential single-model orchestration
- long-debate state compaction
- live event playback
- quality guardrails
- deterministic fallbacks where the local model is least trustworthy

The output is meaningfully better than the early versions.

The biggest improvement is that failures are now visible, bounded, and partially recoverable rather than silently corrupting the debate.

The main remaining ceiling is semantic seat fidelity in longer 3-seat and 4-seat runs under a small local model.

That is an expected limitation of the runtime budget, not a sign that the architecture is weak.

