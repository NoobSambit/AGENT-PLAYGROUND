import { NextRequest, NextResponse } from 'next/server'
import {
  writeCreativeArtifactToFirestore,
  writeCreativePipelineEventToFirestore,
  writeCreativeSessionToFirestore,
} from '@/lib/creative/firestoreStore'
import { getPersistenceMode } from '@/lib/db/persistence'
import { creativityService } from '@/lib/services/creativityService'

export async function POST(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: agentId, sessionId } = await params
    const detail = await creativityService.publishSession(agentId, sessionId)

    if (getPersistenceMode() !== 'postgres') {
      await writeCreativeSessionToFirestore(detail.session)
      for (const artifact of detail.artifacts) {
        await writeCreativeArtifactToFirestore(artifact)
      }
      for (const event of detail.pipelineEvents) {
        await writeCreativePipelineEventToFirestore(agentId, event)
      }
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('Creative publish error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to publish creative artifact' },
      { status: 500 }
    )
  }
}
