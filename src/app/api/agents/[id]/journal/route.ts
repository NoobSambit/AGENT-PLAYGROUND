/**
 * Journal API Route - Phase 2
 *
 * Handles journal entry generation for agents.
 * Rate limited to prevent API quota exhaustion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, addDoc, getDocs, query, orderBy, limit, where } from 'firebase/firestore'
import { journalService } from '@/lib/services/journalService'
import { JournalEntryType, AgentRecord, JournalEntry, MemoryRecord, AgentRelationship } from '@/types/database'
import { getGeminiModel, getGroqModel } from '@/lib/llmConfig'

// Rate limiting: max 10 journal entries per day per agent
const DAILY_LIMIT = 10
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000
const JOURNAL_MIN_WORDS = 150
const JOURNAL_MAX_WORDS = 300

interface CreateJournalRequest {
  type?: JournalEntryType
  customPrompt?: string
}

async function generateJournalContent(
  systemPrompt: string,
  journalPrompt: string,
  apiKey: string
): Promise<string> {
  if (process.env.GOOGLE_AI_API_KEY) {
    const model = getGeminiModel()
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: systemPrompt + '\n\n' + journalPrompt }] }
          ],
          generationConfig: {
            temperature: 0.8,
            maxOutputTokens: 1500,
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    return data.candidates?.[0]?.content?.parts?.[0]?.text || ''
  }

  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: getGroqModel(),
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: journalPrompt },
      ],
      temperature: 0.8,
      max_tokens: 1500,
    }),
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`)
  }

  const data = await response.json()
  return data.choices?.[0]?.message?.content || ''
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body: CreateJournalRequest = await request.json()

    // Get agent data
    const agentRef = doc(db, 'agents', agentId)
    const agentSnap = await getDoc(agentRef)

    if (!agentSnap.exists()) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const agent = { id: agentSnap.id, ...agentSnap.data() } as AgentRecord

    // Enforce daily rate limit per agent
    const journalsRef = collection(db, 'agents', agentId, 'journal_entries')
    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    const rateQuery = query(
      journalsRef,
      where('createdAt', '>=', windowStart),
      orderBy('createdAt', 'desc'),
      limit(DAILY_LIMIT)
    )
    const rateSnap = await getDocs(rateQuery)
    if (rateSnap.size >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: 'Daily journal limit reached. Try again tomorrow.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }
    const remaining = Math.max(DAILY_LIMIT - rateSnap.size, 0)

    // Get recent memories
    const memoriesRef = collection(db, 'memories')
    const memoriesQuery = query(
      memoriesRef,
      orderBy('timestamp', 'desc'),
      limit(10)
    )
    const memoriesSnap = await getDocs(memoriesQuery)
    const memories: MemoryRecord[] = memoriesSnap.docs
      .filter(d => d.data().agentId === agentId)
      .map(d => ({ id: d.id, ...d.data() })) as MemoryRecord[]

    // Get relationships (if any)
    const relationshipsRef = collection(db, 'agents', agentId, 'relationships')
    const relationshipsSnap = await getDocs(relationshipsRef)
    const relationships: AgentRelationship[] = relationshipsSnap.docs.map(d => ({
      id: d.id,
      ...d.data(),
    })) as AgentRelationship[]

    // Determine journal entry type
    const entryType = body.type || journalService.suggestJournalType(
      agent.emotionalState,
      agent.goals && agent.goals.length > 0,
      relationships.length > 0
    )

    // Generate journal prompt
    const journalPrompt = journalService.generateJournalPrompt(
      agent,
      entryType,
      memories,
      relationships
    )

    // Call LLM to generate journal entry
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'LLM API key not configured' },
        { status: 500 }
      )
    }

    const systemPrompt = `You are ${agent.name}, writing in your personal journal.
Write authentically and introspectively, reflecting on your experiences and feelings.
Your persona: ${agent.persona}`

    const llmResponse = await generateJournalContent(systemPrompt, journalPrompt, apiKey)

    // Parse the journal response
    let journalEntry = journalService.parseJournalResponse(
      agentId,
      entryType,
      llmResponse,
      agent.emotionalState,
      memories.map(m => m.id),
      relationships.map(r => r.id)
    )

    if (journalEntry.wordCount < JOURNAL_MIN_WORDS || journalEntry.wordCount > JOURNAL_MAX_WORDS) {
      const retryPrompt = `${journalPrompt}

Your previous response was ${journalEntry.wordCount} words. Rewrite it to be between ${JOURNAL_MIN_WORDS}-${JOURNAL_MAX_WORDS} words. Keep JSON format and do not include extra commentary.`
      const retryResponse = await generateJournalContent(systemPrompt, retryPrompt, apiKey)
      const retryEntry = journalService.parseJournalResponse(
        agentId,
        entryType,
        retryResponse,
        agent.emotionalState,
        memories.map(m => m.id),
        relationships.map(r => r.id)
      )
      if (retryEntry.wordCount >= JOURNAL_MIN_WORDS && retryEntry.wordCount <= JOURNAL_MAX_WORDS) {
        journalEntry = retryEntry
      }
    }

    // Save to Firestore
    const { id: _id, ...journalData } = journalEntry
    const docRef = await addDoc(journalsRef, journalData)

    // Return the journal entry
    const savedEntry = { ...journalEntry, id: docRef.id }

    return NextResponse.json({
      success: true,
      entry: savedEntry,
      remaining
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

    // Get journal entries from Firestore
    const journalsRef = collection(db, 'agents', agentId, 'journal_entries')
    let q = query(journalsRef, orderBy('createdAt', 'desc'), limit(limitCount))

    if (type) {
      q = query(journalsRef, where('type', '==', type), orderBy('createdAt', 'desc'), limit(limitCount))
    }

    const snapshot = await getDocs(q)
    const entries: JournalEntry[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as JournalEntry[]

    // Get stats
    const stats = journalService.getJournalStats(entries)

    // Get insights
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
