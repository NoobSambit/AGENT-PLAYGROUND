import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { agents } from '@/lib/db/schema'
import { asIsoString, compact } from '@/lib/db/utils'
import type { AgentRecord } from '@/types/database'

type AgentRow = typeof agents.$inferSelect

function mapAgentRow(row: AgentRow): AgentRecord {
  return {
    id: row.id,
    name: row.name,
    persona: row.persona,
    goals: row.goals || [],
    status: row.status as AgentRecord['status'],
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    userId: row.userId || undefined,
    settings: row.settings || undefined,
    coreTraits: row.coreTraits || {},
    dynamicTraits: row.dynamicTraits || {},
    memoryCount: row.memoryCount,
    totalInteractions: row.totalInteractions,
    linguisticProfile: row.linguisticProfile || undefined,
    emotionalProfile: row.emotionalProfile || undefined,
    emotionalState: row.emotionalState || undefined,
    emotionalHistory: row.emotionalHistory || [],
    stats: row.stats || undefined,
    psychologicalProfile: row.psychologicalProfile || undefined,
    relationshipCount: row.relationshipCount,
    creativeWorks: row.creativeWorks,
    dreamCount: row.dreamCount,
    journalCount: row.journalCount,
    challengesCompleted: row.challengesCompleted,
    challengeWins: row.challengeWins,
    mentorshipStats: row.mentorshipStats || undefined,
  }
}

function toAgentInsert(agent: AgentRecord): typeof agents.$inferInsert {
  return {
    id: agent.id,
    name: agent.name,
    persona: agent.persona,
    goals: agent.goals || [],
    status: agent.status,
    createdAt: asIsoString(agent.createdAt),
    updatedAt: asIsoString(agent.updatedAt),
    userId: agent.userId,
    settings: agent.settings ?? null,
    coreTraits: agent.coreTraits || {},
    dynamicTraits: agent.dynamicTraits || {},
    memoryCount: agent.memoryCount || 0,
    totalInteractions: agent.totalInteractions || 0,
    linguisticProfile: agent.linguisticProfile ?? null,
    emotionalProfile: agent.emotionalProfile ?? null,
    emotionalState: agent.emotionalState ?? null,
    emotionalHistory: agent.emotionalHistory || [],
    stats: agent.stats ?? null,
    psychologicalProfile: agent.psychologicalProfile ?? null,
    relationshipCount: agent.relationshipCount || 0,
    creativeWorks: agent.creativeWorks || 0,
    dreamCount: agent.dreamCount || 0,
    journalCount: agent.journalCount || 0,
    challengesCompleted: agent.challengesCompleted || 0,
    challengeWins: agent.challengeWins || 0,
    mentorshipStats: agent.mentorshipStats ?? null,
  }
}

function toAgentUpdate(updates: Partial<AgentRecord>): Partial<typeof agents.$inferInsert> {
  return compact({
    name: updates.name,
    persona: updates.persona,
    goals: updates.goals,
    status: updates.status,
    userId: updates.userId,
    settings: 'settings' in updates ? updates.settings ?? null : undefined,
    coreTraits: updates.coreTraits,
    dynamicTraits: updates.dynamicTraits,
    memoryCount: updates.memoryCount,
    totalInteractions: updates.totalInteractions,
    linguisticProfile: 'linguisticProfile' in updates ? updates.linguisticProfile ?? null : undefined,
    emotionalProfile: 'emotionalProfile' in updates ? updates.emotionalProfile ?? null : undefined,
    emotionalState: 'emotionalState' in updates ? updates.emotionalState ?? null : undefined,
    emotionalHistory: updates.emotionalHistory,
    stats: 'stats' in updates ? updates.stats ?? null : undefined,
    psychologicalProfile: 'psychologicalProfile' in updates ? updates.psychologicalProfile ?? null : undefined,
    relationshipCount: updates.relationshipCount,
    creativeWorks: updates.creativeWorks,
    dreamCount: updates.dreamCount,
    journalCount: updates.journalCount,
    challengesCompleted: updates.challengesCompleted,
    challengeWins: updates.challengeWins,
    mentorshipStats: 'mentorshipStats' in updates ? updates.mentorshipStats ?? null : undefined,
    updatedAt: asIsoString(updates.updatedAt),
  })
}

export class AgentRepository {
  static async listAll(): Promise<AgentRecord[]> {
    const rows = await getDb().select().from(agents).orderBy(desc(agents.createdAt))
    return rows.map(mapAgentRow)
  }

  static async listByStatus(status: AgentRecord['status']): Promise<AgentRecord[]> {
    const rows = await getDb()
      .select()
      .from(agents)
      .where(eq(agents.status, status))
      .orderBy(desc(agents.createdAt))
    return rows.map(mapAgentRow)
  }

  static async getById(id: string): Promise<AgentRecord | null> {
    const row = await getDb().query.agents.findFirst({
      where: eq(agents.id, id),
    })
    return row ? mapAgentRow(row) : null
  }

  static async upsert(agent: AgentRecord): Promise<AgentRecord> {
    const [row] = await getDb()
      .insert(agents)
      .values(toAgentInsert(agent))
      .onConflictDoUpdate({
        target: agents.id,
        set: toAgentInsert(agent),
      })
      .returning()

    return mapAgentRow(row)
  }

  static async create(agent: AgentRecord): Promise<AgentRecord> {
    const [row] = await getDb().insert(agents).values(toAgentInsert(agent)).returning()
    return mapAgentRow(row)
  }

  static async update(id: string, updates: Partial<AgentRecord>): Promise<boolean> {
    const updateValues = toAgentUpdate({
      ...updates,
      updatedAt: updates.updatedAt || new Date().toISOString(),
    })

    const [row] = await getDb()
      .update(agents)
      .set(updateValues)
      .where(eq(agents.id, id))
      .returning({ id: agents.id })

    return Boolean(row)
  }

  static async delete(id: string): Promise<boolean> {
    const [row] = await getDb()
      .delete(agents)
      .where(eq(agents.id, id))
      .returning({ id: agents.id })

    return Boolean(row)
  }
}
