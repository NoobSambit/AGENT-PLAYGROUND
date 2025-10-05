// Database schema types and interfaces
// These represent the structure for Firebase Firestore implementation

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
