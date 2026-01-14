'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAgentStore } from '@/stores/agentStore'
import { useMessageStore } from '@/stores/messageStore'
import { SimulationService } from '@/lib/services/simulationService'
import { Bot, Users, MessageCircle, Plus, Play, Pause, Trash2, X, Sparkles, Clock, ChevronRight } from 'lucide-react'
import { SimulationRecord } from '@/types/database'
import { GradientOrb } from '@/components/ui/animated-background'

interface SimulationAgent {
  id: string
  name: string
  persona: string
  goals: string[]
  color: string
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
  exit: { opacity: 0, y: -20 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.05,
    },
  },
}

export default function Simulation() {
  const { agents } = useAgentStore()
  const { setCurrentRoom } = useMessageStore()

  const [simulations, setSimulations] = useState<SimulationRecord[]>([])
  const [selectedSimulation, setSelectedSimulation] = useState<string | null>(null)
  const [simulationAgents, setSimulationAgents] = useState<SimulationAgent[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [maxRounds, setMaxRounds] = useState(6)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Color palette for agents
  const agentColors = [
    'from-violet-500 to-purple-600',
    'from-cyan-500 to-blue-600',
    'from-pink-500 to-rose-600',
    'from-amber-500 to-orange-600',
    'from-emerald-500 to-green-600',
    'from-indigo-500 to-blue-600'
  ]

  const agentTextColors = [
    'text-violet-400',
    'text-cyan-400',
    'text-pink-400',
    'text-amber-400',
    'text-emerald-400',
    'text-indigo-400'
  ]

  useEffect(() => {
    loadSimulations()
  }, [])

  useEffect(() => {
    if (selectedSimulation) {
      setCurrentRoom(selectedSimulation)
    }
  }, [selectedSimulation, setCurrentRoom])

  const loadSimulations = async () => {
    try {
      const sims = await SimulationService.getRecentSimulations(10)
      setSimulations(sims)
    } catch (error) {
      console.error('Failed to load simulations:', error)
    }
  }

  const startNewSimulation = () => {
    if (simulationAgents.length < 2) {
      alert('Please add at least 2 agents to start a simulation')
      return
    }

    setIsRunning(true)
    setSelectedSimulation(null)
    runSimulation()
  }

  const runSimulation = async () => {
    try {
      const response = await fetch('/api/multiagent', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          agents: simulationAgents,
          maxRounds: maxRounds,
          initialPrompt: 'Start a conversation about improving user experience in AI applications.'
        })
      })

      if (response.ok) {
        const simulation = await response.json()
        setSimulations(prev => [simulation, ...prev])
        setSelectedSimulation(simulation.simulationId)
        setIsRunning(false)
        loadSimulations()
      } else {
        throw new Error('Failed to run simulation')
      }
    } catch (error) {
      console.error('Simulation error:', error)
      setIsRunning(false)
      alert('Failed to run simulation. Please try again.')
    }
  }

  const stopSimulation = () => {
    setIsRunning(false)
  }

  const addAgentToSimulation = (agent: { id: string; name: string; persona: string; goals: string[] }) => {
    const color = agentColors[simulationAgents.length % agentColors.length]
    const newAgent: SimulationAgent = {
      id: agent.id,
      name: agent.name,
      persona: agent.persona,
      goals: agent.goals,
      color
    }

    setSimulationAgents(prev => [...prev, newAgent])
    setShowAgentModal(false)
  }

  const removeAgentFromSimulation = (agentId: string) => {
    setSimulationAgents(prev => prev.filter(agent => agent.id !== agentId))
  }

  const currentSimulation = simulations.find(s => s.id === selectedSimulation)

  return (
    <div className="relative min-h-screen pt-28 pb-20">
      {/* Decorative orbs */}
      <GradientOrb className="w-[600px] h-[600px] -top-[200px] left-1/4 opacity-20" color="cyan" />
      <GradientOrb className="w-[400px] h-[400px] bottom-0 -right-[100px] opacity-15" color="pink" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 space-y-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col sm:flex-row sm:items-center justify-between gap-6"
        >
          <div className="space-y-2">
            <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
              <span className="text-foreground">Multi-Agent </span>
              <span className="gradient-text-vibrant">Simulation</span>
            </h1>
            <p className="text-lg text-muted-foreground">
              Watch AI agents collaborate and interact in real-time
            </p>
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Simulation Controls Sidebar */}
          <motion.div
            initial="initial"
            animate="animate"
            variants={staggerContainer}
            className="space-y-6"
          >
            {/* Agent Selection */}
            <motion.div variants={fadeInUp} className="p-6 rounded-2xl premium-card">
              <div className="flex items-center gap-3 mb-6">
                <div className="icon-container icon-container-purple">
                  <Bot className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">Simulation Setup</h3>
              </div>

              {/* Agent Cards */}
              <div className="space-y-3 mb-6">
                <h4 className="text-sm font-medium text-muted-foreground">Selected Agents</h4>
                <AnimatePresence mode="popLayout">
                  {simulationAgents.length === 0 ? (
                    <motion.div
                      initial={{ opacity: 0 }}
                      animate={{ opacity: 1 }}
                      className="text-center py-4 text-muted-foreground/60 text-sm"
                    >
                      No agents selected
                    </motion.div>
                  ) : (
                    simulationAgents.map((agent, index) => (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: 20 }}
                        className="group flex items-center gap-3 p-3 rounded-xl bg-white/[0.02] border border-white/[0.06] hover:border-white/[0.1] transition-colors"
                      >
                        <div className={`w-8 h-8 rounded-lg bg-gradient-to-br ${agent.color} flex items-center justify-center shadow-lg`}>
                          <span className="text-white font-bold text-xs">
                            {agent.name.charAt(0)}
                          </span>
                        </div>
                        <span className="flex-1 text-sm font-medium">{agent.name}</span>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => removeAgentFromSimulation(agent.id)}
                          className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-all"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </motion.button>
                      </motion.div>
                    ))
                  )}
                </AnimatePresence>
              </div>

              {/* Add Agent Button */}
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => setShowAgentModal(true)}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/[0.1] text-muted-foreground hover:text-foreground hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Agent
              </motion.button>

              {/* Simulation Controls */}
              <div className="space-y-4 pt-6 mt-6 border-t border-white/[0.06]">
                <div className="flex items-center justify-between">
                  <label className="text-sm text-muted-foreground">Max Rounds</label>
                  <select
                    value={maxRounds}
                    onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                    className="px-3 py-1.5 rounded-lg text-sm bg-white/[0.03] border border-white/[0.08] focus:border-violet-500/50 outline-none transition-colors"
                  >
                    {[3, 4, 5, 6, 8, 10].map(num => (
                      <option key={num} value={num}>{num}</option>
                    ))}
                  </select>
                </div>

                <div className="flex gap-2">
                  {!isRunning ? (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={startNewSimulation}
                      disabled={simulationAgents.length < 2}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-medium shadow-lg shadow-violet-500/25 hover:shadow-violet-500/40 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                    >
                      <Play className="h-4 w-4" />
                      Start
                    </motion.button>
                  ) : (
                    <motion.button
                      whileHover={{ scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={stopSimulation}
                      className="flex-1 flex items-center justify-center gap-2 py-3 rounded-xl bg-gradient-to-r from-red-500 to-rose-600 text-white font-medium"
                    >
                      <Pause className="h-4 w-4" />
                      Stop
                    </motion.button>
                  )}
                </div>

                {isRunning && (
                  <div className="flex items-center justify-center gap-2 py-2 px-4 rounded-full bg-violet-500/10 text-violet-400 text-sm">
                    <span className="relative flex h-2 w-2">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                      <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
                    </span>
                    Running simulation...
                  </div>
                )}
              </div>
            </motion.div>

            {/* Recent Simulations */}
            <motion.div variants={fadeInUp} className="p-6 rounded-2xl premium-card">
              <div className="flex items-center gap-3 mb-4">
                <div className="icon-container icon-container-cyan">
                  <MessageCircle className="h-5 w-5" />
                </div>
                <h3 className="font-semibold text-foreground">Recent</h3>
              </div>

              {simulations.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground/60 text-sm">
                  No simulations yet
                </div>
              ) : (
                <div className="space-y-2">
                  {simulations.slice(0, 5).map((simulation) => (
                    <motion.button
                      key={simulation.id}
                      whileHover={{ x: 4 }}
                      onClick={() => setSelectedSimulation(simulation.id)}
                      className={`w-full text-left p-3 rounded-xl border transition-all ${
                        selectedSimulation === simulation.id
                          ? 'border-violet-500/50 bg-violet-500/10'
                          : 'border-white/[0.06] hover:border-white/[0.1] hover:bg-white/[0.02]'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-sm font-medium">
                          {simulation.agents.length} agents
                        </span>
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {new Date(simulation.createdAt).toLocaleDateString()}
                      </div>
                    </motion.button>
                  ))}
                </div>
              )}
            </motion.div>
          </motion.div>

          {/* Main Simulation Area */}
          <div className="lg:col-span-3">
            {selectedSimulation && currentSimulation ? (
              <motion.div
                initial={{ opacity: 0, scale: 0.98 }}
                animate={{ opacity: 1, scale: 1 }}
                className="h-[700px] flex flex-col rounded-2xl premium-card overflow-hidden"
              >
                {/* Header */}
                <div className="p-6 border-b border-white/[0.06]">
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-xl font-semibold text-foreground flex items-center gap-2">
                        <Sparkles className="h-5 w-5 text-violet-400" />
                        Simulation #{currentSimulation.id.slice(-6)}
                      </h2>
                      <p className="text-sm text-muted-foreground">
                        {currentSimulation.agents.length} agents - {currentSimulation.messages.length} messages
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm text-muted-foreground">
                        Round {currentSimulation.finalRound}/{currentSimulation.maxRounds}
                      </span>
                      <div className={`w-3 h-3 rounded-full ${
                        currentSimulation.isComplete
                          ? 'bg-emerald-400 shadow-lg shadow-emerald-400/50'
                          : 'bg-amber-400 shadow-lg shadow-amber-400/50 animate-pulse'
                      }`} />
                    </div>
                  </div>

                  {/* Agent Avatars */}
                  <div className="flex gap-4">
                    {currentSimulation.agents.map((agent, index) => (
                      <motion.div
                        key={agent.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 }}
                        className="flex flex-col items-center gap-2"
                      >
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${agentColors[index % agentColors.length]} flex items-center justify-center shadow-lg`}>
                          <span className="text-white font-bold">
                            {agent.name.charAt(0)}
                          </span>
                        </div>
                        <span className={`text-xs font-medium ${agentTextColors[index % agentTextColors.length]}`}>
                          {agent.name}
                        </span>
                      </motion.div>
                    ))}
                  </div>
                </div>

                {/* Messages */}
                <div className="flex-1 overflow-y-auto p-6 space-y-4">
                  {currentSimulation.messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full">
                      <div className="text-center space-y-4">
                        <MessageCircle className="h-16 w-16 text-muted-foreground/30 mx-auto" />
                        <p className="text-muted-foreground">No messages yet</p>
                      </div>
                    </div>
                  ) : (
                    <AnimatePresence>
                      {currentSimulation.messages.map((message, index) => {
                        const agentIndex = currentSimulation.agents.findIndex(a => a.id === message.agentId)

                        return (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 20 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.05 }}
                            className="flex gap-3"
                          >
                            <div className={`w-10 h-10 rounded-xl bg-gradient-to-br ${agentColors[agentIndex % agentColors.length]} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                              <span className="text-white font-bold text-sm">
                                {message.agentName.charAt(0)}
                              </span>
                            </div>

                            <div className="flex-1 p-4 rounded-2xl bg-white/[0.02] border border-white/[0.06]">
                              <div className="flex items-center gap-2 mb-2">
                                <span className={`font-medium text-sm ${agentTextColors[agentIndex % agentTextColors.length]}`}>
                                  {message.agentName}
                                </span>
                                <span className="text-xs text-muted-foreground/60">
                                  Round {message.round}
                                </span>
                              </div>
                              <p className="text-sm text-foreground/90 leading-relaxed">
                                {message.content}
                              </p>
                            </div>
                          </motion.div>
                        )
                      })}
                    </AnimatePresence>
                  )}
                  <div ref={messagesEndRef} />
                </div>
              </motion.div>
            ) : (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="h-[700px] flex items-center justify-center rounded-2xl premium-card"
              >
                <div className="text-center space-y-6">
                  <motion.div
                    animate={{ y: [0, -10, 0] }}
                    transition={{ duration: 3, repeat: Infinity }}
                    className="w-20 h-20 mx-auto rounded-2xl bg-gradient-to-br from-cyan-500 to-blue-600 flex items-center justify-center shadow-2xl shadow-cyan-500/30"
                  >
                    <Users className="h-10 w-10 text-white" />
                  </motion.div>
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">No Simulation Selected</h3>
                    <p className="text-muted-foreground max-w-md">
                      Select a simulation from the sidebar or start a new one
                    </p>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>

        {/* Agent Selection Modal */}
        <AnimatePresence>
          {showAgentModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-6 z-50"
              onClick={() => setShowAgentModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95, y: 20 }}
                className="w-full max-w-2xl p-6 rounded-2xl premium-card"
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center justify-between mb-6">
                  <div className="flex items-center gap-3">
                    <div className="icon-container icon-container-purple">
                      <Bot className="h-5 w-5" />
                    </div>
                    <div>
                      <h3 className="font-semibold text-foreground">Add Agent</h3>
                      <p className="text-sm text-muted-foreground">Select an agent for the simulation</p>
                    </div>
                  </div>
                  <motion.button
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.9 }}
                    onClick={() => setShowAgentModal(false)}
                    className="p-2 rounded-lg hover:bg-white/[0.05] text-muted-foreground hover:text-foreground transition-colors"
                  >
                    <X className="h-5 w-5" />
                  </motion.button>
                </div>

                <div className="space-y-2 max-h-[400px] overflow-y-auto">
                  {agents.map((agent, index) => {
                    const alreadySelected = simulationAgents.some(sa => sa.id === agent.id)
                    return (
                      <motion.button
                        key={agent.id}
                        initial={{ opacity: 0, y: 10 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.05 }}
                        onClick={() => !alreadySelected && addAgentToSimulation(agent)}
                        disabled={alreadySelected}
                        className={`w-full flex items-center gap-4 p-4 rounded-xl border text-left transition-all ${
                          alreadySelected
                            ? 'border-white/[0.04] bg-white/[0.01] opacity-50 cursor-not-allowed'
                            : 'border-white/[0.06] hover:border-violet-500/30 hover:bg-violet-500/5'
                        }`}
                      >
                        <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${agentColors[index % agentColors.length]} flex items-center justify-center shadow-lg`}>
                          <span className="text-white font-bold">
                            {agent.name.charAt(0)}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-foreground">{agent.name}</div>
                          <div className="text-sm text-muted-foreground line-clamp-1">{agent.persona}</div>
                        </div>
                        {alreadySelected && (
                          <span className="text-xs text-muted-foreground px-3 py-1 rounded-full bg-white/[0.05]">
                            Added
                          </span>
                        )}
                      </motion.button>
                    )
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
