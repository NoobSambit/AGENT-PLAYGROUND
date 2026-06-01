import { NextRequest, NextResponse } from 'next/server'
import { LibraryService } from '@/lib/services/libraryService'
import {
  handleLibraryError,
  parseActionBody,
  readJsonBody,
} from '../../../routeUtils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: agentId, itemId } = await params
    const body = parseActionBody(await readJsonBody(request))
    const response = await LibraryService.runAction(agentId, itemId, body)

    return NextResponse.json(response)
  } catch (error) {
    return handleLibraryError(error, 'Failed to update Library item')
  }
}
