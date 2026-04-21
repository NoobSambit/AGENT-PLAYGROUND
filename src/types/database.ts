import type {
  OutputArtifactRole,
  OutputQualityEvaluationReport,
  OutputNormalizationStatus,
  OutputQualityRawModelOutput,
  OutputQualitySourceRef,
  OutputQualityStatus,
  OutputQualityTrackedFields,
  OutputQualityValidationReport,
  SemanticMemoryFields,
} from './outputQuality'

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

export type EmotionalStateStatus = 'dormant' | 'active'
export type EmotionalEventPhase = 'appraisal' | 'response' | 'reflection' | 'internal' | 'system'
export type EmotionalEventSource =
  | 'user_message'
  | 'agent_response'
  | 'journal_entry'
  | 'creative_generation'
  | 'dream_generation'
  | 'relationship_shift'
  | 'memory_recall'
  | 'legacy_reset'
  | 'system'

export interface EmotionalProfile {
  temperament: Record<EmotionType, number> // Stable tendencies derived from persona and traits
  sensitivity: number // 0-1 how strongly the agent reacts to stimuli
  resilience: number // 0-1 how quickly the agent settles after activation
  expressiveness: number // 0-1 how much mood should influence delivery
  optimism: number // 0-1 positive ↔ guarded baseline outlook
  lastDerivedAt: string // ISO timestamp
}

export interface EmotionalState {
  currentMood: Record<EmotionType, number> // 0-1 for each emotion
  status: EmotionalStateStatus
  lastUpdated: string // ISO timestamp
  dominantEmotion: EmotionType | null
}

export interface EmotionalEvent {
  id: string
  emotion: EmotionType
  dominantEmotion?: EmotionType
  topEmotions?: Array<{ emotion: EmotionType; intensity: number }>
  intensity: number // 0-1 resulting level after the shift
  delta: number // Signed change applied to the live state
  phase: EmotionalEventPhase
  source: EmotionalEventSource
  trigger: string // Human-readable trigger label
  explanation: string // Why the agent changed
  confidence: number // 0-1 confidence in the appraisal
  rationale?: string[]
  triggers?: string[]
  counterSignals?: string[]
  context: string // Conversation snippet or description
  timestamp: string // ISO timestamp
  linkedMessageId?: string
  linkedActionId?: string
  linkedMemoryIds?: string[]
  evidenceRefs?: string[]
  downstreamHints?: Array<{
    feature: 'journal' | 'dream' | 'scenario'
    hint: string
    reason: string
  }>
  metadata?: Record<string, unknown>
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
// PHASE 1: Emotion Types
// ============================================

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
  emotionalProfile?: EmotionalProfile
  emotionalState?: EmotionalState
  emotionalHistory?: EmotionalEvent[] // Max 20 events

  stats?: AgentStats

  // Phase 2: Psychological Profile
  psychologicalProfile?: PsychologicalProfile

  // Phase 2: Stats counters
  relationshipCount?: number
  creativeWorks?: number
  dreamCount?: number
  journalCount?: number
  activeDreamImpression?: DreamImpression | null
  challengesCompleted?: number
  challengeWins?: number
  mentorshipStats?: {
    asMentor: number
    asMentee: number
    effectiveness: number
  }
}

export type MemoryType =
  | 'conversation'
  | 'conversation_episode'
  | 'fact'
  | 'interaction'
  | 'personality_insight'
  | 'preference'
  | 'project'
  | 'relationship'
  | 'identity'
  | 'operating_constraint'
  | 'artifact_summary'
  | 'tension_snapshot'
export type MemoryOrigin = 'conversation' | 'tool' | 'manual' | 'system' | 'imported'

export interface MemoryRecord extends OutputQualityTrackedFields, SemanticMemoryFields {
  id: string
  agentId: string
  type: MemoryType
  content: string // The actual memory content
  summary: string // AI-generated summary for quick recall
  keywords: string[] // Array of keywords for relevance matching
  importance: number // 1-10 scale of how important this memory is
  context: string // Context where this memory was formed (e.g., "user complimented agent")
  timestamp: string // ISO timestamp
  origin: MemoryOrigin
  linkedMessageIds: string[]
  metadata?: Record<string, unknown> // Additional metadata (e.g., message IDs, interaction types)
  userId?: string // For multi-user support
  isActive: boolean // For soft delete functionality
}

export interface PersonalityTraitDelta {
  trait: string
  before?: number | null
  after?: number | null
  delta?: number | null
  confidence?: number
  score?: number
  indicators?: string[]
}

export interface PersonalityEventRecord {
  id: string
  agentId: string
  source: 'conversation' | 'migration' | 'manual' | 'system'
  trigger: string
  summary: string
  traitDeltas: PersonalityTraitDelta[]
  beforeTraits?: Record<string, number>
  afterTraits?: Record<string, number>
  linkedMessageIds: string[]
  metadata?: Record<string, unknown>
  createdAt: string
}

export interface MemoryListQuery {
  searchQuery?: string
  type?: MemoryType | 'all'
  origin?: MemoryOrigin | 'all'
  minImportance?: number
  sort?: 'newest' | 'oldest' | 'importance'
  limit?: number
  before?: string
  beforeId?: string
}

export interface MemoryStatsSummary {
  totalMemories: number
  memoriesByType: Record<string, number>
  memoriesByOrigin: Record<string, number>
  averageImportance: number
  highImportanceMemories: number
  oldestMemory?: string
  newestMemory?: string
  lastSavedAt?: string
}

export interface MemoryRecallResult {
  memory: MemoryRecord
  score: number
  reasons: string[]
  hitType: 'semantic' | 'episode'
  matchedConcepts?: string[]
}

export interface MemoryGraphConsoleSummary {
  totalConcepts: number
  totalLinks: number
  lastUpdated?: string
  topConcepts: Array<{
    id: string
    name: string
    category: ConceptCategory
    importance: number
    memoryCount: number
  }>
  conceptClusters: Array<{
    name: string
    centralConcept: string
    conceptIds: string[]
  }>
}

export type MessageRenderBlock =
  | { type: 'heading'; level: 1 | 2 | 3; text: string }
  | { type: 'paragraph'; text: string }
  | { type: 'blockquote'; text: string }
  | { type: 'unordered_list'; items: string[] }
  | { type: 'ordered_list'; items: string[] }
  | { type: 'code'; language?: string; code: string }

export interface MessageRenderData {
  version: 1
  format: 'blocks-v1'
  sourceFormat: 'markdown-v1'
  blocks: MessageRenderBlock[]
}

export interface MessageMetadata {
  format?: 'plain-text-v1' | 'markdown-v1' | 'blocks-v1'
  render?: MessageRenderData
  langchain?: boolean
  reasoning?: string
  toolsUsed?: string[]
  memoryUsed?: number
  model?: string
  provider?: string
  emotionSummary?: unknown
  emotionEvents?: unknown[]
  dreamImpression?: {
    sourceDreamId: string
    behaviorTilt: DreamBehaviorTilt
    expiresAt: string
  }
  [key: string]: unknown
}

export interface MessageRecord {
  id: string
  agentId: string
  content: string
  type: 'user' | 'agent' | 'system'
  timestamp: string // ISO timestamp
  roomId?: string // For multi-agent conversations
  metadata?: MessageMetadata // JSON object for additional message data
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
    metadata?: Record<string, unknown>
  }>
  maxRounds: number
  createdAt: string // ISO timestamp
  isComplete: boolean
  finalRound: number
  metadata?: Record<string, unknown>
}

export type SimulationDocument = Omit<SimulationRecord, 'id'>

export type ArenaRunStatus = 'draft' | 'running' | 'completed' | 'failed' | 'cancelled'
export type ArenaStage =
  | 'prepare'
  | 'seat_generation'
  | 'opening'
  | 'crossfire'
  | 'narrowing'
  | 'closing'
  | 'report'
  | 'completed'
export type ArenaResponseBudget = 'tight' | 'balanced' | 'expanded'
export type ArenaSpeakerType = 'head' | 'debater' | 'system'
export type ArenaEventKind =
  | 'run_prepared'
  | 'seat_generated'
  | 'phase_started'
  | 'head_directive'
  | 'debater_turn'
  | 'head_intervention'
  | 'round_summary'
  | 'score_update'
  | 'phase_completed'
  | 'report_published'
  | 'run_cancelled'
  | 'run_failed'

export interface ArenaSeatOverride {
  agentId: string
  seatLabel?: string
  stanceBrief?: string
  winCondition?: string
}

export interface ArenaConfig {
  topic: string
  objective: string
  participantIds: string[]
  roundCount: number
  responseBudget: ArenaResponseBudget
  sandboxed: boolean
  mode: 'debate_v1'
  provider?: string
  model?: string
  referenceBrief?: string
  seatOverrides?: ArenaSeatOverride[]
}

export interface ArenaParticipant {
  id: string
  name: string
  persona: string
  goals: string[]
}

export interface ArenaSeat {
  agentId: string
  agentName: string
  seatLabel: string
  stanceBrief: string
  winCondition: string
  orderIndex: number
  source: 'auto' | 'manual'
}

export interface ArenaScorecard {
  agentId: string
  agentName: string
  clarity: number
  pressure: number
  responsiveness: number
  consistency: number
  total: number
  summary: string
}

export interface ArenaParticipantNotebook {
  agentId: string
  commitments: string[]
  attacksToAnswer: string[]
  concessions: string[]
  nextPressurePoints: string[]
  lastUpdatedAt: string
}

export interface ArenaLedgerRound {
  round: number
  phase: ArenaStage
  focusQuestion: string
  claimHighlights: Array<{
    agentId: string
    agentName: string
    claim: string
  }>
  unresolvedThreads: string[]
  scoreSnapshot: ArenaScorecard[]
  summary: string
}

export interface ArenaLedger {
  rounds: ArenaLedgerRound[]
  unresolvedThreads: string[]
  latestDirective?: string
  latestFocusQuestion?: string
}

export interface ArenaDecisiveMoment {
  eventId: string
  round: number
  title: string
  summary: string
  agentId?: string
  agentName?: string
}

export interface ArenaReport {
  winnerAgentId: string
  winnerAgentName: string
  verdictSummary: string
  scorecards: ArenaScorecard[]
  decisiveMoments: ArenaDecisiveMoment[]
  headInterventionSummary: string[]
  unresolvedQuestions: string[]
  improvementNotes: string[]
  createdAt: string
}

export interface ArenaEvent {
  id: string
  runId: string
  sequence: number
  stage: ArenaStage
  kind: ArenaEventKind
  speakerType: ArenaSpeakerType
  speakerAgentId?: string
  speakerName?: string
  round?: number
  title: string
  content: string
  summary: string
  payload?: Record<string, unknown>
  createdAt: string
}

export interface ArenaRun {
  id: string
  status: ArenaRunStatus
  latestStage: ArenaStage
  currentRound: number
  eventCount: number
  participantIds: string[]
  participants: ArenaParticipant[]
  config: ArenaConfig
  seats: ArenaSeat[]
  scorecardSnapshot: ArenaScorecard[]
  ledger: ArenaLedger
  participantNotebooks: ArenaParticipantNotebook[]
  finalReport?: ArenaReport
  winnerAgentId?: string
  sandboxed: boolean
  cancellationRequested: boolean
  provider?: string
  model?: string
  failureReason?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface ArenaRunSummary {
  id: string
  status: ArenaRunStatus
  latestStage: ArenaStage
  topic: string
  objective: string
  participantNames: string[]
  roundCount: number
  currentRound: number
  winnerAgentName?: string
  eventCount: number
  provider?: string
  model?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export type ArenaRunDocument = Omit<ArenaRun, 'id'>
export type ArenaEventDocument = Omit<ArenaEvent, 'id'>

export type ScenarioBranchPointKind = 'message' | 'memory' | 'relationship_event' | 'simulation_turn'

export interface ScenarioBranchPoint {
  kind: ScenarioBranchPointKind
  id: string
  timestamp: string
  title: string
  summary: string
  fullContent?: string
  sourceMessageId?: string
  relatedAgentId?: string
  relatedAgentName?: string
  sourceRunId?: string
}

export type ScenarioInterventionType =
  | 'rewrite_reply'
  | 'emotion_shift'
  | 'relationship_shift'
  | 'memory_injection'
  | 'goal_outcome'

export interface ScenarioIntervention {
  type: ScenarioInterventionType
  label: string
  description: string
  responseStyle?: 'warmer' | 'more direct' | 'more skeptical' | 'more collaborative'
  targetEmotion?: EmotionType
  emotionIntensity?: 'low' | 'medium' | 'high'
  counterpartId?: string
  counterpartName?: string
  trustDelta?: number
  respectDelta?: number
  memoryText?: string
  goal?: string
  forcedOutcome?: 'succeeds' | 'fails'
  rationale?: string
}

export interface ScenarioProbeQualityReport {
  pass: boolean
  score: number
  actionabilityScore: number
  genericnessScore: number
  directnessScore: number
  responseLength: number
  flags: string[]
  blockerReasons: string[]
  softWarnings: string[]
  evaluatorSummary: string
  repairAttempted?: boolean
  repairSucceeded?: boolean
  similarityToCounterpart?: number
}

export interface ScenarioProbeSetEntry {
  label: string
  prompt: string
}

export interface ScenarioTurnResult {
  id: string
  probeLabel: string
  probePrompt: string
  baselineResponse: string
  alternateResponse: string
  baselineQuality?: ScenarioProbeQualityReport
  alternateQuality?: ScenarioProbeQualityReport
  qualityFlags?: string[]
  baselineEmotion: EmotionalState
  alternateEmotion: EmotionalState
  divergenceNotes: string[]
  divergenceScore?: number
  materiallyDifferent?: boolean
  repair?: {
    attempted: boolean
    repairedResponses: Array<'baseline' | 'alternate'>
    notes: string[]
  }
}

export interface ScenarioComparison {
  firstDivergence: string
  baselineSummary: string
  alternateSummary: string
  keyDifferences: string[]
  recommendation: string
  riskNotes: string[]
  qualityNotes: string[]
  qualityScore: {
    baseline: number
    alternate: number
  }
  outcomeScore: {
    baseline: number
    alternate: number
  }
  qualityBreakdown: {
    baseline: {
      clarity: number
      warmth: number
      specificity: number
      consistency: number
    }
    alternate: {
      clarity: number
      warmth: number
      specificity: number
      consistency: number
    }
  }
  qualityFlags: {
    baseline: string[]
    alternate: string[]
  }
  diffHighlights: Array<{
    label: string
    baseline: string
    alternate: string
  }>
  nextActionRecommendation?: string
}

export interface ScenarioAnalyticsSummary {
  totalRuns: number
  averageAlternateScore: number
  bestInterventions: Array<{
    label: string
    winRate: number
    averageGain: number
  }>
  commonQualityFlags: string[]
  recommendedPlaybook: string[]
}

export interface ScenarioRunRecord {
  id: string
  agentId: string
  agentName: string
  status: 'draft' | 'running' | 'complete' | 'failed'
  qualityStatus?: OutputQualityStatus
  qualityScore?: number
  failureReason?: string
  promptVersion?: string
  rawModelOutput?: OutputQualityRawModelOutput
  validation?: OutputQualityValidationReport
  evaluation?: OutputQualityEvaluationReport
  sourceRefs?: OutputQualitySourceRef[]
  branchPoint: ScenarioBranchPoint
  intervention: ScenarioIntervention
  probeSet?: ScenarioProbeSetEntry[]
  branchContext: {
    recentMessages: Array<{
      id: string
      role: 'user' | 'assistant'
      content: string
      timestamp: string
    }>
    relevantMemories: Array<{
      id: string
      summary: string
      importance: number
      timestamp: string
      type?: MemoryRecord['type']
      hitType?: 'semantic' | 'episode'
      canonicalValue?: string
    }>
    semanticMemories?: Array<{
      id: string
      type: MemoryRecord['type']
      summary: string
      canonicalValue?: string
      confidence?: number
      reason: string
    }>
    learningAdaptations?: Array<{
      id: string
      description: string
      instruction?: string
      confidence?: number
      impactScore: number
    }>
    relationshipSummary?: string
    learningPromptContext?: string
  }
  baselineState: {
    emotionalState: EmotionalState
    dominantEmotion: EmotionType | null
  }
  alternateState: {
    emotionalState: EmotionalState
    dominantEmotion: EmotionType | null
    injectedContext: string[]
  }
  turns: ScenarioTurnResult[]
  comparison: ScenarioComparison
  metadata?: {
    provider?: string
    model?: string
    maxTurns?: number
    generatedAt?: string
  }
  createdAt: string
  updatedAt: string
}

export type ScenarioRunDocument = Omit<ScenarioRunRecord, 'id'>

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
  metadata?: MessageMetadata
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
  updatedAt?: string
  settings?: Record<string, unknown>
  coreTraits?: Record<string, number>
  dynamicTraits?: Record<string, number>
  memoryCount?: number
  totalInteractions?: number
  // Phase 1 fields
  linguisticProfile?: LinguisticProfile
  emotionalProfile?: EmotionalProfile
  emotionalState?: EmotionalState
  emotionalHistory?: EmotionalEvent[]
  stats?: AgentStats
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

export interface CreateMemoryData {
  agentId: string
  type: MemoryType
  content: string
  summary: string
  keywords: string[]
  importance: number
  context: string
  origin?: MemoryOrigin
  linkedMessageIds?: string[]
  canonicalKey?: string
  canonicalValue?: string
  confidence?: number
  evidenceRefs?: string[]
  supersedes?: string[]
  lastConfirmedAt?: string
  metadata?: Record<string, unknown>
  userId?: string
}

export interface UpdateMemoryData {
  content?: string
  summary?: string
  keywords?: string[]
  importance?: number
  context?: string
  origin?: MemoryOrigin
  linkedMessageIds?: string[]
  canonicalKey?: string
  canonicalValue?: string
  confidence?: number
  evidenceRefs?: string[]
  supersedes?: string[]
  lastConfirmedAt?: string
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
// PHASE 2: Creative Studio Types
// ============================================

export type CreativeFormat =
  | 'story'
  | 'poem'
  | 'song'
  | 'dialogue'
  | 'essay'

export type CreativeTone =
  | 'cinematic'
  | 'lyrical'
  | 'playful'
  | 'intimate'
  | 'dramatic'
  | 'philosophical'
  | 'experimental'
  | 'hopeful'
  | 'melancholic'

export type CreativeLength = 'short' | 'medium' | 'long'

export type CreativeSessionStatus =
  | 'draft'
  | 'generating'
  | 'ready'
  | 'published'
  | 'failed'

export type CreativeArtifactStatus =
  | 'draft'
  | 'revised'
  | 'published'

export type CreativePipelineStage =
  | 'brief_normalized'
  | 'context_selected'
  | 'draft_generated'
  | 'draft_evaluated'
  | 'revision_generated'
  | 'ready'
  | 'published'
  | 'failed'

export type CreativeContextSourceType =
  | 'persona'
  | 'goal'
  | 'linguistic_profile'
  | 'psychological_profile'
  | 'emotion'
  | 'emotional_history'
  | 'message'
  | 'memory'
  | 'learning'
  | 'journal'
  | 'dream'
  | 'motif'

export type CreativeRubricDimension =
  | 'formatFidelity'
  | 'originality'
  | 'voiceConsistency'
  | 'emotionalCoherence'
  | 'specificity'
  | 'readability'

export interface CreativeBrief {
  format: CreativeFormat
  intent: string
  audience: string
  tone: CreativeTone
  length: CreativeLength
  mustInclude: string[]
  avoid: string[]
  referenceNotes: string
  rawPrompt?: string
}

export interface CreativeContextSignal {
  id: string
  sourceType: CreativeContextSourceType
  label: string
  snippet: string
  reason: string
  weight: number
  linkedEntityId?: string
}

export interface CreativeContextPacket {
  dominantEmotion?: EmotionType | null
  emotionalSummary: string
  voiceDirectives: string[]
  psychologicalDirectives: string[]
  dreamDirectives?: string[]
  continuityMotifs: string[]
  selectedSignals: CreativeContextSignal[]
}

export interface CreativeRubricScore {
  score: number
  rationale: string
}

export interface CreativeRubricEvaluation {
  pass: boolean
  overallScore: number
  dimensions: Record<CreativeRubricDimension, CreativeRubricScore>
  hardFailureFlags?: string[]
  strengths: string[]
  weaknesses: string[]
  repairInstructions: string[]
  evaluatorSummary: string
}

export interface CreativeArtifact {
  id: string
  agentId: string
  sessionId: string
  format: CreativeFormat
  status: CreativeArtifactStatus
  artifactRole?: OutputArtifactRole
  normalizationStatus?: OutputNormalizationStatus
  qualityStatus?: OutputQualityStatus
  qualityScore?: number
  promptVersion?: string
  repairCount?: number
  rawModelOutput?: OutputQualityRawModelOutput
  normalization?: OutputQualityTrackedFields['normalization']
  validation?: OutputQualityValidationReport
  sourceRefs?: OutputQualitySourceRef[]
  sourceArtifactId?: string
  version: number
  title: string
  summary: string
  content: string
  render: MessageRenderData
  themes: string[]
  inspiration: string
  audience: string
  tone: CreativeTone
  wordCount: number
  provider?: string
  model?: string
  evaluation?: CreativeRubricEvaluation
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export interface CreativePipelineEvent {
  id: string
  sessionId: string
  stage: CreativePipelineStage
  status: 'completed' | 'skipped' | 'failed'
  summary: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface CreativeSession {
  id: string
  agentId: string
  status: CreativeSessionStatus
  qualityStatus?: OutputQualityStatus
  repairCount?: number
  promptVersion?: string
  rawModelOutput?: OutputQualityRawModelOutput
  validation?: OutputQualityValidationReport
  sourceRefs?: OutputQualitySourceRef[]
  failureReason?: string
  brief: CreativeBrief
  normalizedBrief: CreativeBrief
  contextPacket?: CreativeContextPacket
  latestEvaluation?: CreativeRubricEvaluation
  draftArtifactId?: string
  finalArtifactId?: string
  publishedArtifactId?: string
  provider?: string
  model?: string
  createdAt: string
  updatedAt: string
  publishedAt?: string
}

export interface CreativeLibraryItem {
  session: CreativeSession
  artifact: CreativeArtifact
}

// ============================================
// PHASE 2: Dream System Types
// ============================================

export type DreamType =
  | 'symbolic'
  | 'nightmare'
  | 'memory_replay'
  | 'prophetic'
  | 'lucid'
  | 'recurring'

export type DreamFocus = 'memory' | 'emotion' | 'future' | 'relationship' | 'conflict'

export type DreamSessionStatus =
  | 'draft'
  | 'generating'
  | 'ready'
  | 'saved'
  | 'failed'

export type DreamStatus =
  | 'draft'
  | 'repaired'
  | 'saved'
  | 'failed'

export type DreamPipelineStage =
  | 'prepare_context'
  | 'condition_subconscious'
  | 'draft_dream'
  | 'extract_symbols'
  | 'evaluate_quality'
  | 'repair_dream'
  | 'derive_impression'
  | 'ready'
  | 'saved'
  | 'failed'

export type DreamContextSourceType =
  | 'persona'
  | 'goal'
  | 'linguistic_profile'
  | 'psychological_profile'
  | 'emotion'
  | 'emotional_temperament'
  | 'emotional_history'
  | 'message'
  | 'memory'
  | 'journal'
  | 'dream'
  | 'relationship'
  | 'dream_impression'

export type DreamQualityDimension =
  | 'imageryVividness'
  | 'symbolicCoherence'
  | 'psychologicalGrounding'
  | 'agentSpecificity'
  | 'narrativeClarity'
  | 'interpretiveUsefulness'

export type DreamHardFailureFlag =
  | 'generic_fantasy_filler'
  | 'schema_leakage'
  | 'weak_symbolism'
  | 'disconnected_agent_context'
  | 'incoherent_scene_progression'
  | 'unusable_interpretation'

export type DreamBehaviorTilt =
  | 'reflective'
  | 'cautious'
  | 'anticipatory'
  | 'agentic'
  | 'fixated'

export interface DreamRubricScore {
  score: number
  rationale: string
}

export interface DreamQualityEvaluation {
  pass: boolean
  overallScore: number
  dimensions: Record<DreamQualityDimension, DreamRubricScore>
  hardFailureFlags: DreamHardFailureFlag[]
  strengths: string[]
  weaknesses: string[]
  repairInstructions: string[]
  evaluatorSummary: string
}

export interface DreamContextSignal {
  id: string
  sourceType: DreamContextSourceType
  label: string
  snippet: string
  reason: string
  weight: number
  linkedEntityId?: string
}

export interface DreamContextReference {
  sourceType: DreamContextSourceType
  label: string
  linkedEntityId?: string
}

export interface DreamScene {
  id: string
  heading: string
  summary: string
  body: string
  symbols: string[]
  emotions: EmotionType[]
}

export interface DreamSymbol {
  symbol: string
  meaning: string
  evidence: string
  emotionalAssociation?: EmotionType
}

export interface DreamLatentTension {
  tension: string
  whyItMatters: string
}

export interface DreamInterpretation {
  summary: string
  insights: string[]
  cautions: string[]
  openLoops: string[]
}

export interface DreamImpression {
  sourceDreamId: string
  summary: string
  guidance: string
  behaviorTilt: DreamBehaviorTilt
  dominantThemes: string[]
  expiresAt: string
  createdAt: string
}

export interface DreamDisplayMetrics {
  imageryVividness: number
  symbolicCoherence: number
  psychologicalGrounding: number
  narrativeClarity: number
  interpretiveUsefulness: number
  lucidity: number
  coherence: number
}

export interface DreamComposeInput {
  type: DreamType
  userNote?: string
  focus?: DreamFocus[]
}

export interface DreamSession {
  id: string
  agentId: string
  status: DreamSessionStatus
  qualityStatus?: OutputQualityStatus
  repairCount?: number
  promptVersion?: string
  rawModelOutput?: OutputQualityRawModelOutput
  validation?: OutputQualityValidationReport
  sourceRefs?: OutputQualitySourceRef[]
  latestStage: DreamPipelineStage
  type: DreamType
  normalizedInput: DreamComposeInput
  contextPacket?: {
    selectedSignals: DreamContextSignal[]
    summary: string
    dominantEmotion?: EmotionType | null
    recurringThemes: string[]
    recurringSymbols: string[]
    activeDreamImpression?: DreamImpression | null
  }
  latestEvaluation?: DreamQualityEvaluation
  finalDreamId?: string
  provider?: string
  model?: string
  failureReason?: string
  createdAt: string
  updatedAt: string
  savedAt?: string
}

export interface Dream {
  id: string
  agentId: string
  sessionId: string
  type: DreamType
  status: DreamStatus
  artifactRole?: OutputArtifactRole
  normalizationStatus?: OutputNormalizationStatus
  qualityStatus?: OutputQualityStatus
  qualityScore?: number
  promptVersion?: string
  repairCount?: number
  rawModelOutput?: OutputQualityRawModelOutput
  normalization?: OutputQualityTrackedFields['normalization']
  validation?: OutputQualityValidationReport
  sourceRefs?: OutputQualitySourceRef[]
  sourceDreamId?: string
  version: number
  title: string
  summary: string
  render: MessageRenderData
  scenes: DreamScene[]
  symbols: DreamSymbol[]
  themes: string[]
  latentTensions: DreamLatentTension[]
  interpretation: DreamInterpretation
  emotionalProcessing: string
  impression?: DreamImpression
  impressionPreview?: Omit<DreamImpression, 'sourceDreamId'>
  evaluation?: DreamQualityEvaluation
  contextReferences: DreamContextReference[]
  displayMetrics: DreamDisplayMetrics
  provider?: string
  model?: string
  createdAt: string
  updatedAt: string
  savedAt?: string
}

export interface DreamPipelineEvent {
  id: string
  sessionId: string
  stage: DreamPipelineStage
  status: 'completed' | 'active' | 'skipped' | 'failed'
  summary: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface DreamBootstrapPayload {
  agent: {
    id: string
    name: string
    dreamCount: number
  }
  availableTypes: DreamType[]
  suggestedType: DreamType
  defaults: {
    userNote: string
    focus: DreamFocus[]
  }
  activeDreamImpression?: DreamImpression | null
  recentSessions: DreamSession[]
  recentSavedDreams: Dream[]
  archiveMetrics: {
    totalSavedDreams: number
    totalSessions: number
    readyToSaveCount: number
    failedSessions: number
    nightmareRatio: number
    recurringSymbols: Array<{ symbol: string; count: number }>
    recurringThemes: Array<{ theme: string; count: number }>
  }
  archiveFilters: {
    types: DreamType[]
  }
}

export interface DreamSessionDetail {
  session: DreamSession | null
  dreams: Dream[]
  pipelineEvents: DreamPipelineEvent[]
}

// ============================================
// PHASE 2: Journal System Types
// ============================================

export type JournalEntryType =
  | 'daily_reflection'
  | 'emotional_processing'
  | 'goal_alignment'
  | 'relationship_checkpoint'
  | 'memory_revisit'
  | 'idea_capture'

export type JournalFocus = 'emotion' | 'memory' | 'relationship' | 'goal' | 'continuity'

export type JournalSessionStatus =
  | 'draft'
  | 'generating'
  | 'ready'
  | 'saved'
  | 'failed'

export type JournalEntryStatus =
  | 'draft'
  | 'repaired'
  | 'saved'
  | 'failed'

export type JournalPipelineStage =
  | 'prepare_context'
  | 'condition_voice'
  | 'draft_entry'
  | 'evaluate_quality'
  | 'repair_entry'
  | 'ready'
  | 'saved'
  | 'failed'

export type JournalContextSourceType =
  | 'persona'
  | 'goal'
  | 'linguistic_profile'
  | 'psychological_profile'
  | 'emotion'
  | 'emotional_temperament'
  | 'emotional_history'
  | 'communication_fingerprint'
  | 'memory'
  | 'message'
  | 'relationship'
  | 'journal'

export type JournalQualityDimension =
  | 'voiceConsistency'
  | 'emotionalAuthenticity'
  | 'reflectionDepth'
  | 'specificityGrounding'
  | 'continuity'
  | 'readability'

export type JournalHardFailureFlag =
  | 'generic_assistant_phrasing'
  | 'prompt_or_schema_leakage'
  | 'shallow_filler'
  | 'wrong_entry_type_behavior'
  | 'contradiction_with_agent_state'
  | 'poor_context_grounding'

export interface JournalRubricScore {
  score: number
  rationale: string
}

export interface JournalQualityEvaluation {
  pass: boolean
  overallScore: number
  dimensions: Record<JournalQualityDimension, JournalRubricScore>
  hardFailureFlags: JournalHardFailureFlag[]
  strengths: string[]
  weaknesses: string[]
  repairInstructions: string[]
  evaluatorSummary: string
}

export interface JournalStructuredReflection {
  insights: string[]
  openQuestions: string[]
  nextActions: string[]
  gratitudes: string[]
  themes: string[]
  referencedEntities: string[]
  conciseSummary: string
}

export interface JournalContextSignal {
  id: string
  sourceType: JournalContextSourceType
  label: string
  snippet: string
  reason: string
  weight: number
  linkedEntityId?: string
}

export interface JournalVoicePacket {
  personaSummary: string
  goals: string[]
  linguisticProfileSummary: string
  psychologicalProfileSummary: string
  communicationStyleSummary: string
  emotionalStateSummary: string
  emotionalTemperamentSummary: string
  recentEmotionalHistorySummary: string
  communicationFingerprintSummary?: string
  selectedSignals: JournalContextSignal[]
  fallbackUsed: 'fingerprint' | 'baseline'
}

export interface JournalComposeInput {
  type: JournalEntryType
  userNote?: string
  focus?: JournalFocus[]
}

export interface JournalSession {
  id: string
  agentId: string
  status: JournalSessionStatus
  qualityStatus?: OutputQualityStatus
  repairCount?: number
  promptVersion?: string
  rawModelOutput?: OutputQualityRawModelOutput
  validation?: OutputQualityValidationReport
  sourceRefs?: OutputQualitySourceRef[]
  latestStage: JournalPipelineStage
  type: JournalEntryType
  normalizedInput: JournalComposeInput
  contextPacket?: {
    selectedSignals: JournalContextSignal[]
    dominantEmotion?: EmotionType | null
    summary: string
  }
  voicePacket?: JournalVoicePacket
  latestEvaluation?: JournalQualityEvaluation
  finalEntryId?: string
  provider?: string
  model?: string
  failureReason?: string
  createdAt: string
  updatedAt: string
  savedAt?: string
}

export interface JournalEntry {
  id: string
  agentId: string
  sessionId: string
  type: JournalEntryType
  status: JournalEntryStatus
  artifactRole?: OutputArtifactRole
  normalizationStatus?: OutputNormalizationStatus
  qualityStatus?: OutputQualityStatus
  qualityScore?: number
  promptVersion?: string
  repairCount?: number
  rawModelOutput?: OutputQualityRawModelOutput
  normalization?: OutputQualityTrackedFields['normalization']
  validation?: OutputQualityValidationReport
  sourceRefs?: OutputQualitySourceRef[]
  sourceEntryId?: string
  version: number
  title: string
  summary: string
  content: string
  render: MessageRenderData
  mood: {
    dominantEmotion?: EmotionType | null
    label: string
    intensity?: number
  }
  metadata: {
    focus: JournalFocus[]
    userNote?: string
    contextSummary?: string
  }
  evaluation?: JournalQualityEvaluation
  references: string[]
  structured: JournalStructuredReflection
  createdAt: string
  updatedAt: string
  savedAt?: string
}

export interface JournalPipelineEvent {
  id: string
  sessionId: string
  stage: JournalPipelineStage
  status: 'completed' | 'active' | 'skipped' | 'failed'
  summary: string
  payload: Record<string, unknown>
  createdAt: string
}

export interface JournalBootstrapPayload {
  agent: {
    id: string
    name: string
    journalCount: number
  }
  allowedTypes: JournalEntryType[]
  suggestedType: JournalEntryType
  defaults: {
    userNote: string
    focus: JournalFocus[]
  }
  recentSessions: JournalSession[]
  recentSavedEntries: JournalEntry[]
  metrics: {
    totalSavedEntries: number
    totalSessions: number
    readyToSaveCount: number
    failedSessions: number
  }
  archiveFilters: {
    types: JournalEntryType[]
  }
}

export interface JournalSessionDetail {
  session: JournalSession | null
  entries: JournalEntry[]
  pipelineEvents: JournalPipelineEvent[]
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

export type ProfileAnalysisStage =
  | 'evidence'
  | 'social_style'
  | 'decision_style'
  | 'stress_conflict'
  | 'motivation_identity'
  | 'communication_self_awareness'
  | 'synthesis'
  | 'evaluation'
  | 'repair'
  | 'completed'

export type ProfileAnalysisRunStatus =
  | 'draft'
  | 'running'
  | 'ready'
  | 'failed'

export type ProfileEvidenceSourceType =
  | 'persona'
  | 'goal'
  | 'core_trait'
  | 'dynamic_trait'
  | 'linguistic_baseline'
  | 'emotion'
  | 'emotion_event'
  | 'personality_event'
  | 'message'
  | 'memory'
  | 'journal'

export interface ProfileEvidenceSignal {
  id: string
  sourceType: ProfileEvidenceSourceType
  label: string
  snippet: string
  reason: string
  weight: number
  linkedEntityId?: string
}

export interface ProfileStageFinding {
  stage: ProfileAnalysisStage
  summary: string
  evidenceRefs?: string[]
  claims?: Array<{
    claim: string
    evidenceRefs: string[]
    categories?: string[]
  }>
  bigFiveSignals: Partial<Record<keyof BigFiveProfile, string[]>>
  mbtiHints: string[]
  enneagramHints: string[]
  communicationHints: string[]
  contradictions: string[]
  confidenceNotes: string[]
}

export interface ProfileQualityDimensionScore {
  score: number
  rationale: string
}

export interface ProfileQualityEvaluation {
  overallScore: number
  pass: boolean
  dimensions: {
    evidenceGrounding: ProfileQualityDimensionScore
    consistency: ProfileQualityDimensionScore
    distinctiveness: ProfileQualityDimensionScore
    communicationUsefulness: ProfileQualityDimensionScore
    rationaleCompleteness: ProfileQualityDimensionScore
  }
  strengths: string[]
  weaknesses: string[]
  repairInstructions: string[]
  evaluatorSummary: string
  hardFailureFlags?: string[]
}

export interface ProfileClaimRef {
  claim: string
  evidenceRefs: string[]
}

export interface ProfileClaimEvidenceMap {
  summary?: string[]
  communicationStyle?: string[]
  motivationalProfile?: string[]
  bigFive?: Partial<Record<keyof BigFiveProfile, string[]>>
  mbti?: string[]
  enneagram?: string[]
  strengths?: ProfileClaimRef[]
  challenges?: ProfileClaimRef[]
  triggers?: ProfileClaimRef[]
  growthEdges?: ProfileClaimRef[]
}

export interface ProfileEvidenceCoverageSummary {
  claimGroupsWithEvidence: number
  totalClaimGroups: number
  coveragePercent: number
  thresholdPercent: number
  pass: boolean
  blockedGroups: string[]
}

export interface ProfileInterviewTurn {
  id: string
  runId: string
  stage: ProfileAnalysisStage
  order: number
  question: string
  answer: string
  createdAt: string
  promptVersion?: string
  provider?: string
  model?: string
  evidenceRefs?: string[]
}

export interface ProfilePipelineEvent {
  id: string
  runId: string
  stage: ProfileAnalysisStage
  status: 'completed' | 'failed' | 'skipped'
  summary: string
  payload: Record<string, unknown>
  createdAt: string
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
  triggers?: string[]
  growthEdges?: string[]
  claimEvidence?: ProfileClaimEvidenceMap
  source?: 'deterministic_scaffold' | 'analysis_run'
  runId?: string
  sourceRunId?: string
  provider?: string
  model?: string
  confidence?: number
  qualityStatus?: OutputQualityStatus
  profileVersion?: string
  rationales?: {
    bigFive?: string
    mbti?: string
    enneagram?: string
    communicationStyle?: string
    stressPattern?: string
    motivationAndGrowth?: string
  }

  createdAt: string
  updatedAt: string
}

export interface ProfileAnalysisRun {
  id: string
  agentId: string
  status: ProfileAnalysisRunStatus
  qualityStatus?: OutputQualityStatus
  qualityScore?: number
  promptVersion?: string
  profileVersion?: string
  rawModelOutput?: OutputQualityRawModelOutput
  validation?: OutputQualityValidationReport
  sourceRefs?: OutputQualitySourceRef[]
  repairCount?: number
  latestStage: ProfileAnalysisStage
  sourceCount: number
  transcriptCount: number
  evidenceSignals: ProfileEvidenceSignal[]
  stageFindings: ProfileStageFinding[]
  evidenceCoverage?: ProfileEvidenceCoverageSummary
  latestProfile?: PsychologicalProfile
  latestEvaluation?: ProfileQualityEvaluation
  failureReason?: string
  provider?: string
  model?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
}

export interface CommunicationFingerprintSnapshot {
  generatedAt: string
  baselineAvailable: boolean
  enoughData: boolean
  sampleWindowSize: number
  observedMessageCount: number
  dimensions: {
    formality: number
    verbosity: number
    humor: number
    technicalLevel: number
    expressiveness: number
    directness: number
    questionRate: number
    structuralClarity: number
  }
  drift: Partial<Record<'formality' | 'verbosity' | 'humor' | 'technicalLevel' | 'expressiveness', number>>
  recurringVocabulary: string[]
  signaturePhrases: string[]
  punctuation: {
    exclamationRate: number
    questionRate: number
    ellipsisRate: number
    emojiRate: number
  }
  excerpts: Array<{
    id: string
    content: string
    timestamp: string
  }>
  summary?: string
}

export interface ProfileBootstrapPayload {
  profile: PsychologicalProfile | null
  stale: boolean
  lastTraitUpdateAt: string | null
  recentRuns: ProfileAnalysisRun[]
  latestRunSummary: {
    id: string
    status: ProfileAnalysisRunStatus
    latestStage: ProfileAnalysisStage
    updatedAt: string
    provider?: string
    model?: string
  } | null
  communicationFingerprint: CommunicationFingerprintSnapshot | null
  metrics: {
    totalInteractions: number
    latestCompletedRunAt: string | null
    runCount: number
    communicationSampleWindow: number
  }
  readiness: {
    hasCompletedRun: boolean
    canRunAnalysis: boolean
    hasEnoughMessagesForCommunication: boolean
  }
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
    totalInteractions: number
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
