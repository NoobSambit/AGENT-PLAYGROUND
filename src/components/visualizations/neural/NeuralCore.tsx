'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { Float, Sparkles } from '@react-three/drei'
import * as THREE from 'three'
import { EmotionVisualization, EMOTION_COLORS } from '@/types/database'
import { ProcessingStage } from '@/lib/services/neuralVisualizationService'

interface NeuralCoreProps {
  emotions: EmotionVisualization[]
  isActive: boolean
  processingStage: ProcessingStage
}

// Mandala ring component
function MandalaRing({
  radius,
  color,
  rotationSpeed,
  rotationAxis,
  segments = 64,
  opacity = 0.6,
  pulseSpeed = 0
}: {
  radius: number
  color: string
  rotationSpeed: number
  rotationAxis: 'x' | 'y' | 'z'
  segments?: number
  opacity?: number
  pulseSpeed?: number
}) {
  const ringRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!ringRef.current) return
    const t = state.clock.elapsedTime

    // Rotation
    ringRef.current.rotation[rotationAxis] = t * rotationSpeed

    // Pulse effect
    if (pulseSpeed > 0) {
      const pulse = 1 + Math.sin(t * pulseSpeed) * 0.1
      ringRef.current.scale.setScalar(pulse)
    }
  })

  return (
    <mesh ref={ringRef}>
      <torusGeometry args={[radius, 0.02, 8, segments]} />
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={1.5}
        transparent
        opacity={opacity}
      />
    </mesh>
  )
}

// Energy wave that pulses outward
function EnergyWave({
  color,
  maxRadius = 4,
  duration = 2,
  delay = 0
}: {
  color: string
  maxRadius?: number
  duration?: number
  delay?: number
}) {
  const waveRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!waveRef.current) return
    const t = ((state.clock.elapsedTime + delay) % duration) / duration

    const radius = t * maxRadius
    const opacity = (1 - t) * 0.4

    waveRef.current.scale.setScalar(radius || 0.01)
    ;(waveRef.current.material as THREE.MeshBasicMaterial).opacity = opacity
  })

  return (
    <mesh ref={waveRef}>
      <ringGeometry args={[0.95, 1, 32]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.4}
        side={THREE.DoubleSide}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

// Holographic scan line
function ScanLine({ color, speed = 1 }: { color: string; speed?: number }) {
  const lineRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (!lineRef.current) return
    const t = state.clock.elapsedTime * speed
    lineRef.current.position.y = Math.sin(t) * 1.5
    lineRef.current.rotation.x = Math.PI / 2
  })

  return (
    <mesh ref={lineRef}>
      <planeGeometry args={[3, 0.02]} />
      <meshBasicMaterial
        color={color}
        transparent
        opacity={0.3}
        blending={THREE.AdditiveBlending}
      />
    </mesh>
  )
}

export function NeuralCore({ emotions, isActive, processingStage }: NeuralCoreProps) {
  const coreRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const outerRef = useRef<THREE.Mesh>(null)
  const shellRef = useRef<THREE.Mesh>(null)

  const dominantColor = emotions[0]?.color || EMOTION_COLORS.trust
  const secondaryColor = emotions[1]?.color || dominantColor
  const tertiaryColor = emotions[2]?.color || secondaryColor

  // Processing stage intensity multipliers
  const stageConfig = useMemo(() => {
    switch (processingStage) {
      case 'receiving':
        return { intensity: 1.5, scale: 1.1, sparkles: 120, waveSpeed: 1.5 }
      case 'retrieving':
        return { intensity: 2.0, scale: 1.15, sparkles: 150, waveSpeed: 2 }
      case 'processing':
        return { intensity: 2.5, scale: 1.2, sparkles: 200, waveSpeed: 2.5 }
      case 'responding':
        return { intensity: 3.0, scale: 1.25, sparkles: 250, waveSpeed: 3 }
      default:
        return { intensity: 1.0, scale: 1.0, sparkles: 60, waveSpeed: 0.5 }
    }
  }, [processingStage])

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (coreRef.current) {
      // Breathing effect
      const breathe = 1 + Math.sin(t * 2) * 0.08
      const activeScale = isActive ? 1.15 : 1
      coreRef.current.scale.setScalar(breathe * activeScale * stageConfig.scale)

      // Slow rotation
      coreRef.current.rotation.y = t * 0.1
    }

    if (innerRef.current) {
      innerRef.current.rotation.y = t * 0.5
      innerRef.current.rotation.x = Math.sin(t * 0.3) * 0.3

      // Pulse during processing
      if (processingStage !== 'idle') {
        const pulse = 1 + Math.sin(t * 4) * 0.1
        innerRef.current.scale.setScalar(pulse)
      }
    }

    if (outerRef.current) {
      outerRef.current.rotation.y = -t * 0.3
      outerRef.current.rotation.z = t * 0.2
    }

    if (shellRef.current) {
      shellRef.current.rotation.y = t * 0.05
      shellRef.current.rotation.x = Math.sin(t * 0.1) * 0.1
    }
  })

  return (
    <group>
      {/* Central glowing core */}
      <Float speed={2} rotationIntensity={0.3} floatIntensity={0.3}>
        <mesh ref={coreRef}>
          <icosahedronGeometry args={[1.0, 4]} />
          <meshStandardMaterial
            color={dominantColor}
            emissive={dominantColor}
            emissiveIntensity={stageConfig.intensity * (isActive ? 2 : 1)}
            roughness={0.2}
            metalness={0.8}
            transparent
            opacity={0.95}
          />
        </mesh>
      </Float>

      {/* Inner energy core */}
      <mesh ref={innerRef}>
        <octahedronGeometry args={[0.6, 2]} />
        <meshStandardMaterial
          color={secondaryColor}
          emissive={secondaryColor}
          emissiveIntensity={stageConfig.intensity}
          wireframe
          transparent
          opacity={0.7}
        />
      </mesh>

      {/* Outer geometric shell */}
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1.6, 1]} />
        <meshStandardMaterial
          color={dominantColor}
          emissive={dominantColor}
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>

      {/* Ethereal outer shell */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[2.2, 1]} />
        <meshStandardMaterial
          color={tertiaryColor}
          emissive={tertiaryColor}
          emissiveIntensity={0.3}
          wireframe
          transparent
          opacity={0.1}
        />
      </mesh>

      {/* Mandala rings */}
      <group rotation={[0, 0, 0]}>
        <MandalaRing
          radius={2.5}
          color={dominantColor}
          rotationSpeed={0.3}
          rotationAxis="y"
          opacity={0.5}
          pulseSpeed={isActive ? 2 : 0}
        />
      </group>
      <group rotation={[Math.PI / 3, 0, 0]}>
        <MandalaRing
          radius={3.0}
          color={secondaryColor}
          rotationSpeed={-0.2}
          rotationAxis="y"
          opacity={0.4}
        />
      </group>
      <group rotation={[Math.PI / 6, Math.PI / 4, 0]}>
        <MandalaRing
          radius={3.5}
          color={tertiaryColor}
          rotationSpeed={0.15}
          rotationAxis="z"
          opacity={0.3}
        />
      </group>
      <group rotation={[-Math.PI / 4, 0, Math.PI / 6]}>
        <MandalaRing
          radius={4.0}
          color="#4FC3F7"
          rotationSpeed={-0.1}
          rotationAxis="x"
          opacity={0.2}
        />
      </group>

      {/* Energy waves during processing */}
      {processingStage !== 'idle' && (
        <>
          <EnergyWave color={dominantColor} maxRadius={5} duration={1.5} delay={0} />
          <EnergyWave color={secondaryColor} maxRadius={5} duration={1.5} delay={0.5} />
          <EnergyWave color={tertiaryColor} maxRadius={5} duration={1.5} delay={1} />
        </>
      )}

      {/* Holographic scan lines */}
      {isActive && (
        <>
          <ScanLine color={dominantColor} speed={1} />
          <group rotation={[0, Math.PI / 2, 0]}>
            <ScanLine color={secondaryColor} speed={0.8} />
          </group>
        </>
      )}

      {/* Ambient sparkles */}
      <Sparkles
        count={stageConfig.sparkles}
        scale={4}
        size={isActive ? 5 : 3}
        speed={processingStage !== 'idle' ? 1.5 : 0.4}
        color={dominantColor}
        opacity={0.9}
      />

      {/* Secondary sparkles layer */}
      {isActive && (
        <Sparkles
          count={80}
          scale={5}
          size={2}
          speed={0.8}
          color={secondaryColor}
          opacity={0.6}
        />
      )}
    </group>
  )
}

export default NeuralCore
