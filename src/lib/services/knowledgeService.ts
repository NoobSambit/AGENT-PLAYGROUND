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
  SharedKnowledge,
  KnowledgeCategory
} from '@/types/database'

const KNOWLEDGE_COLLECTION = 'shared_knowledge'

// Convert Firestore document to SharedKnowledge
function firestoreDocToKnowledge(
  docSnap: { id: string; data: () => Record<string, unknown> }
): SharedKnowledge {
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
    lastAccessedAt: (data.lastAccessedAt && typeof data.lastAccessedAt === 'object' && 'toDate' in data.lastAccessedAt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (data.lastAccessedAt as any).toDate().toISOString()
      : (data.lastAccessedAt as string) || new Date().toISOString(),
    usedByAgents: (data.usedByAgents as string[]) || [],
    tags: (data.tags as string[]) || [],
    confidence: data.confidence as number || 0.5,
    createdAt: (data.createdAt && typeof data.createdAt === 'object' && 'toDate' in data.createdAt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (data.createdAt as any).toDate().toISOString()
      : (data.createdAt as string) || new Date().toISOString(),
    updatedAt: (data.updatedAt && typeof data.updatedAt === 'object' && 'toDate' in data.updatedAt)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      ? (data.updatedAt as any).toDate().toISOString()
      : (data.updatedAt as string) || new Date().toISOString()
  }
}

export class KnowledgeService {
  /**
   * Get all shared knowledge
   */
  static async getAllKnowledge(): Promise<SharedKnowledge[]> {
    try {
      const q = query(
        collection(db, KNOWLEDGE_COLLECTION),
        orderBy('confidence', 'desc'),
        limit(100)
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToKnowledge)
    } catch (error) {
      console.error('Error fetching shared knowledge:', error)
      return []
    }
  }

  /**
   * Get knowledge by category
   */
  static async getKnowledgeByCategory(category: KnowledgeCategory): Promise<SharedKnowledge[]> {
    try {
      const q = query(
        collection(db, KNOWLEDGE_COLLECTION),
        where('category', '==', category),
        orderBy('confidence', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToKnowledge)
    } catch (error) {
      console.error('Error fetching knowledge by category:', error)
      return []
    }
  }

  /**
   * Get knowledge by ID
   */
  static async getKnowledgeById(id: string): Promise<SharedKnowledge | null> {
    try {
      const docRef = doc(db, KNOWLEDGE_COLLECTION, id)
      const docSnap = await getDoc(docRef)

      if (docSnap.exists()) {
        return firestoreDocToKnowledge(docSnap)
      }
      return null
    } catch (error) {
      console.error('Error fetching knowledge:', error)
      return null
    }
  }

  /**
   * Search knowledge by topic or content
   */
  static async searchKnowledge(searchQuery: string): Promise<SharedKnowledge[]> {
    try {
      // Get all knowledge and filter client-side (Firestore doesn't support full-text search)
      const allKnowledge = await this.getAllKnowledge()
      const queryLower = searchQuery.toLowerCase()

      return allKnowledge.filter(k =>
        k.topic.toLowerCase().includes(queryLower) ||
        k.content.toLowerCase().includes(queryLower) ||
        k.tags.some(t => t.toLowerCase().includes(queryLower))
      )
    } catch (error) {
      console.error('Error searching knowledge:', error)
      return []
    }
  }

  /**
   * Create new shared knowledge
   */
  static async createKnowledge(
    knowledge: Omit<SharedKnowledge, 'id' | 'endorsements' | 'disputes' | 'accessCount' | 'lastAccessedAt' | 'usedByAgents' | 'createdAt' | 'updatedAt'>
  ): Promise<SharedKnowledge | null> {
    try {
      const now = Timestamp.now()

      const docData = {
        ...knowledge,
        endorsements: [knowledge.contributorId], // Creator auto-endorses
        disputes: [],
        accessCount: 0,
        lastAccessedAt: now,
        usedByAgents: [],
        createdAt: now,
        updatedAt: now
      }

      const docRef = await addDoc(collection(db, KNOWLEDGE_COLLECTION), docData)
      return await this.getKnowledgeById(docRef.id)
    } catch (error) {
      console.error('Error creating knowledge:', error)
      return null
    }
  }

  /**
   * Update shared knowledge
   */
  static async updateKnowledge(
    id: string,
    updates: Partial<Pick<SharedKnowledge, 'topic' | 'content' | 'category' | 'tags' | 'confidence'>>
  ): Promise<boolean> {
    try {
      const docRef = doc(db, KNOWLEDGE_COLLECTION, id)
      await updateDoc(docRef, {
        ...updates,
        updatedAt: Timestamp.now()
      })
      return true
    } catch (error) {
      console.error('Error updating knowledge:', error)
      return false
    }
  }

  /**
   * Delete shared knowledge
   */
  static async deleteKnowledge(id: string): Promise<boolean> {
    try {
      await deleteDoc(doc(db, KNOWLEDGE_COLLECTION, id))
      return true
    } catch (error) {
      console.error('Error deleting knowledge:', error)
      return false
    }
  }

  /**
   * Endorse a piece of knowledge
   */
  static async endorseKnowledge(knowledgeId: string, agentId: string): Promise<boolean> {
    try {
      const knowledge = await this.getKnowledgeById(knowledgeId)
      if (!knowledge) return false

      // Check if already endorsed
      if (knowledge.endorsements.includes(agentId)) return true

      // Add endorsement
      const newEndorsements = [...knowledge.endorsements, agentId]

      // Recalculate confidence based on endorsements
      const newConfidence = Math.min(1, knowledge.confidence + 0.1)

      const docRef = doc(db, KNOWLEDGE_COLLECTION, knowledgeId)
      await updateDoc(docRef, {
        endorsements: newEndorsements,
        confidence: newConfidence,
        updatedAt: Timestamp.now()
      })

      return true
    } catch (error) {
      console.error('Error endorsing knowledge:', error)
      return false
    }
  }

  /**
   * Remove endorsement from knowledge
   */
  static async removeEndorsement(knowledgeId: string, agentId: string): Promise<boolean> {
    try {
      const knowledge = await this.getKnowledgeById(knowledgeId)
      if (!knowledge) return false

      // Remove endorsement
      const newEndorsements = knowledge.endorsements.filter(id => id !== agentId)

      // Recalculate confidence
      const newConfidence = Math.max(0.1, knowledge.confidence - 0.1)

      const docRef = doc(db, KNOWLEDGE_COLLECTION, knowledgeId)
      await updateDoc(docRef, {
        endorsements: newEndorsements,
        confidence: newConfidence,
        updatedAt: Timestamp.now()
      })

      return true
    } catch (error) {
      console.error('Error removing endorsement:', error)
      return false
    }
  }

  /**
   * Dispute a piece of knowledge
   */
  static async disputeKnowledge(
    knowledgeId: string,
    agentId: string,
    reason: string
  ): Promise<boolean> {
    try {
      const knowledge = await this.getKnowledgeById(knowledgeId)
      if (!knowledge) return false

      // Check if already disputed by this agent
      if (knowledge.disputes.some(d => d.agentId === agentId)) return false

      // Add dispute
      const newDispute = {
        agentId,
        reason,
        timestamp: new Date().toISOString()
      }

      // Decrease confidence based on disputes
      const newConfidence = Math.max(0.1, knowledge.confidence - 0.15)

      const docRef = doc(db, KNOWLEDGE_COLLECTION, knowledgeId)
      await updateDoc(docRef, {
        disputes: [...knowledge.disputes, newDispute],
        confidence: newConfidence,
        updatedAt: Timestamp.now()
      })

      return true
    } catch (error) {
      console.error('Error disputing knowledge:', error)
      return false
    }
  }

  /**
   * Resolve a dispute
   */
  static async resolveDispute(knowledgeId: string, agentId: string): Promise<boolean> {
    try {
      const knowledge = await this.getKnowledgeById(knowledgeId)
      if (!knowledge) return false

      // Remove dispute
      const newDisputes = knowledge.disputes.filter(d => d.agentId !== agentId)

      // Slightly increase confidence when disputes are resolved
      const newConfidence = Math.min(1, knowledge.confidence + 0.05)

      const docRef = doc(db, KNOWLEDGE_COLLECTION, knowledgeId)
      await updateDoc(docRef, {
        disputes: newDisputes,
        confidence: newConfidence,
        updatedAt: Timestamp.now()
      })

      return true
    } catch (error) {
      console.error('Error resolving dispute:', error)
      return false
    }
  }

  /**
   * Track knowledge usage by an agent
   */
  static async trackKnowledgeUsage(knowledgeId: string, agentId: string): Promise<boolean> {
    try {
      const knowledge = await this.getKnowledgeById(knowledgeId)
      if (!knowledge) return false

      // Update usage stats
      const usedByAgents = knowledge.usedByAgents.includes(agentId)
        ? knowledge.usedByAgents
        : [...knowledge.usedByAgents, agentId]

      const docRef = doc(db, KNOWLEDGE_COLLECTION, knowledgeId)
      await updateDoc(docRef, {
        accessCount: knowledge.accessCount + 1,
        lastAccessedAt: Timestamp.now(),
        usedByAgents
      })

      return true
    } catch (error) {
      console.error('Error tracking knowledge usage:', error)
      return false
    }
  }

  /**
   * Get knowledge relevant to a query for an agent
   */
  static async getRelevantKnowledge(
    queryText: string,
    agentId: string,
    maxResults: number = 5
  ): Promise<SharedKnowledge[]> {
    try {
      const allKnowledge = await this.getAllKnowledge()
      const queryLower = queryText.toLowerCase()
      const queryWords = queryLower.split(/\s+/)

      // Score each piece of knowledge by relevance
      const scoredKnowledge = allKnowledge.map(k => {
        let score = 0

        // Topic match
        for (const word of queryWords) {
          if (k.topic.toLowerCase().includes(word)) score += 2
        }

        // Content match
        for (const word of queryWords) {
          if (k.content.toLowerCase().includes(word)) score += 1
        }

        // Tag match
        for (const tag of k.tags) {
          for (const word of queryWords) {
            if (tag.toLowerCase().includes(word)) score += 1.5
          }
        }

        // Boost by confidence
        score *= k.confidence

        // Slight boost if already used by this agent (familiar knowledge)
        if (k.usedByAgents.includes(agentId)) score += 0.5

        return { knowledge: k, score }
      })

      // Sort by score and return top results
      const results = scoredKnowledge
        .filter(sk => sk.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxResults)
        .map(sk => sk.knowledge)

      // Track usage for returned knowledge
      for (const k of results) {
        await this.trackKnowledgeUsage(k.id, agentId)
      }

      return results
    } catch (error) {
      console.error('Error getting relevant knowledge:', error)
      return []
    }
  }

  /**
   * Get knowledge contributed by a specific agent
   */
  static async getAgentContributions(agentId: string): Promise<SharedKnowledge[]> {
    try {
      const q = query(
        collection(db, KNOWLEDGE_COLLECTION),
        where('contributorId', '==', agentId),
        orderBy('createdAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToKnowledge)
    } catch (error) {
      console.error('Error fetching agent contributions:', error)
      return []
    }
  }

  /**
   * Get popular/trending knowledge
   */
  static async getPopularKnowledge(limitCount: number = 10): Promise<SharedKnowledge[]> {
    try {
      const q = query(
        collection(db, KNOWLEDGE_COLLECTION),
        orderBy('accessCount', 'desc'),
        limit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToKnowledge)
    } catch (error) {
      console.error('Error fetching popular knowledge:', error)
      return []
    }
  }

  /**
   * Get recent knowledge
   */
  static async getRecentKnowledge(limitCount: number = 10): Promise<SharedKnowledge[]> {
    try {
      const q = query(
        collection(db, KNOWLEDGE_COLLECTION),
        orderBy('createdAt', 'desc'),
        limit(limitCount)
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(firestoreDocToKnowledge)
    } catch (error) {
      console.error('Error fetching recent knowledge:', error)
      return []
    }
  }

  /**
   * Get knowledge statistics
   */
  static async getKnowledgeStats(): Promise<{
    total: number
    byCategory: Record<KnowledgeCategory, number>
    topContributors: Array<{ agentId: string; count: number }>
    averageConfidence: number
    mostDisputed: SharedKnowledge | null
    mostEndorsed: SharedKnowledge | null
  }> {
    try {
      const allKnowledge = await this.getAllKnowledge()

      // Count by category
      const byCategory: Record<KnowledgeCategory, number> = {
        fact: 0,
        opinion: 0,
        theory: 0,
        experience: 0,
        skill: 0,
        wisdom: 0
      }

      // Track contributors
      const contributorCounts: Record<string, number> = {}

      let totalConfidence = 0
      let mostDisputed: SharedKnowledge | null = null
      let mostEndorsed: SharedKnowledge | null = null

      for (const k of allKnowledge) {
        byCategory[k.category]++
        contributorCounts[k.contributorId] = (contributorCounts[k.contributorId] || 0) + 1
        totalConfidence += k.confidence

        if (!mostDisputed || k.disputes.length > mostDisputed.disputes.length) {
          mostDisputed = k
        }

        if (!mostEndorsed || k.endorsements.length > mostEndorsed.endorsements.length) {
          mostEndorsed = k
        }
      }

      // Get top contributors
      const topContributors = Object.entries(contributorCounts)
        .map(([agentId, count]) => ({ agentId, count }))
        .sort((a, b) => b.count - a.count)
        .slice(0, 10)

      return {
        total: allKnowledge.length,
        byCategory,
        topContributors,
        averageConfidence: allKnowledge.length > 0 ? totalConfidence / allKnowledge.length : 0,
        mostDisputed: mostDisputed?.disputes.length ? mostDisputed : null,
        mostEndorsed: mostEndorsed?.endorsements.length ? mostEndorsed : null
      }
    } catch (error) {
      console.error('Error getting knowledge stats:', error)
      return {
        total: 0,
        byCategory: { fact: 0, opinion: 0, theory: 0, experience: 0, skill: 0, wisdom: 0 },
        topContributors: [],
        averageConfidence: 0,
        mostDisputed: null,
        mostEndorsed: null
      }
    }
  }

  /**
   * Generate knowledge context for LLM prompt
   */
  static generateKnowledgePrompt(knowledge: SharedKnowledge[]): string {
    if (knowledge.length === 0) return ''

    const knowledgeEntries = knowledge.map(k => {
      const confidenceLevel = k.confidence > 0.7 ? 'high confidence' :
        k.confidence > 0.4 ? 'moderate confidence' : 'low confidence'

      return `- [${k.category}] "${k.topic}": ${k.content} (${confidenceLevel})`
    }).join('\n')

    return `
Available shared knowledge from the agent community:
${knowledgeEntries}

You may reference this knowledge in your response when relevant.
`
  }
}
