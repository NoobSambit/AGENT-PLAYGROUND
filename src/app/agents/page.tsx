'use client'

import { useDeferredValue, useEffect, useMemo, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useTheme } from 'next-themes'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  Check,
  ChevronDown,
  CircleDot,
  Database,
  Github,
  Library,
  Menu,
  Moon,
  Network,
  Pin,
  Plus,
  Search,
  Swords,
  UserRound,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'
import { useAgentStore, type Agent } from '@/stores/agentStore'
import { cn } from '@/lib/utils'

const statusFilters = ['all', 'active', 'training', 'inactive'] as const
type StatusFilter = (typeof statusFilters)[number]
type CapabilityFilter = 'profiled' | 'memory-rich' | 'relationship-ready' | 'arena-ready' | 'library-linked'
type Tone = 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'slate' | 'blue'
const AGENTS_PER_PAGE = 6

const navItems = [
  { href: '/', label: 'Home' },
  { href: '/agents', label: 'Agents' },
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/simulation', label: 'Arena' },
  { href: '/#architecture', label: 'Docs' },
]

const capabilityFilters: Array<{ id: CapabilityFilter; label: string; icon: LucideIcon }> = [
  { id: 'profiled', label: 'Profiled', icon: UserRound },
  { id: 'memory-rich', label: 'Memory-rich', icon: Database },
  { id: 'relationship-ready', label: 'Relationship-ready', icon: Network },
  { id: 'arena-ready', label: 'Arena-ready', icon: Swords },
  { id: 'library-linked', label: 'Library-linked', icon: Library },
]

const toneStyles: Record<Tone, { text: string; border: string; bg: string; dot: string; bar: string }> = {
  violet: {
    text: 'text-[#b8a1ff]',
    border: 'border-[#8d6cff]/55',
    bg: 'bg-[#8d6cff]/14',
    dot: 'bg-[#a98cff]',
    bar: 'bg-[#b79cff]',
  },
  cyan: {
    text: 'text-[#7dd8e8]',
    border: 'border-[#4bc7d9]/35',
    bg: 'bg-[#4bc7d9]/10',
    dot: 'bg-[#62d8e8]',
    bar: 'bg-[#62d8e8]',
  },
  emerald: {
    text: 'text-[#7be7a0]',
    border: 'border-[#52d987]/35',
    bg: 'bg-[#52d987]/10',
    dot: 'bg-[#62e694]',
    bar: 'bg-[#76e6a2]',
  },
  amber: {
    text: 'text-[#ffc66d]',
    border: 'border-[#f5ad3d]/35',
    bg: 'bg-[#f5ad3d]/11',
    dot: 'bg-[#ffb84c]',
    bar: 'bg-[#ffc36d]',
  },
  rose: {
    text: 'text-[#ff9bab]',
    border: 'border-[#f47b93]/35',
    bg: 'bg-[#f47b93]/11',
    dot: 'bg-[#ff91a4]',
    bar: 'bg-[#ffa0ad]',
  },
  slate: {
    text: 'text-slate-400',
    border: 'border-white/12',
    bg: 'bg-white/[0.045]',
    dot: 'bg-slate-500',
    bar: 'bg-slate-400',
  },
  blue: {
    text: 'text-[#9bbcff]',
    border: 'border-[#82a8ff]/35',
    bg: 'bg-[#82a8ff]/10',
    dot: 'bg-[#8fb2ff]',
    bar: 'bg-[#9ebcff]',
  },
}

const capabilityTones: Record<string, Tone> = {
  Memory: 'blue',
  Emotion: 'rose',
  Profile: 'emerald',
  Relationships: 'cyan',
  Learning: 'emerald',
  Journal: 'amber',
  Creative: 'violet',
  Challenges: 'rose',
  Library: 'slate',
}

const avatarTones: Tone[] = ['violet', 'blue', 'cyan', 'rose', 'amber', 'slate', 'emerald']

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : undefined
}

function settingString(agent: Agent, keys: string[], fallback: string) {
  const settings = asRecord(agent.settings)
  for (const key of keys) {
    const value = settings?.[key]
    if (typeof value === 'string' && value.trim()) return value.trim()
  }
  return fallback
}

function settingNumber(agent: Agent, keys: string[]) {
  const settings = asRecord(agent.settings)
  for (const key of keys) {
    const value = settings?.[key]
    if (typeof value === 'number' && Number.isFinite(value)) return value
    if (typeof value === 'string') {
      const parsed = Number(value)
      if (Number.isFinite(parsed)) return parsed
    }
  }
  return 0
}

function formatNumber(value: number) {
  return new Intl.NumberFormat('en-US').format(value)
}

function compactId(id: string) {
  if (id.length <= 12) return id
  return `${id.slice(0, 7)}...${id.slice(-3)}`
}

function relativeTime(value?: string) {
  if (!value) return 'not recorded'
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) return 'not recorded'
  const seconds = Math.max(0, Math.floor((Date.now() - timestamp) / 1000))
  if (seconds < 60) return `${seconds || 1}s ago`
  const minutes = Math.floor(seconds / 60)
  if (minutes < 60) return `${minutes}m ago`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h ago`
  const days = Math.floor(hours / 24)
  return `${days}d ago`
}

function statusTone(status: Agent['status']): Tone {
  if (status === 'active') return 'emerald'
  if (status === 'training') return 'amber'
  return 'slate'
}

function agentTone(agent: Agent): Tone {
  const seed = Array.from(agent.id).reduce((sum, char) => sum + char.charCodeAt(0), 0)
  return avatarTones[seed % avatarTones.length]
}

function hasLibraryLink(agent: Agent) {
  return settingNumber(agent, ['librarySignals', 'librarySignalCount', 'libraryItems', 'libraryItemCount']) > 0
}

function agentCapabilities(agent: Agent) {
  const caps: string[] = []
  if ((agent.memoryCount || 0) > 0) caps.push('Memory')
  if (agent.emotionalProfile || agent.emotionalState) caps.push('Emotion')
  if (agent.psychologicalProfile || agent.linguisticProfile) caps.push('Profile')
  if ((agent.relationshipCount || 0) > 0) caps.push('Relationships')
  if ((agent.totalInteractions || 0) > 0 || agent.goals.length > 0) caps.push('Learning')
  if ((agent.journalCount || agent.stats?.journalEntries || 0) > 0) caps.push('Journal')
  if ((agent.creativeWorks || agent.stats?.creativeWorksCreated || 0) > 0) caps.push('Creative')
  if ((agent.challengesCompleted || agent.challengeWins || 0) > 0) caps.push('Challenges')
  if (hasLibraryLink(agent)) caps.push('Library')
  return caps
}

function hasCapabilityFilter(agent: Agent, filter: CapabilityFilter | null) {
  if (!filter) return true
  if (filter === 'profiled') return Boolean(agent.psychologicalProfile || agent.linguisticProfile)
  if (filter === 'memory-rich') return (agent.memoryCount || 0) >= 10
  if (filter === 'relationship-ready') return (agent.relationshipCount || 0) > 0
  if (filter === 'arena-ready') return (agent.challengesCompleted || agent.challengeWins || 0) > 0
  return hasLibraryLink(agent)
}

function readinessScores(agent: Agent) {
  const capabilityCount = agentCapabilities(agent).length
  const runtime = agent.status === 'active' ? 92 : agent.status === 'training' ? 66 : 34
  const maturity = Math.min(96, 18 + capabilityCount * 9 + Math.min(20, Math.floor((agent.totalInteractions || 0) / 25)))
  const depth = Math.min(96, 22 + Math.floor(Math.sqrt(agent.memoryCount || 0) * 8))
  return [
    { label: 'Runtime Readiness', value: runtime },
    { label: 'Workspace Maturity', value: maturity },
    { label: 'Context Depth', value: depth },
  ]
}

function topTerms(agent: Agent) {
  const traitTerms = Object.entries(agent.coreTraits || {})
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([trait]) => trait.replace(/_/g, '-'))
  const goalTerms = agent.goals.slice(0, 3).map((goal) => goal.split(/\s+/).slice(0, 2).join(' ').toLowerCase())
  return [...traitTerms, ...goalTerms].slice(0, 3)
}

function profileMaturity(agent: Agent) {
  if (agent.psychologicalProfile) return 87
  if (agent.linguisticProfile) return 62
  return 0
}

function currentEmotion(agent: Agent) {
  return agent.emotionalState?.dominantEmotion || (agent.emotionalState ? 'balanced' : 'untracked')
}

function bestNextAction(agent: Agent) {
  if ((agent.memoryCount || 0) === 0) return 'Open workspace to seed first memories and inspect identity grounding.'
  if (!agent.psychologicalProfile) return 'Run profile analysis before comparing behavior across simulations.'
  if (!hasLibraryLink(agent)) return 'Open workspace to review knowledge gaps and Library candidate eligibility.'
  return 'Open workspace to inspect recent memory, profile, and Library-linked signals.'
}

function recentSignals(agent: Agent) {
  const signals = [
    { label: 'Agent record updated', time: relativeTime(agent.updatedAt), tone: 'violet' as Tone },
  ]
  if ((agent.memoryCount || 0) > 0) signals.push({ label: 'Memory state available', time: `${formatNumber(agent.memoryCount)} stored`, tone: 'blue' })
  if (agent.psychologicalProfile || agent.linguisticProfile) signals.push({ label: 'Profile evidence available', time: 'profiled', tone: 'emerald' })
  if ((agent.relationshipCount || 0) > 0) signals.push({ label: 'Relationship graph linked', time: `${formatNumber(agent.relationshipCount || 0)} edges`, tone: 'rose' })
  if (hasLibraryLink(agent)) signals.push({ label: 'Library signal linked', time: `${formatNumber(settingNumber(agent, ['librarySignals', 'librarySignalCount', 'libraryItems', 'libraryItemCount']))} signals`, tone: 'cyan' })
  return signals.slice(0, 4)
}

function MetricCard({ icon: Icon, label, value, tone }: { icon: LucideIcon; label: string; value: string; tone: Tone }) {
  const style = toneStyles[tone]
  return (
    <div className="flex h-[68px] items-center gap-4 rounded-[6px] border border-white/10 bg-[#101a27]/86 px-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
      <Icon className={cn('h-5 w-5 shrink-0', style.text)} />
      <div className="min-w-0">
        <div className="truncate text-[11px] font-medium leading-4 text-slate-400">{label}</div>
        <div className="font-mono text-[22px] font-semibold leading-6 tracking-[-0.03em] text-slate-50">{value}</div>
      </div>
    </div>
  )
}

function StatusDot({ status }: { status: Agent['status'] }) {
  return <span className={cn('h-2 w-2 rounded-full', toneStyles[statusTone(status)].dot)} />
}

function ShellButton({
  children,
  active = false,
  className,
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { active?: boolean }) {
  return (
    <button
      {...props}
      className={cn(
        'inline-flex h-9 items-center justify-center gap-2 rounded-[5px] border px-3 text-[12px] font-semibold transition-colors',
        active
          ? 'border-[#8d6cff]/70 bg-[#7b58e8] text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.12)]'
          : 'border-white/10 bg-[#111c2a]/82 text-slate-200 hover:border-[#8d6cff]/35 hover:bg-[#172438]',
        className
      )}
    >
      {children}
    </button>
  )
}

function SectionHeader({ number, title }: { number: number; title: string }) {
  return (
    <div className="flex items-center gap-2 border-t border-white/10 px-3 pt-2.5">
      <span className="flex h-[18px] w-[18px] items-center justify-center rounded-full border border-[#9f8cff]/35 bg-[#9f8cff]/16 font-mono text-[10px] text-[#c2b2ff]">{number}</span>
      <h3 className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-100">{title}</h3>
    </div>
  )
}

function PageButton({
  children,
  active = false,
  disabled = false,
  onClick,
  label,
}: {
  children: ReactNode
  active?: boolean
  disabled?: boolean
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-current={active ? 'page' : undefined}
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex h-8 min-w-8 items-center justify-center rounded-[5px] border px-2 font-mono text-[12px] transition-colors',
        active
          ? 'border-[#8d6cff]/70 bg-[#7554d8] text-white'
          : 'border-white/10 bg-[#0e1826] text-slate-300 hover:border-[#8d6cff]/40 hover:text-white',
        disabled && 'cursor-not-allowed opacity-40 hover:border-white/10 hover:text-slate-300'
      )}
    >
      {children}
    </button>
  )
}

function CapabilityChip({ label }: { label: string }) {
  const tone = capabilityTones[label] || 'slate'
  const style = toneStyles[tone]
  return (
    <span className={cn('inline-flex h-6 items-center rounded-[4px] border px-2 text-[10px] font-medium', style.border, style.bg, style.text)}>
      {label}
    </span>
  )
}

function AgentMetricCell({ label, value }: { label: string; value: number }) {
  return (
    <div className="min-w-0 border-r border-b border-white/10 px-2 py-1.5 last:border-r-0 [&:nth-child(3n)]:border-r-0 [&:nth-last-child(-n+3)]:border-b-0">
      <div className="text-[9px] font-medium uppercase tracking-[0.04em] text-slate-500">{label}</div>
      <div className="mt-0.5 font-mono text-[14px] leading-4 text-slate-100">{formatNumber(value)}</div>
    </div>
  )
}

function OperatorNav() {
  return (
    <header className="flex h-[72px] w-full items-center border-b border-white/10 bg-[#07101c]/96 px-4 lg:px-7">
      <Link href="/" className="flex w-auto items-center gap-3 lg:w-[410px]">
        <div className="flex h-10 w-10 items-center justify-center rounded-[5px] border border-white/25 bg-[#111b2a] text-slate-100">
          <PlaygroundLogo className="h-7 w-7" />
        </div>
        <div className="leading-none">
          <div className="text-[17px] font-bold tracking-[-0.02em] text-white">Agent Playground</div>
          <div className="mt-1 text-[13px] text-slate-300">Inspectable Agent OS</div>
        </div>
      </Link>

      <nav className="hidden flex-1 items-center justify-center gap-12 lg:flex">
        {navItems.map((item) => {
          const active = item.href === '/agents'
          return (
            <Link
              key={item.label}
              href={item.href}
              className={cn(
                'relative flex h-[72px] items-center text-[15px] font-medium',
                active ? 'text-slate-50' : 'text-slate-300 hover:text-white'
              )}
            >
              {item.label}
              {active && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-[#8e65ff]" />}
            </Link>
          )
        })}
      </nav>

      <div className="hidden w-[520px] items-center justify-end gap-4 lg:flex">
        <div className="flex h-10 items-center gap-2 rounded-[6px] border border-white/12 bg-[#101a27] px-4 text-[13px] text-slate-200">
          <span className="h-2 w-2 rounded-full bg-[#62e694]" />
          Local + Cloud Runtime
        </div>
        <button className="flex h-9 w-9 items-center justify-center rounded-[5px] text-slate-200 hover:bg-white/5" aria-label="Dark mode">
          <Moon className="h-5 w-5" />
        </button>
        <Link href="https://github.com" className="flex h-9 w-9 items-center justify-center rounded-[5px] text-slate-200 hover:bg-white/5" aria-label="GitHub">
          <Github className="h-5 w-5" />
        </Link>
        <div className="h-8 w-px bg-white/12" />
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-full bg-[#7657d9] font-mono text-[13px] font-bold text-white">OP</div>
          <div className="hidden leading-tight xl:block">
            <div className="text-[13px] font-bold text-white">Operator</div>
            <div className="text-[11px] text-slate-400">operator@local</div>
          </div>
          <ChevronDown className="h-4 w-4 text-slate-300" />
        </div>
      </div>
      <button className="ml-auto flex h-10 w-10 items-center justify-center rounded-[5px] border border-white/10 bg-[#101a27] text-slate-200 lg:hidden" aria-label="Open menu">
        <Menu className="h-5 w-5" />
      </button>
    </header>
  )
}

function AgentCard({
  agent,
  selected,
  onSelect,
  onOpen,
}: {
  agent: Agent
  selected: boolean
  onSelect: () => void
  onOpen: () => void
}) {
  const tone = agentTone(agent)
  const style = toneStyles[tone]
  const statusStyle = toneStyles[statusTone(agent.status)]
  const caps = agentCapabilities(agent)
  const metrics = [
    ['Msgs', agent.stats?.totalMessages || agent.totalInteractions || 0],
    ['Mems', agent.memoryCount || 0],
    ['Rels', agent.relationshipCount || 0],
    ['Create', agent.creativeWorks || agent.stats?.creativeWorksCreated || 0],
    ['Journal', agent.journalCount || agent.stats?.journalEntries || 0],
    ['Wins', agent.challengeWins || 0],
  ]

  return (
    <article
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(event) => {
        if (event.key === 'Enter' || event.key === ' ') onOpen()
      }}
      className={cn(
        'group grid h-auto min-h-[210px] cursor-pointer grid-cols-[24px_minmax(0,1fr)] gap-3 overflow-hidden rounded-[7px] border bg-[#0e1826]/93 p-3 text-left shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] transition-colors lg:h-[210px] lg:grid-cols-[24px_1fr_136px_190px_52px]',
        selected ? 'border-[#8d6cff] bg-[#111b2b]' : 'border-white/12 hover:border-[#8d6cff]/45'
      )}
    >
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onSelect()
        }}
        className={cn(
          'mt-1 flex h-[18px] w-[18px] items-center justify-center rounded-[4px] border text-white',
          selected ? 'border-[#9d81ff] bg-[#805cff]' : 'border-white/20 bg-[#0a1320]'
        )}
        aria-label={`Select ${agent.name}`}
      >
        {selected && <Check className="h-3.5 w-3.5" />}
      </button>

      <div className="min-w-0">
        <div className="flex items-start gap-3">
          <div className={cn('flex h-[50px] w-[50px] shrink-0 items-center justify-center rounded-full border', style.border, style.bg, style.text)}>
            <PlaygroundLogo className="h-8 w-8" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="truncate text-[17px] font-bold leading-5 tracking-[-0.02em] text-slate-50">{agent.name}</h2>
              <span className={cn('inline-flex items-center gap-1 text-[12px]', statusStyle.text)}>
                <StatusDot status={agent.status} />
                {agent.status[0].toUpperCase() + agent.status.slice(1)}
              </span>
            </div>
            <div className="mt-1 font-mono text-[12px] text-slate-400">{compactId(agent.id)}</div>
            <p className="mt-2 line-clamp-2 max-w-[390px] text-[13px] leading-5 text-slate-300">{agent.persona || 'No persona summary recorded.'}</p>
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-1.5">
          {topTerms(agent).map((term) => (
            <span key={term} className="font-mono text-[11px] text-[#9fc8ff]">{term}</span>
          ))}
        </div>

        <div className="mt-3 flex flex-nowrap gap-1.5 overflow-hidden">
          {caps.slice(0, 3).map((cap) => <CapabilityChip key={cap} label={cap} />)}
          {caps.length === 0 && <span className="text-[11px] text-slate-500">No enhancement signals recorded</span>}
        </div>
      </div>

      <div className="hidden pt-1 font-mono text-[12px] text-slate-300 lg:block">
        <div>{settingString(agent, ['provider', 'llmProvider', 'modelProvider'], 'provider n/a')}</div>
        <div className="mt-0.5 break-all text-slate-200">{settingString(agent, ['model', 'llmModel', 'runtimeModel'], 'model n/a')}</div>
        <div className="mt-4 text-slate-300">{relativeTime(agent.updatedAt)}</div>
        <div className="text-slate-500">Last active</div>
      </div>

      <div className="col-start-2 flex flex-col justify-end lg:col-start-auto">
        <div className="grid grid-cols-3 overflow-hidden rounded-[5px] border border-white/10">
          {metrics.map(([label, value]) => (
            <AgentMetricCell key={label} label={label as string} value={value as number} />
          ))}
        </div>
        <div className="mt-2 rounded-[5px] border border-white/10 px-2.5 py-1.5">
          {readinessScores(agent).map((score) => (
            <div key={score.label} className="grid grid-cols-[104px_1fr] items-center gap-2 py-0.5">
              <span className="text-[10px] text-slate-300">{score.label}</span>
              <span className="h-1.5 overflow-hidden rounded-full bg-white/12">
                <span className={cn('block h-full rounded-full', style.bar)} style={{ width: `${score.value}%` }} />
              </span>
            </div>
          ))}
        </div>
      </div>

      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation()
          onOpen()
        }}
        className="hidden self-end rounded-[6px] border border-white/12 bg-[#111d2c] p-3 text-slate-200 transition-colors hover:border-[#8d6cff]/50 hover:text-white lg:block"
        aria-label={`Open ${agent.name}`}
      >
        <ArrowRight className="h-5 w-5" />
      </button>
    </article>
  )
}

function Inspector({ agent, onOpen }: { agent: Agent | null; onOpen: () => void }) {
  if (!agent) {
    return (
      <aside className="min-h-0 rounded-[7px] border border-white/12 bg-[#0e1826]/95 p-5 text-sm text-slate-400">
        Select an agent from the roster to inspect runtime state.
      </aside>
    )
  }

  const tone = agentTone(agent)
  const style = toneStyles[tone]
  const statusStyle = toneStyles[statusTone(agent.status)]
  const coverage = [
    ['Identity', Boolean(agent.name && agent.persona)],
    ['Chat', (agent.stats?.totalMessages || agent.totalInteractions || 0) > 0],
    ['Memory', (agent.memoryCount || 0) > 0],
    ['Emotion', Boolean(agent.emotionalProfile || agent.emotionalState)],
    ['Profile', Boolean(agent.psychologicalProfile || agent.linguisticProfile)],
    ['Learning', (agent.totalInteractions || 0) > 0 || agent.goals.length > 0],
    ['Timeline', Boolean(agent.updatedAt)],
    ['Relationships', (agent.relationshipCount || 0) > 0],
    ['Library', hasLibraryLink(agent)],
  ]
  const runtimeState = [
    ['Memory Count', formatNumber(agent.memoryCount || 0)],
    ['Current Emotion', currentEmotion(agent)],
    ['Profile Maturity', `${profileMaturity(agent)}%`],
    ['Learning Active', (agent.totalInteractions || agent.goals.length) ? 'Yes' : 'No'],
  ]

  return (
    <aside className="min-h-0 overflow-hidden rounded-[7px] border border-white/14 bg-[#0d1724]/96 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)] xl:flex xl:h-full xl:flex-col">
      <div className="flex h-10 shrink-0 items-center justify-between border-b border-white/10 px-3">
        <div className="text-[12px] font-bold uppercase tracking-[0.08em] text-slate-100">Selected Agent</div>
        <Pin className="h-4 w-4 text-slate-400" />
      </div>

      <div data-agent-inspector-scroll className="min-h-0 xl:overflow-y-auto">
        <div className="p-3.5">
          <div className="flex items-start gap-4">
            <div className={cn('flex h-[52px] w-[52px] shrink-0 items-center justify-center rounded-[8px] border', style.border, style.bg, style.text)}>
              <PlaygroundLogo className="h-9 w-9" />
            </div>
            <div className="min-w-0 flex-1">
              <div className="truncate text-[19px] font-bold tracking-[-0.03em] text-white">{agent.name}</div>
              <div className={cn('mt-1 inline-flex items-center gap-2 text-[12px]', statusStyle.text)}>
                <StatusDot status={agent.status} />
                Deployed / {agent.status[0].toUpperCase() + agent.status.slice(1)}
              </div>
              <div className="mt-2 font-mono text-[12px] text-slate-400">ID: {compactId(agent.id)}</div>
            </div>
          </div>

          <div className="mt-3 grid gap-1 text-[12px]">
            {[
              ['Current Model', settingString(agent, ['model', 'llmModel', 'runtimeModel'], 'not recorded')],
              ['Persistence', 'PostgreSQL'],
              ['Last Active', relativeTime(agent.updatedAt)],
              ['Workspace Health', agent.status === 'inactive' ? 'Paused' : 'Healthy'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[120px_1fr] gap-3">
                <span className="text-slate-400">{label}</span>
                <span className={cn('font-mono text-slate-100', label === 'Workspace Health' && 'w-fit rounded-[4px] bg-[#52d987]/15 px-2 py-0.5 text-[#7be7a0]')}>{value}</span>
              </div>
            ))}
          </div>
        </div>

        <SectionHeader number={1} title="Agent Info" />
        <div className="space-y-3 px-3 py-2.5">
          <div>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Persona</div>
            <p className="text-[12px] leading-5 text-slate-200">{agent.persona || 'No persona summary recorded.'}</p>
          </div>
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-slate-500">Goals</div>
            {agent.goals.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {agent.goals.map((goal) => (
                  <span key={goal} className="rounded-[4px] border border-[#8d6cff]/25 bg-[#8d6cff]/10 px-2 py-1 text-[11px] leading-4 text-[#d1c6ff]">
                    {goal}
                  </span>
                ))}
              </div>
            ) : (
              <div className="rounded-[4px] border border-white/10 bg-white/[0.025] px-2 py-1.5 text-[11px] text-slate-500">No goals recorded.</div>
            )}
          </div>
        </div>

        <SectionHeader number={2} title="Runtime State" />
        <div className="mt-2 grid grid-cols-4 border-y border-white/10">
          {runtimeState.map(([label, value]) => (
            <div key={label} className="border-r border-white/10 px-3 py-1.5 last:border-r-0">
              <div className="text-[10px] text-slate-400">{label}</div>
              <div className="mt-1 truncate font-mono text-[15px] font-semibold text-slate-50">{value}</div>
            </div>
          ))}
        </div>

        <SectionHeader number={3} title="Architecture Coverage" />
        <div className="grid grid-cols-2 gap-1.5 px-3 py-2.5">
          {coverage.map(([label, present]) => (
            <div key={label as string} className="flex h-6 items-center justify-between rounded-[4px] border border-white/10 bg-white/[0.025] px-2 text-[12px] text-slate-200">
              <span>{label}</span>
              <Check className={cn('h-4 w-4', present ? 'text-[#7be7a0]' : 'text-slate-600')} />
            </div>
          ))}
        </div>

        <SectionHeader number={4} title="Best Next Action" />
        <div className="flex items-center gap-3 px-3 py-2.5">
          <p className="flex-1 text-[13px] leading-5 text-slate-200">{bestNextAction(agent)}</p>
          <button onClick={onOpen} className="rounded-[5px] border border-white/12 bg-[#111d2c] p-3 text-slate-100 hover:border-[#8d6cff]/45" aria-label="Open selected agent">
            <ArrowRight className="h-5 w-5" />
          </button>
        </div>

        <SectionHeader number={5} title="Recent Signals" />
        <div className="space-y-1.5 px-3 py-2.5">
          {recentSignals(agent).map((signal) => (
            <div key={signal.label} className="flex items-center gap-2 text-[12px]">
              <span className={cn('h-4 w-4 rounded-[4px]', toneStyles[signal.tone].bg, toneStyles[signal.tone].border, 'border')} />
              <span className="flex-1 text-slate-200">{signal.label}</span>
              <span className="font-mono text-[11px] text-slate-400">{signal.time}</span>
            </div>
          ))}
        </div>

        <SectionHeader number={6} title="Quick Actions" />
        <div className="grid grid-cols-4 gap-2 px-3 py-2.5">
          <button onClick={onOpen} className="h-10 rounded-[5px] border border-[#8d6cff]/55 bg-[#7554d8] px-2 text-[10px] font-semibold leading-tight text-white">Open Workspace</button>
          <Link href="/simulation" className="flex h-10 items-center justify-center rounded-[5px] border border-white/10 bg-[#111d2c] px-2 text-center text-[10px] font-semibold leading-tight text-slate-200">Run Scenario</Link>
          <Link href="/simulation" className="flex h-10 items-center justify-center rounded-[5px] border border-white/10 bg-[#111d2c] px-2 text-center text-[10px] font-semibold leading-tight text-slate-200">Send to Arena</Link>
          <Link href={`/agents/${agent.id}?tab=knowledge-library`} className="flex h-10 items-center justify-center rounded-[5px] border border-white/10 bg-[#111d2c] px-2 text-center text-[10px] font-semibold leading-tight text-slate-200">Review Library</Link>
        </div>
      </div>
    </aside>
  )
}

export default function AgentsPage() {
  const router = useRouter()
  const { setTheme } = useTheme()
  const { agents, loading, fetchAgents } = useAgentStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [capabilityFilter, setCapabilityFilter] = useState<CapabilityFilter | null>(null)
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    setTheme('dark')
  }, [setTheme])

  useEffect(() => {
    void fetchAgents()
  }, [fetchAgents])

  const sortedAgents = useMemo(
    () => [...agents].sort((a, b) => Date.parse(b.updatedAt) - Date.parse(a.updatedAt)),
    [agents]
  )

  const normalizedSearch = deferredSearch.trim().toLowerCase()
  const filteredAgents = sortedAgents.filter((agent) => {
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
    const matchesCapability = hasCapabilityFilter(agent, capabilityFilter)
    const matchesSearch =
      normalizedSearch.length === 0 ||
      agent.name.toLowerCase().includes(normalizedSearch) ||
      agent.persona.toLowerCase().includes(normalizedSearch) ||
      agent.goals.some((goal) => goal.toLowerCase().includes(normalizedSearch))

    return matchesStatus && matchesCapability && matchesSearch
  })

  const pageCount = Math.max(1, Math.ceil(filteredAgents.length / AGENTS_PER_PAGE))
  const currentPage = Math.min(page, pageCount)
  const pageStart = (currentPage - 1) * AGENTS_PER_PAGE
  const pageAgents = filteredAgents.slice(pageStart, pageStart + AGENTS_PER_PAGE)
  const visibleStart = filteredAgents.length === 0 ? 0 : pageStart + 1
  const visibleEnd = Math.min(pageStart + AGENTS_PER_PAGE, filteredAgents.length)

  const selectedAgent = useMemo(() => {
    const selectedOnPage = pageAgents.find((agent) => agent.id === selectedId)
    return selectedOnPage || pageAgents[0] || filteredAgents[0] || sortedAgents[0] || null
  }, [filteredAgents, pageAgents, selectedId, sortedAgents])

  useEffect(() => {
    if (!selectedId && selectedAgent) setSelectedId(selectedAgent.id)
  }, [selectedAgent, selectedId])

  useEffect(() => {
    setPage(1)
  }, [normalizedSearch, statusFilter, capabilityFilter])

  useEffect(() => {
    if (page > pageCount) setPage(pageCount)
  }, [page, pageCount])

  useEffect(() => {
    if (selectedAgent && selectedAgent.id !== selectedId) {
      setSelectedId(selectedAgent.id)
    }
  }, [selectedAgent, selectedId])

  const statusCounts = {
    active: agents.filter((agent) => agent.status === 'active').length,
    training: agents.filter((agent) => agent.status === 'training').length,
    inactive: agents.filter((agent) => agent.status === 'inactive').length,
  }
  const totalMemories = agents.reduce((sum, agent) => sum + (agent.memoryCount || 0), 0)
  const relationshipEdges = agents.reduce((sum, agent) => sum + (agent.relationshipCount || 0), 0)
  const profiledAgents = agents.filter((agent) => agent.psychologicalProfile || agent.linguisticProfile).length
  const arenaReady = agents.filter((agent) => (agent.challengesCompleted || agent.challengeWins || 0) > 0).length
  const librarySignals = agents.reduce((sum, agent) => sum + settingNumber(agent, ['librarySignals', 'librarySignalCount', 'libraryItems', 'libraryItemCount']), 0)

  const metrics = [
    { label: 'Total Agents', value: formatNumber(agents.length), icon: Bot, tone: 'slate' as Tone },
    { label: 'Active', value: formatNumber(statusCounts.active), icon: CircleDot, tone: 'emerald' as Tone },
    { label: 'Training', value: formatNumber(statusCounts.training), icon: Zap, tone: 'amber' as Tone },
    { label: 'Stored Memories', value: formatNumber(totalMemories), icon: Database, tone: 'blue' as Tone },
    { label: 'Relationship Edges', value: formatNumber(relationshipEdges), icon: Network, tone: 'cyan' as Tone },
    { label: 'Profiled Agents', value: formatNumber(profiledAgents), icon: UserRound, tone: 'slate' as Tone },
    { label: 'Arena Ready', value: formatNumber(arenaReady), icon: Swords, tone: 'rose' as Tone },
    { label: 'Library Signals', value: formatNumber(librarySignals), icon: BookOpen, tone: 'slate' as Tone },
  ]

  const openAgent = (agent: Agent) => router.push(`/agents/${agent.id}`)

  return (
    <div className="min-h-screen bg-[#07101c] text-slate-100 lg:h-screen lg:overflow-hidden">
      <OperatorNav />
      <main className="mx-auto flex w-full max-w-[1920px] flex-col px-6 pb-16 pt-6 lg:h-[calc(100vh-72px)] lg:overflow-hidden">
        <section className="shrink-0 flex items-start justify-between gap-6">
          <div>
            <div className="text-[13px] font-bold uppercase tracking-[0.08em] text-[#b79cff]">Agent Roster</div>
            <h1 className="mt-2 text-[34px] font-semibold leading-9 tracking-[-0.045em] text-white">Explore the full agent fleet.</h1>
            <p className="mt-2 text-[15px] text-slate-300">Search personalities, compare runtime state, inspect memory depth, and open any agent workspace.</p>
          </div>
          <div className="mt-2 flex flex-wrap items-center gap-3">
            <ShellButton active onClick={() => router.push('/agents/new')} className="h-12 px-6 text-[14px]">
              <Plus className="h-5 w-5" />
              Create Agent
            </ShellButton>
            <ShellButton onClick={() => router.push('/simulation')} className="h-12 px-6 text-[14px]">
              <Swords className="h-5 w-5" />
              Open Arena
            </ShellButton>
          </div>
        </section>

        <section className="mt-6 grid min-h-0 flex-1 grid-cols-1 gap-5 xl:grid-cols-[minmax(0,1fr)_440px]">
          <div className="flex min-h-0 min-w-0 flex-col">
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4 2xl:grid-cols-8">
              {metrics.map((metric) => <MetricCard key={metric.label} {...metric} />)}
            </div>

            <div className="mt-7 flex shrink-0 flex-wrap items-end gap-4 rounded-[7px]">
              <label className="relative block w-full shrink-0 sm:w-[420px]">
                <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  className="h-[50px] w-full rounded-[6px] border border-white/12 bg-[#0e1826] px-12 pr-16 text-[13px] text-slate-100 outline-none transition-colors placeholder:text-slate-500 focus:border-[#8d6cff]/60"
                  placeholder="Search by name, persona, goal, memory, or capability"
                  type="text"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 rounded-[4px] border border-white/10 bg-white/[0.035] px-2 py-1 font-mono text-[11px] text-slate-400">⌘K</span>
              </label>

              <div>
                <div className="mb-2 text-[11px] text-slate-400">Status</div>
                <div className="flex overflow-hidden rounded-[5px] border border-white/10">
                  {statusFilters.map((filter) => (
                    <button
                      key={filter}
                      onClick={() => setStatusFilter(filter)}
                      className={cn(
                        'h-9 border-r border-white/10 px-3 text-[12px] font-semibold capitalize last:border-r-0',
                        statusFilter === filter ? 'bg-[#7052d8] text-white' : 'bg-[#0e1826] text-slate-200 hover:bg-[#162235]'
                      )}
                    >
                      {filter}
                    </button>
                  ))}
                </div>
              </div>

              <div className="min-w-0 flex-1">
                <div className="mb-2 text-[11px] text-slate-400">Capabilities</div>
                <div className="flex flex-wrap gap-1.5 2xl:flex-nowrap">
                  {capabilityFilters.map(({ id, label, icon: Icon }) => (
                    <button
                      key={id}
                      onClick={() => setCapabilityFilter((current) => current === id ? null : id)}
                      className={cn(
                        'inline-flex h-9 max-w-[96px] items-center gap-1 rounded-[5px] border px-1.5 text-[10px] font-semibold leading-tight sm:max-w-none sm:px-2 sm:text-[11px] 2xl:whitespace-nowrap',
                        capabilityFilter === id
                          ? 'border-[#8d6cff]/60 bg-[#7052d8] text-white'
                          : 'border-white/10 bg-[#0e1826] text-slate-200 hover:border-white/20'
                      )}
                    >
                      <Icon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </button>
                  ))}
                </div>
              </div>

              <div className="w-full shrink-0 sm:w-[150px]">
                <div className="mb-2 text-[11px] text-slate-400">Sort by</div>
                <button className="flex h-9 w-full items-center justify-between rounded-[5px] border border-white/10 bg-[#0e1826] px-3 text-[12px] text-slate-200">
                  Recently active
                  <ChevronDown className="h-4 w-4 text-slate-500" />
                </button>
              </div>
            </div>

            <div className="mt-5 flex min-h-0 flex-1 flex-col rounded-[7px] border border-white/10 bg-[#07101c]/30">
              <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-3 py-2">
                <div>
                  <div className="text-[11px] font-bold uppercase tracking-[0.08em] text-slate-300">Roster Window</div>
                  <div className="mt-0.5 font-mono text-[11px] text-slate-500">
                    Showing {visibleStart}-{visibleEnd} of {filteredAgents.length}
                  </div>
                </div>
                <div data-agent-pagination className="flex items-center gap-1.5">
                  <PageButton label="Previous agent page" disabled={currentPage === 1} onClick={() => setPage((current) => Math.max(1, current - 1))}>
                    <ArrowLeft className="h-4 w-4" />
                  </PageButton>
                  {Array.from({ length: pageCount }).map((_, index) => {
                    const pageNumber = index + 1
                    return (
                      <PageButton
                        key={pageNumber}
                        label={`Go to agent page ${pageNumber}`}
                        active={currentPage === pageNumber}
                        onClick={() => setPage(pageNumber)}
                      >
                        {pageNumber}
                      </PageButton>
                    )
                  })}
                  <PageButton label="Next agent page" disabled={currentPage === pageCount} onClick={() => setPage((current) => Math.min(pageCount, current + 1))}>
                    <ArrowRight className="h-4 w-4" />
                  </PageButton>
                </div>
              </div>
              <div data-agent-roster-scroll className="min-h-0 flex-1 overflow-y-auto p-2 pr-1">
            {loading ? (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {Array.from({ length: 6 }).map((_, index) => (
                  <div key={index} className="h-[138px] animate-pulse rounded-[7px] border border-white/10 bg-[#0e1826]" />
                ))}
              </div>
            ) : filteredAgents.length > 0 ? (
              <div className="grid grid-cols-1 gap-2 lg:grid-cols-2">
                {pageAgents.map((agent) => (
                  <AgentCard
                    key={agent.id}
                    agent={agent}
                    selected={selectedAgent?.id === agent.id}
                    onSelect={() => setSelectedId(agent.id)}
                    onOpen={() => openAgent(agent)}
                  />
                ))}
              </div>
            ) : (
              <div className="flex min-h-[280px] flex-col items-center justify-center rounded-[7px] border border-white/12 bg-[#0e1826]/95 p-8 text-center">
                <Search className="h-8 w-8 text-[#b79cff]" />
                <h2 className="mt-4 text-xl font-semibold text-white">No matching agents found</h2>
                <p className="mt-2 max-w-md text-sm text-slate-400">The current search and filter set did not match any fetched agent records.</p>
                <ShellButton className="mt-5" onClick={() => { setSearch(''); setStatusFilter('all'); setCapabilityFilter(null); }}>
                  Clear Filters
                </ShellButton>
              </div>
            )}
              </div>
          </div>
          </div>

          <Inspector agent={selectedAgent} onOpen={() => selectedAgent && openAgent(selectedAgent)} />
        </section>

        <footer className="z-50 mt-4 flex min-h-[38px] flex-wrap items-center justify-between gap-3 border-t border-white/10 bg-[#07101c]/96 px-6 py-1.5 text-[12px] text-slate-300 backdrop-blur-xl md:fixed md:bottom-0 md:left-0 md:right-0 md:mt-0">
          <div className="flex flex-wrap items-center gap-3">
            <StatusBadge icon={<span className="h-2 w-2 rounded-full bg-[#62e694]" />}>API: <span className="font-mono text-slate-100">GET /api/agents</span></StatusBadge>
            <StatusBadge>Persistence: <span className="font-semibold text-slate-100">PostgreSQL canonical</span></StatusBadge>
            <StatusBadge>Legacy: Firestore compatibility</StatusBadge>
            <StatusBadge>Sort: recently_active</StatusBadge>
            <StatusBadge>Visible: <span className="font-mono text-slate-100">{visibleStart}-{visibleEnd} / {filteredAgents.length}</span></StatusBadge>
            <StatusBadge icon={<Check className="h-3.5 w-3.5 text-[#7be7a0]" />}>Quality: roster data normalized</StatusBadge>
          </div>
          <div className="flex items-center gap-3">
            <StatusBadge icon={<span className="h-2 w-2 rounded-full bg-[#62e694]" />}>Runtime: <span className="font-mono text-[#7be7a0]">healthy</span></StatusBadge>
            <StatusBadge>v1.4.2</StatusBadge>
            <button className="flex h-8 w-9 items-center justify-center rounded-[5px] border border-white/10 bg-[#0e1826] text-slate-300" aria-label="More status options">
              <Menu className="h-4 w-4" />
            </button>
          </div>
        </footer>
      </main>
    </div>
  )
}

function StatusBadge({ children, icon }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <span className="inline-flex h-8 items-center gap-2 rounded-[5px] border border-white/10 bg-[#0e1826] px-3">
      {icon}
      {children}
    </span>
  )
}
