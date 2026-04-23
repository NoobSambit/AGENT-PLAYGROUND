import { eq, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { agentRelationships } from '@/lib/db/schema'
import { asIsoString, relationshipPairId, sortedPair } from '@/lib/db/utils'
import { normalizeRelationship } from '@/lib/relationships/model'
import type { AgentRelationship } from '@/types/database'

type RelationshipRow = typeof agentRelationships.$inferSelect

function mapRelationshipRow(row: RelationshipRow): AgentRelationship {
  return normalizeRelationship({
    ...row.payload,
    id: row.id,
    relationshipTypes: (row.relationshipTypes || []) as AgentRelationship['relationshipTypes'],
    interactionCount: row.interactionCount,
    firstMeeting: asIsoString(row.firstMeeting),
    lastInteraction: asIsoString(row.lastInteraction),
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    significantEvents: row.significantEvents || [],
  })
}

function toRow(record: AgentRelationship): typeof agentRelationships.$inferInsert {
  const materialized = normalizeRelationship(record)
  const [left, right] = sortedPair(record.agentId1, record.agentId2)
  const normalized: AgentRelationship = {
    ...materialized,
    agentId1: left,
    agentId2: right,
    id: relationshipPairId(left, right),
  }

  return {
    id: normalized.id,
    agentId1: normalized.agentId1,
    agentId2: normalized.agentId2,
    status: normalized.status,
    relationshipTypes: normalized.relationshipTypes || [],
    interactionCount: normalized.interactionCount,
    firstMeeting: asIsoString(normalized.firstMeeting),
    lastInteraction: asIsoString(normalized.lastInteraction),
    metrics: normalized.metrics,
    significantEvents: normalized.significantEvents || [],
    payload: normalized,
    createdAt: asIsoString(normalized.createdAt),
    updatedAt: asIsoString(normalized.updatedAt),
  }
}

export class RelationshipRepository {
  static async getById(id: string): Promise<AgentRelationship | null> {
    const row = await getDb().query.agentRelationships.findFirst({
      where: eq(agentRelationships.id, id),
    })
    return row ? mapRelationshipRow(row) : null
  }

  static async getPair(agentId1: string, agentId2: string): Promise<AgentRelationship | null> {
    const id = relationshipPairId(agentId1, agentId2)
    const row = await getDb().query.agentRelationships.findFirst({
      where: eq(agentRelationships.id, id),
    })
    return row ? mapRelationshipRow(row) : null
  }

  static async listForAgent(agentId: string): Promise<AgentRelationship[]> {
    const rows = await getDb().query.agentRelationships.findMany({
      where: or(eq(agentRelationships.agentId1, agentId), eq(agentRelationships.agentId2, agentId)),
    })
    return rows.map(mapRelationshipRow)
  }

  static async upsert(record: AgentRelationship): Promise<AgentRelationship> {
    const [row] = await getDb()
      .insert(agentRelationships)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: agentRelationships.id,
        set: toRow(record),
      })
      .returning()

    return mapRelationshipRow(row)
  }
}
