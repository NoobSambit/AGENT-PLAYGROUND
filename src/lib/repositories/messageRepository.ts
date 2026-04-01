import { asc, desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { messages } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { MessageRecord } from '@/types/database'

type MessageRow = typeof messages.$inferSelect

function mapMessageRow(row: MessageRow): MessageRecord {
  return {
    id: row.id,
    agentId: row.agentId,
    content: row.content,
    type: row.type as MessageRecord['type'],
    timestamp: asIsoString(row.timestamp),
    roomId: row.roomId || undefined,
    metadata: row.metadata || undefined,
    userId: row.userId || undefined,
  }
}

export class MessageRepository {
  static async getById(id: string): Promise<MessageRecord | null> {
    const row = await getDb().query.messages.findFirst({
      where: eq(messages.id, id),
    })
    return row ? mapMessageRow(row) : null
  }

  static async listAll(): Promise<MessageRecord[]> {
    const rows = await getDb().select().from(messages).orderBy(desc(messages.timestamp))
    return rows.map(mapMessageRow)
  }

  static async listByAgentId(agentId: string): Promise<MessageRecord[]> {
    const rows = await getDb()
      .select()
      .from(messages)
      .where(eq(messages.agentId, agentId))
      .orderBy(asc(messages.timestamp))
    return rows.map(mapMessageRow)
  }

  static async listByRoomId(roomId: string): Promise<MessageRecord[]> {
    const rows = await getDb()
      .select()
      .from(messages)
      .where(eq(messages.roomId, roomId))
      .orderBy(asc(messages.timestamp))
    return rows.map(mapMessageRow)
  }

  static async listRecent(limitCount: number): Promise<MessageRecord[]> {
    const rows = await getDb().query.messages.findMany({
      orderBy: desc(messages.timestamp),
      limit: limitCount,
    })
    return rows.map(mapMessageRow).reverse()
  }

  static async create(record: MessageRecord): Promise<MessageRecord> {
    const [row] = await getDb().insert(messages).values({
      id: record.id,
      agentId: record.agentId,
      content: record.content,
      type: record.type,
      roomId: record.roomId,
      metadata: record.metadata ?? null,
      userId: record.userId,
      timestamp: asIsoString(record.timestamp),
    }).returning()

    return mapMessageRow(row)
  }

  static async update(id: string, updates: Partial<MessageRecord>): Promise<boolean> {
    const [row] = await getDb().update(messages).set({
      content: updates.content,
      type: updates.type,
      roomId: updates.roomId,
      metadata: 'metadata' in updates ? updates.metadata ?? null : undefined,
      userId: updates.userId,
      timestamp: updates.timestamp ? asIsoString(updates.timestamp) : undefined,
    }).where(eq(messages.id, id)).returning({ id: messages.id })

    return Boolean(row)
  }

  static async delete(id: string): Promise<boolean> {
    const [row] = await getDb()
      .delete(messages)
      .where(eq(messages.id, id))
      .returning({ id: messages.id })

    return Boolean(row)
  }
}
