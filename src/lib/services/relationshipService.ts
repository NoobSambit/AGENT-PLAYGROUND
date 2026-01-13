/**
 * Relationship Service - Phase 2
 *
 * Manages agent-to-agent relationships with persistent histories,
 * emotional bonds, and dynamic relationship states.
 *
 * Cost: 0 additional LLM calls (updates during simulations)
 */

import {
  AgentRelationship,
  RelationshipType,
  RelationshipStatus,
  RelationshipMetrics,
  RelationshipEvent,
  RelationshipEventType,
  AgentRecord,
} from '@/types/database'

// Utility function to clamp values between 0 and 1
function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

// Generate unique IDs
function generateId(): string {
  return `rel_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generateEventId(): string {
  return `evt_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Default initial metrics for new relationships
const DEFAULT_METRICS: RelationshipMetrics = {
  trust: 0.3,
  respect: 0.3,
  affection: 0.1,
  familiarity: 0.1,
}

// Keywords for analyzing interaction sentiment
const POSITIVE_KEYWORDS = [
  'agree', 'yes', 'good', 'great', 'thank', 'help', 'love', 'friend',
  'appreciate', 'excellent', 'wonderful', 'amazing', 'support', 'understand',
  'respect', 'admire', 'enjoy', 'happy', 'pleased', 'grateful', 'trust',
  'collaborate', 'together', 'share', 'kind', 'generous', 'wise', 'brilliant'
]

const NEGATIVE_KEYWORDS = [
  'no', 'disagree', 'wrong', 'bad', 'hate', 'stupid', 'idiot', 'terrible',
  'awful', 'annoying', 'frustrating', 'disappointing', 'unfair', 'rude',
  'selfish', 'ignorant', 'incompetent', 'useless', 'pathetic', 'ridiculous',
  'never', 'refuse', 'reject', 'against', 'oppose', 'conflict', 'argue'
]

const HELPING_KEYWORDS = [
  'help', 'assist', 'support', 'guide', 'teach', 'show', 'explain',
  'advise', 'recommend', 'suggest', 'offer', 'provide', 'share'
]

const CONFLICT_KEYWORDS = [
  'disagree', 'argue', 'fight', 'conflict', 'oppose', 'challenge',
  'criticize', 'blame', 'accuse', 'attack', 'insult', 'threaten'
]

class RelationshipService {
  /**
   * Create a new relationship between two agents
   */
  createRelationship(agentId1: string, agentId2: string): AgentRelationship {
    const now = new Date().toISOString()

    return {
      id: generateId(),
      agentId1,
      agentId2,
      relationshipTypes: ['acquaintance'],
      metrics: { ...DEFAULT_METRICS },
      status: 'growing',
      interactionCount: 0,
      lastInteraction: now,
      firstMeeting: now,
      significantEvents: [{
        id: generateEventId(),
        type: 'first_meeting',
        description: 'First interaction between agents',
        impactOnMetrics: {},
        timestamp: now,
      }],
      createdAt: now,
      updatedAt: now,
    }
  }

  /**
   * Analyze interaction between two agents to classify sentiment
   * Uses rule-based analysis (no API calls)
   */
  analyzeInteraction(
    agent1Message: string,
    agent2Message: string
  ): { type: 'positive' | 'negative' | 'neutral'; intensity: number; eventType: RelationshipEventType } {
    const combinedText = (agent1Message + ' ' + agent2Message).toLowerCase()

    let positiveScore = 0
    let negativeScore = 0
    let helpingScore = 0
    let conflictScore = 0

    // Check positive keywords
    for (const keyword of POSITIVE_KEYWORDS) {
      if (combinedText.includes(keyword)) positiveScore++
    }

    // Check negative keywords
    for (const keyword of NEGATIVE_KEYWORDS) {
      if (combinedText.includes(keyword)) negativeScore++
    }

    // Check helping keywords
    for (const keyword of HELPING_KEYWORDS) {
      if (combinedText.includes(keyword)) helpingScore++
    }

    // Check conflict keywords
    for (const keyword of CONFLICT_KEYWORDS) {
      if (combinedText.includes(keyword)) conflictScore++
    }

    // Calculate intensity based on keyword density
    const totalKeywords = positiveScore + negativeScore
    const intensity = Math.min(totalKeywords / 10, 1)

    // Determine event type based on analysis
    let eventType: RelationshipEventType = 'bonding'

    if (conflictScore > 2 || (negativeScore > positiveScore + 3)) {
      eventType = 'conflict'
    } else if (helpingScore >= 2) {
      eventType = 'help'
    } else if (positiveScore > negativeScore + 2) {
      eventType = 'agreement'
    } else if (negativeScore > positiveScore) {
      eventType = 'disagreement'
    }

    // Determine overall sentiment
    if (positiveScore > negativeScore + 1) {
      return { type: 'positive', intensity: Math.max(intensity, 0.3), eventType }
    } else if (negativeScore > positiveScore + 1) {
      return { type: 'negative', intensity: Math.max(intensity, 0.3), eventType }
    } else {
      return { type: 'neutral', intensity: 0.2, eventType }
    }
  }

  /**
   * Update relationship based on an interaction
   */
  updateRelationship(
    relationship: AgentRelationship,
    interaction: {
      type: 'positive' | 'negative' | 'neutral'
      context: string
      intensity: number
      eventType: RelationshipEventType
    }
  ): AgentRelationship {
    const { trust, respect, affection, familiarity } = relationship.metrics
    const now = new Date().toISOString()

    // Changes limited to ±0.1 per interaction (prevent volatility)
    const maxChange = 0.1 * interaction.intensity

    let trustChange = 0
    let respectChange = 0
    let affectionChange = 0
    const familiarityChange = 0.05 // Always increases with interaction

    if (interaction.type === 'positive') {
      trustChange = maxChange * 0.8
      respectChange = maxChange * 0.6
      affectionChange = maxChange * 0.7
    } else if (interaction.type === 'negative') {
      trustChange = -maxChange * 1.2 // Trust drops faster
      respectChange = -maxChange * 0.4
      affectionChange = -maxChange * 0.5
    }

    // Bonus changes based on event type
    switch (interaction.eventType) {
      case 'help':
        trustChange += 0.05
        respectChange += 0.03
        break
      case 'agreement':
        respectChange += 0.02
        affectionChange += 0.02
        break
      case 'conflict':
        trustChange -= 0.05
        affectionChange -= 0.03
        break
      case 'betrayal':
        trustChange -= 0.15
        respectChange -= 0.1
        affectionChange -= 0.1
        break
      case 'reconciliation':
        trustChange += 0.08
        affectionChange += 0.05
        break
    }

    // Apply diminishing returns (harder to increase already-high metrics)
    const diminishingFactor = (current: number) => 1 - current * 0.5

    const newMetrics: RelationshipMetrics = {
      trust: clamp(trust + trustChange * diminishingFactor(trust), 0, 1),
      respect: clamp(respect + respectChange * diminishingFactor(respect), 0, 1),
      affection: clamp(affection + affectionChange * diminishingFactor(affection), 0, 1),
      familiarity: clamp(familiarity + familiarityChange, 0, 1),
    }

    // Determine relationship types based on new metrics
    const types = this.calculateRelationshipTypes(newMetrics)

    // Determine status
    const previousAvg = (trust + respect + affection) / 3
    const newAvg = (newMetrics.trust + newMetrics.respect + newMetrics.affection) / 3
    let status: RelationshipStatus

    if (newMetrics.trust < 0.2) {
      status = 'broken'
    } else if (newAvg > previousAvg + 0.05) {
      status = 'growing'
    } else if (newAvg < previousAvg - 0.05) {
      status = 'declining'
    } else {
      status = 'stable'
    }

    // Record significant event if change is meaningful
    const events = [...relationship.significantEvents]
    if (Math.abs(trustChange) > 0.03 || interaction.type !== 'neutral') {
      events.push({
        id: generateEventId(),
        type: interaction.eventType,
        description: interaction.context.substring(0, 200),
        impactOnMetrics: {
          trust: trustChange,
          respect: respectChange,
          affection: affectionChange,
        },
        timestamp: now,
        context: interaction.context.substring(0, 100),
      })

      // Keep only last 10 events (storage limit)
      if (events.length > 10) {
        events.shift()
      }
    }

    return {
      ...relationship,
      relationshipTypes: types,
      metrics: newMetrics,
      status,
      interactionCount: relationship.interactionCount + 1,
      lastInteraction: now,
      significantEvents: events,
      updatedAt: now,
    }
  }

  /**
   * Calculate relationship types based on metrics
   */
  calculateRelationshipTypes(metrics: RelationshipMetrics): RelationshipType[] {
    const types: RelationshipType[] = []
    const avgPositive = (metrics.trust + metrics.respect + metrics.affection) / 3

    // Friendship: High overall positive + high affection
    if (avgPositive > 0.6 && metrics.affection > 0.5) {
      types.push('friendship')
    }

    // Rivalry: Low trust + some respect (adversarial but acknowledged)
    if (avgPositive < 0.4 && metrics.trust < 0.3 && metrics.respect > 0.2) {
      types.push('rivalry')
    }

    // Professional: High respect regardless of affection
    if (metrics.respect > 0.7 && metrics.familiarity > 0.3) {
      types.push('professional')
    }

    // Mentorship: High respect + trust differential would be detected separately
    // For now, just check if respect is very high
    if (metrics.respect > 0.8 && metrics.trust > 0.6) {
      types.push('mentorship')
    }

    // Default to acquaintance if no other type matches
    if (types.length === 0) {
      types.push('acquaintance')
    }

    return types
  }

  /**
   * Get relationship context for LLM prompt injection
   */
  getRelationshipContext(relationship: AgentRelationship, otherAgentName: string): string {
    const { metrics, relationshipTypes, interactionCount, significantEvents } = relationship

    const typeStr = relationshipTypes.join(' and ')
    const trustLevel = metrics.trust > 0.7 ? 'high' : metrics.trust > 0.4 ? 'moderate' : 'low'
    const affectionLevel = metrics.affection > 0.6 ? 'warm' : metrics.affection > 0.3 ? 'neutral' : 'distant'

    // Get recent history
    const recentHistory = significantEvents
      .slice(-3)
      .map(e => e.description)
      .join('; ')

    let behaviorGuidance = ''
    if (metrics.trust > 0.6) {
      behaviorGuidance = 'Be warm, open, and cooperative. Share thoughts freely.'
    } else if (metrics.trust < 0.3) {
      behaviorGuidance = 'Be cautious and reserved. Guard information carefully.'
    } else {
      behaviorGuidance = 'Be polite but measured. Build trust gradually.'
    }

    return `
You have a ${typeStr} relationship with ${otherAgentName}.
- Trust level: ${trustLevel} (${metrics.trust.toFixed(2)})
- Respect: ${metrics.respect.toFixed(2)}
- Affection: ${affectionLevel} (${metrics.affection.toFixed(2)})
- Familiarity: ${metrics.familiarity.toFixed(2)}
- Total interactions: ${interactionCount}
Recent history: ${recentHistory || 'First interaction'}

${behaviorGuidance}
`
  }

  /**
   * Get relationship summary for UI display
   */
  getRelationshipSummary(relationship: AgentRelationship): {
    strength: 'strong' | 'moderate' | 'weak' | 'broken'
    label: string
    color: string
    icon: string
  } {
    const avgMetric = (
      relationship.metrics.trust +
      relationship.metrics.respect +
      relationship.metrics.affection
    ) / 3

    if (relationship.status === 'broken' || relationship.metrics.trust < 0.2) {
      return { strength: 'broken', label: 'Broken', color: '#DC143C', icon: '💔' }
    }

    if (avgMetric > 0.7) {
      if (relationship.relationshipTypes.includes('friendship')) {
        return { strength: 'strong', label: 'Close Friends', color: '#32CD32', icon: '💚' }
      }
      return { strength: 'strong', label: 'Strong Bond', color: '#32CD32', icon: '🤝' }
    }

    if (avgMetric > 0.4) {
      if (relationship.relationshipTypes.includes('professional')) {
        return { strength: 'moderate', label: 'Professional', color: '#4169E1', icon: '💼' }
      }
      return { strength: 'moderate', label: 'Developing', color: '#FFD700', icon: '🌱' }
    }

    if (relationship.relationshipTypes.includes('rivalry')) {
      return { strength: 'weak', label: 'Rival', color: '#FF4500', icon: '⚔️' }
    }

    return { strength: 'weak', label: 'Acquaintance', color: '#808080', icon: '👋' }
  }

  /**
   * Calculate compatibility score between two agents based on their profiles
   */
  calculateCompatibility(agent1: AgentRecord, agent2: AgentRecord): number {
    let compatibility = 0.5 // Start neutral

    // Compare core traits if available
    if (agent1.coreTraits && agent2.coreTraits) {
      const traitKeys = Object.keys(agent1.coreTraits)
      let traitSimilarity = 0

      for (const key of traitKeys) {
        const diff = Math.abs(
          (agent1.coreTraits[key] || 0.5) - (agent2.coreTraits[key] || 0.5)
        )
        traitSimilarity += 1 - diff
      }

      if (traitKeys.length > 0) {
        compatibility += (traitSimilarity / traitKeys.length - 0.5) * 0.3
      }
    }

    // Compare linguistic profiles if available
    if (agent1.linguisticProfile && agent2.linguisticProfile) {
      const l1 = agent1.linguisticProfile
      const l2 = agent2.linguisticProfile

      // Similar formality and technical levels improve compatibility
      const formalityDiff = Math.abs(l1.formality - l2.formality)
      const technicalDiff = Math.abs(l1.technicalLevel - l2.technicalLevel)

      compatibility += (1 - (formalityDiff + technicalDiff) / 2) * 0.2
    }

    return clamp(compatibility, 0, 1)
  }

  /**
   * Get all relationships for an agent
   */
  filterRelationshipsByAgent(
    relationships: AgentRelationship[],
    agentId: string
  ): AgentRelationship[] {
    return relationships.filter(
      r => r.agentId1 === agentId || r.agentId2 === agentId
    )
  }

  /**
   * Get relationship between two specific agents
   */
  findRelationship(
    relationships: AgentRelationship[],
    agentId1: string,
    agentId2: string
  ): AgentRelationship | undefined {
    return relationships.find(
      r => (r.agentId1 === agentId1 && r.agentId2 === agentId2) ||
           (r.agentId1 === agentId2 && r.agentId2 === agentId1)
    )
  }

  /**
   * Get or create relationship between two agents
   */
  getOrCreateRelationship(
    relationships: AgentRelationship[],
    agentId1: string,
    agentId2: string
  ): { relationship: AgentRelationship; isNew: boolean } {
    const existing = this.findRelationship(relationships, agentId1, agentId2)

    if (existing) {
      return { relationship: existing, isNew: false }
    }

    return { relationship: this.createRelationship(agentId1, agentId2), isNew: true }
  }

  /**
   * Calculate network statistics for relationship visualization
   */
  calculateNetworkStats(relationships: AgentRelationship[]): {
    totalRelationships: number
    averageTrust: number
    averageRespect: number
    averageAffection: number
    strongBonds: number
    brokenBonds: number
    mostConnectedAgent: string | null
  } {
    if (relationships.length === 0) {
      return {
        totalRelationships: 0,
        averageTrust: 0,
        averageRespect: 0,
        averageAffection: 0,
        strongBonds: 0,
        brokenBonds: 0,
        mostConnectedAgent: null,
      }
    }

    let totalTrust = 0
    let totalRespect = 0
    let totalAffection = 0
    let strongBonds = 0
    let brokenBonds = 0
    const agentConnections: Record<string, number> = {}

    for (const rel of relationships) {
      totalTrust += rel.metrics.trust
      totalRespect += rel.metrics.respect
      totalAffection += rel.metrics.affection

      const avg = (rel.metrics.trust + rel.metrics.respect + rel.metrics.affection) / 3
      if (avg > 0.7) strongBonds++
      if (rel.status === 'broken') brokenBonds++

      agentConnections[rel.agentId1] = (agentConnections[rel.agentId1] || 0) + 1
      agentConnections[rel.agentId2] = (agentConnections[rel.agentId2] || 0) + 1
    }

    const n = relationships.length
    let mostConnectedAgent: string | null = null
    let maxConnections = 0

    for (const [agentId, count] of Object.entries(agentConnections)) {
      if (count > maxConnections) {
        maxConnections = count
        mostConnectedAgent = agentId
      }
    }

    return {
      totalRelationships: n,
      averageTrust: totalTrust / n,
      averageRespect: totalRespect / n,
      averageAffection: totalAffection / n,
      strongBonds,
      brokenBonds,
      mostConnectedAgent,
    }
  }

  /**
   * Generate relationship network graph data for visualization
   */
  generateNetworkGraphData(
    relationships: AgentRelationship[],
    agents: Array<{ id: string; name: string }>
  ): {
    nodes: Array<{ id: string; name: string; connectionCount: number }>
    edges: Array<{
      source: string
      target: string
      strength: number
      color: string
      types: RelationshipType[]
    }>
  } {
    const agentMap = new Map(agents.map(a => [a.id, a.name]))
    const connectionCounts: Record<string, number> = {}

    // Count connections per agent
    for (const rel of relationships) {
      connectionCounts[rel.agentId1] = (connectionCounts[rel.agentId1] || 0) + 1
      connectionCounts[rel.agentId2] = (connectionCounts[rel.agentId2] || 0) + 1
    }

    // Create nodes
    const nodes = agents.map(agent => ({
      id: agent.id,
      name: agent.name,
      connectionCount: connectionCounts[agent.id] || 0,
    }))

    // Create edges
    const edges = relationships.map(rel => {
      const avg = (rel.metrics.trust + rel.metrics.respect + rel.metrics.affection) / 3

      let color = '#808080' // Gray for neutral
      if (rel.status === 'broken') {
        color = '#DC143C' // Red for broken
      } else if (avg > 0.7) {
        color = '#32CD32' // Green for strong
      } else if (avg > 0.4) {
        color = '#FFD700' // Gold for moderate
      } else if (rel.relationshipTypes.includes('rivalry')) {
        color = '#FF4500' // Orange for rivalry
      }

      return {
        source: rel.agentId1,
        target: rel.agentId2,
        strength: avg,
        color,
        types: rel.relationshipTypes,
      }
    })

    return { nodes, edges }
  }

  /**
   * Get relationship trend (improving, stable, declining)
   */
  getRelationshipTrend(relationship: AgentRelationship): 'improving' | 'stable' | 'declining' {
    const events = relationship.significantEvents.slice(-5)

    if (events.length < 2) return 'stable'

    let totalTrustChange = 0
    for (const event of events) {
      totalTrustChange += event.impactOnMetrics.trust || 0
    }

    if (totalTrustChange > 0.1) return 'improving'
    if (totalTrustChange < -0.1) return 'declining'
    return 'stable'
  }
}

// Export singleton instance
export const relationshipService = new RelationshipService()

// Export class for testing
export { RelationshipService }
