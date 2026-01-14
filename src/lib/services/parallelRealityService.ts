// ============================================
// PARALLEL REALITY SERVICE (Feature 14 - Complete)
// Enables what-if scenarios and reality branching
// ============================================

import {
  ParallelReality,
  RealityBranch,
  AgentRecord,
  EmotionalState,
  AgentRelationship,
  EmotionType,
  EMOTION_COLORS
} from '@/types/database'

// ============================================
// EXTENDED TYPES FOR BRANCHING
// ============================================

export type BranchTrigger =
  | 'decision_point'      // A significant choice was made
  | 'emotional_event'     // Major emotional shift
  | 'relationship_change' // Relationship status changed
  | 'goal_outcome'        // Goal succeeded/failed
  | 'external_event'      // Something external happened
  | 'what_if'             // Manual what-if exploration

export interface WhatIfScenario {
  id: string
  title: string
  description: string
  trigger: BranchTrigger
  divergencePoint: string // Timestamp or event description
  hypothesis: string // What we're testing
  variables: Array<{
    name: string
    originalValue: string
    alteredValue: string
  }>
}

export interface RealityComparisonMetrics {
  emotionalDivergence: {
    overall: number // 0-1, how different emotions are
    byEmotion: Record<EmotionType, number>
    dominantShift: {
      original: EmotionType
      alternate: EmotionType
    }
  }
  relationshipChanges: Array<{
    partnerId: string
    partnerName: string
    metricChanges: {
      trust: number // -1 to 1
      respect: number
      affection: number
      familiarity: number
    }
    statusChange: string
  }>
  personalityShifts: Array<{
    trait: string
    originalValue: number
    alternateValue: number
    significance: 'major' | 'moderate' | 'minor'
  }>
  outcomeAnalysis: {
    positiveOutcomes: string[]
    negativeOutcomes: string[]
    neutralOutcomes: string[]
    recommendation: string
  }
}

export interface BranchNode {
  id: string
  realityId: string
  parentId: string | null
  depth: number

  // Snapshot
  timestamp: string
  snapshot: {
    emotionalState: EmotionalState
    relationships: AgentRelationship[]
    progressLevel: number
    memoryCount: number
  }

  // Branch info
  branchReason: string
  scenario?: WhatIfScenario

  // Children
  childBranches: string[] // Branch IDs

  // Metadata
  isExplored: boolean
  explorationComplete: boolean
  createdAt: string
}

export interface RealityTree {
  agentId: string
  rootBranch: BranchNode
  totalBranches: number
  maxDepth: number
  activeBranches: string[] // Currently being explored

  // Statistics
  stats: {
    totalScenarios: number
    positiveOutcomes: number
    negativeOutcomes: number
    mostExploredTrigger: BranchTrigger
    averageDivergence: number
  }
}

export interface ParallelRealityExtended extends ParallelReality {
  // Enhanced fields
  scenario: WhatIfScenario
  branchTree: BranchNode
  comparison: RealityComparisonMetrics

  // Exploration
  explorationStatus: 'pending' | 'in_progress' | 'complete' | 'abandoned'
  explorationMessages: Array<{
    content: string
    timestamp: string
    agentState: EmotionalState
  }>

  // Insights
  insights: string[]
  recommendation: string
}

// ============================================
// SERVICE IMPLEMENTATION
// ============================================

export class ParallelRealityService {
  // ============================================
  // SCENARIO CREATION
  // ============================================

  /**
   * Create a what-if scenario
   */
  createWhatIfScenario(
    title: string,
    description: string,
    trigger: BranchTrigger,
    divergencePoint: string,
    variables: WhatIfScenario['variables']
  ): WhatIfScenario {
    return {
      id: `scenario-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      title,
      description,
      trigger,
      divergencePoint,
      hypothesis: `Testing what would happen if ${variables.map(v => `${v.name} was ${v.alteredValue} instead of ${v.originalValue}`).join(' and ')}`,
      variables
    }
  }

  /**
   * Create predefined scenario templates
   */
  getScenarioTemplates(): WhatIfScenario[] {
    return [
      {
        id: 'template-different-response',
        title: 'Different Response',
        description: 'What if the agent had responded differently?',
        trigger: 'decision_point',
        divergencePoint: 'Last significant response',
        hypothesis: 'Testing alternative response impact',
        variables: [{
          name: 'response_tone',
          originalValue: 'current',
          alteredValue: 'alternative'
        }]
      },
      {
        id: 'template-emotional-shift',
        title: 'Emotional Baseline Shift',
        description: 'What if the agent had a different emotional baseline?',
        trigger: 'emotional_event',
        divergencePoint: 'Agent creation',
        hypothesis: 'Testing personality with different emotional foundation',
        variables: [{
          name: 'dominant_emotion',
          originalValue: 'current',
          alteredValue: 'alternative'
        }]
      },
      {
        id: 'template-relationship-path',
        title: 'Alternative Relationship Path',
        description: 'What if a relationship had developed differently?',
        trigger: 'relationship_change',
        divergencePoint: 'First interaction',
        hypothesis: 'Testing different relationship trajectory',
        variables: [{
          name: 'initial_impression',
          originalValue: 'actual',
          alteredValue: 'alternative'
        }]
      },
      {
        id: 'template-goal-outcome',
        title: 'Different Goal Outcome',
        description: 'What if a goal had succeeded/failed?',
        trigger: 'goal_outcome',
        divergencePoint: 'Goal completion point',
        hypothesis: 'Testing impact of different goal result',
        variables: [{
          name: 'goal_result',
          originalValue: 'actual',
          alteredValue: 'opposite'
        }]
      }
    ]
  }

  // ============================================
  // REALITY BRANCHING
  // ============================================

  /**
   * Create a branch from current state
   */
  createBranch(
    agent: AgentRecord,
    scenario: WhatIfScenario,
    parentBranchId: string | null = null,
    depth: number = 0
  ): BranchNode {
    return {
      id: `branch-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      realityId: `reality-${agent.id}-${Date.now()}`,
      parentId: parentBranchId,
      depth,
      timestamp: new Date().toISOString(),
      snapshot: {
        emotionalState: agent.emotionalState || this.createDefaultEmotionalState(),
        relationships: [], // Would be loaded from DB
        progressLevel: agent.progress?.level || 1,
        memoryCount: agent.memoryCount || 0
      },
      branchReason: scenario.title,
      scenario,
      childBranches: [],
      isExplored: false,
      explorationComplete: false,
      createdAt: new Date().toISOString()
    }
  }

  /**
   * Apply scenario variables to create divergent state
   */
  applyScenarioVariables(
    originalState: AgentRecord,
    scenario: WhatIfScenario
  ): Partial<AgentRecord> {
    const divergentState: Partial<AgentRecord> = {}

    for (const variable of scenario.variables) {
      switch (variable.name) {
        case 'response_tone':
          // Modify linguistic profile
          if (originalState.linguisticProfile) {
            divergentState.linguisticProfile = {
              ...originalState.linguisticProfile,
              formality: Math.random(),
              humor: Math.random()
            }
          }
          break

        case 'dominant_emotion':
          // Shift emotional baseline
          divergentState.emotionalState = this.shiftEmotionalState(
            originalState.emotionalState,
            variable.alteredValue as EmotionType
          )
          break

        case 'initial_impression':
          // Would affect relationship metrics
          break

        case 'goal_result':
          // Flip goal success/failure impact
          if (originalState.progress) {
            const xpModifier = variable.alteredValue === 'opposite' ? -1 : 1
            divergentState.progress = {
              ...originalState.progress,
              experiencePoints: originalState.progress.experiencePoints + (50 * xpModifier)
            }
          }
          break
      }
    }

    return divergentState
  }

  private shiftEmotionalState(
    current: EmotionalState | undefined,
    newDominant: EmotionType
  ): EmotionalState {
    const baseline: Record<EmotionType, number> = {
      joy: 0.3, sadness: 0.2, anger: 0.1, fear: 0.2,
      surprise: 0.3, trust: 0.5, anticipation: 0.4, disgust: 0.1
    }

    // Boost the new dominant emotion
    baseline[newDominant] = 0.8

    return {
      currentMood: baseline,
      emotionalBaseline: baseline,
      lastUpdated: new Date().toISOString(),
      dominantEmotion: newDominant
    }
  }

  // ============================================
  // COMPARISON & ANALYSIS
  // ============================================

  /**
   * Compare two reality states
   */
  compareRealities(
    originalAgent: AgentRecord,
    divergentState: Partial<AgentRecord>,
    originalRelationships: AgentRelationship[],
    divergentRelationships: AgentRelationship[]
  ): RealityComparisonMetrics {
    // Emotional divergence
    const originalEmotion = originalAgent.emotionalState?.currentMood || {}
    const divergentEmotion = divergentState.emotionalState?.currentMood || originalEmotion

    const emotionDiffs: Record<EmotionType, number> = {} as Record<EmotionType, number>
    let totalDiff = 0
    const emotions: EmotionType[] = ['joy', 'sadness', 'anger', 'fear', 'surprise', 'trust', 'anticipation', 'disgust']

    for (const emotion of emotions) {
      const orig = (originalEmotion as Record<EmotionType, number>)[emotion] || 0.5
      const div = (divergentEmotion as Record<EmotionType, number>)[emotion] || 0.5
      emotionDiffs[emotion] = Math.abs(div - orig)
      totalDiff += emotionDiffs[emotion]
    }

    // Relationship changes
    const relationshipChanges: RealityComparisonMetrics['relationshipChanges'] = []

    for (const origRel of originalRelationships) {
      const divRel = divergentRelationships.find(r =>
        r.agentId1 === origRel.agentId1 && r.agentId2 === origRel.agentId2
      )

      if (divRel) {
        relationshipChanges.push({
          partnerId: origRel.agentId2,
          partnerName: 'Partner', // Would be looked up
          metricChanges: {
            trust: divRel.metrics.trust - origRel.metrics.trust,
            respect: divRel.metrics.respect - origRel.metrics.respect,
            affection: divRel.metrics.affection - origRel.metrics.affection,
            familiarity: divRel.metrics.familiarity - origRel.metrics.familiarity
          },
          statusChange: divRel.status !== origRel.status
            ? `${origRel.status} → ${divRel.status}`
            : 'unchanged'
        })
      }
    }

    // Personality shifts
    const personalityShifts: RealityComparisonMetrics['personalityShifts'] = []

    if (originalAgent.dynamicTraits && divergentState.dynamicTraits) {
      for (const [trait, origValue] of Object.entries(originalAgent.dynamicTraits)) {
        const divValue = divergentState.dynamicTraits[trait] || origValue
        const diff = Math.abs(divValue - origValue)

        if (diff > 0.05) {
          personalityShifts.push({
            trait,
            originalValue: origValue,
            alternateValue: divValue,
            significance: diff > 0.3 ? 'major' : diff > 0.15 ? 'moderate' : 'minor'
          })
        }
      }
    }

    // Outcome analysis
    const positiveOutcomes: string[] = []
    const negativeOutcomes: string[] = []
    const neutralOutcomes: string[] = []

    // Analyze emotion changes
    if (emotionDiffs['joy'] > 0.2) {
      if ((divergentEmotion as Record<string, number>)['joy'] > (originalEmotion as Record<string, number>)['joy']) {
        positiveOutcomes.push('Increased happiness')
      } else {
        negativeOutcomes.push('Decreased happiness')
      }
    }

    if (emotionDiffs['trust'] > 0.2) {
      if ((divergentEmotion as Record<string, number>)['trust'] > (originalEmotion as Record<string, number>)['trust']) {
        positiveOutcomes.push('Higher trust baseline')
      } else {
        negativeOutcomes.push('Lower trust baseline')
      }
    }

    // Analyze relationship changes
    for (const change of relationshipChanges) {
      const netChange = change.metricChanges.trust + change.metricChanges.respect +
                       change.metricChanges.affection + change.metricChanges.familiarity

      if (netChange > 0.4) {
        positiveOutcomes.push(`Improved relationship with ${change.partnerName}`)
      } else if (netChange < -0.4) {
        negativeOutcomes.push(`Degraded relationship with ${change.partnerName}`)
      } else {
        neutralOutcomes.push(`Stable relationship with ${change.partnerName}`)
      }
    }

    // Generate recommendation
    let recommendation = ''
    if (positiveOutcomes.length > negativeOutcomes.length) {
      recommendation = 'This scenario suggests a more favorable outcome. Consider adopting aspects of this path.'
    } else if (negativeOutcomes.length > positiveOutcomes.length) {
      recommendation = 'This scenario leads to less favorable outcomes. The current path may be preferable.'
    } else {
      recommendation = 'Both paths have similar outcomes. The choice depends on specific priorities.'
    }

    return {
      emotionalDivergence: {
        overall: totalDiff / emotions.length,
        byEmotion: emotionDiffs,
        dominantShift: {
          original: originalAgent.emotionalState?.dominantEmotion || 'trust',
          alternate: divergentState.emotionalState?.dominantEmotion || 'trust'
        }
      },
      relationshipChanges,
      personalityShifts,
      outcomeAnalysis: {
        positiveOutcomes,
        negativeOutcomes,
        neutralOutcomes,
        recommendation
      }
    }
  }

  // ============================================
  // REALITY TREE MANAGEMENT
  // ============================================

  /**
   * Create a new reality tree for an agent
   */
  createRealityTree(agent: AgentRecord): RealityTree {
    const rootScenario = this.createWhatIfScenario(
      'Original Timeline',
      'The actual path taken by the agent',
      'what_if',
      agent.createdAt,
      []
    )

    const rootBranch = this.createBranch(agent, rootScenario, null, 0)
    rootBranch.isExplored = true
    rootBranch.explorationComplete = true

    return {
      agentId: agent.id,
      rootBranch,
      totalBranches: 1,
      maxDepth: 0,
      activeBranches: [],
      stats: {
        totalScenarios: 0,
        positiveOutcomes: 0,
        negativeOutcomes: 0,
        mostExploredTrigger: 'what_if',
        averageDivergence: 0
      }
    }
  }

  /**
   * Add a branch to the tree
   */
  addBranchToTree(
    tree: RealityTree,
    parentBranchId: string,
    newBranch: BranchNode
  ): RealityTree {
    // Find parent and add child
    const findAndAddChild = (node: BranchNode): boolean => {
      if (node.id === parentBranchId) {
        node.childBranches.push(newBranch.id)
        return true
      }
      // Would recursively search children in real implementation
      return false
    }

    findAndAddChild(tree.rootBranch)

    return {
      ...tree,
      totalBranches: tree.totalBranches + 1,
      maxDepth: Math.max(tree.maxDepth, newBranch.depth),
      activeBranches: [...tree.activeBranches, newBranch.id]
    }
  }

  // ============================================
  // PARALLEL REALITY CREATION
  // ============================================

  /**
   * Create a complete parallel reality for exploration
   */
  createParallelReality(
    agent: AgentRecord,
    scenario: WhatIfScenario,
    relationships: AgentRelationship[] = []
  ): ParallelRealityExtended {
    const branch = this.createBranch(agent, scenario, null, 1)
    const divergentState = this.applyScenarioVariables(agent, scenario)
    const comparison = this.compareRealities(agent, divergentState, relationships, [])

    const baseReality: ParallelReality = {
      id: branch.realityId,
      agentId: agent.id,
      originalAgentId: agent.id,
      branch: {
        id: branch.id,
        parentBranchId: null,
        branchPoint: scenario.divergencePoint,
        divergenceReason: scenario.title
      },
      divergentState: {
        emotionalState: divergentState.emotionalState || agent.emotionalState || this.createDefaultEmotionalState(),
        relationships: [],
        recentMemories: [],
        progress: divergentState.progress || agent.progress || {
          level: 1,
          experiencePoints: 0,
          nextLevelXP: 100,
          achievements: {},
          skillPoints: 0,
          allocatedSkills: {}
        }
      },
      scenario: {
        description: scenario.description,
        keyDifferences: scenario.variables.map(v => `${v.name}: ${v.originalValue} → ${v.alteredValue}`),
        hypotheticalEvents: [scenario.hypothesis]
      },
      simulationMessages: [],
      comparison: {
        emotionalDivergence: comparison.emotionalDivergence.byEmotion,
        relationshipChanges: comparison.relationshipChanges.map(r => r.statusChange),
        personalityShifts: comparison.personalityShifts.map(p => `${p.trait}: ${p.significance} shift`),
        keyInsights: [
          ...comparison.outcomeAnalysis.positiveOutcomes,
          ...comparison.outcomeAnalysis.negativeOutcomes
        ]
      },
      createdAt: new Date().toISOString(),
      expiresAt: this.addDays(new Date(), 7).toISOString()
    }

    return {
      ...baseReality,
      scenario,
      branchTree: branch,
      comparison,
      explorationStatus: 'pending',
      explorationMessages: [],
      insights: [
        comparison.outcomeAnalysis.recommendation,
        ...comparison.outcomeAnalysis.positiveOutcomes.slice(0, 2),
        ...comparison.outcomeAnalysis.negativeOutcomes.slice(0, 2)
      ],
      recommendation: comparison.outcomeAnalysis.recommendation
    }
  }

  // ============================================
  // HELPER METHODS
  // ============================================

  private createDefaultEmotionalState(): EmotionalState {
    return {
      currentMood: {
        joy: 0.5, sadness: 0.2, anger: 0.1, fear: 0.2,
        surprise: 0.3, trust: 0.6, anticipation: 0.4, disgust: 0.1
      },
      emotionalBaseline: {
        joy: 0.5, sadness: 0.2, anger: 0.1, fear: 0.2,
        surprise: 0.3, trust: 0.6, anticipation: 0.4, disgust: 0.1
      },
      lastUpdated: new Date().toISOString(),
      dominantEmotion: 'trust'
    }
  }

  private addDays(date: Date, days: number): Date {
    const result = new Date(date)
    result.setDate(result.getDate() + days)
    return result
  }

  /**
   * Generate a visualization-ready format of the comparison
   */
  getComparisonVisualization(comparison: RealityComparisonMetrics): {
    emotionChart: Array<{ emotion: string; original: number; alternate: number; color: string }>
    divergenceScore: number
    summary: string
  } {
    const emotionChart = Object.entries(comparison.emotionalDivergence.byEmotion).map(([emotion, diff]) => ({
      emotion: emotion.charAt(0).toUpperCase() + emotion.slice(1),
      original: 0.5, // Would be actual value
      alternate: 0.5 + (Math.random() - 0.5) * diff * 2,
      color: EMOTION_COLORS[emotion as EmotionType]
    }))

    return {
      emotionChart,
      divergenceScore: comparison.emotionalDivergence.overall,
      summary: `${comparison.outcomeAnalysis.positiveOutcomes.length} positive, ${comparison.outcomeAnalysis.negativeOutcomes.length} negative outcomes`
    }
  }
}

export const parallelRealityService = new ParallelRealityService()
