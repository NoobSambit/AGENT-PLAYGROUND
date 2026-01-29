// ============================================
// META-LEARNING SYSTEM TYPES (Feature 7)
// ============================================

import { EmotionType } from './database'

// Learning pattern categories
export type LearningPatternType =
  | 'topic_interest'      // Topics the agent learns best
  | 'communication_style' // How it adapts communication
  | 'emotional_response'  // Emotional learning patterns
  | 'problem_solving'     // Problem-solving approaches
  | 'memory_retention'    // What types of information stick
  | 'relationship_building' // Social learning patterns

// Learning strategy preferences
export type LearningStrategy =
  | 'exploration'   // Tries new approaches
  | 'exploitation'  // Uses proven methods
  | 'imitation'     // Learns from others
  | 'experimentation' // Trial and error
  | 'reflection'    // Analyzes past experiences

// A single learning pattern observation
export interface LearningPattern {
  id: string
  agentId: string
  type: LearningPatternType

  // Pattern details
  pattern: string // Description of the pattern
  trigger: string // What triggers this pattern
  outcome: 'positive' | 'negative' | 'neutral'

  // Metrics
  frequency: number // How often this pattern occurs (0-1)
  effectiveness: number // How effective it is (0-1)
  confidence: number // How confident we are in this pattern (0-1)

  // Context
  contexts: string[] // Situations where this pattern applies
  relatedPatterns: string[] // IDs of related patterns

  // Examples
  examples: Array<{
    input: string
    output: string
    timestamp: string
    success: boolean
  }>

  // Timestamps
  firstObserved: string
  lastObserved: string
  observationCount: number
}

// Learning adaptation - how agent has changed based on learning
export interface LearningAdaptation {
  id: string
  agentId: string

  // What changed
  adaptationType: 'behavior' | 'knowledge' | 'style' | 'preference'
  description: string

  // Before and after
  previousState: string
  currentState: string

  // Cause
  triggeringPatterns: string[] // Pattern IDs that caused this
  triggeringEvents: string[] // Event descriptions

  // Impact
  impactScore: number // -1 to 1, how much this improved agent
  affectedAreas: string[]

  // Status
  isActive: boolean
  canRevert: boolean

  timestamp: string
}

// Learning goal - what the agent is trying to learn
export interface LearningGoal {
  id: string
  agentId: string

  // Goal definition
  title: string
  description: string
  category: LearningPatternType

  // Progress tracking
  targetMetric: string
  currentValue: number
  targetValue: number
  progressPercentage: number

  // Milestones
  milestones: Array<{
    description: string
    targetValue: number
    achieved: boolean
    achievedAt?: string
  }>

  // Strategy
  strategy: LearningStrategy
  approaches: string[] // Methods being used to achieve this

  // Status
  status: 'active' | 'achieved' | 'abandoned' | 'paused'
  priority: 'high' | 'medium' | 'low'

  // Timestamps
  createdAt: string
  targetDate?: string
  achievedAt?: string
}

// Learning session - a focused learning period
export interface LearningSession {
  id: string
  agentId: string

  // Session info
  focus: LearningPatternType
  goal?: string // Goal ID if working toward specific goal

  // Activities
  activitiesCompleted: Array<{
    type: string
    description: string
    outcome: string
    timestamp: string
  }>

  // Insights gained
  insights: string[]
  patternsDiscovered: string[] // Pattern IDs
  adaptationsMade: string[] // Adaptation IDs

  // Metrics
  duration: number // minutes
  effectivenessScore: number // 0-1

  // Session boundaries
  startedAt: string
  endedAt?: string
}

// Learning profile - overall learning capabilities and preferences
export interface LearningProfile {
  agentId: string

  // Learning capabilities
  capabilities: {
    speedOfLearning: number // 0-1, how quickly agent picks up new things
    retentionRate: number // 0-1, how well it retains learned info
    transferability: number // 0-1, how well it applies learning to new contexts
    adaptability: number // 0-1, how well it adapts to changes
    creativity: number // 0-1, ability to create novel solutions
  }

  // Learning preferences
  preferences: {
    preferredStrategy: LearningStrategy
    bestLearningContexts: string[]
    optimalSessionDuration: number // minutes
    preferredFeedbackStyle: 'immediate' | 'delayed' | 'periodic'
  }

  // Strengths and weaknesses
  strengths: LearningPatternType[]
  weaknesses: LearningPatternType[]

  // Current focus areas
  activeFocusAreas: LearningPatternType[]

  // Historical data
  totalLearningHours: number
  patternsDiscovered: number
  adaptationsMade: number
  goalsAchieved: number

  // Timestamps
  lastUpdated: string
}

// Meta-learning state - overall learning system state
export interface MetaLearningState {
  agentId: string

  // Profile
  profile: LearningProfile

  // Active elements
  activePatterns: LearningPattern[]
  activeGoals: LearningGoal[]
  recentAdaptations: LearningAdaptation[]

  // Current session
  currentSession?: LearningSession

  // Statistics
  stats: {
    totalPatterns: number
    positivePatterns: number
    negativePatterns: number
    adaptationsThisWeek: number
    learningStreak: number // consecutive days with learning activity
    mostImprovedArea: LearningPatternType | null
    needsAttentionArea: LearningPatternType | null
  }

  // Recommendations
  recommendations: Array<{
    type: 'focus_area' | 'goal' | 'strategy' | 'adaptation'
    title: string
    description: string
    priority: 'high' | 'medium' | 'low'
    relatedPatternIds?: string[]
  }>

  lastUpdated: string
}

// Learning event - something that triggers learning
export interface LearningEvent {
  id: string
  agentId: string

  // Event details
  eventType: 'conversation' | 'feedback' | 'observation' | 'reflection' | 'challenge'
  description: string

  // Learning outcome
  lessonsLearned: string[]
  patternsReinforced: string[] // Pattern IDs
  newPatternsDiscovered: string[] // Pattern IDs

  // Context
  emotionalContext: EmotionType
  socialContext?: string // Who was involved

  // Impact
  learningValue: number // 0-1, how valuable this was for learning

  timestamp: string
}

// Skill progression tracking
export interface SkillProgression {
  skillName: string
  category: LearningPatternType

  // Levels
  currentLevel: number // 1-10
  experiencePoints: number
  pointsToNextLevel: number

  // History
  levelHistory: Array<{
    level: number
    achievedAt: string
    triggeringEvent?: string
  }>

  // Sub-skills
  subSkills: Array<{
    name: string
    level: number
    weight: number // How much it contributes to main skill
  }>

  // Practice stats
  practiceTime: number // minutes
  lastPracticed: string
  consistencyScore: number // 0-1, how regularly this is practiced
}

// Learning recommendation
export interface LearningRecommendation {
  id: string
  agentId: string

  // Recommendation
  type: 'goal' | 'strategy' | 'focus' | 'behavior' | 'practice'
  title: string
  description: string
  rationale: string // Why this is recommended

  // Expected impact
  expectedImprovement: number // 0-1
  affectedAreas: LearningPatternType[]

  // Action items
  actionItems: string[]
  estimatedEffort: 'low' | 'medium' | 'high'

  // Status
  status: 'pending' | 'accepted' | 'rejected' | 'completed'

  // Timestamps
  createdAt: string
  expiresAt?: string
}
