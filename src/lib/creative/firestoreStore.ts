import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
  where,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { stripUndefinedFields } from '@/lib/firestoreUtils'
import type {
  CreativeArtifact,
  CreativeLibraryItem,
  CreativePipelineEvent,
  CreativeSession,
} from '@/types/database'

const CREATIVE_SESSIONS_COLLECTION = 'creative_sessions'
const CREATIVE_ARTIFACTS_COLLECTION = 'creative_artifacts'
const CREATIVE_PIPELINE_COLLECTION = 'creative_pipeline_events'

function asCreativeSession(docSnap: { id: string; data: () => Record<string, unknown> }): CreativeSession {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<CreativeSession, 'id'>),
  }
}

function asCreativeArtifact(docSnap: { id: string; data: () => Record<string, unknown> }): CreativeArtifact {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<CreativeArtifact, 'id'>),
  }
}

function asCreativePipelineEvent(docSnap: { id: string; data: () => Record<string, unknown> }): CreativePipelineEvent {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<CreativePipelineEvent, 'id'>),
  }
}

export async function writeCreativeSessionToFirestore(session: CreativeSession): Promise<void> {
  const { id, ...data } = session
  await setDoc(
    doc(db, 'agents', session.agentId, CREATIVE_SESSIONS_COLLECTION, id),
    stripUndefinedFields(data)
  )
}

export async function writeCreativeArtifactToFirestore(artifact: CreativeArtifact): Promise<void> {
  const { id, ...data } = artifact
  await setDoc(
    doc(db, 'agents', artifact.agentId, CREATIVE_ARTIFACTS_COLLECTION, id),
    stripUndefinedFields(data)
  )
}

export async function writeCreativePipelineEventToFirestore(
  agentId: string,
  event: CreativePipelineEvent
): Promise<void> {
  const { id, ...data } = event
  await setDoc(
    doc(db, 'agents', agentId, CREATIVE_PIPELINE_COLLECTION, id),
    stripUndefinedFields(data)
  )
}

export async function listCreativeSessionsFromFirestore(agentId: string, limitCount = 6): Promise<CreativeSession[]> {
  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, CREATIVE_SESSIONS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))

  return snapshot.docs.map(asCreativeSession)
}

export async function listCreativeLibraryFromFirestore(agentId: string): Promise<CreativeLibraryItem[]> {
  const artifactSnapshot = await getDocs(query(
    collection(db, 'agents', agentId, CREATIVE_ARTIFACTS_COLLECTION),
    where('status', '==', 'published'),
    orderBy('createdAt', 'desc'),
    limit(24)
  ))

  const sessionSnapshot = await getDocs(query(
    collection(db, 'agents', agentId, CREATIVE_SESSIONS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(50)
  ))
  const sessionsById = new Map(sessionSnapshot.docs.map((docSnap) => {
    const session = asCreativeSession(docSnap)
    return [session.id, session]
  }))

  return artifactSnapshot.docs
    .map(asCreativeArtifact)
    .map((artifact) => {
      const session = sessionsById.get(artifact.sessionId)
      return session ? { session, artifact } : null
    })
    .filter((entry): entry is CreativeLibraryItem => Boolean(entry))
}

export async function getCreativeSessionDetailFromFirestore(
  agentId: string,
  sessionId: string
): Promise<{
  session: CreativeSession | null
  artifacts: CreativeArtifact[]
  pipelineEvents: CreativePipelineEvent[]
}> {
  const sessionSnap = await getDoc(doc(db, 'agents', agentId, CREATIVE_SESSIONS_COLLECTION, sessionId))
  const artifactsSnap = await getDocs(query(
    collection(db, 'agents', agentId, CREATIVE_ARTIFACTS_COLLECTION),
    where('sessionId', '==', sessionId),
    orderBy('version', 'desc')
  ))
  const pipelineSnap = await getDocs(query(
    collection(db, 'agents', agentId, CREATIVE_PIPELINE_COLLECTION),
    where('sessionId', '==', sessionId),
    orderBy('createdAt', 'desc')
  ))

  return {
    session: sessionSnap.exists() ? asCreativeSession(sessionSnap) : null,
    artifacts: artifactsSnap.docs.map(asCreativeArtifact),
    pipelineEvents: pipelineSnap.docs.map(asCreativePipelineEvent),
  }
}
