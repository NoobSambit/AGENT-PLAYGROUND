import { NextRequest } from 'next/server'
import { AgentChain } from '@/lib/langchain/agentChain'
import { getGeminiModel, getGroqModel } from '@/lib/llmConfig'

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

type LLMProvider = 'gemini' | 'groq'

function getProviderInfo(): { provider: LLMProvider; model: string } | null {
  if (process.env.GOOGLE_AI_API_KEY) {
    return { provider: 'gemini', model: getGeminiModel() }
  }
  if (process.env.GROQ_API_KEY) {
    return { provider: 'groq', model: getGroqModel() }
  }
  return null
}

function extractTokens(payload: unknown, provider: LLMProvider): string[] {
  if (provider === 'gemini') {
    const geminiPayload = payload as {
      candidates?: Array<{
        content?: { parts?: Array<{ text?: string }> }
      }>
    }
    const parts = geminiPayload.candidates?.[0]?.content?.parts
    if (Array.isArray(parts)) {
      return parts.map(part => part?.text || '').filter(Boolean)
    }
    return []
  }

  const groqPayload = payload as {
    choices?: Array<{ delta?: { content?: string }; message?: { content?: string } }>
  }
  const content = groqPayload.choices?.[0]?.delta?.content || groqPayload.choices?.[0]?.message?.content
  return content ? [content] : []
}

function normalizeSseStream(
  response: Response,
  providerInfo: { provider: LLMProvider; model: string }
): Response {
  if (!response.body) {
    return new Response(JSON.stringify({ error: 'Empty LLM stream' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  const encoder = new TextEncoder()
  const decoder = new TextDecoder()
  const reader = response.body.getReader()

  const stream = new ReadableStream({
    async start(controller) {
      let buffer = ''
      try {
        while (true) {
          const { done, value } = await reader.read()
          if (done) break

          buffer += decoder.decode(value, { stream: true })
          const lines = buffer.split(/\r?\n/)
          buffer = lines.pop() || ''

          for (const line of lines) {
            const trimmed = line.trim()
            if (!trimmed.startsWith('data:')) continue

            const data = trimmed.replace(/^data:\s*/, '')
            if (!data) continue

            if (data === '[DONE]') {
              const donePayload = JSON.stringify({
                done: true,
                model: providerInfo.model,
                provider: providerInfo.provider
              })
              controller.enqueue(encoder.encode(`data: ${donePayload}\n\n`))
              controller.close()
              return
            }

            try {
              const payload = JSON.parse(data)
              const tokens = extractTokens(payload, providerInfo.provider)
              for (const token of tokens) {
                const normalized = JSON.stringify({
                  content: token,
                  model: providerInfo.model,
                  provider: providerInfo.provider
                })
                controller.enqueue(encoder.encode(`data: ${normalized}\n\n`))
              }
            } catch {
              // Ignore malformed JSON chunks
            }
          }
        }

        if (buffer.trim().startsWith('data:')) {
          const data = buffer.trim().replace(/^data:\s*/, '')
          if (data && data !== '[DONE]') {
            try {
              const payload = JSON.parse(data)
              const tokens = extractTokens(payload, providerInfo.provider)
              for (const token of tokens) {
                const normalized = JSON.stringify({
                  content: token,
                  model: providerInfo.model,
                  provider: providerInfo.provider
                })
                controller.enqueue(encoder.encode(`data: ${normalized}\n\n`))
              }
            } catch {
              // Ignore malformed JSON chunks
            }
          }
        }

        const donePayload = JSON.stringify({
          done: true,
          model: providerInfo.model,
          provider: providerInfo.provider
        })
        controller.enqueue(encoder.encode(`data: ${donePayload}\n\n`))
        controller.close()
      } catch {
        const errorPayload = JSON.stringify({
          error: 'Error normalizing LLM stream',
          done: true,
          model: providerInfo.model,
          provider: providerInfo.provider
        })
        controller.enqueue(encoder.encode(`data: ${errorPayload}\n\n`))
        controller.close()
      }
    }
  })

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive'
    }
  })
}

// Handle LangChain-powered responses
async function handleLangChainResponse(body: LLMRequest): Promise<Response> {
  try {
    const agentChain = AgentChain.getInstance(body.agentId!)
    const providerInfo = getProviderInfo()

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
                // Send token as normalized SSE event
                const data = JSON.stringify({
                  content: token,
                  model: providerInfo?.model,
                  provider: providerInfo?.provider
                })
                controller.enqueue(encoder.encode(`data: ${data}\n\n`))
              }
            )

            // Send final response
            const finalData = JSON.stringify({
              done: true,
              model: providerInfo?.model,
              provider: providerInfo?.provider,
              reasoning: response.reasoning,
              toolsUsed: response.toolsUsed,
              memoryUsed: response.memoryUsed
            })
            controller.enqueue(encoder.encode(`data: ${finalData}\n\n`))
            controller.close()

          } catch (error) {
            console.error('LangChain streaming error:', error)
            const errorData = JSON.stringify({
              error: 'Error generating response via LangChain',
              done: true,
              model: providerInfo?.model,
              provider: providerInfo?.provider
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
        langchain: true,
        model: providerInfo?.model,
        provider: providerInfo?.provider
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
    const providerInfo = getProviderInfo()

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

    if (process.env.GOOGLE_AI_API_KEY && providerInfo) {
      // Use Gemini API
      const response = await handleGeminiStream(apiKey, messages, providerInfo.model)
      return normalizeSseStream(response, providerInfo)
    }
    if (process.env.GROQ_API_KEY && providerInfo) {
      // Fallback to Groq API
      const response = await handleGroqStream(apiKey, messages, providerInfo.model)
      return normalizeSseStream(response, providerInfo)
    }
    {
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

async function handleGeminiStream(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  model: string
) {
  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:streamGenerateContent?alt=sse&key=${apiKey}`, {
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

  return response
}

async function handleGroqStream(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  model: string
) {
  const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model,
      messages,
      stream: true,
      max_tokens: 1000,
      temperature: 0.7
    })
  })

  if (!response.ok) {
    throw new Error(`Groq API error: ${response.status}`)
  }

  return response
}
