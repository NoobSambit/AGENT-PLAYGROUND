import { isPostgresConfigured } from '@/lib/db/client'
import { dualWrites, getPersistenceMode } from '@/lib/db/persistence'
import { OutboxRepository } from '@/lib/repositories/outboxRepository'

interface MirroredWriteParams<T> {
  entityType: string
  entityId: string
  operation: string
  payload: Record<string, unknown>
  primary: () => Promise<T>
  secondary?: () => Promise<unknown>
}

function formatError(error: unknown): string {
  if (error instanceof Error) {
    return error.message
  }

  return String(error)
}

export async function runMirroredWrite<T>({
  entityType,
  entityId,
  operation,
  payload,
  primary,
  secondary,
}: MirroredWriteParams<T>): Promise<T> {
  const result = await primary()

  if (!secondary || !dualWrites(getPersistenceMode())) {
    return result
  }

  try {
    await secondary()
  } catch (error) {
    console.error(`Mirror write failed for ${entityType}:${entityId}`, error)
    if (isPostgresConfigured()) {
      await OutboxRepository.enqueue({
        entityType,
        entityId,
        operation,
        payload,
        errorMessage: formatError(error),
      }).catch((outboxError) => {
        console.error(`Outbox enqueue failed for ${entityType}:${entityId}`, outboxError)
      })
    }
  }

  return result
}
