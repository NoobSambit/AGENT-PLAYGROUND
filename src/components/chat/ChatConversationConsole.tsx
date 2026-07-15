'use client'

import { useEffect, useMemo, useRef, useState, type FormEvent, type ReactNode } from 'react'
import {
  Brain,
  CheckCircle2,
  CircleAlert,
  CircleDashed,
  Clock3,
  Database,
  FileCheck2,
  Library,
  MessageCircle,
  Send,
  ShieldCheck,
  Sparkles,
  User,
  Wrench,
} from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'
import { ChatMessageContent } from '@/components/chat/ChatMessageContent'
import { VoiceConsole } from '@/components/chat/VoiceConsole'
import { LibraryInfluenceTrace } from '@/components/library/LibraryInfluenceTrace'
import type { AgentRecord, MessageRecord } from '@/types/database'

interface ChatConversationConsoleProps {
  agent: AgentRecord
  messages: MessageRecord[]
  draft: string
  isSending: boolean
  isLoading?: boolean
  error?: string | null
  onDraftChange: (value: string) => void
  onSend: (event: FormEvent<HTMLFormElement>) => void
  onClearDraft: () => void
}

type Tone = 'mint' | 'amber' | 'rose' | 'aqua' | 'muted'
type PanelTone = 'aqua' | 'mint' | 'peach' | 'rose'

interface InspectorRow {
  label: string
  value: string
  tone: Tone
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown>
    : undefined
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((entry): entry is string => typeof entry === 'string') : []
}

function asNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined
}

function shortId(id?: string): string {
  if (!id) return 'not recorded'
  return id.length > 12 ? `${id.slice(0, 8)}…${id.slice(-4)}` : id
}

function formatTime(timestamp?: string): string {
  if (!timestamp) return 'not recorded'
  const date = new Date(timestamp)
  return Number.isNaN(date.getTime())
    ? 'not recorded'
    : date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function labelize(value: string): string {
  return value.replace(/[_-]/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function toneClasses(tone: Tone): string {
  const tones: Record<Tone, string> = {
    mint: 'border-emerald-300/20 bg-emerald-300/10 text-emerald-200',
    amber: 'border-amber-300/20 bg-amber-300/10 text-amber-200',
    rose: 'border-rose-300/20 bg-rose-300/10 text-rose-200',
    aqua: 'border-cyan-200/20 bg-cyan-200/10 text-cyan-100',
    muted: 'border-slate-400/20 bg-slate-400/10 text-slate-300',
  }
  return tones[tone]
}

function ToneIcon({ tone }: { tone: Tone }) {
  const Icon = tone === 'mint' ? CheckCircle2 : tone === 'amber' ? CircleAlert : tone === 'rose' ? CircleAlert : CircleDashed
  return <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
}

function InspectorPanel({
  title,
  icon: Icon,
  tone,
  children,
  className,
}: {
  title: string
  icon: typeof Brain
  tone: PanelTone
  children: ReactNode
  className?: string
}) {
  const themes: Record<PanelTone, { root: string; divider: string; icon: string }> = {
    aqua: { root: 'border-[#365b60] bg-[#0d1c20]', divider: 'border-[#2a4a4e]', icon: 'text-[#9bdddb]' },
    mint: { root: 'border-[#3d5d4d] bg-[#101e19]', divider: 'border-[#31503f]', icon: 'text-[#afe4bc]' },
    peach: { root: 'border-[#684d43] bg-[#211915]', divider: 'border-[#563e35]', icon: 'text-[#f2c19f]' },
    rose: { root: 'border-[#684a5a] bg-[#21171d]', divider: 'border-[#573b49]', icon: 'text-[#f2bbcf]' },
  }
  const theme = themes[tone]

  return (
    <section className={`overflow-hidden rounded-xl border shadow-[0_12px_32px_rgba(0,0,0,0.18)] ${theme.root} ${className || ''}`}>
      <div className={`flex items-center gap-2 border-b px-3.5 py-3 ${theme.divider}`}>
        <Icon className={`h-4 w-4 ${theme.icon}`} aria-hidden="true" />
        <h3 className="text-sm font-semibold tracking-tight text-[#eef5ff]">{title}</h3>
      </div>
      {children}
    </section>
  )
}

function InspectorRows({ rows }: { rows: InspectorRow[] }) {
  return (
    <dl className="divide-y divide-[#20344e]/80 px-3.5 py-1">
      {rows.map((row) => (
        <div key={row.label} className="flex min-w-0 items-center justify-between gap-3 py-2">
          <dt className="flex min-w-0 items-center gap-2 text-[11px] text-[#b5c4d9]">
            <ToneIcon tone={row.tone} />
            <span className="truncate">{row.label}</span>
          </dt>
          <dd className={`shrink-0 text-right text-[11px] font-semibold ${row.tone === 'muted' ? 'text-[#92a5bf]' : toneClasses(row.tone).split(' ').at(-1)}`}>
            {row.value}
          </dd>
        </div>
      ))}
    </dl>
  )
}

function EmptyConversation({ agentName }: { agentName: string }) {
  return (
    <div className="grid min-h-[380px] place-items-center px-6 text-center">
      <div className="max-w-sm">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[#eeb79d]/30 bg-[#3b2929] text-[#ffd2bc] shadow-[0_0_32px_rgba(242,184,161,0.12)]">
          <MessageCircle className="h-5 w-5" aria-hidden="true" />
        </div>
        <h2 className="mt-4 text-lg font-semibold text-[#eff6ff]">Begin a direct conversation</h2>
        <p className="mt-2 text-sm leading-6 text-[#9eafc6]">
          Messages, response quality, and context influence will appear here for {agentName}.
        </p>
      </div>
    </div>
  )
}

export function ChatConversationConsole({
  agent,
  messages,
  draft,
  isSending,
  isLoading = false,
  error,
  onDraftChange,
  onSend,
  onClearDraft,
}: ChatConversationConsoleProps) {
  const agentMessages = useMemo(
    () => messages.filter((message) => message.agentId === agent.id),
    [agent.id, messages]
  )
  const latestAgentMessage = useMemo(
    () => [...agentMessages].reverse().find((message) => message.type === 'agent'),
    [agentMessages]
  )
  const [selectedMessageId, setSelectedMessageId] = useState<string | null>(latestAgentMessage?.id || null)
  const messagesEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    setSelectedMessageId(latestAgentMessage?.id || null)
  }, [latestAgentMessage?.id])

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ block: 'end' })
  }, [agentMessages.length, isSending])

  const selectedMessage = agentMessages.find((message) => message.id === selectedMessageId && message.type === 'agent') || latestAgentMessage
  const selectedIndex = selectedMessage ? agentMessages.findIndex((message) => message.id === selectedMessage.id) : -1
  const sourceMessage = selectedIndex > 0
    ? [...agentMessages.slice(0, selectedIndex)].reverse().find((message) => message.type === 'user')
    : undefined
  const metadata = selectedMessage?.metadata
  const responseQuality = asRecord(metadata?.responseQuality)
  const validation = asRecord(responseQuality?.validation)
  const validationPassed = typeof validation?.pass === 'boolean' ? validation.pass : undefined
  const blockers = asStringArray(responseQuality?.blockerReasons)
  const warnings = asStringArray(responseQuality?.warnings)
  const memoryUsed = asNumber(metadata?.memoryUsed)
  const emotionEvents = Array.isArray(metadata?.emotionEvents) ? metadata.emotionEvents.length : undefined
  const libraryItems = metadata?.libraryContextItems || []
  const turnOutcome = metadata?.chatTurnOutcome
  const providerLabel = [metadata?.provider, metadata?.model].filter((value): value is string => typeof value === 'string' && Boolean(value)).join(' · ')

  const provenanceRows: InspectorRow[] = selectedMessage
    ? [
        { label: 'User prompt received', value: shortId(sourceMessage?.id), tone: sourceMessage ? 'mint' : 'muted' },
        { label: 'Model response recorded', value: shortId(selectedMessage.id), tone: 'mint' },
        { label: 'Library context', value: metadata?.libraryContextStatus || 'not recorded', tone: metadata?.libraryContextStatus === 'loaded' ? 'mint' : metadata?.libraryContextStatus === 'failed' ? 'rose' : 'muted' },
        { label: 'Emotion signals', value: emotionEvents === undefined ? 'not recorded' : `${emotionEvents} event${emotionEvents === 1 ? '' : 's'}`, tone: emotionEvents === undefined ? 'muted' : 'rose' },
        { label: 'Quality gate', value: validationPassed === undefined ? 'not recorded' : validationPassed ? 'passed' : 'review needed', tone: validationPassed === undefined ? 'muted' : validationPassed ? 'mint' : 'amber' },
      ]
    : []

  const qualityRows: InspectorRow[] = [
    { label: 'Validation result', value: validationPassed === undefined ? 'not recorded' : validationPassed ? 'passed' : 'review needed', tone: validationPassed === undefined ? 'muted' : validationPassed ? 'mint' : 'amber' },
    { label: 'Repair passes', value: typeof responseQuality?.repairCount === 'number' ? String(responseQuality.repairCount) : 'not recorded', tone: typeof responseQuality?.repairCount === 'number' ? 'mint' : 'muted' },
    { label: 'Blockers', value: responseQuality ? String(blockers.length) : 'not recorded', tone: blockers.length > 0 ? 'amber' : responseQuality ? 'mint' : 'muted' },
    { label: 'Style warnings', value: responseQuality ? String(warnings.length) : 'not recorded', tone: warnings.length > 0 ? 'amber' : responseQuality ? 'mint' : 'muted' },
  ]

  const contextRows: InspectorRow[] = [
    { label: 'Memories used', value: memoryUsed === undefined ? 'not recorded' : String(memoryUsed), tone: memoryUsed === undefined ? 'muted' : 'aqua' },
    { label: 'Library sources', value: metadata ? `${libraryItems.length} ${metadata.libraryContextStatus || 'not recorded'}` : 'not recorded', tone: metadata?.libraryContextStatus === 'loaded' ? 'mint' : metadata ? 'muted' : 'muted' },
    { label: 'Tools invoked', value: metadata ? String(asStringArray(metadata.toolsUsed).length) : 'not recorded', tone: metadata ? 'aqua' : 'muted' },
    { label: 'Runtime', value: providerLabel || 'not recorded', tone: providerLabel ? 'aqua' : 'muted' },
  ]

  const outcomeRows: InspectorRow[] = turnOutcome
    ? [
        { label: 'Changed domains', value: turnOutcome.changedDomains.length ? turnOutcome.changedDomains.map(labelize).join(', ') : 'none', tone: turnOutcome.changedDomains.length ? 'mint' : 'muted' },
        { label: 'Refresh required', value: turnOutcome.staleDomains.length ? turnOutcome.staleDomains.map(labelize).join(', ') : 'none', tone: turnOutcome.staleDomains.length ? 'amber' : 'mint' },
        { label: 'Turn completed', value: formatTime(turnOutcome.completedAt), tone: 'rose' },
      ]
    : [{ label: 'Domain outcome', value: 'not recorded', tone: 'muted' }]

  return (
    <section aria-label="Conversation console" className="overflow-hidden rounded-2xl border border-[#484251] bg-[#0d121a] shadow-[0_24px_70px_rgba(0,0,0,0.34)] xl:flex xl:h-[clamp(30rem,calc(100svh-18rem),46rem)] xl:flex-col">
      <div className="shrink-0 border-b border-[#4b404c] bg-[#211c27] px-4 py-4 sm:px-5">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[#eab79e]/30 bg-[#3c2a30] text-[#ffd3bd] shadow-[0_0_28px_rgba(242,184,161,0.1)]">
              <MessageCircle className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <h1 className="truncate text-xl font-semibold tracking-tight text-[#eff6ff]">Conversation console</h1>
              <p className="mt-0.5 truncate text-sm text-[#9fb0c6]">Direct chat with response metadata, memory influence, and turn outcomes.</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {providerLabel && <span className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#e8b89e]/25 bg-[#3c2a30] px-2.5 text-[11px] font-medium text-[#ffd3bd]"><Wrench className="h-3.5 w-3.5" aria-hidden="true" />{providerLabel}</span>}
            <span className={`inline-flex h-8 items-center gap-1.5 rounded-lg border px-2.5 text-[11px] font-medium ${agent.status === 'active' ? toneClasses('mint') : toneClasses('amber')}`}><span className="h-1.5 w-1.5 rounded-full bg-current" />{labelize(agent.status)}</span>
            <button type="button" onClick={onClearDraft} disabled={!draft} className="inline-flex h-8 items-center gap-1.5 rounded-lg border border-[#645867] bg-[#29212d] px-2.5 text-[11px] font-medium text-[#ded2e0] transition hover:border-[#f0c1a8]/50 hover:text-[#ffe0ce] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#f0c1a8]/80 disabled:cursor-not-allowed disabled:opacity-45">
              <CircleDashed className="h-3.5 w-3.5" aria-hidden="true" /> Clear draft
            </button>
          </div>
        </div>
      </div>

      <div className="grid xl:min-h-0 xl:flex-1 xl:grid-cols-[minmax(0,1fr)_300px]">
        <div className="flex min-h-0 min-w-0 flex-col border-b border-[#4b404c] xl:border-b-0 xl:border-r xl:border-[#4b404c]">
          <div className="min-h-0 flex-1 overflow-y-auto px-3 py-4 sm:px-5" aria-live="polite">
            {agentMessages.length === 0 && !isSending ? (
              isLoading
                ? <div className="grid min-h-[380px] place-items-center text-sm text-[#9fb3cb]">Loading conversation…</div>
                : <EmptyConversation agentName={agent.name} />
            ) : (
              <div className="space-y-4">
                {agentMessages.map((message) => {
                  const isUser = message.type === 'user'
                  const isSelected = message.id === selectedMessage?.id
                  const messageProvider = [message.metadata?.provider, message.metadata?.model].filter((value): value is string => typeof value === 'string').join(' · ')
                  const messageQuality = asRecord(message.metadata?.responseQuality)
                  const messageValidation = asRecord(messageQuality?.validation)
                  const messagePassed = typeof messageValidation?.pass === 'boolean' ? messageValidation.pass : undefined

                  return (
                    <article key={message.id} className={`flex gap-3 ${isUser ? 'justify-end' : 'justify-start'}`}>
                      {!isUser && <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#9bdddb]/25 bg-[#102427] text-[#aee5e1]"><PlaygroundLogo className="h-4 w-4" /></div>}
                      <div className={`min-w-0 ${isUser ? 'max-w-[88%] sm:max-w-[78%]' : 'max-w-[94%]'} ${isSelected ? 'relative' : ''}`}>
                        {isUser ? (
                          <div className="rounded-2xl rounded-br-md border border-[#d7a6b0]/35 bg-[#5f4453] px-4 py-3 text-[#fff5f5] shadow-[0_12px_30px_rgba(3,11,26,0.2)]">
                            <ChatMessageContent content={message.content} variant="user" />
                            <time className="mt-2 block text-right text-[10px] text-[#ffe1e5]/70">{formatTime(message.timestamp)}</time>
                          </div>
                        ) : (
                          <article className={`w-full rounded-xl border text-left transition ${isSelected ? 'border-[#8ec8b4] bg-[#15221e] shadow-[0_0_0_1px_rgba(142,200,180,0.1),0_14px_30px_rgba(0,0,0,0.14)]' : 'border-[#3d4a4c] bg-[#141a1f]'}`}>
                            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 border-b border-[#384345] px-4 py-2.5">
                              <span className="text-xs font-semibold text-[#dcecff]">{agent.name}</span>
                              <span className="text-[10px] font-medium uppercase tracking-[0.13em] text-[#9babad]">agent response</span>
                              <div className="ml-auto flex items-center gap-2">
                                <span className="text-[10px] text-[#9babad]">{messageProvider || 'response recorded'} · {formatTime(message.timestamp)}</span>
                                <button type="button" onClick={() => setSelectedMessageId(message.id)} aria-pressed={isSelected} className={`inline-flex h-7 items-center rounded-md border px-2 text-[10px] font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#aee5e1]/80 ${isSelected ? 'border-[#8ec8b4]/45 bg-[#223a31] text-[#c4efd5]' : 'border-[#58706a] bg-[#1c2926] text-[#b7d8cf] hover:border-[#8ec8b4]/60 hover:text-[#d4f5e4]'}`}>
                                  {isSelected ? 'Inspecting' : 'Inspect turn'}
                                </button>
                              </div>
                            </div>
                            <div className="select-text [&>*+*]:mt-3 px-4 py-3.5 text-sm leading-6 text-[#dce5df]">
                              <ChatMessageContent content={message.content} blocks={message.metadata?.render?.blocks} />
                            </div>
                            <div className="flex flex-wrap items-center gap-1.5 border-t border-[#384345] px-4 py-2.5">
                              {typeof message.metadata?.memoryUsed === 'number' && <span className="inline-flex items-center gap-1 rounded-md border border-cyan-200/15 bg-cyan-200/10 px-2 py-1 text-[10px] font-medium text-cyan-100"><Database className="h-3 w-3" aria-hidden="true" />{message.metadata.memoryUsed} memory signals</span>}
                              {message.metadata?.libraryContextStatus && <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium ${message.metadata.libraryContextStatus === 'loaded' ? toneClasses('mint') : message.metadata.libraryContextStatus === 'failed' ? toneClasses('rose') : toneClasses('muted')}`}><Library className="h-3 w-3" aria-hidden="true" />library {message.metadata.libraryContextStatus}</span>}
                              {messagePassed !== undefined && <span className={`inline-flex items-center gap-1 rounded-md border px-2 py-1 text-[10px] font-medium ${messagePassed ? toneClasses('mint') : toneClasses('amber')}`}><FileCheck2 className="h-3 w-3" aria-hidden="true" />quality {messagePassed ? 'passed' : 'review'}</span>}
                              {isSelected && <span className="ml-auto text-[10px] font-medium text-[#b8e6c8]">Inspecting this turn</span>}
                            </div>
                          </article>
                        )}
                      </div>
                      {isUser && <div className="mt-1 grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-[#d7a6b0]/30 bg-[#30202a] text-[#ffd9df]"><User className="h-4 w-4" aria-hidden="true" /></div>}
                    </article>
                  )
                })}
                {isSending && <div className="flex items-center gap-2 px-1 text-sm text-[#ddc9b7]"><Sparkles className="h-4 w-4 animate-pulse text-[#f2c19f]" aria-hidden="true" />{agent.name} is preparing a response…</div>}
                <div ref={messagesEndRef} />
              </div>
            )}
          </div>

          <div className="shrink-0 border-t border-[#4b404c] bg-[#18151d] p-3 sm:p-4">
            <div className="mb-2 flex flex-wrap items-center gap-1.5">
              {selectedMessage?.metadata?.memoryUsed !== undefined && <span className="rounded-md border border-cyan-200/15 bg-cyan-200/10 px-2 py-1 text-[10px] font-medium text-cyan-100">memory-aware</span>}
              {selectedMessage?.metadata?.libraryContextStatus === 'loaded' && <span className="rounded-md border border-emerald-200/15 bg-emerald-200/5 px-2 py-1 text-[10px] font-medium text-emerald-100">validated library context</span>}
              {turnOutcome?.staleDomains.includes('timeline') && <span className="rounded-md border border-amber-200/15 bg-amber-200/5 px-2 py-1 text-[10px] font-medium text-amber-100">timeline refresh pending</span>}
            </div>
            <form onSubmit={onSend} className="flex items-end gap-2">
              <label className="sr-only" htmlFor="conversation-message">Message {agent.name}</label>
              <textarea id="conversation-message" value={draft} onChange={(event) => onDraftChange(event.target.value)} onKeyDown={(event) => {
                if (event.key === 'Enter' && !event.shiftKey && !event.nativeEvent.isComposing) {
                  event.preventDefault()
                  event.currentTarget.form?.requestSubmit()
                }
              }} rows={2} placeholder={`Message ${agent.name}…`} disabled={isSending || isLoading} className="min-h-12 flex-1 resize-none rounded-xl border border-[#665764] bg-[#11161b] px-3.5 py-3 text-sm leading-5 text-[#f4edf1] outline-none placeholder:text-[#998b95] transition focus:border-[#f0bda5]/75 focus:ring-2 focus:ring-[#f0bda5]/15 disabled:cursor-not-allowed disabled:opacity-60" />
              <button type="submit" disabled={!draft.trim() || isSending || isLoading} className="inline-flex h-12 shrink-0 items-center gap-2 rounded-xl border border-[#ffd0bd]/55 bg-[#f2b8a1] px-4 text-sm font-semibold text-[#332027] shadow-[0_10px_24px_rgba(242,184,161,0.18)] transition hover:bg-[#f7c5b2] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffd0bd] disabled:cursor-not-allowed disabled:opacity-45">
                <Send className="h-4 w-4" aria-hidden="true" /><span className="hidden sm:inline">Send</span>
              </button>
            </form>
            <p className="mt-2 text-[10px] text-[#7f94ad]">Press Enter to send. Use Shift + Enter for a new line.</p>
            {error && <p role="alert" className="mt-2 text-xs text-rose-200">{error}</p>}
          </div>
        </div>

        <aside aria-label="Selected turn inspector" className="min-w-0 space-y-3 bg-[#12171b] p-3 sm:p-4 xl:overflow-y-auto">
          <div className="flex items-center justify-between gap-3 px-0.5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-[#8fa8c5]">Selected turn</p>
              <p className="mt-1 text-xs text-[#d7e6f8]">{selectedMessage ? shortId(selectedMessage.id) : 'No response selected'}</p>
            </div>
            {selectedMessage && <span className="inline-flex items-center gap-1 text-[10px] text-[#8fa8c5]"><Clock3 className="h-3.5 w-3.5" aria-hidden="true" />{formatTime(selectedMessage.timestamp)}</span>}
          </div>
          <InspectorPanel title="Turn provenance" icon={Clock3} tone="aqua">
            {selectedMessage ? <InspectorRows rows={provenanceRows} /> : <p className="px-3.5 py-4 text-xs text-[#8fa4bf]">Select an agent response to inspect its recorded signals.</p>}
          </InspectorPanel>
          <InspectorPanel title="Response quality" icon={ShieldCheck} tone="mint">
            <InspectorRows rows={qualityRows} />
          </InspectorPanel>
          <InspectorPanel title="Context packet" icon={Brain} tone="peach">
            <InspectorRows rows={contextRows} />
            {metadata?.libraryContextItems?.length ? <details className="border-t border-[#563e35] px-3.5 py-2.5"><summary className="cursor-pointer text-[11px] font-medium text-[#f2c19f]">Inspect {metadata.libraryContextItems.length} library source{metadata.libraryContextItems.length === 1 ? '' : 's'}</summary><div className="mt-2"><LibraryInfluenceTrace metadata={metadata} compact /></div></details> : null}
          </InspectorPanel>
          <InspectorPanel title="Domain updates" icon={FileCheck2} tone="rose">
            <InspectorRows rows={outcomeRows} />
          </InspectorPanel>
          <VoiceConsole agentName={agent.name} messages={agentMessages} value={draft} onChange={onDraftChange} linguisticProfile={agent.linguisticProfile} emotionalState={agent.emotionalState} />
        </aside>
      </div>
    </section>
  )
}

export default ChatConversationConsole
