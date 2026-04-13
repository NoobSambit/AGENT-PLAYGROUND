import fs from 'fs/promises'
import path from 'path'

export const QUALITY_BASELINE_PROVIDER = 'ollama'
export const QUALITY_BASELINE_MODEL = 'qwen2.5:7b'

const GENERIC_OPENER_PATTERNS = [
  /^that(?:'|’)s\b/i,
  /^absolutely\b/i,
  /^certainly\b/i,
  /^great question\b/i,
  /^let(?:'|’)s\b/i,
  /^it sounds like\b/i,
  /^i understand\b/i,
]

const DIRECTNESS_PATTERNS = [
  /\b(be|keep|stay)\s+(more\s+)?direct\b/i,
  /\b(be|keep|stay)\s+(more\s+)?concise\b/i,
  /\bbrief\b/i,
  /\bno fluff\b/i,
  /\bwithout hedging\b/i,
  /\bjust tell me\b/i,
  /\bstraight\b/i,
]

export function parseArgs(argv) {
  const args = {}

  for (let index = 0; index < argv.length; index += 1) {
    const raw = argv[index]
    if (!raw.startsWith('--')) continue

    const trimmed = raw.slice(2)
    const [key, inlineValue] = trimmed.split('=')
    if (inlineValue !== undefined) {
      args[key] = inlineValue
      continue
    }

    const next = argv[index + 1]
    if (!next || next.startsWith('--')) {
      args[key] = true
      continue
    }

    args[key] = next
    index += 1
  }

  return args
}

export async function readJson(filePath) {
  const absolute = path.resolve(process.cwd(), filePath)
  const raw = await fs.readFile(absolute, 'utf8')
  return JSON.parse(raw)
}

export function asArray(value) {
  return Array.isArray(value) ? value : []
}

export function unwrapMessages(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export function unwrapMemories(payload) {
  if (Array.isArray(payload)) return payload
  if (Array.isArray(payload?.memories)) return payload.memories
  if (Array.isArray(payload?.data)) return payload.data
  return []
}

export function normalizeText(value) {
  return typeof value === 'string' ? value.trim() : ''
}

export function hasMeaningfulText(value) {
  if (typeof value === 'string') return value.trim().length > 0
  if (Array.isArray(value)) return value.some((item) => hasMeaningfulText(item))
  if (value && typeof value === 'object') {
    return Object.values(value).some((item) => hasMeaningfulText(item))
  }
  return false
}

export function startsWithSchemaLeakage(value) {
  const text = normalizeText(value)
  return /^(```(?:json)?|[{[]|\*\*title:\*\*|title\b[:\s])/i.test(text)
}

export function hasSerializedJson(value) {
  const text = normalizeText(value)
  return (
    /^[{[]/.test(text) ||
    /"title"\s*:/.test(text) ||
    /"summary"\s*:/.test(text) ||
    /"content"\s*:/.test(text)
  )
}

export function hasLabeledFieldMarkup(value) {
  const text = normalizeText(value)
  return /\*\*title:\*\*|\*\*summary:\*\*|\btitle:\s|\bsummary:\s/i.test(text)
}

export function detectCreativeOrJournalLeakage(record) {
  const title = normalizeText(record?.title)
  const summary = normalizeText(record?.summary)
  const content = normalizeText(record?.content)
  const flags = []

  if (!title) flags.push('missing_title')
  if (!content) flags.push('missing_content')
  if (startsWithSchemaLeakage(title)) flags.push('title_wrapper_leakage')
  if (hasSerializedJson(summary) || hasLabeledFieldMarkup(summary)) flags.push('summary_wrapper_leakage')
  if (startsWithSchemaLeakage(content) || hasSerializedJson(content) || hasLabeledFieldMarkup(content)) {
    flags.push('content_wrapper_leakage')
  }

  return flags
}

export function detectDreamContractFailures(record) {
  const flags = []
  if (!normalizeText(record?.title)) flags.push('missing_title')
  if (!normalizeText(record?.summary)) flags.push('missing_summary')
  if (!asArray(record?.scenes).length) flags.push('missing_scenes')
  if (!asArray(record?.symbols).length && !asArray(record?.themes).length) {
    flags.push('missing_symbols_and_themes')
  }
  if (!hasMeaningfulText(record?.interpretation)) flags.push('missing_interpretation')
  if (!hasMeaningfulText(record?.impression)) flags.push('missing_impression')
  if (startsWithSchemaLeakage(record?.title) || hasSerializedJson(record?.summary)) {
    flags.push('wrapper_leakage')
  }
  return flags
}

export function deriveQualityStatus({ validationPass, evaluationPass, wrapperLeakage }) {
  if (validationPass === true && evaluationPass === true) return 'passed'
  if (validationPass === false || evaluationPass === false || wrapperLeakage) return 'failed'
  return 'legacy_unvalidated'
}

export function deriveNormalizationStatus(record) {
  return record?.normalizationStatus || record?.normalization?.status || 'legacy_unvalidated'
}

export function deriveQualityScore(record) {
  const score = record?.qualityScore
    ?? record?.evaluation?.overallScore
    ?? record?.latestEvaluation?.overallScore
    ?? null
  return Number.isFinite(score) ? Number(score) : null
}

export function collectAuditCases(audit) {
  return {
    creative: [
      { source: 'creativePublishedDetail', persisted: true, session: audit.creativePublishedDetail?.session, records: asArray(audit.creativePublishedDetail?.artifacts) },
      { source: 'creativeFailedDetail', persisted: false, session: audit.creativeFailedDetail?.session, records: asArray(audit.creativeFailedDetail?.artifacts) },
    ],
    journal: [
      { source: 'journalSavedDetail', persisted: true, session: audit.journalSavedDetail?.session, records: asArray(audit.journalSavedDetail?.entries) },
      { source: 'journalFailedDetail', persisted: false, session: audit.journalFailedDetail?.session, records: asArray(audit.journalFailedDetail?.entries) },
    ],
    dream: [
      { source: 'dreamDetail', persisted: true, session: audit.dreamDetail?.session, records: asArray(audit.dreamDetail?.dreams) },
    ],
    profile: audit.profileDetail?.run ? [audit.profileDetail.run] : [],
    scenario: audit.scenarioDetail?.scenarioRun ? [audit.scenarioDetail.scenarioRun] : [],
    messages: unwrapMessages(audit.messages),
    memories: unwrapMemories(audit.memories),
  }
}

export function analyzeArtifactRecord(feature, record, persisted, source) {
  const persistedStatus = ['saved', 'published', 'final'].includes(record?.status || '')
  const persistedRecord = persisted ? persistedStatus : false
  const wrapperFlags = feature === 'dream'
    ? detectDreamContractFailures(record)
    : detectCreativeOrJournalLeakage(record)

  const validationPass = record?.validation?.pass
  const evaluationPass = record?.evaluation?.pass
  const qualityStatus = record?.qualityStatus || deriveQualityStatus({
    validationPass,
    evaluationPass,
    wrapperLeakage: wrapperFlags.length > 0,
  })

  return {
    feature,
    source,
    persisted: persistedRecord,
    id: record?.id || null,
    status: record?.status || null,
    title: normalizeText(record?.title) || null,
    qualityStatus,
    normalizationStatus: deriveNormalizationStatus(record),
    qualityScore: deriveQualityScore(record),
    evaluationPass: typeof evaluationPass === 'boolean' ? evaluationPass : null,
    validationPass: typeof validationPass === 'boolean' ? validationPass : null,
    hardFailureFlags: [
      ...new Set([
        ...(asArray(record?.validation?.hardFailureFlags)),
        ...wrapperFlags,
      ]),
    ],
    structurallyValid: wrapperFlags.length === 0 && !!normalizeText(record?.title),
  }
}

export function summarizeArtifactSessions(cases, feature) {
  const sessions = []

  for (const entry of cases) {
    const analyzed = entry.records.map((record) => analyzeArtifactRecord(feature, record, entry.persisted, entry.source))
    const passing = analyzed.some((record) => record.structurallyValid)
    const persistedMalformed = analyzed.filter((record) => record.persisted && !record.structurallyValid)
    sessions.push({
      source: entry.source,
      feature,
      recordCount: analyzed.length,
      passing,
      analyzed,
      persistedMalformed,
      sessionStatus: entry.session?.status || null,
      qualityStatus: entry.session?.qualityStatus || null,
    })
  }

  return sessions
}

export function summarizeScenarioRun(run) {
  const turns = asArray(run?.turns)
  const baselineFlags = turns.flatMap((turn) => asArray(turn?.baselineQuality?.qualityFlags))
  const alternateFlags = turns.flatMap((turn) => asArray(turn?.alternateQuality?.qualityFlags))
  const comparisonFlags = [
    ...asArray(run?.comparison?.qualityFlags?.baseline),
    ...asArray(run?.comparison?.qualityFlags?.alternate),
  ]
  const lowActionability = [...baselineFlags, ...alternateFlags, ...comparisonFlags].includes('low_actionability')

  return {
    id: run?.id || null,
    status: run?.status || null,
    qualityStatus: run?.qualityStatus || null,
    turnCount: turns.length,
    lowActionability,
    recommendationPresent: !!normalizeText(run?.comparison?.recommendation),
    hardFailureFlags: [
      ...(turns.length < 3 ? ['insufficient_probe_turns'] : []),
      ...(lowActionability ? ['low_actionability'] : []),
      ...(!normalizeText(run?.comparison?.recommendation) ? ['missing_recommendation'] : []),
    ],
  }
}

export function summarizeProfileRun(run) {
  const evaluationPass = run?.latestEvaluation?.pass
  const status = run?.status || null
  const unsafeReadyState = evaluationPass === false && ['ready', 'completed', 'complete'].includes(status || '')

  return {
    id: run?.id || null,
    status,
    qualityStatus: run?.qualityStatus || null,
    evaluationPass: typeof evaluationPass === 'boolean' ? evaluationPass : null,
    qualityScore: deriveQualityScore(run),
    unsafeReadyState,
    hardFailureFlags: unsafeReadyState ? ['failed_profile_run_reached_ready_state'] : [],
  }
}

export function summarizeChatDirectness(messages) {
  let evaluatedPairs = 0
  let genericOpenerViolations = 0
  const samples = []

  for (let index = 0; index < messages.length - 1; index += 1) {
    const user = messages[index]
    const assistant = messages[index + 1]
    const userText = normalizeText(user?.content)
    const assistantText = normalizeText(assistant?.content)

    if (user?.type !== 'user' || assistant?.type !== 'agent') continue
    if (!DIRECTNESS_PATTERNS.some((pattern) => pattern.test(userText))) continue

    evaluatedPairs += 1
    const violated = GENERIC_OPENER_PATTERNS.some((pattern) => pattern.test(assistantText))
    if (violated) {
      genericOpenerViolations += 1
      samples.push({
        user: userText.slice(0, 180),
        assistant: assistantText.slice(0, 180),
      })
    }
  }

  return {
    evaluatedPairs,
    genericOpenerViolations,
    violationRate: evaluatedPairs > 0 ? genericOpenerViolations / evaluatedPairs : null,
    samples,
  }
}

export function summarizeSemanticMemories(memories) {
  const semanticTypes = new Set([
    'preference',
    'project',
    'relationship',
    'identity',
    'operating_constraint',
    'artifact_summary',
    'tension_snapshot',
  ])

  const semantic = memories.filter((memory) => semanticTypes.has(memory?.type))

  return {
    total: memories.length,
    semanticCount: semantic.length,
    semanticTypes: [...new Set(semantic.map((memory) => memory.type))].sort(),
    semanticExamples: semantic.slice(0, 5).map((memory) => ({
      id: memory.id,
      type: memory.type,
      canonicalKey: memory.canonicalKey || memory.canonical_key || null,
      canonicalValue: memory.canonicalValue || memory.canonical_value || null,
    })),
  }
}
