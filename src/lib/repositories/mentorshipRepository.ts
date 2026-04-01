import { desc, eq, or } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { mentorships } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { Mentorship } from '@/types/database'

type MentorshipRow = typeof mentorships.$inferSelect

function mapMentorshipRow(row: MentorshipRow): Mentorship {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
  }
}

function toRow(record: Mentorship): typeof mentorships.$inferInsert {
  return {
    id: record.id,
    mentorId: record.mentorId,
    menteeId: record.menteeId,
    status: record.status,
    currentFocus: record.currentFocus,
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
    payload: record,
  }
}

export class MentorshipRepository {
  static async listAll(): Promise<Mentorship[]> {
    const rows = await getDb().query.mentorships.findMany({
      orderBy: desc(mentorships.createdAt),
    })
    return rows.map(mapMentorshipRow)
  }

  static async getById(id: string): Promise<Mentorship | null> {
    const row = await getDb().query.mentorships.findFirst({
      where: eq(mentorships.id, id),
    })
    return row ? mapMentorshipRow(row) : null
  }

  static async listByAgent(agentId: string): Promise<Mentorship[]> {
    const rows = await getDb().query.mentorships.findMany({
      where: or(eq(mentorships.mentorId, agentId), eq(mentorships.menteeId, agentId)),
      orderBy: desc(mentorships.createdAt),
    })
    return rows.map(mapMentorshipRow)
  }

  static async upsert(record: Mentorship): Promise<Mentorship> {
    const [row] = await getDb()
      .insert(mentorships)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: mentorships.id,
        set: toRow(record),
      })
      .returning()

    return mapMentorshipRow(row)
  }
}
