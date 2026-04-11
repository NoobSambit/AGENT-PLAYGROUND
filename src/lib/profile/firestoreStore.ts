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
  ProfileAnalysisRun,
  ProfileInterviewTurn,
  ProfilePipelineEvent,
} from '@/types/database'

const PROFILE_RUNS_COLLECTION = 'profile_analysis_runs'
const PROFILE_TURNS_COLLECTION = 'profile_interview_turns'
const PROFILE_PIPELINE_COLLECTION = 'profile_pipeline_events'

function asProfileAnalysisRun(docSnap: { id: string; data: () => Record<string, unknown> }): ProfileAnalysisRun {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ProfileAnalysisRun, 'id'>),
  }
}

function asProfileInterviewTurn(docSnap: { id: string; data: () => Record<string, unknown> }): ProfileInterviewTurn {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ProfileInterviewTurn, 'id'>),
  }
}

function asProfilePipelineEvent(docSnap: { id: string; data: () => Record<string, unknown> }): ProfilePipelineEvent {
  return {
    id: docSnap.id,
    ...(docSnap.data() as Omit<ProfilePipelineEvent, 'id'>),
  }
}

export async function writeProfileAnalysisRunToFirestore(run: ProfileAnalysisRun): Promise<void> {
  const { id, ...data } = run
  await setDoc(
    doc(db, 'agents', run.agentId, PROFILE_RUNS_COLLECTION, id),
    stripUndefinedFields(data)
  )
}

export async function writeProfileInterviewTurnToFirestore(
  agentId: string,
  turn: ProfileInterviewTurn
): Promise<void> {
  const { id, ...data } = turn
  await setDoc(
    doc(db, 'agents', agentId, PROFILE_TURNS_COLLECTION, id),
    stripUndefinedFields(data)
  )
}

export async function writeProfilePipelineEventToFirestore(
  agentId: string,
  event: ProfilePipelineEvent
): Promise<void> {
  const { id, ...data } = event
  await setDoc(
    doc(db, 'agents', agentId, PROFILE_PIPELINE_COLLECTION, id),
    stripUndefinedFields(data)
  )
}

export async function listProfileAnalysisRunsFromFirestore(agentId: string, limitCount = 8): Promise<ProfileAnalysisRun[]> {
  const snapshot = await getDocs(query(
    collection(db, 'agents', agentId, PROFILE_RUNS_COLLECTION),
    orderBy('createdAt', 'desc'),
    limit(limitCount)
  ))

  return snapshot.docs.map(asProfileAnalysisRun)
}

export async function getProfileAnalysisRunDetailFromFirestore(
  agentId: string,
  runId: string
): Promise<{
  run: ProfileAnalysisRun | null
  interviewTurns: ProfileInterviewTurn[]
  pipelineEvents: ProfilePipelineEvent[]
}> {
  const runSnap = await getDoc(doc(db, 'agents', agentId, PROFILE_RUNS_COLLECTION, runId))
  const turnsSnap = await getDocs(query(
    collection(db, 'agents', agentId, PROFILE_TURNS_COLLECTION),
    where('runId', '==', runId),
    orderBy('order', 'asc')
  ))
  const pipelineSnap = await getDocs(query(
    collection(db, 'agents', agentId, PROFILE_PIPELINE_COLLECTION),
    where('runId', '==', runId),
    orderBy('createdAt', 'asc')
  ))

  return {
    run: runSnap.exists() ? asProfileAnalysisRun(runSnap) : null,
    interviewTurns: turnsSnap.docs.map(asProfileInterviewTurn),
    pipelineEvents: pipelineSnap.docs.map(asProfilePipelineEvent),
  }
}
