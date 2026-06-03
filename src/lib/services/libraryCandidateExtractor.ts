import { createHash } from 'crypto'
import { AgentRepository } from '@/lib/repositories/agentRepository'
import { LibraryRepository } from '@/lib/repositories/libraryRepository'
import { generateId } from '@/lib/db/utils'
import { getConfiguredLLMProviderForPreference, type LLMProviderInfo } from '@/lib/llmConfig'
import { generateText } from '@/lib/llm/provider'
import { safeParseJsonWithExtraction } from '@/lib/services/outputQuality/normalizers'
import {
  LIBRARY_CATEGORIES,
  LIBRARY_SOURCE_TYPES,
} from '@/lib/services/libraryService'
import type {
  LibraryCategory,
  LibraryItem,
  LibraryItemDetail,
  LibraryItemPayload,
  LibraryItemSummary,
  LibrarySourceRef,
  LibrarySourceType,
} from '@/types/database'

const MIN_CLAIM_LENGTH = 20
const MIN_BODY_LENGTH = 40
const DEFAULT_MAX_CANDIDATES = 3
const LEXICAL_DUPLICATE_THRESHOLD = 0.82
const LLM_PROMPT_VERSION = 'library-candidate-extractor-v1'

export type LibraryCandidateExtractorMode = 'disabled' | 'deterministic' | 'llm'
export type LibraryCandidateExtractionStatus = 'created' | 'skipped' | 'failed'
export type LibraryCandidateSkippedReason =
  | 'disabled'
  | 'missing_source_ref'
  | 'no_reusable_claim_found'
  | 'all_candidates_invalid'
  | 'all_candidates_duplicate'
  | 'llm_provider_unavailable'

export interface ExtractLibraryCandidatesInput {
  agentId: string
  agentName: string
  sourceType: LibrarySourceType
  sourceId: string
  sourceTitle?: string
  sourceSummary: string
  sourceTimestamp?: string
  sourceUrl?: string
  featurePayload: unknown
  preferredModel?: string
  mode: LibraryCandidateExtractorMode
  maxCandidates?: number
}

export interface ExtractedLibraryCandidate {
  title: string
  claim: string
  body: string
  category: LibraryCategory
  confidence: number
  tags: string[]
  evidenceSummary: string
  relatedAgentIds: string[]
}

export interface LibraryCandidateValidationResult {
  valid: boolean
  candidate?: ExtractedLibraryCandidate
  errors: string[]
  warnings: string[]
}

export interface LibraryCandidateExtractionMetadata {
  createdCandidateIds: string[]
  skippedReason?: LibraryCandidateSkippedReason
  failedExtractionReason?: string
  extractorMode: LibraryCandidateExtractorMode
  invalidCandidateReasons: string[]
  duplicateCandidateIds: string[]
  duplicateCandidateClaims: string[]
}

export interface LibraryCandidateExtractionResult {
  status: LibraryCandidateExtractionStatus
  candidates: LibraryItemDetail[]
  metadata: LibraryCandidateExtractionMetadata
}

type RawCandidate = Partial<ExtractedLibraryCandidate> & Record<string, unknown>

type StructuredSignal = {
  key: string
  category: LibraryCategory
  defaultTitle: string
}

const STRUCTURED_SIGNALS: StructuredSignal[] = [
  { key: 'facts', category: 'fact', defaultTitle: 'Reusable fact' },
  { key: 'preferences', category: 'preference', defaultTitle: 'Learned preference' },
  { key: 'behaviorPatterns', category: 'behavior_pattern', defaultTitle: 'Behavior pattern' },
  { key: 'patterns', category: 'behavior_pattern', defaultTitle: 'Behavior pattern' },
  { key: 'strengths', category: 'strength', defaultTitle: 'Observed strength' },
  { key: 'weaknesses', category: 'weakness', defaultTitle: 'Observed weakness' },
  { key: 'strategies', category: 'strategy', defaultTitle: 'Reusable strategy' },
  { key: 'relationships', category: 'relationship', defaultTitle: 'Relationship insight' },
  { key: 'creativeStyles', category: 'creative_style', defaultTitle: 'Creative style' },
  { key: 'emotionalPatterns', category: 'emotional_pattern', defaultTitle: 'Emotional pattern' },
  { key: 'skills', category: 'skill', defaultTitle: 'Skill signal' },
  { key: 'risks', category: 'risk', defaultTitle: 'Risk signal' },
  { key: 'lessons', category: 'lesson', defaultTitle: 'Learned lesson' },
  { key: 'insights', category: 'lesson', defaultTitle: 'Reusable insight' },
]

const STOP_WORDS = new Set([
  'a',
  'an',
  'and',
  'are',
  'as',
  'at',
  'be',
  'by',
  'for',
  'from',
  'has',
  'in',
  'is',
  'it',
  'of',
  'on',
  'or',
  'that',
  'the',
  'to',
  'was',
  'with',
])

function cleanText(value: unknown): string {
  return typeof value === 'string' ? value.replace(/\s+/g, ' ').trim() : ''
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function clampMaxCandidates(value: number | undefined): number {
  return clamp(Math.floor(value || DEFAULT_MAX_CANDIDATES), 1, 3)
}

function isValidCategory(value: unknown): value is LibraryCategory {
  return typeof value === 'string' && LIBRARY_CATEGORIES.includes(value as LibraryCategory)
}

function isValidSourceType(value: unknown): value is LibrarySourceType {
  return typeof value === 'string' && LIBRARY_SOURCE_TYPES.includes(value as LibrarySourceType)
}

function normalizeTag(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 40)
}

function uniqueStrings(values: unknown, limit = 8): string[] {
  if (!Array.isArray(values)) {
    return []
  }

  return [...new Set(values
    .filter((value): value is string => typeof value === 'string')
    .map((value) => value.trim())
    .filter(Boolean))]
    .slice(0, limit)
}

function normalizeCandidateTags(values: unknown, category: LibraryCategory, sourceType: LibrarySourceType): string[] {
  const tags = uniqueStrings(values)
    .map(normalizeTag)
    .filter(Boolean)

  return [...new Set([sourceType, category, ...tags])].slice(0, 8)
}

export function normalizeClaimForDedupe(value: string): string {
  return value
    .toLowerCase()
    .replace(/['"]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

export function normalizedClaimHash(value: string): string {
  return createHash('sha256').update(normalizeClaimForDedupe(value)).digest('hex')
}

function tokenSet(value: string): Set<string> {
  return new Set(normalizeClaimForDedupe(value)
    .split(' ')
    .filter((token) => token.length > 2 && !STOP_WORDS.has(token)))
}

export function lexicalSimilarity(left: string, right: string): number {
  const leftTokens = tokenSet(left)
  const rightTokens = tokenSet(right)
  if (leftTokens.size === 0 || rightTokens.size === 0) {
    return 0
  }

  let intersection = 0
  for (const token of leftTokens) {
    if (rightTokens.has(token)) {
      intersection += 1
    }
  }

  return intersection / (leftTokens.size + rightTokens.size - intersection)
}

function containsSecretOrStackTrace(...values: string[]): boolean {
  const text = values.join('\n')
  return [
    /-----BEGIN [A-Z ]*PRIVATE KEY-----/i,
    /\b(?:api[_-]?key|secret|password|passwd|token|private[_-]?key)\s*[:=]\s*['"]?[a-z0-9_\-.]{12,}/i,
    /\b(?:sk|ghp|github_pat|glpat|xox[baprs])-?[a-z0-9_]{20,}/i,
    /\bAIza[0-9A-Za-z_-]{20,}/,
    /Traceback \(most recent call last\):/,
    /\bat\s+[\w.$<>]+\s*\([^)]*:\d+:\d+\)/,
    /\b[A-Z][A-Za-z]+Error:\s+.+\n\s+at\s+/,
  ].some((pattern) => pattern.test(text))
}

function hasUnsupportedAbsoluteClaim(candidate: ExtractedLibraryCandidate): boolean {
  const text = `${candidate.claim} ${candidate.body}`.toLowerCase()
  const hasAbsolute = /\b(always|never|guarantees?|proves?|cannot|impossible|everyone|no one|only ever)\b/.test(text)
  if (!hasAbsolute) {
    return false
  }

  return !/\b(repeated|recurring|consistently|multiple|several|across|pattern|trend|again|history|evidence)\b/.test(text)
}

function coerceRawCandidate(
  raw: RawCandidate,
  input: ExtractLibraryCandidatesInput,
  fallbackCategory: LibraryCategory = 'lesson'
): ExtractedLibraryCandidate {
  const hasCategory = raw.category !== undefined && raw.category !== null && cleanText(raw.category).length > 0
  const category = !hasCategory
    ? fallbackCategory
    : isValidCategory(raw.category)
      ? raw.category
      : cleanText(raw.category) as LibraryCategory || '__invalid_category__' as LibraryCategory
  const claim = cleanText(raw.claim || raw.body || raw.title)
  const body = cleanText(raw.body || raw.evidenceSummary || claim)
  const evidenceSummary = cleanText(raw.evidenceSummary || input.sourceSummary)
  const confidence = typeof raw.confidence === 'number' && Number.isFinite(raw.confidence) ? raw.confidence : 0.55

  return {
    title: cleanText(raw.title) || titleFromClaim(claim || body),
    claim,
    body,
    category,
    confidence,
    tags: normalizeCandidateTags(raw.tags, category, input.sourceType),
    evidenceSummary,
    relatedAgentIds: uniqueStrings(raw.relatedAgentIds),
  }
}

function titleFromClaim(value: string): string {
  const words = cleanText(value).split(' ').slice(0, 8).join(' ')
  if (!words) {
    return 'Library candidate'
  }
  return words.length > 72 ? `${words.slice(0, 69)}...` : words
}

function bodyFromSignal(value: string, sourceSummary: string): string {
  const cleaned = cleanText(value)
  const summary = cleanText(sourceSummary)
  if (cleaned.length >= MIN_BODY_LENGTH) {
    return cleaned
  }

  return summary
    ? `${cleaned}. Evidence from the completed source: ${summary}`.slice(0, 800)
    : `${cleaned}. Evidence comes from the completed feature source and must be reviewed before reuse.`
}

function candidateFromSignal(
  value: unknown,
  signal: StructuredSignal,
  input: ExtractLibraryCandidatesInput
): ExtractedLibraryCandidate | null {
  const raw = typeof value === 'object' && value !== null ? value as Record<string, unknown> : null
  const text = cleanText(raw?.claim || raw?.summary || raw?.text || raw?.content || raw?.body || value)
  if (!text) {
    return null
  }

  return coerceRawCandidate({
    title: cleanText(raw?.title) || signal.defaultTitle,
    claim: text,
    body: bodyFromSignal(cleanText(raw?.body) || text, input.sourceSummary),
    category: isValidCategory(raw?.category) ? raw.category : signal.category,
    confidence: typeof raw?.confidence === 'number' ? raw.confidence : 0.55,
    tags: raw?.tags,
    evidenceSummary: cleanText(raw?.evidenceSummary) || input.sourceSummary,
    relatedAgentIds: raw?.relatedAgentIds,
  }, input, signal.category)
}

function extractStructuredCandidateArrays(payload: unknown): RawCandidate[] {
  if (!payload || typeof payload !== 'object') {
    return []
  }

  const record = payload as Record<string, unknown>
  const direct = [
    record.libraryCandidates,
    record.candidates,
    record.candidateClaims,
  ]

  return direct
    .filter(Array.isArray)
    .flatMap((entries) => entries as unknown[])
    .map((entry) => typeof entry === 'object' && entry !== null
      ? entry as RawCandidate
      : { claim: cleanText(entry) })
}

function extractStructuredSignals(input: ExtractLibraryCandidatesInput): ExtractedLibraryCandidate[] {
  if (!input.featurePayload || typeof input.featurePayload !== 'object') {
    return []
  }

  const record = input.featurePayload as Record<string, unknown>
  const candidates: ExtractedLibraryCandidate[] = []

  for (const signal of STRUCTURED_SIGNALS) {
    const entries = record[signal.key]
    if (!Array.isArray(entries)) {
      continue
    }

    for (const entry of entries) {
      const candidate = candidateFromSignal(entry, signal, input)
      if (candidate) {
        candidates.push(candidate)
      }
    }
  }

  return candidates
}

function categoryFromSentence(sentence: string): LibraryCategory | null {
  if (/\b(prefer|preference|favors|likes|wants|values)\b/i.test(sentence)) return 'preference'
  if (/\b(pattern|recurring|tends|habit|consistently)\b/i.test(sentence)) return 'behavior_pattern'
  if (/\b(strength|strong|effective|excels|good at)\b/i.test(sentence)) return 'strength'
  if (/\b(weakness|struggles|gap|needs improvement|misses)\b/i.test(sentence)) return 'weakness'
  if (/\b(strategy|approach|technique|playbook|method)\b/i.test(sentence)) return 'strategy'
  if (/\b(relationship|trust|conflict|collaborat|partner)\b/i.test(sentence)) return 'relationship'
  if (/\b(style|motif|voice|aesthetic|creative)\b/i.test(sentence)) return 'creative_style'
  if (/\b(emotion|stress|anxiety|calm|frustrat|mood)\b/i.test(sentence)) return 'emotional_pattern'
  if (/\b(skill|capability|practice|trained|learned to)\b/i.test(sentence)) return 'skill'
  if (/\b(risk|hazard|failure mode|watch|avoid)\b/i.test(sentence)) return 'risk'
  if (/\b(lesson|learned|takeaway|should|works best)\b/i.test(sentence)) return 'lesson'
  return null
}

function extractSummarySignals(input: ExtractLibraryCandidatesInput): ExtractedLibraryCandidate[] {
  return cleanText(input.sourceSummary)
    .split(/(?<=[.!?])\s+/)
    .map(cleanText)
    .filter((sentence) => sentence.length >= MIN_CLAIM_LENGTH)
    .map((sentence) => {
      const category = categoryFromSentence(sentence)
      if (!category) {
        return null
      }

      return coerceRawCandidate({
        title: titleFromClaim(sentence),
        claim: sentence,
        body: bodyFromSignal(sentence, input.sourceSummary),
        category,
        confidence: 0.5,
        tags: [category],
        evidenceSummary: input.sourceSummary,
      }, input, category)
    })
    .filter((candidate): candidate is ExtractedLibraryCandidate => Boolean(candidate))
}

export function extractDeterministicLibraryCandidates(input: ExtractLibraryCandidatesInput): ExtractedLibraryCandidate[] {
  const rawCandidates = extractStructuredCandidateArrays(input)
    .map((candidate) => coerceRawCandidate(candidate, input))

  return [
    ...rawCandidates,
    ...extractStructuredSignals(input),
    ...extractSummarySignals(input),
  ]
}

function buildSourceRef(input: ExtractLibraryCandidatesInput, evidenceSummary: string): LibrarySourceRef | null {
  if (!isValidSourceType(input.sourceType) || !cleanText(input.sourceId) || !cleanText(evidenceSummary || input.sourceSummary)) {
    return null
  }

  return {
    sourceType: input.sourceType,
    sourceId: cleanText(input.sourceId),
    sourceTitle: cleanText(input.sourceTitle) || undefined,
    sourceUrl: cleanText(input.sourceUrl) || undefined,
    sourceTimestamp: cleanText(input.sourceTimestamp) || new Date().toISOString(),
    evidenceSummary: cleanText(evidenceSummary || input.sourceSummary),
  }
}

export function validateExtractedLibraryCandidate(
  candidate: ExtractedLibraryCandidate,
  sourceRef: LibrarySourceRef | null,
  mode: Exclude<LibraryCandidateExtractorMode, 'disabled'>
): LibraryCandidateValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const title = cleanText(candidate.title)
  const claim = cleanText(candidate.claim)
  const body = cleanText(candidate.body)
  const evidenceSummary = cleanText(candidate.evidenceSummary || sourceRef?.evidenceSummary)

  if (!title) errors.push('title is required')
  if (!claim) errors.push('claim is required')
  if (!body) errors.push('body is required')
  if (!isValidCategory(candidate.category)) errors.push('category is invalid')
  if (!sourceRef) errors.push('source ref is required')
  if (claim.length > 0 && claim.length < MIN_CLAIM_LENGTH) errors.push('claim is too short')
  if (body.length > 0 && body.length < MIN_BODY_LENGTH) errors.push('body is too short')
  if (!Number.isFinite(candidate.confidence) || candidate.confidence < 0.35) errors.push('confidence is too low')
  if (containsSecretOrStackTrace(title, claim, body, evidenceSummary)) errors.push('candidate contains a secret or stack trace')

  const normalized: ExtractedLibraryCandidate = {
    ...candidate,
    title,
    claim,
    body,
    evidenceSummary,
    confidence: clamp(candidate.confidence, 0.35, 0.9),
    tags: normalizeCandidateTags(candidate.tags, candidate.category, sourceRef?.sourceType || 'manual'),
    relatedAgentIds: uniqueStrings(candidate.relatedAgentIds),
  }

  if (mode === 'llm' && candidate.confidence > 0.9) {
    warnings.push('llm confidence was clamped to 0.9')
  }

  if (hasUnsupportedAbsoluteClaim(normalized)) {
    errors.push('candidate contains an unsupported absolute claim')
  }

  return {
    valid: errors.length === 0,
    candidate: errors.length === 0 ? normalized : undefined,
    errors,
    warnings,
  }
}

function compactFeaturePayload(payload: unknown): string {
  if (payload === undefined || payload === null) {
    return 'No structured payload provided.'
  }

  try {
    return JSON.stringify(payload, null, 2).slice(0, 4000)
  } catch {
    return String(payload).slice(0, 4000)
  }
}

function buildLlmPrompt(input: ExtractLibraryCandidatesInput, maxCandidates: number): string {
  return `Extract up to ${maxCandidates} reusable Library knowledge candidates from this completed feature output.

Rules:
- Return JSON only.
- Return an array of candidate objects.
- Each candidate must be specific, source-backed, and useful for future agent behavior.
- Do not create permanent personality judgments from one weak event.
- Do not include raw transcript text.
- Do not include secrets, stack traces, private prompts, credentials, or environment values.
- If there is no reusable knowledge, return an empty array.

Allowed categories:
${LIBRARY_CATEGORIES.join(', ')}

Required object keys:
title, claim, body, category, confidence, tags, evidenceSummary, relatedAgentIds

Agent:
${input.agentName} (${input.agentId})

Source:
type=${input.sourceType}
id=${input.sourceId}
title=${input.sourceTitle || 'Untitled source'}
summary=${input.sourceSummary}

Compact structured payload:
${compactFeaturePayload(input.featurePayload)}`
}

async function extractLlmCandidates(input: ExtractLibraryCandidatesInput, maxCandidates: number): Promise<{
  candidates: ExtractedLibraryCandidate[]
  providerInfo: LLMProviderInfo
}> {
  const providerInfo = getConfiguredLLMProviderForPreference({ model: input.preferredModel })
  if (!providerInfo) {
    throw new Error('No LLM provider configured for Library candidate extraction.')
  }

  const response = await generateText({
    providerInfo,
    temperature: providerInfo.provider === 'ollama' ? 0.2 : 0.35,
    maxTokens: providerInfo.provider === 'ollama' ? 900 : 1200,
    timeoutMs: providerInfo.provider === 'ollama' ? 45000 : 30000,
    messages: [
      {
        role: 'system',
        content: 'You extract review-only knowledge candidates for an inspectable AI agent Library. Return strict JSON only.',
      },
      {
        role: 'user',
        content: buildLlmPrompt(input, maxCandidates),
      },
    ],
  })
  const parsed = safeParseJsonWithExtraction<unknown>(response.content)
  const raw = Array.isArray(parsed.parsed)
    ? parsed.parsed
    : parsed.parsed && typeof parsed.parsed === 'object' && Array.isArray((parsed.parsed as Record<string, unknown>).candidates)
      ? (parsed.parsed as Record<string, unknown>).candidates
      : null

  if (!raw) {
    throw new Error(`LLM extraction returned malformed JSON: ${parsed.parserNotes.join(' ') || parsed.parser}`)
  }

  return {
    candidates: raw
      .filter((entry): entry is RawCandidate => typeof entry === 'object' && entry !== null)
      .map((entry) => coerceRawCandidate(entry, input)),
    providerInfo: response.providerInfo,
  }
}

function dedupeCandidates(params: {
  candidates: ExtractedLibraryCandidate[]
  existingItems: LibraryItemSummary[]
  maxCandidates: number
}): {
  selected: Array<{ candidate: ExtractedLibraryCandidate; possibleDuplicateIds: string[] }>
  duplicateCandidateClaims: string[]
  duplicateCandidateIds: string[]
} {
  const selected: Array<{ candidate: ExtractedLibraryCandidate; possibleDuplicateIds: string[] }> = []
  const seenHashes = new Set<string>()
  const duplicateCandidateClaims: string[] = []
  const duplicateCandidateIds: string[] = []

  for (const candidate of params.candidates) {
    const hash = normalizedClaimHash(candidate.claim)
    const existingDuplicates = params.existingItems
      .filter((item) => (
        normalizedClaimHash(item.claim) === hash ||
        lexicalSimilarity(item.claim, candidate.claim) >= LEXICAL_DUPLICATE_THRESHOLD
      ))
      .map((item) => item.id)

    const candidateDuplicate = seenHashes.has(hash) ||
      selected.some((entry) => lexicalSimilarity(entry.candidate.claim, candidate.claim) >= LEXICAL_DUPLICATE_THRESHOLD)

    if (candidateDuplicate || existingDuplicates.length > 0) {
      duplicateCandidateClaims.push(candidate.claim)
      duplicateCandidateIds.push(...existingDuplicates)
      continue
    }

    seenHashes.add(hash)
    selected.push({ candidate, possibleDuplicateIds: [] })
    if (selected.length >= params.maxCandidates) {
      break
    }
  }

  return {
    selected,
    duplicateCandidateClaims,
    duplicateCandidateIds: [...new Set(duplicateCandidateIds)],
  }
}

function makeItem(params: {
  input: ExtractLibraryCandidatesInput
  candidate: ExtractedLibraryCandidate
  sourceRef: LibrarySourceRef
  mode: Exclude<LibraryCandidateExtractorMode, 'disabled'>
  possibleDuplicateIds: string[]
  providerInfo?: LLMProviderInfo
  validation: LibraryCandidateValidationResult
}): LibraryItem {
  const now = new Date().toISOString()
  const payload: LibraryItemPayload = {
    extraction: {
      extractor: params.mode,
      promptVersion: params.mode === 'llm' ? LLM_PROMPT_VERSION : undefined,
      model: params.providerInfo?.model,
      rawCandidate: params.candidate,
    },
    validation: {
      errors: params.validation.errors,
      warnings: params.validation.warnings,
      checkedAt: now,
    },
    dedupe: {
      normalizedClaimHash: normalizedClaimHash(params.candidate.claim),
      possibleDuplicateIds: params.possibleDuplicateIds,
    },
    contextPolicy: {
      allowPromptUse: false,
      maxPromptChars: 1200,
    },
    sourceSpecific: {
      sourceTitle: params.input.sourceTitle,
      extractorMode: params.mode,
    },
  }

  return {
    id: generateId('library_item'),
    agentId: params.input.agentId,
    scope: 'agent',
    title: params.candidate.title,
    claim: params.candidate.claim,
    body: params.candidate.body,
    category: params.candidate.category,
    status: 'review',
    confidence: params.candidate.confidence,
    qualityStatus: 'pending',
    visibility: 'agent',
    createdByAgentId: params.input.agentId,
    createdByName: params.input.agentName,
    createdFromFeature: params.sourceRef.sourceType,
    primarySourceType: params.sourceRef.sourceType,
    primarySourceId: params.sourceRef.sourceId,
    tags: params.candidate.tags,
    relatedAgentIds: params.candidate.relatedAgentIds,
    usageCount: 0,
    createdAt: now,
    updatedAt: now,
    payload,
  }
}

function emptyMetadata(mode: LibraryCandidateExtractorMode): LibraryCandidateExtractionMetadata {
  return {
    createdCandidateIds: [],
    extractorMode: mode,
    invalidCandidateReasons: [],
    duplicateCandidateIds: [],
    duplicateCandidateClaims: [],
  }
}

export class LibraryCandidateExtractor {
  static extractDeterministicCandidates(input: ExtractLibraryCandidatesInput): ExtractedLibraryCandidate[] {
    return extractDeterministicLibraryCandidates(input)
  }

  static validateCandidate(
    candidate: ExtractedLibraryCandidate,
    sourceRef: LibrarySourceRef | null,
    mode: Exclude<LibraryCandidateExtractorMode, 'disabled'>
  ): LibraryCandidateValidationResult {
    return validateExtractedLibraryCandidate(candidate, sourceRef, mode)
  }

  static async extractAndSaveCandidates(input: ExtractLibraryCandidatesInput): Promise<LibraryCandidateExtractionResult> {
    const mode = input.mode
    const metadata = emptyMetadata(mode)

    try {
      if (mode === 'disabled') {
        metadata.skippedReason = 'disabled'
        return { status: 'skipped', candidates: [], metadata }
      }

      const agent = await AgentRepository.getById(input.agentId)
      if (!agent) {
        metadata.failedExtractionReason = 'Agent not found.'
        return { status: 'failed', candidates: [], metadata }
      }

      const maxCandidates = clampMaxCandidates(input.maxCandidates)
      const sourceRef = buildSourceRef(input, input.sourceSummary)
      if (!sourceRef) {
        metadata.skippedReason = 'missing_source_ref'
        return { status: 'skipped', candidates: [], metadata }
      }

      let providerInfo: LLMProviderInfo | undefined
      let extractedCandidates: ExtractedLibraryCandidate[] = []

      if (mode === 'llm') {
        const llmExtraction = await extractLlmCandidates(input, maxCandidates)
        providerInfo = llmExtraction.providerInfo
        extractedCandidates = llmExtraction.candidates
      } else {
        extractedCandidates = extractDeterministicLibraryCandidates(input)
      }

      if (extractedCandidates.length === 0) {
        metadata.skippedReason = mode === 'llm' ? 'no_reusable_claim_found' : 'no_reusable_claim_found'
        return { status: 'skipped', candidates: [], metadata }
      }

      const validationMode = mode as Exclude<LibraryCandidateExtractorMode, 'disabled'>
      const validated = extractedCandidates
        .map((candidate) => {
          const candidateSourceRef = buildSourceRef(input, candidate.evidenceSummary)
          const validation = validateExtractedLibraryCandidate(candidate, candidateSourceRef, validationMode)
          if (!validation.valid) {
            metadata.invalidCandidateReasons.push(validation.errors.join('; '))
          }
          return {
            candidate: validation.candidate,
            sourceRef: candidateSourceRef,
            validation,
          }
        })
        .filter((entry): entry is {
          candidate: ExtractedLibraryCandidate
          sourceRef: LibrarySourceRef
          validation: LibraryCandidateValidationResult
        } => Boolean(entry.candidate && entry.sourceRef))

      if (validated.length === 0) {
        metadata.skippedReason = 'all_candidates_invalid'
        return { status: 'skipped', candidates: [], metadata }
      }

      const existingItems = await LibraryRepository.listItems({
        agentId: input.agentId,
        includeNetwork: true,
        status: 'all',
        scope: 'all',
        limit: 500,
      })
      const dedupeResult = dedupeCandidates({
        candidates: validated.map((entry) => entry.candidate),
        existingItems,
        maxCandidates,
      })
      const deduped = dedupeResult.selected
      metadata.duplicateCandidateClaims = dedupeResult.duplicateCandidateClaims
      metadata.duplicateCandidateIds = dedupeResult.duplicateCandidateIds

      if (deduped.length === 0) {
        metadata.skippedReason = 'all_candidates_duplicate'
        return { status: 'skipped', candidates: [], metadata }
      }

      const created: LibraryItemDetail[] = []
      for (const entry of deduped) {
        const validatedEntry = validated.find((candidateEntry) => normalizedClaimHash(candidateEntry.candidate.claim) === normalizedClaimHash(entry.candidate.claim))
        if (!validatedEntry) {
          continue
        }

        const detail = await LibraryRepository.insertItemWithSources({
          item: makeItem({
            input: {
              ...input,
              agentName: agent.name || input.agentName,
            },
            candidate: entry.candidate,
            sourceRef: validatedEntry.sourceRef,
            mode: validationMode,
            possibleDuplicateIds: entry.possibleDuplicateIds,
            providerInfo,
            validation: validatedEntry.validation,
          }),
          sources: [validatedEntry.sourceRef],
        })
        created.push(detail)
      }

      metadata.createdCandidateIds = created.map((detail) => detail.item.id)
      return {
        status: created.length > 0 ? 'created' : 'skipped',
        candidates: created,
        metadata: created.length > 0
          ? metadata
          : { ...metadata, skippedReason: metadata.skippedReason || 'no_reusable_claim_found' },
      }
    } catch (error) {
      metadata.failedExtractionReason = error instanceof Error ? error.message : 'Unknown Library candidate extraction failure.'
      metadata.skippedReason = mode === 'llm' && /No LLM provider configured/i.test(metadata.failedExtractionReason)
        ? 'llm_provider_unavailable'
        : metadata.skippedReason
      return {
        status: metadata.skippedReason === 'llm_provider_unavailable' ? 'skipped' : 'failed',
        candidates: [],
        metadata,
      }
    }
  }
}
