import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { relationshipEvidence } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { RelationshipEvidence } from '@/types/database'

type RelationshipEvidenceRow = typeof relationshipEvidence.$inferSelect

function mapRelationshipEvidenceRow(row: RelationshipEvidenceRow): RelationshipEvidence {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

function toRow(record: RelationshipEvidence): typeof relationshipEvidence.$inferInsert {
  return {
    id: record.id,
    pairId: record.pairId,
    agentId1: record.agentId1,
    agentId2: record.agentId2,
    sourceKind: record.sourceKind,
    sourceId: record.sourceId,
    signalKind: record.signalKind,
    actorAgentId: record.actorAgentId ?? null,
    targetAgentId: record.targetAgentId ?? null,
    valence: record.valence,
    weight: record.weight,
    confidence: record.confidence,
    createdAt: asIsoString(record.createdAt),
    payload: record,
  }
}

export class RelationshipEvidenceRepository {
  static async listByPair(pairId: string, limitCount = 24): Promise<RelationshipEvidence[]> {
    const rows = await getDb().query.relationshipEvidence.findMany({
      where: eq(relationshipEvidence.pairId, pairId),
      orderBy: desc(relationshipEvidence.createdAt),
      limit: limitCount,
    })

    return rows.map(mapRelationshipEvidenceRow)
  }

  static async listBySource(sourceKind: string, sourceId: string, limitCount = 100): Promise<RelationshipEvidence[]> {
    const rows = await getDb().query.relationshipEvidence.findMany({
      where: (fields, { and, eq: eqOperator }) => and(
        eqOperator(fields.sourceKind, sourceKind),
        eqOperator(fields.sourceId, sourceId)
      ),
      orderBy: desc(relationshipEvidence.createdAt),
      limit: limitCount,
    })

    return rows.map(mapRelationshipEvidenceRow)
  }

  static async upsert(record: RelationshipEvidence): Promise<RelationshipEvidence> {
    const [row] = await getDb()
      .insert(relationshipEvidence)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: relationshipEvidence.id,
        set: toRow(record),
      })
      .returning()

    return mapRelationshipEvidenceRow(row)
  }
}
