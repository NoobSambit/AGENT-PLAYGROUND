import { MessageService } from './messageService'
import type {
  AgentRecord,
  CommunicationFingerprintSnapshot,
  MessageRecord,
} from '@/types/database'

const DEFAULT_SAMPLE_WINDOW = 30
const MINIMUM_OBSERVED_MESSAGES = 12

const STOP_WORDS = new Set([
  'the', 'and', 'for', 'that', 'with', 'this', 'from', 'have', 'will', 'your', 'about', 'what',
  'when', 'where', 'which', 'who', 'why', 'how', 'can', 'could', 'should', 'would', 'there',
  'their', 'they', 'them', 'then', 'than', 'into', 'onto', 'here', 'just', 'like', 'some',
  'more', 'most', 'much', 'been', 'being', 'also', 'able', 'make', 'made', 'does', 'did',
  'done', 'want', 'need', 'really', 'very', 'still',
])

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function normalizeCount(value: number, max: number) {
  return clamp(value / max)
}

function countMatches(text: string, pattern: RegExp) {
  const matches = text.match(pattern)
  return matches ? matches.length : 0
}

function tokenize(text: string) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s']/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function buildSummary(snapshot: CommunicationFingerprintSnapshot, agentName: string) {
  const tone =
    snapshot.dimensions.formality > 0.65
      ? 'formal'
      : snapshot.dimensions.formality < 0.35
        ? 'casual'
        : 'balanced'
  const depth =
    snapshot.dimensions.verbosity > 0.65
      ? 'expansive'
      : snapshot.dimensions.verbosity < 0.35
        ? 'concise'
        : 'measured'
  const technical =
    snapshot.dimensions.technicalLevel > 0.65
      ? 'specialized'
      : snapshot.dimensions.technicalLevel < 0.35
        ? 'accessible'
        : 'mixed'
  const expressive =
    snapshot.dimensions.expressiveness > 0.65
      ? 'image-rich'
      : snapshot.dimensions.expressiveness < 0.35
        ? 'literal'
        : 'controlled'

  return `${agentName} currently sounds ${tone}, ${depth}, and ${technical}. The recent replies read ${expressive}, with ${(snapshot.dimensions.directness * 100).toFixed(0)}% directness and ${(snapshot.dimensions.structuralClarity * 100).toFixed(0)}% structural clarity across ${snapshot.observedMessageCount} observed replies.`
}

export class CommunicationFingerprintService {
  static readonly SAMPLE_WINDOW = DEFAULT_SAMPLE_WINDOW
  static readonly MINIMUM_OBSERVED_MESSAGES = MINIMUM_OBSERVED_MESSAGES

  static async buildSnapshot(agent: AgentRecord, sampleWindow = DEFAULT_SAMPLE_WINDOW): Promise<CommunicationFingerprintSnapshot> {
    const messages = await MessageService.getMessagesByAgentId(agent.id)
    const observedMessages = messages
      .filter((message) => message.type === 'agent')
      .slice(-sampleWindow)

    return this.buildSnapshotFromMessages(agent, observedMessages, sampleWindow)
  }

  static buildSnapshotFromMessages(
    agent: Pick<AgentRecord, 'name' | 'linguisticProfile'>,
    observedMessages: MessageRecord[],
    sampleWindow = DEFAULT_SAMPLE_WINDOW
  ): CommunicationFingerprintSnapshot {
    const contents = observedMessages.map((message) => message.content)
    const tokenized = contents.flatMap(tokenize)
    const totalWords = tokenized.length
    const averageWords = average(contents.map((value) => tokenize(value).length))
    const averageSentenceLength = average(contents.map((value) => value.split(/[.!?]+/).filter(Boolean).length > 0
      ? tokenize(value).length / value.split(/[.!?]+/).filter(Boolean).length
      : 0))

    const longWords = tokenized.filter((word) => word.length >= 9).length
    const formalMarkers = tokenized.filter((word) => ['therefore', 'however', 'specifically', 'indeed', 'consequently'].includes(word)).length
    const casualMarkers = tokenized.filter((word) => ['yeah', 'cool', 'totally', 'gonna', 'kinda'].includes(word)).length
    const playfulMarkers = tokenized.filter((word) => ['fun', 'wild', 'playful', 'ridiculous', 'hilarious'].includes(word)).length
    const figurativeMarkers = tokenized.filter((word) => ['like', 'as', 'spark', 'pulse', 'echo', 'arc', 'friction'].includes(word)).length
    const directiveMarkers = tokenized.filter((word) => ['do', 'start', 'focus', 'keep', 'build', 'ship', 'use', 'try'].includes(word)).length

    const bulletMessages = contents.filter((value) => /(^|\n)\s*[-*]\s+/m.test(value)).length
    const numberedMessages = contents.filter((value) => /(^|\n)\s*\d+\.\s+/m.test(value)).length
    const questionMessages = contents.filter((value) => value.includes('?')).length

    const recurringVocabulary = [...new Set(
      tokenized
        .filter((word) => word.length >= 4 && !STOP_WORDS.has(word))
        .filter((entry, index, list) => list.indexOf(entry) !== index)
    )].slice(0, 12)

    const signaturePhrases = [...new Set(
      contents.flatMap((value) => {
        const trimmed = value.trim()
        const phrases: string[] = []
        const lines = trimmed.split('\n').map((line) => line.trim()).filter(Boolean)
        if (lines[0]) phrases.push(lines[0].slice(0, 80))
        const matches = trimmed.match(/[^.!?\n]{18,80}[.!?]/g) || []
        return [...phrases, ...matches.slice(0, 2).map((entry) => entry.trim())]
      })
    )].slice(0, 8)

    const excerpts = observedMessages.slice(-3).map((message) => ({
      id: message.id,
      content: message.content.slice(0, 220),
      timestamp: message.timestamp,
    }))

    const punctuation = {
      exclamationRate: contents.length ? average(contents.map((value) => normalizeCount(countMatches(value, /!/g), 3))) : 0,
      questionRate: contents.length ? average(contents.map((value) => normalizeCount(countMatches(value, /\?/g), 2))) : 0,
      ellipsisRate: contents.length ? average(contents.map((value) => (value.includes('...') ? 1 : 0))) : 0,
      emojiRate: contents.length ? average(contents.map((value) => (/[\u{1F300}-\u{1FAFF}]/u.test(value) ? 1 : 0))) : 0,
    }

    const dimensions = {
      formality: clamp(0.5 + normalizeCount(formalMarkers, Math.max(2, contents.length)) - normalizeCount(casualMarkers, Math.max(2, contents.length))),
      verbosity: clamp(normalizeCount(averageWords, 180)),
      humor: clamp(normalizeCount(playfulMarkers, Math.max(2, contents.length * 1.2))),
      technicalLevel: clamp(normalizeCount(longWords / Math.max(1, totalWords), 0.22)),
      expressiveness: clamp(normalizeCount(figurativeMarkers, Math.max(2, contents.length * 1.5))),
      directness: clamp(normalizeCount(directiveMarkers, Math.max(3, contents.length * 1.5))),
      questionRate: clamp(contents.length ? questionMessages / contents.length : 0),
      structuralClarity: clamp((bulletMessages + numberedMessages) / Math.max(1, contents.length) + normalizeCount(averageSentenceLength, 22) * 0.35),
    }

    const baseline = agent.linguisticProfile
    const drift = baseline
      ? {
          formality: dimensions.formality - baseline.formality,
          verbosity: dimensions.verbosity - baseline.verbosity,
          humor: dimensions.humor - baseline.humor,
          technicalLevel: dimensions.technicalLevel - baseline.technicalLevel,
          expressiveness: dimensions.expressiveness - baseline.expressiveness,
        }
      : {}

    const snapshot: CommunicationFingerprintSnapshot = {
      generatedAt: new Date().toISOString(),
      baselineAvailable: Boolean(baseline),
      enoughData: observedMessages.length >= MINIMUM_OBSERVED_MESSAGES,
      sampleWindowSize: sampleWindow,
      observedMessageCount: observedMessages.length,
      dimensions,
      drift,
      recurringVocabulary,
      signaturePhrases,
      punctuation,
      excerpts,
    }

    snapshot.summary = buildSummary(snapshot, agent.name)
    return snapshot
  }
}
