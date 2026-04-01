import { AgentRecord, MessageRecord, MemoryRecord } from '@/types/database'
import { MemoryGraph } from '@/types/database'
import { NeuralActivityEdge, NeuralActivityNode, NeuralActivitySnapshot } from '@/types/enhancements'
import { emotionalService } from '@/lib/services/emotionalService'

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max)
}

function extractAttentionFocus(messages: MessageRecord[], memories: MemoryRecord[]): string[] {
  const recentText = [
    ...messages.slice(-4).map((message) => message.content),
    ...memories.slice(0, 4).map((memory) => memory.summary || memory.content),
  ].join(' ')

  const tokens = recentText
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length > 3)

  const counts = new Map<string, number>()
  for (const token of tokens) {
    counts.set(token, (counts.get(token) || 0) + 1)
  }

  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([token]) => token)
}

export class NeuralActivityService {
  buildSnapshot(params: {
    agent: AgentRecord
    memories: MemoryRecord[]
    messages: MessageRecord[]
    memoryGraph: MemoryGraph | null
  }): NeuralActivitySnapshot {
    const emotionalState = emotionalService.normalizeEmotionalState(params.agent.emotionalState)
    const emotionalLead = emotionalService.getInfluentialEmotion(emotionalState, params.agent.emotionalProfile)
    const dominantEmotion = emotionalLead.emotion
    const emotionalIntensity = emotionalLead.source === 'live'
      ? emotionalState.currentMood[dominantEmotion]
      : emotionalLead.intensity
    const activeThemes = extractAttentionFocus(params.messages, params.memories)
    const nodes: NeuralActivityNode[] = []
    const edges: NeuralActivityEdge[] = []

    nodes.push({
      id: 'emotion-core',
      label: dominantEmotion,
      kind: 'emotion',
      weight: clamp(0.55 + emotionalIntensity, 0.4, 1),
      color: emotionalService.getEmotionColor(dominantEmotion),
      description: `${emotionalLead.source === 'live' ? 'Live state' : 'Temperament'} is leaning ${dominantEmotion} at ${(emotionalIntensity * 100).toFixed(0)}%.`,
    })

    params.memories.slice(0, 4).forEach((memory, index) => {
      const nodeId = `memory-${memory.id}`
      nodes.push({
        id: nodeId,
        label: memory.summary || memory.content.slice(0, 40),
        kind: 'memory',
        weight: clamp(memory.importance / 10, 0.3, 1),
        color: '#6db6d7',
        description: memory.context || 'Recent memory trace',
      })

      edges.push({
        id: `edge-emotion-memory-${index}`,
        source: 'emotion-core',
        target: nodeId,
        strength: clamp((memory.importance / 10 + emotionalIntensity) / 2, 0.25, 1),
        label: 'emotional recall',
      })
    })

    params.memoryGraph?.concepts.slice(0, 5).forEach((concept, index) => {
      const nodeId = `concept-${concept.id}`
      nodes.push({
        id: nodeId,
        label: concept.name,
        kind: 'concept',
        weight: clamp(concept.importance, 0.3, 1),
        color: '#9b7eeb',
        description: concept.description || 'Active concept cluster',
      })

      edges.push({
        id: `edge-concept-${index}`,
        source: 'emotion-core',
        target: nodeId,
        strength: clamp(concept.importance * 0.9, 0.25, 1),
        label: 'attention',
      })
    })

    activeThemes.forEach((theme, index) => {
      const nodeId = `attention-${theme}`
      nodes.push({
        id: nodeId,
        label: theme,
        kind: 'attention',
        weight: clamp(0.4 + index * 0.08, 0.4, 0.8),
        color: '#f7b267',
        description: 'Current conversational attention focus',
      })

      edges.push({
        id: `edge-attention-${index}`,
        source: 'emotion-core',
        target: nodeId,
        strength: clamp(0.7 - index * 0.08, 0.3, 0.75),
        label: 'focus',
      })
    })

    nodes.push({
      id: 'decision-hub',
      label: 'decision',
      kind: 'decision',
      weight: clamp(0.45 + params.messages.length * 0.01, 0.45, 0.85),
      color: '#58c78d',
      description: 'Reasoning branch where the agent turns context into a response.',
    })

    edges.push({
      id: 'edge-emotion-decision',
      source: 'emotion-core',
      target: 'decision-hub',
      strength: clamp(0.5 + emotionalIntensity * 0.4, 0.35, 0.95),
      label: 'mood influence',
    })

    const reasoningSummary = activeThemes.length > 0
      ? `The agent is weighting ${activeThemes.slice(0, 3).join(', ')} against ${dominantEmotion} ${emotionalLead.source === 'live' ? 'live emotion' : 'temperament'} while shaping the next response.`
      : `The agent is relying on ${dominantEmotion}-weighted memory recall to shape the next response.`

    return {
      dominantEmotion,
      emotionalIntensity,
      nodes,
      edges,
      activeThemes,
      reasoningSummary,
      attentionFocus: activeThemes,
      generatedAt: new Date().toISOString(),
    }
  }
}

export const neuralActivityService = new NeuralActivityService()
