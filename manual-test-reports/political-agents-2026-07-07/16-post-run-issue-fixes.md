# Post-Run Issue Fixes

## Scope

This addendum records fixes applied after the full political-agent manual test. It preserves the original failing responses as historical evidence and adds post-fix regression responses.

## Fixed Issue 1: Learning `update_skill` Empty Input

- Original command: `068-learning-congress-update-skill`
- Original response file: `raw-responses/068-learning-congress-update-skill.json`
- Original status: 500
- Original body: `{"error":"Failed to update skill"}`
- Root cause: `LearningService.updateSkill` returned `null` when the caller supplied a category with no recent patterns and no matching learning observation. The API route interpreted the null skill as a failed update.
- Code fix: `src/lib/services/learningService.ts` now creates and persists a baseline skill progression when the caller explicitly requests a category and no skill exists yet.
- Red check: `raw-responses/156-regression-red-learning-update-skill.json`, status 500 before patch.
- Green check: `raw-responses/158-regression-green-learning-update-skill.json`, status 200 after patch.
- Verified output: response includes `success: true`, category `communication_style`, skill name `Communication Style`, level 1, and remaining rate-limit budget.

## Fixed Issue 2: Relationship `recompute_pair` Pair ID Compatibility

- Original command: `083-relationship-recompute-bjp-congress`
- Original response file: `raw-responses/083-relationship-recompute-bjp-congress.json`
- Original status: 500
- Original body: `{"error":"Relationship pair not found"}`
- Root cause: the manual harness passed a pair token as `agentA::agentB`, while the repository stores canonical relationship IDs as `rel_agentA_agentB`. Recompute only looked up the exact provided string.
- Code fix: `src/lib/services/relationshipOrchestrator.ts` now accepts the `agentA::agentB` compatibility form, converts it to the canonical relationship ID, and reads evidence from the resolved stored relationship.
- Red check: `raw-responses/157-regression-red-relationship-recompute.json`, status 500 before patch.
- Green check: `raw-responses/159-regression-green-relationship-recompute.json`, status 200 after patch.
- Verified output: response includes `success: true`, result pair ID `rel_agent_82174162fdf449f98a08eac378963e4d_agent_f8795d3136f3454398e1aeebcc665969`, strained relationship status, updated metrics, and high-tension alert evidence.

## Not Code-Fixed: Expected Gates And Validation

- `092-journal-save-bjp.json` remains a valid quality-gate block. The save endpoint returned 409 because the generated journal entry failed quality preconditions. This protects the draft/save boundary and is not treated as a product bug in this pass.
- `102-challenge-create-constitutional-crisis.json` remains a valid validation failure for an unsupported template. The Challenge Lab coverage was remediated with a supported `pair_conflict_repair` scenario in responses `139`-`141`.

## Verification

- `curl` red checks before patch:
  - `156-regression-red-learning-update-skill.json`: 500
  - `157-regression-red-relationship-recompute.json`: 500
- `curl` green checks after patch:
  - `158-regression-green-learning-update-skill.json`: 200
  - `159-regression-green-relationship-recompute.json`: 200
- `npm run lint`: passed with two existing warnings outside the fix area:
  - `src/components/relationships/RelationshipActions.tsx`: unused `agentId`
  - `src/lib/langchain/agentChain.ts`: unused `_agent`
- `npm run build`: passed.

## Current Failure State

The two genuine endpoint failures from the manual run are fixed and verified. Remaining non-200 responses in the packet are expected validation or quality-gate behavior unless a future product decision changes those contracts.
