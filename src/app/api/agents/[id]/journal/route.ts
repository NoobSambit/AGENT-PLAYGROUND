import { NextRequest, NextResponse } from 'next/server'
import { journalService } from '@/lib/services/journalService'

interface CreateSessionRequest {
  type?: string
  userNote?: string
  focus?: string[]
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const payload = await journalService.getBootstrap(agentId)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Journal bootstrap error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load journal workspace' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json() as CreateSessionRequest
    const session = await journalService.createSession(agentId, {
      type: body.type as Parameters<typeof journalService.createSession>[1]['type'],
      userNote: body.userNote,
      focus: body.focus as Parameters<typeof journalService.createSession>[1]['focus'],
    })
    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('Create journal session error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create journal session' },
      { status: 500 }
    )
  }
}
