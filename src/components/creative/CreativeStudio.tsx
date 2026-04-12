'use client'

import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  RefreshCw,
} from 'lucide-react'
import { ChatMessageContent } from '@/components/chat/ChatMessageContent'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { buildLLMPreferenceHeaders, getClientModelForProvider, LLM_PROVIDER_LABELS } from '@/lib/llm/clientPreference'
import { useLLMPreferenceStore } from '@/stores/llmPreferenceStore'
import type {
  CreativeArtifact,
  CreativeBrief,
  CreativeContextSignal,
  CreativeFormat,
  CreativeLength,
  CreativeLibraryItem,
  CreativePipelineEvent,
  CreativeRubricDimension,
  CreativeRubricEvaluation,
  CreativeSession,
  CreativeTone,
} from '@/types/database'
import {
  ArtifactIcon,
  BriefIcon,
  ContextIcon,
  GenerateIcon,
  LibraryIcon,
  MetricIcon,
  PipelineIcon,
  PublishIcon,
  QualityIcon,
  SaveIcon,
  StudioIcon,
} from './CreativeIcons'

interface CreativeStudioProps {
  agentId: string
  agentName: string
}

interface CreativeBootstrapPayload {
  agent: {
    id: string
    name: string
    creativeWorks: number
  }
  formats: CreativeFormat[]
  tones: CreativeTone[]
  lengths: CreativeLength[]
  defaults: CreativeBrief
  candidateSignals: CreativeContextSignal[]
  recentSessions: CreativeSession[]
  library: CreativeLibraryItem[]
}

interface CreativeSessionDetail {
  session: CreativeSession
  artifacts: CreativeArtifact[]
  pipelineEvents: CreativePipelineEvent[]
}

const premiumPanel = 'rounded-md border border-border/40 bg-card/40 backdrop-blur-md shadow-sm'
const subPanel = 'rounded-sm border border-border/30 bg-muted/20'
const labelStyle = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80'

const formatLabels: Record<CreativeFormat, string> = {
  story: 'Story',
  poem: 'Poem',
  song: 'Song',
  dialogue: 'Dialogue',
  essay: 'Essay',
}

const toneLabels: Record<CreativeTone, string> = {
  cinematic: 'Cinematic',
  lyrical: 'Lyrical',
  playful: 'Playful',
  intimate: 'Intimate',
  dramatic: 'Dramatic',
  philosophical: 'Philosophical',
  experimental: 'Experimental',
  hopeful: 'Hopeful',
  melancholic: 'Melancholic',
}

const lengthLabels: Record<CreativeLength, string> = {
  short: 'Short',
  medium: 'Medium',
  long: 'Long',
}

const dimensionLabels: Record<CreativeRubricDimension, string> = {
  formatFidelity: 'Format',
  originality: 'Originality',
  voiceConsistency: 'Voice',
  emotionalCoherence: 'Emotion',
  specificity: 'Specificity',
  readability: 'Readability',
}

function toLines(value: string[]) {
  return value.join('\n')
}

function fromLines(value: string): string[] {
  return value
    .split('\n')
    .map((entry) => entry.trim())
    .filter(Boolean)
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

function formatDateTime(value?: string) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

function artifactBadgeTone(score?: number) {
  if (!score) return 'text-muted-foreground'
  if (score >= 85) return 'text-pastel-green'
  if (score >= 75) return 'text-pastel-yellow'
  return 'text-pastel-red'
}

function getDisplayTitle(title: string | undefined, format?: CreativeFormat) {
  const cleaned = (title || '')
    .replace(/^[{[\s]+/, '')
    .replace(/[}\]]+$/g, '')
    .replace(/^title[:\s-]*/i, '')
    .replace(/\s+/g, ' ')
    .trim()

  if (!cleaned || cleaned.length < 3 || /^[^a-zA-Z0-9]+$/.test(cleaned)) {
    return format ? `Untitled ${format}` : 'Untitled piece'
  }

  return cleaned
}

function SegmentPicker<T extends string>({
  label,
  value,
  options,
  onChange,
}: {
  label: string
  value: T
  options: Array<{ value: T; label: string }>
  onChange: (value: T) => void
}) {
  return (
    <div className="space-y-1.5">
      <div className={labelStyle}>{label}</div>
      <div className="flex flex-wrap gap-1">
        {options.map((option) => {
          const active = option.value === value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              className={[
                'rounded-sm border px-2.5 py-1 text-[13px] transition-all duration-200',
                active
                  ? 'border-pastel-purple/40 bg-pastel-purple/10 text-pastel-purple shadow-sm'
                  : 'border-border/30 bg-muted/5 text-muted-foreground hover:border-pastel-purple/20 hover:text-foreground',
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function MetricTile({ label, value, hint, icon: Icon }: { label: string; value: string | number; hint: string; icon?: React.ElementType }) {
  return (
    <div className={`${subPanel} p-3 flex items-start gap-3`}>
      {Icon && (
        <div className="mt-0.5 rounded-sm bg-muted/40 p-1.5">
          <Icon className="h-3.5 w-3.5" />
        </div>
      )}
      <div className="space-y-1">
        <div className={labelStyle}>{label}</div>
        <div className="text-lg font-bold text-foreground leading-none">{value}</div>
        <div className="text-[10px] text-muted-foreground font-medium uppercase tracking-wider">{hint}</div>
      </div>
    </div>
  )
}

function EmptyState({ title, copy }: { title: string; copy: string }) {
  return (
    <div className="rounded-md border border-dashed border-border/30 bg-muted/5 px-6 py-10 text-center">
      <div className="text-sm font-semibold text-foreground/80">{title}</div>
      <p className="mt-1 text-xs text-muted-foreground max-w-[240px] mx-auto leading-relaxed">{copy}</p>
    </div>
  )
}

export function CreativeStudio({ agentId, agentName }: CreativeStudioProps) {
  const selectedProvider = useLLMPreferenceStore((state) => state.provider)
  const activeModel = useMemo(() => getClientModelForProvider(selectedProvider), [selectedProvider])

  const [mode, setMode] = useState<'studio' | 'library'>('studio')
  const [bootstrap, setBootstrap] = useState<CreativeBootstrapPayload | null>(null)
  const [brief, setBrief] = useState<CreativeBrief | null>(null)
  const [detail, setDetail] = useState<CreativeSessionDetail | null>(null)
  const [activeSessionId, setActiveSessionId] = useState<string | null>(null)
  const [selectedLibraryArtifactId, setSelectedLibraryArtifactId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [saving, setSaving] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadSessionDetail = useCallback(async (sessionId: string) => {
    const response = await fetch(`/api/agents/${agentId}/creative/sessions/${sessionId}`)
    const payload = await parseResponse<CreativeSessionDetail>(response)
    setDetail(payload)
    setActiveSessionId(payload.session.id)
    return payload
  }, [agentId])

  const loadBootstrap = useCallback(async (showRefreshState = false) => {
    try {
      setError(null)
      if (showRefreshState) setRefreshing(true)
      else setLoading(true)

      const response = await fetch(`/api/agents/${agentId}/creative`, { cache: 'no-store' })
      const payload = await parseResponse<CreativeBootstrapPayload>(response)
      setBootstrap(payload)
      setBrief((current) => current || payload.defaults)
    } catch (nextError) {
      console.error('Failed to load creative studio bootstrap:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to load creative studio')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [agentId])

  useEffect(() => {
    void loadBootstrap()
  }, [loadBootstrap])

  const mergedLibrary = useMemo(() => {
    const items = [...(bootstrap?.library || [])]
    if (detail?.session.publishedArtifactId) {
      const published = detail.artifacts.find((artifact) => artifact.id === detail.session.publishedArtifactId)
      if (published && !items.some((item) => item.artifact.id === published.id)) {
        items.unshift({ session: detail.session, artifact: published })
      }
    }
    return items
  }, [bootstrap?.library, detail])

  useEffect(() => {
    if (!brief && bootstrap?.defaults) {
      setBrief(bootstrap.defaults)
    }
  }, [bootstrap?.defaults, brief])

  useEffect(() => {
    if (!selectedLibraryArtifactId && mergedLibrary.length > 0) {
      setSelectedLibraryArtifactId(mergedLibrary[0].artifact.id)
    }
  }, [mergedLibrary, selectedLibraryArtifactId])

  useEffect(() => {
    if (!detail && mergedLibrary.length > 0) {
      const first = mergedLibrary[0]
      void loadSessionDetail(first.session.id).then(() => {
        setSelectedLibraryArtifactId(first.artifact.id)
      }).catch(console.error)
    }
  }, [detail, loadSessionDetail, mergedLibrary])

  const selectedLibraryItem = useMemo(() => {
    if (selectedLibraryArtifactId) {
      const match = mergedLibrary.find((item) => item.artifact.id === selectedLibraryArtifactId)
      if (match) return match
    }
    return mergedLibrary[0] || null
  }, [mergedLibrary, selectedLibraryArtifactId])

  const selectedArtifact = useMemo(() => {
    if (!detail) return null
    if (mode === 'library') {
      if (selectedLibraryItem?.session.id === detail.session.id) {
        return detail.artifacts.find((artifact) => artifact.id === selectedLibraryItem.artifact.id) || selectedLibraryItem.artifact
      }
      return selectedLibraryItem?.artifact || detail.artifacts[0] || null
    }
    return detail.artifacts[0] || null
  }, [detail, mode, selectedLibraryItem])

  const handleBriefChange = <K extends keyof CreativeBrief>(key: K, value: CreativeBrief[K]) => {
    setBrief((current) => current ? { ...current, [key]: value } : current)
  }

  const handleCreateSession = async () => {
    if (!brief) return
    try {
      setSaving(true)
      setError(null)
      const response = await fetch(`/api/agents/${agentId}/creative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(brief),
      })
      const payload = await parseResponse<{ session: CreativeSession }>(response)
      setActiveSessionId(payload.session.id)
      setDetail({ session: payload.session, artifacts: [], pipelineEvents: [] })
      setMode('studio')
      await loadBootstrap(true)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to save creative brief')
    } finally {
      setSaving(false)
    }
  }

  const handleGenerate = async () => {
    if (!activeSessionId) {
      setError('Save the brief first.')
      return
    }
    try {
      setGenerating(true)
      setError(null)
      const headers = new Headers(buildLLMPreferenceHeaders(selectedProvider, activeModel))
      const response = await fetch(`/api/agents/${agentId}/creative/sessions/${activeSessionId}/generate`, {
        method: 'POST',
        headers,
      })
      const payload = await parseResponse<CreativeSessionDetail>(response)
      setDetail(payload)
      await loadBootstrap(true)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to generate')
    } finally {
      setGenerating(false)
    }
  }

  const handlePublish = async () => {
    if (!detail?.session.id) return
    try {
      setPublishing(true)
      setError(null)
      const response = await fetch(`/api/agents/${agentId}/creative/sessions/${detail.session.id}/publish`, {
        method: 'POST',
      })
      const payload = await parseResponse<CreativeSessionDetail>(response)
      setDetail(payload)
      setMode('library')
      await loadBootstrap(true)
      if (payload.session.publishedArtifactId) {
        setSelectedLibraryArtifactId(payload.session.publishedArtifactId)
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to publish')
    } finally {
      setPublishing(false)
    }
  }

  const handleOpenLibraryItem = async (item: CreativeLibraryItem) => {
    try {
      setMode('library')
      setSelectedLibraryArtifactId(item.artifact.id)
      if (detail?.session.id !== item.session.id) {
        await loadSessionDetail(item.session.id)
      }
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to open artifact')
    }
  }

  const handleOpenSession = async (sessionId: string) => {
    try {
      setMode('studio')
      setError(null)
      await loadSessionDetail(sessionId)
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : 'Failed to open session')
    }
  }

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
              animate={{ scale: [0.85, 1.15, 0.85], opacity: [0.2, 0.6, 0.2] }}
              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
              className="absolute inset-2 rounded-full border border-pastel-purple/20 bg-pastel-purple/5 shadow-[0_0_15px_rgba(203,166,247,0.15)]"
            />
            {/* Center Icon */}
            <StudioIcon className="relative h-8 w-8 text-pastel-purple" />
          </div>
          <div className="flex flex-col items-center gap-1.5 text-center">
            <div className="text-[11px] font-bold uppercase tracking-[0.25em] text-pastel-purple">Initializing Studio</div>
            <div className="text-xs text-muted-foreground/80">Waking up the creative engines...</div>
          </div>
        </div>
      </div>
    )
  }

  if (!brief) return <EmptyState title="Unavailable" copy="No brief template found." />

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1">
        <div className="flex items-center gap-4">
          <div className="rounded-md bg-pastel-purple/10 p-2.5">
            <StudioIcon className="h-5 w-5" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-foreground leading-tight tracking-tight">
              {agentName}&apos;s Creative Studio
            </h3>
            <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-widest">
              Authored Workbench & Library
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="inline-flex rounded-md border border-border/40 bg-muted/20 p-1">
            <button
              onClick={() => setMode('studio')}
              className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-[12px] font-bold transition-all duration-200 ${
                mode === 'studio' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <StudioIcon className="h-3.5 w-3.5" />
              Studio
            </button>
            <button
              onClick={() => setMode('library')}
              className={`flex items-center gap-2 rounded-sm px-3 py-1.5 text-[12px] font-bold transition-all duration-200 ${
                mode === 'library' ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
              }`}
            >
              <LibraryIcon className="h-3.5 w-3.5" />
              Library
            </button>
          </div>
          <Button variant="outline" size="sm" className="h-9 gap-2 border-border/40" onClick={() => void loadBootstrap(true)} disabled={refreshing}>
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">Refresh</span>
          </Button>
        </div>
      </div>

      {error && (
        <div className="rounded-md border border-pastel-red/30 bg-pastel-red/5 px-4 py-3 text-[13px] text-pastel-red flex items-start gap-3">
          <AlertTriangle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {/* Metrics Bento - Hidden on XL to save space for the 3-column layout */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 shrink-0 xl:hidden">
        <MetricTile icon={LibraryIcon} label="Library" value={mergedLibrary.length} hint="Published pieces" />
        <MetricTile icon={PipelineIcon} label="Sessions" value={bootstrap?.recentSessions.length || 0} hint="Recent runs" />
        <MetricTile icon={MetricIcon} label="Runtime" value={LLM_PROVIDER_LABELS[selectedProvider]} hint={activeModel} />
        <MetricTile icon={ArtifactIcon} label="Portfolio" value={bootstrap?.agent.creativeWorks || 0} hint="Total works" />
      </div>

      <div className="grid gap-4 xl:grid-cols-[340px_1fr_440px] xl:h-[calc(100vh-220px)] xl:min-h-[700px]">
        {/* Column 1: Input / Navigation */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          {mode === 'studio' ? (
            <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <BriefIcon className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Brief Builder</span>
                </div>
              </div>
              <div className="p-4 space-y-4 overflow-y-auto scrollbar-thin flex-1">
                <div className="space-y-4">
                  <SegmentPicker
                    label="Format"
                    value={brief.format}
                    onChange={(v) => handleBriefChange('format', v)}
                    options={(bootstrap?.formats || []).map(v => ({ value: v, label: formatLabels[v] }))}
                  />
                  <SegmentPicker
                    label="Tone"
                    value={brief.tone}
                    onChange={(v) => handleBriefChange('tone', v)}
                    options={(bootstrap?.tones || []).map(v => ({ value: v, label: toneLabels[v] }))}
                  />
                  <SegmentPicker
                    label="Length"
                    value={brief.length}
                    onChange={(v) => handleBriefChange('length', v)}
                    options={(bootstrap?.lengths || []).map(v => ({ value: v, label: lengthLabels[v] }))}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className={labelStyle}>Intent</div>
                  <textarea
                    value={brief.intent}
                    onChange={(e) => handleBriefChange('intent', e.target.value)}
                    rows={4}
                    className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-2 text-[12px] text-foreground outline-none transition placeholder:text-muted-foreground/50 focus:border-pastel-purple/50 resize-none"
                  />
                </div>
                <div className="space-y-3">
                  <div className="space-y-1.5">
                    <div className={labelStyle}>Audience</div>
                    <Input value={brief.audience} onChange={(e) => handleBriefChange('audience', e.target.value)} className="h-8 text-[12px] border-border/30 bg-muted/5" />
                  </div>
                  <div className="space-y-1.5">
                    <div className={labelStyle}>Reference</div>
                    <Input value={brief.referenceNotes} onChange={(e) => handleBriefChange('referenceNotes', e.target.value)} className="h-8 text-[12px] border-border/30 bg-muted/5" />
                  </div>
                </div>
              </div>
              <div className="p-3 shrink-0 border-t border-border/30 bg-muted/5">
                <div className="flex gap-2">
                  <Button onClick={() => void handleCreateSession()} disabled={saving} className="h-8 flex-1 gap-2 bg-pastel-purple hover:bg-pastel-purple/90 text-primary-foreground font-bold text-[10px] uppercase tracking-wider">
                    {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <SaveIcon className="h-3 w-3" />}
                    Save
                  </Button>
                  <Button variant="secondary" onClick={() => void handleGenerate()} disabled={generating || saving} className="h-8 flex-1 gap-2 font-bold text-[10px] uppercase tracking-wider border-border/40">
                    {generating ? <Loader2 className="h-3 w-3 animate-spin" /> : <GenerateIcon className="h-3 w-3" />}
                    Draft
                  </Button>
                  <Button variant="outline" size="icon" onClick={() => void handlePublish()} disabled={publishing || !detail?.session.finalArtifactId} className="h-8 w-8 shrink-0 border-border/40">
                    <PublishIcon className="h-3.5 w-3.5" />
                  </Button>
                </div>
              </div>
            </section>
          ) : (
            <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <LibraryIcon className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Library</span>
                </div>
              </div>
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
                {mergedLibrary.map((item) => {
                  const active = item.artifact.id === selectedLibraryItem?.artifact.id
                  return (
                    <button
                      key={item.artifact.id}
                      onClick={() => void handleOpenLibraryItem(item)}
                      className={`w-full text-left p-2.5 rounded-sm border transition-all duration-200 ${
                        active ? 'border-pastel-blue/40 bg-pastel-blue/5' : 'border-border/30 bg-muted/5 hover:border-pastel-blue/20'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[11px] font-bold text-foreground truncate">{getDisplayTitle(item.artifact.title, item.artifact.format)}</span>
                        <span className={`text-[10px] font-bold ${artifactBadgeTone(item.artifact.evaluation?.overallScore)}`}>{item.artifact.evaluation?.overallScore || '–'}</span>
                      </div>
                      <div className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider mt-0.5">{formatLabels[item.artifact.format]} • {toneLabels[item.artifact.tone]}</div>
                    </button>
                  )
                })}
              </div>
            </section>
          )}

          {/* Recent Runs / Sessions (Always visible at bottom of Col 1) */}
          <section className={`${premiumPanel} h-[200px] flex flex-col overflow-hidden shrink-0`}>
            <div className="border-b border-border/40 bg-muted/10 px-3 py-2 flex items-center gap-2">
              <PipelineIcon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Recent Sessions</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2 space-y-1.5 scrollbar-thin">
              {(bootstrap?.recentSessions || []).slice(0, 5).map((session) => (
                <button
                  key={session.id}
                  onClick={() => void handleOpenSession(session.id)}
                  className={`w-full text-left p-2 rounded-sm border transition-all duration-200 ${
                    activeSessionId === session.id ? 'border-pastel-purple/40 bg-pastel-purple/5' : 'border-border/30 bg-muted/5 hover:border-pastel-purple/20'
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] font-bold">
                    <span className="text-foreground">{formatLabels[session.normalizedBrief.format]}</span>
                    <span className="text-muted-foreground uppercase text-[8px]">{session.status}</span>
                  </div>
                  <div className="text-[9px] text-muted-foreground truncate">{formatDateTime(session.updatedAt)}</div>
                </button>
              ))}
            </div>
          </section>
        </div>

        {/* Column 2: The Stage (Content Reader) */}
        <section className={`${premiumPanel} flex flex-col min-h-0 overflow-hidden`}>
          <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <ArtifactIcon className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Creative Artifact</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-8">
            {!selectedArtifact ? (
              <div className="h-full flex flex-col items-center justify-center opacity-50 grayscale">
                <ArtifactIcon className="h-10 w-10 mb-4 text-muted-foreground" />
                <EmptyState title="No content active" copy="Select a piece to begin reading." />
              </div>
            ) : (
              <article className="w-full space-y-8">
                <header className="space-y-4 pb-8 border-b border-border/20">
                  <h1 className="text-4xl font-black text-foreground tracking-tight uppercase">
                    {getDisplayTitle(selectedArtifact.title, selectedArtifact.format)}
                  </h1>
                  <p className="text-sm text-muted-foreground leading-relaxed italic opacity-80">
                    {selectedArtifact.summary}
                  </p>
                </header>
                <div className="prose prose-sm prose-invert max-w-none prose-p:leading-relaxed prose-p:text-muted-foreground/90 prose-p:text-base">
                  <ChatMessageContent
                    content={selectedArtifact.content}
                    blocks={selectedArtifact.render?.blocks}
                  />
                </div>
              </article>
            )}
          </div>
          {/* Status Bar / Trace */}
          {mode === 'studio' && (
            <div className="border-t border-border/40 bg-muted/5 p-2 shrink-0">
              <div className="flex items-center gap-3 overflow-x-auto scrollbar-none no-scrollbar">
                {(detail?.pipelineEvents || []).slice(-3).map((event) => (
                  <div key={event.id} className="flex items-center gap-1.5 whitespace-nowrap px-2 py-0.5 bg-muted/20 rounded-full text-[9px] font-bold">
                    <CheckCircle2 className="h-2.5 w-2.5 text-pastel-green" />
                    <span className="text-foreground uppercase">{event.stage.replace('_', ' ')}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </section>

        {/* Column 3: The Inspector (Stats & Evaluation) */}
        <div className="flex flex-col gap-4 min-h-0 overflow-hidden">
          <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden`}>
            <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center gap-2 shrink-0">
              <QualityIcon className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Quality Gate</span>
            </div>
            
            <div className="flex-1 overflow-y-auto scrollbar-thin p-5 space-y-6">
              {!selectedArtifact?.evaluation ? (
                <EmptyState title="Evaluation Pending" copy="Generate or select a piece to see rubric results." />
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`${subPanel} p-4 text-center border-pastel-purple/20 bg-pastel-purple/5`}>
                      <div className={labelStyle}>Final Score</div>
                      <div className={`text-4xl font-black mt-1 ${artifactBadgeTone(selectedArtifact.evaluation.overallScore)}`}>
                        {selectedArtifact.evaluation.overallScore}
                      </div>
                    </div>
                    <div className={`${subPanel} p-4 text-center flex flex-col justify-center border-border/30`}>
                      <div className={labelStyle}>Status</div>
                      <div className="text-sm font-black uppercase tracking-widest mt-1 text-foreground">
                        {selectedArtifact.evaluation.pass ? 'Passed' : 'Hold'}
                      </div>
                    </div>
                  </div>

                  <div className="space-y-4">
                    <div className={labelStyle}>Dimension Metrics</div>
                    <div className="grid gap-3">
                      {Object.entries(selectedArtifact.evaluation.dimensions).map(([dim, score]) => (
                        <div key={dim} className={`${subPanel} p-3.5 space-y-2 border-border/20 hover:border-border/40 transition-colors`}>
                          <div className="flex items-center justify-between">
                            <span className="text-[10px] font-black text-foreground uppercase tracking-wider">{dimensionLabels[dim as CreativeRubricDimension]}</span>
                            <span className={`text-sm font-black ${artifactBadgeTone(score.score)}`}>{score.score}</span>
                          </div>
                          <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">{score.rationale}</p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    <ListPanelSidebar title="Strengths" items={selectedArtifact.evaluation.strengths} color="text-pastel-green" dotColor="bg-pastel-green" />
                    <ListPanelSidebar title="Weaknesses" items={selectedArtifact.evaluation.weaknesses} color="text-pastel-red" dotColor="bg-pastel-red" />
                    <ListPanelSidebar title="Repair Notes" items={selectedArtifact.evaluation.repairInstructions} color="text-pastel-blue" dotColor="bg-pastel-blue" />
                  </div>
                </>
              )}
            </div>
          </section>

          {/* Runtime Context Info */}
          <section className={`${premiumPanel} h-[140px] flex flex-col overflow-hidden shrink-0`}>
            <div className="border-b border-border/40 bg-muted/10 px-3 py-2 flex items-center gap-2">
              <ContextIcon className="h-3.5 w-3.5" />
              <span className="text-[10px] font-bold uppercase tracking-[0.2em]">Context</span>
            </div>
            <div className="p-3 text-[10px] space-y-2">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Provider:</span>
                <span className="font-bold text-foreground">{LLM_PROVIDER_LABELS[selectedProvider]}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Model:</span>
                <span className="font-bold text-foreground truncate ml-4">{activeModel}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Words:</span>
                <span className="font-bold text-foreground">{selectedArtifact?.wordCount || 0}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
    </div>
  )
}

function ListPanelSidebar({ title, items, color, dotColor }: { title: string; items: string[]; color: string; dotColor: string }) {
  return (
    <div className="space-y-1.5">
      <div className={`text-[9px] font-bold uppercase tracking-wider ${color}`}>{title}</div>
      <ul className="space-y-1.5">
        {items.slice(0, 3).map((item, i) => (
          <li key={i} className="text-[10px] text-muted-foreground leading-relaxed flex items-start gap-2">
            <span className={`mt-1.5 h-1 w-1 rounded-full shrink-0 ${dotColor}`} />
            {item}
          </li>
        ))}
        {items.length === 0 && <li className="text-[9px] text-muted-foreground italic">None recorded.</li>}
      </ul>
    </div>
  )
}

function RubricPanel({ evaluation }: { evaluation?: CreativeRubricEvaluation }) {
  if (!evaluation) return null

  return (
    <div className="space-y-4 pt-4 border-t border-border/20">
      <div className="flex items-center gap-2">
        <QualityIcon className="h-4 w-4" />
        <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Quality Evaluation</span>
      </div>

      <div className="grid gap-2 grid-cols-2 lg:grid-cols-3">
        {Object.entries(evaluation.dimensions).map(([dimension, score]) => (
          <div key={dimension} className={`${subPanel} p-2.5 space-y-1`}>
            <div className="flex items-center justify-between">
              <span className="text-[10px] font-bold text-muted-foreground uppercase">{dimensionLabels[dimension as CreativeRubricDimension]}</span>
              <span className={`text-[11px] font-bold ${artifactBadgeTone(score.score)}`}>{score.score}</span>
            </div>
            <p className="text-[10px] text-muted-foreground leading-tight line-clamp-2">{score.rationale}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <div className="space-y-1.5">
          <div className="text-[9px] font-bold text-pastel-green uppercase tracking-wider">Strengths</div>
          <ul className="space-y-1">
            {evaluation.strengths.slice(0, 3).map((s, i) => (
              <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 rounded-full bg-pastel-green shrink-0" />
                {s}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <div className="text-[9px] font-bold text-pastel-red uppercase tracking-wider">Weaknesses</div>
          <ul className="space-y-1">
            {evaluation.weaknesses.slice(0, 3).map((w, i) => (
              <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 rounded-full bg-pastel-red shrink-0" />
                {w}
              </li>
            ))}
          </ul>
        </div>
        <div className="space-y-1.5">
          <div className="text-[9px] font-bold text-pastel-blue uppercase tracking-wider">Repair</div>
          <ul className="space-y-1">
            {evaluation.repairInstructions.slice(0, 3).map((r, i) => (
              <li key={i} className="text-[11px] text-muted-foreground flex items-start gap-1.5">
                <span className="mt-1 h-1 w-1 rounded-full bg-pastel-blue shrink-0" />
                {r}
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  )
}

