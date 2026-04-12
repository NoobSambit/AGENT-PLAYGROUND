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

interface JournalViewerProps {
  agentId: string
  agentName: string
}

const premiumPanel = 'rounded-sm border border-zinc-800/60 bg-zinc-950/55 shadow-2xl backdrop-blur-xl'
const subPanel = 'rounded-sm border border-zinc-800/50 bg-zinc-900/30'
const labelStyle = 'text-[10px] font-bold uppercase tracking-[0.22em] text-zinc-500'

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
    <div className={`${subPanel} px-3 py-3`}>
      <div className="mb-2 flex items-center justify-between">
        <div className={labelStyle}>Pipeline</div>
        <div className="text-[11px] text-zinc-400">{STAGE_LABELS[activeStage] || 'Preparing'}</div>
      </div>
      <div className="flex gap-2 overflow-x-auto pb-1">
        {orderedStages.map((stage, index) => {
          const isComplete = activeStage === 'saved' || (activeStage !== 'failed' && index < activeIndex)
          const isActive = stage === activeStage
          return (
            <div key={stage} className="min-w-[108px] flex-1">
              <div className="mb-1 text-[10px] uppercase tracking-[0.18em] text-zinc-500">{stage.replaceAll('_', ' ')}</div>
              <div className="h-1.5 rounded-full bg-zinc-800">
                <motion.div
                  initial={false}
                  animate={{ width: isComplete || isActive ? '100%' : '0%' }}
                  transition={{ duration: 0.35 }}
                  className={isActive ? 'h-full rounded-full bg-amber-300' : isComplete ? 'h-full rounded-full bg-emerald-400' : 'h-full rounded-full bg-zinc-700'}
                />
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function DraftSkeleton({ stageLabel, stillWorking }: { stageLabel: string; stillWorking: boolean }) {
  const utilityCopy = stillWorking
    ? stageLabel === 'repair_entry'
      ? 'Repairing weak sections against the journal rubric.'
      : stageLabel === 'evaluate_quality'
        ? 'Still evaluating voice fit and continuity against selected context.'
        : 'Still building the draft from current emotional and memory evidence.'
    : `Working: ${STAGE_LABELS[stageLabel as JournalPipelineStage] || stageLabel.replaceAll('_', ' ')}`

  return (
    <div className="space-y-5">
      <div className={`${labelStyle}`}>Draft In Progress</div>
      <div className="space-y-3">
        <div className="h-8 w-2/3 animate-pulse rounded-sm bg-zinc-800" />
        <div className="h-4 w-1/3 animate-pulse rounded-sm bg-zinc-900" />
      </div>
      <div className="space-y-3">
        {[0, 1, 2, 3, 4].map((row) => (
          <div
            key={row}
            className="h-4 animate-pulse rounded-sm bg-gradient-to-r from-zinc-900 via-zinc-800 to-zinc-900"
            style={{ width: `${row === 4 ? 62 : row % 2 === 0 ? 100 : 92}%` }}
          />
        ))}
      </div>
      <div className="flex items-center gap-2 text-sm text-zinc-400">
        <span className="h-2 w-2 animate-pulse rounded-full bg-amber-300" />
        <span>{utilityCopy}</span>
      </div>
    </div>
  )
}

function MetricPill({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-sm border border-zinc-800 bg-zinc-900/40 px-3 py-2">
      <div className={labelStyle}>{label}</div>
      <div className="mt-1 text-sm font-semibold text-zinc-100">{value}</div>
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
        setActiveSessionId(payload.recentSessions[0]?.id || null)
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

  if (loading) {
    return <div className={`${premiumPanel} p-6 text-sm text-zinc-400`}>Loading journal workspace…</div>
  }

  return (
    <div className="space-y-4">
      <div className={`${premiumPanel} p-4 sm:p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <div className={labelStyle}>Journal Workspace</div>
            <h3 className="mt-1 text-xl font-semibold text-zinc-100">{agentName}</h3>
            <p className="mt-1 max-w-2xl text-sm text-zinc-400">
              Private session-based journaling with review, staged generation, and saved-entry-only archive history.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMode('compose')}
              className={mode === 'compose' ? 'rounded-sm bg-amber-300 px-3 py-2 text-xs font-semibold text-zinc-950' : 'rounded-sm border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300'}
            >
              Compose
            </button>
            <button
              type="button"
              onClick={() => setMode('archive')}
              className={mode === 'archive' ? 'rounded-sm bg-amber-300 px-3 py-2 text-xs font-semibold text-zinc-950' : 'rounded-sm border border-zinc-800 px-3 py-2 text-xs font-semibold text-zinc-300'}
            >
              Archive
            </button>
            <Button variant="outline" size="sm" onClick={() => void loadBootstrap(true)} disabled={refreshing}>
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>

        <div className="mt-4 grid gap-2 sm:grid-cols-4">
          <MetricPill label="Saved" value={bootstrap?.agent.journalCount || 0} />
          <MetricPill label="Recent Sessions" value={bootstrap?.metrics.totalSessions || 0} />
          <MetricPill label="Ready To Save" value={bootstrap?.metrics.readyToSaveCount || 0} />
          <MetricPill label="Failed" value={bootstrap?.metrics.failedSessions || 0} />
        </div>
      </div>

      {mode === 'compose' && <StageRail detail={detail} />}

      {error ? (
        <div className="rounded-sm border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-100">
          {error}
        </div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
        <div className={`${premiumPanel} p-4`}>
          {mode === 'compose' ? (
            <div className="space-y-4">
              <div>
                <div className={labelStyle}>Compose</div>
                <div className="mt-2 space-y-2">
                  {bootstrap?.allowedTypes.map((entryType) => (
                    <button
                      key={entryType}
                      type="button"
                      disabled={generating}
                      onClick={() => setType(entryType)}
                      className={type === entryType ? 'w-full rounded-sm border border-amber-300/40 bg-amber-300/10 px-3 py-2 text-left text-sm text-zinc-100' : 'w-full rounded-sm border border-zinc-800 bg-zinc-900/30 px-3 py-2 text-left text-sm text-zinc-400'}
                    >
                      {TYPE_LABELS[entryType]}
                    </button>
                  ))}
                </div>
                <p className="mt-2 text-xs text-zinc-500">Suggested: {bootstrap ? TYPE_LABELS[bootstrap.suggestedType] : 'Daily Reflection'}</p>
              </div>

              <div>
                <div className={labelStyle}>Optional Note</div>
                <textarea
                  value={userNote}
                  onChange={(event) => setUserNote(event.target.value)}
                  disabled={generating}
                  rows={5}
                  className="mt-2 w-full rounded-sm border border-zinc-800 bg-zinc-950/70 px-3 py-2 text-sm text-zinc-100 outline-none placeholder:text-zinc-600"
                  placeholder="Anchor the draft to one tension, memory, relationship, or goal."
                />
              </div>

              <div>
                <div className={labelStyle}>Focus</div>
                <div className="mt-2 flex flex-wrap gap-2">
                  {(Object.keys(FOCUS_LABELS) as JournalFocus[]).map((chip) => {
                    const active = focus.includes(chip)
                    return (
                      <button
                        key={chip}
                        type="button"
                        disabled={generating}
                        onClick={() => setFocus((current) => active ? current.filter((entry) => entry !== chip) : [...current, chip].slice(0, 4))}
                        className={active ? 'rounded-full border border-amber-300/40 bg-amber-300/10 px-3 py-1.5 text-xs font-semibold text-zinc-100' : 'rounded-full border border-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-400'}
                      >
                        {FOCUS_LABELS[chip]}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="space-y-2 pt-2">
                <Button className="w-full" onClick={() => void handleGenerate(false)} disabled={generating || saving}>
                  {generating ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                  Generate
                </Button>
                <Button variant="outline" className="w-full" onClick={() => void handleGenerate(true)} disabled={generating || saving || !detail?.session}>
                  Regenerate
                </Button>
                <Button variant="secondary" className="w-full" onClick={() => void handleSave()} disabled={!canSave || saving || generating}>
                  {saving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Save className="mr-2 h-4 w-4" />}
                  Save Entry
                </Button>
                {saveStatus ? <div className="text-xs text-zinc-400">{saveStatus}</div> : null}
              </div>

              <div className="pt-4">
                <div className={labelStyle}>Recent Sessions</div>
                <div className="mt-2 space-y-2">
                  {bootstrap?.recentSessions.length ? bootstrap.recentSessions.map((session) => (
                    <button
                      key={session.id}
                      type="button"
                      onClick={() => setActiveSessionId(session.id)}
                      className={activeSessionId === session.id ? 'w-full rounded-sm border border-zinc-700 bg-zinc-900/60 px-3 py-2 text-left' : 'w-full rounded-sm border border-zinc-900 bg-zinc-950/40 px-3 py-2 text-left'}
                    >
                      <div className="text-xs text-zinc-500">{TYPE_LABELS[session.type]}</div>
                      <div className="mt-1 text-sm font-medium text-zinc-100">{STAGE_LABELS[session.latestStage] || session.status}</div>
                      <div className="mt-1 text-xs text-zinc-500">{formatDateTime(session.updatedAt)}</div>
                    </button>
                  )) : (
                    <div className="rounded-sm border border-dashed border-zinc-800 px-3 py-5 text-sm text-zinc-500">
                      No journal sessions yet.
                    </div>
                  )}
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div>
                <div className={labelStyle}>Archive</div>
                <p className="mt-2 text-sm text-zinc-400">Only saved V2 journal entries appear here and feed downstream systems.</p>
              </div>
              <div className="space-y-2">
                {bootstrap?.recentSavedEntries.length ? bootstrap.recentSavedEntries.map((entry) => (
                  <button
                    key={entry.id}
                    type="button"
                    onClick={() => setSelectedArchiveId(entry.id)}
                    className={selectedArchiveId === entry.id ? 'w-full rounded-sm border border-zinc-700 bg-zinc-900/60 px-3 py-3 text-left' : 'w-full rounded-sm border border-zinc-900 bg-zinc-950/40 px-3 py-3 text-left'}
                  >
                    <div className="text-xs text-zinc-500">{TYPE_LABELS[entry.type]}</div>
                    <div className="mt-1 text-sm font-semibold text-zinc-100">{entry.title}</div>
                    <div className="mt-1 line-clamp-2 text-xs text-zinc-400">{entry.summary}</div>
                  </button>
                )) : (
                  <div className="rounded-sm border border-dashed border-zinc-800 px-3 py-6 text-sm text-zinc-500">
                    No saved entries yet.
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className={`${premiumPanel} p-5`}>
          {mode === 'compose' ? (
            detail?.session ? (
              generating || detail.session.status === 'generating' ? (
                <DraftSkeleton stageLabel={getActiveStage(detail)} stillWorking={stillWorking} />
              ) : latestEntry ? (
                <div className="space-y-5">
                  <div className="space-y-2 border-b border-zinc-800/70 pb-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs uppercase tracking-[0.18em] text-zinc-500">
                      <span>{TYPE_LABELS[latestEntry.type]}</span>
                      <span className="text-zinc-700">/</span>
                      <span>{latestEntry.status}</span>
                    </div>
                    <h2 className="max-w-3xl font-serif text-3xl leading-tight text-zinc-100">{latestEntry.title}</h2>
                    <p className="max-w-3xl text-sm text-zinc-400">{latestEntry.summary}</p>
                    <div className="flex flex-wrap gap-4 text-xs text-zinc-500">
                      <span>{formatDateTime(latestEntry.updatedAt)}</span>
                      <span>{latestEntry.mood.label}</span>
                      <span>Version {latestEntry.version}</span>
                    </div>
                  </div>
                  <article className="max-w-3xl font-serif text-[15px] leading-8 text-zinc-200">
                    <ChatMessageContent content={latestEntry.content} blocks={latestEntry.render.blocks} />
                  </article>
                </div>
              ) : (
                <div className="text-sm text-zinc-500">This session has no generated draft yet.</div>
              )
            ) : (
              <div className="text-sm text-zinc-500">Generate a journal session to enter the active workspace.</div>
            )
          ) : selectedArchiveEntry ? (
            <div className="space-y-5">
              <div className="space-y-2 border-b border-zinc-800/70 pb-4">
                <div className="text-xs uppercase tracking-[0.18em] text-zinc-500">{TYPE_LABELS[selectedArchiveEntry.type]}</div>
                <h2 className="font-serif text-3xl leading-tight text-zinc-100">{selectedArchiveEntry.title}</h2>
                <p className="text-sm text-zinc-400">{selectedArchiveEntry.summary}</p>
              </div>
              <article className="max-w-3xl font-serif text-[15px] leading-8 text-zinc-200">
                <ChatMessageContent content={selectedArchiveEntry.content} blocks={selectedArchiveEntry.render.blocks} />
              </article>
            </div>
          ) : (
            <div className="text-sm text-zinc-500">Save a passing entry to populate the archive.</div>
          )}
        </div>

        <div className={`${premiumPanel} p-4`}>
          {mode === 'compose' ? (
            <div className="space-y-4">
              <div>
                <div className={labelStyle}>Quality Gate</div>
                {generating || detail?.session?.status === 'generating' ? (
                  <div className="mt-2 space-y-2">
                    {[0, 1, 2, 3].map((row) => (
                      <div key={row} className="h-9 animate-pulse rounded-sm bg-zinc-900/70" />
                    ))}
                  </div>
                ) : detail?.session?.latestEvaluation ? (
                  <div className="mt-2 space-y-2">
                    <div className={detail.session.latestEvaluation.pass ? 'rounded-sm border border-emerald-500/30 bg-emerald-500/10 px-3 py-3 text-sm text-emerald-100' : 'rounded-sm border border-amber-500/30 bg-amber-500/10 px-3 py-3 text-sm text-amber-50'}>
                      <div className="flex items-center gap-2">
                        {detail.session.latestEvaluation.pass ? <CheckCircle2 className="h-4 w-4" /> : <AlertTriangle className="h-4 w-4" />}
                        <span>Overall score {detail.session.latestEvaluation.overallScore}</span>
                      </div>
                      <p className="mt-2 text-xs opacity-80">{detail.session.latestEvaluation.evaluatorSummary}</p>
                    </div>
                    {Object.entries(detail.session.latestEvaluation.dimensions).map(([dimension, score]) => (
                      <div key={dimension} className={`${subPanel} px-3 py-3`}>
                        <div className="flex items-center justify-between text-sm text-zinc-200">
                          <span>{DIMENSION_LABELS[dimension as JournalQualityDimension]}</span>
                          <span>{score.score}</span>
                        </div>
                        <div className="mt-2 h-1.5 rounded-full bg-zinc-800">
                          <div className="h-full rounded-full bg-amber-300" style={{ width: `${score.score}%` }} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-zinc-500">Generate a draft to see the journal rubric.</div>
                )}
              </div>

              <div>
                <div className={labelStyle}>Selected Context</div>
                {generating || detail?.session?.status === 'generating' ? (
                  <div className="mt-2 space-y-2">
                    {[0, 1, 2].map((row) => (
                      <div key={row} className="h-16 animate-pulse rounded-sm bg-zinc-900/70" />
                    ))}
                  </div>
                ) : detail?.session?.contextPacket?.selectedSignals.length ? (
                  <div className="mt-2 space-y-2">
                    {detail.session.contextPacket.selectedSignals.slice(0, 5).map((signal) => (
                      <div key={signal.id} className={`${subPanel} px-3 py-3`}>
                        <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">{signal.label}</div>
                        <div className="mt-1 text-sm text-zinc-200">{signal.snippet}</div>
                        <div className="mt-2 text-xs text-zinc-500">{signal.reason}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-zinc-500">Context will hydrate stage by stage while generation runs.</div>
                )}
              </div>

              <div>
                <div className={labelStyle}>Voice Conditioning</div>
                {detail?.session?.voicePacket ? (
                  <div className={`${subPanel} mt-2 space-y-2 px-3 py-3 text-sm text-zinc-300`}>
                    <p>{detail.session.voicePacket.communicationFingerprintSummary || detail.session.voicePacket.linguisticProfileSummary}</p>
                    <p className="text-zinc-500">{detail.session.voicePacket.communicationStyleSummary}</p>
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-zinc-500">Voice packet will appear once context conditioning completes.</div>
                )}
              </div>

              <div>
                <div className={labelStyle}>Structured Reflection</div>
                {latestEntry ? (
                  <div className="mt-2 space-y-3">
                    {latestEntry.structured.insights.length ? (
                      <div className={`${subPanel} px-3 py-3`}>
                        <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Insights</div>
                        <div className="mt-2 space-y-1 text-sm text-zinc-200">
                          {latestEntry.structured.insights.slice(0, 3).map((item) => <div key={item}>• {item}</div>)}
                        </div>
                      </div>
                    ) : null}
                    {latestEntry.structured.openQuestions.length ? (
                      <div className={`${subPanel} px-3 py-3`}>
                        <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Open Questions</div>
                        <div className="mt-2 space-y-1 text-sm text-zinc-200">
                          {latestEntry.structured.openQuestions.slice(0, 3).map((item) => <div key={item}>• {item}</div>)}
                        </div>
                      </div>
                    ) : null}
                    {latestEntry.structured.nextActions.length ? (
                      <div className={`${subPanel} px-3 py-3`}>
                        <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Next Actions</div>
                        <div className="mt-2 space-y-1 text-sm text-zinc-200">
                          {latestEntry.structured.nextActions.slice(0, 3).map((item) => <div key={item}>• {item}</div>)}
                        </div>
                      </div>
                    ) : null}
                  </div>
                ) : (
                  <div className="mt-2 text-sm text-zinc-500">Structured extraction appears after draft generation.</div>
                )}
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className={labelStyle}>Archive Detail</div>
              {selectedArchiveEntry ? (
                <>
                  <div className={`${subPanel} px-3 py-3`}>
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Saved At</div>
                    <div className="mt-2 text-sm text-zinc-200">{formatDateTime(selectedArchiveEntry.savedAt || selectedArchiveEntry.updatedAt)}</div>
                  </div>
                  <div className={`${subPanel} px-3 py-3`}>
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Themes</div>
                    <div className="mt-2 flex flex-wrap gap-2 text-xs text-zinc-300">
                      {selectedArchiveEntry.structured.themes.length ? selectedArchiveEntry.structured.themes.map((theme) => (
                        <span key={theme} className="rounded-full border border-zinc-800 px-2 py-1">{theme}</span>
                      )) : 'No themes extracted.'}
                    </div>
                  </div>
                  <div className={`${subPanel} px-3 py-3`}>
                    <div className="text-xs uppercase tracking-[0.16em] text-zinc-500">Summary</div>
                    <div className="mt-2 text-sm text-zinc-200">{selectedArchiveEntry.structured.conciseSummary}</div>
                  </div>
                </>
              ) : (
                <div className="text-sm text-zinc-500">Choose a saved entry to inspect archive metadata.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
