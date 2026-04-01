import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { simulations } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { SimulationRecord } from '@/types/database'

type SimulationRow = typeof simulations.$inferSelect

function mapSimulationRow(row: SimulationRow): SimulationRecord {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

function toRow(record: SimulationRecord): typeof simulations.$inferInsert {
  return {
    id: record.id,
    agentIds: record.agents.map((agent) => agent.id),
    createdAt: asIsoString(record.createdAt),
    payload: record,
  }
}

export class SimulationRepository {
  static async getById(id: string): Promise<SimulationRecord | null> {
    const row = await getDb().query.simulations.findFirst({
      where: eq(simulations.id, id),
    })
    return row ? mapSimulationRow(row) : null
  }

  static async listRecent(limitCount: number): Promise<SimulationRecord[]> {
    const rows = await getDb().query.simulations.findMany({
      orderBy: desc(simulations.createdAt),
      limit: limitCount,
    })
    return rows.map(mapSimulationRow)
  }

  static async listAll(): Promise<SimulationRecord[]> {
    const rows = await getDb().query.simulations.findMany({
      orderBy: desc(simulations.createdAt),
    })
    return rows.map(mapSimulationRow)
  }

  static async upsert(record: SimulationRecord): Promise<SimulationRecord> {
    const [row] = await getDb()
      .insert(simulations)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: simulations.id,
        set: toRow(record),
      })
      .returning()

    return mapSimulationRow(row)
  }

  static async delete(id: string): Promise<boolean> {
    const [row] = await getDb()
      .delete(simulations)
      .where(eq(simulations.id, id))
      .returning({ id: simulations.id })

    return Boolean(row)
  }
}
