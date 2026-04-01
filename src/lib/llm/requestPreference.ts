import { NextRequest } from 'next/server'
import {
  getConfiguredLLMProviderForPreference,
  type LLMProviderInfo,
  type LLMProviderPreference,
} from '@/lib/llmConfig'
import {
  LLM_MODEL_COOKIE_NAME,
  LLM_MODEL_HEADER_NAME,
  LLM_PROVIDER_COOKIE_NAME,
  LLM_PROVIDER_HEADER_NAME,
} from '@/lib/llm/preferenceConstants'

export function getLLMPreferenceFromRequest(request: NextRequest): LLMProviderPreference {
  return {
    provider:
      request.headers.get(LLM_PROVIDER_HEADER_NAME) ||
      request.cookies.get(LLM_PROVIDER_COOKIE_NAME)?.value ||
      null,
    model:
      request.headers.get(LLM_MODEL_HEADER_NAME) ||
      request.cookies.get(LLM_MODEL_COOKIE_NAME)?.value ||
      null,
  }
}

export function getProviderInfoForRequest(request: NextRequest): LLMProviderInfo | null {
  return getConfiguredLLMProviderForPreference(getLLMPreferenceFromRequest(request))
}
