'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { motion } from 'framer-motion'
import {
  ArrowRight,
  Bot,
  Brain,
  Heart,
  Library,
  Network,
  Search,
  Sparkles,
  Star,
  Users,
  Workflow,
  type LucideIcon,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'

const headerLinks = [
  { href: '#workflow', label: 'Workflow' },
  { href: '#feature-showcase', label: 'Showcase' },
  { href: '#voices', label: 'Voices' },
  { href: '/agents', label: 'Agents' },
]

const railTabs = [
  'Hero Story',
  'Agent Memory',
  'Emotion Engine',
  'Relationship Atlas',
  'Simulation Lab',
  'Planning Loop',
  'Knowledge Layer',
]

const showcaseNavLinks = ['Identity', 'Memory', 'Emotion', 'Relationships', 'Planning', 'Simulation']

const showcaseSignals = [
  {
    label: 'Memory graph',
    detail: '42 retained decisions',
  },
  {
    label: 'Emotion trace',
    detail: 'Confidence rising',
  },
  {
    label: 'Shared knowledge',
    detail: '7 promoted insights',
  },
]

const heroCards: Array<{
  title: string
  description: string
  icon: LucideIcon
  span?: string
}> = [
  {
    title: 'Identity + memory',
    description: 'Build a believable agent and persist what matters across sessions.',
    icon: Brain,
    span: 'lg:col-span-5 lg:row-span-2',
  },
  {
    title: 'Emotion engine',
    description: 'Track emotional drift so tone changes are visible, not accidental.',
    icon: Heart,
    span: 'lg:col-span-3',
  },
  {
    title: 'Simulation lab',
    description: 'Run multi-agent debates, planning sessions, and collaboration loops.',
    icon: Users,
    span: 'lg:col-span-4',
  },
  {
    title: 'Relationship atlas',
    description: 'Inspect trust, friction, and evolving social state between agents.',
    icon: Network,
    span: 'lg:col-span-3',
  },
  {
    title: 'Knowledge layer',
    description: 'Promote conclusions into reusable shared knowledge instead of losing them in chat.',
    icon: Library,
    span: 'lg:col-span-4',
  },
]

const audience = [
  'Founders',
  'AI product teams',
  'Design engineers',
  'Research workflows',
  'Developer tooling',
  'Experimental teams',
]

const workflowPanels = [
  {
    title: 'Identity builder',
    text: 'Define personality, goals, tone, and constraints before the first conversation.',
    offset: 'left-0 top-16 -rotate-6',
  },
  {
    title: 'Simulation room',
    text: 'Stress-test ideas with multiple agents in one shared context.',
    offset: 'left-1/2 top-0 z-10 w-[min(100%,34rem)] -translate-x-1/2',
  },
  {
    title: 'Inspectable systems',
    text: 'Surface memory, planning, knowledge, and relationship state after every run.',
    offset: 'right-0 top-20 rotate-6',
  },
]

const voices = [
  {
    name: 'Founding PM',
    handle: '@agent-launch',
    quote:
      'This is the first version of the product where the agent feels like it has a life outside the current prompt.',
  },
  {
    name: 'Design Engineer',
    handle: '@state-visible',
    quote:
      'Memory, emotion, and trust are visible enough here that behavior can be explained instead of hand-waved.',
  },
  {
    name: 'Research Workflow',
    handle: '@multi-session',
    quote:
      'The real value is continuity. We can observe development over time instead of getting one-shot outputs.',
  },
  {
    name: 'AI Product Team',
    handle: '@agent-stack',
    quote:
      'Creation, workspace, simulation, and knowledge finally read as one story rather than disconnected features.',
  },
  {
    name: 'Developer Tooling',
    handle: '@inspectable-ai',
    quote:
      'The moving parts are visible. You can reason about agent behavior without pretending the black box is magic.',
  },
  {
    name: 'Experimental Team',
    handle: '@future-branches',
    quote:
      'Planning and relationship layers make scenario testing feel like a real product capability.',
  },
]

function BrowserChrome({ tabs }: { tabs: string[] }) {
  return (
    <div className="flex items-center gap-4 border-b border-white/10 px-4 py-3">
      <div className="flex items-center gap-2">
        <span className="h-3 w-3 rounded-full bg-[#ff5f57]" />
        <span className="h-3 w-3 rounded-full bg-[#febc2e]" />
        <span className="h-3 w-3 rounded-full bg-[#28c840]" />
      </div>

      <div className="relative flex-1 overflow-hidden">
        <motion.div
          animate={{ x: ['0%', '-50%'] }}
          transition={{ duration: 28, repeat: Infinity, ease: 'linear' }}
          className="flex min-w-max gap-2"
        >
          {[...tabs, ...tabs].map((tab, index) => (
            <span
              key={`${tab}-${index}`}
              className="rounded-full border border-white/8 bg-white/[0.03] px-3 py-1.5 text-xs font-medium text-white/45"
            >
              {tab}
            </span>
          ))}
        </motion.div>
      </div>
    </div>
  )
}

function BrowserShell({
  tabs,
  children,
  className,
}: {
  tabs: string[]
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={cn(
        'overflow-hidden rounded-[2rem] border border-white/10 bg-[#121118]/95 shadow-[0_40px_120px_-70px_rgba(0,0,0,0.9)]',
        className
      )}
    >
      <BrowserChrome tabs={tabs} />
      <div className="p-4 sm:p-5">{children}</div>
    </div>
  )
}

function ShowcaseCard({
  icon: Icon,
  title,
  description,
  className,
}: {
  icon: LucideIcon
  title: string
  description: string
  className?: string
}) {
  return (
    <div
      className={cn(
        'rounded-[1.6rem] border border-white/10 bg-[linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] p-5',
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/10 bg-white/[0.04] text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-16 text-2xl font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-4 max-w-sm text-sm leading-7 text-white/58">{description}</p>
    </div>
  )
}

function WorkflowShot({
  title,
  text,
  offset,
}: {
  title: string
  text: string
  offset: string
}) {
  return (
    <div className={cn('absolute w-[min(100%,26rem)]', offset)}>
      <BrowserShell tabs={['Agent Playground', 'Live System', 'Memory']}>
        <div className="space-y-4 rounded-[1.5rem] border border-white/8 bg-[#0d0c11]/90 p-4">
          <div className="text-[11px] font-semibold uppercase tracking-[0.28em] text-primary/90">{title}</div>
          <div className="text-sm leading-7 text-white/80">{text}</div>
          <div className="grid gap-3">
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/72">
              Persistent memory trails
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/72">
              Emotional and social state
            </div>
            <div className="rounded-2xl border border-white/8 bg-white/[0.03] px-4 py-3 text-sm text-white/72">
              Inspectable planning and knowledge
            </div>
          </div>
        </div>
      </BrowserShell>
    </div>
  )
}

function VoiceCard({
  name,
  handle,
  quote,
  index,
}: {
  name: string
  handle: string
  quote: string
  index: number
}) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 20 }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.3 }}
      transition={{ delay: index * 0.05, duration: 0.45 }}
      className="break-inside-avoid rounded-[1.6rem] border border-white/10 bg-[#101014] p-5 shadow-[0_28px_70px_-54px_rgba(0,0,0,0.85)]"
    >
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 items-center justify-center rounded-full bg-white/[0.06] text-sm font-semibold text-white/92">
          {name
            .split(' ')
            .map((part) => part[0])
            .join('')
            .slice(0, 2)}
        </div>
        <div>
          <div className="text-sm font-semibold text-white/92">{name}</div>
          <div className="text-xs text-white/50">{handle}</div>
        </div>
      </div>
      <p className="mt-4 text-sm leading-7 text-white/72">{quote}</p>
    </motion.article>
  )
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#05060a] text-white">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_8%,rgba(155,126,235,0.16),transparent_24%),radial-gradient(circle_at_80%_14%,rgba(109,182,215,0.1),transparent_22%),radial-gradient(circle_at_50%_36%,rgba(240,137,182,0.06),transparent_28%)]" />
      <div className="pointer-events-none absolute inset-0 bg-grid-pattern opacity-20" />

      <div className="relative z-10 border-b border-blue-300/25 bg-[linear-gradient(90deg,#4c83ff,#7aa3ff,#4c83ff)] px-4 py-2 text-center text-xs font-semibold text-white">
        Launch week: build memory-rich agent products with personality, simulation, and inspectable state.
      </div>

      <header className="relative z-10 border-b border-white/8 bg-[#05060a]/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[92rem] items-center gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.06] text-white">
              <Bot className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold tracking-tight text-white">Agent Playground</span>
          </Link>

          <nav className="hidden items-center gap-8 text-sm font-medium text-white/56 lg:flex">
            {headerLinks.map((item) => (
              <Link key={item.href} href={item.href} className="transition-colors hover:text-white/92">
                {item.label}
              </Link>
            ))}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <div className="hidden h-10 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-3 text-sm text-white/50 lg:inline-flex">
              <Search className="h-4 w-4" />
              <span>Search</span>
              <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[11px] text-white/38">⌘K</span>
            </div>
            <ThemeToggle />
            <Link href="/dashboard" className="hidden text-sm font-medium text-white/56 transition-colors hover:text-white/92 md:inline-flex">
              Dashboard
            </Link>
            <Link
              href="/agents/new"
              className="inline-flex h-11 items-center gap-2 rounded-xl bg-white px-4 text-sm font-semibold text-[#111018] shadow-[0_12px_30px_-18px_rgba(255,255,255,0.55)] transition-transform hover:-translate-y-0.5"
            >
              Create Agent
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </header>

      <main className="relative z-10">
        <section className="px-4 pb-12 pt-14 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-[92rem]">
            <div className="grid gap-14 lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/68">
                  <Sparkles className="h-4 w-4 text-primary" />
                  Personality, memory, emotion, and simulation in one platform.
                </div>

                <h1 className="mt-8 max-w-4xl text-[clamp(3.7rem,9vw,6.8rem)] font-semibold leading-[0.93] tracking-[-0.065em] text-white">
                  Build agents that remember, feel, and evolve together.
                </h1>

                <p className="mt-6 max-w-3xl text-lg leading-8 text-white/56 sm:text-xl">
                  Create believable AI personalities, give them long-term memory, emotional state, relationships,
                  journals, plans, and shared knowledge, then run scenarios that actually explain what changed.
                </p>

                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <Link
                    href="/agents/new"
                    className="inline-flex h-14 items-center justify-center gap-2 rounded-xl bg-white px-6 text-base font-semibold text-[#111018] transition-transform hover:-translate-y-0.5"
                  >
                    Start Building
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                  <Link
                    href="#workflow"
                    className="inline-flex h-14 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-base font-semibold text-white/78 transition-colors hover:bg-white/[0.06]"
                  >
                    See Workflow
                  </Link>
                </div>
              </div>

              <div className="flex flex-col gap-6 lg:pt-24">
                <div className="text-sm leading-8 text-white/60">
                  Trusted by founders, product teams, design engineers, and creators building agent-native workflows.
                </div>
                <div className="flex items-center gap-4">
                  <div className="flex -space-x-3">
                    {['MS', 'NV', 'AC', 'LP', 'OS'].map((item) => (
                      <div
                        key={item}
                        className="flex h-12 w-12 items-center justify-center rounded-full border border-[#05060a] bg-white/[0.1] text-sm font-semibold text-white/90"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                  <div className="flex items-center gap-1 text-amber-300">
                    {Array.from({ length: 5 }).map((_, index) => (
                      <Star key={index} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                </div>
              </div>
            </div>

            <div id="feature-showcase" className="mt-16">
              <BrowserShell tabs={railTabs}>
                <div className="overflow-hidden rounded-[1.7rem] border border-white/8 bg-[#0b0a10]/95">
                  <div className="flex flex-wrap items-center gap-4 border-b border-white/8 px-4 py-4 sm:px-5">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-white/[0.05] text-white">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <div className="text-sm font-semibold text-white/92">Agent Playground</div>
                        <div className="text-[11px] uppercase tracking-[0.24em] text-white/35">Inside the system</div>
                      </div>
                    </div>

                    <nav className="hidden flex-1 items-center justify-center gap-6 lg:flex">
                      {showcaseNavLinks.map((item) => (
                        <span key={item} className="text-sm font-medium text-white/52">
                          {item}
                        </span>
                      ))}
                    </nav>

                    <div className="ml-auto flex items-center gap-3">
                      <span className="hidden text-sm font-medium text-white/48 sm:inline-flex">Open workspace</span>
                      <span className="inline-flex h-10 items-center rounded-xl bg-white px-4 text-sm font-semibold text-[#111018]">
                        Enter Agent
                      </span>
                    </div>
                  </div>

                  <div className="grid gap-10 px-4 py-8 sm:px-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
                    <div className="max-w-3xl">
                      <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm text-white/62">
                        <Sparkles className="h-4 w-4 text-primary" />
                        Inside the container, the product tells its own story.
                      </div>

                      <h2 className="mt-6 max-w-3xl text-[clamp(2.7rem,6vw,4.6rem)] font-semibold leading-[0.95] tracking-[-0.05em] text-white">
                        Every feature becomes a page in the same agent narrative.
                      </h2>

                      <p className="mt-5 max-w-2xl text-base leading-8 text-white/56 sm:text-lg">
                        Identity creation leads into memory, emotion, relationships, planning, and simulation.
                        The container is no longer just a screenshot frame. It now behaves like a mini product site.
                      </p>

                      <div className="mt-7 flex flex-col gap-3 sm:flex-row">
                        <Link
                          href="/agents/new"
                          className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-5 text-sm font-semibold text-[#111018]"
                        >
                          Create Agent
                          <ArrowRight className="h-4 w-4" />
                        </Link>
                        <Link
                          href="/simulation"
                          className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-5 text-sm font-semibold text-white/76"
                        >
                          Run Simulation
                        </Link>
                      </div>
                    </div>

                    <div className="space-y-3">
                      {showcaseSignals.map((item) => (
                        <div
                          key={item.label}
                          className="rounded-[1.3rem] border border-white/8 bg-white/[0.03] px-4 py-4"
                        >
                          <div className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/90">
                            {item.label}
                          </div>
                          <div className="mt-2 text-sm text-white/72">{item.detail}</div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="border-t border-white/8 p-4 sm:p-5">
                    <div className="grid gap-4 lg:grid-cols-12">
                      {heroCards.map((card) => (
                        <ShowcaseCard
                          key={card.title}
                          icon={card.icon}
                          title={card.title}
                          description={card.description}
                          className={card.span}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              </BrowserShell>
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.32em] text-primary">Used by teams exploring AI systems</div>
            <h2 className="mt-5 text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
              One product story from identity to simulation.
            </h2>
            <p className="mx-auto mt-5 max-w-3xl text-base leading-8 text-white/56 sm:text-lg">
              The page now follows the same rhythm as the reference, but maps the story directly to Agent Playground.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              {audience.map((item) => (
                <span
                  key={item}
                  className="rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/72"
                >
                  {item}
                </span>
              ))}
            </div>
          </div>
        </section>

        <section id="workflow" className="px-4 py-12 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-7xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="text-sm font-semibold uppercase tracking-[0.32em] text-primary">Idea to agent system in hours</div>
              <h2 className="mt-5 text-[clamp(2.6rem,5vw,4.3rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
                Create, test, and inspect in one pass.
              </h2>
              <p className="mt-5 text-base leading-8 text-white/56 sm:text-lg">
                The middle section now behaves more like the Aceternity showcase montage instead of a stack of isolated cards.
              </p>
            </div>

            <div className="relative mt-16 min-h-[40rem] overflow-hidden rounded-[2rem] border border-white/8 bg-[radial-gradient(circle_at_center,rgba(155,126,235,0.1),transparent_36%),linear-gradient(180deg,rgba(255,255,255,0.02),rgba(255,255,255,0.01))] px-4 py-10 sm:px-6">
              <div className="absolute inset-0 bg-grid-pattern opacity-20" />
              {workflowPanels.map((panel) => (
                <WorkflowShot key={panel.title} {...panel} />
              ))}
            </div>
          </div>
        </section>

        <section id="voices" className="px-4 py-24 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl">
            <div className="mx-auto max-w-3xl text-center">
              <div className="text-sm font-semibold uppercase tracking-[0.32em] text-primary">Loved by teams building agent workflows</div>
              <h2 className="mt-5 text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-white">
                The system matters when people can understand what it is doing.
              </h2>
              <p className="mt-5 text-base leading-8 text-white/56 sm:text-lg">
                This keeps the testimonial-style section, but grounds it in the actual teams this product is built for.
              </p>
            </div>

            <div className="mt-12 columns-1 gap-5 md:columns-2 xl:columns-3">
              {voices.map((voice, index) => (
                <div key={voice.handle} className="mb-5">
                  <VoiceCard {...voice} index={index} />
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="px-4 pb-10 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-5xl rounded-[1.8rem] border border-white/10 bg-[#101014] px-6 py-8 text-center shadow-[0_28px_80px_-56px_rgba(0,0,0,0.85)]">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.03] px-4 py-2 text-sm font-medium text-white/74">
              <Workflow className="h-4 w-4 text-primary" />
              Product story aligned
            </div>
            <h2 className="mt-5 text-3xl font-semibold tracking-[-0.04em] text-white sm:text-4xl">
              Enter the workspace and keep the same narrative going.
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base leading-8 text-white/56">
              The landing page now follows the reference structure more closely: hero first, showcase second, proof and voices after.
            </p>
            <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
              <Link
                href="/dashboard"
                className="inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-white px-6 text-sm font-semibold text-[#111018] transition-transform hover:-translate-y-0.5"
              >
                Open Dashboard
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/simulation"
                className="inline-flex h-12 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] px-6 text-sm font-semibold text-white/78 transition-colors hover:bg-white/[0.05]"
              >
                Explore Simulation
              </Link>
            </div>
          </div>
        </section>
      </main>
    </div>
  )
}
