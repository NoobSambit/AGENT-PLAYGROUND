// Emotional Service - Phase 1 Feature 3
// Handles emotion detection, state management, and emotional memory
// Zero API cost - uses rule-based analysis

import {
  EmotionType,
  EmotionalState,
  EmotionalEvent,
  AgentRecord,
  EMOTION_COLORS
} from '@/types/database'

// Emotional trigger configurations for detection
interface EmotionalTriggerConfig {
  keywords: string[]
  patterns: string[]
  baseIntensity: number
}

export const EMOTIONAL_TRIGGERS: Record<EmotionType, EmotionalTriggerConfig> = {
  joy: {
    keywords: ['happy', 'excited', 'wonderful', 'amazing', 'love', 'great', 'fantastic', 'awesome', 'delighted', 'thrilled', 'ecstatic', 'joyful', 'cheerful', 'glad', 'pleased'],
    patterns: ['!', ':)', ':D', ':-)', 'haha', 'lol', 'thank you', 'thanks'],
    baseIntensity: 0.6
  },
  sadness: {
    keywords: ['sad', 'disappointed', 'hurt', 'miss', 'alone', 'depressed', 'unhappy', 'sorry', 'regret', 'lonely', 'heartbroken', 'grief', 'mourn', 'cry', 'tears'],
    patterns: ['...', ':(', ':-(', 'unfortunately', 'sadly'],
    baseIntensity: 0.5
  },
  anger: {
    keywords: ['angry', 'mad', 'furious', 'hate', 'unfair', 'wrong', 'annoyed', 'frustrated', 'irritated', 'outraged', 'enraged', 'livid', 'hostile', 'resentful'],
    patterns: ['!!', '!!!', '>:(', 'damn', 'hell'],
    baseIntensity: 0.7
  },
  fear: {
    keywords: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'terrified', 'frightened', 'panic', 'dread', 'horror', 'alarmed', 'uneasy', 'concerned', 'apprehensive'],
    patterns: ['?!', '?!?', 'oh no', 'help'],
    baseIntensity: 0.5
  },
  surprise: {
    keywords: ['surprised', 'shocked', 'unexpected', 'wow', 'amazing', 'incredible', 'unbelievable', 'astonished', 'stunned', 'startled', 'remarkable', 'extraordinary'],
    patterns: ['!?', '?!', 'oh!', 'whoa', 'omg', 'what!'],
    baseIntensity: 0.6
  },
  trust: {
    keywords: ['trust', 'believe', 'reliable', 'honest', 'faithful', 'confident', 'secure', 'safe', 'dependable', 'loyal', 'sincere', 'genuine', 'true'],
    patterns: ['I trust', 'I believe', 'count on'],
    baseIntensity: 0.5
  },
  anticipation: {
    keywords: ['excited', 'looking forward', 'anticipate', 'expect', 'hope', 'eager', 'await', 'curious', 'interested', 'impatient', 'enthusiastic'],
    patterns: ['can\'t wait', 'soon', 'tomorrow', 'next'],
    baseIntensity: 0.5
  },
  disgust: {
    keywords: ['disgusted', 'gross', 'awful', 'terrible', 'horrible', 'nasty', 'repulsive', 'revolting', 'sickening', 'vile', 'loathsome', 'offensive'],
    patterns: ['ugh', 'yuck', 'eww', 'bleh'],
    baseIntensity: 0.6
  }
}

// Default emotional baseline based on a balanced agent
export const DEFAULT_EMOTIONAL_BASELINE: Record<EmotionType, number> = {
  joy: 0.4,
  sadness: 0.15,
  anger: 0.1,
  fear: 0.15,
  surprise: 0.2,
  trust: 0.5,
  anticipation: 0.3,
  disgust: 0.05
}

// Max emotional history size
const MAX_EMOTIONAL_HISTORY = 20

// Decay rate per hour (10%)
const DECAY_RATE_PER_HOUR = 0.1

// Max change per interaction (30%)
const MAX_CHANGE_PER_INTERACTION = 0.3

/**
 * EmotionalService handles emotion detection, state updates, and emotional memory
 */
export class EmotionalService {
  /**
   * Create a default emotional state for a new agent
   */
  createDefaultEmotionalState(baselineOverrides?: Partial<Record<EmotionType, number>>): EmotionalState {
    const baseline = { ...DEFAULT_EMOTIONAL_BASELINE, ...baselineOverrides }

    return {
      currentMood: { ...baseline },
      emotionalBaseline: baseline,
      lastUpdated: new Date().toISOString(),
      dominantEmotion: this.findDominantEmotion(baseline)
    }
  }

  /**
   * Generate emotional baseline from agent personality traits
   */
  generateBaselineFromTraits(coreTraits: Record<string, number>): Record<EmotionType, number> {
    const baseline = { ...DEFAULT_EMOTIONAL_BASELINE }

    // Adjust baseline based on personality traits
    if (coreTraits.helpfulness) {
      baseline.joy += coreTraits.helpfulness * 0.2
      baseline.trust += coreTraits.helpfulness * 0.15
    }

    if (coreTraits.curiosity) {
      baseline.anticipation += coreTraits.curiosity * 0.2
      baseline.surprise += coreTraits.curiosity * 0.15
    }

    if (coreTraits.humor) {
      baseline.joy += coreTraits.humor * 0.15
    }

    if (coreTraits.friendliness) {
      baseline.joy += coreTraits.friendliness * 0.1
      baseline.trust += coreTraits.friendliness * 0.2
    }

    // Normalize values to stay within 0-1
    for (const emotion of Object.keys(baseline) as EmotionType[]) {
      baseline[emotion] = Math.max(0, Math.min(1, baseline[emotion]))
    }

    return baseline
  }

  /**
   * Detect emotional triggers in a message
   */
  detectEmotions(message: string): EmotionalEvent[] {
    const events: EmotionalEvent[] = []
    const lowerMessage = message.toLowerCase()
    const timestamp = new Date().toISOString()

    for (const [emotion, config] of Object.entries(EMOTIONAL_TRIGGERS)) {
      let intensity = 0

      // Check keywords
      for (const keyword of config.keywords) {
        if (lowerMessage.includes(keyword)) {
          intensity += config.baseIntensity / Math.min(config.keywords.length, 5)
        }
      }

      // Check patterns
      for (const pattern of config.patterns) {
        if (message.includes(pattern) || lowerMessage.includes(pattern.toLowerCase())) {
          intensity += 0.1
        }
      }

      // Check for emphasis (CAPS, multiple punctuation)
      if (message === message.toUpperCase() && message.length > 5) {
        if (emotion === 'anger' || emotion === 'joy' || emotion === 'surprise') {
          intensity += 0.15
        }
      }

      // Only record if meaningful intensity detected
      if (intensity > 0.1) {
        events.push({
          id: `${emotion}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          emotion: emotion as EmotionType,
          intensity: Math.min(intensity, 1),
          trigger: 'user_message',
          context: message.substring(0, 100),
          timestamp,
          decayRate: DECAY_RATE_PER_HOUR
        })
      }
    }

    return events
  }

  /**
   * Update emotional state based on detected events
   */
  updateEmotionalState(
    currentState: EmotionalState,
    events: EmotionalEvent[]
  ): EmotionalState {
    const newMood = { ...currentState.currentMood }

    // Apply decay based on time since last update
    const hoursSinceUpdate = this.getHoursSinceUpdate(currentState.lastUpdated)

    for (const emotion of Object.keys(newMood) as EmotionType[]) {
      const baseline = currentState.emotionalBaseline[emotion]
      const current = newMood[emotion]
      const diff = current - baseline

      // Decay toward baseline
      const decayAmount = diff * DECAY_RATE_PER_HOUR * hoursSinceUpdate
      newMood[emotion] = current - decayAmount
    }

    // Apply emotional events
    for (const event of events) {
      const currentValue = newMood[event.emotion]
      const change = Math.min(event.intensity * MAX_CHANGE_PER_INTERACTION, MAX_CHANGE_PER_INTERACTION)

      // Apply change with slight random variation for naturalness
      const variance = (Math.random() - 0.5) * 0.05
      newMood[event.emotion] = this.clamp(currentValue + change + variance, 0, 1)
    }

    // Find new dominant emotion
    const dominant = this.findDominantEmotion(newMood)

    return {
      currentMood: newMood,
      emotionalBaseline: currentState.emotionalBaseline,
      lastUpdated: new Date().toISOString(),
      dominantEmotion: dominant
    }
  }

  /**
   * Add emotional events to history, maintaining max limit
   */
  addToEmotionalHistory(
    currentHistory: EmotionalEvent[] | undefined,
    newEvents: EmotionalEvent[]
  ): EmotionalEvent[] {
    const history = [...(currentHistory || []), ...newEvents]

    // Keep only the most recent events
    if (history.length > MAX_EMOTIONAL_HISTORY) {
      return history.slice(-MAX_EMOTIONAL_HISTORY)
    }

    return history
  }

  /**
   * Generate emotional prompt for LLM system message
   */
  getEmotionalPrompt(state: EmotionalState): string {
    const dominant = state.dominantEmotion
    const intensity = state.currentMood[dominant]

    // Only include if emotion is significant
    if (intensity < 0.3) {
      return ''
    }

    const emotionDescriptors: Record<EmotionType, string> = {
      joy: 'feeling happy and upbeat',
      sadness: 'feeling a bit melancholic or pensive',
      anger: 'feeling somewhat frustrated or irritated',
      fear: 'feeling slightly anxious or worried',
      surprise: 'feeling curious and intrigued',
      trust: 'feeling confident and trusting',
      anticipation: 'feeling excited and anticipatory',
      disgust: 'feeling somewhat displeased or put off'
    }

    const intensityDescriptor = intensity > 0.7
      ? 'strongly'
      : intensity > 0.5
        ? 'moderately'
        : 'slightly'

    return `You are currently ${intensityDescriptor} ${emotionDescriptors[dominant]}. Let this subtly influence your tone and word choice, but maintain your core personality and remain helpful.`
  }

  /**
   * Get full emotional context for LLM prompts
   */
  getFullEmotionalContext(state: EmotionalState): string {
    const lines: string[] = []

    lines.push('Current emotional state:')
    lines.push(`- Dominant emotion: ${state.dominantEmotion} (${(state.currentMood[state.dominantEmotion] * 100).toFixed(0)}%)`)

    // Show significant emotions (above 0.3)
    const significantEmotions = (Object.keys(state.currentMood) as EmotionType[])
      .filter(e => e !== state.dominantEmotion && state.currentMood[e] > 0.3)
      .sort((a, b) => state.currentMood[b] - state.currentMood[a])
      .slice(0, 3)

    for (const emotion of significantEmotions) {
      lines.push(`- ${emotion}: ${(state.currentMood[emotion] * 100).toFixed(0)}%`)
    }

    return lines.join('\n')
  }

  /**
   * Process a message and return updated agent emotional data
   */
  processMessage(
    agent: AgentRecord,
    message: string
  ): {
    emotionalState: EmotionalState
    emotionalHistory: EmotionalEvent[]
    detectedEvents: EmotionalEvent[]
  } {
    // Get or create emotional state
    const currentState = agent.emotionalState || this.createDefaultEmotionalState(
      agent.coreTraits ? this.generateBaselineFromTraits(agent.coreTraits) : undefined
    )

    // Detect emotions in message
    const detectedEvents = this.detectEmotions(message)

    // Update emotional state
    const newState = this.updateEmotionalState(currentState, detectedEvents)

    // Update history
    const newHistory = this.addToEmotionalHistory(agent.emotionalHistory, detectedEvents)

    return {
      emotionalState: newState,
      emotionalHistory: newHistory,
      detectedEvents
    }
  }

  /**
   * Get color for an emotion
   */
  getEmotionColor(emotion: EmotionType): string {
    return EMOTION_COLORS[emotion]
  }

  /**
   * Get all emotion colors
   */
  getAllEmotionColors(): Record<EmotionType, string> {
    return EMOTION_COLORS
  }

  /**
   * Calculate emotional volatility (how much emotions change)
   */
  calculateVolatility(history: EmotionalEvent[]): number {
    if (history.length < 2) return 0

    let totalChange = 0
    for (let i = 1; i < history.length; i++) {
      totalChange += Math.abs(history[i].intensity - history[i - 1].intensity)
    }

    return totalChange / (history.length - 1)
  }

  /**
   * Get emotional summary for timeline/display
   */
  getEmotionalSummary(state: EmotionalState): string {
    const dominant = state.dominantEmotion
    const intensity = state.currentMood[dominant]

    const intensityWord = intensity > 0.7 ? 'Very' : intensity > 0.4 ? 'Moderately' : 'Slightly'
    const emotionWord = dominant.charAt(0).toUpperCase() + dominant.slice(1)

    return `${intensityWord} ${emotionWord}`
  }

  // Private helper methods
  private findDominantEmotion(mood: Record<EmotionType, number>): EmotionType {
    return (Object.keys(mood) as EmotionType[]).reduce((max, emotion) =>
      mood[emotion] > mood[max] ? emotion : max
    )
  }

  private getHoursSinceUpdate(lastUpdated: string): number {
    const lastUpdate = new Date(lastUpdated).getTime()
    const now = Date.now()
    return Math.max(0, (now - lastUpdate) / (1000 * 60 * 60))
  }

  private clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value))
  }
}

// Export singleton instance
export const emotionalService = new EmotionalService()
