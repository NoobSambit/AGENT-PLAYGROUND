'use client'

import React, { useState, useMemo } from 'react'
import {
  TimelineEvent,
  TimelineEventType,
  TimelineFilters,
  NarrativeThread
} from '@/types/database'
import {
  timelineService,
  EVENT_TYPE_ICONS,
  EVENT_TYPE_COLORS
} from '@/lib/services/timelineService'

interface TimelineExplorerProps {
  events: TimelineEvent[]
  className?: string
}

type ZoomLevel = 'day' | 'week' | 'month' | 'year'

const ZOOM_LABELS: Record<ZoomLevel, string> = {
  day: 'Day',
  week: 'Week',
  month: 'Month',
  year: 'Year'
}

const EVENT_TYPE_LABELS: Record<TimelineEventType, string> = {
  conversation: 'Conversations',
  memory: 'Memories',
  emotion: 'Emotions',
  relationship: 'Relationships',
  dream: 'Dreams',
  achievement: 'Achievements',
  creative: 'Creative Works',
  journal: 'Journal Entries'
}

export function TimelineExplorer({ events, className = '' }: TimelineExplorerProps) {
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('week')
  const [filters, setFilters] = useState<TimelineFilters>({
    types: ['all'],
    dateRange: { start: null, end: null },
    minImportance: 0,
    searchQuery: ''
  })
  const [selectedEvent, setSelectedEvent] = useState<TimelineEvent | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  // Apply filters
  const filteredEvents = useMemo(() => {
    let result = [...events]

    // Filter by types
    if (!filters.types.includes('all')) {
      result = result.filter(e => filters.types.includes(e.type))
    }

    // Filter by importance
    if (filters.minImportance > 0) {
      result = result.filter(e => e.importance >= filters.minImportance)
    }

    // Filter by search query
    if (filters.searchQuery) {
      const query = filters.searchQuery.toLowerCase()
      result = result.filter(e =>
        e.title.toLowerCase().includes(query) ||
        e.description.toLowerCase().includes(query)
      )
    }

    return result.sort((a, b) =>
      new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
    )
  }, [events, filters])

  // Cluster events
  const clusters = useMemo(() =>
    timelineService.clusterEvents(filteredEvents),
    [filteredEvents]
  )

  // Detect narrative threads
  const threads = useMemo(() =>
    timelineService.detectNarrativeThreads(filteredEvents),
    [filteredEvents]
  )

  // Get insights
  const insights = useMemo(() =>
    timelineService.getTemporalInsights(filteredEvents),
    [filteredEvents]
  )

  const toggleTypeFilter = (type: TimelineEventType) => {
    setFilters(prev => {
      const currentTypes = prev.types.includes('all') ? [] : [...prev.types]

      if (currentTypes.includes(type)) {
        const newTypes = currentTypes.filter(t => t !== type)
        return { ...prev, types: newTypes.length === 0 ? ['all'] : newTypes }
      } else {
        return { ...prev, types: [...currentTypes, type] }
      }
    })
  }

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Controls bar */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        {/* Zoom controls */}
        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Zoom:</span>
          <div className="flex rounded-lg border border-gray-200 dark:border-gray-700 overflow-hidden">
            {(Object.keys(ZOOM_LABELS) as ZoomLevel[]).map(level => (
              <button
                key={level}
                onClick={() => setZoomLevel(level)}
                className={`
                  px-3 py-1.5 text-sm transition-colors
                  ${zoomLevel === level
                    ? 'bg-blue-500 text-white'
                    : 'bg-white dark:bg-gray-800 hover:bg-gray-100 dark:hover:bg-gray-700'
                  }
                `}
              >
                {ZOOM_LABELS[level]}
              </button>
            ))}
          </div>
        </div>

        {/* Search and filter toggle */}
        <div className="flex items-center gap-2">
          <input
            type="text"
            placeholder="Search events..."
            value={filters.searchQuery || ''}
            onChange={e => setFilters(prev => ({ ...prev, searchQuery: e.target.value }))}
            className="px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded-lg bg-white dark:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`
              px-3 py-1.5 text-sm rounded-lg border transition-colors
              ${showFilters
                ? 'bg-blue-500 text-white border-blue-500'
                : 'bg-white dark:bg-gray-800 border-gray-200 dark:border-gray-700 hover:bg-gray-100 dark:hover:bg-gray-700'
              }
            `}
          >
            Filters
          </button>
        </div>
      </div>

      {/* Filter panel */}
      {showFilters && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800/50 rounded-lg border border-gray-200 dark:border-gray-700">
          <div className="space-y-4">
            {/* Event type filters */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Event Types
              </label>
              <div className="flex flex-wrap gap-2">
                {(Object.keys(EVENT_TYPE_LABELS) as TimelineEventType[]).map(type => (
                  <button
                    key={type}
                    onClick={() => toggleTypeFilter(type)}
                    className={`
                      flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm transition-colors
                      ${filters.types.includes(type) || filters.types.includes('all')
                        ? 'text-white'
                        : 'bg-gray-200 dark:bg-gray-700 text-gray-600 dark:text-gray-300'
                      }
                    `}
                    style={{
                      backgroundColor: filters.types.includes(type) || filters.types.includes('all')
                        ? EVENT_TYPE_COLORS[type]
                        : undefined
                    }}
                  >
                    {EVENT_TYPE_ICONS[type]} {EVENT_TYPE_LABELS[type]}
                  </button>
                ))}
              </div>
            </div>

            {/* Importance filter */}
            <div>
              <label className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-2 block">
                Minimum Importance: {filters.minImportance}
              </label>
              <input
                type="range"
                min="0"
                max="10"
                value={filters.minImportance}
                onChange={e => setFilters(prev => ({ ...prev, minImportance: parseInt(e.target.value) }))}
                className="w-full"
              />
            </div>
          </div>
        </div>
      )}

      {/* Stats summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          label="Total Events"
          value={filteredEvents.length}
          icon="📊"
        />
        <StatCard
          label="Most Active Day"
          value={insights.mostActiveDay}
          icon="📅"
        />
        <StatCard
          label="Peak Hour"
          value={`${insights.mostActiveHour}:00`}
          icon="🕐"
        />
        <StatCard
          label="Avg Importance"
          value={insights.averageImportance.toFixed(1)}
          icon="⭐"
        />
      </div>

      {/* Narrative threads */}
      {threads.length > 0 && (
        <div className="p-4 bg-purple-50 dark:bg-purple-900/20 rounded-lg border border-purple-200 dark:border-purple-800">
          <h3 className="text-sm font-medium text-purple-700 dark:text-purple-300 mb-2">
            Narrative Threads
          </h3>
          <div className="flex flex-wrap gap-2">
            {threads.slice(0, 5).map(thread => (
              <ThreadBadge key={thread.id} thread={thread} />
            ))}
          </div>
        </div>
      )}

      {/* Timeline */}
      <div className="relative">
        {/* Timeline line */}
        <div className="absolute left-6 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

        {/* Events */}
        <div className="space-y-4">
          {filteredEvents.length === 0 ? (
            <div className="text-center py-12 text-gray-500">
              <p className="text-lg">No events found</p>
              <p className="text-sm mt-1">Try adjusting your filters</p>
            </div>
          ) : (
            filteredEvents.map(event => (
              <TimelineEventCard
                key={event.id}
                event={event}
                isSelected={selectedEvent?.id === event.id}
                onClick={() => setSelectedEvent(event)}
              />
            ))
          )}
        </div>
      </div>

      {/* Event detail sidebar */}
      {selectedEvent && (
        <EventDetailsSidebar
          event={selectedEvent}
          onClose={() => setSelectedEvent(null)}
        />
      )}
    </div>
  )
}

// Stat card component
function StatCard({
  label,
  value,
  icon
}: {
  label: string
  value: string | number
  icon: string
}) {
  return (
    <div className="p-4 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
      <div className="flex items-center gap-2 text-sm text-gray-500 mb-1">
        <span>{icon}</span>
        <span>{label}</span>
      </div>
      <div className="text-xl font-semibold">{value}</div>
    </div>
  )
}

// Thread badge component
function ThreadBadge({ thread }: { thread: NarrativeThread }) {
  return (
    <span className="inline-flex items-center gap-1 px-3 py-1 bg-purple-100 dark:bg-purple-800/30 text-purple-700 dark:text-purple-300 rounded-full text-sm">
      <span className="font-medium">{thread.topic}</span>
      <span className="text-purple-500">({thread.events.length})</span>
    </span>
  )
}

// Timeline event card
function TimelineEventCard({
  event,
  isSelected,
  onClick
}: {
  event: TimelineEvent
  isSelected: boolean
  onClick: () => void
}) {
  const color = EVENT_TYPE_COLORS[event.type]
  const icon = EVENT_TYPE_ICONS[event.type]

  return (
    <div
      className={`
        relative pl-14 cursor-pointer transition-all
        ${isSelected ? 'scale-[1.02]' : 'hover:scale-[1.01]'}
      `}
      onClick={onClick}
    >
      {/* Timeline dot */}
      <div
        className="absolute left-4 w-5 h-5 rounded-full border-2 border-white dark:border-gray-900 shadow flex items-center justify-center text-xs"
        style={{ backgroundColor: color }}
      >
        {icon}
      </div>

      {/* Event card */}
      <div
        className={`
          p-4 rounded-lg border-2 transition-colors
          ${isSelected
            ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
            : 'border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-gray-300 dark:hover:border-gray-600'
          }
        `}
      >
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <span
                className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
                style={{ backgroundColor: color }}
              >
                {event.type}
              </span>
              <span className="text-xs text-gray-400">
                {new Date(event.timestamp).toLocaleString()}
              </span>
            </div>
            <h4 className="font-medium text-gray-900 dark:text-white">
              {event.title}
            </h4>
            <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2 mt-1">
              {event.description}
            </p>
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <span>Importance:</span>
            <span className="font-medium text-gray-600 dark:text-gray-300">
              {event.importance}/10
            </span>
          </div>
        </div>

        {/* Topics */}
        {event.metadata.topics && event.metadata.topics.length > 0 && (
          <div className="flex flex-wrap gap-1 mt-2">
            {event.metadata.topics.slice(0, 5).map(topic => (
              <span
                key={topic}
                className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded text-xs"
              >
                {topic}
              </span>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

// Event details sidebar
function EventDetailsSidebar({
  event,
  onClose
}: {
  event: TimelineEvent
  onClose: () => void
}) {
  const color = EVENT_TYPE_COLORS[event.type]
  const icon = EVENT_TYPE_ICONS[event.type]

  return (
    <div className="fixed right-0 top-0 bottom-0 w-96 bg-white dark:bg-gray-900 border-l border-gray-200 dark:border-gray-700 shadow-xl z-50 overflow-y-auto">
      {/* Header */}
      <div className="sticky top-0 bg-white dark:bg-gray-900 border-b border-gray-200 dark:border-gray-700 p-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-8 h-8 rounded-full flex items-center justify-center text-white"
            style={{ backgroundColor: color }}
          >
            {icon}
          </span>
          <span className="font-medium">Event Details</span>
        </div>
        <button
          onClick={onClose}
          className="p-2 hover:bg-gray-100 dark:hover:bg-gray-800 rounded-lg transition-colors"
        >
          <span className="text-xl">&times;</span>
        </button>
      </div>

      {/* Content */}
      <div className="p-4 space-y-4">
        <div>
          <span
            className="px-3 py-1 rounded-full text-sm font-medium text-white"
            style={{ backgroundColor: color }}
          >
            {event.type}
          </span>
        </div>

        <h2 className="text-xl font-semibold">{event.title}</h2>

        <div className="text-sm text-gray-500">
          {new Date(event.timestamp).toLocaleString()}
        </div>

        <div className="flex items-center gap-2">
          <span className="text-sm text-gray-500">Importance:</span>
          <div className="flex-1 h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full"
              style={{
                width: `${event.importance * 10}%`,
                backgroundColor: color
              }}
            />
          </div>
          <span className="text-sm font-medium">{event.importance}/10</span>
        </div>

        <div>
          <h3 className="text-sm font-medium text-gray-500 mb-2">Description</h3>
          <p className="text-gray-700 dark:text-gray-300">
            {event.description}
          </p>
        </div>

        {event.metadata.topics && event.metadata.topics.length > 0 && (
          <div>
            <h3 className="text-sm font-medium text-gray-500 mb-2">Topics</h3>
            <div className="flex flex-wrap gap-2">
              {event.metadata.topics.map(topic => (
                <span
                  key={topic}
                  className="px-3 py-1 bg-gray-100 dark:bg-gray-800 rounded-full text-sm"
                >
                  {topic}
                </span>
              ))}
            </div>
          </div>
        )}

        {event.contentRef && (
          <div className="pt-4 border-t border-gray-200 dark:border-gray-700">
            <span className="text-sm text-gray-500">
              Source: {event.contentRef.collection}
            </span>
          </div>
        )}
      </div>
    </div>
  )
}

export default TimelineExplorer
