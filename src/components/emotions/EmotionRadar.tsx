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
  palette?: Partial<Record<EmotionType, string>>
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

const SIGNAL_SCALE_CEILINGS = [0.25, 0.5, 0.75, 1] as const

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
  palette,
  className = ''
}: EmotionRadarProps) {
  const values = resolveValues(emotionalState, emotionalProfile, mode)
  const dominantEmotion = resolveDominantEmotion(emotionalState, emotionalProfile, mode)
  const center = size / 2
  const chartPadding = showLabels ? Math.max(44, Math.round(size * 0.2)) : Math.max(14, Math.round(size * 0.08))
  const radius = (size / 2) - chartPadding
  const labelRadius = radius + Math.max(17, Math.round(size * 0.08))
  const scaleCeiling = SIGNAL_SCALE_CEILINGS.find((ceiling) => (
    Math.max(...EMOTIONS.map((emotion) => values[emotion] || 0)) <= ceiling
  )) || 1
  const scaleLabel = `0–${Math.round(scaleCeiling * 100)}%`

  const currentPoints = useMemo(() => {
    return EMOTIONS.map((emotion, index) => {
      const angle = (index * 2 * Math.PI) / EMOTIONS.length - Math.PI / 2
      const value = values[emotion] || 0
      const displayValue = Math.min(1, value / scaleCeiling)
      const x = center + Math.cos(angle) * radius * displayValue
      const y = center + Math.sin(angle) * radius * displayValue
      return { x, y, emotion, value: displayValue }
    })
  }, [center, radius, scaleCeiling, values])

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
    const cosine = Math.cos(angle)
    const isRight = cosine > 0.35
    const isLeft = cosine < -0.35
    const textAnchor: 'start' | 'middle' | 'end' = isRight ? 'end' : isLeft ? 'start' : 'middle'
    return {
      x: Math.min(size - 8, Math.max(8, center + cosine * labelRadius)),
      y: center + Math.sin(angle) * labelRadius,
      emotion,
      textAnchor,
    }
  })

  const color = palette?.[dominantEmotion] || EMOTION_COLORS[dominantEmotion]
  const supportingEmotions = EMOTIONS
    .map((emotion) => ({ emotion, intensity: values[emotion] || 0 }))
    .sort((left, right) => right.intensity - left.intensity)
    .slice(0, 3)

  return (
    <div className={`relative flex w-full flex-col items-center select-none ${className}`}>
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        role="img"
        aria-label={`${mode === 'temperament' ? 'Temperament' : 'Live emotion'} radar using a ${scaleLabel} detail scale. Current lead: ${EMOTION_LABELS[dominantEmotion]}.`}
        className="overflow-visible drop-shadow-[0_12px_22px_rgba(0,0,0,0.32)]"
      >
        <title>{mode === 'temperament' ? 'Temperament radar' : 'Live emotion radar'}</title>
        <circle cx={center} cy={center} r={radius} fill="#141f30" fillOpacity="0.64" />

        {/* Grid Circles */}
        {gridCircles.map((circle, index) => (
          <circle
            key={index}
            cx={center}
            cy={center}
            r={circle.r}
            fill="none"
            stroke="#8495b2"
            strokeOpacity={index === 3 ? 0.24 : 0.12}
            strokeWidth={1}
            strokeDasharray={index === 3 ? "0" : "3 4"}
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
            stroke="#8495b2"
            strokeOpacity={0.16}
            strokeWidth={1}
          />
        ))}

        {/* Data Path */}
        <path
          d={currentPath}
          fill={color}
          fillOpacity="0.16"
          stroke={color}
          strokeWidth={2.2}
          className="transition-all duration-700 ease-in-out"
        />

        {/* Data Points */}
        {currentPoints.map((point, index) => (
          <circle
            key={index}
            cx={point.x}
            cy={point.y}
            r={3.25}
            fill={palette?.[point.emotion] || EMOTION_COLORS[point.emotion]}
            stroke="#f6f7fb"
            strokeWidth={1.25}
            className="transition-all duration-700 ease-in-out drop-shadow-md"
          />
        ))}

        {/* Labels */}
        {showLabels && labelPositions.map((position) => {
          return (
            <text
              key={position.emotion}
              x={position.x}
              y={position.y}
              textAnchor={position.textAnchor}
              dominantBaseline="middle"
              fill="#aebbd1"
              style={{ fontSize: `${Math.max(9, Math.round(size * 0.042))}px`, fontWeight: 600, letterSpacing: '0.055em' }}
            >
              {EMOTION_LABELS[position.emotion].toUpperCase()}
            </text>
          )
        })}
      </svg>

      <div className="mt-2 inline-flex min-h-8 items-center gap-2 rounded-full border border-[#50617e]/65 bg-[#101a29]/95 px-3.5 py-1.5 shadow-[inset_0_1px_0_rgba(255,255,255,0.035)]">
        <div
          className="h-2 w-2 rounded-full shadow-sm animate-pulse"
          style={{ backgroundColor: color, boxShadow: `0 0 9px ${color}` }}
        />
        <span className="text-[10px] font-bold uppercase tracking-[0.1em] text-[#e4eaf5]">
          {mode === 'temperament' ? 'Temperament lead:' : 'Current lead:'} {EMOTION_LABELS[dominantEmotion]}
        </span>
        <span className="h-3 w-px bg-[#50617e]/70" aria-hidden="true" />
        <span className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[#9fafd0]" aria-label={`Detail scale ${scaleLabel}`}>
          Scale {scaleLabel}
        </span>
      </div>

      {supportingEmotions.length ? (
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {supportingEmotions.map((entry) => (
            <span
              key={`${entry.emotion}-${entry.intensity}`}
              className="rounded-full border border-[#3b4b64]/75 bg-[#101a29]/80 px-2.5 py-1 text-[10px] font-medium text-[#b8c5d9]"
            >
              {EMOTION_LABELS[entry.emotion]} {Math.round(entry.intensity * 100)}%
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
