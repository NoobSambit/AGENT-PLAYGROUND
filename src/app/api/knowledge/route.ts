/**
 * Shared Knowledge API Route - Phase 3
 *
 * Handles the shared knowledge library where agents contribute and access
 * collective knowledge. Supports endorsements, disputes, and search.
 */

import { NextRequest, NextResponse } from 'next/server'
import { KnowledgeService } from '@/lib/services/knowledgeService'
import { KnowledgeCategory } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const category = searchParams.get('category') as KnowledgeCategory | null
    const search = searchParams.get('search')
    const agentId = searchParams.get('agentId')
    const contributorId = searchParams.get('contributorId')
    const popular = searchParams.get('popular') === 'true'
    const recent = searchParams.get('recent') === 'true'
    const stats = searchParams.get('stats') === 'true'
    const limitCount = parseInt(searchParams.get('limit') || '20')

    // Get stats
    if (stats) {
      const knowledgeStats = await KnowledgeService.getKnowledgeStats()
      return NextResponse.json({ stats: knowledgeStats })
    }

    // Get by ID
    if (id) {
      const knowledge = await KnowledgeService.getKnowledgeById(id)
      if (!knowledge) {
        return NextResponse.json(
          { error: 'Knowledge not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ knowledge })
    }

    // Get popular knowledge
    if (popular) {
      const popularKnowledge = await KnowledgeService.getPopularKnowledge(limitCount)
      return NextResponse.json({ knowledge: popularKnowledge })
    }

    // Get recent knowledge
    if (recent) {
      const recentKnowledge = await KnowledgeService.getRecentKnowledge(limitCount)
      return NextResponse.json({ knowledge: recentKnowledge })
    }

    // Get by contributor
    if (contributorId) {
      const contributions = await KnowledgeService.getAgentContributions(contributorId)
      return NextResponse.json({ knowledge: contributions })
    }

    // Search knowledge
    if (search) {
      let results = await KnowledgeService.searchKnowledge(search)

      // If agentId provided, track usage for relevant results
      if (agentId && results.length > 0) {
        results = await KnowledgeService.getRelevantKnowledge(search, agentId, limitCount)
      }

      return NextResponse.json({ knowledge: results })
    }

    // Get by category
    if (category) {
      const categoryKnowledge = await KnowledgeService.getKnowledgeByCategory(category)
      return NextResponse.json({ knowledge: categoryKnowledge })
    }

    // Get all knowledge
    const allKnowledge = await KnowledgeService.getAllKnowledge()
    return NextResponse.json({ knowledge: allKnowledge })
  } catch (error) {
    console.error('Get knowledge error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch knowledge' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    // Create new knowledge
    if (action === 'create') {
      const { topic, category, content, contributorId, contributorName, tags, confidence } = body

      if (!topic || !category || !content || !contributorId || !contributorName) {
        return NextResponse.json(
          { error: 'topic, category, content, contributorId, and contributorName are required' },
          { status: 400 }
        )
      }

      const knowledge = await KnowledgeService.createKnowledge({
        topic,
        category,
        content,
        contributorId,
        contributorName,
        tags: tags || [],
        confidence: confidence || 0.5
      })

      if (!knowledge) {
        return NextResponse.json(
          { error: 'Failed to create knowledge' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        knowledge
      })
    }

    // Update knowledge
    if (action === 'update') {
      const { id, topic, content, category, tags, confidence } = body

      if (!id) {
        return NextResponse.json(
          { error: 'id is required' },
          { status: 400 }
        )
      }

      const updates: Record<string, unknown> = {}
      if (topic !== undefined) updates.topic = topic
      if (content !== undefined) updates.content = content
      if (category !== undefined) updates.category = category
      if (tags !== undefined) updates.tags = tags
      if (confidence !== undefined) updates.confidence = confidence

      const success = await KnowledgeService.updateKnowledge(id, updates)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update knowledge' },
          { status: 500 }
        )
      }

      const updatedKnowledge = await KnowledgeService.getKnowledgeById(id)
      return NextResponse.json({
        success: true,
        knowledge: updatedKnowledge
      })
    }

    // Delete knowledge
    if (action === 'delete') {
      const { id } = body

      if (!id) {
        return NextResponse.json(
          { error: 'id is required' },
          { status: 400 }
        )
      }

      const success = await KnowledgeService.deleteKnowledge(id)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to delete knowledge' },
          { status: 500 }
        )
      }

      return NextResponse.json({ success: true })
    }

    // Endorse knowledge
    if (action === 'endorse') {
      const { knowledgeId, agentId } = body

      if (!knowledgeId || !agentId) {
        return NextResponse.json(
          { error: 'knowledgeId and agentId are required' },
          { status: 400 }
        )
      }

      const success = await KnowledgeService.endorseKnowledge(knowledgeId, agentId)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to endorse knowledge' },
          { status: 500 }
        )
      }

      const updatedKnowledge = await KnowledgeService.getKnowledgeById(knowledgeId)
      return NextResponse.json({
        success: true,
        knowledge: updatedKnowledge
      })
    }

    // Remove endorsement
    if (action === 'remove_endorsement') {
      const { knowledgeId, agentId } = body

      if (!knowledgeId || !agentId) {
        return NextResponse.json(
          { error: 'knowledgeId and agentId are required' },
          { status: 400 }
        )
      }

      const success = await KnowledgeService.removeEndorsement(knowledgeId, agentId)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to remove endorsement' },
          { status: 500 }
        )
      }

      const updatedKnowledge = await KnowledgeService.getKnowledgeById(knowledgeId)
      return NextResponse.json({
        success: true,
        knowledge: updatedKnowledge
      })
    }

    // Dispute knowledge
    if (action === 'dispute') {
      const { knowledgeId, agentId, reason } = body

      if (!knowledgeId || !agentId || !reason) {
        return NextResponse.json(
          { error: 'knowledgeId, agentId, and reason are required' },
          { status: 400 }
        )
      }

      const success = await KnowledgeService.disputeKnowledge(knowledgeId, agentId, reason)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to dispute knowledge (may already be disputed by this agent)' },
          { status: 400 }
        )
      }

      const updatedKnowledge = await KnowledgeService.getKnowledgeById(knowledgeId)
      return NextResponse.json({
        success: true,
        knowledge: updatedKnowledge
      })
    }

    // Resolve dispute
    if (action === 'resolve_dispute') {
      const { knowledgeId, agentId } = body

      if (!knowledgeId || !agentId) {
        return NextResponse.json(
          { error: 'knowledgeId and agentId are required' },
          { status: 400 }
        )
      }

      const success = await KnowledgeService.resolveDispute(knowledgeId, agentId)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to resolve dispute' },
          { status: 500 }
        )
      }

      const updatedKnowledge = await KnowledgeService.getKnowledgeById(knowledgeId)
      return NextResponse.json({
        success: true,
        knowledge: updatedKnowledge
      })
    }

    // Get relevant knowledge for a query
    if (action === 'get_relevant') {
      const { query, agentId, limit: maxResults } = body

      if (!query || !agentId) {
        return NextResponse.json(
          { error: 'query and agentId are required' },
          { status: 400 }
        )
      }

      const relevantKnowledge = await KnowledgeService.getRelevantKnowledge(
        query,
        agentId,
        maxResults || 5
      )

      // Generate prompt for LLM use
      const prompt = KnowledgeService.generateKnowledgePrompt(relevantKnowledge)

      return NextResponse.json({
        knowledge: relevantKnowledge,
        prompt
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Knowledge API error:', error)
    return NextResponse.json(
      { error: 'Failed to process knowledge request' },
      { status: 500 }
    )
  }
}
