/**
 * Memory Graph API Route - Phase 3
 *
 * Handles the knowledge graph visualization data for an agent's memories.
 * Uses concept extraction and memory linking to build the graph.
 */

import { NextRequest, NextResponse } from 'next/server'
import { MemoryGraphService } from '@/lib/services/memoryGraphService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)

    const includeMemories = searchParams.get('includeMemories') !== 'false'
    const maxNodes = parseInt(searchParams.get('maxNodes') || '100')
    const minLinkStrength = parseFloat(searchParams.get('minLinkStrength') || '0.2')
    const insights = searchParams.get('insights') === 'true'

    // Get concept insights if requested
    if (insights) {
      const conceptInsights = await MemoryGraphService.getConceptInsights(agentId)
      return NextResponse.json({ insights: conceptInsights })
    }

    // Get knowledge graph data for visualization
    const graphData = await MemoryGraphService.getKnowledgeGraphData(agentId, {
      includeMemories,
      maxNodes,
      minLinkStrength
    })

    // Get the raw memory graph
    const memoryGraph = await MemoryGraphService.getMemoryGraph(agentId)

    return NextResponse.json({
      graphData,
      stats: memoryGraph?.stats || {
        totalConcepts: 0,
        totalLinks: 0,
        averageLinkStrength: 0,
        mostConnectedMemory: '',
        conceptClusters: []
      }
    })
  } catch (error) {
    console.error('Memory graph error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch memory graph' },
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
    const body = await request.json()
    const { action } = body

    // Rebuild the entire memory graph
    if (action === 'rebuild') {
      const graph = await MemoryGraphService.rebuildMemoryGraph(agentId)
      return NextResponse.json({
        success: true,
        stats: graph.stats
      })
    }

    // Get linked memories for a specific memory
    if (action === 'get_linked') {
      const { memoryId } = body
      if (!memoryId) {
        return NextResponse.json(
          { error: 'memoryId is required' },
          { status: 400 }
        )
      }

      const linkedMemories = await MemoryGraphService.getLinkedMemories(agentId, memoryId)
      return NextResponse.json({
        linkedMemories
      })
    }

    // Get enhanced relevant memories using graph
    if (action === 'get_relevant') {
      const { query, maxMemories } = body
      if (!query) {
        return NextResponse.json(
          { error: 'query is required' },
          { status: 400 }
        )
      }

      const memories = await MemoryGraphService.getEnhancedRelevantMemories(
        agentId,
        query,
        maxMemories || 10
      )
      return NextResponse.json({
        memories
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Memory graph API error:', error)
    return NextResponse.json(
      { error: 'Failed to process memory graph request' },
      { status: 500 }
    )
  }
}
