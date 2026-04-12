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
  Archive,
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
import {
  PipelineIcon,
  QualityIcon,
  ContextIcon,
  ArchiveLibraryIcon,
  StageIcon,
} from '@/components/journal/JournalIcons'

interface DreamJournalProps {
  agentId: string
  agentName: string
}

const premiumPanel = 'rounded-md border border-border/40 bg-card/40 backdrop-blur-md shadow-sm'
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
  if (!score) return 'text-muted-foreground'
  if (score >= 85) return 'text-pastel-green'
  if (score >= 75) return 'text-pastel-yellow'
  return 'text-pastel-red'
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

function getPreferredSessionId(sessions: DreamBootstrapPayload['recentSessions']) {
  const preferred = sessions.find((session) => session.status !== 'generating')
  return preferred?.id || null
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
          <div key={stage} className="min-w-[102px] flex-1">
            <div className={`mb-1 text-[9px] uppercase tracking-[0.18em] ${isActive ? 'text-pastel-purple font-bold' : 'text-muted-foreground'}`}>{stage.replaceAll('_', ' ')}</div>
            <div className="h-1.5 rounded-full bg-muted/40">
              <motion.div
                initial={false}
                animate={{ width: isComplete || isActive ? '100%' : '0%' }}
                transition={{ duration: 0.35 }}
                className={isActive ? 'h-full rounded-full bg-pastel-purple' : isComplete ? 'h-full rounded-full bg-pastel-green' : 'h-full rounded-full bg-muted/30'}
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
    <div className="h-full flex flex-col items-center justify-center opacity-70 gap-6 max-w-sm mx-auto">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <motion.div animate={{ rotate: 360 }} transition={{ duration: 4, repeat: Infinity, ease: "linear" }} className="absolute inset-0 rounded-full border border-dashed border-pastel-purple/30" />
        <motion.div animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-2 rounded-full border border-pastel-purple/20 bg-pastel-purple/5 shadow-[0_0_15px_rgba(203,166,247,0.15)]" />
        <MoonStar className="relative h-5 w-5 text-pastel-purple" />
      </div>
      <div className="space-y-4 w-full">
        <div className="h-8 w-2/3 animate-pulse rounded-sm bg-muted/40 mx-auto" />
        <div className="h-4 w-1/3 animate-pulse rounded-sm bg-muted/30 mx-auto" />
      </div>
      <div className="space-y-3 w-full">
        {[0, 1, 2, 3, 4].map((row) => (
          <div
            key={row}
            className="h-4 animate-pulse rounded-sm bg-muted/20"
            style={{ width: `${row === 4 ? 62 : row % 2 === 0 ? 100 : 92}%`, margin: '0 auto' }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 text-xs text-muted-foreground justify-center">
        <span className="h-2 w-2 animate-pulse rounded-full bg-pastel-purple" />
        <span>{utilityCopy}</span>
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
      if (!activeSessionId) setActiveSessionId(getPreferredSessionId(payload.recentSessions))
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

  if (loading && !bootstrap) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {/* Outer spinning dash ring */}
            <motion.div
              animate={{ rotate: 360 }}
              transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border border-dashed border-pastel-purple/30"
            />
            {/* Inner pulsing ring */}
            <motion.div
              animate={{ scale: [0.8, 1.1, 0.8], opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-2 rounded-full border border-pastel-purple/20 bg-pastel-purple/5 shadow-[0_0_15px_rgba(203,166,247,0.15)]"
            />
            {/* Center Icon */}
            <MoonStar className="relative h-8 w-8 text-pastel-purple" />
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-pastel-purple">Initializing Dream Workspace</div>
            <div className="text-xs text-muted-foreground/80">Connecting to subconscious nodes...</div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
        <div className="flex items-center gap-4">
          <div className="rounded-md bg-pastel-purple/10 p-2.5">
            <MoonStar className="h-5 w-5 text-pastel-purple" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground leading-tight tracking-tight">
              {agentName}&apos;s Dream Journal
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
              Private Dreams & Archive
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border/40 bg-muted/20 p-1">
            <button
              onClick={() => setMode('compose')}
              className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-[12px] font-bold transition-all duration-200 ${
                mode === 'compose' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <MoonStar className="h-3.5 w-3.5" />
              Compose
            </button>
            <button
              onClick={() => setMode('archive')}
              className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-[12px] font-bold transition-all duration-200 ${
                mode === 'archive' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <ArchiveLibraryIcon className="h-3.5 w-3.5" />
              Archive
            </button>
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-2 border-border/40" onClick={() => void loadBootstrap(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {error ? (
        <div className="rounded-md border border-pastel-red/30 bg-pastel-red/5 px-4 py-3 text-[13px] text-pastel-red flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[340px_1fr_440px] xl:h-[calc(100vh-220px)] xl:min-h-[700px]">
        {/* Column 1: Input / Navigation */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {mode === 'compose' ? (
            <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <MoonStar className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Dream Engine</span>
                </div>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin flex-1">
                <div className="space-y-1.5">
                  <div className={labelStyle}>Dream Mode</div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
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
                              ? 'border-pastel-purple/40 bg-pastel-purple/10 text-pastel-purple shadow-sm'
                              : 'border-border/30 bg-muted/5 text-muted-foreground hover:border-pastel-purple/20 hover:text-foreground',
                          ].join(' ')}
                        >
                          <div className="text-sm font-bold">{TYPE_LABELS[entry]}</div>
                          <div className="mt-1 text-[9px] leading-relaxed opacity-80">{entry === bootstrap?.suggestedType ? 'Suggested mode.' : 'Available for generation.'}</div>
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className={labelStyle}>Seed Note</div>
                  <textarea
                    value={userNote}
                    onChange={(event) => setUserNote(event.target.value)}
                    disabled={generating}
                    rows={3}
                    className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-2 text-[12px] text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-pastel-purple/50 resize-none"
                    placeholder="Optional pressure, memory, or unresolved thread"
                  />
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className={labelStyle}>Focus</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(Object.keys(FOCUS_LABELS) as DreamFocus[]).map((entry) => {
                      const active = focus.includes(entry)
                      return (
                        <button
                          key={entry}
                          type="button"
                          onClick={() => setFocus((current) => active ? current.filter((value) => value !== entry) : [...current, entry].slice(0, 4))}
                          className={[
                            'rounded-md border px-2.5 py-1 text-[11px] font-bold transition-all',
                            active
                              ? 'border-pastel-purple/40 bg-pastel-purple/10 text-pastel-purple'
                              : 'border-border/30 bg-muted/5 text-muted-foreground hover:border-pastel-purple/20 hover:text-foreground',
                          ].join(' ')}
                        >
                          {FOCUS_LABELS[entry]}
                        </button>
                      )
                    })}
                  </div>
                </div>

                <div className={`${subPanel} p-3`}>
                  <div className={labelStyle}>Suggested Mode</div>
                  <div className="mt-1 text-[13px] font-bold text-foreground">{TYPE_LABELS[bootstrap?.suggestedType || 'symbolic']}</div>
                  <p className="mt-1 text-[10px] leading-relaxed text-muted-foreground">Derived from current state and recent saved context. It never auto-runs generation.</p>
                </div>
              </div>

              <div className="p-3 shrink-0 border-t border-border/30 bg-muted/5">
                <div className="flex gap-2">
                  <Button
                    type="button"
                    className="h-8 flex-1 gap-2 bg-pastel-purple hover:bg-pastel-purple/90 text-primary-foreground font-bold text-[10px] uppercase tracking-wider"
                    onClick={() => void handleGenerate(false)}
                    disabled={generating || saving}
                  >
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <MoonStar className="h-3.5 w-3.5" />}
                    Dream
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    className="h-8 flex-1 gap-2 font-bold text-[10px] uppercase tracking-wider border-border/40"
                    onClick={() => void handleGenerate(true)}
                    disabled={!activeSessionId || generating || saving}
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regen
                  </Button>
                  <Button
                    type="button"
                    variant="secondary"
                    className="h-8 w-10 shrink-0 p-0 border border-border/40 bg-muted hover:bg-muted"
                    onClick={() => void handleSave()}
                    disabled={!canSave || saving || generating}
                  >
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin text-pastel-green" /> : <Save className={`h-3.5 w-3.5 ${canSave ? 'text-pastel-green' : 'text-muted-foreground'}`} />}
                  </Button>
                </div>
                {saveStatus && <div className="mt-2 text-[10px] font-bold text-center text-pastel-green">{saveStatus}</div>}
              </div>
            </section>
          ) : (
            <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <ArchiveLibraryIcon className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Archive Details</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
                {bootstrap?.recentSavedDreams.length ? bootstrap.recentSavedDreams.map((dream) => (
                  <button
                    key={dream.id}
                    type="button"
                    onClick={() => setSelectedArchiveId(dream.id)}
                    className={`w-full text-left p-2.5 rounded-sm border transition-all duration-200 ${
                      selectedArchiveId === dream.id ? 'border-pastel-blue/40 bg-pastel-blue/5' : 'border-border/30 bg-muted/5 hover:border-pastel-blue/20'
                    }`}
                  >
                    <div className="text-[11px] font-bold text-foreground truncate">{dream.title}</div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{TYPE_LABELS[dream.type]} • {formatDateTime(getSavedAt(dream))}</div>
                    <div className={`mt-2 text-[9px] font-bold uppercase ${artifactBadgeTone(dream.evaluation?.overallScore)}`}>Quality {dream.evaluation?.overallScore || 0}</div>
                  </button>
                )) : (
                  <div className="rounded-sm border border-dashed border-border/30 px-4 py-8 text-center text-sm text-muted-foreground">
                    Saved dreams will appear here after an explicit save.
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Recent Runs / Sessions Container */}
          <section className={`${premiumPanel} h-[200px] flex flex-col overflow-hidden shrink-0`}>
            <div className="border-b border-border/40 bg-muted/10 px-3 py-2 flex items-center gap-2">
              <PipelineIcon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Recent Sessions</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              {bootstrap?.recentSessions.length ? bootstrap.recentSessions.map((session) => (
                <button
                  key={session.id}
                  type="button"
                  onClick={() => { setActiveSessionId(session.id); setMode('compose'); }}
                  className={`w-full text-left p-2.5 rounded-sm border transition-all duration-200 ${
                    activeSessionId === session.id && mode === 'compose' ? 'border-pastel-purple/40 bg-pastel-purple/5' : 'border-border/30 bg-muted/5 hover:border-pastel-purple/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-foreground">{TYPE_LABELS[session.type]}</span>
                    <span className={`uppercase text-[8px] ${sessionStatusTone(session.status)}`}>{STAGE_LABELS[session.latestStage] || session.status}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate opacity-80 mt-0.5">{formatDateTime(session.updatedAt)}</div>
                  {typeof session.latestEvaluation?.overallScore === 'number' && (
                    <div className={`mt-1.5 text-[9px] font-bold uppercase ${artifactBadgeTone(session.latestEvaluation.overallScore)}`}>
                      Quality {session.latestEvaluation.overallScore}
                    </div>
                  )}
                </button>
              )) : (
                <div className="p-3 text-[10px] text-muted-foreground italic text-center">No dream sessions yet.</div>
              )}
            </div>
          </section>
        </div>

        {/* Column 2: The Stage (Content Reader) */}
        <section className={`${premiumPanel} flex flex-col min-h-0 overflow-hidden`}>
          <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <StageIcon className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Dream Viewer</span>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
            {mode === 'compose' ? (
               generating || (detail?.session?.status === 'generating' && !latestDream) ? (
                <DreamSkeleton stageLabel={activeStage} stillWorking={stillWorking} />
               ) : latestDream ? (
                <DreamReadStage dream={latestDream} sessionLabel={detail?.session ? TYPE_LABELS[detail.session.type] : undefined} stageLabel={STAGE_LABELS[activeStage]} />
               ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-50 grayscale">
                  <MoonStar className="h-10 w-10 mb-4 text-muted-foreground" />
                  <div className="text-sm font-semibold">{detail?.session?.status === 'failed' ? 'Session Ended' : 'No Active Dream'}</div>
                  <div className="text-xs text-muted-foreground mt-1 max-w-sm text-center">
                    {detail?.session?.failureReason || 'Generation moves immediately into a session-backed workspace. Start from the left column.'}
                  </div>
                </div>
               )
            ) : archiveDream ? (
               <DreamReadStage dream={archiveDream} />
             ) : (
               <div className="h-full flex flex-col items-center justify-center opacity-50 grayscale">
                 <Archive className="h-10 w-10 mb-4 text-muted-foreground" />
                 <div className="text-sm font-semibold">No Archive Data</div>
                 <div className="text-xs text-muted-foreground mt-1 text-center max-w-xs">Save a passing dream to populate the archive.</div>
               </div>
             )}
          </div>
          {mode === 'compose' && (
            <div className="border-t border-border/40 bg-muted/5 p-3 shrink-0 flex items-center justify-center">
               <StageRail detail={detail} />
            </div>
          )}
        </section>

        {/* Column 3: The Inspector (Stats & Evaluation) */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
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
    <article className="w-full space-y-8">
      <header className="space-y-4 pb-8 border-b border-border/20">
        <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
          <span className="text-pastel-purple">{sessionLabel || TYPE_LABELS[dream.type]}</span>
          <span className="opacity-50">/</span>
          <span>{stageLabel || dream.status}</span>
          <span className="opacity-50">/</span>
          <span className={artifactBadgeTone(dream.evaluation?.overallScore)}>Quality {dream.evaluation?.overallScore || 0}</span>
        </div>
        <h1 className="text-4xl font-black text-foreground tracking-tight">
          {dream.title}
        </h1>
        <p className="text-sm text-muted-foreground leading-relaxed italic opacity-80">
          {dream.summary}
        </p>
      </header>

      <div className="space-y-4">
        {dream.scenes.map((scene) => (
          <div key={scene.id} className={`${subPanel} p-5`}>
            <div className="mb-2 text-[9px] uppercase font-bold tracking-[0.22em] text-pastel-blue">{scene.heading}</div>
            <div className="mb-3 text-sm text-muted-foreground font-medium">{scene.summary}</div>
            <p className="leading-relaxed text-foreground text-sm">{scene.body}</p>
            {scene.symbols.length > 0 && (
              <div className="mt-4 flex flex-wrap gap-2">
                {scene.symbols.map((symbol) => (
                  <span key={symbol} className="rounded-sm border border-border/40 bg-muted/30 px-3 py-1 text-[11px] font-bold text-foreground">
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
          <p className="mt-4 text-sm leading-relaxed text-muted-foreground font-medium">{dream.interpretation.summary}</p>
          {dream.interpretation.insights.length > 0 && (
            <div className="mt-4 space-y-1.5">
              <ul className="space-y-1.5 list-none m-0 p-0">
                {dream.interpretation.insights.map((insight) => (
                  <li key={insight} className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2 m-0 p-0">
                    <span className="mt-1.5 h-1 w-1 rounded-full bg-pastel-purple shrink-0" />
                    {insight}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
        <div className={`${subPanel} p-5`}>
          <div className={labelStyle}>Themes</div>
          <div className="mt-4 flex flex-wrap gap-2">
            {dream.themes.length ? dream.themes.map((theme) => (
              <span key={theme} className="rounded-sm border border-border/40 bg-muted/30 px-2.5 py-1 text-[10px] font-bold text-foreground">{theme}</span>
            )) : (
              <span className="text-[10px] text-muted-foreground">No themes extracted.</span>
            )}
          </div>
          {dream.latentTensions.length > 0 && (
            <>
              <div className={`${labelStyle} mt-6`}>Latent Tensions</div>
              <div className="mt-3 space-y-3">
                {dream.latentTensions.slice(0, 3).map((tension) => (
                  <div key={tension.tension}>
                    <div className="text-[11px] font-bold text-foreground">{tension.tension}</div>
                    <div className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{tension.whyItMatters}</div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </div>
    </article>
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
    <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden h-full`}>
      <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <QualityIcon className="h-4 w-4" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Inspector</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6">
        <div>
          <div className={labelStyle}>Quality Gate</div>
          {evaluation ? (
            <div className="mt-3 space-y-3">
              <div className={evaluation.pass ? 'rounded-md border border-pastel-green/40 bg-pastel-green/5 p-4 text-center pb-5' : 'rounded-md border border-pastel-red/40 bg-pastel-red/5 p-4 text-center pb-5'}>
                <div className={labelStyle}>Final Score</div>
                <div className="flex justify-center items-center gap-2 mt-2">
                  <span className={`text-4xl font-black tracking-tighter ${evaluation.pass ? 'text-pastel-green' : 'text-pastel-red'}`}>{evaluation.overallScore}</span>
                  {evaluation.pass ? <CheckCircle2 className="h-6 w-6 text-pastel-green" /> : <AlertTriangle className="h-6 w-6 text-pastel-red" />}
                </div>
                <div className={`mt-1 text-[9px] font-bold uppercase ${evaluation.pass ? 'text-pastel-green' : 'text-pastel-red'}`}>
                  {evaluation.pass ? 'Passing session' : 'Below save threshold'}
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-2 mt-2">
                {(Object.keys(DIMENSION_LABELS) as DreamQualityDimension[]).map((dimension) => (
                  <div key={dimension} className={`${subPanel} p-2.5 hover:border-border/40 transition-colors`}>
                    <div className="flex items-center justify-between text-[11px] font-bold">
                      <span className="text-muted-foreground uppercase opacity-80 text-[9px]">{DIMENSION_LABELS[dimension]}</span>
                      <span className={artifactBadgeTone(evaluation.dimensions[dimension]?.score)}>{evaluation.dimensions[dimension]?.score || 0}</span>
                    </div>
                  </div>
                ))}
              </div>

              {evaluation.hardFailureFlags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {evaluation.hardFailureFlags.map((flag) => (
                    <span key={flag} className="rounded-sm border border-pastel-red/40 bg-pastel-red/10 px-2 py-0.5 text-[10px] font-medium text-pastel-red">{flag.replaceAll('_', ' ')}</span>
                  ))}
                </div>
              )}
              <p className="mt-3 text-[10px] opacity-80 tracking-wide font-medium leading-relaxed text-muted-foreground">{evaluation.evaluatorSummary}</p>
            </div>
          ) : (
            <InspectorSkeleton copy="Quality panel hydrates after evaluation." />
          )}
        </div>

        <div>
          <div className={labelStyle}>Selected Context</div>
          <div className="mt-3 space-y-3">
            {detail?.session?.contextPacket?.selectedSignals?.length ? detail.session.contextPacket.selectedSignals.slice(0, 5).map((signal) => (
              <div key={signal.id} className="border-l-[3px] border-pastel-blue/40 pl-3">
                <div className="text-[9px] font-bold uppercase tracking-widest text-foreground">{signal.label}</div>
                <div className="mt-1 text-[11px] text-muted-foreground leading-relaxed">{signal.snippet}</div>
              </div>
            )) : (
              <InspectorSkeleton copy="Context chips appear as prepare and conditioning stages complete." />
            )}
          </div>
        </div>

        <div>
          <div className={labelStyle}>Symbols And Tensions</div>
          {dream ? (
            <div className="mt-3 space-y-3">
              {dream.symbols.slice(0, 6).map((symbol) => (
                <div key={symbol.symbol} className={`${subPanel} px-3 py-2.5`}>
                  <div className="text-[11px] font-bold text-foreground">{symbol.symbol}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{symbol.meaning}</div>
                </div>
              ))}
              {dream.latentTensions.map((tension) => (
                <div key={tension.tension} className={`${subPanel} px-3 py-2.5`}>
                  <div className="text-[11px] font-bold text-foreground">{tension.tension}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground leading-relaxed">{tension.whyItMatters}</div>
                </div>
              ))}
            </div>
          ) : (
            <InspectorSkeleton copy="Symbol extraction hydrates after the draft stabilizes." />
          )}
        </div>

        <div>
          <div className={labelStyle}>Interpretation And Residue</div>
          {dream ? (
            <div className="mt-3 space-y-3 bg-muted/20 border border-border/30 rounded-sm p-4">
              <p className="text-[11px] leading-relaxed text-muted-foreground font-medium">{dream.interpretation.summary}</p>
              <div className="h-px bg-border/40 my-3"></div>
              {dream.interpretation.insights.length > 0 && (
                <ul className="space-y-1.5 list-none m-0 p-0">
                  {dream.interpretation.insights.map((insight) => (
                    <li key={insight} className="text-[10px] text-muted-foreground leading-relaxed flex items-start gap-2 m-0 p-0">
                      <span className="mt-1.5 h-1 w-1 rounded-full bg-pastel-blue shrink-0" />
                      {insight}
                    </li>
                  ))}
                </ul>
              )}
              {(dream.impressionPreview || dream.impression) && (
                <div className="mt-4 rounded-sm border border-pastel-purple/30 bg-pastel-purple/10 p-3">
                  <div className="text-[9px] uppercase font-bold tracking-[0.22em] text-pastel-purple">Dream Impression</div>
                  <div className="mt-2 text-[11px] font-bold text-foreground">{(dream.impression || dream.impressionPreview)?.behaviorTilt}</div>
                  <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground font-medium">{(dream.impression || dream.impressionPreview)?.summary}</div>
                  <div className="mt-2 text-[9px] text-muted-foreground">{(dream.impression || dream.impressionPreview)?.guidance}</div>
                </div>
              )}
              {saving && <div className="text-[10px] text-pastel-purple font-medium">Persisting dream artifact and replacing active residue…</div>}
            </div>
          ) : (
            <InspectorSkeleton copy="Interpretation and dream residue preview appear when the session is ready." />
          )}
        </div>

        {bootstrap?.activeDreamImpression && bootstrap.activeDreamImpression.sourceDreamId !== (dream?.impression?.sourceDreamId || dream?.id) && (
          <div>
            <div className={labelStyle}>Active Impression</div>
            <div className={`${subPanel} px-3 py-3 mt-3`}>
              <div className="text-[11px] font-bold text-foreground">{bootstrap.activeDreamImpression.behaviorTilt}</div>
              <div className="mt-1 text-[10px] leading-relaxed text-muted-foreground">{bootstrap.activeDreamImpression.summary}</div>
              <div className="mt-2 text-[9px] font-bold uppercase text-muted-foreground">Expires {formatDateTime(bootstrap.activeDreamImpression.expiresAt)}</div>
            </div>
          </div>
        )}
      </div>
    </section>
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
    <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden h-full`}>
      <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-2">
          <ArchiveLibraryIcon className="h-4 w-4" />
          <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Archive Inspector</span>
        </div>
      </div>
      <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6">
        <div>
          <div className={labelStyle}>Archive Metrics</div>
          <div className="mt-4 grid grid-cols-2 gap-3">
            <MetricTile label="Saved dreams" value={bootstrap?.archiveMetrics.totalSavedDreams || 0} />
            <MetricTile label="Nightmare ratio" value={`${Math.round((bootstrap?.archiveMetrics.nightmareRatio || 0) * 100)}%`} />
            <MetricTile label="Ready drafts" value={bootstrap?.archiveMetrics.readyToSaveCount || 0} />
            <MetricTile label="Failed drafts" value={bootstrap?.archiveMetrics.failedSessions || 0} />
          </div>
        </div>

        <div>
          <div className={labelStyle}>Recurring Patterns</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {bootstrap?.archiveMetrics.recurringSymbols.map((entry) => (
              <span key={entry.symbol} className="rounded-sm border border-pastel-purple/30 bg-pastel-purple/10 px-2 py-0.5 text-[10px] font-bold text-foreground">{entry.symbol} ×{entry.count}</span>
            ))}
            {bootstrap?.archiveMetrics.recurringThemes.map((entry) => (
              <span key={entry.theme} className="rounded-sm border border-border/30 bg-muted/10 px-2 py-0.5 text-[10px] font-bold text-foreground">{entry.theme} ×{entry.count}</span>
            ))}
          </div>
        </div>

        {dream && (
          <div>
            <div className={labelStyle}>Selected Dream</div>
            <div className="mt-3 space-y-3">
               <div className={`${subPanel} px-3 py-3`}>
                 <div className="text-[11px] font-bold text-foreground">{dream.title}</div>
                 <div className="mt-1 text-[9px] font-bold uppercase text-muted-foreground">{TYPE_LABELS[dream.type]} • {formatDateTime(getSavedAt(dream))}</div>
               </div>
               {dream.impression && (
                <div className="rounded-sm border border-pastel-purple/30 bg-pastel-purple/10 p-3">
                  <div className="text-[9px] uppercase font-bold tracking-[0.22em] text-pastel-purple">Saved Impression</div>
                  <div className="mt-2 text-[11px] font-bold text-foreground">{dream.impression.behaviorTilt}</div>
                  <div className="mt-1 text-[10px] text-muted-foreground">{dream.impression.summary}</div>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </section>
  )
}

function MetricTile({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={`${subPanel} p-3 flex flex-col items-start`}>
      <div className={labelStyle}>{label}</div>
      <div className="mt-1 text-lg font-bold text-foreground leading-none">{value}</div>
    </div>
  )
}

function InspectorSkeleton({ copy }: { copy: string }) {
  return (
    <div className="mt-3 rounded-sm border border-dashed border-border/30 px-4 py-6 text-center text-[11px] leading-relaxed text-muted-foreground italic">
      {copy}
    </div>
  )
}
