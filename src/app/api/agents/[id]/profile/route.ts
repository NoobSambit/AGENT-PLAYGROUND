/**
 * Psychological Profile API Route - Phase 2
 *
 * Handles psychological profile generation and retrieval for agents.
 * Zero API cost - calculated from existing agent data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { psychologicalProfileService } from '@/lib/services/psychologicalProfileService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

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

    await AgentService.updateAgent(agentId, {
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

    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    // Generate (or regenerate) profile
    const profile = psychologicalProfileService.generateProfile(agent)

    await AgentService.updateAgent(agentId, {
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
