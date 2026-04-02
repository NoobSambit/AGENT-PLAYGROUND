'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { Brain, RefreshCw, Search, Star, Trash2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import type { MemoryOrigin, MemoryRecallResult, MemoryRecord, MemoryStatsSummary } from '@/types/database'

interface MemoryConsoleProps {
  agentId: string
  agentName: string
  refreshToken?: number
  onMemoryCountChange?: (count: number) => void
  onMemoryMutation?: () => void | Promise<void>
}

const panelClass = 'rounded-sm border border-border/70 bg-card/[0.62] p-5 backdrop-blur-xl'

export function MemoryConsole({
  agentId,
  agentName,
  refreshToken = 0,
  onMemoryCountChange,
  onMemoryMutation,
}: MemoryConsoleProps) {
  const [memories, setMemories] = useState<MemoryRecord[]>([])
  const [stats, setStats] = useState<MemoryStatsSummary | null>(null)
  const [selectedMemoryId, setSelectedMemoryId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [draftSearchQuery, setDraftSearchQuery] = useState('')
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

  const loadConsoleData = useCallback(async (showRefreshState = false) => {
    try {
      if (showRefreshState) {
        setRefreshing(true)
      } else {
        setLoading(true)
      }

      const params = new URLSearchParams()
      if (searchQuery.trim()) params.set('q', searchQuery.trim())
      if (typeFilter !== 'all') params.set('type', typeFilter)
      if (originFilter !== 'all') params.set('origin', originFilter)
      if (minImportance > 0) params.set('minImportance', String(minImportance))
      params.set('sort', sort)

      const [memoriesResponse, statsResponse] = await Promise.all([
        fetch(`/api/agents/${agentId}/memories?${params.toString()}`),
        fetch(`/api/agents/${agentId}/memories/stats`),
      ])

      const memoriesPayload = memoriesResponse.ok
        ? await memoriesResponse.json() as { memories: MemoryRecord[] }
        : { memories: [] }
      const statsPayload = statsResponse.ok
        ? await statsResponse.json() as { stats: MemoryStatsSummary }
        : { stats: null }

      setMemories(memoriesPayload.memories || [])
      setStats(statsPayload.stats || null)
      onMemoryCountChange?.(statsPayload.stats?.totalMemories || 0)

      setSelectedMemoryId((current) => {
        if (current && memoriesPayload.memories?.some((memory) => memory.id === current)) {
          return current
        }
        return memoriesPayload.memories?.[0]?.id || null
      })
    } catch (error) {
      console.error('Failed to load memory console:', error)
      setMemories([])
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

  const handleDeleteMemory = async (memoryId: string) => {
    try {
      setDeletingMemoryId(memoryId)
      const response = await fetch(`/api/agents/${agentId}/memories/${memoryId}`, {
        method: 'DELETE',
      })

      if (!response.ok) {
        return
      }

      await loadConsoleData(true)
      await onMemoryMutation?.()
    } catch (error) {
      console.error('Failed to delete memory:', error)
    } finally {
      setDeletingMemoryId(null)
    }
  }

  const handleRecall = async () => {
    try {
      if (!recallQuery.trim()) {
        setRecallResults([])
        return
      }

      setRecalling(true)
      const response = await fetch(`/api/agents/${agentId}/memories/recall`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          query: recallQuery.trim(),
          limit: 6,
        }),
      })

      if (!response.ok) {
        setRecallResults([])
        return
      }

      const payload = await response.json() as { results: MemoryRecallResult[] }
      setRecallResults(payload.results || [])
    } catch (error) {
      console.error('Failed to recall memories:', error)
      setRecallResults([])
    } finally {
      setRecalling(false)
    }
  }

  const handleApplySearch = () => {
    setSearchQuery(draftSearchQuery)
  }

  const handleResetFilters = () => {
    setDraftSearchQuery('')
    setSearchQuery('')
    setTypeFilter('all')
    setOriginFilter('all')
    setSort('newest')
    setMinImportance(0)
    setRecallResults([])
  }

  return (
    <div className="space-y-6">
      <div>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Memory console</div>
        <h3 className="mt-2 text-2xl font-semibold text-foreground">What {agentName} can actually recall</h3>
        <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
          Search, filter, inspect, and remove stored memories without mixing them with separate profile or trait views.
        </p>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Active memories" value={stats?.totalMemories || 0} tone="primary" />
        <StatCard label="High importance" value={stats?.highImportanceMemories || 0} tone="accent" />
        <StatCard label="Memory types" value={Object.keys(stats?.memoriesByType || {}).length} tone="secondary" />
        <StatCard
          label="Last saved"
          value={stats?.lastSavedAt ? formatDate(stats.lastSavedAt) : 'None'}
          tone="muted"
        />
      </div>

      <div className={`${panelClass} space-y-4`}>
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 gap-3">
            <Input
              value={draftSearchQuery}
              onChange={(event) => setDraftSearchQuery(event.target.value)}
              placeholder="Search summaries, keywords, context, or raw content"
              className="h-11"
            />
            <Button variant="outline" className="gap-2" onClick={handleApplySearch}>
              <Search className="h-4 w-4" />
              Search
            </Button>
          </div>

          <div className="flex flex-wrap gap-2">
            <Button variant="outline" className="gap-2" onClick={() => void loadConsoleData(true)} disabled={refreshing}>
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
            <Button variant="ghost" onClick={handleResetFilters}>
              Reset filters
            </Button>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
          <FilterSelect
            label="Type"
            value={typeFilter}
            onChange={setTypeFilter}
            options={[
              { value: 'all', label: 'All types' },
              { value: 'conversation', label: 'Conversation' },
              { value: 'fact', label: 'Fact' },
              { value: 'interaction', label: 'Interaction' },
            ]}
          />
          <FilterSelect
            label="Origin"
            value={originFilter}
            onChange={setOriginFilter}
            options={[
              { value: 'all', label: 'All origins' },
              { value: 'conversation', label: 'Conversation' },
              { value: 'tool', label: 'Tool' },
              { value: 'manual', label: 'Manual' },
              { value: 'system', label: 'System' },
              { value: 'imported', label: 'Imported' },
            ]}
          />
          <FilterSelect
            label="Sort"
            value={sort}
            onChange={setSort}
            options={[
              { value: 'newest', label: 'Newest first' },
              { value: 'oldest', label: 'Oldest first' },
              { value: 'importance', label: 'Highest importance' },
            ]}
          />
          <label className="space-y-2 text-sm">
            <span className="font-medium text-foreground">Min importance</span>
            <select
              value={minImportance}
              onChange={(event) => setMinImportance(Number(event.target.value))}
              className="h-11 w-full rounded-sm border border-border/70 bg-card/[0.62] px-3 text-sm text-foreground backdrop-blur-xl"
            >
              {[0, 4, 6, 8].map((value) => (
                <option key={value} value={value}>
                  {value === 0 ? 'Any importance' : `${value}+ only`}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        <div className={`${panelClass} space-y-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="font-semibold text-foreground">Stored memories</div>
              <div className="text-sm text-muted-foreground">
                {loading ? 'Loading memories...' : `${memories.length} memory records in this view`}
              </div>
            </div>
            <span className="soft-pill">{stats?.averageImportance || 0} avg importance</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Loading memory console...</div>
          ) : memories.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border/70 px-4 py-8 text-sm leading-7 text-muted-foreground">
              No memories match this view yet. Important conversations, facts, and tool interactions will appear here as the agent keeps working.
            </div>
          ) : (
            <div className="max-h-[720px] space-y-3 overflow-y-auto pr-1">
              {memories.map((memory) => (
                <button
                  key={memory.id}
                  type="button"
                  onClick={() => setSelectedMemoryId(memory.id)}
                  className={`w-full rounded-sm border p-4 text-left transition-all ${
                    selectedMemoryId === memory.id
                      ? 'border-primary/40 bg-primary/5'
                      : 'border-border/60 bg-background/30 hover:border-primary/20 hover:bg-background/45'
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium capitalize text-primary">
                          {memory.type}
                        </span>
                        <span className="rounded-full bg-accent/10 px-2.5 py-1 text-xs font-medium capitalize text-accent">
                          {memory.origin}
                        </span>
                      </div>
                      <div className="font-medium text-foreground">{memory.summary}</div>
                    </div>
                    <div className="text-right text-xs text-muted-foreground">
                      <div>{formatDate(memory.timestamp)}</div>
                      <div className="mt-2 inline-flex items-center gap-1">
                        <Star className="h-3.5 w-3.5 fill-amber-400 text-amber-400" />
                        {memory.importance}/10
                      </div>
                    </div>
                  </div>

                  <div className="mt-3 line-clamp-2 text-sm leading-6 text-muted-foreground">
                    {memory.content}
                  </div>

                  {memory.keywords.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {memory.keywords.slice(0, 5).map((keyword) => (
                        <span key={`${memory.id}_${keyword}`} className="rounded-full bg-muted/40 px-2 py-1 text-xs text-muted-foreground">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-6">
          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center gap-3">
              <div className="rounded-sm bg-primary/10 p-2">
                <Brain className="h-5 w-5 text-primary" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Memory recall</div>
                <div className="text-sm text-muted-foreground">Ask what the agent remembers and why it matched</div>
              </div>
            </div>

            <div className="flex gap-3">
              <Input
                value={recallQuery}
                onChange={(event) => setRecallQuery(event.target.value)}
                placeholder="What does this agent remember about..."
                className="h-11"
              />
              <Button className="gap-2" onClick={() => void handleRecall()} disabled={recalling}>
                <Search className="h-4 w-4" />
                {recalling ? 'Recalling...' : 'Recall'}
              </Button>
            </div>

            {recallResults.length > 0 ? (
              <div className="space-y-3">
                {recallResults.map((result) => (
                  <div key={`recall_${result.memory.id}`} className="rounded-sm border border-border/60 bg-background/30 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="font-medium text-foreground">{result.memory.summary}</div>
                      <span className="rounded-full bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary">
                        score {result.score.toFixed(1)}
                      </span>
                    </div>
                    <div className="mt-2 text-sm text-muted-foreground">{result.memory.content}</div>
                    <ul className="mt-3 space-y-1 text-xs text-muted-foreground">
                      {result.reasons.map((reason) => (
                        <li key={`${result.memory.id}_${reason}`}>• {reason}</li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-sm border border-dashed border-border/70 px-4 py-6 text-sm leading-7 text-muted-foreground">
                Run a recall query to see the strongest matching memories and the reasons they surfaced.
              </div>
            )}
          </div>

          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-semibold text-foreground">Memory detail</div>
                <div className="text-sm text-muted-foreground">Inspect the full stored record, context, and message links</div>
              </div>
              {selectedMemory && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="gap-2 text-destructive hover:text-destructive"
                  onClick={() => void handleDeleteMemory(selectedMemory.id)}
                  disabled={deletingMemoryId === selectedMemory.id}
                >
                  <Trash2 className="h-4 w-4" />
                  {deletingMemoryId === selectedMemory.id ? 'Deleting...' : 'Delete'}
                </Button>
              )}
            </div>

            {!selectedMemory ? (
              <div className="rounded-sm border border-dashed border-border/70 px-4 py-8 text-sm leading-7 text-muted-foreground">
                Select a memory to inspect the full content, context, keywords, source, and linked message IDs.
              </div>
            ) : (
              <div className="space-y-4">
                <div className="flex flex-wrap gap-2">
                  <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
                    {selectedMemory.type}
                  </span>
                  <span className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium capitalize text-accent">
                    {selectedMemory.origin}
                  </span>
                  <span className="rounded-full bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
                    {selectedMemory.importance}/10 importance
                  </span>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Summary</div>
                  <div className="mt-2 text-sm leading-7 text-foreground">{selectedMemory.summary}</div>
                </div>

                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Full content</div>
                  <div className="mt-2 rounded-sm bg-background/45 p-4 text-sm leading-7 text-muted-foreground">
                    {selectedMemory.content}
                  </div>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <DetailField label="Context" value={selectedMemory.context} />
                  <DetailField label="Created" value={formatDateTime(selectedMemory.timestamp)} />
                  <DetailField label="Linked messages" value={String(selectedMemory.linkedMessageIds.length)} />
                  <DetailField label="Keywords" value={selectedMemory.keywords.join(', ') || 'None'} />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function FilterSelect<T extends string>({
  label,
  value,
  onChange,
  options,
}: {
  label: string
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <label className="space-y-2 text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="h-11 w-full rounded-sm border border-border/70 bg-card/[0.62] px-3 text-sm text-foreground backdrop-blur-xl"
      >
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    </label>
  )
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number | string
  tone: 'primary' | 'accent' | 'secondary' | 'muted'
}) {
  const colorClass = tone === 'primary'
    ? 'text-primary bg-primary/5'
    : tone === 'accent'
      ? 'text-accent bg-accent/5'
      : tone === 'secondary'
        ? 'text-secondary bg-secondary/5'
        : 'text-muted-foreground bg-muted/30'

  return (
    <div className={`rounded-sm p-4 text-center ${colorClass}`}>
      <div className="text-2xl font-bold">{value}</div>
      <div className="mt-1 text-sm">{label}</div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-background/30 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{label}</div>
      <div className="mt-2 text-sm leading-7 text-foreground">{value}</div>
    </div>
  )
}

function formatDate(value: string) {
  return new Date(value).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
}
