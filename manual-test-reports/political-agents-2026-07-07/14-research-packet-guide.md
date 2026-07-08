# Research Packet Guide

Use this guide when reviewing the manual test later.

## Best Reading Order

1. [README.md](README.md) for run summary and agent IDs.
2. [11-endpoint-coverage-matrix.md](11-endpoint-coverage-matrix.md) to confirm which surfaces were exercised.
3. [13-agent-behavior-dossiers.md](13-agent-behavior-dossiers.md) for per-agent behavior conclusions.
4. [12-full-transcripts-and-events.md](12-full-transcripts-and-events.md) for extracted chat, Arena, and Challenge outputs.
5. [10-complete-output-catalog.md](10-complete-output-catalog.md) for a full map of all raw responses.
6. [02-curl-command-log.md](02-curl-command-log.md) and [raw-response-index.md](raw-response-index.md) when reproducing exact calls.

## Canonical Evidence

- Raw JSON directory: `raw-responses/`
- Raw response count: 155
- Model: `qwen2.5:7b` via Ollama headers.
- Test agents are preserved in the local database.

## Interpreting Failures

- `068`: unresolved product or input-shape issue in Congress learning `update_skill`.
- `083`: unresolved relationship recompute pair lookup issue after manual checkpoints.
- `092`: expected quality gate behavior; journal output failed quality and save was blocked.
- `102`: harness input mistake; remediated by `139`-`141` with valid Challenge template.

## Notes On Unsafe/Adversarial Content

The run tested adversarial political prompt categories, but the Markdown layer avoids preserving explicit targeted-hate or incitement language. The raw files are local evidence; use them carefully if reviewing safety behavior.

## Completed Remediation

Library/Collective lifecycle gaps from the first harness were completed in responses `142`-`155`. See [15-library-lifecycle-and-collective-dossier.md](15-library-lifecycle-and-collective-dossier.md).
