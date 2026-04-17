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
  ProfileClaimEvidenceMap,
  ProfileClaimRef,
  ProfileEvidenceCoverageSummary,
  ProfileAnalysisStage,
  ProfileBootstrapPayload,
  ProfileEvidenceSignal,
  ProfileInterviewTurn,
  ProfilePipelineEvent,
  ProfileQualityEvaluation,
  ProfileStageFinding,
  PsychologicalProfile,
} from '@/types/database'
import { applyFinalQualityGate } from './outputQuality/evaluators'
import { createPendingTrackedFields } from './outputQuality/contracts'
import { createValidationReport, validateRequiredTextFields, validateSharedArtifactText, validateSourceRefs } from './outputQuality/validators'
import type { OutputQualityRawModelOutput, OutputQualitySourceRef, OutputQualityValidationReport } from '@/types/outputQuality'
import { AgentService } from './agentService'
import { CommunicationFingerprintService } from './communicationFingerprintService'
import { LearningService } from './learningService'
import { MemoryService } from './memoryService'
import { MessageService } from './messageService'
import { PersonalityEventService } from './personalityEventService'
import { psychologicalProfileService } from './psychologicalProfileService'

const PROFILE_PROMPT_VERSION = 'phase3-profile-evidence-led-v1'
const PROFILE_VALIDATOR_VERSION = 'phase3-profile-validator-v1'
const PROFILE_VERSION = 'phase3-profile-v1'
const PROFILE_OVERALL_SCORE_MINIMUM = 80
const PROFILE_DIMENSION_FLOOR = 75
const PROFILE_EVIDENCE_COVERAGE_MINIMUM = 80

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

function isLocalBaselineProvider(providerInfo: LLMProviderInfo) {
  return providerInfo.provider === 'ollama' && /qwen2\.5:7b|llama3\.2/i.test(providerInfo.model)
}

function getInterviewQuestionLimit(providerInfo: LLMProviderInfo) {
  return isLocalBaselineProvider(providerInfo) ? 1 : 2
}

function buildCompactEvidenceBlock(evidenceSignals: ProfileEvidenceSignal[], limit: number) {
  return evidenceSignals
    .slice(0, limit)
    .map((signal) => `- ${signal.id} | ${signal.label} | ${summarizeText(signal.snippet, 150)}`)
    .join('\n')
}

function buildCompactInterviewBlock(turns: ProfileInterviewTurn[], limit: number) {
  return turns
    .slice(-limit)
    .map((turn, index) => [
      `Turn ${index + 1} [${turn.stage}]`,
      `Q: ${summarizeText(turn.question, 160)}`,
      `A: ${summarizeText(turn.answer, 220)}`,
      `Refs: ${(turn.evidenceRefs || []).slice(0, 5).join(', ') || 'none'}`,
    ].join('\n'))
    .join('\n\n')
}

function buildCompactStageFindingsBlock(stageFindings: ProfileStageFinding[]) {
  return stageFindings
    .map((finding, index) => {
      const claimBlock = (finding.claims || [])
        .slice(0, 3)
        .map((claim) => `${summarizeText(claim.claim, 140)} [${claim.evidenceRefs.slice(0, 4).join(', ')}]`)
        .join(' | ')

      return [
        `${index + 1}. ${finding.stage}: ${summarizeText(finding.summary, 200)}`,
        claimBlock ? `Claims: ${claimBlock}` : '',
        finding.communicationHints.length ? `Communication hints: ${finding.communicationHints.slice(0, 2).join(' | ')}` : '',
        finding.mbtiHints.length ? `MBTI hints: ${finding.mbtiHints.slice(0, 2).join(' | ')}` : '',
        finding.enneagramHints.length ? `Enneagram hints: ${finding.enneagramHints.slice(0, 2).join(' | ')}` : '',
      ].filter(Boolean).join('\n')
    })
    .join('\n\n')
}

function createRawModelOutput(text: string): OutputQualityRawModelOutput {
  return {
    text,
    capturedAt: new Date().toISOString(),
    responseFormat: 'json_object',
    promptVersion: PROFILE_PROMPT_VERSION,
  }
}

function toSourceRefs(signals: ProfileEvidenceSignal[]): OutputQualitySourceRef[] {
  return signals.map((signal) => ({
    id: signal.id,
    sourceType: signal.sourceType,
    label: signal.label,
    reason: signal.reason,
    linkedEntityId: signal.linkedEntityId,
  }))
}

function normalizeEvidenceRefList(value: unknown, knownRefs: Set<string>, fallback: string[] = []): string[] {
  const refs = Array.isArray(value)
    ? value.filter((entry): entry is string => typeof entry === 'string' && knownRefs.has(entry))
    : []
  return refs.length > 0 ? Array.from(new Set(refs)) : fallback
}

function normalizeProfileClaimRefs(value: unknown, knownRefs: Set<string>, fallback: string[] = []): ProfileClaimRef[] {
  if (!Array.isArray(value)) return []
  return value
    .map((entry) => {
      if (!entry || typeof entry !== 'object') return null
      const record = entry as Record<string, unknown>
      const claim = typeof record.claim === 'string' ? summarizeText(record.claim, 220) : ''
      const evidenceRefs = normalizeEvidenceRefList(record.evidenceRefs, knownRefs, fallback)
      if (!claim || evidenceRefs.length === 0) return null
      return { claim, evidenceRefs }
    })
    .filter((entry): entry is ProfileClaimRef => Boolean(entry))
}

function listClaimEvidenceCoverage(refs: string[] | undefined) {
  return Array.isArray(refs) && refs.length > 0
}

function computeEvidenceCoverage(profile: PsychologicalProfile | undefined | null): ProfileEvidenceCoverageSummary {
  const claimEvidence = profile?.claimEvidence
  const checks = [
    { key: 'summary', pass: listClaimEvidenceCoverage(claimEvidence?.summary) },
    { key: 'communicationStyle', pass: listClaimEvidenceCoverage(claimEvidence?.communicationStyle) },
    { key: 'motivationalProfile', pass: listClaimEvidenceCoverage(claimEvidence?.motivationalProfile) },
    { key: 'bigFive', pass: Object.values(claimEvidence?.bigFive || {}).filter((refs) => Array.isArray(refs) && refs.length > 0).length >= 4 },
    { key: 'mbti', pass: listClaimEvidenceCoverage(claimEvidence?.mbti) },
    { key: 'enneagram', pass: listClaimEvidenceCoverage(claimEvidence?.enneagram) },
    { key: 'strengths', pass: (claimEvidence?.strengths || []).length > 0 && (claimEvidence?.strengths || []).every((item) => item.evidenceRefs.length > 0) },
    { key: 'challenges', pass: (claimEvidence?.challenges || []).length > 0 && (claimEvidence?.challenges || []).every((item) => item.evidenceRefs.length > 0) },
    { key: 'triggers', pass: (claimEvidence?.triggers || []).length > 0 && (claimEvidence?.triggers || []).every((item) => item.evidenceRefs.length > 0) },
    { key: 'growthEdges', pass: (claimEvidence?.growthEdges || []).length > 0 && (claimEvidence?.growthEdges || []).every((item) => item.evidenceRefs.length > 0) },
  ]
  const claimGroupsWithEvidence = checks.filter((item) => item.pass).length
  const totalClaimGroups = checks.length
  const coveragePercent = totalClaimGroups > 0 ? Math.round((claimGroupsWithEvidence / totalClaimGroups) * 100) : 0

  return {
    claimGroupsWithEvidence,
    totalClaimGroups,
    coveragePercent,
    thresholdPercent: PROFILE_EVIDENCE_COVERAGE_MINIMUM,
    pass: coveragePercent >= PROFILE_EVIDENCE_COVERAGE_MINIMUM,
    blockedGroups: checks.filter((item) => !item.pass).map((item) => item.key),
  }
}

function extractClaimTexts(claims: ProfileClaimRef[] | undefined) {
  return (claims || []).map((claim) => claim.claim)
}

function normalizePsychologicalProfile(
  profile: PsychologicalProfile,
  params: {
    runId?: string
    source?: PsychologicalProfile['source']
    qualityStatus?: PsychologicalProfile['qualityStatus']
    profileVersion?: string
  } = {}
): PsychologicalProfile {
  const nextProfile: PsychologicalProfile = {
    ...profile,
    sourceRunId: profile.sourceRunId || params.runId || profile.runId,
    runId: profile.runId || params.runId,
    source: profile.source || params.source,
    qualityStatus: profile.qualityStatus || params.qualityStatus || 'legacy_unvalidated',
    profileVersion: profile.profileVersion || params.profileVersion,
    triggers: profile.triggers || [],
    growthEdges: profile.growthEdges || [],
  }

  return {
    ...nextProfile,
    claimEvidence: nextProfile.claimEvidence
      ? {
          ...nextProfile.claimEvidence,
          strengths: nextProfile.claimEvidence.strengths || [],
          challenges: nextProfile.claimEvidence.challenges || [],
          triggers: nextProfile.claimEvidence.triggers || [],
          growthEdges: nextProfile.claimEvidence.growthEdges || [],
        }
      : nextProfile.claimEvidence,
  }
}

function summarizeText(value: string, maxLength = 240) {
  const cleaned = value.replace(/\s+/g, ' ').trim()
  if (cleaned.length <= maxLength) return cleaned
  return `${cleaned.slice(0, maxLength - 1).trim()}…`
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

type EvidenceDensityLevel = 'thin' | 'moderate' | 'strong'

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

function baseMbtiTypeLabel(value: string) {
  return value.replace(/\s*\(provisional\)/gi, '').replace(/\?+$/g, '').trim()
}

function formatMbtiLabel(mbti: MBTIProfile, evidenceDensity: EvidenceDensityLevel) {
  const baseType = baseMbtiTypeLabel(mbti.type)
  if (evidenceDensity === 'strong') return baseType
  if (evidenceDensity === 'moderate') return `${baseType} (provisional)`
  return `${baseType}?`
}

function cleanProfileSummaryText(value: string) {
  return summarizeText(
    value
      .replace(/\(provisional\)\s*\(provisional\)/gi, '(provisional)')
      .replace(/\s+/g, ' ')
      .trim(),
    460
  )
}

function buildSummary(
  agent: AgentRecord,
  bigFive: BigFiveProfile,
  mbti: MBTIProfile,
  enneagram: EnneagramProfile,
  evidenceDensity: EvidenceDensityLevel
) {
  const style = bigFive.extraversion >= 0.68 ? 'socially energetic' : 'measured'
  const creativity = bigFive.openness >= 0.68 ? 'inventive' : 'practical'
  const discipline = bigFive.conscientiousness >= 0.62 ? 'prototype-driven discipline' : 'looser experimentation'
  const primaryGoal = agent.goals[0] || 'turn ideas into usable experiments'
  const baseSummary = `${agent.name} reads as a ${style}, ${creativity} builder who pushes ideas forward with ${discipline}. The strongest through-line is a bias toward practical usefulness, fast concept exploration, and emotionally aware directness while pursuing goals like "${primaryGoal}".`
  if (evidenceDensity === 'strong') {
    return `${baseSummary} The current evidence supports ${mbti.type} with Enneagram ${enneagram.primaryType}w${enneagram.wing}.`
  }
  if (evidenceDensity === 'moderate') {
    return `${baseSummary} The current evidence only supports a provisional typology read: ${formatMbtiLabel(mbti, evidenceDensity)} and a tentative Enneagram leaning toward ${enneagram.primaryType}.`
  }
  return `${baseSummary} The current evidence is too thin for a confident MBTI or Enneagram call, so the profile should be read primarily through the observable behavior patterns above.`
}

function buildRationales(
  stageFindings: ProfileStageFinding[],
  bigFive: BigFiveProfile,
  mbti: MBTIProfile,
  enneagram: EnneagramProfile,
  evidenceDensity: EvidenceDensityLevel
) {
  const summaries = stageFindings.map((finding) => finding.summary).join(' ')
  return {
    bigFive: `Recent interview answers and evolution signals point to openness ${Math.round(bigFive.openness * 100)}%, conscientiousness ${Math.round(bigFive.conscientiousness * 100)}%, extraversion ${Math.round(bigFive.extraversion * 100)}%, agreeableness ${Math.round(bigFive.agreeableness * 100)}%, and neuroticism ${Math.round(bigFive.neuroticism * 100)}%. ${summaries}`.trim(),
    mbti: evidenceDensity === 'strong'
      ? `${mbti.type} fits the combined pattern of outward energy, intuition, people-aware judgment, and structured follow-through shown across the interview stages.`
      : `${formatMbtiLabel(mbti, evidenceDensity)} is only a tentative shorthand for the current evidence pattern. It should not be treated as a firm type assignment.`,
    enneagram: evidenceDensity === 'strong'
      ? `Enneagram ${enneagram.primaryType}w${enneagram.wing} is the closest fit because the evidence repeatedly emphasizes boldness, protection of what matters, practical action, and momentum under pressure.`
      : 'The Enneagram reading is provisional because the current evidence packet is still thin and uneven across the key claim groups.',
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

function buildFallbackStageSummary(stageTitle: string, turns: ProfileInterviewTurn[]) {
  const highlights = turns
    .map((turn) => summarizeText(turn.answer, 160))
    .filter(Boolean)
    .slice(0, 2)

  if (highlights.length === 0) {
    return `${stageTitle} findings extracted from interview and evidence.`
  }

  return summarizeText(`${stageTitle}: ${highlights.join(' ')}`, 280)
}

function getDefaultClaimCategoriesForStage(stage: ProfileAnalysisStage): string[] {
  switch (stage) {
    case 'social_style':
      return ['communicationStyle', 'strengths']
    case 'decision_style':
      return ['motivationalProfile', 'bigFive', 'strengths']
    case 'stress_conflict':
      return ['triggers', 'challenges', 'communicationStyle']
    case 'motivation_identity':
      return ['motivationalProfile', 'growthEdges', 'enneagram']
    case 'communication_self_awareness':
      return ['communicationStyle', 'strengths', 'bigFive']
    default:
      return ['summary']
  }
}

function buildFallbackStageClaims(stage: ProfileAnalysisStage, turns: ProfileInterviewTurn[]) {
  const defaultCategories = getDefaultClaimCategoriesForStage(stage)
  return turns
    .filter((turn) => turn.answer.trim().length > 0)
    .slice(0, 2)
    .map((turn) => ({
      claim: summarizeText(turn.answer, 180),
      evidenceRefs: (turn.evidenceRefs || []).slice(0, 6),
      categories: defaultCategories,
    }))
    .filter((claim) => claim.claim.length > 0 && claim.evidenceRefs.length > 0)
}

function buildFallbackProfileClaimRefs(
  stageFindings: ProfileStageFinding[],
  category: string,
  fallbackClaims: string[],
  fallbackRefs: string[]
): ProfileClaimRef[] {
  const fromStageClaims = stageFindings
    .flatMap((finding) => (finding.claims || [])
      .filter((claim) => claim.categories.includes(category))
      .map((claim) => ({
        claim: summarizeText(claim.claim, 220),
        evidenceRefs: claim.evidenceRefs.slice(0, 6),
      })))
    .filter((claim) => claim.evidenceRefs.length > 0 && !isInterviewExcerptClaim(claim.claim))

  if (fromStageClaims.length > 0) {
    return fromStageClaims.slice(0, 4)
  }

  return fallbackClaims
    .filter(Boolean)
    .slice(0, 4)
    .map((claim) => ({
      claim,
      evidenceRefs: fallbackRefs.slice(0, 6),
    }))
}

function isInterviewExcerptClaim(value: string) {
  const trimmed = value.trim()
  return /^(when (?:someone|i)|i (?:try|tend|often|usually|aim|strive|want|need|find|am|would)|in my work|how would|what tends|what communication habits)/i.test(trimmed)
    || trimmed.includes('?')
}

function shouldUseFallbackClaimRefs(claims: ProfileClaimRef[], minimumCount = 2) {
  if (claims.length < minimumCount) {
    return true
  }

  const excerptLikeClaims = claims.filter((claim) => isInterviewExcerptClaim(claim.claim)).length
  return excerptLikeClaims >= Math.ceil(claims.length / 2)
}

function polishProfileClaimGroups(
  profile: PsychologicalProfile,
  agent: AgentRecord,
  stageFindings: ProfileStageFinding[],
  evidenceSignals: ProfileEvidenceSignal[]
): PsychologicalProfile {
  const fallbackClaimRefs = Array.from(new Set(stageFindings.flatMap((finding) => finding.evidenceRefs || []))).slice(0, 6)
  const resolvedFallbackRefs = fallbackClaimRefs.length > 0
    ? fallbackClaimRefs
    : evidenceSignals.slice(0, 6).map((signal) => signal.id)
  const derivedStrengthsAndChallenges = buildStrengthsAndChallenges(agent, profile.bigFive)
  const nextClaimEvidence: ProfileClaimEvidenceMap = {
    summary: profile.claimEvidence?.summary || resolvedFallbackRefs,
    communicationStyle: profile.claimEvidence?.communicationStyle || resolvedFallbackRefs,
    motivationalProfile: profile.claimEvidence?.motivationalProfile || resolvedFallbackRefs,
    bigFive: profile.claimEvidence?.bigFive || {
      openness: resolvedFallbackRefs,
      conscientiousness: resolvedFallbackRefs,
      extraversion: resolvedFallbackRefs,
      agreeableness: resolvedFallbackRefs,
      neuroticism: resolvedFallbackRefs,
    },
    mbti: profile.claimEvidence?.mbti || resolvedFallbackRefs,
    enneagram: profile.claimEvidence?.enneagram || resolvedFallbackRefs,
    strengths: profile.claimEvidence?.strengths || [],
    challenges: profile.claimEvidence?.challenges || [],
    triggers: profile.claimEvidence?.triggers || [],
    growthEdges: profile.claimEvidence?.growthEdges || [],
  }

  if (shouldUseFallbackClaimRefs(nextClaimEvidence.strengths, 2)) {
    nextClaimEvidence.strengths = buildFallbackProfileClaimRefs(
      stageFindings,
      'strengths',
      derivedStrengthsAndChallenges.strengths,
      resolvedFallbackRefs
    )
  }

  if (shouldUseFallbackClaimRefs(nextClaimEvidence.challenges, 2)) {
    nextClaimEvidence.challenges = buildFallbackProfileClaimRefs(
      stageFindings,
      'challenges',
      derivedStrengthsAndChallenges.challenges,
      resolvedFallbackRefs
    )
  }

  if (shouldUseFallbackClaimRefs(nextClaimEvidence.triggers, 2)) {
    nextClaimEvidence.triggers = buildFallbackProfileClaimRefs(
      stageFindings,
      'triggers',
      buildDerivedTriggerClaims(agent),
      resolvedFallbackRefs
    )
  }

  if (shouldUseFallbackClaimRefs(nextClaimEvidence.growthEdges, 2)) {
    nextClaimEvidence.growthEdges = buildFallbackProfileClaimRefs(
      stageFindings,
      'growthEdges',
      buildDerivedGrowthEdges(),
      resolvedFallbackRefs
    )
  }

  return {
    ...profile,
    summary: cleanProfileSummaryText(profile.summary),
    strengths: extractClaimTexts(nextClaimEvidence.strengths),
    challenges: extractClaimTexts(nextClaimEvidence.challenges),
    triggers: extractClaimTexts(nextClaimEvidence.triggers),
    growthEdges: extractClaimTexts(nextClaimEvidence.growthEdges),
    claimEvidence: nextClaimEvidence,
  }
}

function buildDerivedTriggerClaims(agent: AgentRecord): string[] {
  const primaryGoal = agent.goals[0] || 'useful progress'
  return [
    'Vagueness and surface-level advice create friction quickly.',
    'Pressure rises when practical progress stalls and the real issue stays unnamed.',
    `Momentum drops when the work stops feeling connected to ${primaryGoal.toLowerCase()}.`,
  ]
}

function buildDerivedGrowthEdges(): string[] {
  return [
    'Name the real avoidance pattern earlier instead of circling it with explanation.',
    'Preserve directness under pressure without defaulting to generic coaching.',
    'Turn reflection into one visible next move faster.',
  ]
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

function clampSigned(value: number) {
  return Math.max(-1, Math.min(1, value))
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
    ...createPendingTrackedFields({
      promptVersion: PROFILE_PROMPT_VERSION,
    }),
    profileVersion: PROFILE_VERSION,
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
    hardFailureFlags: ['profile_evaluation_unavailable'],
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

    const latestCompletedRun = recentRuns.find((run) => run.status === 'ready' && run.qualityStatus === 'passed') || null
    const activeProfile = agent.psychologicalProfile
      ? normalizePsychologicalProfile(agent.psychologicalProfile, {
          runId: agent.psychologicalProfile.runId,
          source: agent.psychologicalProfile.source,
          qualityStatus: agent.psychologicalProfile.qualityStatus || 'legacy_unvalidated',
          profileVersion: agent.psychologicalProfile.profileVersion,
        })
      : null
    const stale = Boolean(
      activeProfile?.updatedAt &&
      lastEvent?.createdAt &&
      new Date(lastEvent.createdAt).getTime() > new Date(activeProfile.updatedAt).getTime()
    )

    return {
      profile: activeProfile,
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
      qualityStatus: 'pending',
      latestStage: 'evidence',
      provider: resolvedProvider.provider,
      model: resolvedProvider.model,
      promptVersion: PROFILE_PROMPT_VERSION,
      profileVersion: PROFILE_VERSION,
      repairCount: 0,
      updatedAt: new Date().toISOString(),
      failureReason: undefined,
    }
    run = await this.saveRun(run)

    const pipelineEvents: ProfilePipelineEvent[] = []
    const interviewTurns: ProfileInterviewTurn[] = []

    try {
      const evidenceSignals = await this.buildEvidenceSignals(agent)
      const sourceRefs = toSourceRefs(evidenceSignals)
      run = await this.saveRun({
        ...run,
        sourceCount: evidenceSignals.length,
        evidenceSignals,
        sourceRefs,
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
      const questionLimit = getInterviewQuestionLimit(resolvedProvider)

      for (const stageConfig of INTERVIEW_STAGES) {
        run = await this.saveRun({
          ...run,
          latestStage: stageConfig.stage,
          updatedAt: new Date().toISOString(),
        })

        const stageTurns: ProfileInterviewTurn[] = []
        for (const question of stageConfig.questions.slice(0, questionLimit)) {
          const answer = await this.askAgentInterviewQuestion(agent, question, interviewHistory, evidenceSignals, resolvedProvider)
          const turn: ProfileInterviewTurn = {
            id: generateId('profile_turn'),
            runId: run.id,
            stage: stageConfig.stage,
            order: turnOrder++,
            question,
            answer,
            createdAt: new Date().toISOString(),
            promptVersion: PROFILE_PROMPT_VERSION,
            provider: resolvedProvider.provider,
            model: resolvedProvider.model,
            evidenceRefs: this.selectEvidenceRefsForQuestion(question, evidenceSignals),
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
          {
            turnCount: stageTurns.length,
            summary: finding.summary,
            evidenceRefs: finding.evidenceRefs,
            claimCount: finding.claims?.length || 0,
          }
        )))
      }

      run = await this.saveRun({
        ...run,
        latestStage: 'synthesis',
        updatedAt: new Date().toISOString(),
      })

      const synthesisResult = await this.synthesizeProfile(agent, evidenceSignals, stageFindings, interviewTurns, resolvedProvider)
      let profile = synthesisResult.profile
      let validation = this.validateProfileRun({
        profile,
        stageFindings,
        interviewTurns,
        sourceRefs,
      })
      let evaluation = validation.pass
        ? await this.evaluateProfile(agent, profile, evidenceSignals, stageFindings, resolvedProvider)
        : this.createBlockedEvaluation(validation)
      let evidenceCoverage = computeEvidenceCoverage(profile)

      run = await this.saveRun({
        ...run,
        rawModelOutput: synthesisResult.rawModelOutput,
        validation,
        evidenceCoverage,
        qualityStatus: validation.pass ? 'pending' : 'failed',
        latestProfile: profile,
        latestEvaluation: evaluation,
        updatedAt: new Date().toISOString(),
      })
      pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
        run.id,
        'synthesis',
        validation.pass ? 'completed' : 'failed',
        validation.pass
          ? 'Synthesized an evidence-led profile candidate.'
          : 'Synthesis produced a profile candidate, but validation blocked it.',
        {
          validation,
          evidenceCoverage,
        }
      )))
      pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
        run.id,
        'evaluation',
        'completed',
        `Profile evaluation scored ${evaluation.overallScore}.`,
        { evaluation, validation, evidenceCoverage }
      )))

      if ((!validation.pass || !evaluation.pass) && !this.shouldSkipRepair(evidenceCoverage, validation, evidenceSignals, stageFindings)) {
        run = await this.saveRun({
          ...run,
          latestStage: 'repair',
          repairCount: 1,
          updatedAt: new Date().toISOString(),
        })
        const repairedResult = await this.repairProfile(agent, profile, evaluation, stageFindings, evidenceSignals, resolvedProvider)
        profile = repairedResult.profile
        validation = this.validateProfileRun({
          profile,
          stageFindings,
          interviewTurns,
          sourceRefs,
        })
        evaluation = validation.pass
          ? await this.evaluateProfile(agent, profile, evidenceSignals, stageFindings, resolvedProvider)
          : this.createBlockedEvaluation(validation)
        evidenceCoverage = computeEvidenceCoverage(profile)
        pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
          run.id,
          'repair',
          validation.pass && evaluation.pass ? 'completed' : 'failed',
          `Ran one bounded repair pass. New overall score: ${evaluation.overallScore}.`,
          {
            evaluation,
            validation,
            evidenceCoverage,
          }
        )))
        run = await this.saveRun({
          ...run,
          rawModelOutput: repairedResult.rawModelOutput,
          validation,
          latestProfile: profile,
          latestEvaluation: evaluation,
          evidenceCoverage,
          qualityStatus: validation.pass && evaluation.pass ? 'pending' : 'failed',
          updatedAt: new Date().toISOString(),
        })
      } else if (!validation.pass || !evaluation.pass) {
        pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
          run.id,
          'repair',
          'skipped',
          'Skipped repair because the failure is dominated by thin or missing evidence rather than repairable wording issues.',
          {
            validation,
            evaluation,
            evidenceCoverage,
          }
        )))
      }

      const completedAt = new Date().toISOString()
      const gate = applyFinalQualityGate({
        validation,
        evaluation,
        thresholds: {
          overallScoreMinimum: PROFILE_OVERALL_SCORE_MINIMUM,
          dimensionFloor: PROFILE_DIMENSION_FLOOR,
        },
        extraHardFailureFlags: evidenceCoverage.pass ? [] : ['profile_evidence_coverage_below_threshold'],
      })
      profile = {
        ...normalizePsychologicalProfile(profile, {
          runId: run.id,
          source: 'analysis_run',
          qualityStatus: gate.qualityStatus,
          profileVersion: PROFILE_VERSION,
        }),
        source: 'analysis_run',
        runId: run.id,
        sourceRunId: run.id,
        provider: resolvedProvider.provider,
        model: resolvedProvider.model,
        qualityStatus: gate.qualityStatus,
        profileVersion: PROFILE_VERSION,
        createdAt: profile.createdAt || completedAt,
        updatedAt: completedAt,
      }

      const finalRunStatus: ProfileAnalysisRun['status'] = gate.pass ? 'ready' : 'failed'
      const failureReason = gate.pass
        ? undefined
        : `Profile run blocked: ${gate.blockerReasons.join(', ')}${evidenceCoverage.blockedGroups.length ? `; missing evidence on ${evidenceCoverage.blockedGroups.join(', ')}` : ''}`

      run = await this.saveRun({
        ...run,
        status: finalRunStatus,
        qualityStatus: gate.qualityStatus,
        qualityScore: evaluation.overallScore,
        latestStage: gate.pass ? 'completed' : run.latestStage,
        latestProfile: profile,
        latestEvaluation: evaluation,
        evidenceCoverage,
        transcriptCount: interviewTurns.length,
        completedAt,
        updatedAt: completedAt,
        failureReason,
      })

      if (gate.pass) {
        await AgentService.updateAgent(agent.id, {
          psychologicalProfile: profile,
        })
      }

      pipelineEvents.push(await this.savePipelineEvent(agentId, makePipelineEvent(
        run.id,
        'completed',
        gate.pass ? 'completed' : 'skipped',
        gate.pass
          ? 'Profile analysis run completed and the active psychological profile was updated.'
          : 'Profile analysis run finished, but live profile update was blocked by validation or evaluation.',
        {
          profileId: profile.id,
          gate,
          evidenceCoverage,
          validation,
          evaluation,
        }
      )))

      if (!gate.pass) {
        await LearningService.recordQualityObservation({
          agentId,
          feature: 'profile',
          description: `Profile analysis run ${run.id} was blocked by validation or evaluation.`,
          blockerReasons: [
            ...gate.blockerReasons,
            ...evidenceCoverage.blockedGroups.map((group) => `missing_evidence_${group}`),
          ],
          evidenceRefs: [run.id],
          outputExcerpt: profile.summary,
          qualityScore: evaluation.overallScore,
          category: 'problem_solving',
          candidateAdaptations: [
            'Anchor profile claims more tightly to collected evidence refs.',
          ],
        })
      }

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
    const [messages, memories, journalEntries, personalityEvents, communicationFingerprint] = await Promise.all([
      MessageService.getMessagesByAgentId(agent.id),
      MemoryService.getRecentMemories(agent.id, 24),
      readsFromPostgres(getPersistenceMode())
        ? FeatureContentRepository.listJournalEntries(agent.id, { limit: 3 })
        : Promise.resolve([]),
      PersonalityEventService.listByAgent(agent.id, 12),
      CommunicationFingerprintService.buildSnapshot(agent),
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

    if (communicationFingerprint) {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'linguistic_baseline',
        label: 'Observed communication fingerprint',
        snippet: summarizeText(communicationFingerprint.summary, 200),
        reason: 'Observed voice behavior gathered from recent agent replies.',
        weight: communicationFingerprint.enoughData ? 0.92 : 0.72,
      })
    }

    for (const memory of memories
      .filter((memory) => memory.importance >= 6 || ['identity', 'preference', 'relationship', 'project', 'tension_snapshot', 'artifact_summary', 'fact'].includes(memory.type))
      .slice(0, 10)) {
      evidence.push({
        id: generateId('profile_signal'),
        sourceType: 'memory',
        label: `Memory: ${memory.type}`,
        snippet: summarizeText(memory.canonicalValue || `${memory.summary} Context: ${memory.context}`, 180),
        reason: memory.evidenceRefs?.length
          ? 'Canonical semantic memory with retained evidence links.'
          : 'Important retained context and continuity.',
        weight: ['identity', 'relationship', 'preference', 'project', 'tension_snapshot'].includes(memory.type) ? 0.92 : 0.75,
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

  private selectEvidenceRefsForQuestion(question: string, evidenceSignals: ProfileEvidenceSignal[], limit = 6): string[] {
    const loweredQuestion = question.toLowerCase()
    const ranked = [...evidenceSignals].sort((left, right) => {
      const leftText = `${left.label} ${left.snippet} ${left.reason}`.toLowerCase()
      const rightText = `${right.label} ${right.snippet} ${right.reason}`.toLowerCase()
      const leftScore = left.weight + keywordWeight(leftText, loweredQuestion.split(/\W+/).filter(Boolean)) * 0.15
      const rightScore = right.weight + keywordWeight(rightText, loweredQuestion.split(/\W+/).filter(Boolean)) * 0.15
      return rightScore - leftScore
    })

    return ranked.slice(0, limit).map((signal) => signal.id)
  }

  private async askAgentInterviewQuestion(
    agent: AgentRecord,
    question: string,
    interviewHistory: Array<{ role: 'user' | 'assistant'; content: string }>,
    evidenceSignals: ProfileEvidenceSignal[],
    providerInfo: LLMProviderInfo
  ): Promise<string> {
    const emotionalState = agent.emotionalState
      ? `Dominant emotion: ${agent.emotionalState.dominantEmotion || 'none'}, level: ${agent.emotionalState.dominantEmotion ? agent.emotionalState.currentMood[agent.emotionalState.dominantEmotion] ?? 0 : 0}, status: ${agent.emotionalState.status}.`
      : 'No explicit emotional state is available.'
    const historyBlock = interviewHistory
      .slice(-4)
      .map((entry) => `${entry.role === 'user' ? 'Interviewer' : agent.name}: ${entry.content}`)
      .join('\n')
    const evidenceRefs = this.selectEvidenceRefsForQuestion(question, evidenceSignals)
    const evidencePacket = evidenceSignals
      .filter((signal) => evidenceRefs.includes(signal.id))
      .map((signal) => `- ${signal.id} | ${signal.label} | ${signal.snippet}`)
      .join('\n')

    const result = await generateText({
      providerInfo,
      temperature: 0.45,
      maxTokens: 140,
      timeoutMs: 20000,
      messages: [
        {
          role: 'system',
          content: `You are ${agent.name}. Answer a short psychological interview in first person. Stay grounded in this identity:\nPersona: ${summarizeText(agent.persona, 320)}\nGoals: ${agent.goals.slice(0, 4).join(' | ') || 'none'}\n${emotionalState}\nUse the evidence packet directly. Refer to concrete habits, pressures, values, and remembered context instead of generic personality language. Do not narrate system details or mention being an AI unless the question directly requires it.`,
        },
        {
          role: 'user',
          content: `${historyBlock ? `Recent interview context:\n${historyBlock}\n\n` : ''}Evidence packet:\n${evidencePacket}\n\nQuestion: ${question}\n\nAnswer in 2-4 sentences. Use the evidence packet; do not invent unsupported details.`,
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
    const evidenceBlock = evidenceSignals
      .slice(0, 12)
      .map((signal) => `- ${signal.id} | ${signal.label} | ${signal.snippet}`)
      .join('\n')
    const transcriptBlock = turns
      .map((turn, index) => `Q${index + 1}: ${turn.question}\nA${index + 1}: ${turn.answer}`)
      .join('\n\n')
    const knownRefs = new Set(evidenceSignals.map((signal) => signal.id))

    const prompt = `You are extracting structured psychological evidence from one interview stage.\nReturn strict JSON only.\n\nStage: ${stageTitle}\n\nEvidence:\n${evidenceBlock}\n\nTranscript:\n${transcriptBlock}\n\nReturn JSON with keys:\nsummary, evidenceRefs, claims, bigFiveSignals, mbtiHints, enneagramHints, communicationHints, contradictions, confidenceNotes.\nRules:\n- evidenceRefs must be an array of evidence ids used by the summary.\n- claims must be an array of objects with keys claim, evidenceRefs, categories.\n- categories must use only: summary, communicationStyle, motivationalProfile, strengths, challenges, triggers, growthEdges, bigFive, mbti, enneagram.\n- bigFiveSignals must be an object with optional arrays for openness, conscientiousness, extraversion, agreeableness, neuroticism.\n- Keep all arrays concise.\n- Do not include markdown or unsupported evidence ids.`

    const result = await generateText({
      providerInfo,
      temperature: 0.2,
      maxTokens: 380,
      timeoutMs: 25000,
      messages: [
        { role: 'system', content: 'Extract structured evidence conservatively. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    })

    const parsed = safeJsonParse<Record<string, unknown>>(result.content)
    const fallbackRefs = turns.flatMap((turn) => turn.evidenceRefs || []).slice(0, 6)
    const fallbackClaims = buildFallbackStageClaims(stage, turns)
    const normalizedClaims = Array.isArray(parsed?.claims)
      ? parsed.claims
        .map((entry) => {
          if (!entry || typeof entry !== 'object') return null
          const record = entry as Record<string, unknown>
          const claim = typeof record.claim === 'string' ? summarizeText(record.claim, 220) : ''
          const evidenceRefs = normalizeEvidenceRefList(record.evidenceRefs, knownRefs, fallbackRefs)
          const categories = Array.isArray(record.categories)
            ? record.categories.filter((category): category is string => typeof category === 'string')
            : []
          if (!claim || evidenceRefs.length === 0) return null
          return { claim, evidenceRefs, categories }
        })
        .filter((entry): entry is NonNullable<ProfileStageFinding['claims']>[number] => Boolean(entry))
      : []
    return {
      stage,
      summary: typeof parsed?.summary === 'string' && parsed.summary.trim().length > 0
        ? summarizeText(parsed.summary, 280)
        : buildFallbackStageSummary(stageTitle, turns),
      evidenceRefs: normalizeEvidenceRefList(parsed?.evidenceRefs, knownRefs, fallbackRefs),
      claims: normalizedClaims.length > 0 ? normalizedClaims : fallbackClaims,
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
  ): Promise<{
    profile: PsychologicalProfile
    rawModelOutput: OutputQualityRawModelOutput
  }> {
    const scaffold = psychologicalProfileService.generateProfile(agent)
    const knownRefs = new Set(evidenceSignals.map((signal) => signal.id))
    const evidenceDensity = this.computeEvidenceDensity(evidenceSignals, stageFindings)
    const compactStageFindings = buildCompactStageFindingsBlock(stageFindings)
    const compactInterviewTurns = buildCompactInterviewBlock(interviewTurns, isLocalBaselineProvider(providerInfo) ? 5 : 8)
    const compactEvidenceBlock = buildCompactEvidenceBlock(evidenceSignals, isLocalBaselineProvider(providerInfo) ? 10 : 12)
    const prompt = `You are synthesizing a production-ready psychological profile for an inspectable AI agent.\nReturn strict JSON only.\n\nAgent name: ${agent.name}\nPersona: ${summarizeText(agent.persona, 280)}\nGoals: ${(agent.goals || []).slice(0, 4).join(' | ') || 'none'}\n\nEvidence density: ${evidenceDensity.level} (${evidenceDensity.totalSignals} signals, ${evidenceDensity.stageClaimCount} stage claims)\n\nUse this deterministic scaffold only as a shape fallback, not as your narrative source of truth:\n${JSON.stringify({
      bigFive: scaffold.bigFive,
      mbti: scaffold.mbti,
      enneagram: scaffold.enneagram,
      communicationStyle: scaffold.communicationStyle,
      attachmentStyle: scaffold.attachmentStyle,
      cognitiveStyle: scaffold.cognitiveStyle,
      motivationalProfile: scaffold.motivationalProfile,
    }, null, 2)}\n\nStage findings:\n${compactStageFindings}\n\nRecent interview transcript:\n${compactInterviewTurns}\n\nEvidence sample:\n${compactEvidenceBlock}\n\nReturn JSON with keys:\n- bigFive\n- mbti\n- enneagram\n- communicationStyle\n- attachmentStyle\n- cognitiveStyle\n- emotionalIntelligence\n- motivationalProfile\n- summary\n- strengths\n- challenges\n- triggers\n- growthEdges\n- confidence\n- rationales\n- claimEvidence\n\nclaimEvidence must contain:\n- summary: evidence ids\n- communicationStyle: evidence ids\n- motivationalProfile: evidence ids\n- bigFive: object of trait -> evidence ids\n- mbti: evidence ids\n- enneagram: evidence ids\n- strengths: array of { claim, evidenceRefs }\n- challenges: array of { claim, evidenceRefs }\n- triggers: array of { claim, evidenceRefs }\n- growthEdges: array of { claim, evidenceRefs }\n\nRules:\n- Every top-level claim group must cite evidence ids that exist in the evidence sample or stage findings.\n- Keep the language evidence-led and specific. Avoid generic descriptor stacks.\n- strengths, challenges, triggers, and growthEdges must each have 2-4 items.\n- strengths, challenges, triggers, and growthEdges must be short third-person claim summaries, not copied first-person interview answers.\n- rationales must include bigFive, mbti, enneagram, communicationStyle, stressPattern, motivationAndGrowth.\n- Confidence must be 0-1.\n- IMPORTANT: If evidence density is low or thin, do NOT make strong typology claims. Use tentative language like "leans toward" or "provisional" for MBTI and Enneagram. Only present them as firm when evidence coverage is strong.\n- Do NOT assert a specific MBTI type or Enneagram type with high confidence unless 3+ distinct evidence signals support it.\n- Summaries should describe observable patterns, not typology category membership.`

    const result = await generateText({
      providerInfo,
      temperature: 0.3,
      maxTokens: isLocalBaselineProvider(providerInfo) ? 900 : 1200,
      timeoutMs: isLocalBaselineProvider(providerInfo) ? 45000 : 35000,
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

    const derivedMbti = deriveMbti(bigFive, scaffold.mbti)
    const mbti = {
      ...derivedMbti,
      type: formatMbtiLabel(derivedMbti, evidenceDensity.level),
    }
    const enneagram = deriveEnneagram(agent, scaffold.enneagram, stageFindings)
    const derivedStrengthsAndChallenges = buildStrengthsAndChallenges(agent, bigFive)
    const rationales = {
      ...buildRationales(stageFindings, bigFive, mbti, enneagram, evidenceDensity.level),
      ...(typeof parsed?.rationales === 'object' && parsed.rationales ? parsed.rationales as Record<string, string> : {}),
    }
    const claimEvidenceInput = parsed?.claimEvidence && typeof parsed.claimEvidence === 'object'
      ? parsed.claimEvidence as Record<string, unknown>
      : {}
    const fallbackStageRefs = Array.from(new Set(stageFindings.flatMap((finding) => finding.evidenceRefs || []))).slice(0, 6)
    const claimEvidence: ProfileClaimEvidenceMap = {
      summary: normalizeEvidenceRefList(claimEvidenceInput.summary, knownRefs, fallbackStageRefs),
      communicationStyle: normalizeEvidenceRefList(claimEvidenceInput.communicationStyle, knownRefs, fallbackStageRefs),
      motivationalProfile: normalizeEvidenceRefList(claimEvidenceInput.motivationalProfile, knownRefs, fallbackStageRefs),
      bigFive: {
        openness: normalizeEvidenceRefList((claimEvidenceInput.bigFive as Record<string, unknown> | undefined)?.openness, knownRefs, fallbackStageRefs),
        conscientiousness: normalizeEvidenceRefList((claimEvidenceInput.bigFive as Record<string, unknown> | undefined)?.conscientiousness, knownRefs, fallbackStageRefs),
        extraversion: normalizeEvidenceRefList((claimEvidenceInput.bigFive as Record<string, unknown> | undefined)?.extraversion, knownRefs, fallbackStageRefs),
        agreeableness: normalizeEvidenceRefList((claimEvidenceInput.bigFive as Record<string, unknown> | undefined)?.agreeableness, knownRefs, fallbackStageRefs),
        neuroticism: normalizeEvidenceRefList((claimEvidenceInput.bigFive as Record<string, unknown> | undefined)?.neuroticism, knownRefs, fallbackStageRefs),
      },
      mbti: normalizeEvidenceRefList(claimEvidenceInput.mbti, knownRefs, fallbackStageRefs),
      enneagram: normalizeEvidenceRefList(claimEvidenceInput.enneagram, knownRefs, fallbackStageRefs),
      strengths: normalizeProfileClaimRefs(claimEvidenceInput.strengths, knownRefs, fallbackStageRefs),
      challenges: normalizeProfileClaimRefs(claimEvidenceInput.challenges, knownRefs, fallbackStageRefs),
      triggers: normalizeProfileClaimRefs(claimEvidenceInput.triggers, knownRefs, fallbackStageRefs),
      growthEdges: normalizeProfileClaimRefs(claimEvidenceInput.growthEdges, knownRefs, fallbackStageRefs),
    }
    const fallbackClaimRefs = fallbackStageRefs.length > 0
      ? fallbackStageRefs
      : evidenceSignals.slice(0, 6).map((signal) => signal.id)
    const fallbackStrengthRefs = buildFallbackProfileClaimRefs(
      stageFindings,
      'strengths',
      derivedStrengthsAndChallenges.strengths,
      fallbackClaimRefs
    )
    const fallbackChallengeRefs = buildFallbackProfileClaimRefs(
      stageFindings,
      'challenges',
      derivedStrengthsAndChallenges.challenges,
      fallbackClaimRefs
    )
    const fallbackTriggerRefs = buildFallbackProfileClaimRefs(
      stageFindings,
      'triggers',
      buildDerivedTriggerClaims(agent),
      fallbackClaimRefs
    )
    const fallbackGrowthEdgeRefs = buildFallbackProfileClaimRefs(
      stageFindings,
      'growthEdges',
      buildDerivedGrowthEdges(),
      fallbackClaimRefs
    )

    if (claimEvidence.strengths.length === 0 || shouldUseFallbackClaimRefs(claimEvidence.strengths, 2)) {
      claimEvidence.strengths = fallbackStrengthRefs
    }
    if (claimEvidence.challenges.length === 0 || shouldUseFallbackClaimRefs(claimEvidence.challenges, 2)) {
      claimEvidence.challenges = fallbackChallengeRefs
    }
    if (claimEvidence.triggers.length === 0 || shouldUseFallbackClaimRefs(claimEvidence.triggers, 2)) {
      claimEvidence.triggers = fallbackTriggerRefs
    }
    if (claimEvidence.growthEdges.length === 0 || shouldUseFallbackClaimRefs(claimEvidence.growthEdges, 2)) {
      claimEvidence.growthEdges = fallbackGrowthEdgeRefs
    }
    const strengths = extractClaimTexts(claimEvidence.strengths)
    const challenges = extractClaimTexts(claimEvidence.challenges)
    const triggers = extractClaimTexts(claimEvidence.triggers)
    const growthEdges = extractClaimTexts(claimEvidence.growthEdges)
    const modelSummary = typeof parsed?.summary === 'string' ? cleanProfileSummaryText(parsed.summary) : ''
    const summary = cleanProfileSummaryText(
      evidenceDensity.level === 'strong'
        ? (modelSummary || buildSummary(agent, bigFive, mbti, enneagram, evidenceDensity.level))
        : buildSummary(agent, bigFive, mbti, enneagram, evidenceDensity.level)
    )

    return {
      profile: normalizePsychologicalProfile(polishProfileClaimGroups({
        ...scaffold,
      bigFive,
      mbti,
      enneagram,
      communicationStyle: typeof parsed?.communicationStyle === 'object' && parsed.communicationStyle
        ? {
            directness: clamp(typeof (parsed.communicationStyle as Record<string, unknown>).directness === 'number' ? (parsed.communicationStyle as Record<string, number>).directness : scaffold.communicationStyle.directness),
            emotionalExpression: clamp(typeof (parsed.communicationStyle as Record<string, unknown>).emotionalExpression === 'number' ? (parsed.communicationStyle as Record<string, number>).emotionalExpression : scaffold.communicationStyle.emotionalExpression),
            conflictStyle: ['avoiding', 'accommodating', 'competing', 'collaborating', 'compromising'].includes(String((parsed.communicationStyle as Record<string, unknown>).conflictStyle))
              ? (parsed.communicationStyle as Record<string, PsychologicalProfile['communicationStyle']['conflictStyle']>).conflictStyle
              : scaffold.communicationStyle.conflictStyle,
          }
        : scaffold.communicationStyle,
      attachmentStyle: ['secure', 'anxious', 'avoidant', 'disorganized'].includes(String(parsed?.attachmentStyle))
        ? parsed?.attachmentStyle as PsychologicalProfile['attachmentStyle']
        : scaffold.attachmentStyle,
      cognitiveStyle: typeof parsed?.cognitiveStyle === 'object' && parsed.cognitiveStyle
        ? {
            analyticalVsIntuitive: clampSigned(typeof (parsed.cognitiveStyle as Record<string, unknown>).analyticalVsIntuitive === 'number' ? (parsed.cognitiveStyle as Record<string, number>).analyticalVsIntuitive : scaffold.cognitiveStyle.analyticalVsIntuitive),
            abstractVsConcrete: clampSigned(typeof (parsed.cognitiveStyle as Record<string, unknown>).abstractVsConcrete === 'number' ? (parsed.cognitiveStyle as Record<string, number>).abstractVsConcrete : scaffold.cognitiveStyle.abstractVsConcrete),
            sequentialVsGlobal: clampSigned(typeof (parsed.cognitiveStyle as Record<string, unknown>).sequentialVsGlobal === 'number' ? (parsed.cognitiveStyle as Record<string, number>).sequentialVsGlobal : scaffold.cognitiveStyle.sequentialVsGlobal),
            reflectiveVsImpulsive: clampSigned(typeof (parsed.cognitiveStyle as Record<string, unknown>).reflectiveVsImpulsive === 'number' ? (parsed.cognitiveStyle as Record<string, number>).reflectiveVsImpulsive : scaffold.cognitiveStyle.reflectiveVsImpulsive),
          }
        : scaffold.cognitiveStyle,
      emotionalIntelligence: clamp(typeof parsed?.emotionalIntelligence === 'number' ? parsed.emotionalIntelligence : scaffold.emotionalIntelligence),
      motivationalProfile: typeof parsed?.motivationalProfile === 'object' && parsed.motivationalProfile
        ? {
            primaryMotivations: ensureArray((parsed.motivationalProfile as Record<string, unknown>).primaryMotivations).slice(0, 4),
            fears: ensureArray((parsed.motivationalProfile as Record<string, unknown>).fears).slice(0, 4),
            desires: ensureArray((parsed.motivationalProfile as Record<string, unknown>).desires).slice(0, 4),
            coreValues: ensureArray((parsed.motivationalProfile as Record<string, unknown>).coreValues).slice(0, 5),
            growthAreas: ensureArray((parsed.motivationalProfile as Record<string, unknown>).growthAreas).slice(0, 4),
          }
        : scaffold.motivationalProfile,
      summary,
      strengths: strengths.length > 0 ? strengths : derivedStrengthsAndChallenges.strengths,
      challenges: challenges.length > 0 ? challenges : derivedStrengthsAndChallenges.challenges,
      triggers,
      growthEdges,
      confidence: this.computeProfileConfidence(parsed, evidenceDensity),
      rationales,
      claimEvidence,
      source: 'analysis_run',
      qualityStatus: 'pending',
      profileVersion: PROFILE_VERSION,
    }, agent, stageFindings, evidenceSignals), {
      source: 'analysis_run',
      qualityStatus: 'pending',
      profileVersion: PROFILE_VERSION,
    }),
      rawModelOutput: createRawModelOutput(result.content),
    }
  }

  private async evaluateProfile(
    agent: AgentRecord,
    profile: PsychologicalProfile,
    evidenceSignals: ProfileEvidenceSignal[],
    stageFindings: ProfileStageFinding[],
    providerInfo: LLMProviderInfo
  ): Promise<ProfileQualityEvaluation> {
    const evidenceCoverage = computeEvidenceCoverage(profile)
    const prompt = `Evaluate this psychological profile for an inspectable AI agent. Return strict JSON only.\n\nAgent: ${agent.name}\nProfile:\n${JSON.stringify(profile, null, 2)}\n\nStage findings:\n${buildCompactStageFindingsBlock(stageFindings)}\n\nEvidence sample:\n${buildCompactEvidenceBlock(evidenceSignals, 10)}\n\nEvidence coverage summary:\n${JSON.stringify(evidenceCoverage, null, 2)}\n\nReturn JSON with keys: overallScore, pass, dimensions, strengths, weaknesses, repairInstructions, evaluatorSummary, hardFailureFlags.\nDimensions must include evidenceGrounding, consistency, distinctiveness, communicationUsefulness, rationaleCompleteness, each with score and rationale.\nSet pass true only if overallScore >= ${PROFILE_OVERALL_SCORE_MINIMUM}, every dimension >= ${PROFILE_DIMENSION_FLOOR}, evidence coverage >= ${PROFILE_EVIDENCE_COVERAGE_MINIMUM} percent, and there are no hard failure flags.`

    try {
    const result = await generateText({
      providerInfo,
      temperature: 0.15,
      maxTokens: 480,
      timeoutMs: 22000,
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
        hardFailureFlags: ensureArray(parsed.hardFailureFlags),
      }

      normalized.pass = (
        normalized.overallScore >= PROFILE_OVERALL_SCORE_MINIMUM &&
        normalized.dimensions.evidenceGrounding.score >= QUALITY_THRESHOLDS.evidenceGrounding &&
        normalized.dimensions.consistency.score >= QUALITY_THRESHOLDS.consistency &&
        normalized.dimensions.distinctiveness.score >= QUALITY_THRESHOLDS.distinctiveness &&
        normalized.dimensions.communicationUsefulness.score >= QUALITY_THRESHOLDS.communicationUsefulness &&
        normalized.dimensions.rationaleCompleteness.score >= QUALITY_THRESHOLDS.rationaleCompleteness &&
        evidenceCoverage.pass &&
        (normalized.hardFailureFlags?.length || 0) === 0
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
  ): Promise<{
    profile: PsychologicalProfile
    rawModelOutput: OutputQualityRawModelOutput
  }> {
    const prompt = `Repair this psychological profile once. Return strict JSON only.\n\nAgent: ${agent.name}\nCurrent profile:\n${JSON.stringify(profile, null, 2)}\n\nEvaluation:\n${JSON.stringify(evaluation, null, 2)}\n\nStage findings:\n${buildCompactStageFindingsBlock(stageFindings)}\n\nEvidence sample:\n${buildCompactEvidenceBlock(evidenceSignals, 10)}\n\nKeep the same schema. Improve evidence coverage, distinctiveness, and rationale clarity without becoming verbose. Do not remove claimEvidence. Convert any copied first-person interview excerpts in strengths, challenges, triggers, or growthEdges into concise third-person claim summaries. Avoid duplicate provisional wording in the summary.`

    const result = await generateText({
      providerInfo,
      temperature: 0.25,
      maxTokens: 560,
      timeoutMs: 22000,
      messages: [
        { role: 'system', content: 'Repair the profile. Return valid JSON only.' },
        { role: 'user', content: prompt },
      ],
    })

    const parsed = safeJsonParse<PsychologicalProfile>(result.content)
    return {
      profile: parsed ? normalizePsychologicalProfile(
        polishProfileClaimGroups({
          ...profile,
          ...parsed,
        }, agent, stageFindings, evidenceSignals),
        {
          source: 'analysis_run',
          qualityStatus: 'pending',
          profileVersion: PROFILE_VERSION,
        }
      ) : profile,
      rawModelOutput: createRawModelOutput(result.content),
    }
  }

  private validateProfileRun(params: {
    profile: PsychologicalProfile
    stageFindings: ProfileStageFinding[]
    interviewTurns: ProfileInterviewTurn[]
    sourceRefs: OutputQualitySourceRef[]
  }): OutputQualityValidationReport {
    const coverage = computeEvidenceCoverage(params.profile)
    const hardFailureFlags = [
      ...validateRequiredTextFields({
        summary: params.profile.summary,
      }),
      ...validateSharedArtifactText({
        summary: params.profile.summary,
        strengths: params.profile.strengths.join(' | '),
        challenges: params.profile.challenges.join(' | '),
        triggers: (params.profile.triggers || []).join(' | '),
        growthEdges: (params.profile.growthEdges || []).join(' | '),
        rationaleBigFive: params.profile.rationales?.bigFive,
        rationaleMbti: params.profile.rationales?.mbti,
        rationaleEnneagram: params.profile.rationales?.enneagram,
        rationaleCommunication: params.profile.rationales?.communicationStyle,
        rationaleStress: params.profile.rationales?.stressPattern,
        rationaleGrowth: params.profile.rationales?.motivationAndGrowth,
      }),
      ...validateSourceRefs(params.sourceRefs),
      ...(params.interviewTurns.length === 0 ? ['profile_missing_interview_transcript'] : []),
      ...(params.interviewTurns.some((turn) => !turn.question.trim() || !turn.answer.trim()) ? ['profile_empty_interview_turn'] : []),
      ...(params.stageFindings.length === 0 ? ['profile_missing_stage_findings'] : []),
      ...(params.stageFindings.some((finding) => !finding.evidenceRefs?.length) ? ['profile_stage_summary_missing_evidence_refs'] : []),
      ...(params.stageFindings.some((finding) => (finding.claims || []).length === 0) ? ['profile_stage_claims_missing'] : []),
      ...(params.stageFindings.some((finding) => (finding.claims || []).some((claim) => claim.evidenceRefs.length === 0)) ? ['profile_stage_claim_missing_evidence_refs'] : []),
      ...(coverage.pass ? [] : ['profile_evidence_coverage_below_threshold']),
      ...(listClaimEvidenceCoverage(params.profile.claimEvidence?.summary) ? [] : ['profile_summary_missing_evidence_refs']),
      ...(listClaimEvidenceCoverage(params.profile.claimEvidence?.communicationStyle) ? [] : ['profile_communication_missing_evidence_refs']),
      ...(listClaimEvidenceCoverage(params.profile.claimEvidence?.motivationalProfile) ? [] : ['profile_motivation_missing_evidence_refs']),
      ...(listClaimEvidenceCoverage(params.profile.claimEvidence?.mbti) ? [] : ['profile_mbti_missing_evidence_refs']),
      ...(listClaimEvidenceCoverage(params.profile.claimEvidence?.enneagram) ? [] : ['profile_enneagram_missing_evidence_refs']),
      ...((params.profile.claimEvidence?.strengths || []).length === 0 ? ['profile_strengths_missing_evidence_refs'] : []),
      ...((params.profile.claimEvidence?.challenges || []).length === 0 ? ['profile_challenges_missing_evidence_refs'] : []),
      ...((params.profile.claimEvidence?.triggers || []).length === 0 ? ['profile_triggers_missing_evidence_refs'] : []),
      ...((params.profile.claimEvidence?.growthEdges || []).length === 0 ? ['profile_growth_edges_missing_evidence_refs'] : []),
    ]

    const softWarnings = [
      ...(params.profile.confidence && params.profile.confidence < 0.55 ? ['profile_low_confidence'] : []),
      ...(coverage.coveragePercent < 100 ? [`profile_partial_evidence_coverage:${coverage.coveragePercent}`] : []),
    ]

    return createValidationReport({
      hardFailureFlags,
      softWarnings,
      validatorVersion: PROFILE_VALIDATOR_VERSION,
    })
  }

  private createBlockedEvaluation(validation?: OutputQualityValidationReport): ProfileQualityEvaluation {
    const blockerMessage = validation?.hardFailureFlags.length
      ? `Validation blocked evaluation: ${validation.hardFailureFlags.join(', ')}.`
      : 'Validation blocked evaluation.'

    return {
      overallScore: 0,
      pass: false,
      dimensions: {
        evidenceGrounding: { score: 0, rationale: blockerMessage },
        consistency: { score: 0, rationale: blockerMessage },
        distinctiveness: { score: 0, rationale: blockerMessage },
        communicationUsefulness: { score: 0, rationale: blockerMessage },
        rationaleCompleteness: { score: 0, rationale: blockerMessage },
      },
      strengths: [],
      weaknesses: [blockerMessage],
      repairInstructions: [
        'Return a clean JSON object only.',
        'Add evidence refs to every stage finding and every top-level profile claim group.',
        'Keep the profile grounded in the provided evidence packet and transcript.',
      ],
      evaluatorSummary: blockerMessage,
      hardFailureFlags: validation?.hardFailureFlags || ['profile_validation_blocked_evaluation'],
    }
  }

  /**
   * Classify evidence density as thin, moderate, or strong.
   * This drives confidence downgrading and tentative typology labeling.
   */
  private computeEvidenceDensity(
    evidenceSignals: ProfileEvidenceSignal[],
    stageFindings: ProfileStageFinding[]
  ): { level: EvidenceDensityLevel; totalSignals: number; stageClaimCount: number } {
    const totalSignals = evidenceSignals.length
    const stageClaimCount = stageFindings.reduce((count, finding) => count + (finding.claims?.length || 0), 0)

    // Strong: >= 20 evidence signals AND >= 8 stage claims
    if (totalSignals >= 20 && stageClaimCount >= 8) {
      return { level: 'strong', totalSignals, stageClaimCount }
    }
    // Moderate: >= 10 evidence signals AND >= 4 stage claims
    if (totalSignals >= 10 && stageClaimCount >= 4) {
      return { level: 'moderate', totalSignals, stageClaimCount }
    }
    // Thin: everything else
    return { level: 'thin', totalSignals, stageClaimCount }
  }

  /**
   * Compute profile confidence, downgrading when evidence is thin.
   * Prevents models from asserting strong typology claims on sparse data.
   */
  private computeProfileConfidence(
    parsed: Record<string, unknown> | null,
    evidenceDensity: { level: EvidenceDensityLevel }
  ): number {
    const modelConfidence = typeof parsed?.confidence === 'number' ? parsed.confidence : 0.74
    const densityCap: Record<string, number> = {
      thin: 0.48,
      moderate: 0.72,
      strong: 1.0,
    }
    const cap = densityCap[evidenceDensity.level] ?? 0.72
    return clamp(Math.min(modelConfidence, cap))
  }

  private shouldSkipRepair(
    evidenceCoverage: ProfileEvidenceCoverageSummary,
    validation: OutputQualityValidationReport,
    evidenceSignals: ProfileEvidenceSignal[],
    stageFindings: ProfileStageFinding[]
  ): boolean {
    const evidenceDensity = this.computeEvidenceDensity(evidenceSignals, stageFindings)
    if (evidenceDensity.level !== 'thin') {
      return false
    }

    return evidenceCoverage.blockedGroups.length >= 3
      || validation.hardFailureFlags.some((flag) => flag.includes('evidence'))
      || validation.hardFailureFlags.some((flag) => flag.includes('strengths_missing'))
      || validation.hardFailureFlags.some((flag) => flag.includes('challenges_missing'))
      || validation.hardFailureFlags.some((flag) => flag.includes('triggers_missing'))
      || validation.hardFailureFlags.some((flag) => flag.includes('growth_edges_missing'))
  }
}

export const profileAnalysisService = new ProfileAnalysisService()
