import { NextRequest, NextResponse } from 'next/server'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { chatTurnService } from '@/lib/services/chatTurnService'

interface ChatRequestBody {
  prompt: string
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: agentId } = await params
    const body = await request.json() as ChatRequestBody

    if (!body.prompt?.trim()) {
      return NextResponse.json(
        { success: false, error: 'prompt is required' },
        { status: 400 }
      )
    }

    const providerInfo = getProviderInfoForRequest(request)
    const turn = await chatTurnService.runTurn({
      agentId,
      prompt: body.prompt.trim(),
      conversationHistory: body.conversationHistory || [],
      providerInfo,
      llmConfig: providerInfo ? {
        provider: providerInfo.provider,
        model: providerInfo.model,
      } : undefined,
    })

    return NextResponse.json({
      success: true,
      userMessage: turn.userMessage,
      agentMessage: turn.agentMessage,
      agent: turn.agent,
      emotionSummary: turn.emotionSummary,
      reasoning: turn.response.reasoning,
      toolsUsed: turn.response.toolsUsed,
      memoryUsed: turn.response.memoryUsed,
      model: providerInfo?.model || null,
      provider: providerInfo?.provider || null,
    })
  } catch (error) {
    console.error('Agent chat error:', error)
    return NextResponse.json(
      { success: false, error: 'Failed to process chat turn' },
      { status: 500 }
    )
  }
}
