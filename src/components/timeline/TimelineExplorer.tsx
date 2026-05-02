'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  Archive,
  BookOpen,
  Brain,
  Brush,
  CheckCircle2,
  Clock,
  GitBranch,
  GraduationCap,
  Heart,
  Library,
  Loader2,
  MessageCircle,
  Moon,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type {
  TimelineClusterV2,
  TimelineEventV2,
  TimelineEventV2Type,
  TimelineQualityFilter,
  TimelineSourceCoverage,
  TimelineWorkspacePayload,
} from '@/types/database'

interface TimelineExplorerProps {
  agentId: string
  agentName: string
  className?: string
}

const premiumPanel = 'rounded-md border border-border/40 bg-card/40 backdrop-blur-md shadow-sm'
const subPanel = 'rounded-sm border border-border/30 bg-muted/20'
const labelStyle = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80'

const SOURCE_CONFIG: Record<TimelineEventV2Type, { label: string; icon: ElementType; className: string }> = {
  conversation: { label: 'Chat', icon: MessageCircle, className: 'text-pastel-blue border-pastel-blue/30 bg-pastel-blue/10' },
  memory: { label: 'Memory', icon: Brain, className: 'text-pastel-purple border-pastel-purple/30 bg-pastel-purple/10' },
  emotion: { label: 'Emotion', icon: Heart, className: 'text-pastel-red border-pastel-red/30 bg-pastel-red/10' },
  relationship: { label: 'Relationships', icon: Users, className: 'text-pastel-green border-pastel-green/30 bg-pastel-green/10' },
  dream: { label: 'Dreams', icon: Moon, className: 'text-pastel-purple border-pastel-purple/30 bg-pastel-purple/10' },
  creative: { label: 'Creative', icon: Brush, className: 'text-pastel-yellow border-pastel-yellow/30 bg-pastel-yellow/10' },
  journal: { label: 'Journal', icon: BookOpen, className: 'text-pastel-blue border-pastel-blue/30 bg-pastel-blue/10' },
  profile: { label: 'Profile', icon: ShieldCheck, className: 'text-pastel-green border-pastel-green/30 bg-pastel-green/10' },
  scenario: { label: 'Scenarios', icon: GitBranch, className: 'text-pastel-pink border-pastel-pink/30 bg-pastel-pink/10' },
  challenge: { label: 'Challenges', icon: Swords, className: 'text-pastel-red border-pastel-red/30 bg-pastel-red/10' },
  arena: { label: 'Arena', icon: Sparkles, className: 'text-pastel-yellow border-pastel-yellow/30 bg-pastel-yellow/10' },
  learning: { label: 'Learning', icon: GraduationCap, className: 'text-pastel-green border-pastel-green/30 bg-pastel-green/10' },
  mentorship: { label: 'Mentorship', icon: Network, className: 'text-pastel-purple border-pastel-purple/30 bg-pastel-purple/10' },
  knowledge: { label: 'Knowledge', icon: Library, className: 'text-pastel-blue border-pastel-blue/30 bg-pastel-blue/10' },
}

const SOURCE_ORDER = Object.keys(SOURCE_CONFIG) as TimelineEventV2Type[]
const QUALITY_OPTIONS: Array<{ value: TimelineQualityFilter; label: string }> = [
  { value: 'all', label: 'All quality' },
  { value: 'passed', label: 'Passed' },
  { value: 'failed', label: 'Failed' },
  { value: 'legacy_unvalidated', label: 'Legacy' },
  { value: 'unknown', label: 'Unknown' },
]

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text()
  const payload = raw ? JSON.parse(raw) as Record<string, unknown> : {}
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed with status ${response.status}`)
  }
  return payload as T
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatDay(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function getQualityClass(status?: string) {
  if (status === 'passed') return 'border-pastel-green/30 bg-pastel-green/10 text-pastel-green'
  if (status === 'failed') return 'border-pastel-red/30 bg-pastel-red/10 text-pastel-red'
  if (status === 'legacy_unvalidated') return 'border-pastel-yellow/30 bg-pastel-yellow/10 text-pastel-yellow'
  return 'border-border/40 bg-muted/20 text-muted-foreground'
}

function EventIcon({ type, className }: { type: TimelineEventV2Type; className?: string }) {
  const Icon = SOURCE_CONFIG[type].icon
  return <Icon className={cn('h-4 w-4', className)} />
}

function MetricTile({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className={`${subPanel} p-3`}>
      <div className={labelStyle}>{label}</div>
      <div className="mt-2 text-2xl font-bold leading-none text-foreground">{value}</div>
      <div className="mt-1 text-[11px] font-medium text-muted-foreground">{hint}</div>
    </div>
  )
}

function SourceToggle({
  type,
  active,
  count,
  onToggle,
}: {
  type: TimelineEventV2Type
  active: boolean
  count: number
  onToggle: () => void
}) {
  const config = SOURCE_CONFIG[type]
  return (
    <button
      type="button"
      onClick={onToggle}
      className={cn(
        'inline-flex items-center gap-2 rounded-sm border px-2.5 py-1.5 text-xs font-medium transition-all',
        active ? config.className : 'border-border/30 bg-muted/5 text-muted-foreground hover:text-foreground'
      )}
    >
      <EventIcon type={type} />
      <span>{config.label}</span>
      <span className="text-[10px] opacity-70">{count}</span>
    </button>
  )
}

function CoverageStrip({ coverage }: { coverage: TimelineSourceCoverage[] }) {
  return (
    <div className={`${premiumPanel} p-4`}>
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <div className={labelStyle}>Source Coverage</div>
          <div className="mt-1 text-sm font-semibold text-foreground">Loaded from authoritative feature records</div>
        </div>
        <Archive className="h-4 w-4 text-muted-foreground" />
      </div>
      <div className="grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-7">
        {coverage.map((source) => {
          const config = SOURCE_CONFIG[source.source]
          return (
            <div key={source.source} className="rounded-sm border border-border/25 bg-muted/10 p-2">
              <div className="flex items-center justify-between gap-2">
                <span className="truncate text-xs font-semibold text-foreground">{config.label}</span>
                {source.status === 'degraded' ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-pastel-red" />
                ) : source.count > 0 ? (
                  <CheckCircle2 className="h-3.5 w-3.5 text-pastel-green" />
                ) : (
                  <span className="h-2 w-2 rounded-full bg-muted-foreground/40" />
                )}
              </div>
              <div className="mt-1 text-[11px] text-muted-foreground">{source.count} events</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimelineEventCard({
  event,
  selected,
  onSelect,
}: {
  event: TimelineEventV2
  selected: boolean
  onSelect: () => void
}) {
  const config = SOURCE_CONFIG[event.type]

  return (
    <motion.button
      type="button"
      layout
      onClick={onSelect}
      className={cn(
        'group relative w-full rounded-md border p-4 text-left transition-all',
        selected
          ? 'border-pastel-blue/50 bg-pastel-blue/10 shadow-sm'
          : 'border-border/30 bg-card/35 hover:border-border/60 hover:bg-card/55'
      )}
    >
      <div className="flex gap-4">
        <div className={cn('mt-1 flex h-9 w-9 shrink-0 items-center justify-center rounded-sm border', config.className)}>
          <EventIcon type={event.type} />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn('rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em]', config.className)}>
              {config.label}
            </span>
            <span className="text-xs text-muted-foreground">{formatDateTime(event.timestamp)}</span>
            {event.qualityStatus && (
              <span className={cn('rounded-sm border px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.14em]', getQualityClass(event.qualityStatus))}>
                {event.qualityStatus.replaceAll('_', ' ')}
              </span>
            )}
          </div>
          <h3 className="mt-2 text-base font-semibold leading-snug text-foreground">{event.title}</h3>
          <p className="mt-1 line-clamp-2 text-sm leading-relaxed text-muted-foreground">{event.summary}</p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <span className="rounded-sm border border-border/30 bg-muted/10 px-2 py-1 text-[11px] text-muted-foreground">
              Importance {event.importance}/10
            </span>
            <span className="rounded-sm border border-border/30 bg-muted/10 px-2 py-1 text-[11px] text-muted-foreground">
              {event.source}
            </span>
            {event.evidenceRefs.length > 0 && (
              <span className="rounded-sm border border-border/30 bg-muted/10 px-2 py-1 text-[11px] text-muted-foreground">
                {event.evidenceRefs.length} refs
              </span>
            )}
          </div>
        </div>
      </div>
    </motion.button>
  )
}

function ClusterGroup({
  cluster,
  events,
  selectedId,
  onSelect,
}: {
  cluster: TimelineClusterV2
  events: TimelineEventV2[]
  selectedId?: string
  onSelect: (event: TimelineEventV2) => void
}) {
  const groupedEvents = cluster.eventIds
    .map((id) => events.find((event) => event.id === id))
    .filter((event): event is TimelineEventV2 => Boolean(event))

  if (!groupedEvents.length) return null

  return (
    <section className="relative pl-7">
      <div className="absolute left-2 top-2 bottom-0 w-px bg-border/50" />
      <div className="absolute left-0 top-1 flex h-4 w-4 items-center justify-center rounded-full border border-border bg-background">
        <span className="h-1.5 w-1.5 rounded-full bg-pastel-blue" />
      </div>
      <div className="mb-3 flex flex-wrap items-center gap-2">
        <h2 className="text-sm font-bold text-foreground">{formatDay(cluster.startTime)}</h2>
        <span className="text-xs text-muted-foreground">{cluster.count} events</span>
      </div>
      <div className="space-y-3">
        {groupedEvents.map((event) => (
          <TimelineEventCard
            key={event.id}
            event={event}
            selected={selectedId === event.id}
            onSelect={() => onSelect(event)}
          />
        ))}
      </div>
    </section>
  )
}

function EventInspector({ event, onClose }: { event: TimelineEventV2 | null; onClose: () => void }) {
  if (!event) {
    return (
      <aside className={`${premiumPanel} hidden min-h-[520px] p-5 xl:block`}>
        <div className="flex h-full flex-col items-center justify-center gap-3 text-center text-muted-foreground">
          <Clock className="h-7 w-7" />
          <div className="text-sm font-semibold text-foreground">Select an event</div>
          <p className="max-w-[240px] text-xs leading-relaxed">Provenance, quality signals, participants, and linked evidence appear here.</p>
        </div>
      </aside>
    )
  }

  const config = SOURCE_CONFIG[event.type]
  return (
    <aside className={`${premiumPanel} p-5 xl:sticky xl:top-4 xl:max-h-[calc(100vh-2rem)] xl:overflow-y-auto`}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <div className={cn('mb-3 inline-flex items-center gap-2 rounded-sm border px-2.5 py-1 text-xs font-semibold', config.className)}>
            <EventIcon type={event.type} />
            {config.label}
          </div>
          <h2 className="text-xl font-bold leading-tight text-foreground">{event.title}</h2>
          <p className="mt-2 text-sm text-muted-foreground">{formatDateTime(event.timestamp)}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-sm border border-border/30 p-2 text-muted-foreground transition-colors hover:text-foreground xl:hidden"
          aria-label="Close event inspector"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="mt-5 space-y-4">
        <div className={`${subPanel} p-4`}>
          <div className={labelStyle}>Summary</div>
          <p className="mt-2 text-sm leading-relaxed text-foreground/85">{event.summary}</p>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <MetricTile label="Importance" value={`${event.importance}/10`} hint="normalized signal" />
          <MetricTile label="Quality" value={event.qualityScore ?? event.qualityStatus ?? 'n/a'} hint="source gate" />
        </div>

        <div className={`${subPanel} p-4`}>
          <div className={labelStyle}>Source</div>
          <div className="mt-2 text-sm font-semibold text-foreground">{event.source}</div>
          <div className="mt-1 break-all text-xs text-muted-foreground">{event.sourceId}</div>
          {event.status && <div className="mt-3 text-xs text-muted-foreground">Status: {event.status}</div>}
        </div>

        {event.themes.length > 0 && (
          <div>
            <div className={labelStyle}>Themes</div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {event.themes.map((theme) => (
                <span key={theme} className="rounded-sm border border-border/30 bg-muted/10 px-2 py-1 text-xs text-muted-foreground">
                  {theme}
                </span>
              ))}
            </div>
          </div>
        )}

        {event.participants.length > 0 && (
          <div>
            <div className={labelStyle}>Participants</div>
            <div className="mt-2 space-y-2">
              {event.participants.map((participant) => (
                <div key={`${participant.id}:${participant.role}`} className="rounded-sm border border-border/30 bg-muted/10 px-3 py-2 text-xs">
                  <div className="font-semibold text-foreground">{participant.name || participant.id}</div>
                  {participant.role && <div className="mt-1 text-muted-foreground">{participant.role}</div>}
                </div>
              ))}
            </div>
          </div>
        )}

        {event.sourceRefs.length > 0 && (
          <RefList title="Source Refs" refs={event.sourceRefs} />
        )}
        {event.evidenceRefs.length > 0 && (
          <div>
            <div className={labelStyle}>Evidence Refs</div>
            <div className="mt-2 grid gap-1.5">
              {event.evidenceRefs.slice(0, 10).map((ref) => (
                <code key={ref} className="rounded-sm border border-border/30 bg-muted/10 px-2 py-1 text-[11px] text-muted-foreground">
                  {ref}
                </code>
              ))}
            </div>
          </div>
        )}
        {event.relatedRefs.length > 0 && (
          <RefList title="Related Refs" refs={event.relatedRefs} />
        )}
      </div>
    </aside>
  )
}

function RefList({ title, refs }: { title: string; refs: TimelineEventV2['sourceRefs'] }) {
  return (
    <div>
      <div className={labelStyle}>{title}</div>
      <div className="mt-2 space-y-2">
        {refs.slice(0, 8).map((ref) => (
          <div key={`${ref.type}:${ref.id}:${ref.label}`} className="rounded-sm border border-border/30 bg-muted/10 px-3 py-2 text-xs">
            <div className="font-semibold text-foreground">{ref.label}</div>
            <div className="mt-1 break-all text-muted-foreground">{ref.type}:{ref.id}</div>
          </div>
        ))}
      </div>
    </div>
  )
}

function TimelineSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((item) => (
        <div key={item} className={`${premiumPanel} animate-pulse p-4`}>
          <div className="h-4 w-28 rounded-sm bg-muted/30" />
          <div className="mt-4 h-5 w-2/3 rounded-sm bg-muted/40" />
          <div className="mt-3 h-4 w-full rounded-sm bg-muted/20" />
          <div className="mt-2 h-4 w-4/5 rounded-sm bg-muted/20" />
        </div>
      ))}
    </div>
  )
}

export function TimelineExplorer({ agentId, agentName, className = '' }: TimelineExplorerProps) {
  const [payload, setPayload] = useState<TimelineWorkspacePayload | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventV2 | null>(null)
  const [activeTypes, setActiveTypes] = useState<TimelineEventV2Type[]>([])
  const [quality, setQuality] = useState<TimelineQualityFilter>('all')
  const [query, setQuery] = useState('')
  const [minImportance, setMinImportance] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceCounts = useMemo(() => {
    const counts = new Map<TimelineEventV2Type, number>()
    for (const source of SOURCE_ORDER) counts.set(source, 0)
    for (const item of payload?.coverage || []) counts.set(item.source, item.count)
    return counts
  }, [payload])

  const loadTimeline = useCallback(async (showRefresh = false) => {
    try {
      setError(null)
      if (showRefresh) setRefreshing(true)
      else setLoading(true)

      const params = new URLSearchParams()
      params.set('limit', '120')
      if (activeTypes.length) params.set('types', activeTypes.join(','))
      if (quality !== 'all') params.set('quality', quality)
      if (query.trim()) params.set('q', query.trim())
      if (minImportance > 0) params.set('minImportance', String(minImportance))

      const data = await parseResponse<TimelineWorkspacePayload>(
        await fetch(`/api/agents/${agentId}/timeline?${params.toString()}`, { cache: 'no-store' })
      )
      setPayload(data)
      setSelectedEvent((current) => current && data.events.some((event) => event.id === current.id) ? current : data.events[0] || null)
    } catch (nextError) {
      console.error('Failed to load timeline workspace:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to load timeline workspace')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeTypes, agentId, minImportance, quality, query])

  useEffect(() => {
    const timeout = window.setTimeout(() => void loadTimeline(false), 180)
    return () => window.clearTimeout(timeout)
  }, [loadTimeline])

  const toggleType = (type: TimelineEventV2Type) => {
    setActiveTypes((current) => current.includes(type)
      ? current.filter((entry) => entry !== type)
      : [...current, type])
  }

  const events = payload?.events || []
  const clusters = payload?.clusters || []

  return (
    <div className={cn('space-y-5', className)}>
      <div className={`${premiumPanel} overflow-hidden`}>
        <div className="grid gap-0 xl:grid-cols-[1fr_360px]">
          <div className="p-5 md:p-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="max-w-2xl">
                <div className={labelStyle}>Agent Chronicle</div>
                <h1 className="mt-2 text-2xl font-bold tracking-tight text-foreground md:text-3xl">{agentName} Timeline</h1>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  Inspectable life events composed from persisted feature records, quality gates, evidence, and relationship state.
                </p>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => void loadTimeline(true)}
                disabled={refreshing}
                className="shrink-0"
              >
                {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
                Refresh
              </Button>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <MetricTile label="Visible" value={payload?.summary.visibleEvents ?? 0} hint={`${payload?.summary.totalEvents ?? 0} total indexed`} />
              <MetricTile label="High Signal" value={payload?.summary.highImportanceEvents ?? 0} hint="importance 8+" />
              <MetricTile label="Average" value={(payload?.summary.averageImportance ?? 0).toFixed(1)} hint="importance score" />
              <MetricTile label="Latest" value={payload?.summary.latestEventAt ? formatDateTime(payload.summary.latestEventAt).split(',')[0] : 'None'} hint="newest event" />
            </div>
          </div>
          <div className="border-t border-border/30 bg-muted/10 p-5 xl:border-l xl:border-t-0">
            <div className={labelStyle}>Narrative Threads</div>
            <div className="mt-3 flex flex-wrap gap-2">
              {(payload?.threads || []).slice(0, 8).map((thread) => (
                <span key={thread.id} className="rounded-sm border border-border/30 bg-card/40 px-2.5 py-1 text-xs text-muted-foreground">
                  {thread.label} <span className="text-foreground">{thread.count}</span>
                </span>
              ))}
              {payload && payload.threads.length === 0 && (
                <span className="text-xs text-muted-foreground">Threads appear after repeated themes emerge.</span>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className={`${premiumPanel} p-4`}>
        <div className="grid gap-3 xl:grid-cols-[minmax(220px,320px)_1fr_auto] xl:items-end">
          <div className="space-y-1.5">
            <div className={labelStyle}>Search</div>
            <div className="relative">
              <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Search events, themes, sources"
                className="pl-9"
              />
            </div>
          </div>
          <div className="space-y-1.5">
            <div className={labelStyle}>Sources</div>
            <div className="flex flex-wrap gap-2">
              {SOURCE_ORDER.map((type) => (
                <SourceToggle
                  key={type}
                  type={type}
                  active={activeTypes.length === 0 || activeTypes.includes(type)}
                  count={sourceCounts.get(type) || 0}
                  onToggle={() => toggleType(type)}
                />
              ))}
            </div>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[260px]">
            <div className="space-y-1.5">
              <div className={labelStyle}>Quality</div>
              <select
                value={quality}
                onChange={(event) => setQuality(event.target.value as TimelineQualityFilter)}
                className="h-10 w-full rounded-sm border border-input bg-background px-3 text-sm"
              >
                {QUALITY_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="space-y-1.5">
              <div className={labelStyle}>Min {minImportance}</div>
              <input
                type="range"
                min="0"
                max="10"
                value={minImportance}
                onChange={(event) => setMinImportance(Number(event.target.value))}
                className="h-10 w-full"
              />
            </div>
          </div>
        </div>
      </div>

      {payload && <CoverageStrip coverage={payload.coverage} />}

      {error && (
        <div className="rounded-md border border-pastel-red/30 bg-pastel-red/10 p-4 text-sm text-pastel-red">
          <div className="flex items-center gap-2 font-semibold">
            <AlertTriangle className="h-4 w-4" />
            Timeline failed to load
          </div>
          <p className="mt-1 text-xs">{error}</p>
        </div>
      )}

      <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_380px]">
        <main className="min-w-0">
          {loading ? (
            <TimelineSkeleton />
          ) : events.length === 0 ? (
            <div className={`${premiumPanel} px-6 py-14 text-center`}>
              <Clock className="mx-auto h-8 w-8 text-muted-foreground" />
              <h2 className="mt-4 text-base font-semibold text-foreground">No timeline events found</h2>
              <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-muted-foreground">
                Adjust filters or create saved artifacts, relationship changes, memories, or conversations for this agent.
              </p>
            </div>
          ) : (
            <div className="space-y-7">
              {clusters.map((cluster) => (
                <ClusterGroup
                  key={cluster.id}
                  cluster={cluster}
                  events={events}
                  selectedId={selectedEvent?.id}
                  onSelect={setSelectedEvent}
                />
              ))}
            </div>
          )}
        </main>

        <div className={cn(
          selectedEvent ? 'fixed inset-x-3 bottom-3 z-50 max-h-[78vh] overflow-y-auto xl:static xl:z-auto xl:max-h-none xl:overflow-visible' : '',
        )}>
          <EventInspector event={selectedEvent} onClose={() => setSelectedEvent(null)} />
        </div>
      </div>
    </div>
  )
}

export default TimelineExplorer
