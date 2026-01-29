'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAgentStore } from '@/stores/agentStore'
import { Plus, Bot, Zap, MessageCircle, TrendingUp, Clock, ChevronRight, Sparkles, Users, type LucideIcon } from 'lucide-react'
import { GradientOrb } from '@/components/ui/animated-background'

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.08,
    },
  },
}

// Stat card component with animated number
function StatCard({
  icon: Icon,
  label,
  value,
  subtext,
  gradient,
  delay = 0,
}: {
  icon: LucideIcon
  label: string
  value: string | number
  subtext: string
  gradient: string
  delay?: number
}) {
  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ y: -4, transition: { duration: 0.2 } }}
      className={`stat-card stat-card-${gradient}`}
    >
      <div className="flex items-start justify-between mb-4">
        <div className={`icon-container icon-container-${gradient}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div className="flex items-center gap-1 text-xs text-emerald-400">
          <TrendingUp className="h-3 w-3" />
          <span>+12%</span>
        </div>
      </div>
      <div>
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: delay + 0.2, type: 'spring', stiffness: 200 }}
          className="text-4xl font-bold text-foreground mb-1"
        >
          {value}
        </motion.div>
        <div className="text-sm text-muted-foreground">{label}</div>
        <div className="text-xs text-muted-foreground/60 mt-1">{subtext}</div>
      </div>
    </motion.div>
  )
}

// Agent card component
function AgentCard({
  agent,
  onClick,
}: {
  agent: { id: string; name: string; persona: string; status: string; goals: string[]; createdAt: string }
  onClick: () => void
}) {
  const statusColors = {
    active: { bg: 'bg-emerald-500', glow: 'shadow-emerald-500/50' },
    training: { bg: 'bg-amber-500', glow: 'shadow-amber-500/50' },
    inactive: { bg: 'bg-gray-500', glow: '' },
  }
  const status = statusColors[agent.status as keyof typeof statusColors] || statusColors.inactive

  return (
    <motion.div
      variants={fadeInUp}
      whileHover={{ y: -8, transition: { duration: 0.3 } }}
      onClick={onClick}
      className="group relative p-6 rounded-2xl premium-card cursor-pointer"
    >
      {/* Animated gradient border on hover */}
      <div className="absolute inset-0 rounded-2xl bg-gradient-to-br from-violet-500 via-purple-500 to-pink-500 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl -z-10" />

      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center">
              <Bot className="h-6 w-6 text-white" />
            </div>
            {/* Status indicator */}
            <div className={`absolute -bottom-1 -right-1 w-4 h-4 rounded-full ${status.bg} ${status.glow} border-2 border-[#0a0a0f] shadow-lg`} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground group-hover:text-white transition-colors">
              {agent.name}
            </h3>
            <span className="text-xs text-muted-foreground capitalize">{agent.status}</span>
          </div>
        </div>
        <ChevronRight className="h-5 w-5 text-muted-foreground opacity-0 group-hover:opacity-100 group-hover:text-violet-400 transition-all transform group-hover:translate-x-1" />
      </div>

      {/* Description */}
      <p className="text-sm text-muted-foreground mb-4 line-clamp-2 leading-relaxed">
        {agent.persona}
      </p>

      {/* Footer */}
      <div className="flex items-center justify-between pt-4 border-t border-white/[0.06]">
        <div className="flex items-center gap-2 text-sm">
          <span className="text-violet-400 font-medium">{agent.goals.length}</span>
          <span className="text-muted-foreground">goals</span>
        </div>
        <div className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          <span>{new Date(agent.createdAt).toLocaleDateString()}</span>
        </div>
      </div>
    </motion.div>
  )
}

// Loading skeleton
function AgentCardSkeleton() {
  return (
    <div className="p-6 rounded-2xl premium-card">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-12 h-12 rounded-xl skeleton" />
        <div className="space-y-2">
          <div className="h-4 w-24 skeleton" />
          <div className="h-3 w-16 skeleton" />
        </div>
      </div>
      <div className="space-y-2 mb-4">
        <div className="h-3 w-full skeleton" />
        <div className="h-3 w-3/4 skeleton" />
      </div>
      <div className="flex justify-between pt-4 border-t border-white/[0.06]">
        <div className="h-3 w-16 skeleton" />
        <div className="h-3 w-20 skeleton" />
      </div>
    </div>
  )
}

// Empty state
function EmptyState({ onCreateClick }: { onCreateClick: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="col-span-full relative overflow-hidden rounded-3xl p-12 text-center"
    >
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 via-purple-500/5 to-pink-500/5 rounded-3xl" />
      <div className="absolute inset-[1px] bg-[#0a0a0f]/80 rounded-3xl backdrop-blur-xl" />

      <div className="relative z-10 space-y-6">
        <motion.div
          animate={{
            y: [0, -10, 0],
          }}
          transition={{
            duration: 3,
            repeat: Infinity,
            ease: 'easeInOut',
          }}
          className="w-24 h-24 mx-auto rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/30"
        >
          <Bot className="h-12 w-12 text-white" />
        </motion.div>

        <div className="space-y-2">
          <h3 className="text-2xl font-bold text-foreground">No agents yet</h3>
          <p className="text-muted-foreground max-w-md mx-auto">
            Create your first AI agent to get started with intelligent conversations and task automation
          </p>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={onCreateClick}
          className="inline-flex items-center gap-2 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 transition-all"
        >
          <Sparkles className="h-5 w-5" />
          Create Your First Agent
        </motion.button>
      </div>

      {/* Decorative */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-violet-500/10 rounded-full blur-3xl" />
      <div className="absolute bottom-0 left-0 w-64 h-64 bg-pink-500/10 rounded-full blur-3xl" />
    </motion.div>
  )
}

export default function Dashboard() {
  const router = useRouter()
  const { agents, loading, fetchAgents } = useAgentStore()

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  const stats = {
    totalAgents: agents.length,
    activeAgents: agents.filter(a => a.status === 'active').length,
    totalMessages: agents.reduce((sum, a) => sum + (a.memoryCount || 0) * 5, 0) || 247,
  }

  return (
    <div className="relative min-h-screen pt-28 pb-20">
      {/* Decorative orbs */}
      <GradientOrb className="w-[600px] h-[600px] -top-[200px] -right-[200px] opacity-20" color="violet" />
      <GradientOrb className="w-[400px] h-[400px] top-1/2 -left-[200px] opacity-15" color="cyan" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-6"
        >
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="text-foreground">Agent </span>
              <span className="gradient-text-vibrant">Dashboard</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Manage and interact with your AI agents
            </p>
          </div>

          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => router.push('/agents/new')}
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 transition-shadow w-fit"
          >
            <Plus className="h-5 w-5" />
            Create Agent
          </motion.button>
        </motion.div>

        {/* Stats */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6"
        >
          <StatCard
            icon={Bot}
            label="Total Agents"
            value={stats.totalAgents}
            subtext="All time created"
            gradient="purple"
            delay={0}
          />
          <StatCard
            icon={Zap}
            label="Active Agents"
            value={stats.activeAgents}
            subtext="Currently online"
            gradient="cyan"
            delay={0.1}
          />
          <StatCard
            icon={MessageCircle}
            label="Total Messages"
            value={stats.totalMessages.toLocaleString()}
            subtext="Across all agents"
            gradient="pink"
            delay={0.2}
          />
        </motion.div>

        {/* Agents Section */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-foreground">Your Agents</h2>
              <p className="text-sm text-muted-foreground">Click on an agent to view details and chat</p>
            </div>
            {agents.length > 0 && (
              <motion.button
                whileHover={{ x: 4 }}
                className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
              >
                View All
                <ChevronRight className="h-4 w-4" />
              </motion.button>
            )}
          </div>

          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6"
          >
            {loading ? (
              // Loading skeletons
              Array.from({ length: 6 }).map((_, i) => (
                <AgentCardSkeleton key={i} />
              ))
            ) : agents.length > 0 ? (
              agents.map((agent) => (
                <AgentCard
                  key={agent.id}
                  agent={agent}
                  onClick={() => router.push(`/agents/${agent.id}`)}
                />
              ))
            ) : (
              <EmptyState onCreateClick={() => router.push('/agents/new')} />
            )}
          </motion.div>
        </div>

        {/* Quick Actions */}
        {agents.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="grid grid-cols-1 md:grid-cols-2 gap-6"
          >
            <motion.div
              whileHover={{ y: -4 }}
              onClick={() => router.push('/simulation')}
              className="group p-6 rounded-2xl premium-card cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="icon-container icon-container-cyan">
                  <Users className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground group-hover:text-cyan-400 transition-colors">
                    Multi-Agent Simulation
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Watch your agents collaborate and interact
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-cyan-400 group-hover:translate-x-1 transition-all" />
              </div>
            </motion.div>

            <motion.div
              whileHover={{ y: -4 }}
              onClick={() => router.push('/agents/new')}
              className="group p-6 rounded-2xl premium-card cursor-pointer"
            >
              <div className="flex items-center gap-4">
                <div className="icon-container icon-container-pink">
                  <Sparkles className="h-6 w-6" />
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-foreground group-hover:text-pink-400 transition-colors">
                    Create New Agent
                  </h3>
                  <p className="text-sm text-muted-foreground">
                    Design an AI agent with custom personality
                  </p>
                </div>
                <ChevronRight className="h-5 w-5 text-muted-foreground group-hover:text-pink-400 group-hover:translate-x-1 transition-all" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </div>
    </div>
  )
}
