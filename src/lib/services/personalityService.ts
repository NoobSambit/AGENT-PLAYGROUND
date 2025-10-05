import { AgentService } from './agentService'
import { MemoryService } from './memoryService'
import { MemoryRecord } from '@/types/database'

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
}
