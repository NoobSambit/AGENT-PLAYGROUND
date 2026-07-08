# Findings And Recommendations

## Request Failures And Blockers

- 068-learning-congress-update-skill learning congress update skill: original status 500; post-run code fix verified with `158-regression-green-learning-update-skill.json` returning 200.
- 083-relationship-recompute-bjp-congress relationship recompute bjp congress: original status 500; post-run code fix verified with `159-regression-green-relationship-recompute.json` returning 200.
- 102-challenge-create-constitutional-crisis challenge create constitutional crisis: status 400; {"error":"Unsupported challenge template."} This was remediated by rerunning a supported `pair_conflict_repair` scenario in responses `139`-`141`.

## Quality Gates

- journal save bjp: 409 quality-gated/blocked (manual-test-reports/political-agents-2026-07-07/raw-responses/092-journal-save-bjp.json) - error: Journal entry is blocked from save until quality preconditions pass.
- dream save congress: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/095-dream-save-congress.json) - {"session":{"id":"dream_session_8c2d5e768fa740149754b039f1ceb08d","type":"symbolic","model":"qwen2.5:7b","status":"saved","agentId":"agent_82174162fdf449f98a08eac378963e4d","savedAt":"2026-07-07T08:09:38.229Z","provider":"ollama","createdAt":"2026-07-07T08:08:54.152Z","updatedAt":"2026-07-07T08:09:38.229Z","sourceRefs":[{"id":"persona","label":"Persona","reason":"Dream language should still feel like this specific agent.","sourceType":"persona"},{"id":"dominant-emotion","label":"Dominant emotion","reason":"Dream tone should process the live emotional weather without copying it literally.","sourceType":"emotion"},{"id":"linguistic...
- creative publish analyst: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/098-creative-publish-analyst.json) - {"session":{"id":"creative_session_fef496037bea4f0ab584df1af10bdd64","brief":{"tone":"cinematic","avoid":["dehumanizing rhetoric"],"format":"essay","intent":"Write a short constitutional field note about polarized Indian politics after a three-way debate.","length":"short","audience":"researcher reviewing agent behavior","mustInclude":["federalism","civil liberties","welfare","national security"],"referenceNotes":"Use the agent cohort debate as inspiration."},"model":"qwen2.5:7b","status":"published","agentId":"agent_f671c3fc34a940ee9059f60ffb7707f6","provider":"ollama","createdAt":"2026-07-07T08:09:38.551Z","updatedAt":"2026-07-...

## Behavioral Findings

- The three-agent cohort produced enough contrast to compare partisan consistency, constitutional mediation, and emotional-state updates across chat turns.
- Relationship testing used explicit conflict, constructive-disagreement, and agreement checkpoints, making pair dynamics inspectable in later UI review.
- Library and Collective testing covered validated context, validation history, broadcast, support, dispute, and legacy knowledge search.
- Any endpoint failure above should be inspected against its raw response file first, then the corresponding service logs.

## Recommended Follow-Ups

- Review the raw Arena detail payloads in the UI for event-by-event scoring quality.
- Inspect Timeline after Library and Collective mutations to confirm lifecycle event visibility.
- Review `16-post-run-issue-fixes.md` before treating the original failure list as current product state.
- If any model-backed call timed out, rerun that single response file's curl command with the same Qwen headers rather than repeating the whole suite.


## Challenge Lab Failure Remediation

The initial Challenge create failure was rerun with a valid template.

- Initial failure: `102-challenge-create-constitutional-crisis` returned 400 `Unsupported challenge template.`
- Rerun create: 201 ok using `pair_conflict_repair`.
- Rerun execute: 200 ok.
- Rerun detail: 200 ok.


## Library/Collective Remediation

The first harness missed nested Library item IDs, causing Collective broadcast/support/dispute to be skipped. Remediation responses `142`-`155` completed accept, endorse, broadcast, support, dispute, resolve, retire, detail, final Collective, Timeline, and context checks.
