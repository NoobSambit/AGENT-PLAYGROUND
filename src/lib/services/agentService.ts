import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AgentRecord, AgentDocument, CreateAgentData, UpdateAgentData } from '@/types/database'
import { PersonalityService } from './personalityService'

const AGENTS_COLLECTION = 'agents'

// Convert Firestore document to AgentRecord
function firestoreDocToAgent(doc: { id: string; data: () => Record<string, unknown> }): AgentRecord {
  const data = doc.data()
  return {
    id: doc.id,
    name: data.name as string || '',
    persona: data.persona as string || '',
    goals: (data.goals as string[]) || [],
    status: (data.status as AgentRecord['status']) || 'active',
    createdAt: (data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (data.createdAt as any).toDate().toISOString()
      : (data.createdAt as string) || new Date().toISOString(),
    updatedAt: (data.updatedAt && typeof data.updatedAt === 'object' && 'toDate' in data.updatedAt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (data.updatedAt as any).toDate().toISOString()
      : (data.updatedAt as string) || new Date().toISOString(),
    userId: data.userId as string | undefined,
    settings: data.settings as Record<string, unknown> | undefined,
    coreTraits: data.coreTraits as Record<string, number> || {},
    dynamicTraits: data.dynamicTraits as Record<string, number> || {},
    memoryCount: data.memoryCount as number || 0,
    totalInteractions: data.totalInteractions as number || 0
  }
}

// Convert AgentRecord to Firestore document
function agentToFirestoreDoc(agent: CreateAgentData | UpdateAgentData): Omit<AgentDocument, 'createdAt' | 'updatedAt'> & { createdAt?: Timestamp, updatedAt?: Timestamp } {
  return {
    name: (agent as CreateAgentData).name || '',
    persona: (agent as CreateAgentData).persona || '',
    goals: 'goals' in agent ? agent.goals || [] : [],
    status: 'status' in agent ? agent.status || 'active' : 'active',
    userId: 'userId' in agent ? agent.userId : undefined,
    settings: 'settings' in agent ? agent.settings : undefined,
    // Initialize personality and memory fields with defaults
    coreTraits: {},
    dynamicTraits: {},
    memoryCount: 0,
    totalInteractions: 0,
    updatedAt: Timestamp.now()
  }
}

export class AgentService {
  // Get all agents
  static async getAllAgents(): Promise<AgentRecord[]> {
    try {
      const q = query(
        collection(db, AGENTS_COLLECTION),
        orderBy('createdAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToAgent)
    } catch (error) {
      console.error('Error fetching agents:', error)
      return []
    }
  }

  // Get agent by ID
  static async getAgentById(id: string): Promise<AgentRecord | null> {
    try {
      const docRef = doc(db, AGENTS_COLLECTION, id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return firestoreDocToAgent(docSnap)
      }
      return null
    } catch (error) {
      console.error('Error fetching agent:', error)
      return null
    }
  }

  // Create new agent
  static async createAgent(agentData: CreateAgentData): Promise<AgentRecord | null> {
    try {
      // Generate initial personality traits based on persona
      const personality = PersonalityService.generateInitialPersonality(agentData.persona)

      const docData = {
        ...agentToFirestoreDoc(agentData),
        coreTraits: personality.coreTraits,
        dynamicTraits: personality.dynamicTraits,
        memoryCount: 0,
        totalInteractions: 0,
        createdAt: Timestamp.now()
      }

      const docRef = await addDoc(collection(db, AGENTS_COLLECTION), docData)
      return await this.getAgentById(docRef.id)
    } catch (error) {
      console.error('Error creating agent:', error)
      return null
    }
  }

  // Update agent
  static async updateAgent(id: string, updates: UpdateAgentData): Promise<boolean> {
    try {
      const docRef = doc(db, AGENTS_COLLECTION, id)
      await updateDoc(docRef, {
        ...agentToFirestoreDoc(updates),
        updatedAt: Timestamp.now()
      })
      return true
    } catch (error) {
      console.error('Error updating agent:', error)
      return false
    }
  }

  // Delete agent
  static async deleteAgent(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, AGENTS_COLLECTION, id))
      return true
    } catch (error) {
      console.error('Error deleting agent:', error)
      return false
    }
  }

  // Get agents by status
  static async getAgentsByStatus(status: 'active' | 'inactive' | 'training'): Promise<AgentRecord[]> {
    try {
      const q = query(
        collection(db, AGENTS_COLLECTION),
        where('status', '==', status),
        orderBy('createdAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToAgent)
    } catch (error) {
      console.error('Error fetching agents by status:', error)
      return []
    }
  }
}
