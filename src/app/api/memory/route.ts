import { NextRequest, NextResponse } from 'next/server'
import { MemoryService } from '@/lib/services/memoryService'
import { CreateMemoryData, UpdateMemoryData } from '@/types/database'
import { getGeminiModel, getGroqModel } from '@/lib/llmConfig'

interface MemoryRequest {
  action: 'get' | 'getRelevant' | 'summarize' | 'delete' | 'getStats' | 'create' | 'update'
  agentId: string
  queryText?: string // For relevance search
  memoryId?: string // For specific memory operations
  maxMemories?: number // For limiting results
}


// GET /api/memory - Retrieve memories for an agent
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')
    const action = searchParams.get('action') as MemoryRequest['action'] || 'get'
    const queryText = searchParams.get('query')
    const maxMemories = parseInt(searchParams.get('maxMemories') || '10')

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'get':
        const memories = await MemoryService.getAllMemoriesForAgent(agentId)
        return NextResponse.json({ memories })

      case 'getRelevant':
        if (!queryText) {
          return NextResponse.json(
            { error: 'queryText is required for relevance search' },
            { status: 400 }
          )
        }
        const relevantMemories = await MemoryService.getRelevantMemories(
          agentId,
          queryText,
          maxMemories
        )
        return NextResponse.json({ memories: relevantMemories })

      case 'getStats':
        const stats = await MemoryService.getMemoryStats(agentId)
        return NextResponse.json({ stats })

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use get, getRelevant, or getStats' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Memory API error:', error)
    return NextResponse.json(
      { error: 'Failed to process memory request' },
      { status: 500 }
    )
  }
}

// POST /api/memory - Create or update memories, or summarize memories
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()

    if (body.action === 'summarize') {
      return await handleSummarize(body)
    }

    if (body.action === 'delete') {
      return await handleDelete(body)
    }

    // Create or update memory
    return await handleMemoryOperation(body)
  } catch (error) {
    console.error('Memory API error:', error)
    return NextResponse.json(
      { error: 'Failed to process memory request' },
      { status: 500 }
    )
  }
}

async function handleSummarize(body: { memories: Array<{ content: string; summary: string; importance: number }>, context?: string }) {
  try {
    if (!body.memories || body.memories.length === 0) {
      return NextResponse.json(
        { error: 'Memories array is required for summarization' },
        { status: 400 }
      )
    }

    // Use Gemini/Groq to summarize memories for efficient storage
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GROQ_API_KEY

    if (!apiKey) {
      return NextResponse.json(
        { error: 'LLM API key not configured' },
        { status: 500 }
      )
    }

    const memoriesText = body.memories
      .sort((a, b) => b.importance - a.importance) // Most important first
      .map(m => `Importance ${m.importance}/10: ${m.content}`)
      .join('\n\n')

    const contextPrompt = body.context || 'Summarize these memories for an AI agent to recall key information and patterns.'

    const prompt = `${contextPrompt}

Here are the memories to summarize:

${memoriesText}

Please provide a concise summary that captures the key information, patterns, and insights from these memories. Focus on what would be most relevant for the AI agent to remember about user preferences, interaction patterns, and important facts.`

    let summary = ''

    if (process.env.GOOGLE_AI_API_KEY) {
      const model = getGeminiModel()
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{ text: prompt }]
          }]
        })
      })

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`)
      }

      const data = await response.json()
      summary = data.candidates?.[0]?.content?.parts?.[0]?.text || 'Unable to generate summary'
    } else if (process.env.GROQ_API_KEY) {
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${apiKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: getGroqModel(),
          messages: [
            { role: 'system', content: 'You are a helpful assistant that summarizes memories for AI agents.' },
            { role: 'user', content: prompt }
          ],
          max_tokens: 500,
          temperature: 0.3
        })
      })

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status}`)
      }

      const data = await response.json()
      summary = data.choices?.[0]?.message?.content || 'Unable to generate summary'
    }

    return NextResponse.json({ summary })
  } catch (error) {
    console.error('Summarization error:', error)
    return NextResponse.json(
      { error: 'Failed to summarize memories' },
      { status: 500 }
    )
  }
}

async function handleDelete(body: { agentId: string; memoryId: string }) {
  try {
    if (!body.agentId || !body.memoryId) {
      return NextResponse.json(
        { error: 'agentId and memoryId are required' },
        { status: 400 }
      )
    }

    const success = await MemoryService.deleteMemory(body.memoryId)

    if (success) {
      return NextResponse.json({ success: true })
    } else {
      return NextResponse.json(
        { error: 'Failed to delete memory' },
        { status: 500 }
      )
    }
  } catch (error) {
    console.error('Delete memory error:', error)
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    )
  }
}

async function handleMemoryOperation(body: MemoryRequest & { memoryData?: CreateMemoryData | UpdateMemoryData }) {
  try {
    const { action, agentId, memoryId, memoryData } = body

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      )
    }

    switch (action) {
      case 'create':
        if (!memoryData) {
          return NextResponse.json(
            { error: 'memoryData is required for create action' },
            { status: 400 }
          )
        }

        const newMemory = await MemoryService.createMemory({
          ...(memoryData as CreateMemoryData),
          agentId
        })

        if (newMemory) {
          return NextResponse.json({ memory: newMemory })
        } else {
          return NextResponse.json(
            { error: 'Failed to create memory' },
            { status: 500 }
          )
        }

      case 'update':
        if (!memoryId || !memoryData) {
          return NextResponse.json(
            { error: 'memoryId and memoryData are required for update action' },
            { status: 400 }
          )
        }

        const success = await MemoryService.updateMemory(memoryId, memoryData)

        if (success) {
          const updatedMemory = await MemoryService.getMemoryById(memoryId)
          return NextResponse.json({ memory: updatedMemory })
        } else {
          return NextResponse.json(
            { error: 'Failed to update memory' },
            { status: 500 }
          )
        }

      default:
        return NextResponse.json(
          { error: 'Invalid action for memory operation' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Memory operation error:', error)
    return NextResponse.json(
      { error: 'Failed to process memory operation' },
      { status: 500 }
    )
  }
}
