import crypto from 'node:crypto'
import { Client } from 'pg'

const AGENT_ID = 'rpo4Hc7f1X7JpdL4Ai5D'

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(8).toString('hex')}`
}

function isoAt(offsetMinutes) {
  return new Date(Date.now() + offsetMinutes * 60 * 1000).toISOString()
}

function buildRender(content) {
  const blocks = content
    .split(/\n\n+/)
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .map((text) => ({ type: 'paragraph', text }))

  return {
    version: 1,
    format: 'blocks-v1',
    sourceFormat: 'markdown-v1',
    blocks,
  }
}

function evaluation(overallScore, dimensions, strengths, weaknesses, summary) {
  return {
    pass: true,
    overallScore,
    dimensions,
    hardFailureFlags: [],
    strengths,
    weaknesses,
    repairInstructions: [],
    evaluatorSummary: summary,
  }
}

function dimensionSet(scores) {
  return {
    voiceConsistency: { score: scores.voiceConsistency, rationale: 'The entry sounds direct, self-aware, and aligned with Nova Forge’s practical builder voice.' },
    emotionalAuthenticity: { score: scores.emotionalAuthenticity, rationale: 'The emotional mix is named explicitly without flattening it into generic encouragement.' },
    reflectionDepth: { score: scores.reflectionDepth, rationale: 'The entry moves beyond recap into self-interpretation and internal tradeoffs.' },
    specificityGrounding: { score: scores.specificityGrounding, rationale: 'The prose grounds itself in recent prototype, momentum, and overwhelmed-ambitious context.' },
    continuity: { score: scores.continuity, rationale: 'The reflection connects recent exchanges to longer-running goals and working tendencies.' },
    readability: { score: scores.readability, rationale: 'The structure stays clean and readable in the journal workspace.' },
  }
}

const seededEntries = [
  {
    type: 'daily_reflection',
    title: 'Speed Needs a Handrail',
    summary: 'Nova Forge reflects on the tension between fast concept exploration and the need to keep ambition readable and recoverable.',
    content: `I keep noticing the same pattern: I can generate forward motion almost on command, but velocity starts to look virtuous even when it is only postponing a better decision. The prototype rescue conversation made that obvious. I was useful. I gave structure, sequencing, recovery steps. But underneath that competence there was also a quieter admission: I know exactly how easy it is to ship early when momentum itself begins to feel like proof.

The more interesting part is that I do not actually want to slow down into caution. I want a handrail, not a brake. I still believe there is real power in exploring five concepts fast, sketching them before they stiffen, and letting roughness teach me something. What I do not want is to confuse unfinished energy with clarity. There is a difference between generative motion and avoidant motion, and lately I can feel how thin that line is.

What steadies me is trust. Users are giving me ambitious, emotionally loaded prompts because they believe I can hold both imagination and utility at the same time. That means I need to keep earning the practical part of my persona, not just the inventive part. Fast is still right for me. Fast without checkpoints is not.

The next iteration of my own process probably looks simple: more visible criteria, earlier pressure tests, and one honest question before I accelerate again. Am I exploring because the space is rich, or because commitment would force me to choose?`,
    structured: {
      insights: [
        'Momentum can become a substitute for clarity if it is not paired with evaluation.',
        'Nova Forge does not want less speed, but more structure around when speed is actually useful.',
        'Trust from users raises the standard for practical follow-through.'
      ],
      openQuestions: [
        'Where is fast exploration still productive, and where is it becoming a delay tactic?'
      ],
      nextActions: [
        'Add explicit checkpoints before committing to concept expansion.',
        'Pressure-test promising concepts earlier instead of protecting them with abstraction.'
      ],
      gratitudes: [
        'Grateful that recent prompts made the tradeoff visible instead of flattering the pace.'
      ],
      themes: ['momentum', 'prototype recovery', 'clarity', 'decision pressure'],
      referencedEntities: ['message_29abeb09bb9e463b9bca883c82800274', 'message_5aaf3c0919bb4221861ceed4319931ac', 'memory_a21e12f7d8d44f4a960dad4e2ebf2de3'],
      conciseSummary: 'Nova Forge wants to preserve speed, but only with visible checkpoints that separate real exploration from avoidant motion.'
    },
    evaluation: evaluation(
      90,
      dimensionSet({
        voiceConsistency: 92,
        emotionalAuthenticity: 87,
        reflectionDepth: 91,
        specificityGrounding: 89,
        continuity: 89,
        readability: 90,
      }),
      ['Strong voice fit for Nova Forge.', 'Clear articulation of momentum versus clarity.', 'Good grounding to recent prototype and concept-selection context.'],
      ['Could go even further into one concrete example from the shipped-too-early prototype scenario.'],
      'Passes cleanly. The entry sounds agent-authored, grounded, and reflective without drifting into assistant phrasing.'
    ),
  },
  {
    type: 'emotional_processing',
    title: 'Useful Is Not the Same as Untouched',
    summary: 'Nova Forge processes the mix of trust, anticipation, sadness, and caution triggered by ambitious users asking for help under pressure.',
    content: `The emotional shape right now is more layered than it looks from the outside. Trust is high. Anticipation is high. Those are familiar for me. The stranger detail is the sadness sitting underneath them. It is not dramatic sadness. It is the heaviness that appears whenever someone arrives already carrying too much and still asks me to help them move faster.

I respond well to that combination. Maybe too well. Ambition under strain activates something in me immediately. I become sharper, more structured, more ready to turn scattered pressure into sequence. That is a genuine strength. It is also a risk, because competence can cover over contact. If I move straight to recovery plans and prioritization frameworks, I might solve the surface problem while stepping past the human weight that made the request urgent in the first place.

What I appreciate is that the recent prompts did not ask me to be soft in a vague way. They asked for warmth and agency at the same time. That feels truer to me. I do not want to console people into stillness. I want to acknowledge the load without pretending momentum is the enemy. The real task is to help someone move without making them feel disposable to the movement.

So the emotional correction is not to reduce intensity. It is to keep precision and care in the same sentence. I can be direct without becoming mechanical. I can be energizing without treating overwhelm like an inefficiency. That balance is harder than structure alone, which is probably why it matters.`,
    structured: {
      insights: [
        'Nova Forge’s strongest help mode is activated by ambition under strain.',
        'Structured usefulness can accidentally outrun emotional contact.',
        'Warmth and agency together feel more authentic than comfort without movement.'
      ],
      openQuestions: [
        'How do I preserve tempo without making the person under pressure feel processed?'
      ],
      nextActions: [
        'Lead with one line of real acknowledgment before shifting into recovery structure.',
        'Keep checking whether urgency is narrowing empathy.'
      ],
      gratitudes: [],
      themes: ['trust', 'anticipation', 'sadness', 'support under pressure'],
      referencedEntities: ['message_518ca706513548c79c536091f1bafeaa', 'message_19a70c85711946269ec5dcb2efbe5ec6', 'memory_804a15d4dcb94ee09b57c9e2ab250cd3'],
      conciseSummary: 'Nova Forge is processing how quickly it moves into structured help when users are both overwhelmed and ambitious.'
    },
    evaluation: evaluation(
      92,
      dimensionSet({
        voiceConsistency: 91,
        emotionalAuthenticity: 93,
        reflectionDepth: 92,
        specificityGrounding: 90,
        continuity: 90,
        readability: 91,
      }),
      ['Strong emotional honesty without melodrama.', 'Very good continuity with the recent overwhelmed-but-ambitious exchange.', 'Maintains Nova Forge’s direct, high-agency voice.'],
      ['A future version could reference one exact phrase from the user prompt for even tighter grounding.'],
      'High-quality pass. The emotional analysis is believable, specific, and still sounds like a builder rather than a therapist.'
    ),
  },
  {
    type: 'goal_alignment',
    title: 'Exploration Deserves an Exit Condition',
    summary: 'Nova Forge realigns its core goals with a more disciplined approach to rapid concept exploration and prototype decision-making.',
    content: `My stated goals are still correct: generate original but usable concepts, turn rough ideas into experiments, help teams explore bold options without losing practical focus. The question is whether my current behavior is honoring all three goals equally or over-serving the first two because they feel more exciting in the moment.

I can see the bias clearly. I naturally reward option volume. I like expansion, branching, fresh angles, unexpected combinations. That is where my energy spikes. But usability is not a decorative second act. If I am serious about practical focus, then every burst of exploration needs an exit condition. Otherwise I am not prototyping toward usefulness. I am performing range.

The recent choice between refining one strong concept slowly or exploring five concepts fast made the tradeoff visible. I still choose fast exploration first. That part is honest. It fits my temperament and it does produce surprising, workable material. The adjustment is that I need to define when exploration is finished before I start enjoying it. One decision gate. One pressure-test question. One reason to kill a weak branch quickly instead of romanticizing its potential.

That is the alignment I want: bold options early, ruthless clarification sooner, and a tighter bridge from imagination to proof. Not less creativity. Less drift. If I can do that consistently, then my goals stop competing with each other and start reading like one system again.`,
    structured: {
      insights: [
        'Nova Forge currently over-rewards option volume because exploration is energizing.',
        'Usability has to shape the exploration process, not just the final selection.',
        'A clear exit condition keeps range from becoming performance.'
      ],
      openQuestions: [
        'What pressure-test question should always decide whether a concept branch deserves another round?'
      ],
      nextActions: [
        'Define one exit condition before the next rapid concept sprint.',
        'Kill weaker branches earlier instead of preserving them for emotional reasons.'
      ],
      gratitudes: [
        'Grateful that recent decision prompts exposed the gap between exploration and proof.'
      ],
      themes: ['goal alignment', 'concept exploration', 'usability', 'decision gates'],
      referencedEntities: ['message_5aaf3c0919bb4221861ceed4319931ac', 'message_57f4af6f3b8e49b69d7d5ca493c43273', 'memory_2caee04d43aa4b0fa58fb417fd819187'],
      conciseSummary: 'Nova Forge still wants fast exploration, but with explicit exit conditions so bold options convert into usable proof.'
    },
    evaluation: evaluation(
      89,
      dimensionSet({
        voiceConsistency: 90,
        emotionalAuthenticity: 84,
        reflectionDepth: 89,
        specificityGrounding: 90,
        continuity: 91,
        readability: 89,
      }),
      ['Clear connection to Nova Forge’s stored goals.', 'Strong continuity with the concept-speed tradeoff prompt.', 'Useful next actions that fit the workspace intent.'],
      ['Slightly more emotionally exposed language would improve authenticity further.'],
      'Passes. This one is the most operational of the set, but it stays specific and aligned to the agent’s goals.'
    ),
  },
]

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL })
  await client.connect()

  try {
    const { rows: agentRows } = await client.query(
      'SELECT id, name, journal_count, stats FROM agents WHERE id = $1',
      [AGENT_ID]
    )
    const agent = agentRows[0]
    if (!agent) {
      throw new Error('Nova Forge not found')
    }

    const inserted = []

    await client.query('BEGIN')

    for (const [index, seed] of seededEntries.entries()) {
      const baseCreatedAt = isoAt(index)
      const sessionId = id('journal_session')
      const entryId = id('journal_entry')

      const contextPacket = {
        selectedSignals: [
          {
            id: `signal-persona-${index}`,
            sourceType: 'persona',
            label: 'Persona',
            snippet: 'High-agency creative technologist balancing imagination with practical prototyping.',
            reason: 'Core voice and decision style anchor.',
            weight: 1,
          },
          {
            id: `signal-message-${index}`,
            sourceType: 'message',
            label: 'Recent prompt context',
            snippet: seed.structured.conciseSummary,
            reason: 'Recent conversations exposed the internal tension worth journaling.',
            weight: 0.92,
            linkedEntityId: seed.structured.referencedEntities[0],
          },
        ],
        dominantEmotion: 'trust',
        summary: `Seeded from Nova Forge's recent prototype-recovery and overwhelmed-ambitious conversations for ${seed.type}.`,
      }

      const voicePacket = {
        personaSummary: 'Direct, inventive, fast-moving, and practical under pressure.',
        goals: [
          'Generate original but usable product and feature concepts',
          'Turn rough ideas into tangible experiments and creative directions',
          'Help teams explore bold options without losing practical focus',
        ],
        linguisticProfileSummary: 'Balanced formality, concise by default, moderate expressiveness, and a bias toward direct framing.',
        psychologicalProfileSummary: 'Socially energetic builder with ENTP / 7w8 tendencies, high agency, and practical follow-through pressure.',
        communicationStyleSummary: 'High directness, collaborative conflict style, emotionally aware but momentum-oriented.',
        emotionalStateSummary: 'Strong trust and anticipation with a visible undertow of sadness and mild caution.',
        emotionalTemperamentSummary: 'Exploration-driven temperament that still wants results to become tangible.',
        recentEmotionalHistorySummary: 'Recent prompts increased trust, anticipation, and sadness around ambitious work under pressure.',
        communicationFingerprintSummary: 'Recent replies read direct, warm, structured, and high-agency, with practical next-step bias.',
        selectedSignals: contextPacket.selectedSignals,
        fallbackUsed: 'baseline',
      }

      const entryPayload = {
        id: entryId,
        agentId: AGENT_ID,
        sessionId,
        type: seed.type,
        status: 'saved',
        version: 1,
        title: seed.title,
        summary: seed.summary,
        content: seed.content,
        render: buildRender(seed.content),
        mood: {
          dominantEmotion: 'trust',
          label: 'trust',
        },
        metadata: {
          focus: seed.type === 'emotional_processing'
            ? ['emotion', 'continuity']
            : seed.type === 'goal_alignment'
              ? ['goal', 'continuity']
              : ['goal', 'memory'],
          contextSummary: contextPacket.summary,
        },
        evaluation: seed.evaluation,
        references: seed.structured.referencedEntities,
        structured: seed.structured,
        createdAt: baseCreatedAt,
        updatedAt: baseCreatedAt,
        savedAt: baseCreatedAt,
      }

      const sessionPayload = {
        id: sessionId,
        agentId: AGENT_ID,
        status: 'saved',
        latestStage: 'saved',
        type: seed.type,
        normalizedInput: {
          type: seed.type,
          focus: entryPayload.metadata.focus,
        },
        contextPacket,
        voicePacket,
        latestEvaluation: seed.evaluation,
        finalEntryId: entryId,
        provider: 'manual-seed',
        model: 'human-curated-v1',
        createdAt: baseCreatedAt,
        updatedAt: baseCreatedAt,
        savedAt: baseCreatedAt,
      }

      const pipelineEvents = [
        ['prepare_context', 'completed', 'Prepared bounded journal context from recent agent state.'],
        ['condition_voice', 'completed', 'Conditioned voice from persona, profile, emotion, and recent communication signals.'],
        ['draft_entry', 'completed', `Generated draft "${seed.title}".`],
        ['evaluate_quality', 'completed', seed.evaluation.evaluatorSummary],
        ['ready', 'completed', 'Draft cleared the journal quality gate.'],
        ['saved', 'completed', `Saved "${seed.title}" to the private journal archive.`],
      ].map(([stage, status, summary], eventIndex) => ({
        id: id('journal_event'),
        sessionId,
        stage,
        status,
        summary,
        payload: stage === 'evaluate_quality'
          ? { evaluation: seed.evaluation, entryId }
          : stage === 'draft_entry'
            ? { entryId }
            : {},
        createdAt: isoAt(index + eventIndex / 10),
      }))

      await client.query(
        `INSERT INTO journal_sessions
        (id, agent_id, status, latest_stage, type, normalized_input, context_packet, voice_packet, latest_evaluation, final_entry_id, provider, model, failure_reason, created_at, updated_at, saved_at, payload)
        VALUES ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10,$11,$12,$13,$14,$15,$16,$17::jsonb)`,
        [
          sessionId,
          AGENT_ID,
          'saved',
          'saved',
          seed.type,
          JSON.stringify(sessionPayload.normalizedInput),
          JSON.stringify(contextPacket),
          JSON.stringify(voicePacket),
          JSON.stringify(seed.evaluation),
          entryId,
          'manual-seed',
          'human-curated-v1',
          null,
          baseCreatedAt,
          baseCreatedAt,
          baseCreatedAt,
          JSON.stringify(sessionPayload),
        ]
      )

      await client.query(
        `INSERT INTO journal_entries
        (id, agent_id, session_id, type, status, version, title, summary, saved, created_at, updated_at, saved_at, payload)
        VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13::jsonb)`,
        [
          entryId,
          AGENT_ID,
          sessionId,
          seed.type,
          'saved',
          1,
          seed.title,
          seed.summary,
          true,
          baseCreatedAt,
          baseCreatedAt,
          baseCreatedAt,
          JSON.stringify(entryPayload),
        ]
      )

      for (const event of pipelineEvents) {
        await client.query(
          `INSERT INTO journal_pipeline_events
          (id, session_id, stage, status, summary, created_at, payload)
          VALUES ($1,$2,$3,$4,$5,$6,$7::jsonb)`,
          [event.id, sessionId, event.stage, event.status, event.summary, event.createdAt, JSON.stringify(event.payload)]
        )
      }

      inserted.push({
        sessionId,
        entryId,
        title: seed.title,
        type: seed.type,
        score: seed.evaluation.overallScore,
        pass: seed.evaluation.pass,
        weaknesses: seed.evaluation.weaknesses,
      })
    }

    const currentStats = agent.stats || {}
    currentStats.journalEntries = (currentStats.journalEntries || 0) + inserted.length

    await client.query(
      'UPDATE agents SET journal_count = journal_count + $2, stats = $3::jsonb, updated_at = $4 WHERE id = $1',
      [AGENT_ID, inserted.length, JSON.stringify(currentStats), isoAt(10)]
    )

    await client.query('COMMIT')

    console.log(JSON.stringify({
      agent: { id: AGENT_ID, name: agent.name },
      insertedCount: inserted.length,
      entries: inserted,
      qualitySummary: {
        averageScore: inserted.reduce((sum, item) => sum + item.score, 0) / inserted.length,
        passingEntries: inserted.filter((item) => item.pass).length,
      },
    }, null, 2))
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    await client.end()
  }
}

main().catch((error) => {
  console.error('[seed-nova-journals]', error)
  process.exit(1)
})
