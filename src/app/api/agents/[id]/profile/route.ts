/**
 * Psychological Profile API Route - Phase 2
 *
 * Handles psychological profile generation and retrieval for agents.
 * Zero API cost - calculated from existing agent data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, updateDoc } from 'firebase/firestore'
import { psychologicalProfileService } from '@/lib/services/psychologicalProfileService'
import { AgentRecord } from '@/types/database'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    // Get agent data
    const agentRef = doc(db, 'agents', agentId)
    const agentSnap = await getDoc(agentRef)

    if (!agentSnap.exists()) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const agent = { id: agentSnap.id, ...agentSnap.data() } as AgentRecord

    // Check if profile already exists
    if (agent.psychologicalProfile) {
      return NextResponse.json({
        profile: agent.psychologicalProfile,
        mbtiDescription: psychologicalProfileService.getMBTIDescription(
          agent.psychologicalProfile.mbti.type
        ),
        enneagramInfo: psychologicalProfileService.getEnneagramInfo(
          agent.psychologicalProfile.enneagram.primaryType
        ),
      })
    }

    // Generate new profile if it doesn't exist
    const profile = psychologicalProfileService.generateProfile(agent)

    // Save to Firestore
    await updateDoc(agentRef, {
      psychologicalProfile: profile,
    })

    return NextResponse.json({
      profile,
      mbtiDescription: psychologicalProfileService.getMBTIDescription(profile.mbti.type),
      enneagramInfo: psychologicalProfileService.getEnneagramInfo(profile.enneagram.primaryType),
      generated: true,
    })
  } catch (error) {
    console.error('Profile API error:', error)
    return NextResponse.json(
      { error: 'Failed to get psychological profile' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    await request.json()

    // Get agent data
    const agentRef = doc(db, 'agents', agentId)
    const agentSnap = await getDoc(agentRef)

    if (!agentSnap.exists()) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const agent = { id: agentSnap.id, ...agentSnap.data() } as AgentRecord

    // Generate (or regenerate) profile
    const profile = psychologicalProfileService.generateProfile(agent)

    // Save to Firestore
    await updateDoc(agentRef, {
      psychologicalProfile: profile,
    })

    return NextResponse.json({
      success: true,
      profile,
      mbtiDescription: psychologicalProfileService.getMBTIDescription(profile.mbti.type),
      enneagramInfo: psychologicalProfileService.getEnneagramInfo(profile.enneagram.primaryType),
    })
  } catch (error) {
    console.error('Profile generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate psychological profile' },
      { status: 500 }
    )
  }
}
