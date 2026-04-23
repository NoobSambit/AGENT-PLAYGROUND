'use client'

import { Activity, Layers } from 'lucide-react'
import type { RelationshipWorkspaceDetail, RelationshipSourceKind } from '@/types/database'
import { Collapsible, EmptyInline } from './RelationshipAtoms'
import { formatDateTime, percentage, signalTone, sourceMeta, subPanel } from './RelationshipHelpers'

// ─── SourceInfluence ──────────────────────────────────────────────────────────
function SourceInfluence({ detail }: { detail: RelationshipWorkspaceDetail }) {
  const entries = Object.entries(detail.relationship.sourceStats) as Array<
    [RelationshipSourceKind, { count: number; latestAt?: string }]
  >
  const totalCount = entries.reduce((sum, [, s]) => sum + s.count, 0)

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground mb-3">
        These systems contributed evidence that shaped this relationship&apos;s current state.
      </div>
      {entries.map(([source, stats]) => {
        const meta = sourceMeta[source]
        const pct = totalCount > 0 ? Math.round((stats.count / totalCount) * 100) : 0
        return (
          <div key={source} className={`${subPanel} flex items-center gap-3 px-3 py-2.5`}>
            <div className={`rounded-sm px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${meta.text} ${meta.bg}`}>
              {meta.label}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-muted/30">
                  <div
                    className={`h-full rounded-full ${meta.bg.replace('/10', '/60')}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
                <span className="text-[10px] tabular-nums text-muted-foreground">{stats.count}</span>
              </div>
              <div className="mt-0.5 text-[10px] text-muted-foreground/60">
                {stats.latestAt ? `Last: ${formatDateTime(stats.latestAt)}` : 'No evidence yet'}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── EvidenceTimeline ─────────────────────────────────────────────────────────
function EvidenceTimeline({ detail }: { detail: RelationshipWorkspaceDetail }) {
  if (detail.recentEvidence.length === 0) {
    return <EmptyInline text="No evidence captured for this pair yet." />
  }

  return (
    <div className="space-y-2">
      {detail.recentEvidence.map((entry) => {
        const meta = sourceMeta[entry.sourceKind]
        const signalClass = signalTone[entry.signalKind] ?? 'text-muted-foreground border-border/20 bg-muted/10'
        const valenceLabel = entry.valence > 0 ? 'Positive' : entry.valence < 0 ? 'Negative' : 'Neutral'
        const valenceColor = entry.valence > 0 ? 'text-pastel-green' : entry.valence < 0 ? 'text-pastel-red' : 'text-muted-foreground'

        return (
          <div key={entry.id} className={`${subPanel} p-3`}>
            {/* Signal + Source badges */}
            <div className="flex flex-wrap items-center gap-1.5 mb-2">
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${signalClass}`}>
                {entry.signalKind.replace(/_/g, ' ')}
              </span>
              <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase ${meta.text} ${meta.bg}`}>
                {meta.label}
              </span>
              <span className={`ml-auto text-[9px] font-semibold ${valenceColor}`}>
                {valenceLabel}
              </span>
            </div>

            {/* Summary */}
            <p className="text-[12px] leading-relaxed text-foreground/85">{entry.summary}</p>

            {/* Footer */}
            <div className="mt-2 flex flex-wrap items-center gap-3 border-t border-border/15 pt-2 text-[10px] text-muted-foreground">
              <span>{formatDateTime(entry.createdAt)}</span>
              <span>Confidence {percentage(entry.confidence)}</span>
              <span>Weight {percentage(entry.weight)}</span>
              {entry.excerptRefs.length > 0 && (
                <span>{entry.excerptRefs.length} linked ref{entry.excerptRefs.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── RelationshipEvidence ─────────────────────────────────────────────────────
export function RelationshipEvidence({ detail }: { detail: RelationshipWorkspaceDetail }) {
  return (
    <div className="space-y-3">
      <Collapsible
        title="Source Influence"
        icon={Layers}
        defaultOpen
        badge={`${Object.values(detail.relationship.sourceStats).reduce((s, v) => s + v.count, 0)} events`}
        accent="text-pastel-blue"
      >
        <SourceInfluence detail={detail} />
      </Collapsible>

      <Collapsible
        title="Evidence Timeline"
        icon={Activity}
        defaultOpen={detail.recentEvidence.length > 0}
        badge={`${detail.recentEvidence.length} items`}
        accent="text-pastel-purple"
      >
        <EvidenceTimeline detail={detail} />
      </Collapsible>
    </div>
  )
}
