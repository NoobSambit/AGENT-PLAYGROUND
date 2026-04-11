import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import {
  profileAnalysisRuns,
  profileInterviewTurns,
  profilePipelineEvents,
} from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type {
  ProfileAnalysisRun,
  ProfileInterviewTurn,
  ProfilePipelineEvent,
} from '@/types/database'

type ProfileAnalysisRunRow = typeof profileAnalysisRuns.$inferSelect
type ProfileInterviewTurnRow = typeof profileInterviewTurns.$inferSelect
type ProfilePipelineEventRow = typeof profilePipelineEvents.$inferSelect

function mapRunRow(row: ProfileAnalysisRunRow): ProfileAnalysisRun {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    completedAt: row.completedAt ? asIsoString(row.completedAt) : undefined,
  }
}

function mapInterviewTurnRow(row: ProfileInterviewTurnRow): ProfileInterviewTurn {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

function mapPipelineEventRow(row: ProfilePipelineEventRow): ProfilePipelineEvent {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

export class ProfileAnalysisRepository {
  static async createRun(record: ProfileAnalysisRun): Promise<ProfileAnalysisRun> {
    const [row] = await getDb().insert(profileAnalysisRuns).values({
      id: record.id,
      agentId: record.agentId,
      status: record.status,
      latestStage: record.latestStage,
      sourceCount: record.sourceCount,
      transcriptCount: record.transcriptCount,
      provider: record.provider ?? null,
      model: record.model ?? null,
      completedAt: record.completedAt ? asIsoString(record.completedAt) : null,
      updatedAt: asIsoString(record.updatedAt),
      payload: record,
      createdAt: asIsoString(record.createdAt),
    }).returning()

    return mapRunRow(row)
  }

  static async updateRun(id: string, record: ProfileAnalysisRun): Promise<ProfileAnalysisRun> {
    const [row] = await getDb().update(profileAnalysisRuns).set({
      status: record.status,
      latestStage: record.latestStage,
      sourceCount: record.sourceCount,
      transcriptCount: record.transcriptCount,
      provider: record.provider ?? null,
      model: record.model ?? null,
      completedAt: record.completedAt ? asIsoString(record.completedAt) : null,
      updatedAt: asIsoString(record.updatedAt),
      payload: record,
    }).where(eq(profileAnalysisRuns.id, id)).returning()

    return mapRunRow(row)
  }

  static async getRun(id: string): Promise<ProfileAnalysisRun | null> {
    const [row] = await getDb()
      .select()
      .from(profileAnalysisRuns)
      .where(eq(profileAnalysisRuns.id, id))

    return row ? mapRunRow(row) : null
  }

  static async listRuns(agentId: string, limitCount = 8): Promise<ProfileAnalysisRun[]> {
    const rows = await getDb()
      .select()
      .from(profileAnalysisRuns)
      .where(eq(profileAnalysisRuns.agentId, agentId))
      .orderBy(desc(profileAnalysisRuns.createdAt))
      .limit(limitCount)

    return rows.map(mapRunRow)
  }

  static async saveInterviewTurn(record: ProfileInterviewTurn): Promise<ProfileInterviewTurn> {
    const [row] = await getDb().insert(profileInterviewTurns).values({
      id: record.id,
      runId: record.runId,
      stage: record.stage,
      order: record.order,
      question: record.question,
      answer: record.answer,
      createdAt: asIsoString(record.createdAt),
      payload: record,
    }).returning()

    return mapInterviewTurnRow(row)
  }

  static async listInterviewTurns(runId: string): Promise<ProfileInterviewTurn[]> {
    const rows = await getDb()
      .select()
      .from(profileInterviewTurns)
      .where(eq(profileInterviewTurns.runId, runId))
      .orderBy(desc(profileInterviewTurns.order))

    return rows.map(mapInterviewTurnRow).reverse()
  }

  static async savePipelineEvent(record: ProfilePipelineEvent): Promise<ProfilePipelineEvent> {
    const [row] = await getDb().insert(profilePipelineEvents).values({
      id: record.id,
      runId: record.runId,
      stage: record.stage,
      status: record.status,
      summary: record.summary,
      createdAt: asIsoString(record.createdAt),
      payload: record,
    }).returning()

    return mapPipelineEventRow(row)
  }

  static async listPipelineEvents(runId: string): Promise<ProfilePipelineEvent[]> {
    const rows = await getDb()
      .select()
      .from(profilePipelineEvents)
      .where(eq(profilePipelineEvents.runId, runId))
      .orderBy(desc(profilePipelineEvents.createdAt))

    return rows.map(mapPipelineEventRow).reverse()
  }
}
