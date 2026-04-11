import { NextRequest, NextResponse } from 'next/server'
import { profileAnalysisService } from '@/lib/services/profileAnalysisService'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const run = await profileAnalysisService.createRun(agentId)
    return NextResponse.json({ run }, { status: 201 })
  } catch (error) {
    console.error('Create profile run error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create profile analysis run' },
      { status: 500 }
    )
  }
}
