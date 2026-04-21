import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { arenaEvents, arenaRuns } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { ArenaEvent, ArenaRun, ArenaRunSummary } from '@/types/database'

type ArenaRunRow = typeof arenaRuns.$inferSelect
type ArenaEventRow = typeof arenaEvents.$inferSelect

function mapArenaRunRow(row: ArenaRunRow): ArenaRun {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    completedAt: row.completedAt ? asIsoString(row.completedAt) : undefined,
  }
}

function mapArenaEventRow(row: ArenaEventRow): ArenaEvent {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

function toArenaRunSummary(run: ArenaRun): ArenaRunSummary {
  return {
    id: run.id,
    status: run.status,
    latestStage: run.latestStage,
    topic: run.config.topic,
    objective: run.config.objective,
    participantNames: run.participants.map((participant) => participant.name),
    roundCount: run.config.roundCount,
    currentRound: run.currentRound,
    winnerAgentName: run.participants.find((participant) => participant.id === run.winnerAgentId)?.name,
    eventCount: run.eventCount,
    provider: run.provider,
    model: run.model,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
  }
}

export class ArenaRepository {
  static async upsertRun(record: ArenaRun): Promise<ArenaRun> {
    const [row] = await getDb()
      .insert(arenaRuns)
      .values({
        id: record.id,
        status: record.status,
        latestStage: record.latestStage,
        participantIds: record.participantIds,
        sandboxed: record.sandboxed,
        cancellationRequested: record.cancellationRequested,
        roundCount: record.config.roundCount,
        currentRound: record.currentRound,
        eventCount: record.eventCount,
        winnerAgentId: record.winnerAgentId ?? null,
        provider: record.provider ?? null,
        model: record.model ?? null,
        failureReason: record.failureReason ?? null,
        createdAt: asIsoString(record.createdAt),
        updatedAt: asIsoString(record.updatedAt),
        completedAt: record.completedAt ? asIsoString(record.completedAt) : null,
        payload: record,
      })
      .onConflictDoUpdate({
        target: arenaRuns.id,
        set: {
          status: record.status,
          latestStage: record.latestStage,
          participantIds: record.participantIds,
          sandboxed: record.sandboxed,
          cancellationRequested: record.cancellationRequested,
          roundCount: record.config.roundCount,
          currentRound: record.currentRound,
          eventCount: record.eventCount,
          winnerAgentId: record.winnerAgentId ?? null,
          provider: record.provider ?? null,
          model: record.model ?? null,
          failureReason: record.failureReason ?? null,
          updatedAt: asIsoString(record.updatedAt),
          completedAt: record.completedAt ? asIsoString(record.completedAt) : null,
          payload: record,
        },
      })
      .returning()

    return mapArenaRunRow(row)
  }

  static async getRun(id: string): Promise<ArenaRun | null> {
    const row = await getDb().query.arenaRuns.findFirst({
      where: eq(arenaRuns.id, id),
    })

    return row ? mapArenaRunRow(row) : null
  }

  static async listRecent(limitCount: number): Promise<ArenaRunSummary[]> {
    const rows = await getDb().query.arenaRuns.findMany({
      orderBy: desc(arenaRuns.createdAt),
      limit: limitCount,
    })

    return rows.map(mapArenaRunRow).map(toArenaRunSummary)
  }

  static async saveEvent(record: ArenaEvent): Promise<ArenaEvent> {
    const [row] = await getDb()
      .insert(arenaEvents)
      .values({
        id: record.id,
        runId: record.runId,
        sequence: record.sequence,
        stage: record.stage,
        kind: record.kind,
        speakerType: record.speakerType,
        speakerAgentId: record.speakerAgentId ?? null,
        round: record.round ?? null,
        createdAt: asIsoString(record.createdAt),
        payload: record,
      })
      .onConflictDoUpdate({
        target: arenaEvents.id,
        set: {
          sequence: record.sequence,
          stage: record.stage,
          kind: record.kind,
          speakerType: record.speakerType,
          speakerAgentId: record.speakerAgentId ?? null,
          round: record.round ?? null,
          createdAt: asIsoString(record.createdAt),
          payload: record,
        },
      })
      .returning()

    return mapArenaEventRow(row)
  }

  static async listEvents(runId: string): Promise<ArenaEvent[]> {
    const rows = await getDb().query.arenaEvents.findMany({
      where: eq(arenaEvents.runId, runId),
      orderBy: (fields, { asc }) => [asc(fields.sequence)],
    })

    return rows.map(mapArenaEventRow)
  }
}
