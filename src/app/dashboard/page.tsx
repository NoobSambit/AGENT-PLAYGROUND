'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { useAgentStore } from '@/stores/agentStore'
import { Plus, Bot, Zap, Users } from 'lucide-react'

export default function Dashboard() {
  const router = useRouter()
  const { agents, loading, fetchAgents } = useAgentStore()

  useEffect(() => {
    fetchAgents()
  }, [fetchAgents])

  // Mock data for demonstration
  const mockStats = {
    totalAgents: agents.length || 3,
    activeAgents: agents.filter(a => a.status === 'active').length || 2,
    totalMessages: 1247,
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/50 p-6">
      <div className="mx-auto max-w-7xl space-y-10">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-5xl font-bold tracking-tight text-foreground bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text">
              AI Agent Playground
            </h1>
            <p className="text-muted-foreground text-lg">
              Manage and interact with your AI agents
            </p>
          </div>
          <Button
            onClick={() => router.push('/agents/new')}
            className="gap-2 px-6 py-3 text-base font-medium"
          >
            <Plus className="h-5 w-5" />
            Create Agent
          </Button>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <Card className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-0 bg-gradient-to-br from-card to-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Agents</CardTitle>
              <div className="p-2 rounded-lg bg-primary/10">
                <Bot className="h-5 w-5 text-primary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground mb-1">{mockStats.totalAgents}</div>
              <p className="text-xs text-muted-foreground">
                +2 from last month
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-0 bg-gradient-to-br from-card to-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Active Agents</CardTitle>
              <div className="p-2 rounded-lg bg-accent/10">
                <Zap className="h-5 w-5 text-accent" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground mb-1">{mockStats.activeAgents}</div>
              <p className="text-xs text-muted-foreground">
                Currently online
              </p>
            </CardContent>
          </Card>

          <Card className="group hover:shadow-xl hover:-translate-y-1 transition-all duration-300 border-0 bg-gradient-to-br from-card to-card/80">
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
              <CardTitle className="text-sm font-medium text-muted-foreground">Total Messages</CardTitle>
              <div className="p-2 rounded-lg bg-secondary/10">
                <Users className="h-5 w-5 text-secondary" />
              </div>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-foreground mb-1">{mockStats.totalMessages.toLocaleString()}</div>
              <p className="text-xs text-muted-foreground">
                +12% from last week
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Agents Grid */}
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <h2 className="text-3xl font-semibold tracking-tight text-foreground">Your Agents</h2>
            <Button variant="outline" size="sm" className="gap-2">
              View All
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              // Loading skeleton
              Array.from({ length: 6 }).map((_, i) => (
                <Card key={i} className="animate-pulse border-0 bg-gradient-to-br from-card to-card/80">
                  <CardHeader className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="h-5 bg-muted rounded w-24"></div>
                      <div className="w-3 h-3 bg-muted rounded-full"></div>
                    </div>
                    <div className="h-4 bg-muted rounded w-full"></div>
                    <div className="h-3 bg-muted rounded w-2/3"></div>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2">
                      <div className="h-3 bg-muted rounded w-full"></div>
                      <div className="h-3 bg-muted rounded w-1/2"></div>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : agents.length > 0 ? (
              agents.map((agent, index) => (
                <Card
                  key={agent.id}
                  className={`group hover:shadow-xl hover:-translate-y-2 transition-all duration-300 cursor-pointer border-0 bg-gradient-to-br from-card to-card/80 relative overflow-hidden ${
                    index % 3 === 1 ? 'md:translate-y-4' : index % 3 === 2 ? 'md:-translate-y-2' : ''
                  }`}
                  style={{
                    animationDelay: `${index * 100}ms`
                  }}
                >
                  {/* Subtle gradient overlay */}
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/5 to-accent/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />

                  <CardHeader className="relative z-10 space-y-3">
                    <div className="flex items-center justify-between">
                      <CardTitle className="text-xl font-semibold text-foreground group-hover:text-primary transition-colors duration-300">
                        {agent.name}
                      </CardTitle>
                      <div className={`w-4 h-4 rounded-full transition-all duration-300 ${
                        agent.status === 'active' ? 'bg-green-400 shadow-lg shadow-green-400/30' :
                        agent.status === 'training' ? 'bg-yellow-400 shadow-lg shadow-yellow-400/30' : 'bg-gray-400'
                      }`} />
                    </div>
                    <CardDescription className="text-muted-foreground leading-relaxed">
                      {agent.persona}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="flex items-center justify-between text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <span className="text-primary font-medium">{agent.goals.length}</span>
                        goals
                      </span>
                      <span>Created {new Date(agent.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>
              ))
            ) : (
              // Empty state
              <Card className="col-span-full border-2 border-dashed border-border bg-gradient-to-br from-card/50 to-card/30">
                <CardContent className="flex flex-col items-center justify-center py-20">
                  <div className="p-4 rounded-full bg-primary/10 mb-6">
                    <Bot className="h-16 w-16 text-primary" />
                  </div>
                  <h3 className="text-2xl font-semibold mb-3 text-foreground">No agents yet</h3>
                  <p className="text-muted-foreground text-center mb-6 max-w-md">
                    Create your first AI agent to get started with intelligent conversations and task automation
                  </p>
                  <Button
                    onClick={() => router.push('/agents/new')}
                    className="gap-2 px-6 py-3"
                  >
                    <Plus className="h-5 w-5" />
                    Create Agent
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
