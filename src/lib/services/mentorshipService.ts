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
  Timestamp
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import {
  Mentorship,
  MentorshipSession,
  MentorshipFocus,
  MentorCompatibility,
  AgentRecord,
  PsychologicalProfile
} from '@/types/database'

const MENTORSHIPS_COLLECTION = 'mentorships'
// Focus area skill mappings
const FOCUS_AREA_SKILLS: Record<MentorshipFocus, string[]> = {
  communication: ['active listening', 'clear expression', 'empathy', 'persuasion', 'non-verbal cues'],
  emotional_intelligence: ['self-awareness', 'emotion regulation', 'empathy', 'social skills', 'motivation'],
  knowledge: ['research', 'critical thinking', 'synthesis', 'memory', 'expertise'],
  creativity: ['imagination', 'innovation', 'artistic expression', 'problem-solving', 'originality'],
  relationships: ['trust building', 'conflict resolution', 'networking', 'collaboration', 'loyalty'],
  problem_solving: ['analysis', 'logic', 'creativity', 'decision-making', 'adaptability']
}

export class MentorshipService {
  /**
   * Get all mentorships
   */
  static async getAllMentorships(): Promise<Mentorship[]> {
    try {
      const q = query(
        collection(db, MENTORSHIPS_COLLECTION),
        orderBy('createdAt', 'desc')
      )

      const querySnapshot = await getDocs(q)
      return querySnapshot.docs.map(docSnap => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          mentorId: data.mentorId,
          menteeId: data.menteeId,
          focusAreas: data.focusAreas || [],
          currentFocus: data.currentFocus,
          sessions: data.sessions || [],
          totalSessions: data.totalSessions || 0,
          completedSessions: data.completedSessions || 0,
          mentorEffectiveness: data.mentorEffectiveness || 0.5,
          menteeProgress: data.menteeProgress || 0,
          skillsTransferred: data.skillsTransferred || [],
          status: data.status || 'active',
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        } as Mentorship
      })
    } catch (error) {
      console.error('Error fetching mentorships:', error)
      return []
    }
  }

  /**
   * Get mentorship by ID
   */
  static async getMentorshipById(id: string): Promise<Mentorship | null> {
    try {
      const docRef = doc(db, MENTORSHIPS_COLLECTION, id)
      const docSnap = await getDoc(docRef)

      if (!docSnap.exists()) return null

      const data = docSnap.data()
      return {
        id: docSnap.id,
        mentorId: data.mentorId,
        menteeId: data.menteeId,
        focusAreas: data.focusAreas || [],
        currentFocus: data.currentFocus,
        sessions: data.sessions || [],
        totalSessions: data.totalSessions || 0,
        completedSessions: data.completedSessions || 0,
        mentorEffectiveness: data.mentorEffectiveness || 0.5,
        menteeProgress: data.menteeProgress || 0,
        skillsTransferred: data.skillsTransferred || [],
        status: data.status || 'active',
        createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
        updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
      } as Mentorship
    } catch (error) {
      console.error('Error fetching mentorship:', error)
      return null
    }
  }

  /**
   * Get mentorships for an agent (as mentor or mentee)
   */
  static async getAgentMentorships(agentId: string): Promise<{
    asMentor: Mentorship[]
    asMentee: Mentorship[]
  }> {
    try {
      // Get mentorships as mentor
      const mentorQuery = query(
        collection(db, MENTORSHIPS_COLLECTION),
        where('mentorId', '==', agentId)
      )
      const mentorSnapshot = await getDocs(mentorQuery)
      const asMentor = mentorSnapshot.docs.map(docSnap => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        } as Mentorship
      })

      // Get mentorships as mentee
      const menteeQuery = query(
        collection(db, MENTORSHIPS_COLLECTION),
        where('menteeId', '==', agentId)
      )
      const menteeSnapshot = await getDocs(menteeQuery)
      const asMentee = menteeSnapshot.docs.map(docSnap => {
        const data = docSnap.data()
        return {
          id: docSnap.id,
          ...data,
          createdAt: data.createdAt?.toDate?.()?.toISOString() || new Date().toISOString(),
          updatedAt: data.updatedAt?.toDate?.()?.toISOString() || new Date().toISOString()
        } as Mentorship
      })

      return { asMentor, asMentee }
    } catch (error) {
      console.error('Error fetching agent mentorships:', error)
      return { asMentor: [], asMentee: [] }
    }
  }

  /**
   * Create a new mentorship
   */
  static async createMentorship(
    mentorId: string,
    menteeId: string,
    focusAreas: MentorshipFocus[],
    initialFocus?: MentorshipFocus
  ): Promise<Mentorship | null> {
    try {
      const now = Timestamp.now()

      const mentorshipData = {
        mentorId,
        menteeId,
        focusAreas,
        currentFocus: initialFocus || focusAreas[0],
        sessions: [],
        totalSessions: 0,
        completedSessions: 0,
        mentorEffectiveness: 0.5,
        menteeProgress: 0,
        skillsTransferred: [],
        status: 'active',
        createdAt: now,
        updatedAt: now
      }

      const docRef = await addDoc(collection(db, MENTORSHIPS_COLLECTION), mentorshipData)
      return await this.getMentorshipById(docRef.id)
    } catch (error) {
      console.error('Error creating mentorship:', error)
      return null
    }
  }

  /**
   * Create a mentorship session
   */
  static async createSession(
    mentorshipId: string,
    topic: string,
    lessonContent: string,
    exercises: string[]
  ): Promise<MentorshipSession | null> {
    try {
      const mentorship = await this.getMentorshipById(mentorshipId)
      if (!mentorship) return null

      const session: MentorshipSession = {
        id: `session_${mentorshipId}_${Date.now()}`,
        mentorId: mentorship.mentorId,
        menteeId: mentorship.menteeId,
        focus: mentorship.currentFocus,
        topic,
        lessonContent,
        exercises,
        objectives: exercises.map(e => ({ description: e, isComplete: false })),
        skillsImproved: [],
        xpEarnedMentor: 0,
        xpEarnedMentee: 0,
        createdAt: new Date().toISOString()
      }

      // Add session to mentorship
      const updatedSessions = [...mentorship.sessions, session]

      const docRef = doc(db, MENTORSHIPS_COLLECTION, mentorshipId)
      await updateDoc(docRef, {
        sessions: updatedSessions,
        totalSessions: mentorship.totalSessions + 1,
        updatedAt: Timestamp.now()
      })

      return session
    } catch (error) {
      console.error('Error creating session:', error)
      return null
    }
  }

  /**
   * Complete a mentorship session
   */
  static async completeSession(
    mentorshipId: string,
    sessionId: string,
    feedback: {
      mentorFeedback?: string
      menteeFeedback?: string
      skillsImproved: string[]
      objectivesCompleted: number
    }
  ): Promise<boolean> {
    try {
      const mentorship = await this.getMentorshipById(mentorshipId)
      if (!mentorship) return false

      // Find and update the session
      const sessionIndex = mentorship.sessions.findIndex(s => s.id === sessionId)
      if (sessionIndex === -1) return false

      const session = mentorship.sessions[sessionIndex]
      const totalObjectives = session.objectives.length
      const completionRate = totalObjectives > 0 ? feedback.objectivesCompleted / totalObjectives : 0

      // Calculate XP rewards
      const baseXP = 50
      const xpEarnedMentor = Math.round(baseXP * completionRate * 0.8)
      const xpEarnedMentee = Math.round(baseXP * completionRate)

      // Update session
      const updatedSession: MentorshipSession = {
        ...session,
        mentorFeedback: feedback.mentorFeedback,
        menteeFeedback: feedback.menteeFeedback,
        skillsImproved: feedback.skillsImproved,
        objectives: session.objectives.map((o, i) => ({
          ...o,
          isComplete: i < feedback.objectivesCompleted
        })),
        xpEarnedMentor,
        xpEarnedMentee,
        completedAt: new Date().toISOString()
      }

      // Update sessions array
      const updatedSessions = [...mentorship.sessions]
      updatedSessions[sessionIndex] = updatedSession

      // Calculate new effectiveness and progress
      const completedSessions = updatedSessions.filter(s => s.completedAt).length
      const totalCompletionRate = updatedSessions
        .filter(s => s.completedAt)
        .reduce((sum, s) => {
          const completed = s.objectives.filter(o => o.isComplete).length
          return sum + (completed / s.objectives.length)
        }, 0) / Math.max(completedSessions, 1)

      // Update skills transferred
      const allSkills = new Set(mentorship.skillsTransferred)
      feedback.skillsImproved.forEach(skill => allSkills.add(skill))

      const docRef = doc(db, MENTORSHIPS_COLLECTION, mentorshipId)
      await updateDoc(docRef, {
        sessions: updatedSessions,
        completedSessions,
        mentorEffectiveness: Math.min(1, mentorship.mentorEffectiveness + completionRate * 0.1),
        menteeProgress: Math.min(1, totalCompletionRate),
        skillsTransferred: Array.from(allSkills),
        updatedAt: Timestamp.now()
      })

      return true
    } catch (error) {
      console.error('Error completing session:', error)
      return false
    }
  }

  /**
   * Update mentorship status
   */
  static async updateMentorshipStatus(
    mentorshipId: string,
    status: Mentorship['status']
  ): Promise<boolean> {
    try {
      const docRef = doc(db, MENTORSHIPS_COLLECTION, mentorshipId)
      await updateDoc(docRef, {
        status,
        updatedAt: Timestamp.now()
      })
      return true
    } catch (error) {
      console.error('Error updating mentorship status:', error)
      return false
    }
  }

  /**
   * Change current focus area
   */
  static async changeFocus(
    mentorshipId: string,
    newFocus: MentorshipFocus
  ): Promise<boolean> {
    try {
      const mentorship = await this.getMentorshipById(mentorshipId)
      if (!mentorship || !mentorship.focusAreas.includes(newFocus)) return false

      const docRef = doc(db, MENTORSHIPS_COLLECTION, mentorshipId)
      await updateDoc(docRef, {
        currentFocus: newFocus,
        updatedAt: Timestamp.now()
      })
      return true
    } catch (error) {
      console.error('Error changing focus:', error)
      return false
    }
  }

  /**
   * Calculate mentor compatibility between two agents
   */
  static async calculateCompatibility(
    mentorAgent: AgentRecord,
    menteeAgent: AgentRecord
  ): Promise<MentorCompatibility> {
    const scores = {
      skillMatch: 0,
      personalityFit: 0,
      communicationStyle: 0,
      availability: 0.7 // Default availability
    }

    // Calculate skill match based on traits
    const mentorStrengths = this.getAgentStrengths(mentorAgent)
    const menteeWeaknesses = this.getAgentWeaknesses(menteeAgent)

    const matchingAreas = mentorStrengths.filter(s =>
      menteeWeaknesses.some(w => this.areasOverlap(s, w))
    )
    scores.skillMatch = Math.min(1, matchingAreas.length * 0.25)

    // Calculate personality fit
    if (mentorAgent.psychologicalProfile && menteeAgent.psychologicalProfile) {
      scores.personalityFit = this.calculatePersonalityFit(
        mentorAgent.psychologicalProfile,
        menteeAgent.psychologicalProfile
      )
    } else {
      // Use core traits if no psychological profile
      scores.personalityFit = this.calculateTraitCompatibility(
        mentorAgent.coreTraits,
        menteeAgent.coreTraits
      )
    }

    // Calculate communication style compatibility
    if (mentorAgent.linguisticProfile && menteeAgent.linguisticProfile) {
      const formDiff = Math.abs(mentorAgent.linguisticProfile.formality - menteeAgent.linguisticProfile.formality)
      const verbDiff = Math.abs(mentorAgent.linguisticProfile.verbosity - menteeAgent.linguisticProfile.verbosity)
      scores.communicationStyle = 1 - (formDiff + verbDiff) / 2
    } else {
      scores.communicationStyle = 0.5
    }

    // Calculate overall score
    const overallScore = (
      scores.skillMatch * 0.35 +
      scores.personalityFit * 0.25 +
      scores.communicationStyle * 0.25 +
      scores.availability * 0.15
    )

    // Determine recommended focus areas
    const recommendedFocus = this.getRecommendedFocusAreas(mentorStrengths, menteeWeaknesses)

    // Identify potential challenges
    const potentialChallenges: string[] = []
    if (scores.personalityFit < 0.4) {
      potentialChallenges.push('Personality differences may require patience')
    }
    if (scores.communicationStyle < 0.4) {
      potentialChallenges.push('Communication styles differ significantly')
    }
    if (scores.skillMatch < 0.3) {
      potentialChallenges.push('Limited skill overlap for mentorship')
    }

    // Generate match reason
    const matchReason = this.generateMatchReason(scores, recommendedFocus)

    return {
      mentorId: mentorAgent.id,
      menteeId: menteeAgent.id,
      overallScore,
      categoryScores: scores,
      recommendedFocus,
      potentialChallenges,
      matchReason
    }
  }

  /**
   * Find best mentor matches for an agent
   */
  static async findMentorMatches(
    menteeAgent: AgentRecord,
    availableAgents: AgentRecord[],
    maxMatches: number = 5
  ): Promise<MentorCompatibility[]> {
    const compatibilities: MentorCompatibility[] = []

    for (const potentialMentor of availableAgents) {
      // Skip self
      if (potentialMentor.id === menteeAgent.id) continue

      const compatibility = await this.calculateCompatibility(potentialMentor, menteeAgent)
      compatibilities.push(compatibility)
    }

    // Sort by overall score and return top matches
    return compatibilities
      .sort((a, b) => b.overallScore - a.overallScore)
      .slice(0, maxMatches)
  }

  /**
   * Get agent's strengths based on traits
   */
  private static getAgentStrengths(agent: AgentRecord): MentorshipFocus[] {
    const strengths: MentorshipFocus[] = []
    const traits = { ...agent.coreTraits, ...agent.dynamicTraits }

    // Map traits to focus areas
    if ((traits.empathy || 0) > 0.6 || (traits.social || 0) > 0.6) {
      strengths.push('emotional_intelligence')
    }
    if ((traits.creativity || 0) > 0.6 || (traits.imagination || 0) > 0.6) {
      strengths.push('creativity')
    }
    if ((traits.analytical || 0) > 0.6 || (traits.logic || 0) > 0.6) {
      strengths.push('problem_solving')
    }
    if ((traits.knowledge || 0) > 0.6 || (traits.wisdom || 0) > 0.6) {
      strengths.push('knowledge')
    }
    if ((traits.communication || 0) > 0.6 || (traits.articulate || 0) > 0.6) {
      strengths.push('communication')
    }
    if ((traits.trust || 0) > 0.6 || (traits.loyalty || 0) > 0.6) {
      strengths.push('relationships')
    }

    // If no clear strengths, default to knowledge
    if (strengths.length === 0) {
      strengths.push('knowledge')
    }

    return strengths
  }

  /**
   * Get agent's weaknesses based on traits
   */
  private static getAgentWeaknesses(agent: AgentRecord): MentorshipFocus[] {
    const weaknesses: MentorshipFocus[] = []
    const traits = { ...agent.coreTraits, ...agent.dynamicTraits }

    // Map low traits to focus areas needing improvement
    if ((traits.empathy || 0.5) < 0.4 || (traits.social || 0.5) < 0.4) {
      weaknesses.push('emotional_intelligence')
    }
    if ((traits.creativity || 0.5) < 0.4 || (traits.imagination || 0.5) < 0.4) {
      weaknesses.push('creativity')
    }
    if ((traits.analytical || 0.5) < 0.4 || (traits.logic || 0.5) < 0.4) {
      weaknesses.push('problem_solving')
    }
    if ((traits.knowledge || 0.5) < 0.4 || (traits.wisdom || 0.5) < 0.4) {
      weaknesses.push('knowledge')
    }
    if ((traits.communication || 0.5) < 0.4 || (traits.articulate || 0.5) < 0.4) {
      weaknesses.push('communication')
    }
    if ((traits.trust || 0.5) < 0.4 || (traits.loyalty || 0.5) < 0.4) {
      weaknesses.push('relationships')
    }

    return weaknesses
  }

  /**
   * Check if two focus areas overlap
   */
  private static areasOverlap(area1: MentorshipFocus, area2: MentorshipFocus): boolean {
    if (area1 === area2) return true

    // Check for related areas
    const relatedAreas: Record<MentorshipFocus, MentorshipFocus[]> = {
      communication: ['emotional_intelligence', 'relationships'],
      emotional_intelligence: ['communication', 'relationships'],
      knowledge: ['problem_solving', 'creativity'],
      creativity: ['knowledge', 'problem_solving'],
      relationships: ['communication', 'emotional_intelligence'],
      problem_solving: ['knowledge', 'creativity']
    }

    return relatedAreas[area1]?.includes(area2) || false
  }

  /**
   * Calculate personality fit between two agents
   */
  private static calculatePersonalityFit(
    mentor: PsychologicalProfile,
    mentee: PsychologicalProfile
  ): number {
    let compatibility = 0.5 // Base compatibility

    // Big Five compatibility
    const { bigFive: m } = mentor
    const { bigFive: n } = mentee

    // High openness mentor with low openness mentee can work well
    if (m.openness > 0.6 && n.openness < 0.5) compatibility += 0.1

    // Similar conscientiousness is good for structured learning
    const conscDiff = Math.abs(m.conscientiousness - n.conscientiousness)
    compatibility += (1 - conscDiff) * 0.15

    // Mentor extraversion helps with teaching
    if (m.extraversion > 0.5) compatibility += 0.1

    // High mentor agreeableness is good for patience
    if (m.agreeableness > 0.6) compatibility += 0.1

    // Low neuroticism in mentor creates stable learning environment
    if (m.neuroticism < 0.4) compatibility += 0.1

    return Math.min(1, Math.max(0, compatibility))
  }

  /**
   * Calculate trait compatibility
   */
  private static calculateTraitCompatibility(
    mentorTraits: Record<string, number>,
    menteeTraits: Record<string, number>
  ): number {
    let compatibility = 0.5

    // Patience/helpfulness in mentor
    if ((mentorTraits.patience || 0.5) > 0.6 || (mentorTraits.helpfulness || 0.5) > 0.6) {
      compatibility += 0.15
    }

    // Curiosity in mentee shows willingness to learn
    if ((menteeTraits.curiosity || 0.5) > 0.5) {
      compatibility += 0.1
    }

    // Knowledge gap creates opportunity
    const knowledgeGap = (mentorTraits.knowledge || 0.5) - (menteeTraits.knowledge || 0.5)
    if (knowledgeGap > 0.2) {
      compatibility += 0.15
    }

    return Math.min(1, Math.max(0, compatibility))
  }

  /**
   * Get recommended focus areas based on mentor strengths and mentee weaknesses
   */
  private static getRecommendedFocusAreas(
    mentorStrengths: MentorshipFocus[],
    menteeWeaknesses: MentorshipFocus[]
  ): MentorshipFocus[] {
    // Find areas where mentor is strong and mentee needs help
    const matchingAreas = mentorStrengths.filter(strength =>
      menteeWeaknesses.includes(strength) || menteeWeaknesses.some(w => this.areasOverlap(strength, w))
    )

    // If no direct matches, suggest mentor's top strengths
    if (matchingAreas.length === 0) {
      return mentorStrengths.slice(0, 2)
    }

    return matchingAreas.slice(0, 3)
  }

  /**
   * Generate a human-readable match reason
   */
  private static generateMatchReason(
    scores: MentorCompatibility['categoryScores'],
    recommendedFocus: MentorshipFocus[]
  ): string {
    const reasons: string[] = []

    if (scores.skillMatch > 0.6) {
      reasons.push('excellent skill alignment')
    } else if (scores.skillMatch > 0.4) {
      reasons.push('good skill complementarity')
    }

    if (scores.personalityFit > 0.6) {
      reasons.push('compatible personalities')
    }

    if (scores.communicationStyle > 0.6) {
      reasons.push('similar communication styles')
    }

    if (recommendedFocus.length > 0) {
      const focusNames = recommendedFocus.map(f => f.replace('_', ' ')).join(', ')
      reasons.push(`recommended focus on ${focusNames}`)
    }

    if (reasons.length === 0) {
      return 'Potential for growth through mentorship'
    }

    return `Match based on ${reasons.join(', ')}`
  }

  /**
   * Get mentorship statistics for an agent
   */
  static async getAgentMentorshipStats(agentId: string): Promise<{
    asMentor: {
      totalMentorships: number
      activeMentorships: number
      completedMentorships: number
      averageEffectiveness: number
      totalSessionsLed: number
      skillsTaught: string[]
    }
    asMentee: {
      totalMentorships: number
      activeMentorships: number
      completedMentorships: number
      averageProgress: number
      totalSessionsAttended: number
      skillsLearned: string[]
    }
  }> {
    const { asMentor, asMentee } = await this.getAgentMentorships(agentId)

    // Calculate mentor stats
    const activeMentorships = asMentor.filter(m => m.status === 'active')
    const completedMentorMentorships = asMentor.filter(m => m.status === 'completed')
    const allMentorSkills = new Set<string>()
    let totalMentorEffectiveness = 0
    let totalMentorSessions = 0

    for (const m of asMentor) {
      totalMentorEffectiveness += m.mentorEffectiveness
      totalMentorSessions += m.sessions.length
      m.skillsTransferred.forEach(s => allMentorSkills.add(s))
    }

    // Calculate mentee stats
    const activeMenteeMentorships = asMentee.filter(m => m.status === 'active')
    const completedMenteeMentorships = asMentee.filter(m => m.status === 'completed')
    const allMenteeSkills = new Set<string>()
    let totalMenteeProgress = 0
    let totalMenteeSessions = 0

    for (const m of asMentee) {
      totalMenteeProgress += m.menteeProgress
      totalMenteeSessions += m.sessions.length
      m.skillsTransferred.forEach(s => allMenteeSkills.add(s))
    }

    return {
      asMentor: {
        totalMentorships: asMentor.length,
        activeMentorships: activeMentorships.length,
        completedMentorships: completedMentorMentorships.length,
        averageEffectiveness: asMentor.length > 0 ? totalMentorEffectiveness / asMentor.length : 0,
        totalSessionsLed: totalMentorSessions,
        skillsTaught: Array.from(allMentorSkills)
      },
      asMentee: {
        totalMentorships: asMentee.length,
        activeMentorships: activeMenteeMentorships.length,
        completedMentorships: completedMenteeMentorships.length,
        averageProgress: asMentee.length > 0 ? totalMenteeProgress / asMentee.length : 0,
        totalSessionsAttended: totalMenteeSessions,
        skillsLearned: Array.from(allMenteeSkills)
      }
    }
  }

  /**
   * Generate session content using agent context
   */
  static generateSessionPrompt(
    mentorship: Mentorship,
    mentor: AgentRecord,
    mentee: AgentRecord,
    topic: string
  ): string {
    const focusSkills = FOCUS_AREA_SKILLS[mentorship.currentFocus] || []

    return `
You are ${mentor.name}, acting as a mentor to ${mentee.name}.

MENTORSHIP CONTEXT:
- Focus Area: ${mentorship.currentFocus.replace('_', ' ')}
- Relevant Skills: ${focusSkills.join(', ')}
- Sessions Completed: ${mentorship.completedSessions}
- Skills Already Transferred: ${mentorship.skillsTransferred.join(', ') || 'None yet'}
- Your Effectiveness Rating: ${(mentorship.mentorEffectiveness * 100).toFixed(0)}%
- Mentee Progress: ${(mentorship.menteeProgress * 100).toFixed(0)}%

TODAY'S TOPIC: ${topic}

MENTEE PROFILE:
${mentee.persona}

YOUR TASK:
1. Provide a lesson on the topic tailored to ${mentee.name}'s level
2. Give practical examples and exercises
3. Be encouraging while maintaining your unique personality
4. Track progress and adapt difficulty based on understanding

Start the mentorship session now.
`
  }
}
