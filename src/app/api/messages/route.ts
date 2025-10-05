import { NextRequest, NextResponse } from 'next/server'
import { MessageService } from '@/lib/services/messageService'
import { CreateMessageData } from '@/types/database'

// GET /api/messages - Fetch messages (optionally filtered by room or agent)
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const roomId = searchParams.get('roomId')
    const agentId = searchParams.get('agentId')
    const limit = searchParams.get('limit')

    let messages

    if (roomId) {
      messages = await MessageService.getMessagesByRoomId(roomId)
    } else if (agentId) {
      messages = await MessageService.getMessagesByAgentId(agentId)
    } else {
      messages = await MessageService.getRecentMessages(limit ? parseInt(limit) : 50)
    }

    return NextResponse.json({
      success: true,
      data: messages
    })
  } catch (error) {
    console.error('Failed to fetch messages:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to fetch messages' },
      { status: 500 }
    )
  }
}

// POST /api/messages - Send a new message
export async function POST(request: NextRequest) {
  try {
    const body: CreateMessageData = await request.json()

    // Validate required fields
    if (!body.content || !body.agentId) {
      return NextResponse.json(
        { success: false, error: 'Content and agentId are required' },
        { status: 400 }
      )
    }

    const newMessage = await MessageService.createMessage(body)

    if (!newMessage) {
      return NextResponse.json(
        { success: false, error: 'Failed to create message' },
        { status: 500 }
      )
    }

    return NextResponse.json({
      success: true,
      data: newMessage
    }, { status: 201 })
  } catch (error) {
    console.error('Failed to create message:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to create message' },
      { status: 500 }
    )
  }
}
