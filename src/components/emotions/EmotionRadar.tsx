'use client'

import React, { useMemo } from 'react'
import { EmotionalEvent, EmotionalProfile, EmotionalState, EmotionType, EMOTION_COLORS } from '@/types/database'
import { emotionalService } from '@/lib/services/emotionalService'

interface EmotionRadarProps {
  emotionalState?: EmotionalState
  emotionalProfile?: EmotionalProfile
  recentEvents?: EmotionalEvent[]
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
  recentEvents = [],
  mode = 'live',
  size = 300,
  showLabels = true,
  className = ''
}: EmotionRadarProps) {
  const values = resolveValues(emotionalState, emotionalProfile, mode)
  const dominantEmotion = resolveDominantEmotion(emotionalState, emotionalProfile, mode)
  const center = size / 2
  const radius = (size / 2) - 45 // Increased padding for labels

  const currentPoints = useMemo(() => {
    return EMOTIONS.map((emotion, index) => {
      const angle = (index * 2 * Math.PI) / EMOTIONS.length - Math.PI / 2
      const value = values[emotion] || 0
      // Ensure a minimum value for the radar shape to be visible even if 0
      const displayValue = Math.max(value, 0.05)
      const x = center + Math.cos(angle) * radius * displayValue
      const y = center + Math.sin(angle) * radius * displayValue
      return { x, y, emotion, value: displayValue }
    })
  }, [center, radius, values])

  const currentPath = currentPoints.map((point, index) =>
    `${index === 0 ? 'M' : 'L'} ${point.x} ${point.y}`
  ).join(' ') + ' Z'

  const gridCircles = [0.25, 0.5, 0.75, 1].map(level => ({
    r: radius * level,
    opacity: level * 0.2
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
    const labelRadius = radius + 32 // More breathing room
    return {
      x: center + Math.cos(angle) * labelRadius,
      y: center + Math.sin(angle) * labelRadius,
      emotion
    }
  })

  const color = EMOTION_COLORS[dominantEmotion]
  const latestEvent = recentEvents[0]

  return (
    <div className={`relative flex flex-col items-center select-none ${className}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="drop-shadow-2xl">
        <defs>
          <radialGradient id={`radarGradient-${mode}`} cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
            <stop offset="0%" stopColor={color} stopOpacity="0.4" />
            <stop offset="100%" stopColor={color} stopOpacity="0.1" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2.5" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Grid Circles */}
        {gridCircles.map((circle, index) => (
          <circle
            key={index}
            cx={center}
            cy={center}
            r={circle.r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.08}
            strokeWidth={1}
            strokeDasharray={index === 3 ? "0" : "4 4"}
          />
        ))}

        {/* Axis Lines */}
        {axisLines.map((line, index) => (
          <line
            key={index}
            x1={center}
            y1={center}
            x2={line.x2}
            y2={line.y2}
            stroke="currentColor"
            strokeOpacity={0.12}
            strokeWidth={1}
          />
        ))}

        {/* Data Path */}
        <path
          d={currentPath}
          fill={`url(#radarGradient-${mode})`}
          stroke={color}
          strokeWidth={2.5}
          className="transition-all duration-700 ease-in-out"
          filter="url(#glow)"
        />

        {/* Data Points */}
        {currentPoints.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={3.5}
            fill={EMOTION_COLORS[point.emotion]}
            stroke="white"
            strokeWidth={1.5}
            className="transition-all duration-700 ease-in-out drop-shadow-md"
          />
        ))}

        {/* Labels */}
        {showLabels && labelPositions.map((position, index) => {
          // Adjust labels at the extremes for better centering
          const isTop = index === 0
          const isBottom = index === 4
          const isRight = index > 0 && index < 4
          return (
            <text
              key={index}
              x={position.x}
              y={position.y}
              textAnchor={isTop || isBottom ? "middle" : isRight ? "start" : "end"}
              dominantBaseline="middle"
              className="fill-muted-foreground/80 font-medium tracking-tight"
              style={{ fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.05em' }}
            >
              {EMOTION_LABELS[position.emotion]}
            </text>
          )
        })}
      </svg>

      <div className="mt-4 inline-flex items-center gap-2.5 rounded-full border border-border/40 bg-background/50 px-3.5 py-1.5 backdrop-blur-sm">
        <div
          className="w-2.5 h-2.5 rounded-full shadow-sm animate-pulse"
          style={{ backgroundColor: color, boxShadow: `0 0 10px ${color}` }}
        />
        <span className="text-[11px] font-semibold text-foreground/90 uppercase tracking-wider">
          {mode === 'temperament' ? 'Temperament lead:' : 'Current lead:'} {EMOTION_LABELS[dominantEmotion]}
        </span>
      </div>

      {latestEvent?.topEmotions?.length ? (
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {latestEvent.topEmotions.slice(0, 3).map((entry) => (
            <span
              key={`${entry.emotion}-${entry.intensity}`}
              className="rounded-full border border-border/40 bg-background/60 px-2.5 py-1 text-[10px] font-medium text-muted-foreground"
            >
              {EMOTION_LABELS[entry.emotion]} {(entry.intensity * 100).toFixed(0)}%
            </span>
          ))}
        </div>
      ) : null}
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
    <div className={`grid gap-x-6 gap-y-4 sm:grid-cols-2 ${className}`}>
      {sortedEmotions.map((emotion) => {
        const value = values[emotion] || 0
        const isDominant = emotion === dominantEmotion

        return (
          <div key={emotion} className="group relative flex flex-col gap-1.5">
            <div className="flex items-center justify-between px-0.5">
              <span className={`text-[11px] font-bold uppercase tracking-wider ${isDominant ? 'text-foreground' : 'text-muted-foreground/70'}`}>
                {EMOTION_LABELS[emotion]}
                {isDominant && <span className="ml-1 text-primary">●</span>}
              </span>
              <span className="text-[10px] font-mono text-muted-foreground tabular-nums">
                {(value * 100).toFixed(0)}%
              </span>
            </div>
            <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-muted/40 ring-1 ring-inset ring-white/5">
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out"
                style={{
                  width: `${value * 100}%`,
                  backgroundColor: EMOTION_COLORS[emotion],
                  boxShadow: isDominant ? `0 0 12px ${EMOTION_COLORS[emotion]}66` : 'none'
                }}
              />
              {isDominant && (
                <div 
                  className="absolute inset-y-0 h-full w-2 bg-white/20 blur-sm"
                  style={{ left: `${value * 100 - 2}%` }}
                />
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default EmotionRadar
