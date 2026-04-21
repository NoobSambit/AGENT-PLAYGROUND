import { NextRequest, NextResponse } from 'next/server'
import { arenaService } from '@/lib/services/arenaService'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const detail = await arenaService.requestCancel(runId)
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Arena cancel error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to cancel arena run' },
      { status: 500 }
    )
  }
}
