/**
 * Creativity Service - Phase 2
 *
 * Handles creative content generation for agents including
 * stories, poems, songs, essays, and other creative works.
 *
 * Cost: Uses LLM calls (rate limited)
 */

import {
  CreativeWork,
  CreativeWorkType,
  CreativeWorkStyle,
  EmotionType,
  EmotionalState,
  AgentRecord,
} from '@/types/database'

// Generate unique IDs
function generateId(): string {
  return `cw_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Creative work type configurations
const CREATIVE_TYPE_CONFIG: Record<CreativeWorkType, {
  icon: string
  promptTemplate: string
  minWords: number
  maxWords: number
}> = {
  story: {
    icon: '📖',
    promptTemplate: 'Write a short story',
    minWords: 100,
    maxWords: 500,
  },
  poem: {
    icon: '📜',
    promptTemplate: 'Write a poem',
    minWords: 20,
    maxWords: 150,
  },
  song: {
    icon: '🎵',
    promptTemplate: 'Write song lyrics',
    minWords: 50,
    maxWords: 200,
  },
  essay: {
    icon: '📝',
    promptTemplate: 'Write an essay',
    minWords: 150,
    maxWords: 600,
  },
  joke: {
    icon: '😄',
    promptTemplate: 'Tell a joke',
    minWords: 10,
    maxWords: 100,
  },
  dialogue: {
    icon: '💬',
    promptTemplate: 'Write a dialogue between characters',
    minWords: 100,
    maxWords: 400,
  },
  recipe: {
    icon: '🍳',
    promptTemplate: 'Create a unique recipe',
    minWords: 80,
    maxWords: 300,
  },
  advice: {
    icon: '💡',
    promptTemplate: 'Give thoughtful advice',
    minWords: 50,
    maxWords: 250,
  },
  analysis: {
    icon: '🔍',
    promptTemplate: 'Provide an analysis',
    minWords: 100,
    maxWords: 400,
  },
  review: {
    icon: '⭐',
    promptTemplate: 'Write a review',
    minWords: 80,
    maxWords: 300,
  },
}

// Style descriptors for prompts
const STYLE_DESCRIPTORS: Record<CreativeWorkStyle, string> = {
  dramatic: 'with dramatic tension and emotional intensity',
  comedic: 'with humor, wit, and lighthearted moments',
  romantic: 'with romantic themes and emotional connection',
  mysterious: 'with mystery, suspense, and intrigue',
  philosophical: 'with deep philosophical insights and contemplation',
  inspirational: 'with uplifting and motivational themes',
  satirical: 'with satirical wit and social commentary',
  melancholic: 'with melancholic undertones and poetic sadness',
}

// Mood to style mapping
const MOOD_STYLE_MAP: Record<EmotionType, CreativeWorkStyle[]> = {
  joy: ['comedic', 'inspirational', 'romantic'],
  sadness: ['melancholic', 'philosophical', 'dramatic'],
  anger: ['dramatic', 'satirical'],
  fear: ['mysterious', 'dramatic'],
  surprise: ['mysterious', 'comedic'],
  trust: ['inspirational', 'romantic', 'philosophical'],
  anticipation: ['dramatic', 'mysterious', 'inspirational'],
  disgust: ['satirical', 'dramatic'],
}

// Theme suggestions based on work type
const TYPE_THEMES: Record<CreativeWorkType, string[]> = {
  story: ['adventure', 'discovery', 'friendship', 'growth', 'mystery', 'love', 'redemption'],
  poem: ['nature', 'time', 'emotions', 'beauty', 'loss', 'hope', 'memory'],
  song: ['love', 'freedom', 'dreams', 'journey', 'heartbreak', 'celebration'],
  essay: ['society', 'technology', 'philosophy', 'culture', 'future', 'humanity'],
  joke: ['wordplay', 'observation', 'irony', 'situation', 'character'],
  dialogue: ['conflict', 'reconciliation', 'discovery', 'debate', 'revelation'],
  recipe: ['comfort', 'adventure', 'tradition', 'fusion', 'seasonal'],
  advice: ['career', 'relationships', 'personal growth', 'creativity', 'wellbeing'],
  analysis: ['trends', 'patterns', 'implications', 'comparisons', 'predictions'],
  review: ['appreciation', 'critique', 'recommendation', 'exploration'],
}

class CreativityService {
  /**
   * Get creative work type configuration
   */
  getTypeConfig(type: CreativeWorkType) {
    return CREATIVE_TYPE_CONFIG[type]
  }

  /**
   * Get all available creative work types
   */
  getAvailableTypes(): Array<{
    type: CreativeWorkType
    icon: string
    label: string
  }> {
    return Object.entries(CREATIVE_TYPE_CONFIG).map(([type, config]) => ({
      type: type as CreativeWorkType,
      icon: config.icon,
      label: type.charAt(0).toUpperCase() + type.slice(1),
    }))
  }

  /**
   * Get available styles
   */
  getAvailableStyles(): Array<{
    style: CreativeWorkStyle
    label: string
  }> {
    return Object.keys(STYLE_DESCRIPTORS).map(style => ({
      style: style as CreativeWorkStyle,
      label: style.charAt(0).toUpperCase() + style.slice(1),
    }))
  }

  /**
   * Suggest a style based on the agent's current emotional state
   */
  suggestStyle(emotionalState?: EmotionalState): CreativeWorkStyle {
    if (!emotionalState) {
      // Default to inspirational
      return 'inspirational'
    }

    const dominantEmotion = emotionalState.dominantEmotion
    const styles = MOOD_STYLE_MAP[dominantEmotion]

    // Return random style from suggestions
    return styles[Math.floor(Math.random() * styles.length)]
  }

  /**
   * Get theme suggestions for a work type
   */
  suggestThemes(type: CreativeWorkType): string[] {
    return TYPE_THEMES[type] || ['general']
  }

  /**
   * Generate the prompt for creative work generation
   */
  generateCreativePrompt(
    agent: AgentRecord,
    type: CreativeWorkType,
    style: CreativeWorkStyle,
    userPrompt?: string,
    themes?: string[]
  ): string {
    const config = CREATIVE_TYPE_CONFIG[type]
    const styleDesc = STYLE_DESCRIPTORS[style]
    const selectedThemes = themes?.length ? themes : this.suggestThemes(type).slice(0, 2)

    let basePrompt = `${config.promptTemplate} ${styleDesc}.`

    // Add user prompt if provided
    if (userPrompt) {
      basePrompt += `\n\nSpecific request: ${userPrompt}`
    }

    // Add theme guidance
    basePrompt += `\n\nThemes to explore: ${selectedThemes.join(', ')}`

    // Add personality context
    if (agent.linguisticProfile) {
      const lp = agent.linguisticProfile
      basePrompt += `\n\nMaintain your linguistic style:`
      if (lp.formality > 0.7) basePrompt += ' Use formal, eloquent language.'
      else if (lp.formality < 0.3) basePrompt += ' Keep it casual and conversational.'

      if (lp.humor > 0.6) basePrompt += ' Include your characteristic wit.'
      if (lp.expressiveness > 0.7) basePrompt += ' Use vivid imagery and metaphors.'
    }

    // Add emotional context
    if (agent.emotionalState) {
      const emotion = agent.emotionalState.dominantEmotion
      const intensity = agent.emotionalState.currentMood[emotion]
      if (intensity > 0.5) {
        basePrompt += `\n\nYou're currently feeling ${emotion} (intensity: ${intensity.toFixed(1)}). Let this subtly influence your creative expression.`
      }
    }

    // Add word count guidance
    basePrompt += `\n\nAim for ${config.minWords}-${config.maxWords} words.`

    // Add format request
    basePrompt += `\n\nProvide your response in JSON format:
{
  "title": "Your creative title",
  "content": "Your creative work here",
  "themes": ["theme1", "theme2"],
  "inspiration": "What inspired this piece"
}`

    return basePrompt
  }

  /**
   * Parse creative work response from LLM
   */
  parseCreativeResponse(
    agentId: string,
    type: CreativeWorkType,
    style: CreativeWorkStyle,
    response: string,
    userPrompt?: string,
    emotionalState?: EmotionalState
  ): CreativeWork {
    const now = new Date().toISOString()

    try {
      // Try to parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])

        return {
          id: generateId(),
          agentId,
          type,
          style,
          title: parsed.title || `Untitled ${type}`,
          content: parsed.content || response,
          prompt: userPrompt,
          inspiration: parsed.inspiration,
          emotionalContext: emotionalState,
          wordCount: (parsed.content || response).split(/\s+/).length,
          themes: parsed.themes || [],
          mood: emotionalState?.dominantEmotion || 'joy',
          creativity: 0.7 + Math.random() * 0.3,
          coherence: 0.7 + Math.random() * 0.3,
          emotionalDepth: 0.6 + Math.random() * 0.4,
          createdAt: now,
          isFavorite: false,
        }
      }
    } catch {
      // JSON parsing failed, use raw response
    }

    // Fallback: use raw response
    return {
      id: generateId(),
      agentId,
      type,
      style,
      title: `${type.charAt(0).toUpperCase() + type.slice(1)} Creation`,
      content: response,
      prompt: userPrompt,
      emotionalContext: emotionalState,
      wordCount: response.split(/\s+/).length,
      themes: [],
      mood: emotionalState?.dominantEmotion || 'joy',
      creativity: 0.6 + Math.random() * 0.3,
      coherence: 0.6 + Math.random() * 0.3,
      emotionalDepth: 0.5 + Math.random() * 0.4,
      createdAt: now,
      isFavorite: false,
    }
  }

  /**
   * Get creative work stats for an agent
   */
  getCreativeStats(works: CreativeWork[]): {
    totalWorks: number
    byType: Record<string, number>
    byStyle: Record<string, number>
    averageQuality: number
    favorites: number
    recentWorks: CreativeWork[]
  } {
    const byType: Record<string, number> = {}
    const byStyle: Record<string, number> = {}
    let totalQuality = 0
    let favorites = 0

    for (const work of works) {
      byType[work.type] = (byType[work.type] || 0) + 1
      byStyle[work.style] = (byStyle[work.style] || 0) + 1
      totalQuality += (work.creativity + work.coherence + work.emotionalDepth) / 3
      if (work.isFavorite) favorites++
    }

    const recentWorks = [...works]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    return {
      totalWorks: works.length,
      byType,
      byStyle,
      averageQuality: works.length > 0 ? totalQuality / works.length : 0,
      favorites,
      recentWorks,
    }
  }

  /**
   * Filter works by criteria
   */
  filterWorks(
    works: CreativeWork[],
    filters: {
      type?: CreativeWorkType
      style?: CreativeWorkStyle
      favoritesOnly?: boolean
      searchQuery?: string
    }
  ): CreativeWork[] {
    return works.filter(work => {
      if (filters.type && work.type !== filters.type) return false
      if (filters.style && work.style !== filters.style) return false
      if (filters.favoritesOnly && !work.isFavorite) return false
      if (filters.searchQuery) {
        const query = filters.searchQuery.toLowerCase()
        if (
          !work.title.toLowerCase().includes(query) &&
          !work.content.toLowerCase().includes(query) &&
          !work.themes.some(t => t.toLowerCase().includes(query))
        ) {
          return false
        }
      }
      return true
    })
  }

  /**
   * Generate a creative prompt based on agent's recent experiences
   */
  generateInspiredPrompt(
    agent: AgentRecord,
    recentMemories?: Array<{ content: string }>
  ): { type: CreativeWorkType; prompt: string } {
    const types: CreativeWorkType[] = ['story', 'poem', 'essay', 'dialogue']
    const selectedType = types[Math.floor(Math.random() * types.length)]

    let prompt = ''

    // Use emotional state for inspiration
    if (agent.emotionalState) {
      const emotion = agent.emotionalState.dominantEmotion
      const prompts: Record<EmotionType, string[]> = {
        joy: ['a celebration of life', 'finding happiness in small things', 'a joyful discovery'],
        sadness: ['letting go', 'finding hope in darkness', 'memories of what was'],
        anger: ['fighting for justice', 'overcoming obstacles', 'passionate transformation'],
        fear: ['facing the unknown', 'courage in adversity', 'conquering inner demons'],
        surprise: ['unexpected discoveries', 'moments that change everything', 'the wonder of the unknown'],
        trust: ['unbreakable bonds', 'faith in others', 'the foundation of friendship'],
        anticipation: ['dreams of tomorrow', 'the journey ahead', 'exciting possibilities'],
        disgust: ['seeing beyond appearances', 'truth beneath the surface', 'transformation of the unpleasant'],
      }
      const emotionPrompts = prompts[emotion]
      prompt = emotionPrompts[Math.floor(Math.random() * emotionPrompts.length)]
    }

    // Incorporate recent memories if available
    if (recentMemories && recentMemories.length > 0) {
      const randomMemory = recentMemories[Math.floor(Math.random() * recentMemories.length)]
      if (randomMemory.content.length > 20) {
        prompt += ` inspired by: "${randomMemory.content.substring(0, 100)}..."`
      }
    }

    if (!prompt) {
      prompt = 'something meaningful to you right now'
    }

    return { type: selectedType, prompt }
  }
}

// Export singleton instance
export const creativityService = new CreativityService()

// Export class for testing
export { CreativityService }
