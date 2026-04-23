'use client'

import { motion } from 'framer-motion'
import { ArrowUpRight, GitBranch, Loader2, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import type { RelationshipWorkspaceDetail } from '@/types/database'
import { MetricBar, HealthPill } from './RelationshipAtoms'
import { labelStyle, percentage, statusConfig, subPanel } from './RelationshipHelpers'

// ─── RelationshipHero ────────────────────────────────────────────────────────
export function RelationshipHero({
  selectedPair,
  agentId,
  agentName,
  recomputing,
  refreshing,
  onRecompute,
  onRefresh,
}: {
  selectedPair: RelationshipWorkspaceDetail
  agentId: string
  agentName: string
  recomputing: boolean
  refreshing: boolean
  onRecompute: () => void
  onRefresh: () => void
}) {
  const cfg = statusConfig(selectedPair.relationship.status)
  const d = selectedPair.relationship.derived

  // Determine a momentum label
  const momentumLabel =
    d.momentum > 0.05
      ? 'Improving'
      : d.momentum < -0.05
        ? 'Declining'
        : 'Flat'
  const momentumColor =
    d.momentum > 0.05 ? 'text-pastel-green' : d.momentum < -0.05 ? 'text-pastel-red' : 'text-muted-foreground'

  return (
    <motion.section
      key={selectedPair.relationship.id}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.22 }}
      className="space-y-4"
    >
      {/* ── Hero card ── */}
      <div className="rounded-md border border-border/40 bg-card/40 backdrop-blur-md shadow-sm">
        {/* Top bar */}
        <div className="flex flex-col gap-4 border-b border-border/20 px-5 py-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className={labelStyle}>Selected Relationship</div>
            <div className="mt-1.5 flex flex-wrap items-center gap-2.5">
              <h2 className="text-2xl font-bold tracking-tight text-foreground">
                {selectedPair.otherAgent.name}
              </h2>
              {/* Status chip */}
              <span
                className={`flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[10px] font-bold uppercase tracking-[0.18em] ${cfg.chip}`}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${cfg.dot}`} />
                {cfg.label}
              </span>
            </div>

            {/* Relationship types */}
            <div className="mt-2.5 flex flex-wrap gap-1.5">
              {selectedPair.relationship.relationshipTypes.map((t) => (
                <span
                  key={t}
                  className="rounded-full border border-border/20 bg-muted/20 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
                >
                  {t.replace(/_/g, ' ')}
                </span>
              ))}
              {selectedPair.relationship.alertFlags.map((flag) => (
                <span
                  key={flag}
                  className="rounded-full border border-pastel-yellow/25 bg-pastel-yellow/10 px-2.5 py-0.5 text-[10px] font-medium uppercase tracking-[0.14em] text-pastel-yellow"
                >
                  ⚠ {flag.replace(/_/g, ' ')}
                </span>
              ))}
            </div>

            {/* Persona excerpt */}
            {selectedPair.otherAgent.persona && (
              <p className="mt-2.5 max-w-xl text-[12px] leading-relaxed text-muted-foreground line-clamp-2">
                {selectedPair.otherAgent.persona.slice(0, 200)}
              </p>
            )}

            {/* Shared summary */}
            {selectedPair.relationship.guidance.sharedSummary && (
              <p className="mt-2 max-w-xl text-[13px] leading-relaxed text-foreground/80">
                {selectedPair.relationship.guidance.sharedSummary}
              </p>
            )}
          </div>

          {/* Actions */}
          <div className="flex shrink-0 flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={onRecompute} disabled={recomputing}>
              {recomputing ? (
                <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
              ) : (
                <GitBranch className="mr-1.5 h-3.5 w-3.5" />
              )}
              Recompute
            </Button>
            <Button variant="outline" size="sm" onClick={onRefresh} disabled={refreshing}>
              <RefreshCw className={`mr-1.5 h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              Refresh
            </Button>
          </div>
        </div>

        {/* ── Health strip ── */}
        <div className="px-5 py-4">
          <div className={`${labelStyle} mb-3`}>Relationship Health</div>
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5">
            <HealthPill
              label="Bond"
              value={percentage(d.bondStrength)}
              textColor="text-pastel-green"
              accentClass="border-pastel-green/20 bg-pastel-green/5"
              hint="Overall tie strength"
            />
            <HealthPill
              label="Tension"
              value={percentage(d.tension)}
              textColor={d.tension > 0.6 ? 'text-pastel-red' : 'text-pastel-yellow'}
              accentClass="border-pastel-yellow/20 bg-pastel-yellow/5"
              hint="Current friction load"
            />
            <HealthPill
              label="Reciprocity"
              value={percentage(d.reciprocity)}
              textColor="text-pastel-blue"
              accentClass="border-pastel-blue/20 bg-pastel-blue/5"
              hint="How symmetrical the tie is"
            />
            <HealthPill
              label="Volatility"
              value={percentage(d.volatility)}
              textColor={d.volatility > 0.5 ? 'text-pastel-yellow' : 'text-muted-foreground'}
              accentClass="border-border/20 bg-muted/10"
              hint="How fast it swings"
            />
            <HealthPill
              label="Momentum"
              value={momentumLabel}
              textColor={momentumColor}
              accentClass="border-border/20 bg-muted/10"
              hint={`Raw: ${d.momentum.toFixed(2)}`}
            />
          </div>
        </div>
      </div>

      {/* ── Perspectives ── */}
      <div>
        <div className={`${labelStyle} mb-2 px-1`}>Perspectives — How Each Side Sees This Tie</div>
        <div className="grid gap-3 xl:grid-cols-2">
          {[agentId, selectedPair.otherAgent.id].map((sideAgentId) => {
            const side = selectedPair.relationship.directional[sideAgentId]
            const isSelf = sideAgentId === agentId
            if (!side) return null

            return (
              <div key={sideAgentId} className={`${subPanel} p-4`}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className={labelStyle}>
                      {isSelf ? `${agentName}’s view` : `${selectedPair.otherAgent.name}’s view`}
                    </div>
                    <div className="mt-1 text-[12px] leading-relaxed text-muted-foreground">
                      {side.summary || 'No summary yet.'}
                    </div>
                  </div>
                  <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                </div>

                {/* Directional metrics */}
                <div className="mt-3 grid gap-1.5">
                  <MetricBar label="Trust" value={side.trust} color="bg-pastel-green" hint="Reliability & honesty" />
                  <MetricBar label="Respect" value={side.respect} color="bg-pastel-blue" />
                  <MetricBar label="Affection" value={side.affection} color="bg-pastel-pink" />
                  <MetricBar label="Alignment" value={side.alignment} color="bg-pastel-purple" />
                  <MetricBar label="Reliance" value={side.reliance} color="bg-pastel-blue" />
                  <MetricBar label="Grievance" value={side.grievance} color="bg-pastel-red" hint="Unresolved friction" />
                </div>

                {/* Levers & Sensitivities */}
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <div>
                    <div className={`${labelStyle} mb-1.5`}>Positive Levers</div>
                    {side.levers.length > 0 ? (
                      <ul className="space-y-1">
                        {side.levers.map((l) => (
                          <li key={l} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pastel-green" />
                            {l}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[11px] italic text-muted-foreground/50">
                        No levers stored yet.
                      </div>
                    )}
                  </div>
                  <div>
                    <div className={`${labelStyle} mb-1.5`}>Sensitivities</div>
                    {side.sensitivities.length > 0 ? (
                      <ul className="space-y-1">
                        {side.sensitivities.map((s) => (
                          <li key={s} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-pastel-yellow" />
                            {s}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <div className="text-[11px] italic text-muted-foreground/50">
                        No sensitivities stored yet.
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </motion.section>
  )
}
