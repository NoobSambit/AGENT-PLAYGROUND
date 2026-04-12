import { NextRequest, NextResponse } from 'next/server'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { dreamService } from '@/lib/services/dreamService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: agentId, sessionId } = await params
    const providerInfo = getProviderInfoForRequest(request)
    const detail = await dreamService.generateSession(agentId, sessionId, providerInfo)
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Dream generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate dream draft' },
      { status: 500 }
    )
  }
}
