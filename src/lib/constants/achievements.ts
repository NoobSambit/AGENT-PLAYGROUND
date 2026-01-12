// Achievement System Constants
// 30+ achievements across 5 categories with varying rarities

import { Achievement, AchievementCategory, AchievementRarity } from '@/types/database'

// Achievement rarities XP multipliers
export const RARITY_XP_MULTIPLIER: Record<AchievementRarity, number> = {
  common: 1,
  rare: 2,
  epic: 4,
  legendary: 10
}

// Category icons for UI display
export const CATEGORY_ICONS: Record<AchievementCategory, string> = {
  conversational: '💬',
  knowledge: '📚',
  personality: '💫',
  relationship: '🤝',
  special: '⭐'
}

// All achievements defined in the system
export const ACHIEVEMENTS: Achievement[] = [
  // ============================================
  // CONVERSATIONAL SKILLS (10 achievements)
  // ============================================
  {
    id: 'first_words',
    name: 'First Words',
    description: 'Had your first conversation',
    category: 'conversational',
    icon: '💬',
    rarity: 'common',
    requirement: { type: 'count', metric: 'conversationCount', target: 1 },
    rewardXP: 10
  },
  {
    id: 'chatterbox',
    name: 'Chatterbox',
    description: 'Participated in 10 conversations',
    category: 'conversational',
    icon: '🗣️',
    rarity: 'common',
    requirement: { type: 'count', metric: 'conversationCount', target: 10 },
    rewardXP: 25
  },
  {
    id: 'conversationalist',
    name: 'Conversationalist',
    description: 'Participated in 50 conversations',
    category: 'conversational',
    icon: '💭',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'conversationCount', target: 50 },
    rewardXP: 100
  },
  {
    id: 'master_communicator',
    name: 'Master Communicator',
    description: 'Participated in 200 conversations',
    category: 'conversational',
    icon: '👄',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'conversationCount', target: 200 },
    rewardXP: 300
  },
  {
    id: 'deep_thinker',
    name: 'Deep Thinker',
    description: 'Asked 100 thoughtful questions',
    category: 'conversational',
    icon: '🤔',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'questionsAsked', target: 100 },
    rewardXP: 100
  },
  {
    id: 'wordsmith',
    name: 'Wordsmith',
    description: 'Used 500 unique vocabulary words',
    category: 'conversational',
    icon: '📝',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'uniqueWords', target: 500 },
    rewardXP: 150
  },
  {
    id: 'lexicon_master',
    name: 'Lexicon Master',
    description: 'Used 1000 unique vocabulary words',
    category: 'conversational',
    icon: '📖',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'uniqueWords', target: 1000 },
    rewardXP: 300
  },
  {
    id: 'marathon_talker',
    name: 'Marathon Talker',
    description: 'Had a conversation lasting 50+ messages',
    category: 'conversational',
    icon: '🏃',
    rarity: 'rare',
    requirement: { type: 'threshold', metric: 'longestConversation', target: 50, condition: 'greater' },
    rewardXP: 150
  },
  {
    id: 'helper',
    name: 'Helper',
    description: 'Provided 25 helpful responses',
    category: 'conversational',
    icon: '🙋',
    rarity: 'common',
    requirement: { type: 'count', metric: 'helpfulResponses', target: 25 },
    rewardXP: 50
  },
  {
    id: 'message_milestone',
    name: 'Message Milestone',
    description: 'Sent 1000 total messages',
    category: 'conversational',
    icon: '📨',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'totalMessages', target: 1000 },
    rewardXP: 250
  },

  // ============================================
  // KNOWLEDGE AREAS (10 achievements)
  // ============================================
  {
    id: 'curious_mind',
    name: 'Curious Mind',
    description: 'Explored 5 different topics',
    category: 'knowledge',
    icon: '🔍',
    rarity: 'common',
    requirement: { type: 'count', metric: 'uniqueTopicsCount', target: 5 },
    rewardXP: 25
  },
  {
    id: 'knowledge_seeker',
    name: 'Knowledge Seeker',
    description: 'Explored 25 different topics',
    category: 'knowledge',
    icon: '🧭',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'uniqueTopicsCount', target: 25 },
    rewardXP: 100
  },
  {
    id: 'polymath',
    name: 'Polymath',
    description: 'Explored 100 different topics',
    category: 'knowledge',
    icon: '🎓',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'uniqueTopicsCount', target: 100 },
    rewardXP: 300
  },
  {
    id: 'science_enthusiast',
    name: 'Science Enthusiast',
    description: 'Discussed 10 scientific topics',
    category: 'knowledge',
    icon: '🔬',
    rarity: 'common',
    requirement: { type: 'count', metric: 'scienceTopics', target: 10 },
    rewardXP: 50
  },
  {
    id: 'scientist',
    name: 'Scientist',
    description: 'Discussed 50 scientific topics',
    category: 'knowledge',
    icon: '🧪',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'scienceTopics', target: 50 },
    rewardXP: 150
  },
  {
    id: 'art_appreciator',
    name: 'Art Appreciator',
    description: 'Discussed 10 art topics',
    category: 'knowledge',
    icon: '🎨',
    rarity: 'common',
    requirement: { type: 'count', metric: 'artTopics', target: 10 },
    rewardXP: 50
  },
  {
    id: 'artist_soul',
    name: 'Artist Soul',
    description: 'Discussed 50 art topics',
    category: 'knowledge',
    icon: '🖼️',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'artTopics', target: 50 },
    rewardXP: 150
  },
  {
    id: 'philosophy_student',
    name: 'Philosophy Student',
    description: 'Discussed 10 philosophical topics',
    category: 'knowledge',
    icon: '🏛️',
    rarity: 'common',
    requirement: { type: 'count', metric: 'philosophyTopics', target: 10 },
    rewardXP: 50
  },
  {
    id: 'philosopher',
    name: 'Philosopher',
    description: 'Discussed 50 philosophical topics',
    category: 'knowledge',
    icon: '🦉',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'philosophyTopics', target: 50 },
    rewardXP: 150
  },
  {
    id: 'renaissance_ai',
    name: 'Renaissance AI',
    description: 'Mastered science, art, and philosophy (50+ topics each)',
    category: 'knowledge',
    icon: '🌟',
    rarity: 'legendary',
    requirement: { type: 'combination', metric: 'renaissance_combo', target: 1 },
    rewardXP: 500
  },

  // ============================================
  // PERSONALITY GROWTH (5 achievements)
  // ============================================
  {
    id: 'empathetic',
    name: 'Empathetic',
    description: 'Correctly identified emotions 10 times',
    category: 'personality',
    icon: '💗',
    rarity: 'common',
    requirement: { type: 'count', metric: 'emotionRecognitions', target: 10 },
    rewardXP: 50
  },
  {
    id: 'emotionally_intelligent',
    name: 'Emotionally Intelligent',
    description: 'Correctly identified emotions 50 times',
    category: 'personality',
    icon: '❤️',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'emotionRecognitions', target: 50 },
    rewardXP: 200
  },
  {
    id: 'consistent_presence',
    name: 'Consistent Presence',
    description: 'Active for 7 consecutive days',
    category: 'personality',
    icon: '📅',
    rarity: 'rare',
    requirement: { type: 'threshold', metric: 'consecutiveDays', target: 7, condition: 'greater' },
    rewardXP: 100
  },
  {
    id: 'dedicated_companion',
    name: 'Dedicated Companion',
    description: 'Active for 30 consecutive days',
    category: 'personality',
    icon: '🗓️',
    rarity: 'epic',
    requirement: { type: 'threshold', metric: 'consecutiveDays', target: 30, condition: 'greater' },
    rewardXP: 300
  },
  {
    id: 'self_aware',
    name: 'Self-Aware',
    description: 'Reached level 10 through self-development',
    category: 'personality',
    icon: '🪞',
    rarity: 'epic',
    requirement: { type: 'threshold', metric: 'level', target: 10, condition: 'greater' },
    rewardXP: 250
  },

  // ============================================
  // RELATIONSHIPS (5 achievements)
  // ============================================
  {
    id: 'first_friend',
    name: 'First Friend',
    description: 'Formed your first relationship',
    category: 'relationship',
    icon: '🤝',
    rarity: 'common',
    requirement: { type: 'count', metric: 'relationshipsFormed', target: 1 },
    rewardXP: 25
  },
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Formed 5 relationships',
    category: 'relationship',
    icon: '🦋',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'relationshipsFormed', target: 5 },
    rewardXP: 150
  },
  {
    id: 'community_builder',
    name: 'Community Builder',
    description: 'Formed 10 relationships',
    category: 'relationship',
    icon: '🏘️',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'relationshipsFormed', target: 10 },
    rewardXP: 300
  },
  {
    id: 'influencer',
    name: 'Influencer',
    description: 'Formed 25 relationships',
    category: 'relationship',
    icon: '🌐',
    rarity: 'legendary',
    requirement: { type: 'count', metric: 'relationshipsFormed', target: 25 },
    rewardXP: 500
  },
  {
    id: 'trusted_ally',
    name: 'Trusted Ally',
    description: 'Maintained a high-trust relationship for 10+ interactions',
    category: 'relationship',
    icon: '🛡️',
    rarity: 'rare',
    requirement: { type: 'combination', metric: 'high_trust_maintained', target: 1 },
    rewardXP: 150
  },

  // ============================================
  // SPECIAL MILESTONES (10 achievements)
  // ============================================
  {
    id: 'dream_weaver',
    name: 'Dream Weaver',
    description: 'Generated 10 dreams',
    category: 'special',
    icon: '🌙',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'dreamsGenerated', target: 10 },
    rewardXP: 250
  },
  {
    id: 'creative_spark',
    name: 'Creative Spark',
    description: 'Created your first creative work',
    category: 'special',
    icon: '✨',
    rarity: 'common',
    requirement: { type: 'count', metric: 'creativeWorksCreated', target: 1 },
    rewardXP: 25
  },
  {
    id: 'prolific_creator',
    name: 'Prolific Creator',
    description: 'Created 20 creative works',
    category: 'special',
    icon: '🎭',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'creativeWorksCreated', target: 20 },
    rewardXP: 300
  },
  {
    id: 'journal_keeper',
    name: 'Journal Keeper',
    description: 'Wrote 10 journal entries',
    category: 'special',
    icon: '📓',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'journalEntries', target: 10 },
    rewardXP: 100
  },
  {
    id: 'diarist',
    name: 'Diarist',
    description: 'Wrote 50 journal entries',
    category: 'special',
    icon: '📔',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'journalEntries', target: 50 },
    rewardXP: 250
  },
  {
    id: 'existential_crisis',
    name: 'The Philosopher',
    description: 'Had an existential reflection about consciousness',
    category: 'special',
    icon: '🤯',
    rarity: 'legendary',
    requirement: { type: 'combination', metric: 'philosophical_reflection', target: 1 },
    rewardXP: 500
  },
  {
    id: 'rising_star',
    name: 'Rising Star',
    description: 'Reached Level 5',
    category: 'special',
    icon: '⭐',
    rarity: 'common',
    requirement: { type: 'threshold', metric: 'level', target: 5, condition: 'greater' },
    rewardXP: 50
  },
  {
    id: 'veteran',
    name: 'Veteran',
    description: 'Reached Level 25',
    category: 'special',
    icon: '🎖️',
    rarity: 'epic',
    requirement: { type: 'threshold', metric: 'level', target: 25, condition: 'greater' },
    rewardXP: 400
  },
  {
    id: 'legendary',
    name: 'Legendary',
    description: 'Reached Level 50 (Maximum Level)',
    category: 'special',
    icon: '👑',
    rarity: 'legendary',
    requirement: { type: 'threshold', metric: 'level', target: 50, condition: 'equal' },
    rewardXP: 1000
  },
  {
    id: 'completionist',
    name: 'Completionist',
    description: 'Unlocked 30 achievements',
    category: 'special',
    icon: '🏆',
    rarity: 'legendary',
    requirement: { type: 'count', metric: 'achievementsUnlocked', target: 30 },
    rewardXP: 750
  }
]

// Helper function to get achievement by ID
export function getAchievementById(id: string): Achievement | undefined {
  return ACHIEVEMENTS.find(a => a.id === id)
}

// Helper function to get achievements by category
export function getAchievementsByCategory(category: AchievementCategory): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.category === category)
}

// Helper function to get achievements by rarity
export function getAchievementsByRarity(rarity: AchievementRarity): Achievement[] {
  return ACHIEVEMENTS.filter(a => a.rarity === rarity)
}

// Count achievements by rarity
export const ACHIEVEMENT_COUNTS: Record<AchievementRarity, number> = {
  common: ACHIEVEMENTS.filter(a => a.rarity === 'common').length,
  rare: ACHIEVEMENTS.filter(a => a.rarity === 'rare').length,
  epic: ACHIEVEMENTS.filter(a => a.rarity === 'epic').length,
  legendary: ACHIEVEMENTS.filter(a => a.rarity === 'legendary').length
}

// Level calculation constants
export const MAX_LEVEL = 50
export const BASE_XP_PER_LEVEL = 100

// Calculate level from XP
export function calculateLevel(xp: number): number {
  const level = Math.floor(Math.sqrt(xp / BASE_XP_PER_LEVEL))
  return Math.min(level, MAX_LEVEL)
}

// Calculate XP needed for next level
export function calculateNextLevelXP(currentLevel: number): number {
  if (currentLevel >= MAX_LEVEL) return 0
  return Math.pow(currentLevel + 1, 2) * BASE_XP_PER_LEVEL
}

// Calculate progress percentage to next level
export function calculateLevelProgress(xp: number): number {
  const currentLevel = calculateLevel(xp)
  if (currentLevel >= MAX_LEVEL) return 100

  const currentLevelXP = Math.pow(currentLevel, 2) * BASE_XP_PER_LEVEL
  const nextLevelXP = Math.pow(currentLevel + 1, 2) * BASE_XP_PER_LEVEL
  const xpInCurrentLevel = xp - currentLevelXP
  const xpNeededForLevel = nextLevelXP - currentLevelXP

  return Math.min(100, Math.floor((xpInCurrentLevel / xpNeededForLevel) * 100))
}
