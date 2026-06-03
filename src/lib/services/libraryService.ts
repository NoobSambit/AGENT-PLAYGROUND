import { AgentRepository } from '@/lib/repositories/agentRepository'
import {
  LibraryRepository,
  type LibraryListParams,
  type LibrarySortMode,
} from '@/lib/repositories/libraryRepository'
import { asIsoString, generateId } from '@/lib/db/utils'
import type {
  AgentRecord,
  LibraryBootstrapResponse,
  LibraryCategory,
  LibraryContextItem,
  LibraryContextPacket,
  LibraryContextSourceSummary,
  LibraryFilters,
  LibraryItem,
  LibraryItemDetail,
  LibraryItemDetailResponse,
  LibraryItemPayload,
  LibraryItemStatus,
  LibraryMutationResponse,
  LibraryScope,
  LibrarySourceRef,
  LibrarySourceType,
  LibraryStats,
  LibraryUsageEvent,
  LibraryUsageRecordResult,
  LibraryValidation,
  LibraryValidationActorType,
  LibraryValidationVerdict,
  LibraryVisibility,
} from '@/types/database'

export const LIBRARY_STATUSES = ['review', 'validated', 'disputed', 'rejected', 'retired'] as const
export const LIBRARY_CATEGORIES = [
  'fact',
  'preference',
  'behavior_pattern',
  'strength',
  'weakness',
  'strategy',
  'relationship',
  'creative_style',
  'emotional_pattern',
  'skill',
  'risk',
  'lesson',
] as const
export const LIBRARY_SOURCE_TYPES = [
  'manual',
  'chat',
  'memory',
  'emotion',
  'journal',
  'dream',
  'creative',
  'profile',
  'challenge',
  'arena',
  'relationship',
  'learning',
  'scenario',
  'knowledge_graph',
  'collective',
  'mentorship',
  'timeline',
] as const
export const LIBRARY_SCOPES = ['agent', 'network'] as const
export const LIBRARY_VISIBILITIES = ['agent', 'network', 'private'] as const
export const LIBRARY_SORTS = ['updated', 'confidence', 'usage', 'created'] as const

const DEFAULT_CONTEXT_LIMIT = 3
const DEFAULT_CONTEXT_MAX_CHARS = 1200
const DEFAULT_CONTEXT_MIN_CONFIDENCE = 0.55
const MAX_CONTEXT_LIMIT = 10
const MAX_CONTEXT_CHARS = 4000
const MAX_CONTEXT_QUERY_CHARS = 500
const MAX_USAGE_ITEMS = 20

type LibraryAction = 'accept' | 'reject' | 'endorse' | 'dispute' | 'resolve' | 'retire'

export interface LibraryItemEditableFields {
  title: string
  claim: string
  body: string
  category: LibraryCategory
  tags: string[]
  relatedAgentIds: string[]
}

export interface LibraryBootstrapQuery {
  status?: LibraryItemStatus | 'all'
  category?: LibraryCategory
  sourceType?: LibrarySourceType
  search?: string
  sort?: LibrarySortMode
  scope?: LibraryScope | 'all'
  limit?: number
  cursor?: string
}

export interface CreateManualLibraryItemInput {
  title: string
  claim: string
  body: string
  category: LibraryCategory
  status?: 'review' | 'validated'
  scope?: LibraryScope
  visibility?: LibraryVisibility
  tags?: string[]
  relatedAgentIds?: string[]
  sourceRef?: Partial<LibrarySourceRef>
}

export interface LibraryActionInput {
  action: LibraryAction
  actorAgentId?: string
  actorName?: string
  rationale?: string
  editedItem?: Partial<LibraryItemEditableFields>
}

export interface LibraryContextRequestInput {
  query?: string
  limit?: number
  maxChars?: number
  minConfidence?: number
  category?: LibraryCategory
  sourceType?: LibrarySourceType
  scope?: LibraryScope | 'all'
}

export interface LibraryUsageRecordInput {
  itemIds: string[]
  consumerFeature: LibrarySourceType
  consumerSourceId?: string
  query?: string
  relevanceScores?: Record<string, number>
}

export class LibraryServiceError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status: 400 | 404 | 409
  ) {
    super(message)
  }
}

function isNonEmptyString(value: unknown): value is string {
  return typeof value === 'string' && value.trim().length > 0
}

function normalizeText(value: string): string {
  return value.trim()
}

function uniqueStrings(values: string[] | undefined): string[] {
  return [...new Set((values || []).map((value) => value.trim()).filter(Boolean))]
}

function clampConfidence(value: number): number {
  return Math.max(0, Math.min(1, value))
}

function clampInteger(value: number | undefined, fallback: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return fallback
  }

  return Math.min(max, Math.max(min, Math.floor(value as number)))
}

function normalizeOptionalText(value: string | undefined, maxChars = 1000): string | undefined {
  if (!isNonEmptyString(value)) {
    return undefined
  }

  return normalizeText(value).slice(0, maxChars)
}

function truncateText(value: string, maxChars: number): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  if (normalized.length <= maxChars) {
    return normalized
  }

  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`
}

function tokenSet(value: string): Set<string> {
  return new Set(value
    .toLowerCase()
    .replace(/[^a-z0-9\s_-]/g, ' ')
    .split(/\s+/)
    .map((token) => token.trim())
    .filter((token) => token.length > 2))
}

function lexicalOverlap(query: string | undefined, text: string): number {
  if (!query) {
    return 0
  }

  const queryTokens = tokenSet(query)
  const textTokens = tokenSet(text)
  if (queryTokens.size === 0 || textTokens.size === 0) {
    return 0
  }

  let matches = 0
  for (const token of queryTokens) {
    if (textTokens.has(token)) {
      matches += 1
    }
  }

  return matches / queryTokens.size
}

function isValidCategory(value: unknown): value is LibraryCategory {
  return typeof value === 'string' && LIBRARY_CATEGORIES.includes(value as LibraryCategory)
}

function isValidSourceType(value: unknown): value is LibrarySourceType {
  return typeof value === 'string' && LIBRARY_SOURCE_TYPES.includes(value as LibrarySourceType)
}

function isValidScope(value: unknown): value is LibraryScope {
  return typeof value === 'string' && LIBRARY_SCOPES.includes(value as LibraryScope)
}

function isValidVisibility(value: unknown): value is LibraryVisibility {
  return typeof value === 'string' && LIBRARY_VISIBILITIES.includes(value as LibraryVisibility)
}

function assertTransition(condition: boolean, message: string): void {
  if (!condition) {
    throw new LibraryServiceError('invalid_transition', message, 409)
  }
}

function canAccessItem(agentId: string, item: LibraryItem): boolean {
  return item.agentId === agentId ||
    item.scope === 'network' ||
    item.relatedAgentIds.includes(agentId)
}

function canUseItemInPrompt(agentId: string, item: LibraryItem, minConfidence: number): boolean {
  return canAccessItem(agentId, item) &&
    item.status === 'validated' &&
    item.confidence >= minConfidence &&
    item.payload.contextPolicy?.allowPromptUse !== false
}

function primarySourceSummary(detail: LibraryItemDetail): LibraryContextSourceSummary | null {
  const source = detail.sources.find((entry) => (
    entry.sourceType === detail.item.primarySourceType &&
    entry.sourceId === detail.item.primarySourceId
  )) || detail.sources[0]

  if (!source || !isNonEmptyString(source.evidenceSummary)) {
    return null
  }

  return {
    sourceType: source.sourceType,
    sourceId: source.sourceId,
    sourceTitle: source.sourceTitle,
    sourceTimestamp: source.sourceTimestamp,
    evidenceSummary: truncateText(source.evidenceSummary, 360),
  }
}

function relevanceScore(detail: LibraryItemDetail, query: string | undefined): number {
  const searchable = [
    detail.item.title,
    detail.item.claim,
    detail.item.body,
    detail.item.category,
    detail.item.tags.join(' '),
    detail.sources.map((source) => source.evidenceSummary).join(' '),
  ].join(' ')
  const lexical = lexicalOverlap(query, searchable)
  const confidence = detail.item.confidence

  return clampConfidence(query ? (lexical * 0.65) + (confidence * 0.35) : confidence)
}

function makePromptText(params: {
  item: LibraryItem
  source: LibraryContextSourceSummary
  title: string
  claim: string
  bodyExcerpt: string
  relevanceScore: number
}): string {
  const sourceLabel = [
    params.source.sourceTitle,
    `${params.source.sourceType}:${params.source.sourceId}`,
  ].filter(Boolean).join(' | ')

  return [
    `- ${params.title} (${params.item.category}, confidence ${params.item.confidence.toFixed(2)}, relevance ${params.relevanceScore.toFixed(2)})`,
    `  Claim: ${params.claim}`,
    `  Context: ${params.bodyExcerpt}`,
    `  Source: ${sourceLabel}. ${params.source.evidenceSummary}`,
  ].join('\n')
}

function makeContextItem(
  detail: LibraryItemDetail,
  source: LibraryContextSourceSummary,
  score: number,
  remainingChars: number
): LibraryContextItem | null {
  let title = truncateText(detail.item.title, 90)
  let claim = truncateText(detail.item.claim, 260)
  let bodyExcerpt = truncateText(detail.item.body, 420)
  let sourceSummary = source
  let promptText = makePromptText({
    item: detail.item,
    source: sourceSummary,
    title,
    claim,
    bodyExcerpt,
    relevanceScore: score,
  })

  while (promptText.length > remainingChars && bodyExcerpt.length > 120) {
    bodyExcerpt = truncateText(bodyExcerpt, bodyExcerpt.length - 60)
    promptText = makePromptText({
      item: detail.item,
      source: sourceSummary,
      title,
      claim,
      bodyExcerpt,
      relevanceScore: score,
    })
  }

  while (promptText.length > remainingChars && sourceSummary.evidenceSummary.length > 120) {
    sourceSummary = {
      ...sourceSummary,
      evidenceSummary: truncateText(sourceSummary.evidenceSummary, sourceSummary.evidenceSummary.length - 60),
    }
    promptText = makePromptText({
      item: detail.item,
      source: sourceSummary,
      title,
      claim,
      bodyExcerpt,
      relevanceScore: score,
    })
  }

  while (promptText.length > remainingChars && claim.length > 100) {
    claim = truncateText(claim, claim.length - 50)
    promptText = makePromptText({
      item: detail.item,
      source: sourceSummary,
      title,
      claim,
      bodyExcerpt,
      relevanceScore: score,
    })
  }

  while (promptText.length > remainingChars && title.length > 40) {
    title = truncateText(title, title.length - 20)
    promptText = makePromptText({
      item: detail.item,
      source: sourceSummary,
      title,
      claim,
      bodyExcerpt,
      relevanceScore: score,
    })
  }

  if (promptText.length > remainingChars || promptText.length < 80) {
    return null
  }

  return {
    id: detail.item.id,
    title,
    claim,
    bodyExcerpt,
    category: detail.item.category,
    confidence: detail.item.confidence,
    tags: detail.item.tags.slice(0, 8),
    relevanceScore: score,
    source: sourceSummary,
    promptText,
  }
}

function makeFilters(): LibraryFilters {
  return {
    statuses: [...LIBRARY_STATUSES],
    categories: [...LIBRARY_CATEGORIES],
    sourceTypes: [...LIBRARY_SOURCE_TYPES],
  }
}

function defaultCategoryCounts(): Record<LibraryCategory, number> {
  return Object.fromEntries(LIBRARY_CATEGORIES.map((category) => [category, 0])) as Record<LibraryCategory, number>
}

function defaultSourceCounts(): Record<LibrarySourceType, number> {
  return Object.fromEntries(LIBRARY_SOURCE_TYPES.map((sourceType) => [sourceType, 0])) as Record<LibrarySourceType, number>
}

function buildManualSourceRef(
  agent: AgentRecord,
  itemId: string,
  input: CreateManualLibraryItemInput
): LibrarySourceRef {
  const sourceType = input.sourceRef?.sourceType && isValidSourceType(input.sourceRef.sourceType)
    ? input.sourceRef.sourceType
    : 'manual'

  return {
    sourceType,
    sourceId: isNonEmptyString(input.sourceRef?.sourceId)
      ? normalizeText(input.sourceRef.sourceId)
      : itemId,
    sourceTitle: isNonEmptyString(input.sourceRef?.sourceTitle)
      ? normalizeText(input.sourceRef.sourceTitle)
      : `Manual note by ${agent.name}`,
    sourceUrl: isNonEmptyString(input.sourceRef?.sourceUrl)
      ? normalizeText(input.sourceRef.sourceUrl)
      : undefined,
    sourceTimestamp: isNonEmptyString(input.sourceRef?.sourceTimestamp)
      ? asIsoString(input.sourceRef.sourceTimestamp)
      : new Date().toISOString(),
    evidenceSummary: isNonEmptyString(input.sourceRef?.evidenceSummary)
      ? normalizeText(input.sourceRef.evidenceSummary)
      : 'Manually entered by the operator from the Library workspace.',
    quote: isNonEmptyString(input.sourceRef?.quote)
      ? normalizeText(input.sourceRef.quote)
      : undefined,
  }
}

function makeValidation(params: {
  itemId: string
  verdict: LibraryValidationVerdict
  actorType?: LibraryValidationActorType
  agentId?: string
  actorName?: string
  rationale: string
  confidenceDelta?: number
}): LibraryValidation {
  return {
    id: generateId('library_validation'),
    itemId: params.itemId,
    actorType: params.actorType || 'user',
    agentId: params.agentId,
    actorName: params.actorName,
    verdict: params.verdict,
    rationale: params.rationale,
    confidenceDelta: params.confidenceDelta ?? 0,
    createdAt: new Date().toISOString(),
    payload: {},
  }
}

function applyConfidenceDelta(item: LibraryItem, delta: number): number {
  return clampConfidence(item.confidence + delta)
}

function requireRationale(action: LibraryAction, rationale: string | undefined): string {
  if (!isNonEmptyString(rationale)) {
    throw new LibraryServiceError(
      'validation_error',
      `${action} requires a rationale`,
      400
    )
  }

  return normalizeText(rationale)
}

function validateManualInput(input: CreateManualLibraryItemInput): void {
  if (!isNonEmptyString(input.title)) {
    throw new LibraryServiceError('validation_error', 'title is required', 400)
  }
  if (!isNonEmptyString(input.claim)) {
    throw new LibraryServiceError('validation_error', 'claim is required', 400)
  }
  if (!isNonEmptyString(input.body)) {
    throw new LibraryServiceError('validation_error', 'body is required', 400)
  }
  if (!isValidCategory(input.category)) {
    throw new LibraryServiceError('validation_error', 'category is invalid', 400)
  }
  if (input.status !== undefined && input.status !== 'review' && input.status !== 'validated') {
    throw new LibraryServiceError('validation_error', 'status must be review or validated', 400)
  }
  if (input.scope !== undefined && !isValidScope(input.scope)) {
    throw new LibraryServiceError('validation_error', 'scope is invalid', 400)
  }
  if (input.visibility !== undefined && !isValidVisibility(input.visibility)) {
    throw new LibraryServiceError('validation_error', 'visibility is invalid', 400)
  }
}

function normalizeEditedItem(
  editedItem: Partial<LibraryItemEditableFields> | undefined
): Partial<LibraryItemEditableFields> | undefined {
  if (!editedItem) {
    return undefined
  }

  const normalized: Partial<LibraryItemEditableFields> = {}

  if (editedItem.title !== undefined) {
    if (!isNonEmptyString(editedItem.title)) {
      throw new LibraryServiceError('validation_error', 'edited title is required', 400)
    }
    normalized.title = normalizeText(editedItem.title)
  }

  if (editedItem.claim !== undefined) {
    if (!isNonEmptyString(editedItem.claim)) {
      throw new LibraryServiceError('validation_error', 'edited claim is required', 400)
    }
    normalized.claim = normalizeText(editedItem.claim)
  }

  if (editedItem.body !== undefined) {
    if (!isNonEmptyString(editedItem.body)) {
      throw new LibraryServiceError('validation_error', 'edited body is required', 400)
    }
    normalized.body = normalizeText(editedItem.body)
  }

  if (editedItem.category !== undefined) {
    if (!isValidCategory(editedItem.category)) {
      throw new LibraryServiceError('validation_error', 'edited category is invalid', 400)
    }
    normalized.category = editedItem.category
  }

  if (editedItem.tags !== undefined) {
    if (!Array.isArray(editedItem.tags)) {
      throw new LibraryServiceError('validation_error', 'edited tags must be an array', 400)
    }
    normalized.tags = uniqueStrings(editedItem.tags.filter((value): value is string => typeof value === 'string'))
  }

  if (editedItem.relatedAgentIds !== undefined) {
    if (!Array.isArray(editedItem.relatedAgentIds)) {
      throw new LibraryServiceError('validation_error', 'edited relatedAgentIds must be an array', 400)
    }
    normalized.relatedAgentIds = uniqueStrings(editedItem.relatedAgentIds.filter((value): value is string => typeof value === 'string'))
  }

  return normalized
}

export class LibraryService {
  static async bootstrapWorkspace(
    agentId: string,
    query: LibraryBootstrapQuery = {}
  ): Promise<LibraryBootstrapResponse> {
    const agent = await this.requireAgent(agentId)
    const listParams = this.toListParams(agentId, query)
    const items = await LibraryRepository.listItems(listParams)
    const selectedSummary = items[0]
    const selectedItem = selectedSummary
      ? await this.getItemDetail(agentId, selectedSummary.id)
      : undefined

    return {
      agent: {
        id: agent.id,
        name: agent.name,
      },
      items,
      selectedItem: selectedItem?.item ? {
        item: selectedItem.item,
        sources: selectedItem.sources,
        validations: selectedItem.validations,
        usageEvents: selectedItem.usageEvents,
      } : undefined,
      stats: await this.calculateStats(agentId),
      filters: makeFilters(),
      stale: false,
    }
  }

  static async createManualItem(
    agentId: string,
    input: CreateManualLibraryItemInput
  ): Promise<LibraryMutationResponse> {
    const agent = await this.requireAgent(agentId)
    validateManualInput(input)

    const now = new Date().toISOString()
    const itemId = generateId('library_item')
    const status = input.status || 'review'
    const sourceRef = buildManualSourceRef(agent, itemId, input)
    const payload: LibraryItemPayload = {
      extraction: {
        extractor: 'manual',
      },
      validation: {
        errors: [],
        warnings: [],
        checkedAt: now,
      },
      contextPolicy: {
        allowPromptUse: status === 'validated',
        maxPromptChars: 1200,
      },
    }

    const item: LibraryItem = {
      id: itemId,
      agentId,
      scope: input.scope || 'agent',
      title: normalizeText(input.title),
      claim: normalizeText(input.claim),
      body: normalizeText(input.body),
      category: input.category,
      status,
      confidence: status === 'validated' ? 0.85 : 0.55,
      qualityStatus: status === 'validated' ? 'passed' : 'pending',
      visibility: input.visibility || 'agent',
      createdByAgentId: agent.id,
      createdByName: agent.name,
      createdFromFeature: 'manual',
      primarySourceType: sourceRef.sourceType,
      primarySourceId: sourceRef.sourceId,
      tags: uniqueStrings(input.tags),
      relatedAgentIds: uniqueStrings(input.relatedAgentIds),
      usageCount: 0,
      createdAt: now,
      updatedAt: now,
      payload,
    }

    const detail = await LibraryRepository.insertItemWithSources({
      item,
      sources: [sourceRef],
    })

    if (status === 'validated') {
      const validation = await LibraryRepository.addValidationEvent(makeValidation({
        itemId,
        verdict: 'accept',
        agentId: agent.id,
        actorName: agent.name,
        rationale: 'Manual trusted create.',
        confidenceDelta: 0.3,
      }))
      detail.validations = [validation]
    }

    return {
      success: true,
      item: this.toDetailResponse(detail),
      stats: await this.calculateStats(agentId),
    }
  }

  static async getItemDetail(agentId: string, itemId: string): Promise<LibraryItemDetailResponse | null> {
    await this.requireAgent(agentId)
    const detail = await LibraryRepository.getItemDetail(itemId)

    if (!detail || !canAccessItem(agentId, detail.item)) {
      return null
    }

    return this.toDetailResponse(detail)
  }

  static async getContextPacket(
    agentId: string,
    input: LibraryContextRequestInput = {}
  ): Promise<LibraryContextPacket> {
    const agent = await this.requireAgent(agentId)
    const limit = clampInteger(input.limit, DEFAULT_CONTEXT_LIMIT, 1, MAX_CONTEXT_LIMIT)
    const maxChars = clampInteger(input.maxChars, DEFAULT_CONTEXT_MAX_CHARS, 200, MAX_CONTEXT_CHARS)
    const minConfidence = clampConfidence(
      typeof input.minConfidence === 'number' && Number.isFinite(input.minConfidence)
        ? input.minConfidence
        : DEFAULT_CONTEXT_MIN_CONFIDENCE
    )
    const query = normalizeOptionalText(input.query, MAX_CONTEXT_QUERY_CHARS)

    if (input.category !== undefined && !isValidCategory(input.category)) {
      throw new LibraryServiceError('validation_error', 'category is invalid', 400)
    }
    if (input.sourceType !== undefined && !isValidSourceType(input.sourceType)) {
      throw new LibraryServiceError('validation_error', 'sourceType is invalid', 400)
    }
    if (input.scope !== undefined && input.scope !== 'all' && !isValidScope(input.scope)) {
      throw new LibraryServiceError('validation_error', 'scope is invalid', 400)
    }

    const limits = {
      limit,
      maxChars,
      minConfidence,
      status: 'validated' as const,
    }

    try {
      const summaries = await LibraryRepository.listItems({
        agentId,
        includeNetwork: true,
        status: 'validated',
        category: input.category,
        sourceType: input.sourceType,
        search: query,
        sort: 'confidence',
        scope: input.scope || 'all',
        minConfidence,
        limit: Math.min(100, Math.max(20, limit * 8)),
      })
      const details = (await Promise.all(summaries.map((summary) => LibraryRepository.getItemDetail(summary.id))))
        .filter((detail): detail is LibraryItemDetail => Boolean(detail))
        .filter((detail) => canUseItemInPrompt(agentId, detail.item, minConfidence))
        .map((detail) => ({
          detail,
          source: primarySourceSummary(detail),
          score: relevanceScore(detail, query),
        }))
        .filter((entry): entry is { detail: LibraryItemDetail; source: LibraryContextSourceSummary; score: number } => Boolean(entry.source))
        .sort((left, right) => {
          const byRelevance = right.score - left.score
          return byRelevance !== 0 ? byRelevance : right.detail.item.confidence - left.detail.item.confidence
        })

      const items: LibraryContextItem[] = []
      const promptBlocks: string[] = []
      let usedChars = 0

      for (const entry of details) {
        if (items.length >= limit) {
          break
        }

        const separatorChars = promptBlocks.length > 0 ? 2 : 0
        const remainingChars = maxChars - usedChars - separatorChars
        if (remainingChars < 120) {
          break
        }

        const item = makeContextItem(entry.detail, entry.source, entry.score, remainingChars)
        if (!item) {
          continue
        }

        items.push(item)
        promptBlocks.push(item.promptText)
        usedChars += item.promptText.length + separatorChars
      }

      const promptText = promptBlocks.join('\n\n')
      return {
        agentId: agent.id,
        status: items.length > 0 ? 'loaded' : 'skipped',
        query,
        items,
        itemIds: items.map((item) => item.id),
        promptText,
        totalChars: promptText.length,
        limits,
        skippedReason: items.length > 0 ? undefined : 'no_validated_context',
      }
    } catch {
      return {
        agentId: agent.id,
        status: 'failed',
        query,
        items: [],
        itemIds: [],
        promptText: '',
        totalChars: 0,
        limits,
        error: 'Library context retrieval failed.',
      }
    }
  }

  static async recordUsage(
    agentId: string,
    input: LibraryUsageRecordInput
  ): Promise<LibraryUsageRecordResult> {
    const agent = await this.requireAgent(agentId)
    if (!Array.isArray(input.itemIds) || input.itemIds.length === 0) {
      throw new LibraryServiceError('validation_error', 'itemIds must include at least one item id', 400)
    }
    if (!isValidSourceType(input.consumerFeature)) {
      throw new LibraryServiceError('validation_error', 'consumerFeature is invalid', 400)
    }

    const itemIds = [...new Set(input.itemIds
      .filter((itemId): itemId is string => typeof itemId === 'string')
      .map((itemId) => itemId.trim())
      .filter(Boolean))]
      .slice(0, MAX_USAGE_ITEMS)
    const query = normalizeOptionalText(input.query, MAX_CONTEXT_QUERY_CHARS)
    const consumerSourceId = normalizeOptionalText(input.consumerSourceId, 200)

    if (itemIds.length === 0) {
      throw new LibraryServiceError('validation_error', 'itemIds must include at least one item id', 400)
    }

    try {
      const items = await LibraryRepository.listItemsByIds(itemIds)
      const recordable = items.filter((item) => canUseItemInPrompt(agent.id, item, 0))
      const now = new Date().toISOString()
      const records: LibraryUsageEvent[] = recordable.map((item) => ({
        id: generateId('library_usage'),
        itemId: item.id,
        agentId: agent.id,
        consumerFeature: input.consumerFeature,
        consumerSourceId,
        query,
        relevanceScore: clampConfidence(input.relevanceScores?.[item.id] ?? 0),
        usedAt: now,
        payload: {},
      }))
      const usageEvents = await LibraryRepository.recordUsageEvents(records)
      const recordedItemIds = usageEvents.map((event) => event.itemId)

      return {
        success: true,
        recordedItemIds,
        skippedItemIds: itemIds.filter((itemId) => !recordedItemIds.includes(itemId)),
        usageEvents,
        recordedAt: usageEvents.length > 0 ? now : undefined,
      }
    } catch {
      return {
        success: false,
        recordedItemIds: [],
        skippedItemIds: itemIds,
        usageEvents: [],
        error: 'Library usage recording failed.',
      }
    }
  }

  static async acceptReviewItem(agentId: string, itemId: string, input: LibraryActionInput = { action: 'accept' }): Promise<LibraryMutationResponse> {
    const detail = await this.requireAccessibleDetail(agentId, itemId)
    assertTransition(detail.item.status === 'review', 'Only review items can be accepted.')
    const now = new Date().toISOString()
    const rationale = isNonEmptyString(input.rationale) ? normalizeText(input.rationale) : 'Accepted from Library review.'
    const editedItem = normalizeEditedItem(input.editedItem)

    await LibraryRepository.addValidationEvent(makeValidation({
      itemId,
      verdict: 'accept',
      agentId: input.actorAgentId || agentId,
      actorName: input.actorName,
      rationale,
      confidenceDelta: 0.25,
    }))

    await LibraryRepository.updateItemLifecycle(itemId, {
      ...editedItem,
      status: 'validated',
      confidence: clampConfidence(Math.max(detail.item.confidence, 0.7)),
      acceptedAt: now,
      acceptedBy: input.actorName || input.actorAgentId || agentId,
      updatedAt: now,
      payload: {
        ...detail.item.payload,
        contextPolicy: {
          ...detail.item.payload.contextPolicy,
          allowPromptUse: true,
        },
      },
    })

    return this.mutationResponse(agentId, itemId)
  }

  static async rejectReviewItem(agentId: string, itemId: string, input: LibraryActionInput): Promise<LibraryMutationResponse> {
    const detail = await this.requireAccessibleDetail(agentId, itemId)
    assertTransition(detail.item.status === 'review', 'Only review items can be rejected.')
    const now = new Date().toISOString()
    const rationale = requireRationale('reject', input.rationale)

    await LibraryRepository.addValidationEvent(makeValidation({
      itemId,
      verdict: 'reject',
      agentId: input.actorAgentId || agentId,
      actorName: input.actorName,
      rationale,
      confidenceDelta: -detail.item.confidence,
    }))

    await LibraryRepository.updateItemLifecycle(itemId, {
      status: 'rejected',
      confidence: 0,
      rejectedAt: now,
      rejectedBy: input.actorName || input.actorAgentId || agentId,
      updatedAt: now,
      payload: {
        ...detail.item.payload,
        contextPolicy: {
          ...detail.item.payload.contextPolicy,
          allowPromptUse: false,
        },
      },
    })

    return this.mutationResponse(agentId, itemId)
  }

  static async endorseItem(agentId: string, itemId: string, input: LibraryActionInput = { action: 'endorse' }): Promise<LibraryMutationResponse> {
    const detail = await this.requireAccessibleDetail(agentId, itemId)
    assertTransition(
      detail.item.status === 'validated',
      'Only validated items can be endorsed.'
    )

    await LibraryRepository.addValidationEvent(makeValidation({
      itemId,
      verdict: 'endorse',
      actorType: input.actorAgentId ? 'agent' : 'user',
      agentId: input.actorAgentId || agentId,
      actorName: input.actorName,
      rationale: isNonEmptyString(input.rationale) ? normalizeText(input.rationale) : 'Endorsed from Library workspace.',
      confidenceDelta: 0.05,
    }))

    await LibraryRepository.updateItemLifecycle(itemId, {
      confidence: applyConfidenceDelta(detail.item, 0.05),
      updatedAt: new Date().toISOString(),
    })

    return this.mutationResponse(agentId, itemId)
  }

  static async disputeItem(agentId: string, itemId: string, input: LibraryActionInput): Promise<LibraryMutationResponse> {
    const detail = await this.requireAccessibleDetail(agentId, itemId)
    assertTransition(
      detail.item.status === 'review' || detail.item.status === 'validated',
      'Only review or validated items can be disputed.'
    )
    const rationale = requireRationale('dispute', input.rationale)

    await LibraryRepository.addValidationEvent(makeValidation({
      itemId,
      verdict: 'dispute',
      actorType: input.actorAgentId ? 'agent' : 'user',
      agentId: input.actorAgentId || agentId,
      actorName: input.actorName,
      rationale,
      confidenceDelta: -0.08,
    }))

    await LibraryRepository.updateItemLifecycle(itemId, {
      status: 'disputed',
      confidence: applyConfidenceDelta(detail.item, -0.08),
      updatedAt: new Date().toISOString(),
      payload: {
        ...detail.item.payload,
        contextPolicy: {
          ...detail.item.payload.contextPolicy,
          allowPromptUse: false,
        },
      },
    })

    return this.mutationResponse(agentId, itemId)
  }

  static async resolveDispute(agentId: string, itemId: string, input: LibraryActionInput): Promise<LibraryMutationResponse> {
    const detail = await this.requireAccessibleDetail(agentId, itemId)
    assertTransition(detail.item.status === 'disputed', 'Only disputed items can be resolved.')
    const rationale = requireRationale('resolve', input.rationale)

    await LibraryRepository.addValidationEvent(makeValidation({
      itemId,
      verdict: 'resolve',
      agentId: input.actorAgentId || agentId,
      actorName: input.actorName,
      rationale,
      confidenceDelta: 0.05,
    }))

    await LibraryRepository.updateItemLifecycle(itemId, {
      status: 'validated',
      confidence: applyConfidenceDelta(detail.item, 0.05),
      acceptedAt: new Date().toISOString(),
      acceptedBy: input.actorName || input.actorAgentId || agentId,
      updatedAt: new Date().toISOString(),
      payload: {
        ...detail.item.payload,
        contextPolicy: {
          ...detail.item.payload.contextPolicy,
          allowPromptUse: true,
        },
      },
    })

    return this.mutationResponse(agentId, itemId)
  }

  static async retireItem(agentId: string, itemId: string, input: LibraryActionInput): Promise<LibraryMutationResponse> {
    const detail = await this.requireAccessibleDetail(agentId, itemId)
    assertTransition(
      detail.item.status === 'validated' || detail.item.status === 'disputed',
      'Only validated or disputed items can be retired.'
    )
    const rationale = requireRationale('retire', input.rationale)
    const now = new Date().toISOString()

    await LibraryRepository.addValidationEvent(makeValidation({
      itemId,
      verdict: 'retire',
      agentId: input.actorAgentId || agentId,
      actorName: input.actorName,
      rationale,
      confidenceDelta: 0,
    }))

    await LibraryRepository.updateItemLifecycle(itemId, {
      status: 'retired',
      retiredAt: now,
      retiredBy: input.actorName || input.actorAgentId || agentId,
      updatedAt: now,
      payload: {
        ...detail.item.payload,
        contextPolicy: {
          ...detail.item.payload.contextPolicy,
          allowPromptUse: false,
        },
      },
    })

    return this.mutationResponse(agentId, itemId)
  }

  static async runAction(agentId: string, itemId: string, input: LibraryActionInput): Promise<LibraryMutationResponse> {
    if (input.action === 'accept') return this.acceptReviewItem(agentId, itemId, input)
    if (input.action === 'reject') return this.rejectReviewItem(agentId, itemId, input)
    if (input.action === 'endorse') return this.endorseItem(agentId, itemId, input)
    if (input.action === 'dispute') return this.disputeItem(agentId, itemId, input)
    if (input.action === 'resolve') return this.resolveDispute(agentId, itemId, input)
    if (input.action === 'retire') return this.retireItem(agentId, itemId, input)

    throw new LibraryServiceError('validation_error', 'Invalid action', 400)
  }

  static async calculateStats(agentId: string): Promise<LibraryStats> {
    const items = await LibraryRepository.listItems({
      agentId,
      includeNetwork: true,
      status: 'all',
      scope: 'all',
      limit: 5000,
    })
    const byCategory = defaultCategoryCounts()
    const bySourceType = defaultSourceCounts()
    const weekAgo = Date.now() - 7 * 24 * 60 * 60 * 1000
    let confidenceTotal = 0
    let usedThisWeek = 0

    const stats: LibraryStats = {
      total: items.length,
      review: 0,
      validated: 0,
      disputed: 0,
      rejected: 0,
      retired: 0,
      usedThisWeek: 0,
      averageConfidence: 0,
      byCategory,
      bySourceType,
    }

    for (const item of items) {
      stats[item.status] += 1
      byCategory[item.category] += 1
      bySourceType[item.primarySourceType] += 1
      confidenceTotal += item.confidence

      if (item.lastUsedAt && new Date(item.lastUsedAt).getTime() >= weekAgo) {
        usedThisWeek += 1
      }
    }

    stats.usedThisWeek = usedThisWeek
    stats.averageConfidence = items.length > 0 ? confidenceTotal / items.length : 0
    return stats
  }

  private static async requireAgent(agentId: string): Promise<AgentRecord> {
    if (!isNonEmptyString(agentId)) {
      throw new LibraryServiceError('validation_error', 'agent id is required', 400)
    }

    const agent = await AgentRepository.getById(agentId)
    if (!agent) {
      throw new LibraryServiceError('not_found', 'Agent not found', 404)
    }

    return agent
  }

  private static toListParams(agentId: string, query: LibraryBootstrapQuery): LibraryListParams {
    const offset = query.cursor && /^\d+$/.test(query.cursor) ? Number(query.cursor) : 0
    return {
      agentId,
      includeNetwork: true,
      status: query.status || 'all',
      category: query.category,
      sourceType: query.sourceType,
      search: query.search,
      sort: query.sort || 'updated',
      scope: query.scope || 'all',
      limit: Math.min(Math.max(query.limit || 25, 1), 100),
      offset,
    }
  }

  private static async requireAccessibleDetail(agentId: string, itemId: string): Promise<LibraryItemDetail> {
    await this.requireAgent(agentId)
    if (!isNonEmptyString(itemId)) {
      throw new LibraryServiceError('validation_error', 'item id is required', 400)
    }

    const detail = await LibraryRepository.getItemDetail(itemId)
    if (!detail || !canAccessItem(agentId, detail.item)) {
      throw new LibraryServiceError('not_found', 'Library item not found', 404)
    }

    return detail
  }

  private static toDetailResponse(detail: LibraryItemDetail): LibraryItemDetailResponse {
    return {
      item: detail.item,
      sources: detail.sources,
      validations: detail.validations,
      usageEvents: detail.usageEvents,
      relatedItems: [],
    }
  }

  private static async mutationResponse(agentId: string, itemId: string): Promise<LibraryMutationResponse> {
    const detail = await this.getItemDetail(agentId, itemId)
    if (!detail) {
      throw new LibraryServiceError('not_found', 'Library item not found', 404)
    }

    return {
      success: true,
      item: detail,
      stats: await this.calculateStats(agentId),
    }
  }
}
