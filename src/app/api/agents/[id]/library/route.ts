import { NextRequest, NextResponse } from 'next/server'
import { LibraryService } from '@/lib/services/libraryService'
import {
  handleLibraryError,
  parseBootstrapQuery,
} from './routeUtils'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const query = parseBootstrapQuery(request)
    const bootstrap = await LibraryService.bootstrapWorkspace(agentId, query)

    return NextResponse.json(bootstrap)
  } catch (error) {
    return handleLibraryError(error, 'Failed to load Library workspace')
  }
}
