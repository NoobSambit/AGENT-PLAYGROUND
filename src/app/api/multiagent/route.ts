import { NextRequest, NextResponse } from 'next/server'
import { addDoc, collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AgentChain } from '@/lib/langchain/agentChain'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { AgentService } from '@/lib/services/agentService'
import { KnowledgeService } from '@/lib/services/knowledgeService'
import { agentProgressService } from '@/lib/services/agentProgressService'
import { collectiveIntelligenceService } from '@/lib/services/collectiveIntelligenceService'
import { conflictResolutionService } from '@/lib/services/conflictResolutionService'
import { relationshipService } from '@/lib/services/relationshipService'
import { AgentRecord, AgentRelationship } from '@/types/database'
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
  const relationshipRef = doc(collection(db, 'agents', agentId1, 'relationships'), agentId2)
  const snapshot = await getDoc(relationshipRef)

  if (!snapshot.exists()) {
    return null
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as AgentRelationship
}

async function persistRelationship(relationship: AgentRelationship): Promise<void> {
  const { id, ...data } = relationship
  void id

  const leftRef = doc(collection(db, 'agents', relationship.agentId1, 'relationships'), relationship.agentId2)
  const rightRef = doc(collection(db, 'agents', relationship.agentId2, 'relationships'), relationship.agentId1)

  await Promise.all([
    setDoc(leftRef, data),
    setDoc(rightRef, data),
  ])
}

async function getRecentBroadcasts(limitCount: number = 8): Promise<KnowledgeBroadcast[]> {
  try {
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

async function saveConflict(analysis: ConflictAnalysis): Promise<ConflictAnalysis> {
  const { id, ...docData } = analysis
  void id
  const docRef = await addDoc(collection(db, CONFLICTS_COLLECTION), docData)
  return { ...analysis, id: docRef.id }
}

async function saveBroadcast(broadcast: KnowledgeBroadcast): Promise<KnowledgeBroadcast> {
  const { id, ...docData } = broadcast
  void id
  const docRef = await addDoc(collection(db, BROADCASTS_COLLECTION), docData)
  return { ...broadcast, id: docRef.id }
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

    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`
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
          id: `msg_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`,
          agentId: agent.id,
          agentName: agent.name,
          content: response.response,
          timestamp: new Date().toISOString(),
          round: currentRound,
          metadata: {
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
          },
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

        relationships.set(activePairKey, nextRelationship)
        await persistRelationship(nextRelationship)

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
        const savedConflict = await saveConflict(conflict)
        conflicts.push(savedConflict)
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

    try {
      await setDoc(doc(db, 'simulations', simulationId), {
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
        metadata,
      })
    } catch (firestoreError) {
      console.error('Failed to save simulation to Firestore:', firestoreError)
    }

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
