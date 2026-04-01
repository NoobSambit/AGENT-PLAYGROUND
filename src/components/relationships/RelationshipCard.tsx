'use client'

import React from 'react'
import { AgentRelationship, RelationshipEvent } from '@/types/database'
import { relationshipService } from '@/lib/services/relationshipService'

interface RelationshipCardProps {
  relationship: AgentRelationship
  otherAgentName: string
  onClick?: () => void
}

export function RelationshipCard({
  relationship,
  otherAgentName,
  onClick,
}: RelationshipCardProps) {
  const summary = relationshipService.getRelationshipSummary(relationship)
  const trend = relationshipService.getRelationshipTrend(relationship)

  const trendLabel = trend === 'improving' ? 'Improving' : trend === 'declining' ? 'Declining' : 'Stable'
  const trendColor = trend === 'improving' ? 'text-emerald-500 dark:text-emerald-300' : trend === 'declining' ? 'text-rose-500 dark:text-rose-300' : 'text-muted-foreground'

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <button
      className="block w-full rounded-sm border border-border/70 bg-card/[0.62] p-5 text-left backdrop-blur-xl transition-all hover:border-primary/20 hover:bg-card/[0.82]"
      onClick={onClick}
      type="button"
    >
      <div className="flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-sm bg-background/45 text-2xl">
            {summary.icon}
          </div>
          <div>
            <h4 className="font-semibold text-foreground">{otherAgentName}</h4>
            <div className="text-sm text-muted-foreground">{summary.label}</div>
          </div>
        </div>
        <div className={`text-xs font-semibold uppercase tracking-[0.18em] ${trendColor}`}>{trendLabel}</div>
      </div>

      <div className="mt-5 space-y-3">
        <MetricBar label="Trust" value={relationship.metrics.trust} color="bg-emerald-500" />
        <MetricBar label="Respect" value={relationship.metrics.respect} color="bg-[var(--color-pastel-blue)]/20" />
        <MetricBar label="Affection" value={relationship.metrics.affection} color="bg-pink-500" />
        <MetricBar label="Familiarity" value={relationship.metrics.familiarity} color="bg-primary" />
      </div>

      {relationship.significantEvents.length > 0 && (
        <div className="mt-5 border-t border-border/60 pt-4">
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">Recent events</div>
          <div className="mt-3 space-y-2">
            {relationship.significantEvents.slice(-2).map((event, index) => (
              <EventItem key={index} event={event} />
            ))}
          </div>
        </div>
      )}

      <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4 text-xs text-muted-foreground">
        <span>First met: {formatDate(relationship.firstMeeting)}</span>
        <span>{relationship.interactionCount} interactions</span>
      </div>
    </button>
  )
}

function MetricBar({
  label,
  value,
  color,
}: {
  label: string
  value: number
  color: string
}) {
  return (
    <div className="flex items-center gap-3">
      <span className="w-20 text-xs text-muted-foreground">{label}</span>
      <div className="h-2 flex-1 rounded-full bg-muted/45">
        <div
          className={`${color} h-2 rounded-full transition-all`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="w-10 text-right text-xs text-muted-foreground">
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  )
}

function EventItem({ event }: { event: RelationshipEvent }) {
  const eventIcons: Record<string, string> = {
    first_meeting: '👋',
    agreement: '🤝',
    disagreement: '💢',
    help: '🤲',
    conflict: '⚔️',
    bonding: '💚',
    betrayal: '💔',
    reconciliation: '🕊️',
  }

  return (
    <div className="flex items-start gap-2 text-sm">
      <span>{eventIcons[event.type] || '📝'}</span>
      <span className="line-clamp-2 text-muted-foreground">{event.description}</span>
    </div>
  )
}
