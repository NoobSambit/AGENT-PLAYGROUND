'use client'

import { useMemo } from 'react'
import { Orbit, Target } from 'lucide-react'
import { Input } from '@/components/ui/input'
import type { RelationshipRosterItem, RelationshipWorkspaceBootstrap } from '@/types/database'
import { MetricBar } from './RelationshipAtoms'
import {
  filterOptions,
  filterRosterItem,
  statusConfig,
  type FilterId,
} from './RelationshipHelpers'

// ─── NetworkMap ───────────────────────────────────────────────────────────────
function NetworkMap({
  bootstrap,
  selectedPairId,
  onSelect,
}: {
  bootstrap: RelationshipWorkspaceBootstrap
  selectedPairId?: string
  onSelect: (pairId: string) => void
}) {
  const centerX = 160
  const centerY = 100
  const radius = 76
  const peers = bootstrap.roster

  return (
    <div className="rounded-sm border border-border/25 bg-muted/10 p-3">
      <div className="flex items-center gap-2 mb-2">
        <Orbit className="h-3 w-3 text-muted-foreground" />
        <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground">
          Network Map
        </span>
      </div>
      <svg viewBox="0 0 320 200" className="w-full">
        {/* Center node */}
        <circle cx={centerX} cy={centerY} r="28" fill="rgba(137,180,250,0.12)" stroke="rgba(137,180,250,0.3)" strokeWidth="1" />
        <text x={centerX} y={centerY + 4} textAnchor="middle" fontSize="9" fontWeight="600" fill="currentColor" className="fill-foreground">
          {bootstrap.agent.name.slice(0, 10)}
        </text>

        {peers.map((item, index) => {
          const angle = (Math.PI * 2 * index) / Math.max(peers.length, 1) - Math.PI / 2
          const x = centerX + radius * Math.cos(angle)
          const y = centerY + radius * Math.sin(angle)
          const selected = item.pairId === selectedPairId

          return (
            <g
              key={item.pairId}
              onClick={() => onSelect(item.pairId)}
              className="cursor-pointer"
              role="button"
              aria-label={`Select ${item.otherAgentName}`}
            >
              <line
                x1={centerX}
                y1={centerY}
                x2={x}
                y2={y}
                stroke={selected ? 'rgba(137,180,250,0.7)' : `rgba(148,163,184,${0.2 + item.derived.bondStrength * 0.4})`}
                strokeWidth={selected ? 2 : 1 + item.derived.bondStrength * 1.4}
              />
              <circle
                cx={x}
                cy={y}
                r={selected ? 16 : 13}
                fill={selected ? 'rgba(137,180,250,0.2)' : 'rgba(148,163,184,0.1)'}
                stroke={selected ? 'rgba(137,180,250,0.5)' : 'rgba(148,163,184,0.25)'}
                strokeWidth={selected ? 1.5 : 1}
              />
              <text x={x} y={y + 3} textAnchor="middle" fontSize="8" fontWeight="500" fill="currentColor" className="fill-foreground/80">
                {item.otherAgentName.slice(0, 8)}
              </text>
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── RosterCard ───────────────────────────────────────────────────────────────
function RosterCard({
  item,
  selected,
  onSelect,
}: {
  item: RelationshipRosterItem
  selected: boolean
  onSelect: () => void
}) {
  const cfg = statusConfig(item.status)

  return (
    <button
      type="button"
      onClick={onSelect}
      className={[
        'w-full rounded-sm border px-3 py-3 text-left transition-all duration-150 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pastel-blue/50',
        selected
          ? 'border-pastel-blue/30 bg-pastel-blue/5 shadow-sm'
          : 'border-border/20 bg-transparent hover:border-border/40 hover:bg-muted/10',
      ].join(' ')}
    >
      {/* Name + status */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[13px] font-semibold text-foreground">
            {item.otherAgentName}
          </div>
          <div className="mt-0.5 flex flex-wrap gap-1">
            {item.relationshipTypes.slice(0, 2).map((t) => (
              <span
                key={t}
                className="rounded-full border border-border/20 px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.14em] text-muted-foreground"
              >
                {t.replace(/_/g, ' ')}
              </span>
            ))}
          </div>
        </div>
        <span
          className={`shrink-0 rounded-full border px-2 py-0.5 text-[9px] font-bold uppercase tracking-[0.16em] ${cfg.chip}`}
        >
          {cfg.label}
        </span>
      </div>

      {/* Mini metrics */}
      <div className="mt-2.5 grid gap-1.5">
        <MetricBar label="Bond" value={item.derived.bondStrength} color="bg-pastel-green" />
        <MetricBar label="Tension" value={item.derived.tension} color="bg-pastel-yellow" />
      </div>

      {/* Latest revision summary */}
      {item.latestRevisionSummary && (
        <div className="mt-2 text-[10px] leading-relaxed text-muted-foreground/70 line-clamp-2">
          {item.latestRevisionSummary}
        </div>
      )}

      {/* Alert flags */}
      {item.alertFlags.length > 0 && (
        <div className="mt-2 flex flex-wrap gap-1">
          {item.alertFlags.slice(0, 2).map((flag) => (
            <span
              key={flag}
              className="rounded-full border border-pastel-yellow/20 bg-pastel-yellow/10 px-1.5 py-0.5 text-[9px] font-medium text-pastel-yellow"
            >
              {flag.replace(/_/g, ' ')}
            </span>
          ))}
        </div>
      )}
    </button>
  )
}

// ─── RelationshipRoster ───────────────────────────────────────────────────────
export function RelationshipRoster({
  bootstrap,
  selectedPairId,
  query,
  filter,
  onQueryChange,
  onFilterChange,
  onSelectPair,
}: {
  bootstrap: RelationshipWorkspaceBootstrap
  selectedPairId?: string
  query: string
  filter: FilterId
  onQueryChange: (q: string) => void
  onFilterChange: (f: FilterId) => void
  onSelectPair: (pairId: string) => void
}) {
  const filteredRoster = useMemo(() => {
    return bootstrap.roster.filter((item) => {
      const matchesFilter = filterRosterItem(item, filter)
      const matchesQuery =
        query.trim().length === 0
          ? true
          : item.otherAgentName.toLowerCase().includes(query.toLowerCase()) ||
            item.relationshipTypes.join(' ').toLowerCase().includes(query.toLowerCase())
      return matchesFilter && matchesQuery
    })
  }, [bootstrap.roster, filter, query])

  return (
    <aside className="flex flex-col gap-3">
      {/* Roster Header */}
      <div className="flex items-center gap-2 px-1">
        <Target className="h-4 w-4 text-muted-foreground" />
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.2em] text-foreground">
            Tie Roster
          </div>
          <div className="text-[10px] text-muted-foreground">
            {bootstrap.roster.length} relationship{bootstrap.roster.length !== 1 ? 's' : ''}
          </div>
        </div>
      </div>

      {/* Search */}
      <Input
        value={query}
        onChange={(e) => onQueryChange(e.target.value)}
        placeholder="Search ties…"
        aria-label="Search relationships"
        className="h-8 text-[12px]"
      />

      {/* Filters */}
      <div className="flex flex-wrap gap-1">
        {filterOptions.map((option) => {
          const active = option.id === filter
          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onFilterChange(option.id)}
              className={[
                'rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.14em] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-pastel-blue/50',
                active
                  ? 'border-pastel-blue/30 bg-pastel-blue/10 text-pastel-blue'
                  : 'border-border/25 bg-transparent text-muted-foreground hover:text-foreground',
              ].join(' ')}
            >
              {option.label}
            </button>
          )
        })}
      </div>

      {/* Roster list */}
      <div className="max-h-[440px] space-y-1.5 overflow-y-auto pr-0.5">
        {filteredRoster.length > 0 ? (
          filteredRoster.map((item) => (
            <RosterCard
              key={item.pairId}
              item={item}
              selected={item.pairId === selectedPairId}
              onSelect={() => onSelectPair(item.pairId)}
            />
          ))
        ) : (
          <div className="rounded-sm border border-dashed border-border/25 px-3 py-6 text-center text-[12px] italic text-muted-foreground/60">
            No ties match this filter.
          </div>
        )}
      </div>

      {/* Network Map */}
      <NetworkMap
        bootstrap={bootstrap}
        selectedPairId={selectedPairId}
        onSelect={onSelectPair}
      />
    </aside>
  )
}
