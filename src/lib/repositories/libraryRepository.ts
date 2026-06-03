import { and, desc, eq, ilike, inArray, or, sql } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import {
  libraryItemSources,
  libraryItemUsageEvents,
  libraryItemValidations,
  libraryItems,
} from '@/lib/db/schema'
import { asIsoString, generateId } from '@/lib/db/utils'
import type {
  LibraryCategory,
  LibraryItem,
  LibraryItemDetail,
  LibraryItemPayload,
  LibraryItemSource,
  LibraryItemStatus,
  LibraryItemSummary,
  LibraryQualityStatus,
  LibraryScope,
  LibrarySourceRef,
  LibrarySourceType,
  LibraryUsageEvent,
  LibraryValidation,
  LibraryValidationActorType,
  LibraryValidationVerdict,
  LibraryVisibility,
} from '@/types/database'

type LibraryItemRow = typeof libraryItems.$inferSelect
type LibraryItemInsert = typeof libraryItems.$inferInsert
type LibrarySourceRow = typeof libraryItemSources.$inferSelect
type LibrarySourceInsert = typeof libraryItemSources.$inferInsert
type LibraryValidationRow = typeof libraryItemValidations.$inferSelect
type LibraryValidationInsert = typeof libraryItemValidations.$inferInsert
type LibraryUsageEventRow = typeof libraryItemUsageEvents.$inferSelect
type LibraryUsageEventInsert = typeof libraryItemUsageEvents.$inferInsert

export type LibrarySortMode = 'updated' | 'confidence' | 'usage' | 'created'

export interface LibraryListParams {
  agentId?: string
  includeNetwork?: boolean
  status?: LibraryItemStatus | 'all'
  statuses?: LibraryItemStatus[]
  category?: LibraryCategory
  sourceType?: LibrarySourceType
  search?: string
  sort?: LibrarySortMode
  scope?: LibraryScope | 'all'
  limit?: number
  offset?: number
}

export interface LibraryItemLifecycleUpdate {
  title?: string
  claim?: string
  body?: string
  category?: LibraryCategory
  status?: LibraryItemStatus
  confidence?: number
  updatedAt?: string
  tags?: string[]
  relatedAgentIds?: string[]
  usageCount?: number
  lastUsedAt?: string | null
  acceptedAt?: string | null
  acceptedBy?: string | null
  rejectedAt?: string | null
  rejectedBy?: string | null
  retiredAt?: string | null
  retiredBy?: string | null
  supersedesItemId?: string | null
  mergedIntoItemId?: string | null
  payload?: LibraryItemPayload
}

function mapItemRow(row: LibraryItemRow): LibraryItem {
  return {
    id: row.id,
    agentId: row.agentId ?? undefined,
    scope: row.scope as LibraryScope,
    title: row.title,
    claim: row.claim,
    body: row.body,
    category: row.category as LibraryCategory,
    status: row.status as LibraryItemStatus,
    confidence: row.confidence,
    qualityStatus: row.qualityStatus as LibraryQualityStatus,
    visibility: row.visibility as LibraryVisibility,
    createdByAgentId: row.createdByAgentId ?? undefined,
    createdByName: row.createdByName ?? undefined,
    createdFromFeature: row.createdFromFeature,
    primarySourceType: row.primarySourceType,
    primarySourceId: row.primarySourceId,
    tags: row.tags,
    relatedAgentIds: row.relatedAgentIds,
    usageCount: row.usageCount,
    lastUsedAt: row.lastUsedAt ? asIsoString(row.lastUsedAt) : undefined,
    acceptedAt: row.acceptedAt ? asIsoString(row.acceptedAt) : undefined,
    acceptedBy: row.acceptedBy ?? undefined,
    rejectedAt: row.rejectedAt ? asIsoString(row.rejectedAt) : undefined,
    rejectedBy: row.rejectedBy ?? undefined,
    retiredAt: row.retiredAt ? asIsoString(row.retiredAt) : undefined,
    retiredBy: row.retiredBy ?? undefined,
    supersedesItemId: row.supersedesItemId ?? undefined,
    mergedIntoItemId: row.mergedIntoItemId ?? undefined,
    createdAt: asIsoString(row.createdAt),
    updatedAt: asIsoString(row.updatedAt),
    payload: row.payload,
  }
}

function mapSourceRow(row: LibrarySourceRow): LibraryItemSource {
  return {
    id: row.id,
    itemId: row.itemId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    sourceTitle: row.sourceTitle ?? undefined,
    sourceUrl: row.sourceUrl ?? undefined,
    sourceTimestamp: row.sourceTimestamp ? asIsoString(row.sourceTimestamp) : undefined,
    evidenceSummary: row.evidenceSummary,
    quote: row.quote ?? undefined,
    createdAt: asIsoString(row.createdAt),
    payload: row.payload,
  }
}

function mapValidationRow(row: LibraryValidationRow): LibraryValidation {
  return {
    id: row.id,
    itemId: row.itemId,
    actorType: row.actorType as LibraryValidationActorType,
    agentId: row.agentId ?? undefined,
    actorName: row.actorName ?? undefined,
    verdict: row.verdict as LibraryValidationVerdict,
    rationale: row.rationale,
    confidenceDelta: row.confidenceDelta,
    createdAt: asIsoString(row.createdAt),
    payload: row.payload,
  }
}

function mapUsageEventRow(row: LibraryUsageEventRow): LibraryUsageEvent {
  return {
    id: row.id,
    itemId: row.itemId,
    agentId: row.agentId ?? undefined,
    consumerFeature: row.consumerFeature,
    consumerSourceId: row.consumerSourceId ?? undefined,
    query: row.query ?? undefined,
    relevanceScore: row.relevanceScore,
    usedAt: asIsoString(row.usedAt),
    payload: row.payload,
  }
}

function toSummary(item: LibraryItem): LibraryItemSummary {
  return {
    id: item.id,
    agentId: item.agentId,
    scope: item.scope,
    title: item.title,
    claim: item.claim,
    category: item.category,
    status: item.status,
    confidence: item.confidence,
    qualityStatus: item.qualityStatus,
    visibility: item.visibility,
    primarySourceType: item.primarySourceType,
    primarySourceId: item.primarySourceId,
    tags: item.tags,
    relatedAgentIds: item.relatedAgentIds,
    usageCount: item.usageCount,
    lastUsedAt: item.lastUsedAt,
    updatedAt: item.updatedAt,
    createdAt: item.createdAt,
  }
}

function toItemRow(record: LibraryItem): LibraryItemInsert {
  return {
    id: record.id,
    agentId: record.agentId ?? null,
    scope: record.scope,
    title: record.title,
    claim: record.claim,
    body: record.body,
    category: record.category,
    status: record.status,
    confidence: record.confidence,
    qualityStatus: record.qualityStatus,
    visibility: record.visibility,
    createdByAgentId: record.createdByAgentId ?? null,
    createdByName: record.createdByName ?? null,
    createdFromFeature: record.createdFromFeature,
    primarySourceType: record.primarySourceType,
    primarySourceId: record.primarySourceId,
    tags: record.tags,
    relatedAgentIds: record.relatedAgentIds,
    usageCount: record.usageCount,
    lastUsedAt: record.lastUsedAt ? asIsoString(record.lastUsedAt) : null,
    acceptedAt: record.acceptedAt ? asIsoString(record.acceptedAt) : null,
    acceptedBy: record.acceptedBy ?? null,
    rejectedAt: record.rejectedAt ? asIsoString(record.rejectedAt) : null,
    rejectedBy: record.rejectedBy ?? null,
    retiredAt: record.retiredAt ? asIsoString(record.retiredAt) : null,
    retiredBy: record.retiredBy ?? null,
    supersedesItemId: record.supersedesItemId ?? null,
    mergedIntoItemId: record.mergedIntoItemId ?? null,
    createdAt: asIsoString(record.createdAt),
    updatedAt: asIsoString(record.updatedAt),
    payload: record.payload,
  }
}

function toSourceRow(record: LibraryItemSource): LibrarySourceInsert {
  return {
    id: record.id,
    itemId: record.itemId,
    sourceType: record.sourceType,
    sourceId: record.sourceId,
    sourceTitle: record.sourceTitle ?? null,
    sourceUrl: record.sourceUrl ?? null,
    sourceTimestamp: record.sourceTimestamp ? asIsoString(record.sourceTimestamp) : null,
    evidenceSummary: record.evidenceSummary,
    quote: record.quote ?? null,
    createdAt: asIsoString(record.createdAt),
    payload: record.payload,
  }
}

function toValidationRow(record: LibraryValidation): LibraryValidationInsert {
  return {
    id: record.id,
    itemId: record.itemId,
    actorType: record.actorType,
    agentId: record.agentId ?? null,
    actorName: record.actorName ?? null,
    verdict: record.verdict,
    rationale: record.rationale,
    confidenceDelta: record.confidenceDelta,
    createdAt: asIsoString(record.createdAt),
    payload: record.payload,
  }
}

function toUsageEventRow(record: LibraryUsageEvent): LibraryUsageEventInsert {
  return {
    id: record.id,
    itemId: record.itemId,
    agentId: record.agentId ?? null,
    consumerFeature: record.consumerFeature,
    consumerSourceId: record.consumerSourceId ?? null,
    query: record.query ?? null,
    relevanceScore: record.relevanceScore,
    usedAt: asIsoString(record.usedAt),
    payload: record.payload,
  }
}

function sourceFromRef(itemId: string, ref: LibrarySourceRef | LibraryItemSource): LibraryItemSource {
  const now = new Date().toISOString()
  return {
    id: 'id' in ref ? ref.id : generateId('library_source'),
    itemId,
    sourceType: ref.sourceType,
    sourceId: ref.sourceId,
    sourceTitle: ref.sourceTitle,
    sourceUrl: ref.sourceUrl,
    sourceTimestamp: ref.sourceTimestamp,
    evidenceSummary: ref.evidenceSummary,
    quote: ref.quote,
    createdAt: 'createdAt' in ref ? ref.createdAt : now,
    payload: 'payload' in ref ? ref.payload : {},
  }
}

function buildListConditions(params: LibraryListParams) {
  const conditions = []

  if (params.agentId && params.scope !== 'network') {
    conditions.push(params.includeNetwork
      ? or(eq(libraryItems.agentId, params.agentId), eq(libraryItems.scope, 'network'))
      : eq(libraryItems.agentId, params.agentId))
  }

  if (params.scope && params.scope !== 'all') {
    conditions.push(eq(libraryItems.scope, params.scope))
  }

  if (params.status && params.status !== 'all') {
    conditions.push(eq(libraryItems.status, params.status))
  } else if (params.statuses && params.statuses.length > 0) {
    conditions.push(inArray(libraryItems.status, params.statuses))
  }

  if (params.category) {
    conditions.push(eq(libraryItems.category, params.category))
  }

  if (params.sourceType) {
    conditions.push(sql`exists (
      select 1 from ${libraryItemSources}
      where ${libraryItemSources.itemId} = ${libraryItems.id}
      and ${libraryItemSources.sourceType} = ${params.sourceType}
    )`)
  }

  const search = params.search?.trim()
  if (search) {
    const pattern = `%${search}%`
    conditions.push(or(
      ilike(libraryItems.title, pattern),
      ilike(libraryItems.claim, pattern),
      ilike(libraryItems.body, pattern),
      sql`exists (
        select 1 from ${libraryItemSources}
        where ${libraryItemSources.itemId} = ${libraryItems.id}
        and (
          ${libraryItemSources.sourceTitle} ilike ${pattern}
          or ${libraryItemSources.evidenceSummary} ilike ${pattern}
        )
      )`
    ))
  }

  return conditions.length > 0 ? and(...conditions) : undefined
}

function buildOrderBy(sort: LibrarySortMode = 'updated') {
  if (sort === 'confidence') {
    return [desc(libraryItems.confidence), desc(libraryItems.updatedAt)]
  }

  if (sort === 'usage') {
    return [desc(libraryItems.usageCount), desc(libraryItems.updatedAt)]
  }

  if (sort === 'created') {
    return [desc(libraryItems.createdAt)]
  }

  return [desc(libraryItems.updatedAt)]
}

function toLifecycleSet(updates: LibraryItemLifecycleUpdate): Partial<LibraryItemInsert> {
  const set: Partial<LibraryItemInsert> = {
    updatedAt: asIsoString(updates.updatedAt),
  }

  if (updates.title !== undefined) set.title = updates.title
  if (updates.claim !== undefined) set.claim = updates.claim
  if (updates.body !== undefined) set.body = updates.body
  if (updates.category !== undefined) set.category = updates.category
  if (updates.status !== undefined) set.status = updates.status
  if (updates.confidence !== undefined) set.confidence = updates.confidence
  if (updates.tags !== undefined) set.tags = updates.tags
  if (updates.relatedAgentIds !== undefined) set.relatedAgentIds = updates.relatedAgentIds
  if (updates.usageCount !== undefined) set.usageCount = updates.usageCount
  if (updates.lastUsedAt !== undefined) set.lastUsedAt = updates.lastUsedAt ? asIsoString(updates.lastUsedAt) : null
  if (updates.acceptedAt !== undefined) set.acceptedAt = updates.acceptedAt ? asIsoString(updates.acceptedAt) : null
  if (updates.acceptedBy !== undefined) set.acceptedBy = updates.acceptedBy
  if (updates.rejectedAt !== undefined) set.rejectedAt = updates.rejectedAt ? asIsoString(updates.rejectedAt) : null
  if (updates.rejectedBy !== undefined) set.rejectedBy = updates.rejectedBy
  if (updates.retiredAt !== undefined) set.retiredAt = updates.retiredAt ? asIsoString(updates.retiredAt) : null
  if (updates.retiredBy !== undefined) set.retiredBy = updates.retiredBy
  if (updates.supersedesItemId !== undefined) set.supersedesItemId = updates.supersedesItemId
  if (updates.mergedIntoItemId !== undefined) set.mergedIntoItemId = updates.mergedIntoItemId
  if (updates.payload !== undefined) set.payload = updates.payload

  return set
}

export class LibraryRepository {
  static async listItems(params: LibraryListParams = {}): Promise<LibraryItemSummary[]> {
    const rows = await getDb()
      .select()
      .from(libraryItems)
      .where(buildListConditions(params))
      .orderBy(...buildOrderBy(params.sort))
      .limit(params.limit ?? 50)
      .offset(params.offset ?? 0)

    return rows.map(mapItemRow).map(toSummary)
  }

  static async getItem(id: string): Promise<LibraryItem | null> {
    const row = await getDb().query.libraryItems.findFirst({
      where: eq(libraryItems.id, id),
    })
    return row ? mapItemRow(row) : null
  }

  static async getItemDetail(id: string, usageLimit = 20): Promise<LibraryItemDetail | null> {
    const item = await this.getItem(id)
    if (!item) {
      return null
    }

    const [sources, validations, usageEvents] = await Promise.all([
      this.listSources(id),
      this.listValidations(id),
      this.listUsageEvents(id, usageLimit),
    ])

    return {
      item,
      sources,
      validations,
      usageEvents,
    }
  }

  static async insertItemWithSources(params: {
    item: LibraryItem
    sources: Array<LibrarySourceRef | LibraryItemSource>
  }): Promise<LibraryItemDetail> {
    const sourceRecords = params.sources.map((source) => sourceFromRef(params.item.id, source))

    return getDb().transaction(async (tx) => {
      const [itemRow] = await tx
        .insert(libraryItems)
        .values(toItemRow(params.item))
        .returning()

      const sourceRows = sourceRecords.length > 0
        ? await tx
            .insert(libraryItemSources)
            .values(sourceRecords.map(toSourceRow))
            .returning()
        : []

      return {
        item: mapItemRow(itemRow),
        sources: sourceRows.map(mapSourceRow),
        validations: [],
        usageEvents: [],
      }
    })
  }

  static async upsertItem(record: LibraryItem): Promise<LibraryItem> {
    const rowValue = toItemRow(record)
    const [row] = await getDb()
      .insert(libraryItems)
      .values(rowValue)
      .onConflictDoUpdate({
        target: libraryItems.id,
        set: rowValue,
      })
      .returning()

    return mapItemRow(row)
  }

  static async addSource(record: LibraryItemSource): Promise<LibraryItemSource> {
    const [row] = await getDb()
      .insert(libraryItemSources)
      .values(toSourceRow(record))
      .returning()

    return mapSourceRow(row)
  }

  static async listSources(itemId: string): Promise<LibraryItemSource[]> {
    const rows = await getDb().query.libraryItemSources.findMany({
      where: eq(libraryItemSources.itemId, itemId),
      orderBy: (fields, { asc }) => [asc(fields.createdAt)],
    })
    return rows.map(mapSourceRow)
  }

  static async addValidationEvent(record: LibraryValidation): Promise<LibraryValidation> {
    const [row] = await getDb()
      .insert(libraryItemValidations)
      .values(toValidationRow(record))
      .returning()

    return mapValidationRow(row)
  }

  static async listValidations(itemId: string): Promise<LibraryValidation[]> {
    const rows = await getDb().query.libraryItemValidations.findMany({
      where: eq(libraryItemValidations.itemId, itemId),
      orderBy: (fields, { desc: orderDesc }) => [orderDesc(fields.createdAt)],
    })
    return rows.map(mapValidationRow)
  }

  static async updateItemLifecycle(
    id: string,
    updates: LibraryItemLifecycleUpdate
  ): Promise<LibraryItem | null> {
    const [row] = await getDb()
      .update(libraryItems)
      .set(toLifecycleSet(updates))
      .where(eq(libraryItems.id, id))
      .returning()

    return row ? mapItemRow(row) : null
  }

  static async addUsageEvent(record: LibraryUsageEvent): Promise<LibraryUsageEvent> {
    const [row] = await getDb()
      .insert(libraryItemUsageEvents)
      .values(toUsageEventRow(record))
      .returning()

    return mapUsageEventRow(row)
  }

  static async listUsageEvents(itemId: string, limitCount = 20): Promise<LibraryUsageEvent[]> {
    const rows = await getDb().query.libraryItemUsageEvents.findMany({
      where: eq(libraryItemUsageEvents.itemId, itemId),
      orderBy: (fields, { desc: orderDesc }) => [orderDesc(fields.usedAt)],
      limit: limitCount,
    })
    return rows.map(mapUsageEventRow)
  }
}
