import type {
  OutputNormalizationStatus,
  OutputQualityStatus,
} from '@/types/outputQuality'

const QUALITY_STATUS_TRANSITIONS: Record<OutputQualityStatus, OutputQualityStatus[]> = {
  legacy_unvalidated: ['pending', 'passed', 'failed'],
  pending: ['passed', 'failed'],
  passed: ['failed'],
  failed: ['pending', 'passed'],
}

export function canTransitionQualityStatus(from: OutputQualityStatus, to: OutputQualityStatus): boolean {
  return QUALITY_STATUS_TRANSITIONS[from]?.includes(to) || false
}

export function deriveQualityStatus(params: {
  validationPass?: boolean
  evaluationPass?: boolean
  normalizationStatus?: OutputNormalizationStatus
  legacy?: boolean
}): OutputQualityStatus {
  if (params.legacy) {
    return 'legacy_unvalidated'
  }

  if (params.validationPass === true && params.evaluationPass === true) {
    return 'passed'
  }

  if (params.validationPass === false || params.evaluationPass === false || params.normalizationStatus === 'failed') {
    return 'failed'
  }

  return 'pending'
}

export function getLegacyNormalizationStatus(value?: OutputNormalizationStatus): OutputNormalizationStatus {
  return value || 'legacy_unvalidated'
}
