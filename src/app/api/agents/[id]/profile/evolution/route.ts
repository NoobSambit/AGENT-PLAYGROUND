import { NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { PersonalityEventService } from '@/lib/services/personalityEventService'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    const [agent, events] = await Promise.all([
      AgentService.getAgentById(agentId),
      PersonalityEventService.listByAgent(agentId, 12),
    ])

    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      coreTraits: agent.coreTraits,
      dynamicTraits: agent.dynamicTraits,
      totalInteractions: agent.totalInteractions || 0,
      lastTraitUpdateAt: events[0]?.createdAt || null,
      events,
    })
  } catch (error) {
    console.error('Profile evolution error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch personality evolution' },
      { status: 500 }
    )
  }
}
