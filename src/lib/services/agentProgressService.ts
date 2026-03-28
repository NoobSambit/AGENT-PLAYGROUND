import {
  calculateLevel,
  calculateNextLevelXP,
  getAchievementById,
} from '@/lib/constants/achievements'
import { AgentProgress, AgentRecord, AgentStats } from '@/types/database'
import { achievementService } from './achievementService'
import { AgentService } from './agentService'

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
  progressUpdater?: (progress: AgentProgress | undefined) => AgentProgress
}

function normalizeProgress(progress?: AgentProgress): AgentProgress {
  const base = achievementService.createDefaultProgress()
  return {
    ...base,
    ...progress,
    achievements: { ...(progress?.achievements || {}) },
    allocatedSkills: { ...(progress?.allocatedSkills || {}) },
  }
}

function finalizeProgress(progress: AgentProgress): AgentProgress {
  const nextLevel = calculateLevel(progress.experiencePoints)
  const leveledUpBy = Math.max(nextLevel - progress.level, 0)

  return {
    ...progress,
    level: nextLevel,
    nextLevelXP: calculateNextLevelXP(nextLevel),
    skillPoints: progress.skillPoints + leveledUpBy,
  }
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

    let progress = options.progressUpdater
      ? options.progressUpdater(agent.progress)
      : agent.progress

    const counterUpdates = Object.fromEntries(
      [options.counterField, ...(options.counterFields || [])]
        .filter((field): field is CounterField => Boolean(field))
        .map((field) => [field, ((agent[field] as number | undefined) || 0) + 1])
    )

    if (stats || progress) {
      const achievementSource: AgentRecord = {
        ...agent,
        stats: stats || agent.stats,
        progress: progress || agent.progress,
      }
      const newlyUnlocked = achievementService.checkAchievements(achievementSource)
      if (newlyUnlocked.length > 0) {
        const unlocked = achievementService.unlockAchievements(
          normalizeProgress(progress || agent.progress),
          newlyUnlocked
        )
        progress = unlocked.progress
      }
    }

    const success = await AgentService.updateAgent(agentId, {
      ...counterUpdates,
      ...(stats ? { stats } : {}),
      ...(progress ? { progress } : {}),
    })

    return success ? AgentService.getAgentById(agentId) : null
  }

  recordRelationship(agentId: string) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'relationshipCount',
      statsUpdater: (stats) => achievementService.recordRelationship(stats),
    })
  }

  recordDream(agentId: string) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'dreamCount',
      statsUpdater: (stats) => achievementService.recordDream(stats),
    })
  }

  recordCreativeWork(agentId: string) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'creativeWorks',
      statsUpdater: (stats) => achievementService.recordCreativeWork(stats),
    })
  }

  recordJournalEntry(agentId: string) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'journalCount',
      statsUpdater: (stats) => achievementService.recordJournalEntry(stats),
    })
  }

  applyChallengeOutcome(
    agentId: string,
    xpAwarded: number,
    achievementIds: string[],
    didWin: boolean
  ) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'challengesCompleted',
      counterFields: didWin ? ['challengeWins'] : [],
      progressUpdater: (currentProgress) => {
        let progress = normalizeProgress(currentProgress)
        progress.experiencePoints += xpAwarded

        const achievements = achievementIds
          .map((id) => getAchievementById(id))
          .filter((achievement): achievement is NonNullable<typeof achievement> => Boolean(achievement))

        if (achievements.length > 0) {
          progress = achievementService.unlockAchievements(progress, achievements).progress
        }

        return finalizeProgress(progress)
      },
    })
  }

  incrementChallengeParticipation(agentId: string) {
    return this.applyAgentUpdate(agentId, {
      counterField: 'challengesCompleted',
    })
  }
}

export const agentProgressService = new AgentProgressService()
