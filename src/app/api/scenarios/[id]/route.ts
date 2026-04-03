import { NextResponse } from 'next/server'
import { ScenarioService } from '@/lib/services/scenarioService'

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params
    const scenarioRun = await ScenarioService.getScenarioRunById(id)

    if (!scenarioRun) {
      return NextResponse.json(
        { error: 'Scenario run not found' },
        { status: 404 }
      )
    }

    return NextResponse.json({ scenarioRun })
  } catch (error) {
    console.error('Scenario run fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch scenario run' },
      { status: 500 }
    )
  }
}
