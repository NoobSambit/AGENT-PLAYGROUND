'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
  Save,
} from 'lucide-react'
import { ChatMessageContent } from '@/components/chat/ChatMessageContent'
import { Button } from '@/components/ui/button'
import { buildLLMPreferenceHeaders } from '@/lib/llm/clientPreference'
import { useLLMPreferenceStore } from '@/stores/llmPreferenceStore'
import type {
  JournalBootstrapPayload,
  JournalEntryType,
  JournalFocus,
  JournalPipelineStage,
  JournalQualityDimension,
  JournalSession,
  JournalSessionDetail,
} from '@/types/database'
import {
  JournalIcon,
  PipelineIcon,
  QualityIcon,
  ContextIcon,
  DraftIcon,
  ArchiveLibraryIcon,
  StageIcon,
} from './JournalIcons'

interface JournalViewerProps {
  agentId: string
  agentName: string
}

const premiumPanel = 'rounded-md border border-border/40 bg-card/40 backdrop-blur-md shadow-sm'
const subPanel = 'rounded-sm border border-border/30 bg-muted/20'
const labelStyle = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80'

const TYPE_LABELS: Record<JournalEntryType, string> = {
  daily_reflection: 'Daily Reflection',
  emotional_processing: 'Emotional Processing',
  goal_alignment: 'Goal Alignment',
  relationship_checkpoint: 'Relationship Checkpoint',
  memory_revisit: 'Memory Revisit',
  idea_capture: 'Idea Capture',
}

const FOCUS_LABELS: Record<JournalFocus, string> = {
  emotion: 'Emotion',
  memory: 'Memory',
  relationship: 'Relationship',
  goal: 'Goal',
  continuity: 'Continuity',
}

const DIMENSION_LABELS: Record<JournalQualityDimension, string> = {
  voiceConsistency: 'Voice',
  emotionalAuthenticity: 'Emotion',
  reflectionDepth: 'Depth',
  specificityGrounding: 'Grounding',
  continuity: 'Continuity',
  readability: 'Readability',
}

const STAGE_ORDER: JournalPipelineStage[] = [
  'prepare_context',
  'condition_voice',
  'draft_entry',
  'evaluate_quality',
  'repair_entry',
  'ready',
]

const STAGE_LABELS: Record<JournalPipelineStage, string> = {
  prepare_context: 'Prepare Context',
  condition_voice: 'Condition Voice',
  draft_entry: 'Draft Entry',
  evaluate_quality: 'Evaluate Quality',
  repair_entry: 'Repair Entry',
  ready: 'Ready',
  saved: 'Saved',
  failed: 'Failed',
}

function artifactBadgeTone(score?: number) {
  if (!score) return 'text-muted-foreground'
  if (score >= 85) return 'text-pastel-green'
  if (score >= 75) return 'text-pastel-yellow'
  return 'text-pastel-red'
}

async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text()
  const payload = raw ? JSON.parse(raw) as Record<string, unknown> : {}
  if (!response.ok) {
    throw new Error(typeof payload.error === 'string' ? payload.error : `Request failed with status ${response.status}`)
  }
  return payload as T
}

function formatDateTime(value?: string) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function getActiveStage(detail: JournalSessionDetail | null): JournalPipelineStage {
  if (!detail?.session) return 'prepare_context'
  if (detail.session.status === 'failed') return 'failed'
  if (detail.session.status === 'saved') return 'saved'
  const activeEvent = detail.pipelineEvents.find((event) => event.status === 'active')
  return activeEvent?.stage || detail.session.latestStage
}

function shouldShowRepair(detail: JournalSessionDetail | null) {
  return Boolean(detail?.pipelineEvents.some((event) => event.stage === 'repair_entry'))
}

function getPreferredSessionId(sessions: JournalBootstrapPayload['recentSessions']) {
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

function StageRail({ detail }: { detail: JournalSessionDetail | null }) {
  const activeStage = getActiveStage(detail)
  const showRepair = shouldShowRepair(detail)
  const orderedStages = STAGE_ORDER.filter((stage) => stage !== 'repair_entry' || showRepair)
  const activeIndex = orderedStages.indexOf(activeStage)

  return (
    <div className="flex gap-2 overflow-x-auto pb-1 w-full shrink-0">
      {orderedStages.map((stage, index) => {
        const isComplete = activeStage === 'saved' || (activeStage !== 'failed' && index < activeIndex)
        const isActive = stage === activeStage
        return (
          <div key={stage} className="min-w-[102px] flex-1">
            <div className={`mb-1 text-[9px] uppercase tracking-[0.18em] ${isActive ? 'text-pastel-blue font-bold' : 'text-muted-foreground'}`}>{stage.replaceAll('_', ' ')}</div>
            <div className="h-1.5 rounded-full bg-muted/40">
              <motion.div
                initial={false}
                animate={{ width: isComplete || isActive ? '100%' : '0%' }}
                transition={{ duration: 0.35 }}
                className={isActive ? 'h-full rounded-full bg-pastel-blue' : isComplete ? 'h-full rounded-full bg-pastel-green' : 'h-full rounded-full bg-muted/30'}
              />
            </div>
          </div>
        )
      })}
    </div>
  )
}

function DraftSkeleton({ stageLabel, stillWorking }: { stageLabel: string; stillWorking: boolean }) {
  const utilityCopy = stillWorking
    ? stageLabel === 'repair_entry'
      ? 'Repairing against journal rubric.'
      : stageLabel === 'evaluate_quality'
        ? 'Evaluating voice and continuity.'
        : 'Building from emotion and memory.'
    : `Working: ${STAGE_LABELS[stageLabel as JournalPipelineStage] || stageLabel.replaceAll('_', ' ')}`

  return (
    <div className="h-full flex flex-col items-center justify-center opacity-70 gap-6 max-w-sm mx-auto">
      <div className="relative flex h-16 w-16 items-center justify-center">
        <motion.div animate={{ rotate: -360 }} transition={{ duration: 5, repeat: Infinity, ease: "linear" }} className="absolute inset-0 rounded-full border border-dashed border-pastel-blue/30" />
        <motion.div animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.2, 0.6, 0.2] }} transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }} className="absolute inset-2 rounded-full border border-pastel-blue/20 bg-pastel-blue/5 shadow-[0_0_15px_rgba(137,180,250,0.15)]" />
        <DraftIcon className="relative h-5 w-5 text-pastel-blue" />
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
        <span className="h-2 w-2 animate-pulse rounded-full bg-pastel-blue" />
        <span>{utilityCopy}</span>
      </div>
    </div>
  )
}

export function JournalViewer({ agentId, agentName }: JournalViewerProps) {
  const selectedProvider = useLLMPreferenceStore((state) => state.provider)
  const [mode, setMode] = useState<'compose' | 'archive'>('compose')
  const [bootstrap, setBootstrap] = useState<JournalBootstrapPayload | null>(null)
  const [detail, setDetail] = useState<JournalSessionDetail | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [selectedArchiveId, setSelectedArchiveId] = useState<string | null>(null)
  const [type, setType] = useState<JournalEntryType>('daily_reflection')
  const [userNote, setUserNote] = useState('')
  const [focus, setFocus] = useState<JournalFocus[]>([])
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

      const payload = await parseResponse<JournalBootstrapPayload>(await fetch(`/api/agents/${agentId}/journal`, { cache: 'no-store' }))
      setBootstrap(payload)
      setType((current) => payload.allowedTypes.includes(current) ? current : payload.suggestedType)
      setUserNote((current) => current || payload.defaults.userNote)
      if (!activeSessionId) {
        setActiveSessionId(getPreferredSessionId(payload.recentSessions))
      }
      if (!selectedArchiveId) {
        setSelectedArchiveId(payload.recentSavedEntries[0]?.id || null)
      }
    } catch (nextError) {
      console.error('Failed to load journal workspace:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to load journal workspace')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [activeSessionId, agentId, selectedArchiveId])

  const loadSessionDetail = useCallback(async (sessionId: string) => {
    const payload = await parseResponse<JournalSessionDetail>(await fetch(`/api/agents/${agentId}/journal/sessions/${sessionId}`, { cache: 'no-store' }))
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

    const timer = window.setInterval(async () => {
      try {
        const payload = await loadSessionDetail(activeSessionId)
        if (!payload.session || payload.session.status !== 'generating') {
          setGenerating(false)
          void loadBootstrap(true)
        }
      } catch (pollError) {
        console.error('Failed to poll journal session:', pollError)
      }
    }, 1300)

    return () => window.clearInterval(timer)
  }, [activeSessionId, generating, loadBootstrap, loadSessionDetail])

  const latestEntry = useMemo(() => detail?.entries[0] || null, [detail])
  const isReady = detail?.session?.status === 'ready'
  const canSave = Boolean(isReady && detail?.session?.latestEvaluation?.pass && latestEntry)

  const createSession = async () => {
    setError(null)
    setSaveStatus(null)
    const payload = await parseResponse<{ session: JournalSession }>(await fetch(`/api/agents/${agentId}/journal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, userNote: userNote.trim() || undefined, focus }),
    }))
    setActiveSessionId(payload.session.id)
    setMode('compose')
    await loadBootstrap(true)
    return payload.session
  }

  const handleGenerate = async (regenerate = false) => {
    try {
      setGenerating(true)
      setError(null)
      setSaveStatus(null)

      const session = regenerate && activeSessionId
        ? detail?.session || await createSession()
        : await createSession()

      const placeholder: JournalSessionDetail = {
        session: {
          ...session,
          status: 'generating',
          latestStage: 'prepare_context',
        },
        entries: [],
        pipelineEvents: [],
      }
      setDetail(placeholder)
      setActiveSessionId(session.id)

      const generated = await parseResponse<JournalSessionDetail>(await fetch(`/api/agents/${agentId}/journal/sessions/${session.id}/generate`, {
        method: 'POST',
        headers: {
          ...buildLLMPreferenceHeaders(selectedProvider),
        },
      }))

      setDetail(generated)
      setGenerating(false)
      await loadBootstrap(true)
    } catch (nextError) {
      console.error('Failed to generate journal entry:', nextError)
      setGenerating(false)
      setError(nextError instanceof Error ? nextError.message : 'Failed to generate journal entry')
    }
  }

  const handleSave = async () => {
    if (!activeSessionId || !canSave) return
    try {
      setSaving(true)
      setSaveStatus('Saving reviewed entry…')
      const saved = await parseResponse<JournalSessionDetail>(await fetch(`/api/agents/${agentId}/journal/sessions/${activeSessionId}/save`, {
        method: 'POST',
      }))
      setDetail(saved)
      setSaveStatus('Entry saved to the private archive.')
      window.setTimeout(() => {
        void loadBootstrap(true)
      }, 650)
    } catch (nextError) {
      console.error('Failed to save journal entry:', nextError)
      setSaveStatus(null)
      setError(nextError instanceof Error ? nextError.message : 'Failed to save journal entry')
    } finally {
      setSaving(false)
    }
  }

  const selectedArchiveEntry = useMemo(() => {
    if (!bootstrap?.recentSavedEntries.length) return null
    return bootstrap.recentSavedEntries.find((entry) => entry.id === selectedArchiveId) || bootstrap.recentSavedEntries[0]
  }, [bootstrap?.recentSavedEntries, selectedArchiveId])

  if (loading && !bootstrap) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex flex-col items-center gap-6">
          <div className="relative flex h-24 w-24 items-center justify-center">
            {/* Outer spinning dash ring */}
            <motion.div
              animate={{ rotate: -360 }}
              transition={{ duration: 5, repeat: Infinity, ease: "linear" }}
              className="absolute inset-0 rounded-full border border-dashed border-pastel-blue/30"
            />
            {/* Inner pulsing ring */}
            <motion.div
              animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-2 rounded-full border border-pastel-blue/20 bg-pastel-blue/5 shadow-[0_0_15px_rgba(137,180,250,0.15)]"
            />
            {/* Center Icon */}
            <JournalIcon className="relative h-8 w-8 text-pastel-blue" />
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-pastel-blue">Initializing Journal Workspace</div>
            <div className="text-xs text-muted-foreground/80">Synchronizing private reflections...</div>
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
          <div className="rounded-md bg-pastel-blue/10 p-2.5">
            <JournalIcon className="h-5 w-5 text-pastel-blue" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground leading-tight tracking-tight">
              {agentName}&apos;s Personal Journal
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
              Private Reflections & Archives
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
              <DraftIcon className="h-3.5 w-3.5" />
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
                  <DraftIcon className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Compose Pipeline</span>
                </div>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin flex-1">
                <div className="space-y-1.5">
                  <div className={labelStyle}>Types</div>
                  <div className="mt-2 space-y-2">
                    {bootstrap?.allowedTypes.map((entryType) => (
                      <button
                        key={entryType}
                        type="button"
                        disabled={generating}
                        onClick={() => setType(entryType)}
                        className={type === entryType ? 'w-full rounded-sm border border-pastel-blue/40 bg-pastel-blue/10 px-3 py-2 text-left text-[13px] text-pastel-blue font-bold shadow-sm transition-all' : 'w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-2 text-left text-[13px] text-muted-foreground hover:border-pastel-blue/20 hover:text-foreground transition-all'}
                      >
                        {TYPE_LABELS[entryType]}
                      </button>
                    ))}
                  </div>
                  <p className="mt-2 text-[10px] text-muted-foreground italic">Suggested: {bootstrap ? TYPE_LABELS[bootstrap.suggestedType] : 'Daily Reflection'}</p>
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className={labelStyle}>Optional Note</div>
                  <textarea
                    value={userNote}
                    onChange={(event) => setUserNote(event.target.value)}
                    disabled={generating}
                    rows={4}
                    className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-2 text-[12px] text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-pastel-blue/50 resize-none"
                    placeholder="Anchor the draft to one tension, memory, relationship, or goal."
                  />
                </div>

                <div className="space-y-1.5 pt-2">
                  <div className={labelStyle}>Focus</div>
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {(Object.keys(FOCUS_LABELS) as JournalFocus[]).map((chip) => {
                      const active = focus.includes(chip)
                      return (
                        <button
                          key={chip}
                          type="button"
                          disabled={generating}
                          onClick={() => setFocus((current) => active ? current.filter((entry) => entry !== chip) : [...current, chip].slice(0, 4))}
                          className={active ? 'rounded-md border border-pastel-blue/40 bg-pastel-blue/10 px-2.5 py-1 text-[11px] font-bold text-pastel-blue' : 'rounded-md border border-border/30 bg-muted/5 px-2.5 py-1 text-[11px] font-medium text-muted-foreground hover:border-pastel-blue/20 hover:text-foreground transition-all'}
                        >
                          {FOCUS_LABELS[chip]}
                        </button>
                      )
                    })}
                  </div>
                </div>
              </div>
              <div className="p-3 shrink-0 border-t border-border/30 bg-muted/5">
                <div className="flex gap-2">
                  <Button className="h-8 flex-1 gap-2 bg-pastel-blue hover:bg-pastel-blue/90 text-primary-foreground font-bold text-[10px] uppercase tracking-wider" onClick={() => void handleGenerate(false)} disabled={generating || saving}>
                    {generating ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <DraftIcon className="h-3.5 w-3.5" />}
                    Generate
                  </Button>
                  <Button variant="outline" className="h-8 flex-1 gap-2 font-bold text-[10px] uppercase tracking-wider border-border/40" onClick={() => void handleGenerate(true)} disabled={generating || saving || !detail?.session}>
                    <RefreshCw className="h-3.5 w-3.5" />
                    Regen
                  </Button>
                  <Button variant="secondary" className="h-8 w-10 shrink-0 p-0 border border-border/40 bg-muted hover:bg-muted" onClick={() => void handleSave()} disabled={!canSave || saving || generating}>
                    {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Save className={`h-3.5 w-3.5 ${canSave ? 'text-pastel-green' : 'text-muted-foreground'}`} />}
                  </Button>
                </div>
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
                 {bootstrap?.recentSavedEntries.length ? bootstrap.recentSavedEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedArchiveId(entry.id)}
                    className={`w-full text-left p-2.5 rounded-sm border transition-all duration-200 ${
                      selectedArchiveId === entry.id ? 'border-pastel-blue/40 bg-pastel-blue/5' : 'border-border/30 bg-muted/5 hover:border-pastel-blue/20'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-[11px] font-bold text-foreground truncate">{entry.title}</span>
                    </div>
                    <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{TYPE_LABELS[entry.type]}</div>
                  </button>
                )) : (
                  <div className="rounded-sm border border-dashed border-border/30 px-3 py-6 text-sm text-muted-foreground text-center">
                    No saved entries yet.
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
              {bootstrap?.recentSessions.length ? bootstrap.recentSessions.slice(0, 5).map((session) => (
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
                    <span className="text-muted-foreground uppercase text-[8px]">{STAGE_LABELS[session.latestStage] || session.status}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate opacity-80 mt-0.5">{formatDateTime(session.updatedAt)}</div>
                </button>
              )) : (
                <div className="p-3 text-[10px] text-muted-foreground italic text-center">No journal sessions.</div>
              )}
            </div>
          </section>
        </div>

        {/* Column 2: The Stage (Content Reader) */}
        <section className={`${premiumPanel} flex flex-col min-h-0 overflow-hidden`}>
          <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <StageIcon className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Journal Viewer</span>
            </div>
            {mode === 'compose' && detail?.session && (
              <div className="flex gap-2 items-center">
                 <span className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground text-opacity-70 flex items-center gap-2">
                   {detail.session.status}
                 </span>
              </div>
            )}
          </div>

          <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
            {mode === 'compose' ? (
              detail?.session ? (
                generating || detail.session.status === 'generating' ? (
                  <DraftSkeleton stageLabel={getActiveStage(detail)} stillWorking={stillWorking} />
                ) : latestEntry ? (
                  <article className="w-full space-y-8">
                    <header className="space-y-4 pb-8 border-b border-border/20">
                      <div className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest text-muted-foreground mb-4">
                        <span className="text-pastel-blue">{TYPE_LABELS[latestEntry.type]}</span>
                        <span className="opacity-50">/</span>
                        <span>{latestEntry.status}</span>
                      </div>
                      <h1 className="text-4xl font-black text-foreground tracking-tight">
                        {latestEntry.title}
                      </h1>
                      <p className="text-sm text-muted-foreground leading-relaxed italic opacity-80">
                        {latestEntry.summary}
                      </p>
                      <div className="flex flex-wrap gap-4 text-[10px] font-bold uppercase tracking-wider text-muted-foreground mt-4">
                        <span className="bg-muted/30 px-2 py-1 rounded-sm">{formatDateTime(latestEntry.updatedAt)}</span>
                        <span className="bg-muted/30 px-2 py-1 rounded-sm">{latestEntry.mood.label}</span>
                        <span className="bg-muted/30 px-2 py-1 rounded-sm">Version {latestEntry.version}</span>
                      </div>
                    </header>
                    <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-p:text-muted-foreground/90 prose-p:text-base">
                      <ChatMessageContent content={latestEntry.content} blocks={latestEntry.render.blocks} />
                    </div>
                  </article>
                ) : (
                  <div className="h-full flex flex-col items-center justify-center opacity-50 grayscale">
                    <DraftIcon className="h-10 w-10 mb-4 text-muted-foreground" />
                    <div className="text-sm font-semibold">{detail.session.status === 'failed' ? 'Session Ended' : 'No Draft Ready'}</div>
                    <div className="text-xs text-muted-foreground mt-1">
                      {detail.session.failureReason || 'This session has no generated draft yet.'}
                    </div>
                  </div>
                )
              ) : (
                <div className="h-full flex flex-col items-center justify-center opacity-50 grayscale">
                  <DraftIcon className="h-10 w-10 mb-4 text-muted-foreground" />
                  <div className="text-sm font-semibold">Start Compose Pipeline</div>
                  <div className="text-xs text-muted-foreground mt-1">Generate a journal session to enter active workspace.</div>
                </div>
              )
            ) : selectedArchiveEntry ? (
               <article className="w-full space-y-8">
                <header className="space-y-4 pb-8 border-b border-border/20">
                  <div className="text-[10px] font-bold uppercase tracking-widest text-pastel-blue">{TYPE_LABELS[selectedArchiveEntry.type]}</div>
                  <h1 className="text-4xl font-black text-foreground tracking-tight">
                    {selectedArchiveEntry.title}
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed italic opacity-80">
                    {selectedArchiveEntry.summary}
                  </p>
                </header>
                <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-p:text-muted-foreground/90 prose-p:text-base">
                  <ChatMessageContent content={selectedArchiveEntry.content} blocks={selectedArchiveEntry.render.blocks} />
                </div>
              </article>
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-50 grayscale">
                 <ArchiveLibraryIcon className="h-10 w-10 mb-4 text-muted-foreground" />
                 <div className="text-sm font-semibold">No Archive Data</div>
                 <div className="text-xs text-muted-foreground mt-1">Save a passing entry to populate the archive.</div>
              </div>
            )}
          </div>
           {/* Status Bar / Trace */}
          {mode === 'compose' && (
            <div className="border-t border-border/40 bg-muted/5 p-3 shrink-0 flex items-center justify-center">
               <StageRail detail={detail} />
            </div>
          )}
        </section>

        {/* Column 3: The Inspector (Stats & Evaluation) */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden`}>
            <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
               <div className="flex items-center gap-2">
                 <QualityIcon className="h-4 w-4" />
                 <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Inspector</span>
               </div>
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6">
              {mode === 'compose' ? (
                <>
                  <div>
                    <div className={labelStyle}>Quality Review</div>
                    {generating || detail?.session?.status === 'generating' ? (
                      <div className="mt-3 space-y-2">
                        {[0, 1, 2, 3].map((row) => (
                          <div key={row} className="h-9 animate-pulse rounded-sm bg-muted/20" />
                        ))}
                      </div>
                    ) : detail?.session?.latestEvaluation ? (
                      <div className="mt-3 space-y-3">
                        <div className={detail.session.latestEvaluation.pass ? 'rounded-md border border-pastel-green/40 bg-pastel-green/5 p-4 text-center pb-5' : 'rounded-md border border-pastel-red/40 bg-pastel-red/5 p-4 text-center pb-5'}>
                          <div className={labelStyle}>Final Score</div>
                          <div className="flex justify-center items-center gap-2 mt-2">
                            <span className={`text-4xl font-black tracking-tighter ${detail.session.latestEvaluation.pass ? 'text-pastel-green' : 'text-pastel-red'}`}>{detail.session.latestEvaluation.overallScore}</span>
                            {detail.session.latestEvaluation.pass ? <CheckCircle2 className="h-6 w-6 text-pastel-green" /> : <AlertTriangle className="h-6 w-6 text-pastel-red" />}
                          </div>
                          <p className="mt-3 text-[10px] opacity-80 tracking-wide font-medium leading-relaxed max-w-[200px] mx-auto text-muted-foreground">{detail.session.latestEvaluation.evaluatorSummary}</p>
                        </div>
                        <div className="grid grid-cols-2 gap-2 mt-2">
                          {Object.entries(detail.session.latestEvaluation.dimensions).map(([dimension, score]) => (
                            <div key={dimension} className={`${subPanel} p-2.5 hover:border-border/40 transition-colors`}>
                              <div className="flex items-center justify-between text-[11px] font-bold">
                                <span className="text-muted-foreground uppercase opacity-80 text-[9px]">{DIMENSION_LABELS[dimension as JournalQualityDimension]}</span>
                                <span className={artifactBadgeTone(score.score)}>{score.score}</span>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-muted-foreground italic border border-dashed border-border/30 rounded-sm p-4 text-center">Generate a draft to see rubric.</div>
                    )}
                  </div>

                  <div className="pt-2">
                    <div className={labelStyle}>Structured Insights</div>
                    {latestEntry ? (
                      <div className="mt-3 space-y-3 bg-muted/20 border border-border/30 rounded-sm p-4">
                        {latestEntry.structured.insights.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-pastel-purple">Key Insights</div>
                             <ul className="space-y-1.5 list-none m-0 p-0">
                              {latestEntry.structured.insights.slice(0, 3).map((item) => (
                                <li key={item} className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2 m-0 p-0">
                                  <span className="mt-1.5 h-1 w-1 rounded-full shrink-0 bg-pastel-purple" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                        <div className="h-px bg-border/40 my-3"></div>
                        {latestEntry.structured.nextActions.length > 0 && (
                          <div className="space-y-1.5">
                            <div className="text-[9px] font-bold uppercase tracking-wider text-pastel-green">Next Actions</div>
                             <ul className="space-y-1.5 list-none m-0 p-0">
                              {latestEntry.structured.nextActions.slice(0, 3).map((item) => (
                                <li key={item} className="text-[11px] text-muted-foreground leading-relaxed flex items-start gap-2 m-0 p-0">
                                  <span className="mt-1.5 h-1 w-1 rounded-full shrink-0 bg-pastel-green" />
                                  {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="mt-3 text-xs text-muted-foreground italic border border-dashed border-border/30 rounded-sm p-4 text-center">Extraction applies to generated drafts.</div>
                    )}
                  </div>
                </>
              ) : selectedArchiveEntry ? (
                 <>
                   <div className="space-y-3">
                    <div className={labelStyle}>Archive Detail</div>
                     <div className={`${subPanel} px-3 py-3`}>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Saved At</div>
                      <div className="mt-1 text-xs font-bold text-foreground">{formatDateTime(selectedArchiveEntry.savedAt || selectedArchiveEntry.updatedAt)}</div>
                    </div>
                    <div className={`${subPanel} px-3 py-3`}>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Themes</div>
                      <div className="mt-2 flex flex-wrap gap-1.5">
                        {selectedArchiveEntry.structured.themes.length ? selectedArchiveEntry.structured.themes.map((theme) => (
                          <span key={theme} className="rounded-sm border border-border/40 bg-muted/20 px-2 py-0.5 text-[10px] text-foreground font-medium">{theme}</span>
                        )) : <span className="text-[10px] text-muted-foreground">None</span>}
                      </div>
                    </div>
                    <div className={`${subPanel} px-3 py-3`}>
                      <div className="text-[9px] font-bold uppercase tracking-wider text-muted-foreground">Summary</div>
                      <div className="mt-1 text-xs text-muted-foreground leading-relaxed font-medium">{selectedArchiveEntry.structured.conciseSummary}</div>
                    </div>
                   </div>
                 </>
              ) : null}
            </div>
          </section>

          {/* Context Viewer */}
          <section className={`${premiumPanel} h-[180px] flex flex-col overflow-hidden shrink-0`}>
            <div className="border-b border-border/40 bg-muted/10 px-3 py-2 flex items-center gap-2">
              <ContextIcon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Context Snapshot</span>
            </div>
            <div className="p-4 text-[10px] space-y-3 overflow-y-auto scrollbar-thin">
               {mode === 'compose' ? (
                 detail?.session?.contextPacket?.selectedSignals.length ? (
                    <div className="space-y-3">
                      {detail.session.contextPacket.selectedSignals.slice(0, 3).map((signal) => (
                        <div key={signal.id} className="border-l-[3px] border-pastel-blue/40 pl-3">
                          <div className="font-bold text-foreground uppercase tracking-widest text-[9px]">{signal.label}</div>
                          <div className="text-muted-foreground truncate opacity-80 mt-1">{signal.snippet}</div>
                        </div>
                      ))}
                    </div>
                 ) : (
                    <div className="text-muted-foreground italic text-center py-4">Hydrates during generation</div>
                 )
               ) : (
                 <div className="space-y-2">
                  <div className="flex justify-between items-center bg-muted/20 p-2 rounded-sm">
                    <span className="text-muted-foreground font-bold tracking-wider uppercase text-[9px]">Session ID</span>
                    <span className="font-mono text-foreground truncate w-[100px] text-right">{selectedArchiveEntry?.id || 'N/A'}</span>
                  </div>
                 </div>
               )}
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}
