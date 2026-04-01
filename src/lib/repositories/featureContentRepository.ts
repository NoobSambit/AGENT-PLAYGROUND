import { and, count, desc, eq, gte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { creativeWorks, dreams, journalEntries } from '@/lib/db/schema'
import { andAll, asIsoString } from '@/lib/db/utils'
import type { CreativeWork, Dream, JournalEntry, JournalEntryType, CreativeWorkType } from '@/types/database'

type CreativeRow = typeof creativeWorks.$inferSelect
type DreamRow = typeof dreams.$inferSelect
type JournalRow = typeof journalEntries.$inferSelect

function mapCreativeRow(row: CreativeRow): CreativeWork {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

function mapDreamRow(row: DreamRow): Dream {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

function mapJournalRow(row: JournalRow): JournalEntry {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
  }
}

export class FeatureContentRepository {
  static async listCreativeWorks(agentId: string, options?: {
    type?: CreativeWorkType
    limit?: number
  }): Promise<CreativeWork[]> {
    const rows = await getDb().query.creativeWorks.findMany({
      where: andAll([
        eq(creativeWorks.agentId, agentId),
        options?.type ? eq(creativeWorks.type, options.type) : undefined
      ]),
      orderBy: desc(creativeWorks.createdAt),
      limit: options?.limit,
    })

    return rows.map(mapCreativeRow)
  }

  static async saveCreativeWork(record: CreativeWork): Promise<CreativeWork> {
    const [row] = await getDb().insert(creativeWorks).values({
      id: record.id,
      agentId: record.agentId,
      type: record.type,
      createdAt: asIsoString(record.createdAt),
      payload: record,
    }).returning()

    return mapCreativeRow(row)
  }

  static async countCreativeWorksSince(agentId: string, start: string): Promise<number> {
    const [row] = await getDb().select({ value: count() }).from(creativeWorks).where(
      and(
        eq(creativeWorks.agentId, agentId),
        gte(creativeWorks.createdAt, asIsoString(start))
      )
    )

    return row?.value || 0
  }

  static async listDreams(agentId: string, limitCount?: number): Promise<Dream[]> {
    const rows = await getDb().query.dreams.findMany({
      where: eq(dreams.agentId, agentId),
      orderBy: desc(dreams.createdAt),
      limit: limitCount,
    })
    return rows.map(mapDreamRow)
  }

  static async saveDream(record: Dream): Promise<Dream> {
    const [row] = await getDb().insert(dreams).values({
      id: record.id,
      agentId: record.agentId,
      type: record.type,
      createdAt: asIsoString(record.createdAt),
      payload: record,
    }).returning()

    return mapDreamRow(row)
  }

  static async countDreamsSince(agentId: string, start: string): Promise<number> {
    const [row] = await getDb().select({ value: count() }).from(dreams).where(
      and(
        eq(dreams.agentId, agentId),
        gte(dreams.createdAt, asIsoString(start))
      )
    )

    return row?.value || 0
  }

  static async listJournalEntries(agentId: string, options?: {
    type?: JournalEntryType
    limit?: number
  }): Promise<JournalEntry[]> {
    const rows = await getDb().query.journalEntries.findMany({
      where: andAll([
        eq(journalEntries.agentId, agentId),
        options?.type ? eq(journalEntries.type, options.type) : undefined
      ]),
      orderBy: desc(journalEntries.createdAt),
      limit: options?.limit,
    })
    return rows.map(mapJournalRow)
  }

  static async saveJournalEntry(record: JournalEntry): Promise<JournalEntry> {
    const [row] = await getDb().insert(journalEntries).values({
      id: record.id,
      agentId: record.agentId,
      type: record.type,
      createdAt: asIsoString(record.createdAt),
      updatedAt: asIsoString(record.updatedAt),
      payload: record,
    }).returning()

    return mapJournalRow(row)
  }

  static async countJournalEntriesSince(agentId: string, start: string): Promise<number> {
    const [row] = await getDb().select({ value: count() }).from(journalEntries).where(
      and(
        eq(journalEntries.agentId, agentId),
        gte(journalEntries.createdAt, asIsoString(start))
      )
    )

    return row?.value || 0
  }
}
