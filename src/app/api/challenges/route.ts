import { NextResponse } from 'next/server'

export async function GET() {
  return NextResponse.json(
    { error: 'Legacy challenges API has been replaced by /api/agents/[id]/challenges.' },
    { status: 410 }
  )
}

export async function POST() {
  return NextResponse.json(
    { error: 'Legacy challenges API has been replaced by /api/agents/[id]/challenges/runs.' },
    { status: 410 }
  )
}
