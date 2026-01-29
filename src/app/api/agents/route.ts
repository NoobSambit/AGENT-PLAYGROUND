import { NextRequest, NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { CreateAgentData, UpdateAgentData } from '@/types/database'

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

// PUT /api/agents - Update an agent
export async function PUT(request: NextRequest) {
  try {
    const body = await request.json() as UpdateAgentData & { id?: string }
    const { id, ...updates } = body

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    const success = await AgentService.updateAgent(id, updates)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to update agent' },
        { status: 500 }
      )
    }

    const updatedAgent = await AgentService.getAgentById(id)
    return NextResponse.json({
      success: true,
      data: updatedAgent
    })
  } catch (error) {
    console.error('Failed to update agent:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to update agent' },
      { status: 500 }
    )
  }
}

// DELETE /api/agents - Delete an agent
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    const success = await AgentService.deleteAgent(id)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete agent' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete agent:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete agent' },
      { status: 500 }
    )
  }
}
