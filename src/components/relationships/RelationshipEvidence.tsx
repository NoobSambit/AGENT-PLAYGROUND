'use client'

import { Activity, Layers } from 'lucide-react'
import type { RelationshipWorkspaceDetail, RelationshipSourceKind } from '@/types/database'
import { EmptyInline } from './RelationshipAtoms'
import { formatDateTime, percentage, signalTone, sourceMeta, subPanel } from './RelationshipHelpers'

// ─── SourceInfluence ──────────────────────────────────────────────────────────
const sourceBarColor: Record<RelationshipSourceKind, string> = {
  arena: '#78b9eb',
  challenge: '#e7bb70',
  conflict: '#e38b8c',
  mentorship: '#c3a6e8',
  manual: '#91d4ae',
  simulation: '#8da0b7',
}

function SourceInfluence({ detail }: { detail: RelationshipWorkspaceDetail }) {
  const entries = Object.entries(detail.relationship.sourceStats) as Array<
    [RelationshipSourceKind, { count: number; latestAt?: string }]
  >
  const totalCount = entries.reduce((sum, [, s]) => sum + s.count, 0)
  const activeEntries = entries.filter(([, stats]) => stats.count > 0)
  const inactiveLabels = entries.filter(([, stats]) => stats.count === 0).map(([source]) => sourceMeta[source].label)

  return (
    <div className="space-y-3 py-3">
      {activeEntries.length > 0 ? activeEntries.map(([source, stats]) => {
        const meta = sourceMeta[source]
        const pct = totalCount > 0 ? Math.round((stats.count / totalCount) * 100) : 0
        return (
          <div key={source} className="grid grid-cols-[104px_minmax(0,1fr)_34px] items-center gap-3">
            <span className={`w-fit rounded px-2 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] ${meta.text} ${meta.bg}`}>{meta.label}</span>
            <div className="min-w-0">
              <div className="h-1.5 overflow-hidden rounded-full bg-[#263950]" aria-label={`${meta.label}: ${stats.count} evidence events`}>
                <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: sourceBarColor[source] }} />
              </div>
              <p className="mt-1 truncate text-[10px] text-[#8da0b7]">{stats.latestAt ? `Latest ${formatDateTime(stats.latestAt)}` : 'No date recorded'}</p>
            </div>
            <span className="text-right text-sm font-semibold tabular-nums text-[#edf3fb]">{stats.count}</span>
          </div>
        )
      }) : <EmptyInline text="No source has contributed evidence to this relationship yet." />}
      {inactiveLabels.length > 0 && <p className="border-t border-[#263950] pt-2 text-[10px] leading-4 text-[#8da0b7]">No contribution recorded from {inactiveLabels.join(', ')}.</p>}
    </div>
  )
}

// ─── EvidenceTimeline ─────────────────────────────────────────────────────────
function readableEvidenceSummary(entry: RelationshipWorkspaceDetail['recentEvidence'][number], detail: RelationshipWorkspaceDetail, agentName: string) {
  const activeAgentId = detail.relationship.agentId1 === detail.otherAgent.id ? detail.relationship.agentId2 : detail.relationship.agentId1
  return entry.summary
    .replaceAll(activeAgentId, agentName)
    .replaceAll(detail.otherAgent.id, detail.otherAgent.name)
}

function EvidenceTimeline({ detail, agentName }: { detail: RelationshipWorkspaceDetail; agentName: string }) {
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
          <article key={entry.id} className={`${subPanel} p-3`}>
            <div className="flex flex-wrap items-center gap-1.5">
              <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${signalClass}`}>
                {entry.signalKind.replace(/_/g, ' ')}
              </span>
              <span className={`rounded-sm px-1.5 py-0.5 text-[9px] font-bold uppercase ${meta.text} ${meta.bg}`}>
                {meta.label}
              </span>
              <span className={`ml-auto text-[10px] font-semibold ${valenceColor}`}>
                {valenceLabel}
              </span>
            </div>
            <p className="mt-2 text-[13px] leading-5 text-[#dce8f6]">{readableEvidenceSummary(entry, detail, agentName)}</p>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#263950] pt-2 text-[10px] text-[#8da0b7]">
              <span>{formatDateTime(entry.createdAt)}</span>
              <span>Confidence <strong className="font-semibold text-[#cbd8e6]">{percentage(entry.confidence)}</strong></span>
              <span>Weight <strong className="font-semibold text-[#cbd8e6]">{percentage(entry.weight)}</strong></span>
              {entry.excerptRefs.length > 0 && (
                <span>{entry.excerptRefs.length} source ref{entry.excerptRefs.length !== 1 ? 's' : ''}</span>
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}

// ─── RelationshipEvidence ─────────────────────────────────────────────────────
export function RelationshipEvidence({ detail, agentName }: { detail: RelationshipWorkspaceDetail; agentName: string }) {
  const sourceCount = Object.values(detail.relationship.sourceStats).reduce((sum, stat) => sum + stat.count, 0)
  const averageConfidence = detail.recentEvidence.length
    ? Math.round((detail.recentEvidence.reduce((sum, item) => sum + item.confidence, 0) / detail.recentEvidence.length) * 100)
    : null
  const linkedReferences = detail.recentEvidence.reduce((sum, item) => sum + item.excerptRefs.length, 0)

  return (
    <div className="space-y-3">
      <section className={`${subPanel} overflow-hidden`} aria-labelledby="relationship-source-influence">
        <header className="flex items-center justify-between border-b border-[#263950] px-4 py-3">
          <div className="flex items-center gap-2"><Layers className="h-4 w-4 text-[#8ac9dc]" aria-hidden="true" /><h2 id="relationship-source-influence" className="text-sm font-semibold text-[#edf3fb]">Source influence</h2></div>
          <span className="text-xs tabular-nums text-[#9db0c7]">{sourceCount} events</span>
        </header>
        <div className="px-4">
        <SourceInfluence detail={detail} />
        </div>
      </section>

      <section className={`${subPanel} overflow-hidden`} aria-labelledby="relationship-evidence-timeline">
        <header className="flex items-center justify-between border-b border-[#263950] px-4 py-3">
          <div className="flex items-center gap-2"><Activity className="h-4 w-4 text-[#d2c4f2]" aria-hidden="true" /><h2 id="relationship-evidence-timeline" className="text-sm font-semibold text-[#edf3fb]">Evidence timeline</h2></div>
          <span className="text-xs tabular-nums text-[#9db0c7]">Newest first</span>
        </header>
        <div className="space-y-2 p-3">
        <EvidenceTimeline detail={detail} agentName={agentName} />
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 sm:grid-cols-3" aria-label="Evidence quality summary">
        <div className={`${subPanel} px-3 py-2.5`}><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8da0b7]">Linked refs</p><p className="mt-1 text-sm font-semibold text-[#edf3fb]">{linkedReferences}</p></div>
        <div className={`${subPanel} px-3 py-2.5`}><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8da0b7]">Avg confidence</p><p className="mt-1 text-sm font-semibold text-[#91d4ae]">{averageConfidence === null ? '—' : `${averageConfidence}%`}</p></div>
        <div className={`${subPanel} col-span-2 px-3 py-2.5 sm:col-span-1`}><p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[#8da0b7]">Prompt influence</p><p className="mt-1 text-sm font-semibold text-[#e7bb70]">{detail.relationship.guidance.sides.some((side) => side.doMoreOf.length || side.avoid.length) ? 'Guarded' : 'None'}</p></div>
      </section>
    </div>
  )
}
