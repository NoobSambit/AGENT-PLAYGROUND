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
  Dream,
  DreamPipelineEvent,
  DreamSession,
  DreamSessionDetail,
} from '@/types/database'

const DREAM_SESSIONS_COLLECTION = 'dream_sessions'
const DREAMS_COLLECTION = 'dreams'
const DREAM_PIPELINE_COLLECTION = 'dream_pipeline_events'

function asDreamSession(docSnap: { id: string; data: () => Record<string, unknown> }): DreamSession {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<DreamSession, 'id'>),
  }
}

function asDream(docSnap: { id: string; data: () => Record<string, unknown> }): Dream {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<Dream, 'id'>),
  }
}

function asDreamPipelineEvent(docSnap: { id: string; data: () => Record<string, unknown> }): DreamPipelineEvent {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<DreamPipelineEvent, 'id'>),
  }
}

export async function writeDreamSessionToFirestore(session: DreamSession): Promise<void> {
  const { id, ...data } = session
  await setDoc(doc(db, 'agents', session.agentId, DREAM_SESSIONS_COLLECTION, id), stripUndefinedFields(data))
}

export async function writeDreamToFirestore(dream: Dream): Promise<void> {
  const { id, ...data } = dream
  await setDoc(doc(db, 'agents', dream.agentId, DREAMS_COLLECTION, id), stripUndefinedFields(data))
}

export async function writeDreamPipelineEventToFirestore(agentId: string, event: DreamPipelineEvent): Promise<void> {
  const { id, ...data } = event
  await setDoc(doc(db, 'agents', agentId, DREAM_PIPELINE_COLLECTION, id), stripUndefinedFields(data))
}

export async function listDreamSessionsFromFirestore(agentId: string, limitCount = 8): Promise<DreamSession[]> {
  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, DREAM_SESSIONS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))
  return snapshot.docs.map(asDreamSession)
}

export async function listSavedDreamsFromFirestore(agentId: string, limitCount = 12): Promise<Dream[]> {
  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, DREAMS_COLLECTION),
    where('status', '==', 'saved'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))
  return snapshot.docs.map(asDream)
}

export async function getDreamSessionDetailFromFirestore(agentId: string, sessionId: string): Promise<DreamSessionDetail> {
  const sessionSnap = await getDoc(doc(db, 'agents', agentId, DREAM_SESSIONS_COLLECTION, sessionId))
  const dreamsSnap = await getDocs(query(
    collection(db, 'agents', agentId, DREAMS_COLLECTION),
    where('sessionId', '==', sessionId),
    orderBy('version', 'desc')
  ))
  const pipelineSnap = await getDocs(query(
    collection(db, 'agents', agentId, DREAM_PIPELINE_COLLECTION),
    where('sessionId', '==', sessionId),
    orderBy('createdAt', 'desc')
  ))

  return {
    session: sessionSnap.exists() ? asDreamSession(sessionSnap) : null,
    dreams: dreamsSnap.docs.map(asDream),
    pipelineEvents: pipelineSnap.docs.map(asDreamPipelineEvent),
  }
}
