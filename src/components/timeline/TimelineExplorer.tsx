'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ElementType } from 'react'
import {
  AlertTriangle,
  BookOpen,
  Brain,
  Brush,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Clock3,
  Copy,
  Database,
  Filter,
  GitBranch,
  GraduationCap,
  Heart,
  Library,
  MessageCircle,
  Moon,
  Network,
  RefreshCw,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import type {
  TimelineClusterV2,
  TimelineEventV2,
  TimelineEventV2Type,
  TimelineQualityFilter,
  TimelineSourceCoverage,
  TimelineSourceRefV2,
  TimelineWorkspacePayload,
} from '@/types/database'

interface TimelineExplorerProps {
  agentId: string
  agentName: string
  className?: string
}

type SourceConfig = {
  label: string
  icon: ElementType
  accent: string
}

const panelClass = 'overflow-hidden rounded-xl border border-[#2d4058] bg-[#0c1726] shadow-[0_12px_30px_rgba(0,0,0,0.16)]'
const quietPanelClass = 'rounded-lg border border-[#263950] bg-[#101c2b]'
const eyebrowClass = 'text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8da0b7]'

const SOURCE_CONFIG: Record<TimelineEventV2Type, SourceConfig> = {
  conversation: { label: 'Chat', icon: MessageCircle, accent: '#a9bdea' },
  memory: { label: 'Memory', icon: Brain, accent: '#b9addd' },
  emotion: { label: 'Emotion', icon: Heart, accent: '#f2a2be' },
  relationship: { label: 'Relationships', icon: Users, accent: '#91d4ae' },
  dream: { label: 'Dreams', icon: Moon, accent: '#9c9be0' },
  creative: { label: 'Creative', icon: Brush, accent: '#e8c177' },
  journal: { label: 'Journal', icon: BookOpen, accent: '#8ac9dc' },
  profile: { label: 'Profile', icon: ShieldCheck, accent: '#a4d1b7' },
  scenario: { label: 'Scenarios', icon: GitBranch, accent: '#e5a6bd' },
  challenge: { label: 'Challenges', icon: Swords, accent: '#e38b8c' },
  arena: { label: 'Arena', icon: Sparkles, accent: '#e7bb70' },
  learning: { label: 'Learning', icon: GraduationCap, accent: '#7fc8b9' },
  mentorship: { label: 'Mentorship', icon: Network, accent: '#b8a6d8' },
  knowledge: { label: 'Knowledge', icon: Library, accent: '#9dbcf2' },
}

const SOURCE_ORDER = Object.keys(SOURCE_CONFIG) as TimelineEventV2Type[]
const QUALITY_OPTIONS: Array<{ value: TimelineQualityFilter; label: string }> = [
  { value: 'all', label: 'All quality' },
  { value: 'passed', label: 'Passed' },
  { value: 'degraded', label: 'Degraded' },
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

function formatDay(value?: string) {
  if (!value) return 'No events'
  return new Intl.DateTimeFormat(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(value))
}

function formatTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(value))
}

function formatSourceName(value: string) {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function compactId(value: string) {
  return value.length > 26 ? `${value.slice(0, 14)}…${value.slice(-7)}` : value
}

function previewText(value: string, limit = 180) {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > limit ? `${normalized.slice(0, limit).trimEnd()}…` : normalized
}

function getQualityTone(status?: string) {
  if (status === 'passed') return { color: '#91d4ae', label: 'quality checked' }
  if (status === 'failed') return { color: '#e38b8c', label: 'quality failed' }
  if (status === 'degraded' || status === 'legacy_unvalidated' || status === 'pending' || status === 'review') return { color: '#e7bb70', label: 'pending review' }
  return { color: '#8da0b7', label: 'quality unknown' }
}

function EventIcon({ type, className }: { type: TimelineEventV2Type; className?: string }) {
  const Icon = SOURCE_CONFIG[type].icon
  return <Icon className={cn('h-4 w-4', className)} aria-hidden="true" />
}

function SourceBadge({ type, compact = false }: { type: TimelineEventV2Type; compact?: boolean }) {
  const config = SOURCE_CONFIG[type]
  return (
    <span
      className={cn('inline-flex items-center gap-1.5 rounded-md border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.1em]', compact && 'px-1.5')}
      style={{ color: config.accent, borderColor: `${config.accent}66`, backgroundColor: `${config.accent}12` }}
    >
      <EventIcon type={type} className="h-3 w-3" />
      {compact ? config.label.slice(0, 1) : config.label}
    </span>
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
      aria-pressed={active}
      className={cn(
        'inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2 text-[11px] font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9bdea]',
        active ? 'text-[#dce8f6]' : 'border-[#2b3d54] bg-[#0e1928] text-[#95a7bc] hover:border-[#425a78] hover:text-[#dce8f6]'
      )}
      style={active ? { color: config.accent, borderColor: `${config.accent}72`, backgroundColor: `${config.accent}16` } : undefined}
    >
      <EventIcon type={type} className="h-3.5 w-3.5" />
      <span>{config.label}</span>
      <span className="ml-0.5 text-[10px] tabular-nums opacity-75">{count}</span>
    </button>
  )
}

function FilterDrawer({
  coverage,
  sourceCounts,
  activeTypes,
  quality,
  minImportance,
  query,
  onQueryChange,
  onQualityChange,
  onImportanceChange,
  onToggleType,
  onShowAll,
}: {
  coverage: TimelineSourceCoverage[]
  sourceCounts: Map<TimelineEventV2Type, number>
  activeTypes: TimelineEventV2Type[]
  quality: TimelineQualityFilter
  minImportance: number
  query: string
  onQueryChange: (value: string) => void
  onQualityChange: (value: TimelineQualityFilter) => void
  onImportanceChange: (value: number) => void
  onToggleType: (type: TimelineEventV2Type) => void
  onShowAll: () => void
}) {
  const loadedCount = coverage.filter((source) => source.status === 'loaded').length
  const degradedCount = coverage.filter((source) => source.status === 'degraded').length

  return (
    <div className="border-t border-[#263950] bg-[#0b1625] px-4 py-3.5">
      <div className="grid gap-3 xl:grid-cols-[minmax(200px,0.75fr)_minmax(0,1.6fr)_180px_180px] xl:items-end">
        <label className="block">
          <span className={eyebrowClass}>Search events</span>
          <span className="relative mt-1.5 block">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#8398b0]" aria-hidden="true" />
            <Input value={query} onChange={(event) => onQueryChange(event.target.value)} placeholder="Search titles, themes, sources" className="h-9 border-[#334861] bg-[#101c2b] pl-9 text-sm text-[#e6eff9] placeholder:text-[#758aa1]" />
          </span>
        </label>

        <div>
          <div className="flex items-center justify-between gap-3">
            <span className={eyebrowClass}>Sources</span>
            {activeTypes.length > 0 && <button type="button" onClick={onShowAll} className="text-[11px] font-medium text-[#a9bdea] hover:text-[#dce8f6]">Show all</button>}
          </div>
          <div className="mt-1.5 flex flex-wrap gap-1.5">
            {SOURCE_ORDER.map((type) => <SourceToggle key={type} type={type} active={activeTypes.length === 0 || activeTypes.includes(type)} count={sourceCounts.get(type) || 0} onToggle={() => onToggleType(type)} />)}
          </div>
        </div>

        <label className="block">
          <span className={eyebrowClass}>Quality</span>
          <select value={quality} onChange={(event) => onQualityChange(event.target.value as TimelineQualityFilter)} className="mt-1.5 h-9 w-full rounded-md border border-[#334861] bg-[#101c2b] px-2.5 text-sm text-[#dce8f6] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9bdea]">
            {QUALITY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </label>

        <label className="block">
          <span className="flex items-center justify-between gap-2"><span className={eyebrowClass}>Minimum importance</span><span className="text-xs font-semibold text-[#dce8f6]">{minImportance || 'Any'}</span></span>
          <input type="range" min="0" max="10" value={minImportance} onChange={(event) => onImportanceChange(Number(event.target.value))} className="mt-2 h-7 w-full accent-[#a9bdea]" aria-label="Minimum event importance" />
        </label>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-[#263950] pt-2.5 text-[11px] text-[#8fa1b8]">
        <span><Database className="mr-1 inline h-3.5 w-3.5 text-[#9dbcf2]" aria-hidden="true" />{loadedCount} authoritative sources loaded</span>
        {degradedCount > 0 && <span className="text-[#e7bb70]"><AlertTriangle className="mr-1 inline h-3.5 w-3.5" aria-hidden="true" />{degradedCount} source{degradedCount === 1 ? '' : 's'} degraded</span>}
      </div>
    </div>
  )
}

function ChronicleMetric({ label, value, hint, accent = '#dce8f6' }: { label: string; value: string | number; hint: string; accent?: string }) {
  return (
    <div className="rounded-lg border border-[#2b3e56] bg-[#0e1928] px-3 py-3 text-center">
      <p className="text-[10px] font-semibold text-[#a4b4c6]">{label}</p>
      <p className="mt-1 text-2xl font-semibold leading-none tabular-nums" style={{ color: accent }}>{value}</p>
      <p className="mt-1.5 text-[10px] text-[#8295ad]">{hint}</p>
    </div>
  )
}

function TimelineChronicle({
  agentName,
  payload,
  refreshing,
  onRefresh,
}: {
  agentName: string
  payload: TimelineWorkspacePayload | null
  refreshing: boolean
  onRefresh: () => void
}) {
  const summary = payload?.summary
  const threads = payload?.threads || []

  return (
    <section className={panelClass} aria-label="Timeline chronicle">
      <div className="grid xl:grid-cols-[minmax(0,1.04fr)_minmax(420px,1fr)]">
        <div className="p-4 md:p-5">
          <div className="flex items-start gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-[#ad92df]/60 bg-[#19172a] text-[#b9addd]">
              <Clock3 className="h-5 w-5" aria-hidden="true" />
            </span>
            <div className="min-w-0">
              <p className={eyebrowClass}>Agent chronicle</p>
              <h1 className="mt-1 text-xl font-semibold tracking-tight text-[#edf3fb] md:text-2xl">{agentName} Timeline</h1>
              <p className="mt-1 text-xs leading-5 text-[#9db0c7]">Inspectable life events composed from persisted feature records, quality gates, evidence, and relationship state.</p>
            </div>
          </div>
          <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <ChronicleMetric label="Visible" value={summary?.visibleEvents ?? 0} hint={`${summary?.totalEvents ?? 0} total indexed`} accent="#b9addd" />
            <ChronicleMetric label="High signal" value={summary?.highImportanceEvents ?? 0} hint="importance 8+" accent="#7fc8b9" />
            <ChronicleMetric label="Average" value={(summary?.averageImportance ?? 0).toFixed(1)} hint="importance score" accent="#e7bb70" />
            <ChronicleMetric label="Latest" value={summary?.latestEventAt ? new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(new Date(summary.latestEventAt)) : '—'} hint="newest event" accent="#8ac9dc" />
          </div>
        </div>

        <div className="border-t border-[#263950] p-4 md:p-5 xl:border-l xl:border-t-0">
          <div className="flex items-center justify-between gap-3">
            <div><p className="text-base font-medium text-[#edf3fb]">Narrative threads</p><p className="mt-0.5 text-[11px] text-[#8398b0]">Repeated themes across visible events</p></div>
            <button type="button" onClick={onRefresh} disabled={refreshing} className="inline-flex min-h-9 items-center gap-2 rounded-md border border-[#30445d] bg-[#101c2b] px-3 text-xs font-medium text-[#c7d6e7] hover:text-[#edf3fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9bdea] disabled:opacity-60"><RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} aria-hidden="true" />Refresh</button>
          </div>
          <div className="mt-3 flex flex-wrap gap-2">
            {threads.slice(0, 8).map((thread) => <span key={thread.id} className="rounded-md border border-[#30445d] bg-[#101c2b] px-2.5 py-1 text-xs text-[#b8c8da]"><span className="text-[#e1eaf5]">{thread.label}</span><span className="ml-3 tabular-nums text-[#9dbcf2]">{thread.count}</span></span>)}
            {payload && threads.length === 0 && <span className="text-xs text-[#8fa1b8]">Threads appear after repeated themes emerge.</span>}
          </div>
          <p className="mt-5 flex items-center gap-2 text-[11px] text-[#9db0c7]"><span className="h-2 w-2 rounded-full bg-[#65c78d]" aria-hidden="true" />Composed server-side</p>
        </div>
      </div>
    </section>
  )
}

function SourceCoverageGrid({ coverage }: { coverage: TimelineSourceCoverage[] }) {
  return (
    <section className={panelClass} aria-label="Source coverage">
      <header className="border-b border-[#263950] px-4 py-2.5">
        <h2 className="text-sm font-semibold text-[#edf3fb]">Source coverage</h2>
        <p className="mt-0.5 text-[11px] text-[#8fa1b8]">Loaded from authoritative feature records</p>
      </header>
      <div className="grid gap-2 p-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
        {coverage.map((source) => {
          const config = SOURCE_CONFIG[source.source]
          const Icon = config.icon
          const statusColor = source.status === 'loaded' ? '#91d4ae' : source.status === 'degraded' ? '#e7bb70' : '#71859d'
          return (
            <div key={source.source} className="flex min-h-12 items-center gap-2.5 rounded-lg border border-[#2b3e56] bg-[#0e1928] px-3 py-2">
              <Icon className="h-4 w-4 shrink-0" style={{ color: config.accent }} aria-hidden="true" />
              <div className="min-w-0 flex-1"><p className="truncate text-xs font-medium text-[#dbe6f2]">{config.label}</p><p className="mt-0.5 text-[10px] text-[#8fa1b8]">{source.count} event{source.count === 1 ? '' : 's'}</p></div>
              {source.status === 'degraded' ? <AlertTriangle className="h-3.5 w-3.5 shrink-0" style={{ color: statusColor }} aria-label="Source degraded" /> : source.status === 'loaded' ? <CheckCircle2 className="h-3.5 w-3.5 shrink-0" style={{ color: statusColor }} aria-label="Source loaded" /> : <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ backgroundColor: statusColor }} aria-label="Source empty" />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function TimelineEventRow({
  event,
  selected,
  onSelect,
  showDate,
}: {
  event: TimelineEventV2
  selected: boolean
  onSelect: () => void
  showDate: boolean
}) {
  const config = SOURCE_CONFIG[event.type]
  const quality = getQualityTone(event.qualityStatus)

  return (
    <li className="relative grid grid-cols-[62px_48px_minmax(0,1fr)] gap-x-3 py-1.5 pr-3 sm:grid-cols-[68px_52px_minmax(0,1fr)_76px]">
      <div className="relative text-right">
        <time dateTime={event.timestamp} className="text-[11px] font-medium tabular-nums text-[#aebed0]">{formatTime(event.timestamp)}</time>
        {showDate && <p className="mt-0.5 text-[10px] text-[#71859d]">{formatDay(event.timestamp).split(',')[0]}</p>}
      </div>
      <div className="relative flex justify-center pt-1">
        <span className="absolute bottom-[-8px] top-5 w-px bg-[#314860]" aria-hidden="true" />
        <span className="relative z-10 mt-1.5 h-3 w-3 rounded-full border-2 border-[#0c1726]" style={{ backgroundColor: config.accent }} aria-hidden="true" />
      </div>
      <button
        type="button"
        onClick={onSelect}
        aria-current={selected ? 'true' : undefined}
        className={cn(
          'col-span-2 grid min-w-0 grid-cols-[42px_minmax(0,1fr)] gap-x-3 rounded-lg border px-3 py-2.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9bdea] sm:col-span-1',
          selected ? 'bg-[#101c2b]' : 'border-[#263950] bg-[#0e1928] hover:border-[#3c5471] hover:bg-[#101c2b]'
        )}
        style={selected ? { borderColor: `${config.accent}88`, backgroundColor: `${config.accent}12` } : undefined}
      >
        <span className="grid h-10 w-10 place-items-center rounded-md border" style={{ color: config.accent, borderColor: `${config.accent}55`, backgroundColor: `${config.accent}0f` }}>
          <EventIcon type={event.type} className="h-5 w-5" />
        </span>
        <span className="min-w-0">
          <span className="flex flex-wrap items-center gap-2">
            <SourceBadge type={event.type} />
            {event.qualityStatus && <span className="text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: quality.color }}>{formatSourceName(event.qualityStatus)}</span>}
          </span>
          <span className="mt-1.5 block truncate text-sm font-semibold text-[#e7eef8]">{event.title}</span>
          <span className="mt-1 block line-clamp-1 text-xs leading-5 text-[#aebed0]">{event.summary}</span>
          <span className="mt-2 flex flex-wrap items-center gap-1.5">
            <span className="rounded-md border border-[#5e4d2a] bg-[#211d14] px-1.5 py-0.5 text-[10px] font-semibold text-[#e7bb70]">Importance {event.importance}/10</span>
            <span className="rounded-md border border-[#2d4058] bg-[#101c2b] px-1.5 py-0.5 text-[10px] text-[#aebed0]">{formatSourceName(event.source)}</span>
            {event.evidenceRefs.length > 0 && <span className="rounded-md border border-[#2d4058] bg-[#101c2b] px-1.5 py-0.5 text-[10px] text-[#aebed0]">{event.evidenceRefs.length} ref{event.evidenceRefs.length === 1 ? '' : 's'}</span>}
          </span>
        </span>
      </button>
      <div className="hidden self-center text-right sm:block">
        {event.qualityStatus ? (
          <span className="inline-flex items-center justify-end gap-1 text-[10px] font-medium" style={{ color: quality.color }}>
            {event.qualityStatus === 'passed' ? <CheckCircle2 className="h-3.5 w-3.5" aria-hidden="true" /> : <Clock3 className="h-3.5 w-3.5" aria-hidden="true" />}
            {quality.label}
          </span>
        ) : <span className="text-[10px] text-[#71859d]">recorded</span>}
      </div>
    </li>
  )
}

function ClusterGroup({
  cluster,
  events,
  selectedId,
  onSelect,
  first,
}: {
  cluster: TimelineClusterV2
  events: TimelineEventV2[]
  selectedId?: string
  onSelect: (event: TimelineEventV2) => void
  first: boolean
}) {
  const clusterEvents = cluster.eventIds.map((id) => events.find((event) => event.id === id)).filter((event): event is TimelineEventV2 => Boolean(event))
  if (clusterEvents.length === 0) return null

  return (
    <section className={cn(!first && 'border-t border-[#263950] pt-3')}>
      {!first && <div className="mb-2 flex items-center gap-3 px-3"><span className="text-sm font-semibold text-[#dce8f6]">{formatDay(cluster.startTime)}</span><span className="text-xs text-[#8fa1b8]">{cluster.count} events</span></div>}
      <ol className="px-3 pb-1">
        {clusterEvents.map((event, index) => <TimelineEventRow key={event.id} event={event} selected={selectedId === event.id} onSelect={() => onSelect(event)} showDate={index === 0} />)}
      </ol>
    </section>
  )
}

function ReferenceList({ title, refs }: { title: string; refs: TimelineSourceRefV2[] }) {
  if (!refs.length) return null
  return (
    <section className={quietPanelClass}>
      <h3 className="border-b border-[#263950] px-3 py-2 text-xs font-semibold text-[#dce8f6]">{title}</h3>
      <div className="divide-y divide-[#263950]">
        {refs.slice(0, 6).map((ref) => (
          <div key={`${ref.type}:${ref.id}:${ref.label}`} className="flex items-center justify-between gap-3 px-3 py-2 text-[11px]">
            <div className="min-w-0"><p className="truncate font-medium text-[#cdd9e7]">{ref.label}</p><p className="mt-0.5 truncate text-[#8295ad]">{formatSourceName(ref.type)} · {compactId(ref.id)}</p></div>
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#7e91a8]" aria-hidden="true" />
          </div>
        ))}
      </div>
    </section>
  )
}

function getDownstreamEffects(event: TimelineEventV2) {
  const effects: Array<{ label: string; tone: string }> = []
  const hints = event.detail.downstreamHints
  if (Array.isArray(hints)) {
    for (const hint of hints.slice(0, 3)) {
      if (hint && typeof hint === 'object' && 'feature' in hint && 'hint' in hint && typeof hint.feature === 'string' && typeof hint.hint === 'string') {
        effects.push({ label: `${formatSourceName(hint.feature)}: ${hint.hint}`, tone: '#91d4ae' })
      }
    }
  }
  if (typeof event.detail.promptEligible === 'boolean') {
    effects.push({ label: `Prompt eligible: ${event.detail.promptEligible ? 'yes' : 'no'}`, tone: event.detail.promptEligible ? '#91d4ae' : '#e38b8c' })
  }
  if (event.qualityStatus && event.qualityStatus !== 'passed') {
    effects.push({ label: `Quality status: ${formatSourceName(event.qualityStatus)}`, tone: '#e7bb70' })
  }
  return effects.slice(0, 4)
}

function EventInspector({ event }: { event: TimelineEventV2 | null }) {
  const [copied, setCopied] = useState(false)

  useEffect(() => setCopied(false), [event?.id])

  if (!event) {
    return (
      <aside className="hidden lg:block">
        <div className={cn(quietPanelClass, 'flex min-h-[520px] flex-col items-center justify-center px-8 text-center')}>
          <Clock3 className="h-7 w-7 text-[#8da0b7]" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-semibold text-[#dce8f6]">Select an event</h2>
          <p className="mt-1.5 max-w-[230px] text-xs leading-5 text-[#8fa1b8]">Inspect the source, quality state, participants, themes, and preserved references here.</p>
        </div>
      </aside>
    )
  }

  const config = SOURCE_CONFIG[event.type]
  const quality = getQualityTone(event.qualityStatus)
  const effects = getDownstreamEffects(event)
  const sourceRefs = event.sourceRefs.length ? event.sourceRefs : [{ type: event.source, id: event.sourceId, label: `${config.label} source` }]
  const evidenceRefs = event.evidenceRefs.map((id) => ({ type: 'evidence', id, label: 'Linked evidence' }))

  const copyEventId = async () => {
    try {
      await navigator.clipboard.writeText(event.id)
      setCopied(true)
    } catch {
      setCopied(false)
    }
  }

  return (
    <aside className="space-y-3 lg:sticky lg:top-3 lg:max-h-[calc(100vh-1.5rem)] lg:overflow-y-auto" aria-label="Selected timeline event">
      <header className={cn(quietPanelClass, 'flex items-center justify-between gap-3 px-4 py-3')} style={{ borderColor: `${config.accent}55` }}>
        <div className="flex items-center gap-2"><span className="grid h-6 w-6 place-items-center rounded-md border" style={{ color: config.accent, borderColor: `${config.accent}55`, backgroundColor: `${config.accent}12` }}><EventIcon type={event.type} className="h-3.5 w-3.5" /></span><h2 className="text-sm font-semibold text-[#edf3fb]">Selected event</h2></div>
        <button type="button" onClick={() => void copyEventId()} className="inline-flex min-h-7 items-center gap-1.5 rounded-md border border-[#30445d] bg-[#101c2b] px-2 text-[10px] font-medium text-[#aebed0] hover:text-[#edf3fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9bdea]" aria-label="Copy selected event ID">
          <Copy className="h-3 w-3" aria-hidden="true" />{copied ? 'Copied' : 'Copy ID'}
        </button>
      </header>

      <div className="space-y-3">
        <section className={quietPanelClass}>
          <div className="flex gap-3 p-3.5">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-md border" style={{ color: config.accent, borderColor: `${config.accent}55`, backgroundColor: `${config.accent}12` }}><EventIcon type={event.type} className="h-5 w-5" /></span>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-1.5"><SourceBadge type={event.type} />{event.qualityStatus && <span className="rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-[0.08em]" style={{ color: quality.color, borderColor: `${quality.color}55`, backgroundColor: `${quality.color}10` }}>{formatSourceName(event.qualityStatus)}</span>}</div>
              <h3 className="mt-2 text-sm font-semibold leading-5 text-[#edf3fb]">{event.title}</h3>
              <p className="mt-1 text-[11px] text-[#8fa1b8]">{formatDay(event.timestamp)} · {formatTime(event.timestamp)}</p>
            </div>
          </div>
        </section>

        {event.content && <details className={cn(quietPanelClass, 'group overflow-hidden')}>
          <summary className="flex min-h-10 cursor-pointer list-none items-center gap-2 px-3 py-2 text-xs text-[#cbd8e6] marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9bdea] focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
            <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#9dbcf2] transition-transform group-open:rotate-90" aria-hidden="true" />
            <BookOpen className="h-3.5 w-3.5 shrink-0" style={{ color: config.accent }} aria-hidden="true" />
            <span className="shrink-0 font-semibold text-[#dce8f6]">Source content</span>
            <span className="min-w-0 truncate text-[#9db0c7]">{previewText(event.content)}</span>
          </summary>
          <div className="border-t border-[#263950] px-3 py-3 text-xs leading-5 text-[#c3d0df] whitespace-pre-wrap">{event.content}</div>
        </details>}

        <section className={quietPanelClass}>
          <h3 className="border-b border-[#263950] px-3 py-2 text-xs font-semibold text-[#dce8f6]">Summary</h3>
          <p className="px-3 py-2.5 text-xs leading-5 text-[#bac9d9]">{event.summary}</p>
        </section>

        <div className="grid grid-cols-2 gap-2">
          <div className={quietPanelClass}><p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8da0b7]">Importance</p><p className="px-3 pb-2.5 pt-1 text-sm font-semibold text-[#e7bb70]">{event.importance}/10</p></div>
          <div className={quietPanelClass}><p className="px-3 pt-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-[#8da0b7]">Quality</p><p className="px-3 pb-2.5 pt-1 text-sm font-semibold" style={{ color: quality.color }}>{event.qualityScore ?? formatSourceName(event.qualityStatus || 'Unknown')}</p></div>
        </div>

        <section className={quietPanelClass}>
          <h3 className="border-b border-[#263950] px-3 py-2 text-xs font-semibold text-[#dce8f6]">Source</h3>
          <dl className="divide-y divide-[#263950] px-3 text-[11px]">
            <div className="flex items-center justify-between gap-3 py-2"><dt className="text-[#8fa1b8]">Source table</dt><dd className="max-w-[62%] truncate text-right font-medium text-[#cdd9e7]">{formatSourceName(event.source)}</dd></div>
            <div className="flex items-center justify-between gap-3 py-2"><dt className="text-[#8fa1b8]">Source ID</dt><dd className="max-w-[62%] truncate text-right font-mono text-[#aebed0]">{compactId(event.sourceId)}</dd></div>
            {event.status && <div className="flex items-center justify-between gap-3 py-2"><dt className="text-[#8fa1b8]">Status</dt><dd className="max-w-[62%] truncate text-right font-medium text-[#cdd9e7]">{formatSourceName(event.status)}</dd></div>}
          </dl>
        </section>

        {event.themes.length > 0 && <section><h3 className={eyebrowClass}>Themes</h3><div className="mt-2 flex flex-wrap gap-1.5">{event.themes.slice(0, 8).map((theme) => <span key={theme} className="rounded-md border border-[#30445d] bg-[#101c2b] px-2 py-1 text-[10px] text-[#b7c8dc]">{theme}</span>)}</div></section>}

        {event.participants.length > 0 && <section className={quietPanelClass}><h3 className="border-b border-[#263950] px-3 py-2 text-xs font-semibold text-[#dce8f6]">Participants</h3><div className="divide-y divide-[#263950]">{event.participants.slice(0, 5).map((participant) => <div key={`${participant.id}:${participant.role}`} className="px-3 py-2 text-[11px]"><p className="font-medium text-[#cdd9e7]">{participant.name || participant.id}</p>{participant.role && <p className="mt-0.5 text-[#8fa1b8]">{participant.role}</p>}</div>)}</div></section>}

        {effects.length > 0 && <section className={quietPanelClass}><h3 className="border-b border-[#263950] px-3 py-2 text-xs font-semibold text-[#dce8f6]">Downstream effects</h3><div className="space-y-1.5 px-3 py-2.5">{effects.map((effect) => <p key={effect.label} className="flex gap-2 text-[11px] leading-4 text-[#b9c8d8]"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0" style={{ color: effect.tone }} aria-hidden="true" />{effect.label}</p>)}</div></section>}

        <ReferenceList title="Source references" refs={sourceRefs} />
        <ReferenceList title="Evidence references" refs={evidenceRefs} />
        <ReferenceList title="Related records" refs={event.relatedRefs} />
      </div>
    </aside>
  )
}

function TimelineSkeleton() {
  return <div className="space-y-2 px-3 py-3">{[0, 1, 2, 3, 4].map((index) => <div key={index} className="grid grid-cols-[62px_48px_minmax(0,1fr)] gap-x-3 animate-pulse"><div className="mt-3 h-3 w-12 rounded bg-[#223347]" /><div className="mx-auto mt-3 h-3 w-3 rounded-full bg-[#2f4560]" /><div className="h-24 rounded-lg border border-[#263950] bg-[#101c2b]" /></div>)}</div>
}

export function TimelineExplorer({ agentId, agentName, className = '' }: TimelineExplorerProps) {
  const [payload, setPayload] = useState<TimelineWorkspacePayload | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<TimelineEventV2 | null>(null)
  const [activeTypes, setActiveTypes] = useState<TimelineEventV2Type[]>([])
  const [quality, setQuality] = useState<TimelineQualityFilter>('all')
  const [query, setQuery] = useState('')
  const [minImportance, setMinImportance] = useState(0)
  const [filterOpen, setFilterOpen] = useState(true)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const sourceCounts = useMemo(() => {
    const counts = new Map<TimelineEventV2Type, number>()
    SOURCE_ORDER.forEach((source) => counts.set(source, 0))
    payload?.coverage.forEach((source) => counts.set(source.source, source.count))
    return counts
  }, [payload])

  const loadTimeline = useCallback(async (showRefresh = false) => {
    try {
      setError(null)
      if (showRefresh) setRefreshing(true)
      else setLoading(true)
      const params = new URLSearchParams({ limit: '120' })
      if (activeTypes.length) params.set('types', activeTypes.join(','))
      if (quality !== 'all') params.set('quality', quality)
      if (query.trim()) params.set('q', query.trim())
      if (minImportance > 0) params.set('minImportance', String(minImportance))
      const data = await parseResponse<TimelineWorkspacePayload>(await fetch(`/api/agents/${agentId}/timeline?${params.toString()}`, { cache: 'no-store' }))
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

  const toggleType = (type: TimelineEventV2Type) => setActiveTypes((current) => current.length === 0 ? [type] : current.includes(type) ? current.filter((entry) => entry !== type) : [...current, type])
  const events = payload?.events || []
  const clusters = payload?.clusters || []
  const firstCluster = clusters[0]
  const hasActiveFilters = activeTypes.length > 0 || quality !== 'all' || minImportance > 0 || Boolean(query.trim())

  return (
    <section className={cn('space-y-3', className)} aria-label={`${agentName} timeline`}>
      <TimelineChronicle agentName={agentName} payload={payload} refreshing={refreshing} onRefresh={() => void loadTimeline(true)} />
      {filterOpen && <div id="timeline-filters" className={panelClass}><FilterDrawer coverage={payload?.coverage || []} sourceCounts={sourceCounts} activeTypes={activeTypes} quality={quality} minImportance={minImportance} query={query} onQueryChange={setQuery} onQualityChange={setQuality} onImportanceChange={setMinImportance} onToggleType={toggleType} onShowAll={() => setActiveTypes([])} /></div>}
      {payload && <SourceCoverageGrid coverage={payload.coverage} />}

      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(420px,0.75fr)] 2xl:grid-cols-[minmax(0,1fr)_minmax(500px,0.82fr)]">
        <main className={panelClass}>
        <header className="flex flex-wrap items-center gap-3 border-b border-[#263950] px-4 py-3">
          <div className="flex min-w-0 items-center gap-2.5"><Clock3 className="h-4 w-4 shrink-0 text-[#a9bdea]" aria-hidden="true" /><h1 className="truncate text-sm font-semibold text-[#edf3fb]">{firstCluster ? formatDay(firstCluster.startTime) : 'Event stream'}</h1><span className="text-xs text-[#9db0c7]">{events.length} event{events.length === 1 ? '' : 's'}</span></div>
          <div className="ml-auto flex items-center gap-2">
            <span className="hidden items-center gap-1.5 text-[11px] text-[#9db0c7] sm:inline-flex">Sorted by time (desc)<ChevronDown className="h-3.5 w-3.5" aria-hidden="true" /></span>
            <button type="button" onClick={() => setFilterOpen((open) => !open)} aria-expanded={filterOpen} aria-controls="timeline-filters" className={cn('inline-flex min-h-8 items-center gap-1.5 rounded-md border px-2.5 text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9bdea]', filterOpen || hasActiveFilters ? 'border-[#5574a0] bg-[#152238] text-[#dce8f6]' : 'border-[#30445d] bg-[#101c2b] text-[#b7c8dc] hover:text-[#edf3fb]')}><SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />Filters{hasActiveFilters && <span className="grid h-4 min-w-4 place-items-center rounded-full bg-[#a9bdea] px-1 text-[9px] font-bold text-[#101923]">{activeTypes.length + (quality !== 'all' ? 1 : 0) + (minImportance > 0 ? 1 : 0) + (query.trim() ? 1 : 0)}</span>}</button>
          </div>
        </header>

        {error && <div className="m-3 flex items-start gap-2 rounded-lg border border-[#e38b8c]/40 bg-[#301c25] p-3 text-sm text-[#f0bac2]"><AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" /><div><p className="font-semibold">Timeline failed to load</p><p className="mt-1 text-xs">{error}</p></div></div>}

        {loading ? <TimelineSkeleton /> : events.length === 0 ? (
          <div className="px-6 py-16 text-center"><Filter className="mx-auto h-7 w-7 text-[#8da0b7]" aria-hidden="true" /><h2 className="mt-3 text-sm font-semibold text-[#dce8f6]">No timeline events found</h2><p className="mx-auto mt-1.5 max-w-sm text-xs leading-5 text-[#8fa1b8]">Adjust the filters or create saved artifacts, relationship changes, memories, or conversations for this agent.</p></div>
        ) : (
          <div className="divide-y divide-[#263950]">
            {clusters.map((cluster, index) => <ClusterGroup key={cluster.id} cluster={cluster} events={events} selectedId={selectedEvent?.id} onSelect={setSelectedEvent} first={index === 0} />)}
            {payload?.nextCursor && <p className="border-t border-[#263950] px-4 py-2.5 text-center text-[11px] text-[#8194ab]">Showing the newest {events.length} indexed events.</p>}
          </div>
        )}
      </main>
      <EventInspector event={selectedEvent} />
      </div>
    </section>
  )
}

export default TimelineExplorer
