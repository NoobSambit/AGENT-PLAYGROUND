import { initializeApp } from 'firebase/app'
import {
  collection,
  deleteDoc,
  getDocs,
  getFirestore,
} from 'firebase/firestore'

const args = process.argv.slice(2)
const dryRun = !args.includes('--execute')
const confirmProjectArg = args.find((arg) => arg.startsWith('--confirm-project='))
const confirmedProjectId = confirmProjectArg?.split('=')[1]

const requiredEnvVars = [
  'NEXT_PUBLIC_FIREBASE_API_KEY',
  'NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN',
  'NEXT_PUBLIC_FIREBASE_PROJECT_ID',
  'NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET',
  'NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID',
  'NEXT_PUBLIC_FIREBASE_APP_ID',
]

const missingEnvVars = requiredEnvVars.filter((name) => !process.env[name])

if (missingEnvVars.length > 0) {
  console.error('Missing Firebase environment variables:')
  for (const name of missingEnvVars) {
    console.error(`- ${name}`)
  }
  process.exit(1)
}

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
}

const projectId = firebaseConfig.projectId

if (!confirmedProjectId || confirmedProjectId !== projectId) {
  console.error(`Refusing to continue without an exact confirmation for project "${projectId}".`)
  console.error(`Re-run with: --confirm-project=${projectId}`)
  process.exit(1)
}

const app = initializeApp(firebaseConfig, 'reset-firestore-script')
const db = getFirestore(app)

const topLevelCollections = [
  'messages',
  'memories',
  'memory_graphs',
  'shared_knowledge',
  'simulations',
  'challenges',
  'mentorships',
]

const agentSubcollections = [
  'relationships',
  'dreams',
  'journal_entries',
  'creative_works',
  'learning_patterns',
  'learning_goals',
  'learning_adaptations',
  'skill_progressions',
  'learning_events',
  'rate_limits',
]

function logStep(message) {
  console.log(`[reset-firestore] ${message}`)
}

async function deleteCollectionDocuments(pathSegments, summary) {
  const snapshot = await getDocs(collection(db, ...pathSegments))
  const pathLabel = pathSegments.join('/')

  summary[pathLabel] = (summary[pathLabel] || 0) + snapshot.size

  if (snapshot.empty) {
    return 0
  }

  if (!dryRun) {
    for (const docSnap of snapshot.docs) {
      await deleteDoc(docSnap.ref)
    }
  }

  return snapshot.size
}

async function resetAgents(summary) {
  const agentsSnapshot = await getDocs(collection(db, 'agents'))
  summary.agents = agentsSnapshot.size

  for (const agentDoc of agentsSnapshot.docs) {
    for (const subcollectionName of agentSubcollections) {
      await deleteCollectionDocuments(['agents', agentDoc.id, subcollectionName], summary)
    }

    if (!dryRun) {
      await deleteDoc(agentDoc.ref)
    }
  }
}

async function main() {
  const summary = {}

  logStep(`${dryRun ? 'Dry run' : 'Executing reset'} for Firestore project "${projectId}"`)

  await resetAgents(summary)

  for (const collectionName of topLevelCollections) {
    await deleteCollectionDocuments([collectionName], summary)
  }

  logStep(`${dryRun ? 'Dry run complete' : 'Reset complete'}`)
  console.log(JSON.stringify({ projectId, dryRun, deleted: summary }, null, 2))
}

main().catch((error) => {
  console.error('[reset-firestore] Failed:', error)
  process.exit(1)
})
