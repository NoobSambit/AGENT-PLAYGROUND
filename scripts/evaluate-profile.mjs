const baseUrl = process.env.PROFILE_EVAL_BASE_URL || 'http://localhost:3000'
const provider = process.env.PROFILE_EVAL_PROVIDER || process.env.LLM_PROVIDER || 'ollama'
const model = process.env.PROFILE_EVAL_MODEL || process.env.OLLAMA_MODEL || 'qwen2.5:7b'

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
    'I need you to help me rescue a creative product prototype that shipped too early. Give me a direct but emotionally intelligent recovery plan.',
    'Pick between two paths for Nova Forge: refine one strong concept slowly or explore five concepts fast. Explain the tradeoff and choose one.',
    'Switch gears. Talk to me like I am overwhelmed but ambitious. Keep your answer structured, warm, and high-agency.',
  ]

  for (const prompt of prompts) {
    await getJson(`/api/agents/${agentId}/chat`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-llm-provider': provider,
        'x-llm-model': model,
      },
      body: JSON.stringify({ prompt, conversationHistory: [] }),
    })
  }
}

async function main() {
  const agentsPayload = await getJson('/api/agents')
  const agent = agentsPayload.data?.find((entry) => entry.name === 'Nova Forge') || agentsPayload.data?.[0]
  if (!agent) {
    throw new Error('No agent available for profile evaluation')
  }

  await seedChats(agent.id)

  const createPayload = await getJson(`/api/agents/${agent.id}/profile/runs`, {
    method: 'POST',
  })

  await fetch(`${baseUrl}/api/agents/${agent.id}/profile/runs/${createPayload.run.id}/execute`, {
    method: 'POST',
    headers: {
      'x-llm-provider': provider,
      'x-llm-model': model,
    },
  })

  let detail = await getJson(`/api/agents/${agent.id}/profile/runs/${createPayload.run.id}`)
  const maxPolls = 40
  let attempts = 0
  while (detail.run?.status === 'draft' || detail.run?.status === 'running') {
    if (attempts >= maxPolls) {
      throw new Error('Profile evaluation timed out waiting for run completion')
    }
    await new Promise((resolve) => setTimeout(resolve, 1500))
    detail = await getJson(`/api/agents/${agent.id}/profile/runs/${createPayload.run.id}`)
    attempts += 1
  }

  const bootstrap = await getJson(`/api/agents/${agent.id}/profile`)
  const evaluation = detail.run?.latestEvaluation
  const profile = detail.run?.latestProfile

  console.log(JSON.stringify({
    evaluatedAt: new Date().toISOString(),
    agent: { id: agent.id, name: agent.name },
    provider,
    model,
    run: {
      id: detail.run?.id,
      status: detail.run?.status,
      latestStage: detail.run?.latestStage,
      transcriptCount: detail.run?.transcriptCount,
      sourceCount: detail.run?.sourceCount,
    },
    profile: profile
      ? {
          mbti: profile.mbti?.type,
          enneagram: profile.enneagram?.primaryType,
          confidence: profile.confidence,
        }
      : null,
    quality: evaluation
      ? {
          overallScore: evaluation.overallScore,
          pass: evaluation.pass,
          grounding: evaluation.dimensions.evidenceGrounding.score,
          consistency: evaluation.dimensions.consistency.score,
          distinctiveness: evaluation.dimensions.distinctiveness.score,
          communicationUsefulness: evaluation.dimensions.communicationUsefulness.score,
          rationaleCompleteness: evaluation.dimensions.rationaleCompleteness.score,
        }
      : null,
    communication: bootstrap.communicationFingerprint
      ? {
          enoughData: bootstrap.communicationFingerprint.enoughData,
          observedMessageCount: bootstrap.communicationFingerprint.observedMessageCount,
          sampleWindowSize: bootstrap.communicationFingerprint.sampleWindowSize,
        }
      : null,
  }, null, 2))
}

main().catch((error) => {
  console.error('[profile:evaluate]', error)
  process.exitCode = 1
})
