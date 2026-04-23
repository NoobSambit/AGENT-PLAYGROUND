import { NextRequest, NextResponse } from 'next/server'
import { relationshipOrchestrator } from '@/lib/services/relationshipOrchestrator'
import { relationshipService } from '@/lib/services/relationshipService'
import type { RelationshipSignalKind, RelationshipSourceKind } from '@/types/database'

function legacyEventTypeToSignal(eventType: string): RelationshipSignalKind {
  if (eventType === 'guidance') return 'guidance'
  if (eventType === 'help') return 'support'
  if (eventType === 'conflict' || eventType === 'betrayal') return 'conflict'
  if (eventType === 'agreement') return 'agreement'
  if (eventType === 'reconciliation') return 'repair'
  if (eventType === 'disagreement') return 'constructive_disagreement'
  return 'support'
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const pairId = searchParams.get('pairId') || undefined

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      )
    }

    const bootstrap = await relationshipOrchestrator.buildWorkspaceBootstrap(agentId, pairId)
    return NextResponse.json({
      ...bootstrap,
      relationships: bootstrap.selectedPair ? [bootstrap.selectedPair.relationship] : [],
      stats: {
        totalRelationships: bootstrap.networkSummary.totalRelationships,
        strongBonds: bootstrap.networkSummary.strongBonds,
        averageTrust: bootstrap.networkSummary.averageTrust,
      },
    })
  } catch (error) {
    console.error('Get relationships error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to fetch relationships' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'add_manual_checkpoint') {
      const { agentId1, agentId2, summary, signalKind, valence, confidence, weight, metadata } = body
      if (!agentId1 || !agentId2 || !summary) {
        return NextResponse.json(
          { error: 'agentId1, agentId2, and summary are required' },
          { status: 400 }
        )
      }

      const result = await relationshipOrchestrator.addManualCheckpoint({
        agentId1,
        agentId2,
        summary,
        signalKind,
        valence,
        confidence,
        weight,
        metadata,
      })

      return NextResponse.json({ success: true, result })
    }

    if (action === 'recompute_pair') {
      if (!body.pairId) {
        return NextResponse.json(
          { error: 'pairId is required' },
          { status: 400 }
        )
      }

      const result = await relationshipOrchestrator.recomputePair(body.pairId)
      return NextResponse.json({ success: true, result })
    }

    if (action === 'rebuild_from_source') {
      if (!body.sourceKind || !body.sourceId) {
        return NextResponse.json(
          { error: 'sourceKind and sourceId are required' },
          { status: 400 }
        )
      }

      const result = await relationshipOrchestrator.rebuildFromSource(
        body.sourceKind as RelationshipSourceKind,
        body.sourceId
      )
      return NextResponse.json({ success: true, result })
    }

    // Legacy compatibility path: convert the old direct update contract into a manual checkpoint.
    if (action === 'update') {
      const { agentId1, agentId2, context } = body
      if (!agentId1 || !agentId2) {
        return NextResponse.json(
          { error: 'agentId1 and agentId2 are required' },
          { status: 400 }
        )
      }

      const interaction = relationshipService.analyzeInteraction(
        context?.agent1Message || '',
        context?.agent2Message || ''
      )

      const result = await relationshipOrchestrator.addManualCheckpoint({
        agentId1,
        agentId2,
        summary: context?.summary || 'Legacy relationship update',
        signalKind: legacyEventTypeToSignal(interaction.eventType),
        valence: interaction.type === 'positive' ? 0.18 : interaction.type === 'negative' ? -0.18 : 0.04,
        confidence: 0.6,
        weight: Math.max(0.34, interaction.intensity),
        metadata: {
          legacy: true,
          eventType: interaction.eventType,
        },
      })

      return NextResponse.json({ success: true, result })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Relationship update error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update relationship' },
      { status: 500 }
    )
  }
}
