import {
  Concept,
  ConceptCategory,
  MemoryRecord
} from '@/types/database'

// Predefined concept patterns for extraction
const CONCEPT_PATTERNS = {
  entity: {
    // Common entity indicators
    patterns: [
      /\b(?:I|me|my|myself)\b/gi,           // Self references
      /\b(?:you|your|yourself)\b/gi,        // User references
      /\b(?:he|she|they|it|him|her|them)\b/gi, // Third person
      /\b[A-Z][a-z]+(?:\s+[A-Z][a-z]+)*\b/g, // Proper nouns
    ],
    keywords: ['person', 'place', 'thing', 'object', 'item', 'someone', 'somewhere']
  },
  topic: {
    keywords: [
      'science', 'technology', 'art', 'music', 'history', 'philosophy',
      'mathematics', 'literature', 'psychology', 'nature', 'space',
      'politics', 'economics', 'culture', 'religion', 'education',
      'health', 'sports', 'entertainment', 'food', 'travel', 'programming',
      'artificial intelligence', 'machine learning', 'data', 'creativity'
    ]
  },
  emotion: {
    keywords: [
      'happy', 'sad', 'angry', 'afraid', 'surprised', 'disgusted',
      'joyful', 'excited', 'anxious', 'worried', 'calm', 'peaceful',
      'frustrated', 'hopeful', 'grateful', 'love', 'hate', 'fear',
      'trust', 'anticipation', 'melancholy', 'enthusiasm', 'curiosity'
    ]
  },
  event: {
    patterns: [
      /\b(?:happened|occurred|took place|started|ended|began|finished)\b/gi,
      /\b(?:meeting|conversation|discussion|event|activity|experience)\b/gi
    ],
    keywords: ['event', 'meeting', 'conversation', 'experience', 'moment', 'occurrence']
  },
  attribute: {
    keywords: [
      'important', 'significant', 'interesting', 'beautiful', 'useful',
      'difficult', 'easy', 'complex', 'simple', 'valuable', 'creative',
      'intelligent', 'kind', 'helpful', 'strong', 'weak', 'new', 'old'
    ]
  },
  relation: {
    keywords: [
      'friend', 'family', 'colleague', 'mentor', 'student', 'partner',
      'relationship', 'connection', 'bond', 'association', 'interaction'
    ]
  }
}

// Emotion mapping for valence calculation
const EMOTION_VALENCE: Record<string, number> = {
  // Positive emotions
  happy: 0.8, joyful: 0.9, excited: 0.7, hopeful: 0.6,
  grateful: 0.8, love: 0.9, trust: 0.7, calm: 0.5, peaceful: 0.6,
  enthusiasm: 0.8, curiosity: 0.5, anticipation: 0.4,
  // Negative emotions
  sad: -0.7, angry: -0.8, afraid: -0.6, anxious: -0.5,
  worried: -0.4, frustrated: -0.6, hate: -0.9, fear: -0.7,
  disgusted: -0.6, melancholy: -0.5,
  // Neutral
  surprised: 0.1
}

export class ConceptService {
  /**
   * Extract concepts from a memory record
   */
  static extractConcepts(memory: MemoryRecord): Omit<Concept, 'id' | 'relatedConcepts' | 'memoryIds'>[] {
    const concepts: Omit<Concept, 'id' | 'relatedConcepts' | 'memoryIds'>[] = []
    const text = `${memory.content} ${memory.summary} ${memory.context}`.toLowerCase()
    const foundConcepts = new Set<string>()

    // Extract concepts by category
    for (const [category, config] of Object.entries(CONCEPT_PATTERNS)) {
      // Check keywords
      if ('keywords' in config) {
        for (const keyword of config.keywords) {
          if (text.includes(keyword.toLowerCase()) && !foundConcepts.has(keyword.toLowerCase())) {
            foundConcepts.add(keyword.toLowerCase())
            concepts.push(this.createConceptFromKeyword(
              keyword,
              category as ConceptCategory,
              memory
            ))
          }
        }
      }

      // Check patterns
      if ('patterns' in config) {
        for (const pattern of config.patterns) {
          const matches = text.match(pattern)
          if (matches) {
            for (const match of matches) {
              const normalizedMatch = match.toLowerCase().trim()
              if (normalizedMatch.length > 2 && !foundConcepts.has(normalizedMatch)) {
                foundConcepts.add(normalizedMatch)
                concepts.push(this.createConceptFromKeyword(
                  match.trim(),
                  category as ConceptCategory,
                  memory
                ))
              }
            }
          }
        }
      }
    }

    // Also extract from memory keywords
    for (const keyword of memory.keywords) {
      const normalizedKeyword = keyword.toLowerCase().trim()
      if (!foundConcepts.has(normalizedKeyword)) {
        foundConcepts.add(normalizedKeyword)
        const category = this.categorizeKeyword(keyword)
        concepts.push(this.createConceptFromKeyword(keyword, category, memory))
      }
    }

    return concepts
  }

  /**
   * Create a concept from a keyword
   */
  private static createConceptFromKeyword(
    keyword: string,
    category: ConceptCategory,
    memory: MemoryRecord
  ): Omit<Concept, 'id' | 'relatedConcepts' | 'memoryIds'> {
    const timestamp = new Date().toISOString()
    const emotionalValence = this.calculateEmotionalValence(keyword, memory)

    return {
      name: keyword.toLowerCase(),
      category,
      description: `Concept extracted from memory: "${memory.summary.substring(0, 50)}..."`,
      occurrenceCount: 1,
      lastOccurrence: timestamp,
      importance: this.calculateInitialImportance(keyword, memory),
      emotionalValence,
      createdAt: timestamp,
      updatedAt: timestamp
    }
  }

  /**
   * Categorize a keyword into a concept category
   */
  private static categorizeKeyword(keyword: string): ConceptCategory {
    const lowerKeyword = keyword.toLowerCase()

    // Check each category's keywords
    for (const [category, config] of Object.entries(CONCEPT_PATTERNS)) {
      if ('keywords' in config && config.keywords.some(k =>
        lowerKeyword.includes(k.toLowerCase()) || k.toLowerCase().includes(lowerKeyword)
      )) {
        return category as ConceptCategory
      }
    }

    // Default to topic if no match
    return 'topic'
  }

  /**
   * Calculate initial importance based on context
   */
  private static calculateInitialImportance(keyword: string, memory: MemoryRecord): number {
    let importance = 0.3 // Base importance

    // Boost if in memory keywords
    if (memory.keywords.some(k => k.toLowerCase() === keyword.toLowerCase())) {
      importance += 0.2
    }

    // Boost based on memory importance
    importance += (memory.importance / 10) * 0.3

    // Boost if it's a proper noun (capitalized)
    if (keyword[0] === keyword[0].toUpperCase() && keyword[0] !== keyword[0].toLowerCase()) {
      importance += 0.1
    }

    return Math.min(importance, 1)
  }

  /**
   * Calculate emotional valence for a concept
   */
  private static calculateEmotionalValence(keyword: string, memory: MemoryRecord): number {
    const lowerKeyword = keyword.toLowerCase()

    // Check direct emotion mapping
    if (EMOTION_VALENCE[lowerKeyword] !== undefined) {
      return EMOTION_VALENCE[lowerKeyword]
    }

    // Derive from memory context (simple sentiment analysis)
    const positiveWords = ['good', 'great', 'happy', 'love', 'wonderful', 'excellent', 'positive', 'enjoy']
    const negativeWords = ['bad', 'sad', 'hate', 'terrible', 'awful', 'negative', 'difficult', 'problem']

    let valence = 0
    const text = memory.content.toLowerCase()

    // Check surrounding context
    const keywordIndex = text.indexOf(lowerKeyword)
    if (keywordIndex >= 0) {
      const contextStart = Math.max(0, keywordIndex - 50)
      const contextEnd = Math.min(text.length, keywordIndex + 50)
      const context = text.substring(contextStart, contextEnd)

      for (const word of positiveWords) {
        if (context.includes(word)) valence += 0.2
      }
      for (const word of negativeWords) {
        if (context.includes(word)) valence -= 0.2
      }
    }

    return Math.max(-1, Math.min(1, valence))
  }

  /**
   * Merge new concepts with existing ones
   */
  static mergeConcepts(
    existingConcepts: Concept[],
    newConceptData: Omit<Concept, 'id' | 'relatedConcepts' | 'memoryIds'>[],
    memoryId: string
  ): { updated: Concept[]; created: Omit<Concept, 'id'>[] } {
    const updated: Concept[] = []
    const created: Omit<Concept, 'id'>[] = []

    for (const newData of newConceptData) {
      const existing = existingConcepts.find(
        c => c.name.toLowerCase() === newData.name.toLowerCase()
      )

      if (existing) {
        // Update existing concept
        const updatedConcept: Concept = {
          ...existing,
          occurrenceCount: existing.occurrenceCount + 1,
          lastOccurrence: newData.lastOccurrence,
          // Recalculate importance with decay and new occurrence
          importance: Math.min(
            1,
            existing.importance * 0.9 + newData.importance * 0.3
          ),
          // Average emotional valence
          emotionalValence: (existing.emotionalValence + newData.emotionalValence) / 2,
          memoryIds: [...new Set([...existing.memoryIds, memoryId])],
          updatedAt: newData.updatedAt
        }
        updated.push(updatedConcept)
      } else {
        // Create new concept
        created.push({
          ...newData,
          relatedConcepts: [],
          memoryIds: [memoryId]
        })
      }
    }

    return { updated, created }
  }

  /**
   * Find related concepts based on co-occurrence and semantic similarity
   */
  static findRelatedConcepts(
    concepts: Concept[],
    targetConcept: Concept
  ): Array<{ conceptId: string; relationshipType: Concept['relatedConcepts'][0]['relationshipType']; strength: number }> {
    const related: Array<{ conceptId: string; relationshipType: Concept['relatedConcepts'][0]['relationshipType']; strength: number }> = []

    for (const concept of concepts) {
      if (concept.id === targetConcept.id) continue

      // Check for shared memories (co-occurrence)
      const sharedMemories = targetConcept.memoryIds.filter(
        id => concept.memoryIds.includes(id)
      )

      if (sharedMemories.length > 0) {
        const strength = Math.min(1, sharedMemories.length * 0.2)
        const relationshipType = this.determineRelationshipType(targetConcept, concept)

        related.push({
          conceptId: concept.id,
          relationshipType,
          strength
        })
      }

      // Check for category-based relationships
      if (concept.category === targetConcept.category && concept.id !== targetConcept.id) {
        const existingRelation = related.find(r => r.conceptId === concept.id)
        if (!existingRelation) {
          related.push({
            conceptId: concept.id,
            relationshipType: 'similar_to',
            strength: 0.3
          })
        }
      }

      // Check for emotional similarity
      if (Math.abs(concept.emotionalValence - targetConcept.emotionalValence) < 0.2) {
        const existingRelation = related.find(r => r.conceptId === concept.id)
        if (existingRelation) {
          existingRelation.strength = Math.min(1, existingRelation.strength + 0.2)
        } else {
          related.push({
            conceptId: concept.id,
            relationshipType: 'related_to',
            strength: 0.2
          })
        }
      }
    }

    // Sort by strength and return top relationships
    return related.sort((a, b) => b.strength - a.strength).slice(0, 10)
  }

  /**
   * Determine the type of relationship between two concepts
   */
  private static determineRelationshipType(
    concept1: Concept,
    concept2: Concept
  ): Concept['relatedConcepts'][0]['relationshipType'] {
    // Check for opposite emotional valences
    if (
      (concept1.emotionalValence > 0.3 && concept2.emotionalValence < -0.3) ||
      (concept1.emotionalValence < -0.3 && concept2.emotionalValence > 0.3)
    ) {
      return 'opposite_of'
    }

    // Check for hierarchical relationships based on category
    if (concept1.category === 'topic' && concept2.category === 'entity') {
      return 'part_of'
    }

    if (concept1.category === concept2.category) {
      return 'similar_to'
    }

    if (concept1.category === 'event' && concept2.category === 'emotion') {
      return 'causes'
    }

    return 'related_to'
  }

  /**
   * Get top concepts for an agent based on importance and frequency
   */
  static getTopConcepts(concepts: Concept[], limit: number = 20): Concept[] {
    return concepts
      .sort((a, b) => {
        // Score based on importance and occurrence count
        const scoreA = a.importance * 0.6 + Math.min(a.occurrenceCount / 10, 1) * 0.4
        const scoreB = b.importance * 0.6 + Math.min(b.occurrenceCount / 10, 1) * 0.4
        return scoreB - scoreA
      })
      .slice(0, limit)
  }

  /**
   * Cluster concepts by category and relationships
   */
  static clusterConcepts(concepts: Concept[]): Array<{
    name: string
    conceptIds: string[]
    centralConcept: string
  }> {
    const clusters: Map<string, { conceptIds: string[]; centralConcept: Concept | null }> = new Map()

    // Group by category first
    for (const concept of concepts) {
      const category = concept.category
      if (!clusters.has(category)) {
        clusters.set(category, { conceptIds: [], centralConcept: null })
      }
      const cluster = clusters.get(category)!
      cluster.conceptIds.push(concept.id)

      // Track the most important concept as central
      if (!cluster.centralConcept || concept.importance > cluster.centralConcept.importance) {
        cluster.centralConcept = concept
      }
    }

    // Convert to array format
    return Array.from(clusters.entries()).map(([name, data]) => ({
      name,
      conceptIds: data.conceptIds,
      centralConcept: data.centralConcept?.id || data.conceptIds[0]
    }))
  }

  /**
   * Calculate concept statistics
   */
  static calculateStats(concepts: Concept[]): {
    totalConcepts: number
    byCategory: Record<ConceptCategory, number>
    averageImportance: number
    mostFrequent: string[]
    recentlyActive: string[]
  } {
    const byCategory: Record<ConceptCategory, number> = {
      entity: 0,
      topic: 0,
      emotion: 0,
      event: 0,
      attribute: 0,
      relation: 0
    }

    let totalImportance = 0

    for (const concept of concepts) {
      byCategory[concept.category]++
      totalImportance += concept.importance
    }

    const sortedByFrequency = [...concepts].sort((a, b) => b.occurrenceCount - a.occurrenceCount)
    const sortedByRecency = [...concepts].sort((a, b) =>
      new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime()
    )

    return {
      totalConcepts: concepts.length,
      byCategory,
      averageImportance: concepts.length > 0 ? totalImportance / concepts.length : 0,
      mostFrequent: sortedByFrequency.slice(0, 5).map(c => c.name),
      recentlyActive: sortedByRecency.slice(0, 5).map(c => c.name)
    }
  }
}
