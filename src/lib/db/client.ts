import { Pool } from 'pg'
import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres'
import { schema } from './schema'

declare global {
  var __agentPlaygroundPgPool: Pool | undefined
  var __agentPlaygroundPgDb: NodePgDatabase<typeof schema> | undefined
}

function getDatabaseUrl(): string {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is required for PostgreSQL persistence')
  }

  return url
}

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim())
}

export function getPgPool(): Pool {
  if (!global.__agentPlaygroundPgPool) {
    global.__agentPlaygroundPgPool = new Pool({
      connectionString: getDatabaseUrl(),
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
  }

  return global.__agentPlaygroundPgPool
}

export function getDb(): NodePgDatabase<typeof schema> {
  if (!global.__agentPlaygroundPgDb) {
    global.__agentPlaygroundPgDb = drizzle(getPgPool(), { schema })
  }

  return global.__agentPlaygroundPgDb
}

export async function closeDb(): Promise<void> {
  if (global.__agentPlaygroundPgPool) {
    await global.__agentPlaygroundPgPool.end()
    global.__agentPlaygroundPgPool = undefined
    global.__agentPlaygroundPgDb = undefined
  }
}
