import { NextRequest, NextResponse } from 'next/server'
import { JournalSaveBlockedError, journalService } from '@/lib/services/journalService'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: agentId, sessionId } = await params
    const detail = await journalService.saveSessionEntry(agentId, sessionId)
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Journal save error:', error)
    if (error instanceof JournalSaveBlockedError) {
      return NextResponse.json(
        {
          error: error.message,
          saveBlockers: error.payload,
        },
        { status: 409 }
      )
    }
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to save journal entry' },
      { status: 500 }
    )
  }
}
