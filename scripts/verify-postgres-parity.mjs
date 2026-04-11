import { loadExportFile, normalizeIso, relationshipPairId, summarizeExport, getArgValue } from './lib/migration-shared.mjs'
import { countTable, withPgClient } from './lib/postgres.mjs'

const args = process.argv.slice(2)
const inputPath = getArgValue(args, '--input', './tmp/firestore-export.json')

function deriveAgentCounters(data) {
  const counters = new Map()
  const relationshipIds = new Map()

  for (const agentDoc of data.collections?.agents || []) {
    counters.set(agentDoc.id, {
      memories: 0,
      relationships: 0,
      creativeWorks: (agentDoc.subcollections?.creative_artifacts || []).filter((doc) => doc.data?.status === 'published').length,
      dreams: (agentDoc.subcollections?.dreams || []).length,
      journals: (agentDoc.subcollections?.journal_entries || []).length,
    })

    for (const relDoc of agentDoc.subcollections?.relationships || []) {
      const left = relDoc.data?.agentId1 || agentDoc.id
      const right = relDoc.data?.agentId2 || relDoc.id
      relationshipIds.set(relationshipPairId(left, right), [left, right])
    }
  }

  for (const memoryDoc of data.collections?.memories || []) {
    const current = counters.get(memoryDoc.data?.agentId)
    if (current && memoryDoc.data?.isActive !== false) {
      current.memories += 1
    }
  }

  for (const [, [left, right]] of relationshipIds) {
    if (counters.has(left)) counters.get(left).relationships += 1
    if (counters.has(right)) counters.get(right).relationships += 1
  }

  return counters
}

async function main() {
  const exportData = await loadExportFile(inputPath)
  const expectedSummary = summarizeExport(exportData)
  const agentCounters = deriveAgentCounters(exportData)

  const mismatches = []

  await withPgClient(async (client) => {
    const tableCounts = {
      agents: await countTable(client, 'agents'),
      messages: await countTable(client, 'messages'),
      memories: await countTable(client, 'memories'),
      memory_graphs: await countTable(client, 'memory_graphs'),
      agent_relationships: await countTable(client, 'agent_relationships'),
      creative_sessions: await countTable(client, 'creative_sessions'),
      creative_artifacts: await countTable(client, 'creative_artifacts'),
      creative_pipeline_events: await countTable(client, 'creative_pipeline_events'),
      dreams: await countTable(client, 'dreams'),
      journal_entries: await countTable(client, 'journal_entries'),
      learning_patterns: await countTable(client, 'learning_patterns'),
      learning_goals: await countTable(client, 'learning_goals'),
      learning_adaptations: await countTable(client, 'learning_adaptations'),
      learning_events: await countTable(client, 'learning_events'),
      skill_progressions: await countTable(client, 'skill_progressions'),
      agent_rate_limits: await countTable(client, 'agent_rate_limits'),
      shared_knowledge: await countTable(client, 'shared_knowledge'),
      collective_broadcasts: await countTable(client, 'collective_broadcasts'),
      conflicts: await countTable(client, 'conflicts'),
      challenges: await countTable(client, 'challenges'),
      mentorships: await countTable(client, 'mentorships'),
      simulations: await countTable(client, 'simulations'),
    }

    const expectedTableCounts = {
      agents: expectedSummary.topLevel.agents,
      messages: expectedSummary.topLevel.messages,
      memories: expectedSummary.topLevel.memories,
      memory_graphs: expectedSummary.topLevel.memory_graphs,
      agent_relationships: expectedSummary.subcollections.relationships,
      creative_sessions: expectedSummary.subcollections.creative_sessions,
      creative_artifacts: expectedSummary.subcollections.creative_artifacts,
      creative_pipeline_events: expectedSummary.subcollections.creative_pipeline_events,
      dreams: expectedSummary.subcollections.dreams,
      journal_entries: expectedSummary.subcollections.journal_entries,
      learning_patterns: expectedSummary.subcollections.learning_patterns,
      learning_goals: expectedSummary.subcollections.learning_goals,
      learning_adaptations: expectedSummary.subcollections.learning_adaptations,
      learning_events: expectedSummary.subcollections.learning_events,
      skill_progressions: expectedSummary.subcollections.skill_progressions,
      agent_rate_limits: expectedSummary.subcollections.rate_limits,
      shared_knowledge: expectedSummary.topLevel.shared_knowledge,
      collective_broadcasts: expectedSummary.topLevel.collective_broadcasts,
      conflicts: expectedSummary.topLevel.conflicts,
      challenges: expectedSummary.topLevel.challenges,
      mentorships: expectedSummary.topLevel.mentorships,
      simulations: expectedSummary.topLevel.simulations,
    }

    for (const [tableName, expected] of Object.entries(expectedTableCounts)) {
      const actual = tableCounts[tableName]
      if (actual !== expected) {
        mismatches.push({ type: 'table_count', tableName, expected, actual })
      }
    }

    const { rows: agentRows } = await client.query(`
      SELECT id, memory_count, relationship_count, creative_works, dream_count, journal_count
      FROM agents
      ORDER BY id
    `)

    for (const row of agentRows) {
      const expected = agentCounters.get(row.id)
      if (!expected) {
        continue
      }

      if (row.memory_count !== expected.memories) {
        mismatches.push({ type: 'agent_counter', agentId: row.id, field: 'memory_count', expected: expected.memories, actual: row.memory_count })
      }
      if (row.relationship_count !== expected.relationships) {
        mismatches.push({ type: 'agent_counter', agentId: row.id, field: 'relationship_count', expected: expected.relationships, actual: row.relationship_count })
      }
      if (row.creative_works !== expected.creativeWorks) {
        mismatches.push({ type: 'agent_counter', agentId: row.id, field: 'creative_works', expected: expected.creativeWorks, actual: row.creative_works })
      }
      if (row.dream_count !== expected.dreams) {
        mismatches.push({ type: 'agent_counter', agentId: row.id, field: 'dream_count', expected: expected.dreams, actual: row.dream_count })
      }
      if (row.journal_count !== expected.journals) {
        mismatches.push({ type: 'agent_counter', agentId: row.id, field: 'journal_count', expected: expected.journals, actual: row.journal_count })
      }
    }
  })

  if (mismatches.length > 0) {
    console.error('[verify-postgres-parity] Mismatches detected')
    console.error(JSON.stringify(mismatches, null, 2))
    process.exit(1)
  }

  console.log('[verify-postgres-parity] Parity verified')
  console.log(JSON.stringify({
    inputPath,
    verifiedAt: normalizeIso(new Date()),
  }, null, 2))
}

main().catch((error) => {
  console.error('[verify-postgres-parity] Failed:', error)
  process.exit(1)
})
