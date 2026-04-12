import { NextRequest, NextResponse } from 'next/server'
import { dreamService } from '@/lib/services/dreamService'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: agentId, sessionId } = await params
    const detail = await dreamService.getSessionDetail(agentId, sessionId)

    if (!detail.session) {
      return NextResponse.json({ error: 'Dream session not found' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('Dream session detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load dream session' },
      { status: 500 }
    )
  }
}
