import { parseArgs, collectAuditCases, summarizeArtifactSessions, summarizeChatDirectness, summarizeProfileRun, summarizeScenarioRun, summarizeSemanticMemories, readJson } from './shared.mjs'

function percent(numerator, denominator) {
  if (!denominator) return null
  return Number(((numerator / denominator) * 100).toFixed(2))
}

function summarizeBundle(bundle) {
  const collected = collectAuditCases(bundle)
  const artifactSessions = [
    ...summarizeArtifactSessions(collected.creative, 'creative'),
    ...summarizeArtifactSessions(collected.journal, 'journal'),
    ...summarizeArtifactSessions(collected.dream, 'dream'),
  ]
  const profileRuns = collected.profile.map(summarizeProfileRun)
  const scenarioRuns = collected.scenario.map(summarizeScenarioRun)
  const chat = summarizeChatDirectness(collected.messages)
  const memories = summarizeSemanticMemories(collected.memories)

  const persistedMalformedCreativeOrJournal = artifactSessions
    .filter((session) => session.feature === 'creative' || session.feature === 'journal')
    .flatMap((session) => session.persistedMalformed)

  return {
    artifactSessionCount: artifactSessions.length,
    structuralPassRate: percent(
      artifactSessions.filter((session) => session.passing).length,
      artifactSessions.length,
    ),
    persistedMalformedCreativeOrJournalCount: persistedMalformedCreativeOrJournal.length,
    persistedMalformedCreativeOrJournal,
    unsafeProfileReadyRuns: profileRuns.filter((run) => run.unsafeReadyState).length,
    lowActionabilityRuns: scenarioRuns.filter((run) => run.lowActionability).length,
    lowActionabilityRate: percent(
      scenarioRuns.filter((run) => run.lowActionability).length,
      scenarioRuns.length,
    ),
    directnessCaseCount: chat.evaluatedPairs,
    directnessViolationRate: chat.violationRate === null ? null : Number((chat.violationRate * 100).toFixed(2)),
    semanticMemoryCount: memories.semanticCount,
    artifactSessions,
    profileRuns,
    scenarioRuns,
    chat,
    memories,
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const beforePath = args.before || 'tmp/agent-output-audit-ari-kestrel.json'
  const afterPath = args.after

  if (!afterPath) {
    throw new Error('--after is required')
  }

  const before = summarizeBundle(await readJson(beforePath))
  const after = summarizeBundle(await readJson(afterPath))

  console.log(JSON.stringify({
    script: 'compare-output-audits',
    comparedAt: new Date().toISOString(),
    before: {
      path: beforePath,
      metrics: {
        structuralPassRate: before.structuralPassRate,
        persistedMalformedCreativeOrJournalCount: before.persistedMalformedCreativeOrJournalCount,
        unsafeProfileReadyRuns: before.unsafeProfileReadyRuns,
        lowActionabilityRate: before.lowActionabilityRate,
        directnessCaseCount: before.directnessCaseCount,
        directnessViolationRate: before.directnessViolationRate,
        semanticMemoryCount: before.semanticMemoryCount,
      },
    },
    after: {
      path: afterPath,
      metrics: {
        structuralPassRate: after.structuralPassRate,
        persistedMalformedCreativeOrJournalCount: after.persistedMalformedCreativeOrJournalCount,
        unsafeProfileReadyRuns: after.unsafeProfileReadyRuns,
        lowActionabilityRate: after.lowActionabilityRate,
        directnessCaseCount: after.directnessCaseCount,
        directnessViolationRate: after.directnessViolationRate,
        semanticMemoryCount: after.semanticMemoryCount,
      },
    },
    delta: {
      structuralPassRate: (after.structuralPassRate ?? 0) - (before.structuralPassRate ?? 0),
      persistedMalformedCreativeOrJournalCount: after.persistedMalformedCreativeOrJournalCount - before.persistedMalformedCreativeOrJournalCount,
      unsafeProfileReadyRuns: after.unsafeProfileReadyRuns - before.unsafeProfileReadyRuns,
      lowActionabilityRate: (after.lowActionabilityRate ?? 0) - (before.lowActionabilityRate ?? 0),
      directnessViolationRate: after.directnessViolationRate === null || before.directnessViolationRate === null
        ? null
        : after.directnessViolationRate - before.directnessViolationRate,
      semanticMemoryCount: after.semanticMemoryCount - before.semanticMemoryCount,
    },
    afterDetails: {
      malformedCreativeOrJournal: after.persistedMalformedCreativeOrJournal,
      profileRuns: after.profileRuns,
      scenarioRuns: after.scenarioRuns,
      chat: after.chat,
      memories: after.memories,
    },
  }, null, 2))
}

main().catch((error) => {
  console.error('[quality:compare-audits]', error)
  process.exitCode = 1
})
