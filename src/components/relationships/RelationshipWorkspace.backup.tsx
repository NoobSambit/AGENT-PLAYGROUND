'use client'

import { motion } from 'framer-motion'
import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertTriangle,
  ArrowUpRight,
  GitBranch,
  Handshake,
  Loader2,
  Orbit,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import type {
  RelationshipAlertFlag,
  RelationshipRosterItem,
  RelationshipSignalKind,
  RelationshipSourceKind,
  RelationshipWorkspaceBootstrap,
  RelationshipWorkspaceDetail,
} from '@/types/database'

interface RelationshipWorkspaceProps {
  agentId: string
  agentName: string
  agents: Array<{ id: string; name: string }>
}

interface ConflictResponse {
  conflict: {
    id: string
    topic: string
    tension: number
    resolutionStyle: string
    status: string
    commonGround: string[]
    frictionPoints: string[]
    actionItems: string[]
  }
}

const premiumPanel = 'rounded-md border border-border/40 bg-card/40 backdrop-blur-md shadow-sm'
const subPanel = 'rounded-sm border border-border/30 bg-muted/20'
const labelStyle = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80'

const filterOptions = [
  { id: 'all', label: 'All' },
  { id: 'allies', label: 'Allies' },
  { id: 'rivals', label: 'Rivals' },
  { id: 'mentors', label: 'Mentors' },
  { id: 'tense', label: 'Tense' },
  { id: 'recent', label: 'Recent' },
] as const

const signalTone: Record<RelationshipSignalKind, string> = {
  support: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20',
  agreement: 'text-sky-300 bg-sky-500/10 border-sky-400/20',
  constructive_disagreement: 'text-amber-300 bg-amber-500/10 border-amber-400/20',
  dismissal: 'text-rose-300 bg-rose-500/10 border-rose-400/20',
  conflict: 'text-rose-300 bg-rose-500/10 border-rose-400/20',
  repair: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20',
  follow_through: 'text-cyan-300 bg-cyan-500/10 border-cyan-400/20',
  betrayal: 'text-rose-300 bg-rose-500/10 border-rose-400/20',
  guidance: 'text-violet-300 bg-violet-500/10 border-violet-400/20',
  admiration: 'text-fuchsia-300 bg-fuchsia-500/10 border-fuchsia-400/20',
  coalition: 'text-emerald-300 bg-emerald-500/10 border-emerald-400/20',
  competition: 'text-amber-300 bg-amber-500/10 border-amber-400/20',
  mediation: 'text-sky-300 bg-sky-500/10 border-sky-400/20',
}

const sourceTone: Record<RelationshipSourceKind, string> = {
  arena: 'text-cyan-300',
  challenge: 'text-amber-300',
  conflict: 'text-rose-300',
  mentorship: 'text-violet-300',
  manual: 'text-emerald-300',
  simulation: 'text-muted-foreground',
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

function percentage(value: number) {
  return `${Math.round(value * 100)}%`
}

function deltaTone(value?: number) {
  if (!value) return 'text-muted-foreground'
  if (value > 0.01) return 'text-emerald-300'
  if (value < -0.01) return 'text-rose-300'
  return 'text-muted-foreground'
}

function statusTone(status: string) {
  if (status === 'growing') return 'text-emerald-300 border-emerald-400/20 bg-emerald-500/10'
  if (status === 'strained' || status === 'declining') return 'text-amber-300 border-amber-400/20 bg-amber-500/10'
  if (status === 'broken') return 'text-rose-300 border-rose-400/20 bg-rose-500/10'
  return 'text-sky-300 border-sky-400/20 bg-sky-500/10'
}

function filterRosterItem(item: RelationshipRosterItem, filter: (typeof filterOptions)[number]['id']) {
  if (filter === 'all') return true
  if (filter === 'allies') return item.relationshipTypes.includes('alliance') || item.relationshipTypes.includes('friendship') || item.relationshipTypes.includes('collaborator')
  if (filter === 'rivals') return item.relationshipTypes.includes('rivalry') || item.relationshipTypes.includes('adversarial')
  if (filter === 'mentors') return item.relationshipTypes.includes('mentorship')
  if (filter === 'tense') return item.alertFlags.includes('high_tension') || item.status === 'strained'
  if (filter === 'recent') {
    const age = Date.now() - new Date(item.lastInteraction).getTime()
    return age < 1000 * 60 * 60 * 24 * 7
  }
  return true
}

function SummaryMetric({ label, value, hint }: { label: string; value: string | number; hint: string }) {
  return (
    <div className="min-w-0 border-r border-border/20 pr-6 last:border-r-0 last:pr-0">
      <div className={labelStyle}>{label}</div>
      <div className="mt-2 text-2xl font-bold tracking-tight text-foreground">{value}</div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  )
}

function Meter({ label, value, accent }: { label: string; value: number; accent: string }) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3 text-[11px] font-medium">
        <span className="text-muted-foreground">{label}</span>
        <span className="text-foreground">{percentage(value)}</span>
      </div>
      <div className="h-1.5 rounded-full bg-muted/40">
        <motion.div
          initial={false}
          animate={{ width: `${Math.max(4, value * 100)}%` }}
          transition={{ duration: 0.35 }}
          className={`h-full rounded-full ${accent}`}
        />
      </div>
    </div>
  )
}

function SourceBreakdown({ detail }: { detail: RelationshipWorkspaceDetail }) {
  const entries = Object.entries(detail.relationship.sourceStats) as Array<[RelationshipSourceKind, { count: number; latestAt?: string }]>

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {entries.map(([source, stats]) => (
        <div key={source} className={`${subPanel} p-3`}>
          <div className={`text-[10px] font-bold uppercase tracking-[0.2em] ${sourceTone[source]}`}>{source}</div>
          <div className="mt-2 text-xl font-semibold text-foreground">{stats.count}</div>
          <div className="mt-1 text-[11px] text-muted-foreground">
            {stats.latestAt ? `Latest ${formatDateTime(stats.latestAt)}` : 'No evidence yet'}
          </div>
        </div>
      ))}
    </div>
  )
}

function NetworkMap({ bootstrap, selectedPairId, onSelect }: {
  bootstrap: RelationshipWorkspaceBootstrap
  selectedPairId?: string
  onSelect: (pairId: string) => void
}) {
  const centerX = 180
  const centerY = 110
  const radius = 82
  const peers = bootstrap.roster

  return (
    <div className={`${subPanel} overflow-hidden p-4`}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className={labelStyle}>Network View</div>
          <div className="mt-1 text-sm text-muted-foreground">Select a tie from the map or roster.</div>
        </div>
        <Orbit className="h-4 w-4 text-muted-foreground" />
      </div>
      <svg viewBox="0 0 360 220" className="mt-4 w-full">
        <circle cx={centerX} cy={centerY} r="38" fill="rgba(16,185,129,0.14)" stroke="rgba(16,185,129,0.25)" />
        <text x={centerX} y={centerY + 4} textAnchor="middle" className="fill-current text-[11px] font-semibold text-foreground">
          {bootstrap.agent.name}
        </text>
        {peers.map((item, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(peers.length, 1) - Math.PI / 2
          const x = centerX + radius * Math.cos(angle)
          const y = centerY + radius * Math.sin(angle)
          const selected = item.pairId === selectedPairId
          return (
            <g key={item.pairId} onClick={() => onSelect(item.pairId)} className="cursor-pointer">
              <line
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke={selected ? 'rgba(148,163,184,0.9)' : `rgba(148,163,184,${0.24 + item.derived.bondStrength * 0.45})`}
                strokeWidth={selected ? 2.6 : 1.4 + item.derived.bondStrength * 1.6}
              />
              <circle
                cx={x}
                cy={y}
                r={selected ? 18 : 14}
                fill={selected ? 'rgba(14,165,233,0.22)' : 'rgba(148,163,184,0.14)'}
                stroke={selected ? 'rgba(14,165,233,0.45)' : 'rgba(148,163,184,0.28)'}
              />
              <text x={x} y={y + 4} textAnchor="middle" className="fill-current text-[10px] font-semibold text-foreground">
                {item.otherAgentName.slice(0, 8)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

export function RelationshipWorkspace({ agentId, agentName, agents }: RelationshipWorkspaceProps) {
  const [bootstrap, setBootstrap] = useState<RelationshipWorkspaceBootstrap | null>(null)
  const [selectedPairId, setSelectedPairId] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<(typeof filterOptions)[number]['id']>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualSummary, setManualSummary] = useState('')
  const [manualSaving, setManualSaving] = useState(false)
  const [conflictTopic, setConflictTopic] = useState('')
  const [currentPosition, setCurrentPosition] = useState('')
  const [otherPosition, setOtherPosition] = useState('')
  const [mediatorId, setMediatorId] = useState('')
  const [conflictLoading, setConflictLoading] = useState(false)
  const [conflictAnalysis, setConflictAnalysis] = useState<ConflictResponse['conflict'] | null>(null)

  const selectedPair = bootstrap?.selectedPair

  const loadWorkspace = useCallback(async (pairId?: string, refresh = false) => {
    try {
      setError(null)
      if (refresh) setRefreshing(true)
      else setLoading(true)

      const payload = await parseResponse<RelationshipWorkspaceBootstrap>(
        await fetch(`/api/relationships?agentId=${encodeURIComponent(agentId)}${pairId ? `&pairId=${encodeURIComponent(pairId)}` : ''}`, {
          cache: 'no-store',
        })
      )
      setBootstrap(payload)
      setSelectedPairId(payload.selectedPairId)
    } catch (nextError) {
      console.error('Failed to load relationship workspace:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to load relationship workspace')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [agentId])

  useEffect(() => {
    void loadWorkspace()
  }, [loadWorkspace])

  useEffect(() => {
    setConflictAnalysis(null)
    setConflictTopic('')
    setCurrentPosition('')
    setOtherPosition('')
    setMediatorId('')
    setManualSummary('')
  }, [selectedPairId])

  const filteredRoster = useMemo(() => {
    const items = bootstrap?.roster || []
    return items.filter((item) => {
      const matchesFilter = filterRosterItem(item, filter)
      const matchesQuery = query.trim().length === 0
        ? true
        : item.otherAgentName.toLowerCase().includes(query.toLowerCase()) || item.relationshipTypes.join(' ').toLowerCase().includes(query.toLowerCase())
      return matchesFilter && matchesQuery
    })
  }, [bootstrap?.roster, filter, query])

  const mediatorOptions = useMemo(() => (
    agents.filter((agent) => agent.id !== agentId && agent.id !== selectedPair?.otherAgent.id)
  ), [agentId, agents, selectedPair?.otherAgent.id])

  const handleSelectPair = async (pairId: string) => {
    setSelectedPairId(pairId)
    await loadWorkspace(pairId, true)
  }

  const handleRefresh = async () => {
    await loadWorkspace(selectedPairId, true)
  }

  const handleManualCheckpoint = async () => {
    if (!selectedPair || !manualSummary.trim()) return

    try {
      setManualSaving(true)
      await parseResponse(
        await fetch('/api/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'add_manual_checkpoint',
            agentId1: agentId,
            agentId2: selectedPair.otherAgent.id,
            summary: manualSummary.trim(),
            signalKind: 'support',
            valence: 0.1,
            confidence: 0.76,
            weight: 0.62,
            metadata: { createdFrom: 'relationship_workspace' },
          }),
        })
      )
      setManualSummary('')
      await loadWorkspace(selectedPairId, true)
    } catch (nextError) {
      console.error('Failed to save manual checkpoint:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to save manual checkpoint')
    } finally {
      setManualSaving(false)
    }
  }

  const handleRecompute = async () => {
    if (!selectedPairId) return
    try {
      setRecomputing(true)
      await parseResponse(
        await fetch('/api/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'recompute_pair',
            pairId: selectedPairId,
          }),
        })
      )
      await loadWorkspace(selectedPairId, true)
    } catch (nextError) {
      console.error('Failed to recompute relationship:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to recompute relationship')
    } finally {
      setRecomputing(false)
    }
  }

  const analyzeConflict = async () => {
    if (!selectedPair || !conflictTopic.trim() || !currentPosition.trim() || !otherPosition.trim()) return

    try {
      setConflictLoading(true)
      const payload = await parseResponse<ConflictResponse>(
        await fetch('/api/conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze',
            agentId1: agentId,
            agentId2: selectedPair.otherAgent.id,
            topic: conflictTopic.trim(),
            agent1Message: currentPosition.trim(),
            agent2Message: otherPosition.trim(),
            mediatorId: mediatorId || undefined,
          }),
        })
      )

      setConflictAnalysis(payload.conflict)
    } catch (nextError) {
      console.error('Failed to analyze conflict:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to analyze conflict')
    } finally {
      setConflictLoading(false)
    }
  }

  const resolveConflict = async () => {
    if (!conflictAnalysis) return

    try {
      setConflictLoading(true)
      await parseResponse(
        await fetch('/api/conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'resolve',
            conflictId: conflictAnalysis.id,
          }),
        })
      )
      setConflictAnalysis((current) => current ? {
        ...current,
        status: current.resolutionStyle === 'agree_to_disagree' ? 'stalemate' : 'resolved',
      } : current)
      await loadWorkspace(selectedPairId, true)
    } catch (nextError) {
      console.error('Failed to resolve conflict:', nextError)
      setError(nextError instanceof Error ? nextError.message : 'Failed to resolve conflict')
    } finally {
      setConflictLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="space-y-5">
        <div className={`${premiumPanel} p-6`}>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading relationship workspace…
          </div>
        </div>
        <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_320px]">
          <div className={`${premiumPanel} min-h-[520px] animate-pulse`} />
          <div className={`${premiumPanel} min-h-[520px] animate-pulse`} />
          <div className={`${premiumPanel} min-h-[520px] animate-pulse`} />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${premiumPanel} p-6`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-rose-300" />
          <div>
            <div className="text-sm font-semibold text-foreground">Relationship workspace unavailable</div>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button onClick={() => void handleRefresh()} variant="outline" className="mt-4">
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  if (!bootstrap || bootstrap.roster.length === 0) {
    return (
      <div className={`${premiumPanel} p-8`}>
        <div className="flex items-start gap-4">
          <div className="rounded-sm bg-emerald-500/10 p-3 text-emerald-300">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-semibold text-foreground">No persistent ties yet</div>
            <p className="mt-2 max-w-xl text-sm leading-6 text-muted-foreground">
              {agentName}&apos;s relationship layer is ready, but no arena, challenge, conflict, or mentorship evidence has been applied yet.
              Run a multi-agent workflow, then come back here to inspect the resulting social state, revisions, and prompt guidance.
            </p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      <div className={`${premiumPanel} p-5`}>
        <div className="flex flex-col gap-5 xl:flex-row xl:items-end xl:justify-between">
          <div>
            <div className={labelStyle}>Relationship Workspace</div>
            <h2 className="mt-2 text-2xl font-bold tracking-tight text-foreground">Social state for {agentName}</h2>
            <p className="mt-2 max-w-3xl text-sm leading-6 text-muted-foreground">
              Persistent bonds, tensions, revisions, and source evidence across Arena, Challenge, Conflict, and Mentorship.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => void handleRefresh()} disabled={refreshing}>
              {refreshing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <RefreshCw className="mr-2 h-4 w-4" />}
              Refresh
            </Button>
          </div>
        </div>
        <div className="mt-6 grid gap-4 border-t border-border/20 pt-5 sm:grid-cols-2 xl:grid-cols-5">
          <SummaryMetric label="Total Ties" value={bootstrap.networkSummary.totalRelationships} hint="Persistent pair records" />
          <SummaryMetric label="Strong Ties" value={bootstrap.networkSummary.strongBonds} hint="Bond strength above threshold" />
          <SummaryMetric label="Tense Ties" value={bootstrap.networkSummary.tenseRelationships} hint="Requires repair or caution" />
          <SummaryMetric label="Recent Shifts" value={bootstrap.networkSummary.recentShifts} hint="Revised in the last 7 days" />
          <SummaryMetric label="Network Role" value={bootstrap.networkSummary.networkRole.replace(/_/g, ' ')} hint={`Average trust ${percentage(bootstrap.networkSummary.averageTrust)}`} />
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[290px_minmax(0,1fr)_320px]">
        <aside className={`${premiumPanel} p-4`}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className={labelStyle}>Roster</div>
              <div className="mt-1 text-sm text-muted-foreground">Filter and inspect one relationship at a time.</div>
            </div>
            <Target className="h-4 w-4 text-muted-foreground" />
          </div>

          <div className="mt-4 space-y-3">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search ties"
              aria-label="Search relationships"
            />
            <div className="flex flex-wrap gap-1.5">
              {filterOptions.map((option) => {
                const active = option.id === filter
                return (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setFilter(option.id)}
                    className={[
                      'rounded-full border px-3 py-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] transition-colors',
                      active
                        ? 'border-sky-400/20 bg-sky-500/10 text-sky-300'
                        : 'border-border/25 bg-background/20 text-muted-foreground hover:text-foreground',
                    ].join(' ')}
                  >
                    {option.label}
                  </button>
                )
              })}
            </div>
          </div>

          <div className="mt-4 max-h-[520px] space-y-2 overflow-y-auto pr-1">
            {filteredRoster.map((item) => {
              const selected = item.pairId === selectedPairId
              return (
                <button
                  key={item.pairId}
                  type="button"
                  onClick={() => void handleSelectPair(item.pairId)}
                  className={[
                    'w-full rounded-sm border px-3 py-3 text-left transition-all',
                    selected
                      ? 'border-sky-400/20 bg-sky-500/10'
                      : 'border-border/20 bg-background/20 hover:border-border/40 hover:bg-background/30',
                  ].join(' ')}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-sm font-semibold text-foreground">{item.otherAgentName}</div>
                      <div className="mt-1 flex flex-wrap gap-1">
                        {item.relationshipTypes.slice(0, 2).map((type) => (
                          <span key={type} className="rounded-full border border-border/20 px-2 py-0.5 text-[10px] uppercase tracking-[0.16em] text-muted-foreground">
                            {type.replace(/_/g, ' ')}
                          </span>
                        ))}
                      </div>
                    </div>
                    <span className={`rounded-full border px-2 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${statusTone(item.status)}`}>
                      {item.status}
                    </span>
                  </div>
                  <div className="mt-3 grid gap-2">
                    <Meter label="Bond" value={item.derived.bondStrength} accent="bg-emerald-400" />
                    <Meter label="Tension" value={item.derived.tension} accent="bg-amber-400" />
                  </div>
                  {item.latestRevisionSummary && (
                    <div className="mt-3 text-[11px] leading-5 text-muted-foreground">{item.latestRevisionSummary}</div>
                  )}
                </button>
              )
            })}
          </div>

          <div className="mt-4">
            <NetworkMap bootstrap={bootstrap} selectedPairId={selectedPairId} onSelect={(pairId) => void handleSelectPair(pairId)} />
          </div>
        </aside>

        <main className="min-w-0 space-y-5">
          {selectedPair ? (
            <>
              <motion.section
                key={selectedPair.relationship.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.25 }}
                className={`${premiumPanel} p-5`}
              >
                <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                  <div className="min-w-0">
                    <div className={labelStyle}>Selected Relationship</div>
                    <div className="mt-2 flex flex-wrap items-center gap-3">
                      <h3 className="text-3xl font-bold tracking-tight text-foreground">{selectedPair.otherAgent.name}</h3>
                      <span className={`rounded-full border px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] ${statusTone(selectedPair.relationship.status)}`}>
                        {selectedPair.relationship.status}
                      </span>
                    </div>
                    {selectedPair.otherAgent.persona && (
                      <p className="mt-3 max-w-3xl text-sm leading-6 text-muted-foreground">{selectedPair.otherAgent.persona.slice(0, 280)}</p>
                    )}
                    <div className="mt-4 flex flex-wrap gap-2">
                      {selectedPair.relationship.relationshipTypes.map((type) => (
                        <span key={type} className="rounded-full border border-border/25 bg-background/20 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-foreground/80">
                          {type.replace(/_/g, ' ')}
                        </span>
                      ))}
                      {selectedPair.relationship.alertFlags.map((flag) => (
                        <span key={flag} className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-300">
                          {flag.replace(/_/g, ' ')}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-wrap gap-2">
                    <Button variant="outline" onClick={() => void handleRecompute()} disabled={recomputing}>
                      {recomputing ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitBranch className="mr-2 h-4 w-4" />}
                      Recompute
                    </Button>
                    <Button variant="outline" onClick={() => void handleRefresh()} disabled={refreshing}>
                      <RefreshCw className="mr-2 h-4 w-4" />
                      Refresh Pair
                    </Button>
                  </div>
                </div>

                <div className="mt-6 grid gap-4 border-t border-border/20 pt-5 lg:grid-cols-5">
                  <SummaryMetric label="Bond" value={percentage(selectedPair.relationship.derived.bondStrength)} hint="Overall tie strength" />
                  <SummaryMetric label="Tension" value={percentage(selectedPair.relationship.derived.tension)} hint="Current friction load" />
                  <SummaryMetric label="Reciprocity" value={percentage(selectedPair.relationship.derived.reciprocity)} hint="How symmetrical the tie feels" />
                  <SummaryMetric label="Volatility" value={percentage(selectedPair.relationship.derived.volatility)} hint="How quickly it swings" />
                  <SummaryMetric label="Momentum" value={selectedPair.relationship.derived.momentum.toFixed(2)} hint="Recent direction of change" />
                </div>

                <div className="mt-6 grid gap-4 xl:grid-cols-2">
                  {[agentId, selectedPair.otherAgent.id].map((sideAgentId) => {
                    const side = selectedPair.relationship.directional[sideAgentId]
                    const selfSide = sideAgentId === agentId
                    return (
                      <div key={sideAgentId} className={`${subPanel} p-4`}>
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <div className={labelStyle}>{selfSide ? `${agentName}'s View` : `${selectedPair.otherAgent.name}'s View`}</div>
                            <div className="mt-1 text-sm font-semibold text-foreground">{side.summary}</div>
                          </div>
                          <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                        </div>
                        <div className="mt-4 grid gap-3">
                          <Meter label="Trust" value={side.trust} accent="bg-emerald-400" />
                          <Meter label="Respect" value={side.respect} accent="bg-sky-400" />
                          <Meter label="Affection" value={side.affection} accent="bg-fuchsia-400" />
                          <Meter label="Alignment" value={side.alignment} accent="bg-violet-400" />
                          <Meter label="Reliance" value={side.reliance} accent="bg-cyan-400" />
                          <Meter label="Grievance" value={side.grievance} accent="bg-amber-400" />
                        </div>
                        <div className="mt-4 grid gap-3 sm:grid-cols-2">
                          <div>
                            <div className={labelStyle}>Levers</div>
                            <div className="mt-2 space-y-2 text-[12px] text-muted-foreground">
                              {side.levers.length > 0 ? side.levers.map((entry) => (
                                <div key={entry}>{entry}</div>
                              )) : <div>No strong positive levers stored yet.</div>}
                            </div>
                          </div>
                          <div>
                            <div className={labelStyle}>Sensitivities</div>
                            <div className="mt-2 space-y-2 text-[12px] text-muted-foreground">
                              {side.sensitivities.length > 0 ? side.sensitivities.map((entry) => (
                                <div key={entry}>{entry}</div>
                              )) : <div>No recurring sensitivities stored yet.</div>}
                            </div>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>

                <div className="mt-6">
                  <div className={labelStyle}>Source Influence</div>
                  <div className="mt-3">
                    <SourceBreakdown detail={selectedPair} />
                  </div>
                </div>
              </motion.section>

              <section className={`${premiumPanel} p-5`}>
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className={labelStyle}>Evidence Timeline</div>
                    <div className="mt-1 text-sm text-muted-foreground">Every social shift is tied back to a source event.</div>
                  </div>
                  <Sparkles className="h-4 w-4 text-muted-foreground" />
                </div>
                <div className="mt-4 space-y-3">
                  {selectedPair.recentEvidence.length > 0 ? selectedPair.recentEvidence.map((entry) => (
                    <div key={entry.id} className={`${subPanel} p-4`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={`rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${signalTone[entry.signalKind] || 'text-muted-foreground border-border/20'}`}>
                              {entry.signalKind.replace(/_/g, ' ')}
                            </span>
                            <span className={`text-[10px] font-bold uppercase tracking-[0.18em] ${sourceTone[entry.sourceKind]}`}>{entry.sourceKind}</span>
                          </div>
                          <div className="mt-2 text-sm leading-6 text-foreground/90">{entry.summary}</div>
                        </div>
                        <div className="text-right text-[11px] text-muted-foreground">
                          <div>Confidence {percentage(entry.confidence)}</div>
                          <div>Weight {percentage(entry.weight)}</div>
                          <div className={deltaTone(entry.valence)}>{entry.valence > 0 ? 'Positive' : entry.valence < 0 ? 'Negative' : 'Neutral'}</div>
                        </div>
                      </div>
                      <div className="mt-3 flex flex-wrap items-center justify-between gap-3 border-t border-border/15 pt-3 text-[11px] text-muted-foreground">
                        <span>{formatDateTime(entry.createdAt)}</span>
                        <span>{entry.excerptRefs.length > 0 ? `${entry.excerptRefs.length} linked refs` : 'No excerpt refs'}</span>
                      </div>
                    </div>
                  )) : (
                    <div className={`${subPanel} p-4 text-sm text-muted-foreground`}>No evidence captured for this pair yet.</div>
                  )}
                </div>
              </section>

              <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
                <div className={`${premiumPanel} p-5`}>
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className={labelStyle}>Conflict Studio</div>
                      <div className="mt-1 text-sm text-muted-foreground">Analyze disagreement, then turn the result into relationship evidence through the shared pipeline.</div>
                    </div>
                    <ShieldAlert className="h-4 w-4 text-muted-foreground" />
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-foreground">Conflict topic</label>
                      <Input value={conflictTopic} onChange={(event) => setConflictTopic(event.target.value)} className="mt-2" placeholder="What are they disagreeing about?" />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">Mediator</label>
                      <select
                        value={mediatorId}
                        onChange={(event) => setMediatorId(event.target.value)}
                        className="mt-2 h-10 w-full rounded-sm border border-border/30 bg-background/30 px-3 text-sm text-foreground outline-none"
                      >
                        <option value="">No mediator</option>
                        {mediatorOptions.map((agent) => (
                          <option key={agent.id} value={agent.id}>{agent.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="mt-4 grid gap-4 md:grid-cols-2">
                    <div>
                      <label className="text-sm font-medium text-foreground">{agentName}&apos;s position</label>
                      <Textarea value={currentPosition} onChange={(event) => setCurrentPosition(event.target.value)} className="mt-2 min-h-[150px]" placeholder="Describe this agent's argument." />
                    </div>
                    <div>
                      <label className="text-sm font-medium text-foreground">{selectedPair.otherAgent.name}&apos;s position</label>
                      <Textarea value={otherPosition} onChange={(event) => setOtherPosition(event.target.value)} className="mt-2 min-h-[150px]" placeholder="Describe the opposing view." />
                    </div>
                  </div>

                  <div className="mt-5 flex flex-wrap gap-2">
                    <Button onClick={() => void analyzeConflict()} disabled={conflictLoading}>
                      {conflictLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Handshake className="mr-2 h-4 w-4" />}
                      Analyze Conflict
                    </Button>
                    {conflictAnalysis && (
                      <Button variant="outline" onClick={() => void resolveConflict()} disabled={conflictLoading}>
                        Apply Resolution
                      </Button>
                    )}
                  </div>

                  {conflictAnalysis && (
                    <div className={`${subPanel} mt-5 p-4`}>
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold text-foreground">{conflictAnalysis.topic}</div>
                          <div className="mt-1 text-[11px] uppercase tracking-[0.18em] text-muted-foreground">
                            {conflictAnalysis.resolutionStyle.replace(/_/g, ' ')} · {conflictAnalysis.status}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className={labelStyle}>Tension</div>
                          <div className="mt-1 text-xl font-semibold text-amber-300">{percentage(conflictAnalysis.tension)}</div>
                        </div>
                      </div>
                      <div className="mt-4 grid gap-4 md:grid-cols-2">
                        <div>
                          <div className={labelStyle}>Common Ground</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {conflictAnalysis.commonGround.length > 0 ? conflictAnalysis.commonGround.map((entry) => (
                              <span key={entry} className="rounded-full border border-emerald-400/20 bg-emerald-500/10 px-3 py-1 text-[11px] text-emerald-300">{entry}</span>
                            )) : <span className="text-[12px] text-muted-foreground">None identified yet.</span>}
                          </div>
                        </div>
                        <div>
                          <div className={labelStyle}>Friction Points</div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {conflictAnalysis.frictionPoints.map((entry) => (
                              <span key={entry} className="rounded-full border border-rose-400/20 bg-rose-500/10 px-3 py-1 text-[11px] text-rose-300">{entry}</span>
                            ))}
                          </div>
                        </div>
                      </div>
                      <div className="mt-4">
                        <div className={labelStyle}>Action Items</div>
                        <div className="mt-2 space-y-2 text-sm text-muted-foreground">
                          {conflictAnalysis.actionItems.map((entry) => (
                            <div key={entry}>{entry}</div>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>

                <div className="space-y-5">
                  <div className={`${premiumPanel} p-5`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className={labelStyle}>Prompt Guidance</div>
                        <div className="mt-1 text-sm text-muted-foreground">What this pair injects into later prompts.</div>
                      </div>
                      <Sparkles className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <div className="mt-4 text-sm leading-6 text-foreground/90">{selectedPair.relationship.guidance.sharedSummary}</div>
                    <div className="mt-4 space-y-4">
                      {selectedPair.relationship.guidance.sides.map((side) => {
                        const title = side.agentId === agentId ? `${agentName} prompt` : `${selectedPair.otherAgent.name} prompt`
                        return (
                          <div key={side.agentId} className={`${subPanel} p-3`}>
                            <div className="text-[11px] font-semibold text-foreground">{title}</div>
                            <div className="mt-2 text-[12px] leading-5 text-muted-foreground">{side.speakerSummary}</div>
                            <div className="mt-3">
                              <div className={labelStyle}>Do More Of</div>
                              <div className="mt-2 space-y-2 text-[12px] text-muted-foreground">
                                {side.doMoreOf.length > 0 ? side.doMoreOf.map((entry) => <div key={entry}>{entry}</div>) : <div>No explicit positive guidance stored.</div>}
                              </div>
                            </div>
                            <div className="mt-3">
                              <div className={labelStyle}>Avoid</div>
                              <div className="mt-2 space-y-2 text-[12px] text-muted-foreground">
                                {side.avoid.length > 0 ? side.avoid.map((entry) => <div key={entry}>{entry}</div>) : <div>No explicit caution flags stored.</div>}
                              </div>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  </div>

                  <div className={`${premiumPanel} p-5`}>
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className={labelStyle}>Manual Checkpoint</div>
                        <div className="mt-1 text-sm text-muted-foreground">Capture a reviewed social note without editing metrics directly.</div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-muted-foreground" />
                    </div>
                    <Textarea
                      value={manualSummary}
                      onChange={(event) => setManualSummary(event.target.value)}
                      className="mt-4 min-h-[132px]"
                      placeholder="Example: The arena showed rising respect despite disagreement on execution details."
                    />
                    <Button className="mt-4 w-full" onClick={() => void handleManualCheckpoint()} disabled={manualSaving || !manualSummary.trim()}>
                      {manualSaving ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <GitBranch className="mr-2 h-4 w-4" />}
                      Save Checkpoint
                    </Button>
                  </div>
                </div>
              </section>
            </>
          ) : (
            <div className={`${premiumPanel} p-6 text-sm text-muted-foreground`}>
              Select a relationship from the roster to inspect the pair board.
            </div>
          )}
        </main>

        <aside className="space-y-5">
          <section className={`${premiumPanel} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={labelStyle}>Revisions</div>
                <div className="mt-1 text-sm text-muted-foreground">Applied long-term changes with provenance.</div>
              </div>
              <GitBranch className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-4 space-y-3">
              {selectedPair?.recentRevisions.length ? selectedPair.recentRevisions.map((revision) => (
                <div key={revision.id} className={`${subPanel} p-3`}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="text-sm font-medium text-foreground">{revision.summary}</div>
                    <div className="text-[11px] text-muted-foreground">{percentage(revision.confidence)}</div>
                  </div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {revision.sourceKind} · {formatDateTime(revision.createdAt)}
                  </div>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-muted-foreground">
                    <div className={deltaTone(revision.delta.shared.trust)}>Trust {revision.delta.shared.trust?.toFixed(2) || '0.00'}</div>
                    <div className={deltaTone(revision.delta.shared.respect)}>Respect {revision.delta.shared.respect?.toFixed(2) || '0.00'}</div>
                    <div className={deltaTone(revision.delta.shared.affection)}>Affection {revision.delta.shared.affection?.toFixed(2) || '0.00'}</div>
                    <div className={deltaTone(revision.delta.left.alignment)}>Alignment {revision.delta.left.alignment?.toFixed(2) || '0.00'}</div>
                  </div>
                </div>
              )) : (
                <div className={`${subPanel} p-3 text-sm text-muted-foreground`}>No revisions applied for the selected pair yet.</div>
              )}
            </div>
          </section>

          <section className={`${premiumPanel} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={labelStyle}>Synthesis Runs</div>
                <div className="mt-1 text-sm text-muted-foreground">Post-run evaluation attempts and validation results.</div>
              </div>
              <Sparkles className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-4 space-y-3">
              {selectedPair?.synthesisRuns.length ? selectedPair.synthesisRuns.map((run) => (
                <div key={run.id} className={`${subPanel} p-3`}>
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-medium text-foreground">{run.triggerSourceKind}</div>
                    <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-[0.16em] ${run.status === 'applied' ? 'bg-emerald-500/10 text-emerald-300' : run.status === 'skipped' ? 'bg-amber-500/10 text-amber-300' : 'bg-rose-500/10 text-rose-300'}`}>
                      {run.status}
                    </span>
                  </div>
                  <div className="mt-2 text-[11px] text-muted-foreground">
                    {run.validatorResult.passed ? `${run.evidenceWindow.evidenceIds.length} evidence items applied.` : run.validatorResult.reasons.join('; ')}
                  </div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">{formatDateTime(run.createdAt)}</div>
                </div>
              )) : (
                <div className={`${subPanel} p-3 text-sm text-muted-foreground`}>No synthesis runs stored for this pair yet.</div>
              )}
            </div>
          </section>

          <section className={`${premiumPanel} p-5`}>
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className={labelStyle}>Network Shifts</div>
                <div className="mt-1 text-sm text-muted-foreground">Recent applied changes across the whole agent network.</div>
              </div>
              <Users className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="mt-4 space-y-3">
              {bootstrap.recentRevisions.map((revision) => (
                <div key={revision.id} className={`${subPanel} p-3`}>
                  <div className="text-sm font-medium text-foreground">{revision.summary}</div>
                  <div className="mt-2 text-[11px] uppercase tracking-[0.16em] text-muted-foreground">
                    {revision.sourceKind} · {formatDateTime(revision.createdAt)}
                  </div>
                </div>
              ))}
            </div>
          </section>

          {bootstrap.networkAlerts.length > 0 && (
            <section className={`${premiumPanel} p-5`}>
              <div className="flex items-center gap-3">
                <AlertTriangle className="h-4 w-4 text-amber-300" />
                <div className="text-sm font-semibold text-foreground">Network Alerts</div>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {bootstrap.networkAlerts.map((flag: RelationshipAlertFlag) => (
                  <span key={flag} className="rounded-full border border-amber-400/20 bg-amber-500/10 px-3 py-1 text-[11px] uppercase tracking-[0.16em] text-amber-300">
                    {flag.replace(/_/g, ' ')}
                  </span>
                ))}
              </div>
            </section>
          )}
        </aside>
      </div>
    </div>
  )
}
