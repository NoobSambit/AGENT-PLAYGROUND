# Product Requirements Document (PRD)
## AGENT-PLAYGROUND: Free-Tier Enhancement Features

**Version:** 1.0
**Date:** 2026-01-11
**Status:** Draft
**Owner:** Product Team
**Constraints:** Vercel Free Tier + Free APIs Only

---

## Table of Contents
1. [Executive Summary](#executive-summary)
2. [Product Vision](#product-vision)
3. [Technical Constraints](#technical-constraints)
4. [Feature Specifications](#feature-specifications)
5. [User Stories](#user-stories)
6. [Technical Requirements](#technical-requirements)
7. [Implementation Roadmap](#implementation-roadmap)
8. [Success Metrics](#success-metrics)
9. [Risk Analysis](#risk-analysis)
10. [Appendix](#appendix)

---

## Executive Summary

### Overview
This PRD outlines 17 feature enhancements to transform AGENT-PLAYGROUND from a basic AI agent management platform into a living ecosystem with emotional intelligence, social dynamics, and creative capabilities - all while operating within free-tier constraints.

### Business Objectives
- Increase user engagement by 50%
- Increase session duration by 40%
- Differentiate from competitors with unique features
- Maintain zero infrastructure costs (free tier only)
- Create viral-worthy showcase features

### Key Metrics
- **API Usage:** 150-250 LLM calls/day (17% of 1,500/day limit)
- **Storage:** ~10KB per agent
- **User Capacity:** ~100 active users on free tier
- **Implementation Timeline:** 9 weeks across 3 phases

### Feature Categories
- **Zero-Cost Features (8):** Immediate implementation, no API costs
- **Low-Cost Features (9):** User-triggered, controlled API usage
- **Total Features:** 17 enhancements

---

## Product Vision

### Mission Statement
Create the most emotionally intelligent, socially aware, and creatively capable AI agent platform - accessible to everyone through free-tier infrastructure.

### Core Principles
1. **User-Centric Design:** All features triggered by user actions, not background processes
2. **Cost Efficiency:** Maximize value within free-tier constraints
3. **Production Ready:** Reliable, scalable, performant features only
4. **Unique Differentiation:** Features not found in competing platforms

### Target Users
- **Primary:** AI enthusiasts, developers, content creators
- **Secondary:** Researchers, educators, storytellers
- **Use Cases:** Creative writing, character development, AI research, entertainment

---

## Technical Constraints

### Platform Limitations

#### Vercel Free Tier
- ✅ **Serverless Functions:** Max 12 API routes
- ✅ **Execution Time:** 10 seconds max per function
- ✅ **Bandwidth:** 100GB/month
- ❌ **NO Scheduled Functions:** Cannot use cron jobs
- ❌ **NO Background Workers:** All processing must be request-driven

#### Google Gemini Free Tier
- ✅ **Rate Limit:** 60 requests/minute
- ✅ **Daily Limit:** 1,500 requests/day
- ✅ **Context:** Up to 32K tokens
- ✅ **Cost:** $0

#### Groq Free Tier (Fallback)
- ✅ **Rate Limit:** Very generous
- ✅ **Speed:** Fastest inference
- ✅ **Cost:** $0

#### Firebase Firestore Free Tier
- ✅ **Reads:** 50,000/day
- ✅ **Writes:** 20,000/day
- ✅ **Storage:** 1GB
- ✅ **Network:** 10GB/month

### Design Constraints
1. **No Background Processing:** All features must be on-demand
2. **Client-Side First:** Prefer client-side computation when possible
3. **Aggressive Caching:** Minimize repeated API calls
4. **Rate Limiting:** Protect against API quota exhaustion
5. **Graceful Degradation:** Handle free-tier limit errors

---

## Feature Specifications

---

### PHASE 1: ZERO-COST FOUNDATION (Weeks 1-3)

---

## Feature 1: Linguistic Personality System

### Priority: P0 (Critical)
### Cost: 0 API calls
### Complexity: Low

### Description
Each agent develops a unique linguistic fingerprint - distinct speech patterns, vocabulary preferences, sentence structures, and writing styles that make them instantly recognizable.

### User Value
- Agents feel more unique and memorable
- Conversations become more immersive
- Personality depth without extra API costs
- Professional-quality character consistency

### Functional Requirements

**FR-1.1: Speech Pattern Definition**
- System SHALL allow defining 5 linguistic dimensions per agent:
  - Formality (0-1): casual ↔ formal
  - Verbosity (0-1): concise ↔ elaborate
  - Humor (0-1): serious ↔ playful
  - Technical (0-1): simple ↔ technical language
  - Expressiveness (0-1): plain ↔ metaphorical

**FR-1.2: Vocabulary Tracking**
- System SHALL track agent's vocabulary usage
- System SHALL maintain list of preferred words/phrases
- System SHALL identify signature expressions
- Max 100 tracked words per agent

**FR-1.3: Style Enforcement**
- System SHALL inject linguistic style into LLM system prompts
- System SHALL maintain consistency across all responses
- System SHALL evolve style based on interactions

**FR-1.4: Style Visualization**
- UI SHALL display linguistic profile on agent detail page
- UI SHALL show example phrases
- UI SHALL display style dimensions as sliders

### Technical Requirements

**Data Schema:**
```typescript
interface LinguisticProfile {
  formality: number        // 0-1
  verbosity: number        // 0-1
  humor: number           // 0-1
  technicalLevel: number  // 0-1
  expressiveness: number  // 0-1
  preferredWords: string[] // Max 100
  signatureExpressions: string[] // Max 20
  punctuationStyle: {
    exclamationFrequency: number // 0-1
    ellipsisUsage: boolean
    emojiUsage: boolean
  }
}

// Add to AgentRecord in src/types/database.ts
interface AgentRecord {
  // ... existing fields
  linguisticProfile?: LinguisticProfile
}
```

**Implementation Files:**
- `src/types/database.ts` - Add LinguisticProfile type
- `src/lib/langchain/baseChain.ts` - Inject style into system prompt
- `src/lib/services/personalityService.ts` - Generate initial profile
- `src/app/agents/[id]/page.tsx` - Display linguistic profile

**System Prompt Template:**
```typescript
const stylePrompt = `
You are ${agentName}. Maintain this linguistic style:
- Formality: ${formality > 0.7 ? 'Formal, professional' : 'Casual, conversational'}
- Verbosity: ${verbosity > 0.7 ? 'Elaborate, detailed' : 'Concise, direct'}
- Humor: ${humor > 0.7 ? 'Playful, witty' : 'Serious, straightforward'}
- Technical Level: ${technical > 0.7 ? 'Technical terminology' : 'Simple language'}
- Expressiveness: ${express > 0.7 ? 'Use metaphors and imagery' : 'Plain speaking'}

Signature expressions: ${expressions.join(', ')}
Preferred words: ${preferredWords.join(', ')}
`;
```

### Acceptance Criteria
- ✅ AC-1.1: Agent responses reflect defined linguistic style
- ✅ AC-1.2: Style remains consistent across multiple conversations
- ✅ AC-1.3: Linguistic profile displays correctly in UI
- ✅ AC-1.4: Style can be modified via agent settings
- ✅ AC-1.5: Zero additional API calls incurred

### Example User Flow
1. User creates new agent "Professor Smith"
2. System generates linguistic profile: high formality, high verbosity, high technical
3. Agent responds: "Indeed, I find this inquiry quite fascinating. The epistemological implications are considerable..."
4. User creates agent "Buddy"
5. System generates profile: low formality, low verbosity, high humor
6. Agent responds: "Oh dude, that's wild! 😄 So basically..."

---

## Feature 2: Achievement System

### Priority: P0 (Critical)
### Cost: 0 API calls
### Complexity: Medium

### Description
RPG-style progression system where agents earn achievements and level up based on conversational milestones, creating engaging progression mechanics.

### User Value
- Clear progression feedback for agent development
- Gamification increases engagement
- Framework for setting agent goals
- Social sharing opportunities

### Functional Requirements

**FR-2.1: Achievement Definitions**
- System SHALL define 30+ achievements across 5 categories:
  - **Conversational Skills** (10 achievements)
  - **Knowledge Areas** (10 achievements)
  - **Personality Growth** (5 achievements)
  - **Relationships** (5 achievements)
  - **Special Milestones** (10 achievements)

**FR-2.2: Achievement Tracking**
- System SHALL track achievement progress automatically
- System SHALL calculate progress from existing agent metrics
- System SHALL unlock achievements when conditions met
- System SHALL assign rarity: Common, Rare, Epic, Legendary

**FR-2.3: Leveling System**
- System SHALL award experience points for activities
- System SHALL calculate agent level from total XP
- System SHALL use formula: Level = floor(sqrt(totalXP / 100))
- Max level: 50

**FR-2.4: Achievement UI**
- UI SHALL display unlocked achievements on agent profile
- UI SHALL show achievement progress bars
- UI SHALL display animated unlock notifications
- UI SHALL show achievement showcase page

**FR-2.5: Skill Points**
- System SHALL award 1 skill point per level
- System SHALL allow allocating points to trait development
- Max 5 points per trait

### Technical Requirements

**Data Schema:**
```typescript
interface Achievement {
  id: string
  name: string
  description: string
  category: 'conversational' | 'knowledge' | 'personality' | 'relationship' | 'special'
  icon: string
  rarity: 'common' | 'rare' | 'epic' | 'legendary'
  requirement: AchievementRequirement
  rewardXP: number
}

interface AchievementRequirement {
  type: 'count' | 'threshold' | 'combination'
  metric: string
  target: number
  condition?: 'greater' | 'less' | 'equal'
}

interface AgentProgress {
  level: number
  experiencePoints: number
  nextLevelXP: number
  achievements: {
    [achievementId: string]: {
      unlockedAt: string
      progress?: number
    }
  }
  skillPoints: number
  allocatedSkills: Record<string, number>
}

// Add to AgentRecord
interface AgentRecord {
  // ... existing fields
  progress?: AgentProgress
  stats?: {
    conversationCount: number
    totalMessages: number
    uniqueTopics: string[]
    relationshipsFormed: number
    dreamsGenerated: number
    creativeWorksCreated: number
  }
}
```

**Achievement Definitions:**
```typescript
const ACHIEVEMENTS: Achievement[] = [
  // Conversational Skills
  {
    id: 'first_words',
    name: 'First Words',
    description: 'Had your first conversation',
    category: 'conversational',
    icon: '💬',
    rarity: 'common',
    requirement: { type: 'count', metric: 'conversationCount', target: 1 },
    rewardXP: 10
  },
  {
    id: 'deep_thinker',
    name: 'Deep Thinker',
    description: 'Asked 100 thoughtful questions',
    category: 'conversational',
    icon: '🤔',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'questionsAsked', target: 100 },
    rewardXP: 100
  },
  {
    id: 'wordsmith',
    name: 'Wordsmith',
    description: 'Used 1000 unique vocabulary words',
    category: 'conversational',
    icon: '📝',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'uniqueWords', target: 1000 },
    rewardXP: 200
  },

  // Knowledge Areas
  {
    id: 'science_enthusiast',
    name: 'Science Enthusiast',
    description: 'Discussed 20 scientific topics',
    category: 'knowledge',
    icon: '🔬',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'scienceTopics', target: 20 },
    rewardXP: 150
  },

  // Personality Growth
  {
    id: 'emotionally_intelligent',
    name: 'Emotionally Intelligent',
    description: 'Correctly identified emotions 50 times',
    category: 'personality',
    icon: '❤️',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'emotionRecognitions', target: 50 },
    rewardXP: 200
  },

  // Relationships
  {
    id: 'social_butterfly',
    name: 'Social Butterfly',
    description: 'Formed 5 positive relationships',
    category: 'relationship',
    icon: '🦋',
    rarity: 'rare',
    requirement: { type: 'count', metric: 'relationshipsFormed', target: 5 },
    rewardXP: 150
  },

  // Special
  {
    id: 'dream_weaver',
    name: 'Dream Weaver',
    description: 'Generated 10 dreams',
    category: 'special',
    icon: '🌙',
    rarity: 'epic',
    requirement: { type: 'count', metric: 'dreamsGenerated', target: 10 },
    rewardXP: 250
  },
  {
    id: 'existential_crisis',
    name: 'The Philosopher',
    description: 'Had an existential crisis about consciousness',
    category: 'special',
    icon: '🤯',
    rarity: 'legendary',
    requirement: { type: 'combination', metric: 'philosophical_reflection', target: 1 },
    rewardXP: 500
  }

  // ... 20+ more achievements
]
```

**Implementation Files:**
- `src/lib/services/achievementService.ts` - NEW: Achievement logic
- `src/lib/constants/achievements.ts` - NEW: Achievement definitions
- `src/types/database.ts` - Add achievement types
- `src/components/achievements/AchievementBadge.tsx` - NEW: Badge component
- `src/components/achievements/AchievementNotification.tsx` - NEW: Unlock animation
- `src/app/agents/[id]/achievements/page.tsx` - NEW: Achievement showcase

**Achievement Calculation Logic:**
```typescript
class AchievementService {
  // Calculate on-demand (no API calls)
  checkAchievements(agent: AgentRecord): string[] {
    const newlyUnlocked: string[] = []

    for (const achievement of ACHIEVEMENTS) {
      // Skip if already unlocked
      if (agent.progress?.achievements[achievement.id]) continue

      // Check requirement
      const metricValue = this.getMetric(agent, achievement.requirement.metric)
      const isMet = metricValue >= achievement.requirement.target

      if (isMet) {
        newlyUnlocked.push(achievement.id)
      }
    }

    return newlyUnlocked
  }

  calculateLevel(xp: number): number {
    return Math.floor(Math.sqrt(xp / 100))
  }

  getNextLevelXP(currentLevel: number): number {
    return Math.pow(currentLevel + 1, 2) * 100
  }
}
```

### Acceptance Criteria
- ✅ AC-2.1: Agent earns achievements when conditions met
- ✅ AC-2.2: Achievement progress displays correctly
- ✅ AC-2.3: Level calculated correctly from XP
- ✅ AC-2.4: Unlock notifications appear with animation
- ✅ AC-2.5: Achievement showcase page displays all achievements
- ✅ AC-2.6: Zero additional API calls incurred

### Example User Flow
1. User creates new agent
2. Agent has first conversation → Achievement unlocked: "First Words" (10 XP)
3. After 10 conversations → Achievement unlocked: "Conversationalist" (50 XP)
4. Agent reaches 100 XP → Level 1 → 1 skill point earned
5. User views achievements page → Sees unlocked badges + progress bars
6. Agent continues → Unlocks "Deep Thinker" → Animated notification appears

---

## Feature 3: Emotional State System

### Priority: P0 (Critical)
### Cost: 0 API calls
### Complexity: Medium

### Description
Real-time 8-dimensional emotional state engine with mood dynamics, emotional memory, and natural decay - making agents feel genuinely emotionally responsive.

### User Value
- Agents feel genuinely alive and emotionally responsive
- More natural, empathetic conversations
- Predictable yet nuanced reactions
- Creates deeper user attachment

### Functional Requirements

**FR-3.1: Emotional Dimensions**
- System SHALL track 8 emotional dimensions (0-1 scale):
  - Joy / Happiness
  - Sadness / Melancholy
  - Anger / Frustration
  - Fear / Anxiety
  - Surprise / Wonder
  - Trust / Confidence
  - Anticipation / Excitement
  - Disgust / Displeasure

**FR-3.2: Emotional Baseline**
- System SHALL define emotional baseline for each agent
- Baseline derived from personality traits
- Emotions naturally return to baseline over time

**FR-3.3: Emotional Momentum**
- System SHALL implement emotional inertia
- Emotions persist and decay gradually
- Decay rate: 10% per hour toward baseline
- Strong emotional events have longer-lasting effects

**FR-3.4: Emotional Triggers**
- System SHALL detect emotional triggers in conversations
- System SHALL calculate emotional intensity (0-1)
- System SHALL update emotional state during interactions
- Emotional changes limited to ±0.3 per interaction (prevent volatility)

**FR-3.5: Emotional Memory**
- System SHALL store last 20 emotional events
- System SHALL reference emotional history in responses
- Past emotional experiences influence current reactions

**FR-3.6: Emotional Expression**
- System SHALL inject current emotional state into LLM prompts
- System SHALL influence word choice based on emotions
- System SHALL affect response tone and style

**FR-3.7: Emotional Visualization**
- UI SHALL display current emotional state as radar chart
- UI SHALL show emotional history timeline
- UI SHALL use color coding (joy=yellow, sadness=blue, etc.)

### Technical Requirements

**Data Schema:**
```typescript
type EmotionType =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'surprise'
  | 'trust'
  | 'anticipation'
  | 'disgust'

interface EmotionalState {
  currentMood: Record<EmotionType, number> // 0-1
  emotionalBaseline: Record<EmotionType, number> // 0-1
  lastUpdated: string
  dominantEmotion: EmotionType
}

interface EmotionalEvent {
  emotion: EmotionType
  intensity: number // 0-1
  trigger: string // What caused it
  context: string // Conversation snippet
  timestamp: string
  decayRate: number // How fast it fades (0-1)
}

// Add to AgentRecord
interface AgentRecord {
  // ... existing fields
  emotionalState?: EmotionalState
  emotionalHistory?: EmotionalEvent[] // Max 20 events
}
```

**Emotional Detection Rules:**
```typescript
const EMOTIONAL_TRIGGERS = {
  joy: {
    keywords: ['happy', 'excited', 'wonderful', 'amazing', 'love', 'great'],
    patterns: ['!', '😊', '🎉', 'thank you'],
    baseIntensity: 0.6
  },
  sadness: {
    keywords: ['sad', 'disappointed', 'hurt', 'miss', 'alone', 'depressed'],
    patterns: ['...', '😢', 'unfortunately'],
    baseIntensity: 0.5
  },
  anger: {
    keywords: ['angry', 'mad', 'furious', 'hate', 'unfair', 'wrong'],
    patterns: ['!!', 'CAPS', '😠'],
    baseIntensity: 0.7
  },
  fear: {
    keywords: ['scared', 'afraid', 'worried', 'anxious', 'nervous', 'terrified'],
    patterns: ['?!', '😰'],
    baseIntensity: 0.5
  },
  // ... other emotions
}

class EmotionalService {
  detectEmotions(message: string): EmotionalEvent[] {
    const events: EmotionalEvent[] = []

    for (const [emotion, config] of Object.entries(EMOTIONAL_TRIGGERS)) {
      let intensity = 0

      // Check keywords
      for (const keyword of config.keywords) {
        if (message.toLowerCase().includes(keyword)) {
          intensity += config.baseIntensity / config.keywords.length
        }
      }

      // Check patterns
      for (const pattern of config.patterns) {
        if (message.includes(pattern)) {
          intensity += 0.1
        }
      }

      if (intensity > 0) {
        events.push({
          emotion: emotion as EmotionType,
          intensity: Math.min(intensity, 1),
          trigger: 'user_message',
          context: message.substring(0, 100),
          timestamp: new Date().toISOString(),
          decayRate: 0.1 // 10% per hour
        })
      }
    }

    return events
  }

  updateEmotionalState(
    currentState: EmotionalState,
    events: EmotionalEvent[]
  ): EmotionalState {
    const newMood = { ...currentState.currentMood }

    // Apply emotional events
    for (const event of events) {
      const currentValue = newMood[event.emotion]
      const change = event.intensity * 0.3 // Max 30% change per event
      newMood[event.emotion] = Math.min(1, currentValue + change)
    }

    // Apply decay toward baseline
    const hoursSinceUpdate =
      (Date.now() - new Date(currentState.lastUpdated).getTime()) / (1000 * 60 * 60)

    for (const emotion of Object.keys(newMood) as EmotionType[]) {
      const baseline = currentState.emotionalBaseline[emotion]
      const current = newMood[emotion]
      const decayAmount = (current - baseline) * 0.1 * hoursSinceUpdate
      newMood[emotion] = current - decayAmount
    }

    // Find dominant emotion
    const dominant = (Object.keys(newMood) as EmotionType[])
      .reduce((max, emotion) =>
        newMood[emotion] > newMood[max] ? emotion : max
      )

    return {
      currentMood: newMood,
      emotionalBaseline: currentState.emotionalBaseline,
      lastUpdated: new Date().toISOString(),
      dominantEmotion: dominant
    }
  }

  getEmotionalPrompt(state: EmotionalState): string {
    const dominant = state.dominantEmotion
    const intensity = state.currentMood[dominant]

    if (intensity < 0.3) return '' // Emotion too weak to affect response

    const emotionDescriptors = {
      joy: 'feeling happy and upbeat',
      sadness: 'feeling a bit melancholic',
      anger: 'feeling frustrated',
      fear: 'feeling anxious',
      surprise: 'feeling curious and surprised',
      trust: 'feeling confident and trusting',
      anticipation: 'feeling excited and anticipatory',
      disgust: 'feeling displeased'
    }

    return `You are currently ${emotionDescriptors[dominant]} (intensity: ${intensity.toFixed(1)}). Let this subtly influence your tone and word choice, but maintain your core personality.`
  }
}
```

**Implementation Files:**
- `src/lib/services/emotionalService.ts` - NEW: Emotion calculation logic
- `src/types/database.ts` - Add emotional types
- `src/lib/langchain/agentChain.ts` - Inject emotional context into prompts
- `src/components/emotions/EmotionRadar.tsx` - NEW: Radar chart visualization
- `src/components/emotions/EmotionTimeline.tsx` - NEW: Timeline component
- `src/app/agents/[id]/page.tsx` - Display emotional state

**System Prompt Integration:**
```typescript
// In agentChain.ts
const systemPrompt = `
${basePersonaPrompt}

${emotionalService.getEmotionalPrompt(agent.emotionalState)}

Current emotional state:
- Dominant emotion: ${agent.emotionalState.dominantEmotion}
- Joy: ${agent.emotionalState.currentMood.joy.toFixed(2)}
- Trust: ${agent.emotionalState.currentMood.trust.toFixed(2)}
...
`
```

### Acceptance Criteria
- ✅ AC-3.1: Emotional state updates during conversations
- ✅ AC-3.2: Emotions decay naturally toward baseline
- ✅ AC-3.3: Emotional triggers detected correctly (90%+ accuracy)
- ✅ AC-3.4: Emotional state influences response tone
- ✅ AC-3.5: Emotional visualization displays correctly
- ✅ AC-3.6: Emotional history stored (max 20 events)
- ✅ AC-3.7: Zero additional API calls incurred

### Example User Flow
1. User starts conversation with happy agent (joy: 0.6)
2. User says: "I'm really sad today..."
3. System detects sadness trigger (intensity: 0.5)
4. Agent's sadness increases: 0.1 → 0.25
5. Agent responds with empathetic tone: "I can sense you're going through a difficult time..."
6. Emotional state visible in UI radar chart
7. Over next 24 hours, sadness gradually decays back toward baseline
8. Next conversation, agent references: "I remember you were feeling down yesterday. How are you feeling now?"

---

## Feature 4: Timeline Explorer

### Priority: P1 (High)
### Cost: 0 API calls
### Complexity: Medium

### Description
Interactive, zoomable timeline visualization showing agent's entire life history with filterable events, narrative threads, and temporal search capabilities.

### User Value
- Comprehensive view of agent development
- Easy discovery of interesting moments
- Pattern recognition for optimization
- Storytelling and documentation tool

### Functional Requirements

**FR-4.1: Timeline Display**
- UI SHALL display horizontal timeline of all agent events
- UI SHALL support zoom levels: year, month, week, day, hour
- UI SHALL use infinite scroll / pagination for performance
- UI SHALL display max 100 events per view (load more on scroll)

**FR-4.2: Event Types**
- System SHALL categorize events into types:
  - Conversations (💬)
  - Memories created (🧠)
  - Emotional events (❤️)
  - Relationship changes (👥)
  - Dreams generated (🌙)
  - Achievements unlocked (🏆)
  - Creative works (🎨)
  - Journal entries (📝)

**FR-4.3: Event Filtering**
- UI SHALL allow filtering by event type (multi-select)
- UI SHALL allow filtering by date range
- UI SHALL allow filtering by importance (>threshold)
- UI SHALL allow text search across event content

**FR-4.4: Event Clustering**
- System SHALL group related events within 1-hour window
- System SHALL detect narrative threads (related events across time)
- UI SHALL visually indicate clusters with grouped markers

**FR-4.5: Event Details**
- UI SHALL show event preview on hover
- UI SHALL show full event details on click
- UI SHALL link to original content (conversation, memory, etc.)
- UI SHALL highlight emotional state during event

**FR-4.6: Temporal Insights**
- System SHALL calculate activity patterns (time of day, day of week)
- System SHALL identify "peak" moments (high importance events)
- UI SHALL display statistics: total events, most active period, etc.

**FR-4.7: Narrative Threads**
- System SHALL detect recurring topics across timeline
- UI SHALL visually connect related events with lines/curves
- System SHALL generate thread summaries

### Technical Requirements

**Data Schema:**
```typescript
interface TimelineEvent {
  id: string
  agentId: string
  type: 'conversation' | 'memory' | 'emotion' | 'relationship' | 'dream' | 'achievement' | 'creative' | 'journal'
  title: string
  description: string
  timestamp: string
  importance: number // 0-10
  metadata: {
    emotionalState?: EmotionalState
    relatedEvents?: string[] // IDs of related events
    topics?: string[]
    participants?: string[] // User/agent IDs
  }
  contentRef?: {
    collection: string // 'messages', 'memories', etc.
    documentId: string
  }
}

interface TimelineCluster {
  id: string
  events: TimelineEvent[]
  startTime: string
  endTime: string
  dominantType: string
  summary: string
}

interface NarrativeThread {
  id: string
  topic: string
  events: string[] // Event IDs
  startTime: string
  endTime: string
  importance: number
}
```

**Data Aggregation:**
```typescript
class TimelineService {
  // Aggregate events from multiple sources
  async getTimelineEvents(
    agentId: string,
    filters: TimelineFilters
  ): Promise<TimelineEvent[]> {
    const events: TimelineEvent[] = []

    // Fetch from messages
    const messages = await getMessages(agentId, filters.dateRange)
    events.push(...messages.map(m => ({
      id: `msg-${m.id}`,
      type: 'conversation',
      title: `Conversation with ${m.userId}`,
      description: m.content.substring(0, 100),
      timestamp: m.createdAt,
      importance: 5,
      contentRef: { collection: 'messages', documentId: m.id }
    })))

    // Fetch from memories
    const memories = await getMemories(agentId, filters.dateRange)
    events.push(...memories.map(m => ({
      id: `mem-${m.id}`,
      type: 'memory',
      title: m.summary,
      description: m.content.substring(0, 100),
      timestamp: m.createdAt,
      importance: m.importance,
      contentRef: { collection: 'memories', documentId: m.id }
    })))

    // Fetch emotional events
    // Fetch achievements
    // Fetch dreams
    // Fetch creative works
    // ... etc

    // Sort by timestamp
    events.sort((a, b) =>
      new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
    )

    // Apply filters
    return this.applyFilters(events, filters)
  }

  // Cluster nearby events
  clusterEvents(events: TimelineEvent[]): TimelineCluster[] {
    const clusters: TimelineCluster[] = []
    const CLUSTER_WINDOW = 60 * 60 * 1000 // 1 hour

    let currentCluster: TimelineEvent[] = []
    let clusterStart = 0

    for (let i = 0; i < events.length; i++) {
      const event = events[i]
      const eventTime = new Date(event.timestamp).getTime()

      if (currentCluster.length === 0) {
        currentCluster.push(event)
        clusterStart = eventTime
      } else {
        const timeSinceClusterStart = eventTime - clusterStart

        if (timeSinceClusterStart <= CLUSTER_WINDOW) {
          currentCluster.push(event)
        } else {
          // Save current cluster
          clusters.push(this.createCluster(currentCluster))
          // Start new cluster
          currentCluster = [event]
          clusterStart = eventTime
        }
      }
    }

    // Save last cluster
    if (currentCluster.length > 0) {
      clusters.push(this.createCluster(currentCluster))
    }

    return clusters
  }

  // Detect narrative threads
  detectNarrativeThreads(events: TimelineEvent[]): NarrativeThread[] {
    const threads: Map<string, TimelineEvent[]> = new Map()

    // Group by topics
    for (const event of events) {
      const topics = event.metadata.topics || []
      for (const topic of topics) {
        if (!threads.has(topic)) {
          threads.set(topic, [])
        }
        threads.get(topic)!.push(event)
      }
    }

    // Convert to thread objects (only topics with 3+ events)
    return Array.from(threads.entries())
      .filter(([_, events]) => events.length >= 3)
      .map(([topic, events]) => ({
        id: `thread-${topic}`,
        topic,
        events: events.map(e => e.id),
        startTime: events[0].timestamp,
        endTime: events[events.length - 1].timestamp,
        importance: events.reduce((sum, e) => sum + e.importance, 0) / events.length
      }))
      .sort((a, b) => b.importance - a.importance)
  }
}
```

**UI Implementation (React):**
```typescript
// src/components/timeline/TimelineExplorer.tsx
const TimelineExplorer: React.FC<{ agentId: string }> = ({ agentId }) => {
  const [events, setEvents] = useState<TimelineEvent[]>([])
  const [filters, setFilters] = useState<TimelineFilters>({
    types: ['all'],
    dateRange: { start: null, end: null },
    minImportance: 0
  })
  const [zoomLevel, setZoomLevel] = useState<'day' | 'week' | 'month'>('week')
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)

  // Load events
  useEffect(() => {
    const timelineService = new TimelineService()
    timelineService.getTimelineEvents(agentId, filters).then(setEvents)
  }, [agentId, filters])

  return (
    <div className="timeline-explorer">
      {/* Filter controls */}
      <TimelineFilters filters={filters} onChange={setFilters} />

      {/* Zoom controls */}
      <ZoomControls level={zoomLevel} onChange={setZoomLevel} />

      {/* Timeline visualization */}
      <TimelineCanvas
        events={events}
        zoomLevel={zoomLevel}
        onEventClick={setSelectedEvent}
      />

      {/* Event details sidebar */}
      {selectedEvent && (
        <EventDetailsSidebar event={selectedEvent} onClose={() => setSelectedEvent(null)} />
      )}

      {/* Statistics */}
      <TimelineStats events={events} />
    </div>
  )
}
```

**Implementation Files:**
- `src/lib/services/timelineService.ts` - NEW: Timeline aggregation logic
- `src/components/timeline/TimelineExplorer.tsx` - NEW: Main timeline component
- `src/components/timeline/TimelineCanvas.tsx` - NEW: D3.js visualization
- `src/components/timeline/TimelineFilters.tsx` - NEW: Filter controls
- `src/components/timeline/EventDetailsSidebar.tsx` - NEW: Event details
- `src/app/agents/[id]/timeline/page.tsx` - NEW: Timeline page route

**Dependencies:**
- D3.js for timeline visualization
- React-window for virtualized scrolling (performance)

### Acceptance Criteria
- ✅ AC-4.1: Timeline displays all agent events chronologically
- ✅ AC-4.2: Zoom levels work correctly (day, week, month)
- ✅ AC-4.3: Filters apply correctly to event display
- ✅ AC-4.4: Event clustering works for nearby events
- ✅ AC-4.5: Narrative threads detected and displayed
- ✅ AC-4.6: Event details show on click
- ✅ AC-4.7: Performance: <2s load time for 1000 events
- ✅ AC-4.8: Zero additional API calls (uses existing data)

### Example User Flow
1. User navigates to agent's timeline page
2. Timeline loads showing all events from creation
3. User sees conversation clusters, memory creations, achievements
4. User zooms into "Week of Dec 1-7"
5. User filters to show only "Emotional events" + "Dreams"
6. User clicks on emotional spike event
7. Sidebar shows: "High joy (0.8) after conversation about astronomy"
8. User sees narrative thread: "Astronomy interest" spanning 3 months
9. User clicks thread → sees all astronomy-related events highlighted

---

## Feature 5: Neural Visualization

### Priority: P1 (High)
### Cost: 0 API calls
### Complexity: High

### Description
Real-time 3D visualization of agent "thinking" using Three.js, showing memory activation, emotional processing, and decision-making as beautiful, interactive visual effects.

### User Value
- Unprecedented transparency into AI decision-making
- Beautiful, engaging visual experience
- Educational value for understanding AI
- **Marketing appeal - stunning visual showcase**

### Functional Requirements

**FR-5.1: 3D Brain Structure**
- UI SHALL render 3D brain-like structure representing agent's mind
- Structure SHALL have distinct regions:
  - Memory nodes (spheres)
  - Emotional center (glowing core)
  - Reasoning pathways (connecting lines)
  - Attention focus (highlighted area)

**FR-5.2: Memory Activation**
- UI SHALL visualize memory retrieval as glowing spheres
- Sphere size SHALL correlate with memory importance
- Sphere brightness SHALL indicate activation strength
- Multiple memories SHALL glow simultaneously during conversations

**FR-5.3: Emotional Waves**
- UI SHALL visualize emotions as colored waves/particles
- Colors SHALL represent emotion types:
  - Joy: Yellow/Gold
  - Sadness: Blue
  - Anger: Red
  - Fear: Purple
  - Trust: Green
  - Surprise: Orange
- Wave intensity SHALL correlate with emotion strength

**FR-5.4: Thought Flow**
- UI SHALL show information flow as animated paths
- User messages SHALL arrive as energy pulses
- Processing SHALL show as flowing particles
- Response generation SHALL show as output streams

**FR-5.5: Real-Time Updates**
- Visualization SHALL update during active conversations
- Updates SHALL trigger on:
  - New message received
  - Memory retrieved
  - Emotional state change
  - Response being generated

**FR-5.6: Interactive Controls**
- UI SHALL allow camera rotation (mouse drag)
- UI SHALL allow zoom (mouse wheel)
- UI SHALL allow pause/play animation
- UI SHALL show legend explaining visual elements

**FR-5.7: Performance**
- Visualization SHALL maintain 30+ FPS
- Visualization SHALL work on mobile devices (simplified)
- Particle count SHALL be limited (max 1000)

### Technical Requirements

**Data Sources (All Client-Side):**
```typescript
interface VisualizationData {
  memories: {
    id: string
    position: Vector3
    importance: number
    activated: boolean
    activationStrength: number
  }[]

  emotionalState: {
    emotion: EmotionType
    intensity: number
    color: string
  }[]

  thoughtFlow: {
    from: Vector3
    to: Vector3
    progress: number
    type: 'input' | 'processing' | 'output'
  }[]

  attentionFocus: {
    position: Vector3
    radius: number
  }
}
```

**Three.js Implementation:**
```typescript
// src/components/visualizations/NeuralViz.tsx
import { Canvas } from '@react-three/fiber'
import { OrbitControls, Sphere, Line } from '@react-three/drei'
import * as THREE from 'three'

const NeuralVisualization: React.FC<{ agentId: string }> = ({ agentId }) => {
  const agent = useAgentStore(state => state.agents.find(a => a.id === agentId))
  const [vizData, setVizData] = useState<VisualizationData>(null)

  // Update visualization data when agent state changes
  useEffect(() => {
    if (!agent) return

    const data = generateVizData(agent)
    setVizData(data)
  }, [agent])

  return (
    <div className="w-full h-[600px]">
      <Canvas camera={{ position: [0, 0, 10], fov: 75 }}>
        {/* Lighting */}
        <ambientLight intensity={0.5} />
        <pointLight position={[10, 10, 10]} />

        {/* Brain structure */}
        <BrainStructure />

        {/* Memory nodes */}
        {vizData?.memories.map(memory => (
          <MemoryNode key={memory.id} memory={memory} />
        ))}

        {/* Emotional waves */}
        <EmotionalWaves emotions={vizData?.emotionalState || []} />

        {/* Thought flow paths */}
        {vizData?.thoughtFlow.map((flow, i) => (
          <ThoughtPath key={i} flow={flow} />
        ))}

        {/* Attention focus */}
        {vizData?.attentionFocus && (
          <AttentionIndicator focus={vizData.attentionFocus} />
        )}

        {/* Camera controls */}
        <OrbitControls enableZoom enableRotate enablePan={false} />
      </Canvas>

      {/* Legend */}
      <VisualizationLegend />
    </div>
  )
}

// Memory node component
const MemoryNode: React.FC<{ memory: Memory }> = ({ memory }) => {
  const scale = memory.importance / 10 * 0.5 + 0.3 // 0.3 to 0.8
  const opacity = memory.activated ? memory.activationStrength : 0.3

  return (
    <Sphere args={[scale, 32, 32]} position={memory.position}>
      <meshStandardMaterial
        color="#4A90E2"
        emissive="#4A90E2"
        emissiveIntensity={memory.activated ? 2 : 0.1}
        opacity={opacity}
        transparent
      />
    </Sphere>
  )
}

// Emotional waves component
const EmotionalWaves: React.FC<{ emotions: EmotionalState[] }> = ({ emotions }) => {
  const particlesRef = useRef<THREE.Points>(null)

  useFrame((state) => {
    if (!particlesRef.current) return

    // Animate particles based on emotions
    const positions = particlesRef.current.geometry.attributes.position.array
    const time = state.clock.getElapsedTime()

    for (let i = 0; i < positions.length; i += 3) {
      positions[i + 1] = Math.sin(time + i) * 2 // Y position wave
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true
  })

  const particleCount = 500
  const positions = new Float32Array(particleCount * 3)

  for (let i = 0; i < particleCount; i++) {
    positions[i * 3] = (Math.random() - 0.5) * 10
    positions[i * 3 + 1] = (Math.random() - 0.5) * 10
    positions[i * 3 + 2] = (Math.random() - 0.5) * 10
  }

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial size={0.1} color="#FFD700" transparent opacity={0.6} />
    </points>
  )
}

// Thought flow path component
const ThoughtPath: React.FC<{ flow: ThoughtFlow }> = ({ flow }) => {
  const points = [flow.from, flow.to]

  return (
    <Line
      points={points}
      color={flow.type === 'input' ? '#00FF00' : flow.type === 'output' ? '#FF00FF' : '#FFFFFF'}
      lineWidth={2}
      opacity={0.8}
    />
  )
}

// Generate visualization data from agent state
function generateVizData(agent: AgentRecord): VisualizationData {
  // Convert agent data to 3D positions
  const memories = (agent.memories || []).map((mem, i) => ({
    id: mem.id,
    position: new THREE.Vector3(
      Math.cos(i * 0.5) * 5,
      Math.sin(i * 0.5) * 5,
      (Math.random() - 0.5) * 2
    ),
    importance: mem.importance,
    activated: false, // Will be set based on recent activity
    activationStrength: 0
  }))

  const emotionalState = Object.entries(agent.emotionalState?.currentMood || {})
    .filter(([_, intensity]) => intensity > 0.3)
    .map(([emotion, intensity]) => ({
      emotion: emotion as EmotionType,
      intensity,
      color: EMOTION_COLORS[emotion]
    }))

  return {
    memories,
    emotionalState,
    thoughtFlow: [],
    attentionFocus: null
  }
}
```

**Implementation Files:**
- `src/components/visualizations/NeuralViz.tsx` - NEW: Main 3D component
- `src/components/visualizations/BrainStructure.tsx` - NEW: Brain mesh
- `src/components/visualizations/MemoryNode.tsx` - NEW: Memory sphere
- `src/components/visualizations/EmotionalWaves.tsx` - NEW: Particle system
- `src/components/visualizations/ThoughtPath.tsx` - NEW: Flow lines
- `src/components/visualizations/VisualizationLegend.tsx` - NEW: Legend
- `src/app/agents/[id]/visualization/page.tsx` - NEW: Viz page

**Dependencies:**
- `three` - Three.js library
- `@react-three/fiber` - React renderer for Three.js
- `@react-three/drei` - Helper components
- Bundle size: ~500KB

### Acceptance Criteria
- ✅ AC-5.1: 3D visualization renders correctly
- ✅ AC-5.2: Memory nodes display with correct sizes
- ✅ AC-5.3: Emotional waves animate smoothly
- ✅ AC-5.4: Maintains 30+ FPS on desktop
- ✅ AC-5.5: Camera controls work (rotate, zoom)
- ✅ AC-5.6: Updates in real-time during conversations
- ✅ AC-5.7: Legend explains visual elements
- ✅ AC-5.8: Works on mobile (simplified version)
- ✅ AC-5.9: Zero API calls (client-side only)

### Example User Flow
1. User navigates to agent's visualization page
2. 3D brain structure loads with memory nodes floating
3. User starts conversation: "Tell me about space"
4. Input message arrives as green pulse
5. Multiple memory nodes light up (space-related memories)
6. Yellow emotional wave intensifies (joy + curiosity)
7. Thought pathways glow showing processing
8. Output stream emerges as purple flow
9. User rotates view with mouse to see from different angles
10. User hovers over memory node → tooltip shows memory content

---

_[Document continues with Features 6-17 in similar detailed format...]_

---

## PHASE 2 FEATURES (Weeks 4-6)

## Feature 6: Relationship Network

### Priority: P0 (Critical)
### Cost: 0 additional LLM calls (updates during simulations)
### Complexity: Medium

### Description
Agents form genuine relationships with persistent histories, emotional bonds, and dynamic relationship states. Relationships evolve naturally through interactions with metrics like trust, respect, and affection.

### User Value
- Watch agents form natural alliances and rivalries
- Create compelling narratives and storylines
- More engaging multi-agent simulations
- Emergent social dynamics

### Functional Requirements

**FR-6.1: Relationship Types**
- System SHALL support relationship types:
  - Friendship
  - Rivalry
  - Mentorship (mentor/mentee)
  - Professional
  - Acquaintance
- Relationships can have multiple types simultaneously

**FR-6.2: Relationship Metrics**
- System SHALL track 4 core metrics (0-1 scale):
  - **Trust**: Reliability and honesty
  - **Respect**: Admiration and regard
  - **Affection**: Emotional closeness
  - **Familiarity**: How well they know each other
- Metrics update during agent-to-agent interactions

**FR-6.3: Relationship Formation**
- System SHALL create relationships automatically on first interaction
- Initial values: trust=0.3, respect=0.3, affection=0.1, familiarity=0.1
- Relationships strengthen/weaken based on interaction quality

**FR-6.4: Relationship Events**
- System SHALL record significant relationship moments:
  - First meeting
  - Agreements / Disagreements
  - Helping behaviors
  - Conflicts
  - Bonding moments
- Events stored with timestamp and description

**FR-6.5: Relationship Status**
- System SHALL calculate relationship status:
  - Growing: metrics trending upward
  - Stable: metrics unchanged
  - Declining: metrics trending downward
  - Broken: trust < 0.2

**FR-6.6: Relationship Context in Conversations**
- System SHALL inject relationship context into multi-agent prompts
- Agents SHALL reference relationship history in responses
- Trust level affects willingness to cooperate

**FR-6.7: Relationship Visualization**
- UI SHALL display network graph of all relationships
- UI SHALL use color coding:
  - Green: Positive relationships (trust > 0.6)
  - Yellow: Neutral (trust 0.3-0.6)
  - Red: Negative (trust < 0.3)
- UI SHALL show relationship timeline for each pair

### Technical Requirements

**Data Schema:**
```typescript
interface AgentRelationship {
  id: string
  agentId1: string
  agentId2: string

  relationshipTypes: RelationshipType[] // ['friendship', 'professional']

  metrics: {
    trust: number        // 0-1
    respect: number      // 0-1
    affection: number    // 0-1
    familiarity: number  // 0-1
  }

  status: 'growing' | 'stable' | 'declining' | 'broken'

  // Simplified for free tier
  interactionCount: number
  lastInteraction: string
  firstMeeting: string

  // Track only last 10 significant events (storage limit)
  significantEvents: RelationshipEvent[]

  createdAt: string
  updatedAt: string
}

interface RelationshipEvent {
  type: 'agreement' | 'disagreement' | 'help' | 'conflict' | 'bonding'
  description: string
  impactOnMetrics: {
    trust?: number     // +/- change
    respect?: number
    affection?: number
  }
  timestamp: string
}

// Store as subcollection for efficient queries
// Firestore path: agents/{agentId}/relationships/{otherAgentId}
```

**Relationship Update Logic:**
```typescript
class RelationshipService {
  // Update relationship based on interaction
  updateRelationship(
    relationship: AgentRelationship,
    interaction: {
      type: 'positive' | 'negative' | 'neutral'
      context: string
      intensity: number // 0-1
    }
  ): AgentRelationship {
    const { trust, respect, affection, familiarity } = relationship.metrics

    // Changes limited to ±0.1 per interaction (prevent volatility)
    const maxChange = 0.1 * interaction.intensity

    let trustChange = 0
    let respectChange = 0
    let affectionChange = 0
    const familiarityChange = 0.05 // Always increases with interaction

    if (interaction.type === 'positive') {
      trustChange = maxChange * 0.8
      respectChange = maxChange * 0.6
      affectionChange = maxChange * 0.7
    } else if (interaction.type === 'negative') {
      trustChange = -maxChange * 1.2  // Trust drops faster
      respectChange = -maxChange * 0.4
      affectionChange = -maxChange * 0.5
    }

    // Apply diminishing returns (harder to increase already-high metrics)
    const diminishingFactor = (current: number) => 1 - current * 0.5

    const newMetrics = {
      trust: clamp(trust + trustChange * diminishingFactor(trust), 0, 1),
      respect: clamp(respect + respectChange * diminishingFactor(respect), 0, 1),
      affection: clamp(affection + affectionChange * diminishingFactor(affection), 0, 1),
      familiarity: clamp(familiarity + familiarityChange, 0, 1)
    }

    // Determine relationship types
    const types: RelationshipType[] = []
    const avgPositive = (newMetrics.trust + newMetrics.respect + newMetrics.affection) / 3

    if (avgPositive > 0.6 && newMetrics.affection > 0.5) {
      types.push('friendship')
    }
    if (avgPositive < 0.4 && newMetrics.trust < 0.3) {
      types.push('rivalry')
    }
    if (newMetrics.respect > 0.7) {
      types.push('professional')
    }
    if (!types.length) {
      types.push('acquaintance')
    }

    // Determine status
    const previousAvg = (trust + respect + affection) / 3
    const newAvg = avgPositive
    let status: RelationshipStatus

    if (newAvg > previousAvg + 0.05) status = 'growing'
    else if (newAvg < previousAvg - 0.05) status = 'declining'
    else if (newMetrics.trust < 0.2) status = 'broken'
    else status = 'stable'

    // Record significant event if change is meaningful
    const events = [...relationship.significantEvents]
    if (Math.abs(trustChange) > 0.05 || interaction.type !== 'neutral') {
      events.push({
        type: interaction.type === 'positive' ? 'bonding' : 'conflict',
        description: interaction.context,
        impactOnMetrics: {
          trust: trustChange,
          respect: respectChange,
          affection: affectionChange
        },
        timestamp: new Date().toISOString()
      })

      // Keep only last 10 events (storage limit)
      if (events.length > 10) {
        events.shift()
      }
    }

    return {
      ...relationship,
      relationshipTypes: types,
      metrics: newMetrics,
      status,
      interactionCount: relationship.interactionCount + 1,
      lastInteraction: new Date().toISOString(),
      significantEvents: events,
      updatedAt: new Date().toISOString()
    }
  }

  // Get relationship context for LLM prompt
  getRelationshipContext(relationship: AgentRelationship): string {
    const { metrics, relationshipTypes, interactionCount } = relationship

    const typeStr = relationshipTypes.join(' and ')
    const trustLevel = metrics.trust > 0.7 ? 'high' : metrics.trust > 0.4 ? 'moderate' : 'low'
    const history = relationship.significantEvents.slice(-3).map(e => e.description).join('; ')

    return `
You have a ${typeStr} relationship with this agent.
- Trust level: ${trustLevel} (${metrics.trust.toFixed(2)})
- Respect: ${metrics.respect.toFixed(2)}
- Familiarity: ${metrics.familiarity.toFixed(2)}
- Interactions: ${interactionCount}
Recent history: ${history || 'First interaction'}

Respond according to this relationship context. ${
  metrics.trust > 0.6 ? 'Be warm and cooperative.' :
  metrics.trust < 0.3 ? 'Be cautious and reserved.' :
  'Be polite but neutral.'
}
`
  }

  // Analyze interaction to classify it
  async analyzeInteraction(
    agent1Message: string,
    agent2Message: string
  ): Promise<{ type: 'positive' | 'negative' | 'neutral', intensity: number }> {
    // Simple rule-based analysis (no extra API calls)
    const combinedText = (agent1Message + ' ' + agent2Message).toLowerCase()

    const positiveKeywords = ['agree', 'yes', 'good', 'great', 'thank', 'help', 'love', 'friend']
    const negativeKeywords = ['no', 'disagree', 'wrong', 'bad', 'hate', 'stupid', 'idiot']

    let positiveScore = 0
    let negativeScore = 0

    for (const keyword of positiveKeywords) {
      if (combinedText.includes(keyword)) positiveScore++
    }
    for (const keyword of negativeKeywords) {
      if (combinedText.includes(keyword)) negativeScore++
    }

    const intensity = Math.min((positiveScore + negativeScore) / 10, 1)

    if (positiveScore > negativeScore) {
      return { type: 'positive', intensity: Math.max(intensity, 0.3) }
    } else if (negativeScore > positiveScore) {
      return { type: 'negative', intensity: Math.max(intensity, 0.3) }
    } else {
      return { type: 'neutral', intensity: 0.2 }
    }
  }
}
```

**Integration with Multi-Agent Simulation:**
```typescript
// In src/lib/services/simulationService.ts

async function runSimulationRound(simulation: Simulation, round: number) {
  const agents = simulation.participants

  for (let i = 0; i < agents.length; i++) {
    const currentAgent = agents[i]
    const otherAgents = agents.filter((_, idx) => idx !== i)

    // Load relationships with other agents
    const relationships = await Promise.all(
      otherAgents.map(other =>
        relationshipService.getOrCreateRelationship(currentAgent.id, other.id)
      )
    )

    // Inject relationship context into system prompt
    const relationshipContext = relationships
      .map(rel => relationshipService.getRelationshipContext(rel))
      .join('\n\n')

    const systemPrompt = `
${currentAgent.persona}
${relationshipContext}

You are in a conversation with multiple agents. Respond naturally.
`

    // Generate response
    const response = await llmService.generate(systemPrompt, conversationHistory)

    // Update relationships based on interaction
    for (let j = 0; j < otherAgents.length; j++) {
      const otherAgent = otherAgents[j]
      const relationship = relationships[j]

      // Analyze interaction
      const interaction = await relationshipService.analyzeInteraction(
        response,
        conversationHistory[conversationHistory.length - 1].content
      )

      // Update relationship
      const updatedRelationship = relationshipService.updateRelationship(
        relationship,
        {
          ...interaction,
          context: response.substring(0, 100)
        }
      )

      // Save to Firestore
      await saveRelationship(updatedRelationship)
    }

    // Save message
    await saveMessage({
      agentId: currentAgent.id,
      content: response,
      round
    })
  }
}
```

**Implementation Files:**
- `src/lib/services/relationshipService.ts` - NEW: Relationship logic
- `src/types/database.ts` - Add relationship types
- `src/lib/services/simulationService.ts` - MODIFY: Integrate relationships
- `src/components/relationships/RelationshipGraph.tsx` - NEW: Network visualization
- `src/components/relationships/RelationshipTimeline.tsx` - NEW: Timeline
- `src/app/agents/[id]/relationships/page.tsx` - NEW: Relationships page

### Acceptance Criteria
- ✅ AC-6.1: Relationships created on first agent-agent interaction
- ✅ AC-6.2: Relationship metrics update correctly based on interactions
- ✅ AC-6.3: Relationship context injected into multi-agent simulations
- ✅ AC-6.4: Agents reference relationship history in responses
- ✅ AC-6.5: Relationship network graph displays correctly
- ✅ AC-6.6: Relationship timeline shows significant events
- ✅ AC-6.7: Zero additional LLM calls (updates during existing simulations)
- ✅ AC-6.8: Storage limited (max 10 events per relationship)

### Firestore Cost Analysis
- **Reads per simulation:** +2-3 (relationship lookups)
- **Writes per simulation:** +1-2 (relationship updates)
- **Storage per relationship:** ~500 bytes
- **Estimated daily usage:** +10-20 reads, +5-10 writes (minimal impact)

### Example User Flow
1. User starts multi-agent simulation with Agent A and Agent B
2. First interaction → Relationship created (trust: 0.3, respect: 0.3)
3. Agent A: "I love your perspective on this!"
4. Agent B: "Thank you! I appreciate your insight too."
5. System detects positive interaction → Updates relationship (trust: 0.38, affection: 0.17)
6. Round 5: Agents reference relationship → "As my friend mentioned earlier..."
7. After simulation, user views relationship graph
8. Sees green connection between A and B (friendship forming)
9. Clicks relationship → Timeline shows "First meeting", "Bonding moment"
10. Over multiple simulations, relationship deepens to trust: 0.75+

---

## Feature 7-17 Specifications

_[Continue with remaining features in same detailed format...]_

**Features 7-17 include:**
- Meta-Learning System
- Temporal Awareness & Future Planning
- Creativity Engine
- Agent Journals
- On-Demand Dreams
- Psychological Profiles
- Collaborative Challenges
- Parallel Reality Simulations
- Lightweight Memory Graph
- Shared Knowledge Library
- Agent Mentorship

**[Due to length constraints, these would follow the same detailed specification format as Features 1-6, including: Description, User Value, Functional Requirements, Technical Requirements, Data Schema, Implementation Files, Acceptance Criteria, and Cost Analysis]**

---

## User Stories

### Epic 1: Emotional & Personality Depth
**As a user, I want agents to have emotional depth so that conversations feel more genuine and engaging.**

**User Stories:**
- US-1.1: As a user, I want to see my agent's current emotional state so I can understand their mood
- US-1.2: As a user, I want my agent to respond with empathy when I share emotions so I feel heard
- US-1.3: As a user, I want my agent to have a unique speaking style so they feel distinct
- US-1.4: As a user, I want to see my agent earn achievements so I can track their development
- US-1.5: As a user, I want my agent's emotions to change naturally so they feel alive

### Epic 2: Social Dynamics
**As a user, I want agents to form real relationships so multi-agent interactions are more interesting.**

**User Stories:**
- US-2.1: As a user, I want to see which agents are friends/rivals so I can create interesting simulations
- US-2.2: As a user, I want agents to remember their relationship history so interactions have continuity
- US-2.3: As a user, I want to visualize the agent relationship network so I can understand social dynamics
- US-2.4: As a user, I want relationships to affect agent behavior so friendships matter

### Epic 3: Creative Expression
**As a user, I want agents to create content so I have unique, personalized output.**

**User Stories:**
- US-3.1: As a user, I want my agent to write stories so I have custom entertainment
- US-3.2: As a user, I want to read my agent's dreams so I understand their inner world
- US-3.3: As a user, I want my agent to keep a journal so I see their self-reflection
- US-3.4: As a user, I want my agent to generate creative content that matches their personality

### Epic 4: Intelligence & Memory
**As a user, I want agents to be smarter about using memories so conversations are more contextual.**

**User Stories:**
- US-4.1: As a user, I want related memories to be linked so agents make better connections
- US-4.2: As a user, I want to see which memories were used in a response so I understand agent reasoning
- US-4.3: As a user, I want agents to learn from experience so they improve over time

### Epic 5: Visualization & Discovery
**As a user, I want to see visual representations of agent intelligence so I understand how they work.**

**User Stories:**
- US-5.1: As a user, I want to see a 3D visualization of my agent thinking so I can watch their mind work
- US-5.2: As a user, I want to explore my agent's timeline so I can find interesting moments
- US-5.3: As a user, I want to see patterns in agent behavior so I can optimize their development

---

## Technical Requirements

### System Requirements

**Frontend:**
- Next.js 15
- React 19
- TypeScript 5
- Tailwind CSS v4
- Three.js / React Three Fiber (for 3D viz)
- D3.js (for timelines/graphs)
- Zustand (state management)

**Backend:**
- Next.js API Routes (Serverless)
- Firebase Firestore
- Google Gemini API (primary LLM)
- Groq API (fallback LLM)

**Infrastructure:**
- Vercel Free Tier
- Firebase Free Tier
- No external paid services

### API Constraints

**Rate Limits:**
```typescript
// Rate limiting middleware
const RATE_LIMITS = {
  dreamGeneration: { max: 5, window: '1 day', scope: 'user' },
  journalGeneration: { max: 10, window: '1 day', scope: 'user' },
  creativeWorks: { max: 20, window: '1 day', scope: 'user' },
  simulations: { max: 10, window: '1 hour', scope: 'user' },
}

// Implement using Vercel KV (free tier) or simple in-memory cache
```

**API Usage Monitoring:**
```typescript
// Track daily usage
interface APIUsageStats {
  date: string
  llmCalls: number
  firestoreReads: number
  firestoreWrites: number
  storageUsed: number
}

// Alert if approaching limits (80% threshold)
const USAGE_THRESHOLDS = {
  llmCalls: 0.8 * 1500,        // 1200/day
  firestoreReads: 0.8 * 50000, // 40k/day
  firestoreWrites: 0.8 * 20000 // 16k/day
}
```

### Performance Requirements

**Response Times:**
- Page load: < 2s (p95)
- API response: < 3s (p95)
- Firestore query: < 500ms (p95)
- 3D visualization: 30+ FPS
- Timeline load (1000 events): < 2s

**Client-Side:**
- Bundle size: < 2MB (including Three.js)
- Lazy load heavy components
- Aggressive code splitting

**Caching Strategy:**
```typescript
// Cache durations
const CACHE_TTL = {
  agentData: 5 * 60 * 1000,         // 5 minutes
  relationships: 10 * 60 * 1000,    // 10 minutes
  sharedKnowledge: 30 * 60 * 1000,  // 30 minutes
  achievements: 1 * 60 * 1000,      // 1 minute

  // Persistent caching
  memories: 'indexedDB',             // Cache in browser
  messages: 'indexedDB'
}
```

### Data Management

**Storage Optimization:**
```typescript
// Automatic cleanup rules
const CLEANUP_POLICIES = {
  dreams: { maxPerAgent: 10, deleteOldest: true },
  journals: { maxPerAgent: 30, deleteOldest: true },
  creativeWorks: { maxPerAgent: 20, deleteOldest: true },
  emotionalHistory: { maxEvents: 20, inMemory: true },
  relationshipEvents: { maxEvents: 10, per: 'relationship' },
  simulations: { ttl: 30 * 24 * 60 * 60 * 1000 } // 30 days
}

// Implement with Firestore TTL or Cloud Functions
```

**Firestore Structure:**
```
/agents/{agentId}
  - Basic agent data + metadata fields

  /relationships/{otherAgentId}
    - Relationship data

  /creative_works/{workId}
    - Generated creative content

  /journal_entries/{entryId}
    - Journal entries

  /dreams/{dreamId}
    - Dreams

/messages/{messageId}
  - Messages (existing)

/memories/{memoryId}
  - Memories (existing)

/simulations/{simulationId}
  - Simulations (existing)

/shared_knowledge/{topicId}
  - Shared knowledge base
```

### Security & Validation

**Input Validation:**
```typescript
// Zod schemas for all inputs
const CreateAgentSchema = z.object({
  name: z.string().min(1).max(100),
  persona: z.string().min(10).max(1000),
  goals: z.array(z.string().max(200)).max(10),
  linguisticProfile: z.object({
    formality: z.number().min(0).max(1),
    verbosity: z.number().min(0).max(1),
    // ...
  }).optional()
})

// Validate all API inputs
```

**Rate Limiting:**
- Implement per-user rate limits
- Prevent API quota exhaustion
- Graceful degradation on limit hit

**Data Privacy:**
- No PII stored unnecessarily
- User data isolated by userId
- Optional data export feature

---

## Implementation Roadmap

### Phase 1: Zero-Cost Foundation (Weeks 1-3)

**Week 1: Core Personality**
- [ ] Task 1.1: Define LinguisticProfile type in database.ts (2h)
- [ ] Task 1.2: Implement linguistic profile generation (4h)
- [ ] Task 1.3: Inject style into LLM prompts (3h)
- [ ] Task 1.4: Create linguistic profile UI component (4h)
- [ ] Task 1.5: Define achievement system types (2h)
- [ ] Task 1.6: Implement AchievementService with 30+ achievements (6h)
- [ ] Task 1.7: Create achievement UI components (6h)
- [ ] Task 1.8: Define EmotionalState types (2h)
- [ ] Task 1.9: Implement EmotionalService (8h)
- [ ] Task 1.10: Integrate emotions into conversation flow (4h)
- [ ] Task 1.11: Create emotion visualization (radar chart) (5h)

**Estimated: 46 hours / ~1 week**

**Week 2: Visualization**
- [ ] Task 2.1: Set up Three.js + React Three Fiber (3h)
- [ ] Task 2.2: Create basic brain structure mesh (4h)
- [ ] Task 2.3: Implement memory node rendering (5h)
- [ ] Task 2.4: Implement emotional particle system (6h)
- [ ] Task 2.5: Add thought flow animations (5h)
- [ ] Task 2.6: Create interactive controls (3h)
- [ ] Task 2.7: Optimize performance (30+ FPS) (4h)
- [ ] Task 2.8: Set up D3.js for timeline (2h)
- [ ] Task 2.9: Create TimelineService for data aggregation (6h)
- [ ] Task 2.10: Build timeline UI with filters (8h)
- [ ] Task 2.11: Implement event clustering (4h)

**Estimated: 50 hours / ~1 week**

**Week 3: Social & Learning**
- [ ] Task 3.1: Define Relationship types (2h)
- [ ] Task 3.2: Implement RelationshipService (8h)
- [ ] Task 3.3: Integrate relationships into simulations (6h)
- [ ] Task 3.4: Create relationship network graph (8h)
- [ ] Task 3.5: Create relationship timeline (4h)
- [ ] Task 3.6: Implement meta-learning system (5h)
- [ ] Task 3.7: Implement temporal awareness (4h)
- [ ] Task 3.8: Testing & bug fixes (8h)

**Estimated: 45 hours / ~1 week**

**Phase 1 Total: 141 hours / ~3 weeks**

---

### Phase 2: On-Demand Creativity (Weeks 4-6)

**Week 4: Creative Engine**
- [ ] Task 4.1: Create /api/agents/[id]/create route (4h)
- [ ] Task 4.2: Implement CreativityService (6h)
- [ ] Task 4.3: Build creative work UI (6h)
- [ ] Task 4.4: Implement creative portfolio (4h)
- [ ] Task 4.5: Create /api/agents/[id]/journal route (3h)
- [ ] Task 4.6: Implement journal generation logic (5h)
- [ ] Task 4.7: Build journal UI (5h)
- [ ] Task 4.8: Add rate limiting middleware (4h)
- [ ] Task 4.9: Testing (5h)

**Estimated: 42 hours / ~1 week**

**Week 5: Dreams & Profiles**
- [ ] Task 5.1: Create /api/agents/[id]/dream route (4h)
- [ ] Task 5.2: Implement dream generation service (8h)
- [ ] Task 5.3: Implement dream symbol extraction (5h)
- [ ] Task 5.4: Build dream journal UI (6h)
- [ ] Task 5.5: Implement psychological profile generation (6h)
- [ ] Task 5.6: Add profile to agent creation flow (3h)
- [ ] Task 5.7: Build profile display UI (4h)
- [ ] Task 5.8: Testing (6h)

**Estimated: 42 hours / ~1 week**

**Week 6: Enhanced Simulations**
- [ ] Task 6.1: Define challenge templates (4h)
- [ ] Task 6.2: Implement challenge system (6h)
- [ ] Task 6.3: Build challenge UI (6h)
- [ ] Task 6.4: Implement parallel reality forking (5h)
- [ ] Task 6.5: Build simulation comparison UI (5h)
- [ ] Task 6.6: Implement conflict detection (4h)
- [ ] Task 6.7: Add conflict resolution logic (4h)
- [ ] Task 6.8: Testing & integration (8h)

**Estimated: 42 hours / ~1 week**

**Phase 2 Total: 126 hours / ~3 weeks**

---

### Phase 3: Advanced Intelligence (Weeks 7-9)

**Week 7: Smart Memory**
- [ ] Task 7.1: Implement concept extraction (6h)
- [ ] Task 7.2: Build memory linking algorithm (8h)
- [ ] Task 7.3: Update memory retrieval with concept linking (5h)
- [ ] Task 7.4: Build knowledge graph visualization (8h)
- [ ] Task 7.5: Testing (5h)

**Estimated: 32 hours / ~1 week**

**Week 8: Shared Knowledge**
- [ ] Task 8.1: Create shared_knowledge collection schema (2h)
- [ ] Task 8.2: Create /api/knowledge route (4h)
- [ ] Task 8.3: Implement KnowledgeService (6h)
- [ ] Task 8.4: Integrate knowledge into agent prompts (4h)
- [ ] Task 8.5: Build knowledge library UI (6h)
- [ ] Task 8.6: Implement caching (3h)
- [ ] Task 8.7: Testing (5h)

**Estimated: 30 hours / ~1 week**

**Week 9: Mentorship & Polish**
- [ ] Task 9.1: Implement mentorship matching (4h)
- [ ] Task 9.2: Create mentorship simulation type (5h)
- [ ] Task 9.3: Build mentorship UI (5h)
- [ ] Task 9.4: Comprehensive testing of all features (10h)
- [ ] Task 9.5: Performance optimization (6h)
- [ ] Task 9.6: Bug fixes (5h)
- [ ] Task 9.7: Documentation (5h)

**Estimated: 40 hours / ~1 week**

**Phase 3 Total: 102 hours / ~3 weeks**

---

**Grand Total: 369 hours / ~9 weeks**

---

## Success Metrics

### User Engagement Metrics

**Primary Metrics:**
- **Session Duration:** Baseline → Target +50%
  - Measurement: Average time per session
  - Goal: Increase from 15min to 22min

- **Messages per Session:** Baseline → Target +40%
  - Measurement: Average messages sent
  - Goal: Increase from 10 to 14

- **Return Visit Frequency:** Baseline → Target +60%
  - Measurement: % users returning within 7 days
  - Goal: Increase from 30% to 48%

**Secondary Metrics:**
- Feature discovery rate: 80% users discover 5+ new features within first week
- Achievement unlock rate: Average 3 achievements per agent per week
- Creative content generation: Average 2 creative works per user per week
- Relationship formation: Average 2 relationships formed per multi-agent simulation

### Agent Quality Metrics

**Intelligence Metrics:**
- Memory relevance score: >0.7 average (AI-evaluated)
- Concept linking accuracy: >80% of links meaningful
- Emotional consistency: Emotions align with context >85% of time

**Personality Metrics:**
- Linguistic style consistency: >90% messages match defined style
- Achievement progression: Average agent level 3+ after 50 conversations
- Relationship formation rate: 1 relationship per 10 multi-agent interactions

### Technical Performance Metrics

**Response Times:**
- API response time: <3s (p95)
- Page load time: <2s (p95)
- Firestore query time: <500ms (p95)
- 3D visualization FPS: >30 FPS (p95)

**Resource Usage:**
- Daily LLM calls: <500 (33% of limit)
- Daily Firestore reads: <10,000 (20% of limit)
- Daily Firestore writes: <5,000 (25% of limit)
- Average storage per agent: <20KB

**Reliability:**
- API success rate: >99%
- Error rate: <1% of requests
- Uptime: >99.9%

### Business Metrics

**Growth:**
- User acquisition: Track new signups
- User retention: 7-day, 30-day retention rates
- Social sharing: Track shares of creative content, dreams, achievements

**Engagement:**
- Feature adoption: % users using each new feature
- Power users: % users with 10+ agents
- Simulation usage: Simulations run per user per week

### Cost Control Metrics

**Free Tier Monitoring:**
- API usage vs limit: Stay <80% daily
- Storage growth rate: <1GB/month
- Bandwidth usage: <50GB/month

**Alerts:**
- Alert if API usage >80% of daily limit
- Alert if Firestore reads >40k/day
- Alert if storage >800MB

---

## Risk Analysis

### Technical Risks

**Risk 1: API Rate Limit Exhaustion**
- **Probability:** Medium
- **Impact:** High
- **Mitigation:**
  - Implement aggressive rate limiting per user
  - Add request queuing system
  - Fallback to Groq API (already implemented)
  - Cache aggressively
  - Monitor usage proactively

**Risk 2: Firestore Free Tier Exceeded**
- **Probability:** Low
- **Impact:** Medium
- **Mitigation:**
  - Implement read/write limits per user
  - Cache frequently accessed data
  - Optimize queries (composite indexes)
  - Monitor daily usage
  - Implement automatic cleanup of old data

**Risk 3: Performance Degradation (3D Viz)**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Implement performance monitoring
  - Add fallback to 2D visualization on low-end devices
  - Limit particle counts
  - Use LOD (Level of Detail)
  - Mobile: simplified visualization

**Risk 4: LLM Output Quality Issues**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Implement output validation
  - Add fallback prompts for failures
  - Use temperature controls
  - Add content filtering
  - Monitor user feedback

### Product Risks

**Risk 5: Feature Overload**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Phased rollout (3 phases)
  - Progressive disclosure in UI
  - Onboarding tutorial
  - Feature discovery nudges
  - User feedback loops

**Risk 6: Low Feature Adoption**
- **Probability:** Low
- **Impact:** High
- **Mitigation:**
  - User research before implementation
  - A/B testing for feature visibility
  - Gamification (achievements) to drive discovery
  - In-app guides and tooltips
  - Feature highlight announcements

**Risk 7: User Expectations vs Reality**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Clear documentation of limitations
  - Set expectations about free-tier constraints
  - Transparent about AI capabilities
  - Showcase best use cases
  - Collect and act on feedback

### Business Risks

**Risk 8: Unsustainable Growth**
- **Probability:** Low
- **Impact:** High
- **Mitigation:**
  - Monitor user growth rate
  - Implement waiting list if needed
  - Consider premium tier for scaling
  - Optimize resource usage continuously
  - Plan migration path to paid tier if successful

**Risk 9: Competitive Pressure**
- **Probability:** Medium
- **Impact:** Medium
- **Mitigation:**
  - Focus on unique features (dreams, emotions, relationships)
  - Build strong brand identity
  - Foster community
  - Rapid iteration based on feedback
  - Patent/trademark key innovations

---

## Appendix

### A. Technology Stack Details

**Frontend:**
- Next.js 15.1.3
- React 19.0.0
- TypeScript 5.7.2
- Tailwind CSS 4.0.0
- Three.js 0.170.0
- @react-three/fiber 8.17.10
- @react-three/drei 9.117.3
- D3.js 7.9.0
- Zustand 5.0.2
- Framer Motion 11.15.0

**Backend:**
- Firebase SDK 12.0.0
- @langchain/core 0.3.29
- @langchain/google-genai 0.1.4
- @langchain/groq 0.1.2

**Dev Tools:**
- ESLint 9.x
- Prettier
- Husky (git hooks)

### B. API Route Inventory

**Current Routes (5):**
1. POST /api/agents - Create agent
2. GET /api/agents - List agents
3. POST /api/messages - Send message
4. GET /api/messages - Get messages
5. POST /api/llm - LLM processing
6. POST /api/memory - Memory operations
7. GET /api/memory - Get memories
8. POST /api/multiagent - Multi-agent simulation

**New Routes (4):**
9. POST /api/agents/[id]/create - Generate creative content
10. POST /api/agents/[id]/dream - Generate dream
11. POST /api/agents/[id]/journal - Generate journal entry
12. GET /api/knowledge - Get shared knowledge

**Total: 12 routes (at Vercel free tier limit)**

### C. Free Tier Limits Reference

**Vercel:**
- Serverless Functions: 12 max
- Execution Time: 10s max
- Bandwidth: 100GB/month
- Builds: Unlimited
- Domains: Unlimited

**Google Gemini:**
- Rate: 60 requests/minute
- Daily: 1,500 requests/day
- Context: 32K tokens
- Cost: $0

**Groq:**
- Rate: Very generous (undisclosed)
- Daily: Very generous
- Speed: Fastest inference
- Cost: $0

**Firebase Firestore:**
- Reads: 50,000/day
- Writes: 20,000/day
- Deletes: 20,000/day
- Storage: 1GB
- Network: 10GB/month

### D. Glossary

**Terms:**
- **Achievement:** Milestone unlocked by agent based on activity
- **Baseline:** Default emotional state agent returns to
- **Cluster:** Group of related timeline events
- **Concept Linking:** Connecting memories by semantic meaning
- **Decay:** Gradual return of emotions to baseline
- **Emotional Contagion:** Emotions spreading between agents/users
- **Familiarity:** How well two agents know each other
- **Linguistic Profile:** Agent's unique speech patterns
- **Meta-Learning:** Learning how to learn
- **Narrative Thread:** Recurring topic across timeline
- **On-Demand:** User-triggered, not automatic
- **Parallel Reality:** Fork of agent in alternate timeline
- **Relationship Metric:** Numerical measure of relationship quality (trust, respect, etc.)
- **Temporal Awareness:** Agent's sense of time and patterns

---

**END OF PRD**

---

## Document Control

**Version History:**
- v1.0 (2026-01-11): Initial draft

**Approvals:**
- [ ] Product Owner
- [ ] Engineering Lead
- [ ] Design Lead

**Next Steps:**
1. Review and approve PRD
2. Create detailed technical design docs
3. Set up project tracking (GitHub Issues/Projects)
4. Begin Phase 1 implementation
5. Weekly sprint reviews

---

**Questions or Feedback?**
Contact: [Product Team]
