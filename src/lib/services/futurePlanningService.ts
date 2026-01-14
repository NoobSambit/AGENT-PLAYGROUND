// ============================================
// FUTURE PLANNING SERVICE (Feature 8 Enhancement)
// Extends Temporal Awareness with predictive planning
// ============================================

import { AgentRecord, EmotionalState, AgentProgress, TimelineEvent } from '@/types/database'
import { LearningGoal } from '@/types/metaLearning'

// ============================================
// TYPES
// ============================================

export type PredictionConfidence = 'high' | 'medium' | 'low' | 'speculative'

export type GoalStatus = 'on_track' | 'at_risk' | 'behind' | 'ahead' | 'blocked'

export type PlanPhase = 'immediate' | 'short_term' | 'medium_term' | 'long_term'

export interface FuturePrediction {
  id: string
  agentId: string

  // Prediction details
  type: 'emotional' | 'behavioral' | 'relational' | 'skill' | 'milestone'
  title: string
  description: string

  // When
  predictedDate: string
  timeframe: PlanPhase

  // Confidence
  confidence: PredictionConfidence
  confidenceScore: number // 0-1

  // Basis
  basedOn: string[] // What data supports this prediction
  assumptions: string[]

  // Outcome probabilities
  outcomes: Array<{
    description: string
    probability: number // 0-1
    impact: 'positive' | 'negative' | 'neutral'
  }>

  // Status
  isActive: boolean
  wasAccurate?: boolean // Set after prediction date passes

  createdAt: string
}

export interface GoalTrajectory {
  goalId: string
  goalTitle: string

  // Current status
  currentProgress: number // 0-1
  status: GoalStatus

  // Trajectory analysis
  projectedCompletionDate: string
  originalTargetDate?: string
  daysAhead: number // positive = ahead, negative = behind

  // Velocity
  progressVelocity: number // progress per day
  requiredVelocity: number // needed to hit target

  // Milestones
  upcomingMilestones: Array<{
    description: string
    projectedDate: string
    importance: number // 0-1
  }>

  // Risk factors
  riskFactors: Array<{
    factor: string
    severity: 'high' | 'medium' | 'low'
    mitigation?: string
  }>

  // Recommendations
  recommendations: string[]
}

export interface ScheduledActivity {
  id: string
  agentId: string

  // Activity details
  title: string
  description: string
  type: 'learning' | 'creative' | 'social' | 'reflection' | 'challenge'

  // Timing
  scheduledFor: string
  duration: number // minutes
  isRecurring: boolean
  recurrencePattern?: 'daily' | 'weekly' | 'monthly'

  // Priority
  priority: 'high' | 'medium' | 'low'
  isOptional: boolean

  // Dependencies
  prerequisites: string[] // Activity IDs that must be completed first
  blockedBy: string[] // What's blocking this

  // Status
  status: 'scheduled' | 'in_progress' | 'completed' | 'skipped' | 'rescheduled'

  createdAt: string
}

export interface FuturePlan {
  agentId: string

  // Plan overview
  planHorizon: PlanPhase
  generatedAt: string
  validUntil: string

  // Goals
  activeGoals: GoalTrajectory[]
  suggestedGoals: Array<{
    title: string
    description: string
    rationale: string
    suggestedPriority: 'high' | 'medium' | 'low'
  }>

  // Predictions
  predictions: FuturePrediction[]

  // Schedule
  upcomingActivities: ScheduledActivity[]

  // Insights
  insights: Array<{
    type: 'opportunity' | 'warning' | 'milestone' | 'trend'
    title: string
    description: string
    actionable: boolean
    suggestedAction?: string
  }>

  // Summary
  summary: {
    overallOutlook: 'positive' | 'neutral' | 'concerning'
    keyFocusAreas: string[]
    biggestOpportunity: string
    biggestRisk: string
  }
}

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

export class FuturePlanningService {
  // ============================================
  // PREDICTION GENERATION
  // ============================================

  /**
   * Generate emotional predictions based on current state and patterns
   */
  generateEmotionalPredictions(
    agent: AgentRecord,
    recentEvents: TimelineEvent[]
  ): FuturePrediction[] {
    const predictions: FuturePrediction[] = []
    const emotionalState = agent.emotionalState

    if (!emotionalState) return predictions

    // Analyze emotional trends
    const emotionEvents = recentEvents.filter(e => e.type === 'emotion')
    const dominantEmotions = this.analyzeDominantEmotions(emotionEvents)

    // Predict emotional stability
    const volatility = this.calculateEmotionalVolatility(emotionalState)

    if (volatility > 0.7) {
      predictions.push({
        id: `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agentId: agent.id,
        type: 'emotional',
        title: 'Emotional fluctuation expected',
        description: 'Based on recent patterns, emotional state may continue to fluctuate.',
        predictedDate: this.addDays(new Date(), 1).toISOString(),
        timeframe: 'immediate',
        confidence: 'medium',
        confidenceScore: 0.6,
        basedOn: ['Recent emotional events', 'Volatility patterns'],
        assumptions: ['Current interaction patterns continue'],
        outcomes: [
          { description: 'Stabilization with support', probability: 0.4, impact: 'positive' },
          { description: 'Continued fluctuation', probability: 0.4, impact: 'neutral' },
          { description: 'Increased stress', probability: 0.2, impact: 'negative' }
        ],
        isActive: true,
        createdAt: new Date().toISOString()
      })
    }

    // Predict emotional growth
    const positiveEvents = emotionEvents.filter(e =>
      e.metadata?.emotionalState?.dominantEmotion === 'joy' ||
      e.metadata?.emotionalState?.dominantEmotion === 'trust'
    )

    if (positiveEvents.length > emotionEvents.length * 0.6) {
      predictions.push({
        id: `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agentId: agent.id,
        type: 'emotional',
        title: 'Positive emotional trajectory',
        description: 'Strong positive emotional patterns suggest continued wellbeing.',
        predictedDate: this.addDays(new Date(), 7).toISOString(),
        timeframe: 'short_term',
        confidence: 'high',
        confidenceScore: 0.8,
        basedOn: ['Positive event frequency', 'Emotional baseline'],
        assumptions: ['Supportive interactions continue'],
        outcomes: [
          { description: 'Sustained positivity', probability: 0.7, impact: 'positive' },
          { description: 'Return to baseline', probability: 0.25, impact: 'neutral' },
          { description: 'Unexpected setback', probability: 0.05, impact: 'negative' }
        ],
        isActive: true,
        createdAt: new Date().toISOString()
      })
    }

    return predictions
  }

  /**
   * Generate skill/milestone predictions
   */
  generateSkillPredictions(
    agent: AgentRecord,
    goals: LearningGoal[]
  ): FuturePrediction[] {
    const predictions: FuturePrediction[] = []

    for (const goal of goals.filter(g => g.status === 'active')) {
      // Calculate velocity
      const velocity = goal.progressPercentage / Math.max(
        this.daysBetween(new Date(goal.createdAt), new Date()),
        1
      )

      // Predict completion
      const remainingProgress = 100 - goal.progressPercentage
      const daysToCompletion = velocity > 0 ? remainingProgress / velocity : 365

      predictions.push({
        id: `pred-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agentId: agent.id,
        type: 'milestone',
        title: `Goal completion: ${goal.title}`,
        description: `Projected to achieve "${goal.title}" based on current progress rate.`,
        predictedDate: this.addDays(new Date(), daysToCompletion).toISOString(),
        timeframe: daysToCompletion < 7 ? 'immediate' :
                   daysToCompletion < 30 ? 'short_term' :
                   daysToCompletion < 90 ? 'medium_term' : 'long_term',
        confidence: velocity > 2 ? 'high' : velocity > 0.5 ? 'medium' : 'low',
        confidenceScore: Math.min(velocity / 3, 0.9),
        basedOn: ['Progress velocity', 'Historical completion rates'],
        assumptions: ['Current effort level maintained'],
        outcomes: [
          { description: 'Goal achieved on time', probability: velocity > 1 ? 0.7 : 0.4, impact: 'positive' },
          { description: 'Delayed completion', probability: velocity > 1 ? 0.2 : 0.4, impact: 'neutral' },
          { description: 'Goal abandoned', probability: 0.1, impact: 'negative' }
        ],
        isActive: true,
        createdAt: new Date().toISOString()
      })
    }

    return predictions
  }

  // ============================================
  // GOAL TRAJECTORY ANALYSIS
  // ============================================

  /**
   * Analyze trajectory for a goal
   */
  analyzeGoalTrajectory(goal: LearningGoal): GoalTrajectory {
    const now = new Date()
    const createdAt = new Date(goal.createdAt)
    const daysSinceStart = this.daysBetween(createdAt, now)

    // Calculate velocity
    const progressVelocity = daysSinceStart > 0
      ? goal.progressPercentage / daysSinceStart
      : 0

    // Calculate required velocity if target exists
    const targetDate = goal.targetDate ? new Date(goal.targetDate) : null
    const daysRemaining = targetDate ? this.daysBetween(now, targetDate) : 30
    const remainingProgress = 100 - goal.progressPercentage
    const requiredVelocity = daysRemaining > 0 ? remainingProgress / daysRemaining : Infinity

    // Determine status
    let status: GoalStatus = 'on_track'
    let daysAhead = 0

    if (progressVelocity >= requiredVelocity * 1.2) {
      status = 'ahead'
      daysAhead = Math.round((progressVelocity - requiredVelocity) * daysRemaining / requiredVelocity)
    } else if (progressVelocity < requiredVelocity * 0.5) {
      status = 'behind'
      daysAhead = -Math.round((requiredVelocity - progressVelocity) * daysRemaining / requiredVelocity)
    } else if (progressVelocity < requiredVelocity * 0.8) {
      status = 'at_risk'
    }

    // Calculate projected completion
    const daysToCompletion = progressVelocity > 0 ? remainingProgress / progressVelocity : 365
    const projectedCompletionDate = this.addDays(now, daysToCompletion).toISOString()

    // Identify risk factors
    const riskFactors: GoalTrajectory['riskFactors'] = []

    if (progressVelocity < 0.5) {
      riskFactors.push({
        factor: 'Low progress velocity',
        severity: 'high',
        mitigation: 'Increase daily practice time or adjust goal scope'
      })
    }

    if (daysRemaining < 7 && remainingProgress > 30) {
      riskFactors.push({
        factor: 'Tight deadline',
        severity: 'high',
        mitigation: 'Focus exclusively on this goal or extend deadline'
      })
    }

    // Generate recommendations
    const recommendations: string[] = []

    if (status === 'behind') {
      recommendations.push('Increase focus on this goal')
      recommendations.push('Consider breaking into smaller milestones')
    } else if (status === 'ahead') {
      recommendations.push('Excellent progress! Consider setting stretch goals')
    } else if (status === 'at_risk') {
      recommendations.push('Review blockers and adjust approach')
    }

    return {
      goalId: goal.id,
      goalTitle: goal.title,
      currentProgress: goal.progressPercentage / 100,
      status,
      projectedCompletionDate,
      originalTargetDate: goal.targetDate,
      daysAhead,
      progressVelocity,
      requiredVelocity,
      upcomingMilestones: goal.milestones
        .filter(m => !m.achieved)
        .map(m => ({
          description: m.description,
          projectedDate: this.addDays(now, (m.targetValue - goal.currentValue) / progressVelocity).toISOString(),
          importance: 0.7
        })),
      riskFactors,
      recommendations
    }
  }

  // ============================================
  // FULL FUTURE PLAN GENERATION
  // ============================================

  /**
   * Generate a comprehensive future plan
   */
  generateFuturePlan(
    agent: AgentRecord,
    goals: LearningGoal[],
    recentEvents: TimelineEvent[],
    horizon: PlanPhase = 'short_term'
  ): FuturePlan {
    // Generate predictions
    const emotionalPredictions = this.generateEmotionalPredictions(agent, recentEvents)
    const skillPredictions = this.generateSkillPredictions(agent, goals)
    const allPredictions = [...emotionalPredictions, ...skillPredictions]

    // Analyze goal trajectories
    const goalTrajectories = goals
      .filter(g => g.status === 'active')
      .map(g => this.analyzeGoalTrajectory(g))

    // Generate suggested goals based on gaps
    const suggestedGoals = this.suggestNewGoals(agent, goals, recentEvents)

    // Generate schedule
    const upcomingActivities = this.generateSchedule(agent, goalTrajectories)

    // Generate insights
    const insights = this.generateInsights(agent, goalTrajectories, allPredictions)

    // Calculate summary
    const summary = this.generateSummary(goalTrajectories, allPredictions, insights)

    // Calculate validity period
    const validityDays = horizon === 'immediate' ? 1 :
                         horizon === 'short_term' ? 7 :
                         horizon === 'medium_term' ? 30 : 90

    return {
      agentId: agent.id,
      planHorizon: horizon,
      generatedAt: new Date().toISOString(),
      validUntil: this.addDays(new Date(), validityDays).toISOString(),
      activeGoals: goalTrajectories,
      suggestedGoals,
      predictions: allPredictions.filter(p => {
        const predDate = new Date(p.predictedDate)
        const maxDate = this.addDays(new Date(), validityDays)
        return predDate <= maxDate
      }),
      upcomingActivities,
      insights,
      summary
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private suggestNewGoals(
    agent: AgentRecord,
    existingGoals: LearningGoal[],
    recentEvents: TimelineEvent[]
  ): FuturePlan['suggestedGoals'] {
    const suggestions: FuturePlan['suggestedGoals'] = []

    // Analyze what areas are underrepresented
    const coveredCategories = new Set(existingGoals.map(g => g.category))

    const allCategories = [
      'topic_interest', 'communication_style', 'emotional_response',
      'problem_solving', 'memory_retention', 'relationship_building'
    ]

    for (const category of allCategories) {
      if (!coveredCategories.has(category as LearningGoal['category'])) {
        suggestions.push({
          title: `Develop ${category.replace('_', ' ')} skills`,
          description: `Focus on improving ${category.replace('_', ' ')} capabilities.`,
          rationale: 'No active goals in this area',
          suggestedPriority: 'medium'
        })
      }
    }

    // Suggest based on recent positive events
    const recentTopics = recentEvents
      .filter(e => e.metadata?.topics)
      .flatMap(e => e.metadata?.topics || [])

    if (recentTopics.length > 0) {
      const topTopic = this.getMostFrequent(recentTopics)
      suggestions.push({
        title: `Deep dive into ${topTopic}`,
        description: `Build expertise in ${topTopic} based on recent interest.`,
        rationale: 'Frequently discussed topic',
        suggestedPriority: 'medium'
      })
    }

    return suggestions.slice(0, 3)
  }

  private generateSchedule(
    agent: AgentRecord,
    trajectories: GoalTrajectory[]
  ): ScheduledActivity[] {
    const activities: ScheduledActivity[] = []
    const now = new Date()

    // Schedule activities for at-risk goals
    for (const trajectory of trajectories.filter(t => t.status === 'at_risk' || t.status === 'behind')) {
      activities.push({
        id: `act-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
        agentId: agent.id,
        title: `Focus session: ${trajectory.goalTitle}`,
        description: `Dedicated practice time for ${trajectory.goalTitle}`,
        type: 'learning',
        scheduledFor: this.addDays(now, 1).toISOString(),
        duration: 30,
        isRecurring: true,
        recurrencePattern: 'daily',
        priority: trajectory.status === 'behind' ? 'high' : 'medium',
        isOptional: false,
        prerequisites: [],
        blockedBy: [],
        status: 'scheduled',
        createdAt: new Date().toISOString()
      })
    }

    // Schedule reflection time
    activities.push({
      id: `act-${Date.now()}-reflect`,
      agentId: agent.id,
      title: 'Daily reflection',
      description: 'Review progress and adjust approach',
      type: 'reflection',
      scheduledFor: this.addDays(now, 1).toISOString(),
      duration: 15,
      isRecurring: true,
      recurrencePattern: 'daily',
      priority: 'medium',
      isOptional: true,
      prerequisites: [],
      blockedBy: [],
      status: 'scheduled',
      createdAt: new Date().toISOString()
    })

    return activities
  }

  private generateInsights(
    agent: AgentRecord,
    trajectories: GoalTrajectory[],
    predictions: FuturePrediction[]
  ): FuturePlan['insights'] {
    const insights: FuturePlan['insights'] = []

    // Goal-based insights
    const behindGoals = trajectories.filter(t => t.status === 'behind')
    if (behindGoals.length > 0) {
      insights.push({
        type: 'warning',
        title: `${behindGoals.length} goals behind schedule`,
        description: `Goals "${behindGoals.map(g => g.goalTitle).join('", "')}" need attention.`,
        actionable: true,
        suggestedAction: 'Prioritize these goals or adjust timelines'
      })
    }

    const aheadGoals = trajectories.filter(t => t.status === 'ahead')
    if (aheadGoals.length > 0) {
      insights.push({
        type: 'opportunity',
        title: 'Ahead of schedule on goals',
        description: `Excellent progress on ${aheadGoals.length} goals. Consider setting stretch targets.`,
        actionable: true,
        suggestedAction: 'Add stretch goals or help others'
      })
    }

    // Prediction-based insights
    const highConfidencePredictions = predictions.filter(p => p.confidenceScore > 0.7)
    for (const pred of highConfidencePredictions.slice(0, 2)) {
      insights.push({
        type: pred.outcomes[0].impact === 'positive' ? 'opportunity' :
              pred.outcomes[0].impact === 'negative' ? 'warning' : 'trend',
        title: pred.title,
        description: pred.description,
        actionable: false
      })
    }

    // Milestone insights
    const upcomingMilestones = trajectories.flatMap(t => t.upcomingMilestones)
    const soonMilestones = upcomingMilestones.filter(m => {
      const days = this.daysBetween(new Date(), new Date(m.projectedDate))
      return days <= 7
    })

    if (soonMilestones.length > 0) {
      insights.push({
        type: 'milestone',
        title: `${soonMilestones.length} milestones approaching`,
        description: `Key milestones coming up this week.`,
        actionable: true,
        suggestedAction: 'Focus effort to hit these milestones'
      })
    }

    return insights
  }

  private generateSummary(
    trajectories: GoalTrajectory[],
    predictions: FuturePrediction[],
    insights: FuturePlan['insights']
  ): FuturePlan['summary'] {
    // Calculate overall outlook
    const positiveSignals = [
      trajectories.filter(t => t.status === 'ahead' || t.status === 'on_track').length,
      predictions.filter(p => p.outcomes[0].impact === 'positive').length,
      insights.filter(i => i.type === 'opportunity').length
    ].reduce((a, b) => a + b, 0)

    const negativeSignals = [
      trajectories.filter(t => t.status === 'behind' || t.status === 'blocked').length,
      predictions.filter(p => p.outcomes[0].impact === 'negative').length,
      insights.filter(i => i.type === 'warning').length
    ].reduce((a, b) => a + b, 0)

    const overallOutlook = positiveSignals > negativeSignals * 2 ? 'positive' :
                          negativeSignals > positiveSignals ? 'concerning' : 'neutral'

    // Key focus areas
    const keyFocusAreas = [
      ...trajectories.filter(t => t.status === 'at_risk' || t.status === 'behind').map(t => t.goalTitle),
      ...insights.filter(i => i.actionable).map(i => i.title)
    ].slice(0, 3)

    // Biggest opportunity and risk
    const opportunities = insights.filter(i => i.type === 'opportunity')
    const warnings = insights.filter(i => i.type === 'warning')

    return {
      overallOutlook,
      keyFocusAreas,
      biggestOpportunity: opportunities[0]?.title || 'Continue steady progress',
      biggestRisk: warnings[0]?.title || 'None identified'
    }
  }

  // Utility methods
  private addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  private daysBetween(date1: Date, date2: Date): number {
    const diffTime = Math.abs(date2.getTime() - date1.getTime())
    return Math.ceil(diffTime / (1000 * 60 * 60 * 24))
  }

  private analyzeDominantEmotions(events: TimelineEvent[]): string[] {
    const emotionCounts: Record<string, number> = {}

    for (const event of events) {
      const emotion = event.metadata?.emotionalState?.dominantEmotion
      if (emotion) {
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1
      }
    }

    return Object.entries(emotionCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([emotion]) => emotion)
  }

  private calculateEmotionalVolatility(state: EmotionalState): number {
    const values = Object.values(state.currentMood)
    const avg = values.reduce((a, b) => a + b, 0) / values.length
    const variance = values.reduce((sum, v) => sum + Math.pow(v - avg, 2), 0) / values.length
    return Math.sqrt(variance)
  }

  private getMostFrequent(items: string[]): string {
    const counts: Record<string, number> = {}
    for (const item of items) {
      counts[item] = (counts[item] || 0) + 1
    }
    return Object.entries(counts).sort(([, a], [, b]) => b - a)[0]?.[0] || ''
  }
}

export const futurePlanningService = new FuturePlanningService()
