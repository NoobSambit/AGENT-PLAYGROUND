import type { AgentRecord, AgentStats } from '@/types/database'
import { AgentService } from './agentService'
import { agentStatsService } from './agentStatsService'

type CounterField =
  | 'relationshipCount'
  | 'creativeWorks'
  | 'dreamCount'
  | 'journalCount'
  | 'challengesCompleted'
  | 'challengeWins'

interface MetricUpdateOptions {
  counterField?: CounterField
  counterFields?: CounterField[]
  statsUpdater?: (stats: AgentStats | undefined) => AgentStats
}

class AgentProgressService {
  private async applyAgentUpdate(
    agentId: string,
    options: MetricUpdateOptions
  ): Promise<AgentRecord | null> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return null
    }

    const stats = options.statsUpdater
      ? options.statsUpdater(agent.stats)
      : agent.stats

    const counterUpdates = Object.fromEntries(
      [options.counterField, ...(options.counterFields || [])]
        .filter((field): field is CounterField => Boolean(field))
        .map((field) => [field, ((agent[field] as number | undefined) || 0) + 1])
    )

    const success = await AgentService.updateAgent(agentId, {
      ...counterUpdates,
      ...(stats ? { stats } : {}),
    })

    return success ? AgentService.getAgentById(agentId) : null
  }

  recordRelationship(agentId: string) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'relationshipCount',
      statsUpdater: (stats) => agentStatsService.recordRelationship(stats),
    })
  }

  recordDream(agentId: string) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'dreamCount',
      statsUpdater: (stats) => agentStatsService.recordDream(stats),
    })
  }

  recordCreativeWork(agentId: string) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'creativeWorks',
      statsUpdater: (stats) => agentStatsService.recordCreativeWork(stats),
    })
  }

  recordJournalEntry(agentId: string) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'journalCount',
      statsUpdater: (stats) => agentStatsService.recordJournalEntry(stats),
    })
  }

  applyChallengeOutcome(
    agentId: string,
    didWin: boolean
  ) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'challengesCompleted',
      counterFields: didWin ? ['challengeWins'] : [],
    })
  }

  incrementChallengeParticipation(agentId: string) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'challengesCompleted',
    })
  }
}

export const agentProgressService = new AgentProgressService()
