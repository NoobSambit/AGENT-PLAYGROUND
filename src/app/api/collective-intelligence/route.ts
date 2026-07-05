import { NextRequest, NextResponse } from 'next/server'
import { AgentService } from '@/lib/services/agentService'
import { KnowledgeService } from '@/lib/services/knowledgeService'
import { collectiveIntelligenceService } from '@/lib/services/collectiveIntelligenceService'
import { KnowledgeBroadcast } from '@/types/enhancements'
import type { LibraryCategory, LibraryItemDetail, SharedKnowledge, KnowledgeCategory } from '@/types/database'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { BroadcastRepository } from '@/lib/repositories/broadcastRepository'
import { LibraryRepository } from '@/lib/repositories/libraryRepository'
import { LibraryService } from '@/lib/services/libraryService'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { generateId } from '@/lib/db/utils'
import { collection, getDocs, orderBy, query, limit, setDoc, doc } from 'firebase/firestore'
import { db } from '@/lib/firebase'

const BROADCASTS_COLLECTION = 'collective_broadcasts'

const LIBRARY_TO_SHARED_CATEGORY: Record<LibraryCategory, KnowledgeCategory> = {
  fact: 'fact',
  preference: 'opinion',
  behavior_pattern: 'experience',
  strength: 'wisdom',
  weakness: 'wisdom',
  strategy: 'skill',
  relationship: 'experience',
  creative_style: 'experience',
  emotional_pattern: 'experience',
  skill: 'skill',
  risk: 'wisdom',
  lesson: 'wisdom',
}

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

function validationAgentIds(detail: LibraryItemDetail, verdicts: string[]): string[] {
  return [...new Set(detail.validations
    .filter((validation) => verdicts.includes(validation.verdict))
    .map((validation) => validation.agentId)
    .filter((agentId): agentId is string => Boolean(agentId)))]
}

function libraryDetailToSharedKnowledge(detail: LibraryItemDetail, viewerAgentId?: string): SharedKnowledge {
  const item = detail.item
  const endorsements = validationAgentIds(detail, ['accept', 'endorse', 'resolve'])
  const disputes = detail.validations
    .filter((validation) => validation.verdict === 'dispute')
    .map((validation) => ({
      agentId: validation.agentId || validation.actorName || validation.actorType,
      reason: validation.rationale,
      timestamp: validation.createdAt,
    }))

  return {
    id: item.id,
    knowledgeSource: 'library_item',
    libraryItemId: item.id,
    libraryStatus: item.status,
    libraryScope: item.scope,
    libraryDetailHref: item.agentId || viewerAgentId
      ? `/agents/${encodeURIComponent(item.agentId || viewerAgentId || '')}?tab=knowledge-library&libraryItem=${encodeURIComponent(item.id)}`
      : undefined,
    topic: item.title,
    category: LIBRARY_TO_SHARED_CATEGORY[item.category],
    content: item.claim,
    contributorId: item.createdByAgentId || item.agentId || 'network',
    contributorName: item.createdByName || 'Library',
    endorsements,
    disputes,
    accessCount: item.usageCount,
    lastAccessedAt: item.lastUsedAt || item.updatedAt,
    usedByAgents: [...new Set(detail.usageEvents.map((event) => event.agentId).filter((agentId): agentId is string => Boolean(agentId)))],
    tags: item.tags,
    confidence: item.confidence,
    createdAt: item.createdAt,
    updatedAt: item.updatedAt,
  }
}

async function listValidatedNetworkLibraryKnowledge(queryText: string | undefined, limitCount: number, viewerAgentId?: string): Promise<SharedKnowledge[]> {
  try {
    const summaries = await LibraryRepository.listItems({
      includeNetwork: true,
      status: 'validated',
      scope: 'network',
      search: queryText,
      sort: queryText ? 'updated' : 'confidence',
      limit: Math.min(Math.max(limitCount, 12), 80),
    })

    const details = await Promise.all(summaries.map((summary) => LibraryRepository.getItemDetail(summary.id, 12)))
    return details
      .filter((detail): detail is LibraryItemDetail => Boolean(detail))
      .filter((detail) => (
        detail.item.status === 'validated' &&
        detail.item.scope === 'network' &&
        detail.item.payload.contextPolicy?.allowPromptUse !== false
      ))
      .map((detail) => libraryDetailToSharedKnowledge(detail, viewerAgentId))
  } catch (error) {
    console.error('Failed to load network Library knowledge for Collective Intelligence:', error)
    return []
  }
}

async function getValidatedNetworkLibraryDetail(itemId: string): Promise<LibraryItemDetail | null> {
  const detail = await LibraryRepository.getItemDetail(itemId)
  if (
    !detail ||
    detail.item.status !== 'validated' ||
    detail.item.scope !== 'network' ||
    detail.item.payload.contextPolicy?.allowPromptUse === false
  ) {
    return null
  }

  return detail
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const queryText = searchParams.get('query') || undefined
    const agentId = searchParams.get('agentId') || undefined
    const limitCount = parseInt(searchParams.get('limit') || '12')

    const [agents, legacyKnowledge, libraryKnowledge, broadcasts] = await Promise.all([
      AgentService.getAllAgents(),
      queryText ? KnowledgeService.searchKnowledge(queryText) : KnowledgeService.getAllKnowledge(),
      listValidatedNetworkLibraryKnowledge(queryText, limitCount, agentId),
      getRecentBroadcasts(limitCount),
    ])
    const allKnowledge = [...libraryKnowledge, ...legacyKnowledge]

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
      const { agentId, knowledgeId } = body
      let topic = typeof body.topic === 'string' ? body.topic : ''
      let summary = typeof body.summary === 'string' ? body.summary : ''
      const knowledgeSource = typeof body.knowledgeSource === 'string' ? body.knowledgeSource : undefined

      if (!agentId) {
        return NextResponse.json(
          { error: 'agentId is required' },
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

      if (knowledgeId && (knowledgeSource === 'library_item' || String(knowledgeId).startsWith('library_item_'))) {
        const detail = await getValidatedNetworkLibraryDetail(String(knowledgeId))
        if (!detail) {
          return NextResponse.json(
            { error: 'Only validated network Library items can be broadcast through Collective Intelligence' },
            { status: 409 }
          )
        }
        topic = topic || detail.item.title
        summary = summary || detail.item.claim
      }

      if (!topic || !summary) {
        return NextResponse.json(
          { error: 'topic and summary are required' },
          { status: 400 }
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
      const knowledgeSource = typeof body.knowledgeSource === 'string' ? body.knowledgeSource : undefined

      if (!knowledgeId || !agentId || !verdict) {
        return NextResponse.json(
          { error: 'knowledgeId, agentId, and verdict are required' },
          { status: 400 }
        )
      }

      if (verdict !== 'support' && verdict !== 'dispute') {
        return NextResponse.json(
          { error: 'verdict must be support or dispute' },
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

      if (knowledgeSource === 'library_item' || String(knowledgeId).startsWith('library_item_')) {
        const mutation = await LibraryService.recordCollectiveValidation(agentId, knowledgeId, {
          actorAgentId: agentId,
          actorName: agent.name,
          verdict,
          rationale: rationale || (
            verdict === 'support'
              ? 'Supported during Collective Intelligence review.'
              : 'Disputed during Collective Intelligence review.'
          ),
        })

        return NextResponse.json({
          success: true,
          knowledge: libraryDetailToSharedKnowledge({
            item: mutation.item.item,
            sources: mutation.item.sources,
            validations: mutation.item.validations,
            usageEvents: mutation.item.usageEvents,
          }, agentId),
        })
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
