import { NextRequest, NextResponse } from 'next/server'
import { LibraryService } from '@/lib/services/libraryService'
import {
  errorResponse,
  handleLibraryError,
} from '../../routeUtils'

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; itemId: string }> }
) {
  try {
    const { id: agentId, itemId } = await params
    const detail = await LibraryService.getItemDetail(agentId, itemId)

    if (!detail) {
      return errorResponse('not_found', 'Library item not found', 404)
    }

    return NextResponse.json(detail)
  } catch (error) {
    return handleLibraryError(error, 'Failed to load Library item')
  }
}
