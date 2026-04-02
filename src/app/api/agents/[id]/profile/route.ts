/**
 * Psychological Profile API Route - Phase 2
 *
 * Handles psychological profile generation and retrieval for agents.
 * Zero API cost - calculated from existing agent data.
 */

import { NextRequest, NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { PersonalityEventService } from '@/lib/services/personalityEventService'
import { psychologicalProfileService } from '@/lib/services/psychologicalProfileService'

async function getProfileFreshness(agentId: string, profileUpdatedAt?: string) {
  const latestEvent = await PersonalityEventService.getLatestByAgent(agentId)
  const lastTraitUpdateAt = latestEvent?.createdAt || null

  return {
    stale: Boolean(
      profileUpdatedAt
      && lastTraitUpdateAt
      && new Date(lastTraitUpdateAt).getTime() > new Date(profileUpdatedAt).getTime()
    ),
    lastTraitUpdateAt,
  }
}

export async function GET(
  _request: NextRequest,
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
      const freshness = await getProfileFreshness(agentId, agent.psychologicalProfile.updatedAt)
      return NextResponse.json({
        profile: agent.psychologicalProfile,
        mbtiDescription: psychologicalProfileService.getMBTIDescription(
          agent.psychologicalProfile.mbti.type
        ),
        enneagramInfo: psychologicalProfileService.getEnneagramInfo(
          agent.psychologicalProfile.enneagram.primaryType
        ),
        ...freshness,
      })
    }

    // Generate new profile if it doesn't exist
    const profile = psychologicalProfileService.generateProfile(agent)

    await AgentService.updateAgent(agentId, {
      psychologicalProfile: profile,
    })

    const freshness = await getProfileFreshness(agentId, profile.updatedAt)

    return NextResponse.json({
      profile,
      mbtiDescription: psychologicalProfileService.getMBTIDescription(profile.mbti.type),
      enneagramInfo: psychologicalProfileService.getEnneagramInfo(profile.enneagram.primaryType),
      generated: true,
      ...freshness,
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

    const freshness = await getProfileFreshness(agentId, profile.updatedAt)

    return NextResponse.json({
      success: true,
      profile,
      mbtiDescription: psychologicalProfileService.getMBTIDescription(profile.mbti.type),
      enneagramInfo: psychologicalProfileService.getEnneagramInfo(profile.enneagram.primaryType),
      ...freshness,
    })
  } catch (error) {
    console.error('Profile generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate psychological profile' },
      { status: 500 }
    )
  }
}
