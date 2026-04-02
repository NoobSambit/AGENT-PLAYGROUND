import { and, asc, desc, eq, gte, lte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { memories } from '@/lib/db/schema'
import { asIsoString, compact } from '@/lib/db/utils'
import type { MemoryRecord } from '@/types/database'

type MemoryRow = typeof memories.$inferSelect

function mapMemoryRow(row: MemoryRow): MemoryRecord {
  return {
    id: row.id,
    agentId: row.agentId,
    type: row.type as MemoryRecord['type'],
    content: row.content,
    summary: row.summary,
    keywords: row.keywords || [],
    importance: row.importance,
    context: row.context,
    timestamp: asIsoString(row.timestamp),
    origin: row.origin as MemoryRecord['origin'],
    linkedMessageIds: row.linkedMessageIds || [],
    metadata: row.metadata || undefined,
    userId: row.userId || undefined,
    isActive: row.isActive,
  }
}

export class MemoryRepository {
  static async getById(id: string): Promise<MemoryRecord | null> {
    const row = await getDb().query.memories.findFirst({
      where: eq(memories.id, id),
    })
    return row ? mapMemoryRow(row) : null
  }

  static async listByAgent(agentId: string, options?: {
    activeOnly?: boolean
    type?: MemoryRecord['type']
    origin?: MemoryRecord['origin']
    limit?: number
    createdAfter?: string
    createdBefore?: string
    ascending?: boolean
  }): Promise<MemoryRecord[]> {
    const conditions = [
      eq(memories.agentId, agentId),
      options?.activeOnly === false ? undefined : eq(memories.isActive, true),
      options?.type ? eq(memories.type, options.type) : undefined,
      options?.origin ? eq(memories.origin, options.origin) : undefined,
      options?.createdAfter ? gte(memories.timestamp, asIsoString(options.createdAfter)) : undefined,
      options?.createdBefore ? lte(memories.timestamp, asIsoString(options.createdBefore)) : undefined,
    ].filter(Boolean)

    const where = conditions.length > 1
      ? and(...conditions)
      : (conditions[0] ?? undefined)

    const rows = await getDb().query.memories.findMany({
      where,
      orderBy: options?.ascending ? asc(memories.timestamp) : desc(memories.timestamp),
      limit: options?.limit,
    })

    return rows.map(mapMemoryRow)
  }

  static async create(record: MemoryRecord): Promise<MemoryRecord> {
    const [row] = await getDb().insert(memories).values({
      id: record.id,
      agentId: record.agentId,
      type: record.type,
      content: record.content,
      summary: record.summary,
      keywords: record.keywords || [],
      importance: record.importance,
      context: record.context,
      origin: record.origin,
      linkedMessageIds: record.linkedMessageIds || [],
      metadata: record.metadata ?? null,
      userId: record.userId,
      isActive: record.isActive,
      timestamp: asIsoString(record.timestamp),
    }).returning()

    return mapMemoryRow(row)
  }

  static async update(id: string, updates: Partial<MemoryRecord>): Promise<boolean> {
    const [row] = await getDb().update(memories).set(compact({
      type: updates.type,
      content: updates.content,
      summary: updates.summary,
      keywords: updates.keywords,
      importance: updates.importance,
      context: updates.context,
      origin: updates.origin,
      linkedMessageIds: updates.linkedMessageIds,
      metadata: 'metadata' in updates ? updates.metadata ?? null : undefined,
      userId: updates.userId,
      isActive: updates.isActive,
      timestamp: updates.timestamp ? asIsoString(updates.timestamp) : undefined,
    })).where(eq(memories.id, id)).returning({ id: memories.id })

    return Boolean(row)
  }

  static async delete(id: string): Promise<boolean> {
    const [row] = await getDb().delete(memories).where(eq(memories.id, id)).returning({ id: memories.id })
    return Boolean(row)
  }
}
