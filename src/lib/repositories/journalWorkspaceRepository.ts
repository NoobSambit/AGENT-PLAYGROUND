import { and, count, desc, eq, gte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { journalEntries, journalPipelineEvents, journalSessions } from '@/lib/db/schema'
import { andAll, asIsoString } from '@/lib/db/utils'
import type {
  JournalEntry,
  JournalEntryStatus,
  JournalEntryType,
  JournalPipelineEvent,
  JournalSession,
  JournalSessionStatus,
} from '@/types/database'

type JournalSessionRow = typeof journalSessions.$inferSelect
type JournalEntryRow = typeof journalEntries.$inferSelect
type JournalPipelineEventRow = typeof journalPipelineEvents.$inferSelect

function mapSessionRow(row: JournalSessionRow): JournalSession {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    savedAt: row.savedAt ? asIsoString(row.savedAt) : undefined,
  }
}

function mapEntryRow(row: JournalEntryRow): JournalEntry {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    savedAt: row.savedAt ? asIsoString(row.savedAt) : undefined,
  }
}

function mapPipelineRow(row: JournalPipelineEventRow): JournalPipelineEvent {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

export class JournalWorkspaceRepository {
  static async createSession(record: JournalSession): Promise<JournalSession> {
    const [row] = await getDb().insert(journalSessions).values({
      id: record.id,
      agentId: record.agentId,
      status: record.status,
      latestStage: record.latestStage,
      type: record.type,
      normalizedInput: record.normalizedInput,
      contextPacket: record.contextPacket ?? null,
      voicePacket: record.voicePacket ?? null,
      latestEvaluation: record.latestEvaluation ?? null,
      finalEntryId: record.finalEntryId ?? null,
      provider: record.provider ?? null,
      model: record.model ?? null,
      failureReason: record.failureReason ?? null,
      createdAt: asIsoString(record.createdAt),
      updatedAt: asIsoString(record.updatedAt),
      savedAt: record.savedAt ? asIsoString(record.savedAt) : null,
      payload: record,
    }).returning()

    return mapSessionRow(row)
  }

  static async updateSession(id: string, record: JournalSession): Promise<JournalSession> {
    const [row] = await getDb().update(journalSessions).set({
      status: record.status,
      latestStage: record.latestStage,
      type: record.type,
      normalizedInput: record.normalizedInput,
      contextPacket: record.contextPacket ?? null,
      voicePacket: record.voicePacket ?? null,
      latestEvaluation: record.latestEvaluation ?? null,
      finalEntryId: record.finalEntryId ?? null,
      provider: record.provider ?? null,
      model: record.model ?? null,
      failureReason: record.failureReason ?? null,
      updatedAt: asIsoString(record.updatedAt),
      savedAt: record.savedAt ? asIsoString(record.savedAt) : null,
      payload: record,
    }).where(eq(journalSessions.id, id)).returning()

    return mapSessionRow(row)
  }

  static async getSession(id: string): Promise<JournalSession | null> {
    const row = await getDb().query.journalSessions.findFirst({
      where: eq(journalSessions.id, id),
    })
    return row ? mapSessionRow(row) : null
  }

  static async listSessions(agentId: string, options?: {
    status?: JournalSessionStatus
    limit?: number
  }): Promise<JournalSession[]> {
    const rows = await getDb().query.journalSessions.findMany({
      where: andAll([
        eq(journalSessions.agentId, agentId),
        options?.status ? eq(journalSessions.status, options.status) : undefined,
      ]),
      orderBy: desc(journalSessions.createdAt),
      limit: options?.limit,
    })

    return rows.map(mapSessionRow)
  }

  static async countSessionsSince(agentId: string, start: string): Promise<number> {
    const [row] = await getDb().select({ value: count() }).from(journalSessions).where(
      and(eq(journalSessions.agentId, agentId), gte(journalSessions.createdAt, asIsoString(start)))
    )

    return row?.value || 0
  }

  static async saveEntry(record: JournalEntry): Promise<JournalEntry> {
    const [row] = await getDb().insert(journalEntries).values({
      id: record.id,
      agentId: record.agentId,
      sessionId: record.sessionId,
      type: record.type,
      status: record.status,
      version: record.version,
      title: record.title,
      summary: record.summary,
      saved: Boolean(record.savedAt),
      createdAt: asIsoString(record.createdAt),
      updatedAt: asIsoString(record.updatedAt),
      savedAt: record.savedAt ? asIsoString(record.savedAt) : null,
      payload: record,
    }).returning()

    return mapEntryRow(row)
  }

  static async updateEntry(id: string, record: JournalEntry): Promise<JournalEntry> {
    const [row] = await getDb().update(journalEntries).set({
      type: record.type,
      status: record.status,
      version: record.version,
      title: record.title,
      summary: record.summary,
      saved: Boolean(record.savedAt),
      updatedAt: asIsoString(record.updatedAt),
      savedAt: record.savedAt ? asIsoString(record.savedAt) : null,
      payload: record,
    }).where(eq(journalEntries.id, id)).returning()

    return mapEntryRow(row)
  }

  static async getEntry(id: string): Promise<JournalEntry | null> {
    const row = await getDb().query.journalEntries.findFirst({
      where: eq(journalEntries.id, id),
    })
    return row ? mapEntryRow(row) : null
  }

  static async listEntriesForSession(sessionId: string): Promise<JournalEntry[]> {
    const rows = await getDb().query.journalEntries.findMany({
      where: eq(journalEntries.sessionId, sessionId),
      orderBy: desc(journalEntries.version),
    })
    return rows.map(mapEntryRow)
  }

  static async listEntriesForAgent(agentId: string, options?: {
    type?: JournalEntryType
    status?: JournalEntryStatus
    savedOnly?: boolean
    limit?: number
  }): Promise<JournalEntry[]> {
    const rows = await getDb().query.journalEntries.findMany({
      where: andAll([
        eq(journalEntries.agentId, agentId),
        options?.type ? eq(journalEntries.type, options.type) : undefined,
        options?.status ? eq(journalEntries.status, options.status) : undefined,
        options?.savedOnly ? eq(journalEntries.saved, true) : undefined,
      ]),
      orderBy: desc(journalEntries.createdAt),
      limit: options?.limit,
    })
    return rows.map(mapEntryRow)
  }

  static async countSavedEntries(agentId: string): Promise<number> {
    const [row] = await getDb().select({ value: count() }).from(journalEntries).where(
      and(eq(journalEntries.agentId, agentId), eq(journalEntries.saved, true))
    )

    return row?.value || 0
  }

  static async savePipelineEvent(record: JournalPipelineEvent): Promise<JournalPipelineEvent> {
    const [row] = await getDb().insert(journalPipelineEvents).values({
      id: record.id,
      sessionId: record.sessionId,
      stage: record.stage,
      status: record.status,
      summary: record.summary,
      createdAt: asIsoString(record.createdAt),
      payload: record,
    }).returning()

    return mapPipelineRow(row)
  }

  static async listPipelineEvents(sessionId: string): Promise<JournalPipelineEvent[]> {
    const rows = await getDb().query.journalPipelineEvents.findMany({
      where: eq(journalPipelineEvents.sessionId, sessionId),
      orderBy: desc(journalPipelineEvents.createdAt),
    })
    return rows.map(mapPipelineRow)
  }
}
