import { and, desc, eq, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { challengeEvents, challengeParticipantResults, challengeRuns } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type {
  ChallengeEvent,
  ChallengeParticipantResult,
  ChallengeRun,
  ChallengeRunSummary,
  ChallengeTemplate,
} from '@/types/database'

type ChallengeRunRow = typeof challengeRuns.$inferSelect
type ChallengeEventRow = typeof challengeEvents.$inferSelect
type ChallengeResultRow = typeof challengeParticipantResults.$inferSelect

function mapRunRow(row: ChallengeRunRow): ChallengeRun {
  return {
    ...row.payload,
    id: row.id,
    primaryAgentId: row.primaryAgentId,
    mode: row.mode as ChallengeRun['mode'],
    templateId: row.templateId as ChallengeRun['templateId'],
    status: row.status as ChallengeRun['status'],
    latestStage: row.latestStage as ChallengeRun['latestStage'],
    participantIds: row.participantIds,
    eventCount: row.eventCount,
    qualityStatus: row.qualityStatus as ChallengeRun['qualityStatus'],
    qualityScore: row.qualityScore ?? undefined,
    winnerAgentId: row.winnerAgentId ?? undefined,
    provider: row.provider ?? undefined,
    model: row.model ?? undefined,
    failureReason: row.failureReason ?? undefined,
    cancellationRequested: row.cancellationRequested,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    completedAt: row.completedAt ? asIsoString(row.completedAt) : undefined,
  }
}

function mapEventRow(row: ChallengeEventRow): ChallengeEvent {
  return {
    ...row.payload,
    id: row.id,
    runId: row.runId,
    sequence: row.sequence,
    stage: row.stage as ChallengeEvent['stage'],
    kind: row.kind as ChallengeEvent['kind'],
    speakerType: row.speakerType as ChallengeEvent['speakerType'],
    speakerAgentId: row.speakerAgentId ?? undefined,
    createdAt: asIsoString(row.createdAt),
  }
}

function mapResultRow(row: ChallengeResultRow): ChallengeParticipantResult {
  return {
    ...row.payload,
    id: row.id,
    runId: row.runId,
    agentId: row.agentId,
    templateId: row.templateId as ChallengeParticipantResult['templateId'],
    mode: row.mode as ChallengeParticipantResult['mode'],
    outcome: row.outcome as ChallengeParticipantResult['outcome'],
    totalScore: row.totalScore,
    capabilityScore: row.capabilityScore,
    relationshipScore: row.relationshipScore ?? undefined,
    createdAt: asIsoString(row.createdAt),
    payload: row.payload.payload || row.payload,
  }
}

export function toChallengeRunSummary(run: ChallengeRun, templates: ChallengeTemplate[]): ChallengeRunSummary {
  const template = templates.find((entry) => entry.id === run.templateId)
  return {
    id: run.id,
    status: run.status,
    latestStage: run.latestStage,
    mode: run.mode,
    templateId: run.templateId,
    templateTitle: template?.title || run.templateId,
    participantNames: run.participants.map((participant) => participant.name),
    qualityScore: run.qualityScore,
    winnerAgentName: run.participants.find((participant) => participant.id === run.winnerAgentId)?.name,
    eventCount: run.eventCount,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
  }
}

export class ChallengeLabRepository {
  static async upsertRun(record: ChallengeRun): Promise<ChallengeRun> {
    const rowValue = {
      id: record.id,
      primaryAgentId: record.primaryAgentId,
      mode: record.mode,
      templateId: record.templateId,
      status: record.status,
      latestStage: record.latestStage,
      participantIds: record.participantIds,
      eventCount: record.eventCount,
      qualityStatus: record.qualityStatus,
      qualityScore: record.qualityScore ?? null,
      winnerAgentId: record.winnerAgentId ?? null,
      provider: record.provider ?? null,
      model: record.model ?? null,
      failureReason: record.failureReason ?? null,
      cancellationRequested: record.cancellationRequested,
      createdAt: asIsoString(record.createdAt),
      updatedAt: asIsoString(record.updatedAt),
      completedAt: record.completedAt ? asIsoString(record.completedAt) : null,
      payload: record,
    }

    const [row] = await getDb()
      .insert(challengeRuns)
      .values(rowValue)
      .onConflictDoUpdate({
        target: challengeRuns.id,
        set: {
          ...rowValue,
          createdAt: asIsoString(record.createdAt),
        },
      })
      .returning()

    return mapRunRow(row)
  }

  static async getRun(id: string): Promise<ChallengeRun | null> {
    const row = await getDb().query.challengeRuns.findFirst({
      where: eq(challengeRuns.id, id),
    })
    return row ? mapRunRow(row) : null
  }

  static async listRecentForAgent(agentId: string, limitCount: number): Promise<ChallengeRun[]> {
    const rows = await getDb()
      .select()
      .from(challengeRuns)
      .where(sql`${agentId} = ANY(${challengeRuns.participantIds})`)
      .orderBy(desc(challengeRuns.updatedAt))
      .limit(limitCount)

    return rows.map(mapRunRow)
  }

  static async getActiveRunForAgent(agentId: string): Promise<ChallengeRun | null> {
    const rows = await getDb()
      .select()
      .from(challengeRuns)
      .where(and(
        eq(challengeRuns.status, 'running'),
        sql`${agentId} = ANY(${challengeRuns.participantIds})`
      ))
      .orderBy(desc(challengeRuns.updatedAt))
      .limit(1)

    return rows[0] ? mapRunRow(rows[0]) : null
  }

  static async saveEvent(record: ChallengeEvent): Promise<ChallengeEvent> {
    const [row] = await getDb()
      .insert(challengeEvents)
      .values({
        id: record.id,
        runId: record.runId,
        sequence: record.sequence,
        stage: record.stage,
        kind: record.kind,
        speakerType: record.speakerType,
        speakerAgentId: record.speakerAgentId ?? null,
        createdAt: asIsoString(record.createdAt),
        payload: record,
      })
      .onConflictDoUpdate({
        target: challengeEvents.id,
        set: {
          sequence: record.sequence,
          stage: record.stage,
          kind: record.kind,
          speakerType: record.speakerType,
          speakerAgentId: record.speakerAgentId ?? null,
          createdAt: asIsoString(record.createdAt),
          payload: record,
        },
      })
      .returning()

    return mapEventRow(row)
  }

  static async listEvents(runId: string): Promise<ChallengeEvent[]> {
    const rows = await getDb().query.challengeEvents.findMany({
      where: eq(challengeEvents.runId, runId),
      orderBy: (fields, { asc }) => [asc(fields.sequence)],
    })
    return rows.map(mapEventRow)
  }

  static async saveParticipantResult(record: ChallengeParticipantResult): Promise<ChallengeParticipantResult> {
    const [row] = await getDb()
      .insert(challengeParticipantResults)
      .values({
        id: record.id,
        runId: record.runId,
        agentId: record.agentId,
        templateId: record.templateId,
        mode: record.mode,
        outcome: record.outcome,
        totalScore: record.totalScore,
        capabilityScore: record.capabilityScore,
        relationshipScore: record.relationshipScore ?? null,
        createdAt: asIsoString(record.createdAt),
        payload: record,
      })
      .onConflictDoUpdate({
        target: challengeParticipantResults.id,
        set: {
          outcome: record.outcome,
          totalScore: record.totalScore,
          capabilityScore: record.capabilityScore,
          relationshipScore: record.relationshipScore ?? null,
          payload: record,
        },
      })
      .returning()

    return mapResultRow(row)
  }

  static async listParticipantResults(runId: string): Promise<ChallengeParticipantResult[]> {
    const rows = await getDb().query.challengeParticipantResults.findMany({
      where: eq(challengeParticipantResults.runId, runId),
      orderBy: (fields, { asc }) => [asc(fields.createdAt)],
    })
    return rows.map(mapResultRow)
  }

  static async listResultHistory(agentId: string, limitCount: number): Promise<ChallengeParticipantResult[]> {
    const rows = await getDb().query.challengeParticipantResults.findMany({
      where: eq(challengeParticipantResults.agentId, agentId),
      orderBy: desc(challengeParticipantResults.createdAt),
      limit: limitCount,
    })
    return rows.map(mapResultRow)
  }
}
