/**
 * Creative Content API Route - Phase 2
 *
 * Handles creative work generation for agents.
 * Rate limited to prevent API quota exhaustion.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, collection, addDoc, getDocs, query, where, orderBy, limit } from 'firebase/firestore'
import { creativityService } from '@/lib/services/creativityService'
import { CreativeWorkType, CreativeWorkStyle, AgentRecord, CreativeWork } from '@/types/database'
import { getGeminiModel, getGroqModel } from '@/lib/llmConfig'
import { stripUndefinedFields } from '@/lib/firestoreUtils'

// Rate limiting: max 20 creative works per day per user
const DAILY_LIMIT = 20
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000

interface CreateCreativeRequest {
  type: CreativeWorkType
  style: CreativeWorkStyle
  prompt?: string
  themes?: string[]
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body: CreateCreativeRequest = await request.json()

    if (!body.type || !body.style) {
      return NextResponse.json(
        { error: 'type and style are required' },
        { status: 400 }
      )
    }

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
    const worksRef = collection(db, 'agents', agentId, 'creative_works')
    const windowStart = new Date(Date.now() - RATE_WINDOW_MS).toISOString()
    const rateQuery = query(
      worksRef,
      where('createdAt', '>=', windowStart),
      orderBy('createdAt', 'desc'),
      limit(DAILY_LIMIT)
    )
    const rateSnap = await getDocs(rateQuery)
    if (rateSnap.size >= DAILY_LIMIT) {
      return NextResponse.json(
        { error: 'Daily creative limit reached. Try again tomorrow.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }
    const remaining = Math.max(DAILY_LIMIT - rateSnap.size, 0)

    // Generate creative prompt
    const creativePrompt = creativityService.generateCreativePrompt(
      agent,
      body.type,
      body.style,
      body.prompt,
      body.themes
    )

    // Call LLM to generate creative content
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'LLM API key not configured' },
        { status: 500 }
      )
    }

    const systemPrompt = `You are ${agent.name}. ${agent.persona}

You have been asked to create something. Be creative, authentic to your personality, and produce high-quality content.`

    // Use Gemini API
    let llmResponse: string

    if (process.env.GOOGLE_AI_API_KEY) {
      const model = getGeminiModel()
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [
              { role: 'user', parts: [{ text: systemPrompt + '\n\n' + creativePrompt }] }
            ],
            generationConfig: {
              temperature: 0.9,
              maxOutputTokens: 2000,
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
          model: getGroqModel(),
          messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: creativePrompt },
          ],
          temperature: 0.9,
          max_tokens: 2000,
        }),
      })

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`)
      }

      const data = await response.json()
      llmResponse = data.choices?.[0]?.message?.content || ''
    }

    // Parse the creative response
    const creativeWork = creativityService.parseCreativeResponse(
      agentId,
      body.type,
      body.style,
      llmResponse,
      body.prompt,
      agent.emotionalState
    )

    // Save to Firestore
    const { id: _id, ...creativeData } = creativeWork
    const docRef = await addDoc(worksRef, stripUndefinedFields(creativeData))

    // Return the creative work with Firestore ID
    const savedWork = { ...creativeWork, id: docRef.id }

    return NextResponse.json({
      success: true,
      creativeWork: savedWork,
      remaining
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

    // Get creative works from Firestore
    const worksRef = collection(db, 'agents', agentId, 'creative_works')
    let q = query(worksRef, orderBy('createdAt', 'desc'), limit(limitCount))

    if (type) {
      q = query(worksRef, where('type', '==', type), orderBy('createdAt', 'desc'), limit(limitCount))
    }

    const snapshot = await getDocs(q)
    const works: CreativeWork[] = snapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    })) as CreativeWork[]

    // Get stats
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
