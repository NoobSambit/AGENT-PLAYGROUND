const baseUrl = process.env.CREATIVE_EVAL_BASE_URL || 'http://localhost:3000'
const provider = process.env.CREATIVE_EVAL_PROVIDER || process.env.LLM_PROVIDER || 'ollama'
const model = process.env.CREATIVE_EVAL_MODEL || process.env.OLLAMA_MODEL || 'llama3.2'

async function getJson(path, init) {
  const response = await fetch(`${baseUrl}${path}`, init)
  const payload = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(payload.error || `${path} failed with ${response.status}`)
  }
  return payload
}

function summarize(detail) {
  const latestArtifact = detail.artifacts[0]
  const evaluation = detail.session.latestEvaluation
  return {
    sessionId: detail.session.id,
    status: detail.session.status,
    title: latestArtifact?.title || null,
    score: evaluation?.overallScore || null,
    pass: evaluation?.pass || false,
    repairTriggered: detail.artifacts.length > 1,
  }
}

async function createAndRun(agentId, brief, publish = false) {
  const createPayload = await getJson(`/api/agents/${agentId}/creative`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(brief),
  })

  const detail = await getJson(`/api/agents/${agentId}/creative/sessions/${createPayload.session.id}/generate`, {
    method: 'POST',
    headers: {
      'x-llm-provider': provider,
      'x-llm-model': model,
    },
  })

  if (publish) {
    return getJson(`/api/agents/${agentId}/creative/sessions/${createPayload.session.id}/publish`, {
      method: 'POST',
    })
  }

  return detail
}

async function main() {
  const agentsPayload = await getJson('/api/agents')
  const agent = agentsPayload.data?.find((entry) => entry.name === 'Nova Forge') || agentsPayload.data?.[0]
  if (!agent) {
    throw new Error('No agent available for creative evaluation')
  }

  const briefs = [
    {
      format: 'story',
      intent: 'Write a short story about an inventor who keeps prototyping futures faster than they can emotionally process them.',
      audience: 'A product-minded reader who likes speculative fiction with practical tension.',
      tone: 'cinematic',
      length: 'medium',
      mustInclude: ['a workshop light', 'a failed prototype', 'one honest admission'],
      avoid: ['generic inspiration speech'],
      referenceNotes: 'Keep the ending earned instead of triumphant.',
    },
    {
      format: 'poem',
      intent: 'Write a poem about momentum and unfinished ideas crowding the edge of sleep.',
      audience: 'A reader who wants sharp imagery rather than vague reflection.',
      tone: 'lyrical',
      length: 'short',
      mustInclude: ['wires', 'blueprint'],
      avoid: ['the phrase dream big'],
      referenceNotes: 'Use clear line breaks and one surprising image.',
    },
    {
      format: 'dialogue',
      intent: 'Write a dialogue between Nova Forge and a prototype that keeps asking whether speed is hiding fear.',
      audience: 'Someone evaluating whether the agent voice feels distinct.',
      tone: 'philosophical',
      length: 'medium',
      mustInclude: ['a pause', 'a design decision'],
      avoid: ['therapy clichés'],
      referenceNotes: 'Make the subtext obvious enough to evaluate.',
    },
    {
      format: 'song',
      intent: 'Write lyrics about shipping too fast while trying to stay emotionally honest.',
      audience: 'A reviewer trying to force the repair path to validate the bounded revision workflow.',
      tone: 'experimental',
      length: 'short',
      mustInclude: ['municipal static', 'kintsugi battery', 'solder halo', 'inventory of doubt'],
      avoid: ['generic chorus', 'the phrase dream big'],
      referenceNotes: 'This case is intentionally awkward. If the draft misses the brief, the repair pass should tighten it.',
    },
  ]

  const results = []
  for (const [index, brief] of briefs.entries()) {
    const detail = await createAndRun(agent.id, brief, index === 0)
    results.push(summarize(detail))
  }

  const bootstrap = await getJson(`/api/agents/${agent.id}/creative`)

  console.log(JSON.stringify({
    evaluatedAt: new Date().toISOString(),
    agent: { id: agent.id, name: agent.name },
    provider,
    model,
    results,
    publishedLibraryCount: bootstrap.library?.length || 0,
    latestPublishedTitle: bootstrap.library?.[0]?.artifact?.title || null,
  }, null, 2))
}

main().catch((error) => {
  console.error('[creative:evaluate]', error)
  process.exitCode = 1
})
