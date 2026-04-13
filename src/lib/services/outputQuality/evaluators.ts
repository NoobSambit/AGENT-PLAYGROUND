import type {
  OutputQualityEvaluationReport,
  OutputQualityStatus,
  OutputQualityValidationReport,
} from '@/types/outputQuality'

export interface FinalQualityGateDecision {
  pass: boolean
  qualityStatus: OutputQualityStatus
  blockerReasons: string[]
}

export function applyFinalQualityGate(params: {
  validation?: OutputQualityValidationReport
  evaluation?: Pick<OutputQualityEvaluationReport, 'pass' | 'overallScore' | 'dimensions' | 'hardFailureFlags'>
  thresholds: {
    overallScoreMinimum: number
    dimensionFloor: number
  }
  extraHardFailureFlags?: string[]
}): FinalQualityGateDecision {
  const blockerReasons: string[] = []
  const hardFailureFlags = [
    ...(params.validation?.hardFailureFlags || []),
    ...(params.evaluation?.hardFailureFlags || []),
    ...(params.extraHardFailureFlags || []),
  ]

  if (!params.validation?.pass) {
    blockerReasons.push('validation_failed')
  }

  if (!params.evaluation?.pass) {
    blockerReasons.push('evaluation_failed')
  }

  if (typeof params.evaluation?.overallScore === 'number' && params.evaluation.overallScore < params.thresholds.overallScoreMinimum) {
    blockerReasons.push('overall_score_below_threshold')
  }

  const dimensionFailures = Object.values(params.evaluation?.dimensions || {}).filter(
    (dimension) => dimension.score < params.thresholds.dimensionFloor
  )
  if (dimensionFailures.length > 0) {
    blockerReasons.push('dimension_floor_failed')
  }

  if (hardFailureFlags.length > 0) {
    blockerReasons.push('hard_failure_flags_present')
  }

  return {
    pass: blockerReasons.length === 0,
    qualityStatus: blockerReasons.length === 0 ? 'passed' : 'failed',
    blockerReasons: [...new Set(blockerReasons)],
  }
}
