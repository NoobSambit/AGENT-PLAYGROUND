import fs from 'fs/promises'
import path from 'path'
import { getAdminFirestore, exportCollection } from './lib/firestore-admin.mjs'
import { AGENT_SUBCOLLECTIONS, TOP_LEVEL_COLLECTIONS, getArgValue, summarizeExport } from './lib/migration-shared.mjs'

const args = process.argv.slice(2)
const outputPath = path.resolve(getArgValue(args, '--out', './tmp/firestore-export.json'))

async function main() {
  const firestore = getAdminFirestore()
  const collections = {}

  for (const collectionName of TOP_LEVEL_COLLECTIONS) {
    const nestedCollections = collectionName === 'agents' ? AGENT_SUBCOLLECTIONS : []
    collections[collectionName] = await exportCollection(
      firestore.collection(collectionName),
      nestedCollections
    )
  }

  const payload = {
    generatedAt: new Date().toISOString(),
    projectId: process.env.FIREBASE_ADMIN_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || null,
    collections,
  }

  await fs.mkdir(path.dirname(outputPath), { recursive: true })
  await fs.writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')

  console.log('[firestore-export] Complete')
  console.log(JSON.stringify({
    outputPath,
    summary: summarizeExport(payload),
  }, null, 2))
}

main().catch((error) => {
  console.error('[firestore-export] Failed:', error)
  process.exit(1)
})
