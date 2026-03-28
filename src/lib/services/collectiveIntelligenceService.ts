import { AgentRecord, SharedKnowledge } from '@/types/database'
import {
  AgentValidation,
  CollectiveIntelligenceSnapshot,
  ConsensusSnapshot,
  ExpertReferral,
  KnowledgeBroadcast,
  KnowledgeRepository,
} from '@/types/enhancements'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 2)
}

function getRepositoryTopic(entry: SharedKnowledge): string {
  if (entry.tags.length > 0) {
    return entry.tags[0]
  }

  const words = entry.topic.trim().split(/\s+/)
  return words.slice(0, Math.min(words.length, 3)).join(' ')
}

export class CollectiveIntelligenceService {
  buildRepositories(knowledge: SharedKnowledge[]): KnowledgeRepository[] {
    const groups = new Map<string, SharedKnowledge[]>()

    for (const entry of knowledge) {
      const key = getRepositoryTopic(entry)
      groups.set(key, [...(groups.get(key) || []), entry])
    }

    return [...groups.entries()]
      .map(([topic, entries]) => {
        const contributingAgents = [...new Set(entries.map((entry) => entry.contributorId))]
        const tags = [...new Set(entries.flatMap((entry) => entry.tags))].slice(0, 8)
        const consensusRating = entries.reduce((sum, entry) => sum + entry.confidence, 0) / Math.max(entries.length, 1)
        const lastUpdated = entries
          .map((entry) => entry.updatedAt || entry.createdAt)
          .sort((a, b) => new Date(b).getTime() - new Date(a).getTime())[0] || new Date().toISOString()

        return {
          id: `repo-${slugify(topic)}`,
          topic,
          contributingAgents,
          entryIds: entries.map((entry) => entry.id),
          consensusRating,
          totalEntries: entries.length,
          tags,
          lastUpdated,
        }
      })
      .sort((a, b) => {
        if (b.totalEntries !== a.totalEntries) {
          return b.totalEntries - a.totalEntries
        }
        return b.consensusRating - a.consensusRating
      })
  }

  buildAgentValidations(entry: SharedKnowledge, agents: AgentRecord[]): AgentValidation[] {
    const agentNameById = new Map(agents.map((agent) => [agent.id, agent.name]))
    const validations: AgentValidation[] = []

    validations.push({
      agentId: entry.contributorId,
      agentName: agentNameById.get(entry.contributorId) || entry.contributorName,
      verdict: 'support',
      confidence: clamp(entry.confidence, 0.35, 0.95),
      rationale: 'Original contributor to the knowledge entry.',
      timestamp: entry.createdAt,
    })

    for (const agentId of entry.endorsements) {
      validations.push({
        agentId,
        agentName: agentNameById.get(agentId) || 'Unknown agent',
        verdict: 'support',
        confidence: clamp(0.55 + entry.confidence * 0.35, 0.4, 0.95),
        rationale: 'Endorsed this entry as reliable.',
        timestamp: entry.updatedAt,
      })
    }

    for (const dispute of entry.disputes) {
      validations.push({
        agentId: dispute.agentId,
        agentName: agentNameById.get(dispute.agentId) || 'Unknown agent',
        verdict: 'dispute',
        confidence: 0.65,
        rationale: dispute.reason,
        timestamp: dispute.timestamp,
      })
    }

    return validations
  }

  buildConsensusSnapshots(entries: SharedKnowledge[], agents: AgentRecord[]): ConsensusSnapshot[] {
    return entries.slice(0, 8).map((entry) => {
      const validatingAgents = this.buildAgentValidations(entry, agents)
      const supportCount = validatingAgents.filter((item) => item.verdict === 'support').length
      const disputeCount = validatingAgents.filter((item) => item.verdict === 'dispute').length
      const uncertainCount = validatingAgents.filter((item) => item.verdict === 'uncertain').length
      const consensusRating = clamp(entry.confidence + supportCount * 0.05 - disputeCount * 0.08, 0, 1)

      const recommendedPosition = disputeCount === 0
        ? 'Network support is strong. Safe to reuse with attribution.'
        : supportCount > disputeCount
          ? 'Mostly supported, but there is meaningful disagreement to mention.'
          : 'Consensus is weak. Treat this as contested knowledge.'

      return {
        topic: entry.topic,
        supportCount,
        disputeCount,
        uncertainCount,
        consensusRating,
        recommendedPosition,
        validatingAgents,
      }
    })
  }

  getExpertReferrals(
    queryText: string,
    agents: AgentRecord[],
    knowledge: SharedKnowledge[],
    currentAgentId?: string
  ): ExpertReferral[] {
    const tokens = tokenize(queryText)
    if (tokens.length === 0) {
      return []
    }

    const contributionsByAgent = new Map<string, SharedKnowledge[]>()
    for (const entry of knowledge) {
      contributionsByAgent.set(entry.contributorId, [...(contributionsByAgent.get(entry.contributorId) || []), entry])
    }

    return agents
      .filter((agent) => agent.id !== currentAgentId)
      .map((agent) => {
        const contributions = contributionsByAgent.get(agent.id) || []
        let score = 0

        const expertiseTopics = contributions
          .flatMap((entry) => [entry.topic, ...entry.tags])
          .filter(Boolean)
          .slice(0, 6)

        const supportingKnowledgeIds: string[] = []

        for (const entry of contributions) {
          const haystack = `${entry.topic} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase()
          let entryScore = 0
          for (const token of tokens) {
            if (haystack.includes(token)) {
              entryScore += 2
            }
          }
          if (entryScore > 0) {
            entryScore *= clamp(entry.confidence + entry.endorsements.length * 0.05, 0.35, 1.2)
            score += entryScore
            supportingKnowledgeIds.push(entry.id)
          }
        }

        score += Math.min((agent.stats?.uniqueTopics?.length || 0) * 0.02, 0.4)
        score += Math.min((agent.dynamicTraits?.knowledge || 0) * 0.6, 0.6)
        score += Math.min((agent.progress?.level || 1) * 0.03, 0.45)

        const reasoning = supportingKnowledgeIds.length > 0
          ? `${agent.name} has ${supportingKnowledgeIds.length} matching knowledge contribution(s) related to this query.`
          : `${agent.name} has broad signals of expertise but no direct shared entry on this query yet.`

        return {
          agentId: agent.id,
          agentName: agent.name,
          score,
          reasoning,
          expertiseTopics,
          supportingKnowledgeIds,
        }
      })
      .filter((referral) => referral.score > 0.4)
      .sort((a, b) => b.score - a.score)
      .slice(0, 4)
  }

  buildPromptContext(snapshot: CollectiveIntelligenceSnapshot): string {
    const parts: string[] = []

    if (snapshot.relevantKnowledge.length > 0) {
      const knowledgeLines = snapshot.relevantKnowledge
        .slice(0, 4)
        .map((entry) => `- ${entry.topic}: ${entry.content} (confidence ${(entry.confidence * 100).toFixed(0)}%)`)
      parts.push(`Collective knowledge available:\n${knowledgeLines.join('\n')}`)
    }

    if (snapshot.referrals.length > 0) {
      const referralLines = snapshot.referrals
        .slice(0, 2)
        .map((referral) => `- ${referral.agentName}: ${referral.reasoning}`)
      parts.push(`Potential expert referrals:\n${referralLines.join('\n')}`)
    }

    if (snapshot.consensus.length > 0) {
      const consensus = snapshot.consensus[0]
      parts.push(
        `Consensus signal for "${consensus.topic}": ${(consensus.consensusRating * 100).toFixed(0)}% confidence. ${consensus.recommendedPosition}`
      )
    }

    return parts.join('\n\n')
  }

  createSnapshot(params: {
    agents: AgentRecord[]
    knowledge: SharedKnowledge[]
    broadcasts: KnowledgeBroadcast[]
    queryText?: string
    currentAgentId?: string
  }): CollectiveIntelligenceSnapshot {
    const repositories = this.buildRepositories(params.knowledge).slice(0, 6)
    const relevantKnowledge = params.queryText
      ? this.rankRelevantKnowledge(params.queryText, params.knowledge)
      : params.knowledge.slice(0, 6)
    const referrals = params.queryText
      ? this.getExpertReferrals(params.queryText, params.agents, params.knowledge, params.currentAgentId)
      : []
    const consensus = this.buildConsensusSnapshots(relevantKnowledge, params.agents)

    return {
      repositories,
      referrals,
      consensus,
      broadcasts: params.broadcasts.slice(0, 6),
      relevantKnowledge,
    }
  }

  rankRelevantKnowledge(queryText: string, knowledge: SharedKnowledge[]): SharedKnowledge[] {
    const tokens = tokenize(queryText)
    if (tokens.length === 0) {
      return knowledge
        .slice()
        .sort((a, b) => b.confidence - a.confidence)
        .slice(0, 6)
    }

    return knowledge
      .map((entry) => {
        const haystack = `${entry.topic} ${entry.content} ${entry.tags.join(' ')}`.toLowerCase()
        let score = entry.confidence
        for (const token of tokens) {
          if (haystack.includes(token)) {
            score += entry.topic.toLowerCase().includes(token) ? 1.8 : 0.8
          }
        }
        score += entry.endorsements.length * 0.08
        score -= entry.disputes.length * 0.12

        return { entry, score }
      })
      .filter((item) => item.score > 0.45)
      .sort((a, b) => b.score - a.score)
      .slice(0, 6)
      .map((item) => item.entry)
  }

  suggestBroadcast(agent: AgentRecord, topic: string, summary: string, knowledgeId?: string): KnowledgeBroadcast {
    return {
      id: `broadcast_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      agentId: agent.id,
      agentName: agent.name,
      topic,
      summary,
      knowledgeId,
      reach: Math.max(1, Math.round((agent.relationshipCount || 1) * 1.4)),
      endorsements: 0,
      createdAt: new Date().toISOString(),
    }
  }
}

export const collectiveIntelligenceService = new CollectiveIntelligenceService()
