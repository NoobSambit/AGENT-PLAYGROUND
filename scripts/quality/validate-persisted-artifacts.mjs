import {
  collectAuditCases,
  parseArgs,
  readJson,
  summarizeArtifactSessions,
} from './shared.mjs'
import { withPgClient } from '../lib/postgres.mjs'

const FEATURE_TABLES = {
  creative: {
    table: 'creative_artifacts',
    idColumn: 'source_artifact_id',
  },
  journal: {
    table: 'journal_entries',
    idColumn: 'source_entry_id',
  },
  dream: {
    table: 'dreams',
    idColumn: 'source_dream_id',
  },
}

function summarizeSessions(sessions) {
  const records = sessions.flatMap((session) => session.analyzed)
  return {
    totalRecords: records.length,
    failedRecords: records.filter((record) => !record.structurallyValid).length,
    legacyUnvalidated: records.filter((record) => record.qualityStatus === 'legacy_unvalidated').length,
    wrapperLeakage: records.filter((record) => record.hardFailureFlags.length > 0).length,
    records,
  }
}

async function validateAuditFixture(auditPath) {
  const audit = await readJson(auditPath)
  const collected = collectAuditCases(audit)

  return {
    source: 'audit_fixture',
    auditPath,
    creative: summarizeSessions(summarizeArtifactSessions(collected.creative, 'creative')),
    journal: summarizeSessions(summarizeArtifactSessions(collected.journal, 'journal')),
    dream: summarizeSessions(summarizeArtifactSessions(collected.dream, 'dream')),
  }
}

async function validateDatabase(feature) {
  if (!FEATURE_TABLES[feature]) {
    throw new Error(`Unsupported feature "${feature}". Use creative, journal, or dream.`)
  }

  const { table } = FEATURE_TABLES[feature]

  return withPgClient(async (client) => {
    const { rows } = await client.query(`
      SELECT
        id,
        status,
        quality_status,
        normalization_status,
        quality_score,
        payload
      FROM "${table}"
      ORDER BY created_at DESC
    `)

    const normalized = rows.map((row) => {
      const payload = row.payload || {}
      const validation = payload.validation || {}
      const hardFailureFlags = [
        ...new Set([
          ...(Array.isArray(validation.hardFailureFlags) ? validation.hardFailureFlags : []),
        ]),
      ]

      return {
        id: row.id,
        status: row.status,
        qualityStatus: row.quality_status,
        normalizationStatus: row.normalization_status,
        qualityScore: row.quality_score,
        validationPass: validation.pass ?? null,
        wrapperLeakage: hardFailureFlags.length > 0,
        hardFailureFlags,
      }
    })

    return {
      source: 'postgres',
      feature,
      totalRecords: normalized.length,
      failedRecords: normalized.filter((row) => row.validationPass === false || row.qualityStatus === 'failed').length,
      legacyUnvalidated: normalized.filter((row) => row.qualityStatus === 'legacy_unvalidated').length,
      wrapperLeakage: normalized.filter((row) => row.wrapperLeakage).length,
      records: normalized,
    }
  })
}

async function main() {
  const args = parseArgs(process.argv.slice(2))

  if (args.audit) {
    console.log(JSON.stringify(await validateAuditFixture(args.audit), null, 2))
    return
  }

  const feature = args.feature || 'creative'
  console.log(JSON.stringify(await validateDatabase(feature), null, 2))
}

main().catch((error) => {
  console.error('[quality:validate]', error)
  process.exitCode = 1
})
