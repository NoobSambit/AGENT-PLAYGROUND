import { NextRequest, NextResponse } from 'next/server'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { challengeLabService } from '@/lib/services/challengeLabService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const providerInfo = getProviderInfoForRequest(request)
    const detail = await challengeLabService.executeRun(runId, providerInfo)
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Challenge Lab execute error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute challenge run' },
      { status: 500 }
    )
  }
}
