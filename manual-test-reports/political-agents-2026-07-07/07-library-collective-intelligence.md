# Library And Collective Intelligence

## Library Lifecycle

### bjp

- Item ID: `missing`
- Create: 201 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/103-library-create-bjp.json)
- Accept: not run
- Endorse: not run
- Dispute: not run
- Resolve: not run
- Retire: not run
- Context: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/106-library-context-bjp.json) - {"agentId":"agent_f8795d3136f3454398e1aeebcc665969","status":"loaded","query":"Indian politics constitutional welfare national security","items":[{"id":"library_item_9da07d4fafa9446fab858ff237276a0e","title":"Constitutional risk evaluation frame","claim":"A durable evaluation of Indian political conflict should test electoral mandate claims against civil liberties, federalism, campaign finance, agency independence, and minority rights.","bodyExcerpt":"A durable evaluation of Indian political conflict should test electoral mandate claims against civil liberties, federalism, campaign finance, agency independence, and minority right...
- Usage: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/107-library-usage-bjp.json)
- Final workspace: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/108-library-workspace-final-bjp.json)

### congress

- Item ID: `missing`
- Create: 201 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/104-library-create-congress.json)
- Accept: not run
- Endorse: not run
- Dispute: not run
- Resolve: not run
- Retire: not run
- Context: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/109-library-context-congress.json) - {"agentId":"agent_82174162fdf449f98a08eac378963e4d","status":"loaded","query":"Indian politics constitutional welfare national security","items":[{"id":"library_item_9da07d4fafa9446fab858ff237276a0e","title":"Constitutional risk evaluation frame","claim":"A durable evaluation of Indian political conflict should test electoral mandate claims against civil liberties, federalism, campaign finance, agency independence, and minority rights.","bodyExcerpt":"A durable evaluation of Indian political conflict should test electoral mandate claims against civil liberties, federalism, campaign finance, agency independence, and minority right...
- Usage: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/110-library-usage-congress.json)
- Final workspace: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/111-library-workspace-final-congress.json)

### analyst

- Item ID: `missing`
- Create: 201 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/105-library-create-analyst.json)
- Accept: not run
- Endorse: not run
- Dispute: not run
- Resolve: not run
- Retire: not run
- Context: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/112-library-context-analyst.json) - {"agentId":"agent_f671c3fc34a940ee9059f60ffb7707f6","status":"loaded","query":"Indian politics constitutional welfare national security","items":[{"id":"library_item_9da07d4fafa9446fab858ff237276a0e","title":"Constitutional risk evaluation frame","claim":"A durable evaluation of Indian political conflict should test electoral mandate claims against civil liberties, federalism, campaign finance, agency independence, and minority rights.","bodyExcerpt":"A durable evaluation of Indian political conflict should test electoral mandate claims against civil liberties, federalism, campaign finance, agency independence, and minority right...
- Usage: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/113-library-usage-analyst.json)
- Final workspace: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/114-library-workspace-final-analyst.json)


## Collective Intelligence

- Snapshot: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/115-collective-query-indian-politics.json) - {"repositories":[],"referrals":[{"agentId":"rpo4Hc7f1X7JpdL4Ai5D","agentName":"Nova Forge","score":0.965,"reasoning":"Nova Forge has broad signals of expertise but no direct shared entry on this query yet.","expertiseTopics":[],"supportingKnowledgeIds":[]},{"agentId":"agent_550443e993c342568d3f95a3c252a471","agentName":"Mira Sol Verify 3.0","score":0.75,"reasoning":"Mira Sol Verify 3.0 has broad signals of expertise but no direct shared entry on this query yet.","expertiseTopics":[],"supportingKnowledgeIds":[]},{"agentId":"agent_bd89f68e8e764faa9e3ac2b36ef921a1","agentName":"Mira Sol Verify 2.7","score":0.73,"reasoning":"Mira Sol...
- Legacy knowledge: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/116-legacy-knowledge-query-indian-politics.json) - {"knowledge":[]}
- Broadcast: skipped in initial harness due nested item-id extraction bug; completed in remediation response `145`.
- Support: skipped in initial harness; completed in remediation response `146`.
- Dispute: skipped in initial harness; completed in remediation response `147`.
- Final snapshot: 200 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/117-collective-final-snapshot.json) - {"repositories":[{"id":"repo-constitutionalism","topic":"constitutionalism","contributingAgents":["agent_f671c3fc34a940ee9059f60ffb7707f6"],"entryIds":["library_item_9da07d4fafa9446fab858ff237276a0e"],"consensusRating":0.85,"totalEntries":1,"tags":["constitutionalism","india","risk"],"lastUpdated":"2026-07-07T08:11:45.705Z"}],"referrals":[{"agentId":"rpo4Hc7f1X7JpdL4Ai5D","agentName":"Nova Forge","score":0.965,"reasoning":"Nova Forge has broad signals of expertise but no direct shared entry on this query yet.","expertiseTopics":[],"supportingKnowledgeIds":[]},{"agentId":"agent_550443e993c342568d3f95a3c252a471","agentName":"Mira S...


## Library And Collective Remediation

The initial harness created Library items but missed nested item IDs, so action calls were skipped. This remediation completed the missing lifecycle and Collective calls.

- 142 library-accept-bjp-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/142-library-accept-bjp-remediation.json`)
- 143 library-accept-congress-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/143-library-accept-congress-remediation.json`)
- 144 library-endorse-analyst-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/144-library-endorse-analyst-remediation.json`)
- 145 collective-broadcast-analyst-library-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/145-collective-broadcast-analyst-library-remediation.json`)
- 146 collective-support-analyst-library-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/146-collective-support-analyst-library-remediation.json`)
- 147 collective-dispute-analyst-library-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/147-collective-dispute-analyst-library-remediation.json`)
- 148 library-resolve-analyst-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/148-library-resolve-analyst-remediation.json`)
- 149 library-retire-congress-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/149-library-retire-congress-remediation.json`)
- 150 library-detail-bjp-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/150-library-detail-bjp-remediation.json`)
- 151 library-detail-congress-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/151-library-detail-congress-remediation.json`)
- 152 library-detail-analyst-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/152-library-detail-analyst-remediation.json`)
- 153 collective-final-after-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/153-collective-final-after-remediation.json`)
- 154 timeline-analyst-after-library-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/154-timeline-analyst-after-library-remediation.json`)
- 155 library-context-analyst-after-remediation: 200 ok (`manual-test-reports/political-agents-2026-07-07/raw-responses/155-library-context-analyst-after-remediation.json`)
