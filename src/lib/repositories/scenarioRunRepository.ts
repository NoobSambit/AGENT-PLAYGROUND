import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { scenarioRuns } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { ScenarioRunRecord } from '@/types/database'

type ScenarioRunRow = typeof scenarioRuns.$inferSelect

function mapScenarioRunRow(row: ScenarioRunRow): ScenarioRunRecord {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
  }
}

function toRow(record: ScenarioRunRecord): typeof scenarioRuns.$inferInsert {
  return {
    id: record.id,
    agentId: record.agentId,
    status: record.status,
    branchKind: record.branchPoint.kind,
    branchRefId: record.branchPoint.id,
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
    payload: record,
  }
}

export class ScenarioRunRepository {
  static async getById(id: string): Promise<ScenarioRunRecord | null> {
    const row = await getDb().query.scenarioRuns.findFirst({
      where: eq(scenarioRuns.id, id),
    })

    return row ? mapScenarioRunRow(row) : null
  }

  static async listByAgent(agentId: string, limitCount = 12): Promise<ScenarioRunRecord[]> {
    const rows = await getDb().query.scenarioRuns.findMany({
      where: eq(scenarioRuns.agentId, agentId),
      orderBy: desc(scenarioRuns.createdAt),
      limit: limitCount,
    })

    return rows.map(mapScenarioRunRow)
  }

  static async upsert(record: ScenarioRunRecord): Promise<ScenarioRunRecord> {
    const [row] = await getDb()
      .insert(scenarioRuns)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: scenarioRuns.id,
        set: toRow(record),
      })
      .returning()

    return mapScenarioRunRow(row)
  }
}
