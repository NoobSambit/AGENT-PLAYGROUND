'use client'

import React from 'react'
import { EmotionalEvent, EmotionType, EMOTION_COLORS } from '@/types/database'

interface EmotionTimelineProps {
  events: EmotionalEvent[]
  maxEvents?: number
  className?: string
}

const EMOTION_LABELS: Record<EmotionType, string> = {
  joy: 'Joy',
  sadness: 'Sadness',
  anger: 'Anger',
  fear: 'Fear',
  surprise: 'Surprise',
  trust: 'Trust',
  anticipation: 'Anticipation',
  disgust: 'Disgust'
}

function formatTimeAgo(timestamp: string): string {
  const now = Date.now()
  const then = new Date(timestamp).getTime()
  const diff = now - then

  const minutes = Math.floor(diff / (1000 * 60))
  const hours = Math.floor(diff / (1000 * 60 * 60))
  const days = Math.floor(diff / (1000 * 60 * 60 * 24))

  if (minutes < 1) return 'just now'
  if (minutes < 60) return `${minutes}m ago`
  if (hours < 24) return `${hours}h ago`
  if (days < 7) return `${days}d ago`
  return new Date(timestamp).toLocaleDateString()
}

function getDeltaLabel(delta: number): string {
  const direction = delta >= 0 ? 'rose' : 'fell'
  return `${direction} ${Math.abs(delta * 100).toFixed(0)}%`
}

export function EmotionTimeline({
  events,
  maxEvents = 10,
  className = ''
}: EmotionTimelineProps) {
  const sortedEvents = [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, maxEvents)

  if (sortedEvents.length === 0) {
    return (
      <div className={`text-center text-gray-500 py-8 ${className}`}>
        <p>No lived emotional activity yet.</p>
        <p className="text-sm mt-2">Recent causes will appear here after chats, reflection, or internal actions.</p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

      <div className="space-y-4">
        {sortedEvents.map((event, index) => (
          <EmotionEventCard key={event.id || index} event={event} />
        ))}
      </div>

      {events.length > maxEvents && (
        <div className="mt-4 text-center text-sm text-gray-500">
          + {events.length - maxEvents} more events
        </div>
      )}
    </div>
  )
}

function EmotionEventCard({ event }: { event: EmotionalEvent }) {
  const color = EMOTION_COLORS[event.emotion]
  const intensityPercent = (event.intensity * 100).toFixed(0)

  return (
    <div className="relative pl-10">
      <div
        className="absolute left-2 w-5 h-5 rounded-full border-2 border-white dark:border-gray-900 shadow"
        style={{ backgroundColor: color }}
      />

      <div className="bg-gray-50 dark:bg-gray-800 rounded-sm p-3 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {EMOTION_LABELS[event.emotion]}
            </span>
            <span className="text-xs text-gray-500 capitalize">{event.phase}</span>
            <span className="text-xs text-gray-500">{getDeltaLabel(event.delta)}</span>
          </div>
          <span className="text-xs text-gray-400">
            {formatTimeAgo(event.timestamp)}
          </span>
        </div>

        <div className="mb-2">
          <div className="h-1.5 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-300"
              style={{
                width: `${intensityPercent}%`,
                backgroundColor: color
              }}
            />
          </div>
          <div className="flex justify-between text-xs text-gray-400 mt-0.5">
            <span>live level</span>
            <span className="font-medium" style={{ color }}>
              {intensityPercent}%
            </span>
          </div>
        </div>

        <p className="text-sm text-gray-700 dark:text-gray-200">
          {event.explanation}
        </p>

        {event.context ? (
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2 line-clamp-2">
            {event.context}
          </p>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-2 text-xs text-gray-400">
          <span>source: {event.source.replace('_', ' ')}</span>
          <span>confidence: {(event.confidence * 100).toFixed(0)}%</span>
          {event.linkedMessageId ? <span>linked turn</span> : null}
        </div>
      </div>
    </div>
  )
}

export function EmotionSummary({
  events,
  className = ''
}: {
  events: EmotionalEvent[]
  className?: string
}) {
  if (events.length === 0) {
    return (
      <div className={`text-sm text-gray-500 ${className}`}>
        No recent emotional activity
      </div>
    )
  }

  const emotionCounts: Record<EmotionType, number> = {
    joy: 0, sadness: 0, anger: 0, fear: 0,
    surprise: 0, trust: 0, anticipation: 0, disgust: 0
  }

  events.forEach((event) => {
    emotionCounts[event.emotion] += 1
  })

  const topEmotions = Object.entries(emotionCounts)
    .filter(([, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 4)

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {topEmotions.map(([emotion, count]) => (
        <div
          key={emotion}
          className="flex items-center gap-1 px-2 py-1 rounded-full text-xs"
          style={{
            backgroundColor: `${EMOTION_COLORS[emotion as EmotionType]}20`,
            color: EMOTION_COLORS[emotion as EmotionType]
          }}
        >
          <span>{EMOTION_LABELS[emotion as EmotionType]}</span>
          <span className="font-medium">{count}</span>
        </div>
      ))}
    </div>
  )
}

export function EmotionIntensityChart({
  events,
  height = 60,
  className = ''
}: {
  events: EmotionalEvent[]
  height?: number
  className?: string
}) {
  if (events.length === 0) {
    return (
      <div
        className={`flex items-center justify-center text-gray-400 text-sm ${className}`}
        style={{ height }}
      >
        No data
      </div>
    )
  }

  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  const width = 100
  const points = sorted.map((event, index) => {
    const x = (index / Math.max(sorted.length - 1, 1)) * width
    const y = (1 - event.intensity) * height
    return { x, y, event }
  })

  const pathD = points
    .map((point, index) => `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`)
    .join(' ')

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      className={className}
      style={{ height, width: '100%' }}
    >
      <path d={pathD} fill="none" stroke="#EC4899" strokeWidth={2} />
      {points.map((point, index) => (
        <circle
          key={index}
          cx={point.x}
          cy={point.y}
          r={2}
          fill={EMOTION_COLORS[point.event.emotion]}
        />
      ))}
    </svg>
  )
}
