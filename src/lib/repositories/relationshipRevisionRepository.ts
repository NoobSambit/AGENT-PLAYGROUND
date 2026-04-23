import { desc, eq, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { relationshipRevisions } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { RelationshipRevision } from '@/types/database'

type RelationshipRevisionRow = typeof relationshipRevisions.$inferSelect

function mapRelationshipRevisionRow(row: RelationshipRevisionRow): RelationshipRevision {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

function toRow(record: RelationshipRevision): typeof relationshipRevisions.$inferInsert {
  return {
    id: record.id,
    pairId: record.pairId,
    agentId1: record.agentId1,
    agentId2: record.agentId2,
    sourceKind: record.sourceKind,
    sourceId: record.sourceId,
    synthesisRunId: record.synthesisRunId,
    confidence: record.confidence,
    createdAt: asIsoString(record.createdAt),
    payload: record,
  }
}

export class RelationshipRevisionRepository {
  static async listByPair(pairId: string, limitCount = 12): Promise<RelationshipRevision[]> {
    const rows = await getDb().query.relationshipRevisions.findMany({
      where: eq(relationshipRevisions.pairId, pairId),
      orderBy: desc(relationshipRevisions.createdAt),
      limit: limitCount,
    })

    return rows.map(mapRelationshipRevisionRow)
  }

  static async listRecentByAgent(agentId: string, limitCount = 12): Promise<RelationshipRevision[]> {
    const rows = await getDb().query.relationshipRevisions.findMany({
      where: or(
        eq(relationshipRevisions.agentId1, agentId),
        eq(relationshipRevisions.agentId2, agentId)
      ),
      orderBy: desc(relationshipRevisions.createdAt),
      limit: limitCount,
    })

    return rows.map(mapRelationshipRevisionRow)
  }

  static async upsert(record: RelationshipRevision): Promise<RelationshipRevision> {
    const [row] = await getDb()
      .insert(relationshipRevisions)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: relationshipRevisions.id,
        set: toRow(record),
      })
      .returning()

    return mapRelationshipRevisionRow(row)
  }
}
