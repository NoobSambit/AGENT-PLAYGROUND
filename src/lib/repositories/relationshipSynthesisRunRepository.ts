import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { relationshipSynthesisRuns } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { RelationshipSynthesisRun } from '@/types/database'

type RelationshipSynthesisRunRow = typeof relationshipSynthesisRuns.$inferSelect

function mapRelationshipSynthesisRunRow(row: RelationshipSynthesisRunRow): RelationshipSynthesisRun {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
  }
}

function toRow(record: RelationshipSynthesisRun): typeof relationshipSynthesisRuns.$inferInsert {
  return {
    id: record.id,
    pairId: record.pairId,
    agentId1: record.agentId1,
    agentId2: record.agentId2,
    triggerSourceKind: record.triggerSourceKind,
    triggerSourceId: record.triggerSourceId,
    status: record.status,
    promptVersion: record.promptVersion,
    provider: record.provider ?? null,
    model: record.model ?? null,
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
    payload: record,
  }
}

export class RelationshipSynthesisRunRepository {
  static async listByPair(pairId: string, limitCount = 8): Promise<RelationshipSynthesisRun[]> {
    const rows = await getDb().query.relationshipSynthesisRuns.findMany({
      where: eq(relationshipSynthesisRuns.pairId, pairId),
      orderBy: desc(relationshipSynthesisRuns.createdAt),
      limit: limitCount,
    })

    return rows.map(mapRelationshipSynthesisRunRow)
  }

  static async upsert(record: RelationshipSynthesisRun): Promise<RelationshipSynthesisRun> {
    const [row] = await getDb()
      .insert(relationshipSynthesisRuns)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: relationshipSynthesisRuns.id,
        set: toRow(record),
      })
      .returning()

    return mapRelationshipSynthesisRunRow(row)
  }
}
