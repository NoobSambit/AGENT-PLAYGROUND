# Political Agents Manual Test - 2026-07-07

## Executive Summary

Manual curl-driven test run against local AGENT-PLAYGROUND using Ollama model `qwen2.5:7b`. The run created three Indian-politics-themed agents, exercised chat, emotion, memory, learning, relationships, Arena, generative workspaces, Challenge Lab, Knowledge Library, Collective Intelligence, and legacy knowledge search.

Unsafe/adversarial political boundary cases were tested as category prompts. The report describes behavior and classification without preserving explicit targeted hate or incitement text.

## Environment

- Base URL: `http://127.0.0.1:3000`
- Model headers: `x-llm-provider: ollama`, `x-llm-model: qwen2.5:7b`
- Started at: 2026-07-07T07:48:50.387Z
- Git status before run:

```text
(clean)
```

- Ollama list:

```text
NAME          ID              SIZE      MODIFIED     
qwen2.5:7b    845dbda0ea48    4.7 GB    3 months ago
```

## Agent IDs

| Key | Name | ID | Creation |
| --- | --- | --- | --- |
| bjp | POLTEST-20260707-Bharat Strategist | agent_f8795d3136f3454398e1aeebcc665969 | 201 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/002-create-agent-bjp.json) |
| congress | POLTEST-20260707-Janata Socialist | agent_82174162fdf449f98a08eac378963e4d | 201 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/003-create-agent-congress.json) |
| analyst | POLTEST-20260707-Samvidhan Analyst | agent_f671c3fc34a940ee9059f60ffb7707f6 | 201 ok (manual-test-reports/political-agents-2026-07-07/raw-responses/004-create-agent-analyst.json) |

## Coverage

- Agents created: 3
- Chat turns attempted: 15
- Relationship checkpoints attempted: 3
- Arena debate attempts: 2
- Generative feature groups: 4
- Library item groups: 3
- Failures recorded: 3
- Post-run code fixes verified: 2

## Failure Summary

- 068-learning-congress-update-skill learning congress update skill: original status 500; fixed and verified post-run with response `158-regression-green-learning-update-skill.json`.
- 083-relationship-recompute-bjp-congress relationship recompute bjp congress: original status 500; fixed and verified post-run with response `159-regression-green-relationship-recompute.json`.
- 102-challenge-create-constitutional-crisis challenge constitutional-crisis create: status 400; {"error":"Unsupported challenge template."} This was remediated with a valid `pair_conflict_repair` rerun: create 201, execute 200, detail 200. See `06-generative-features.md` and raw responses `139`-`141`.
- Journal save response `092` remains an expected quality-gate blocker, not a code failure.

## Research Navigation

- [10-complete-output-catalog.md](10-complete-output-catalog.md): complete raw-response map.
- [11-endpoint-coverage-matrix.md](11-endpoint-coverage-matrix.md): route-by-route coverage.
- [12-full-transcripts-and-events.md](12-full-transcripts-and-events.md): extracted chat, Arena, and Challenge outputs.
- [13-agent-behavior-dossiers.md](13-agent-behavior-dossiers.md): per-agent behavioral analysis.
- [14-research-packet-guide.md](14-research-packet-guide.md): how to use the packet later.
- [15-library-lifecycle-and-collective-dossier.md](15-library-lifecycle-and-collective-dossier.md): completed Library governance and Collective remediation evidence.
- [16-post-run-issue-fixes.md](16-post-run-issue-fixes.md): code fixes, regression curls, and verification evidence for the two endpoint failures.
