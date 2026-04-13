const CODE_FENCE_PATTERN = /```/
const JSON_WRAPPER_PATTERN = /^\s*[\[{]/
const FIELD_LABEL_PATTERN = /(^|\n)\s*(title|summary|content)\s*:/i

export const OUTPUT_QUALITY_FLAGS = {
  codeFenceLeakage: 'code_fence_leakage',
  jsonWrapperLeakage: 'json_wrapper_leakage',
  schemaLabelLeakage: 'schema_label_leakage',
  emptyRequiredField: 'empty_required_field',
  duplicatedFieldValues: 'duplicated_field_values',
  missingSourceRef: 'missing_source_ref',
  invalidStageTransition: 'invalid_stage_transition',
} as const

export type OutputQualityFlag = typeof OUTPUT_QUALITY_FLAGS[keyof typeof OUTPUT_QUALITY_FLAGS]

export function detectTextLeakage(value: string): OutputQualityFlag[] {
  const flags: OutputQualityFlag[] = []

  if (CODE_FENCE_PATTERN.test(value)) {
    flags.push(OUTPUT_QUALITY_FLAGS.codeFenceLeakage)
  }

  if (JSON_WRAPPER_PATTERN.test(value)) {
    flags.push(OUTPUT_QUALITY_FLAGS.jsonWrapperLeakage)
  }

  if (FIELD_LABEL_PATTERN.test(value)) {
    flags.push(OUTPUT_QUALITY_FLAGS.schemaLabelLeakage)
  }

  return flags
}

export function detectDuplicatedFieldValues(values: Array<string | undefined | null>): OutputQualityFlag[] {
  const normalized = values
    .map((value) => value?.trim().toLowerCase())
    .filter((value): value is string => Boolean(value))

  if (normalized.length < 2) {
    return []
  }

  return new Set(normalized).size === 1
    ? [OUTPUT_QUALITY_FLAGS.duplicatedFieldValues]
    : []
}
