import { ChatGoogleGenerativeAI } from '@langchain/google-genai'
import { ChatGroq } from '@langchain/groq'
import { BaseChatModel } from '@langchain/core/language_models/chat_models'
import { BaseMessage, SystemMessage, HumanMessage } from '@langchain/core/messages'
import { LinguisticProfile, EmotionalState } from '@/types/database'
import { PersonalityService } from '@/lib/services/personalityService'
import { emotionalService } from '@/lib/services/emotionalService'

export interface LLMConfig {
  temperature?: number
  maxTokens?: number
  model?: string
}

// Phase 1 context for enhanced prompts
export interface Phase1Context {
  linguisticProfile?: LinguisticProfile
  emotionalState?: EmotionalState
}

export class BaseChain {
  private static instance: BaseChain | null = null
  private llm: BaseChatModel | null = null
  private config: LLMConfig = {
    temperature: 0.7,
    maxTokens: 1000,
    model: 'gemini-1.5-flash'
  }

  private constructor() {}

  static getInstance(): BaseChain {
    if (!BaseChain.instance) {
      BaseChain.instance = new BaseChain()
    }
    return BaseChain.instance
  }

  initializeLLM(config?: LLMConfig): BaseChatModel {
    if (this.llm && !config) {
      return this.llm
    }

    if (config) {
      this.config = { ...this.config, ...config }
    }

    const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GROQ_API_KEY

    if (!apiKey) {
      throw new Error('No LLM API key configured (GOOGLE_AI_API_KEY or GROQ_API_KEY)')
    }

    // Initialize Gemini if available
    if (process.env.GOOGLE_AI_API_KEY) {
      this.llm = new ChatGoogleGenerativeAI({
        apiKey: process.env.GOOGLE_AI_API_KEY,
        model: this.config.model || 'gemini-1.5-flash',
        temperature: this.config.temperature || 0.7,
        maxOutputTokens: this.config.maxTokens || 1000,
        streaming: true,
      })
    }
    // Fallback to Groq
    else if (process.env.GROQ_API_KEY) {
      this.llm = new ChatGroq({
        apiKey: process.env.GROQ_API_KEY,
        model: this.config.model || 'mixtral-8x7b-32768',
        temperature: this.config.temperature || 0.7,
        maxTokens: this.config.maxTokens || 1000,
        streaming: true,
      })
    } else {
      throw new Error('No LLM provider configured')
    }

    return this.llm
  }

  getLLM(): BaseChatModel {
    if (!this.llm) {
      return this.initializeLLM()
    }
    return this.llm
  }

  async generateResponse(
    messages: BaseMessage[],
    config?: LLMConfig
  ): Promise<string> {
    try {
      const llm = config ? this.initializeLLM(config) : this.getLLM()

      const response = await llm.invoke(messages)

      if (typeof response.content === 'string') {
        return response.content
      } else if (Array.isArray(response.content)) {
        return response.content.map(part => part.type === 'text' ? part.text : '').join('')
      }

      return ''
    } catch (error) {
      console.error('Error generating LLM response:', error)
      throw new Error('Failed to generate LLM response')
    }
  }

  async streamResponse(
    messages: BaseMessage[],
    config?: LLMConfig,
    onToken?: (token: string) => void
  ): Promise<string> {
    try {
      const llm = config ? this.initializeLLM(config) : this.getLLM()

      const response = await llm.stream(messages)
      let fullResponse = ''

      for await (const chunk of response) {
        if (chunk.content) {
          const token = typeof chunk.content === 'string' ? chunk.content : chunk.content.toString()
          fullResponse += token
          if (onToken) {
            onToken(token)
          }
        }
      }

      return fullResponse
    } catch (error) {
      console.error('Error streaming LLM response:', error)
      throw new Error('Failed to stream LLM response')
    }
  }

  formatMessages(
    systemPrompt: string,
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>,
    userMessage: string
  ): BaseMessage[] {
    const messages: BaseMessage[] = []

    // Add system message
    messages.push(new SystemMessage(systemPrompt))

    // Add conversation history (limit to last 10 messages for performance)
    const recentHistory = conversationHistory.slice(-10)
    for (const msg of recentHistory) {
      if (msg.role === 'user') {
        messages.push(new HumanMessage(msg.content))
      } else {
        messages.push(new SystemMessage(msg.content)) // Treat assistant messages as system for context
      }
    }

    // Add current user message
    messages.push(new HumanMessage(userMessage))

    return messages
  }

  createSystemPrompt(
    agentPersona: string,
    agentGoals: string[],
    memoryContext?: string,
    personalityContext?: string,
    phase1Context?: Phase1Context,
    agentName?: string
  ): string {
    let systemPrompt = `You are an AI agent with the following persona: ${agentPersona}

Your goals are: ${agentGoals.join(', ')}

Respond naturally and helpfully to user queries. Keep responses conversational but focused on your defined role and goals.`

    // Phase 1: Add linguistic style context
    if (phase1Context?.linguisticProfile && agentName) {
      const linguisticPrompt = PersonalityService.getLinguisticPrompt(
        phase1Context.linguisticProfile,
        agentName
      )
      systemPrompt += `

${linguisticPrompt}`
    }

    // Phase 1: Add emotional state context
    if (phase1Context?.emotionalState) {
      const emotionalPrompt = emotionalService.getEmotionalPrompt(phase1Context.emotionalState)
      if (emotionalPrompt) {
        systemPrompt += `

${emotionalPrompt}`
      }

      // Add full emotional context for more nuanced responses
      const fullEmotionalContext = emotionalService.getFullEmotionalContext(phase1Context.emotionalState)
      systemPrompt += `

${fullEmotionalContext}`
    }

    if (memoryContext) {
      systemPrompt += `

Relevant memories and context from previous interactions:
${memoryContext}

Use this information to provide more personalized and contextually aware responses.`
    }

    if (personalityContext) {
      systemPrompt += `

Current personality traits that influence your response style:
${personalityContext}`
    }

    return systemPrompt
  }

  /**
   * Create enhanced system prompt with all Phase 1 features
   */
  createEnhancedSystemPrompt(params: {
    agentName: string
    agentPersona: string
    agentGoals: string[]
    memoryContext?: string
    personalityContext?: string
    linguisticProfile?: LinguisticProfile
    emotionalState?: EmotionalState
  }): string {
    return this.createSystemPrompt(
      params.agentPersona,
      params.agentGoals,
      params.memoryContext,
      params.personalityContext,
      {
        linguisticProfile: params.linguisticProfile,
        emotionalState: params.emotionalState
      },
      params.agentName
    )
  }
}
