import { generateId } from '@/lib/db/utils'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { PersonalityEventRepository } from '@/lib/repositories/personalityEventRepository'
import type { CreateMemoryData, MemoryRecord, PersonalityEventRecord } from '@/types/database'
import { MemoryService } from './memoryService'

function mapLegacyMemoryToEvent(record: MemoryRecord | null): PersonalityEventRecord | null {
  if (!record || record.type !== 'personality_insight') {
    return null
  }

  const metadata = record.metadata || {}
  const traitDeltas = Array.isArray(metadata.analyses)
    ? metadata.analyses as PersonalityEventRecord['traitDeltas']
    : []

  return {
    id: `legacy_${record.id}`,
    agentId: record.agentId,
    source: 'migration',
    trigger: 'legacy_personality_memory',
    summary: record.summary,
    traitDeltas,
    beforeTraits: undefined,
    afterTraits: undefined,
    linkedMessageIds: record.linkedMessageIds || [],
    metadata: {
      ...metadata,
      migratedFromMemoryId: record.id,
      legacyContext: record.context,
    },
    createdAt: record.timestamp,
  }
}

export interface CreatePersonalityEventInput {
  agentId: string
  source: PersonalityEventRecord['source']
  trigger: string
  summary: string
  traitDeltas: PersonalityEventRecord['traitDeltas']
  beforeTraits?: PersonalityEventRecord['beforeTraits']
  afterTraits?: PersonalityEventRecord['afterTraits']
  linkedMessageIds?: string[]
  metadata?: Record<string, unknown>
  createdAt?: string
}

export class PersonalityEventService {
  static async listByAgent(agentId: string, limitCount: number = 20): Promise<PersonalityEventRecord[]> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return PersonalityEventRepository.listByAgent(agentId, limitCount)
      }

      const memories = await MemoryService.getMemoriesByType(agentId, 'personality_insight')
      return memories
        .map(mapLegacyMemoryToEvent)
        .filter((event): event is PersonalityEventRecord => Boolean(event))
        .slice(0, limitCount)
    } catch (error) {
      console.error('Error fetching personality events:', error)
      return []
    }
  }

  static async getLatestByAgent(agentId: string): Promise<PersonalityEventRecord | null> {
    try {
      if (readsFromPostgres(getPersistenceMode())) {
        return PersonalityEventRepository.getLatestByAgent(agentId)
      }

      const [event] = await this.listByAgent(agentId, 1)
      return event || null
    } catch (error) {
      console.error('Error fetching latest personality event:', error)
      return null
    }
  }

  static async createEvent(input: CreatePersonalityEventInput): Promise<PersonalityEventRecord | null> {
    try {
      const record: PersonalityEventRecord = {
        id: generateId('profile_event'),
        agentId: input.agentId,
        source: input.source,
        trigger: input.trigger,
        summary: input.summary,
        traitDeltas: input.traitDeltas,
        beforeTraits: input.beforeTraits,
        afterTraits: input.afterTraits,
        linkedMessageIds: input.linkedMessageIds || [],
        metadata: input.metadata,
        createdAt: input.createdAt || new Date().toISOString(),
      }

      if (readsFromPostgres(getPersistenceMode())) {
        return PersonalityEventRepository.create(record)
      }

      const legacyMemory: CreateMemoryData = {
        agentId: input.agentId,
        type: 'personality_insight',
        content: input.summary,
        summary: input.summary,
        keywords: record.traitDeltas.map((delta) => delta.trait),
        importance: Math.max(4, Math.round(
          record.traitDeltas.reduce((sum, delta) => sum + (delta.confidence || 0), 0) * 2
        )),
        context: input.trigger,
        origin: 'system',
        linkedMessageIds: input.linkedMessageIds,
        metadata: {
          ...(input.metadata || {}),
          analyses: input.traitDeltas,
        },
      }

      const createdLegacyMemory = await MemoryService.createMemory(legacyMemory)
      return createdLegacyMemory ? mapLegacyMemoryToEvent(createdLegacyMemory) : null
    } catch (error) {
      console.error('Error creating personality event:', error)
      return null
    }
  }
}
