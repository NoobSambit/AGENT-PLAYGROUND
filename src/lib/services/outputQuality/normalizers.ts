import type {
  OutputNormalizationParser,
  OutputQualityRawModelOutput,
  OutputQualitySourceRef,
} from '@/types/outputQuality'

export function normalizeWhitespace(value: string): string {
  return value.replace(/\r\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim()
}

export function stripCodeFences(value: string): string {
  return value
    .replace(/^```[a-z0-9_-]*\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()
}

export function extractJsonObject(value: string): string | null {
  const stripped = stripCodeFences(value)
  const objectMatch = stripped.match(/\{[\s\S]*\}/)
  if (objectMatch) return objectMatch[0]

  const arrayMatch = stripped.match(/\[[\s\S]*\]/)
  return arrayMatch?.[0] || null
}

export function safeParseJsonWithExtraction<T>(value: string): {
  parsed: T | null
  parser: OutputNormalizationParser
  parserNotes: string[]
} {
  const parserNotes: string[] = []
  const stripped = stripCodeFences(value)

  try {
    return {
      parsed: JSON.parse(stripped) as T,
      parser: 'strict_json',
      parserNotes,
    }
  } catch {
    parserNotes.push('Strict JSON parse failed; attempting extracted JSON parse.')
  }

  const extracted = extractJsonObject(value)
  if (!extracted) {
    parserNotes.push('No JSON object or array could be extracted from the raw model output.')
    return {
      parsed: null,
      parser: 'direct_text',
      parserNotes,
    }
  }

  try {
    return {
      parsed: JSON.parse(extracted) as T,
      parser: 'extracted_json',
      parserNotes,
    }
  } catch {
    parserNotes.push('Extracted JSON parse failed.')
    return {
      parsed: null,
      parser: 'direct_text',
      parserNotes,
    }
  }
}

export function normalizeStringList(value: unknown, limit = 8): string[] {
  const extractObjectString = (entry: Record<string, unknown>): string => {
    const preferredKeys = [
      'summary',
      'question',
      'title',
      'text',
      'content',
      'note',
      'reason',
      'label',
      'claim',
      'verdict',
      'message',
    ]

    for (const key of preferredKeys) {
      if (typeof entry[key] === 'string' && entry[key].trim()) {
        return entry[key].trim()
      }
    }

    return ''
  }

  if (Array.isArray(value)) {
    return value
      .map((entry) => {
        if (typeof entry === 'string' || typeof entry === 'number' || typeof entry === 'boolean') {
          return String(entry).trim()
        }

        if (entry && typeof entry === 'object') {
          return extractObjectString(entry as Record<string, unknown>)
        }

        return ''
      })
      .filter(Boolean)
      .slice(0, limit)
  }

  if (typeof value === 'string') {
    return value
      .split(/\n|,/g)
      .map((entry) => entry.replace(/^[-*]\s*/, '').trim())
      .filter(Boolean)
      .slice(0, limit)
  }

  return []
}

export function normalizeSourceRefs(value: unknown): OutputQualitySourceRef[] {
  if (!Array.isArray(value)) {
    return []
  }

  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') {
        return null
      }

      const record = entry as Record<string, unknown>
      const id = String(record.id || '').trim()
      const sourceType = String(record.sourceType || '').trim()
      const label = String(record.label || '').trim()
      const reason = String(record.reason || '').trim()
      const linkedEntityId = typeof record.linkedEntityId === 'string'
        ? record.linkedEntityId.trim()
        : undefined

      if (!id || !sourceType || !label || !reason) {
        return null
      }

      return {
        id,
        sourceType,
        label,
        reason,
        linkedEntityId: linkedEntityId || undefined,
      }
    })
    .filter((entry): entry is OutputQualitySourceRef => Boolean(entry))
}

export function createRawModelOutput(
  text: string,
  options?: {
    parserNotes?: string[]
    capturedAt?: string
    responseFormat?: string
    promptVersion?: string
  }
): OutputQualityRawModelOutput {
  return {
    text: text.trim(),
    parserNotes: options?.parserNotes?.filter(Boolean),
    capturedAt: options?.capturedAt,
    responseFormat: options?.responseFormat,
    promptVersion: options?.promptVersion,
  }
}
