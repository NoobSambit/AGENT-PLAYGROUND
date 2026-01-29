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
  limit,
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { SimulationRecord, SimulationDocument } from '@/types/database'

const SIMULATIONS_COLLECTION = 'simulations'

// Convert Firestore document to SimulationRecord
function firestoreDocToSimulation(doc: { id: string; data: () => Record<string, unknown> }): SimulationRecord {
  const data = doc.data()
  return {
    id: doc.id,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agents: (data as any).agents || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    messages: (data as any).messages || [],
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    maxRounds: (data as any).maxRounds || 6,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    createdAt: (data as any).createdAt?.toDate?.()?.toISOString() || (data as any).createdAt || new Date().toISOString(),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    isComplete: (data as any).isComplete || false,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    finalRound: (data as any).finalRound || 0
  }
}

// Convert SimulationRecord to Firestore document
function simulationToFirestoreDoc(simulation: Omit<SimulationDocument, 'createdAt'> & { createdAt?: Timestamp }): Omit<SimulationDocument, 'createdAt'> & { createdAt?: Timestamp } {
  return {
    agents: simulation.agents,
    messages: simulation.messages,
    maxRounds: simulation.maxRounds,
    isComplete: simulation.isComplete,
    finalRound: simulation.finalRound,
    createdAt: Timestamp.now()
  }
}

export class SimulationService {
  // Get all simulations
  static async getAllSimulations(): Promise<SimulationRecord[]> {
    try {
      const q = query(
        collection(db, SIMULATIONS_COLLECTION),
        orderBy('createdAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToSimulation)
    } catch (error) {
      console.error('Error fetching simulations:', error)
      return []
    }
  }

  // Get simulation by ID
  static async getSimulationById(id: string): Promise<SimulationRecord | null> {
    try {
      const docRef = doc(db, SIMULATIONS_COLLECTION, id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return firestoreDocToSimulation(docSnap)
      }
      return null
    } catch (error) {
      console.error('Error fetching simulation:', error)
      return null
    }
  }

  // Get recent simulations
  static async getRecentSimulations(limitCount: number = 10): Promise<SimulationRecord[]> {
    try {
      const q = query(
        collection(db, SIMULATIONS_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToSimulation)
    } catch (error) {
      console.error('Error fetching recent simulations:', error)
      return []
    }
  }

  // Create new simulation
  static async createSimulation(simulationData: Omit<SimulationDocument, 'createdAt' | 'isComplete' | 'finalRound'>): Promise<SimulationRecord | null> {
    try {
      const docData = {
        ...simulationToFirestoreDoc({
          ...simulationData,
          isComplete: false,
          finalRound: 0
        }),
        createdAt: Timestamp.now()
      }

      const docRef = await addDoc(collection(db, SIMULATIONS_COLLECTION), docData)
      return await this.getSimulationById(docRef.id)
    } catch (error) {
      console.error('Error creating simulation:', error)
      return null
    }
  }

  // Update simulation
  static async updateSimulation(id: string, updates: Partial<SimulationDocument>): Promise<boolean> {
    try {
      const docRef = doc(db, SIMULATIONS_COLLECTION, id)
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      })
      return true
    } catch (error) {
      console.error('Error updating simulation:', error)
      return false
    }
  }

  // Delete simulation
  static async deleteSimulation(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, SIMULATIONS_COLLECTION, id))
      return true
    } catch (error) {
      console.error('Error deleting simulation:', error)
      return false
    }
  }

  // Get simulations by agent
  static async getSimulationsByAgent(agentId: string): Promise<SimulationRecord[]> {
    try {
      const q = query(
        collection(db, SIMULATIONS_COLLECTION),
        where('agents', 'array-contains', { id: agentId }),
        orderBy('createdAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToSimulation)
    } catch (error) {
      console.error('Error fetching simulations by agent:', error)
      return []
    }
  }
}
