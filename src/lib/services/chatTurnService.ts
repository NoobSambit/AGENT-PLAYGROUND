import type { LLMProviderInfo } from '@/lib/llmConfig'
import { type LLMConfig } from '@/lib/langchain/baseChain'
import { AgentChain, type AgentResponse } from '@/lib/langchain/agentChain'
import {
  AgentProgress,
  AgentRecord,
  AgentStats,
  MessageRecord,
  type CreateMessageData,
} from '@/types/database'
import { achievementService } from './achievementService'
import { AgentService } from './agentService'
import { emotionalService } from './emotionalService'
import { MemoryService } from './memoryService'
import { MessageService } from './messageService'
import { PersonalityEventService } from './personalityEventService'
import { PersonalityService } from './personalityService'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'that', 'with', 'this', 'from',
  'have', 'will', 'your', 'about', 'what', 'when', 'where', 'which', 'who', 'why',
  'how', 'can', 'could', 'should', 'would', 'there', 'their', 'they', 'them', 'then',
  'than', 'into', 'onto', 'here', 'just', 'like', 'some', 'more', 'most', 'much',
  'been', 'being', 'also', 'able', 'make', 'made', 'does', 'did', 'done', 'want',
])

const QUESTION_PREFIXES = new Set([
  'what', 'why', 'how', 'when', 'where', 'who', 'which',
  'can', 'could', 'should', 'would', 'do', 'does', 'did', 'is', 'are', 'will', 'may', 'might',
])

const FALLBACK_REPLY = 'I apologize, but I ran into a response error. Please try again in a moment.'

function extractTopicsFromText(text: string): string[] {
  const cleaned = text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
  const words = cleaned.split(/\s+/).filter(Boolean)
  const topics: string[] = []

  for (const word of words) {
    if (word.length < 4) continue
    if (STOP_WORDS.has(word)) continue
    if (!topics.includes(word)) {
      topics.push(word)
    }
    if (topics.length >= 6) break
  }

  return topics
}

function isLikelyQuestion(text: string): boolean {
  if (text.includes('?')) return true
  const firstWord = text.trim().split(/\s+/)[0]?.toLowerCase()
  return Boolean(firstWord && QUESTION_PREFIXES.has(firstWord))
}

function normalizeStats(stats?: AgentStats): AgentStats {
  const base = achievementService.createDefaultStats()
  return {
    ...base,
    ...stats,
    uniqueTopics: [...(stats?.uniqueTopics || [])],
  }
}

function normalizeProgress(progress?: AgentProgress): AgentProgress {
  const base = achievementService.createDefaultProgress()
  return {
    ...base,
    ...progress,
    achievements: { ...(progress?.achievements || {}) },
    allocatedSkills: { ...(progress?.allocatedSkills || {}) },
  }
}

export interface ChatTurnParams {
  agentId: string
  prompt: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  providerInfo?: LLMProviderInfo | null
  llmConfig?: LLMConfig
}

export interface ChatTurnResult {
  userMessage: MessageRecord
  agentMessage: MessageRecord
  agent: AgentRecord | null
  changedDomains: string[]
  staleDomains: string[]
  emotionSummary: {
    summary: string
    status: 'dormant' | 'active'
    dominantEmotion: string | null
    eventCount: number
  }
  response: AgentResponse
}

export class ChatTurnService {
  async runTurn({
    agentId,
    prompt,
    conversationHistory = [],
    providerInfo,
    llmConfig,
  }: ChatTurnParams): Promise<ChatTurnResult> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error(`Agent ${agentId} not found`)
    }

    const userMessage = await this.createMessage({
      agentId,
      content: prompt,
      type: 'user',
    })

    const appraisal = emotionalService.appraiseConversationTurn({
      agent,
      userMessage: prompt,
      recentMessages: conversationHistory,
      linkedMessageId: userMessage.id,
    })

    let response: AgentResponse

    try {
      response = await AgentChain.getInstance(agentId).generateResponse(
        prompt,
        conversationHistory,
        llmConfig,
        {
          emotionalProfile: agent.emotionalProfile,
          emotionalState: appraisal.emotionalState,
        }
      )
    } catch (error) {
      console.error('Chat turn response generation failed:', error)
      response = {
        response: FALLBACK_REPLY,
        reasoning: 'Fallback response used after generation error',
      }
    }

    const finalizedEmotion = await emotionalService.finalizeConversationTurn({
      agent,
      userMessage: prompt,
      agentResponse: response.response,
      provisionalState: appraisal.emotionalState,
      emotionalHistory: appraisal.emotionalHistory,
      providerInfo,
      linkedMessageId: userMessage.id,
      shouldReflect: appraisal.shouldReflect,
    })

    const agentMessage = await this.createMessage({
      agentId,
      content: response.response,
      type: 'agent',
      metadata: {
        langchain: true,
        reasoning: response.reasoning,
        toolsUsed: response.toolsUsed,
        memoryUsed: response.memoryUsed,
        model: llmConfig?.model || providerInfo?.model,
        provider: llmConfig?.provider || providerInfo?.provider,
        emotionSummary: emotionalService.getEmotionalSummary(
          finalizedEmotion.emotionalState,
          agent.emotionalProfile
        ),
        emotionEvents: finalizedEmotion.events.map((event) => ({
          emotion: event.emotion,
          delta: event.delta,
          phase: event.phase,
          source: event.source,
        })),
      },
    })

    const updatedStats = this.updateStatsForTurn(
      agent,
      prompt,
      response.response,
      finalizedEmotion.events.length
    )
    const updatedProgress = this.updateProgressForTurn(agent, updatedStats)
    const nextInteractionCount = (agent.totalInteractions || 0) + 1
    const personalityUpdate = response.personalityAnalyses?.length
      ? PersonalityService.preparePersonalityUpdate(agent, response.personalityAnalyses)
      : null

    await AgentService.updateAgent(agentId, {
      emotionalProfile: agent.emotionalProfile,
      emotionalState: finalizedEmotion.emotionalState,
      emotionalHistory: finalizedEmotion.emotionalHistory,
      stats: updatedStats,
      progress: updatedProgress,
      dynamicTraits: personalityUpdate?.traitUpdates,
      totalInteractions: personalityUpdate?.interactionCount ?? nextInteractionCount,
    })

    const createdMemory = await MemoryService.createMemory({
      agentId,
      type: 'conversation',
      content: `User: ${prompt}\nAssistant: ${response.response}`,
      summary: this.generateConversationMemorySummary(prompt, response.response),
      keywords: this.extractConversationKeywords(prompt, response.response),
      importance: this.calculateConversationMemoryImportance(prompt, response.response),
      context: 'Regular conversation',
      origin: 'conversation',
      linkedMessageIds: [userMessage.id, agentMessage.id],
      metadata: {
        inputLength: prompt.length,
        outputLength: response.response.length,
        toolsUsed: response.toolsUsed?.length ? response.toolsUsed : undefined,
        reasoning: response.reasoning?.substring(0, 200),
      },
    })
    const createdFactMemories = await this.persistStructuredFacts({
      agentId,
      prompt,
      linkedMessageIds: [userMessage.id, agentMessage.id],
    })

    if (personalityUpdate) {
      await PersonalityEventService.createEvent({
        agentId,
        source: 'conversation',
        trigger: 'chat_turn',
        summary: personalityUpdate.summary,
        traitDeltas: this.buildTraitDeltas(personalityUpdate),
        beforeTraits: personalityUpdate.previousTraitUpdates,
        afterTraits: personalityUpdate.traitUpdates,
        linkedMessageIds: [userMessage.id, agentMessage.id],
        metadata: {
          analyses: personalityUpdate.analysis,
        },
      })
    }

    const updatedAgent = await AgentService.getAgentById(agentId)
    const changedDomains = [
      'chat',
      'emotion',
      'stats',
      ...(createdMemory || createdFactMemories > 0 ? ['memory'] : []),
      ...(personalityUpdate ? ['profile_traits'] : []),
    ]
    const staleDomains = [
      ...(createdMemory || createdFactMemories > 0 ? ['memory', 'timeline'] : []),
      ...(personalityUpdate ? ['profile_analysis'] : []),
    ]

    return {
      userMessage,
      agentMessage,
      agent: updatedAgent,
      changedDomains,
      staleDomains,
      emotionSummary: {
        summary: emotionalService.getEmotionalSummary(
          finalizedEmotion.emotionalState,
          updatedAgent?.emotionalProfile || agent.emotionalProfile
        ),
        status: finalizedEmotion.emotionalState.status,
        dominantEmotion: finalizedEmotion.emotionalState.dominantEmotion,
        eventCount: finalizedEmotion.events.length,
      },
      response,
    }
  }

  private async createMessage(messageData: CreateMessageData): Promise<MessageRecord> {
    const message = await MessageService.createMessage(messageData)
    if (!message) {
      throw new Error(`Failed to create ${messageData.type} message`)
    }
    return message
  }

  private updateStatsForTurn(
    agent: AgentRecord,
    userPrompt: string,
    agentResponse: string,
    emotionalEventsCreated: number
  ): AgentStats {
    const baseStats = normalizeStats(agent.stats)
    const hadMessages = baseStats.totalMessages > 0
    const previousLastActive = baseStats.lastActiveDate
    const today = new Date().toISOString().split('T')[0]

    let stats = achievementService.updateStatsFromInteraction(baseStats, {
      messageContent: userPrompt,
      isUserMessage: true,
      topics: extractTopicsFromText(userPrompt),
      isQuestion: isLikelyQuestion(userPrompt),
      emotionsDetected: emotionalEventsCreated,
    })

    if (!hadMessages || previousLastActive !== today) {
      stats = achievementService.startConversation(stats)
    }

    stats = achievementService.updateStatsFromInteraction(stats, {
      messageContent: agentResponse,
      isUserMessage: false,
      topics: extractTopicsFromText(agentResponse),
      isHelpful: agentResponse.trim().length >= 40,
    })

    return achievementService.updateLongestConversation(stats, stats.totalMessages)
  }

  private updateProgressForTurn(agent: AgentRecord, stats: AgentStats): AgentProgress {
    const progress = normalizeProgress(agent.progress)
    const unlocked = achievementService.checkAchievements({
      ...agent,
      stats,
      progress,
    })

    if (unlocked.length === 0) {
      return progress
    }

    return achievementService.unlockAchievements(progress, unlocked).progress
  }

  private generateConversationMemorySummary(input: string, output: string): string {
    const extractedFacts = this.extractStructuredFacts(input)
    if (extractedFacts.length > 0) {
      return extractedFacts.map((fact) => fact.summary).join(' • ').slice(0, 140)
    }

    const combined = `${input} ${output}`
    const words = combined.split(/\s+/).filter((word) => word.length > 4)
    const keyPhrases = words.slice(0, 8).join(' ')

    return keyPhrases.length > 100
      ? `${keyPhrases.substring(0, 97)}...`
      : keyPhrases
  }

  private extractConversationKeywords(input: string, output: string): string[] {
    const text = `${input} ${output}`.toLowerCase()
    const keywords: string[] = this.extractStructuredFacts(input).flatMap((fact) => fact.keywords)
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which']

    questionWords.forEach((word) => {
      if (text.includes(word)) {
        keywords.push(word)
      }
    })

    const sentences = text.split(/[.!?]+/)
    sentences.forEach((sentence) => {
      const words = sentence
        .split(' ')
        .filter((word) => (
          word.length > 3
          && !['the', 'and', 'for', 'are', 'but', 'not', 'you', 'that', 'with', 'they', 'have', 'this', 'will', 'from']
            .includes(word.toLowerCase())
        ))

      keywords.push(...words.slice(0, 3))
    })

    return [...new Set(keywords)].slice(0, 10)
  }

  private calculateConversationMemoryImportance(input: string, output: string): number {
    let importance = 5

    if (input.length > 100 || output.length > 200) {
      importance += 2
    }

    if (input.includes('?')) {
      importance += 1
    }

    return Math.min(10, importance)
  }

  private async persistStructuredFacts(params: {
    agentId: string
    prompt: string
    linkedMessageIds: string[]
  }): Promise<number> {
    const facts = this.extractStructuredFacts(params.prompt)
    if (facts.length === 0) {
      return 0
    }

    let written = 0

    for (const fact of facts) {
      const record = await MemoryService.upsertFactMemory({
        agentId: params.agentId,
        factKey: fact.key,
        content: fact.content,
        summary: fact.summary,
        keywords: fact.keywords,
        importance: fact.importance,
        context: fact.context,
        linkedMessageIds: params.linkedMessageIds,
        metadata: {
          factType: fact.factType,
          canonicalValue: fact.value,
        },
      })

      if (record) {
        written += 1
      }
    }

    return written
  }

  private extractStructuredFacts(input: string): Array<{
    key: string
    factType: 'identity' | 'project' | 'preference'
    value: string
    content: string
    summary: string
    keywords: string[]
    importance: number
    context: string
  }> {
    const facts: Array<{
      key: string
      factType: 'identity' | 'project' | 'preference'
      value: string
      content: string
      summary: string
      keywords: string[]
      importance: number
      context: string
    }> = []

    const nameMatch = input.match(/\bmy name is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})/i)
    if (nameMatch) {
      const name = this.normalizeFactValue(nameMatch[1])
      facts.push({
        key: 'identity:name',
        factType: 'identity',
        value: name,
        content: `User name is ${name}.`,
        summary: `User name: ${name}`,
        keywords: [name.toLowerCase(), 'name', 'identity'],
        importance: 10,
        context: 'User identity',
      })
    }

    const projectMatch = input.match(/\b(?:please remember that\s+)?(?:i am|i'm|im)?\s*(?:building|working on|creating|launching|developing)\s+([^.!?\n]+)/i)
    if (projectMatch) {
      const project = this.normalizeFactValue(projectMatch[1].replace(/\b(today|right now|currently)\b/gi, '').trim())
      facts.push({
        key: `project:${this.slugify(project)}`,
        factType: 'project',
        value: project,
        content: `User is building ${project}.`,
        summary: `Project: ${project}`,
        keywords: [...extractTopicsFromText(project), 'project', 'building'],
        importance: 9,
        context: 'Current user project',
      })
    }

    const preferenceMatch = input.match(/\bi\s+(?:prefer|like|love)\s+([^.!?\n]{3,80})/i)
    if (preferenceMatch) {
      const preference = this.normalizeFactValue(preferenceMatch[1])
      facts.push({
        key: `preference:${this.slugify(preference)}`,
        factType: 'preference',
        value: preference,
        content: `User preference: ${preference}.`,
        summary: `Preference: ${preference}`,
        keywords: [...extractTopicsFromText(preference), 'preference'],
        importance: 7,
        context: 'User preference',
      })
    }

    return facts
  }

  private normalizeFactValue(value: string): string {
    return value
      .replace(/\s+/g, ' ')
      .replace(/^[,.\s]+|[,.\s]+$/g, '')
      .trim()
  }

  private slugify(value: string): string {
    return value
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 80)
  }

  private buildTraitDeltas(personalityUpdate: NonNullable<ReturnType<typeof PersonalityService.preparePersonalityUpdate>>) {
    return personalityUpdate.analysis.map((analysis) => {
      const before = personalityUpdate.previousTraitUpdates[analysis.trait]
      const after = personalityUpdate.traitUpdates[analysis.trait]

      return {
        trait: analysis.trait,
        before,
        after,
        delta: Math.round((after - before) * 100) / 100,
        confidence: analysis.confidence,
        score: analysis.score,
        indicators: analysis.indicators,
      }
    })
  }
}

export const chatTurnService = new ChatTurnService()
