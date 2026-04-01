import type { LLMProvider } from '@/lib/llmConfig'
import {
  LLM_MODEL_COOKIE_NAME,
  LLM_MODEL_HEADER_NAME,
  LLM_PROVIDER_COOKIE_NAME,
  LLM_PROVIDER_HEADER_NAME,
} from '@/lib/llm/preferenceConstants'

export const LLM_PROVIDER_STORAGE_KEY = 'agent-playground.llm-provider'

export const LLM_PROVIDER_LABELS: Record<LLMProvider, string> = {
  gemini: 'Gemini',
  groq: 'Groq',
  ollama: 'Ollama',
}

export const CLIENT_DEFAULT_MODELS: Record<LLMProvider, string> = {
  gemini: 'gemini-2.0-flash',
  groq: 'llama-3.3-70b-versatile',
  ollama: 'llama3.2',
}

export function normalizeLLMProvider(value: string | null | undefined): LLMProvider | null {
  if (value === 'gemini' || value === 'groq' || value === 'ollama') {
    return value
  }

  return null
}

export function getDefaultClientLLMProvider(): LLMProvider {
  return normalizeLLMProvider(process.env.NEXT_PUBLIC_LLM_PROVIDER) || 'gemini'
}

export function getClientModelForProvider(provider: LLMProvider): string {
  const envProvider = normalizeLLMProvider(process.env.NEXT_PUBLIC_LLM_PROVIDER)
  if (envProvider === provider && process.env.NEXT_PUBLIC_LLM_MODEL) {
    return process.env.NEXT_PUBLIC_LLM_MODEL
  }

  return CLIENT_DEFAULT_MODELS[provider]
}

export function writeLLMPreferenceCookie(provider: LLMProvider, model?: string): void {
  if (typeof document === 'undefined') {
    return
  }

  const maxAge = 60 * 60 * 24 * 365
  document.cookie = `${LLM_PROVIDER_COOKIE_NAME}=${provider}; path=/; max-age=${maxAge}; SameSite=Lax`

  if (model) {
    document.cookie = `${LLM_MODEL_COOKIE_NAME}=${encodeURIComponent(model)}; path=/; max-age=${maxAge}; SameSite=Lax`
    return
  }

  document.cookie = `${LLM_MODEL_COOKIE_NAME}=; path=/; max-age=0; SameSite=Lax`
}

export function buildLLMPreferenceHeaders(provider: LLMProvider, model?: string): HeadersInit {
  const headers = new Headers()
  headers.set(LLM_PROVIDER_HEADER_NAME, provider)

  if (model) {
    headers.set(LLM_MODEL_HEADER_NAME, model)
  }

  return headers
}
