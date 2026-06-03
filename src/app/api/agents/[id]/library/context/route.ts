import { NextRequest, NextResponse } from 'next/server'
import { LibraryService } from '@/lib/services/libraryService'
import {
  handleLibraryError,
  parseContextBody,
  readJsonBody,
} from '../routeUtils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = parseContextBody(await readJsonBody(request))
    const packet = await LibraryService.getContextPacket(agentId, body)

    return NextResponse.json(packet)
  } catch (error) {
    return handleLibraryError(error, 'Failed to load Library context')
  }
}
