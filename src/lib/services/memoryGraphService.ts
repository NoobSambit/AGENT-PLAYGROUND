import {
  doc,
  getDoc,
  setDoc
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { MemoryGraphRepository } from '@/lib/repositories/memoryGraphRepository'
import {
  Concept,
  MemoryLink,
  MemoryGraph,
  MemoryGraphConsoleSummary,
  MemoryRecord,
  KnowledgeGraphData,
  KnowledgeGraphNode,
  KnowledgeGraphEdge,
  ConceptCategory
} from '@/types/database'
import { ContradictionInsight } from '@/types/enhancements'
import { ConceptService } from './conceptService'
import { MemoryService } from './memoryService'

const MEMORY_GRAPH_COLLECTION = 'memory_graphs'

async function getMemoryGraphFromFirestore(agentId: string): Promise<MemoryGraph | null> {
  const docRef = doc(db, MEMORY_GRAPH_COLLECTION, agentId)
  const docSnap = await getDoc(docRef)

  if (!docSnap.exists()) {
    return null
  }

  const data = docSnap.data()
  return {
    agentId: data.agentId as string,
    concepts: (data.concepts as Concept[]) || [],
    links: (data.links as MemoryLink[]) || [],
    stats: (data.stats as MemoryGraph['stats']) || {
      totalConcepts: 0,
      totalLinks: 0,
      averageLinkStrength: 0,
      mostConnectedMemory: '',
      conceptClusters: []
    },
    lastUpdated: data.lastUpdated as string || new Date().toISOString(),
  }
}

async function upsertMemoryGraphInFirestore(graph: MemoryGraph): Promise<void> {
  await setDoc(doc(db, MEMORY_GRAPH_COLLECTION, graph.agentId), graph)
}
// Color mapping for concept categories
const CATEGORY_COLORS: Record<ConceptCategory, string> = {
  entity: '#4A90E2',      // Blue
  topic: '#7ED321',       // Green
  emotion: '#F5A623',     // Orange
  event: '#BD10E0',       // Purple
  attribute: '#50E3C2',   // Teal
  relation: '#F8E71C'     // Yellow
}

// Memory type colors
const MEMORY_TYPE_COLORS: Record<MemoryRecord['type'], string> = {
  conversation: '#4A90E2',
  fact: '#7ED321',
  interaction: '#F5A623',
  personality_insight: '#BD10E0'
}

export class MemoryGraphService {
  private static OPPOSING_TERMS: Array<[string, string]> = [
    ['always', 'never'],
    ['possible', 'impossible'],
    ['safe', 'dangerous'],
    ['helps', 'harms'],
    ['beneficial', 'harmful'],
    ['true', 'false'],
    ['good', 'bad'],
    ['support', 'oppose']
  ]

  /**
   * Get or create memory graph for an agent
   */
  static async getMemoryGraph(agentId: string): Promise<MemoryGraph | null> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        const graph = await MemoryGraphRepository.getByAgentId(agentId)
        if (graph) {
          return graph
        }
      } else {
        const graph = await getMemoryGraphFromFirestore(agentId)
        if (graph) {
          return graph
        }
      }

      return await this.initializeMemoryGraph(agentId)
    } catch (error) {
      console.error('Error getting memory graph:', error)
      return null
    }
  }

  /**
   * Initialize an empty memory graph for an agent
   */
  static async initializeMemoryGraph(agentId: string): Promise<MemoryGraph> {
    const emptyGraph: MemoryGraph = {
      agentId,
      concepts: [],
      links: [],
      stats: {
        totalConcepts: 0,
        totalLinks: 0,
        averageLinkStrength: 0,
        mostConnectedMemory: '',
        conceptClusters: []
      },
      lastUpdated: new Date().toISOString()
    }

    try {
      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await upsertMemoryGraphInFirestore(emptyGraph)
      } else if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'memory_graph',
          entityId: agentId,
          operation: 'initialize',
          payload: emptyGraph as unknown as Record<string, unknown>,
          primary: async () => {
            await upsertMemoryGraphInFirestore(emptyGraph)
            return true
          },
          secondary: async () => {
            await MemoryGraphRepository.upsert(emptyGraph)
          },
        })
      } else {
        await runMirroredWrite({
          entityType: 'memory_graph',
          entityId: agentId,
          operation: 'initialize',
          payload: emptyGraph as unknown as Record<string, unknown>,
          primary: async () => {
            await MemoryGraphRepository.upsert(emptyGraph)
            return true
          },
          secondary: mode === 'dual-write-postgres-read'
            ? async () => {
                await upsertMemoryGraphInFirestore(emptyGraph)
              }
            : undefined,
        })
      }
    } catch (error) {
      console.error('Error initializing memory graph:', error)
    }

    return emptyGraph
  }

  /**
   * Process a new memory and update the graph
   */
  static async processNewMemory(memory: MemoryRecord): Promise<{
    newConcepts: Concept[]
    newLinks: MemoryLink[]
  }> {
    const graph = await this.getMemoryGraph(memory.agentId)
    if (!graph) {
      return { newConcepts: [], newLinks: [] }
    }

    // Extract concepts from the memory
    const extractedConcepts = ConceptService.extractConcepts(memory)

    // Merge with existing concepts
    const { updated, created } = ConceptService.mergeConcepts(
      graph.concepts,
      extractedConcepts,
      memory.id
    )

    // Create new concepts with IDs
    const newConcepts: Concept[] = created.map((c, index) => ({
      ...c,
      id: `concept_${memory.agentId}_${Date.now()}_${index}`
    }))

    // Update the concepts list
    const allConcepts = [
      ...graph.concepts.filter(c => !updated.some(u => u.id === c.id)),
      ...updated,
      ...newConcepts
    ]

    // Find relationships between concepts
    for (const concept of newConcepts) {
      concept.relatedConcepts = ConceptService.findRelatedConcepts(allConcepts, concept)
    }

    // Create memory links based on shared concepts
    const newLinks = await this.createMemoryLinks(memory, allConcepts, graph.links)

    // Update graph statistics
    const stats = this.calculateGraphStats(allConcepts, [...graph.links, ...newLinks])

    // Save updated graph
    const updatedGraph: MemoryGraph = {
      agentId: memory.agentId,
      concepts: allConcepts,
      links: [...graph.links, ...newLinks],
      stats,
      lastUpdated: new Date().toISOString()
    }

    await this.saveMemoryGraph(updatedGraph)

    return { newConcepts, newLinks }
  }

  /**
   * Create memory links based on shared concepts and temporal proximity
   */
  private static async createMemoryLinks(
    newMemory: MemoryRecord,
    concepts: Concept[],
    existingLinks: MemoryLink[]
  ): Promise<MemoryLink[]> {
    const newLinks: MemoryLink[] = []
    const memoriesWithNewMemory = new Set<string>()

    // Find concepts that include this memory
    const relevantConcepts = concepts.filter(c => c.memoryIds.includes(newMemory.id))

    // Find other memories that share concepts
    const relatedMemoryIds = new Set<string>()
    for (const concept of relevantConcepts) {
      for (const memoryId of concept.memoryIds) {
        if (memoryId !== newMemory.id) {
          relatedMemoryIds.add(memoryId)
        }
      }
    }

    // Create links to related memories
    for (const relatedMemoryId of relatedMemoryIds) {
      // Check if link already exists
      const linkExists = existingLinks.some(
        l => (l.sourceMemoryId === newMemory.id && l.targetMemoryId === relatedMemoryId) ||
             (l.sourceMemoryId === relatedMemoryId && l.targetMemoryId === newMemory.id)
      )

      if (linkExists || memoriesWithNewMemory.has(relatedMemoryId)) continue

      // Find shared concepts
      const sharedConcepts = concepts
        .filter(c => c.memoryIds.includes(newMemory.id) && c.memoryIds.includes(relatedMemoryId))
        .map(c => c.id)

      if (sharedConcepts.length > 0) {
        const strength = Math.min(1, sharedConcepts.length * 0.25)
        const linkType = this.determineLinkType(sharedConcepts, concepts)

        newLinks.push({
          id: `link_${newMemory.id}_${relatedMemoryId}_${Date.now()}`,
          sourceMemoryId: newMemory.id,
          targetMemoryId: relatedMemoryId,
          linkType,
          strength,
          sharedConcepts,
          reason: `Linked through ${sharedConcepts.length} shared concept(s)`,
          createdAt: new Date().toISOString()
        })

        memoriesWithNewMemory.add(relatedMemoryId)
      }
    }

    return newLinks
  }

  /**
   * Determine the type of link based on shared concepts
   */
  private static determineLinkType(
    sharedConceptIds: string[],
    allConcepts: Concept[]
  ): MemoryLink['linkType'] {
    const sharedConcepts = allConcepts.filter(c => sharedConceptIds.includes(c.id))

    // Check if shared concepts are emotional
    const hasEmotionalConcept = sharedConcepts.some(c => c.category === 'emotion')
    if (hasEmotionalConcept) return 'emotional'

    // Check if shared concepts are events
    const hasEventConcept = sharedConcepts.some(c => c.category === 'event')
    if (hasEventConcept) return 'causal'

    // Check if concepts are topics (semantic relationship)
    const hasTopicConcept = sharedConcepts.some(c => c.category === 'topic')
    if (hasTopicConcept) return 'semantic'

    // Check for entity relationships
    const hasEntityConcept = sharedConcepts.some(c => c.category === 'entity')
    if (hasEntityConcept) return 'associative'

    return 'semantic'
  }

  /**
   * Calculate graph statistics
   */
  private static calculateGraphStats(
    concepts: Concept[],
    links: MemoryLink[]
  ): MemoryGraph['stats'] {
    // Count connections per memory
    const memoryConnections: Record<string, number> = {}
    for (const link of links) {
      memoryConnections[link.sourceMemoryId] = (memoryConnections[link.sourceMemoryId] || 0) + 1
      memoryConnections[link.targetMemoryId] = (memoryConnections[link.targetMemoryId] || 0) + 1
    }

    // Find most connected memory
    let mostConnectedMemory = ''
    let maxConnections = 0
    for (const [memoryId, count] of Object.entries(memoryConnections)) {
      if (count > maxConnections) {
        maxConnections = count
        mostConnectedMemory = memoryId
      }
    }

    // Calculate average link strength
    const averageLinkStrength = links.length > 0
      ? links.reduce((sum, l) => sum + l.strength, 0) / links.length
      : 0

    // Generate concept clusters
    const conceptClusters = ConceptService.clusterConcepts(concepts)

    return {
      totalConcepts: concepts.length,
      totalLinks: links.length,
      averageLinkStrength,
      mostConnectedMemory,
      conceptClusters
    }
  }

  /**
   * Save memory graph to Firestore
   */
  private static async saveMemoryGraph(graph: MemoryGraph): Promise<void> {
    try {
      const mode = getPersistenceMode()
      if (mode === 'firestore') {
        await upsertMemoryGraphInFirestore(graph)
        return
      }

      if (mode === 'dual-write-firestore-read') {
        await runMirroredWrite({
          entityType: 'memory_graph',
          entityId: graph.agentId,
          operation: 'update',
          payload: graph as unknown as Record<string, unknown>,
          primary: async () => {
            await upsertMemoryGraphInFirestore(graph)
            return true
          },
          secondary: async () => {
            await MemoryGraphRepository.upsert(graph)
          },
        })
        return
      }

      await runMirroredWrite({
        entityType: 'memory_graph',
        entityId: graph.agentId,
        operation: 'update',
        payload: graph as unknown as Record<string, unknown>,
        primary: async () => {
          await MemoryGraphRepository.upsert(graph)
          return true
        },
        secondary: mode === 'dual-write-postgres-read'
          ? async () => {
              await upsertMemoryGraphInFirestore(graph)
            }
          : undefined,
      })
    } catch (error) {
      console.error('Error saving memory graph:', error)
    }
  }

  /**
   * Get memories linked to a specific memory
   */
  static async getLinkedMemories(
    agentId: string,
    memoryId: string
  ): Promise<{ memory: MemoryRecord; link: MemoryLink }[]> {
    const graph = await this.getMemoryGraph(agentId)
    if (!graph) return []

    const linkedMemoryIds = new Set<string>()
    const linkMap: Record<string, MemoryLink> = {}

    // Find all links involving this memory
    for (const link of graph.links) {
      if (link.sourceMemoryId === memoryId) {
        linkedMemoryIds.add(link.targetMemoryId)
        linkMap[link.targetMemoryId] = link
      } else if (link.targetMemoryId === memoryId) {
        linkedMemoryIds.add(link.sourceMemoryId)
        linkMap[link.sourceMemoryId] = link
      }
    }

    // Fetch the actual memories
    const results: { memory: MemoryRecord; link: MemoryLink }[] = []
    for (const linkedId of linkedMemoryIds) {
      const memory = await MemoryService.getMemoryById(linkedId)
      if (memory && linkMap[linkedId]) {
        results.push({ memory, link: linkMap[linkedId] })
      }
    }

    return results.sort((a, b) => b.link.strength - a.link.strength)
  }

  /**
   * Get enhanced memory retrieval using graph connections
   */
  static async getEnhancedRelevantMemories(
    agentId: string,
    queryText: string,
    maxMemories: number = 10
  ): Promise<MemoryRecord[]> {
    // Get basic relevant memories
    const basicRelevant = await MemoryService.getRelevantMemories(agentId, queryText, maxMemories)

    if (basicRelevant.length === 0) return []

    const graph = await this.getMemoryGraph(agentId)
    if (!graph || graph.links.length === 0) return basicRelevant

    // Expand with linked memories
    const expandedMemoryIds = new Set<string>(basicRelevant.map(m => m.id))
    const memoryScores: Record<string, number> = {}

    // Initialize scores for basic relevant memories
    basicRelevant.forEach((m, index) => {
      memoryScores[m.id] = 1 - (index * 0.1) // Higher score for earlier matches
    })

    // Add linked memories with propagated scores
    for (const memory of basicRelevant) {
      const linkedMemories = await this.getLinkedMemories(agentId, memory.id)

      for (const { memory: linkedMemory, link } of linkedMemories) {
        if (!expandedMemoryIds.has(linkedMemory.id)) {
          expandedMemoryIds.add(linkedMemory.id)
          // Propagate score through link
          memoryScores[linkedMemory.id] = (memoryScores[memory.id] || 0.5) * link.strength * 0.7
        }
      }
    }

    // Fetch all memories and sort by score
    const allMemories = await MemoryService.getAllMemoriesForAgent(agentId)
    const relevantMemories = allMemories
      .filter(m => expandedMemoryIds.has(m.id))
      .sort((a, b) => (memoryScores[b.id] || 0) - (memoryScores[a.id] || 0))
      .slice(0, maxMemories)

    return relevantMemories
  }

  static async getConsoleSummary(agentId: string): Promise<MemoryGraphConsoleSummary | null> {
    const graph = await this.getMemoryGraph(agentId)
    if (!graph) {
      return null
    }

    const topConcepts = [...graph.concepts]
      .sort((left, right) => (
        right.importance - left.importance
        || right.memoryIds.length - left.memoryIds.length
      ))
      .slice(0, 8)
      .map((concept) => ({
        id: concept.id,
        name: concept.name,
        category: concept.category,
        importance: concept.importance,
        memoryCount: concept.memoryIds.length,
      }))

    return {
      totalConcepts: graph.stats.totalConcepts,
      totalLinks: graph.stats.totalLinks,
      lastUpdated: graph.lastUpdated,
      topConcepts,
      conceptClusters: graph.stats.conceptClusters.slice(0, 4),
    }
  }

  static async getMatchedConceptNames(agentId: string, memoryId: string, queryText: string): Promise<string[]> {
    const graph = await this.getMemoryGraph(agentId)
    if (!graph) {
      return []
    }

    const queryWords = queryText
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4)

    if (queryWords.length === 0) {
      return []
    }

    return graph.concepts
      .filter((concept) => (
        concept.memoryIds.includes(memoryId)
        && queryWords.some((word) => concept.name.toLowerCase().includes(word))
      ))
      .sort((left, right) => right.importance - left.importance)
      .slice(0, 3)
      .map((concept) => concept.name)
  }

  /**
   * Generate knowledge graph data for visualization
   */
  static async getKnowledgeGraphData(
    agentId: string,
    options: {
      includeMemories?: boolean
      maxNodes?: number
      minLinkStrength?: number
    } = {}
  ): Promise<KnowledgeGraphData> {
    const {
      includeMemories = true,
      maxNodes = 100,
      minLinkStrength = 0.2
    } = options

    const graph = await this.getMemoryGraph(agentId)
    if (!graph) {
      return { nodes: [], edges: [] }
    }

    const nodes: KnowledgeGraphNode[] = []
    const edges: KnowledgeGraphEdge[] = []
    const nodeIds = new Set<string>()

    // Add concept nodes
    const topConcepts = ConceptService.getTopConcepts(graph.concepts, Math.floor(maxNodes * 0.6))

    for (const concept of topConcepts) {
      nodes.push({
        id: concept.id,
        type: 'concept',
        label: concept.name,
        size: 10 + concept.importance * 20,
        color: CATEGORY_COLORS[concept.category],
        metadata: {
          importance: concept.importance,
          category: concept.category,
          connectionCount: concept.relatedConcepts.length + concept.memoryIds.length
        }
      })
      nodeIds.add(concept.id)

      // Add concept-to-concept edges
      for (const related of concept.relatedConcepts) {
        if (related.strength >= minLinkStrength && nodeIds.has(related.conceptId)) {
          edges.push({
            id: `edge_${concept.id}_${related.conceptId}`,
            source: concept.id,
            target: related.conceptId,
            strength: related.strength,
            type: 'semantic',
            label: related.relationshipType
          })
        }
      }
    }

    // Add memory nodes if requested
    if (includeMemories) {
      const memories = await MemoryService.getAllMemoriesForAgent(agentId)
      const memoryLimit = Math.floor(maxNodes * 0.4)

      // Get most important/recent memories
      const topMemories = memories
        .sort((a, b) => b.importance - a.importance)
        .slice(0, memoryLimit)

      for (const memory of topMemories) {
        nodes.push({
          id: memory.id,
          type: 'memory',
          label: memory.summary.substring(0, 30) + '...',
          size: 8 + memory.importance * 1.5,
          color: MEMORY_TYPE_COLORS[memory.type],
          metadata: {
            importance: memory.importance,
            memoryType: memory.type,
            connectionCount: 0 // Will be updated
          }
        })
        nodeIds.add(memory.id)
      }

      // Add memory links
      for (const link of graph.links) {
        if (
          link.strength >= minLinkStrength &&
          nodeIds.has(link.sourceMemoryId) &&
          nodeIds.has(link.targetMemoryId)
        ) {
          edges.push({
            id: link.id,
            source: link.sourceMemoryId,
            target: link.targetMemoryId,
            strength: link.strength,
            type: link.linkType,
            label: link.linkType
          })
        }
      }

      // Add concept-memory edges
      for (const concept of topConcepts) {
        for (const memoryId of concept.memoryIds) {
          if (nodeIds.has(memoryId)) {
            edges.push({
              id: `edge_${concept.id}_${memoryId}`,
              source: concept.id,
              target: memoryId,
              strength: 0.5,
              type: 'concept_memory'
            })
          }
        }
      }
    }

    // Update connection counts
    const connectionCounts: Record<string, number> = {}
    for (const edge of edges) {
      connectionCounts[edge.source] = (connectionCounts[edge.source] || 0) + 1
      connectionCounts[edge.target] = (connectionCounts[edge.target] || 0) + 1
    }

    for (const node of nodes) {
      node.metadata.connectionCount = connectionCounts[node.id] || 0
    }

    return { nodes, edges }
  }

  /**
   * Rebuild the entire memory graph for an agent
   */
  static async rebuildMemoryGraph(agentId: string): Promise<MemoryGraph> {
    // Get all memories for the agent
    const memories = await MemoryService.getAllMemoriesForAgent(agentId)

    // Initialize fresh graph
    const graph = await this.initializeMemoryGraph(agentId)

    // Process each memory
    for (const memory of memories) {
      await this.processNewMemory(memory)
    }

    // Return the rebuilt graph
    return (await this.getMemoryGraph(agentId)) || graph
  }

  /**
   * Get concept insights for an agent
   */
  static async getConceptInsights(agentId: string): Promise<{
    topConcepts: Concept[]
    conceptsByCategory: Record<ConceptCategory, Concept[]>
    emotionalLandscape: { positive: Concept[]; neutral: Concept[]; negative: Concept[] }
    recentlyActive: Concept[]
    suggestions: string[]
  }> {
    const graph = await this.getMemoryGraph(agentId)
    if (!graph || graph.concepts.length === 0) {
      return {
        topConcepts: [],
        conceptsByCategory: {
          entity: [], topic: [], emotion: [], event: [], attribute: [], relation: []
        },
        emotionalLandscape: { positive: [], neutral: [], negative: [] },
        recentlyActive: [],
        suggestions: ['Start having conversations to build your knowledge graph!']
      }
    }

    const concepts = graph.concepts

    // Get top concepts
    const topConcepts = ConceptService.getTopConcepts(concepts, 10)

    // Group by category
    const conceptsByCategory: Record<ConceptCategory, Concept[]> = {
      entity: [], topic: [], emotion: [], event: [], attribute: [], relation: []
    }
    for (const concept of concepts) {
      conceptsByCategory[concept.category].push(concept)
    }

    // Emotional landscape
    const emotionalLandscape = {
      positive: concepts.filter(c => c.emotionalValence > 0.2).slice(0, 10),
      neutral: concepts.filter(c => c.emotionalValence >= -0.2 && c.emotionalValence <= 0.2).slice(0, 10),
      negative: concepts.filter(c => c.emotionalValence < -0.2).slice(0, 10)
    }

    // Recently active
    const recentlyActive = [...concepts]
      .sort((a, b) => new Date(b.lastOccurrence).getTime() - new Date(a.lastOccurrence).getTime())
      .slice(0, 10)

    // Generate suggestions
    const suggestions: string[] = []

    if (conceptsByCategory.topic.length < 5) {
      suggestions.push('Explore more topics to diversify your knowledge graph')
    }

    if (emotionalLandscape.positive.length < emotionalLandscape.negative.length) {
      suggestions.push('Consider exploring more positive topics and experiences')
    }

    if (graph.links.length < concepts.length * 0.5) {
      suggestions.push('Continue conversations to build more connections between memories')
    }

    const stats = ConceptService.calculateStats(concepts)
    if (stats.byCategory.relation < 3) {
      suggestions.push('Build more relationships with other agents')
    }

    return {
      topConcepts,
      conceptsByCategory,
      emotionalLandscape,
      recentlyActive,
      suggestions
    }
  }

  /**
   * Detect contradictory memories that overlap on topic but diverge in stance.
   */
  static async detectContradictions(agentId: string): Promise<ContradictionInsight[]> {
    const memories = await MemoryService.getAllMemoriesForAgent(agentId)
    const contradictions: ContradictionInsight[] = []

    for (let i = 0; i < memories.length; i++) {
      for (let j = i + 1; j < memories.length; j++) {
        const left = memories[i]
        const right = memories[j]
        const overlap = left.keywords.filter((keyword) => right.keywords.includes(keyword)).slice(0, 4)

        if (overlap.length === 0) {
          continue
        }

        const contradictionScore = this.estimateContradictionScore(left, right)
        if (contradictionScore < 0.55) {
          continue
        }

        contradictions.push({
          id: `contradiction_${left.id}_${right.id}`,
          memoryId1: left.id,
          memoryId2: right.id,
          summary: `Potential contradiction around ${overlap.join(', ')} between "${left.summary}" and "${right.summary}".`,
          confidence: contradictionScore,
          topicOverlap: overlap,
        })
      }
    }

    return contradictions
      .sort((a, b) => b.confidence - a.confidence)
      .slice(0, 8)
  }

  private static estimateContradictionScore(left: MemoryRecord, right: MemoryRecord): number {
    const leftText = `${left.content} ${left.summary}`.toLowerCase()
    const rightText = `${right.content} ${right.summary}`.toLowerCase()
    let score = 0

    const hasNegationMismatch = (leftText.includes(' not ') && !rightText.includes(' not '))
      || (rightText.includes(' not ') && !leftText.includes(' not '))
      || (leftText.includes("n't") && !rightText.includes("n't"))
      || (rightText.includes("n't") && !leftText.includes("n't"))

    if (hasNegationMismatch) {
      score += 0.35
    }

    for (const [positive, negative] of this.OPPOSING_TERMS) {
      const leftHasPositive = leftText.includes(positive)
      const leftHasNegative = leftText.includes(negative)
      const rightHasPositive = rightText.includes(positive)
      const rightHasNegative = rightText.includes(negative)

      if ((leftHasPositive && rightHasNegative) || (leftHasNegative && rightHasPositive)) {
        score += 0.22
      }
    }

    const keywordOverlap = left.keywords.filter((keyword) => right.keywords.includes(keyword)).length
    score += Math.min(keywordOverlap * 0.08, 0.24)

    return Math.min(score, 1)
  }
}
