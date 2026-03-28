'use client'

import { useCallback, useEffect, useState } from 'react'
import { CollectiveIntelligenceSnapshot, KnowledgeBroadcast } from '@/types/enhancements'
import { SharedKnowledge } from '@/types/database'
import { Input, Textarea } from '@/components/ui/input'
import { Search, Send } from 'lucide-react'

interface CollectiveIntelligencePanelProps {
  agentId: string
  agentName: string
}

const panelClass = 'rounded-[1.6rem] border border-border/70 bg-card/[0.62] p-5 backdrop-blur-xl'

export function CollectiveIntelligencePanel({ agentId, agentName }: CollectiveIntelligencePanelProps) {
  const [snapshot, setSnapshot] = useState<CollectiveIntelligenceSnapshot | null>(null)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const [broadcastTopic, setBroadcastTopic] = useState('')
  const [broadcastSummary, setBroadcastSummary] = useState('')

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

  const applyValidation = async (knowledgeId: string, verdict: 'support' | 'dispute') => {
    const rationale = verdict === 'support'
      ? 'Validated from the collective intelligence panel.'
      : 'Marked for review from the collective intelligence panel.'

    await fetch('/api/collective-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'validate',
        knowledgeId,
        agentId,
        verdict,
        rationale,
      }),
    })

    await fetchSnapshot(query)
  }

  const publishBroadcast = async () => {
    if (!broadcastTopic.trim() || !broadcastSummary.trim()) {
      return
    }

    const response = await fetch('/api/collective-intelligence', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'broadcast',
        agentId,
        topic: broadcastTopic.trim(),
        summary: broadcastSummary.trim(),
      }),
    })

    if (response.ok) {
      const data = await response.json()
      setSnapshot((prev) => prev
        ? { ...prev, broadcasts: [data.broadcast as KnowledgeBroadcast, ...prev.broadcasts].slice(0, 6) }
        : prev)
      setBroadcastTopic('')
      setBroadcastSummary('')
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
            className="inline-flex h-12 items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_44px_-26px_rgba(109,77,158,0.72)]"
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

      <div className="grid gap-6 xl:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className={panelClass}>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Expert referrals</div>
            <div className="mt-4 space-y-3">
              {(snapshot?.referrals || []).length === 0 ? (
                <p className="text-sm text-muted-foreground">Search for a topic to discover specialist agents and supporting knowledge.</p>
              ) : (
                snapshot?.referrals.map((referral) => (
                  <div key={referral.agentId} className="rounded-[1.3rem] border border-border/60 bg-background/45 p-4">
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
                    onSupport={() => void applyValidation(item.id, 'support')}
                    onDispute={() => void applyValidation(item.id, 'dispute')}
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
                  <div key={item.topic} className="rounded-[1.3rem] border border-border/60 bg-background/45 p-4">
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
                className="inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_44px_-26px_rgba(109,77,158,0.72)]"
              >
                <Send className="h-4 w-4" />
                Publish broadcast
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
                  <div key={broadcast.id} className="rounded-[1.3rem] border border-border/60 bg-background/45 p-4">
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
  onSupport,
  onDispute,
}: {
  item: SharedKnowledge
  onSupport: () => void
  onDispute: () => void
}) {
  return (
    <div className="rounded-[1.4rem] border border-border/60 bg-background/45 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="font-medium text-foreground">{item.topic}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">{item.category}</div>
        </div>
        <div className="text-sm font-semibold text-emerald-500">{(item.confidence * 100).toFixed(0)}%</div>
      </div>
      <p className="mt-3 text-sm leading-7 text-muted-foreground">{item.content}</p>
      <div className="mt-4 flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={onSupport}
          className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-600 dark:text-emerald-300"
        >
          Validate
        </button>
        <button
          type="button"
          onClick={onDispute}
          className="rounded-full bg-rose-500/15 px-3 py-1 text-xs font-medium text-rose-600 dark:text-rose-300"
        >
          Flag dispute
        </button>
        <span className="text-xs text-muted-foreground">
          {item.endorsements.length} endorsements · {item.disputes.length} disputes
        </span>
      </div>
    </div>
  )
}

export default CollectiveIntelligencePanel
