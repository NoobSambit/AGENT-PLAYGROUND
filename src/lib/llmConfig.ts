export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'
export const DEFAULT_OLLAMA_MODEL = 'llama3.2'
export const DEFAULT_OLLAMA_BASE_URL = 'http://127.0.0.1:11434'

export type LLMProvider = 'gemini' | 'groq' | 'ollama'

export interface LLMProviderInfo {
  provider: LLMProvider
  model: string
}

export interface LLMProviderPreference {
  provider?: string | null
  model?: string | null
}

function isSupportedProvider(value: string | null | undefined): value is LLMProvider {
  return value === 'gemini' || value === 'groq' || value === 'ollama'
}

export function getGeminiModel(): string {
  return process.env.GOOGLE_AI_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL
}

export function getOllamaModel(): string {
  return process.env.OLLAMA_MODEL || DEFAULT_OLLAMA_MODEL
}

export function getOllamaBaseUrl(): string {
  return (process.env.OLLAMA_BASE_URL || DEFAULT_OLLAMA_BASE_URL).replace(/\/+$/, '')
}

export function getModelForProvider(provider: LLMProvider): string {
  if (provider === 'gemini') {
    return getGeminiModel()
  }

  if (provider === 'groq') {
    return getGroqModel()
  }

  return getOllamaModel()
}

export function isProviderAvailable(provider: LLMProvider): boolean {
  if (provider === 'gemini') {
    return Boolean(process.env.GOOGLE_AI_API_KEY)
  }

  if (provider === 'groq') {
    return Boolean(process.env.GROQ_API_KEY)
  }

  return (
    process.env.LLM_PROVIDER === 'ollama' ||
    process.env.NEXT_PUBLIC_LLM_PROVIDER === 'ollama' ||
    Boolean(process.env.OLLAMA_MODEL) ||
    Boolean(process.env.OLLAMA_BASE_URL)
  )
}

export function getConfiguredLLMProvider(): LLMProviderInfo | null {
  return getConfiguredLLMProviderForPreference()
}

export function getConfiguredLLMProviderForPreference(
  preference?: LLMProviderPreference
): LLMProviderInfo | null {
  const preferredProvider = preference?.provider
  const preferredModel = preference?.model?.trim()

  if (isSupportedProvider(preferredProvider)) {
    if (preferredProvider === 'ollama' || isProviderAvailable(preferredProvider)) {
      return {
        provider: preferredProvider,
        model: preferredModel || getModelForProvider(preferredProvider),
      }
    }

    return null
  }

  const requestedProvider = process.env.LLM_PROVIDER || process.env.NEXT_PUBLIC_LLM_PROVIDER

  if (isSupportedProvider(requestedProvider) && isProviderAvailable(requestedProvider)) {
    return {
      provider: requestedProvider,
      model: preferredModel || getModelForProvider(requestedProvider),
    }
  }

  const fallbackProviders: LLMProvider[] = ['gemini', 'groq', 'ollama']
  for (const provider of fallbackProviders) {
    if (isProviderAvailable(provider)) {
      return {
        provider,
        model: preferredModel || getModelForProvider(provider),
      }
    }
  }

  return null
}

export function getLLMProviderOptions(): Array<LLMProviderInfo & { available: boolean }> {
  return [
    {
      provider: 'gemini',
      model: getGeminiModel(),
      available: isProviderAvailable('gemini'),
    },
    {
      provider: 'groq',
      model: getGroqModel(),
      available: isProviderAvailable('groq'),
    },
    {
      provider: 'ollama',
      model: getOllamaModel(),
      available: true,
    },
  ]
}
