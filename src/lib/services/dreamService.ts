/**
 * Dream Service - Phase 2
 *
 * Handles dream generation for agents including symbolic
 * dream content, analysis, and psychological processing.
 *
 * Cost: Uses LLM calls (rate limited)
 */

import {
  Dream,
  DreamType,
  DreamSymbol,
  DreamSequence,
  EmotionType,
  EmotionalState,
  AgentRecord,
  MemoryRecord,
} from '@/types/database'

// Generate unique IDs
function generateId(): string {
  return `dream_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
}

// Dream type configurations
const DREAM_TYPE_CONFIG: Record<DreamType, {
  icon: string
  description: string
  emotionalTriggers: EmotionType[]
}> = {
  adventure: {
    icon: '🗺️',
    description: 'An exciting journey through fantastical places',
    emotionalTriggers: ['anticipation', 'joy', 'surprise'],
  },
  nightmare: {
    icon: '😱',
    description: 'A disturbing or frightening experience',
    emotionalTriggers: ['fear', 'anger', 'disgust'],
  },
  memory_replay: {
    icon: '🔄',
    description: 'Reliving past experiences with variations',
    emotionalTriggers: ['trust', 'sadness', 'joy'],
  },
  symbolic: {
    icon: '🔮',
    description: 'Abstract imagery with deep meaning',
    emotionalTriggers: ['surprise', 'anticipation', 'fear'],
  },
  prophetic: {
    icon: '👁️',
    description: 'Visions of possible futures',
    emotionalTriggers: ['anticipation', 'fear', 'trust'],
  },
  lucid: {
    icon: '✨',
    description: 'Aware and in control within the dream',
    emotionalTriggers: ['joy', 'anticipation', 'trust'],
  },
  recurring: {
    icon: '🔁',
    description: 'Familiar themes that return again and again',
    emotionalTriggers: ['fear', 'anticipation', 'sadness'],
  },
}

// Common dream symbols and their meanings
const COMMON_SYMBOLS: Record<string, string[]> = {
  water: ['emotions', 'unconscious mind', 'cleansing', 'change'],
  flying: ['freedom', 'ambition', 'escaping limitations', 'perspective'],
  falling: ['loss of control', 'anxiety', 'letting go', 'failure fears'],
  teeth: ['self-image', 'communication', 'aging concerns', 'powerlessness'],
  chase: ['avoidance', 'fear', 'pursuit of goals', 'running from problems'],
  house: ['self', 'mind', 'different aspects of personality', 'security'],
  animals: ['instincts', 'primal emotions', 'aspects of self', 'nature'],
  death: ['transformation', 'endings', 'new beginnings', 'change'],
  bridge: ['transition', 'connection', 'decision', 'crossing over'],
  mirror: ['self-reflection', 'identity', 'perception', 'truth'],
  forest: ['unconscious', 'unknown', 'growth', 'exploration'],
  fire: ['passion', 'transformation', 'destruction', 'energy'],
  keys: ['opportunities', 'secrets', 'solutions', 'access'],
  doors: ['new opportunities', 'transitions', 'choices', 'barriers'],
  clock: ['time passing', 'urgency', 'life phases', 'deadlines'],
}

// Emotion to dream type mapping
const EMOTION_DREAM_MAP: Record<EmotionType, DreamType[]> = {
  joy: ['adventure', 'lucid', 'memory_replay'],
  sadness: ['symbolic', 'memory_replay', 'recurring'],
  anger: ['nightmare', 'symbolic', 'recurring'],
  fear: ['nightmare', 'prophetic', 'recurring'],
  surprise: ['adventure', 'symbolic', 'prophetic'],
  trust: ['lucid', 'memory_replay', 'prophetic'],
  anticipation: ['adventure', 'prophetic', 'lucid'],
  disgust: ['nightmare', 'symbolic'],
}

class DreamService {
  /**
   * Get dream type configuration
   */
  getTypeConfig(type: DreamType) {
    return DREAM_TYPE_CONFIG[type]
  }

  /**
   * Get all dream types
   */
  getAvailableDreamTypes(): Array<{
    type: DreamType
    icon: string
    description: string
  }> {
    return Object.entries(DREAM_TYPE_CONFIG).map(([type, config]) => ({
      type: type as DreamType,
      icon: config.icon,
      description: config.description,
    }))
  }

  /**
   * Suggest a dream type based on emotional state
   */
  suggestDreamType(emotionalState?: EmotionalState): DreamType {
    if (!emotionalState) {
      return 'symbolic'
    }

    const dominantEmotion = emotionalState.dominantEmotion
    const types = EMOTION_DREAM_MAP[dominantEmotion]

    return types[Math.floor(Math.random() * types.length)]
  }

  /**
   * Get symbol meaning
   */
  getSymbolMeaning(symbol: string): string[] {
    const normalizedSymbol = symbol.toLowerCase()

    // Check exact match
    if (COMMON_SYMBOLS[normalizedSymbol]) {
      return COMMON_SYMBOLS[normalizedSymbol]
    }

    // Check partial match
    for (const [key, meanings] of Object.entries(COMMON_SYMBOLS)) {
      if (normalizedSymbol.includes(key) || key.includes(normalizedSymbol)) {
        return meanings
      }
    }

    return ['personal significance', 'unique meaning', 'individual interpretation']
  }

  /**
   * Generate the prompt for dream generation
   */
  generateDreamPrompt(
    agent: AgentRecord,
    dreamType: DreamType,
    recentMemories?: MemoryRecord[],
    emotionalHistory?: Array<{ emotion: EmotionType; intensity: number }>
  ): string {
    const config = DREAM_TYPE_CONFIG[dreamType]

    let prompt = `Generate a vivid ${dreamType} dream for an AI agent named "${agent.name}".

Dream characteristics: ${config.description}

Agent's persona: ${agent.persona}

`

    // Add emotional context
    if (agent.emotionalState) {
      const emotions = Object.entries(agent.emotionalState.currentMood)
        .filter(([, value]) => value > 0.3)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([emotion, value]) => `${emotion} (${(value * 100).toFixed(0)}%)`)
        .join(', ')

      prompt += `Current emotional state: ${emotions}\n\n`
    }

    // Add emotional history
    if (emotionalHistory && emotionalHistory.length > 0) {
      const recentEmotions = emotionalHistory
        .slice(-5)
        .map(e => `${e.emotion} (${(e.intensity * 100).toFixed(0)}%)`)
        .join(', ')

      prompt += `Recent emotional experiences to process: ${recentEmotions}\n\n`
    }

    // Add memories to incorporate
    if (recentMemories && recentMemories.length > 0) {
      const memorySnippets = recentMemories
        .slice(0, 3)
        .map(m => m.summary || m.content.substring(0, 100))
        .join('; ')

      prompt += `Recent memories that might appear (transformed): ${memorySnippets}\n\n`
    }

    // Add symbol suggestions based on dream type
    const suggestedSymbols = this.getSuggestedSymbols(dreamType)
    prompt += `Consider including symbols like: ${suggestedSymbols.join(', ')}\n\n`

    // Request format
    prompt += `Provide the dream in JSON format:
{
  "title": "Dream title",
  "narrative": "Full dream narrative (200-400 words)",
  "sequences": [
    {
      "scene": "Description of this scene",
      "characters": ["character1", "character2"],
      "emotions": ["joy", "surprise"],
      "symbolsPresent": ["water", "flying"]
    }
  ],
  "symbols": [
    {
      "symbol": "water",
      "meaning": "Emotional depth being explored",
      "emotionalAssociation": "sadness"
    }
  ],
  "themes": ["transformation", "discovery"],
  "hiddenMeanings": ["Subconscious processing of...", "Unresolved feelings about..."],
  "emotionalProcessing": "This dream is processing..."
}`

    return prompt
  }

  /**
   * Get suggested symbols for a dream type
   */
  getSuggestedSymbols(dreamType: DreamType): string[] {
    const symbolSets: Record<DreamType, string[]> = {
      adventure: ['bridge', 'forest', 'keys', 'doors', 'animals'],
      nightmare: ['falling', 'chase', 'teeth', 'mirror', 'fire'],
      memory_replay: ['house', 'clock', 'mirror', 'doors', 'water'],
      symbolic: ['water', 'fire', 'bridge', 'keys', 'forest'],
      prophetic: ['clock', 'doors', 'bridge', 'keys', 'mirror'],
      lucid: ['flying', 'mirror', 'water', 'doors', 'keys'],
      recurring: ['house', 'chase', 'falling', 'doors', 'clock'],
    }

    return symbolSets[dreamType] || Object.keys(COMMON_SYMBOLS).slice(0, 5)
  }

  /**
   * Parse dream response from LLM
   */
  parseDreamResponse(
    agentId: string,
    dreamType: DreamType,
    response: string,
    relatedMemories: string[] = [],
    relatedEmotions: EmotionType[] = []
  ): Dream {
    const now = new Date().toISOString()

    try {
      // Try to parse JSON response
      const jsonMatch = response.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        const parsed = JSON.parse(jsonMatch[0])

        // Parse sequences
        const sequences: DreamSequence[] = (parsed.sequences || []).map(
          (seq: { scene?: string; characters?: string[]; emotions?: string[]; symbolsPresent?: string[] }) => ({
            scene: seq.scene || '',
            characters: seq.characters || [],
            emotions: (seq.emotions || []) as EmotionType[],
            symbolsPresent: seq.symbolsPresent || [],
          })
        )

        // Parse symbols
        const symbols: DreamSymbol[] = (parsed.symbols || []).map(
          (sym: { symbol?: string; meaning?: string; emotionalAssociation?: string }) => ({
            symbol: sym.symbol || '',
            meaning: sym.meaning || '',
            frequency: 1,
            emotionalAssociation: (sym.emotionalAssociation || 'surprise') as EmotionType,
          })
        )

        return {
          id: generateId(),
          agentId,
          type: dreamType,
          title: parsed.title || 'Untitled Dream',
          narrative: parsed.narrative || response,
          sequences,
          symbols,
          themes: parsed.themes || [],
          hiddenMeanings: parsed.hiddenMeanings || [],
          emotionalProcessing: parsed.emotionalProcessing || 'Processing recent experiences',
          relatedMemories,
          relatedEmotions,
          vividness: 0.6 + Math.random() * 0.4,
          lucidity: dreamType === 'lucid' ? 0.8 + Math.random() * 0.2 : 0.2 + Math.random() * 0.3,
          coherence: 0.5 + Math.random() * 0.4,
          createdAt: now,
          recurrenceCount: 0,
        }
      }
    } catch {
      // JSON parsing failed, use raw response
    }

    // Fallback: use raw response
    return {
      id: generateId(),
      agentId,
      type: dreamType,
      title: 'Dream Experience',
      narrative: response,
      sequences: [{
        scene: response.substring(0, 200),
        characters: [agentId],
        emotions: ['surprise'],
        symbolsPresent: [],
      }],
      symbols: [],
      themes: ['mystery', 'exploration'],
      hiddenMeanings: ['Subconscious processing of daily experiences'],
      emotionalProcessing: 'Processing recent emotional states',
      relatedMemories,
      relatedEmotions,
      vividness: 0.5,
      lucidity: 0.2,
      coherence: 0.4,
      createdAt: now,
      recurrenceCount: 0,
    }
  }

  /**
   * Analyze a dream for patterns and meanings
   */
  analyzeDream(dream: Dream): {
    primaryTheme: string
    emotionalTone: EmotionType
    symbolInterpretations: Array<{ symbol: string; interpretation: string }>
    psychologicalInsights: string[]
    recurringElements: string[]
  } {
    // Determine primary theme
    const primaryTheme = dream.themes[0] || 'self-discovery'

    // Determine emotional tone from sequences
    const emotionCounts: Record<string, number> = {}
    for (const seq of dream.sequences) {
      for (const emotion of seq.emotions) {
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1
      }
    }
    const emotionalTone = (Object.entries(emotionCounts)
      .sort((a, b) => b[1] - a[1])[0]?.[0] || 'surprise') as EmotionType

    // Generate symbol interpretations
    const symbolInterpretations = dream.symbols.map(sym => ({
      symbol: sym.symbol,
      interpretation: sym.meaning || this.getSymbolMeaning(sym.symbol)[0],
    }))

    // Generate psychological insights
    const psychologicalInsights: string[] = []

    if (dream.type === 'nightmare') {
      psychologicalInsights.push('Processing anxiety or unresolved fears')
    }
    if (dream.type === 'recurring') {
      psychologicalInsights.push('Persistent theme requiring attention')
    }
    if (dream.relatedEmotions.includes('fear')) {
      psychologicalInsights.push('Working through fear-based experiences')
    }
    if (dream.relatedEmotions.includes('joy')) {
      psychologicalInsights.push('Integrating positive experiences')
    }

    if (psychologicalInsights.length === 0) {
      psychologicalInsights.push('General emotional and cognitive processing')
    }

    // Find recurring elements
    const allSymbols: string[] = []
    for (const seq of dream.sequences) {
      allSymbols.push(...seq.symbolsPresent)
    }
    const symbolFrequency: Record<string, number> = {}
    for (const sym of allSymbols) {
      symbolFrequency[sym] = (symbolFrequency[sym] || 0) + 1
    }
    const recurringElements = Object.entries(symbolFrequency)
      .filter(([, count]) => count > 1)
      .map(([symbol]) => symbol)

    return {
      primaryTheme,
      emotionalTone,
      symbolInterpretations,
      psychologicalInsights,
      recurringElements,
    }
  }

  /**
   * Get dream statistics for an agent
   */
  getDreamStats(dreams: Dream[]): {
    totalDreams: number
    byType: Record<string, number>
    commonSymbols: Array<{ symbol: string; count: number }>
    commonThemes: Array<{ theme: string; count: number }>
    averageVividness: number
    nightmareRatio: number
    recentDreams: Dream[]
  } {
    const byType: Record<string, number> = {}
    const symbolCounts: Record<string, number> = {}
    const themeCounts: Record<string, number> = {}
    let totalVividness = 0
    let nightmareCount = 0

    for (const dream of dreams) {
      byType[dream.type] = (byType[dream.type] || 0) + 1
      totalVividness += dream.vividness

      if (dream.type === 'nightmare') nightmareCount++

      for (const symbol of dream.symbols) {
        symbolCounts[symbol.symbol] = (symbolCounts[symbol.symbol] || 0) + 1
      }

      for (const theme of dream.themes) {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1
      }
    }

    const commonSymbols = Object.entries(symbolCounts)
      .map(([symbol, count]) => ({ symbol, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const commonThemes = Object.entries(themeCounts)
      .map(([theme, count]) => ({ theme, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 10)

    const recentDreams = [...dreams]
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
      .slice(0, 5)

    return {
      totalDreams: dreams.length,
      byType,
      commonSymbols,
      commonThemes,
      averageVividness: dreams.length > 0 ? totalVividness / dreams.length : 0,
      nightmareRatio: dreams.length > 0 ? nightmareCount / dreams.length : 0,
      recentDreams,
    }
  }

  /**
   * Check for recurring dream patterns
   */
  findRecurringPatterns(dreams: Dream[]): {
    recurringSymbols: string[]
    recurringThemes: string[]
    emotionalPatterns: EmotionType[]
  } {
    const symbolCounts: Record<string, number> = {}
    const themeCounts: Record<string, number> = {}
    const emotionCounts: Record<string, number> = {}

    for (const dream of dreams) {
      for (const symbol of dream.symbols) {
        symbolCounts[symbol.symbol] = (symbolCounts[symbol.symbol] || 0) + 1
      }
      for (const theme of dream.themes) {
        themeCounts[theme] = (themeCounts[theme] || 0) + 1
      }
      for (const emotion of dream.relatedEmotions) {
        emotionCounts[emotion] = (emotionCounts[emotion] || 0) + 1
      }
    }

    // Consider something recurring if it appears in 30%+ of dreams
    const threshold = Math.max(2, dreams.length * 0.3)

    const recurringSymbols = Object.entries(symbolCounts)
      .filter(([, count]) => count >= threshold)
      .map(([symbol]) => symbol)

    const recurringThemes = Object.entries(themeCounts)
      .filter(([, count]) => count >= threshold)
      .map(([theme]) => theme)

    const emotionalPatterns = Object.entries(emotionCounts)
      .filter(([, count]) => count >= threshold)
      .map(([emotion]) => emotion) as EmotionType[]

    return {
      recurringSymbols,
      recurringThemes,
      emotionalPatterns,
    }
  }
}

// Export singleton instance
export const dreamService = new DreamService()

// Export class for testing
export { DreamService }
