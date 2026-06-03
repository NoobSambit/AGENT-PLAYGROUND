import { NextRequest, NextResponse } from 'next/server'
import {
  LIBRARY_CATEGORIES,
  LIBRARY_SCOPES,
  LIBRARY_SORTS,
  LIBRARY_SOURCE_TYPES,
  LIBRARY_STATUSES,
  LibraryServiceError,
  type CreateManualLibraryItemInput,
  type LibraryActionInput,
  type LibraryBootstrapQuery,
  type LibraryItemEditableFields,
} from '@/lib/services/libraryService'

type ErrorCode = 'validation_error' | 'not_found' | 'invalid_transition' | 'internal_error'

export function errorResponse(code: ErrorCode, message: string, status: 400 | 404 | 409 | 500) {
  return NextResponse.json(
    {
      error: {
        code,
        message,
      },
    },
    { status }
  )
}

export function handleLibraryError(error: unknown, fallbackMessage: string) {
  if (error instanceof LibraryServiceError) {
    return errorResponse(error.code as ErrorCode, error.message, error.status)
  }

  console.error(fallbackMessage, error)
  return errorResponse('internal_error', fallbackMessage, 500)
}

export async function readJsonBody(request: NextRequest): Promise<unknown> {
  try {
    return await request.json()
  } catch {
    throw new LibraryServiceError('validation_error', 'Request body must be valid JSON', 400)
  }
}

export function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new LibraryServiceError('validation_error', 'Request body must be an object', 400)
  }

  return value as Record<string, unknown>
}

export function parseBootstrapQuery(request: NextRequest): LibraryBootstrapQuery {
  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const category = searchParams.get('category')
  const sourceType = searchParams.get('sourceType')
  const sort = searchParams.get('sort')
  const scope = searchParams.get('scope')
  const limitParam = searchParams.get('limit')
  const cursor = searchParams.get('cursor') || undefined

  if (status && status !== 'all' && !LIBRARY_STATUSES.includes(status as typeof LIBRARY_STATUSES[number])) {
    throw new LibraryServiceError('validation_error', 'status is invalid', 400)
  }

  if (category && !LIBRARY_CATEGORIES.includes(category as typeof LIBRARY_CATEGORIES[number])) {
    throw new LibraryServiceError('validation_error', 'category is invalid', 400)
  }

  if (sourceType && !LIBRARY_SOURCE_TYPES.includes(sourceType as typeof LIBRARY_SOURCE_TYPES[number])) {
    throw new LibraryServiceError('validation_error', 'sourceType is invalid', 400)
  }

  if (sort && !LIBRARY_SORTS.includes(sort as typeof LIBRARY_SORTS[number])) {
    throw new LibraryServiceError('validation_error', 'sort is invalid', 400)
  }

  if (scope && scope !== 'all' && !LIBRARY_SCOPES.includes(scope as typeof LIBRARY_SCOPES[number])) {
    throw new LibraryServiceError('validation_error', 'scope is invalid', 400)
  }

  const limit = limitParam ? Number(limitParam) : undefined
  if (limitParam && (!Number.isInteger(limit) || Number(limit) < 1)) {
    throw new LibraryServiceError('validation_error', 'limit must be a positive integer', 400)
  }

  if (cursor && !/^\d+$/.test(cursor)) {
    throw new LibraryServiceError('validation_error', 'cursor must be a numeric offset token', 400)
  }

  return {
    status: (status || undefined) as LibraryBootstrapQuery['status'],
    category: (category || undefined) as LibraryBootstrapQuery['category'],
    sourceType: (sourceType || undefined) as LibraryBootstrapQuery['sourceType'],
    search: searchParams.get('search') || undefined,
    sort: (sort || undefined) as LibraryBootstrapQuery['sort'],
    scope: (scope || undefined) as LibraryBootstrapQuery['scope'],
    limit,
    cursor,
  }
}

export function parseCreateManualBody(value: unknown): CreateManualLibraryItemInput {
  const body = asRecord(value)

  return {
    title: body.title as string,
    claim: body.claim as string,
    body: body.body as string,
    category: body.category as CreateManualLibraryItemInput['category'],
    status: body.status as CreateManualLibraryItemInput['status'],
    scope: body.scope as CreateManualLibraryItemInput['scope'],
    visibility: body.visibility as CreateManualLibraryItemInput['visibility'],
    tags: Array.isArray(body.tags) ? body.tags.filter((tag): tag is string => typeof tag === 'string') : undefined,
    relatedAgentIds: Array.isArray(body.relatedAgentIds)
      ? body.relatedAgentIds.filter((id): id is string => typeof id === 'string')
      : undefined,
    sourceRef: body.sourceRef && typeof body.sourceRef === 'object' && !Array.isArray(body.sourceRef)
      ? body.sourceRef as CreateManualLibraryItemInput['sourceRef']
      : undefined,
  }
}

export function parseActionBody(value: unknown): LibraryActionInput {
  const body = asRecord(value)
  const action = body.action
  const editedItem = body.editedItem && typeof body.editedItem === 'object' && !Array.isArray(body.editedItem)
    ? body.editedItem as Partial<LibraryItemEditableFields>
    : undefined

  if (
    action !== 'accept' &&
    action !== 'reject' &&
    action !== 'endorse' &&
    action !== 'dispute' &&
    action !== 'resolve' &&
    action !== 'retire'
  ) {
    throw new LibraryServiceError('validation_error', 'action is invalid', 400)
  }

  return {
    action,
    actorAgentId: typeof body.actorAgentId === 'string' ? body.actorAgentId : undefined,
    actorName: typeof body.actorName === 'string' ? body.actorName : undefined,
    rationale: typeof body.rationale === 'string' ? body.rationale : undefined,
    editedItem,
  }
}
