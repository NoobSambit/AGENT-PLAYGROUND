import { NextRequest, NextResponse } from 'next/server'
import {
  addDoc,
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { AgentService } from '@/lib/services/agentService'
import { conflictResolutionService } from '@/lib/services/conflictResolutionService'
import { relationshipService } from '@/lib/services/relationshipService'
import { AgentRelationship } from '@/types/database'
import { ConflictAnalysis } from '@/types/enhancements'

const CONFLICTS_COLLECTION = 'conflicts'

async function getRelationship(agentId1: string, agentId2: string): Promise<AgentRelationship | null> {
  const relationshipDoc = doc(collection(db, 'agents', agentId1, 'relationships'), agentId2)
  const snapshot = await getDoc(relationshipDoc)

  if (!snapshot.exists()) {
    return null
  }

  return {
    id: snapshot.id,
    ...snapshot.data(),
  } as AgentRelationship
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const limitCount = parseInt(searchParams.get('limit') || '12')
    const snapshot = await getDocs(
      query(collection(db, CONFLICTS_COLLECTION), orderBy('updatedAt', 'desc'), limit(limitCount))
    )

    let conflicts = snapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data(),
    })) as ConflictAnalysis[]

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

      const { id, ...docData } = analysis
      void id
      const docRef = await addDoc(collection(db, CONFLICTS_COLLECTION), docData)

      return NextResponse.json({
        success: true,
        conflict: { ...analysis, id: docRef.id },
        guidance: conflictResolutionService.buildPromptGuidance(analysis),
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

      const conflictRef = doc(db, CONFLICTS_COLLECTION, conflictId)
      const conflictSnap = await getDoc(conflictRef)
      if (!conflictSnap.exists()) {
        return NextResponse.json(
          { error: 'Conflict not found' },
          { status: 404 }
        )
      }

      const conflict = { id: conflictSnap.id, ...conflictSnap.data() } as ConflictAnalysis
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

      const relationshipPayload = { ...updatedRelationship }
      const leftDoc = doc(collection(db, 'agents', left.agentId, 'relationships'), right.agentId)
      const rightDoc = doc(collection(db, 'agents', right.agentId, 'relationships'), left.agentId)
      const { id, ...relationshipData } = relationshipPayload
      void id
      await Promise.all([setDoc(leftDoc, relationshipData), setDoc(rightDoc, relationshipData)])

      await updateDoc(conflictRef, {
        status: conflict.resolutionStyle === 'agree_to_disagree' ? 'stalemate' : 'resolved',
        updatedAt: new Date().toISOString(),
      })

      return NextResponse.json({
        success: true,
        relationship: updatedRelationship,
        status: conflict.resolutionStyle === 'agree_to_disagree' ? 'stalemate' : 'resolved',
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
