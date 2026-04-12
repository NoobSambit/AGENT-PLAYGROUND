'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  MoonStar,
  RefreshCw,
  Save,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buildLLMPreferenceHeaders } from '@/lib/llm/clientPreference'
import { useLLMPreferenceStore } from '@/stores/llmPreferenceStore'
import type {
  Dream,
  DreamBootstrapPayload,
  DreamFocus,
  DreamPipelineStage,
  DreamQualityDimension,
  DreamSessionDetail,
  DreamType,
} from '@/types/database'

interface DreamJournalProps {
  agentId: string
  agentName: string
}

const premiumPanel = 'rounded-md border border-slate-700/40 bg-[linear-gradient(180deg,rgba(15,23,42,0.92),rgba(10,14,25,0.96))] text-slate-100 shadow-[0_24px_90px_rgba(15,23,42,0.45)] backdrop-blur-xl'
const subPanel = 'rounded-sm border border-border/30 bg-muted/20'
const labelStyle = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80'

const TYPE_LABELS: Record<DreamType, string> = {
  symbolic: 'Symbolic',
  nightmare: 'Nightmare',
  memory_replay: 'Memory Replay',
  prophetic: 'Prophetic',
  lucid: 'Lucid',
  recurring: 'Recurring',
}

const FOCUS_LABELS: Record<DreamFocus, string> = {
  memory: 'Memory',
  emotion: 'Emotion',
  future: 'Future',
  relationship: 'Relationship',
  conflict: 'Conflict',
}

const DIMENSION_LABELS: Record<DreamQualityDimension, string> = {
  imageryVividness: 'Imagery',
  symbolicCoherence: 'Symbolism',
  psychologicalGrounding: 'Grounding',
  agentSpecificity: 'Specificity',
  narrativeClarity: 'Clarity',
  interpretiveUsefulness: 'Usefulness',
}

const STAGE_ORDER: DreamPipelineStage[] = [
  'prepare_context',
  'condition_subconscious',
  'draft_dream',
  'extract_symbols',
  'evaluate_quality',
  'repair_dream',
  'derive_impression',
  'ready',
]

const STAGE_LABELS: Record<DreamPipelineStage, string> = {
  prepare_context: 'Prepare Context',
  condition_subconscious: 'Condition Subconscious',
  draft_dream: 'Draft Dream',
  extract_symbols: 'Extract Symbols',
  evaluate_quality: 'Evaluate Quality',
  repair_dream: 'Repair Dream',
  derive_impression: 'Derive Impression',
  ready: 'Ready',
  saved: 'Saved',
  failed: 'Failed',
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text()
  const payload = raw ? JSON.parse(raw) as Record<string, unknown> : {}
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed with status ${response.status}`)
  }
  return payload as T
}

function artifactBadgeTone(score?: number) {
  if (!score) return 'text-slate-400'
  if (score >= 85) return 'text-emerald-300'
  if (score >= 75) return 'text-amber-300'
  return 'text-rose-300'
}

function sessionStatusTone(status?: DreamSessionDetail['session'] extends infer T ? T extends { status: infer S } ? S : never : never) {
  if (status === 'saved') return 'text-pastel-green'
  if (status === 'ready') return 'text-pastel-blue'
  if (status === 'failed') return 'text-pastel-red'
  if (status === 'generating') return 'text-pastel-yellow'
  return 'text-muted-foreground'
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getActiveStage(detail: DreamSessionDetail | null): DreamPipelineStage {
  if (!detail?.session) return 'prepare_context'
  if (detail.session.status === 'failed') return 'failed'
  if (detail.session.status === 'saved') return 'saved'
  const activeEvent = detail.pipelineEvents.find((event) => event.status === 'active')
  return activeEvent?.stage || detail.session.latestStage
}

function shouldShowRepair(detail: DreamSessionDetail | null) {
  return Boolean(detail?.pipelineEvents.some((event) => event.stage === 'repair_dream'))
}

function useStillWorking(generating: boolean) {
  const [stillWorking, setStillWorking] = useState(false)

  useEffect(() => {
    if (!generating) {
      setStillWorking(false)
      return
    }
    const timeout = window.setTimeout(() => setStillWorking(true), 8500)
    return () => window.clearTimeout(timeout)
  }, [generating])

  return stillWorking
}

function StageRail({ detail }: { detail: DreamSessionDetail | null }) {
  const activeStage = getActiveStage(detail)
  const orderedStages = STAGE_ORDER.filter((stage) => stage !== 'repair_dream' || shouldShowRepair(detail))
  const activeIndex = orderedStages.indexOf(activeStage)

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 w-full shrink-0">
      {orderedStages.map((stage, index) => {
        const isComplete = activeStage === 'saved' || (activeStage !== 'failed' && index < activeIndex)
        const isActive = stage === activeStage
        return (
          <div key={stage} className="min-w-[112px] flex-1">
            <div className={`mb-1 text-[9px] uppercase tracking-[0.18em] ${isActive ? 'text-indigo-200 font-bold' : 'text-slate-500'}`}>{stage.replaceAll('_', ' ')}</div>
            <div className="h-1.5 rounded-full bg-slate-800">
              <motion.div
                initial={false}
                animate={{ width: isComplete || isActive ? '100%' : '0%' }}
                transition={{ duration: 0.35 }}
                className={isActive ? 'h-full rounded-full bg-gradient-to-r from-indigo-400 to-slate-100' : isComplete ? 'h-full rounded-full bg-emerald-300' : 'h-full rounded-full bg-slate-700'}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DreamSkeleton({ stageLabel, stillWorking }: { stageLabel: string; stillWorking: boolean }) {
  const utilityCopy = stillWorking
    ? stageLabel === 'repair_dream'
      ? 'Reweaving weak symbolism and scene continuity.'
      : stageLabel === 'derive_impression'
        ? 'Deriving behavioral residue without mutating traits.'
        : 'Conditioning imagery from emotional and memory residue.'
    : `Working: ${STAGE_LABELS[stageLabel as DreamPipelineStage] || stageLabel.replaceAll('_', ' ')}`

  return (
    <div className="relative h-full overflow-hidden rounded-md border border-slate-700/40 bg-[radial-gradient(circle_at_top,rgba(99,102,241,0.18),transparent_45%),linear-gradient(180deg,rgba(15,23,42,0.94),rgba(2,6,23,0.98))] p-8">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_30%_20%,rgba(226,232,240,0.08),transparent_25%),radial-gradient(circle_at_70%_60%,rgba(99,102,241,0.12),transparent_24%)]" />
      <div className="relative flex h-full flex-col justify-center gap-8">
        <div className="space-y-4">
          <div className="h-8 w-2/3 animate-pulse rounded-sm bg-slate-700/60" />
          <div className="h-4 w-1/3 animate-pulse rounded-sm bg-slate-800/70" />
        </div>
        <div className="space-y-4">
          {[0, 1, 2].map((row) => (
            <div key={row} className="rounded-sm border border-slate-700/30 bg-slate-900/40 p-5">
              <div className="mb-3 h-4 w-1/4 animate-pulse rounded-sm bg-slate-700/50" />
              <div className="space-y-2">
                <div className="h-3 w-full animate-pulse rounded-sm bg-slate-800/70" />
                <div className="h-3 w-[92%] animate-pulse rounded-sm bg-slate-800/60" />
                <div className="h-3 w-[66%] animate-pulse rounded-sm bg-slate-800/50" />
              </div>
            </div>
          ))}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-300" />
          <span>{utilityCopy}</span>
        </div>
      </div>
    </div>
  )
}

export function DreamJournal({ agentId, agentName }: DreamJournalProps) {
  const selectedProvider = useLLMPreferenceStore((state) => state.provider)
  const [mode, setMode] = useState<'compose' | 'archive'>('compose')
  const [bootstrap, setBootstrap] = useState<DreamBootstrapPayload | null>(null)
  const [detail, setDetail] = useState<DreamSessionDetail | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null)
  const [type, setType] = useState<DreamType>('symbolic')
  const [userNote, setUserNote] = useState('')
  const [focus, setFocus] = useState<DreamFocus[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const stillWorking = useStillWorking(generating)

  const loadBootstrap = useCallback(async (showRefreshState = false) => {
    try {
      setError(null)
      if (showRefreshState) setRefreshing(true)
      else setLoading(true)

      const payload = await parseResponse<DreamBootstrapPayload>(await fetch(`/api/agents/${agentId}/dream`, { cache: 'no-store' }))
      setBootstrap(payload)
      setType((current) => payload.availableTypes.includes(current) ? current : payload.suggestedType)
      setUserNote((current) => current || payload.defaults.userNote)
      if (!activeSessionId) setActiveSessionId(payload.recentSessions[0]?.id || null)
      if (!selectedArchiveId) setSelectedArchiveId(payload.recentSavedDreams[0]?.id || null)
    } catch (nextError) {
      console.error('Failed to load dream workspace:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to load dream workspace')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeSessionId, agentId, selectedArchiveId])

  const loadSessionDetail = useCallback(async (sessionId: string) => {
    const payload = await parseResponse<DreamSessionDetail>(await fetch(`/api/agents/${agentId}/dream/sessions/${sessionId}`, { cache: 'no-store' }))
    setDetail(payload)
    setActiveSessionId(payload.session?.id || sessionId)
    return payload
  }, [agentId])

  useEffect(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  useEffect(() => {
    if (!activeSessionId) {
      setDetail(null)
      return
    }
    void loadSessionDetail(activeSessionId)
  }, [activeSessionId, loadSessionDetail])

  useEffect(() => {
    if (!generating || !activeSessionId) return
    const interval = window.setInterval(() => {
      void loadSessionDetail(activeSessionId).then((payload) => {
        if (payload.session?.status !== 'generating') {
          setGenerating(false)
          void loadBootstrap(true)
        }
      })
    }, 1350)
    return () => window.clearInterval(interval)
  }, [activeSessionId, generating, loadBootstrap, loadSessionDetail])

  const latestDream = useMemo(() => detail?.dreams[0] || null, [detail?.dreams])
  const archiveDream = useMemo(() => {
    if (!bootstrap?.recentSavedDreams.length) return null
    return bootstrap.recentSavedDreams.find((dream) => dream.id === selectedArchiveId) || bootstrap.recentSavedDreams[0]
  }, [bootstrap?.recentSavedDreams, selectedArchiveId])
  const inspectorDream = mode === 'archive' ? archiveDream : latestDream

  const handleGenerate = useCallback(async (reuseCurrent = false) => {
    try {
      setError(null)
      setSaveStatus(null)
      setGenerating(true)
      setMode('compose')

      const sessionId = reuseCurrent && activeSessionId
        ? activeSessionId
        : (await parseResponse<{ session: { id: string } }>(await fetch(`/api/agents/${agentId}/dream`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type, userNote, focus }),
          }))).session.id

      setActiveSessionId(sessionId)
      const payload = await parseResponse<DreamSessionDetail>(await fetch(`/api/agents/${agentId}/dream/sessions/${sessionId}/generate`, {
        method: 'POST',
        headers: buildLLMPreferenceHeaders(selectedProvider),
      }))

      setDetail(payload)
      if (payload.session?.status !== 'generating') setGenerating(false)
      await loadBootstrap(true)
    } catch (nextError) {
      console.error('Failed to generate dream:', nextError)
      setGenerating(false)
      setError(nextError instanceof Error ? nextError.message : 'Failed to generate dream')
    }
  }, [activeSessionId, agentId, focus, loadBootstrap, selectedProvider, type, userNote])

  const handleSave = useCallback(async () => {
    if (!activeSessionId) return
    try {
      setSaving(true)
      setSaveStatus('Saving dream and activating impression…')
      setError(null)
      const payload = await parseResponse<DreamSessionDetail>(await fetch(`/api/agents/${agentId}/dream/sessions/${activeSessionId}/save`, {
        method: 'POST',
      }))
      setDetail(payload)
      setSaveStatus('Saved. Dream impression is now active.')
      await loadBootstrap(true)
    } catch (nextError) {
      console.error('Failed to save dream:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to save dream')
      setSaveStatus(null)
    } finally {
      setSaving(false)
    }
  }, [activeSessionId, agentId, loadBootstrap])

  const activeStage = getActiveStage(detail)
  const canSave = detail?.session?.status === 'ready' && Boolean(detail.session.latestEvaluation?.pass)

  if (loading) {
    return (
      <div className={`${premiumPanel} p-8`}>
        <div className="flex items-center gap-3 text-slate-300">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Loading dream workspace…</span>
        </div>
      </div>
    )
  }

  return (
    <div className={`${premiumPanel} overflow-hidden`}>
      <div className="border-b border-slate-800/70 px-5 py-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-center gap-4">
            <div className="rounded-md bg-indigo-200/10 p-2.5">
              <MoonStar className="h-5 w-5 text-indigo-200" />
            </div>
            <div>
              <h3 className="text-lg font-bold leading-tight tracking-tight text-foreground">{agentName}&apos;s Dream Journal</h3>
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">Private dreams & archive</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant={mode === 'compose' ? 'default' : 'outline'}
              className={mode === 'compose' ? 'bg-card text-foreground shadow-sm' : 'border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground'}
              onClick={() => setMode('compose')}
            >
              Compose
            </Button>
            <Button
              type="button"
              variant={mode === 'archive' ? 'default' : 'outline'}
              className={mode === 'archive' ? 'bg-card text-foreground shadow-sm' : 'border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground'}
              onClick={() => setMode('archive')}
            >
              Archive
            </Button>
            <Button
              type="button"
              variant="outline"
              className="border-border/40 bg-muted/20 text-muted-foreground hover:text-foreground"
              onClick={() => void loadBootstrap(true)}
              disabled={refreshing}
            >
              {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
            </Button>
          </div>
        </div>
      </div>

      {error && (
        <div className="border-b border-rose-500/20 bg-rose-500/10 px-5 py-3 text-sm text-rose-200">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        </div>
      )}

      <div className="grid gap-0 lg:grid-cols-[320px_minmax(0,1fr)_340px]">
        <div className="border-b border-slate-800/70 p-5 lg:border-b-0 lg:border-r">
          <div className="space-y-5">
            <div className="space-y-2">
              <div className={labelStyle}>Dream Mode</div>
              <div className="grid grid-cols-2 gap-2">
                {bootstrap?.availableTypes.map((entry) => {
                  const active = entry === type
                  return (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => setType(entry)}
                      className={[
                        'rounded-sm border px-3 py-2 text-left transition-all duration-200',
                        active
                          ? 'border-pastel-blue/40 bg-pastel-blue/10 text-pastel-blue shadow-sm'
                          : 'border-border/30 bg-muted/5 text-muted-foreground hover:border-pastel-blue/20 hover:text-foreground',
                      ].join(' ')}
                    >
                      <div className="text-sm font-medium">{TYPE_LABELS[entry]}</div>
                      <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{entry === bootstrap?.suggestedType ? 'Suggested from live state.' : 'Available for explicit generation.'}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-2">
              <div className={labelStyle}>Seed Note</div>
              <Input
                value={userNote}
                onChange={(event) => setUserNote(event.target.value)}
                placeholder="Optional pressure, memory, or unresolved thread"
                className="border-border/30 bg-muted/5 text-foreground placeholder:text-muted-foreground/50"
              />
            </div>

            <div className="space-y-2">
              <div className={labelStyle}>Focus</div>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(FOCUS_LABELS) as DreamFocus[]).map((entry) => {
                  const active = focus.includes(entry)
                  return (
                    <button
                      key={entry}
                      type="button"
                      onClick={() => setFocus((current) => active ? current.filter((value) => value !== entry) : [...current, entry].slice(0, 4))}
                      className={[
                        'rounded-md border px-3 py-1 text-[11px] transition-all',
                        active
                          ? 'border-pastel-blue/40 bg-pastel-blue/10 text-pastel-blue'
                          : 'border-border/30 bg-muted/5 text-muted-foreground hover:border-pastel-blue/20 hover:text-foreground',
                      ].join(' ')}
                    >
                      {FOCUS_LABELS[entry]}
                    </button>
                  )
                })}
              </div>
            </div>

            <div className={`${subPanel} p-4`}>
              <div className={labelStyle}>Suggested Mode</div>
              <div className="mt-2 text-sm font-medium text-foreground">{TYPE_LABELS[bootstrap?.suggestedType || 'symbolic']}</div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">Derived from current state and recent saved context. It never auto-runs generation.</p>
            </div>

            <div className="p-3 rounded-sm border border-border/30 bg-muted/5">
              <div className="flex gap-2">
                <Button
                  type="button"
                  className="h-8 flex-1 gap-2 bg-pastel-blue hover:bg-pastel-blue/90 text-primary-foreground font-bold text-[10px] uppercase tracking-wider"
                  onClick={() => void handleGenerate(false)}
                  disabled={generating}
                >
                  {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoonStar className="h-3.5 w-3.5" />}
                  Generate
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  className="h-8 flex-1 gap-2 font-bold text-[10px] uppercase tracking-wider border-border/40"
                  onClick={() => void handleGenerate(true)}
                  disabled={!activeSessionId || generating}
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Regen
                </Button>
                <Button
                  type="button"
                  variant="secondary"
                  className="h-8 flex-1 gap-2 font-bold text-[10px] uppercase tracking-wider border border-border/40 bg-muted hover:bg-muted"
                  onClick={() => void handleSave()}
                  disabled={!canSave || saving}
                >
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className={`h-3.5 w-3.5 ${canSave ? 'text-pastel-green' : 'text-muted-foreground'}`} />}
                  Save
                </Button>
              </div>
              {saveStatus && <div className="mt-2 text-[11px] text-pastel-green">{saveStatus}</div>}
            </div>

            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <div className={labelStyle}>Recent Sessions</div>
                <div className="text-xs text-slate-500">{bootstrap?.recentSessions.length || 0}</div>
              </div>
              <div className="space-y-2">
                {bootstrap?.recentSessions.length ? bootstrap.recentSessions.map((session) => (
                  <button
                    key={session.id}
                    type="button"
                    onClick={() => {
                      setMode('compose')
                      setActiveSessionId(session.id)
                    }}
                    className={[
                      'w-full rounded-sm border px-3 py-3 text-left transition-all',
                      session.id === activeSessionId
                        ? 'border-pastel-purple/40 bg-pastel-purple/5'
                        : 'border-border/30 bg-muted/5 hover:border-pastel-purple/20',
                    ].join(' ')}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="text-sm font-medium text-foreground">{TYPE_LABELS[session.type]}</div>
                      <div className={`text-[10px] font-bold uppercase tracking-[0.18em] ${sessionStatusTone(session.status)}`}>{session.status}</div>
                    </div>
                    <div className="mt-1 text-[11px] text-muted-foreground">{formatDateTime(session.updatedAt)}</div>
                    {typeof session.latestEvaluation?.overallScore === 'number' && (
                      <div className={`mt-2 text-[11px] font-medium ${artifactBadgeTone(session.latestEvaluation.overallScore)}`}>
                        Quality {session.latestEvaluation.overallScore}
                      </div>
                    )}
                  </button>
                )) : (
                  <div className="rounded-sm border border-dashed border-slate-700/40 px-4 py-6 text-center text-sm text-slate-500">
                    No dream sessions yet.
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-b border-slate-800/70 p-5 lg:border-b-0 lg:border-r">
          {mode === 'archive' ? (
            <div className="grid gap-4 lg:grid-cols-[280px_minmax(0,1fr)]">
              <div className="space-y-2">
                {bootstrap?.recentSavedDreams.length ? bootstrap.recentSavedDreams.map((dream) => (
                  <button
                    key={dream.id}
                    type="button"
                    onClick={() => setSelectedArchiveId(dream.id)}
                    className={[
                      'w-full rounded-sm border px-3 py-3 text-left transition-all',
                      dream.id === archiveDream?.id
                        ? 'border-slate-100/40 bg-slate-100/10'
                        : 'border-slate-700/40 bg-slate-900/40 hover:border-slate-500 hover:bg-slate-900',
                    ].join(' ')}
                  >
                    <div className="text-sm font-medium text-slate-100">{dream.title}</div>
                    <div className="mt-1 text-xs text-slate-400">{TYPE_LABELS[dream.type]} • {formatDateTime(getSavedAt(dream))}</div>
                    <div className={`mt-2 text-xs font-medium ${artifactBadgeTone(dream.evaluation?.overallScore)}`}>Quality {dream.evaluation?.overallScore || 0}</div>
                  </button>
                )) : (
                  <div className="rounded-sm border border-dashed border-slate-700/40 px-4 py-10 text-center text-sm text-slate-500">
                    Saved dreams will appear here after an explicit save.
                  </div>
                )}
              </div>
              <div>
                {archiveDream ? (
                  <DreamReadStage dream={archiveDream} />
                ) : (
                  <DreamSkeleton stageLabel="ready" stillWorking={false} />
                )}
              </div>
            </div>
          ) : generating || (detail?.session?.status === 'generating' && !latestDream) ? (
            <DreamSkeleton stageLabel={activeStage} stillWorking={stillWorking} />
          ) : latestDream ? (
            <DreamReadStage dream={latestDream} sessionLabel={detail?.session ? TYPE_LABELS[detail.session.type] : undefined} stageLabel={STAGE_LABELS[activeStage]} />
          ) : (
            <div className="flex min-h-[520px] items-center justify-center rounded-md border border-dashed border-slate-700/40 bg-slate-950/30 px-8 text-center">
              <div>
                <Sparkles className="mx-auto h-8 w-8 text-slate-500" />
                <h4 className="mt-4 text-lg font-medium text-slate-200">No active dream yet</h4>
                <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-400">Generation moves immediately into a session-backed workspace. Start from the left column and review the draft before saving it into the archive.</p>
              </div>
            </div>
          )}
          {mode === 'compose' && (
            <div className="border-t border-border/40 bg-muted/5 p-3 shrink-0 flex items-center justify-center">
              <StageRail detail={detail} />
            </div>
          )}
        </div>

        <div className="p-5">
          {mode === 'archive' ? (
            <ArchiveInspector bootstrap={bootstrap} dream={archiveDream} />
          ) : (
            <DreamInspector bootstrap={bootstrap} detail={detail} dream={inspectorDream} saving={saving} />
          )}
        </div>
      </div>
    </div>
  )
}

function getSavedAt(dream: Dream) {
  return dream.savedAt || dream.updatedAt || dream.createdAt
}

function DreamReadStage({ dream, sessionLabel, stageLabel }: { dream: Dream; sessionLabel?: string; stageLabel?: string }) {
  return (
    <div className="space-y-4">
      <header className="space-y-4 pb-6 border-b border-border/20">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
          <span className="text-pastel-blue">{sessionLabel || TYPE_LABELS[dream.type]}</span>
          <span className="opacity-50">/</span>
          <span>{stageLabel || dream.status}</span>
          <span className="opacity-50">/</span>
          <span className={artifactBadgeTone(dream.evaluation?.overallScore)}>Quality {dream.evaluation?.overallScore || 0}</span>
        </div>
        <h2 className="text-4xl font-black text-foreground tracking-tight">{dream.title}</h2>
        <p className="max-w-3xl text-sm leading-relaxed italic text-muted-foreground">{dream.summary}</p>
      </header>

      <div className="space-y-4">
        {dream.scenes.map((scene) => (
          <div key={scene.id} className={`${subPanel} p-5`}>
            <div className="mb-2 text-[10px] uppercase tracking-[0.22em] text-muted-foreground">{scene.heading}</div>
            <div className="mb-3 text-sm text-muted-foreground">{scene.summary}</div>
            <p className="text-[15px] leading-7 text-foreground">{scene.body}</p>
            {scene.symbols.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {scene.symbols.map((symbol) => (
                  <span key={symbol} className="rounded-sm border border-border/40 bg-muted/30 px-3 py-1 text-[11px] text-foreground">
                    {symbol}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className={`${subPanel} p-5`}>
          <div className={labelStyle}>Interpretation</div>
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground">{dream.interpretation.summary}</p>
          {dream.interpretation.insights.length > 0 && (
            <div className="mt-4 space-y-2">
              {dream.interpretation.insights.map((insight) => (
                <div key={insight} className="flex items-start gap-2 text-[12px] text-muted-foreground">
                  <span className="mt-1.5 h-1 w-1 rounded-full bg-pastel-purple shrink-0" />
                  <span>{insight}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <div className={`${subPanel} p-5`}>
          <div className={labelStyle}>Themes</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {dream.themes.length ? dream.themes.map((theme) => (
              <span key={theme} className="rounded-sm border border-border/40 bg-muted/30 px-2.5 py-1 text-[11px] text-foreground">{theme}</span>
            )) : (
              <span className="text-xs text-muted-foreground">No themes extracted.</span>
            )}
          </div>
          {dream.latentTensions.length > 0 && (
            <>
              <div className={`${labelStyle} mt-6`}>Latent Tensions</div>
              <div className="mt-3 space-y-3">
                {dream.latentTensions.slice(0, 3).map((tension) => (
                  <div key={tension.tension}>
                    <div className="text-sm font-medium text-foreground">{tension.tension}</div>
                    <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">{tension.whyItMatters}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function DreamInspector({
  bootstrap,
  detail,
  dream,
  saving,
}: {
  bootstrap: DreamBootstrapPayload | null
  detail: DreamSessionDetail | null
  dream: Dream | null
  saving: boolean
}) {
  const evaluation = detail?.session?.latestEvaluation || dream?.evaluation

  return (
    <div className="space-y-4">
      <div className={`${subPanel} p-4`}>
        <div className={labelStyle}>Quality Gate</div>
        {evaluation ? (
          <>
            <div className="mt-3 flex items-center gap-2">
              {evaluation.pass ? <CheckCircle2 className="h-4 w-4 text-emerald-300" /> : <AlertTriangle className="h-4 w-4 text-rose-300" />}
              <div className={`text-sm font-medium ${evaluation.pass ? 'text-emerald-200' : 'text-rose-200'}`}>
                {evaluation.pass ? 'Passing session' : 'Below save threshold'}
              </div>
            </div>
            <div className={`mt-2 text-2xl font-semibold ${artifactBadgeTone(evaluation.overallScore)}`}>{evaluation.overallScore}</div>
            <div className="mt-3 space-y-2">
              {(Object.keys(DIMENSION_LABELS) as DreamQualityDimension[]).map((dimension) => (
                <div key={dimension}>
                  <div className="mb-1 flex items-center justify-between text-xs text-slate-400">
                    <span>{DIMENSION_LABELS[dimension]}</span>
                    <span>{evaluation.dimensions[dimension]?.score || 0}</span>
                  </div>
                  <div className="h-1.5 rounded-full bg-slate-800">
                    <div className="h-full rounded-full bg-gradient-to-r from-indigo-300 to-slate-100" style={{ width: `${evaluation.dimensions[dimension]?.score || 0}%` }} />
                  </div>
                </div>
              ))}
            </div>
            {evaluation.hardFailureFlags.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {evaluation.hardFailureFlags.map((flag) => (
                  <span key={flag} className="rounded-full border border-rose-400/30 bg-rose-400/10 px-3 py-1 text-[11px] text-rose-200">{flag.replaceAll('_', ' ')}</span>
                ))}
              </div>
            )}
            <p className="mt-4 text-sm leading-relaxed text-slate-400">{evaluation.evaluatorSummary}</p>
          </>
        ) : (
          <InspectorSkeleton copy="Quality panel hydrates after evaluation." />
        )}
      </div>

      <div className={`${subPanel} p-4`}>
        <div className={labelStyle}>Selected Context</div>
        <div className="mt-3 space-y-3">
          {detail?.session?.contextPacket?.selectedSignals?.length ? detail.session.contextPacket.selectedSignals.slice(0, 5).map((signal) => (
            <div key={signal.id} className="rounded-sm border border-border/30 bg-muted/10 p-3">
              <div className="text-[10px] font-bold uppercase tracking-wider text-foreground">{signal.label}</div>
              <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{signal.snippet}</div>
            </div>
          )) : (
            <InspectorSkeleton copy="Context chips appear as prepare and conditioning stages complete." />
          )}
        </div>
      </div>

      <div className={`${subPanel} p-4`}>
        <div className={labelStyle}>Symbols And Tensions</div>
        {dream ? (
          <div className="mt-3 space-y-3">
            {dream.symbols.slice(0, 6).map((symbol) => (
              <div key={symbol.symbol} className="rounded-sm border border-slate-700/30 bg-slate-950/40 p-3">
                <div className="text-sm font-medium text-slate-100">{symbol.symbol}</div>
                <div className="mt-1 text-xs text-slate-400">{symbol.meaning}</div>
              </div>
            ))}
            {dream.latentTensions.map((tension) => (
              <div key={tension.tension} className="rounded-sm border border-slate-700/30 bg-slate-950/40 p-3">
                <div className="text-sm font-medium text-slate-100">{tension.tension}</div>
                <div className="mt-1 text-xs text-slate-400">{tension.whyItMatters}</div>
              </div>
            ))}
          </div>
        ) : (
          <InspectorSkeleton copy="Symbol extraction hydrates after the draft stabilizes." />
        )}
      </div>

      <div className={`${subPanel} p-4`}>
        <div className={labelStyle}>Interpretation And Residue</div>
        {dream ? (
          <div className="mt-3 space-y-4">
            <p className="text-sm leading-relaxed text-slate-300">{dream.interpretation.summary}</p>
            <div className="space-y-2">
              {dream.interpretation.insights.map((insight) => (
                <div key={insight} className="text-xs text-slate-400">{insight}</div>
              ))}
            </div>
            {(dream.impressionPreview || dream.impression) && (
              <div className="rounded-sm border border-indigo-200/20 bg-indigo-200/10 p-3">
                <div className="text-[11px] uppercase tracking-[0.22em] text-indigo-100">Dream Impression</div>
                <div className="mt-2 text-sm font-medium text-slate-50">{(dream.impression || dream.impressionPreview)?.behaviorTilt}</div>
                <div className="mt-1 text-xs leading-relaxed text-slate-300">{(dream.impression || dream.impressionPreview)?.summary}</div>
                <div className="mt-2 text-[11px] text-slate-300">{(dream.impression || dream.impressionPreview)?.guidance}</div>
              </div>
            )}
            {saving && <div className="text-xs text-indigo-200">Persisting dream artifact and replacing active residue…</div>}
          </div>
        ) : (
          <InspectorSkeleton copy="Interpretation and dream residue preview appear when the session is ready." />
        )}
      </div>

      {bootstrap?.activeDreamImpression && bootstrap.activeDreamImpression.sourceDreamId !== (dream?.impression?.sourceDreamId || dream?.id) && (
        <div className={`${subPanel} p-4`}>
          <div className={labelStyle}>Active Impression</div>
          <div className="mt-2 text-sm font-medium text-slate-100">{bootstrap.activeDreamImpression.behaviorTilt}</div>
          <div className="mt-1 text-xs leading-relaxed text-slate-400">{bootstrap.activeDreamImpression.summary}</div>
          <div className="mt-2 text-[11px] text-slate-500">Expires {formatDateTime(bootstrap.activeDreamImpression.expiresAt)}</div>
        </div>
      )}
    </div>
  )
}

function ArchiveInspector({
  bootstrap,
  dream,
}: {
  bootstrap: DreamBootstrapPayload | null
  dream: Dream | null
}) {
  return (
    <div className="space-y-4">
      <div className={`${subPanel} p-4`}>
        <div className={labelStyle}>Archive Metrics</div>
        <div className="mt-4 grid grid-cols-2 gap-3">
          <MetricTile label="Saved dreams" value={bootstrap?.archiveMetrics.totalSavedDreams || 0} />
          <MetricTile label="Nightmare ratio" value={`${Math.round((bootstrap?.archiveMetrics.nightmareRatio || 0) * 100)}%`} />
          <MetricTile label="Ready drafts" value={bootstrap?.archiveMetrics.readyToSaveCount || 0} />
          <MetricTile label="Failed drafts" value={bootstrap?.archiveMetrics.failedSessions || 0} />
        </div>
      </div>

      <div className={`${subPanel} p-4`}>
        <div className={labelStyle}>Recurring Patterns</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {bootstrap?.archiveMetrics.recurringSymbols.map((entry) => (
            <span key={entry.symbol} className="rounded-full border border-indigo-200/20 bg-indigo-200/10 px-3 py-1 text-[11px] text-indigo-100">{entry.symbol} ×{entry.count}</span>
          ))}
          {bootstrap?.archiveMetrics.recurringThemes.map((entry) => (
            <span key={entry.theme} className="rounded-full border border-slate-100/20 bg-slate-100/10 px-3 py-1 text-[11px] text-slate-200">{entry.theme} ×{entry.count}</span>
          ))}
        </div>
      </div>

      {dream && (
        <div className={`${subPanel} p-4`}>
          <div className={labelStyle}>Selected Dream</div>
          <div className="mt-2 text-sm font-medium text-slate-100">{dream.title}</div>
          <div className="mt-1 text-xs text-slate-400">{TYPE_LABELS[dream.type]} • {formatDateTime(getSavedAt(dream))}</div>
          {dream.impression && (
            <div className="mt-4 rounded-sm border border-indigo-200/20 bg-indigo-200/10 p-3">
              <div className="text-[11px] uppercase tracking-[0.22em] text-indigo-100">Saved Impression</div>
              <div className="mt-2 text-sm text-slate-100">{dream.impression.behaviorTilt}</div>
              <div className="mt-1 text-xs text-slate-300">{dream.impression.summary}</div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-slate-700/35 bg-slate-950/45 p-3">
      <div className="text-[10px] uppercase tracking-[0.2em] text-slate-500">{label}</div>
      <div className="mt-2 text-lg font-semibold text-slate-100">{value}</div>
    </div>
  )
}

function InspectorSkeleton({ copy }: { copy: string }) {
  return (
    <div className="mt-3 rounded-sm border border-dashed border-slate-700/40 px-4 py-6 text-center text-xs leading-relaxed text-slate-500">
      {copy}
    </div>
  )
}
