'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import type { MemoryOrigin, MemoryRecallResult, MemoryRecord, MemoryStatsSummary } from '@/types/database'
import { ContextIcon } from '@/components/journal/JournalIcons'
import { 
  MemoryCoreIcon, DataQueryIcon, GeometricSyncIcon, VoidSearchIcon, 
  TraceArchiveIcon, SemanticNetIcon, PriorityStarIcon, ObliterateIcon 
} from './MemoryIcons'

interface MemoryConsoleProps {
  agentId: string
  agentName: string
  refreshToken?: number
  onMemoryCountChange?: (count: number) => void
  onMemoryMutation?: () => void | Promise<void>
}

const premiumPanel = 'rounded-md border border-border/40 bg-card/40 backdrop-blur-md shadow-sm'
const subPanel = 'rounded-sm border border-border/30 bg-muted/20'
const labelStyle = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80'

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
    <div className="w-full">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1 mb-4">
        <div className="flex items-center gap-4">
          <div className="rounded-md bg-pastel-purple/10 p-2.5">
            <MemoryCoreIcon className="h-5 w-5 text-pastel-purple" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-bold text-foreground leading-tight tracking-tight">
                Memory Console
              </h3>
            </div>
            <p className="text-[11px] mt-0.5 font-medium text-muted-foreground uppercase tracking-widest">
              What {agentName} can actually recall
            </p>
          </div>
        </div>

        {/* Quick Stats horizontal stack */}
        <div className="flex items-center gap-2 overflow-x-auto scrollbar-none">
           <StatCard label="Total Core" value={stats?.totalMemories || 0} tone="primary" />
           <StatCard label="High Impact" value={stats?.highImportanceMemories || 0} tone="accent" />
           <StatCard label="Categorical" value={Object.keys(stats?.memoriesByType || {}).length} tone="secondary" />
        </div>
      </div>

      {/* Grid Layout matching Journal Bento format */}
      <div className="grid gap-4 xl:grid-cols-[1fr_420px] xl:h-[calc(100vh-220px)] xl:min-h-[700px]">
        
        {/* Left Column: Filter Hub & Memory Engine */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden w-full">
           
           {/* Filtering Ribbon */}
           <section className={`${premiumPanel} shrink-0 overflow-hidden`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <DataQueryIcon className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Data Query</span>
                </div>
                <div className="flex items-center gap-2">
                   <button onClick={() => void loadConsoleData(true)} disabled={refreshing} className="flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase rounded-sm bg-muted/20 border border-border/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
                     <GeometricSyncIcon className={`h-3 w-3 ${refreshing ? 'text-pastel-purple' : ''}`} spinning={refreshing} /> Sync
                   </button>
                   <button onClick={handleResetFilters} className="flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase rounded-sm bg-muted/20 border border-border/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all">
                     Reset
                   </button>
                </div>
              </div>
              
              <div className="p-3 bg-muted/5 flex flex-col gap-3">
                 <div className="flex gap-2">
                    <input
                      value={draftSearchQuery}
                      onChange={(event) => setDraftSearchQuery(event.target.value)}
                      onKeyDown={(e) => e.key === 'Enter' && handleApplySearch()}
                      placeholder="Search summaries, exact quotes, or context..."
                      className="w-full h-8 rounded-sm border border-border/30 bg-muted/20 px-3 text-[11px] font-medium text-foreground outline-none focus:border-pastel-purple/50 transition-all placeholder:text-muted-foreground/50"
                    />
                    <button onClick={handleApplySearch} className="h-8 px-4 flex items-center justify-center gap-2 rounded-sm bg-pastel-purple hover:bg-pastel-purple/90 text-primary-foreground text-[10px] uppercase font-bold tracking-wider shrink-0 transition-all">
                      <VoidSearchIcon className="h-3.5 w-3.5" /> Search
                    </button>
                 </div>
                 
                 <div className="grid grid-cols-2 lg:grid-cols-4 gap-2">
                    <FilterSelect
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
                      value={sort}
                      onChange={setSort}
                      options={[
                        { value: 'newest', label: 'Newest first' },
                        { value: 'oldest', label: 'Oldest first' },
                        { value: 'importance', label: 'Highest priority' },
                      ]}
                    />
                    <select
                      value={minImportance}
                      onChange={(event) => setMinImportance(Number(event.target.value))}
                      className="h-7 w-full rounded-sm border border-border/30 bg-muted/10 px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground outline-none focus:border-pastel-purple/50 transition-all cursor-pointer"
                    >
                      {[0, 4, 6, 8].map((value) => (
                        <option key={value} value={value} className="bg-background text-foreground uppercase tracking-normal">
                          {value === 0 ? 'Any urgency' : `Min ${value}+ rank`}
                        </option>
                      ))}
                    </select>
                 </div>
              </div>
           </section>

           {/* Core Memory Vector List */}
           <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden min-h-0`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <TraceArchiveIcon className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Stored Index</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{memories.length} Results</span>
                  <span className="text-[9px] font-bold uppercase tracking-widest text-pastel-purple bg-pastel-purple/10 border border-pastel-purple/20 px-2 py-0.5 rounded-sm">Avg ★ {stats?.averageImportance || 0}</span>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-3 space-y-2 scrollbar-thin">
                {loading ? (
                   <div className="flex flex-col items-center justify-center h-full opacity-50 grayscale gap-4">
                     <SemanticNetIcon className="h-8 w-8 text-pastel-purple animate-pulse" />
                     <div className="text-[10px] font-bold uppercase tracking-widest">Querying Neural Net...</div>
                   </div>
                ) : memories.length === 0 ? (
                   <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[11px] font-medium text-muted-foreground italic border border-dashed border-border/30 rounded-sm bg-muted/5 opacity-80">
                     No memory traces match this exact configuration.
                   </div>
                ) : (
                  memories.map((memory) => {
                     const isSelected = selectedMemoryId === memory.id;
                     return (
                      <button
                        key={memory.id}
                        type="button"
                        onClick={() => setSelectedMemoryId(memory.id)}
                        className={`w-full rounded-sm border p-3.5 text-left transition-all duration-200 outline-none ${
                          isSelected
                            ? 'border-pastel-purple/40 bg-pastel-purple/5 shadow-sm ring-1 ring-pastel-purple/20'
                            : 'border-border/30 bg-muted/5 hover:border-pastel-purple/20 hover:bg-muted/10'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2 gap-4">
                          <div className="flex-1">
                             <div className="text-[13px] font-bold text-foreground leading-snug tracking-tight mb-2 line-clamp-2">
                               {memory.summary}
                             </div>
                             <div className="flex flex-wrap items-center gap-1.5">
                               {memory.type && <span className="rounded-sm bg-pastel-purple/10 border border-pastel-purple/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-pastel-purple">{memory.type}</span>}
                               {memory.origin && <span className="rounded-sm bg-pastel-blue/10 border border-pastel-blue/20 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider text-pastel-blue">{memory.origin}</span>}
                             </div>
                          </div>
                          
                          <div className="flex flex-col items-end gap-1.5 shrink-0">
                             <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">
                               {formatDate(memory.timestamp)}
                             </div>
                             <div className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-0.5 text-[10px] font-bold ${
                               memory.importance >= 8 ? 'bg-pastel-yellow/10 text-pastel-yellow border border-pastel-yellow/20' : 'bg-muted/30 text-muted-foreground border border-border/30'
                             }`}>
                               <PriorityStarIcon className="h-3.5 w-3.5" />
                               {memory.importance}/10
                             </div>
                          </div>
                        </div>

                        <div className="text-[11px] font-medium leading-relaxed text-muted-foreground/90 line-clamp-2 italic border-l-2 border-border/40 pl-3 py-0.5 my-3">
                           &quot;{memory.content}&quot;
                        </div>

                        {memory.keywords.length > 0 && (
                           <div className="flex flex-wrap gap-1.5">
                             {memory.keywords.slice(0, 5).map((keyword) => (
                               <span key={`${memory.id}_${keyword}`} className="rounded-sm bg-muted/30 border border-border/20 px-1.5 py-0.5 text-[9px] font-bold tracking-wider text-muted-foreground lowercase">
                                 #{keyword}
                               </span>
                             ))}
                           </div>
                        )}
                      </button>
                    )
                  })
                )}
              </div>
           </section>
        </div>

        {/* Right Column: Semantic Recall & Inspector */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden w-full">
           
           {/* Semantic Recall (Vector query) */}
           <section className={`${premiumPanel} flex flex-col shrink-0 overflow-hidden max-h-[45%]`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <SemanticNetIcon className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Semantic Recall Test</span>
                </div>
              </div>
              
              <div className="p-3 bg-muted/5 border-b border-border/30 shrink-0 flex flex-col">
                 <p className="text-[10px] text-muted-foreground uppercase tracking-widest font-bold mb-2">Simulate associative memory trigger</p>
                 <div className="flex gap-2">
                   <input
                     value={recallQuery}
                     onChange={(event) => setRecallQuery(event.target.value)}
                     onKeyDown={(e) => e.key === 'Enter' && handleRecall()}
                     placeholder="e.g. Do you remember what I said about..."
                     className="flex-1 h-8 rounded-sm border border-border/30 bg-background px-3 text-[11px] font-medium text-foreground outline-none focus:border-pastel-blue/50 transition-all placeholder:text-muted-foreground/40"
                   />
                   <button onClick={() => void handleRecall()} disabled={recalling} className="h-8 px-4 flex items-center justify-center gap-2 rounded-sm bg-pastel-blue hover:bg-pastel-blue/90 text-primary-foreground text-[10px] uppercase font-bold tracking-wider shrink-0 transition-all disabled:opacity-50">
                     {recalling ? <GeometricSyncIcon className="h-3 w-3" spinning /> : <SemanticNetIcon className="h-3.5 w-3.5" />} Recall
                   </button>
                 </div>
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-3 bg-background/20 h-[180px]">
                {recallResults.length > 0 ? (
                  <div className="space-y-2">
                    {recallResults.map((result) => (
                      <div key={`recall_${result.memory.id}`} className={`${subPanel} p-3 hover:border-pastel-blue/30 transition-all`}>
                        <div className="flex items-start justify-between gap-3 mb-1.5">
                          <div className="text-[11px] font-bold text-foreground leading-tight line-clamp-1">{result.memory.summary}</div>
                          <span className="rounded-sm bg-pastel-blue/10 border border-pastel-blue/20 px-1.5 py-0.5 text-[8px] font-bold tracking-wider uppercase text-pastel-blue shrink-0">
                            Match {result.score.toFixed(2)}
                          </span>
                        </div>
                        <div className="text-[10px] text-muted-foreground/80 font-medium mb-2 line-clamp-2">"{result.memory.content}"</div>
                        <ul className="space-y-1">
                          {result.reasons.map((reason) => (
                            <li key={`${result.memory.id}_${reason}`} className="flex gap-1.5 items-start text-[9px] font-bold text-muted-foreground uppercase tracking-wide leading-tight">
                               <span className="text-pastel-blue mt-0.5">•</span> {reason}
                            </li>
                          ))}
                        </ul>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center w-full opacity-40 grayscale gap-3 text-center">
                    <DataQueryIcon className="h-6 w-6" />
                    <span className="text-[10px] font-bold uppercase tracking-widest">No recall results.<br/>Run a query above.</span>
                  </div>
                )}
              </div>
           </section>

           {/* Explicit Memory Detail */}
           <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden min-h-0`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-2.5 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <ContextIcon className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Memory Inspector</span>
                </div>
                {selectedMemory && (
                  <button
                    onClick={() => void handleDeleteMemory(selectedMemory.id)}
                    disabled={deletingMemoryId === selectedMemory.id}
                    className="flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase rounded-sm bg-pastel-red/10 border border-pastel-red/20 text-pastel-red hover:bg-pastel-red/20 transition-all disabled:opacity-50"
                  >
                    <ObliterateIcon className="h-3.5 w-3.5" />
                    {deletingMemoryId === selectedMemory.id ? 'Wiping...' : 'Scrub'}
                  </button>
                )}
              </div>

              <div className="flex-1 overflow-y-auto scrollbar-thin p-4 xl:p-5">
                 {!selectedMemory ? (
                    <div className="h-full flex flex-col items-center justify-center p-8 text-center text-[11px] font-bold uppercase tracking-widest text-muted-foreground opacity-50">
                       Select an element from the index to inspect full neurological trace data.
                    </div>
                 ) : (
                    <AnimatePresence mode="wait">
                       <motion.div
                          key={selectedMemory.id}
                          initial={{ opacity: 0, scale: 0.98 }}
                          animate={{ opacity: 1, scale: 1 }}
                          className="space-y-5"
                       >
                          {/* Tags block */}
                          <div className="flex items-center gap-2 border-b border-border/20 pb-4">
                             <div className="h-6 px-2 rounded-sm bg-pastel-purple/10 border border-pastel-purple/20 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider text-pastel-purple">{selectedMemory.type}</div>
                             <div className="h-6 px-2 rounded-sm bg-pastel-blue/10 border border-pastel-blue/20 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider text-pastel-blue">{selectedMemory.origin}</div>
                             <div className="h-6 px-2 rounded-sm bg-muted/20 border border-border/30 flex items-center justify-center text-[9px] font-bold uppercase tracking-wider text-muted-foreground ml-auto">
                                Rank {selectedMemory.importance}/10
                             </div>
                          </div>

                          {/* Data sets */}
                          <div className="space-y-1">
                             <div className={labelStyle}>Summarized Engram</div>
                             <div className="text-[13px] font-bold text-foreground leading-snug">{selectedMemory.summary}</div>
                          </div>

                          <div className="space-y-1">
                             <div className={labelStyle}>Direct Transcription / Raw Trace</div>
                             <div className="rounded-sm bg-muted/10 border border-border/20 p-3 text-[11px] font-medium leading-relaxed text-foreground whitespace-pre-wrap selection:bg-pastel-purple/30">
                                {selectedMemory.content}
                             </div>
                          </div>
                          
                          <div className="h-px w-full bg-border/20" />

                          <div className="grid grid-cols-2 gap-4">
                             <DetailField label="Local Context" value={selectedMemory.context} />
                             <DetailField label="Extraction Time" value={formatDateTime(selectedMemory.timestamp)} />
                             <DetailField label="Linked References" value={selectedMemory.linkedMessageIds.length > 0 ? String(selectedMemory.linkedMessageIds.length) : 'None'} />
                             <DetailField label="Index Keys" value={selectedMemory.keywords.join(', ') || 'N/A'} />
                          </div>
                       </motion.div>
                    </AnimatePresence>
                 )}
              </div>
           </section>

        </div>
      </div>
    </div>
  )
}

// ------ Small Reusable Components ------ 

function FilterSelect<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T
  onChange: (value: T) => void
  options: Array<{ value: T; label: string }>
}) {
  return (
    <select
      value={value}
      onChange={(event) => onChange(event.target.value as T)}
      className="h-7 w-full rounded-sm border border-border/30 bg-muted/10 px-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground outline-none focus:border-pastel-purple/50 transition-all cursor-pointer"
    >
      {options.map((option) => (
        <option key={option.value} value={option.value} className="bg-background text-foreground uppercase tracking-normal">
          {option.label}
        </option>
      ))}
    </select>
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
    ? 'text-pastel-purple bg-pastel-purple/10 border-pastel-purple/20'
    : tone === 'accent'
      ? 'text-pastel-yellow bg-pastel-yellow/10 border-pastel-yellow/20'
      : tone === 'secondary'
        ? 'text-pastel-green bg-pastel-green/10 border-pastel-green/20'
        : 'text-muted-foreground bg-muted/20 border-border/30'

  return (
    <div className={`shrink-0 rounded-sm border px-3 py-1.5 flex items-center justify-center gap-2 ${colorClass}`}>
      <div className="text-[10px] font-bold uppercase tracking-wider opacity-80">{label}</div>
      <div className="text-sm font-black leading-none">{value}</div>
    </div>
  )
}

function DetailField({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <div className={labelStyle}>{label}</div>
      <div className="text-[11px] font-bold text-foreground/90">{value}</div>
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

export default MemoryConsole
