import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { collectiveBroadcasts } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { KnowledgeBroadcast } from '@/types/enhancements'

type BroadcastRow = typeof collectiveBroadcasts.$inferSelect

function mapBroadcastRow(row: BroadcastRow): KnowledgeBroadcast {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

function toRow(record: KnowledgeBroadcast): typeof collectiveBroadcasts.$inferInsert {
  return {
    id: record.id,
    agentId: record.agentId,
    topic: record.topic,
    knowledgeId: record.knowledgeId,
    createdAt: asIsoString(record.createdAt),
    payload: record,
  }
}

export class BroadcastRepository {
  static async listRecent(limitCount: number): Promise<KnowledgeBroadcast[]> {
    const rows = await getDb().query.collectiveBroadcasts.findMany({
      orderBy: desc(collectiveBroadcasts.createdAt),
      limit: limitCount,
    })
    return rows.map(mapBroadcastRow)
  }

  static async getById(id: string): Promise<KnowledgeBroadcast | null> {
    const row = await getDb().query.collectiveBroadcasts.findFirst({
      where: eq(collectiveBroadcasts.id, id),
    })
    return row ? mapBroadcastRow(row) : null
  }

  static async upsert(record: KnowledgeBroadcast): Promise<KnowledgeBroadcast> {
    const [row] = await getDb()
      .insert(collectiveBroadcasts)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: collectiveBroadcasts.id,
        set: toRow(record),
      })
      .returning()

    return mapBroadcastRow(row)
  }
}
