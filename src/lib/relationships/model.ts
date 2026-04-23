import { asIsoString, relationshipPairId, sortedPair } from '@/lib/db/utils'
import type {
  AgentRelationship,
  RelationshipAlertFlag,
  RelationshipDerivedState,
  RelationshipDirectionalState,
  RelationshipEvent,
  RelationshipMetrics,
  RelationshipPromptGuidance,
  RelationshipSourceKind,
  RelationshipSourceStats,
  RelationshipType,
} from '@/types/database'

export const RELATIONSHIP_PROMPT_VERSION = 'relationship-v2'

export const DEFAULT_RELATIONSHIP_METRICS: RelationshipMetrics = {
  trust: 0.32,
  respect: 0.34,
  affection: 0.12,
  familiarity: 0.1,
}

function clamp01(value: number): number {
  if (Number.isNaN(value)) return 0
  return Math.max(0, Math.min(1, value))
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function roundMetric(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000
}

export function createEmptySourceStats(): RelationshipSourceStats {
  return {
    arena: { count: 0 },
    challenge: { count: 0 },
    conflict: { count: 0 },
    mentorship: { count: 0 },
    manual: { count: 0 },
    simulation: { count: 0 },
  }
}

function createDirectionalState(agentId: string, metrics: RelationshipMetrics): RelationshipDirectionalState {
  return {
    agentId,
    trust: roundMetric(metrics.trust),
    respect: roundMetric(metrics.respect),
    affection: roundMetric(metrics.affection),
    alignment: roundMetric(Math.max(0.18, metrics.respect * 0.72)),
    reliance: roundMetric(Math.max(0.08, metrics.trust * 0.66)),
    grievance: roundMetric(Math.max(0, 0.18 - metrics.affection * 0.12)),
    summary: 'Early impressions are still forming.',
    sensitivities: [],
    levers: [],
  }
}

function computeMomentum(events: RelationshipEvent[]): number {
  const recent = events.slice(-5)
  if (recent.length === 0) return 0
  const score = average(
    recent.map((event) => {
      const impact = event.impactOnMetrics
      return (
        (impact.trust || 0) * 1.2 +
        (impact.respect || 0) +
        (impact.affection || 0) * 0.9
      )
    })
  )
  return roundMetric(Math.max(-1, Math.min(1, score * 4)))
}

function computeVolatility(events: RelationshipEvent[]): number {
  const recent = events.slice(-6)
  if (recent.length === 0) return 0.08
  const swing = average(
    recent.map((event) => {
      const impact = event.impactOnMetrics
      return Math.abs(impact.trust || 0) + Math.abs(impact.respect || 0) + Math.abs(impact.affection || 0)
    })
  )
  return roundMetric(Math.max(0.08, Math.min(1, swing * 3.5)))
}

function computeInteractionVelocity(interactionCount: number, firstMeeting: string, lastInteraction: string): number {
  const first = new Date(asIsoString(firstMeeting)).getTime()
  const last = new Date(asIsoString(lastInteraction)).getTime()
  const days = Math.max(1, (last - first) / (1000 * 60 * 60 * 24))
  return roundMetric(Math.min(1, interactionCount / Math.max(3, days * 1.8)))
}

function computeDerivedState(relationship: AgentRelationship): RelationshipDerivedState {
  const left = relationship.directional[relationship.agentId1]
  const right = relationship.directional[relationship.agentId2]
  const asymmetry = average([
    Math.abs(left.trust - right.trust),
    Math.abs(left.respect - right.respect),
    Math.abs(left.affection - right.affection),
    Math.abs(left.alignment - right.alignment),
    Math.abs(left.reliance - right.reliance),
  ])
  const tension = average([
    left.grievance,
    right.grievance,
    1 - left.alignment,
    1 - right.alignment,
  ])
  const bondStrength = average([
    relationship.metrics.trust,
    relationship.metrics.respect,
    relationship.metrics.affection,
    Math.max(0, 1 - tension),
  ])

  return {
    tension: roundMetric(tension),
    reciprocity: roundMetric(Math.max(0, 1 - asymmetry)),
    volatility: computeVolatility(relationship.significantEvents),
    bondStrength: roundMetric(bondStrength),
    momentum: computeMomentum(relationship.significantEvents),
    interactionVelocity: computeInteractionVelocity(
      relationship.interactionCount,
      relationship.firstMeeting,
      relationship.lastInteraction
    ),
  }
}

function deriveRelationshipStatus(relationship: AgentRelationship): AgentRelationship['status'] {
  const { trust, respect, affection, familiarity } = relationship.metrics
  const tension = relationship.derived.tension

  if (trust < 0.18 && affection < 0.12 && familiarity > 0.28) {
    return 'broken'
  }

  if (tension > 0.72 || relationship.alertFlags.includes('high_tension')) {
    return 'strained'
  }

  if (relationship.derived.momentum < -0.12) {
    return 'declining'
  }

  if (familiarity < 0.18 && relationship.interactionCount <= 2) {
    return 'forming'
  }

  if (average([trust, respect, affection]) > 0.56 || relationship.derived.momentum > 0.14) {
    return 'growing'
  }

  return 'stable'
}

function deriveRelationshipTypes(relationship: AgentRelationship): RelationshipType[] {
  const left = relationship.directional[relationship.agentId1]
  const right = relationship.directional[relationship.agentId2]
  const types: RelationshipType[] = []
  const avgAlignment = average([left.alignment, right.alignment])
  const avgRespect = average([left.respect, right.respect])
  const avgTrust = average([left.trust, right.trust])
  const avgAffection = average([left.affection, right.affection])
  const avgReliance = average([left.reliance, right.reliance])

  if (relationship.sourceStats.mentorship.count > 0 && Math.max(left.reliance, right.reliance) > 0.58) {
    types.push('mentorship')
  }

  if (relationship.derived.tension > 0.78 && avgTrust < 0.22) {
    types.push('adversarial')
  } else if (relationship.derived.tension > 0.58 && avgRespect > 0.46) {
    types.push('rivalry')
  }

  if (avgTrust > 0.68 && avgRespect > 0.68 && avgAlignment > 0.58) {
    types.push('alliance')
  } else if (avgTrust > 0.56 && avgRespect > 0.58) {
    types.push('collaborator')
  } else if (avgRespect > 0.48 && avgReliance > 0.32) {
    types.push('professional')
  }

  if (avgTrust > 0.62 && avgAffection > 0.64) {
    types.push('friendship')
  }

  if (relationship.derived.tension > 0.6) {
    types.push('strained')
  }

  if (avgTrust < 0.2 && avgAffection < 0.16 && relationship.metrics.familiarity > 0.4) {
    types.push('estranged')
  }

  if (types.length === 0) {
    types.push('acquaintance')
  }

  return [...new Set(types)]
}

function deriveAlertFlags(relationship: AgentRelationship): RelationshipAlertFlag[] {
  const left = relationship.directional[relationship.agentId1]
  const right = relationship.directional[relationship.agentId2]
  const flags: RelationshipAlertFlag[] = []

  if (Math.abs(left.trust - right.trust) > 0.24 || Math.abs(left.reliance - right.reliance) > 0.24) {
    flags.push('trust_asymmetry')
  }

  if (relationship.derived.tension > 0.64) {
    flags.push('high_tension')
  }

  if (relationship.derived.momentum < -0.18) {
    flags.push('recent_drop')
  }

  if (relationship.sourceStats.mentorship.count > 0 && Math.max(left.reliance, right.reliance) > 0.72) {
    flags.push('mentor_dependency')
  }

  if (relationship.derived.tension > 0.45 && relationship.derived.momentum > 0.04) {
    flags.push('repair_window')
  }

  if (relationship.derived.interactionVelocity < 0.12 && relationship.metrics.familiarity > 0.38) {
    flags.push('stalled_relationship')
  }

  return flags
}

function relationshipHeadline(relationship: AgentRelationship): string {
  const otherTypes = relationship.relationshipTypes.filter((type) => type !== 'acquaintance')
  const typeLabel = (otherTypes[0] || relationship.relationshipTypes[0] || 'acquaintance').replace(/_/g, ' ')
  const tone = relationship.status === 'strained'
    ? 'fragile'
    : relationship.status === 'broken'
      ? 'fractured'
      : relationship.status === 'growing'
        ? 'strengthening'
        : relationship.status
  return `${typeLabel} dynamic, ${tone} overall.`
}

function directionalSummary(side: RelationshipDirectionalState): string {
  if (side.grievance > 0.62) {
    return 'Carries active grievance and expects proof before trusting.'
  }
  if (side.trust > 0.68 && side.affection > 0.56) {
    return 'Leans warm, trusting, and personally invested.'
  }
  if (side.respect > 0.62 && side.alignment < 0.45) {
    return 'Respects the other side, but does not naturally align with them.'
  }
  if (side.reliance > 0.58) {
    return 'Depends on the other side for follow-through or guidance.'
  }
  return 'Still calibrating trust, alignment, and emotional closeness.'
}

function buildGuidance(relationship: AgentRelationship): RelationshipPromptGuidance {
  const left = relationship.directional[relationship.agentId1]
  const right = relationship.directional[relationship.agentId2]
  const sharedSummary = [
    relationshipHeadline(relationship),
    relationship.alertFlags.length > 0 ? `Watch ${relationship.alertFlags.join(', ').replace(/_/g, ' ')}.` : '',
    relationship.latestRevisionSummary || '',
  ].filter(Boolean).join(' ')

  const buildSide = (side: RelationshipDirectionalState, other: RelationshipDirectionalState) => ({
    agentId: side.agentId,
    speakerSummary: directionalSummary(side),
    doMoreOf: [
      side.trust < 0.5 ? 'offer concrete proof and follow-through' : '',
      side.alignment < 0.45 ? 'acknowledge tradeoffs before pushing your own line' : '',
      other.grievance > 0.48 ? 'show that you heard the previous friction directly' : '',
    ].filter(Boolean),
    avoid: [
      side.grievance > 0.52 ? 'avoid casual dismissals or sharp certainty' : '',
      side.reliance > 0.62 ? 'avoid overpromising support you will not maintain' : '',
      relationship.alertFlags.includes('trust_asymmetry') ? 'avoid assuming both sides feel equally secure' : '',
    ].filter(Boolean),
  })

  return {
    sharedSummary,
    promptWindowSummary: [
      sharedSummary,
      `Bond ${Math.round(relationship.derived.bondStrength * 100)}%, tension ${Math.round(relationship.derived.tension * 100)}%, reciprocity ${Math.round(relationship.derived.reciprocity * 100)}%.`,
    ].join(' '),
    sides: [buildSide(left, right), buildSide(right, left)],
  }
}

export function normalizeRelationship(input: AgentRelationship): AgentRelationship {
  const [agentId1, agentId2] = sortedPair(input.agentId1, input.agentId2)
  const id = relationshipPairId(agentId1, agentId2)
  const metrics: RelationshipMetrics = {
    trust: roundMetric(input.metrics?.trust ?? DEFAULT_RELATIONSHIP_METRICS.trust),
    respect: roundMetric(input.metrics?.respect ?? DEFAULT_RELATIONSHIP_METRICS.respect),
    affection: roundMetric(input.metrics?.affection ?? DEFAULT_RELATIONSHIP_METRICS.affection),
    familiarity: roundMetric(input.metrics?.familiarity ?? DEFAULT_RELATIONSHIP_METRICS.familiarity),
  }
  const now = new Date().toISOString()

  const base: AgentRelationship = {
    id,
    agentId1,
    agentId2,
    relationshipTypes: input.relationshipTypes?.length ? input.relationshipTypes : ['acquaintance'],
    metrics,
    status: input.status || 'forming',
    interactionCount: input.interactionCount || 0,
    lastInteraction: asIsoString(input.lastInteraction || now),
    firstMeeting: asIsoString(input.firstMeeting || now),
    directional: input.directional && Object.keys(input.directional).length > 0
      ? {
          [agentId1]: {
            ...createDirectionalState(agentId1, metrics),
            ...input.directional[agentId1],
            agentId: agentId1,
          },
          [agentId2]: {
            ...createDirectionalState(agentId2, metrics),
            ...input.directional[agentId2],
            agentId: agentId2,
          },
        }
      : {
          [agentId1]: createDirectionalState(agentId1, metrics),
          [agentId2]: createDirectionalState(agentId2, metrics),
        },
    derived: input.derived || {
      tension: 0.18,
      reciprocity: 0.86,
      volatility: 0.08,
      bondStrength: average(Object.values(metrics)),
      momentum: 0,
      interactionVelocity: 0,
    },
    guidance: input.guidance || {
      sharedSummary: 'Social dynamic still forming.',
      promptWindowSummary: 'Social dynamic still forming.',
      sides: [],
    },
    sourceStats: {
      ...createEmptySourceStats(),
      ...(input.sourceStats || {}),
    },
    alertFlags: input.alertFlags || [],
    lastRevisionAt: input.lastRevisionAt ? asIsoString(input.lastRevisionAt) : undefined,
    latestRevisionSummary: input.latestRevisionSummary,
    significantEvents: Array.isArray(input.significantEvents) ? input.significantEvents : [],
    createdAt: asIsoString(input.createdAt || now),
    updatedAt: asIsoString(input.updatedAt || now),
  }

  const withDerived = {
    ...base,
    derived: computeDerivedState(base),
  }
  const withAlerts = {
    ...withDerived,
    alertFlags: deriveAlertFlags(withDerived),
  }
  const withStatus = {
    ...withAlerts,
    status: deriveRelationshipStatus(withAlerts),
  }
  const withTypes = {
    ...withStatus,
    relationshipTypes: deriveRelationshipTypes(withStatus),
  }
  const withGuidance = {
    ...withTypes,
    guidance: buildGuidance(withTypes),
  }

  return {
    ...withGuidance,
    updatedAt: asIsoString(withGuidance.updatedAt),
  }
}

export function createRelationship(agentId1: string, agentId2: string): AgentRelationship {
  const now = new Date().toISOString()
  return normalizeRelationship({
    id: relationshipPairId(agentId1, agentId2),
    agentId1,
    agentId2,
    relationshipTypes: ['acquaintance'],
    metrics: { ...DEFAULT_RELATIONSHIP_METRICS },
    status: 'forming',
    interactionCount: 0,
    lastInteraction: now,
    firstMeeting: now,
    directional: {
      [agentId1]: createDirectionalState(agentId1, DEFAULT_RELATIONSHIP_METRICS),
      [agentId2]: createDirectionalState(agentId2, DEFAULT_RELATIONSHIP_METRICS),
    },
    derived: {
      tension: 0.18,
      reciprocity: 0.86,
      volatility: 0.08,
      bondStrength: average(Object.values(DEFAULT_RELATIONSHIP_METRICS)),
      momentum: 0,
      interactionVelocity: 0,
    },
    guidance: {
      sharedSummary: 'Social dynamic still forming.',
      promptWindowSummary: 'Social dynamic still forming.',
      sides: [],
    },
    sourceStats: createEmptySourceStats(),
    alertFlags: [],
    significantEvents: [{
      id: `rel_evt_${Date.now()}`,
      type: 'first_meeting',
      description: 'Relationship record created.',
      impactOnMetrics: {},
      timestamp: now,
    }],
    createdAt: now,
    updatedAt: now,
  })
}

export function summarizeRelationship(relationship: AgentRelationship): {
  label: string
  icon: string
  tone: 'warm' | 'calm' | 'tense' | 'cold'
} {
  const primary = relationship.relationshipTypes[0] || 'acquaintance'

  if (relationship.status === 'broken' || primary === 'adversarial' || primary === 'estranged') {
    return { label: 'Fractured tie', icon: '⚠️', tone: 'cold' }
  }

  if (primary === 'friendship' || primary === 'alliance') {
    return { label: 'Trusted bond', icon: '✦', tone: 'warm' }
  }

  if (primary === 'mentorship') {
    return { label: 'Mentorship line', icon: '△', tone: 'calm' }
  }

  if (primary === 'rivalry' || primary === 'strained') {
    return { label: 'Live tension', icon: '↯', tone: 'tense' }
  }

  if (primary === 'collaborator' || primary === 'professional') {
    return { label: 'Working alliance', icon: '⋯', tone: 'calm' }
  }

  return { label: 'Emerging tie', icon: '•', tone: 'calm' }
}

export function getRelationshipTrend(relationship: AgentRelationship): 'improving' | 'stable' | 'declining' {
  if (relationship.derived.momentum > 0.12) {
    return 'improving'
  }
  if (relationship.derived.momentum < -0.12 || relationship.status === 'declining' || relationship.status === 'strained') {
    return 'declining'
  }
  return 'stable'
}

export function getRelationshipContext(
  relationship: AgentRelationship,
  otherAgentName: string,
  perspectiveAgentId?: string
): string {
  const normalized = normalizeRelationship(relationship)
  const perspective = perspectiveAgentId && normalized.directional[perspectiveAgentId]
    ? normalized.directional[perspectiveAgentId]
    : normalized.directional[normalized.agentId1]

  const summary = summarizeRelationship(normalized)
  return [
    `Current relationship with ${otherAgentName}: ${summary.label}.`,
    normalized.guidance.sharedSummary,
    `From your side: ${perspective.summary || directionalSummary(perspective)}`,
    perspective.levers.length > 0 ? `Positive levers: ${perspective.levers.join('; ')}.` : '',
    perspective.sensitivities.length > 0 ? `Sensitivities: ${perspective.sensitivities.join('; ')}.` : '',
  ].filter(Boolean).join(' ')
}

export function createEmptyGraphData() {
  return {
    nodes: [] as Array<{ id: string; name: string }>,
    edges: [] as Array<{ source: string; target: string; strength: number; tension: number; types: RelationshipType[] }>,
  }
}

export function incrementSourceStats(
  sourceStats: RelationshipSourceStats,
  sourceKind: RelationshipSourceKind,
  createdAt: string
): RelationshipSourceStats {
  const next = {
    ...sourceStats,
    [sourceKind]: {
      count: (sourceStats[sourceKind]?.count || 0) + 1,
      latestAt: asIsoString(createdAt),
    },
  }

  return next
}

