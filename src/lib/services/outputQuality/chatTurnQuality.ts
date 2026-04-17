import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { LLMConfig } from '@/lib/langchain/baseChain'
import { BaseChain } from '@/lib/langchain/baseChain'
import { applyFinalQualityGate } from './evaluators'
import { createPendingTrackedFields } from './contracts'
import { createValidationReport } from './validators'
import { detectTextLeakage, OUTPUT_QUALITY_FLAGS } from './flags'

const CHAT_PROMPT_VERSION = 'phase3-chat-quality-v2'
const GENERIC_OPENERS = [
  'absolutely',
  'certainly',
  'sure',
  'of course',
  'definitely',
  'got it',
  'okay',
  'ok',
  'understood',
  'great to hear',
  "i'd be happy to",
  'happy to help',
  'great question',
  'thanks for sharing',
  'that makes sense',
  'i understand',
  'no problem',
  'you\'re right',
]

const PERSONA_META_PATTERNS = /\b(here'?s a (?:revised|rewritten) version that (?:aligns|matches)|aligns with .{2,40}persona|revised version that aligns|in the persona of|speaking as the .{2,30}agent|from the perspective of the persona|now in (?:my|the) persona)\b/i
const GENERIC_COACHING_PATTERNS = /\b(consider (?:the following|these|trying)|you (?:might|could|may) (?:want|try|consider)|here are (?:some|a few) (?:tips|ideas|suggestions|options|strategies)|some (?:tips|ideas|suggestions)|remember (?:that|to)|keep in mind that|it'?s (?:important|worth|key) to (?:note|remember|consider)|you should (?:also )?consider|to address this|focus on progress rather than perfection|learning opportunity|every (?:writer|creative|person) (?:faces|has) this|build confidence|small goals|exploration and experimentation|no judgment)\b/i
const STYLE_MISMATCH_OPENERS = /^(picture this|imagine this|let'?s (?:dive in|dig in|break this down|break down|walk through this)|here'?s how|let'?s focus on)/i
const MENU_PATTERNS = /\b(here are|a few|some (?:tips|ideas|options|strategies|steps|suggestions)|options:|strategies:|tips:)\b/i
const FEEDBACK_REQUEST_PATTERNS = /\b(blunt|honest|real|raw|harsh|brutal|candid|frank|tough)\s+(?:feedback|criticism|critique|assessment|opinion|take|truth|answer)/i
const CONCRETE_NEXT_MOVE_REQUEST = /\b(one (?:concrete|specific|pride[- ]costing|actual) (?:next|first)? ?(?:move|step|action|thing)|next move|next step|what should I (?:actually )?do (?:next|now|first|today))\b/i
const DIAGNOSIS_REQUEST = /\b(diagnos(?:is|e|ed|ing)?|what(?:'?s| is) (?:really |actually )?(?:wrong|the (?:real |actual )?problem|happening|going on|blocking)|pinpoint|root cause|real issue|actual issue)\b/i
const ACTION_VERB_PATTERN = /\b(send|write|writing|call|schedule|ask|tell|ship|test|draft|reply|post|commit|submit|open|close|cancel|start|finish|review|fix|deploy|email|message|share|publish|book|block|confront|show|admit)\b/i
const TIMEFRAME_PATTERN = /\b(today|tomorrow|this week|this morning|tonight|right now|within|by|before|monday|tuesday|wednesday|thursday|friday)\b/i
const SELF_MIRROR_START = /^(["“']?\s*)?(i\s+(?:am|'m|need|want|keep|usually|already|also|do)|my\s+)/i
const DIAGNOSIS_LANGUAGE = /\b(you are|you keep|you avoid|you hide|you protect|you are protecting|the problem is|the issue is|the pattern is|you need to stop|what you are doing)\b/i
const BLUNT_SOFTENING_PATTERNS = /\b(every (?:writer|creative|person) (?:faces|has) this|be kind to yourself|give yourself grace|build confidence|start with small goals|no judgment|exploration and experimentation|common challenge)\b/i
const PRAISE_LEADIN_PATTERNS = /^(you(?:'re| are) (?:diving into this|onto something|showing|bringing|already showing|clearly showing).{0,40}\b(?:clarity|awareness|insight|courage)|it'?s good that you\b)/i
const CHAT_OVERLAP_STOP_WORDS = new Set([
  'what', 'when', 'where', 'which', 'who', 'why', 'how', 'that', 'this', 'with', 'from',
  'have', 'will', 'your', 'about', 'they', 'them', 'there', 'their', 'already', 'usually',
  'want', 'need', 'kind', 'user', 'help', 'more', 'just', 'than', 'into', 'also',
])

export interface ChatTurnStyleSignals {
  directRequested: boolean
  briefRequested: boolean
  noFluffRequested: boolean
  stepwiseRequested: boolean
  bluntFeedbackRequested: boolean
  concreteNextMoveRequested: boolean
  diagnosisRequested: boolean
}

export interface ChatTurnQualityReport {
  promptVersion: string
  rawModelOutput: string
  finalResponse: string
  repaired: boolean
  repairCount: number
  styleSignals: ChatTurnStyleSignals
  validation: ReturnType<typeof createValidationReport>
  blockerReasons: string[]
  warnings: string[]
}

function detectStyleSignals(prompt: string): ChatTurnStyleSignals {
  const text = prompt.toLowerCase()
  return {
    directRequested: /\b(direct|blunt|straight|to the point|no fluff|stop (?:being|sounding) (?:so )?(?:generic|vague)|don'?t (?:be|sound) generic)\b/.test(text),
    briefRequested: /\b(brief|concise|short|quick answer|tldr)\b/.test(text),
    noFluffRequested: /\b(no fluff|skip the fluff|just the answer|cut the fluff|cut the (bs|bullshit|crap)|stop sugarcoating)\b/.test(text),
    stepwiseRequested: /\b(step by step|steps)\b/.test(text),
    bluntFeedbackRequested: FEEDBACK_REQUEST_PATTERNS.test(text),
    concreteNextMoveRequested: CONCRETE_NEXT_MOVE_REQUEST.test(text),
    diagnosisRequested: DIAGNOSIS_REQUEST.test(text),
  }
}

function startsWithGenericOpener(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return GENERIC_OPENERS.some((opener) => normalized.startsWith(opener))
}

function countListItems(text: string): number {
  return text.split('\n').filter((line) => /^\s*([-*]|\d+\.)\s+/.test(line)).length
}

function startsWithStyleMismatchOpener(response: string): boolean {
  return STYLE_MISMATCH_OPENERS.test(response.trim())
}

function hasPersonaMetaLeakage(response: string): boolean {
  return PERSONA_META_PATTERNS.test(response)
}

function isGenericCoachingResponse(response: string): boolean {
  const listCount = countListItems(response)
  const hasCoachingPattern = GENERIC_COACHING_PATTERNS.test(response)
  const hasMenuPattern = MENU_PATTERNS.test(response)
  const hasMismatchOpener = startsWithStyleMismatchOpener(response)
  return hasMismatchOpener || (hasCoachingPattern && listCount >= 2) || (hasCoachingPattern && hasMenuPattern)
}

function containsMultipleCompetingMoves(response: string): boolean {
  if (countListItems(response) >= 2) {
    return true
  }

  const lower = response.toLowerCase()
  return MENU_PATTERNS.test(lower) || /\b(?:afterward|afterwards|then|next|and then)\b/.test(lower)
}

function missingConcreteNextMove(response: string): boolean {
  const lower = response.toLowerCase()
  const hasAction = ACTION_VERB_PATTERN.test(lower)
  const hasTimeframe = TIMEFRAME_PATTERN.test(lower)
  return !hasAction || !hasTimeframe || containsMultipleCompetingMoves(response)
}

function compressToSingleNextMove(response: string): string {
  const sentences = response
    .replace(/\*\*/g, '')
    .replace(/\b(?:concrete next move|next move|next step|action)\s*:\s*/ig, '')
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter(Boolean)

  if (sentences.length === 0) {
    return response
  }

  const diagnosisSentence = sentences.find((sentence) => DIAGNOSIS_LANGUAGE.test(sentence) && !TIMEFRAME_PATTERN.test(sentence))
    || sentences.find((sentence) => !startsWithGenericOpener(sentence) && sentence.length > 20 && !TIMEFRAME_PATTERN.test(sentence))
    || sentences.find((sentence) => !startsWithGenericOpener(sentence))
    || sentences[0]
  const actionSentence = sentences.find((sentence) => ACTION_VERB_PATTERN.test(sentence) && TIMEFRAME_PATTERN.test(sentence))
    || sentences.find((sentence) => ACTION_VERB_PATTERN.test(sentence))

  if (!actionSentence) {
    return response
  }

  const singleAction = actionSentence
    .replace(/\b(?:then|afterward|afterwards|and then)\b[\s\S]*$/i, '')
    .trim()
  const normalizedAction = /[.!?]$/.test(singleAction) ? singleAction : `${singleAction}.`

  if (diagnosisSentence === actionSentence) {
    return normalizedAction
  }

  return `${diagnosisSentence} ${normalizedAction}`.trim()
}

interface ChatCandidateState {
  response: string
  validation: ReturnType<typeof createValidationReport>
  softWarnings: string[]
}

function chatCandidatePenalty(candidate: ChatCandidateState, styleSignals: ChatTurnStyleSignals) {
  let penalty = candidate.validation.hardFailureFlags.length * 20 + candidate.validation.softWarnings.length * 4

  if (styleSignals.concreteNextMoveRequested && candidate.validation.hardFailureFlags.includes(OUTPUT_QUALITY_FLAGS.missingConcreteNextMove)) {
    penalty += 30
  }

  if ((styleSignals.bluntFeedbackRequested || styleSignals.diagnosisRequested) && candidate.validation.hardFailureFlags.includes(OUTPUT_QUALITY_FLAGS.ignoredDirectFeedbackRequest)) {
    penalty += 18
  }

  if (candidate.validation.hardFailureFlags.includes(OUTPUT_QUALITY_FLAGS.selfMirroringInsteadOfAnswer)) {
    penalty += 35
  }

  if (candidate.validation.hardFailureFlags.includes(OUTPUT_QUALITY_FLAGS.genericOpenerViolatesDirectness)) {
    penalty += 6
  }

  return penalty
}

function pickPreferredChatCandidate(candidates: ChatCandidateState[], styleSignals: ChatTurnStyleSignals): ChatCandidateState | null {
  if (candidates.length === 0) {
    return null
  }

  return [...candidates].sort((left, right) => {
    const penaltyGap = chatCandidatePenalty(left, styleSignals) - chatCandidatePenalty(right, styleSignals)
    if (penaltyGap !== 0) {
      return penaltyGap
    }

    return left.response.length - right.response.length
  })[0]
}

function tokenizeForOverlap(text: string): string[] {
  return [...new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .split(/\s+/)
      .filter((word) => word.length >= 4 && !CHAT_OVERLAP_STOP_WORDS.has(word))
  )]
}

function calculatePromptOverlap(prompt: string, response: string): number {
  const promptTokens = tokenizeForOverlap(prompt)
  const responseTokens = tokenizeForOverlap(response)

  if (promptTokens.length === 0 || responseTokens.length === 0) {
    return 0
  }

  const responseTokenSet = new Set(responseTokens)
  const shared = promptTokens.filter((token) => responseTokenSet.has(token))
  return shared.length / Math.max(4, Math.min(promptTokens.length, responseTokens.length))
}

function isSelfMirroringInsteadOfAnswer(prompt: string, response: string, styleSignals: ChatTurnStyleSignals): boolean {
  if (!styleSignals.bluntFeedbackRequested && !styleSignals.diagnosisRequested) {
    return false
  }

  const overlap = calculatePromptOverlap(prompt, response)
  const startsInUserVoice = SELF_MIRROR_START.test(response.trim())
  const hasDirectDiagnosis = DIAGNOSIS_LANGUAGE.test(response)

  return startsInUserVoice && overlap >= 0.3 && !hasDirectDiagnosis
}

function contradictsDirectPreference(prompt: string, response: string, styleSignals: ChatTurnStyleSignals): boolean {
  if (!styleSignals.bluntFeedbackRequested) {
    return false
  }

  const promptLower = prompt.toLowerCase()
  const responseLower = response.toLowerCase()
  const rejectsSoftEncouragement = /\b(?:not|instead of)\s+soft encouragement\b/.test(promptLower)
    || /\bblunt feedback\b/.test(promptLower)
  const responseClaimsSoftPreference = /\b(?:prefer|want|need|find|found|finding)\s+(?:soft encouragement|encouragement|reassurance)\b/.test(responseLower)
    || /\bsoft encouragement\b.*\b(?:palatable|comfortable|easier|safer|better)\b/.test(responseLower)

  return rejectsSoftEncouragement && responseClaimsSoftPreference
}

function validateChatResponse(prompt: string, response: string) {
  const styleSignals = detectStyleSignals(prompt)
  const hardFailureFlags = detectTextLeakage(response)
  const softWarnings: string[] = []
  const anyDirectSignal = styleSignals.directRequested
    || styleSignals.noFluffRequested
    || styleSignals.bluntFeedbackRequested
    || styleSignals.diagnosisRequested
    || styleSignals.concreteNextMoveRequested

  if (!response.trim()) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.emptyChatResponse)
  }

  // Generic opener after directness request
  if (anyDirectSignal && startsWithGenericOpener(response)) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.genericOpenerViolatesDirectness)
  }

  // Persona-meta leakage ("here's a revised version that aligns with the persona")
  if (hasPersonaMetaLeakage(response)) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.genericMetaRewriteResponse)
  }

  // Blunt feedback was requested but response falls into generic coaching
  if (styleSignals.bluntFeedbackRequested && isGenericCoachingResponse(response)) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.ignoredDirectFeedbackRequest)
  }

  if (styleSignals.bluntFeedbackRequested && countListItems(response) >= 3) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.ignoredDirectFeedbackRequest)
  }

  if (styleSignals.bluntFeedbackRequested && BLUNT_SOFTENING_PATTERNS.test(response)) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.ignoredDirectFeedbackRequest)
  }

  if (isSelfMirroringInsteadOfAnswer(prompt, response, styleSignals)) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.selfMirroringInsteadOfAnswer)
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.ignoredDirectFeedbackRequest)
  }

  if (contradictsDirectPreference(prompt, response, styleSignals)) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.ignoredDirectFeedbackRequest)
  }

  // Concrete next move was requested but not provided
  if (styleSignals.concreteNextMoveRequested && missingConcreteNextMove(response)) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.missingConcreteNextMove)
  }

  // Specific diagnosis requested but got broad coaching
  if (styleSignals.diagnosisRequested && isGenericCoachingResponse(response)) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.broadCoachingWhenSpecificDiagnosisRequested)
  }

  if ((styleSignals.diagnosisRequested || styleSignals.bluntFeedbackRequested) && startsWithStyleMismatchOpener(response)) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.genericOpenerViolatesDirectness)
  }

  if ((styleSignals.diagnosisRequested || styleSignals.concreteNextMoveRequested) && PRAISE_LEADIN_PATTERNS.test(response.trim())) {
    hardFailureFlags.push(OUTPUT_QUALITY_FLAGS.genericOpenerViolatesDirectness)
  }

  // Brevity check
  if (anyDirectSignal && response.length > 900) {
    softWarnings.push('response_may_ignore_brevity')
  }

  // Over-structured for a direct request
  if (anyDirectSignal && countListItems(response) >= 6) {
    softWarnings.push('response_is_overstructured_for_direct_request')
  }

  // Generic coaching filler even without explicit directness request
  if (startsWithGenericOpener(response) && countListItems(response) >= 5) {
    softWarnings.push('generic_coaching_pattern')
  }

  const validation = createValidationReport({
    hardFailureFlags,
    softWarnings,
    validatorVersion: CHAT_PROMPT_VERSION,
  })

  return { styleSignals, validation, softWarnings }
}

function buildRepairInstructions(styleSignals: ChatTurnStyleSignals): string[] {
  const instructions: string[] = []

  // Always-on base instructions
  instructions.push('Keep the same factual meaning. Preserve any useful specifics.')
  instructions.push('Remove generic assistant filler. Write like a focused human collaborator who knows the user.')
  instructions.push('Never include meta-commentary about the persona, the AI system, or the response style itself.')

  if (styleSignals.directRequested || styleSignals.noFluffRequested || styleSignals.bluntFeedbackRequested) {
    instructions.push('Lead with the answer or diagnosis. No reassurance, no ceremony, no compliments before the point.')
    instructions.push('Do not soften the assessment. Name the likely avoidance pattern or real problem directly.')
  }

  if (styleSignals.bluntFeedbackRequested) {
    instructions.push('The user wants feedback that costs them pride, not validation. Be specific about what is weak and why.')
    instructions.push('Do not invert the user\'s preference. If they rejected soft encouragement, do not say they prefer encouragement or reassurance.')
  }

  if (styleSignals.concreteNextMoveRequested) {
    instructions.push('End with exactly one concrete next move anchored to a specific action and timeframe. Not a list, not a menu—one move.')
  }

  if (styleSignals.diagnosisRequested) {
    instructions.push('Give a sharp diagnosis with a specific root cause, not a list of general tips or broad coaching.')
  }

  if (styleSignals.briefRequested) {
    instructions.push('Keep it under 150 words unless detail is explicitly requested.')
  }

  if (styleSignals.stepwiseRequested) {
    instructions.push('Use an ordered step-by-step structure.')
  }

  // Anti-pattern instructions
  instructions.push('Avoid lists of tips, options, or suggestions unless the user explicitly asked for a list.')
  instructions.push('Do not mirror the user\'s request back to them as a paraphrase before answering.')
  instructions.push('Do not answer in the user\'s voice or as a rewritten self-summary.')

  return instructions
}

function buildConversationContextBlock(conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>): string {
  const trimmed = (conversationHistory || [])
    .slice(-4)
    .map((entry) => `${entry.role === 'user' ? 'User' : 'Assistant'}: ${entry.content.trim()}`)
    .filter((entry) => entry.length > 0)

  if (trimmed.length === 0) {
    return 'No recent conversation context provided.'
  }

  return trimmed.join('\n')
}

async function rewriteChatReply(params: {
  prompt: string
  draft: string
  styleSignals: ChatTurnStyleSignals
  llmConfig?: LLMConfig
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
  strictMode?: boolean
}) {
  const contextBlock = buildConversationContextBlock(params.conversationHistory)
  const strictFormatInstructions = params.strictMode
    ? [
        'Write in second person unless the user explicitly asked for first-person rewriting.',
        'Do not echo the user message as a self-summary.',
        ...(params.styleSignals.concreteNextMoveRequested
          ? [
              'Return exactly 2 short paragraphs.',
              'Paragraph 1 must name the actual avoidance pattern or root problem directly.',
              'Paragraph 2 must be exactly one sentence with one concrete next move using a verb, a target, and a timeframe.',
              'Do not add follow-up steps, after/then clauses, or reflection homework after the main action.',
            ]
          : [
              'Return 2-4 sentences total.',
              'Name what is weak or avoidant directly instead of rewriting the user message.',
            ]),
      ]
    : []

  return BaseChain.getInstance().generateResponse([
    new SystemMessage(
      `Rewrite one assistant reply for higher surface quality. Fix the specific issues listed below.\n${buildRepairInstructions(params.styleSignals).map((line) => `- ${line}`).join('\n')}${strictFormatInstructions.length ? `\n${strictFormatInstructions.map((line) => `- ${line}`).join('\n')}` : ''}`
    ),
    new HumanMessage(
      `Recent conversation context:\n${contextBlock}\n\nUser request:\n${params.prompt}\n\nDraft reply (has quality issues):\n${params.draft}\n\nReturn only the repaired reply. Do not explain the changes.`
    ),
  ], {
    ...(params.llmConfig || {}),
    temperature: params.strictMode ? 0.1 : 0.25,
    maxTokens: params.strictMode ? 240 : Math.max(220, Math.min(900, params.draft.length + 120)),
  })
}

export async function applyChatTurnQualityGate(params: {
  prompt: string
  response: string
  llmConfig?: LLMConfig
  conversationHistory?: Array<{ role: 'user' | 'assistant'; content: string }>
}): Promise<ChatTurnQualityReport> {
  const tracked = createPendingTrackedFields({
    promptVersion: CHAT_PROMPT_VERSION,
    rawModelOutput: {
      text: params.response,
      capturedAt: new Date().toISOString(),
      promptVersion: CHAT_PROMPT_VERSION,
      responseFormat: 'chat_markdown_v1',
    },
  })

  let finalResponse = params.response.trim()
  let repaired = false
  let repairCount = 0
  const candidates: ChatCandidateState[] = []
  let { styleSignals, validation, softWarnings } = validateChatResponse(params.prompt, finalResponse)
  candidates.push({
    response: finalResponse,
    validation,
    softWarnings,
  })

  if (!validation.pass) {
    const repairedResponse = await rewriteChatReply({
      prompt: params.prompt,
      draft: finalResponse,
      styleSignals,
      llmConfig: params.llmConfig,
      conversationHistory: params.conversationHistory,
    })

    if (repairedResponse.trim()) {
      finalResponse = repairedResponse.trim()
      repaired = true
      repairCount = 1
      ;({ styleSignals, validation, softWarnings } = validateChatResponse(params.prompt, finalResponse))
      candidates.push({
        response: finalResponse,
        validation,
        softWarnings,
      })
    }
  }

  if (!validation.pass && (styleSignals.bluntFeedbackRequested || styleSignals.diagnosisRequested || styleSignals.concreteNextMoveRequested)) {
    const stricterRepair = await rewriteChatReply({
      prompt: params.prompt,
      draft: finalResponse,
      styleSignals,
      llmConfig: params.llmConfig,
      conversationHistory: params.conversationHistory,
      strictMode: true,
    })

    if (stricterRepair.trim()) {
      finalResponse = stricterRepair.trim()
      repaired = true
      repairCount = Math.max(repairCount, 2)
      ;({ styleSignals, validation, softWarnings } = validateChatResponse(params.prompt, finalResponse))
      candidates.push({
        response: finalResponse,
        validation,
        softWarnings,
      })
    }
  }

  if (!validation.pass && styleSignals.concreteNextMoveRequested) {
    const compressedReply = compressToSingleNextMove(finalResponse)
    if (compressedReply.trim() && compressedReply.trim() !== finalResponse) {
      finalResponse = compressedReply.trim()
      repaired = true
      repairCount = Math.max(repairCount, 2)
      ;({ styleSignals, validation, softWarnings } = validateChatResponse(params.prompt, finalResponse))
      candidates.push({
        response: finalResponse,
        validation,
        softWarnings,
      })
    }
  }

  if (!validation.pass) {
    const preferredCandidate = pickPreferredChatCandidate(candidates, styleSignals)
    if (preferredCandidate && preferredCandidate.response !== finalResponse) {
      finalResponse = preferredCandidate.response
      validation = preferredCandidate.validation
      softWarnings = preferredCandidate.softWarnings
    }
  }

  const gate = applyFinalQualityGate({
    validation,
    evaluation: {
      pass: validation.pass,
      overallScore: validation.pass ? 100 : 60,
      dimensions: {
        structural: { score: validation.pass ? 100 : 55, rationale: 'Deterministic chat surface validation.' },
        style: {
          score: softWarnings.length === 0 ? 96 : 78,
          rationale: softWarnings.length === 0 ? 'Aligned with current style constraints.' : softWarnings.join(', '),
        },
      },
      hardFailureFlags: validation.hardFailureFlags,
    },
    thresholds: {
      overallScoreMinimum: 80,
      dimensionFloor: 70,
    },
  })

  return {
    promptVersion: tracked.promptVersion || CHAT_PROMPT_VERSION,
    rawModelOutput: tracked.rawModelOutput?.text || params.response,
    finalResponse,
    repaired,
    repairCount,
    styleSignals,
    validation,
    blockerReasons: gate.blockerReasons,
    warnings: softWarnings,
  }
}
