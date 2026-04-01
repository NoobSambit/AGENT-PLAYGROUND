import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { sharedKnowledge } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { KnowledgeCategory, SharedKnowledge } from '@/types/database'

type KnowledgeRow = typeof sharedKnowledge.$inferSelect

function mapKnowledgeRow(row: KnowledgeRow): SharedKnowledge {
  return {
    ...row.payload,
    id: row.id,
    topic: row.payload.topic,
    category: row.payload.category,
    contributorId: row.payload.contributorId,
    confidence: row.payload.confidence,
    tags: row.payload.tags,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
  }
}

function toRow(record: SharedKnowledge): typeof sharedKnowledge.$inferInsert {
  return {
    id: record.id,
    topic: record.topic,
    category: record.category,
    contributorId: record.contributorId,
    confidence: record.confidence,
    tags: record.tags || [],
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
    payload: record,
  }
}

export class KnowledgeRepository {
  static async listAll(limitCount: number = 100): Promise<SharedKnowledge[]> {
    const rows = await getDb().query.sharedKnowledge.findMany({
      orderBy: [desc(sharedKnowledge.confidence), desc(sharedKnowledge.createdAt)],
      limit: limitCount,
    })
    return rows.map(mapKnowledgeRow)
  }

  static async listByCategory(category: KnowledgeCategory): Promise<SharedKnowledge[]> {
    const rows = await getDb().query.sharedKnowledge.findMany({
      where: eq(sharedKnowledge.category, category),
      orderBy: [desc(sharedKnowledge.confidence), desc(sharedKnowledge.createdAt)],
    })
    return rows.map(mapKnowledgeRow)
  }

  static async getById(id: string): Promise<SharedKnowledge | null> {
    const row = await getDb().query.sharedKnowledge.findFirst({
      where: eq(sharedKnowledge.id, id),
    })
    return row ? mapKnowledgeRow(row) : null
  }

  static async upsert(record: SharedKnowledge): Promise<SharedKnowledge> {
    const [row] = await getDb()
      .insert(sharedKnowledge)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: sharedKnowledge.id,
        set: toRow(record),
      })
      .returning()

    return mapKnowledgeRow(row)
  }

  static async delete(id: string): Promise<boolean> {
    const [row] = await getDb()
      .delete(sharedKnowledge)
      .where(eq(sharedKnowledge.id, id))
      .returning({ id: sharedKnowledge.id })

    return Boolean(row)
  }
}
