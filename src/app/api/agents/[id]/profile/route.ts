/**
 * Psychological Profile API Route - Phase 2
 *
 * Handles psychological profile generation and retrieval for agents.
 */

import { NextRequest, NextResponse } from 'next/server'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { profileAnalysisService } from '@/lib/services/profileAnalysisService'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const payload = await profileAnalysisService.getBootstrap(agentId)
    return NextResponse.json(payload)
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
    const providerInfo = getProviderInfoForRequest(request)
    const detail = await profileAnalysisService.regenerateLatestProfile(agentId, providerInfo)
    const payload = await profileAnalysisService.getBootstrap(agentId)

    return NextResponse.json({
      success: true,
      profile: detail.run.latestProfile || payload.profile,
      run: detail.run,
      bootstrap: payload,
    })
  } catch (error) {
    console.error('Profile generation error:', error)
    return NextResponse.json(
      { error: 'Failed to generate psychological profile' },
      { status: 500 }
    )
  }
}
