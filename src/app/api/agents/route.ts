import { NextRequest, NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { CreateAgentData } from '@/types/database'

// GET /api/agents - Fetch all agents
export async function GET() {
  try {
    const agents = await AgentService.getAllAgents()
    return NextResponse.json({
      success: true,
      data: agents
    })
  } catch (error) {
    console.error('Failed to fetch agents:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch agents' },
      { status: 500 }
    )
  }
}

// POST /api/agents - Create a new agent
export async function POST(request: NextRequest) {
  try {
    const body: CreateAgentData = await request.json()

    // Validate required fields
    if (!body.name || !body.persona) {
      return NextResponse.json(
        { success: false, error: 'Name and persona are required' },
        { status: 400 }
      )
    }

    const newAgent = await AgentService.createAgent(body)

    if (!newAgent) {
      return NextResponse.json(
        { success: false, error: 'Failed to create agent' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newAgent
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create agent:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create agent' },
      { status: 500 }
    )
  }
}
