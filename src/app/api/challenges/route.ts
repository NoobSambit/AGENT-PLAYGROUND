/**
 * Challenges API Route - Phase 2
 *
 * Handles collaborative challenges between agents.
 * Uses LLM calls during challenge execution (rate limited).
 */

import { NextRequest, NextResponse } from 'next/server'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { ChallengeRepository } from '@/lib/repositories/challengeRepository'
import { challengeService } from '@/lib/services/challengeService'
import { agentProgressService } from '@/lib/services/agentProgressService'
import { AgentService } from '@/lib/services/agentService'
import { relationshipOrchestrator } from '@/lib/services/relationshipOrchestrator'
import { Challenge, ChallengeStatus, AgentRecord } from '@/types/database'
import { generateText } from '@/lib/llm/provider'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { stripUndefinedFields } from '@/lib/firestoreUtils'

const CHALLENGES_COLLECTION = 'challenges'

function challengeToFirestoreDoc(challenge: Challenge): Record<string, unknown> {
  const { id, ...data } = challenge
  void id
  return stripUndefinedFields(data)
}

function firestoreDocToChallenge(docSnap: { id: string; data: () => Record<string, unknown> }): Challenge {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Challenge
}

async function listChallenges(limitCount: number): Promise<Challenge[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return ChallengeRepository.listRecent(limitCount)
  }

  const snapshot = await getDocs(
    query(collection(db, CHALLENGES_COLLECTION), orderBy('createdAt', 'desc'), limit(limitCount))
  )
  return snapshot.docs.map(firestoreDocToChallenge)
}

async function getChallengeById(id: string): Promise<Challenge | null> {
  if (readsFromPostgres(getPersistenceMode())) {
    return ChallengeRepository.getById(id)
  }

  const snapshot = await getDoc(doc(db, CHALLENGES_COLLECTION, id))
  return snapshot.exists() ? firestoreDocToChallenge(snapshot) : null
}

async function writeChallengeToFirestore(challenge: Challenge): Promise<void> {
  await setDoc(doc(db, CHALLENGES_COLLECTION, challenge.id), challengeToFirestoreDoc(challenge))
}

async function saveChallenge(challenge: Challenge): Promise<Challenge> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeChallengeToFirestore(challenge)
    return challenge
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'challenge',
      entityId: challenge.id,
      operation: 'upsert',
      payload: challengeToFirestoreDoc(challenge),
      primary: async () => {
        await writeChallengeToFirestore(challenge)
        return challenge
      },
      secondary: async () => ChallengeRepository.upsert(challenge),
    })
  }

  return runMirroredWrite({
    entityType: 'challenge',
    entityId: challenge.id,
    operation: 'upsert',
    payload: challengeToFirestoreDoc(challenge),
    primary: async () => ChallengeRepository.upsert(challenge),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeChallengeToFirestore(challenge)
        }
      : undefined,
  })
}

async function getRequiredAgent(agentId: string): Promise<AgentRecord | null> {
  return AgentService.getAgentById(agentId)
}

async function applyCompletedChallengeRewards(previous: Challenge, next: Challenge): Promise<void> {
  const wasTerminal = ['completed', 'failed', 'abandoned'].includes(previous.status)
  const isRewardStatus = next.status === 'completed' || next.status === 'failed'

  if (wasTerminal || !isRewardStatus || !next.completedAt) {
    return
  }

  for (const participantId of next.participants) {
    await agentProgressService.applyChallengeOutcome(
      participantId,
      next.status === 'completed'
    )
  }
}

async function applyRelationshipOutcome(previous: Challenge, next: Challenge): Promise<void> {
  const wasTerminal = ['completed', 'failed', 'abandoned'].includes(previous.status)
  const isTerminal = ['completed', 'failed'].includes(next.status)

  if (wasTerminal || !isTerminal) {
    return
  }

  await relationshipOrchestrator.applyChallengeOutcome(next)
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const status = searchParams.get('status') as ChallengeStatus | null
    const templateId = searchParams.get('templateId')
    const limitCount = parseInt(searchParams.get('limit') || '20')

    if (searchParams.get('templates') === 'true') {
      const templates = challengeService.getTemplates()
      const types = challengeService.getAvailableTypes()

      return NextResponse.json({
        templates,
        types,
      })
    }

    if (templateId) {
      const template = challengeService.getTemplate(templateId)
      if (!template) {
        return NextResponse.json(
          { error: 'Template not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ template })
    }

    let challenges = await listChallenges(limitCount)

    if (agentId) {
      challenges = challenges.filter((challenge) => challenge.participants.includes(agentId))
    }

    if (status) {
      challenges = challenges.filter((challenge) => challenge.status === status)
    }

    const stats = challengeService.getChallengeStats(challenges)

    return NextResponse.json({
      challenges,
      stats,
    })
  } catch (error) {
    console.error('Get challenges error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch challenges' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const providerInfo = getProviderInfoForRequest(request)
    const { action, templateId, participants, initiator, challengeId, message, agentId } = body

    if (action === 'create') {
      if (!templateId || !participants || !initiator) {
        return NextResponse.json(
          { error: 'templateId, participants, and initiator are required' },
          { status: 400 }
        )
      }

      try {
        const challenge = challengeService.createChallenge(templateId, participants, initiator)
        const savedChallenge = await saveChallenge(challenge)

        return NextResponse.json({
          success: true,
          challenge: savedChallenge,
        })
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Failed to create challenge' },
          { status: 400 }
        )
      }
    }

    if (!challengeId) {
      return NextResponse.json(
        { error: 'challengeId is required' },
        { status: 400 }
      )
    }

    const challenge = await getChallengeById(challengeId)
    if (!challenge) {
      return NextResponse.json(
        { error: 'Challenge not found' },
        { status: 404 }
      )
    }

    if (action === 'start') {
      const updatedChallenge = challengeService.startChallenge(challenge)
      const savedChallenge = await saveChallenge(updatedChallenge)

      return NextResponse.json({
        success: true,
        challenge: savedChallenge,
      })
    }

    if (action === 'message') {
      if (!agentId || !message) {
        return NextResponse.json(
          { error: 'challengeId, agentId, and message are required' },
          { status: 400 }
        )
      }

      const agent = await getRequiredAgent(agentId)
      const agentName = agent?.name || 'Unknown'
      const updatedChallenge = challengeService.addMessage(challenge, agentId, agentName, message)
      const savedChallenge = await saveChallenge(updatedChallenge)

      return NextResponse.json({
        success: true,
        challenge: savedChallenge,
      })
    }

    if (action === 'advance') {
      const updatedChallenge = challengeService.advanceRound(challenge)
      const savedChallenge = await saveChallenge(updatedChallenge)
      await applyCompletedChallengeRewards(challenge, savedChallenge)
      await applyRelationshipOutcome(challenge, savedChallenge)

      return NextResponse.json({
        success: true,
        challenge: savedChallenge,
      })
    }

    if (action === 'complete_objective') {
      if (!body.objectiveId) {
        return NextResponse.json(
          { error: 'challengeId and objectiveId are required' },
          { status: 400 }
        )
      }

      const updatedChallenge = challengeService.completeObjective(challenge, body.objectiveId)
      const savedChallenge = await saveChallenge(updatedChallenge)

      return NextResponse.json({
        success: true,
        challenge: savedChallenge,
      })
    }

    if (action === 'complete') {
      const updatedChallenge = challengeService.completeChallenge(challenge)
      const savedChallenge = await saveChallenge(updatedChallenge)
      await applyCompletedChallengeRewards(challenge, savedChallenge)
      await applyRelationshipOutcome(challenge, savedChallenge)

      return NextResponse.json({
        success: true,
        challenge: savedChallenge,
      })
    }

    if (action === 'abandon') {
      const updatedChallenge = challengeService.abandonChallenge(challenge)
      const savedChallenge = await saveChallenge(updatedChallenge)

      return NextResponse.json({
        success: true,
        challenge: savedChallenge,
      })
    }

    if (action === 'generate_response') {
      if (!agentId) {
        return NextResponse.json(
          { error: 'challengeId and agentId are required' },
          { status: 400 }
        )
      }

      const agent = await getRequiredAgent(agentId)
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        )
      }

      const roundPrompt = challengeService.generateRoundPrompt(
        challenge,
        agent,
        challenge.currentRound
      )

      if (!providerInfo) {
        return NextResponse.json(
          { error: 'LLM provider not configured' },
          { status: 500 }
        )
      }

      const systemPrompt = `You are ${agent.name}. ${agent.persona}
You are participating in a challenge. Respond authentically and engage with the challenge objectives.`

      const { content: llmResponse } = await generateText({
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: roundPrompt },
        ],
        temperature: 0.8,
        maxTokens: 1000,
        providerInfo,
      })

      const updatedChallenge = challengeService.addMessage(
        challenge,
        agentId,
        agent.name,
        llmResponse
      )
      const savedChallenge = await saveChallenge(updatedChallenge)

      return NextResponse.json({
        success: true,
        message: llmResponse,
        challenge: savedChallenge,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Challenge API error:', error)
    return NextResponse.json(
      { error: 'Failed to process challenge request' },
      { status: 500 }
    )
  }
}
