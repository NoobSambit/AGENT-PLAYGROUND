'use client'

import { AlertTriangle, GitBranch, Sparkles, Users } from 'lucide-react'
import type {
  RelationshipAlertFlag,
  RelationshipRevision,
  RelationshipSynthesisRun,
  RelationshipWorkspaceBootstrap,
  RelationshipWorkspaceDetail,
} from '@/types/database'
import { Collapsible, EmptyInline } from './RelationshipAtoms'
import {
  alertMeta,
  deltaTone,
  formatDateTime,
  percentage,
  subPanel,
} from './RelationshipHelpers'

// ─── RevisionCard ─────────────────────────────────────────────────────────────
function RevisionCard({ revision }: { revision: RelationshipRevision }) {
  const src = revision.sourceKind
  return (
    <div className={`${subPanel} p-3`}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[12px] leading-relaxed text-foreground/85">{revision.summary}</p>
        <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
          {percentage(revision.confidence)}
        </span>
      </div>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {src} · {formatDateTime(revision.createdAt)}
      </div>
      {/* Delta changes */}
      <div className="mt-2 flex flex-wrap gap-2 text-[10px]">
        {Object.entries(revision.delta.shared).map(([key, val]) =>
          val !== undefined ? (
            <span key={key} className={deltaTone(val as number)}>
              {key} {(val as number) > 0 ? '+' : ''}{(val as number).toFixed(2)}
            </span>
          ) : null
        )}
      </div>
    </div>
  )
}

// ─── SynthesisRunCard ─────────────────────────────────────────────────────────
function SynthesisRunCard({ run }: { run: RelationshipSynthesisRun }) {
  const statusClass =
    run.status === 'applied'
      ? 'bg-pastel-green/10 text-pastel-green'
      : run.status === 'skipped'
        ? 'bg-pastel-yellow/10 text-pastel-yellow'
        : 'bg-pastel-red/10 text-pastel-red'

  return (
    <div className={`${subPanel} p-3`}>
      <div className="flex items-center justify-between gap-2">
        <div className="text-[12px] font-medium text-foreground">{run.triggerSourceKind}</div>
        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold uppercase ${statusClass}`}>
          {run.status}
        </span>
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">
        {run.validatorResult.passed
          ? `${run.evidenceWindow.evidenceIds.length} evidence items applied.`
          : run.validatorResult.reasons.join('; ')}
      </div>
      <div className="mt-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {formatDateTime(run.createdAt)}
      </div>
    </div>
  )
}

// ─── NetworkShiftCard ─────────────────────────────────────────────────────────
function NetworkShiftCard({ revision }: { revision: RelationshipRevision }) {
  return (
    <div className={`${subPanel} p-3`}>
      <p className="text-[12px] leading-relaxed text-foreground/85">{revision.summary}</p>
      <div className="mt-1.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
        {revision.sourceKind} · {formatDateTime(revision.createdAt)}
      </div>
    </div>
  )
}

// ─── RelationshipProvenance ───────────────────────────────────────────────────
export function RelationshipProvenance({
  bootstrap,
  selectedPair,
}: {
  bootstrap: RelationshipWorkspaceBootstrap
  selectedPair?: RelationshipWorkspaceDetail
}) {
  return (
    <div className="space-y-3">
      {/* Network Alerts — shown if any */}
      {bootstrap.networkAlerts.length > 0 && (
        <div className="rounded-sm border border-pastel-yellow/25 bg-pastel-yellow/5 px-4 py-3">
          <div className="flex items-center gap-2 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-pastel-yellow" />
            <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-pastel-yellow">
              Network Alerts
            </span>
          </div>
          <div className="space-y-1.5">
            {bootstrap.networkAlerts.map((flag: RelationshipAlertFlag) => {
              const meta = alertMeta[flag]
              return (
                <div key={flag}>
                  <div className="text-[11px] font-semibold text-foreground/90">{meta.label}</div>
                  <div className="text-[10px] text-muted-foreground">{meta.hint}</div>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pair Revisions */}
      <Collapsible
        title="Revision History"
        icon={GitBranch}
        defaultOpen={Boolean(selectedPair?.recentRevisions.length)}
        badge={selectedPair?.recentRevisions.length ? `${selectedPair.recentRevisions.length}` : undefined}
        accent="text-pastel-blue"
      >
        <div className="space-y-2">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Long-term metric changes applied by the synthesis engine, with provenance.
          </div>
          {selectedPair?.recentRevisions.length ? (
            selectedPair.recentRevisions.map((r) => (
              <RevisionCard key={r.id} revision={r} />
            ))
          ) : (
            <EmptyInline text="No revisions applied for this pair yet." />
          )}
        </div>
      </Collapsible>

      {/* Synthesis Runs */}
      <Collapsible
        title="Synthesis Runs"
        icon={Sparkles}
        badge={selectedPair?.synthesisRuns.length ? `${selectedPair.synthesisRuns.length}` : undefined}
        accent="text-pastel-purple"
      >
        <div className="space-y-2">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Post-event evaluation attempts and validator results.
          </div>
          {selectedPair?.synthesisRuns.length ? (
            selectedPair.synthesisRuns.map((r) => (
              <SynthesisRunCard key={r.id} run={r} />
            ))
          ) : (
            <EmptyInline text="No synthesis runs stored for this pair yet." />
          )}
        </div>
      </Collapsible>

      {/* Network Shifts */}
      <Collapsible
        title="Network Shifts"
        icon={Users}
        badge={bootstrap.recentRevisions.length ? `${bootstrap.recentRevisions.length}` : undefined}
        accent="text-pastel-green"
      >
        <div className="space-y-2">
          <div className="mb-1 text-[11px] text-muted-foreground">
            Recent applied changes across the whole agent network.
          </div>
          {bootstrap.recentRevisions.length > 0 ? (
            bootstrap.recentRevisions.map((r) => (
              <NetworkShiftCard key={r.id} revision={r} />
            ))
          ) : (
            <EmptyInline text="No recent network-wide shifts." />
          )}
        </div>
      </Collapsible>
    </div>
  )
}
