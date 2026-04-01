import { NextRequest, NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { conflictResolutionService } from '@/lib/services/conflictResolutionService'
import { relationshipService } from '@/lib/services/relationshipService'
import { AgentRelationship } from '@/types/database'
import { ConflictAnalysis } from '@/types/enhancements'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { ConflictRepository } from '@/lib/repositories/conflictRepository'
import { RelationshipRepository } from '@/lib/repositories/relationshipRepository'
import { collection, doc, getDoc, getDocs, orderBy, query, setDoc, limit } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { relationshipPairId } from '@/lib/db/utils'

const CONFLICTS_COLLECTION = 'conflicts'

async function getRelationship(agentId1: string, agentId2: string): Promise<AgentRelationship | null> {
  if (readsFromPostgres(getPersistenceMode())) {
    return RelationshipRepository.getPair(agentId1, agentId2)
  }

  const relationshipDoc = doc(collection(db, 'agents', agentId1, 'relationships'), agentId2)
  const snapshot = await getDoc(relationshipDoc)

  if (!snapshot.exists()) {
    return null
  }

  return {
    id: relationshipPairId(agentId1, agentId2),
    ...snapshot.data(),
  } as AgentRelationship
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

async function listConflicts(limitCount: number): Promise<ConflictAnalysis[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return ConflictRepository.listRecent(limitCount)
  }

  const snapshot = await getDocs(
    query(collection(db, CONFLICTS_COLLECTION), orderBy('updatedAt', 'desc'), limit(limitCount))
  )

  return snapshot.docs.map((snapshotDoc) => ({
    id: snapshotDoc.id,
    ...snapshotDoc.data(),
  })) as ConflictAnalysis[]
}

async function saveConflictToFirestore(conflict: ConflictAnalysis): Promise<void> {
  const { id, ...payload } = conflict
  void id
  await setDoc(doc(db, CONFLICTS_COLLECTION, conflict.id), payload)
}

async function saveConflict(conflict: ConflictAnalysis): Promise<ConflictAnalysis> {
  const mode = getPersistenceMode()
  if (mode === 'firestore') {
    await saveConflictToFirestore(conflict)
    return conflict
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'conflict',
      entityId: conflict.id,
      operation: 'upsert',
      payload: conflict as unknown as Record<string, unknown>,
      primary: async () => {
        await saveConflictToFirestore(conflict)
        return conflict
      },
      secondary: async () => {
        await ConflictRepository.upsert(conflict)
      },
    })
  }

  return runMirroredWrite({
    entityType: 'conflict',
    entityId: conflict.id,
    operation: 'upsert',
    payload: conflict as unknown as Record<string, unknown>,
    primary: async () => ConflictRepository.upsert(conflict),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await saveConflictToFirestore(conflict)
        }
      : undefined,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const limitCount = parseInt(searchParams.get('limit') || '12')
    let conflicts = await listConflicts(limitCount)

    if (agentId) {
      conflicts = conflicts.filter((conflict) => conflict.participants.some((participant) => participant.agentId === agentId))
    }

    return NextResponse.json({ conflicts })
  } catch (error) {
    console.error('Conflict fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch conflicts' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'analyze') {
      const { agentId1, agentId2, topic, agent1Message, agent2Message, mediatorId } = body

      if (!agentId1 || !agentId2 || !topic || !agent1Message || !agent2Message) {
        return NextResponse.json(
          { error: 'agentId1, agentId2, topic, agent1Message, and agent2Message are required' },
          { status: 400 }
        )
      }

      const [agent1, agent2, mediator, relationship] = await Promise.all([
        AgentService.getAgentById(agentId1),
        AgentService.getAgentById(agentId2),
        mediatorId ? AgentService.getAgentById(mediatorId) : Promise.resolve(null),
        getRelationship(agentId1, agentId2),
      ])

      if (!agent1 || !agent2) {
        return NextResponse.json(
          { error: 'One or more agents not found' },
          { status: 404 }
        )
      }

      const analysis = conflictResolutionService.analyze({
        agent1,
        agent2,
        topic,
        agent1Message,
        agent2Message,
        mediator,
        relationship,
      })

      const conflict = await saveConflict(analysis)

      return NextResponse.json({
        success: true,
        conflict,
        guidance: conflictResolutionService.buildPromptGuidance(conflict),
      })
    }

    if (action === 'resolve') {
      const { conflictId } = body
      if (!conflictId) {
        return NextResponse.json(
          { error: 'conflictId is required' },
          { status: 400 }
        )
      }

      const conflict = readsFromPostgres(getPersistenceMode())
        ? await ConflictRepository.getById(conflictId)
        : await (async () => {
            const conflictSnap = await getDoc(doc(db, CONFLICTS_COLLECTION, conflictId))
            return conflictSnap.exists()
              ? ({ id: conflictSnap.id, ...conflictSnap.data() } as ConflictAnalysis)
              : null
          })()

      if (!conflict) {
        return NextResponse.json(
          { error: 'Conflict not found' },
          { status: 404 }
        )
      }

      const [left, right] = conflict.participants

      let relationship = await getRelationship(left.agentId, right.agentId)
      if (!relationship) {
        relationship = relationshipService.createRelationship(left.agentId, right.agentId)
      }

      const updatedRelationship = relationshipService.updateRelationship(relationship, {
        type: conflict.resolutionStyle === 'agree_to_disagree' ? 'neutral' : 'positive',
        context: `Conflict resolution on ${conflict.topic}`,
        intensity: Math.max(0.35, 1 - conflict.tension),
        eventType: conflict.resolutionStyle === 'agree_to_disagree' ? 'disagreement' : 'reconciliation',
      })

      await persistRelationship(updatedRelationship)

      const nextConflict: ConflictAnalysis = {
        ...conflict,
        status: conflict.resolutionStyle === 'agree_to_disagree' ? 'stalemate' : 'resolved',
        updatedAt: new Date().toISOString(),
      }
      await saveConflict(nextConflict)

      return NextResponse.json({
        success: true,
        relationship: updatedRelationship,
        status: nextConflict.status,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Conflict API error:', error)
    return NextResponse.json(
      { error: 'Failed to process conflict request' },
      { status: 500 }
    )
  }
}
