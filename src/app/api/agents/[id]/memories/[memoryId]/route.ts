import { NextResponse } from 'next/server'
import { MemoryService } from '@/lib/services/memoryService'

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string; memoryId: string }> }
) {
  try {
    const { id: agentId, memoryId } = await params
    const memory = await MemoryService.getMemoryById(memoryId)

    if (!memory || memory.agentId !== agentId) {
      return NextResponse.json(
        { error: 'Memory not found' },
        { status: 404 }
      )
    }

    const success = await MemoryService.deleteMemory(memoryId)
    if (!success) {
      return NextResponse.json(
        { error: 'Failed to delete memory' },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Delete agent memory error:', error)
    return NextResponse.json(
      { error: 'Failed to delete memory' },
      { status: 500 }
    )
  }
}
