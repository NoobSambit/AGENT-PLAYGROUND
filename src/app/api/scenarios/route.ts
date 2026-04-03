import { NextRequest, NextResponse } from 'next/server'
import { getProviderInfoForRequest } from '@/lib/llm/requestPreference'
import { ScenarioService } from '@/lib/services/scenarioService'
import type { ScenarioIntervention, ScenarioBranchPointKind } from '@/types/database'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const agentId = searchParams.get('agentId')

    if (!agentId) {
      return NextResponse.json(
        { error: 'agentId is required' },
        { status: 400 }
      )
    }

    const data = await ScenarioService.getScenarioLabBootstrap(agentId)
    if (!data) {
      return NextResponse.json(
        { error: 'Agent not found' },
        { status: 404 }
      )
    }

    return NextResponse.json(data)
  } catch (error) {
    console.error('Scenario bootstrap error:', error)
    return NextResponse.json(
      { error: 'Failed to load scenario lab' },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json() as {
      agentId?: string
      branchPointId?: string
      branchPointKind?: ScenarioBranchPointKind
      intervention?: ScenarioIntervention
      maxTurns?: number
    }

    if (!body.agentId || !body.branchPointId || !body.branchPointKind || !body.intervention) {
      return NextResponse.json(
        { error: 'agentId, branchPointId, branchPointKind, and intervention are required' },
        { status: 400 }
      )
    }

    const providerInfo = getProviderInfoForRequest(request)
    const scenarioRun = await ScenarioService.runScenario({
      agentId: body.agentId,
      branchPointId: body.branchPointId,
      branchPointKind: body.branchPointKind,
      intervention: body.intervention,
      maxTurns: body.maxTurns,
      providerInfo,
    })

    return NextResponse.json({ scenarioRun })
  } catch (error) {
    console.error('Scenario run error:', error)
    return NextResponse.json(
      { error: 'Failed to run scenario' },
      { status: 500 }
    )
  }
}
