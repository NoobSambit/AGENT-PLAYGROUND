'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import { motion } from 'framer-motion'
import { AlertTriangle, Loader2, RefreshCw, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RelationshipWorkspaceBootstrap } from '@/types/database'

import { parseResponse, percentage, premiumPanel } from './RelationshipHelpers'
import { NetworkStatTile } from './RelationshipAtoms'
import { RelationshipRoster } from './RelationshipRoster'
import { RelationshipHero } from './RelationshipHero'
import { RelationshipEvidence } from './RelationshipEvidence'
import { RelationshipProvenance } from './RelationshipProvenance'
import { RelationshipActions, type ConflictAnalysis } from './RelationshipActions'
import type { FilterId } from './RelationshipHelpers'

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

  // ── Actions ─────────────────────────────────────────────────────────────────
  const handleSelectPair = async (pairId: string) => {
    setSelectedPairId(pairId)
    await loadWorkspace(pairId, true)
  }

  const handleRecompute = async () => {
    if (!selectedPairId) return
    try {
      setRecomputing(true)
      await parseResponse(
        await fetch('/api/relationships', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'recompute_pair', pairId: selectedPairId }),
        })
      )
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
    <div className="space-y-5">
      {/* ── Workspace Header ── */}
      <div className={`${premiumPanel} p-5`}>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-md bg-pastel-blue/10 p-2.5">
              <Users className="h-5 w-5 text-pastel-blue" />
            </div>
            <div>
              <h2 className="text-lg font-bold leading-tight tracking-tight text-foreground">
                {agentName}&apos;s Social Network
              </h2>
              <p className="text-[11px] font-medium uppercase tracking-widest text-muted-foreground">
                Relationship Intelligence Workspace
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void loadWorkspace(selectedPairId, true)}
            disabled={refreshing}
          >
            <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            {refreshing ? 'Refreshing…' : 'Refresh'}
          </Button>
        </div>

        {/* Network stats strip */}
        <div className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-t border-border/20 pt-4 sm:grid-cols-3 lg:grid-cols-5">
          <NetworkStatTile
            label="Total Ties"
            value={ns.totalRelationships}
            hint="Persistent pair records"
          />
          <NetworkStatTile
            label="Strong Ties"
            value={ns.strongBonds}
            hint="Bond strength above threshold"
            accent="text-pastel-green"
          />
          <NetworkStatTile
            label="Tense Ties"
            value={ns.tenseRelationships}
            hint="Requires repair or caution"
            accent={ns.tenseRelationships > 0 ? 'text-pastel-yellow' : undefined}
          />
          <NetworkStatTile
            label="Recent Shifts"
            value={ns.recentShifts}
            hint="Revised in the last 7 days"
            accent={ns.recentShifts > 0 ? 'text-pastel-blue' : undefined}
          />
          <NetworkStatTile
            label="Network Role"
            value={ns.networkRole.replace(/_/g, ' ')}
            hint={`Avg trust ${percentage(ns.averageTrust)}`}
          />
        </div>
      </div>

      {/* ── Three-column workspace ── */}
      <div className="grid gap-5 xl:grid-cols-[280px_minmax(0,1fr)_300px]">
        {/* Left: Roster */}
        <div className={`${premiumPanel} p-4`}>
          <RelationshipRoster
            bootstrap={bootstrap}
            selectedPairId={selectedPairId}
            query={query}
            filter={filter}
            onQueryChange={setQuery}
            onFilterChange={setFilter}
            onSelectPair={(pairId) => void handleSelectPair(pairId)}
          />
        </div>

        {/* Main: Hero + Evidence + Actions */}
        <main className="min-w-0 space-y-5">
          {selectedPair ? (
            <>
              <RelationshipHero
                selectedPair={selectedPair}
                agentId={agentId}
                agentName={agentName}
                recomputing={recomputing}
                refreshing={refreshing}
                onRecompute={() => void handleRecompute()}
                onRefresh={() => void loadWorkspace(selectedPairId, true)}
              />
              <RelationshipEvidence detail={selectedPair} />
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
            </>
          ) : (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className={`${premiumPanel} flex flex-col items-center justify-center gap-3 py-16 text-center`}
            >
              <Users className="h-8 w-8 text-muted-foreground/40" />
              <div className="text-sm font-medium text-muted-foreground">
                Select a tie from the roster to inspect this relationship.
              </div>
            </motion.div>
          )}
        </main>

        {/* Right: Provenance */}
        <aside className="space-y-5">
          <RelationshipProvenance bootstrap={bootstrap} selectedPair={selectedPair} />
        </aside>
      </div>
    </div>
  )
}
