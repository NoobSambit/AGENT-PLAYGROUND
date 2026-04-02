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
import {
  CreateMemoryData,
  MemoryListQuery,
  MemoryRecallResult,
  MemoryRecord,
  MemoryStatsSummary,
  UpdateMemoryData,
} from '@/types/database'
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
    origin: (data.origin as MemoryRecord['origin']) || 'imported',
    linkedMessageIds: (data.linkedMessageIds as string[]) || [],
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
    origin: memory.origin,
    linkedMessageIds: memory.linkedMessageIds,
    metadata: memory.metadata,
    userId: memory.userId,
    isActive: memory.isActive,
    timestamp: memory.timestamp,
  })
}

function resolveMemoryOrigin(memoryData: Pick<CreateMemoryData, 'type' | 'origin'>): MemoryRecord['origin'] {
  if (memoryData.origin) {
    return memoryData.origin
  }

  if (memoryData.type === 'conversation') {
    return 'conversation'
  }

  if (memoryData.type === 'interaction') {
    return 'tool'
  }

  if (memoryData.type === 'personality_insight') {
    return 'system'
  }

  return 'manual'
}

function isConsoleMemory(memory: MemoryRecord): boolean {
  return memory.type !== 'personality_insight' && memory.isActive !== false
}

function normalizeMemoryText(value: string): string {
  return value.trim().replace(/\s+/g, ' ')
}

function mergeStringArrays(...values: Array<string[] | undefined>): string[] {
  return [...new Set(values.flatMap((entry) => entry || []).filter(Boolean))]
}

function trimmedQueryWords(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4)
  )]
}

async function listMemoriesFromFirestore(agentId: string, options?: {
  activeOnly?: boolean
  type?: MemoryRecord['type']
  origin?: MemoryRecord['origin']
  limit?: number
  createdBefore?: string
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
  if (options?.origin) {
    records = records.filter((memory) => memory.origin === options.origin)
  }
  if (options?.createdBefore) {
    records = records.filter((memory) => new Date(memory.timestamp).getTime() <= new Date(options.createdBefore).getTime())
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
        origin: resolveMemoryOrigin(memoryData),
        linkedMessageIds: memoryData.linkedMessageIds || [],
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

  static async upsertFactMemory(params: {
    agentId: string
    factKey: string
    content: string
    summary: string
    keywords: string[]
    importance?: number
    context: string
    linkedMessageIds?: string[]
    metadata?: Record<string, unknown>
  }): Promise<MemoryRecord | null> {
    try {
      const existingFacts = await this.getMemoriesByType(params.agentId, 'fact')
      const existing = existingFacts.find((memory) => memory.metadata?.factKey === params.factKey)

      const nextMetadata = {
        ...(existing?.metadata || {}),
        ...(params.metadata || {}),
        factKey: params.factKey,
        lastConfirmedAt: new Date().toISOString(),
      }

      if (existing) {
        const updated = await this.updateMemory(existing.id, {
          content: normalizeMemoryText(params.content),
          summary: normalizeMemoryText(params.summary),
          keywords: mergeStringArrays(existing.keywords, params.keywords),
          importance: Math.max(existing.importance, params.importance ?? existing.importance),
          context: params.context,
          linkedMessageIds: mergeStringArrays(existing.linkedMessageIds, params.linkedMessageIds),
          metadata: nextMetadata,
        })

        return updated ? await this.getMemoryById(existing.id) : null
      }

      return this.createMemory({
        agentId: params.agentId,
        type: 'fact',
        content: normalizeMemoryText(params.content),
        summary: normalizeMemoryText(params.summary),
        keywords: mergeStringArrays(params.keywords, [params.factKey]),
        importance: params.importance ?? 8,
        context: params.context,
        origin: 'system',
        linkedMessageIds: params.linkedMessageIds || [],
        metadata: nextMetadata,
      })
    } catch (error) {
      console.error('Error upserting fact memory:', error)
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

  static async getRelevantMemories(
    agentId: string,
    queryText: string,
    maxMemories: number = 5,
    options?: { includeLegacyTypes?: boolean }
  ): Promise<MemoryRecord[]> {
    try {
      const allMemories = await this.getAllMemoriesForAgent(agentId)
      const relevantPool = options?.includeLegacyTypes
        ? allMemories
        : allMemories.filter(isConsoleMemory)

      const queryWords = trimmedQueryWords(queryText)
      const scoredMemories = relevantPool.map((memory) => {
        let score = 0
        const queryLower = queryText.toLowerCase()
        const contentLower = memory.content.toLowerCase()
        const summaryLower = memory.summary.toLowerCase()
        const contextLower = memory.context.toLowerCase()
        const overlap = queryWords.filter((word) => (
          contentLower.includes(word) || summaryLower.includes(word) || contextLower.includes(word)
        )).length

        memory.keywords.forEach((keyword) => {
          if (queryLower.includes(keyword.toLowerCase())) {
            score += 2
          }
        })

        if (
          contentLower.includes(queryLower) ||
          contextLower.includes(queryLower)
        ) {
          score += 1
        }

        score += overlap * 0.75
        if (memory.type === 'fact') {
          score += 1.25
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

  static async listConsoleMemories(agentId: string, query: MemoryListQuery = {}): Promise<MemoryRecord[]> {
    try {
      const memories = readsFromPostgres(getPersistenceMode())
        ? await MemoryRepository.listByAgent(agentId, {
            activeOnly: true,
            type: query.type && query.type !== 'all' ? query.type : undefined,
            origin: query.origin && query.origin !== 'all' ? query.origin : undefined,
            limit: query.limit,
            createdBefore: query.before,
            ascending: query.sort === 'oldest',
          })
        : await listMemoriesFromFirestore(agentId, {
            activeOnly: true,
            type: query.type && query.type !== 'all' ? query.type : undefined,
            origin: query.origin && query.origin !== 'all' ? query.origin : undefined,
            limit: query.limit,
            createdBefore: query.before,
          })

      let results = memories.filter(isConsoleMemory)

      if (query.searchQuery?.trim()) {
        const search = query.searchQuery.trim().toLowerCase()
        results = results.filter((memory) => (
          memory.summary.toLowerCase().includes(search)
          || memory.content.toLowerCase().includes(search)
          || memory.context.toLowerCase().includes(search)
          || memory.keywords.some((keyword) => keyword.toLowerCase().includes(search))
        ))
      }

      if (typeof query.minImportance === 'number') {
        results = results.filter((memory) => memory.importance >= query.minImportance!)
      }

      if (query.sort === 'importance') {
        results = [...results].sort((a, b) => (
          b.importance - a.importance
          || new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        ))
      } else if (query.sort === 'oldest') {
        results = [...results].sort((a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime())
      } else {
        results = [...results].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
      }

      return typeof query.limit === 'number' ? results.slice(0, query.limit) : results
    } catch (error) {
      console.error('Error fetching console memories:', error)
      return []
    }
  }

  static async recallMemories(agentId: string, queryText: string, maxMemories: number = 8): Promise<MemoryRecallResult[]> {
    try {
      const trimmedQuery = queryText.trim().toLowerCase()
      if (!trimmedQuery) {
        return []
      }

      const memories = await this.listConsoleMemories(agentId, { limit: 200 })
      const queryWords = trimmedQueryWords(trimmedQuery)
      const scoredMemories = memories.map((memory) => {
        let score = memory.importance * 0.4
        const reasons: string[] = []
        const contentLower = memory.content.toLowerCase()
        const summaryLower = memory.summary.toLowerCase()
        const contextLower = memory.context.toLowerCase()

        const exactKeywordMatches = memory.keywords.filter((keyword) => trimmedQuery.includes(keyword.toLowerCase()))
        if (exactKeywordMatches.length > 0) {
          score += exactKeywordMatches.length * 2
          reasons.push(`Matched keywords: ${exactKeywordMatches.slice(0, 3).join(', ')}`)
        }

        const overlappingWords = queryWords.filter((word) => (
          summaryLower.includes(word) || contentLower.includes(word) || contextLower.includes(word)
        ))
        if (overlappingWords.length > 0) {
          score += overlappingWords.length * 0.7
          reasons.push(`Shared terms: ${overlappingWords.slice(0, 3).join(', ')}`)
        }

        if (summaryLower.includes(trimmedQuery)) {
          score += 1.5
          reasons.push('Matched the memory summary')
        }

        if (contentLower.includes(trimmedQuery)) {
          score += 1
          reasons.push('Matched the full memory content')
        }

        if (contextLower.includes(trimmedQuery)) {
          score += 0.75
          reasons.push('Matched the memory context')
        }

        if (memory.type === 'fact') {
          score += 1.25
          reasons.push('Canonical fact memory')
        }

        return {
          memory,
          score,
          reasons,
        }
      })

      return scoredMemories
        .filter((item) => item.score > 0 && item.reasons.length > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxMemories)
    } catch (error) {
      console.error('Error recalling memories:', error)
      return []
    }
  }

  static async getConsoleMemoryStats(agentId: string): Promise<MemoryStatsSummary> {
    try {
      const memories = await this.listConsoleMemories(agentId, { limit: 500 })
      const memoriesByType = memories.reduce((acc, memory) => {
        acc[memory.type] = (acc[memory.type] || 0) + 1
        return acc
      }, {} as Record<string, number>)
      const memoriesByOrigin = memories.reduce((acc, memory) => {
        acc[memory.origin] = (acc[memory.origin] || 0) + 1
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
        memoriesByOrigin,
        averageImportance: Math.round(averageImportance * 10) / 10,
        highImportanceMemories: memories.filter((memory) => memory.importance >= 8).length,
        oldestMemory: sortedMemories[0]?.timestamp,
        newestMemory: sortedMemories[sortedMemories.length - 1]?.timestamp,
        lastSavedAt: sortedMemories[sortedMemories.length - 1]?.timestamp,
      }
    } catch (error) {
      console.error('Error fetching console memory stats:', error)
      return {
        totalMemories: 0,
        memoriesByType: {},
        memoriesByOrigin: {},
        averageImportance: 0,
        highImportanceMemories: 0,
      }
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
      const stats = await this.getConsoleMemoryStats(agentId)
      return {
        totalMemories: stats.totalMemories,
        memoriesByType: stats.memoriesByType,
        averageImportance: stats.averageImportance,
        oldestMemory: stats.oldestMemory,
        newestMemory: stats.newestMemory,
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
