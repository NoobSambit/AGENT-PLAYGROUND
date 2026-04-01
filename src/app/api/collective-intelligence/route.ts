import { NextRequest, NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { KnowledgeService } from '@/lib/services/knowledgeService'
import { collectiveIntelligenceService } from '@/lib/services/collectiveIntelligenceService'
import { KnowledgeBroadcast } from '@/types/enhancements'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { BroadcastRepository } from '@/lib/repositories/broadcastRepository'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { generateId } from '@/lib/db/utils'
import { collection, getDocs, orderBy, query, limit, setDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const BROADCASTS_COLLECTION = 'collective_broadcasts'

function asBroadcast(value: Record<string, unknown>, id: string): KnowledgeBroadcast {
  return {
    id,
    agentId: value.agentId as string,
    agentName: value.agentName as string,
    topic: value.topic as string,
    summary: value.summary as string,
    knowledgeId: value.knowledgeId as string | undefined,
    reach: value.reach as number,
    endorsements: value.endorsements as number,
    createdAt: value.createdAt as string,
  }
}

async function getRecentBroadcasts(limitCount: number = 12): Promise<KnowledgeBroadcast[]> {
  try {
    if (readsFromPostgres(getPersistenceMode())) {
      return BroadcastRepository.listRecent(limitCount)
    }

    const snapshot = await getDocs(
      query(collection(db, BROADCASTS_COLLECTION), orderBy('createdAt', 'desc'), limit(limitCount))
    )
    return snapshot.docs.map((snapshotDoc) => asBroadcast(snapshotDoc.data(), snapshotDoc.id))
  } catch (error) {
    console.error('Failed to fetch collective broadcasts:', error)
    return []
  }
}

async function upsertBroadcastToFirestore(broadcast: KnowledgeBroadcast): Promise<void> {
  const { id, ...docData } = broadcast
  void id
  await setDoc(doc(db, BROADCASTS_COLLECTION, broadcast.id), docData)
}

async function saveBroadcast(broadcast: KnowledgeBroadcast): Promise<KnowledgeBroadcast> {
  const mode = getPersistenceMode()
  if (mode === 'firestore') {
    await upsertBroadcastToFirestore(broadcast)
    return broadcast
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'broadcast',
      entityId: broadcast.id,
      operation: 'upsert',
      payload: broadcast as unknown as Record<string, unknown>,
      primary: async () => {
        await upsertBroadcastToFirestore(broadcast)
        return broadcast
      },
      secondary: async () => {
        await BroadcastRepository.upsert(broadcast)
      },
    })
  }

  return runMirroredWrite({
    entityType: 'broadcast',
    entityId: broadcast.id,
    operation: 'upsert',
    payload: broadcast as unknown as Record<string, unknown>,
    primary: async () => BroadcastRepository.upsert(broadcast),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await upsertBroadcastToFirestore(broadcast)
        }
      : undefined,
  })
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryText = searchParams.get('query') || undefined
    const agentId = searchParams.get('agentId') || undefined
    const limitCount = parseInt(searchParams.get('limit') || '12')

    const [agents, allKnowledge, broadcasts] = await Promise.all([
      AgentService.getAllAgents(),
      queryText ? KnowledgeService.searchKnowledge(queryText) : KnowledgeService.getAllKnowledge(),
      getRecentBroadcasts(limitCount),
    ])

    const snapshot = collectiveIntelligenceService.createSnapshot({
      agents,
      knowledge: allKnowledge,
      broadcasts,
      queryText,
      currentAgentId: agentId,
    })

    return NextResponse.json(snapshot)
  } catch (error) {
    console.error('Collective intelligence error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch collective intelligence snapshot' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    if (action === 'broadcast') {
      const { agentId, topic, summary, knowledgeId } = body

      if (!agentId || !topic || !summary) {
        return NextResponse.json(
          { error: 'agentId, topic, and summary are required' },
          { status: 400 }
        )
      }

      const agent = await AgentService.getAgentById(agentId)
      if (!agent) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        )
      }

      const broadcast = await saveBroadcast({
        ...collectiveIntelligenceService.suggestBroadcast(agent, topic, summary, knowledgeId),
        id: generateId('broadcast'),
      })

      return NextResponse.json({
        success: true,
        broadcast,
      })
    }

    if (action === 'validate') {
      const { knowledgeId, agentId, verdict, rationale } = body

      if (!knowledgeId || !agentId || !verdict) {
        return NextResponse.json(
          { error: 'knowledgeId, agentId, and verdict are required' },
          { status: 400 }
        )
      }

      let success = true
      if (verdict === 'support') {
        success = await KnowledgeService.endorseKnowledge(knowledgeId, agentId)
      } else if (verdict === 'dispute') {
        success = await KnowledgeService.disputeKnowledge(
          knowledgeId,
          agentId,
          rationale || 'Flagged during collective review.'
        )
      }

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to apply validation' },
          { status: 400 }
        )
      }

      const knowledge = await KnowledgeService.getKnowledgeById(knowledgeId)
      return NextResponse.json({
        success: true,
        knowledge,
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Collective intelligence mutation error:', error)
    return NextResponse.json(
      { error: 'Failed to process collective intelligence request' },
      { status: 500 }
    )
  }
}
