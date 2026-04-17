import type { LLMProviderInfo } from '@/lib/llmConfig'
import { type LLMConfig } from '@/lib/langchain/baseChain'
import { AgentChain, type AgentResponse } from '@/lib/langchain/agentChain'
import {
  AgentRecord,
  AgentStats,
  MessageRecord,
  type CreateMessageData,
} from '@/types/database'
import { AgentService } from './agentService'
import { agentStatsService } from './agentStatsService'
import { emotionalService } from './emotionalService'
import { MemoryService } from './memoryService'
import { MessageService } from './messageService'
import { PersonalityEventService } from './personalityEventService'
import { PersonalityService } from './personalityService'
import { LearningService } from './learningService'
import { buildMessageRenderData } from '@/lib/chat/rendering'
import { dreamService } from './dreamService'
import { MemoryGraphService } from './memoryGraphService'
import { applyChatTurnQualityGate } from './outputQuality/chatTurnQuality'
import type { MemoryRecord } from '@/types/database'

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
  return agentStatsService.normalizeStats(stats)
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
    const activeDreamImpression = dreamService.getActiveImpression(agent)

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

    const qualityGate = await applyChatTurnQualityGate({
      prompt,
      response: response.response,
      llmConfig,
      conversationHistory,
    }).catch((error) => {
      console.error('Chat turn quality gate failed:', error)
      return null
    })

    if (qualityGate) {
      response = {
        ...response,
        response: qualityGate.finalResponse,
        qualityGate,
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
        responseQuality: response.qualityGate ? {
          promptVersion: response.qualityGate.promptVersion,
          repaired: response.qualityGate.repaired,
          repairCount: response.qualityGate.repairCount,
          blockerReasons: response.qualityGate.blockerReasons,
          warnings: response.qualityGate.warnings,
          styleSignals: response.qualityGate.styleSignals,
          validation: response.qualityGate.validation,
          rawModelOutput: response.qualityGate.rawModelOutput,
        } : undefined,
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
        ...(activeDreamImpression ? {
          dreamImpression: {
            sourceDreamId: activeDreamImpression.sourceDreamId,
            behaviorTilt: activeDreamImpression.behaviorTilt,
            expiresAt: activeDreamImpression.expiresAt,
          },
        } : {}),
      },
    })

    const createdMemory = await MemoryService.createMemory({
      agentId,
      type: 'conversation_episode',
      content: `User: ${prompt}\nAssistant: ${response.response}`,
      summary: this.generateConversationMemorySummary(prompt, response.response),
      keywords: this.extractConversationKeywords(prompt, response.response),
      importance: this.calculateConversationMemoryImportance(prompt, response.response),
      context: 'Regular conversation',
      origin: 'conversation',
      linkedMessageIds: [userMessage.id, agentMessage.id],
      evidenceRefs: [userMessage.id, agentMessage.id],
      metadata: {
        inputLength: prompt.length,
        outputLength: response.response.length,
        toolsUsed: response.toolsUsed?.length ? response.toolsUsed : undefined,
        reasoning: response.reasoning?.substring(0, 200),
      },
    })

    const semanticMemories = await this.persistSemanticMemories({
      agentId,
      prompt,
      response: response.response,
      linkedMessageIds: [userMessage.id, agentMessage.id],
      qualityBlockers: response.qualityGate?.blockerReasons || [],
    })

    const createdFactMemories = await this.persistStructuredFacts({
      agentId,
      prompt,
      linkedMessageIds: [userMessage.id, agentMessage.id],
    })

    await this.updateMemoryGraph([createdMemory, ...semanticMemories].filter((memory): memory is MemoryRecord => Boolean(memory)))

    if (finalizedEmotion.events.length > 0) {
      const semanticThemes = semanticMemories
        .map((memory) => memory.canonicalValue || memory.summary)
        .filter(Boolean)
        .slice(0, 4)

      finalizedEmotion.events.forEach((event) => {
        event.metadata = {
          ...(event.metadata || {}),
          semanticThemes,
          semanticMemoryIds: semanticMemories.map((memory) => memory.id),
          qualityBlockers: response.qualityGate?.blockerReasons || [],
        }
      })
    }

    const updatedStats = this.updateStatsForTurn(
      agent,
      prompt,
      response.response,
      finalizedEmotion.events.length
    )
    const nextInteractionCount = (agent.totalInteractions || 0) + 1
    const personalityUpdate = response.personalityAnalyses?.length
      ? PersonalityService.preparePersonalityUpdate(agent, response.personalityAnalyses)
      : null

    await AgentService.updateAgent(agentId, {
      emotionalProfile: agent.emotionalProfile,
      emotionalState: finalizedEmotion.emotionalState,
      emotionalHistory: finalizedEmotion.emotionalHistory,
      stats: updatedStats,
      dynamicTraits: personalityUpdate?.traitUpdates,
      totalInteractions: personalityUpdate?.interactionCount ?? nextInteractionCount,
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

    let learningResult = null
    try {
      learningResult = await LearningService.processChatTurn({
        agentId,
        prompt,
        response: response.response,
        userMessage,
        agentMessage,
        toolsUsed: response.toolsUsed,
        memoryUsed: response.memoryUsed,
        emotionalContext: finalizedEmotion.emotionalState.dominantEmotion || 'trust',
      })
    } catch (error) {
      console.error('Learning side effects failed:', error)
    }

    const updatedAgent = await AgentService.getAgentById(agentId)
    const changedDomains = [
      'chat',
      'emotion',
      'stats',
      ...(learningResult ? ['learning'] : []),
      ...(createdMemory || createdFactMemories > 0 || semanticMemories.length > 0 ? ['memory'] : []),
      ...(personalityUpdate ? ['profile_traits'] : []),
    ]
    const staleDomains = [
      ...(createdMemory || createdFactMemories > 0 || semanticMemories.length > 0 ? ['memory', 'timeline'] : []),
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
    const metadata = {
      ...messageData.metadata,
      format: messageData.type === 'agent' || messageData.type === 'system'
        ? 'markdown-v1' as const
        : 'plain-text-v1' as const,
      render: messageData.type === 'agent' || messageData.type === 'system'
        ? buildMessageRenderData(messageData.content)
        : undefined,
    }

    const message = await MessageService.createMessage({
      ...messageData,
      metadata,
    })
    if (!message) {
      throw new Error(`Failed to create ${messageData.type} message`)
    }
    return message
  }

  private async updateMemoryGraph(memories: MemoryRecord[]): Promise<void> {
    for (const memory of memories) {
      try {
        await MemoryGraphService.processNewMemory(memory)
      } catch (error) {
        console.error('Memory graph update failed:', error)
      }
    }
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

    let stats = agentStatsService.updateStatsFromInteraction(baseStats, {
      messageContent: userPrompt,
      isUserMessage: true,
      topics: extractTopicsFromText(userPrompt),
      isQuestion: isLikelyQuestion(userPrompt),
      emotionsDetected: emotionalEventsCreated,
    })

    if (!hadMessages || previousLastActive !== today) {
      stats = agentStatsService.startConversation(stats)
    }

    stats = agentStatsService.updateStatsFromInteraction(stats, {
      messageContent: agentResponse,
      isUserMessage: false,
      topics: extractTopicsFromText(agentResponse),
      isHelpful: agentResponse.trim().length >= 40,
    })

    return agentStatsService.updateLongestConversation(stats, stats.totalMessages)
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

  private async persistSemanticMemories(params: {
    agentId: string
    prompt: string
    response: string
    linkedMessageIds: string[]
    qualityBlockers: string[]
  }): Promise<MemoryRecord[]> {
    const abstractions = this.extractSemanticMemories(params.prompt, params.response)
    if (abstractions.length === 0) {
      return []
    }

    const stored: MemoryRecord[] = []

    for (const abstraction of abstractions) {
      const memory = await MemoryService.upsertSemanticMemory({
        agentId: params.agentId,
        type: abstraction.type,
        canonicalKey: abstraction.canonicalKey,
        canonicalValue: abstraction.canonicalValue,
        content: abstraction.content,
        summary: abstraction.summary,
        keywords: abstraction.keywords,
        importance: abstraction.importance,
        confidence: abstraction.confidence,
        context: abstraction.context,
        linkedMessageIds: params.linkedMessageIds,
        evidenceRefs: params.linkedMessageIds,
        metadata: {
          semanticCategory: abstraction.type,
          extractionSource: abstraction.source,
          qualityBlockers: params.qualityBlockers,
        },
      })

      if (memory) {
        stored.push(memory)
      }
    }

    return stored
  }

  private extractSemanticMemories(prompt: string, response: string): Array<{
    type: Extract<MemoryRecord['type'], 'preference' | 'project' | 'relationship' | 'identity' | 'operating_constraint' | 'artifact_summary' | 'tension_snapshot'>
    canonicalKey: string
    canonicalValue: string
    content: string
    summary: string
    keywords: string[]
    importance: number
    confidence: number
    context: string
    source: 'user_prompt' | 'assistant_response'
  }> {
    const abstractions: Array<{
      type: Extract<MemoryRecord['type'], 'preference' | 'project' | 'relationship' | 'identity' | 'operating_constraint' | 'artifact_summary' | 'tension_snapshot'>
      canonicalKey: string
      canonicalValue: string
      content: string
      summary: string
      keywords: string[]
      importance: number
      confidence: number
      context: string
      source: 'user_prompt' | 'assistant_response'
    }> = []

    const normalizedPrompt = prompt.trim()
    const promptLower = normalizedPrompt.toLowerCase()

    const pushAbstraction = (entry: typeof abstractions[number]) => {
      if (!entry.canonicalValue) return
      if (abstractions.some((existing) => existing.canonicalKey === entry.canonicalKey)) return
      abstractions.push(entry)
    }

    const splitPreferenceSegments = (value: string) => value
      .split(/\s*,\s*|\s+(?:and|but)\s+/i)
      .map((entry) => this.normalizeFactValue(entry))
      .filter((entry) => entry.length >= 4 && entry.length <= 100)

    const isPositivePreferenceClause = (value: string) => /\bi\s+(?:respond|prefer|need|want|work|write|create|focus)\b/i.test(value)
    const isNarrativePreference = (value: string) => (
      value.length > 80
      || /\b(?:but|when|while|although|because|even though|instead of)\b/i.test(value)
    )
    const creativePreferenceContext = /\b(?:creative work|fiction|story|stories|art|artistic|aesthetic|theme|themes|motif|motifs|character|characters|novel|poem|film|redemption arcs|cliches|imagery)\b/i.test(normalizedPrompt)

    const nameMatch = normalizedPrompt.match(/\bmy name is\s+([A-Za-z][A-Za-z'-]+(?:\s+[A-Za-z][A-Za-z'-]+){0,2})/i)
    if (nameMatch) {
      const name = this.normalizeFactValue(nameMatch[1])
      pushAbstraction({
        type: 'identity',
        canonicalKey: 'identity:user_name',
        canonicalValue: name,
        content: `The user identifies themself as ${name}.`,
        summary: `Identity: user name is ${name}`,
        keywords: [name.toLowerCase(), 'identity', 'name'],
        importance: 10,
        confidence: 0.96,
        context: 'User identity',
        source: 'user_prompt',
      })
    }

    const roleMatch = normalizedPrompt.match(/\b(?:i am|i'm|im)\s+(?:a|an)\s+([^.!?\n]+)/i)
    if (roleMatch) {
      const role = this.normalizeFactValue(roleMatch[1])
      pushAbstraction({
        type: 'identity',
        canonicalKey: `identity:role:${this.slugify(role)}`,
        canonicalValue: role,
        content: `The user describes themself as ${role}.`,
        summary: `Identity: ${role}`,
        keywords: [...extractTopicsFromText(role), 'identity'],
        importance: 8,
        confidence: 0.78,
        context: 'User self-description',
        source: 'user_prompt',
      })
    }

    const projectPatterns = [
      /\b(?:i am|i'm|im)?\s*(?:building|working on|creating|launching|developing|shipping)\s+([^.!?\n]+)/i,
      /\bmy project is\s+([^.!?\n]+)/i,
    ]
    for (const pattern of projectPatterns) {
      const match = normalizedPrompt.match(pattern)
      if (!match) continue
      const project = this.normalizeFactValue(match[1].replace(/\b(today|right now|currently)\b/gi, '').trim())
      pushAbstraction({
        type: 'project',
        canonicalKey: `project:${this.slugify(project)}`,
        canonicalValue: project,
        content: `The user is working on ${project}.`,
        summary: `Project: ${project}`,
        keywords: [...extractTopicsFromText(project), 'project'],
        importance: 9,
        confidence: 0.86,
        context: 'Current user project',
        source: 'user_prompt',
      })
      break
    }

    const preferencePatterns: Array<{ regex: RegExp; prefix: string }> = [
      { regex: /\bi\s+prefer\s+([^.!?\n]{3,100})/i, prefix: 'preference' },
      { regex: /\b(?:be|keep|stay|make it|answer)\s+(more\s+)?(direct|brief|concise|blunt|to the point)/i, prefix: 'style' },
      { regex: /\bno fluff\b/i, prefix: 'style' },
    ]
    for (const { regex, prefix } of preferencePatterns) {
      const match = normalizedPrompt.match(regex)
      if (!match) continue
      const preference = this.normalizeFactValue((match[2] || match[1] || match[0]).replace(/^more\s+/i, ''))
      if (prefix === 'preference' && isNarrativePreference(preference)) continue
      pushAbstraction({
        type: 'preference',
        canonicalKey: `${prefix}:${this.slugify(preference)}`,
        canonicalValue: preference,
        content: `The user prefers ${preference}.`,
        summary: `Preference: ${preference}`,
        keywords: [...extractTopicsFromText(preference), 'preference', 'style'],
        importance: prefix === 'style' ? 9 : 7,
        confidence: 0.9,
        context: 'User preference',
        source: 'user_prompt',
      })
    }

    // Feedback style preferences (blunt feedback, honest criticism, etc.)
    const feedbackStylePatterns: Array<{ regex: RegExp; style: string; antiStyle: string }> = [
      { regex: /\b(?:i want|give me|i need|i prefer)\s+(?:blunt|honest|real|raw|harsh|brutal|candid|frank|tough)\s+(?:feedback|criticism|critique|assessment|truth)/i, style: 'blunt feedback over encouragement', antiStyle: 'soft encouragement' },
      { regex: /\bdon'?t\s+(?:sugarcoat|soften|coddle|be nice about)\b/i, style: 'unfiltered directness', antiStyle: 'sugarcoating' },
      { regex: /\b(?:calm accountability|not hype)\b/i, style: 'calm accountability over hype', antiStyle: 'hype' },
      { regex: /\b(?:i want|give me|i need)\s+(?:encouragement|validation|support|reassurance)\b/i, style: 'encouragement and reassurance', antiStyle: 'harsh criticism' },
    ]
    for (const { regex, style, antiStyle } of feedbackStylePatterns) {
      if (!regex.test(promptLower)) continue
      const content = style.includes(' over ') || style.includes(antiStyle)
        ? `The user explicitly prefers ${style}.`
        : `The user explicitly prefers ${style} over ${antiStyle}.`
      pushAbstraction({
        type: 'preference',
        canonicalKey: `style:feedback-style:${this.slugify(style)}`,
        canonicalValue: style,
        content,
        summary: `Feedback preference: ${style}`,
        keywords: ['feedback', 'style', 'preference', ...extractTopicsFromText(style)],
        importance: 9,
        confidence: 0.94,
        context: 'User feedback style preference',
        source: 'user_prompt',
      })
    }

    // Anti-preferences (things the user explicitly dislikes)
    const antiPreferencePatterns: Array<{ regex: RegExp; extractGroup: number }> = [
      { regex: /\b(?:i (?:hate|dislike|can't stand|detest|loathe|despise))\s+([^.!?\n]{3,100})/i, extractGroup: 1 },
      { regex: /\b(?:don'?t (?:like|want|give me|use))\s+([^.!?\n]{3,80})/i, extractGroup: 1 },
      { regex: /\b(?:sick of|tired of|fed up with|bored (?:of|by|with))\s+([^.!?\n]{3,80})/i, extractGroup: 1 },
      { regex: /\b(?:stop|quit|enough with|no more)\s+([^.!?\n]{3,80})/i, extractGroup: 1 },
    ]
    for (const { regex, extractGroup } of antiPreferencePatterns) {
      const match = normalizedPrompt.match(regex)
      if (!match) continue
      const rawDislike = this.normalizeFactValue(match[extractGroup])
      const dislikeSegments = splitPreferenceSegments(rawDislike)
        .filter((entry) => !isPositivePreferenceClause(entry))
      const normalizedDislikes = dislikeSegments.length > 0
        ? dislikeSegments
        : (isPositivePreferenceClause(rawDislike) ? [] : [rawDislike])

      for (const dislike of normalizedDislikes) {
        if (dislike.length < 4 || dislike.length > 100) continue
        const antiPreferenceContext = creativePreferenceContext ? 'Creative/aesthetic anti-preference' : 'User anti-preference'
        const antiPreferenceSummary = creativePreferenceContext
          ? `Aesthetic anti-preference: dislikes ${dislike}`
          : `Anti-preference: dislikes ${dislike}`
        pushAbstraction({
          type: 'preference',
          canonicalKey: `anti-preference:${this.slugify(dislike)}`,
          canonicalValue: `dislikes ${dislike}`,
          content: `The user explicitly dislikes ${dislike}.`,
          summary: antiPreferenceSummary,
          keywords: [
            ...extractTopicsFromText(dislike),
            'anti-preference',
            'dislike',
            ...(creativePreferenceContext ? ['aesthetic', 'creative', 'taste'] : []),
          ],
          importance: 8,
          confidence: 0.88,
          context: antiPreferenceContext,
          source: 'user_prompt',
        })
      }
    }

    // Work-style and productivity patterns (best writing time, work habits)
    const workStylePatterns: Array<{ regex: RegExp; extractGroup: number; context: string }> = [
      { regex: /\b(?:i (?:write|work|code|think|create|focus) best)\s+(?:at|in|during|late at)\s+([^.!?\n]{3,60})/i, extractGroup: 1, context: 'Best working time' },
      { regex: /\b(?:my best (?:writing|working|creative|focus) (?:time|hours?))\s+(?:is|are)\s+([^.!?\n]{3,60})/i, extractGroup: 1, context: 'Best working time' },
      { regex: /\b(?:late at night|early morning|in the evening|after midnight)\b/i, extractGroup: 0, context: 'Preferred work schedule' },
    ]
    for (const { regex, extractGroup, context } of workStylePatterns) {
      const match = normalizedPrompt.match(regex)
      if (!match) continue
      const workStyle = this.normalizeFactValue(match[extractGroup])
      pushAbstraction({
        type: 'preference',
        canonicalKey: `work-style:${this.slugify(workStyle)}`,
        canonicalValue: workStyle,
        content: `${context}: ${workStyle}.`,
        summary: `Work style: ${workStyle}`,
        keywords: [...extractTopicsFromText(workStyle), 'work-style', 'productivity'],
        importance: 7,
        confidence: 0.82,
        context,
        source: 'user_prompt',
      })
    }

    // Aesthetic preferences (writing taste, creative values)
    const aestheticPatterns: Array<{ regex: RegExp; extractGroup: number }> = [
      { regex: /\bfor\s+(?:creative|writing|artistic)\s+work,\s*i am drawn to\s+([^.!?\n]{3,160})/i, extractGroup: 1 },
      { regex: /\b(?:i (?:love|value|admire|appreciate|enjoy|am drawn to))\s+(?:writing|stories|fiction|art|music|design|work)\s+(?:that|which|where)\s+([^.!?\n]{3,120})/i, extractGroup: 1 },
      { regex: /\b(?:my (?:writing|creative|artistic|aesthetic) (?:taste|preference|style|sensibility))\s+(?:is|leans|favors)\s+([^.!?\n]{3,100})/i, extractGroup: 1 },
      { regex: /\b(?:i (?:like|prefer|lean toward|gravitate to))\s+(?:dark|messy|raw|gritty|ambiguous|quiet|loud|clean|sparse|dense)\s+([^.!?\n]{3,80})/i, extractGroup: 0 },
    ]
    for (const { regex, extractGroup } of aestheticPatterns) {
      const match = normalizedPrompt.match(regex)
      if (!match) continue
      const aesthetic = this.normalizeFactValue(match[extractGroup])
      if (aesthetic.length < 4) continue
      pushAbstraction({
        type: 'preference',
        canonicalKey: `aesthetic:${this.slugify(aesthetic)}`,
        canonicalValue: aesthetic,
        content: `Aesthetic preference: ${aesthetic}.`,
        summary: `Aesthetic: ${aesthetic}`,
        keywords: [...extractTopicsFromText(aesthetic), 'aesthetic', 'creative', 'taste'],
        importance: 8,
        confidence: 0.84,
        context: 'Creative/aesthetic preference',
        source: 'user_prompt',
      })
    }

    const motifMatch = normalizedPrompt.match(/\b(?:drawn to|obsessed with|keep returning to|always come back to)\s+([^.!?\n]{8,180})/i)
    if (motifMatch) {
      const motifs = motifMatch[1]
        .split(/\s*,\s*|\s+and\s+/i)
        .map((entry) => this.normalizeFactValue(entry))
        .filter((entry) => entry.length >= 3 && entry.length <= 60)

      const summarizedMotifs = motifs.slice(0, 5)
      if (summarizedMotifs.length > 1) {
        const motifValue = summarizedMotifs.join(', ')
        pushAbstraction({
          type: 'preference',
          canonicalKey: `aesthetic:${this.slugify(motifValue)}`,
          canonicalValue: motifValue,
          content: `Recurring creative motifs: ${motifValue}.`,
          summary: `Creative themes: ${motifValue}`,
          keywords: [...summarizedMotifs.flatMap((entry) => extractTopicsFromText(entry)), 'aesthetic', 'motifs', 'creative'],
          importance: 8,
          confidence: 0.9,
          context: 'Recurring creative motifs',
          source: 'user_prompt',
        })
      }
    }

    const relationshipMatch = normalizedPrompt.match(/\bmy\s+(manager|wife|husband|partner|friend|boss|client|cofounder|co-founder|teammate|team|mentor)\b([^.!?\n]*)/i)
    if (relationshipMatch) {
      const counterpart = this.normalizeFactValue(`${relationshipMatch[1]}${relationshipMatch[2] || ''}`)
      pushAbstraction({
        type: 'relationship',
        canonicalKey: `relationship:${this.slugify(counterpart)}`,
        canonicalValue: counterpart,
        content: `The user referenced an active relationship with ${counterpart}.`,
        summary: `Relationship: ${counterpart}`,
        keywords: [...extractTopicsFromText(counterpart), 'relationship'],
        importance: 7,
        confidence: 0.72,
        context: 'Relevant counterpart in the user context',
        source: 'user_prompt',
      })
    }

    const constraintMatch = normalizedPrompt.match(/\b(?:can\'t|cannot|must|need to|only have|within|without)\s+([^.!?\n]{4,120})/i)
    if (constraintMatch) {
      const constraint = this.normalizeFactValue(constraintMatch[1])
      pushAbstraction({
        type: 'operating_constraint',
        canonicalKey: `constraint:${this.slugify(constraint)}`,
        canonicalValue: constraint,
        content: `The user is operating under this constraint: ${constraint}.`,
        summary: `Constraint: ${constraint}`,
        keywords: [...extractTopicsFromText(constraint), 'constraint'],
        importance: 8,
        confidence: 0.74,
        context: 'User-stated operating constraint',
        source: 'user_prompt',
      })
    }

    const tensionPatterns = [
      /\b(?:a real tension for me|the real tension for me|the real tension is)\s*:\s*([^.!?\n]+)/i,
      /\b(?:i'm|i am)\s+(stuck|torn|conflicted)\s+between\s+([^.!?\n]+)/i,
      /\b(?:worried|anxious|torn)\s+about\s+([^.!?\n]+)/i,
      /\b(?:the tension between|caught between|torn between)\s+([^.!?\n]+)/i,
      /\b(?:i want to (?:be|seem|look))\s+([^.!?\n]{3,80})\s+(?:but|yet|while|even though)\s+([^.!?\n]{3,80})/i,
    ]
    for (const pattern of tensionPatterns) {
      const match = normalizedPrompt.match(pattern)
      if (!match) continue
      const tension = this.normalizeFactValue(match[2] || match[1] || '')
      pushAbstraction({
        type: 'tension_snapshot',
        canonicalKey: `tension:${this.slugify(tension)}`,
        canonicalValue: tension,
        content: `Current tension: ${tension}.`,
        summary: `Tension: ${tension}`,
        keywords: [...extractTopicsFromText(tension), 'tension'],
        importance: 8,
        confidence: 0.76,
        context: 'Current user tension or tradeoff',
        source: 'user_prompt',
      })
      break
    }

    if (
      /\b(build|create|write|draft|outline|plan|ship|design|refactor)\b/.test(promptLower)
      && response.trim().length >= 80
    ) {
      const artifactSummary = response
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 180)
      pushAbstraction({
        type: 'artifact_summary',
        canonicalKey: `artifact:${this.slugify(prompt.slice(0, 80))}`,
        canonicalValue: artifactSummary,
        content: `Assistant output summary: ${artifactSummary}`,
        summary: `Artifact summary: ${artifactSummary.slice(0, 80)}${artifactSummary.length > 80 ? '...' : ''}`,
        keywords: [...extractTopicsFromText(prompt), ...extractTopicsFromText(artifactSummary), 'artifact'],
        importance: 6,
        confidence: 0.68,
        context: 'Summary of assistant-produced artifact or plan',
        source: 'assistant_response',
      })
    }

    return abstractions
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
