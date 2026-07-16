'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Archive,
  BrainCircuit,
  CalendarDays,
  Check,
  ChevronRight,
  CircleDot,
  Clipboard,
  Clock3,
  Copy,
  Database,
  GitBranch,
  Link2,
  Network,
  RefreshCw,
  RotateCcw,
  Search,
  ShieldCheck,
  Sparkles,
  Tags,
  Trash2,
} from 'lucide-react'
import type {
  MemoryGraphConsoleSummary,
  MemoryOrigin,
  MemoryRecallResult,
  MemoryRecord,
  MemoryStatsSummary,
} from '@/types/database'
import { cn } from '@/lib/utils'

interface MemoryConsoleProps {
  agentId: string
  agentName: string
  refreshToken?: number
  onMemoryCountChange?: (count: number) => void
  onMemoryMutation?: () => void | Promise<void>
}

const panelClass = 'overflow-hidden rounded-xl border border-[#2d4058] bg-[#0c1726] shadow-[0_12px_30px_rgba(0,0,0,0.16)]'
const quietPanelClass = 'rounded-lg border border-[#263950] bg-[#101c2b]'
const eyebrowClass = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8da0b7]'

const MEMORY_TYPES: Array<{ value: 'all' | MemoryRecord['type']; label: string }> = [
  { value: 'all', label: 'All types' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'conversation_episode', label: 'Episode' },
  { value: 'fact', label: 'Fact' },
  { value: 'interaction', label: 'Interaction' },
  { value: 'preference', label: 'Preference' },
  { value: 'project', label: 'Project' },
  { value: 'relationship', label: 'Relationship' },
  { value: 'identity', label: 'Identity' },
  { value: 'operating_constraint', label: 'Constraint' },
  { value: 'artifact_summary', label: 'Artifact' },
  { value: 'tension_snapshot', label: 'Tension' },
]

const MEMORY_ORIGINS: Array<{ value: 'all' | MemoryOrigin; label: string }> = [
  { value: 'all', label: 'All origins' },
  { value: 'conversation', label: 'Conversation' },
  { value: 'tool', label: 'Tool' },
  { value: 'manual', label: 'Manual' },
  { value: 'system', label: 'System' },
  { value: 'imported', label: 'Imported' },
]

function humanize(value?: string) {
  if (!value) return 'Not recorded'
  return value.replace(/[_:-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function formatDate(value?: string) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(value))
}

function formatDateTime(value?: string) {
  if (!value) return 'Not recorded'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' }).format(new Date(value))
}

function formatRelativeTime(value?: string) {
  if (!value) return 'Not recorded'
  const elapsed = Math.max(0, Date.now() - Date.parse(value))
  const minutes = Math.floor(elapsed / 60_000)
  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return days === 1 ? '1d ago' : `${days}d ago`
}

function confidenceLabel(value?: number) {
  return typeof value === 'number' ? value.toFixed(2) : 'Not scored'
}

function typeAccent(type: MemoryRecord['type']) {
  if (type === 'relationship' || type === 'identity') return '#91d4ae'
  if (type === 'fact' || type === 'project') return '#8ac9dc'
  if (type === 'tension_snapshot') return '#e7bb70'
  return '#b9addd'
}

function memoryReferenceCount(memory: MemoryRecord) {
  return memory.linkedMessageIds.length + (memory.evidenceRefs?.length || 0) + (memory.sourceRefs?.length || 0)
}

function InspectorField({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={quietPanelClass}>
      <p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8da0b7]">{label}</p>
      <p className="truncate px-3 pb-2.5 pt-1 text-xs font-semibold" style={{ color: tone || '#dce8f6' }}>{value}</p>
    </div>
  )
}

function SelectField<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
  ariaLabel: string
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      aria-label={ariaLabel}
      className="h-8 w-full rounded-md border border-[#30445d] bg-[#101c2b] px-2.5 text-xs font-medium text-[#cbd8e6] outline-none transition-colors focus:border-[#b9addd] focus-visible:ring-2 focus-visible:ring-[#b9addd]"
    >
      {options.map((option) => <option key={option.value} value={option.value} className="bg-[#101c2b] text-[#dce8f6]">{option.label}</option>)}
    </select>
  )
}

export function MemoryConsole({
  agentId,
  agentName,
  refreshToken = 0,
  onMemoryCountChange,
  onMemoryMutation,
}: MemoryConsoleProps) {
  const [memories, setMemories] = useState<MemoryRecord[]>([])
  const [stats, setStats] = useState<MemoryStatsSummary | null>(null)
  const [graph, setGraph] = useState<MemoryGraphConsoleSummary | null>(null)
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null)
  const [draftSearchQuery, setDraftSearchQuery] = useState('')
  const [searchQuery, setSearchQuery] = useState('')
  const [typeFilter, setTypeFilter] = useState<'all' | MemoryRecord['type']>('all')
  const [originFilter, setOriginFilter] = useState<'all' | MemoryOrigin>('all')
  const [sort, setSort] = useState<'newest' | 'oldest' | 'importance'>('newest')
  const [minImportance, setMinImportance] = useState(0)
  const [recallQuery, setRecallQuery] = useState('')
  const [recallResults, setRecallResults] = useState<MemoryRecallResult[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recalling, setRecalling] = useState(false)
  const [deletingMemoryId, setDeletingMemoryId] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadConsoleData = useCallback(async (showRefreshState = false) => {
    try {
      setError(null)
      if (showRefreshState) setRefreshing(true)
      else setLoading(true)

      const params = new URLSearchParams({ sort })
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (originFilter !== 'all') params.set('origin', originFilter)
      if (minImportance > 0) params.set('minImportance', String(minImportance))

      const [memoriesResponse, statsResponse] = await Promise.all([
        fetch(`/api/agents/${agentId}/memories?${params.toString()}`, { cache: 'no-store' }),
        fetch(`/api/agents/${agentId}/memories/stats`, { cache: 'no-store' }),
      ])

      if (!memoriesResponse.ok || !statsResponse.ok) throw new Error('Memory records could not be loaded')

      const memoriesPayload = await memoriesResponse.json() as { memories: MemoryRecord[]; graph: MemoryGraphConsoleSummary | null }
      const statsPayload = await statsResponse.json() as { stats: MemoryStatsSummary }
      const nextMemories = memoriesPayload.memories || []

      setMemories(nextMemories)
      setGraph(memoriesPayload.graph || null)
      setStats(statsPayload.stats || null)
      onMemoryCountChange?.(statsPayload.stats?.totalMemories || 0)
      setSelectedMemoryId((current) => current && nextMemories.some((memory) => memory.id === current) ? current : nextMemories[0]?.id || null)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Memory records could not be loaded')
      setMemories([])
      setGraph(null)
      setStats(null)
      setSelectedMemoryId(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [agentId, minImportance, onMemoryCountChange, originFilter, searchQuery, sort, typeFilter])

  useEffect(() => {
    void loadConsoleData()
  }, [loadConsoleData, refreshToken])

  const selectedMemory = useMemo(
    () => memories.find((memory) => memory.id === selectedMemoryId) || null,
    [memories, selectedMemoryId]
  )

  useEffect(() => setCopied(false), [selectedMemory?.id])

  const handleApplySearch = () => setSearchQuery(draftSearchQuery)

  const handleResetFilters = () => {
    setDraftSearchQuery('')
    setSearchQuery('')
    setTypeFilter('all')
    setOriginFilter('all')
    setSort('newest')
    setMinImportance(0)
    setRecallResults([])
  }

  const handleRecall = async () => {
    const query = recallQuery.trim()
    if (!query) {
      setRecallResults([])
      return
    }

    try {
      setRecalling(true)
      const response = await fetch(`/api/agents/${agentId}/memories/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query, limit: 6 }),
      })
      if (!response.ok) throw new Error('Recall could not be completed')
      const payload = await response.json() as { results: MemoryRecallResult[] }
      setRecallResults(payload.results || [])
    } catch (nextError) {
      setRecallResults([])
      setError(nextError instanceof Error ? nextError.message : 'Recall could not be completed')
    } finally {
      setRecalling(false)
    }
  }

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      setDeletingMemoryId(memoryId)
      const response = await fetch(`/api/agents/${agentId}/memories/${memoryId}`, { method: 'DELETE' })
      if (!response.ok) throw new Error('Memory could not be scrubbed')
      await loadConsoleData(true)
      await onMemoryMutation?.()
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Memory could not be scrubbed')
    } finally {
      setDeletingMemoryId(null)
    }
  }

  const copyMemoryReference = async () => {
    if (!selectedMemory) return
    try {
      await navigator.clipboard.writeText(selectedMemory.id)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  const lastSync = stats?.lastSavedAt || graph?.lastUpdated
  const topCluster = graph?.conceptClusters[0]

  return (
    <section className="w-full space-y-3" aria-label={`${agentName} memory console`}>
      <header className="flex flex-col gap-3 border-b border-[#263950] pb-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#b9addd]/45 bg-[#b9addd]/12 text-[#d2c4f2]"><BrainCircuit className="h-5 w-5" aria-hidden="true" /></span>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-[#edf3fb]">Memory Console</h1>
            <p className="mt-0.5 truncate text-xs text-[#9db0c7]">What {agentName} can actually recall, retain, and ground in evidence.</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          <StatCell label="Stored" value={stats?.totalMemories || 0} tone="#8ac9dc" />
          <StatCell label="High impact" value={stats?.highImportanceMemories || 0} tone="#e7bb70" />
          <StatCell label="Types" value={Object.keys(stats?.memoriesByType || {}).length} tone="#b9addd" />
          <StatCell label="Last sync" value={formatRelativeTime(lastSync)} tone="#91d4ae" />
        </div>
      </header>

      <div className="grid gap-3 xl:h-[calc(100vh-232px)] xl:min-h-[680px] xl:grid-cols-[minmax(0,1fr)_minmax(400px,0.78fr)]">
        <div className="flex min-h-0 flex-col gap-3">
          <section className={panelClass} aria-label="Memory filters">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-[#263950] px-4 py-2.5">
              <div className="flex items-center gap-2"><Database className="h-4 w-4 text-[#b9addd]" aria-hidden="true" /><h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#dce8f6]">Data query</h2></div>
              <div className="flex items-center gap-1.5">
                <button type="button" onClick={() => void loadConsoleData(true)} disabled={refreshing} className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[#30445d] bg-[#101c2b] px-2 text-[10px] font-semibold text-[#b8c8da] hover:text-[#edf3fb] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9addd]"><RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />Sync</button>
                <button type="button" onClick={handleResetFilters} className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[#30445d] bg-[#101c2b] px-2 text-[10px] font-semibold text-[#b8c8da] hover:text-[#edf3fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9addd]"><RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />Reset</button>
              </div>
            </div>
            <div className="space-y-2.5 p-3">
              <div className="flex gap-2">
                <label className="sr-only" htmlFor="memory-search">Search stored memories</label>
                <input id="memory-search" value={draftSearchQuery} onChange={(event) => setDraftSearchQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && handleApplySearch()} placeholder="Search summaries, exact quotes, source refs, or context…" className="h-9 min-w-0 flex-1 rounded-md border border-[#30445d] bg-[#101c2b] px-3 text-xs text-[#edf3fb] outline-none placeholder:text-[#71849c] focus:border-[#b9addd] focus-visible:ring-2 focus-visible:ring-[#b9addd]" />
                <button type="button" onClick={handleApplySearch} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#b9addd] bg-[#b9addd] px-3 text-xs font-semibold text-[#171a28] hover:bg-[#d2c4f2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edf3fb]"><Search className="h-3.5 w-3.5" aria-hidden="true" />Search</button>
              </div>
              <div className="grid grid-cols-2 gap-2 lg:grid-cols-4">
                <SelectField value={typeFilter} onChange={setTypeFilter} options={MEMORY_TYPES} ariaLabel="Filter memories by type" />
                <SelectField value={originFilter} onChange={setOriginFilter} options={MEMORY_ORIGINS} ariaLabel="Filter memories by origin" />
                <SelectField value={sort} onChange={setSort} ariaLabel="Sort memories" options={[{ value: 'newest', label: 'Newest first' }, { value: 'oldest', label: 'Oldest first' }, { value: 'importance', label: 'Highest impact' }]} />
                <SelectField value={String(minImportance)} onChange={(value) => setMinImportance(Number(value))} ariaLabel="Filter memories by minimum impact" options={[{ value: '0', label: 'Any impact' }, { value: '4', label: 'Impact 4+' }, { value: '6', label: 'Impact 6+' }, { value: '8', label: 'Impact 8+' }]} />
              </div>
            </div>
          </section>

          <section className={cn(panelClass, 'flex min-h-0 flex-1 flex-col')} aria-label="Stored memory index">
            <div className="flex items-center justify-between gap-3 border-b border-[#263950] px-4 py-2.5">
              <div className="flex items-center gap-2"><Archive className="h-4 w-4 text-[#b9addd]" aria-hidden="true" /><h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#dce8f6]">Stored index</h2></div>
              <div className="flex items-center gap-3 text-[11px]"><span className="font-medium text-[#9db0c7]">{memories.length} result{memories.length === 1 ? '' : 's'}</span><span className="text-[#8ac9dc]">Avg {stats?.averageImportance || 0}/10</span></div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto">
              {error && <div className="m-3 rounded-lg border border-[#e38b8c]/40 bg-[#301c25] px-3 py-2 text-xs text-[#f0bac2]" role="status">{error}</div>}
              {loading ? <MemoryIndexSkeleton /> : memories.length === 0 ? <EmptyIndex /> : <ol className="divide-y divide-[#263950]">{memories.map((memory, index) => <MemoryIndexRow key={memory.id} memory={memory} index={index} selected={memory.id === selectedMemoryId} onSelect={() => setSelectedMemoryId(memory.id)} />)}</ol>}
            </div>
          </section>

          <section className={panelClass} aria-label="Memory lifecycle structure">
            <div className="flex flex-wrap items-center gap-2 px-4 py-2.5">
              <div className="mr-1"><p className={eyebrowClass}>Recall structure</p><p className="mt-0.5 text-[11px] text-[#9db0c7]">From conversation trace to durable recall.</p></div>
              <LifecycleStep icon={Clipboard} label="Conversation" value={String(stats?.memoriesByType.conversation || 0)} tone="#8ac9dc" />
              <ChevronRight className="h-4 w-4 text-[#6f8299]" aria-hidden="true" />
              <LifecycleStep icon={Database} label="Semantic facts" value={String(Object.values(stats?.memoriesByType || {}).reduce((sum, count) => sum + count, 0))} tone="#91d4ae" />
              <ChevronRight className="h-4 w-4 text-[#6f8299]" aria-hidden="true" />
              <LifecycleStep icon={Network} label="Graph concepts" value={String(graph?.totalConcepts || 0)} tone="#b9addd" />
              <ChevronRight className="h-4 w-4 text-[#6f8299]" aria-hidden="true" />
              <LifecycleStep icon={Clock3} label="Linked refs" value={String(memories.reduce((sum, memory) => sum + memoryReferenceCount(memory), 0))} tone="#e7bb70" />
            </div>
          </section>
        </div>

        <div className="flex min-h-0 flex-col gap-3">
          <section className={cn(panelClass, 'flex h-[278px] shrink-0 flex-col')} aria-label="Semantic memory recall">
            <div className="flex items-center gap-2 border-b border-[#263950] px-4 py-2.5"><Network className="h-4 w-4 text-[#8ac9dc]" aria-hidden="true" /><h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#dce8f6]">Semantic recall test</h2></div>
            <div className="border-b border-[#263950] p-3">
              <label className="sr-only" htmlFor="semantic-recall">Ask the memory system a question</label>
              <div className="flex gap-2"><input id="semantic-recall" value={recallQuery} onChange={(event) => setRecallQuery(event.target.value)} onKeyDown={(event) => event.key === 'Enter' && void handleRecall()} placeholder="e.g. Do you remember what I said about…" className="h-9 min-w-0 flex-1 rounded-md border border-[#30445d] bg-[#101c2b] px-3 text-xs text-[#edf3fb] outline-none placeholder:text-[#71849c] focus:border-[#8ac9dc] focus-visible:ring-2 focus-visible:ring-[#8ac9dc]" /><button type="button" onClick={() => void handleRecall()} disabled={recalling} className="inline-flex min-h-9 items-center gap-1.5 rounded-md border border-[#8ac9dc] bg-[#8ac9dc] px-3 text-xs font-semibold text-[#10202a] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edf3fb]">{recalling ? <RefreshCw className="h-3.5 w-3.5 animate-spin" aria-hidden="true" /> : <Search className="h-3.5 w-3.5" aria-hidden="true" />}Recall</button></div>
              <div className="mt-2 grid grid-cols-2 gap-2"><GraphMetric icon={GitBranch} label="Graph" value={`${graph?.totalConcepts || 0} concepts, ${graph?.totalLinks || 0} links`} tone="#8ac9dc" /><GraphMetric icon={Sparkles} label="Top cluster" value={topCluster?.name || 'No active cluster'} tone="#b9addd" /></div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto px-3 py-2.5">
              {recallResults.length > 0 ? <RecallResults results={recallResults} onSelect={setSelectedMemoryId} /> : <ConceptLandscape graph={graph} />}
            </div>
          </section>

          <MemoryInspector memory={selectedMemory} graph={graph} copied={copied} onCopy={() => void copyMemoryReference()} onDelete={() => selectedMemory && void handleDeleteMemory(selectedMemory.id)} deleting={deletingMemoryId === selectedMemory?.id} />
        </div>
      </div>
    </section>
  )
}

function StatCell({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return <div className="min-w-[84px] rounded-lg border border-[#263950] bg-[#101c2b] px-3 py-2 text-center"><p className="text-[9px] font-semibold uppercase tracking-[0.12em] text-[#8da0b7]">{label}</p><p className="mt-0.5 text-sm font-semibold" style={{ color: tone }}>{value}</p></div>
}

function GraphMetric({ icon: Icon, label, value, tone }: { icon: typeof Network; label: string; value: string; tone: string }) {
  return <div className={quietPanelClass}><div className="flex items-center gap-2 px-3 py-2"><Icon className="h-4 w-4 shrink-0" style={{ color: tone }} aria-hidden="true" /><div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-[0.11em] text-[#8da0b7]">{label}</p><p className="truncate text-xs font-medium text-[#dce8f6]">{value}</p></div></div></div>
}

function LifecycleStep({ icon: Icon, label, value, tone }: { icon: typeof Network; label: string; value: string; tone: string }) {
  return <div className="flex min-w-[112px] items-center gap-2 rounded-md border px-2.5 py-1.5" style={{ borderColor: `${tone}66`, backgroundColor: `${tone}10` }}><Icon className="h-4 w-4" style={{ color: tone }} aria-hidden="true" /><div><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#aebed0]">{label}</p><p className="text-xs font-semibold" style={{ color: tone }}>{value}</p></div></div>
}

function MemoryIndexRow({ memory, index, selected, onSelect }: { memory: MemoryRecord; index: number; selected: boolean; onSelect: () => void }) {
  const accent = typeAccent(memory.type)
  return (
    <li>
      <button type="button" onClick={onSelect} aria-pressed={selected} className="group grid w-full grid-cols-[34px_minmax(0,1fr)_142px_18px] gap-3 px-4 py-3 text-left transition-colors hover:bg-[#101c2b] focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b9addd]" style={selected ? { backgroundColor: `${accent}0d`, boxShadow: `inset 3px 0 0 ${accent}` } : undefined}>
        <span className="mt-1 grid h-7 w-7 place-items-center rounded-md border text-xs font-semibold" style={{ color: accent, borderColor: `${accent}66`, backgroundColor: `${accent}12` }}>{index + 1}</span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-1.5"><span className="rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: accent, borderColor: `${accent}55`, backgroundColor: `${accent}10` }}>{humanize(memory.type)}</span><span className="rounded-md border border-[#30445d] bg-[#101c2b] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9db0c7]">{humanize(memory.origin)}</span></span>
          <span className="mt-1.5 block truncate text-sm font-semibold text-[#e5edf7]">{memory.summary}</span>
          <span className="mt-1 block line-clamp-2 text-xs leading-4 text-[#aebed0]">{memory.context || memory.content}</span>
          {memory.keywords.length > 0 && <span className="mt-2 flex flex-wrap gap-1">{memory.keywords.slice(0, 4).map((keyword) => <span key={`${memory.id}:${keyword}`} className="rounded border border-[#30445d] bg-[#101c2b] px-1.5 py-0.5 text-[9px] text-[#9db0c7]">#{keyword}</span>)}</span>}
        </span>
        <span className="hidden border-l border-[#263950] pl-3 text-[11px] leading-5 text-[#9db0c7] sm:block"><span className="flex items-center gap-1.5"><ShieldCheck className="h-3.5 w-3.5 text-[#91d4ae]" aria-hidden="true" />Confidence <b className="ml-auto font-semibold text-[#dce8f6]">{confidenceLabel(memory.confidence)}</b></span><span className="flex items-center gap-1.5"><CalendarDays className="h-3.5 w-3.5 text-[#8da0b7]" aria-hidden="true" />{formatDate(memory.timestamp)}</span><span className="flex items-center gap-1.5"><Link2 className="h-3.5 w-3.5 text-[#8da0b7]" aria-hidden="true" />{memoryReferenceCount(memory)} preserved refs</span><span className="mt-1 inline-flex rounded border border-[#e7bb70]/40 bg-[#e7bb70]/10 px-1.5 py-0.5 font-semibold text-[#e7bb70]">Impact {memory.importance}/10</span></span>
        <ChevronRight className="mt-2 h-4 w-4 text-[#71849c] transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
      </button>
    </li>
  )
}

function RecallResults({ results, onSelect }: { results: MemoryRecallResult[]; onSelect: (id: string) => void }) {
  return <div><p className="mb-2 text-[11px] font-medium text-[#9db0c7]">Matched {results.length} candidate memor{results.length === 1 ? 'y' : 'ies'}</p><ol className="space-y-1.5">{results.map((result, index) => <li key={result.memory.id}><button type="button" onClick={() => onSelect(result.memory.id)} className="flex w-full items-center gap-2 rounded-md border border-[#263950] bg-[#101c2b] px-2.5 py-2 text-left hover:border-[#8ac9dc]/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#8ac9dc]"><span className="grid h-5 w-5 place-items-center rounded-full text-[10px] font-bold" style={{ color: typeAccent(result.memory.type), backgroundColor: `${typeAccent(result.memory.type)}20` }}>{index + 1}</span><span className="min-w-0 flex-1"><span className="block truncate text-xs font-semibold text-[#dce8f6]">{result.memory.summary}</span><span className="mt-0.5 block truncate text-[10px] text-[#8da0b7]">{result.reasons[0] || `${humanize(result.hitType)} match`}</span></span><span className="text-[10px] font-semibold text-[#8ac9dc]">{confidenceLabel(result.memory.confidence)}</span></button></li>)}</ol></div>
}

function ConceptLandscape({ graph }: { graph: MemoryGraphConsoleSummary | null }) {
  if (!graph?.topConcepts.length) return <div className="flex h-full items-center justify-center text-center text-xs text-[#8da0b7]">No graph concepts are indexed for this agent yet.</div>
  return <div><p className="mb-2 text-[11px] font-medium text-[#9db0c7]">Top indexed concepts</p><div className="flex flex-wrap gap-1.5">{graph.topConcepts.slice(0, 8).map((concept) => <span key={concept.id} className="inline-flex items-center gap-1.5 rounded-md border border-[#30445d] bg-[#101c2b] px-2 py-1 text-[10px] text-[#cbd8e6]"><CircleDot className="h-3 w-3 text-[#8ac9dc]" aria-hidden="true" />{concept.name}<b className="font-semibold text-[#91d4ae]">{concept.memoryCount}</b></span>)}</div></div>
}

function MemoryInspector({ memory, graph, copied, onCopy, onDelete, deleting }: { memory: MemoryRecord | null; graph: MemoryGraphConsoleSummary | null; copied: boolean; onCopy: () => void; onDelete: () => void; deleting: boolean }) {
  if (!memory) return <section className={cn(panelClass, 'flex min-h-0 flex-1 flex-col')}><div className="flex items-center gap-2 border-b border-[#263950] px-4 py-2.5"><BrainCircuit className="h-4 w-4 text-[#b9addd]" aria-hidden="true" /><h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#dce8f6]">Memory inspector</h2></div><div className="flex flex-1 flex-col items-center justify-center px-8 text-center"><BrainCircuit className="h-7 w-7 text-[#71849c]" aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold text-[#dce8f6]">Select a memory</h3><p className="mt-1 max-w-xs text-xs leading-5 text-[#8da0b7]">Choose a stored memory to inspect its source content, semantic fields, and preserved evidence.</p></div></section>

  const accent = typeAccent(memory.type)
  const evidenceCount = memory.evidenceRefs?.length || 0
  const sourceCount = memory.sourceRefs?.length || 0
  const qualityLabel = memory.qualityStatus ? humanize(memory.qualityStatus) : 'Not validated'

  return <section className={cn(panelClass, 'flex min-h-0 flex-1 flex-col')} aria-label="Selected memory inspector">
    <header className="flex flex-wrap items-center justify-between gap-2 border-b border-[#263950] px-4 py-2.5"><div className="flex min-w-0 items-center gap-2"><BrainCircuit className="h-4 w-4" style={{ color: accent }} aria-hidden="true" /><h2 className="text-xs font-semibold uppercase tracking-[0.12em] text-[#dce8f6]">Memory inspector</h2></div><div className="flex items-center gap-1.5"><button type="button" onClick={onCopy} className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[#30445d] bg-[#101c2b] px-2 text-[10px] font-semibold text-[#b8c8da] hover:text-[#edf3fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9addd]" aria-label="Copy selected memory reference">{copied ? <Check className="h-3.5 w-3.5 text-[#91d4ae]" aria-hidden="true" /> : <Copy className="h-3.5 w-3.5" aria-hidden="true" />}{copied ? 'Copied' : 'Copy ref'}</button><button type="button" onClick={onDelete} disabled={deleting} className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[#e38b8c]/55 bg-[#e38b8c]/10 px-2 text-[10px] font-semibold text-[#f0a6b4] hover:bg-[#e38b8c]/20 disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#e38b8c]"><Trash2 className="h-3.5 w-3.5" aria-hidden="true" />{deleting ? 'Scrubbing…' : 'Scrub'}</button></div></header>
    <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-3">
      <section className={quietPanelClass}><div className="p-3"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded-md border px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em]" style={{ color: accent, borderColor: `${accent}55`, backgroundColor: `${accent}10` }}>{humanize(memory.type)}</span><span className="rounded-md border border-[#30445d] bg-[#0c1726] px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-[#9db0c7]">{humanize(memory.origin)}</span></div><h3 className="mt-2 text-sm font-semibold leading-5 text-[#edf3fb]">{memory.summary}</h3><p className="mt-1 text-[11px] text-[#8da0b7]">Created {formatDateTime(memory.timestamp)}</p></div></section>
      <div className="grid grid-cols-2 gap-2"><InspectorField label="Confidence" value={confidenceLabel(memory.confidence)} tone="#8ac9dc" /><InspectorField label="Impact" value={`${memory.importance}/10`} tone="#e7bb70" /><InspectorField label="References" value={`${memoryReferenceCount(memory)} preserved`} tone="#b9addd" /><InspectorField label="Quality" value={qualityLabel} tone={memory.qualityStatus === 'passed' ? '#91d4ae' : '#b8c8da'} /></div>
      <section className={quietPanelClass}><h3 className="border-b border-[#263950] px-3 py-2 text-xs font-semibold text-[#dce8f6]">Canonical summary</h3><p className="px-3 py-2.5 text-xs leading-5 text-[#c3d0df]">{memory.canonicalValue || memory.summary}</p></section>
      <section className={quietPanelClass}><h3 className="border-b border-[#263950] px-3 py-2 text-xs font-semibold text-[#dce8f6]">Source excerpt</h3><p className="max-h-32 overflow-y-auto whitespace-pre-wrap px-3 py-2.5 text-xs leading-5 text-[#c3d0df]">{memory.content}</p></section>
      {memory.context && <section className={quietPanelClass}><h3 className="border-b border-[#263950] px-3 py-2 text-xs font-semibold text-[#dce8f6]">Recorded context</h3><p className="px-3 py-2.5 text-xs leading-5 text-[#c3d0df]">{memory.context}</p></section>}
      <div className="grid grid-cols-2 gap-2"><InspectorField label="Origin" value={humanize(memory.origin)} /><InspectorField label="Last confirmed" value={formatDate(memory.lastConfirmedAt)} /><InspectorField label="Messages" value={`${memory.linkedMessageIds.length} linked`} /><InspectorField label="Sources" value={`${sourceCount} preserved`} /></div>
      {memory.canonicalKey && <section><p className={eyebrowClass}>Canonical key</p><p className="mt-1 text-xs font-medium text-[#cbd8e6]">{humanize(memory.canonicalKey)}</p></section>}
      {memory.keywords.length > 0 && <section><p className={eyebrowClass}>Indexed themes</p><div className="mt-1.5 flex flex-wrap gap-1.5">{memory.keywords.map((keyword) => <span key={`${memory.id}:${keyword}`} className="rounded-md border border-[#30445d] bg-[#101c2b] px-2 py-1 text-[10px] text-[#b8c8da]"><Tags className="mr-1 inline h-3 w-3 text-[#b9addd]" aria-hidden="true" />{keyword}</span>)}</div></section>}
      <section className={quietPanelClass}><h3 className="border-b border-[#263950] px-3 py-2 text-xs font-semibold text-[#dce8f6]">Evidence coverage</h3><div className="grid grid-cols-3 divide-x divide-[#263950] text-center"><EvidenceCell label="Messages" value={memory.linkedMessageIds.length} /><EvidenceCell label="Evidence" value={evidenceCount} /><EvidenceCell label="Sources" value={sourceCount} /></div></section>
      {graph?.topConcepts.length ? <section className={quietPanelClass}><h3 className="border-b border-[#263950] px-3 py-2 text-xs font-semibold text-[#dce8f6]">Current graph signals</h3><div className="flex flex-wrap gap-1.5 px-3 py-2.5">{graph.topConcepts.slice(0, 5).map((concept) => <span key={concept.id} className="rounded-md border border-[#30445d] bg-[#0c1726] px-2 py-1 text-[10px] text-[#b8c8da]">{concept.name} <b className="ml-1 text-[#8ac9dc]">{concept.memoryCount}</b></span>)}</div></section> : null}
    </div>
  </section>
}

function EvidenceCell({ label, value }: { label: string; value: number }) {
  return <div className="px-2 py-2.5"><p className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[#8da0b7]">{label}</p><p className="mt-0.5 text-xs font-semibold text-[#dce8f6]">{value}</p></div>
}

function MemoryIndexSkeleton() {
  return <div className="space-y-3 p-3">{[0, 1, 2, 3].map((index) => <div key={index} className="grid animate-pulse grid-cols-[30px_minmax(0,1fr)_132px] gap-3 rounded-lg border border-[#263950] bg-[#101c2b] p-3"><div className="h-7 rounded bg-[#263950]" /><div className="space-y-2"><div className="h-3 w-3/4 rounded bg-[#263950]" /><div className="h-3 w-full rounded bg-[#1d2c3e]" /><div className="h-3 w-1/2 rounded bg-[#1d2c3e]" /></div><div className="h-14 rounded bg-[#1d2c3e]" /></div>)}</div>
}

function EmptyIndex() {
  return <div className="flex h-full min-h-64 flex-col items-center justify-center px-8 text-center"><Archive className="h-7 w-7 text-[#71849c]" aria-hidden="true" /><h3 className="mt-3 text-sm font-semibold text-[#dce8f6]">No memories match this query</h3><p className="mt-1 max-w-sm text-xs leading-5 text-[#8da0b7]">Adjust the search terms or filters to inspect a different stored memory.</p></div>
}

export default MemoryConsole
