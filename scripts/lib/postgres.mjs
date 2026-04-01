import { Client } from 'pg'

export function requireDatabaseUrl() {
  const url = process.env.DATABASE_URL?.trim()
  if (!url) {
    throw new Error('DATABASE_URL is required')
  }

  return url
}

export async function withPgClient(callback) {
  const client = new Client({ connectionString: requireDatabaseUrl() })
  await client.connect()

  try {
    return await callback(client)
  } finally {
    await client.end()
  }
}

function quoteIdentifier(identifier) {
  return `"${identifier.replace(/"/g, '""')}"`
}

export async function upsertRow(client, tableName, row, conflictColumns = ['id']) {
  const entries = Object.entries(row).filter(([, value]) => value !== undefined)
  if (entries.length === 0) {
    return
  }

  const columns = entries.map(([column]) => quoteIdentifier(column))
  const values = entries.map(([, value]) => value)
  const placeholders = entries.map((_, index) => `$${index + 1}`)
  const updateAssignments = entries
    .filter(([column]) => !conflictColumns.includes(column))
    .map(([column]) => `${quoteIdentifier(column)} = EXCLUDED.${quoteIdentifier(column)}`)

  const conflictTarget = conflictColumns.map(quoteIdentifier).join(', ')
  const updateClause = updateAssignments.length > 0
    ? `DO UPDATE SET ${updateAssignments.join(', ')}`
    : 'DO NOTHING'

  const sql = `
    INSERT INTO ${quoteIdentifier(tableName)} (${columns.join(', ')})
    VALUES (${placeholders.join(', ')})
    ON CONFLICT (${conflictTarget}) ${updateClause}
  `

  await client.query(sql, values)
}

export async function countTable(client, tableName) {
  const { rows } = await client.query(`SELECT COUNT(*)::int AS count FROM "${tableName}"`)
  return rows[0]?.count || 0
}
