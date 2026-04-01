import { desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { challenges } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'
import type { Challenge } from '@/types/database'

type ChallengeRow = typeof challenges.$inferSelect

function mapChallengeRow(row: ChallengeRow): Challenge {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
  }
}

function toRow(record: Challenge): typeof challenges.$inferInsert {
  return {
    id: record.id,
    type: record.type,
    status: record.status,
    participantIds: record.participants,
    createdAt: asIsoString(record.createdAt),
    payload: record,
  }
}

export class ChallengeRepository {
  static async listRecent(limitCount: number): Promise<Challenge[]> {
    const rows = await getDb().query.challenges.findMany({
      orderBy: desc(challenges.createdAt),
      limit: limitCount,
    })
    return rows.map(mapChallengeRow)
  }

  static async getById(id: string): Promise<Challenge | null> {
    const row = await getDb().query.challenges.findFirst({
      where: eq(challenges.id, id),
    })
    return row ? mapChallengeRow(row) : null
  }

  static async upsert(record: Challenge): Promise<Challenge> {
    const [row] = await getDb()
      .insert(challenges)
      .values(toRow(record))
      .onConflictDoUpdate({
        target: challenges.id,
        set: toRow(record),
      })
      .returning()

    return mapChallengeRow(row)
  }
}
