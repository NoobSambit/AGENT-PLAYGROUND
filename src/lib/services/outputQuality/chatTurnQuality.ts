import { HumanMessage, SystemMessage } from '@langchain/core/messages'
import type { LLMConfig } from '@/lib/langchain/baseChain'
import { BaseChain } from '@/lib/langchain/baseChain'
import { applyFinalQualityGate } from './evaluators'
import { createPendingTrackedFields } from './contracts'
import { createValidationReport } from './validators'
import { detectTextLeakage } from './flags'

const CHAT_PROMPT_VERSION = 'phase2-chat-quality-v1'
const GENERIC_OPENERS = [
  'absolutely',
  'certainly',
  'sure',
  'of course',
  'definitely',
  'i’d be happy to',
  "i'd be happy to",
  'happy to help',
]

export interface ChatTurnStyleSignals {
  directRequested: boolean
  briefRequested: boolean
  noFluffRequested: boolean
  stepwiseRequested: boolean
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
    directRequested: /\b(direct|blunt|straight|to the point)\b/.test(text),
    briefRequested: /\b(brief|concise|short|quick answer|tldr)\b/.test(text),
    noFluffRequested: /\b(no fluff|skip the fluff|just the answer)\b/.test(text),
    stepwiseRequested: /\b(step by step|steps)\b/.test(text),
  }
}

function startsWithGenericOpener(text: string): boolean {
  const normalized = text.trim().toLowerCase()
  return GENERIC_OPENERS.some((opener) => normalized.startsWith(opener))
}

function countListItems(text: string): number {
  return text.split('\n').filter((line) => /^\s*([-*]|\d+\.)\s+/.test(line)).length
}

function validateChatResponse(prompt: string, response: string) {
  const styleSignals = detectStyleSignals(prompt)
  const hardFailureFlags = detectTextLeakage(response)
  const softWarnings: string[] = []

  if (!response.trim()) {
    hardFailureFlags.push('empty_chat_response')
  }

  if ((styleSignals.directRequested || styleSignals.noFluffRequested) && startsWithGenericOpener(response)) {
    hardFailureFlags.push('generic_opener_violates_directness')
  }

  if ((styleSignals.directRequested || styleSignals.briefRequested || styleSignals.noFluffRequested) && response.length > 900) {
    softWarnings.push('response_may_ignore_brevity')
  }

  if ((styleSignals.directRequested || styleSignals.noFluffRequested) && countListItems(response) >= 6) {
    softWarnings.push('response_is_overstructured_for_direct_request')
  }

  const validation = createValidationReport({
    hardFailureFlags,
    softWarnings,
    validatorVersion: CHAT_PROMPT_VERSION,
  })

  return { styleSignals, validation, softWarnings }
}

function buildRepairInstructions(styleSignals: ChatTurnStyleSignals): string[] {
  const instructions = [
    'Keep the same factual meaning and preserve any useful specifics.',
    'Remove generic assistant filler and write like a focused human collaborator.',
  ]

  if (styleSignals.directRequested || styleSignals.noFluffRequested) {
    instructions.push('Lead with the answer. Do not preface with reassurance or ceremony.')
  }

  if (styleSignals.briefRequested) {
    instructions.push('Keep it concise.')
  }

  if (styleSignals.stepwiseRequested) {
    instructions.push('Use an ordered step-by-step structure.')
  }

  return instructions
}

export async function applyChatTurnQualityGate(params: {
  prompt: string
  response: string
  llmConfig?: LLMConfig
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
  let { styleSignals, validation, softWarnings } = validateChatResponse(params.prompt, finalResponse)

  if (!validation.pass) {
    const repairedResponse = await BaseChain.getInstance().generateResponse([
      new SystemMessage(
        `Rewrite one assistant reply for higher surface quality.\n${buildRepairInstructions(styleSignals).map((line) => `- ${line}`).join('\n')}`
      ),
      new HumanMessage(
        `User request:\n${params.prompt}\n\nDraft reply:\n${finalResponse}\n\nReturn only the repaired reply.`
      ),
    ], {
      ...(params.llmConfig || {}),
      temperature: 0.25,
      maxTokens: Math.max(220, Math.min(900, finalResponse.length + 120)),
    })

    if (repairedResponse.trim()) {
      finalResponse = repairedResponse.trim()
      repaired = true
      repairCount = 1
      ;({ styleSignals, validation, softWarnings } = validateChatResponse(params.prompt, finalResponse))
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
