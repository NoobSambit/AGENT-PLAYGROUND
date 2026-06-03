import { hasFlag, normalizeIso } from './lib/migration-shared.mjs'
import { withPgClient } from './lib/postgres.mjs'

const args = process.argv.slice(2)
const apply = hasFlag(args, '--apply')

const CATEGORY_MAP = {
  fact: 'fact',
  opinion: 'fact',
  theory: 'fact',
  experience: 'lesson',
  skill: 'skill',
  wisdom: 'lesson',
}

function asString(value, fallback = '') {
  return typeof value === 'string' && value.trim() ? value.trim() : fallback
}

function asStringArray(value) {
  return Array.isArray(value)
    ? [...new Set(value.filter((entry) => typeof entry === 'string').map((entry) => entry.trim()).filter(Boolean))]
    : []
}

function asNumber(value, fallback) {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

function clampConfidence(value) {
  return Math.max(0, Math.min(1, value))
}

function legacyCategoryToLibraryCategory(value) {
  return CATEGORY_MAP[value] || 'fact'
}

function buildLibraryId(sharedKnowledgeId) {
  return `legacy_shared_${sharedKnowledgeId}`
}

function buildItem(row, knownAgentIds) {
  const payload = row.payload || {}
  const sharedKnowledgeId = row.id
  const itemId = buildLibraryId(sharedKnowledgeId)
  const contributorId = asString(payload.contributorId, asString(row.contributor_id))
  const contributorName = asString(payload.contributorName)
  const createdAt = normalizeIso(payload.createdAt || row.created_at)
  const updatedAt = normalizeIso(payload.updatedAt || row.updated_at, createdAt)
  const disputes = Array.isArray(payload.disputes) ? payload.disputes : []
  const usedByAgents = asStringArray(payload.usedByAgents)
  const endorsements = asStringArray(payload.endorsements)
  const knownContributorId = contributorId && knownAgentIds.has(contributorId) ? contributorId : null
  const relatedAgentIds = asStringArray([
    contributorId,
    ...usedByAgents,
    ...endorsements,
    ...disputes.map((dispute) => dispute?.agentId),
  ])

  return {
    id: itemId,
    agent_id: null,
    scope: 'network',
    title: asString(payload.topic, asString(row.topic, 'Legacy shared knowledge')),
    claim: asString(payload.topic, asString(row.topic, 'Legacy shared knowledge')),
    body: asString(payload.content, 'Legacy shared knowledge entry without body content.'),
    category: legacyCategoryToLibraryCategory(asString(payload.category, asString(row.category, 'fact'))),
    status: disputes.length > 0 ? 'disputed' : 'validated',
    confidence: clampConfidence(asNumber(payload.confidence, asNumber(row.confidence, 0.5))),
    quality_status: 'legacy_unvalidated',
    visibility: 'network',
    created_by_agent_id: knownContributorId,
    created_by_name: contributorName || null,
    created_from_feature: 'collective',
    primary_source_type: 'collective',
    primary_source_id: sharedKnowledgeId,
    tags: asStringArray(payload.tags || row.tags),
    related_agent_ids: relatedAgentIds,
    usage_count: asNumber(payload.accessCount, 0),
    last_used_at: payload.lastAccessedAt ? normalizeIso(payload.lastAccessedAt) : null,
    accepted_at: disputes.length > 0 ? null : updatedAt,
    accepted_by: disputes.length > 0 ? null : contributorName || contributorId || 'legacy shared_knowledge',
    rejected_at: null,
    rejected_by: null,
    retired_at: null,
    retired_by: null,
    supersedes_item_id: null,
    merged_into_item_id: null,
    created_at: createdAt,
    updated_at: updatedAt,
    payload: {
      extraction: {
        extractor: 'deterministic',
        promptVersion: 'legacy-shared-knowledge-backfill-v1',
        rawCandidate: payload,
      },
      validation: {
        errors: [],
        warnings: ['Backfilled from legacy shared_knowledge; not revalidated during Phase 1.'],
        checkedAt: updatedAt,
      },
      contextPolicy: {
        allowPromptUse: disputes.length === 0,
        maxPromptChars: 1200,
      },
      sourceSpecific: {
        legacySharedKnowledgeId: sharedKnowledgeId,
        legacyCategory: asString(payload.category, asString(row.category, 'fact')),
        endorsements,
        disputes,
      },
    },
  }
}

function buildSource(row, item) {
  const payload = row.payload || {}
  return {
    id: `${item.id}:source:shared_knowledge`,
    item_id: item.id,
    source_type: 'collective',
    source_id: row.id,
    source_title: asString(payload.topic, asString(row.topic, 'Legacy shared knowledge')),
    source_url: null,
    source_timestamp: item.created_at,
    evidence_summary: 'Copied from the legacy shared_knowledge table during Knowledge Library Phase 1 hardening.',
    quote: asString(payload.content) || null,
    created_at: item.created_at,
    payload: {
      legacySharedKnowledgeId: row.id,
    },
  }
}

function buildValidations(row, item, knownAgentIds) {
  const payload = row.payload || {}
  const validations = []
  const endorsements = asStringArray(payload.endorsements)
  const disputes = Array.isArray(payload.disputes) ? payload.disputes : []

  if (item.status === 'validated') {
    validations.push({
      id: `${item.id}:validation:legacy_accept`,
      item_id: item.id,
      actor_type: 'system',
      agent_id: item.created_by_agent_id,
      actor_name: item.created_by_name || 'Legacy shared_knowledge backfill',
      verdict: 'accept',
      rationale: 'Legacy shared knowledge was already published before the Library rebuild.',
      confidence_delta: 0,
      created_at: item.accepted_at || item.updated_at,
      payload: {
        legacySharedKnowledgeId: row.id,
      },
    })
  }

  for (const agentId of endorsements) {
    validations.push({
      id: `${item.id}:validation:endorse:${agentId}`,
      item_id: item.id,
      actor_type: knownAgentIds.has(agentId) ? 'agent' : 'system',
      agent_id: knownAgentIds.has(agentId) ? agentId : null,
      actor_name: null,
      verdict: 'endorse',
      rationale: 'Copied from legacy shared_knowledge endorsements.',
      confidence_delta: 0,
      created_at: item.updated_at,
      payload: {
        legacySharedKnowledgeId: row.id,
        legacyAgentId: agentId,
      },
    })
  }

  for (const dispute of disputes) {
    const agentId = asString(dispute?.agentId)
    const timestamp = normalizeIso(dispute?.timestamp, item.updated_at)
    validations.push({
      id: `${item.id}:validation:dispute:${agentId || timestamp}`,
      item_id: item.id,
      actor_type: agentId && knownAgentIds.has(agentId) ? 'agent' : 'system',
      agent_id: agentId && knownAgentIds.has(agentId) ? agentId : null,
      actor_name: null,
      verdict: 'dispute',
      rationale: asString(dispute?.reason, 'Copied from legacy shared_knowledge disputes.'),
      confidence_delta: 0,
      created_at: timestamp,
      payload: {
        legacySharedKnowledgeId: row.id,
        legacyAgentId: agentId || undefined,
      },
    })
  }

  return validations
}

async function insertIfMissing(client, tableName, row) {
  const entries = Object.entries(row).filter(([, value]) => value !== undefined)
  const columns = entries.map(([column]) => `"${column}"`)
  const placeholders = entries.map((_, index) => `$${index + 1}`)
  const values = entries.map(([, value]) => value)

  await client.query(
    `
      INSERT INTO "${tableName}" (${columns.join(', ')})
      VALUES (${placeholders.join(', ')})
      ON CONFLICT ("id") DO NOTHING
    `,
    values
  )
}

async function main() {
  await withPgClient(async (client) => {
    const [{ rows: knowledgeRows }, { rows: agentRows }] = await Promise.all([
      client.query(`
        SELECT id, topic, category, contributor_id, confidence, tags, created_at, updated_at, payload
        FROM shared_knowledge
        ORDER BY created_at, id
      `),
      client.query('SELECT id FROM agents'),
    ])
    const knownAgentIds = new Set(agentRows.map((row) => row.id))
    const items = knowledgeRows.map((row) => buildItem(row, knownAgentIds))
    const sources = knowledgeRows.map((row, index) => buildSource(row, items[index]))
    const validations = knowledgeRows.flatMap((row, index) => buildValidations(row, items[index], knownAgentIds))
    const { rows: existingRows } = await client.query(
      'SELECT COUNT(*)::int AS count FROM library_items WHERE primary_source_type = $1 AND created_from_feature = $2',
      ['collective', 'collective']
    )

    const summary = {
      mode: apply ? 'apply' : 'dry-run',
      sharedKnowledgeRows: knowledgeRows.length,
      plannedLibraryItems: items.length,
      plannedSources: sources.length,
      plannedValidations: validations.length,
      existingCollectiveLibraryItems: existingRows[0]?.count || 0,
    }

    console.log(JSON.stringify(summary, null, 2))

    if (!apply) {
      console.log('[backfill-shared-knowledge-library] Dry run only. Re-run with --apply to write rows.')
      return
    }

    await client.query('BEGIN')
    try {
      for (const item of items) {
        await insertIfMissing(client, 'library_items', item)
      }
      for (const source of sources) {
        await insertIfMissing(client, 'library_item_sources', source)
      }
      for (const validation of validations) {
        await insertIfMissing(client, 'library_item_validations', validation)
      }
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }

    console.log('[backfill-shared-knowledge-library] Backfill complete')
  })
}

main().catch((error) => {
  console.error('[backfill-shared-knowledge-library] Failed:', error)
  process.exit(1)
})
