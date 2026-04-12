'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock3,
  Languages,
  Loader2,
  MessageSquareQuote,
  RefreshCw,
  Sparkles,
  Target,
  TrendingUp,
  Waves,
} from 'lucide-react'
import { motion } from 'framer-motion'
import { Button } from '@/components/ui/button'
import { buildLLMPreferenceHeaders, getClientModelForProvider, LLM_PROVIDER_LABELS } from '@/lib/llm/clientPreference'
import { useLLMPreferenceStore } from '@/stores/llmPreferenceStore'
import type {
  AgentRecord,
  BigFiveProfile,
  CommunicationFingerprintSnapshot,
  EnneagramProfile,
  MBTIProfile,
  PersonalityEventRecord,
  ProfileAnalysisRun,
  ProfileBootstrapPayload,
  ProfileInterviewTurn,
  ProfilePipelineEvent,
  PsychologicalProfile,
} from '@/types/database'

interface ProfileViewerProps {
  agent: AgentRecord
  refreshToken?: number
  preferredModel?: string
}

interface EvolutionResponse {
  coreTraits: AgentRecord['coreTraits']
  dynamicTraits: AgentRecord['dynamicTraits']
  totalInteractions: number
  lastTraitUpdateAt: string | null
  events: PersonalityEventRecord[]
}

interface ProfileRunDetail {
  run: ProfileAnalysisRun | null
  interviewTurns: ProfileInterviewTurn[]
  pipelineEvents: ProfilePipelineEvent[]
}

const premiumPanel = 'rounded-sm bg-zinc-950/60 border border-zinc-800/60 shadow-2xl backdrop-blur-xl overflow-hidden'
const subPanel = 'rounded-sm bg-zinc-900/40 p-5 border border-zinc-800/50 hover:border-[var(--color-pastel-purple)]/30 hover:bg-zinc-900/60 transition-all duration-300'
const panelClass = 'rounded-sm bg-zinc-900/30 p-6 border border-zinc-800/50 transition-all duration-300 hover:bg-zinc-800/40 hover:border-zinc-700/50'
const compactPanelClass = 'rounded-sm bg-zinc-900/30 p-5 border border-zinc-800/50 transition-all duration-300 hover:bg-zinc-800/40 hover:border-zinc-700/50'
const labelStyle = 'text-[10px] font-bold uppercase tracking-widest text-[var(--color-pastel-purple)]'

const BIG_FIVE_LABELS: Record<keyof BigFiveProfile, { label: string; low: string; high: string; color: string }> = {
  openness: { label: 'Openness', low: 'Practical', high: 'Inventive', color: '#cba6f7' },
  conscientiousness: { label: 'Conscientiousness', low: 'Spontaneous', high: 'Organized', color: '#89b4fa' },
  extraversion: { label: 'Extraversion', low: 'Reserved', high: 'Outgoing', color: '#f9e2af' },
  agreeableness: { label: 'Agreeableness', low: 'Analytical', high: 'Cooperative', color: '#a6e3a1' },
  neuroticism: { label: 'Neuroticism', low: 'Stable', high: 'Sensitive', color: '#f38ba8' },
}

const MBTI_DESCRIPTIONS: Record<string, string> = {
  INTJ: 'The Architect - Strategic and independent thinker',
  INTP: 'The Logician - Innovative and curious problem-solver',
  ENTJ: 'The Commander - Bold and imaginative leader',
  ENTP: 'The Debater - Smart and curious thinker',
  INFJ: 'The Advocate - Quiet and mystical idealist',
  INFP: 'The Mediator - Poetic and kind-hearted altruist',
  ENFJ: 'The Protagonist - Charismatic and inspiring leader',
  ENFP: 'The Campaigner - Enthusiastic and creative free spirit',
  ISTJ: 'The Logistician - Practical and fact-minded individual',
  ISFJ: 'The Defender - Dedicated and warm protector',
  ESTJ: 'The Executive - Excellent administrator',
  ESFJ: 'The Consul - Extraordinarily caring and social',
  ISTP: 'The Virtuoso - Bold and practical experimenter',
  ISFP: 'The Adventurer - Flexible and charming artist',
  ESTP: 'The Entrepreneur - Smart and perceptive go-getter',
  ESFP: 'The Entertainer - Spontaneous and energetic performer',
}

const ENNEAGRAM_TYPES: Record<number, { name: string; description: string; icon: string }> = {
  1: { name: 'The Perfectionist', description: 'Principled, purposeful, self-controlled', icon: '1' },
  2: { name: 'The Helper', description: 'Generous, demonstrative, people-pleasing', icon: '2' },
  3: { name: 'The Achiever', description: 'Adaptive, excelling, driven', icon: '3' },
  4: { name: 'The Individualist', description: 'Expressive, dramatic, self-absorbed', icon: '4' },
  5: { name: 'The Investigator', description: 'Perceptive, innovative, secretive', icon: '5' },
  6: { name: 'The Loyalist', description: 'Engaging, responsible, anxious', icon: '6' },
  7: { name: 'The Enthusiast', description: 'Spontaneous, versatile, scattered', icon: '7' },
  8: { name: 'The Challenger', description: 'Self-confident, decisive, confrontational', icon: '8' },
  9: { name: 'The Peacemaker', description: 'Receptive, reassuring, complacent', icon: '9' },
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text()
  let payload: Record<string, unknown> = {}

  if (raw) {
    try {
      payload = JSON.parse(raw) as Record<string, unknown>
    } catch {
      if (!response.ok) {
        throw new Error('Server returned a non-JSON error response.')
      }
      throw new Error('Server returned malformed JSON.')
    }
  }

  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed with status ${response.status}`)
  }

  return payload as T
}

function formatDateTime(value?: string | null) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function formatTraitLabel(value: string) {
  return value.replaceAll('_', ' ')
}

function formatDeltaPercent(delta?: number | null) {
  if (typeof delta !== 'number') return null
  const percent = Math.round(delta * 100)
  if (percent === 0) return null
  return `${percent > 0 ? '+' : ''}${percent}%`
}

function humanizeIndicator(indicator: string, trait?: string) {
  const parts = indicator.split(':').filter(Boolean)
  const normalized = parts.join(':').toLowerCase()

  const exactMap: Record<string, string> = {
    'user_vulnerable': 'User showed vulnerability',
    'supportive_response': 'Supportive response',
    'structured_guidance': 'Clear structure',
    'topic_alignment': 'Stayed on topic',
    'clear_structure': 'Clear structure',
    'hedging_language': 'Hedging in response',
    'retained_context': 'Retained prior context',
  }

  if (exactMap[normalized]) return exactMap[normalized]

  if (parts[0] === 'retained' && parts[1]) {
    return `Remembered ${parts[1].replaceAll('_', ' ')}`
  }

  if (parts.length >= 2 && parts[1] === 'retained' && parts[2]) {
    return `Remembered ${parts[2].replaceAll('_', ' ')}`
  }

  if (parts.length >= 2) {
    return `${(trait || parts[0]).replaceAll('_', ' ')}: ${parts.slice(1).join(' ').replaceAll('_', ' ')}`
  }

  return indicator.replaceAll('_', ' ')
}

function getEventEvidenceSummary(event: PersonalityEventRecord) {
  const readableEvidence = event.traitDeltas
    .flatMap((delta) => (delta.indicators || []).map((indicator) => humanizeIndicator(indicator, delta.trait)))
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, 4)

  return readableEvidence
}

function getVisibleTraitDeltas(event: PersonalityEventRecord) {
  const meaningful = event.traitDeltas.filter((delta) => typeof delta.delta === 'number' && Math.abs(delta.delta) >= 0.005)
  return meaningful.length > 0 ? meaningful : event.traitDeltas.filter((delta) => (delta.indicators || []).length > 0).slice(0, 2)
}

function MetricTile({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className={`${subPanel} p-3`}>
      <div className={labelStyle}>{label}</div>
      <div className="mt-1 text-lg font-bold text-foreground leading-none">{value}</div>
      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{hint}</div>
    </div>
  )
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-sm border border-dashed border-zinc-700/50 bg-zinc-900/30 px-6 py-10 text-center transition-all duration-300 hover:bg-zinc-900/50 hover:border-[var(--color-pastel-purple)]/30">
      <div className="text-sm font-semibold text-foreground/90">{title}</div>
      <p className="mx-auto mt-2 max-w-[360px] text-xs leading-relaxed text-muted-foreground">{copy}</p>
    </div>
  )
}

export function ProfileViewer({ agent, refreshToken = 0, preferredModel }: ProfileViewerProps) {
  const selectedProvider = useLLMPreferenceStore((state) => state.provider)
  const activeModel = useMemo(() => preferredModel || getClientModelForProvider(selectedProvider), [preferredModel, selectedProvider])

  const [mode, setMode] = useState<'evolution' | 'analysis' | 'communication'>('analysis')
  const [profileTab, setProfileTab] = useState<'bigfive' | 'mbti' | 'enneagram' | 'insights'>('bigfive')
  const [bootstrap, setBootstrap] = useState<ProfileBootstrapPayload | null>(null)
  const [evolution, setEvolution] = useState<EvolutionResponse | null>(null)
  const [detail, setDetail] = useState<ProfileRunDetail | null>(null)
  const [activeRunId, setActiveRunId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadBootstrap = useCallback(async (showRefreshState = false) => {
    try {
      setError(null)
      if (showRefreshState) setRefreshing(true)
      else setLoading(true)

      const [profilePayload, evolutionPayload] = await Promise.all([
        parseResponse<ProfileBootstrapPayload>(await fetch(`/api/agents/${agent.id}/profile`, { cache: 'no-store' })),
        parseResponse<EvolutionResponse>(await fetch(`/api/agents/${agent.id}/profile/evolution`, { cache: 'no-store' })),
      ])

      setBootstrap(profilePayload)
      setEvolution(evolutionPayload)
      setActiveRunId((current) => current || profilePayload.recentRuns[0]?.id || null)
    } catch (nextError) {
      console.error('Failed to load profile workspace:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to load profile workspace')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [agent.id])

  const loadRunDetail = useCallback(async (runId: string) => {
    try {
      const payload = await parseResponse<ProfileRunDetail>(await fetch(`/api/agents/${agent.id}/profile/runs/${runId}`, { cache: 'no-store' }))
      setDetail(payload)
      return payload
    } catch (nextError) {
      console.error('Failed to load profile run detail:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to load analysis run detail')
      return null
    }
  }, [agent.id])

  useEffect(() => {
    void loadBootstrap()
  }, [loadBootstrap, refreshToken])

  useEffect(() => {
    if (!activeRunId) {
      setDetail(null)
      return
    }
    void loadRunDetail(activeRunId)
  }, [activeRunId, loadRunDetail])

  useEffect(() => {
    if (!activeRunId || !detail?.run || (detail.run.status !== 'draft' && detail.run.status !== 'running')) {
      return
    }

    const intervalId = window.setInterval(() => {
      void loadRunDetail(activeRunId).then((nextDetail) => {
        if (nextDetail?.run?.status === 'ready' || nextDetail?.run?.status === 'failed') {
          setRunning(false)
          void loadBootstrap(true)
        }
      })
    }, 1500)

    return () => window.clearInterval(intervalId)
  }, [activeRunId, detail?.run, loadBootstrap, loadRunDetail])

  const selectedProfile = detail?.run?.latestProfile || bootstrap?.profile || null
  const selectedCommunication = bootstrap?.communicationFingerprint || null
  const handleStartAnalysis = async () => {
    try {
      setError(null)
      setRunning(true)
      setMode('analysis')

      const runPayload = await parseResponse<{ run: ProfileAnalysisRun }>(await fetch(`/api/agents/${agent.id}/profile/runs`, {
        method: 'POST',
      }))
      setActiveRunId(runPayload.run.id)
      setDetail({ run: runPayload.run, interviewTurns: [], pipelineEvents: [] })
      await loadBootstrap(true)

      void fetch(`/api/agents/${agent.id}/profile/runs/${runPayload.run.id}/execute`, {
        method: 'POST',
        headers: buildLLMPreferenceHeaders(selectedProvider, activeModel),
      })
        .then(async (response) => {
          if (!response.ok) {
            const payload = await response.json().catch(() => ({}))
            throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to execute profile analysis run')
          }
          await loadRunDetail(runPayload.run.id)
          await loadBootstrap(true)
        })
        .catch((nextError) => {
          console.error('Failed to execute profile analysis run:', nextError)
          setError(nextError instanceof Error ? nextError.message : 'Failed to execute profile analysis run')
        })
        .finally(() => {
          setRunning(false)
        })
    } catch (nextError) {
      setRunning(false)
      setError(nextError instanceof Error ? nextError.message : 'Failed to start profile analysis run')
    }
  }

  if (loading && !bootstrap) {
    return (
      <div className="flex min-h-[420px] items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {/* Outer spinning dash ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border border-dashed border-violet-500/30"
            />
            {/* Inner pulsing ring */}
            <motion.div
              animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-2 rounded-full border border-violet-500/20 bg-violet-500/5 shadow-[0_0_15px_rgba(139,92,246,0.15)]"
            />
            {/* Center Icon */}
            <Brain className="relative h-8 w-8 text-violet-500" />
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-violet-500">Loading Profile Workspace</div>
            <div className="text-xs text-muted-foreground/80">Synchronizing neural pathways...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-4 px-1 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[var(--color-pastel-purple)]/10 ring-1 ring-[var(--color-pastel-purple)]/25 shadow-lg shadow-[var(--color-pastel-purple)]/10">
            <Brain className="h-6 w-6 text-[var(--color-pastel-purple)]" />
          </div>
          <div>
            <h3 className="text-xl font-bold leading-tight tracking-tight text-foreground">
              {agent.name}&apos;s Profile Intelligence
            </h3>
            <p className="mt-0.5 text-[11px] font-medium uppercase tracking-widest text-muted-foreground/80">
              Live evolution, manual deep analysis, and observed communication telemetry
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="rounded-sm border border-zinc-800/80 bg-zinc-900/60 px-4 py-2.5 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
            {LLM_PROVIDER_LABELS[selectedProvider]} · {activeModel}
          </div>
          <Button variant="outline" size="sm" className="h-10 gap-2 rounded-sm border-zinc-700/60 hover:bg-zinc-800/60 transition-colors" onClick={() => void loadBootstrap(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            Refresh
          </Button>
          <Button onClick={() => void handleStartAnalysis()} disabled={running} className="h-10 gap-2 rounded-sm bg-[var(--color-pastel-purple)] text-zinc-950 hover:bg-[var(--color-pastel-purple)]/90 font-bold shadow-md shadow-[var(--color-pastel-purple)]/20">
            {running ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
            {detail?.run?.status === 'running' ? 'Running analysis' : 'New analysis run'}
          </Button>
        </div>
      </div>

      {error && (
        <div className="flex items-start gap-3 rounded-md border border-red-500/30 bg-red-500/5 px-4 py-3 text-[13px] text-red-500">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          <span>{error}</span>
        </div>
      )}

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-6">
        <MetricTile label="Interactions" value={bootstrap?.metrics.totalInteractions || 0} hint="Live trait input" />
        <MetricTile label="Trait Update" value={formatDateTime(bootstrap?.lastTraitUpdateAt)} hint="Latest evolution event" />
        <MetricTile label="Freshness" value={bootstrap?.stale ? 'Stale' : 'Current'} hint="Deep profile state" />
        <MetricTile label="Last Run" value={formatDateTime(bootstrap?.metrics.latestCompletedRunAt)} hint="Completed analysis" />
        <MetricTile label="Run History" value={bootstrap?.metrics.runCount || 0} hint="Stored sessions" />
        <MetricTile label="Voice Window" value={bootstrap?.metrics.communicationSampleWindow || 0} hint={`${selectedCommunication?.observedMessageCount || 0} replies observed`} />
      </div>

      <div className="grid gap-4 xl:grid-cols-[320px_1fr_360px] xl:h-[calc(100vh-220px)] xl:min-h-[720px]">
        <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <section className={`${premiumPanel} flex flex-col overflow-hidden`}>
            <div className="flex items-center justify-between border-b border-zinc-800/60 bg-zinc-900/60 px-5 py-3.5 backdrop-blur-sm">
              <div className="flex items-center gap-3">
                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[var(--color-pastel-yellow)]/10 ring-1 ring-[var(--color-pastel-yellow)]/20 shadow-inner">
                  <Sparkles className="h-4 w-4 text-[var(--color-pastel-yellow)]" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">Analysis Control</span>
              </div>
              {bootstrap?.stale && (
                <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-1 text-[10px] font-bold uppercase tracking-[0.15em] text-amber-300">
                  Stale
                </span>
              )}
            </div>
            <div className="space-y-4 p-4">
              <div className="rounded-md border border-border/30 bg-muted/10 p-3">
                <div className={labelStyle}>What this page is for</div>
                <p className="mt-2 text-sm leading-6 text-muted-foreground">
                  The left side controls slower, inspectable profile analysis. The center shows live evolution, the latest deep profile, or observed voice behavior. The right side exposes the evidence and trace.
                </p>
              </div>

              <div className="space-y-2">
                <div className={labelStyle}>Run status</div>
                <div className={`${subPanel} p-3`}>
                  <div className="flex items-center gap-2 text-sm font-semibold text-foreground">
                    {detail?.run?.status === 'ready' ? <CheckCircle2 className="h-4 w-4 text-emerald-500" /> : <Clock3 className="h-4 w-4 text-muted-foreground" />}
                    {detail?.run ? detail.run.status : 'No run selected'}
                  </div>
                  <div className="mt-2 text-xs leading-6 text-muted-foreground">
                    {detail?.run
                      ? `Latest stage: ${detail.run.latestStage.replaceAll('_', ' ')}. Transcript turns: ${detail.run.transcriptCount}.`
                      : 'Start a run to interview the agent, synthesize the profile, and record the trace.'}
                  </div>
                </div>
              </div>

              <div className="space-y-2">
                <div className={labelStyle}>Interview stages</div>
                <div className="space-y-1.5">
                  {[
                    ['evidence', 'Evidence packet'],
                    ['social_style', 'Social style'],
                    ['decision_style', 'Decision style'],
                    ['stress_conflict', 'Stress and conflict'],
                    ['motivation_identity', 'Motivation and identity'],
                    ['communication_self_awareness', 'Communication self-awareness'],
                    ['synthesis', 'Synthesis'],
                    ['evaluation', 'Evaluation'],
                    ['repair', 'Repair'],
                    ['completed', 'Completed'],
                  ].map(([stage, label]) => {
                    const active = detail?.run?.latestStage === stage
                    const completed = (detail?.pipelineEvents || []).some((event) => event.stage === stage && event.status === 'completed')
                    return (
                      <div
                        key={stage}
                        className={`flex items-center justify-between rounded-sm border px-3 py-2 text-[12px] ${
                          active
                            ? 'border-violet-500/40 bg-violet-500/10 text-foreground'
                            : 'border-border/30 bg-muted/5 text-muted-foreground'
                        }`}
                      >
                        <span>{label}</span>
                        <span className="text-[10px] font-bold uppercase tracking-wider">{completed ? 'done' : active ? 'live' : 'queued'}</span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </section>

          <section className={`${premiumPanel} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <div className="border-b border-zinc-800/60 bg-zinc-900/60 px-5 py-3.5 backdrop-blur-sm">
              <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">Recent Runs</span>
            </div>
            <div className="flex-1 space-y-1.5 overflow-y-auto p-2 scrollbar-thin">
              {(bootstrap?.recentRuns || []).length === 0 ? (
                <div className="p-3 text-xs leading-6 text-muted-foreground">No deep analysis runs yet. The trait panel can still update live without one.</div>
              ) : (
                (bootstrap?.recentRuns || []).map((run) => {
                  const active = run.id === activeRunId
                  return (
                    <button
                      key={run.id}
                      onClick={() => setActiveRunId(run.id)}
                      className={`w-full rounded-sm border p-3 text-left transition-all ${
                        active ? 'border-blue-500/40 bg-blue-500/5' : 'border-border/30 bg-muted/5 hover:border-blue-500/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-foreground">{formatDateTime(run.updatedAt)}</span>
                        <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">{run.status}</span>
                      </div>
                      <div className="mt-1 text-[10px] font-medium uppercase tracking-wider text-muted-foreground">
                        {run.provider || 'provider pending'} · {run.model || 'model pending'}
                      </div>
                      <div className="mt-2 text-xs leading-5 text-muted-foreground">
                        Stage {run.latestStage.replaceAll('_', ' ')} · {run.transcriptCount} interview turns · {run.sourceCount} signals
                      </div>
                    </button>
                  )
                })
              )}
            </div>
          </section>
        </aside>

        <main className="flex min-h-0 flex-col gap-4 overflow-hidden">
          <section className={`${premiumPanel} flex min-h-0 flex-1 flex-col overflow-hidden`}>
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-zinc-800/60 bg-zinc-900/60 px-5 py-3.5 backdrop-blur-sm">
              <div className="flex items-center gap-1.5 rounded-sm bg-zinc-950/50 p-1 ring-1 ring-zinc-800/50 shadow-inner">
                <button onClick={() => setMode('evolution')} className={mode === 'evolution' ? 'rounded-md bg-zinc-800/80 px-4 py-1.5 text-[12px] font-bold text-foreground shadow-sm ring-1 ring-zinc-700/50' : 'rounded-md px-4 py-1.5 text-[12px] font-bold text-muted-foreground hover:text-foreground/80 transition-colors'}>
                  Evolution
                </button>
                <button onClick={() => setMode('analysis')} className={mode === 'analysis' ? 'rounded-md bg-zinc-800/80 px-4 py-1.5 text-[12px] font-bold text-foreground shadow-sm ring-1 ring-zinc-700/50' : 'rounded-md px-4 py-1.5 text-[12px] font-bold text-muted-foreground hover:text-foreground/80 transition-colors'}>
                  Derived Analysis
                </button>
                <button onClick={() => setMode('communication')} className={mode === 'communication' ? 'rounded-md bg-zinc-800/80 px-4 py-1.5 text-[12px] font-bold text-foreground shadow-sm ring-1 ring-zinc-700/50' : 'rounded-md px-4 py-1.5 text-[12px] font-bold text-muted-foreground hover:text-foreground/80 transition-colors'}>
                  Communication
                </button>
              </div>
              <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                {mode === 'evolution' ? 'Auto-updating layer' : mode === 'analysis' ? 'Manual deep profile layer' : 'Observed voice telemetry'}
              </div>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-4 scrollbar-thin">
              {mode === 'evolution' && (
                <div className="space-y-6">
                  <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
                    <div className={`${panelClass} space-y-6`}>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Core Traits (Immutable)</div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          {Object.entries(agent.coreTraits || {}).map(([trait, score]) => (
                            <TraitBar key={trait} label={trait} score={score as number} colorClass="bg-primary" />
                          ))}
                        </div>
                      </div>
                      <div>
                        <div className="text-sm font-medium text-muted-foreground">Dynamic Traits (Evolving)</div>
                        <div className="mt-4 grid gap-4 md:grid-cols-2">
                          {Object.entries(agent.dynamicTraits || {}).map(([trait, score]) => (
                            <TraitBar key={trait} label={trait} score={score as number} colorClass="bg-accent" />
                          ))}
                        </div>
                      </div>
                    </div>

                    <div className={`${panelClass} space-y-4`}>
                      <div className="flex items-center gap-4 border-b border-zinc-800/50 pb-4">
                        <div className="flex h-10 w-10 items-center justify-center rounded-sm bg-[var(--color-pastel-green)]/10 ring-1 ring-[var(--color-pastel-green)]/20 shadow-inner">
                          <TrendingUp className="h-5 w-5 text-[var(--color-pastel-green)]" />
                        </div>
                        <div>
                          <div className="font-semibold text-foreground">Recent evolution events</div>
                          <div className="text-xs text-muted-foreground mt-0.5">Trait movement stays explainable and tied to observed behavior.</div>
                        </div>
                      </div>
                      {!evolution || evolution.events.length === 0 ? (
                        <EmptyState title="No evolution events yet" copy="Use the agent in live conversations. Meaningful behavior signals will show up here before the deeper profile is refreshed." />
                      ) : (
                        <div className="space-y-3">
                          {evolution.events.map((event) => (
                            <EvolutionEventCard key={event.id} event={event} />
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {mode === 'analysis' && (
                <div className="space-y-6">
                  {!selectedProfile ? (
                    <EmptyState title="No profile generated yet" copy="Start a new analysis run. The system will compile evidence, interview the agent in stages, and synthesize a stored profile with trace and quality checks." />
                  ) : (
                    <>
                      <div className="grid gap-3 xl:grid-cols-[0.78fr_1.22fr]">
                        <div className={`${compactPanelClass} flex items-center gap-3`}>
                          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-violet-500/10 text-xl font-black text-violet-500">
                            {selectedProfile.mbti.type}
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Latest profile summary</div>
                            <div className="mt-1 text-lg font-semibold text-foreground">{selectedProfile.mbti.type}</div>
                            <div className="mt-1 text-xs text-muted-foreground">
                              {MBTI_DESCRIPTIONS[selectedProfile.mbti.type] || 'Distinct psychological profile'}
                            </div>
                            <div className="mt-2 text-[11px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
                              {selectedProfile.source === 'analysis_run' ? 'Interview-backed analysis run' : 'Deterministic scaffold'}
                            </div>
                          </div>
                        </div>

                        <div className={compactPanelClass}>
                          <p className="text-sm leading-6 text-muted-foreground">{selectedProfile.summary}</p>
                          <div className="mt-3 flex flex-wrap gap-2 text-[11px]">
                            <span className="rounded-full border border-border/40 px-3 py-1 text-muted-foreground">
                              confidence {(selectedProfile.confidence ? selectedProfile.confidence * 100 : 0).toFixed(0)}%
                            </span>
                            <span className="rounded-full border border-border/40 px-3 py-1 text-muted-foreground">
                              updated {formatDateTime(selectedProfile.updatedAt)}
                            </span>
                            <span className="rounded-full border border-border/40 px-3 py-1 text-muted-foreground">
                              {selectedProfile.provider || 'provider unknown'} · {selectedProfile.model || 'model unknown'}
                            </span>
                          </div>
                        </div>
                      </div>

                      <div className="flex flex-wrap gap-1.5 rounded-sm bg-zinc-950/50 p-1 ring-1 ring-zinc-800/50 w-fit">
                        {(['bigfive', 'mbti', 'enneagram', 'insights'] as const).map((tab) => {
                          const active = profileTab === tab
                          return (
                            <button
                              key={tab}
                              onClick={() => setProfileTab(tab)}
                              className={active ? 'rounded-md bg-zinc-800/80 px-4 py-1.5 text-[12px] font-bold text-[#cba6f7] shadow-sm ring-1 ring-zinc-700/50' : 'rounded-md px-4 py-1.5 text-[12px] font-bold text-muted-foreground hover:text-foreground/80 transition-colors'}
                            >
                              {tab === 'bigfive' ? 'Big Five' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                            </button>
                          )
                        })}
                      </div>

                      {profileTab === 'bigfive' && <BigFiveView profile={selectedProfile.bigFive} />}
                      {profileTab === 'mbti' && <MBTIView profile={selectedProfile.mbti} />}
                      {profileTab === 'enneagram' && <EnneagramView profile={selectedProfile.enneagram} />}
                      {profileTab === 'insights' && <InsightsView profile={selectedProfile} />}
                    </>
                  )}
                </div>
              )}

              {mode === 'communication' && (
                <div className="space-y-6">
                  {!selectedCommunication ? (
                    <EmptyState title="Communication telemetry unavailable" copy="The communication fingerprint appears after the workspace can inspect recent agent replies." />
                  ) : (
                    <>
                      <div className={`${panelClass} grid gap-5 lg:grid-cols-[0.95fr_1.05fr]`}>
                        <div className="flex items-center gap-4">
                          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-[var(--color-pastel-blue)]/10 ring-1 ring-[var(--color-pastel-blue)]/20 shadow-inner">
                            <Languages className="h-6 w-6 text-[var(--color-pastel-blue)]" />
                          </div>
                          <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-[#cba6f7]">Observed communication fingerprint</div>
                            <div className="mt-1.5 text-2xl font-semibold text-foreground">
                              {selectedCommunication.enoughData ? 'Live voice telemetry' : 'Early communication sample'}
                            </div>
                            <div className="mt-1 text-sm text-muted-foreground">
                              {selectedCommunication.observedMessageCount} replies sampled from the latest {selectedCommunication.sampleWindowSize} message window.
                            </div>
                          </div>
                        </div>
                        <p className="text-sm leading-7 text-muted-foreground">{selectedCommunication.summary}</p>
                      </div>

                      {!selectedCommunication.enoughData && (
                        <div className="rounded-md border border-dashed border-border/30 bg-muted/5 px-4 py-3 text-sm text-muted-foreground">
                          Fewer than 12 recent agent replies are available, so the communication readout is still provisional.
                        </div>
                      )}

                      <CommunicationView snapshot={selectedCommunication} />
                    </>
                  )}
                </div>
              )}
            </div>
          </section>
        </main>

        <aside className="flex min-h-0 flex-col gap-4 overflow-hidden">
          {mode === 'analysis' && (
            <>
              <section className={`${premiumPanel} flex min-h-0 flex-1 flex-col overflow-hidden`}>
                <div className="flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-900/60 px-5 py-3.5 backdrop-blur-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[var(--color-pastel-blue)]/10 ring-1 ring-[var(--color-pastel-blue)]/20 shadow-inner">
                    <MessageSquareQuote className="h-4 w-4 text-[var(--color-pastel-blue)]" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">Interview Transcript</span>
                </div>
                <div className="flex-1 space-y-3 overflow-y-auto p-4 scrollbar-thin">
                  {(detail?.interviewTurns || []).length === 0 ? (
                    <EmptyState title="No transcript yet" copy="When an analysis run starts, each interview turn will appear here as it is written to storage." />
                  ) : (
                    (detail?.interviewTurns || []).map((turn) => (
                      <div key={turn.id} className="rounded-sm border border-border/30 bg-muted/5 p-3">
                        <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{turn.stage.replaceAll('_', ' ')}</div>
                        <div className="mt-2 text-sm font-medium text-foreground">{turn.question}</div>
                        <div className="mt-2 text-sm leading-6 text-muted-foreground">{turn.answer}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className={`${premiumPanel} max-h-[240px] overflow-hidden`}>
                <div className="flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-900/60 px-5 py-3.5 backdrop-blur-sm">
                  <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[var(--color-pastel-pink)]/10 ring-1 ring-[var(--color-pastel-pink)]/20 shadow-inner">
                    <Waves className="h-4 w-4 text-[var(--color-pastel-pink)]" />
                  </div>
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">Pipeline Trace</span>
                </div>
                <div className="space-y-2 overflow-y-auto p-4 scrollbar-thin">
                  {(detail?.pipelineEvents || []).length === 0 ? (
                    <div className="text-xs leading-6 text-muted-foreground">Evidence, synthesis, evaluation, and repair events will appear here.</div>
                  ) : (
                    (detail?.pipelineEvents || []).map((event) => (
                      <div key={event.id} className="rounded-sm border border-border/30 bg-muted/5 p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{event.stage.replaceAll('_', ' ')}</div>
                          <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{event.status}</div>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-muted-foreground">{event.summary}</div>
                      </div>
                    ))
                  )}
                </div>
              </section>
            </>
          )}

          {mode === 'evolution' && (
            <section className={`${premiumPanel} flex min-h-0 flex-1 flex-col overflow-hidden`}>
              <div className="flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-900/60 px-5 py-3.5 backdrop-blur-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[var(--color-pastel-green)]/10 ring-1 ring-[var(--color-pastel-green)]/20 shadow-inner">
                  <TrendingUp className="h-4 w-4 text-[var(--color-pastel-green)]" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">Why this matters</span>
              </div>
              <div className="space-y-4 p-4 text-sm leading-7 text-muted-foreground">
                <p>This layer is meant to move slowly. Real evidence can be recorded even when rounded trait percentages do not visibly jump.</p>
                <p>Use this panel to understand whether the agent is becoming more confident, empathetic, adaptive, or knowledgeable through actual usage.</p>
                <div className={`${subPanel} p-3`}>
                  <div className={labelStyle}>Current status</div>
                  <div className="mt-2 text-xs leading-6">
                    {bootstrap?.stale
                      ? 'Live trait state is newer than the latest deep profile. A new analysis run is justified.'
                      : 'The latest deep profile is in sync with the most recent trait evolution.'}
                  </div>
                </div>
              </div>
            </section>
          )}

          {mode === 'communication' && (
            <section className={`${premiumPanel} flex min-h-0 flex-1 flex-col overflow-hidden`}>
              <div className="flex items-center gap-3 border-b border-zinc-800/60 bg-zinc-900/60 px-5 py-3.5 backdrop-blur-sm">
                <div className="flex h-8 w-8 items-center justify-center rounded-sm bg-[var(--color-pastel-blue)]/10 ring-1 ring-[var(--color-pastel-blue)]/20 shadow-inner">
                  <Languages className="h-4 w-4 text-[var(--color-pastel-blue)]" />
                </div>
                <span className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">Observed Evidence</span>
              </div>
              <div className="flex-1 space-y-4 overflow-y-auto p-4 scrollbar-thin">
                {!selectedCommunication ? (
                  <div className="text-xs leading-6 text-muted-foreground">No communication evidence available yet.</div>
                ) : (
                  <>
                    <div>
                      <div className={labelStyle}>Recurring vocabulary</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {selectedCommunication.recurringVocabulary.slice(0, 12).map((word) => (
                          <span key={word} className="rounded-full border border-border/30 px-3 py-1 text-xs text-muted-foreground">{word}</span>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className={labelStyle}>Signature phrases</div>
                      <div className="mt-2 space-y-2">
                        {selectedCommunication.signaturePhrases.slice(0, 6).map((phrase) => (
                          <div key={phrase} className="rounded-sm border border-border/30 bg-muted/5 p-3 text-xs leading-6 text-muted-foreground">
                            {phrase}
                          </div>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className={labelStyle}>Recent excerpts</div>
                      <div className="mt-2 space-y-2">
                        {selectedCommunication.excerpts.map((excerpt) => (
                          <div key={excerpt.id} className="rounded-sm border border-border/30 bg-muted/5 p-3">
                            <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">{formatDateTime(excerpt.timestamp)}</div>
                            <div className="mt-2 text-xs leading-6 text-muted-foreground">{excerpt.content}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}

function TraitBar({
  label,
  score,
  colorClass,
}: {
  label: string
  score: number
  colorClass: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium capitalize text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{Math.round(score * 100)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted/30">
        <div className={`h-2 rounded-full transition-all duration-500 ${colorClass}`} style={{ width: `${score * 100}%` }} />
      </div>
    </div>
  )
}

function EvolutionEventCard({ event }: { event: PersonalityEventRecord }) {
  const visibleDeltas = getVisibleTraitDeltas(event)
  const evidenceSummary = getEventEvidenceSummary(event)

  return (
    <div className="rounded-sm border border-zinc-800/60 bg-zinc-950/40 p-4 transition-colors hover:bg-zinc-900/60 shadow-sm">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">{event.summary}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {event.source} • {formatDateTime(event.createdAt)}
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {event.linkedMessageIds.length} linked messages
        </span>
      </div>

      {(visibleDeltas.length > 0 || evidenceSummary.length > 0) && (
        <div className="mt-3 space-y-3">
          {visibleDeltas.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {visibleDeltas.map((delta) => (
                <span key={`${event.id}_${delta.trait}`} className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                  {formatTraitLabel(delta.trait)}
                  {formatDeltaPercent(delta.delta) ? ` ${formatDeltaPercent(delta.delta)}` : ''}
                </span>
              ))}
            </div>
          )}
          {evidenceSummary.length > 0 && (
            <div className="rounded-sm border border-border/30 bg-muted/5 px-3 py-2.5">
              <div className="text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Observed evidence</div>
              <div className="mt-2 flex flex-wrap gap-2">
                {evidenceSummary.map((item) => (
                  <span key={`${event.id}_${item}`} className="rounded-full border border-border/30 px-2.5 py-1 text-[11px] text-muted-foreground">
                    {item}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BigFiveView({ profile }: { profile: BigFiveProfile }) {
  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      {(Object.entries(BIG_FIVE_LABELS) as [keyof BigFiveProfile, typeof BIG_FIVE_LABELS[keyof BigFiveProfile]][]).map(([key, config], idx) => {
        const val = profile[key]
        const percentage = val * 100
        return (
          <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: idx * 0.05 }} key={String(key)} className={compactPanelClass}>
            <div className="flex justify-between items-center mb-4">
              <div className="text-[11px] font-bold uppercase tracking-widest text-[#cba6f7]">{config.label}</div>
              <span className="text-[11px] font-semibold text-muted-foreground">{percentage.toFixed(0)}%</span>
            </div>
            <div className="relative h-1.5 w-full rounded-sm bg-zinc-800/40">
              <div className="absolute top-0 bottom-0 left-0 rounded-sm transition-all duration-700" style={{ width: `${percentage}%`, backgroundColor: config.color, opacity: 0.3 }} />
              <div className="absolute top-1/2 h-3.5 w-1.5 -translate-y-1/2 rounded-sm shadow-md shadow-black/50" style={{ left: `${percentage}%`, backgroundColor: config.color }} />
            </div>
            <div className="mt-4 flex justify-between text-[10px] font-medium uppercase tracking-wider text-muted-foreground/50">
              <span className={val < 0.5 ? 'text-foreground' : ''}>{config.low}</span>
              <span className={val >= 0.5 ? 'text-foreground' : ''}>{config.high}</span>
            </div>
          </motion.div>
        )
      })}
    </motion.div>
  )
}

function MBTIView({ profile }: { profile: MBTIProfile }) {
  const dimensions = [
    { key: 'extraversion_introversion', left: 'I', right: 'E', leftLabel: 'Introverted', rightLabel: 'Extraverted', color: 'var(--color-pastel-blue)' },
    { key: 'sensing_intuition', left: 'S', right: 'N', leftLabel: 'Sensing', rightLabel: 'Intuitive', color: 'var(--color-pastel-green)' },
    { key: 'thinking_feeling', left: 'T', right: 'F', leftLabel: 'Thinking', rightLabel: 'Feeling', color: 'var(--color-pastel-yellow)' },
    { key: 'judging_perceiving', left: 'J', right: 'P', leftLabel: 'Judging', rightLabel: 'Perceiving', color: 'var(--color-pastel-purple)' },
  ] as const

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-3">
      <div className={`${compactPanelClass} flex flex-col md:flex-row items-start md:items-center gap-5`}>
        <div className="flex px-4 py-3 rounded-sm bg-zinc-950/40 border border-zinc-800/50 shadow-inner">
          {profile.type.split('').map((letter, index) => (
            <span key={index} className="text-3xl font-bold tracking-widest mx-0.5" style={{ color: dimensions[index].color }}>
              {letter}
            </span>
          ))}
        </div>
        <div className="flex-1">
          <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#cba6f7]">Identity Synthesis</div>
          <p className="mt-2 text-sm leading-6 text-foreground/80">{MBTI_DESCRIPTIONS[profile.type]}</p>
        </div>
      </div>
      <div className="grid gap-3">
        {dimensions.map(({ key, left, right, leftLabel, rightLabel, color }, idx) => {
          const value = profile.dimensions[key as keyof typeof profile.dimensions]
          const percentage = ((value + 1) / 2) * 100
          
          return (
            <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} transition={{ delay: idx * 0.05 }} key={String(key)} className={compactPanelClass}>
              <div className="flex items-center justify-between gap-4 text-[10px] font-bold uppercase tracking-widest mb-3">
                <span className={value < 0 ? 'text-foreground' : 'text-muted-foreground/40'}>{leftLabel} ({left})</span>
                <span className={value >= 0 ? 'text-foreground' : 'text-muted-foreground/40'}>({right}) {rightLabel}</span>
              </div>
              <div className="relative h-1 w-full rounded-sm bg-zinc-800/60">
                <div className="absolute top-1/2 h-3.5 w-1.5 -translate-y-1/2 rounded-sm shadow-md shadow-black/80" style={{ left: `${percentage}%`, backgroundColor: color }} />
                <div className="absolute top-1/2 h-0.5 -translate-y-1/2 transition-all opacity-40" style={{ left: value < 0 ? `${percentage}%` : '50%', right: value >= 0 ? `${100 - percentage}%` : '50%', backgroundColor: color }} />
                <div className="absolute top-1/2 left-1/2 h-2 w-0.5 -translate-y-1/2 -translate-x-1/2 bg-zinc-600" />
              </div>
            </motion.div>
          )
        })}
      </div>
    </motion.div>
  )
}

function EnneagramView({ profile }: { profile: EnneagramProfile }) {
  const primaryType = ENNEAGRAM_TYPES[profile.primaryType]
  const wingType = ENNEAGRAM_TYPES[profile.wing]

  return (
    <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="grid gap-3 lg:grid-cols-[220px_1fr]">
      <div className={`${compactPanelClass} flex flex-col items-center justify-center p-6 text-center`}>
        <div className="relative flex h-24 w-24 items-center justify-center rounded-sm bg-[var(--color-pastel-purple)]/10 ring-1 ring-[var(--color-pastel-purple)]/30 shadow-inner">
          <span className="text-5xl font-black tracking-tighter text-[var(--color-pastel-purple)]">{profile.primaryType}</span>
          <div className="absolute -bottom-2 -right-2 flex h-8 w-8 items-center justify-center rounded-sm bg-zinc-950 border border-zinc-700/50 shadow-md">
            <span className="text-xs font-bold text-muted-foreground">w{profile.wing}</span>
          </div>
        </div>
        <div className="mt-5 text-[15px] font-bold text-foreground capitalize tracking-wide">{primaryType?.name}</div>
        <div className="mt-1.5 text-[10px] uppercase tracking-widest text-[#cba6f7]">Dominant Paradigm</div>
      </div>
      
      <div className="grid gap-3 content-start">
        <div className={`${compactPanelClass} flex flex-col sm:flex-row gap-5`}>
          <div className="flex-1">
             <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Core Drive</div>
             <p className="text-xs leading-relaxed text-foreground/80">{primaryType?.description}</p>
          </div>
          <div className="w-[1px] bg-zinc-800/50 hidden sm:block" />
          <div className="flex-1">
             <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-3">Wing Influence ({wingType?.name})</div>
             <p className="text-xs leading-relaxed text-foreground/80">{wingType?.description}</p>
          </div>
        </div>

        <div className={`${compactPanelClass} grid sm:grid-cols-2 gap-5 items-center`}>
          <div>
            <div className="text-[10px] font-bold uppercase tracking-widest text-[#cba6f7] mb-3">Instinctual Stack</div>
            <div className="inline-flex rounded-sm bg-zinc-950/40 border border-zinc-800/50 px-3 py-1.5 text-xs font-bold uppercase tracking-[0.2em] text-foreground shadow-sm">
              {profile.instinctualVariant.replace('-', ' ')}
            </div>
          </div>
          <div>
             <div className="text-[10px] font-bold uppercase tracking-[0.2em] text-[#cba6f7] mb-3">Tritype</div>
             <div className="flex gap-2">
              {profile.tritype.map((type, i) => (
                <div key={type} className={`flex h-10 w-10 items-center justify-center rounded-sm border border-zinc-800/50 bg-zinc-950/40 text-sm font-black shadow-inner object-cover ${i === 0 ? 'text-[var(--color-pastel-purple)]' : i === 1 ? 'text-[var(--color-pastel-blue)]' : 'text-muted-foreground'}`}>
                  {type}
                </div>
              ))}
             </div>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function InsightsView({ profile }: { profile: PsychologicalProfile }) {
  return (
    <motion.div initial={{ opacity: 0, scale: 0.98 }} animate={{ opacity: 1, scale: 1 }} className="space-y-3">
      <div className="grid gap-3 lg:grid-cols-2">
        <InsightBlock title="Core Strengths" items={profile.strengths} variant="positive" />
        <InsightBlock title="Growth Areas" items={profile.challenges} variant="warning" />
      </div>

      <div className={compactPanelClass}>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#cba6f7] mb-5">Communication Flow Matrix</div>
        <div className="grid gap-x-8 gap-y-6 md:grid-cols-2">
          {[
            { label: 'Directness', value: profile.communicationStyle.directness, left: 'Indirect / Diplomatic', right: 'Direct / Blunt', color: 'var(--color-pastel-blue)' },
            { label: 'Emotional Expression', value: profile.communicationStyle.emotionalExpression, left: 'Reserved / Logical', right: 'Expressive / Open', color: 'var(--color-pastel-pink)' },
          ].map((item) => (
            <div key={item.label}>
              <div className="flex justify-between items-end mb-3">
                 <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{item.label}</div>
                 <div className="text-[10px] text-foreground font-bold">{(item.value * 100).toFixed(0)}%</div>
              </div>
              <div className="relative h-1.5 w-full rounded-sm bg-zinc-800/50 overflow-hidden shadow-inner">
                <div className="absolute top-0 bottom-0 left-0 rounded-sm transition-all" style={{ width: `${item.value * 100}%`, backgroundColor: item.color }} />
              </div>
              <div className="mt-2.5 flex justify-between text-[9px] uppercase tracking-widest text-muted-foreground/60">
                <span className={item.value < 0.5 ? 'text-foreground/90 font-medium' : ''}>{item.left}</span>
                <span className={item.value >= 0.5 ? 'text-foreground/90 font-medium' : ''}>{item.right}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-6 rounded-sm bg-zinc-950/40 border border-zinc-800/50 p-4 flex justify-between items-center">
           <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">Default Conflict Strategy</span>
           <span className="text-xs font-bold uppercase tracking-widest text-[#cba6f7]">{profile.communicationStyle.conflictStyle}</span>
        </div>
      </div>

      <div className={compactPanelClass}>
        <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-[#cba6f7] mb-5">Psychological Rationales</div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {[
            { key: 'bigFive', label: 'Big Five Synthesis' },
            { key: 'mbti', label: 'MBTI Foundation' },
            { key: 'enneagram', label: 'Enneagram Drive' },
            { key: 'communicationStyle', label: 'Communication' },
            { key: 'stressPattern', label: 'Stress Dynamics' },
            { key: 'motivationAndGrowth', label: 'Growth Levers' },
          ].map((item) => {
            const content = profile.rationales?.[item.key as keyof PsychologicalProfile['rationales']]
            if (!content) return null
            return (
              <div key={item.key} className="relative rounded-sm border border-zinc-800/40 bg-zinc-950/20 p-4 overflow-hidden">
                 <div className="absolute top-0 left-0 w-1 h-full bg-zinc-800/60" />
                 <div className="pl-2">
                   <div className="text-[9px] font-bold uppercase tracking-[0.2em] text-muted-foreground mb-2.5">{item.label}</div>
                   <p className="text-xs leading-relaxed text-foreground/75 relative z-10">{content}</p>
                 </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.div>
  )
}

function InsightBlock({ title, items, variant }: { title: string; items: string[]; variant: 'positive' | 'warning' }) {
  if (items.length === 0) return null
  const Icon = variant === 'positive' ? CheckCircle2 : Target
  const colorClass = variant === 'positive' ? 'text-[var(--color-pastel-green)]' : 'text-[var(--color-pastel-yellow)]'
  
  return (
    <div className={compactPanelClass}>
      <div className={`text-[11px] font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2.5 ${colorClass}`}>
        <div className={`p-1.5 rounded-sm bg-current/10`}>
          <Icon className="h-4 w-4" />
        </div>
        {title}
      </div>
      <ul className="space-y-3.5">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3.5 text-xs leading-5 text-foreground/80">
            <div className={`mt-1.5 h-1.5 w-1.5 shrink-0 rounded-sm ${variant === 'positive' ? 'bg-[var(--color-pastel-green)]/80' : 'bg-[var(--color-pastel-yellow)]/80'}`} />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function CommunicationView({ snapshot }: { snapshot: CommunicationFingerprintSnapshot }) {
  const metrics: Array<{ key: keyof CommunicationFingerprintSnapshot['dimensions']; label: string; color: string }> = [
    { key: 'formality', label: 'Formality', color: '#4FC3F7' },
    { key: 'verbosity', label: 'Verbosity', color: '#7C4DFF' },
    { key: 'humor', label: 'Humor', color: '#FFD54F' },
    { key: 'technicalLevel', label: 'Technical level', color: '#66BB6A' },
    { key: 'expressiveness', label: 'Expressiveness', color: '#FF7043' },
    { key: 'directness', label: 'Directness', color: '#14B8A6' },
    { key: 'questionRate', label: 'Question rate', color: '#E879F9' },
    { key: 'structuralClarity', label: 'Structural clarity', color: '#94A3B8' },
  ]

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {metrics.map((metric) => (
        <div key={String(metric.key)} className={compactPanelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-sm font-medium text-foreground">{metric.label}</div>
              <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-muted-foreground">
                observed now
                {metric.key in snapshot.drift ? ` · drift ${(((snapshot.drift[metric.key as keyof typeof snapshot.drift] || 0) as number) * 100).toFixed(0)} pts` : ''}
              </div>
            </div>
            <span className="text-xs font-semibold text-foreground">{(snapshot.dimensions[metric.key] * 100).toFixed(0)}%</span>
          </div>
          <div className="mt-3 h-2 rounded-full bg-muted/45">
            <div className="h-2 rounded-full" style={{ width: `${snapshot.dimensions[metric.key] * 100}%`, backgroundColor: metric.color }} />
          </div>
        </div>
      ))}

      <div className="grid gap-3 lg:col-span-2 lg:grid-cols-2">
        <div className={compactPanelClass}>
          <div className="font-semibold text-foreground">Punctuation tendencies</div>
          <div className="mt-4 space-y-3 text-sm text-muted-foreground">
            <div className="flex items-center justify-between gap-3"><span>Exclamations</span><span>{(snapshot.punctuation.exclamationRate * 100).toFixed(0)}%</span></div>
            <div className="flex items-center justify-between gap-3"><span>Questions</span><span>{(snapshot.punctuation.questionRate * 100).toFixed(0)}%</span></div>
            <div className="flex items-center justify-between gap-3"><span>Ellipses</span><span>{(snapshot.punctuation.ellipsisRate * 100).toFixed(0)}%</span></div>
            <div className="flex items-center justify-between gap-3"><span>Emoji</span><span>{(snapshot.punctuation.emojiRate * 100).toFixed(0)}%</span></div>
          </div>
        </div>
        <div className={compactPanelClass}>
          <div className="font-semibold text-foreground">Baseline comparison</div>
          <div className="mt-3 text-sm leading-6 text-muted-foreground">
            {snapshot.baselineAvailable
              ? 'Observed communication is compared against the stored linguistic baseline. Positive drift means the recent replies are moving upward on that dimension.'
              : 'No seeded baseline is available yet, so this panel is showing only observed recent behavior.'}
          </div>
        </div>
      </div>
    </div>
  )
}
