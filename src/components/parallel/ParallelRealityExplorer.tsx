'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  GitBranch,
  GitMerge,
  Sparkles,
  Play,
  RotateCcw,
  ChevronRight,
  TrendingUp,
  TrendingDown,
  Minus,
  Eye,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  Clock,
  type LucideIcon
} from 'lucide-react'
import {
  ParallelRealityExtended,
  WhatIfScenario,
  RealityComparisonMetrics,
  BranchTrigger
} from '@/lib/services/parallelRealityService'
import { EmotionType, EMOTION_COLORS } from '@/types/database'

interface ParallelRealityExplorerProps {
  reality: ParallelRealityExtended
  onExplore?: () => void
  onReset?: () => void
  className?: string
}

// Trigger type configuration
const TRIGGER_CONFIG: Record<BranchTrigger, { icon: LucideIcon; color: string; label: string }> = {
  decision_point: { icon: GitBranch, color: '#4FC3F7', label: 'Decision' },
  emotional_event: { icon: Sparkles, color: '#FF7043', label: 'Emotional' },
  relationship_change: { icon: GitMerge, color: '#FF4081', label: 'Relationship' },
  goal_outcome: { icon: TrendingUp, color: '#66BB6A', label: 'Goal' },
  external_event: { icon: AlertCircle, color: '#FFD54F', label: 'External' },
  what_if: { icon: Lightbulb, color: '#7C4DFF', label: 'What If' }
}

// Emotion comparison bar
function EmotionComparisonBar({
  emotion,
  original,
  alternate,
  color
}: {
  emotion: string
  original: number
  alternate: number
  color: string
}) {
  const diff = alternate - original
  const diffPercent = Math.abs(diff * 100).toFixed(0)

  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs text-gray-400">{emotion}</span>
      <div className="flex-1 relative h-4">
        {/* Center line */}
        <div className="absolute left-1/2 top-0 bottom-0 w-px bg-gray-600" />

        {/* Original value (left side) */}
        <div
          className="absolute right-1/2 h-full bg-gray-600 rounded-l"
          style={{ width: `${original * 50}%` }}
        />

        {/* Alternate value (right side) */}
        <motion.div
          className="absolute left-1/2 h-full rounded-r"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${alternate * 50}%` }}
          transition={{ duration: 0.5 }}
        />
      </div>
      <div className="w-16 text-right">
        {diff !== 0 && (
          <span className={`text-xs flex items-center justify-end gap-0.5 ${
            diff > 0 ? 'text-green-400' : 'text-red-400'
          }`}>
            {diff > 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
            {diffPercent}%
          </span>
        )}
      </div>
    </div>
  )
}

// Scenario card
function ScenarioCard({ scenario }: { scenario: WhatIfScenario }) {
  const config = TRIGGER_CONFIG[scenario.trigger]
  const Icon = config.icon

  return (
    <div className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50">
      <div className="flex items-start gap-3">
        <div
          className="p-2.5 rounded-lg"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-5 h-5" style={{ color: config.color }} />
        </div>
        <div className="flex-1">
          <h4 className="font-medium text-white">{scenario.title}</h4>
          <p className="text-sm text-gray-400 mt-1">{scenario.description}</p>

          {/* Variables */}
          <div className="mt-3 space-y-2">
            <div className="text-xs text-gray-500">Variables Changed:</div>
            {scenario.variables.map((v, i) => (
              <div key={i} className="flex items-center gap-2 text-xs">
                <span className="text-gray-400">{v.name}:</span>
                <span className="text-red-400 line-through">{v.originalValue}</span>
                <ChevronRight className="w-3 h-3 text-gray-600" />
                <span className="text-green-400">{v.alteredValue}</span>
              </div>
            ))}
          </div>

          {/* Hypothesis */}
          <div className="mt-3 p-2 bg-gray-900/50 rounded-lg">
            <div className="text-xs text-purple-400 mb-1">Hypothesis</div>
            <div className="text-xs text-gray-300">{scenario.hypothesis}</div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Outcome analysis panel
function OutcomeAnalysis({ analysis }: { analysis: RealityComparisonMetrics['outcomeAnalysis'] }) {
  return (
    <div className="space-y-4">
      {/* Positive outcomes */}
      {analysis.positiveOutcomes.length > 0 && (
        <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
          <div className="flex items-center gap-2 mb-2">
            <CheckCircle className="w-4 h-4 text-green-400" />
            <span className="text-sm font-medium text-green-400">Positive Outcomes</span>
          </div>
          <ul className="space-y-1">
            {analysis.positiveOutcomes.map((outcome, i) => (
              <li key={i} className="text-xs text-green-300 flex items-start gap-2">
                <span className="text-green-400">•</span>
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Negative outcomes */}
      {analysis.negativeOutcomes.length > 0 && (
        <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
          <div className="flex items-center gap-2 mb-2">
            <AlertCircle className="w-4 h-4 text-red-400" />
            <span className="text-sm font-medium text-red-400">Negative Outcomes</span>
          </div>
          <ul className="space-y-1">
            {analysis.negativeOutcomes.map((outcome, i) => (
              <li key={i} className="text-xs text-red-300 flex items-start gap-2">
                <span className="text-red-400">•</span>
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Neutral outcomes */}
      {analysis.neutralOutcomes.length > 0 && (
        <div className="bg-gray-500/10 rounded-xl p-4 border border-gray-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Minus className="w-4 h-4 text-gray-400" />
            <span className="text-sm font-medium text-gray-400">Neutral Outcomes</span>
          </div>
          <ul className="space-y-1">
            {analysis.neutralOutcomes.map((outcome, i) => (
              <li key={i} className="text-xs text-gray-300 flex items-start gap-2">
                <span className="text-gray-400">•</span>
                {outcome}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendation */}
      <div className="bg-purple-500/10 rounded-xl p-4 border border-purple-500/20">
        <div className="flex items-center gap-2 mb-2">
          <Lightbulb className="w-4 h-4 text-purple-400" />
          <span className="text-sm font-medium text-purple-400">Recommendation</span>
        </div>
        <p className="text-xs text-purple-200">{analysis.recommendation}</p>
      </div>
    </div>
  )
}

// Divergence meter
function DivergenceMeter({ score }: { score: number }) {
  const percentage = Math.round(score * 100)
  const color =
    percentage < 20 ? '#66BB6A' :
    percentage < 50 ? '#FFD54F' :
    percentage < 75 ? '#FF7043' : '#F44336'

  return (
    <div className="bg-gray-800/50 rounded-xl p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-400">Reality Divergence</span>
        <span className="text-lg font-bold" style={{ color }}>{percentage}%</span>
      </div>
      <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: color }}
          initial={{ width: 0 }}
          animate={{ width: `${percentage}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>Similar</span>
        <span>Radically Different</span>
      </div>
    </div>
  )
}

// Branch visualization
function BranchVisualization() {
  return (
    <div className="relative py-4">
      <svg className="w-full h-32" viewBox="0 0 400 100">
        {/* Main trunk */}
        <path
          d="M 50 50 L 150 50"
          stroke="#4FC3F7"
          strokeWidth="3"
          fill="none"
        />

        {/* Branch point */}
        <circle cx="150" cy="50" r="8" fill="#4FC3F7" />

        {/* Original path */}
        <path
          d="M 150 50 L 350 50"
          stroke="#4FC3F7"
          strokeWidth="2"
          fill="none"
          opacity="0.5"
        />

        {/* Divergent path */}
        <motion.path
          d="M 150 50 Q 200 20 250 25 T 350 30"
          stroke="#7C4DFF"
          strokeWidth="2"
          fill="none"
          initial={{ pathLength: 0 }}
          animate={{ pathLength: 1 }}
          transition={{ duration: 1, ease: 'easeInOut' }}
        />

        {/* End points */}
        <circle cx="350" cy="50" r="6" fill="#4FC3F7" opacity="0.5" />
        <motion.circle
          cx="350"
          cy="30"
          r="6"
          fill="#7C4DFF"
          initial={{ scale: 0 }}
          animate={{ scale: 1 }}
          transition={{ delay: 0.8 }}
        />

        {/* Labels */}
        <text x="350" y="65" fill="#9CA3AF" fontSize="10" textAnchor="middle">Original</text>
        <text x="350" y="20" fill="#7C4DFF" fontSize="10" textAnchor="middle">Alternate</text>
        <text x="150" y="75" fill="#4FC3F7" fontSize="10" textAnchor="middle">Branch Point</text>
      </svg>
    </div>
  )
}

// Main component
export function ParallelRealityExplorer({
  reality,
  onExplore,
  onReset,
  className = ''
}: ParallelRealityExplorerProps) {
  const [activeTab, setActiveTab] = useState<'scenario' | 'emotions' | 'outcomes' | 'insights'>('scenario')

  const emotionData = useMemo(() => {
    return Object.entries(reality.comparison.emotionalDivergence.byEmotion).map(([emotion, diff]) => ({
      emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      original: 0.5, // Would be from original state
      alternate: 0.5 + (Math.random() - 0.5) * diff * 2,
      color: EMOTION_COLORS[emotion as EmotionType]
    }))
  }, [reality])

  const statusColors = {
    pending: 'bg-gray-500/20 text-gray-400',
    in_progress: 'bg-cyan-500/20 text-cyan-400',
    complete: 'bg-green-500/20 text-green-400',
    abandoned: 'bg-red-500/20 text-red-400'
  }

  return (
    <div className={`bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-gray-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl">
              <GitBranch className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-lg">Parallel Reality Explorer</h2>
              <p className="text-xs text-gray-400">
                What-if scenario analysis
              </p>
            </div>
          </div>

          {/* Status & Actions */}
          <div className="flex items-center gap-3">
            <span className={`px-3 py-1 rounded-full text-xs font-medium ${statusColors[reality.explorationStatus]}`}>
              {reality.explorationStatus.replace('_', ' ')}
            </span>
            <div className="flex gap-1">
              {onExplore && reality.explorationStatus === 'pending' && (
                <button
                  onClick={onExplore}
                  className="p-2 bg-purple-500/20 hover:bg-purple-500/30 rounded-lg transition-colors"
                >
                  <Play className="w-4 h-4 text-purple-400" />
                </button>
              )}
              {onReset && (
                <button
                  onClick={onReset}
                  className="p-2 bg-gray-700/50 hover:bg-gray-700 rounded-lg transition-colors"
                >
                  <RotateCcw className="w-4 h-4 text-gray-400" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Branch visualization */}
        <BranchVisualization />

        {/* Tab navigation */}
        <div className="flex gap-1 mt-2 bg-gray-800/50 rounded-lg p-1">
          {(['scenario', 'emotions', 'outcomes', 'insights'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-gray-700 text-white'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'scenario' && (
            <motion.div
              key="scenario"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <ScenarioCard scenario={reality.scenario} />
              <DivergenceMeter score={reality.comparison.emotionalDivergence.overall} />
            </motion.div>
          )}

          {activeTab === 'emotions' && (
            <motion.div
              key="emotions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="flex items-center justify-between mb-4">
                  <span className="text-sm font-medium text-white">Emotional State Comparison</span>
                  <div className="flex items-center gap-4 text-xs">
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-gray-600 rounded" />
                      <span className="text-gray-400">Original</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <div className="w-3 h-3 bg-purple-500 rounded" />
                      <span className="text-gray-400">Alternate</span>
                    </div>
                  </div>
                </div>

                <div className="space-y-3">
                  {emotionData.map((data, i) => (
                    <EmotionComparisonBar
                      key={i}
                      emotion={data.emotion}
                      original={data.original}
                      alternate={data.alternate}
                      color={data.color}
                    />
                  ))}
                </div>
              </div>

              {/* Dominant emotion shift */}
              <div className="bg-gray-800/50 rounded-xl p-4">
                <div className="text-sm font-medium text-white mb-3">Dominant Emotion Shift</div>
                <div className="flex items-center justify-center gap-4">
                  <div className="text-center">
                    <div
                      className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center"
                      style={{ backgroundColor: EMOTION_COLORS[reality.comparison.emotionalDivergence.dominantShift.original] + '40' }}
                    >
                      <span className="text-2xl">
                        {reality.comparison.emotionalDivergence.dominantShift.original === 'joy' ? '😊' :
                         reality.comparison.emotionalDivergence.dominantShift.original === 'trust' ? '🤝' :
                         reality.comparison.emotionalDivergence.dominantShift.original === 'fear' ? '😰' :
                         reality.comparison.emotionalDivergence.dominantShift.original === 'anger' ? '😠' : '😐'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">Original</div>
                    <div className="text-sm text-white capitalize">
                      {reality.comparison.emotionalDivergence.dominantShift.original}
                    </div>
                  </div>
                  <ChevronRight className="w-6 h-6 text-purple-400" />
                  <div className="text-center">
                    <div
                      className="w-12 h-12 rounded-full mx-auto mb-2 flex items-center justify-center"
                      style={{ backgroundColor: EMOTION_COLORS[reality.comparison.emotionalDivergence.dominantShift.alternate] + '40' }}
                    >
                      <span className="text-2xl">
                        {reality.comparison.emotionalDivergence.dominantShift.alternate === 'joy' ? '😊' :
                         reality.comparison.emotionalDivergence.dominantShift.alternate === 'trust' ? '🤝' :
                         reality.comparison.emotionalDivergence.dominantShift.alternate === 'fear' ? '😰' :
                         reality.comparison.emotionalDivergence.dominantShift.alternate === 'anger' ? '😠' : '😐'}
                      </span>
                    </div>
                    <div className="text-xs text-gray-400">Alternate</div>
                    <div className="text-sm text-white capitalize">
                      {reality.comparison.emotionalDivergence.dominantShift.alternate}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'outcomes' && (
            <motion.div
              key="outcomes"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
            >
              <OutcomeAnalysis analysis={reality.comparison.outcomeAnalysis} />
            </motion.div>
          )}

          {activeTab === 'insights' && (
            <motion.div
              key="insights"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-xl p-4 border border-purple-500/20">
                <div className="flex items-center gap-2 mb-3">
                  <Lightbulb className="w-5 h-5 text-amber-400" />
                  <span className="font-medium text-white">Key Insights</span>
                </div>
                <ul className="space-y-2">
                  {reality.insights.map((insight, i) => (
                    <li key={i} className="flex items-start gap-2 text-sm text-gray-300">
                      <span className="text-purple-400 mt-1">•</span>
                      {insight}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Personality shifts */}
              {reality.comparison.personalityShifts.length > 0 && (
                <div className="bg-gray-800/50 rounded-xl p-4">
                  <div className="text-sm font-medium text-white mb-3">Personality Shifts</div>
                  <div className="space-y-2">
                    {reality.comparison.personalityShifts.map((shift, i) => (
                      <div
                        key={i}
                        className={`flex items-center justify-between p-2 rounded-lg ${
                          shift.significance === 'major' ? 'bg-red-500/10 border border-red-500/20' :
                          shift.significance === 'moderate' ? 'bg-amber-500/10 border border-amber-500/20' :
                          'bg-gray-700/50 border border-gray-600/50'
                        }`}
                      >
                        <span className="text-sm text-gray-300 capitalize">{shift.trait}</span>
                        <div className="flex items-center gap-2 text-xs">
                          <span className="text-gray-500">{shift.originalValue.toFixed(2)}</span>
                          <ChevronRight className="w-3 h-3 text-gray-600" />
                          <span className={
                            shift.alternateValue > shift.originalValue ? 'text-green-400' : 'text-red-400'
                          }>
                            {shift.alternateValue.toFixed(2)}
                          </span>
                          <span className={`px-1.5 py-0.5 rounded text-xs ${
                            shift.significance === 'major' ? 'bg-red-500/20 text-red-400' :
                            shift.significance === 'moderate' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-gray-500/20 text-gray-400'
                          }`}>
                            {shift.significance}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Final recommendation */}
              <div className="bg-cyan-500/10 rounded-xl p-4 border border-cyan-500/20">
                <div className="flex items-center gap-2 mb-2">
                  <Eye className="w-5 h-5 text-cyan-400" />
                  <span className="font-medium text-cyan-400">Final Recommendation</span>
                </div>
                <p className="text-sm text-cyan-200">{reality.recommendation}</p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-800/30 border-t border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Created {new Date(reality.createdAt).toLocaleString()}
          </div>
          <div>
            Expires {new Date(reality.expiresAt).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default ParallelRealityExplorer
