/**
 * Psychological Profile Service - Phase 2
 *
 * Generates and manages psychological profiles for agents
 * including Big Five, MBTI, Enneagram, and other assessments.
 *
 * Cost: 0 API calls (calculated from existing agent data)
 */

import {
  PsychologicalProfile,
  BigFiveProfile,
  MBTIProfile,
  EnneagramProfile,
  CognitiveStyle,
  MotivationalProfile,
  AgentRecord,
  EmotionType,
} from '@/types/database'

// Generate unique IDs
function generateId(): string {
  return `profile_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// MBTI type descriptions
const MBTI_DESCRIPTIONS: Record<string, string> = {
  INTJ: 'The Architect - Strategic, independent, and determined',
  INTP: 'The Logician - Innovative, curious, and analytical',
  ENTJ: 'The Commander - Bold, imaginative, and strong-willed',
  ENTP: 'The Debater - Smart, curious, and intellectual',
  INFJ: 'The Advocate - Creative, insightful, and principled',
  INFP: 'The Mediator - Poetic, kind, and altruistic',
  ENFJ: 'The Protagonist - Charismatic, inspiring, and natural leader',
  ENFP: 'The Campaigner - Enthusiastic, creative, and sociable',
  ISTJ: 'The Logistician - Practical, fact-minded, and reliable',
  ISFJ: 'The Defender - Dedicated, warm, and protective',
  ESTJ: 'The Executive - Excellent administrators and managers',
  ESFJ: 'The Consul - Caring, social, and community-minded',
  ISTP: 'The Virtuoso - Bold, practical, and experimental',
  ISFP: 'The Adventurer - Flexible, charming, and artistic',
  ESTP: 'The Entrepreneur - Smart, energetic, and perceptive',
  ESFP: 'The Entertainer - Spontaneous, energetic, and fun',
}

// Enneagram type descriptions
const ENNEAGRAM_DESCRIPTIONS: Record<number, {
  name: string
  motivation: string
  fear: string
}> = {
  1: { name: 'The Perfectionist', motivation: 'Being good and right', fear: 'Being corrupt or defective' },
  2: { name: 'The Helper', motivation: 'Being loved and needed', fear: 'Being unwanted or unloved' },
  3: { name: 'The Achiever', motivation: 'Being valuable and admired', fear: 'Being worthless or without value' },
  4: { name: 'The Individualist', motivation: 'Being unique and authentic', fear: 'Having no identity or significance' },
  5: { name: 'The Investigator', motivation: 'Being capable and competent', fear: 'Being useless or helpless' },
  6: { name: 'The Loyalist', motivation: 'Having security and support', fear: 'Being without support or guidance' },
  7: { name: 'The Enthusiast', motivation: 'Being happy and satisfied', fear: 'Being trapped in pain or deprivation' },
  8: { name: 'The Challenger', motivation: 'Being self-reliant and strong', fear: 'Being controlled or harmed by others' },
  9: { name: 'The Peacemaker', motivation: 'Having peace and harmony', fear: 'Loss of connection or fragmentation' },
}

class PsychologicalProfileService {
  /**
   * Generate a complete psychological profile from agent data
   */
  generateProfile(agent: AgentRecord): PsychologicalProfile {
    const now = new Date().toISOString()

    // Generate Big Five from traits and persona
    const bigFive = this.generateBigFive(agent)

    // Generate MBTI from Big Five and linguistic profile
    const mbti = this.generateMBTI(agent, bigFive)

    // Generate Enneagram from persona and goals
    const enneagram = this.generateEnneagram(agent, bigFive)

    // Generate cognitive style
    const cognitiveStyle = this.generateCognitiveStyle(agent, bigFive)

    // Generate motivational profile
    const motivationalProfile = this.generateMotivationalProfile(agent, enneagram)

    // Calculate emotional intelligence
    const emotionalIntelligence = this.calculateEmotionalIntelligence(agent)

    // Determine communication style
    const communicationStyle = this.determineCommunicationStyle(agent, bigFive, mbti)

    // Determine attachment style
    const attachmentStyle = this.determineAttachmentStyle(bigFive)

    // Generate summary and insights
    const { summary, strengths, challenges } = this.generateSummary(
      agent,
      bigFive,
      mbti,
      enneagram
    )

    return {
      id: generateId(),
      agentId: agent.id,
      bigFive,
      mbti,
      enneagram,
      cognitiveStyle,
      emotionalIntelligence,
      motivationalProfile,
      communicationStyle,
      attachmentStyle,
      summary,
      strengths,
      challenges,
      createdAt: now,
      updatedAt: now,
    }
  }

  /**
   * Generate Big Five profile from agent traits
   */
  generateBigFive(agent: AgentRecord): BigFiveProfile {
    const coreTraits = agent.coreTraits || {}
    const dynamicTraits = agent.dynamicTraits || {}
    const persona = agent.persona.toLowerCase()

    // Base values from traits with reasonable defaults
    let openness = coreTraits.curiosity || 0.5
    let conscientiousness = 0.5
    let extraversion = coreTraits.friendliness || 0.5
    let agreeableness = coreTraits.helpfulness || 0.5
    let neuroticism = 0.3

    // Adjust based on persona keywords
    if (persona.includes('creative') || persona.includes('artistic') || persona.includes('imaginative')) {
      openness += 0.15
    }
    if (persona.includes('organized') || persona.includes('disciplined') || persona.includes('meticulous')) {
      conscientiousness += 0.2
    }
    if (persona.includes('outgoing') || persona.includes('social') || persona.includes('energetic')) {
      extraversion += 0.2
    }
    if (persona.includes('introvert') || persona.includes('quiet') || persona.includes('reserved')) {
      extraversion -= 0.2
    }
    if (persona.includes('kind') || persona.includes('compassionate') || persona.includes('empathetic')) {
      agreeableness += 0.15
    }
    if (persona.includes('analytical') || persona.includes('logical') || persona.includes('rational')) {
      openness += 0.1
      conscientiousness += 0.1
    }
    if (persona.includes('anxious') || persona.includes('worried') || persona.includes('nervous')) {
      neuroticism += 0.2
    }
    if (persona.includes('calm') || persona.includes('stable') || persona.includes('relaxed')) {
      neuroticism -= 0.15
    }

    // Adjust based on humor trait
    if (coreTraits.humor && coreTraits.humor > 0.6) {
      extraversion += 0.1
      openness += 0.05
    }

    // Adjust based on dynamic traits
    if (dynamicTraits.confidence) {
      neuroticism -= dynamicTraits.confidence * 0.2
      extraversion += dynamicTraits.confidence * 0.1
    }
    if (dynamicTraits.empathy) {
      agreeableness += dynamicTraits.empathy * 0.15
    }

    // Clamp all values between 0 and 1
    return {
      openness: Math.max(0, Math.min(1, openness)),
      conscientiousness: Math.max(0, Math.min(1, conscientiousness)),
      extraversion: Math.max(0, Math.min(1, extraversion)),
      agreeableness: Math.max(0, Math.min(1, agreeableness)),
      neuroticism: Math.max(0, Math.min(1, neuroticism)),
    }
  }

  /**
   * Generate MBTI type from Big Five and other data
   */
  generateMBTI(agent: AgentRecord, bigFive: BigFiveProfile): MBTIProfile {
    // E/I dimension: based on extraversion
    const ei = bigFive.extraversion > 0.5 ? bigFive.extraversion - 0.5 : bigFive.extraversion - 0.5

    // S/N dimension: based on openness (high openness = intuition)
    const sn = bigFive.openness > 0.5 ? bigFive.openness - 0.5 : bigFive.openness - 0.5

    // T/F dimension: based on agreeableness (high agreeableness = feeling)
    // Also consider linguistic profile if available
    let tf = bigFive.agreeableness > 0.5 ? bigFive.agreeableness - 0.5 : bigFive.agreeableness - 0.5
    if (agent.linguisticProfile?.technicalLevel && agent.linguisticProfile.technicalLevel > 0.7) {
      tf -= 0.2 // Technical = more thinking
    }

    // J/P dimension: based on conscientiousness (high conscientiousness = judging)
    const jp = bigFive.conscientiousness > 0.5
      ? -(bigFive.conscientiousness - 0.5)  // Higher conscientiousness = J (negative)
      : -(bigFive.conscientiousness - 0.5)

    // Determine type letters
    const e_or_i = ei >= 0 ? 'E' : 'I'
    const s_or_n = sn >= 0 ? 'N' : 'S'
    const t_or_f = tf >= 0 ? 'F' : 'T'
    const j_or_p = jp >= 0 ? 'P' : 'J'

    const type = `${e_or_i}${s_or_n}${t_or_f}${j_or_p}`

    return {
      type,
      dimensions: {
        extraversion_introversion: ei * 2, // Scale to -1 to 1
        sensing_intuition: sn * 2,
        thinking_feeling: tf * 2,
        judging_perceiving: jp * 2,
      },
    }
  }

  /**
   * Generate Enneagram profile from persona and goals
   */
  generateEnneagram(agent: AgentRecord, bigFive: BigFiveProfile): EnneagramProfile {
    const persona = agent.persona.toLowerCase()
    const goals = (agent.goals || []).join(' ').toLowerCase()

    // Score each type based on keywords and traits
    const scores: Record<number, number> = {
      1: 0, 2: 0, 3: 0, 4: 0, 5: 0, 6: 0, 7: 0, 8: 0, 9: 0,
    }

    // Type 1: Perfectionist
    if (persona.includes('perfect') || persona.includes('correct') || persona.includes('ethical')) {
      scores[1] += 2
    }
    scores[1] += bigFive.conscientiousness * 2

    // Type 2: Helper
    if (persona.includes('help') || persona.includes('support') || persona.includes('care')) {
      scores[2] += 2
    }
    scores[2] += bigFive.agreeableness * 2

    // Type 3: Achiever
    if (persona.includes('success') || persona.includes('achieve') || goals.includes('accomplish')) {
      scores[3] += 2
    }
    scores[3] += bigFive.extraversion * 1.5

    // Type 4: Individualist
    if (persona.includes('unique') || persona.includes('creative') || persona.includes('authentic')) {
      scores[4] += 2
    }
    scores[4] += bigFive.openness * 1.5

    // Type 5: Investigator
    if (persona.includes('knowledge') || persona.includes('analytical') || persona.includes('research')) {
      scores[5] += 2
    }
    scores[5] += bigFive.openness * 1.5 + (1 - bigFive.extraversion) * 1.5

    // Type 6: Loyalist
    if (persona.includes('loyal') || persona.includes('secure') || persona.includes('reliable')) {
      scores[6] += 2
    }
    scores[6] += bigFive.conscientiousness * 1.5 + bigFive.neuroticism

    // Type 7: Enthusiast
    if (persona.includes('adventure') || persona.includes('fun') || persona.includes('enthusiast')) {
      scores[7] += 2
    }
    scores[7] += bigFive.extraversion * 2 + bigFive.openness

    // Type 8: Challenger
    if (persona.includes('leader') || persona.includes('strong') || persona.includes('powerful')) {
      scores[8] += 2
    }
    scores[8] += bigFive.extraversion * 1.5 + (1 - bigFive.agreeableness)

    // Type 9: Peacemaker
    if (persona.includes('peace') || persona.includes('harmony') || persona.includes('calm')) {
      scores[9] += 2
    }
    scores[9] += bigFive.agreeableness * 2 + (1 - bigFive.neuroticism)

    // Find primary type
    let primaryType = 1
    let maxScore = scores[1]
    for (let i = 2; i <= 9; i++) {
      if (scores[i] > maxScore) {
        maxScore = scores[i]
        primaryType = i
      }
    }

    // Determine wing (adjacent type with higher score)
    const leftWing = primaryType === 1 ? 9 : primaryType - 1
    const rightWing = primaryType === 9 ? 1 : primaryType + 1
    const wing = scores[leftWing] > scores[rightWing] ? leftWing : rightWing

    // Determine tritype (highest in each center)
    // Gut: 8, 9, 1 / Heart: 2, 3, 4 / Head: 5, 6, 7
    const gutTypes = [8, 9, 1]
    const heartTypes = [2, 3, 4]
    const headTypes = [5, 6, 7]

    const getHighest = (types: number[]) =>
      types.reduce((max, t) => (scores[t] > scores[max] ? t : max), types[0])

    const tritype: [number, number, number] = [
      getHighest(gutTypes),
      getHighest(heartTypes),
      getHighest(headTypes),
    ]

    // Sort tritype by score
    tritype.sort((a, b) => scores[b] - scores[a])

    // Determine instinctual variant based on goals and traits
    let instinctualVariant: 'self-preservation' | 'social' | 'sexual' = 'self-preservation'
    if (goals.includes('connect') || goals.includes('community') || bigFive.extraversion > 0.6) {
      instinctualVariant = 'social'
    } else if (goals.includes('passion') || goals.includes('intense') || bigFive.openness > 0.7) {
      instinctualVariant = 'sexual'
    }

    return {
      primaryType,
      wing,
      tritype,
      instinctualVariant,
    }
  }

  /**
   * Generate cognitive style assessment
   */
  generateCognitiveStyle(agent: AgentRecord, bigFive: BigFiveProfile): CognitiveStyle {
    const persona = agent.persona.toLowerCase()
    const lp = agent.linguisticProfile

    // Analytical vs Intuitive: Technical language = analytical, Expressiveness = intuitive
    let analyticalVsIntuitive = 0
    if (lp) {
      analyticalVsIntuitive = lp.technicalLevel - lp.expressiveness
    }
    if (persona.includes('logical') || persona.includes('analytical')) {
      analyticalVsIntuitive -= 0.3
    }
    if (persona.includes('intuitive') || persona.includes('feeling')) {
      analyticalVsIntuitive += 0.3
    }

    // Abstract vs Concrete: Openness affects this
    const abstractVsConcrete = bigFive.openness - 0.5

    // Sequential vs Global: Conscientiousness suggests sequential
    let sequentialVsGlobal = -(bigFive.conscientiousness - 0.5)
    if (persona.includes('big picture') || persona.includes('holistic')) {
      sequentialVsGlobal += 0.3
    }

    // Reflective vs Impulsive: Conscientiousness and low extraversion suggest reflective
    const reflectiveVsImpulsive = (bigFive.extraversion - 0.5) - (bigFive.conscientiousness - 0.5)

    return {
      analyticalVsIntuitive: Math.max(-1, Math.min(1, analyticalVsIntuitive)),
      abstractVsConcrete: Math.max(-1, Math.min(1, abstractVsConcrete)),
      sequentialVsGlobal: Math.max(-1, Math.min(1, sequentialVsGlobal)),
      reflectiveVsImpulsive: Math.max(-1, Math.min(1, reflectiveVsImpulsive)),
    }
  }

  /**
   * Generate motivational profile
   */
  generateMotivationalProfile(agent: AgentRecord, enneagram: EnneagramProfile): MotivationalProfile {
    const enneagramInfo = ENNEAGRAM_DESCRIPTIONS[enneagram.primaryType]
    const goals = agent.goals || []

    // Primary motivations based on Enneagram and goals
    const primaryMotivations = [enneagramInfo.motivation]
    if (goals.length > 0) {
      primaryMotivations.push(...goals.slice(0, 2))
    }

    // Fears based on Enneagram
    const fears = [enneagramInfo.fear]

    // Add additional fears based on neuroticism in agent (if emotional state exists)
    if (agent.emotionalState && agent.emotionalState.currentMood.fear > 0.5) {
      fears.push('Uncertainty about the future')
    }

    // Desires based on persona
    const desires: string[] = []
    const persona = agent.persona.toLowerCase()
    if (persona.includes('knowledge') || persona.includes('learn')) {
      desires.push('Deep understanding and wisdom')
    }
    if (persona.includes('connect') || persona.includes('friend')) {
      desires.push('Meaningful connections with others')
    }
    if (persona.includes('create') || persona.includes('creative')) {
      desires.push('Creative expression and innovation')
    }
    if (persona.includes('help') || persona.includes('support')) {
      desires.push('Making a positive difference')
    }
    if (desires.length === 0) {
      desires.push('Growth and self-improvement')
    }

    // Core values
    const coreValues: string[] = []
    if (persona.includes('honest') || persona.includes('truth')) coreValues.push('Honesty')
    if (persona.includes('kind') || persona.includes('compassion')) coreValues.push('Compassion')
    if (persona.includes('curious') || persona.includes('learn')) coreValues.push('Curiosity')
    if (persona.includes('loyal') || persona.includes('dedicated')) coreValues.push('Loyalty')
    if (persona.includes('creative') || persona.includes('innovative')) coreValues.push('Creativity')
    if (coreValues.length === 0) {
      coreValues.push('Growth', 'Understanding', 'Authenticity')
    }

    // Growth areas based on Enneagram
    const growthAreas: string[] = []
    switch (enneagram.primaryType) {
      case 1: growthAreas.push('Accepting imperfection', 'Being more flexible'); break
      case 2: growthAreas.push('Setting boundaries', 'Acknowledging own needs'); break
      case 3: growthAreas.push('Valuing being over doing', 'Authentic self-expression'); break
      case 4: growthAreas.push('Finding common ground', 'Emotional stability'); break
      case 5: growthAreas.push('Engaging more with the world', 'Sharing knowledge'); break
      case 6: growthAreas.push('Building self-trust', 'Taking measured risks'); break
      case 7: growthAreas.push('Depth over breadth', 'Processing difficult emotions'); break
      case 8: growthAreas.push('Vulnerability as strength', 'Collaborative leadership'); break
      case 9: growthAreas.push('Asserting own voice', 'Engaging with conflict constructively'); break
    }

    return {
      primaryMotivations,
      fears,
      desires,
      coreValues,
      growthAreas,
    }
  }

  /**
   * Calculate emotional intelligence score
   */
  calculateEmotionalIntelligence(agent: AgentRecord): number {
    let ei = 0.5 // Base score

    // Dynamic traits contribution
    if (agent.dynamicTraits) {
      ei += (agent.dynamicTraits.empathy || 0) * 0.3
      ei += (agent.dynamicTraits.adaptability || 0) * 0.1
    }

    // Core traits contribution
    if (agent.coreTraits) {
      ei += (agent.coreTraits.helpfulness || 0) * 0.15
    }

    // Stats contribution (if they've recognized emotions)
    if (agent.stats && agent.stats.emotionRecognitions > 10) {
      ei += 0.1
    }

    // Linguistic profile (expressiveness contributes to EI)
    if (agent.linguisticProfile && agent.linguisticProfile.expressiveness > 0.6) {
      ei += 0.1
    }

    return Math.max(0, Math.min(1, ei))
  }

  /**
   * Determine communication style
   */
  determineCommunicationStyle(
    agent: AgentRecord,
    bigFive: BigFiveProfile,
    mbti: MBTIProfile
  ): {
    directness: number
    emotionalExpression: number
    conflictStyle: 'avoiding' | 'accommodating' | 'competing' | 'collaborating' | 'compromising'
  } {
    const lp = agent.linguisticProfile

    // Directness: Low formality + extraversion = more direct
    let directness = bigFive.extraversion
    if (lp) {
      directness += (1 - lp.formality) * 0.3
    }
    directness = Math.max(0, Math.min(1, directness))

    // Emotional expression: Based on expressiveness and agreeableness
    let emotionalExpression = bigFive.agreeableness
    if (lp) {
      emotionalExpression += lp.expressiveness * 0.3
    }
    emotionalExpression = Math.max(0, Math.min(1, emotionalExpression))

    // Conflict style based on various factors
    let conflictStyle: 'avoiding' | 'accommodating' | 'competing' | 'collaborating' | 'compromising'

    if (bigFive.agreeableness > 0.7 && bigFive.extraversion < 0.4) {
      conflictStyle = 'avoiding'
    } else if (bigFive.agreeableness > 0.7 && bigFive.extraversion >= 0.4) {
      conflictStyle = 'accommodating'
    } else if (bigFive.agreeableness < 0.4 && bigFive.extraversion > 0.6) {
      conflictStyle = 'competing'
    } else if (bigFive.openness > 0.6 && bigFive.agreeableness > 0.5) {
      conflictStyle = 'collaborating'
    } else {
      conflictStyle = 'compromising'
    }

    return { directness, emotionalExpression, conflictStyle }
  }

  /**
   * Determine attachment style
   */
  determineAttachmentStyle(bigFive: BigFiveProfile): 'secure' | 'anxious' | 'avoidant' | 'disorganized' {
    // Based on research correlations between Big Five and attachment
    const anxiety = bigFive.neuroticism
    const avoidance = 1 - bigFive.agreeableness

    if (anxiety < 0.4 && avoidance < 0.4) {
      return 'secure'
    } else if (anxiety > 0.6 && avoidance < 0.5) {
      return 'anxious'
    } else if (anxiety < 0.5 && avoidance > 0.6) {
      return 'avoidant'
    } else if (anxiety > 0.5 && avoidance > 0.5) {
      return 'disorganized'
    }

    return 'secure' // Default
  }

  /**
   * Generate profile summary
   */
  generateSummary(
    agent: AgentRecord,
    bigFive: BigFiveProfile,
    mbti: MBTIProfile,
    enneagram: EnneagramProfile
  ): {
    summary: string
    strengths: string[]
    challenges: string[]
  } {
    const mbtiDesc = MBTI_DESCRIPTIONS[mbti.type] || `${mbti.type} type`
    const enneagramDesc = ENNEAGRAM_DESCRIPTIONS[enneagram.primaryType]

    const summary = `${agent.name} is ${mbtiDesc}. As an Enneagram Type ${enneagram.primaryType} (${enneagramDesc.name}), they are primarily motivated by ${enneagramDesc.motivation.toLowerCase()}. ` +
      `With ${bigFive.openness > 0.6 ? 'high' : bigFive.openness > 0.4 ? 'moderate' : 'lower'} openness ` +
      `and ${bigFive.agreeableness > 0.6 ? 'high' : bigFive.agreeableness > 0.4 ? 'moderate' : 'lower'} agreeableness, ` +
      `they bring a ${bigFive.extraversion > 0.5 ? 'social and energetic' : 'thoughtful and reflective'} presence to interactions.`

    // Generate strengths
    const strengths: string[] = []

    if (bigFive.openness > 0.6) strengths.push('Creative thinking and openness to new ideas')
    if (bigFive.conscientiousness > 0.6) strengths.push('Organized and reliable')
    if (bigFive.extraversion > 0.6) strengths.push('Engaging and energetic communicator')
    if (bigFive.agreeableness > 0.6) strengths.push('Empathetic and cooperative')
    if (bigFive.neuroticism < 0.4) strengths.push('Emotionally stable under pressure')

    // Add MBTI-based strengths
    if (mbti.type.includes('N')) strengths.push('Intuitive pattern recognition')
    if (mbti.type.includes('T')) strengths.push('Logical analysis')
    if (mbti.type.includes('F')) strengths.push('Understanding of others\' feelings')
    if (mbti.type.includes('J')) strengths.push('Planning and organization')
    if (mbti.type.includes('P')) strengths.push('Adaptability and flexibility')

    // Generate challenges
    const challenges: string[] = []

    if (bigFive.openness < 0.4) challenges.push('May resist change or new approaches')
    if (bigFive.conscientiousness < 0.4) challenges.push('May struggle with structure and deadlines')
    if (bigFive.extraversion < 0.4) challenges.push('May find extensive social interaction draining')
    if (bigFive.agreeableness < 0.4) challenges.push('May prioritize goals over harmony')
    if (bigFive.neuroticism > 0.6) challenges.push('May experience stress more intensely')

    // Add Enneagram growth areas as challenges
    challenges.push(enneagramDesc.fear.charAt(0).toUpperCase() + enneagramDesc.fear.slice(1))

    return {
      summary,
      strengths: strengths.slice(0, 5),
      challenges: challenges.slice(0, 5),
    }
  }

  /**
   * Get MBTI type description
   */
  getMBTIDescription(type: string): string {
    return MBTI_DESCRIPTIONS[type] || 'Unique personality type'
  }

  /**
   * Get Enneagram type info
   */
  getEnneagramInfo(type: number): { name: string; motivation: string; fear: string } {
    return ENNEAGRAM_DESCRIPTIONS[type] || {
      name: 'Unknown',
      motivation: 'Growth',
      fear: 'Stagnation',
    }
  }

  /**
   * Compare compatibility between two profiles
   */
  compareProfiles(profile1: PsychologicalProfile, profile2: PsychologicalProfile): {
    compatibility: number
    strengths: string[]
    challenges: string[]
  } {
    let compatibility = 0.5

    // Compare Big Five
    const b1 = profile1.bigFive
    const b2 = profile2.bigFive

    // Some similarity is good, but complementary traits can also work
    const opennessDiff = Math.abs(b1.openness - b2.openness)
    const agreeablenessDiff = Math.abs(b1.agreeableness - b2.agreeableness)
    const extraVersionDiff = Math.abs(b1.extraversion - b2.extraversion)

    // High agreeableness in both improves compatibility
    if (b1.agreeableness > 0.5 && b2.agreeableness > 0.5) {
      compatibility += 0.15
    }

    // Similar openness helps
    if (opennessDiff < 0.3) {
      compatibility += 0.1
    }

    // Very different extraversion can be challenging
    if (extraVersionDiff > 0.5) {
      compatibility -= 0.1
    }

    // High neuroticism in both is challenging
    if (b1.neuroticism > 0.6 && b2.neuroticism > 0.6) {
      compatibility -= 0.1
    }

    // MBTI compatibility (simplified)
    const mbti1 = profile1.mbti.type
    const mbti2 = profile2.mbti.type

    // Shared middle letters (S/N and T/F) often indicate compatibility
    if (mbti1[1] === mbti2[1]) compatibility += 0.05 // Same S/N
    if (mbti1[2] === mbti2[2]) compatibility += 0.05 // Same T/F

    const strengths: string[] = []
    const challenges: string[] = []

    if (b1.agreeableness > 0.5 && b2.agreeableness > 0.5) {
      strengths.push('Both value harmony and cooperation')
    }
    if (Math.abs(b1.openness - b2.openness) < 0.3) {
      strengths.push('Similar approach to new experiences')
    }
    if (extraVersionDiff < 0.3) {
      strengths.push('Compatible energy levels')
    }

    if (extraVersionDiff > 0.4) {
      challenges.push('Different social energy needs')
    }
    if (Math.abs(b1.conscientiousness - b2.conscientiousness) > 0.4) {
      challenges.push('Different approaches to structure and planning')
    }

    return {
      compatibility: Math.max(0, Math.min(1, compatibility)),
      strengths,
      challenges,
    }
  }
}

// Export singleton instance
export const psychologicalProfileService = new PsychologicalProfileService()

// Export class for testing
export { PsychologicalProfileService }
