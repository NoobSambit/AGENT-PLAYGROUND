'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Circle,
  FlaskConical,
  Gauge,
  History,
  PauseCircle,
  Play,
  Swords,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { buildLLMPreferenceHeaders, getClientModelForProvider, LLM_PROVIDER_LABELS } from '@/lib/llm/clientPreference'
import { useLLMPreferenceStore } from '@/stores/llmPreferenceStore'
import type {
  AgentRecord,
  ChallengeEvent,
  ChallengeExecutionBudget,
  ChallengeArenaFollowupCandidate,
  ChallengeLabBootstrap,
  ChallengeParticipantResult,
  ChallengeRun,
  ChallengeRunDetail,
  ChallengeRunSummary,
  ChallengeStage,
  ChallengeTemplate,
  ChallengeTemplateId,
} from '@/types/database'

interface ChallengeLabProps {
  agentId: string
  agentName: string
  agents: AgentRecord[]
  activeModel?: string
}

const STAGES: ChallengeStage[] = [
  'compose',
  'prepare_context',
  'assign_roles',
  'execute_turns',
  'evaluate_outputs',
  'synthesize_relationship_evidence',
  'report',
  'completed',
]

const STAGE_LABELS: Record<ChallengeStage, string> = {
  compose: 'Compose',
  prepare_context: 'Prepare Context',
  assign_roles: 'Assign Roles',
  execute_turns: 'Execute Turns',
  evaluate_outputs: 'Evaluate Outputs',
  synthesize_relationship_evidence: 'Relationship Evidence',
  report: 'Report',
  completed: 'Completed',
  failed: 'Failed',
}

function formatTemplateId(id: string) {
  return id.replace(/_/g, ' ')
}

function templateRequiresPair(template?: ChallengeTemplate | null) {
  return Boolean(template && template.minParticipants === 2)
}

function isRunning(run?: ChallengeRun | null) {
  return run?.status === 'running'
}

export function ChallengeLab({ agentId, agentName, agents, activeModel }: ChallengeLabProps) {
  const selectedProvider = useLLMPreferenceStore((state) => state.provider)
  const providerModel = activeModel || getClientModelForProvider(selectedProvider)

  const [bootstrap, setBootstrap] = useState<ChallengeLabBootstrap | null>(null)
  const [loading, setLoading] = useState(true)
  const [warning, setWarning] = useState<string | null>(null)
  const [selectedTemplateId, setSelectedTemplateId] = useState<ChallengeTemplateId>('solo_memory_precision')
  const [participantIds, setParticipantIds] = useState<string[]>([agentId])
  const [scenario, setScenario] = useState('')
  const [sourceArenaRunId, setSourceArenaRunId] = useState<string | undefined>()
  const [sourceEventIds, setSourceEventIds] = useState<string[]>([])
  const [executionBudget, setExecutionBudget] = useState<ChallengeExecutionBudget>('fast')
  const [activeDetail, setActiveDetail] = useState<ChallengeRunDetail | null>(null)
  const [executingRunId, setExecutingRunId] = useState<string | null>(null)
  const [historyFilter, setHistoryFilter] = useState<'all' | ChallengeRun['status']>('all')
  const startedAtRef = useRef<number | null>(null)
  const [elapsed, setElapsed] = useState(0)

  const selectedTemplate = bootstrap?.templates.find((template) => template.id === selectedTemplateId) || null
  const otherAgents = agents.filter((agent) => agent.id !== agentId)
  const canRunPair = otherAgents.length > 0
  const activeRun = activeDetail?.run || bootstrap?.activeRun || null
  const events = activeDetail?.events || bootstrap?.activeEvents || []
  const results = activeDetail?.participantResults || []

  const loadBootstrap = useCallback(async () => {
    setLoading(true)
    setWarning(null)
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/challenges`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Failed to load Challenge Lab.')
      const data = await response.json() as ChallengeLabBootstrap
      setBootstrap(data)
      if (data.recommendedNextTemplates[0]) setSelectedTemplateId(data.recommendedNextTemplates[0])
      if (data.activeRun) {
        setActiveDetail({
          run: data.activeRun,
          events: data.activeEvents || [],
          participantResults: [],
        })
      }
    } catch (error) {
      setWarning(error instanceof Error ? error.message : 'Failed to load Challenge Lab.')
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  useEffect(() => {
    if (!selectedTemplate) return
    if (selectedTemplate.id !== 'arena_claim_proof' && sourceArenaRunId) {
      setSourceArenaRunId(undefined)
      setSourceEventIds([])
    }
    if (selectedTemplate.minParticipants === 1 && selectedTemplate.maxParticipants === 1) {
      setParticipantIds([agentId])
      return
    }
    if (selectedTemplate.minParticipants === 2 && participantIds.length < 2 && otherAgents[0]) {
      setParticipantIds([agentId, otherAgents[0].id])
      return
    }
    if (selectedTemplate.maxParticipants === 1) {
      setParticipantIds([agentId])
    }
  }, [agentId, otherAgents, participantIds.length, selectedTemplate, sourceArenaRunId])

  const pollDetail = useCallback(async (runId: string) => {
    try {
      const response = await fetch(`/api/agents/${encodeURIComponent(agentId)}/challenges/runs/${encodeURIComponent(runId)}`, { cache: 'no-store' })
      if (!response.ok) throw new Error('Polling failed.')
      const data = await response.json() as ChallengeRunDetail
      setActiveDetail(data)
      setWarning(null)
      return data
    } catch {
      setWarning('Live polling hiccuped; keeping the current run visible.')
      return null
    }
  }, [agentId])

  useEffect(() => {
    const runId = executingRunId || (activeRun?.status === 'running' ? activeRun.id : null)
    if (!runId) return
    const interval = window.setInterval(() => {
      void pollDetail(runId)
    }, 1000)
    void pollDetail(runId)
    return () => window.clearInterval(interval)
  }, [activeRun?.id, activeRun?.status, executingRunId, pollDetail])

  useEffect(() => {
    if (!isRunning(activeRun)) {
      startedAtRef.current = null
      setElapsed(0)
      return
    }
    if (!startedAtRef.current) startedAtRef.current = Date.now()
    const interval = window.setInterval(() => {
      setElapsed(Math.round((Date.now() - (startedAtRef.current || Date.now())) / 1000))
    }, 1000)
    return () => window.clearInterval(interval)
  }, [activeRun])

  const runChallenge = async () => {
    if (!selectedTemplate) return
    setWarning(null)
    try {
      const createResponse = await fetch(`/api/agents/${encodeURIComponent(agentId)}/challenges/runs`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          templateId: selectedTemplate.id,
          participantIds,
          scenario,
          sourceArenaRunId,
          sourceEventIds,
          executionBudget,
        }),
      })
      const created = await createResponse.json()
      if (!createResponse.ok) throw new Error(created.error || 'Failed to create run.')
      const detail = created as ChallengeRunDetail
      setActiveDetail(detail)
      setExecutingRunId(detail.run.id)
      startedAtRef.current = Date.now()

      const headers = new Headers(buildLLMPreferenceHeaders(selectedProvider, providerModel))
      const executeResponse = await fetch(`/api/agents/${encodeURIComponent(agentId)}/challenges/runs/${encodeURIComponent(detail.run.id)}/execute`, {
        method: 'POST',
        headers,
      })
      if (!executeResponse.ok) {
        await pollDetail(detail.run.id)
        const payload = await executeResponse.json().catch(() => null) as { error?: string } | null
        throw new Error(payload?.error || 'Execution failed.')
      }
      const executed = await executeResponse.json() as ChallengeRunDetail
      setActiveDetail(executed)
      void loadBootstrap()
    } catch (error) {
      setWarning(error instanceof Error ? error.message : 'Failed to run challenge.')
    } finally {
      setExecutingRunId(null)
    }
  }

  const cancelRun = async () => {
    if (!activeRun) return
    await fetch(`/api/agents/${encodeURIComponent(agentId)}/challenges/runs/${encodeURIComponent(activeRun.id)}/cancel`, { method: 'POST' })
    await pollDetail(activeRun.id)
  }

  const openRun = async (run: ChallengeRunSummary) => {
    const detail = await pollDetail(run.id)
    if (detail?.run.templateId) {
      setSelectedTemplateId(detail.run.templateId)
      setParticipantIds(detail.run.participantIds)
      setScenario(detail.run.scenario || '')
    }
  }

  const filteredHistory = useMemo(() => (
    (bootstrap?.recentRuns || []).filter((run) => historyFilter === 'all' || run.status === historyFilter)
  ), [bootstrap?.recentRuns, historyFilter])

  const pairDisabled = templateRequiresPair(selectedTemplate) && !canRunPair
  const canSubmit = Boolean(selectedTemplate && !pairDisabled && !isRunning(activeRun) && !executingRunId)
  const lastEvent = events[events.length - 1]

  if (loading) {
    return <ChallengeLabSkeleton />
  }

  return (
    <div className="min-w-0 space-y-4">
      <section className="rounded-sm border border-border/50 bg-card/70 p-4 backdrop-blur-xl">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.22em] text-primary/70">
              <FlaskConical className="h-3.5 w-3.5" />
              Challenge Lab
            </div>
            <h2 className="mt-1 text-2xl font-semibold tracking-tight">Testing console for {agentName}</h2>
          </div>
          <div className="grid grid-cols-2 gap-2 text-xs sm:grid-cols-5">
            <Metric label="Provider" value={LLM_PROVIDER_LABELS[selectedProvider]} />
            <Metric label="Model" value={providerModel} />
            <Metric label="Recent" value={bootstrap?.aggregateStats.recentScore ? `${bootstrap.aggregateStats.recentScore}` : 'none'} />
            <Metric label="Done" value={`${bootstrap?.aggregateStats.completedCount || 0}`} />
            <Metric label="Pairs" value={`${bootstrap?.aggregateStats.relationshipTrialCount || 0}`} />
          </div>
          <Button onClick={() => void runChallenge()} disabled={!canSubmit} className="gap-2">
            <Play className="h-4 w-4" />
            Run Challenge
          </Button>
        </div>
        {warning && (
          <div className="mt-3 flex items-center gap-2 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            <AlertTriangle className="h-4 w-4" />
            {warning}
          </div>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <ChallengeTemplateRail
          templates={bootstrap?.templates || []}
          selectedId={selectedTemplateId}
          pairDisabled={!canRunPair}
          onSelect={setSelectedTemplateId}
        />

        <main className="min-w-0 space-y-4">
          <ChallengeComposer
            template={selectedTemplate}
            agents={agents}
            selectedAgentId={agentId}
            participantIds={participantIds}
            scenario={scenario}
            executionBudget={executionBudget}
            arenaCandidates={bootstrap?.arenaFollowupCandidates || []}
            disabled={isRunning(activeRun) || Boolean(executingRunId)}
            pairDisabled={pairDisabled}
            onParticipantsChange={setParticipantIds}
            onScenarioChange={setScenario}
            onBudgetChange={setExecutionBudget}
            onApplyArenaCandidate={(candidate) => {
              setSelectedTemplateId('arena_claim_proof')
              setParticipantIds([agentId, ...candidate.participantIds.filter((id) => id !== agentId)].slice(0, 2))
              setScenario(candidate.suggestedScenario)
              setSourceArenaRunId(candidate.arenaRunId)
              setSourceEventIds(candidate.sourceEventIds)
            }}
          />

          <ChallengePipeline run={activeRun} elapsed={elapsed} lastEvent={lastEvent} onCancel={() => void cancelRun()} />
          <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_340px]">
            <ChallengeEventFeed events={events} />
            <ChallengeReport run={activeRun} results={results} />
          </div>
        </main>

        <ChallengeHistory
          runs={filteredHistory}
          filter={historyFilter}
          onFilter={setHistoryFilter}
          onOpen={(run) => void openRun(run)}
        />
      </div>
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-sm bg-background/50 px-3 py-2 ring-1 ring-border/50">
      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground">{label}</div>
      <div className="mt-1 max-w-[130px] truncate font-semibold text-foreground">{value}</div>
    </div>
  )
}

function ChallengeTemplateRail({ templates, selectedId, pairDisabled, onSelect }: {
  templates: ChallengeTemplate[]
  selectedId: ChallengeTemplateId
  pairDisabled: boolean
  onSelect: (id: ChallengeTemplateId) => void
}) {
  const groups = [
    ['solo', 'Solo'],
    ['relationship', 'Relationship'],
    ['arena_followup', 'Arena Follow-up'],
  ] as const

  return (
    <aside className="rounded-sm border border-border/50 bg-card/60 p-3">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Swords className="h-4 w-4 text-primary" />
        Templates
      </div>
      <div className="flex gap-2 overflow-x-auto xl:block xl:space-y-4">
        {groups.map(([group, label]) => (
          <div key={group} className="min-w-[240px] xl:min-w-0">
            <div className="mb-2 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/70">{label}</div>
            <div className="space-y-2">
              {templates.filter((template) => template.group === group).map((template) => {
                const disabled = template.minParticipants === 2 && pairDisabled
                const active = selectedId === template.id
                return (
                  <button
                    key={template.id}
                    disabled={disabled}
                    onClick={() => onSelect(template.id)}
                    className={cn(
                      'w-full rounded-sm border p-3 text-left transition',
                      active ? 'border-primary/50 bg-primary/10' : 'border-border/40 bg-background/35 hover:border-primary/30',
                      disabled && 'cursor-not-allowed opacity-45'
                    )}
                  >
                    <div className="text-sm font-semibold">{template.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{disabled ? 'Needs another agent.' : template.purpose}</div>
                  </button>
                )
              })}
            </div>
          </div>
        ))}
      </div>
    </aside>
  )
}

function ChallengeComposer({
  template,
  agents,
  selectedAgentId,
  participantIds,
  scenario,
  executionBudget,
  arenaCandidates,
  disabled,
  pairDisabled,
  onParticipantsChange,
  onScenarioChange,
  onBudgetChange,
  onApplyArenaCandidate,
}: {
  template: ChallengeTemplate | null
  agents: AgentRecord[]
  selectedAgentId: string
  participantIds: string[]
  scenario: string
  executionBudget: ChallengeExecutionBudget
  arenaCandidates: ChallengeArenaFollowupCandidate[]
  disabled: boolean
  pairDisabled: boolean
  onParticipantsChange: (ids: string[]) => void
  onScenarioChange: (value: string) => void
  onBudgetChange: (value: ChallengeExecutionBudget) => void
  onApplyArenaCandidate: (candidate: ChallengeArenaFollowupCandidate) => void
}) {
  const needsPair = templateRequiresPair(template)
  const isArenaTemplate = template?.id === 'arena_claim_proof'

  return (
    <section className="rounded-sm border border-border/50 bg-card/60 p-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div>
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary/70">Composer</div>
          <h3 className="mt-1 text-lg font-semibold">{template?.title || 'Select a template'}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{template?.brief}</p>
        </div>
        <div className="flex rounded-sm border border-border/50 bg-background/50 p-1">
          {(['fast', 'deep'] as const).map((budget) => (
            <button
              key={budget}
              disabled={disabled}
              onClick={() => onBudgetChange(budget)}
              className={cn(
                'rounded-sm px-3 py-1.5 text-xs font-semibold uppercase tracking-widest',
                executionBudget === budget ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground'
              )}
            >
              {budget}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-[260px_minmax(0,1fr)]">
        <div className="space-y-2">
          <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Participants</div>
          {agents.map((agent) => {
            const locked = agent.id === selectedAgentId
            const selected = participantIds.includes(agent.id)
            const disabledAgent = disabled || locked || (!needsPair && agent.id !== selectedAgentId)
            return (
              <button
                key={agent.id}
                disabled={disabledAgent}
                onClick={() => {
                  if (selected) {
                    onParticipantsChange(participantIds.filter((id) => id !== agent.id))
                  } else {
                    onParticipantsChange([...participantIds, agent.id].slice(0, template?.maxParticipants || 2))
                  }
                }}
                className={cn(
                  'flex w-full items-center justify-between rounded-sm border px-3 py-2 text-left text-sm',
                  selected ? 'border-primary/40 bg-primary/10' : 'border-border/40 bg-background/40',
                  disabledAgent && !locked && 'opacity-45'
                )}
              >
                <span className="truncate">{agent.name}</span>
                {selected ? <CheckCircle2 className="h-4 w-4 text-primary" /> : <Circle className="h-4 w-4 text-muted-foreground" />}
              </button>
            )
          })}
          {pairDisabled && <div className="text-xs text-amber-300">Pair templates need at least one other agent.</div>}
        </div>
        <div>
          <div className="mb-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Scenario / Context</div>
          <Textarea
            disabled={disabled}
            value={scenario}
            onChange={(event) => onScenarioChange(event.target.value)}
            placeholder="Leave blank to use the template default, or write a specific trial scenario."
            className="min-h-[168px]"
          />
          {isArenaTemplate && (
            <div className="mt-3 space-y-2">
              <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">Arena Source</div>
              {arenaCandidates.length === 0 ? (
                <div className="rounded-sm border border-dashed border-border/60 bg-background/30 px-3 py-2 text-xs text-muted-foreground">
                  No completed arena source found for this agent. The run will use the manual scenario.
                </div>
              ) : arenaCandidates.slice(0, 3).map((candidate) => (
                <button
                  key={candidate.arenaRunId}
                  type="button"
                  disabled={disabled}
                  onClick={() => onApplyArenaCandidate(candidate)}
                  className="w-full rounded-sm border border-border/40 bg-background/35 px-3 py-2 text-left text-xs transition hover:border-primary/30 disabled:opacity-50"
                >
                  <div className="truncate font-semibold text-foreground">{candidate.title}</div>
                  <div className="mt-1 truncate text-muted-foreground">{candidate.suggestedScenario}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </section>
  )
}

function ChallengePipeline({ run, elapsed, lastEvent, onCancel }: {
  run: ChallengeRun | null
  elapsed: number
  lastEvent?: ChallengeEvent
  onCancel: () => void
}) {
  const visibleStages = run?.latestStage === 'failed' ? [...STAGES, 'failed' as const] : STAGES
  const currentIndex = run ? visibleStages.indexOf(run.latestStage) : 0
  const modelWaiting = run?.status === 'running' && ['execute_turns', 'evaluate_outputs'].includes(run.latestStage)

  return (
    <section className="sticky top-[78px] z-20 rounded-sm border border-border/50 bg-card/80 p-4 backdrop-blur-xl">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Activity className={cn('h-4 w-4 text-primary', run?.status === 'running' && 'animate-pulse')} />
            {run ? STAGE_LABELS[run.latestStage] : 'No active run'}
          </div>
          <div className="mt-1 text-xs text-muted-foreground">
            {run?.status === 'failed'
              ? run.failureReason || 'The run failed before a report could be published.'
              : modelWaiting
                ? 'Waiting on local model or provider response.'
                : lastEvent?.summary || lastEvent?.title || 'Create a run to populate the pipeline.'}
            {run?.status === 'running' ? ` Elapsed ${elapsed}s.` : ''}
          </div>
        </div>
        {run?.status === 'running' && (
          <Button variant="outline" size="sm" onClick={onCancel} className="gap-2">
            <PauseCircle className="h-4 w-4" />
            Cancel
          </Button>
        )}
      </div>
      <div className="mt-4 grid grid-cols-2 gap-2 md:grid-cols-4 xl:grid-cols-8">
        {visibleStages.map((stage, index) => {
          const active = run?.latestStage === stage
          const complete = run ? index < currentIndex || run.status === 'completed' || run.status === 'cancelled' : false
          return (
            <motion.div
              key={stage}
              layout
              className={cn(
                'rounded-sm border px-2 py-2 text-xs',
                active ? 'border-primary/50 bg-primary/10 text-foreground' : complete ? 'border-emerald-500/30 bg-emerald-500/10' : 'border-border/40 bg-background/35 text-muted-foreground'
              )}
            >
              <div className="flex items-center gap-1.5">
                {complete ? <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" /> : <Circle className="h-3.5 w-3.5" />}
                <span className="truncate">{STAGE_LABELS[stage]}</span>
              </div>
            </motion.div>
          )
        })}
      </div>
    </section>
  )
}

function ChallengeEventFeed({ events }: { events: ChallengeEvent[] }) {
  return (
    <section className="min-h-[360px] rounded-sm border border-border/50 bg-card/60 p-4">
      <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
        <Activity className="h-4 w-4 text-primary" />
        Event Feed
      </div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {events.length === 0 ? (
            <div className="rounded-sm border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground">
              Events will appear as the lab moves through stages.
            </div>
          ) : events.map((event) => (
            <motion.article
              key={event.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              className="rounded-sm border border-border/40 bg-background/40 p-3"
            >
              <div className="flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-semibold">{event.title}</div>
                  <div className="text-[10px] uppercase tracking-widest text-muted-foreground">{event.kind} · {STAGE_LABELS[event.stage]}</div>
                </div>
                <div className="shrink-0 text-xs tabular-nums text-muted-foreground">#{event.sequence}</div>
              </div>
              <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground/85">{event.content}</p>
            </motion.article>
          ))}
        </AnimatePresence>
      </div>
    </section>
  )
}

function ChallengeReport({ run, results }: { run: ChallengeRun | null; results: ChallengeParticipantResult[] }) {
  const report = run?.report
  if (!report) {
    return (
      <section className="rounded-sm border border-border/50 bg-card/60 p-4">
        <div className="mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Gauge className="h-4 w-4 text-primary" />
          Report
        </div>
        <div className={cn(
          'rounded-sm border border-dashed border-border/60 p-8 text-center text-sm text-muted-foreground',
          run?.status === 'failed' && 'border-red-500/30 bg-red-500/10 text-red-100',
          run?.status === 'cancelled' && 'border-amber-500/30 bg-amber-500/10 text-amber-100'
        )}>
          {run?.status === 'failed'
            ? run.failureReason || 'The run failed before a report could be published.'
            : run?.status === 'cancelled'
              ? 'The run was cancelled at a safe boundary before final scoring.'
              : 'Final scores, evidence refs, and relationship impact appear after evaluation.'}
        </div>
    </section>
  )
}

  return (
    <section className="rounded-sm border border-border/50 bg-card/60 p-4">
      <div className="mb-4 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <Gauge className="h-4 w-4 text-primary" />
          Report
        </div>
        <motion.div initial={{ scale: 0.92 }} animate={{ scale: 1 }} className="text-3xl font-semibold tabular-nums">
          {report.overallScore}
        </motion.div>
      </div>
      {report.degraded && (
        <div className="mb-3 rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
          Judge output was incomplete or malformed, so deterministic fallback scoring was used.
        </div>
      )}
      <p className="text-sm leading-relaxed text-foreground/85">{report.verdictSummary}</p>
      <div className="mt-4 space-y-2">
        {(results.length ? results : (report.scorecards || []).map((scorecard) => ({
          id: `${report.runId}:${scorecard.agentId}`,
          runId: report.runId,
          agentId: scorecard.agentId,
          templateId: report.templateId,
          mode: run.mode,
          outcome: scorecard.outcome,
          totalScore: scorecard.totalScore,
          capabilityScore: scorecard.capabilityScore,
          relationshipScore: scorecard.relationshipScore,
          createdAt: report.createdAt,
          payload: scorecard,
        } satisfies ChallengeParticipantResult))).map((result) => (
          <ChallengeScorecard key={result.id} result={result} />
        ))}
      </div>
      {report.relationshipSignals.length > 0 && (
        <div className="mt-4 rounded-sm bg-primary/5 p-3 ring-1 ring-primary/15">
          <div className="text-[10px] font-bold uppercase tracking-widest text-primary/80">Relationship Impact</div>
          <div className="mt-2 space-y-1 text-sm text-muted-foreground">
            {(report.relationshipSignals || []).map((signal, index) => (
              <div key={`${signal.signalKind}-${index}`}>{signal.signalKind.replace(/_/g, ' ')} · refs {signal.excerptRefs.join(', ')}</div>
            ))}
          </div>
        </div>
      )}
      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <ListBlock title="Strengths" items={report.strengths || []} />
        <ListBlock title="Weaknesses" items={report.weaknesses || []} />
      </div>
    </section>
  )
}

function ChallengeScorecard({ result }: { result: ChallengeParticipantResult }) {
  return (
    <div className="rounded-sm border border-border/40 bg-background/40 p-3">
      <div className="flex items-center justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-sm font-semibold">{result.payload.agentName || result.agentId}</div>
          <div className="text-xs capitalize text-muted-foreground">{result.outcome.replace(/_/g, ' ')}</div>
        </div>
        <div className="text-xl font-semibold tabular-nums">{result.totalScore}</div>
      </div>
      <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-muted">
        <motion.div initial={{ width: 0 }} animate={{ width: `${result.totalScore}%` }} className="h-full bg-primary" />
      </div>
    </div>
  )
}

function ListBlock({ title, items }: { title: string; items: string[] }) {
  return (
    <div>
      <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{title}</div>
      <ul className="mt-2 space-y-1 text-sm text-muted-foreground">
        {items.slice(0, 4).map((item) => <li key={item}>{item}</li>)}
      </ul>
    </div>
  )
}

function ChallengeHistory({ runs, filter, onFilter, onOpen }: {
  runs: ChallengeRunSummary[]
  filter: 'all' | ChallengeRun['status']
  onFilter: (value: 'all' | ChallengeRun['status']) => void
  onOpen: (run: ChallengeRunSummary) => void
}) {
  return (
    <aside className="rounded-sm border border-border/50 bg-card/60 p-3">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
          <History className="h-4 w-4 text-primary" />
          History
        </div>
        <select
          value={filter}
          onChange={(event) => onFilter(event.target.value as 'all' | ChallengeRun['status'])}
          className="rounded-sm border border-border/50 bg-background px-2 py-1 text-xs"
        >
          {['all', 'draft', 'running', 'completed', 'failed', 'cancelled'].map((value) => <option key={value}>{value}</option>)}
        </select>
      </div>
      <div className="space-y-2">
        {runs.length === 0 ? (
          <div className="rounded-sm border border-dashed border-border/60 p-6 text-center text-sm text-muted-foreground">
            No Challenge Lab runs yet.
          </div>
        ) : runs.map((run) => (
          <button
            key={run.id}
            onClick={() => onOpen(run)}
            className="w-full rounded-sm border border-border/40 bg-background/40 p-3 text-left transition hover:border-primary/30"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="truncate text-sm font-semibold">{run.templateTitle || formatTemplateId(run.templateId)}</div>
              <div className="text-sm font-semibold tabular-nums">{run.qualityScore ?? '-'}</div>
            </div>
            <div className="mt-1 truncate text-xs text-muted-foreground">{run.participantNames.join(' + ')}</div>
            <div className="mt-2 text-[10px] uppercase tracking-widest text-muted-foreground">{run.status} · {new Date(run.updatedAt).toLocaleDateString()}</div>
          </button>
        ))}
      </div>
    </aside>
  )
}

function ChallengeLabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="h-28 animate-pulse rounded-sm border border-border/50 bg-card/60" />
      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        <div className="h-[520px] animate-pulse rounded-sm border border-border/50 bg-card/60" />
        <div className="space-y-4">
          <div className="h-56 animate-pulse rounded-sm border border-border/50 bg-card/60" />
          <div className="h-32 animate-pulse rounded-sm border border-border/50 bg-card/60" />
          <div className="h-72 animate-pulse rounded-sm border border-border/50 bg-card/60" />
        </div>
        <div className="h-[520px] animate-pulse rounded-sm border border-border/50 bg-card/60" />
      </div>
    </div>
  )
}
