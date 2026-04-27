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
import type { ChallengeEvent, ChallengeParticipantResult, ChallengeRun } from '@/types/database'

const CHALLENGE_RUNS_COLLECTION = 'challenge_runs'
const CHALLENGE_EVENTS_COLLECTION = 'events'
const CHALLENGE_RESULTS_COLLECTION = 'participant_results'

function asRun(docSnap: { id: string; data: () => Record<string, unknown> }): ChallengeRun {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ChallengeRun, 'id'>),
  }
}

function asEvent(docSnap: { id: string; data: () => Record<string, unknown> }): ChallengeEvent {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ChallengeEvent, 'id'>),
  }
}

function asResult(docSnap: { id: string; data: () => Record<string, unknown> }): ChallengeParticipantResult {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ChallengeParticipantResult, 'id'>),
  }
}

export async function writeChallengeRunToFirestore(run: ChallengeRun): Promise<void> {
  const { id, ...data } = run
  await setDoc(doc(db, CHALLENGE_RUNS_COLLECTION, id), stripUndefinedFields(data))
}

export async function writeChallengeEventToFirestore(event: ChallengeEvent): Promise<void> {
  const { id, ...data } = event
  await setDoc(
    doc(db, CHALLENGE_RUNS_COLLECTION, event.runId, CHALLENGE_EVENTS_COLLECTION, id),
    stripUndefinedFields(data)
  )
}

export async function writeChallengeParticipantResultToFirestore(result: ChallengeParticipantResult): Promise<void> {
  const { id, ...data } = result
  await setDoc(
    doc(db, CHALLENGE_RUNS_COLLECTION, result.runId, CHALLENGE_RESULTS_COLLECTION, id),
    stripUndefinedFields(data)
  )
}

export async function getChallengeRunFromFirestore(runId: string): Promise<ChallengeRun | null> {
  const snapshot = await getDoc(doc(db, CHALLENGE_RUNS_COLLECTION, runId))
  return snapshot.exists() ? asRun(snapshot) : null
}

export async function listChallengeRunsForAgentFromFirestore(agentId: string, limitCount = 12): Promise<ChallengeRun[]> {
  const snapshot = await getDocs(query(
    collection(db, CHALLENGE_RUNS_COLLECTION),
    where('participantIds', 'array-contains', agentId),
    orderBy('updatedAt', 'desc'),
    limit(limitCount)
  ))
  return snapshot.docs.map(asRun)
}

export async function getActiveChallengeRunForAgentFromFirestore(agentId: string): Promise<ChallengeRun | null> {
  const snapshot = await getDocs(query(
    collection(db, CHALLENGE_RUNS_COLLECTION),
    where('participantIds', 'array-contains', agentId),
    where('status', '==', 'running'),
    orderBy('updatedAt', 'desc'),
    limit(1)
  ))
  return snapshot.docs[0] ? asRun(snapshot.docs[0]) : null
}

export async function listChallengeEventsFromFirestore(runId: string): Promise<ChallengeEvent[]> {
  const snapshot = await getDocs(query(
    collection(db, CHALLENGE_RUNS_COLLECTION, runId, CHALLENGE_EVENTS_COLLECTION),
    orderBy('sequence', 'asc')
  ))
  return snapshot.docs.map(asEvent)
}

export async function listChallengeParticipantResultsFromFirestore(runId: string): Promise<ChallengeParticipantResult[]> {
  const snapshot = await getDocs(query(
    collection(db, CHALLENGE_RUNS_COLLECTION, runId, CHALLENGE_RESULTS_COLLECTION),
    orderBy('createdAt', 'asc')
  ))
  return snapshot.docs.map(asResult)
}

export async function listChallengeResultHistoryFromFirestore(agentId: string, limitCount = 12): Promise<ChallengeParticipantResult[]> {
  const runs = await listChallengeRunsForAgentFromFirestore(agentId, limitCount)
  const resultGroups = await Promise.all(runs.map((run) => listChallengeParticipantResultsFromFirestore(run.id)))
  return resultGroups
    .flat()
    .filter((result) => result.agentId === agentId)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, limitCount)
}
