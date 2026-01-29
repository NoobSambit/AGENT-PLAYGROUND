import { tool } from '@langchain/core/tools'
import { BaseChain } from './baseChain'

export class ToolExecutor {
  private agentId: string
  private baseChain: BaseChain

  constructor(agentId: string) {
    this.agentId = agentId
    this.baseChain = BaseChain.getInstance()
  }

  // SummarizerTool: Summarizes long text or conversations
  async summarize(text: string, options?: { force?: boolean }): Promise<string | null> {
    try {
      const force = options?.force === true
      if (text.length < 100 && !force) {
        return null // No need to summarize short text
      }

      const prompt = `Please provide a concise summary of the following text in 2-3 sentences:

${text}

Focus on the key points and main ideas.`

      const response = await this.baseChain.generateResponse([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'system', content: 'You are a helpful summarizer.' } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'user', content: prompt } as any
      ], {
        temperature: 0.3,
        maxTokens: 200
      })

      return (response || '').trim()
    } catch (error) {
      console.error('Error in summarizer tool:', error)
      return null
    }
  }

  // KeywordExtractorTool: Extracts key topics for memory indexing
  async extractKeywords(text: string): Promise<string[]> {
    try {
      const prompt = `Extract 5-8 key topics or keywords from the following text:

${text}

Return only the keywords as a comma-separated list. Focus on nouns, technical terms, and important concepts.`

      const response = await this.baseChain.generateResponse([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'system', content: 'You are a keyword extraction specialist.' } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'user', content: prompt } as any
      ], {
        temperature: 0.2,
        maxTokens: 100
      })

      const keywords = response
        .split(',')
        .map(kw => kw.trim())
        .filter(kw => kw.length > 2)
        .slice(0, 8)

      return keywords
    } catch (error) {
      console.error('Error in keyword extractor tool:', error)
      return []
    }
  }

  // PersonaAdjusterTool: Adjusts tone based on agent personality
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  async adjustPersona(text: string, agent: any): Promise<string> {
    try {
      // Get agent personality traits
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const coreTraits = (agent as any).coreTraits || {}
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const dynamicTraits = (agent as any).dynamicTraits || {}

      // Analyze current tone of the text
      const prompt = `Given this agent has the following personality traits:

Core traits: ${Object.entries(coreTraits).map(([trait, score]) => `${trait}: ${Math.round((score as number) * 100)}%`).join(', ')}
Dynamic traits: ${Object.entries(dynamicTraits).map(([trait, score]) => `${trait}: ${Math.round((score as number) * 100)}%`).join(', ')}

And the agent persona: ${agent.persona}

Please adjust the following text to better match the agent's personality and tone:

${text}

Make the response more aligned with the agent's character while keeping the same meaning.`

      const response = await this.baseChain.generateResponse([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'system', content: 'You are a persona adjustment specialist.' } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'user', content: prompt } as any
      ], {
        temperature: 0.4,
        maxTokens: Math.max(text.length, 200)
      })

      return response.trim()
    } catch (error) {
      console.error('Error in persona adjuster tool:', error)
      return text // Return original text if adjustment fails
    }
  }

  // Advanced Summarizer for long memories or conversations
  async summarizeMemories(memories: Array<{ content: string; summary: string; importance: number }>): Promise<string> {
    try {
      if (memories.length === 0) {
        return ''
      }

      // Sort by importance and take top memories
      const topMemories = memories
        .sort((a, b) => b.importance - a.importance)
        .slice(0, 5)

      const memoriesText = topMemories
        .map(memory => `Importance ${memory.importance}/10: ${memory.summary || memory.content.substring(0, 100)}`)
        .join('\n\n')

      const prompt = `Please provide a concise summary that captures the key information and patterns from these memories:

${memoriesText}

Focus on recurring themes, user preferences, and important facts that would be most relevant for future interactions.`

      const response = await this.baseChain.generateResponse([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'system', content: 'You are a memory summarization specialist.' } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'user', content: prompt } as any
      ], {
        temperature: 0.3,
        maxTokens: 300
      })

      return response.trim()
    } catch (error) {
      console.error('Error in memory summarizer tool:', error)
      return ''
    }
  }

  // Context Analyzer: Analyzes conversation context for better responses
  async analyzeContext(
    currentInput: string,
    conversationHistory: Array<{ role: 'user' | 'assistant', content: string }>
  ): Promise<{ context: string; urgency: 'low' | 'medium' | 'high' }> {
    try {
      const recentHistory = conversationHistory.slice(-5) // Last 5 messages
      const historyText = recentHistory.map(msg => `${msg.role}: ${msg.content}`).join('\n')

      const prompt = `Analyze the conversation context:

Current input: ${currentInput}

Recent conversation:
${historyText}

Determine:
1. The main topic or context
2. The urgency level (low/medium/high)

Return only in this format:
Context: [brief context description]
Urgency: [low/medium/high]`

      const response = await this.baseChain.generateResponse([
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'system', content: 'You are a conversation context analyzer.' } as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        { role: 'user', content: prompt } as any
      ], {
        temperature: 0.2,
        maxTokens: 100
      })

      const contextMatch = response.match(/Context: (.+)/)
      const urgencyMatch = response.match(/Urgency: (low|medium|high)/)

      return {
        context: contextMatch?.[1] || 'general conversation',
        urgency: (urgencyMatch?.[1] as 'low' | 'medium' | 'high') || 'medium'
      }
    } catch (error) {
      console.error('Error in context analyzer tool:', error)
      return {
        context: 'general conversation',
        urgency: 'medium'
      }
    }
  }

  // Tool recommendation system
  shouldUseTool(input: string): { shouldUse: boolean; recommendedTools: string[] } {
    const lowerInput = input.toLowerCase()
    const recommendedTools: string[] = []

    // Summarizer recommendations
    if (lowerInput.includes('summarize') || lowerInput.includes('summary') ||
        lowerInput.includes('tldr') || lowerInput.includes('too long') ||
        input.length > 200) {
      recommendedTools.push('summarizer')
    }

    // Keyword extractor recommendations
    if (lowerInput.includes('keywords') || lowerInput.includes('key points') ||
        lowerInput.includes('topics') || lowerInput.includes('main ideas')) {
      recommendedTools.push('keyword_extractor')
    }

    // Persona adjuster recommendations
    if (lowerInput.includes('change tone') || lowerInput.includes('be more') ||
        lowerInput.includes('be less') || lowerInput.includes('sound like')) {
      recommendedTools.push('persona_adjuster')
    }

    // Context analyzer recommendations
    if (lowerInput.includes('analyze') || lowerInput.includes('explain') ||
        lowerInput.includes('understand') || lowerInput.includes('context')) {
      recommendedTools.push('context_analyzer')
    }

    return {
      shouldUse: recommendedTools.length > 0,
      recommendedTools
    }
  }

  // Execute multiple tools in sequence
  async executeToolChain(
    input: string,
    tools: string[],
    agent?: { persona: string; coreTraits?: Record<string, number>; dynamicTraits?: Record<string, number> }
  ): Promise<{ results: Record<string, unknown>; finalInput: string }> {
    const results: Record<string, unknown> = {}
    let processedInput = input

    for (const toolName of tools) {
      try {
        switch (toolName) {
          case 'summarizer':
            const summary = await this.summarize(processedInput)
            if (summary) {
              results.summarizer = summary
              // Use summary for further processing if input was long
              if (processedInput.length > 150) {
                processedInput = summary
              }
            }
            break

          case 'keyword_extractor':
            const keywords = await this.extractKeywords(processedInput)
            results.keyword_extractor = keywords
            break

          case 'persona_adjuster':
            if (agent) {
              processedInput = await this.adjustPersona(processedInput, agent)
              results.persona_adjuster = 'applied'
            } else {
              results.persona_adjuster = 'skipped'
            }
            break

          case 'context_analyzer':
            const context = await this.analyzeContext(processedInput, [])
            results.context_analyzer = context
            break
        }
      } catch (error) {
        console.error(`Error executing tool ${toolName}:`, error)
        results[toolName] = 'error'
      }
    }

    return {
      results,
      finalInput: processedInput
    }
  }
}

// LangChain-compatible tool definitions for external use
export const SummarizerTool = tool(
  async (input: unknown) => {
    const executor = new ToolExecutor('system') // System-level tool
    return await executor.summarize((input as { text: string }).text, { force: true })
  },
  {
    name: 'summarizer',
    description: 'Summarizes long text or conversations into concise form',
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to summarize'
        }
      },
      required: ['text']
    }
  }
)

export const KeywordExtractorTool = tool(
  async (input: unknown) => {
    const executor = new ToolExecutor('system')
    return (await executor.extractKeywords((input as { text: string }).text)).join(', ')
  },
  {
    name: 'keyword_extractor',
    description: 'Extracts key topics and keywords from text',
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to extract keywords from'
        }
      },
      required: ['text']
    }
  }
)

export const PersonaAdjusterTool = tool(
  async (input: unknown) => {
    const inputData = input as { text: string; persona: string; traits?: Record<string, number> }
    const mockAgent = { persona: inputData.persona, coreTraits: inputData.traits || {}, dynamicTraits: inputData.traits || {} }
    const executor = new ToolExecutor('system')
    return await executor.adjustPersona(inputData.text, mockAgent)
  },
  {
    name: 'persona_adjuster',
    description: 'Adjusts text tone to match agent personality',
    schema: {
      type: 'object',
      properties: {
        text: {
          type: 'string',
          description: 'The text to adjust'
        },
        persona: {
          type: 'string',
          description: 'The agent persona to match'
        },
        traits: {
          type: 'object',
          description: 'Personality traits to consider',
          additionalProperties: { type: 'number' }
        }
      },
      required: ['text', 'persona']
    }
  }
)
