import { NextRequest, NextResponse } from 'next/server'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { arenaService } from '@/lib/services/arenaService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const providerInfo = getProviderInfoForRequest(request)
    const detail = await arenaService.executeRun(runId, providerInfo)
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Arena execute error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to execute arena run' },
      { status: 500 }
    )
  }
}
