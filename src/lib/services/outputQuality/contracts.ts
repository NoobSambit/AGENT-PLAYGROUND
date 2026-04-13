import { deriveQualityStatus, getLegacyNormalizationStatus } from './status'
import type {
  OutputQualityNormalizationReport,
  OutputQualityTrackedFields,
} from '@/types/outputQuality'

const PROMPT_VERSION = 'phase0-shared-foundation'

export function createLegacyTrackedFields(
  overrides?: Partial<OutputQualityTrackedFields>
): Required<Pick<OutputQualityTrackedFields, 'qualityStatus' | 'repairCount'>> & OutputQualityTrackedFields {
  return {
    qualityStatus: 'legacy_unvalidated',
    repairCount: 0,
    ...overrides,
  }
}

export function createPendingTrackedFields(
  overrides?: Partial<OutputQualityTrackedFields>
): Required<Pick<OutputQualityTrackedFields, 'qualityStatus' | 'repairCount' | 'promptVersion'>> & OutputQualityTrackedFields {
  return {
    qualityStatus: 'pending',
    repairCount: 0,
    promptVersion: PROMPT_VERSION,
    ...overrides,
  }
}

export function syncTrackedQualityState(fields: OutputQualityTrackedFields & {
  normalization?: OutputQualityNormalizationReport
}, options?: {
  evaluationPass?: boolean
}): OutputQualityTrackedFields {
  return {
    ...fields,
    qualityStatus: deriveQualityStatus({
      validationPass: fields.validation?.pass,
      evaluationPass: options?.evaluationPass,
      normalizationStatus: fields.normalization?.status,
      legacy: !fields.normalization && !fields.validation && !fields.rawModelOutput,
    }),
    repairCount: fields.repairCount ?? 0,
    promptVersion: fields.promptVersion || PROMPT_VERSION,
    normalization: fields.normalization
      ? {
          ...fields.normalization,
          status: getLegacyNormalizationStatus(fields.normalization.status),
          parser: fields.normalization.parser || 'direct_text',
        }
      : fields.normalization,
  }
}
