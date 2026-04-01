/**
 * Relationships API Route - Phase 2
 *
 * Handles agent-to-agent relationships.
 * Zero API cost - relationships update during simulations.
 */

import { NextRequest, NextResponse } from 'next/server'
import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { RelationshipRepository } from '@/lib/repositories/relationshipRepository'
import { relationshipPairId } from '@/lib/db/utils'
import { relationshipService } from '@/lib/services/relationshipService'
import { agentProgressService } from '@/lib/services/agentProgressService'
import { AgentService } from '@/lib/services/agentService'
import { AgentRelationship } from '@/types/database'

async function getRelationshipsFromFirestore(agentId: string): Promise<AgentRelationship[]> {
  const relationshipsRef = collection(db, 'agents', agentId, 'relationships')
  const snapshot = await getDocs(relationshipsRef)

  return snapshot.docs.map((snapshotDoc) => ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
  })) as AgentRelationship[]
}

async function getRelationshipPair(agentId1: string, agentId2: string): Promise<AgentRelationship | null> {
  if (readsFromPostgres(getPersistenceMode())) {
    return RelationshipRepository.getPair(agentId1, agentId2)
  }

  const relationshipDoc = doc(collection(db, 'agents', agentId1, 'relationships'), agentId2)
  const existingSnap = await getDoc(relationshipDoc)
  if (!existingSnap.exists()) {
    return null
  }

  return { id: relationshipPairId(agentId1, agentId2), ...existingSnap.data() } as AgentRelationship
}

async function persistRelationshipToFirestore(relationship: AgentRelationship): Promise<void> {
  const { id, ...relationshipData } = relationship
  void id
  await Promise.all([
    setDoc(doc(collection(db, 'agents', relationship.agentId1, 'relationships'), relationship.agentId2), relationshipData),
    setDoc(doc(collection(db, 'agents', relationship.agentId2, 'relationships'), relationship.agentId1), relationshipData),
  ])
}

async function persistRelationship(relationship: AgentRelationship): Promise<void> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await persistRelationshipToFirestore(relationship)
    return
  }

  if (mode === 'dual-write-firestore-read') {
    await runMirroredWrite({
      entityType: 'relationship',
      entityId: relationship.id,
      operation: 'upsert',
      payload: relationship as unknown as Record<string, unknown>,
      primary: async () => {
        await persistRelationshipToFirestore(relationship)
        return true
      },
      secondary: async () => {
        await RelationshipRepository.upsert(relationship)
      },
    })
    return
  }

  await runMirroredWrite({
    entityType: 'relationship',
    entityId: relationship.id,
    operation: 'upsert',
    payload: relationship as unknown as Record<string, unknown>,
    primary: async () => {
      await RelationshipRepository.upsert(relationship)
      return true
    },
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await persistRelationshipToFirestore(relationship)
        }
      : undefined,
  })
}

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

    const relationships = readsFromPostgres(getPersistenceMode())
      ? await RelationshipRepository.listForAgent(agentId)
      : await getRelationshipsFromFirestore(agentId)

    const stats = relationshipService.calculateNetworkStats(relationships)

    const agentIds = new Set<string>()
    for (const rel of relationships) {
      agentIds.add(rel.agentId1)
      agentIds.add(rel.agentId2)
    }

    const agents = await Promise.all(
      [...agentIds].map(async (id) => {
        const agent = await AgentService.getAgentById(id)
        return agent ? { id, name: agent.name } : null
      })
    )

    const graphData = relationshipService.generateNetworkGraphData(
      relationships,
      agents.filter(Boolean) as Array<{ id: string; name: string }>
    )

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

    let relationship = await getRelationshipPair(agentId1, agentId2)
    const isNewRelationship = !relationship

    if (!relationship) {
      relationship = relationshipService.createRelationship(agentId1, agentId2)
    }

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

    await persistRelationship(relationship)

    if (isNewRelationship) {
      await Promise.all([
        agentProgressService.recordRelationship(agentId1),
        agentProgressService.recordRelationship(agentId2)
      ])
    }

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
