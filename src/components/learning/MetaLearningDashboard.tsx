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
  MessageSquare,
  Clock,
  Zap,
  type LucideIcon
} from 'lucide-react'
import {
  MetaLearningState,
  LearningPattern,
  LearningGoal,
  LearningPatternType,
  SkillProgression
} from '@/types/metaLearning'

interface MetaLearningDashboardProps {
  state: MetaLearningState
  skills?: SkillProgression[]
  className?: string
}

// Pattern type icons and colors
const PATTERN_CONFIG: Record<LearningPatternType, { icon: LucideIcon; color: string; label: string }> = {
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
            className="text-border"
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
          <span className="text-sm font-semibold text-foreground">{percentage}%</span>
        </div>
      </div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  )
}

// Learning goal card
function GoalCard({ goal }: { goal: LearningGoal }) {
  const config = PATTERN_CONFIG[goal.category]
  const Icon = config.icon

  return (
    <motion.div
      className="rounded-sm border border-border/60 bg-background/45 p-4"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div className="flex items-start gap-3">
        <div
          className="p-2 rounded-sm"
          style={{ backgroundColor: `${config.color}20` }}
        >
          <Icon className="w-4 h-4" style={{ color: config.color }} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <h4 className="text-sm font-medium text-foreground truncate">{goal.title}</h4>
            <span className={`text-xs px-2 py-0.5 rounded-full ${
              goal.priority === 'high' ? 'bg-red-500/20 text-red-400' :
              goal.priority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
              'bg-green-500/20 text-green-400'
            }`}>
              {goal.priority}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs text-muted-foreground">{goal.description}</p>

          {/* Progress bar */}
          <div className="mt-3">
            <div className="flex justify-between text-xs mb-1">
              <span className="text-muted-foreground">Progress</span>
              <span className="text-foreground/80">{Math.round(goal.progressPercentage)}%</span>
            </div>
            <div className="h-1.5 rounded-full bg-border/70 overflow-hidden">
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
                  milestone.achieved ? 'bg-green-500' : 'bg-border'
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
              className="p-1.5 rounded-sm"
              style={{ backgroundColor: `${config.color}20` }}
            >
              <Icon className="w-3.5 h-3.5" style={{ color: config.color }} />
            </div>
            <div className="flex-1">
              <div className="flex justify-between items-center mb-1">
                <span className="text-xs text-muted-foreground">{config.label}</span>
                <span className="text-xs text-muted-foreground">{patterns.length} patterns</span>
              </div>
              <div className="h-1 rounded-full bg-border/70 overflow-hidden">
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
    <div className="rounded-sm border border-border/60 bg-background/40 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Icon className="w-4 h-4" style={{ color: config.color }} />
        <span className="text-sm font-medium text-foreground">{skill.skillName}</span>
        <span className="ml-auto text-xs font-bold" style={{ color: config.color }}>
          Lv.{skill.currentLevel}
        </span>
      </div>
      <div className="h-1.5 rounded-full bg-border/70 overflow-hidden">
        <motion.div
          className="h-full rounded-full"
          style={{ backgroundColor: config.color }}
          initial={{ width: 0 }}
          animate={{ width: `${levelProgress}%` }}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
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
  const iconMap: Record<MetaLearningState['recommendations'][0]['type'], LucideIcon> = {
    focus_area: Target,
    goal: Award,
    strategy: Lightbulb,
    adaptation: Zap
  }

  const Icon = iconMap[recommendation.type] || Lightbulb

  return (
    <motion.div
      className="rounded-sm border border-border/60 bg-background/45 p-3"
      initial={{ opacity: 0, x: -10 }}
      animate={{ opacity: 1, x: 0 }}
    >
      <div className="flex items-start gap-3">
        <div className={`p-2 rounded-sm ${
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
          <h4 className="text-sm font-medium text-foreground">{recommendation.title}</h4>
          <p className="mt-0.5 text-xs text-muted-foreground">{recommendation.description}</p>
        </div>
        <ChevronRight className="w-4 h-4 flex-shrink-0 text-muted-foreground" />
      </div>
    </motion.div>
  )
}

function AdaptationCard({ adaptation }: { adaptation: MetaLearningState['recentAdaptations'][0] }) {
  return (
    <div className="rounded-sm border border-border/60 bg-background/45 p-3">
      <div className="flex items-start gap-3">
        <div className="p-2 rounded-sm bg-cyan-500/10">
          <Zap className="w-4 h-4 text-cyan-400" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2">
            <h4 className="text-sm font-medium text-foreground">{adaptation.description}</h4>
            <span className="text-xs text-cyan-400">{Math.round((adaptation.confidence || 0) * 100)}%</span>
          </div>
          <p className="mt-1 text-xs text-muted-foreground">{adaptation.instruction || adaptation.currentState}</p>
          <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
            <span>{adaptation.evidenceCount || 0} evidence points</span>
            <span>{Math.round(adaptation.impactScore * 100)} impact</span>
          </div>
        </div>
      </div>
    </div>
  )
}

function ObservationCard({ observation }: { observation: MetaLearningState['recentObservations'][0] }) {
  return (
    <div className="rounded-sm border border-border/60 bg-background/45 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-sm text-foreground">
            {observation.taskType.replace(/_/g, ' ')}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">{observation.summary}</div>
        </div>
        <span className={`text-xs px-2 py-0.5 rounded-full ${
          observation.outcome === 'positive' ? 'bg-green-500/20 text-green-400' :
          observation.outcome === 'negative' ? 'bg-red-500/20 text-red-400' :
          'bg-muted text-muted-foreground'
        }`}>
          {observation.outcome}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-3 text-[11px] text-muted-foreground">
        <span>{Math.round(observation.finalScore * 100)} score</span>
        <span>{observation.followUpStatus}</span>
        <span>{observation.feedbackSignal}</span>
      </div>
    </div>
  )
}

function EmptyLearningState() {
  return (
    <div className="rounded-sm border border-dashed border-border/70 bg-background/35 p-6">
      <div className="flex items-start gap-4">
        <div className="rounded-sm bg-cyan-500/10 p-3">
          <MessageSquare className="h-5 w-5 text-cyan-400" />
        </div>
        <div className="space-y-3">
          <div>
            <h3 className="text-sm font-medium text-foreground">No learning evidence yet</h3>
            <p className="mt-1 text-sm text-muted-foreground">
              This section should stay quiet until the agent has real conversations to learn from.
            </p>
          </div>
          <div className="grid gap-2 text-xs text-muted-foreground sm:grid-cols-3">
            <div className="rounded-sm border border-border/60 bg-card/[0.62] p-3">
              1. Chat with the agent for a few turns.
            </div>
            <div className="rounded-sm border border-border/60 bg-card/[0.62] p-3">
              2. Give clear feedback like “too vague” or “that helps”.
            </div>
            <div className="rounded-sm border border-border/60 bg-card/[0.62] p-3">
              3. Come back here once patterns and adaptations appear.
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// Main dashboard component
export function MetaLearningDashboard({
  state,
  skills = [],
  className = ''
}: MetaLearningDashboardProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'patterns' | 'goals' | 'skills'>('overview')

  const {
    profile,
    stats,
    recommendations,
    activePatterns,
    activeGoals,
    recentAdaptations,
    recentObservations,
    currentSession
  } = state
  const hasLearningEvidence = (
    stats.totalPatterns > 0
    || stats.resolvedObservations > 0
    || stats.pendingObservations > 0
    || recentAdaptations.length > 0
    || activeGoals.length > 0
    || skills.length > 0
  )

  return (
    <div className={`overflow-hidden rounded-sm border border-border/70 bg-card/[0.68] backdrop-blur-xl shadow-[0_24px_60px_-36px_rgba(109,77,158,0.28)] ${className}`}>
      {/* Header */}
      <div className="border-b border-border/70 bg-background/45 p-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-sm bg-cyan-500/10 p-2.5">
              <Brain className="w-6 h-6 text-cyan-300" />
          </div>
          <div>
              <h2 className="text-lg font-semibold text-foreground">Meta-Learning</h2>
              <p className="text-xs text-muted-foreground">Learning how to learn better</p>
            </div>
          </div>

          {/* Learning streak */}
          <div className="flex items-center gap-2 rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1.5">
            <Zap className="w-4 h-4 text-amber-400" />
            <span className="text-sm font-medium text-amber-400">{stats.learningStreak} day streak</span>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="mt-4 flex gap-1 rounded-sm border border-border/60 bg-background/45 p-1">
          {(['overview', 'patterns', 'goals', 'skills'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                activeTab === tab
                  ? 'bg-card/[0.92] text-foreground'
                  : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>
      </div>

      {/* Content */}
      <div className="bg-transparent p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-5"
            >
              {!hasLearningEvidence && <EmptyLearningState />}

              {/* Stats grid */}
              <div className={`grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6 ${!hasLearningEvidence ? 'opacity-60' : ''}`}>
                <div className="rounded-sm border border-border/60 bg-background/40 p-3 text-center">
                  <div className="text-2xl font-bold text-cyan-400">{stats.totalPatterns}</div>
                  <div className="text-xs text-muted-foreground">Patterns Found</div>
                </div>
                <div className="rounded-sm border border-border/60 bg-background/40 p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingUp className="w-5 h-5 text-green-400" />
                    <span className="text-2xl font-bold text-green-400">{stats.positivePatterns}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Positive</div>
                </div>
                <div className="rounded-sm border border-border/60 bg-background/40 p-3 text-center">
                  <div className="flex items-center justify-center gap-1">
                    <TrendingDown className="w-5 h-5 text-red-400" />
                    <span className="text-2xl font-bold text-red-400">{stats.negativePatterns}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">Needs Work</div>
                </div>
                <div className="rounded-sm border border-border/60 bg-background/40 p-3 text-center">
                  <div className="text-2xl font-bold text-purple-400">{stats.adaptationsThisWeek}</div>
                  <div className="text-xs text-muted-foreground">This Week</div>
                </div>
                <div className="rounded-sm border border-border/60 bg-background/40 p-3 text-center">
                  <div className="text-2xl font-bold text-foreground">{stats.resolvedObservations}</div>
                  <div className="text-xs text-muted-foreground">Resolved Turns</div>
                </div>
                <div className="rounded-sm border border-border/60 bg-background/40 p-3 text-center">
                  <div className="text-2xl font-bold text-amber-400">{stats.pendingObservations}</div>
                  <div className="text-xs text-muted-foreground">Pending Follow-up</div>
                </div>
              </div>

              {/* Capabilities */}
              <div className="rounded-sm border border-border/60 bg-background/40 p-4">
                <h3 className="mb-4 text-sm font-medium text-foreground">Learning Capabilities</h3>
                {hasLearningEvidence ? (
                  <div className="grid grid-cols-5 gap-2">
                    <CapabilityGauge label="Speed" value={profile.capabilities.speedOfLearning} color="#4FC3F7" />
                    <CapabilityGauge label="Retention" value={profile.capabilities.retentionRate} color="#7C4DFF" />
                    <CapabilityGauge label="Transfer" value={profile.capabilities.transferability} color="#66BB6A" />
                    <CapabilityGauge label="Adapt" value={profile.capabilities.adaptability} color="#FF7043" />
                    <CapabilityGauge label="Creative" value={profile.capabilities.creativity} color="#FF4081" />
                  </div>
                ) : (
                  <div className="rounded-sm border border-border/60 bg-card/[0.62] px-4 py-6 text-sm text-muted-foreground">
                    Capability scores will appear after the system has enough real turn evidence to evaluate.
                  </div>
                )}
              </div>

              {/* Recommendations */}
              {recommendations.length > 0 && (
                <div>
                  <h3 className="mb-3 flex items-center gap-2 text-sm font-medium text-foreground">
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

              {recentAdaptations.length > 0 && (
                <div>
                  <h3 className="mb-3 text-sm font-medium text-foreground">Active Behavior Changes</h3>
                  <div className="space-y-2">
                    {recentAdaptations.slice(0, 3).map((adaptation) => (
                      <AdaptationCard key={adaptation.id} adaptation={adaptation} />
                    ))}
                  </div>
                </div>
              )}

              {recentObservations.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-sm font-medium text-foreground">Recent Evidence</h3>
                    {currentSession && (
                      <span className="text-xs text-muted-foreground">
                        Session score {Math.round(currentSession.effectivenessScore * 100)}%
                      </span>
                    )}
                  </div>
                  <div className="grid gap-2">
                    {recentObservations.slice(0, 3).map((observation) => (
                      <ObservationCard key={observation.id} observation={observation} />
                    ))}
                  </div>
                </div>
              )}

              {/* Strengths & Weaknesses */}
              <div className={`grid grid-cols-2 gap-3 ${!hasLearningEvidence ? 'opacity-60' : ''}`}>
                <div className="rounded-sm border border-emerald-500/20 bg-emerald-500/8 p-4">
                  <h4 className="text-sm font-medium text-green-400 mb-2 flex items-center gap-2">
                    <CheckCircle className="w-4 h-4" />
                    Strengths
                  </h4>
                  <div className="space-y-1">
                    {profile.strengths.length > 0 ? (
                      profile.strengths.map((s, i) => (
                        <div key={i} className="text-xs text-foreground/80">
                          • {s.replace('_', ' ')}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">Still discovering...</div>
                    )}
                  </div>
                </div>
                <div className="rounded-sm border border-rose-500/20 bg-rose-500/8 p-4">
                  <h4 className="text-sm font-medium text-red-400 mb-2 flex items-center gap-2">
                    <AlertCircle className="w-4 h-4" />
                    Growth Areas
                  </h4>
                  <div className="space-y-1">
                    {profile.weaknesses.length > 0 ? (
                      profile.weaknesses.map((w, i) => (
                        <div key={i} className="text-xs text-foreground/80">
                          • {w.replace('_', ' ')}
                        </div>
                      ))
                    ) : (
                      <div className="text-xs text-muted-foreground">None identified yet</div>
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
                <h3 className="text-sm font-medium text-foreground">Active Patterns</h3>
                <span className="text-xs text-muted-foreground">{activePatterns.length} patterns today</span>
              </div>
              <PatternActivity patterns={activePatterns} />

              {/* Recent pattern details */}
              <div className="mt-4 space-y-2">
                <h4 className="text-xs font-medium text-muted-foreground">Recent Observations</h4>
                {activePatterns.slice(0, 5).map((pattern, i) => {
                  const config = PATTERN_CONFIG[pattern.type]
                  const Icon = config.icon

                  return (
                    <div
                      key={i}
                      className={`flex items-center gap-3 p-3 rounded-sm border ${
                        pattern.outcome === 'positive' ? 'bg-green-500/5 border-green-500/20' :
                        pattern.outcome === 'negative' ? 'bg-red-500/5 border-red-500/20' :
                        'border-border/60 bg-background/40'
                      }`}
                    >
                      <Icon className="w-4 h-4" style={{ color: config.color }} />
                      <div className="flex-1 min-w-0">
                        <div className="truncate text-sm text-foreground">{pattern.pattern}</div>
                        <div className="text-xs text-muted-foreground">
                          Effectiveness: {Math.round(pattern.effectiveness * 100)}%
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded-full ${
                        pattern.outcome === 'positive' ? 'bg-green-500/20 text-green-400' :
                        pattern.outcome === 'negative' ? 'bg-red-500/20 text-red-400' :
                        'bg-muted text-muted-foreground'
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
                <h3 className="text-sm font-medium text-foreground">Learning Goals</h3>
                <span className="text-xs text-muted-foreground">{activeGoals.length} active</span>
              </div>

              {activeGoals.length > 0 ? (
                <div className="space-y-3">
                  {activeGoals.map((goal) => (
                    <GoalCard key={goal.id} goal={goal} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Target className="mx-auto mb-3 h-12 w-12 text-muted-foreground/70" />
                  <p className="text-sm text-foreground/85">No active learning goals</p>
                  <p className="mt-1 text-xs text-muted-foreground">Goals will be generated based on patterns</p>
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
                <h3 className="text-sm font-medium text-foreground">Skill Progression</h3>
                <span className="text-xs text-muted-foreground">{skills.length} skills tracked</span>
              </div>

              {skills.length > 0 ? (
                <div className="grid gap-3">
                  {skills.map((skill, i) => (
                    <SkillProgressionCard key={i} skill={skill} />
                  ))}
                </div>
              ) : (
                <div className="text-center py-8">
                  <Award className="mx-auto mb-3 h-12 w-12 text-muted-foreground/70" />
                  <p className="text-sm text-foreground/85">Skills unlock through learning</p>
                  <p className="mt-1 text-xs text-muted-foreground">Keep practicing to level up</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="border-t border-border/70 bg-background/45 px-5 py-3">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Clock className="w-3.5 h-3.5" />
            <span>Updated {new Date(state.lastUpdated).toLocaleTimeString()}</span>
          </div>
          <div className="text-muted-foreground">
            Strategy: <span className="text-cyan-400">{profile.preferences.preferredStrategy}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MetaLearningDashboard
