'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Calendar,
  Target,
  TrendingUp,
  TrendingDown,
  AlertTriangle,
  CheckCircle,
  Clock,
  Lightbulb,
  Activity,
  ChevronRight,
  Sparkles,
  Zap,
  Flag,
  type LucideIcon
} from 'lucide-react'
import { FuturePlan, GoalTrajectory, FuturePrediction, ScheduledActivity, GoalStatus } from '@/lib/services/futurePlanningService'

interface FuturePlanningViewProps {
  plan: FuturePlan
  className?: string
}

// Status colors and icons
const STATUS_CONFIG: Record<GoalStatus, { color: string; bgColor: string; icon: LucideIcon; label: string }> = {
  on_track: { color: 'text-green-400', bgColor: 'bg-green-500/20', icon: CheckCircle, label: 'On Track' },
  ahead: { color: 'text-cyan-400', bgColor: 'bg-cyan-500/20', icon: TrendingUp, label: 'Ahead' },
  at_risk: { color: 'text-amber-400', bgColor: 'bg-amber-500/20', icon: AlertTriangle, label: 'At Risk' },
  behind: { color: 'text-red-400', bgColor: 'bg-red-500/20', icon: TrendingDown, label: 'Behind' },
  blocked: { color: 'text-gray-400', bgColor: 'bg-gray-500/20', icon: AlertTriangle, label: 'Blocked' }
}

// Goal trajectory card
function GoalTrajectoryCard({ trajectory }: { trajectory: GoalTrajectory }) {
  const [expanded, setExpanded] = useState(false)
  const config = STATUS_CONFIG[trajectory.status]
  const StatusIcon = config.icon

  const progressWidth = Math.min(trajectory.currentProgress * 100, 100)
  const projectedDate = new Date(trajectory.projectedCompletionDate).toLocaleDateString()

  return (
    <motion.div
      className="bg-gray-800/50 rounded-xl border border-gray-700/50 overflow-hidden"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
    >
      <div
        className="p-4 cursor-pointer"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-lg ${config.bgColor}`}>
              <StatusIcon className={`w-4 h-4 ${config.color}`} />
            </div>
            <div>
              <h4 className="font-medium text-white">{trajectory.goalTitle}</h4>
              <div className="flex items-center gap-2 mt-1">
                <span className={`text-xs px-2 py-0.5 rounded-full ${config.bgColor} ${config.color}`}>
                  {config.label}
                </span>
                {trajectory.daysAhead !== 0 && (
                  <span className={`text-xs ${trajectory.daysAhead > 0 ? 'text-green-400' : 'text-red-400'}`}>
                    {Math.abs(trajectory.daysAhead)}d {trajectory.daysAhead > 0 ? 'ahead' : 'behind'}
                  </span>
                )}
              </div>
            </div>
          </div>
          <ChevronRight className={`w-5 h-5 text-gray-500 transition-transform ${expanded ? 'rotate-90' : ''}`} />
        </div>

        {/* Progress bar */}
        <div className="mt-4">
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-500">Progress</span>
            <span className="text-white">{Math.round(progressWidth)}%</span>
          </div>
          <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
            <motion.div
              className={`h-full rounded-full ${
                trajectory.status === 'ahead' || trajectory.status === 'on_track' ? 'bg-green-500' :
                trajectory.status === 'at_risk' ? 'bg-amber-500' : 'bg-red-500'
              }`}
              initial={{ width: 0 }}
              animate={{ width: `${progressWidth}%` }}
              transition={{ duration: 0.5 }}
            />
          </div>
        </div>

        {/* Quick stats */}
        <div className="flex gap-4 mt-3 text-xs">
          <div className="flex items-center gap-1 text-gray-400">
            <Calendar className="w-3.5 h-3.5" />
            <span>Est. {projectedDate}</span>
          </div>
          <div className="flex items-center gap-1 text-gray-400">
            <Activity className="w-3.5 h-3.5" />
            <span>{trajectory.progressVelocity.toFixed(1)}%/day</span>
          </div>
        </div>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="border-t border-gray-700/50 overflow-hidden"
          >
            <div className="p-4 space-y-4">
              {/* Risk factors */}
              {trajectory.riskFactors.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-400 mb-2">Risk Factors</h5>
                  <div className="space-y-2">
                    {trajectory.riskFactors.map((risk, i) => (
                      <div key={i} className={`p-2 rounded-lg ${
                        risk.severity === 'high' ? 'bg-red-500/10 border border-red-500/20' :
                        risk.severity === 'medium' ? 'bg-amber-500/10 border border-amber-500/20' :
                        'bg-gray-800/50 border border-gray-700/50'
                      }`}>
                        <div className="text-xs text-white">{risk.factor}</div>
                        {risk.mitigation && (
                          <div className="text-xs text-gray-500 mt-1">→ {risk.mitigation}</div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Upcoming milestones */}
              {trajectory.upcomingMilestones.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-400 mb-2">Upcoming Milestones</h5>
                  <div className="space-y-1">
                    {trajectory.upcomingMilestones.map((milestone, i) => (
                      <div key={i} className="flex items-center justify-between text-xs">
                        <div className="flex items-center gap-2">
                          <Flag className="w-3 h-3 text-purple-400" />
                          <span className="text-gray-300">{milestone.description}</span>
                        </div>
                        <span className="text-gray-500">
                          {new Date(milestone.projectedDate).toLocaleDateString()}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Recommendations */}
              {trajectory.recommendations.length > 0 && (
                <div>
                  <h5 className="text-xs font-medium text-gray-400 mb-2">Recommendations</h5>
                  <ul className="space-y-1">
                    {trajectory.recommendations.map((rec, i) => (
                      <li key={i} className="flex items-start gap-2 text-xs text-gray-300">
                        <Lightbulb className="w-3 h-3 text-amber-400 mt-0.5" />
                        {rec}
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// Prediction card
function PredictionCard({ prediction }: { prediction: FuturePrediction }) {
  const confidenceColor =
    prediction.confidence === 'high' ? 'text-green-400' :
    prediction.confidence === 'medium' ? 'text-amber-400' :
    prediction.confidence === 'low' ? 'text-orange-400' : 'text-gray-400'

  const timeframeLabel =
    prediction.timeframe === 'immediate' ? 'Today/Tomorrow' :
    prediction.timeframe === 'short_term' ? 'This Week' :
    prediction.timeframe === 'medium_term' ? 'This Month' : 'Long Term'

  return (
    <motion.div
      className="bg-gradient-to-br from-purple-500/10 to-cyan-500/10 rounded-xl p-4 border border-purple-500/20"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-purple-400" />
          <span className="text-xs text-purple-300">{timeframeLabel}</span>
        </div>
        <span className={`text-xs ${confidenceColor}`}>
          {Math.round(prediction.confidenceScore * 100)}% confidence
        </span>
      </div>

      <h4 className="font-medium text-white mb-1">{prediction.title}</h4>
      <p className="text-xs text-gray-400 mb-3">{prediction.description}</p>

      {/* Outcomes */}
      <div className="space-y-1">
        {prediction.outcomes.map((outcome, i) => (
          <div key={i} className="flex items-center justify-between text-xs">
            <span className={`${
              outcome.impact === 'positive' ? 'text-green-400' :
              outcome.impact === 'negative' ? 'text-red-400' : 'text-gray-400'
            }`}>
              {outcome.description}
            </span>
            <span className="text-gray-500">{Math.round(outcome.probability * 100)}%</span>
          </div>
        ))}
      </div>
    </motion.div>
  )
}

// Activity card
function ActivityCard({ activity }: { activity: ScheduledActivity }) {
  const typeColors: Record<string, string> = {
    learning: 'bg-blue-500/20 text-blue-400',
    creative: 'bg-purple-500/20 text-purple-400',
    social: 'bg-pink-500/20 text-pink-400',
    reflection: 'bg-amber-500/20 text-amber-400',
    challenge: 'bg-green-500/20 text-green-400'
  }

  return (
    <div className="flex items-center gap-3 p-3 bg-gray-800/30 rounded-lg border border-gray-700/50">
      <div className={`px-2 py-1 rounded text-xs ${typeColors[activity.type] || 'bg-gray-500/20 text-gray-400'}`}>
        {activity.type}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-sm text-white truncate">{activity.title}</div>
        <div className="text-xs text-gray-500">{activity.duration} min</div>
      </div>
      <div className="flex items-center gap-1 text-xs text-gray-400">
        <Clock className="w-3.5 h-3.5" />
        {new Date(activity.scheduledFor).toLocaleDateString()}
      </div>
    </div>
  )
}

// Insight card
function InsightCard({ insight }: { insight: FuturePlan['insights'][0] }) {
  const iconMap: Record<FuturePlan['insights'][0]['type'], LucideIcon> = {
    opportunity: Sparkles,
    warning: AlertTriangle,
    milestone: Flag,
    trend: TrendingUp
  }
  const colorMap: Record<string, string> = {
    opportunity: 'text-cyan-400 bg-cyan-500/20',
    warning: 'text-amber-400 bg-amber-500/20',
    milestone: 'text-purple-400 bg-purple-500/20',
    trend: 'text-green-400 bg-green-500/20'
  }

  const Icon = iconMap[insight.type] || Lightbulb
  const colors = colorMap[insight.type] || 'text-gray-400 bg-gray-500/20'

  return (
    <div className="flex items-start gap-3 p-3 bg-gray-800/30 rounded-lg">
      <div className={`p-2 rounded-lg ${colors.split(' ')[1]}`}>
        <Icon className={`w-4 h-4 ${colors.split(' ')[0]}`} />
      </div>
      <div className="flex-1 min-w-0">
        <h5 className="text-sm font-medium text-white">{insight.title}</h5>
        <p className="text-xs text-gray-500 mt-0.5">{insight.description}</p>
        {insight.suggestedAction && (
          <div className="flex items-center gap-1 mt-2 text-xs text-cyan-400">
            <Zap className="w-3 h-3" />
            {insight.suggestedAction}
          </div>
        )}
      </div>
    </div>
  )
}

// Main component
export function FuturePlanningView({ plan, className = '' }: FuturePlanningViewProps) {
  const [activeTab, setActiveTab] = useState<'overview' | 'goals' | 'predictions' | 'schedule'>('overview')

  const outlookColors = {
    positive: 'text-green-400 bg-green-500/20',
    neutral: 'text-amber-400 bg-amber-500/20',
    concerning: 'text-red-400 bg-red-500/20'
  }

  return (
    <div className={`bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-gray-800 overflow-hidden ${className}`}>
      {/* Header */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-cyan-500/20 to-purple-500/20 rounded-xl">
              <Calendar className="w-6 h-6 text-cyan-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-lg">Future Planning</h2>
              <p className="text-xs text-gray-400">
                {plan.planHorizon.replace('_', ' ')} outlook
              </p>
            </div>
          </div>

          {/* Outlook badge */}
          <div className={`px-3 py-1.5 rounded-full ${outlookColors[plan.summary.overallOutlook]}`}>
            <span className="text-sm font-medium capitalize">
              {plan.summary.overallOutlook} outlook
            </span>
          </div>
        </div>

        {/* Tab navigation */}
        <div className="flex gap-1 mt-4 bg-gray-800/50 rounded-lg p-1">
          {(['overview', 'goals', 'predictions', 'schedule'] as const).map((tab) => (
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
              {/* Summary cards */}
              <div className="grid grid-cols-2 gap-3">
                <div className="bg-green-500/10 rounded-xl p-4 border border-green-500/20">
                  <div className="text-xs text-green-400 mb-1">Biggest Opportunity</div>
                  <div className="text-sm text-white">{plan.summary.biggestOpportunity}</div>
                </div>
                <div className="bg-red-500/10 rounded-xl p-4 border border-red-500/20">
                  <div className="text-xs text-red-400 mb-1">Biggest Risk</div>
                  <div className="text-sm text-white">{plan.summary.biggestRisk}</div>
                </div>
              </div>

              {/* Key focus areas */}
              {plan.summary.keyFocusAreas.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Key Focus Areas</h3>
                  <div className="flex flex-wrap gap-2">
                    {plan.summary.keyFocusAreas.map((area, i) => (
                      <span
                        key={i}
                        className="px-3 py-1.5 bg-purple-500/20 text-purple-300 rounded-full text-xs"
                      >
                        {area}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Insights */}
              {plan.insights.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Insights</h3>
                  <div className="space-y-2">
                    {plan.insights.slice(0, 4).map((insight, i) => (
                      <InsightCard key={i} insight={insight} />
                    ))}
                  </div>
                </div>
              )}

              {/* Suggested goals */}
              {plan.suggestedGoals.length > 0 && (
                <div>
                  <h3 className="text-sm font-medium text-white mb-3">Suggested Goals</h3>
                  <div className="space-y-2">
                    {plan.suggestedGoals.map((goal, i) => (
                      <div
                        key={i}
                        className="p-3 bg-gray-800/30 rounded-lg border border-gray-700/50"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="text-sm text-white">{goal.title}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            goal.suggestedPriority === 'high' ? 'bg-red-500/20 text-red-400' :
                            goal.suggestedPriority === 'medium' ? 'bg-amber-500/20 text-amber-400' :
                            'bg-green-500/20 text-green-400'
                          }`}>
                            {goal.suggestedPriority}
                          </span>
                        </div>
                        <p className="text-xs text-gray-500">{goal.rationale}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'goals' && (
            <motion.div
              key="goals"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {plan.activeGoals.length > 0 ? (
                plan.activeGoals.map((trajectory) => (
                  <GoalTrajectoryCard key={trajectory.goalId} trajectory={trajectory} />
                ))
              ) : (
                <div className="text-center py-8">
                  <Target className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No active goals to track</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'predictions' && (
            <motion.div
              key="predictions"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {plan.predictions.length > 0 ? (
                plan.predictions.map((prediction) => (
                  <PredictionCard key={prediction.id} prediction={prediction} />
                ))
              ) : (
                <div className="text-center py-8">
                  <Sparkles className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No predictions available yet</p>
                  <p className="text-gray-500 text-xs mt-1">Predictions are generated from patterns</p>
                </div>
              )}
            </motion.div>
          )}

          {activeTab === 'schedule' && (
            <motion.div
              key="schedule"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-3"
            >
              {plan.upcomingActivities.length > 0 ? (
                plan.upcomingActivities.map((activity) => (
                  <ActivityCard key={activity.id} activity={activity} />
                ))
              ) : (
                <div className="text-center py-8">
                  <Calendar className="w-12 h-12 text-gray-600 mx-auto mb-3" />
                  <p className="text-gray-400 text-sm">No scheduled activities</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 bg-gray-800/30 border-t border-gray-800">
        <div className="flex items-center justify-between text-xs text-gray-500">
          <div className="flex items-center gap-1">
            <Clock className="w-3.5 h-3.5" />
            Generated {new Date(plan.generatedAt).toLocaleString()}
          </div>
          <div>
            Valid until {new Date(plan.validUntil).toLocaleDateString()}
          </div>
        </div>
      </div>
    </div>
  )
}

export default FuturePlanningView
