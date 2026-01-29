// Timeline Service - Phase 1 Feature 4
// Handles timeline event aggregation, clustering, and narrative threads
// Zero API cost - uses existing stored data

import {
  TimelineEvent,
  TimelineEventType,
  TimelineCluster,
  NarrativeThread,
  TimelineFilters,
  AgentRecord,
  MemoryRecord,
  MessageRecord,
  EmotionalEvent
} from '@/types/database'

// Event type icons for UI display
export const EVENT_TYPE_ICONS: Record<TimelineEventType, string> = {
  conversation: '💬',
  memory: '🧠',
  emotion: '❤️',
  relationship: '👥',
  dream: '🌙',
  achievement: '🏆',
  creative: '🎨',
  journal: '📝'
}

// Event type colors for visualization
export const EVENT_TYPE_COLORS: Record<TimelineEventType, string> = {
  conversation: '#3B82F6', // Blue
  memory: '#8B5CF6',       // Purple
  emotion: '#EC4899',      // Pink
  relationship: '#10B981', // Green
  dream: '#6366F1',        // Indigo
  achievement: '#F59E0B',  // Amber
  creative: '#F97316',     // Orange
  journal: '#64748B'       // Slate
}

// Cluster window in milliseconds (1 hour)
const CLUSTER_WINDOW_MS = 60 * 60 * 1000

/**
 * TimelineService handles timeline event aggregation and visualization
 */
export class TimelineService {
  /**
   * Aggregate all events from different sources for an agent
   */
  async aggregateEvents(
    agent: AgentRecord,
    memories: MemoryRecord[],
    messages: MessageRecord[],
    filters?: TimelineFilters
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = []

    // Add conversation events from messages
    const conversationEvents = this.convertMessagesToEvents(agent.id, messages)
    events.push(...conversationEvents)

    // Add memory events
    const memoryEvents = this.convertMemoriesToEvents(agent.id, memories)
    events.push(...memoryEvents)

    // Add emotional events from agent history
    if (agent.emotionalHistory) {
      const emotionalEvents = this.convertEmotionalEventsToTimeline(agent.id, agent.emotionalHistory)
      events.push(...emotionalEvents)
    }

    // Add achievement events from progress
    if (agent.progress?.achievements) {
      const achievementEvents = this.convertAchievementsToEvents(agent.id, agent.progress.achievements)
      events.push(...achievementEvents)
    }

    // Sort by timestamp
    events.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    // Apply filters
    if (filters) {
      return this.applyFilters(events, filters)
    }

    return events
  }

  /**
   * Convert messages to timeline events
   */
  private convertMessagesToEvents(agentId: string, messages: MessageRecord[]): TimelineEvent[] {
    // Group messages by conversation session (messages within 30 mins of each other)
    const sessions: MessageRecord[][] = []
    let currentSession: MessageRecord[] = []

    for (const message of messages) {
      if (currentSession.length === 0) {
        currentSession.push(message)
      } else {
        const lastMessage = currentSession[currentSession.length - 1]
        const timeDiff = new Date(message.timestamp).getTime() - new Date(lastMessage.timestamp).getTime()

        if (timeDiff < 30 * 60 * 1000) { // 30 minutes
          currentSession.push(message)
        } else {
          sessions.push(currentSession)
          currentSession = [message]
        }
      }
    }
    if (currentSession.length > 0) {
      sessions.push(currentSession)
    }

    // Create event for each session
    return sessions.map((session, index) => {
      const firstMessage = session[0]
      const messageCount = session.length
      const topics = this.extractTopicsFromMessages(session)

      return {
        id: `conv-${agentId}-${index}-${firstMessage.timestamp}`,
        agentId,
        type: 'conversation' as TimelineEventType,
        title: `Conversation (${messageCount} messages)`,
        description: session[0].content.substring(0, 100) + (session[0].content.length > 100 ? '...' : ''),
        timestamp: firstMessage.timestamp,
        importance: Math.min(10, Math.ceil(messageCount / 5)), // More messages = higher importance
        metadata: {
          topics,
          participants: [agentId]
        },
        contentRef: {
          collection: 'messages',
          documentId: firstMessage.id
        }
      }
    })
  }

  /**
   * Convert memories to timeline events
   */
  private convertMemoriesToEvents(agentId: string, memories: MemoryRecord[]): TimelineEvent[] {
    return memories
      .filter(m => m.isActive)
      .map(memory => ({
        id: `mem-${memory.id}`,
        agentId,
        type: 'memory' as TimelineEventType,
        title: memory.summary || 'Memory recorded',
        description: memory.content.substring(0, 150) + (memory.content.length > 150 ? '...' : ''),
        timestamp: memory.timestamp,
        importance: memory.importance,
        metadata: {
          topics: memory.keywords
        },
        contentRef: {
          collection: 'memories',
          documentId: memory.id
        }
      }))
  }

  /**
   * Convert emotional events to timeline format
   */
  private convertEmotionalEventsToTimeline(agentId: string, emotionalHistory: EmotionalEvent[]): TimelineEvent[] {
    return emotionalHistory.map(event => ({
      id: `emo-${event.id}`,
      agentId,
      type: 'emotion' as TimelineEventType,
      title: `${this.capitalizeFirst(event.emotion)} (${(event.intensity * 100).toFixed(0)}%)`,
      description: event.context,
      timestamp: event.timestamp,
      importance: Math.ceil(event.intensity * 10),
      metadata: {
        topics: [event.emotion, event.trigger]
      }
    }))
  }

  /**
   * Convert achievements to timeline events
   */
  private convertAchievementsToEvents(
    agentId: string,
    achievements: Record<string, { unlockedAt: string; progress?: number }>
  ): TimelineEvent[] {
    return Object.entries(achievements).map(([achievementId, data]) => ({
      id: `ach-${achievementId}`,
      agentId,
      type: 'achievement' as TimelineEventType,
      title: `Achievement: ${this.formatAchievementName(achievementId)}`,
      description: `Unlocked achievement "${achievementId}"`,
      timestamp: data.unlockedAt,
      importance: 8, // Achievements are important events
      metadata: {
        topics: ['achievement', achievementId]
      }
    }))
  }

  /**
   * Apply filters to events
   */
  private applyFilters(events: TimelineEvent[], filters: TimelineFilters): TimelineEvent[] {
    let filtered = [...events]

    // Filter by types
    if (filters.types && !filters.types.includes('all')) {
      filtered = filtered.filter(e => filters.types.includes(e.type))
    }

    // Filter by date range
    if (filters.dateRange.start) {
      const startDate = new Date(filters.dateRange.start).getTime()
      filtered = filtered.filter(e => new Date(e.timestamp).getTime() >= startDate)
    }
    if (filters.dateRange.end) {
      const endDate = new Date(filters.dateRange.end).getTime()
      filtered = filtered.filter(e => new Date(e.timestamp).getTime() <= endDate)
    }

    // Filter by importance
    if (filters.minImportance > 0) {
      filtered = filtered.filter(e => e.importance >= filters.minImportance)
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      filtered = filtered.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query) ||
        e.metadata.topics?.some(t => t.toLowerCase().includes(query))
      )
    }

    return filtered
  }

  /**
   * Cluster nearby events
   */
  clusterEvents(events: TimelineEvent[]): TimelineCluster[] {
    const clusters: TimelineCluster[] = []
    let currentCluster: TimelineEvent[] = []
    let clusterStart = 0

    for (let i = 0; i < events.length; i++) {
      const event = events[i]
      const eventTime = new Date(event.timestamp).getTime()

      if (currentCluster.length === 0) {
        currentCluster.push(event)
        clusterStart = eventTime
      } else {
        const timeSinceClusterStart = eventTime - clusterStart

        if (timeSinceClusterStart <= CLUSTER_WINDOW_MS) {
          currentCluster.push(event)
        } else {
          // Save current cluster
          clusters.push(this.createCluster(currentCluster))
          // Start new cluster
          currentCluster = [event]
          clusterStart = eventTime
        }
      }
    }

    // Save last cluster
    if (currentCluster.length > 0) {
      clusters.push(this.createCluster(currentCluster))
    }

    return clusters
  }

  /**
   * Create a cluster from events
   */
  private createCluster(events: TimelineEvent[]): TimelineCluster {
    // Find dominant event type
    const typeCounts: Record<string, number> = {}
    events.forEach(e => {
      typeCounts[e.type] = (typeCounts[e.type] || 0) + 1
    })

    const dominantType = Object.entries(typeCounts)
      .sort((a, b) => b[1] - a[1])[0][0] as TimelineEventType

    // Generate summary
    const summary = events.length === 1
      ? events[0].title
      : `${events.length} events: ${Object.entries(typeCounts).map(([t, c]) => `${c} ${t}`).join(', ')}`

    return {
      id: `cluster-${events[0].timestamp}`,
      events,
      startTime: events[0].timestamp,
      endTime: events[events.length - 1].timestamp,
      dominantType,
      summary
    }
  }

  /**
   * Detect narrative threads (recurring topics)
   */
  detectNarrativeThreads(events: TimelineEvent[]): NarrativeThread[] {
    const topicEvents: Map<string, TimelineEvent[]> = new Map()

    // Group events by topics
    for (const event of events) {
      const topics = event.metadata.topics || []
      for (const topic of topics) {
        if (!topicEvents.has(topic)) {
          topicEvents.set(topic, [])
        }
        topicEvents.get(topic)!.push(event)
      }
    }

    // Convert to thread objects (only topics with 3+ events)
    return Array.from(topicEvents.entries())
      .filter(([, events]) => events.length >= 3)
      .map(([topic, events]) => ({
        id: `thread-${topic}`,
        topic,
        events: events.map(e => e.id),
        startTime: events[0].timestamp,
        endTime: events[events.length - 1].timestamp,
        importance: events.reduce((sum, e) => sum + e.importance, 0) / events.length
      }))
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 20) // Limit to top 20 threads
  }

  /**
   * Get temporal insights (activity patterns)
   */
  getTemporalInsights(events: TimelineEvent[]): {
    mostActiveHour: number
    mostActiveDay: string
    totalEvents: number
    eventsByType: Record<TimelineEventType, number>
    averageImportance: number
    peakMoments: TimelineEvent[]
  } {
    const hourCounts: number[] = new Array(24).fill(0)
    const dayCounts: Record<string, number> = {}
    const typeCounts: Record<TimelineEventType, number> = {
      conversation: 0,
      memory: 0,
      emotion: 0,
      relationship: 0,
      dream: 0,
      achievement: 0,
      creative: 0,
      journal: 0
    }

    let totalImportance = 0

    for (const event of events) {
      const date = new Date(event.timestamp)
      const hour = date.getHours()
      const day = date.toLocaleDateString('en-US', { weekday: 'long' })

      hourCounts[hour]++
      dayCounts[day] = (dayCounts[day] || 0) + 1
      typeCounts[event.type]++
      totalImportance += event.importance
    }

    // Find most active hour
    const mostActiveHour = hourCounts.indexOf(Math.max(...hourCounts))

    // Find most active day
    const mostActiveDay = Object.entries(dayCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unknown'

    // Find peak moments (top 5 by importance)
    const peakMoments = [...events]
      .sort((a, b) => b.importance - a.importance)
      .slice(0, 5)

    return {
      mostActiveHour,
      mostActiveDay,
      totalEvents: events.length,
      eventsByType: typeCounts,
      averageImportance: events.length > 0 ? totalImportance / events.length : 0,
      peakMoments
    }
  }

  /**
   * Get events for a specific time range with zoom level
   */
  getEventsForRange(
    events: TimelineEvent[],
    zoomLevel: 'hour' | 'day' | 'week' | 'month' | 'year',
    centerDate: Date
  ): TimelineEvent[] {
    const ranges: Record<string, number> = {
      hour: 60 * 60 * 1000,
      day: 24 * 60 * 60 * 1000,
      week: 7 * 24 * 60 * 60 * 1000,
      month: 30 * 24 * 60 * 60 * 1000,
      year: 365 * 24 * 60 * 60 * 1000
    }

    const range = ranges[zoomLevel]
    const centerTime = centerDate.getTime()
    const startTime = centerTime - range / 2
    const endTime = centerTime + range / 2

    return events.filter(e => {
      const eventTime = new Date(e.timestamp).getTime()
      return eventTime >= startTime && eventTime <= endTime
    })
  }

  /**
   * Generate timeline summary
   */
  generateTimelineSummary(events: TimelineEvent[]): string {
    if (events.length === 0) {
      return 'No events recorded yet.'
    }

    const insights = this.getTemporalInsights(events)
    const threads = this.detectNarrativeThreads(events)
    const topThread = threads[0]

    let summary = `Timeline contains ${events.length} events. `
    summary += `Most active on ${insights.mostActiveDay}s around ${insights.mostActiveHour}:00. `

    if (topThread) {
      summary += `Main topic: "${topThread.topic}" (${topThread.events.length} events). `
    }

    if (insights.peakMoments.length > 0) {
      summary += `Peak moment: "${insights.peakMoments[0].title}".`
    }

    return summary
  }

  // Helper methods
  private extractTopicsFromMessages(messages: MessageRecord[]): string[] {
    const topics: Set<string> = new Set()
    const commonTopicWords = [
      'help', 'learn', 'understand', 'create', 'build', 'fix', 'explain',
      'technology', 'science', 'art', 'music', 'philosophy', 'life'
    ]

    for (const message of messages) {
      const words = message.content.toLowerCase().split(/\s+/)
      for (const word of words) {
        if (commonTopicWords.includes(word)) {
          topics.add(word)
        }
      }
    }

    return Array.from(topics).slice(0, 5)
  }

  private capitalizeFirst(str: string): string {
    return str.charAt(0).toUpperCase() + str.slice(1)
  }

  private formatAchievementName(id: string): string {
    return id.split('_').map(word =>
      word.charAt(0).toUpperCase() + word.slice(1)
    ).join(' ')
  }
}

// Export singleton instance
export const timelineService = new TimelineService()
