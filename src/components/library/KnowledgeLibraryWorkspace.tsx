'use client'

import {
  AlertCircle,
  Archive,
  BookOpenCheck,
  Check,
  Clock3,
  Edit3,
  FileText,
  History,
  Library,
  Link2,
  Plus,
  RefreshCcw,
  Search,
  ShieldCheck,
  ThumbsUp,
  X,
  XCircle,
} from 'lucide-react'
import { type FormEvent, type ReactNode, useCallback, useEffect, useId, useRef, useState } from 'react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type {
  LibraryBootstrapResponse,
  LibraryCategory,
  LibraryItemDetailResponse,
  LibraryItemStatus,
  LibraryItemSummary,
  LibraryMutationResponse,
  LibraryScope,
  LibrarySourceType,
  LibraryStats,
  LibraryValidationVerdict,
  LibraryVisibility,
} from '@/types/database'

type WorkspaceTab = Extract<LibraryItemStatus, 'review' | 'validated' | 'disputed' | 'retired'>
type SortMode = 'updated' | 'confidence' | 'usage' | 'created'
type ScopeFilter = LibraryScope | 'all'
type CategoryFilter = LibraryCategory | 'all'
type SourceTypeFilter = LibrarySourceType | 'all'
type RationaleAction = 'reject' | 'dispute' | 'retire' | 'resolve'
type GovernanceAction = 'merge' | 'supersede'
type ResolveOutcome = 'validated' | 'retired'
type InlineAction = 'accept' | 'endorse'
type PendingAction = InlineAction | RationaleAction | GovernanceAction | 'edit-accept' | 'create'

interface KnowledgeLibraryWorkspaceProps {
  agentId: string
  agentName?: string
  initialItemId?: string | null
}

interface CreateFormState {
  title: string
  claim: string
  body: string
  category: LibraryCategory
  status: 'review' | 'validated'
  scope: LibraryScope
  visibility: LibraryVisibility
  tags: string
  sourceTitle: string
  evidenceSummary: string
}

interface EditAcceptFormState {
  title: string
  claim: string
  body: string
  category: LibraryCategory
  tags: string
  relatedAgentIds: string
  rationale: string
}

const panelClass = 'rounded-sm border border-border/60 bg-card/[0.62] backdrop-blur-xl shadow-[0_22px_60px_-40px_rgba(109,77,158,0.32)]'
const fieldClass = 'h-11 rounded-sm border border-border/70 bg-card/[0.72] px-3 text-sm text-foreground outline-none transition focus:border-primary/40 focus:ring-4 focus:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50'
const focusClass = 'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2 focus-visible:ring-offset-background'

const WORKSPACE_TABS: Array<{ id: WorkspaceTab; label: string; emptyTitle: string; emptyBody: string }> = [
  {
    id: 'review',
    label: 'Review',
    emptyTitle: 'No knowledge waiting for review.',
    emptyBody: 'Completed challenges, arena runs, profile analyses, and relationship updates can suggest candidates here.',
  },
  {
    id: 'validated',
    label: 'Validated',
    emptyTitle: 'No validated knowledge yet.',
    emptyBody: 'Accept review candidates or add a trusted item manually.',
  },
  {
    id: 'disputed',
    label: 'Disputed',
    emptyTitle: 'No disputed knowledge.',
    emptyBody: 'Conflicts will appear here when agents or workflows challenge a claim.',
  },
  {
    id: 'retired',
    label: 'Retired',
    emptyTitle: 'No retired knowledge.',
    emptyBody: 'Outdated or superseded items will stay available here for audit.',
  },
]

const CATEGORIES: LibraryCategory[] = [
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
]

const SOURCE_TYPES: LibrarySourceType[] = [
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
]

const DEFAULT_CREATE_FORM: CreateFormState = {
  title: '',
  claim: '',
  body: '',
  category: 'lesson',
  status: 'review',
  scope: 'agent',
  visibility: 'agent',
  tags: '',
  sourceTitle: '',
  evidenceSummary: '',
}

const RATIONALE_LABELS: Record<RationaleAction, { title: string; field: string; submit: string }> = {
  reject: {
    title: 'Reject candidate',
    field: 'Why should this candidate not become reusable knowledge?',
    submit: 'Reject',
  },
  dispute: {
    title: 'Dispute knowledge',
    field: 'What evidence or concern challenges this claim?',
    submit: 'Mark disputed',
  },
  retire: {
    title: 'Retire knowledge',
    field: 'Why is this item outdated or no longer safe to use?',
    submit: 'Retire',
  },
  resolve: {
    title: 'Resolve dispute',
    field: 'Why should this disputed item return to validated knowledge?',
    submit: 'Resolve',
  },
}

const STATUS_TONES: Record<LibraryItemStatus, string> = {
  review: 'border-amber-500/30 bg-amber-500/10 text-amber-700 dark:text-amber-300',
  validated: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300',
  disputed: 'border-rose-500/30 bg-rose-500/10 text-rose-700 dark:text-rose-300',
  rejected: 'border-muted-foreground/30 bg-muted/30 text-muted-foreground',
  retired: 'border-slate-500/30 bg-slate-500/10 text-slate-700 dark:text-slate-300',
}

const VERDICT_TONES: Record<LibraryValidationVerdict, string> = {
  accept: 'text-emerald-700 dark:text-emerald-300',
  reject: 'text-rose-700 dark:text-rose-300',
  endorse: 'text-primary',
  dispute: 'text-amber-700 dark:text-amber-300',
  resolve: 'text-emerald-700 dark:text-emerald-300',
  retire: 'text-slate-700 dark:text-slate-300',
  merge: 'text-[var(--color-pastel-blue)]',
}

function labelize(value: string): string {
  return value
    .split('_')
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

function formatDate(value?: string): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(date)
}

function formatDateTime(value?: string): string {
  if (!value) return 'Not recorded'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(date)
}

function formatPercent(value: number): string {
  return `${Math.round(value * 100)}%`
}

function splitCsv(value: string): string[] {
  return value
    .split(',')
    .map((entry) => entry.trim())
    .filter(Boolean)
}

function summarizeDetail(item: LibraryItemDetailResponse): LibraryItemSummary {
  return {
    id: item.item.id,
    agentId: item.item.agentId,
    scope: item.item.scope,
    title: item.item.title,
    claim: item.item.claim,
    category: item.item.category,
    status: item.item.status,
    confidence: item.item.confidence,
    qualityStatus: item.item.qualityStatus,
    visibility: item.item.visibility,
    primarySourceType: item.item.primarySourceType,
    primarySourceId: item.item.primarySourceId,
    tags: item.item.tags,
    relatedAgentIds: item.item.relatedAgentIds,
    usageCount: item.item.usageCount,
    lastUsedAt: item.item.lastUsedAt,
    retiredAt: item.item.retiredAt,
    retiredBy: item.item.retiredBy,
    supersedesItemId: item.item.supersedesItemId,
    mergedIntoItemId: item.item.mergedIntoItemId,
    updatedAt: item.item.updatedAt,
    createdAt: item.item.createdAt,
  }
}

function normalizeDetailResponse(
  detail: LibraryItemDetailResponse | NonNullable<LibraryBootstrapResponse['selectedItem']>
): LibraryItemDetailResponse {
  if ('relatedItems' in detail) {
    return detail
  }

  return {
    ...detail,
    relatedItems: [],
  }
}

async function parseApiError(response: Response, fallback: string): Promise<string> {
  try {
    const body = await response.json()
    if (typeof body?.error?.message === 'string') {
      return body.error.message
    }
    if (typeof body?.error === 'string') {
      return body.error
    }
  } catch {
    return fallback
  }

  return fallback
}

async function fetchJson<T>(url: string, init: RequestInit | undefined, fallback: string): Promise<T> {
  const response = await fetch(url, init)
  if (!response.ok) {
    throw new Error(await parseApiError(response, fallback))
  }

  return response.json() as Promise<T>
}

export function KnowledgeLibraryWorkspace({ agentId, agentName = 'Operator', initialItemId = null }: KnowledgeLibraryWorkspaceProps) {
  const [activeTab, setActiveTab] = useState<WorkspaceTab>('review')
  const [searchInput, setSearchInput] = useState('')
  const [debouncedSearch, setDebouncedSearch] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<CategoryFilter>('all')
  const [sourceTypeFilter, setSourceTypeFilter] = useState<SourceTypeFilter>('all')
  const [scopeFilter, setScopeFilter] = useState<ScopeFilter>('all')
  const [sortMode, setSortMode] = useState<SortMode>('updated')

  const [items, setItems] = useState<LibraryItemSummary[]>([])
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null)
  const [selectedDetail, setSelectedDetail] = useState<LibraryItemDetailResponse | null>(null)
  const [stats, setStats] = useState<LibraryStats | null>(null)

  const [initialLoading, setInitialLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [detailLoading, setDetailLoading] = useState(false)
  const [fetchError, setFetchError] = useState<string | null>(null)
  const [detailError, setDetailError] = useState<string | null>(null)
  const [actionError, setActionError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)
  const [pendingActionKey, setPendingActionKey] = useState<string | null>(null)
  const [retryNonce, setRetryNonce] = useState(0)

  const [createOpen, setCreateOpen] = useState(false)
  const [createForm, setCreateForm] = useState<CreateFormState>(DEFAULT_CREATE_FORM)
  const [createError, setCreateError] = useState<string | null>(null)

  const [rationaleAction, setRationaleAction] = useState<RationaleAction | null>(null)
  const [rationaleText, setRationaleText] = useState('')
  const [resolveOutcome, setResolveOutcome] = useState<ResolveOutcome>('validated')
  const [rationaleError, setRationaleError] = useState<string | null>(null)

  const [governanceAction, setGovernanceAction] = useState<GovernanceAction | null>(null)
  const [governanceTargetId, setGovernanceTargetId] = useState('')
  const [governanceRationale, setGovernanceRationale] = useState('')
  const [governanceError, setGovernanceError] = useState<string | null>(null)

  const [editOpen, setEditOpen] = useState(false)
  const [editForm, setEditForm] = useState<EditAcceptFormState | null>(null)
  const [editError, setEditError] = useState<string | null>(null)

  const selectedItemIdRef = useRef<string | null>(null)
  const initialLoadingRef = useRef(true)
  const workspaceRequestRef = useRef(0)
  const detailRequestRef = useRef(0)
  const defaultTabResolvedRef = useRef(false)
  const initialItemHandledRef = useRef<string | null>(null)

  useEffect(() => {
    selectedItemIdRef.current = selectedItemId
  }, [selectedItemId])

  useEffect(() => {
    initialLoadingRef.current = initialLoading
  }, [initialLoading])

  useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedSearch(searchInput.trim()), 350)
    return () => window.clearTimeout(timer)
  }, [searchInput])

  useEffect(() => {
    if (!successMessage) return
    const timer = window.setTimeout(() => setSuccessMessage(null), 2800)
    return () => window.clearTimeout(timer)
  }, [successMessage])

  useEffect(() => {
    defaultTabResolvedRef.current = false
    setActiveTab('review')
    setSelectedItemId(null)
    setSelectedDetail(null)
    setItems([])
    setStats(null)
    setFetchError(null)
    setDetailError(null)
    initialLoadingRef.current = true
    setInitialLoading(true)
    initialItemHandledRef.current = null
  }, [agentId])

  const buildWorkspaceUrl = useCallback((status: WorkspaceTab) => {
    const params = new URLSearchParams({
      status,
      sort: sortMode,
      scope: scopeFilter,
      limit: '50',
    })

    if (debouncedSearch) params.set('search', debouncedSearch)
    if (categoryFilter !== 'all') params.set('category', categoryFilter)
    if (sourceTypeFilter !== 'all') params.set('sourceType', sourceTypeFilter)

    return `/api/agents/${encodeURIComponent(agentId)}/library?${params.toString()}`
  }, [agentId, categoryFilter, debouncedSearch, scopeFilter, sortMode, sourceTypeFilter])

  const fetchDetail = useCallback(async (itemId: string, options: { showSkeleton?: boolean } = {}) => {
    const requestId = detailRequestRef.current + 1
    detailRequestRef.current = requestId

    if (options.showSkeleton !== false) {
      setDetailLoading(true)
    }
    setDetailError(null)

    try {
      const detail = await fetchJson<LibraryItemDetailResponse>(
        `/api/agents/${encodeURIComponent(agentId)}/library/items/${encodeURIComponent(itemId)}`,
        undefined,
        'Failed to load Library item detail'
      )

      if (requestId !== detailRequestRef.current) return null
      setSelectedDetail(detail)
      return detail
    } catch (error) {
      if (requestId !== detailRequestRef.current) return null
      setDetailError(error instanceof Error ? error.message : 'Failed to load Library item detail')
      return null
    } finally {
      if (requestId === detailRequestRef.current) {
        setDetailLoading(false)
      }
    }
  }, [agentId])

  const loadWorkspace = useCallback(async (options: {
    initial?: boolean
    preferredSelectedId?: string | null
    statusOverride?: WorkspaceTab
  } = {}) => {
    const requestId = workspaceRequestRef.current + 1
    workspaceRequestRef.current = requestId
    const status = options.statusOverride || activeTab
    const isInitial = options.initial ?? initialLoadingRef.current
    let switchingDefaultTab = false

    if (isInitial) {
      initialLoadingRef.current = true
      setInitialLoading(true)
    } else {
      setRefreshing(true)
    }
    setFetchError(null)
    setActionError(null)

    try {
      const bootstrap = await fetchJson<LibraryBootstrapResponse>(
        buildWorkspaceUrl(status),
        undefined,
        'Failed to load Library workspace'
      )

      if (requestId !== workspaceRequestRef.current) return

      const defaultFiltersActive = !debouncedSearch &&
        categoryFilter === 'all' &&
        sourceTypeFilter === 'all' &&
        scopeFilter === 'all'

      if (
        !defaultTabResolvedRef.current &&
        status === 'review' &&
        defaultFiltersActive &&
        bootstrap.stats.review === 0
      ) {
        defaultTabResolvedRef.current = true
        switchingDefaultTab = true
        setActiveTab('validated')
        return
      }

      defaultTabResolvedRef.current = true
      setItems(bootstrap.items)
      setStats(bootstrap.stats)

      const preferredSelectedId = options.preferredSelectedId === undefined
        ? selectedItemIdRef.current
        : options.preferredSelectedId
      const nextSelectedId = preferredSelectedId && bootstrap.items.some((item) => item.id === preferredSelectedId)
        ? preferredSelectedId
        : bootstrap.items[0]?.id ?? null

      setSelectedItemId(nextSelectedId)

      if (!nextSelectedId) {
        setSelectedDetail(null)
        return
      }

      if (bootstrap.selectedItem?.item.id === nextSelectedId) {
        setSelectedDetail(normalizeDetailResponse(bootstrap.selectedItem))
        setDetailError(null)
        return
      }

      await fetchDetail(nextSelectedId, { showSkeleton: !isInitial })
    } catch (error) {
      if (requestId !== workspaceRequestRef.current) return
      setFetchError(error instanceof Error ? error.message : 'Failed to load Library workspace')
    } finally {
      if (requestId !== workspaceRequestRef.current || switchingDefaultTab) return
      initialLoadingRef.current = false
      setInitialLoading(false)
      setRefreshing(false)
    }
  }, [
    activeTab,
    buildWorkspaceUrl,
    categoryFilter,
    debouncedSearch,
    fetchDetail,
    scopeFilter,
    sourceTypeFilter,
  ])

  useEffect(() => {
    void loadWorkspace({ initial: initialLoadingRef.current })
  }, [activeTab, debouncedSearch, categoryFilter, sourceTypeFilter, scopeFilter, sortMode, retryNonce, loadWorkspace])

  useEffect(() => {
    if (!initialItemId || initialItemHandledRef.current === initialItemId) {
      return
    }

    initialItemHandledRef.current = initialItemId
    void (async () => {
      const detail = await fetchDetail(initialItemId, { showSkeleton: true })
      if (!detail) return

      const status = detail.item.status
      if (status === 'review' || status === 'validated' || status === 'disputed' || status === 'retired') {
        setActiveTab(status)
        await loadWorkspace({
          statusOverride: status,
          preferredSelectedId: detail.item.id,
          initial: false,
        })
      }
    })()
  }, [fetchDetail, initialItemId, loadWorkspace])

  const handleSelectItem = useCallback((itemId: string) => {
    setSelectedItemId(itemId)
    void fetchDetail(itemId, { showSkeleton: true })
  }, [fetchDetail])

  const retryWorkspace = () => {
    setRetryNonce((value) => value + 1)
  }

  const retryDetail = () => {
    if (selectedItemId) {
      void fetchDetail(selectedItemId, { showSkeleton: true })
    }
  }

  const runAction = useCallback(async (
    action: PendingAction,
    payload: Record<string, unknown> = {},
    success: string
  ): Promise<boolean> => {
    if (!selectedDetail) return false
    const itemId = selectedDetail.item.id
    const actionKey = `${itemId}:${action}`

    setPendingActionKey(actionKey)
    setActionError(null)

    try {
      const mutation = await fetchJson<LibraryMutationResponse>(
        `/api/agents/${encodeURIComponent(agentId)}/library/items/${encodeURIComponent(itemId)}/actions`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: action === 'edit-accept' ? 'accept' : action,
            actorName: agentName,
            ...payload,
          }),
        },
        'Failed to update Library item'
      )

      setStats(mutation.stats)
      setSelectedDetail(mutation.item)
      setSelectedItemId(mutation.item.item.id)
      setItems((previous) => {
        const summary = summarizeDetail(mutation.item)
        if (summary.status !== activeTab) {
          return previous.filter((item) => item.id !== summary.id)
        }

        return previous.some((item) => item.id === summary.id)
          ? previous.map((item) => (item.id === summary.id ? summary : item))
          : [summary, ...previous]
      })
      setSuccessMessage(success)
      await loadWorkspace({ preferredSelectedId: mutation.item.item.id, initial: false })
      return true
    } catch (error) {
      setActionError(error instanceof Error ? error.message : 'Failed to update Library item')
      return false
    } finally {
      setPendingActionKey(null)
    }
  }, [activeTab, agentId, agentName, loadWorkspace, selectedDetail])

  const openEditAccept = () => {
    if (!selectedDetail) return
    setEditForm({
      title: selectedDetail.item.title,
      claim: selectedDetail.item.claim,
      body: selectedDetail.item.body,
      category: selectedDetail.item.category,
      tags: selectedDetail.item.tags.join(', '),
      relatedAgentIds: selectedDetail.item.relatedAgentIds.join(', '),
      rationale: 'Edited and accepted from Library review.',
    })
    setEditError(null)
    setEditOpen(true)
  }

  const openGovernanceDialog = (action: GovernanceAction, targetItemId = '') => {
    setGovernanceAction(action)
    setGovernanceTargetId(targetItemId)
    setGovernanceRationale('')
    setGovernanceError(null)
  }

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    setCreateError(null)

    if (!createForm.title.trim() || !createForm.claim.trim() || !createForm.body.trim()) {
      setCreateError('Title, claim, and body are required.')
      return
    }

    const actionKey = `new:create`
    setPendingActionKey(actionKey)

    try {
      const mutation = await fetchJson<LibraryMutationResponse>(
        `/api/agents/${encodeURIComponent(agentId)}/library/items`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            title: createForm.title,
            claim: createForm.claim,
            body: createForm.body,
            category: createForm.category,
            status: createForm.status,
            scope: createForm.scope,
            visibility: createForm.visibility,
            tags: splitCsv(createForm.tags),
            sourceRef: {
              sourceType: 'manual',
              sourceTitle: createForm.sourceTitle || undefined,
              evidenceSummary: createForm.evidenceSummary || undefined,
            },
          }),
        },
        'Failed to create Library item'
      )

      const nextTab: WorkspaceTab = mutation.item.item.status === 'validated' ? 'validated' : 'review'
      setStats(mutation.stats)
      setSelectedDetail(mutation.item)
      setSelectedItemId(mutation.item.item.id)
      setCreateOpen(false)
      setCreateForm(DEFAULT_CREATE_FORM)
      setSuccessMessage(createForm.status === 'validated' ? 'Trusted item created.' : 'Review candidate created.')
      setActiveTab(nextTab)
      await loadWorkspace({
        statusOverride: nextTab,
        preferredSelectedId: mutation.item.item.id,
        initial: false,
      })
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Failed to create Library item')
    } finally {
      setPendingActionKey(null)
    }
  }

  const handleRationaleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!rationaleAction) return

    setRationaleError(null)
    if (!rationaleText.trim()) {
      setRationaleError('A rationale is required for this action.')
      return
    }

    const success = await runAction(
      rationaleAction,
      {
        rationale: rationaleText.trim(),
        ...(rationaleAction === 'resolve' ? { resolution: resolveOutcome } : {}),
      },
      rationaleAction === 'reject'
        ? 'Candidate rejected.'
        : rationaleAction === 'dispute'
          ? 'Item marked as disputed.'
          : rationaleAction === 'retire'
            ? 'Item retired.'
            : resolveOutcome === 'retired'
              ? 'Dispute resolved and item retired.'
              : 'Dispute resolved.'
    )

    if (success) {
      setRationaleAction(null)
      setRationaleText('')
      setResolveOutcome('validated')
    } else {
      setRationaleError('The action failed. Review the message in the workspace and try again.')
    }
  }

  const handleGovernanceSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!governanceAction) return

    setGovernanceError(null)
    if (!governanceTargetId.trim()) {
      setGovernanceError('Choose a target item before continuing.')
      return
    }
    if (!governanceRationale.trim()) {
      setGovernanceError('A rationale is required for governance actions.')
      return
    }

    const success = await runAction(
      governanceAction,
      {
        targetItemId: governanceTargetId.trim(),
        rationale: governanceRationale.trim(),
      },
      governanceAction === 'merge'
        ? 'Duplicate item merged and retired for audit.'
        : 'Outdated item superseded and retired for audit.'
    )

    if (success) {
      setGovernanceAction(null)
      setGovernanceTargetId('')
      setGovernanceRationale('')
    } else {
      setGovernanceError('The governance action failed. Review the message in the workspace and try again.')
    }
  }

  const handleEditAcceptSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!editForm) return

    setEditError(null)
    if (!editForm.title.trim() || !editForm.claim.trim() || !editForm.body.trim()) {
      setEditError('Title, claim, and body are required before accepting.')
      return
    }

    const success = await runAction(
      'edit-accept',
      {
        rationale: editForm.rationale.trim() || 'Edited and accepted from Library review.',
        editedItem: {
          title: editForm.title,
          claim: editForm.claim,
          body: editForm.body,
          category: editForm.category,
          tags: splitCsv(editForm.tags),
          relatedAgentIds: splitCsv(editForm.relatedAgentIds),
        },
      },
      'Candidate edited and accepted.'
    )

    if (success) {
      setEditOpen(false)
      setEditForm(null)
    } else {
      setEditError('The edited item was not accepted. Your edits are still here.')
    }
  }

  const activeEmptyState = WORKSPACE_TABS.find((tab) => tab.id === activeTab) || WORKSPACE_TABS[0]
  const selectedItemBusy = selectedDetail ? pendingActionKey?.startsWith(`${selectedDetail.item.id}:`) ?? false : false
  const createPending = pendingActionKey === 'new:create'

  return (
    <section className="space-y-5" aria-label="Knowledge Library workspace">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-medium text-primary">
            <Library className="h-4 w-4" aria-hidden="true" />
            Knowledge Vault
          </div>
          <h2 className="mt-2 text-2xl font-semibold text-foreground">Library Workspace</h2>
          <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
            Review source-backed claims before they become reusable context for this agent.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={retryWorkspace}
            disabled={refreshing || initialLoading}
            className="gap-2"
            title={refreshing ? 'Library filters are already refreshing.' : 'Refresh Library workspace'}
          >
            <RefreshCcw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
            Refresh
          </Button>
          <Button type="button" size="sm" onClick={() => setCreateOpen(true)} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            Add Item
          </Button>
        </div>
      </div>

      <div aria-live="polite" className="min-h-6">
        {successMessage && (
          <div className="inline-flex items-center gap-2 rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-700 dark:text-emerald-300">
            <Check className="h-4 w-4" aria-hidden="true" />
            {successMessage}
          </div>
        )}
        {actionError && (
          <ActionableError message={actionError} onRetry={selectedItemId ? retryDetail : retryWorkspace} />
        )}
      </div>

      <LibraryStatsStrip stats={stats} loading={initialLoading} refreshing={refreshing} />

      <LibraryFilterBar
        activeTab={activeTab}
        stats={stats}
        searchInput={searchInput}
        categoryFilter={categoryFilter}
        sourceTypeFilter={sourceTypeFilter}
        scopeFilter={scopeFilter}
        sortMode={sortMode}
        refreshing={refreshing}
        onTabChange={setActiveTab}
        onSearchChange={setSearchInput}
        onCategoryChange={setCategoryFilter}
        onSourceTypeChange={setSourceTypeFilter}
        onScopeChange={setScopeFilter}
        onSortChange={setSortMode}
      />

      {fetchError && !initialLoading && (
        <div className={cn(panelClass, 'p-4')}>
          <ActionableError message={fetchError} onRetry={retryWorkspace} retryLabel="Retry Library fetch" />
        </div>
      )}

      {initialLoading ? (
        <WorkspaceSkeleton />
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.25fr)_minmax(260px,0.85fr)]">
          <LibraryItemList
            items={items}
            selectedItemId={selectedItemId}
            emptyTitle={activeEmptyState.emptyTitle}
            emptyBody={activeEmptyState.emptyBody}
            refreshing={refreshing}
            onSelect={handleSelectItem}
          />

          <LibraryItemDetailPanel
            detail={selectedDetail}
            loading={detailLoading}
            error={detailError}
            busy={selectedItemBusy}
            pendingActionKey={pendingActionKey}
            onRetry={retryDetail}
            onAccept={() => void runAction('accept', {}, 'Candidate accepted.')}
            onEditAccept={openEditAccept}
            onEndorse={() => void runAction('endorse', {}, 'Item endorsed.')}
            onOpenRationale={(action) => {
              setRationaleAction(action)
              setRationaleText('')
              setResolveOutcome('validated')
              setRationaleError(null)
            }}
            onOpenGovernance={openGovernanceDialog}
          />

          <LibraryEvidencePanel
            detail={selectedDetail}
            loading={detailLoading}
            busy={selectedItemBusy}
            pendingActionKey={pendingActionKey}
            onOpenRationale={(action, outcome) => {
              setRationaleAction(action)
              setRationaleText('')
              setResolveOutcome(outcome || 'validated')
              setRationaleError(null)
            }}
            onOpenGovernance={openGovernanceDialog}
          />
        </div>
      )}

      <CreateItemModal
        open={createOpen}
        form={createForm}
        error={createError}
        pending={createPending}
        onClose={() => {
          if (!createPending) setCreateOpen(false)
        }}
        onChange={setCreateForm}
        onSubmit={handleCreate}
      />

      <RationaleModal
        action={rationaleAction}
        value={rationaleText}
        error={rationaleError}
        pending={Boolean(rationaleAction && pendingActionKey?.endsWith(`:${rationaleAction}`))}
        resolveOutcome={resolveOutcome}
        onClose={() => {
          if (!pendingActionKey) setRationaleAction(null)
        }}
        onChange={setRationaleText}
        onResolveOutcomeChange={setResolveOutcome}
        onSubmit={handleRationaleSubmit}
      />

      <GovernanceModal
        action={governanceAction}
        detail={selectedDetail}
        targetItemId={governanceTargetId}
        rationale={governanceRationale}
        error={governanceError}
        pending={Boolean(governanceAction && pendingActionKey?.endsWith(`:${governanceAction}`))}
        onClose={() => {
          if (!pendingActionKey) setGovernanceAction(null)
        }}
        onTargetChange={setGovernanceTargetId}
        onRationaleChange={setGovernanceRationale}
        onSubmit={handleGovernanceSubmit}
      />

      <EditAcceptModal
        open={editOpen}
        form={editForm}
        error={editError}
        pending={Boolean(pendingActionKey?.endsWith(':edit-accept'))}
        onClose={() => {
          if (!pendingActionKey) setEditOpen(false)
        }}
        onChange={setEditForm}
        onSubmit={handleEditAcceptSubmit}
      />
    </section>
  )
}

function LibraryStatsStrip({ stats, loading, refreshing }: { stats: LibraryStats | null; loading: boolean; refreshing: boolean }) {
  const statItems = [
    { label: 'Review candidates', value: stats?.review ?? 0, tone: 'text-amber-700 dark:text-amber-300' },
    { label: 'Validated items', value: stats?.validated ?? 0, tone: 'text-emerald-700 dark:text-emerald-300' },
    { label: 'Disputed items', value: stats?.disputed ?? 0, tone: 'text-rose-700 dark:text-rose-300' },
    { label: 'Retired items', value: stats?.retired ?? 0, tone: 'text-slate-700 dark:text-slate-300' },
    { label: 'Used this week', value: stats?.usedThisWeek ?? 0, tone: 'text-[var(--color-pastel-blue)]' },
    { label: 'Avg confidence', value: stats ? formatPercent(stats.averageConfidence) : '0%', tone: 'text-primary' },
  ]

  return (
    <div className="relative">
      {refreshing && !loading && (
        <div className="absolute right-2 top-2 z-10 inline-flex items-center gap-2 rounded-sm border border-primary/20 bg-background/80 px-2 py-1 text-xs text-muted-foreground backdrop-blur">
          <RefreshCcw className="h-3 w-3 animate-spin" aria-hidden="true" />
          Refreshing
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        {statItems.map((item) => (
          <div key={item.label} className={cn(panelClass, 'min-h-24 p-4')}>
            {loading ? (
              <div className="space-y-3" aria-hidden="true">
                <div className="h-7 w-16 animate-pulse rounded-sm bg-muted/40" />
                <div className="h-4 w-28 animate-pulse rounded-sm bg-muted/30" />
              </div>
            ) : (
              <>
                <div className={cn('text-2xl font-semibold', item.tone)}>{item.value}</div>
                <div className="mt-2 text-sm text-muted-foreground">{item.label}</div>
              </>
            )}
          </div>
        ))}
      </div>
    </div>
  )
}

interface LibraryFilterBarProps {
  activeTab: WorkspaceTab
  stats: LibraryStats | null
  searchInput: string
  categoryFilter: CategoryFilter
  sourceTypeFilter: SourceTypeFilter
  scopeFilter: ScopeFilter
  sortMode: SortMode
  refreshing: boolean
  onTabChange: (tab: WorkspaceTab) => void
  onSearchChange: (value: string) => void
  onCategoryChange: (value: CategoryFilter) => void
  onSourceTypeChange: (value: SourceTypeFilter) => void
  onScopeChange: (value: ScopeFilter) => void
  onSortChange: (value: SortMode) => void
}

function LibraryFilterBar({
  activeTab,
  stats,
  searchInput,
  categoryFilter,
  sourceTypeFilter,
  scopeFilter,
  sortMode,
  refreshing,
  onTabChange,
  onSearchChange,
  onCategoryChange,
  onSourceTypeChange,
  onScopeChange,
  onSortChange,
}: LibraryFilterBarProps) {
  return (
    <div className={cn(panelClass, 'space-y-4 p-4')}>
      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Library status">
        {WORKSPACE_TABS.map((tab) => {
          const isActive = activeTab === tab.id
          const count = stats?.[tab.id] ?? 0
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              onClick={() => onTabChange(tab.id)}
              className={cn(
                'inline-flex min-h-10 items-center gap-2 rounded-sm border px-3 py-2 text-sm font-medium transition',
                focusClass,
                isActive
                  ? 'border-primary/40 bg-primary text-primary-foreground'
                  : 'border-border/60 bg-background/35 text-muted-foreground hover:border-primary/30 hover:text-foreground'
              )}
            >
              {tab.label}
              <span className={cn(
                'rounded-sm px-1.5 py-0.5 text-xs',
                isActive ? 'bg-primary-foreground/18 text-primary-foreground' : 'bg-muted/60 text-muted-foreground'
              )}>
                {count}
              </span>
            </button>
          )
        })}
      </div>

      <div className="grid gap-3 lg:grid-cols-[minmax(220px,1fr)_repeat(4,minmax(150px,auto))]">
        <form role="search" onSubmit={(event) => event.preventDefault()} className="relative">
          <label htmlFor="library-search" className="sr-only">Search Library items</label>
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            id="library-search"
            type="search"
            value={searchInput}
            onChange={(event) => onSearchChange(event.target.value)}
            placeholder="Search title, claim, source"
            className="pl-9"
          />
        </form>

        <LabeledSelect label="Category">
          <select
            value={categoryFilter}
            onChange={(event) => onCategoryChange(event.target.value as CategoryFilter)}
            className={cn(fieldClass, 'w-full')}
          >
            <option value="all">All categories</option>
            {CATEGORIES.map((category) => (
              <option key={category} value={category}>{labelize(category)}</option>
            ))}
          </select>
        </LabeledSelect>

        <LabeledSelect label="Source">
          <select
            value={sourceTypeFilter}
            onChange={(event) => onSourceTypeChange(event.target.value as SourceTypeFilter)}
            className={cn(fieldClass, 'w-full')}
          >
            <option value="all">All sources</option>
            {SOURCE_TYPES.map((sourceType) => (
              <option key={sourceType} value={sourceType}>{labelize(sourceType)}</option>
            ))}
          </select>
        </LabeledSelect>

        <LabeledSelect label="Scope">
          <select
            value={scopeFilter}
            onChange={(event) => onScopeChange(event.target.value as ScopeFilter)}
            className={cn(fieldClass, 'w-full')}
          >
            <option value="all">Agent and network</option>
            <option value="agent">Agent only</option>
            <option value="network">Network only</option>
          </select>
        </LabeledSelect>

        <LabeledSelect label="Sort">
          <select
            value={sortMode}
            onChange={(event) => onSortChange(event.target.value as SortMode)}
            className={cn(fieldClass, 'w-full')}
            aria-describedby={refreshing ? 'library-refreshing-status' : undefined}
          >
            <option value="updated">Recently updated</option>
            <option value="confidence">Highest confidence</option>
            <option value="usage">Most used</option>
            <option value="created">Newest created</option>
          </select>
        </LabeledSelect>
      </div>

      {refreshing && (
        <div id="library-refreshing-status" className="text-sm text-muted-foreground">
          Updating the list while keeping the current detail visible.
        </div>
      )}
    </div>
  )
}

function LabeledSelect({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="space-y-1 text-xs font-medium text-muted-foreground">
      <span>{label}</span>
      {children}
    </label>
  )
}

function LibraryItemList({
  items,
  selectedItemId,
  emptyTitle,
  emptyBody,
  refreshing,
  onSelect,
}: {
  items: LibraryItemSummary[]
  selectedItemId: string | null
  emptyTitle: string
  emptyBody: string
  refreshing: boolean
  onSelect: (itemId: string) => void
}) {
  return (
    <div className={cn(panelClass, 'min-h-[420px] p-3')}>
      <div className="mb-3 flex items-center justify-between gap-3 px-1">
        <div>
          <h3 className="font-semibold text-foreground">Items</h3>
          <p className="text-sm text-muted-foreground">{items.length} in this view</p>
        </div>
        {refreshing && <RefreshCcw className="h-4 w-4 animate-spin text-muted-foreground" aria-hidden="true" />}
      </div>

      {items.length === 0 ? (
        <div className="flex min-h-[300px] flex-col justify-center rounded-sm border border-dashed border-border/60 bg-background/20 p-5 text-center">
          <BookOpenCheck className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
          <h4 className="mt-4 text-base font-semibold text-foreground">{emptyTitle}</h4>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">{emptyBody}</p>
        </div>
      ) : (
        <div className="space-y-2">
          {items.map((item) => {
            const selected = item.id === selectedItemId
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelect(item.id)}
                className={cn(
                  'w-full rounded-sm border p-3 text-left transition',
                  focusClass,
                  selected
                    ? 'border-primary/45 bg-primary/10'
                    : 'border-border/50 bg-background/25 hover:border-primary/25 hover:bg-background/45'
                )}
                aria-current={selected ? 'true' : undefined}
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h4 className="break-words text-sm font-semibold text-foreground">{item.title}</h4>
                    <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-muted-foreground">{item.claim}</p>
                  </div>
                  <span className="shrink-0 text-sm font-semibold text-foreground">{formatPercent(item.confidence)}</span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <StatusBadge status={item.status} />
                  <span className="rounded-sm border border-border/60 px-2 py-1 text-xs text-muted-foreground">{labelize(item.category)}</span>
                  <span className="inline-flex items-center gap-1 rounded-sm border border-border/60 px-2 py-1 text-xs text-muted-foreground">
                    <Link2 className="h-3 w-3" aria-hidden="true" />
                    {labelize(item.primarySourceType)}
                  </span>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
                  <span>{item.usageCount} uses</span>
                  <span>Updated {formatDate(item.updatedAt)}</span>
                  {item.status === 'disputed' && <span className="font-medium text-rose-600 dark:text-rose-300">Disputed</span>}
                  {item.mergedIntoItemId && <span className="font-medium text-[var(--color-pastel-blue)]">Merged</span>}
                  {item.supersedesItemId && <span className="font-medium text-slate-600 dark:text-slate-300">Superseded</span>}
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

function LibraryItemDetailPanel({
  detail,
  loading,
  error,
  busy,
  pendingActionKey,
  onRetry,
  onAccept,
  onEditAccept,
  onEndorse,
  onOpenRationale,
  onOpenGovernance,
}: {
  detail: LibraryItemDetailResponse | null
  loading: boolean
  error: string | null
  busy: boolean
  pendingActionKey: string | null
  onRetry: () => void
  onAccept: () => void
  onEditAccept: () => void
  onEndorse: () => void
  onOpenRationale: (action: RationaleAction) => void
  onOpenGovernance: (action: GovernanceAction, targetItemId?: string) => void
}) {
  if (loading) {
    return <DetailSkeleton />
  }

  if (error) {
    return (
      <div className={cn(panelClass, 'min-h-[420px] p-5')}>
        <ActionableError message={error} onRetry={onRetry} retryLabel="Retry detail" />
      </div>
    )
  }

  if (!detail) {
    return (
      <div className={cn(panelClass, 'flex min-h-[420px] flex-col justify-center p-5 text-center')}>
        <FileText className="mx-auto h-8 w-8 text-muted-foreground" aria-hidden="true" />
        <h3 className="mt-4 text-lg font-semibold text-foreground">Select a Library item</h3>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          The detail panel shows the claim, source trail, validation history, and usage context.
        </p>
      </div>
    )
  }

  const item = detail.item
  const promptEligible = Boolean(item.payload.contextPolicy?.allowPromptUse && item.status === 'validated')

  return (
    <article className={cn(panelClass, 'min-h-[420px] p-5')}>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <StatusBadge status={item.status} />
            <span className="rounded-sm border border-border/60 px-2 py-1 text-xs text-muted-foreground">{labelize(item.category)}</span>
            <span className="rounded-sm border border-border/60 px-2 py-1 text-xs text-muted-foreground">{item.scope}</span>
          </div>
          <h3 className="mt-3 break-words text-2xl font-semibold leading-tight text-foreground">{item.title}</h3>
          <p className="mt-3 break-words text-base leading-7 text-foreground">{item.claim}</p>
        </div>
        <div className="shrink-0 rounded-sm border border-border/60 bg-background/30 px-3 py-2 text-right">
          <div className="text-xl font-semibold text-primary">{formatPercent(item.confidence)}</div>
          <div className="text-xs text-muted-foreground">confidence</div>
        </div>
      </div>

      <div className="mt-5 grid gap-3 sm:grid-cols-3">
        <DetailMetric label="Quality" value={labelize(item.qualityStatus)} />
        <DetailMetric label="Usage" value={`${item.usageCount} event${item.usageCount === 1 ? '' : 's'}`} />
        <DetailMetric label="Updated" value={formatDate(item.updatedAt)} />
      </div>

      <section className="mt-6 border-t border-border/60 pt-5">
        <h4 className="text-sm font-semibold text-foreground">Full Body</h4>
        <p className="mt-2 whitespace-pre-wrap break-words text-sm leading-7 text-muted-foreground">{item.body}</p>
      </section>

      <section className="mt-6 border-t border-border/60 pt-5">
        <h4 className="text-sm font-semibold text-foreground">Prompt Eligibility</h4>
        <div className="mt-2 flex flex-wrap items-center gap-2">
          <span className={cn(
            'inline-flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-sm',
            promptEligible
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300'
              : 'border-border/60 bg-muted/20 text-muted-foreground'
          )}>
            <ShieldCheck className="h-4 w-4" aria-hidden="true" />
            {promptEligible ? 'Allowed for prompt context' : 'Excluded from prompt context'}
          </span>
          {item.payload.contextPolicy?.maxPromptChars && (
            <span className="text-sm text-muted-foreground">Max {item.payload.contextPolicy.maxPromptChars} characters</span>
          )}
        </div>
      </section>

      <GovernanceIndicators detail={detail} />

      {item.tags.length > 0 && (
        <section className="mt-6 border-t border-border/60 pt-5">
          <h4 className="text-sm font-semibold text-foreground">Tags</h4>
          <div className="mt-2 flex flex-wrap gap-2">
            {item.tags.map((tag) => (
              <span key={tag} className="soft-pill">{tag}</span>
            ))}
          </div>
        </section>
      )}

      <LibraryActions
        status={item.status}
        busy={busy}
        pendingActionKey={pendingActionKey}
        itemId={item.id}
        onAccept={onAccept}
        onEditAccept={onEditAccept}
        onEndorse={onEndorse}
        onOpenRationale={onOpenRationale}
        onOpenGovernance={onOpenGovernance}
      />
    </article>
  )
}

function LibraryActions({
  status,
  busy,
  pendingActionKey,
  itemId,
  onAccept,
  onEditAccept,
  onEndorse,
  onOpenRationale,
  onOpenGovernance,
}: {
  status: LibraryItemStatus
  busy: boolean
  pendingActionKey: string | null
  itemId: string
  onAccept: () => void
  onEditAccept: () => void
  onEndorse: () => void
  onOpenRationale: (action: RationaleAction) => void
  onOpenGovernance: (action: GovernanceAction, targetItemId?: string) => void
}) {
  const isPending = (action: PendingAction) => pendingActionKey === `${itemId}:${action}`
  const disabledReason = busy ? 'Another action is already updating this item.' : undefined

  return (
    <section className="mt-6 border-t border-border/60 pt-5">
      <h4 className="text-sm font-semibold text-foreground">Actions</h4>
      <div className="mt-3 flex flex-wrap gap-2">
        {status === 'review' && (
          <>
            <Button type="button" size="sm" onClick={onAccept} disabled={busy} title={disabledReason} className="gap-2">
              <Check className="h-4 w-4" aria-hidden="true" />
              {isPending('accept') ? 'Accepting...' : 'Accept'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={onEditAccept} disabled={busy} title={disabledReason} className="gap-2">
              <Edit3 className="h-4 w-4" aria-hidden="true" />
              {isPending('edit-accept') ? 'Saving...' : 'Edit and accept'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenRationale('reject')} disabled={busy} title={disabledReason} className="gap-2">
              <XCircle className="h-4 w-4" aria-hidden="true" />
              {isPending('reject') ? 'Rejecting...' : 'Reject'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenRationale('dispute')} disabled={busy} title={disabledReason} className="gap-2">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {isPending('dispute') ? 'Disputing...' : 'Dispute'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenGovernance('merge')} disabled={busy} title={disabledReason} className="gap-2">
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {isPending('merge') ? 'Merging...' : 'Merge'}
            </Button>
          </>
        )}

        {status === 'validated' && (
          <>
            <Button type="button" size="sm" onClick={onEndorse} disabled={busy} title={disabledReason} className="gap-2">
              <ThumbsUp className="h-4 w-4" aria-hidden="true" />
              {isPending('endorse') ? 'Endorsing...' : 'Endorse'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenRationale('dispute')} disabled={busy} title={disabledReason} className="gap-2">
              <AlertCircle className="h-4 w-4" aria-hidden="true" />
              {isPending('dispute') ? 'Disputing...' : 'Dispute'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenRationale('retire')} disabled={busy} title={disabledReason} className="gap-2">
              <Archive className="h-4 w-4" aria-hidden="true" />
              {isPending('retire') ? 'Retiring...' : 'Retire'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenGovernance('merge')} disabled={busy} title={disabledReason} className="gap-2">
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {isPending('merge') ? 'Merging...' : 'Merge'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenGovernance('supersede')} disabled={busy} title={disabledReason} className="gap-2">
              <Archive className="h-4 w-4" aria-hidden="true" />
              {isPending('supersede') ? 'Superseding...' : 'Supersede'}
            </Button>
          </>
        )}

        {status === 'disputed' && (
          <>
            <Button type="button" size="sm" onClick={() => onOpenRationale('resolve')} disabled={busy} title={disabledReason} className="gap-2">
              <Check className="h-4 w-4" aria-hidden="true" />
              {isPending('resolve') ? 'Resolving...' : 'Resolve'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenRationale('retire')} disabled={busy} title={disabledReason} className="gap-2">
              <Archive className="h-4 w-4" aria-hidden="true" />
              {isPending('retire') ? 'Retiring...' : 'Retire'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenGovernance('merge')} disabled={busy} title={disabledReason} className="gap-2">
              <Link2 className="h-4 w-4" aria-hidden="true" />
              {isPending('merge') ? 'Merging...' : 'Merge'}
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => onOpenGovernance('supersede')} disabled={busy} title={disabledReason} className="gap-2">
              <Archive className="h-4 w-4" aria-hidden="true" />
              {isPending('supersede') ? 'Superseding...' : 'Supersede'}
            </Button>
          </>
        )}

        {(status === 'retired' || status === 'rejected') && (
          <div className="rounded-sm border border-border/60 bg-muted/20 px-3 py-2 text-sm text-muted-foreground">
            This item is audit-only. No direct actions are available from this state.
          </div>
        )}
      </div>
      {disabledReason && <p className="mt-2 text-sm text-muted-foreground">{disabledReason}</p>}
    </section>
  )
}

function LibraryEvidencePanel({
  detail,
  loading,
  busy,
  pendingActionKey,
  onOpenRationale,
  onOpenGovernance,
}: {
  detail: LibraryItemDetailResponse | null
  loading: boolean
  busy: boolean
  pendingActionKey: string | null
  onOpenRationale: (action: RationaleAction, outcome?: ResolveOutcome) => void
  onOpenGovernance: (action: GovernanceAction, targetItemId?: string) => void
}) {
  if (loading) {
    return (
      <div className={cn(panelClass, 'space-y-4 p-4')} aria-hidden="true">
        <div className="h-5 w-36 animate-pulse rounded-sm bg-muted/40" />
        <div className="h-24 animate-pulse rounded-sm bg-muted/30" />
        <div className="h-5 w-44 animate-pulse rounded-sm bg-muted/40" />
        <div className="h-24 animate-pulse rounded-sm bg-muted/30" />
      </div>
    )
  }

  return (
    <aside className={cn(panelClass, 'space-y-6 p-4')}>
      <SourceTrail detail={detail} />
      <DuplicateSuggestions detail={detail} busy={busy} pendingActionKey={pendingActionKey} onOpenGovernance={onOpenGovernance} />
      <DisputeResolutionPanel detail={detail} busy={busy} pendingActionKey={pendingActionKey} onOpenRationale={onOpenRationale} />
      <ValidationHistory detail={detail} />
      <UsageTrail detail={detail} />
      <RelatedAgents detail={detail} />
    </aside>
  )
}

function SourceTrail({ detail }: { detail: LibraryItemDetailResponse | null }) {
  return (
    <section>
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="font-semibold text-foreground">Source Trail</h3>
      </div>
      {!detail || detail.sources.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">No source references are attached yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {detail.sources.map((source) => (
            <div key={source.id} className="border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center gap-2">
                <span className="rounded-sm border border-border/60 px-2 py-1 text-xs text-muted-foreground">{labelize(source.sourceType)}</span>
                <span className="break-all text-xs text-muted-foreground">{source.sourceId}</span>
              </div>
              {source.sourceTitle && <div className="mt-2 text-sm font-medium text-foreground">{source.sourceTitle}</div>}
              <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{source.evidenceSummary}</p>
              {source.quote && (
                <blockquote className="mt-2 border-l-2 border-primary/30 pl-3 text-sm leading-6 text-muted-foreground">
                  {source.quote}
                </blockquote>
              )}
              {source.sourceTimestamp && <div className="mt-2 text-xs text-muted-foreground">{formatDateTime(source.sourceTimestamp)}</div>}
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function DuplicateSuggestions({
  detail,
  busy,
  pendingActionKey,
  onOpenGovernance,
}: {
  detail: LibraryItemDetailResponse | null
  busy: boolean
  pendingActionKey: string | null
  onOpenGovernance: (action: GovernanceAction, targetItemId?: string) => void
}) {
  const item = detail?.item
  const suggestions = (detail?.relatedItems || []).filter((related) => (
    item &&
    related.id !== item.id &&
    related.status !== 'retired' &&
    related.status !== 'rejected' &&
    !related.mergedIntoItemId
  )).slice(0, 5)
  const itemBusy = item ? pendingActionKey?.startsWith(`${item.id}:`) ?? false : false

  return (
    <section className="border-t border-border/60 pt-5">
      <div className="flex items-center gap-2">
        <Link2 className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="font-semibold text-foreground">Duplicate Suggestions</h3>
      </div>
      {!item || suggestions.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">No likely duplicate items are visible for this claim.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {suggestions.map((suggestion) => (
            <div key={suggestion.id} className="rounded-sm border border-border/60 bg-background/25 p-3">
              <div className="flex flex-wrap items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="break-words text-sm font-semibold text-foreground">{suggestion.title}</div>
                  <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-muted-foreground">{suggestion.claim}</p>
                </div>
                <StatusBadge status={suggestion.status} />
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => onOpenGovernance('merge', suggestion.id)}
                  disabled={busy || itemBusy}
                  className="gap-2"
                >
                  <Link2 className="h-4 w-4" aria-hidden="true" />
                  Merge into
                </Button>
                {(item.status === 'validated' || item.status === 'disputed') && suggestion.status === 'validated' && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => onOpenGovernance('supersede', suggestion.id)}
                    disabled={busy || itemBusy}
                    className="gap-2"
                  >
                    <Archive className="h-4 w-4" aria-hidden="true" />
                    Supersede with
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function DisputeResolutionPanel({
  detail,
  busy,
  pendingActionKey,
  onOpenRationale,
}: {
  detail: LibraryItemDetailResponse | null
  busy: boolean
  pendingActionKey: string | null
  onOpenRationale: (action: RationaleAction, outcome?: ResolveOutcome) => void
}) {
  const disputes = (detail?.validations || []).filter((validation) => validation.verdict === 'dispute')
  const item = detail?.item
  const resolving = item ? pendingActionKey === `${item.id}:resolve` : false

  return (
    <section className="border-t border-border/60 pt-5">
      <div className="flex items-center gap-2">
        <AlertCircle className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="font-semibold text-foreground">Dispute Resolution</h3>
      </div>
      {!item || item.status !== 'disputed' ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">No active dispute is waiting for resolution.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {disputes.slice(0, 3).map((dispute) => (
            <div key={dispute.id} className="rounded-sm border border-amber-500/25 bg-amber-500/5 p-3">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-amber-700 dark:text-amber-300">{dispute.actorName || dispute.actorType}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(dispute.createdAt)}</span>
              </div>
              <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{dispute.rationale}</p>
            </div>
          ))}
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              size="sm"
              onClick={() => onOpenRationale('resolve', 'validated')}
              disabled={busy || resolving}
              className="gap-2"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Validate
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenRationale('resolve', 'retired')}
              disabled={busy || resolving}
              className="gap-2"
            >
              <Archive className="h-4 w-4" aria-hidden="true" />
              Retire
            </Button>
          </div>
        </div>
      )}
    </section>
  )
}

function ValidationHistory({ detail }: { detail: LibraryItemDetailResponse | null }) {
  return (
    <section className="border-t border-border/60 pt-5">
      <div className="flex items-center gap-2">
        <History className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="font-semibold text-foreground">Validation History</h3>
      </div>
      {!detail || detail.validations.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">No validation events have been recorded.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {detail.validations.map((validation) => (
            <div key={validation.id} className="border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className={cn('text-sm font-semibold', VERDICT_TONES[validation.verdict])}>{labelize(validation.verdict)}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(validation.createdAt)}</span>
              </div>
              <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{validation.rationale || 'No rationale recorded.'}</p>
              <div className="mt-1 text-xs text-muted-foreground">
                {validation.actorName || validation.actorType}
                {validation.confidenceDelta !== 0 && `, confidence ${validation.confidenceDelta > 0 ? '+' : ''}${validation.confidenceDelta.toFixed(2)}`}
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function UsageTrail({ detail }: { detail: LibraryItemDetailResponse | null }) {
  return (
    <section className="border-t border-border/60 pt-5">
      <div className="flex items-center gap-2">
        <Clock3 className="h-4 w-4 text-primary" aria-hidden="true" />
        <h3 className="font-semibold text-foreground">Usage Trail</h3>
      </div>
      {!detail || detail.usageEvents.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">No downstream workflow has used this item yet.</p>
      ) : (
        <div className="mt-3 space-y-3">
          {detail.usageEvents.map((event) => (
            <div key={event.id} className="border-t border-border/60 pt-3 first:border-t-0 first:pt-0">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="text-sm font-semibold text-foreground">{labelize(event.consumerFeature)}</span>
                <span className="text-xs text-muted-foreground">{formatDateTime(event.usedAt)}</span>
              </div>
              {event.query && <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{event.query}</p>}
              <div className="mt-1 text-xs text-muted-foreground">Relevance {formatPercent(event.relevanceScore)}</div>
            </div>
          ))}
        </div>
      )}
    </section>
  )
}

function RelatedAgents({ detail }: { detail: LibraryItemDetailResponse | null }) {
  const relatedAgentIds = detail?.item.relatedAgentIds || []
  return (
    <section className="border-t border-border/60 pt-5">
      <h3 className="font-semibold text-foreground">Related Agents</h3>
      {relatedAgentIds.length === 0 ? (
        <p className="mt-3 text-sm leading-6 text-muted-foreground">No related agents are attached.</p>
      ) : (
        <div className="mt-3 flex flex-wrap gap-2">
          {relatedAgentIds.map((id) => (
            <span key={id} className="soft-pill">{id}</span>
          ))}
        </div>
      )}
    </section>
  )
}

function StatusBadge({ status }: { status: LibraryItemStatus }) {
  return (
    <span className={cn('inline-flex rounded-sm border px-2 py-1 text-xs font-medium', STATUS_TONES[status])}>
      {labelize(status)}
    </span>
  )
}

function DetailMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm border border-border/60 bg-background/25 p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 break-words text-sm font-semibold text-foreground">{value}</div>
    </div>
  )
}

function GovernanceIndicators({ detail }: { detail: LibraryItemDetailResponse }) {
  const item = detail.item
  const mergedFrom = detail.relatedItems.filter((related) => related.mergedIntoItemId === item.id)
  const supersedes = detail.relatedItems.filter((related) => related.supersedesItemId === item.id)

  if (!item.mergedIntoItemId && !item.supersedesItemId && mergedFrom.length === 0 && supersedes.length === 0) {
    return null
  }

  return (
    <section className="mt-6 border-t border-border/60 pt-5">
      <h4 className="text-sm font-semibold text-foreground">Governance Links</h4>
      <div className="mt-3 space-y-2 text-sm text-muted-foreground">
        {item.mergedIntoItemId && (
          <div className="rounded-sm border border-[var(--color-pastel-blue)]/30 bg-background/25 p-3">
            Merged into <span className="font-mono text-xs text-foreground">{item.mergedIntoItemId}</span>
          </div>
        )}
        {item.supersedesItemId && (
          <div className="rounded-sm border border-slate-500/30 bg-background/25 p-3">
            Superseded by <span className="font-mono text-xs text-foreground">{item.supersedesItemId}</span>
          </div>
        )}
        {mergedFrom.map((related) => (
          <div key={related.id} className="rounded-sm border border-border/60 bg-background/25 p-3">
            Merged from <span className="font-medium text-foreground">{related.title}</span>
          </div>
        ))}
        {supersedes.map((related) => (
          <div key={related.id} className="rounded-sm border border-border/60 bg-background/25 p-3">
            Supersedes <span className="font-medium text-foreground">{related.title}</span>
          </div>
        ))}
      </div>
    </section>
  )
}

function ActionableError({
  message,
  onRetry,
  retryLabel = 'Retry',
}: {
  message: string
  onRetry: () => void
  retryLabel?: string
}) {
  return (
    <div className="flex flex-col gap-3 rounded-sm border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-start gap-2">
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
        <span>{message}</span>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        {retryLabel}
      </Button>
    </div>
  )
}

function WorkspaceSkeleton() {
  return (
    <div className="grid gap-5 xl:grid-cols-[minmax(280px,0.9fr)_minmax(360px,1.25fr)_minmax(260px,0.85fr)]" aria-label="Loading Library workspace">
      <div className={cn(panelClass, 'space-y-3 p-3')}>
        <div className="h-5 w-24 animate-pulse rounded-sm bg-muted/40" />
        {[0, 1, 2, 3].map((index) => (
          <div key={index} className="space-y-3 rounded-sm border border-border/50 bg-background/25 p-3">
            <div className="h-4 w-3/4 animate-pulse rounded-sm bg-muted/40" />
            <div className="h-4 w-full animate-pulse rounded-sm bg-muted/30" />
            <div className="h-4 w-1/2 animate-pulse rounded-sm bg-muted/30" />
          </div>
        ))}
      </div>
      <DetailSkeleton />
      <div className={cn(panelClass, 'space-y-4 p-4')}>
        <div className="h-5 w-32 animate-pulse rounded-sm bg-muted/40" />
        <div className="h-24 animate-pulse rounded-sm bg-muted/30" />
        <div className="h-5 w-36 animate-pulse rounded-sm bg-muted/40" />
        <div className="h-24 animate-pulse rounded-sm bg-muted/30" />
      </div>
    </div>
  )
}

function DetailSkeleton() {
  return (
    <div className={cn(panelClass, 'min-h-[420px] space-y-5 p-5')} aria-label="Loading Library item detail">
      <div className="flex justify-between gap-4">
        <div className="w-full space-y-3">
          <div className="h-5 w-28 animate-pulse rounded-sm bg-muted/40" />
          <div className="h-8 w-3/4 animate-pulse rounded-sm bg-muted/40" />
          <div className="h-5 w-full animate-pulse rounded-sm bg-muted/30" />
        </div>
        <div className="h-16 w-20 animate-pulse rounded-sm bg-muted/30" />
      </div>
      <div className="grid gap-3 sm:grid-cols-3">
        {[0, 1, 2].map((index) => <div key={index} className="h-16 animate-pulse rounded-sm bg-muted/30" />)}
      </div>
      <div className="h-36 animate-pulse rounded-sm bg-muted/30" />
      <div className="h-20 animate-pulse rounded-sm bg-muted/30" />
    </div>
  )
}

function CreateItemModal({
  open,
  form,
  error,
  pending,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean
  form: CreateFormState
  error: string | null
  pending: boolean
  onClose: () => void
  onChange: (next: CreateFormState) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <AccessibleModal
      open={open}
      title="Add Library item"
      description="Create a source-backed candidate or trusted item manually."
      onClose={onClose}
      closeDisabled={pending}
    >
      <form onSubmit={onSubmit} className="space-y-4">
        {error && <ActionNotice message={error} />}
        <FormField label="Title" required>
          <Input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} placeholder="Short reusable title" disabled={pending} />
        </FormField>
        <FormField label="Claim" required>
          <Input value={form.claim} onChange={(event) => onChange({ ...form, claim: event.target.value })} placeholder="The reusable claim this item captures" disabled={pending} />
        </FormField>
        <FormField label="Body" required>
          <Textarea value={form.body} onChange={(event) => onChange({ ...form, body: event.target.value })} placeholder="Why this is useful and how it should be interpreted." disabled={pending} className="min-h-[130px]" />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Category">
            <select value={form.category} onChange={(event) => onChange({ ...form, category: event.target.value as LibraryCategory })} className={cn(fieldClass, 'w-full')} disabled={pending}>
              {CATEGORIES.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}
            </select>
          </FormField>
          <FormField label="Save as">
            <select value={form.status} onChange={(event) => onChange({ ...form, status: event.target.value as CreateFormState['status'] })} className={cn(fieldClass, 'w-full')} disabled={pending}>
              <option value="review">Review candidate</option>
              <option value="validated">Trusted item</option>
            </select>
          </FormField>
          <FormField label="Scope">
            <select value={form.scope} onChange={(event) => onChange({ ...form, scope: event.target.value as LibraryScope })} className={cn(fieldClass, 'w-full')} disabled={pending}>
              <option value="agent">Agent</option>
              <option value="network">Network</option>
            </select>
          </FormField>
          <FormField label="Visibility">
            <select value={form.visibility} onChange={(event) => onChange({ ...form, visibility: event.target.value as LibraryVisibility })} className={cn(fieldClass, 'w-full')} disabled={pending}>
              <option value="agent">Agent</option>
              <option value="network">Network</option>
              <option value="private">Private</option>
            </select>
          </FormField>
        </div>
        <FormField label="Tags">
          <Input value={form.tags} onChange={(event) => onChange({ ...form, tags: event.target.value })} placeholder="constraints, profile, strategy" disabled={pending} />
        </FormField>
        <div className="grid gap-3 sm:grid-cols-2">
          <FormField label="Source title">
            <Input value={form.sourceTitle} onChange={(event) => onChange({ ...form, sourceTitle: event.target.value })} placeholder="Manual note title" disabled={pending} />
          </FormField>
          <FormField label="Evidence summary">
            <Input value={form.evidenceSummary} onChange={(event) => onChange({ ...form, evidenceSummary: event.target.value })} placeholder="Short source-backed reason" disabled={pending} />
          </FormField>
        </div>
        <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
          <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
          <Button type="submit" disabled={pending} className="gap-2">
            <Plus className="h-4 w-4" aria-hidden="true" />
            {pending ? 'Creating...' : 'Create item'}
          </Button>
        </div>
      </form>
    </AccessibleModal>
  )
}

function RationaleModal({
  action,
  value,
  error,
  pending,
  resolveOutcome,
  onClose,
  onChange,
  onResolveOutcomeChange,
  onSubmit,
}: {
  action: RationaleAction | null
  value: string
  error: string | null
  pending: boolean
  resolveOutcome: ResolveOutcome
  onClose: () => void
  onChange: (value: string) => void
  onResolveOutcomeChange: (value: ResolveOutcome) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const config = action ? RATIONALE_LABELS[action] : null
  return (
    <AccessibleModal
      open={Boolean(action && config)}
      title={config?.title || 'Action rationale'}
      description="A rationale keeps the Library audit trail inspectable."
      onClose={onClose}
      closeDisabled={pending}
    >
      {config && (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <ActionNotice message={error} />}
          {action === 'resolve' && (
            <FormField label="Resolution outcome">
              <select
                value={resolveOutcome}
                onChange={(event) => onResolveOutcomeChange(event.target.value as ResolveOutcome)}
                className={cn(fieldClass, 'w-full')}
                disabled={pending}
              >
                <option value="validated">Return to validated knowledge</option>
                <option value="retired">Retire after resolving</option>
              </select>
            </FormField>
          )}
          <FormField label={config.field} required>
            <Textarea
              value={value}
              onChange={(event) => onChange(event.target.value)}
              className="min-h-[150px]"
              disabled={pending}
              placeholder="Add the evidence, concern, or decision reason."
            />
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending} className="gap-2">
              {action === 'retire' ? <Archive className="h-4 w-4" aria-hidden="true" /> : <Check className="h-4 w-4" aria-hidden="true" />}
              {pending ? `${config.submit}...` : config.submit}
            </Button>
          </div>
        </form>
      )}
    </AccessibleModal>
  )
}

function EditAcceptModal({
  open,
  form,
  error,
  pending,
  onClose,
  onChange,
  onSubmit,
}: {
  open: boolean
  form: EditAcceptFormState | null
  error: string | null
  pending: boolean
  onClose: () => void
  onChange: (next: EditAcceptFormState | null) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  return (
    <AccessibleModal
      open={open && Boolean(form)}
      title="Edit and accept"
      description="Adjust the reusable claim before moving it into validated knowledge."
      onClose={onClose}
      closeDisabled={pending}
    >
      {form && (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <ActionNotice message={error} />}
          <FormField label="Title" required>
            <Input value={form.title} onChange={(event) => onChange({ ...form, title: event.target.value })} disabled={pending} />
          </FormField>
          <FormField label="Claim" required>
            <Input value={form.claim} onChange={(event) => onChange({ ...form, claim: event.target.value })} disabled={pending} />
          </FormField>
          <FormField label="Body" required>
            <Textarea value={form.body} onChange={(event) => onChange({ ...form, body: event.target.value })} className="min-h-[130px]" disabled={pending} />
          </FormField>
          <div className="grid gap-3 sm:grid-cols-2">
            <FormField label="Category">
              <select value={form.category} onChange={(event) => onChange({ ...form, category: event.target.value as LibraryCategory })} className={cn(fieldClass, 'w-full')} disabled={pending}>
                {CATEGORIES.map((category) => <option key={category} value={category}>{labelize(category)}</option>)}
              </select>
            </FormField>
            <FormField label="Tags">
              <Input value={form.tags} onChange={(event) => onChange({ ...form, tags: event.target.value })} disabled={pending} />
            </FormField>
          </div>
          <FormField label="Related agent IDs">
            <Input value={form.relatedAgentIds} onChange={(event) => onChange({ ...form, relatedAgentIds: event.target.value })} disabled={pending} />
          </FormField>
          <FormField label="Acceptance rationale">
            <Textarea value={form.rationale} onChange={(event) => onChange({ ...form, rationale: event.target.value })} className="min-h-[90px]" disabled={pending} />
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending} className="gap-2">
              <Edit3 className="h-4 w-4" aria-hidden="true" />
              {pending ? 'Saving...' : 'Save and accept'}
            </Button>
          </div>
        </form>
      )}
    </AccessibleModal>
  )
}

function GovernanceModal({
  action,
  detail,
  targetItemId,
  rationale,
  error,
  pending,
  onClose,
  onTargetChange,
  onRationaleChange,
  onSubmit,
}: {
  action: GovernanceAction | null
  detail: LibraryItemDetailResponse | null
  targetItemId: string
  rationale: string
  error: string | null
  pending: boolean
  onClose: () => void
  onTargetChange: (value: string) => void
  onRationaleChange: (value: string) => void
  onSubmit: (event: FormEvent<HTMLFormElement>) => void
}) {
  const title = action === 'merge' ? 'Merge duplicate item' : 'Supersede outdated item'
  const description = action === 'merge'
    ? 'Merge keeps this item as retired audit history and copies source references onto the target.'
    : 'Supersede retires this outdated item and links it to a validated replacement.'
  const suggestions = (detail?.relatedItems || []).filter((item) => (
    item.status !== 'retired' &&
    item.status !== 'rejected' &&
    !item.mergedIntoItemId &&
    (action !== 'supersede' || item.status === 'validated')
  )).slice(0, 8)

  return (
    <AccessibleModal
      open={Boolean(action && detail)}
      title={title}
      description={description}
      onClose={onClose}
      closeDisabled={pending}
    >
      {action && detail && (
        <form onSubmit={onSubmit} className="space-y-4">
          {error && <ActionNotice message={error} />}
          <div className="rounded-sm border border-border/60 bg-background/25 p-3">
            <div className="text-xs text-muted-foreground">Current item</div>
            <div className="mt-1 break-words text-sm font-semibold text-foreground">{detail.item.title}</div>
            <p className="mt-1 break-words text-sm leading-6 text-muted-foreground">{detail.item.claim}</p>
          </div>

          {suggestions.length > 0 && (
            <div className="space-y-2">
              <div className="text-sm font-medium text-foreground">Suggested targets</div>
              <div className="space-y-2">
                {suggestions.map((suggestion) => (
                  <button
                    key={suggestion.id}
                    type="button"
                    onClick={() => onTargetChange(suggestion.id)}
                    disabled={pending}
                    className={cn(
                      'w-full rounded-sm border p-3 text-left transition',
                      focusClass,
                      targetItemId === suggestion.id
                        ? 'border-primary/45 bg-primary/10'
                        : 'border-border/60 bg-background/25 hover:border-primary/30'
                    )}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="break-words text-sm font-semibold text-foreground">{suggestion.title}</div>
                        <p className="mt-1 line-clamp-2 break-words text-sm leading-5 text-muted-foreground">{suggestion.claim}</p>
                      </div>
                      <StatusBadge status={suggestion.status} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

          <FormField label="Target item ID" required>
            <Input
              value={targetItemId}
              onChange={(event) => onTargetChange(event.target.value)}
              placeholder="library_item_..."
              disabled={pending}
            />
          </FormField>
          <FormField label="Governance rationale" required>
            <Textarea
              value={rationale}
              onChange={(event) => onRationaleChange(event.target.value)}
              className="min-h-[120px]"
              disabled={pending}
              placeholder="Record why this merge or supersede decision is correct."
            />
          </FormField>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="outline" onClick={onClose} disabled={pending}>Cancel</Button>
            <Button type="submit" disabled={pending} className="gap-2">
              {action === 'merge' ? <Link2 className="h-4 w-4" aria-hidden="true" /> : <Archive className="h-4 w-4" aria-hidden="true" />}
              {pending ? (action === 'merge' ? 'Merging...' : 'Superseding...') : (action === 'merge' ? 'Merge item' : 'Supersede item')}
            </Button>
          </div>
        </form>
      )}
    </AccessibleModal>
  )
}

function AccessibleModal({
  open,
  title,
  description,
  closeDisabled = false,
  onClose,
  children,
}: {
  open: boolean
  title: string
  description: string
  closeDisabled?: boolean
  onClose: () => void
  children: ReactNode
}) {
  const titleId = useId()
  const descriptionId = useId()
  const modalRef = useRef<HTMLDivElement>(null)
  const previousFocusRef = useRef<HTMLElement | null>(null)

  useEffect(() => {
    if (!open) return

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null
    const modal = modalRef.current
    const focusable = getFocusableElements(modal)
    window.setTimeout(() => {
      const first = focusable[0] || modal
      first?.focus()
    }, 0)

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && !closeDisabled) {
        event.preventDefault()
        onClose()
        return
      }

      if (event.key !== 'Tab') return

      const elements = getFocusableElements(modalRef.current)
      if (elements.length === 0) {
        event.preventDefault()
        modalRef.current?.focus()
        return
      }

      const first = elements[0]
      const last = elements[elements.length - 1]

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      previousFocusRef.current?.focus()
    }
  }, [closeDisabled, onClose, open])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/55 p-4 backdrop-blur-md"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !closeDisabled) onClose()
      }}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
        tabIndex={-1}
        className={cn(panelClass, 'max-h-[90vh] w-full max-w-2xl overflow-y-auto p-5 outline-none')}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div>
            <h2 id={titleId} className="text-xl font-semibold text-foreground">{title}</h2>
            <p id={descriptionId} className="mt-2 text-sm leading-6 text-muted-foreground">{description}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={closeDisabled}
            aria-label="Close modal"
            className={cn('inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-sm border border-border/70 bg-background/40 text-muted-foreground transition hover:text-foreground disabled:opacity-50', focusClass)}
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function getFocusableElements(container: HTMLElement | null): HTMLElement[] {
  if (!container) return []
  return Array.from(
    container.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
    )
  ).filter((element) => !element.hasAttribute('disabled') && element.getAttribute('aria-hidden') !== 'true')
}

function FormField({ label, required = false, children }: { label: string; required?: boolean; children: ReactNode }) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">
        {label}
        {required && <span className="text-rose-500"> *</span>}
      </span>
      {children}
    </label>
  )
}

function ActionNotice({ message }: { message: string }) {
  return (
    <div className="flex items-start gap-2 rounded-sm border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <span>{message}</span>
    </div>
  )
}

export default KnowledgeLibraryWorkspace
