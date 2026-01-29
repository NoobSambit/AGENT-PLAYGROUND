'use client'

import { useRef, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { EmotionVisualization } from '@/types/database'
import { ProcessingStage } from '@/lib/services/neuralVisualizationService'

interface ParticleSystemProps {
  emotions: EmotionVisualization[]
  isActive: boolean
  processingStage: ProcessingStage
}

// GPU-optimized particle system with 2000+ particles
export function EmotionalAura({ emotions, isActive, processingStage }: ParticleSystemProps) {
  const particlesRef = useRef<THREE.Points>(null)
  const velocitiesRef = useRef<Float32Array | null>(null)

  // Particle count based on activity
  const particleCount = isActive ? 2000 : 1200

  const { positions, colors, sizes, velocities } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)
    const velocities = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      // Spherical distribution with variation
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 4 + Math.random() * 4 // 4-8 radius

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Distribute colors based on emotions
      const emotionIndex = Math.floor(Math.random() * emotions.length)
      const emotion = emotions[emotionIndex] || emotions[0]
      const color = new THREE.Color(emotion?.color || '#4FC3F7')

      // Intensity variation
      const intensityVar = 0.6 + (emotion?.intensity || 0.5) * 0.4
      color.multiplyScalar(intensityVar)

      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      // Size variation
      sizes[i] = Math.random() * 0.12 + 0.03

      // Initial velocities for swirling
      velocities[i * 3] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 1] = (Math.random() - 0.5) * 0.02
      velocities[i * 3 + 2] = (Math.random() - 0.5) * 0.02
    }

    return { positions, colors, sizes, velocities }
  }, [particleCount, emotions])

  // Store velocities ref
  velocitiesRef.current = velocities

  useFrame((state) => {
    if (!particlesRef.current || !velocitiesRef.current) return
    const t = state.clock.elapsedTime

    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array
    const colorArray = particlesRef.current.geometry.attributes.color.array as Float32Array
    const vel = velocitiesRef.current

    // Speed based on processing stage
    const speedMult = processingStage !== 'idle' ? 2 : 1

    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3

      // Get current position
      let x = posArray[idx]
      let y = posArray[idx + 1]
      let z = posArray[idx + 2]

      // Orbital motion around Y axis
      const angle = Math.atan2(z, x)
      const newAngle = angle + 0.002 * speedMult
      const horizontalDist = Math.sqrt(x * x + z * z)

      x = Math.cos(newAngle) * horizontalDist
      z = Math.sin(newAngle) * horizontalDist

      // Vertical oscillation
      y += Math.sin(t * 2 + i * 0.1) * 0.01 * speedMult

      // Add velocity
      x += vel[idx] * speedMult
      y += vel[idx + 1] * speedMult
      z += vel[idx + 2] * speedMult

      // Keep within bounds (respawn if too far or too close)
      const newDist = Math.sqrt(x * x + y * y + z * z)
      if (newDist > 9 || newDist < 3.5) {
        const theta = Math.random() * Math.PI * 2
        const phi = Math.acos(2 * Math.random() - 1)
        const r = 5 + Math.random() * 2

        x = r * Math.sin(phi) * Math.cos(theta)
        y = r * Math.sin(phi) * Math.sin(theta)
        z = r * Math.cos(phi)
      }

      posArray[idx] = x
      posArray[idx + 1] = y
      posArray[idx + 2] = z

      // Color pulsing during processing
      if (processingStage !== 'idle') {
        const pulse = 0.8 + Math.sin(t * 4 + i * 0.1) * 0.2
        const emotion = emotions[i % emotions.length] || emotions[0]
        const baseColor = new THREE.Color(emotion?.color || '#4FC3F7')
        colorArray[idx] = baseColor.r * pulse
        colorArray[idx + 1] = baseColor.g * pulse
        colorArray[idx + 2] = baseColor.b * pulse
      }
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true
    if (processingStage !== 'idle') {
      particlesRef.current.geometry.attributes.color.needsUpdate = true
    }

    // Overall rotation
    particlesRef.current.rotation.y = t * 0.05 * speedMult
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
        <bufferAttribute attach="attributes-color" args={[colors, 3]} />
        <bufferAttribute attach="attributes-size" args={[sizes, 1]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.1}
        vertexColors
        transparent
        opacity={0.75}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

// Burst particles for memory activation
export function ActivationBurst({
  position,
  color,
  onComplete
}: {
  position: THREE.Vector3
  color: string
  onComplete?: () => void
}) {
  const particlesRef = useRef<THREE.Points>(null)
  const startTime = useRef(Date.now())
  const duration = 1500 // ms

  const { positions, velocities } = useMemo(() => {
    const count = 50
    const positions = new Float32Array(count * 3)
    const velocities = new Float32Array(count * 3)

    for (let i = 0; i < count; i++) {
      positions[i * 3] = position.x
      positions[i * 3 + 1] = position.y
      positions[i * 3 + 2] = position.z

      // Random outward velocity
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const speed = 0.05 + Math.random() * 0.1

      velocities[i * 3] = Math.sin(phi) * Math.cos(theta) * speed
      velocities[i * 3 + 1] = Math.sin(phi) * Math.sin(theta) * speed
      velocities[i * 3 + 2] = Math.cos(phi) * speed
    }

    return { positions, velocities }
  }, [position])

  useFrame(() => {
    if (!particlesRef.current) return

    const elapsed = Date.now() - startTime.current
    const progress = elapsed / duration

    if (progress >= 1) {
      if (onComplete) onComplete()
      return
    }

    const posArray = particlesRef.current.geometry.attributes.position.array as Float32Array

    for (let i = 0; i < 50; i++) {
      const idx = i * 3
      posArray[idx] += velocities[idx]
      posArray[idx + 1] += velocities[idx + 1]
      posArray[idx + 2] += velocities[idx + 2]
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true

    // Fade out
    const material = particlesRef.current.material as THREE.PointsMaterial
    material.opacity = (1 - progress) * 0.8
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.15}
        color={color}
        transparent
        opacity={0.8}
        blending={THREE.AdditiveBlending}
        depthWrite={false}
      />
    </points>
  )
}

export default EmotionalAura
