'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  Bot,
  ChevronDown,
  ChevronRight,
  Crown,
  Database,
  Loader2,
  Orbit,
  PauseCircle,
  RefreshCw,
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

/* ──────────────────────────────────────────────────────
   Types & constants
   ────────────────────────────────────────────────────── */

type ArenaDetailResponse = {
  run: ArenaRun
  events: ArenaEvent[]
}

const premiumPanel = 'rounded-md border border-border/40 bg-card/40 backdrop-blur-md shadow-sm'
const subPanel = 'rounded-sm border border-border/30 bg-muted/20'
const labelStyle = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80'

const accentPairs = [
  { panel: 'border-cyan-400/20 bg-cyan-400/[0.08]', text: 'text-cyan-300', dot: 'bg-cyan-400', bar: 'bg-cyan-400' },
  { panel: 'border-amber-400/20 bg-amber-400/[0.08]', text: 'text-amber-300', dot: 'bg-amber-400', bar: 'bg-amber-400' },
  { panel: 'border-emerald-400/20 bg-emerald-400/[0.08]', text: 'text-emerald-300', dot: 'bg-emerald-400', bar: 'bg-emerald-400' },
  { panel: 'border-fuchsia-400/20 bg-fuchsia-400/[0.08]', text: 'text-fuchsia-300', dot: 'bg-fuchsia-400', bar: 'bg-fuchsia-400' },
]

const responseBudgets: Array<{ value: ArenaResponseBudget; label: string; detail: string }> = [
  { value: 'tight', label: 'Tight', detail: 'Sharper, shorter turns for faster local runs.' },
  { value: 'balanced', label: 'Balanced', detail: 'Default pacing for 10-12 round debates.' },
  { value: 'expanded', label: 'Expanded', detail: 'Longer responses and heavier local load.' },
]

const EVENT_KIND_META: Record<string, { label: string; color: string }> = {
  head_directive: { label: 'Head Directive', color: 'text-pastel-blue' },
  debater_turn: { label: 'Debater Turn', color: 'text-foreground' },
  head_intervention: { label: 'Head Intervention', color: 'text-pastel-yellow' },
  round_summary: { label: 'Round Summary', color: 'text-pastel-purple' },
  score_update: { label: 'Score Update', color: 'text-pastel-green' },
  report_published: { label: 'Final Report', color: 'text-pastel-yellow' },
  run_prepared: { label: 'Run Prepared', color: 'text-muted-foreground' },
  seat_generated: { label: 'Seats Generated', color: 'text-muted-foreground' },
  phase_started: { label: 'Phase Started', color: 'text-pastel-purple' },
  phase_completed: { label: 'Phase Completed', color: 'text-pastel-green' },
  run_cancelled: { label: 'Run Cancelled', color: 'text-pastel-red' },
  run_failed: { label: 'Run Failed', color: 'text-pastel-red' },
}

/* ──────────────────────────────────────────────────────
   Helpers
   ────────────────────────────────────────────────────── */

function getStatusTone(status: ArenaRun['status']) {
  if (status === 'completed') return 'border-pastel-green/30 bg-pastel-green/10 text-pastel-green'
  if (status === 'running') return 'border-pastel-blue/30 bg-pastel-blue/10 text-pastel-blue'
  if (status === 'failed') return 'border-pastel-red/30 bg-pastel-red/10 text-pastel-red'
  if (status === 'cancelled') return 'border-pastel-yellow/30 bg-pastel-yellow/10 text-pastel-yellow'
  return 'border-border/50 bg-muted/20 text-muted-foreground'
}

function getStageLabel(value: string) { return value.replaceAll('_', ' ') }

function formatTime(value?: string) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, { dateStyle: 'medium', timeStyle: 'short' }).format(new Date(value))
}

function formatTimeShort(value?: string) {
  if (!value) return ''
  return new Intl.DateTimeFormat(undefined, { hour: '2-digit', minute: '2-digit' }).format(new Date(value))
}

function participantAccent(index: number) { return accentPairs[index % accentPairs.length] }

function getPayloadRecord(event: ArenaEvent): Record<string, unknown> {
  return event.payload && typeof event.payload === 'object' ? event.payload as Record<string, unknown> : {}
}

function stringList(value: unknown): string[] {
  return Array.isArray(value) ? value.map((e) => String(e).trim()).filter(Boolean) : []
}

function getSeatName(agentId: string, seats: ArenaSeat[]): string {
  return seats.find((s) => s.agentId === agentId)?.agentName || agentId
}

function getSeatAccent(agentId: string | undefined, seats: ArenaSeat[]) {
  if (!agentId) return accentPairs[0]
  const idx = seats.findIndex((s) => s.agentId === agentId)
  return participantAccent(idx >= 0 ? idx : 0)
}

async function parseResponse<T>(response: Response): Promise<T> {
  const payload = await response.text()
  const json = payload ? JSON.parse(payload) as Record<string, unknown> : {}
  if (!response.ok) throw new Error(typeof json.error === 'string' ? json.error : `Request failed with status ${response.status}`)
  return json as T
}

/* ──────────────────────────────────────────────────────
   Main page
   ────────────────────────────────────────────────────── */

export default function SimulationPage() {
  const { agents, fetchAgents } = useAgentStore()
  const selectedProvider = useLLMPreferenceStore((s) => s.provider)
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
  const [expandedEvents, setExpandedEvents] = useState<Set<string>>(new Set())
  const [archiveOpen, setArchiveOpen] = useState(false)

  const selectedRun = detail?.run || null
  const runEvents = useMemo(() => detail?.events ?? [], [detail?.events])
  const isDraft = selectedRun?.status === 'draft'
  const isRunning = selectedRun?.status === 'running'
  const isTerminal = selectedRun?.status === 'completed' || selectedRun?.status === 'failed' || selectedRun?.status === 'cancelled'

  const activeHeadDirective = useMemo(
    () => [...runEvents].reverse().find((e) => e.kind === 'head_directive'), [runEvents]
  )
  const activeHeadPayload = useMemo(() => {
    if (!activeHeadDirective) return {} as Record<string, unknown>
    return getPayloadRecord(activeHeadDirective)
  }, [activeHeadDirective])
  const currentQueue = useMemo(() => stringList(activeHeadPayload.speakerOrder), [activeHeadPayload])
  const headSignals = useMemo(() => stringList(activeHeadPayload.scoreSignals), [activeHeadPayload])
  const availableAgents = useMemo(() => agents.slice().sort((a, b) => a.name.localeCompare(b.name)), [agents])
  const sortedScorecards = useMemo(() => (
    selectedRun?.scorecardSnapshot.slice().sort((a, b) => b.total - a.total) || []
  ), [selectedRun?.scorecardSnapshot])
  const runtimeModel = selectedRun?.model || getClientModelForProvider(selectedProvider)
  const latestRound = selectedRun?.ledger.rounds[selectedRun.ledger.rounds.length - 1]
  const degradedEventCount = useMemo(() => runEvents.filter((e) => Boolean(getPayloadRecord(e).degraded)).length, [runEvents])

  // Group events by round
  const eventsByRound = useMemo(() => {
    const grouped = new Map<number, ArenaEvent[]>()
    for (const event of runEvents) {
      const round = event.round || 0
      const existing = grouped.get(round) || []
      existing.push(event)
      grouped.set(round, existing)
    }
    return grouped
  }, [runEvents])
  const roundKeys = useMemo(() => [...eventsByRound.keys()].sort((a, b) => a - b), [eventsByRound])

  useEffect(() => { if (agents.length === 0) void fetchAgents() }, [agents.length, fetchAgents])
  useEffect(() => { if (runEvents.length > 0) eventsEndRef.current?.scrollIntoView({ behavior: 'smooth' }) }, [runEvents.length])

  const initialLoadRef = useRef(true)

  const loadRuns = useCallback(async (silent = false) => {
    try {
      if (!silent) setLoadingRuns(true)
      const payload = await parseResponse<{ runs: ArenaRunSummary[] }>(await fetch('/api/arena/runs?limit=10', { cache: 'no-store' }))
      setRuns(payload.runs || [])
      if (initialLoadRef.current && payload.runs[0]?.id) {
        setSelectedRunId(payload.runs[0].id)
      }
      initialLoadRef.current = false
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
    } catch (error) {
      console.error('Failed to load arena detail:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to load arena detail.')
    } finally {
      if (!silent) setLoadingDetail(false)
    }
  }, [])

  useEffect(() => { void loadRuns() }, [loadRuns])
  useEffect(() => { if (selectedRunId) void loadRunDetail(selectedRunId) }, [loadRunDetail, selectedRunId])

  useEffect(() => {
    if (!selectedRun) return
    setTopic(selectedRun.config.topic)
    setObjective(selectedRun.config.objective)
    setReferenceBrief(selectedRun.config.referenceBrief || '')
    setRoundCount(selectedRun.config.roundCount)
    setResponseBudget(selectedRun.config.responseBudget)
    setSelectedAgentIds(selectedRun.participantIds)
    setSeatDrafts(Object.fromEntries(selectedRun.seats.map((s) => [s.agentId, s])))
  }, [selectedRun])

  useEffect(() => {
    if (!selectedRun || selectedRun.status !== 'running') return
    const id = window.setInterval(() => { void loadRunDetail(selectedRun.id, true); void loadRuns(true) }, 1500)
    return () => window.clearInterval(id)
  }, [loadRunDetail, loadRuns, selectedRun])

  function toggleAgent(agentId: string) {
    setUiError(null)
    setSelectedAgentIds((cur) => {
      if (cur.includes(agentId)) return cur.filter((v) => v !== agentId)
      if (cur.length >= 4) { setUiError('Arena v1 supports up to four participants per run.'); return cur }
      return [...cur, agentId]
    })
  }

  function toggleEventExpanded(eventId: string) {
    setExpandedEvents((prev) => {
      const next = new Set(prev)
      if (next.has(eventId)) { next.delete(eventId) } else { next.add(eventId) }
      return next
    })
  }

  async function prepareArena() {
    if (selectedAgentIds.length < 2) { setUiError('Select at least two agents before preparing the arena.'); return }
    if (!topic.trim()) { setUiError('Add a debate topic before preparing the arena.'); return }
    try {
      setPreparing(true); setUiError(null)
      const payload = await parseResponse<ArenaDetailResponse>(await fetch('/api/arena/runs', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic, objective, participantIds: selectedAgentIds, roundCount, responseBudget, referenceBrief }),
      }))
      setDetail(payload); setSelectedRunId(payload.run.id); await loadRuns(true)
    } catch (error) {
      console.error('Failed to prepare arena:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to prepare arena run.')
    } finally { setPreparing(false) }
  }

  async function saveSeatEdits() {
    if (!selectedRun) return
    try {
      setSavingSeats(true); setUiError(null)
      const payload = await parseResponse<ArenaDetailResponse>(await fetch(`/api/arena/runs/${selectedRun.id}`, {
        method: 'PUT', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic, objective, roundCount, responseBudget, referenceBrief,
          seats: Object.values(seatDrafts).map((s) => ({ agentId: s.agentId, seatLabel: s.seatLabel, stanceBrief: s.stanceBrief, winCondition: s.winCondition })),
        }),
      }))
      setDetail(payload); await loadRuns(true)
    } catch (error) {
      console.error('Failed to save seat edits:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to save seat edits.')
    } finally { setSavingSeats(false) }
  }

  function launchArena() {
    if (!selectedRun) { setUiError('Prepare an arena draft before launching.'); return }
    setUiError(null); setLaunching(true)
    setDetail((c) => c ? { ...c, run: { ...c.run, status: 'running', latestStage: 'opening' } } : c)
    void fetch(`/api/arena/runs/${selectedRun.id}/execute`, {
      method: 'POST', headers: buildLLMPreferenceHeaders(selectedProvider, getClientModelForProvider(selectedProvider)),
    })
      .then(async (r) => { const p = await parseResponse<ArenaDetailResponse>(r); setDetail(p); await loadRuns(true) })
      .catch((e) => { console.error('Failed to launch arena:', e); setUiError(e instanceof Error ? e.message : 'Failed to launch arena run.') })
      .finally(() => setLaunching(false))
  }

  async function cancelArena() {
    if (!selectedRun) return
    try {
      setCancelling(true)
      const p = await parseResponse<ArenaDetailResponse>(await fetch(`/api/arena/runs/${selectedRun.id}/cancel`, { method: 'POST' }))
      setDetail(p); await loadRuns(true)
    } catch (error) {
      console.error('Failed to cancel arena:', error)
      setUiError(error instanceof Error ? error.message : 'Failed to cancel arena.')
    } finally { setCancelling(false) }
  }

  function selectRun(runId: string) {
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
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  /* ──────────────────────────────────────────────────────
     Render
     ────────────────────────────────────────────────────── */

  return (
    <div className="relative min-h-screen pb-20 pt-16 md:pt-20">
      <GradientOrb className="-left-16 top-0 h-[30rem] w-[30rem] opacity-[0.14]" color="cyan" />
      <GradientOrb className="right-0 top-[18%] h-[24rem] w-[24rem] opacity-[0.1]" color="pink" />

      <div className="page-shell space-y-6">
        {/* ════════════════════════════════════════════════
            Header
            ════════════════════════════════════════════════ */}
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
          <div className="flex items-center gap-4">
            <div className="rounded-md bg-pastel-blue/10 p-2.5">
              <Orbit className="h-5 w-5 text-pastel-blue" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-foreground leading-tight tracking-tight">Arena Workspace</h1>
              <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">Head-Led Debate Studio</p>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            {/* Archive Dropdown */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setArchiveOpen((v) => !v)}
                className="group relative inline-flex h-9 items-center overflow-hidden rounded-sm border border-border/40 bg-card/60 backdrop-blur-sm shadow-sm transition-all hover:border-border/80 hover:bg-card/90 hover:shadow-md"
              >
                <div className="flex h-full items-center gap-2 bg-muted/40 px-3 text-[10px] font-bold uppercase tracking-[0.1em] text-muted-foreground border-r border-border/30 transition-colors group-hover:bg-muted/60 group-hover:text-foreground">
                  <Database className="h-3 w-3 text-pastel-cyan/70" />
                  <span className="hidden sm:inline">Archive</span>
                </div>
                <div className="flex h-full items-center px-3 text-[12px] font-medium transition-colors">
                  {selectedRun ? (
                    <span className="truncate max-w-[140px] sm:max-w-[200px] text-foreground/90 group-hover:text-foreground">
                      {selectedRun.config.topic}
                    </span>
                  ) : (
                    <span className="italic text-muted-foreground/70">Select a run…</span>
                  )}
                </div>
                <div className="flex h-full items-center px-2 text-muted-foreground/50 border-l border-border/20 bg-muted/5 group-hover:text-foreground/70 transition-colors group-hover:bg-muted/10">
                  <ChevronDown className={`h-3 w-3 transition-transform ${archiveOpen ? 'rotate-180' : ''}`} />
                </div>
              </button>

              {archiveOpen && (
                <div className="absolute right-0 top-full z-50 mt-1.5 w-[380px] max-h-[420px] overflow-y-auto rounded-md border border-border/40 bg-card/95 backdrop-blur-md shadow-lg scrollbar-thin">
                  <div className="border-b border-border/30 px-3 py-2.5 flex items-center justify-between">
                    <span className={labelStyle}>Run Archive</span>
                    <button
                      type="button"
                      onClick={startNewDraft}
                      className="text-[10px] font-bold uppercase tracking-widest text-pastel-purple hover:text-pastel-purple/80 transition-colors"
                    >
                      + New Draft
                    </button>
                  </div>
                  {loadingRuns && runs.length === 0 ? (
                    <div className="flex items-center justify-center py-8"><Loader2 className="h-4 w-4 animate-spin text-muted-foreground" /></div>
                  ) : runs.length === 0 ? (
                    <div className="px-4 py-6 text-center text-[11px] text-muted-foreground italic">No arena runs yet.</div>
                  ) : (
                    <div className="p-1.5 space-y-1">
                      {runs.map((run) => (
                        <button
                          key={run.id}
                          type="button"
                          onClick={() => selectRun(run.id)}
                          className={`w-full rounded-sm border p-2.5 text-left transition-colors ${
                            selectedRunId === run.id
                              ? 'border-pastel-purple/40 bg-pastel-purple/10'
                              : 'border-transparent hover:border-border/40 hover:bg-muted/10'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1">
                              <div className="line-clamp-1 text-[11px] font-bold text-foreground">{run.topic}</div>
                              <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                                {run.participantNames.join(' · ')} · R{run.currentRound}/{run.roundCount}
                              </div>
                            </div>
                            <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] ${getStatusTone(run.status)}`}>
                              {run.status}
                            </span>
                          </div>
                          <div className="mt-1.5 flex gap-3 text-[9px] text-muted-foreground">
                            <span>{run.eventCount} events</span>
                            {run.winnerAgentName && (
                              <span className="text-pastel-yellow flex items-center gap-1"><Crown className="h-2.5 w-2.5" />{run.winnerAgentName}</span>
                            )}
                            <span className="ml-auto">{formatTime(run.updatedAt)}</span>
                          </div>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              onClick={startNewDraft}
              className="inline-flex h-9 items-center gap-2 rounded-md border border-pastel-purple/30 bg-pastel-purple/10 px-3 text-[11px] font-bold text-pastel-purple transition-colors hover:bg-pastel-purple/15"
            >
              <Target className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Draft</span>
            </button>

            <button
              type="button"
              onClick={() => void loadRuns()}
              disabled={loadingRuns}
              className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border/40 bg-muted/20 px-3 text-[11px] font-bold text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingRuns ? 'animate-spin' : ''}`} />
            </button>
          </div>
        </div>

        {/* ════════════════════════════════════════════════
            Status Strip (when run is active)
            ════════════════════════════════════════════════ */}
        {selectedRun && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            className={`${premiumPanel} px-5 py-3 flex flex-wrap items-center gap-x-6 gap-y-2`}
            role="status" aria-label="Current arena run status"
          >
            <div className="flex items-center gap-2">
              <span className={`rounded-full border px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] ${getStatusTone(selectedRun.status)}`}>
                {selectedRun.status}
              </span>
              {isRunning && (
                <span className="relative flex h-2 w-2">
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pastel-blue/70" />
                  <span className="relative inline-flex h-2 w-2 rounded-full bg-pastel-blue" />
                </span>
              )}
            </div>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{getStageLabel(selectedRun.latestStage)}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Round {selectedRun.currentRound}/{selectedRun.config.roundCount}</span>
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{runEvents.length} events</span>
            {degradedEventCount > 0 && (
              <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-pastel-yellow">{degradedEventCount} degraded</span>
            )}
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{LLM_PROVIDER_LABELS[selectedProvider]} · {runtimeModel}</span>
            {sortedScorecards[0] && (
              <div className="ml-auto flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.18em] text-pastel-yellow">
                <Crown className="h-3 w-3" />{sortedScorecards[0].agentName} · {sortedScorecards[0].total}pts
              </div>
            )}

            {/* Inline actions in status strip */}
            <div className="flex items-center gap-2 ml-auto sm:ml-0">
              {isDraft && (
                <>
                  <button type="button" onClick={() => void saveSeatEdits()} disabled={savingSeats}
                    className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-border/40 bg-muted/20 px-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground transition-colors hover:bg-muted/30 disabled:opacity-60">
                    {savingSeats ? <Loader2 className="h-3 w-3 animate-spin" /> : <Shield className="h-3 w-3" />}Save
                  </button>
                  <button type="button" onClick={launchArena} disabled={launching}
                    className="inline-flex h-7 items-center gap-1.5 rounded-sm bg-pastel-purple px-3 text-[10px] font-bold uppercase tracking-[0.15em] text-primary-foreground transition-colors hover:bg-pastel-purple/90 disabled:opacity-60">
                    {launching ? <Loader2 className="h-3 w-3 animate-spin" /> : <Zap className="h-3 w-3" />}Launch
                  </button>
                </>
              )}
              {isRunning && (
                <button type="button" onClick={() => void cancelArena()} disabled={cancelling}
                  className="inline-flex h-7 items-center gap-1.5 rounded-sm border border-pastel-red/40 bg-pastel-red/10 px-2.5 text-[10px] font-bold uppercase tracking-[0.15em] text-pastel-red transition-colors hover:bg-pastel-red/15 disabled:opacity-60">
                  {cancelling ? <Loader2 className="h-3 w-3 animate-spin" /> : <PauseCircle className="h-3 w-3" />}Stop
                </button>
              )}
            </div>
          </motion.div>
        )}

        {/* Error Banner */}
        {uiError && (
          <div className="rounded-md border border-pastel-red/30 bg-pastel-red/5 px-4 py-3 text-[13px] text-pastel-red flex items-start gap-3" role="alert">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" /><span>{uiError}</span>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            Loading State
            ════════════════════════════════════════════════ */}
        {loadingDetail && !detail && (
          <div className="flex items-center justify-center py-24">
            <div className="flex flex-col items-center gap-4">
              <div className="relative flex h-16 w-16 items-center justify-center">
                <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="absolute inset-0 rounded-full border border-dashed border-pastel-blue/30" />
                <motion.div animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-2 rounded-full border border-pastel-blue/20 bg-pastel-blue/5" />
                <Orbit className="relative h-5 w-5 text-pastel-blue" />
              </div>
              <span className="text-[11px] font-bold uppercase tracking-[0.25em] text-pastel-blue">Loading Arena</span>
            </div>
          </div>
        )}

        {/* ════════════════════════════════════════════════
            Phase: No Run Selected → Draft Builder (full width, spacious form)
            ════════════════════════════════════════════════ */}
        {!loadingDetail && !selectedRun && (
          <section className={`${premiumPanel} overflow-hidden`} aria-label="Draft Builder">
            <div className="border-b border-border/40 bg-muted/10 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Target className="h-4 w-4 text-pastel-purple" />
                <span className="text-[12px] font-bold uppercase tracking-[0.2em]">Draft Builder</span>
              </div>
              <span className="rounded-full border border-border/40 bg-muted/20 px-3 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">sandboxed</span>
            </div>

            <div className="p-6 grid gap-8 lg:grid-cols-[1fr_360px]">
              {/* Left Column: Context Inputs */}
              <div className="space-y-6">
                <div className="space-y-2">
                  <label htmlFor="arena-topic" className={labelStyle}>Debate Topic</label>
                  <Textarea id="arena-topic" value={topic} onChange={(e) => setTopic(e.target.value)}
                    className="min-h-[140px] resize-none border-border/30 bg-muted/5 text-[14px] leading-relaxed"
                    placeholder="What should the head force the arena to resolve?" />
                </div>
                
                <div className="grid gap-6 sm:grid-cols-2">
                  <div className="space-y-2">
                    <label htmlFor="arena-objective" className={labelStyle}>Objective</label>
                    <Textarea id="arena-objective" value={objective} onChange={(e) => setObjective(e.target.value)}
                      className="min-h-[120px] resize-none border-border/30 bg-muted/5 text-[12px] leading-relaxed"
                      placeholder="Define the outcome the debate should drive toward." />
                  </div>
                  <div className="space-y-2">
                    <label htmlFor="arena-ref" className={labelStyle}>Reference Brief</label>
                    <Textarea id="arena-ref" value={referenceBrief} onChange={(e) => setReferenceBrief(e.target.value)}
                      className="min-h-[120px] resize-none border-border/30 bg-muted/5 text-[12px] leading-relaxed"
                      placeholder="Optional product context, constraints, or evidence for the head." />
                  </div>
                </div>
              </div>

              {/* Right Column: Execution Settings */}
              <div className="space-y-6 flex flex-col">
                <div className="space-y-2">
                  <div className={labelStyle}>Execution Engine</div>
                  <LLMProviderToggle compact />
                </div>

                <div className="grid gap-4 grid-cols-2">
                  <div className="space-y-2">
                    <div className={labelStyle}>Rounds</div>
                    <div className="flex gap-1.5 flex-wrap">
                      {[10, 11, 12].map((v) => (
                        <button key={v} type="button" aria-pressed={roundCount === v} onClick={() => setRoundCount(v)}
                          className={`flex-1 rounded-sm border px-2 py-2 text-[12px] font-bold transition-colors ${
                            roundCount === v ? 'border-pastel-purple/40 bg-pastel-purple/10 text-foreground' : 'border-border/30 bg-muted/5 text-muted-foreground hover:text-foreground'
                          }`}>{v}</button>
                      ))}
                    </div>
                  </div>
                  <div className="space-y-2">
                    <div className={labelStyle}>Budget</div>
                    <div className="flex gap-1.5 flex-col">
                      {responseBudgets.map((opt) => (
                        <button key={opt.value} type="button" aria-pressed={responseBudget === opt.value} onClick={() => setResponseBudget(opt.value)} title={opt.detail}
                          className={`w-full rounded-sm border px-2 py-1.5 text-[11px] font-bold transition-colors text-center ${
                            responseBudget === opt.value ? 'border-pastel-blue/40 bg-pastel-blue/10 text-foreground' : 'border-border/30 bg-muted/5 text-muted-foreground hover:text-foreground'
                          }`}>{opt.label}</button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="space-y-2 flex flex-col h-[280px]">
                  <div className="flex items-center justify-between shrink-0">
                    <span className={labelStyle}>Agent Roster</span>
                    <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">{selectedAgentIds.length}/4</span>
                  </div>
                  <div className="flex-1 min-h-0 overflow-y-auto space-y-1.5 pr-1 scrollbar-thin rounded-sm border border-border/20 bg-muted/5 p-1.5">
                    {availableAgents.map((agent, idx) => {
                      const sel = selectedAgentIds.includes(agent.id)
                      const accent = participantAccent(idx)
                      return (
                        <button key={agent.id} type="button" aria-pressed={sel} onClick={() => toggleAgent(agent.id)}
                          className={`w-full rounded-sm border p-2.5 text-left transition-colors ${sel ? accent.panel : 'border-border/30 bg-card hover:bg-muted/10'}`}>
                          <div className="flex items-center justify-between gap-2">
                            <div className="min-w-0">
                              <div className={`truncate text-[12px] font-bold ${sel ? accent.text : 'text-foreground'}`}>{agent.name}</div>
                              <p className="mt-0.5 line-clamp-1 text-[10px] text-muted-foreground">{agent.persona}</p>
                            </div>
                            <span className={`h-2 w-2 shrink-0 rounded-full ${sel ? accent.dot : 'bg-border'}`} />
                          </div>
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
            </div>

            {/* Bottom Bar: Action */}
            <div className="border-t border-border/20 bg-muted/10 px-6 py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <p className="text-[11px] text-muted-foreground">Arena runs are sandboxed. No long-term state is written.</p>
              <button type="button" onClick={() => void prepareArena()} disabled={preparing}
                className="inline-flex h-10 w-full sm:w-auto items-center justify-center gap-2 rounded-sm bg-pastel-purple px-8 text-[11px] font-bold uppercase tracking-[0.2em] text-primary-foreground transition-colors hover:bg-pastel-purple/90 disabled:opacity-60">
                {preparing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Target className="h-4 w-4" />}
                Prepare Arena Draft
              </button>
            </div>
          </section>
        )}

        {/* ════════════════════════════════════════════════
            Phase: Run Active → 2-Column Layout
            Main content scrolls naturally with the page.
            Sidebar is sticky on XL screens.
            ════════════════════════════════════════════════ */}
        {selectedRun && (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px] items-start">

            {/* ──── Main Column (scrolls naturally) ──── */}
            <div className="space-y-6 min-w-0">

              {/* Topic + Participant chips */}
              <div className={`${premiumPanel} px-6 py-5`}>
                <h2 className="text-xl font-black tracking-tight text-foreground leading-tight">{selectedRun.config.topic}</h2>
                <p className="mt-2 text-[13px] leading-relaxed text-muted-foreground">{selectedRun.config.objective}</p>
                <div className="mt-4 flex flex-wrap gap-1.5">
                  {selectedRun.seats.map((seat, i) => {
                    const accent = participantAccent(i)
                    return (
                      <span key={seat.agentId} className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold ${accent.panel}`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                        {seat.agentName}
                        <span className="text-muted-foreground/60">/</span>
                        <span className="text-muted-foreground">{seat.seatLabel}</span>
                      </span>
                    )
                  })}
                </div>
              </div>

              {/* Head Control Layer */}
              {activeHeadDirective && (
                <div className={`${premiumPanel} border-l-2 border-l-pastel-blue/40 px-6 py-4`}>
                  <div className="flex items-start gap-3">
                    <div className="mt-0.5 rounded-sm bg-pastel-blue/15 p-1.5 shrink-0">
                      <Sparkles className="h-3.5 w-3.5 text-pastel-blue" />
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-pastel-blue">Head Focus</span>
                        {Boolean(activeHeadPayload.degraded) && (
                          <span className="rounded-full border border-pastel-yellow/30 bg-pastel-yellow/10 px-2 py-0.5 text-[8px] font-bold uppercase tracking-[0.18em] text-pastel-yellow">degraded</span>
                        )}
                      </div>
                      <div className="mt-1.5 text-[13px] font-bold text-foreground leading-snug">
                        {activeHeadDirective.summary || selectedRun.ledger.latestFocusQuestion || 'The head has not published a focus question yet.'}
                      </div>
                      {headSignals.length > 0 && (
                        <div className="mt-2.5 flex flex-wrap gap-1.5">
                          {headSignals.map((s) => (
                            <span key={s} className="rounded-full border border-border/40 bg-muted/30 px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{s}</span>
                          ))}
                        </div>
                      )}
                      {typeof activeHeadPayload.degradedReason === 'string' && activeHeadPayload.degradedReason && (
                        <div className="mt-2 text-[11px] leading-relaxed text-pastel-yellow">{activeHeadPayload.degradedReason}</div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Seat Editor (Draft only) */}
              {isDraft && (
                <section className="space-y-4" aria-label="Seat editing">
                  <div className="flex items-center gap-2 px-1">
                    <Swords className="h-4 w-4 text-pastel-purple" />
                    <span className="text-[12px] font-bold uppercase tracking-[0.2em]">Seat Configuration</span>
                  </div>
                  <p className="text-[12px] leading-relaxed text-muted-foreground px-1">
                    Adjust seat labels, stance briefs, and win conditions before launch. These are the strongest controls against persona collapse.
                  </p>
                  <div className="grid gap-4 lg:grid-cols-2">
                    {selectedRun.seats.map((seat, i) => {
                      const draft = seatDrafts[seat.agentId] || seat
                      return <SeatEditorCard key={seat.agentId} seat={draft} accentIndex={i}
                        onChange={(next) => setSeatDrafts((c) => ({ ...c, [seat.agentId]: next }))} />
                    })}
                  </div>
                </section>
              )}

              {/* Event Transcript */}
              {runEvents.length > 0 && (
                <section className="space-y-3" aria-label="Event transcript">
                  <div className="flex items-center justify-between gap-3 px-1">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4 text-muted-foreground" />
                      <span className="text-[12px] font-bold uppercase tracking-[0.2em]">Debate Transcript</span>
                      <span className="text-[10px] text-muted-foreground ml-1">({runEvents.length})</span>
                    </div>
                    {isRunning && (
                      <div className="inline-flex items-center gap-1.5 rounded-full border border-pastel-blue/30 bg-pastel-blue/10 px-2.5 py-1 text-[9px] font-bold uppercase tracking-[0.18em] text-pastel-blue">
                        <span className="relative flex h-2 w-2">
                          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-pastel-blue/70" />
                          <span className="relative inline-flex h-2 w-2 rounded-full bg-pastel-blue" />
                        </span>live
                      </div>
                    )}
                  </div>

                  <AnimatePresence initial={false}>
                    {roundKeys.map((roundNum) => {
                      const events = eventsByRound.get(roundNum) || []
                      return (
                        <div key={roundNum}>
                          {roundNum > 0 && (
                            <div className="flex items-center gap-3 py-4" role="separator">
                              <div className="h-px flex-1 bg-border/40" />
                              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-pastel-purple">Round {roundNum}</span>
                              <div className="h-px flex-1 bg-border/40" />
                            </div>
                          )}
                          {events.map((event) => (
                            <ArenaEventCard key={event.id} event={event} seats={selectedRun.seats}
                              seat={selectedRun.seats.find((s) => s.agentId === event.speakerAgentId)}
                              seatIndex={selectedRun.seats.findIndex((s) => s.agentId === event.speakerAgentId)}
                              isExpanded={expandedEvents.has(event.id)}
                              onToggleExpand={() => toggleEventExpanded(event.id)} />
                          ))}
                        </div>
                      )
                    })}
                  </AnimatePresence>
                  <div ref={eventsEndRef} />
                </section>
              )}

              {runEvents.length === 0 && !isDraft && (
                <EmptyPanel copy="Arena events will appear here once the run starts." />
              )}

              {/* Final Report inline at bottom of transcript */}
              {selectedRun.finalReport && (
                <section className={`${premiumPanel} border-l-2 border-l-pastel-yellow/40 overflow-hidden`} aria-label="Final report">
                  <div className="border-b border-border/40 bg-pastel-yellow/[0.04] px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Crown className="h-4 w-4 text-pastel-yellow" />
                      <span className="text-[12px] font-bold uppercase tracking-[0.2em]">Final Verdict</span>
                    </div>
                    <span className="inline-flex items-center gap-1.5 rounded-full border border-pastel-yellow/30 bg-pastel-yellow/10 px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] text-pastel-yellow">
                      <Crown className="h-3 w-3" />{selectedRun.finalReport.winnerAgentName}
                    </span>
                  </div>
                  <div className="p-6 space-y-5">
                    <div className="rounded-sm border border-pastel-yellow/20 bg-pastel-yellow/[0.06] p-4">
                      <div className={labelStyle}>Verdict Summary</div>
                      <p className="mt-2 text-[13px] leading-relaxed text-foreground/90">{selectedRun.finalReport.verdictSummary}</p>
                    </div>

                    {selectedRun.finalReport.decisiveMoments.length > 0 && (
                      <div>
                        <div className={labelStyle}>Decisive Moments</div>
                        <div className="mt-2 grid gap-3 lg:grid-cols-2">
                          {selectedRun.finalReport.decisiveMoments.map((m) => (
                            <div key={m.eventId} className={`${subPanel} p-3.5`}>
                              <div className="text-[12px] font-bold text-foreground">{m.title}</div>
                              <div className="mt-0.5 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">
                                round {m.round || 0}{m.agentName ? ` · ${m.agentName}` : ''}
                              </div>
                              <p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{m.summary}</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    <div className="grid gap-5 lg:grid-cols-3">
                      <ReportListCard title="Head Interventions" items={selectedRun.finalReport.headInterventionSummary} emptyCopy="No intervention summary." />
                      <ReportListCard title="Unresolved Questions" items={selectedRun.finalReport.unresolvedQuestions} emptyCopy="No major unresolved questions." />
                      <ReportListCard title="Improvement Notes" items={selectedRun.finalReport.improvementNotes} emptyCopy="No improvement notes." />
                    </div>
                  </div>
                </section>
              )}
            </div>

            {/* ──── Sticky Sidebar (Inspector) ──── */}
            <aside className="hidden xl:block sticky top-28 self-start max-h-[calc(100vh-8rem)] overflow-y-auto scrollbar-thin space-y-4">

              {/* Scoreboard */}
              <section className={`${premiumPanel} overflow-hidden`} aria-label="Scoreboard">
                <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center gap-2">
                  <Crown className="h-3.5 w-3.5 text-pastel-yellow" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Scoreboard</span>
                </div>
                <div className="p-3 space-y-2">
                  {sortedScorecards.length === 0 ? (
                    <EmptyPanel copy="Scores appear after the first debater turns." compact />
                  ) : sortedScorecards.map((sc, i) => (
                    <ScorecardPanel key={sc.agentId} scorecard={sc} seats={selectedRun.seats}
                      isWinner={isTerminal && i === 0} maxTotal={sortedScorecards[0]?.total || 1} />
                  ))}
                </div>
              </section>

              {/* Speaker Queue */}
              <section className={`${premiumPanel} overflow-hidden`} aria-label="Speaker queue">
                <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center gap-2">
                  <Bot className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Speaker Queue</span>
                </div>
                <div className="p-3 space-y-1.5">
                  {currentQueue.length === 0 ? (
                    <EmptyPanel copy="No speaker order emitted yet." compact />
                  ) : currentQueue.map((agentId, i) => {
                    const seat = selectedRun.seats.find((s) => s.agentId === agentId)
                    if (!seat) return null
                    const accent = getSeatAccent(agentId, selectedRun.seats)
                    return (
                      <div key={agentId} className={`flex items-center justify-between rounded-sm border px-3 py-2 ${accent.panel}`}>
                        <div className="flex items-center gap-2">
                          <span className={`text-[11px] font-bold ${accent.text}`}>{seat.agentName}</span>
                          <span className="text-[9px] uppercase tracking-[0.18em] text-muted-foreground">{seat.seatLabel}</span>
                        </div>
                        <span className="text-[10px] font-bold text-muted-foreground">#{i + 1}</span>
                      </div>
                    )
                  })}
                </div>
              </section>

              {/* Unresolved Threads */}
              <section className={`${premiumPanel} overflow-hidden`} aria-label="Unresolved threads">
                <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center gap-2">
                  <AlertTriangle className="h-3.5 w-3.5 text-pastel-yellow" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Unresolved Threads</span>
                </div>
                <div className="p-3 space-y-1.5">
                  {(() => {
                    const threads = selectedRun.ledger.unresolvedThreads.length > 0
                      ? selectedRun.ledger.unresolvedThreads : latestRound?.unresolvedThreads || []
                    return threads.length === 0
                      ? <EmptyPanel copy="Ledger is clean." compact />
                      : threads.map((t) => (
                        <div key={t} className="rounded-sm border border-border/30 bg-muted/10 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">{t}</div>
                      ))
                  })()}
                </div>
              </section>

              {/* Seat Briefs */}
              <section className={`${premiumPanel} overflow-hidden`} aria-label="Seat briefs">
                <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center gap-2">
                  <Swords className="h-3.5 w-3.5" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Seat Briefs</span>
                </div>
                <div className="p-3 space-y-1.5">
                  {selectedRun.seats.map((seat, i) => {
                    const accent = participantAccent(i)
                    return (
                      <details key={seat.agentId} className={`rounded-sm border ${accent.panel} group`}>
                        <summary className="flex cursor-pointer items-center gap-2 px-3 py-2 text-[10px] font-bold">
                          <span className={`h-1.5 w-1.5 rounded-full ${accent.dot}`} />
                          <span className={accent.text}>{seat.agentName}</span>
                          <span className="text-muted-foreground">— {seat.seatLabel}</span>
                          <ChevronRight className="ml-auto h-3 w-3 text-muted-foreground transition-transform group-open:rotate-90" />
                        </summary>
                        <div className="border-t border-border/20 px-3 py-2 space-y-1.5">
                          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Stance Brief</div>
                          <p className="text-[10px] leading-relaxed text-muted-foreground">{seat.stanceBrief}</p>
                          <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground mt-2">Win Condition</div>
                          <p className="text-[10px] leading-relaxed text-muted-foreground">{seat.winCondition}</p>
                        </div>
                      </details>
                    )
                  })}
                </div>
              </section>
            </aside>

            {/* Mobile inspector fallback */}
            <div className="xl:hidden space-y-4">
              <details className={`${premiumPanel} group`} open>
                <summary className="flex cursor-pointer items-center gap-2 px-5 py-3 border-b border-border/40 bg-muted/10">
                  <Bot className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Inspector</span>
                  <ChevronDown className="ml-auto h-3.5 w-3.5 text-muted-foreground transition-transform group-open:rotate-180" />
                </summary>
                <div className="p-5 grid gap-4 sm:grid-cols-2">
                  {/* Scoreboard */}
                  <div>
                    <div className={labelStyle}>Scoreboard</div>
                    <div className="mt-2 space-y-2">
                      {sortedScorecards.length === 0
                        ? <EmptyPanel copy="Scores appear after the first debater turns." compact />
                        : sortedScorecards.map((sc, i) => (
                          <ScorecardPanel key={sc.agentId} scorecard={sc} seats={selectedRun.seats}
                            isWinner={isTerminal && i === 0} maxTotal={sortedScorecards[0]?.total || 1} />
                        ))}
                    </div>
                  </div>
                  {/* Queue + Threads */}
                  <div className="space-y-4">
                    <div>
                      <div className={labelStyle}>Speaker Queue</div>
                      <div className="mt-2 space-y-1.5">
                        {currentQueue.length === 0
                          ? <EmptyPanel copy="No speaker order yet." compact />
                          : currentQueue.map((agentId, i) => {
                            const seat = selectedRun.seats.find((s) => s.agentId === agentId)
                            if (!seat) return null
                            const accent = getSeatAccent(agentId, selectedRun.seats)
                            return (
                              <div key={agentId} className={`flex items-center justify-between rounded-sm border px-3 py-2 ${accent.panel}`}>
                                <span className={`text-[11px] font-bold ${accent.text}`}>{seat.agentName}</span>
                                <span className="text-[10px] font-bold text-muted-foreground">#{i + 1}</span>
                              </div>
                            )
                          })}
                      </div>
                    </div>
                    <div>
                      <div className={labelStyle}>Unresolved Threads</div>
                      <div className="mt-2 space-y-1.5">
                        {(() => {
                          const threads = selectedRun.ledger.unresolvedThreads.length > 0
                            ? selectedRun.ledger.unresolvedThreads : latestRound?.unresolvedThreads || []
                          return threads.length === 0
                            ? <EmptyPanel copy="Ledger is clean." compact />
                            : threads.map((t) => (
                              <div key={t} className="rounded-sm border border-border/30 bg-muted/10 px-3 py-2 text-[10px] leading-relaxed text-muted-foreground">{t}</div>
                            ))
                        })()}
                      </div>
                    </div>
                  </div>
                </div>
              </details>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

/* ──────────────────────────────────────────────────────
   Sub-components
   ────────────────────────────────────────────────────── */

function SeatEditorCard({ seat, accentIndex, onChange }: {
  seat: ArenaSeat; accentIndex: number; onChange: (s: ArenaSeat) => void
}) {
  const accent = participantAccent(accentIndex)
  return (
    <div className={`${premiumPanel} border-l-2 ${accentIndex === 0 ? 'border-l-cyan-400/40' : accentIndex === 1 ? 'border-l-amber-400/40' : accentIndex === 2 ? 'border-l-emerald-400/40' : 'border-l-fuchsia-400/40'} overflow-hidden`}>
      <div className="px-4 py-3 flex items-center gap-2 border-b border-border/20 bg-muted/5">
        <span className={`h-2.5 w-2.5 rounded-full ${accent.dot}`} />
        <span className={`text-[13px] font-bold ${accent.text}`}>{seat.agentName}</span>
      </div>
      <div className="p-4 grid gap-3">
        <div className="space-y-1.5">
          <div className={labelStyle}>Seat Label</div>
          <Input value={seat.seatLabel} onChange={(e) => onChange({ ...seat, seatLabel: e.target.value })}
            className="border-border/30 bg-muted/5 text-[12px]" placeholder="Seat label" />
        </div>
        <div className="space-y-1.5">
          <div className={labelStyle}>Stance Brief</div>
          <Textarea value={seat.stanceBrief} onChange={(e) => onChange({ ...seat, stanceBrief: e.target.value })}
            className="min-h-[100px] border-border/30 bg-muted/5 text-[12px]" placeholder="What exact line should this seat hold?" />
        </div>
        <div className="space-y-1.5">
          <div className={labelStyle}>Win Condition</div>
          <Textarea value={seat.winCondition} onChange={(e) => onChange({ ...seat, winCondition: e.target.value })}
            className="min-h-[60px] border-border/30 bg-muted/5 text-[12px]" placeholder="What counts as winning?" />
        </div>
      </div>
    </div>
  )
}

function ArenaEventCard({ event, seats, seat, seatIndex, isExpanded, onToggleExpand }: {
  event: ArenaEvent; seats: ArenaSeat[]; seat?: ArenaSeat; seatIndex: number
  isExpanded: boolean; onToggleExpand: () => void
}) {
  const payload = getPayloadRecord(event)

  // 1. Customized Milestone Event: Score Update
  if (event.kind === 'score_update') {
    const scorecards = Array.isArray(payload.scorecards) ? payload.scorecards as ArenaScorecard[] : []
    const maxTotal = scorecards.length > 0 ? Math.max(...scorecards.map(s => s.total)) : 1
    return (
      <div className="my-8 flex flex-col items-center">
        <div className="flex items-center gap-4 w-full mb-6" role="separator">
          <div className="h-px flex-1 bg-gradient-to-r from-transparent to-pastel-green/40" />
          <span className="inline-flex items-center gap-2 rounded-full border border-pastel-green/40 bg-pastel-green/10 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-pastel-green shadow-sm">
            <Orbit className="h-3 w-3" /> Round {event.round || '?'} Scores
          </span>
          <div className="h-px flex-1 bg-gradient-to-l from-transparent to-pastel-green/40" />
        </div>
        <div className="grid gap-3 w-full sm:grid-cols-2 lg:grid-cols-4">
          {scorecards.map((sc) => (
            <ScorecardPanel key={sc.agentId} scorecard={sc} seats={seats} isWinner={false} maxTotal={maxTotal} compact />
          ))}
        </div>
      </div>
    )
  }

  // 2. Customized Milestone Event: Round Summary
  if (event.kind === 'round_summary') {
    const claims = Array.isArray(payload.claimHighlights) ? payload.claimHighlights as Array<{agentId: string; agentName: string; claim: string}> : []
    const unresolvedThreads = Array.isArray(payload.unresolvedThreads) ? payload.unresolvedThreads as string[] : []
    return (
      <div className="my-8 overflow-hidden rounded-sm border border-pastel-purple/30 bg-pastel-purple/[0.04] shadow-sm relative">
        <div className="absolute -right-4 -top-4 opacity-[0.03] pointer-events-none">
          <Orbit className="w-48 h-48 text-pastel-purple" />
        </div>
        <div className="px-5 py-4 border-b border-pastel-purple/10 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="bg-pastel-purple/20 p-1.5 rounded-sm"><RefreshCw className="h-3.5 w-3.5 text-pastel-purple" /></div>
            <span className="text-[12px] font-bold uppercase tracking-[0.2em] text-pastel-purple">Round {event.round || '?'} Synced</span>
          </div>
          <span className="text-[9px] font-bold text-muted-foreground uppercase">{formatTimeShort(event.createdAt)}</span>
        </div>
        <div className="p-5">
          <p className="text-[13px] leading-relaxed text-foreground/90 font-medium mb-5 max-w-3xl">
            {event.summary || event.content}
          </p>
          {claims.length > 0 && (
            <div className="grid gap-4 sm:grid-cols-2 mb-5">
              {claims.map((c, i) => {
                const ac = getSeatAccent(c.agentId, seats)
                return (
                  <div key={i} className="rounded-sm border border-border/30 bg-card/50 p-3.5 shadow-sm">
                    <div className="flex items-center gap-2 mb-1.5">
                      <span className={`h-1.5 w-1.5 rounded-full ${ac.dot}`} />
                      <span className={`text-[10px] font-bold uppercase tracking-[0.15em] ${ac.text}`}>{c.agentName}</span>
                    </div>
                    <div className="text-[12px] leading-relaxed text-muted-foreground line-clamp-3" title={c.claim}>{c.claim}</div>
                  </div>
                )
              })}
            </div>
          )}
          {unresolvedThreads.length > 0 && (
            <div className="border-t border-pastel-purple/10 pt-4">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-pastel-purple mb-2 block">Unresolved Threads</span>
              <div className="flex flex-wrap gap-2">
                {unresolvedThreads.map((t, i) => (
                  <span key={i} className="rounded-sm border border-border/30 bg-muted/20 px-2.5 py-1 text-[11px] text-muted-foreground">{t}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    )
  }

  // 3. Customized Milestone Event: Head Intervention
  if (event.kind === 'head_intervention') {
    return (
      <div className="my-6 flex">
        <div className="rounded-sm border-l-2 border-l-pastel-yellow border-y border-r border-pastel-yellow/30 bg-pastel-yellow/[0.06] p-5 w-full shadow-sm max-w-4xl mx-auto">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <AlertTriangle className="h-4 w-4 text-pastel-yellow" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-pastel-yellow">Head Intervention</span>
            </div>
            <span className="text-[9px] font-bold text-muted-foreground uppercase">{formatTimeShort(event.createdAt)}</span>
          </div>
          <div className="text-[13px] leading-relaxed text-pastel-yellow/90 font-medium">
            {event.content}
          </div>
        </div>
      </div>
    )
  }

  // --- STANDARD EVENT RENDERER (Debater turns, Head directives, etc.) ---
  const accent = participantAccent(seatIndex >= 0 ? seatIndex : 0)
  const isHead = event.speakerType === 'head'
  const isDebater = event.speakerType === 'debater'
  const degraded = Boolean(payload.degraded)
  const degradedReason = typeof payload.degradedReason === 'string' ? payload.degradedReason : ''
  const targets = stringList(payload.targetAgentIds).map((id) => getSeatName(id, seats))
  const concedes = stringList(payload.concedes)
  const scoreDelta = payload.scoreDelta && typeof payload.scoreDelta === 'object' ? payload.scoreDelta as Record<string, unknown> : null
  const nextPressurePoint = typeof payload.nextPressurePoint === 'string' ? payload.nextPressurePoint : ''
  const moveType = typeof payload.moveType === 'string' ? payload.moveType : ''
  const alignmentTag = typeof payload.alignmentTag === 'string' ? payload.alignmentTag : ''
  const isClosing = Boolean(payload.closing)
  const kindInfo = EVENT_KIND_META[event.kind] || { label: event.kind, color: 'text-muted-foreground' }

  const borderColor = isHead ? 'border-l-pastel-blue'
    : isDebater ? (seatIndex === 0 ? 'border-l-cyan-400' : seatIndex === 1 ? 'border-l-amber-400' : seatIndex === 2 ? 'border-l-emerald-400' : 'border-l-fuchsia-400')
    : event.kind === 'report_published' ? 'border-l-pastel-yellow' : 'border-l-border/40'

  const bgTone = event.kind === 'report_published' ? 'bg-pastel-yellow/[0.04]'
    : isHead ? 'bg-pastel-blue/[0.03]' : ''

  const speakerLabel = event.speakerName || (isHead ? 'Arena Head' : 'System')
  const speakerTone = isHead ? 'text-pastel-blue' : isDebater ? accent.text : 'text-muted-foreground'
  const contentPreviewLength = 220
  const hasLongContent = event.content.length > contentPreviewLength
  const showFull = isExpanded || !hasLongContent

  return (
    <motion.article initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
      className={`rounded-sm border border-l-2 ${borderColor} ${bgTone} mb-2.5`}>
      <button type="button" onClick={onToggleExpand} className="w-full text-left px-5 py-3 flex items-start gap-3" aria-expanded={isExpanded}>
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className={`text-[12px] font-bold ${speakerTone}`}>{speakerLabel}</span>
            <span className={`text-[9px] font-bold uppercase tracking-[0.18em] ${kindInfo.color}`}>{kindInfo.label}</span>
            {moveType && <span className="rounded-full border border-border/40 bg-muted/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{moveType}</span>}
            {alignmentTag && <span className="rounded-full border border-border/40 bg-muted/20 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-muted-foreground">{alignmentTag}</span>}
            {isClosing && <span className="rounded-full border border-pastel-yellow/30 bg-pastel-yellow/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-pastel-yellow">closing</span>}
            {degraded && <span className="rounded-full border border-pastel-yellow/30 bg-pastel-yellow/10 px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-[0.15em] text-pastel-yellow">degraded</span>}
          </div>
          <div className="mt-1 text-[13px] font-bold text-foreground leading-snug">{event.title}</div>
        </div>
        <div className="flex items-center gap-2 shrink-0 mt-0.5">
          <span className="text-[9px] text-muted-foreground">{formatTimeShort(event.createdAt)}</span>
          {hasLongContent && <ChevronDown className={`h-3 w-3 text-muted-foreground transition-transform ${isExpanded ? 'rotate-180' : ''}`} />}
        </div>
      </button>

      <AnimatePresence>
        {showFull && (
          <motion.div initial={hasLongContent ? { height: 0, opacity: 0 } : false} animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2 }} className="overflow-hidden">
            <div className="px-5 pb-4 pt-0">
              <div className="text-[13px] leading-relaxed text-foreground/85">{event.content}</div>
              {event.summary && event.summary !== event.content && (
                <div className="mt-3 rounded-sm border border-border/20 bg-background/30 px-3 py-2">
                  <div className="text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Summary</div>
                  <div className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{event.summary}</div>
                </div>
              )}
              {isDebater && seat && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {targets.length > 0 && <span className="rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[9px] font-bold text-foreground">→ {targets.join(', ')}</span>}
                  {concedes.length > 0 && <span className="rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[9px] font-bold text-foreground">concedes {concedes.join(', ')}</span>}
                  {scoreDelta && typeof scoreDelta.total === 'number' && <span className="rounded-full border border-pastel-green/30 bg-pastel-green/10 px-2 py-0.5 text-[9px] font-bold text-pastel-green">+{scoreDelta.total} pts</span>}
                  {nextPressurePoint && <span className="rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[9px] font-bold text-muted-foreground">next: {nextPressurePoint.length > 60 ? `${nextPressurePoint.slice(0, 60)}…` : nextPressurePoint}</span>}
                </div>
              )}
              {isHead && (stringList(payload.scoreSignals).length > 0 || Boolean(payload.rationaleSummary)) && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {stringList(payload.scoreSignals).map((s) => <span key={s} className="rounded-full border border-border/40 bg-muted/20 px-2 py-0.5 text-[9px] font-bold text-foreground">{s}</span>)}
                  {typeof payload.rationaleSummary === 'string' && payload.rationaleSummary && <span className="text-[11px] text-muted-foreground italic ml-1">{payload.rationaleSummary}</span>}
                </div>
              )}
              {degradedReason && <div className="mt-2 rounded-sm border border-pastel-yellow/30 bg-pastel-yellow/10 px-3 py-1.5 text-[11px] leading-relaxed text-pastel-yellow">{degradedReason}</div>}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!showFull && (
        <div className="px-5 pb-3 pt-0">
          <div className="text-[12px] leading-relaxed text-muted-foreground">{event.content.slice(0, contentPreviewLength)}…</div>
        </div>
      )}
    </motion.article>
  )
}

function ScorecardPanel({ scorecard, seats, isWinner, maxTotal, compact = false }: {
  scorecard: ArenaScorecard; seats: ArenaSeat[]; isWinner: boolean; maxTotal: number; compact?: boolean
}) {
  const accent = getSeatAccent(scorecard.agentId, seats)
  const barWidth = maxTotal > 0 ? Math.max(4, (scorecard.total / maxTotal) * 100) : 0

  return (
    <div className={`rounded-sm border border-border/30 bg-muted/10 ${compact ? 'p-3' : 'p-2.5'}`}>
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className={`h-2 w-2 rounded-full ${accent.dot}`} />
          <span className={`text-[11px] font-bold ${accent.text}`}>{scorecard.agentName}</span>
          {isWinner && <Crown className="h-3 w-3 text-pastel-yellow" />}
        </div>
        <span className={`${compact ? 'text-base' : 'text-lg'} font-black tracking-tight text-foreground`}>{scorecard.total}</span>
      </div>
      <div className="mt-2 h-1.5 rounded-full bg-muted/30 overflow-hidden">
        <motion.div initial={false} animate={{ width: `${barWidth}%` }} transition={{ duration: 0.4 }}
          className={`h-full rounded-full ${accent.bar} opacity-60`} />
      </div>
      <div className="mt-2 grid grid-cols-4 gap-1 text-[9px] uppercase tracking-[0.15em] text-muted-foreground">
        <span>CLR {scorecard.clarity}</span><span>PRS {scorecard.pressure}</span>
        <span>RSP {scorecard.responsiveness}</span><span>CON {scorecard.consistency}</span>
      </div>
      {!compact && (
        <p className="mt-1.5 text-[10px] leading-relaxed text-muted-foreground line-clamp-2">{scorecard.summary}</p>
      )}
    </div>
  )
}

function ReportListCard({ title, items, emptyCopy }: { title: string; items: string[]; emptyCopy: string }) {
  return (
    <div>
      <div className={labelStyle}>{title}</div>
      <div className="mt-1.5 space-y-1.5">
        {items.length === 0 ? <EmptyPanel copy={emptyCopy} compact />
          : items.map((item) => (
            <div key={item} className="rounded-sm border border-border/30 bg-muted/10 px-3 py-2 text-[11px] leading-relaxed text-muted-foreground">{item}</div>
          ))}
      </div>
    </div>
  )
}

function EmptyPanel({ copy, compact = false }: { copy: string; compact?: boolean }) {
  return (
    <div className={`rounded-sm border border-dashed border-border/30 bg-muted/5 text-center text-muted-foreground italic ${compact ? 'px-3 py-3 text-[10px]' : 'px-4 py-8 text-[11px]'}`}>
      {copy}
    </div>
  )
}
