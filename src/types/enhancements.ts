import { EmotionType, RelationshipMetrics, SharedKnowledge } from '@/types/database'

export interface AgentValidation {
  agentId: string
  agentName: string
  verdict: 'support' | 'dispute' | 'uncertain'
  confidence: number
  rationale: string
  timestamp: string
}

export interface KnowledgeRepository {
  id: string
  topic: string
  contributingAgents: string[]
  entryIds: string[]
  consensusRating: number
  totalEntries: number
  tags: string[]
  lastUpdated: string
}

export interface ExpertReferral {
  agentId: string
  agentName: string
  score: number
  reasoning: string
  expertiseTopics: string[]
  supportingKnowledgeIds: string[]
}

export interface ConsensusSnapshot {
  topic: string
  supportCount: number
  disputeCount: number
  uncertainCount: number
  consensusRating: number
  recommendedPosition: string
  validatingAgents: AgentValidation[]
}

export interface KnowledgeBroadcast {
  id: string
  agentId: string
  agentName: string
  topic: string
  summary: string
  knowledgeId?: string
  reach: number
  endorsements: number
  createdAt: string
}

export interface CollectiveIntelligenceSnapshot {
  repositories: KnowledgeRepository[]
  referrals: ExpertReferral[]
  consensus: ConsensusSnapshot[]
  broadcasts: KnowledgeBroadcast[]
  relevantKnowledge: SharedKnowledge[]
}

export interface ConflictAnalysis {
  id: string
  topic: string
  tension: number
  conflictStyle: 'avoiding' | 'accommodating' | 'competing' | 'collaborating' | 'compromising'
  resolutionStyle: 'mediation' | 'compromise' | 'collaboration' | 'agree_to_disagree'
  commonGround: string[]
  frictionPoints: string[]
  actionItems: string[]
  relationshipImpact: Partial<RelationshipMetrics>
  status: 'analyzed' | 'mediated' | 'resolved' | 'stalemate'
  participants: Array<{
    agentId: string
    agentName: string
    position: string
  }>
  mediator?: {
    agentId: string
    agentName: string
  }
  createdAt: string
  updatedAt: string
}

export interface ContradictionInsight {
  id: string
  memoryId1: string
  memoryId2: string
  summary: string
  confidence: number
  topicOverlap: string[]
}

export interface NeuralActivityNode {
  id: string
  label: string
  kind: 'emotion' | 'memory' | 'concept' | 'attention' | 'decision'
  weight: number
  color: string
  description: string
}

export interface NeuralActivityEdge {
  id: string
  source: string
  target: string
  strength: number
  label: string
}

export interface NeuralActivitySnapshot {
  dominantEmotion: EmotionType
  emotionalIntensity: number
  nodes: NeuralActivityNode[]
  edges: NeuralActivityEdge[]
  activeThemes: string[]
  reasoningSummary: string
  attentionFocus: string[]
  generatedAt: string
}

export interface VoiceProfile {
  rate: number
  pitch: number
  volume: number
  styleHint: string
  preferredVoiceName?: string
}
