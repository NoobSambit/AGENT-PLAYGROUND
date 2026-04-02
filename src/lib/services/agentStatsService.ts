import type { AgentStats } from '@/types/database'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'that', 'with', 'this', 'from',
  'have', 'will', 'your', 'about', 'what', 'when', 'where', 'which', 'who', 'why',
  'how', 'can', 'could', 'should', 'would', 'there', 'their', 'they', 'them', 'then',
  'than', 'into', 'onto', 'here', 'just', 'like', 'some', 'more', 'most', 'much',
])

const DEFAULT_AGENT_STATS: AgentStats = {
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
  lastActiveDate: '',
}

function uniqueWordsFromText(text: string): number {
  const words = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word))

  return new Set(words).size
}

function mergeTopics(existing: string[], next: string[]): string[] {
  return [...new Set([...existing, ...next])].slice(0, 50)
}

export class AgentStatsService {
  createDefaultStats(): AgentStats {
    return {
      ...DEFAULT_AGENT_STATS,
      uniqueTopics: [],
    }
  }

  normalizeStats(stats?: AgentStats): AgentStats {
    const base = this.createDefaultStats()
    return {
      ...base,
      ...stats,
      uniqueTopics: [...(stats?.uniqueTopics || [])],
    }
  }

  updateStatsFromInteraction(
    stats: AgentStats,
    interaction: {
      messageContent: string
      topics?: string[]
      isUserMessage?: boolean
      isQuestion?: boolean
      isHelpful?: boolean
      emotionsDetected?: number
    }
  ): AgentStats {
    const nextStats = this.normalizeStats(stats)
    const currentDate = new Date().toISOString().split('T')[0]
    const nextTopics = interaction.topics || []
    const lowerText = interaction.messageContent.toLowerCase()

    nextStats.totalMessages += 1
    nextStats.uniqueTopics = mergeTopics(nextStats.uniqueTopics, nextTopics)
    nextStats.uniqueWords += uniqueWordsFromText(interaction.messageContent)
    nextStats.lastActiveDate = currentDate

    if (interaction.isQuestion) {
      nextStats.questionsAsked += 1
    }

    if (interaction.emotionsDetected) {
      nextStats.emotionRecognitions += interaction.emotionsDetected
    }

    if (interaction.isHelpful) {
      nextStats.helpfulResponses += 1
    }

    if (lowerText.includes('science') || lowerText.includes('physics') || lowerText.includes('biology')) {
      nextStats.scienceTopics += 1
    }

    if (lowerText.includes('art') || lowerText.includes('design') || lowerText.includes('music')) {
      nextStats.artTopics += 1
    }

    if (lowerText.includes('philosophy') || lowerText.includes('ethics') || lowerText.includes('meaning')) {
      nextStats.philosophyTopics += 1
    }

    return nextStats
  }

  startConversation(stats?: AgentStats): AgentStats {
    const nextStats = this.normalizeStats(stats)
    const today = new Date().toISOString().split('T')[0]

    nextStats.conversationCount += 1
    nextStats.consecutiveDays = nextStats.lastActiveDate === today
      ? nextStats.consecutiveDays
      : nextStats.consecutiveDays + 1
    nextStats.lastActiveDate = today

    return nextStats
  }

  updateLongestConversation(stats: AgentStats, messageCount: number): AgentStats {
    return {
      ...stats,
      longestConversation: Math.max(stats.longestConversation, messageCount),
    }
  }

  recordRelationship(stats?: AgentStats): AgentStats {
    const nextStats = this.normalizeStats(stats)
    nextStats.relationshipsFormed += 1
    return nextStats
  }

  recordDream(stats?: AgentStats): AgentStats {
    const nextStats = this.normalizeStats(stats)
    nextStats.dreamsGenerated += 1
    return nextStats
  }

  recordCreativeWork(stats?: AgentStats): AgentStats {
    const nextStats = this.normalizeStats(stats)
    nextStats.creativeWorksCreated += 1
    return nextStats
  }

  recordJournalEntry(stats?: AgentStats): AgentStats {
    const nextStats = this.normalizeStats(stats)
    nextStats.journalEntries += 1
    return nextStats
  }
}

export const agentStatsService = new AgentStatsService()
