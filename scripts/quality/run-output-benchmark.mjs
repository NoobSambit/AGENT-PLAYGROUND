import {
  QUALITY_BASELINE_MODEL,
  QUALITY_BASELINE_PROVIDER,
  collectAuditCases,
  parseArgs,
  readJson,
  summarizeArtifactSessions,
  summarizeChatDirectness,
  summarizeProfileRun,
  summarizeScenarioRun,
  summarizeSemanticMemories,
} from './shared.mjs'

function percent(numerator, denominator) {
  if (!denominator) return null
  return Number(((numerator / denominator) * 100).toFixed(2))
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const auditPath = args.audit || 'tmp/agent-output-audit-ari-kestrel.json'
  const provider = args.provider || QUALITY_BASELINE_PROVIDER
  const model = args.model || QUALITY_BASELINE_MODEL
  const audit = await readJson(auditPath)
  const collected = collectAuditCases(audit)

  const artifactSessions = [
    ...summarizeArtifactSessions(collected.creative, 'creative'),
    ...summarizeArtifactSessions(collected.journal, 'journal'),
    ...summarizeArtifactSessions(collected.dream, 'dream'),
  ]
  const profileRuns = collected.profile.map(summarizeProfileRun)
  const scenarioRuns = collected.scenario.map(summarizeScenarioRun)
  const chat = summarizeChatDirectness(collected.messages)
  const memories = summarizeSemanticMemories(collected.memories)

  const totalArtifactSessions = artifactSessions.length
  const structurallyPassingSessions = artifactSessions.filter((session) => session.passing).length
  const persistedMalformedArtifactCount = artifactSessions
    .flatMap((session) => session.persistedMalformed)
    .length
  const persistedMalformedCreativeOrJournal = artifactSessions
    .filter((session) => session.feature === 'creative' || session.feature === 'journal')
    .flatMap((session) => session.persistedMalformed)
    .length
  const lowActionabilityRuns = scenarioRuns.filter((run) => run.lowActionability).length
  const directnessViolationRate = chat.violationRate === null
    ? null
    : Number((chat.violationRate * 100).toFixed(2))

  const exitCriteria = {
    noMalformedPersistedCreativeOrJournalArtifacts: {
      pass: persistedMalformedCreativeOrJournal === 0,
      actual: persistedMalformedCreativeOrJournal,
      required: 0,
    },
    profileFailedRunsDoNotReachReadyState: {
      pass: profileRuns.every((run) => !run.unsafeReadyState),
      actual: profileRuns.filter((run) => run.unsafeReadyState).length,
      required: 0,
    },
    replayHasNinetyPercentStructuralPassRate: {
      pass: structurallyPassingSessions / Math.max(totalArtifactSessions, 1) >= 0.9,
      actual: percent(structurallyPassingSessions, totalArtifactSessions),
      required: 90,
    },
    scenarioLowActionabilityRateUnderTenPercent: {
      pass: lowActionabilityRuns / Math.max(scenarioRuns.length, 1) < 0.1,
      actual: percent(lowActionabilityRuns, scenarioRuns.length),
      required: '< 10',
    },
    chatGenericOpenerViolationsUnderFivePercentAfterDirectnessRequest: {
      pass: directnessViolationRate !== null && directnessViolationRate < 5,
      actual: directnessViolationRate,
      required: '< 5',
      note: chat.evaluatedPairs === 0
        ? 'No explicit directness-request benchmark cases were present in the supplied audit fixture.'
        : undefined,
    },
    semanticMemoryRecallAvailable: {
      pass: memories.semanticCount > 0,
      actual: memories.semanticCount,
      required: '> 0 semantic memories',
    },
  }

  console.log(JSON.stringify({
    script: 'run-output-benchmark',
    benchmarkedAt: new Date().toISOString(),
    auditPath,
    baseline: { provider, model },
    metrics: {
      totalArtifactSessions,
      structurallyPassingSessions,
      structuralPassRate: percent(structurallyPassingSessions, totalArtifactSessions),
      persistedMalformedArtifactCount,
      scenarioRunCount: scenarioRuns.length,
      lowActionabilityRuns,
      lowActionabilityRate: percent(lowActionabilityRuns, scenarioRuns.length),
      directnessCaseCount: chat.evaluatedPairs,
      directnessViolationRate,
      semanticMemoryCount: memories.semanticCount,
    },
    exitCriteria,
    artifactSessions,
    profileRuns,
    scenarioRuns,
    chat,
    memories,
  }, null, 2))
}

main().catch((error) => {
  console.error('[quality:benchmark]', error)
  process.exitCode = 1
})
