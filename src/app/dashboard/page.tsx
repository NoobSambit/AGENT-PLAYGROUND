'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAgentStore } from '@/stores/agentStore'
import { ArrowRight, Brain, MessageCircle, Plus, Sparkles, Users, Zap, type LucideIcon } from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'
import { GradientOrb } from '@/components/ui/animated-background'

const fadeInUp = {
  initial: { opacity: 0, y: 18 },
  animate: { opacity: 1, y: 0 },
}

function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  accent,
}: {
  icon: LucideIcon | React.ElementType
  label: string
  value: string | number
  detail: string
  accent: 'purple' | 'cyan' | 'pink'
}) {
  return (
    <motion.div variants={fadeInUp} className={`stat-card stat-card-${accent}`}>
      <div className="flex items-start justify-between gap-4">
        <div className={`icon-container icon-container-${accent}`}>
          <Icon className="h-5 w-5" />
        </div>
        <span className="soft-pill">Live signal</span>
      </div>
      <div className="mt-6">
        <div className="text-4xl font-semibold tracking-tight text-foreground">{value}</div>
        <div className="mt-2 text-sm font-medium text-foreground">{label}</div>
        <p className="mt-1 text-sm leading-6 text-muted-foreground">{detail}</p>
      </div>
    </motion.div>
  )
}

function AgentSnapshot({
  agent,
  onOpen,
}: {
  agent: { id: string; name: string; persona: string; status: string; goals: string[]; memoryCount?: number | null; stats?: { totalMessages?: number } | null }
  onOpen: () => void
}) {
  return (
    <motion.button
      variants={fadeInUp}
      whileHover={{ y: -4 }}
      onClick={onOpen}
      className="group rounded-sm border border-border/70 bg-card/[0.68] p-6 text-left shadow-[0_24px_60px_-38px_rgba(109,77,158,0.32)] backdrop-blur-2xl transition-all hover:border-primary/20 hover:bg-card/[0.84]"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-[0_18px_40px_-26px_rgba(109,77,158,0.6)]">
            <PlaygroundLogo className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-semibold text-foreground">{agent.name}</h3>
            <div className="mt-1 inline-flex items-center gap-2 text-xs capitalize text-muted-foreground">
              <span
                className={`h-2.5 w-2.5 rounded-full ${
                  agent.status === 'active'
                    ? 'bg-emerald-400'
                    : agent.status === 'training'
                      ? 'bg-amber-400'
                      : 'bg-zinc-400'
                }`}
              />
              {agent.status}
            </div>
          </div>
        </div>

        <ArrowRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
      </div>

      <p className="mt-5 line-clamp-3 text-sm leading-6 text-muted-foreground">{agent.persona}</p>

      <div className="mt-5 flex flex-wrap gap-2">
        {agent.goals.slice(0, 2).map((goal) => (
          <span key={goal} className="soft-pill max-w-full truncate">
            {goal}
          </span>
        ))}
      </div>

      <div className="mt-6 grid grid-cols-2 gap-3 rounded-sm bg-background/45 p-4">
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Messages</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{agent.stats?.totalMessages || 0}</div>
        </div>
        <div>
          <div className="text-xs uppercase tracking-[0.18em] text-muted-foreground">Memories</div>
          <div className="mt-2 text-2xl font-semibold text-foreground">{agent.memoryCount || 0}</div>
        </div>
      </div>
    </motion.button>
  )
}

function EmptyState({ onCreate }: { onCreate: () => void }) {
  return (
    <div className="rounded-sm border border-dashed border-border/70 bg-card/[0.54] px-6 py-12 text-center backdrop-blur-xl sm:px-10">
      <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-[0_18px_40px_-24px_rgba(109,77,158,0.6)]">
        <Sparkles className="h-9 w-9" />
      </div>
      <h2 className="mt-6 text-2xl font-semibold text-foreground">Start with one agent</h2>
      <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
        The dashboard becomes useful once you have a roster to compare, simulate, and evolve. Create an agent first, then return here to monitor the system.
      </p>
      <button
        onClick={onCreate}
        className="mt-6 inline-flex h-12 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_20px_48px_-26px_rgba(109,77,158,0.72)]"
      >
        Create Agent
        <ArrowRight className="h-4 w-4" />
      </button>
    </div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const { agents, loading, fetchAgents } = useAgentStore()

  useEffect(() => {
    void fetchAgents()
  }, [fetchAgents])

  const stats = {
    totalAgents: agents.length,
    activeAgents: agents.filter((agent) => agent.status === 'active').length,
    totalMessages: agents.reduce((sum, agent) => sum + (agent.stats?.totalMessages || 0), 0),
    totalMemories: agents.reduce((sum, agent) => sum + (agent.memoryCount || 0), 0),
  }

  const topAgents = agents.slice(0, 4)

  return (
    <div className="relative min-h-screen pb-20 pt-28">
      <GradientOrb className="-right-24 -top-10 h-[34rem] w-[34rem] opacity-20" color="violet" />
      <GradientOrb className="-left-16 top-[40%] h-[28rem] w-[28rem] opacity-15" color="cyan" />

      <div className="page-shell space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-section overflow-hidden px-6 py-7 sm:px-8 sm:py-8"
        >
          <div className="grid gap-8 xl:grid-cols-[1.45fr_0.85fr]">
            <div className="page-story">
              <div className="page-kicker">
                <Zap className="h-4 w-4" />
                Dashboard
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                  Operate your agent system from one surface.
                </h1>
                <p className="page-intro mt-4">
                  Use this page to check roster health, jump into active agents, and decide whether the next step is training, arena debate, or another creation pass.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className="soft-pill">{stats.totalAgents} total agents</span>
                <span className="soft-pill">{stats.activeAgents} currently active</span>
                <span className="soft-pill">{stats.totalMessages.toLocaleString()} total messages</span>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => router.push('/agents/new')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_20px_48px_-26px_rgba(109,77,158,0.72)] transition-all hover:-translate-y-0.5"
                >
                  <Plus className="h-4 w-4" />
                  Create a new agent
                </button>
                <button
                  onClick={() => router.push('/simulation')}
                  className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border/70 bg-card/[0.62] px-5 text-sm font-semibold text-foreground backdrop-blur-xl transition-all hover:border-primary/20 hover:bg-card/[0.82]"
                >
                  Open arena workspace
                  <ArrowRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
              {[
                {
                  title: 'What this page answers',
                  detail: 'Which agents are active, which ones need attention, and where to go next.',
                },
                {
                  title: 'Best next action',
                  detail: agents.length > 0
                    ? 'Open an agent workspace to inspect memory, learning, and relationship state.'
                    : 'Create the first agent, then return here for oversight and arena runs.',
                },
              ].map((item) => (
                <div key={item.title} className="rounded-sm border border-border/70 bg-background/40 p-5 backdrop-blur-xl">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">{item.title}</div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.detail}</p>
                </div>
              ))}
            </div>
          </div>
        </motion.section>

        <motion.section
          initial="initial"
          animate="animate"
          variants={{ animate: { transition: { staggerChildren: 0.08 } } }}
          className="grid gap-5 md:grid-cols-2 xl:grid-cols-4"
        >
          <StatCard icon={PlaygroundLogo} label="Roster size" value={stats.totalAgents} detail="All personalities created in the workspace." accent="purple" />
          <StatCard icon={Zap} label="Active agents" value={stats.activeAgents} detail="Agents ready for direct chat, planning, and arena work." accent="cyan" />
          <StatCard icon={MessageCircle} label="Conversation volume" value={stats.totalMessages.toLocaleString()} detail="A quick signal for system usage and agent activity." accent="pink" />
          <StatCard icon={Brain} label="Stored memories" value={stats.totalMemories.toLocaleString()} detail="Long-term context accumulated across the roster." accent="purple" />
        </motion.section>

        <section className="grid gap-6 xl:grid-cols-[1.35fr_0.9fr]">
          <motion.div
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.12 }}
            className="page-section px-6 py-7 sm:px-8"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Roster</div>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">Agent workspaces</h2>
                <p className="mt-2 text-sm leading-7 text-muted-foreground">
                  Open an agent to inspect memory, emotional state, planning, relationships, and new enhancement modules from the same workspace.
                </p>
              </div>

              {agents.length > 0 && (
                <button
                  onClick={() => router.push('/agents')}
                  className="inline-flex items-center gap-2 text-sm font-medium text-primary transition-colors hover:text-accent"
                >
                  View full directory
                  <ArrowRight className="h-4 w-4" />
                </button>
              )}
            </div>

            <div className="page-divider my-6" />

            {loading ? (
              <div className="grid gap-5 md:grid-cols-2">
                {Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="rounded-sm border border-border/60 bg-card/[0.6] p-6">
                    <div className="flex items-center gap-3">
                      <div className="skeleton h-12 w-12 rounded-sm" />
                      <div className="space-y-2">
                        <div className="skeleton h-4 w-24" />
                        <div className="skeleton h-3 w-20" />
                      </div>
                    </div>
                    <div className="mt-5 space-y-2">
                      <div className="skeleton h-3 w-full" />
                      <div className="skeleton h-3 w-3/4" />
                    </div>
                  </div>
                ))}
              </div>
            ) : topAgents.length > 0 ? (
              <motion.div
                initial="initial"
                animate="animate"
                variants={{ animate: { transition: { staggerChildren: 0.08 } } }}
                className="grid gap-5 md:grid-cols-2"
              >
                {topAgents.map((agent) => (
                  <AgentSnapshot key={agent.id} agent={agent} onOpen={() => router.push(`/agents/${agent.id}`)} />
                ))}
              </motion.div>
            ) : (
              <EmptyState onCreate={() => router.push('/agents/new')} />
            )}
          </motion.div>

          <motion.aside
            initial={{ opacity: 0, y: 22 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.18 }}
            className="space-y-6"
          >
            <div className="page-section px-6 py-7">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Workflows</div>
              <div className="mt-4 space-y-4">
                {[
                  {
                    title: 'Create and profile',
                    text: 'Generate a new personality, goals, psychology profile, and linguistic profile.',
                    action: 'Build agent',
                    onClick: () => router.push('/agents/new'),
                  },
                  {
                    title: 'Open the arena',
                    text: 'Prepare a debate roster, edit seats, and review the head-led live event feed.',
                    action: 'Open arena',
                    onClick: () => router.push('/simulation'),
                  },
                  {
                    title: 'Inspect the roster',
                    text: 'Filter the full directory to compare enhancements and activity across agents.',
                    action: 'View agents',
                    onClick: () => router.push('/agents'),
                  },
                ].map((item) => (
                  <button
                    key={item.title}
                    onClick={item.onClick}
                    className="group block w-full rounded-sm border border-border/[0.65] bg-background/45 p-5 text-left transition-all hover:border-primary/20 hover:bg-background/70"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <h3 className="text-base font-semibold text-foreground">{item.title}</h3>
                        <p className="mt-2 text-sm leading-7 text-muted-foreground">{item.text}</p>
                      </div>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                    </div>
                    <div className="mt-4 text-xs font-semibold uppercase tracking-[0.2em] text-primary/80">{item.action}</div>
                  </button>
                ))}
              </div>
            </div>

            <div className="page-section px-6 py-7">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Coverage</div>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
                <div className="rounded-sm bg-background/45 p-5">
                  <div className="flex items-center gap-3">
                    <div className="icon-container icon-container-cyan">
                      <Users className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">Arena ready</div>
                      <div className="text-sm text-muted-foreground">
                        {Math.max(agents.length, 0)} agents available for arena debates.
                      </div>
                    </div>
                  </div>
                </div>
                <div className="rounded-sm bg-background/45 p-5">
                  <div className="flex items-center gap-3">
                    <div className="icon-container icon-container-pink">
                      <Sparkles className="h-5 w-5" />
                    </div>
                    <div>
                      <div className="text-sm font-medium text-foreground">Enhancement modules</div>
                      <div className="text-sm text-muted-foreground">Relationships, planning, learning, journaling, and knowledge are all surfaced in the agent workspace.</div>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </motion.aside>
        </section>
      </div>
    </div>
  )
}
