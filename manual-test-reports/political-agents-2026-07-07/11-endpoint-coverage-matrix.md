# Endpoint Coverage Matrix

| Area | Routes Exercised | Evidence Files | Result |
| --- | --- | --- | --- |
| Agent setup | `POST /api/agents; GET /api/agents` | `001`, `002`, `003`, `004` | created three political agents and confirmed list/read behavior |
| Chat + emotion | `POST /api/agents/[id]/chat` | `026-040` | 15 model-backed turns with emotionSummary, changedDomains, memoryUsed, provider/model metadata |
| Memory + graph + neural | `GET memories; POST recall; GET/POST memory-graph; GET neural-activity` | `041-055`, `122`, `129`, `136` | post-chat memory, recall, graph relevance, and neural snapshots captured |
| Learning | `GET/POST /api/agents/[id]/learning` | `056-076` | quality filter, analyze_conversation, generate_goals, create_adaptation, update_skill |
| Relationships | `GET/POST /api/relationships` | `077-083`, `120`, `127`, `134` | manual checkpoints, fetches, recompute attempt, final snapshots |
| Arena | `POST/GET /api/arena/runs; POST execute` | `084-089` | two full debate attempts completed with event details and winners |
| Journal | `POST journal create/generate/save` | `090-092` | journal created/generated; save blocked by quality gate |
| Dream | `POST dream create/generate/save` | `093-095` | dream created, generated, and saved |
| Creative | `POST creative create/generate/publish` | `096-098` | creative essay created, generated, and published |
| Profile | `POST profile runs/create/execute` | `099-100` | profile run executed and created Library candidate metadata |
| Challenge Lab | `GET bootstrap; POST create/execute/detail` | `101-102`, `139-141` | initial bad-template failure plus successful pair_conflict_repair rerun |
| Knowledge Library | `POST items/actions/context/usage; GET workspace/detail` | `103-114`, `124`, `131`, `138`, `142-144`, `148-152`, `155` | manual item creation, accept, endorse, resolve, retire, context retrieval, usage recording, final detail/workspace snapshots |
| Collective + legacy knowledge | `GET collective; POST broadcast/validate; GET knowledge` | `115-117`, `145-147`, `153` | collective query, broadcast, support, dispute, final snapshot, and legacy knowledge search |
| Timeline after Library | `GET /api/agents/[id]/timeline` | `154` | timeline rechecked after Library/Collective lifecycle remediation |
| Final state | `GET agent/learning/relationships/timeline/neural/memories/library` | `118-138` | final state snapshots for each test agent |

## Unresolved or Notable Outcomes

- Congress learning `update_skill` returned 500 in raw response `068`. Other learning actions for that agent completed.
- BJP/Congress relationship recompute returned 500 `Relationship pair not found` in raw response `083`, despite manual checkpoints and relationship fetches existing. This suggests a pair-id or persistence shape mismatch worth debugging.
- Initial Challenge Lab create omitted `templateId` and returned 400 in `102`; rerun `139`-`141` used valid `pair_conflict_repair` and passed.
- Journal generation ended with session status `failed`; save returned 409 quality blockers in `092`.
- Library and Collective actions skipped by the first harness were completed in remediation responses `142`-`155`.
