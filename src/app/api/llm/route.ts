import { NextRequest } from 'next/server'
import { AgentChain } from '@/lib/langchain/agentChain'

interface LLMRequest {
  prompt: string
  agentPersona: string
  agentGoals: string[]
  agentId?: string // For memory context
  conversationHistory?: Array<{ role: 'user' | 'assistant', content: string }>
  enableStreaming?: boolean
}

export async function POST(request: NextRequest) {
  try {
    const body: LLMRequest = await request.json()

    if (!body.prompt || !body.agentPersona) {
      return new Response(JSON.stringify({ error: 'Prompt and agentPersona are required' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // If agentId is provided, use LangChain orchestration
    if (body.agentId) {
      return await handleLangChainResponse(body)
    }

    // Fallback to original direct API logic for backward compatibility
    return await handleDirectAPIResponse(body)

  } catch (error) {
    console.error('LLM API error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process LLM request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Handle LangChain-powered responses
async function handleLangChainResponse(body: LLMRequest): Promise<Response> {
  try {
    const agentChain = AgentChain.getInstance(body.agentId!)

    if (body.enableStreaming) {
      // Handle streaming response
      const encoder = new TextEncoder()

      const stream = new ReadableStream({
        async start(controller) {
          try {
            const response = await agentChain.streamResponse(
              body.prompt,
              body.conversationHistory || [],
              (token: string) => {
                // Send token as SSE event
                const data = JSON.stringify({
                  type: 'token',
                  content: token
                })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              }
            )

            // Send final response
            const finalData = JSON.stringify({
              type: 'complete',
              content: response.response,
              reasoning: response.reasoning,
              toolsUsed: response.toolsUsed,
              memoryUsed: response.memoryUsed
            })
            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
            controller.close()

          } catch (error) {
            console.error('LangChain streaming error:', error)
            const errorData = JSON.stringify({
              type: 'error',
              content: 'Error generating response via LangChain'
            })
            controller.enqueue(encoder.encode(`data: ${errorData}\n\n`))
            controller.close()
          }
        }
      })

      return new Response(stream, {
        headers: {
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        },
      })
    } else {
      // Handle non-streaming response
      const response = await agentChain.generateResponse(
        body.prompt,
        body.conversationHistory || []
      )

      return new Response(JSON.stringify({
        content: response.response,
        reasoning: response.reasoning,
        toolsUsed: response.toolsUsed,
        memoryUsed: response.memoryUsed,
        langchain: true
      }), {
        headers: { 'Content-Type': 'application/json' }
      })
    }
  } catch (error) {
    console.error('LangChain response error:', error)
    return new Response(JSON.stringify({
      error: 'Failed to generate LangChain response',
      fallback: true
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

// Fallback to direct API response for backward compatibility
async function handleDirectAPIResponse(body: LLMRequest): Promise<Response> {
  try {
    // Memory context is handled by LangChain AgentChain when agentId is provided

    // Use Gemini API (preferred) or fallback to Groq
    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GROQ_API_KEY

    if (!apiKey) {
      return new Response(JSON.stringify({ error: 'LLM API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      })
    }

    // Build conversation context
    const systemPrompt = `You are an AI agent with the following persona: ${body.agentPersona}

Your goals are: ${body.agentGoals.join(', ')}

Respond naturally and helpfully to user queries. Keep responses conversational but focused on your defined role and goals.`

    const messages = [
      { role: 'system', content: systemPrompt },
      ...(body.conversationHistory || []).slice(-10), // Last 10 messages for context
      { role: 'user', content: body.prompt }
    ]

    if (process.env.GOOGLE_AI_API_KEY) {
      // Use Gemini API
      return await handleGeminiStream(apiKey, messages)
    } else if (process.env.GROQ_API_KEY) {
      // Fallback to Groq API
      return await handleGroqStream(apiKey, messages)
    } else {
      throw new Error('No LLM API key configured')
    }

  } catch (error) {
    console.error('Direct API response error:', error)
    return new Response(JSON.stringify({ error: 'Failed to process direct API request' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }
}

async function handleGeminiStream(apiKey: string, messages: Array<{ role: string; content: string }>) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:streamGenerateContent?alt=sse&key=${apiKey}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: messages.map(msg => ({
        role: msg.role === 'assistant' ? 'model' : msg.role,
        parts: [{ text: msg.content }]
      }))
    })
  })

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`)
  }

  // Return streaming response
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

async function handleGroqStream(apiKey: string, messages: Array<{ role: string; content: string }>) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: 'mixtral-8x7b-32768',
      messages,
      stream: true,
      max_tokens: 1000,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`)
  }

  // Return streaming response
  return new Response(response.body, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
    },
  })
}

