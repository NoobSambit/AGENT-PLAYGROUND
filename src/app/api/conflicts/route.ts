import { NextRequest, NextResponse } from 'next/server'
import { collection, doc, getDoc, getDocs, limit, orderBy, query, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { ConflictRepository } from '@/lib/repositories/conflictRepository'
import { RelationshipRepository } from '@/lib/repositories/relationshipRepository'
import { conflictResolutionService } from '@/lib/services/conflictResolutionService'
import { AgentService } from '@/lib/services/agentService'
import { relationshipOrchestrator } from '@/lib/services/relationshipOrchestrator'
import { AgentRelationship } from '@/types/database'
import { ConflictAnalysis } from '@/types/enhancements'

const CONFLICTS_COLLECTION = 'conflicts'

async function getRelationship(agentId1: string, agentId2: string): Promise<AgentRelationship | null> {
  return RelationshipRepository.getPair(agentId1, agentId2)
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

      const nextConflict: ConflictAnalysis = {
        ...conflict,
        status: conflict.resolutionStyle === 'agree_to_disagree' ? 'stalemate' : 'resolved',
        updatedAt: new Date().toISOString(),
      }
      await saveConflict(nextConflict)

      const relationshipResults = await relationshipOrchestrator.applyConflictOutcome(nextConflict)

      return NextResponse.json({
        success: true,
        status: nextConflict.status,
        conflict: nextConflict,
        relationship: relationshipResults[0]?.relationship,
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
