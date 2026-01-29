import { create } from 'zustand'
import { devtools } from 'zustand/middleware'
import {
  CreateAgentData,
  MemoryRecord,
  CreateMemoryData,
  AgentProgress,
  AgentStats,
  EmotionalState,
  EmotionalEvent,
  LinguisticProfile
} from '@/types/database'

export interface Agent {
  id: string
  name: string
  persona: string
  goals: string[]
  createdAt: string
  updatedAt?: string
  status: 'active' | 'inactive' | 'training'
  coreTraits?: Record<string, number> // Immutable personality traits
  dynamicTraits?: Record<string, number> // Learned personality traits
  memoryCount?: number // Number of memories stored
  totalInteractions?: number // Total interactions for personality evolution

  // Phase 1: Linguistic Personality System
  linguisticProfile?: LinguisticProfile

  // Phase 1: Achievement & Progress System
  progress?: AgentProgress
  stats?: AgentStats

  // Phase 1: Emotional State System
  emotionalState?: EmotionalState
  emotionalHistory?: EmotionalEvent[]
}

interface AgentState {
  agents: Agent[]
  currentAgent: Agent | null
  loading: boolean

  // Actions
  setAgents: (agents: Agent[]) => void
  addAgent: (agent: Agent) => void
  updateAgent: (id: string, updates: Partial<Agent>) => void
  deleteAgent: (id: string) => void
  setCurrentAgent: (agent: Agent | null) => void
  setLoading: (loading: boolean) => void

  // Firestore-backed functions
  fetchAgents: () => Promise<void>
  createAgent: (agentData: CreateAgentData) => Promise<void>
  updateAgentStatus: (id: string, status: Agent['status']) => Promise<void>
  deleteAgentAsync: (id: string) => Promise<void>

  // Memory and personality functions
  fetchAgentMemories: (agentId: string) => Promise<MemoryRecord[]>
  addMemory: (agentId: string, memoryData: CreateMemoryData) => Promise<void>
  deleteMemory: (memoryId: string) => Promise<void>
  getMemoryStats: (agentId: string) => Promise<{
    totalMemories: number
    memoriesByType: Record<string, number>
    averageImportance: number
    oldestMemory?: string
    newestMemory?: string
  }>
}

export const useAgentStore = create<AgentState>()(
  devtools(
    (set, get) => ({
      agents: [],
      currentAgent: null,
      loading: false,

      setAgents: (agents) => set({ agents }),

      addAgent: (agent) => set((state) => ({
        agents: [...state.agents, agent]
      })),

      updateAgent: (id, updates) =>
        set((state) => ({
          agents: state.agents.map((agent) =>
            agent.id === id ? { ...agent, ...updates } : agent
          ),
        })),

      deleteAgent: (id) =>
        set((state) => ({
          agents: state.agents.filter((agent) => agent.id !== id),
        })),

      setCurrentAgent: (agent) => set({ currentAgent: agent }),

      setLoading: (loading) => set({ loading }),

      // Firestore-backed functions
      fetchAgents: async () => {
        set({ loading: true })
        try {
          const response = await fetch('/api/agents')
          if (response.ok) {
            const data = await response.json()
            set({ agents: data.data || [] })
          } else {
            set({ agents: [] })
          }
        } catch (error) {
          console.error('Failed to fetch agents:', error)
        } finally {
          set({ loading: false })
        }
      },

      createAgent: async (agentData) => {
        set({ loading: true })
        try {
          const response = await fetch('/api/agents', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(agentData)
          })
          if (response.ok) {
            const data = await response.json()
            if (data?.data) {
              get().addAgent(data.data)
            }
          }
        } catch (error) {
          console.error('Failed to create agent:', error)
        } finally {
          set({ loading: false })
        }
      },

      updateAgentStatus: async (id, status) => {
        try {
          const response = await fetch('/api/agents', {
            method: 'PUT',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id, status })
          })
          if (response.ok) {
            get().updateAgent(id, { status })
          }
        } catch (error) {
          console.error('Failed to update agent status:', error)
        }
      },

      deleteAgentAsync: async (id) => {
        try {
          const response = await fetch(`/api/agents?id=${encodeURIComponent(id)}`, {
            method: 'DELETE'
          })
          if (response.ok) {
            get().deleteAgent(id)
          }
        } catch (error) {
          console.error('Failed to delete agent:', error)
        }
      },

      // Memory and personality functions
      fetchAgentMemories: async (agentId) => {
        try {
          const response = await fetch(`/api/memory?action=get&agentId=${encodeURIComponent(agentId)}`)
          if (response.ok) {
            const data = await response.json()
            return data.memories || []
          }
          return []
        } catch (error) {
          console.error('Failed to fetch agent memories:', error)
          return []
        }
      },

      addMemory: async (agentId, memoryData) => {
        try {
          const response = await fetch('/api/memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'create',
              agentId,
              memoryData
            })
          })

          if (response.ok) {
            await response.json()
            // Update agent's memory count
            const agent = get().agents.find(a => a.id === agentId)
            if (agent) {
              get().updateAgent(agentId, {
                memoryCount: (agent.memoryCount || 0) + 1
              })
            }
          }
        } catch (error) {
          console.error('Failed to add memory:', error)
        }
      },

      deleteMemory: async (memoryId) => {
        try {
          const response = await fetch('/api/memory', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'delete',
              memoryId
            })
          })

          if (response.ok) {
            // Memory deletion handled by API
            return true
          }
          return false
        } catch (error) {
          console.error('Failed to delete memory:', error)
          return false
        }
      },

      getMemoryStats: async (agentId) => {
        try {
          const response = await fetch(`/api/memory?action=getStats&agentId=${encodeURIComponent(agentId)}`)
          if (response.ok) {
            const data = await response.json()
            return data.stats || {}
          }
          return {}
        } catch (error) {
          console.error('Failed to get memory stats:', error)
          return {}
        }
      },
    }),
    {
      name: 'agent-store',
    }
  )
)
