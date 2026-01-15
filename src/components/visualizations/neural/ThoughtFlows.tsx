'use client'

import { useRef, useState, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { ThoughtFlow, Vector3 } from '@/types/database'
import { ProcessingStage } from '@/lib/services/neuralVisualizationService'

interface ThoughtFlowsProps {
  flows: ThoughtFlow[]
  processingStage: ProcessingStage
}

const FLOW_COLORS = {
  input: '#00E676',    // Green
  processing: '#FFAB40', // Orange
  output: '#E040FB'    // Magenta
}

// Single thought stream with multiple particles
function ThoughtStream({
  flow,
  index,
  particleCount = 12
}: {
  flow: ThoughtFlow
  index: number
  particleCount?: number
}) {
  const groupRef = useRef<THREE.Group>(null)
  const particlesRef = useRef<Array<{ progress: number; speed: number }>>([])

  const color = FLOW_COLORS[flow.type] || FLOW_COLORS.processing

  // Initialize particle positions
  useEffect(() => {
    particlesRef.current = Array.from({ length: particleCount }, (_, i) => ({
      progress: i / particleCount,
      speed: 0.3 + Math.random() * 0.3
    }))
  }, [particleCount, flow])

  const from = useMemo(() => new THREE.Vector3(flow.from.x, flow.from.y, flow.from.z), [flow.from])
  const to = useMemo(() => new THREE.Vector3(flow.to.x, flow.to.y, flow.to.z), [flow.to])

  // Create curved path
  const curve = useMemo(() => {
    const mid = new THREE.Vector3().lerpVectors(from, to, 0.5)
    const dist = from.distanceTo(to)
    // Add some curve
    mid.y += dist * 0.1
    mid.x += (Math.random() - 0.5) * dist * 0.2
    return new THREE.QuadraticBezierCurve3(from, mid, to)
  }, [from, to])

  useFrame((_, delta) => {
    if (!groupRef.current) return

    particlesRef.current.forEach((particle, i) => {
      particle.progress += delta * particle.speed
      if (particle.progress > 1) {
        particle.progress -= 1
      }

      const child = groupRef.current!.children[i] as THREE.Mesh
      if (child) {
        const point = curve.getPoint(particle.progress)
        child.position.copy(point)

        // Size variation along path
        const sizeFactor = Math.sin(particle.progress * Math.PI)
        child.scale.setScalar(0.06 + sizeFactor * 0.04)
      }
    })
  })

  return (
    <group ref={groupRef}>
      {Array.from({ length: particleCount }).map((_, i) => (
        <mesh key={i}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.85}
          />
        </mesh>
      ))}

      {/* Trail effect */}
      <mesh>
        <tubeGeometry args={[curve, 20, 0.015, 8, false]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.2}
          blending={THREE.AdditiveBlending}
        />
      </mesh>
    </group>
  )
}

// Input streams converging to core
function InputStreams({ count = 6, isActive }: { count?: number; isActive: boolean }) {
  if (!isActive) return null

  const streams = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2
      const radius = 8 + Math.random() * 2
      return {
        from: {
          x: Math.cos(angle) * radius,
          y: 1 + Math.random() * 2,
          z: Math.sin(angle) * radius
        },
        to: { x: 0, y: 0, z: 0 },
        type: 'input' as const,
        progress: Math.random()
      }
    })
  }, [count])

  return (
    <>
      {streams.map((stream, i) => (
        <ThoughtStream key={`input-${i}`} flow={stream} index={i} particleCount={8} />
      ))}
    </>
  )
}

// Output streams radiating from core
function OutputStreams({ count = 8, isActive }: { count?: number; isActive: boolean }) {
  if (!isActive) return null

  const streams = useMemo(() => {
    return Array.from({ length: count }, (_, i) => {
      const angle = (i / count) * Math.PI * 2 + Math.PI / count
      const radius = 7 + Math.random() * 2
      return {
        from: { x: 0, y: 0, z: 0 },
        to: {
          x: Math.cos(angle) * radius,
          y: -1 + Math.random() * 2,
          z: Math.sin(angle) * radius
        },
        type: 'output' as const,
        progress: Math.random()
      }
    })
  }, [count])

  return (
    <>
      {streams.map((stream, i) => (
        <ThoughtStream key={`output-${i}`} flow={stream} index={i} particleCount={10} />
      ))}
    </>
  )
}

// Processing streams between memories
function ProcessingStreams({
  positions,
  isActive
}: {
  positions: Vector3[]
  isActive: boolean
}) {
  if (!isActive || positions.length < 2) return null

  const streams = useMemo(() => {
    const result: ThoughtFlow[] = []

    // Create streams between consecutive active memories
    for (let i = 0; i < Math.min(positions.length - 1, 5); i++) {
      result.push({
        from: positions[i],
        to: positions[i + 1],
        type: 'processing',
        progress: Math.random()
      })
    }

    // Add some streams to/from core
    if (positions.length > 0) {
      result.push({
        from: { x: 0, y: 0, z: 0 },
        to: positions[0],
        type: 'processing',
        progress: Math.random()
      })
    }

    return result
  }, [positions])

  return (
    <>
      {streams.map((stream, i) => (
        <ThoughtStream key={`processing-${i}`} flow={stream} index={i} particleCount={6} />
      ))}
    </>
  )
}

export function ThoughtFlowVisualization({
  flows,
  processingStage,
  activatedPositions = []
}: ThoughtFlowsProps & { activatedPositions?: Vector3[] }) {
  if (processingStage === 'idle') return null

  return (
    <group>
      {/* Stage-specific streams */}
      {processingStage === 'receiving' && <InputStreams count={6} isActive={true} />}

      {processingStage === 'retrieving' && (
        <ProcessingStreams positions={activatedPositions} isActive={true} />
      )}

      {processingStage === 'processing' && (
        <>
          <ProcessingStreams positions={activatedPositions} isActive={true} />
          {/* Internal core processing */}
          <ThoughtStream
            flow={{
              from: { x: 0, y: -1, z: 0 },
              to: { x: 0, y: 1, z: 0 },
              type: 'processing',
              progress: 0
            }}
            index={100}
            particleCount={8}
          />
        </>
      )}

      {processingStage === 'responding' && <OutputStreams count={8} isActive={true} />}

      {/* Custom flows passed in */}
      {flows.map((flow, i) => (
        <ThoughtStream key={`custom-${i}`} flow={flow} index={i} />
      ))}
    </group>
  )
}

export default ThoughtFlowVisualization
