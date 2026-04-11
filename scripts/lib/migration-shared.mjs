import fs from 'fs/promises'

export const TOP_LEVEL_COLLECTIONS = [
  'agents',
  'messages',
  'memories',
  'memory_graphs',
  'shared_knowledge',
  'collective_broadcasts',
  'conflicts',
  'simulations',
  'challenges',
  'mentorships',
]

export const AGENT_SUBCOLLECTIONS = [
  'relationships',
  'creative_works',
  'creative_sessions',
  'creative_artifacts',
  'creative_pipeline_events',
  'dreams',
  'journal_entries',
  'learning_patterns',
  'learning_goals',
  'learning_adaptations',
  'learning_events',
  'skill_progressions',
  'rate_limits',
]

export function getArgValue(args, name, fallback) {
  const match = args.find((arg) => arg.startsWith(`${name}=`))
  if (!match) {
    return fallback
  }

  return match.slice(name.length + 1)
}

export function hasFlag(args, flag) {
  return args.includes(flag)
}

export async function loadExportFile(filePath) {
  const raw = await fs.readFile(filePath, 'utf8')
  return JSON.parse(raw)
}

export function normalizeIso(value, fallback = new Date().toISOString()) {
  if (value === undefined || value === null || value === '') {
    return fallback
  }

  if (typeof value === 'number') {
    return new Date(value).toISOString()
  }

  if (typeof value === 'object' && typeof value._seconds === 'number') {
    return new Date(value._seconds * 1000).toISOString()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return fallback
  }

  return parsed.toISOString()
}

export function sortPair(left, right) {
  return [left, right].sort()
}

export function relationshipPairId(agentId1, agentId2) {
  const [left, right] = sortPair(agentId1, agentId2)
  return `rel_${left}_${right}`
}

export function summarizeExport(data) {
  const counts = {}

  for (const collectionName of TOP_LEVEL_COLLECTIONS) {
    counts[collectionName] = data.collections?.[collectionName]?.length || 0
  }

  const subcollectionCounts = Object.fromEntries(
    AGENT_SUBCOLLECTIONS.map((name) => [name, 0])
  )
  const relationshipIds = new Set()

  for (const agentDoc of data.collections?.agents || []) {
    for (const subcollectionName of AGENT_SUBCOLLECTIONS) {
      const docs = agentDoc.subcollections?.[subcollectionName] || []
      if (subcollectionName === 'relationships') {
        for (const rel of docs) {
          relationshipIds.add(relationshipPairId(rel.data?.agentId1 || agentDoc.id, rel.data?.agentId2 || rel.id))
        }
      } else {
        subcollectionCounts[subcollectionName] += docs.length
      }
    }
  }

  subcollectionCounts.relationships = relationshipIds.size

  return {
    topLevel: counts,
    subcollections: subcollectionCounts,
  }
}
