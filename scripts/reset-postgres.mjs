import { withPgClient } from './lib/postgres.mjs'

const args = process.argv.slice(2)
const execute = args.includes('--execute')
const confirmed = args.includes('--confirm-reset')

const TABLES = [
  'migration_outbox',
  'simulations',
  'mentorships',
  'challenges',
  'conflicts',
  'collective_broadcasts',
  'shared_knowledge',
  'agent_rate_limits',
  'skill_progressions',
  'learning_events',
  'learning_adaptations',
  'learning_goals',
  'learning_patterns',
  'journal_entries',
  'dreams',
  'creative_works',
  'agent_relationships',
  'memory_graphs',
  'memories',
  'messages',
  'agents',
  '__schema_migrations',
]

async function main() {
  if (!confirmed) {
    console.error('Refusing to reset PostgreSQL without --confirm-reset.')
    process.exit(1)
  }

  console.log(`[reset-postgres] ${execute ? 'Executing' : 'Dry run'} reset against configured DATABASE_URL`)

  if (!execute) {
    console.log(JSON.stringify({ tables: TABLES, dryRun: true }, null, 2))
    return
  }

  await withPgClient(async (client) => {
    for (const table of TABLES) {
      await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`)
    }
  })

  console.log('[reset-postgres] Reset complete')
}

main().catch((error) => {
  console.error('[reset-postgres] Failed:', error)
  process.exit(1)
})
