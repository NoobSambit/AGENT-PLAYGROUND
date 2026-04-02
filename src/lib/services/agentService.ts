import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AgentRepository } from '@/lib/repositories/agentRepository'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { generateId } from '@/lib/db/utils'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { AgentRecord, CreateAgentData, UpdateAgentData } from '@/types/database'
import { PersonalityService } from './personalityService'
import { agentStatsService } from './agentStatsService'
import { emotionalService } from './emotionalService'
import { psychologicalProfileService } from './psychologicalProfileService'

const AGENTS_COLLECTION = 'agents'

function stripUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as T
}

function normalizeEmotionFields(data: Record<string, unknown>) {
  const coreTraits = (data.coreTraits as Record<string, number>) || {}
  const emotionalProfile = emotionalService.normalizeEmotionalProfile(
    data.emotionalProfile as AgentRecord['emotionalProfile'],
    coreTraits
  )

  const rawState = data.emotionalState as Record<string, unknown> | undefined
  const rawHistory: NonNullable<AgentRecord['emotionalHistory']> = Array.isArray(data.emotionalHistory)
    ? data.emotionalHistory as NonNullable<AgentRecord['emotionalHistory']>
    : []

  const hasLegacyState = Boolean(rawState && typeof rawState === 'object' && 'emotionalBaseline' in rawState)
  const hasLegacyHistory = rawHistory.some((event) => !('delta' in event) || !('source' in event) || !('phase' in event))
  const missingProfile = !data.emotionalProfile
  const missingState = !rawState

  const requiresReset = hasLegacyState || hasLegacyHistory || missingProfile || missingState

  return {
    emotionalProfile,
    emotionalState: requiresReset
      ? emotionalService.createDormantEmotionalState()
      : emotionalService.normalizeEmotionalState(data.emotionalState as AgentRecord['emotionalState']),
    emotionalHistory: requiresReset ? [] : rawHistory,
    requiresReset,
  }
}

function normalizeAgent(agent: AgentRecord): AgentRecord {
  const normalizedEmotion = normalizeEmotionFields(agent as unknown as Record<string, unknown>)
  return {
    ...agent,
    emotionalProfile: normalizedEmotion.emotionalProfile,
    emotionalState: normalizedEmotion.emotionalState,
    emotionalHistory: normalizedEmotion.emotionalHistory,
  }
}

function firestoreDocToAgent(docSnap: { id: string; data: () => Record<string, unknown> }): AgentRecord {
  const data = docSnap.data()
  const normalizedEmotion = normalizeEmotionFields(data)
  return {
    id: docSnap.id,
    name: data.name as string || '',
    persona: data.persona as string || '',
    goals: (data.goals as string[]) || [],
    status: (data.status as AgentRecord['status']) || 'active',
    createdAt: data.createdAt as string || new Date().toISOString(),
    updatedAt: data.updatedAt as string || new Date().toISOString(),
    userId: data.userId as string | undefined,
    settings: data.settings as Record<string, unknown> | undefined,
    coreTraits: data.coreTraits as Record<string, number> || {},
    dynamicTraits: data.dynamicTraits as Record<string, number> || {},
    memoryCount: data.memoryCount as number || 0,
    totalInteractions: data.totalInteractions as number || 0,
    linguisticProfile: data.linguisticProfile as AgentRecord['linguisticProfile'],
    emotionalProfile: normalizedEmotion.emotionalProfile,
    emotionalState: normalizedEmotion.emotionalState,
    emotionalHistory: normalizedEmotion.emotionalHistory,
    stats: data.stats as AgentRecord['stats'],
    psychologicalProfile: data.psychologicalProfile as AgentRecord['psychologicalProfile'],
    relationshipCount: data.relationshipCount as number || 0,
    creativeWorks: data.creativeWorks as number || 0,
    dreamCount: data.dreamCount as number || 0,
    journalCount: data.journalCount as number || 0,
    challengesCompleted: data.challengesCompleted as number || 0,
    challengeWins: data.challengeWins as number || 0,
    mentorshipStats: data.mentorshipStats as AgentRecord['mentorshipStats'] || undefined,
  }
}

function agentToFirestoreDoc(agent: AgentRecord): Record<string, unknown> {
  return stripUndefinedFields({
    name: agent.name,
    persona: agent.persona,
    goals: agent.goals || [],
    status: agent.status,
    createdAt: agent.createdAt,
    updatedAt: agent.updatedAt,
    userId: agent.userId,
    settings: agent.settings,
    coreTraits: agent.coreTraits,
    dynamicTraits: agent.dynamicTraits,
    memoryCount: agent.memoryCount,
    totalInteractions: agent.totalInteractions,
    linguisticProfile: agent.linguisticProfile,
    emotionalProfile: agent.emotionalProfile,
    emotionalState: agent.emotionalState,
    emotionalHistory: agent.emotionalHistory,
    stats: agent.stats,
    psychologicalProfile: agent.psychologicalProfile,
    relationshipCount: agent.relationshipCount,
    creativeWorks: agent.creativeWorks,
    dreamCount: agent.dreamCount,
    journalCount: agent.journalCount,
    challengesCompleted: agent.challengesCompleted,
    challengeWins: agent.challengeWins,
    mentorshipStats: agent.mentorshipStats,
  })
}

function agentUpdatesToFirestoreDoc(agent: UpdateAgentData): Partial<Record<string, unknown>> {
  return stripUndefinedFields({
    name: agent.name,
    persona: agent.persona,
    goals: agent.goals,
    status: agent.status,
    settings: agent.settings,
    coreTraits: agent.coreTraits,
    dynamicTraits: agent.dynamicTraits,
    memoryCount: agent.memoryCount,
    totalInteractions: agent.totalInteractions,
    linguisticProfile: agent.linguisticProfile,
    emotionalProfile: agent.emotionalProfile,
    emotionalState: agent.emotionalState,
    emotionalHistory: agent.emotionalHistory,
    stats: agent.stats,
    psychologicalProfile: agent.psychologicalProfile,
    relationshipCount: agent.relationshipCount,
    creativeWorks: agent.creativeWorks,
    dreamCount: agent.dreamCount,
    journalCount: agent.journalCount,
    challengesCompleted: agent.challengesCompleted,
    challengeWins: agent.challengeWins,
    mentorshipStats: 'mentorshipStats' in agent ? agent.mentorshipStats : undefined,
  })
}

async function getAllAgentsFromFirestore(): Promise<AgentRecord[]> {
  const q = query(collection(db, AGENTS_COLLECTION), orderBy('createdAt', 'desc'))
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(firestoreDocToAgent)
}

async function getAgentByIdFromFirestore(id: string): Promise<AgentRecord | null> {
  const docRef = doc(db, AGENTS_COLLECTION, id)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return null
  }

  return firestoreDocToAgent(docSnap)
}

async function getAgentsByStatusFromFirestore(status: AgentRecord['status']): Promise<AgentRecord[]> {
  const q = query(
    collection(db, AGENTS_COLLECTION),
    where('status', '==', status),
    orderBy('createdAt', 'desc')
  )
  const querySnapshot = await getDocs(q)
  return querySnapshot.docs.map(firestoreDocToAgent)
}

async function upsertAgentInFirestore(agent: AgentRecord): Promise<void> {
  await setDoc(doc(db, AGENTS_COLLECTION, agent.id), agentToFirestoreDoc(agent))
}

async function updateAgentInFirestore(id: string, updates: UpdateAgentData): Promise<void> {
  await updateDoc(doc(db, AGENTS_COLLECTION, id), stripUndefinedFields({
    ...agentUpdatesToFirestoreDoc(updates),
    updatedAt: updates.updatedAt || new Date().toISOString(),
  }))
}

async function deleteAgentInFirestore(id: string): Promise<void> {
  await deleteDoc(doc(db, AGENTS_COLLECTION, id))
}

export class AgentService {
  static async getAllAgents(): Promise<AgentRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        const agents = await AgentRepository.listAll()
        return agents.map(normalizeAgent)
      }

      const agents = await getAllAgentsFromFirestore()
      return agents.map(normalizeAgent)
    } catch (error) {
      console.error('Error fetching agents:', error)
      return []
    }
  }

  static async getAgentById(id: string): Promise<AgentRecord | null> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        const agent = await AgentRepository.getById(id)
        return agent ? normalizeAgent(agent) : null
      }

      const agent = await getAgentByIdFromFirestore(id)
      return agent ? normalizeAgent(agent) : null
    } catch (error) {
      console.error('Error fetching agent:', error)
      return null
    }
  }

  static async createAgent(agentData: CreateAgentData): Promise<AgentRecord | null> {
    try {
      const id = generateId('agent')
      const now = new Date().toISOString()
      const personality = PersonalityService.generateInitialPersonality(agentData.persona)
      const linguisticProfile = PersonalityService.generateLinguisticProfile(
        agentData.persona,
        agentData.goals || [],
        personality.coreTraits
      )
      const emotionalProfile = emotionalService.generateProfileFromTraits(personality.coreTraits)
      const emotionalState = emotionalService.createDormantEmotionalState()
      const stats = agentStatsService.createDefaultStats()

      const baseAgent: AgentRecord = {
        id,
        name: agentData.name,
        persona: agentData.persona,
        goals: agentData.goals || [],
        status: agentData.status || 'active',
        createdAt: now,
        updatedAt: now,
        userId: agentData.userId,
        settings: agentData.settings,
        coreTraits: personality.coreTraits,
        dynamicTraits: personality.dynamicTraits,
        memoryCount: 0,
        totalInteractions: 0,
        linguisticProfile,
        emotionalProfile,
        emotionalState,
        emotionalHistory: [],
        stats,
        relationshipCount: 0,
        creativeWorks: 0,
        dreamCount: 0,
        journalCount: 0,
        challengesCompleted: 0,
        challengeWins: 0,
      }

      const psychologicalProfile = psychologicalProfileService.generateProfile(baseAgent)
      const agent: AgentRecord = {
        ...baseAgent,
        psychologicalProfile: {
          ...psychologicalProfile,
          id: psychologicalProfile.id || generateId('psych_profile'),
          agentId: id,
        },
      }

      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await upsertAgentInFirestore(agent)
        return agent
      }

      if (mode === 'dual-write-firestore-read') {
        return runMirroredWrite({
          entityType: 'agent',
          entityId: agent.id,
          operation: 'create',
          payload: agentToFirestoreDoc(agent),
          primary: async () => {
            await upsertAgentInFirestore(agent)
            return agent
          },
          secondary: async () => {
            await AgentRepository.upsert(agent)
          },
        })
      }

      return runMirroredWrite({
        entityType: 'agent',
        entityId: agent.id,
        operation: 'create',
        payload: agentToFirestoreDoc(agent),
        primary: async () => AgentRepository.create(agent),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await upsertAgentInFirestore(agent)
            }
          : undefined,
      })
    } catch (error) {
      console.error('Error creating agent:', error)
      return null
    }
  }

  static async updateAgent(id: string, updates: UpdateAgentData): Promise<boolean> {
    try {
      const updatePayload: UpdateAgentData = {
        ...updates,
        updatedAt: new Date().toISOString(),
      }
      const mode = getPersistenceMode()

      if (mode === 'firestore') {
        await updateAgentInFirestore(id, updatePayload)
        return true
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'agent',
          entityId: id,
          operation: 'update',
          payload: updatePayload as Record<string, unknown>,
          primary: async () => {
            await updateAgentInFirestore(id, updatePayload)
            return true
          },
          secondary: async () => {
            await AgentRepository.update(id, updatePayload)
          },
        })
        return true
      }

      await runMirroredWrite({
        entityType: 'agent',
        entityId: id,
        operation: 'update',
        payload: updatePayload as Record<string, unknown>,
        primary: async () => AgentRepository.update(id, updatePayload),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await updateAgentInFirestore(id, updatePayload)
            }
          : undefined,
      })
      return true
    } catch (error) {
      console.error('Error updating agent:', error)
      return false
    }
  }

  static async deleteAgent(id: string): Promise<boolean> {
    try {
      const mode = getPersistenceMode()

      if (mode === 'firestore') {
        await deleteAgentInFirestore(id)
        return true
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'agent',
          entityId: id,
          operation: 'delete',
          payload: { id },
          primary: async () => {
            await deleteAgentInFirestore(id)
            return true
          },
          secondary: async () => {
            await AgentRepository.delete(id)
          },
        })
        return true
      }

      await runMirroredWrite({
        entityType: 'agent',
        entityId: id,
        operation: 'delete',
        payload: { id },
        primary: async () => AgentRepository.delete(id),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await deleteAgentInFirestore(id)
            }
          : undefined,
      })
      return true
    } catch (error) {
      console.error('Error deleting agent:', error)
      return false
    }
  }

  static async getAgentsByStatus(status: AgentRecord['status']): Promise<AgentRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        const agents = await AgentRepository.listByStatus(status)
        return agents.map(normalizeAgent)
      }

      const agents = await getAgentsByStatusFromFirestore(status)
      return agents.map(normalizeAgent)
    } catch (error) {
      console.error('Error fetching agents by status:', error)
      return []
    }
  }
}
