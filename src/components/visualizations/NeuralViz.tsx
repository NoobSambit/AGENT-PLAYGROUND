'use client'

/**
 * Neural Visualization Component
 *
 * Enhanced 3D visualization of an agent's neural network with:
 * - Real memory data (positions based on type, importance, timestamp)
 * - Multiple particle systems (2000+ GPU-accelerated particles)
 * - Memory type differentiation (different shapes per type)
 * - Multi-particle connection flows with glowing trails
 * - Mandala-style core with energy waves
 * - Advanced post-processing (DOF, bloom, chromatic aberration)
 * - Interactive UI overlays with filters
 * - Click-to-expand memory details
 */

// Re-export the enhanced version as default
export { NeuralVizEnhanced as NeuralViz, NeuralVizEnhanced as default } from './neural'

// Export all sub-components for advanced usage
export {
  MemoryNode,
  NeuralConnections,
  NeuralCore,
  EmotionalAura,
  ThoughtFlowVisualization,
  BoundaryShell,
  StarField,
  Lighting,
  PostProcessing,
  AgentInfoOverlay,
  VisualizationLegend,
  MemoryDetailPanel,
  ControlsHint
} from './neural'

// ============================================
// SIMPLIFIED 2D VERSION (for mobile/low-perf)
// ============================================

import { AgentRecord, EmotionType, EMOTION_COLORS } from '@/types/database'

export function NeuralViz2D({ agent, className = '' }: { agent: AgentRecord; className?: string }) {
  const memories = agent.memoryCount || 0
  const dominantEmotion = agent.emotionalState?.dominantEmotion || 'trust'
  const emotionColor = EMOTION_COLORS[dominantEmotion]
  const secondaryEmotion = Object.entries(agent.emotionalState?.currentMood || {})
    .filter(([key]) => key !== dominantEmotion)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] as EmotionType | undefined

  return (
    <div
      className={`relative rounded-xl overflow-hidden ${className}`}
      style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0f0f20 100%)' }}
    >
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Definitions */}
        <defs>
          <radialGradient id="coreGlow2d" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={emotionColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={emotionColor} stopOpacity="0" />
          </radialGradient>
          <filter id="glow2d">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background rings */}
        {[85, 65, 45, 30].map((r, i) => (
          <circle
            key={i}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="#4FC3F7"
            strokeOpacity={0.1 - i * 0.02}
            strokeWidth="0.5"
          />
        ))}

        {/* Animated orbital ring */}
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke={emotionColor}
          strokeOpacity="0.3"
          strokeWidth="1"
          strokeDasharray="10 5"
          className="animate-[spin_20s_linear_infinite]"
        />

        {/* Memory nodes in different shapes based on type */}
        {Array.from({ length: Math.min(memories, 24) }).map((_, i) => {
          const angle = (i / Math.min(memories, 24)) * Math.PI * 2
          const radius = 50 + Math.sin(i * 0.5) * 15
          const x = 100 + Math.cos(angle) * radius
          const y = 100 + Math.sin(angle) * radius
          const isActive = i % 3 === 0
          const nodeType = i % 4 // 0=convo, 1=fact, 2=interaction, 3=personality

          return (
            <g key={i}>
              {isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill={emotionColor}
                  opacity="0.2"
                  filter="url(#glow2d)"
                />
              )}
              {nodeType === 0 && (
                <polygon
                  points={`${x},${y-4} ${x+3.5},${y+2} ${x-3.5},${y+2}`}
                  fill={isActive ? '#4FC3F7' : '#546E7A'}
                  opacity={isActive ? 1 : 0.5}
                  filter={isActive ? 'url(#glow2d)' : undefined}
                />
              )}
              {nodeType === 1 && (
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 4 : 2.5}
                  fill={isActive ? '#4FC3F7' : '#546E7A'}
                  opacity={isActive ? 1 : 0.5}
                  filter={isActive ? 'url(#glow2d)' : undefined}
                />
              )}
              {nodeType === 2 && (
                <rect
                  x={x - (isActive ? 3 : 2)}
                  y={y - (isActive ? 3 : 2)}
                  width={isActive ? 6 : 4}
                  height={isActive ? 6 : 4}
                  fill={isActive ? '#4FC3F7' : '#546E7A'}
                  opacity={isActive ? 1 : 0.5}
                  transform={`rotate(45 ${x} ${y})`}
                  filter={isActive ? 'url(#glow2d)' : undefined}
                />
              )}
              {nodeType === 3 && (
                <circle
                  cx={x}
                  cy={y}
                  r={isActive ? 4 : 2.5}
                  fill="none"
                  stroke={isActive ? '#4FC3F7' : '#546E7A'}
                  strokeWidth="1.5"
                  opacity={isActive ? 1 : 0.5}
                  filter={isActive ? 'url(#glow2d)' : undefined}
                />
              )}
            </g>
          )
        })}

        {/* Core glow */}
        <circle cx="100" cy="100" r="35" fill="url(#coreGlow2d)" />

        {/* Core layers */}
        <circle
          cx="100"
          cy="100"
          r="20"
          fill={emotionColor}
          opacity="0.4"
          filter="url(#glow2d)"
        />
        <circle
          cx="100"
          cy="100"
          r="12"
          fill={secondaryEmotion ? EMOTION_COLORS[secondaryEmotion] : emotionColor}
          opacity="0.6"
        />
        <circle
          cx="100"
          cy="100"
          r="6"
          fill="#ffffff"
          opacity="0.8"
        />
      </svg>

      {/* Info overlay */}
      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
        <div className="text-white">
          <div className="font-semibold text-sm">{agent.name}</div>
          <div className="text-gray-400 text-xs">{memories} memories</div>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: emotionColor, boxShadow: `0 0 6px ${emotionColor}` }}
          />
          <span className="text-xs text-gray-300 capitalize">{dominantEmotion}</span>
        </div>
      </div>
    </div>
  )
}
