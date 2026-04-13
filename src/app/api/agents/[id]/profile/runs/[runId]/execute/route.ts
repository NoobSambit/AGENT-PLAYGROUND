import { NextRequest, NextResponse } from 'next/server'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { profileAnalysisService } from '@/lib/services/profileAnalysisService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const { id: agentId, runId } = await params
    const providerInfo = getProviderInfoForRequest(request)
    const detail = await profileAnalysisService.executeRun(agentId, runId, providerInfo)
    return NextResponse.json({
      ...detail,
      interviewTurns: detail.interviewTurns.map((turn) => ({
        ...turn,
        prompt: turn.question,
        response: turn.answer,
      })),
    })
  } catch (error) {
    console.error('Execute profile run error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute profile analysis run' },
      { status: 500 }
    )
  }
}
