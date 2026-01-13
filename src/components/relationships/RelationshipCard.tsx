'use client'

/**
 * Relationship Card Component - Phase 2
 *
 * Displays a single relationship with metrics and recent events.
 */

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

  const trendIcon = trend === 'improving' ? '📈' : trend === 'declining' ? '📉' : '➡️'
  const trendColor = trend === 'improving' ? 'text-green-400' : trend === 'declining' ? 'text-red-400' : 'text-gray-400'

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  }

  return (
    <div
      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer"
      onClick={onClick}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-3">
          <span className="text-2xl">{summary.icon}</span>
          <div>
            <h4 className="font-semibold text-white">{otherAgentName}</h4>
            <div className="text-sm text-gray-400">{summary.label}</div>
          </div>
        </div>
        <div className={`text-sm ${trendColor}`}>
          {trendIcon}
        </div>
      </div>

      {/* Metrics */}
      <div className="space-y-2 mb-3">
        <MetricBar
          label="Trust"
          value={relationship.metrics.trust}
          color="bg-green-500"
        />
        <MetricBar
          label="Respect"
          value={relationship.metrics.respect}
          color="bg-blue-500"
        />
        <MetricBar
          label="Affection"
          value={relationship.metrics.affection}
          color="bg-pink-500"
        />
        <MetricBar
          label="Familiarity"
          value={relationship.metrics.familiarity}
          color="bg-purple-500"
        />
      </div>

      {/* Recent Events */}
      {relationship.significantEvents.length > 0 && (
        <div className="border-t border-gray-700 pt-3 mt-3">
          <div className="text-xs text-gray-500 mb-2">Recent Events</div>
          <div className="space-y-1">
            {relationship.significantEvents.slice(-2).map((event, i) => (
              <EventItem key={i} event={event} />
            ))}
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex justify-between text-xs text-gray-500 mt-3 pt-2 border-t border-gray-700">
        <span>First met: {formatDate(relationship.firstMeeting)}</span>
        <span>{relationship.interactionCount} interactions</span>
      </div>
    </div>
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
    <div className="flex items-center gap-2">
      <span className="text-xs text-gray-400 w-16">{label}</span>
      <div className="flex-1 bg-gray-700 rounded-full h-1.5">
        <div
          className={`${color} h-1.5 rounded-full transition-all`}
          style={{ width: `${value * 100}%` }}
        />
      </div>
      <span className="text-xs text-gray-400 w-8 text-right">
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

  const icon = eventIcons[event.type] || '📝'

  return (
    <div className="flex items-start gap-2 text-xs">
      <span>{icon}</span>
      <span className="text-gray-400 line-clamp-1">{event.description}</span>
    </div>
  )
}
