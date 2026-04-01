'use client'

import { type ReactNode, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { GradientOrb } from '@/components/ui/animated-background'
import { useAgentStore } from '@/stores/agentStore'
import { useMessageStore } from '@/stores/messageStore'
import { SimulationService } from '@/lib/services/simulationService'
import { SimulationRecord } from '@/types/database'
import { ArrowRight, MessageCircle, Pause, Play, Plus, Trash2, Users, X } from 'lucide-react'
import { Textarea } from '@/components/ui/input'
import { LLMProviderToggle } from '@/components/llm/LLMProviderToggle'
import { getClientModelForProvider, LLM_PROVIDER_LABELS } from '@/lib/llm/clientPreference'
import { useLLMPreferenceStore } from '@/stores/llmPreferenceStore'

interface SimulationAgent {
  id: string
  name: string
  persona: string
  goals: string[]
  color: string
}

interface SimulationViewMetadata {
  initialPrompt?: string
  referrals?: Array<{
    agentId: string
    agentName: string
    score: number
  }>
  consensus?: Array<{
    topic: string
    consensusRating?: number
    confidence?: number
    recommendedPosition?: string
  }>
  conflicts?: Array<{
    id: string
    topic: string
    tension: number
    participants: Array<{ agentName: string }>
    actionItems?: string[]
  }>
  broadcasts?: Array<{
    id: string
    agentName: string
    topic: string
    summary: string
  }>
}

const agentColors = [
  'bg-violet-500',
  'bg-cyan-500',
  'bg-pink-500',
  'bg-amber-500',
  'bg-emerald-500',
  'bg-[var(--color-pastel-purple)]/20'
]

const agentTextColors = [
  'text-primary',
  'text-accent',
  'text-pink-500',
  'text-amber-500',
  'text-emerald-500',
  'text-[var(--color-pastel-purple)]'
]

const starterTopics = [
  'Design a better user onboarding experience for an AI product.',
  'Debate the tradeoffs between deep memory and low operational cost.',
  'Plan a collaborative product launch for a new AI assistant.',
]

export default function SimulationPage() {
  const { agents, fetchAgents } = useAgentStore()
  const { setCurrentRoom } = useMessageStore()
  const selectedProvider = useLLMPreferenceStore((state) => state.provider)

  const [simulations, setSimulations] = useState<SimulationRecord[]>([])
  const [selectedSimulation, setSelectedSimulation] = useState<string | null>(null)
  const [simulationAgents, setSimulationAgents] = useState<SimulationAgent[]>([])
  const [isRunning, setIsRunning] = useState(false)
  const [maxRounds, setMaxRounds] = useState(6)
  const [showAgentModal, setShowAgentModal] = useState(false)
  const [simulationTopic, setSimulationTopic] = useState(starterTopics[0])
  const [uiError, setUiError] = useState<string | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    void loadSimulations()
  }, [])

  useEffect(() => {
    if (agents.length === 0) {
      void fetchAgents()
    }
  }, [agents.length, fetchAgents])

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
      setUiError('Recent simulations could not be loaded.')
    }
  }

  const startNewSimulation = async () => {
    if (simulationAgents.length < 2) {
      setUiError('Select at least two agents before starting a simulation.')
      return
    }

    if (!simulationTopic.trim()) {
      setUiError('Add a simulation topic so the agents have a clear brief.')
      return
    }

    setUiError(null)
    setIsRunning(true)
    setSelectedSimulation(null)
    await runSimulation()
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
          maxRounds,
          initialPrompt: simulationTopic.trim(),
        })
      })

      if (!response.ok) {
        throw new Error('Failed to run simulation')
      }

      const simulation = await response.json()
      const now = new Date().toISOString()
      const simulationRecord: SimulationRecord = {
        id: simulation.simulationId,
        agents: simulationAgents.map((agent) => ({
          id: agent.id,
          name: agent.name,
          persona: agent.persona,
          goals: agent.goals
        })),
        messages: simulation.messages || [],
        maxRounds: simulation.maxRounds ?? maxRounds,
        createdAt: now,
        isComplete: simulation.isComplete ?? false,
        finalRound: simulation.currentRound ?? simulation.finalRound ?? 0,
        metadata: simulation.metadata ?? undefined
      }

      setSimulations((prev) => [simulationRecord, ...prev])
      setSelectedSimulation(simulationRecord.id)
      setIsRunning(false)
      await loadSimulations()
    } catch (error) {
      console.error('Simulation error:', error)
      setIsRunning(false)
      setUiError('Simulation failed. Try fewer agents or a shorter topic and run it again.')
    }
  }

  const stopSimulation = () => {
    setIsRunning(false)
  }

  const addAgentToSimulation = (agent: { id: string; name: string; persona: string; goals: string[] }) => {
    setUiError(null)

    const color = agentColors[simulationAgents.length % agentColors.length]
    const newAgent: SimulationAgent = {
      id: agent.id,
      name: agent.name,
      persona: agent.persona,
      goals: agent.goals,
      color
    }

    setSimulationAgents((prev) => [...prev, newAgent])
    setShowAgentModal(false)
  }

  const removeAgentFromSimulation = (agentId: string) => {
    setSimulationAgents((prev) => prev.filter((agent) => agent.id !== agentId))
  }

  const currentSimulation = simulations.find((simulation) => simulation.id === selectedSimulation)
  const currentSimulationMetadata = currentSimulation?.metadata as SimulationViewMetadata | undefined
  const availableAgents = useMemo(
    () => agents.filter((agent) => !simulationAgents.some((selected) => selected.id === agent.id)),
    [agents, simulationAgents]
  )

  return (
    <div className="relative min-h-screen pb-20 pt-28">
      <GradientOrb className="left-1/4 top-0 h-[36rem] w-[36rem] opacity-[0.18]" color="cyan" />
      <GradientOrb className="-right-14 bottom-0 h-[28rem] w-[28rem] opacity-[0.14]" color="pink" />

      <div className="page-shell space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-section px-6 py-7 sm:px-8"
        >
          <div className="grid gap-8 xl:grid-cols-[1.35fr_0.85fr]">
            <div className="page-story">
              <div className="page-kicker">
                <Users className="h-4 w-4" />
                Simulation lab
              </div>
              <h1 className="text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                Watch agents think together.
              </h1>
              <p className="page-intro">
                Use this page to assemble a small cast of agents, define a topic, and review how they collaborate, disagree, or converge over multiple rounds.
              </p>
              <div className="flex flex-wrap gap-3">
                <span className="soft-pill">{simulations.length} saved simulations</span>
                <span className="soft-pill">{agents.length} agents available</span>
                <span className="soft-pill">{simulationAgents.length} selected for next run</span>
                <span className="soft-pill capitalize">provider: {LLM_PROVIDER_LABELS[selectedProvider]}</span>
                <span className="soft-pill">model: {getClientModelForProvider(selectedProvider)}</span>
              </div>
            </div>

            <div className="rounded-sm border border-border/70 bg-background/[0.42] p-5 backdrop-blur-xl">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">How this works</div>
              <ol className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground">
                <li>1. Pick at least two agents.</li>
                <li>2. Describe the discussion topic or decision they should work through.</li>
                <li>3. Set the round limit and review the resulting transcript.</li>
              </ol>
              <div className="mt-5">
                <LLMProviderToggle compact />
              </div>
            </div>
          </div>
        </motion.section>

        <div className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="space-y-6">
            <div className="page-section px-6 py-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Configuration</div>
                  <h2 className="mt-2 text-2xl font-semibold text-foreground">Prepare the next simulation</h2>
                </div>
                <button
                  onClick={() => setShowAgentModal(true)}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-card/[0.62] px-4 text-sm font-medium text-foreground backdrop-blur-xl transition-all hover:border-primary/20"
                >
                  <Plus className="h-4 w-4" />
                  Add agent
                </button>
              </div>

              <div className="mt-6 space-y-5">
                <div>
                  <label className="text-sm font-medium text-foreground">Topic or scenario brief</label>
                  <Textarea
                    className="mt-2 min-h-[140px]"
                    value={simulationTopic}
                    onChange={(event) => setSimulationTopic(event.target.value)}
                    placeholder="Describe the discussion, conflict, or collaboration the agents should work through."
                  />
                  <div className="mt-3 flex flex-wrap gap-2">
                    {starterTopics.map((topic) => (
                      <button
                        key={topic}
                        onClick={() => setSimulationTopic(topic)}
                        className="soft-pill transition-colors hover:text-foreground"
                        type="button"
                      >
                        {topic}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                  <div>
                    <label className="text-sm font-medium text-foreground">Selected agents</label>
                    <div className="mt-2 space-y-3">
                      {simulationAgents.length === 0 ? (
                        <div className="rounded-sm border border-dashed border-border/70 bg-background/40 px-4 py-6 text-center text-sm text-muted-foreground">
                          Add at least two agents to begin.
                        </div>
                      ) : (
                        simulationAgents.map((agent) => (
                          <div
                            key={agent.id}
                            className="flex items-start gap-3 rounded-sm border border-border/70 bg-background/40 p-4"
                          >
                            <div className={`flex h-10 w-10 items-center justify-center rounded-sm ${agent.color} text-sm font-semibold text-white shadow-lg`}>
                              {agent.name.charAt(0)}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-medium text-foreground">{agent.name}</div>
                              <div className="line-clamp-2 text-sm leading-6 text-muted-foreground">{agent.persona}</div>
                            </div>
                            <button
                              onClick={() => removeAgentFromSimulation(agent.id)}
                              className="inline-flex h-9 w-9 items-center justify-center rounded-sm border border-border/70 bg-card/[0.58] text-muted-foreground transition-all hover:border-destructive/30 hover:text-destructive"
                              type="button"
                            >
                              <Trash2 className="h-4 w-4" />
                            </button>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div>
                    <label className="text-sm font-medium text-foreground">Max rounds</label>
                    <select
                      value={maxRounds}
                      onChange={(event) => setMaxRounds(parseInt(event.target.value, 10))}
                      className="mt-2 h-12 rounded-full border border-border/70 bg-card/[0.62] px-4 text-sm text-foreground outline-none backdrop-blur-xl transition-all focus:border-primary/25"
                    >
                      {[3, 4, 5, 6, 8, 10].map((num) => (
                        <option key={num} value={num}>
                          {num} rounds
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {uiError && (
                  <div className="rounded-sm border border-destructive/20 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {uiError}
                  </div>
                )}

                <div className="flex flex-col gap-3 sm:flex-row">
                  {!isRunning ? (
                    <button
                      onClick={() => void startNewSimulation()}
                      disabled={simulationAgents.length < 2}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_20px_48px_-26px_rgba(109,77,158,0.72)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
                      type="button"
                    >
                      <Play className="h-4 w-4" />
                      Start simulation
                    </button>
                  ) : (
                    <button
                      onClick={stopSimulation}
                      className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-rose-500 px-5 text-sm font-semibold text-white"
                      type="button"
                    >
                      <Pause className="h-4 w-4" />
                      Stop
                    </button>
                  )}

                  <button
                    onClick={() => setShowAgentModal(true)}
                    className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-border/70 bg-card/[0.62] px-5 text-sm font-semibold text-foreground backdrop-blur-xl transition-all hover:border-primary/20 hover:bg-card/[0.82]"
                    type="button"
                  >
                    Add more agents
                    <ArrowRight className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </div>

            <div className="page-section px-6 py-7">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Recent runs</div>
              <div className="mt-4 space-y-3">
                {simulations.length === 0 ? (
                  <div className="rounded-sm border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
                    No simulations have been saved yet.
                  </div>
                ) : (
                  simulations.slice(0, 6).map((simulation) => (
                    <button
                      key={simulation.id}
                      onClick={() => setSelectedSimulation(simulation.id)}
                      className={`block w-full rounded-sm border px-4 py-4 text-left transition-all ${
                        selectedSimulation === simulation.id
                          ? 'border-primary/20 bg-primary/10'
                          : 'border-border/70 bg-background/40 hover:border-primary/20 hover:bg-background/70'
                      }`}
                      type="button"
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div>
                          <div className="font-medium text-foreground">Simulation {simulation.id.slice(-6)}</div>
                          <div className="mt-1 text-sm text-muted-foreground">
                            {simulation.agents?.length ?? 0} agents • {simulation.messages.length} messages
                          </div>
                        </div>
                        <span className="soft-pill">
                          {simulation.isComplete ? 'complete' : 'in progress'}
                        </span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </div>
          </section>

          <section className="page-section overflow-hidden">
            {selectedSimulation && currentSimulation ? (
              <div className="flex h-full min-h-[46rem] flex-col">
                <div className="border-b border-border/60 px-6 py-6 sm:px-8">
                  <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Transcript</div>
                      <h2 className="mt-2 text-2xl font-semibold text-foreground">
                        Simulation {currentSimulation.id.slice(-6)}
                      </h2>
                      <p className="mt-2 text-sm leading-7 text-muted-foreground">
                        {currentSimulation.agents.length} agents, {currentSimulation.messages.length} messages, round {currentSimulation.finalRound}/{currentSimulation.maxRounds}
                      </p>
                      {currentSimulationMetadata?.initialPrompt && (
                        <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                          {currentSimulationMetadata.initialPrompt}
                        </p>
                      )}
                    </div>

                    <div className="flex flex-wrap gap-3">
                      {currentSimulation.agents.map((agent, index) => (
                        <div key={agent.id} className="flex items-center gap-2 rounded-full border border-border/70 bg-background/40 px-3 py-2">
                          <div className={`flex h-8 w-8 items-center justify-center rounded-full ${agentColors[index % agentColors.length]} text-xs font-semibold text-white`}>
                            {agent.name.charAt(0)}
                          </div>
                          <span className={`text-sm font-medium ${agentTextColors[index % agentTextColors.length]}`}>{agent.name}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="flex-1 overflow-y-auto px-6 py-6 sm:px-8">
                  {currentSimulation.messages.length === 0 ? (
                    <div className="flex h-full items-center justify-center text-center">
                      <div>
                        <MessageCircle className="mx-auto h-14 w-14 text-muted-foreground/35" />
                        <p className="mt-4 text-sm text-muted-foreground">This simulation has no transcript yet.</p>
                      </div>
                    </div>
                  ) : (
                    <div className="space-y-6">
                      {currentSimulationMetadata && (
                        <div className="space-y-4">
                          <div className="grid gap-4 md:grid-cols-4">
                            <InsightCard label="Referrals" value={currentSimulationMetadata.referrals?.length ?? 0} />
                            <InsightCard label="Consensus" value={currentSimulationMetadata.consensus?.length ?? 0} />
                            <InsightCard label="Conflicts" value={currentSimulationMetadata.conflicts?.length ?? 0} />
                            <InsightCard label="Broadcasts" value={currentSimulationMetadata.broadcasts?.length ?? 0} />
                          </div>

                          <div className="grid gap-4 xl:grid-cols-3">
                            <InsightPanel title="Expert Referrals">
                              {(currentSimulationMetadata.referrals?.length ?? 0) === 0 ? (
                                <p className="text-sm text-muted-foreground">No specialist referrals were needed for this run.</p>
                              ) : (
                                currentSimulationMetadata.referrals?.map((referral) => (
                                  <div key={referral.agentId} className="rounded-sm border border-border/60 bg-background/45 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-medium text-foreground">{referral.agentName}</span>
                                      <span className="text-sm font-semibold text-primary">{(referral.score * 100).toFixed(0)}%</span>
                                    </div>
                                  </div>
                                ))
                              )}
                            </InsightPanel>

                            <InsightPanel title="Consensus Signals">
                              {(currentSimulationMetadata.consensus?.length ?? 0) === 0 ? (
                                <p className="text-sm text-muted-foreground">The agents did not produce a strong consensus signal.</p>
                              ) : (
                                currentSimulationMetadata.consensus?.map((item) => {
                                  const confidence = item.consensusRating ?? item.confidence ?? 0
                                  return (
                                    <div key={item.topic} className="rounded-sm border border-border/60 bg-background/45 p-3">
                                      <div className="flex items-center justify-between gap-3">
                                        <span className="font-medium text-foreground">{item.topic}</span>
                                        <span className="text-sm font-semibold text-emerald-500">{(confidence * 100).toFixed(0)}%</span>
                                      </div>
                                      {item.recommendedPosition && (
                                        <p className="mt-2 text-sm text-muted-foreground">{item.recommendedPosition}</p>
                                      )}
                                    </div>
                                  )
                                })
                              )}
                            </InsightPanel>

                            <InsightPanel title="Conflicts & Broadcasts">
                              {(currentSimulationMetadata.conflicts?.length ?? 0) > 0 ? (
                                currentSimulationMetadata.conflicts?.slice(0, 2).map((conflict) => (
                                  <div key={conflict.id} className="rounded-sm border border-rose-500/20 bg-rose-500/5 p-3">
                                    <div className="flex items-center justify-between gap-3">
                                      <span className="font-medium text-foreground">{conflict.topic}</span>
                                      <span className="text-sm font-semibold text-rose-500">{(conflict.tension * 100).toFixed(0)}%</span>
                                    </div>
                                    <p className="mt-2 text-sm text-muted-foreground">
                                      {conflict.participants.map((participant) => participant.agentName).join(' vs ')}
                                    </p>
                                    {conflict.actionItems?.[0] && (
                                      <p className="mt-2 text-sm text-muted-foreground">{conflict.actionItems[0]}</p>
                                    )}
                                  </div>
                                ))
                              ) : (
                                <p className="text-sm text-muted-foreground">No high-tension conflict was persisted from this run.</p>
                              )}

                              {(currentSimulationMetadata.broadcasts?.length ?? 0) > 0 && (
                                <div className="space-y-3">
                                  {currentSimulationMetadata.broadcasts?.slice(0, 1).map((broadcast) => (
                                    <div key={broadcast.id} className="rounded-sm border border-cyan-500/20 bg-cyan-500/5 p-3">
                                      <div className="font-medium text-foreground">{broadcast.topic}</div>
                                      <p className="mt-2 text-sm text-muted-foreground">{broadcast.summary}</p>
                                      <p className="mt-2 text-xs text-muted-foreground">Broadcast by {broadcast.agentName}</p>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </InsightPanel>
                          </div>
                        </div>
                      )}

                      <div className="space-y-4">
                      {currentSimulation.messages.map((message, index) => {
                        const agentIndex = currentSimulation.agents.findIndex((agent) => agent.id === message.agentId)
                        const messageMetadata = message.metadata as {
                          toolsUsed?: string[]
                          referrals?: Array<{ agentId: string }>
                          consensus?: { topic: string; confidence: number }
                        } | undefined
                        return (
                          <motion.div
                            key={message.id}
                            initial={{ opacity: 0, y: 12 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.03 }}
                            className="flex items-start gap-3"
                          >
                            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-sm ${agentColors[agentIndex % agentColors.length]} text-sm font-semibold text-white shadow-lg`}>
                              {message.agentName.charAt(0)}
                            </div>

                            <div className="flex-1 rounded-sm border border-border/70 bg-background/45 p-4">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className={`text-sm font-semibold ${agentTextColors[agentIndex % agentTextColors.length]}`}>{message.agentName}</span>
                                <span className="text-xs text-muted-foreground">Round {message.round}</span>
                                {(messageMetadata?.toolsUsed?.length ?? 0) > 0 && (
                                  <span className="soft-pill">{messageMetadata?.toolsUsed?.length} tools</span>
                                )}
                                {(messageMetadata?.referrals?.length ?? 0) > 0 && (
                                  <span className="soft-pill">{messageMetadata?.referrals?.length} referrals</span>
                                )}
                                {messageMetadata?.consensus?.topic && (
                                  <span className="soft-pill">{messageMetadata.consensus.topic}</span>
                                )}
                              </div>
                              <p className="mt-3 text-sm leading-7 text-foreground/[0.92]">{message.content}</p>
                            </div>
                          </motion.div>
                        )
                      })}
                      </div>
                      <div ref={messagesEndRef} />
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div className="flex min-h-[46rem] items-center justify-center px-6 py-10 text-center sm:px-8">
                <div className="max-w-lg">
                  <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-sm bg-accent text-white shadow-[0_18px_44px_-24px_rgba(109,77,158,0.68)]">
                    <Users className="h-9 w-9" />
                  </div>
                  <h2 className="mt-6 text-2xl font-semibold text-foreground">Transcript area</h2>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                    Start a new simulation or open a previous one to review how the selected agents responded, argued, coordinated, and reached conclusions.
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>

        <AnimatePresence>
          {showAgentModal && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-md"
              onClick={() => setShowAgentModal(false)}
            >
              <motion.div
                initial={{ opacity: 0, y: 16, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 16, scale: 0.98 }}
                className="page-section max-h-[80vh] w-full max-w-3xl overflow-hidden"
                onClick={(event) => event.stopPropagation()}
              >
                <div className="flex items-center justify-between border-b border-border/60 px-6 py-5">
                  <div>
                    <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Roster</div>
                    <h3 className="mt-2 text-2xl font-semibold text-foreground">Add agents to the simulation</h3>
                  </div>
                  <button
                    onClick={() => setShowAgentModal(false)}
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/[0.62] text-muted-foreground transition-all hover:border-primary/20 hover:text-foreground"
                    type="button"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="max-h-[calc(80vh-6.5rem)] overflow-y-auto px-6 py-5">
                  {availableAgents.length === 0 ? (
                    <div className="rounded-sm border border-dashed border-border/70 bg-background/40 px-4 py-8 text-center text-sm text-muted-foreground">
                      All agents are already selected.
                    </div>
                  ) : (
                    <div className="grid gap-3">
                      {availableAgents.map((agent, index) => (
                        <button
                          key={agent.id}
                          onClick={() => addAgentToSimulation(agent)}
                          className="flex items-start gap-4 rounded-sm border border-border/70 bg-background/40 p-4 text-left transition-all hover:border-primary/20 hover:bg-background/70"
                          type="button"
                        >
                          <div className={`flex h-12 w-12 items-center justify-center rounded-sm ${agentColors[index % agentColors.length]} text-sm font-semibold text-white shadow-lg`}>
                            {agent.name.charAt(0)}
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="font-medium text-foreground">{agent.name}</div>
                            <div className="mt-1 line-clamp-2 text-sm leading-6 text-muted-foreground">{agent.persona}</div>
                          </div>
                          <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-muted-foreground" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}

function InsightCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-sm border border-border/70 bg-background/45 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">{label}</div>
      <div className="mt-3 text-3xl font-semibold text-foreground">{value}</div>
    </div>
  )
}

function InsightPanel({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="rounded-sm border border-border/70 bg-background/45 p-4">
      <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">{title}</div>
      <div className="mt-3 space-y-3">{children}</div>
    </div>
  )
}
