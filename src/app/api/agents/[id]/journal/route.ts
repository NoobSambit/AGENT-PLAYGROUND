/**
 * Journal API Route - Phase 2
 *
 * Handles journal entry generation for agents.
 * Rate limited to prevent API quota exhaustion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { collection, doc, getDocs, limit, orderBy, query, setDoc, where } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { runMirroredWrite } from '@/lib/persistence/writeMirror'
import { FeatureContentRepository } from '@/lib/repositories/featureContentRepository'
import { RelationshipRepository } from '@/lib/repositories/relationshipRepository'
import { journalService } from '@/lib/services/journalService'
import { agentProgressService } from '@/lib/services/agentProgressService'
import { AgentService } from '@/lib/services/agentService'
import { emotionalService } from '@/lib/services/emotionalService'
import { MemoryService } from '@/lib/services/memoryService'
import { JournalEntryType, JournalEntry, AgentRelationship } from '@/types/database'
import { generateText } from '@/lib/llm/provider'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import type { LLMProviderInfo } from '@/lib/llmConfig'

const DAILY_LIMIT = 10
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000
const JOURNAL_MIN_WORDS = 150
const JOURNAL_MAX_WORDS = 300
const JOURNAL_COLLECTION = 'journal_entries'

interface CreateJournalRequest {
  type?: JournalEntryType
  customPrompt?: string
}

function journalEntryToFirestoreDoc(entry: JournalEntry): Record<string, unknown> {
  const { id, ...data } = entry
  void id
  return data
}

function firestoreDocToJournalEntry(docSnap: { id: string; data: () => Record<string, unknown> }): JournalEntry {
  return {
    id: docSnap.id,
    ...docSnap.data(),
  } as JournalEntry
}

function orientRelationshipForAgent(agentId: string, relationship: AgentRelationship): AgentRelationship {
  if (relationship.agentId1 === agentId) {
    return relationship
  }

  return {
    ...relationship,
    agentId1: agentId,
    agentId2: relationship.agentId1,
  }
}

async function generateJournalContent(
  systemPrompt: string,
  journalPrompt: string,
  providerInfo: LLMProviderInfo
): Promise<string> {
  const { content } = await generateText({
    messages: [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: journalPrompt },
    ],
    temperature: 0.8,
    maxTokens: 1500,
    providerInfo,
  })

  return content
}

async function countJournalEntriesSince(agentId: string, start: string): Promise<number> {
  if (readsFromPostgres(getPersistenceMode())) {
    return FeatureContentRepository.countJournalEntriesSince(agentId, start)
  }

  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, JOURNAL_COLLECTION),
    where('createdAt', '>=', start),
    orderBy('createdAt', 'desc'),
    limit(DAILY_LIMIT)
  ))
  return snapshot.size
}

async function listJournalEntries(agentId: string, options?: {
  type?: JournalEntryType
  limit?: number
}): Promise<JournalEntry[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    return FeatureContentRepository.listJournalEntries(agentId, options)
  }

  const entriesRef = collection(db, 'agents', agentId, JOURNAL_COLLECTION)
  const q = options?.type
    ? query(entriesRef, where('type', '==', options.type), orderBy('createdAt', 'desc'), limit(options.limit || 20))
    : query(entriesRef, orderBy('createdAt', 'desc'), limit(options?.limit || 20))

  const snapshot = await getDocs(q)
  return snapshot.docs.map(firestoreDocToJournalEntry)
}

async function listRelationshipsForAgent(agentId: string): Promise<AgentRelationship[]> {
  if (readsFromPostgres(getPersistenceMode())) {
    const relationships = await RelationshipRepository.listForAgent(agentId)
    return relationships.map((relationship) => orientRelationshipForAgent(agentId, relationship))
  }

  const snapshot = await getDocs(collection(db, 'agents', agentId, 'relationships'))
  return snapshot.docs.map((docSnap) => orientRelationshipForAgent(agentId, {
    id: docSnap.id,
    ...docSnap.data(),
  } as AgentRelationship))
}

async function writeJournalEntryToFirestore(entry: JournalEntry): Promise<void> {
  await setDoc(doc(db, 'agents', entry.agentId, JOURNAL_COLLECTION, entry.id), journalEntryToFirestoreDoc(entry))
}

async function saveJournalEntry(entry: JournalEntry): Promise<JournalEntry> {
  const mode = getPersistenceMode()

  if (mode === 'firestore') {
    await writeJournalEntryToFirestore(entry)
    return entry
  }

  if (mode === 'dual-write-firestore-read') {
    return runMirroredWrite({
      entityType: 'journal_entry',
      entityId: entry.id,
      operation: 'create',
      payload: journalEntryToFirestoreDoc(entry),
      primary: async () => {
        await writeJournalEntryToFirestore(entry)
        return entry
      },
      secondary: async () => FeatureContentRepository.saveJournalEntry(entry),
    })
  }

  return runMirroredWrite({
    entityType: 'journal_entry',
    entityId: entry.id,
    operation: 'create',
    payload: journalEntryToFirestoreDoc(entry),
    primary: async () => FeatureContentRepository.saveJournalEntry(entry),
    secondary: mode === 'dual-write-postgres-read'
      ? async () => {
          await writeJournalEntryToFirestore(entry)
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
    const body: CreateJournalRequest = await request.json()
    const providerInfo = getProviderInfoForRequest(request)

    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    const usageCount = await countJournalEntriesSince(agentId, windowStart)
    if (usageCount >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: 'Daily journal limit reached. Try again tomorrow.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }

    const remaining = Math.max(DAILY_LIMIT - usageCount - 1, 0)
    const memories = await MemoryService.getRecentMemories(agentId, 10)
    const relationships = await listRelationshipsForAgent(agentId)

    const entryType = body.type || journalService.suggestJournalType(
      agent.emotionalState,
      Boolean(agent.goals && agent.goals.length > 0),
      relationships.length > 0
    )

    const journalPrompt = body.customPrompt || journalService.generateJournalPrompt(
      agent,
      entryType,
      memories,
      relationships
    )

    if (!providerInfo) {
      return NextResponse.json(
        { error: 'LLM provider not configured' },
        { status: 500 }
      )
    }

    const systemPrompt = `You are ${agent.name}, writing in your personal journal.
Write authentically and introspectively, reflecting on your experiences and feelings.
Your persona: ${agent.persona}`

    const llmResponse = await generateJournalContent(systemPrompt, journalPrompt, providerInfo)

    let journalEntry = journalService.parseJournalResponse(
      agentId,
      entryType,
      llmResponse,
      agent.emotionalState,
      memories.map((memory) => memory.id),
      relationships.map((relationship) => relationship.id)
    )

    if (journalEntry.wordCount < JOURNAL_MIN_WORDS || journalEntry.wordCount > JOURNAL_MAX_WORDS) {
      const retryPrompt = `${journalPrompt}

Your previous response was ${journalEntry.wordCount} words. Rewrite it to be between ${JOURNAL_MIN_WORDS}-${JOURNAL_MAX_WORDS} words. Keep JSON format and do not include extra commentary.`
      const retryResponse = await generateJournalContent(systemPrompt, retryPrompt, providerInfo)
      const retryEntry = journalService.parseJournalResponse(
        agentId,
        entryType,
        retryResponse,
        agent.emotionalState,
        memories.map((memory) => memory.id),
        relationships.map((relationship) => relationship.id)
      )

      if (retryEntry.wordCount >= JOURNAL_MIN_WORDS && retryEntry.wordCount <= JOURNAL_MAX_WORDS) {
        journalEntry = retryEntry
      }
    }

    const savedEntry = await saveJournalEntry(journalEntry)
    await agentProgressService.recordJournalEntry(agentId)

    const refreshedAgent = await AgentService.getAgentById(agentId)
    if (refreshedAgent) {
      const emotionalUpdate = emotionalService.processInternalAction({
        agent: refreshedAgent,
        source: 'journal_entry',
        content: journalEntry.content,
        linkedActionId: savedEntry.id,
      })

      await AgentService.updateAgent(agentId, {
        emotionalState: emotionalUpdate.emotionalState,
        emotionalHistory: emotionalUpdate.emotionalHistory,
      })
    }

    return NextResponse.json({
      success: true,
      entry: savedEntry,
      remaining,
    })
  } catch (error) {
    console.error('Journal API error:', error)
    return NextResponse.json(
      { error: 'Failed to generate journal entry' },
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
    const type = searchParams.get('type') as JournalEntryType | null
    const limitCount = parseInt(searchParams.get('limit') || '20')

    const entries = await listJournalEntries(agentId, {
      type: type || undefined,
      limit: limitCount,
    })
    const stats = journalService.getJournalStats(entries)
    const insights = journalService.getJournalInsights(entries)

    return NextResponse.json({
      entries,
      stats,
      insights,
    })
  } catch (error) {
    console.error('Get journal entries error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch journal entries' },
      { status: 500 }
    )
  }
}
