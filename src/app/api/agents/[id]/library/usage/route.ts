import { NextRequest, NextResponse } from 'next/server'
import { LibraryService } from '@/lib/services/libraryService'
import {
  handleLibraryError,
  parseUsageBody,
  readJsonBody,
} from '../routeUtils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = parseUsageBody(await readJsonBody(request))
    const response = await LibraryService.recordUsage(agentId, body)

    return NextResponse.json(response)
  } catch (error) {
    return handleLibraryError(error, 'Failed to record Library usage')
  }
}
