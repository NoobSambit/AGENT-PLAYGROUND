import { NextRequest, NextResponse } from 'next/server'
import { challengeLabService } from '@/lib/services/challengeLabService'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const detail = await challengeLabService.getRunDetail(runId)
    if (!detail) {
      return NextResponse.json({ error: 'Challenge run not found' }, { status: 404 })
    }
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Challenge Lab detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load challenge run' },
      { status: 500 }
    )
  }
}
