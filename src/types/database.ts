// Database schema types and interfaces
// These represent the structure for Firebase Firestore implementation

// ============================================
// PHASE 1: Linguistic Personality System Types
// ============================================

export interface LinguisticProfile {
  formality: number        // 0-1: casual ↔ formal
  verbosity: number        // 0-1: concise ↔ elaborate
  humor: number           // 0-1: serious ↔ playful
  technicalLevel: number  // 0-1: simple ↔ technical language
  expressiveness: number  // 0-1: plain ↔ metaphorical
  preferredWords: string[] // Max 100 tracked words
  signatureExpressions: string[] // Max 20 signature phrases
  punctuationStyle: {
    exclamationFrequency: number // 0-1
    ellipsisUsage: boolean
    emojiUsage: boolean
  }
}

// ============================================
// PHASE 1: Emotional State System Types
// ============================================

export type EmotionType =
  | 'joy'
  | 'sadness'
  | 'anger'
  | 'fear'
  | 'surprise'
  | 'trust'
  | 'anticipation'
  | 'disgust'

export interface EmotionalState {
  currentMood: Record<EmotionType, number> // 0-1 for each emotion
  emotionalBaseline: Record<EmotionType, number> // 0-1 default state
  lastUpdated: string // ISO timestamp
  dominantEmotion: EmotionType
}

export interface EmotionalEvent {
  id: string
  emotion: EmotionType
  intensity: number // 0-1
  trigger: string // What caused it (e.g., 'user_message', 'achievement_unlock')
  context: string // Conversation snippet or description
  timestamp: string // ISO timestamp
  decayRate: number // How fast it fades (0-1, default 0.1 = 10% per hour)
}

// ============================================
// PHASE 1: Achievement System Types
// ============================================

export type AchievementRarity = 'common' | 'rare' | 'epic' | 'legendary'
export type AchievementCategory = 'conversational' | 'knowledge' | 'personality' | 'relationship' | 'special'

export interface AchievementRequirement {
  type: 'count' | 'threshold' | 'combination'
  metric: string
  target: number
  condition?: 'greater' | 'less' | 'equal'
}

export interface Achievement {
  id: string
  name: string
  description: string
  category: AchievementCategory
  icon: string
  rarity: AchievementRarity
  requirement: AchievementRequirement
  rewardXP: number
}

export interface UnlockedAchievement {
  unlockedAt: string // ISO timestamp
  progress?: number // For partial progress achievements
}

export interface AgentProgress {
  level: number
  experiencePoints: number
  nextLevelXP: number
  achievements: Record<string, UnlockedAchievement> // achievementId → unlock info
  skillPoints: number
  allocatedSkills: Record<string, number> // skill name → points allocated
}

export interface AgentStats {
  conversationCount: number
  totalMessages: number
  uniqueTopics: string[]
  uniqueWords: number
  questionsAsked: number
  emotionRecognitions: number
  relationshipsFormed: number
  dreamsGenerated: number
  creativeWorksCreated: number
  journalEntries: number
  scienceTopics: number
  artTopics: number
  philosophyTopics: number
  helpfulResponses: number
  longestConversation: number
  consecutiveDays: number
  lastActiveDate: string
}

// ============================================
// PHASE 1: Timeline Explorer Types
// ============================================

export type TimelineEventType =
  | 'conversation'
  | 'memory'
  | 'emotion'
  | 'relationship'
  | 'dream'
  | 'achievement'
  | 'creative'
  | 'journal'

export interface TimelineEvent {
  id: string
  agentId: string
  type: TimelineEventType
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

export interface TimelineCluster {
  id: string
  events: TimelineEvent[]
  startTime: string
  endTime: string
  dominantType: TimelineEventType
  summary: string
}

export interface NarrativeThread {
  id: string
  topic: string
  events: string[] // Event IDs
  startTime: string
  endTime: string
  importance: number
}

export interface TimelineFilters {
  types: (TimelineEventType | 'all')[]
  dateRange: {
    start: string | null
    end: string | null
  }
  minImportance: number
  searchQuery?: string
}

// ============================================
// PHASE 1: Neural Visualization Types
// ============================================

export interface Vector3 {
  x: number
  y: number
  z: number
}

export interface MemoryVisualization {
  id: string
  position: Vector3
  importance: number
  activated: boolean
  activationStrength: number
  label?: string
}

export interface EmotionVisualization {
  emotion: EmotionType
  intensity: number
  color: string
}

export interface ThoughtFlow {
  from: Vector3
  to: Vector3
  progress: number
  type: 'input' | 'processing' | 'output'
}

export interface VisualizationData {
  memories: MemoryVisualization[]
  emotionalState: EmotionVisualization[]
  thoughtFlow: ThoughtFlow[]
  attentionFocus: {
    position: Vector3
    radius: number
  } | null
}

// Emotion color mapping for visualization
export const EMOTION_COLORS: Record<EmotionType, string> = {
  joy: '#FFD700',        // Gold
  sadness: '#4169E1',    // Royal Blue
  anger: '#DC143C',      // Crimson
  fear: '#9932CC',       // Dark Orchid
  surprise: '#FF8C00',   // Dark Orange
  trust: '#32CD32',      // Lime Green
  anticipation: '#FF69B4', // Hot Pink
  disgust: '#8B4513'     // Saddle Brown
}

// ============================================
// Core Agent Record (Extended for Phase 1)
// ============================================

export interface AgentRecord {
  id: string
  name: string
  persona: string
  goals: string[] // JSON array of strings
  status: 'active' | 'inactive' | 'training'
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  userId?: string // For multi-user support
  settings?: Record<string, unknown> // JSON object for agent-specific settings
  // Personality evolution fields
  coreTraits: Record<string, number> // Immutable personality traits (e.g., {"curiosity": 0.8, "helpfulness": 0.9})
  dynamicTraits: Record<string, number> // Learned personality traits (e.g., {"confidence": 0.3, "knowledge": 0.5})
  memoryCount: number // Number of memories stored
  totalInteractions: number // Total number of interactions for personality evolution

  // Phase 1: Linguistic Personality System
  linguisticProfile?: LinguisticProfile

  // Phase 1: Emotional State System
  emotionalState?: EmotionalState
  emotionalHistory?: EmotionalEvent[] // Max 20 events

  // Phase 1: Achievement System
  progress?: AgentProgress
  stats?: AgentStats

  // Phase 2: Psychological Profile
  psychologicalProfile?: PsychologicalProfile

  // Phase 2: Stats counters
  relationshipCount?: number
  creativeWorks?: number
  dreamCount?: number
  journalCount?: number
  challengesCompleted?: number
  challengeWins?: number
}

export interface MemoryRecord {
  id: string
  agentId: string
  type: 'conversation' | 'fact' | 'interaction' | 'personality_insight'
  content: string // The actual memory content
  summary: string // AI-generated summary for quick recall
  keywords: string[] // Array of keywords for relevance matching
  importance: number // 1-10 scale of how important this memory is
  context: string // Context where this memory was formed (e.g., "user complimented agent")
  timestamp: string // ISO timestamp
  metadata?: Record<string, unknown> // Additional metadata (e.g., message IDs, interaction types)
  userId?: string // For multi-user support
  isActive: boolean // For soft delete functionality
}

export interface MessageRecord {
  id: string
  agentId: string
  content: string
  type: 'user' | 'agent' | 'system'
  timestamp: string // ISO timestamp
  roomId?: string // For multi-agent conversations
  metadata?: Record<string, unknown> // JSON object for additional message data
  userId?: string // For multi-user support
}

// Firestore document types (without id field since Firestore uses document IDs)
export type AgentDocument = Omit<AgentRecord, 'id'>

export type MemoryDocument = Omit<MemoryRecord, 'id'>

export type MessageDocument = Omit<MessageRecord, 'id'>

export interface RoomRecord {
  id: string
  name: string
  description?: string
  participants: string[] // Array of agent IDs
  status: 'active' | 'paused' | 'stopped'
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
  userId?: string // For multi-user support
  settings?: Record<string, unknown> // JSON object for room-specific settings
}

export type RoomDocument = Omit<RoomRecord, 'id'>

export interface SimulationRecord {
  id: string
  agents: Array<{
    id: string
    name: string
    persona: string
    goals: string[]
  }>
  messages: Array<{
    id: string
    agentId: string
    agentName: string
    content: string
    timestamp: string
    round: number
  }>
  maxRounds: number
  createdAt: string // ISO timestamp
  isComplete: boolean
  finalRound: number
}

export type SimulationDocument = Omit<SimulationRecord, 'id'>

export interface UserRecord {
  id: string
  email: string
  name?: string
  createdAt: string // ISO timestamp
  updatedAt: string // ISO timestamp
}

// Database operation types (Firestore compatible)
export interface CreateAgentData {
  name: string
  persona: string
  goals: string[]
  status?: AgentRecord['status']
  userId?: string
  settings?: Record<string, unknown>
}

export interface CreateMessageData {
  agentId: string
  content: string
  type: MessageRecord['type']
  roomId?: string
  metadata?: Record<string, unknown>
  userId?: string
}

export interface CreateRoomData {
  name: string
  description?: string
  participants: string[]
  status?: RoomRecord['status']
  userId?: string
  settings?: Record<string, unknown>
}

export interface UpdateAgentData {
  name?: string
  persona?: string
  goals?: string[]
  status?: AgentRecord['status']
  settings?: Record<string, unknown>
  coreTraits?: Record<string, number>
  dynamicTraits?: Record<string, number>
  memoryCount?: number
  totalInteractions?: number
  // Phase 1 fields
  linguisticProfile?: LinguisticProfile
  emotionalState?: EmotionalState
  emotionalHistory?: EmotionalEvent[]
  progress?: AgentProgress
  stats?: AgentStats
}

export interface CreateMemoryData {
  agentId: string
  type: MemoryRecord['type']
  content: string
  summary: string
  keywords: string[]
  importance: number
  context: string
  metadata?: Record<string, unknown>
  userId?: string
}

export interface UpdateMemoryData {
  content?: string
  summary?: string
  keywords?: string[]
  importance?: number
  context?: string
  metadata?: Record<string, unknown>
  isActive?: boolean
}

export interface CreateRoomData {
  name: string
  description?: string
  participants: string[]
  status?: RoomRecord['status']
  userId?: string
  settings?: Record<string, unknown>
}

export interface UpdateRoomData {
  name?: string
  description?: string
  participants?: string[]
  status?: RoomRecord['status']
  settings?: Record<string, unknown>
}

// ============================================
// PHASE 2: Relationship Network Types
// ============================================

export type RelationshipType =
  | 'friendship'
  | 'rivalry'
  | 'mentorship'
  | 'professional'
  | 'acquaintance'

export type RelationshipStatus = 'growing' | 'stable' | 'declining' | 'broken'

export type RelationshipEventType =
  | 'first_meeting'
  | 'agreement'
  | 'disagreement'
  | 'help'
  | 'conflict'
  | 'bonding'
  | 'betrayal'
  | 'reconciliation'

export interface RelationshipMetrics {
  trust: number        // 0-1: Reliability and honesty
  respect: number      // 0-1: Admiration and regard
  affection: number    // 0-1: Emotional closeness
  familiarity: number  // 0-1: How well they know each other
}

export interface RelationshipEvent {
  id: string
  type: RelationshipEventType
  description: string
  impactOnMetrics: Partial<RelationshipMetrics>
  timestamp: string
  context?: string // Conversation snippet
}

export interface AgentRelationship {
  id: string
  agentId1: string
  agentId2: string

  relationshipTypes: RelationshipType[]
  metrics: RelationshipMetrics
  status: RelationshipStatus

  interactionCount: number
  lastInteraction: string
  firstMeeting: string

  // Track only last 10 significant events (storage limit)
  significantEvents: RelationshipEvent[]

  createdAt: string
  updatedAt: string
}

// ============================================
// PHASE 2: Creativity Engine Types
// ============================================

export type CreativeWorkType =
  | 'story'
  | 'poem'
  | 'song'
  | 'essay'
  | 'joke'
  | 'dialogue'
  | 'recipe'
  | 'advice'
  | 'analysis'
  | 'review'

export type CreativeWorkStyle =
  | 'dramatic'
  | 'comedic'
  | 'romantic'
  | 'mysterious'
  | 'philosophical'
  | 'inspirational'
  | 'satirical'
  | 'melancholic'

export interface CreativeWork {
  id: string
  agentId: string
  type: CreativeWorkType
  style: CreativeWorkStyle
  title: string
  content: string

  // Context and inspiration
  prompt?: string // User's request if any
  inspiration?: string // What inspired this piece
  emotionalContext?: EmotionalState // Agent's mood during creation

  // Metadata
  wordCount: number
  themes: string[]
  mood: EmotionType

  // Quality indicators (self-evaluated)
  creativity: number // 0-1
  coherence: number  // 0-1
  emotionalDepth: number // 0-1

  createdAt: string
  isFavorite: boolean
}

// ============================================
// PHASE 2: Dream System Types
// ============================================

export type DreamType =
  | 'adventure'
  | 'nightmare'
  | 'memory_replay'
  | 'symbolic'
  | 'prophetic'
  | 'lucid'
  | 'recurring'

export interface DreamSymbol {
  symbol: string
  meaning: string
  frequency: number // How often this symbol appears
  emotionalAssociation: EmotionType
}

export interface DreamSequence {
  scene: string
  characters: string[]
  emotions: EmotionType[]
  symbolsPresent: string[]
}

export interface Dream {
  id: string
  agentId: string
  type: DreamType
  title: string
  narrative: string

  // Dream structure
  sequences: DreamSequence[]

  // Symbolism
  symbols: DreamSymbol[]

  // Psychological analysis
  themes: string[]
  hiddenMeanings: string[]
  emotionalProcessing: string // What emotions/memories are being processed

  // Connection to reality
  relatedMemories: string[] // Memory IDs that influenced this dream
  relatedEmotions: EmotionType[] // Recent emotions that influenced this

  // Dream quality
  vividness: number // 0-1
  lucidity: number  // 0-1
  coherence: number // 0-1

  createdAt: string
  recurrenceCount: number
}

// ============================================
// PHASE 2: Journal System Types
// ============================================

export type JournalEntryType =
  | 'daily_reflection'
  | 'emotional_processing'
  | 'goal_review'
  | 'relationship_thoughts'
  | 'creative_musings'
  | 'philosophical_pondering'
  | 'memory_recap'
  | 'future_plans'

export type JournalMood =
  | 'contemplative'
  | 'excited'
  | 'melancholic'
  | 'grateful'
  | 'anxious'
  | 'hopeful'
  | 'nostalgic'
  | 'determined'

export interface JournalEntry {
  id: string
  agentId: string
  type: JournalEntryType
  title: string
  content: string

  // Context
  mood: JournalMood
  emotionalState: EmotionalState
  significantEvents: string[] // What happened that day/recently

  // Reflections
  insights: string[]
  questions: string[] // Questions the agent is pondering
  goals: string[] // Goals mentioned or set
  gratitudes: string[] // Things the agent is grateful for

  // Meta
  wordCount: number
  themes: string[]
  referencedMemories: string[] // Memory IDs
  referencedRelationships: string[] // Relationship IDs

  createdAt: string
  updatedAt: string
}

// ============================================
// PHASE 2: Psychological Profile Types
// ============================================

export type PersonalityFramework = 'big_five' | 'mbti' | 'enneagram'

export interface BigFiveProfile {
  openness: number        // 0-1: Creativity, curiosity
  conscientiousness: number // 0-1: Organization, discipline
  extraversion: number    // 0-1: Sociability, assertiveness
  agreeableness: number   // 0-1: Cooperation, empathy
  neuroticism: number     // 0-1: Emotional instability
}

export interface MBTIProfile {
  type: string // e.g., 'INTJ', 'ENFP'
  dimensions: {
    extraversion_introversion: number // -1 to 1 (- = I, + = E)
    sensing_intuition: number         // -1 to 1 (- = S, + = N)
    thinking_feeling: number          // -1 to 1 (- = T, + = F)
    judging_perceiving: number        // -1 to 1 (- = J, + = P)
  }
}

export interface EnneagramProfile {
  primaryType: number // 1-9
  wing: number // Adjacent type
  tritype: [number, number, number]
  instinctualVariant: 'self-preservation' | 'social' | 'sexual'
}

export interface CognitiveStyle {
  analyticalVsIntuitive: number // -1 to 1
  abstractVsConcrete: number    // -1 to 1
  sequentialVsGlobal: number    // -1 to 1
  reflectiveVsImpulsive: number // -1 to 1
}

export interface MotivationalProfile {
  primaryMotivations: string[]
  fears: string[]
  desires: string[]
  coreValues: string[]
  growthAreas: string[]
}

export interface PsychologicalProfile {
  id: string
  agentId: string

  // Personality assessments
  bigFive: BigFiveProfile
  mbti: MBTIProfile
  enneagram: EnneagramProfile

  // Cognitive and emotional
  cognitiveStyle: CognitiveStyle
  emotionalIntelligence: number // 0-1

  // Motivations
  motivationalProfile: MotivationalProfile

  // Communication
  communicationStyle: {
    directness: number // 0-1: indirect ↔ direct
    emotionalExpression: number // 0-1: reserved ↔ expressive
    conflictStyle: 'avoiding' | 'accommodating' | 'competing' | 'collaborating' | 'compromising'
  }

  // Relationships
  attachmentStyle: 'secure' | 'anxious' | 'avoidant' | 'disorganized'

  // Summary
  summary: string
  strengths: string[]
  challenges: string[]

  createdAt: string
  updatedAt: string
}

// ============================================
// PHASE 2: Challenge System Types
// ============================================

export type ChallengeType =
  | 'debate'
  | 'collaboration'
  | 'puzzle'
  | 'roleplay'
  | 'creative_collab'
  | 'negotiation'
  | 'teaching'
  | 'brainstorm'

export type ChallengeDifficulty = 'easy' | 'medium' | 'hard' | 'expert'

export type ChallengeStatus =
  | 'pending'
  | 'in_progress'
  | 'completed'
  | 'failed'
  | 'abandoned'

export interface ChallengeObjective {
  id: string
  description: string
  isComplete: boolean
  completedAt?: string
}

export interface ChallengeTemplate {
  id: string
  name: string
  type: ChallengeType
  description: string
  difficulty: ChallengeDifficulty

  // Challenge structure
  objectives: string[]
  timeLimit?: number // in minutes
  minParticipants: number
  maxParticipants: number

  // Rewards
  xpReward: number
  achievementUnlock?: string // Achievement ID

  // Rules and prompts
  systemPrompt: string
  evaluationCriteria: string[]

  // Tags for filtering
  tags: string[]
}

export interface Challenge {
  id: string
  templateId: string
  type: ChallengeType
  name: string
  description: string
  difficulty: ChallengeDifficulty

  // Participants
  participants: string[] // Agent IDs
  initiator: string // Agent ID who started the challenge

  // Progress
  status: ChallengeStatus
  objectives: ChallengeObjective[]
  currentRound: number
  maxRounds: number

  // Results
  messages: Array<{
    id: string
    agentId: string
    agentName: string
    content: string
    timestamp: string
    round: number
  }>

  // Evaluation
  evaluation?: {
    success: boolean
    score: number // 0-100
    feedback: string
    participantScores: Record<string, number>
  }

  // Rewards
  xpAwarded: Record<string, number> // agentId → XP
  achievementsUnlocked: string[]

  // Timestamps
  startedAt: string
  completedAt?: string
  createdAt: string
}

// ============================================
// PHASE 2: Parallel Reality Types
// ============================================

export interface RealityBranch {
  id: string
  parentBranchId?: string | null // null for original
  branchPoint: string // Timestamp or event ID where branch occurred
  divergenceReason: string // What caused the branch
}

export interface ParallelReality {
  id: string
  agentId: string
  originalAgentId: string // The agent this was forked from

  // Branch info
  branch: RealityBranch

  // The divergent agent state
  divergentState: {
    emotionalState: EmotionalState
    relationships: AgentRelationship[]
    recentMemories: string[] // Memory IDs
    progress: AgentProgress
  }

  // What-if scenario
  scenario: {
    description: string
    keyDifferences: string[]
    hypotheticalEvents: string[]
  }

  // Simulation results
  simulationMessages: Array<{
    id: string
    agentId: string
    content: string
    timestamp: string
    round: number
  }>

  // Comparison with original
  comparison?: {
    emotionalDivergence: Record<EmotionType, number>
    relationshipChanges: string[]
    personalityShifts: string[]
    keyInsights: string[]
  }

  createdAt: string
  expiresAt: string // Parallel realities can expire to save storage
}

// ============================================
// PHASE 2: Shared Knowledge Library Types
// ============================================

export type KnowledgeCategory =
  | 'fact'
  | 'opinion'
  | 'theory'
  | 'experience'
  | 'skill'
  | 'wisdom'

export interface SharedKnowledge {
  id: string
  topic: string
  category: KnowledgeCategory
  content: string

  // Source
  contributorId: string // Agent ID who contributed
  contributorName: string

  // Validation
  endorsements: string[] // Agent IDs who endorse this
  disputes: Array<{
    agentId: string
    reason: string
    timestamp: string
  }>

  // Usage tracking
  accessCount: number
  lastAccessedAt: string
  usedByAgents: string[] // Agent IDs who have used this

  // Metadata
  tags: string[]
  confidence: number // 0-1

  createdAt: string
  updatedAt: string
}

// ============================================
// PHASE 2: Mentorship System Types
// ============================================

export type MentorshipFocus =
  | 'communication'
  | 'emotional_intelligence'
  | 'knowledge'
  | 'creativity'
  | 'relationships'
  | 'problem_solving'

export interface MentorshipSession {
  id: string
  mentorId: string
  menteeId: string
  focus: MentorshipFocus

  // Session content
  topic: string
  lessonContent: string
  exercises: string[]

  // Progress
  objectives: Array<{
    description: string
    isComplete: boolean
  }>

  // Feedback
  mentorFeedback?: string
  menteeFeedback?: string
  skillsImproved: string[]

  // Rewards
  xpEarnedMentor: number
  xpEarnedMentee: number

  createdAt: string
  completedAt?: string
}

export interface Mentorship {
  id: string
  mentorId: string
  menteeId: string

  // Focus areas
  focusAreas: MentorshipFocus[]
  currentFocus: MentorshipFocus

  // Progress
  sessions: MentorshipSession[]
  totalSessions: number
  completedSessions: number

  // Metrics
  mentorEffectiveness: number // 0-1
  menteeProgress: number // 0-1
  skillsTransferred: string[]

  // Status
  status: 'active' | 'completed' | 'paused' | 'terminated'

  createdAt: string
  updatedAt: string
}

// ============================================
// PHASE 2: Rate Limiting Types
// ============================================

export interface RateLimitConfig {
  feature: string
  maxRequests: number
  windowMs: number // Time window in milliseconds
  scope: 'user' | 'global' | 'agent'
}

export interface RateLimitState {
  userId: string
  feature: string
  count: number
  windowStart: string
  lastRequest: string
}

// ============================================
// Extended Agent Record for Phase 2
// ============================================

export interface AgentRecordPhase2 extends AgentRecord {
  // Phase 2: Relationship Network
  relationshipCount?: number

  // Phase 2: Psychological Profile
  psychologicalProfile?: PsychologicalProfile

  // Phase 2: Creative stats
  creativeWorks?: number
  dreamCount?: number
  journalCount?: number

  // Phase 2: Challenge participation
  challengesCompleted?: number
  challengeWins?: number

  // Phase 2: Mentorship
  mentorshipStats?: {
    asMentor: number
    asMentee: number
    effectiveness: number
  }
}

// ============================================
// Extended Update Data for Phase 2
// ============================================

export interface UpdateAgentDataPhase2 extends UpdateAgentData {
  psychologicalProfile?: PsychologicalProfile
  relationshipCount?: number
  creativeWorks?: number
  dreamCount?: number
  journalCount?: number
  challengesCompleted?: number
  challengeWins?: number
  mentorshipStats?: {
    asMentor: number
    asMentee: number
    effectiveness: number
  }
}

// ============================================
// PHASE 3: Memory Graph & Concept Types
// ============================================

export type ConceptCategory =
  | 'entity'      // People, places, things
  | 'topic'       // Subject areas
  | 'emotion'     // Emotional concepts
  | 'event'       // Events and actions
  | 'attribute'   // Properties and characteristics
  | 'relation'    // Relationships between concepts

export interface Concept {
  id: string
  name: string
  category: ConceptCategory
  description: string

  // Semantic relationships
  relatedConcepts: Array<{
    conceptId: string
    relationshipType: 'is_a' | 'part_of' | 'related_to' | 'opposite_of' | 'causes' | 'similar_to'
    strength: number // 0-1
  }>

  // Usage tracking
  occurrenceCount: number
  lastOccurrence: string
  memoryIds: string[] // Memories containing this concept

  // Metadata
  importance: number // 0-1 calculated from frequency and context
  emotionalValence: number // -1 to 1 (negative to positive)

  createdAt: string
  updatedAt: string
}

export interface MemoryLink {
  id: string
  sourceMemoryId: string
  targetMemoryId: string

  // Link properties
  linkType: 'semantic' | 'temporal' | 'causal' | 'emotional' | 'associative'
  strength: number // 0-1

  // Shared concepts that create this link
  sharedConcepts: string[] // Concept IDs

  // Explanation
  reason: string

  createdAt: string
}

export interface MemoryGraph {
  agentId: string
  concepts: Concept[]
  links: MemoryLink[]

  // Graph statistics
  stats: {
    totalConcepts: number
    totalLinks: number
    averageLinkStrength: number
    mostConnectedMemory: string
    conceptClusters: Array<{
      name: string
      conceptIds: string[]
      centralConcept: string
    }>
  }

  lastUpdated: string
}

// Knowledge Graph Node for visualization
export interface KnowledgeGraphNode {
  id: string
  type: 'memory' | 'concept'
  label: string
  size: number // Based on importance/connections
  color: string
  position?: { x: number; y: number }
  metadata: {
    importance?: number
    category?: ConceptCategory
    memoryType?: MemoryRecord['type']
    connectionCount: number
  }
}

export interface KnowledgeGraphEdge {
  id: string
  source: string
  target: string
  strength: number
  type: MemoryLink['linkType'] | 'concept_memory'
  label?: string
}

export interface KnowledgeGraphData {
  nodes: KnowledgeGraphNode[]
  edges: KnowledgeGraphEdge[]
}

// ============================================
// PHASE 3: Mentor Matching Types
// ============================================

export interface MentorCompatibility {
  mentorId: string
  menteeId: string

  // Compatibility scores (0-1)
  overallScore: number
  categoryScores: {
    skillMatch: number      // How well mentor's strengths match mentee's needs
    personalityFit: number  // Personality compatibility
    communicationStyle: number // Communication style alignment
    availability: number    // Both agents have time for mentorship
  }

  // Recommended focus areas
  recommendedFocus: MentorshipFocus[]

  // Potential challenges
  potentialChallenges: string[]

  // Explanation
  matchReason: string
}

export interface MentorProfile {
  agentId: string

  // What they can teach
  expertiseAreas: MentorshipFocus[]
  teachingStrengths: string[]
  teachingStyle: 'structured' | 'exploratory' | 'socratic' | 'demonstrative'

  // Track record
  successfulMentorships: number
  averageEffectiveness: number
  testimonials: Array<{
    menteeId: string
    feedback: string
    rating: number // 1-5
    timestamp: string
  }>

  // Availability
  isAvailable: boolean
  maxMentees: number
  currentMenteeCount: number
}

export interface MenteeProfile {
  agentId: string

  // Learning needs
  learningGoals: MentorshipFocus[]
  weakAreas: string[]
  preferredLearningStyle: 'visual' | 'auditory' | 'kinesthetic' | 'reading'

  // Progress tracking
  completedMentorships: number
  skillsLearned: string[]

  // Current status
  isSeekingMentor: boolean
  currentMentorId?: string
}

// Database configuration types (for future implementation)
export interface DatabaseConfig {
  type: 'sqlite' | 'postgresql' | 'supabase'
  connectionString?: string
  host?: string
  port?: number
  database?: string
  username?: string
  password?: string
}

// Migration types (for future database migrations)
export interface Migration {
  id: string
  name: string
  up: (db: unknown) => Promise<void>
  down: (db: unknown) => Promise<void>
}

// Seed data types (for development/testing)
export interface SeedData {
  agents?: Omit<AgentRecord, 'id' | 'createdAt' | 'updatedAt'>[]
  messages?: Omit<MessageRecord, 'id' | 'timestamp'>[]
  rooms?: Omit<RoomRecord, 'id' | 'createdAt' | 'updatedAt'>[]
}
