// Achievement Service - Phase 1 Feature 2
// Handles achievement tracking, XP calculation, and leveling
// Zero API cost - uses stored metrics for calculations

import {
  AgentRecord,
  AgentProgress,
  AgentStats,
  Achievement,
  UnlockedAchievement
} from '@/types/database'

import {
  ACHIEVEMENTS,
  getAchievementById,
  calculateLevel,
  calculateNextLevelXP,
  calculateLevelProgress,
  MAX_LEVEL,
  BASE_XP_PER_LEVEL
} from '@/lib/constants/achievements'

// Default stats for new agents
export const DEFAULT_AGENT_STATS: AgentStats = {
  conversationCount: 0,
  totalMessages: 0,
  uniqueTopics: [],
  uniqueWords: 0,
  questionsAsked: 0,
  emotionRecognitions: 0,
  relationshipsFormed: 0,
  dreamsGenerated: 0,
  creativeWorksCreated: 0,
  journalEntries: 0,
  scienceTopics: 0,
  artTopics: 0,
  philosophyTopics: 0,
  helpfulResponses: 0,
  longestConversation: 0,
  consecutiveDays: 0,
  lastActiveDate: new Date().toISOString().split('T')[0]
}

// Default progress for new agents
export const DEFAULT_AGENT_PROGRESS: AgentProgress = {
  level: 1,
  experiencePoints: 0,
  nextLevelXP: BASE_XP_PER_LEVEL,
  achievements: {},
  skillPoints: 0,
  allocatedSkills: {}
}

/**
 * AchievementService handles achievement tracking, XP, and leveling
 */
export class AchievementService {
  /**
   * Create default progress for a new agent
   */
  createDefaultProgress(): AgentProgress {
    return { ...DEFAULT_AGENT_PROGRESS, nextLevelXP: calculateNextLevelXP(1) }
  }

  /**
   * Create default stats for a new agent
   */
  createDefaultStats(): AgentStats {
    return { ...DEFAULT_AGENT_STATS, lastActiveDate: new Date().toISOString().split('T')[0] }
  }

  /**
   * Check all achievements and return newly unlocked ones
   */
  checkAchievements(agent: AgentRecord): Achievement[] {
    const progress = agent.progress || this.createDefaultProgress()
    const stats = agent.stats || this.createDefaultStats()
    const newlyUnlocked: Achievement[] = []

    for (const achievement of ACHIEVEMENTS) {
      // Skip if already unlocked
      if (progress.achievements[achievement.id]) continue

      // Check if requirement is met
      const isMet = this.checkRequirement(achievement, stats, progress)

      if (isMet) {
        newlyUnlocked.push(achievement)
      }
    }

    return newlyUnlocked
  }

  /**
   * Unlock achievements and award XP
   */
  unlockAchievements(
    currentProgress: AgentProgress,
    achievements: Achievement[]
  ): {
    progress: AgentProgress
    leveledUp: boolean
    oldLevel: number
    newLevel: number
    totalXPGained: number
  } {
    const progress = { ...currentProgress }
    const oldLevel = progress.level
    let totalXPGained = 0

    for (const achievement of achievements) {
      // Add to achievements
      progress.achievements[achievement.id] = {
        unlockedAt: new Date().toISOString()
      }

      // Award XP
      progress.experiencePoints += achievement.rewardXP
      totalXPGained += achievement.rewardXP
    }

    // Recalculate level
    const newLevel = calculateLevel(progress.experiencePoints)
    const leveledUp = newLevel > oldLevel

    // Award skill points for leveling up
    if (leveledUp) {
      progress.skillPoints += (newLevel - oldLevel)
    }

    progress.level = newLevel
    progress.nextLevelXP = calculateNextLevelXP(newLevel)

    return {
      progress,
      leveledUp,
      oldLevel,
      newLevel,
      totalXPGained
    }
  }

  /**
   * Get achievement progress (for partial progress display)
   */
  getAchievementProgress(achievement: Achievement, stats: AgentStats): number {
    const metricValue = this.getMetricValue(achievement.requirement.metric, stats, { level: 1 } as AgentProgress)
    const target = achievement.requirement.target

    if (target === 0) return 0
    return Math.min(100, Math.floor((metricValue / target) * 100))
  }

  /**
   * Update stats based on an interaction
   */
  updateStatsFromInteraction(
    currentStats: AgentStats | undefined,
    interaction: {
      messageContent: string
      isUserMessage: boolean
      topics?: string[]
      isQuestion?: boolean
      isHelpful?: boolean
      emotionsDetected?: number
    }
  ): AgentStats {
    const stats = { ...(currentStats || this.createDefaultStats()) }

    // Update total messages
    stats.totalMessages += 1

    // Update unique words
    const words = interaction.messageContent.toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3)
      .map(w => w.replace(/[^a-z]/g, ''))
      .filter(w => w.length > 0)

    const existingWordCount = stats.uniqueWords || 0
    stats.uniqueWords = existingWordCount + Math.floor(words.length * 0.3) // Estimate new unique words

    // Update topics
    if (interaction.topics) {
      for (const topic of interaction.topics) {
        if (!stats.uniqueTopics.includes(topic)) {
          stats.uniqueTopics.push(topic)

          // Categorize topics
          const lowerTopic = topic.toLowerCase()
          if (this.isScienceTopic(lowerTopic)) {
            stats.scienceTopics += 1
          }
          if (this.isArtTopic(lowerTopic)) {
            stats.artTopics += 1
          }
          if (this.isPhilosophyTopic(lowerTopic)) {
            stats.philosophyTopics += 1
          }
        }
      }
    }

    // Update questions asked
    if (interaction.isQuestion) {
      stats.questionsAsked += 1
    }

    // Update helpful responses
    if (interaction.isHelpful) {
      stats.helpfulResponses += 1
    }

    // Update emotion recognitions
    if (interaction.emotionsDetected) {
      stats.emotionRecognitions += interaction.emotionsDetected
    }

    // Update consecutive days
    const today = new Date().toISOString().split('T')[0]
    if (stats.lastActiveDate !== today) {
      const lastDate = new Date(stats.lastActiveDate)
      const todayDate = new Date(today)
      const daysDiff = Math.floor((todayDate.getTime() - lastDate.getTime()) / (1000 * 60 * 60 * 24))

      if (daysDiff === 1) {
        stats.consecutiveDays += 1
      } else if (daysDiff > 1) {
        stats.consecutiveDays = 1
      }

      stats.lastActiveDate = today
    }

    return stats
  }

  /**
   * Start a new conversation and update stats
   */
  startConversation(currentStats: AgentStats | undefined): AgentStats {
    const stats = { ...(currentStats || this.createDefaultStats()) }
    stats.conversationCount += 1
    return stats
  }

  /**
   * Update longest conversation if current is longer
   */
  updateLongestConversation(currentStats: AgentStats | undefined, messageCount: number): AgentStats {
    const stats = { ...(currentStats || this.createDefaultStats()) }
    if (messageCount > stats.longestConversation) {
      stats.longestConversation = messageCount
    }
    return stats
  }

  /**
   * Record a relationship formed
   */
  recordRelationship(currentStats: AgentStats | undefined): AgentStats {
    const stats = { ...(currentStats || this.createDefaultStats()) }
    stats.relationshipsFormed += 1
    return stats
  }

  /**
   * Record a dream generated
   */
  recordDream(currentStats: AgentStats | undefined): AgentStats {
    const stats = { ...(currentStats || this.createDefaultStats()) }
    stats.dreamsGenerated += 1
    return stats
  }

  /**
   * Record a creative work created
   */
  recordCreativeWork(currentStats: AgentStats | undefined): AgentStats {
    const stats = { ...(currentStats || this.createDefaultStats()) }
    stats.creativeWorksCreated += 1
    return stats
  }

  /**
   * Record a journal entry
   */
  recordJournalEntry(currentStats: AgentStats | undefined): AgentStats {
    const stats = { ...(currentStats || this.createDefaultStats()) }
    stats.journalEntries += 1
    return stats
  }

  /**
   * Allocate skill points to traits
   */
  allocateSkillPoints(
    currentProgress: AgentProgress,
    skill: string,
    points: number
  ): {
    progress: AgentProgress
    success: boolean
    message: string
  } {
    const progress = { ...currentProgress }
    const allocatedPoints = progress.allocatedSkills[skill] || 0
    const maxPointsPerSkill = 5

    if (points > progress.skillPoints) {
      return {
        progress,
        success: false,
        message: 'Not enough skill points available'
      }
    }

    if (allocatedPoints + points > maxPointsPerSkill) {
      return {
        progress,
        success: false,
        message: `Maximum ${maxPointsPerSkill} points can be allocated to a skill`
      }
    }

    progress.skillPoints -= points
    progress.allocatedSkills[skill] = allocatedPoints + points

    return {
      progress,
      success: true,
      message: `Allocated ${points} point(s) to ${skill}`
    }
  }

  /**
   * Get level info for display
   */
  getLevelInfo(progress: AgentProgress): {
    level: number
    xp: number
    nextLevelXP: number
    progressPercent: number
    skillPoints: number
    isMaxLevel: boolean
  } {
    return {
      level: progress.level,
      xp: progress.experiencePoints,
      nextLevelXP: progress.nextLevelXP,
      progressPercent: calculateLevelProgress(progress.experiencePoints),
      skillPoints: progress.skillPoints,
      isMaxLevel: progress.level >= MAX_LEVEL
    }
  }

  /**
   * Get all achievements for an agent
   */
  getAllAchievements(): Achievement[] {
    return ACHIEVEMENTS
  }

  /**
   * Get unlocked achievements for an agent
   */
  getUnlockedAchievements(progress: AgentProgress): (Achievement & { unlockedAt: string })[] {
    return Object.entries(progress.achievements)
      .map(([id, data]) => {
        const achievement = getAchievementById(id)
        if (!achievement) return null
        return { ...achievement, unlockedAt: data.unlockedAt }
      })
      .filter((a): a is Achievement & { unlockedAt: string } => a !== null)
      .sort((a, b) => new Date(b.unlockedAt).getTime() - new Date(a.unlockedAt).getTime())
  }

  /**
   * Get locked achievements with progress
   */
  getLockedAchievements(
    progress: AgentProgress,
    stats: AgentStats
  ): (Achievement & { progress: number })[] {
    return ACHIEVEMENTS
      .filter(a => !progress.achievements[a.id])
      .map(a => ({
        ...a,
        progress: this.getAchievementProgress(a, stats)
      }))
      .sort((a, b) => b.progress - a.progress)
  }

  /**
   * Get stats summary for display
   */
  getStatsSummary(stats: AgentStats): Record<string, number | string> {
    return {
      'Total Conversations': stats.conversationCount,
      'Total Messages': stats.totalMessages,
      'Unique Topics': stats.uniqueTopics.length,
      'Vocabulary Size': stats.uniqueWords,
      'Relationships': stats.relationshipsFormed,
      'Consecutive Days': stats.consecutiveDays,
      'Last Active': stats.lastActiveDate
    }
  }

  // Private helper methods

  private checkRequirement(
    achievement: Achievement,
    stats: AgentStats,
    progress: AgentProgress
  ): boolean {
    const { requirement } = achievement
    const metricValue = this.getMetricValue(requirement.metric, stats, progress)

    switch (requirement.type) {
      case 'count':
        return metricValue >= requirement.target

      case 'threshold':
        switch (requirement.condition) {
          case 'greater':
            return metricValue > requirement.target
          case 'less':
            return metricValue < requirement.target
          case 'equal':
            return metricValue === requirement.target
          default:
            return metricValue >= requirement.target
        }

      case 'combination':
        return this.checkCombinationRequirement(requirement.metric, stats, progress)

      default:
        return false
    }
  }

  private getMetricValue(
    metric: string,
    stats: AgentStats,
    progress: AgentProgress
  ): number {
    switch (metric) {
      case 'conversationCount':
        return stats.conversationCount
      case 'totalMessages':
        return stats.totalMessages
      case 'uniqueTopicsCount':
        return stats.uniqueTopics.length
      case 'uniqueWords':
        return stats.uniqueWords
      case 'questionsAsked':
        return stats.questionsAsked
      case 'emotionRecognitions':
        return stats.emotionRecognitions
      case 'relationshipsFormed':
        return stats.relationshipsFormed
      case 'dreamsGenerated':
        return stats.dreamsGenerated
      case 'creativeWorksCreated':
        return stats.creativeWorksCreated
      case 'journalEntries':
        return stats.journalEntries
      case 'scienceTopics':
        return stats.scienceTopics
      case 'artTopics':
        return stats.artTopics
      case 'philosophyTopics':
        return stats.philosophyTopics
      case 'helpfulResponses':
        return stats.helpfulResponses
      case 'longestConversation':
        return stats.longestConversation
      case 'consecutiveDays':
        return stats.consecutiveDays
      case 'level':
        return progress.level
      case 'achievementsUnlocked':
        return Object.keys(progress.achievements).length
      default:
        return 0
    }
  }

  private checkCombinationRequirement(
    metric: string,
    stats: AgentStats,
    progress: AgentProgress
  ): boolean {
    switch (metric) {
      case 'renaissance_combo':
        // Must have 50+ in science, art, and philosophy
        return stats.scienceTopics >= 50 &&
          stats.artTopics >= 50 &&
          stats.philosophyTopics >= 50

      case 'philosophical_reflection':
        // Check if philosophy topics > 25 and level > 10
        return stats.philosophyTopics >= 25 && progress.level >= 10

      case 'high_trust_maintained':
        // For future relationship system - for now check relationships > 3
        return stats.relationshipsFormed >= 3

      default:
        return false
    }
  }

  private isScienceTopic(topic: string): boolean {
    const scienceKeywords = [
      'physics', 'chemistry', 'biology', 'math', 'science', 'technology',
      'engineering', 'medicine', 'astronomy', 'quantum', 'evolution',
      'genetics', 'neuroscience', 'climate', 'ecology', 'research'
    ]
    return scienceKeywords.some(k => topic.includes(k))
  }

  private isArtTopic(topic: string): boolean {
    const artKeywords = [
      'art', 'music', 'painting', 'sculpture', 'dance', 'theater',
      'literature', 'poetry', 'film', 'photography', 'design',
      'architecture', 'creative', 'artistic', 'aesthetic', 'culture'
    ]
    return artKeywords.some(k => topic.includes(k))
  }

  private isPhilosophyTopic(topic: string): boolean {
    const philosophyKeywords = [
      'philosophy', 'ethics', 'morality', 'consciousness', 'existence',
      'meaning', 'truth', 'reality', 'knowledge', 'wisdom', 'logic',
      'metaphysics', 'epistemology', 'soul', 'mind', 'free will'
    ]
    return philosophyKeywords.some(k => topic.includes(k))
  }
}

// Export singleton instance
export const achievementService = new AchievementService()
