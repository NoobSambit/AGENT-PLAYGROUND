import { NextRequest, NextResponse } from 'next/server'
import { BaseChain } from '@/lib/langchain/baseChain'

interface MultiAgentRequest {
  agents: Array<{
    id: string
    name: string
    persona: string
    goals: string[]
  }>
  maxRounds?: number
  initialPrompt?: string
}

interface SimulationMessage {
  id: string
  agentId: string
  agentName: string
  content: string
  timestamp: string
  round: number
}

interface SimulationResponse {
  simulationId: string
  messages: SimulationMessage[]
  isComplete: boolean
  currentRound: number
  maxRounds: number
}

export async function POST(request: NextRequest) {
  try {
    const body: MultiAgentRequest = await request.json()

    if (!body.agents || body.agents.length < 2) {
      return NextResponse.json(
        { error: 'At least 2 agents are required for multi-agent simulation' },
        { status: 400 }
      )
    }

    const maxRounds = body.maxRounds || 6
    const simulationId = `sim_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`

    // Initialize conversation with system prompt or initial user message
    const messages: SimulationMessage[] = []
    let currentRound = 0

    // Start conversation with each agent taking turns
    while (currentRound < maxRounds && messages.length < maxRounds * body.agents.length) {
      currentRound++

      for (const agent of body.agents) {
        if (messages.length >= maxRounds * body.agents.length) break

        // Build conversation context for this agent
        const conversationHistory = messages.map(msg => ({
          role: (msg.agentId === agent.id ? 'assistant' : 'user') as 'user' | 'assistant',
          content: `${msg.agentName}: ${msg.content}`
        }))

        // Add system context
        const systemPrompt = `You are ${agent.name}, an AI agent with the following persona: ${agent.persona}

Your goals are: ${agent.goals.join(', ')}

You are participating in a multi-agent conversation. Respond naturally and helpfully, staying in character. Keep responses conversational but focused on your role.`

        // Generate response using LangChain-powered LLM endpoint
        const prompt = body.initialPrompt && currentRound === 1 ? body.initialPrompt : 'Continue the conversation naturally.'

        const baseChain = BaseChain.getInstance()
        const messagesForLlm = baseChain.formatMessages(
          systemPrompt,
          conversationHistory,
          prompt
        )
        const responseText = await baseChain.generateResponse(messagesForLlm)

        // Create message from LangChain response
        const agentMessage: SimulationMessage = {
          id: `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
          agentId: agent.id,
          agentName: agent.name,
          content: responseText,
          timestamp: new Date().toISOString(),
          round: currentRound
        }

        messages.push(agentMessage)

        // Add small delay between agent responses for realism
        await new Promise(resolve => setTimeout(resolve, 1000))
      }
    }

    // Store simulation in Firestore
    try {
      const { initializeApp, getApps, getApp } = await import('firebase/app')
      const { getFirestore, collection, addDoc } = await import('firebase/firestore')

      // Initialize Firebase if not already done
      const app = getApps().length > 0 ? getApp() : initializeApp({
        apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
        authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
      })

      const db = getFirestore(app)

      await addDoc(collection(db, 'simulations'), {
        id: simulationId,
        agents: body.agents,
        messages: messages,
        maxRounds: maxRounds,
        createdAt: new Date().toISOString(),
        isComplete: true,
        finalRound: currentRound
      })
    } catch (firestoreError) {
      console.error('Failed to save simulation to Firestore:', firestoreError)
      // Continue even if Firestore fails
    }

    const simulationResponse: SimulationResponse = {
      simulationId,
      messages,
      isComplete: currentRound >= maxRounds,
      currentRound,
      maxRounds
    }

    return NextResponse.json(simulationResponse)

  } catch (error) {
    console.error('Multi-agent simulation error:', error)
    return NextResponse.json(
      { error: 'Failed to run multi-agent simulation' },
      { status: 500 }
    )
  }
}
