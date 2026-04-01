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
  limit,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { generateId } from '@/lib/db/utils'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { MemoryRepository } from '@/lib/repositories/memoryRepository'
import { CreateMemoryData, MemoryRecord, UpdateMemoryData } from '@/types/database'
import { AgentService } from './agentService'

const MEMORIES_COLLECTION = 'memories'

function stripUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as T
}

function firestoreDocToMemory(docSnap: { id: string; data: () => Record<string, unknown> }): MemoryRecord {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    agentId: data.agentId as string || '',
    type: (data.type as MemoryRecord['type']) || 'conversation',
    content: data.content as string || '',
    summary: data.summary as string || '',
    keywords: (data.keywords as string[]) || [],
    importance: data.importance as number || 5,
    context: data.context as string || '',
    timestamp: data.timestamp as string || new Date().toISOString(),
    metadata: data.metadata as Record<string, unknown> | undefined,
    userId: data.userId as string | undefined,
    isActive: (data.isActive as boolean) !== false,
  }
}

function memoryToFirestoreDoc(memory: Partial<MemoryRecord>): Record<string, unknown> {
  return stripUndefinedFields({
    agentId: memory.agentId,
    type: memory.type,
    content: memory.content,
    summary: memory.summary,
    keywords: memory.keywords,
    importance: memory.importance,
    context: memory.context,
    metadata: memory.metadata,
    userId: memory.userId,
    isActive: memory.isActive,
    timestamp: memory.timestamp,
  })
}

async function listMemoriesFromFirestore(agentId: string, options?: {
  activeOnly?: boolean
  type?: MemoryRecord['type']
  limit?: number
}): Promise<MemoryRecord[]> {
  let memoriesQuery = query(
    collection(db, MEMORIES_COLLECTION),
    where('agentId', '==', agentId),
    orderBy('timestamp', 'desc')
  )

  if (options?.type) {
    memoriesQuery = query(
      collection(db, MEMORIES_COLLECTION),
      where('agentId', '==', agentId),
      where('type', '==', options.type),
      orderBy('timestamp', 'desc')
    )
  }

  if (options?.limit) {
    memoriesQuery = query(memoriesQuery, limit(options.limit))
  }

  const snapshot = await getDocs(memoriesQuery)
  let records = snapshot.docs.map(firestoreDocToMemory)
  if (options?.activeOnly !== false) {
    records = records.filter((memory) => memory.isActive !== false)
  }
  return records
}

async function getMemoryByIdFromFirestore(id: string): Promise<MemoryRecord | null> {
  const snapshot = await getDoc(doc(db, MEMORIES_COLLECTION, id))
  return snapshot.exists() ? firestoreDocToMemory(snapshot) : null
}

async function upsertMemoryInFirestore(record: MemoryRecord): Promise<void> {
  await setDoc(doc(db, MEMORIES_COLLECTION, record.id), memoryToFirestoreDoc(record))
}

async function updateMemoryInFirestore(id: string, updates: Partial<MemoryRecord>): Promise<void> {
  await updateDoc(doc(db, MEMORIES_COLLECTION, id), memoryToFirestoreDoc(updates))
}

async function deleteMemoryInFirestore(id: string): Promise<void> {
  await deleteDoc(doc(db, MEMORIES_COLLECTION, id))
}

async function updateAgentMemoryCount(agentId: string, delta: number): Promise<void> {
  const agent = await AgentService.getAgentById(agentId)
  if (!agent) {
    return
  }

  await AgentService.updateAgent(agentId, {
    memoryCount: Math.max(0, (agent.memoryCount || 0) + delta),
  })
}

export class MemoryService {
  static async getAllMemoriesForAgent(agentId: string): Promise<MemoryRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return MemoryRepository.listByAgent(agentId, { activeOnly: true })
      }

      return listMemoriesFromFirestore(agentId, { activeOnly: true })
    } catch (error) {
      console.error('Error fetching memories for agent:', error)
      return []
    }
  }

  static async getMemoryById(id: string): Promise<MemoryRecord | null> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return MemoryRepository.getById(id)
      }

      return getMemoryByIdFromFirestore(id)
    } catch (error) {
      console.error('Error fetching memory:', error)
      return null
    }
  }

  static async createMemory(memoryData: CreateMemoryData): Promise<MemoryRecord | null> {
    try {
      const record: MemoryRecord = {
        id: generateId('memory'),
        agentId: memoryData.agentId,
        type: memoryData.type,
        content: memoryData.content,
        summary: memoryData.summary,
        keywords: memoryData.keywords || [],
        importance: memoryData.importance ?? 5,
        context: memoryData.context,
        metadata: memoryData.metadata,
        userId: memoryData.userId,
        isActive: true,
        timestamp: new Date().toISOString(),
      }

      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await upsertMemoryInFirestore(record)
        await updateAgentMemoryCount(record.agentId, 1)
        return record
      }

      if (mode === 'dual-write-firestore-read') {
        const created = await runMirroredWrite({
          entityType: 'memory',
          entityId: record.id,
          operation: 'create',
          payload: memoryToFirestoreDoc(record),
          primary: async () => {
            await upsertMemoryInFirestore(record)
            return record
          },
          secondary: async () => {
            await MemoryRepository.create(record)
          },
        })
        await updateAgentMemoryCount(record.agentId, 1)
        return created
      }

      const created = await runMirroredWrite({
        entityType: 'memory',
        entityId: record.id,
        operation: 'create',
        payload: memoryToFirestoreDoc(record),
        primary: async () => MemoryRepository.create(record),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await upsertMemoryInFirestore(record)
            }
          : undefined,
      })
      await updateAgentMemoryCount(record.agentId, 1)
      return created
    } catch (error) {
      console.error('Error creating memory:', error)
      return null
    }
  }

  static async updateMemory(id: string, updates: UpdateMemoryData): Promise<boolean> {
    try {
      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await updateMemoryInFirestore(id, updates)
        return true
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'memory',
          entityId: id,
          operation: 'update',
          payload: updates as Record<string, unknown>,
          primary: async () => {
            await updateMemoryInFirestore(id, updates)
            return true
          },
          secondary: async () => {
            await MemoryRepository.update(id, updates)
          },
        })
        return true
      }

      await runMirroredWrite({
        entityType: 'memory',
        entityId: id,
        operation: 'update',
        payload: updates as Record<string, unknown>,
        primary: async () => MemoryRepository.update(id, updates),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await updateMemoryInFirestore(id, updates)
            }
          : undefined,
      })
      return true
    } catch (error) {
      console.error('Error updating memory:', error)
      return false
    }
  }

  static async deleteMemory(id: string): Promise<boolean> {
    try {
      const existingMemory = await this.getMemoryById(id)
      if (!existingMemory || existingMemory.isActive === false) {
        return false
      }

      const updates = { isActive: false }
      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await updateMemoryInFirestore(id, updates)
        await updateAgentMemoryCount(existingMemory.agentId, -1)
        return true
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'memory',
          entityId: id,
          operation: 'soft_delete',
          payload: updates,
          primary: async () => {
            await updateMemoryInFirestore(id, updates)
            return true
          },
          secondary: async () => {
            await MemoryRepository.update(id, updates)
          },
        })
        await updateAgentMemoryCount(existingMemory.agentId, -1)
        return true
      }

      await runMirroredWrite({
        entityType: 'memory',
        entityId: id,
        operation: 'soft_delete',
        payload: updates,
        primary: async () => MemoryRepository.update(id, updates),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await updateMemoryInFirestore(id, updates)
            }
          : undefined,
      })
      await updateAgentMemoryCount(existingMemory.agentId, -1)
      return true
    } catch (error) {
      console.error('Error deleting memory:', error)
      return false
    }
  }

  static async hardDeleteMemory(id: string): Promise<boolean> {
    try {
      const existingMemory = await this.getMemoryById(id)
      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await deleteMemoryInFirestore(id)
      } else if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'memory',
          entityId: id,
          operation: 'hard_delete',
          payload: { id },
          primary: async () => {
            await deleteMemoryInFirestore(id)
            return true
          },
          secondary: async () => {
            await MemoryRepository.delete(id)
          },
        })
      } else {
        await runMirroredWrite({
          entityType: 'memory',
          entityId: id,
          operation: 'hard_delete',
          payload: { id },
          primary: async () => MemoryRepository.delete(id),
          secondary: mode === 'dual-write-postgres-read'
            ? async () => {
                await deleteMemoryInFirestore(id)
              }
            : undefined,
        })
      }

      if (existingMemory && existingMemory.isActive !== false) {
        await updateAgentMemoryCount(existingMemory.agentId, -1)
      }
      return true
    } catch (error) {
      console.error('Error hard deleting memory:', error)
      return false
    }
  }

  static async getMemoriesByType(agentId: string, type: MemoryRecord['type']): Promise<MemoryRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return MemoryRepository.listByAgent(agentId, { activeOnly: true, type })
      }

      return listMemoriesFromFirestore(agentId, { activeOnly: true, type })
    } catch (error) {
      console.error('Error fetching memories by type:', error)
      return []
    }
  }

  static async getRecentMemories(agentId: string, limitCount: number = 10): Promise<MemoryRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return MemoryRepository.listByAgent(agentId, { activeOnly: true, limit: limitCount })
      }

      return listMemoriesFromFirestore(agentId, { activeOnly: true, limit: limitCount })
    } catch (error) {
      console.error('Error fetching recent memories:', error)
      return []
    }
  }

  static async getRelevantMemories(agentId: string, queryText: string, maxMemories: number = 5): Promise<MemoryRecord[]> {
    try {
      const allMemories = await this.getAllMemoriesForAgent(agentId)
      const scoredMemories = allMemories.map((memory) => {
        let score = 0
        const queryLower = queryText.toLowerCase()

        memory.keywords.forEach((keyword) => {
          if (queryLower.includes(keyword.toLowerCase())) {
            score += 2
          }
        })

        if (
          memory.content.toLowerCase().includes(queryLower) ||
          memory.context.toLowerCase().includes(queryLower)
        ) {
          score += 1
        }

        score += memory.importance * 0.5
        return { memory, score }
      })

      return scoredMemories
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxMemories)
        .map((item) => item.memory)
    } catch (error) {
      console.error('Error fetching relevant memories:', error)
      return []
    }
  }

  static async getMemoryStats(agentId: string): Promise<{
    totalMemories: number
    memoriesByType: Record<string, number>
    averageImportance: number
    oldestMemory?: string
    newestMemory?: string
  }> {
    try {
      const memories = await this.getAllMemoriesForAgent(agentId)
      const memoriesByType = memories.reduce((acc, memory) => {
        acc[memory.type] = (acc[memory.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)

      const averageImportance = memories.length > 0
        ? memories.reduce((sum, memory) => sum + memory.importance, 0) / memories.length
        : 0

      const sortedMemories = [...memories].sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )

      return {
        totalMemories: memories.length,
        memoriesByType,
        averageImportance: Math.round(averageImportance * 10) / 10,
        oldestMemory: sortedMemories[0]?.timestamp,
        newestMemory: sortedMemories[sortedMemories.length - 1]?.timestamp,
      }
    } catch (error) {
      console.error('Error fetching memory stats:', error)
      return {
        totalMemories: 0,
        memoriesByType: {},
        averageImportance: 0,
      }
    }
  }
}
