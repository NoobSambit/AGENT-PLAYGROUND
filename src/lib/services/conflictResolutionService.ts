import { AgentRecord, AgentRelationship, RelationshipMetrics } from '@/types/database'
import { ConflictAnalysis } from '@/types/enhancements'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function tokenize(value: string): string[] {
  return value
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3)
}

function summarizePosition(message: string): string {
  return message
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, 180) || 'No clear position stated.'
}

const POLARITY_WORDS: Array<[string, string]> = [
  ['always', 'never'],
  ['should', 'should not'],
  ['possible', 'impossible'],
  ['trust', 'distrust'],
  ['open', 'closed'],
  ['fast', 'slow'],
  ['optimistic', 'pessimistic'],
]

export class ConflictResolutionService {
  analyze(params: {
    agent1: AgentRecord
    agent2: AgentRecord
    topic: string
    agent1Message: string
    agent2Message: string
    relationship?: AgentRelationship | null
    mediator?: AgentRecord | null
  }): ConflictAnalysis {
    const now = new Date().toISOString()
    const tokens1 = new Set(tokenize(params.agent1Message))
    const tokens2 = new Set(tokenize(params.agent2Message))
    const commonGround = [...tokens1].filter((token) => tokens2.has(token)).slice(0, 6)
    const frictionPoints = this.detectFrictionPoints(params.agent1Message, params.agent2Message, params.topic)

    const conflictStyle = params.agent1.psychologicalProfile?.communicationStyle.conflictStyle
      || params.agent2.psychologicalProfile?.communicationStyle.conflictStyle
      || 'compromising'

    const tension = this.estimateTension(
      params.agent1Message,
      params.agent2Message,
      params.relationship || undefined
    )

    const resolutionStyle = this.determineResolutionStyle(tension, conflictStyle, Boolean(params.mediator))
    const relationshipImpact = this.estimateRelationshipImpact(tension, resolutionStyle)
    const actionItems = this.generateActionItems({
      tension,
      resolutionStyle,
      commonGround,
      mediatorName: params.mediator?.name,
    })

    return {
      id: `conflict_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      topic: params.topic,
      tension,
      conflictStyle,
      resolutionStyle,
      commonGround,
      frictionPoints,
      actionItems,
      relationshipImpact,
      status: resolutionStyle === 'agree_to_disagree' ? 'stalemate' : params.mediator ? 'mediated' : 'analyzed',
      participants: [
        {
          agentId: params.agent1.id,
          agentName: params.agent1.name,
          position: summarizePosition(params.agent1Message),
        },
        {
          agentId: params.agent2.id,
          agentName: params.agent2.name,
          position: summarizePosition(params.agent2Message),
        },
      ],
      mediator: params.mediator
        ? {
            agentId: params.mediator.id,
            agentName: params.mediator.name,
          }
        : undefined,
      createdAt: now,
      updatedAt: now,
    }
  }

  buildPromptGuidance(analysis: ConflictAnalysis): string {
    const guidance = [
      `Conflict topic: ${analysis.topic}`,
      `Estimated tension: ${(analysis.tension * 100).toFixed(0)}%`,
      `Recommended resolution style: ${analysis.resolutionStyle.replace(/_/g, ' ')}`,
    ]

    if (analysis.commonGround.length > 0) {
      guidance.push(`Shared ground: ${analysis.commonGround.join(', ')}`)
    }

    if (analysis.actionItems.length > 0) {
      guidance.push(`Next actions: ${analysis.actionItems.join('; ')}`)
    }

    return guidance.join('\n')
  }

  private estimateTension(
    message1: string,
    message2: string,
    relationship?: AgentRelationship
  ): number {
    const combined = `${message1} ${message2}`.toLowerCase()
    let score = 0.25

    for (const keyword of ['disagree', 'wrong', 'cannot', 'won\'t', 'oppose', 'reject', 'conflict', 'never']) {
      if (combined.includes(keyword)) {
        score += 0.08
      }
    }

    for (const [left, right] of POLARITY_WORDS) {
      if (combined.includes(left) && combined.includes(right)) {
        score += 0.06
      }
    }

    if (relationship) {
      score += (1 - relationship.metrics.trust) * 0.18
      score += relationship.status === 'declining' ? 0.08 : 0
      score += relationship.status === 'broken' ? 0.15 : 0
    }

    return clamp(score, 0.1, 0.95)
  }

  private determineResolutionStyle(
    tension: number,
    conflictStyle: ConflictAnalysis['conflictStyle'],
    hasMediator: boolean
  ): ConflictAnalysis['resolutionStyle'] {
    if (hasMediator || tension > 0.7) {
      return 'mediation'
    }

    if (conflictStyle === 'collaborating' || conflictStyle === 'compromising') {
      return tension > 0.45 ? 'compromise' : 'collaboration'
    }

    if (conflictStyle === 'avoiding' && tension < 0.45) {
      return 'agree_to_disagree'
    }

    return tension > 0.55 ? 'compromise' : 'collaboration'
  }

  private estimateRelationshipImpact(
    tension: number,
    resolutionStyle: ConflictAnalysis['resolutionStyle']
  ): Partial<RelationshipMetrics> {
    if (resolutionStyle === 'mediation' || resolutionStyle === 'collaboration') {
      return {
        trust: clamp(0.05 - tension * 0.02, -0.08, 0.08),
        respect: clamp(0.08 - tension * 0.01, -0.06, 0.1),
        affection: clamp(0.03 - tension * 0.02, -0.07, 0.05),
      }
    }

    if (resolutionStyle === 'compromise') {
      return {
        trust: clamp(-0.02 + (0.6 - tension) * 0.05, -0.07, 0.04),
        respect: 0.04,
        affection: -0.01,
      }
    }

    return {
      trust: clamp(-0.08 * tension, -0.1, -0.03),
      respect: clamp(-0.05 * tension, -0.08, -0.02),
      affection: clamp(-0.04 * tension, -0.06, -0.01),
    }
  }

  private generateActionItems(params: {
    tension: number
    resolutionStyle: ConflictAnalysis['resolutionStyle']
    commonGround: string[]
    mediatorName?: string
  }): string[] {
    const actionItems: string[] = []

    if (params.commonGround.length > 0) {
      actionItems.push(`Start from shared priorities around ${params.commonGround.slice(0, 3).join(', ')}`)
    }

    if (params.resolutionStyle === 'mediation') {
      actionItems.push(params.mediatorName
        ? `Ask ${params.mediatorName} to summarize both sides neutrally`
        : 'Introduce a neutral mediator to reframe the disagreement')
      actionItems.push('Separate values disagreement from factual disagreement')
      actionItems.push('Confirm one concession each side is willing to make')
    } else if (params.resolutionStyle === 'compromise') {
      actionItems.push('Have each side state one non-negotiable and one flexible point')
      actionItems.push('Draft a midpoint solution with explicit tradeoffs')
    } else if (params.resolutionStyle === 'collaboration') {
      actionItems.push('Reframe the disagreement as a joint design problem')
      actionItems.push('Combine the strongest idea from each side into one proposal')
    } else {
      actionItems.push('Record the disagreement clearly without forcing false consensus')
      actionItems.push('Agree on what evidence would change either side’s position')
    }

    if (params.tension > 0.65) {
      actionItems.push('Lower emotional temperature before continuing the debate')
    }

    return actionItems
  }

  private detectFrictionPoints(message1: string, message2: string, topic: string): string[] {
    const friction = new Set<string>()
    const combined = `${message1} ${message2}`.toLowerCase()

    for (const [left, right] of POLARITY_WORDS) {
      if (combined.includes(left) && combined.includes(right)) {
        friction.add(`${left} vs ${right}`)
      }
    }

    if (combined.includes('evidence') || combined.includes('proof')) {
      friction.add('Different evidence standards')
    }
    if (combined.includes('value') || combined.includes('ethical') || combined.includes('should')) {
      friction.add('Values-based disagreement')
    }
    if (topic) {
      friction.add(`Competing views on ${topic}`)
    }

    return [...friction].slice(0, 5)
  }
}

export const conflictResolutionService = new ConflictResolutionService()
