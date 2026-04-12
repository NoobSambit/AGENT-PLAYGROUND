import { NextRequest, NextResponse } from 'next/server'
import { dreamService } from '@/lib/services/dreamService'

interface CreateDreamSessionRequest {
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
    const payload = await dreamService.getBootstrap(agentId)
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Dream bootstrap error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to load dream workspace' },
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
    const body = await request.json() as CreateDreamSessionRequest
    const session = await dreamService.createSession(agentId, {
      type: body.type as Parameters<typeof dreamService.createSession>[1]['type'],
      userNote: body.userNote,
      focus: body.focus as Parameters<typeof dreamService.createSession>[1]['focus'],
    })
    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('Create dream session error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create dream session' },
      { status: 500 }
    )
  }
}
