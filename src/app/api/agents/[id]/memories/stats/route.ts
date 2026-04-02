import { NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { MemoryService } from '@/lib/services/memoryService'

export async function GET(
  _request: Request,
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

    const stats = await MemoryService.getConsoleMemoryStats(agentId)
    return NextResponse.json({ stats })
  } catch (error) {
    console.error('Agent memory stats error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch memory stats' },
      { status: 500 }
    )
  }
}
