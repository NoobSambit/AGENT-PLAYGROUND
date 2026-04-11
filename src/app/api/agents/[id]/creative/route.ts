import { NextRequest, NextResponse } from 'next/server'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import {
  listCreativeLibraryFromFirestore,
  listCreativeSessionsFromFirestore,
  writeCreativeSessionToFirestore,
} from '@/lib/creative/firestoreStore'
import { creativityService } from '@/lib/services/creativityService'
import { AgentService } from '@/lib/services/agentService'

interface CreateSessionRequest {
  format?: string
  intent?: string
  audience?: string
  tone?: string
  length?: string
  mustInclude?: string[] | string
  avoid?: string[] | string
  referenceNotes?: string
  rawPrompt?: string
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params

    if (readsFromPostgres(getPersistenceMode())) {
      const payload = await creativityService.getBootstrap(agentId)
      return NextResponse.json(payload)
    }

    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      return NextResponse.json({ error: 'Agent not found' }, { status: 404 })
    }

    const defaults = creativityService.createSuggestedBrief(agent)
    const contextPacket = await creativityService.buildContextPacket(agent, defaults)
    const recentSessions = await listCreativeSessionsFromFirestore(agentId)
    const library = await listCreativeLibraryFromFirestore(agentId)

    return NextResponse.json({
      agent: {
        id: agent.id,
        name: agent.name,
        creativeWorks: agent.creativeWorks,
      },
      formats: ['story', 'poem', 'song', 'dialogue', 'essay'],
      tones: ['cinematic', 'lyrical', 'playful', 'intimate', 'dramatic', 'philosophical', 'experimental', 'hopeful', 'melancholic'],
      lengths: ['short', 'medium', 'long'],
      defaults,
      candidateSignals: contextPacket.selectedSignals.slice(0, 8),
      recentSessions,
      library,
    })
  } catch (error) {
    console.error('Creative bootstrap error:', error)
    return NextResponse.json(
      { error: 'Failed to load creative studio' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json() as CreateSessionRequest
    const session = await creativityService.createSession(agentId, body)

    if (getPersistenceMode() !== 'postgres') {
      await writeCreativeSessionToFirestore(session)
    }

    return NextResponse.json({ session }, { status: 201 })
  } catch (error) {
    console.error('Create creative session error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create creative session' },
      { status: 500 }
    )
  }
}
