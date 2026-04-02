import { getArgValue, hasFlag, loadExportFile, normalizeIso, relationshipPairId } from './lib/migration-shared.mjs'
import { upsertRow, withPgClient } from './lib/postgres.mjs'

const args = process.argv.slice(2)
const inputPath = getArgValue(args, '--input', './tmp/firestore-export.json')
const dryRun = hasFlag(args, '--dry-run')

function buildAgentRow(doc) {
  const data = doc.data || {}
  return {
    id: doc.id,
    name: data.name || '',
    persona: data.persona || '',
    goals: data.goals || [],
    status: data.status || 'active',
    user_id: data.userId ?? null,
    settings: data.settings ?? null,
    core_traits: data.coreTraits || {},
    dynamic_traits: data.dynamicTraits || {},
    memory_count: data.memoryCount || 0,
    total_interactions: data.totalInteractions || 0,
    linguistic_profile: data.linguisticProfile ?? null,
    emotional_profile: data.emotionalProfile ?? null,
    emotional_state: data.emotionalState ?? null,
    emotional_history: data.emotionalHistory || [],
    progress: data.progress ?? null,
    stats: data.stats ?? null,
    psychological_profile: data.psychologicalProfile ?? null,
    relationship_count: data.relationshipCount || 0,
    creative_works: data.creativeWorks || 0,
    dream_count: data.dreamCount || 0,
    journal_count: data.journalCount || 0,
    challenges_completed: data.challengesCompleted || 0,
    challenge_wins: data.challengeWins || 0,
    mentorship_stats: data.mentorshipStats ?? null,
    created_at: normalizeIso(data.createdAt),
    updated_at: normalizeIso(data.updatedAt),
  }
}

function buildMessageRow(doc) {
  const data = doc.data || {}
  return {
    id: doc.id,
    agent_id: data.agentId,
    content: data.content || '',
    type: data.type || 'agent',
    room_id: data.roomId ?? null,
    metadata: data.metadata ?? null,
    user_id: data.userId ?? null,
    timestamp: normalizeIso(data.timestamp),
  }
}

function buildMemoryRow(doc) {
  const data = doc.data || {}
  return {
    id: doc.id,
    agent_id: data.agentId,
    type: data.type || 'conversation',
    content: data.content || '',
    summary: data.summary || data.content || '',
    keywords: data.keywords || [],
    importance: data.importance || 0,
    context: data.context || '',
    metadata: data.metadata ?? null,
    user_id: data.userId ?? null,
    is_active: data.isActive ?? true,
    timestamp: normalizeIso(data.timestamp),
  }
}

function buildMemoryGraphRow(doc) {
  const data = doc.data || {}
  const payload = {
    agentId: data.agentId || doc.id,
    concepts: data.concepts || [],
    links: data.links || [],
    stats: data.stats || {},
    lastUpdated: normalizeIso(data.lastUpdated),
  }

  return {
    agent_id: doc.id,
    payload,
    updated_at: normalizeIso(data.lastUpdated),
  }
}

function buildKnowledgeRow(doc) {
  const data = doc.data || {}
  return {
    id: doc.id,
    topic: data.topic || '',
    category: data.category || 'fact',
    contributor_id: data.contributorId || '',
    confidence: data.confidence ?? 0.5,
    tags: data.tags || [],
    created_at: normalizeIso(data.createdAt),
    updated_at: normalizeIso(data.updatedAt),
    payload: {
      id: doc.id,
      ...data,
      createdAt: normalizeIso(data.createdAt),
      updatedAt: normalizeIso(data.updatedAt),
      lastAccessedAt: normalizeIso(data.lastAccessedAt),
    },
  }
}

function buildBroadcastRow(doc) {
  const data = doc.data || {}
  return {
    id: doc.id,
    agent_id: data.agentId || '',
    topic: data.topic || '',
    knowledge_id: data.knowledgeId ?? null,
    created_at: normalizeIso(data.createdAt),
    payload: {
      id: doc.id,
      ...data,
      createdAt: normalizeIso(data.createdAt),
    },
  }
}

function buildConflictRow(doc) {
  const data = doc.data || {}
  return {
    id: doc.id,
    topic: data.topic || '',
    status: data.status || 'analyzed',
    participant_ids: (data.participants || []).map((participant) => participant.agentId),
    created_at: normalizeIso(data.createdAt),
    updated_at: normalizeIso(data.updatedAt),
    payload: {
      id: doc.id,
      ...data,
      createdAt: normalizeIso(data.createdAt),
      updatedAt: normalizeIso(data.updatedAt),
    },
  }
}

function buildChallengeRow(doc) {
  const data = doc.data || {}
  return {
    id: doc.id,
    type: data.type || 'collaboration',
    status: data.status || 'pending',
    participant_ids: data.participants || [],
    created_at: normalizeIso(data.createdAt),
    payload: {
      id: doc.id,
      ...data,
      createdAt: normalizeIso(data.createdAt),
      startedAt: normalizeIso(data.startedAt),
      completedAt: data.completedAt ? normalizeIso(data.completedAt) : undefined,
    },
  }
}

function buildMentorshipRow(doc) {
  const data = doc.data || {}
  return {
    id: doc.id,
    mentor_id: data.mentorId || '',
    mentee_id: data.menteeId || '',
    status: data.status || 'active',
    current_focus: data.currentFocus || null,
    focus_areas: data.focusAreas || [],
    created_at: normalizeIso(data.createdAt),
    updated_at: normalizeIso(data.updatedAt),
    payload: {
      id: doc.id,
      ...data,
      createdAt: normalizeIso(data.createdAt),
      updatedAt: normalizeIso(data.updatedAt),
    },
  }
}

function buildSimulationRow(doc) {
  const data = doc.data || {}
  return {
    id: doc.id,
    agent_ids: (data.agents || []).map((agent) => agent.id),
    created_at: normalizeIso(data.createdAt),
    payload: {
      id: doc.id,
      ...data,
      createdAt: normalizeIso(data.createdAt),
    },
  }
}

function buildRelationshipRows(agents) {
  const deduped = new Map()

  for (const agentDoc of agents) {
    const relationships = agentDoc.subcollections?.relationships || []

    for (const relationshipDoc of relationships) {
      const data = relationshipDoc.data || {}
      const left = data.agentId1 || agentDoc.id
      const right = data.agentId2 || relationshipDoc.id
      const id = relationshipPairId(left, right)
      const existing = deduped.get(id)
      const candidateTimestamp = normalizeIso(data.updatedAt || data.lastInteraction)
      const existingTimestamp = existing ? normalizeIso(existing.updated_at) : null

      if (!existing || candidateTimestamp >= existingTimestamp) {
        const pair = [left, right].sort()
        const payload = {
          id,
          ...data,
          agentId1: pair[0],
          agentId2: pair[1],
          createdAt: normalizeIso(data.createdAt),
          updatedAt: normalizeIso(data.updatedAt),
          firstMeeting: normalizeIso(data.firstMeeting),
          lastInteraction: normalizeIso(data.lastInteraction),
        }

        deduped.set(id, {
          id,
          agent_id_1: pair[0],
          agent_id_2: pair[1],
          status: data.status || 'neutral',
          relationship_types: data.relationshipTypes || [],
          interaction_count: data.interactionCount || 0,
          first_meeting: normalizeIso(data.firstMeeting),
          last_interaction: normalizeIso(data.lastInteraction),
          metrics: data.metrics || {},
          significant_events: data.significantEvents || [],
          payload,
          created_at: normalizeIso(data.createdAt),
          updated_at: normalizeIso(data.updatedAt),
        })
      }
    }
  }

  return [...deduped.values()]
}

function buildCreativeRows(agents) {
  return agents.flatMap((agentDoc) =>
    (agentDoc.subcollections?.creative_works || []).map((doc) => ({
      id: doc.id,
      agent_id: agentDoc.id,
      type: doc.data?.type || 'story',
      created_at: normalizeIso(doc.data?.createdAt),
      payload: {
        id: doc.id,
        ...doc.data,
        createdAt: normalizeIso(doc.data?.createdAt),
      },
    }))
  )
}

function buildDreamRows(agents) {
  return agents.flatMap((agentDoc) =>
    (agentDoc.subcollections?.dreams || []).map((doc) => ({
      id: doc.id,
      agent_id: agentDoc.id,
      type: doc.data?.type || 'symbolic',
      created_at: normalizeIso(doc.data?.createdAt),
      payload: {
        id: doc.id,
        ...doc.data,
        createdAt: normalizeIso(doc.data?.createdAt),
      },
    }))
  )
}

function buildJournalRows(agents) {
  return agents.flatMap((agentDoc) =>
    (agentDoc.subcollections?.journal_entries || []).map((doc) => ({
      id: doc.id,
      agent_id: agentDoc.id,
      type: doc.data?.type || 'daily_reflection',
      created_at: normalizeIso(doc.data?.createdAt),
      updated_at: normalizeIso(doc.data?.updatedAt),
      payload: {
        id: doc.id,
        ...doc.data,
        createdAt: normalizeIso(doc.data?.createdAt),
        updatedAt: normalizeIso(doc.data?.updatedAt),
      },
    }))
  )
}

function buildLearningPatternRows(agents) {
  return agents.flatMap((agentDoc) =>
    (agentDoc.subcollections?.learning_patterns || []).map((doc) => ({
      id: doc.id,
      agent_id: agentDoc.id,
      type: doc.data?.type || 'topic_interest',
      pattern: doc.data?.pattern || '',
      last_observed: normalizeIso(doc.data?.lastObserved),
      payload: {
        id: doc.id,
        ...doc.data,
        lastObserved: normalizeIso(doc.data?.lastObserved),
        firstObserved: normalizeIso(doc.data?.firstObserved),
      },
    }))
  )
}

function buildLearningGoalRows(agents) {
  return agents.flatMap((agentDoc) =>
    (agentDoc.subcollections?.learning_goals || []).map((doc) => ({
      id: doc.id,
      agent_id: agentDoc.id,
      category: doc.data?.category || 'topic_interest',
      status: doc.data?.status || 'active',
      created_at: normalizeIso(doc.data?.createdAt),
      target_date: doc.data?.targetDate ? normalizeIso(doc.data?.targetDate) : null,
      payload: {
        id: doc.id,
        ...doc.data,
        createdAt: normalizeIso(doc.data?.createdAt),
        targetDate: doc.data?.targetDate ? normalizeIso(doc.data?.targetDate) : undefined,
        achievedAt: doc.data?.achievedAt ? normalizeIso(doc.data?.achievedAt) : undefined,
      },
    }))
  )
}

function buildLearningAdaptationRows(agents) {
  return agents.flatMap((agentDoc) =>
    (agentDoc.subcollections?.learning_adaptations || []).map((doc) => ({
      id: doc.id,
      agent_id: agentDoc.id,
      is_active: doc.data?.isActive ?? true,
      event_timestamp: normalizeIso(doc.data?.timestamp),
      payload: {
        id: doc.id,
        ...doc.data,
        timestamp: normalizeIso(doc.data?.timestamp),
      },
    }))
  )
}

function buildLearningEventRows(agents) {
  return agents.flatMap((agentDoc) =>
    (agentDoc.subcollections?.learning_events || []).map((doc) => ({
      id: doc.id,
      agent_id: agentDoc.id,
      event_type: doc.data?.eventType || 'conversation',
      event_timestamp: normalizeIso(doc.data?.timestamp),
      payload: {
        id: doc.id,
        ...doc.data,
        timestamp: normalizeIso(doc.data?.timestamp),
      },
    }))
  )
}

function buildSkillRows(agents) {
  return agents.flatMap((agentDoc) =>
    (agentDoc.subcollections?.skill_progressions || []).map((doc) => ({
      id: `${agentDoc.id}:${doc.data?.category || doc.id}`,
      agent_id: agentDoc.id,
      category: doc.data?.category || doc.id,
      payload: doc.data || {},
    }))
  )
}

function buildRateLimitRows(agents) {
  return agents.flatMap((agentDoc) =>
    (agentDoc.subcollections?.rate_limits || []).map((doc) => ({
      id: `${doc.id}:${agentDoc.id}`,
      agent_id: agentDoc.id,
      feature: doc.id,
      count: doc.data?.count || 0,
      window_start: normalizeIso(doc.data?.windowStart, new Date(0).toISOString()),
      last_request: normalizeIso(doc.data?.lastRequest || doc.data?.windowStart, new Date(0).toISOString()),
      payload: Object.fromEntries(
        Object.entries(doc.data || {}).filter(([key]) => !['count', 'windowStart', 'lastRequest'].includes(key))
      ),
    }))
  )
}

function buildImportPlan(data) {
  const agents = data.collections?.agents || []

  return [
    ['agents', agents.map(buildAgentRow)],
    ['messages', (data.collections?.messages || []).map(buildMessageRow)],
    ['memories', (data.collections?.memories || []).map(buildMemoryRow)],
    ['memory_graphs', (data.collections?.memory_graphs || []).map(buildMemoryGraphRow)],
    ['agent_relationships', buildRelationshipRows(agents)],
    ['creative_works', buildCreativeRows(agents)],
    ['dreams', buildDreamRows(agents)],
    ['journal_entries', buildJournalRows(agents)],
    ['learning_patterns', buildLearningPatternRows(agents)],
    ['learning_goals', buildLearningGoalRows(agents)],
    ['learning_adaptations', buildLearningAdaptationRows(agents)],
    ['learning_events', buildLearningEventRows(agents)],
    ['skill_progressions', buildSkillRows(agents)],
    ['agent_rate_limits', buildRateLimitRows(agents)],
    ['shared_knowledge', (data.collections?.shared_knowledge || []).map(buildKnowledgeRow)],
    ['collective_broadcasts', (data.collections?.collective_broadcasts || []).map(buildBroadcastRow)],
    ['conflicts', (data.collections?.conflicts || []).map(buildConflictRow)],
    ['challenges', (data.collections?.challenges || []).map(buildChallengeRow)],
    ['mentorships', (data.collections?.mentorships || []).map(buildMentorshipRow)],
    ['simulations', (data.collections?.simulations || []).map(buildSimulationRow)],
  ]
}

const CONFLICT_COLUMNS = {
  memory_graphs: ['agent_id'],
}

async function main() {
  const exportData = await loadExportFile(inputPath)
  const importPlan = buildImportPlan(exportData)
  const summary = Object.fromEntries(importPlan.map(([tableName, rows]) => [tableName, rows.length]))

  console.log(JSON.stringify({ inputPath, dryRun, summary }, null, 2))

  if (dryRun) {
    return
  }

  await withPgClient(async (client) => {
    await client.query('BEGIN')

      try {
        for (const [tableName, rows] of importPlan) {
          for (const row of rows) {
            await upsertRow(client, tableName, row, CONFLICT_COLUMNS[tableName] || ['id'])
          }
        }

      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })

  console.log('[firestore-to-postgres] Import complete')
}

main().catch((error) => {
  console.error('[firestore-to-postgres] Failed:', error)
  process.exit(1)
})
