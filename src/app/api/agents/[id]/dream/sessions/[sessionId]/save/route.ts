import { NextRequest, NextResponse } from 'next/server'
import { dreamService } from '@/lib/services/dreamService'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: agentId, sessionId } = await params
    const detail = await dreamService.saveSessionDream(agentId, sessionId)
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Dream save error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save dream' },
      { status: 500 }
    )
  }
}
