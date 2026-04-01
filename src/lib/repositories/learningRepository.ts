import { and, desc, eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import {
  learningAdaptations,
  learningEvents,
  learningGoals,
  learningPatterns,
  skillProgressions,
} from '@/lib/db/schema'
import { andAll, asIsoString, generateId } from '@/lib/db/utils'
import type {
  LearningAdaptation,
  LearningEvent,
  LearningGoal,
  LearningPattern,
  SkillProgression,
} from '@/types/metaLearning'

function mapPattern(row: typeof learningPatterns.$inferSelect): LearningPattern {
  return {
    ...row.payload,
    id: row.id,
    lastObserved: asIsoString(row.lastObserved),
  }
}

function mapGoal(row: typeof learningGoals.$inferSelect): LearningGoal {
  return {
    ...row.payload,
    id: row.id,
    createdAt: asIsoString(row.createdAt),
    targetDate: row.targetDate ? asIsoString(row.targetDate) : undefined,
  }
}

function mapAdaptation(row: typeof learningAdaptations.$inferSelect): LearningAdaptation {
  return {
    ...row.payload,
    id: row.id,
    timestamp: asIsoString(row.eventTimestamp),
  }
}

function mapEvent(row: typeof learningEvents.$inferSelect): LearningEvent {
  return {
    ...row.payload,
    id: row.id,
    timestamp: asIsoString(row.eventTimestamp),
  }
}

export class LearningRepository {
  static async listPatterns(agentId: string, limitCount: number = 50): Promise<LearningPattern[]> {
    const rows = await getDb().query.learningPatterns.findMany({
      where: eq(learningPatterns.agentId, agentId),
      orderBy: desc(learningPatterns.lastObserved),
      limit: limitCount,
    })
    return rows.map(mapPattern)
  }

  static async findPattern(agentId: string, type: string, pattern: string): Promise<LearningPattern | null> {
    const row = await getDb().query.learningPatterns.findFirst({
      where: and(
        eq(learningPatterns.agentId, agentId),
        eq(learningPatterns.type, type),
        eq(learningPatterns.pattern, pattern)
      ),
    })
    return row ? mapPattern(row) : null
  }

  static async getPatternById(agentId: string, patternId: string): Promise<LearningPattern | null> {
    const row = await getDb().query.learningPatterns.findFirst({
      where: and(eq(learningPatterns.id, patternId), eq(learningPatterns.agentId, agentId)),
    })
    return row ? mapPattern(row) : null
  }

  static async upsertPattern(record: LearningPattern): Promise<LearningPattern> {
    const [row] = await getDb()
      .insert(learningPatterns)
      .values({
        id: record.id,
        agentId: record.agentId,
        type: record.type,
        pattern: record.pattern,
        lastObserved: asIsoString(record.lastObserved),
        payload: record,
      })
      .onConflictDoUpdate({
        target: learningPatterns.id,
        set: {
          type: record.type,
          pattern: record.pattern,
          lastObserved: asIsoString(record.lastObserved),
          payload: record,
        },
      })
      .returning()

    return mapPattern(row)
  }

  static async listGoals(agentId: string, options?: {
    status?: string
    limit?: number
  }): Promise<LearningGoal[]> {
    const rows = await getDb().query.learningGoals.findMany({
      where: andAll([
        eq(learningGoals.agentId, agentId),
        options?.status ? eq(learningGoals.status, options.status) : undefined
      ]),
      orderBy: desc(learningGoals.createdAt),
      limit: options?.limit,
    })
    return rows.map(mapGoal)
  }

  static async saveGoal(record: LearningGoal): Promise<LearningGoal> {
    const [row] = await getDb().insert(learningGoals).values({
      id: record.id,
      agentId: record.agentId,
      category: record.category,
      status: record.status,
      createdAt: asIsoString(record.createdAt),
      targetDate: record.targetDate ? asIsoString(record.targetDate) : null,
      payload: record,
    }).returning()

    return mapGoal(row)
  }

  static async listAdaptations(agentId: string, options?: {
    activeOnly?: boolean
    limit?: number
  }): Promise<LearningAdaptation[]> {
    const rows = await getDb().query.learningAdaptations.findMany({
      where: andAll([
        eq(learningAdaptations.agentId, agentId),
        options?.activeOnly === false ? undefined : eq(learningAdaptations.isActive, true)
      ]),
      orderBy: desc(learningAdaptations.eventTimestamp),
      limit: options?.limit,
    })
    return rows.map(mapAdaptation)
  }

  static async saveAdaptation(record: LearningAdaptation): Promise<LearningAdaptation> {
    const [row] = await getDb().insert(learningAdaptations).values({
      id: record.id,
      agentId: record.agentId,
      isActive: record.isActive,
      eventTimestamp: asIsoString(record.timestamp),
      payload: record,
    }).returning()

    return mapAdaptation(row)
  }

  static async saveEvent(record: LearningEvent): Promise<LearningEvent> {
    const [row] = await getDb().insert(learningEvents).values({
      id: record.id,
      agentId: record.agentId,
      eventType: record.eventType,
      eventTimestamp: asIsoString(record.timestamp),
      payload: record,
    }).returning()

    return mapEvent(row)
  }

  static async listSkills(agentId: string): Promise<SkillProgression[]> {
    const rows = await getDb().query.skillProgressions.findMany({
      where: eq(skillProgressions.agentId, agentId),
    })
    return rows.map((row) => row.payload)
  }

  static async getSkillByCategory(agentId: string, category: string): Promise<SkillProgression | null> {
    const row = await getDb().query.skillProgressions.findFirst({
      where: and(
        eq(skillProgressions.agentId, agentId),
        eq(skillProgressions.category, category)
      ),
    })
    return row?.payload || null
  }

  static async upsertSkill(agentId: string, record: SkillProgression): Promise<SkillProgression> {
    const id = `${agentId}:${record.category}`
    const [row] = await getDb()
      .insert(skillProgressions)
      .values({
        id,
        agentId,
        category: record.category,
        payload: record,
      })
      .onConflictDoUpdate({
        target: skillProgressions.id,
        set: {
          category: record.category,
          payload: record,
        },
      })
      .returning()

    return row.payload
  }

  static createPatternId(): string {
    return generateId('learning_pattern')
  }

  static createGoalId(): string {
    return generateId('learning_goal')
  }

  static createAdaptationId(): string {
    return generateId('learning_adaptation')
  }

  static createEventId(): string {
    return generateId('learning_event')
  }
}
