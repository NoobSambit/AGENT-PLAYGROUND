'use client'

import React, { useMemo } from 'react'
import { EmotionalState, EmotionType, EMOTION_COLORS } from '@/types/database'

interface EmotionRadarProps {
  emotionalState: EmotionalState
  size?: number
  showLabels?: boolean
  showBaseline?: boolean
  className?: string
}

const EMOTIONS: EmotionType[] = [
  'joy', 'trust', 'anticipation', 'surprise',
  'fear', 'sadness', 'disgust', 'anger'
]

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

export function EmotionRadar({
  emotionalState,
  size = 300,
  showLabels = true,
  showBaseline = true,
  className = ''
}: EmotionRadarProps) {
  const center = size / 2
  const radius = (size / 2) - 40 // Leave space for labels

  // Calculate points for the radar chart
  const currentPoints = useMemo(() => {
    return EMOTIONS.map((emotion, i) => {
      const angle = (i * 2 * Math.PI) / EMOTIONS.length - Math.PI / 2
      const value = emotionalState.currentMood[emotion] || 0
      const x = center + Math.cos(angle) * radius * value
      const y = center + Math.sin(angle) * radius * value
      return { x, y, emotion, value }
    })
  }, [emotionalState.currentMood, center, radius])

  const baselinePoints = useMemo(() => {
    return EMOTIONS.map((emotion, i) => {
      const angle = (i * 2 * Math.PI) / EMOTIONS.length - Math.PI / 2
      const value = emotionalState.emotionalBaseline[emotion] || 0
      const x = center + Math.cos(angle) * radius * value
      const y = center + Math.sin(angle) * radius * value
      return { x, y }
    })
  }, [emotionalState.emotionalBaseline, center, radius])

  // Create path strings
  const currentPath = currentPoints.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ') + ' Z'

  const baselinePath = baselinePoints.map((p, i) =>
    `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`
  ).join(' ') + ' Z'

  // Create grid circles
  const gridCircles = [0.25, 0.5, 0.75, 1].map(level => ({
    r: radius * level,
    opacity: level * 0.3
  }))

  // Create axis lines
  const axisLines = EMOTIONS.map((_, i) => {
    const angle = (i * 2 * Math.PI) / EMOTIONS.length - Math.PI / 2
    return {
      x2: center + Math.cos(angle) * radius,
      y2: center + Math.sin(angle) * radius
    }
  })

  // Label positions
  const labelPositions = EMOTIONS.map((emotion, i) => {
    const angle = (i * 2 * Math.PI) / EMOTIONS.length - Math.PI / 2
    const labelRadius = radius + 25
    return {
      x: center + Math.cos(angle) * labelRadius,
      y: center + Math.sin(angle) * labelRadius,
      emotion
    }
  })

  return (
    <div className={`relative ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {/* Grid circles */}
        {gridCircles.map((circle, i) => (
          <circle
            key={i}
            cx={center}
            cy={center}
            r={circle.r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {/* Axis lines */}
        {axisLines.map((line, i) => (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1}
          />
        ))}

        {/* Baseline polygon */}
        {showBaseline && (
          <path
            d={baselinePath}
            fill="currentColor"
            fillOpacity={0.1}
            stroke="currentColor"
            strokeOpacity={0.3}
            strokeWidth={1}
            strokeDasharray="4 4"
          />
        )}

        {/* Current mood polygon */}
        <path
          d={currentPath}
          fill={EMOTION_COLORS[emotionalState.dominantEmotion]}
          fillOpacity={0.3}
          stroke={EMOTION_COLORS[emotionalState.dominantEmotion]}
          strokeWidth={2}
        />

        {/* Data points */}
        {currentPoints.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r={5}
            fill={EMOTION_COLORS[point.emotion]}
            stroke="white"
            strokeWidth={2}
          />
        ))}

        {/* Labels */}
        {showLabels && labelPositions.map((pos, i) => (
          <text
            key={i}
            x={pos.x}
            y={pos.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-current"
            style={{ fontSize: '11px' }}
          >
            {EMOTION_LABELS[pos.emotion]}
          </text>
        ))}
      </svg>

      {/* Legend */}
      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <div className="flex items-center gap-1 text-xs">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: EMOTION_COLORS[emotionalState.dominantEmotion] }}
          />
          <span>Dominant: {EMOTION_LABELS[emotionalState.dominantEmotion]}</span>
        </div>
        {showBaseline && (
          <div className="flex items-center gap-1 text-xs text-gray-500">
            <div className="w-3 h-0.5 border-dashed border-gray-400 border-t-2" />
            <span>Baseline</span>
          </div>
        )}
      </div>
    </div>
  )
}

// Compact version for inline display
export function EmotionRadarMini({
  emotionalState,
  size = 80
}: {
  emotionalState: EmotionalState
  size?: number
}) {
  return (
    <EmotionRadar
      emotionalState={emotionalState}
      size={size}
      showLabels={false}
      showBaseline={false}
    />
  )
}

// Emotion bar display alternative
export function EmotionBars({
  emotionalState,
  className = ''
}: {
  emotionalState: EmotionalState
  className?: string
}) {
  const sortedEmotions = EMOTIONS.slice()
    .sort((a, b) => (emotionalState.currentMood[b] || 0) - (emotionalState.currentMood[a] || 0))

  return (
    <div className={`space-y-2 ${className}`}>
      {sortedEmotions.map(emotion => {
        const value = emotionalState.currentMood[emotion] || 0
        const baseline = emotionalState.emotionalBaseline[emotion] || 0
        const isDominant = emotion === emotionalState.dominantEmotion

        return (
          <div key={emotion} className="flex items-center gap-2">
            <span className="w-24 text-sm truncate">
              {EMOTION_LABELS[emotion]}
              {isDominant && ' *'}
            </span>
            <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden relative">
              {/* Baseline marker */}
              <div
                className="absolute top-0 bottom-0 w-0.5 bg-gray-400 z-10"
                style={{ left: `${baseline * 100}%` }}
              />
              {/* Current value bar */}
              <div
                className="h-full rounded-full transition-all duration-300"
                style={{
                  width: `${value * 100}%`,
                  backgroundColor: EMOTION_COLORS[emotion]
                }}
              />
            </div>
            <span className="w-12 text-xs text-right">
              {(value * 100).toFixed(0)}%
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default EmotionRadar
