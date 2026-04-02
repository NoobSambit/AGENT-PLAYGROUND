import { NextRequest, NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { MemoryService } from '@/lib/services/memoryService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const agent = await AgentService.getAgentById(agentId)

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const body = await request.json() as { query?: string; limit?: number }
    if (!body.query?.trim()) {
      return NextResponse.json(
        { error: 'query is required' },
        { status: 400 }
      )
    }

    const results = await MemoryService.recallMemories(agentId, body.query.trim(), body.limit || 8)
    return NextResponse.json({ results })
  } catch (error) {
    console.error('Agent memory recall error:', error)
    return NextResponse.json(
      { error: 'Failed to recall memories' },
      { status: 500 }
    )
  }
}
