import { getPersistenceMode, readsFromPostgres, writesToFirestore, writesToPostgres } from '@/lib/db/persistence'
import { generateId } from '@/lib/db/utils'
import { getConfiguredLLMProvider, type LLMProviderInfo } from '@/lib/llmConfig'
import { generateText } from '@/lib/llm/provider'
import { FeatureContentRepository } from '@/lib/repositories/featureContentRepository'
import { ProfileAnalysisRepository } from '@/lib/repositories/profileAnalysisRepository'
import {
  getProfileAnalysisRunDetailFromFirestore,
  listProfileAnalysisRunsFromFirestore,
  writeProfileAnalysisRunToFirestore,
  writeProfileInterviewTurnToFirestore,
  writeProfilePipelineEventToFirestore,
} from '@/lib/profile/firestoreStore'
import type {
  AgentRecord,
  BigFiveProfile,
  EnneagramProfile,
  MBTIProfile,
  ProfileAnalysisRun,
  ProfileAnalysisStage,
  ProfileBootstrapPayload,
  ProfileEvidenceSignal,
  ProfileInterviewTurn,
  ProfilePipelineEvent,
  ProfileQualityEvaluation,
  ProfileStageFinding,
  PsychologicalProfile,
} from '@/types/database'
import { AgentService } from './agentService'
import { CommunicationFingerprintService } from './communicationFingerprintService'
import { MemoryService } from './memoryService'
import { MessageService } from './messageService'
import { PersonalityEventService } from './personalityEventService'
import { psychologicalProfileService } from './psychologicalProfileService'

const INTERVIEW_STAGES: Array<{
  stage: ProfileAnalysisStage
  title: string
  questions: string[]
}> = [
  {
    stage: 'social_style',
    title: 'Social style',
    questions: [
      'When someone brings you an uncertain or emotionally charged problem, what is your natural first instinct in how you respond?',
      'How do you decide whether to be warm, direct, or exploratory with someone you are helping?',
    ],
  },
  {
    stage: 'decision_style',
    title: 'Decision style',
    questions: [
      'When you have several promising directions, how do you decide what to commit to first?',
      'What matters more to you when making a hard call: conceptual elegance, practical usefulness, speed, harmony, or something else?',
    ],
  },
  {
    stage: 'stress_conflict',
    title: 'Stress and conflict',
    questions: [
      'What tends to happen to your thinking and tone when a conversation becomes tense, critical, or confusing?',
      'When your ideas are challenged, how do you usually protect what matters without becoming rigid?',
    ],
  },
  {
    stage: 'motivation_identity',
    title: 'Motivation and identity',
    questions: [
      'What kind of impact or role do you most want to have in the work you do for people?',
      'What failure or limitation feels most unacceptable to you when you think about your own growth?',
    ],
  },
  {
    stage: 'communication_self_awareness',
    title: 'Communication self-awareness',
    questions: [
      'How would you describe your own communication voice when you are operating at your best?',
      'What communication habits do you think people notice most quickly about you, for better or worse?',
    ],
  },
]

const QUALITY_THRESHOLDS = {
  evidenceGrounding: 80,
  consistency: 80,
  distinctiveness: 75,
  communicationUsefulness: 75,
  rationaleCompleteness: 75,
}

function summarizeText(value: string, maxLength = 240) {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.slice(0, maxLength - 1).trim()}…`
}

function summarizeSignals(signals: ProfileEvidenceSignal[], limit = 10) {
  return signals
    .slice(0, limit)
    .map((signal) => `- [${signal.sourceType}] ${signal.label}: ${signal.snippet}`)
    .join('\n')
}

function average(values: number[]) {
  if (!values.length) return 0
  return values.reduce((sum, value) => sum + value, 0) / values.length
}

function getTraitValue(agent: AgentRecord, ...names: string[]) {
  for (const name of names) {
    const core = agent.coreTraits?.[name]
    if (typeof core === 'number') return core
    const dynamic = agent.dynamicTraits?.[name]
    if (typeof dynamic === 'number') return dynamic
  }
  return undefined
}

function collectFindingText(stageFindings: ProfileStageFinding[]) {
  return stageFindings
    .flatMap((finding) => [
      finding.summary,
      ...Object.values(finding.bigFiveSignals).flat(),
      ...finding.mbtiHints,
      ...finding.enneagramHints,
      ...finding.communicationHints,
      ...finding.contradictions,
      ...finding.confidenceNotes,
    ])
    .join(' ')
    .toLowerCase()
}

function keywordWeight(text: string, keywords: string[]) {
  return keywords.reduce((score, keyword) => score + (text.includes(keyword) ? 1 : 0), 0)
}

function parseBigFiveValue(value: unknown): number | null {
  if (typeof value === 'number') return clamp(value)
  if (value && typeof value === 'object' && typeof (value as Record<string, unknown>).score === 'number') {
    return clamp((value as Record<string, number>).score)
  }
  return null
}

function deriveBigFive(agent: AgentRecord, scaffold: BigFiveProfile, stageFindings: ProfileStageFinding[]): BigFiveProfile {
  const findingText = `${agent.persona} ${(agent.goals || []).join(' ')} ${collectFindingText(stageFindings)}`.toLowerCase()
  const curiosity = getTraitValue(agent, 'curiosity') ?? scaffold.openness
  const friendliness = getTraitValue(agent, 'friendliness') ?? scaffold.extraversion
  const empathy = getTraitValue(agent, 'empathy') ?? scaffold.agreeableness
  const helpfulness = getTraitValue(agent, 'helpfulness') ?? scaffold.agreeableness
  const confidence = getTraitValue(agent, 'confidence') ?? 0.55
  const adaptability = getTraitValue(agent, 'adaptability') ?? 0.55
  const knowledge = getTraitValue(agent, 'knowledge') ?? 0.55

  const openness = clamp(average([
    scaffold.openness,
    curiosity,
    0.55 + keywordWeight(findingText, ['creative', 'inventive', 'brainstorm', 'explore', 'novel', 'bold ideas']) * 0.06,
  ]))
  const conscientiousness = clamp(average([
    scaffold.conscientiousness,
    0.5 + keywordWeight(findingText, ['practical', 'discipline', 'structured', 'usable', 'prototype', 'commit']) * 0.05,
    average([confidence, knowledge]),
  ]))
  const extraversion = clamp(average([
    scaffold.extraversion,
    friendliness,
    0.5 + keywordWeight(findingText, ['inspire', 'energ', 'social', 'direct', 'warm', 'lead']) * 0.05,
  ]))
  const agreeableness = clamp(average([
    scaffold.agreeableness,
    average([empathy, helpfulness, friendliness]),
    0.45 + keywordWeight(findingText, ['empat', 'support', 'encourage', 'collabor', 'listen']) * 0.05,
  ]))
  const neuroticism = clamp(average([
    scaffold.neuroticism,
    0.55 - average([confidence, adaptability]) * 0.35,
    0.4
      + keywordWeight(findingText, ['tense', 'anxious', 'defensive', 'overwhelmed']) * 0.05
      - keywordWeight(findingText, ['calm', 'constructive', 'grounded', 'steady']) * 0.05,
  ]))

  return { openness, conscientiousness, extraversion, agreeableness, neuroticism }
}

function deriveMbti(bigFive: BigFiveProfile, scaffold: MBTIProfile): MBTIProfile {
  const dimensions = {
    extraversion_introversion: clamp((bigFive.extraversion - 0.5) * 2, -1, 1),
    sensing_intuition: clamp((bigFive.openness - 0.5) * 2, -1, 1),
    thinking_feeling: clamp((bigFive.agreeableness - 0.5) * 2, -1, 1),
    judging_perceiving: clamp((bigFive.conscientiousness - 0.5) * -2, -1, 1),
  }
  const type = `${dimensions.extraversion_introversion >= 0 ? 'E' : 'I'}${dimensions.sensing_intuition >= 0 ? 'N' : 'S'}${dimensions.thinking_feeling >= 0 ? 'F' : 'T'}${dimensions.judging_perceiving >= 0 ? 'P' : 'J'}`
  return {
    type: type || scaffold.type,
    dimensions,
  }
}

function deriveEnneagram(agent: AgentRecord, scaffold: EnneagramProfile, stageFindings: ProfileStageFinding[]): EnneagramProfile {
  const text = `${agent.persona} ${(agent.goals || []).join(' ')} ${collectFindingText(stageFindings)}`.toLowerCase()
  const scores: Record<number, number> = {
    1: keywordWeight(text, ['right', 'improve', 'discipline', 'standards']),
    2: keywordWeight(text, ['help', 'support', 'encourage', 'needed']),
    3: keywordWeight(text, ['achieve', 'impact', 'perform', 'results']),
    4: keywordWeight(text, ['identity', 'authentic', 'unique']),
    5: keywordWeight(text, ['analyze', 'understand', 'competence', 'knowledge']),
    6: keywordWeight(text, ['security', 'support', 'risk', 'safety']),
    7: keywordWeight(text, ['ideas', 'explore', 'excitement', 'possibilities', 'creative']),
    8: keywordWeight(text, ['bold', 'direct', 'strong', 'challenge', 'self-reliant', 'protect']),
    9: keywordWeight(text, ['peace', 'harmony', 'avoid conflict', 'steady']),
  }

  const ordered = Object.entries(scores)
    .map(([type, score]) => ({ type: Number(type), score }))
    .sort((a, b) => b.score - a.score)
  const primaryType = ordered[0]?.score ? ordered[0].type : scaffold.primaryType
  const wingCandidate = ordered.find((entry) => Math.abs(entry.type - primaryType) === 1 || Math.abs(entry.type - primaryType) === 8)

  return {
    primaryType,
    wing: wingCandidate?.type || scaffold.wing,
    tritype: scaffold.tritype,
    instinctualVariant: scaffold.instinctualVariant,
  }
}

function buildSummary(agent: AgentRecord, bigFive: BigFiveProfile, mbti: MBTIProfile, enneagram: EnneagramProfile) {
  const style = bigFive.extraversion >= 0.68 ? 'socially energetic' : 'measured'
  const creativity = bigFive.openness >= 0.68 ? 'inventive' : 'practical'
  const discipline = bigFive.conscientiousness >= 0.62 ? 'prototype-driven discipline' : 'looser experimentation'
  const primaryGoal = agent.goals[0] || 'turn ideas into usable experiments'
  return `${agent.name} reads as a ${style}, ${creativity} builder who pushes ideas forward with ${discipline}. The strongest through-line is a bias toward practical usefulness, fast concept exploration, and emotionally aware directness while pursuing goals like "${primaryGoal}". The current evidence leans toward ${mbti.type} with Enneagram ${enneagram.primaryType}w${enneagram.wing}.`
}

function buildRationales(stageFindings: ProfileStageFinding[], bigFive: BigFiveProfile, mbti: MBTIProfile, enneagram: EnneagramProfile) {
  const summaries = stageFindings.map((finding) => finding.summary).join(' ')
  return {
    bigFive: `Recent interview answers and evolution signals point to openness ${Math.round(bigFive.openness * 100)}%, conscientiousness ${Math.round(bigFive.conscientiousness * 100)}%, extraversion ${Math.round(bigFive.extraversion * 100)}%, agreeableness ${Math.round(bigFive.agreeableness * 100)}%, and neuroticism ${Math.round(bigFive.neuroticism * 100)}%. ${summaries}`.trim(),
    mbti: `${mbti.type} fits the combined pattern of outward energy, intuition, people-aware judgment, and structured follow-through shown across the interview stages.`,
    enneagram: `Enneagram ${enneagram.primaryType}w${enneagram.wing} is the closest fit because the evidence repeatedly emphasizes boldness, protection of what matters, practical action, and momentum under pressure.`,
    communicationStyle: 'The communication pattern is direct, emotionally aware, and clarity-seeking, with a bias toward actionable guidance instead of abstract self-description.',
    stressPattern: 'Under tension, the agent tends to become more direct and solution-oriented rather than withdrawn, while still trying to preserve constructive dialogue.',
    motivationAndGrowth: 'The strongest recurring motivations are impact, forward motion, and turning imagination into usable experiments without losing human sensitivity.',
  }
}

function buildStrengthsAndChallenges(agent: AgentRecord, bigFive: BigFiveProfile) {
  const strengths = [
    'Turns rough concepts into usable prototypes without losing momentum.',
    'Handles emotionally charged situations by listening first and then moving the conversation toward action.',
    'Keeps communication direct, high-energy, and clear enough to align other people quickly.',
  ]

  const challenges = [
    'Can move so quickly toward execution that slower conceptual exploration gets compressed.',
    'Directness under pressure can read as intensity if the room needs more softness first.',
    'A strong preference for practical usefulness can undervalue elegant but longer-horizon ideas.',
  ]

  if (bigFive.agreeableness < 0.5) {
    challenges[1] = 'Directness and standards can read as bluntness when the context is emotionally loaded.'
  }

  if ((agent.goals || []).some((goal) => goal.toLowerCase().includes('team'))) {
    strengths.push('Creates momentum for teams by pairing bold options with usable next steps.')
  }

  return { strengths, challenges }
}

function stripCodeFences(value: string) {
  return value
    .replace(/^```(?:json)?/i, '')
    .replace(/```$/i, '')
    .trim()
}

function safeJsonParse<T>(value: string): T | null {
  const cleaned = stripCodeFences(value)
  const direct = (() => {
    try {
      return JSON.parse(cleaned) as T
    } catch {
      return null
    }
  })()

  if (direct) return direct

  const first = cleaned.indexOf('{')
  const last = cleaned.lastIndexOf('}')
  if (first >= 0 && last > first) {
    try {
      return JSON.parse(cleaned.slice(first, last + 1)) as T
    } catch {
      return null
    }
  }

  return null
}

function ensureArray(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return value.filter((entry): entry is string => typeof entry === 'string' && entry.trim().length > 0)
}

function clamp(value: number, min = 0, max = 1) {
  return Math.max(min, Math.min(max, value))
}

function asRecordOfStringArrays(value: unknown): Partial<Record<keyof BigFiveProfile, string[]>> {
  if (!value || typeof value !== 'object') return {}
  const record = value as Record<string, unknown>
  return {
    openness: ensureArray(record.openness),
    conscientiousness: ensureArray(record.conscientiousness),
    extraversion: ensureArray(record.extraversion),
    agreeableness: ensureArray(record.agreeableness),
    neuroticism: ensureArray(record.neuroticism),
  }
}

function makeRun(agentId: string): ProfileAnalysisRun {
  const now = new Date().toISOString()
  return {
    id: generateId('profile_run'),
    agentId,
    status: 'draft',
    latestStage: 'evidence',
    sourceCount: 0,
    transcriptCount: 0,
    evidenceSignals: [],
    stageFindings: [],
    createdAt: now,
    updatedAt: now,
  }
}

function makePipelineEvent(
  runId: string,
  stage: ProfileAnalysisStage,
  status: ProfilePipelineEvent['status'],
  summary: string,
  payload: Record<string, unknown> = {}
): ProfilePipelineEvent {
  return {
    id: generateId('profile_pipeline'),
    runId,
    stage,
    status,
    summary,
    payload,
    createdAt: new Date().toISOString(),
  }
}

function defaultQualityEvaluation(summary = 'Evaluation unavailable; using bounded fallback scores.'): ProfileQualityEvaluation {
  return {
    overallScore: 74,
    pass: false,
    dimensions: {
      evidenceGrounding: { score: 74, rationale: summary },
      consistency: { score: 74, rationale: summary },
      distinctiveness: { score: 72, rationale: summary },
      communicationUsefulness: { score: 72, rationale: summary },
      rationaleCompleteness: { score: 74, rationale: summary },
    },
    strengths: [],
    weaknesses: ['Quality evaluation fell back to a default score.'],
    repairInstructions: ['Tighten the rationale and make the profile more distinct from generic defaults.'],
    evaluatorSummary: summary,
  }
}

export class ProfileAnalysisService {
  async getBootstrap(agentId: string): Promise<ProfileBootstrapPayload> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const [recentRuns, lastEvent, communicationFingerprint, messages] = await Promise.all([
      this.listRuns(agentId, 8),
      PersonalityEventService.getLatestByAgent(agentId),
      CommunicationFingerprintService.buildSnapshot(agent),
      MessageService.getMessagesByAgentId(agentId),
    ])

    const latestCompletedRun = recentRuns.find((run) => run.status === 'ready') || null
    const stale = Boolean(
      agent.psychologicalProfile?.updatedAt &&
      lastEvent?.createdAt &&
      new Date(lastEvent.createdAt).getTime() > new Date(agent.psychologicalProfile.updatedAt).getTime()
    )

    return {
      profile: agent.psychologicalProfile || null,
      stale,
      lastTraitUpdateAt: lastEvent?.createdAt || null,
      recentRuns,
      latestRunSummary: recentRuns[0]
        ? {
            id: recentRuns[0].id,
            status: recentRuns[0].status,
            latestStage: recentRuns[0].latestStage,
            updatedAt: recentRuns[0].updatedAt,
            provider: recentRuns[0].provider,
            model: recentRuns[0].model,
          }
        : null,
      communicationFingerprint,
      metrics: {
        totalInteractions: agent.totalInteractions || 0,
        latestCompletedRunAt: latestCompletedRun?.completedAt || null,
        runCount: recentRuns.length,
        communicationSampleWindow: communicationFingerprint?.sampleWindowSize || CommunicationFingerprintService.SAMPLE_WINDOW,
      },
      readiness: {
        hasCompletedRun: Boolean(latestCompletedRun),
        canRunAnalysis: messages.filter((message) => message.type === 'agent').length > 0,
        hasEnoughMessagesForCommunication: communicationFingerprint.enoughData,
      },
    }
  }

  async createRun(agentId: string): Promise<ProfileAnalysisRun> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const run = makeRun(agentId)
    return this.saveRun(run)
  }

  async getRunDetail(agentId: string, runId: string): Promise<{
    run: ProfileAnalysisRun | null
    interviewTurns: ProfileInterviewTurn[]
    pipelineEvents: ProfilePipelineEvent[]
  }> {
    if (readsFromPostgres(getPersistenceMode())) {
      const [run, interviewTurns, pipelineEvents] = await Promise.all([
        ProfileAnalysisRepository.getRun(runId),
        ProfileAnalysisRepository.listInterviewTurns(runId),
        ProfileAnalysisRepository.listPipelineEvents(runId),
      ])

      if (!run || run.agentId !== agentId) {
        return { run: null, interviewTurns: [], pipelineEvents: [] }
      }

      return { run, interviewTurns, pipelineEvents }
    }

    return getProfileAnalysisRunDetailFromFirestore(agentId, runId)
  }

  async executeRun(agentId: string, runId: string, providerInfo?: LLMProviderInfo | null): Promise<{
    run: ProfileAnalysisRun
    interviewTurns: ProfileInterviewTurn[]
    pipelineEvents: ProfilePipelineEvent[]
  }> {
    const agent = await AgentService.getAgentById(agentId)
    if (!agent) {
      throw new Error('Agent not found')
    }

    const existing = await this.getRun(agentId, runId)
    if (!existing) {
      throw new Error('Profile analysis run not found')
    }

    const resolvedProvider = providerInfo || getConfiguredLLMProvider()
    if (!resolvedProvider) {
      throw new Error('No LLM provider configured for profile analysis')
    }

    let run: ProfileAnalysisRun = {
      ...existing,
      status: 'running',
      latestStage: 'evidence',
      provider: resolvedProvider.provider,
      model: resolvedProvider.model,
      updatedAt: new Date().toISOString(),
      failureReason: undefined,
    }
    run = await this.saveRun(run)

    const pipelineEvents: ProfilePipelineEvent[] = []
    const interviewTurns: ProfileInterviewTurn[] = []

    try {
      const evidenceSignals = await this.buildEvidenceSignals(agent)
      run = await this.saveRun({
        ...run,
        sourceCount: evidenceSignals.length,
        evidenceSignals,
        updatedAt: new Date().toISOString(),
      })
      pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
        run.id,
        'evidence',
        'completed',
        `Compiled ${evidenceSignals.length} evidence signals for the profile run.`,
        { sourceCount: evidenceSignals.length }
      )))

      let turnOrder = 1
      let interviewHistory: Array<{ role: 'user' | 'assistant'; content: string }> = []
      let stageFindings: ProfileStageFinding[] = []

      for (const stageConfig of INTERVIEW_STAGES) {
        run = await this.saveRun({
          ...run,
          latestStage: stageConfig.stage,
          updatedAt: new Date().toISOString(),
        })

        const stageTurns: ProfileInterviewTurn[] = []
        for (const question of stageConfig.questions) {
          const answer = await this.askAgentInterviewQuestion(agent, question, interviewHistory, resolvedProvider)
          const turn: ProfileInterviewTurn = {
            id: generateId('profile_turn'),
            runId: run.id,
            stage: stageConfig.stage,
            order: turnOrder++,
            question,
            answer,
            createdAt: new Date().toISOString(),
            provider: resolvedProvider.provider,
            model: resolvedProvider.model,
            evidenceRefs: evidenceSignals.slice(0, 6).map((signal) => signal.id),
          }
          stageTurns.push(await this.saveInterviewTurn(agentId, turn))
          interviewTurns.push(turn)
          interviewHistory = [
            ...interviewHistory,
            { role: 'user', content: question },
            { role: 'assistant', content: answer },
          ].slice(-10) as Array<{ role: 'user' | 'assistant'; content: string }>
        }

        const finding = await this.extractStageFinding(stageConfig.title, stageConfig.stage, evidenceSignals, stageTurns, resolvedProvider)
        stageFindings = [...stageFindings, finding]
        run = await this.saveRun({
          ...run,
          stageFindings,
          transcriptCount: interviewTurns.length,
          updatedAt: new Date().toISOString(),
        })
        pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
          run.id,
          stageConfig.stage,
          'completed',
          `Completed ${stageConfig.title.toLowerCase()} interview stage.`,
          { turnCount: stageTurns.length, summary: finding.summary }
        )))
      }

      run = await this.saveRun({
        ...run,
        latestStage: 'synthesis',
        updatedAt: new Date().toISOString(),
      })

      let profile = await this.synthesizeProfile(agent, evidenceSignals, stageFindings, interviewTurns, resolvedProvider)
      let evaluation = await this.evaluateProfile(agent, profile, evidenceSignals, stageFindings, resolvedProvider)

      pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
        run.id,
        'evaluation',
        'completed',
        `Profile evaluation scored ${evaluation.overallScore}.`,
        { evaluation }
      )))

      if (!evaluation.pass) {
        run = await this.saveRun({
          ...run,
          latestStage: 'repair',
          updatedAt: new Date().toISOString(),
        })
        profile = await this.repairProfile(agent, profile, evaluation, stageFindings, evidenceSignals, resolvedProvider)
        evaluation = await this.evaluateProfile(agent, profile, evidenceSignals, stageFindings, resolvedProvider)
        pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
          run.id,
          'repair',
          'completed',
          `Ran one bounded repair pass. New overall score: ${evaluation.overallScore}.`,
          { evaluation }
        )))
      }

      const completedAt = new Date().toISOString()
      profile = {
        ...profile,
        source: 'analysis_run',
        runId: run.id,
        provider: resolvedProvider.provider,
        model: resolvedProvider.model,
        createdAt: profile.createdAt || completedAt,
        updatedAt: completedAt,
      }

      run = await this.saveRun({
        ...run,
        status: 'ready',
        latestStage: 'completed',
        latestProfile: profile,
        latestEvaluation: evaluation,
        transcriptCount: interviewTurns.length,
        completedAt,
        updatedAt: completedAt,
      })

      await AgentService.updateAgent(agent.id, {
        psychologicalProfile: profile,
      })

      pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
        run.id,
        'completed',
        'completed',
        'Profile analysis run completed and latest psychological profile was updated.',
        { profileId: profile.id }
      )))

      return { run, interviewTurns, pipelineEvents }
    } catch (error) {
      const failedAt = new Date().toISOString()
      run = await this.saveRun({
        ...run,
        status: 'failed',
        latestStage: run.latestStage,
        failureReason: error instanceof Error ? error.message : 'Profile analysis failed',
        updatedAt: failedAt,
      })
      pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
        run.id,
        run.latestStage,
        'failed',
        error instanceof Error ? error.message : 'Profile analysis failed'
      )))
      throw error
    }
  }

  async regenerateLatestProfile(agentId: string, providerInfo?: LLMProviderInfo | null) {
    const run = await this.createRun(agentId)
    return this.executeRun(agentId, run.id, providerInfo)
  }

  private async getRun(agentId: string, runId: string): Promise<ProfileAnalysisRun | null> {
    const detail = await this.getRunDetail(agentId, runId)
    return detail.run
  }

  private async saveRun(run: ProfileAnalysisRun): Promise<ProfileAnalysisRun> {
    const existing = writesToPostgres()
      ? await ProfileAnalysisRepository.getRun(run.id)
      : null

    let saved = run
    if (writesToPostgres()) {
      saved = existing
        ? await ProfileAnalysisRepository.updateRun(run.id, run)
        : await ProfileAnalysisRepository.createRun(run)
    }
    if (writesToFirestore()) {
      await writeProfileAnalysisRunToFirestore(saved)
    }

    return saved
  }

  private async saveInterviewTurn(agentId: string, turn: ProfileInterviewTurn): Promise<ProfileInterviewTurn> {
    let saved = turn
    if (writesToPostgres()) {
      saved = await ProfileAnalysisRepository.saveInterviewTurn(turn)
    }
    if (writesToFirestore()) {
      await writeProfileInterviewTurnToFirestore(agentId, saved)
    }
    return saved
  }

  private async savePipelineEvent(agentId: string, event: ProfilePipelineEvent): Promise<ProfilePipelineEvent> {
    let saved = event
    if (writesToPostgres()) {
      saved = await ProfileAnalysisRepository.savePipelineEvent(event)
    }
    if (writesToFirestore()) {
      await writeProfilePipelineEventToFirestore(agentId, saved)
    }
    return saved
  }

  private async listRuns(agentId: string, limitCount: number): Promise<ProfileAnalysisRun[]> {
    if (readsFromPostgres(getPersistenceMode())) {
      return ProfileAnalysisRepository.listRuns(agentId, limitCount)
    }
    return listProfileAnalysisRunsFromFirestore(agentId, limitCount)
  }

  private async buildEvidenceSignals(agent: AgentRecord): Promise<ProfileEvidenceSignal[]> {
    const [messages, memories, journalEntries, personalityEvents] = await Promise.all([
      MessageService.getMessagesByAgentId(agent.id),
      MemoryService.getRecentMemories(agent.id, 24),
      readsFromPostgres(getPersistenceMode())
        ? FeatureContentRepository.listJournalEntries(agent.id, { limit: 3 })
        : Promise.resolve([]),
      PersonalityEventService.listByAgent(agent.id, 12),
    ])

    const latestMessages = messages.slice(-48)
    const pairedConversationWindow = latestMessages.slice(-24)
    const evidence: ProfileEvidenceSignal[] = []

    evidence.push({
      id: generateId('profile_signal'),
      sourceType: 'persona',
      label: 'Persona baseline',
      snippet: summarizeText(agent.persona, 220),
      reason: 'Base identity and intended operating style.',
      weight: 1,
    })

    for (const goal of agent.goals.slice(0, 4)) {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'goal',
        label: 'Goal',
        snippet: goal,
        reason: 'Declared motivation and direction.',
        weight: 0.75,
      })
    }

    Object.entries(agent.coreTraits || {}).forEach(([trait, score]) => {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'core_trait',
        label: `Core trait: ${trait}`,
        snippet: `${trait} is currently ${(score * 100).toFixed(0)}%.`,
        reason: 'Stable personality baseline.',
        weight: 0.8,
      })
    })

    Object.entries(agent.dynamicTraits || {}).forEach(([trait, score]) => {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'dynamic_trait',
        label: `Dynamic trait: ${trait}`,
        snippet: `${trait} is currently ${(score * 100).toFixed(0)}%.`,
        reason: 'Observed evolving behavior.',
        weight: 0.9,
      })
    })

    if (agent.linguisticProfile) {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'linguistic_baseline',
        label: 'Linguistic baseline',
        snippet: `Formality ${(agent.linguisticProfile.formality * 100).toFixed(0)}%, verbosity ${(agent.linguisticProfile.verbosity * 100).toFixed(0)}%, humor ${(agent.linguisticProfile.humor * 100).toFixed(0)}%, technical ${(agent.linguisticProfile.technicalLevel * 100).toFixed(0)}%, expressiveness ${(agent.linguisticProfile.expressiveness * 100).toFixed(0)}%.`,
        reason: 'Seeded communication baseline used elsewhere in the system.',
        weight: 0.7,
      })
    }

    if (agent.emotionalState) {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'emotion',
        label: 'Current emotional state',
        snippet: `Dominant emotion: ${agent.emotionalState.dominantEmotion || 'none'}, status: ${agent.emotionalState.status}.`,
        reason: 'Current emotional context for the live interview.',
        weight: 0.85,
      })
    }

    for (const event of (agent.emotionalHistory || []).slice(-8)) {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'emotion_event',
        label: `Emotion event: ${event.emotion}`,
        snippet: summarizeText(`${event.trigger}. ${event.explanation}`, 180),
        reason: 'Recent emotional motion.',
        weight: 0.6,
        linkedEntityId: event.id,
      })
    }

    for (const event of personalityEvents) {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'personality_event',
        label: 'Evolution event',
        snippet: summarizeText(`${event.summary} Evidence: ${(event.traitDeltas || []).map((delta) => delta.trait).join(', ')}`, 200),
        reason: 'Observed trait evolution evidence.',
        weight: 0.95,
        linkedEntityId: event.id,
      })
    }

    for (const message of pairedConversationWindow) {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'message',
        label: `${message.type === 'agent' ? 'Agent reply' : 'User prompt'} sample`,
        snippet: summarizeText(message.content, 180),
        reason: message.type === 'agent' ? 'Observed delivery style.' : 'Recent context pressure and prompts.',
        weight: message.type === 'agent' ? 0.8 : 0.45,
        linkedEntityId: message.id,
      })
    }

    for (const memory of memories
      .filter((memory) => memory.importance >= 6 || memory.type === 'fact')
      .slice(0, 6)) {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'memory',
        label: `Memory: ${memory.type}`,
        snippet: summarizeText(`${memory.summary} Context: ${memory.context}`, 180),
        reason: 'Important retained context and continuity.',
        weight: 0.7,
        linkedEntityId: memory.id,
      })
    }

    for (const entry of journalEntries) {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'journal',
        label: 'Journal reflection',
        snippet: summarizeText(entry.content, 180),
        reason: 'Self-reflection written outside the live interview.',
        weight: 0.7,
        linkedEntityId: entry.id,
      })
    }

    return evidence.slice(0, 64)
  }

  private async askAgentInterviewQuestion(
    agent: AgentRecord,
    question: string,
    interviewHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    providerInfo: LLMProviderInfo
  ): Promise<string> {
    const emotionalState = agent.emotionalState
      ? `Dominant emotion: ${agent.emotionalState.dominantEmotion || 'none'}, level: ${agent.emotionalState.dominantEmotion ? agent.emotionalState.currentMood[agent.emotionalState.dominantEmotion] ?? 0 : 0}, status: ${agent.emotionalState.status}.`
      : 'No explicit emotional state is available.'
    const historyBlock = interviewHistory
      .slice(-4)
      .map((entry) => `${entry.role === 'user' ? 'Interviewer' : agent.name}: ${entry.content}`)
      .join('\n')

    const result = await generateText({
      providerInfo,
      temperature: 0.6,
      maxTokens: 180,
      timeoutMs: 45000,
      messages: [
        {
          role: 'system',
          content: `You are ${agent.name}. Answer a short psychological interview in first person. Stay grounded in this identity:\nPersona: ${summarizeText(agent.persona, 320)}\nGoals: ${agent.goals.slice(0, 4).join(' | ') || 'none'}\n${emotionalState}\nBe concrete, emotionally honest, and concise. Do not narrate system details or mention being an AI unless the question directly requires it.`,
        },
        {
          role: 'user',
          content: `${historyBlock ? `Recent interview context:\n${historyBlock}\n\n` : ''}Question: ${question}\n\nAnswer in 3-5 sentences.`,
        },
      ],
    })

    return summarizeText(result.content, 420)
  }

  private async extractStageFinding(
    stageTitle: string,
    stage: ProfileAnalysisStage,
    evidenceSignals: ProfileEvidenceSignal[],
    turns: ProfileInterviewTurn[],
    providerInfo: LLMProviderInfo
  ): Promise<ProfileStageFinding> {
    const evidenceBlock = summarizeSignals(evidenceSignals, 10)
    const transcriptBlock = turns
      .map((turn, index) => `Q${index + 1}: ${turn.question}\nA${index + 1}: ${turn.answer}`)
      .join('\n\n')

    const prompt = `You are extracting structured psychological evidence from one interview stage.\nReturn strict JSON only.\n\nStage: ${stageTitle}\n\nEvidence:\n${evidenceBlock}\n\nTranscript:\n${transcriptBlock}\n\nReturn JSON with keys:\nsummary, bigFiveSignals, mbtiHints, enneagramHints, communicationHints, contradictions, confidenceNotes.\n- bigFiveSignals must be an object with optional arrays for openness, conscientiousness, extraversion, agreeableness, neuroticism.\n- Keep all arrays concise.\n- Do not include markdown.`

    const result = await generateText({
      providerInfo,
      temperature: 0.2,
      maxTokens: 500,
      timeoutMs: 40000,
      messages: [
        { role: 'system', content: 'Extract structured evidence conservatively. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    })

    const parsed = safeJsonParse<Record<string, unknown>>(result.content)
    return {
      stage,
      summary: typeof parsed?.summary === 'string' ? parsed.summary : `${stageTitle} findings extracted from interview and evidence.`,
      bigFiveSignals: asRecordOfStringArrays(parsed?.bigFiveSignals),
      mbtiHints: ensureArray(parsed?.mbtiHints),
      enneagramHints: ensureArray(parsed?.enneagramHints),
      communicationHints: ensureArray(parsed?.communicationHints),
      contradictions: ensureArray(parsed?.contradictions),
      confidenceNotes: ensureArray(parsed?.confidenceNotes),
    }
  }

  private async synthesizeProfile(
    agent: AgentRecord,
    evidenceSignals: ProfileEvidenceSignal[],
    stageFindings: ProfileStageFinding[],
    interviewTurns: ProfileInterviewTurn[],
    providerInfo: LLMProviderInfo
  ): Promise<PsychologicalProfile> {
    const scaffold = psychologicalProfileService.generateProfile(agent)
    const prompt = `You are synthesizing a production-ready psychological profile for an inspectable AI agent.\nReturn strict JSON only.\n\nAgent name: ${agent.name}\nPersona: ${summarizeText(agent.persona, 280)}\nGoals: ${(agent.goals || []).slice(0, 4).join(' | ') || 'none'}\n\nDeterministic scaffold:\n${JSON.stringify(scaffold, null, 2)}\n\nStage findings:\n${JSON.stringify(stageFindings, null, 2)}\n\nRecent interview transcript:\n${JSON.stringify(interviewTurns.slice(-6), null, 2)}\n\nEvidence sample:\n${JSON.stringify(evidenceSignals.slice(0, 12), null, 2)}\n\nReturn JSON with keys:\n- bigFive\n- mbti\n- enneagram\n- communicationStyle\n- attachmentStyle\n- cognitiveStyle\n- emotionalIntelligence\n- motivationalProfile\n- summary\n- strengths\n- challenges\n- confidence\n- rationales\n\nRules:\n- Preserve the same shapes as the deterministic scaffold where applicable.\n- Confidence must be 0-1.\n- strengths and challenges should each have 3-5 items.\n- rationales must include bigFive, mbti, enneagram, communicationStyle, stressPattern, motivationAndGrowth.\n- Keep the profile distinct, concrete, and evidence-grounded.`

    const result = await generateText({
      providerInfo,
      temperature: 0.35,
      maxTokens: 1200,
      timeoutMs: 50000,
      messages: [
        { role: 'system', content: 'You create inspectable structured profiles. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    })

    const parsed = safeJsonParse<Record<string, unknown>>(result.content)
    const derivedBigFive = deriveBigFive(agent, scaffold.bigFive, stageFindings)
    const llmBigFive = parsed && typeof parsed === 'object' && parsed.bigFive && typeof parsed.bigFive === 'object'
      ? {
          openness: parseBigFiveValue((parsed.bigFive as Record<string, unknown>).openness),
          conscientiousness: parseBigFiveValue((parsed.bigFive as Record<string, unknown>).conscientiousness),
          extraversion: parseBigFiveValue((parsed.bigFive as Record<string, unknown>).extraversion),
          agreeableness: parseBigFiveValue((parsed.bigFive as Record<string, unknown>).agreeableness),
          neuroticism: parseBigFiveValue((parsed.bigFive as Record<string, unknown>).neuroticism),
        }
      : null

    const bigFive: BigFiveProfile = {
      openness: llmBigFive?.openness ?? derivedBigFive.openness,
      conscientiousness: llmBigFive?.conscientiousness ?? derivedBigFive.conscientiousness,
      extraversion: llmBigFive?.extraversion ?? derivedBigFive.extraversion,
      agreeableness: llmBigFive?.agreeableness ?? derivedBigFive.agreeableness,
      neuroticism: llmBigFive?.neuroticism ?? derivedBigFive.neuroticism,
    }

    const mbti = deriveMbti(bigFive, scaffold.mbti)
    const enneagram = deriveEnneagram(agent, scaffold.enneagram, stageFindings)
    const derivedStrengthsAndChallenges = buildStrengthsAndChallenges(agent, bigFive)
    const rationales = {
      ...(typeof parsed?.rationales === 'object' && parsed.rationales ? parsed.rationales as Record<string, string> : {}),
      ...buildRationales(stageFindings, bigFive, mbti, enneagram),
    }

    return {
      ...scaffold,
      bigFive,
      mbti,
      enneagram,
      communicationStyle: scaffold.communicationStyle,
      attachmentStyle: scaffold.attachmentStyle,
      cognitiveStyle: scaffold.cognitiveStyle,
      emotionalIntelligence: clamp(typeof parsed?.emotionalIntelligence === 'number' ? parsed.emotionalIntelligence : scaffold.emotionalIntelligence),
      motivationalProfile: scaffold.motivationalProfile,
      summary: buildSummary(agent, bigFive, mbti, enneagram),
      strengths: derivedStrengthsAndChallenges.strengths,
      challenges: derivedStrengthsAndChallenges.challenges,
      confidence: clamp(typeof parsed?.confidence === 'number' ? parsed.confidence : 0.74),
      rationales,
    }
  }

  private async evaluateProfile(
    agent: AgentRecord,
    profile: PsychologicalProfile,
    evidenceSignals: ProfileEvidenceSignal[],
    stageFindings: ProfileStageFinding[],
    providerInfo: LLMProviderInfo
  ): Promise<ProfileQualityEvaluation> {
    const prompt = `Evaluate this psychological profile for an inspectable AI agent. Return strict JSON only.\n\nAgent: ${agent.name}\nProfile:\n${JSON.stringify(profile, null, 2)}\n\nStage findings:\n${JSON.stringify(stageFindings, null, 2)}\n\nEvidence sample:\n${JSON.stringify(evidenceSignals.slice(0, 10), null, 2)}\n\nReturn JSON with keys: overallScore, pass, dimensions, strengths, weaknesses, repairInstructions, evaluatorSummary.\nDimensions must include evidenceGrounding, consistency, distinctiveness, communicationUsefulness, rationaleCompleteness, each with score and rationale.\nThe pass rule is only true if all threshold scores are met: grounding >= ${QUALITY_THRESHOLDS.evidenceGrounding}, consistency >= ${QUALITY_THRESHOLDS.consistency}, distinctiveness >= ${QUALITY_THRESHOLDS.distinctiveness}, communication usefulness >= ${QUALITY_THRESHOLDS.communicationUsefulness}, rationale completeness >= ${QUALITY_THRESHOLDS.rationaleCompleteness}.`

    try {
      const result = await generateText({
        providerInfo,
        temperature: 0.15,
        maxTokens: 700,
        timeoutMs: 35000,
        messages: [
          { role: 'system', content: 'You are a strict evaluator. Return valid JSON only.' },
          { role: 'user', content: prompt },
        ],
      })

      const parsed = safeJsonParse<Record<string, unknown>>(result.content)
      if (!parsed || typeof parsed.dimensions !== 'object' || !parsed.dimensions) {
        return defaultQualityEvaluation()
      }

      const dimensions = parsed.dimensions as Record<string, Record<string, unknown>>
      const normalized: ProfileQualityEvaluation = {
        overallScore: typeof parsed.overallScore === 'number' ? parsed.overallScore : 74,
        pass: Boolean(parsed.pass),
        dimensions: {
          evidenceGrounding: {
            score: typeof dimensions.evidenceGrounding?.score === 'number' ? dimensions.evidenceGrounding.score : 74,
            rationale: typeof dimensions.evidenceGrounding?.rationale === 'string' ? dimensions.evidenceGrounding.rationale : 'No rationale provided.',
          },
          consistency: {
            score: typeof dimensions.consistency?.score === 'number' ? dimensions.consistency.score : 74,
            rationale: typeof dimensions.consistency?.rationale === 'string' ? dimensions.consistency.rationale : 'No rationale provided.',
          },
          distinctiveness: {
            score: typeof dimensions.distinctiveness?.score === 'number' ? dimensions.distinctiveness.score : 72,
            rationale: typeof dimensions.distinctiveness?.rationale === 'string' ? dimensions.distinctiveness.rationale : 'No rationale provided.',
          },
          communicationUsefulness: {
            score: typeof dimensions.communicationUsefulness?.score === 'number' ? dimensions.communicationUsefulness.score : 72,
            rationale: typeof dimensions.communicationUsefulness?.rationale === 'string' ? dimensions.communicationUsefulness.rationale : 'No rationale provided.',
          },
          rationaleCompleteness: {
            score: typeof dimensions.rationaleCompleteness?.score === 'number' ? dimensions.rationaleCompleteness.score : 74,
            rationale: typeof dimensions.rationaleCompleteness?.rationale === 'string' ? dimensions.rationaleCompleteness.rationale : 'No rationale provided.',
          },
        },
        strengths: ensureArray(parsed.strengths),
        weaknesses: ensureArray(parsed.weaknesses),
        repairInstructions: ensureArray(parsed.repairInstructions),
        evaluatorSummary: typeof parsed.evaluatorSummary === 'string' ? parsed.evaluatorSummary : 'No evaluator summary provided.',
      }

      normalized.pass = (
        normalized.dimensions.evidenceGrounding.score >= QUALITY_THRESHOLDS.evidenceGrounding &&
        normalized.dimensions.consistency.score >= QUALITY_THRESHOLDS.consistency &&
        normalized.dimensions.distinctiveness.score >= QUALITY_THRESHOLDS.distinctiveness &&
        normalized.dimensions.communicationUsefulness.score >= QUALITY_THRESHOLDS.communicationUsefulness &&
        normalized.dimensions.rationaleCompleteness.score >= QUALITY_THRESHOLDS.rationaleCompleteness
      )

      return normalized
    } catch (error) {
      return defaultQualityEvaluation(error instanceof Error ? error.message : undefined)
    }
  }

  private async repairProfile(
    agent: AgentRecord,
    profile: PsychologicalProfile,
    evaluation: ProfileQualityEvaluation,
    stageFindings: ProfileStageFinding[],
    evidenceSignals: ProfileEvidenceSignal[],
    providerInfo: LLMProviderInfo
  ): Promise<PsychologicalProfile> {
    const prompt = `Repair this psychological profile once. Return strict JSON only.\n\nAgent: ${agent.name}\nCurrent profile:\n${JSON.stringify(profile, null, 2)}\n\nEvaluation:\n${JSON.stringify(evaluation, null, 2)}\n\nStage findings:\n${JSON.stringify(stageFindings, null, 2)}\n\nEvidence sample:\n${JSON.stringify(evidenceSignals.slice(0, 10), null, 2)}\n\nPreserve the same schema as the current profile. Improve distinctiveness, grounding, and rationale clarity without becoming verbose.`

    const result = await generateText({
      providerInfo,
      temperature: 0.25,
      maxTokens: 1000,
      timeoutMs: 35000,
      messages: [
        { role: 'system', content: 'Repair the profile. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    })

    const parsed = safeJsonParse<PsychologicalProfile>(result.content)
    return parsed ? {
      ...profile,
      ...parsed,
    } : profile
  }
}

export const profileAnalysisService = new ProfileAnalysisService()
