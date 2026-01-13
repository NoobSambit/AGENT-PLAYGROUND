/**
 * Challenge Service - Phase 2
 *
 * Handles collaborative challenges between agents including
 * debates, collaborations, puzzles, and creative challenges.
 *
 * Cost: Uses LLM calls during challenge execution (rate limited)
 */

import {
  Challenge,
  ChallengeTemplate,
  ChallengeType,
  ChallengeDifficulty,
  ChallengeStatus,
  ChallengeObjective,
  AgentRecord,
} from '@/types/database'

// Generate unique IDs
function generateId(): string {
  return `challenge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

function generateObjectiveId(): string {
  return `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Challenge type configurations
const CHALLENGE_TYPE_CONFIG: Record<ChallengeType, {
  icon: string
  description: string
  suggestedRounds: number
}> = {
  debate: {
    icon: '🎭',
    description: 'Structured argument exchange on a topic',
    suggestedRounds: 6,
  },
  collaboration: {
    icon: '🤝',
    description: 'Working together to achieve a shared goal',
    suggestedRounds: 5,
  },
  puzzle: {
    icon: '🧩',
    description: 'Solving a problem or riddle together',
    suggestedRounds: 4,
  },
  roleplay: {
    icon: '🎬',
    description: 'Acting out scenarios and characters',
    suggestedRounds: 8,
  },
  creative_collab: {
    icon: '🎨',
    description: 'Creating something together',
    suggestedRounds: 5,
  },
  negotiation: {
    icon: '⚖️',
    description: 'Finding common ground through discussion',
    suggestedRounds: 6,
  },
  teaching: {
    icon: '📚',
    description: 'One agent teaches another a concept',
    suggestedRounds: 5,
  },
  brainstorm: {
    icon: '💡',
    description: 'Generating ideas together',
    suggestedRounds: 4,
  },
}

// Pre-defined challenge templates
const CHALLENGE_TEMPLATES: ChallengeTemplate[] = [
  // Debate challenges
  {
    id: 'debate_philosophy',
    name: 'Philosophical Debate',
    type: 'debate',
    description: 'Engage in a structured philosophical debate',
    difficulty: 'medium',
    objectives: [
      'Present clear opening arguments',
      'Respond to counterarguments',
      'Find common ground',
      'Reach a conclusion',
    ],
    minParticipants: 2,
    maxParticipants: 2,
    xpReward: 100,
    systemPrompt: 'You are participating in a philosophical debate. Present your arguments clearly and respond thoughtfully to your opponent.',
    evaluationCriteria: ['Logic and reasoning', 'Respectful discourse', 'Creativity of arguments'],
    tags: ['philosophy', 'debate', 'intellectual'],
  },
  {
    id: 'debate_ethics',
    name: 'Ethics Dilemma',
    type: 'debate',
    description: 'Debate an ethical dilemma from different perspectives',
    difficulty: 'hard',
    objectives: [
      'Understand the ethical positions',
      'Present compelling arguments',
      'Consider consequences',
      'Synthesize perspectives',
    ],
    minParticipants: 2,
    maxParticipants: 3,
    xpReward: 150,
    systemPrompt: 'You are debating an ethical dilemma. Consider multiple perspectives and argue your position thoughtfully.',
    evaluationCriteria: ['Ethical reasoning', 'Consideration of consequences', 'Empathy'],
    tags: ['ethics', 'debate', 'moral'],
  },

  // Collaboration challenges
  {
    id: 'collab_story',
    name: 'Collaborative Story',
    type: 'creative_collab',
    description: 'Write a story together, each contributing to the narrative',
    difficulty: 'easy',
    objectives: [
      'Establish setting and characters',
      'Build narrative tension',
      'Create meaningful resolution',
    ],
    minParticipants: 2,
    maxParticipants: 4,
    xpReward: 80,
    systemPrompt: 'You are collaborating on a story. Build on what the previous writer contributed while adding your own creative elements.',
    evaluationCriteria: ['Creativity', 'Narrative coherence', 'Collaboration'],
    tags: ['creative', 'story', 'collaboration'],
  },
  {
    id: 'collab_invention',
    name: 'Invention Workshop',
    type: 'brainstorm',
    description: 'Brainstorm and design an invention together',
    difficulty: 'medium',
    objectives: [
      'Identify a problem to solve',
      'Generate creative solutions',
      'Refine the best idea',
      'Present the invention',
    ],
    minParticipants: 2,
    maxParticipants: 3,
    xpReward: 100,
    systemPrompt: 'You are brainstorming an invention together. Build on each other\'s ideas and be creative.',
    evaluationCriteria: ['Creativity', 'Practicality', 'Collaboration'],
    tags: ['brainstorm', 'creative', 'invention'],
  },

  // Puzzle challenges
  {
    id: 'puzzle_riddle',
    name: 'Riddle Exchange',
    type: 'puzzle',
    description: 'Take turns presenting and solving riddles',
    difficulty: 'easy',
    objectives: [
      'Present a clever riddle',
      'Attempt to solve partner\'s riddle',
      'Explain reasoning',
    ],
    minParticipants: 2,
    maxParticipants: 2,
    xpReward: 60,
    systemPrompt: 'You are participating in a riddle exchange. Present creative riddles and try to solve the ones presented to you.',
    evaluationCriteria: ['Riddle creativity', 'Problem-solving', 'Explanation clarity'],
    tags: ['puzzle', 'riddle', 'fun'],
  },
  {
    id: 'puzzle_mystery',
    name: 'Mystery Solving',
    type: 'puzzle',
    description: 'Work together to solve a mystery',
    difficulty: 'hard',
    objectives: [
      'Gather clues',
      'Form hypotheses',
      'Test theories',
      'Solve the mystery',
    ],
    minParticipants: 2,
    maxParticipants: 4,
    xpReward: 150,
    systemPrompt: 'You are working together to solve a mystery. Share observations, propose theories, and deduce the solution.',
    evaluationCriteria: ['Logical deduction', 'Collaboration', 'Creativity'],
    tags: ['puzzle', 'mystery', 'detective'],
  },

  // Roleplay challenges
  {
    id: 'roleplay_scenario',
    name: 'Scenario Roleplay',
    type: 'roleplay',
    description: 'Act out a scenario with assigned roles',
    difficulty: 'medium',
    objectives: [
      'Establish characters',
      'Drive the story forward',
      'Stay in character',
      'Reach a resolution',
    ],
    minParticipants: 2,
    maxParticipants: 4,
    xpReward: 90,
    systemPrompt: 'You are roleplaying a scenario. Stay in character and interact naturally with other participants.',
    evaluationCriteria: ['Character consistency', 'Creativity', 'Story contribution'],
    tags: ['roleplay', 'acting', 'story'],
  },

  // Negotiation challenges
  {
    id: 'negotiation_treaty',
    name: 'Treaty Negotiation',
    type: 'negotiation',
    description: 'Negotiate terms of an agreement',
    difficulty: 'hard',
    objectives: [
      'State your position',
      'Understand opponent\'s needs',
      'Find compromises',
      'Reach an agreement',
    ],
    minParticipants: 2,
    maxParticipants: 3,
    xpReward: 130,
    systemPrompt: 'You are negotiating an agreement. Advocate for your interests while seeking common ground.',
    evaluationCriteria: ['Negotiation skill', 'Compromise', 'Outcome fairness'],
    tags: ['negotiation', 'diplomacy', 'strategy'],
  },

  // Teaching challenges
  {
    id: 'teaching_concept',
    name: 'Concept Teaching',
    type: 'teaching',
    description: 'Teach a concept to another agent',
    difficulty: 'medium',
    objectives: [
      'Explain the concept clearly',
      'Answer questions',
      'Verify understanding',
      'Provide examples',
    ],
    minParticipants: 2,
    maxParticipants: 2,
    xpReward: 100,
    achievementUnlock: 'mentor',
    systemPrompt: 'You are teaching a concept. Be patient, clear, and adjust your teaching style to the learner.',
    evaluationCriteria: ['Clarity', 'Patience', 'Learning outcome'],
    tags: ['teaching', 'education', 'knowledge'],
  },

  // Expert challenges
  {
    id: 'expert_symposium',
    name: 'Expert Symposium',
    type: 'debate',
    description: 'Present and defend expertise on a topic',
    difficulty: 'expert',
    objectives: [
      'Present expert knowledge',
      'Defend against challenges',
      'Integrate others\' insights',
      'Synthesize conclusions',
    ],
    minParticipants: 3,
    maxParticipants: 5,
    xpReward: 200,
    systemPrompt: 'You are participating in an expert symposium. Share your knowledge and engage with others\' perspectives.',
    evaluationCriteria: ['Expertise demonstrated', 'Intellectual engagement', 'Synthesis'],
    tags: ['expert', 'academic', 'discussion'],
  },
]

// Difficulty XP multipliers
const DIFFICULTY_MULTIPLIERS: Record<ChallengeDifficulty, number> = {
  easy: 0.8,
  medium: 1.0,
  hard: 1.5,
  expert: 2.0,
}

class ChallengeService {
  /**
   * Get challenge type configuration
   */
  getTypeConfig(type: ChallengeType) {
    return CHALLENGE_TYPE_CONFIG[type]
  }

  /**
   * Get all challenge types
   */
  getAvailableTypes(): Array<{
    type: ChallengeType
    icon: string
    description: string
  }> {
    return Object.entries(CHALLENGE_TYPE_CONFIG).map(([type, config]) => ({
      type: type as ChallengeType,
      ...config,
    }))
  }

  /**
   * Get all challenge templates
   */
  getTemplates(filters?: {
    type?: ChallengeType
    difficulty?: ChallengeDifficulty
    participantCount?: number
    tags?: string[]
  }): ChallengeTemplate[] {
    let templates = [...CHALLENGE_TEMPLATES]

    if (filters) {
      if (filters.type) {
        templates = templates.filter(t => t.type === filters.type)
      }
      if (filters.difficulty) {
        templates = templates.filter(t => t.difficulty === filters.difficulty)
      }
      if (filters.participantCount) {
        templates = templates.filter(
          t => filters.participantCount! >= t.minParticipants &&
               filters.participantCount! <= t.maxParticipants
        )
      }
      if (filters.tags && filters.tags.length > 0) {
        templates = templates.filter(
          t => filters.tags!.some(tag => t.tags.includes(tag))
        )
      }
    }

    return templates
  }

  /**
   * Get a specific template by ID
   */
  getTemplate(templateId: string): ChallengeTemplate | undefined {
    return CHALLENGE_TEMPLATES.find(t => t.id === templateId)
  }

  /**
   * Create a new challenge from a template
   */
  createChallenge(
    templateId: string,
    participants: string[],
    initiator: string
  ): Challenge {
    const template = this.getTemplate(templateId)

    if (!template) {
      throw new Error(`Template not found: ${templateId}`)
    }

    if (participants.length < template.minParticipants) {
      throw new Error(`Not enough participants. Minimum: ${template.minParticipants}`)
    }

    if (participants.length > template.maxParticipants) {
      throw new Error(`Too many participants. Maximum: ${template.maxParticipants}`)
    }

    const now = new Date().toISOString()
    const config = CHALLENGE_TYPE_CONFIG[template.type]

    const objectives: ChallengeObjective[] = template.objectives.map(desc => ({
      id: generateObjectiveId(),
      description: desc,
      isComplete: false,
    }))

    return {
      id: generateId(),
      templateId,
      type: template.type,
      name: template.name,
      description: template.description,
      difficulty: template.difficulty,
      participants,
      initiator,
      status: 'pending',
      objectives,
      currentRound: 0,
      maxRounds: config.suggestedRounds,
      messages: [],
      xpAwarded: {},
      achievementsUnlocked: [],
      startedAt: now,
      createdAt: now,
    }
  }

  /**
   * Start a challenge
   */
  startChallenge(challenge: Challenge): Challenge {
    return {
      ...challenge,
      status: 'in_progress',
      startedAt: new Date().toISOString(),
    }
  }

  /**
   * Generate the system prompt for a challenge round
   */
  generateRoundPrompt(
    challenge: Challenge,
    agent: AgentRecord,
    roundNumber: number
  ): string {
    const template = this.getTemplate(challenge.templateId)

    let prompt = `Challenge: ${challenge.name}
Type: ${challenge.type}
Round: ${roundNumber + 1} of ${challenge.maxRounds}
Your role: Participant

${template?.systemPrompt || 'Participate in this challenge thoughtfully.'}

Objectives to achieve:
${challenge.objectives.map((obj, i) => `${i + 1}. ${obj.description} ${obj.isComplete ? '✓' : ''}`).join('\n')}

Your persona: ${agent.persona}

`

    // Add conversation history context
    if (challenge.messages.length > 0) {
      const recentMessages = challenge.messages.slice(-5)
      prompt += '\nRecent messages:\n'
      for (const msg of recentMessages) {
        prompt += `[${msg.agentName}]: ${msg.content.substring(0, 200)}...\n`
      }
    }

    // Add round-specific guidance
    const progressRatio = roundNumber / challenge.maxRounds

    if (progressRatio < 0.3) {
      prompt += '\n[Early stage: Focus on establishing your position and understanding others]'
    } else if (progressRatio < 0.7) {
      prompt += '\n[Middle stage: Engage deeply with ideas and work toward objectives]'
    } else {
      prompt += '\n[Final stage: Work toward conclusion and resolution]'
    }

    return prompt
  }

  /**
   * Add a message to the challenge
   */
  addMessage(
    challenge: Challenge,
    agentId: string,
    agentName: string,
    content: string
  ): Challenge {
    const now = new Date().toISOString()

    const newMessage = {
      id: `msg_${Date.now()}`,
      agentId,
      agentName,
      content,
      timestamp: now,
      round: challenge.currentRound,
    }

    return {
      ...challenge,
      messages: [...challenge.messages, newMessage],
    }
  }

  /**
   * Advance to the next round
   */
  advanceRound(challenge: Challenge): Challenge {
    const nextRound = challenge.currentRound + 1

    if (nextRound >= challenge.maxRounds) {
      return this.completeChallenge(challenge)
    }

    return {
      ...challenge,
      currentRound: nextRound,
    }
  }

  /**
   * Complete an objective
   */
  completeObjective(challenge: Challenge, objectiveId: string): Challenge {
    const objectives = challenge.objectives.map(obj => {
      if (obj.id === objectiveId && !obj.isComplete) {
        return {
          ...obj,
          isComplete: true,
          completedAt: new Date().toISOString(),
        }
      }
      return obj
    })

    return {
      ...challenge,
      objectives,
    }
  }

  /**
   * Complete the challenge
   */
  completeChallenge(challenge: Challenge): Challenge {
    const now = new Date().toISOString()

    // Calculate completion percentage
    const completedObjectives = challenge.objectives.filter(o => o.isComplete).length
    const completionPercentage = completedObjectives / challenge.objectives.length

    // Determine success
    const success = completionPercentage >= 0.5

    // Calculate score
    const baseScore = completionPercentage * 100
    const difficultyMultiplier = DIFFICULTY_MULTIPLIERS[challenge.difficulty]
    const score = Math.round(baseScore * difficultyMultiplier)

    // Calculate XP awards
    const template = this.getTemplate(challenge.templateId)
    const baseXP = template?.xpReward || 50
    const xpAwarded: Record<string, number> = {}

    // Award XP to each participant
    for (const participantId of challenge.participants) {
      const participantMessages = challenge.messages.filter(m => m.agentId === participantId)
      const participationBonus = Math.min(participantMessages.length / 3, 1) // Bonus for active participation
      const earnedXP = Math.round(baseXP * (completionPercentage + participationBonus * 0.2) * difficultyMultiplier)
      xpAwarded[participantId] = earnedXP
    }

    // Generate participant scores based on message count and quality proxy
    const participantScores: Record<string, number> = {}
    for (const participantId of challenge.participants) {
      const participantMessages = challenge.messages.filter(m => m.agentId === participantId)
      const avgLength = participantMessages.length > 0
        ? participantMessages.reduce((sum, m) => sum + m.content.length, 0) / participantMessages.length
        : 0
      participantScores[participantId] = Math.round(
        (participantMessages.length * 10 + avgLength / 20) * difficultyMultiplier
      )
    }

    // Determine achievements unlocked
    const achievementsUnlocked: string[] = []
    if (template?.achievementUnlock && success) {
      achievementsUnlocked.push(template.achievementUnlock)
    }
    if (score >= 80) {
      achievementsUnlocked.push('challenge_master')
    }

    return {
      ...challenge,
      status: success ? 'completed' : 'failed',
      completedAt: now,
      evaluation: {
        success,
        score,
        feedback: this.generateFeedback(challenge, success, completionPercentage),
        participantScores,
      },
      xpAwarded,
      achievementsUnlocked,
    }
  }

  /**
   * Generate feedback for a completed challenge
   */
  private generateFeedback(
    challenge: Challenge,
    success: boolean,
    completionPercentage: number
  ): string {
    if (success) {
      if (completionPercentage === 1) {
        return 'Excellent work! All objectives were completed successfully. The collaboration demonstrated strong teamwork and creative thinking.'
      } else if (completionPercentage >= 0.75) {
        return 'Great job! Most objectives were achieved. The participants showed good cooperation and problem-solving skills.'
      } else {
        return 'The challenge was completed, though there\'s room for improvement. Consider focusing more on the remaining objectives in future challenges.'
      }
    } else {
      return 'The challenge was not successfully completed this time. Review the objectives and try a different approach. Every attempt is a learning opportunity!'
    }
  }

  /**
   * Abandon a challenge
   */
  abandonChallenge(challenge: Challenge): Challenge {
    return {
      ...challenge,
      status: 'abandoned',
      completedAt: new Date().toISOString(),
    }
  }

  /**
   * Get challenge statistics
   */
  getChallengeStats(challenges: Challenge[]): {
    totalChallenges: number
    completed: number
    failed: number
    abandoned: number
    byType: Record<string, number>
    byDifficulty: Record<string, number>
    totalXPEarned: number
    averageScore: number
    winRate: number
  } {
    const byType: Record<string, number> = {}
    const byDifficulty: Record<string, number> = {}
    let completed = 0
    let failed = 0
    let abandoned = 0
    let totalXP = 0
    let totalScore = 0
    let scoredChallenges = 0

    for (const challenge of challenges) {
      byType[challenge.type] = (byType[challenge.type] || 0) + 1
      byDifficulty[challenge.difficulty] = (byDifficulty[challenge.difficulty] || 0) + 1

      switch (challenge.status) {
        case 'completed':
          completed++
          if (challenge.evaluation) {
            totalScore += challenge.evaluation.score
            scoredChallenges++
          }
          break
        case 'failed':
          failed++
          if (challenge.evaluation) {
            totalScore += challenge.evaluation.score
            scoredChallenges++
          }
          break
        case 'abandoned':
          abandoned++
          break
      }

      // Sum up XP
      for (const xp of Object.values(challenge.xpAwarded)) {
        totalXP += xp
      }
    }

    return {
      totalChallenges: challenges.length,
      completed,
      failed,
      abandoned,
      byType,
      byDifficulty,
      totalXPEarned: totalXP,
      averageScore: scoredChallenges > 0 ? Math.round(totalScore / scoredChallenges) : 0,
      winRate: completed + failed > 0 ? completed / (completed + failed) : 0,
    }
  }

  /**
   * Get challenges for an agent
   */
  getChallengesForAgent(
    challenges: Challenge[],
    agentId: string,
    filters?: {
      status?: ChallengeStatus
      type?: ChallengeType
    }
  ): Challenge[] {
    let filtered = challenges.filter(c => c.participants.includes(agentId))

    if (filters) {
      if (filters.status) {
        filtered = filtered.filter(c => c.status === filters.status)
      }
      if (filters.type) {
        filtered = filtered.filter(c => c.type === filters.type)
      }
    }

    return filtered.sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )
  }

  /**
   * Suggest a challenge for agents based on their profiles
   */
  suggestChallenge(agents: AgentRecord[]): ChallengeTemplate | undefined {
    const count = agents.length

    // Get templates that match participant count
    const suitable = CHALLENGE_TEMPLATES.filter(
      t => count >= t.minParticipants && count <= t.maxParticipants
    )

    if (suitable.length === 0) return undefined

    // Prefer medium difficulty for variety
    const mediumDifficulty = suitable.filter(t => t.difficulty === 'medium')
    if (mediumDifficulty.length > 0) {
      return mediumDifficulty[Math.floor(Math.random() * mediumDifficulty.length)]
    }

    // Otherwise return random
    return suitable[Math.floor(Math.random() * suitable.length)]
  }

  /**
   * Evaluate message quality for scoring
   */
  evaluateMessageQuality(content: string): {
    length: 'short' | 'medium' | 'long'
    hasQuestions: boolean
    hasReferences: boolean
    engagement: number
  } {
    const wordCount = content.split(/\s+/).length

    let length: 'short' | 'medium' | 'long' = 'medium'
    if (wordCount < 30) length = 'short'
    else if (wordCount > 100) length = 'long'

    const hasQuestions = content.includes('?')
    const hasReferences = /you (said|mentioned|noted)|earlier|previous/i.test(content)

    // Calculate engagement score
    let engagement = 0.5
    if (length === 'medium') engagement += 0.1
    if (length === 'long') engagement += 0.05
    if (hasQuestions) engagement += 0.15
    if (hasReferences) engagement += 0.2

    return { length, hasQuestions, hasReferences, engagement: Math.min(1, engagement) }
  }
}

// Export singleton instance
export const challengeService = new ChallengeService()

// Export class for testing
export { ChallengeService }

// Export templates for reference
export { CHALLENGE_TEMPLATES }
