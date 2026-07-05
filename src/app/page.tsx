'use client'

import { useEffect, useState, type ReactNode } from 'react'
import Link from 'next/link'
import { useTheme } from 'next-themes'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  BarChart3,
  BookOpen,
  Bot,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleHelp,
  Clock3,
  Cloud,
  Code2,
  Database,
  FileCheck2,
  FileText,
  FlaskConical,
  GitBranch,
  Github,
  Heart,
  Hexagon,
  History,
  Layers,
  LockKeyhole,
  MessageSquare,
  Moon,
  Network,
  Play,
  Route,
  Search,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  SquareTerminal,
  Sun,
  Table2,
  Trophy,
  UserRound,
  Users,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'

type Tone = 'violet' | 'cyan' | 'emerald' | 'amber' | 'rose' | 'blue' | 'slate'

const toneClass: Record<
  Tone,
  {
    text: string
    border: string
    bg: string
    soft: string
    ring: string
  }
> = {
  violet: {
    text: 'text-[#b8a1ff]',
    border: 'border-[#9b7cf6]/35',
    bg: 'bg-[#9b7cf6]/12',
    soft: 'bg-[#9b7cf6]/6',
    ring: 'ring-[#9b7cf6]/25',
  },
  cyan: {
    text: 'text-[#69e4f2]',
    border: 'border-[#39d7e6]/35',
    bg: 'bg-[#39d7e6]/12',
    soft: 'bg-[#39d7e6]/6',
    ring: 'ring-[#39d7e6]/25',
  },
  emerald: {
    text: 'text-[#73e8a5]',
    border: 'border-[#49d581]/35',
    bg: 'bg-[#49d581]/12',
    soft: 'bg-[#49d581]/6',
    ring: 'ring-[#49d581]/25',
  },
  amber: {
    text: 'text-[#ffc05f]',
    border: 'border-[#f6a72a]/35',
    bg: 'bg-[#f6a72a]/12',
    soft: 'bg-[#f6a72a]/6',
    ring: 'ring-[#f6a72a]/25',
  },
  rose: {
    text: 'text-[#ff8fa6]',
    border: 'border-[#f66f91]/35',
    bg: 'bg-[#f66f91]/12',
    soft: 'bg-[#f66f91]/6',
    ring: 'ring-[#f66f91]/25',
  },
  blue: {
    text: 'text-[#8db7ff]',
    border: 'border-[#6aa0ff]/35',
    bg: 'bg-[#6aa0ff]/12',
    soft: 'bg-[#6aa0ff]/6',
    ring: 'ring-[#6aa0ff]/25',
  },
  slate: {
    text: 'text-slate-300',
    border: 'border-white/12',
    bg: 'bg-white/[0.045]',
    soft: 'bg-white/[0.025]',
    ring: 'ring-white/10',
  },
}

const cockpitTabs = [
  'Agent Core',
  'Execution Labs',
  'Knowledge Plane',
  'Network Intelligence',
  'Runtime',
] as const

type CockpitTab = (typeof cockpitTabs)[number]

const heroBadges = [
  { label: 'PostgreSQL Canonical', icon: Database, tone: 'blue' },
  { label: 'Drizzle ORM', icon: Zap, tone: 'emerald' },
  { label: 'Ollama / Gemini / Groq', icon: Hexagon, tone: 'violet' },
  { label: 'Quality Gates', icon: ShieldCheck, tone: 'amber' },
  { label: 'Library Governance', icon: BookOpen, tone: 'rose' },
  { label: 'Timeline Audit', icon: Clock3, tone: 'cyan' },
] satisfies Array<{ label: string; icon: LucideIcon; tone: Tone }>

const corePipeline = [
  { title: 'User message stored', id: 'EVT-98121', latency: '38 ms', score: '1.00', icon: MessageSquare, tone: 'violet' },
  { title: 'Emotion appraisal', id: 'EMO-55321', latency: '72 ms', score: '0.92', icon: Heart, tone: 'rose' },
  { title: 'Model response', id: 'MOD-77211', latency: '1.28 s', score: '0.95', icon: Brain, tone: 'blue' },
  { title: 'Output quality gate', id: 'QLT-33109', latency: '106 ms', score: '0.97', icon: ShieldCheck, tone: 'amber' },
  { title: 'Assistant message stored', id: 'EVT-98122', latency: '41 ms', score: '1.00', icon: MessageSquare, tone: 'cyan' },
  { title: 'Semantic memory extracted', id: 'MEM-442', latency: '142 ms', score: '0.94', icon: GitBranch, tone: 'emerald' },
  { title: 'Learning observation', id: 'LRN-221', latency: '89 ms', score: '0.93', icon: BarChart3, tone: 'emerald' },
  { title: 'Personality/profile evidence', id: 'PRF-119', latency: '77 ms', score: '0.91', icon: UserRound, tone: 'rose' },
] satisfies Array<{
  title: string
  id: string
  latency: string
  score: string
  icon: LucideIcon
  tone: Tone
}>

const provenance = [
  ['Persona guardrail matched', 'GRD-771', 'Safe & Accurate', '0.98', '12 ms', 'SRC-21', Brain, 'violet'],
  ['Goal priority applied', 'GOAL-3', 'Synthesize', '0.96', '8 ms', 'SRC-33', Heart, 'rose'],
  ['Memory MEM-442 used', 'FACT', 'Topical Relevance', '0.94', '28 ms', 'SRC-812', Database, 'amber'],
  ['Emotion state checked', 'EMO-55321', 'Calm-Positive', '0.92', '6 ms', 'SRC-91', Heart, 'rose'],
  ['Profile cue applied', 'PRF-119', 'Prefers Structure', '0.93', '11 ms', 'SRC-66', UserRound, 'violet'],
  ['Quality rule passed', 'QLT-33109', 'Factual & Safe', '0.97', '19 ms', 'SRC-105', ShieldCheck, 'emerald'],
  ['Final response selected', 'MOD-77211', 'gpt-4.1-turbo', '0.95', '23 ms', 'SRC-000', Brain, 'blue'],
] satisfies Array<[string, string, string, string, string, string, LucideIcon, Tone]>

const executionLabs = [
  {
    title: 'Scenarios',
    subtitle: 'Branch, intervene, compare outcomes',
    status: 'Active',
    tone: 'violet',
    icon: GitBranch,
    flow: ['Branch Context', 'Probe Set', 'Baseline State', 'Alternate State', 'Comparison'],
    rows: [
      ['Branch Point', 'BP-452: memory_conflict_resolution'],
      ['Intervention Editor', 'Adjust guardrail strictness'],
      ['Delta Quality', '+8.7%'],
      ['Delta Confidence', '+0.12'],
    ],
    footer: ['qualityStatus passed', 'sourceRefs 8', 'failureReason none'],
  },
  {
    title: 'Creative Studio',
    subtitle: 'Create, iterate and publish artifacts',
    status: 'Generated',
    tone: 'rose',
    icon: Sparkles,
    flow: ['Session State', 'Prompt Brief', 'Generated Artifact', 'Draft Boundary', 'Publish Boundary'],
    rows: [
      ['Session State', 'CS-8812 generated'],
      ['Prompt Brief', 'Sustainable mobility startup'],
      ['Artifact Excerpt', 'Cleaner streets, connected communities.'],
      ['Tokens', '812'],
    ],
    footer: ['draft', 'generated', 'reviewed', 'published'],
  },
  {
    title: 'Journal',
    subtitle: 'Reflect, repair and store with integrity',
    status: 'Saved',
    tone: 'cyan',
    icon: BookOpen,
    flow: ['Grounded Reflection', 'Context Packet', 'Length Repair', 'Save Boundary', 'Quality Flags'],
    rows: [
      ['Session Pipeline', 'JRNL-5521 saved'],
      ['Reflection', 'Recurring memory conflict pattern.'],
      ['Repair Note', 'journal_content_too_short repaired'],
      ['Length Final', '180 tokens'],
    ],
    footer: ['qualityStatus passed', 'sourceRefs 6', 'saved true'],
  },
  {
    title: 'Dreams',
    subtitle: 'Explore latent narratives and insights',
    status: 'Active',
    tone: 'cyan',
    icon: Cloud,
    flow: ['Dream Session', 'Motifs', 'Residue', 'Emotional Context', 'Save Boundary'],
    rows: [
      ['Dream Session', 'DRM-2210 active'],
      ['Motifs', 'Lost library, ocean station, timekeeper'],
      ['Dominant', 'melancholic 0.64'],
      ['Impression', 'Reversible books and memory traces.'],
    ],
    footer: ['qualityStatus passed', 'sourceRefs 5', 'residueCaptured true'],
  },
  {
    title: 'Challenge Lab',
    subtitle: 'Run templates. Score. Learn.',
    status: 'Completed',
    tone: 'amber',
    icon: Trophy,
    flow: ['Template', 'Participants', 'Event Feed', 'Stage Status', 'Scorecards', 'Winner'],
    rows: [
      ['Template', 'Memory Precision'],
      ['Participants', '6 agents'],
      ['Event Feed', 'EVT-881 claim submitted'],
      ['Scoreboard', 'AGT-301 92.4'],
    ],
    footer: ['sourceRefs 9', 'stage finalized', 'winner AGT-301'],
  },
  {
    title: 'Arena',
    subtitle: 'Structured debate. Evidence-first.',
    status: 'Completed',
    tone: 'blue',
    icon: Users,
    flow: ['Draft Run', 'Seats', 'Head Directive', 'Debater Turns', 'Score Updates', 'Final Report'],
    rows: [
      ['Draft Run', 'ARNA-7719 completed'],
      ['Head Directive', 'Should autonomous agents negotiate?'],
      ['Evidence Required', 'true'],
      ['Winner', 'AGT-301'],
    ],
    footer: ['seats 3/3', 'turns 12', 'scoreMargin 11.2'],
  },
] satisfies Array<{
  title: string
  subtitle: string
  status: string
  tone: Tone
  icon: LucideIcon
  flow: string[]
  rows: string[][]
  footer: string[]
}>

const knowledgeItems = [
  ['LIB-9442', 'Memory decay is non-linear over time', 'Review', '2h ago', 'violet'],
  ['LIB-9431', 'Emotional valence influences recall precision', 'Validated', '1d ago', 'emerald'],
  ['LIB-9420', 'Trust grows with consistency and transparency', 'Validated', '2d ago', 'emerald'],
  ['LIB-9415', 'High conflict reduces collaboration bandwidth', 'Disputed', '3d ago', 'amber'],
  ['LIB-9401', 'Dream motifs reflect unresolved residue', 'Validated', '4d ago', 'emerald'],
  ['LIB-9388', 'Creative output improves with constraint framing', 'Retired', '6d ago', 'rose'],
  ['LIB-9377', 'Mentorship depends on alignment', 'Validated', '7d ago', 'emerald'],
] satisfies Array<[string, string, string, string, Tone]>

const knowledgePipeline = [
  ['Feature Output', 'FEAT-3310', 'emitted', '18 ms', 'violet'],
  ['Review Candidate', 'RC-4412', 'review', '42 ms', 'violet'],
  ['Source-Backed Validation', 'VAL-2281', 'validating', '86 ms', 'blue'],
  ['Validated Library Item', 'LIB-9442', 'validated', '23 ms', 'emerald'],
  ['Bounded Context Retrieval', 'CTX-7711', 'retrieved', '31 ms', 'emerald'],
  ['Prompt Use', 'PRM-6621', 'in_use', '27 ms', 'amber'],
  ['Usage Event Recorded', 'USE-5512', 'recorded', '15 ms', 'amber'],
  ['Timeline Event Emitted', 'TL-8831', 'emitted', '19 ms', 'rose'],
] satisfies Array<[string, string, string, string, Tone]>

const relationships = [
  ['Architect', 'Coder', 'Active', '0.82', '0.18', '2m ago', 'Fresh', 'violet', 'blue'],
  ['Synthesis Agent', 'Reviewer', 'Active', '0.76', '0.21', '5m ago', 'Fresh', 'violet', 'blue'],
  ['Planner', 'Mentor', 'Active', '0.71', '0.15', '12m ago', 'Fresh', 'blue', 'emerald'],
  ['Researcher', 'Analyst', 'Active', '0.68', '0.24', '18m ago', 'Stale', 'emerald', 'violet'],
  ['Coder', 'Tester', 'Active', '0.69', '0.27', '32m ago', 'Stale', 'blue', 'violet'],
  ['Architect', 'Reviewer', 'Idle', '0.61', '0.22', '1h ago', 'Stale', 'violet', 'blue'],
  ['Mentor', 'Synthesis Agent', 'Active', '0.79', '0.11', '3m ago', 'Fresh', 'emerald', 'violet'],
  ['Planner', 'Researcher', 'Idle', '0.55', '0.31', '3h ago', 'Stale', 'blue', 'emerald'],
] satisfies Array<[string, string, string, string, string, string, string, Tone, Tone]>

const runtimeTrace = [
  ['01', 'VAL-112', 'Validate request body & schema', '14 ms', 'ok'],
  ['02', 'AGT-992', 'Load agent identity, traits, state', '21 ms', 'ok'],
  ['03', 'MEM-LOAD', 'Load relevant memories', '63 ms', 'ok'],
  ['04', 'CTX-BUILD', 'Build context from profile and knowledge', '42 ms', 'ok'],
  ['05', 'ROUTE', 'Route to provider policy + health', '18 ms', 'ok'],
  ['06', 'CALL-LLM', 'Call model stream', '1,124 ms', 'ok'],
  ['07', 'Q-GATE', 'Apply output quality gate', '96 ms', 'ok'],
  ['08', 'PERSIST-OUT', 'Persist assistant message', '27 ms', 'ok'],
  ['09', 'WRITE-MEM', 'Write extracted memories', '38 ms', 'ok'],
  ['10', 'USAGE', 'Record usage and cost', '16 ms', 'ok'],
  ['11', 'EMIT-TL', 'Emit timeline event', '21 ms', 'ok'],
]

const workflowSteps = [
  {
    title: 'Agent Turn',
    icon: MessageSquare,
    tone: 'violet',
    body: 'User message, assistant response, provider/model metadata.',
    rows: ['MSG-188 stored', 'RSP-188 stored', 'PRV: Ollama ok'],
    table: 'messages',
  },
  {
    title: 'Runtime State',
    icon: UserRound,
    tone: 'blue',
    body: 'Identity, emotion appraisal, profile cue, learning observation.',
    rows: ['PRF-771 updated', 'EMO-5321 ok', 'LRN-221 recorded'],
    table: 'profile_state',
  },
  {
    title: 'Memory Layer',
    icon: Network,
    tone: 'cyan',
    body: 'Conversation episode, semantic fact, graph link, canonical key.',
    rows: ['MEM-442 stored', 'LNK-1191 linked', 'KEY-9f3a canonical'],
    table: 'memories',
  },
  {
    title: 'Execution Lab',
    icon: Layers,
    tone: 'blue',
    body: 'Scenario, creative session, journal, dream, challenge, arena run.',
    rows: ['SCN-3310 done', 'JRNL-553 done', 'AR-119 done'],
    table: '*_runs / sessions',
  },
  {
    title: 'Knowledge Governance',
    icon: BookOpen,
    tone: 'rose',
    body: 'Candidate extraction, review queue, validated Library item.',
    rows: ['CAND-671 extracted', 'RQ-218 in review', 'LIB-9442 validated'],
    table: 'library_items',
  },
  {
    title: 'Audit + Replay',
    icon: ShieldCheck,
    tone: 'amber',
    body: 'Timeline event, provenance trace, usage event, quality report.',
    rows: ['TL-8831 emitted', 'TRC-819a captured', 'QLT-3312 passed'],
    table: 'timeline_events',
  },
] satisfies Array<{
  title: string
  icon: LucideIcon
  tone: Tone
  body: string
  rows: string[]
  table: string
}>

const foundation = [
  ['PostgreSQL Canonical Store', 'Primary system of record for all agent state.', Database, 'Canonical', 'blue'],
  ['Drizzle ORM', 'Typesafe queries, migrations, and schema enforcement.', Network, 'Active', 'cyan'],
  ['Server-owned Counters', 'IDs, sequence, and time are server-authoritative.', Settings, 'Authoritative', 'slate'],
  ['Legacy Firestore Migration Mirror', 'Best-effort mirror for compatibility only.', Database, 'Read-only', 'amber'],
  ['Provider Fallback', 'Policy-driven routing with resilience.', Route, 'Resilient', 'violet'],
  ['Output Quality Gates', 'Evaluated, repaired, and quality-verified.', ShieldCheck, 'Enforced', 'emerald'],
] satisfies Array<[string, string, LucideIcon, string, Tone]>

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function HomeThemeButton() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)

  useEffect(() => setMounted(true), [])

  const isDark = !mounted || resolvedTheme === 'dark'

  return (
    <button
      type="button"
      aria-label="Toggle color theme"
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      className="grid h-11 w-11 place-items-center rounded-[8px] border border-white/10 bg-white/[0.035] text-white/82 transition hover:border-[#b8a1ff]/45 hover:bg-white/[0.07]"
    >
      {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
    </button>
  )
}

function ToneIcon({
  icon: Icon,
  tone = 'violet',
  size = 'md',
}: {
  icon: LucideIcon
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
}) {
  return (
    <span
      className={cx(
        'grid shrink-0 place-items-center border',
        toneClass[tone].border,
        toneClass[tone].bg,
        size === 'sm' && 'h-7 w-7 rounded-[6px]',
        size === 'md' && 'h-9 w-9 rounded-[7px]',
        size === 'lg' && 'h-12 w-12 rounded-[9px]'
      )}
    >
      <Icon className={cx(toneClass[tone].text, size === 'sm' ? 'h-3.5 w-3.5' : size === 'lg' ? 'h-6 w-6' : 'h-[18px] w-[18px]')} />
    </span>
  )
}

function StatusPill({ children, tone = 'emerald' }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx('inline-flex items-center gap-1 rounded-[5px] border px-2 py-0.5 font-mono text-[11px]', toneClass[tone].border, toneClass[tone].bg, toneClass[tone].text)}>
      {children}
    </span>
  )
}

function Panel({
  title,
  subtitle,
  right,
  children,
  className,
}: {
  title?: string
  subtitle?: string
  right?: ReactNode
  children: ReactNode
  className?: string
}) {
  return (
    <section className={cx('min-w-0 rounded-[8px] border border-white/10 bg-[#081321]/82 p-3 shadow-[0_18px_70px_-58px_rgba(0,0,0,0.9)]', className)}>
      {(title || right) && (
        <div className="mb-2 flex items-start justify-between gap-3">
          <div>
            {title && <h3 className="text-[12px] font-semibold uppercase tracking-[0.08em] text-white/92">{title}</h3>}
            {subtitle && <p className="mt-0.5 text-[10px] leading-4 text-slate-400">{subtitle}</p>}
          </div>
          {right}
        </div>
      )}
      {children}
    </section>
  )
}

function FieldRow({ label, value, tone = 'slate' }: { label: string; value: string; tone?: Tone }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/[0.055] py-1.5 last:border-b-0">
      <span className="text-[11px] text-slate-400">{label}</span>
      <span className={cx('font-mono text-[11px]', tone === 'slate' ? 'text-slate-200' : toneClass[tone].text)}>{value}</span>
    </div>
  )
}

function MiniFlow({ steps, tone = 'violet' }: { steps: string[]; tone?: Tone }) {
  return (
    <div className="flex items-center gap-1.5 overflow-hidden">
      {steps.map((step, index) => (
        <div key={step} className="flex min-w-0 items-center gap-1.5">
          <span className={cx('truncate rounded-[5px] border px-2 py-1.5 text-center text-[10px] leading-3', toneClass[tone].border, toneClass[tone].soft, 'text-slate-200')}>
            {step}
          </span>
          {index < steps.length - 1 && <ArrowRight className="h-3 w-3 shrink-0 text-slate-500" />}
        </div>
      ))}
    </div>
  )
}

function LandingNav() {
  const nav = [
    ['Home', '#top'],
    ['Agents', '/agents'],
    ['Dashboard', '/dashboard'],
    ['Arena', '/simulation'],
    ['Docs', '#workflow'],
  ]

  return (
    <header className="relative z-30 flex h-[76px] w-full items-center border-b border-white/10 bg-[#020713]/90 px-5 text-white backdrop-blur-xl sm:px-8 lg:px-12">
      <div className="flex flex-1 items-center gap-3">
        <Link href="/" className="flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-[8px] border border-[#b8a1ff]/45 bg-[#9b7cf6]/10 text-[#d8ccff]">
            <PlaygroundLogo className="h-6 w-6" />
          </span>
          <span className="hidden leading-tight sm:block">
            <span className="block text-[16px] font-semibold tracking-tight">Agent Playground</span>
            <span className="block text-[12px] text-slate-300">Inspectable Agent OS</span>
          </span>
        </Link>
      </div>

      <nav className="hidden flex-1 justify-center gap-8 lg:flex">
        {nav.map(([label, href]) => (
          <Link
            key={label}
            href={href}
            className={cx(
              'relative flex h-[76px] items-center px-2 text-[15px] text-white/82 transition hover:text-white',
              label === 'Home' && 'text-white after:absolute after:inset-x-1 after:bottom-0 after:h-px after:bg-[#b8a1ff]'
            )}
          >
            {label}
          </Link>
        ))}
      </nav>

      <div className="flex flex-1 items-center justify-end gap-3">
        <span className="hidden items-center gap-2 rounded-full border border-white/10 bg-white/[0.035] px-4 py-2 text-[12px] text-white/82 md:inline-flex">
          <Cloud className="h-3.5 w-3.5 text-[#b8a1ff]" />
          Local + Cloud Runtime
          <span className="h-1.5 w-1.5 rounded-full bg-[#49d581]" />
        </span>
        <HomeThemeButton />
        <Link
          href="https://github.com"
          aria-label="Open GitHub"
          className="grid h-11 w-11 place-items-center rounded-[8px] border border-white/10 bg-white/[0.035] text-white/82 transition hover:border-[#b8a1ff]/45 hover:bg-white/[0.07]"
        >
          <Github className="h-5 w-5" />
        </Link>
      </div>
    </header>
  )
}

function HeroSection() {
  return (
    <section id="top" className="relative h-[760px] overflow-hidden bg-[#020713] text-white">
      <div
        aria-hidden="true"
        className="absolute inset-0 opacity-95"
        style={{
          backgroundImage: "url('/landing_page_bg.png')",
          backgroundPosition: 'center',
          backgroundRepeat: 'no-repeat',
          backgroundSize: '100% 100%',
        }}
      />
      <div className="absolute inset-0 bg-[#020713]/24" />
      <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-[#020713] via-[#020713]/55 to-transparent" />
      <LandingNav />

      <div className="relative z-10 mx-auto flex max-w-[1520px] flex-col items-center px-5 pt-16 text-center sm:pt-16">
        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.45 }}
          className="inline-flex max-w-full items-center gap-2 rounded-full border border-[#9b7cf6]/55 bg-[#050b16]/62 px-4 py-2 text-[13px] text-slate-200 backdrop-blur-md"
        >
          <Hexagon className="h-4 w-4 text-[#b8a1ff]" />
          <span className="font-mono uppercase tracking-[0.08em] text-[#d8ccff]">Architecture Cockpit</span>
          <span className="h-4 w-px bg-white/15" />
          <span className="hidden text-slate-300 sm:inline">Inspectable agents, governed knowledge, replayable workflows</span>
        </motion.div>

        <motion.h1
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.08, duration: 0.5 }}
          className="mt-6 max-w-[1050px] text-[clamp(2.55rem,3.35vw,4.05rem)] font-semibold leading-[1.08] tracking-[-0.01em] text-white"
        >
          Build and explore agents with{' '}
          <span className="text-[#9da7ff]">memory</span>, <span className="text-[#c9a5ff]">state</span>, and{' '}
          <span className="text-[#ff8fa6]">proof</span>.
        </motion.h1>

        <motion.p
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.16, duration: 0.5 }}
          className="mt-5 max-w-[880px] text-[16px] leading-7 text-slate-200/86 sm:text-[17px]"
        >
          Agent Playground is an inspectable AI agent operating system for persistent identity, semantic memory, emotional state, run-based workspaces, source-backed knowledge, relationship intelligence, and PostgreSQL-first audit trails.
        </motion.p>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.22, duration: 0.5 }}
          className="mt-7 flex flex-col gap-4 sm:flex-row"
        >
          <Link
            href="/agents/new"
            className="inline-flex h-[52px] min-w-64 items-center justify-center gap-4 rounded-[7px] border border-[#b8a1ff]/25 bg-[#a997ff] px-7 text-[15px] font-semibold text-[#050713] transition hover:bg-[#b8a1ff]"
          >
            Start Building
            <ArrowRight className="h-5 w-5" />
          </Link>
          <Link
            href="#architecture"
            className="inline-flex h-[52px] min-w-64 items-center justify-center gap-4 rounded-[7px] border border-white/14 bg-[#050b16]/55 px-7 text-[15px] font-semibold text-white transition hover:border-[#b8a1ff]/45 hover:bg-white/[0.06]"
          >
            Explore Architecture
            <Table2 className="h-5 w-5" />
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28, duration: 0.5 }}
          className="mt-6 flex max-w-[1220px] flex-wrap justify-center gap-3"
        >
          {heroBadges.map(({ label, icon: Icon, tone }) => (
            <span
              key={label}
              className="inline-flex items-center gap-2 rounded-[6px] border border-white/12 bg-[#050b16]/64 px-4 py-2.5 text-[13px] font-medium text-white/90 backdrop-blur"
            >
              <Icon className={cx('h-4 w-4', toneClass[tone].text)} />
              {label}
            </span>
          ))}
        </motion.div>
      </div>
    </section>
  )
}

function CockpitChrome({
  activeTab,
  setActiveTab,
}: {
  activeTab: CockpitTab
  setActiveTab: (tab: CockpitTab) => void
}) {
  return (
    <>
      <div className="flex h-8 items-center justify-between border-b border-white/10 bg-[#020713] px-5">
        <div className="flex gap-2">
          <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span className="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div className="flex gap-4 text-slate-500">
          <span>-</span>
          <span>[]</span>
          <span>x</span>
        </div>
      </div>
      <div className="grid h-[58px] grid-cols-[300px_1fr_330px] border-b border-white/10 bg-[#050d18]">
        <div className="flex items-center gap-3 border-r border-white/8 px-5">
          <PlaygroundLogo className="h-7 w-7 text-white" />
          <span className="text-[14px] font-semibold text-white">Agent Playground</span>
          <StatusPill tone="blue">Product Tour</StatusPill>
        </div>
        <div className="flex items-stretch justify-center">
          {cockpitTabs.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={cx(
                'min-w-[164px] border-x border-transparent px-4 text-[13px] text-slate-300 transition hover:bg-white/[0.035] hover:text-white',
                activeTab === tab && 'border-white/8 bg-[#101b34] text-[#b8a1ff] shadow-[inset_0_-2px_0_#9b7cf6]'
              )}
            >
              {tab}
            </button>
          ))}
        </div>
        <div className="flex items-center justify-end gap-3 px-5">
          <CircleHelp className="h-4 w-4 text-slate-300" />
          <Settings className="h-4 w-4 text-slate-300" />
          <div className="h-8 w-px bg-white/10" />
          <div className="text-right">
            <div className="text-[12px] font-semibold text-white">Platform Operator</div>
            <div className="text-[10px] text-slate-500">Admin</div>
          </div>
          <div className="relative grid h-10 w-10 place-items-center rounded-full bg-white/[0.06] text-[12px] text-white">
            OP
            <span className="absolute bottom-0 right-0 h-2.5 w-2.5 rounded-full border border-[#050d18] bg-[#49d581]" />
          </div>
        </div>
      </div>
    </>
  )
}

function PipelineCard({ step, index }: { step: (typeof corePipeline)[number]; index: number }) {
  const Icon = step.icon
  return (
    <div className="relative min-h-[156px] rounded-[7px] border border-white/[0.075] bg-white/[0.035] p-2">
      {index < corePipeline.length - 1 && <ArrowRight className="absolute -right-3 top-[62px] z-10 h-4 w-4 text-slate-400" />}
      <div className="mb-2 flex items-center gap-2">
        <span className={cx('font-mono text-[12px]', toneClass[step.tone].text)}>{String(index + 1).padStart(2, '0')}</span>
        <ToneIcon icon={Icon} tone={step.tone} size="sm" />
      </div>
      <h4 className="min-h-[36px] text-center text-[11px] font-semibold leading-[1.35] text-white">{step.title}</h4>
      <div className="mt-3 space-y-1 border-t border-white/[0.055] pt-2 font-mono text-[9px] text-slate-400">
        <div className="flex justify-between"><span>ID</span><span className="text-slate-300">{step.id}</span></div>
        <div className="flex justify-between"><span>Latency</span><span className="text-slate-300">{step.latency}</span></div>
        <div className="flex justify-between"><span>Status</span><CheckCircle2 className="h-3.5 w-3.5 text-[#49d581]" /></div>
        <div className="flex justify-between"><span>Confidence</span><span className="text-slate-300">{step.score}</span></div>
      </div>
    </div>
  )
}

function AgentCoreTab() {
  const domainCards = [
    {
      title: 'Memory',
      subtitle: '442 Semantic Facts',
      icon: Database,
      tone: 'cyan' as Tone,
      rows: [
        ['Top Fact', 'Prefers structured, source-backed explanations with step-by-step reasoning.'],
        ['canonicalKey', 'mem://agent/AGT-992/fact/442'],
        ['evidenceRefs', '[SRC-812, SRC-991, SRC-1021]'],
      ],
    },
    {
      title: 'Emotion',
      subtitle: 'Live State',
      icon: Heart,
      tone: 'rose' as Tone,
      rows: [
        ['dominantEmotion', 'Calm-Positive'],
        ['intensity', '0.38'],
        ['historyEvent', 'User expressed appreciation.'],
      ],
    },
    {
      title: 'Profile',
      subtitle: 'Run-Based Analysis',
      icon: UserRound,
      tone: 'violet' as Tone,
      rows: [
        ['psychologicalProfile', 'Analytical - Reliable - Empathic'],
        ['communicationFingerprint', 'Prefers clarity, structure, citations, and actionable next steps.'],
      ],
    },
    {
      title: 'Learning',
      subtitle: 'Active',
      icon: BookOpen,
      tone: 'emerald' as Tone,
      rows: [
        ['latestObservation', 'User values concise, source-backed answers with visual structures.'],
        ['confirmedPattern', 'Prefers tables, diagrams, bullet lists.'],
        ['activeAdaptation', 'Adjusting response formatting priority.'],
      ],
    },
  ]

  return (
    <div className="grid grid-cols-[420px_1fr_286px] gap-2">
      <Panel className="min-h-[548px]" title="Synthesis Agent">
        <div className="mb-3 flex items-center gap-3">
          <ToneIcon icon={Bot} tone="violet" size="lg" />
          <div>
            <div className="text-[20px] font-semibold text-white">Synthesis Agent</div>
            <div className="mt-1 flex items-center gap-2 text-[13px] text-[#73e8a5]">
              <span className="h-2 w-2 rounded-full bg-[#49d581]" />
              Deployed
            </div>
          </div>
          <StatusPill tone="violet">AGT-992</StatusPill>
        </div>
        <div className="mb-3 space-y-0.5 border-y border-white/[0.06] py-2">
          <FieldRow label="Provider Preference" value="OpenAI" />
          <FieldRow label="Model Runtime" value="gpt-4.1-turbo" />
          <FieldRow label="Created" value="May 25, 2025 10:42 AM" />
          <FieldRow label="Persistence" value="PostgreSQL" />
        </div>
        <div className="rounded-[7px] border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white">Identity Specification</div>
          <div className="space-y-1 font-mono text-[11px] leading-4">
            {[
              ['name', '"Synthesis Agent"'],
              ['persona', '"Insightful", "Precise", "Empathetic"'],
              ['goals', '["Understand", "Synthesize", "Advise"]'],
              ['guardrails', '["Safe", "Accurate", "Aligned"]'],
              ['coreTraits', '["Analytical", "Curious", "Structured"]'],
              ['dynamicTraits', '["Adaptive", "Context-Aware"]'],
              ['memoryCount', '442'],
              ['relationshipCount', '128'],
              ['profileState', '"Evolving"'],
              ['learningState', '"Active"'],
            ].map(([label, value]) => (
              <div key={label} className="grid grid-cols-[136px_10px_1fr]">
                <span className="text-[#95e6bd]">{label}</span>
                <span className="text-slate-500">:</span>
                <span className="text-[#c7a9ff]">{value}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="mt-3 text-[11px] leading-4 text-slate-400">
          Agent is a connected runtime object with Identity - State - Memory - Emotion - Profile - Learning - Persistence - Audit.
        </p>
      </Panel>

      <div className="grid gap-2">
        <Panel title="Chat-Turn Lifecycle Pipeline" subtitle="One user message -> full agent cognition cycle">
          <div className="grid grid-cols-8 gap-2">
            {corePipeline.map((step, index) => (
              <PipelineCard key={step.id} step={step} index={index} />
            ))}
          </div>
        </Panel>
        <div className="grid grid-cols-4 gap-2">
          {domainCards.map((card) => {
            const Icon = card.icon
            return (
              <Panel key={card.title} className={cx('min-h-[224px]', toneClass[card.tone].soft, toneClass[card.tone].border)}>
                <div className="mb-2 flex items-center gap-2">
                  <ToneIcon icon={Icon} tone={card.tone} />
                  <div>
                    <h3 className="text-[13px] font-semibold uppercase tracking-[0.08em] text-white">{card.title}</h3>
                    <p className="text-[11px] text-slate-400">{card.subtitle}</p>
                  </div>
                </div>
                <div className="space-y-2">
                  {card.rows.map(([label, value]) => (
                    <div key={label} className="rounded-[6px] border border-white/[0.06] bg-[#050d18]/70 p-2">
                      <div className={cx('mb-1 font-mono text-[11px]', toneClass[card.tone].text)}>{label}</div>
                      <div className="text-[11px] leading-4 text-slate-200">{value}</div>
                    </div>
                  ))}
                </div>
                <div className="mt-3 font-mono text-[10px] text-slate-400">Last Updated | {card.title === 'Memory' ? '2m ago' : card.title === 'Emotion' ? '5s ago' : card.title === 'Profile' ? '1m ago' : '20s ago'}</div>
              </Panel>
            )
          })}
        </div>
      </div>

      <Panel title="Decision Provenance" subtitle="Why this response was chosen" className="min-h-[548px]">
        <div className="relative space-y-2 pl-4">
          <span className="absolute bottom-4 left-2 top-3 w-px bg-[#9b7cf6]/40" />
          {provenance.map(([title, id, detail, confidence, latency, source, Icon, tone]) => (
            <div key={title} className="relative rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2">
              <span className="absolute -left-[15px] top-4 h-2.5 w-2.5 rounded-full border border-[#b8a1ff] bg-[#081321]" />
              <div className="flex gap-2">
                <ToneIcon icon={Icon} tone={tone} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-white">{title}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">
                    {id} - {detail}
                  </div>
                  <div className="font-mono text-[9px] text-slate-500">
                    Conf {confidence} - {latency} - [{source}]
                  </div>
                </div>
                <CheckCircle2 className="h-4 w-4 text-[#49d581]" />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Event Log" subtitle="Technical" className="col-span-3">
        <div className="grid grid-cols-[520px_440px_250px_1fr] gap-3">
          <div className="rounded-[7px] border border-white/10 bg-[#050d18] p-2 font-mono text-[10px] leading-4">
            {['Pipeline started EVT-98121', 'Emotion appraisal complete EMO-55321', 'Model response received MOD-77211', 'Quality gate passed QLT-33109', 'Memory extracted MEM-442', 'Learning observation recorded LRN-221', 'Profile evidence written PRF-119', 'Pipeline completed EVT-98122'].map((line, index) => (
              <div key={line} className="grid grid-cols-[94px_1fr_100px] text-slate-400">
                <span className="text-[#a78bfa]">12:01:{String(15 + index).padStart(2, '0')}.{231 + index}</span>
                <span>{line.split(' ').slice(0, -1).join(' ')}</span>
                <span className="text-[#8db7ff]">{line.split(' ').at(-1)}</span>
              </div>
            ))}
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="rounded-[7px] border border-white/10 bg-[#050d18] p-2">
              <div className="mb-2 text-[12px] font-semibold text-white">Changed Domains</div>
              {['memory MEM-442', 'emotions EMO-55321', 'learning LRN-221', 'profile PRF-119', 'timeline EVT-98122'].map((row) => (
                <div key={row} className="flex justify-between rounded-[5px] px-2 py-1 font-mono text-[10px] text-slate-300">
                  <span className="text-[#c7a9ff]">{row.split(' ')[0]}</span>
                  <span className="text-[#8db7ff]">{row.split(' ')[1]}</span>
                </div>
              ))}
            </div>
            <div className="rounded-[7px] border border-[#f66f91]/20 bg-[#f66f91]/6 p-2">
              <div className="mb-2 text-[12px] font-semibold text-white">Stale Domains</div>
              {['memory MEM-440 (stale)', 'learning LRN-219 (stale)'].map((row) => (
                <div key={row} className="rounded-[5px] px-2 py-1 font-mono text-[10px] text-[#ff8fa6]">{row}</div>
              ))}
            </div>
          </div>
          <div className="rounded-[7px] border border-white/10 bg-[#050d18] p-2">
            {[
              ['server-owned counters', 'enabled'],
              ['qualityStatus', 'passed'],
              ['sourceRefs', '6'],
              ['audit', 'preserved'],
              ['timestamp', 'May 25, 2025 12:01:16 UTC'],
              ['traceId', 'TRC-8f9a2c11'],
            ].map(([label, value]) => (
              <FieldRow key={label} label={label} value={value} tone={value === 'passed' || value === 'preserved' ? 'emerald' : 'slate'} />
            ))}
          </div>
          <div className="rounded-[7px] border border-white/10 bg-[#050d18] p-2">
            <div className="mb-2 text-[12px] font-semibold uppercase tracking-[0.08em] text-white">Audit Metadata</div>
            <div className="grid grid-cols-3 gap-2">
              {['quality gate', 'source trail', 'repair state', 'provider route', 'timeline', 'usage event'].map((item) => (
                <StatusPill key={item} tone="emerald">{item}</StatusPill>
              ))}
            </div>
          </div>
        </div>
      </Panel>
    </div>
  )
}

function ExecutionLabsTab() {
  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_300px] gap-3">
      <div className="min-w-0 space-y-3">
        <Panel title="Run Orchestration">
          <div className="grid grid-cols-6 gap-3">
            {[
              ['Run ID', 'RUN-7F3A-9921', Play],
              ['Active Model', 'gpt-4.1-turbo', Brain],
              ['Provider', 'OpenAI', Hexagon],
              ['Local (Ollama)', 'Available', Bot],
              ['Run Budget', '1,250 / 2,000 credits', BarChart3],
              ['Persistence Mode', 'Durable (PostgreSQL)', Database],
            ].map(([label, value, Icon]) => (
              <div key={String(label)} className="flex min-w-0 items-center gap-2 border-r border-white/10 last:border-r-0">
                <ToneIcon icon={Icon as LucideIcon} tone={value === 'Available' ? 'emerald' : 'violet'} size="sm" />
                <div className="min-w-0">
                  <div className="text-[10px] text-slate-400">{label}</div>
                  <div className="mt-1 truncate text-[13px] text-white">{value}</div>
                </div>
              </div>
            ))}
          </div>
        </Panel>
        <div className="grid grid-cols-3 gap-3">
          {executionLabs.map((lab, index) => (
            <Panel key={lab.title} className={toneClass[lab.tone].border} right={<StatusPill tone={lab.tone}>{lab.status}</StatusPill>}>
              <div className="mb-2 flex items-center gap-2">
                <ToneIcon icon={lab.icon} tone={lab.tone} />
                <div className="min-w-0">
                  <div className="truncate text-[17px] font-semibold text-white"><span className="mr-2 font-mono text-slate-400">{index + 1}</span>{lab.title}</div>
                  <div className="truncate text-[11px] text-slate-400">{lab.subtitle}</div>
                </div>
              </div>
              <MiniFlow steps={lab.flow} tone={lab.tone} />
              <div className="mt-3 grid grid-cols-3 gap-2">
                {lab.rows.slice(0, 3).map(([label, value]) => (
                  <div key={label} className="min-h-[74px] rounded-[6px] border border-white/[0.07] bg-white/[0.03] p-2.5">
                    <div className="font-mono text-[10px] text-[#8db7ff]">{label}</div>
                    <div className="mt-2 line-clamp-2 text-[11px] leading-5 text-slate-200">{value}</div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex flex-wrap gap-2 border-t border-white/[0.06] pt-2.5">
                {lab.footer.map((item) => (
                  <StatusPill key={item} tone={item.includes('passed') || item.includes('true') || item.includes('finalized') ? 'emerald' : lab.tone}>{item}</StatusPill>
                ))}
              </div>
            </Panel>
          ))}
        </div>
        <Panel title="Unified Run Lifecycle" subtitle="All execution surfaces">
          <div className="grid grid-cols-8 gap-2.5">
            {[
              ['Draft', 'EVT-1001', 'score 0.62', 'violet'],
              ['Running', 'EVT-1002', 'score 0.78', 'blue'],
              ['Blocked', 'EVT-1003', 'reason length_violation', 'rose'],
              ['Repaired', 'EVT-1004', 'repairs 1', 'amber'],
              ['Saved', 'EVT-1005', 'persisted true', 'emerald'],
              ['Published', 'EVT-1006', 'visibility internal', 'emerald'],
              ['Completed', 'EVT-1007', 'status success', 'violet'],
              ['Archived', 'EVT-1008', 'retention 90d', 'slate'],
            ].map(([label, id, meta, tone], index) => (
              <div key={label} className="relative rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
                {index < 7 && <ArrowRight className="absolute -right-4 top-9 h-3.5 w-3.5 text-slate-500" />}
                <ToneIcon icon={CheckCircle2} tone={tone as Tone} size="sm" />
                <div className="mt-2 text-[12px] font-semibold text-white">{label}</div>
                <div className="mt-2 font-mono text-[10px] text-slate-400">12:01:{9 + index * 8}</div>
                <div className="font-mono text-[10px] text-slate-400">{id}</div>
                <div className="mt-1 truncate font-mono text-[10px] text-slate-500">{meta}</div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="min-w-0 space-y-3">
        <Panel title="Run Control + Quality Gates">
          <div className="space-y-2">
            {[
              ['Leakage Checks', 'no_sensitive_leakage', 'emerald'],
              ['Source-Ref Validation', 'valid_refs: 8 / 8', 'emerald'],
              ['Repair Attempt', 'status: success', 'emerald'],
              ['Provider Fallback', 'used: No', 'emerald'],
              ['Local Model Hardening', 'policy: strict', 'emerald'],
              ['Library Extraction', 'status: partial', 'amber'],
              ['Parent Workflow Completion', 'status: completed', 'emerald'],
            ].map(([label, detail, tone]) => (
              <div key={label} className="flex items-center gap-2.5 rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
                <ToneIcon icon={tone === 'amber' ? ShieldCheck : CheckCircle2} tone={tone as Tone} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="truncate text-[11px] font-semibold text-white">{label}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">{detail}</div>
                </div>
                {tone === 'amber' ? <span className="font-mono text-[14px] text-[#ffc05f]">!</span> : <CheckCircle2 className="h-4 w-4 text-[#49d581]" />}
              </div>
            ))}
          </div>
          <button type="button" className="mt-4 flex h-9 w-full items-center justify-center gap-2 rounded-[5px] border border-[#9b7cf6]/40 bg-[#9b7cf6]/8 text-[12px] text-[#d8ccff]">
            <ChevronRight className="h-4 w-4" />
            View Full Run Log
          </button>
        </Panel>
        <Panel title="Persisted Tables">
          <div className="grid grid-cols-2 gap-2">
            {['scenario_runs', 'dream_sessions', 'creative_sessions', 'challenge_runs', 'journal_sessions', 'arena_runs'].map((table) => (
              <div key={table} className="flex min-w-0 items-center gap-2 rounded-[5px] border border-white/[0.07] bg-white/[0.03] px-2 py-2 font-mono text-[10px] text-slate-300">
                <Database className="h-4 w-4 text-slate-400" />
                <span className="truncate">{table}</span>
              </div>
            ))}
          </div>
        </Panel>
      </div>
      <div className="col-span-2 grid grid-cols-8 gap-2 rounded-[8px] border border-white/10 bg-[#081321]/82 p-2.5 font-mono text-[10px] text-slate-400">
          {['Run ID RUN-7F3A-9921', 'Owner Platform Operator', 'Started May 25, 2025 12:01:09', 'Duration 00:01:19', 'Model gpt-4.1-turbo', 'Provider OpenAI', 'Quality Overall 0.94', 'Audit preserved'].map((item) => (
            <span key={item} className="truncate border-r border-white/[0.06] px-2 last:border-r-0">{item}</span>
          ))}
      </div>
    </div>
  )
}

function KnowledgePlaneTab() {
  return (
    <div className="grid w-full min-w-0 grid-cols-[minmax(0,1.55fr)_minmax(360px,1fr)_minmax(280px,0.72fr)_minmax(300px,0.78fr)] gap-3">
      <Panel title="Knowledge Library">
        <div className="mb-2 grid grid-cols-4 gap-2">
          {[
            ['Review', '18', 'violet'],
            ['Validated', '642', 'emerald'],
            ['Disputed', '6', 'amber'],
            ['Retired', '23', 'rose'],
          ].map(([label, count, tone]) => (
            <StatusPill key={label} tone={tone as Tone}>{label} {count}</StatusPill>
          ))}
        </div>
        <div className="grid min-w-0 grid-cols-[minmax(260px,0.95fr)_minmax(0,1fr)] gap-3">
          <div className="min-w-0">
            <div className="mb-2 flex gap-2">
              <div className="flex h-8 min-w-0 flex-1 items-center gap-2 rounded-[5px] border border-white/10 bg-[#050d18] px-3 text-[11px] text-slate-500">
                <Search className="h-4 w-4" />
                Search library items...
              </div>
              <button type="button" className="h-8 rounded-[5px] border border-white/10 px-3 text-[11px] text-slate-300">Filter</button>
            </div>
            <div className="mb-2 font-mono text-[10px] text-slate-500">Sort: updatedAt (desc)</div>
            <div className="space-y-1.5">
              {knowledgeItems.map(([id, title, status, age, tone], index) => (
                <div key={id} className={cx('rounded-[7px] border px-2.5 py-2', index === 0 ? 'border-[#9b7cf6]/70 bg-[#9b7cf6]/10' : 'border-white/[0.07] bg-white/[0.03]')}>
                  <div className="flex items-center justify-between font-mono text-[10px] text-slate-400">
                    <span>{id}</span>
                    <StatusPill tone={tone}>{status}</StatusPill>
                  </div>
                  <div className="mt-1.5 truncate text-[11px] leading-4 text-white">{title}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-500">Candidate - {age} - v1</div>
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between font-mono text-[10px] text-slate-400">
              <span>1-7 of 18</span>
              <span>1  2  3  ...</span>
            </div>
          </div>
          <div className="min-w-0 rounded-[8px] border border-white/10 bg-[#050d18] p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div>
                <div className="font-mono text-[11px] text-[#b8a1ff]">LIB-9442</div>
                <h3 className="mt-1 text-[15px] font-semibold leading-5 text-white">Memory decay is non-linear over time</h3>
              </div>
              <StatusPill tone="violet">Review</StatusPill>
            </div>
            <div className="space-y-2 text-[11px] leading-4 text-slate-300">
              <p><span className="font-semibold text-white">Claim</span><br />Human and agent memory retention decays non-linearly, with steeper initial drop and long-tail stabilization.</p>
              <p><span className="font-semibold text-white">Body excerpt</span><br />Multiple longitudinal studies show rapid forgetting within first 24 hours followed by a slower asymptotic decay curve... (512 tokens)</p>
            </div>
            <div className="mt-3 grid grid-cols-3 overflow-hidden rounded-[6px] border border-white/[0.07] font-mono text-[10px]">
              {[
                ['Category', 'Cognitive Science'],
                ['Scope', 'Agent + Human'],
                ['Visibility', 'Internal'],
                ['Confidence', '0.72'],
                ['Quality', 'pending_review'],
                ['Prompt', 'unknown'],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 border-r border-t border-white/[0.07] p-2 text-slate-400">
                  <div>{label}</div>
                  <div className={cx('mt-1 truncate', value === 'pending_review' ? 'text-[#ffc05f]' : 'text-slate-300')}>{value}</div>
                </div>
              ))}
            </div>
            <div className="mt-3">
              <div className="mb-1.5 text-[11px] font-semibold text-white">Tags</div>
              <div className="flex flex-wrap gap-1.5">
                {['memory', 'decay', 'retention', 'cognition', 'time-series', '+2'].map((tag) => (
                  <StatusPill key={tag} tone="slate">{tag}</StatusPill>
                ))}
              </div>
            </div>
            <div className="mt-3 rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
              <div className="mb-1.5 text-[11px] font-semibold text-white">Source Refs (3)</div>
              <div className="space-y-1 font-mono text-[9px] leading-4 text-slate-400">
                <div><span className="text-[#c7a9ff]">SRC-7711</span> Ebbinghaus Forgetting Curve Revisited (2021)</div>
                <div><span className="text-[#c7a9ff]">SRC-8812</span> Longitudinal Memory Retention Study (2023)</div>
                <div><span className="text-[#c7a9ff]">SRC-9917</span> Neural Correlates of Memory Decay (2022)</div>
              </div>
            </div>
            <div className="mt-2 grid grid-cols-2 gap-2 font-mono text-[9px] text-slate-400">
              <div className="rounded-[6px] border border-white/[0.07] p-2">Lineage<br /><span className="text-slate-300">No superseded lineage</span></div>
              <div className="rounded-[6px] border border-white/[0.07] p-2">Duplicate Suggestions<br /><span className="text-slate-300">DUP-881 (0.84)</span></div>
            </div>
          </div>
        </div>
      </Panel>

      <Panel title="Knowledge Lifecycle Pipeline" subtitle="End-to-end flow from feature output to governed usage">
        <div className="space-y-2">
          {knowledgePipeline.map(([title, id, status, ms, tone], index) => (
            <div key={title} className="relative flex items-center gap-2.5 rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
              {index < knowledgePipeline.length - 1 && <span className="absolute left-6 top-full h-2 w-px bg-slate-500" />}
              <ToneIcon icon={index < 2 ? FileText : index < 4 ? ShieldCheck : index < 6 ? Route : History} tone={tone} size="sm" />
              <div className="min-w-0 flex-1">
                <div className="truncate text-[11px] font-semibold text-white">{title}</div>
                <div className="mt-0.5 text-[10px] text-slate-400">{id}</div>
              </div>
              <StatusPill tone={tone}>{status}</StatusPill>
              <span className="w-11 text-right font-mono text-[10px] text-slate-400">{ms}</span>
            </div>
          ))}
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 rounded-[7px] border border-white/10 bg-[#050d18] p-2.5 font-mono text-[10px]">
          <FieldRow label="Pipeline Run" value="PL-2025-05-25-001" />
          <FieldRow label="Status" value="completed" tone="emerald" />
          <FieldRow label="Duration" value="261 ms" />
        </div>
      </Panel>

      <div className="space-y-3">
        <Panel title="Knowledge Graph" subtitle="Graph updated 2m ago">
          <div className="relative mx-auto h-[220px] w-full">
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 280 220">
              <path d="M140 92 L140 35 M140 92 L218 70 M140 92 L235 120 M140 92 L185 172 M140 92 L78 162 M140 92 L45 112 M140 92 L80 55" stroke="rgba(115,232,165,.55)" strokeWidth="1.4" />
            </svg>
            <div className="absolute left-1/2 top-[92px] grid h-22 w-22 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-[#9b7cf6]/60 bg-[#9b7cf6]/20 text-center text-[11px] font-semibold text-white">
              Memory<br />Decay
            </div>
            {[
              ['Emotion', 'left-[48%] top-[4%]'],
              ['Forgetting Curve', 'right-[2%] top-[25%]'],
              ['Time Dynamics', 'right-[0%] top-[55%]'],
              ['Encoding Strength', 'left-[58%] bottom-[7%]'],
              ['Attention', 'left-[10%] bottom-[18%]'],
              ['Context', 'left-[0%] top-[45%]'],
              ['Strength', 'left-[15%] top-[17%]'],
            ].map(([label, pos]) => (
              <div key={label} className={cx('absolute rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1.5 text-[10px] leading-3 text-slate-200', pos)}>{label}</div>
            ))}
          </div>
          <div className="grid grid-cols-[1fr_1fr_1fr] gap-1.5 font-mono text-[9px] text-slate-400">
            <span><b className="text-[#9b7cf6]">●</b> Concept</span>
            <span><b className="text-[#73e8a5]">●</b> Memory Link</span>
            <span><b className="text-[#ffc05f]">●</b> Derived</span>
          </div>
          <FieldRow label="Importance" value="0.78" tone="violet" />
        </Panel>
        <Panel title="Timeline" subtitle="Server-composed">
          {['Chat event recorded CH-5512', 'Memory updated MEM-442', 'Emotion state updated EMO-5532', 'Library item validated LIB-9442', 'Timeline event emitted TL-8831'].map((item, index) => (
            <div key={item} className="grid grid-cols-[58px_1fr_60px] rounded-[5px] px-2 py-1.5 font-mono text-[10px] text-slate-400">
              <span>12:01:{15 + index}</span>
              <span>{item.split(' ').slice(0, -1).join(' ')}</span>
              <span className="text-[#8db7ff]">{item.split(' ').at(-1)}</span>
            </div>
          ))}
        </Panel>
        <Panel title="Output Quality">
          <FieldRow label="Evaluator Result" value="passed" tone="emerald" />
          <FieldRow label="Quality Flags" value="source-backed, grounded" />
          <FieldRow label="Repair Trace" value="No repairs required" tone="emerald" />
          <FieldRow label="legacy_unvalidated" value="false" />
        </Panel>
      </div>

      <Panel title="Validated Context Retrieval" subtitle="Strict rules for prompt-safe retrieval">
        <div className="space-y-2">
          {[
            'Review items cannot affect prompts',
            'Disputed and retired items disabled',
            'Merged/superseded items set allowPromptUse false',
            'Only validated prompt-eligible items retrieved',
            'Max 3 to 5 context items',
            'UsageCount and lastUsedAt updated',
          ].map((rule, index) => (
            <div key={rule} className="flex items-center gap-2.5 rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
              <ToneIcon icon={ShieldCheck} tone={index === 2 ? 'amber' : index < 2 ? 'rose' : 'emerald'} size="sm" />
              <div className="min-w-0 flex-1 text-[11px] leading-4 text-slate-200">{rule}<div className="font-mono text-[10px] text-[#73e8a5]">State: enforced</div></div>
              <CheckCircle2 className="h-4 w-4 text-[#49d581]" />
            </div>
          ))}
        </div>
        <div className="mt-3">
          <div className="mb-2 flex justify-between text-[11px] text-slate-400"><span>Retrieved Items (4/5)</span><span>Total Usage This Run: 12</span></div>
          {['LIB-9431 Emotional valence...', 'LIB-9420 Trust grows with...', 'LIB-9442 Memory decay is...', 'LIB-9366 Attention modulates...'].map((item) => (
            <div key={item} className="flex items-center justify-between rounded-[5px] px-2 py-1 font-mono text-[10px] text-slate-300">
              <span>{item}</span>
              <CheckCircle2 className="h-3.5 w-3.5 text-[#49d581]" />
            </div>
          ))}
        </div>
      </Panel>

      <Panel title="Knowledge Data & Audit" className="col-span-3">
        <div className="grid grid-cols-6 gap-2">
          {['library_items 1,284 rows', 'library_item_sources 3,842 rows', 'library_item_validations 2,117 rows', 'library_item_usage_events 18,662 rows', 'timeline_events 156,773 rows', 'collective_broadcasts 2,331 rows'].map((item, index) => (
            <div key={item} className="flex min-w-0 items-center gap-2 rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
              <ToneIcon icon={Database} tone={(['cyan', 'blue', 'violet', 'amber', 'cyan', 'violet'] as Tone[])[index]} size="sm" />
              <div className="min-w-0 truncate font-mono text-[10px] text-slate-300">{item}<div className="mt-1 text-[#73e8a5]">audit preserved</div></div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="System Guardrails" className="col-span-1">
        <div className="grid grid-cols-[1fr_86px] gap-3">
          <div>
            <FieldRow label="Invalid transition returns 409" value="enforced" tone="emerald" />
            <FieldRow label="Source trail exists" value="required" tone="emerald" />
          </div>
          <div className="grid place-items-center rounded-[7px] border border-[#73e8a5]/20 bg-[#73e8a5]/8 p-2 text-center">
            <ShieldCheck className="h-7 w-7 text-[#73e8a5]" />
            <div className="mt-1 font-mono text-[9px] text-slate-400">Governance<br /><span className="text-[#73e8a5]">ENABLED</span></div>
          </div>
        </div>
      </Panel>
    </div>
  )
}

function NetworkIntelligenceTab() {
  return (
    <div className="grid w-full min-w-0 grid-cols-[420px_minmax(0,1fr)_330px_280px] gap-3">
      <Panel title="Relationship Roster" right={<StatusPill tone="blue">Pairs 128</StatusPill>}>
        <div className="mb-2 flex gap-2">
          <div className="flex h-8 flex-1 items-center gap-2 rounded-[5px] border border-white/10 bg-[#050d18] px-3 text-[11px] text-slate-500">
            <Search className="h-4 w-4" />
            Search pairs or agents...
          </div>
          <button type="button" className="h-8 rounded-[5px] border border-white/10 px-3 text-[11px] text-slate-300">Filter</button>
        </div>
        <div className="grid grid-cols-[minmax(0,1fr)_48px_42px_48px_54px_48px] gap-1 px-2 pb-2 text-[9px] text-slate-500">
          <span>Pair</span><span>Status</span><span>Trust</span><span>Tension</span><span>Last</span><span>Freshness</span>
        </div>
        <div className="space-y-1.5">
          {relationships.map(([a, b, status, trust, tension, last, freshness, toneA, toneB]) => (
            <div key={`${a}-${b}`} className="grid grid-cols-[minmax(0,1fr)_48px_42px_48px_54px_48px] items-center gap-1 rounded-[7px] border border-white/[0.07] bg-white/[0.03] px-2 py-2 text-[10px] text-slate-300">
              <div className="flex min-w-0 items-center gap-1.5">
                <ToneIcon icon={UserRound} tone={toneA} size="sm" />
                <span className="min-w-0 truncate">{a} <span className="text-slate-500">&lt;-&gt;</span> {b}</span>
                <ToneIcon icon={Code2} tone={toneB} size="sm" />
              </div>
              <span className={status === 'Active' ? 'text-[#73e8a5]' : 'text-[#8db7ff]'}>{status}</span>
              <span className="font-mono">{trust}</span>
              <span className="font-mono">{tension}</span>
              <span className="truncate">{last}</span>
              <StatusPill tone={freshness === 'Fresh' ? 'emerald' : 'amber'}>{freshness}</StatusPill>
            </div>
          ))}
        </div>
      </Panel>

      <div className="space-y-3">
        <Panel title="Pair Detail" subtitle="Selected Relationship: Architect <-> Coder" right={<StatusPill tone="violet">REL-204</StatusPill>}>
          <div className="grid grid-cols-[170px_1fr_170px] gap-3">
            <div className="rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
              <div className="mb-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-white">Metrics Overview</div>
              {[
                ['Trust', '0.82', 'w-[82%]', 'emerald'],
                ['Respect', '0.86', 'w-[86%]', 'emerald'],
                ['Affection', '0.64', 'w-[64%]', 'amber'],
                ['Familiarity', '0.88', 'w-[88%]', 'emerald'],
                ['Alignment', '0.79', 'w-[79%]', 'emerald'],
                ['Tension', '0.18', 'w-[18%]', 'rose'],
              ].map(([label, value, width, tone]) => (
                <div key={label} className="mb-2">
                  <div className="mb-1 flex justify-between text-[11px] text-slate-300"><span>{label}</span><span>{value}</span></div>
                  <div className="h-1.5 rounded-full bg-white/8"><div className={cx('h-full rounded-full', width, tone === 'rose' ? 'bg-[#ff8fa6]' : tone === 'amber' ? 'bg-[#ffc05f]' : 'bg-[#73e8a5]')} /></div>
                </div>
              ))}
            </div>
            <div className="relative min-h-[222px] overflow-hidden rounded-[7px] border border-white/[0.07] bg-[#050d18] p-3">
              <svg className="absolute inset-x-8 top-7 h-[126px] w-[calc(100%-64px)]" viewBox="0 0 430 150" preserveAspectRatio="none">
                <path d="M76 47 L214 101 L354 47" stroke="rgba(115,232,165,.64)" strokeWidth="2.2" fill="none" />
                <path d="M76 38 L214 92 L354 38" stroke="rgba(184,161,255,.62)" strokeWidth="2.2" fill="none" />
                <path d="M214 100 L354 56" stroke="rgba(255,192,95,.58)" strokeWidth="1.6" fill="none" />
              </svg>
              <div className="absolute left-[12%] top-6 text-center">
                <div
                  className="grid h-[72px] w-[76px] place-items-center border border-[#b783ff]/70 bg-[#9b7cf6]/16 shadow-[inset_0_0_18px_rgba(155,124,246,.16)]"
                  style={{ clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0 50%)' }}
                >
                  <UserRound className="h-8 w-8 text-[#c7a9ff]" />
                </div>
                <div className="mt-2 text-[13px] font-semibold text-white">Architect</div>
              </div>
              <div className="absolute right-[12%] top-6 text-center">
                <div
                  className="grid h-[72px] w-[76px] place-items-center border border-[#6fa8ff]/70 bg-[#2e73c8]/16 shadow-[inset_0_0_18px_rgba(111,168,255,.14)]"
                  style={{ clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0 50%)' }}
                >
                  <Code2 className="h-8 w-8 text-[#8db7ff]" />
                </div>
                <div className="mt-2 text-[13px] font-semibold text-white">Coder</div>
              </div>
              <div
                className="absolute left-1/2 top-[88px] grid h-[84px] w-[98px] -translate-x-1/2 place-items-center border border-[#49d581]/45 bg-[#123d35]/82 text-center text-[12px] font-semibold leading-5 text-white shadow-[inset_0_0_22px_rgba(73,213,129,.12)]"
                style={{ clipPath: 'polygon(25% 5%, 75% 5%, 100% 50%, 75% 95%, 25% 95%, 0 50%)' }}
              >
                <span>Relationship<br />REL-204</span>
              </div>
              <div className="absolute bottom-4 left-1/2 grid w-[84%] -translate-x-1/2 grid-cols-4 gap-2">
                {[
                  ['Strong', 'bg-[#73e8a5]'],
                  ['Moderate', 'bg-[#ffc05f]'],
                  ['Weak', 'bg-[#ff6d7c]'],
                  ['Neutral', 'bg-slate-500'],
                ].map(([label, dot]) => (
                  <div key={label} className="flex h-8 items-center justify-center gap-2 rounded-[5px] border border-white/[0.07] bg-white/[0.03] text-[11px] font-semibold text-slate-300">
                    <span className={cx('h-2 w-2 rounded-full', dot)} />
                    {label}
                  </div>
                ))}
              </div>
            </div>
            <div className="rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
              <FieldRow label="Interaction Count" value="148" />
              <FieldRow label="First Meeting" value="May 12, 2025" />
              <FieldRow label="Last Interaction" value="12:01" />
              <FieldRow label="Events" value="7" />
              <StatusPill tone="blue">collaboration</StatusPill>
              <StatusPill tone="violet">technical</StatusPill>
            </div>
          </div>
        </Panel>
        <Panel title="Evidence-Driven Synthesis Pipeline">
          <MiniFlow steps={['Source Event', 'Relationship Evidence', 'Synthesis Run', 'Revision', 'Pair Projection Updated']} tone="violet" />
          <div className="mt-3 rounded-[7px] border border-white/[0.07] bg-[#050d18] p-2.5">
            <div className="grid grid-cols-[90px_86px_86px_72px_72px_72px_1fr_82px] border-b border-white/[0.06] pb-2 font-mono text-[10px] text-slate-500">
              <span>Event ID</span><span>Actor</span><span>Target</span><span>Valence</span><span>Weight</span><span>Conf</span><span>Source</span><span>Timestamp</span>
            </div>
            {[
              ['EVD-881', 'Architect', 'Coder', 'Positive', '0.42', '0.91', 'arena', 'May 25, 12:00'],
              ['EVD-865', 'Coder', 'Architect', 'Positive', '0.31', '0.87', 'challenge', 'May 25, 11:45'],
              ['EVD-842', 'Architect', 'Coder', 'Negative', '0.38', '0.84', 'conflict', 'May 25, 10:22'],
              ['EVD-828', 'Mentor', 'Coder', 'Positive', '0.22', '0.78', 'mentorship', 'May 25, 09:41'],
            ].map((row) => (
              <div key={row[0]} className="grid grid-cols-[90px_86px_86px_72px_72px_72px_1fr_82px] py-1.5 font-mono text-[10px] text-slate-400">
                {row.map((cell, index) => <span key={`${row[0]}-${cell}`} className={index === 3 ? (cell === 'Negative' ? 'text-[#ff8fa6]' : 'text-[#73e8a5]') : ''}>{cell}</span>)}
              </div>
            ))}
          </div>
        </Panel>
      </div>

      <div className="space-y-3">
        <Panel title="Collective Intelligence">
          <div className="grid grid-cols-2 gap-2">
            {[
              ['Who Knows What', 'Coder: architecture patterns. Architect: system design.', 'cyan'],
              ['Expert Referrals', 'Coder -> Tester (perf). Architect -> Researcher.', 'amber'],
              ['Validated Broadcasts', '3 new broadcasts available.', 'emerald'],
              ['Support / Dispute Decisions', 'Support: 8, Dispute: 1.', 'rose'],
              ['Network Visibility', 'Visible to 12 agents.', 'emerald'],
              ['Consensus Signal', '78% agreement on stance.', 'emerald'],
            ].map(([title, body, tone]) => (
              <div key={title} className="rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
                <ToneIcon icon={Network} tone={tone as Tone} size="sm" />
                <div className="mt-2 text-[11px] font-semibold text-white">{title}</div>
                <div className="mt-1.5 text-[10px] leading-4 text-slate-400">{body}</div>
              </div>
            ))}
          </div>
        </Panel>
        <Panel title="Mentorship">
          <FieldRow label="Mentor Match" value="Mentor -> Coder" tone="emerald" />
          <FieldRow label="Focus Areas" value="Code Quality, Design Patterns" />
          <FieldRow label="Lesson Status" value="8 completed, 2 in progress" />
          <FieldRow label="Growth Connection" value="+0.18 capability delta" tone="emerald" />
          <FieldRow label="Side Effect" value="Trust +0.07 Respect +0.05" tone="emerald" />
        </Panel>
      </div>

      <Panel title="Social Provenance">
        <div className="relative space-y-2 pl-5">
          <span className="absolute bottom-6 left-2 top-6 w-px bg-slate-600" />
          {[
            ['Arena event generated social signal', 'EVD-881', 'ARNA-7719 12:00', 'violet'],
            ['Challenge result added evidence', 'EVD-865', 'CHLG-5521 11:45', 'blue'],
            ['Conflict resolution adjusted tension', 'EVD-842', 'CNFL-3312 10:22', 'rose'],
            ['Mentorship completion improved trust', 'EVD-828', 'MENT-2291 09:41', 'emerald'],
            ['Synthesis run applied revision', 'SYN-119', 'REV-044 12:01', 'violet'],
            ['Library candidate created', 'LIB-CAND-77', 'LIB-9442 12:02', 'amber'],
          ].map(([title, id, detail, tone]) => (
            <div key={title} className="relative rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
              <span className="absolute -left-[17px] top-5 h-2.5 w-2.5 rounded-full border border-slate-400 bg-[#081321]" />
              <div className="flex gap-3">
                <ToneIcon icon={Network} tone={tone as Tone} />
                <div>
                  <div className="text-[11px] font-semibold leading-4 text-white">{title}</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-400">{id} conf: 0.91</div>
                  <div className="mt-1 font-mono text-[10px] text-slate-500">{detail}</div>
                </div>
                <CheckCircle2 className="ml-auto h-4 w-4 text-[#49d581]" />
              </div>
            </div>
          ))}
        </div>
      </Panel>

      <Panel className="col-span-2" title="Downstream Effects">
        <div className="grid grid-cols-6 gap-2">
          {[
            ['Timeline Impact', 'Relationship revisions appear in Timeline.', Clock3, 'cyan'],
            ['Library Impact', 'Material synthesis can create review candidates.', BookOpen, 'amber'],
            ['Scenario Impact', 'Relationship state influences branching.', Network, 'violet'],
            ['Journal Impact', 'Affects reflective framing in entries.', FileText, 'rose'],
            ['Challenge Impact', 'Shapes team selection and scoring.', Trophy, 'amber'],
            ['Arena Impact', 'Informs seeding, debate bias and follow-up.', ShieldCheck, 'blue'],
          ].map(([title, body, Icon, tone]) => (
            <div key={String(title)} className="rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
              <ToneIcon icon={Icon as LucideIcon} tone={tone as Tone} />
              <div className="mt-2 text-[11px] font-semibold text-white">{title}</div>
              <div className="mt-1.5 text-[10px] leading-4 text-slate-400">{body}</div>
            </div>
          ))}
        </div>
      </Panel>
      <Panel title="System State">
        <FieldRow label="Last Synthesis Run" value="SYN-119 12:01:14" />
        <FieldRow label="Last Revision" value="REV-044 12:01:18" />
        <FieldRow label="Network Entities" value="42" />
        <FieldRow label="Active Relationships" value="128" />
        <FieldRow label="Evidence Events (24h)" value="1,248" />
      </Panel>
      <Panel title="Guardrails">
        {['No private memory leaked', 'Attribution preserved', 'Bias detection active', 'Explainability enforced', 'Source refs required'].map((item) => (
          <div key={item} className="flex items-center gap-2 py-1.5 text-[12px] text-slate-300"><CheckCircle2 className="h-4 w-4 text-[#49d581]" />{item}</div>
        ))}
      </Panel>
    </div>
  )
}

function RuntimeTab() {
  const stack = [
    ['Client Workspace', 'Next.js App Router', Code2, 'blue'],
    ['Next.js App Router', 'API Route Handlers', Route, 'cyan'],
    ['Service Layer', 'Business Logic + Orchestration', Hexagon, 'violet'],
    ['Repository Layer', 'Data Access Abstractions', Database, 'amber'],
    ['Drizzle ORM', 'Typesafe Queries & Migrations', Zap, 'emerald'],
    ['PostgreSQL Canonical Store', 'ACID - Consistent - Authoritative', Database, 'violet'],
  ] satisfies Array<[string, string, LucideIcon, Tone]>

  return (
    <div className="grid w-full min-w-0 grid-cols-[280px_minmax(0,1.35fr)_minmax(0,1.08fr)_minmax(0,1.08fr)_minmax(340px,1fr)] gap-3">
      <Panel title="Architecture Stack" subtitle="Request flow from client to canonical store" className="row-span-2">
        <div className="space-y-1.5">
          {stack.map(([title, subtitle, Icon, tone], index) => (
            <div key={title} className="relative flex items-center gap-2 rounded-[7px] border border-white/[0.08] bg-white/[0.035] p-2">
              {index < stack.length - 1 && <span className="absolute -bottom-3 left-1/2 text-slate-400">v</span>}
              <ToneIcon icon={Icon} tone={tone} />
              <div>
                <div className="text-[12px] font-semibold text-white">{index + 1}. {title}</div>
                <div className="mt-0.5 text-[10px] text-slate-400">{subtitle}</div>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-3 rounded-[7px] border border-[#f6a72a]/40 bg-[#f6a72a]/10 p-2">
          <div className="mb-2 flex items-center gap-2"><ToneIcon icon={Database} tone="amber" size="sm" /><span className="text-[12px] font-semibold text-white">Firestore Legacy / Migration Mirror</span><StatusPill tone="amber">Legacy</StatusPill></div>
          <p className="text-[10px] leading-4 text-slate-400">Read support during migration only. Not canonical runtime store.</p>
        </div>
      </Panel>

      <Panel title="Live Request Trace" right={<StatusPill tone="emerald">Request in progress</StatusPill>}>
        <div className="mb-3 flex items-center justify-between gap-3">
          <div className="text-[15px] font-semibold text-white">POST /api/agents/AGT-992/chat</div>
          <div className="flex shrink-0 gap-2"><StatusPill tone="violet">REQ-7f81c2a5</StatusPill><StatusPill tone="slate">1,842 ms</StatusPill></div>
        </div>
        <div className="grid grid-cols-[30px_76px_1fr_52px_28px] border-b border-white/[0.07] pb-1.5 font-mono text-[9px] text-slate-500">
          <span>Step</span><span>ID</span><span>Description</span><span>Latency</span><span>Status</span>
        </div>
        {runtimeTrace.map(([step, id, description, latency]) => (
          <div key={id} className="grid grid-cols-[30px_76px_1fr_52px_28px] py-1.5 font-mono text-[10px] leading-4 text-slate-400">
            <span className="text-[#73e8a5]">{step}</span>
            <span className="text-[#8db7ff]">{id}</span>
            <span className="text-slate-300">{description}</span>
            <span>{latency}</span>
            <CheckCircle2 className="h-3.5 w-3.5 text-[#49d581]" />
          </div>
        ))}
        <div className="mt-2 flex justify-between gap-2 border-t border-white/[0.07] pt-2 font-mono text-[10px] text-slate-400">
          <span>Total Time <b className="ml-2 rounded bg-white/8 px-2 py-1 text-slate-200">1,520 ms</b></span>
          <span>Quality Status <StatusPill tone="emerald">passed</StatusPill></span>
          <span>Source Refs <b className="text-slate-200">7</b></span>
        </div>
      </Panel>

      <Panel title="Provider Routing" subtitle="Policy-driven routing with resilient fallbacks">
        <div className="grid grid-cols-3 gap-2">
          {[
            ['Gemini', 'gemini-1.5-pro', 'Healthy', '812 ms', 'blue'],
            ['Groq', 'llama3-70b-8192', 'Healthy', '643 ms', 'rose'],
            ['Ollama', 'llama3.1:70b', 'Healthy (Local)', '523 ms', 'emerald'],
          ].map(([name, model, health, latency, tone]) => (
            <div key={name} className="rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2">
              <ToneIcon icon={Hexagon} tone={tone as Tone} size="sm" />
              <div className="mt-2 text-[12px] font-semibold text-white">{name}</div>
              <div className="mt-1 text-[10px] leading-4 text-slate-400">Provider<br />{model}<br /><span className="text-[#73e8a5]">{health}</span><br />Latency {latency}</div>
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-1">
          <FieldRow label="Selected Provider" value="Groq (llama3-70b-8192)" tone="emerald" />
          <FieldRow label="Routed By" value="policy: balanced_latency" />
          <FieldRow label="Fallback Order" value="Groq -> Gemini -> Ollama" />
          <FieldRow label="Timeout Handling" value="30s hard timeout + fallback" />
        </div>
      </Panel>

      <Panel title="PostgreSQL Canonical Store" subtitle="Schema map (authoritative runtime)">
        {[
          ['Core', ['agents', 'messages', 'memories', 'memory_graphs']],
          ['Identity & Profile', ['profile_analysis_runs', 'agent_relationships', 'relationship_evidence']],
          ['Execution Surfaces', ['creative_sessions', 'journal_sessions', 'dream_sessions', 'scenario_runs', 'challenge_runs', 'arena_runs']],
          ['Knowledge & Library', ['library_items', 'library_item_validations', 'library_item_usage_events']],
          ['Network & Collective', ['collective_broadcasts']],
        ].map(([group, tables]) => (
          <div key={String(group)} className="mb-2 rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2">
            <div className="mb-1.5 text-[11px] font-semibold text-[#c7a9ff]">{group}</div>
            <div className="grid grid-cols-2 gap-1.5">
              {(tables as string[]).map((table) => (
                <span key={table} className="flex items-center gap-2 rounded-[4px] border border-white/[0.07] bg-[#050d18] px-2 py-1 font-mono text-[9px] text-slate-300">
                  <Database className="h-3.5 w-3.5 text-slate-400" />
                  {table}
                </span>
              ))}
            </div>
          </div>
        ))}
        <div className="font-mono text-[10px] text-[#73e8a5]">All tables are versioned via Drizzle migrations</div>
      </Panel>

      <Panel title="Inspectable Runtime" subtitle="Everything is observable and auditable" className="row-span-2">
        <div className="space-y-2">
          {[
            ['PostgreSQL Canonical', 'Single source of truth', 'blue'],
            ['Drizzle Schema', 'Type-safe, versioned', 'violet'],
            ['Bounded Provider Calls', 'Policy + timeouts + retries', 'violet'],
            ['Server-Only Secrets', 'Keys never exposed to client', 'amber'],
          ].map(([title, body, tone]) => (
            <div key={title} className="flex items-center gap-2 rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2">
              <ToneIcon icon={title.includes('Secrets') ? LockKeyhole : Database} tone={tone as Tone} />
              <div className="flex-1">
                <div className="text-[11px] font-semibold text-white">{title}</div>
                <div className="mt-1 text-[10px] text-slate-400">{body}</div>
              </div>
              <CheckCircle2 className="h-4 w-4 text-[#49d581]" />
            </div>
          ))}
        </div>
        {[
          ['qualityStatus', 'passed'],
          ['sourceRefs', '7'],
          ['audit events', '1,248'],
          ['usage events', '3,412'],
          ['staleDomains', '0'],
          ['changedDomains', '5'],
          ['legacy_unvalidated compatibility', 'enabled'],
        ].map(([label, value]) => (
          <FieldRow key={label} label={label} value={value} tone={value === 'passed' || value === 'enabled' ? 'emerald' : 'slate'} />
        ))}
      </Panel>

      <div className="col-span-3 col-start-2 grid min-w-0 grid-cols-[minmax(0,0.95fr)_minmax(0,0.95fr)_minmax(0,1.1fr)_minmax(0,1fr)] gap-3">
        <Panel title="Quality Gates">
          {['Output Quality Gate', 'Source Reference Gate', 'Safety & Guardrail Gate', 'Completeness Gate'].map((gate) => (
            <FieldRow key={gate} label={gate} value="Enforced" tone="emerald" />
          ))}
        </Panel>
        <Panel title="Evaluator Scripts">
          {['evaluate-creative', 'evaluate-journal', 'evaluate-profile', 'evaluate-scenarios'].map((script) => (
            <FieldRow key={script} label={script} value="Latest" tone="emerald" />
          ))}
        </Panel>
        <Panel title="Engineering Verification">
          <FieldRow label="npm run lint" value="Passed 1.2s" tone="emerald" />
          <FieldRow label="npm run build" value="Passed 6.8s" tone="emerald" />
          <FieldRow label="npm run db:migrate" value="Up to date" tone="emerald" />
          <FieldRow label="Dry-run Backfills" value="No changes" tone="emerald" />
        </Panel>
        <Panel title="Migration & Backfill" subtitle="Operational utilities">
          <FieldRow label="Backfill Missing Source Refs" value="Dry-run" tone="violet" />
          <FieldRow label="Recalculate Signals" value="Dry-run" tone="violet" />
          <FieldRow label="Rebuild Embeddings" value="Dry-run" tone="violet" />
          <FieldRow label="Validate Candidates" value="Dry-run" tone="violet" />
        </Panel>
      </div>

      <Panel title="Server Event Log" subtitle="Real-time operational events" className="col-span-4">
        <div className="grid grid-cols-[150px_64px_1fr_360px_120px_76px_44px] border-b border-white/[0.07] pb-2 font-mono text-[9px] text-slate-500">
          <span>Time (UTC)</span><span>Level</span><span>Event</span><span>Details</span><span>Request ID</span><span>Duration</span><span>Status</span>
        </div>
        {[
          ['2025-05-25 12:01:12.123', 'INFO', 'route.validated', 'POST /api/agents/AGT-992/chat validated successfully', 'REQ-7f81c2a5', '14ms'],
          ['2025-05-25 12:01:12.145', 'INFO', 'repository.tx_committed', 'Assistant message persisted', 'REQ-7f81c2a5', '27ms'],
          ['2025-05-25 12:01:12.176', 'DEBUG', 'library.extraction.skipped', 'No high-quality candidate extracted', 'REQ-7f81c2a5', '5ms'],
          ['2025-05-25 12:01:12.198', 'INFO', 'timeline.adapter.emitted', 'Timeline event emitted', 'REQ-7f81c2a5', '21ms'],
          ['2025-05-25 12:01:12.201', 'INFO', 'provider.fallback.not_needed', 'Groq responded successfully', 'REQ-7f81c2a5', '0ms'],
          ['2025-05-25 12:01:12.242', 'INFO', 'quality.gate.passed', 'Output quality gate passed', 'REQ-7f81c2a5', '96ms'],
          ['2025-05-25 12:01:12.258', 'INFO', 'usage.recorded', 'Usage recorded', 'REQ-7f81c2a5', '16ms'],
        ].map((row) => (
          <div key={row[2]} className="grid grid-cols-[150px_64px_1fr_360px_120px_76px_44px] py-1.5 font-mono text-[10px] text-slate-400">
            <span>{row[0]}</span><span className="text-[#73e8a5]">{row[1]}</span><span className="text-slate-300">{row[2]}</span><span className="truncate">{row[3]}</span><span className="text-[#c7a9ff]">{row[4]}</span><span>{row[5]}</span><CheckCircle2 className="h-4 w-4 text-[#49d581]" />
          </div>
        ))}
      </Panel>
      <Panel title="Runtime Health">
        <div className="grid grid-cols-2 gap-2">
          {[
            ['Uptime', '7d 14h 22m'],
            ['Requests (24h)', '18,642'],
            ['Avg Latency', '782 ms'],
            ['Error Rate', '0.23%'],
            ['DB Health', 'Healthy'],
            ['Queue Depth', '18'],
            ['Providers Healthy', '3 / 3'],
            ['Active Agents', '128'],
          ].map(([label, value]) => (
            <div key={label} className="rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2">
              <div className="text-[11px] text-slate-400">{label}</div>
              <div className="mt-1 font-mono text-[14px] text-[#73e8a5]">{value}</div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex items-center gap-2 font-mono text-[11px] text-[#73e8a5]"><CheckCircle2 className="h-4 w-4" />All systems operational</div>
      </Panel>
    </div>
  )
}

function ArchitectureCockpit() {
  const [activeTab, setActiveTab] = useState<CockpitTab>('Agent Core')

  return (
    <section id="architecture" className="relative z-20 -mt-[185px] bg-transparent px-3 pb-7 pt-0 text-white sm:px-5">
      <div className="mx-auto w-[calc(100vw-72px)] max-w-[1820px] overflow-hidden rounded-[14px] border border-white/10 bg-[#030914] shadow-[0_30px_120px_-90px_rgba(0,0,0,0.95)]">
        <CockpitChrome activeTab={activeTab} setActiveTab={setActiveTab} />
        <div className="overflow-hidden">
          <div className="w-full p-2">
            {activeTab === 'Agent Core' && <AgentCoreTab />}
            {activeTab === 'Execution Labs' && <ExecutionLabsTab />}
            {activeTab === 'Knowledge Plane' && <KnowledgePlaneTab />}
            {activeTab === 'Network Intelligence' && <NetworkIntelligenceTab />}
            {activeTab === 'Runtime' && <RuntimeTab />}
          </div>
        </div>
      </div>
    </section>
  )
}

function WorkflowStory() {
  return (
    <section id="workflow" className="relative overflow-hidden bg-[#020713] px-5 py-12 text-white sm:py-14">
      <div
        className="absolute inset-0 opacity-22"
        style={{ backgroundImage: "url('/landing_page_bg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="absolute inset-0 bg-[#020713]/82" />
      <div className="relative mx-auto max-w-[1810px]">
        <div className="mx-auto max-w-[760px] text-center">
          <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-[#d8ccff]">Workflow Story</div>
          <h2 className="mt-3 text-[clamp(2.25rem,3.15vw,3.65rem)] font-semibold leading-[1.02] tracking-tight">
            Every action leaves a <span className="text-[#b8a1ff]">trace.</span>
          </h2>
          <p className="mt-4 text-[15px] leading-6 text-slate-300">
            Agent Playground turns prompts, runs, relationships, and knowledge into source-backed state you can inspect later.
          </p>
        </div>

        <div className="mt-8 grid grid-cols-[1fr_220px] gap-4 max-xl:block">
          <div>
            <div className="grid grid-cols-6 gap-3 max-xl:grid-cols-3 max-md:grid-cols-1">
              {workflowSteps.map((step, index) => (
                <div key={step.title} className="relative rounded-[8px] border border-white/15 bg-[#071321]/80 p-4">
                  {index < workflowSteps.length - 1 && (
                    <div className="absolute -right-4 top-1/2 z-10 flex w-4 items-center">
                      <span className="h-px flex-1 bg-[#b8a1ff]/65" />
                      <ArrowRight className="h-4 w-4 text-[#b8a1ff]" />
                    </div>
                  )}
                  <StatusPill tone={step.tone}>{String(index + 1).padStart(2, '0')}</StatusPill>
                  <div className="mt-5"><ToneIcon icon={step.icon} tone={step.tone} size="lg" /></div>
                  <h3 className="mt-5 text-[15px] font-semibold text-white">{step.title}</h3>
                  <p className="mt-2 min-h-[58px] text-[12px] leading-5 text-slate-300">{step.body}</p>
                  <div className="mt-4 border-y border-white/[0.07] py-2.5">
                    {step.rows.map((row) => (
                      <div key={row} className="flex items-center justify-between gap-2 py-1 font-mono text-[10px] text-slate-300">
                        <span className="truncate">{row}</span>
                        <StatusPill tone={row.includes('in review') ? 'amber' : row.includes('disputed') ? 'rose' : 'emerald'}>{row.split(' ').at(-1)}</StatusPill>
                      </div>
                    ))}
                  </div>
                  <div className="mt-3 text-[11px] text-slate-400">Table / Entity</div>
                  <div className="mt-1 font-mono text-[13px] text-white">{step.table}</div>
                </div>
              ))}
            </div>
          </div>
          <Panel title="Trace Example" className="max-xl:mt-4">
            <div className="space-y-2.5">
              {[
                ['MSG-188', 'User message', '12:01:12', MessageSquare, 'violet'],
                ['MEM-442', 'Memory stored', '12:01:12', Network, 'cyan'],
                ['LIB-9442', 'Library item validated', '12:01:13', BookOpen, 'emerald'],
                ['TL-8831', 'Timeline event emitted', '12:01:15', Clock3, 'rose'],
                ['REV-044', 'Provenance revision', '12:01:16', ShieldCheck, 'rose'],
              ].map(([id, label, time, Icon, tone], index) => (
                <div key={String(id)} className="relative rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-2.5">
                  {index < 4 && <ArrowRight className="absolute -bottom-3.5 left-1/2 h-3.5 w-3.5 rotate-90 text-slate-400" />}
                  <div className="flex items-center gap-2.5">
                    <ToneIcon icon={Icon as LucideIcon} tone={tone as Tone} />
                    <div>
                      <div className={cx('font-mono text-[11px]', toneClass[tone as Tone].text)}>{id}</div>
                      <div className="text-[11px] text-slate-300">{label}</div>
                      <div className="font-mono text-[10px] text-slate-500">{time}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        </div>

        <Panel title="Persistence & Infrastructure Foundation" className="mt-6">
          <div className="grid grid-cols-6 gap-2.5 max-xl:grid-cols-3 max-md:grid-cols-1">
            {foundation.map(([title, body, Icon, status, tone]) => (
              <div key={title} className="rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-3">
                <div className="flex items-center gap-3">
                  <ToneIcon icon={Icon} tone={tone} />
                  <div>
                    <div className="text-[13px] font-semibold leading-4 text-white">{title}</div>
                    <div className="mt-1.5 text-[11px] leading-4 text-slate-400">{body}</div>
                  </div>
                </div>
                <div className="mt-3"><StatusPill tone={tone}>{status}</StatusPill></div>
              </div>
            ))}
          </div>
        </Panel>
      </div>
    </section>
  )
}

function FinalCta() {
  const ribbon = [
    ['Agent Core', 'Identity & State', Brain, 'violet'],
    ['Execution Labs', 'Runs & Experiments', FlaskConical, 'blue'],
    ['Knowledge Plane', 'Library & Governance', BookOpen, 'cyan'],
    ['Network Intelligence', 'Relationships & Signals', Users, 'rose'],
    ['Runtime', 'Infrastructure & Proof', Server, 'amber'],
  ] satisfies Array<[string, string, LucideIcon, Tone]>

  return (
    <section className="relative overflow-hidden bg-[#020713] px-5 pb-0 pt-12 text-white">
      <div
        className="absolute inset-0 opacity-30"
        style={{ backgroundImage: "url('/landing_page_bg.png')", backgroundSize: 'cover', backgroundPosition: 'center' }}
      />
      <div className="absolute inset-0 bg-[#020713]/78" />
      <div className="relative mx-auto max-w-[1560px] text-center">
        <div className="font-mono text-[12px] uppercase tracking-[0.12em] text-[#d8ccff]">Start Building</div>
        <h2 className="mx-auto mt-4 max-w-[800px] text-[clamp(2.4rem,3.6vw,4.2rem)] font-semibold leading-[1.04] tracking-tight">
          Build your own<br />
          <span className="text-[#9da7ff]">inspectable</span> <span className="text-[#c9a5ff]">agent</span> <span className="text-[#ff8fa6]">system.</span>
        </h2>
        <p className="mx-auto mt-4 max-w-[680px] text-[15px] leading-6 text-slate-300">
          Create agents, run experiments, validate knowledge, inspect provenance, and keep every important state change traceable.
        </p>
        <div className="mt-6 flex justify-center gap-4 max-sm:flex-col">
          <Link href="/agents/new" className="inline-flex h-12 min-w-64 items-center justify-center gap-4 rounded-[7px] border border-[#b8a1ff]/25 bg-[#a997ff] px-6 text-[15px] font-semibold text-[#050713]">
            Start Building
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="#architecture" className="inline-flex h-12 min-w-64 items-center justify-center gap-3 rounded-[7px] border border-white/16 bg-[#050b16]/65 px-6 text-[15px] font-semibold text-white">
            <SquareTerminal className="h-4 w-4" />
            Open Architecture Cockpit
          </Link>
        </div>
        <div className="mx-auto mt-6 grid max-w-[980px] grid-cols-5 rounded-[8px] border border-white/10 bg-[#050d18]/70 max-lg:grid-cols-2 max-sm:grid-cols-1">
          {[
            ['Local-first friendly', Code2, 'violet'],
            ['PostgreSQL-backed', Database, 'cyan'],
            ['Provider-flexible', Route, 'blue'],
            ['Quality-gated', ShieldCheck, 'amber'],
            ['Source-backed', FileCheck2, 'rose'],
          ].map(([label, Icon, tone]) => (
            <div key={String(label)} className="flex items-center justify-center gap-2.5 border-r border-white/10 px-4 py-3 text-[12px] last:border-r-0">
              <Icon className={cx('h-4 w-4', toneClass[tone as Tone].text)} />
              {label}
            </div>
          ))}
        </div>
        <div className="mx-auto mt-7 rounded-[10px] border border-white/10 bg-[#050d18]/70 p-4">
          <div className="grid grid-cols-5 items-center gap-3 max-xl:grid-cols-1">
            {ribbon.map(([title, subtitle, Icon, tone], index) => (
              <div key={title} className="relative flex items-center gap-3 rounded-[7px] border border-white/[0.07] bg-white/[0.03] p-3 text-left">
                {index < ribbon.length - 1 && <ArrowRight className="absolute -right-5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400 max-xl:hidden" />}
                <ToneIcon icon={Icon} tone={tone} />
                <div>
                  <div className="text-[13px] font-semibold text-white">{title}</div>
                  <div className="mt-0.5 text-[11px] text-slate-400">{subtitle}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <footer className="relative mt-10 border-t border-white/10 px-5 py-6">
        <div className="mx-auto flex max-w-[1780px] items-center justify-between gap-5 max-md:flex-col">
          <Link href="/" className="flex items-center gap-3">
            <span className="grid h-10 w-10 place-items-center rounded-[8px] border border-[#b8a1ff]/45 bg-[#9b7cf6]/10">
              <PlaygroundLogo className="h-6 w-6 text-[#d8ccff]" />
            </span>
            <span className="text-[15px] font-semibold">Agent Playground</span>
          </Link>
          <div className="flex flex-wrap justify-center gap-7 text-[13px] text-slate-300">
            <Link href="/agents">Agents</Link>
            <Link href="/dashboard">Dashboard</Link>
            <Link href="/simulation">Arena</Link>
            <Link href="#workflow">Docs</Link>
            <Link href="https://github.com">GitHub</Link>
          </div>
          <div className="flex items-center gap-2 text-[13px] text-slate-300">
            Inspectable Agent OS
            <span className="grid h-5 w-5 place-items-center rounded-full bg-white/8"><span className="h-2 w-2 rounded-full bg-[#49d581]" /></span>
          </div>
        </div>
      </footer>
    </section>
  )
}

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#020713] text-white">
      <HeroSection />
      <ArchitectureCockpit />
      <WorkflowStory />
      <FinalCta />
    </div>
  )
}
