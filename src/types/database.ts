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
  types: TimelineEventType[] | ['all']
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
