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
import { MessageService } from './messageService'

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

    await AgentService.updateAgent(agentId, {
      emotionalProfile: agent.emotionalProfile,
      emotionalState: finalizedEmotion.emotionalState,
      emotionalHistory: finalizedEmotion.emotionalHistory,
      stats: updatedStats,
      progress: updatedProgress,
    })

    const updatedAgent = await AgentService.getAgentById(agentId)

    return {
      userMessage,
      agentMessage,
      agent: updatedAgent,
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
}

export const chatTurnService = new ChatTurnService()
