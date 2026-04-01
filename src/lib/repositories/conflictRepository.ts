import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { conflicts } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { ConflictAnalysis } from '@/types/enhancements'

type ConflictRow = typeof conflicts.$inferSelect

function mapConflictRow(row: ConflictRow): ConflictAnalysis {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
  }
}

function toRow(record: ConflictAnalysis): typeof conflicts.$inferInsert {
  return {
    id: record.id,
    topic: record.topic,
    status: record.status,
    participantIds: record.participants.map((participant) => participant.agentId),
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
    payload: record,
  }
}

export class ConflictRepository {
  static async listRecent(limitCount: number): Promise<ConflictAnalysis[]> {
    const rows = await getDb().query.conflicts.findMany({
      orderBy: desc(conflicts.updatedAt),
      limit: limitCount,
    })
    return rows.map(mapConflictRow)
  }

  static async getById(id: string): Promise<ConflictAnalysis | null> {
    const row = await getDb().query.conflicts.findFirst({
      where: eq(conflicts.id, id),
    })
    return row ? mapConflictRow(row) : null
  }

  static async upsert(record: ConflictAnalysis): Promise<ConflictAnalysis> {
    const [row] = await getDb()
      .insert(conflicts)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: conflicts.id,
        set: toRow(record),
      })
      .returning()

    return mapConflictRow(row)
  }
}
