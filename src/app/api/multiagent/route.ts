import { NextRequest, NextResponse } from 'next/server'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { generateId, relationshipPairId } from '@/lib/db/utils'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { BroadcastRepository } from '@/lib/repositories/broadcastRepository'
import { ConflictRepository } from '@/lib/repositories/conflictRepository'
import { RelationshipRepository } from '@/lib/repositories/relationshipRepository'
import { SimulationRepository } from '@/lib/repositories/simulationRepository'
import { AgentChain } from '@/lib/langchain/agentChain'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { AgentService } from '@/lib/services/agentService'
import { KnowledgeService } from '@/lib/services/knowledgeService'
import { agentProgressService } from '@/lib/services/agentProgressService'
import { collectiveIntelligenceService } from '@/lib/services/collectiveIntelligenceService'
import { conflictResolutionService } from '@/lib/services/conflictResolutionService'
import { relationshipService } from '@/lib/services/relationshipService'
import { AgentRecord, AgentRelationship, SimulationRecord } from '@/types/database'
import {
  ConflictAnalysis,
  ConsensusSnapshot,
  ExpertReferral,
  KnowledgeBroadcast,
} from '@/types/enhancements'

const MAX_ROUNDS = 6
const MAX_CONTEXT_MESSAGES = 12
const BROADCASTS_COLLECTION = 'collective_broadcasts'
const CONFLICTS_COLLECTION = 'conflicts'
const SIMULATIONS_COLLECTION = 'simulations'

interface MultiAgentRequest {
  agents: Array<{
    id: string
    name: string
    persona: string
    goals: string[]
  }>
  maxRounds?: number
  initialPrompt?: string
}

interface SimulationMessage {
  id: string
  agentId: string
  agentName: string
  content: string
  timestamp: string
  round: number
  metadata?: Record<string, unknown>
}

interface SimulationMetadata {
  initialPrompt: string
  referrals: ExpertReferral[]
  consensus: ConsensusSnapshot[]
  conflicts: ConflictAnalysis[]
  broadcasts: KnowledgeBroadcast[]
}

interface SimulationResponse {
  simulationId: string
  messages: SimulationMessage[]
  isComplete: boolean
  currentRound: number
  maxRounds: number
  metadata: SimulationMetadata
}

function stripUndefinedFields<T extends Record<string, unknown>>(value: T): T {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as T
}

function relationshipToFirestoreDoc(relationship: AgentRelationship): Record<string, unknown> {
  const { id, ...data } = relationship
  void id
  return stripUndefinedFields(data)
}

function conflictToFirestoreDoc(conflict: ConflictAnalysis): Record<string, unknown> {
  const { id, ...data } = conflict
  void id
  return stripUndefinedFields(data)
}

function broadcastToFirestoreDoc(broadcast: KnowledgeBroadcast): Record<string, unknown> {
  const { id, ...data } = broadcast
  void id
  return stripUndefinedFields(data)
}

function simulationToFirestoreDoc(simulation: SimulationRecord): Record<string, unknown> {
  const { id, ...data } = simulation
  void id
  return stripUndefinedFields(data)
}

function firestoreRelationshipDocToRecord(
  agentId1: string,
  agentId2: string,
  docSnap: { id: string; data: () => Record<string, unknown> }
): AgentRelationship {
  const data = docSnap.data()
  return {
    id: relationshipPairId(agentId1, agentId2),
    agentId1: (data.agentId1 as string) || agentId1,
    agentId2: (data.agentId2 as string) || agentId2,
    status: (data.status as AgentRelationship['status']) || 'neutral',
    metrics: (data.metrics as AgentRelationship['metrics']) || {
      trust: 0.5,
      respect: 0.5,
      affection: 0.5,
      familiarity: 0,
      conflict: 0,
    },
    relationshipTypes: (data.relationshipTypes as AgentRelationship['relationshipTypes']) || [],
    interactionCount: (data.interactionCount as number) || 0,
    firstMeeting: (data.firstMeeting as string) || new Date().toISOString(),
    lastInteraction: (data.lastInteraction as string) || new Date().toISOString(),
    significantEvents: (data.significantEvents as AgentRelationship['significantEvents']) || [],
    createdAt: (data.createdAt as string) || new Date().toISOString(),
    updatedAt: (data.updatedAt as string) || new Date().toISOString(),
  }
}

function clampRounds(rounds: number | undefined): number {
  if (!rounds || Number.isNaN(rounds)) {
    return MAX_ROUNDS
  }

  return Math.max(1, Math.min(rounds, MAX_ROUNDS))
}

function pairKey(agentId1: string, agentId2: string): string {
  return [agentId1, agentId2].sort().join('::')
}

function summarizeRelationship(relationship: AgentRelationship | null, otherAgentName: string): string | undefined {
  if (!relationship) {
    return undefined
  }

  return [
    `Existing relationship with ${otherAgentName}: ${relationship.status}.`,
    `Trust ${(relationship.metrics.trust * 100).toFixed(0)}%, respect ${(relationship.metrics.respect * 100).toFixed(0)}%, affection ${(relationship.metrics.affection * 100).toFixed(0)}%.`,
  ].join(' ')
}

function buildConversationHistory(
  messages: SimulationMessage[],
  currentAgentId: string
): Array<{ role: 'user' | 'assistant'; content: string }> {
  return messages
    .slice(-MAX_CONTEXT_MESSAGES)
    .map((message) => ({
      role: message.agentId === currentAgentId ? 'assistant' : 'user',
      content: `${message.agentName}: ${message.content}`,
    }))
}

function shouldAnalyzeConflict(left: string, right: string): boolean {
  const combined = `${left} ${right}`.toLowerCase()
  return [
    'disagree',
    'however',
    'wrong',
    'oppose',
    'reject',
    'cannot',
    'should not',
    'conflict',
  ].some((keyword) => combined.includes(keyword))
}

function buildConflictTopic(initialPrompt: string, left: string, right: string): string {
  const seed = initialPrompt.trim().slice(0, 72)
  if (seed) {
    return seed
  }

  const combined = `${left} ${right}`.replace(/\s+/g, ' ').trim()
  return combined.slice(0, 72) || 'Simulation disagreement'
}

function buildRoundPrompt(params: {
  initialPrompt: string
  round: number
  previousMessage?: SimulationMessage
  relationshipSummary?: string
  referrals: ExpertReferral[]
  consensus: ConsensusSnapshot[]
}): string {
  const sections: string[] = []

  if (params.round === 1) {
    sections.push(`Simulation brief: ${params.initialPrompt}`)
  } else {
    sections.push(`Continue the simulation on: ${params.initialPrompt}`)
  }

  if (params.previousMessage) {
    sections.push(
      `Respond to ${params.previousMessage.agentName}'s latest point and keep the discussion moving:\n"${params.previousMessage.content.slice(0, 320)}"`
    )
  }

  if (params.relationshipSummary) {
    sections.push(params.relationshipSummary)
  }

  if (params.referrals.length > 0) {
    sections.push(
      `Relevant specialists in the network:\n${params.referrals
        .slice(0, 2)
        .map((referral) => `- ${referral.agentName}: ${referral.reasoning}`)
        .join('\n')}`
    )
  }

  if (params.consensus.length > 0) {
    sections.push(
      `Consensus signals:\n${params.consensus
        .slice(0, 2)
        .map((item) => `- ${item.topic}: ${(item.consensusRating * 100).toFixed(0)}% confidence. ${item.recommendedPosition}`)
        .join('\n')}`
    )
  }

  sections.push('Stay in character, be specific, and keep the reply under 180 words.')

  return sections.join('\n\n')
}

function buildBroadcastSummary(
  initialPrompt: string,
  messages: SimulationMessage[],
  conflicts: ConflictAnalysis[],
  consensus?: ConsensusSnapshot
): string {
  const lastMessage = messages[messages.length - 1]
  const summaryParts = [
    `Simulation topic: ${initialPrompt}.`,
    lastMessage ? `Latest direction: ${lastMessage.content.slice(0, 180)}` : undefined,
    consensus ? `Consensus signal: ${(consensus.consensusRating * 100).toFixed(0)}% on ${consensus.topic}.` : undefined,
    conflicts.length > 0 ? `Open tension remains around ${conflicts[0].topic}.` : 'No major conflict remained unresolved.',
  ]

  return summaryParts.filter(Boolean).join(' ')
}

async function getRelationship(agentId1: string, agentId2: string): Promise<AgentRelationship | null> {
  if (readsFromPostgres(getPersistenceMode())) {
    return RelationshipRepository.getPair(agentId1, agentId2)
  }

  const relationshipRef = doc(collection(db, 'agents', agentId1, 'relationships'), agentId2)
  const snapshot = await getDoc(relationshipRef)

  if (!snapshot.exists()) {
    return null
  }

  return firestoreRelationshipDocToRecord(agentId1, agentId2, snapshot)
}

async function writeRelationshipToFirestore(relationship: AgentRelationship): Promise<void> {
  await Promise.all([
    setDoc(
      doc(collection(db, 'agents', relationship.agentId1, 'relationships'), relationship.agentId2),
      relationshipToFirestoreDoc(relationship)
    ),
    setDoc(
      doc(collection(db, 'agents', relationship.agentId2, 'relationships'), relationship.agentId1),
      relationshipToFirestoreDoc(relationship)
    ),
  ])
}

async function persistRelationship(relationship: AgentRelationship): Promise<AgentRelationship> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeRelationshipToFirestore(relationship)
    return relationship
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'relationship',
      entityId: relationship.id,
      operation: 'upsert',
      payload: relationshipToFirestoreDoc(relationship),
      primary: async () => {
        await writeRelationshipToFirestore(relationship)
        return relationship
      },
      secondary: async () => RelationshipRepository.upsert(relationship),
    })
  }

  return runMirroredWrite({
    entityType: 'relationship',
    entityId: relationship.id,
    operation: 'upsert',
    payload: relationshipToFirestoreDoc(relationship),
    primary: async () => RelationshipRepository.upsert(relationship),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeRelationshipToFirestore(relationship)
        }
      : undefined,
  })
}

async function getRecentBroadcasts(limitCount: number = 8): Promise<KnowledgeBroadcast[]> {
  try {
    if (readsFromPostgres(getPersistenceMode())) {
      return BroadcastRepository.listRecent(limitCount)
    }

    const snapshot = await getDocs(
      query(collection(db, BROADCASTS_COLLECTION), orderBy('createdAt', 'desc'), limit(limitCount))
    )

    return snapshot.docs.map((item) => ({
      id: item.id,
      ...item.data(),
    })) as KnowledgeBroadcast[]
  } catch (error) {
    console.error('Failed to fetch simulation broadcasts:', error)
    return []
  }
}

async function writeConflictToFirestore(conflict: ConflictAnalysis): Promise<void> {
  await setDoc(doc(db, CONFLICTS_COLLECTION, conflict.id), conflictToFirestoreDoc(conflict))
}

async function saveConflict(analysis: ConflictAnalysis): Promise<ConflictAnalysis> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeConflictToFirestore(analysis)
    return analysis
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'conflict',
      entityId: analysis.id,
      operation: 'upsert',
      payload: conflictToFirestoreDoc(analysis),
      primary: async () => {
        await writeConflictToFirestore(analysis)
        return analysis
      },
      secondary: async () => ConflictRepository.upsert(analysis),
    })
  }

  return runMirroredWrite({
    entityType: 'conflict',
    entityId: analysis.id,
    operation: 'upsert',
    payload: conflictToFirestoreDoc(analysis),
    primary: async () => ConflictRepository.upsert(analysis),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeConflictToFirestore(analysis)
        }
      : undefined,
  })
}

async function writeBroadcastToFirestore(broadcast: KnowledgeBroadcast): Promise<void> {
  await setDoc(doc(db, BROADCASTS_COLLECTION, broadcast.id), broadcastToFirestoreDoc(broadcast))
}

async function saveBroadcast(broadcast: KnowledgeBroadcast): Promise<KnowledgeBroadcast> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeBroadcastToFirestore(broadcast)
    return broadcast
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'broadcast',
      entityId: broadcast.id,
      operation: 'upsert',
      payload: broadcastToFirestoreDoc(broadcast),
      primary: async () => {
        await writeBroadcastToFirestore(broadcast)
        return broadcast
      },
      secondary: async () => BroadcastRepository.upsert(broadcast),
    })
  }

  return runMirroredWrite({
    entityType: 'broadcast',
    entityId: broadcast.id,
    operation: 'upsert',
    payload: broadcastToFirestoreDoc(broadcast),
    primary: async () => BroadcastRepository.upsert(broadcast),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeBroadcastToFirestore(broadcast)
        }
      : undefined,
  })
}

async function writeSimulationToFirestore(simulation: SimulationRecord): Promise<void> {
  await setDoc(doc(db, SIMULATIONS_COLLECTION, simulation.id), simulationToFirestoreDoc(simulation))
}

async function saveSimulation(record: SimulationRecord): Promise<SimulationRecord> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeSimulationToFirestore(record)
    return record
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'simulation',
      entityId: record.id,
      operation: 'upsert',
      payload: simulationToFirestoreDoc(record),
      primary: async () => {
        await writeSimulationToFirestore(record)
        return record
      },
      secondary: async () => SimulationRepository.upsert(record),
    })
  }

  return runMirroredWrite({
    entityType: 'simulation',
    entityId: record.id,
    operation: 'upsert',
    payload: simulationToFirestoreDoc(record),
    primary: async () => SimulationRepository.upsert(record),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeSimulationToFirestore(record)
        }
      : undefined,
  })
}

export async function POST(request: NextRequest) {
  try {
    const body: MultiAgentRequest = await request.json()
    const providerInfo = getProviderInfoForRequest(request)

    if (!providerInfo) {
      return NextResponse.json(
        { error: 'LLM provider not configured' },
        { status: 500 }
      )
    }

    if (!body.agents || body.agents.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 agents are required for multi-agent simulation' },
        { status: 400 }
      )
    }

    const requestedAgentIds = [...new Set(body.agents.map((agent) => agent.id).filter(Boolean))]
    if (requestedAgentIds.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 valid agent IDs are required' },
        { status: 400 }
      )
    }

    const simulationId = generateId('sim')
    const maxRounds = clampRounds(body.maxRounds)
    const initialPrompt = body.initialPrompt?.trim() || 'Collaborate on the shared task and explain your reasoning.'

    const [allAgents, existingBroadcasts] = await Promise.all([
      AgentService.getAllAgents(),
      getRecentBroadcasts(),
    ])

    const selectedAgents = requestedAgentIds
      .map((agentId) => allAgents.find((agent) => agent.id === agentId))
      .filter((agent): agent is AgentRecord => Boolean(agent))

    if (selectedAgents.length < 2) {
      return NextResponse.json(
        { error: 'One or more selected agents could not be found' },
        { status: 404 }
      )
    }

    let knowledge = await KnowledgeService.searchKnowledge(initialPrompt)
    if (knowledge.length === 0) {
      knowledge = await KnowledgeService.getAllKnowledge()
    }

    const messages: SimulationMessage[] = []
    const relationships = new Map<string, AgentRelationship>()
    const conflicts: ConflictAnalysis[] = []
    const conflictRegistry = new Set<string>()
    const generatedBroadcasts: KnowledgeBroadcast[] = [...existingBroadcasts.slice(0, 4)]
    let currentRound = 0

    while (currentRound < maxRounds) {
      currentRound++

      for (const agent of selectedAgents) {
        const previousMessage = messages[messages.length - 1]
        const activePairKey = previousMessage && previousMessage.agentId !== agent.id
          ? pairKey(agent.id, previousMessage.agentId)
          : null

        let relationship = activePairKey ? relationships.get(activePairKey) || null : null
        if (!relationship && activePairKey && previousMessage) {
          relationship = await getRelationship(agent.id, previousMessage.agentId)
          if (relationship) {
            relationships.set(activePairKey, relationship)
          }
        }

        const querySeed = previousMessage?.content || initialPrompt
        const networkSnapshot = collectiveIntelligenceService.createSnapshot({
          agents: allAgents,
          knowledge,
          broadcasts: generatedBroadcasts,
          queryText: querySeed,
          currentAgentId: agent.id,
        })

        const response = await AgentChain.getInstance(agent.id).generateResponse(
          buildRoundPrompt({
            initialPrompt,
            round: currentRound,
            previousMessage,
            relationshipSummary: previousMessage && relationship
              ? summarizeRelationship(relationship, previousMessage.agentName)
              : undefined,
            referrals: networkSnapshot.referrals,
            consensus: networkSnapshot.consensus,
          }),
          buildConversationHistory(messages, agent.id),
          {
            provider: providerInfo.provider,
            model: providerInfo.model,
          }
        )

        const message: SimulationMessage = {
          id: generateId('msg'),
          agentId: agent.id,
          agentName: agent.name,
          content: response.response,
          timestamp: new Date().toISOString(),
          round: currentRound,
          metadata: stripUndefinedFields({
            provider: providerInfo.provider,
            model: providerInfo.model,
            toolsUsed: response.toolsUsed || [],
            reasoning: response.reasoning || undefined,
            memoryUsed: response.memoryUsed || 0,
            referrals: networkSnapshot.referrals.slice(0, 2).map((referral) => ({
              agentId: referral.agentId,
              agentName: referral.agentName,
              score: referral.score,
            })),
            consensus: networkSnapshot.consensus[0]
              ? {
                  topic: networkSnapshot.consensus[0].topic,
                  confidence: networkSnapshot.consensus[0].consensusRating,
                }
              : undefined,
          }),
        }

        messages.push(message)

        if (!previousMessage || previousMessage.agentId === agent.id || !activePairKey) {
          continue
        }

        const priorRelationship = relationship
        const nextRelationship = relationshipService.updateRelationship(
          relationship || relationshipService.createRelationship(previousMessage.agentId, agent.id),
          {
            ...relationshipService.analyzeInteraction(previousMessage.content, message.content),
            context: `Simulation exchange on "${initialPrompt.slice(0, 120)}"`,
          }
        )

        relationships.set(activePairKey, await persistRelationship(nextRelationship))

        if (!priorRelationship) {
          await Promise.all([
            agentProgressService.recordRelationship(previousMessage.agentId),
            agentProgressService.recordRelationship(agent.id),
          ])
        }

        if (!shouldAnalyzeConflict(previousMessage.content, message.content)) {
          continue
        }

        const conflictTopic = buildConflictTopic(initialPrompt, previousMessage.content, message.content)
        const conflictKey = `${activePairKey}:${conflictTopic.toLowerCase()}`
        if (conflictRegistry.has(conflictKey)) {
          continue
        }

        const mediator = selectedAgents.find(
          (candidate) => candidate.id !== previousMessage.agentId && candidate.id !== agent.id
        ) || null

        const conflict = conflictResolutionService.analyze({
          agent1: selectedAgents.find((candidate) => candidate.id === previousMessage.agentId) || agent,
          agent2: agent,
          topic: conflictTopic,
          agent1Message: previousMessage.content,
          agent2Message: message.content,
          relationship: nextRelationship,
          mediator: mediator && nextRelationship.metrics.trust < 0.55 ? mediator : null,
        })

        if (conflict.tension < 0.48) {
          continue
        }

        conflictRegistry.add(conflictKey)
        conflicts.push(await saveConflict(conflict))
      }
    }

    const finalSpeaker = messages.length > 0
      ? selectedAgents.find((agent) => agent.id === messages[messages.length - 1].agentId) || selectedAgents[0]
      : selectedAgents[0]

    const preliminarySnapshot = collectiveIntelligenceService.createSnapshot({
      agents: allAgents,
      knowledge,
      broadcasts: generatedBroadcasts,
      queryText: initialPrompt,
      currentAgentId: finalSpeaker.id,
    })

    const savedBroadcast = await saveBroadcast(
      collectiveIntelligenceService.suggestBroadcast(
        finalSpeaker,
        initialPrompt.slice(0, 90),
        buildBroadcastSummary(initialPrompt, messages, conflicts, preliminarySnapshot.consensus[0])
      )
    )
    generatedBroadcasts.unshift(savedBroadcast)

    const finalSnapshot = collectiveIntelligenceService.createSnapshot({
      agents: allAgents,
      knowledge,
      broadcasts: generatedBroadcasts,
      queryText: initialPrompt,
      currentAgentId: finalSpeaker.id,
    })

    const metadata: SimulationMetadata = {
      initialPrompt,
      referrals: finalSnapshot.referrals.slice(0, 4),
      consensus: finalSnapshot.consensus.slice(0, 4),
      conflicts: conflicts.slice(0, 6),
      broadcasts: generatedBroadcasts.slice(0, 4),
    }

    const record: SimulationRecord = {
      id: simulationId,
      agents: selectedAgents.map((agent) => ({
        id: agent.id,
        name: agent.name,
        persona: agent.persona,
        goals: agent.goals,
      })),
      messages,
      maxRounds,
      createdAt: new Date().toISOString(),
      isComplete: true,
      finalRound: currentRound,
      metadata: metadata as unknown as Record<string, unknown>,
    }

    await saveSimulation(record)

    const simulationResponse: SimulationResponse = {
      simulationId,
      messages,
      isComplete: true,
      currentRound,
      maxRounds,
      metadata,
    }

    return NextResponse.json(simulationResponse)
  } catch (error) {
    console.error('Multi-agent simulation error:', error)
    return NextResponse.json(
      { error: 'Failed to run multi-agent simulation' },
      { status: 500 }
    )
  }
}
