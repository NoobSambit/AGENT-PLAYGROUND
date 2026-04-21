import { getOllamaBaseUrl, type LLMProviderInfo } from '@/lib/llmConfig'

interface OllamaTagResponse {
  models?: Array<{
    name?: string
    model?: string
  }>
}

function normalizeModelName(value: string): string {
  return value.trim().toLowerCase()
}

function stripTag(value: string): string {
  return normalizeModelName(value).split(':')[0]
}

function findMatchingModel(requestedModel: string, availableModels: string[]): string | null {
  const normalizedRequested = normalizeModelName(requestedModel)
  const requestedBase = stripTag(requestedModel)

  for (const model of availableModels) {
    if (normalizeModelName(model) === normalizedRequested) {
      return model
    }
  }

  for (const model of availableModels) {
    if (stripTag(model) === requestedBase) {
      return model
    }
  }

  return null
}

export async function listOllamaModels(): Promise<string[]> {
  try {
    const response = await fetch(`${getOllamaBaseUrl()}/api/tags`, {
      method: 'GET',
      cache: 'no-store',
    })

    if (!response.ok) {
      return []
    }

    const data = await response.json() as OllamaTagResponse
    if (!Array.isArray(data.models)) {
      return []
    }

    return data.models
      .map((entry) => String(entry.name || entry.model || '').trim())
      .filter(Boolean)
  } catch {
    return []
  }
}

export async function resolveOllamaModel(requestedModel: string): Promise<string> {
  const availableModels = await listOllamaModels()
  if (availableModels.length === 0) {
    return requestedModel
  }

  return findMatchingModel(requestedModel, availableModels) || availableModels[0]
}

export async function resolveProviderInfoModel(providerInfo: LLMProviderInfo): Promise<LLMProviderInfo> {
  if (providerInfo.provider !== 'ollama') {
    return providerInfo
  }

  return {
    ...providerInfo,
    model: await resolveOllamaModel(providerInfo.model),
  }
}
