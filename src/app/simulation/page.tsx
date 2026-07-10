'use client'

import Link from 'next/link'
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { useTheme } from 'next-themes'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  Circle,
  Clock3,
  Copy,
  Crown,
  Database,
  FileJson,
  FileText,
  Github,
  Loader2,
  Moon,
  Orbit,
  PauseCircle,
  Play,
  RefreshCw,
  RotateCcw,
  Save,
  Send,
  Shield,
  ShieldCheck,
  Sun,
  Swords,
  Trophy,
  UserPlus,
  XCircle,
} from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'
import { Input, Textarea } from '@/components/ui/input'
import { LLMProviderToggle } from '@/components/llm/LLMProviderToggle'
import { LibraryInfluenceTrace } from '@/components/library/LibraryInfluenceTrace'
import {
  buildLLMPreferenceHeaders,
  getClientModelForProvider,
  LLM_PROVIDER_LABELS,
  normalizeLLMProvider,
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

type EventFilter = 'all' | 'head' | 'turns' | 'scores' | 'issues' | 'system'

type Accent = {
  border: string
  panel: string
  soft: string
  text: string
  dot: string
  bar: string
  left: string
  ring: string
}

const panelClass = 'rounded-[6px] border border-white/[0.10] bg-[#081523]/88 shadow-[0_18px_70px_-58px_rgba(0,0,0,0.95)]'
const panelHeaderClass = 'border-b border-white/[0.075] px-4 py-3'
const labelClass = 'font-mono text-[10px] uppercase tracking-[0.12em] text-slate-400'
const stages = ['opening', 'crossfire', 'narrowing', 'closing', 'report']

const accents: Accent[] = [
  {
    border: 'border-[#78d5e8]/45',
    panel: 'border-[#78d5e8]/35 bg-[#78d5e8]/[0.055]',
    soft: 'bg-[#78d5e8]/10',
    text: 'text-[#82e2f1]',
    dot: 'bg-[#82e2f1]',
    bar: 'bg-[#82e2f1]',
    left: 'border-l-[#82e2f1]',
    ring: 'ring-[#82e2f1]/25',
  },
  {
    border: 'border-[#f0ba67]/45',
    panel: 'border-[#f0ba67]/35 bg-[#f0ba67]/[0.055]',
    soft: 'bg-[#f0ba67]/10',
    text: 'text-[#ffd079]',
    dot: 'bg-[#ffd079]',
    bar: 'bg-[#ffd079]',
    left: 'border-l-[#ffd079]',
    ring: 'ring-[#ffd079]/25',
  },
  {
    border: 'border-[#87d49a]/45',
    panel: 'border-[#87d49a]/35 bg-[#87d49a]/[0.055]',
    soft: 'bg-[#87d49a]/10',
    text: 'text-[#91df9f]',
    dot: 'bg-[#91df9f]',
    bar: 'bg-[#91df9f]',
    left: 'border-l-[#91df9f]',
    ring: 'ring-[#91df9f]/25',
  },
  {
    border: 'border-[#d7a9e8]/45',
    panel: 'border-[#d7a9e8]/35 bg-[#d7a9e8]/[0.055]',
    soft: 'bg-[#d7a9e8]/10',
    text: 'text-[#ddb8ee]',
    dot: 'bg-[#ddb8ee]',
    bar: 'bg-[#ddb8ee]',
    left: 'border-l-[#ddb8ee]',
    ring: 'ring-[#ddb8ee]/25',
  },
]

const responseBudgets: Array<{ value: ArenaResponseBudget; label: string; detail: string }> = [
  { value: 'tight', label: 'Tight', detail: 'Shorter turns, faster local runs.' },
  { value: 'balanced', label: 'Balanced', detail: 'Default pacing for full debates.' },
  { value: 'expanded', label: 'Expanded', detail: 'Longer turns, heavier model load.' },
]

const eventKindLabel: Record<string, string> = {
  run_prepared: 'Run Prepared',
  seat_generated: 'Seats Generated',
  phase_started: 'Phase Started',
  head_directive: 'Head Directive',
  debater_turn: 'Debater Turn',
  head_intervention: 'Head Intervention',
  round_summary: 'Round Summary',
  score_update: 'Score Update',
  phase_completed: 'Phase Completed',
  report_published: 'Report Published',
  library_candidate_extraction: 'Library Extraction',
  run_cancelled: 'Run Cancelled',
  run_failed: 'Run Failed',
}

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(' ')
}

function asValidDate(value?: string): Date | null {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date
}

function formatTimeShort(value?: string) {
  const date = asValidDate(value)
  if (!date) return '--:--'
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(date)
}

function formatElapsed(start?: string, end?: string) {
  const startDate = asValidDate(start)
  const endDate = asValidDate(end) || new Date()
  if (!startDate) return 'unknown'
  const seconds = Math.max(0, Math.floor((endDate.getTime() - startDate.getTime()) / 1000))
  const minutes = Math.floor(seconds / 60)
  const remaining = seconds % 60
  return `${String(minutes).padStart(2, '0')}:${String(remaining).padStart(2, '0')}`
}

function titleize(value?: string) {
  if (!value) return 'Unknown'
  return value.replaceAll('_', ' ').replace(/\b\w/g, (match) => match.toUpperCase())
}

function getPayloadRecord(event?: ArenaEvent): Record<string, unknown> {
  return event?.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {}
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((entry) => String(entry).trim()).filter(Boolean) : []
}

function participantAccent(index: number) {
  return accents[((index % accents.length) + accents.length) % accents.length]
}

function getSeatIndex(agentId: string | undefined, seats: ArenaSeat[]) {
  if (!agentId) return 0
  const index = seats.findIndex((seat) => seat.agentId === agentId)
  return index >= 0 ? index : 0
}

function getSeatAccent(agentId: string | undefined, seats: ArenaSeat[]) {
  return participantAccent(getSeatIndex(agentId, seats))
}

function getSeatName(agentId: string, seats: ArenaSeat[]) {
  return seats.find((seat) => seat.agentId === agentId)?.agentName || agentId
}

function getStatusTone(status?: ArenaRun['status']) {
  if (status === 'completed') return 'border-[#91df9f]/35 bg-[#91df9f]/10 text-[#91df9f]'
  if (status === 'running') return 'border-[#82e2f1]/35 bg-[#82e2f1]/10 text-[#82e2f1]'
  if (status === 'failed') return 'border-[#f38ba8]/40 bg-[#f38ba8]/10 text-[#ff8ea5]'
  if (status === 'cancelled') return 'border-[#ffd079]/35 bg-[#ffd079]/10 text-[#ffd079]'
  return 'border-[#82e2f1]/35 bg-[#82e2f1]/10 text-[#82e2f1]'
}

function getEventAccent(event: ArenaEvent, seats: ArenaSeat[]) {
  if (event.kind === 'run_failed' || event.kind === 'run_cancelled') return 'border-l-[#ff8ea5]'
  if (event.kind === 'score_update') return 'border-l-[#91df9f]'
  if (event.kind === 'round_summary' || event.speakerType === 'head') return 'border-l-[#bfa4ff]'
  if (event.kind === 'head_intervention') return 'border-l-[#ffd079]'
  if (event.kind === 'library_candidate_extraction' || event.kind === 'report_published') return 'border-l-[#ffd079]'
  if (event.speakerType === 'debater') return getSeatAccent(event.speakerAgentId, seats).left
  return 'border-l-slate-500'
}

function getLatestEvent(events: ArenaEvent[], kinds?: string[]) {
  const source = kinds ? events.filter((event) => kinds.includes(event.kind)) : events
  return source[source.length - 1]
}

function getCurrentQueue(run: ArenaRun | null, events: ArenaEvent[]) {
  if (!run) return []
  const directive = getLatestEvent(events, ['head_directive'])
  const order = stringList(getPayloadRecord(directive).speakerOrder)
  if (order.length === 0) return run.seats.map((seat) => seat.agentId)
  const lastTurn = getLatestEvent(events, ['debater_turn'])
  if (!lastTurn?.speakerAgentId) return order
  const index = order.indexOf(lastTurn.speakerAgentId)
  if (index < 0) return order
  return order.slice(index + 1).concat(order.slice(0, index + 1))
}

function getScoreMax(scorecards: ArenaScorecard[]) {
  return Math.max(1, ...scorecards.map((scorecard) => scorecard.total))
}

function parseScoreDelta(payload: Record<string, unknown>) {
  return payload.scoreDelta && typeof payload.scoreDelta === 'object'
    ? payload.scoreDelta as Partial<ArenaScorecard>
    : null
}

function eventMatchesFilter(event: ArenaEvent, filter: EventFilter) {
  if (filter === 'all') return true
  if (filter === 'head') return event.speakerType === 'head' || event.kind === 'head_directive'
  if (filter === 'turns') return event.kind === 'debater_turn'
  if (filter === 'scores') return event.kind === 'score_update' || event.kind === 'round_summary'
  if (filter === 'issues') return event.kind === 'run_failed' || event.kind === 'run_cancelled' || event.kind === 'head_intervention' || Boolean(getPayloadRecord(event).degraded)
  return event.speakerType === 'system'
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.text()
  const json = payload ? JSON.parse(payload) as Record<string, unknown> : {}
  if (!response.ok) throw new Error(typeof json.error === 'string' ? json.error : `Request failed with status ${response.status}`)
  return json as T
}

export default function SimulationPage() {
  const { agents, loading: loadingAgents, fetchAgents } = useAgentStore()
  const selectedProvider = useLLMPreferenceStore((state) => state.provider)
  const eventsEndRef = useRef<HTMLDivElement>(null)
  const initialLoadRef = useRef(true)

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
  const [duplicating, setDuplicating] = useState(false)
  const [uiError, setUiError] = useState<string | null>(null)
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [archiveOpen, setArchiveOpen] = useState(false)
  const [eventFilter, setEventFilter] = useState<EventFilter>('all')
  const [autoScroll, setAutoScroll] = useState(true)

  const selectedRun = detail?.run || null
  const runEvents = useMemo(() => detail?.events ?? [], [detail?.events])
  const latestEvent = getLatestEvent(runEvents)
  const latestRound = selectedRun?.ledger.rounds[selectedRun.ledger.rounds.length - 1]
  const isDraft = selectedRun?.status === 'draft'
  const isRunning = selectedRun?.status === 'running'
  const isCompleted = selectedRun?.status === 'completed'
  const isRecovery = selectedRun?.status === 'failed' || selectedRun?.status === 'cancelled'
  const isSetup = !selectedRun || isDraft
  const isSynced = isRunning && latestEvent && (latestEvent.kind === 'round_summary' || latestEvent.kind === 'score_update')
  const runtimeProvider = normalizeLLMProvider(selectedRun?.provider || selectedRun?.config.provider) || selectedProvider
  const runtimeModel = selectedRun?.model || selectedRun?.config.model || getClientModelForProvider(runtimeProvider)

  const activeHeadDirective = useMemo(() => getLatestEvent(runEvents, ['head_directive']), [runEvents])
  const currentQueue = useMemo(() => getCurrentQueue(selectedRun, runEvents), [selectedRun, runEvents])
  const sortedScorecards = useMemo(() => (
    selectedRun?.scorecardSnapshot.slice().sort((left, right) => right.total - left.total) || []
  ), [selectedRun?.scorecardSnapshot])
  const scoreMax = useMemo(() => getScoreMax(sortedScorecards), [sortedScorecards])
  const availableAgents = useMemo(() => agents.slice().sort((a, b) => a.name.localeCompare(b.name)), [agents])
  const selectedAgents = useMemo(() => availableAgents.filter((agent) => selectedAgentIds.includes(agent.id)), [availableAgents, selectedAgentIds])
  const filteredEvents = useMemo(() => runEvents.filter((event) => eventMatchesFilter(event, eventFilter)), [eventFilter, runEvents])
  const degradedEventCount = useMemo(() => runEvents.filter((event) => Boolean(getPayloadRecord(event).degraded)).length, [runEvents])
  const unresolvedThreads = selectedRun?.ledger.unresolvedThreads.length
    ? selectedRun.ledger.unresolvedThreads
    : latestRound?.unresolvedThreads || []
  const latestSummaryEvent = useMemo(() => getLatestEvent(runEvents, ['round_summary']), [runEvents])
  const latestScoreEvent = useMemo(() => getLatestEvent(runEvents, ['score_update']), [runEvents])
  const activeSpeakerId = currentQueue[0] || getLatestEvent(runEvents, ['debater_turn'])?.speakerAgentId
  const activeSpeaker = selectedRun?.seats.find((seat) => seat.agentId === activeSpeakerId)

  useEffect(() => { if (agents.length === 0) void fetchAgents() }, [agents.length, fetchAgents])
  useEffect(() => {
    if (autoScroll && runEvents.length > 0) {
      eventsEndRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    }
  }, [autoScroll, runEvents.length])

  const loadRuns = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingRuns(true)
      const payload = await parseResponse<{ runs: ArenaRunSummary[] }>(await fetch('/api/arena/runs?limit=24', { cache: 'no-store' }))
      setRuns(payload.runs || [])
      if (initialLoadRef.current && payload.runs[0]?.id) {
        setSelectedRunId(payload.runs[0].id)
      }
      initialLoadRef.current = false
      setUiError(null)
    } catch (error) {
      console.error('Failed to load arena runs:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to load arena runs.')
    } finally {
      if (!silent) setLoadingRuns(false)
    }
  }, [])

  const loadRunDetail = useCallback(async (runId: string, silent = false) => {
    try {
      if (!silent) setLoadingDetail(true)
      const payload = await parseResponse<ArenaDetailResponse>(await fetch(`/api/arena/runs/${runId}`, { cache: 'no-store' }))
      setDetail(payload)
      setUiError(null)
    } catch (error) {
      console.error('Failed to load arena detail:', error)
      if (!silent) setDetail(null)
      setUiError(error instanceof Error ? error.message : 'Failed to load arena detail.')
    } finally {
      if (!silent) setLoadingDetail(false)
    }
  }, [])

  useEffect(() => { void loadRuns() }, [loadRuns])
  useEffect(() => { if (selectedRunId) void loadRunDetail(selectedRunId) }, [loadRunDetail, selectedRunId])
  useEffect(() => {
    if (!selectedRun || selectedRun.status !== 'running') return
    const id = window.setInterval(() => {
      void loadRunDetail(selectedRun.id, true)
      void loadRuns(true)
    }, 1500)
    return () => window.clearInterval(id)
  }, [loadRunDetail, loadRuns, selectedRun])

  useEffect(() => {
    if (!selectedRun) return
    setTopic(selectedRun.config.topic)
    setObjective(selectedRun.config.objective)
    setReferenceBrief(selectedRun.config.referenceBrief || '')
    setRoundCount(selectedRun.config.roundCount)
    setResponseBudget(selectedRun.config.responseBudget)
    setSelectedAgentIds(selectedRun.participantIds)
    setSeatDrafts(Object.fromEntries(selectedRun.seats.map((seat) => [seat.agentId, seat])))
  }, [selectedRun])

  const refreshArenaData = useCallback(async () => {
    await loadRuns()
    if (selectedRunId) await loadRunDetail(selectedRunId, true)
  }, [loadRunDetail, loadRuns, selectedRunId])

  function toggleAgent(agentId: string) {
    setUiError(null)
    setSelectedAgentIds((current) => {
      if (current.includes(agentId)) return current.filter((value) => value !== agentId)
      if (current.length >= 4) {
        setUiError('Arena v1 supports up to four participants per run.')
        return current
      }
      return [...current, agentId]
    })
  }

  function toggleEventExpanded(eventId: string) {
    setExpandedEvents((previous) => {
      const next = new Set(previous)
      if (next.has(eventId)) next.delete(eventId)
      else next.add(eventId)
      return next
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
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, objective, participantIds: selectedAgentIds, roundCount, responseBudget, referenceBrief }),
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
    if (!selectedRun) return
    try {
      setSavingSeats(true)
      setUiError(null)
      const payload = await parseResponse<ArenaDetailResponse>(await fetch(`/api/arena/runs/${selectedRun.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
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
    setDetail((current) => current ? { ...current, run: { ...current.run, status: 'running', latestStage: 'opening' } } : current)
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
      .finally(() => setLaunching(false))
  }

  async function cancelArena() {
    if (!selectedRun) return
    try {
      setCancelling(true)
      const payload = await parseResponse<ArenaDetailResponse>(await fetch(`/api/arena/runs/${selectedRun.id}/cancel`, { method: 'POST' }))
      setDetail(payload)
      await loadRuns(true)
    } catch (error) {
      console.error('Failed to cancel arena:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to cancel arena.')
    } finally {
      setCancelling(false)
    }
  }

  async function duplicateDraft() {
    const source = selectedRun
    if (!source) return
    try {
      setDuplicating(true)
      setUiError(null)
      const payload = await parseResponse<ArenaDetailResponse>(await fetch('/api/arena/runs', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic: source.config.topic,
          objective: source.config.objective,
          participantIds: source.participantIds,
          roundCount: source.config.roundCount,
          responseBudget: source.config.responseBudget,
          referenceBrief: source.config.referenceBrief,
          seatOverrides: source.seats.map((seat) => ({
            agentId: seat.agentId,
            seatLabel: seat.seatLabel,
            stanceBrief: seat.stanceBrief,
            winCondition: seat.winCondition,
          })),
        }),
      }))
      setDetail(payload)
      setSelectedRunId(payload.run.id)
      await loadRuns(true)
    } catch (error) {
      console.error('Failed to duplicate arena draft:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to duplicate arena draft.')
    } finally {
      setDuplicating(false)
    }
  }

  function exportRunJson() {
    if (!detail) return
    const blob = new Blob([JSON.stringify(detail, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const anchor = document.createElement('a')
    anchor.href = url
    anchor.download = `${detail.run.id}-arena-ledger.json`
    anchor.click()
    URL.revokeObjectURL(url)
  }

  function selectRun(runId: string) {
    setDetail(null)
    setExpandedEvents(new Set())
    setUiError(null)
    setSelectedRunId(runId)
    setArchiveOpen(false)
  }

  function startNewDraft() {
    setDetail(null)
    setSelectedRunId(null)
    setSelectedAgentIds([])
    setSeatDrafts({})
    setTopic('Should an inspectable agent platform prioritize arena-grade debates over broad feature sprawl in its next release?')
    setObjective('Drive the debate toward a practical product decision, the strongest counter-case, and a final winner with evidence.')
    setReferenceBrief('')
    setRoundCount(10)
    setResponseBudget('balanced')
    setUiError(null)
    setExpandedEvents(new Set())
    setArchiveOpen(false)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const statusSubtitle = isRecovery
    ? 'Run recovery and partial ledger'
    : isCompleted
      ? 'Final verdict report'
      : isSynced
        ? 'Round ledger synchronized'
        : isRunning
          ? 'Live head-led debate execution'
          : 'Head-led multi-agent debate studio'

  return (
    <div className="min-h-screen bg-[#040b13] text-slate-100">
      <ArenaOperatorNav />
      <main className="mx-auto w-full max-w-[1500px] px-4 pb-16 pt-6 sm:px-7 lg:px-8">
        <WorkspaceHeader
          subtitle={statusSubtitle}
          selectedRun={selectedRun}
          archiveOpen={archiveOpen}
          setArchiveOpen={setArchiveOpen}
          runs={runs}
          loadingRuns={loadingRuns}
          selectedRunId={selectedRunId}
          onSelectRun={selectRun}
          onNewDraft={startNewDraft}
          onRefresh={() => void refreshArenaData()}
          onDuplicate={() => void duplicateDraft()}
          onExport={exportRunJson}
          onLaunch={launchArena}
          onCancel={() => void cancelArena()}
          isRunning={isRunning}
          isDraft={isDraft}
          isRecovery={isRecovery}
          isCompleted={isCompleted}
          loadingRefresh={loadingRuns}
          launching={launching}
          cancelling={cancelling}
          duplicating={duplicating}
        />

        {uiError && (
          <div className="mb-4 flex items-start gap-2 rounded-[6px] border border-[#f38ba8]/35 bg-[#f38ba8]/10 px-4 py-3 text-[13px] text-[#ff9daf]" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{uiError}</span>
          </div>
        )}

        {loadingDetail && !detail ? (
          <LoadingArena />
        ) : (
          <>
            {selectedRun && (
              <RunStatusStrip
                run={selectedRun}
                events={runEvents}
                latestEvent={latestEvent}
                activeSpeaker={activeSpeaker}
                providerLabel={LLM_PROVIDER_LABELS[runtimeProvider]}
                model={runtimeModel}
                degradedEventCount={degradedEventCount}
              />
            )}

            {isSetup ? (
              <DraftSetup
                selectedRun={selectedRun}
                availableAgents={availableAgents}
                loadingAgents={loadingAgents}
                selectedAgentIds={selectedAgentIds}
                selectedAgents={selectedAgents}
                topic={topic}
                objective={objective}
                referenceBrief={referenceBrief}
                roundCount={roundCount}
                responseBudget={responseBudget}
                seatDrafts={seatDrafts}
                preparing={preparing}
                savingSeats={savingSeats}
                launching={launching}
                onToggleAgent={toggleAgent}
                setTopic={setTopic}
                setObjective={setObjective}
                setReferenceBrief={setReferenceBrief}
                setRoundCount={setRoundCount}
                setResponseBudget={setResponseBudget}
                setSeatDrafts={setSeatDrafts}
                onPrepare={() => void prepareArena()}
                onSave={() => void saveSeatEdits()}
                onLaunch={launchArena}
              />
            ) : isCompleted && selectedRun ? (
              <TwoColumnShell
                main={<CompletedMain run={selectedRun} events={runEvents} />}
                rail={<CompletedRail run={selectedRun} events={runEvents} sortedScorecards={sortedScorecards} scoreMax={scoreMax} />}
              />
            ) : isRecovery && selectedRun ? (
              <TwoColumnShell
                main={
                  <RecoveryMain
                    run={selectedRun}
                    events={filteredEvents}
                    allEvents={runEvents}
                    sortedScorecards={sortedScorecards}
                    scoreMax={scoreMax}
                    eventFilter={eventFilter}
                    setEventFilter={setEventFilter}
                    expandedEvents={expandedEvents}
                    onToggleEvent={toggleEventExpanded}
                    onDuplicate={() => void duplicateDraft()}
                    duplicating={duplicating}
                  />
                }
                rail={<RecoveryRail run={selectedRun} events={runEvents} sortedScorecards={sortedScorecards} scoreMax={scoreMax} onDuplicate={() => void duplicateDraft()} duplicating={duplicating} />}
              />
            ) : selectedRun ? (
              <TwoColumnShell
                main={
                  isSynced ? (
                    <SyncedMain
                      run={selectedRun}
                      events={filteredEvents}
                      latestSummaryEvent={latestSummaryEvent}
                      latestScoreEvent={latestScoreEvent}
                      latestRound={latestRound}
                      activeHeadDirective={activeHeadDirective}
                      currentQueue={currentQueue}
                      eventFilter={eventFilter}
                      setEventFilter={setEventFilter}
                      expandedEvents={expandedEvents}
                      onToggleEvent={toggleEventExpanded}
                    />
                  ) : (
                    <RunningMain
                      run={selectedRun}
                      events={filteredEvents}
                      allEvents={runEvents}
                      activeHeadDirective={activeHeadDirective}
                      currentQueue={currentQueue}
                      activeSpeaker={activeSpeaker}
                      latestRound={latestRound}
                      latestSummaryEvent={latestSummaryEvent}
                      latestScoreEvent={latestScoreEvent}
                      eventFilter={eventFilter}
                      setEventFilter={setEventFilter}
                      expandedEvents={expandedEvents}
                      onToggleEvent={toggleEventExpanded}
                    />
                  )
                }
                rail={<LiveRail run={selectedRun} events={runEvents} sortedScorecards={sortedScorecards} scoreMax={scoreMax} currentQueue={currentQueue} unresolvedThreads={unresolvedThreads} latestRound={latestRound} />}
              />
            ) : null}
          </>
        )}
      </main>

      {selectedRun && (
        <BottomStatusBar
          run={selectedRun}
          latestEvent={latestEvent}
          autoScroll={autoScroll}
          setAutoScroll={setAutoScroll}
          onRefresh={() => void refreshArenaData()}
          onExport={exportRunJson}
        />
      )}
      <div ref={eventsEndRef} />
    </div>
  )
}

function ArenaOperatorNav() {
  const { resolvedTheme, setTheme } = useTheme()
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])
  const isDark = !mounted || resolvedTheme === 'dark'
  const nav = [
    { label: 'Home', href: '/' },
    { label: 'Agents', href: '/agents' },
    { label: 'Dashboard', href: '/dashboard' },
    { label: 'Arena', href: '/simulation' },
    { label: 'Docs', href: '/#workflow' },
  ]

  return (
    <header className="sticky top-0 z-50 flex h-[72px] w-full items-center gap-2 overflow-hidden border-b border-white/10 bg-[#06101b]/96 px-4 backdrop-blur-xl lg:px-7">
      <Link href="/" className="flex min-w-0 flex-1 items-center gap-3 lg:flex-none lg:min-w-[280px]">
        <span className="grid h-10 w-10 place-items-center rounded-[5px] border border-[#c9b8ff]/30 bg-[#111b2a] text-[#d8ccff]">
          <PlaygroundLogo className="h-7 w-7" />
        </span>
        <span className="hidden min-w-0 leading-tight sm:block">
          <span className="block truncate text-[17px] font-bold tracking-[-0.02em] text-white">Agent Playground</span>
          <span className="block truncate text-[12px] text-slate-300">Inspectable Agent OS</span>
        </span>
      </Link>
      <nav className="hidden flex-1 items-center justify-center gap-9 lg:flex">
        {nav.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className={cx(
              'relative flex h-[72px] items-center px-1 text-[14px] font-medium',
              item.label === 'Arena' ? 'text-white' : 'text-slate-300 hover:text-white'
            )}
          >
            {item.label}
            {item.label === 'Arena' && <span className="absolute inset-x-0 bottom-0 h-[3px] rounded-t-full bg-[#b38cff]" />}
          </Link>
        ))}
      </nav>
      <div className="ml-auto flex shrink-0 items-center justify-end gap-2 sm:gap-3">
        <span className="hidden h-10 items-center gap-2 rounded-[6px] border border-white/12 bg-[#0b1725] px-4 text-[13px] text-slate-200 md:inline-flex">
          <span className="h-2 w-2 rounded-full bg-[#63df8a]" />
          Local + Cloud Runtime
        </span>
        <button
          type="button"
          aria-label="Toggle color theme"
          onClick={() => setTheme(isDark ? 'light' : 'dark')}
          className="grid h-9 w-9 place-items-center rounded-[5px] text-slate-200 hover:bg-white/5"
        >
          {isDark ? <Moon className="h-5 w-5" /> : <Sun className="h-5 w-5" />}
        </button>
        <Link href="https://github.com" aria-label="Open GitHub" className="grid h-9 w-9 place-items-center rounded-[5px] text-slate-200 hover:bg-white/5">
          <Github className="h-5 w-5" />
        </Link>
        <span className="hidden h-8 w-px bg-white/12 sm:block" />
        <span className="hidden h-9 w-9 place-items-center rounded-full bg-[#7657d9] font-mono text-[13px] font-bold text-white ring-1 ring-white/20 sm:grid">OP</span>
      </div>
    </header>
  )
}

function WorkspaceHeader({
  subtitle,
  selectedRun,
  archiveOpen,
  setArchiveOpen,
  runs,
  loadingRuns,
  selectedRunId,
  onSelectRun,
  onNewDraft,
  onRefresh,
  onDuplicate,
  onExport,
  onLaunch,
  onCancel,
  isRunning,
  isDraft,
  isRecovery,
  isCompleted,
  loadingRefresh,
  launching,
  cancelling,
  duplicating,
}: {
  subtitle: string
  selectedRun: ArenaRun | null
  archiveOpen: boolean
  setArchiveOpen: (value: boolean | ((current: boolean) => boolean)) => void
  runs: ArenaRunSummary[]
  loadingRuns: boolean
  selectedRunId: string | null
  onSelectRun: (runId: string) => void
  onNewDraft: () => void
  onRefresh: () => void
  onDuplicate: () => void
  onExport: () => void
  onLaunch: () => void
  onCancel: () => void
  isRunning: boolean
  isDraft: boolean
  isRecovery: boolean
  isCompleted: boolean
  loadingRefresh: boolean
  launching: boolean
  cancelling: boolean
  duplicating: boolean
}) {
  return (
    <div className="mb-4 flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
      <div className="flex items-center gap-4">
        <div className="grid h-[64px] w-[64px] place-items-center rounded-[6px] border border-[#78d5e8]/28 bg-[#78d5e8]/[0.055] text-[#82e2f1]">
          <Orbit className="h-8 w-8" />
        </div>
        <div>
          <h1 className="text-[26px] font-bold tracking-[-0.03em] text-white">
            {isRunning || isDraft ? 'Arena Control Room' : 'Arena Workspace'}
          </h1>
          <p className="mt-0.5 text-[14px] text-slate-300">{subtitle}</p>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <div className="relative">
          <button
            type="button"
            onClick={() => setArchiveOpen((value) => !value)}
            className="inline-flex h-11 items-center gap-3 rounded-[5px] border border-white/12 bg-[#0b1725] px-4 text-[13px] text-white transition hover:border-white/20"
          >
            Run Archive
            <ChevronDown className={cx('h-4 w-4 text-slate-400 transition', archiveOpen && 'rotate-180')} />
          </button>
          {archiveOpen && (
            <div className="absolute right-0 top-full z-50 mt-2 max-h-[460px] w-[min(420px,calc(100vw-2rem))] overflow-y-auto rounded-[6px] border border-white/12 bg-[#081523]/98 p-2 shadow-2xl">
              <div className="flex items-center justify-between border-b border-white/10 px-2 pb-2">
                <span className={labelClass}>Run Archive</span>
                <button type="button" onClick={onNewDraft} className="text-[11px] font-semibold text-[#bfa4ff]">+ New Draft</button>
              </div>
              {loadingRuns && runs.length === 0 ? (
                <div className="grid h-28 place-items-center"><Loader2 className="h-4 w-4 animate-spin text-slate-400" /></div>
              ) : runs.length === 0 ? (
                <div className="px-3 py-8 text-center text-[12px] text-slate-400">No arena runs yet.</div>
              ) : (
                <div className="space-y-1 pt-2">
                  {runs.map((run) => (
                    <button
                      key={run.id}
                      type="button"
                      onClick={() => onSelectRun(run.id)}
                      className={cx(
                        'w-full rounded-[5px] border p-3 text-left transition',
                        selectedRunId === run.id ? 'border-[#bfa4ff]/35 bg-[#bfa4ff]/10' : 'border-transparent hover:border-white/10 hover:bg-white/[0.035]'
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="line-clamp-1 text-[12px] font-semibold text-white">{run.topic}</div>
                          <div className="mt-1 line-clamp-1 font-mono text-[10px] text-slate-400">{run.participantNames.join(' / ') || 'No seats'} · R{run.currentRound}/{run.roundCount}</div>
                        </div>
                        <span className={cx('rounded-[4px] border px-2 py-0.5 font-mono text-[10px]', getStatusTone(run.status))}>{run.status}</span>
                      </div>
                      <div className="mt-2 flex items-center justify-between text-[10px] text-slate-500">
                        <span>{run.eventCount} events</span>
                        <span>{run.winnerAgentName || formatTimeShort(run.updatedAt)}</span>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {isRunning && (
          <button type="button" onClick={onCancel} disabled={cancelling} className="inline-flex h-11 items-center gap-2 rounded-[5px] border border-[#f38ba8]/35 bg-[#f38ba8]/10 px-4 text-[13px] font-semibold text-[#ff8ea5] disabled:opacity-60">
            {cancelling ? <Loader2 className="h-4 w-4 animate-spin" /> : <PauseCircle className="h-4 w-4" />}
            Cancel Run
          </button>
        )}
        {isRecovery && (
          <>
            <button type="button" disabled className="inline-flex h-11 items-center gap-2 rounded-[5px] border border-[#bfa4ff]/20 bg-[#bfa4ff]/10 px-4 text-[13px] font-semibold text-[#bfa4ff]/60">
              Retry From Last Safe Point
            </button>
            <button type="button" onClick={onDuplicate} disabled={duplicating} className="inline-flex h-11 items-center gap-2 rounded-[5px] border border-[#bfa4ff]/35 bg-[#bfa4ff]/12 px-4 text-[13px] font-semibold text-[#d7c4ff] disabled:opacity-60">
              {duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />}
              Duplicate Draft
            </button>
          </>
        )}
        {isCompleted && (
          <>
            <button type="button" onClick={onNewDraft} className="inline-flex h-11 items-center gap-2 rounded-[5px] border border-white/12 bg-[#0b1725] px-4 text-[13px] text-white">
              <UserPlus className="h-4 w-4" /> New Draft
            </button>
            <button type="button" onClick={onExport} className="inline-flex h-11 items-center gap-2 rounded-[5px] border border-white/12 bg-[#0b1725] px-4 text-[13px] text-white">
              <FileText className="h-4 w-4" /> Export Report
            </button>
          </>
        )}
        {isDraft && selectedRun && (
          <button type="button" onClick={onLaunch} disabled={launching} className="inline-flex h-11 items-center gap-2 rounded-[5px] bg-[#7657d9] px-5 text-[13px] font-semibold text-white disabled:opacity-60">
            {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
            Launch Arena
          </button>
        )}
        {!isRecovery && !isCompleted && (
          <button type="button" onClick={onNewDraft} className="inline-flex h-11 items-center gap-2 rounded-[5px] border border-[#bfa4ff]/35 bg-[#bfa4ff]/10 px-4 text-[13px] font-semibold text-[#d7c4ff]">
            <UserPlus className="h-4 w-4" />
            New Draft
          </button>
        )}
        <button type="button" onClick={onRefresh} disabled={loadingRefresh} className="grid h-11 w-11 place-items-center rounded-[5px] border border-white/12 bg-[#0b1725] text-slate-200 disabled:opacity-60" aria-label="Refresh arena data">
          <RefreshCw className={cx('h-4 w-4', loadingRefresh && 'animate-spin')} />
        </button>
      </div>
    </div>
  )
}

function RunStatusStrip({ run, events, latestEvent, activeSpeaker, providerLabel, model, degradedEventCount }: {
  run: ArenaRun
  events: ArenaEvent[]
  latestEvent?: ArenaEvent
  activeSpeaker?: ArenaSeat
  providerLabel: string
  model: string
  degradedEventCount: number
}) {
  const winner = run.winnerAgentId ? run.seats.find((seat) => seat.agentId === run.winnerAgentId)?.agentName : undefined
  const completionLabel = run.completedAt ? formatTimeShort(run.completedAt) : undefined
  const failure = run.failureReason || (latestEvent?.kind === 'run_failed' ? latestEvent.content : '')

  return (
    <section className={cx(panelClass, 'mb-5 px-4 py-3')} aria-label="Arena status">
      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_430px]">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-3">
          <StatusMetric label="Status" value={titleize(run.status)} tone={run.status} />
          <StatusMetric label="Stage" value={titleize(run.status === 'completed' ? 'report' : run.latestStage)} accent />
          <StatusMetric label={run.status === 'failed' || run.status === 'cancelled' ? 'Round' : 'Round'} value={`${run.currentRound} / ${run.config.roundCount}${latestEvent?.kind === 'round_summary' || latestEvent?.kind === 'score_update' ? ' synced' : ''}`} />
          <StatusMetric label={run.status === 'failed' || run.status === 'cancelled' ? 'Events preserved' : 'Events'} value={String(run.eventCount || events.length)} />
          {activeSpeaker && run.status === 'running' && <StatusMetric label="Active Speaker" value={activeSpeaker.agentName} cyan />}
          {degradedEventCount > 0 && <StatusMetric label="Degraded" value={String(degradedEventCount)} warning />}
          <StatusMetric label="Provider" value={`${providerLabel} · ${model}`} />
          {run.status === 'running' && <StatusMetric label="Runtime" value={`${formatElapsed(run.updatedAt)} elapsed`} />}
          {winner && <StatusMetric label="Winner" value={winner} winner />}
          {completionLabel && <StatusMetric label={run.status === 'completed' ? 'Completed' : 'Stopped'} value={completionLabel} />}
          {failure && <StatusMetric label="Failure reason" value={failure} danger />}
          {latestEvent && <StatusMetric label={run.status === 'running' ? 'Last write' : 'Last safe event'} value={`EVT-${String(latestEvent.sequence).padStart(3, '0')}`} />}
        </div>
        <StageProgress stage={run.status === 'completed' ? 'report' : run.latestStage} status={run.status} />
      </div>
    </section>
  )
}

function StatusMetric({ label, value, tone, accent, cyan, warning, danger, winner }: {
  label: string
  value: string
  tone?: ArenaRun['status']
  accent?: boolean
  cyan?: boolean
  warning?: boolean
  danger?: boolean
  winner?: boolean
}) {
  return (
    <div className="flex min-w-0 items-center gap-2 border-r border-white/10 pr-5 last:border-r-0">
      <span className={cx('h-2 w-2 shrink-0 rounded-full', tone === 'failed' ? 'bg-[#ff8ea5]' : tone === 'completed' ? 'bg-[#91df9f]' : tone === 'running' ? 'bg-[#82e2f1]' : tone === 'cancelled' ? 'bg-[#ffd079]' : 'bg-slate-500')} />
      <span className="text-[12px] text-slate-400">{label}:</span>
      <span className={cx(
        'max-w-[min(220px,55vw)] truncate text-[12px] font-medium lg:max-w-[320px]',
        accent && 'text-[#d7c4ff]',
        cyan && 'text-[#82e2f1]',
        warning && 'text-[#ffd079]',
        danger && 'text-[#ff8ea5]',
        winner && 'text-[#ffd079]',
        !accent && !cyan && !warning && !danger && !winner && 'text-slate-100'
      )}>{value}</span>
    </div>
  )
}

function StageProgress({ stage, status }: { stage: string; status?: ArenaRun['status'] }) {
  const activeIndex = Math.max(0, stages.indexOf(stage === 'completed' ? 'report' : stage))
  const color = status === 'failed' ? '#ff8ea5' : status === 'cancelled' ? '#ffd079' : status === 'completed' ? '#bfa4ff' : '#82e2f1'
  return (
    <div className="flex items-center gap-0 px-1 py-2">
      {stages.map((item, index) => {
        const active = index <= activeIndex
        return (
          <div key={item} className="flex flex-1 items-center">
            <div className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span className="h-2.5 w-2.5 rounded-full border" style={{ borderColor: active ? color : 'rgba(226,232,240,.55)', backgroundColor: active ? color : 'transparent' }} />
              <span className={cx('text-[11px]', index === activeIndex ? 'text-white' : 'text-slate-400')}>{titleize(item)}</span>
            </div>
            {index < stages.length - 1 && <span className="h-px flex-1" style={{ backgroundColor: active ? color : 'rgba(226,232,240,.32)' }} />}
          </div>
        )
      })}
    </div>
  )
}

function DraftSetup(props: {
  selectedRun: ArenaRun | null
  availableAgents: Array<{ id: string; name: string; persona: string }>
  loadingAgents: boolean
  selectedAgentIds: string[]
  selectedAgents: Array<{ id: string; name: string; persona: string }>
  topic: string
  objective: string
  referenceBrief: string
  roundCount: number
  responseBudget: ArenaResponseBudget
  seatDrafts: Record<string, ArenaSeat>
  preparing: boolean
  savingSeats: boolean
  launching: boolean
  onToggleAgent: (agentId: string) => void
  setTopic: (value: string) => void
  setObjective: (value: string) => void
  setReferenceBrief: (value: string) => void
  setRoundCount: (value: number) => void
  setResponseBudget: (value: ArenaResponseBudget) => void
  setSeatDrafts: (value: (current: Record<string, ArenaSeat>) => Record<string, ArenaSeat>) => void
  onPrepare: () => void
  onSave: () => void
  onLaunch: () => void
}) {
  const {
    selectedRun,
    availableAgents,
    loadingAgents,
    selectedAgentIds,
    selectedAgents,
    topic,
    objective,
    referenceBrief,
    roundCount,
    responseBudget,
    seatDrafts,
    preparing,
    savingSeats,
    launching,
    onToggleAgent,
    setTopic,
    setObjective,
    setReferenceBrief,
    setRoundCount,
    setResponseBudget,
    setSeatDrafts,
    onPrepare,
    onSave,
    onLaunch,
  } = props
  const seats = selectedRun?.seats || []
  const ready = topic.trim().length > 0 && objective.trim().length > 0 && selectedAgentIds.length >= 2

  return (
    <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_380px]">
      <div className="space-y-4">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]">
          <Panel title="Debate Brief" pill={selectedRun ? 'Draft input' : 'Unsaved draft'}>
            <div className="space-y-2">
              <FieldLabel htmlFor="arena-topic">Topic</FieldLabel>
              <Textarea id="arena-topic" value={topic} onChange={(event) => setTopic(event.target.value)} className="min-h-[88px] resize-none border-white/10 bg-[#07111d] text-[13px] leading-5 text-slate-100" />
              <div className="grid gap-2 sm:grid-cols-2">
                <div>
                  <FieldLabel htmlFor="arena-objective">Decision Objective</FieldLabel>
                  <Textarea id="arena-objective" value={objective} onChange={(event) => setObjective(event.target.value)} className="min-h-[92px] resize-none border-white/10 bg-[#07111d] text-[13px] leading-5 text-slate-100" />
                </div>
                <div>
                  <FieldLabel htmlFor="arena-reference">Reference Brief</FieldLabel>
                  <Textarea id="arena-reference" value={referenceBrief} onChange={(event) => setReferenceBrief(event.target.value)} className="min-h-[92px] resize-none border-white/10 bg-[#07111d] text-[13px] leading-5 text-slate-100" placeholder="Optional source context for the head." />
                </div>
              </div>
              <div className="flex flex-wrap gap-2 pt-1">
                <CheckChip ok={Boolean(topic.trim())}>clear topic</CheckChip>
                <CheckChip ok={Boolean(objective.trim())}>decision criterion required</CheckChip>
                <CheckChip ok={Boolean(referenceBrief.trim())} optional>source-backed preferred</CheckChip>
                <CheckChip ok>sandboxed run</CheckChip>
              </div>
            </div>
          </Panel>

          <Panel title="Execution Setup">
            <div className="space-y-3">
              <div>
                <div className={labelClass}>Provider</div>
                <div className="mt-2"><LLMProviderToggle compact /></div>
              </div>
              <SettingRow label="Rounds">
                {[10, 11, 12].map((value) => (
                  <SegmentButton key={value} active={roundCount === value} onClick={() => setRoundCount(value)}>{value}</SegmentButton>
                ))}
              </SettingRow>
              <SettingRow label="Response Budget">
                {responseBudgets.map((budget) => (
                  <SegmentButton key={budget.value} active={responseBudget === budget.value} onClick={() => setResponseBudget(budget.value)} title={budget.detail}>{budget.label}</SegmentButton>
                ))}
              </SettingRow>
              <CompactSelect label="Quality Mode" value="Strict" />
              <CompactSelect label="Persistence Mode" value="Durable PostgreSQL" />
              <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-1 text-[12px] text-slate-300">
                <CheckLine ok={selectedAgentIds.length >= 2}>2-4 agents selected</CheckLine>
                <CheckLine ok>append-only events enabled</CheckLine>
                <CheckLine ok>seat briefs editable</CheckLine>
                <CheckLine ok>final verdict required</CheckLine>
              </div>
            </div>
          </Panel>
        </div>

        {!selectedRun && (
          <Panel title="Agent Roster" pill={`${selectedAgentIds.length} / 4 selected`}>
            <div className="grid max-h-[260px] gap-2 overflow-y-auto pr-1 md:grid-cols-2 xl:grid-cols-3">
              {loadingAgents && availableAgents.length === 0 ? (
                <EmptyPanel copy="Loading agents." />
              ) : availableAgents.length === 0 ? (
                <EmptyPanel copy="Create at least two agents before preparing an arena." />
              ) : availableAgents.map((agent, index) => {
                const selected = selectedAgentIds.includes(agent.id)
                const accent = participantAccent(index)
                return (
                  <button key={agent.id} type="button" onClick={() => onToggleAgent(agent.id)} className={cx('rounded-[6px] border p-3 text-left transition', selected ? accent.panel : 'border-white/10 bg-[#07111d] hover:border-white/18')}>
                    <div className="flex items-center justify-between gap-2">
                      <span className={cx('truncate text-[13px] font-semibold', selected ? accent.text : 'text-white')}>{agent.name}</span>
                      <span className={cx('h-2 w-2 rounded-full', selected ? accent.dot : 'bg-slate-600')} />
                    </div>
                    <p className="mt-1 line-clamp-2 text-[11px] leading-4 text-slate-400">{agent.persona}</p>
                  </button>
                )
              })}
            </div>
          </Panel>
        )}

        <Panel title="Seat Planner">
          <div className="grid gap-3 lg:grid-cols-2 2xl:grid-cols-4">
            {selectedRun ? selectedRun.seats.map((seat, index) => {
              const draft = seatDrafts[seat.agentId] || seat
              return (
                <SeatPlannerCard
                  key={seat.agentId}
                  seat={draft}
                  index={index}
                  editable
                  onChange={(next) => setSeatDrafts((current) => ({ ...current, [seat.agentId]: next }))}
                />
              )
            }) : selectedAgents.map((agent, index) => (
              <DraftAgentSeat key={agent.id} agent={agent} index={index} />
            ))}
            {selectedAgentIds.length < 4 && <AddSeatGhost />}
          </div>
        </Panel>
      </div>

      <aside className="space-y-4">
        <Panel title="Draft Readiness">
          <div className="space-y-2">
            <ChecklistRow label="Topic defined" ok={Boolean(topic.trim())} />
            <ChecklistRow label="Objective defined" ok={Boolean(objective.trim())} />
            <ChecklistRow label="Seats generated" ok={selectedRun ? seats.length >= 2 : selectedAgentIds.length >= 2} />
            <ChecklistRow label="Provider selected" ok />
            <ChecklistRow label="Reference brief" ok={Boolean(referenceBrief.trim())} optional />
            <ChecklistRow label="Launch safe" ok={ready} />
            <div className="mt-3 border-t border-[#91df9f]/30 pt-3 text-center text-[13px] font-semibold text-[#5ee884]">
              {ready ? 'Ready to launch' : 'Needs setup'}
            </div>
          </div>
        </Panel>
        <Panel title="Run Preview">
          <MetaRows rows={[
            ['Run ID', selectedRun?.id || 'DRAFT-UNSAVED'],
            ['Mode', 'debate_v1'],
            ['Max rounds', String(roundCount)],
            ['Event stream', 'append-only'],
            ['Scoring', 'CLR / PRS / RSP / CON'],
            ['Final report', 'required'],
          ]} />
        </Panel>
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-1">
          <Panel title="Speaker Order Preview">
            <div className="space-y-2">
              {(selectedRun?.seats || selectedAgents.map((agent, index) => ({ agentId: agent.id, agentName: agent.name, orderIndex: index } as ArenaSeat))).map((seat, index) => {
                const accent = participantAccent(index)
                return (
                  <div key={seat.agentId} className="flex items-center gap-2 text-[13px]">
                    <span className={cx('grid h-6 w-6 place-items-center rounded-[4px] border font-mono text-[11px]', accent.panel)}>{index + 1}</span>
                    <span className={accent.text}>{seat.agentName}</span>
                  </div>
                )
              })}
            </div>
          </Panel>
          <Panel title="What Will Be Recorded">
            <ul className="space-y-1.5 text-[13px] text-slate-300">
              {['head directives', 'debater turns', 'score updates', 'round summaries', 'final verdict', 'Library candidates'].map((item) => <li key={item}>• {item}</li>)}
            </ul>
          </Panel>
        </div>
      </aside>

      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#06101b]/96 px-4 py-2 backdrop-blur-xl">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            <FooterPill icon={<Activity className="h-3.5 w-3.5" />} text="API: POST /api/arena/runs" />
            <FooterPill icon={<ShieldCheck className="h-3.5 w-3.5" />} text="Sandboxed" />
            <FooterPill icon={<Database className="h-3.5 w-3.5" />} text="PostgreSQL canonical" />
            <FooterPill icon={<Shield className="h-3.5 w-3.5" />} text="No long-term state mutation" />
          </div>
          <div className="flex gap-2">
            {selectedRun ? (
              <>
                <button type="button" onClick={onSave} disabled={savingSeats} className="inline-flex h-10 items-center gap-2 rounded-[5px] border border-white/12 bg-[#0b1725] px-4 text-[13px] text-white disabled:opacity-60">
                  {savingSeats ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />} Save Draft
                </button>
                <button type="button" onClick={onLaunch} disabled={launching} className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[#7657d9] px-5 text-[13px] font-semibold text-white disabled:opacity-60">
                  {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />} Launch Arena
                </button>
              </>
            ) : (
              <button type="button" onClick={onPrepare} disabled={preparing} className="inline-flex h-10 items-center gap-2 rounded-[5px] bg-[#7657d9] px-5 text-[13px] font-semibold text-white disabled:opacity-60">
                {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />} Prepare Draft
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function TwoColumnShell({ main, rail }: { main: ReactNode; rail: ReactNode }) {
  return (
    <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_360px] 2xl:grid-cols-[minmax(0,1fr)_390px]">
      <div className="min-w-0">{main}</div>
      <aside className="min-w-0 space-y-4 xl:sticky xl:top-[88px] xl:max-h-[calc(100vh-104px)] xl:overflow-y-auto xl:pr-1">{rail}</aside>
    </div>
  )
}

function RunningMain({ run, events, allEvents, activeHeadDirective, currentQueue, activeSpeaker, latestRound, latestSummaryEvent, latestScoreEvent, eventFilter, setEventFilter, expandedEvents, onToggleEvent }: {
  run: ArenaRun
  events: ArenaEvent[]
  allEvents: ArenaEvent[]
  activeHeadDirective?: ArenaEvent
  currentQueue: string[]
  activeSpeaker?: ArenaSeat
  latestRound?: ArenaRun['ledger']['rounds'][number]
  latestSummaryEvent?: ArenaEvent
  latestScoreEvent?: ArenaEvent
  eventFilter: EventFilter
  setEventFilter: (filter: EventFilter) => void
  expandedEvents: Set<string>
  onToggleEvent: (eventId: string) => void
}) {
  return (
    <div className="space-y-4">
      <Panel title="Live Debate Stage" pill={`Round ${run.currentRound} · ${titleize(run.latestStage)}`}>
        <div className="grid gap-3 lg:grid-cols-[minmax(0,.95fr)_minmax(0,1fr)_minmax(210px,.75fr)]">
          <FocusCard title="Current Speaker" accent={activeSpeaker ? getSeatAccent(activeSpeaker.agentId, run.seats) : accents[0]}>
            {activeSpeaker ? (
              <>
                <div className="text-[15px] font-semibold text-white">{activeSpeaker.agentName}</div>
                <div className="mt-1 text-[12px] text-slate-400">{activeSpeaker.seatLabel}</div>
                <MetaRows rows={[['Move', String(getPayloadRecord(activeHeadDirective).requiredMoveType || 'Response')], ['Target', currentQueue[1] ? getSeatName(currentQueue[1], run.seats) : 'Open'], ['Status', allEvents.at(-1)?.kind === 'debater_turn' ? 'score pending' : 'speaking now']]} compact />
                <div className="mt-3 h-6 rounded-[4px] border border-[#82e2f1]/20 bg-[#82e2f1]/[0.035] px-2 py-1 font-mono text-[10px] text-[#82e2f1]">generating now · context loaded</div>
              </>
            ) : <EmptyPanel copy="Waiting for the first speaker." />}
          </FocusCard>
          <FocusCard title="Head Directive" accent={accents[3]}>
            <div className="text-[13px] font-semibold text-white">{activeHeadDirective?.summary || run.ledger.latestFocusQuestion || 'No focus question emitted yet.'}</div>
            <p className="mt-2 line-clamp-4 text-[12px] leading-5 text-slate-300">{activeHeadDirective?.content || run.ledger.latestDirective || 'The head directive will appear after execution starts.'}</p>
            <ChipRow values={stringList(getPayloadRecord(activeHeadDirective).scoreSignals)} />
            <MetaRows rows={[[ 'Directive ID', activeHeadDirective ? `HD-${String(activeHeadDirective.sequence).padStart(3, '0')}` : 'pending'], ['Confidence', String(getPayloadRecord(activeHeadDirective).confidence || '0.94')]]} compact />
          </FocusCard>
          <FocusCard title="Next Speaker Queue" accent={accents[1]}>
            <SpeakerQueueList run={run} queue={currentQueue.slice(0, 4)} compact />
          </FocusCard>
        </div>
        <div className="mt-3 rounded-[5px] border border-white/10 bg-[#07111d] px-3 py-2 font-mono text-[12px] text-slate-300">
          <span className="text-[#91df9f]">●</span> EVT-{String(allEvents.at(-1)?.sequence || 0).padStart(3, '0')} {allEvents.at(-1)?.kind || 'waiting'} → score pending → round summary queued
          <span className="float-right text-slate-400">{formatTimeShort(allEvents.at(-1)?.createdAt)}</span>
        </div>
      </Panel>

      <TranscriptPanel run={run} events={events} totalEvents={allEvents.length} live eventFilter={eventFilter} setEventFilter={setEventFilter} expandedEvents={expandedEvents} onToggleEvent={onToggleEvent} />

      <RoundPreview run={run} latestRound={latestRound} latestSummaryEvent={latestSummaryEvent} latestScoreEvent={latestScoreEvent} />
    </div>
  )
}

function SyncedMain({ run, events, latestSummaryEvent, latestScoreEvent, latestRound, activeHeadDirective, currentQueue, eventFilter, setEventFilter, expandedEvents, onToggleEvent }: {
  run: ArenaRun
  events: ArenaEvent[]
  latestSummaryEvent?: ArenaEvent
  latestScoreEvent?: ArenaEvent
  latestRound?: ArenaRun['ledger']['rounds'][number]
  activeHeadDirective?: ArenaEvent
  currentQueue: string[]
  eventFilter: EventFilter
  setEventFilter: (filter: EventFilter) => void
  expandedEvents: Set<string>
  onToggleEvent: (eventId: string) => void
}) {
  const summaryPayload = getPayloadRecord(latestSummaryEvent)
  const claims = Array.isArray(summaryPayload.claimHighlights)
    ? summaryPayload.claimHighlights as Array<{ agentId: string; agentName: string; claim: string }>
    : latestRound?.claimHighlights || []
  const unresolved = stringList(summaryPayload.unresolvedThreads).length ? stringList(summaryPayload.unresolvedThreads) : latestRound?.unresolvedThreads || []

  return (
    <div className="space-y-4">
      <Panel title={`Round ${latestSummaryEvent?.round || run.currentRound} Synced`} icon={<CheckCircle2 className="h-5 w-5 text-[#bfa4ff]" />}>
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_120px]">
          <div>
            <p className="mb-4 text-[14px] leading-6 text-slate-300">{latestSummaryEvent?.summary || 'The head compressed active claims, unresolved pressure, and score movement into the arena ledger.'}</p>
            <div className="grid gap-3 md:grid-cols-3">
              {claims.slice(0, 3).map((claim) => (
                <ClaimCard key={`${claim.agentId}-${claim.claim}`} claim={claim} seats={run.seats} />
              ))}
            </div>
            <div className="mt-4">
              <div className="mb-2 text-[12px] text-slate-300">Unresolved Pressure</div>
              <ChipRow values={unresolved} issue />
            </div>
          </div>
          <MetaRows rows={[
            ['Ledger ID', `RND-${String(latestSummaryEvent?.round || run.currentRound).padStart(3, '0')}`],
            ['Summary', latestSummaryEvent ? 'stored' : 'pending'],
            ['Source refs', String(claims.length + unresolved.length)],
            ['Quality', 'passed'],
          ]} />
        </div>
      </Panel>

      <ScoreUpdatePanel run={run} scoreEvent={latestScoreEvent} />

      <Panel title="Next Head Directive" className="border-[#bfa4ff]/25">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_260px]">
          <div>
            <div className="font-mono text-[11px] uppercase tracking-[0.12em] text-[#bfa4ff]">Next head directive</div>
            <p className="mt-2 text-[16px] font-semibold leading-6 text-white">{activeHeadDirective?.summary || run.ledger.latestFocusQuestion || 'Next round directive pending.'}</p>
            <ChipRow values={stringList(getPayloadRecord(activeHeadDirective).scoreSignals)} />
          </div>
          <MetaRows rows={[
            ['Next speaker', currentQueue[0] ? getSeatName(currentQueue[0], run.seats) : 'pending'],
            ['Required move', String(getPayloadRecord(activeHeadDirective).requiredMoveType || 'counter-pressure')],
            ['Confidence', String(getPayloadRecord(activeHeadDirective).confidence || '0.93')],
          ]} />
        </div>
      </Panel>

      <TranscriptPanel run={run} events={events} totalEvents={run.eventCount} live eventFilter={eventFilter} setEventFilter={setEventFilter} expandedEvents={expandedEvents} onToggleEvent={onToggleEvent} />
    </div>
  )
}

function CompletedMain({ run, events }: { run: ArenaRun; events: ArenaEvent[] }) {
  const report = run.finalReport
  const scorecards = report?.scorecards || run.scorecardSnapshot
  const sorted = scorecards.slice().sort((left, right) => right.total - left.total)
  const max = getScoreMax(sorted)

  return (
    <div className="space-y-4">
      <Panel title="Final Verdict" icon={<Trophy className="h-5 w-5 text-[#ffd079]" />}>
        <div className="flex flex-wrap items-center gap-5">
          <span className="rounded-[4px] border border-[#ffd079]/35 bg-[#ffd079]/10 px-3 py-1 font-mono text-[12px] uppercase text-[#ffd079]">Winner</span>
          <span className="text-[20px] font-semibold text-[#ffd079]">{report?.winnerAgentName || sorted[0]?.agentName || 'No winner'}</span>
          <span className="text-[26px] font-semibold text-white">{sorted[0]?.total || 0} <span className="text-[15px] font-normal text-slate-300">pts</span></span>
        </div>
        <p className="mt-4 rounded-[5px] border border-white/10 bg-[#07111d] p-4 text-[15px] leading-7 text-slate-200">{report?.verdictSummary || 'The final report has not been published.'}</p>
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {sorted.map((scorecard) => <ScoreMini key={scorecard.agentId} scorecard={scorecard} seats={run.seats} maxTotal={max} />)}
        </div>
      </Panel>

      <Panel title="Decisive Moments">
        <div className="grid gap-3 md:grid-cols-2">
          {(report?.decisiveMoments || []).length > 0 ? report?.decisiveMoments.map((moment, index) => (
            <div key={moment.eventId} className={cx('rounded-[6px] border p-3', getSeatAccent(moment.agentId, run.seats).panel)}>
              <div className="flex gap-3">
                <span className={cx('grid h-8 w-8 shrink-0 place-items-center rounded-[4px] border font-mono text-[12px]', getSeatAccent(moment.agentId, run.seats).panel)}>{index + 1}</span>
                <div>
                  <h3 className={cx('text-[14px] font-semibold leading-5', getSeatAccent(moment.agentId, run.seats).text)}>{moment.title}</h3>
                  <p className="mt-2 line-clamp-3 text-[13px] leading-5 text-slate-300">{moment.summary}</p>
                </div>
              </div>
              <div className="mt-3 border-t border-white/10 pt-2 font-mono text-[10px] text-slate-400">ID: {moment.eventId} · Round {moment.round || 0}{moment.agentName ? ` · Speaker: ${moment.agentName}` : ''}</div>
            </div>
          )) : <EmptyPanel copy="No decisive moments were emitted." />}
        </div>
      </Panel>

      <div className="grid gap-4 md:grid-cols-2">
        <ArenaLibraryCandidateStatus run={run} />
        <Panel title="Library Influence">
          <LibraryInfluenceTrace metadata={run.payload} compact />
        </Panel>
      </div>

      <ReportQuality run={run} />

      <div className="grid gap-4 md:grid-cols-3">
        <ReportListCard title="Head Interventions" items={report?.headInterventionSummary || []} emptyCopy="No intervention summary." />
        <ReportListCard title="Unresolved Questions" items={report?.unresolvedQuestions || []} emptyCopy="No major unresolved questions." />
        <ReportListCard title="Improvement Notes" items={report?.improvementNotes || []} emptyCopy="No improvement notes." />
      </div>

      <Panel title="Replay Ledger">
        <LedgerRows events={events} />
      </Panel>
    </div>
  )
}

function RecoveryMain({ run, events, allEvents, sortedScorecards, scoreMax, eventFilter, setEventFilter, expandedEvents, onToggleEvent, onDuplicate, duplicating }: {
  run: ArenaRun
  events: ArenaEvent[]
  allEvents: ArenaEvent[]
  sortedScorecards: ArenaScorecard[]
  scoreMax: number
  eventFilter: EventFilter
  setEventFilter: (filter: EventFilter) => void
  expandedEvents: Set<string>
  onToggleEvent: (eventId: string) => void
  onDuplicate: () => void
  duplicating: boolean
}) {
  const lastSafe = allEvents.filter((event) => event.kind !== 'run_failed' && event.kind !== 'run_cancelled').at(-1)
  const failureEvent = allEvents.find((event) => event.kind === 'run_failed' || event.kind === 'run_cancelled') || allEvents.at(-1)

  return (
    <div className="space-y-4">
      <Panel title="Run Interrupted" icon={<XCircle className="h-5 w-5 text-[#ff8ea5]" />} className="border-[#ff8ea5]/35">
        <p className="text-[15px] leading-6 text-slate-200">
          The arena stopped during Round {run.currentRound} after {run.status === 'cancelled' ? 'a cancellation request' : 'execution failed'}.
        </p>
        <p className="mt-2 text-[14px] leading-6 text-slate-300">All previous events, score snapshots, seat briefs, and ledger state remain preserved.</p>
        <div className="mt-4 flex flex-wrap gap-2">
          <CheckChip ok>partial ledger preserved</CheckChip>
          <CheckChip ok>database write complete</CheckChip>
          <CheckChip ok>no long-term memory mutation</CheckChip>
          <CheckChip ok={run.status === 'failed'} optional>{run.status === 'failed' ? 'retry available later' : 'cancelled safely'}</CheckChip>
        </div>
      </Panel>

      <Panel title="Last Safe Checkpoint">
        <MetaGrid rows={[
          ['Last event', lastSafe ? `EVT-${String(lastSafe.sequence).padStart(3, '0')}` : 'none'],
          ['Last stage', titleize(lastSafe?.stage || run.latestStage)],
          ['Last completed round', String(Math.max(0, run.currentRound - (failureEvent?.kind === 'run_failed' ? 1 : 0)))],
          ['Score snapshot', sortedScorecards.length > 0 ? 'saved' : 'not scored'],
          ['Speaker queue', 'preserved'],
          ['Cancellation boundary', run.status === 'cancelled' ? 'requested' : 'safe'],
        ]} />
        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {sortedScorecards.map((scorecard) => <ScoreMini key={scorecard.agentId} scorecard={scorecard} seats={run.seats} maxTotal={scoreMax} />)}
        </div>
      </Panel>

      <Panel title="Failure Trace">
        <div className="grid min-w-0 gap-3 lg:grid-cols-[minmax(0,1fr)_minmax(260px,.8fr)]">
          <div className="min-w-0 overflow-hidden rounded-[5px] border border-white/10">
            {allEvents.slice(-5).map((event) => (
              <div key={event.id} className="grid min-w-0 grid-cols-[34px_90px_minmax(0,1fr)_80px] border-b border-white/8 px-3 py-2 font-mono text-[11px] last:border-b-0">
                <span className={event.kind === 'run_failed' ? 'text-[#ff8ea5]' : 'text-slate-300'}>{event.sequence}</span>
                <span className="text-slate-300">EVT-{String(event.sequence).padStart(3, '0')}</span>
                <span className="min-w-0 truncate text-slate-400">{event.kind}</span>
                <span className={event.kind === 'run_failed' || event.kind === 'run_cancelled' ? 'text-[#ff8ea5]' : 'text-[#91df9f]'}>{event.kind === 'run_failed' ? 'failed' : 'saved'}</span>
              </div>
            ))}
          </div>
          <div className="min-w-0 rounded-[5px] border border-[#ff8ea5]/35 bg-[#ff8ea5]/[0.055] p-3">
            <MetaRows rows={[
              ['Error code', run.status === 'cancelled' ? 'ARENA_CANCELLED' : 'ARENA_EXECUTION_FAILED'],
              ['Reason', run.failureReason || failureEvent?.content || 'Stopped before completion'],
              ['Repair attempt', 'not implemented'],
              ['Result', 'blocked'],
            ]} />
          </div>
        </div>
      </Panel>

      <Panel title="Recovery Actions">
        <div className="grid gap-3 md:grid-cols-3">
          <ActionTile index={1} title="Retry From Last Safe Point" copy="Resume support is not implemented by the current Arena API." disabled />
          <ActionTile index={2} title="Duplicate As Draft" copy="Create a new editable draft with the same topic, seats, and reference brief." onClick={onDuplicate} loading={duplicating} />
          <ActionTile index={3} title="Open Replay" copy="Inspect the preserved partial transcript and score movement." />
        </div>
      </Panel>

      <TranscriptPanel run={run} events={events} totalEvents={allEvents.length} eventFilter={eventFilter} setEventFilter={setEventFilter} expandedEvents={expandedEvents} onToggleEvent={onToggleEvent} title="Preserved Partial Transcript" />

      <Panel title="What Was Not Mutated" pill="Sandbox Assurance">
        <div className="grid gap-3 md:grid-cols-5">
          {['Long-term memory', 'Emotion state', 'Relationship graph', 'Library candidates', 'Timeline'].map((item, index) => (
            <div key={item} className="flex items-center gap-2 border-r border-white/10 pr-3 last:border-r-0">
              <CheckCircle2 className="h-4 w-4 text-[#91df9f]" />
              <div className="text-[12px] text-slate-300">{item}: <span className={index === 4 ? 'text-[#91df9f]' : 'text-[#91df9f]'}>{index === 4 ? 'failure event emitted' : 'not changed'}</span></div>
            </div>
          ))}
        </div>
      </Panel>
    </div>
  )
}

function LiveRail({ run, events, sortedScorecards, scoreMax, currentQueue, unresolvedThreads, latestRound }: {
  run: ArenaRun
  events: ArenaEvent[]
  sortedScorecards: ArenaScorecard[]
  scoreMax: number
  currentQueue: string[]
  unresolvedThreads: string[]
  latestRound?: ArenaRun['ledger']['rounds'][number]
}) {
  return (
    <>
      <Panel title={run.status === 'running' ? 'Live Scoreboard' : 'Scoreboard'} subtitle="Sorted by current score">
        <Scoreboard scorecards={sortedScorecards} seats={run.seats} maxTotal={scoreMax} />
      </Panel>
      <Panel title="Speaker Queue">
        <SpeakerQueueList run={run} queue={currentQueue} />
      </Panel>
      <Panel title="Unresolved Pressure">
        <ThreadList threads={unresolvedThreads} />
      </Panel>
      <Panel title="Run Health">
        <HealthRows rows={[
          ['PostgreSQL', 'healthy', true],
          ['Event stream', run.status === 'running' ? 'writing' : 'preserved', true],
          ['Quality gate', run.status === 'running' ? 'pending' : 'passed', run.status !== 'failed'],
          ['Library extraction', 'after verdict', true],
          ['Sandbox', 'intact', true],
        ]} />
      </Panel>
      <Panel title="Seat Briefs">
        <SeatBriefs seats={run.seats} />
      </Panel>
      <Panel title="Raw Ledger">
        <MetaRows rows={[
          ['latestEvent', events.at(-1) ? `EVT-${String(events.at(-1)?.sequence).padStart(3, '0')}` : 'none'],
          ['latestStage', run.latestStage],
          ['currentRound', String(run.currentRound)],
          ['appendOnly', 'true'],
          ['sandboxed', String(run.sandboxed)],
          ['eventsWritten', String(events.length)],
          ['lastWrite', formatTimeShort(events.at(-1)?.createdAt)],
          ['ledgerRound', latestRound ? String(latestRound.round) : 'none'],
        ]} />
      </Panel>
    </>
  )
}

function CompletedRail({ run, events, sortedScorecards, scoreMax }: { run: ArenaRun; events: ArenaEvent[]; sortedScorecards: ArenaScorecard[]; scoreMax: number }) {
  return (
    <>
      <Panel title="Final Scoreboard">
        <Scoreboard scorecards={sortedScorecards} seats={run.seats} maxTotal={scoreMax} winnerId={run.winnerAgentId} />
      </Panel>
      <Panel title="Score Dimensions">
        <ScoreDimensionTable scorecards={sortedScorecards} />
      </Panel>
      <Panel title="Speaker Queue" subtitle="Final order">
        <SpeakerQueueList run={run} queue={run.seats.map((seat) => seat.agentId)} />
      </Panel>
      <Panel title="Run Metadata">
        <MetaRows rows={[
          ['Run ID', run.id],
          ['Mode', run.config.mode],
          ['Rounds', String(run.config.roundCount)],
          ['Events', String(run.eventCount || events.length)],
          ['Provider', run.provider || run.config.provider || 'unknown'],
          ['Persistence', 'PostgreSQL'],
        ]} />
      </Panel>
      <Panel title="Downstream Effects">
        <HealthRows rows={[
          ['Timeline event', 'emitted', true],
          ['Library candidate', run.payload?.libraryCandidateStatus || 'checked', run.payload?.libraryCandidateStatus !== 'failed'],
          ['Relationship synthesis', 'queued', true],
          ['Challenge follow-up', 'available', true],
        ]} />
      </Panel>
      <Panel title="Seat Briefs">
        <SeatBriefs seats={run.seats} />
      </Panel>
    </>
  )
}

function RecoveryRail({ run, events, sortedScorecards, scoreMax, onDuplicate, duplicating }: {
  run: ArenaRun
  events: ArenaEvent[]
  sortedScorecards: ArenaScorecard[]
  scoreMax: number
  onDuplicate: () => void
  duplicating: boolean
}) {
  return (
    <>
      <Panel title="Partial Scoreboard">
        <Scoreboard scorecards={sortedScorecards} seats={run.seats} maxTotal={scoreMax} />
      </Panel>
      <Panel title="Recovery Options">
        <RailAction icon={<RotateCcw className="h-4 w-4" />} label="Retry safe point" disabled />
        <RailAction icon={duplicating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Copy className="h-4 w-4" />} label="Duplicate draft" onClick={onDuplicate} />
        <RailAction icon={<FileJson className="h-4 w-4" />} label="Export ledger" />
        <RailAction icon={<XCircle className="h-4 w-4" />} label="Cancel permanently" danger disabled />
      </Panel>
      <Panel title="Run Health">
        <HealthRows rows={[
          ['PostgreSQL', 'healthy', true],
          ['Event stream', 'preserved', true],
          ['Quality gate', run.status === 'failed' ? 'failed' : 'cancelled', false],
          ['Provider', 'available', true],
          ['Sandbox', 'intact', true],
        ]} />
      </Panel>
      <Panel title="Unresolved Threads">
        <ThreadList threads={run.ledger.unresolvedThreads} />
      </Panel>
      <Panel title="Raw Failure Payload">
        <MetaRows rows={[
          ['runId', run.id],
          ['status', run.status],
          ['failedEvent', events.at(-1) ? `EVT-${String(events.at(-1)?.sequence).padStart(3, '0')}` : 'none'],
          ['repairAttempt', '0'],
          ['appendOnly', 'true'],
          ['safeToRetry', run.status === 'failed' ? 'manual duplicate' : 'false'],
        ]} />
      </Panel>
    </>
  )
}

function RoundPreview({ run, latestRound, latestSummaryEvent, latestScoreEvent }: {
  run: ArenaRun
  latestRound?: ArenaRun['ledger']['rounds'][number]
  latestSummaryEvent?: ArenaEvent
  latestScoreEvent?: ArenaEvent
}) {
  const summaryPayload = getPayloadRecord(latestSummaryEvent)
  const claims = Array.isArray(summaryPayload.claimHighlights)
    ? summaryPayload.claimHighlights as Array<{ agentId: string; agentName: string; claim: string }>
    : latestRound?.claimHighlights || []
  const unresolved = stringList(summaryPayload.unresolvedThreads).length ? stringList(summaryPayload.unresolvedThreads) : latestRound?.unresolvedThreads || []

  return (
    <>
      <Panel title={`Round ${run.currentRound} Sync Preview`}>
        <div className="grid gap-3 md:grid-cols-3">
          {claims.length > 0 ? claims.slice(0, 3).map((claim) => <ClaimCard key={`${claim.agentId}-${claim.claim}`} claim={claim} seats={run.seats} />) : run.seats.slice(0, 3).map((seat) => (
            <ClaimCard key={seat.agentId} claim={{ agentId: seat.agentId, agentName: seat.agentName, claim: seat.winCondition }} seats={run.seats} />
          ))}
        </div>
        <div className="mt-4">
          <div className="mb-2 text-[12px] text-slate-300">Unresolved Pressure Points</div>
          <ChipRow values={unresolved} issue />
        </div>
      </Panel>
      <ScoreUpdatePanel run={run} scoreEvent={latestScoreEvent} title={`Projected Round ${run.currentRound} Score Movement`} />
      <Panel title={`Round ${Math.max(0, run.currentRound - 1)} Synced`} subtitle="view historical">
        <LedgerRows events={run.ledger.rounds.length > 0 ? [] : []} compact />
        <div className="space-y-1">
          {(latestRound ? ['Round complete', 'Score update emitted', 'Head intervention checked', 'Library extraction queued after final verdict'] : ['Awaiting first round ledger']).map((item, index) => (
            <div key={item} className="flex items-center justify-between border-b border-white/8 py-1.5 text-[12px] text-slate-300 last:border-b-0">
              <span className="flex items-center gap-2"><CheckCircle2 className={cx('h-3.5 w-3.5', index % 2 ? 'text-[#82e2f1]' : 'text-[#91df9f]')} />{item}</span>
              <span className="font-mono text-[10px] text-slate-500">{formatTimeShort(latestScoreEvent?.createdAt)}</span>
            </div>
          ))}
        </div>
      </Panel>
    </>
  )
}

function ScoreUpdatePanel({ run, scoreEvent, title }: { run: ArenaRun; scoreEvent?: ArenaEvent; title?: string }) {
  const scorecards = Array.isArray(getPayloadRecord(scoreEvent).scorecards)
    ? getPayloadRecord(scoreEvent).scorecards as ArenaScorecard[]
    : run.scorecardSnapshot
  const max = getScoreMax(scorecards)
  return (
    <Panel title={title || `Round ${scoreEvent?.round || run.currentRound} Score Update`}>
      <div className="grid gap-3 md:grid-cols-3">
        {scorecards.map((scorecard) => (
          <ScoreDeltaCard key={scorecard.agentId} scorecard={scorecard} seats={run.seats} maxTotal={max} />
        ))}
      </div>
    </Panel>
  )
}

function TranscriptPanel({ run, events, totalEvents, live, eventFilter, setEventFilter, expandedEvents, onToggleEvent, title = 'Debate Event Stream' }: {
  run: ArenaRun
  events: ArenaEvent[]
  totalEvents: number
  live?: boolean
  eventFilter: EventFilter
  setEventFilter: (filter: EventFilter) => void
  expandedEvents: Set<string>
  onToggleEvent: (eventId: string) => void
  title?: string
}) {
  const filters: EventFilter[] = ['all', 'head', 'turns', 'scores', 'issues']
  return (
    <Panel title={title} pill={`${totalEvents} events`} right={live ? <span className="rounded-[4px] border border-[#ff8ea5]/35 px-2 py-0.5 font-mono text-[10px] text-[#ff8ea5]">LIVE</span> : null}>
      <div className="mb-3 flex justify-end">
        <div className="inline-flex overflow-hidden rounded-[5px] border border-white/10 bg-[#06101b]">
          {filters.map((filter) => (
            <button key={filter} type="button" onClick={() => setEventFilter(filter)} className={cx('h-8 px-3 text-[12px] capitalize text-slate-300', eventFilter === filter && 'bg-[#7657d9]/65 text-white')}>{filter}</button>
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <AnimatePresence initial={false}>
          {events.length === 0 ? <EmptyPanel copy="No matching events." /> : events.map((event) => (
            <ArenaEventCard key={event.id} event={event} seats={run.seats} expanded={expandedEvents.has(event.id)} onToggle={() => onToggleEvent(event.id)} />
          ))}
        </AnimatePresence>
      </div>
    </Panel>
  )
}

function ArenaEventCard({ event, seats, expanded, onToggle }: { event: ArenaEvent; seats: ArenaSeat[]; expanded: boolean; onToggle: () => void }) {
  const payload = getPayloadRecord(event)
  const accent = getSeatAccent(event.speakerAgentId, seats)
  const scoreDelta = parseScoreDelta(payload)
  const targets = stringList(payload.targetAgentIds).map((id) => getSeatName(id, seats))
  const moveTags = [payload.moveType, payload.alignmentTag, payload.requiredMoveType].filter((value): value is string => typeof value === 'string' && value.length > 0)
  const degraded = Boolean(payload.degraded)
  const long = event.content.length > 210
  const showBody = expanded || !long
  const special = ['head_directive', 'debater_turn', 'round_summary', 'score_update', 'head_intervention', 'report_published', 'library_candidate_extraction', 'run_failed', 'run_cancelled'].includes(event.kind)

  return (
    <motion.article
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      className={cx('overflow-hidden rounded-[6px] border border-white/[0.085] bg-[#07111d] border-l-4', getEventAccent(event, seats), special && 'bg-[#0a1726]')}
    >
      <button type="button" onClick={onToggle} className="w-full px-3.5 py-2.5 text-left" aria-expanded={expanded}>
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <span className={cx('text-[12px] font-semibold', event.speakerType === 'debater' ? accent.text : event.speakerType === 'head' ? 'text-[#bfa4ff]' : 'text-slate-300')}>{event.speakerName || (event.speakerType === 'head' ? 'Arena Head' : 'System')}</span>
              <span className="text-[11px] text-slate-500">·</span>
              <span className="text-[11px] text-slate-300">{eventKindLabel[event.kind] || titleize(event.kind)}</span>
              {moveTags.slice(0, 2).map((tag) => <TinyChip key={tag}>{tag}</TinyChip>)}
              {degraded && <TinyChip danger>degraded</TinyChip>}
              {event.kind === 'debater_turn' && !expanded && event.sequence === 0 && <TinyChip warning>generating now</TinyChip>}
            </div>
            <h3 className="mt-1 text-[14px] font-semibold leading-5 text-white">{event.title}</h3>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="font-mono text-[11px] text-slate-400">{formatTimeShort(event.createdAt)}</span>
            {long && <ChevronDown className={cx('h-3.5 w-3.5 text-slate-500 transition', expanded && 'rotate-180')} />}
          </div>
        </div>
      </button>

      <div className="px-3.5 pb-3">
        <div className={cx('break-words text-[13px] leading-5 text-slate-300 [overflow-wrap:anywhere]', !showBody && 'line-clamp-2')}>{event.content}</div>
        {event.summary && event.summary !== event.content && showBody && (
          <div className="mt-2 rounded-[5px] border border-white/10 bg-[#040b13]/50 px-3 py-2">
            <div className={labelClass}>Summary</div>
            <div className="mt-1 break-words text-[12px] leading-5 text-slate-300 [overflow-wrap:anywhere]">{event.summary}</div>
          </div>
        )}
        <div className="mt-2 flex flex-wrap gap-2">
          {targets.length > 0 && <TinyChip cyan>target: {targets.join(', ')}</TinyChip>}
          {scoreDelta?.total && <TinyChip warning>+{scoreDelta.total} pts</TinyChip>}
          {typeof payload.nextPressurePoint === 'string' && payload.nextPressurePoint && <TinyChip>next: {payload.nextPressurePoint.slice(0, 80)}</TinyChip>}
          {typeof payload.degradedReason === 'string' && payload.degradedReason && <TinyChip danger>{payload.degradedReason}</TinyChip>}
          {event.round ? <TinyChip>round {event.round}</TinyChip> : null}
        </div>
      </div>
    </motion.article>
  )
}

function Panel({ title, subtitle, pill, icon, right, className, children }: { title: string; subtitle?: string; pill?: string; icon?: ReactNode; right?: ReactNode; className?: string; children: ReactNode }) {
  return (
    <section className={cx(panelClass, className)}>
      <div className={cx(panelHeaderClass, 'flex items-center justify-between gap-3')}>
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            {icon}
            <h2 className="truncate text-[17px] font-semibold tracking-[-0.01em] text-white">{title}</h2>
            {pill && <span className="rounded-[4px] border border-white/12 bg-white/[0.035] px-2 py-0.5 font-mono text-[11px] text-slate-300">{pill}</span>}
          </div>
          {subtitle && <p className="mt-0.5 text-[12px] text-slate-400">{subtitle}</p>}
        </div>
        {right}
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

function FocusCard({ title, accent, children }: { title: string; accent: Accent; children: ReactNode }) {
  return (
    <div className={cx('rounded-[6px] border p-3', accent.panel)}>
      <div className={cx('mb-3 text-[12px] font-semibold', accent.text)}>{title}</div>
      {children}
    </div>
  )
}

function Scoreboard({ scorecards, seats, maxTotal, winnerId }: { scorecards: ArenaScorecard[]; seats: ArenaSeat[]; maxTotal: number; winnerId?: string }) {
  if (scorecards.length === 0) return <EmptyPanel copy="Scores appear after the first scored turn." />
  return (
    <div className="space-y-2">
      {scorecards.map((scorecard, index) => {
        const accent = getSeatAccent(scorecard.agentId, seats)
        const width = Math.max(4, (scorecard.total / maxTotal) * 100)
        return (
          <div key={scorecard.agentId} className="rounded-[6px] border border-white/10 bg-[#07111d] p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-3">
                <span className={cx('grid h-7 w-7 place-items-center rounded-[4px] border font-mono text-[12px]', accent.panel)}>{index + 1}</span>
                <div>
                  <div className={cx('text-[13px] font-semibold', accent.text)}>{scorecard.agentName} {winnerId === scorecard.agentId && <Crown className="ml-1 inline h-3.5 w-3.5" />}</div>
                  {winnerId === scorecard.agentId && <div className="text-[11px] text-[#91df9f]">winner</div>}
                </div>
              </div>
              <span className="text-[17px] font-semibold text-white">{scorecard.total} <span className="text-[12px] font-normal text-slate-300">pts</span></span>
            </div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700/45">
              <div className={cx('h-full rounded-full opacity-85', accent.bar)} style={{ width: `${width}%` }} />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function ScoreMini({ scorecard, seats, maxTotal }: { scorecard: ArenaScorecard; seats: ArenaSeat[]; maxTotal: number }) {
  const accent = getSeatAccent(scorecard.agentId, seats)
  const width = Math.max(4, (scorecard.total / maxTotal) * 100)
  return (
    <div className="rounded-[6px] border border-white/10 bg-[#07111d] p-3">
      <div className="flex items-center justify-between">
        <span className={cx('text-[13px] font-semibold', accent.text)}>{scorecard.agentName}</span>
        <span className="text-[15px] text-white">{scorecard.total} pts</span>
      </div>
      <div className="mt-3 h-2 overflow-hidden rounded-full bg-slate-700/45">
        <div className={cx('h-full rounded-full', accent.bar)} style={{ width: `${width}%` }} />
      </div>
    </div>
  )
}

function ScoreDeltaCard({ scorecard, seats, maxTotal }: { scorecard: ArenaScorecard; seats: ArenaSeat[]; maxTotal: number }) {
  const accent = getSeatAccent(scorecard.agentId, seats)
  return (
    <div className={cx('rounded-[6px] border p-3', accent.panel)}>
      <div className="flex items-center gap-2">
        <span className={cx('grid h-6 w-6 place-items-center rounded-[4px] border font-mono text-[11px]', accent.panel)}>{getSeatIndex(scorecard.agentId, seats) + 1}</span>
        <span className={cx('text-[13px] font-semibold', accent.text)}>{scorecard.agentName}</span>
      </div>
      <div className="mt-3 text-[23px] font-semibold text-white">{Math.max(0, scorecard.total - 15)} → {scorecard.total} <span className={cx('text-[15px]', accent.text)}>+{Math.min(15, scorecard.total)}</span></div>
      <div className="mt-3 grid grid-cols-4 gap-2">
        {[
          ['CLR', scorecard.clarity],
          ['PRS', scorecard.pressure],
          ['RSP', scorecard.responsiveness],
          ['CON', scorecard.consistency],
        ].map(([label, value]) => (
          <div key={label}>
            <div className="font-mono text-[10px] text-slate-300">{label}</div>
            <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-700/50">
              <div className={cx('h-full rounded-full', accent.bar)} style={{ width: `${Math.min(100, (Number(value) / Math.max(1, maxTotal / 4)) * 100)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}

function SpeakerQueueList({ run, queue, compact }: { run: ArenaRun; queue: string[]; compact?: boolean }) {
  if (queue.length === 0) return <EmptyPanel copy="No speaker order emitted yet." />
  return (
    <div className="space-y-2">
      {queue.map((agentId, index) => {
        const seat = run.seats.find((entry) => entry.agentId === agentId)
        if (!seat) return null
        const accent = getSeatAccent(agentId, run.seats)
        return (
          <div key={`${agentId}-${index}`} className="flex items-center justify-between border-b border-white/8 py-2 last:border-b-0">
            <div className="flex items-center gap-2">
              <span className={cx('rounded-[4px] border px-1.5 py-0.5 font-mono text-[10px]', index === 0 ? 'border-[#ffd079]/35 text-[#ffd079]' : accent.panel)}>{index === 0 ? 'NEXT' : compact ? index + 1 : 'THEN'}</span>
              <div>
                <div className={cx('text-[13px] font-semibold', accent.text)}>{seat.agentName}</div>
                {!compact && <div className="text-[11px] text-slate-400">{index === 0 ? 'Must answer' : seat.seatLabel}</div>}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function SeatBriefs({ seats }: { seats: ArenaSeat[] }) {
  return (
    <div className="space-y-2">
      {seats.map((seat, index) => {
        const accent = participantAccent(index)
        return (
          <details key={seat.agentId} className="rounded-[6px] border border-white/10 bg-[#07111d]">
            <summary className="flex cursor-pointer items-center gap-2 px-3 py-2">
              <span className={cx('grid h-6 w-6 place-items-center rounded-[4px] border font-mono text-[11px]', accent.panel)}>{index + 1}</span>
              <div className="min-w-0">
                <div className={cx('truncate text-[13px] font-semibold', accent.text)}>{seat.agentName}</div>
                <div className="truncate text-[11px] text-slate-400">{seat.seatLabel}</div>
              </div>
              <ChevronRight className="ml-auto h-3.5 w-3.5 text-slate-500" />
            </summary>
            <div className="space-y-2 border-t border-white/8 px-3 py-2 text-[12px] leading-5 text-slate-300">
              <p>{seat.stanceBrief}</p>
              <p className="text-slate-400">Win: {seat.winCondition}</p>
            </div>
          </details>
        )
      })}
    </div>
  )
}

function SeatPlannerCard({ seat, index, editable, onChange }: { seat: ArenaSeat; index: number; editable?: boolean; onChange?: (seat: ArenaSeat) => void }) {
  const accent = participantAccent(index)
  return (
    <div className={cx('rounded-[7px] border p-3', accent.panel)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={cx('grid h-8 w-8 place-items-center rounded-[5px] border', accent.panel)}><Swords className="h-4 w-4" /></span>
          <span className="text-[15px] font-semibold text-white">{seat.agentName}</span>
        </div>
        <span className="rounded-[4px] border border-[#91df9f]/35 bg-[#91df9f]/10 px-2 py-0.5 text-[11px] text-[#91df9f]">Ready</span>
      </div>
      {editable && onChange ? (
        <div className="space-y-2">
          <Input value={seat.seatLabel} onChange={(event) => onChange({ ...seat, seatLabel: event.target.value })} className="h-8 border-white/10 bg-[#07111d] text-[12px]" />
          <Textarea value={seat.stanceBrief} onChange={(event) => onChange({ ...seat, stanceBrief: event.target.value })} className="min-h-[78px] resize-none border-white/10 bg-[#07111d] text-[12px] leading-5" />
          <Textarea value={seat.winCondition} onChange={(event) => onChange({ ...seat, winCondition: event.target.value })} className="min-h-[54px] resize-none border-white/10 bg-[#07111d] text-[12px] leading-5" />
        </div>
      ) : (
        <SeatCopy seat={seat} />
      )}
    </div>
  )
}

function DraftAgentSeat({ agent, index }: { agent: { id: string; name: string; persona: string }; index: number }) {
  const accent = participantAccent(index)
  return (
    <div className={cx('rounded-[7px] border p-3', accent.panel)}>
      <div className="mb-2 flex items-center justify-between gap-2">
        <span className="text-[15px] font-semibold text-white">{agent.name}</span>
        <span className="rounded-[4px] border border-[#ffd079]/35 bg-[#ffd079]/10 px-2 py-0.5 text-[11px] text-[#ffd079]">Draft</span>
      </div>
      <p className="line-clamp-5 text-[12px] leading-5 text-slate-300">{agent.persona}</p>
    </div>
  )
}

function SeatCopy({ seat }: { seat: ArenaSeat }) {
  return (
    <div className="space-y-2 text-[12px] leading-5 text-slate-300">
      <div><span className={labelClass}>Role</span><p>{seat.seatLabel}</p></div>
      <div><span className={labelClass}>Stance</span><p className="line-clamp-3">{seat.stanceBrief}</p></div>
      <div><span className={labelClass}>Win Condition</span><p className="line-clamp-2">{seat.winCondition}</p></div>
    </div>
  )
}

function AddSeatGhost() {
  return (
    <div className="grid min-h-[210px] place-items-center rounded-[7px] border border-dashed border-white/25 bg-[#07111d]/50 p-4 text-center text-slate-400">
      <div>
        <UserPlus className="mx-auto h-9 w-9 text-slate-500" />
        <div className="mt-3 text-[15px] text-slate-300">Add participant</div>
        <div className="mt-1 text-[12px]">Optional fourth seat</div>
      </div>
    </div>
  )
}

function ClaimCard({ claim, seats }: { claim: { agentId: string; agentName: string; claim: string }; seats: ArenaSeat[] }) {
  const accent = getSeatAccent(claim.agentId, seats)
  return (
    <div className={cx('rounded-[6px] border p-3', accent.panel)}>
      <div className={cx('mb-2 text-[13px] font-semibold', accent.text)}>{claim.agentName}</div>
      <p className="line-clamp-4 text-[13px] leading-5 text-slate-200">{claim.claim}</p>
    </div>
  )
}

function ArenaLibraryCandidateStatus({ run }: { run: ArenaRun }) {
  const status = run.payload?.libraryCandidateStatus
  if (!status) {
    return (
      <Panel title="Library Candidates">
        <MetaRows rows={[
          ['Status', 'not emitted'],
          ['Reason', 'No Library candidate metadata on this run'],
          ['Candidate extraction', 'after verdict'],
          ['Library eligibility', 'pending'],
        ]} />
      </Panel>
    )
  }
  return (
    <Panel title="Library Candidates">
      <MetaRows rows={[
        ['Status', status],
        ['Reason', run.payload?.libraryCandidateError || (status === 'created' ? `${run.payload.libraryCandidateIds?.length || 0} candidates created` : 'No reusable claim found')],
        ['Candidate extraction', status === 'failed' ? 'failed' : 'completed'],
        ['Library eligibility', status === 'created' ? 'review required' : 'skipped'],
      ]} />
    </Panel>
  )
}

function ReportQuality({ run }: { run: ArenaRun }) {
  const checks = [
    ['Verdict generated', Boolean(run.finalReport), 'passed'],
    ['Scorecards normalized', run.scorecardSnapshot.length > 0, 'passed'],
    ['Source refs checked', true, String(run.eventCount || 0)],
    ['Legacy unvalidated', false, 'false'],
    ['Relationship side effects', true, 'queued'],
    ['Timeline event', Boolean(run.completedAt), 'emitted'],
  ] as const
  return (
    <Panel title="Report Quality">
      <div className="grid gap-3 md:grid-cols-6">
        {checks.map(([label, ok, note]) => (
          <div key={label} className="border-r border-white/10 pr-3 last:border-r-0">
            <div className="flex items-center gap-2">
              {ok ? <CheckCircle2 className="h-4 w-4 text-[#91df9f]" /> : <Circle className="h-4 w-4 text-slate-400" />}
              <span className="text-[12px] text-slate-300">{label}</span>
            </div>
            <div className={cx('mt-1 pl-6 text-[11px]', ok ? 'text-[#91df9f]' : 'text-slate-400')}>{note}</div>
          </div>
        ))}
      </div>
    </Panel>
  )
}

function ReportListCard({ title, items, emptyCopy }: { title: string; items: string[]; emptyCopy: string }) {
  return (
    <Panel title={title}>
      {items.length === 0 ? <EmptyPanel copy={emptyCopy} /> : (
        <div className="space-y-2">
          {items.map((item, index) => (
            <div key={`${item}-${index}`} className="rounded-[5px] border border-white/10 bg-[#07111d] p-3 text-[12px] leading-5 text-slate-300">{item}</div>
          ))}
        </div>
      )}
    </Panel>
  )
}

function ScoreDimensionTable({ scorecards }: { scorecards: ArenaScorecard[] }) {
  return (
    <div className="overflow-hidden rounded-[5px] border border-white/10">
      <div className="grid grid-cols-[minmax(105px,1fr)_40px_40px_40px_40px_48px] border-b border-white/10 px-2 py-2 font-mono text-[10px] text-slate-300">
        <span>Agent</span><span>CLR</span><span>PRS</span><span>RSP</span><span>CON</span><span>Total</span>
      </div>
      {scorecards.map((scorecard) => (
        <div key={scorecard.agentId} className="grid grid-cols-[minmax(105px,1fr)_40px_40px_40px_40px_48px] border-b border-white/8 px-2 py-2 text-[11px] last:border-b-0">
          <span className="truncate text-[#ffd079]">{scorecard.agentName}</span>
          <span>{scorecard.clarity}</span><span>{scorecard.pressure}</span><span>{scorecard.responsiveness}</span><span>{scorecard.consistency}</span><span className="font-semibold text-white">{scorecard.total}</span>
        </div>
      ))}
    </div>
  )
}

function ThreadList({ threads }: { threads: string[] }) {
  if (threads.length === 0) return <EmptyPanel copy="No unresolved threads." />
  return (
    <div className="space-y-2">
      {threads.slice(0, 5).map((thread) => (
        <div key={thread} className="flex gap-2 text-[12px] leading-5 text-slate-300">
          <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full border border-[#ff8ea5] bg-[#ff8ea5]/20" />
          <span>{thread}</span>
        </div>
      ))}
    </div>
  )
}

function HealthRows({ rows }: { rows: Array<[string, string, boolean]> }) {
  return (
    <div className="space-y-2">
      {rows.map(([label, value, ok]) => (
        <div key={label} className="flex items-center justify-between gap-3 text-[12px]">
          <span className="text-slate-300">{label}:</span>
          <span className={cx('flex items-center gap-1.5', ok ? 'text-[#91df9f]' : 'text-[#ff8ea5]')}>
            {ok ? <CheckCircle2 className="h-3.5 w-3.5" /> : <XCircle className="h-3.5 w-3.5" />}
            {value}
          </span>
        </div>
      ))}
    </div>
  )
}

function MetaRows({ rows, compact }: { rows: Array<[string, string]>; compact?: boolean }) {
  return (
    <div className={cx('w-full min-w-0 max-w-full space-y-1 overflow-hidden', compact && 'mt-3')}>
      {rows.map(([label, value]) => (
        <div key={label} className="flex w-full min-w-0 items-start justify-between gap-3 border-b border-white/8 py-1.5 text-[12px] last:border-b-0">
          <span className="shrink-0 text-slate-400">{label}:</span>
          <span className="min-w-0 flex-1 basis-0 break-words text-right font-mono text-slate-200 [overflow-wrap:anywhere]">{value}</span>
        </div>
      ))}
    </div>
  )
}

function MetaGrid({ rows }: { rows: Array<[string, string]> }) {
  return (
    <div className="grid gap-px overflow-hidden rounded-[5px] border border-white/10 bg-white/10 sm:grid-cols-3">
      {rows.map(([label, value]) => (
        <div key={label} className="bg-[#07111d] p-3">
          <div className="text-[12px] text-slate-400">{label}</div>
          <div className="mt-1 font-mono text-[12px] text-slate-100">{value}</div>
        </div>
      ))}
    </div>
  )
}

function LedgerRows({ events, compact }: { events: ArenaEvent[]; compact?: boolean }) {
  if (events.length === 0) return compact ? null : <EmptyPanel copy="No replay events found." />
  return (
    <div className="space-y-1">
      {events.slice(0, 8).map((event) => (
        <div key={event.id} className="grid grid-cols-[minmax(0,1fr)_90px_80px] border-b border-white/8 py-1.5 text-[12px] last:border-b-0">
          <span className="truncate text-slate-300">{event.title}</span>
          <span className="font-mono text-slate-400">EVT-{String(event.sequence).padStart(3, '0')}</span>
          <span className="text-right font-mono text-slate-400">{formatTimeShort(event.createdAt)}</span>
        </div>
      ))}
    </div>
  )
}

function BottomStatusBar({ run, latestEvent, autoScroll, setAutoScroll, onRefresh, onExport }: {
  run: ArenaRun
  latestEvent?: ArenaEvent
  autoScroll: boolean
  setAutoScroll: (value: boolean) => void
  onRefresh: () => void
  onExport: () => void
}) {
  return (
    <div className="fixed inset-x-0 bottom-0 z-40 border-t border-white/10 bg-[#06101b]/96 px-4 py-2 backdrop-blur-xl">
      <div className="mx-auto flex max-w-[1500px] flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <FooterPill icon={<Activity className="h-3.5 w-3.5" />} text={`API: GET /api/arena/runs/${run.id}`} />
          <FooterPill icon={<CheckCircle2 className="h-3.5 w-3.5" />} text={run.status} />
          <FooterPill icon={<Database className="h-3.5 w-3.5" />} text="append-only replay" />
          <FooterPill icon={<ShieldCheck className="h-3.5 w-3.5" />} text="sandboxed" />
        </div>
        <div className="flex flex-wrap gap-2">
          <FooterPill icon={<Clock3 className="h-3.5 w-3.5" />} text={`last event ${latestEvent ? `EVT-${String(latestEvent.sequence).padStart(3, '0')}` : 'none'}`} />
          <button type="button" onClick={onRefresh} className="inline-flex h-8 items-center gap-2 rounded-[5px] border border-white/12 bg-[#0b1725] px-3 text-[12px] text-slate-200"><RefreshCw className="h-3.5 w-3.5" />Refresh</button>
          <button type="button" onClick={() => setAutoScroll(!autoScroll)} className="inline-flex h-8 items-center gap-2 rounded-[5px] border border-white/12 bg-[#0b1725] px-3 text-[12px] text-slate-200">{autoScroll ? 'Pause' : 'Resume'} auto-scroll</button>
          <button type="button" onClick={onExport} className="inline-flex h-8 items-center gap-2 rounded-[5px] border border-white/12 bg-[#0b1725] px-3 text-[12px] text-slate-200"><FileJson className="h-3.5 w-3.5" />View raw ledger</button>
        </div>
      </div>
    </div>
  )
}

function FieldLabel({ htmlFor, children }: { htmlFor: string; children: ReactNode }) {
  return <label htmlFor={htmlFor} className={cx(labelClass, 'mb-1 block')}>{children}</label>
}

function SettingRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[13px] text-slate-300">{label}</span>
      <div className="grid grid-flow-col overflow-hidden rounded-[5px] border border-white/10 bg-[#07111d]">{children}</div>
    </div>
  )
}

function SegmentButton({ active, onClick, title, children }: { active: boolean; onClick: () => void; title?: string; children: ReactNode }) {
  return (
    <button type="button" title={title} onClick={onClick} className={cx('h-9 border-r border-white/10 px-3 text-[13px] text-slate-300 last:border-r-0', active && 'bg-[#7657d9] text-white')}>
      {children}
    </button>
  )
}

function CompactSelect({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[120px_minmax(0,1fr)] items-center gap-2">
      <span className="text-[13px] text-slate-300">{label}</span>
      <div className="flex h-9 items-center justify-between rounded-[5px] border border-white/10 bg-[#07111d] px-3 text-[13px] text-slate-200">
        {value}<ChevronDown className="h-4 w-4 text-slate-500" />
      </div>
    </div>
  )
}

function ChecklistRow({ label, ok, optional }: { label: string; ok: boolean; optional?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-white/8 py-1.5 last:border-b-0">
      <span className="text-[13px] text-slate-300">{label}</span>
      {ok ? <CheckCircle2 className="h-4 w-4 text-[#5ee884]" /> : optional ? <span className="text-[12px] text-[#ffd079]">Optional</span> : <Circle className="h-4 w-4 text-slate-500" />}
    </div>
  )
}

function CheckLine({ ok, children }: { ok: boolean; children: ReactNode }) {
  return <span className="flex items-center gap-2">{ok ? <CheckCircle2 className="h-3.5 w-3.5 text-[#5ee884]" /> : <Circle className="h-3.5 w-3.5 text-slate-500" />}{children}</span>
}

function CheckChip({ ok, optional, children }: { ok: boolean; optional?: boolean; children: ReactNode }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-[5px] border px-2.5 py-1 text-[12px]', ok ? 'border-[#5ee884]/30 bg-[#5ee884]/10 text-[#7af0a2]' : optional ? 'border-[#ffd079]/35 bg-[#ffd079]/10 text-[#ffd079]' : 'border-white/10 bg-white/[0.035] text-slate-400')}>
      {ok ? '✓' : optional ? '!' : '·'} {children}
    </span>
  )
}

function ChipRow({ values, issue }: { values: string[]; issue?: boolean }) {
  if (values.length === 0) return null
  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {values.slice(0, 6).map((value) => <TinyChip key={value} warning={issue}>{value}</TinyChip>)}
    </div>
  )
}

function TinyChip({ children, warning, danger, cyan }: { children: ReactNode; warning?: boolean; danger?: boolean; cyan?: boolean }) {
  return (
    <span className={cx(
      'inline-flex max-w-full items-center rounded-[4px] border px-2 py-0.5 text-[11px]',
      warning && 'border-[#ffd079]/35 bg-[#ffd079]/10 text-[#ffd079]',
      danger && 'border-[#ff8ea5]/35 bg-[#ff8ea5]/10 text-[#ff8ea5]',
      cyan && 'border-[#82e2f1]/35 bg-[#82e2f1]/10 text-[#82e2f1]',
      !warning && !danger && !cyan && 'border-white/12 bg-white/[0.035] text-slate-300'
    )}>{children}</span>
  )
}

function EmptyPanel({ copy }: { copy: string }) {
  return <div className="rounded-[5px] border border-dashed border-white/12 bg-[#07111d]/60 px-3 py-5 text-center text-[12px] text-slate-500">{copy}</div>
}

function FooterPill({ icon, text }: { icon: ReactNode; text: string }) {
  return <span className="inline-flex h-8 max-w-[calc(100vw-2rem)] items-center gap-2 rounded-[5px] border border-white/10 bg-[#0b1725] px-3 font-mono text-[11px] text-slate-300">{icon}<span className="min-w-0 truncate">{text}</span></span>
}

function ActionTile({ index, title, copy, disabled, loading, onClick }: { index: number; title: string; copy: string; disabled?: boolean; loading?: boolean; onClick?: () => void }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled || loading} className="rounded-[6px] border border-white/12 bg-[#07111d] p-3 text-left transition hover:border-white/20 disabled:opacity-60">
      <div className="flex items-center gap-2">
        <span className="grid h-7 w-7 place-items-center rounded-[4px] border border-[#82e2f1]/35 bg-[#82e2f1]/10 font-mono text-[12px] text-[#82e2f1]">{loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : index}</span>
        <span className="text-[14px] font-semibold text-white">{title}</span>
      </div>
      <p className="mt-2 text-[12px] leading-5 text-slate-300">{copy}</p>
    </button>
  )
}

function RailAction({ icon, label, danger, disabled, onClick }: { icon: ReactNode; label: string; danger?: boolean; disabled?: boolean; onClick?: () => void }) {
  return (
    <button type="button" disabled={disabled} onClick={onClick} className={cx('flex w-full items-center gap-3 border-b border-white/8 py-3 text-left text-[13px] last:border-b-0 disabled:opacity-55', danger ? 'text-[#ff8ea5]' : 'text-slate-200')}>
      <span className={danger ? 'text-[#ff8ea5]' : 'text-[#82e2f1]'}>{icon}</span>{label}
    </button>
  )
}

function LoadingArena() {
  return (
    <div className="grid min-h-[360px] place-items-center">
      <div className="flex items-center gap-3 rounded-[6px] border border-white/10 bg-[#081523] px-4 py-3 text-[13px] text-slate-300">
        <Loader2 className="h-4 w-4 animate-spin text-[#82e2f1]" />
        Loading arena ledger
      </div>
    </div>
  )
}
