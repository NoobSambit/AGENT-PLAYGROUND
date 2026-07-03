import { LibraryService, type LibraryContextRequestInput } from '@/lib/services/libraryService'
import type {
  LibraryConsumerMetadata,
  LibraryContextItem,
  LibraryContextPacket,
  LibraryInfluenceTraceItem,
  LibrarySourceType,
} from '@/types/database'

export type LibraryConsumerFeature = Extract<
  LibrarySourceType,
  'chat' | 'creative' | 'journal' | 'profile' | 'challenge' | 'arena' | 'relationship'
>

export interface LibraryConsumerContext {
  consumerFeature: LibraryConsumerFeature
  query?: string
  packet: LibraryContextPacket | null
  promptBlock?: string
  metadata: LibraryConsumerMetadata
  relevanceScores: Record<string, number>
}

interface RequestLibraryConsumerContextInput extends LibraryContextRequestInput {
  agentId: string
  consumerFeature: LibraryConsumerFeature
}

interface RecordLibraryConsumerUsageInput {
  agentId: string
  context: LibraryConsumerContext
  consumerSourceId?: string
}

interface CombinedLibraryPromptBlockEntry {
  label: string
  context: LibraryConsumerContext
}

const TRIVIAL_CHAT_PATTERNS = [
  /^(hi|hello|hey|yo|sup|thanks|thank you|ok|okay|cool|nice|lol|haha)[.!?\s]*$/i,
  /^(good morning|good afternoon|good evening)[.!?\s]*$/i,
]

const MIN_COMBINED_BLOCK_REMAINDER_CHARS = 220

function truncate(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`
}

function toTraceItem(item: LibraryContextItem): LibraryInfluenceTraceItem {
  return {
    id: item.id,
    title: item.title,
    claim: item.claim,
    category: item.category,
    confidence: item.confidence,
    relevanceScore: item.relevanceScore,
    source: item.source,
  }
}

export function shouldRequestLibraryContextForChat(prompt: string): boolean {
  const normalized = prompt.trim()
  if (normalized.length < 32) return false
  if (TRIVIAL_CHAT_PATTERNS.some((pattern) => pattern.test(normalized))) return false

  return normalized.length >= 90 ||
    /\b(remember|prefer|preference|profile|journal|creative|story|relationship|challenge|arena|decision|plan|strategy|analy[sz]e|recommend|compare|why|how should|what should)\b/i.test(normalized)
}

export function buildLibraryPromptBlock(packet: LibraryContextPacket): string | undefined {
  if (packet.status !== 'loaded' || !packet.promptText.trim()) {
    return undefined
  }

  return [
    'Validated Library context, source-backed and lower priority than current direct evidence:',
    packet.promptText,
    'Use this only when it genuinely fits the run. Do not let it override the current prompt, supplied evidence, or explicit workflow constraints.',
  ].join('\n')
}

export function buildCombinedLibraryPromptBlock(
  entries: CombinedLibraryPromptBlockEntry[],
  maxChars: number
): string {
  const blocks: string[] = []
  let usedChars = 0

  for (const entry of entries) {
    if (!entry.context.promptBlock) continue

    const separatorChars = blocks.length > 0 ? 2 : 0
    const remainingChars = maxChars - usedChars - separatorChars
    if (remainingChars < MIN_COMBINED_BLOCK_REMAINDER_CHARS) break

    const rawBlock = `${entry.label} Library context:\n${entry.context.promptBlock}`
    const block = truncate(rawBlock, remainingChars)
    blocks.push(block)
    usedChars += separatorChars + block.length
  }

  return blocks.join('\n\n')
}

export async function requestLibraryConsumerContext(
  input: RequestLibraryConsumerContextInput
): Promise<LibraryConsumerContext> {
  const query = truncate(input.query || '', 500) || undefined

  try {
    const packet = await LibraryService.getContextPacket(input.agentId, {
      query,
      limit: input.limit,
      maxChars: input.maxChars,
      minConfidence: input.minConfidence,
      category: input.category,
      sourceType: input.sourceType,
      scope: input.scope,
    })
    const promptBlock = buildLibraryPromptBlock(packet)
    const traceItems = packet.items.map(toTraceItem)

    return {
      consumerFeature: input.consumerFeature,
      query,
      packet,
      promptBlock,
      relevanceScores: Object.fromEntries(packet.items.map((item) => [item.id, item.relevanceScore])),
      metadata: {
        libraryContextStatus: packet.status,
        libraryContextItemIds: packet.itemIds,
        libraryContextError: packet.error,
        libraryContextItems: traceItems,
      },
    }
  } catch (error) {
    return {
      consumerFeature: input.consumerFeature,
      query,
      packet: null,
      relevanceScores: {},
      metadata: {
        libraryContextStatus: 'failed',
        libraryContextItemIds: [],
        libraryContextError: error instanceof Error ? error.message : 'Library context retrieval failed.',
        libraryContextItems: [],
      },
    }
  }
}

export async function recordLibraryConsumerUsage(
  input: RecordLibraryConsumerUsageInput
): Promise<LibraryConsumerContext> {
  const itemIds = input.context.packet?.itemIds || []
  if (!input.context.promptBlock || itemIds.length === 0) {
    return input.context
  }

  try {
    const usage = await LibraryService.recordUsage(input.agentId, {
      itemIds,
      consumerFeature: input.context.consumerFeature,
      consumerSourceId: input.consumerSourceId,
      query: input.context.query,
      relevanceScores: input.context.relevanceScores,
    })

    return {
      ...input.context,
      metadata: {
        ...input.context.metadata,
        libraryContextItemIds: usage.recordedItemIds.length > 0
          ? usage.recordedItemIds
          : input.context.metadata.libraryContextItemIds,
        libraryUsageRecordedAt: usage.recordedAt,
        libraryContextError: usage.success
          ? input.context.metadata.libraryContextError
          : usage.error || input.context.metadata.libraryContextError,
      },
    }
  } catch (error) {
    return {
      ...input.context,
      metadata: {
        ...input.context.metadata,
        libraryContextError: error instanceof Error ? error.message : 'Library usage recording failed.',
      },
    }
  }
}

export function libraryContextMetadata(
  context: LibraryConsumerContext | undefined
): LibraryConsumerMetadata {
  return context?.metadata || {
    libraryContextStatus: 'skipped',
    libraryContextItemIds: [],
    libraryContextItems: [],
  }
}

export function mergeLibraryContextMetadata(contexts: LibraryConsumerContext[]): LibraryConsumerMetadata {
  const itemIds = [...new Set(contexts.flatMap((context) => context.metadata.libraryContextItemIds || []))]
  const itemsById = new Map<string, LibraryInfluenceTraceItem>()
  for (const context of contexts) {
    for (const item of context.metadata.libraryContextItems || []) {
      itemsById.set(item.id, item)
    }
  }

  const errors = contexts
    .map((context) => context.metadata.libraryContextError)
    .filter((error): error is string => Boolean(error))
  const recordedAt = contexts
    .map((context) => context.metadata.libraryUsageRecordedAt)
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1)
  const statuses = contexts.map((context) => context.metadata.libraryContextStatus || 'skipped')

  return {
    libraryContextStatus: statuses.some((status) => status === 'loaded')
      ? 'loaded'
      : statuses.some((status) => status === 'failed')
        ? 'failed'
        : 'skipped',
    libraryContextItemIds: itemIds,
    libraryContextError: errors.join(' | ') || undefined,
    libraryUsageRecordedAt: recordedAt,
    libraryContextItems: Array.from(itemsById.values()),
  }
}
