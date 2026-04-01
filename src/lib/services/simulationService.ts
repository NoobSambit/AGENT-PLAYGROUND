import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  orderBy,
  query,
  setDoc,
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { generateId } from '@/lib/db/utils'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { SimulationRepository } from '@/lib/repositories/simulationRepository'
import { SimulationRecord } from '@/types/database'

const SIMULATIONS_COLLECTION = 'simulations'

function firestoreDocToSimulation(docSnap: { id: string; data: () => Record<string, unknown> }): SimulationRecord {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    agents: (data.agents as SimulationRecord['agents']) || [],
    messages: (data.messages as SimulationRecord['messages']) || [],
    maxRounds: data.maxRounds as number || 6,
    createdAt: data.createdAt as string || new Date().toISOString(),
    isComplete: data.isComplete as boolean || false,
    finalRound: data.finalRound as number || 0,
    metadata: data.metadata as SimulationRecord['metadata'] | undefined,
  }
}

function simulationToFirestoreDoc(record: SimulationRecord): Record<string, unknown> {
  return {
    agents: record.agents,
    messages: record.messages,
    maxRounds: record.maxRounds,
    createdAt: record.createdAt,
    isComplete: record.isComplete,
    finalRound: record.finalRound,
    metadata: record.metadata,
  }
}

async function getSimulationByIdFromFirestore(id: string): Promise<SimulationRecord | null> {
  const docSnap = await getDoc(doc(db, SIMULATIONS_COLLECTION, id))
  return docSnap.exists() ? firestoreDocToSimulation(docSnap) : null
}

async function getRecentSimulationsFromFirestore(limitCount: number): Promise<SimulationRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, SIMULATIONS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))
  return snapshot.docs.map(firestoreDocToSimulation)
}

async function getAllSimulationsFromFirestore(): Promise<SimulationRecord[]> {
  const snapshot = await getDocs(query(
    collection(db, SIMULATIONS_COLLECTION),
    orderBy('createdAt', 'desc')
  ))
  return snapshot.docs.map(firestoreDocToSimulation)
}

async function upsertSimulationInFirestore(record: SimulationRecord): Promise<void> {
  await setDoc(doc(db, SIMULATIONS_COLLECTION, record.id), simulationToFirestoreDoc(record))
}

async function deleteSimulationInFirestore(id: string): Promise<void> {
  await deleteDoc(doc(db, SIMULATIONS_COLLECTION, id))
}

export class SimulationService {
  static async getAllSimulations(): Promise<SimulationRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return SimulationRepository.listAll()
      }

      return getAllSimulationsFromFirestore()
    } catch (error) {
      console.error('Error fetching simulations:', error)
      return []
    }
  }

  static async getSimulationById(id: string): Promise<SimulationRecord | null> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return SimulationRepository.getById(id)
      }

      return getSimulationByIdFromFirestore(id)
    } catch (error) {
      console.error('Error fetching simulation:', error)
      return null
    }
  }

  static async getRecentSimulations(limitCount: number = 10): Promise<SimulationRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return SimulationRepository.listRecent(limitCount)
      }

      return getRecentSimulationsFromFirestore(limitCount)
    } catch (error) {
      console.error('Error fetching recent simulations:', error)
      return []
    }
  }

  static async createSimulation(simulationData: Omit<SimulationRecord, 'id'>): Promise<SimulationRecord | null> {
    try {
      const record: SimulationRecord = {
        ...simulationData,
        id: generateId('simulation'),
        createdAt: simulationData.createdAt || new Date().toISOString(),
      }

      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await upsertSimulationInFirestore(record)
        return record
      }

      if (mode === 'dual-write-firestore-read') {
        return runMirroredWrite({
          entityType: 'simulation',
          entityId: record.id,
          operation: 'create',
          payload: simulationToFirestoreDoc(record),
          primary: async () => {
            await upsertSimulationInFirestore(record)
            return record
          },
          secondary: async () => {
            await SimulationRepository.upsert(record)
          },
        })
      }

      return runMirroredWrite({
        entityType: 'simulation',
        entityId: record.id,
        operation: 'create',
        payload: simulationToFirestoreDoc(record),
        primary: async () => SimulationRepository.upsert(record),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await upsertSimulationInFirestore(record)
            }
          : undefined,
      })
    } catch (error) {
      console.error('Error creating simulation:', error)
      return null
    }
  }

  static async updateSimulation(id: string, updates: Partial<SimulationRecord>): Promise<boolean> {
    try {
      const current = await this.getSimulationById(id)
      if (!current) {
        return false
      }

      const next: SimulationRecord = {
        ...current,
        ...updates,
      }

      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await upsertSimulationInFirestore(next)
        return true
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'simulation',
          entityId: id,
          operation: 'update',
          payload: simulationToFirestoreDoc(next),
          primary: async () => {
            await upsertSimulationInFirestore(next)
            return true
          },
          secondary: async () => {
            await SimulationRepository.upsert(next)
          },
        })
        return true
      }

      await runMirroredWrite({
        entityType: 'simulation',
        entityId: id,
        operation: 'update',
        payload: simulationToFirestoreDoc(next),
        primary: async () => SimulationRepository.upsert(next),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await upsertSimulationInFirestore(next)
            }
          : undefined,
      })
      return true
    } catch (error) {
      console.error('Error updating simulation:', error)
      return false
    }
  }

  static async deleteSimulation(id: string): Promise<boolean> {
    try {
      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await deleteSimulationInFirestore(id)
        return true
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'simulation',
          entityId: id,
          operation: 'delete',
          payload: { id },
          primary: async () => {
            await deleteSimulationInFirestore(id)
            return true
          },
          secondary: async () => {
            await SimulationRepository.delete(id)
          },
        })
        return true
      }

      await runMirroredWrite({
        entityType: 'simulation',
        entityId: id,
        operation: 'delete',
        payload: { id },
        primary: async () => SimulationRepository.delete(id),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await deleteSimulationInFirestore(id)
            }
          : undefined,
      })
      return true
    } catch (error) {
      console.error('Error deleting simulation:', error)
      return false
    }
  }

  static async getSimulationsByAgent(agentId: string): Promise<SimulationRecord[]> {
    try {
      const all = readsFromPostgres(getPersistenceMode())
        ? await SimulationRepository.listAll()
        : await getAllSimulationsFromFirestore()
      return all.filter((simulation) => simulation.agents.some((agent) => agent.id === agentId))
    } catch (error) {
      console.error('Error fetching simulations by agent:', error)
      return []
    }
  }
}
