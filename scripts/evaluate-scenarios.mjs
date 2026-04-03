const baseUrl = process.env.SCENARIO_EVAL_BASE_URL || 'http://localhost:3000'
const provider = process.env.SCENARIO_EVAL_PROVIDER || 'ollama'
const model = process.env.SCENARIO_EVAL_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:7b'

async function getJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  if (!response.ok) {
    throw new Error(`${path} failed with ${response.status}`)
  }
  return response.json()
}

function summarizeRun(run) {
  return {
    id: run.id,
    intervention: run.intervention.label,
    branchPoint: `${run.branchPoint.kind}:${run.branchPoint.title}`,
    outcomeGain: run.comparison.outcomeScore.alternate - run.comparison.outcomeScore.baseline,
    qualityGain: run.comparison.qualityScore.alternate - run.comparison.qualityScore.baseline,
    alternateFlags: run.comparison.qualityFlags.alternate,
    recommendation: run.comparison.recommendation,
  }
}

async function main() {
  const agentsPayload = await getJson('/api/agents')
  const agent = agentsPayload.data?.find((entry) => entry.name === 'Nova Forge') || agentsPayload.data?.[0]
  if (!agent) {
    throw new Error('No agent available for scenario evaluation')
  }

  const bootstrap = await getJson(`/api/scenarios?agentId=${encodeURIComponent(agent.id)}`)
  const meaningfulBranchPoint =
    bootstrap.branchPoints.find((point) => point.kind === 'message' && point.summary.length > 80) ||
    bootstrap.branchPoints.find((point) => point.kind === 'simulation_turn' && point.summary.length > 80) ||
    bootstrap.branchPoints.find((point) => point.summary.length > 60) ||
    bootstrap.branchPoints[0]
  if (!meaningfulBranchPoint) {
    throw new Error('No branch point available for scenario evaluation')
  }

  const interventions = [
    {
      type: 'rewrite_reply',
      label: 'Rewrite The Next Reply',
      description: 'Keep the same facts but change the next response style.',
      responseStyle: 'warmer',
      rationale: 'Make the reply feel more human without losing concrete next steps.',
    },
    {
      type: 'emotion_shift',
      label: 'Shift Emotional Baseline',
      description: 'Re-run the branch with a new dominant mood.',
      targetEmotion: 'trust',
      emotionIntensity: 'high',
    },
  ]

  const results = []

  for (const intervention of interventions) {
    const payload = await getJson('/api/scenarios', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-llm-provider': provider,
        'x-llm-model': model,
      },
      body: JSON.stringify({
        agentId: agent.id,
        branchPointId: meaningfulBranchPoint.id,
        branchPointKind: meaningfulBranchPoint.kind,
        intervention,
        maxTurns: 3,
      }),
    })

    results.push(summarizeRun(payload.scenarioRun))
  }

  const report = {
    evaluatedAt: new Date().toISOString(),
    agent: { id: agent.id, name: agent.name },
    provider,
    model,
    branchPoint: meaningfulBranchPoint,
    results,
  }

  console.log(JSON.stringify(report, null, 2))
}

main().catch((error) => {
  console.error('[scenarios:evaluate]', error)
  process.exitCode = 1
})
