'use client'

import type { LucideIcon } from 'lucide-react'
import {
  Activity,
  ArrowRight,
  Bot,
  BookOpenCheck,
  BrainCircuit,
  CalendarClock,
  CheckCircle2,
  CircleDot,
  Database,
  FileText,
  FlaskConical,
  GitBranch,
  GraduationCap,
  Heart,
  Info,
  Landmark,
  Library,
  MessageCircle,
  Network,
  ShieldCheck,
  Sparkles,
  Swords,
  Users,
} from 'lucide-react'
import { EmotionRadar } from '@/components/emotions/EmotionRadar'
import { cn } from '@/lib/utils'
import { emotionalService } from '@/lib/services/emotionalService'
import type {
  AgentRecord,
  LibraryStats,
  TimelineEventV2,
  TimelineWorkspacePayload,
} from '@/types/database'

export type AgentOverviewTab =
  | 'chat'
  | 'memory'
  | 'emotions'
  | 'timeline'
  | 'relationships'
  | 'learning'
  | 'scenarios'
  | 'creative'
  | 'dreams'
  | 'journal'
  | 'profile'
  | 'challenges'
  | 'knowledge-graph'
  | 'knowledge-library'
  | 'mentorship'

interface AgentOverviewCockpitProps {
  agent: AgentRecord
  timeline: TimelineWorkspacePayload | null
  timelineLoading: boolean
  libraryStats: LibraryStats | null
  libraryLoading: boolean
  onOpenTab: (tab: AgentOverviewTab) => void
}

type Accent = 'sky' | 'cyan' | 'mint' | 'amber' | 'rose' | 'peach'

const accentClasses: Record<Accent, { dot: string; text: string; border: string; icon: string; ring: string }> = {
  sky: { dot: 'bg-blue-300', text: 'text-blue-200', border: 'border-blue-300/35', icon: 'text-blue-200', ring: 'ring-blue-300/25' },
  cyan: { dot: 'bg-cyan-300', text: 'text-cyan-200', border: 'border-cyan-300/35', icon: 'text-cyan-200', ring: 'ring-cyan-300/25' },
  mint: { dot: 'bg-emerald-300', text: 'text-emerald-200', border: 'border-emerald-300/35', icon: 'text-emerald-200', ring: 'ring-emerald-300/25' },
  amber: { dot: 'bg-amber-300', text: 'text-amber-200', border: 'border-amber-300/35', icon: 'text-amber-200', ring: 'ring-amber-300/25' },
  rose: { dot: 'bg-rose-300', text: 'text-rose-200', border: 'border-rose-300/35', icon: 'text-rose-200', ring: 'ring-rose-300/25' },
  peach: { dot: 'bg-orange-200', text: 'text-orange-200', border: 'border-orange-200/35', icon: 'text-orange-200', ring: 'ring-orange-200/25' },
}

function formatNumber(value: number | undefined) {
  return new Intl.NumberFormat().format(value || 0)
}

function formatEmotion(emotion: string | null | undefined) {
  if (!emotion) return 'No live emotion'
  return `${emotion.slice(0, 1).toUpperCase()}${emotion.slice(1)}`
}

function relativeTime(value?: string) {
  if (!value || Number.isNaN(Date.parse(value))) return 'Not recorded'
  const seconds = Math.max(0, Math.floor((Date.now() - Date.parse(value)) / 1000))
  if (seconds < 60) return 'Just now'
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`
  return `${Math.floor(seconds / 86400)}d ago`
}

function labelize(value: string) {
  return value.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function statusAccent(status: AgentRecord['status']): Accent {
  if (status === 'active') return 'mint'
  if (status === 'training') return 'amber'
  return 'rose'
}

function Panel({ title, icon: Icon, children, className, iconClass = 'text-[#adc7ff]' }: { title: string; icon: LucideIcon; children: React.ReactNode; className?: string; iconClass?: string }) {
  return (
    <section className={cn('overflow-hidden rounded-[6px] border border-[#314057]/80 bg-[#0e1826]/92 shadow-[0_18px_50px_-38px_rgba(0,0,0,0.95)]', className)}>
      <header className="flex h-10 items-center gap-2.5 border-b border-[#314057]/75 px-4">
        <Icon className={cn('h-[18px] w-[18px] stroke-[1.7]', iconClass)} aria-hidden="true" />
        <h2 className="text-[15px] font-semibold tracking-[-0.02em] text-[#f1f4ff]">{title}</h2>
      </header>
      {children}
    </section>
  )
}

function DataRow({ icon: Icon, label, value, accent = 'sky' }: { icon: LucideIcon; label: string; value: string; accent?: Accent }) {
  const tone = accentClasses[accent]
  return (
    <div className="flex min-w-0 items-center gap-2.5 py-1.5">
      <Icon className={cn('h-4 w-4 shrink-0 stroke-[1.65]', tone.icon)} aria-hidden="true" />
      <span className="min-w-0 flex-1 truncate text-[12px] text-[#c7d0df]">{label}</span>
      <span className={cn('max-w-[58%] truncate text-right text-[12px] font-medium tabular-nums', tone.text)}>{value}</span>
    </div>
  )
}

function CapabilityNode({ icon: Icon, label, value, tab, accent, onOpenTab }: { icon: LucideIcon; label: string; value: string; tab: AgentOverviewTab; accent: Accent; onOpenTab: (tab: AgentOverviewTab) => void }) {
  const tone = accentClasses[accent]
  return (
    <button
      type="button"
      onClick={() => onOpenTab(tab)}
      className={cn('group relative flex min-h-[57px] min-w-0 items-center gap-2.5 rounded-[5px] border bg-[#0b1421]/90 px-3 text-left transition duration-200 hover:-translate-y-px hover:bg-[#162339] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b8cdff] focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1826]', tone.border)}
    >
      <Icon className={cn('h-[19px] w-[19px] shrink-0 stroke-[1.55]', tone.icon)} aria-hidden="true" />
      <span className="min-w-0">
        <span className="block truncate text-[11px] font-medium leading-tight text-[#e9eefb]">{label}</span>
        <span className={cn('mt-1 flex items-center gap-1 text-[10px] font-medium', tone.text)}>
          <span className={cn('h-1.5 w-1.5 rounded-full', tone.dot)} />
          <span className="truncate">{value}</span>
        </span>
      </span>
      <ArrowRight className="absolute right-2 top-2 h-3 w-3 opacity-0 transition group-hover:opacity-75" aria-hidden="true" />
    </button>
  )
}

function EventRow({ event, index, onOpenTab }: { event: TimelineEventV2; index: number; onOpenTab: (tab: AgentOverviewTab) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpenTab('timeline')}
      className="grid w-full grid-cols-[25px_minmax(0,1fr)_auto] items-center gap-2 border-b border-[#2b3950]/65 px-4 py-2 text-left transition hover:bg-[#162238]/75 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[#b8cdff] last:border-b-0"
    >
      <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#b8ccff] text-[11px] font-bold text-[#14213d]">{index + 1}</span>
      <span className="min-w-0">
        <span className="block truncate text-[12px] text-[#e4eaf5]">{event.title}</span>
        <span className="block truncate pt-0.5 text-[10px] text-[#9daec6]">{event.summary}</span>
      </span>
      <span className="text-[11px] text-[#a9c4ff]">{relativeTime(event.timestamp)}</span>
    </button>
  )
}

function InsightCard({ title, icon: Icon, accent, rows, actionLabel, onAction }: { title: string; icon: LucideIcon; accent: Accent; rows: Array<{ icon: LucideIcon; label: string; value: string; accent?: Accent }>; actionLabel: string; onAction: () => void }) {
  const tone = accentClasses[accent]
  return (
    <section className="min-w-0 rounded-[6px] border border-[#314057]/80 bg-[#0e1826]/92 shadow-[0_18px_50px_-38px_rgba(0,0,0,0.95)]">
      <header className="flex items-center gap-2.5 border-b border-[#314057]/75 px-4 py-3">
        <Icon className={cn('h-5 w-5 stroke-[1.55]', tone.icon)} aria-hidden="true" />
        <h2 className="text-[15px] font-semibold text-[#f1f4ff]">{title}</h2>
      </header>
      <div className="px-4 py-2">
        {rows.map((row) => <DataRow key={row.label} {...row} accent={row.accent || accent} />)}
      </div>
      <div className="border-t border-[#314057]/75 px-4 py-3">
        <button
          type="button"
          onClick={onAction}
          className={cn('flex h-9 w-full items-center justify-between rounded-[4px] border px-3 text-[12px] font-semibold transition hover:bg-white/[0.045] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0e1826]', tone.border, tone.text)}
        >
          {actionLabel}
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </div>
    </section>
  )
}

export function AgentOverviewCockpit({ agent, timeline, timelineLoading, libraryStats, libraryLoading, onOpenTab }: AgentOverviewCockpitProps) {
  const emotionalProfile = agent.emotionalProfile || emotionalService.createEmotionalProfile(agent.coreTraits)
  const emotionalState = agent.emotionalState || emotionalService.createDefaultEmotionalState()
  const dominantEmotion = emotionalState.dominantEmotion
  const emotionIntensity = dominantEmotion ? Math.round((emotionalState.currentMood[dominantEmotion] || 0) * 100) : 0
  const stats = agent.stats
  const timelineEvents = timeline?.events.slice(0, 7) || []
  const statusTone = statusAccent(agent.status)
  const mentorshipSessions = (agent.mentorshipStats?.asMentor || 0) + (agent.mentorshipStats?.asMentee || 0)
  const profileState = agent.psychologicalProfile || agent.linguisticProfile ? 'Profile available' : 'No profile analysis'

  const capabilities = [
    { icon: MessageCircle, label: 'Chat turns', value: `${formatNumber(stats?.totalMessages)} messages`, tab: 'chat' as const, accent: 'sky' as Accent },
    { icon: Heart, label: 'Emotion state', value: emotionalState.status === 'active' ? `${formatEmotion(dominantEmotion)} ${emotionIntensity}%` : 'No live signal', tab: 'emotions' as const, accent: 'rose' as Accent },
    { icon: Database, label: 'Memory console', value: `${formatNumber(agent.memoryCount)} memories`, tab: 'memory' as const, accent: 'cyan' as Accent },
    { icon: CalendarClock, label: 'Timeline', value: timelineLoading ? 'Loading records' : timeline ? `${formatNumber(timeline.summary.totalEvents)} events` : 'Unavailable', tab: 'timeline' as const, accent: 'sky' as Accent },
    { icon: Users, label: 'Relationships', value: `${formatNumber(agent.relationshipCount)} social edges`, tab: 'relationships' as const, accent: 'cyan' as Accent },
    { icon: BrainCircuit, label: 'Learning', value: `${formatNumber(stats?.uniqueTopics.length)} tracked topics`, tab: 'learning' as const, accent: 'mint' as Accent },
    { icon: FlaskConical, label: 'Creative studio', value: `${formatNumber(agent.creativeWorks || stats?.creativeWorksCreated)} artifacts`, tab: 'creative' as const, accent: 'peach' as Accent },
    { icon: Sparkles, label: 'Dream journal', value: `${formatNumber(agent.dreamCount || stats?.dreamsGenerated)} sessions`, tab: 'dreams' as const, accent: 'amber' as Accent },
    { icon: FileText, label: 'Journal', value: `${formatNumber(agent.journalCount || stats?.journalEntries)} entries`, tab: 'journal' as const, accent: 'sky' as Accent },
    { icon: Landmark, label: 'Profile evidence', value: profileState, tab: 'profile' as const, accent: 'peach' as Accent },
    { icon: Swords, label: 'Challenges', value: `${formatNumber(agent.challengesCompleted)} completed`, tab: 'challenges' as const, accent: 'amber' as Accent },
    { icon: Library, label: 'Knowledge library', value: libraryLoading ? 'Loading records' : libraryStats ? `${formatNumber(libraryStats.total)} items` : 'Unavailable', tab: 'knowledge-library' as const, accent: 'rose' as Accent },
    { icon: GraduationCap, label: 'Mentorship', value: `${formatNumber(mentorshipSessions)} linked sessions`, tab: 'mentorship' as const, accent: 'cyan' as Accent },
  ]

  return (
    <div className="agent-cockpit space-y-4">
      <section aria-labelledby="cockpit-title" className="px-1 pt-1">
        <h2 id="cockpit-title" className="text-[20px] font-semibold tracking-[-0.035em] text-[#f4f6ff]">Agent feature cockpit</h2>
        <p className="mt-0.5 text-[12px] text-[#b4c0d5]">Inspectable state, current signals, connected workspaces, and persisted provenance.</p>
      </section>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1.05fr)_minmax(0,1fr)_minmax(330px,0.8fr)]">
        <Panel title="Runtime state" icon={Activity} iconClass="text-[#adc7ff]">
          <div className="grid min-h-[255px] md:grid-cols-[minmax(0,0.92fr)_minmax(220px,0.9fr)]">
            <div className="border-b border-[#314057]/75 px-4 py-3 md:border-b-0 md:border-r">
              <DataRow icon={CircleDot} label="Current agent status" value={labelize(agent.status)} accent={statusTone} />
              <DataRow icon={Heart} label="Current emotion" value={emotionalState.status === 'active' ? `${formatEmotion(dominantEmotion)}, ${emotionIntensity}%` : 'No live emotion'} accent="rose" />
              <DataRow icon={Database} label="Memory count" value={`${formatNumber(agent.memoryCount)} stored`} accent="cyan" />
              <DataRow icon={Users} label="Relationships" value={`${formatNumber(agent.relationshipCount)} social edges`} accent="cyan" />
              <DataRow icon={BrainCircuit} label="Tracked topics" value={`${formatNumber(stats?.uniqueTopics.length)} topics`} accent="mint" />
              <DataRow icon={CalendarClock} label="Last updated" value={relativeTime(agent.updatedAt)} accent="sky" />
            </div>
            <div className="flex min-h-[230px] flex-col items-center justify-center px-2 py-2 text-[#b4c0d5]">
              <EmotionRadar emotionalState={emotionalState} emotionalProfile={emotionalProfile} recentEvents={agent.emotionalHistory} size={225} showLabels />
            </div>
          </div>
        </Panel>

        <Panel title="Feature architecture map" icon={GitBranch} iconClass="text-[#ffc5aa]">
          <div className="relative grid grid-cols-2 gap-2 p-3 sm:grid-cols-3">
            <div className="pointer-events-none absolute inset-x-12 top-1/2 h-px bg-gradient-to-r from-transparent via-[#a9c3ff]/45 to-transparent" aria-hidden="true" />
            {capabilities.map((capability) => <CapabilityNode key={capability.label} {...capability} onOpenTab={onOpenTab} />)}
          </div>
        </Panel>

        <Panel title="Decision provenance" icon={ShieldCheck} iconClass="text-[#ffb8ca]">
          {timelineLoading ? (
            <div className="flex min-h-[255px] items-center justify-center px-4 text-center text-[12px] text-[#aebbd1]">Loading persisted timeline events…</div>
          ) : timelineEvents.length ? (
            <div>{timelineEvents.map((event, index) => <EventRow key={event.id} event={event} index={index} onOpenTab={onOpenTab} />)}</div>
          ) : !timeline ? (
            <div className="flex min-h-[255px] flex-col items-center justify-center px-7 text-center">
              <Info className="h-7 w-7 text-[#d5aa77]" aria-hidden="true" />
              <p className="mt-3 text-[13px] font-medium text-[#e5eafa]">Timeline source unavailable</p>
              <p className="mt-1 text-[11px] leading-5 text-[#aebbd1]">The overview could not load persisted provenance for this agent.</p>
            </div>
          ) : (
            <div className="flex min-h-[255px] flex-col items-center justify-center px-7 text-center">
              <CalendarClock className="h-7 w-7 text-[#9dbbff]" aria-hidden="true" />
              <p className="mt-3 text-[13px] font-medium text-[#e5eafa]">No persisted events yet</p>
              <p className="mt-1 text-[11px] leading-5 text-[#aebbd1]">Timeline provenance will appear after this agent records a conversation or workspace action.</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <InsightCard
          title="Core state"
          icon={Bot}
          accent="sky"
          rows={[
            { icon: CheckCircle2, label: 'Identity', value: agent.persona ? 'Configured' : 'Missing persona', accent: agent.persona ? 'mint' : 'rose' },
            { icon: Heart, label: 'Current emotion', value: emotionalState.status === 'active' ? `${formatEmotion(dominantEmotion)} (${emotionIntensity}%)` : 'No live emotion', accent: 'rose' },
            { icon: Database, label: 'Memory facts', value: formatNumber(agent.memoryCount), accent: 'cyan' },
            { icon: CalendarClock, label: 'Timeline events', value: timelineLoading ? 'Loading' : timeline ? formatNumber(timeline.summary.totalEvents) : 'Unavailable', accent: 'sky' },
          ]}
          actionLabel="Open state inspector"
          onAction={() => onOpenTab('emotions')}
        />
        <InsightCard
          title="Social intelligence"
          icon={Users}
          accent="cyan"
          rows={[
            { icon: Users, label: 'Social edges', value: formatNumber(agent.relationshipCount), accent: 'cyan' },
            { icon: GraduationCap, label: 'Mentor sessions', value: formatNumber(agent.mentorshipStats?.asMentor), accent: 'cyan' },
            { icon: GraduationCap, label: 'Mentee sessions', value: formatNumber(agent.mentorshipStats?.asMentee), accent: 'cyan' },
            { icon: Network, label: 'Mentorship effectiveness', value: agent.mentorshipStats ? `${Math.round(agent.mentorshipStats.effectiveness * 100)}%` : 'Not recorded', accent: 'cyan' },
          ]}
          actionLabel="Open social graph"
          onAction={() => onOpenTab('relationships')}
        />
        <InsightCard
          title="Execution labs"
          icon={FlaskConical}
          accent="amber"
          rows={[
            { icon: Sparkles, label: 'Creative artifacts', value: formatNumber(agent.creativeWorks || stats?.creativeWorksCreated), accent: 'peach' },
            { icon: Sparkles, label: 'Dream sessions', value: formatNumber(agent.dreamCount || stats?.dreamsGenerated), accent: 'amber' },
            { icon: FileText, label: 'Journal entries', value: formatNumber(agent.journalCount || stats?.journalEntries), accent: 'sky' },
            { icon: Swords, label: 'Challenge proofs', value: formatNumber(agent.challengesCompleted), accent: 'amber' },
          ]}
          actionLabel="Open execution console"
          onAction={() => onOpenTab('scenarios')}
        />
        <InsightCard
          title="Knowledge governance"
          icon={BookOpenCheck}
          accent="rose"
          rows={[
            { icon: Library, label: 'Knowledge nodes', value: libraryLoading ? 'Loading' : libraryStats ? formatNumber(libraryStats.total) : 'Unavailable', accent: 'rose' },
            { icon: Info, label: 'Review candidates', value: libraryLoading ? 'Loading' : libraryStats ? formatNumber(libraryStats.review) : 'Unavailable', accent: 'amber' },
            { icon: ShieldCheck, label: 'Validated items', value: libraryLoading ? 'Loading' : libraryStats ? formatNumber(libraryStats.validated) : 'Unavailable', accent: 'mint' },
            { icon: Library, label: 'Disputed items', value: libraryLoading ? 'Loading' : libraryStats ? formatNumber(libraryStats.disputed) : 'Unavailable', accent: 'rose' },
          ]}
          actionLabel="Open knowledge hub"
          onAction={() => onOpenTab('knowledge-library')}
        />
      </div>

      <footer className="flex flex-wrap items-center justify-between gap-3 border-t border-[#314057]/75 px-2 pt-3 text-[11px] text-[#aebbd1]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
          <span className="inline-flex items-center gap-1.5"><Database className="h-4 w-4 text-emerald-300" aria-hidden="true" /> PostgreSQL canonical</span>
          <span className="inline-flex items-center gap-1.5"><CalendarClock className="h-4 w-4 text-blue-200" aria-hidden="true" /> {timeline ? (timeline.summary.latestEventAt ? `timeline updated ${relativeTime(timeline.summary.latestEventAt)}` : 'no timeline event yet') : 'timeline unavailable'}</span>
          <span className="inline-flex items-center gap-1.5"><ShieldCheck className="h-4 w-4 text-amber-200" aria-hidden="true" /> validated-only Library</span>
        </div>
        <span className="inline-flex items-center gap-1.5"><span className={cn('h-2 w-2 rounded-full', accentClasses[statusTone].dot)} /> runtime {agent.status}</span>
      </footer>
    </div>
  )
}
