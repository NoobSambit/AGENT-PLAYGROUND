/**
 * Creative Content API Route - Phase 2
 *
 * Handles creative work generation for agents.
 * Rate limited to prevent API quota exhaustion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { collection, doc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { FeatureContentRepository } from '@/lib/repositories/featureContentRepository'
import { creativityService } from '@/lib/services/creativityService'
import { agentProgressService } from '@/lib/services/agentProgressService'
import { AgentService } from '@/lib/services/agentService'
import { emotionalService } from '@/lib/services/emotionalService'
import { CreativeWorkType, CreativeWorkStyle, CreativeWork } from '@/types/database'
import { generateText } from '@/lib/llm/provider'
import { stripUndefinedFields } from '@/lib/firestoreUtils'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'

const DAILY_LIMIT = 20
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000
const CREATIVE_COLLECTION = 'creative_works'

interface CreateCreativeRequest {
  type: CreativeWorkType
  style: CreativeWorkStyle
  prompt?: string
  themes?: string[]
}

function creativeWorkToFirestoreDoc(work: CreativeWork): Record<string, unknown> {
  const { id, ...data } = work
  void id
  return stripUndefinedFields(data)
}

function firestoreDocToCreativeWork(docSnap: { id: string; data: () => Record<string, unknown> }): CreativeWork {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as CreativeWork
}

async function countCreativeWorksSince(agentId: string, start: string): Promise<number> {
  if (readsFromPostgres(getPersistenceMode())) {
    return FeatureContentRepository.countCreativeWorksSince(agentId, start)
  }

  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, CREATIVE_COLLECTION),
    where('createdAt', '>=', start),
    orderBy('createdAt', 'desc'),
    limit(DAILY_LIMIT)
  ))
  return snapshot.size
}

async function listCreativeWorks(agentId: string, options?: {
  type?: CreativeWorkType
  limit?: number
}): Promise<CreativeWork[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return FeatureContentRepository.listCreativeWorks(agentId, options)
  }

  const worksRef = collection(db, 'agents', agentId, CREATIVE_COLLECTION)
  const q = options?.type
    ? query(worksRef, where('type', '==', options.type), orderBy('createdAt', 'desc'), limit(options.limit || 20))
    : query(worksRef, orderBy('createdAt', 'desc'), limit(options?.limit || 20))

  const snapshot = await getDocs(q)
  return snapshot.docs.map(firestoreDocToCreativeWork)
}

async function writeCreativeWorkToFirestore(work: CreativeWork): Promise<void> {
  await setDoc(
    doc(db, 'agents', work.agentId, CREATIVE_COLLECTION, work.id),
    creativeWorkToFirestoreDoc(work)
  )
}

async function saveCreativeWork(work: CreativeWork): Promise<CreativeWork> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeCreativeWorkToFirestore(work)
    return work
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'creative_work',
      entityId: work.id,
      operation: 'create',
      payload: creativeWorkToFirestoreDoc(work),
      primary: async () => {
        await writeCreativeWorkToFirestore(work)
        return work
      },
      secondary: async () => FeatureContentRepository.saveCreativeWork(work),
    })
  }

  return runMirroredWrite({
    entityType: 'creative_work',
    entityId: work.id,
    operation: 'create',
    payload: creativeWorkToFirestoreDoc(work),
    primary: async () => FeatureContentRepository.saveCreativeWork(work),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeCreativeWorkToFirestore(work)
        }
      : undefined,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body: CreateCreativeRequest = await request.json()
    const providerInfo = getProviderInfoForRequest(request)

    if (!body.type || !body.style) {
      return NextResponse.json(
        { error: 'type and style are required' },
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

    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    const usageCount = await countCreativeWorksSince(agentId, windowStart)
    if (usageCount >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: 'Daily creative limit reached. Try again tomorrow.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }

    const remaining = Math.max(DAILY_LIMIT - usageCount - 1, 0)
    const creativePrompt = creativityService.generateCreativePrompt(
      agent,
      body.type,
      body.style,
      body.prompt,
      body.themes
    )

    if (!providerInfo) {
      return NextResponse.json(
        { error: 'LLM provider not configured' },
        { status: 500 }
      )
    }

    const systemPrompt = `You are ${agent.name}. ${agent.persona}

You have been asked to create something. Be creative, authentic to your personality, and produce high-quality content.`

    const { content: llmResponse } = await generateText({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: creativePrompt },
      ],
      temperature: 0.9,
      maxTokens: 2000,
      providerInfo,
    })

    const creativeWork = creativityService.parseCreativeResponse(
      agentId,
      body.type,
      body.style,
      llmResponse,
      body.prompt,
      agent.emotionalState
    )

    const savedWork = await saveCreativeWork(creativeWork)
    await agentProgressService.recordCreativeWork(agentId)

    const refreshedAgent = await AgentService.getAgentById(agentId)
    if (refreshedAgent) {
      const emotionalUpdate = emotionalService.processInternalAction({
        agent: refreshedAgent,
        source: 'creative_generation',
        content: creativeWork.content,
        linkedActionId: savedWork.id,
      })

      await AgentService.updateAgent(agentId, {
        emotionalState: emotionalUpdate.emotionalState,
        emotionalHistory: emotionalUpdate.emotionalHistory,
      })
    }

    return NextResponse.json({
      success: true,
      creativeWork: savedWork,
      remaining,
    })
  } catch (error) {
    console.error('Creative API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate creative content' },
      { status: 500 }
    )
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { searchParams } = new URL(request.url)
    const type = searchParams.get('type') as CreativeWorkType | null
    const limitCount = parseInt(searchParams.get('limit') || '20')

    const works = await listCreativeWorks(agentId, {
      type: type || undefined,
      limit: limitCount,
    })
    const stats = creativityService.getCreativeStats(works)

    return NextResponse.json({
      works,
      stats,
    })
  } catch (error) {
    console.error('Get creative works error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch creative works' },
      { status: 500 }
    )
  }
}
