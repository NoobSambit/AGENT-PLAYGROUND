'use client'

import React, { Suspense, useState, useMemo, useCallback } from 'react'
import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { AnimatePresence } from 'framer-motion'
import {
  AgentRecord,
  MemoryVisualization,
  Vector3
} from '@/types/database'
import { useNeuralVisualization } from '@/hooks/useNeuralVisualization'
import { RealVisualizationData } from '@/lib/services/neuralVisualizationService'

// Import modular components
import { MemoryNode } from './MemoryNode'
import { NeuralConnections } from './Connections'
import { NeuralCore } from './NeuralCore'
import { EmotionalAura } from './ParticleSystem'
import { ThoughtFlowVisualization } from './ThoughtFlows'
import { BoundaryShell, StarField, Lighting, PostProcessing } from './Effects'
import {
  AgentInfoOverlay,
  VisualizationLegend,
  MemoryDetailPanel,
  ControlsHint
} from './UIOverlays'

// ============================================
// TYPES
// ============================================

interface NeuralVizProps {
  agent: AgentRecord
  height?: number
  className?: string
  isActive?: boolean
  showThoughtFlow?: boolean
}

// ============================================
// 3D SCENE
// ============================================

function Scene({
  vizData,
  isActive,
  processingStage,
  onMemoryClick
}: {
  vizData: RealVisualizationData
  isActive: boolean
  processingStage: RealVisualizationData['processingStage']
  onMemoryClick?: (memory: MemoryVisualization) => void
}) {
  // Build position map for connections
  const memoryPositions = useMemo(() => {
    const map = new Map<string, Vector3>()
    vizData.memories.forEach(m => {
      map.set(m.id, m.position)
    })
    return map
  }, [vizData.memories])

  // Recently created set
  const recentlyCreatedSet = useMemo(() =>
    new Set(vizData.recentlyCreatedIds || []),
    [vizData.recentlyCreatedIds]
  )

  // Activated positions for thought flows
  const activatedPositions = useMemo(() =>
    vizData.memories
      .filter(m => m.activated)
      .map(m => m.position),
    [vizData.memories]
  )

  // Determine memory type from metadata or ID pattern
  const getMemoryType = useCallback((memory: MemoryVisualization) => {
    // Could be enhanced to use actual memory type from extended data
    const types = ['conversation', 'fact', 'interaction', 'personality_insight'] as const
    const hash = memory.id.split('').reduce((a, b) => a + b.charCodeAt(0), 0)
    return types[hash % types.length]
  }, [])

  return (
    <>
      {/* Lighting */}
      <Lighting isActive={isActive} processingStage={processingStage} />

      {/* Background */}
      <StarField isActive={isActive} />
      <BoundaryShell />

      {/* Particle system (emotional aura) */}
      <EmotionalAura
        emotions={vizData.emotionalState}
        isActive={isActive}
        processingStage={processingStage}
      />

      {/* Neural connections */}
      <NeuralConnections
        connections={vizData.connections}
        memoryPositions={memoryPositions}
        isActive={isActive}
      />

      {/* Memory nodes */}
      {vizData.memories.map((memory, i) => (
        <MemoryNode
          key={memory.id}
          memory={memory}
          memoryType={getMemoryType(memory)}
          index={i}
          isActive={isActive}
          isRecentlyCreated={recentlyCreatedSet.has(memory.id)}
          onClick={onMemoryClick}
        />
      ))}

      {/* Thought flows */}
      <ThoughtFlowVisualization
        flows={vizData.thoughtFlow}
        processingStage={processingStage}
        activatedPositions={activatedPositions}
      />

      {/* Neural core */}
      <NeuralCore
        emotions={vizData.emotionalState}
        isActive={isActive}
        processingStage={processingStage}
      />

      {/* Post-processing */}
      <PostProcessing isActive={isActive} processingStage={processingStage} />

      {/* Camera controls */}
      <OrbitControls
        enableZoom
        enablePan={false}
        enableRotate
        autoRotate
        autoRotateSpeed={isActive ? 0.8 : 0.25}
        minDistance={8}
        maxDistance={25}
        dampingFactor={0.05}
        enableDamping
      />
    </>
  )
}

// ============================================
// LOADING & ERROR STATES
// ============================================

function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e]">
      <div className="text-center">
        <div className="relative w-20 h-20 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-ping" />
          <div className="absolute inset-2 rounded-full border-2 border-purple-500/50 animate-pulse" />
          <div className="absolute inset-4 rounded-full border-2 border-pink-500/40 animate-spin" />
          <div className="absolute inset-6 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500" />
        </div>
        <div className="text-white text-sm font-medium">Initializing Neural Network</div>
        <div className="text-gray-400 text-xs mt-1">Loading memories and connections...</div>
      </div>
    </div>
  )
}

function ErrorFallback({ error }: { error: Error }) {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e]">
      <div className="text-center px-4">
        <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-red-500/20 flex items-center justify-center">
          <span className="text-red-400 text-xl">!</span>
        </div>
        <div className="text-red-400 text-sm font-medium mb-1">Visualization Error</div>
        <div className="text-gray-400 text-xs max-w-xs">{error.message}</div>
      </div>
    </div>
  )
}

// ============================================
// MAIN COMPONENT
// ============================================

export function NeuralVizEnhanced({
  agent,
  height = 600,
  className = '',
  isActive = false,
  showThoughtFlow = true
}: NeuralVizProps) {
  const [selectedMemory, setSelectedMemory] = useState<MemoryVisualization | null>(null)

  // Use visualization hook with real data
  const vizHook = useNeuralVisualization({
    agent,
    isActive,
    autoLoadMemories: true,
    refreshInterval: isActive ? 30000 : 0
  })

  const {
    vizData,
    processingStage,
    memoryCount,
    activatedCount,
    isLoading,
    isInitialized,
    error
  } = vizHook

  // Calculate memory type distribution
  const memoryTypes = useMemo(() => {
    const types: Record<string, number> = {}
    vizData.memories.forEach(m => {
      const type = m.id.includes('conv') ? 'conversation' :
                   m.id.includes('fact') ? 'fact' :
                   m.id.includes('inter') ? 'interaction' : 'personality'
      types[type] = (types[type] || 0) + 1
    })
    return types
  }, [vizData.memories])

  const handleMemoryClick = useCallback((memory: MemoryVisualization) => {
    setSelectedMemory(prev => prev?.id === memory.id ? null : memory)
  }, [])

  // Loading state
  if (isLoading && !isInitialized) {
    return (
      <div className={`relative ${className}`} style={{ height }}>
        <LoadingFallback />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <div className={`relative ${className}`} style={{ height }}>
        <ErrorFallback error={error} />
      </div>
    )
  }

  return (
    <div className={`relative ${className}`} style={{ height }}>
      {/* 3D Canvas */}
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 0, 16], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
          }}
          dpr={[1, 2]}
          style={{
            background: 'linear-gradient(180deg, #050510 0%, #0a0a1a 30%, #1a1a2e 70%, #0f0f20 100%)'
          }}
        >
          <Scene
            vizData={vizData}
            isActive={isActive}
            processingStage={showThoughtFlow ? processingStage : 'idle'}
            onMemoryClick={handleMemoryClick}
          />
        </Canvas>
      </Suspense>

      {/* UI Overlays */}
      <AgentInfoOverlay
        agent={agent}
        memoryCount={memoryCount}
        activatedCount={activatedCount}
        isActive={isActive}
        processingStage={processingStage}
        memoryTypes={memoryTypes}
      />

      <VisualizationLegend
        emotions={vizData.emotionalState}
      />

      <ControlsHint />

      {/* Memory detail panel */}
      <AnimatePresence>
        {selectedMemory && (
          <MemoryDetailPanel
            memory={selectedMemory}
            onClose={() => setSelectedMemory(null)}
          />
        )}
      </AnimatePresence>
    </div>
  )
}

// Re-export components for external use
export { MemoryNode } from './MemoryNode'
export { NeuralConnections } from './Connections'
export { NeuralCore } from './NeuralCore'
export { EmotionalAura } from './ParticleSystem'
export { ThoughtFlowVisualization } from './ThoughtFlows'
export { BoundaryShell, StarField, Lighting, PostProcessing } from './Effects'
export {
  AgentInfoOverlay,
  VisualizationLegend,
  MemoryDetailPanel,
  ControlsHint
} from './UIOverlays'

export default NeuralVizEnhanced
