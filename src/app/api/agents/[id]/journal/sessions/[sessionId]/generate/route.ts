import { NextRequest, NextResponse } from 'next/server'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { journalService } from '@/lib/services/journalService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: agentId, sessionId } = await params
    const providerInfo = getProviderInfoForRequest(request)
    const detail = await journalService.generateSession(agentId, sessionId, providerInfo)
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Journal generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate journal draft' },
      { status: 500 }
    )
  }
}
