import { NextRequest, NextResponse } from 'next/server'
import { challengeLabService } from '@/lib/services/challengeLabService'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const bootstrap = await challengeLabService.bootstrap(id)
    return NextResponse.json(bootstrap)
  } catch (error) {
    console.error('Challenge Lab bootstrap error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load Challenge Lab' },
      { status: error instanceof Error && error.message === 'Agent not found.' ? 404 : 500 }
    )
  }
}
