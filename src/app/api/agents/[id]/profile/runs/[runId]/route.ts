import { NextRequest, NextResponse } from 'next/server'
import { profileAnalysisService } from '@/lib/services/profileAnalysisService'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; runId: string }> }
) {
  try {
    const { id: agentId, runId } = await params
    const detail = await profileAnalysisService.getRunDetail(agentId, runId)
    if (!detail.run) {
      return NextResponse.json({ error: 'Profile analysis run not found' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('Get profile run detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch profile analysis run detail' },
      { status: 500 }
    )
  }
}
