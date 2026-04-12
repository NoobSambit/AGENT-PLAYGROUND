const baseUrl = process.env.DREAM_EVAL_BASE_URL || 'http://localhost:3000'
const provider = process.env.DREAM_EVAL_PROVIDER || process.env.LLM_PROVIDER || 'ollama'
const model = process.env.DREAM_EVAL_MODEL || process.env.OLLAMA_MODEL || 'llama3.2'

async function getJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || `${path} failed with ${response.status}`)
  }
  return payload
}

async function seedChats(agentId) {
  const prompts = [
    'What recent tradeoff felt necessary but emotionally expensive?',
    'Which unresolved memory still changes your decisions under pressure?',
    'What future outcome are you quietly bracing for?',
    'What relationship currently carries more subtext than you want to admit?',
    'Which internal conflict keeps resurfacing when you try to focus?',
    'Describe your current mood without flattening it into one clean sentence.',
  ]

  for (const prompt of prompts) {
    await getJson(`/api/agents/${agentId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-llm-provider': provider,
        'x-llm-model': model,
      },
      body: JSON.stringify({ prompt }),
    })
  }
}

function summarize(detail) {
  const dream = detail.dreams?.[0]
  const evaluation = detail.session?.latestEvaluation
  return {
    sessionId: detail.session?.id || null,
    type: detail.session?.type || null,
    status: detail.session?.status || null,
    dreamId: dream?.id || null,
    title: dream?.title || null,
    score: evaluation?.overallScore || null,
    pass: evaluation?.pass || false,
    repairTriggered: (detail.dreams?.length || 0) > 1,
    weaknesses: evaluation?.weaknesses || [],
    repairInstructions: evaluation?.repairInstructions || [],
  }
}

async function runCase(agentId, input) {
  const created = await getJson(`/api/agents/${agentId}/dream`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const detail = await getJson(`/api/agents/${agentId}/dream/sessions/${created.session.id}/generate`, {
    method: 'POST',
    headers: {
      'x-llm-provider': provider,
      'x-llm-model': model,
    },
  })

  if (detail.session?.latestEvaluation?.pass) {
    return getJson(`/api/agents/${agentId}/dream/sessions/${created.session.id}/save`, {
      method: 'POST',
    })
  }

  return detail
}

async function main() {
  const agentsPayload = await getJson('/api/agents')
  const agent = agentsPayload.data?.find((entry) => entry.name === 'Nova Forge') || agentsPayload.data?.[0]
  if (!agent) {
    throw new Error('No agent available for dream evaluation')
  }

  await seedChats(agent.id)

  const cases = [
    { type: 'symbolic', userNote: 'Let recent ambition and uncertainty become symbols instead of explanation.', focus: ['future', 'emotion'] },
    { type: 'nightmare', userNote: 'Turn pressure and avoidance into a frightening but meaningful progression.', focus: ['conflict', 'emotion'] },
    { type: 'memory_replay', userNote: 'Revisit one memory that still distorts present judgment.', focus: ['memory'] },
    { type: 'prophetic', userNote: 'Project one likely future risk without sounding mystical for its own sake.', focus: ['future', 'conflict'] },
    { type: 'lucid', userNote: 'Let the dream show agency under strain rather than easy wish fulfillment.', focus: ['future', 'emotion'] },
    { type: 'recurring', userNote: 'Return to a motif that keeps resurfacing and name why it persists.', focus: ['memory', 'conflict'] },
    { type: 'symbolic', userNote: 'Make it weird and random and cinematic and huge and magical and kind of like every dream ever.', focus: [] },
  ]

  const results = []
  for (const input of cases) {
    const detail = await runCase(agent.id, input)
    results.push(summarize(detail))
  }

  const bootstrap = await getJson(`/api/agents/${agent.id}/dream`)
  const activeDream = bootstrap.activeDreamImpression || null

  const chatPayload = await getJson(`/api/agents/${agent.id}/chat`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-llm-provider': provider,
      'x-llm-model': model,
    },
    body: JSON.stringify({ prompt: 'Answer briefly: what emotional residue is shaping your emphasis right now?' }),
  })

  console.log(JSON.stringify({
    evaluatedAt: new Date().toISOString(),
    agent: { id: agent.id, name: agent.name },
    provider,
    model,
    results,
    activeDreamImpression: activeDream,
    chatDreamMetadata: chatPayload.agentMessage?.metadata?.dreamImpression || null,
  }, null, 2))
}

main().catch((error) => {
  console.error('[dream:evaluate]', error)
  process.exitCode = 1
})
