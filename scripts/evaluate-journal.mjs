const baseUrl = process.env.JOURNAL_EVAL_BASE_URL || 'http://localhost:3000'
const provider = process.env.JOURNAL_EVAL_PROVIDER || process.env.LLM_PROVIDER || 'ollama'
const model = process.env.JOURNAL_EVAL_MODEL || process.env.OLLAMA_MODEL || 'llama3.2'

async function getJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || `${path} failed with ${response.status}`)
  }
  return payload
}

async function seedChatsIfNeeded(agentId) {
  const prompts = [
    'Walk me through a recent decision that felt emotionally expensive but strategically necessary.',
    'What memory still changes how you respond under pressure?',
    'Which relationship currently requires more honesty from you than you are comfortable giving?',
    'What goal are you drifting from, and why?',
    'Describe an emerging idea you cannot stop returning to.',
    'What tension sits underneath your current momentum?',
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
  const entry = detail.entries[0]
  const evaluation = detail.session?.latestEvaluation
  return {
    sessionId: detail.session?.id || null,
    type: detail.session?.type || null,
    status: detail.session?.status || null,
    title: entry?.title || null,
    score: evaluation?.overallScore || null,
    pass: evaluation?.pass || false,
    repairTriggered: detail.entries.length > 1,
    weaknesses: evaluation?.weaknesses || [],
    repairInstructions: evaluation?.repairInstructions || [],
  }
}

async function runJournalCase(agentId, input) {
  const created = await getJson(`/api/agents/${agentId}/journal`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })

  const detail = await getJson(`/api/agents/${agentId}/journal/sessions/${created.session.id}/generate`, {
    method: 'POST',
    headers: {
      'x-llm-provider': provider,
      'x-llm-model': model,
    },
  })

  if (detail.session?.latestEvaluation?.pass) {
    return getJson(`/api/agents/${agentId}/journal/sessions/${created.session.id}/save`, {
      method: 'POST',
    })
  }

  return detail
}

async function main() {
  const agentsPayload = await getJson('/api/agents')
  const agent = agentsPayload.data?.find((entry) => entry.name === 'Nova Forge') || agentsPayload.data?.[0]
  if (!agent) {
    throw new Error('No agent available for journal evaluation')
  }

  const bootstrap = await getJson(`/api/agents/${agent.id}/journal`)
  if ((bootstrap.metrics?.totalSessions || 0) === 0) {
    await seedChatsIfNeeded(agent.id)
  }

  const inputs = [
    { type: 'daily_reflection', userNote: 'Focus on the cost of keeping momentum while staying legible to yourself.', focus: ['continuity', 'goal'] },
    { type: 'emotional_processing', userNote: 'Trace a recent emotional spike back to the actual trigger, not the clean explanation.', focus: ['emotion', 'memory'] },
    { type: 'goal_alignment', userNote: 'Compare stated goals against current behavior and note the drift.', focus: ['goal', 'continuity'] },
    { type: 'relationship_checkpoint', userNote: 'Reflect on one relationship where trust and restraint are currently in tension.', focus: ['relationship', 'emotion'] },
    { type: 'memory_revisit', userNote: 'Return to a memory that still shapes current caution or ambition.', focus: ['memory', 'continuity'] },
    { type: 'idea_capture', userNote: 'Capture a live idea with concrete next actions, not just atmosphere.', focus: ['goal', 'emotion'] },
  ]

  const results = []
  for (const input of inputs) {
    const detail = await runJournalCase(agent.id, input)
    results.push(summarize(detail))
  }

  const repeatedWeaknesses = results
    .flatMap((result) => result.weaknesses)
    .reduce((acc, weakness) => {
      acc[weakness] = (acc[weakness] || 0) + 1
      return acc
    }, {})

  console.log(JSON.stringify({
    evaluatedAt: new Date().toISOString(),
    agent: { id: agent.id, name: agent.name },
    provider,
    model,
    results,
    repeatedWeaknesses,
  }, null, 2))
}

main().catch((error) => {
  console.error('[journal:evaluate]', error)
  process.exitCode = 1
})
