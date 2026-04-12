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
  JournalEntry,
  JournalPipelineEvent,
  JournalSession,
  JournalSessionDetail,
} from '@/types/database'

const JOURNAL_SESSIONS_COLLECTION = 'journal_sessions'
const JOURNAL_ENTRIES_COLLECTION = 'journal_entries'
const JOURNAL_PIPELINE_COLLECTION = 'journal_pipeline_events'

function asSession(docSnap: { id: string; data: () => Record<string, unknown> }): JournalSession {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<JournalSession, 'id'>),
  }
}

function asEntry(docSnap: { id: string; data: () => Record<string, unknown> }): JournalEntry {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<JournalEntry, 'id'>),
  }
}

function asPipelineEvent(docSnap: { id: string; data: () => Record<string, unknown> }): JournalPipelineEvent {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<JournalPipelineEvent, 'id'>),
  }
}

export async function writeJournalSessionToFirestore(session: JournalSession): Promise<void> {
  const { id, ...data } = session
  await setDoc(doc(db, 'agents', session.agentId, JOURNAL_SESSIONS_COLLECTION, id), stripUndefinedFields(data))
}

export async function writeJournalEntryToFirestore(entry: JournalEntry): Promise<void> {
  const { id, ...data } = entry
  await setDoc(doc(db, 'agents', entry.agentId, JOURNAL_ENTRIES_COLLECTION, id), stripUndefinedFields(data))
}

export async function writeJournalPipelineEventToFirestore(
  agentId: string,
  event: JournalPipelineEvent
): Promise<void> {
  const { id, ...data } = event
  await setDoc(doc(db, 'agents', agentId, JOURNAL_PIPELINE_COLLECTION, id), stripUndefinedFields(data))
}

export async function listJournalSessionsFromFirestore(agentId: string, limitCount = 8): Promise<JournalSession[]> {
  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, JOURNAL_SESSIONS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))
  return snapshot.docs.map(asSession)
}

export async function listSavedJournalEntriesFromFirestore(agentId: string, limitCount = 12): Promise<JournalEntry[]> {
  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, JOURNAL_ENTRIES_COLLECTION),
    where('status', '==', 'saved'),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))
  return snapshot.docs.map(asEntry)
}

export async function getJournalSessionDetailFromFirestore(
  agentId: string,
  sessionId: string
): Promise<JournalSessionDetail> {
  const sessionSnap = await getDoc(doc(db, 'agents', agentId, JOURNAL_SESSIONS_COLLECTION, sessionId))
  const entriesSnap = await getDocs(query(
    collection(db, 'agents', agentId, JOURNAL_ENTRIES_COLLECTION),
    where('sessionId', '==', sessionId),
    orderBy('version', 'desc')
  ))
  const pipelineSnap = await getDocs(query(
    collection(db, 'agents', agentId, JOURNAL_PIPELINE_COLLECTION),
    where('sessionId', '==', sessionId),
    orderBy('createdAt', 'desc')
  ))

  return {
    session: sessionSnap.exists() ? asSession(sessionSnap) : null,
    entries: entriesSnap.docs.map(asEntry),
    pipelineEvents: pipelineSnap.docs.map(asPipelineEvent),
  }
}
