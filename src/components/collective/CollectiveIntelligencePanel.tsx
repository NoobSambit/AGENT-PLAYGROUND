'use client'

import { useCallback, useEffect, useState } from 'react'
import { CollectiveIntelligenceSnapshot, KnowledgeBroadcast } from '@/types/enhancements'
import { SharedKnowledge } from '@/types/database'
import { Input, Textarea } from '@/components/ui/input'
import { AlertCircle, ExternalLink, Library, Loader2, Search, Send } from 'lucide-react'

interface CollectiveIntelligencePanelProps {
  agentId: string
  agentName: string
}

const panelClass = 'rounded-sm border border-border/70 bg-card/[0.62] p-5 backdrop-blur-xl'

export function CollectiveIntelligencePanel({ agentId, agentName }: CollectiveIntelligencePanelProps) {
  const [snapshot, setSnapshot] = useState<CollectiveIntelligenceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [broadcastTopic, setBroadcastTopic] = useState('')
  const [broadcastSummary, setBroadcastSummary] = useState('')
  const [mutationError, setMutationError] = useState<string | null>(null)
  const [pendingValidationId, setPendingValidationId] = useState<string | null>(null)
  const [pendingBroadcastId, setPendingBroadcastId] = useState<string | null>(null)

  const fetchSnapshot = useCallback(async (nextQuery?: string) => {
    try {
      setLoading(true)
      const params = new URLSearchParams({ agentId })
      if (nextQuery?.trim()) {
        params.set('query', nextQuery.trim())
      }

      const response = await fetch(`/api/collective-intelligence?${params.toString()}`)
      if (!response.ok) {
        throw new Error('Failed to fetch collective intelligence snapshot')
      }

      const data = await response.json()
      setSnapshot(data)
    } catch (error) {
      console.error('Failed to fetch collective intelligence snapshot:', error)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    void fetchSnapshot()
  }, [fetchSnapshot])

  const applyValidation = async (item: SharedKnowledge, verdict: 'support' | 'dispute') => {
    const rationale = verdict === 'support'
      ? 'Validated from the collective intelligence panel.'
      : 'Marked for review from the collective intelligence panel.'

    setPendingValidationId(`${item.id}:${verdict}`)
    setMutationError(null)

    try {
      const response = await fetch('/api/collective-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'validate',
          knowledgeId: item.libraryItemId || item.id,
          knowledgeSource: item.knowledgeSource,
          agentId,
          verdict,
          rationale,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to apply validation')
      }

      await fetchSnapshot(query)
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to apply validation')
    } finally {
      setPendingValidationId(null)
    }
  }

  const publishBroadcast = async (item?: SharedKnowledge) => {
    const topic = item?.topic || broadcastTopic.trim()
    const summary = item?.content || broadcastSummary.trim()

    if (!topic.trim() || !summary.trim()) {
      return
    }

    setPendingBroadcastId(item?.id || 'manual')
    setMutationError(null)

    try {
      const response = await fetch('/api/collective-intelligence', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'broadcast',
          agentId,
          topic: topic.trim(),
          summary: summary.trim(),
          knowledgeId: item?.libraryItemId || item?.id,
          knowledgeSource: item?.knowledgeSource,
        }),
      })

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}))
        throw new Error(typeof payload.error === 'string' ? payload.error : 'Failed to publish broadcast')
      }

      const data = await response.json()
      setSnapshot((prev) => prev
        ? { ...prev, broadcasts: [data.broadcast as KnowledgeBroadcast, ...prev.broadcasts].slice(0, 6) }
        : prev)
      if (!item) {
        setBroadcastTopic('')
        setBroadcastSummary('')
      }
    } catch (error) {
      setMutationError(error instanceof Error ? error.message : 'Failed to publish broadcast')
    } finally {
      setPendingBroadcastId(null)
    }
  }

  if (loading && !snapshot) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Loading collective intelligence network...</div>
  }

  return (
    <div className="space-y-6">
      <div className={panelClass}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <label className="flex h-12 flex-1 items-center gap-3 rounded-full border border-border/70 bg-background/45 px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Ask the network who knows what..."
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </label>
          <button
            type="button"
            onClick={() => void fetchSnapshot(query)}
            className="inline-flex h-12 items-center justify-center rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_44px_-26px_rgba(109,77,158,0.72)]"
          >
            Search network
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Repositories" value={snapshot?.repositories.length || 0} />
        <StatCard label="Expert referrals" value={snapshot?.referrals.length || 0} />
        <StatCard label="Consensus views" value={snapshot?.consensus.length || 0} />
        <StatCard label="Broadcasts" value={snapshot?.broadcasts.length || 0} />
      </div>

      {mutationError && (
        <div className="flex items-start gap-2 rounded-sm border border-rose-500/30 bg-rose-500/10 p-3 text-sm text-rose-700 dark:text-rose-300">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{mutationError}</span>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className={panelClass}>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Expert referrals</div>
            <div className="mt-4 space-y-3">
              {(snapshot?.referrals || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Search for a topic to discover specialist agents and supporting knowledge.</p>
              ) : (
                snapshot?.referrals.map((referral) => (
                  <div key={referral.agentId} className="rounded-sm border border-border/60 bg-background/45 p-4">
                    <div className="flex items-center justify-between gap-4">
                      <div>
                        <div className="font-medium text-foreground">{referral.agentName}</div>
                        <p className="mt-1 text-sm text-muted-foreground">{referral.reasoning}</p>
                      </div>
                      <div className="text-right text-sm font-semibold text-primary">
                        {(referral.score * 100).toFixed(0)}%
                      </div>
                    </div>
                    {referral.expertiseTopics.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {referral.expertiseTopics.slice(0, 5).map((topic) => (
                          <span key={topic} className="soft-pill">{topic}</span>
                        ))}
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={panelClass}>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Relevant knowledge</div>
            <div className="mt-4 space-y-4">
              {(snapshot?.relevantKnowledge || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">The network has no strongly relevant entry for this query yet.</p>
              ) : (
                snapshot?.relevantKnowledge.map((item) => (
                  <KnowledgeCard
                    key={item.id}
                    item={item}
                    pendingValidationId={pendingValidationId}
                    pendingBroadcastId={pendingBroadcastId}
                    onSupport={() => void applyValidation(item, 'support')}
                    onDispute={() => void applyValidation(item, 'dispute')}
                    onBroadcast={() => void publishBroadcast(item)}
                  />
                ))
              )}
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <div className={panelClass}>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Consensus signals</div>
            <div className="mt-4 space-y-3">
              {(snapshot?.consensus || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Consensus appears once the network has enough overlapping validations.</p>
              ) : (
                snapshot?.consensus.map((item) => (
                  <div key={item.topic} className="rounded-sm border border-border/60 bg-background/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-foreground">{item.topic}</div>
                      <div className="text-sm font-semibold text-emerald-500">
                        {(item.consensusRating * 100).toFixed(0)}%
                      </div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{item.recommendedPosition}</p>
                    <div className="mt-3 text-xs text-muted-foreground">
                      {item.supportCount} support · {item.disputeCount} dispute · {item.uncertainCount} uncertain
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className={panelClass}>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Broadcast to network</div>
            <p className="mt-2 text-sm text-muted-foreground">
              Publish a concise update from {agentName} so the rest of the roster can react, validate, or reuse it.
            </p>
            <div className="mt-4 space-y-3">
              <Input
                value={broadcastTopic}
                onChange={(event) => setBroadcastTopic(event.target.value)}
                placeholder="Topic"
              />
              <Textarea
                value={broadcastSummary}
                onChange={(event) => setBroadcastSummary(event.target.value)}
                className="min-h-[120px]"
                placeholder="What did this agent discover, learn, or decide?"
              />
              <button
                type="button"
                onClick={() => void publishBroadcast()}
                disabled={pendingBroadcastId === 'manual'}
                className="inline-flex h-11 items-center gap-2 rounded-full bg-primary px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_44px_-26px_rgba(109,77,158,0.72)]"
              >
                {pendingBroadcastId === 'manual' ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {pendingBroadcastId === 'manual' ? 'Publishing...' : 'Publish broadcast'}
              </button>
            </div>
          </div>

          <div className={panelClass}>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Recent broadcasts</div>
            <div className="mt-4 space-y-3">
              {(snapshot?.broadcasts || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">No broadcasts yet.</p>
              ) : (
                snapshot?.broadcasts.map((broadcast) => (
                  <div key={broadcast.id} className="rounded-sm border border-border/60 bg-background/45 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="font-medium text-foreground">{broadcast.topic}</div>
                      <div className="text-xs text-muted-foreground">{new Date(broadcast.createdAt).toLocaleDateString()}</div>
                    </div>
                    <p className="mt-2 text-sm text-muted-foreground">{broadcast.summary}</p>
                    <div className="mt-3 text-xs text-muted-foreground">
                      By {broadcast.agentName} · reach {broadcast.reach}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className={panelClass}>
      <div className="text-3xl font-semibold text-foreground">{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
    </div>
  )
}

function KnowledgeCard({
  item,
  pendingValidationId,
  pendingBroadcastId,
  onSupport,
  onDispute,
  onBroadcast,
}: {
  item: SharedKnowledge
  pendingValidationId: string | null
  pendingBroadcastId: string | null
  onSupport: () => void
  onDispute: () => void
  onBroadcast: () => void
}) {
  const isLibraryItem = item.knowledgeSource === 'library_item'
  const supportPending = pendingValidationId === `${item.id}:support`
  const disputePending = pendingValidationId === `${item.id}:dispute`
  const broadcastPending = pendingBroadcastId === item.id

  return (
    <div className="rounded-sm border border-border/60 bg-background/45 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <div className="font-medium text-foreground">{item.topic}</div>
            {isLibraryItem && (
              <span className="inline-flex items-center gap-1 rounded-sm border border-primary/25 bg-primary/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.14em] text-primary">
                <Library className="h-3 w-3" aria-hidden="true" />
                Library
              </span>
            )}
          </div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {item.category}
            {item.libraryScope && ` · ${item.libraryScope}`}
          </div>
        </div>
        <div className="text-sm font-semibold text-emerald-500">{(item.confidence * 100).toFixed(0)}%</div>
      </div>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.content}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSupport}
          disabled={Boolean(pendingValidationId || pendingBroadcastId)}
          className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300"
        >
          {supportPending ? 'Validating...' : 'Validate'}
        </button>
        <button
          type="button"
          onClick={onDispute}
          disabled={Boolean(pendingValidationId || pendingBroadcastId)}
          className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-600 dark:text-rose-300"
        >
          {disputePending ? 'Flagging...' : 'Flag dispute'}
        </button>
        {isLibraryItem && (
          <>
            <button
              type="button"
              onClick={onBroadcast}
              disabled={Boolean(pendingValidationId || pendingBroadcastId)}
              className="inline-flex items-center gap-1 rounded-full bg-primary/15 px-3 py-1 text-xs font-medium text-primary"
            >
              {broadcastPending ? <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" /> : <Send className="h-3 w-3" aria-hidden="true" />}
              {broadcastPending ? 'Broadcasting...' : 'Broadcast'}
            </button>
            {item.libraryDetailHref && (
              <a
                href={item.libraryDetailHref}
                className="inline-flex items-center gap-1 rounded-full border border-border/60 px-3 py-1 text-xs font-medium text-muted-foreground transition hover:text-foreground"
              >
                <ExternalLink className="h-3 w-3" aria-hidden="true" />
                Library detail
              </a>
            )}
          </>
        )}
        <span className="text-xs text-muted-foreground">
          {item.endorsements.length} endorsements · {item.disputes.length} disputes
        </span>
      </div>
    </div>
  )
}

export default CollectiveIntelligencePanel
