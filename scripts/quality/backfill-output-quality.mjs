import { withPgClient } from '../lib/postgres.mjs'
import {
  deriveQualityStatus,
  detectCreativeOrJournalLeakage,
  detectDreamContractFailures,
  parseArgs,
} from './shared.mjs'

async function getTableColumns(client, table) {
  const { rows } = await client.query(
    `
      SELECT column_name
      FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = $1
    `,
    [table]
  )

  return new Set(rows.map((row) => row.column_name))
}

function artifactRoleFromRow(feature, row, payload) {
  if (payload?.artifactRole) return payload.artifactRole
  if (feature === 'creative') {
    if (row.status === 'published' || row.published) return 'published'
    if (row.status === 'final' || row.status === 'ready') return 'final'
  }
  if (feature === 'journal' || feature === 'dream') {
    if (row.status === 'saved' || row.saved) return 'final'
    if (row.status === 'repaired' || row.status === 'repair') return 'repair'
  }
  if (row.status === 'repaired' || row.status === 'revised') return 'repair'
  if (row.status === 'draft') return 'draft'
  return null
}

function analyzeRow(feature, row) {
  const payload = row.payload || {}
  const wrapperFlags = feature === 'dream'
    ? detectDreamContractFailures(payload)
    : detectCreativeOrJournalLeakage(payload)
  const validationPass = payload.validation?.pass
  const evaluationPass = payload.evaluation?.pass
  const nextQualityStatus = payload.qualityStatus || deriveQualityStatus({
    validationPass,
    evaluationPass,
    wrapperLeakage: wrapperFlags.length > 0,
  })

  return {
    id: row.id,
    qualityStatus: nextQualityStatus,
    normalizationStatus: row.normalization_status || payload.normalizationStatus || payload.normalization?.status || 'legacy_unvalidated',
    qualityScore: row.quality_score ?? payload.qualityScore ?? payload.evaluation?.overallScore ?? null,
    artifactRole: row.artifact_role || artifactRoleFromRow(feature, row, payload),
    sourceId:
      feature === 'creative'
        ? row.source_artifact_id || payload.sourceArtifactId || null
        : feature === 'journal'
          ? row.source_entry_id || payload.sourceEntryId || null
          : row.source_dream_id || payload.sourceDreamId || null,
    hardFailureFlags: wrapperFlags,
  }
}

async function backfillArtifacts(client, feature, dryRun) {
  const table = feature === 'creative' ? 'creative_artifacts' : feature === 'journal' ? 'journal_entries' : 'dreams'
  const sourceIdColumn = feature === 'creative' ? 'source_artifact_id' : feature === 'journal' ? 'source_entry_id' : 'source_dream_id'
  const statusColumns = feature === 'creative'
    ? 'published'
    : 'saved'
  const requiredColumns = [
    'id',
    'status',
    statusColumns,
    'artifact_role',
    'normalization_status',
    'quality_score',
    sourceIdColumn,
    'payload',
  ]
  const availableColumns = await getTableColumns(client, table)
  const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column))

  if (missingColumns.length > 0) {
    return {
      feature,
      table,
      skipped: true,
      reason: 'migration_required',
      missingColumns,
    }
  }

  const { rows } = await client.query(`
    SELECT
      id,
      status,
      ${statusColumns},
      artifact_role,
      normalization_status,
      quality_score,
      ${sourceIdColumn},
      payload
    FROM "${table}"
  `)

  const analyzed = rows.map((row) => analyzeRow(feature, row))

  if (!dryRun) {
    for (const row of analyzed) {
      await client.query(
        `
          UPDATE "${table}"
          SET
            artifact_role = COALESCE($2, artifact_role),
            normalization_status = COALESCE($3, normalization_status),
            quality_score = COALESCE($4, quality_score),
            ${sourceIdColumn} = COALESCE($5, ${sourceIdColumn})
          WHERE id = $1
        `,
        [row.id, row.artifactRole, row.normalizationStatus, row.qualityScore, row.sourceId]
      )
    }
  }

  return {
    feature,
    table,
    totalRows: analyzed.length,
    failedRows: analyzed.filter((row) => row.qualityStatus === 'failed').length,
    legacyRows: analyzed.filter((row) => row.normalizationStatus === 'legacy_unvalidated').length,
    wrapperLeakageRows: analyzed.filter((row) => row.hardFailureFlags.length > 0).map((row) => ({
      id: row.id,
      hardFailureFlags: row.hardFailureFlags,
    })),
  }
}

async function backfillMemories(client, dryRun) {
  const availableColumns = await getTableColumns(client, 'memories')
  const requiredColumns = ['metadata', 'canonical_key', 'canonical_value', 'confidence', 'evidence_refs', 'supersedes', 'last_confirmed_at']
  const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column))

  if (missingColumns.length > 0) {
    return {
      feature: 'memories',
      skipped: true,
      reason: 'migration_required',
      missingColumns,
    }
  }

  const { rows } = await client.query(`
    SELECT id, metadata, canonical_key, canonical_value, confidence, evidence_refs, supersedes, last_confirmed_at
    FROM "memories"
  `)

  let updated = 0
  for (const row of rows) {
    const metadata = row.metadata || {}
    const next = {
      canonicalKey: row.canonical_key || metadata.canonicalKey || null,
      canonicalValue: row.canonical_value || metadata.canonicalValue || null,
      confidence: row.confidence ?? metadata.confidence ?? null,
      evidenceRefs: Array.isArray(row.evidence_refs) && row.evidence_refs.length > 0
        ? row.evidence_refs
        : Array.isArray(metadata.evidenceRefs) ? metadata.evidenceRefs : [],
      supersedes: Array.isArray(row.supersedes) && row.supersedes.length > 0
        ? row.supersedes
        : Array.isArray(metadata.supersedes) ? metadata.supersedes : [],
      lastConfirmedAt: row.last_confirmed_at || metadata.lastConfirmedAt || null,
    }

    if (!dryRun && (next.canonicalKey || next.canonicalValue || next.confidence !== null || next.evidenceRefs.length || next.supersedes.length || next.lastConfirmedAt)) {
      await client.query(
        `
          UPDATE "memories"
          SET
            canonical_key = COALESCE($2, canonical_key),
            canonical_value = COALESCE($3, canonical_value),
            confidence = COALESCE($4, confidence),
            evidence_refs = CASE WHEN cardinality(evidence_refs) = 0 THEN $5 ELSE evidence_refs END,
            supersedes = CASE WHEN cardinality(supersedes) = 0 THEN $6 ELSE supersedes END,
            last_confirmed_at = COALESCE($7, last_confirmed_at)
          WHERE id = $1
        `,
        [row.id, next.canonicalKey, next.canonicalValue, next.confidence, next.evidenceRefs, next.supersedes, next.lastConfirmedAt]
      )
      updated += 1
    }
  }

  return {
    feature: 'memories',
    totalRows: rows.length,
    updatedRows: updated,
  }
}

async function backfillQualityRuns(client, config, dryRun) {
  const availableColumns = await getTableColumns(client, config.table)
  const requiredColumns = ['id', 'quality_status', 'repair_count', 'prompt_version', 'payload']
  const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column))

  if (missingColumns.length > 0) {
    return {
      feature: config.feature,
      table: config.table,
      skipped: true,
      reason: 'migration_required',
      missingColumns,
    }
  }

  const { rows } = await client.query(`
    SELECT id, quality_status, repair_count, prompt_version, payload
    FROM "${config.table}"
  `)

  let updated = 0
  const normalized = rows.map((row) => {
    const payload = row.payload || {}
    const qualityStatus = row.quality_status || payload.qualityStatus || deriveQualityStatus({
      validationPass: payload.validation?.pass,
      evaluationPass: payload.latestEvaluation?.pass ?? payload.evaluation?.pass,
      wrapperLeakage: false,
    })
    const repairCount = row.repair_count ?? payload.repairCount ?? 0
    const promptVersion = row.prompt_version || payload.promptVersion || null

    return {
      id: row.id,
      qualityStatus,
      repairCount,
      promptVersion,
    }
  })

  if (!dryRun) {
    for (const row of normalized) {
      await client.query(
        `
          UPDATE "${config.table}"
          SET
            quality_status = COALESCE($2, quality_status),
            repair_count = COALESCE($3, repair_count),
            prompt_version = COALESCE($4, prompt_version)
          WHERE id = $1
        `,
        [row.id, row.qualityStatus, row.repairCount, row.promptVersion]
      )
      updated += 1
    }
  }

  return {
    feature: config.feature,
    table: config.table,
    totalRows: normalized.length,
    failedRows: normalized.filter((row) => row.qualityStatus === 'failed').length,
    legacyRows: normalized.filter((row) => row.qualityStatus === 'legacy_unvalidated').length,
    updatedRows: updated,
  }
}

async function backfillQualityRunsNoRepair(client, config, dryRun) {
  const availableColumns = await getTableColumns(client, config.table)
  const requiredColumns = ['id', 'quality_status', 'quality_score', 'prompt_version', 'payload']
  const missingColumns = requiredColumns.filter((column) => !availableColumns.has(column))

  if (missingColumns.length > 0) {
    return {
      feature: config.feature,
      table: config.table,
      skipped: true,
      reason: 'migration_required',
      missingColumns,
    }
  }

  const { rows } = await client.query(`
    SELECT id, quality_status, quality_score, prompt_version, payload
    FROM "${config.table}"
  `)

  let updated = 0
  const normalized = rows.map((row) => {
    const payload = row.payload || {}
    return {
      id: row.id,
      qualityStatus: row.quality_status || payload.qualityStatus || deriveQualityStatus({
        validationPass: payload.validation?.pass,
        evaluationPass: payload.latestEvaluation?.pass ?? payload.evaluation?.pass,
        wrapperLeakage: false,
      }),
      qualityScore: row.quality_score ?? payload.qualityScore ?? payload.latestEvaluation?.overallScore ?? payload.evaluation?.overallScore ?? null,
      promptVersion: row.prompt_version || payload.promptVersion || null,
    }
  })

  if (!dryRun) {
    for (const row of normalized) {
      await client.query(
        `
          UPDATE "${config.table}"
          SET
            quality_status = COALESCE($2, quality_status),
            quality_score = COALESCE($3, quality_score),
            prompt_version = COALESCE($4, prompt_version)
          WHERE id = $1
        `,
        [row.id, row.qualityStatus, row.qualityScore, row.promptVersion]
      )
      updated += 1
    }
  }

  return {
    feature: config.feature,
    table: config.table,
    totalRows: normalized.length,
    failedRows: normalized.filter((row) => row.qualityStatus === 'failed').length,
    legacyRows: normalized.filter((row) => row.qualityStatus === 'legacy_unvalidated').length,
    updatedRows: updated,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const dryRun = !args.write

  const result = await withPgClient(async (client) => {
    const creative = await backfillArtifacts(client, 'creative', dryRun)
    const journal = await backfillArtifacts(client, 'journal', dryRun)
    const dream = await backfillArtifacts(client, 'dream', dryRun)
    const creativeSessions = await backfillQualityRuns(client, { feature: 'creative_sessions', table: 'creative_sessions' }, dryRun)
    const journalSessions = await backfillQualityRuns(client, { feature: 'journal_sessions', table: 'journal_sessions' }, dryRun)
    const dreamSessions = await backfillQualityRuns(client, { feature: 'dream_sessions', table: 'dream_sessions' }, dryRun)
    const profileRuns = await backfillQualityRunsNoRepair(client, { feature: 'profile_analysis_runs', table: 'profile_analysis_runs' }, dryRun)
    const scenarioRuns = await backfillQualityRunsNoRepair(client, { feature: 'scenario_runs', table: 'scenario_runs' }, dryRun)
    const memories = await backfillMemories(client, dryRun)

    return {
      script: 'backfill-output-quality',
      executedAt: new Date().toISOString(),
      dryRun,
      creative,
      journal,
      dream,
      creativeSessions,
      journalSessions,
      dreamSessions,
      profileRuns,
      scenarioRuns,
      memories,
    }
  })

  console.log(JSON.stringify(result, null, 2))
}

main().catch((error) => {
  console.error('[quality:backfill]', error)
  process.exitCode = 1
})
