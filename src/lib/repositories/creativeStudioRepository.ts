import { and, count, desc, eq, gte } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { creativeArtifacts, creativePipelineEvents, creativeSessions } from '@/lib/db/schema'
import { andAll, asIsoString } from '@/lib/db/utils'
import type {
  CreativeArtifact,
  CreativeLibraryItem,
  CreativePipelineEvent,
  CreativeSession,
  CreativeSessionStatus,
} from '@/types/database'

type CreativeSessionRow = typeof creativeSessions.$inferSelect
type CreativeArtifactRow = typeof creativeArtifacts.$inferSelect
type CreativePipelineEventRow = typeof creativePipelineEvents.$inferSelect

function mapSessionRow(row: CreativeSessionRow): CreativeSession {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    publishedAt: row.publishedAt ? asIsoString(row.publishedAt) : undefined,
  }
}

function mapArtifactRow(row: CreativeArtifactRow): CreativeArtifact {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    publishedAt: row.publishedAt ? asIsoString(row.publishedAt) : undefined,
  }
}

function mapPipelineEventRow(row: CreativePipelineEventRow): CreativePipelineEvent {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

export class CreativeStudioRepository {
  static async createSession(record: CreativeSession): Promise<CreativeSession> {
    const [row] = await getDb().insert(creativeSessions).values({
      id: record.id,
      agentId: record.agentId,
      status: record.status,
      format: record.normalizedBrief.format,
      brief: record.brief,
      normalizedBrief: record.normalizedBrief,
      contextPacket: record.contextPacket ?? null,
      latestEvaluation: record.latestEvaluation ?? null,
      draftArtifactId: record.draftArtifactId ?? null,
      finalArtifactId: record.finalArtifactId ?? null,
      publishedArtifactId: record.publishedArtifactId ?? null,
      provider: record.provider ?? null,
      model: record.model ?? null,
      createdAt: asIsoString(record.createdAt),
      updatedAt: asIsoString(record.updatedAt),
      publishedAt: record.publishedAt ? asIsoString(record.publishedAt) : null,
      payload: record,
    }).returning()

    return mapSessionRow(row)
  }

  static async updateSession(id: string, record: CreativeSession): Promise<CreativeSession> {
    const [row] = await getDb().update(creativeSessions).set({
      status: record.status,
      format: record.normalizedBrief.format,
      brief: record.brief,
      normalizedBrief: record.normalizedBrief,
      contextPacket: record.contextPacket ?? null,
      latestEvaluation: record.latestEvaluation ?? null,
      draftArtifactId: record.draftArtifactId ?? null,
      finalArtifactId: record.finalArtifactId ?? null,
      publishedArtifactId: record.publishedArtifactId ?? null,
      provider: record.provider ?? null,
      model: record.model ?? null,
      updatedAt: asIsoString(record.updatedAt),
      publishedAt: record.publishedAt ? asIsoString(record.publishedAt) : null,
      payload: record,
    }).where(eq(creativeSessions.id, id)).returning()

    return mapSessionRow(row)
  }

  static async getSession(id: string): Promise<CreativeSession | null> {
    const row = await getDb().query.creativeSessions.findFirst({
      where: eq(creativeSessions.id, id),
    })

    return row ? mapSessionRow(row) : null
  }

  static async listSessions(agentId: string, options?: {
    status?: CreativeSessionStatus
    limit?: number
  }): Promise<CreativeSession[]> {
    const rows = await getDb().query.creativeSessions.findMany({
      where: andAll([
        eq(creativeSessions.agentId, agentId),
        options?.status ? eq(creativeSessions.status, options.status) : undefined,
      ]),
      orderBy: desc(creativeSessions.createdAt),
      limit: options?.limit,
    })

    return rows.map(mapSessionRow)
  }

  static async countSessionsSince(agentId: string, start: string): Promise<number> {
    const [row] = await getDb().select({ value: count() }).from(creativeSessions).where(
      and(
        eq(creativeSessions.agentId, agentId),
        gte(creativeSessions.createdAt, asIsoString(start))
      )
    )

    return row?.value || 0
  }

  static async saveArtifact(record: CreativeArtifact): Promise<CreativeArtifact> {
    const [row] = await getDb().insert(creativeArtifacts).values({
      id: record.id,
      agentId: record.agentId,
      sessionId: record.sessionId,
      format: record.format,
      status: record.status,
      version: record.version,
      title: record.title,
      summary: record.summary,
      wordCount: record.wordCount,
      published: record.status === 'published',
      provider: record.provider ?? null,
      model: record.model ?? null,
      createdAt: asIsoString(record.createdAt),
      updatedAt: asIsoString(record.updatedAt),
      publishedAt: record.publishedAt ? asIsoString(record.publishedAt) : null,
      payload: record,
    }).returning()

    return mapArtifactRow(row)
  }

  static async updateArtifact(id: string, record: CreativeArtifact): Promise<CreativeArtifact> {
    const [row] = await getDb().update(creativeArtifacts).set({
      format: record.format,
      status: record.status,
      version: record.version,
      title: record.title,
      summary: record.summary,
      wordCount: record.wordCount,
      published: record.status === 'published',
      provider: record.provider ?? null,
      model: record.model ?? null,
      updatedAt: asIsoString(record.updatedAt),
      publishedAt: record.publishedAt ? asIsoString(record.publishedAt) : null,
      payload: record,
    }).where(eq(creativeArtifacts.id, id)).returning()

    return mapArtifactRow(row)
  }

  static async getArtifact(id: string): Promise<CreativeArtifact | null> {
    const row = await getDb().query.creativeArtifacts.findFirst({
      where: eq(creativeArtifacts.id, id),
    })

    return row ? mapArtifactRow(row) : null
  }

  static async listArtifactsForSession(sessionId: string): Promise<CreativeArtifact[]> {
    const rows = await getDb().query.creativeArtifacts.findMany({
      where: eq(creativeArtifacts.sessionId, sessionId),
      orderBy: desc(creativeArtifacts.version),
    })

    return rows.map(mapArtifactRow)
  }

  static async listPublishedLibrary(agentId: string, format?: CreativeArtifact['format']): Promise<CreativeLibraryItem[]> {
    const rows = await getDb().query.creativeArtifacts.findMany({
      where: andAll([
        eq(creativeArtifacts.agentId, agentId),
        eq(creativeArtifacts.published, true),
        format ? eq(creativeArtifacts.format, format) : undefined,
      ]),
      orderBy: desc(creativeArtifacts.createdAt),
    })

    const sessions = await this.listSessions(agentId, { limit: 50 })
    const sessionsById = new Map(sessions.map((session) => [session.id, session]))

    return rows
      .map(mapArtifactRow)
      .map((artifact) => {
        const session = sessionsById.get(artifact.sessionId)
        return session ? { session, artifact } : null
      })
      .filter((entry): entry is CreativeLibraryItem => Boolean(entry))
  }

  static async savePipelineEvent(record: CreativePipelineEvent): Promise<CreativePipelineEvent> {
    const [row] = await getDb().insert(creativePipelineEvents).values({
      id: record.id,
      sessionId: record.sessionId,
      stage: record.stage,
      status: record.status,
      summary: record.summary,
      createdAt: asIsoString(record.createdAt),
      payload: record,
    }).returning()

    return mapPipelineEventRow(row)
  }

  static async listPipelineEvents(sessionId: string): Promise<CreativePipelineEvent[]> {
    const rows = await getDb().query.creativePipelineEvents.findMany({
      where: eq(creativePipelineEvents.sessionId, sessionId),
      orderBy: desc(creativePipelineEvents.createdAt),
    })

    return rows.map(mapPipelineEventRow)
  }
}
