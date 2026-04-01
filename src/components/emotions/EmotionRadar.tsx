'use client'

import React, { useMemo } from 'react'
import { EmotionalProfile, EmotionalState, EmotionType, EMOTION_COLORS } from '@/types/database'
import { emotionalService } from '@/lib/services/emotionalService'

interface EmotionRadarProps {
  emotionalState?: EmotionalState
  emotionalProfile?: EmotionalProfile
  mode?: 'live' | 'temperament'
  size?: number
  showLabels?: boolean
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

function resolveValues(
  emotionalState: EmotionalState | undefined,
  emotionalProfile: EmotionalProfile | undefined,
  mode: 'live' | 'temperament'
): Record<EmotionType, number> {
  if (mode === 'temperament') {
    return emotionalProfile?.temperament || emotionalService.createEmotionalProfile().temperament
  }

  return emotionalState?.currentMood || emotionalService.createDefaultEmotionalState().currentMood
}

function resolveDominantEmotion(
  emotionalState: EmotionalState | undefined,
  emotionalProfile: EmotionalProfile | undefined,
  mode: 'live' | 'temperament'
): EmotionType {
  return mode === 'temperament'
    ? emotionalService.getInfluentialEmotion(undefined, emotionalProfile).emotion
    : emotionalService.getInfluentialEmotion(emotionalState, emotionalProfile).emotion
}

export function EmotionRadar({
  emotionalState,
  emotionalProfile,
  mode = 'live',
  size = 300,
  showLabels = true,
  className = ''
}: EmotionRadarProps) {
  const values = resolveValues(emotionalState, emotionalProfile, mode)
  const dominantEmotion = resolveDominantEmotion(emotionalState, emotionalProfile, mode)
  const center = size / 2
  const radius = (size / 2) - 40

  const currentPoints = useMemo(() => {
    return EMOTIONS.map((emotion, index) => {
      const angle = (index * 2 * Math.PI) / EMOTIONS.length - Math.PI / 2
      const value = values[emotion] || 0
      const x = center + Math.cos(angle) * radius * value
      const y = center + Math.sin(angle) * radius * value
      return { x, y, emotion, value }
    })
  }, [center, radius, values])

  const currentPath = currentPoints.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ') + ' Z'

  const gridCircles = [0.25, 0.5, 0.75, 1].map(level => ({
    r: radius * level,
    opacity: level * 0.3
  }))

  const axisLines = EMOTIONS.map((_, index) => {
    const angle = (index * 2 * Math.PI) / EMOTIONS.length - Math.PI / 2
    return {
      x2: center + Math.cos(angle) * radius,
      y2: center + Math.sin(angle) * radius
    }
  })

  const labelPositions = EMOTIONS.map((emotion, index) => {
    const angle = (index * 2 * Math.PI) / EMOTIONS.length - Math.PI / 2
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
        {gridCircles.map((circle, index) => (
          <circle
            key={index}
            cx={center}
            cy={center}
            r={circle.r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            strokeWidth={1}
          />
        ))}

        {axisLines.map((line, index) => (
          <line
            key={index}
            x1={center}
            y1={center}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeOpacity={0.2}
            strokeWidth={1}
          />
        ))}

        <path
          d={currentPath}
          fill={EMOTION_COLORS[dominantEmotion]}
          fillOpacity={mode === 'temperament' ? 0.18 : 0.3}
          stroke={EMOTION_COLORS[dominantEmotion]}
          strokeWidth={2}
        />

        {currentPoints.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={5}
            fill={EMOTION_COLORS[point.emotion]}
            stroke="white"
            strokeWidth={2}
          />
        ))}

        {showLabels && labelPositions.map((position, index) => (
          <text
            key={index}
            x={position.x}
            y={position.y}
            textAnchor="middle"
            dominantBaseline="middle"
            className="text-xs fill-current"
            style={{ fontSize: '11px' }}
          >
            {EMOTION_LABELS[position.emotion]}
          </text>
        ))}
      </svg>

      <div className="mt-4 flex flex-wrap justify-center gap-2">
        <div className="flex items-center gap-1 text-xs">
          <div
            className="w-3 h-3 rounded-full"
            style={{ backgroundColor: EMOTION_COLORS[dominantEmotion] }}
          />
          <span>
            {mode === 'temperament' ? 'Temperament lead:' : 'Current lead:'} {EMOTION_LABELS[dominantEmotion]}
          </span>
        </div>
      </div>
    </div>
  )
}

export function EmotionRadarMini({
  emotionalState,
  emotionalProfile,
  size = 80
}: {
  emotionalState?: EmotionalState
  emotionalProfile?: EmotionalProfile
  size?: number
}) {
  return (
    <EmotionRadar
      emotionalState={emotionalState}
      emotionalProfile={emotionalProfile}
      size={size}
      showLabels={false}
    />
  )
}

export function EmotionBars({
  emotionalState,
  emotionalProfile,
  mode = 'live',
  className = ''
}: {
  emotionalState?: EmotionalState
  emotionalProfile?: EmotionalProfile
  mode?: 'live' | 'temperament'
  className?: string
}) {
  const values = resolveValues(emotionalState, emotionalProfile, mode)
  const dominantEmotion = resolveDominantEmotion(emotionalState, emotionalProfile, mode)
  const sortedEmotions = EMOTIONS.slice()
    .sort((a, b) => (values[b] || 0) - (values[a] || 0))

  return (
    <div className={`space-y-2 ${className}`}>
      {sortedEmotions.map((emotion) => {
        const value = values[emotion] || 0
        const isDominant = emotion === dominantEmotion

        return (
          <div key={emotion} className="flex items-center gap-2">
            <span className="w-24 text-sm truncate">
              {EMOTION_LABELS[emotion]}
              {isDominant ? ' *' : ''}
            </span>
            <div className="flex-1 h-4 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
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
