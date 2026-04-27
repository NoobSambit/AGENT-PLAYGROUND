import { NextRequest, NextResponse } from 'next/server'
import { challengeLabService } from '@/lib/services/challengeLabService'

interface CreateRunRequest {
  templateId?: string
  participantIds?: string[]
  scenario?: string
  sourceArenaRunId?: string
  sourceEventIds?: string[]
  executionBudget?: 'fast' | 'deep'
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const body = await request.json() as CreateRunRequest
    const detail = await challengeLabService.createRun(id, {
      templateId: body.templateId || '',
      participantIds: body.participantIds || [],
      scenario: body.scenario,
      sourceArenaRunId: body.sourceArenaRunId,
      sourceEventIds: body.sourceEventIds,
      executionBudget: body.executionBudget,
    })
    return NextResponse.json(detail, { status: 201 })
  } catch (error) {
    console.error('Challenge Lab create error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create challenge run' },
      { status: 400 }
    )
  }
}
