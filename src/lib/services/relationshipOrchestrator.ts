import { generateId, relationshipPairId, sortedPair } from '@/lib/db/utils'
import {
  RELATIONSHIP_PROMPT_VERSION,
  createEmptyGraphData,
  createRelationship,
  incrementSourceStats,
  normalizeRelationship,
} from '@/lib/relationships/model'
import { RelationshipEvidenceRepository } from '@/lib/repositories/relationshipEvidenceRepository'
import { RelationshipRepository } from '@/lib/repositories/relationshipRepository'
import { RelationshipRevisionRepository } from '@/lib/repositories/relationshipRevisionRepository'
import { RelationshipSynthesisRunRepository } from '@/lib/repositories/relationshipSynthesisRunRepository'
import { agentProgressService } from '@/lib/services/agentProgressService'
import { AgentService } from '@/lib/services/agentService'
import type {
  AgentRecord,
  AgentRelationship,
  ArenaEvent,
  ArenaRun,
  ChallengeEvent,
  ChallengeParticipantResult,
  ChallengeRun,
  Mentorship,
  MentorshipSession,
  RelationshipDirectionalDelta,
  RelationshipEvidence,
  RelationshipNetworkSummary,
  RelationshipRevision,
  RelationshipRosterItem,
  RelationshipSignalKind,
  RelationshipSourceKind,
  RelationshipSynthesisRun,
  RelationshipWorkspaceBootstrap,
  RelationshipWorkspaceDetail,
} from '@/types/database'
import type { ConflictAnalysis } from '@/types/enhancements'

type DirectionalVector = {
  trust?: number
  respect?: number
  affection?: number
  alignment?: number
  reliance?: number
  grievance?: number
}

interface RelationshipEvidenceDraft {
  agentId1: string
  agentId2: string
  actorAgentId?: string
  targetAgentId?: string
  signalKind: RelationshipSignalKind
  valence: number
  weight: number
  confidence: number
  summary: string
  excerptRefs?: string[]
  metadata?: Record<string, unknown>
  sourceStage?: string
  createdAt?: string
}

interface ApplyRelationshipSourceParams {
  sourceKind: RelationshipSourceKind
  sourceId: string
  evidence: RelationshipEvidenceDraft[]
  provider?: string
  model?: string
}

interface SynthesisOutcome {
  relationship: AgentRelationship
  delta: RelationshipRevision['delta']
  summary: string
  confidence: number
  supportingEvidenceIds: string[]
  changedTypes: RelationshipRevision['changedTypes']
  changedAlerts: RelationshipRevision['changedAlerts']
  applied: boolean
  reasons: string[]
  rawOutput: Record<string, unknown>
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function average(values: number[]): number {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function roundMetric(value: number): number {
  return Math.round(clamp01(value) * 1000) / 1000
}

function roundSigned(value: number): number {
  return Math.round(value * 1000) / 1000
}

const SOURCE_WEIGHTS: Record<RelationshipSourceKind, number> = {
  arena: 0.72,
  challenge: 0.68,
  conflict: 0.94,
  mentorship: 0.82,
  manual: 0.88,
  simulation: 0.5,
}

const SIGNAL_EFFECTS: Record<RelationshipSignalKind, {
  shared?: { trust?: number; respect?: number; affection?: number; familiarity?: number }
  actor?: DirectionalVector
  target?: DirectionalVector
  symmetric?: DirectionalVector
}> = {
  support: {
    shared: { trust: 0.03, respect: 0.02, affection: 0.018, familiarity: 0.01 },
    actor: { alignment: 0.02 },
    target: { trust: 0.05, respect: 0.03, affection: 0.025, reliance: 0.02, grievance: -0.03 },
  },
  agreement: {
    shared: { trust: 0.02, respect: 0.025, affection: 0.015, familiarity: 0.01 },
    symmetric: { alignment: 0.05, grievance: -0.015 },
  },
  constructive_disagreement: {
    shared: { respect: 0.018, familiarity: 0.01 },
    symmetric: { alignment: -0.03, grievance: 0.012 },
    actor: { alignment: 0.03, grievance: 0.014 },
    target: { trust: -0.018, respect: -0.01, alignment: -0.04, grievance: 0.03 },
  },
  dismissal: {
    shared: { trust: -0.045, respect: -0.04, affection: -0.025 },
    actor: { alignment: -0.03, grievance: 0.02 },
    target: { trust: -0.06, respect: -0.07, affection: -0.03, grievance: 0.09 },
  },
  conflict: {
    shared: { trust: -0.05, respect: -0.03, affection: -0.035, familiarity: 0.006 },
    symmetric: { alignment: -0.05, grievance: 0.05 },
    actor: { alignment: 0.02, grievance: 0.03 },
    target: { trust: -0.045, respect: -0.03, alignment: -0.07, grievance: 0.09 },
  },
  repair: {
    shared: { trust: 0.045, respect: 0.025, affection: 0.02, familiarity: 0.008 },
    symmetric: { alignment: 0.04, grievance: -0.07 },
  },
  follow_through: {
    shared: { trust: 0.05, respect: 0.022, familiarity: 0.008 },
    target: { trust: 0.08, reliance: 0.05, grievance: -0.035 },
  },
  betrayal: {
    shared: { trust: -0.11, respect: -0.07, affection: -0.06 },
    actor: { alignment: -0.06, grievance: 0.03 },
    target: { trust: -0.16, respect: -0.1, affection: -0.08, grievance: 0.16 },
  },
  guidance: {
    shared: { respect: 0.02, familiarity: 0.014 },
    actor: { affection: 0.01, alignment: 0.02 },
    target: { respect: 0.06, reliance: 0.08, trust: 0.04, grievance: -0.02 },
  },
  admiration: {
    shared: { respect: 0.028, affection: 0.018 },
    actor: { respect: 0.05, affection: 0.03 },
    target: { trust: 0.015 },
  },
  coalition: {
    shared: { trust: 0.04, respect: 0.025, affection: 0.018, familiarity: 0.01 },
    symmetric: { alignment: 0.08, grievance: -0.03 },
  },
  competition: {
    shared: { respect: 0.012, familiarity: 0.008 },
    symmetric: { alignment: -0.02, grievance: 0.015 },
    actor: { respect: 0.012, alignment: 0.028 },
    target: { trust: -0.012, respect: -0.008, alignment: -0.045, grievance: 0.04 },
  },
  mediation: {
    shared: { trust: 0.025, respect: 0.028, familiarity: 0.006 },
    symmetric: { alignment: 0.03, grievance: -0.05 },
  },
}

function signalToEventType(signalKind: RelationshipSignalKind) {
  switch (signalKind) {
    case 'support':
      return 'support'
    case 'agreement':
      return 'agreement'
    case 'constructive_disagreement':
      return 'disagreement'
    case 'dismissal':
      return 'conflict'
    case 'conflict':
      return 'conflict'
    case 'repair':
    case 'mediation':
      return 'reconciliation'
    case 'follow_through':
      return 'help'
    case 'betrayal':
      return 'betrayal'
    case 'guidance':
      return 'guidance'
    case 'competition':
      return 'competition'
    case 'coalition':
      return 'alliance_shift'
    default:
      return 'bonding'
  }
}

function applyDelta(current: number, delta = 0): number {
  if (delta === 0) return current
  const scaled = delta > 0
    ? delta * (1 - current * 0.55)
    : delta * (0.78 + current * 0.22)
  return roundMetric(current + scaled)
}

function applyDirectionalVector(current: Record<string, number>, vector: DirectionalVector, weight: number) {
  for (const [key, rawValue] of Object.entries(vector)) {
    const delta = (rawValue || 0) * weight
    current[key] = applyDelta(current[key], delta)
  }
}

async function getPair(agentId1: string, agentId2: string): Promise<AgentRelationship | null> {
  const [left, right] = sortedPair(agentId1, agentId2)
  return RelationshipRepository.getPair(left, right)
}

async function getPairById(pairId: string): Promise<AgentRelationship | null> {
  return RelationshipRepository.getById(pairId)
}

async function listPairsForAgent(agentId: string): Promise<AgentRelationship[]> {
  const relationships = await RelationshipRepository.listForAgent(agentId)
  return relationships.map((relationship) => normalizeRelationship(relationship))
}

async function persistPair(relationship: AgentRelationship): Promise<AgentRelationship> {
  return RelationshipRepository.upsert(normalizeRelationship(relationship))
}

async function persistEvidence(record: RelationshipEvidence): Promise<RelationshipEvidence> {
  return RelationshipEvidenceRepository.upsert(record)
}

async function persistRevision(record: RelationshipRevision): Promise<RelationshipRevision> {
  return RelationshipRevisionRepository.upsert(record)
}

async function persistSynthesisRun(record: RelationshipSynthesisRun): Promise<RelationshipSynthesisRun> {
  return RelationshipSynthesisRunRepository.upsert(record)
}

async function listEvidenceByPair(pairId: string, limitCount = 24): Promise<RelationshipEvidence[]> {
  const evidence = await RelationshipEvidenceRepository.listByPair(pairId, limitCount)
  return evidence.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

async function listEvidenceBySource(sourceKind: string, sourceId: string, limitCount = 100): Promise<RelationshipEvidence[]> {
  const evidence = await RelationshipEvidenceRepository.listBySource(sourceKind, sourceId, limitCount)
  return evidence.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

async function listRevisionsByPair(pairId: string, limitCount = 12): Promise<RelationshipRevision[]> {
  const revisions = await RelationshipRevisionRepository.listByPair(pairId, limitCount)
  return revisions.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

async function listRecentRevisionsByAgent(agentId: string, limitCount = 12): Promise<RelationshipRevision[]> {
  const revisions = await RelationshipRevisionRepository.listRecentByAgent(agentId, limitCount)
  return revisions.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

async function listSynthesisRunsByPair(pairId: string, limitCount = 8): Promise<RelationshipSynthesisRun[]> {
  const runs = await RelationshipSynthesisRunRepository.listByPair(pairId, limitCount)
  return runs.sort((left, right) => new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime())
}

function sortRoster(relationships: AgentRelationship[], agentId: string): RelationshipRosterItem[] {
  return relationships
    .map((relationship) => {
      const otherAgentId = relationship.agentId1 === agentId ? relationship.agentId2 : relationship.agentId1
      return {
        pairId: relationship.id,
        otherAgentId,
        otherAgentName: otherAgentId,
        status: relationship.status,
        relationshipTypes: relationship.relationshipTypes,
        metrics: relationship.metrics,
        derived: relationship.derived,
        alertFlags: relationship.alertFlags,
        latestRevisionSummary: relationship.latestRevisionSummary,
        lastInteraction: relationship.lastInteraction,
      }
    })
    .sort((left, right) => {
      if (right.derived.bondStrength !== left.derived.bondStrength) {
        return right.derived.bondStrength - left.derived.bondStrength
      }
      return new Date(right.lastInteraction).getTime() - new Date(left.lastInteraction).getTime()
    })
}

function computeNetworkSummary(relationships: AgentRelationship[]): RelationshipNetworkSummary {
  if (relationships.length === 0) {
    return {
      totalRelationships: 0,
      strongBonds: 0,
      tenseRelationships: 0,
      averageTrust: 0,
      recentShifts: 0,
      networkRole: 'isolated',
    }
  }

  const totalRelationships = relationships.length
  const strongBonds = relationships.filter((relationship) => relationship.derived.bondStrength >= 0.62 && relationship.derived.tension < 0.42).length
  const tenseRelationships = relationships.filter((relationship) => relationship.derived.tension >= 0.56 || relationship.alertFlags.includes('high_tension')).length
  const averageTrust = average(relationships.map((relationship) => relationship.metrics.trust))
  const recentShifts = relationships.filter((relationship) => {
    if (!relationship.lastRevisionAt) return false
    const age = Date.now() - new Date(relationship.lastRevisionAt).getTime()
    return age <= 1000 * 60 * 60 * 24 * 7
  }).length

  let networkRole: RelationshipNetworkSummary['networkRole'] = 'balanced'
  if (totalRelationships <= 1) {
    networkRole = 'isolated'
  } else if (tenseRelationships >= 2) {
    networkRole = 'volatile'
  } else if (strongBonds >= 2 && averageTrust >= 0.55) {
    networkRole = 'ally_builder'
  } else if (totalRelationships >= 4) {
    networkRole = 'connector'
  }

  return {
    totalRelationships,
    strongBonds,
    tenseRelationships,
    averageTrust,
    recentShifts,
    networkRole,
  }
}

function buildGraphData(relationships: AgentRelationship[], nodes: Array<{ id: string; name: string }>) {
  const graph = createEmptyGraphData()
  graph.nodes = nodes
  graph.edges = relationships.map((relationship) => ({
    source: relationship.agentId1,
    target: relationship.agentId2,
    strength: relationship.derived.bondStrength,
    tension: relationship.derived.tension,
    types: relationship.relationshipTypes,
  }))
  return graph
}

function mapSideDelta(before: Record<string, number>, after: Record<string, number>): RelationshipDirectionalDelta {
  return {
    trust: roundSigned((after.trust || 0) - (before.trust || 0)),
    respect: roundSigned((after.respect || 0) - (before.respect || 0)),
    affection: roundSigned((after.affection || 0) - (before.affection || 0)),
    alignment: roundSigned((after.alignment || 0) - (before.alignment || 0)),
    reliance: roundSigned((after.reliance || 0) - (before.reliance || 0)),
    grievance: roundSigned((after.grievance || 0) - (before.grievance || 0)),
  }
}

function buildSynthesisSummary(sourceKind: RelationshipSourceKind, before: AgentRelationship, after: AgentRelationship, evidence: RelationshipEvidence[]): string {
  const positive = evidence.filter((entry) => entry.valence > 0.1).sort((left, right) => right.weight - left.weight)[0]
  const negative = evidence.filter((entry) => entry.valence < -0.1).sort((left, right) => right.weight - left.weight)[0]
  const bondShift = after.derived.bondStrength - before.derived.bondStrength
  const tensionShift = after.derived.tension - before.derived.tension

  if (bondShift > 0.03 && positive) {
    return `${sourceKind} strengthened the tie through ${positive.signalKind.replace(/_/g, ' ')}.`
  }

  if (tensionShift > 0.03 && negative) {
    return `${sourceKind} increased strain after ${negative.signalKind.replace(/_/g, ' ')}.`
  }

  return `${sourceKind} updated the relationship without a decisive social swing.`
}

function synthesizeRelationship(params: {
  relationship: AgentRelationship
  evidence: RelationshipEvidence[]
  sourceKind: RelationshipSourceKind
}): SynthesisOutcome {
  const current = normalizeRelationship(params.relationship)
  const nextDirectional = {
    [current.agentId1]: { ...current.directional[current.agentId1] },
    [current.agentId2]: { ...current.directional[current.agentId2] },
  }
  const shared = { ...current.metrics }
  let nextSourceStats = { ...current.sourceStats }

  for (const entry of params.evidence) {
    const config = SIGNAL_EFFECTS[entry.signalKind]
    const scaledWeight = entry.weight * entry.confidence * SOURCE_WEIGHTS[entry.sourceKind]

    if (config.shared) {
      shared.trust = applyDelta(shared.trust, (config.shared.trust || 0) * scaledWeight)
      shared.respect = applyDelta(shared.respect, (config.shared.respect || 0) * scaledWeight)
      shared.affection = applyDelta(shared.affection, (config.shared.affection || 0) * scaledWeight)
      shared.familiarity = applyDelta(shared.familiarity, (config.shared.familiarity || 0) * scaledWeight)
    }

    if (config.symmetric) {
      applyDirectionalVector(nextDirectional[current.agentId1] as Record<string, number>, config.symmetric, scaledWeight)
      applyDirectionalVector(nextDirectional[current.agentId2] as Record<string, number>, config.symmetric, scaledWeight)
    }

    if (entry.actorAgentId && entry.targetAgentId) {
      if (config.actor && nextDirectional[entry.actorAgentId]) {
        applyDirectionalVector(nextDirectional[entry.actorAgentId] as Record<string, number>, config.actor, scaledWeight)
      }
      if (config.target && nextDirectional[entry.targetAgentId]) {
        applyDirectionalVector(nextDirectional[entry.targetAgentId] as Record<string, number>, config.target, scaledWeight)
      }
    }

    nextSourceStats = incrementSourceStats(nextSourceStats, entry.sourceKind, entry.createdAt)
  }

  const next = normalizeRelationship({
    ...current,
    metrics: {
      trust: average([shared.trust, nextDirectional[current.agentId1].trust, nextDirectional[current.agentId2].trust]),
      respect: average([shared.respect, nextDirectional[current.agentId1].respect, nextDirectional[current.agentId2].respect]),
      affection: average([shared.affection, nextDirectional[current.agentId1].affection, nextDirectional[current.agentId2].affection]),
      familiarity: shared.familiarity,
    },
    directional: {
      [current.agentId1]: nextDirectional[current.agentId1],
      [current.agentId2]: nextDirectional[current.agentId2],
    },
    interactionCount: current.interactionCount + Math.max(1, params.evidence.length),
    lastInteraction: params.evidence[0]?.createdAt || new Date().toISOString(),
    sourceStats: nextSourceStats,
    significantEvents: [
      ...current.significantEvents,
      ...params.evidence
        .filter((entry) => entry.weight >= 0.45 || Math.abs(entry.valence) >= 0.45)
        .slice(0, 4)
        .map((entry) => ({
          id: `rel_evt_${entry.id}`,
          type: signalToEventType(entry.signalKind),
          description: entry.summary,
          impactOnMetrics: {
            trust: roundSigned((SIGNAL_EFFECTS[entry.signalKind].shared?.trust || 0) * entry.weight * entry.confidence),
            respect: roundSigned((SIGNAL_EFFECTS[entry.signalKind].shared?.respect || 0) * entry.weight * entry.confidence),
            affection: roundSigned((SIGNAL_EFFECTS[entry.signalKind].shared?.affection || 0) * entry.weight * entry.confidence),
            familiarity: roundSigned((SIGNAL_EFFECTS[entry.signalKind].shared?.familiarity || 0) * entry.weight * entry.confidence),
          },
          timestamp: entry.createdAt,
          context: entry.summary,
        })),
    ].slice(-12),
    updatedAt: new Date().toISOString(),
  })

  const delta = {
    shared: {
      trust: roundSigned(next.metrics.trust - current.metrics.trust),
      respect: roundSigned(next.metrics.respect - current.metrics.respect),
      affection: roundSigned(next.metrics.affection - current.metrics.affection),
      familiarity: roundSigned(next.metrics.familiarity - current.metrics.familiarity),
    },
    left: mapSideDelta(current.directional[current.agentId1] as Record<string, number>, next.directional[next.agentId1] as Record<string, number>),
    right: mapSideDelta(current.directional[current.agentId2] as Record<string, number>, next.directional[next.agentId2] as Record<string, number>),
  }

  const totalMagnitude = average([
    Math.abs(delta.shared.trust || 0),
    Math.abs(delta.shared.respect || 0),
    Math.abs(delta.shared.affection || 0),
    Math.abs(delta.left.alignment || 0),
    Math.abs(delta.right.alignment || 0),
    Math.abs(delta.left.grievance || 0),
    Math.abs(delta.right.grievance || 0),
  ])
  const confidence = roundMetric(
    average(params.evidence.map((entry) => entry.confidence)) *
    Math.min(1, 0.75 + params.evidence.length * 0.08)
  )

  const reasons: string[] = []
  if (params.evidence.length === 0) {
    reasons.push('no evidence')
  }
  if (confidence < 0.42) {
    reasons.push('confidence below apply threshold')
  }
  if (totalMagnitude < 0.012) {
    reasons.push('change below significance threshold')
  }

  const applied = reasons.length === 0
  const summary = buildSynthesisSummary(params.sourceKind, current, next, params.evidence)

  return {
    relationship: next,
    delta,
    summary,
    confidence,
    supportingEvidenceIds: params.evidence.map((entry) => entry.id),
    changedTypes: next.relationshipTypes.filter((type) => !current.relationshipTypes.includes(type)),
    changedAlerts: next.alertFlags.filter((flag) => !current.alertFlags.includes(flag)),
    applied,
    reasons,
    rawOutput: {
      evidenceCount: params.evidence.length,
      totalMagnitude,
      delta,
      summary,
    },
  }
}

export class RelationshipOrchestrator {
  async buildWorkspaceBootstrap(agentId: string, pairId?: string): Promise<RelationshipWorkspaceBootstrap> {
    const [agent, pairs, recentRevisions] = await Promise.all([
      AgentService.getAgentById(agentId),
      listPairsForAgent(agentId),
      listRecentRevisionsByAgent(agentId, 8),
    ])

    if (!agent) {
      throw new Error('Agent not found')
    }

    const roster = sortRoster(pairs, agentId)
    const otherAgentIds = [...new Set(roster.map((item) => item.otherAgentId))]
    const otherAgents = new Map(
      (await Promise.all(otherAgentIds.map(async (id) => {
        const record = await AgentService.getAgentById(id)
        return record ? [id, record] as const : null
      }))).filter(Boolean) as Array<readonly [string, AgentRecord]>
    )

    const resolvedRoster = roster.map((item) => ({
      ...item,
      otherAgentName: otherAgents.get(item.otherAgentId)?.name || item.otherAgentId,
    }))
    const selectedPairId = pairId || resolvedRoster[0]?.pairId
    const selectedRelationship = selectedPairId
      ? pairs.find((relationship) => relationship.id === selectedPairId)
      : null

    const selectedPair = selectedRelationship
      ? await this.getPairDetail(agentId, selectedRelationship.id, otherAgents)
      : undefined

    const graphNodes = [
      { id: agent.id, name: agent.name },
      ...resolvedRoster.map((item) => ({
        id: item.otherAgentId,
        name: item.otherAgentName,
      })),
    ].filter((value, index, array) => array.findIndex((entry) => entry.id === value.id) === index)

    return {
      agent: {
        id: agent.id,
        name: agent.name,
      },
      networkSummary: computeNetworkSummary(pairs),
      networkAlerts: [...new Set(pairs.flatMap((relationship) => relationship.alertFlags))],
      roster: resolvedRoster,
      selectedPairId,
      selectedPair,
      graphData: buildGraphData(pairs, graphNodes),
      recentRevisions,
    }
  }

  async getPairDetail(
    agentId: string,
    pairId: string,
    cachedAgents?: Map<string, AgentRecord>
  ): Promise<RelationshipWorkspaceDetail | null> {
    const pair = await getPairById(pairId)
    const relationship = pair ? normalizeRelationship(pair) : null

    if (!relationship || (relationship.agentId1 !== agentId && relationship.agentId2 !== agentId)) {
      return null
    }

    const otherAgentId = relationship.agentId1 === agentId ? relationship.agentId2 : relationship.agentId1
    const otherAgent = cachedAgents?.get(otherAgentId) || await AgentService.getAgentById(otherAgentId)
    const [recentEvidence, recentRevisions, synthesisRuns] = await Promise.all([
      listEvidenceByPair(pairId, 24),
      listRevisionsByPair(pairId, 10),
      listSynthesisRunsByPair(pairId, 6),
    ])

    return {
      relationship,
      otherAgent: {
        id: otherAgentId,
        name: otherAgent?.name || otherAgentId,
        persona: otherAgent?.persona,
      },
      recentEvidence,
      recentRevisions,
      synthesisRuns,
      relatedConflicts: [...new Set(recentEvidence.filter((entry) => entry.sourceKind === 'conflict').map((entry) => entry.sourceId))],
    }
  }

  async addManualCheckpoint(params: {
    agentId1: string
    agentId2: string
    summary: string
    signalKind?: RelationshipSignalKind
    valence?: number
    confidence?: number
    weight?: number
    metadata?: Record<string, unknown>
  }) {
    return this.applySourceEvidence({
      sourceKind: 'manual',
      sourceId: generateId('relationship_manual'),
      evidence: [{
        agentId1: params.agentId1,
        agentId2: params.agentId2,
        signalKind: params.signalKind || 'support',
        valence: params.valence ?? 0.15,
        confidence: params.confidence ?? 0.74,
        weight: params.weight ?? 0.68,
        summary: params.summary,
        metadata: params.metadata,
      }],
    })
  }

  async recomputePair(pairId: string) {
    const relationship = await getPairById(pairId)

    if (!relationship) {
      throw new Error('Relationship pair not found')
    }

    const evidence = await listEvidenceByPair(pairId, 12)
    return this.applyExistingEvidence({
      sourceKind: 'manual',
      sourceId: generateId('relationship_recompute'),
      pair: normalizeRelationship(relationship),
      evidence,
    })
  }

  async rebuildFromSource(sourceKind: RelationshipSourceKind, sourceId: string) {
    const evidence = await listEvidenceBySource(sourceKind, sourceId, 120)
    const grouped = new Map<string, RelationshipEvidence[]>()
    for (const entry of evidence) {
      const bucket = grouped.get(entry.pairId) || []
      bucket.push(entry)
      grouped.set(entry.pairId, bucket)
    }

    const results = []
    for (const [, pairEvidence] of grouped) {
      const pair = await RelationshipRepository.getPair(pairEvidence[0].agentId1, pairEvidence[0].agentId2)
      if (!pair) {
        continue
      }
      results.push(await this.applyExistingEvidence({
        sourceKind,
        sourceId,
        pair: normalizeRelationship(pair),
        evidence: pairEvidence,
      }))
    }

    return results
  }

  async applyArenaOutcome(run: ArenaRun, events: ArenaEvent[]) {
    const drafts: RelationshipEvidenceDraft[] = []
    const turns = events.filter((event) => event.kind === 'debater_turn')
    for (const event of turns) {
      const payload = event.payload && typeof event.payload === 'object'
        ? event.payload as Record<string, unknown>
        : {}
      const targets = Array.isArray(payload.targetAgentIds) ? payload.targetAgentIds.map(String) : []
      const signalKind = event.summary.toLowerCase().includes('attack')
        ? 'conflict'
        : event.summary.toLowerCase().includes('conced')
          ? 'repair'
          : 'constructive_disagreement'
      for (const targetAgentId of targets) {
        drafts.push({
          agentId1: event.speakerAgentId || '',
          agentId2: targetAgentId,
          actorAgentId: event.speakerAgentId,
          targetAgentId,
          signalKind,
          valence: signalKind === 'repair' ? 0.28 : signalKind === 'conflict' ? -0.36 : -0.08,
          confidence: 0.72,
          weight: 0.58,
          summary: `${event.speakerName || 'A debater'} engaged ${targetAgentId} in arena round ${event.round || 0}: ${event.summary}`,
          excerptRefs: [event.id],
          sourceStage: event.stage,
          createdAt: event.createdAt,
        })
      }
    }

    if (run.finalReport?.winnerAgentId) {
      for (const seat of run.seats) {
        if (seat.agentId === run.finalReport.winnerAgentId) continue
        drafts.push({
          agentId1: run.finalReport.winnerAgentId,
          agentId2: seat.agentId,
          actorAgentId: run.finalReport.winnerAgentId,
          targetAgentId: seat.agentId,
          signalKind: 'competition',
          valence: 0.04,
          confidence: 0.68,
          weight: 0.44,
          summary: `${run.finalReport.winnerAgentName} finished ahead of ${seat.agentName} in the arena verdict.`,
          excerptRefs: run.finalReport.decisiveMoments.map((moment) => moment.eventId).filter((value): value is string => Boolean(value)),
          sourceStage: 'report',
          createdAt: run.completedAt,
        })
      }
    }

    return this.applySourceEvidence({
      sourceKind: 'arena',
      sourceId: run.id,
      provider: run.provider,
      model: run.model,
      evidence: drafts.filter((draft) => draft.agentId1 && draft.agentId2),
    })
  }

  async applyChallengeRunOutcome(
    run: ChallengeRun,
    participantResults: ChallengeParticipantResult[],
    events: ChallengeEvent[]
  ) {
    if (run.participantIds.length < 2 || !run.report?.relationshipSignals?.length) {
      return []
    }

    const eventIds = new Set(events.map((event) => event.id))
    const resultScores = Object.fromEntries(participantResults.map((result) => [result.agentId, result.totalScore]))
    const drafts: RelationshipEvidenceDraft[] = run.report.relationshipSignals
      .filter((draft) => draft.excerptRefs.some((ref) => eventIds.has(ref)))
      .map((draft) => ({
        agentId1: draft.agentId1,
        agentId2: draft.agentId2,
        actorAgentId: draft.actorAgentId,
        targetAgentId: draft.targetAgentId,
        signalKind: draft.signalKind,
        valence: draft.valence,
        confidence: draft.confidence,
        weight: draft.weight,
        summary: draft.summary,
        excerptRefs: draft.excerptRefs.filter((ref) => eventIds.has(ref)),
        metadata: {
          templateId: run.templateId,
          mode: run.mode,
          qualityScore: run.qualityScore,
          participantScores: resultScores,
        },
        sourceStage: 'report',
        createdAt: run.completedAt || run.updatedAt,
      }))

    return this.applySourceEvidence({
      sourceKind: 'challenge',
      sourceId: run.id,
      provider: run.provider,
      model: run.model,
      evidence: drafts,
    })
  }

  async applyConflictOutcome(conflict: ConflictAnalysis) {
    const [left, right] = conflict.participants
    if (!left || !right) {
      return []
    }

    const signalKind: RelationshipSignalKind = conflict.status === 'resolved'
      ? 'repair'
      : conflict.status === 'stalemate'
        ? 'constructive_disagreement'
        : 'conflict'

    return this.applySourceEvidence({
      sourceKind: 'conflict',
      sourceId: conflict.id,
      evidence: [{
        agentId1: left.agentId,
        agentId2: right.agentId,
        signalKind,
        valence: conflict.status === 'resolved' ? 0.26 : -0.28,
        confidence: 0.82,
        weight: Math.max(0.48, conflict.tension),
        summary: `${conflict.topic} conflict ${conflict.status}. ${conflict.actionItems[0] || ''}`.trim(),
        metadata: {
          tension: conflict.tension,
          resolutionStyle: conflict.resolutionStyle,
          conflictStyle: conflict.conflictStyle,
        },
        sourceStage: conflict.status,
        createdAt: conflict.updatedAt,
      }],
    })
  }

  async applyMentorshipOutcome(mentorship: Mentorship, session?: MentorshipSession) {
    if (!mentorship.mentorId || !mentorship.menteeId) {
      return []
    }

    const latestSession = session || mentorship.sessions[mentorship.sessions.length - 1]
    const completionRatio = latestSession
      ? average(latestSession.objectives.map((objective) => objective.isComplete ? 1 : 0))
      : mentorship.menteeProgress

    return this.applySourceEvidence({
      sourceKind: 'mentorship',
      sourceId: latestSession?.id || mentorship.id,
      evidence: [{
        agentId1: mentorship.mentorId,
        agentId2: mentorship.menteeId,
        actorAgentId: mentorship.mentorId,
        targetAgentId: mentorship.menteeId,
        signalKind: completionRatio >= 0.5 ? 'guidance' : 'support',
        valence: 0.22,
        confidence: 0.78,
        weight: Math.max(0.42, completionRatio),
        summary: latestSession
          ? `${latestSession.topic} mentorship session completed with ${latestSession.skillsImproved.length} skills improved.`
          : `Mentorship progress updated for ${mentorship.currentFocus}.`,
        metadata: {
          focus: mentorship.currentFocus,
          mentorEffectiveness: mentorship.mentorEffectiveness,
          menteeProgress: mentorship.menteeProgress,
          skillsImproved: latestSession?.skillsImproved || [],
        },
        sourceStage: mentorship.status,
        createdAt: latestSession?.completedAt || mentorship.updatedAt,
      }],
    })
  }

  async applySourceEvidence(params: ApplyRelationshipSourceParams) {
    const grouped = new Map<string, RelationshipEvidence[]>()

    for (const draft of params.evidence) {
      const [left, right] = sortedPair(draft.agentId1, draft.agentId2)
      if (!left || !right || left === right) {
        continue
      }
      const pairId = relationshipPairId(left, right)
      const record: RelationshipEvidence = {
        id: generateId('relationship_evidence'),
        pairId,
        agentId1: left,
        agentId2: right,
        sourceKind: params.sourceKind,
        sourceId: params.sourceId,
        sourceStage: draft.sourceStage,
        actorAgentId: draft.actorAgentId,
        targetAgentId: draft.targetAgentId,
        signalKind: draft.signalKind,
        valence: draft.valence,
        weight: draft.weight,
        confidence: draft.confidence,
        summary: draft.summary,
        excerptRefs: draft.excerptRefs || [],
        metadata: draft.metadata,
        createdAt: draft.createdAt || new Date().toISOString(),
      }
      const bucket = grouped.get(pairId) || []
      bucket.push(record)
      grouped.set(pairId, bucket)
    }

    const results = []
    for (const [, pendingEvidence] of grouped) {
      const pair = await getPair(pendingEvidence[0].agentId1, pendingEvidence[0].agentId2)
      const relationship = pair || await persistPair(createRelationship(pendingEvidence[0].agentId1, pendingEvidence[0].agentId2))
      const isNew = !pair
      const evidence = await Promise.all(pendingEvidence.map((record) => persistEvidence(record)))
      const result = await this.applyExistingEvidence({
        sourceKind: params.sourceKind,
        sourceId: params.sourceId,
        pair: relationship,
        evidence,
        provider: params.provider,
        model: params.model,
      })

      if (isNew && result?.relationship) {
        await Promise.all([
          agentProgressService.recordRelationship(relationship.agentId1),
          agentProgressService.recordRelationship(relationship.agentId2),
        ])
      }

      results.push(result)
    }

    return results
  }

  private async applyExistingEvidence(params: {
    sourceKind: RelationshipSourceKind
    sourceId: string
    pair: AgentRelationship
    evidence: RelationshipEvidence[]
    provider?: string
    model?: string
  }) {
    const current = normalizeRelationship(params.pair)
    const outcome = synthesizeRelationship({
      relationship: current,
      evidence: params.evidence.sort((left, right) => new Date(left.createdAt).getTime() - new Date(right.createdAt).getTime()),
      sourceKind: params.sourceKind,
    })

    const synthesisRunId = generateId('relationship_synthesis')
    let revisionId: string | undefined

    if (outcome.applied) {
      const next = normalizeRelationship({
        ...outcome.relationship,
        lastRevisionAt: new Date().toISOString(),
        latestRevisionSummary: outcome.summary,
      })
      await persistPair(next)

      const revision: RelationshipRevision = {
        id: generateId('relationship_revision'),
        pairId: next.id,
        agentId1: next.agentId1,
        agentId2: next.agentId2,
        summary: outcome.summary,
        confidence: outcome.confidence,
        sourceKind: params.sourceKind,
        sourceId: params.sourceId,
        synthesisRunId,
        supportingEvidenceIds: outcome.supportingEvidenceIds,
        delta: outcome.delta,
        changedTypes: outcome.changedTypes,
        changedAlerts: outcome.changedAlerts,
        beforeSnapshot: current,
        afterSnapshot: next,
        createdAt: new Date().toISOString(),
      }
      const savedRevision = await persistRevision(revision)
      revisionId = savedRevision.id
      outcome.relationship = next
    }

    const synthesisRun: RelationshipSynthesisRun = {
      id: synthesisRunId,
      pairId: current.id,
      agentId1: current.agentId1,
      agentId2: current.agentId2,
      triggerSourceKind: params.sourceKind,
      triggerSourceId: params.sourceId,
      status: outcome.applied ? 'applied' : outcome.reasons.length > 0 ? 'skipped' : 'failed',
      evidenceWindow: {
        until: new Date().toISOString(),
        evidenceIds: outcome.supportingEvidenceIds,
      },
      promptVersion: RELATIONSHIP_PROMPT_VERSION,
      provider: params.provider,
      model: params.model,
      rawOutput: outcome.rawOutput,
      validatorResult: {
        passed: outcome.applied,
        reasons: outcome.reasons,
      },
      applyResult: {
        applied: outcome.applied,
        reason: outcome.applied ? undefined : outcome.reasons.join('; '),
        revisionId,
      },
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }
    await persistSynthesisRun(synthesisRun)

    return {
      pairId: current.id,
      relationship: outcome.relationship,
      synthesisRun,
      applied: outcome.applied,
      summary: outcome.summary,
      confidence: outcome.confidence,
      revisionId,
    }
  }
}

export const relationshipOrchestrator = new RelationshipOrchestrator()
