'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { AgentRecord, MemoryRecord } from '@/types/database'
import { MemoryService } from '@/lib/services/memoryService'
import {
  NeuralVisualizationService,
  RealVisualizationData,
  ProcessingStage,
  VisualizationEvent,
  createNeuralVisualizationService
} from '@/lib/services/neuralVisualizationService'

export interface UseNeuralVisualizationOptions {
  agent: AgentRecord | null
  isActive?: boolean
  autoLoadMemories?: boolean
  refreshInterval?: number // ms, 0 to disable
}

export interface UseNeuralVisualizationReturn {
  // Visualization data
  vizData: RealVisualizationData
  processingStage: ProcessingStage
  memoryCount: number
  activatedCount: number

  // Loading states
  isLoading: boolean
  isInitialized: boolean
  error: Error | null

  // Actions
  refreshMemories: () => Promise<void>
  onMessageReceived: (message: string) => void
  onMemoriesRetrieved: (memoryIds: string[]) => void
  onResponseGenerated: () => void
  setProcessingStage: (stage: ProcessingStage) => void

  // Service instance for advanced usage
  service: NeuralVisualizationService
}

/**
 * React hook for managing neural visualization with real data
 *
 * Features:
 * - Loads actual memories from Firestore
 * - Tracks processing stages during conversations
 * - Provides real-time updates for visualization
 * - Manages memory activation based on queries
 * - Stays within free tier limits (client-side processing)
 */
export function useNeuralVisualization(
  options: UseNeuralVisualizationOptions
): UseNeuralVisualizationReturn {
  const { agent, isActive = false, autoLoadMemories = true, refreshInterval = 0 } = options

  // Service instance (persists across renders)
  const serviceRef = useRef<NeuralVisualizationService>(createNeuralVisualizationService())
  const service = serviceRef.current

  // State
  const [vizData, setVizData] = useState<RealVisualizationData>(() =>
    service.generateVisualizationData()
  )
  const [isLoading, setIsLoading] = useState(false)
  const [isInitialized, setIsInitialized] = useState(false)
  const [error, setError] = useState<Error | null>(null)
  const [processingStage, setProcessingStageState] = useState<ProcessingStage>('idle')

  // Track previous agent ID to detect changes
  const previousAgentIdRef = useRef<string | null>(null)

  /**
   * Load memories from Firestore
   */
  const loadMemories = useCallback(async (agentId: string): Promise<MemoryRecord[]> => {
    try {
      const memories = await MemoryService.getAllMemoriesForAgent(agentId)
      return memories
    } catch (err) {
      console.error('Error loading memories:', err)
      throw err
    }
  }, [])

  /**
   * Refresh memories and update visualization
   */
  const refreshMemories = useCallback(async () => {
    if (!agent) return

    setIsLoading(true)
    setError(null)

    try {
      const memories = await loadMemories(agent.id)
      service.updateMemories(memories)
      setVizData(service.generateVisualizationData())
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Failed to load memories'))
    } finally {
      setIsLoading(false)
    }
  }, [agent, loadMemories, service])

  /**
   * Initialize service when agent changes
   */
  useEffect(() => {
    if (!agent) {
      setIsInitialized(false)
      return
    }

    // Only reinitialize if agent changed
    if (previousAgentIdRef.current === agent.id && isInitialized) {
      return
    }

    previousAgentIdRef.current = agent.id
    setIsInitialized(false)
    setIsLoading(true)
    setError(null)

    const initialize = async () => {
      try {
        let memories: MemoryRecord[] = []

        if (autoLoadMemories) {
          memories = await loadMemories(agent.id)
        }

        service.initialize(agent, memories)
        setVizData(service.generateVisualizationData())
        setIsInitialized(true)
      } catch (err) {
        setError(err instanceof Error ? err : new Error('Failed to initialize visualization'))
      } finally {
        setIsLoading(false)
      }
    }

    initialize()
  }, [agent, autoLoadMemories, loadMemories, service, isInitialized])

  /**
   * Set up refresh interval
   */
  useEffect(() => {
    if (refreshInterval <= 0 || !agent) return

    const intervalId = setInterval(() => {
      refreshMemories()
    }, refreshInterval)

    return () => clearInterval(intervalId)
  }, [refreshInterval, agent, refreshMemories])

  /**
   * Handle event updates
   */
  useEffect(() => {
    const handleEvent = (event: VisualizationEvent) => {
      // Update viz data after any event
      setVizData(service.generateVisualizationData())
      setProcessingStageState(service.getProcessingStage())
    }

    // Subscribe to all event types
    const eventTypes: VisualizationEvent['type'][] = [
      'message_received',
      'memories_retrieved',
      'emotion_detected',
      'response_generated',
      'memory_created'
    ]

    eventTypes.forEach(type => {
      service.addEventListener(type, handleEvent)
    })

    return () => {
      eventTypes.forEach(type => {
        service.removeEventListener(type, handleEvent)
      })
    }
  }, [service])

  /**
   * Action handlers
   */
  const onMessageReceived = useCallback((message: string) => {
    service.onMessageReceived(message)
    setVizData(service.generateVisualizationData())
    setProcessingStageState(service.getProcessingStage())
  }, [service])

  const onMemoriesRetrieved = useCallback((memoryIds: string[]) => {
    service.onMemoriesRetrieved(memoryIds)
    setVizData(service.generateVisualizationData())
    setProcessingStageState(service.getProcessingStage())
  }, [service])

  const onResponseGenerated = useCallback(() => {
    service.onResponseGenerated()
    setVizData(service.generateVisualizationData())
    setProcessingStageState(service.getProcessingStage())
  }, [service])

  const setProcessingStage = useCallback((stage: ProcessingStage) => {
    service.setProcessingStage(stage)
    setVizData(service.generateVisualizationData())
    setProcessingStageState(stage)
  }, [service])

  return {
    vizData,
    processingStage,
    memoryCount: service.getMemoryCount(),
    activatedCount: service.getActivatedCount(),
    isLoading,
    isInitialized,
    error,
    refreshMemories,
    onMessageReceived,
    onMemoriesRetrieved,
    onResponseGenerated,
    setProcessingStage,
    service
  }
}

/**
 * Lightweight hook for just getting visualization data without full management
 * Useful for simple display components
 */
export function useVisualizationData(
  agent: AgentRecord | null,
  memories: MemoryRecord[] = []
): RealVisualizationData {
  const serviceRef = useRef<NeuralVisualizationService>(createNeuralVisualizationService())
  const [vizData, setVizData] = useState<RealVisualizationData>(() =>
    serviceRef.current.generateVisualizationData()
  )

  useEffect(() => {
    if (agent) {
      serviceRef.current.initialize(agent, memories)
      setVizData(serviceRef.current.generateVisualizationData())
    }
  }, [agent, memories])

  return vizData
}

export default useNeuralVisualization
