'use client'

import { useState, useEffect, useRef } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAgentStore } from '@/stores/agentStore'
import { useMessageStore } from '@/stores/messageStore'
import { SimulationService } from '@/lib/services/simulationService'
import { Bot, Users, MessageCircle, Plus, Play, Pause, Trash2 } from 'lucide-react'
import { SimulationRecord } from '@/types/database'

interface SimulationAgent {
  id: string
  name: string
  persona: string
  goals: string[]
  color: string
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
    'from-blue-500 to-blue-600',
    'from-green-500 to-green-600',
    'from-purple-500 to-purple-600',
    'from-orange-500 to-orange-600',
    'from-pink-500 to-pink-600',
    'from-indigo-500 to-indigo-600'
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
        // Refresh simulations list
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
    <div className="min-h-screen bg-gradient-to-br from-background via-background/90 to-background/50 p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-3">
            <h1 className="text-5xl font-bold tracking-tight text-foreground bg-gradient-to-r from-foreground to-primary/80 bg-clip-text">
              Multi-Agent Simulation
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Watch AI agents collaborate and interact in real-time conversations
            </p>
          </div>
          <Button className="gap-2 px-6 py-3 text-base font-medium">
            <Plus className="h-5 w-5" />
            New Simulation
          </Button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Simulation Controls Sidebar */}
          <div className="space-y-6">
            {/* Agent Selection */}
            <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
              <CardHeader className="space-y-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  Simulation Setup
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Agent Cards */}
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Selected Agents</h4>
                  {simulationAgents.length === 0 ? (
                    <div className="text-center py-4 text-muted-foreground text-sm">
                      No agents selected
                    </div>
                  ) : (
                    simulationAgents.map((agent) => (
                      <div key={agent.id} className="flex items-center gap-3 p-3 rounded-lg bg-muted/30">
                        <div className={`w-3 h-3 rounded-full bg-gradient-to-r ${agent.color}`} />
                        <span className="flex-1 text-sm font-medium">{agent.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeAgentFromSimulation(agent.id)}
                          className="h-6 w-6 p-0 hover:bg-destructive/10"
                        >
                          <Trash2 className="h-3 w-3" />
                        </Button>
                      </div>
                    ))
                  )}
                </div>

                {/* Add Agent Button */}
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAgentModal(true)}
                  className="w-full gap-2"
                >
                  <Plus className="h-4 w-4" />
                  Add Agent
                </Button>

                {/* Simulation Controls */}
                <div className="space-y-3 pt-4 border-t border-border/50">
                  <div className="flex items-center gap-2">
                    <label className="text-sm font-medium text-muted-foreground">Max Rounds:</label>
                    <select
                      value={maxRounds}
                      onChange={(e) => setMaxRounds(parseInt(e.target.value))}
                      className="px-2 py-1 rounded text-sm bg-muted border border-border"
                    >
                      {[3, 4, 5, 6, 8, 10].map(num => (
                        <option key={num} value={num}>{num}</option>
                      ))}
                    </select>
                  </div>

                  <div className="flex gap-2">
                    {!isRunning ? (
                      <Button
                        onClick={startNewSimulation}
                        disabled={simulationAgents.length < 2}
                        className="flex-1 gap-2"
                      >
                        <Play className="h-4 w-4" />
                        Start Simulation
                      </Button>
                    ) : (
                      <Button
                        onClick={stopSimulation}
                        variant="destructive"
                        className="flex-1 gap-2"
                      >
                        <Pause className="h-4 w-4" />
                        Stop
                      </Button>
                    )}
                  </div>

                  {isRunning && (
                    <div className="text-center">
                      <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 text-primary text-sm">
                        <div className="w-2 h-2 bg-primary rounded-full animate-pulse" />
                        Running simulation...
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Recent Simulations */}
            <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3 text-lg">
                  <MessageCircle className="h-5 w-5" />
                  Recent Simulations
                </CardTitle>
              </CardHeader>
              <CardContent>
                {simulations.length === 0 ? (
                  <div className="text-center py-4 text-muted-foreground text-sm">
                    No simulations yet
                  </div>
                ) : (
                  <div className="space-y-2">
                    {simulations.slice(0, 5).map((simulation) => (
                      <button
                        key={simulation.id}
                        onClick={() => setSelectedSimulation(simulation.id)}
                        className={`w-full text-left p-3 rounded-lg border transition-all ${
                          selectedSimulation === simulation.id
                            ? 'border-primary bg-primary/5'
                            : 'border-border/50 hover:border-border'
                        }`}
                      >
                        <div className="text-sm font-medium truncate">
                          {simulation.agents.length} agents • {simulation.messages.length} messages
                        </div>
                        <div className="text-xs text-muted-foreground">
                          {new Date(simulation.createdAt).toLocaleDateString()}
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>

          {/* Main Simulation Area */}
          <div className="lg:col-span-3">
            {selectedSimulation && currentSimulation ? (
              <Card className="h-[700px] flex flex-col backdrop-blur-sm bg-card/80 border-0 shadow-2xl">
                <CardHeader className="border-b border-border/50 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <CardTitle className="flex items-center gap-3 text-2xl">
                        <MessageCircle className="h-6 w-6" />
                        Simulation {currentSimulation.id.slice(-8)}
                      </CardTitle>
                      <CardDescription>
                        {currentSimulation.agents.length} agents • {currentSimulation.messages.length} exchanges
                      </CardDescription>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-muted-foreground">
                        Round {currentSimulation.finalRound}/{currentSimulation.maxRounds}
                      </div>
                      <div className={`w-2 h-2 rounded-full ${
                        currentSimulation.isComplete ? 'bg-green-400' : 'bg-yellow-400'
                      }`} />
                    </div>
                  </div>

                  {/* Agent Avatars */}
                  <div className="flex gap-3">
                    {currentSimulation.agents.map((agent, index) => (
                      <div key={agent.id} className="flex flex-col items-center gap-2">
                        <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${agentColors[index % agentColors.length]} flex items-center justify-center shadow-lg`}>
                          <span className="text-white font-bold text-sm">
                            {agent.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <span className="text-xs font-medium text-center max-w-[80px] truncate">
                          {agent.name}
                        </span>
                      </div>
                    ))}
                  </div>
                </CardHeader>

                {/* Messages */}
                <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                  {currentSimulation.messages.length === 0 ? (
                    <div className="flex items-center justify-center h-full text-center">
                      <div className="space-y-4">
                        <MessageCircle className="h-16 w-16 text-muted-foreground mx-auto" />
                        <div className="space-y-2">
                          <h3 className="text-xl font-semibold text-foreground">No conversation yet</h3>
                          <p className="text-muted-foreground max-w-md">
                            This simulation hasn&apos;t started or completed yet
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : (
                    currentSimulation.messages.map((message, index) => {
                      const agent = currentSimulation.agents.find(a => a.id === message.agentId)
                      const agentIndex = currentSimulation.agents.findIndex(a => a.id === message.agentId)

                      return (
                        <div
                          key={message.id}
                          className={`flex gap-4 ${message.agentId === 'user' ? 'justify-end' : 'justify-start'}`}
                          style={{
                            animationDelay: `${index * 100}ms`,
                            animation: 'fadeIn 0.4s ease-out forwards'
                          }}
                        >
                          {message.agentId !== 'user' && (
                            <div className={`w-10 h-10 rounded-full bg-gradient-to-r ${agentColors[agentIndex % agentColors.length]} flex items-center justify-center flex-shrink-0 shadow-lg`}>
                              <span className="text-white font-bold text-sm">
                                {agent?.name.charAt(0).toUpperCase() || '?'}
                              </span>
                            </div>
                          )}

                          <div className={`max-w-[70%] ${message.agentId === 'user' ? 'order-last' : ''}`}>
                            <div className={`rounded-2xl px-4 py-3 shadow-sm ${
                              message.agentId === 'user'
                                ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground'
                                : `bg-gradient-to-br ${agentColors[agentIndex % agentColors.length]} text-white`
                            }`}>
                              <div className="flex items-center gap-2 mb-1">
                                <span className="font-medium text-sm">
                                  {message.agentName}
                                </span>
                                <span className={`text-xs ${message.agentId === 'user' ? 'text-primary-foreground/70' : 'text-white/70'}`}>
                                  Round {message.round}
                                </span>
                              </div>
                              <p className="text-sm leading-relaxed">{message.content}</p>
                              <p className={`text-xs mt-2 ${message.agentId === 'user' ? 'text-primary-foreground/70' : 'text-white/70'}`}>
                                {new Date(message.timestamp).toLocaleTimeString()}
                              </p>
                            </div>
                          </div>
                        </div>
                      )
                    })
                  )}

                  <div ref={messagesEndRef} />
                </CardContent>
              </Card>
            ) : (
              <Card className="h-[700px] flex items-center justify-center backdrop-blur-sm bg-card/80 border-0 shadow-2xl">
                <CardContent className="text-center space-y-4">
                  <Users className="h-16 w-16 text-muted-foreground mx-auto" />
                  <div className="space-y-2">
                    <h3 className="text-xl font-semibold text-foreground">No Simulation Selected</h3>
                    <p className="text-muted-foreground max-w-md">
                      Select a simulation from the sidebar or start a new one to view the conversation
                    </p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Agent Selection Modal */}
        {showAgentModal && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center p-6 z-50">
            <Card className="w-full max-w-2xl backdrop-blur-sm bg-card/95 border-0 shadow-2xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-3">
                  <Bot className="h-6 w-6" />
                  Add Agent to Simulation
                </CardTitle>
                <CardDescription>
                  Select an existing agent to add to the simulation
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                  {agents.map((agent) => {
                    const alreadySelected = simulationAgents.some(sa => sa.id === agent.id)
                    return (
                      <button
                        key={agent.id}
                        onClick={() => !alreadySelected && addAgentToSimulation(agent)}
                        disabled={alreadySelected}
                        className={`flex items-center gap-4 p-4 rounded-lg border text-left transition-all ${
                          alreadySelected
                            ? 'border-muted bg-muted/30 opacity-50'
                            : 'border-border hover:border-primary/50 hover:bg-muted/20'
                        }`}
                      >
                        <div className="w-10 h-10 rounded-full bg-gradient-to-r from-primary to-primary/80 flex items-center justify-center flex-shrink-0">
                          <span className="text-primary-foreground font-bold text-sm">
                            {agent.name.charAt(0).toUpperCase()}
                          </span>
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-sm">{agent.name}</div>
                          <div className="text-xs text-muted-foreground truncate">
                            {agent.persona}
                          </div>
                        </div>
                        {alreadySelected && (
                          <span className="text-xs text-muted-foreground">Already added</span>
                        )}
                      </button>
                    )
                  })}
                </div>

                <div className="flex justify-end gap-3 pt-4 border-t border-border/50">
                  <Button variant="outline" onClick={() => setShowAgentModal(false)}>
                    Cancel
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}
