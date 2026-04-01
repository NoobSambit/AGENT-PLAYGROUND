import { eq } from 'drizzle-orm'
import { getDb } from '@/lib/db/client'
import { agentRateLimits } from '@/lib/db/schema'
import { asIsoString } from '@/lib/db/utils'

function rateLimitId(agentId: string, feature: string): string {
  return `${feature}:${agentId}`
}

export class RateLimitRepository {
  static async consumeAgentWindow(params: {
    agentId: string
    feature: string
    maxRequests: number
    windowMs: number
  }): Promise<{ allowed: boolean; remaining: number }> {
    const now = new Date()
    const nowIso = now.toISOString()
    const id = rateLimitId(params.agentId, params.feature)

    return getDb().transaction(async (tx) => {
      const existing = await tx.query.agentRateLimits.findFirst({
        where: eq(agentRateLimits.id, id),
      })

      if (!existing) {
        await tx.insert(agentRateLimits).values({
          id,
          agentId: params.agentId,
          feature: params.feature,
          count: 1,
          windowStart: nowIso,
          lastRequest: nowIso,
          payload: {
            maxRequests: params.maxRequests,
            windowMs: params.windowMs,
          },
        })
        return { allowed: true, remaining: params.maxRequests - 1 }
      }

      const windowStart = new Date(existing.windowStart)
      if (now.getTime() - windowStart.getTime() > params.windowMs) {
        await tx.update(agentRateLimits).set({
          count: 1,
          windowStart: nowIso,
          lastRequest: nowIso,
          payload: {
            maxRequests: params.maxRequests,
            windowMs: params.windowMs,
          },
        }).where(eq(agentRateLimits.id, id))
        return { allowed: true, remaining: params.maxRequests - 1 }
      }

      if (existing.count >= params.maxRequests) {
        return { allowed: false, remaining: 0 }
      }

      const nextCount = existing.count + 1
      await tx.update(agentRateLimits).set({
        count: nextCount,
        lastRequest: nowIso,
        payload: {
          maxRequests: params.maxRequests,
          windowMs: params.windowMs,
        },
      }).where(eq(agentRateLimits.id, id))

      return { allowed: true, remaining: params.maxRequests - nextCount }
    })
  }

  static async setState(params: {
    agentId: string
    feature: string
    count: number
    windowStart: string | number | Date
    lastRequest?: string | Date
    payload?: Record<string, unknown>
  }): Promise<void> {
    const id = rateLimitId(params.agentId, params.feature)
    const row = {
      id,
      agentId: params.agentId,
      feature: params.feature,
      count: params.count,
      windowStart: typeof params.windowStart === 'number'
        ? new Date(params.windowStart).toISOString()
        : asIsoString(params.windowStart),
      lastRequest: typeof params.lastRequest === 'number'
        ? new Date(params.lastRequest).toISOString()
        : asIsoString(params.lastRequest || (typeof params.windowStart === 'number'
            ? new Date(params.windowStart)
            : params.windowStart)),
      payload: params.payload || {},
    }

    await getDb().insert(agentRateLimits).values(row).onConflictDoUpdate({
      target: agentRateLimits.id,
      set: row,
    })
  }
}
