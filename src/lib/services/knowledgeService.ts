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
import { KnowledgeRepository } from '@/lib/repositories/knowledgeRepository'
import { KnowledgeCategory, SharedKnowledge } from '@/types/database'

const KNOWLEDGE_COLLECTION = 'shared_knowledge'

function stripUndefinedFields<T extends Record<string, unknown>>(data: T): T {
  return Object.fromEntries(
    Object.entries(data).filter(([, value]) => value !== undefined)
  ) as T
}

function firestoreDocToKnowledge(docSnap: { id: string; data: () => Record<string, unknown> }): SharedKnowledge {
  const data = docSnap.data()
  return {
    id: docSnap.id,
    topic: data.topic as string || '',
    category: (data.category as KnowledgeCategory) || 'fact',
    content: data.content as string || '',
    contributorId: data.contributorId as string || '',
    contributorName: data.contributorName as string || '',
    endorsements: (data.endorsements as string[]) || [],
    disputes: (data.disputes as SharedKnowledge['disputes']) || [],
    accessCount: data.accessCount as number || 0,
    lastAccessedAt: data.lastAccessedAt as string || new Date().toISOString(),
    usedByAgents: (data.usedByAgents as string[]) || [],
    tags: (data.tags as string[]) || [],
    confidence: data.confidence as number || 0.5,
    createdAt: data.createdAt as string || new Date().toISOString(),
    updatedAt: data.updatedAt as string || new Date().toISOString(),
  }
}

function knowledgeToFirestoreDoc(knowledge: SharedKnowledge): Record<string, unknown> {
  return stripUndefinedFields({
    topic: knowledge.topic,
    category: knowledge.category,
    content: knowledge.content,
    contributorId: knowledge.contributorId,
    contributorName: knowledge.contributorName,
    endorsements: knowledge.endorsements,
    disputes: knowledge.disputes,
    accessCount: knowledge.accessCount,
    lastAccessedAt: knowledge.lastAccessedAt,
    usedByAgents: knowledge.usedByAgents,
    tags: knowledge.tags,
    confidence: knowledge.confidence,
    createdAt: knowledge.createdAt,
    updatedAt: knowledge.updatedAt,
  })
}

async function listKnowledgeFromFirestore(limitCount: number = 100): Promise<SharedKnowledge[]> {
  const snapshot = await getDocs(query(
    collection(db, KNOWLEDGE_COLLECTION),
    orderBy('confidence', 'desc'),
    limit(limitCount)
  ))
  return snapshot.docs.map(firestoreDocToKnowledge)
}

async function getKnowledgeByIdFromFirestore(id: string): Promise<SharedKnowledge | null> {
  const docSnap = await getDoc(doc(db, KNOWLEDGE_COLLECTION, id))
  return docSnap.exists() ? firestoreDocToKnowledge(docSnap) : null
}

async function getKnowledgeByCategoryFromFirestore(category: KnowledgeCategory): Promise<SharedKnowledge[]> {
  const snapshot = await getDocs(query(
    collection(db, KNOWLEDGE_COLLECTION),
    where('category', '==', category),
    orderBy('confidence', 'desc')
  ))
  return snapshot.docs.map(firestoreDocToKnowledge)
}

async function upsertKnowledgeInFirestore(knowledge: SharedKnowledge): Promise<void> {
  await setDoc(doc(db, KNOWLEDGE_COLLECTION, knowledge.id), knowledgeToFirestoreDoc(knowledge))
}

async function updateKnowledgeInFirestore(id: string, updates: Partial<SharedKnowledge>): Promise<void> {
  await updateDoc(doc(db, KNOWLEDGE_COLLECTION, id), stripUndefinedFields({
    topic: updates.topic,
    category: updates.category,
    content: updates.content,
    tags: updates.tags,
    confidence: updates.confidence,
    endorsements: updates.endorsements,
    disputes: updates.disputes,
    accessCount: updates.accessCount,
    lastAccessedAt: updates.lastAccessedAt,
    usedByAgents: updates.usedByAgents,
    updatedAt: updates.updatedAt,
  }))
}

async function deleteKnowledgeInFirestore(id: string): Promise<void> {
  await deleteDoc(doc(db, KNOWLEDGE_COLLECTION, id))
}

export class KnowledgeService {
  static async getAllKnowledge(): Promise<SharedKnowledge[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return KnowledgeRepository.listAll()
      }

      return listKnowledgeFromFirestore()
    } catch (error) {
      console.error('Error fetching shared knowledge:', error)
      return []
    }
  }

  static async getKnowledgeByCategory(category: KnowledgeCategory): Promise<SharedKnowledge[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return KnowledgeRepository.listByCategory(category)
      }

      return getKnowledgeByCategoryFromFirestore(category)
    } catch (error) {
      console.error('Error fetching knowledge by category:', error)
      return []
    }
  }

  static async getKnowledgeById(id: string): Promise<SharedKnowledge | null> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return KnowledgeRepository.getById(id)
      }

      return getKnowledgeByIdFromFirestore(id)
    } catch (error) {
      console.error('Error fetching knowledge:', error)
      return null
    }
  }

  static async searchKnowledge(searchQuery: string): Promise<SharedKnowledge[]> {
    try {
      const allKnowledge = await this.getAllKnowledge()
      const queryLower = searchQuery.toLowerCase()

      return allKnowledge.filter((entry) =>
        entry.topic.toLowerCase().includes(queryLower) ||
        entry.content.toLowerCase().includes(queryLower) ||
        entry.tags.some((tag) => tag.toLowerCase().includes(queryLower))
      )
    } catch (error) {
      console.error('Error searching knowledge:', error)
      return []
    }
  }

  static async createKnowledge(
    knowledge: Omit<SharedKnowledge, 'id' | 'endorsements' | 'disputes' | 'accessCount' | 'lastAccessedAt' | 'usedByAgents' | 'createdAt' | 'updatedAt'>
  ): Promise<SharedKnowledge | null> {
    try {
      const now = new Date().toISOString()
      const record: SharedKnowledge = {
        ...knowledge,
        id: generateId('knowledge'),
        endorsements: [knowledge.contributorId],
        disputes: [],
        accessCount: 0,
        lastAccessedAt: now,
        usedByAgents: [],
        createdAt: now,
        updatedAt: now,
      }

      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await upsertKnowledgeInFirestore(record)
        return record
      }

      if (mode === 'dual-write-firestore-read') {
        return runMirroredWrite({
          entityType: 'knowledge',
          entityId: record.id,
          operation: 'create',
          payload: knowledgeToFirestoreDoc(record),
          primary: async () => {
            await upsertKnowledgeInFirestore(record)
            return record
          },
          secondary: async () => {
            await KnowledgeRepository.upsert(record)
          },
        })
      }

      return runMirroredWrite({
        entityType: 'knowledge',
        entityId: record.id,
        operation: 'create',
        payload: knowledgeToFirestoreDoc(record),
        primary: async () => KnowledgeRepository.upsert(record),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await upsertKnowledgeInFirestore(record)
            }
          : undefined,
      })
    } catch (error) {
      console.error('Error creating knowledge:', error)
      return null
    }
  }

  static async updateKnowledge(
    id: string,
    updates: Partial<Pick<SharedKnowledge, 'topic' | 'content' | 'category' | 'tags' | 'confidence'>>
  ): Promise<boolean> {
    try {
      const current = await this.getKnowledgeById(id)
      if (!current) {
        return false
      }

      const next: SharedKnowledge = {
        ...current,
        ...updates,
        updatedAt: new Date().toISOString(),
      }

      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await updateKnowledgeInFirestore(id, next)
        return true
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'knowledge',
          entityId: id,
          operation: 'update',
          payload: updates as Record<string, unknown>,
          primary: async () => {
            await updateKnowledgeInFirestore(id, next)
            return true
          },
          secondary: async () => {
            await KnowledgeRepository.upsert(next)
          },
        })
        return true
      }

      await runMirroredWrite({
        entityType: 'knowledge',
        entityId: id,
        operation: 'update',
        payload: updates as Record<string, unknown>,
        primary: async () => KnowledgeRepository.upsert(next),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await updateKnowledgeInFirestore(id, next)
            }
          : undefined,
      })
      return true
    } catch (error) {
      console.error('Error updating knowledge:', error)
      return false
    }
  }

  static async deleteKnowledge(id: string): Promise<boolean> {
    try {
      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await deleteKnowledgeInFirestore(id)
        return true
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'knowledge',
          entityId: id,
          operation: 'delete',
          payload: { id },
          primary: async () => {
            await deleteKnowledgeInFirestore(id)
            return true
          },
          secondary: async () => {
            await KnowledgeRepository.delete(id)
          },
        })
        return true
      }

      await runMirroredWrite({
        entityType: 'knowledge',
        entityId: id,
        operation: 'delete',
        payload: { id },
        primary: async () => KnowledgeRepository.delete(id),
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await deleteKnowledgeInFirestore(id)
            }
          : undefined,
      })
      return true
    } catch (error) {
      console.error('Error deleting knowledge:', error)
      return false
    }
  }

  static async endorseKnowledge(knowledgeId: string, agentId: string): Promise<boolean> {
    try {
      const knowledge = await this.getKnowledgeById(knowledgeId)
      if (!knowledge) return false
      if (knowledge.endorsements.includes(agentId)) return true

      return this.updateKnowledgeState({
        ...knowledge,
        endorsements: [...knowledge.endorsements, agentId],
        confidence: Math.min(1, knowledge.confidence + 0.1),
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error endorsing knowledge:', error)
      return false
    }
  }

  static async removeEndorsement(knowledgeId: string, agentId: string): Promise<boolean> {
    try {
      const knowledge = await this.getKnowledgeById(knowledgeId)
      if (!knowledge) return false

      return this.updateKnowledgeState({
        ...knowledge,
        endorsements: knowledge.endorsements.filter((id) => id !== agentId),
        confidence: Math.max(0.1, knowledge.confidence - 0.1),
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error removing endorsement:', error)
      return false
    }
  }

  static async disputeKnowledge(knowledgeId: string, agentId: string, reason: string): Promise<boolean> {
    try {
      const knowledge = await this.getKnowledgeById(knowledgeId)
      if (!knowledge) return false
      if (knowledge.disputes.some((dispute) => dispute.agentId === agentId)) return false

      return this.updateKnowledgeState({
        ...knowledge,
        disputes: [
          ...knowledge.disputes,
          {
            agentId,
            reason,
            timestamp: new Date().toISOString(),
          },
        ],
        confidence: Math.max(0.1, knowledge.confidence - 0.15),
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error disputing knowledge:', error)
      return false
    }
  }

  static async resolveDispute(knowledgeId: string, agentId: string): Promise<boolean> {
    try {
      const knowledge = await this.getKnowledgeById(knowledgeId)
      if (!knowledge) return false

      return this.updateKnowledgeState({
        ...knowledge,
        disputes: knowledge.disputes.filter((dispute) => dispute.agentId !== agentId),
        confidence: Math.min(1, knowledge.confidence + 0.05),
        updatedAt: new Date().toISOString(),
      })
    } catch (error) {
      console.error('Error resolving dispute:', error)
      return false
    }
  }

  static async trackKnowledgeUsage(knowledgeId: string, agentId: string): Promise<boolean> {
    try {
      const knowledge = await this.getKnowledgeById(knowledgeId)
      if (!knowledge) return false

      return this.updateKnowledgeState({
        ...knowledge,
        accessCount: knowledge.accessCount + 1,
        lastAccessedAt: new Date().toISOString(),
        usedByAgents: knowledge.usedByAgents.includes(agentId)
          ? knowledge.usedByAgents
          : [...knowledge.usedByAgents, agentId],
      })
    } catch (error) {
      console.error('Error tracking knowledge usage:', error)
      return false
    }
  }

  static async getRelevantKnowledge(queryText: string, agentId: string, maxResults: number = 5): Promise<SharedKnowledge[]> {
    try {
      const allKnowledge = await this.getAllKnowledge()
      const queryLower = queryText.toLowerCase()
      const queryWords = queryLower.split(/\s+/)

      const results = allKnowledge
        .map((entry) => {
          let score = 0
          for (const word of queryWords) {
            if (entry.topic.toLowerCase().includes(word)) score += 2
            if (entry.content.toLowerCase().includes(word)) score += 1
            if (entry.tags.some((tag) => tag.toLowerCase().includes(word))) score += 1.5
          }
          score *= entry.confidence
          if (entry.usedByAgents.includes(agentId)) score += 0.5
          return { entry, score }
        })
        .filter((item) => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map((item) => item.entry)

      for (const entry of results) {
        await this.trackKnowledgeUsage(entry.id, agentId)
      }

      return results
    } catch (error) {
      console.error('Error getting relevant knowledge:', error)
      return []
    }
  }

  static async getAgentContributions(agentId: string): Promise<SharedKnowledge[]> {
    try {
      const allKnowledge = await this.getAllKnowledge()
      return allKnowledge.filter((entry) => entry.contributorId === agentId)
    } catch (error) {
      console.error('Error fetching agent contributions:', error)
      return []
    }
  }

  static async getMostAccessedKnowledge(limitCount: number = 10): Promise<SharedKnowledge[]> {
    const allKnowledge = await this.getAllKnowledge()
    return [...allKnowledge].sort((a, b) => b.accessCount - a.accessCount).slice(0, limitCount)
  }

  static async getPopularKnowledge(limitCount: number = 10): Promise<SharedKnowledge[]> {
    return this.getMostAccessedKnowledge(limitCount)
  }

  static generateKnowledgePrompt(entries: SharedKnowledge[]): string {
    if (entries.length === 0) {
      return 'No relevant shared knowledge was found.'
    }

    return entries
      .map((entry, index) => {
        const tags = entry.tags.length > 0 ? ` Tags: ${entry.tags.join(', ')}.` : ''
        return `${index + 1}. ${entry.topic} (${entry.category}, confidence ${entry.confidence.toFixed(2)}): ${entry.content}${tags}`
      })
      .join('\n')
  }

  static async getRecentKnowledge(limitCount: number = 10): Promise<SharedKnowledge[]> {
    const allKnowledge = await this.getAllKnowledge()
    return [...allKnowledge]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, limitCount)
  }

  static async getKnowledgeStats(): Promise<{
    totalKnowledge: number
    byCategory: Record<string, number>
    totalEndorsements: number
    totalDisputes: number
    averageConfidence: number
    mostUsedTopic: string | null
  }> {
    const knowledge = await this.getAllKnowledge()
    const byCategory: Record<string, number> = {}
    let totalEndorsements = 0
    let totalDisputes = 0
    let confidenceTotal = 0
    let mostUsedTopic: string | null = null
    let highestAccessCount = -1

    for (const entry of knowledge) {
      byCategory[entry.category] = (byCategory[entry.category] || 0) + 1
      totalEndorsements += entry.endorsements.length
      totalDisputes += entry.disputes.length
      confidenceTotal += entry.confidence

      if (entry.accessCount > highestAccessCount) {
        highestAccessCount = entry.accessCount
        mostUsedTopic = entry.topic
      }
    }

    return {
      totalKnowledge: knowledge.length,
      byCategory,
      totalEndorsements,
      totalDisputes,
      averageConfidence: knowledge.length > 0 ? confidenceTotal / knowledge.length : 0,
      mostUsedTopic,
    }
  }

  private static async updateKnowledgeState(record: SharedKnowledge): Promise<boolean> {
    const mode = getPersistenceMode()

    if (mode === 'firestore') {
      await updateKnowledgeInFirestore(record.id, record)
      return true
    }

    if (mode === 'dual-write-firestore-read') {
      await runMirroredWrite({
        entityType: 'knowledge',
        entityId: record.id,
        operation: 'state_update',
        payload: knowledgeToFirestoreDoc(record),
        primary: async () => {
          await updateKnowledgeInFirestore(record.id, record)
          return true
        },
        secondary: async () => {
          await KnowledgeRepository.upsert(record)
        },
      })
      return true
    }

    await runMirroredWrite({
      entityType: 'knowledge',
      entityId: record.id,
      operation: 'state_update',
      payload: knowledgeToFirestoreDoc(record),
      primary: async () => KnowledgeRepository.upsert(record),
      secondary: mode === 'dual-write-postgres-read'
        ? async () => {
            await updateKnowledgeInFirestore(record.id, record)
          }
        : undefined,
    })
    return true
  }
}
