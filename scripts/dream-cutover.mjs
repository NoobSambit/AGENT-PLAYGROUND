import { withPgClient } from './lib/postgres.mjs'
import { initializeApp } from 'firebase/app'
import { collection, deleteDoc, doc, getDocs, getFirestore, updateDoc } from 'firebase/firestore'

const args = process.argv.slice(2)
const execute = args.includes('--execute')
const confirmReset = args.includes('--confirm-cutover')
const confirmProjectArg = args.find((arg) => arg.startsWith('--confirm-project='))
const confirmedProjectId = confirmProjectArg?.split('=')[1]

function log(message) {
  console.log(`[dream-cutover] ${message}`)
}

async function resetPostgres(summary) {
  await withPgClient(async (client) => {
    const { rows } = await client.query(`
      SELECT
        (SELECT COUNT(*)::int FROM dream_sessions) AS sessions,
        (SELECT COUNT(*)::int FROM dreams) AS dreams,
        (SELECT COUNT(*)::int FROM dream_pipeline_events) AS events
    `)

    summary.postgres = rows[0]
    if (!execute) return

    await client.query('BEGIN')
    try {
      await client.query('DELETE FROM dream_pipeline_events')
      await client.query('DELETE FROM dreams')
      await client.query('DELETE FROM dream_sessions')
      await client.query(`
        UPDATE agents
        SET
          dream_count = 0,
          active_dream_impression = NULL,
          stats = CASE
            WHEN stats IS NULL THEN NULL
            ELSE jsonb_set(stats, '{dreamsGenerated}', '0'::jsonb, true)
          END
      `)
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK')
      throw error
    }
  })
}

async function resetFirestore(summary) {
  const requiredEnvVars = [
    'NEXT_PUBLIC_FIREBASE_API_KEY',
    'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
    'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
    'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
    'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
    'NEXT_PUBLIC_FIREBASE_APP_ID',
  ]

  const missing = requiredEnvVars.filter((name) => !process.env[name])
  if (missing.length > 0) {
    summary.firestore = { skipped: true, reason: `Missing env vars: ${missing.join(', ')}` }
    return
  }

  const firebaseConfig = {
    apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
    authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
    projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  }

  if (execute && confirmedProjectId !== firebaseConfig.projectId) {
    throw new Error(`Refusing Firestore cutover without --confirm-project=${firebaseConfig.projectId}`)
  }

  const app = initializeApp(firebaseConfig, 'dream-cutover-script')
  const db = getFirestore(app)
  const agentsSnapshot = await getDocs(collection(db, 'agents'))
  const counts = {
    agents: agentsSnapshot.size,
    dreams: 0,
    dream_sessions: 0,
    dream_pipeline_events: 0,
  }

  for (const agentDoc of agentsSnapshot.docs) {
    for (const collectionName of ['dreams', 'dream_sessions', 'dream_pipeline_events']) {
      const subcollection = await getDocs(collection(db, 'agents', agentDoc.id, collectionName))
      counts[collectionName] += subcollection.size
      if (execute) {
        for (const docSnap of subcollection.docs) {
          await deleteDoc(docSnap.ref)
        }
      }
    }

    if (execute) {
      const nextStats = agentDoc.data().stats && typeof agentDoc.data().stats === 'object'
        ? { ...agentDoc.data().stats, dreamsGenerated: 0 }
        : agentDoc.data().stats
      await updateDoc(doc(db, 'agents', agentDoc.id), {
        dreamCount: 0,
        activeDreamImpression: null,
        ...(nextStats ? { stats: nextStats } : {}),
      })
    }
  }

  summary.firestore = counts
}

async function main() {
  if (!confirmReset) {
    console.error('Refusing to run dream cutover without --confirm-cutover.')
    process.exit(1)
  }

  const summary = { execute }
  log(`${execute ? 'Executing' : 'Dry run'} destructive Dream V2 cutover`)
  await resetPostgres(summary)
  await resetFirestore(summary)
  log(`${execute ? 'Cutover complete' : 'Dry run complete'}`)
  console.log(JSON.stringify(summary, null, 2))
}

main().catch((error) => {
  console.error('[dream-cutover] Failed:', error)
  process.exit(1)
})
