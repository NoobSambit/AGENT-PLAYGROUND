export type PersistenceMode =
  | 'firestore'
  | 'dual-write-firestore-read'
  | 'dual-write-postgres-read'
  | 'postgres'

const VALID_MODES = new Set<PersistenceMode>([
  'firestore',
  'dual-write-firestore-read',
  'dual-write-postgres-read',
  'postgres',
])

export function getPersistenceMode(): PersistenceMode {
  const raw = process.env.PERSISTENCE_MODE?.trim() as PersistenceMode | undefined
  if (raw && VALID_MODES.has(raw)) {
    return raw
  }

  return process.env.DATABASE_URL ? 'postgres' : 'firestore'
}

export function readsFromPostgres(mode: PersistenceMode = getPersistenceMode()): boolean {
  return mode === 'dual-write-postgres-read' || mode === 'postgres'
}

export function writesToPostgres(mode: PersistenceMode = getPersistenceMode()): boolean {
  return mode !== 'firestore'
}

export function writesToFirestore(mode: PersistenceMode = getPersistenceMode()): boolean {
  return mode !== 'postgres'
}

export function dualWrites(mode: PersistenceMode = getPersistenceMode()): boolean {
  return mode === 'dual-write-firestore-read' || mode === 'dual-write-postgres-read'
}
