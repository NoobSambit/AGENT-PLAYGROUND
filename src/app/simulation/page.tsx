'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  Bot,
  CheckCircle2,
  Crown,
  Loader2,
  Orbit,
  PauseCircle,
  Radar,
  Shield,
  Sparkles,
  Swords,
  Target,
  Zap,
} from 'lucide-react'
import { GradientOrb } from '@/components/ui/animated-background'
import { Input, Textarea } from '@/components/ui/input'
import { LLMProviderToggle } from '@/components/llm/LLMProviderToggle'
import {
  buildLLMPreferenceHeaders,
  getClientModelForProvider,
  LLM_PROVIDER_LABELS,
} from '@/lib/llm/clientPreference'
import { useLLMPreferenceStore } from '@/stores/llmPreferenceStore'
import { useAgentStore } from '@/stores/agentStore'
import type {
  ArenaEvent,
  ArenaResponseBudget,
  ArenaRun,
  ArenaRunSummary,
  ArenaScorecard,
  ArenaSeat,
} from '@/types/database'

type ArenaDetailResponse = {
  run: ArenaRun
  events: ArenaEvent[]
}

const premiumPanel = 'rounded-md border border-border/40 bg-card/70 backdrop-blur-md shadow-sm'
const subPanel = 'rounded-sm border border-border/35 bg-background/65'
const labelStyle = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80'

const accentPairs = [
  {
    panel: 'border-cyan-400/20 bg-cyan-400/[0.08]',
    text: 'text-cyan-300',
    dot: 'bg-cyan-400',
  },
  {
    panel: 'border-amber-400/20 bg-amber-400/[0.08]',
    text: 'text-amber-300',
    dot: 'bg-amber-400',
  },
  {
    panel: 'border-emerald-400/20 bg-emerald-400/[0.08]',
    text: 'text-emerald-300',
    dot: 'bg-emerald-400',
  },
  {
    panel: 'border-fuchsia-400/20 bg-fuchsia-400/[0.08]',
    text: 'text-fuchsia-300',
    dot: 'bg-fuchsia-400',
  },
]

const responseBudgets: Array<{ value: ArenaResponseBudget; label: string; detail: string }> = [
  { value: 'tight', label: 'Tight', detail: 'Sharper, shorter turns for faster local runs.' },
  { value: 'balanced', label: 'Balanced', detail: 'Default pacing for 10-12 round debates.' },
  { value: 'expanded', label: 'Expanded', detail: 'Longer responses and heavier local load.' },
]

function getStatusTone(status: ArenaRun['status']) {
  if (status === 'completed') {
    return 'border-pastel-green/30 bg-pastel-green/10 text-pastel-green'
  }

  if (status === 'running') {
    return 'border-pastel-blue/30 bg-pastel-blue/10 text-pastel-blue'
  }

  if (status === 'failed') {
    return 'border-pastel-red/30 bg-pastel-red/10 text-pastel-red'
  }

  if (status === 'cancelled') {
    return 'border-pastel-yellow/30 bg-pastel-yellow/10 text-pastel-yellow'
  }

  return 'border-border/50 bg-muted/20 text-muted-foreground'
}

function getStageLabel(value: string) {
  return value.replaceAll('_', ' ')
}

function formatEventKind(value: string) {
  return value.replaceAll('_', ' ')
}

function formatTime(value?: string) {
  if (!value) {
    return 'Unknown'
  }

  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function participantAccent(index: number) {
  return accentPairs[index % accentPairs.length]
}

function getPayloadRecord(event: ArenaEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object'
    ? event.payload as Record<string, unknown>
    : {}
}

function stringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((entry) => String(entry).trim()).filter(Boolean)
    : []
}

function getSeatName(agentId: string, seats: ArenaSeat[]): string {
  return seats.find((seat) => seat.agentId === agentId)?.agentName || agentId
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.text()
  const json = payload ? JSON.parse(payload) as Record<string, unknown> : {}

  if (!response.ok) {
    throw new Error(typeof json.error === 'string' ? json.error : `Request failed with status ${response.status}`)
  }

  return json as T
}

export default function SimulationPage() {
  const { agents, fetchAgents } = useAgentStore()
  const selectedProvider = useLLMPreferenceStore((state) => state.provider)
  const eventsEndRef = useRef<HTMLDivElement>(null)

  const [runs, setRuns] = useState<ArenaRunSummary[]>([])
  const [selectedRunId, setSelectedRunId] = useState<string | null>(null)
  const [detail, setDetail] = useState<ArenaDetailResponse | null>(null)
  const [selectedAgentIds, setSelectedAgentIds] = useState<string[]>([])
  const [topic, setTopic] = useState('Should an inspectable agent platform prioritize arena-grade debates over broad feature sprawl in its next release?')
  const [objective, setObjective] = useState('Drive the debate toward a practical product decision, the strongest counter-case, and a final winner with evidence.')
  const [referenceBrief, setReferenceBrief] = useState('')
  const [roundCount, setRoundCount] = useState(10)
  const [responseBudget, setResponseBudget] = useState<ArenaResponseBudget>('balanced')
  const [seatDrafts, setSeatDrafts] = useState<Record<string, ArenaSeat>>({})
  const [loadingRuns, setLoadingRuns] = useState(true)
  const [loadingDetail, setLoadingDetail] = useState(false)
  const [preparing, setPreparing] = useState(false)
  const [savingSeats, setSavingSeats] = useState(false)
  const [launching, setLaunching] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [uiError, setUiError] = useState<string | null>(null)

  const selectedRun = detail?.run || null
  const runEvents = useMemo(() => detail?.events ?? [], [detail?.events])
  const activeHeadDirective = useMemo(
    () => [...runEvents].reverse().find((event) => event.kind === 'head_directive'),
    [runEvents]
  )
  const activeHeadPayload = useMemo(() => getPayloadRecord(activeHeadDirective || {
    id: '',
    runId: '',
    sequence: 0,
    stage: 'prepare',
    kind: 'run_prepared',
    speakerType: 'system',
    title: '',
    content: '',
    summary: '',
    createdAt: '',
  }), [activeHeadDirective])

  const currentQueue = useMemo(() => stringList(activeHeadPayload.speakerOrder), [activeHeadPayload])
  const headSignals = useMemo(() => stringList(activeHeadPayload.scoreSignals), [activeHeadPayload])
  const selectedAgentCards = useMemo(() => (
    selectedAgentIds
      .map((agentId) => agents.find((agent) => agent.id === agentId))
      .filter((agent): agent is NonNullable<typeof agent> => Boolean(agent))
  ), [agents, selectedAgentIds])
  const availableAgents = useMemo(() => (
    agents.slice().sort((left, right) => left.name.localeCompare(right.name))
  ), [agents])
  const sortedScorecards = useMemo(() => (
    selectedRun?.scorecardSnapshot
      .slice()
      .sort((left, right) => right.total - left.total) || []
  ), [selectedRun?.scorecardSnapshot])
  const runtimeModel = selectedRun?.model || getClientModelForProvider(selectedProvider)
  const latestRound = selectedRun?.ledger.rounds[selectedRun.ledger.rounds.length - 1]
  const degradedEventCount = useMemo(() => (
    runEvents.filter((event) => Boolean(getPayloadRecord(event).degraded)).length
  ), [runEvents])

  useEffect(() => {
    if (agents.length === 0) {
      void fetchAgents()
    }
  }, [agents.length, fetchAgents])

  useEffect(() => {
    eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [runEvents.length])

  const loadRuns = useCallback(async (silent = false) => {
    try {
      if (!silent) {
        setLoadingRuns(true)
      }

      const payload = await parseResponse<{ runs: ArenaRunSummary[] }>(await fetch('/api/arena/runs?limit=10', {
        cache: 'no-store',
      }))
      setRuns(payload.runs || [])
      if (!selectedRunId && payload.runs[0]?.id) {
        setSelectedRunId(payload.runs[0].id)
      }
    } catch (error) {
      console.error('Failed to load arena runs:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to load arena runs.')
    } finally {
      if (!silent) {
        setLoadingRuns(false)
      }
    }
  }, [selectedRunId])

  const loadRunDetail = useCallback(async (runId: string, silent = false) => {
    try {
      if (!silent) {
        setLoadingDetail(true)
      }

      const payload = await parseResponse<ArenaDetailResponse>(await fetch(`/api/arena/runs/${runId}`, {
        cache: 'no-store',
      }))
      setDetail(payload)
    } catch (error) {
      console.error('Failed to load arena detail:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to load arena detail.')
    } finally {
      if (!silent) {
        setLoadingDetail(false)
      }
    }
  }, [])

  useEffect(() => {
    void loadRuns()
  }, [loadRuns])

  useEffect(() => {
    if (!selectedRunId) {
      return
    }

    void loadRunDetail(selectedRunId)
  }, [loadRunDetail, selectedRunId])

  useEffect(() => {
    if (!selectedRun) {
      return
    }

    setTopic(selectedRun.config.topic)
    setObjective(selectedRun.config.objective)
    setReferenceBrief(selectedRun.config.referenceBrief || '')
    setRoundCount(selectedRun.config.roundCount)
    setResponseBudget(selectedRun.config.responseBudget)
    setSelectedAgentIds(selectedRun.participantIds)
    setSeatDrafts(Object.fromEntries(
      selectedRun.seats.map((seat) => [seat.agentId, seat])
    ))
  }, [selectedRun])

  useEffect(() => {
    if (!selectedRun || selectedRun.status !== 'running') {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadRunDetail(selectedRun.id, true)
      void loadRuns(true)
    }, 1500)

    return () => window.clearInterval(intervalId)
  }, [loadRunDetail, loadRuns, selectedRun])

  function toggleAgent(agentId: string) {
    setUiError(null)
    setSelectedAgentIds((current) => {
      if (current.includes(agentId)) {
        return current.filter((value) => value !== agentId)
      }

      if (current.length >= 4) {
        setUiError('Arena v1 supports up to four participants per run.')
        return current
      }

      return [...current, agentId]
    })
  }

  async function prepareArena() {
    if (selectedAgentIds.length < 2) {
      setUiError('Select at least two agents before preparing the arena.')
      return
    }

    if (!topic.trim()) {
      setUiError('Add a debate topic before preparing the arena.')
      return
    }

    try {
      setPreparing(true)
      setUiError(null)

      const payload = await parseResponse<ArenaDetailResponse>(await fetch('/api/arena/runs', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          objective,
          participantIds: selectedAgentIds,
          roundCount,
          responseBudget,
          referenceBrief,
        }),
      }))

      setDetail(payload)
      setSelectedRunId(payload.run.id)
      await loadRuns(true)
    } catch (error) {
      console.error('Failed to prepare arena:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to prepare arena run.')
    } finally {
      setPreparing(false)
    }
  }

  async function saveSeatEdits() {
    if (!selectedRun) {
      return
    }

    try {
      setSavingSeats(true)
      setUiError(null)

      const payload = await parseResponse<ArenaDetailResponse>(await fetch(`/api/arena/runs/${selectedRun.id}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          topic,
          objective,
          roundCount,
          responseBudget,
          referenceBrief,
          seats: Object.values(seatDrafts).map((seat) => ({
            agentId: seat.agentId,
            seatLabel: seat.seatLabel,
            stanceBrief: seat.stanceBrief,
            winCondition: seat.winCondition,
          })),
        }),
      }))

      setDetail(payload)
      await loadRuns(true)
    } catch (error) {
      console.error('Failed to save seat edits:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to save seat edits.')
    } finally {
      setSavingSeats(false)
    }
  }

  function launchArena() {
    if (!selectedRun) {
      setUiError('Prepare an arena draft before launching.')
      return
    }

    setUiError(null)
    setLaunching(true)
    setDetail((current) => current ? {
      ...current,
      run: {
        ...current.run,
        status: 'running',
        latestStage: 'opening',
      },
    } : current)

    void fetch(`/api/arena/runs/${selectedRun.id}/execute`, {
      method: 'POST',
      headers: buildLLMPreferenceHeaders(selectedProvider, getClientModelForProvider(selectedProvider)),
    })
      .then(async (response) => {
        const payload = await parseResponse<ArenaDetailResponse>(response)
        setDetail(payload)
        await loadRuns(true)
      })
      .catch((error) => {
        console.error('Failed to launch arena:', error)
        setUiError(error instanceof Error ? error.message : 'Failed to launch arena run.')
      })
      .finally(() => {
        setLaunching(false)
      })
  }

  async function cancelArena() {
    if (!selectedRun) {
      return
    }

    try {
      setCancelling(true)
      const payload = await parseResponse<ArenaDetailResponse>(await fetch(`/api/arena/runs/${selectedRun.id}/cancel`, {
        method: 'POST',
      }))
      setDetail(payload)
      await loadRuns(true)
    } catch (error) {
      console.error('Failed to cancel arena:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to cancel arena.')
    } finally {
      setCancelling(false)
    }
  }

  return (
    <div className="relative min-h-screen overflow-hidden pb-12 pt-36 sm:pt-40">
      <GradientOrb className="-left-16 top-0 h-[30rem] w-[30rem] opacity-[0.14]" color="cyan" />
      <GradientOrb className="right-0 top-[18%] h-[24rem] w-[24rem] opacity-[0.1]" color="pink" />

      <div className="page-shell space-y-4">
        <motion.section
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className={`${premiumPanel} px-5 py-5 sm:px-6`}
        >
          <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-3xl space-y-3">
              <div className="flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
                <span className="inline-flex items-center gap-2 rounded-full border border-border/40 bg-muted/20 px-3 py-1.5 text-foreground">
                  <Orbit className="h-3.5 w-3.5 text-pastel-blue" />
                  Arena workspace
                </span>
                <span className="inline-flex rounded-full border border-border/40 bg-muted/20 px-3 py-1.5">2-4 seats</span>
                <span className="inline-flex rounded-full border border-border/40 bg-muted/20 px-3 py-1.5">10-12 rounds</span>
              </div>
              <div>
                <h1 className="text-3xl font-black tracking-tight text-foreground sm:text-4xl">
                  Head-led debate, readable at every step.
                </h1>
                <p className="mt-3 max-w-2xl text-sm leading-7 text-muted-foreground">
                  Build a roster on the left, follow the live conversation in the center, and inspect the head state, queue, score movement, and final verdict on the right.
                </p>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 xl:w-[28rem]">
              <WorkspaceMetric
                label="Runs"
                value={runs.length}
                detail="Recent arena records"
              />
              <WorkspaceMetric
                label="Roster"
                value={availableAgents.length}
                detail="Agents ready for seating"
              />
              <WorkspaceMetric
                label="Runtime"
                value={LLM_PROVIDER_LABELS[selectedProvider]}
                detail={runtimeModel}
              />
              <WorkspaceMetric
                label="Trace"
                value={runEvents.length}
                detail="Events in current feed"
              />
            </div>
          </div>
        </motion.section>

        {uiError ? (
          <div className="rounded-md border border-pastel-red/30 bg-pastel-red/5 px-4 py-3 text-[13px] text-pastel-red flex items-start gap-3">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{uiError}</span>
          </div>
        ) : null}

        <div className="grid gap-4 xl:grid-cols-[320px_minmax(0,1fr)_360px]">
          <div className="flex min-h-0 flex-col gap-4 xl:max-h-[calc(100vh-11rem)]">
            <section className={`${premiumPanel} flex min-h-0 flex-col overflow-hidden`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={labelStyle}>Draft Builder</div>
                    <h2 className="mt-1 text-lg font-bold text-foreground">Prepare the next run</h2>
                  </div>
                  <span className="rounded-full border border-border/40 bg-muted/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                    sandboxed
                  </span>
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-4 scrollbar-thin">
                <div className={`${subPanel} p-3`}>
                  <LLMProviderToggle compact />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="arena-topic" className={labelStyle}>Topic</label>
                  <Textarea
                    id="arena-topic"
                    value={topic}
                    onChange={(event) => setTopic(event.target.value)}
                    className="min-h-[120px] border-border/30 bg-muted/5 text-[13px]"
                    placeholder="What should the head force the arena to resolve?"
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="arena-objective" className={labelStyle}>Objective</label>
                  <Textarea
                    id="arena-objective"
                    value={objective}
                    onChange={(event) => setObjective(event.target.value)}
                    className="min-h-[104px] border-border/30 bg-muted/5 text-[13px]"
                    placeholder="Define the product decision or outcome the debate should drive toward."
                  />
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="arena-reference" className={labelStyle}>Reference Brief</label>
                  <Textarea
                    id="arena-reference"
                    value={referenceBrief}
                    onChange={(event) => setReferenceBrief(event.target.value)}
                    className="min-h-[88px] border-border/30 bg-muted/5 text-[13px]"
                    placeholder="Optional product context, constraints, or evidence for the head."
                  />
                </div>

                <div className="space-y-3">
                  <div className={labelStyle}>Rounds</div>
                  <div className="grid grid-cols-3 gap-2">
                    {[10, 11, 12].map((value) => (
                      <button
                        key={value}
                        type="button"
                        aria-pressed={roundCount === value}
                        onClick={() => setRoundCount(value)}
                        className={`rounded-sm border px-3 py-2 text-[12px] font-bold transition-colors ${
                          roundCount === value
                            ? 'border-pastel-purple/40 bg-pastel-purple/10 text-foreground'
                            : 'border-border/30 bg-muted/5 text-muted-foreground hover:border-border/50 hover:text-foreground'
                        }`}
                      >
                        {value}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className={labelStyle}>Response Budget</div>
                  <div className="space-y-2">
                    {responseBudgets.map((option) => (
                      <button
                        key={option.value}
                        type="button"
                        aria-pressed={responseBudget === option.value}
                        onClick={() => setResponseBudget(option.value)}
                        className={`w-full rounded-sm border px-3 py-3 text-left transition-colors ${
                          responseBudget === option.value
                            ? 'border-pastel-blue/40 bg-pastel-blue/10'
                            : 'border-border/30 bg-muted/5 hover:border-border/50'
                        }`}
                      >
                        <div className="text-[12px] font-bold text-foreground">{option.label}</div>
                        <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{option.detail}</div>
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <div className={labelStyle}>Roster</div>
                    <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                      {selectedAgentIds.length}/4 selected
                    </div>
                  </div>
                  <div className="max-h-[18rem] space-y-2 overflow-y-auto pr-1 scrollbar-thin">
                    {availableAgents.map((agent, index) => {
                      const selected = selectedAgentIds.includes(agent.id)
                      const accent = participantAccent(index)

                      return (
                        <button
                          key={agent.id}
                          type="button"
                          aria-pressed={selected}
                          onClick={() => toggleAgent(agent.id)}
                          className={`w-full rounded-sm border p-3 text-left transition-colors ${
                            selected
                              ? `${accent.panel}`
                              : 'border-border/30 bg-muted/5 hover:border-border/50 hover:bg-muted/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className={`truncate text-[12px] font-bold ${selected ? accent.text : 'text-foreground'}`}>
                                {agent.name}
                              </div>
                              <p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">
                                {agent.persona}
                              </p>
                            </div>
                            <span className={`mt-1 h-2.5 w-2.5 rounded-full ${selected ? accent.dot : 'bg-border'}`} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                {selectedAgentCards.length > 0 ? (
                  <div className={`${subPanel} p-3`}>
                    <div className={labelStyle}>Selected Seats</div>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {selectedAgentCards.map((agent, index) => {
                        const accent = participantAccent(index)
                        return (
                          <span
                            key={agent.id}
                            className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold ${accent.panel}`}
                          >
                            <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
                            {agent.name}
                          </span>
                        )
                      })}
                    </div>
                  </div>
                ) : null}
              </div>

              <div className="border-t border-border/30 bg-muted/5 p-4">
                <button
                  type="button"
                  onClick={() => void prepareArena()}
                  disabled={preparing}
                  className="inline-flex h-10 w-full items-center justify-center gap-2 rounded-sm bg-pastel-purple px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground transition-colors hover:bg-pastel-purple/90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {preparing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Target className="h-3.5 w-3.5" />}
                  Prepare Draft
                </button>
                <p className="mt-3 text-[10px] leading-relaxed text-muted-foreground">
                  Arena runs are sandboxed. They do not write long-term memories or relationship state.
                </p>
              </div>
            </section>

            <section className={`${premiumPanel} flex min-h-[16rem] flex-col overflow-hidden`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className={labelStyle}>Archive</div>
                  <h2 className="mt-1 text-lg font-bold text-foreground">Recent runs</h2>
                </div>
                {loadingRuns ? <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /> : null}
              </div>

              <div className="flex-1 space-y-2 overflow-y-auto p-3 scrollbar-thin">
                {runs.length === 0 ? (
                  <EmptyPanel copy="No arena runs yet. Prepare the first draft from the builder above." />
                ) : (
                  runs.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => setSelectedRunId(run.id)}
                      className={`w-full rounded-sm border p-3 text-left transition-colors ${
                        selectedRunId === run.id
                          ? 'border-pastel-purple/40 bg-pastel-purple/10'
                          : 'border-border/30 bg-muted/5 hover:border-border/50 hover:bg-muted/10'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-2 text-[12px] font-bold text-foreground">{run.topic}</div>
                          <div className="mt-1 text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                            {run.participantNames.join(' / ')}
                          </div>
                        </div>
                        <span className={`rounded-full border px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${getStatusTone(run.status)}`}>
                          {run.status}
                        </span>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2 text-[10px] text-muted-foreground">
                        <span>{run.currentRound}/{run.roundCount} rounds</span>
                        <span>{run.eventCount} events</span>
                        <span>{formatTime(run.updatedAt)}</span>
                      </div>
                    </button>
                  ))
                )}
              </div>
            </section>
          </div>

          <section className={`${premiumPanel} flex min-h-[70vh] flex-col overflow-hidden xl:max-h-[calc(100vh-11rem)]`}>
            <div className="border-b border-border/40 bg-muted/10 px-5 py-4">
              {selectedRun ? (
                <div className="space-y-4">
                  <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                    <div className="min-w-0">
                      <div className={labelStyle}>Arena Stage</div>
                      <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">
                        {selectedRun.config.topic}
                      </h2>
                      <p className="mt-2 max-w-3xl text-[13px] leading-7 text-muted-foreground">
                        {selectedRun.config.objective}
                      </p>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-full border px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] ${getStatusTone(selectedRun.status)}`}>
                        {selectedRun.status}
                      </span>
                      <span className="rounded-full border border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        {selectedRun.currentRound}/{selectedRun.config.roundCount} rounds
                      </span>
                      <span className="rounded-full border border-border/40 bg-muted/20 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
                        {getStageLabel(selectedRun.latestStage)}
                      </span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {selectedRun.seats.map((seat, index) => {
                      const accent = participantAccent(index)
                      return (
                        <span
                          key={seat.agentId}
                          className={`inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[11px] font-bold ${accent.panel}`}
                        >
                          <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
                          {seat.agentName}
                          <span className="text-muted-foreground">/</span>
                          {seat.seatLabel}
                        </span>
                      )
                    })}
                  </div>

                  <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
                    <div className={`${subPanel} p-3`}>
                      <div className="flex flex-wrap items-center gap-2">
                        <div className={labelStyle}>Head Focus</div>
                        {Boolean(activeHeadPayload.degraded) ? (
                          <span className="rounded-full border border-pastel-yellow/30 bg-pastel-yellow/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-pastel-yellow">
                            degraded fallback
                          </span>
                        ) : null}
                      </div>
                      <div className="mt-2 text-[12px] font-bold text-foreground">
                        {activeHeadDirective?.summary || selectedRun.ledger.latestFocusQuestion || 'The head has not published a focus question yet.'}
                      </div>
                      <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                        {activeHeadDirective?.content || selectedRun.ledger.latestDirective || 'Prepare and launch a run to start the event stream.'}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2 self-start">
                      {selectedRun.status === 'draft' ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void saveSeatEdits()}
                            disabled={savingSeats}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-border/40 bg-muted/20 px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-foreground transition-colors hover:border-border/60 hover:bg-muted/30 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {savingSeats ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Shield className="h-3.5 w-3.5" />}
                            Save Seats
                          </button>
                          <button
                            type="button"
                            onClick={launchArena}
                            disabled={launching}
                            className="inline-flex h-10 items-center justify-center gap-2 rounded-sm bg-pastel-purple px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground transition-colors hover:bg-pastel-purple/90 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            {launching ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
                            Launch
                          </button>
                        </>
                      ) : null}

                      {selectedRun.status === 'running' ? (
                        <button
                          type="button"
                          onClick={() => void cancelArena()}
                          disabled={cancelling}
                          className="inline-flex h-10 items-center justify-center gap-2 rounded-sm border border-pastel-red/40 bg-pastel-red/10 px-4 text-[11px] font-bold uppercase tracking-[0.2em] text-pastel-red transition-colors hover:bg-pastel-red/15 disabled:cursor-not-allowed disabled:opacity-60"
                        >
                          {cancelling ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <PauseCircle className="h-3.5 w-3.5" />}
                          Request Stop
                        </button>
                      ) : null}
                    </div>
                  </div>
                </div>
              ) : (
                <div>
                  <div className={labelStyle}>Arena Stage</div>
                  <h2 className="mt-1 text-2xl font-black tracking-tight text-foreground">No run selected</h2>
                  <p className="mt-2 max-w-2xl text-[13px] leading-7 text-muted-foreground">
                    Open a draft or a completed run to inspect the live queue, head directives, speaker turns, score movement, and final verdict.
                  </p>
                </div>
              )}
            </div>

            <div className="flex-1 overflow-y-auto p-5 scrollbar-thin">
              {loadingDetail && !detail ? (
                <div className="flex h-full items-center justify-center">
                  <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                </div>
              ) : !selectedRun ? (
                <EmptyArenaState />
              ) : (
                <div className="space-y-5">
                  {selectedRun.status === 'draft' ? (
                    <section className={`${subPanel} p-4`}>
                      <div className="flex items-start gap-3">
                        <Swords className="mt-0.5 h-4 w-4 text-pastel-purple" />
                        <div>
                          <div className="text-[12px] font-bold text-foreground">Seat editing is open</div>
                          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
                            Adjust the seat labels, stance briefs, and win conditions before launch. These are the strongest controls you have against persona collapse on a single local model.
                          </p>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-3">
                        {selectedRun.seats.map((seat, index) => {
                          const draft = seatDrafts[seat.agentId] || seat
                          return (
                            <SeatEditorCard
                              key={seat.agentId}
                              seat={draft}
                              accentIndex={index}
                              onChange={(nextSeat) => setSeatDrafts((current) => ({
                                ...current,
                                [seat.agentId]: nextSeat,
                              }))}
                            />
                          )
                        })}
                      </div>
                    </section>
                  ) : null}

                  <section className={`${subPanel} p-4`}>
                    <div className="grid gap-3 lg:grid-cols-4">
                      <WorkspaceMetric
                        label="Phase"
                        value={getStageLabel(selectedRun.latestStage)}
                        detail={`Round ${selectedRun.currentRound} active`}
                      />
                      <WorkspaceMetric
                        label="Events"
                        value={runEvents.length}
                        detail="Timeline entries persisted"
                      />
                      <WorkspaceMetric
                        label="Degraded"
                        value={degradedEventCount}
                        detail="Fallback-recovered turns"
                      />
                      <WorkspaceMetric
                        label="Leader"
                        value={sortedScorecards[0]?.agentName || 'None'}
                        detail={sortedScorecards[0] ? `${sortedScorecards[0].total} total points` : 'No score yet'}
                      />
                    </div>
                  </section>

                  <section className="space-y-3">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className={labelStyle}>Event Feed</div>
                        <h3 className="mt-1 text-lg font-bold text-foreground">Conversation ledger</h3>
                      </div>
                      {selectedRun.status === 'running' ? (
                        <div className="inline-flex items-center gap-2 rounded-full border border-pastel-blue/30 bg-pastel-blue/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-pastel-blue">
                          <span className="relative flex h-2.5 w-2.5">
                            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pastel-blue/70" />
                            <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-pastel-blue" />
                          </span>
                          live feed
                        </div>
                      ) : null}
                    </div>

                    <AnimatePresence initial={false}>
                      {runEvents.length === 0 ? (
                        <EmptyPanel copy="Arena events will appear here once the run starts." />
                      ) : (
                        runEvents.map((event) => (
                          <ArenaEventCard
                            key={event.id}
                            event={event}
                            seats={selectedRun.seats}
                            seat={selectedRun.seats.find((entry) => entry.agentId === event.speakerAgentId)}
                            seatIndex={selectedRun.seats.findIndex((entry) => entry.agentId === event.speakerAgentId)}
                          />
                        ))
                      )}
                    </AnimatePresence>
                    <div ref={eventsEndRef} />
                  </section>
                </div>
              )}
            </div>
          </section>

          <div className="flex min-h-0 flex-col gap-4 xl:max-h-[calc(100vh-11rem)]">
            <section className={`${premiumPanel} flex min-h-0 flex-col overflow-hidden`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={labelStyle}>Inspector</div>
                    <h2 className="mt-1 text-lg font-bold text-foreground">Head state and score flow</h2>
                  </div>
                  {selectedRun?.status === 'running' ? (
                    <div className="inline-flex items-center gap-2 rounded-full border border-pastel-blue/30 bg-pastel-blue/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-pastel-blue">
                      live
                    </div>
                  ) : null}
                </div>
              </div>

              <div className="flex-1 space-y-5 overflow-y-auto p-4 scrollbar-thin">
                {selectedRun ? (
                  <>
                    <div className="grid grid-cols-2 gap-3">
                      <InspectorMetricTile
                        icon={Activity}
                        label="Phase"
                        value={getStageLabel(selectedRun.latestStage)}
                        detail={`${selectedRun.currentRound}/${selectedRun.config.roundCount} rounds`}
                      />
                      <InspectorMetricTile
                        icon={Bot}
                        label="Runtime"
                        value={`${LLM_PROVIDER_LABELS[selectedProvider]}`}
                        detail={runtimeModel}
                      />
                      <InspectorMetricTile
                        icon={Shield}
                        label="Persistence"
                        value="Sandboxed"
                        detail="No long-term writes"
                      />
                      <InspectorMetricTile
                        icon={Radar}
                        label="Feed"
                        value={`${runEvents.length}`}
                        detail="Persisted events"
                      />
                    </div>

                    <div className={`${subPanel} p-4`}>
                      <div className="flex items-center gap-2">
                        <Sparkles className="h-4 w-4 text-pastel-blue" />
                        <div className={labelStyle}>Current directive</div>
                      </div>
                      <div className="mt-3 text-[12px] font-bold text-foreground">
                        {activeHeadDirective?.content || selectedRun.ledger.latestDirective || 'No directive published yet.'}
                      </div>
                      <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                        {activeHeadDirective?.summary || selectedRun.ledger.latestFocusQuestion || 'The head has not established a live focus question.'}
                      </div>
                      {headSignals.length > 0 ? (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {headSignals.map((signal) => (
                            <span key={signal} className="rounded-full border border-border/40 bg-muted/20 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                              {signal}
                            </span>
                          ))}
                        </div>
                      ) : null}
                      {typeof activeHeadPayload.degradedReason === 'string' && activeHeadPayload.degradedReason ? (
                        <div className="mt-3 rounded-sm border border-pastel-yellow/30 bg-pastel-yellow/10 px-3 py-2 text-[10px] leading-relaxed text-pastel-yellow">
                          {activeHeadPayload.degradedReason}
                        </div>
                      ) : null}
                    </div>

                    <div className={`${subPanel} p-4`}>
                      <div className={labelStyle}>Speaker queue</div>
                      <div className="mt-3 space-y-2">
                        {currentQueue.length === 0 ? (
                          <EmptyPanel copy="The head has not emitted a speaker order yet." compact />
                        ) : (
                          currentQueue.map((agentId, index) => {
                            const seat = selectedRun.seats.find((entry) => entry.agentId === agentId)
                            if (!seat) {
                              return null
                            }

                            const accent = participantAccent(index)
                            return (
                              <div key={agentId} className={`flex items-center justify-between rounded-sm border px-3 py-2 ${accent.panel}`}>
                                <div>
                                  <div className={`text-[12px] font-bold ${accent.text}`}>{seat.agentName}</div>
                                  <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">{seat.seatLabel}</div>
                                </div>
                                <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">#{index + 1}</div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    </div>

                    <div className={`${subPanel} p-4`}>
                      <div className={labelStyle}>Scoreboard</div>
                      <div className="mt-3 space-y-3">
                        {sortedScorecards.length === 0 ? (
                          <EmptyPanel copy="Scores appear after the first debater turns land." compact />
                        ) : (
                          sortedScorecards.map((scorecard, index) => (
                            <ScorecardPanel
                              key={scorecard.agentId}
                              scorecard={scorecard}
                              accentIndex={index}
                              isWinner={selectedRun.status === 'completed' && index === 0}
                            />
                          ))
                        )}
                      </div>
                    </div>

                    <div className={`${subPanel} p-4`}>
                      <div className={labelStyle}>Unresolved threads</div>
                      <div className="mt-3 space-y-2">
                        {(selectedRun.ledger.unresolvedThreads.length > 0
                          ? selectedRun.ledger.unresolvedThreads
                          : latestRound?.unresolvedThreads || []
                        ).length === 0 ? (
                          <EmptyPanel copy="The current ledger is relatively clean." compact />
                        ) : (
                          (selectedRun.ledger.unresolvedThreads.length > 0
                            ? selectedRun.ledger.unresolvedThreads
                            : latestRound?.unresolvedThreads || []
                          ).map((item) => (
                            <div key={item} className="rounded-sm border border-border/30 bg-muted/10 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
                              {item}
                            </div>
                          ))
                        )}
                      </div>
                    </div>
                  </>
                ) : (
                  <EmptyPanel copy="Open a run to inspect head state, queue order, and score movement." />
                )}
              </div>
            </section>

            <section className={`${premiumPanel} flex min-h-[18rem] flex-col overflow-hidden`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between gap-3">
                <div>
                  <div className={labelStyle}>Verdict Desk</div>
                  <h2 className="mt-1 text-lg font-bold text-foreground">Final report</h2>
                </div>
                {selectedRun?.finalReport?.winnerAgentName ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-pastel-yellow/30 bg-pastel-yellow/10 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-pastel-yellow">
                    <Crown className="h-3.5 w-3.5" />
                    {selectedRun.finalReport.winnerAgentName}
                  </div>
                ) : null}
              </div>

              <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
                {selectedRun?.finalReport ? (
                  <>
                    <div className="rounded-sm border border-pastel-yellow/30 bg-pastel-yellow/10 p-4">
                      <div className={labelStyle}>Verdict summary</div>
                      <p className="mt-2 text-[12px] leading-7 text-foreground/90">
                        {selectedRun.finalReport.verdictSummary}
                      </p>
                    </div>

                    <div className={`${subPanel} p-4`}>
                      <div className={labelStyle}>Decisive moments</div>
                      <div className="mt-3 space-y-3">
                        {selectedRun.finalReport.decisiveMoments.length === 0 ? (
                          <EmptyPanel copy="No decisive moments were stored." compact />
                        ) : (
                          selectedRun.finalReport.decisiveMoments.map((moment) => (
                            <div key={moment.eventId} className="rounded-sm border border-border/30 bg-muted/10 p-3">
                              <div className="text-[12px] font-bold text-foreground">{moment.title}</div>
                              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                                round {moment.round || 0}{moment.agentName ? ` / ${moment.agentName}` : ''}
                              </div>
                              <p className="mt-2 text-[11px] leading-relaxed text-muted-foreground">{moment.summary}</p>
                            </div>
                          ))
                        )}
                      </div>
                    </div>

                    <ReportListCard
                      title="Head interventions"
                      items={selectedRun.finalReport.headInterventionSummary}
                      emptyCopy="No intervention summary was stored."
                    />
                    <ReportListCard
                      title="Improvement notes"
                      items={selectedRun.finalReport.improvementNotes}
                      emptyCopy="The head did not record improvement notes."
                    />
                    <ReportListCard
                      title="Unresolved questions"
                      items={selectedRun.finalReport.unresolvedQuestions}
                      emptyCopy="The head closed the run without major unresolved questions."
                    />
                  </>
                ) : (
                  <EmptyPanel copy="The verdict panel fills after the head completes the final evaluation." />
                )}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  )
}

function WorkspaceMetric({
  label,
  value,
  detail,
}: {
  label: string
  value: string | number
  detail: string
}) {
  return (
    <div className={`${subPanel} p-3`}>
      <div className={labelStyle}>{label}</div>
      <div className="mt-1 text-lg font-black tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{detail}</div>
    </div>
  )
}

function InspectorMetricTile({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Activity
  label: string
  value: string
  detail: string
}) {
  return (
    <div className={`${subPanel} p-3`}>
      <div className="flex items-start gap-2">
        <div className="rounded-sm border border-border/30 bg-muted/20 p-1.5 text-pastel-blue">
          <Icon className="h-3.5 w-3.5" />
        </div>
        <div className="min-w-0">
          <div className={labelStyle}>{label}</div>
          <div className="mt-1 truncate text-[12px] font-bold text-foreground">{value}</div>
          <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{detail}</div>
        </div>
      </div>
    </div>
  )
}

function SeatEditorCard({
  seat,
  accentIndex,
  onChange,
}: {
  seat: ArenaSeat
  accentIndex: number
  onChange: (seat: ArenaSeat) => void
}) {
  const accent = participantAccent(accentIndex)

  return (
    <div className={`rounded-sm border p-4 ${accent.panel}`}>
      <div className="flex items-center gap-2">
        <span className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} />
        <div className={`text-[12px] font-bold ${accent.text}`}>{seat.agentName}</div>
      </div>

      <div className="mt-4 grid gap-4">
        <div className="space-y-1.5">
          <div className={labelStyle}>Seat label</div>
          <Input
            value={seat.seatLabel}
            onChange={(event) => onChange({ ...seat, seatLabel: event.target.value })}
            className="border-border/30 bg-muted/5 text-[12px]"
            placeholder="Seat label"
          />
        </div>

        <div className="space-y-1.5">
          <div className={labelStyle}>Stance brief</div>
          <Textarea
            value={seat.stanceBrief}
            onChange={(event) => onChange({ ...seat, stanceBrief: event.target.value })}
            className="min-h-[128px] border-border/30 bg-muted/5 text-[12px]"
            placeholder="What exact line should this seat hold?"
          />
        </div>

        <div className="space-y-1.5">
          <div className={labelStyle}>Win condition</div>
          <Textarea
            value={seat.winCondition}
            onChange={(event) => onChange({ ...seat, winCondition: event.target.value })}
            className="min-h-[84px] border-border/30 bg-muted/5 text-[12px]"
            placeholder="What counts as winning for this seat?"
          />
        </div>
      </div>
    </div>
  )
}

function ArenaEventCard({
  event,
  seats,
  seat,
  seatIndex,
}: {
  event: ArenaEvent
  seats: ArenaSeat[]
  seat?: ArenaSeat
  seatIndex: number
}) {
  const payload = getPayloadRecord(event)
  const accent = participantAccent(seatIndex >= 0 ? seatIndex : 0)
  const isHead = event.speakerType === 'head'
  const isDebater = event.speakerType === 'debater'
  const isSystem = event.speakerType === 'system'
  const degraded = Boolean(payload.degraded)
  const degradedReason = typeof payload.degradedReason === 'string' ? payload.degradedReason : ''
  const targets = stringList(payload.targetAgentIds).map((agentId) => getSeatName(agentId, seats))
  const concedes = stringList(payload.concedes)
  const scoreDelta = payload.scoreDelta && typeof payload.scoreDelta === 'object'
    ? payload.scoreDelta as Record<string, unknown>
    : null
  const nextPressurePoint = typeof payload.nextPressurePoint === 'string' ? payload.nextPressurePoint : ''
  const isClosing = Boolean(payload.closing)

  const panelTone = isHead
    ? 'border-pastel-blue/30 bg-pastel-blue/10'
    : isDebater
      ? accent.panel
      : 'border-border/30 bg-muted/10'

  const speakerTone = isHead
    ? 'text-pastel-blue'
    : isDebater
      ? accent.text
      : 'text-foreground'

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={`rounded-sm border p-4 ${panelTone}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span className={`text-[12px] font-bold ${speakerTone}`}>
              {event.speakerName || (isHead ? 'Arena Head' : 'System')}
            </span>
            <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
              {formatEventKind(event.kind)}
            </span>
            {typeof event.round === 'number' && event.round > 0 ? (
              <span className="rounded-full border border-border/40 bg-muted/20 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                round {event.round}
              </span>
            ) : null}
            {isClosing ? (
              <span className="rounded-full border border-pastel-yellow/30 bg-pastel-yellow/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-pastel-yellow">
                closing
              </span>
            ) : null}
            {degraded ? (
              <span className="rounded-full border border-pastel-yellow/30 bg-pastel-yellow/10 px-2 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-pastel-yellow">
                degraded
              </span>
            ) : null}
          </div>
          <div className="mt-2 text-[14px] font-bold text-foreground">{event.title}</div>
        </div>

        <div className="text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
          {formatTime(event.createdAt)}
        </div>
      </div>

      <div className="mt-4 text-[13px] leading-7 text-foreground/90">
        {event.content}
      </div>

      {event.summary && event.summary !== event.content ? (
        <div className="mt-4 rounded-sm border border-border/30 bg-background/35 px-3 py-2">
          <div className={labelStyle}>Summary</div>
          <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{event.summary}</div>
        </div>
      ) : null}

      {isDebater && seat ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          <div className={`${subPanel} p-3`}>
            <div className={labelStyle}>Seat</div>
            <div className="mt-1 text-[11px] font-bold text-foreground">{seat.seatLabel}</div>
            <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">source {seat.source}</div>
          </div>

          <div className={`${subPanel} p-3`}>
            <div className={labelStyle}>Turn signals</div>
            <div className="mt-1 flex flex-wrap gap-2">
              {targets.length > 0 ? (
                <span className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-[10px] font-bold text-foreground">
                  targets {targets.join(', ')}
                </span>
              ) : null}
              {concedes.length > 0 ? (
                <span className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-[10px] font-bold text-foreground">
                  concedes {concedes.join(', ')}
                </span>
              ) : null}
              {scoreDelta && typeof scoreDelta.total === 'number' ? (
                <span className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-[10px] font-bold text-foreground">
                  +{scoreDelta.total} points
                </span>
              ) : null}
            </div>
            {nextPressurePoint ? (
              <div className="mt-2 text-[11px] leading-relaxed text-muted-foreground">
                Next pressure: {nextPressurePoint}
              </div>
            ) : null}
          </div>
        </div>
      ) : null}

      {isHead && headMetaAvailable(payload) ? (
        <div className="mt-4 grid gap-3 lg:grid-cols-2">
          {stringList(payload.scoreSignals).length > 0 ? (
            <div className={`${subPanel} p-3`}>
              <div className={labelStyle}>Score signals</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {stringList(payload.scoreSignals).map((signal) => (
                  <span key={signal} className="rounded-full border border-border/40 bg-muted/20 px-2.5 py-1 text-[10px] font-bold text-foreground">
                    {signal}
                  </span>
                ))}
              </div>
            </div>
          ) : null}

          {typeof payload.rationaleSummary === 'string' && payload.rationaleSummary ? (
            <div className={`${subPanel} p-3`}>
              <div className={labelStyle}>Rationale</div>
              <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{payload.rationaleSummary}</div>
            </div>
          ) : null}
        </div>
      ) : null}

      {isSystem ? (
        <div className="mt-4 text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          {getStageLabel(event.stage)}
        </div>
      ) : null}

      {degradedReason ? (
        <div className="mt-4 rounded-sm border border-pastel-yellow/30 bg-pastel-yellow/10 px-3 py-2 text-[10px] leading-relaxed text-pastel-yellow">
          {degradedReason}
        </div>
      ) : null}
    </motion.article>
  )
}

function headMetaAvailable(payload: Record<string, unknown>) {
  return stringList(payload.scoreSignals).length > 0 || Boolean(payload.rationaleSummary)
}

function ScorecardPanel({
  scorecard,
  accentIndex,
  isWinner,
}: {
  scorecard: ArenaScorecard
  accentIndex: number
  isWinner: boolean
}) {
  const accent = participantAccent(accentIndex)

  return (
    <div className="rounded-sm border border-border/30 bg-muted/10 p-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className={`text-[12px] font-bold ${accent.text}`}>{scorecard.agentName}</div>
          <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
            {isWinner ? 'winner line' : 'live standing'}
          </div>
        </div>
        <div className="text-xl font-black tracking-tight text-foreground">{scorecard.total}</div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
        <span>clarity {scorecard.clarity}</span>
        <span>pressure {scorecard.pressure}</span>
        <span>respond {scorecard.responsiveness}</span>
        <span>consist {scorecard.consistency}</span>
      </div>
      <p className="mt-3 text-[11px] leading-relaxed text-muted-foreground">{scorecard.summary}</p>
    </div>
  )
}

function ReportListCard({
  title,
  items,
  emptyCopy,
}: {
  title: string
  items: string[]
  emptyCopy: string
}) {
  return (
    <div className={`${subPanel} p-4`}>
      <div className={labelStyle}>{title}</div>
      <div className="mt-3 space-y-2">
        {items.length === 0 ? (
          <EmptyPanel copy={emptyCopy} compact />
        ) : (
          items.map((item) => (
            <div key={item} className="rounded-sm border border-border/30 bg-muted/10 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">
              {item}
            </div>
          ))
        )}
      </div>
    </div>
  )
}

function EmptyArenaState() {
  return (
    <div className="flex h-full items-center justify-center text-center">
      <div className="max-w-lg">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-sm border border-border/40 bg-muted/20 text-pastel-blue">
          <CheckCircle2 className="h-8 w-8" />
        </div>
        <h2 className="mt-5 text-2xl font-black tracking-tight text-foreground">Arena feed waiting</h2>
        <p className="mt-3 text-[13px] leading-7 text-muted-foreground">
          Once a run exists, the head directives, speaker turns, score updates, and final report land here in sequence.
        </p>
      </div>
    </div>
  )
}

function EmptyPanel({
  copy,
  compact = false,
}: {
  copy: string
  compact?: boolean
}) {
  return (
    <div className={`rounded-sm border border-dashed border-border/30 bg-muted/5 text-center text-muted-foreground italic ${compact ? 'px-3 py-4 text-[10px]' : 'px-4 py-8 text-[11px]'}`}>
      {copy}
    </div>
  )
}
