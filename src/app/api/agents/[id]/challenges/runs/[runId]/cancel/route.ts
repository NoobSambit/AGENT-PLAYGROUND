import { NextRequest, NextResponse } from 'next/server'
import { challengeLabService } from '@/lib/services/challengeLabService'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const detail = await challengeLabService.requestCancel(runId)
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Challenge Lab cancel error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel challenge run' },
      { status: 500 }
    )
  }
}
