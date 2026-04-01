import { NextRequest, NextResponse } from 'next/server'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  runTransaction,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { LearningRepository } from '@/lib/repositories/learningRepository'
import { RateLimitRepository } from '@/lib/repositories/rateLimitRepository'
import { AgentService } from '@/lib/services/agentService'
import { metaLearningService } from '@/lib/services/metaLearningService'
import {
  LearningPattern,
  LearningGoal,
  LearningAdaptation,
  SkillProgression,
  LearningEvent,
  LearningPatternType,
} from '@/types/metaLearning'

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000

function omitId<T extends { id: string }>(record: T): Omit<T, 'id'> {
  const { id, ...data } = record
  void id
  return data
}

function firestoreDocToPattern(docSnap: { id: string; data: () => Record<string, unknown> }): LearningPattern {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as LearningPattern
}

function firestoreDocToGoal(docSnap: { id: string; data: () => Record<string, unknown> }): LearningGoal {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as LearningGoal
}

function firestoreDocToAdaptation(docSnap: { id: string; data: () => Record<string, unknown> }): LearningAdaptation {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as LearningAdaptation
}

async function checkRateLimit(agentId: string): Promise<{ allowed: boolean; remaining: number }> {
  const mode = getPersistenceMode()

  if (mode !== 'firestore') {
    return RateLimitRepository.consumeAgentWindow({
      agentId,
      feature: 'meta_learning',
      maxRequests: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS,
    })
  }

  const now = Date.now()
  const rateRef = doc(db, 'agents', agentId, 'rate_limits', 'meta_learning')

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(rateRef)
    const data = snap.exists() ? (snap.data() as { count?: number; windowStart?: number }) : null
    const windowStart = data?.windowStart ?? 0
    const count = data?.count ?? 0

    if (!data || now - windowStart > RATE_WINDOW_MS) {
      transaction.set(rateRef, { count: 1, windowStart: now }, { merge: true })
      return { allowed: true, remaining: RATE_LIMIT - 1 }
    }

    if (count >= RATE_LIMIT) {
      return { allowed: false, remaining: 0 }
    }

    const newCount = count + 1
    transaction.update(rateRef, { count: newCount })
    return { allowed: true, remaining: RATE_LIMIT - newCount }
  }).catch(async (error) => {
    console.error('Rate limit transaction failed:', error)
    await setDoc(rateRef, { count: 1, windowStart: now }, { merge: true })
    return { allowed: true, remaining: RATE_LIMIT - 1 }
  })
}

async function listPatterns(agentId: string, limitCount: number = 50): Promise<LearningPattern[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return LearningRepository.listPatterns(agentId, limitCount)
  }

  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, 'learning_patterns'),
    orderBy('lastObserved', 'desc'),
    limit(limitCount)
  ))
  return snapshot.docs.map(firestoreDocToPattern)
}

async function findPattern(agentId: string, type: string, pattern: string): Promise<LearningPattern | null> {
  if (readsFromPostgres(getPersistenceMode())) {
    return LearningRepository.findPattern(agentId, type, pattern)
  }

  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, 'learning_patterns'),
    where('type', '==', type),
    where('pattern', '==', pattern),
    limit(1)
  ))

  if (snapshot.empty) {
    return null
  }

  return firestoreDocToPattern(snapshot.docs[0])
}

async function getPatternById(agentId: string, patternId: string): Promise<LearningPattern | null> {
  if (readsFromPostgres(getPersistenceMode())) {
    return LearningRepository.getPatternById(agentId, patternId)
  }

  const snapshot = await getDoc(doc(db, 'agents', agentId, 'learning_patterns', patternId))
  return snapshot.exists() ? firestoreDocToPattern(snapshot) : null
}

async function writePatternToFirestore(pattern: LearningPattern): Promise<void> {
  await setDoc(doc(db, 'agents', pattern.agentId, 'learning_patterns', pattern.id), omitId(pattern))
}

async function savePattern(pattern: LearningPattern): Promise<LearningPattern> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writePatternToFirestore(pattern)
    return pattern
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'learning_pattern',
      entityId: pattern.id,
      operation: 'upsert',
      payload: omitId(pattern) as Record<string, unknown>,
      primary: async () => {
        await writePatternToFirestore(pattern)
        return pattern
      },
      secondary: async () => LearningRepository.upsertPattern(pattern),
    })
  }

  return runMirroredWrite({
    entityType: 'learning_pattern',
    entityId: pattern.id,
    operation: 'upsert',
    payload: omitId(pattern) as Record<string, unknown>,
    primary: async () => LearningRepository.upsertPattern(pattern),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writePatternToFirestore(pattern)
        }
      : undefined,
  })
}

async function listGoals(agentId: string, options?: { status?: string; limit?: number }): Promise<LearningGoal[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return LearningRepository.listGoals(agentId, options)
  }

  const goalsRef = collection(db, 'agents', agentId, 'learning_goals')
  const q = options?.status
    ? query(goalsRef, where('status', '==', options.status), limit(options.limit || 10))
    : query(goalsRef, orderBy('createdAt', 'desc'), limit(options?.limit || 10))
  const snapshot = await getDocs(q)
  return snapshot.docs.map(firestoreDocToGoal)
}

async function writeGoalToFirestore(goal: LearningGoal): Promise<void> {
  await setDoc(doc(db, 'agents', goal.agentId, 'learning_goals', goal.id), omitId(goal))
}

async function saveGoal(goal: LearningGoal): Promise<LearningGoal> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeGoalToFirestore(goal)
    return goal
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'learning_goal',
      entityId: goal.id,
      operation: 'create',
      payload: omitId(goal) as Record<string, unknown>,
      primary: async () => {
        await writeGoalToFirestore(goal)
        return goal
      },
      secondary: async () => LearningRepository.saveGoal(goal),
    })
  }

  return runMirroredWrite({
    entityType: 'learning_goal',
    entityId: goal.id,
    operation: 'create',
    payload: omitId(goal) as Record<string, unknown>,
    primary: async () => LearningRepository.saveGoal(goal),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeGoalToFirestore(goal)
        }
      : undefined,
  })
}

async function listAdaptations(agentId: string, options?: { activeOnly?: boolean; limit?: number }): Promise<LearningAdaptation[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return LearningRepository.listAdaptations(agentId, options)
  }

  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, 'learning_adaptations'),
    where('isActive', '==', options?.activeOnly === false ? false : true)
  ))

  return snapshot.docs
    .map(firestoreDocToAdaptation)
    .sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
    .slice(0, options?.limit || 10)
}

async function writeAdaptationToFirestore(adaptation: LearningAdaptation): Promise<void> {
  await setDoc(doc(db, 'agents', adaptation.agentId, 'learning_adaptations', adaptation.id), omitId(adaptation))
}

async function saveAdaptation(adaptation: LearningAdaptation): Promise<LearningAdaptation> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeAdaptationToFirestore(adaptation)
    return adaptation
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'learning_adaptation',
      entityId: adaptation.id,
      operation: 'create',
      payload: omitId(adaptation) as Record<string, unknown>,
      primary: async () => {
        await writeAdaptationToFirestore(adaptation)
        return adaptation
      },
      secondary: async () => LearningRepository.saveAdaptation(adaptation),
    })
  }

  return runMirroredWrite({
    entityType: 'learning_adaptation',
    entityId: adaptation.id,
    operation: 'create',
    payload: omitId(adaptation) as Record<string, unknown>,
    primary: async () => LearningRepository.saveAdaptation(adaptation),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeAdaptationToFirestore(adaptation)
        }
      : undefined,
  })
}

async function writeEventToFirestore(event: LearningEvent): Promise<void> {
  await setDoc(doc(db, 'agents', event.agentId, 'learning_events', event.id), omitId(event))
}

async function saveLearningEvent(event: LearningEvent): Promise<LearningEvent> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeEventToFirestore(event)
    return event
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'learning_event',
      entityId: event.id,
      operation: 'create',
      payload: omitId(event) as Record<string, unknown>,
      primary: async () => {
        await writeEventToFirestore(event)
        return event
      },
      secondary: async () => LearningRepository.saveEvent(event),
    })
  }

  return runMirroredWrite({
    entityType: 'learning_event',
    entityId: event.id,
    operation: 'create',
    payload: omitId(event) as Record<string, unknown>,
    primary: async () => LearningRepository.saveEvent(event),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeEventToFirestore(event)
        }
      : undefined,
  })
}

async function listSkills(agentId: string): Promise<SkillProgression[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return LearningRepository.listSkills(agentId)
  }

  const snapshot = await getDocs(collection(db, 'agents', agentId, 'skill_progressions'))
  return snapshot.docs.map((docSnap) => docSnap.data() as SkillProgression)
}

async function getSkillByCategory(agentId: string, category: string): Promise<SkillProgression | null> {
  if (readsFromPostgres(getPersistenceMode())) {
    return LearningRepository.getSkillByCategory(agentId, category)
  }

  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, 'skill_progressions'),
    where('category', '==', category),
    limit(1)
  ))

  return snapshot.empty ? null : snapshot.docs[0].data() as SkillProgression
}

async function writeSkillToFirestore(agentId: string, skill: SkillProgression): Promise<void> {
  await setDoc(doc(db, 'agents', agentId, 'skill_progressions', skill.category), skill)
}

async function saveSkill(agentId: string, skill: SkillProgression): Promise<SkillProgression> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeSkillToFirestore(agentId, skill)
    return skill
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'skill_progression',
      entityId: `${agentId}:${skill.category}`,
      operation: 'upsert',
      payload: skill as unknown as Record<string, unknown>,
      primary: async () => {
        await writeSkillToFirestore(agentId, skill)
        return skill
      },
      secondary: async () => LearningRepository.upsertSkill(agentId, skill),
    })
  }

  return runMirroredWrite({
    entityType: 'skill_progression',
    entityId: `${agentId}:${skill.category}`,
    operation: 'upsert',
    payload: skill as unknown as Record<string, unknown>,
    primary: async () => LearningRepository.upsertSkill(agentId, skill),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeSkillToFirestore(agentId, skill)
        }
      : undefined,
  })
}

function mergePattern(existing: LearningPattern, incoming: LearningPattern): LearningPattern {
  return {
    ...existing,
    trigger: incoming.trigger || existing.trigger,
    outcome: incoming.outcome,
    frequency: Math.min((existing.frequency + incoming.frequency) / 2, 1),
    effectiveness: (existing.effectiveness + incoming.effectiveness) / 2,
    confidence: Math.min(existing.confidence + 0.05, 0.95),
    contexts: [...new Set([...existing.contexts, ...incoming.contexts])].slice(0, 10),
    relatedPatterns: [...new Set([...existing.relatedPatterns, ...incoming.relatedPatterns])].slice(0, 10),
    examples: [...existing.examples, ...incoming.examples].slice(-10),
    lastObserved: new Date().toISOString(),
    observationCount: existing.observationCount + 1,
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const agent = await AgentService.getAgentById(agentId)

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const [patterns, goals, adaptations, skills] = await Promise.all([
      listPatterns(agentId, 50),
      listGoals(agentId, { status: 'active', limit: 10 }),
      listAdaptations(agentId, { activeOnly: true, limit: 10 }),
      listSkills(agentId),
    ])

    const state = metaLearningService.getMetaLearningState(
      agent,
      patterns,
      adaptations,
      goals
    )

    return NextResponse.json({
      success: true,
      state,
      skills,
    })
  } catch (error) {
    console.error('Error fetching meta-learning state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meta-learning state' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { allowed, remaining } = await checkRateLimit(agentId)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again tomorrow.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }

    const body = await request.json()
    const { action } = body

    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    switch (action) {
      case 'analyze_conversation': {
        const { messages } = body

        if (!messages || !Array.isArray(messages)) {
          return NextResponse.json(
            { error: 'Messages array required' },
            { status: 400 }
          )
        }

        const detectedPatterns = metaLearningService.detectPatternsFromConversation(messages, agentId)
        const savedPatterns: LearningPattern[] = []

        for (const pattern of detectedPatterns) {
          const existing = await findPattern(agentId, pattern.type, pattern.pattern)
          const nextPattern = existing ? mergePattern(existing, pattern) : pattern
          savedPatterns.push(await savePattern(nextPattern))
        }

        const emotionalContext = agent.emotionalState?.dominantEmotion || 'trust'
        const learningEvent = metaLearningService.createLearningEvent(
          agentId,
          'conversation',
          'Analyzed conversation for learning patterns',
          savedPatterns,
          emotionalContext
        )
        await saveLearningEvent(learningEvent)

        return NextResponse.json({
          success: true,
          patternsFound: savedPatterns.length,
          patterns: savedPatterns,
          learningEvent,
          remaining,
        }, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        })
      }

      case 'generate_goals': {
        const patterns = await listPatterns(agentId, 50)
        const generatedGoals = metaLearningService.generateLearningGoals(agent, patterns)
        const savedGoals = await Promise.all(generatedGoals.map((goal) => saveGoal(goal)))

        return NextResponse.json({
          success: true,
          goalsGenerated: savedGoals.length,
          goals: savedGoals,
          remaining,
        }, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        })
      }

      case 'update_skill': {
        const { category, patterns: recentPatterns } = body

        if (!category) {
          return NextResponse.json(
            { error: 'Category required' },
            { status: 400 }
          )
        }

        const existingSkill = await getSkillByCategory(agentId, category)
        const updatedSkill = metaLearningService.updateSkillProgression(
          existingSkill,
          recentPatterns || [],
          category as LearningPatternType
        )
        const savedSkill = await saveSkill(agentId, updatedSkill)

        return NextResponse.json({
          success: true,
          skill: savedSkill,
          remaining,
        }, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        })
      }

      case 'create_adaptation': {
        const { description, patternIds } = body

        if (!description) {
          return NextResponse.json(
            { error: 'Description required' },
            { status: 400 }
          )
        }

        const patterns = Array.isArray(patternIds)
          ? (await Promise.all(
              patternIds.map((patternId: string) => getPatternById(agentId, patternId))
            )).filter((pattern): pattern is LearningPattern => Boolean(pattern))
          : []

        const adaptation = metaLearningService.createAdaptation(
          agentId,
          patterns,
          description
        )
        const savedAdaptation = await saveAdaptation(adaptation)

        return NextResponse.json({
          success: true,
          adaptation: savedAdaptation,
          remaining,
        }, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: analyze_conversation, generate_goals, update_skill, create_adaptation' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Error in meta-learning:', error)
    return NextResponse.json(
      { error: 'Failed to process meta-learning request' },
      { status: 500 }
    )
  }
}
