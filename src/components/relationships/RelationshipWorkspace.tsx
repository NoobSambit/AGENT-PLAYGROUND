'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Database, GitBranch, Loader2, RefreshCw, ShieldAlert, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RelationshipWorkspaceBootstrap } from '@/types/database'
import { cn } from '@/lib/utils'

import { parseResponse, percentage, premiumPanel } from './RelationshipHelpers'
import { NetworkStatTile } from './RelationshipAtoms'
import { RelationshipRoster } from './RelationshipRoster'
import { RelationshipHero } from './RelationshipHero'
import { RelationshipEvidence } from './RelationshipEvidence'
import { RelationshipProvenance } from './RelationshipProvenance'
import { RelationshipActions, type ConflictAnalysis } from './RelationshipActions'
import type { FilterId } from './RelationshipHelpers'

type WorkspaceMode = 'overview' | 'evidence' | 'studio'

type RecomputeResult = {
  applied: boolean
  summary: string
  confidence: number
  supportingEvidenceIds: string[]
  reasons: string[]
  delta: {
    shared: Record<string, number | undefined>
  }
}

const panelClass = 'overflow-hidden rounded-xl border border-[#2d4058] bg-[#0c1726] shadow-[0_12px_30px_rgba(0,0,0,0.16)]'

interface RelationshipWorkspaceProps {
  agentId: string
  agentName: string
  agents: Array<{ id: string; name: string }>
}

export function RelationshipWorkspace({ agentId, agentName, agents }: RelationshipWorkspaceProps) {
  const [bootstrap, setBootstrap] = useState<RelationshipWorkspaceBootstrap | null>(null)
  const [selectedPairId, setSelectedPairId] = useState<string | undefined>(undefined)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterId>('all')
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [recomputing, setRecomputing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [manualSummary, setManualSummary] = useState('')
  const [manualSaving, setManualSaving] = useState(false)
  const [mode, setMode] = useState<WorkspaceMode>('overview')
  const [lastRecompute, setLastRecompute] = useState<{ result: RecomputeResult; completedAt: string } | null>(null)

  const selectedPair = bootstrap?.selectedPair

  // ── Data loading ────────────────────────────────────────────────────────────
  const loadWorkspace = useCallback(
    async (pairId?: string, refresh = false) => {
      try {
        setError(null)
        if (refresh) setRefreshing(true)
        else setLoading(true)
        const payload = await parseResponse<RelationshipWorkspaceBootstrap>(
          await fetch(
            `/api/relationships?agentId=${encodeURIComponent(agentId)}${pairId ? `&pairId=${encodeURIComponent(pairId)}` : ''}`,
            { cache: 'no-store' }
          )
        )
        setBootstrap(payload)
        setSelectedPairId(payload.selectedPairId)
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load relationship workspace')
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    [agentId]
  )

  useEffect(() => { void loadWorkspace() }, [loadWorkspace])

  // Reset per-pair form state on pair change
  useEffect(() => { setManualSummary('') }, [selectedPairId])
  useEffect(() => { setLastRecompute(null); setMode('overview') }, [selectedPairId])

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleSelectPair = async (pairId: string) => {
    setSelectedPairId(pairId)
    await loadWorkspace(pairId, true)
  }

  const handleRecompute = async () => {
    if (!selectedPairId) return
    try {
      setRecomputing(true)
      const payload = await parseResponse<{ result: RecomputeResult }>(
        await fetch('/api/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'recompute_pair', pairId: selectedPairId }),
        })
      )
      setLastRecompute({ result: payload.result, completedAt: new Date().toISOString() })
      setMode('studio')
      await loadWorkspace(selectedPairId, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to recompute relationship')
    } finally {
      setRecomputing(false)
    }
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
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save manual checkpoint')
    } finally {
      setManualSaving(false)
    }
  }

  const handleAnalyzeConflict = async (
    topic: string,
    currentPosition: string,
    otherPosition: string,
    mediatorId: string
  ): Promise<ConflictAnalysis | null> => {
    if (!selectedPair) return null
    try {
      const payload = await parseResponse<{ conflict: ConflictAnalysis }>(
        await fetch('/api/conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'analyze',
            agentId1: agentId,
            agentId2: selectedPair.otherAgent.id,
            topic,
            agent1Message: currentPosition,
            agent2Message: otherPosition,
            mediatorId: mediatorId || undefined,
          }),
        })
      )
      return payload.conflict
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to analyze conflict')
      return null
    }
  }

  const handleResolveConflict = async (analysis: ConflictAnalysis) => {
    try {
      await parseResponse(
        await fetch('/api/conflicts', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'resolve', conflictId: analysis.id }),
        })
      )
      await loadWorkspace(selectedPairId, true)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resolve conflict')
    }
  }

  const mediatorOptions = useMemo(
    () => agents.filter((a) => a.id !== agentId && a.id !== selectedPair?.otherAgent.id),
    [agentId, agents, selectedPair?.otherAgent.id]
  )

  // ── Loading ─────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="space-y-4">
        <div className={`${premiumPanel} p-5`}>
          <div className="flex items-center gap-3 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading relationship workspace…
          </div>
        </div>
        <div className="grid gap-4 xl:grid-cols-[280px_1fr_300px]">
          {[0, 1, 2].map((i) => (
            <div key={i} className={`${premiumPanel} min-h-[400px] animate-pulse`} />
          ))}
        </div>
      </div>
    )
  }

  // ── Error ────────────────────────────────────────────────────────────────────
  if (error) {
    return (
      <div className={`${premiumPanel} p-6`}>
        <div className="flex items-start gap-3">
          <AlertTriangle className="mt-0.5 h-4 w-4 text-pastel-red" />
          <div>
            <div className="text-sm font-semibold text-foreground">
              Relationship workspace unavailable
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{error}</p>
            <Button
              variant="outline"
              size="sm"
              className="mt-4"
              onClick={() => void loadWorkspace()}
            >
              Retry
            </Button>
          </div>
        </div>
      </div>
    )
  }

  // ── Empty ────────────────────────────────────────────────────────────────────
  if (!bootstrap || bootstrap.roster.length === 0) {
    return (
      <div className={`${premiumPanel} p-8`}>
        <div className="flex items-start gap-4">
          <div className="rounded-sm bg-pastel-blue/10 p-3 text-pastel-blue">
            <Users className="h-5 w-5" />
          </div>
          <div>
            <div className="text-xl font-semibold text-foreground">No persistent ties yet</div>
            <p className="mt-2 max-w-xl text-sm leading-relaxed text-muted-foreground">
              {agentName}&apos;s relationship layer is ready, but no arena, challenge, conflict, or
              mentorship evidence has been applied yet. Run a multi-agent workflow, then come back
              here to inspect the resulting social state.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const ns = bootstrap.networkSummary

  // ── Main layout ──────────────────────────────────────────────────────────────
  return (
    <section className="space-y-3" aria-label={`${agentName} relationship intelligence workspace`}>
      <header className="border-b border-[#263950] pb-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
          <div className="flex min-w-0 items-center gap-3">
            <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-[#b9addd]/45 bg-[#b9addd]/12 text-[#d2c4f2]"><Users className="h-5 w-5" aria-hidden="true" /></span>
            <div className="min-w-0"><h1 className="truncate text-xl font-semibold tracking-tight text-[#edf3fb]">{agentName}&apos;s Social Network</h1><p className="mt-0.5 text-xs text-[#9db0c7]">Relationship intelligence, evidence provenance, and guarded social actions.</p></div>
          </div>
          <button type="button" onClick={() => void loadWorkspace(selectedPairId, true)} disabled={refreshing} className="inline-flex min-h-9 items-center justify-center gap-2 rounded-md border border-[#30445d] bg-[#101c2b] px-3 text-xs font-semibold text-[#cbd8e6] hover:text-[#edf3fb] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9addd]"><RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} aria-hidden="true" />{refreshing ? 'Refreshing…' : 'Refresh'}</button>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2 border-t border-[#263950] pt-3 sm:grid-cols-3 xl:grid-cols-5">
          <NetworkStatTile
            label="Total Ties"
            value={ns.totalRelationships}
            hint="Persistent pair records"
          />
          <NetworkStatTile
            label="Strong Ties"
            value={ns.strongBonds}
            hint="Bond strength above threshold"
            accent="text-[#91d4ae]"
          />
          <NetworkStatTile
            label="Tense Ties"
            value={ns.tenseRelationships}
            hint="Requires repair or caution"
            accent={ns.tenseRelationships > 0 ? 'text-[#e7bb70]' : undefined}
          />
          <NetworkStatTile
            label="Recent Shifts"
            value={ns.recentShifts}
            hint="Revised in the last 7 days"
            accent={ns.recentShifts > 0 ? 'text-[#8ac9dc]' : undefined}
          />
          <NetworkStatTile
            label="Network Role"
            value={ns.networkRole.replace(/_/g, ' ')}
            hint={`Avg trust ${percentage(ns.averageTrust)}`}
          />
        </div>
      </header>

      <nav className="flex flex-wrap items-center gap-1 border-b border-[#263950] pb-3" aria-label="Relationship workspace modes" role="tablist">
        {[
          { id: 'overview', label: 'Overview', icon: Users },
          { id: 'evidence', label: 'Evidence & influence', icon: Database },
          { id: 'studio', label: 'Recompute & conflict studio', icon: ShieldAlert },
        ].map((item) => {
          const Icon = item.icon
          const active = mode === item.id
          return <button key={item.id} id={`relationship-mode-${item.id}`} type="button" role="tab" aria-selected={active} aria-controls="relationship-workspace-panel" tabIndex={active ? 0 : -1} onClick={() => setMode(item.id as WorkspaceMode)} className={active ? 'inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#b9addd] bg-[#b9addd] px-3 text-xs font-semibold text-[#171a28] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edf3fb]' : 'inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#30445d] bg-[#101c2b] px-3 text-xs font-semibold text-[#b8c8da] hover:text-[#edf3fb] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#b9addd]'}><Icon className="h-3.5 w-3.5" aria-hidden="true" />{item.label}</button>
        })}
      </nav>

      <div className="grid gap-3 xl:h-[calc(100vh-282px)] xl:min-h-[680px] xl:grid-cols-[310px_minmax(0,1fr)_330px]">
        <aside className={cn(panelClass, 'min-h-0 overflow-y-auto p-3')}>
          <RelationshipRoster
            bootstrap={bootstrap}
            selectedPairId={selectedPairId}
            query={query}
            filter={filter}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
            onSelectPair={(pairId) => void handleSelectPair(pairId)}
          />
        </aside>

        <main id="relationship-workspace-panel" aria-labelledby={`relationship-mode-${mode}`} className={cn(panelClass, 'min-h-0 overflow-y-auto p-3')} role="tabpanel">
          {selectedPair ? (
            <div className="space-y-3">
              {mode === 'overview' && <RelationshipHero
                selectedPair={selectedPair}
                agentId={agentId}
                agentName={agentName}
                recomputing={recomputing}
                refreshing={refreshing}
                onRecompute={() => void handleRecompute()}
                onRefresh={() => void loadWorkspace(selectedPairId, true)}
              />}
              {mode === 'evidence' && <RelationshipEvidence detail={selectedPair} agentName={agentName} />}
              {mode === 'studio' && <>
                <RecomputeOutcome result={lastRecompute} selectedPair={selectedPair} onRecompute={() => void handleRecompute()} recomputing={recomputing} />
                <RelationshipActions
                detail={selectedPair}
                agentId={agentId}
                agentName={agentName}
                mediatorOptions={mediatorOptions}
                manualSummary={manualSummary}
                manualSaving={manualSaving}
                onManualSummaryChange={setManualSummary}
                onSaveCheckpoint={() => void handleManualCheckpoint()}
                onAnalyzeConflict={handleAnalyzeConflict}
                onResolveConflict={handleResolveConflict}
                />
              </>}
            </div>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex min-h-[420px] flex-col items-center justify-center gap-3 text-center"
            >
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <div className="text-sm font-medium text-muted-foreground">
                Select a tie from the roster to inspect this relationship.
              </div>
            </motion.div>
          )}
        </main>

        <aside className={cn(panelClass, 'min-h-0 overflow-y-auto p-3')}>
          {mode === 'studio' && selectedPair && <RecomputeInspector selectedPair={selectedPair} result={lastRecompute?.result} />}
          <RelationshipProvenance bootstrap={bootstrap} selectedPair={selectedPair} />
        </aside>
      </div>
    </section>
  )
}

function RecomputeOutcome({ result, selectedPair, onRecompute, recomputing }: { result: { result: RecomputeResult; completedAt: string } | null; selectedPair: NonNullable<RelationshipWorkspaceBootstrap['selectedPair']>; onRecompute: () => void; recomputing: boolean }) {
  const sourceEvents = Object.values(selectedPair.relationship.sourceStats).reduce((total, source) => total + source.count, 0)
  const data = result?.result
  return <section className="rounded-lg border border-[#263950] bg-[#101c2b]" aria-label="Recompute relationship">
    <header className="flex flex-wrap items-center justify-between gap-3 border-b border-[#263950] px-4 py-3"><div><h2 className="text-sm font-semibold text-[#edf3fb]">Recompute relationship</h2><p className="mt-0.5 text-xs text-[#9db0c7]">Re-evaluate persisted evidence through the material-change gate.</p></div><button type="button" onClick={onRecompute} disabled={recomputing} className="inline-flex min-h-8 items-center gap-1.5 rounded-md border border-[#b9addd] bg-[#b9addd] px-3 text-xs font-semibold text-[#171a28] disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#edf3fb]"><GitBranch className={cn('h-3.5 w-3.5', recomputing && 'animate-spin')} aria-hidden="true" />{recomputing ? 'Recomputing…' : 'Recompute'}</button></header>
    <div className="grid grid-cols-2 divide-x divide-y divide-[#263950] sm:grid-cols-4"><RunMetric label="Input evidence" value={`${sourceEvents} events`} /><RunMetric label="Recent evidence" value={`${selectedPair.recentEvidence.length} items`} /><RunMetric label="Applied runs" value={String(selectedPair.synthesisRuns.filter((run) => run.status === 'applied').length)} /><RunMetric label="Result" value={data ? (data.applied ? 'Pair revised' : 'No material swing') : 'Awaiting run'} tone={data?.applied ? '#91d4ae' : '#b8c8da'} /></div>
    {data && <div className="border-t border-[#263950] p-3"><p className="text-xs leading-5 text-[#c3d0df]">{data.summary}</p><div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">{Object.entries(data.delta.shared).map(([metric, delta]) => delta !== undefined ? <RunMetric key={metric} label={metric} value={`${delta > 0 ? '+' : ''}${delta.toFixed(2)}`} tone={delta > 0 ? '#91d4ae' : delta < 0 ? '#e38b8c' : '#b8c8da'} /> : null)}</div><p className="mt-2 text-[11px] text-[#8da0b7]">Completed {new Intl.DateTimeFormat(undefined, { hour: 'numeric', minute: '2-digit' }).format(new Date(result.completedAt))} · {data.supportingEvidenceIds.length} evidence records evaluated · confidence {data.confidence.toFixed(2)}</p></div>}
  </section>
}

function RunMetric({ label, value, tone = '#dce8f6' }: { label: string; value: string; tone?: string }) {
  return <div className="min-w-0 px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-[#8da0b7]">{label}</p><p className="mt-1 truncate text-xs font-semibold" style={{ color: tone }}>{value}</p></div>
}

function RecomputeInspector({ selectedPair, result }: { selectedPair: NonNullable<RelationshipWorkspaceBootstrap['selectedPair']>; result?: RecomputeResult }) {
  const { relationship } = selectedPair
  const sourceRefs = selectedPair.recentEvidence.reduce((count, item) => count + item.excerptRefs.length, 0)
  const rows = [
    ['Status', result ? (result.applied ? 'Applied' : 'No material swing') : 'Ready'],
    ['Evidence considered', result ? String(result.supportingEvidenceIds.length) : String(selectedPair.recentEvidence.length)],
    ['Source references', String(sourceRefs)],
    ['Prompt influence', relationship.guidance.sides.some((side) => side.doMoreOf.length || side.avoid.length) ? 'Guarded' : 'None'],
  ]

  return <section className="mb-3 overflow-hidden rounded-lg border border-[#263950] bg-[#101c2b]" aria-labelledby="recompute-output-title">
    <header className="border-b border-[#263950] px-3 py-2.5"><h2 id="recompute-output-title" className="text-sm font-semibold text-[#edf3fb]">Recompute output</h2></header>
    <dl className="divide-y divide-[#263950] px-3">
      {rows.map(([label, value]) => <div key={label} className="flex items-center justify-between gap-3 py-2"><dt className="text-[11px] text-[#9db0c7]">{label}</dt><dd className="text-right text-[11px] font-medium text-[#edf3fb]">{value}</dd></div>)}
    </dl>
    <div className="border-t border-[#263950] px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8da0b7]">Threshold decision</p><p className="mt-1 text-[11px] leading-5 text-[#c3d0df]">A revision is persisted only when the shared material-change gate is met by the evaluated evidence.</p></div>
    {result?.reasons.length ? <div className="border-t border-[#263950] px-3 py-2.5"><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8da0b7]">Decision notes</p><ul className="mt-1 space-y-1">{result.reasons.slice(0, 3).map((reason) => <li key={reason} className="text-[11px] leading-4 text-[#c3d0df]">{reason}</li>)}</ul></div> : null}
  </section>
}
