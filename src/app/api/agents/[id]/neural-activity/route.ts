import { NextRequest, NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { MemoryService } from '@/lib/services/memoryService'
import { MessageService } from '@/lib/services/messageService'
import { MemoryGraphService } from '@/lib/services/memoryGraphService'
import { neuralActivityService } from '@/lib/services/neuralActivityService'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const [agent, memories, messages, memoryGraph] = await Promise.all([
      AgentService.getAgentById(agentId),
      MemoryService.getRecentMemories(agentId, 6),
      MessageService.getMessagesByAgentId(agentId),
      MemoryGraphService.getMemoryGraph(agentId),
    ])

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const snapshot = neuralActivityService.buildSnapshot({
      agent,
      memories,
      messages: messages.slice(-10),
      memoryGraph,
    })

    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('Neural activity error:', error)
    return NextResponse.json(
      { error: 'Failed to build neural activity snapshot' },
      { status: 500 }
    )
  }
}
