// Real LLM integration functions for Gemini AI
// Uses streaming responses via Server-Sent Events

export interface LLMResponse {
  content: string
  timestamp: string
  model?: string
}

/**
 * Generates a real AI response for an agent using Gemini API
 * Uses streaming responses for better UX
 *
 * @param userMessage - The user's message
 * @param agentPersona - The agent's personality/description
 * @param agentGoals - The agent's goals
 * @param conversationHistory - Previous conversation messages for context
 * @returns Promise<LLMResponse> - Complete response after streaming
 */
export async function generateAgentResponse(
  userMessage: string,
  agentPersona: string,
  agentGoals: string[],
  conversationHistory?: Array<{ role: 'user' | 'assistant', content: string }>
): Promise<LLMResponse> {
  try {
    const response = await fetch('/api/llm', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        prompt: userMessage,
        agentPersona,
        agentGoals,
        conversationHistory
      })
    })

    if (!response.ok) {
      throw new Error(`LLM API error: ${response.status}`)
    }

    // For streaming responses, we'll handle this differently in the UI
    // This function now returns a promise that resolves when streaming is complete
    return new Promise((resolve, reject) => {
      const reader = response.body?.getReader()
      const decoder = new TextDecoder()
      let fullContent = ''
      let model = 'gemini-1.5-flash' // Default model

      const readStream = async () => {
        try {
          while (true) {
            const { done, value } = await reader!.read()
            if (done) break

            const chunk = decoder.decode(value)
            const lines = chunk.split('\n')

            for (const line of lines) {
              if (line.startsWith('data: ')) {
                try {
                  const data = JSON.parse(line.slice(6))

                  if (data.content) {
                    fullContent += data.content
                  }

                  if (data.model) {
                    model = data.model
                  }
                } catch {
                  // Ignore parsing errors for malformed chunks
                }
              }
            }
          }

          resolve({
            content: fullContent,
            timestamp: new Date().toISOString(),
            model
          })
        } catch (error) {
          reject(error)
        }
      }

      readStream()
    })

  } catch (error) {
    console.error('Error calling LLM API:', error)

    // Fallback to simulated response if API fails
    await new Promise(resolve => setTimeout(resolve, 1000))

    const fallbackResponses = [
      `As a ${agentPersona}, I understand your request perfectly. Let me help you with that.`,
      `Based on my expertise in ${agentGoals.join(' and ')}, here's my perspective:`,
      `I appreciate you reaching out. As someone focused on ${agentGoals[0]}, I think the best approach would be:`,
      `That's an interesting point. Given my role in ${agentGoals.join(' and ')}, I'd suggest:`,
      `I see what you're asking. Let me draw from my knowledge of ${agentGoals.join(' and ')} to provide a thoughtful response:`
    ]

    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]

    return {
      content: randomResponse,
      timestamp: new Date().toISOString(),
      model: 'fallback'
    }
  }
}

/**
 * Validates if a message is appropriate for LLM processing
 */
export function validateMessageForLLM(message: string): boolean {
  // Basic validation
  return message.trim().length > 0 && message.length <= 4000
}

/**
 * Gets the current LLM model being used
 */
export function getCurrentLLMModel(): string {
  if (process.env.GOOGLE_AI_API_KEY) {
    return 'gemini-1.5-flash'
  } else if (process.env.GROQ_API_KEY) {
    return 'mixtral-8x7b-32768'
  }
  return 'fallback'
}

/**
 * Creates a streaming response handler for real-time UI updates
 */
export function createStreamingHandler(
  onChunk: (chunk: string) => void,
  onComplete: (fullContent: string) => void,
  onError: (error: Error) => void
) {
  return async (response: Response) => {
    if (!response.body) {
      onError(new Error('No response body'))
      return
    }

    const reader = response.body.getReader()
    const decoder = new TextDecoder()
    let fullContent = ''

    try {
      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        const chunk = decoder.decode(value)
        const lines = chunk.split('\n')

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.slice(6))

              if (data.content) {
                fullContent += data.content
                onChunk(data.content)
              }

              if (data.done) {
                onComplete(fullContent)
                return
              }
            } catch {
              // Ignore parsing errors
            }
          }
        }
      }
    } catch (error) {
      onError(error as Error)
    }
  }
}

