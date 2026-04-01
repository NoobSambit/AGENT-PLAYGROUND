'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAgentStore } from '@/stores/agentStore'
import { useMessageStore } from '@/stores/messageStore'
import { MemoryRecord, MessageRecord, AgentRecord, AgentRelationship } from '@/types/database'
import { ArrowLeft, Send, User, MessageCircle, Brain, TrendingUp, Trash2, Calendar, Star, Award, Heart, Clock, Palette, Moon, BookOpen, Target, Swords, Network, Library, GraduationCap, Users, Languages, Sparkles } from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'
import { motion } from 'framer-motion'
import { GradientOrb } from '@/components/ui/animated-background'
import { MetaLearningState, SkillProgression } from '@/types/metaLearning'

// Phase 1 Components
import { EmotionRadar, EmotionBars } from '@/components/emotions/EmotionRadar'
import { EmotionTimeline } from '@/components/emotions/EmotionTimeline'
import { AchievementCard, LevelProgress } from '@/components/achievements/AchievementBadge'
import { AchievementNotification, useAchievementNotifications } from '@/components/achievements/AchievementNotification'
import { TimelineExplorer } from '@/components/timeline/TimelineExplorer'

// Phase 2 Components
import { CreativePortfolio } from '@/components/creative/CreativePortfolio'
import { DreamJournal } from '@/components/dreams/DreamJournal'
import { JournalViewer } from '@/components/journal/JournalViewer'
import { ProfileViewer } from '@/components/profile/ProfileViewer'
import { ChallengeHub } from '@/components/challenges/ChallengeHub'
import { RelationshipGraph } from '@/components/relationships/RelationshipGraph'
import { RelationshipCard } from '@/components/relationships/RelationshipCard'
import { MetaLearningDashboard } from '@/components/learning/MetaLearningDashboard'
import { FuturePlanningView } from '@/components/planning/FuturePlanningView'
import { ParallelRealityExplorer } from '@/components/parallel/ParallelRealityExplorer'
import { LinguisticProfileCard } from '@/components/linguistic/LinguisticProfileCard'
import { VoiceConsole } from '@/components/chat/VoiceConsole'

// Phase 3 Components
import { KnowledgeGraph } from '@/components/knowledge/KnowledgeGraph'
import { SharedKnowledgeLibrary } from '@/components/knowledge/SharedKnowledgeLibrary'
import { MentorshipHub } from '@/components/mentorship/MentorshipHub'
import { CollectiveIntelligencePanel } from '@/components/collective/CollectiveIntelligencePanel'
import { ConflictResolutionPanel } from '@/components/relationships/ConflictResolutionPanel'
import { NeuralActivityView } from '@/components/neural/NeuralActivityView'
import { LLMProviderToggle } from '@/components/llm/LLMProviderToggle'
import { getClientModelForProvider, LLM_PROVIDER_LABELS } from '@/lib/llm/clientPreference'
import { useLLMPreferenceStore } from '@/stores/llmPreferenceStore'

// Phase 1 Services
import { emotionalService } from '@/lib/services/emotionalService'
import { achievementService } from '@/lib/services/achievementService'
import { timelineService } from '@/lib/services/timelineService'
import { futurePlanningService, FuturePlan } from '@/lib/services/futurePlanningService'
import { parallelRealityService, ParallelRealityExtended } from '@/lib/services/parallelRealityService'
import { ACHIEVEMENTS } from '@/lib/constants/achievements'

type TabType =
  | 'chat'
  | 'memory'
  | 'emotions'
  | 'neural'
  | 'achievements'
  | 'timeline'
  | 'relationships'
  | 'learning'
  | 'planning'
  | 'scenarios'
  | 'creative'
  | 'dreams'
  | 'journal'
  | 'profile'
  | 'challenges'
  | 'knowledge-graph'
  | 'knowledge-library'
  | 'collective'
  | 'mentorship'

interface RelationshipApiStats {
  totalRelationships: number
  strongBonds: number
  averageTrust: number
  averageRespect: number
  averageAffection: number
  brokenBonds: number
  mostConnectedAgent: string | null
}

const TAB_CONFIG = [
  { id: 'chat', icon: MessageCircle, label: 'Chat', description: 'Direct conversations and model responses.' },
  { id: 'emotions', icon: Heart, label: 'Emotions', description: 'Current emotional signals and recent shifts.' },
  { id: 'neural', icon: Brain, label: 'Neural', description: 'Live thought flow, attention, and emotional activity.' },
  { id: 'achievements', icon: Award, label: 'Achievements', description: 'Progression, levels, and earned milestones.' },
  { id: 'timeline', icon: Clock, label: 'Timeline', description: 'A chronological view of important events.' },
  { id: 'memory', icon: Brain, label: 'Memory', description: 'Stored memories, trait evolution, and retention stats.' },
  { id: 'relationships', icon: Users, label: 'Relationships', description: 'Trust, bonds, and long-term social state.' },
  { id: 'learning', icon: TrendingUp, label: 'Learning', description: 'Patterns, recommendations, and meta-learning signals.' },
  { id: 'planning', icon: Calendar, label: 'Planning', description: 'Projected goals, risks, and future actions.' },
  { id: 'scenarios', icon: Sparkles, label: 'Scenarios', description: 'What-if branches and alternate trajectories.' },
  { id: 'creative', icon: Palette, label: 'Creative', description: 'Creative works generated by the agent.' },
  { id: 'dreams', icon: Moon, label: 'Dreams', description: 'Dream generation and subconscious motifs.' },
  { id: 'journal', icon: BookOpen, label: 'Journal', description: 'Private reflections, streaks, and recurring insights.' },
  { id: 'profile', icon: Languages, label: 'Profile', description: 'Psychological and linguistic personality models.' },
  { id: 'challenges', icon: Swords, label: 'Challenges', description: 'Collaborative and competitive multi-agent exercises.' },
  { id: 'knowledge-graph', icon: Network, label: 'Knowledge', description: 'Concept structure and memory relationships.' },
  { id: 'knowledge-library', icon: Library, label: 'Library', description: 'Shared knowledge contributed across the ecosystem.' },
  { id: 'collective', icon: Users, label: 'Collective', description: 'Expert referrals, consensus signals, and network broadcasts.' },
  { id: 'mentorship', icon: GraduationCap, label: 'Mentorship', description: 'Teaching, coaching, and growth connections.' },
] as const satisfies ReadonlyArray<{
  id: TabType
  icon: typeof Brain
  label: string
  description: string
}>

export default function AgentDetail() {
  const params = useParams()
  const router = useRouter()
  const agentId = params.id as string
  const scenarioTemplates = parallelRealityService.getScenarioTemplates()

  const { agents, currentAgent, setCurrentAgent, fetchAgentById, fetchAgents } = useAgentStore()
  const { messages, sendMessage, fetchMessagesByAgentId, loading: messagesLoading } = useMessageStore()
  const selectedProvider = useLLMPreferenceStore((state) => state.provider)

  const [newMessage, setNewMessage] = useState('')
  const [activeTab, setActiveTab] = useState<TabType>('chat')
  const [agentResolved, setAgentResolved] = useState(false)
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
  const [relationships, setRelationships] = useState<AgentRelationship[]>([])
  const [relationshipAgents, setRelationshipAgents] = useState<Array<{ id: string; name: string }>>([])
  const [relationshipStats, setRelationshipStats] = useState<RelationshipApiStats | null>(null)
  const [loadingRelationships, setLoadingRelationships] = useState(false)
  const [learningState, setLearningState] = useState<MetaLearningState | null>(null)
  const [learningSkills, setLearningSkills] = useState<SkillProgression[]>([])
  const [loadingLearning, setLoadingLearning] = useState(false)
  const [futurePlan, setFuturePlan] = useState<FuturePlan | null>(null)
  const [parallelReality, setParallelReality] = useState<ParallelRealityExtended | null>(null)
  const [selectedScenarioId, setSelectedScenarioId] = useState<string>(scenarioTemplates[0]?.id || '')
  const messagesEndRef = useRef<HTMLDivElement>(null)

  // Phase 1: Achievement notifications
  const { current: currentAchievement, handleClose: handleAchievementClose } = useAchievementNotifications()

  // Phase 1: Timeline events (generated from memories and messages)
  const [timelineEvents, setTimelineEvents] = useState<ReturnType<typeof timelineService.aggregateEvents> extends Promise<infer T> ? T : never>([])

  // Get agent progress and stats with defaults
  const agentProgress = currentAgent?.progress || achievementService.createDefaultProgress()
  const agentStats = currentAgent?.stats || achievementService.createDefaultStats()
  const agentEmotionalState = currentAgent?.emotionalState || emotionalService.createDefaultEmotionalState()
  const agentEmotionalHistory = currentAgent?.emotionalHistory || []
  const activeTabConfig = TAB_CONFIG.find((tab) => tab.id === activeTab) || TAB_CONFIG[0]
  const activeProviderModel = useMemo(() => {
    const latestModelForProvider = [...messages]
      .reverse()
      .find((message) =>
        message.type === 'agent' &&
        message.metadata?.provider === selectedProvider &&
        typeof message.metadata?.model === 'string'
      )

    return typeof latestModelForProvider?.metadata?.model === 'string'
      ? latestModelForProvider.metadata.model
      : getClientModelForProvider(selectedProvider)
  }, [messages, selectedProvider])

  useEffect(() => {
    const loadCurrentAgent = async () => {
      const cachedAgent = agents.find(a => a.id === agentId)
      if (cachedAgent) {
        setCurrentAgent(cachedAgent)
        setAgentResolved(true)
        return
      }

      const fetchedAgent = await fetchAgentById(agentId)
      setCurrentAgent(fetchedAgent)
      setAgentResolved(true)
    }

    void loadCurrentAgent()
  }, [agentId, agents, setCurrentAgent, fetchAgentById])

  useEffect(() => {
    if (agents.length === 0) {
      void fetchAgents()
    }
  }, [agents.length, fetchAgents])

  // Fetch messages for this agent
  useEffect(() => {
    if (currentAgent) {
      fetchMessagesByAgentId(currentAgent.id)
    }
  }, [currentAgent, fetchMessagesByAgentId])

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }

  useEffect(() => {
    scrollToBottom()
  }, [messages])

  // Load memories when switching to memory tab
  const loadMemories = async (forceRefresh = false) => {
    if (!currentAgent || (!forceRefresh && memories.length > 0)) {
      return memories
    }

    setLoadingMemories(true)
    try {
      const [memoriesData, statsData] = await Promise.all([
        useAgentStore.getState().fetchAgentMemories(currentAgent.id),
        useAgentStore.getState().getMemoryStats(currentAgent.id)
      ])
      setMemories(memoriesData)
      setMemoryStats(statsData)
      return memoriesData
    } catch (error) {
      console.error('Failed to load memories:', error)
      return []
    } finally {
      setLoadingMemories(false)
    }
  }

  const loadRelationships = async () => {
    if (!currentAgent) {
      return []
    }

    setLoadingRelationships(true)
    try {
      const response = await fetch(`/api/relationships?agentId=${encodeURIComponent(currentAgent.id)}`)
      if (!response.ok) {
        return []
      }

      const data = await response.json()
      const loadedRelationships = (data.relationships || []) as AgentRelationship[]
      const loadedAgents = (data.graphData?.nodes || []).map((node: { id: string; name: string }) => ({
        id: node.id,
        name: node.name
      }))

      setRelationships(loadedRelationships)
      setRelationshipAgents(loadedAgents)
      setRelationshipStats(data.stats || null)
      return loadedRelationships
    } catch (error) {
      console.error('Failed to load relationships:', error)
      return []
    } finally {
      setLoadingRelationships(false)
    }
  }

  const loadLearningData = async () => {
    if (!currentAgent) {
      return null
    }

    setLoadingLearning(true)
    try {
      const fetchState = async () => {
        const response = await fetch(`/api/agents/${currentAgent.id}/learning`)
        if (!response.ok) {
          return null
        }

        return response.json()
      }

      let data = await fetchState()
      const learningMessages = messages
        .filter(message => message.agentId === currentAgent.id && (message.type === 'user' || message.type === 'agent'))
        .slice(-12)
        .map(message => ({
          content: message.content,
          type: message.type === 'agent' ? 'agent' as const : 'user' as const,
          timestamp: message.timestamp
        }))

      if (
        data?.state &&
        learningMessages.length >= 4 &&
        data.state.activePatterns.length === 0 &&
        data.state.activeGoals.length === 0
      ) {
        await fetch(`/api/agents/${currentAgent.id}/learning`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze_conversation',
            messages: learningMessages
          })
        })

        await fetch(`/api/agents/${currentAgent.id}/learning`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'generate_goals'
          })
        })

        data = await fetchState()
      }

      if (data?.state) {
        setLearningState(data.state as MetaLearningState)
        setLearningSkills((data.skills || []) as SkillProgression[])
        return data.state as MetaLearningState
      }

      return null
    } catch (error) {
      console.error('Failed to load learning state:', error)
      return null
    } finally {
      setLoadingLearning(false)
    }
  }

  const loadPlanningData = async () => {
    if (!currentAgent) {
      return
    }

    const loadedMemories = memories.length > 0 ? memories : await loadMemories()
    const loadedTimeline = timelineEvents.length > 0
      ? timelineEvents
      : await timelineService.aggregateEvents(
          currentAgent as AgentRecord,
          loadedMemories,
          messages as unknown as MessageRecord[]
        )
    const currentLearningState = learningState || await loadLearningData()

    setTimelineEvents(loadedTimeline)
    setFuturePlan(
      futurePlanningService.generateFuturePlan(
        currentAgent as AgentRecord,
        currentLearningState?.activeGoals || [],
        loadedTimeline,
        'short_term'
      )
    )
  }

  const loadParallelReality = async () => {
    if (!currentAgent || !selectedScenarioId) {
      return
    }

    const loadedRelationships = relationships.length > 0 ? relationships : await loadRelationships()
    const selectedScenario = scenarioTemplates.find(scenario => scenario.id === selectedScenarioId) || scenarioTemplates[0]

    if (!selectedScenario) {
      return
    }

    setParallelReality(
      parallelRealityService.createParallelReality(
        currentAgent as AgentRecord,
        selectedScenario,
        loadedRelationships
      )
    )
  }

  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab)
    if (tab === 'memory' && memories.length === 0) {
      void loadMemories()
    }
    if (tab === 'timeline' && timelineEvents.length === 0 && currentAgent) {
      void loadTimelineEvents()
    }
    if (tab === 'relationships' && relationships.length === 0) {
      void loadRelationships()
    }
    if (tab === 'learning' && !learningState) {
      void loadLearningData()
    }
    if (tab === 'planning' && !futurePlan) {
      void loadPlanningData()
    }
    if (tab === 'scenarios' && !parallelReality) {
      void loadParallelReality()
    }
  }

  const loadTimelineEvents = async () => {
    if (!currentAgent) return
    try {
      const loadedMemories = memories.length > 0 ? memories : await loadMemories()
      const events = await timelineService.aggregateEvents(
        currentAgent as unknown as AgentRecord,
        loadedMemories,
        messages as unknown as MessageRecord[]
      )
      setTimelineEvents(events)
    } catch (error) {
      console.error('Failed to load timeline events:', error)
    }
  }

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmedMessage = newMessage.trim()
    if (!trimmedMessage || !currentAgent) return

    try {
      // Send user message first
      await sendMessage(trimmedMessage, currentAgent.id, undefined, 'user')

      const conversationHistory = messages
        .filter(msg => msg.agentId === currentAgent.id)
        .slice(-10)
        .map(msg => ({
          role: msg.type === 'user' ? 'user' as const : 'assistant' as const,
          content: msg.content
        }))

      // Generate agent response using LangChain
      const response = await fetch('/api/llm', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: trimmedMessage,
          agentPersona: currentAgent.persona,
          agentGoals: currentAgent.goals,
          agentId: currentAgent.id,
          conversationHistory,
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
          memoryUsed: data.memoryUsed,
          model: data.model,
          provider: data.provider
        }, 'agent')
      } else {
        console.error('Failed to get LangChain response')
        // Fallback to regular message sending
        await sendMessage('I apologize, but I\'m experiencing some technical difficulties. Could you please try again?', currentAgent.id, undefined, 'agent')
      }

      setNewMessage('')

      if (activeTab === 'memory') {
        await loadMemories(true)
      }

      if (activeTab === 'timeline' || activeTab === 'planning') {
        await loadTimelineEvents()
        if (activeTab === 'planning') {
          await loadPlanningData()
        }
      }

      if (activeTab === 'learning') {
        await loadLearningData()
      }
    } catch (error) {
      console.error('Failed to send message:', error)
    }
  }

  const handleDeleteMemory = async (memoryId: string) => {
    const deleted = await useAgentStore.getState().deleteMemory(memoryId)
    if (!deleted) {
      return
    }

    setMemories(prev => prev.filter(memory => memory.id !== memoryId))
    setMemoryStats(prev => ({
      ...prev,
      totalMemories: Math.max((prev.totalMemories || 0) - 1, 0)
    }))

    if (currentAgent) {
      setCurrentAgent({
        ...currentAgent,
        memoryCount: Math.max((currentAgent.memoryCount || 0) - 1, 0)
      })
    }

    if (activeTab === 'timeline' || activeTab === 'planning') {
      await loadTimelineEvents()
      if (activeTab === 'planning') {
        await loadPlanningData()
      }
    }
  }

  if (!currentAgent && !agentResolved) {
    return (
      <div className="relative min-h-screen pt-28 pb-20">
        <GradientOrb className="w-[600px] h-[600px] -top-[200px] -right-[200px] opacity-20" color="violet" />
        <div className="relative z-10 mx-auto max-w-4xl px-6">
          <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-2xl">
            <CardContent className="p-8 text-center space-y-4">
              <div className="mx-auto h-12 w-12 animate-pulse rounded-full bg-primary/15" />
              <div>
                <h3 className="text-lg font-semibold">Loading agent workspace</h3>
                <p className="text-muted-foreground">
                  Rehydrating the agent state, memories, and enhancement modules.
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  if (!currentAgent) {
    return (
      <div className="min-h-screen bg-background p-6">
        <div className="mx-auto max-w-4xl flex items-center justify-center min-h-[400px]">
          <Card>
            <CardContent className="p-8 text-center">
              <PlaygroundLogo className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
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
    <div className="relative min-h-screen pt-28 pb-20">
      {/* Decorative orbs */}
      <GradientOrb className="w-[600px] h-[600px] -top-[200px] -right-[200px] opacity-20" color="violet" />
      <GradientOrb className="w-[400px] h-[400px] top-1/2 -left-[200px] opacity-15" color="cyan" />

      <div className="relative z-10 mx-auto max-w-7xl px-6 space-y-8">
        <motion.section
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="page-section overflow-hidden px-6 py-7 sm:px-8"
        >
          <div className="flex flex-col gap-6">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
                <motion.button
                  whileHover={{ x: -4 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={() => router.back()}
                  className="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-card/[0.62] px-4 text-sm font-medium text-muted-foreground backdrop-blur-xl transition-all hover:border-primary/20 hover:text-foreground"
                >
                  <ArrowLeft className="h-4 w-4" />
                  Back
                </motion.button>

                <div className="flex items-start gap-4">
                  <motion.div
                    animate={{ rotate: [0, 4, -4, 0] }}
                    transition={{ duration: 6, repeat: Infinity }}
                    className="flex h-16 w-16 shrink-0 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-[0_20px_48px_-24px_rgba(109,77,158,0.72)]"
                  >
                    <PlaygroundLogo className="h-8 w-8" />
                  </motion.div>
                  <div className="space-y-3">
                    <div>
                      <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Agent workspace</div>
                      <h1 className="mt-2 text-3xl font-semibold tracking-tight text-foreground md:text-4xl">
                        {currentAgent.name}
                      </h1>
                      <p className="mt-3 max-w-3xl text-sm leading-7 text-muted-foreground">
                        {currentAgent.persona}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className="soft-pill capitalize">status: {currentAgent.status}</span>
                      <span className="soft-pill capitalize">provider: {LLM_PROVIDER_LABELS[selectedProvider]}</span>
                      <span className="soft-pill">model: {activeProviderModel}</span>
                      <span className="soft-pill">{currentAgent.memoryCount || 0} memories</span>
                      <span className="soft-pill">{currentAgent.relationshipCount || 0} relationships</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <button
                  onClick={() => router.push('/agents')}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-border/70 bg-card/[0.62] px-4 text-sm font-medium text-foreground backdrop-blur-xl transition-all hover:border-primary/20 hover:bg-card/[0.82]"
                >
                  All agents
                </button>
                <button
                  onClick={() => router.push('/simulation')}
                  className="inline-flex h-11 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-[0_18px_44px_-26px_rgba(109,77,158,0.72)]"
                >
                  Open simulation lab
                </button>
              </div>
            </div>

            <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
                <div className="rounded-sm border border-border/70 bg-background/45 p-5">
                  <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">What this page is for</div>
                  <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  This workspace combines the agent&apos;s live conversation surface with memory, emotions, neural activity, relationships, learning, planning, creativity, journaling, collective knowledge, and mentorship systems.
                </p>
              </div>
              <div className="rounded-sm border border-border/70 bg-background/45 p-5">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Current focus</div>
                <p className="mt-3 text-sm leading-7 text-muted-foreground">
                  {activeTabConfig.description}
                </p>
              </div>
            </div>
          </div>
        </motion.section>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="page-section px-3 py-3 sm:px-4"
        >
          <div className="tab-nav overflow-x-auto">
            {TAB_CONFIG.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id
              return (
                <motion.button
                  key={tab.id}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => handleTabChange(tab.id)}
                  className={isActive ? 'tab-item tab-item-active' : 'tab-item'}
                >
                  <Icon className="h-4 w-4" />
                  <span>{tab.label}</span>
                </motion.button>
              )
            })}
          </div>
        </motion.div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Agent Info */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.2 }}
            className="space-y-6"
          >
            <div className="p-6 rounded-sm premium-card">
              <CardHeader className="space-y-4 p-0 pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="icon-container icon-container-purple">
                    <PlaygroundLogo className="h-5 w-5" />
                  </div>
                  Agent Information
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-0">
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
                    {currentAgent.goals.length > 0 ? currentAgent.goals.map((goal, index) => (
                      <li key={index} className="text-sm flex items-start gap-3 p-2 rounded-sm bg-muted/30">
                        <span className="w-1.5 h-1.5 rounded-full bg-primary mt-2 flex-shrink-0" />
                        <span className="leading-relaxed">{goal}</span>
                      </li>
                    )) : (
                      <li className="text-sm text-muted-foreground p-2 rounded-sm bg-muted/30">
                        No explicit goals set yet.
                      </li>
                    )}
                  </ul>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">Created</h4>
                  <p className="text-sm font-medium">
                    {new Date(currentAgent.createdAt).toLocaleDateString()}
                  </p>
                </div>

                <div className="space-y-3">
                  <h4 className="text-sm font-medium text-muted-foreground">LLM Runtime</h4>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      {LLM_PROVIDER_LABELS[selectedProvider]}
                    </span>
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-primary/10 text-primary border border-primary/20">
                      {activeProviderModel}
                    </span>
                  </div>
                  <LLMProviderToggle compact />
                </div>
              </CardContent>
            </div>

            {/* Phase 1: Level Progress */}
            <div className="p-6 rounded-sm premium-card">
              <CardHeader className="space-y-4 p-0 pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="icon-container icon-container-amber">
                    <Award className="h-5 w-5" />
                  </div>
                  Level & Progress
                </CardTitle>
              </CardHeader>
              <CardContent className="p-0">
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
            </div>

            {/* Phase 1: Emotion Mini Display */}
            <div className="p-6 rounded-sm premium-card">
              <CardHeader className="space-y-4 p-0 pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="icon-container icon-container-pink">
                    <Heart className="h-5 w-5" />
                  </div>
                  Current Mood
                </CardTitle>
              </CardHeader>
              <CardContent className="flex flex-col items-center p-0">
                <div className="mt-3 text-center">
                  <div className="text-lg font-medium capitalize">
                    {agentEmotionalState.dominantEmotion}
                  </div>
                  <div className="text-sm text-muted-foreground">
                    {emotionalService.getEmotionalSummary(agentEmotionalState)}
                  </div>
                </div>
              </CardContent>
            </div>

            <div className="p-6 rounded-sm premium-card">
              <CardHeader className="space-y-4 p-0 pb-4">
                <CardTitle className="flex items-center gap-3 text-xl">
                  <div className="icon-container icon-container-cyan">
                    <MessageCircle className="h-5 w-5" />
                  </div>
                  Chat Statistics
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-6 p-0">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center p-4 rounded-sm bg-violet-500/10">
                    <div className="text-3xl font-bold text-violet-400 mb-1">{agentStats.totalMessages}</div>
                    <div className="text-sm text-muted-foreground">Messages</div>
                  </div>
                  <div className="text-center p-4 rounded-sm bg-cyan-500/10">
                    <div className="text-3xl font-bold text-cyan-400 mb-1">{agentStats.conversationCount}</div>
                    <div className="text-sm text-muted-foreground">Sessions</div>
                  </div>
                  <div className="text-center p-4 rounded-sm bg-emerald-500/10">
                    <div className="text-3xl font-bold text-emerald-400 mb-1">{currentAgent.relationshipCount || 0}</div>
                    <div className="text-sm text-muted-foreground">Relationships</div>
                  </div>
                  <div className="text-center p-4 rounded-sm bg-amber-500/10">
                    <div className="text-3xl font-bold text-amber-400 mb-1">{currentAgent.memoryCount || 0}</div>
                    <div className="text-sm text-muted-foreground">Memories</div>
                  </div>
                </div>
              </CardContent>
            </div>
          </motion.div>

          {/* Main Content Area */}
          <div className="lg:col-span-2">
            {activeTab === 'chat' ? (
              /* Chat Interface */
              <div className="space-y-4">
                <Card className="h-[650px] flex flex-col backdrop-blur-sm bg-card/80 border-0 shadow-2xl">
                  <CardHeader className="border-b border-border/50 space-y-4">
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <div className="p-2 rounded-sm bg-primary/10">
                        <PlaygroundLogo className="h-6 w-6 text-primary" />
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
                              <div className="w-10 h-10 rounded-full bg-primary flex items-center justify-center flex-shrink-0 shadow-lg">
                                <PlaygroundLogo className="h-5 w-5 text-primary-foreground" />
                              </div>
                            )}

                            <div
                              className={`max-w-[75%] rounded-sm px-5 py-3 shadow-sm ${
                                message.type === 'user'
                                  ? 'bg-primary text-primary-foreground rounded-br-md'
                                  : 'bg-muted text-card-foreground rounded-bl-md'
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
                                      const toolsUsed = message.metadata?.toolsUsed as string[] | undefined
                                      return toolsUsed && toolsUsed.length > 0 && (
                                        <div className="absolute bottom-full left-0 mb-1 px-2 py-1 bg-popover text-popover-foreground text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-10">
                                          Tools: {toolsUsed.join(', ')}
                                        </div>
                                      )
                                    })()}
                                  </div>
                                )}
                              </div>
                            </div>

                            {message.type === 'user' && (
                              <div className="w-10 h-10 rounded-full bg-secondary flex items-center justify-center flex-shrink-0 shadow-lg">
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
                        className="gap-2 px-6 py-3 text-base font-medium rounded-sm shadow-lg hover:shadow-xl transition-all duration-200"
                      >
                        <Send className="h-5 w-5" />
                        Send
                      </Button>
                    </form>
                  </div>
                </Card>

                <VoiceConsole
                  agentName={currentAgent.name}
                  messages={messages}
                  value={newMessage}
                  onChange={setNewMessage}
                  linguisticProfile={currentAgent.linguisticProfile}
                  emotionalState={currentAgent.emotionalState}
                />
              </div>
            ) : activeTab === 'memory' ? (
              /* Memory & Growth Interface */
              <div className="space-y-6">
                {/* Personality Traits */}
                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-sm bg-accent/10">
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
                                className="bg-primary h-2 rounded-full transition-all duration-500"
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
                                className="bg-accent h-2 rounded-full transition-all duration-500"
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
                      <div className="p-2 rounded-sm bg-primary/10">
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
                          <div key={memory.id} className="flex gap-4 p-4 rounded-sm bg-muted/30 border border-border/50">
                            <div className="flex-shrink-0">
                              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-medium ${
                                memory.type === 'conversation' ? 'bg-[var(--color-pastel-blue)]/20 text-[var(--color-pastel-blue)]' :
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
                                    onClick={() => handleDeleteMemory(memory.id)}
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
                      <div className="p-2 rounded-sm bg-secondary/10">
                        <Calendar className="h-6 w-6 text-secondary" />
                      </div>
                      Memory Statistics
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                      <div className="text-center p-4 rounded-sm bg-primary/5">
                        <div className="text-2xl font-bold text-primary mb-1">{memoryStats.totalMemories || 0}</div>
                        <div className="text-sm text-muted-foreground">Total Memories</div>
                      </div>
                      <div className="text-center p-4 rounded-sm bg-accent/5">
                        <div className="text-2xl font-bold text-accent mb-1">
                          {Object.keys(memoryStats.memoriesByType || {}).length}
                        </div>
                        <div className="text-sm text-muted-foreground">Memory Types</div>
                      </div>
                      <div className="text-center p-4 rounded-sm bg-secondary/5">
                        <div className="text-2xl font-bold text-secondary mb-1">
                          {memoryStats.averageImportance ? Math.round(memoryStats.averageImportance * 10) / 10 : 0}
                        </div>
                        <div className="text-sm text-muted-foreground">Avg. Importance</div>
                      </div>
                      <div className="text-center p-4 rounded-sm bg-muted/30">
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
                      <div className="p-2 rounded-sm bg-pink-500/10">
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
                      <div className="p-2 rounded-sm bg-purple-500/10">
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
            ) : activeTab === 'neural' ? (
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-violet-500/10">
                      <Brain className="h-6 w-6 text-violet-500" />
                    </div>
                    Neural Activity
                  </CardTitle>
                  <CardDescription>
                    Visualize current attention, memory activation, and emotional flow for {currentAgent.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <NeuralActivityView agentId={currentAgent.id} />
                </CardContent>
              </Card>
            ) : activeTab === 'achievements' ? (
              /* Achievements Tab */
              <div className="space-y-6">
                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-sm bg-amber-500/10">
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
                      <div className="p-2 rounded-sm bg-green-500/10">
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
                      <div className="p-2 rounded-sm bg-gray-500/10">
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
                    <div className="p-2 rounded-sm bg-[var(--color-pastel-blue)]/20">
                      <Clock className="h-6 w-6 text-[var(--color-pastel-blue)]" />
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
            ) : activeTab === 'relationships' ? (
              <div className="space-y-6">
                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-sm bg-emerald-500/10">
                        <Users className="h-6 w-6 text-emerald-500" />
                      </div>
                      Relationship Network
                    </CardTitle>
                    <CardDescription>
                      Social dynamics, trust, and long-term bonds for {currentAgent.name}
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {loadingRelationships ? (
                      <div className="flex items-center justify-center py-8">
                        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                      </div>
                    ) : relationships.length === 0 ? (
                      <div className="rounded-sm border border-dashed border-border/60 p-8 text-center text-muted-foreground">
                        No persistent relationships yet. Run simulations, challenges, or mentorship sessions to build this network.
                      </div>
                    ) : (
                      <>
                        <div className="grid gap-4 md:grid-cols-3">
                          <div className="rounded-sm bg-emerald-500/10 p-4">
                            <div className="text-sm text-muted-foreground">Connections</div>
                            <div className="mt-2 text-3xl font-bold text-emerald-400">
                              {relationshipStats?.totalRelationships || relationships.length}
                            </div>
                          </div>
                          <div className="rounded-sm bg-violet-500/10 p-4">
                            <div className="text-sm text-muted-foreground">Strong Bonds</div>
                            <div className="mt-2 text-3xl font-bold text-violet-400">
                              {relationshipStats?.strongBonds || 0}
                            </div>
                          </div>
                          <div className="rounded-sm bg-cyan-500/10 p-4">
                            <div className="text-sm text-muted-foreground">Average Trust</div>
                            <div className="mt-2 text-3xl font-bold text-cyan-400">
                              {Math.round((relationshipStats?.averageTrust || 0) * 100)}%
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-sm border border-border/50 bg-background/45 p-4">
                          <RelationshipGraph
                            relationships={relationships}
                            agents={relationshipAgents.length > 0 ? relationshipAgents : [{ id: currentAgent.id, name: currentAgent.name }]}
                            currentAgentId={currentAgent.id}
                          />
                        </div>

                        <div className="grid gap-4 md:grid-cols-2">
                          {relationships.map((relationship) => {
                            const otherAgentId = relationship.agentId1 === currentAgent.id
                              ? relationship.agentId2
                              : relationship.agentId1
                            const otherAgentName = relationshipAgents.find(agent => agent.id === otherAgentId)?.name
                              || agents.find(agent => agent.id === otherAgentId)?.name
                              || 'Unknown agent'

                            return (
                              <RelationshipCard
                                key={relationship.id}
                                relationship={relationship}
                                otherAgentName={otherAgentName}
                              />
                            )
                          })}
                        </div>
                      </>
                    )}
                  </CardContent>
                </Card>

                <ConflictResolutionPanel
                  currentAgent={currentAgent as AgentRecord}
                  agents={agents as unknown as AgentRecord[]}
                />
              </div>
            ) : activeTab === 'learning' ? (
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-cyan-500/10">
                      <TrendingUp className="h-6 w-6 text-cyan-500" />
                    </div>
                    Meta-Learning Dashboard
                  </CardTitle>
                  <CardDescription>
                    How {currentAgent.name} adapts, discovers patterns, and sets new learning goals
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {loadingLearning ? (
                    <div className="flex items-center justify-center py-8">
                      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                    </div>
                  ) : learningState ? (
                    <MetaLearningDashboard state={learningState} skills={learningSkills} />
                  ) : (
                    <div className="rounded-sm border border-dashed border-border/60 p-8 text-center text-muted-foreground">
                      Learning patterns will appear after enough conversation history is available.
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : activeTab === 'planning' ? (
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-amber-500/10">
                      <Calendar className="h-6 w-6 text-amber-500" />
                    </div>
                    Future Planning
                  </CardTitle>
                  <CardDescription>
                    Predicted trajectories, milestones, and next actions for {currentAgent.name}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  {futurePlan ? (
                    <FuturePlanningView plan={futurePlan} />
                  ) : (
                    <div className="rounded-sm border border-dashed border-border/60 p-8 text-center text-muted-foreground">
                      Planning insights need a little history first. Conversations, timeline events, and learning goals feed this forecast.
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : activeTab === 'scenarios' ? (
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-violet-500/10">
                      <Sparkles className="h-6 w-6 text-violet-500" />
                    </div>
                    Parallel Realities
                  </CardTitle>
                  <CardDescription>
                    Explore what-if branches using emotional, social, and progress data from the live agent
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div className="flex flex-wrap gap-2">
                    {scenarioTemplates.map((scenario) => (
                      <button
                        key={scenario.id}
                        onClick={() => {
                          setSelectedScenarioId(scenario.id)
                          setParallelReality(
                            parallelRealityService.createParallelReality(
                              currentAgent as AgentRecord,
                              scenario,
                              relationships
                            )
                          )
                        }}
                        className={`rounded-full px-4 py-2 text-sm transition-colors ${
                          selectedScenarioId === scenario.id
                            ? 'bg-primary text-primary-foreground'
                            : 'bg-muted text-muted-foreground hover:text-foreground'
                        }`}
                      >
                        {scenario.title}
                      </button>
                    ))}
                  </div>

                  {parallelReality ? (
                    <ParallelRealityExplorer
                      reality={parallelReality}
                      onExplore={() => void loadParallelReality()}
                      onReset={() => setParallelReality(null)}
                    />
                  ) : (
                    <div className="rounded-sm border border-dashed border-border/60 p-8 text-center text-muted-foreground">
                      Choose a scenario template to compare the current trajectory against an alternate path.
                    </div>
                  )}
                </CardContent>
              </Card>
            ) : activeTab === 'creative' ? (
              /* Phase 2: Creative Portfolio Tab */
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-purple-500/10">
                      <Palette className="h-6 w-6 text-purple-500" />
                    </div>
                    Creative Portfolio
                  </CardTitle>
                  <CardDescription>
                    {currentAgent.name}&apos;s creative works including stories, poems, and more
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CreativePortfolio agentId={currentAgent.id} agentName={currentAgent.name} />
                </CardContent>
              </Card>
            ) : activeTab === 'dreams' ? (
              /* Phase 2: Dream Journal Tab */
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-[var(--color-pastel-purple)]/20">
                      <Moon className="h-6 w-6 text-[var(--color-pastel-purple)]" />
                    </div>
                    Dream Journal
                  </CardTitle>
                  <CardDescription>
                    Explore {currentAgent.name}&apos;s subconscious through generated dreams
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <DreamJournal agentId={currentAgent.id} agentName={currentAgent.name} />
                </CardContent>
              </Card>
            ) : activeTab === 'journal' ? (
              /* Phase 2: Journal Tab */
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-amber-500/10">
                      <BookOpen className="h-6 w-6 text-amber-500" />
                    </div>
                    Personal Journal
                  </CardTitle>
                  <CardDescription>
                    {currentAgent.name}&apos;s personal reflections and thoughts
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <JournalViewer agentId={currentAgent.id} agentName={currentAgent.name} />
                </CardContent>
              </Card>
            ) : activeTab === 'profile' ? (
              <div className="space-y-6">
                <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                  <CardHeader className="space-y-4">
                    <CardTitle className="flex items-center gap-3 text-xl">
                      <div className="p-2 rounded-sm bg-cyan-500/10">
                        <Target className="h-6 w-6 text-cyan-500" />
                      </div>
                      Psychological Profile
                    </CardTitle>
                    <CardDescription>
                      {currentAgent.name}&apos;s personality assessments (Big Five, MBTI, Enneagram)
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <ProfileViewer agentId={currentAgent.id} agentName={currentAgent.name} />
                  </CardContent>
                </Card>

                {currentAgent.linguisticProfile && (
                  <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                    <CardHeader className="space-y-4">
                      <CardTitle className="flex items-center gap-3 text-xl">
                        <div className="p-2 rounded-sm bg-violet-500/10">
                          <Languages className="h-6 w-6 text-violet-500" />
                        </div>
                        Linguistic Personality
                      </CardTitle>
                      <CardDescription>
                        Communication style, vocabulary bias, and expressive tendencies generated from the persona definition
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <LinguisticProfileCard
                        profile={currentAgent.linguisticProfile}
                        agentName={currentAgent.name}
                      />
                    </CardContent>
                  </Card>
                )}
              </div>
            ) : activeTab === 'challenges' ? (
              /* Phase 2: Challenges Tab */
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-rose-500/10">
                      <Swords className="h-6 w-6 text-rose-500" />
                    </div>
                    Challenge Hub
                  </CardTitle>
                  <CardDescription>
                    Collaborative challenges and competitions between agents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <ChallengeHub currentAgentId={currentAgent.id} agents={agents as unknown as AgentRecord[]} />
                </CardContent>
              </Card>
            ) : activeTab === 'knowledge-graph' ? (
              /* Phase 3: Knowledge Graph Tab */
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-emerald-500/10">
                      <Network className="h-6 w-6 text-emerald-500" />
                    </div>
                    Knowledge Graph
                  </CardTitle>
                  <CardDescription>
                    Visualize {currentAgent.name}&apos;s memory connections and concept relationships
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <KnowledgeGraph agentId={currentAgent.id} />
                </CardContent>
              </Card>
            ) : activeTab === 'knowledge-library' ? (
              /* Phase 3: Shared Knowledge Library Tab */
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-[var(--color-pastel-blue)]/20">
                      <Library className="h-6 w-6 text-[var(--color-pastel-blue)]" />
                    </div>
                    Shared Knowledge Library
                  </CardTitle>
                  <CardDescription>
                    Browse and contribute to the collective knowledge base shared by all agents
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <SharedKnowledgeLibrary
                    agentId={currentAgent.id}
                    agentName={currentAgent.name}
                    showContribute={true}
                  />
                </CardContent>
              </Card>
            ) : activeTab === 'collective' ? (
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-cyan-500/10">
                      <Users className="h-6 w-6 text-cyan-500" />
                    </div>
                    Collective Intelligence
                  </CardTitle>
                  <CardDescription>
                    Discover who knows what, validate shared knowledge, and broadcast new findings across the agent network
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <CollectiveIntelligencePanel
                    agentId={currentAgent.id}
                    agentName={currentAgent.name}
                  />
                </CardContent>
              </Card>
            ) : activeTab === 'mentorship' ? (
              /* Phase 3: Mentorship Hub Tab */
              <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-xl">
                <CardHeader className="space-y-4">
                  <CardTitle className="flex items-center gap-3 text-xl">
                    <div className="p-2 rounded-sm bg-violet-500/10">
                      <GraduationCap className="h-6 w-6 text-violet-500" />
                    </div>
                    Mentorship Hub
                  </CardTitle>
                  <CardDescription>
                    Find mentors, teach others, and track {currentAgent.name}&apos;s learning journey
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <MentorshipHub
                    agentId={currentAgent.id}
                    agentName={currentAgent.name}
                    allAgents={agents as unknown as AgentRecord[]}
                  />
                </CardContent>
              </Card>
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
