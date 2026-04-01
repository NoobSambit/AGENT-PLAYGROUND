/**
 * Challenges API Route - Phase 2
 *
 * Handles collaborative challenges between agents.
 * Uses LLM calls during challenge execution (rate limited).
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  collection,
  query,
  orderBy,
  limit,
} from 'firebase/firestore'
import { challengeService } from '@/lib/services/challengeService'
import { agentProgressService } from '@/lib/services/agentProgressService'
import { Challenge, ChallengeStatus, AgentRecord } from '@/types/database'
import { generateText } from '@/lib/llm/provider'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { stripUndefinedFields } from '@/lib/firestoreUtils'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const status = searchParams.get('status') as ChallengeStatus | null
    const templateId = searchParams.get('templateId')
    const limitCount = parseInt(searchParams.get('limit') || '20')

    // If requesting templates
    if (searchParams.get('templates') === 'true') {
      const templates = challengeService.getTemplates()
      const types = challengeService.getAvailableTypes()

      return NextResponse.json({
        templates,
        types,
      })
    }

    // If requesting specific template
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

    // Get challenges
    const challengesRef = collection(db, 'challenges')
    const q = query(challengesRef, orderBy('createdAt', 'desc'), limit(limitCount))

    const snapshot = await getDocs(q)
    let challenges: Challenge[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Challenge[]

    // Filter by agent if specified
    if (agentId) {
      challenges = challenges.filter(c => c.participants.includes(agentId))
    }

    // Filter by status if specified
    if (status) {
      challenges = challenges.filter(c => c.status === status)
    }

    // Get stats
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

    // Create new challenge
    if (action === 'create') {
      if (!templateId || !participants || !initiator) {
        return NextResponse.json(
          { error: 'templateId, participants, and initiator are required' },
          { status: 400 }
        )
      }

      try {
        const challenge = challengeService.createChallenge(templateId, participants, initiator)

        // Save to Firestore
        const challengesRef = collection(db, 'challenges')
        const { id, ...challengeData } = challenge
        void id
        const docRef = await addDoc(challengesRef, challengeData)

        return NextResponse.json({
          success: true,
          challenge: { ...challenge, id: docRef.id },
        })
      } catch (err) {
        return NextResponse.json(
          { error: err instanceof Error ? err.message : 'Failed to create challenge' },
          { status: 400 }
        )
      }
    }

    // Start challenge
    if (action === 'start') {
      if (!challengeId) {
        return NextResponse.json(
          { error: 'challengeId is required' },
          { status: 400 }
        )
      }

      const challengeRef = doc(db, 'challenges', challengeId)
      const challengeSnap = await getDoc(challengeRef)

      if (!challengeSnap.exists()) {
        return NextResponse.json(
          { error: 'Challenge not found' },
          { status: 404 }
        )
      }

      const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as Challenge
      const updatedChallenge = challengeService.startChallenge(challenge)

      await updateDoc(challengeRef, {
        status: updatedChallenge.status,
        startedAt: updatedChallenge.startedAt,
      })

      return NextResponse.json({
        success: true,
        challenge: updatedChallenge,
      })
    }

    // Add message to challenge
    if (action === 'message') {
      if (!challengeId || !agentId || !message) {
        return NextResponse.json(
          { error: 'challengeId, agentId, and message are required' },
          { status: 400 }
        )
      }

      const challengeRef = doc(db, 'challenges', challengeId)
      const challengeSnap = await getDoc(challengeRef)

      if (!challengeSnap.exists()) {
        return NextResponse.json(
          { error: 'Challenge not found' },
          { status: 404 }
        )
      }

      const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as Challenge

      // Get agent name
      const agentRef = doc(db, 'agents', agentId)
      const agentSnap = await getDoc(agentRef)
      const agentName = agentSnap.exists() ? agentSnap.data().name : 'Unknown'

      // Add message
      const updatedChallenge = challengeService.addMessage(challenge, agentId, agentName, message)

      await updateDoc(challengeRef, {
        messages: updatedChallenge.messages,
      })

      return NextResponse.json({
        success: true,
        challenge: updatedChallenge,
      })
    }

    // Advance round
    if (action === 'advance') {
      if (!challengeId) {
        return NextResponse.json(
          { error: 'challengeId is required' },
          { status: 400 }
        )
      }

      const challengeRef = doc(db, 'challenges', challengeId)
      const challengeSnap = await getDoc(challengeRef)

      if (!challengeSnap.exists()) {
        return NextResponse.json(
          { error: 'Challenge not found' },
          { status: 404 }
        )
      }

      const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as Challenge
      const updatedChallenge = challengeService.advanceRound(challenge)

      const updateData = stripUndefinedFields({
        currentRound: updatedChallenge.currentRound,
        status: updatedChallenge.status,
        completedAt: updatedChallenge.completedAt,
        evaluation: updatedChallenge.evaluation,
        xpAwarded: updatedChallenge.xpAwarded,
        achievementsUnlocked: updatedChallenge.achievementsUnlocked,
      })
      await updateDoc(challengeRef, updateData)

      if ((updatedChallenge.status === 'completed' || updatedChallenge.status === 'failed') && updatedChallenge.completedAt) {
        for (const participantId of updatedChallenge.participants) {
          const xpAwarded = updatedChallenge.xpAwarded[participantId] || 0
          const participantScore = updatedChallenge.evaluation?.participantScores?.[participantId] || 0
          const challengeAchievementIds = participantScore > 0
            ? updatedChallenge.achievementsUnlocked
            : []
          await agentProgressService.applyChallengeOutcome(
            participantId,
            xpAwarded,
            challengeAchievementIds,
            updatedChallenge.status === 'completed'
          )
        }
      }

      return NextResponse.json({
        success: true,
        challenge: updatedChallenge,
      })
    }

    // Complete objective
    if (action === 'complete_objective') {
      if (!challengeId || !body.objectiveId) {
        return NextResponse.json(
          { error: 'challengeId and objectiveId are required' },
          { status: 400 }
        )
      }

      const challengeRef = doc(db, 'challenges', challengeId)
      const challengeSnap = await getDoc(challengeRef)

      if (!challengeSnap.exists()) {
        return NextResponse.json(
          { error: 'Challenge not found' },
          { status: 404 }
        )
      }

      const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as Challenge
      const updatedChallenge = challengeService.completeObjective(challenge, body.objectiveId)

      await updateDoc(challengeRef, {
        objectives: updatedChallenge.objectives,
      })

      return NextResponse.json({
        success: true,
        challenge: updatedChallenge,
      })
    }

    // Complete challenge
    if (action === 'complete') {
      if (!challengeId) {
        return NextResponse.json(
          { error: 'challengeId is required' },
          { status: 400 }
        )
      }

      const challengeRef = doc(db, 'challenges', challengeId)
      const challengeSnap = await getDoc(challengeRef)

      if (!challengeSnap.exists()) {
        return NextResponse.json(
          { error: 'Challenge not found' },
          { status: 404 }
        )
      }

      const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as Challenge
      const updatedChallenge = challengeService.completeChallenge(challenge)

      const updateData = stripUndefinedFields({
        status: updatedChallenge.status,
        completedAt: updatedChallenge.completedAt,
        evaluation: updatedChallenge.evaluation,
        xpAwarded: updatedChallenge.xpAwarded,
        achievementsUnlocked: updatedChallenge.achievementsUnlocked,
      })
      await updateDoc(challengeRef, updateData)

      return NextResponse.json({
        success: true,
        challenge: updatedChallenge,
      })
    }

    // Abandon challenge
    if (action === 'abandon') {
      if (!challengeId) {
        return NextResponse.json(
          { error: 'challengeId is required' },
          { status: 400 }
        )
      }

      const challengeRef = doc(db, 'challenges', challengeId)
      const challengeSnap = await getDoc(challengeRef)

      if (!challengeSnap.exists()) {
        return NextResponse.json(
          { error: 'Challenge not found' },
          { status: 404 }
        )
      }

      const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as Challenge
      const updatedChallenge = challengeService.abandonChallenge(challenge)

      await updateDoc(challengeRef, {
        status: updatedChallenge.status,
        completedAt: updatedChallenge.completedAt,
      })

      return NextResponse.json({
        success: true,
        challenge: updatedChallenge,
      })
    }

    // Generate response for a participant
    if (action === 'generate_response') {
      if (!challengeId || !agentId) {
        return NextResponse.json(
          { error: 'challengeId and agentId are required' },
          { status: 400 }
        )
      }

      const challengeRef = doc(db, 'challenges', challengeId)
      const challengeSnap = await getDoc(challengeRef)

      if (!challengeSnap.exists()) {
        return NextResponse.json(
          { error: 'Challenge not found' },
          { status: 404 }
        )
      }

      const challenge = { id: challengeSnap.id, ...challengeSnap.data() } as Challenge

      // Get agent
      const agentRef = doc(db, 'agents', agentId)
      const agentSnap = await getDoc(agentRef)

      if (!agentSnap.exists()) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        )
      }

      const agent = { id: agentSnap.id, ...agentSnap.data() } as AgentRecord

      // Generate prompt
      const roundPrompt = challengeService.generateRoundPrompt(
        challenge,
        agent,
        challenge.currentRound
      )

      // Call LLM
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

      // Add message to challenge
      const updatedChallenge = challengeService.addMessage(
        challenge,
        agentId,
        agent.name,
        llmResponse
      )

      await updateDoc(challengeRef, {
        messages: updatedChallenge.messages,
      })

      return NextResponse.json({
        success: true,
        message: llmResponse,
        challenge: updatedChallenge,
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
