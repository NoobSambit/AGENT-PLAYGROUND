'use client'

import { useRef, useState, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Trail, Html } from '@react-three/drei'
import * as THREE from 'three'
import { MemoryVisualization, EMOTION_COLORS, EmotionType } from '@/types/database'

interface MemoryNodeProps {
  memory: MemoryVisualization
  memoryType?: 'conversation' | 'fact' | 'interaction' | 'personality_insight'
  emotionAssociated?: EmotionType
  index: number
  isActive: boolean
  isRecentlyCreated: boolean
  onClick?: (memory: MemoryVisualization) => void
}

// Different geometries for different memory types
function MemoryGeometry({ type, scale }: { type: string; scale: number }) {
  switch (type) {
    case 'conversation':
      return <icosahedronGeometry args={[scale, 1]} />
    case 'fact':
      return <sphereGeometry args={[scale, 16, 16]} />
    case 'interaction':
      return <octahedronGeometry args={[scale, 0]} />
    case 'personality_insight':
      return <torusGeometry args={[scale * 0.8, scale * 0.3, 8, 16]} />
    default:
      return <dodecahedronGeometry args={[scale, 0]} />
  }
}

export function MemoryNode({
  memory,
  memoryType = 'conversation',
  emotionAssociated,
  index,
  isActive,
  isRecentlyCreated,
  onClick
}: MemoryNodeProps) {
  const meshRef = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Mesh>(null)
  const ringRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  // Scale based on importance (1-10)
  const baseScale = (memory.importance / 10) * 0.4 + 0.15

  // Color scheme based on state and type
  const colors = useMemo(() => {
    const emotionColor = emotionAssociated ? EMOTION_COLORS[emotionAssociated] : null

    if (isRecentlyCreated) {
      return {
        main: '#00E676',
        emissive: '#00E676',
        glow: '#00E676',
        ring: emotionColor || '#00E676'
      }
    }

    if (memory.activated) {
      return {
        main: '#4FC3F7',
        emissive: '#00B8D4',
        glow: '#00E5FF',
        ring: emotionColor || '#00E5FF'
      }
    }

    return {
      main: '#546E7A',
      emissive: '#37474F',
      glow: '#455A64',
      ring: emotionColor || '#455A64'
    }
  }, [memory.activated, isRecentlyCreated, emotionAssociated])

  // Recency affects saturation (newer = more vivid)
  const recencyFactor = memory.activationStrength > 0 ? 0.7 + memory.activationStrength * 0.3 : 0.5

  const isHighlighted = isRecentlyCreated || memory.activated || hovered

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime

    // Floating motion
    meshRef.current.position.y = memory.position.y + Math.sin(t * 0.8 + index * 0.5) * 0.12

    // Pulsing for highlighted memories
    if (isHighlighted) {
      const pulse = 1 + Math.sin(t * 3 + index) * 0.12
      const activationBoost = memory.activationStrength > 0 ? 1 + memory.activationStrength * 0.25 : 1
      const hoverBoost = hovered ? 1.3 : 1
      meshRef.current.scale.setScalar(baseScale * pulse * activationBoost * hoverBoost)
    } else {
      meshRef.current.scale.setScalar(baseScale)
    }

    // Rotation
    meshRef.current.rotation.y = t * 0.3 + index
    meshRef.current.rotation.x = Math.sin(t * 0.2 + index) * 0.2

    // Glow pulse
    if (glowRef.current && isHighlighted) {
      const glowPulse = 1.3 + Math.sin(t * 4 + index) * 0.2
      glowRef.current.scale.setScalar(baseScale * glowPulse * 1.5)
    }

    // Ring rotation
    if (ringRef.current) {
      ringRef.current.rotation.x = t * 0.5
      ringRef.current.rotation.z = t * 0.3
    }
  })

  const handleClick = () => {
    if (onClick) onClick(memory)
  }

  return (
    <group position={[memory.position.x, memory.position.y, memory.position.z]}>
      {/* Outer glow sphere */}
      {isHighlighted && (
        <mesh ref={glowRef}>
          <sphereGeometry args={[baseScale * 1.5, 16, 16]} />
          <meshBasicMaterial
            color={colors.glow}
            transparent
            opacity={0.15}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Emotion ring */}
      {emotionAssociated && (
        <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[baseScale * 1.8, 0.02, 8, 32]} />
          <meshBasicMaterial
            color={colors.ring}
            transparent
            opacity={isHighlighted ? 0.8 : 0.3}
          />
        </mesh>
      )}

      {/* Main memory node */}
      {memory.activated && isActive ? (
        <Trail
          width={0.4}
          length={5}
          color={colors.emissive}
          attenuation={(t) => t * t}
        >
          <mesh
            ref={meshRef}
            onClick={handleClick}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <MemoryGeometry type={memoryType} scale={baseScale} />
            <meshStandardMaterial
              color={colors.main}
              emissive={colors.emissive}
              emissiveIntensity={isHighlighted ? 2.5 : 0.3}
              roughness={0.3}
              metalness={0.7}
              transparent
              opacity={isHighlighted ? 1 : recencyFactor}
            />
          </mesh>
        </Trail>
      ) : (
        <mesh
          ref={meshRef}
          onClick={handleClick}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <MemoryGeometry type={memoryType} scale={baseScale} />
          <meshStandardMaterial
            color={colors.main}
            emissive={colors.emissive}
            emissiveIntensity={isHighlighted ? 2 : 0.2}
            roughness={0.3}
            metalness={0.7}
            transparent
            opacity={isHighlighted ? 0.95 : recencyFactor * 0.7}
          />
        </mesh>
      )}

      {/* Hover tooltip */}
      {hovered && (
        <Html position={[0, baseScale + 0.5, 0]} center>
          <div className="bg-black/90 backdrop-blur-md px-4 py-3 rounded-lg text-xs text-white max-w-[220px] border border-white/10 shadow-xl">
            <div className="font-semibold text-cyan-400 mb-1 truncate">
              {memory.label || 'Memory'}
            </div>
            <div className="flex flex-wrap gap-2 text-gray-400 text-[10px]">
              <span className="bg-white/10 px-1.5 py-0.5 rounded capitalize">{memoryType}</span>
              <span>Imp: {memory.importance.toFixed(1)}</span>
              {memory.activated && (
                <span className="text-green-400 flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-green-400 rounded-full animate-pulse" />
                  Active
                </span>
              )}
            </div>
            {emotionAssociated && (
              <div className="mt-1.5 flex items-center gap-1.5">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: EMOTION_COLORS[emotionAssociated] }}
                />
                <span className="capitalize text-[10px]">{emotionAssociated}</span>
              </div>
            )}
          </div>
        </Html>
      )}
    </group>
  )
}

export default MemoryNode
