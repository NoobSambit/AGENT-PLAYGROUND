import { and, count, desc, eq, gte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { dreamPipelineEvents, dreams, dreamSessions } from '@/lib/db/schema'
import { andAll, asIsoString } from '@/lib/db/utils'
import type {
  Dream,
  DreamPipelineEvent,
  DreamSession,
  DreamSessionStatus,
  DreamType,
} from '@/types/database'

type DreamSessionRow = typeof dreamSessions.$inferSelect
type DreamRow = typeof dreams.$inferSelect
type DreamPipelineEventRow = typeof dreamPipelineEvents.$inferSelect

function mapSessionRow(row: DreamSessionRow): DreamSession {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    savedAt: row.savedAt ? asIsoString(row.savedAt) : undefined,
  }
}

function mapDreamRow(row: DreamRow): Dream {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    savedAt: row.savedAt ? asIsoString(row.savedAt) : undefined,
  }
}

function mapPipelineRow(row: DreamPipelineEventRow): DreamPipelineEvent {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

export class DreamWorkspaceRepository {
  static async createSession(record: DreamSession): Promise<DreamSession> {
    const [row] = await getDb().insert(dreamSessions).values({
      id: record.id,
      agentId: record.agentId,
      status: record.status,
      latestStage: record.latestStage,
      type: record.type,
      normalizedInput: record.normalizedInput,
      contextPacket: record.contextPacket ?? null,
      latestEvaluation: record.latestEvaluation ?? null,
      finalDreamId: record.finalDreamId ?? null,
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

  static async updateSession(id: string, record: DreamSession): Promise<DreamSession> {
    const [row] = await getDb().update(dreamSessions).set({
      status: record.status,
      latestStage: record.latestStage,
      type: record.type,
      normalizedInput: record.normalizedInput,
      contextPacket: record.contextPacket ?? null,
      latestEvaluation: record.latestEvaluation ?? null,
      finalDreamId: record.finalDreamId ?? null,
      provider: record.provider ?? null,
      model: record.model ?? null,
      failureReason: record.failureReason ?? null,
      updatedAt: asIsoString(record.updatedAt),
      savedAt: record.savedAt ? asIsoString(record.savedAt) : null,
      payload: record,
    }).where(eq(dreamSessions.id, id)).returning()

    return mapSessionRow(row)
  }

  static async getSession(id: string): Promise<DreamSession | null> {
    const row = await getDb().query.dreamSessions.findFirst({
      where: eq(dreamSessions.id, id),
    })
    return row ? mapSessionRow(row) : null
  }

  static async listSessions(agentId: string, options?: {
    status?: DreamSessionStatus
    limit?: number
  }): Promise<DreamSession[]> {
    const rows = await getDb().query.dreamSessions.findMany({
      where: andAll([
        eq(dreamSessions.agentId, agentId),
        options?.status ? eq(dreamSessions.status, options.status) : undefined,
      ]),
      orderBy: desc(dreamSessions.createdAt),
      limit: options?.limit,
    })
    return rows.map(mapSessionRow)
  }

  static async countSessionsSince(agentId: string, start: string): Promise<number> {
    const [row] = await getDb().select({ value: count() }).from(dreamSessions).where(
      and(eq(dreamSessions.agentId, agentId), gte(dreamSessions.createdAt, asIsoString(start)))
    )
    return row?.value || 0
  }

  static async saveDream(record: Dream): Promise<Dream> {
    const [row] = await getDb().insert(dreams).values({
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
    return mapDreamRow(row)
  }

  static async updateDream(id: string, record: Dream): Promise<Dream> {
    const [row] = await getDb().update(dreams).set({
      sessionId: record.sessionId,
      type: record.type,
      status: record.status,
      version: record.version,
      title: record.title,
      summary: record.summary,
      saved: Boolean(record.savedAt),
      updatedAt: asIsoString(record.updatedAt),
      savedAt: record.savedAt ? asIsoString(record.savedAt) : null,
      payload: record,
    }).where(eq(dreams.id, id)).returning()
    return mapDreamRow(row)
  }

  static async getDream(id: string): Promise<Dream | null> {
    const row = await getDb().query.dreams.findFirst({
      where: eq(dreams.id, id),
    })
    return row ? mapDreamRow(row) : null
  }

  static async listDreamsForSession(sessionId: string): Promise<Dream[]> {
    const rows = await getDb().query.dreams.findMany({
      where: eq(dreams.sessionId, sessionId),
      orderBy: desc(dreams.version),
    })
    return rows.map(mapDreamRow)
  }

  static async listDreamsForAgent(agentId: string, options?: {
    type?: DreamType
    status?: Dream['status']
    savedOnly?: boolean
    limit?: number
  }): Promise<Dream[]> {
    const rows = await getDb().query.dreams.findMany({
      where: andAll([
        eq(dreams.agentId, agentId),
        options?.type ? eq(dreams.type, options.type) : undefined,
        options?.status ? eq(dreams.status, options.status) : undefined,
        options?.savedOnly ? eq(dreams.saved, true) : undefined,
      ]),
      orderBy: desc(dreams.createdAt),
      limit: options?.limit,
    })
    return rows.map(mapDreamRow)
  }

  static async countSavedDreams(agentId: string): Promise<number> {
    const [row] = await getDb().select({ value: count() }).from(dreams).where(
      and(eq(dreams.agentId, agentId), eq(dreams.saved, true))
    )
    return row?.value || 0
  }

  static async savePipelineEvent(record: DreamPipelineEvent): Promise<DreamPipelineEvent> {
    const [row] = await getDb().insert(dreamPipelineEvents).values({
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

  static async listPipelineEvents(sessionId: string): Promise<DreamPipelineEvent[]> {
    const rows = await getDb().query.dreamPipelineEvents.findMany({
      where: eq(dreamPipelineEvents.sessionId, sessionId),
      orderBy: desc(dreamPipelineEvents.createdAt),
    })
    return rows.map(mapPipelineRow)
  }
}
