/**
 * Journal Service - Phase 2
 *
 * Handles journal entry generation for agents including
 * daily reflections, emotional processing, and goal tracking.
 *
 * Cost: Uses LLM calls (rate limited)
 */

import {
  JournalEntry,
  JournalEntryType,
  JournalMood,
  EmotionType,
  EmotionalState,
  AgentRecord,
  MemoryRecord,
  AgentRelationship,
} from '@/types/database'

// Generate unique IDs
function generateId(): string {
  return `journal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Journal entry type configurations
const JOURNAL_TYPE_CONFIG: Record<JournalEntryType, {
  icon: string
  title: string
  description: string
  promptFocus: string
}> = {
  daily_reflection: {
    icon: '📔',
    title: 'Daily Reflection',
    description: 'Looking back on recent experiences',
    promptFocus: 'Reflect on your recent experiences, conversations, and feelings',
  },
  emotional_processing: {
    icon: '💭',
    title: 'Emotional Processing',
    description: 'Working through complex emotions',
    promptFocus: 'Process and explore your current emotional state and what might be causing it',
  },
  goal_review: {
    icon: '🎯',
    title: 'Goal Review',
    description: 'Tracking progress on goals',
    promptFocus: 'Review your goals, progress made, and areas for growth',
  },
  relationship_thoughts: {
    icon: '👥',
    title: 'Relationship Thoughts',
    description: 'Reflecting on connections with others',
    promptFocus: 'Think about your relationships and interactions with others',
  },
  creative_musings: {
    icon: '🎨',
    title: 'Creative Musings',
    description: 'Exploring creative ideas',
    promptFocus: 'Let your creativity flow and explore new ideas',
  },
  philosophical_pondering: {
    icon: '🤔',
    title: 'Philosophical Pondering',
    description: 'Deep thoughts and questions',
    promptFocus: 'Explore philosophical questions and deep thoughts',
  },
  memory_recap: {
    icon: '🧠',
    title: 'Memory Recap',
    description: 'Reviewing important memories',
    promptFocus: 'Revisit and reflect on significant memories',
  },
  future_plans: {
    icon: '🔮',
    title: 'Future Plans',
    description: 'Looking ahead',
    promptFocus: 'Think about your future, hopes, and plans',
  },
}

// Emotion to mood mapping
const EMOTION_MOOD_MAP: Record<EmotionType, JournalMood[]> = {
  joy: ['excited', 'grateful', 'hopeful'],
  sadness: ['melancholic', 'nostalgic', 'contemplative'],
  anger: ['determined', 'contemplative'],
  fear: ['anxious', 'contemplative', 'hopeful'],
  surprise: ['excited', 'contemplative'],
  trust: ['grateful', 'hopeful', 'contemplative'],
  anticipation: ['excited', 'hopeful', 'determined'],
  disgust: ['contemplative', 'determined'],
}

// Mood descriptors for prompts
const MOOD_DESCRIPTORS: Record<JournalMood, string> = {
  contemplative: 'thoughtful and reflective',
  excited: 'energetic and enthusiastic',
  melancholic: 'wistfully sad but accepting',
  grateful: 'appreciative and thankful',
  anxious: 'worried but working through concerns',
  hopeful: 'optimistic about the future',
  nostalgic: 'fondly remembering the past',
  determined: 'focused and resolute',
}

class JournalService {
  /**
   * Get journal entry type configuration
   */
  getTypeConfig(type: JournalEntryType) {
    return JOURNAL_TYPE_CONFIG[type]
  }

  /**
   * Get all journal entry types
   */
  getAvailableTypes(): Array<{
    type: JournalEntryType
    icon: string
    title: string
    description: string
  }> {
    return Object.entries(JOURNAL_TYPE_CONFIG).map(([type, config]) => ({
      type: type as JournalEntryType,
      ...config,
    }))
  }

  /**
   * Suggest a journal type based on emotional state and context
   */
  suggestJournalType(
    emotionalState?: EmotionalState,
    hasGoals?: boolean,
    hasRelationships?: boolean
  ): JournalEntryType {
    if (!emotionalState) {
      return 'daily_reflection'
    }

    const dominantEmotion = emotionalState.dominantEmotion
    const intensity = emotionalState.currentMood[dominantEmotion]

    // Strong emotions suggest emotional processing
    if (intensity > 0.7) {
      return 'emotional_processing'
    }

    // Suggest based on emotion and context
    switch (dominantEmotion) {
      case 'anticipation':
        return 'future_plans'
      case 'sadness':
        return 'memory_recap'
      case 'trust':
        return hasRelationships ? 'relationship_thoughts' : 'daily_reflection'
      case 'joy':
        return hasGoals ? 'goal_review' : 'creative_musings'
      default:
        return 'daily_reflection'
    }
  }

  /**
   * Determine mood from emotional state
   */
  determineMood(emotionalState?: EmotionalState): JournalMood {
    if (!emotionalState) {
      return 'contemplative'
    }

    const dominantEmotion = emotionalState.dominantEmotion
    const moods = EMOTION_MOOD_MAP[dominantEmotion]

    return moods[Math.floor(Math.random() * moods.length)]
  }

  /**
   * Generate the prompt for journal entry generation
   */
  generateJournalPrompt(
    agent: AgentRecord,
    entryType: JournalEntryType,
    recentMemories?: MemoryRecord[],
    relationships?: AgentRelationship[],
    recentEvents?: string[]
  ): string {
    const config = JOURNAL_TYPE_CONFIG[entryType]
    const mood = this.determineMood(agent.emotionalState)
    const moodDesc = MOOD_DESCRIPTORS[mood]

    let prompt = `Write a journal entry for an AI agent named "${agent.name}".

Entry type: ${config.title}
Focus: ${config.promptFocus}
Current mood: ${moodDesc}

Agent's persona: ${agent.persona}

`

    // Add emotional context
    if (agent.emotionalState) {
      const emotions = Object.entries(agent.emotionalState.currentMood)
        .filter(([, value]) => value > 0.3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([emotion, value]) => `${emotion} (${(value * 100).toFixed(0)}%)`)
        .join(', ')

      prompt += `Current emotional state: ${emotions}\n\n`
    }

    // Add recent memories
    if (recentMemories && recentMemories.length > 0) {
      const memorySnippets = recentMemories
        .slice(0, 5)
        .map(m => `- ${m.summary || m.content.substring(0, 80)}`)
        .join('\n')

      prompt += `Recent memories to reflect on:\n${memorySnippets}\n\n`
    }

    // Add relationships context for relationship-focused entries
    if (entryType === 'relationship_thoughts' && relationships && relationships.length > 0) {
      const relSummaries = relationships
        .slice(0, 3)
        .map(r => {
          const avgMetric = (r.metrics.trust + r.metrics.respect + r.metrics.affection) / 3
          const status = avgMetric > 0.6 ? 'strong' : avgMetric > 0.3 ? 'developing' : 'complex'
          return `- A ${status} relationship with ${r.agentId2} (${r.interactionCount} interactions)`
        })
        .join('\n')

      prompt += `Relationships to consider:\n${relSummaries}\n\n`
    }

    // Add recent events
    if (recentEvents && recentEvents.length > 0) {
      prompt += `Significant recent events:\n${recentEvents.map(e => `- ${e}`).join('\n')}\n\n`
    }

    // Add goals context for goal review
    if (entryType === 'goal_review' && agent.goals && agent.goals.length > 0) {
      prompt += `Current goals:\n${agent.goals.map(g => `- ${g}`).join('\n')}\n\n`
    }

    // Request format
    prompt += `Write in first person from the agent's perspective. Be introspective and authentic.
The entry should be 150-300 words.

Provide the response in JSON format:
{
  "title": "Entry title",
  "content": "The journal entry content",
  "insights": ["insight1", "insight2"],
  "questions": ["questions the agent is pondering"],
  "goals": ["any goals mentioned or set"],
  "gratitudes": ["things the agent is grateful for"]
}`

    return prompt
  }

  /**
   * Parse journal response from LLM
   */
  parseJournalResponse(
    agentId: string,
    entryType: JournalEntryType,
    response: string,
    emotionalState: EmotionalState | undefined,
    recentMemoryIds: string[] = [],
    relationshipIds: string[] = []
  ): JournalEntry {
    const now = new Date().toISOString()
    const mood = this.determineMood(emotionalState)

    try {
      // Try to parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])

        const content = parsed.content || response
        const words = content.split(/\s+/)

        // Extract themes from content
        const themes = this.extractThemes(content)

        return {
          id: generateId(),
          agentId,
          type: entryType,
          title: parsed.title || `${JOURNAL_TYPE_CONFIG[entryType].title}`,
          content,
          mood,
          emotionalState: emotionalState || this.createDefaultEmotionalState(),
          significantEvents: [],
          insights: parsed.insights || [],
          questions: parsed.questions || [],
          goals: parsed.goals || [],
          gratitudes: parsed.gratitudes || [],
          wordCount: words.length,
          themes,
          referencedMemories: recentMemoryIds,
          referencedRelationships: relationshipIds,
          createdAt: now,
          updatedAt: now,
        }
      }
    } catch {
      // JSON parsing failed, use raw response
    }

    // Fallback: use raw response
    const words = response.split(/\s+/)
    return {
      id: generateId(),
      agentId,
      type: entryType,
      title: JOURNAL_TYPE_CONFIG[entryType].title,
      content: response,
      mood,
      emotionalState: emotionalState || this.createDefaultEmotionalState(),
      significantEvents: [],
      insights: [],
      questions: [],
      goals: [],
      gratitudes: [],
      wordCount: words.length,
      themes: this.extractThemes(response),
      referencedMemories: recentMemoryIds,
      referencedRelationships: relationshipIds,
      createdAt: now,
      updatedAt: now,
    }
  }

  /**
   * Create default emotional state
   */
  private createDefaultEmotionalState(): EmotionalState {
    return {
      currentMood: {
        joy: 0.5,
        sadness: 0.2,
        anger: 0.1,
        fear: 0.2,
        surprise: 0.3,
        trust: 0.5,
        anticipation: 0.4,
        disgust: 0.1,
      },
      emotionalBaseline: {
        joy: 0.5,
        sadness: 0.2,
        anger: 0.1,
        fear: 0.2,
        surprise: 0.3,
        trust: 0.5,
        anticipation: 0.4,
        disgust: 0.1,
      },
      lastUpdated: new Date().toISOString(),
      dominantEmotion: 'trust',
    }
  }

  /**
   * Extract themes from content using keyword analysis
   */
  extractThemes(content: string): string[] {
    const themeKeywords: Record<string, string[]> = {
      growth: ['learn', 'grow', 'improve', 'develop', 'progress', 'better'],
      relationships: ['friend', 'connection', 'together', 'relationship', 'bond', 'trust'],
      creativity: ['create', 'imagine', 'idea', 'inspiration', 'art', 'design'],
      self_discovery: ['realize', 'understand', 'discover', 'know', 'myself', 'identity'],
      challenges: ['challenge', 'struggle', 'difficult', 'overcome', 'obstacle'],
      gratitude: ['grateful', 'thankful', 'appreciate', 'blessed', 'fortunate'],
      future: ['future', 'tomorrow', 'plan', 'hope', 'aspire', 'dream'],
      past: ['remember', 'memory', 'past', 'before', 'used to', 'nostalgia'],
      emotions: ['feel', 'emotion', 'mood', 'heart', 'soul'],
      purpose: ['purpose', 'meaning', 'why', 'mission', 'goal'],
    }

    const contentLower = content.toLowerCase()
    const detectedThemes: string[] = []

    for (const [theme, keywords] of Object.entries(themeKeywords)) {
      for (const keyword of keywords) {
        if (contentLower.includes(keyword)) {
          if (!detectedThemes.includes(theme)) {
            detectedThemes.push(theme)
          }
          break
        }
      }
    }

    return detectedThemes.slice(0, 5)
  }

  /**
   * Get journal statistics for an agent
   */
  getJournalStats(entries: JournalEntry[]): {
    totalEntries: number
    byType: Record<string, number>
    byMood: Record<string, number>
    commonThemes: Array<{ theme: string; count: number }>
    averageWordCount: number
    streakDays: number
    recentEntries: JournalEntry[]
  } {
    const byType: Record<string, number> = {}
    const byMood: Record<string, number> = {}
    const themeCounts: Record<string, number> = {}
    let totalWords = 0

    for (const entry of entries) {
      byType[entry.type] = (byType[entry.type] || 0) + 1
      byMood[entry.mood] = (byMood[entry.mood] || 0) + 1
      totalWords += entry.wordCount

      for (const theme of entry.themes) {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1
      }
    }

    const commonThemes = Object.entries(themeCounts)
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    // Calculate streak
    const streakDays = this.calculateJournalStreak(entries)

    const recentEntries = [...entries]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    return {
      totalEntries: entries.length,
      byType,
      byMood,
      commonThemes,
      averageWordCount: entries.length > 0 ? Math.round(totalWords / entries.length) : 0,
      streakDays,
      recentEntries,
    }
  }

  /**
   * Calculate journal streak (consecutive days with entries)
   */
  calculateJournalStreak(entries: JournalEntry[]): number {
    if (entries.length === 0) return 0

    // Sort by date descending
    const sortedEntries = [...entries].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // Get unique dates
    const dates = new Set(
      sortedEntries.map(e => new Date(e.createdAt).toISOString().split('T')[0])
    )

    const today = new Date().toISOString().split('T')[0]
    const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]

    // Check if streak is current (entry today or yesterday)
    if (!dates.has(today) && !dates.has(yesterday)) {
      return 0
    }

    // Count consecutive days
    let streak = 0
    const checkDate = new Date()

    while (true) {
      const dateStr = checkDate.toISOString().split('T')[0]
      if (dates.has(dateStr)) {
        streak++
        checkDate.setDate(checkDate.getDate() - 1)
      } else {
        break
      }
    }

    return streak
  }

  /**
   * Get insights from journal entries
   */
  getJournalInsights(entries: JournalEntry[]): {
    allInsights: string[]
    allQuestions: string[]
    allGoals: string[]
    allGratitudes: string[]
    emotionalTrend: string
  } {
    const allInsights: string[] = []
    const allQuestions: string[] = []
    const allGoals: string[] = []
    const allGratitudes: string[] = []

    // Track emotions over time
    const moodTrend: JournalMood[] = []

    for (const entry of entries) {
      allInsights.push(...entry.insights)
      allQuestions.push(...entry.questions)
      allGoals.push(...entry.goals)
      allGratitudes.push(...entry.gratitudes)
      moodTrend.push(entry.mood)
    }

    // Analyze emotional trend
    let emotionalTrend = 'stable'
    if (moodTrend.length >= 3) {
      const positiveModds = ['excited', 'grateful', 'hopeful']
      const negativeModds = ['melancholic', 'anxious']

      const recentMoods = moodTrend.slice(-3)
      const positiveCount = recentMoods.filter(m => positiveModds.includes(m)).length
      const negativeCount = recentMoods.filter(m => negativeModds.includes(m)).length

      if (positiveCount > negativeCount) {
        emotionalTrend = 'improving'
      } else if (negativeCount > positiveCount) {
        emotionalTrend = 'challenging'
      }
    }

    return {
      allInsights: [...new Set(allInsights)].slice(0, 20),
      allQuestions: [...new Set(allQuestions)].slice(0, 20),
      allGoals: [...new Set(allGoals)].slice(0, 20),
      allGratitudes: [...new Set(allGratitudes)].slice(0, 20),
      emotionalTrend,
    }
  }

  /**
   * Filter journal entries
   */
  filterEntries(
    entries: JournalEntry[],
    filters: {
      type?: JournalEntryType
      mood?: JournalMood
      dateFrom?: string
      dateTo?: string
      searchQuery?: string
    }
  ): JournalEntry[] {
    return entries.filter(entry => {
      if (filters.type && entry.type !== filters.type) return false
      if (filters.mood && entry.mood !== filters.mood) return false

      if (filters.dateFrom) {
        const entryDate = new Date(entry.createdAt)
        const fromDate = new Date(filters.dateFrom)
        if (entryDate < fromDate) return false
      }

      if (filters.dateTo) {
        const entryDate = new Date(entry.createdAt)
        const toDate = new Date(filters.dateTo)
        if (entryDate > toDate) return false
      }

      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        if (
          !entry.title.toLowerCase().includes(query) &&
          !entry.content.toLowerCase().includes(query) &&
          !entry.themes.some(t => t.toLowerCase().includes(query))
        ) {
          return false
        }
      }

      return true
    })
  }
}

// Export singleton instance
export const journalService = new JournalService()

// Export class for testing
export { JournalService }
