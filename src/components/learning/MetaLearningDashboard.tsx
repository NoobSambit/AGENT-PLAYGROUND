'use client'

import React, { useState, useMemo } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Target,
  TrendingUp,
  TrendingDown,
  Lightbulb,
  Award,
  Activity,
  BookOpen,
  Sparkles,
  ChevronRight,
  CheckCircle,
  AlertCircle,
  Clock,
  Zap
} from 'lucide-react'
import {
  MetaLearningState,
  LearningPattern,
  LearningGoal,
  LearningProfile,
  LearningPatternType,
  SkillProgression
} from '@/types/metaLearning'

interface MetaLearningDashboardProps {
  state: MetaLearningState
  skills?: SkillProgression[]
  className?: string
}

// Pattern type icons and colors
const PATTERN_CONFIG: Record<LearningPatternType, { icon: React.ElementType; color: string; label: string }> = {
  topic_interest: { icon: BookOpen, color: '#4FC3F7', label: 'Topic Interest' },
  communication_style: { icon: Activity, color: '#7C4DFF', label: 'Communication' },
  emotional_response: { icon: Sparkles, color: '#FF7043', label: 'Emotional Response' },
  problem_solving: { icon: Lightbulb, color: '#66BB6A', label: 'Problem Solving' },
  memory_retention: { icon: Brain, color: '#FFD54F', label: 'Memory Retention' },
  relationship_building: { icon: Target, color: '#FF4081', label: 'Relationships' }
}

// Capability gauge component
function CapabilityGauge({
  label,
  value,
  color
}: {
  label: string
  value: number
  color: string
}) {
  const percentage = Math.round(value * 100)

  return (
    <div className="text-center">
      <div className="relative w-16 h-16 mx-auto mb-2">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 36 36">
          {/* Background circle */}
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            className="text-gray-700"
          />
          {/* Progress arc */}
          <motion.circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            stroke={color}
            strokeWidth="2.5"
            strokeLinecap="round"
            strokeDasharray={`${percentage} 100`}
            initial={{ strokeDasharray: '0 100' }}
            animate={{ strokeDasharray: `${percentage} 100` }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="text-sm font-semibold text-white">{percentage}%</span>
        </div>
      </div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  )
}

// Learning goal card
function GoalCard({ goal }: { goal: LearningGoal }) {
  const config = PATTERN_CONFIG[goal.category]
  const Icon = config.icon

  return (
    <motion.div
      className="bg-gray-800/50 rounded-xl p-4 border border-gray-700/50"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-lg"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="font-medium text-white text-sm truncate">{goal.title}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              goal.priority === 'high' ? 'bg-red-500/20 text-red-400' :
              goal.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              {goal.priority}
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1 line-clamp-2">{goal.description}</p>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-gray-500">Progress</span>
              <span className="text-gray-400">{Math.round(goal.progressPercentage)}%</span>
            </div>
            <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: config.color }}
                initial={{ width: 0 }}
                animate={{ width: `${goal.progressPercentage}%` }}
                transition={{ duration: 0.5 }}
              />
            </div>
          </div>

          {/* Milestones */}
          <div className="flex gap-1 mt-2">
            {goal.milestones.map((milestone, i) => (
              <div
                key={i}
                className={`w-2 h-2 rounded-full ${
                  milestone.achieved ? 'bg-green-500' : 'bg-gray-600'
                }`}
                title={milestone.description}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  )
}

// Pattern activity indicator
function PatternActivity({ patterns }: { patterns: LearningPattern[] }) {
  // Group by type
  const byType = useMemo(() => {
    const groups: Record<LearningPatternType, LearningPattern[]> = {
      topic_interest: [],
      communication_style: [],
      emotional_response: [],
      problem_solving: [],
      memory_retention: [],
      relationship_building: []
    }

    for (const pattern of patterns) {
      groups[pattern.type].push(pattern)
    }

    return Object.entries(groups)
      .filter(([, patterns]) => patterns.length > 0)
      .map(([type, patterns]) => ({
        type: type as LearningPatternType,
        patterns,
        avgEffectiveness: patterns.reduce((sum, p) => sum + p.effectiveness, 0) / patterns.length
      }))
      .sort((a, b) => b.patterns.length - a.patterns.length)
  }, [patterns])

  return (
    <div className="space-y-2">
      {byType.map(({ type, patterns, avgEffectiveness }) => {
        const config = PATTERN_CONFIG[type]
        const Icon = config.icon

        return (
          <div key={type} className="flex items-center gap-3">
            <div
              className="p-1.5 rounded-lg"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-gray-400">{config.label}</span>
                <span className="text-xs text-gray-500">{patterns.length} patterns</span>
              </div>
              <div className="h-1 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{
                    width: `${avgEffectiveness * 100}%`,
                    backgroundColor: config.color
                  }}
                />
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// Skill progression display
function SkillProgressionCard({ skill }: { skill: SkillProgression }) {
  const config = PATTERN_CONFIG[skill.category]
  const Icon = config.icon
  const levelProgress = (skill.experiencePoints / skill.pointsToNextLevel) * 100

  return (
    <div className="bg-gray-800/30 rounded-lg p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: config.color }} />
        <span className="text-sm font-medium text-white">{skill.skillName}</span>
        <span className="ml-auto text-xs font-bold" style={{ color: config.color }}>
          Lv.{skill.currentLevel}
        </span>
      </div>
      <div className="h-1.5 bg-gray-700 rounded-full overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: config.color }}
          initial={{ width: 0 }}
          animate={{ width: `${levelProgress}%` }}
        />
      </div>
      <div className="flex justify-between mt-1 text-xs text-gray-500">
        <span>{skill.experiencePoints} XP</span>
        <span>{skill.pointsToNextLevel} to next</span>
      </div>
    </div>
  )
}

// Recommendation card
function RecommendationCard({
  recommendation
}: {
  recommendation: MetaLearningState['recommendations'][0]
}) {
  const iconMap: Record<string, React.ElementType> = {
    focus_area: Target,
    goal: Award,
    strategy: Lightbulb,
    adaptation: Zap
  }

  const Icon = iconMap[recommendation.type] || Lightbulb

  return (
    <motion.div
      className="bg-gradient-to-r from-gray-800/50 to-gray-800/30 rounded-lg p-3 border border-gray-700/50"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-lg ${
          recommendation.priority === 'high' ? 'bg-red-500/20' :
          recommendation.priority === 'medium' ? 'bg-amber-500/20' :
          'bg-cyan-500/20'
        }`}>
          <Icon className={`w-4 h-4 ${
            recommendation.priority === 'high' ? 'text-red-400' :
            recommendation.priority === 'medium' ? 'text-amber-400' :
            'text-cyan-400'
          }`} />
        </div>
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-medium text-white">{recommendation.title}</h4>
          <p className="text-xs text-gray-500 mt-0.5">{recommendation.description}</p>
        </div>
        <ChevronRight className="w-4 h-4 text-gray-600 flex-shrink-0" />
      </div>
    </motion.div>
  )
}

// Main dashboard component
export function MetaLearningDashboard({
  state,
  skills = [],
  className = ''
}: MetaLearningDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'goals' | 'skills'>('overview')

  const { profile, stats, recommendations, activePatterns, activeGoals } = state

  return (
    <div className={`bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-gray-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl">
              <Brain className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-lg">Meta-Learning</h2>
              <p className="text-xs text-gray-400">Learning how to learn better</p>
            </div>
          </div>

          {/* Learning streak */}
          <div className="flex items-center gap-2 px-3 py-1.5 bg-amber-500/10 rounded-full">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">{stats.learningStreak} day streak</span>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mt-4 bg-gray-800/50 rounded-lg p-1">
          {(['overview', 'patterns', 'goals', 'skills'] as const).map((tab) => (
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
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              {/* Stats grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{stats.totalPatterns}</div>
                  <div className="text-xs text-gray-500">Patterns Found</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="text-2xl font-bold text-green-400">{stats.positivePatterns}</span>
                  </div>
                  <div className="text-xs text-gray-500">Positive</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                    <span className="text-2xl font-bold text-red-400">{stats.negativePatterns}</span>
                  </div>
                  <div className="text-xs text-gray-500">Needs Work</div>
                </div>
                <div className="bg-gray-800/50 rounded-xl p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{stats.adaptationsThisWeek}</div>
                  <div className="text-xs text-gray-500">This Week</div>
                </div>
              </div>

              {/* Capabilities */}
              <div className="bg-gray-800/30 rounded-xl p-4">
                <h3 className="text-sm font-medium text-white mb-4">Learning Capabilities</h3>
                <div className="grid grid-cols-5 gap-2">
                  <CapabilityGauge label="Speed" value={profile.capabilities.speedOfLearning} color="#4FC3F7" />
                  <CapabilityGauge label="Retention" value={profile.capabilities.retentionRate} color="#7C4DFF" />
                  <CapabilityGauge label="Transfer" value={profile.capabilities.transferability} color="#66BB6A" />
                  <CapabilityGauge label="Adapt" value={profile.capabilities.adaptability} color="#FF7043" />
                  <CapabilityGauge label="Creative" value={profile.capabilities.creativity} color="#FF4081" />
                </div>
              </div>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-amber-400" />
                    Recommendations
                  </h3>
                  <div className="space-y-2">
                    {recommendations.slice(0, 3).map((rec, i) => (
                      <RecommendationCard key={i} recommendation={rec} />
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                  <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Strengths
                  </h4>
                  <div className="space-y-1">
                    {profile.strengths.length > 0 ? (
                      profile.strengths.map((s, i) => (
                        <div key={i} className="text-xs text-gray-300">
                          • {s.replace('_', ' ')}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">Still discovering...</div>
                    )}
                  </div>
                </div>
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                  <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Growth Areas
                  </h4>
                  <div className="space-y-1">
                    {profile.weaknesses.length > 0 ? (
                      profile.weaknesses.map((w, i) => (
                        <div key={i} className="text-xs text-gray-300">
                          • {w.replace('_', ' ')}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-gray-500">None identified yet</div>
                    )}
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'patterns' && (
            <motion.div
              key="patterns"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Active Patterns</h3>
                <span className="text-xs text-gray-500">{activePatterns.length} patterns today</span>
              </div>
              <PatternActivity patterns={activePatterns} />

              {/* Recent pattern details */}
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-medium text-gray-400">Recent Observations</h4>
                {activePatterns.slice(0, 5).map((pattern, i) => {
                  const config = PATTERN_CONFIG[pattern.type]
                  const Icon = config.icon

                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-lg border ${
                        pattern.outcome === 'positive' ? 'bg-green-500/5 border-green-500/20' :
                        pattern.outcome === 'negative' ? 'bg-red-500/5 border-red-500/20' :
                        'bg-gray-800/30 border-gray-700/50'
                      }`}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-white truncate">{pattern.pattern}</div>
                        <div className="text-xs text-gray-500">
                          Effectiveness: {Math.round(pattern.effectiveness * 100)}%
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        pattern.outcome === 'positive' ? 'bg-green-500/20 text-green-400' :
                        pattern.outcome === 'negative' ? 'bg-red-500/20 text-red-400' :
                        'bg-gray-500/20 text-gray-400'
                      }`}>
                        {pattern.outcome}
                      </span>
                    </div>
                  )
                })}
              </div>
            </motion.div>
          )}

          {activeTab === 'goals' && (
            <motion.div
              key="goals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Learning Goals</h3>
                <span className="text-xs text-gray-500">{activeGoals.length} active</span>
              </div>

              {activeGoals.length > 0 ? (
                <div className="space-y-3">
                  {activeGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No active learning goals</p>
                  <p className="text-gray-500 text-xs mt-1">Goals will be generated based on patterns</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'skills' && (
            <motion.div
              key="skills"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-4"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-medium text-white">Skill Progression</h3>
                <span className="text-xs text-gray-500">{skills.length} skills tracked</span>
              </div>

              {skills.length > 0 ? (
                <div className="grid gap-3">
                  {skills.map((skill, i) => (
                    <SkillProgressionCard key={i} skill={skill} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">Skills unlock through learning</p>
                  <p className="text-gray-500 text-xs mt-1">Keep practicing to level up</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-800/30 border-t border-gray-800">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-gray-500">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated {new Date(state.lastUpdated).toLocaleTimeString()}</span>
          </div>
          <div className="text-gray-500">
            Strategy: <span className="text-cyan-400">{profile.preferences.preferredStrategy}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MetaLearningDashboard
