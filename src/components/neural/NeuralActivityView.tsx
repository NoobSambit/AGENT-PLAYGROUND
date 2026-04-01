'use client'

import { useEffect, useMemo, useState } from 'react'
import { NeuralActivitySnapshot } from '@/types/enhancements'

interface NeuralActivityViewProps {
  agentId: string
}

const panelClass = 'rounded-sm border border-border/70 bg-card/[0.62] p-5 backdrop-blur-xl'

export function NeuralActivityView({ agentId }: NeuralActivityViewProps) {
  const [snapshot, setSnapshot] = useState<NeuralActivitySnapshot | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true

    const fetchSnapshot = async () => {
      try {
        const response = await fetch(`/api/agents/${agentId}/neural-activity`)
        if (!response.ok) {
          throw new Error('Failed to fetch neural activity')
        }

        const data = await response.json()
        if (active) {
          setSnapshot(data)
          setLoading(false)
        }
      } catch (error) {
        console.error('Failed to fetch neural activity:', error)
        if (active) {
          setLoading(false)
        }
      }
    }

    void fetchSnapshot()
    const interval = window.setInterval(fetchSnapshot, 15000)

    return () => {
      active = false
      window.clearInterval(interval)
    }
  }, [agentId])

  const positions = useMemo(() => {
    if (!snapshot) {
      return new Map<string, { x: number; y: number }>()
    }

    const next = new Map<string, { x: number; y: number }>()
    const centerX = 360
    const centerY = 220
    const radius = 150

    snapshot.nodes.forEach((node, index) => {
      if (node.id === 'emotion-core') {
        next.set(node.id, { x: centerX, y: centerY })
        return
      }

      if (node.id === 'decision-hub') {
        next.set(node.id, { x: centerX + 170, y: centerY + 10 })
        return
      }

      const angle = (Math.PI * 2 * index) / Math.max(snapshot.nodes.length - 1, 1)
      const nodeRadius = radius + (node.kind === 'attention' ? -30 : node.kind === 'memory' ? 30 : 0)
      next.set(node.id, {
        x: centerX + Math.cos(angle) * nodeRadius,
        y: centerY + Math.sin(angle) * nodeRadius,
      })
    })

    return next
  }, [snapshot])

  if (loading && !snapshot) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Rendering neural activity...</div>
  }

  if (!snapshot) {
    return <div className="py-10 text-center text-sm text-muted-foreground">No neural activity available yet.</div>
  }

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-3">
        <div className={panelClass}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Dominant emotion</div>
          <div className="mt-3 text-2xl font-semibold capitalize text-foreground">{snapshot.dominantEmotion}</div>
          <div className="mt-1 text-sm text-muted-foreground">
            {(snapshot.emotionalIntensity * 100).toFixed(0)}% intensity
          </div>
        </div>
        <div className={panelClass}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Attention focus</div>
          <div className="mt-3 flex flex-wrap gap-2">
            {snapshot.attentionFocus.map((item) => (
              <span key={item} className="soft-pill">{item}</span>
            ))}
          </div>
        </div>
        <div className={panelClass}>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Thought summary</div>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">{snapshot.reasoningSummary}</p>
        </div>
      </div>

      <div className={`${panelClass} overflow-hidden`}>
        <svg viewBox="0 0 720 440" className="w-full">
          <defs>
            <radialGradient id="emotionGlow" cx="50%" cy="50%" r="50%">
              <stop offset="0%" stopColor={snapshot.nodes.find((node) => node.id === 'emotion-core')?.color || '#9b7eeb'} stopOpacity="0.65" />
              <stop offset="100%" stopColor="transparent" stopOpacity="0" />
            </radialGradient>
          </defs>

          <rect x="0" y="0" width="720" height="440" rx="28" fill="rgba(9, 12, 20, 0.35)" />
          <circle cx="360" cy="220" r="120" fill="url(#emotionGlow)" />

          {snapshot.edges.map((edge) => {
            const source = positions.get(edge.source)
            const target = positions.get(edge.target)
            if (!source || !target) return null

            return (
              <g key={edge.id}>
                <line
                  x1={source.x}
                  y1={source.y}
                  x2={target.x}
                  y2={target.y}
                  stroke="rgba(255,255,255,0.22)"
                  strokeWidth={1 + edge.strength * 3}
                />
                <circle r="3" fill="rgba(255,255,255,0.7)">
                  <animateMotion dur={`${Math.max(1.8, 4 - edge.strength * 2)}s`} repeatCount="indefinite" path={`M ${source.x} ${source.y} L ${target.x} ${target.y}`} />
                </circle>
              </g>
            )
          })}

          {snapshot.nodes.map((node) => {
            const position = positions.get(node.id)
            if (!position) return null

            const radius = 14 + node.weight * 18
            return (
              <g key={node.id} transform={`translate(${position.x}, ${position.y})`}>
                <circle r={radius} fill={node.color} opacity={0.9}>
                  <animate attributeName="r" values={`${radius};${radius + 4};${radius}`} dur="3.8s" repeatCount="indefinite" />
                </circle>
                <circle r={radius + 9} fill={node.color} opacity={0.12} />
                <text
                  y={radius + 18}
                  textAnchor="middle"
                  fill="rgba(255,255,255,0.88)"
                  fontSize="12"
                  fontWeight="600"
                >
                  {node.label.length > 16 ? `${node.label.slice(0, 16)}...` : node.label}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        {snapshot.nodes.slice(0, 6).map((node) => (
          <div key={node.id} className={panelClass}>
            <div className="flex items-center justify-between gap-3">
              <div className="font-medium text-foreground">{node.label}</div>
              <span className="text-xs uppercase tracking-[0.18em] text-muted-foreground">{node.kind}</span>
            </div>
            <p className="mt-2 text-sm leading-7 text-muted-foreground">{node.description}</p>
          </div>
        ))}
      </div>
    </div>
  )
}

export default NeuralActivityView
