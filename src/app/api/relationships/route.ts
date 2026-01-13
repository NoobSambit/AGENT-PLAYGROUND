/**
 * Relationships API Route - Phase 2
 *
 * Handles agent-to-agent relationships.
 * Zero API cost - relationships update during simulations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  doc,
  getDoc,
  getDocs,
  setDoc,
  collection,
  query,
  where,
} from 'firebase/firestore'
import { relationshipService } from '@/lib/services/relationshipService'
import { AgentRelationship, AgentRecord } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      )
    }

    // Get relationships for the agent
    const relationshipsRef = collection(db, 'agents', agentId, 'relationships')
    const snapshot = await getDocs(relationshipsRef)

    const relationships: AgentRelationship[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as AgentRelationship[]

    // Calculate network stats
    const stats = relationshipService.calculateNetworkStats(relationships)

    // Get agent names for graph data
    const agentIds = new Set<string>()
    for (const rel of relationships) {
      agentIds.add(rel.agentId1)
      agentIds.add(rel.agentId2)
    }

    const agents: Array<{ id: string; name: string }> = []
    for (const id of agentIds) {
      const agentRef = doc(db, 'agents', id)
      const agentSnap = await getDoc(agentRef)
      if (agentSnap.exists()) {
        agents.push({ id, name: agentSnap.data().name })
      }
    }

    // Generate graph data
    const graphData = relationshipService.generateNetworkGraphData(relationships, agents)

    return NextResponse.json({
      relationships,
      stats,
      graphData,
    })
  } catch (error) {
    console.error('Get relationships error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch relationships' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { agentId1, agentId2, action, interactionType, context } = body

    if (!agentId1 || !agentId2) {
      return NextResponse.json(
        { error: 'agentId1 and agentId2 are required' },
        { status: 400 }
      )
    }

    // Get or create relationship
    const relationshipsRef = collection(db, 'agents', agentId1, 'relationships')
    const relationshipDoc = doc(relationshipsRef, agentId2)
    const existingSnap = await getDoc(relationshipDoc)

    let relationship: AgentRelationship

    if (existingSnap.exists()) {
      relationship = { id: existingSnap.id, ...existingSnap.data() } as AgentRelationship
    } else {
      // Create new relationship
      relationship = relationshipService.createRelationship(agentId1, agentId2)
    }

    // If updating relationship
    if (action === 'update' && interactionType) {
      const interaction = relationshipService.analyzeInteraction(
        context?.agent1Message || '',
        context?.agent2Message || ''
      )

      relationship = relationshipService.updateRelationship(relationship, {
        ...interaction,
        context: context?.summary || 'Interaction occurred',
      })
    }

    // Save to Firestore (both directions for easy querying)
    await setDoc(relationshipDoc, {
      ...relationship,
      id: undefined,
    })

    // Also save in the other agent's relationships
    const reverseRelationshipsRef = collection(db, 'agents', agentId2, 'relationships')
    const reverseDoc = doc(reverseRelationshipsRef, agentId1)
    await setDoc(reverseDoc, {
      ...relationship,
      id: undefined,
    })

    // Get summary for response
    const summary = relationshipService.getRelationshipSummary(relationship)
    const trend = relationshipService.getRelationshipTrend(relationship)

    return NextResponse.json({
      success: true,
      relationship,
      summary,
      trend,
    })
  } catch (error) {
    console.error('Relationship update error:', error)
    return NextResponse.json(
      { error: 'Failed to update relationship' },
      { status: 500 }
    )
  }
}
