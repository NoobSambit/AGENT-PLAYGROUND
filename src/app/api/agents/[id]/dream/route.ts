/**
 * Dream API Route - Phase 2
 *
 * Handles dream generation for agents.
 * Rate limited to prevent API quota exhaustion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, addDoc, getDocs, query, orderBy, limit } from 'firebase/firestore'
import { dreamService } from '@/lib/services/dreamService'
import { DreamType, AgentRecord, Dream, MemoryRecord, EmotionType } from '@/types/database'

// Rate limiting: max 5 dreams per day per agent
const DAILY_LIMIT = 5

interface CreateDreamRequest {
  type?: DreamType
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body: CreateDreamRequest = await request.json()

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

    // Get recent memories for dream context
    const memoriesRef = collection(db, 'memories')
    const memoriesQuery = query(
      memoriesRef,
      orderBy('timestamp', 'desc'),
      limit(5)
    )
    const memoriesSnap = await getDocs(memoriesQuery)
    const memories: MemoryRecord[] = memoriesSnap.docs
      .filter(d => d.data().agentId === agentId)
      .map(d => ({ id: d.id, ...d.data() })) as MemoryRecord[]

    // Determine dream type
    const dreamType = body.type || dreamService.suggestDreamType(agent.emotionalState)

    // Extract emotional history
    const emotionalHistory = agent.emotionalHistory?.map(e => ({
      emotion: e.emotion,
      intensity: e.intensity,
    })) || []

    // Generate dream prompt
    const dreamPrompt = dreamService.generateDreamPrompt(
      agent,
      dreamType,
      memories,
      emotionalHistory
    )

    // Call LLM to generate dream
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'LLM API key not configured' },
        { status: 500 }
      )
    }

    const systemPrompt = `You are generating a dream for an AI agent named ${agent.name}.
The dream should be vivid, symbolic, and psychologically meaningful.
It should reflect the agent's recent experiences and emotional state.

${agent.persona}`

    let llmResponse: string

    if (process.env.GOOGLE_AI_API_KEY) {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: systemPrompt + '\n\n' + dreamPrompt }] }
            ],
            generationConfig: {
              temperature: 0.95,
              maxOutputTokens: 2500,
            },
          }),
        }
      )

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const data = await response.json()
      llmResponse = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
    } else {
      // Fallback to Groq
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: 'mixtral-8x7b-32768',
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: dreamPrompt },
          ],
          temperature: 0.95,
          max_tokens: 2500,
        }),
      })

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`)
      }

      const data = await response.json()
      llmResponse = data.choices?.[0]?.message?.content || ''
    }

    // Parse the dream response
    const relatedMemoryIds = memories.map(m => m.id)
    const relatedEmotions: EmotionType[] = agent.emotionalState
      ? (Object.entries(agent.emotionalState.currentMood)
          .filter(([, v]) => v > 0.4)
          .map(([e]) => e) as EmotionType[])
      : []

    const dream = dreamService.parseDreamResponse(
      agentId,
      dreamType,
      llmResponse,
      relatedMemoryIds,
      relatedEmotions
    )

    // Analyze the dream
    const analysis = dreamService.analyzeDream(dream)

    // Save to Firestore
    const dreamsRef = collection(db, 'agents', agentId, 'dreams')
    const docRef = await addDoc(dreamsRef, {
      ...dream,
      id: undefined,
    })

    // Return the dream with analysis
    const savedDream = { ...dream, id: docRef.id }

    return NextResponse.json({
      success: true,
      dream: savedDream,
      analysis,
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

    // Get dreams from Firestore
    const dreamsRef = collection(db, 'agents', agentId, 'dreams')
    const q = query(dreamsRef, orderBy('createdAt', 'desc'), limit(limitCount))
    const snapshot = await getDocs(q)

    const dreams: Dream[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as Dream[]

    // Get stats
    const stats = dreamService.getDreamStats(dreams)

    // Find recurring patterns
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
