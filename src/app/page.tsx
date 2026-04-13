'use client'

import { useState, type ReactNode } from 'react'
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
  BookOpen,
  Database,
  MessageSquare,
  Activity,
  Github,
  Quote,
  type LucideIcon,
} from 'lucide-react'
import { ThemeToggle } from '@/components/theme-toggle'
import { cn } from '@/lib/utils'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'

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

function BentoGridSection() {
  return (
    <div className="mx-auto max-w-[120rem]">
      <h3 className="mb-8 max-w-sm pl-2 text-[clamp(2rem,3vw,2.4rem)] font-bold leading-[1.05] tracking-tight text-foreground sm:pl-0">
        Idea to agent <br /> in hours, <span className="text-primary">not days.</span>
        <p className="mt-5 text-sm font-medium leading-[1.6] text-muted-foreground sm:text-[15px]">
          As easy as copy-pasting. Build great looking swarms without worrying about infrastructure.
        </p>
      </h3>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[20rem_20rem_1fr_1fr]">
        <div className="flex flex-col gap-5 lg:col-span-1">
          <div className="relative flex flex-1 flex-col overflow-hidden rounded-sm border border-white/10 bg-black/20 backdrop-blur-md p-6 shadow-sm min-h-[36rem]">
            <div className="mb-8 flex items-center gap-2 text-foreground">
              <PlaygroundLogo className="h-7 w-7 text-primary" />
              <span className="font-bold tracking-tight">AgentStudio</span>
            </div>
            <h4 className="mb-6 text-[1.4rem] font-bold tracking-tight text-foreground">Sign up for an account</h4>

            <div className="relative z-10 space-y-5">
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-muted-foreground">Full name</label>
                <div className="flex h-12 w-full items-center rounded-sm border border-border/50 bg-background/50 px-3 text-sm text-muted-foreground shadow-sm">
                  Manu Arora
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-muted-foreground">Email address</label>
                <div className="flex h-12 w-full items-center rounded-sm border border-border/50 bg-background/50 px-3 text-sm text-muted-foreground shadow-sm">
                  hello@johndoe.com
                </div>
              </div>
              <div>
                <label className="mb-2 block text-xs font-semibold tracking-wide text-muted-foreground">Password</label>
                <div className="flex w-full items-center rounded-sm border border-border/50 bg-background/50 px-3 py-3 text-sm text-muted-foreground tracking-widest shadow-sm">
                  ••••••••••••••
                </div>
              </div>

              <button className="mt-4 w-full rounded-sm bg-primary py-3.5 text-sm font-bold text-primary-foreground shadow-sm shadow-primary/20 transition-transform hover:-translate-y-0.5">
                Sign Up
              </button>

              <div className="mt-4 text-center text-[12px] text-muted-foreground">
                Already have an account? <span className="cursor-pointer font-medium text-foreground hover:underline">Sign in</span>
              </div>

              <div className="relative my-6 opacity-60">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border/50" />
                </div>
                <div className="relative flex justify-center text-[10px] uppercase tracking-wider">
                  <span className="bg-card px-2 text-muted-foreground">Or continue with</span>
                </div>
              </div>

              <button className="flex w-full items-center justify-center gap-2 rounded-sm bg-foreground py-3.5 text-sm font-bold text-background shadow-sm transition-transform hover:-translate-y-0.5">
                <Github className="h-4 w-4" /> Github
              </button>

              <p className="mt-6 px-2 text-center text-[10px] leading-relaxed text-muted-foreground/60">
                By clicking on sign up, you agree to our Terms of Service and Privacy Policy
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-1">
          <div className="relative flex min-h-[22rem] flex-col overflow-hidden rounded-sm border border-white/10 bg-black/20 backdrop-blur-md p-6 shadow-sm">
            <h4 className="relative z-10 text-[1.1rem] font-semibold tracking-tight text-foreground">Hosting over the edge</h4>
            <p className="relative z-10 mt-2 w-[90%] text-[13px] leading-[1.6] text-muted-foreground">
              With our edge network, we host your swarm by pushing agents to every endpoint natively.
            </p>

            <div className="absolute -bottom-16 -left-12 flex h-[20rem] w-[140%] flex-col items-center overflow-hidden rounded-sm border border-border/50 bg-[#0A0A0C] pt-6 shadow-2xl">
              <div className="absolute inset-0 flex items-center justify-center">
                <Network className="h-28 w-28 text-primary/40 opacity-70" />
              </div>
              <div className="absolute top-1/4 h-3 w-3 animate-ping rounded-full bg-primary" />
              <div className="absolute bottom-1/4 left-1/4 h-2 w-2 animate-ping rounded-full bg-accent delay-300" />
            </div>
          </div>

          <div className="flex flex-1 flex-col rounded-sm border border-white/10 bg-black/20 backdrop-blur-md p-6 shadow-sm">
            <Quote className="mb-4 h-6 w-6 text-muted-foreground/30 fill-current" />
            <p className="flex-1 pt-1 text-[15px] font-medium leading-relaxed text-foreground">
              &quot;A robust solution that fits perfectly into our workflow. It has enhanced our team&apos;s capabilities and allowed us to tackle more complex multi-agent projects.&quot;
            </p>
            <div className="mt-6 flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-bold text-muted-foreground">
                FM
              </div>
              <div className="flex flex-col">
                <span className="mb-0.5 cursor-default text-sm font-semibold leading-none text-foreground">Frank Moore</span>
                <span className="text-[12px] text-muted-foreground">Project Manager</span>
              </div>
            </div>
          </div>

          <div className="relative flex h-36 flex-col justify-end overflow-hidden rounded-sm border border-white/10 bg-black/20 backdrop-blur-md p-6 shadow-sm">
            <div className="absolute inset-x-0 bottom-0 h-3/4 bg-grid-pattern opacity-40 mix-blend-overlay" />
            <div className="relative z-10 w-fit -rotate-3 self-center rounded-sm border border-border/50 bg-[#0a0a0c] px-4 py-2 text-center text-sm font-bold text-white shadow-xl dark:bg-zinc-800">
              Jane Smith
              <span className="block text-[11px] font-normal text-white/50">Data Scientist</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-5 lg:col-span-2">
          <div className="group relative flex h-[34rem] flex-col overflow-hidden rounded-sm border border-white/10 bg-black/20 backdrop-blur-md p-8 shadow-inner sm:p-10 dark:bg-zinc-900/10">
            <div className="relative z-10 mb-8 flex w-full max-w-3xl items-center justify-between">
              <span className="flex items-center gap-2 text-sm font-medium text-white/90">
                <PlaygroundLogo className="h-5 w-5 text-primary" /> Agent Playground
              </span>
              <div className="hidden items-center gap-6 text-[13px] text-white/60 sm:flex">
                <span className="cursor-pointer hover:text-white">Features <span className="text-[9px] opacity-50">▼</span></span>
                <span className="cursor-pointer hover:text-white">Pricing</span>
                <span className="cursor-pointer hover:text-white">Blog</span>
              </div>
              <div className="flex items-center gap-4 text-[13px]">
                <span className="hidden cursor-pointer text-white hover:text-white/70 sm:block">Sign in</span>
                <button className="rounded-sm bg-primary px-4 py-2 font-medium text-primary-foreground shadow-sm transition-transform hover:-translate-y-0.5">
                  Get started
                </button>
              </div>
            </div>

            <div className="relative z-10 mb-6 flex w-fit cursor-pointer items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-[11px] font-medium text-white/70 transition-colors hover:bg-white/10">
              Read our Series A funding round <span className="text-white/40">→</span>
            </div>

            <div className="relative z-10 grid max-w-[85%] grid-cols-1 gap-8 md:max-w-none md:grid-cols-[1fr_20rem]">
              <h2 className="text-[2.2rem] font-semibold leading-[1.05] tracking-tight text-[var(--color-pastel-blue)] lg:text-[2.8rem]">
                Create the best <br /> agent systems today.
              </h2>
              <div className="flex flex-col md:text-right">
                <p className="text-[14px] leading-relaxed text-white/50">
                  Our platform visualizes trust and memory between agents, so you can build teams that actually work together.
                </p>
                <div className="mt-5 flex gap-3 md:justify-end">
                  <button className="rounded-sm bg-primary px-5 py-2.5 text-[13px] font-semibold text-primary-foreground shadow-sm">
                    Get started
                  </button>
                  <button className="rounded-sm border border-white/10 bg-white/5 px-5 py-2.5 text-[13px] font-semibold text-white transition-colors hover:bg-white/10">
                    Sign in
                  </button>
                </div>
              </div>
            </div>

            <div className="absolute bottom-[-10%] left-6 right-0 top-[22rem] flex flex-col overflow-hidden rounded-tl-2xl bg-primary/80 p-4 shadow-2xl transition-transform duration-500 group-hover:-translate-y-2 sm:left-10 lg:-right-4 lg:p-6">
              <div className="flex h-full w-full flex-col overflow-hidden rounded-sm bg-card shadow-xl border border-white/20">
                <div className="flex h-9 items-center border-b border-border/30 bg-muted/30 px-3 opacity-90">
                  <div className="flex gap-1.5">
                    <div className="h-2.5 w-2.5 rounded-full bg-rose-400" />
                    <div className="h-2.5 w-2.5 rounded-full bg-amber-400" />
                    <div className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
                  </div>
                  <div className="ml-4 flex items-center gap-1.5 rounded-md border border-border/50 bg-background px-3 py-1 text-[10px] text-muted-foreground shadow-sm">
                    <span className="opacity-50">🔒</span> playground.dev
                  </div>
                </div>
                <div className="flex flex-1 gap-3 overflow-hidden bg-background p-3 opacity-95">
                  <div className="hidden w-12 flex-col items-center gap-4 border-r border-border/30 py-2 sm:flex">
                    <div className="h-6 w-6 rounded-md bg-primary/20" />
                    <div className="h-4 w-4 rounded bg-muted-foreground/20" />
                    <div className="h-4 w-4 rounded bg-muted-foreground/20" />
                  </div>
                  <div className="flex flex-1 flex-col rounded-sm border border-border/40 bg-card p-2 shadow-sm">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Agents <span className="ml-1 rounded bg-muted px-1">4</span></div>
                    <div className="mb-2 rounded-md border border-border/30 bg-muted/40 p-2">
                      <div className="mb-2 h-2 w-16 rounded-full bg-primary/60" />
                      <div className="mb-1 h-2 w-full rounded-full bg-muted-foreground/20" />
                      <div className="h-2 w-2/3 rounded-full bg-muted-foreground/20" />
                    </div>
                    <div className="rounded-md border border-border/30 bg-muted/40 p-2">
                      <div className="mb-2 h-2 w-10 rounded-full bg-amber-400/60" />
                      <div className="h-2 w-full rounded-full bg-muted-foreground/20" />
                    </div>
                  </div>
                  <div className="flex flex-1 flex-col rounded-sm border border-border/40 bg-card p-2 shadow-sm">
                    <div className="mb-2 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">Active <span className="ml-1 rounded bg-muted px-1">1</span></div>
                    <div className="relative overflow-hidden rounded-md border border-primary/20 bg-primary/5 p-2 mb-2 shadow-sm">
                      <div className="absolute bottom-0 left-0 top-0 w-0.5 bg-primary" />
                      <div className="mb-2 h-2 w-12 rounded-full bg-primary" />
                      <div className="mb-1.5 h-2 w-11/12 rounded-full bg-foreground/30" />
                      <div className="mb-3 h-2 w-4/5 rounded-full bg-foreground/30" />
                      <div className="flex items-center justify-between">
                        <div className="flex -space-x-1">
                          <div className="h-3 w-3 rounded-full border border-background bg-muted-foreground/40" />
                          <div className="h-3 w-3 rounded-full border border-background bg-muted-foreground/60" />
                        </div>
                        <div className="text-[8px] text-muted-foreground uppercase opacity-80">Synchronized</div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-1 grid-cols-1 flex-col gap-5 sm:grid sm:grid-cols-2">
            <div className="flex flex-col gap-5">
              <div className="relative flex min-h-[16rem] flex-1 flex-col items-center justify-center overflow-hidden rounded-sm border border-white/10 bg-black/20 backdrop-blur-md p-6 shadow-sm dark:bg-zinc-900/10">
                <div className="relative z-10 mb-8 mt-2 text-center">
                  <h4 className="mb-1 text-[1.1rem] font-bold tracking-tight text-white">All over the world</h4>
                  <p className="text-[12px] text-white/50">Meet our distributed agent network.</p>
                </div>

                <div className="absolute -bottom-8 flex w-full justify-center">
                  <div className="relative flex h-32 w-64 justify-center bg-primary/10">
                    <div className="absolute top-4 h-full w-full rounded-sm border-t border-primary/20 opacity-60" />
                    <div className="absolute top-8 h-full w-[80%] rounded-sm border-t border-primary/20 opacity-40" />
                    <div className="absolute top-12 h-full w-[60%] rounded-sm border-t border-primary/20 opacity-30" />

                    <div className="absolute left-8 top-3 flex h-5 w-5 items-center justify-center rounded-full bg-primary/20">
                      <div className="h-1.5 w-1.5 animate-ping rounded-full bg-primary" />
                    </div>
                    <div className="absolute left-1/2 top-10 flex h-5 w-5 items-center justify-center rounded-full bg-[var(--gradient-5)]/20">
                      <div className="h-1.5 w-1.5 animate-ping rounded-full bg-[var(--gradient-5)]" />
                    </div>
                    <div className="absolute right-10 top-5 flex h-5 w-5 items-center justify-center rounded-full bg-accent/20">
                      <div className="h-1.5 w-1.5 animate-ping rounded-full bg-accent" />
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex-1 rounded-sm border border-white/10 bg-black/20 backdrop-blur-md p-6 shadow-sm">
                <h4 className="mb-1 text-[1.1rem] font-semibold tracking-tight text-foreground">Schedule seamlessly</h4>
                <p className="mb-6 w-10/12 text-[13px] leading-relaxed text-muted-foreground">Let orchestrated jobs take over complex workflows.</p>

                <div className="mt-6 flex w-full justify-start px-2 gap-2">
                  <div className="z-20 -mr-4 h-12 w-12 overflow-hidden rounded-full border-[3px] border-card bg-muted shadow-sm">
                    <div className="h-full w-full bg-amber-400" />
                  </div>
                  <div className="z-10 -mr-4 h-12 w-12 overflow-hidden rounded-full border-[3px] border-card bg-muted shadow-sm">
                    <div className="h-full w-full bg-purple-400" />
                  </div>
                  <div className="z-0 h-12 w-12 overflow-hidden rounded-full border-[3px] border-card bg-muted shadow-sm">
                    <div className="h-full w-full bg-rose-400" />
                  </div>
                </div>
              </div>
            </div>

            <div className="relative flex h-full flex-col justify-end overflow-hidden rounded-sm border border-white/10 bg-black/20 backdrop-blur-md p-6 shadow-sm sm:p-8">
              <div className="absolute inset-0 z-0 bg-background/50">
                <div className="absolute right-[-20%] top-[-10%] h-[120%] w-[120%] origin-center rotate-12 scale-125 bg-muted/20 opacity-80 mix-blend-multiply blur-3xl dark:mix-blend-screen" />
              </div>

              <div className="relative z-10 mt-auto">
                <h4 className="mb-3 max-w-[200px] text-[2rem] font-bold leading-[1.05] tracking-tight text-[var(--color-pastel-green)] sm:text-[2.2rem]">
                  Inspect state at your fingertips
                </h4>
                <p className="max-w-[240px] text-[13px] leading-relaxed text-muted-foreground">
                  Create breathtaking agent-to-agent traces with analytics that understands your vision. Just define the constraints and let it run.
                </p>
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  )
}

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
        'overflow-hidden rounded-sm border border-white/10 bg-[#121118]/95 shadow-[0_40px_120px_-70px_rgba(0,0,0,0.9)]',
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
        'rounded-sm border border-white/10 bg-white/5 p-5',
        className
      )}
    >
      <div className="flex h-11 w-11 items-center justify-center rounded-sm border border-white/10 bg-white/[0.04] text-primary">
        <Icon className="h-5 w-5" />
      </div>
      <h3 className="mt-16 text-2xl font-semibold tracking-tight text-white">{title}</h3>
      <p className="mt-4 max-w-sm text-sm leading-7 text-white/58">{description}</p>
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
      className="break-inside-avoid rounded-sm border border-white/10 bg-[#101014] p-5 shadow-[0_28px_70px_-54px_rgba(0,0,0,0.85)]"
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

// --- VISUAL MOCKUPS (6 MAIN + 6 RAIL) ---

function LivePersonaComposerVisual() {
  return (
    <div className="flex flex-col h-full space-y-4">
      {/* Primary Action */}
      <div className="flex items-center gap-3 border-b border-border/20 pb-3">
        <div className="h-10 w-10 rounded-full border border-primary/30 bg-primary/10 flex items-center justify-center">
          <PlaygroundLogo className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1">
          <div className="flex items-center justify-between">
            <div className="text-[16px] font-bold text-foreground">Synthesis Agent</div>
            <span className="bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-mono text-[13px] px-1.5 py-0.5 rounded border border-emerald-500/20">Deployed</span>
          </div>
          <div className="flex gap-2 text-[16px] mt-1 text-muted-foreground font-mono">
            ID: AGT-992 • UPDATED: 2M AGO
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* Operational Metadata: Persona Spec Slab */}
        <div className="space-y-2 opacity-85">
          <div className="flex justify-between items-center text-[16px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">
            <span>Persona.yaml</span>
            <span className="text-[13px] bg-accent/20 text-accent px-1 rounded">Edited</span>
          </div>
          <div className="bg-card/70 dark:bg-[#0d0d12] border border-border/20 p-2 rounded text-[13px] text-muted-foreground font-mono leading-relaxed">
            <span className="text-rose-500 dark:text-rose-400">archetype:</span> <span className="text-foreground/70">&quot;Architect&quot;</span><br />
            <span className="text-rose-500 dark:text-rose-400">tone_weights:</span><br />
            &nbsp;&nbsp;<span className="text-[var(--gradient-5)]/80">assertive:</span> <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-400/10 transition-colors">0.85</span><br />
            &nbsp;&nbsp;<span className="text-[var(--gradient-5)]/80">warmth:</span> <span className="text-foreground/70">0.20</span><br />
            <span className="text-rose-500 dark:text-rose-400">max_tokens:</span> <span className="text-foreground/70">4096</span><br />
            <span className="text-rose-500 dark:text-rose-400">tools:</span> <span className="text-foreground/70">[&quot;fs&quot;, &quot;bash&quot;]</span>
          </div>
        </div>

        {/* Trait Topology radar/hex chart & Comparator */}
        <div className="space-y-3 flex flex-col justify-between">
          <div>
            <div className="text-[16px] font-semibold text-muted-foreground uppercase tracking-wider mb-2">Trait Topology</div>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-[13px]">
                <span className="text-foreground/80">Assertiveness</span>
                <span className="text-emerald-600 dark:text-emerald-400 font-mono">+4% <span className="text-muted-foreground">0.85</span></span>
              </div>
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden flex"><div className="h-full bg-primary w-[85%]" /></div>
              <div className="flex justify-between items-center text-[13px] mt-2">
                <span className="text-foreground/80">Warmth</span>
                <span className="text-rose-500 dark:text-rose-400 font-mono">-2% <span className="text-muted-foreground">0.20</span></span>
              </div>
              <div className="h-1 w-full bg-muted rounded-full overflow-hidden flex"><div className="h-full bg-[var(--gradient-5)] w-[20%]" /></div>
            </div>
          </div>

          {/* Metric Residue */}
          <div className="p-1.5 bg-surface border border-border/20 rounded flex justify-between text-[16px] font-mono text-muted-foreground">
            <span>LATENCY: +12ms</span>
            <span>TOKENS: ~840/req</span>
          </div>
        </div>
      </div>

      {/* Response Comparator */}
      <div className="mt-auto border-t border-border/20 pt-3 flex flex-col gap-2 opacity-85">
        <div className="text-[13px] font-semibold text-muted-foreground uppercase tracking-wider">Baseline vs Current Output</div>
        <div className="bg-muted/30 border-l-2 border-emerald-500/50 p-2 rounded-r text-[16px] text-foreground/70 leading-relaxed">
          &quot;We <del className="text-rose-500/70 dark:text-rose-400/70">could</del> <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-400/10">must</span> implement the Redis layer before auth. <span className="text-emerald-600 dark:text-emerald-400 bg-emerald-400/10 px-1">It is the most structurally sound path.</span>&quot;
        </div>
      </div>
    </div>
  )
}

function DecisionTraceVisual() {
  return (
    <div className="flex flex-col h-full space-y-3 relative">
      <div className="absolute top-0 right-0 text-[16px] font-mono text-muted-foreground bg-surface px-1 py-0.5 rounded border border-border/40">ID: TRC-9021</div>
      <div className="flex items-center gap-2 border-b border-border/20 pb-2">
        <Search className="h-3.5 w-3.5 text-accent" />
        <span className="text-[13px] font-bold text-foreground">Decision Provenance</span>
      </div>
      <div className="relative pl-3 border-l hover:border-accent/40 border-border/20 space-y-3 transition-colors">
        <div className="relative">
          <div className="absolute -left-[15.5px] top-1.5 h-1.5 w-1.5 rounded-full bg-muted-foreground" />
          <div className="text-[13px] text-muted-foreground font-mono mb-0.5">MEMORY USED • 12ms</div>
          <div className="text-[13px] font-medium text-foreground">Matched keyword: &quot;latency&quot;</div>
          <div className="text-[16px] text-muted-foreground font-mono mt-0.5 border border-border/20 inline-block px-1 rounded">MEM-442 • CONF: 0.94</div>
        </div>
        <div className="relative">
          <div className="absolute -left-[15.5px] top-1.5 h-1.5 w-1.5 rounded-full bg-[var(--gradient-5)]" />
          <div className="text-[13px] text-muted-foreground font-mono mb-0.5">EMOTION TRIGGER • 4ms</div>
          <div className="text-[13px] font-medium text-[var(--gradient-5)]">Frustration &gt; 40%</div>
          <div className="text-[16px] text-muted-foreground font-mono mt-0.5">Bypassed soft-consensus</div>
        </div>
        <div className="relative">
          <div className="absolute -left-[15.5px] top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
          <div className="text-[13px] text-primary font-mono font-bold mb-0.5">ACTION TAKEN • 84ms</div>
          <div className="text-[13px] font-medium text-foreground">Override PR #12 Rules</div>
        </div>
      </div>
    </div>
  )
}

function MemoryRetrievalVisual() {
  return (
    <div className="flex flex-col h-full space-y-3">
      {/* Metadata Header */}
      <div className="flex items-center justify-between border-b border-border/20 pb-2">
        <div className="text-[16px] font-mono text-muted-foreground">SCANNING NAMESPACE: <span className="text-primary">PROJECT_X</span></div>
        <div className="text-[13px] font-mono bg-border/40 px-1 py-0.5 rounded">VDB: ONLINE • 42ms</div>
      </div>

      <div className="bg-surface border border-border/40 p-2 rounded-sm text-[16px] text-foreground flex items-center gap-2 shadow-sm w-[60%]">
        <PlaygroundLogo className="h-4 w-4 text-muted-foreground" />
        &quot;What did we decide about caching?&quot;
      </div>

      {/* Candidate Table */}
      <div className="text-[13px] font-mono text-muted-foreground uppercase tracking-widest mt-2">Retrieval Candidates</div>
      <div className="flex flex-col gap-1">
        <div className="flex justify-between items-center p-1.5 border border-emerald-500/30 bg-emerald-500/5 rounded">
          <span className="text-[16px] font-semibold text-emerald-400">MEM-842</span>
          <span className="text-foreground text-[16px] truncate max-w-[60%]">Redis logic agreed...</span>
          <span className="text-emerald-500 font-bold text-[13px]">0.92</span>
        </div>
        <div className="flex justify-between items-center p-1.5 border border-border/20 bg-muted/20 rounded opacity-60">
          <span className="text-[16px]">MEM-112</span>
          <span className="text-[16px] truncate max-w-[60%]">Local storage debate</span>
          <span className="text-[13px]">0.64</span>
        </div>
      </div>

      {/* Quoted Evidence Stack */}
      <div className="flex-1 flex flex-col justify-end">
        <div className="bg-muted/40 border-l-2 border-primary p-2 rounded-r-lg text-[16px] text-foreground shadow-sm">
          <div className="text-[16px] font-mono text-primary mb-1">SOURCE: SESSION #44 • {new Date().toLocaleTimeString()}</div>
          &quot;We agreed to use <span className="bg-primary/20 text-primary px-0.5">Redis</span> for caching to <span className="bg-primary/20 text-primary px-0.5">minimize latency</span>.&quot;
        </div>
      </div>
    </div>
  )
}

function KnowledgePromotionVisual() {
  return (
    <div className="flex flex-col h-full space-y-3 relative">
      <div className="absolute top-0 right-0 text-[16px] font-mono text-muted-foreground">PIPELINE: ACTIVE</div>
      <div className="flex items-center gap-2 border-b border-border/20 pb-2">
        <BookOpen className="h-3.5 w-3.5 text-emerald-600 dark:text-emerald-400" />
        <span className="text-[13px] font-bold text-foreground">Knowledge Promotion</span>
      </div>
      <div className="flex flex-col justify-between flex-1">
        <div className="space-y-1">
          <div className="text-[13px] font-mono text-muted-foreground">RAW SNIPPET [ID: CHAT-90]</div>
          <div className="text-[16px] opacity-70 border border-transparent p-1.5 bg-muted/20 rounded">
            &quot;If we hit limits, let&apos;s backoff 5s.&quot;
          </div>
        </div>

        <div className="flex items-center gap-2 my-1">
          <ArrowRight className="h-3 w-3 text-border/60" />
          <div className="text-[16px] font-mono text-accent bg-accent/10 px-1 rounded border border-accent/20">SEMANTIC COMPRESSION • 142ms</div>
        </div>

        <div className="text-[13px] font-medium text-foreground bg-card/70 dark:bg-[#0d0d12] border border-emerald-500/20 p-2 rounded">
          <div className="flex justify-between mb-1">
            <span className="text-[16px] text-emerald-600 dark:text-emerald-400 font-mono">ENDORSED FACT</span>
            <span className="text-[16px] text-muted-foreground font-mono">CONTRA SCAN: PASS</span>
          </div>
          Global API Rate Limit Strategy: Linear backoff (5s base).
        </div>
      </div>
    </div>
  )
}

function EmotionWeatherVisual() {
  return (
    <div className="flex flex-col h-full space-y-2 pt-1 opacity-90">
      <div className="flex justify-between items-end border-b border-border/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="text-[16px] font-semibold text-foreground">Multi-Signal Drift</div>
          <span className="bg-surface border border-border/20 px-1 py-0.5 rounded text-[16px] font-mono text-muted-foreground">T-MINUS 1H</span>
        </div>
        <div className="text-[13px] font-mono text-emerald-600 dark:text-emerald-400 flex gap-2">
          <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-emerald-500/60 dark:bg-emerald-400" /> Conf</span>
          <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-rose-500/60 dark:bg-rose-400" /> Frust</span>
          <span className="flex items-center gap-1"><div className="w-2 h-0.5 bg-accent/60" /> Emp</span>
        </div>
      </div>

      {/* SVG Multi-line Graph */}
      <div className="relative flex-1 min-h-[90px] w-full flex items-center border-b border-border/10">
        <div className="absolute inset-0 flex items-center justify-between px-2">
          <div className="h-full w-px bg-border/20" />
          <div className="h-full w-px bg-border/20" />
          <div className="h-full w-px bg-border/20" />
          <div className="h-full w-px bg-border/20" />
        </div>

        <svg className="absolute inset-0 h-full w-full pointer-events-none drop-shadow-sm overflow-visible">
          {/* Confidence Band (Soft background) */}-+
          <path d="M 0 40 Q 50 20, 100 35 T 200 10 T 300 15 T 400 5" className="fill-emerald-500/5 dark:fill-emerald-400/[0.03]" />
          <path d="M 0 60 Q 50 80, 100 55 T 200 30 T 300 35 T 400 25" className="fill-emerald-500/5 dark:fill-emerald-400/[0.03]" />

          {/* Lines - drawn once, staying static */}
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            d="M 0 50 Q 50 10, 100 45 T 200 20 T 300 25 T 400 15" className="stroke-emerald-600 dark:stroke-emerald-400 stroke-[1.25px]" fill="none" />
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            d="M 0 80 Q 50 90, 100 70 T 200 85 T 300 60 T 400 75" className="stroke-rose-500/70 dark:stroke-rose-400/80 stroke-[1px] stroke-dasharray-[3_3]" fill="none" />
          <motion.path
            initial={{ pathLength: 0 }}
            animate={{ pathLength: 1 }}
            transition={{ duration: 1.5, ease: "easeOut" }}
            d="M 0 40 Q 50 60, 100 40 T 200 50 T 300 40 T 400 40" className="stroke-accent/60 stroke-[1px]" fill="none" />

          {/* Event Dots - breathing slowly */}
          <motion.circle animate={{ r: [2.5, 3.5, 2.5], opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} cx="100" cy="45" r="3" className="fill-emerald-500 dark:fill-emerald-400" />
          <motion.circle animate={{ r: [2.5, 3.5, 2.5], opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 1 }} cx="200" cy="85" r="3" className="fill-rose-500 dark:fill-rose-400" />
          <motion.circle animate={{ r: [2.5, 3.5, 2.5], opacity: [0.7, 1, 0.7] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut", delay: 2 }} cx="300" cy="25" r="3" className="fill-emerald-500 dark:fill-emerald-400" />
        </svg>
      </div>

      {/* Trigger Ribbon Residue */}
      <div className="flex gap-2 pb-1 opacity-75">
        <div className="flex-1 bg-surface border border-border/20 rounded p-1.5 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[16px] font-mono text-muted-foreground">11:42 • <span className="text-foreground/80">PR-18</span></span>
            <span className="text-[13px] text-rose-500 dark:text-rose-400">Syntax Error</span>
          </div>
          <span className="text-[13px] font-mono text-rose-600 dark:text-rose-400 bg-rose-500/10 dark:bg-rose-400/10 px-1 rounded">-12</span>
        </div>
        <div className="flex-1 bg-surface border border-border/20 rounded p-1.5 flex justify-between items-center">
          <div className="flex flex-col">
            <span className="text-[16px] font-mono text-muted-foreground">11:46 • <span className="text-foreground/80">TST-02</span></span>
            <span className="text-[13px] text-emerald-600 dark:text-emerald-400">Tests Pass</span>
          </div>
          <span className="text-[13px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 dark:bg-emerald-400/10 px-1 rounded">+24</span>
        </div>
      </div>
    </div>
  )
}

function JournalLedgerVisual() {
  return (
    <div className="flex flex-col h-full space-y-3 opacity-90">
      <div className="flex items-center justify-between border-b border-border/20 pb-2">
        <div className="flex items-center gap-2">
          <BookOpen className="h-3.5 w-3.5 text-[var(--gradient-5)]" />
          <span className="text-[13px] font-bold text-foreground">State Snapshot</span>
        </div>
        <span className="text-[16px] font-mono text-muted-foreground">SNAP-401A</span>
      </div>

      {/* State Snapshot Cluster */}
      <div className="grid grid-cols-2 gap-2 mb-1">
        <div className="bg-surface border border-border/20 p-1.5 rounded text-[13px]">
          <div className="text-muted-foreground uppercase tracking-widest text-[13px] mb-0.5">Dominant</div>
          <div className="text-emerald-600 dark:text-emerald-400 font-bold">Determined (88%)</div>
        </div>
        <div className="bg-surface border border-border/20 p-1.5 rounded text-[13px]">
          <div className="text-muted-foreground uppercase tracking-widest text-[13px] mb-0.5">Volatility</div>
          <div className="text-foreground/80 font-mono">Low (0.12)</div>
        </div>
      </div>

      <div className="space-y-2 flex-1">
        <div className="text-[13px] text-muted-foreground font-mono flex gap-2">
          <span>14:02:12</span>
          <span className="text-primary bg-primary/10 px-1 rounded">SELF_REFLECTION</span>
        </div>
        <div className="bg-card/70 dark:bg-[#0d0d12] border border-border/20 p-2.5 rounded text-[16px] text-foreground/80 border-l-2 border-[var(--gradient-5)] leading-relaxed">
          I initially thought caching was unnecessary, but the Planner&apos;s graph makes sense. I need to trust the external data map more.
        </div>
        <div className="flex items-center gap-1 text-[16px] text-emerald-600 dark:text-emerald-400 font-mono bg-emerald-400/10 w-fit px-1.5 py-0.5 rounded border border-emerald-500/10">
          <ArrowRight className="h-2 w-2" /> BELIEF_SHIFT_LOGGED
        </div>
      </div>
    </div>
  )
}

function RelationshipForceGraphVisual() {
  return (
    <div className="group relative h-full w-full min-h-[180px] flex items-center justify-center pt-2">
      {/* Edge Metrics Popover (Analytical data) */}
      <div className="absolute top-2 left-2 bg-card/90 dark:bg-[#0d0d12] border border-border/20 rounded-sm p-2 text-[13px] shadow-lg z-20 backdrop-blur-md opacity-100 pointer-events-none md:opacity-0 md:group-hover:opacity-100 scale-100 md:scale-95 md:group-hover:scale-100 transition-all duration-300">
        <div className="font-bold text-foreground mb-1 border-b border-border/20 pb-1">BOND: ARCH ↔ COD</div>
        <div className="grid grid-cols-2 gap-x-3 gap-y-1 font-mono text-foreground/75">
          <span>Trust:</span> <span className="text-emerald-600 dark:text-emerald-400">92</span>
          <span>Respect:</span> <span className="text-emerald-600 dark:text-emerald-400">81</span>
          <span>Friction:</span> <span className="text-rose-500 dark:text-rose-400">24</span>
          <span>Align:</span> <span className="text-foreground">77</span>
        </div>
        <div className="mt-1 pt-1 border-t border-border/20 text-muted-foreground text-[16px]">
          Last conflict: 18m ago • Decay: -1.2/d
        </div>
      </div>

      {/* Agents Nodes */}
      <div className="absolute top-[20%] right-[30%] flex flex-col items-center gap-1 z-10 transition-transform duration-300 md:group-hover:-translate-y-1">
        <div className="h-10 w-10 rounded-full border border-primary/40 bg-card flex items-center justify-center"><PlaygroundLogo className="h-4 w-4 text-primary" /></div>
        <span className="text-[13px] font-bold bg-background/50 backdrop-blur px-1 rounded text-foreground/90">Architect</span>

        {/* Interaction Residue */}
        <div className="absolute -right-16 top-0 bg-primary/10 border border-primary/20 text-primary px-1 py-0.5 rounded text-[13px] whitespace-nowrap hidden sm:block opacity-60">
          Shared insight
        </div>
      </div>

      <div className="absolute bottom-[10%] left-[20%] flex flex-col items-center gap-1 z-10 transition-transform duration-300 md:group-hover:translate-x-1">
        <div className="h-10 w-10 rounded-full border border-emerald-600/40 dark:border-emerald-400/40 bg-card flex items-center justify-center"><PlaygroundLogo className="h-4 w-4 text-emerald-600 dark:text-emerald-400" /></div>
        <span className="text-[13px] font-bold bg-background/50 backdrop-blur px-1 rounded text-foreground/90">Coder</span>

        <div className="absolute -left-16 bottom-0 bg-emerald-500/10 border border-emerald-500/20 text-emerald-600 dark:text-emerald-400 px-1 py-0.5 rounded text-[13px] whitespace-nowrap hidden sm:block opacity-60">
          Approved patch
        </div>
      </div>

      <div className="absolute bottom-[20%] right-[10%] flex flex-col items-center gap-1 z-10">
        <div className="h-10 w-10 rounded-full border border-border/40 bg-card flex items-center justify-center opacity-60"><PlaygroundLogo className="h-4 w-4 text-rose-500/80 dark:text-rose-400/80" /></div>
        <span className="text-[13px] font-bold bg-background/50 px-1 rounded opacity-60 text-foreground/75">Reviewer</span>
      </div>

      <svg className="absolute inset-0 h-full w-full pointer-events-none">
        <path d="M 70% 25% L 25% 85%" className="stroke-emerald-600/30 dark:stroke-emerald-400/30 stroke-[2px] md:group-hover:stroke-[3px] transition-all duration-300" fill="none" />
        <path d="M 70% 25% L 85% 75%" className="stroke-rose-500/20 dark:stroke-rose-400/20 stroke-[1.25px] md:group-hover:stroke-[2px] transition-all duration-300" fill="none" />
      </svg>
    </div>
  )
}

function RelationshipDrawerVisual() {
  return (
    <div className="flex flex-col h-full space-y-3 opacity-90">
      <div className="flex items-center justify-between border-b border-border/20 pb-2">
        <div className="flex flex-col">
          <span className="text-[13px] font-bold text-foreground">Reciprocity Matrix</span>
          <span className="text-[16px] font-mono text-muted-foreground">Global Swarm State</span>
        </div>
        <Activity className="h-3.5 w-3.5 text-accent/60" />
      </div>

      {/* Mini Heatmap Matrix */}
      <div className="flex-1 bg-surface border border-border/20 rounded-sm p-2">
        <div className="grid grid-cols-[auto_1fr_1fr_1fr] gap-x-2 gap-y-1.5 text-[16px] font-mono items-center h-full">
          <div className="text-muted-foreground"></div>
          <div className="text-center text-muted-foreground">TRST</div>
          <div className="text-center text-muted-foreground">HLP</div>
          <div className="text-center text-muted-foreground">CHLG</div>

          <div className="text-foreground/75">ARCH</div>
          <div className="bg-emerald-600/[0.16] dark:bg-emerald-400/[0.24] h-4 rounded text-center leading-4 text-emerald-700 dark:text-emerald-300">.92</div>
          <div className="bg-emerald-600/[0.1] dark:bg-emerald-400/[0.15] h-4 rounded text-center leading-4 text-emerald-600 dark:text-emerald-400/80">.74</div>
          <div className="bg-rose-500/[0.1] dark:bg-rose-400/[0.1] h-4 rounded text-center leading-4 text-rose-600 dark:text-rose-400">.42</div>

          <div className="text-foreground/75">COD</div>
          <div className="bg-emerald-600/[0.14] dark:bg-emerald-400/[0.2] h-4 rounded text-center leading-4 text-emerald-700 dark:text-emerald-300">.88</div>
          <div className="bg-emerald-600/[0.2] dark:bg-emerald-400/[0.3] h-4 rounded text-center leading-4 text-emerald-700 dark:text-emerald-300 font-bold border border-emerald-500/20">.95</div>
          <div className="bg-accent/10 h-4 rounded text-center leading-4 text-accent/80">.21</div>

          <div className="text-foreground/75">REV</div>
          <div className="bg-rose-500/[0.14] dark:bg-rose-400/[0.15] h-4 rounded text-center leading-4 text-rose-600 dark:text-rose-400">.34</div>
          <div className="bg-border/20 h-4 rounded text-center leading-4 text-muted-foreground">.55</div>
          <div className="bg-rose-500/[0.2] dark:bg-rose-400/[0.25] h-4 rounded text-center leading-4 text-rose-700 dark:text-rose-300">.89</div>
        </div>
      </div>
    </div>
  )
}

function PlanningDAGVisual() {
  return (
    <div className="flex flex-col h-full space-y-3 pt-1">
      <div className="flex items-center justify-between mb-2 pb-2 border-b border-border/10">
        <div className="flex items-center gap-2">
          <div className="h-5 w-5 rounded bg-primary/10 flex items-center justify-center"><Network className="h-3 w-3 text-primary/80" /></div>
          <span className="text-[16px] font-semibold text-foreground">Task: Build Auth Flow</span>
        </div>
        <span className="text-[16px] font-mono bg-muted/20 border border-border/20 text-muted-foreground px-1 py-0.5 rounded">CRITICAL OVERLAY</span>
      </div>

      <div className="relative pl-6 space-y-3 flex-1 flex flex-col justify-center">
        <div className="absolute left-3 top-2 bottom-2 w-[2px] bg-border/20" />

        <div className="relative opacity-40">
          <div className="absolute -left-[25px] top-1.5 h-3 w-3 rounded-full border-[3px] border-background bg-emerald-600/50 dark:bg-emerald-400/50 z-10" />
          <div className="absolute -left-[14px] top-[11px] w-3 h-[2px] bg-emerald-600/30 dark:bg-emerald-400/30" />
          <div className="text-[13px] font-semibold text-foreground/80">Schema Design</div>
          <div className="flex gap-1 mt-0.5 text-[16px] font-mono">
            <span className="text-muted-foreground bg-muted/50 px-1 rounded">ARCH</span>
            <span className="text-emerald-600 dark:text-emerald-400">Done (12s)</span>
          </div>
        </div>

        <div className="relative border border-primary/20 bg-card/75 dark:bg-[#0d0d12] p-2 rounded-sm opacity-100">
          <div className="absolute -left-[34px] top-4 -bottom-4 w-[2px] bg-primary/40" />
          <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute -left-[34.5px] top-3.5 h-3.5 w-3.5 rounded-full border-[3px] border-background bg-primary z-10" />
          <div className="absolute -left-[22px] top-[19px] w-5 h-[2px] bg-primary/30" />
          <div className="text-[13px] font-bold text-primary flex justify-between">
            Implement OAuth Map
            <span className="bg-primary/10 text-primary px-1 rounded text-[16px] font-mono border border-primary/20">RUNNING</span>
          </div>

          {/* Dense Metadata Pills */}
          <div className="flex flex-wrap gap-1 mt-2">
            <span className="bg-surface border border-border/20 px-1 rounded text-[16px] text-muted-foreground font-mono">OWNER: COD</span>
            <span className="bg-surface border border-border/20 px-1 rounded text-[16px] text-muted-foreground font-mono">BUDGET: 4K TKN</span>
            <span className="bg-surface border border-border/20 px-1 rounded text-[16px] text-muted-foreground font-mono">ETA: 14s</span>
          </div>
        </div>

        <div className="relative opacity-35">
          <div className="absolute -left-[25px] top-1.5 h-3 w-3 rounded-full border-[3px] border-background bg-muted-foreground/60 z-10" />
          <div className="text-[13px] font-semibold text-foreground/75">Testing & Teardown</div>
          <div className="flex gap-1 mt-0.5 text-[16px] font-mono">
            <span className="text-muted-foreground bg-muted/50 px-1 rounded">REV</span>
            <span className="text-muted-foreground">Blocked</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ExecutionStateVisual() {
  return (
    <div className="flex flex-col h-full space-y-2 opacity-90">
      <div className="flex items-center justify-between border-b border-border/20 pb-2">
        <div className="flex items-center gap-2">
          <Workflow className="h-3.5 w-3.5 text-foreground/50" />
          <span className="text-[13px] font-bold text-foreground">Live Execution Strip</span>
        </div>
        <span className="text-[16px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1 rounded">OK</span>
      </div>
      <div className="font-mono text-[13px] flex-1 bg-card/75 dark:bg-[#0a0a0c] border border-border/20 rounded-sm p-2 overflow-hidden flex flex-col justify-end space-y-1">
        <div className="text-muted-foreground opacity-35 flex gap-2"><span className="w-12">14:00:01</span> spawn planner.worker-02</div>
        <div className="text-emerald-600 dark:text-emerald-400 opacity-60 flex gap-2"><span className="w-12">14:00:02</span> read src/auth.ts <span className="text-muted-foreground ml-auto">18ms</span></div>
        <div className="text-accent opacity-75 flex gap-2"><span className="w-12">14:00:04</span> spawn COD module</div>
        <div className="text-muted-foreground opacity-35 flex gap-2"><span className="w-12">14:00:05</span> retry test shard 2...</div>
        <div className="text-primary mt-1 border-t border-border/20 pt-1 flex gap-2">
          <span className="w-12">14:00:08</span> write plan.json <motion.span animate={{ opacity: [1, 0, 1] }} transition={{ duration: 1, repeat: Infinity, ease: "linear" }}>█</motion.span>
        </div>
      </div>
    </div>
  )
}

function MultiLaneArenaVisual() {
  return (
    <div className="flex flex-col h-full w-full gap-2">
      {/* Top Arena Lanes */}
      <div className="flex gap-2 flex-1 pt-1">
        {/* User / Driver Lane */}
        <div className="flex-1 border border-border/20 bg-surface/30 rounded-sm flex flex-col relative overflow-hidden opacity-65">
          <div className="bg-surface/80 border-b border-border/10 px-2 py-1.5 flex flex-col">
            <div className="text-[16px] uppercase font-bold text-muted-foreground">Driver</div>
            <div className="text-[13px] font-mono text-muted-foreground mt-0.5 flex gap-1"><span className="bg-muted/50 px-1 rounded">CTX 12%</span><span className="bg-muted/50 px-1 rounded">IDLE</span></div>
          </div>
          <div className="p-2 flex-1 flex flex-col justify-end">
            <div className="bg-card/50 border border-border/20 p-1.5 rounded text-[13px] text-foreground/80 self-end max-w-[95%]">
              Add rate limits now.
            </div>
            <div className="text-[13px] font-mono text-muted-foreground/60 self-end mt-1">turn #12 • 12ms</div>
          </div>
        </div>

        {/* Agent 1 Lane */}
        <div className="flex-1 border border-primary/20 bg-primary/5 rounded-sm flex flex-col relative overflow-hidden">
          <motion.div animate={{ opacity: [0.3, 0.8, 0.3] }} transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }} className="absolute top-1.5 right-1.5 h-1.5 w-1.5 bg-primary rounded-full shadow-[0_0_8px_rgba(155,126,235,0.4)]" />
          <div className="bg-primary/5 border-b border-primary/10 px-2 py-1.5 flex flex-col">
            <div className="text-[16px] uppercase font-bold text-primary">Architect</div>
            <div className="text-[13px] font-mono text-muted-foreground mt-0.5 flex gap-1"><span className="bg-background/80 border border-border/20 px-1 rounded text-primary">CTX 48%</span><span className="bg-background/80 border border-border/20 px-1 rounded text-muted-foreground">TOOL: FS</span></div>
          </div>
          <div className="p-2 flex-1 flex flex-col mt-4">
            <motion.div initial={{ y: 8, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ duration: 0.3 }} className="bg-card border-l-[1.5px] border-primary p-1.5 rounded text-[13px] text-foreground self-start max-w-[95%] shadow-sm">
              I will scaffold the Redis throttle.
            </motion.div>
            {/* Inline Telemetry */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.2, duration: 0.3 }} className="text-[13px] font-mono text-muted-foreground/80 self-start mt-1 flex gap-1 flex-wrap">
              <span>turn #13</span> <span className="text-emerald-600 dark:text-emerald-400/80">388ms</span> <span className="bg-surface border border-border/20 px-0.5 py-[1px] rounded">used MEM-442</span>
            </motion.div>
          </div>
        </div>

        {/* Agent 2 Lane */}
        <div className="flex-1 border border-border/20 bg-surface/30 rounded-sm flex flex-col relative overflow-hidden opacity-65">
          <div className="bg-surface/80 border-b border-border/10 px-2 py-1.5 flex flex-col">
            <div className="text-[16px] uppercase font-bold text-muted-foreground">Coder</div>
            <div className="text-[13px] font-mono text-muted-foreground mt-0.5 flex gap-1"><span className="bg-muted/50 px-1 rounded">CTX 04%</span><span className="bg-muted/50 px-1 rounded">WAIT</span></div>
          </div>
          <div className="p-2 flex-1 flex flex-col justify-end opacity-50 pb-6">
            <div className="bg-muted border border-border/20 p-1.5 rounded text-[13px] text-foreground/60 self-start max-w-[95%]">
              Waiting for scaffold...
            </div>
          </div>
        </div>
      </div>

      {/* Run Control Bar */}
      <div className="h-7 bg-card/75 dark:bg-[#0a0a0c] border border-border/20 rounded-md mt-1 flex items-center justify-between px-2 text-[16px] font-mono text-muted-foreground opacity-90">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
            <motion.div animate={{ opacity: [0.3, 1, 0.3] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-400" /> LIVE_RUN
          </span>
          <span>CLOCK: 00:14:42</span>
        </div>
        <div className="flex items-center gap-3">
          <span>QUEUE: 2</span>
          <span>COST: $0.14</span>
          <span className="border border-border/20 bg-surface/50 px-1.5 py-0.5 rounded text-foreground/80">CONSENSUS: 85%</span>
        </div>
      </div>
    </div>
  )
}

function CreativeDialsVisual() {
  return (
    <div className="flex flex-col h-full space-y-4 opacity-90">
      <div className="flex items-center justify-between border-b border-border/20 pb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 text-amber-500/80" />
          <span className="text-[13px] font-bold text-foreground">Global Swarm Tuning</span>
        </div>
        <span className="text-[16px] font-mono text-muted-foreground bg-surface px-1 py-0.5 rounded border border-border/10">LIVE SYNC</span>
      </div>
      <div className="space-y-4 flex-1">
        <div>
          <div className="flex justify-between text-[16px] mb-1.5 font-semibold text-foreground/80">
            <span>Imagination</span>
            <span className="text-accent/90 font-mono">0.85</span>
          </div>
          <div className="relative h-1 bg-muted/60 rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full w-[85%] bg-accent opacity-80" />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-[16px] mb-1.5 font-semibold text-foreground/80">
            <span>Strictness</span>
            <span className="text-rose-500 dark:text-rose-400 font-mono">0.12</span>
          </div>
          <div className="relative h-1 bg-muted/60 rounded-full overflow-hidden">
            <div className="absolute top-0 left-0 h-full w-[12%] bg-rose-500/80 dark:bg-rose-400/80" />
          </div>
        </div>

        <div className="mt-2 text-[13px] text-muted-foreground leading-tight p-2 bg-card/75 dark:bg-[#0a0a0c] border border-border/20 rounded flex flex-col gap-1.5">
          <div className="text-[16px] font-mono text-primary/80">SYSTEM EVENT</div>
          <span className="opacity-70">Orchestrator adjusted parameters mid-run. Dials propagate to active worker contexts without restart.</span>
        </div>
      </div>
    </div>
  )
}

function NavIcon({ type, active }: { type: string, active: boolean }) {
  const o1 = active ? "opacity-100" : "opacity-60"
  const o2 = active ? "opacity-100" : "opacity-40"
  switch (type) {
    case 'Identity': return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect x="3" y="4" width="18" height="16" rx="3" className={`stroke-current ${o1} transition-opacity`} strokeWidth="1.5" />
        <circle cx="12" cy="11" r="3" className={`fill-current ${o2} transition-opacity`} />
        <path d="M7 17v-1.5a3.5 3.5 0 0 1 7 0V17" className={`stroke-current ${o1} transition-opacity`} strokeWidth="1.5" strokeLinecap="round" />
      </svg>
    )
    case 'Memory': return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path d="M4 6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6z" className={`stroke-current ${o1} transition-opacity`} strokeWidth="1.5" />
        <path d="M8 4v16" className={`stroke-current ${o2} transition-opacity`} strokeWidth="1.5" />
        <circle cx="14" cy="10" r="2" className={`fill-current ${o1} transition-opacity`} />
        <circle cx="14" cy="16" r="1.5" className={`fill-current ${o2} transition-opacity`} />
      </svg>
    )
    case 'Emotion': return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect x="3" y="4" width="18" height="16" rx="3" className={`stroke-current ${o2} transition-opacity`} strokeWidth="1.5" />
        <path d="M7 12h3l2-4 2 8 2-4h3" className={`stroke-current ${o1} transition-opacity`} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    )
    case 'Relationships': return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <circle cx="7" cy="12" r="3" className={`stroke-current ${o1} transition-opacity`} strokeWidth="1.5" />
        <circle cx="17" cy="12" r="3" className={`stroke-current ${o1} transition-opacity`} strokeWidth="1.5" />
        <path d="M10 12h4" className={`stroke-current ${o2} transition-opacity`} strokeWidth="1.5" />
        <circle cx="12" cy="12" r="1.5" className={`fill-current ${o1} transition-opacity`} />
      </svg>
    )
    case 'Planning': return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <path d="M4 6h10M4 12h16M4 18h7" className={`stroke-current ${o1} transition-opacity`} strokeWidth="1.5" strokeLinecap="round" />
        <rect x="16" y="4" width="4" height="4" rx="1" className={`fill-current ${o2} transition-opacity`} />
        <rect x="13" y="16" width="4" height="4" rx="1" className={`fill-current ${o2} transition-opacity`} />
      </svg>
    )
    case 'Simulation': return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" className="shrink-0">
        <rect x="3" y="4" width="18" height="16" rx="3" className={`stroke-current ${o1} transition-opacity`} strokeWidth="1.5" />
        <path d="M10 9l5 3-5 3v-6z" className={`fill-current ${o2} transition-opacity`} />
      </svg>
    )
    default: return null
  }
}

function InteractiveShowcase() {
  const [activeTab, setActiveTab] = useState('Identity')

  // 1. Reduced to 6 cleaner narrative tabs
  const featureTabs = ['Identity', 'Memory', 'Emotion', 'Relationships', 'Planning', 'Simulation']

  const getTabContent = () => {
    switch (activeTab) {
      case 'Identity': return {
        pill: "Core Persona Composer",
        title: "Design an agent with a point of view",
        subtitle: "Define voice, goals, and guardrails, then let every later behavior trace back to that identity",
        mainVisual: <LivePersonaComposerVisual />,
        railVisual: <DecisionTraceVisual />
      }
      case 'Memory': return {
        pill: "Retentive Architecture",
        title: "Memory that compounds over time",
        subtitle: "Agents recall decisions, preferences, and debates instead of starting cold every session",
        mainVisual: <MemoryRetrievalVisual />,
        railVisual: <KnowledgePromotionVisual />
      }
      case 'Emotion': return {
        pill: "Internal State Monitor",
        title: "Make emotional state visible",
        subtitle: "Track confidence, frustration, and empathy as live signals that shape behavior",
        mainVisual: <EmotionWeatherVisual />,
        railVisual: <JournalLedgerVisual />
      }
      case 'Relationships': return {
        pill: "Agent-to-Agent Social Layers",
        title: "Watch trust form between agents",
        subtitle: "See alliances, friction, and influence shift as agents work together",
        mainVisual: <RelationshipForceGraphVisual />,
        railVisual: <RelationshipDrawerVisual />
      }
      case 'Planning': return {
        pill: "Heuristic Task Graphs",
        title: "Turn intent into executable plans",
        subtitle: "Agents break goals into steps, spawn work, and report progress in real time",
        mainVisual: <PlanningDAGVisual />,
        railVisual: <ExecutionStateVisual />
      }
      case 'Simulation': return {
        pill: "Interactive Sandboxes",
        title: "Run whole teams inside one arena",
        subtitle: "Stage debates, workflows, and what-if scenarios with every state exposed",
        mainVisual: <MultiLaneArenaVisual />,
        railVisual: <CreativeDialsVisual />
      }
      default: return {
        pill: "Features",
        title: "Advanced Capabilities",
        subtitle: "Dive into the domain configurations.",
        mainVisual: <div />,
        railVisual: <div />
      }
    }
  }

  const content = getTabContent()

  return (
    <div className="overflow-hidden rounded-sm border border-white/10 bg-black/20 backdrop-blur-md shadow-lg transition-all dark:shadow-[0_40px_120px_-70px_rgba(0,0,0,0.9)]">
      {/* Sleek Fake Browser Toolbar */}
      <div className="flex items-center gap-4 border-b border-white/[0.05] dark:border-white/[0.05] border-black/5 px-4 py-2.5 bg-muted/10 shadow-sm relative z-10">
        <div className="flex items-center gap-2 pr-3">
          <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57] border border-black/10 shadow-inner" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e] border border-black/10 shadow-inner" />
          <span className="h-2.5 w-2.5 rounded-full bg-[#28c840] border border-black/10 shadow-inner" />
        </div>
        <div className="relative flex-1 overflow-x-auto hide-scrollbar">
          <div className="flex min-w-max items-center gap-1.5 px-2">
            {featureTabs.map((tab, idx) => {
              const isActive = activeTab === tab;
              return (
                <div key={tab} className="flex items-center gap-1.5">
                  <button
                    onClick={() => setActiveTab(tab)}
                    className={`group flex items-center gap-2.5 rounded-md px-3 py-1.5 text-[12.5px] font-semibold tracking-wide transition-all duration-300 ${isActive
                      ? "bg-foreground/10 text-foreground shadow-sm ring-1 ring-border/20"
                      : "text-muted-foreground/80 hover:bg-muted/30 hover:text-foreground"
                      }`}
                  >
                    <NavIcon type={tab} active={isActive} />
                    {tab}
                  </button>
                  {idx < featureTabs.length - 1 && (
                    <div className="h-3 w-px bg-border/40 mx-0.5" />
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Shell Body */}
      <div className="p-4 sm:p-5">
        <div className="overflow-hidden rounded-sm border border-white/5 bg-transparent backdrop-blur-sm">
          {/* Internal Shell Header */}
          <div className="flex flex-wrap items-center gap-4 border-b border-border/20 px-4 py-4 sm:px-5">
            <div className="flex items-center gap-4">
              <PlaygroundLogo className="h-9 w-9 text-primary drop-shadow-[0_0_12px_rgba(203,166,247,0.4)]" />
              <div>
                <div className="text-sm font-semibold text-foreground">Agent Playground</div>
                <div className="text-[11px] uppercase tracking-[0.24em] text-muted-foreground">Product Tour</div>
              </div>
            </div>
          </div>

          <div className="grid gap-6 px-4 py-6 sm:px-5 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
            <div className="max-w-3xl">
              <div className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/30 px-3 py-1.5 text-xs text-foreground/80">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                {content.pill}
              </div>
              <h2 className="mt-4 max-w-3xl text-[clamp(1.6rem,2.2vw,2.2rem)] font-bold leading-[1.1] tracking-[-0.02em] text-[var(--color-pastel-purple)]">
                {content.title}
              </h2>
              <p className="mt-3 max-w-xl text-sm leading-relaxed text-muted-foreground sm:text-base">
                {content.subtitle}
              </p>
            </div>
          </div>

          {/* Redesigned 2-pane layout (Dominant Main + Narrow Rail) */}
          <div className="border-t border-white/10 p-4 sm:p-5 bg-transparent">
            <div className="flex flex-col lg:flex-row gap-5">

              {/* Main Dominant Scene */}
              <div className="flex-1 min-h-[220px] rounded-sm border border-white/10 bg-black/30 backdrop-blur-sm p-5 shadow-sm transition-colors hover:border-white/20 group">
                <div className="h-full w-full opacity-90 transition-opacity group-hover:opacity-100 flex flex-col justify-center">
                  {content.mainVisual}
                </div>
              </div>

              {/* Narrow Evidence Rail */}
              <div className="w-full lg:w-[320px] min-h-[220px] rounded-sm border border-white/10 bg-black/10 backdrop-blur-sm p-5 shadow-inner flex flex-col justify-center transition-colors hover:bg-black/20 group">
                <div className="h-full w-full opacity-90 transition-opacity group-hover:opacity-100 flex flex-col justify-center">
                  {content.railVisual}
                </div>
              </div>

            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function Home() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0B0A10] text-foreground transition-colors duration-300">
      {/* Premium ambient image background */}
      {/* Premium ambient image background that scrolls with the content */}
      <div className="pointer-events-none absolute inset-0 z-0 overflow-hidden">
        <div
          className="absolute inset-x-0 -top-50 h-[4000px] bg-[url('/landing_page_bg.png')] bg-[length:100%_auto] bg-top bg-no-repeat opacity-[0.85] mix-blend-screen dark:mix-blend-lighten"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-[#0B0A10]/5 via-[#0B0A10]/40 to-[#0B0A10]" />
        <div className="absolute inset-0 bg-grid-pattern opacity-5 mix-blend-overlay" />
      </div>



      <div className="relative z-10 pt-16">
        <section className="px-4 pb-12 pt-12 sm:px-10 lg:px-14">
          <div className="mx-auto max-w-[120rem]">
            <div className="flex flex-col items-start text-left">
              <div className="max-w-4xl">
                <div className="inline-flex items-center gap-2 rounded-full border border-primary/20 bg-primary/5 px-3 py-1 text-[11px] font-medium tracking-wide text-primary">
                  <Sparkles className="h-3 w-3" />
                  <span className="uppercase text-primary/80">Alpha Release</span>
                  <span className="h-3 w-[1px] bg-primary/20 mx-1" />
                  <span className="text-primary/60">Personality & Simulation Lab</span>
                </div>

                <h1 className="mt-8 max-w-4xl text-[clamp(2.5rem,5.5vw,4.2rem)] font-bold leading-[1.05] tracking-[-0.035em] text-foreground">
                  Build agents that remember, feel, and <span className="text-[var(--color-pastel-pink)]">evolve together.</span>
                </h1>

                <p className="mt-6 max-w-2xl text-[15px] leading-[1.7] text-muted-foreground">
                  Create believable AI personalities, give them long-term memory, emotional state,
                  relationships, journals, plans, and shared knowledge, then run scenarios that actually explain what changed.
                </p>

                <div className="mt-10 flex flex-wrap gap-4">
                  <Link
                    href="/agents/new"
                    className="inline-flex h-12 items-center justify-center rounded-sm bg-foreground px-8 text-sm font-bold text-background transition-colors hover:bg-foreground/90 shadow-sm"
                  >
                    Start Building
                  </Link>
                  <Link
                    href="#workflow"
                    className="inline-flex h-12 items-center justify-center rounded-sm border border-border/40 bg-transparent px-8 text-sm font-bold text-foreground transition-colors hover:bg-muted/20"
                  >
                    See Workflow
                  </Link>
                </div>
              </div>
            </div>

            <div id="feature-showcase" className="mt-16">
              <InteractiveShowcase />
            </div>
          </div>
        </section>

        <section className="px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-6xl text-center">
            <div className="text-sm font-semibold uppercase tracking-[0.32em] text-primary">Used by teams exploring AI systems</div>
            <h2 className="mt-5 text-[clamp(2.4rem,5vw,4rem)] font-semibold leading-[0.98] tracking-[-0.05em] text-[var(--color-pastel-yellow)]">
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
          <BentoGridSection />
        </section>

      </div>
    </div>
  )
}
