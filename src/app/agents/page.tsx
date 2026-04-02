'use client'

import { useDeferredValue, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAgentStore } from '@/stores/agentStore'
import { ArrowRight, Brain, Heart, Plus, Search, Sparkles, TrendingUp } from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'

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
      <main className="mx-auto max-w-7xl px-6 sm:px-8">
        {/* Hero Section */}
        <motion.section
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-1 lg:grid-cols-12 gap-12 mb-16 pt-4"
        >
          <div className="lg:col-span-8 flex flex-col justify-center">
            <span className="text-primary text-sm font-semibold tracking-widest uppercase mb-4 flex items-center gap-2">
              <Sparkles className="w-4 h-4" /> Agent directory
            </span>
            <h1 className="text-5xl lg:text-6xl font-extrabold tracking-tighter mb-6 leading-none text-foreground">
              Browse the full<br />personality roster
            </h1>
            <p className="text-muted-foreground text-lg max-w-2xl leading-relaxed mb-8">
              Analyze and compare the neural architecture of our existing agents. Review operational status, enhancement layers, memory storage capacity, and communication depth benchmarks before deployment.
            </p>
            <div className="flex flex-wrap gap-3">
              <span className="bg-surface-strong border border-border/40 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 text-foreground">
                <span className="text-primary font-bold">{agents.length}</span> Total Agents
              </span>
              <span className="bg-surface-strong border border-border/40 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 text-foreground">
                <span className="text-[var(--color-pastel-blue)] font-bold">{enhancedAgents}</span> Advanced Enhancements
              </span>
              <span className="bg-surface-strong border border-border/40 px-4 py-2 rounded-sm text-sm font-medium flex items-center gap-2 text-foreground">
                <span className="text-[var(--color-pastel-pink)] font-bold">{agents.reduce((sum, agent) => sum + (agent.memoryCount || 0), 0)}</span> Stored Memories
              </span>
            </div>
          </div>
          <div className="lg:col-span-4">
            <div className="bg-[#111111] border border-border/40 p-8 rounded-sm border-l-4 border-l-primary shadow-sm">
              <h3 className="font-semibold text-xl mb-4 text-foreground">Operational Guide</h3>
              <ul className="space-y-4 mb-8 text-sm text-muted-foreground">
                <li className="flex items-start gap-3">
                  <Search className="text-primary w-4 h-4 mt-0.5 shrink-0" />
                  <span>Use the global search to filter by name, primary persona traits, or core objectives.</span>
                </li>
                <li className="flex items-start gap-3">
                  <Heart className="text-primary w-4 h-4 mt-0.5 shrink-0" />
                  <span>Select any agent card to open the enhancement suite and memory logs.</span>
                </li>
                <li className="flex items-start gap-3">
                  <TrendingUp className="text-primary w-4 h-4 mt-0.5 shrink-0" />
                  <span>Compare communicative depth scores to find the ideal personality for your simulation.</span>
                </li>
              </ul>
              <button
                onClick={() => router.push('/agents/new')}
                className="w-full bg-primary text-primary-foreground py-3 rounded-sm font-bold shadow-sm hover:brightness-110 transition-all flex items-center justify-center gap-2"
              >
                <Plus className="w-5 h-5"/>
                Create Agent
              </button>
            </div>
          </div>
        </motion.section>

        {/* System Metrics Strip */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-16 bg-[#111111] p-2 rounded-sm border border-border/40 shadow-sm">
          <div className="bg-surface-strong border border-border/20 p-6 rounded-sm text-center flex flex-col items-center">
            <PlaygroundLogo className="text-muted-foreground mb-2 w-6 h-6" />
            <span className="text-[10px] uppercase tracking-widest text-muted-foreground mb-1">Roster Size</span>
            <span className="text-2xl font-bold text-foreground">{agents.length}</span>
            <span className="text-[10px] text-muted-foreground mt-1">Every personality</span>
          </div>
          <div className="bg-surface-strong border border-border/20 p-6 rounded-sm text-center flex flex-col items-center">
            <TrendingUp className="text-[var(--color-pastel-blue)] mb-2 w-6 h-6" />
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-pastel-blue)] mb-1">Active Now</span>
            <span className="text-2xl font-bold text-[var(--color-pastel-blue)]">{statusCounts.active}</span>
            <span className="text-[10px] text-muted-foreground mt-1">Ready for simulation</span>
          </div>
          <div className="bg-surface-strong border border-border/20 p-6 rounded-sm text-center flex flex-col items-center">
            <Sparkles className="text-[var(--color-pastel-pink)] mb-2 w-6 h-6" />
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-pastel-pink)] mb-1">Enhanced</span>
            <span className="text-2xl font-bold text-[var(--color-pastel-pink)]">{enhancedAgents}</span>
            <span className="text-[10px] text-muted-foreground mt-1">Advanced logic</span>
          </div>
          <div className="bg-surface-strong border border-border/20 p-6 rounded-sm text-center flex flex-col items-center">
            <Brain className="text-[var(--color-pastel-purple)] mb-2 w-6 h-6" />
            <span className="text-[10px] uppercase tracking-widest text-[var(--color-pastel-purple)] mb-1">Memories</span>
            <span className="text-2xl font-bold text-[var(--color-pastel-purple)]">{agents.reduce((sum, agent) => sum + (agent.memoryCount || 0), 0)}</span>
            <span className="text-[10px] text-muted-foreground mt-1">Delta synced</span>
          </div>
        </div>

        {/* Search & Filter */}
        <section className="mb-12">
          <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-8">
            <div>
              <h2 className="text-3xl font-bold mb-2 text-foreground">Find the right agent fast</h2>
              <p className="text-muted-foreground">Search by name, persona, or goals.</p>
            </div>
            <div className="flex flex-wrap gap-2">
              {filters.map((filter) => {
                let bgColor = 'bg-surface-strong text-muted-foreground hover:bg-surface-strong/80 hover:text-foreground'
                if (statusFilter === filter) {
                  bgColor = 'bg-primary text-primary-foreground'
                }
                return (
                  <button
                    key={filter}
                    onClick={() => setStatusFilter(filter)}
                    className={`px-4 py-2 rounded-sm text-xs border border-border/40 font-bold uppercase tracking-wider transition-colors ${bgColor}`}
                  >
                    {filter}
                  </button>
                )
              })}
            </div>
          </div>
          <div className="relative max-w-3xl">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5 flex-shrink-0" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-[#111111] border-b-2 border-border/40 focus:border-primary px-12 py-5 rounded-t-sm outline-none text-lg transition-all focus:bg-surface text-foreground placeholder:text-muted-foreground/50 shadow-sm"
              placeholder="Search by name, persona, or goal"
              type="text"
            />
          </div>
        </section>

        {/* Agent Results Grid */}
        {loading ? (
          <section className="mb-16">
            <h5 className="text-xs font-bold text-muted-foreground uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
              Fetching more profiles
              <span className="w-12 h-[1px] bg-border/50"></span>
            </h5>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 opacity-40">
              {Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="bg-[#111111] p-6 rounded-sm border border-border/40 animate-pulse">
                  <div className="flex items-center gap-4 mb-6">
                    <div className="w-12 h-12 rounded-sm bg-surface-strong"></div>
                    <div className="flex-1 space-y-2">
                      <div className="h-4 bg-surface-strong w-2/3 rounded-sm"></div>
                      <div className="h-3 bg-surface-strong w-1/3 rounded-sm"></div>
                    </div>
                  </div>
                  <div className="space-y-2 mb-6">
                    <div className="h-3 bg-surface-strong w-full rounded-sm"></div>
                    <div className="h-3 bg-surface-strong w-5/6 rounded-sm"></div>
                  </div>
                  <div className="flex gap-2 mb-6">
                    <div className="h-5 bg-surface-strong w-16 rounded-sm"></div>
                    <div className="h-5 bg-surface-strong w-20 rounded-sm"></div>
                  </div>
                  <div className="flex justify-between pt-6 border-t border-border/40">
                    <div className="h-3 bg-surface-strong w-12 rounded-sm"></div>
                    <div className="h-3 bg-surface-strong w-16 rounded-sm"></div>
                    <div className="h-3 bg-surface-strong w-10 rounded-sm"></div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        ) : filteredAgents.length > 0 ? (
          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-16">
            {filteredAgents.map((agent) => (
              <motion.div
                key={agent.id}
                whileHover={{ y: -2 }}
                onClick={() => router.push(`/agents/${agent.id}`)}
                className="bg-[#111111] border border-border/40 p-6 rounded-sm translate-y-0 hover:border-primary/40 shadow-sm transition-all group cursor-pointer flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-start justify-between mb-6">
                    <div className="flex items-center gap-4">
                      <div className="w-12 h-12 rounded-sm bg-surface-strong border border-border/40 overflow-hidden flex items-center justify-center text-primary group-hover:bg-primary/5 transition-colors">
                        <PlaygroundLogo className="h-6 w-6" />
                      </div>
                      <div>
                        <h4 className="font-semibold text-lg text-foreground group-hover:text-primary transition-colors">{agent.name}</h4>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <span
                            className={`w-2 h-2 rounded-full ${
                              agent.status === 'active'
                                ? 'bg-[var(--gradient-5)]'
                                : agent.status === 'training'
                                  ? 'bg-[var(--gradient-4)]'
                                  : 'bg-muted-foreground'
                            }`}
                          ></span>
                          <span className="text-[10px] uppercase font-bold text-muted-foreground tracking-widest">{agent.status}</span>
                        </div>
                      </div>
                    </div>
                    <ArrowRight className="w-5 h-5 text-muted-foreground group-hover:text-primary transition-colors group-hover:translate-x-1" />
                  </div>
                  <p className="text-sm text-muted-foreground leading-relaxed mb-6 line-clamp-2">
                    {agent.persona}
                  </p>
                  <div className="flex flex-wrap gap-2 mb-6">
                    {agent.linguisticProfile && <span className="bg-surface-strong text-[10px] font-bold px-2.5 py-1 rounded-sm text-foreground uppercase tracking-tighter border border-border/40">Linguistics</span>}
                    {agent.psychologicalProfile && <span className="bg-surface-strong text-[10px] font-bold px-2.5 py-1 rounded-sm text-foreground uppercase tracking-tighter border border-border/40">Psychology</span>}
                    {(agent.relationshipCount || 0) > 0 && <span className="bg-surface-strong text-[10px] font-bold px-2.5 py-1 rounded-sm text-foreground uppercase tracking-tighter border border-border/40">{agent.relationshipCount} Relations</span>}
                  </div>
                </div>
                <div className="flex items-center justify-between pt-6 border-t border-border/40 text-[11px] text-muted-foreground uppercase font-medium tracking-widest">
                  <span>{agent.stats?.totalMessages || 0} Msgs</span>
                  <span>{agent.memoryCount || 0} Memories</span>
                  <span className="text-primary group-hover:brightness-110 transition-all">{agent.totalInteractions || 0} Turns</span>
                </div>
              </motion.div>
            ))}
          </section>
        ) : (
          <section className="bg-[#111111] border border-border/40 p-20 rounded-sm flex flex-col items-center text-center shadow-sm">
            <div className="w-16 h-16 bg-surface-strong border border-border/40 rounded-full flex items-center justify-center mb-6">
              <Search className="text-primary w-8 h-8" />
            </div>
            <h3 className="text-2xl font-bold mb-3 text-foreground">No matching agents found</h3>
            <p className="text-muted-foreground max-w-md mb-8">
              Your current filters didn&apos;t return any results. Try broadening your search terms or clearing the status filters.
            </p>
            <div className="flex gap-4">
              <button onClick={() => { setSearch(''); setStatusFilter('all'); }} className="bg-surface-strong border border-border/40 px-6 py-2.5 rounded-sm font-bold text-sm hover:bg-surface text-foreground transition-colors">Clear Filters</button>
              <button onClick={() => router.push('/agents/new')} className="bg-primary text-primary-foreground px-6 py-2.5 rounded-sm font-bold text-sm hover:brightness-110 transition-colors">Create New Agent</button>
            </div>
          </section>
        )}
      </main>
    </div>
  )
}
