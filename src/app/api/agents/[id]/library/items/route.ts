import { NextRequest, NextResponse } from 'next/server'
import { LibraryService } from '@/lib/services/libraryService'
import {
  handleLibraryError,
  parseCreateManualBody,
  readJsonBody,
} from '../routeUtils'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = parseCreateManualBody(await readJsonBody(request))
    const response = await LibraryService.createManualItem(agentId, body)

    return NextResponse.json(response, { status: 201 })
  } catch (error) {
    return handleLibraryError(error, 'Failed to create Library item')
  }
}
