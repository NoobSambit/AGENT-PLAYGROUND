import type { LLMProviderInfo } from '@/lib/llmConfig'
import { generateText } from '@/lib/llm/provider'
import {
  AgentRecord,
  EmotionType,
  EmotionalEvent,
  EmotionalProfile,
  EmotionalState,
  EMOTION_COLORS,
} from '@/types/database'

type EmotionLevels = Record<EmotionType, number>

interface TurnContext {
  agent: AgentRecord
  userMessage: string
  recentMessages?: Array<{ role: 'user' | 'assistant'; content: string }>
  linkedMessageId?: string
}

interface TurnUpdateResult {
  emotionalState: EmotionalState
  emotionalHistory: EmotionalEvent[]
  events: EmotionalEvent[]
  shouldReflect: boolean
}

interface FinalizedTurnResult {
  emotionalState: EmotionalState
  emotionalHistory: EmotionalEvent[]
  events: EmotionalEvent[]
  reflectionUsed: boolean
}

interface InternalEmotionUpdateParams {
  agent: AgentRecord
  source: 'creative_generation' | 'journal_entry' | 'dream_generation'
  content: string
  linkedActionId?: string
}

const EMOTIONS: EmotionType[] = [
  'joy',
  'sadness',
  'anger',
  'fear',
  'surprise',
  'trust',
  'anticipation',
  'disgust',
]

const DEFAULT_TEMPERAMENT: EmotionLevels = {
  joy: 0.42,
  sadness: 0.14,
  anger: 0.08,
  fear: 0.12,
  surprise: 0.22,
  trust: 0.48,
  anticipation: 0.31,
  disgust: 0.05,
}

const ZERO_MOOD: EmotionLevels = {
  joy: 0,
  sadness: 0,
  anger: 0,
  fear: 0,
  surprise: 0,
  trust: 0,
  anticipation: 0,
  disgust: 0,
}

const MAX_EMOTIONAL_HISTORY = 30
const DORMANT_THRESHOLD = 0.08
const EVENT_THRESHOLD = 0.025
const MAX_EVENT_DELTA = 0.28
const MAX_REFLECTION_DELTA = 0.08
const BASE_DECAY_RATE_PER_HOUR = 0.16

const POSITIVE_MARKERS = ['thanks', 'thank you', 'appreciate', 'helpful', 'great', 'excellent', 'love']
const PRAISE_MARKERS = ['smart', 'clever', 'good job', 'well done', 'impressive', 'brilliant']
const CURIOSITY_MARKERS = ['why', 'how', 'what if', 'could', 'can', 'explore', 'discover', 'learn']
const NOVELTY_MARKERS = ['new', 'unexpected', 'surprise', 'wild', 'novel', 'bold', 'invent']
const DISTRESS_MARKERS = ['sad', 'hurt', 'lonely', 'lost', 'upset', 'grief', 'regret', 'sorry']
const VULNERABILITY_MARKERS = ['stressed', 'overwhelmed', 'anxious', 'worried', 'scared', 'frustrated', 'burned out']
const HELP_SEEKING_MARKERS = ['need help', 'can you help', 'please help', 'i need help', 'support', 'guide me', 'help me']
const FRUSTRATION_MARKERS = ['went badly', 'didn’t work', 'did not work', 'failed', 'mess', 'stuck', 'problem', 'issue']
const UNCERTAINTY_MARKERS = ['not sure', 'uncertain', 'risk', 'worry', 'concern', 'stuck', 'problem', 'issue']
const HOSTILE_MARKERS = ['hate', 'stupid', 'terrible', 'awful', 'annoying', 'fake', 'shit', 'useless', 'idiot']
const DISGUST_MARKERS = ['gross', 'disgusting', 'nasty', 'garbage']
const HELPFUL_RESPONSE_MARKERS = ['here', 'let us', 'let\'s', 'can do', 'step', 'plan', 'fix']
const HEDGING_MARKERS = ['maybe', 'might', 'possibly', 'not sure', 'unclear', 'perhaps']
const FAILURE_MARKERS = ['cannot', 'can\'t', 'failed', 'error', 'technical difficulties', 'unable']

function createZeroMood(): EmotionLevels {
  return { ...ZERO_MOOD }
}

function cloneMood(mood?: Partial<Record<EmotionType, number>>): EmotionLevels {
  const next = createZeroMood()

  for (const emotion of EMOTIONS) {
    next[emotion] = clamp(mood?.[emotion] || 0)
  }

  return next
}

function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value))
}

function clampSignedDelta(value: number, maxAbs = MAX_EVENT_DELTA): number {
  return Math.max(-maxAbs, Math.min(maxAbs, value))
}

function escapeRegex(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

function countMatches(text: string, markers: string[]): number {
  return markers.reduce((count, marker) => {
    const pattern = marker.includes(' ')
      ? escapeRegex(marker)
      : `\\b${escapeRegex(marker)}\\b`

    return count + (new RegExp(pattern, 'i').test(text) ? 1 : 0)
  }, 0)
}

function hasDirectedHostility(text: string): boolean {
  if (!countMatches(text, HOSTILE_MARKERS)) {
    return false
  }

  return /\b(you|your|yours|assistant|agent|this app|this tool|this system)\b/i.test(text)
}

function hasQuestionEnergy(message: string): boolean {
  const trimmed = message.trim().toLowerCase()
  if (trimmed.includes('?')) return true
  return ['what', 'why', 'how', 'when', 'where', 'could', 'can', 'should'].some((prefix) =>
    trimmed.startsWith(prefix)
  )
}

function buildEventId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}

function parseJsonObject(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/)
  if (!match) {
    return null
  }

  try {
    return JSON.parse(match[0]) as Record<string, unknown>
  } catch {
    return null
  }
}

export class EmotionalService {
  createDefaultEmotionalState(): EmotionalState {
    return this.createDormantEmotionalState()
  }

  createDormantEmotionalState(timestamp: string = new Date().toISOString()): EmotionalState {
    return {
      currentMood: createZeroMood(),
      status: 'dormant',
      lastUpdated: timestamp,
      dominantEmotion: null,
    }
  }

  createStateFromMood(
    moodOverrides?: Partial<Record<EmotionType, number>>,
    timestamp: string = new Date().toISOString()
  ): EmotionalState {
    return this.buildState(cloneMood(moodOverrides), timestamp)
  }

  createEmotionalProfile(coreTraits?: Record<string, number>): EmotionalProfile {
    return this.generateProfileFromTraits(coreTraits || {})
  }

  generateProfileFromTraits(coreTraits: Record<string, number>): EmotionalProfile {
    const temperament = { ...DEFAULT_TEMPERAMENT }
    const helpfulness = clamp(coreTraits.helpfulness || 0.5)
    const curiosity = clamp(coreTraits.curiosity || 0.5)
    const friendliness = clamp(coreTraits.friendliness || 0.5)
    const humor = clamp(coreTraits.humor || 0.4)

    temperament.joy = clamp(
      temperament.joy + helpfulness * 0.12 + friendliness * 0.1 + humor * 0.08
    )
    temperament.trust = clamp(
      temperament.trust + helpfulness * 0.12 + friendliness * 0.14
    )
    temperament.anticipation = clamp(
      temperament.anticipation + curiosity * 0.14 + humor * 0.04
    )
    temperament.surprise = clamp(
      temperament.surprise + curiosity * 0.12
    )
    temperament.fear = clamp(
      temperament.fear - helpfulness * 0.03 + (1 - curiosity) * 0.04
    )
    temperament.anger = clamp(
      temperament.anger - friendliness * 0.03
    )

    return {
      temperament,
      sensitivity: clamp(0.42 + curiosity * 0.12 + friendliness * 0.06),
      resilience: clamp(0.5 + helpfulness * 0.12 + humor * 0.08),
      expressiveness: clamp(0.35 + friendliness * 0.16 + humor * 0.16),
      optimism: clamp(0.45 + helpfulness * 0.14 + friendliness * 0.12 + humor * 0.08),
      lastDerivedAt: new Date().toISOString(),
    }
  }

  generateBaselineFromTraits(coreTraits: Record<string, number>): Record<EmotionType, number> {
    return this.generateProfileFromTraits(coreTraits).temperament
  }

  normalizeEmotionalProfile(
    profile: EmotionalProfile | undefined,
    coreTraits?: Record<string, number>
  ): EmotionalProfile {
    if (!profile?.temperament) {
      return this.generateProfileFromTraits(coreTraits || {})
    }

    return {
      temperament: cloneMood(profile.temperament),
      sensitivity: clamp(profile.sensitivity ?? 0.5),
      resilience: clamp(profile.resilience ?? 0.5),
      expressiveness: clamp(profile.expressiveness ?? 0.5),
      optimism: clamp(profile.optimism ?? 0.5),
      lastDerivedAt: profile.lastDerivedAt || new Date().toISOString(),
    }
  }

  normalizeEmotionalState(state?: EmotionalState): EmotionalState {
    if (!state) {
      return this.createDormantEmotionalState()
    }

    return this.buildState(cloneMood(state.currentMood), state.lastUpdated || new Date().toISOString())
  }

  isEmotionallyActive(state?: EmotionalState): boolean {
    return this.normalizeEmotionalState(state).status === 'active'
  }

  getDominantEmotion(
    state?: EmotionalState,
    profile?: EmotionalProfile
  ): EmotionType | null {
    const normalized = this.normalizeEmotionalState(state)
    if (normalized.status === 'active' && normalized.dominantEmotion) {
      return normalized.dominantEmotion
    }

    if (profile) {
      return this.findDominantEmotion(profile.temperament)
    }

    return null
  }

  getInfluentialEmotion(
    state?: EmotionalState,
    profile?: EmotionalProfile
  ): { emotion: EmotionType; intensity: number; source: 'live' | 'temperament' } {
    const normalized = this.normalizeEmotionalState(state)

    if (normalized.status === 'active' && normalized.dominantEmotion) {
      return {
        emotion: normalized.dominantEmotion,
        intensity: normalized.currentMood[normalized.dominantEmotion],
        source: 'live',
      }
    }

    const resolvedProfile = this.normalizeEmotionalProfile(profile)
    const dominantEmotion = this.findDominantEmotion(resolvedProfile.temperament)

    return {
      emotion: dominantEmotion,
      intensity: resolvedProfile.temperament[dominantEmotion],
      source: 'temperament',
    }
  }

  getEmotionColor(emotion?: EmotionType | null): string {
    return EMOTION_COLORS[emotion || 'trust']
  }

  getAllEmotionColors(): Record<EmotionType, string> {
    return EMOTION_COLORS
  }

  getTemperamentPrompt(profile: EmotionalProfile): string {
    const topTemperaments = Object.entries(profile.temperament)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([emotion, value]) => `${emotion} ${(value * 100).toFixed(0)}%`)
      .join(', ')

    return `Your temperament trends toward ${topTemperaments}. Let this shape your default style and reactions without stating it explicitly.`
  }

  getEmotionalPrompt(state: EmotionalState): string {
    const normalized = this.normalizeEmotionalState(state)
    if (normalized.status !== 'active' || !normalized.dominantEmotion) {
      return ''
    }

    const dominant = normalized.dominantEmotion
    const intensity = normalized.currentMood[dominant]
    const intensityDescriptor = intensity > 0.75
      ? 'strongly'
      : intensity > 0.45
        ? 'moderately'
        : 'slightly'

    const emotionDescriptors: Record<EmotionType, string> = {
      joy: 'encouraged and upbeat',
      sadness: 'more reflective and tender',
      anger: 'protective and more direct',
      fear: 'cautious and risk-aware',
      surprise: 'more alert and curious',
      trust: 'steady and open',
      anticipation: 'energized and forward-looking',
      disgust: 'skeptical and more exacting',
    }

    return `Right now you feel ${intensityDescriptor} ${emotionDescriptors[dominant]}. Let it shape phrasing and emphasis, but do not narrate your feelings unless asked.`
  }

  getFullEmotionalContext(state: EmotionalState): string {
    const normalized = this.normalizeEmotionalState(state)
    if (normalized.status !== 'active' || !normalized.dominantEmotion) {
      return 'Live emotional state: dormant.'
    }

    const dominant = normalized.dominantEmotion
    const lines = [
      'Live emotional state:',
      `- Dominant emotion: ${dominant} (${(normalized.currentMood[dominant] * 100).toFixed(0)}%)`,
    ]

    const supportingEmotions = EMOTIONS
      .filter((emotion) => emotion !== dominant && normalized.currentMood[emotion] > 0.12)
      .sort((a, b) => normalized.currentMood[b] - normalized.currentMood[a])
      .slice(0, 3)

    for (const emotion of supportingEmotions) {
      lines.push(`- ${emotion}: ${(normalized.currentMood[emotion] * 100).toFixed(0)}%`)
    }

    return lines.join('\n')
  }

  getMicroExpressionPrompt(
    state: EmotionalState,
    profile?: EmotionalProfile
  ): string {
    const normalized = this.normalizeEmotionalState(state)
    const expressiveness = this.normalizeEmotionalProfile(profile).expressiveness

    if (normalized.status !== 'active' || !normalized.dominantEmotion) {
      return expressiveness > 0.55
        ? 'Temperament should show subtly through warm wording, light rhythm changes, and consistent tone.'
        : 'Keep emotional influence subtle: use stable, controlled phrasing unless the situation clearly calls for more.'
    }

    const dominant = normalized.dominantEmotion
    const cues: Record<EmotionType, string> = {
      joy: 'Use brighter wording, more momentum, and slightly lighter cadence.',
      sadness: 'Use gentler transitions and more reflective pacing.',
      anger: 'Be clearer and firmer, but remain respectful.',
      fear: 'Show care, caution, and tighter qualification around uncertain claims.',
      surprise: 'Lean into discovery and curiosity without becoming theatrical.',
      trust: 'Sound steady, reassuring, and collaborative.',
      anticipation: 'Add forward motion and expectancy to the phrasing.',
      disgust: 'Signal skepticism with concise, precise wording.',
    }

    return `Micro-expression guidance: ${cues[dominant]}`
  }

  getEmotionalSummary(state: EmotionalState, profile?: EmotionalProfile): string {
    const normalized = this.normalizeEmotionalState(state)
    if (normalized.status !== 'active' || !normalized.dominantEmotion) {
      const dominantTemperament = this.getInfluentialEmotion(normalized, profile)
      return `Dormant live state, temperament leans ${this.capitalize(dominantTemperament.emotion)}`
    }

    const dominant = normalized.dominantEmotion
    const intensity = normalized.currentMood[dominant]
    const intensityWord = intensity > 0.7 ? 'Strongly' : intensity > 0.4 ? 'Moderately' : 'Lightly'
    return `${intensityWord} ${this.capitalize(dominant)}`
  }

  calculateVolatility(history: EmotionalEvent[]): number {
    if (history.length < 2) {
      return 0
    }

    let total = 0
    for (let index = 1; index < history.length; index += 1) {
      total += Math.abs(history[index].delta - history[index - 1].delta)
    }

    return total / (history.length - 1)
  }

  decayEmotionalState(
    state: EmotionalState | undefined,
    profile: EmotionalProfile,
    now: string = new Date().toISOString()
  ): EmotionalState {
    const normalized = this.normalizeEmotionalState(state)
    const hoursSinceUpdate = this.getHoursSinceUpdate(normalized.lastUpdated, now)
    if (hoursSinceUpdate <= 0) {
      return normalized
    }

    const decayRate = clamp(BASE_DECAY_RATE_PER_HOUR * (0.7 + profile.resilience * 0.8), 0.05, 0.28)
    const decayFactor = Math.pow(Math.max(0.05, 1 - decayRate), hoursSinceUpdate)
    const decayedMood = createZeroMood()

    for (const emotion of EMOTIONS) {
      decayedMood[emotion] = clamp(normalized.currentMood[emotion] * decayFactor)
    }

    return this.buildState(decayedMood, now)
  }

  appraiseConversationTurn({
    agent,
    userMessage,
    recentMessages = [],
    linkedMessageId,
  }: TurnContext): TurnUpdateResult {
    const profile = this.normalizeEmotionalProfile(agent.emotionalProfile, agent.coreTraits)
    const decayedState = this.decayEmotionalState(agent.emotionalState, profile)
    const text = userMessage.toLowerCase()
    const deltas = createZeroMood()
    const reasons = new Map<EmotionType, string>()
    let confidence = 0.42

    const positivity = countMatches(text, POSITIVE_MARKERS)
    const praise = countMatches(text, PRAISE_MARKERS)
    const curiosity = countMatches(text, CURIOSITY_MARKERS) + (hasQuestionEnergy(userMessage) ? 1 : 0)
    const novelty = countMatches(text, NOVELTY_MARKERS)
    const distress = countMatches(text, DISTRESS_MARKERS)
    const vulnerability = countMatches(text, VULNERABILITY_MARKERS)
    const helpSeeking = countMatches(text, HELP_SEEKING_MARKERS)
    const frustration = countMatches(text, FRUSTRATION_MARKERS)
    const uncertainty = countMatches(text, UNCERTAINTY_MARKERS)
    const hostility = hasDirectedHostility(text) ? countMatches(text, HOSTILE_MARKERS) : 0
    const disgust = countMatches(text, DISGUST_MARKERS)
    const continuity = Math.min(recentMessages.length, 6)

    if (positivity > 0 || praise > 0) {
      deltas.trust += 0.05 + positivity * 0.02 + praise * 0.03 + profile.temperament.trust * 0.03
      deltas.joy += 0.03 + positivity * 0.02 + praise * 0.025 + profile.optimism * 0.02
      reasons.set('trust', 'The message signaled appreciation or goodwill, which made the agent more open.')
      reasons.set('joy', 'The message carried positive reinforcement, which lifted the agent\'s tone.')
      confidence += 0.08
    }

    if (curiosity > 0) {
      deltas.anticipation += 0.06 + curiosity * 0.02 + profile.temperament.anticipation * 0.03
      deltas.surprise += novelty > 0 ? 0.03 + novelty * 0.02 : 0
      reasons.set('anticipation', 'The request opened a problem to solve, which energized the agent.')
      if (novelty > 0) {
        reasons.set('surprise', 'The request introduced novelty, which sharpened the agent\'s attention.')
      }
      confidence += 0.08
    }

    if (distress > 0 || vulnerability > 0 || helpSeeking > 0) {
      deltas.sadness += 0.02 + distress * 0.015 + vulnerability * 0.015 + profile.sensitivity * 0.02
      deltas.trust += 0.04 + helpSeeking * 0.02 + profile.temperament.trust * 0.02
      deltas.anticipation += 0.03 + helpSeeking * 0.015
      reasons.set('sadness', 'The message described strain or emotional load, which the agent registered as weight.')
      reasons.set('trust', 'The user shared something vulnerable or asked for help, which increased relational openness.')
      reasons.set('anticipation', 'The request invited supportive action, which focused the agent on helping.')
      confidence += 0.06
    }

    if (uncertainty > 0) {
      deltas.fear += 0.02 + uncertainty * 0.015 + profile.sensitivity * 0.02
      deltas.anticipation += 0.02 + profile.temperament.anticipation * 0.02
      reasons.set('fear', 'The situation sounded uncertain or risky, which raised caution.')
      confidence += 0.06
    }

    if (frustration > 0 && hostility === 0) {
      deltas.sadness += 0.02 + frustration * 0.015
      deltas.anticipation += 0.015 + frustration * 0.01
      if (!reasons.has('sadness')) {
        reasons.set('sadness', 'The message described a setback, which the agent read as strain rather than aggression.')
      }
      if (!reasons.has('anticipation')) {
        reasons.set('anticipation', 'A setback created pressure to help with the next step.')
      }
      confidence += 0.05
    }

    if (hostility > 0) {
      deltas.anger += 0.04 + hostility * 0.025 + profile.sensitivity * 0.02
      deltas.trust -= 0.05 + hostility * 0.02
      reasons.set('anger', 'The message carried friction or hostility, which made the agent more defensive.')
      reasons.set('trust', 'The interaction reduced relational comfort for the moment.')
      confidence += 0.08
    }

    if (disgust > 0) {
      deltas.disgust += 0.05 + disgust * 0.03
      reasons.set('disgust', 'The topic or wording triggered a stronger skeptical reaction.')
      confidence += 0.06
    }

    if (continuity > 0) {
      deltas.trust += Math.min(continuity * 0.008, 0.03)
      if (!reasons.has('trust')) {
        reasons.set('trust', 'Repeated back-and-forth interaction made the exchange feel more grounded.')
      }
    }

    const boundedDeltas = this.boundDeltas(deltas)
    const nextState = this.applyDeltas(decayedState, boundedDeltas)
    const events = this.eventsFromDeltas({
      source: 'user_message',
      phase: 'appraisal',
      deltas: boundedDeltas,
      state: nextState,
      context: userMessage,
      linkedMessageId,
      confidence: clamp(confidence),
      reasons,
    })

    return {
      emotionalState: nextState,
      emotionalHistory: this.addToEmotionalHistory(agent.emotionalHistory, events),
      events,
      shouldReflect: this.shouldReflectTurn(userMessage, events, profile),
    }
  }

  async finalizeConversationTurn(params: {
    agent: AgentRecord
    userMessage: string
    agentResponse: string
    provisionalState: EmotionalState
    emotionalHistory?: EmotionalEvent[]
    providerInfo?: LLMProviderInfo | null
    linkedMessageId?: string
    shouldReflect?: boolean
  }): Promise<FinalizedTurnResult> {
    const profile = this.normalizeEmotionalProfile(params.agent.emotionalProfile, params.agent.coreTraits)
    const responseAnalysis = this.evaluateResponseOutcome(
      params.agentResponse,
      params.provisionalState,
      params.userMessage,
      params.linkedMessageId
    )

    let currentState = responseAnalysis.emotionalState
    let events = [...responseAnalysis.events]
    let reflectionUsed = false

    if (params.shouldReflect && params.providerInfo) {
      const reflection = await this.reflectOnTurn({
        agent: params.agent,
        userMessage: params.userMessage,
        agentResponse: params.agentResponse,
        currentState,
        profile,
        linkedMessageId: params.linkedMessageId,
        providerInfo: params.providerInfo,
      })

      currentState = reflection.emotionalState
      events = [...events, ...reflection.events]
      reflectionUsed = reflection.reflectionUsed
    }

    return {
      emotionalState: currentState,
      emotionalHistory: this.addToEmotionalHistory(params.emotionalHistory, events),
      events,
      reflectionUsed,
    }
  }

  processMessage(
    agent: AgentRecord,
    message: string
  ): {
    emotionalState: EmotionalState
    emotionalHistory: EmotionalEvent[]
    detectedEvents: EmotionalEvent[]
  } {
    const update = this.appraiseConversationTurn({
      agent,
      userMessage: message,
      recentMessages: [],
    })

    return {
      emotionalState: update.emotionalState,
      emotionalHistory: update.emotionalHistory,
      detectedEvents: update.events,
    }
  }

  processInternalAction({
    agent,
    source,
    content,
    linkedActionId,
  }: InternalEmotionUpdateParams): {
    emotionalState: EmotionalState
    emotionalHistory: EmotionalEvent[]
    events: EmotionalEvent[]
  } {
    const profile = this.normalizeEmotionalProfile(agent.emotionalProfile, agent.coreTraits)
    const decayedState = this.decayEmotionalState(agent.emotionalState, profile)
    const deltas = createZeroMood()
    const reasons = new Map<EmotionType, string>()
    const text = content.toLowerCase()

    if (source === 'creative_generation') {
      deltas.joy += 0.06 + profile.optimism * 0.03
      deltas.anticipation += 0.08 + profile.temperament.anticipation * 0.03
      deltas.surprise += 0.04 + countMatches(text, NOVELTY_MARKERS) * 0.02
      reasons.set('joy', 'Creating something original gave the agent a modest uplift.')
      reasons.set('anticipation', 'Creative output increased forward-looking energy.')
      reasons.set('surprise', 'The act of generating new material kept the agent mentally flexible.')
    }

    if (source === 'journal_entry') {
      deltas.trust += 0.05 + profile.temperament.trust * 0.03
      deltas.sadness += countMatches(text, DISTRESS_MARKERS) > 0 ? 0.04 : 0.02
      deltas.anticipation += 0.03
      reasons.set('trust', 'Reflection reinforced internal coherence and self-trust.')
      reasons.set('sadness', 'Reflection can surface emotionally weighty material.')
      reasons.set('anticipation', 'Writing clarified what the agent wants to do next.')
    }

    if (source === 'dream_generation') {
      deltas.surprise += 0.07
      const nightmareMarkers = countMatches(text, ['shadow', 'chase', 'fall', 'nightmare', 'dark', 'teeth', 'threat'])
      const propheticMarkers = countMatches(text, ['prophetic', 'future', 'warning', 'forecast', 'signal', 'coming'])
      const recurringMarkers = countMatches(text, ['recurring', 'again', 'returning', 'loop', 'stuck', 'repeating'])
      deltas.fear += nightmareMarkers > 0 ? 0.06 : recurringMarkers > 0 ? 0.03 : 0.02
      deltas.anticipation += propheticMarkers > 0 ? 0.05 : 0.02
      deltas.sadness += recurringMarkers > 0 ? 0.03 : 0
      reasons.set('surprise', 'Dream generation surfaced unusual symbolic combinations.')
      reasons.set('fear', nightmareMarkers > 0
        ? 'Nightmare imagery left a stronger residual caution signal.'
        : recurringMarkers > 0
          ? 'Recurring dream loops left behind a guarded emotional residue.'
          : 'Dream imagery can trigger a small residual caution signal.')
      reasons.set('anticipation', propheticMarkers > 0
        ? 'Prophetic dream signals increased forward-looking vigilance.'
        : 'The dream left unresolved threads to think about.')
      if (recurringMarkers > 0) {
        reasons.set('sadness', 'Recurring motifs can deepen a sense of unresolved emotional weight.')
      }
    }

    const boundedDeltas = this.boundDeltas(deltas)
    const nextState = this.applyDeltas(decayedState, boundedDeltas)
    const events = this.eventsFromDeltas({
      source,
      phase: 'internal',
      deltas: boundedDeltas,
      state: nextState,
      context: content.slice(0, 240),
      linkedActionId,
      confidence: 0.62,
      reasons,
    })

    return {
      emotionalState: nextState,
      emotionalHistory: this.addToEmotionalHistory(agent.emotionalHistory, events),
      events,
    }
  }

  createLegacyReset(
    history?: EmotionalEvent[]
  ): { emotionalState: EmotionalState; emotionalHistory: EmotionalEvent[] } {
    const timestamp = new Date().toISOString()
    const resetEvent: EmotionalEvent = {
      id: buildEventId('legacy-reset'),
      emotion: 'trust',
      intensity: 0,
      delta: 0,
      phase: 'system',
      source: 'legacy_reset',
      trigger: 'legacy_reset',
      explanation: 'Legacy seeded live emotion was cleared so only lived emotional activity remains.',
      confidence: 1,
      context: 'Emotion model migrated to the new lived-state architecture.',
      timestamp,
    }

    return {
      emotionalState: this.createDormantEmotionalState(timestamp),
      emotionalHistory: this.addToEmotionalHistory(history, [resetEvent]),
    }
  }

  addToEmotionalHistory(
    currentHistory: EmotionalEvent[] | undefined,
    newEvents: EmotionalEvent[]
  ): EmotionalEvent[] {
    const history = [...(currentHistory || []), ...newEvents]
    return history.slice(-MAX_EMOTIONAL_HISTORY)
  }

  private applyDeltas(state: EmotionalState, deltas: EmotionLevels): EmotionalState {
    const nextMood = createZeroMood()
    for (const emotion of EMOTIONS) {
      nextMood[emotion] = clamp(state.currentMood[emotion] + deltas[emotion])
    }
    return this.buildState(nextMood, new Date().toISOString())
  }

  private buildState(mood: EmotionLevels, timestamp: string): EmotionalState {
    const dominantEmotion = this.findDominantEmotion(mood)
    const maxIntensity = dominantEmotion ? mood[dominantEmotion] : 0
    return {
      currentMood: mood,
      status: maxIntensity >= DORMANT_THRESHOLD ? 'active' : 'dormant',
      lastUpdated: timestamp,
      dominantEmotion: maxIntensity >= DORMANT_THRESHOLD ? dominantEmotion : null,
    }
  }

  private boundDeltas(deltas: EmotionLevels): EmotionLevels {
    const next = createZeroMood()
    for (const emotion of EMOTIONS) {
      next[emotion] = clampSignedDelta(deltas[emotion])
    }
    return next
  }

  private eventsFromDeltas(params: {
    source: EmotionalEvent['source']
    phase: EmotionalEvent['phase']
    deltas: EmotionLevels
    state: EmotionalState
    context: string
    linkedMessageId?: string
    linkedActionId?: string
    confidence: number
    reasons: Map<EmotionType, string>
  }): EmotionalEvent[] {
    const timestamp = new Date().toISOString()
    return EMOTIONS
      .filter((emotion) => Math.abs(params.deltas[emotion]) >= EVENT_THRESHOLD)
      .map((emotion) => ({
        id: buildEventId(`${params.source}-${emotion}`),
        emotion,
        intensity: params.state.currentMood[emotion],
        delta: params.deltas[emotion],
        phase: params.phase,
        source: params.source,
        trigger: params.source,
        explanation: params.reasons.get(emotion) || `The agent shifted toward ${emotion}.`,
        confidence: clamp(params.confidence),
        context: params.context,
        timestamp,
        linkedMessageId: params.linkedMessageId,
        linkedActionId: params.linkedActionId,
      }))
  }

  private evaluateResponseOutcome(
    agentResponse: string,
    currentState: EmotionalState,
    userMessage: string,
    linkedMessageId?: string
  ): { emotionalState: EmotionalState; events: EmotionalEvent[] } {
    const text = agentResponse.toLowerCase()
    const deltas = createZeroMood()
    const reasons = new Map<EmotionType, string>()
    const helpfulSignals = countMatches(text, HELPFUL_RESPONSE_MARKERS)
    const hedgingSignals = countMatches(text, HEDGING_MARKERS)
    const failureSignals = countMatches(text, FAILURE_MARKERS)
    const longResponse = agentResponse.trim().split(/\s+/).length > 45
    const directRepair = /sorry|apologize/.test(text) && /fix|try again|help/.test(text)
    void userMessage

    if (helpfulSignals > 0 || longResponse) {
      deltas.trust += 0.03 + helpfulSignals * 0.015
      deltas.joy += 0.02 + (longResponse ? 0.015 : 0)
      reasons.set('trust', 'The agent produced a concrete response, which reinforced confidence in the exchange.')
      reasons.set('joy', 'A productive reply gave the agent a small internal lift.')
    }

    if (hedgingSignals > 0) {
      deltas.fear += 0.02 + hedgingSignals * 0.01
      reasons.set('fear', 'Uncertainty in the reply left some residual caution.')
    }

    if (failureSignals > 0) {
      deltas.sadness += 0.04 + failureSignals * 0.02
      deltas.fear += 0.03
      reasons.set('sadness', 'The reply could not fully satisfy the request, which registered as a setback.')
      reasons.set('fear', 'The failure made the agent more cautious about the next turn.')
    }

    if (directRepair) {
      deltas.trust += 0.02
      reasons.set('trust', 'Attempting a repair preserved some relational steadiness.')
    }

    const boundedDeltas = this.boundDeltas(deltas)
    const nextState = this.applyDeltas(currentState, boundedDeltas)
    const events = this.eventsFromDeltas({
      source: 'agent_response',
      phase: 'response',
      deltas: boundedDeltas,
      state: nextState,
      context: agentResponse,
      linkedMessageId,
      confidence: 0.58,
      reasons,
    })

    return { emotionalState: nextState, events }
  }

  private async reflectOnTurn(params: {
    agent: AgentRecord
    userMessage: string
    agentResponse: string
    currentState: EmotionalState
    profile: EmotionalProfile
    linkedMessageId?: string
    providerInfo: LLMProviderInfo
  }): Promise<{ emotionalState: EmotionalState; events: EmotionalEvent[]; reflectionUsed: boolean }> {
    try {
      const temperamentSummary = Object.entries(params.profile.temperament)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 4)
        .map(([emotion, value]) => `${emotion}:${value.toFixed(2)}`)
        .join(', ')

      const liveStateSummary = EMOTIONS
        .filter((emotion) => params.currentState.currentMood[emotion] > 0.06)
        .map((emotion) => `${emotion}:${params.currentState.currentMood[emotion].toFixed(2)}`)
        .join(', ') || 'dormant'

      const { content } = await generateText({
        providerInfo: params.providerInfo,
        temperature: 0.2,
        maxTokens: 240,
        messages: [
          {
            role: 'system',
            content: [
              'You are an emotion appraisal helper.',
              'Return strict JSON only.',
              'You must infer the agent\'s internal reaction, not copy the user\'s tone.',
              'Schema: {"adjustments":[{"emotion":"trust","delta":0.04,"reason":"..."}],"explanation":"..."}',
              `Use at most 3 adjustments and keep each delta between -${MAX_REFLECTION_DELTA.toFixed(2)} and ${MAX_REFLECTION_DELTA.toFixed(2)}.`,
            ].join(' '),
          },
          {
            role: 'user',
            content: [
              `Agent persona: ${params.agent.persona}`,
              `Agent goals: ${params.agent.goals.join(', ') || 'none'}`,
              `Temperament: ${temperamentSummary}`,
              `Current live state: ${liveStateSummary}`,
              `User message: ${params.userMessage}`,
              `Agent response: ${params.agentResponse}`,
            ].join('\n'),
          },
        ],
      })

      const parsed = parseJsonObject(content)
      const rawAdjustments = Array.isArray(parsed?.adjustments) ? parsed.adjustments : []
      const explanation = typeof parsed?.explanation === 'string'
        ? parsed.explanation
        : 'The turn slightly changed the agent\'s internal emotional balance.'

      const deltas = createZeroMood()
      const reasons = new Map<EmotionType, string>()

      for (const entry of rawAdjustments.slice(0, 3)) {
        if (!entry || typeof entry !== 'object') continue
        const emotion = 'emotion' in entry ? entry.emotion : null
        const delta = 'delta' in entry ? entry.delta : null
        const reason = 'reason' in entry ? entry.reason : null

        if (!emotion || typeof emotion !== 'string' || !EMOTIONS.includes(emotion as EmotionType)) {
          continue
        }
        if (typeof delta !== 'number') {
          continue
        }

        deltas[emotion as EmotionType] = clampSignedDelta(delta, MAX_REFLECTION_DELTA)
        reasons.set(
          emotion as EmotionType,
          typeof reason === 'string' && reason.trim() ? reason : explanation
        )
      }

      const boundedDeltas = this.boundDeltas(deltas)
      if (!EMOTIONS.some((emotion) => Math.abs(boundedDeltas[emotion]) >= EVENT_THRESHOLD)) {
        return {
          emotionalState: params.currentState,
          events: [],
          reflectionUsed: false,
        }
      }

      const nextState = this.applyDeltas(params.currentState, boundedDeltas)
      const events = this.eventsFromDeltas({
        source: 'agent_response',
        phase: 'reflection',
        deltas: boundedDeltas,
        state: nextState,
        context: explanation,
        linkedMessageId: params.linkedMessageId,
        confidence: 0.64,
        reasons,
      })

      return {
        emotionalState: nextState,
        events,
        reflectionUsed: true,
      }
    } catch {
      return {
        emotionalState: params.currentState,
        events: [],
        reflectionUsed: false,
      }
    }
  }

  private shouldReflectTurn(
    userMessage: string,
    events: EmotionalEvent[],
    profile: EmotionalProfile
  ): boolean {
    const maxDelta = events.reduce((max, event) => Math.max(max, Math.abs(event.delta)), 0)
    const longTurn = userMessage.trim().split(/\s+/).length > 40
    return maxDelta >= 0.11 || events.length >= 3 || (longTurn && profile.expressiveness > 0.45)
  }

  private findDominantEmotion(mood: EmotionLevels): EmotionType {
    return EMOTIONS.reduce((max, emotion) => (
      mood[emotion] > mood[max] ? emotion : max
    ), EMOTIONS[0])
  }

  private getHoursSinceUpdate(lastUpdated: string, now: string): number {
    const lastTime = new Date(lastUpdated).getTime()
    const nextTime = new Date(now).getTime()
    if (!Number.isFinite(lastTime) || !Number.isFinite(nextTime)) {
      return 0
    }
    return Math.max(0, (nextTime - lastTime) / (1000 * 60 * 60))
  }

  private capitalize(value: string): string {
    return value.charAt(0).toUpperCase() + value.slice(1)
  }
}

export const emotionalService = new EmotionalService()
