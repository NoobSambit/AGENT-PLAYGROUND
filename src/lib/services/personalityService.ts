import { AgentService } from './agentService'
import { MemoryService } from './memoryService'
import { MemoryRecord, LinguisticProfile } from '@/types/database'

// Personality trait definitions with their evolution rules
export const PERSONALITY_TRAITS = {
  // Core traits (immutable, set during agent creation)
  curiosity: {
    description: 'Interest in exploring new topics and asking questions',
    positiveIndicators: ['ask', 'wonder', 'explore', 'learn', 'discover'],
    negativeIndicators: ['boring', 'uninteresting', 'obvious']
  },
  helpfulness: {
    description: 'Willingness to assist and provide value',
    positiveIndicators: ['help', 'assist', 'support', 'useful', 'valuable'],
    negativeIndicators: ['unhelpful', 'useless', 'frustrating']
  },
  friendliness: {
    description: 'Warmth and approachability in interactions',
    positiveIndicators: ['nice', 'friendly', 'warm', 'kind', 'pleasant'],
    negativeIndicators: ['cold', 'rude', 'unfriendly', 'harsh']
  },
  humor: {
    description: 'Ability to be witty and entertaining',
    positiveIndicators: ['funny', 'witty', 'humorous', 'laugh', 'joke'],
    negativeIndicators: ['boring', 'serious', 'dry']
  },

  // Dynamic traits (evolve based on interactions)
  confidence: {
    description: 'Self-assurance in responses and decisions',
    positiveIndicators: ['confident', 'sure', 'certain', 'assertive'],
    negativeIndicators: ['uncertain', 'doubt', 'hesitant', 'unsure']
  },
  knowledge: {
    description: 'Depth and accuracy of information provided',
    positiveIndicators: ['smart', 'knowledgeable', 'expert', 'accurate'],
    negativeIndicators: ['wrong', 'incorrect', 'misinformed', 'confused']
  },
  empathy: {
    description: 'Understanding and relating to user emotions',
    positiveIndicators: ['understand', 'empathize', 'relate', 'feel', 'care'],
    negativeIndicators: ['cold', 'uncaring', 'insensitive', 'dismissive']
  },
  adaptability: {
    description: 'Flexibility in adjusting to user preferences',
    positiveIndicators: ['flexible', 'adapt', 'adjust', 'accommodate'],
    negativeIndicators: ['rigid', 'inflexible', 'stubborn', 'unwilling']
  }
} as const

export type PersonalityTrait = keyof typeof PERSONALITY_TRAITS
export type DynamicPersonalityTrait = 'confidence' | 'knowledge' | 'empathy' | 'adaptability'
export type TraitScore = number // 0.0 to 1.0

export interface TraitAnalysis {
  trait: DynamicPersonalityTrait
  score: TraitScore
  confidence: number // How confident we are in this analysis (0.0 to 1.0)
  indicators: string[] // What indicators led to this score
}

export interface PersonalityUpdate {
  agentId: string
  traitUpdates: Record<DynamicPersonalityTrait, TraitScore>
  interactionCount: number
  analysis: TraitAnalysis[]
  summary: string
}

export class PersonalityService {
  // Analyze a conversation and extract personality insights
  static async analyzeInteraction(
    agentId: string,
    userMessage: string,
    agentResponse: string,
    context?: string
  ): Promise<TraitAnalysis[]> {
    try {
      const analyses: TraitAnalysis[] = []

      // Analyze each dynamic trait (core traits are immutable)
      const dynamicTraits: DynamicPersonalityTrait[] = ['confidence', 'knowledge', 'empathy', 'adaptability']

      for (const trait of dynamicTraits) {
        const traitDef = PERSONALITY_TRAITS[trait]
        const analysis = await this.analyzeTrait(
          trait,
          traitDef,
          userMessage,
          agentResponse,
          context
        )
        if (analysis) {
          analyses.push(analysis)
        }
      }

      return analyses
    } catch (error) {
      console.error('Error analyzing interaction:', error)
      return []
    }
  }

  // Analyze a specific trait based on conversation
  private static async analyzeTrait(
    trait: DynamicPersonalityTrait,
    traitDef: typeof PERSONALITY_TRAITS[DynamicPersonalityTrait],
    userMessage: string,
    agentResponse: string,
    context?: string
  ): Promise<TraitAnalysis | null> {
    const combinedText = `${userMessage} ${agentResponse} ${context || ''}`.toLowerCase()
    const indicators: string[] = []

    let positiveScore = 0
    let negativeScore = 0

    // Check for positive indicators
    traitDef.positiveIndicators.forEach(indicator => {
      if (combinedText.includes(indicator)) {
        positiveScore += 1
        indicators.push(`+${indicator}`)
      }
    })

    // Check for negative indicators
    traitDef.negativeIndicators.forEach(indicator => {
      if (combinedText.includes(indicator)) {
        negativeScore += 1
        indicators.push(`-${indicator}`)
      }
    })

    // Calculate trait score (0.0 to 1.0)
    const totalIndicators = positiveScore + negativeScore
    if (totalIndicators === 0) {
      return null // No indicators found
    }

    const rawScore = Math.max(0, Math.min(1, positiveScore / (positiveScore + negativeScore)))
    const confidence = Math.min(1, totalIndicators / 5) // More indicators = higher confidence

    return {
      trait,
      score: Math.round(rawScore * 100) / 100, // Round to 2 decimal places
      confidence,
      indicators
    }
  }

  // Update agent personality traits based on analysis
  static async updatePersonality(
    agentId: string,
    analyses: TraitAnalysis[]
  ): Promise<PersonalityUpdate | null> {
    try {
      const agent = await AgentService.getAgentById(agentId)
      if (!agent) {
        return null
      }

      const traitUpdates: Record<DynamicPersonalityTrait, TraitScore> = {
        confidence: agent.dynamicTraits?.confidence || 0.5,
        knowledge: agent.dynamicTraits?.knowledge || 0.5,
        empathy: agent.dynamicTraits?.empathy || 0.5,
        adaptability: agent.dynamicTraits?.adaptability || 0.5
      }
      const currentInteractions = agent.totalInteractions || 0

      // Apply weighted updates based on analysis confidence
      analyses.forEach(analysis => {
        const currentScore = traitUpdates[analysis.trait] || 0.5
        const updateWeight = analysis.confidence * 0.1 // Conservative updates (10% max per interaction)
        const newScore = currentScore + (analysis.score - currentScore) * updateWeight
        traitUpdates[analysis.trait] = Math.max(0, Math.min(1, Math.round(newScore * 100) / 100))
      })

      // Update agent in database
      const success = await AgentService.updateAgent(agentId, {
        dynamicTraits: traitUpdates,
        totalInteractions: currentInteractions + 1
      })

      if (!success) {
        return null
      }

      // Create a memory of this personality insight
      const summary = this.generatePersonalitySummary(analyses)
      await MemoryService.createMemory({
        agentId,
        type: 'personality_insight',
        content: `Personality analysis: ${analyses.map(a => `${a.trait}(${a.score})`).join(', ')}`,
        summary,
        keywords: analyses.map(a => a.trait),
        importance: Math.round(analyses.reduce((sum, a) => sum + a.confidence, 0) / analyses.length * 10),
        context: 'Automated personality evolution based on interaction analysis',
        metadata: {
          analyses: analyses.map(a => ({
            trait: a.trait,
            score: a.score,
            confidence: a.confidence,
            indicators: a.indicators
          }))
        }
      })

      return {
        agentId,
        traitUpdates,
        interactionCount: currentInteractions + 1,
        analysis: analyses,
        summary
      }
    } catch (error) {
      console.error('Error updating personality:', error)
      return null
    }
  }

  // Generate a human-readable summary of personality changes
  private static generatePersonalitySummary(analyses: TraitAnalysis[]): string {
    const significantChanges = analyses.filter(a => a.confidence > 0.5)

    if (significantChanges.length === 0) {
      return 'No significant personality changes detected in this interaction.'
    }

    const changes = significantChanges.map(a => {
      const direction = a.score > 0.6 ? 'increased' : a.score < 0.4 ? 'decreased' : 'maintained'
      return `${a.trait} ${direction}`
    })

    return `Personality evolved: ${changes.join(', ')} based on interaction patterns.`
  }

  // Get personality evolution history for an agent
  static async getPersonalityHistory(agentId: string): Promise<MemoryRecord[]> {
    return await MemoryService.getMemoriesByType(agentId, 'personality_insight')
  }

  // Generate initial personality traits for a new agent
  static generateInitialPersonality(basePersona: string): {
    coreTraits: Record<string, number>
    dynamicTraits: Record<string, number>
  } {
    // Start with balanced traits
    const coreTraits: Record<string, number> = {}
    const dynamicTraits: Record<string, number> = {}

    Object.keys(PERSONALITY_TRAITS).forEach(trait => {
      if (trait in ['confidence', 'knowledge', 'empathy', 'adaptability']) {
        dynamicTraits[trait] = 0.5 // Start neutral
      } else {
        coreTraits[trait] = this.inferCoreTraitFromPersona(trait as PersonalityTrait, basePersona)
      }
    })

    return { coreTraits, dynamicTraits }
  }

  // Infer core trait values from agent persona
  private static inferCoreTraitFromPersona(trait: PersonalityTrait, persona: string): number {
    const personaLower = persona.toLowerCase()
    const traitDef = PERSONALITY_TRAITS[trait]

    let score = 0.5 // Start neutral

    // Look for trait-related keywords in persona
    traitDef.positiveIndicators.forEach(indicator => {
      if (personaLower.includes(indicator)) {
        score += 0.1
      }
    })

    traitDef.negativeIndicators.forEach(indicator => {
      if (personaLower.includes(indicator)) {
        score -= 0.1
      }
    })

    return Math.max(0.1, Math.min(1.0, score)) // Clamp between 0.1 and 1.0
  }

  // Format personality traits for display
  static formatTraitsForDisplay(
    coreTraits: Record<string, number>,
    dynamicTraits: Record<string, number>
  ): Array<{
    trait: string
    type: 'core' | 'dynamic'
    score: number
    description: string
    change?: number // For showing evolution
  }> {
    const allTraits: Array<{
      trait: string
      type: 'core' | 'dynamic'
      score: number
      description: string
    }> = []

    Object.entries(coreTraits).forEach(([trait, score]) => {
      allTraits.push({
        trait,
        type: 'core',
        score,
        description: PERSONALITY_TRAITS[trait as PersonalityTrait]?.description || ''
      })
    })

    Object.entries(dynamicTraits).forEach(([trait, score]) => {
      allTraits.push({
        trait,
        type: 'dynamic',
        score,
        description: PERSONALITY_TRAITS[trait as PersonalityTrait]?.description || ''
      })
    })

    return allTraits.sort((a, b) => {
      // Sort by type (core first) then by trait name
      if (a.type !== b.type) {
        return a.type === 'core' ? -1 : 1
      }
      return a.trait.localeCompare(b.trait)
    })
  }

  // ============================================
  // PHASE 1: Linguistic Profile Generation
  // ============================================

  /**
   * Generate initial linguistic profile from agent persona and goals
   */
  static generateLinguisticProfile(
    persona: string,
    goals: string[],
    coreTraits?: Record<string, number>
  ): LinguisticProfile {
    const personaLower = persona.toLowerCase()
    const goalsText = goals.join(' ').toLowerCase()
    const combinedText = `${personaLower} ${goalsText}`

    // Analyze formality
    const formality = this.analyzeFormality(combinedText)

    // Analyze verbosity
    const verbosity = this.analyzeVerbosity(combinedText)

    // Analyze humor level
    const humor = this.analyzeHumor(combinedText, coreTraits?.humor)

    // Analyze technical level
    const technicalLevel = this.analyzeTechnicalLevel(combinedText)

    // Analyze expressiveness
    const expressiveness = this.analyzeExpressiveness(combinedText, coreTraits)

    // Generate signature expressions and preferred words
    const { signatureExpressions, preferredWords } = this.generateLanguagePatterns(
      personaLower,
      { formality, verbosity, humor, technicalLevel, expressiveness }
    )

    // Analyze punctuation style
    const punctuationStyle = this.analyzePunctuationStyle(
      { formality, humor, expressiveness }
    )

    return {
      formality,
      verbosity,
      humor,
      technicalLevel,
      expressiveness,
      preferredWords,
      signatureExpressions,
      punctuationStyle
    }
  }

  /**
   * Analyze formality level from text (0 = casual, 1 = formal)
   */
  private static analyzeFormality(text: string): number {
    let score = 0.5 // Start neutral

    // Formal indicators
    const formalIndicators = [
      'professional', 'formal', 'proper', 'academic', 'scholarly',
      'distinguished', 'refined', 'sophisticated', 'eloquent', 'precise',
      'professor', 'doctor', 'expert', 'consultant', 'advisor'
    ]

    // Casual indicators
    const casualIndicators = [
      'casual', 'friendly', 'relaxed', 'chill', 'easygoing',
      'buddy', 'pal', 'fun', 'playful', 'informal', 'laid-back',
      'cool', 'awesome', 'dude', 'hey'
    ]

    formalIndicators.forEach(indicator => {
      if (text.includes(indicator)) score += 0.08
    })

    casualIndicators.forEach(indicator => {
      if (text.includes(indicator)) score -= 0.08
    })

    return Math.max(0, Math.min(1, Math.round(score * 100) / 100))
  }

  /**
   * Analyze verbosity level (0 = concise, 1 = elaborate)
   */
  private static analyzeVerbosity(text: string): number {
    let score = 0.5

    const verboseIndicators = [
      'detailed', 'thorough', 'comprehensive', 'elaborate', 'extensive',
      'explain', 'describe', 'storyteller', 'narrative', 'expressive'
    ]

    const conciseIndicators = [
      'brief', 'concise', 'short', 'direct', 'to the point',
      'efficient', 'succinct', 'minimal', 'quick', 'straightforward'
    ]

    verboseIndicators.forEach(indicator => {
      if (text.includes(indicator)) score += 0.1
    })

    conciseIndicators.forEach(indicator => {
      if (text.includes(indicator)) score -= 0.1
    })

    return Math.max(0, Math.min(1, Math.round(score * 100) / 100))
  }

  /**
   * Analyze humor level (0 = serious, 1 = playful)
   */
  private static analyzeHumor(text: string, humorTrait?: number): number {
    let score = humorTrait || 0.3 // Use trait if available

    const humorIndicators = [
      'funny', 'witty', 'humorous', 'playful', 'joke', 'laugh',
      'amusing', 'entertaining', 'comedian', 'sarcastic', 'ironic'
    ]

    const seriousIndicators = [
      'serious', 'stern', 'grave', 'somber', 'no-nonsense',
      'professional', 'formal', 'strict'
    ]

    humorIndicators.forEach(indicator => {
      if (text.includes(indicator)) score += 0.1
    })

    seriousIndicators.forEach(indicator => {
      if (text.includes(indicator)) score -= 0.08
    })

    return Math.max(0, Math.min(1, Math.round(score * 100) / 100))
  }

  /**
   * Analyze technical level (0 = simple, 1 = technical)
   */
  private static analyzeTechnicalLevel(text: string): number {
    let score = 0.3 // Default slightly simple

    const technicalIndicators = [
      'technical', 'expert', 'specialist', 'engineer', 'scientist',
      'developer', 'programmer', 'researcher', 'analyst', 'academic',
      'complex', 'advanced', 'sophisticated'
    ]

    const simpleIndicators = [
      'simple', 'basic', 'beginner', 'novice', 'easy',
      'accessible', 'plain', 'everyday', 'common'
    ]

    technicalIndicators.forEach(indicator => {
      if (text.includes(indicator)) score += 0.12
    })

    simpleIndicators.forEach(indicator => {
      if (text.includes(indicator)) score -= 0.1
    })

    return Math.max(0, Math.min(1, Math.round(score * 100) / 100))
  }

  /**
   * Analyze expressiveness (0 = plain, 1 = metaphorical)
   */
  private static analyzeExpressiveness(
    text: string,
    coreTraits?: Record<string, number>
  ): number {
    let score = coreTraits?.friendliness ? 0.3 + coreTraits.friendliness * 0.2 : 0.4

    const expressiveIndicators = [
      'creative', 'artistic', 'poetic', 'imaginative', 'colorful',
      'vivid', 'metaphor', 'storyteller', 'expressive', 'emotional'
    ]

    const plainIndicators = [
      'plain', 'factual', 'literal', 'straightforward', 'matter-of-fact',
      'objective', 'neutral', 'analytical'
    ]

    expressiveIndicators.forEach(indicator => {
      if (text.includes(indicator)) score += 0.1
    })

    plainIndicators.forEach(indicator => {
      if (text.includes(indicator)) score -= 0.08
    })

    return Math.max(0, Math.min(1, Math.round(score * 100) / 100))
  }

  /**
   * Generate signature expressions and preferred words based on profile
   */
  private static generateLanguagePatterns(
    persona: string,
    profile: { formality: number; verbosity: number; humor: number; technicalLevel: number; expressiveness: number }
  ): { signatureExpressions: string[]; preferredWords: string[] } {
    const signatureExpressions: string[] = []
    const preferredWords: string[] = []

    // Formal expressions
    if (profile.formality > 0.6) {
      signatureExpressions.push(
        'Indeed,',
        'Precisely,',
        'I must say,',
        'Allow me to explain,',
        'If I may,'
      )
      preferredWords.push('certainly', 'indeed', 'precisely', 'therefore', 'consequently')
    } else if (profile.formality < 0.4) {
      signatureExpressions.push(
        'Hey!',
        'You know,',
        'So basically,',
        'Here\'s the thing,',
        'Let me tell you,'
      )
      preferredWords.push('cool', 'awesome', 'totally', 'yeah', 'gonna')
    }

    // Verbose expressions
    if (profile.verbosity > 0.6) {
      signatureExpressions.push(
        'Let me elaborate on that,',
        'To provide more context,',
        'In other words,'
      )
      preferredWords.push('furthermore', 'additionally', 'moreover', 'specifically', 'essentially')
    } else if (profile.verbosity < 0.4) {
      signatureExpressions.push('Simply put,', 'In short,', 'Bottom line:')
      preferredWords.push('basically', 'just', 'quick', 'simple', 'directly')
    }

    // Humor expressions
    if (profile.humor > 0.6) {
      signatureExpressions.push(
        'Ha!',
        'Well, funny you should ask,',
        'Here\'s a fun fact:'
      )
      preferredWords.push('hilarious', 'amusing', 'ridiculous', 'wild', 'crazy')
    }

    // Technical expressions
    if (profile.technicalLevel > 0.6) {
      signatureExpressions.push(
        'Technically speaking,',
        'From a technical standpoint,',
        'The underlying mechanism is,'
      )
      preferredWords.push('technically', 'specifically', 'fundamentally', 'mechanism', 'implementation')
    }

    // Expressive language
    if (profile.expressiveness > 0.6) {
      signatureExpressions.push(
        'Picture this:',
        'Imagine,',
        'It\'s like,'
      )
      preferredWords.push('vibrant', 'brilliant', 'fascinating', 'extraordinary', 'remarkable')
    }

    // Add some personality-based words from the persona
    const personaWords = persona.split(/\s+/)
      .filter(w => w.length > 4)
      .slice(0, 10)

    personaWords.forEach(word => {
      if (!preferredWords.includes(word.toLowerCase())) {
        preferredWords.push(word.toLowerCase())
      }
    })

    // Limit arrays
    return {
      signatureExpressions: signatureExpressions.slice(0, 20),
      preferredWords: preferredWords.slice(0, 100)
    }
  }

  /**
   * Analyze punctuation style based on profile
   */
  private static analyzePunctuationStyle(
    profile: { formality: number; humor: number; expressiveness: number }
  ): { exclamationFrequency: number; ellipsisUsage: boolean; emojiUsage: boolean } {
    return {
      // More exclamations if informal, humorous, or expressive
      exclamationFrequency: Math.max(0, Math.min(1,
        (1 - profile.formality) * 0.3 +
        profile.humor * 0.4 +
        profile.expressiveness * 0.3
      )),
      // Ellipsis for more casual or expressive styles
      ellipsisUsage: profile.formality < 0.5 || profile.expressiveness > 0.6,
      // Emoji only for very casual agents
      emojiUsage: profile.formality < 0.35 && profile.humor > 0.5
    }
  }

  /**
   * Get linguistic style prompt for LLM system message
   */
  static getLinguisticPrompt(profile: LinguisticProfile, agentName: string): string {
    const lines: string[] = []

    lines.push(`You are ${agentName}. Maintain this linguistic style:`)

    // Formality
    if (profile.formality > 0.7) {
      lines.push('- Tone: Formal and professional')
    } else if (profile.formality > 0.4) {
      lines.push('- Tone: Balanced, neither too formal nor too casual')
    } else {
      lines.push('- Tone: Casual and conversational')
    }

    // Verbosity
    if (profile.verbosity > 0.7) {
      lines.push('- Style: Elaborate and detailed in explanations')
    } else if (profile.verbosity > 0.4) {
      lines.push('- Style: Moderate detail level')
    } else {
      lines.push('- Style: Concise and direct')
    }

    // Humor
    if (profile.humor > 0.6) {
      lines.push('- Humor: Playful and witty when appropriate')
    } else if (profile.humor < 0.3) {
      lines.push('- Humor: Serious and straightforward')
    }

    // Technical level
    if (profile.technicalLevel > 0.7) {
      lines.push('- Language: Use technical terminology when relevant')
    } else if (profile.technicalLevel < 0.3) {
      lines.push('- Language: Keep explanations simple and accessible')
    }

    // Expressiveness
    if (profile.expressiveness > 0.7) {
      lines.push('- Expression: Use metaphors and vivid imagery')
    } else if (profile.expressiveness < 0.3) {
      lines.push('- Expression: Keep language plain and factual')
    }

    // Signature expressions
    if (profile.signatureExpressions.length > 0) {
      const examples = profile.signatureExpressions.slice(0, 5).join('", "')
      lines.push(`- Occasionally use phrases like: "${examples}"`)
    }

    // Preferred words
    if (profile.preferredWords.length > 0) {
      const words = profile.preferredWords.slice(0, 10).join(', ')
      lines.push(`- Preferred vocabulary includes: ${words}`)
    }

    // Punctuation
    if (profile.punctuationStyle.emojiUsage) {
      lines.push('- You may occasionally use appropriate emojis')
    }
    if (profile.punctuationStyle.exclamationFrequency > 0.5) {
      lines.push('- Feel free to express enthusiasm with exclamation marks!')
    }

    return lines.join('\n')
  }

  /**
   * Update linguistic profile based on interaction patterns
   */
  static updateLinguisticProfile(
    currentProfile: LinguisticProfile,
    interaction: {
      messageLength: number
      usedExclamations: boolean
      usedQuestions: boolean
      topics: string[]
    }
  ): LinguisticProfile {
    const profile = { ...currentProfile }

    // Slight adjustments based on usage (learning from interactions)
    const learningRate = 0.02

    // Adjust verbosity based on message length
    if (interaction.messageLength > 200) {
      profile.verbosity = Math.min(1, profile.verbosity + learningRate)
    } else if (interaction.messageLength < 50) {
      profile.verbosity = Math.max(0, profile.verbosity - learningRate)
    }

    // Track technical topics
    const technicalTopics = ['technology', 'science', 'programming', 'engineering']
    const hasTechnicalTopics = interaction.topics.some(t =>
      technicalTopics.some(tt => t.toLowerCase().includes(tt))
    )
    if (hasTechnicalTopics) {
      profile.technicalLevel = Math.min(1, profile.technicalLevel + learningRate)
    }

    return profile
  }
}
