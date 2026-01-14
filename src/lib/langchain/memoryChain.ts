import { BaseMessage, SystemMessage } from '@langchain/core/messages'
import { MemoryService } from '@/lib/services/memoryService'
import { MemoryRecord } from '@/types/database'

export interface MemoryChainConfig {
  agentId: string
  maxMemories?: number
  memoryTypes?: MemoryRecord['type'][]
  importanceThreshold?: number
}

export interface MemoryLoadResult {
  messages: BaseMessage[]
  memoryIds: string[]
  memories: MemoryRecord[]
}

export class MemoryChain {
  private static instances = new Map<string, MemoryChain>()
  private config: MemoryChainConfig
  private memoryCache: Map<string, MemoryRecord[]> = new Map()
  private lastRetrievedIds: string[] = []

  constructor(config: MemoryChainConfig) {
    this.config = {
      maxMemories: 10,
      memoryTypes: ['conversation', 'fact', 'interaction'],
      importanceThreshold: 3,
      ...config
    }
  }

  static getInstance(agentId: string): MemoryChain {
    if (!MemoryChain.instances.has(agentId)) {
      MemoryChain.instances.set(agentId, new MemoryChain({ agentId }))
    }
    return MemoryChain.instances.get(agentId)!
  }

  /**
   * Load memory and return both messages and memory IDs for visualization
   */
  async loadMemoryWithIds(): Promise<MemoryLoadResult> {
    try {
      const cacheKey = this.getCacheKey()
      let memories: MemoryRecord[]

      if (this.memoryCache.has(cacheKey)) {
        memories = this.memoryCache.get(cacheKey)!
      } else {
        memories = await this.getRelevantMemories()
        this.memoryCache.set(cacheKey, memories)
      }

      // Track retrieved IDs for visualization
      this.lastRetrievedIds = memories.map(m => m.id)

      return {
        messages: memories.map(this.memoryToMessage),
        memoryIds: this.lastRetrievedIds,
        memories
      }
    } catch (error) {
      console.error('Error loading memory:', error)
      return { messages: [], memoryIds: [], memories: [] }
    }
  }

  /**
   * Get the last retrieved memory IDs (for visualization)
   */
  getLastRetrievedIds(): string[] {
    return this.lastRetrievedIds
  }

  async loadMemory(): Promise<BaseMessage[]> {
    const result = await this.loadMemoryWithIds()
    return result.messages
  }

  async saveMemory(input: string, output: string, metadata?: Record<string, unknown>): Promise<void> {
    try {
      const agentId = this.config.agentId

      // Create a conversation memory record
      await MemoryService.createMemory({
        agentId,
        type: 'conversation',
        content: `User: ${input}\nAssistant: ${output}`,
        summary: this.generateMemorySummary(input, output),
        keywords: this.extractKeywords(input, output),
        importance: this.calculateImportance(input, output),
        context: (metadata?.context as string) || 'Regular conversation',
        metadata: {
          inputLength: input.length,
          outputLength: output.length,
          timestamp: new Date().toISOString(),
          ...metadata
        }
      })

      // Clear cache to force refresh on next load
      this.memoryCache.delete(this.getCacheKey())
    } catch (error) {
      console.error('Error saving memory:', error)
      // Don't throw - memory saving should not break the conversation
    }
  }

  async saveToolUsage(
    toolName: string,
    input: string,
    output: string,
    metadata?: Record<string, unknown>
  ): Promise<void> {
    try {
      const agentId = this.config.agentId

      await MemoryService.createMemory({
        agentId,
        type: 'interaction',
        content: `Tool: ${toolName}\nInput: ${input}\nOutput: ${output}`,
        summary: `Used ${toolName} tool for: ${input.substring(0, 100)}${input.length > 100 ? '...' : ''}`,
        keywords: [toolName, ...this.extractKeywords(input, output)],
        importance: this.calculateToolImportance(toolName, input, output),
        context: `Tool usage: ${toolName}`,
        metadata: {
          toolName,
          inputLength: input.length,
          outputLength: output.length,
          ...metadata
        }
      })

      // Clear cache to force refresh
      this.memoryCache.delete(this.getCacheKey())
    } catch (error) {
      console.error('Error saving tool usage memory:', error)
    }
  }

  private async getRelevantMemories(): Promise<MemoryRecord[]> {
    try {
      // Get recent memories for this agent
      const recentMemories = await MemoryService.getRecentMemories(
        this.config.agentId,
        this.config.maxMemories || 10
      )

      // Filter by memory types and importance
      const filteredMemories = recentMemories.filter(memory => {
        if (!this.config.memoryTypes?.includes(memory.type)) {
          return false
        }

        if (this.config.importanceThreshold &&
            memory.importance < this.config.importanceThreshold) {
          return false
        }

        return memory.isActive !== false
      })

      return filteredMemories
    } catch (error) {
      console.error('Error getting relevant memories:', error)
      return []
    }
  }

  private memoryToMessage(memory: MemoryRecord): BaseMessage {
    const content = `[${memory.type.toUpperCase()}] ${memory.summary || memory.content}`

    switch (memory.type) {
      case 'conversation':
        return new SystemMessage(content)
      case 'fact':
        return new SystemMessage(`[FACT] ${content}`)
      case 'interaction':
        return new SystemMessage(`[INTERACTION] ${content}`)
      case 'personality_insight':
        return new SystemMessage(`[PERSONALITY] ${content}`)
      default:
        return new SystemMessage(content)
    }
  }

  private generateMemorySummary(input: string, output: string): string {
    // Create a concise summary of the conversation
    const combined = `${input} ${output}`

    // Extract key phrases (simple approach)
    const words = combined.split(' ').filter(word => word.length > 4)
    const keyPhrases = words.slice(0, 8).join(' ')

    return keyPhrases.length > 100
      ? keyPhrases.substring(0, 97) + '...'
      : keyPhrases
  }

  private extractKeywords(input: string, output: string): string[] {
    const text = `${input} ${output}`.toLowerCase()

    // Simple keyword extraction based on common patterns
    const keywords: string[] = []

    // Extract question words and important terms
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which']
    questionWords.forEach(word => {
      if (text.includes(word)) {
        keywords.push(word)
      }
    })

    // Extract nouns and important terms (basic pattern matching)
    const sentences = text.split(/[.!?]+/)
    sentences.forEach(sentence => {
      const words = sentence.split(' ').filter(word =>
        word.length > 3 &&
        !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'that', 'with', 'they', 'have', 'this', 'will', 'from'].includes(word.toLowerCase())
      )
      keywords.push(...words.slice(0, 3))
    })

    // Remove duplicates and limit to 10 keywords
    return [...new Set(keywords)].slice(0, 10)
  }

  private calculateImportance(_input: string, _output: string): number {
    let importance = 5 // Base importance

    // Increase importance for longer, more detailed conversations
    if (_input.length > 100 || _output.length > 200) {
      importance += 2
    }

    // Increase importance for questions (user seeking information)
    if (_input.includes('?')) {
      importance += 1
    }

    // Increase importance for technical or complex topics
    const technicalWords = ['code', 'programming', 'function', 'algorithm', 'database', 'api', 'server']
    const hasTechnicalContent = technicalWords.some(word =>
      `${_input} ${_output}`.toLowerCase().includes(word)
    )
    if (hasTechnicalContent) {
      importance += 1
    }

    return Math.min(importance, 10) // Cap at 10
  }

  private calculateToolImportance(_toolName: string, _input: string, _output: string): number {
    let importance = 6 // Tools are generally more important

    // Increase importance for summarization or complex operations
    if (_toolName.includes('summarize') || _toolName.includes('extract')) {
      importance += 2
    }

    // Increase importance for persona adjustments
    if (_toolName.includes('persona') || _toolName.includes('personality')) {
      importance += 1
    }

    return Math.min(importance, 10)
  }

  private getCacheKey(): string {
    return `${this.config.agentId}_${this.config.maxMemories}_${this.config.memoryTypes?.join('_')}_${this.config.importanceThreshold}`
  }

  // Clear cache for this agent
  clearCache(): void {
    this.memoryCache.delete(this.getCacheKey())
  }

  // Clear all caches
  static clearAllCaches(): void {
    MemoryChain.instances.clear()
  }

  /**
   * Get relevant memories for a specific query (for visualization activation)
   * Returns memory IDs that match the query based on keywords
   */
  async getRelevantMemoriesForQuery(queryText: string, maxCount: number = 10): Promise<{
    memoryIds: string[]
    memories: MemoryRecord[]
  }> {
    try {
      const allMemories = await MemoryService.getAllMemoriesForAgent(this.config.agentId)
      const queryLower = queryText.toLowerCase()
      const queryWords = queryLower.split(/\s+/).filter(w => w.length > 3)

      // Score each memory based on relevance
      const scoredMemories = allMemories.map(memory => {
        let score = 0

        // Check keyword matches
        memory.keywords.forEach(keyword => {
          if (queryLower.includes(keyword.toLowerCase())) {
            score += 3
          }
          queryWords.forEach(word => {
            if (keyword.toLowerCase().includes(word)) {
              score += 1
            }
          })
        })

        // Check content matches
        if (memory.content.toLowerCase().includes(queryLower)) {
          score += 2
        }
        queryWords.forEach(word => {
          if (memory.content.toLowerCase().includes(word)) {
            score += 0.5
          }
        })

        // Boost by importance
        score += memory.importance * 0.2

        return { memory, score }
      })

      // Sort by score and return top matches
      const relevantMemories = scoredMemories
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score)
        .slice(0, maxCount)
        .map(item => item.memory)

      this.lastRetrievedIds = relevantMemories.map(m => m.id)

      return {
        memoryIds: this.lastRetrievedIds,
        memories: relevantMemories
      }
    } catch (error) {
      console.error('Error getting relevant memories for query:', error)
      return { memoryIds: [], memories: [] }
    }
  }

  /**
   * Get agent ID for this chain
   */
  getAgentId(): string {
    return this.config.agentId
  }
}
