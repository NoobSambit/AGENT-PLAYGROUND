'use client'

import { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { AgentRecord, EmotionVisualization, EMOTION_COLORS, MemoryVisualization } from '@/types/database'
import { ProcessingStage } from '@/lib/services/neuralVisualizationService'
import { ChevronDown, ChevronUp, X, Brain, Zap, Clock, Database } from 'lucide-react'

interface AgentInfoProps {
  agent: AgentRecord
  memoryCount: number
  activatedCount: number
  isActive: boolean
  processingStage: ProcessingStage
  memoryTypes?: Record<string, number>
}

interface LegendProps {
  emotions: EmotionVisualization[]
  processingStage: ProcessingStage
  onFilterChange?: (filter: FilterOptions) => void
}

interface MemoryDetailProps {
  memory: MemoryVisualization | null
  onClose: () => void
}

interface FilterOptions {
  showConversation: boolean
  showFact: boolean
  showInteraction: boolean
  showPersonality: boolean
  showConnections: boolean
  minImportance: number
}

// Processing stage progress bar
function ProcessingProgress({ stage }: { stage: ProcessingStage }) {
  const stages: ProcessingStage[] = ['receiving', 'retrieving', 'processing', 'responding']
  const currentIndex = stages.indexOf(stage)

  if (stage === 'idle') return null

  return (
    <div className="mt-3 pt-3 border-t border-white/10">
      <div className="flex items-center gap-1.5 mb-2">
        <Zap className="w-3 h-3 text-cyan-400" />
        <span className="text-[10px] text-cyan-400 font-medium uppercase tracking-wider">
          {stage === 'receiving' && 'Receiving Input'}
          {stage === 'retrieving' && 'Searching Memories'}
          {stage === 'processing' && 'Processing'}
          {stage === 'responding' && 'Generating Response'}
        </span>
      </div>
      <div className="flex gap-1">
        {stages.map((s, i) => (
          <div
            key={s}
            className={`h-1 flex-1 rounded-full transition-all duration-300 ${
              i <= currentIndex
                ? 'bg-cyan-400'
                : 'bg-white/10'
            } ${i === currentIndex ? 'animate-pulse' : ''}`}
          />
        ))}
      </div>
    </div>
  )
}

// Agent info panel (top-left)
export function AgentInfoOverlay({
  agent,
  memoryCount,
  activatedCount,
  isActive,
  processingStage,
  memoryTypes = {}
}: AgentInfoProps) {
  const [expanded, setExpanded] = useState(false)

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      className="absolute top-4 left-4 bg-black/80 backdrop-blur-xl rounded-2xl text-white border border-white/10 shadow-2xl overflow-hidden"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center gap-3">
          {isActive && (
            <div className="relative">
              <div className="w-3 h-3 bg-green-400 rounded-full" />
              <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping opacity-75" />
            </div>
          )}
          <div className="flex-1">
            <div className="font-bold text-lg flex items-center gap-2">
              <Brain className="w-4 h-4 text-cyan-400" />
              {agent.name}&apos;s Mind
            </div>
            <div className="text-[10px] text-gray-400 uppercase tracking-wider">
              {processingStage !== 'idle' ? (
                <span className="text-cyan-400">Processing...</span>
              ) : isActive ? 'Active' : 'Idle State'}
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
        </div>

        {/* Stats grid */}
        <div className="mt-3 grid grid-cols-2 gap-2">
          <div className="bg-gradient-to-br from-cyan-500/20 to-cyan-500/5 rounded-xl p-3 border border-cyan-500/20">
            <div className="flex items-center gap-1.5 text-gray-400 text-[10px] mb-1">
              <Database className="w-3 h-3" />
              Memories
            </div>
            <div className="text-2xl font-bold text-cyan-400">{memoryCount}</div>
          </div>
          <div className="bg-gradient-to-br from-green-500/20 to-green-500/5 rounded-xl p-3 border border-green-500/20">
            <div className="flex items-center gap-1.5 text-gray-400 text-[10px] mb-1">
              <Zap className="w-3 h-3" />
              Active
            </div>
            <div className="text-2xl font-bold text-green-400">{activatedCount}</div>
          </div>
        </div>

        {/* Processing progress */}
        <ProcessingProgress stage={processingStage} />

        {/* Expanded content */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">
                  Memory Distribution
                </div>
                <div className="space-y-1.5">
                  {Object.entries(memoryTypes).map(([type, count]) => (
                    <div key={type} className="flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-cyan-400" />
                      <span className="flex-1 text-xs capitalize">{type.replace('_', ' ')}</span>
                      <span className="text-xs text-gray-400">{count}</span>
                    </div>
                  ))}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// Legend panel (bottom-left)
export function VisualizationLegend({
  emotions,
  processingStage,
  onFilterChange
}: LegendProps) {
  const [expanded, setExpanded] = useState(false)
  const [filters, setFilters] = useState<FilterOptions>({
    showConversation: true,
    showFact: true,
    showInteraction: true,
    showPersonality: true,
    showConnections: true,
    minImportance: 0
  })

  const handleFilterToggle = (key: keyof FilterOptions) => {
    const newFilters = { ...filters, [key]: !filters[key] }
    setFilters(newFilters)
    if (onFilterChange) onFilterChange(newFilters)
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="absolute bottom-4 left-4 bg-black/80 backdrop-blur-xl rounded-2xl text-white border border-white/10 shadow-2xl max-w-[280px]"
    >
      <div className="p-4">
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="font-semibold text-sm tracking-wide">Neural Activity</div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors text-[10px] text-gray-400"
          >
            {expanded ? 'Less' : 'More'}
          </button>
        </div>

        {/* Memory states */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50 animate-pulse" />
            <span className="text-gray-300">Active</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-gray-500" />
            <span className="text-gray-300">Dormant</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
            <span className="text-gray-300">New</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-2.5 h-2.5 rounded-sm bg-gradient-to-r from-green-400 to-fuchsia-400" />
            <span className="text-gray-300">Flow</span>
          </div>
        </div>

        {/* Memory type shapes */}
        <div className="mt-3 pt-3 border-t border-white/10">
          <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Memory Types</div>
          <div className="grid grid-cols-2 gap-1.5 text-[11px]">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rotate-45 bg-cyan-400/30 border border-cyan-400" />
              <span>Conversation</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full bg-cyan-400/30 border border-cyan-400" />
              <span>Fact</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rotate-45 scale-75 bg-cyan-400/30 border border-cyan-400" style={{ clipPath: 'polygon(50% 0%, 100% 50%, 50% 100%, 0% 50%)' }} />
              <span>Interaction</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 rounded-full border-2 border-cyan-400 bg-transparent" />
              <span>Personality</span>
            </div>
          </div>
        </div>

        {/* Emotion indicators */}
        {emotions.length > 0 && (
          <div className="mt-3 pt-3 border-t border-white/10">
            <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Emotional State</div>
            <div className="space-y-1.5">
              {emotions.slice(0, 4).map((e) => (
                <div key={e.emotion} className="flex items-center gap-2">
                  <div
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ backgroundColor: e.color, boxShadow: `0 0 8px ${e.color}` }}
                  />
                  <span className="text-gray-300 capitalize text-xs flex-1">{e.emotion}</span>
                  <div className="w-16 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                    <motion.div
                      className="h-full rounded-full"
                      style={{ backgroundColor: e.color }}
                      initial={{ width: 0 }}
                      animate={{ width: `${e.intensity * 100}%` }}
                      transition={{ duration: 0.5 }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Expanded filters */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className="overflow-hidden"
            >
              <div className="mt-3 pt-3 border-t border-white/10">
                <div className="text-[10px] text-gray-400 uppercase tracking-wider mb-2">Filters</div>
                <div className="space-y-1.5">
                  {(['showConversation', 'showFact', 'showInteraction', 'showPersonality'] as const).map((key) => (
                    <button
                      key={key}
                      onClick={() => handleFilterToggle(key)}
                      className={`flex items-center gap-2 w-full px-2 py-1 rounded-lg transition-colors text-xs ${
                        filters[key] ? 'bg-cyan-500/20 text-cyan-400' : 'bg-white/5 text-gray-400'
                      }`}
                    >
                      <div className={`w-2 h-2 rounded-sm ${filters[key] ? 'bg-cyan-400' : 'bg-gray-600'}`} />
                      <span className="capitalize">{key.replace('show', '')}</span>
                    </button>
                  ))}
                  <button
                    onClick={() => handleFilterToggle('showConnections')}
                    className={`flex items-center gap-2 w-full px-2 py-1 rounded-lg transition-colors text-xs ${
                      filters.showConnections ? 'bg-purple-500/20 text-purple-400' : 'bg-white/5 text-gray-400'
                    }`}
                  >
                    <div className={`w-2 h-2 rounded-sm ${filters.showConnections ? 'bg-purple-400' : 'bg-gray-600'}`} />
                    <span>Connections</span>
                  </button>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

// Memory detail panel (appears on click)
export function MemoryDetailPanel({ memory, onClose }: MemoryDetailProps) {
  if (!memory) return null

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.9, x: 20 }}
      animate={{ opacity: 1, scale: 1, x: 0 }}
      exit={{ opacity: 0, scale: 0.9, x: 20 }}
      className="absolute top-4 right-4 bg-black/90 backdrop-blur-xl rounded-2xl text-white border border-white/10 shadow-2xl w-72"
    >
      <div className="p-4">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-[10px] text-cyan-400 uppercase tracking-wider mb-1">Memory Details</div>
            <div className="font-semibold">{memory.label || 'Memory'}</div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-white/10 rounded-lg transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="space-y-3">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Importance</span>
            <div className="flex items-center gap-2">
              <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-cyan-400 rounded-full"
                  style={{ width: `${memory.importance * 10}%` }}
                />
              </div>
              <span className="text-cyan-400 font-mono">{memory.importance.toFixed(1)}</span>
            </div>
          </div>

          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-400">Status</span>
            <span className={memory.activated ? 'text-green-400' : 'text-gray-500'}>
              {memory.activated ? 'Active' : 'Dormant'}
            </span>
          </div>

          {memory.activationStrength > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-400">Activation</span>
              <span className="text-yellow-400">{(memory.activationStrength * 100).toFixed(0)}%</span>
            </div>
          )}

          <div className="pt-2 border-t border-white/10">
            <div className="text-gray-400 text-xs mb-1">Position</div>
            <div className="font-mono text-[10px] text-gray-500">
              x: {memory.position.x.toFixed(2)}, y: {memory.position.y.toFixed(2)}, z: {memory.position.z.toFixed(2)}
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Controls hint (top-right)
export function ControlsHint() {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ delay: 1 }}
      className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-xl px-4 py-2 text-white text-xs border border-white/10"
    >
      <div className="flex items-center gap-4 text-gray-400">
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
          Drag to rotate
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
          Scroll to zoom
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 bg-gray-400 rounded-full" />
          Click memory for details
        </span>
      </div>
    </motion.div>
  )
}

export default {
  AgentInfoOverlay,
  VisualizationLegend,
  MemoryDetailPanel,
  ControlsHint
}
