import {
  collection,
  doc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { LearningRepository } from '@/lib/repositories/learningRepository'
import {
  LearningAdaptation,
  LearningEvent,
  LearningGoal,
  LearningObservation,
  LearningPattern,
  LearningPatternType,
  MetaLearningState,
  SkillProgression,
} from '@/types/metaLearning'
import type { AgentRecord, MessageRecord } from '@/types/database'
import { metaLearningService } from './metaLearningService'
import { AgentService } from './agentService'

function omitId<T extends { id: string }>(record: T): Omit<T, 'id'> {
  const { id, ...data } = record
  void id
  return data
}

function stableLearningId(prefix: string, agentId: string, key: string): string {
  const normalized = key
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 72)

  return `${prefix}_${agentId}_${normalized}`
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

function firestoreDocToObservation(docSnap: { id: string; data: () => Record<string, unknown> }): LearningObservation {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as LearningObservation
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
  let snapshot

  if (options?.status) {
    snapshot = await getDocs(query(
      goalsRef,
      where('status', '==', options.status),
      limit(options.limit || 10)
    ))
  } else {
    snapshot = await getDocs(query(
      goalsRef,
      orderBy('createdAt', 'desc'),
      limit(options?.limit || 10)
    ))
  }

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
      operation: 'upsert',
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
    operation: 'upsert',
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

  const snapshot = await getDocs(collection(db, 'agents', agentId, 'learning_adaptations'))
  let records = snapshot.docs.map(firestoreDocToAdaptation)

  if (options?.activeOnly !== false) {
    records = records.filter((record) => record.isActive)
  }

  return records
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
      operation: 'upsert',
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
    operation: 'upsert',
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

async function listObservations(agentId: string, limitCount: number = 20): Promise<LearningObservation[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return LearningRepository.listObservations(agentId, limitCount)
  }

  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, 'learning_observations'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))
  return snapshot.docs.map(firestoreDocToObservation)
}

async function getLatestPendingObservation(agentId: string): Promise<LearningObservation | null> {
  if (readsFromPostgres(getPersistenceMode())) {
    return LearningRepository.getLatestPendingObservation(agentId)
  }

  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, 'learning_observations'),
    where('followUpStatus', '==', 'pending'),
    orderBy('createdAt', 'desc'),
    limit(1)
  ))

  if (snapshot.empty) {
    return null
  }

  return firestoreDocToObservation(snapshot.docs[0])
}

async function writeObservationToFirestore(observation: LearningObservation): Promise<void> {
  await setDoc(doc(db, 'agents', observation.agentId, 'learning_observations', observation.id), omitId(observation))
}

async function saveObservation(observation: LearningObservation): Promise<LearningObservation> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeObservationToFirestore(observation)
    return observation
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'learning_observation',
      entityId: observation.id,
      operation: 'upsert',
      payload: omitId(observation) as Record<string, unknown>,
      primary: async () => {
        await writeObservationToFirestore(observation)
        return observation
      },
      secondary: async () => LearningRepository.upsertObservation(observation),
    })
  }

  return runMirroredWrite({
    entityType: 'learning_observation',
    entityId: observation.id,
    operation: 'upsert',
    payload: omitId(observation) as Record<string, unknown>,
    primary: async () => LearningRepository.upsertObservation(observation),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeObservationToFirestore(observation)
        }
      : undefined,
  })
}

function mergePattern(existing: LearningPattern, incoming: LearningPattern): LearningPattern {
  const combinedCount = Math.max(existing.observationCount, 0) + Math.max(incoming.observationCount, 0)
  const weightedEffectiveness = (
    (existing.effectiveness * Math.max(existing.observationCount, 1))
    + (incoming.effectiveness * Math.max(incoming.observationCount, 1))
  ) / Math.max(combinedCount, 1)

  return {
    ...existing,
    taskType: incoming.taskType || existing.taskType,
    strategy: incoming.strategy || existing.strategy,
    trigger: incoming.trigger || existing.trigger,
    outcome: incoming.outcome,
    frequency: Math.min((existing.frequency + incoming.frequency) / 2, 1),
    effectiveness: weightedEffectiveness,
    confidence: Math.min(Math.max(existing.confidence, incoming.confidence) + 0.05, 0.98),
    evidenceCount: Math.max(existing.evidenceCount || existing.observationCount, incoming.evidenceCount || incoming.observationCount),
    contexts: [...new Set([...existing.contexts, ...incoming.contexts])].slice(0, 10),
    relatedPatterns: [...new Set([...existing.relatedPatterns, ...incoming.relatedPatterns])].slice(0, 10),
    examples: [...incoming.examples, ...existing.examples].slice(0, 10),
    lastObserved: incoming.lastObserved,
    observationCount: combinedCount,
  }
}

async function reconcilePatterns(agent: AgentRecord, observations: LearningObservation[]): Promise<LearningPattern[]> {
  const candidates = metaLearningService.derivePatternsFromObservations(observations, agent.id)
  const saved: LearningPattern[] = []

  for (const candidate of candidates) {
    const existing = await findPattern(agent.id, candidate.type, candidate.pattern)
    const nextPattern = existing
      ? mergePattern(existing, {
          ...candidate,
          id: existing.id,
        })
      : {
          ...candidate,
          id: LearningRepository.createPatternId(),
        }

    saved.push(await savePattern(nextPattern))
  }

  const existingPatterns = await listPatterns(agent.id, 50)
  const merged = new Map(existingPatterns.map((pattern) => [pattern.id, pattern]))
  saved.forEach((pattern) => merged.set(pattern.id, pattern))
  return [...merged.values()].sort((left, right) => new Date(right.lastObserved).getTime() - new Date(left.lastObserved).getTime())
}

async function reconcileGoals(agent: AgentRecord, patterns: LearningPattern[]): Promise<LearningGoal[]> {
  const generatedGoals = metaLearningService.generateLearningGoals(agent, patterns)
  const saved = await Promise.all(generatedGoals.map((goal) => saveGoal({
    ...goal,
    id: stableLearningId('learning_goal', agent.id, goal.category),
  })))

  return listGoals(agent.id, { status: 'active', limit: 10 }).then((existing) => {
    const merged = new Map(existing.map((goal) => [goal.id, goal]))
    saved.forEach((goal) => merged.set(goal.id, goal))
    return [...merged.values()].sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
  })
}

async function reconcileAdaptations(
  agentId: string,
  patterns: LearningPattern[],
  observations: LearningObservation[]
): Promise<LearningAdaptation[]> {
  const existing = await listAdaptations(agentId, { activeOnly: false, limit: 20 })
  const candidates = [
    ...metaLearningService.generateAdaptationsFromPatterns(agentId, patterns),
    ...metaLearningService.generateAdaptationsFromObservations(agentId, observations),
  ]
  const saved: LearningAdaptation[] = []

  for (const candidate of candidates) {
    const key = `${candidate.adaptationType}_${candidate.currentState}`
    const nextAdaptation: LearningAdaptation = {
      ...candidate,
      id: stableLearningId('learning_adaptation', agentId, key),
      timestamp: new Date().toISOString(),
    }
    saved.push(await saveAdaptation(nextAdaptation))
  }

  const savedIds = new Set(saved.map((adaptation) => adaptation.id))
  for (const adaptation of existing) {
    if (adaptation.isActive && !savedIds.has(adaptation.id)) {
      await saveAdaptation({
        ...adaptation,
        isActive: false,
        timestamp: new Date().toISOString(),
      })
    }
  }

  return listAdaptations(agentId, { activeOnly: true, limit: 10 })
}

async function advanceSkillsFromObservations(agentId: string, observations: LearningObservation[]): Promise<SkillProgression[]> {
  for (const observation of observations) {
    const existingSkill = await getSkillByCategory(agentId, observation.category)
    const updatedSkill = metaLearningService.updateSkillFromObservation(existingSkill, observation)
    await saveSkill(agentId, updatedSkill)
  }

  return listSkills(agentId)
}

async function getLearningSnapshot(agent: AgentRecord): Promise<{ state: MetaLearningState; skills: SkillProgression[] }> {
  const [patterns, goals, adaptations, skills, observations] = await Promise.all([
    listPatterns(agent.id, 50),
    listGoals(agent.id, { status: 'active', limit: 10 }),
    listAdaptations(agent.id, { activeOnly: true, limit: 10 }),
    listSkills(agent.id),
    listObservations(agent.id, 20),
  ])

  const state = metaLearningService.getMetaLearningState(
    agent,
    patterns,
    adaptations,
    goals,
    observations
  )

  return { state, skills }
}

export interface ProcessLearningTurnInput {
  agentId: string
  prompt: string
  response: string
  userMessage: MessageRecord
  agentMessage: MessageRecord
  toolsUsed?: string[]
  memoryUsed?: number
  emotionalContext?: LearningEvent['emotionalContext']
}

export interface RecordQualityObservationInput {
  agentId: string
  feature: 'journal' | 'creative' | 'dream' | 'profile' | 'scenario'
  description: string
  blockerReasons: string[]
  evidenceRefs?: string[]
  candidateAdaptations?: string[]
  rawExcerpt?: string
  outputExcerpt?: string
  qualityScore?: number
  category?: LearningPatternType
}

export class LearningService {
  static async getLearningState(agentId: string): Promise<{ state: MetaLearningState; skills: SkillProgression[] } | null> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return null
    }

    const snapshot = await getLearningSnapshot(agent)
    const outputQualityObservations = snapshot.state.recentObservations.filter((observation) => observation.observationType === 'output_quality')
    const outputQualityAdaptations = snapshot.state.recentAdaptations.filter((adaptation) => adaptation.isQualityRelated)

    return {
      ...snapshot,
      state: {
        ...snapshot.state,
        outputQuality: {
          recentObservations: outputQualityObservations,
          recentAdaptations: outputQualityAdaptations,
          blockedObservationCount: outputQualityObservations.length,
          highSeverityCount: outputQualityObservations.filter((observation) => observation.severity === 'high').length,
        },
      },
    }
  }

  static async getPromptContext(agentId: string): Promise<string | undefined> {
    const adaptations = await listAdaptations(agentId, { activeOnly: true, limit: 10 })
    return metaLearningService.buildPromptContext(adaptations)
  }

  static async processChatTurn(input: ProcessLearningTurnInput): Promise<{
    state: MetaLearningState
    skills: SkillProgression[]
    observation: LearningObservation
    resolvedPreviousObservation: LearningObservation | null
  } | null> {
    const agent = await AgentService.getAgentById(input.agentId)
    if (!agent) {
      return null
    }

    const pendingObservation = await getLatestPendingObservation(input.agentId)
    let resolvedPreviousObservation: LearningObservation | null = null

    if (pendingObservation && !pendingObservation.linkedMessageIds.includes(input.userMessage.id)) {
      resolvedPreviousObservation = metaLearningService.resolveObservationWithFollowUp(
        pendingObservation,
        input.prompt
      )
      resolvedPreviousObservation = await saveObservation(resolvedPreviousObservation)
    }

    const currentObservation = await saveObservation(metaLearningService.createObservation({
      agentId: input.agentId,
      prompt: input.prompt,
      response: input.response,
      userMessageId: input.userMessage.id,
      agentMessageId: input.agentMessage.id,
      toolsUsed: input.toolsUsed,
      memoryUsed: input.memoryUsed,
    }))

    const recentObservations = await listObservations(input.agentId, 24)
    const patterns = await reconcilePatterns(agent, recentObservations)
    const goals = await reconcileGoals(agent, patterns)
    const adaptations = await reconcileAdaptations(input.agentId, patterns, recentObservations)
    const skills = await advanceSkillsFromObservations(
      input.agentId,
      [resolvedPreviousObservation, currentObservation].filter((observation): observation is LearningObservation => Boolean(observation))
    )

    const event = metaLearningService.createLearningEvent(
      input.agentId,
      'conversation',
      currentObservation.summary,
      patterns.slice(0, 5),
      input.emotionalContext || 'trust'
    )
    await saveLearningEvent(event)

    const state = metaLearningService.getMetaLearningState(
      agent,
      patterns,
      adaptations,
      goals,
      await listObservations(input.agentId, 20)
    )

    return {
      state,
      skills,
      observation: currentObservation,
      resolvedPreviousObservation,
    }
  }

  static async recordQualityObservation(input: RecordQualityObservationInput): Promise<{
    state: MetaLearningState
    skills: SkillProgression[]
    observation: LearningObservation
  } | null> {
    const agent = await AgentService.getAgentById(input.agentId)
    if (!agent) {
      return null
    }

    const observation = await saveObservation(metaLearningService.createQualityFailureObservation({
      agentId: input.agentId,
      feature: input.feature,
      category: input.category,
      description: input.description,
      blockerReasons: input.blockerReasons,
      evidenceRefs: input.evidenceRefs,
      candidateAdaptations: input.candidateAdaptations,
      rawExcerpt: input.rawExcerpt,
      outputExcerpt: input.outputExcerpt,
      qualityScore: input.qualityScore,
    }))

    const recentObservations = await listObservations(input.agentId, 24)
    const patterns = await reconcilePatterns(agent, recentObservations)
    const goals = await reconcileGoals(agent, patterns)
    const adaptations = await reconcileAdaptations(input.agentId, patterns, recentObservations)
    const skills = await advanceSkillsFromObservations(input.agentId, [observation])

    const event = metaLearningService.createLearningEvent(
      input.agentId,
      'observation',
      input.description,
      patterns.slice(0, 5),
      agent.emotionalState?.dominantEmotion || 'trust'
    )
    await saveLearningEvent(event)

    const state = metaLearningService.getMetaLearningState(
      agent,
      patterns,
      adaptations,
      goals,
      await listObservations(input.agentId, 20)
    )

    return {
      state: {
        ...state,
        outputQuality: {
          recentObservations: state.recentObservations.filter((item) => item.observationType === 'output_quality'),
          recentAdaptations: state.recentAdaptations.filter((item) => item.isQualityRelated),
          blockedObservationCount: state.recentObservations.filter((item) => item.observationType === 'output_quality').length,
          highSeverityCount: state.recentObservations.filter((item) => item.observationType === 'output_quality' && item.severity === 'high').length,
        },
      },
      skills,
      observation,
    }
  }

  static async analyzeConversation(agentId: string, messages: Array<{ content: string; type: 'user' | 'agent'; timestamp: string }>): Promise<{
    patternsFound: number
    patterns: LearningPattern[]
    learningEvent: LearningEvent
  } | null> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return null
    }

    const detectedPatterns = metaLearningService.detectPatternsFromConversation(messages, agentId)
    const savedPatterns: LearningPattern[] = []

    for (const pattern of detectedPatterns) {
      const existing = await findPattern(agentId, pattern.type, pattern.pattern)
      const nextPattern = existing ? mergePattern(existing, { ...pattern, id: existing.id }) : {
        ...pattern,
        id: LearningRepository.createPatternId(),
      }
      savedPatterns.push(await savePattern(nextPattern))
    }

    const learningEvent = metaLearningService.createLearningEvent(
      agentId,
      'conversation',
      'Analyzed conversation for learning patterns',
      savedPatterns,
      agent.emotionalState?.dominantEmotion || 'trust'
    )
    await saveLearningEvent({
      ...learningEvent,
      id: LearningRepository.createEventId(),
    })

    return {
      patternsFound: savedPatterns.length,
      patterns: savedPatterns,
      learningEvent,
    }
  }

  static async generateGoals(agentId: string): Promise<LearningGoal[] | null> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return null
    }

    const patterns = await listPatterns(agentId, 50)
    return reconcileGoals(agent, patterns)
  }

  static async updateSkill(agentId: string, category: LearningPatternType, recentPatterns: LearningPattern[] = []): Promise<SkillProgression | null> {
    const existingSkill = await getSkillByCategory(agentId, category)

    if (recentPatterns.length > 0) {
      const updatedSkill = metaLearningService.updateSkillProgression(existingSkill, recentPatterns, category)
      return saveSkill(agentId, updatedSkill)
    }

    const observation = (await listObservations(agentId, 10)).find((item) => item.category === category)
    if (!observation) {
      return existingSkill
    }

    const updatedSkill = metaLearningService.updateSkillFromObservation(existingSkill, observation)
    return saveSkill(agentId, updatedSkill)
  }

  static async createAdaptation(agentId: string, description: string, patternIds: string[] = []): Promise<LearningAdaptation | null> {
    const patterns = (await Promise.all(
      patternIds.map(async (patternId) => {
        const matches = await listPatterns(agentId, 50)
        return matches.find((pattern) => pattern.id === patternId) || null
      })
    )).filter((pattern): pattern is LearningPattern => Boolean(pattern))

    const adaptation = metaLearningService.createAdaptation(
      agentId,
      patterns,
      description
    )

    return saveAdaptation({
      ...adaptation,
      id: stableLearningId('learning_adaptation', agentId, description),
    })
  }
}
