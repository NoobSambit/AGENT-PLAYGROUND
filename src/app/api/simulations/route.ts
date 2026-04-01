import { NextRequest, NextResponse } from 'next/server'
import { SimulationService } from '@/lib/services/simulationService'

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const id = searchParams.get('id')
    const limitCount = parseInt(searchParams.get('limit') || '10')

    if (id) {
      const simulation = await SimulationService.getSimulationById(id)
      if (!simulation) {
        return NextResponse.json(
          { error: 'Simulation not found' },
          { status: 404 }
        )
      }

      return NextResponse.json({ simulation })
    }

    const simulations = await SimulationService.getRecentSimulations(limitCount)
    return NextResponse.json({ simulations })
  } catch (error) {
    console.error('Simulation fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch simulations' },
      { status: 500 }
    )
  }
}
