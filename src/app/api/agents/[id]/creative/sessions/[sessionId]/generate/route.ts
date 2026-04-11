import { NextRequest, NextResponse } from 'next/server'
import {
  writeCreativeArtifactToFirestore,
  writeCreativePipelineEventToFirestore,
  writeCreativeSessionToFirestore,
} from '@/lib/creative/firestoreStore'
import { getPersistenceMode } from '@/lib/db/persistence'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { creativityService } from '@/lib/services/creativityService'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: agentId, sessionId } = await params
    const providerInfo = getProviderInfoForRequest(request)
    const detail = await creativityService.generateSession(agentId, sessionId, providerInfo)

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
    console.error('Creative generation error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to generate creative artifact' },
      { status: 500 }
    )
  }
}
