'use client'

import { useRef, useMemo, useState } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Line2, LineMaterial } from 'three-stdlib'
import { Vector3 } from '@/types/database'
import { MemoryConnection } from '@/lib/services/neuralVisualizationService'

interface ConnectionsProps {
  connections: MemoryConnection[]
  memoryPositions: Map<string, Vector3>
  isActive: boolean
}

// Connection colors by type
const CONNECTION_COLORS = {
  core: '#00E5FF',
  conversation: '#7C4DFF',
  keyword: '#4FC3F7',
  temporal: '#FF9100'
}

// Multi-particle flow along connection
function ConnectionParticles({
  curve,
  color,
  count = 5,
  speed = 0.5,
  isActive
}: {
  curve: THREE.QuadraticBezierCurve3
  color: string
  count?: number
  speed?: number
  isActive: boolean
}) {
  const particlesRef = useRef<THREE.Group>(null)
  const progressRef = useRef<number[]>(
    Array.from({ length: count }, (_, i) => i / count)
  )

  useFrame((_, delta) => {
    if (!particlesRef.current || !isActive) return

    progressRef.current = progressRef.current.map(p => {
      let newP = p + delta * speed
      if (newP > 1) newP -= 1
      return newP
    })

    particlesRef.current.children.forEach((child, i) => {
      const point = curve.getPoint(progressRef.current[i])
      child.position.copy(point)

      // Size variation based on position (bigger in middle)
      const midFactor = 1 - Math.abs(progressRef.current[i] - 0.5) * 2
      const scale = 0.04 + midFactor * 0.03
      child.scale.setScalar(scale)
    })
  })

  return (
    <group ref={particlesRef}>
      {Array.from({ length: count }).map((_, i) => (
        <mesh key={i} position={[0, 0, 0]}>
          <sphereGeometry args={[1, 8, 8]} />
          <meshBasicMaterial
            color={color}
            transparent
            opacity={0.9}
          />
        </mesh>
      ))}
    </group>
  )
}

// Single connection with glow and particles
function Connection({
  start,
  end,
  strength,
  type,
  isActive
}: {
  start: THREE.Vector3
  end: THREE.Vector3
  strength: number
  type: MemoryConnection['type']
  isActive: boolean
}) {
  const lineRef = useRef<Line2>(null)
  const glowRef = useRef<Line2>(null)
  const [hovered, setHovered] = useState(false)

  const color = CONNECTION_COLORS[type] || CONNECTION_COLORS.keyword

  // Create curved path
  const { curve, points } = useMemo(() => {
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5)
    // Arc height based on distance
    const dist = start.distanceTo(end)
    mid.y += dist * 0.15

    const curve = new THREE.QuadraticBezierCurve3(start, mid, end)
    const points = curve.getPoints(30)
    return { curve, points }
  }, [start, end])

  // Animate glow intensity
  useFrame((state) => {
    if (glowRef.current && isActive) {
      const material = glowRef.current.material as LineMaterial
      const pulse = 0.3 + Math.sin(state.clock.elapsedTime * 3) * 0.15
      material.opacity = strength * pulse * (hovered ? 1.5 : 1)
    }
  })

  // Particle count and speed based on type
  const particleConfig = useMemo(() => {
    switch (type) {
      case 'core':
        return { count: 6, speed: 0.8 }
      case 'conversation':
        return { count: 4, speed: 0.4 }
      case 'keyword':
        return { count: 5, speed: 0.6 }
      case 'temporal':
        return { count: 3, speed: 0.3 }
      default:
        return { count: 4, speed: 0.5 }
    }
  }, [type])

  return (
    <group
      onPointerOver={() => setHovered(true)}
      onPointerOut={() => setHovered(false)}
    >
      {/* Glow line (thicker, more transparent) */}
      <Line
        ref={glowRef}
        points={points}
        color={color}
        transparent
        opacity={strength * 0.3}
        lineWidth={2}
        blending={THREE.AdditiveBlending}
      />

      {/* Core line */}
      <Line
        ref={lineRef}
        points={points}
        color={color}
        transparent
        opacity={strength * 0.7}
        lineWidth={0.8}
      />

      {/* Flowing particles */}
      {isActive && (
        <ConnectionParticles
          curve={curve}
          color={color}
          count={particleConfig.count}
          speed={particleConfig.speed}
          isActive={isActive}
        />
      )}
    </group>
  )
}

export function NeuralConnections({ connections, memoryPositions, isActive }: ConnectionsProps) {
  return (
    <group>
      {connections.map((conn, i) => {
        const startPos = conn.sourceId === 'core'
          ? { x: 0, y: 0, z: 0 }
          : memoryPositions.get(conn.sourceId)

        const endPos = conn.targetId === 'core'
          ? { x: 0, y: 0, z: 0 }
          : memoryPositions.get(conn.targetId)

        if (!startPos || !endPos) return null

        return (
          <Connection
            key={`${conn.sourceId}-${conn.targetId}-${i}`}
            start={new THREE.Vector3(startPos.x, startPos.y, startPos.z)}
            end={new THREE.Vector3(endPos.x, endPos.y, endPos.z)}
            strength={conn.strength}
            type={conn.type}
            isActive={isActive}
          />
        )
      })}
    </group>
  )
}

export default NeuralConnections
