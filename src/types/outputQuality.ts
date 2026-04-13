export type OutputQualityStatus =
  | 'legacy_unvalidated'
  | 'pending'
  | 'passed'
  | 'failed'

export type OutputNormalizationStatus =
  | 'normalized'
  | 'repaired'
  | 'failed'
  | 'legacy_unvalidated'

export type OutputNormalizationParser =
  | 'strict_json'
  | 'extracted_json'
  | 'labeled_sections'
  | 'direct_text'

export type OutputArtifactRole =
  | 'draft'
  | 'repair'
  | 'final'
  | 'published'

export interface OutputQualitySourceRef {
  id: string
  sourceType: string
  label: string
  reason: string
  linkedEntityId?: string
}

export interface OutputQualityRawModelOutput {
  text: string
  parserNotes?: string[]
  capturedAt?: string
  responseFormat?: string
  promptVersion?: string
}

export interface OutputQualityNormalizationReport {
  status: OutputNormalizationStatus
  parser: OutputNormalizationParser
  violations: string[]
  repairedFromId?: string
}

export interface OutputQualityValidationReport {
  pass: boolean
  hardFailureFlags: string[]
  softWarnings: string[]
  validatorVersion: string
}

export interface OutputQualityDimensionScore {
  score: number
  rationale: string
}

export interface OutputQualityEvaluationReport {
  pass: boolean
  overallScore: number
  dimensions: Record<string, OutputQualityDimensionScore>
  strengths: string[]
  weaknesses: string[]
  repairInstructions: string[]
  evaluatorSummary: string
  evaluatorVersion: string
  hardFailureFlags?: string[]
}

export interface OutputQualityTrackedFields {
  qualityStatus?: OutputQualityStatus
  promptVersion?: string
  repairCount?: number
  rawModelOutput?: OutputQualityRawModelOutput
  normalization?: OutputQualityNormalizationReport
  validation?: OutputQualityValidationReport
  sourceRefs?: OutputQualitySourceRef[]
}

export interface OutputQualityArtifactFields extends OutputQualityTrackedFields {
  artifactRole?: OutputArtifactRole
  normalizationStatus?: OutputNormalizationStatus
  qualityScore?: number
}

export interface SemanticMemoryFields {
  canonicalKey?: string
  canonicalValue?: string
  confidence?: number
  evidenceRefs?: string[]
  supersedes?: string[]
  lastConfirmedAt?: string
}
