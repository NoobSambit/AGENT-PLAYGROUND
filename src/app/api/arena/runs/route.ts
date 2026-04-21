import { NextRequest, NextResponse } from 'next/server'
import { arenaService } from '@/lib/services/arenaService'

interface CreateArenaRunRequest {
  topic?: string
  objective?: string
  participantIds?: string[]
  roundCount?: number
  responseBudget?: 'tight' | 'balanced' | 'expanded'
  referenceBrief?: string
  seatOverrides?: Array<{
    agentId: string
    seatLabel?: string
    stanceBrief?: string
    winCondition?: string
  }>
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const limitCount = Math.max(1, Math.min(24, Number(searchParams.get('limit') || '12')))
    const runs = await arenaService.listRuns(limitCount)
    return NextResponse.json({ runs })
  } catch (error) {
    console.error('Arena list error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to list arena runs' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as CreateArenaRunRequest
    const detail = await arenaService.createRun({
      topic: body.topic || '',
      objective: body.objective,
      participantIds: body.participantIds || [],
      roundCount: body.roundCount,
      responseBudget: body.responseBudget,
      referenceBrief: body.referenceBrief,
      seatOverrides: body.seatOverrides,
    })

    return NextResponse.json(detail, { status: 201 })
  } catch (error) {
    console.error('Arena create error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create arena run' },
      { status: 500 }
    )
  }
}
