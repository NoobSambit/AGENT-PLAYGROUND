'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAgentStore } from '@/stores/agentStore'
import { GradientOrb } from '@/components/ui/animated-background'
import { ArrowRight, Bot, Brain, Heart, Plus, Search, Sparkles, TrendingUp } from 'lucide-react'

const filters = ['all', 'active', 'training', 'inactive'] as const

export default function AgentsPage() {
  const router = useRouter()
  const { agents, loading, fetchAgents } = useAgentStore()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<(typeof filters)[number]>('all')
  const deferredSearch = useDeferredValue(search)

  useEffect(() => {
    void fetchAgents()
  }, [fetchAgents])

  const normalizedSearch = deferredSearch.trim().toLowerCase()
  const filteredAgents = agents.filter((agent) => {
    const matchesStatus = statusFilter === 'all' || agent.status === statusFilter
    const matchesSearch =
      normalizedSearch.length === 0 ||
      agent.name.toLowerCase().includes(normalizedSearch) ||
      agent.persona.toLowerCase().includes(normalizedSearch) ||
      agent.goals.some((goal) => goal.toLowerCase().includes(normalizedSearch))

    return matchesStatus && matchesSearch
  })

  const enhancedAgents = agents.filter(
    (agent) =>
      agent.psychologicalProfile ||
      agent.linguisticProfile ||
      (agent.relationshipCount || 0) > 0 ||
      (agent.creativeWorks || 0) > 0
  ).length

  const statusCounts = {
    active: agents.filter((agent) => agent.status === 'active').length,
    training: agents.filter((agent) => agent.status === 'training').length,
    inactive: agents.filter((agent) => agent.status === 'inactive').length,
  }

  return (
    <div className="relative min-h-screen pb-20 pt-28">
      <GradientOrb className="-right-28 -top-10 h-[34rem] w-[34rem] opacity-20" color="violet" />
      <GradientOrb className="-left-12 bottom-0 h-[26rem] w-[26rem] opacity-15" color="cyan" />

      <div className="page-shell space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-section px-6 py-7 sm:px-8 sm:py-8"
        >
          <div className="grid gap-8 xl:grid-cols-[1.4fr_0.9fr]">
            <div className="page-story">
              <div className="page-kicker">
                <Sparkles className="h-4 w-4" />
                Agent directory
              </div>
              <div>
                <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                  Browse the full personality roster.
                </h1>
                <p className="page-intro mt-4">
                  This page is for comparing agents before you open a workspace. Use it to scan status, enhancement coverage, memory growth, and communication depth across the system.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <span className="soft-pill">{agents.length} total agents</span>
                <span className="soft-pill">{enhancedAgents} with advanced enhancements</span>
                <span className="soft-pill">{agents.reduce((sum, agent) => sum + (agent.memoryCount || 0), 0)} stored memories</span>
              </div>
            </div>

            <div className="space-y-4 rounded-[1.9rem] border border-border/70 bg-background/[0.42] p-5 backdrop-blur-xl">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">How to use it</div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  Filter by operational status, search by personality or goals, then open an agent to inspect planning, relationships, memories, and simulations.
                </p>
              </div>

              <button
                onClick={() => router.push('/agents/new')}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 text-sm font-semibold text-primary-foreground shadow-[0_20px_48px_-26px_rgba(109,77,158,0.72)]"
              >
                <Plus className="h-4 w-4" />
                Create agent
              </button>
            </div>
          </div>
        </motion.section>

        <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              label: 'Roster size',
              value: agents.length,
              detail: 'Every personality currently stored.',
              icon: Bot,
              accent: 'purple',
            },
            {
              label: 'Active now',
              value: statusCounts.active,
              detail: 'Agents ready for chat and simulation.',
              icon: TrendingUp,
              accent: 'cyan',
            },
            {
              label: 'Enhanced',
              value: enhancedAgents,
              detail: 'Agents with profile, relationships, or creative state.',
              icon: Heart,
              accent: 'pink',
            },
            {
              label: 'Memories',
              value: agents.reduce((sum, agent) => sum + (agent.memoryCount || 0), 0),
              detail: 'Total long-term memory records across agents.',
              icon: Brain,
              accent: 'purple',
            },
          ].map((item) => {
            const Icon = item.icon
            return (
              <div key={item.label} className={`stat-card stat-card-${item.accent}`}>
                <div className={`icon-container icon-container-${item.accent}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <div className="mt-6 text-4xl font-semibold tracking-tight text-foreground">{item.value}</div>
                <div className="mt-2 text-sm font-medium text-foreground">{item.label}</div>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.detail}</p>
              </div>
            )
          })}
        </section>

        <section className="page-section px-6 py-7 sm:px-8">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Filter and search</div>
              <h2 className="mt-2 text-2xl font-semibold text-foreground">Find the right agent fast</h2>
              <p className="mt-2 text-sm leading-7 text-muted-foreground">
                Search by name, persona, or goals. Status filters narrow the list to agents that are active, still training, or currently dormant.
              </p>
            </div>

            <div className="flex w-full flex-col gap-3 xl:max-w-3xl xl:flex-row">
              <label className="flex h-12 flex-1 items-center gap-3 rounded-full border border-border/70 bg-card/[0.62] px-4 backdrop-blur-xl">
                <Search className="h-4 w-4 text-muted-foreground" />
                <input
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search by name, persona, or goal"
                  className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
                />
              </label>

              <div className="flex flex-wrap gap-2">
                {filters.map((filter) => (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`inline-flex h-12 items-center rounded-full px-4 text-sm font-medium capitalize transition-all ${
                      statusFilter === filter
                        ? 'bg-primary text-primary-foreground shadow-[0_18px_44px_-26px_rgba(109,77,158,0.72)]'
                        : 'border border-border/70 bg-card/[0.58] text-muted-foreground hover:border-primary/20 hover:text-foreground'
                    }`}
                  >
                    {filter}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="page-divider my-6" />

          {loading ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {Array.from({ length: 6 }).map((_, index) => (
                <div key={index} className="rounded-[1.75rem] border border-border/60 bg-card/[0.6] p-6">
                  <div className="flex items-center gap-3">
                    <div className="skeleton h-12 w-12 rounded-2xl" />
                    <div className="space-y-2">
                      <div className="skeleton h-4 w-28" />
                      <div className="skeleton h-3 w-20" />
                    </div>
                  </div>
                  <div className="mt-5 space-y-2">
                    <div className="skeleton h-3 w-full" />
                    <div className="skeleton h-3 w-3/4" />
                    <div className="skeleton h-3 w-2/3" />
                  </div>
                </div>
              ))}
            </div>
          ) : filteredAgents.length > 0 ? (
            <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
              {filteredAgents.map((agent) => (
                <motion.button
                  key={agent.id}
                  whileHover={{ y: -4 }}
                  onClick={() => router.push(`/agents/${agent.id}`)}
                  className="group rounded-[1.85rem] border border-border/70 bg-card/[0.66] p-6 text-left shadow-[0_24px_60px_-38px_rgba(109,77,158,0.28)] backdrop-blur-2xl transition-all hover:border-primary/20 hover:bg-card/[0.84]"
                >
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_18px_40px_-26px_rgba(109,77,158,0.6)]">
                        <Bot className="h-5 w-5" />
                      </div>
                      <div>
                        <h2 className="text-xl font-semibold text-foreground">{agent.name}</h2>
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

                    <ArrowRight className="mt-1 h-4 w-4 text-muted-foreground transition-transform group-hover:translate-x-1 group-hover:text-primary" />
                  </div>

                  <p className="mt-5 line-clamp-3 text-sm leading-6 text-muted-foreground">{agent.persona}</p>

                  <div className="mt-5 flex flex-wrap gap-2">
                    {agent.linguisticProfile && <span className="soft-pill">linguistic profile</span>}
                    {agent.psychologicalProfile && <span className="soft-pill">psychology</span>}
                    {(agent.relationshipCount || 0) > 0 && <span className="soft-pill">{agent.relationshipCount} relationships</span>}
                    {(agent.creativeWorks || 0) > 0 && <span className="soft-pill">{agent.creativeWorks} creative works</span>}
                  </div>

                  <div className="mt-6 grid grid-cols-3 gap-3 rounded-[1.35rem] bg-background/45 p-4">
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Messages</div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{agent.stats?.totalMessages || 0}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Memories</div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{agent.memoryCount || 0}</div>
                    </div>
                    <div>
                      <div className="text-[11px] uppercase tracking-[0.18em] text-muted-foreground">Level</div>
                      <div className="mt-2 text-xl font-semibold text-foreground">{agent.progress?.level || 1}</div>
                    </div>
                  </div>
                </motion.button>
              ))}
            </div>
          ) : (
            <div className="rounded-[2rem] border border-dashed border-border/70 bg-card/[0.56] px-6 py-12 text-center">
              <h3 className="text-2xl font-semibold text-foreground">No agents match the current filter</h3>
              <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                Try a broader search, switch the status filter, or create a new agent if the roster still does not cover the workflow you need.
              </p>
            </div>
          )}
        </section>
      </div>
    </div>
  )
}
