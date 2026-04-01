import fs from 'fs/promises'
import path from 'path'
import { withPgClient } from './lib/postgres.mjs'

const MIGRATIONS_DIR = path.join(process.cwd(), 'drizzle')

async function ensureMigrationsTable(client) {
  await client.query(`
    CREATE TABLE IF NOT EXISTS "__schema_migrations" (
      id text PRIMARY KEY,
      applied_at timestamptz NOT NULL DEFAULT now()
    )
  `)
}

async function getAppliedMigrationIds(client) {
  const { rows } = await client.query('SELECT id FROM "__schema_migrations"')
  return new Set(rows.map((row) => row.id))
}

async function loadMigrations() {
  const entries = await fs.readdir(MIGRATIONS_DIR)
  return entries
    .filter((entry) => entry.endsWith('.sql'))
    .sort()
}

async function main() {
  const migrations = await loadMigrations()

  if (migrations.length === 0) {
    console.log('[db-migrate] No SQL migrations found in drizzle/.')
    return
  }

  await withPgClient(async (client) => {
    await ensureMigrationsTable(client)
    const appliedIds = await getAppliedMigrationIds(client)

    for (const migrationFile of migrations) {
      if (appliedIds.has(migrationFile)) {
        continue
      }

      const migrationPath = path.join(MIGRATIONS_DIR, migrationFile)
      const sql = await fs.readFile(migrationPath, 'utf8')

      console.log(`[db-migrate] Applying ${migrationFile}`)
      await client.query('BEGIN')

      try {
        await client.query(sql)
        await client.query('INSERT INTO "__schema_migrations" (id) VALUES ($1)', [migrationFile])
        await client.query('COMMIT')
      } catch (error) {
        await client.query('ROLLBACK')
        throw error
      }
    }
  })

  console.log('[db-migrate] Complete')
}

main().catch((error) => {
  console.error('[db-migrate] Failed:', error)
  process.exit(1)
})
