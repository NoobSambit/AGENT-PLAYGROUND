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
  LearningProfile,
  MetaLearningState,
  LearningEvent,
  SkillProgression,
  LearningObservation,
  LearningTaskType,
  LearningStrategySignal
} from '@/types/metaLearning'
import { AgentRecord, EmotionType } from '@/types/database'

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

const EMOTIONAL_SUPPORT_KEYWORDS = [
  'stressed', 'overwhelmed', 'anxious', 'upset', 'sad', 'frustrated', 'burned out', 'panic', 'nervous', 'worried'
]

const MEMORY_RECALL_KEYWORDS = [
  'remember', 'recall', 'what is my', 'what did i', 'who am i', 'my name', 'did i mention'
]

const CREATIVE_KEYWORDS = [
  'idea', 'brainstorm', 'concept', 'creative', 'name ideas', 'feature ideas', 'tagline', 'campaign'
]

const FACTUAL_KEYWORDS = [
  'what is', 'explain', 'compare', 'difference', 'pros and cons', 'analyze', 'research'
]

const FEEDBACK_ACK_KEYWORDS = [
  'thanks', 'thank you', 'that helps', 'got it', 'sounds good', 'makes sense', 'perfect', 'great'
]

const POSITIVE_FEEDBACK_INDICATORS = [
  'thanks', 'thank you', 'helpful', 'that helps', 'makes sense', 'perfect', 'great', 'got it', 'exactly'
]

const NEGATIVE_FEEDBACK_INDICATORS = [
  'confused', 'that is wrong', 'wrong', 'not helpful', 'you missed', 'that is not what i asked',
  'too long', 'shorter', 'simpler', 'repeat', 'try again', 'not clear'
]

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

  inferTaskType(text: string): LearningTaskType {
    const lower = text.toLowerCase()

    if (this.isFeedbackAcknowledgement(lower)) {
      return 'feedback_ack'
    }

    if (MEMORY_RECALL_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      return 'memory_recall'
    }

    if (EMOTIONAL_SUPPORT_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      return 'emotional_support'
    }

    if (CREATIVE_KEYWORDS.some((keyword) => lower.includes(keyword))) {
      return 'creative'
    }

    if (FACTUAL_KEYWORDS.some((keyword) => lower.includes(keyword)) || text.includes('?')) {
      return 'factual_help'
    }

    return 'general_chat'
  }

  mapTaskTypeToPatternType(taskType: LearningTaskType): LearningPatternType {
    switch (taskType) {
      case 'memory_recall':
        return 'memory_retention'
      case 'emotional_support':
        return 'emotional_response'
      case 'creative':
        return 'topic_interest'
      case 'factual_help':
        return 'communication_style'
      case 'feedback_ack':
        return 'relationship_building'
      default:
        return 'relationship_building'
    }
  }

  createObservation(params: {
    agentId: string
    prompt: string
    response: string
    userMessageId: string
    agentMessageId: string
    toolsUsed?: string[]
    memoryUsed?: number
  }): LearningObservation {
    const taskType = this.inferTaskType(params.prompt)
    const category = this.mapTaskTypeToPatternType(taskType)
    const strategies: LearningStrategySignal[] = []
    const evidence: LearningObservation['evidence'] = []
    let provisionalScore = 0.5

    const ambiguousPrompt = this.isAmbiguousPrompt(params.prompt)
    const structuredResponse = this.hasStructuredResponse(params.response)
    const empatheticOpening = taskType === 'emotional_support' && this.startsWithEmpathy(params.response)
    const conciseDelivery = this.isSimplePrompt(params.prompt) && params.response.length <= 420
    const veryConciseDelivery = params.response.length <= 180
    const usedMemory = taskType === 'memory_recall' && (params.memoryUsed || 0) > 0
    const usedTools = Boolean(params.toolsUsed?.length)
    const briefRequested = /\bbrief|short|concise|quick\b/i.test(params.prompt)
    const overlongForBrief = briefRequested && params.response.length > 420
    const acknowledgementTurn = taskType === 'feedback_ack'
    const fallbackResponse = params.response.toLowerCase().includes('response error')
      || params.response.toLowerCase().includes('technical difficulties')
      || params.response.toLowerCase().includes('temporarily unable')

    if (ambiguousPrompt && this.asksClarifyingQuestion(params.response)) {
      strategies.push('clarify_first')
      evidence.push({
        code: 'clarify_first',
        label: 'Asked a clarifying question before committing',
        impact: 0.14,
      })
      provisionalScore += 0.14
    }

    if (!strategies.includes('clarify_first')) {
      strategies.push('direct_answer')
    }

    if (structuredResponse) {
      strategies.push('structured_response')
      evidence.push({
        code: 'structured_response',
        label: 'Used a structured response shape',
        impact: 0.1,
      })
      if (taskType === 'factual_help') {
        provisionalScore += 0.1
      }
    }

    if (empatheticOpening) {
      strategies.push('empathetic_opening')
      evidence.push({
        code: 'empathetic_opening',
        label: 'Acknowledged the user emotion before advising',
        impact: 0.12,
      })
      provisionalScore += 0.12
    }

    if (taskType === 'emotional_support' && !empatheticOpening) {
      evidence.push({
        code: 'missing_empathy',
        label: 'Went straight to advice without acknowledging emotion',
        impact: -0.16,
      })
      provisionalScore -= 0.16
    }

    if (usedMemory) {
      strategies.push('memory_recall')
      evidence.push({
        code: 'memory_recall',
        label: 'Used memory on a recall-style request',
        impact: 0.12,
      })
      provisionalScore += 0.12
    }

    if (usedTools) {
      strategies.push('tool_augmented')
      evidence.push({
        code: 'tool_augmented',
        label: 'Used tools during the turn',
        impact: 0.08,
        detail: params.toolsUsed?.join(', '),
      })
      if (taskType === 'factual_help' || params.prompt.length > 180) {
        provisionalScore += 0.08
      }
    }

    if (conciseDelivery) {
      strategies.push('concise_delivery')
      evidence.push({
        code: 'concise_delivery',
        label: 'Kept a simple answer reasonably concise',
        impact: 0.08,
      })
      provisionalScore += 0.08
    }

    if (acknowledgementTurn && veryConciseDelivery) {
      strategies.push('concise_delivery')
      evidence.push({
        code: 'clean_acknowledgement',
        label: 'Handled a feedback acknowledgement without restarting the task',
        impact: 0.16,
      })
      provisionalScore += 0.16
    }

    if (overlongForBrief) {
      evidence.push({
        code: 'ignored_brevity_request',
        label: 'Ignored a direct request for brevity',
        impact: -0.18,
      })
      provisionalScore -= 0.18
    }

    if (
      ambiguousPrompt
      && taskType !== 'feedback_ack'
      && !(taskType === 'emotional_support' && (empatheticOpening || briefRequested))
      && !strategies.includes('clarify_first')
    ) {
      evidence.push({
        code: 'ambiguous_without_clarification',
        label: 'Answered an ambiguous request without clarifying first',
        impact: -0.12,
      })
      provisionalScore -= 0.12
    }

    if (acknowledgementTurn && params.response.length > 260) {
      evidence.push({
        code: 'overextended_acknowledgement',
        label: 'Expanded a simple acknowledgement into a full new answer',
        impact: -0.2,
      })
      provisionalScore -= 0.2
    }

    if (fallbackResponse) {
      evidence.push({
        code: 'fallback_response',
        label: 'Used the generic fallback response',
        impact: -0.4,
      })
      provisionalScore -= 0.4
    }

    const clampedScore = this.clamp01(provisionalScore)
    const resolvedImmediately = fallbackResponse
    const outcome = this.scoreToOutcome(clampedScore)

    const uniqueStrategies = [...new Set(strategies)]

    return {
      id: `observation-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      agentId: params.agentId,
      taskType,
      category,
      strategies: uniqueStrategies,
      summary: this.summarizeObservation(taskType, uniqueStrategies, outcome),
      promptExcerpt: params.prompt.slice(0, 160),
      responseExcerpt: params.response.slice(0, 200),
      provisionalScore: clampedScore,
      finalScore: clampedScore,
      outcome,
      followUpStatus: resolvedImmediately ? 'resolved' : 'pending',
      feedbackSignal: resolvedImmediately ? 'negative' : 'unseen',
      evidence,
      linkedMessageIds: [params.userMessageId, params.agentMessageId],
      createdAt: new Date().toISOString(),
      evaluatedAt: resolvedImmediately ? new Date().toISOString() : undefined,
    }
  }

  resolveObservationWithFollowUp(
    observation: LearningObservation,
    followUpPrompt: string
  ): LearningObservation {
    const lower = followUpPrompt.toLowerCase()
    let finalScore = observation.finalScore
    let feedbackSignal: LearningObservation['feedbackSignal'] = 'neutral'
    const feedbackEvidence: LearningObservation['evidence'] = []

    if (POSITIVE_FEEDBACK_INDICATORS.some((keyword) => lower.includes(keyword))) {
      feedbackSignal = 'positive'
      finalScore += 0.18
      feedbackEvidence.push({
        code: 'positive_follow_up',
        label: 'User gave positive follow-up feedback',
        impact: 0.18,
      })
    } else if (NEGATIVE_FEEDBACK_INDICATORS.some((keyword) => lower.includes(keyword))) {
      feedbackSignal = 'negative'
      finalScore -= 0.22
      feedbackEvidence.push({
        code: 'negative_follow_up',
        label: 'User signaled confusion, correction, or dissatisfaction',
        impact: -0.22,
      })
    } else if (!this.isLikelySameTaskFollowUp(lower)) {
      feedbackSignal = 'neutral'
      finalScore += 0.04
      feedbackEvidence.push({
        code: 'no_pushback',
        label: 'User moved on without obvious pushback',
        impact: 0.04,
      })
    }

    const clampedScore = this.clamp01(finalScore)

    return {
      ...observation,
      finalScore: clampedScore,
      outcome: this.scoreToOutcome(clampedScore),
      summary: this.summarizeObservation(observation.taskType, observation.strategies, this.scoreToOutcome(clampedScore)),
      followUpStatus: 'resolved',
      feedbackSignal,
      evidence: [...observation.evidence, ...feedbackEvidence].slice(-10),
      evaluatedAt: new Date().toISOString(),
    }
  }

  derivePatternsFromObservations(
    observations: LearningObservation[],
    agentId: string
  ): LearningPattern[] {
    const eligible = observations.filter((observation) => (
      observation.followUpStatus === 'resolved'
      || observation.provisionalScore >= 0.78
      || observation.provisionalScore <= 0.24
    ))

    const grouped = new Map<string, LearningObservation[]>()
    for (const observation of eligible) {
      const dominantStrategy = this.getDominantStrategy(observation)
      const key = `${observation.category}:${observation.taskType}:${dominantStrategy}`
      const current = grouped.get(key) || []
      current.push(observation)
      grouped.set(key, current)
    }

    const now = new Date().toISOString()
    const patterns: LearningPattern[] = []

    for (const [key, group] of grouped.entries()) {
      if (group.length < 2) {
        continue
      }

      const [type, taskType, strategy] = key.split(':') as [
        LearningPatternType,
        LearningTaskType,
        LearningStrategySignal
      ]
      const avgScore = group.reduce((sum, item) => sum + item.finalScore, 0) / group.length
      const consistency = group.filter((item) => item.outcome === this.scoreToOutcome(avgScore)).length / group.length
      const confidence = this.clamp01(0.35 + group.length * 0.12 + consistency * 0.18)
      const outcome = this.scoreToOutcome(avgScore)

      patterns.push({
        id: `pattern-${type}-${taskType}-${strategy}`,
        agentId,
        type,
        taskType,
        strategy,
        pattern: this.describePattern(type, taskType, strategy, outcome),
        trigger: `Observed ${group.length} ${taskType.replace('_', ' ')} turns using ${strategy.replace('_', ' ')}`,
        outcome,
        frequency: Math.min(group.length / Math.max(observations.length, 1), 1),
        effectiveness: avgScore,
        confidence,
        evidenceCount: group.length,
        contexts: group.map((item) => item.promptExcerpt).slice(0, 5),
        relatedPatterns: [],
        examples: group.slice(-3).map((item) => ({
          input: item.promptExcerpt,
          output: item.responseExcerpt,
          timestamp: item.createdAt,
          success: item.outcome === 'positive'
        })),
        firstObserved: group[group.length - 1]?.createdAt || now,
        lastObserved: group[0]?.createdAt || now,
        observationCount: group.length,
      })
    }

    return patterns
      .sort((left, right) => (
        (right.evidenceCount || right.observationCount) - (left.evidenceCount || left.observationCount)
      ))
      .slice(0, 12)
  }

  generateAdaptationsFromPatterns(
    agentId: string,
    patterns: LearningPattern[]
  ): LearningAdaptation[] {
    const now = new Date().toISOString()

    return patterns
      .filter((pattern) => (pattern.evidenceCount || 0) >= 2)
      .map((pattern) => {
        const blueprint = this.getAdaptationBlueprint(pattern)

        return {
          id: '',
          agentId,
          adaptationType: blueprint.adaptationType,
          description: blueprint.description,
          instruction: blueprint.instruction,
          previousState: 'Generic response behavior',
          currentState: blueprint.currentState,
          triggeringPatterns: [pattern.id],
          triggeringEvents: pattern.contexts.slice(0, 3),
          impactScore: pattern.effectiveness - 0.5,
          affectedAreas: [pattern.type],
          confidence: pattern.confidence,
          evidenceCount: pattern.evidenceCount,
          evaluation: {
            observations: pattern.evidenceCount || pattern.observationCount,
            positive: pattern.examples.filter((example) => example.success).length,
            negative: pattern.examples.filter((example) => !example.success).length,
            lastEvaluatedAt: pattern.lastObserved,
          },
          isActive: pattern.effectiveness >= 0.45,
          canRevert: true,
          timestamp: now,
        }
      })
      .filter((adaptation) => Boolean(adaptation.description))
  }

  generateAdaptationsFromObservations(
    agentId: string,
    observations: LearningObservation[]
  ): LearningAdaptation[] {
    const now = new Date().toISOString()
    const recent = observations.slice(0, 12)
    const candidates: LearningAdaptation[] = []

    const brevityMisses = recent.filter((observation) => (
      observation.evidence.some((entry) => entry.code === 'ignored_brevity_request')
    ))
    if (brevityMisses.length > 0) {
      candidates.push({
        id: '',
        agentId,
        adaptationType: 'style',
        description: 'Respect explicit brevity requests more strictly.',
        instruction: 'If the user asks for a brief, short, quick, or concise answer, keep the reply compact and avoid adding extra sections.',
        previousState: 'Response length varied mainly by prompt complexity.',
        currentState: 'Treats explicit brevity requests as a hard style constraint.',
        triggeringPatterns: [],
        triggeringEvents: brevityMisses.map((item) => item.promptExcerpt).slice(0, 3),
        impactScore: 0.24,
        affectedAreas: ['communication_style'],
        confidence: this.clamp01(0.58 + brevityMisses.length * 0.08),
        evidenceCount: brevityMisses.length,
        evaluation: {
          observations: brevityMisses.length,
          positive: 0,
          negative: brevityMisses.length,
          lastEvaluatedAt: brevityMisses[0]?.evaluatedAt || brevityMisses[0]?.createdAt,
        },
        isActive: true,
        canRevert: true,
        timestamp: now,
      })
    }

    const acknowledgementMisses = recent.filter((observation) => (
      observation.evidence.some((entry) => entry.code === 'overextended_acknowledgement')
    ))
    if (acknowledgementMisses.length > 0) {
      candidates.push({
        id: '',
        agentId,
        adaptationType: 'behavior',
        description: 'Keep acknowledgement turns short unless the user asks for more.',
        instruction: 'When the user is only acknowledging or thanking you, reply briefly and do not restart the larger task unless invited.',
        previousState: 'Acknowledgement turns often re-opened the larger conversation.',
        currentState: 'Acknowledgement turns default to a short close-out.',
        triggeringPatterns: [],
        triggeringEvents: acknowledgementMisses.map((item) => item.promptExcerpt).slice(0, 3),
        impactScore: 0.2,
        affectedAreas: ['relationship_building'],
        confidence: this.clamp01(0.56 + acknowledgementMisses.length * 0.08),
        evidenceCount: acknowledgementMisses.length,
        evaluation: {
          observations: acknowledgementMisses.length,
          positive: 0,
          negative: acknowledgementMisses.length,
          lastEvaluatedAt: acknowledgementMisses[0]?.evaluatedAt || acknowledgementMisses[0]?.createdAt,
        },
        isActive: true,
        canRevert: true,
        timestamp: now,
      })
    }

    const empathyMisses = recent.filter((observation) => (
      observation.evidence.some((entry) => entry.code === 'missing_empathy')
    ))
    if (empathyMisses.length > 0) {
      candidates.push({
        id: '',
        agentId,
        adaptationType: 'behavior',
        description: 'Acknowledge emotion before giving advice on support-heavy turns.',
        instruction: 'If the user sounds stressed, embarrassed, upset, or vulnerable, start with a brief acknowledgement before moving into steps or advice.',
        previousState: 'Support-oriented turns often jumped straight to advice.',
        currentState: 'Support-oriented turns start with a short emotional acknowledgement.',
        triggeringPatterns: [],
        triggeringEvents: empathyMisses.map((item) => item.promptExcerpt).slice(0, 3),
        impactScore: 0.22,
        affectedAreas: ['emotional_response'],
        confidence: this.clamp01(0.56 + empathyMisses.length * 0.08),
        evidenceCount: empathyMisses.length,
        evaluation: {
          observations: empathyMisses.length,
          positive: 0,
          negative: empathyMisses.length,
          lastEvaluatedAt: empathyMisses[0]?.evaluatedAt || empathyMisses[0]?.createdAt,
        },
        isActive: true,
        canRevert: true,
        timestamp: now,
      })
    }

    return candidates
  }

  buildPromptContext(adaptations: LearningAdaptation[]): string | undefined {
    const active = adaptations
      .filter((adaptation) => adaptation.isActive && (adaptation.confidence || 0) >= 0.45)
      .sort((left, right) => (right.impactScore + (right.confidence || 0)) - (left.impactScore + (left.confidence || 0)))
      .slice(0, 3)

    if (active.length === 0) {
      return undefined
    }

    return active
      .map((adaptation, index) => (
        `${index + 1}. ${adaptation.instruction || adaptation.currentState} ` +
        `(confidence ${(adaptation.confidence || 0).toFixed(2)}, evidence ${adaptation.evidenceCount || 0})`
      ))
      .join('\n')
  }

  updateSkillFromObservation(
    existingSkill: SkillProgression | null,
    observation: LearningObservation
  ): SkillProgression {
    const baseSkill: SkillProgression = existingSkill || {
      skillName: observation.category.replace('_', ' ').replace(/\b\w/g, c => c.toUpperCase()),
      category: observation.category,
      currentLevel: 1,
      experiencePoints: 0,
      pointsToNextLevel: 100,
      levelHistory: [{ level: 1, achievedAt: new Date().toISOString() }],
      subSkills: [],
      practiceTime: 0,
      lastPracticed: new Date().toISOString(),
      consistencyScore: 0.4
    }

    const xpGained = Math.max(
      2,
      Math.round(
        6
        + observation.finalScore * 8
        + (observation.followUpStatus === 'resolved' ? 3 : 0)
      )
    )

    const totalXp = baseSkill.experiencePoints + xpGained
    let currentLevel = baseSkill.currentLevel
    let remainingXP = totalXp
    const levelHistory = [...baseSkill.levelHistory]

    while (remainingXP >= currentLevel * 100 && currentLevel < 10) {
      remainingXP -= currentLevel * 100
      currentLevel++
      levelHistory.push({
        level: currentLevel,
        achievedAt: new Date().toISOString(),
        triggeringEvent: `Observed ${observation.category} improvement on a ${observation.taskType.replace('_', ' ')} turn`
      })
    }

    return {
      ...baseSkill,
      currentLevel,
      experiencePoints: remainingXP,
      pointsToNextLevel: currentLevel * 100,
      levelHistory,
      practiceTime: baseSkill.practiceTime + 5,
      lastPracticed: new Date().toISOString(),
      consistencyScore: Math.min(baseSkill.consistencyScore + 0.04, 1)
    }
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
    adaptations: LearningAdaptation[],
    observations: LearningObservation[]
  ): LearningProfile {
    if (observations.length === 0 && patterns.length === 0 && adaptations.length === 0) {
      return {
        agentId: agent.id,
        capabilities: {
          speedOfLearning: 0,
          retentionRate: 0,
          transferability: 0,
          adaptability: 0,
          creativity: 0
        },
        preferences: {
          preferredStrategy: 'exploration',
          bestLearningContexts: [],
          optimalSessionDuration: 15,
          preferredFeedbackStyle: 'immediate'
        },
        strengths: [],
        weaknesses: [],
        activeFocusAreas: [],
        totalLearningHours: 0,
        patternsDiscovered: 0,
        adaptationsMade: 0,
        goalsAchieved: 0,
        lastUpdated: new Date().toISOString()
      }
    }

    // Calculate capabilities from patterns
    const positivePatterns = patterns.filter(p => p.outcome === 'positive')
    const recentObservations = observations.filter((observation) => {
      const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
      return new Date(observation.createdAt) > weekAgo
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
        speedOfLearning: recentObservations.filter(o => o.followUpStatus === 'resolved').length / Math.max(observations.length, 1),
        retentionRate: observations.filter(o => o.taskType === 'memory_recall' && o.finalScore >= 0.6).length
          / Math.max(observations.filter(o => o.taskType === 'memory_recall').length, 1),
        transferability: patterns.filter(p => p.confidence >= 0.55).length / Math.max(patterns.length, 1),
        adaptability: adaptations.filter(a => a.isActive && a.impactScore > 0).length / Math.max(adaptations.length, 1),
        creativity: this.clamp01(
          0.35
          + (observations.filter(o => o.taskType === 'creative' && o.finalScore >= 0.6).length / Math.max(observations.length, 1)) * 0.35
          + ((agent.dynamicTraits?.adaptability || 0) * 0.3)
        )
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
      totalLearningHours: observations.length * 0.05,
      patternsDiscovered: patterns.length,
      adaptationsMade: adaptations.length,
      goalsAchieved: 0,
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
    goals: LearningGoal[],
    observations: LearningObservation[]
  ): MetaLearningState {
    const profile = this.createLearningProfile(agent, patterns, adaptations, observations)

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
    const needsAttentionArea = sortedTypes.length > 1 ? sortedTypes[sortedTypes.length - 1]?.type || null : null

    // Generate recommendations
    const recommendations = this.generateRecommendations(agent, patterns, profile, observations, adaptations)
    const currentSession = this.buildCurrentSession(agent.id, observations, patterns, adaptations)
    const resolvedObservations = observations.filter(o => o.followUpStatus === 'resolved').length
    const pendingObservations = observations.filter(o => o.followUpStatus === 'pending').length

    return {
      agentId: agent.id,
      profile,
      activePatterns: patterns.filter(p => {
        const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
        return new Date(p.lastObserved) > threeDaysAgo
      }),
      activeGoals: goals.filter(g => g.status === 'active'),
      recentAdaptations: adaptations
        .filter(a => a.isActive)
        .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
        .slice(0, 5),
      recentObservations: observations.slice(0, 6),
      currentSession,
      stats: {
        totalPatterns: patterns.length,
        positivePatterns,
        negativePatterns,
        adaptationsThisWeek,
        learningStreak: this.calculateLearningStreak(observations),
        resolvedObservations,
        pendingObservations,
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
    profile: LearningProfile,
    observations: LearningObservation[],
    adaptations: LearningAdaptation[]
  ): MetaLearningState['recommendations'] {
    const recommendations: MetaLearningState['recommendations'] = []

    if (patterns.length === 0 && observations.length === 0 && adaptations.length === 0) {
      return recommendations
    }

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

    if (observations.some(observation => (
      observation.followUpStatus === 'resolved'
      && observation.feedbackSignal === 'negative'
      && observation.strategies.includes('direct_answer')
    ))) {
      recommendations.push({
        type: 'strategy',
        title: 'Clarify ambiguous requests earlier',
        description: 'Recent follow-up feedback suggests the agent sometimes answers before narrowing the ask.',
        priority: 'high'
      })
    }

    const brevityMisses = observations.filter((observation) => (
      observation.followUpStatus === 'resolved'
      && observation.evidence.some((entry) => entry.code === 'ignored_brevity_request')
    ))
    if (brevityMisses.length > 0) {
      recommendations.push({
        type: 'focus_area',
        title: 'Respect brevity requests more consistently',
        description: 'Recent turns show the agent can still overshoot when the user explicitly asks for a short answer.',
        priority: 'high'
      })
    }

    const acknowledgementMisses = observations.filter((observation) => (
      observation.followUpStatus === 'resolved'
      && observation.evidence.some((entry) => entry.code === 'overextended_acknowledgement')
    ))
    if (acknowledgementMisses.length > 0) {
      recommendations.push({
        type: 'focus_area',
        title: 'Keep acknowledgement turns short',
        description: 'A few recent turns expanded simple thank-you messages into unnecessary new advice.',
        priority: 'medium'
      })
    }

    const empathyMisses = observations.filter((observation) => (
      observation.followUpStatus === 'resolved'
      && observation.evidence.some((entry) => entry.code === 'missing_empathy')
    ))
    if (empathyMisses.length > 0) {
      recommendations.push({
        type: 'focus_area',
        title: 'Lead with empathy on stress-heavy turns',
        description: 'Support-oriented conversations improve when the agent acknowledges the feeling before moving into actions.',
        priority: 'high'
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
    if (adaptations.filter(adaptation => adaptation.isActive).length === 0) {
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

  private isAmbiguousPrompt(text: string): boolean {
    const lower = text.toLowerCase().trim()
    if (lower.length < 18) {
      return true
    }

    return (
      /(?:something|anything|stuff|this|that)\b/.test(lower)
      && !/[0-9]/.test(lower)
      && !lower.includes('?')
    )
  }

  private hasStructuredResponse(text: string): boolean {
    return /(^|\n)\s*(?:[-*]\s+|\d+\.\s+)/.test(text) || text.split('\n').length >= 3
  }

  private isFeedbackAcknowledgement(text: string): boolean {
    const lower = text.toLowerCase().trim()
    return lower.length <= 60 && FEEDBACK_ACK_KEYWORDS.some((keyword) => lower.includes(keyword))
  }

  private startsWithEmpathy(text: string): boolean {
    const opening = text.toLowerCase().slice(0, 160)
    return [
      'that sounds',
      'i can see why',
      'sorry',
      'that makes sense',
      'it sounds like',
      'i understand'
    ].some((phrase) => opening.includes(phrase))
  }

  private asksClarifyingQuestion(text: string): boolean {
    const opening = text.toLowerCase().slice(0, 180)
    return opening.includes('?') && (
      opening.includes('do you mean')
      || opening.includes('which')
      || opening.includes('what kind')
      || opening.includes('before i')
      || opening.includes('to make sure')
    )
  }

  private isSimplePrompt(text: string): boolean {
    return text.trim().length <= 120
  }

  private isLikelySameTaskFollowUp(text: string): boolean {
    return text.includes('also')
      || text.includes('can you')
      || text.includes('what about')
      || text.includes('now')
      || text.includes('brief')
      || text.includes('short')
  }

  private clamp01(value: number): number {
    return Math.max(0, Math.min(1, value))
  }

  private scoreToOutcome(score: number): LearningObservation['outcome'] {
    if (score >= 0.63) return 'positive'
    if (score <= 0.42) return 'negative'
    return 'neutral'
  }

  private summarizeObservation(
    taskType: LearningTaskType,
    strategies: LearningStrategySignal[],
    outcome: LearningObservation['outcome']
  ): string {
    const renderedStrategies = strategies
      .filter((strategy) => strategy !== 'direct_answer')
      .map((strategy) => strategy.replace('_', ' '))
      .join(', ')

    if (!renderedStrategies) {
      return `${taskType.replace('_', ' ')} turn ended ${outcome}`
    }

    return `${taskType.replace('_', ' ')} turn used ${renderedStrategies} and ended ${outcome}`
  }

  private getDominantStrategy(observation: LearningObservation): LearningStrategySignal {
    if (observation.taskType === 'memory_recall' && observation.strategies.includes('memory_recall')) {
      return 'memory_recall'
    }

    if (observation.taskType === 'emotional_support' && observation.strategies.includes('empathetic_opening')) {
      return 'empathetic_opening'
    }

    const preferredOrder: LearningStrategySignal[] = [
      'clarify_first',
      'memory_recall',
      'empathetic_opening',
      'structured_response',
      'tool_augmented',
      'concise_delivery',
      'direct_answer'
    ]

    return preferredOrder.find((strategy) => observation.strategies.includes(strategy)) || 'direct_answer'
  }

  private describePattern(
    type: LearningPatternType,
    taskType: LearningTaskType,
    strategy: LearningStrategySignal,
    outcome: LearningPattern['outcome']
  ): string {
    const taskLabel = taskType.replace('_', ' ')

    if (strategy === 'clarify_first') {
      return outcome === 'positive'
        ? `Clarifying first improves ${taskLabel} conversations`
        : `Clarifying first is underperforming in ${taskLabel} conversations`
    }

    if (strategy === 'structured_response') {
      return outcome === 'positive'
        ? `Structured responses work well for ${taskLabel} requests`
        : `Structured responses need refinement for ${taskLabel} requests`
    }

    if (strategy === 'empathetic_opening') {
      return outcome === 'positive'
        ? 'Empathy-first replies improve emotional support turns'
        : 'Empathy-first replies are not landing consistently yet'
    }

    if (strategy === 'memory_recall') {
      return outcome === 'positive'
        ? 'Using memory improves recall-based conversations'
        : 'Memory recall support is not reliable enough yet'
    }

    if (strategy === 'tool_augmented') {
      return outcome === 'positive'
        ? 'Tool-assisted answers improve factual or complex tasks'
        : 'Tool-assisted answers still need better follow-through'
    }

    if (strategy === 'concise_delivery') {
      return outcome === 'positive'
        ? `Concise delivery works well for ${taskLabel} turns`
        : `Concise delivery is leaving ${taskLabel} turns underspecified`
    }

    return outcome === 'positive'
      ? `${type.replace('_', ' ')} is trending positively during ${taskLabel} turns`
      : `${type.replace('_', ' ')} needs work during ${taskLabel} turns`
  }

  private getAdaptationBlueprint(pattern: LearningPattern): {
    adaptationType: LearningAdaptation['adaptationType']
    description: string
    currentState: string
    instruction: string
  } {
    const taskLabel = (pattern.taskType || 'general_chat').replace('_', ' ')

    if (pattern.strategy === 'clarify_first') {
      return {
        adaptationType: 'style',
        description: `Clarify ambiguous ${taskLabel} requests before answering fully.`,
        currentState: 'Uses a short clarifying question when user intent is fuzzy.',
        instruction: 'When the user request is ambiguous, ask one narrowing question before giving a full answer.',
      }
    }

    if (pattern.strategy === 'structured_response') {
      return {
        adaptationType: 'style',
        description: `Use structured responses for ${taskLabel} requests.`,
        currentState: 'Answers complex requests with a compact summary and ordered steps.',
        instruction: 'For problem-solving or complex factual requests, respond with a short framing sentence and a clearly structured list.',
      }
    }

    if (pattern.strategy === 'empathetic_opening') {
      return {
        adaptationType: 'behavior',
        description: 'Lead with emotional acknowledgement on support-oriented turns.',
        currentState: 'Acknowledges the user emotion before shifting into advice or next steps.',
        instruction: 'When the user sounds stressed or vulnerable, acknowledge the feeling first, then offer practical help.',
      }
    }

    if (pattern.strategy === 'memory_recall') {
      return {
        adaptationType: 'knowledge',
        description: 'Use stored memory directly on recall requests.',
        currentState: 'Answers recall-style questions from memory before asking the user to repeat facts.',
        instruction: 'On recall questions, prefer retrieved memory and answer directly when confidence is reasonable.',
      }
    }

    if (pattern.strategy === 'tool_augmented') {
      return {
        adaptationType: 'behavior',
        description: 'Use tools earlier on factual and analysis-heavy turns.',
        currentState: 'Prefers tool assistance for factual, research-like, or long-form analytical requests.',
        instruction: 'Use available tools early for factual, analytical, or high-detail requests instead of relying only on prior context.',
      }
    }

    if (pattern.strategy === 'direct_answer' && pattern.outcome === 'negative') {
      return {
        adaptationType: 'style',
        description: `Avoid jumping straight to an answer on ${taskLabel} turns when uncertainty is high.`,
        currentState: 'Checks for ambiguity before committing to a direct answer.',
        instruction: 'If the request is broad or underspecified, avoid jumping to a polished answer before checking what the user really wants.',
      }
    }

    return {
      adaptationType: this.mapPatternTypeToAdaptationType(pattern.type),
      description: `Adjust ${pattern.type.replace('_', ' ')} behavior using recent evidence.`,
      currentState: `Applies recent ${pattern.type.replace('_', ' ')} lessons during similar turns.`,
      instruction: `Use the recent ${pattern.type.replace('_', ' ')} pattern as a soft preference when similar requests appear.`,
    }
  }

  private buildCurrentSession(
    agentId: string,
    observations: LearningObservation[],
    patterns: LearningPattern[],
    adaptations: LearningAdaptation[]
  ): MetaLearningState['currentSession'] {
    const sessionObservations = observations.filter((observation) => {
      const cutoff = new Date(Date.now() - 45 * 60 * 1000)
      return new Date(observation.createdAt) > cutoff
    }).slice(0, 8)

    if (sessionObservations.length === 0) {
      return undefined
    }

    const focusCounts = new Map<LearningPatternType, number>()
    sessionObservations.forEach((observation) => {
      focusCounts.set(observation.category, (focusCounts.get(observation.category) || 0) + 1)
    })

    const focus = [...focusCounts.entries()].sort((left, right) => right[1] - left[1])[0]?.[0] || 'communication_style'
    const timestamps = sessionObservations.map((observation) => new Date(observation.createdAt).getTime())
    const duration = Math.max(5, Math.round((Math.max(...timestamps) - Math.min(...timestamps)) / 60000) || sessionObservations.length * 4)

    return {
      id: `session-${agentId}`,
      agentId,
      focus,
      activitiesCompleted: sessionObservations.map((observation) => ({
        type: observation.taskType,
        description: observation.summary,
        outcome: observation.outcome,
        timestamp: observation.createdAt,
      })),
      insights: sessionObservations
        .flatMap((observation) => observation.evidence.map((entry) => entry.label))
        .slice(0, 5),
      patternsDiscovered: patterns.slice(0, 3).map((pattern) => pattern.id),
      adaptationsMade: adaptations.filter((adaptation) => adaptation.isActive).slice(0, 3).map((adaptation) => adaptation.id),
      duration,
      effectivenessScore: sessionObservations.reduce((sum, observation) => sum + observation.finalScore, 0) / sessionObservations.length,
      startedAt: new Date(Math.min(...timestamps)).toISOString(),
      endedAt: new Date(Math.max(...timestamps)).toISOString(),
    }
  }

  private calculateLearningStreak(observations: LearningObservation[]): number {
    const uniqueDays = [...new Set(
      observations.map((observation) => observation.createdAt.split('T')[0])
    )].sort().reverse()

    if (uniqueDays.length === 0) {
      return 0
    }

    let streak = 0
    let cursor = new Date()
    cursor.setUTCHours(0, 0, 0, 0)

    for (const day of uniqueDays) {
      const expected = cursor.toISOString().split('T')[0]
      if (day !== expected) {
        break
      }
      streak++
      cursor = new Date(cursor.getTime() - 24 * 60 * 60 * 1000)
    }

    return streak
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
