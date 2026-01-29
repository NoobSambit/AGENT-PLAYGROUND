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

function getIntensityLabel(intensity: number): string {
  if (intensity >= 0.8) return 'Very Strong'
  if (intensity >= 0.6) return 'Strong'
  if (intensity >= 0.4) return 'Moderate'
  if (intensity >= 0.2) return 'Mild'
  return 'Subtle'
}

export function EmotionTimeline({
  events,
  maxEvents = 10,
  className = ''
}: EmotionTimelineProps) {
  // Sort by timestamp (most recent first) and limit
  const sortedEvents = [...events]
    .sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())
    .slice(0, maxEvents)

  if (sortedEvents.length === 0) {
    return (
      <div className={`text-center text-gray-500 py-8 ${className}`}>
        <p>No emotional events recorded yet.</p>
        <p className="text-sm mt-2">Emotions are detected during conversations.</p>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      {/* Timeline line */}
      <div className="absolute left-4 top-0 bottom-0 w-0.5 bg-gray-200 dark:bg-gray-700" />

      {/* Events */}
      <div className="space-y-4">
        {sortedEvents.map((event, index) => (
          <EmotionEventCard key={event.id || index} event={event} />
        ))}
      </div>

      {/* Show more indicator */}
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
      {/* Timeline dot */}
      <div
        className="absolute left-2 w-5 h-5 rounded-full border-2 border-white dark:border-gray-900 shadow"
        style={{ backgroundColor: color }}
      />

      {/* Event card */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-3 shadow-sm border border-gray-100 dark:border-gray-700">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <span
              className="px-2 py-0.5 rounded-full text-xs font-medium text-white"
              style={{ backgroundColor: color }}
            >
              {EMOTION_LABELS[event.emotion]}
            </span>
            <span className="text-xs text-gray-500">
              {getIntensityLabel(event.intensity)}
            </span>
          </div>
          <span className="text-xs text-gray-400">
            {formatTimeAgo(event.timestamp)}
          </span>
        </div>

        {/* Intensity bar */}
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
            <span>0%</span>
            <span className="font-medium" style={{ color }}>
              {intensityPercent}%
            </span>
            <span>100%</span>
          </div>
        </div>

        {/* Context */}
        {event.context && (
          <p className="text-sm text-gray-600 dark:text-gray-300 line-clamp-2">
            {event.context}
          </p>
        )}

        {/* Trigger */}
        <div className="mt-2 text-xs text-gray-400">
          Trigger: {event.trigger.replace('_', ' ')}
        </div>
      </div>
    </div>
  )
}

// Compact emotion summary for dashboard
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
        No recent emotional events
      </div>
    )
  }

  // Count emotions
  const emotionCounts: Record<EmotionType, number> = {
    joy: 0, sadness: 0, anger: 0, fear: 0,
    surprise: 0, trust: 0, anticipation: 0, disgust: 0
  }

  events.forEach(e => {
    emotionCounts[e.emotion]++
  })

  // Get top emotions
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

// Emotion intensity chart (simple line representation)
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

  // Sort chronologically
  const sorted = [...events].sort(
    (a, b) => new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
  )

  // Create SVG path
  const width = 100 // Percentage width
  const points = sorted.map((event, i) => {
    const x = (i / Math.max(sorted.length - 1, 1)) * width
    const y = (1 - event.intensity) * height
    return { x, y, event }
  })

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ')

  return (
    <svg
      className={className}
      width="100%"
      height={height}
      viewBox={`0 0 100 ${height}`}
      preserveAspectRatio="none"
    >
      {/* Grid lines */}
      <line x1="0" y1={height * 0.5} x2="100" y2={height * 0.5} stroke="currentColor" strokeOpacity="0.1" />

      {/* Area fill */}
      <path
        d={`${pathD} L 100 ${height} L 0 ${height} Z`}
        fill="currentColor"
        fillOpacity="0.1"
      />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
      />

      {/* Points */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={p.x}
          cy={p.y}
          r="3"
          fill={EMOTION_COLORS[p.event.emotion]}
          vectorEffect="non-scaling-stroke"
        />
      ))}
    </svg>
  )
}

export default EmotionTimeline
