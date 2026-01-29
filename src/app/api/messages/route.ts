import { NextRequest, NextResponse } from 'next/server'
import { MessageService } from '@/lib/services/messageService'
import { AgentService } from '@/lib/services/agentService'
import { achievementService } from '@/lib/services/achievementService'
import { emotionalService } from '@/lib/services/emotionalService'
import { AgentProgress, AgentRecord, AgentStats, CreateMessageData, MessageRecord } from '@/types/database'

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'are', 'but', 'not', 'you', 'that', 'with', 'this', 'from',
  'have', 'will', 'your', 'about', 'what', 'when', 'where', 'which', 'who', 'why',
  'how', 'can', 'could', 'should', 'would', 'there', 'their', 'they', 'them', 'then',
  'than', 'into', 'onto', 'here', 'just', 'like', 'some', 'more', 'most', 'much',
  'been', 'being', 'also', 'able', 'make', 'made', 'does', 'did', 'done', 'want'
])

const QUESTION_PREFIXES = new Set([
  'what', 'why', 'how', 'when', 'where', 'who', 'which',
  'can', 'could', 'should', 'would', 'do', 'does', 'did', 'is', 'are', 'will', 'may', 'might'
])

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
    uniqueTopics: [...(stats?.uniqueTopics || [])]
  }
}

function normalizeProgress(progress?: AgentProgress): AgentProgress {
  const base = achievementService.createDefaultProgress()
  return {
    ...base,
    ...progress,
    achievements: { ...(progress?.achievements || {}) },
    allocatedSkills: { ...(progress?.allocatedSkills || {}) }
  }
}

async function updateAgentFromMessage(message: MessageRecord): Promise<AgentRecord | null> {
  const agent = await AgentService.getAgentById(message.agentId)
  if (!agent) return null

  const stats = normalizeStats(agent.stats)
  const progress = normalizeProgress(agent.progress)
  const baseline = emotionalService.generateBaselineFromTraits(agent.coreTraits || {})
  let emotionalState = agent.emotionalState || emotionalService.createDefaultEmotionalState(baseline)
  let emotionalHistory = agent.emotionalHistory || []

  let emotionsDetected = 0
  if (message.type === 'user') {
    const emotionalUpdate = emotionalService.processMessage(
      { ...agent, emotionalState, emotionalHistory } as AgentRecord,
      message.content
    )
    emotionalState = emotionalUpdate.emotionalState
    emotionalHistory = emotionalUpdate.emotionalHistory
    emotionsDetected = emotionalUpdate.detectedEvents.length
  }

  const topics = extractTopicsFromText(message.content)
  const isQuestion = isLikelyQuestion(message.content)
  const isHelpful = message.type === 'agent' && message.content.trim().length >= 40
  const hadMessages = stats.totalMessages > 0
  const previousLastActive = stats.lastActiveDate
  const today = new Date().toISOString().split('T')[0]

  let updatedStats = achievementService.updateStatsFromInteraction(stats, {
    messageContent: message.content,
    isUserMessage: message.type === 'user',
    topics,
    isQuestion,
    isHelpful,
    emotionsDetected
  })

  if (message.type === 'user' && (!hadMessages || previousLastActive !== today)) {
    updatedStats = achievementService.startConversation(updatedStats)
  }

  updatedStats = achievementService.updateLongestConversation(updatedStats, updatedStats.totalMessages)

  const achievementsToUnlock = achievementService.checkAchievements({
    ...agent,
    stats: updatedStats,
    progress
  })

  let updatedProgress = progress
  if (achievementsToUnlock.length > 0) {
    const unlockResult = achievementService.unlockAchievements(progress, achievementsToUnlock)
    updatedProgress = unlockResult.progress
  }

  await AgentService.updateAgent(agent.id, {
    stats: updatedStats,
    progress: updatedProgress,
    emotionalState,
    emotionalHistory
  })

  return await AgentService.getAgentById(agent.id)
}

// GET /api/messages - Fetch messages (optionally filtered by room or agent)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const agentId = searchParams.get('agentId')
    const limit = searchParams.get('limit')

    let messages

    if (roomId) {
      messages = await MessageService.getMessagesByRoomId(roomId)
    } else if (agentId) {
      messages = await MessageService.getMessagesByAgentId(agentId)
    } else {
      messages = await MessageService.getRecentMessages(limit ? parseInt(limit) : 50)
    }

    return NextResponse.json({
      success: true,
      data: messages
    })
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const body: CreateMessageData = await request.json()

    // Validate required fields
    if (!body.content || !body.agentId) {
      return NextResponse.json(
        { success: false, error: 'Content and agentId are required' },
        { status: 400 }
      )
    }

    const newMessage = await MessageService.createMessage(body)

    if (!newMessage) {
      return NextResponse.json(
        { success: false, error: 'Failed to create message' },
        { status: 500 }
      )
    }

    const updatedAgent = await updateAgentFromMessage(newMessage)

    return NextResponse.json({
      success: true,
      data: newMessage,
      agent: updatedAgent
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create message:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create message' },
      { status: 500 }
    )
  }
}

// DELETE /api/messages - Delete a message
export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')

    if (!id) {
      return NextResponse.json(
        { success: false, error: 'id is required' },
        { status: 400 }
      )
    }

    const success = await MessageService.deleteMessage(id)

    if (!success) {
      return NextResponse.json(
        { success: false, error: 'Failed to delete message' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Failed to delete message:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to delete message' },
      { status: 500 }
    )
  }
}
