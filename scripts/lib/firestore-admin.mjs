import { applicationDefault, cert, getApps, initializeApp } from 'firebase-admin/app'
import { getFirestore, Timestamp } from 'firebase-admin/firestore'

function getCredential() {
  if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
    return cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON))
  }

  if (
    process.env.FIREBASE_ADMIN_PROJECT_ID &&
    process.env.FIREBASE_ADMIN_CLIENT_EMAIL &&
    process.env.FIREBASE_ADMIN_PRIVATE_KEY
  ) {
    return cert({
      projectId: process.env.FIREBASE_ADMIN_PROJECT_ID,
      clientEmail: process.env.FIREBASE_ADMIN_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_ADMIN_PRIVATE_KEY.replace(/\\n/g, '\n'),
    })
  }

  return applicationDefault()
}

function getProjectId() {
  return (
    process.env.FIREBASE_ADMIN_PROJECT_ID ||
    process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID ||
    undefined
  )
}

export function getAdminFirestore() {
  if (getApps().length === 0) {
    initializeApp({
      credential: getCredential(),
      projectId: getProjectId(),
    })
  }

  return getFirestore()
}

export function toPlainJson(value) {
  if (value instanceof Timestamp) {
    return value.toDate().toISOString()
  }

  if (value instanceof Date) {
    return value.toISOString()
  }

  if (Array.isArray(value)) {
    return value.map((entry) => toPlainJson(entry))
  }

  if (value && typeof value === 'object') {
    if (typeof value.toDate === 'function') {
      return value.toDate().toISOString()
    }

    if ('_latitude' in value && '_longitude' in value) {
      return {
        latitude: value._latitude,
        longitude: value._longitude,
      }
    }

    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, toPlainJson(entry)])
    )
  }

  return value
}

export async function exportCollection(collectionRef, nestedCollections = []) {
  const snapshot = await collectionRef.get()
  const documents = []

  for (const docSnap of snapshot.docs) {
    const subcollections = {}

    for (const nestedName of nestedCollections) {
      const nestedSnapshot = await docSnap.ref.collection(nestedName).get()
      subcollections[nestedName] = nestedSnapshot.docs.map((nestedDoc) => ({
        id: nestedDoc.id,
        data: toPlainJson(nestedDoc.data()),
      }))
    }

    documents.push({
      id: docSnap.id,
      data: toPlainJson(docSnap.data()),
      subcollections,
    })
  }

  return documents
}
