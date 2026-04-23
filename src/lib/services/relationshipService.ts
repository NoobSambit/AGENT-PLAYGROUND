import {
  createRelationship as createRelationshipRecord,
  createEmptyGraphData,
  getRelationshipContext as buildRelationshipContext,
  getRelationshipTrend,
  normalizeRelationship,
  summarizeRelationship,
} from '@/lib/relationships/model'
import type {
  AgentRelationship,
  RelationshipEventType,
  RelationshipMetrics,
} from '@/types/database'

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function generateEventId(): string {
  return `rel_evt_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`
}

type LegacyInteractionTone = 'positive' | 'negative' | 'neutral'

class RelationshipService {
  createRelationship(agentId1: string, agentId2: string): AgentRelationship {
    return createRelationshipRecord(agentId1, agentId2)
  }

  normalizeRelationship(relationship: AgentRelationship): AgentRelationship {
    return normalizeRelationship(relationship)
  }

  analyzeInteraction(
    agent1Message: string,
    agent2Message: string
  ): { type: LegacyInteractionTone; intensity: number; eventType: RelationshipEventType } {
    const combined = `${agent1Message} ${agent2Message}`.toLowerCase()
    const positive = ['agree', 'help', 'support', 'thank', 'appreciate', 'respect', 'admire', 'together']
    const negative = ['disagree', 'wrong', 'attack', 'blame', 'conflict', 'ridiculous', 'oppose']
    const guidance = ['teach', 'guide', 'mentor', 'advise', 'explain']

    const positiveHits = positive.filter((token) => combined.includes(token)).length
    const negativeHits = negative.filter((token) => combined.includes(token)).length
    const guidanceHits = guidance.filter((token) => combined.includes(token)).length
    const intensity = clamp01(Math.max(0.2, Math.min(1, (positiveHits + negativeHits + guidanceHits) / 6)))

    if (guidanceHits > 1) {
      return { type: 'positive', intensity, eventType: 'guidance' }
    }

    if (negativeHits > positiveHits + 1) {
      return { type: 'negative', intensity, eventType: negativeHits > 2 ? 'conflict' : 'disagreement' }
    }

    if (positiveHits > negativeHits + 1) {
      return { type: 'positive', intensity, eventType: positiveHits > 2 ? 'bonding' : 'agreement' }
    }

    return { type: 'neutral', intensity: 0.22, eventType: 'support' }
  }

  // Compatibility-only path for legacy callers. New relationship mutations should flow through the orchestrator.
  updateRelationship(
    relationship: AgentRelationship,
    interaction: {
      type: LegacyInteractionTone
      context: string
      intensity: number
      eventType: RelationshipEventType
    }
  ): AgentRelationship {
    const current = normalizeRelationship(relationship)
    const base = interaction.intensity * 0.08
    const trustDelta = interaction.type === 'positive' ? base * 0.9 : interaction.type === 'negative' ? -base * 1.1 : 0
    const respectDelta = interaction.type === 'positive' ? base * 0.7 : interaction.type === 'negative' ? -base * 0.6 : 0
    const affectionDelta = interaction.type === 'positive' ? base * 0.65 : interaction.type === 'negative' ? -base * 0.7 : 0
    const familiarityDelta = Math.max(0.02, base * 0.4)

    const next: AgentRelationship = normalizeRelationship({
      ...current,
      metrics: {
        trust: clamp01(current.metrics.trust + trustDelta),
        respect: clamp01(current.metrics.respect + respectDelta),
        affection: clamp01(current.metrics.affection + affectionDelta),
        familiarity: clamp01(current.metrics.familiarity + familiarityDelta),
      },
      interactionCount: current.interactionCount + 1,
      lastInteraction: new Date().toISOString(),
      significantEvents: [
        ...current.significantEvents,
        {
          id: generateEventId(),
          type: interaction.eventType,
          description: interaction.context.slice(0, 220),
          impactOnMetrics: {
            trust: trustDelta,
            respect: respectDelta,
            affection: affectionDelta,
            familiarity: familiarityDelta,
          },
          timestamp: new Date().toISOString(),
          context: interaction.context.slice(0, 180),
        },
      ].slice(-10),
      updatedAt: new Date().toISOString(),
    })

    return next
  }

  getRelationshipContext(relationship: AgentRelationship, otherAgentName: string, perspectiveAgentId?: string): string {
    return buildRelationshipContext(normalizeRelationship(relationship), otherAgentName, perspectiveAgentId)
  }

  getRelationshipSummary(relationship: AgentRelationship) {
    return summarizeRelationship(normalizeRelationship(relationship))
  }

  getRelationshipTrend(relationship: AgentRelationship): 'improving' | 'stable' | 'declining' {
    return getRelationshipTrend(normalizeRelationship(relationship))
  }

  calculateNetworkStats(relationships: AgentRelationship[]) {
    const normalized = relationships.map((relationship) => normalizeRelationship(relationship))

    if (normalized.length === 0) {
      return {
        totalRelationships: 0,
        strongBonds: 0,
        averageTrust: 0,
        averageRespect: 0,
        averageAffection: 0,
        brokenBonds: 0,
        mostConnectedAgent: null as string | null,
      }
    }

    const totals = normalized.reduce((acc, relationship) => {
      acc.trust += relationship.metrics.trust
      acc.respect += relationship.metrics.respect
      acc.affection += relationship.metrics.affection
      return acc
    }, { trust: 0, respect: 0, affection: 0 })

    const counts = new Map<string, number>()
    for (const relationship of normalized) {
      counts.set(relationship.agentId1, (counts.get(relationship.agentId1) || 0) + 1)
      counts.set(relationship.agentId2, (counts.get(relationship.agentId2) || 0) + 1)
    }

    const mostConnected = [...counts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || null

    return {
      totalRelationships: normalized.length,
      strongBonds: normalized.filter((relationship) => relationship.derived.bondStrength >= 0.62 && relationship.derived.tension < 0.42).length,
      averageTrust: totals.trust / normalized.length,
      averageRespect: totals.respect / normalized.length,
      averageAffection: totals.affection / normalized.length,
      brokenBonds: normalized.filter((relationship) => relationship.status === 'broken').length,
      mostConnectedAgent: mostConnected,
    }
  }

  generateNetworkGraphData(
    relationships: AgentRelationship[],
    agents: Array<{ id: string; name: string }>
  ) {
    const graph = createEmptyGraphData()
    graph.nodes = agents
    graph.edges = relationships.map((relationship) => {
      const normalized = normalizeRelationship(relationship)
      return {
        source: normalized.agentId1,
        target: normalized.agentId2,
        strength: normalized.derived.bondStrength,
        tension: normalized.derived.tension,
        types: normalized.relationshipTypes,
      }
    })
    return graph
  }

  getAverageMetrics(relationship: AgentRelationship): RelationshipMetrics {
    const normalized = normalizeRelationship(relationship)
    return normalized.metrics
  }
}

export const relationshipService = new RelationshipService()
