import {
  getConfiguredLLMProvider,
  getOllamaBaseUrl,
  type LLMProviderInfo,
} from '@/lib/llmConfig'

export interface LLMMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface GenerateTextOptions {
  messages: LLMMessage[]
  temperature?: number
  maxTokens?: number
  providerInfo?: LLMProviderInfo | null
}

export function requireConfiguredProvider(): LLMProviderInfo {
  const providerInfo = getConfiguredLLMProvider()

  if (!providerInfo) {
    throw new Error(
      'No LLM provider configured. Set GOOGLE_AI_API_KEY, GROQ_API_KEY, or LLM_PROVIDER=ollama.'
    )
  }

  return providerInfo
}

export function hasConfiguredProvider(): boolean {
  return getConfiguredLLMProvider() !== null
}

export async function generateText({
  messages,
  temperature = 0.7,
  maxTokens = 1000,
  providerInfo: providerOverride = null,
}: GenerateTextOptions): Promise<{ content: string; providerInfo: LLMProviderInfo }> {
  const providerInfo = providerOverride || requireConfiguredProvider()

  if (providerInfo.provider === 'gemini') {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${providerInfo.model}:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            {
              role: 'user',
              parts: [{ text: buildSinglePrompt(messages) }],
            },
          ],
          generationConfig: {
            temperature,
            maxOutputTokens: maxTokens,
          },
        }),
      }
    )

    if (!response.ok) {
      throw new Error(`Gemini API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      content: data.candidates?.[0]?.content?.parts?.[0]?.text || '',
      providerInfo,
    }
  }

  if (providerInfo.provider === 'groq') {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: providerInfo.model,
        messages,
        temperature,
        max_tokens: maxTokens,
      }),
    })

    if (!response.ok) {
      throw new Error(`Groq API error: ${response.status}`)
    }

    const data = await response.json()
    return {
      content: data.choices?.[0]?.message?.content || '',
      providerInfo,
    }
  }

  const response = await fetch(`${getOllamaBaseUrl()}/api/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      model: providerInfo.model,
      messages,
      stream: false,
      options: {
        temperature,
        num_predict: maxTokens,
      },
    }),
  })

  if (!response.ok) {
    throw new Error(`Ollama API error: ${response.status}`)
  }

  const data = await response.json()
  return {
    content: data.message?.content || '',
    providerInfo,
  }
}

function buildSinglePrompt(messages: LLMMessage[]): string {
  return messages
    .map((message) => `${message.role.toUpperCase()}:\n${message.content}`)
    .join('\n\n')
}
