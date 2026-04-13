import { and, count, desc, eq, gte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { dreams, journalEntries } from '@/lib/db/schema'
import { andAll, asIsoString } from '@/lib/db/utils'
import type { Dream, JournalEntry, JournalEntryType } from '@/types/database'

type DreamRow = typeof dreams.$inferSelect
type JournalRow = typeof journalEntries.$inferSelect

function mapDreamRow(row: DreamRow): Dream {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    savedAt: row.savedAt ? asIsoString(row.savedAt) : undefined,
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
  static async listDreams(agentId: string, limitCount?: number): Promise<Dream[]> {
    const rows = await getDb().query.dreams.findMany({
      where: andAll([
        eq(dreams.agentId, agentId),
        eq(dreams.saved, true),
      ]),
      orderBy: desc(dreams.createdAt),
      limit: limitCount,
    })
    return rows.map(mapDreamRow)
  }

  static async saveDream(record: Dream): Promise<Dream> {
    const [row] = await getDb().insert(dreams).values({
      id: record.id,
      agentId: record.agentId,
      sessionId: record.sessionId,
      type: record.type,
      status: record.status,
      artifactRole: record.artifactRole ?? null,
      normalizationStatus: record.normalizationStatus ?? 'legacy_unvalidated',
      qualityScore: record.qualityScore ?? record.evaluation?.overallScore ?? null,
      sourceDreamId: record.sourceDreamId ?? null,
      version: record.version,
      title: record.title,
      summary: record.summary,
      saved: Boolean(record.savedAt),
      createdAt: asIsoString(record.createdAt),
      updatedAt: asIsoString(record.updatedAt),
      savedAt: record.savedAt ? asIsoString(record.savedAt) : null,
      payload: record,
    }).returning()

    return mapDreamRow(row)
  }

  static async countDreamsSince(agentId: string, start: string): Promise<number> {
    const [row] = await getDb().select({ value: count() }).from(dreams).where(
      and(
        eq(dreams.agentId, agentId),
        eq(dreams.saved, true),
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
        eq(journalEntries.saved, true),
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
      sessionId: record.sessionId,
      type: record.type,
      status: record.status,
      artifactRole: record.artifactRole ?? null,
      normalizationStatus: record.normalizationStatus ?? 'legacy_unvalidated',
      qualityScore: record.qualityScore ?? record.evaluation?.overallScore ?? null,
      sourceEntryId: record.sourceEntryId ?? null,
      version: record.version,
      title: record.title,
      summary: record.summary,
      saved: Boolean(record.savedAt),
      createdAt: asIsoString(record.createdAt),
      updatedAt: asIsoString(record.updatedAt),
      savedAt: record.savedAt ? asIsoString(record.savedAt) : null,
      payload: record,
    }).returning()

    return mapJournalRow(row)
  }

  static async countJournalEntriesSince(agentId: string, start: string): Promise<number> {
    const [row] = await getDb().select({ value: count() }).from(journalEntries).where(
      and(
        eq(journalEntries.agentId, agentId),
        eq(journalEntries.saved, true),
        gte(journalEntries.createdAt, asIsoString(start))
      )
    )

    return row?.value || 0
  }
}
