import { BaseChain } from './baseChain'
import { MemoryChain } from './memoryChain'
import { ToolExecutor } from './tools'
import { AgentService } from '@/lib/services/agentService'
import { PersonalityService } from '@/lib/services/personalityService'
import { BaseMessage } from '@langchain/core/messages'

export interface AgentChainConfig {
  agentId: string
  enableTools?: boolean
  enablePersonality?: boolean
  enableStreaming?: boolean
  maxTokens?: number
  temperature?: number
}

export interface AgentResponse {
  response: string
  reasoning?: string
  toolsUsed?: string[]
  memoryUsed?: number
  personalityInsights?: string[]
}

export class AgentChain {
  private static instances = new Map<string, AgentChain>()
  private baseChain: BaseChain
  private memoryChain: MemoryChain
  private toolExecutor: ToolExecutor
  private config: AgentChainConfig

  constructor(config: AgentChainConfig) {
    this.config = {
      enableTools: true,
      enablePersonality: true,
      enableStreaming: true,
      maxTokens: 1000,
      temperature: 0.7,
      ...config
    }

    this.baseChain = BaseChain.getInstance()
    this.memoryChain = MemoryChain.getInstance(config.agentId)
    this.toolExecutor = new ToolExecutor(config.agentId)
  }

  static getInstance(agentId: string): AgentChain {
    if (!AgentChain.instances.has(agentId)) {
      AgentChain.instances.set(agentId, new AgentChain({ agentId }))
    }
    return AgentChain.instances.get(agentId)!
  }

  async generateResponse(
    userInput: string,
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = []
  ): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      // Load agent information
      const agent = await AgentService.getAgentById(this.config.agentId)
      if (!agent) {
        throw new Error(`Agent ${this.config.agentId} not found`)
      }

      // Type assertion for agent data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentData = agent as any

      // Load memory context
      const memoryMessages = await this.memoryChain.loadMemory()

      // Create system prompt with agent personality and memory
      const systemPrompt = this.createSystemPrompt(agentData, memoryMessages)

      // Check if tools should be used
      const shouldUseTools = this.config.enableTools &&
        this.shouldUseTools(userInput)

      // Generate response with optional tool usage
      let response: string
      let toolsUsed: string[] = []
      let reasoning = ''

      if (shouldUseTools) {
        const toolResult = await this.useTools(userInput, agentData, memoryMessages)
        response = toolResult.response
        toolsUsed = toolResult.toolsUsed || []
        reasoning = toolResult.reasoning || ''
      } else {
        response = await this.generateDirectResponse(
          systemPrompt,
          conversationHistory,
          userInput
        )
      }

      // Apply personality evolution if enabled
      if (this.config.enablePersonality) {
        await this.applyPersonalityEvolution(userInput, response, agentData)
      }

      // Save conversation to memory
      await this.memoryChain.saveMemory(userInput, response, {
        responseTime: Date.now() - startTime,
        toolsUsed: toolsUsed.length > 0,
        reasoning: reasoning.substring(0, 200) // Truncate for metadata
      })

      return {
        response,
        reasoning,
        toolsUsed,
        memoryUsed: memoryMessages.length,
        personalityInsights: reasoning ? [reasoning] : undefined
      }

    } catch (error) {
      console.error('Error in agent chain:', error)

      // Fallback to simple response if LangChain fails
      return this.getFallbackResponse()
    }
  }

  async streamResponse(
    userInput: string,
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }> = [],
    onToken?: (token: string) => void
  ): Promise<AgentResponse> {
    const startTime = Date.now()

    try {
      // Load agent information
      const agent = await AgentService.getAgentById(this.config.agentId)
      if (!agent) {
        throw new Error(`Agent ${this.config.agentId} not found`)
      }

      // Type assertion for agent data
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const agentData = agent as any

      // Load memory context
      const memoryMessages = await this.memoryChain.loadMemory()

      // Create system prompt
      const systemPrompt = this.createSystemPrompt(agentData, memoryMessages)

      // Check if tools should be used
      const shouldUseTools = this.config.enableTools &&
        this.shouldUseTools(userInput)

      let fullResponse = ''
      let toolsUsed: string[] = []
      let reasoning = ''

      if (shouldUseTools) {
        // For streaming with tools, we'll use direct response for simplicity
        // Tools are better suited for non-streaming responses
        const result = await this.useTools(userInput, agentData, memoryMessages)
        fullResponse = result.response
        toolsUsed = result.toolsUsed || []
        reasoning = result.reasoning || ''

        // Simulate streaming by calling onToken for each character
        if (onToken) {
          for (const char of fullResponse) {
            onToken(char)
          }
        }
      } else {
        // Generate streaming response
        fullResponse = await this.streamDirectResponse(
          systemPrompt,
          conversationHistory,
          userInput,
          onToken
        )
      }

      // Apply personality evolution if enabled
      if (this.config.enablePersonality) {
        await this.applyPersonalityEvolution(userInput, fullResponse, agentData)
      }

      // Save conversation to memory
      await this.memoryChain.saveMemory(userInput, fullResponse, {
        responseTime: Date.now() - startTime,
        toolsUsed: toolsUsed.length > 0,
        reasoning: reasoning.substring(0, 200)
      })

      return {
        response: fullResponse,
        reasoning,
        toolsUsed,
        memoryUsed: memoryMessages.length,
        personalityInsights: reasoning ? [reasoning] : undefined
      }

    } catch (error) {
      console.error('Error in streaming agent chain:', error)

      // Fallback response
      const fallback = this.getFallbackResponse()
      return {
        ...fallback,
        reasoning: 'Error in LangChain processing, using fallback response'
      }
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private createSystemPrompt(_agent: any, memoryMessages: BaseMessage[]): string {
    const baseChain = this.baseChain

    // Get memory context from messages
    const memoryContext = memoryMessages.length > 0
      ? memoryMessages.map(msg => msg.content).join('\n')
      : undefined

    // Get personality context
    const personalityContext = this.getPersonalityContext(_agent)

    return baseChain.createEnhancedSystemPrompt({
      agentName: _agent.name || 'Agent',
      agentPersona: _agent.persona,
      agentGoals: _agent.goals || [],
      memoryContext,
      personalityContext,
      linguisticProfile: _agent.linguisticProfile,
      emotionalState: _agent.emotionalState
    })
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  private getPersonalityContext(agent: any): string | undefined {
    if (!agent.coreTraits && !agent.dynamicTraits) {
      return undefined
    }

    const traits = []

    if (agent.coreTraits) {
      traits.push(`Core traits: ${Object.entries(agent.coreTraits)
        .map(([trait, score]) => `${trait}: ${Math.round((score as number) * 100)}%`)
        .join(', ')}`)
    }

    if (agent.dynamicTraits) {
      traits.push(`Evolving traits: ${Object.entries(agent.dynamicTraits)
        .map(([trait, score]) => `${trait}: ${Math.round((score as number) * 100)}%`)
        .join(', ')}`)
    }

    return traits.join('\n')
  }

  private shouldUseTools(input: string): boolean {
    // Simple heuristic to determine when to use tools
    const lowerInput = input.toLowerCase()

    // Use tools for summarization requests
    if (this.isSummaryRequest(input)) {
      return true
    }

    // Use tools for keyword extraction
    if (this.isKeywordRequest(input)) {
      return true
    }

    // Use tools for persona/tone adjustments
    if (lowerInput.includes('change tone') || lowerInput.includes('be more') || lowerInput.includes('be less')) {
      return true
    }

    // Use tools for complex analysis
    if (input.length > 200 || lowerInput.includes('analyze') || lowerInput.includes('explain')) {
      return true
    }

    return false
  }

  private isSummaryRequest(input: string): boolean {
    const lowerInput = input.toLowerCase()
    return lowerInput.includes('summarize') || lowerInput.includes('summary') || lowerInput.includes('tldr')
  }

  private isKeywordRequest(input: string): boolean {
    const lowerInput = input.toLowerCase()
    return lowerInput.includes('keywords') ||
      lowerInput.includes('key points') ||
      lowerInput.includes('topics') ||
      lowerInput.includes('main ideas')
  }

  private extractSummaryTarget(input: string): string | null {
    const summaryMatch = input.match(/summar(?:ize|y)(?:\s+this|\s+the following|\s+the text)?\s*[:\-]?\s*([\s\S]+)/i)
    if (summaryMatch?.[1]) {
      const trimmed = summaryMatch[1].trim()
      if (trimmed) {
        return trimmed
      }
    }

    const tldrMatch = input.match(/tldr\s*[:\-]?\s*([\s\S]+)/i)
    if (tldrMatch?.[1]) {
      const trimmed = tldrMatch[1].trim()
      if (trimmed) {
        return trimmed
      }
    }

    return null
  }

  private async useTools(
    input: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    agent: any,
    memoryMessages: BaseMessage[]
  ): Promise<{ response: string; toolsUsed: string[]; reasoning: string }> {
    const toolsUsed: string[] = []
    let reasoning = 'Using LangChain tools for enhanced response...'

    try {
      const wantsSummary = this.isSummaryRequest(input)
      const wantsKeywords = this.isKeywordRequest(input)
      const summaryTarget = wantsSummary ? this.extractSummaryTarget(input) : null
      const summaryInput = summaryTarget || input

      let summary: string | null = null
      if (wantsSummary || input.length > 150) {
        summary = await this.toolExecutor.summarize(summaryInput, { force: wantsSummary })
        if (summary) {
          toolsUsed.push('summarizer')
          reasoning += '\n- Used summarizer tool for input analysis'
        }
      }

      // Extract keywords for memory indexing
      const keywords = await this.toolExecutor.extractKeywords(summaryInput)
      if (keywords && keywords.length > 0) {
        toolsUsed.push('keyword_extractor')
        reasoning += '\n- Used keyword extractor for memory indexing'
      }

      if (wantsSummary && summary) {
        const response = wantsKeywords && keywords.length > 0
          ? `${summary}\n\nKeywords: ${keywords.join(', ')}`
          : summary
        return { response, toolsUsed, reasoning }
      }

      if (wantsKeywords && keywords.length > 0) {
        return { response: keywords.join(', '), toolsUsed, reasoning }
      }

      // Adjust persona if needed
      const adjustedInput = await this.toolExecutor.adjustPersona(input, agent)
      if (adjustedInput !== input) {
        toolsUsed.push('persona_adjuster')
        reasoning += '\n- Used persona adjuster for tone matching'
      }

      // Generate response using the processed input
      const finalInput = adjustedInput !== input ? adjustedInput : input
      const response = await this.generateDirectResponse(
        this.createSystemPrompt(agent, memoryMessages),
        [],
        finalInput
      )

      return { response, toolsUsed, reasoning }

    } catch (error) {
      console.error('Error using tools:', error)
      // Fallback to direct response
      const response = await this.generateDirectResponse(
        this.createSystemPrompt(agent, memoryMessages),
        [],
        input
      )

      return {
        response,
        toolsUsed: ['error_fallback'],
        reasoning: 'Tool execution failed, using direct response'
      }
    }
  }

  private async generateDirectResponse(
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>,
    userInput: string
  ): Promise<string> {
    const messages = this.baseChain.formatMessages(
      systemPrompt,
      conversationHistory,
      userInput
    )

    return await this.baseChain.generateResponse(messages, {
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens
    })
  }

  private async streamDirectResponse(
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>,
    userInput: string,
    onToken?: (token: string) => void
  ): Promise<string> {
    const messages = this.baseChain.formatMessages(
      systemPrompt,
      conversationHistory,
      userInput
    )

    return await this.baseChain.streamResponse(messages, {
      temperature: this.config.temperature,
      maxTokens: this.config.maxTokens
    }, onToken)
  }

  private async applyPersonalityEvolution(
    input: string,
    output: string,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    _agent: any
  ): Promise<void> {
    try {
      // Analyze interaction for personality insights
      const analyses = await PersonalityService.analyzeInteraction(
        this.config.agentId,
        input,
        output,
        `Agent persona: ${_agent.persona}`
      )

      if (analyses.length > 0) {
        await PersonalityService.updatePersonality(this.config.agentId, analyses)
      }
    } catch (error) {
      console.error('Error applying personality evolution:', error)
      // Don't throw - personality evolution should not break conversation
    }
  }

  private getFallbackResponse(): AgentResponse {
    // Enhanced fallback response with better error handling
    const fallbackResponses = [
      `I'm having trouble processing your request right now. Could you try asking me again in a different way?`,
      `I apologize, but I'm experiencing some technical difficulties. Please try rephrasing your question.`,
      `Something seems to be preventing me from responding properly. Could you ask me something else or try again?`,
      `I'm temporarily unable to process complex requests. Please try a simpler question or contact support if this persists.`
    ]

    const randomResponse = fallbackResponses[Math.floor(Math.random() * fallbackResponses.length)]

    return {
      response: randomResponse,
      reasoning: 'LangChain processing failed, using fallback response',
      toolsUsed: ['fallback'],
      memoryUsed: 0
    }
  }

  // Clear caches for this agent
  clearCache(): void {
    this.memoryChain.clearCache()
  }

  // Clear all caches (useful for memory management)
  static clearAllCaches(): void {
    MemoryChain.clearAllCaches()
    AgentChain.instances.clear()
  }

  // Get cache statistics for monitoring
  static getCacheStats(): { agentChains: number; memoryChains: number } {
    return {
      agentChains: AgentChain.instances.size,
      memoryChains: MemoryChain['instances'].size
    }
  }

  // Cleanup inactive chains (useful for long-running applications)
  static cleanupInactiveChains(maxAge: number = 30 * 60 * 1000): void { // 30 minutes default
    // Since we don't track last activity, we'll keep chains alive for now
    // In a production app, you'd want to track lastUsed timestamps and cleanup old instances
    console.log(`Cleanup called for ${AgentChain.instances.size} agent chains with maxAge: ${maxAge}`)
  }
}
