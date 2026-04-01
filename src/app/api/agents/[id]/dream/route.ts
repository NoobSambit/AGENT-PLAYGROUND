/**
 * Dream API Route - Phase 2
 *
 * Handles dream generation for agents.
 * Rate limited to prevent API quota exhaustion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { collection, doc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { FeatureContentRepository } from '@/lib/repositories/featureContentRepository'
import { dreamService } from '@/lib/services/dreamService'
import { agentProgressService } from '@/lib/services/agentProgressService'
import { AgentService } from '@/lib/services/agentService'
import { emotionalService } from '@/lib/services/emotionalService'
import { MemoryService } from '@/lib/services/memoryService'
import { DreamType, Dream, EmotionType } from '@/types/database'
import { generateText } from '@/lib/llm/provider'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'

const DAILY_LIMIT = 5
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000
const DREAMS_COLLECTION = 'dreams'

interface CreateDreamRequest {
  type?: DreamType
}

function dreamToFirestoreDoc(dream: Dream): Record<string, unknown> {
  const { id, ...data } = dream
  void id
  return data
}

function firestoreDocToDream(docSnap: { id: string; data: () => Record<string, unknown> }): Dream {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as Dream
}

async function countDreamsSince(agentId: string, start: string): Promise<number> {
  if (readsFromPostgres(getPersistenceMode())) {
    return FeatureContentRepository.countDreamsSince(agentId, start)
  }

  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, DREAMS_COLLECTION),
    where('createdAt', '>=', start),
    orderBy('createdAt', 'desc'),
    limit(DAILY_LIMIT)
  ))
  return snapshot.size
}

async function listDreams(agentId: string, limitCount: number): Promise<Dream[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return FeatureContentRepository.listDreams(agentId, limitCount)
  }

  const snapshot = await getDocs(
    query(collection(db, 'agents', agentId, DREAMS_COLLECTION), orderBy('createdAt', 'desc'), limit(limitCount))
  )
  return snapshot.docs.map(firestoreDocToDream)
}

async function writeDreamToFirestore(dream: Dream): Promise<void> {
  await setDoc(doc(db, 'agents', dream.agentId, DREAMS_COLLECTION, dream.id), dreamToFirestoreDoc(dream))
}

async function saveDream(dream: Dream): Promise<Dream> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeDreamToFirestore(dream)
    return dream
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'dream',
      entityId: dream.id,
      operation: 'create',
      payload: dreamToFirestoreDoc(dream),
      primary: async () => {
        await writeDreamToFirestore(dream)
        return dream
      },
      secondary: async () => FeatureContentRepository.saveDream(dream),
    })
  }

  return runMirroredWrite({
    entityType: 'dream',
    entityId: dream.id,
    operation: 'create',
    payload: dreamToFirestoreDoc(dream),
    primary: async () => FeatureContentRepository.saveDream(dream),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeDreamToFirestore(dream)
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
    const body: CreateDreamRequest = await request.json()
    const providerInfo = getProviderInfoForRequest(request)

    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    const usageCount = await countDreamsSince(agentId, windowStart)
    if (usageCount >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: 'Daily dream limit reached. Try again tomorrow.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }

    const remaining = Math.max(DAILY_LIMIT - usageCount - 1, 0)
    const memories = await MemoryService.getRecentMemories(agentId, 5)
    const dreamType = body.type || dreamService.suggestDreamType(agent.emotionalState)
    const emotionalHistory = agent.emotionalHistory?.map((entry) => ({
      emotion: entry.emotion,
      intensity: entry.intensity,
    })) || []

    const dreamPrompt = dreamService.generateDreamPrompt(
      agent,
      dreamType,
      memories,
      emotionalHistory
    )

    if (!providerInfo) {
      return NextResponse.json(
        { error: 'LLM provider not configured' },
        { status: 500 }
      )
    }

    const systemPrompt = `You are generating a dream for an AI agent named ${agent.name}.
The dream should be vivid, symbolic, and psychologically meaningful.
It should reflect the agent's recent experiences and emotional state.

${agent.persona}`

    const { content: llmResponse } = await generateText({
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: dreamPrompt },
      ],
      temperature: 0.95,
      maxTokens: 2500,
      providerInfo,
    })

    const relatedMemoryIds = memories.map((memory) => memory.id)
    const relatedEmotions: EmotionType[] = agent.emotionalState
      ? (Object.entries(agent.emotionalState.currentMood)
          .filter(([, value]) => value > 0.4)
          .map(([emotion]) => emotion) as EmotionType[])
      : []

    const dream = dreamService.parseDreamResponse(
      agentId,
      dreamType,
      llmResponse,
      relatedMemoryIds,
      relatedEmotions
    )

    const analysis = dreamService.analyzeDream(dream)
    const savedDream = await saveDream(dream)
    await agentProgressService.recordDream(agentId)

    const refreshedAgent = await AgentService.getAgentById(agentId)
    if (refreshedAgent) {
      const emotionalUpdate = emotionalService.processInternalAction({
        agent: refreshedAgent,
        source: 'dream_generation',
        content: dream.narrative,
        linkedActionId: savedDream.id,
      })

      await AgentService.updateAgent(agentId, {
        emotionalState: emotionalUpdate.emotionalState,
        emotionalHistory: emotionalUpdate.emotionalHistory,
      })
    }

    return NextResponse.json({
      success: true,
      dream: savedDream,
      analysis,
      remaining,
    })
  } catch (error) {
    console.error('Dream API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate dream' },
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
    const limitCount = parseInt(searchParams.get('limit') || '10')

    const dreams = await listDreams(agentId, limitCount)
    const stats = dreamService.getDreamStats(dreams)
    const patterns = dreamService.findRecurringPatterns(dreams)

    return NextResponse.json({
      dreams,
      stats,
      patterns,
    })
  } catch (error) {
    console.error('Get dreams error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch dreams' },
      { status: 500 }
    )
  }
}
