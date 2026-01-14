/**
 * Neural Visualization Service
 *
 * Transforms real agent data into visualization-ready structures.
 * All processing is client-side to stay within free tier constraints.
 *
 * Real Data Sources:
 * - Memory positions: Based on type, importance, and timestamp
 * - Memory activation: Based on keyword matching during conversations
 * - Connections: Based on shared keywords and conversation threads
 * - Thought flows: Based on actual processing stages
 */

import {
  MemoryRecord,
  AgentRecord,
  EmotionalState,
  EmotionType,
  EMOTION_COLORS,
  Vector3,
  MemoryVisualization,
  EmotionVisualization,
  ThoughtFlow,
  VisualizationData
} from '@/types/database'

// ============================================
// TYPES
// ============================================

export type ProcessingStage = 'idle' | 'receiving' | 'retrieving' | 'processing' | 'responding'

export interface MemoryConnection {
  sourceId: string
  targetId: string
  strength: number // 0-1
  type: 'keyword' | 'conversation' | 'temporal' | 'core'
}

export interface RealVisualizationData extends VisualizationData {
  connections: MemoryConnection[]
  processingStage: ProcessingStage
  activatedMemoryIds: string[]
  recentlyCreatedIds: string[]
}

export interface VisualizationEvent {
  type: 'message_received' | 'memories_retrieved' | 'emotion_detected' | 'response_generated' | 'memory_created'
  data: {
    memoryIds?: string[]
    emotions?: Array<{ emotion: EmotionType; intensity: number }>
    message?: string
    timestamp: number
  }
}

// ============================================
// POSITION ALGORITHM
// ============================================

/**
 * Calculate memory position based on real attributes:
 * - Type determines quadrant (conversation, fact, interaction, personality_insight)
 * - Importance determines distance from core (higher = closer)
 * - Timestamp determines angle within quadrant (newer = higher)
 * - Activation adds Z-depth variation
 */
function calculateMemoryPosition(
  memory: MemoryRecord,
  index: number,
  totalInType: number,
  isActivated: boolean
): Vector3 {
  // Quadrant angles for each memory type
  const typeQuadrants: Record<MemoryRecord['type'], { startAngle: number; endAngle: number }> = {
    conversation: { startAngle: 0, endAngle: Math.PI / 2 },           // Top-right
    fact: { startAngle: Math.PI / 2, endAngle: Math.PI },              // Top-left
    interaction: { startAngle: Math.PI, endAngle: Math.PI * 1.5 },     // Bottom-left
    personality_insight: { startAngle: Math.PI * 1.5, endAngle: Math.PI * 2 } // Bottom-right
  }

  const quadrant = typeQuadrants[memory.type]

  // Calculate angle within quadrant based on recency (index position)
  const angleRange = quadrant.endAngle - quadrant.startAngle
  const angleOffset = totalInType > 1 ? (index / (totalInType - 1)) * angleRange * 0.8 : angleRange * 0.4
  const angle = quadrant.startAngle + angleOffset + angleRange * 0.1 // Add 10% padding

  // Calculate radius based on importance (1-10 scale)
  // Higher importance = closer to core (smaller radius)
  const minRadius = 2.5
  const maxRadius = 6
  const importanceNormalized = (memory.importance - 1) / 9 // 0 to 1
  const radius = maxRadius - (importanceNormalized * (maxRadius - minRadius))

  // Calculate Y position based on timestamp (newer = higher)
  const now = Date.now()
  const memoryTime = new Date(memory.timestamp).getTime()
  const ageHours = (now - memoryTime) / (1000 * 60 * 60)
  const maxAgeHours = 24 * 30 // 30 days
  const ageNormalized = Math.min(ageHours / maxAgeHours, 1)
  const yPosition = (1 - ageNormalized) * 4 - 2 // Range: -2 to 2 (newer = higher)

  // Z-depth variation for activated memories
  const zOffset = isActivated ? Math.sin(index * 0.5) * 0.5 : 0

  return {
    x: Math.cos(angle) * radius,
    y: yPosition,
    z: Math.sin(angle) * radius + zOffset
  }
}

// ============================================
// CONNECTION ALGORITHM
// ============================================

/**
 * Calculate connections between memories based on:
 * - Shared keywords (2+ shared = connection)
 * - Same conversation thread (metadata.conversationId)
 * - Temporal proximity (within 1 hour)
 * - Connection to core for activated memories
 */
function calculateConnections(
  memories: MemoryRecord[],
  activatedIds: Set<string>
): MemoryConnection[] {
  const connections: MemoryConnection[] = []
  const seenPairs = new Set<string>()

  for (let i = 0; i < memories.length; i++) {
    const m1 = memories[i]

    // Connect activated memories to core
    if (activatedIds.has(m1.id)) {
      connections.push({
        sourceId: m1.id,
        targetId: 'core',
        strength: 0.8,
        type: 'core'
      })
    }

    for (let j = i + 1; j < memories.length; j++) {
      const m2 = memories[j]
      const pairKey = [m1.id, m2.id].sort().join('-')

      if (seenPairs.has(pairKey)) continue
      seenPairs.add(pairKey)

      let connectionStrength = 0
      let connectionType: MemoryConnection['type'] = 'keyword'

      // Check shared keywords
      const sharedKeywords = m1.keywords.filter(k =>
        m2.keywords.some(k2 => k2.toLowerCase() === k.toLowerCase())
      )
      if (sharedKeywords.length >= 2) {
        connectionStrength += 0.3 + (sharedKeywords.length * 0.1)
        connectionType = 'keyword'
      }

      // Check same conversation thread
      const m1ConvId = m1.metadata?.conversationId
      const m2ConvId = m2.metadata?.conversationId
      if (m1ConvId && m2ConvId && m1ConvId === m2ConvId) {
        connectionStrength += 0.5
        connectionType = 'conversation'
      }

      // Check temporal proximity (within 1 hour)
      const timeDiff = Math.abs(
        new Date(m1.timestamp).getTime() - new Date(m2.timestamp).getTime()
      )
      const oneHour = 60 * 60 * 1000
      if (timeDiff < oneHour) {
        connectionStrength += 0.2 * (1 - timeDiff / oneHour)
        if (connectionType === 'keyword') connectionType = 'temporal'
      }

      // Only create connection if strong enough
      if (connectionStrength >= 0.3) {
        connections.push({
          sourceId: m1.id,
          targetId: m2.id,
          strength: Math.min(connectionStrength, 1),
          type: connectionType
        })
      }
    }
  }

  // Limit connections to prevent visual clutter
  return connections
    .sort((a, b) => b.strength - a.strength)
    .slice(0, 50)
}

// ============================================
// ACTIVATION ALGORITHM
// ============================================

/**
 * Determine which memories should be "activated" based on:
 * - Keyword match with current query
 * - Recency (last 5 memories are mildly activated)
 * - Importance threshold
 */
function calculateActivatedMemories(
  memories: MemoryRecord[],
  queryText?: string,
  forcedIds?: string[]
): { activatedIds: Set<string>; activationStrengths: Map<string, number> } {
  const activatedIds = new Set<string>()
  const activationStrengths = new Map<string, number>()

  // Add forced IDs (from actual memory retrieval)
  if (forcedIds) {
    forcedIds.forEach((id, index) => {
      activatedIds.add(id)
      // First few forced IDs have higher activation
      activationStrengths.set(id, 1 - (index * 0.1))
    })
  }

  // Keyword matching activation
  if (queryText) {
    const queryLower = queryText.toLowerCase()
    const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3)

    memories.forEach(memory => {
      let matchScore = 0

      // Check keyword matches
      memory.keywords.forEach(keyword => {
        if (queryLower.includes(keyword.toLowerCase())) {
          matchScore += 0.3
        }
        queryWords.forEach(word => {
          if (keyword.toLowerCase().includes(word)) {
            matchScore += 0.1
          }
        })
      })

      // Check content matches
      if (memory.content.toLowerCase().includes(queryLower)) {
        matchScore += 0.4
      }

      if (matchScore > 0.2) {
        activatedIds.add(memory.id)
        const existingStrength = activationStrengths.get(memory.id) || 0
        activationStrengths.set(memory.id, Math.min(existingStrength + matchScore, 1))
      }
    })
  }

  // Recent memories get mild activation
  const sortedByTime = [...memories].sort(
    (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
  )
  sortedByTime.slice(0, 5).forEach((memory, index) => {
    if (!activatedIds.has(memory.id)) {
      const recentActivation = 0.3 - (index * 0.05)
      if (recentActivation > 0.1) {
        activatedIds.add(memory.id)
        activationStrengths.set(memory.id, recentActivation)
      }
    }
  })

  return { activatedIds, activationStrengths }
}

// ============================================
// THOUGHT FLOW GENERATION
// ============================================

/**
 * Generate thought flows based on actual processing stage
 */
function generateThoughtFlows(
  stage: ProcessingStage,
  activatedMemoryPositions: Vector3[]
): ThoughtFlow[] {
  const flows: ThoughtFlow[] = []

  switch (stage) {
    case 'receiving':
      // Input streams coming from outside to core
      for (let i = 0; i < 5; i++) {
        const angle = (i / 5) * Math.PI * 2
        flows.push({
          from: { x: Math.cos(angle) * 8, y: 2, z: Math.sin(angle) * 8 },
          to: { x: 0, y: 0, z: 0 },
          progress: Math.random(),
          type: 'input'
        })
      }
      break

    case 'retrieving':
      // Processing streams from core to activated memories
      activatedMemoryPositions.forEach((pos, i) => {
        flows.push({
          from: { x: 0, y: 0, z: 0 },
          to: pos,
          progress: Math.random(),
          type: 'processing'
        })
      })
      break

    case 'processing':
      // Internal processing - connections between activated memories
      for (let i = 0; i < Math.min(activatedMemoryPositions.length - 1, 4); i++) {
        const from = activatedMemoryPositions[i]
        const to = activatedMemoryPositions[i + 1]
        if (from && to) {
          flows.push({
            from,
            to,
            progress: Math.random(),
            type: 'processing'
          })
        }
      }
      // Add core processing
      flows.push({
        from: { x: 0, y: -1, z: 0 },
        to: { x: 0, y: 1, z: 0 },
        progress: Math.random(),
        type: 'processing'
      })
      break

    case 'responding':
      // Output streams from core outward
      for (let i = 0; i < 6; i++) {
        const angle = (i / 6) * Math.PI * 2 + Math.PI / 6
        flows.push({
          from: { x: 0, y: 0, z: 0 },
          to: { x: Math.cos(angle) * 7, y: -1, z: Math.sin(angle) * 7 },
          progress: Math.random(),
          type: 'output'
        })
      }
      break

    case 'idle':
    default:
      // Subtle ambient flows
      flows.push({
        from: { x: 0, y: -0.5, z: 0 },
        to: { x: 0, y: 0.5, z: 0 },
        progress: Math.random(),
        type: 'processing'
      })
      break
  }

  return flows
}

// ============================================
// MAIN SERVICE CLASS
// ============================================

export class NeuralVisualizationService {
  private memories: MemoryRecord[] = []
  private agent: AgentRecord | null = null
  private processingStage: ProcessingStage = 'idle'
  private activatedMemoryIds: string[] = []
  private recentlyCreatedIds: string[] = []
  private currentQuery: string = ''
  private eventListeners: Map<string, ((event: VisualizationEvent) => void)[]> = new Map()

  /**
   * Initialize with agent and memories
   */
  initialize(agent: AgentRecord, memories: MemoryRecord[]): void {
    this.agent = agent
    this.memories = memories.filter(m => m.isActive !== false)
    this.processingStage = 'idle'
    this.activatedMemoryIds = []
    this.recentlyCreatedIds = []
  }

  /**
   * Update memories (call when new memories are loaded)
   */
  updateMemories(memories: MemoryRecord[]): void {
    const oldIds = new Set(this.memories.map(m => m.id))
    this.memories = memories.filter(m => m.isActive !== false)

    // Track newly created memories
    const newIds = memories.filter(m => !oldIds.has(m.id)).map(m => m.id)
    if (newIds.length > 0) {
      this.recentlyCreatedIds = [...newIds, ...this.recentlyCreatedIds].slice(0, 5)
      this.emitEvent({
        type: 'memory_created',
        data: { memoryIds: newIds, timestamp: Date.now() }
      })
    }
  }

  /**
   * Set processing stage (triggers visualization updates)
   */
  setProcessingStage(stage: ProcessingStage): void {
    this.processingStage = stage
  }

  /**
   * Handle incoming message (triggers receiving stage)
   */
  onMessageReceived(message: string): void {
    this.currentQuery = message
    this.processingStage = 'receiving'
    this.emitEvent({
      type: 'message_received',
      data: { message, timestamp: Date.now() }
    })

    // Auto-transition to retrieving after short delay
    setTimeout(() => {
      if (this.processingStage === 'receiving') {
        this.processingStage = 'retrieving'
      }
    }, 500)
  }

  /**
   * Handle memory retrieval results (from actual MemoryChain)
   */
  onMemoriesRetrieved(memoryIds: string[]): void {
    this.activatedMemoryIds = memoryIds
    this.processingStage = 'processing'
    this.emitEvent({
      type: 'memories_retrieved',
      data: { memoryIds, timestamp: Date.now() }
    })
  }

  /**
   * Handle emotion detection
   */
  onEmotionDetected(emotions: Array<{ emotion: EmotionType; intensity: number }>): void {
    this.emitEvent({
      type: 'emotion_detected',
      data: { emotions, timestamp: Date.now() }
    })
  }

  /**
   * Handle response generation complete
   */
  onResponseGenerated(): void {
    this.processingStage = 'responding'
    this.emitEvent({
      type: 'response_generated',
      data: { timestamp: Date.now() }
    })

    // Return to idle after response
    setTimeout(() => {
      this.processingStage = 'idle'
      // Keep activated memories visible for a bit longer
      setTimeout(() => {
        this.activatedMemoryIds = []
        this.currentQuery = ''
      }, 3000)
    }, 2000)
  }

  /**
   * Generate complete visualization data from real sources
   */
  generateVisualizationData(): RealVisualizationData {
    if (!this.agent) {
      return this.getEmptyVisualizationData()
    }

    // Calculate activated memories
    const { activatedIds, activationStrengths } = calculateActivatedMemories(
      this.memories,
      this.currentQuery,
      this.activatedMemoryIds
    )

    // Group memories by type for position calculation
    const memoriesByType = new Map<MemoryRecord['type'], MemoryRecord[]>()
    this.memories.forEach(memory => {
      const typeMemories = memoriesByType.get(memory.type) || []
      typeMemories.push(memory)
      memoriesByType.set(memory.type, typeMemories)
    })

    // Generate memory visualizations with real positions
    const memoryVisualizations: MemoryVisualization[] = []
    const positionMap = new Map<string, Vector3>()

    memoriesByType.forEach((typeMemories, type) => {
      // Sort by timestamp within type
      typeMemories.sort((a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )

      typeMemories.forEach((memory, index) => {
        const isActivated = activatedIds.has(memory.id)
        const position = calculateMemoryPosition(
          memory,
          index,
          typeMemories.length,
          isActivated
        )
        positionMap.set(memory.id, position)

        memoryVisualizations.push({
          id: memory.id,
          position,
          importance: memory.importance,
          activated: isActivated,
          activationStrength: activationStrengths.get(memory.id) || 0,
          label: memory.summary || memory.content.substring(0, 50)
        })
      })
    })

    // Calculate connections
    const connections = calculateConnections(this.memories, activatedIds)

    // Get emotional state visualization
    const emotionalState = this.getEmotionalVisualization()

    // Generate thought flows based on processing stage
    const activatedPositions = Array.from(activatedIds)
      .map(id => positionMap.get(id))
      .filter((pos): pos is Vector3 => pos !== undefined)
    const thoughtFlow = generateThoughtFlows(this.processingStage, activatedPositions)

    // Calculate attention focus
    const attentionFocus = this.processingStage !== 'idle' && activatedPositions.length > 0
      ? {
          position: {
            x: activatedPositions.reduce((sum, p) => sum + p.x, 0) / activatedPositions.length,
            y: activatedPositions.reduce((sum, p) => sum + p.y, 0) / activatedPositions.length,
            z: activatedPositions.reduce((sum, p) => sum + p.z, 0) / activatedPositions.length
          },
          radius: 2
        }
      : null

    return {
      memories: memoryVisualizations,
      emotionalState,
      thoughtFlow,
      attentionFocus,
      connections,
      processingStage: this.processingStage,
      activatedMemoryIds: Array.from(activatedIds),
      recentlyCreatedIds: this.recentlyCreatedIds
    }
  }

  /**
   * Get emotional visualization from real agent state
   */
  private getEmotionalVisualization(): EmotionVisualization[] {
    if (!this.agent?.emotionalState) {
      return [{ emotion: 'trust' as EmotionType, intensity: 0.5, color: EMOTION_COLORS.trust }]
    }

    return Object.entries(this.agent.emotionalState.currentMood)
      .filter(([_, intensity]) => intensity > 0.15)
      .map(([emotion, intensity]) => ({
        emotion: emotion as EmotionType,
        intensity,
        color: EMOTION_COLORS[emotion as EmotionType]
      }))
      .sort((a, b) => b.intensity - a.intensity)
  }

  /**
   * Empty visualization data for when no agent is loaded
   */
  private getEmptyVisualizationData(): RealVisualizationData {
    return {
      memories: [],
      emotionalState: [{ emotion: 'trust' as EmotionType, intensity: 0.5, color: EMOTION_COLORS.trust }],
      thoughtFlow: [],
      attentionFocus: null,
      connections: [],
      processingStage: 'idle',
      activatedMemoryIds: [],
      recentlyCreatedIds: []
    }
  }

  /**
   * Event system for real-time updates
   */
  addEventListener(eventType: VisualizationEvent['type'], callback: (event: VisualizationEvent) => void): void {
    const listeners = this.eventListeners.get(eventType) || []
    listeners.push(callback)
    this.eventListeners.set(eventType, listeners)
  }

  removeEventListener(eventType: VisualizationEvent['type'], callback: (event: VisualizationEvent) => void): void {
    const listeners = this.eventListeners.get(eventType) || []
    const index = listeners.indexOf(callback)
    if (index > -1) {
      listeners.splice(index, 1)
      this.eventListeners.set(eventType, listeners)
    }
  }

  private emitEvent(event: VisualizationEvent): void {
    const listeners = this.eventListeners.get(event.type) || []
    listeners.forEach(callback => callback(event))
  }

  /**
   * Get current processing stage
   */
  getProcessingStage(): ProcessingStage {
    return this.processingStage
  }

  /**
   * Get memory count
   */
  getMemoryCount(): number {
    return this.memories.length
  }

  /**
   * Get activated count
   */
  getActivatedCount(): number {
    return this.activatedMemoryIds.length
  }
}

// Singleton instance for global access
let visualizationServiceInstance: NeuralVisualizationService | null = null

export function getNeuralVisualizationService(): NeuralVisualizationService {
  if (!visualizationServiceInstance) {
    visualizationServiceInstance = new NeuralVisualizationService()
  }
  return visualizationServiceInstance
}

export function createNeuralVisualizationService(): NeuralVisualizationService {
  return new NeuralVisualizationService()
}
