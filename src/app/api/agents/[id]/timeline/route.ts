import { NextRequest, NextResponse } from 'next/server'
import { timelineService } from '@/lib/services/timelineService'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const payload = await timelineService.getWorkspace(
      agentId,
      timelineService.parseQuery(request.nextUrl.searchParams)
    )
    return NextResponse.json(payload)
  } catch (error) {
    console.error('Timeline workspace error:', error)
    const message = error instanceof Error ? error.message : 'Failed to load timeline workspace'
    return NextResponse.json(
      { error: message },
      { status: message === 'Agent not found' ? 404 : 500 }
    )
  }
}
