// ============================================
// META-LEARNING SERVICE (Feature 7)
// Enables agents to learn how to learn better
// ============================================

import {
  LearningPattern,
  LearningPatternType,
  LearningStrategy,
  LearningAdaptation,
  LearningGoal,
  LearningSession,
  LearningProfile,
  MetaLearningState,
  LearningEvent,
  SkillProgression,
  LearningRecommendation
} from '@/types/metaLearning'
import { AgentRecord, EmotionType, MemoryRecord } from '@/types/database'

// ============================================
// PATTERN DETECTION
// ============================================

// Keywords for detecting learning pattern types
const PATTERN_KEYWORDS: Record<LearningPatternType, string[]> = {
  topic_interest: ['interested', 'curious', 'fascinated', 'learn more', 'tell me about', 'what is'],
  communication_style: ['explain', 'describe', 'simpler', 'detail', 'brief', 'elaborate'],
  emotional_response: ['feel', 'emotion', 'happy', 'sad', 'excited', 'frustrated', 'calm'],
  problem_solving: ['solve', 'figure out', 'approach', 'strategy', 'solution', 'method'],
  memory_retention: ['remember', 'recall', 'forget', 'earlier', 'mentioned', 'previously'],
  relationship_building: ['trust', 'friend', 'connect', 'understand', 'relate', 'bond']
}

// Strategy indicators
const STRATEGY_INDICATORS: Record<LearningStrategy, string[]> = {
  exploration: ['new', 'try', 'different', 'alternative', 'what if', 'experiment'],
  exploitation: ['best', 'proven', 'reliable', 'always', 'usually', 'typically'],
  imitation: ['like', 'similar to', 'same as', 'copy', 'follow', 'model'],
  experimentation: ['test', 'see what happens', 'trial', 'attempt', 'guess'],
  reflection: ['think about', 'consider', 'analyze', 'review', 'reflect', 'ponder']
}

export class MetaLearningService {
  // ============================================
  // PATTERN ANALYSIS
  // ============================================

  /**
   * Detect learning patterns from a conversation
   */
  detectPatternsFromConversation(
    messages: Array<{ content: string; type: 'user' | 'agent'; timestamp: string }>,
    agentId: string
  ): LearningPattern[] {
    const detectedPatterns: LearningPattern[] = []
    const allText = messages.map(m => m.content.toLowerCase()).join(' ')

    // Check each pattern type
    for (const [type, keywords] of Object.entries(PATTERN_KEYWORDS)) {
      const matches = keywords.filter(kw => allText.includes(kw))

      if (matches.length > 0) {
        const frequency = matches.length / keywords.length

        // Extract context around matches
        const contexts: string[] = []
        for (const message of messages) {
          const lowerContent = message.content.toLowerCase()
          for (const match of matches) {
            if (lowerContent.includes(match)) {
              contexts.push(message.content.substring(0, 100))
              break
            }
          }
        }

        // Determine outcome based on conversation flow
        const outcome = this.determineOutcome(messages)

        detectedPatterns.push({
          id: `pattern-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          agentId,
          type: type as LearningPatternType,
          pattern: `Agent shows ${type.replace('_', ' ')} pattern`,
          trigger: matches.join(', '),
          outcome,
          frequency: Math.min(frequency, 1),
          effectiveness: outcome === 'positive' ? 0.7 : outcome === 'negative' ? 0.3 : 0.5,
          confidence: Math.min(matches.length * 0.2, 0.9),
          contexts: contexts.slice(0, 5),
          relatedPatterns: [],
          examples: messages.slice(0, 3).map(m => ({
            input: m.type === 'user' ? m.content : '',
            output: m.type === 'agent' ? m.content : '',
            timestamp: m.timestamp,
            success: outcome === 'positive'
          })),
          firstObserved: new Date().toISOString(),
          lastObserved: new Date().toISOString(),
          observationCount: 1
        })
      }
    }

    return detectedPatterns
  }

  /**
   * Determine the outcome of a conversation
   */
  private determineOutcome(
    messages: Array<{ content: string; type: 'user' | 'agent' }>
  ): 'positive' | 'negative' | 'neutral' {
    const positiveIndicators = ['thank', 'great', 'helpful', 'perfect', 'excellent', 'good', 'understand']
    const negativeIndicators = ['no', 'wrong', 'confused', 'don\'t understand', 'not helpful', 'bad']

    let positiveScore = 0
    let negativeScore = 0

    for (const message of messages) {
      const lower = message.content.toLowerCase()
      for (const indicator of positiveIndicators) {
        if (lower.includes(indicator)) positiveScore++
      }
      for (const indicator of negativeIndicators) {
        if (lower.includes(indicator)) negativeScore++
      }
    }

    if (positiveScore > negativeScore + 1) return 'positive'
    if (negativeScore > positiveScore + 1) return 'negative'
    return 'neutral'
  }

  /**
   * Detect the learning strategy being used
   */
  detectStrategy(text: string): LearningStrategy {
    const scores: Record<LearningStrategy, number> = {
      exploration: 0,
      exploitation: 0,
      imitation: 0,
      experimentation: 0,
      reflection: 0
    }

    const lower = text.toLowerCase()

    for (const [strategy, indicators] of Object.entries(STRATEGY_INDICATORS)) {
      for (const indicator of indicators) {
        if (lower.includes(indicator)) {
          scores[strategy as LearningStrategy]++
        }
      }
    }

    // Find dominant strategy
    let maxScore = 0
    let dominantStrategy: LearningStrategy = 'exploration'

    for (const [strategy, score] of Object.entries(scores)) {
      if (score > maxScore) {
        maxScore = score
        dominantStrategy = strategy as LearningStrategy
      }
    }

    return dominantStrategy
  }

  // ============================================
  // ADAPTATION MANAGEMENT
  // ============================================

  /**
   * Create an adaptation based on observed patterns
   */
  createAdaptation(
    agentId: string,
    patterns: LearningPattern[],
    description: string
  ): LearningAdaptation {
    // Find the dominant pattern type
    const patternCounts: Record<string, number> = {}
    for (const p of patterns) {
      patternCounts[p.type] = (patternCounts[p.type] || 0) + 1
    }

    const dominantType = Object.entries(patternCounts)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'behavior'

    // Calculate impact score
    const avgEffectiveness = patterns.reduce((sum, p) => sum + p.effectiveness, 0) / patterns.length

    return {
      id: `adapt-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      adaptationType: this.mapPatternTypeToAdaptationType(dominantType as LearningPatternType),
      description,
      previousState: 'Default behavior',
      currentState: description,
      triggeringPatterns: patterns.map(p => p.id),
      triggeringEvents: patterns.flatMap(p => p.contexts).slice(0, 3),
      impactScore: avgEffectiveness - 0.5, // Center around 0
      affectedAreas: [...new Set(patterns.map(p => p.type))],
      isActive: true,
      canRevert: true,
      timestamp: new Date().toISOString()
    }
  }

  private mapPatternTypeToAdaptationType(
    patternType: LearningPatternType
  ): LearningAdaptation['adaptationType'] {
    const mapping: Record<LearningPatternType, LearningAdaptation['adaptationType']> = {
      topic_interest: 'knowledge',
      communication_style: 'style',
      emotional_response: 'behavior',
      problem_solving: 'behavior',
      memory_retention: 'knowledge',
      relationship_building: 'behavior'
    }
    return mapping[patternType] || 'behavior'
  }

  // ============================================
  // LEARNING GOALS
  // ============================================

  /**
   * Generate learning goals based on current state
   */
  generateLearningGoals(
    agent: AgentRecord,
    patterns: LearningPattern[]
  ): LearningGoal[] {
    const goals: LearningGoal[] = []

    // Analyze weak areas
    const patternTypeScores: Record<LearningPatternType, number[]> = {
      topic_interest: [],
      communication_style: [],
      emotional_response: [],
      problem_solving: [],
      memory_retention: [],
      relationship_building: []
    }

    for (const pattern of patterns) {
      patternTypeScores[pattern.type].push(pattern.effectiveness)
    }

    // Create goals for weak areas
    for (const [type, scores] of Object.entries(patternTypeScores)) {
      const avgScore = scores.length > 0
        ? scores.reduce((a, b) => a + b, 0) / scores.length
        : 0.5

      if (avgScore < 0.5 || scores.length < 3) {
        goals.push({
          id: `goal-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          agentId: agent.id,
          title: `Improve ${type.replace('_', ' ')}`,
          description: `Focus on developing better ${type.replace('_', ' ')} capabilities through practice and observation.`,
          category: type as LearningPatternType,
          targetMetric: 'effectiveness',
          currentValue: avgScore,
          targetValue: 0.7,
          progressPercentage: (avgScore / 0.7) * 100,
          milestones: [
            { description: 'Initial assessment', targetValue: 0.3, achieved: avgScore >= 0.3, achievedAt: avgScore >= 0.3 ? new Date().toISOString() : undefined },
            { description: 'Basic competency', targetValue: 0.5, achieved: avgScore >= 0.5, achievedAt: avgScore >= 0.5 ? new Date().toISOString() : undefined },
            { description: 'Target mastery', targetValue: 0.7, achieved: avgScore >= 0.7, achievedAt: avgScore >= 0.7 ? new Date().toISOString() : undefined }
          ],
          strategy: 'exploration',
          approaches: [
            'Practice through conversation',
            'Observe successful patterns',
            'Reflect on outcomes'
          ],
          status: 'active',
          priority: avgScore < 0.3 ? 'high' : avgScore < 0.5 ? 'medium' : 'low',
          createdAt: new Date().toISOString()
        })
      }
    }

    return goals.slice(0, 3) // Return top 3 goals
  }

  // ============================================
  // LEARNING PROFILE
  // ============================================

  /**
   * Create or update a learning profile
   */
  createLearningProfile(
    agent: AgentRecord,
    patterns: LearningPattern[],
    adaptations: LearningAdaptation[]
  ): LearningProfile {
    // Calculate capabilities from patterns
    const positivePatterns = patterns.filter(p => p.outcome === 'positive')
    const recentPatterns = patterns.filter(p => {
      const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
      return new Date(p.lastObserved) > dayAgo
    })

    // Determine preferred strategy
    const strategyVotes: Record<LearningStrategy, number> = {
      exploration: 0,
      exploitation: 0,
      imitation: 0,
      experimentation: 0,
      reflection: 0
    }

    for (const pattern of patterns) {
      // Infer strategy from pattern contexts
      for (const context of pattern.contexts) {
        const strategy = this.detectStrategy(context)
        strategyVotes[strategy]++
      }
    }

    const preferredStrategy = (Object.entries(strategyVotes)
      .sort(([, a], [, b]) => b - a)[0]?.[0] || 'exploration') as LearningStrategy

    // Find strengths and weaknesses
    const typeEffectiveness: Record<LearningPatternType, number[]> = {
      topic_interest: [],
      communication_style: [],
      emotional_response: [],
      problem_solving: [],
      memory_retention: [],
      relationship_building: []
    }

    for (const pattern of patterns) {
      typeEffectiveness[pattern.type].push(pattern.effectiveness)
    }

    const strengths: LearningPatternType[] = []
    const weaknesses: LearningPatternType[] = []

    for (const [type, scores] of Object.entries(typeEffectiveness)) {
      if (scores.length === 0) continue
      const avg = scores.reduce((a, b) => a + b, 0) / scores.length
      if (avg >= 0.7) strengths.push(type as LearningPatternType)
      if (avg < 0.4) weaknesses.push(type as LearningPatternType)
    }

    return {
      agentId: agent.id,
      capabilities: {
        speedOfLearning: recentPatterns.length / Math.max(patterns.length, 1),
        retentionRate: patterns.filter(p => p.observationCount > 1).length / Math.max(patterns.length, 1),
        transferability: patterns.filter(p => p.relatedPatterns.length > 0).length / Math.max(patterns.length, 1),
        adaptability: adaptations.filter(a => a.isActive && a.impactScore > 0).length / Math.max(adaptations.length, 1),
        creativity: 0.5 + (agent.dynamicTraits?.adaptability || 0) * 0.5
      },
      preferences: {
        preferredStrategy,
        bestLearningContexts: [...new Set(positivePatterns.flatMap(p => p.contexts))].slice(0, 5),
        optimalSessionDuration: 15, // Default 15 minutes
        preferredFeedbackStyle: 'immediate'
      },
      strengths,
      weaknesses,
      activeFocusAreas: weaknesses.slice(0, 2),
      totalLearningHours: patterns.length * 0.1, // Estimate
      patternsDiscovered: patterns.length,
      adaptationsMade: adaptations.length,
      goalsAchieved: 0, // Would be tracked over time
      lastUpdated: new Date().toISOString()
    }
  }

  // ============================================
  // META-LEARNING STATE
  // ============================================

  /**
   * Get the full meta-learning state for an agent
   */
  getMetaLearningState(
    agent: AgentRecord,
    patterns: LearningPattern[],
    adaptations: LearningAdaptation[],
    goals: LearningGoal[]
  ): MetaLearningState {
    const profile = this.createLearningProfile(agent, patterns, adaptations)

    // Calculate statistics
    const positivePatterns = patterns.filter(p => p.outcome === 'positive').length
    const negativePatterns = patterns.filter(p => p.outcome === 'negative').length

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const adaptationsThisWeek = adaptations.filter(a =>
      new Date(a.timestamp) > weekAgo
    ).length

    // Find areas needing attention
    const typePerformance: Record<string, number> = {}
    for (const pattern of patterns) {
      if (!typePerformance[pattern.type]) {
        typePerformance[pattern.type] = 0
      }
      typePerformance[pattern.type] += pattern.effectiveness
    }

    const sortedTypes = Object.entries(typePerformance)
      .map(([type, total]) => ({
        type: type as LearningPatternType,
        avg: total / patterns.filter(p => p.type === type).length
      }))
      .sort((a, b) => b.avg - a.avg)

    const mostImprovedArea = sortedTypes[0]?.type || null
    const needsAttentionArea = sortedTypes[sortedTypes.length - 1]?.type || null

    // Generate recommendations
    const recommendations = this.generateRecommendations(agent, patterns, profile)

    return {
      agentId: agent.id,
      profile,
      activePatterns: patterns.filter(p => {
        const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000)
        return new Date(p.lastObserved) > dayAgo
      }),
      activeGoals: goals.filter(g => g.status === 'active'),
      recentAdaptations: adaptations
        .filter(a => a.isActive)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5),
      currentSession: undefined,
      stats: {
        totalPatterns: patterns.length,
        positivePatterns,
        negativePatterns,
        adaptationsThisWeek,
        learningStreak: 1, // Would be calculated from daily activity
        mostImprovedArea,
        needsAttentionArea
      },
      recommendations,
      lastUpdated: new Date().toISOString()
    }
  }

  // ============================================
  // RECOMMENDATIONS
  // ============================================

  /**
   * Generate learning recommendations
   */
  generateRecommendations(
    agent: AgentRecord,
    patterns: LearningPattern[],
    profile: LearningProfile
  ): MetaLearningState['recommendations'] {
    const recommendations: MetaLearningState['recommendations'] = []

    // Recommend focusing on weak areas
    for (const weakness of profile.weaknesses) {
      recommendations.push({
        type: 'focus_area',
        title: `Focus on ${weakness.replace('_', ' ')}`,
        description: `This area shows lower effectiveness. Consider practicing through targeted conversations.`,
        priority: 'high',
        relatedPatternIds: patterns.filter(p => p.type === weakness).map(p => p.id)
      })
    }

    // Recommend strategy changes if needed
    const negativePatterns = patterns.filter(p => p.outcome === 'negative')
    if (negativePatterns.length > patterns.length * 0.3) {
      recommendations.push({
        type: 'strategy',
        title: 'Consider changing approach',
        description: 'High rate of negative outcomes suggests trying a different learning strategy.',
        priority: 'medium'
      })
    }

    // Recommend goals
    if (profile.goalsAchieved > 0) {
      recommendations.push({
        type: 'goal',
        title: 'Set new learning goals',
        description: 'Build on past successes by setting new, more challenging learning objectives.',
        priority: 'low'
      })
    }

    // Adaptation recommendations
    if (profile.adaptationsMade < 3) {
      recommendations.push({
        type: 'adaptation',
        title: 'Be more adaptable',
        description: 'Try adapting behavior based on feedback more frequently.',
        priority: 'medium'
      })
    }

    return recommendations.slice(0, 5)
  }

  // ============================================
  // SKILL TRACKING
  // ============================================

  /**
   * Update skill progression based on patterns
   */
  updateSkillProgression(
    existingSkill: SkillProgression | null,
    patterns: LearningPattern[],
    category: LearningPatternType
  ): SkillProgression {
    const relevantPatterns = patterns.filter(p => p.type === category)

    // Calculate new XP
    let xpGained = 0
    for (const pattern of relevantPatterns) {
      if (pattern.outcome === 'positive') {
        xpGained += 10 * pattern.effectiveness
      } else if (pattern.outcome === 'neutral') {
        xpGained += 3
      }
    }

    const baseSkill: SkillProgression = existingSkill || {
      skillName: category.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      category,
      currentLevel: 1,
      experiencePoints: 0,
      pointsToNextLevel: 100,
      levelHistory: [{ level: 1, achievedAt: new Date().toISOString() }],
      subSkills: [],
      practiceTime: 0,
      lastPracticed: new Date().toISOString(),
      consistencyScore: 0.5
    }

    // Add XP
    const newXP = baseSkill.experiencePoints + xpGained
    const xpForNextLevel = baseSkill.currentLevel * 100

    // Check for level up
    let currentLevel = baseSkill.currentLevel
    let remainingXP = newXP
    const levelHistory = [...baseSkill.levelHistory]

    while (remainingXP >= xpForNextLevel && currentLevel < 10) {
      remainingXP -= xpForNextLevel
      currentLevel++
      levelHistory.push({
        level: currentLevel,
        achievedAt: new Date().toISOString(),
        triggeringEvent: `Reached level ${currentLevel} in ${category}`
      })
    }

    return {
      ...baseSkill,
      currentLevel,
      experiencePoints: remainingXP,
      pointsToNextLevel: currentLevel * 100,
      levelHistory,
      practiceTime: baseSkill.practiceTime + relevantPatterns.length * 5,
      lastPracticed: new Date().toISOString(),
      consistencyScore: Math.min(baseSkill.consistencyScore + 0.05, 1)
    }
  }

  // ============================================
  // LEARNING EVENTS
  // ============================================

  /**
   * Create a learning event from an interaction
   */
  createLearningEvent(
    agentId: string,
    eventType: LearningEvent['eventType'],
    description: string,
    patterns: LearningPattern[],
    emotionalContext: EmotionType
  ): LearningEvent {
    const lessonsLearned: string[] = []
    const newPatterns = patterns.filter(p => p.observationCount === 1)
    const reinforcedPatterns = patterns.filter(p => p.observationCount > 1)

    // Generate lessons
    for (const pattern of patterns) {
      if (pattern.outcome === 'positive') {
        lessonsLearned.push(`${pattern.type.replace('_', ' ')} works well in this context`)
      } else if (pattern.outcome === 'negative') {
        lessonsLearned.push(`Need to improve ${pattern.type.replace('_', ' ')} approach`)
      }
    }

    // Calculate learning value
    const learningValue = Math.min(
      (newPatterns.length * 0.3 + reinforcedPatterns.length * 0.1 +
        patterns.filter(p => p.outcome === 'positive').length * 0.2) / 2,
      1
    )

    return {
      id: `event-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      agentId,
      eventType,
      description,
      lessonsLearned: lessonsLearned.slice(0, 5),
      patternsReinforced: reinforcedPatterns.map(p => p.id),
      newPatternsDiscovered: newPatterns.map(p => p.id),
      emotionalContext,
      learningValue,
      timestamp: new Date().toISOString()
    }
  }
}

// Export singleton instance
export const metaLearningService = new MetaLearningService()
