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
import {
  MemoryRecord,
  MemoryDocument,
  CreateMemoryData,
  UpdateMemoryData
} from '@/types/database'
import { stripUndefinedFields } from '@/lib/firestoreUtils'

const MEMORIES_COLLECTION = 'memories'

// Convert Firestore document to MemoryRecord
function firestoreDocToMemory(doc: { id: string; data: () => Record<string, unknown> }): MemoryRecord {
  const data = doc.data()
  return {
    id: doc.id,
    agentId: data.agentId as string || '',
    type: (data.type as MemoryRecord['type']) || 'conversation',
    content: data.content as string || '',
    summary: data.summary as string || '',
    keywords: (data.keywords as string[]) || [],
    importance: data.importance as number || 5,
    context: data.context as string || '',
    timestamp: (data.timestamp && typeof data.timestamp === 'object' && 'toDate' in data.timestamp)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (data.timestamp as any).toDate().toISOString()
      : (data.timestamp as string) || new Date().toISOString(),
    metadata: data.metadata as Record<string, unknown> | undefined,
    userId: data.userId as string | undefined,
    isActive: (data.isActive as boolean) !== false // Default to true if not specified
  }
}

// Convert MemoryRecord to Firestore document
function memoryToFirestoreDoc(
  memory: CreateMemoryData | UpdateMemoryData
): Partial<Omit<MemoryDocument, 'timestamp'>> & { timestamp?: Timestamp } {
  let isActive: boolean | undefined
  if ('agentId' in memory) {
    isActive = 'isActive' in memory ? memory.isActive !== false : true
  } else if ('isActive' in memory) {
    isActive = memory.isActive !== false
  }

  const docData: Partial<Omit<MemoryDocument, 'timestamp'>> & { timestamp?: Timestamp } = {
    agentId: 'agentId' in memory ? memory.agentId : undefined,
    type: 'type' in memory ? memory.type : undefined,
    content: 'content' in memory ? memory.content || '' : undefined,
    summary: 'summary' in memory ? memory.summary || '' : undefined,
    keywords: 'keywords' in memory ? memory.keywords || [] : undefined,
    importance: 'importance' in memory ? memory.importance ?? 5 : undefined,
    context: 'context' in memory ? memory.context || '' : undefined,
    metadata: 'metadata' in memory ? memory.metadata : undefined,
    userId: 'userId' in memory ? memory.userId : undefined,
    isActive,
  }
  return stripUndefinedFields(docData)
}

function isMissingIndexError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: string }).code === 'failed-precondition'
}

export class MemoryService {
  // Get all memories for an agent
  static async getAllMemoriesForAgent(agentId: string): Promise<MemoryRecord[]> {
    try {
      const q = query(
        collection(db, MEMORIES_COLLECTION),
        where('agentId', '==', agentId),
        where('isActive', '==', true),
        orderBy('timestamp', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToMemory)
    } catch (error) {
      if (isMissingIndexError(error)) {
        const q = query(
          collection(db, MEMORIES_COLLECTION),
          where('agentId', '==', agentId)
        )
        const querySnapshot = await getDocs(q)
        return querySnapshot.docs
          .map(firestoreDocToMemory)
          .filter(memory => memory.isActive !== false)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      }
      console.error('Error fetching memories for agent:', error)
      return []
    }
  }

  // Get memory by ID
  static async getMemoryById(id: string): Promise<MemoryRecord | null> {
    try {
      const docRef = doc(db, MEMORIES_COLLECTION, id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return firestoreDocToMemory(docSnap)
      }
      return null
    } catch (error) {
      console.error('Error fetching memory:', error)
      return null
    }
  }

  // Create new memory
  static async createMemory(memoryData: CreateMemoryData): Promise<MemoryRecord | null> {
    try {
      const docData = {
        ...memoryToFirestoreDoc(memoryData),
        timestamp: Timestamp.now()
      }

      const docRef = await addDoc(collection(db, MEMORIES_COLLECTION), docData)
      return await this.getMemoryById(docRef.id)
    } catch (error) {
      console.error('Error creating memory:', error)
      return null
    }
  }

  // Update memory
  static async updateMemory(id: string, updates: UpdateMemoryData): Promise<boolean> {
    try {
      const docRef = doc(db, MEMORIES_COLLECTION, id)
      const updateData = stripUndefinedFields(memoryToFirestoreDoc(updates))
      await updateDoc(docRef, updateData)
      return true
    } catch (error) {
      console.error('Error updating memory:', error)
      return false
    }
  }

  // Soft delete memory (mark as inactive)
  static async deleteMemory(id: string): Promise<boolean> {
    try {
      const docRef = doc(db, MEMORIES_COLLECTION, id)
      await updateDoc(docRef, { isActive: false })
      return true
    } catch (error) {
      console.error('Error deleting memory:', error)
      return false
    }
  }

  // Hard delete memory (permanent deletion)
  static async hardDeleteMemory(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, MEMORIES_COLLECTION, id))
      return true
    } catch (error) {
      console.error('Error hard deleting memory:', error)
      return false
    }
  }

  // Get memories by type for an agent
  static async getMemoriesByType(agentId: string, type: MemoryRecord['type']): Promise<MemoryRecord[]> {
    try {
      const q = query(
        collection(db, MEMORIES_COLLECTION),
        where('agentId', '==', agentId),
        where('type', '==', type),
        where('isActive', '==', true),
        orderBy('timestamp', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToMemory)
    } catch (error) {
      if (isMissingIndexError(error)) {
        const q = query(
          collection(db, MEMORIES_COLLECTION),
          where('agentId', '==', agentId)
        )
        const querySnapshot = await getDocs(q)
        return querySnapshot.docs
          .map(firestoreDocToMemory)
          .filter(memory => memory.type === type && memory.isActive !== false)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      }
      console.error('Error fetching memories by type:', error)
      return []
    }
  }

  // Get recent memories for an agent (for quick access)
  static async getRecentMemories(agentId: string, limitCount: number = 10): Promise<MemoryRecord[]> {
    try {
      const q = query(
        collection(db, MEMORIES_COLLECTION),
        where('agentId', '==', agentId),
        where('isActive', '==', true),
        orderBy('timestamp', 'desc'),
        limit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToMemory)
    } catch (error) {
      if (isMissingIndexError(error)) {
        const q = query(
          collection(db, MEMORIES_COLLECTION),
          where('agentId', '==', agentId)
        )
        const querySnapshot = await getDocs(q)
        return querySnapshot.docs
          .map(firestoreDocToMemory)
          .filter(memory => memory.isActive !== false)
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, limitCount)
      }
      console.error('Error fetching recent memories:', error)
      return []
    }
  }

  // Get relevant memories based on keywords or context
  static async getRelevantMemories(
    agentId: string,
    queryText: string,
    maxMemories: number = 5
  ): Promise<MemoryRecord[]> {
    try {
      // Get all active memories for the agent
      const allMemories = await this.getAllMemoriesForAgent(agentId)

      // Simple relevance scoring based on keyword matches
      const scoredMemories = allMemories.map(memory => {
        let score = 0

        // Check if query contains memory keywords
        const queryLower = queryText.toLowerCase()
        memory.keywords.forEach(keyword => {
          if (queryLower.includes(keyword.toLowerCase())) {
            score += 2 // Higher score for keyword matches
          }
        })

        // Check if memory content or context contains query terms
        if (memory.content.toLowerCase().includes(queryLower) ||
            memory.context.toLowerCase().includes(queryLower)) {
          score += 1
        }

        // Boost score based on importance
        score += memory.importance * 0.5

        return { memory, score }
      })

      // Sort by score and return top results
      const relevantMemories = scoredMemories
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxMemories)
        .map(item => item.memory)

      return relevantMemories
    } catch (error) {
      console.error('Error fetching relevant memories:', error)
      return []
    }
  }

  // Get memory statistics for an agent
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

      const sortedMemories = memories.sort((a, b) =>
        new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
      )

      return {
        totalMemories: memories.length,
        memoriesByType,
        averageImportance: Math.round(averageImportance * 10) / 10,
        oldestMemory: sortedMemories[0]?.timestamp,
        newestMemory: sortedMemories[sortedMemories.length - 1]?.timestamp
      }
    } catch (error) {
      console.error('Error fetching memory stats:', error)
      return {
        totalMemories: 0,
        memoriesByType: {},
        averageImportance: 0
      }
    }
  }
}
