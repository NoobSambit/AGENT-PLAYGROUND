'use client'

import type { ReactNode } from 'react'
import {
  Activity,
  BookOpen,
  Brain,
  CheckCircle2,
  ChevronRight,
  CircleDot,
  Clock3,
  Cloud,
  Database,
  FileText,
  GitBranch,
  HeartPulse,
  Link2,
  MessageCircle,
  ShieldCheck,
  Sparkles,
} from 'lucide-react'
import { EmotionRadar } from '@/components/emotions/EmotionRadar'
import { emotionalService } from '@/lib/services/emotionalService'
import type { AgentRecord, EmotionalEvent, EmotionalProfile, EmotionalState, EmotionType, MessageRecord } from '@/types/database'

interface AgentEmotionWorkspaceProps {
  agent: AgentRecord
  emotionalState: EmotionalState
  emotionalProfile: EmotionalProfile
  events: EmotionalEvent[]
  messages: MessageRecord[]
}

type PanelTone = 'rose' | 'aqua' | 'gold' | 'cobalt'

const EMOTIONS: EmotionType[] = ['anticipation', 'trust', 'joy', 'fear', 'surprise', 'sadness', 'disgust', 'anger']

const EMOTION_LABELS: Record<EmotionType, string> = {
  anticipation: 'Anticipation',
  trust: 'Trust',
  joy: 'Joy',
  fear: 'Fear',
  surprise: 'Surprise',
  sadness: 'Sadness',
  disgust: 'Disgust',
  anger: 'Anger',
}

const EMOTION_PALETTE: Record<EmotionType, string> = {
  anticipation: '#ea7fa4',
  trust: '#62c6c8',
  joy: '#f1bd51',
  fear: '#779cdb',
  surprise: '#ad92df',
  sadness: '#5d7db5',
  disgust: '#9da4ac',
  anger: '#d4777d',
}

function labelize(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function compactRef(value: string): string {
  return value.length > 22 ? `${value.slice(0, 14)}…${value.slice(-5)}` : value
}

function formatTime(value?: string): string {
  if (!value) return 'not recorded'
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime())
    ? 'not recorded'
    : timestamp.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })
}

function formatDate(value?: string): string {
  if (!value) return 'not recorded'
  const timestamp = new Date(value)
  return Number.isNaN(timestamp.getTime())
    ? 'not recorded'
    : timestamp.toLocaleDateString([], { month: 'short', day: 'numeric' })
}

function percentage(value: number | undefined | null): string {
  return `${Math.round((value || 0) * 100)}%`
}

function previewText(value: string, limit = 120): string {
  const normalized = value.replace(/\s+/g, ' ').trim()
  return normalized.length > limit ? `${normalized.slice(0, limit).trimEnd()}…` : normalized
}

function Panel({
  title,
  icon: Icon,
  tone,
  children,
  className,
}: {
  title: string
  icon: typeof Activity
  tone: PanelTone
  children: ReactNode
  className?: string
}) {
  const iconColors: Record<PanelTone, string> = {
    rose: 'text-[#f2a2be]',
    aqua: 'text-[#9bdfdf]',
    gold: 'text-[#f2c26c]',
    cobalt: 'text-[#a9bdea]',
  }

  return (
    <section className={`overflow-hidden rounded-xl border border-[#2d4058] bg-[#0c1726] shadow-[0_12px_30px_rgba(0,0,0,0.16)] ${className || ''}`}>
      <div className="flex items-center gap-2 border-b border-[#263950] px-3.5 py-3">
        <Icon className={`h-4 w-4 ${iconColors[tone]}`} aria-hidden="true" />
        <h2 className="text-sm font-semibold tracking-tight text-[#edf3fb]">{title}</h2>
      </div>
      {children}
    </section>
  )
}

function Metric({ label, value, tone = 'rose' }: { label: string; value: string; tone?: PanelTone }) {
  const valueClass: Record<PanelTone, string> = {
    rose: 'text-[#f2a2be]',
    aqua: 'text-[#9bdfdf]',
    gold: 'text-[#f2c26c]',
    cobalt: 'text-[#a9bdea]',
  }

  return (
    <div className="rounded-lg border border-[#39485b] bg-[#101923] px-3 py-2.5">
      <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8fa1b8]">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold tabular-nums ${valueClass[tone]}`}>{value}</p>
    </div>
  )
}

function SignalBar({ emotion, value, compact = false, label }: { emotion: EmotionType; value: number; compact?: boolean; label?: string }) {
  const color = EMOTION_PALETTE[emotion]
  return (
    <div className={compact ? 'flex items-center gap-2' : 'grid grid-cols-[78px_minmax(0,1fr)_36px] items-center gap-3'}>
      <span className={`truncate text-[11px] font-medium ${compact ? 'w-20' : ''} text-[#c5d1df]`}>{label || EMOTION_LABELS[emotion]}</span>
      <div className="h-1.5 min-w-0 overflow-hidden rounded-full bg-[#253342]" aria-label={`${label || EMOTION_LABELS[emotion]} ${percentage(value)}`}>
        <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(1, value)) * 100}%`, backgroundColor: color }} />
      </div>
      {!compact && <span className="text-right text-[11px] font-semibold tabular-nums text-[#c9d6e6]">{percentage(value)}</span>}
    </div>
  )
}

function EventProvenance({ events }: { events: EmotionalEvent[] }) {
  if (events.length === 0) {
    return <p className="px-3.5 py-4 text-xs text-[#98aabd]">No recorded emotional events yet.</p>
  }

  return (
    <ol className="divide-y divide-[#263950] px-3.5 py-1">
      {events.slice(0, 5).map((event, index) => {
        const reference = event.linkedMessageId || event.linkedActionId || event.evidenceRefs?.[0] || event.id
        return (
          <li key={event.id} className="grid grid-cols-[22px_minmax(0,1fr)_auto] items-center gap-2 py-2.5">
            <span className="grid h-5 w-5 place-items-center rounded-full bg-[#293a52] text-[10px] font-bold text-[#f2a2be]">{index + 1}</span>
            <span className="truncate text-[11px] text-[#d1dbe8]">{event.trigger || labelize(event.source)}</span>
            <span className="text-right text-[10px] font-semibold text-[#d9a7bd]">{compactRef(reference)}</span>
          </li>
        )
      })}
    </ol>
  )
}

export function AgentEmotionWorkspace({
  agent,
  emotionalState,
  emotionalProfile,
  events,
  messages,
}: AgentEmotionWorkspaceProps) {
  const orderedEvents = [...events].sort((left, right) => new Date(right.timestamp).getTime() - new Date(left.timestamp).getTime())
  const latestEvent = orderedEvents[0]
  const dominantEmotion = emotionalState.dominantEmotion
  const dominantIntensity = dominantEmotion ? emotionalState.currentMood[dominantEmotion] || 0 : 0
  const liveSpectrum = [...EMOTIONS].sort((left, right) => emotionalState.currentMood[right] - emotionalState.currentMood[left])
  const temperamentSpectrum = [...EMOTIONS].sort((left, right) => emotionalProfile.temperament[right] - emotionalProfile.temperament[left])
  const evidenceRefs = [...new Set(orderedEvents.flatMap((event) => event.evidenceRefs || []))].slice(0, 5)
  const memoryLinks = [...new Set(orderedEvents.flatMap((event) => event.linkedMemoryIds || []))]
  const downstreamHints = orderedEvents.flatMap((event) => event.downstreamHints || [])
  const uniqueDownstreamHints = Array.from(new Map(downstreamHints.map((hint) => [hint.feature, hint])).values())
  const temperamentLead = temperamentSpectrum[0]
  const liveSummary = emotionalService.getEmotionalSummary(emotionalState, emotionalProfile)
  const messagesById = new Map(messages.map((message) => [message.id, message]))

  const downstreamIcons = {
    journal: BookOpen,
    dream: Cloud,
    scenario: GitBranch,
  }

  return (
    <section aria-label="Emotion model workspace" className="space-y-3">
      <header className="flex flex-col gap-3 border-b border-[#263950] pb-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#f2a2be]/30 bg-[#3a1f2b] text-[#f2a2be]">
            <HeartPulse className="h-5 w-5" aria-hidden="true" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-semibold tracking-tight text-[#edf3fb]">Emotion model</h1>
            <p className="mt-0.5 truncate text-sm text-[#9eafc2]">{agent.name}&apos;s live emotional state, temperament foundation, recent causes, and downstream behavior hints.</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-[11px]">
          <span className={`inline-flex h-7 items-center gap-1.5 rounded-md border px-2.5 font-semibold ${emotionalState.status === 'active' ? 'border-emerald-300/25 bg-emerald-300/10 text-emerald-100' : 'border-[#586675] bg-[#18222e] text-[#b3c0d0]'}`}><CircleDot className="h-3.5 w-3.5" aria-hidden="true" />{labelize(emotionalState.status)}</span>
          <span className="inline-flex h-7 items-center gap-1.5 border-l border-[#4a5869] pl-3 text-[#a9b8cb]"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />Last pulse {formatTime(emotionalState.lastUpdated)}</span>
          <span className="inline-flex h-7 items-center gap-1.5 border-l border-[#4a5869] pl-3 text-[#a9b8cb]"><Link2 className="h-3.5 w-3.5" aria-hidden="true" />Evidence refs {evidenceRefs.length}</span>
        </div>
      </header>

      <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_280px]">
        <div className="space-y-3">
          <Panel title="Live emotional signal" icon={Activity} tone="rose">
            <div className="grid gap-4 p-3.5 xl:grid-cols-[300px_minmax(0,1fr)_320px] xl:items-stretch">
              <div className="border-b border-[#263950] pb-3 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-4">
                <EmotionRadar emotionalState={emotionalState} emotionalProfile={emotionalProfile} recentEvents={orderedEvents} mode="live" size={270} palette={EMOTION_PALETTE} />
              </div>

              <div className="border-b border-[#263950] pb-4 xl:border-b-0 xl:border-r xl:pb-0 xl:pr-4">
                <div className="grid gap-2 sm:grid-cols-3">
                  <Metric label="Dominant" value={dominantEmotion ? EMOTION_LABELS[dominantEmotion] : 'Dormant'} />
                  <Metric label="Intensity" value={percentage(dominantIntensity)} />
                  <Metric label="Last pulse" value={formatTime(emotionalState.lastUpdated)} tone="cobalt" />
                </div>
                <div className="mt-2.5 rounded-lg border border-[#34465e] bg-[#101c2b] px-3 py-2.5">
                  <span className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#f0a4bd]">Active analysis</span>
                  <p className="mt-1 text-sm leading-6 text-[#e6dbe1]">{liveSummary}</p>
                </div>
                <div className="mt-4 space-y-2.5">
                  {liveSpectrum.map((emotion) => <SignalBar key={emotion} emotion={emotion} value={emotionalState.currentMood[emotion]} />)}
                </div>
              </div>

              <div>
                <h3 className="mb-2 text-xs font-semibold text-[#d8e3ef]">Emotion provenance</h3>
                <EventProvenance events={orderedEvents} />
              </div>
            </div>
          </Panel>

          <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_minmax(0,0.95fr)]">
            <Panel title="Psychological foundation" icon={ShieldCheck} tone="aqua">
              <div className="grid gap-4 p-3.5 lg:grid-cols-[190px_minmax(0,1fr)]">
                <div className="space-y-3">
                  <SignalBar emotion="anticipation" value={emotionalProfile.sensitivity} label="Sensitivity" compact />
                  <SignalBar emotion="trust" value={emotionalProfile.resilience} label="Resilience" compact />
                  <SignalBar emotion="joy" value={emotionalProfile.expressiveness} label="Expressive" compact />
                  <p className="border-t border-[#263950] pt-3 text-[11px] leading-5 text-[#a9bcc4]">Sensitivity, resilience, and expressiveness are derived from the agent&apos;s persona and core traits.</p>
                </div>
                <div className="border-t border-[#263950] pt-3 lg:border-l lg:border-t-0 lg:pl-4 lg:pt-0">
                  <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#9bdddb]">Core temperament</p>
                  <div className="space-y-2.5">
                    {temperamentSpectrum.map((emotion) => <SignalBar key={emotion} emotion={emotion} value={emotionalProfile.temperament[emotion]} />)}
                  </div>
                </div>
              </div>
            </Panel>

            <Panel title="Bias distribution" icon={Brain} tone="gold">
              <div className="grid gap-4 p-3.5 sm:grid-cols-[minmax(0,1fr)_140px]">
                <div>
                  <p className="text-[11px] text-[#b7c5d5]">Top propensities from the stable temperament profile.</p>
                  <ol className="mt-3 space-y-3">
                    {temperamentSpectrum.slice(0, 3).map((emotion, index) => (
                      <li key={emotion} className="grid grid-cols-[24px_84px_minmax(0,1fr)_34px] items-center gap-2">
                        <span className="grid h-5 w-5 place-items-center rounded-md border border-[#6b5638] bg-[#2c2519] text-[10px] font-bold text-[#f2c26c]">{index + 1}</span>
                        <span className="text-[11px] text-[#d6e0ec]">{EMOTION_LABELS[emotion]}</span>
                        <div className="h-1.5 overflow-hidden rounded-full bg-[#253342]"><div className="h-full rounded-full" style={{ width: `${emotionalProfile.temperament[emotion] * 100}%`, backgroundColor: EMOTION_PALETTE[emotion] }} /></div>
                        <span className="text-right text-[11px] font-semibold text-[#f2c26c]">{percentage(emotionalProfile.temperament[emotion])}</span>
                      </li>
                    ))}
                  </ol>
                </div>
                <div className="flex items-center justify-center rounded-lg border border-dashed border-[#3d4d60] bg-[#101c2b] p-3 text-center">
                  <div>
                    <Sparkles className="mx-auto h-5 w-5 text-[#f2c26c]" aria-hidden="true" />
                    <p className="mt-2 text-[11px] leading-5 text-[#c5d2df]">Defaults to {EMOTION_LABELS[temperamentLead]} when no live signal is active.</p>
                  </div>
                </div>
              </div>
            </Panel>
          </div>

          <Panel title="Recent causes" icon={Clock3} tone="cobalt">
            {orderedEvents.length === 0 ? (
              <div className="px-4 py-8 text-center text-sm text-[#9eb0c8]">No lived emotional activity has been recorded yet.</div>
            ) : (
              <div>
                <p className="border-b border-[#263950] px-4 py-2 text-[11px] text-[#9eb0c8]">Each entry ties an emotional shift to its trigger, reasoning, and the linked conversation message.</p>
                <ol className="divide-y divide-[#263950]">
                  {orderedEvents.slice(0, 6).map((event, index) => {
                    const referenceIds = [event.linkedMessageId, ...(event.evidenceRefs || [])].filter((reference): reference is string => Boolean(reference))
                    const linkedMessage = referenceIds.map((reference) => messagesById.get(reference)).find(Boolean)
                    const change = `${event.delta >= 0 ? 'increased' : 'decreased'} ${percentage(Math.abs(event.delta))}`

                    return (
                      <li key={event.id} className="grid grid-cols-[26px_minmax(0,1fr)] gap-x-3 px-4 py-3">
                        <span className="mt-0.5 grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-[#101923]" style={{ backgroundColor: EMOTION_PALETTE[event.emotion] }}>{index + 1}</span>
                        <article className="min-w-0">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <h3 className="text-sm font-semibold" style={{ color: EMOTION_PALETTE[event.emotion] }}>{EMOTION_LABELS[event.emotion]} {change}</h3>
                            <span className="text-[10px] font-medium uppercase tracking-[0.11em] text-[#8498b1]">{labelize(event.phase)}</span>
                            <span className="ml-auto text-[10px] text-[#8fa1b8]">{formatDate(event.timestamp)} · {formatTime(event.timestamp)} · {percentage(event.confidence)} confidence</span>
                          </div>
                          <p className="mt-1 text-xs leading-5 text-[#c7d4e1]"><span className="font-semibold text-[#93a7bf]">Trigger:</span> {event.trigger || labelize(event.source)} <span className="px-1.5 text-[#51647b]">·</span> {event.explanation || event.context || 'No explanation was recorded for this event.'}</p>
                          {linkedMessage ? (
                            <details className="group mt-2 rounded-md border border-[#2f4662] bg-[#101c2b]">
                              <summary className="flex min-h-8 cursor-pointer list-none items-center gap-2 px-2.5 py-1.5 text-[11px] text-[#bed0e6] marker:hidden focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#a9bdea] focus-visible:ring-inset [&::-webkit-details-marker]:hidden">
                                <ChevronRight className="h-3.5 w-3.5 shrink-0 text-[#a9bdea] transition-transform group-open:rotate-90" aria-hidden="true" />
                                <MessageCircle className="h-3.5 w-3.5 shrink-0 text-[#a9bdea]" aria-hidden="true" />
                                <span className="shrink-0 font-semibold text-[#d8e7f8]">Linked {linkedMessage.type} message</span>
                                <span className="min-w-0 truncate text-[#a8b9cc]">{previewText(linkedMessage.content)}</span>
                              </summary>
                              <blockquote className="border-t border-[#2f4662] px-3 py-2 text-xs leading-5 text-[#d6e1ed]">{linkedMessage.content}</blockquote>
                            </details>
                          ) : (
                            <p className="mt-2 text-[11px] text-[#8fa1b8]">No readable linked message is available for this event.</p>
                          )}
                        </article>
                      </li>
                    )
                  })}
                </ol>
              </div>
            )}
          </Panel>
        </div>

        <aside className="space-y-3 xl:sticky xl:top-3 xl:self-start">
          <Panel title="Emotion state" icon={HeartPulse} tone="rose">
            <dl className="divide-y divide-[#263950] px-3.5 py-1">
              <div className="flex items-center justify-between gap-3 py-2 text-[11px]"><dt className="text-[#a9b8ca]">Status</dt><dd className={emotionalState.status === 'active' ? 'font-semibold text-emerald-200' : 'font-semibold text-[#c3cbd6]'}>{labelize(emotionalState.status)}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2 text-[11px]"><dt className="text-[#a9b8ca]">Dominant</dt><dd className="font-semibold" style={{ color: dominantEmotion ? EMOTION_PALETTE[dominantEmotion] : '#c3cbd6' }}>{dominantEmotion ? EMOTION_LABELS[dominantEmotion] : 'Dormant'}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2 text-[11px]"><dt className="text-[#a9b8ca]">Intensity</dt><dd className="font-semibold text-[#f2a2be]">{percentage(dominantIntensity)}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2 text-[11px]"><dt className="text-[#a9b8ca]">Updated</dt><dd className="font-semibold text-[#d1dce8]">{formatTime(emotionalState.lastUpdated)}</dd></div>
              <div className="flex items-center justify-between gap-3 py-2 text-[11px]"><dt className="text-[#a9b8ca]">Confidence</dt><dd className="font-semibold text-[#d1dce8]">{latestEvent ? percentage(latestEvent.confidence) : 'not recorded'}</dd></div>
            </dl>
          </Panel>

          <Panel title="Downstream effects" icon={GitBranch} tone="aqua">
            <div className="space-y-2 px-3.5 py-3">
              {uniqueDownstreamHints.length > 0 ? uniqueDownstreamHints.map((hint) => {
                const Icon = downstreamIcons[hint.feature]
                return <div key={hint.feature} className="flex gap-2 text-[11px] text-[#c4d8db]"><Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-[#9bdddb]" aria-hidden="true" /><span><span className="font-semibold text-[#dff4f3]">{labelize(hint.feature)}</span> {hint.hint}</span></div>
              }) : <p className="text-xs text-[#9eb6b9]">No downstream hint recorded for the current events.</p>}
              <div className="border-t border-[#263950] pt-2 text-[11px] text-[#9eb6b9]"><Database className="mr-1 inline h-3.5 w-3.5 text-[#9bdddb]" aria-hidden="true" />Linked memories: <span className="font-semibold text-[#dff4f3]">{memoryLinks.length}</span></div>
            </div>
          </Panel>

          <Panel title="Linked evidence" icon={Link2} tone="gold">
            <div className="space-y-1.5 px-3.5 py-3">
              {evidenceRefs.length > 0 ? evidenceRefs.map((reference) => <span key={reference} className="flex items-center gap-2 text-[11px] text-[#e3d2b5]"><FileText className="h-3.5 w-3.5 text-[#f2c26c]" aria-hidden="true" />{compactRef(reference)}</span>) : <p className="text-xs text-[#b9aa91]">No evidence reference recorded yet.</p>}
            </div>
          </Panel>

          <Panel title="Profile basis" icon={CheckCircle2} tone="cobalt">
            <div className="space-y-2 px-3.5 py-3 text-[11px] text-[#b7c8e2]">
              <p><span className="font-semibold text-[#d9e5f7]">Temperament:</span> derived from persona and core traits.</p>
              <p><span className="font-semibold text-[#d9e5f7]">Live signal:</span> written only after an actual turn or internal action.</p>
              <p><span className="font-semibold text-[#d9e5f7]">Profile derived:</span> {formatDate(emotionalProfile.lastDerivedAt)}</p>
            </div>
          </Panel>
        </aside>
      </div>
    </section>
  )
}

export default AgentEmotionWorkspace
