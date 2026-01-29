import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  limit,
  runTransaction,
  setDoc
} from 'firebase/firestore'
import { metaLearningService } from '@/lib/services/metaLearningService'
import { LearningPattern, LearningGoal, LearningAdaptation, SkillProgression } from '@/types/metaLearning'
import { AgentRecord } from '@/types/database'

// Rate limiting: 30 requests per day per agent
const RATE_LIMIT = 30
const RATE_WINDOW_MS = 24 * 60 * 60 * 1000

function isMissingIndexError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error &&
    (error as { code?: string }).code === 'failed-precondition'
}

async function checkRateLimit(agentId: string): Promise<{ allowed: boolean; remaining: number }> {
  const now = Date.now()
  const rateRef = doc(db, 'agents', agentId, 'rate_limits', 'meta_learning')

  return await runTransaction(db, async (transaction) => {
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

// GET: Get meta-learning state for an agent
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    // Get agent
    const agentRef = doc(db, 'agents', agentId)
    const agentSnap = await getDoc(agentRef)

    if (!agentSnap.exists()) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const agent = { id: agentSnap.id, ...agentSnap.data() } as AgentRecord

    // Get stored patterns
    const patternsRef = collection(db, 'agents', agentId, 'learning_patterns')
    const patternsQuery = query(
      patternsRef,
      orderBy('lastObserved', 'desc'),
      limit(50)
    )
    const patternsSnap = await getDocs(patternsQuery)
    const patterns: LearningPattern[] = patternsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as LearningPattern))

    // Get stored goals
    const goalsRef = collection(db, 'agents', agentId, 'learning_goals')
    const goalsQuery = query(
      goalsRef,
      where('status', '==', 'active'),
      limit(10)
    )
    const goalsSnap = await getDocs(goalsQuery)
    const goals: LearningGoal[] = goalsSnap.docs.map(doc => ({
      id: doc.id,
      ...doc.data()
    } as LearningGoal))

    // Get stored adaptations
    const adaptationsRef = collection(db, 'agents', agentId, 'learning_adaptations')
    const adaptationsQuery = query(
      adaptationsRef,
      where('isActive', '==', true),
      orderBy('timestamp', 'desc'),
      limit(10)
    )
    let adaptations: LearningAdaptation[] = []
    try {
      const adaptationsSnap = await getDocs(adaptationsQuery)
      adaptations = adaptationsSnap.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as Omit<LearningAdaptation, 'id'>)
      }))
    } catch (error) {
      if (isMissingIndexError(error)) {
        const fallbackQuery = query(
          adaptationsRef,
          where('isActive', '==', true)
        )
        const adaptationsSnap = await getDocs(fallbackQuery)
        adaptations = adaptationsSnap.docs.map(doc => ({
          id: doc.id,
          ...(doc.data() as Omit<LearningAdaptation, 'id'>)
        }))
        adaptations = adaptations
          .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
          .slice(0, 10)
      } else {
        throw error
      }
    }

    // Build meta-learning state
    const state = metaLearningService.getMetaLearningState(
      agent,
      patterns,
      adaptations,
      goals
    )

    // Get skill progressions
    const skillsRef = collection(db, 'agents', agentId, 'skill_progressions')
    const skillsSnap = await getDocs(skillsRef)
    const skills: SkillProgression[] = skillsSnap.docs.map(doc => ({
      ...(doc.data() as SkillProgression)
    }))

    return NextResponse.json({
      success: true,
      state,
      skills
    })

  } catch (error) {
    console.error('Error fetching meta-learning state:', error)
    return NextResponse.json(
      { error: 'Failed to fetch meta-learning state' },
      { status: 500 }
    )
  }
}

// POST: Analyze and update learning patterns
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    // Check rate limit
    const { allowed, remaining } = await checkRateLimit(agentId)
    if (!allowed) {
      return NextResponse.json(
        { error: 'Rate limit exceeded. Try again tomorrow.' },
        { status: 429, headers: { 'X-RateLimit-Remaining': '0' } }
      )
    }

    const body = await request.json()
    const { action } = body

    // Get agent
    const agentRef = doc(db, 'agents', agentId)
    const agentSnap = await getDoc(agentRef)

    if (!agentSnap.exists()) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    const agent = { id: agentSnap.id, ...agentSnap.data() } as AgentRecord

    switch (action) {
      case 'analyze_conversation': {
        // Analyze recent messages for patterns
        const { messages } = body

        if (!messages || !Array.isArray(messages)) {
          return NextResponse.json(
            { error: 'Messages array required' },
            { status: 400 }
          )
        }

        // Detect patterns
        const patterns = metaLearningService.detectPatternsFromConversation(
          messages,
          agentId
        )

        // Store new patterns
        const patternsRef = collection(db, 'agents', agentId, 'learning_patterns')
        const savedPatterns: LearningPattern[] = []

        for (const pattern of patterns) {
          // Check if similar pattern exists
          const existingQuery = query(
            patternsRef,
            where('type', '==', pattern.type),
            where('pattern', '==', pattern.pattern),
            limit(1)
          )
          const existingSnap = await getDocs(existingQuery)

          if (existingSnap.empty) {
            // Create new pattern
            const docRef = await addDoc(patternsRef, pattern)
            savedPatterns.push({ ...pattern, id: docRef.id })
          } else {
            // Update existing pattern
            const existingDoc = existingSnap.docs[0]
            const existingPattern = existingDoc.data() as LearningPattern
            await updateDoc(existingDoc.ref, {
              observationCount: existingPattern.observationCount + 1,
              lastObserved: new Date().toISOString(),
              effectiveness: (existingPattern.effectiveness + pattern.effectiveness) / 2,
              confidence: Math.min(existingPattern.confidence + 0.05, 0.95)
            })
            savedPatterns.push({ ...existingPattern, id: existingDoc.id })
          }
        }

        // Create learning event
        const emotionalContext = agent.emotionalState?.dominantEmotion || 'trust'
        const learningEvent = metaLearningService.createLearningEvent(
          agentId,
          'conversation',
          'Analyzed conversation for learning patterns',
          savedPatterns,
          emotionalContext
        )

        // Store learning event
        const eventsRef = collection(db, 'agents', agentId, 'learning_events')
        await addDoc(eventsRef, learningEvent)

        return NextResponse.json({
          success: true,
          patternsFound: savedPatterns.length,
          patterns: savedPatterns,
          learningEvent,
          remaining
        }, {
          headers: { 'X-RateLimit-Remaining': remaining.toString() }
        })
      }

      case 'generate_goals': {
        // Get existing patterns
        const patternsRef = collection(db, 'agents', agentId, 'learning_patterns')
        const patternsSnap = await getDocs(patternsRef)
        const patterns: LearningPattern[] = patternsSnap.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as LearningPattern))

        // Generate goals
        const goals = metaLearningService.generateLearningGoals(agent, patterns)

        // Store goals
        const goalsRef = collection(db, 'agents', agentId, 'learning_goals')
        const savedGoals: LearningGoal[] = []

        for (const goal of goals) {
          const docRef = await addDoc(goalsRef, goal)
          savedGoals.push({ ...goal, id: docRef.id })
        }

        return NextResponse.json({
          success: true,
          goalsGenerated: savedGoals.length,
          goals: savedGoals,
          remaining
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

        // Get existing skill
        const skillsRef = collection(db, 'agents', agentId, 'skill_progressions')
        const skillQuery = query(
          skillsRef,
          where('category', '==', category),
          limit(1)
        )
        const skillSnap = await getDocs(skillQuery)

        const existingSkill = skillSnap.empty
          ? null
          : (skillSnap.docs[0].data() as SkillProgression)

        // Update skill
        const updatedSkill = metaLearningService.updateSkillProgression(
          existingSkill,
          recentPatterns || [],
          category
        )

        // Save skill
        if (skillSnap.empty) {
          await addDoc(skillsRef, updatedSkill)
        } else {
          await setDoc(skillSnap.docs[0].ref, updatedSkill, { merge: true })
        }

        return NextResponse.json({
          success: true,
          skill: updatedSkill,
          remaining
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

        // Get referenced patterns
        const patternsRef = collection(db, 'agents', agentId, 'learning_patterns')
        const patterns: LearningPattern[] = []

        if (patternIds && Array.isArray(patternIds)) {
          for (const patternId of patternIds) {
            const patternDoc = await getDoc(doc(patternsRef, patternId))
            if (patternDoc.exists()) {
              patterns.push({ id: patternDoc.id, ...patternDoc.data() } as LearningPattern)
            }
          }
        }

        // Create adaptation
        const adaptation = metaLearningService.createAdaptation(
          agentId,
          patterns,
          description
        )

        // Store adaptation
        const adaptationsRef = collection(db, 'agents', agentId, 'learning_adaptations')
        const docRef = await addDoc(adaptationsRef, adaptation)

        return NextResponse.json({
          success: true,
          adaptation: { ...adaptation, id: docRef.id },
          remaining
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
    console.error('Error in meta-learning:', error)
    return NextResponse.json(
      { error: 'Failed to process meta-learning request' },
      { status: 500 }
    )
  }
}
