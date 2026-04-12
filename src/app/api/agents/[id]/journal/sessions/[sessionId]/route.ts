import { NextRequest, NextResponse } from 'next/server'
import { journalService } from '@/lib/services/journalService'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: agentId, sessionId } = await params
    const detail = await journalService.getSessionDetail(agentId, sessionId)

    if (!detail.session) {
      return NextResponse.json({ error: 'Journal session not found' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('Journal session detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load journal session' },
      { status: 500 }
    )
  }
}
