/**
 * Mentorship API Route - Phase 3
 *
 * Handles agent mentorship relationships, session management,
 * and mentor matching algorithms.
 */

import { NextRequest, NextResponse } from 'next/server'
import { db } from '@/lib/firebase'
import { doc, getDoc, getDocs, collection, query, where } from 'firebase/firestore'
import { MentorshipService } from '@/lib/services/mentorshipService'
import { AgentRecord, MentorshipFocus } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const agentId = searchParams.get('agentId')
    const status = searchParams.get('status')
    const findMatches = searchParams.get('findMatches') === 'true'
    const stats = searchParams.get('stats') === 'true'

    // Get stats for an agent
    if (stats && agentId) {
      const mentorshipStats = await MentorshipService.getAgentMentorshipStats(agentId)
      return NextResponse.json({ stats: mentorshipStats })
    }

    // Get by ID
    if (id) {
      const mentorship = await MentorshipService.getMentorshipById(id)
      if (!mentorship) {
        return NextResponse.json(
          { error: 'Mentorship not found' },
          { status: 404 }
        )
      }
      return NextResponse.json({ mentorship })
    }

    // Find mentor matches for an agent
    if (findMatches && agentId) {
      // Get the mentee agent
      const agentRef = doc(db, 'agents', agentId)
      const agentSnap = await getDoc(agentRef)

      if (!agentSnap.exists()) {
        return NextResponse.json(
          { error: 'Agent not found' },
          { status: 404 }
        )
      }

      const menteeAgent = { id: agentSnap.id, ...agentSnap.data() } as AgentRecord

      // Get all agents as potential mentors
      const agentsRef = collection(db, 'agents')
      const agentsSnap = await getDocs(agentsRef)
      const availableAgents = agentsSnap.docs.map(d => ({
        id: d.id,
        ...d.data()
      })) as AgentRecord[]

      // Find matches
      const matches = await MentorshipService.findMentorMatches(
        menteeAgent,
        availableAgents,
        5
      )

      return NextResponse.json({ matches })
    }

    // Get mentorships for an agent
    if (agentId) {
      const mentorships = await MentorshipService.getAgentMentorships(agentId)
      return NextResponse.json(mentorships)
    }

    // Get all mentorships (optionally filter by status)
    const allMentorships = await MentorshipService.getAllMentorships()

    if (status) {
      const filtered = allMentorships.filter(m => m.status === status)
      return NextResponse.json({ mentorships: filtered })
    }

    return NextResponse.json({ mentorships: allMentorships })
  } catch (error) {
    console.error('Get mentorship error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mentorship data' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { action } = body

    // Create new mentorship
    if (action === 'create') {
      const { mentorId, menteeId, focusAreas, initialFocus } = body

      if (!mentorId || !menteeId || !focusAreas || focusAreas.length === 0) {
        return NextResponse.json(
          { error: 'mentorId, menteeId, and focusAreas are required' },
          { status: 400 }
        )
      }

      const mentorship = await MentorshipService.createMentorship(
        mentorId,
        menteeId,
        focusAreas as MentorshipFocus[],
        initialFocus as MentorshipFocus | undefined
      )

      if (!mentorship) {
        return NextResponse.json(
          { error: 'Failed to create mentorship' },
          { status: 500 }
        )
      }

      return NextResponse.json({
        success: true,
        mentorship
      })
    }

    // Create a session
    if (action === 'create_session') {
      const { mentorshipId, topic, lessonContent, exercises } = body

      if (!mentorshipId || !topic || !lessonContent) {
        return NextResponse.json(
          { error: 'mentorshipId, topic, and lessonContent are required' },
          { status: 400 }
        )
      }

      const session = await MentorshipService.createSession(
        mentorshipId,
        topic,
        lessonContent,
        exercises || []
      )

      if (!session) {
        return NextResponse.json(
          { error: 'Failed to create session' },
          { status: 500 }
        )
      }

      const updatedMentorship = await MentorshipService.getMentorshipById(mentorshipId)
      return NextResponse.json({
        success: true,
        session,
        mentorship: updatedMentorship
      })
    }

    // Complete a session
    if (action === 'complete_session') {
      const { mentorshipId, sessionId, mentorFeedback, menteeFeedback, skillsImproved, objectivesCompleted } = body

      if (!mentorshipId || !sessionId) {
        return NextResponse.json(
          { error: 'mentorshipId and sessionId are required' },
          { status: 400 }
        )
      }

      const success = await MentorshipService.completeSession(
        mentorshipId,
        sessionId,
        {
          mentorFeedback,
          menteeFeedback,
          skillsImproved: skillsImproved || [],
          objectivesCompleted: objectivesCompleted || 0
        }
      )

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to complete session' },
          { status: 500 }
        )
      }

      const updatedMentorship = await MentorshipService.getMentorshipById(mentorshipId)
      return NextResponse.json({
        success: true,
        mentorship: updatedMentorship
      })
    }

    // Change focus area
    if (action === 'change_focus') {
      const { mentorshipId, newFocus } = body

      if (!mentorshipId || !newFocus) {
        return NextResponse.json(
          { error: 'mentorshipId and newFocus are required' },
          { status: 400 }
        )
      }

      const success = await MentorshipService.changeFocus(
        mentorshipId,
        newFocus as MentorshipFocus
      )

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to change focus (invalid focus area for this mentorship)' },
          { status: 400 }
        )
      }

      const updatedMentorship = await MentorshipService.getMentorshipById(mentorshipId)
      return NextResponse.json({
        success: true,
        mentorship: updatedMentorship
      })
    }

    // Update mentorship status
    if (action === 'update_status') {
      const { mentorshipId, status } = body

      if (!mentorshipId || !status) {
        return NextResponse.json(
          { error: 'mentorshipId and status are required' },
          { status: 400 }
        )
      }

      const validStatuses = ['active', 'completed', 'paused', 'terminated']
      if (!validStatuses.includes(status)) {
        return NextResponse.json(
          { error: 'Invalid status' },
          { status: 400 }
        )
      }

      const success = await MentorshipService.updateMentorshipStatus(mentorshipId, status)

      if (!success) {
        return NextResponse.json(
          { error: 'Failed to update status' },
          { status: 500 }
        )
      }

      const updatedMentorship = await MentorshipService.getMentorshipById(mentorshipId)
      return NextResponse.json({
        success: true,
        mentorship: updatedMentorship
      })
    }

    // Calculate compatibility between two agents
    if (action === 'calculate_compatibility') {
      const { mentorId, menteeId } = body

      if (!mentorId || !menteeId) {
        return NextResponse.json(
          { error: 'mentorId and menteeId are required' },
          { status: 400 }
        )
      }

      // Get both agents
      const mentorRef = doc(db, 'agents', mentorId)
      const menteeRef = doc(db, 'agents', menteeId)

      const [mentorSnap, menteeSnap] = await Promise.all([
        getDoc(mentorRef),
        getDoc(menteeRef)
      ])

      if (!mentorSnap.exists() || !menteeSnap.exists()) {
        return NextResponse.json(
          { error: 'One or both agents not found' },
          { status: 404 }
        )
      }

      const mentor = { id: mentorSnap.id, ...mentorSnap.data() } as AgentRecord
      const mentee = { id: menteeSnap.id, ...menteeSnap.data() } as AgentRecord

      const compatibility = await MentorshipService.calculateCompatibility(mentor, mentee)

      return NextResponse.json({ compatibility })
    }

    // Generate session prompt
    if (action === 'generate_session_prompt') {
      const { mentorshipId, topic } = body

      if (!mentorshipId || !topic) {
        return NextResponse.json(
          { error: 'mentorshipId and topic are required' },
          { status: 400 }
        )
      }

      const mentorship = await MentorshipService.getMentorshipById(mentorshipId)
      if (!mentorship) {
        return NextResponse.json(
          { error: 'Mentorship not found' },
          { status: 404 }
        )
      }

      // Get mentor and mentee agents
      const mentorRef = doc(db, 'agents', mentorship.mentorId)
      const menteeRef = doc(db, 'agents', mentorship.menteeId)

      const [mentorSnap, menteeSnap] = await Promise.all([
        getDoc(mentorRef),
        getDoc(menteeRef)
      ])

      if (!mentorSnap.exists() || !menteeSnap.exists()) {
        return NextResponse.json(
          { error: 'Mentor or mentee agent not found' },
          { status: 404 }
        )
      }

      const mentor = { id: mentorSnap.id, ...mentorSnap.data() } as AgentRecord
      const mentee = { id: menteeSnap.id, ...menteeSnap.data() } as AgentRecord

      const prompt = MentorshipService.generateSessionPrompt(mentorship, mentor, mentee, topic)

      return NextResponse.json({ prompt })
    }

    // Generate session with LLM
    if (action === 'generate_lesson') {
      const { mentorshipId, topic } = body

      if (!mentorshipId || !topic) {
        return NextResponse.json(
          { error: 'mentorshipId and topic are required' },
          { status: 400 }
        )
      }

      const mentorship = await MentorshipService.getMentorshipById(mentorshipId)
      if (!mentorship) {
        return NextResponse.json(
          { error: 'Mentorship not found' },
          { status: 404 }
        )
      }

      // Get mentor agent
      const mentorRef = doc(db, 'agents', mentorship.mentorId)
      const menteeRef = doc(db, 'agents', mentorship.menteeId)

      const [mentorSnap, menteeSnap] = await Promise.all([
        getDoc(mentorRef),
        getDoc(menteeRef)
      ])

      if (!mentorSnap.exists() || !menteeSnap.exists()) {
        return NextResponse.json(
          { error: 'Mentor or mentee agent not found' },
          { status: 404 }
        )
      }

      const mentor = { id: mentorSnap.id, ...mentorSnap.data() } as AgentRecord
      const mentee = { id: menteeSnap.id, ...menteeSnap.data() } as AgentRecord

      const prompt = MentorshipService.generateSessionPrompt(mentorship, mentor, mentee, topic)

      // Call LLM to generate lesson content
      const apiKey = process.env.GOOGLE_AI_API_KEY || process.env.GROQ_API_KEY

      if (!apiKey) {
        return NextResponse.json(
          { error: 'LLM API key not configured' },
          { status: 500 }
        )
      }

      let lessonContent: string

      if (process.env.GOOGLE_AI_API_KEY) {
        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${process.env.GOOGLE_AI_API_KEY}`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              contents: [{ role: 'user', parts: [{ text: prompt }] }],
              generationConfig: {
                temperature: 0.8,
                maxOutputTokens: 2000
              }
            })
          }
        )

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.status}`)
        }

        const data = await response.json()
        lessonContent = data.candidates?.[0]?.content?.parts?.[0]?.text || ''
      } else {
        // Fallback to Groq
        const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${process.env.GROQ_API_KEY}`,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            model: 'mixtral-8x7b-32768',
            messages: [{ role: 'user', content: prompt }],
            temperature: 0.8,
            max_tokens: 2000
          })
        })

        if (!response.ok) {
          throw new Error(`Groq API error: ${response.status}`)
        }

        const data = await response.json()
        lessonContent = data.choices?.[0]?.message?.content || ''
      }

      // Extract exercises from the lesson (simple parsing)
      const exerciseMatches = lessonContent.match(/exercise[s]?:?\s*\n?((?:[•\-\d]\s*.+\n?)+)/gi)
      const exercises = exerciseMatches
        ? exerciseMatches[0]
            .split(/[•\-\d]\s*/)
            .map(e => e.trim())
            .filter(e => e.length > 0)
        : [`Practice the concepts from: ${topic}`]

      // Create the session
      const session = await MentorshipService.createSession(
        mentorshipId,
        topic,
        lessonContent,
        exercises.slice(0, 5) // Limit to 5 exercises
      )

      const updatedMentorship = await MentorshipService.getMentorshipById(mentorshipId)

      return NextResponse.json({
        success: true,
        session,
        lessonContent,
        mentorship: updatedMentorship
      })
    }

    return NextResponse.json(
      { error: 'Invalid action' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Mentorship API error:', error)
    return NextResponse.json(
      { error: 'Failed to process mentorship request' },
      { status: 500 }
    )
  }
}
