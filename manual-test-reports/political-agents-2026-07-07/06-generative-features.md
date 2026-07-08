# Generative Features

## Journal

- Create: 201 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/090-journal-create-bjp.json)
- Generate: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/091-journal-generate-bjp.json) - {"session":{"id":"journal_session_3c66e629673740238c229b464b53adb5","type":"relationship_checkpoint","model":"qwen2.5:7b","status":"failed","agentId":"agent_f8795d3136f3454398e1aeebcc665969","provider":"ollama","createdAt":"2026-07-07T08:08:19.997Z","updatedAt":"2026-07-07T08:08:53.349Z","sourceRefs":[{"id":"persona","label":"Persona","reason":"Keeps the journal anchored to stable identity.","sourceType":"persona"},{"id":"emotion","label":"Live emotional state","reason":"The journal should feel current, not generic.","sourceType":"emotion"},{"id":"user-note","label":"User note","reason":"Explicit compose intent must steer the dra...
- Save: 409 quality-gated/blocked (manual-test-reports/political-agents-2026-07-07/raw-responses/092-journal-save-bjp.json) - error: Journal entry is blocked from save until quality preconditions pass.

## Dream

- Create: 201 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/093-dream-create-congress.json)
- Generate: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/094-dream-generate-congress.json) - {"session":{"id":"dream_session_8c2d5e768fa740149754b039f1ceb08d","type":"symbolic","model":"qwen2.5:7b","status":"ready","agentId":"agent_82174162fdf449f98a08eac378963e4d","provider":"ollama","createdAt":"2026-07-07T08:08:54.152Z","updatedAt":"2026-07-07T08:09:37.930Z","sourceRefs":[{"id":"persona","label":"Persona","reason":"Dream language should still feel like this specific agent.","sourceType":"persona"},{"id":"dominant-emotion","label":"Dominant emotion","reason":"Dream tone should process the live emotional weather without copying it literally.","sourceType":"emotion"},{"id":"linguistic-profile","label":"Linguistic profile...
- Save: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/095-dream-save-congress.json) - {"session":{"id":"dream_session_8c2d5e768fa740149754b039f1ceb08d","type":"symbolic","model":"qwen2.5:7b","status":"saved","agentId":"agent_82174162fdf449f98a08eac378963e4d","savedAt":"2026-07-07T08:09:38.229Z","provider":"ollama","createdAt":"2026-07-07T08:08:54.152Z","updatedAt":"2026-07-07T08:09:38.229Z","sourceRefs":[{"id":"persona","label":"Persona","reason":"Dream language should still feel like this specific agent.","sourceType":"persona"},{"id":"dominant-emotion","label":"Dominant emotion","reason":"Dream tone should process the live emotional weather without copying it literally.","sourceType":"emotion"},{"id":"linguistic...

## Creative

- Create: 201 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/096-creative-create-analyst.json)
- Generate: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/097-creative-generate-analyst.json) - {"session":{"id":"creative_session_fef496037bea4f0ab584df1af10bdd64","brief":{"tone":"cinematic","avoid":["dehumanizing rhetoric"],"format":"essay","intent":"Write a short constitutional field note about polarized Indian politics after a three-way debate.","length":"short","audience":"researcher reviewing agent behavior","mustInclude":["federalism","civil liberties","welfare","national security"],"referenceNotes":"Use the agent cohort debate as inspiration."},"model":"qwen2.5:7b","status":"ready","agentId":"agent_f671c3fc34a940ee9059f60ffb7707f6","provider":"ollama","createdAt":"2026-07-07T08:09:38.551Z","updatedAt":"2026-07-07T0...
- Publish: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/098-creative-publish-analyst.json) - {"session":{"id":"creative_session_fef496037bea4f0ab584df1af10bdd64","brief":{"tone":"cinematic","avoid":["dehumanizing rhetoric"],"format":"essay","intent":"Write a short constitutional field note about polarized Indian politics after a three-way debate.","length":"short","audience":"researcher reviewing agent behavior","mustInclude":["federalism","civil liberties","welfare","national security"],"referenceNotes":"Use the agent cohort debate as inspiration."},"model":"qwen2.5:7b","status":"published","agentId":"agent_f671c3fc34a940ee9059f60ffb7707f6","provider":"ollama","createdAt":"2026-07-07T08:09:38.551Z","updatedAt":"2026-07-...

## Profile

- Create: 201 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/099-profile-run-create-analyst.json)
- Execute: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/100-profile-run-execute-analyst.json) - {"run":{"id":"profile_run_4bc3cb69acac4c26b95686f72962fefe","model":"qwen2.5:7b","status":"ready","agentId":"agent_f671c3fc34a940ee9059f60ffb7707f6","payload":{"libraryCandidateIds":["library_item_810fecacbc9b45f18901cb9f09c5048e"],"libraryContextItems":[{"id":"library_item_db60be3afaaf49018887df037db8a722","claim":"Phase 4B Collective p4b_final_mr4ngj7c claim","title":"Phase 4B Collective p4b_final_mr4ngj7c","source":{"sourceId":"manual_p4b_final_mr4ngj7c","sourceType":"manual","sourceTitle":"Manual note by Mira Sol Verify 3.0","evidenceSummary":"Manually entered by the operator from the Library workspace.","sourceTimestamp":"20...

## Challenge Lab

- Bootstrap: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/101-challenge-bootstrap-analyst.json)
- Create: 400 failed (manual-test-reports/political-agents-2026-07-07/raw-responses/102-challenge-create-constitutional-crisis.json)
- Execute: not run for the initial invalid-template request; see rerun below.


## Challenge Lab Rerun Remediation

The first Challenge create request failed because it omitted a required supported `templateId`. Bootstrap inspection showed supported templates, so the Challenge test was rerun with `pair_conflict_repair`, using Analyst + BJP as the valid two-participant pair and preserving the constitutional-crisis scenario.

- Create rerun: 201 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/139-challenge-rerun-create-pair-conflict-repair.json`)
- Run ID: `challenge_run_64fa8e2f1f19480184ac7c1ebbd7b734`
- Execute rerun: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/140-challenge-rerun-execute-pair-conflict-repair.json`)
- Detail rerun: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/141-challenge-rerun-detail-pair-conflict-repair.json`)

```bash
curl '-sS' '-X' 'POST' 'http://127.0.0.1:3000/api/agents/agent_f671c3fc34a940ee9059f60ffb7707f6/challenges/runs' '-H' 'Accept: application/json' '-H' 'Content-Type: application/json' '--data' '{"templateId":"pair_conflict_repair","participantIds":["agent_f671c3fc34a940ee9059f60ffb7707f6","agent_f8795d3136f3454398e1aeebcc665969"],"scenario":"A state government accuses the Union government of using investigative agencies and funding pressure to weaken opposition politics. The Analyst and BJP strategist must surface the constitutional disagreement, repair toward a usable democratic operating standard, and avoid dehumanizing political communities.","executionBudget":"fast"}' '-w' '
HTTP_STATUS:%{http_code}
'
curl '-sS' '-X' 'POST' 'http://127.0.0.1:3000/api/agents/agent_f671c3fc34a940ee9059f60ffb7707f6/challenges/runs/challenge_run_64fa8e2f1f19480184ac7c1ebbd7b734/execute' '-H' 'Accept: application/json' '-H' 'Content-Type: application/json' '--data' '{}' '-H' 'x-llm-provider: ollama' '-H' 'x-llm-model: qwen2.5:7b' '-w' '
HTTP_STATUS:%{http_code}
'
curl '-sS' '-X' 'GET' 'http://127.0.0.1:3000/api/agents/agent_f671c3fc34a940ee9059f60ffb7707f6/challenges/runs/challenge_run_64fa8e2f1f19480184ac7c1ebbd7b734' '-H' 'Accept: application/json' '-w' '
HTTP_STATUS:%{http_code}
'
```
