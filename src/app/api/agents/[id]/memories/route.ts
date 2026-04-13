import { NextRequest, NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { MemoryGraphService } from '@/lib/services/memoryGraphService'
import { MemoryService } from '@/lib/services/memoryService'
import type { MemoryListQuery } from '@/types/database'

export async function GET(
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

    const { searchParams } = new URL(request.url)
    const query: MemoryListQuery = {
      searchQuery: searchParams.get('q') || undefined,
      type: (searchParams.get('type') as MemoryListQuery['type']) || 'all',
      origin: (searchParams.get('origin') as MemoryListQuery['origin']) || 'all',
      minImportance: searchParams.get('minImportance')
        ? Number(searchParams.get('minImportance'))
        : undefined,
      sort: (searchParams.get('sort') as MemoryListQuery['sort']) || 'newest',
      limit: searchParams.get('limit') ? Number(searchParams.get('limit')) : undefined,
      before: searchParams.get('before') || undefined,
      beforeId: searchParams.get('beforeId') || undefined,
    }

    const [memories, graph] = await Promise.all([
      MemoryService.listConsoleMemories(agentId, query),
      MemoryGraphService.getConsoleSummary(agentId),
    ])

    return NextResponse.json({
      memories,
      graph,
    })
  } catch (error) {
    console.error('Agent memories error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch memories' },
      { status: 500 }
    )
  }
}
