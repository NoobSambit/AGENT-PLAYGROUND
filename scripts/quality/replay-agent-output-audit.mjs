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

function flattenArtifactSessions(sessions) {
  return sessions.flatMap((session) => session.analyzed)
}

async function main() {
  const args = parseArgs(process.argv.slice(2))
  const auditPath = args.audit || 'tmp/agent-output-audit-ari-kestrel.json'
  const provider = args.provider || QUALITY_BASELINE_PROVIDER
  const model = args.model || QUALITY_BASELINE_MODEL
  const audit = await readJson(auditPath)
  const collected = collectAuditCases(audit)

  const creativeSessions = summarizeArtifactSessions(collected.creative, 'creative')
  const journalSessions = summarizeArtifactSessions(collected.journal, 'journal')
  const dreamSessions = summarizeArtifactSessions(collected.dream, 'dream')
  const profile = collected.profile.map(summarizeProfileRun)
  const scenario = collected.scenario.map(summarizeScenarioRun)
  const chat = summarizeChatDirectness(collected.messages)
  const memories = summarizeSemanticMemories(collected.memories)

  const artifactRecords = [
    ...flattenArtifactSessions(creativeSessions),
    ...flattenArtifactSessions(journalSessions),
    ...flattenArtifactSessions(dreamSessions),
  ]

  const persistedMalformedArtifacts = artifactRecords.filter(
    (record) => record.persisted && !record.structurallyValid
  )

  const sessionSummaries = [...creativeSessions, ...journalSessions, ...dreamSessions]

  console.log(JSON.stringify({
    script: 'replay-agent-output-audit',
    auditedAt: new Date().toISOString(),
    auditPath,
    baseline: { provider, model },
    summary: {
      artifactSessionCount: sessionSummaries.length,
      structurallyPassingSessions: sessionSummaries.filter((session) => session.passing).length,
      persistedMalformedArtifactCount: persistedMalformedArtifacts.length,
      profileUnsafeReadyRuns: profile.filter((run) => run.unsafeReadyState).length,
      scenarioLowActionabilityRuns: scenario.filter((run) => run.lowActionability).length,
      semanticMemoryCount: memories.semanticCount,
      directnessCases: chat.evaluatedPairs,
    },
    creativeSessions,
    journalSessions,
    dreamSessions,
    persistedMalformedArtifacts,
    profile,
    scenario,
    chat,
    memories,
  }, null, 2))
}

main().catch((error) => {
  console.error('[quality:replay]', error)
  process.exitCode = 1
})
