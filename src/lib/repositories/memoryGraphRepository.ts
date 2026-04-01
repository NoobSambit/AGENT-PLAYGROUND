import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { memoryGraphs } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { MemoryGraph } from '@/types/database'

export class MemoryGraphRepository {
  static async getByAgentId(agentId: string): Promise<MemoryGraph | null> {
    const row = await getDb().query.memoryGraphs.findFirst({
      where: eq(memoryGraphs.agentId, agentId),
    })

    if (!row) {
      return null
    }

    return {
      ...row.payload,
      agentId,
      lastUpdated: asIsoString(row.updatedAt),
    }
  }

  static async upsert(graph: MemoryGraph): Promise<MemoryGraph> {
    const [row] = await getDb()
      .insert(memoryGraphs)
      .values({
        agentId: graph.agentId,
        payload: graph,
        updatedAt: asIsoString(graph.lastUpdated),
      })
      .onConflictDoUpdate({
        target: memoryGraphs.agentId,
        set: {
          payload: graph,
          updatedAt: asIsoString(graph.lastUpdated),
        },
      })
      .returning()

    return {
      ...row.payload,
      agentId: row.agentId,
      lastUpdated: asIsoString(row.updatedAt),
    }
  }
}
