import {
  detectDuplicatedFieldValues,
  detectTextLeakage,
  OUTPUT_QUALITY_FLAGS,
} from './flags'
import type {
  OutputQualitySourceRef,
  OutputQualityValidationReport,
  SemanticMemoryFields,
} from '@/types/outputQuality'

const DEFAULT_VALIDATOR_VERSION = 'phase0-shared-foundation'

export function validateSourceRefs(sourceRefs: OutputQualitySourceRef[]): string[] {
  return sourceRefs.length > 0
    ? []
    : [OUTPUT_QUALITY_FLAGS.missingSourceRef]
}

export function validateRequiredTextFields(fields: Record<string, string | undefined | null>): string[] {
  return Object.entries(fields)
    .filter(([, value]) => !value?.trim())
    .map(([field]) => `${OUTPUT_QUALITY_FLAGS.emptyRequiredField}:${field}`)
}

export function validateSharedArtifactText(fields: Record<string, string | undefined | null>): string[] {
  const values = Object.values(fields)
  const leakageFlags = values.flatMap((value) => detectTextLeakage(value || ''))
  const duplicateFlags = detectDuplicatedFieldValues(values)

  return [...new Set([...leakageFlags, ...duplicateFlags])]
}

export function validateSemanticMemoryFields(
  fields: SemanticMemoryFields,
  options?: {
    requireEvidence?: boolean
    minimumConfidence?: number
  }
): string[] {
  const failures: string[] = []

  if (!fields.canonicalKey?.trim()) {
    failures.push('missing_canonical_key')
  }

  if (!fields.canonicalValue?.trim()) {
    failures.push('missing_canonical_value')
  }

  if (typeof fields.confidence === 'number' && typeof options?.minimumConfidence === 'number' && fields.confidence < options.minimumConfidence) {
    failures.push('confidence_below_minimum')
  }

  if (options?.requireEvidence && (!fields.evidenceRefs || fields.evidenceRefs.length === 0)) {
    failures.push('missing_evidence_refs')
  }

  return failures
}

export function createValidationReport(params: {
  hardFailureFlags?: string[]
  softWarnings?: string[]
  validatorVersion?: string
}): OutputQualityValidationReport {
  const hardFailureFlags = [...new Set(params.hardFailureFlags || [])]
  const softWarnings = [...new Set(params.softWarnings || [])]

  return {
    pass: hardFailureFlags.length === 0,
    hardFailureFlags,
    softWarnings,
    validatorVersion: params.validatorVersion || DEFAULT_VALIDATOR_VERSION,
  }
}
