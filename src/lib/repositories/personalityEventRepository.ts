import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { agentPersonalityEvents } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { PersonalityEventRecord } from '@/types/database'

type PersonalityEventRow = typeof agentPersonalityEvents.$inferSelect

function mapPersonalityEventRow(row: PersonalityEventRow): PersonalityEventRecord {
  return {
    id: row.id,
    agentId: row.agentId,
    source: row.source as PersonalityEventRecord['source'],
    trigger: row.trigger,
    summary: row.summary,
    traitDeltas: row.traitDeltas || [],
    beforeTraits: row.beforeTraits || undefined,
    afterTraits: row.afterTraits || undefined,
    linkedMessageIds: row.linkedMessageIds || [],
    metadata: row.metadata || undefined,
    createdAt: asIsoString(row.createdAt),
  }
}

export class PersonalityEventRepository {
  static async listByAgent(agentId: string, limitCount: number = 20): Promise<PersonalityEventRecord[]> {
    const rows = await getDb().query.agentPersonalityEvents.findMany({
      where: eq(agentPersonalityEvents.agentId, agentId),
      orderBy: desc(agentPersonalityEvents.createdAt),
      limit: limitCount,
    })

    return rows.map(mapPersonalityEventRow)
  }

  static async getLatestByAgent(agentId: string): Promise<PersonalityEventRecord | null> {
    const row = await getDb().query.agentPersonalityEvents.findFirst({
      where: eq(agentPersonalityEvents.agentId, agentId),
      orderBy: desc(agentPersonalityEvents.createdAt),
    })

    return row ? mapPersonalityEventRow(row) : null
  }

  static async create(record: PersonalityEventRecord): Promise<PersonalityEventRecord> {
    const [row] = await getDb().insert(agentPersonalityEvents).values({
      id: record.id,
      agentId: record.agentId,
      source: record.source,
      trigger: record.trigger,
      summary: record.summary,
      traitDeltas: record.traitDeltas,
      beforeTraits: record.beforeTraits ?? null,
      afterTraits: record.afterTraits ?? null,
      linkedMessageIds: record.linkedMessageIds || [],
      metadata: record.metadata ?? null,
      createdAt: asIsoString(record.createdAt),
    }).returning()

    return mapPersonalityEventRow(row)
  }
}
