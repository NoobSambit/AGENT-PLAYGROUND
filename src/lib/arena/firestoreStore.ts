import {
  collection,
  doc,
  getDoc,
  getDocs,
  limit,
  orderBy,
  query,
  setDoc,
} from 'firebase/firestore'
import { db } from '@/lib/firebase'
import { stripUndefinedFields } from '@/lib/firestoreUtils'
import type { ArenaEvent, ArenaRun, ArenaRunSummary } from '@/types/database'

const ARENA_RUNS_COLLECTION = 'arena_runs'
const ARENA_EVENTS_COLLECTION = 'events'

function asArenaRun(docSnap: { id: string; data: () => Record<string, unknown> }): ArenaRun {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ArenaRun, 'id'>),
  }
}

function asArenaEvent(docSnap: { id: string; data: () => Record<string, unknown> }): ArenaEvent {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ArenaEvent, 'id'>),
  }
}

function toArenaRunSummary(run: ArenaRun): ArenaRunSummary {
  return {
    id: run.id,
    status: run.status,
    latestStage: run.latestStage,
    topic: run.config.topic,
    objective: run.config.objective,
    participantIds: run.participantIds,
    participantNames: run.participants.map((participant) => participant.name),
    roundCount: run.config.roundCount,
    currentRound: run.currentRound,
    winnerAgentId: run.winnerAgentId,
    winnerAgentName: run.participants.find((participant) => participant.id === run.winnerAgentId)?.name,
    eventCount: run.eventCount,
    provider: run.provider,
    model: run.model,
    createdAt: run.createdAt,
    updatedAt: run.updatedAt,
    completedAt: run.completedAt,
  }
}

export async function writeArenaRunToFirestore(run: ArenaRun): Promise<void> {
  const { id, ...data } = run
  await setDoc(doc(db, ARENA_RUNS_COLLECTION, id), stripUndefinedFields(data))
}

export async function writeArenaEventToFirestore(event: ArenaEvent): Promise<void> {
  const { id, ...data } = event
  await setDoc(doc(db, ARENA_RUNS_COLLECTION, event.runId, ARENA_EVENTS_COLLECTION, id), stripUndefinedFields(data))
}

export async function getArenaRunFromFirestore(runId: string): Promise<ArenaRun | null> {
  const snapshot = await getDoc(doc(db, ARENA_RUNS_COLLECTION, runId))
  return snapshot.exists() ? asArenaRun(snapshot) : null
}

export async function listArenaRunSummariesFromFirestore(limitCount = 10): Promise<ArenaRunSummary[]> {
  const snapshot = await getDocs(query(
    collection(db, ARENA_RUNS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))

  return snapshot.docs.map(asArenaRun).map(toArenaRunSummary)
}

export async function listArenaRunsFromFirestore(limitCount = 10): Promise<ArenaRun[]> {
  const snapshot = await getDocs(query(
    collection(db, ARENA_RUNS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))

  return snapshot.docs.map(asArenaRun)
}

export async function listArenaEventsFromFirestore(runId: string): Promise<ArenaEvent[]> {
  const snapshot = await getDocs(query(
    collection(db, ARENA_RUNS_COLLECTION, runId, ARENA_EVENTS_COLLECTION),
    orderBy('sequence', 'asc')
  ))

  return snapshot.docs.map(asArenaEvent)
}
