import { randomUUID } from 'crypto'
import type { SQL, SQLWrapper } from 'drizzle-orm'
import { and, or } from 'drizzle-orm'

export function generateId(prefix: string): string {
  return `${prefix}_${randomUUID().replace(/-/g, '')}`
}

export function asIsoString(value?: string | Date | null): string {
  if (!value) {
    return new Date().toISOString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  const parsed = new Date(value)
  if (Number.isNaN(parsed.getTime())) {
    return new Date().toISOString()
  }

  return parsed.toISOString()
}

export function asDate(value?: string | Date | null): Date {
  return new Date(asIsoString(value))
}

export function compact<T extends Record<string, unknown>>(value: T): Partial<T> {
  return Object.fromEntries(
    Object.entries(value).filter(([, entry]) => entry !== undefined)
  ) as Partial<T>
}

export function sortedPair<T extends string>(left: T, right: T): [T, T] {
  return [left, right].sort() as [T, T]
}

export function relationshipPairId(agentId1: string, agentId2: string): string {
  const [left, right] = sortedPair(agentId1, agentId2)
  return `rel_${left}_${right}`
}

export function andAll(conditions: Array<SQLWrapper | undefined>): SQL | undefined {
  const filtered = conditions.filter(Boolean) as SQLWrapper[]
  if (filtered.length === 0) return undefined
  if (filtered.length === 1) return filtered[0] as SQL
  return and(...filtered)
}

export function orAll(conditions: Array<SQLWrapper | undefined>): SQL | undefined {
  const filtered = conditions.filter(Boolean) as SQLWrapper[]
  if (filtered.length === 0) return undefined
  if (filtered.length === 1) return filtered[0] as SQL
  return or(...filtered)
}
