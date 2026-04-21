import { NextRequest, NextResponse } from 'next/server'
import { arenaService } from '@/lib/services/arenaService'

interface UpdateArenaRunRequest {
  topic?: string
  objective?: string
  roundCount?: number
  responseBudget?: 'tight' | 'balanced' | 'expanded'
  referenceBrief?: string
  seats?: Array<{
    agentId: string
    seatLabel?: string
    stanceBrief?: string
    winCondition?: string
  }>
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const detail = await arenaService.getRunDetail(runId)

    if (!detail) {
      return NextResponse.json({ error: 'Arena run not found' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('Arena detail error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load arena run' },
      { status: 500 }
    )
  }
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ runId: string }> }
) {
  try {
    const { runId } = await params
    const body = await request.json() as UpdateArenaRunRequest
    const detail = await arenaService.updateRun(runId, body)
    return NextResponse.json(detail)
  } catch (error) {
    console.error('Arena update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update arena run' },
      { status: 500 }
    )
  }
}
