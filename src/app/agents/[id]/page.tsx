'use client'

import { useEffect, useState, useRef } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAgentStore } from '@/stores/agentStore'
import { useMessageStore } from '@/stores/messageStore'
import { MemoryRecord } from '@/types/database'
import { ArrowLeft, Send, Bot, User, Settings, MessageCircle, Brain, TrendingUp, Trash2, Calendar, Star, Award, Heart, Clock, Sparkles } from 'lucide-react'
import { getCurrentLLMModel } from '@/utils/llm'

// Phase 1 Components
import { EmotionRadar, EmotionBars } from '@/components/emotions/EmotionRadar'
import { EmotionTimeline, EmotionSummary } from '@/components/emotions/EmotionTimeline'
import { AchievementBadge, AchievementCard, LevelProgress } from '@/components/achievements/AchievementBadge'
import { AchievementNotification, useAchievementNotifications } from '@/components/achievements/AchievementNotification'
import { TimelineExplorer } from '@/components/timeline/TimelineExplorer'
import { NeuralViz, NeuralViz2D } from '@/components/visualizations/NeuralViz'

// Phase 1 Services
import { emotionalService } from '@/lib/services/emotionalService'
import { achievementService } from '@/lib/services/achievementService'
import { timelineService } from '@/lib/services/timelineService'
import { ACHIEVEMENTS } from '@/lib/constants/achievements'

type TabType = 'chat' | 'memory' | 'emotions' | 'achievements' | 'timeline' | 'neural'

export default function AgentDetail() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string

  const { agents, currentAgent, setCurrentAgent } = useAgentStore()
  const { messages, sendMessage, loading: messagesLoading } = useMessageStore()

  const [newMessage, setNewMessage] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [memories, setMemories] = useState<MemoryRecord[]>([])
  const [memoryStats, setMemoryStats] = useState<{
    totalMemories: number
    memoriesByType: Record<string, number>
    averageImportance: number
    oldestMemory?: string
    newestMemory?: string
  }>({
    totalMemories: 0,
    memoriesByType: {},
    averageImportance: 0
  })
  const [loadingMemories, setLoadingMemories] = useState(false)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Phase 1: Achievement notifications
  const { current: currentAchievement, handleClose: handleAchievementClose, notify: notifyAchievement } = useAchievementNotifications()

  // Phase 1: Timeline events (generated from memories and messages)
  const [timelineEvents, setTimelineEvents] = useState<ReturnType<typeof timelineService.aggregateEvents> extends Promise<infer T> ? T : never>([])

  // Get agent progress and stats with defaults
  const agentProgress = currentAgent?.progress || achievementService.createDefaultProgress()
  const agentStats = currentAgent?.stats || achievementService.createDefaultStats()
  const agentEmotionalState = currentAgent?.emotionalState || emotionalService.createDefaultEmotionalState()
  const agentEmotionalHistory = currentAgent?.emotionalHistory || []

  useEffect(() => {
    // Find the current agent
    const agent = agents.find(a => a.id === agentId)
    if (agent) {
      setCurrentAgent(agent)
    }
  }, [agentId, agents, setCurrentAgent])

  // Fetch messages for this agent
  useEffect(() => {
    if (currentAgent) {
      const fetchMessages = async () => {
        await sendMessage('', currentAgent.id) // This will trigger the store to fetch messages
      }
      fetchMessages()
    }
  }, [currentAgent, sendMessage])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load memories when switching to memory tab
  const loadMemories = async () => {
    if (!currentAgent || memories.length > 0) return

    setLoadingMemories(true)
    try {
      const [memoriesData, statsData] = await Promise.all([
        useAgentStore.getState().fetchAgentMemories(currentAgent.id),
        useAgentStore.getState().getMemoryStats(currentAgent.id)
      ])
      setMemories(memoriesData)
      setMemoryStats(statsData)
    } catch (error) {
      console.error('Failed to load memories:', error)
    } finally {
      setLoadingMemories(false)
    }
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    if (tab === 'memory' && memories.length === 0) {
      loadMemories()
    }
    if (tab === 'timeline' && timelineEvents.length === 0 && currentAgent) {
      loadTimelineEvents()
    }
  }

  const loadTimelineEvents = async () => {
    if (!currentAgent) return
    try {
      const events = await timelineService.aggregateEvents(
        currentAgent,
        memories,
        messages as any // Convert message types
      )
      setTimelineEvents(events)
    } catch (error) {
      console.error('Failed to load timeline events:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newMessage.trim() || !currentAgent) return

    try {
      // Send user message first
      await sendMessage(newMessage, currentAgent.id, undefined, 'user')

      // Generate agent response using LangChain
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: newMessage,
          agentPersona: currentAgent.persona,
          agentGoals: currentAgent.goals,
          agentId: currentAgent.id,
          enableStreaming: false // Use non-streaming for now
        })
      })

      if (response.ok) {
        const data = await response.json()

        // Send agent response with LangChain metadata
        await sendMessage(data.content, currentAgent.id, {
          langchain: data.langchain,
          toolsUsed: data.toolsUsed,
          reasoning: data.reasoning,
          memoryUsed: data.memoryUsed
        }, 'agent')
      } else {
        console.error('Failed to get LangChain response')
        // Fallback to regular message sending
        await sendMessage('I apologize, but I\'m experiencing some technical difficulties. Could you please try again?', currentAgent.id, undefined, 'agent')
      }

      setNewMessage('')
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  if (!currentAgent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-background to-background/80 p-6">
        <div className="mx-auto max-w-4xl flex items-center justify-center min-h-[400px]">
          <Card>
            <CardContent className="p-8 text-center">
              <Bot className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
              <h3 className="text-lg font-semibold mb-2">Agent not found</h3>
                      <p className="text-muted-foreground mb-4">
                The agent you&apos;re looking for doesn&apos;t exist or has been removed.
              </p>
              <Button onClick={() => router.push('/dashboard')}>
                Back to Dashboard
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background/90 to-background/50 p-6">
      <div className="mx-auto max-w-7xl space-y-8">
        {/* Header */}
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2 px-4 py-2 rounded-xl hover:bg-primary/10 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="flex-1 space-y-2">
            <h1 className="text-4xl font-bold tracking-tight text-foreground bg-gradient-to-r from-foreground to-primary/80 bg-clip-text">
              {currentAgent.name}
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              {currentAgent.persona}
            </p>
          </div>
          <Button variant="outline" size="sm" className="gap-2 px-4 py-2 rounded-xl hover:bg-muted/50 transition-all duration-200">
            <Settings className="h-4 w-4" />
            Settings
          </Button>
        </div>

        {/* Tab Navigation */}
        <div className="flex gap-2 p-1 bg-muted/30 rounded-xl w-fit overflow-x-auto">
          <button
            onClick={() => handleTabChange('chat')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === 'chat'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <MessageCircle className="h-4 w-4 inline mr-2" />
            Chat
          </button>
          <button
            onClick={() => handleTabChange('emotions')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === 'emotions'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Heart className="h-4 w-4 inline mr-2" />
            Emotions
          </button>
          <button
            onClick={() => handleTabChange('achievements')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === 'achievements'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Award className="h-4 w-4 inline mr-2" />
            Achievements
          </button>
          <button
            onClick={() => handleTabChange('timeline')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === 'timeline'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Clock className="h-4 w-4 inline mr-2" />
            Timeline
          </button>
          <button
            onClick={() => handleTabChange('neural')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === 'neural'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Sparkles className="h-4 w-4 inline mr-2" />
            Neural
          </button>
          <button
            onClick={() => handleTabChange('memory')}
            className={`px-4 py-2 rounded-lg font-medium transition-all duration-200 whitespace-nowrap ${
              activeTab === 'memory'
                ? 'bg-primary text-primary-foreground shadow-lg'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/50'
            }`}
          >
            <Brain className="h-4 w-4 inline mr-2" />
            Memory
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Agent Info */}
          <div className="space-y-6">
            <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="space-y-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  Agent Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Status</h4>
                  <div className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full transition-all duration-300 ${
                      currentAgent.status === 'active' ? 'bg-green-400 shadow-lg shadow-green-400/30' :
                      currentAgent.status === 'training' ? 'bg-yellow-400 shadow-lg shadow-yellow-400/30' : 'bg-gray-400'
                    }`} />
                    <span className="capitalize font-medium">{currentAgent.status}</span>
                  </div>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Goals</h4>
                  <ul className="space-y-2">
                    {currentAgent.goals.map((goal, index) => (
                      <li key={index} className="text-sm flex items-start gap-3 p-2 rounded-lg bg-muted/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span className="leading-relaxed">{goal}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
                  <p className="text-sm font-medium">
                    {new Date(currentAgent.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">AI Model</h4>
                  <div className="flex items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      {getCurrentLLMModel()}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Phase 1: Level Progress */}
            <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="space-y-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-xl bg-amber-500/10">
                    <Award className="h-6 w-6 text-amber-500" />
                  </div>
                  Level & Progress
                </CardTitle>
              </CardHeader>
              <CardContent>
                <LevelProgress
                  level={agentProgress.level}
                  xp={agentProgress.experiencePoints}
                  nextLevelXP={agentProgress.nextLevelXP}
                  progressPercent={achievementService.getLevelInfo(agentProgress).progressPercent}
                  skillPoints={agentProgress.skillPoints}
                />
                <div className="mt-4 text-center text-sm text-muted-foreground">
                  {Object.keys(agentProgress.achievements).length} / {ACHIEVEMENTS.length} achievements
                </div>
              </CardContent>
            </Card>

            {/* Phase 1: Emotion Mini Display */}
            <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="space-y-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-xl bg-pink-500/10">
                    <Heart className="h-6 w-6 text-pink-500" />
                  </div>
                  Current Mood
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center">
                <NeuralViz2D agent={currentAgent} className="w-32 h-32" />
                <div className="mt-3 text-center">
                  <div className="text-lg font-medium capitalize">
                    {agentEmotionalState.dominantEmotion}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {emotionalService.getEmotionalSummary(agentEmotionalState)}
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl hover:shadow-2xl transition-all duration-300">
              <CardHeader className="space-y-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="p-2 rounded-xl bg-accent/10">
                    <MessageCircle className="h-6 w-6 text-accent" />
                  </div>
                  Chat Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="grid grid-cols-2 gap-6">
                  <div className="text-center p-4 rounded-xl bg-primary/5">
                    <div className="text-3xl font-bold text-primary mb-1">{agentStats.totalMessages}</div>
                    <div className="text-sm text-muted-foreground">Messages</div>
                  </div>
                  <div className="text-center p-4 rounded-xl bg-accent/5">
                    <div className="text-3xl font-bold text-accent mb-1">{agentStats.conversationCount}</div>
                    <div className="text-sm text-muted-foreground">Sessions</div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {activeTab === 'chat' ? (
              /* Chat Interface */
              <>
            <Card className="h-[650px] flex flex-col backdrop-blur-sm bg-card/80 border-0 shadow-2xl">
              <CardHeader className="border-b border-border/50 space-y-4">
                <CardTitle className="flex items-center gap-3 text-2xl">
                  <div className="p-2 rounded-xl bg-primary/10">
                    <Bot className="h-6 w-6 text-primary" />
                  </div>
                  Chat with {currentAgent.name}
                </CardTitle>
                <CardDescription className="text-base leading-relaxed">
                  Start a conversation with your AI agent
                </CardDescription>
              </CardHeader>

              {/* Messages */}
              <CardContent className="flex-1 overflow-y-auto p-6 space-y-6">
                {messages.length === 0 && !messagesLoading ? (
                  <div className="flex items-center justify-center h-full text-center">
                    <div className="space-y-4">
                      <div className="p-4 rounded-full bg-primary/10 mx-auto w-fit">
                        <MessageCircle className="h-16 w-16 text-primary" />
                      </div>
                      <div className="space-y-2">
                        <h3 className="text-xl font-semibold text-foreground">Start a conversation</h3>
                        <p className="text-muted-foreground max-w-md">
                          Send a message to begin chatting with {currentAgent.name}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : (
                  <>
                    {messages.map((message, index) => (
                      <div
                        key={message.id}
                        className={`flex gap-4 ${
                          message.type === 'user' ? 'justify-end' : 'justify-start'
                        }`}
                        style={{
                          animationDelay: `${index * 100}ms`,
                          animation: 'fadeIn 0.4s ease-out forwards'
                        }}
                      >
                        {message.type === 'agent' && (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-primary to-primary/80 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <Bot className="h-5 w-5 text-primary-foreground" />
                          </div>
                        )}

                        <div
                          className={`max-w-[75%] rounded-2xl px-5 py-3 shadow-sm ${
                            message.type === 'user'
                              ? 'bg-gradient-to-br from-primary to-primary/90 text-primary-foreground rounded-br-md'
                              : 'bg-gradient-to-br from-muted to-muted/80 text-card-foreground rounded-bl-md'
                          }`}
                        >
                          <p className="text-sm leading-relaxed">{message.content}</p>
                          <div className={`text-xs mt-2 flex items-center gap-2 ${
                            message.type === 'user'
                              ? 'text-primary-foreground/70'
                              : 'text-muted-foreground'
                          }`}>
                            {new Date(message.timestamp).toLocaleTimeString()}
                            {message.metadata?.langchain === true && (
                              <div className="group relative">
                                <div className="flex items-center gap-1 text-xs bg-accent/20 px-2 py-1 rounded-full">
                                  <span className="text-accent">🧩</span>
                                  <span>LangChain</span>
                                </div>
                                {(() => {
                                  const toolsUsed = message.metadata?.toolsUsed as string[] | undefined;
                                  return toolsUsed && toolsUsed.length > 0 && (
                                    <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                      Tools: {toolsUsed.join(', ')}
                                    </div>
                                  );
                                })()}
                              </div>
                            )}
                          </div>
                        </div>

                        {message.type === 'user' && (
                          <div className="w-10 h-10 rounded-full bg-gradient-to-br from-secondary to-secondary/80 flex items-center justify-center flex-shrink-0 shadow-lg">
                            <User className="h-5 w-5 text-secondary-foreground" />
                          </div>
                        )}
                      </div>
                    ))}

                    <div ref={messagesEndRef} />
                  </>
                )}
              </CardContent>

              {/* Message Input */}
              <div className="border-t border-border/50 p-6 bg-card/50">
                <form onSubmit={handleSendMessage} className="flex gap-4">
                  <Input
                    placeholder={`Message ${currentAgent.name}...`}
                    value={newMessage}
                    onChange={(e) => setNewMessage(e.target.value)}
                    className="flex-1 h-12 px-4 text-base border-2 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all duration-200"
                    disabled={messagesLoading}
                  />
                  <Button
                    type="submit"
                    disabled={!newMessage.trim() || messagesLoading}
                    className="gap-2 px-6 py-3 text-base font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
                  >
                    <Send className="h-5 w-5" />
                    Send
                  </Button>
                </form>
              </div>
            </Card>
            </>
            ) : (
              /* Memory & Growth Interface */
              <div className="space-y-6">
                {/* Personality Traits */}
                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-xl bg-accent/10">
                        <TrendingUp className="h-6 w-6 text-accent" />
                      </div>
                      Personality Evolution
                    </CardTitle>
                    <CardDescription>
                      {currentAgent.name}&apos;s personality traits evolve based on interactions
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Core Traits */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground">Core Traits (Immutable)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {currentAgent.coreTraits && Object.entries(currentAgent.coreTraits).map(([trait, score]) => (
                          <div key={trait} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium capitalize">{trait}</span>
                              <span className="text-xs text-muted-foreground">{Math.round(score * 100)}%</span>
                            </div>
                            <div className="w-full bg-muted/30 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-primary/60 to-primary h-2 rounded-full transition-all duration-500"
                                style={{ width: `${score * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* Dynamic Traits */}
                    <div className="space-y-4">
                      <h4 className="text-sm font-medium text-muted-foreground">Dynamic Traits (Evolving)</h4>
                      <div className="grid grid-cols-2 gap-4">
                        {currentAgent.dynamicTraits && Object.entries(currentAgent.dynamicTraits).map(([trait, score]) => (
                          <div key={trait} className="space-y-2">
                            <div className="flex justify-between items-center">
                              <span className="text-sm font-medium capitalize">{trait}</span>
                              <span className="text-xs text-muted-foreground">{Math.round(score * 100)}%</span>
                            </div>
                            <div className="w-full bg-muted/30 rounded-full h-2">
                              <div
                                className="bg-gradient-to-r from-accent/60 to-accent h-2 rounded-full transition-all duration-500"
                                style={{ width: `${score * 100}%` }}
                              />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Memory Timeline */}
                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-xl bg-primary/10">
                        <Brain className="h-6 w-6 text-primary" />
                      </div>
                      Memory Timeline
                    </CardTitle>
                    <CardDescription>
                      Important memories and insights stored by {currentAgent.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingMemories ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : memories.length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No memories stored yet. Start chatting to build {currentAgent.name}&apos;s memory!
                      </div>
                    ) : (
                      <div className="space-y-4 max-h-96 overflow-y-auto">
                        {memories.slice(0, 20).map((memory) => (
                          <div key={memory.id} className="flex gap-4 p-4 rounded-lg bg-muted/30 border border-border/50">
                            <div className="flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                memory.type === 'conversation' ? 'bg-blue-100 text-blue-700' :
                                memory.type === 'fact' ? 'bg-green-100 text-green-700' :
                                memory.type === 'interaction' ? 'bg-purple-100 text-purple-700' :
                                'bg-orange-100 text-orange-700'
                              }`}>
                                {memory.type === 'conversation' ? '💬' :
                                 memory.type === 'fact' ? '📚' :
                                 memory.type === 'interaction' ? '🤝' : '💡'}
                              </div>
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between gap-2 mb-2">
                                <div className="flex items-center gap-2">
                                  <span className="text-sm font-medium capitalize">{memory.type}</span>
                                  <div className="flex items-center gap-1">
                                    {Array.from({ length: Math.floor(memory.importance / 2) }).map((_, i) => (
                                      <Star key={i} className="h-3 w-3 fill-yellow-400 text-yellow-400" />
                                    ))}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2">
                                  <span className="text-xs text-muted-foreground">
                                    {new Date(memory.timestamp).toLocaleDateString()}
                                  </span>
                                  <Button
                                    variant="ghost"
                                    size="sm"
                                    onClick={() => useAgentStore.getState().deleteMemory(memory.id)}
                                    className="h-6 w-6 p-0 text-muted-foreground hover:text-destructive"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </Button>
                                </div>
                              </div>
                              <p className="text-sm text-muted-foreground mb-1">{memory.summary}</p>
                              <div className="flex flex-wrap gap-1">
                                {memory.keywords.slice(0, 3).map((keyword: string) => (
                                  <span key={keyword} className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                                    {keyword}
                                  </span>
                                ))}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                {/* Memory Statistics */}
                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-xl bg-secondary/10">
                        <Calendar className="h-6 w-6 text-secondary" />
                      </div>
                      Memory Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-lg bg-primary/5">
                        <div className="text-2xl font-bold text-primary mb-1">{memoryStats.totalMemories || 0}</div>
                        <div className="text-sm text-muted-foreground">Total Memories</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-accent/5">
                        <div className="text-2xl font-bold text-accent mb-1">
                          {Object.keys(memoryStats.memoriesByType || {}).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Memory Types</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-secondary/5">
                        <div className="text-2xl font-bold text-secondary mb-1">
                          {memoryStats.averageImportance ? Math.round(memoryStats.averageImportance * 10) / 10 : 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg. Importance</div>
                      </div>
                      <div className="text-center p-4 rounded-lg bg-muted/30">
                        <div className="text-2xl font-bold text-muted-foreground mb-1">
                          {currentAgent.totalInteractions || 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Interactions</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : activeTab === 'emotions' ? (
              /* Emotions Tab */
              <div className="space-y-6">
                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-xl bg-pink-500/10">
                        <Heart className="h-6 w-6 text-pink-500" />
                      </div>
                      Emotional State
                    </CardTitle>
                    <CardDescription>
                      {currentAgent.name}&apos;s current emotional state and history
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid md:grid-cols-2 gap-8">
                      <div className="flex flex-col items-center">
                        <h4 className="text-sm font-medium text-muted-foreground mb-4">Emotion Radar</h4>
                        <EmotionRadar emotionalState={agentEmotionalState} size={280} />
                      </div>
                      <div>
                        <h4 className="text-sm font-medium text-muted-foreground mb-4">Emotion Levels</h4>
                        <EmotionBars emotionalState={agentEmotionalState} />
                      </div>
                    </div>
                  </CardContent>
                </Card>

                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-xl bg-purple-500/10">
                        <Clock className="h-6 w-6 text-purple-500" />
                      </div>
                      Emotional Timeline
                    </CardTitle>
                    <CardDescription>
                      Recent emotional events and triggers
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EmotionTimeline events={agentEmotionalHistory} maxEvents={15} />
                  </CardContent>
                </Card>
              </div>
            ) : activeTab === 'achievements' ? (
              /* Achievements Tab */
              <div className="space-y-6">
                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-xl bg-amber-500/10">
                        <Award className="h-6 w-6 text-amber-500" />
                      </div>
                      Level Progress
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <LevelProgress
                      level={agentProgress.level}
                      xp={agentProgress.experiencePoints}
                      nextLevelXP={agentProgress.nextLevelXP}
                      progressPercent={achievementService.getLevelInfo(agentProgress).progressPercent}
                      skillPoints={agentProgress.skillPoints}
                    />
                  </CardContent>
                </Card>

                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-xl bg-green-500/10">
                        <Star className="h-6 w-6 text-green-500" />
                      </div>
                      Unlocked Achievements ({Object.keys(agentProgress.achievements).length})
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    {Object.keys(agentProgress.achievements).length === 0 ? (
                      <div className="text-center py-8 text-muted-foreground">
                        No achievements unlocked yet. Keep interacting to unlock achievements!
                      </div>
                    ) : (
                      <div className="grid gap-4">
                        {achievementService.getUnlockedAchievements(agentProgress).map(achievement => (
                          <AchievementCard
                            key={achievement.id}
                            achievement={achievement}
                            unlocked={true}
                            unlockedAt={achievement.unlockedAt}
                          />
                        ))}
                      </div>
                    )}
                  </CardContent>
                </Card>

                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-xl bg-gray-500/10">
                        <Award className="h-6 w-6 text-gray-500" />
                      </div>
                      Available Achievements
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 max-h-96 overflow-y-auto">
                      {achievementService.getLockedAchievements(agentProgress, agentStats)
                        .slice(0, 10)
                        .map(achievement => (
                          <AchievementCard
                            key={achievement.id}
                            achievement={achievement}
                            unlocked={false}
                            progress={achievement.progress}
                          />
                        ))}
                    </div>
                  </CardContent>
                </Card>
              </div>
            ) : activeTab === 'timeline' ? (
              /* Timeline Tab */
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-xl bg-blue-500/10">
                      <Clock className="h-6 w-6 text-blue-500" />
                    </div>
                    Timeline Explorer
                  </CardTitle>
                  <CardDescription>
                    Explore {currentAgent.name}&apos;s life events and memories over time
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <TimelineExplorer events={timelineEvents} />
                </CardContent>
              </Card>
            ) : activeTab === 'neural' ? (
              /* Neural Visualization Tab */
              <div className="space-y-6">
                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-xl bg-indigo-500/10">
                        <Sparkles className="h-6 w-6 text-indigo-500" />
                      </div>
                      Neural Visualization
                    </CardTitle>
                    <CardDescription>
                      A 3D visualization of {currentAgent.name}&apos;s mind, memories, and emotional state
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="p-0">
                    <NeuralViz agent={currentAgent} height={500} />
                  </CardContent>
                </Card>

                <div className="grid md:grid-cols-2 gap-6">
                  <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-lg">Memory Network</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Total Memories</span>
                          <span className="font-medium">{currentAgent.memoryCount || 0}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Active Memories</span>
                          <span className="font-medium">{Math.floor((currentAgent.memoryCount || 0) * 0.3)}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Connections</span>
                          <span className="font-medium">{Math.floor((currentAgent.memoryCount || 0) * 0.5)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                    <CardHeader>
                      <CardTitle className="text-lg">Cognitive State</CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Dominant Emotion</span>
                          <span className="font-medium capitalize">{agentEmotionalState.dominantEmotion}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Personality Level</span>
                          <span className="font-medium">Level {agentProgress.level}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-sm text-muted-foreground">Total Interactions</span>
                          <span className="font-medium">{currentAgent.totalInteractions || 0}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {/* Achievement Notification */}
      <AchievementNotification
        achievement={currentAchievement}
        onClose={handleAchievementClose}
      />
    </div>
  )
}
