import { NextRequest, NextResponse } from 'next/server'
import { doc, runTransaction, setDoc } from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { getPersistenceMode } from '@/lib/db/persistence'
import { RateLimitRepository } from '@/lib/repositories/rateLimitRepository'
import { AgentService } from '@/lib/services/agentService'
import { LearningService } from '@/lib/services/learningService'
import type { LearningPattern, LearningPatternType } from '@/types/metaLearning'

const RATE_LIMIT = 30
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000

async function checkRateLimit(agentId: string): Promise<{ allowed: boolean; remaining: number }> {
  const mode = getPersistenceMode()

  if (mode !== 'firestore') {
    return RateLimitRepository.consumeAgentWindow({
      agentId,
      feature: 'meta_learning',
      maxRequests: RATE_LIMIT,
      windowMs: RATE_WINDOW_MS,
    })
  }

  const now = Date.now()
  const rateRef = doc(db, 'agents', agentId, 'rate_limits', 'meta_learning')

  return runTransaction(db, async (transaction) => {
    const snap = await transaction.get(rateRef)
    const data = snap.exists() ? (snap.data() as { count?: number; windowStart?: number }) : null
    const windowStart = data?.windowStart ?? 0
    const count = data?.count ?? 0

    if (!data || now - windowStart > RATE_WINDOW_MS) {
      transaction.set(rateRef, { count: 1, windowStart: now }, { merge: true })
      return { allowed: true, remaining: RATE_LIMIT - 1 }
    }

    if (count >= RATE_LIMIT) {
      return { allowed: false, remaining: 0 }
    }

    const newCount = count + 1
    transaction.update(rateRef, { count: newCount })
    return { allowed: true, remaining: RATE_LIMIT - newCount }
  }).catch(async (error) => {
    console.error('Rate limit transaction failed:', error)
    await setDoc(rateRef, { count: 1, windowStart: now }, { merge: true })
    return { allowed: true, remaining: RATE_LIMIT - 1 }
  })
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  void request

  try {
    const { id: agentId } = await params
    const data = await LearningService.getLearningState(agentId)

    if (!data) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({
      success: true,
      state: data.state,
      skills: data.skills,
    })
  } catch (error) {
    console.error('Error fetching meta-learning state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meta-learning state' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const { allowed, remaining } = await checkRateLimit(agentId)

    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again tomorrow.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }

    const body = await request.json()
    const { action } = body

    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    switch (action) {
      case 'analyze_conversation': {
        const { messages } = body

        if (!messages || !Array.isArray(messages)) {
          return NextResponse.json(
            { error: 'Messages array required' },
            { status: 400 }
          )
        }

        const result = await LearningService.analyzeConversation(
          agentId,
          messages as Array<{ content: string; type: 'user' | 'agent'; timestamp: string }>
        )

        if (!result) {
          return NextResponse.json(
            { error: 'Failed to analyze conversation' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          patternsFound: result.patternsFound,
          patterns: result.patterns,
          learningEvent: result.learningEvent,
          remaining,
        }, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        })
      }

      case 'generate_goals': {
        const goals = await LearningService.generateGoals(agentId)

        if (!goals) {
          return NextResponse.json(
            { error: 'Failed to generate goals' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          goalsGenerated: goals.length,
          goals,
          remaining,
        }, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        })
      }

      case 'update_skill': {
        const { category, patterns: recentPatterns } = body

        if (!category) {
          return NextResponse.json(
            { error: 'Category required' },
            { status: 400 }
          )
        }

        const skill = await LearningService.updateSkill(
          agentId,
          category as LearningPatternType,
          (recentPatterns || []) as LearningPattern[]
        )

        if (!skill) {
          return NextResponse.json(
            { error: 'Failed to update skill' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          skill,
          remaining,
        }, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        })
      }

      case 'create_adaptation': {
        const { description, patternIds } = body

        if (!description) {
          return NextResponse.json(
            { error: 'Description required' },
            { status: 400 }
          )
        }

        const adaptation = await LearningService.createAdaptation(
          agentId,
          description as string,
          Array.isArray(patternIds) ? patternIds as string[] : []
        )

        if (!adaptation) {
          return NextResponse.json(
            { error: 'Failed to create adaptation' },
            { status: 500 }
          )
        }

        return NextResponse.json({
          success: true,
          adaptation,
          remaining,
        }, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        })
      }

      default:
        return NextResponse.json(
          { error: 'Invalid action. Use: analyze_conversation, generate_goals, update_skill, create_adaptation' },
          { status: 400 }
        )
    }
  } catch (error) {
    console.error('Meta-learning route error:', error)
    return NextResponse.json(
      { error: 'Failed to process learning request' },
      { status: 500 }
    )
  }
}
