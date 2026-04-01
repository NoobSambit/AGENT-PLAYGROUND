import { getDb, isPostgresConfigured } from '@/lib/db/client'
import { migrationOutbox } from '@/lib/db/schema'
import { asIsoString, generateId } from '@/lib/db/utils'

export class OutboxRepository {
  static async enqueue(params: {
    entityType: string
    entityId: string
    operation: string
    payload: Record<string, unknown>
    errorMessage: string
  }): Promise<void> {
    if (!isPostgresConfigured()) {
      return
    }

    const now = asIsoString()
    await getDb().insert(migrationOutbox).values({
      id: generateId('outbox'),
      entityType: params.entityType,
      entityId: params.entityId,
      operation: params.operation,
      payload: params.payload,
      errorMessage: params.errorMessage,
      attempts: 1,
      createdAt: now,
      lastAttemptAt: now,
    })
  }
}
