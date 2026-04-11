import { NextRequest, NextResponse } from 'next/server'
import { getPersistenceMode, readsFromPostgres } from '@/lib/db/persistence'
import { getCreativeSessionDetailFromFirestore } from '@/lib/creative/firestoreStore'
import { creativityService } from '@/lib/services/creativityService'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; sessionId: string }> }
) {
  try {
    const { id: agentId, sessionId } = await params

    const detail = readsFromPostgres(getPersistenceMode())
      ? await creativityService.getSessionDetail(agentId, sessionId)
      : await getCreativeSessionDetailFromFirestore(agentId, sessionId)

    if (!detail.session) {
      return NextResponse.json({ error: 'Creative session not found' }, { status: 404 })
    }

    return NextResponse.json(detail)
  } catch (error) {
    console.error('Creative session detail error:', error)
    return NextResponse.json(
      { error: 'Failed to load creative session' },
      { status: 500 }
    )
  }
}
