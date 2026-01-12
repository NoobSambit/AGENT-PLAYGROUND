'use client'

import React, { useRef, useMemo, Suspense } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls, Sphere, Line, Text, Html } from '@react-three/drei'
import * as THREE from 'three'
import {
  AgentRecord,
  EmotionType,
  EMOTION_COLORS,
  MemoryVisualization,
  EmotionVisualization,
  VisualizationData
} from '@/types/database'

interface NeuralVizProps {
  agent: AgentRecord
  height?: number
  className?: string
}

// Generate visualization data from agent state
function generateVizData(agent: AgentRecord): VisualizationData {
  // Create memory nodes in a spherical arrangement
  const memories: MemoryVisualization[] = []

  // Simulate memories based on agent stats
  const memoryCount = agent.memoryCount || 10
  for (let i = 0; i < Math.min(memoryCount, 50); i++) {
    const phi = Math.acos(-1 + (2 * i) / memoryCount)
    const theta = Math.sqrt(memoryCount * Math.PI) * phi

    memories.push({
      id: `mem-${i}`,
      position: {
        x: Math.cos(theta) * Math.sin(phi) * 4,
        y: Math.sin(theta) * Math.sin(phi) * 4,
        z: Math.cos(phi) * 4
      },
      importance: Math.random() * 10,
      activated: Math.random() > 0.7,
      activationStrength: Math.random(),
      label: `Memory ${i + 1}`
    })
  }

  // Get emotional state
  const emotionalState: EmotionVisualization[] = agent.emotionalState
    ? Object.entries(agent.emotionalState.currentMood)
      .filter(([_, intensity]) => intensity > 0.2)
      .map(([emotion, intensity]) => ({
        emotion: emotion as EmotionType,
        intensity,
        color: EMOTION_COLORS[emotion as EmotionType]
      }))
    : []

  return {
    memories,
    emotionalState,
    thoughtFlow: [],
    attentionFocus: null
  }
}

// Memory node component
function MemoryNode({ memory }: { memory: MemoryVisualization }) {
  const meshRef = useRef<THREE.Mesh>(null)

  const scale = (memory.importance / 10) * 0.3 + 0.15
  const color = memory.activated ? '#4A90E2' : '#666666'
  const emissiveIntensity = memory.activated ? memory.activationStrength * 2 : 0.1

  useFrame((state) => {
    if (meshRef.current && memory.activated) {
      // Subtle pulsing for activated memories
      const pulse = Math.sin(state.clock.elapsedTime * 2) * 0.1 + 1
      meshRef.current.scale.setScalar(scale * pulse)
    }
  })

  return (
    <Sphere
      ref={meshRef}
      args={[scale, 16, 16]}
      position={[memory.position.x, memory.position.y, memory.position.z]}
    >
      <meshStandardMaterial
        color={color}
        emissive={color}
        emissiveIntensity={emissiveIntensity}
        transparent
        opacity={memory.activated ? 0.9 : 0.4}
      />
    </Sphere>
  )
}

// Emotional particle system
function EmotionalParticles({ emotions }: { emotions: EmotionVisualization[] }) {
  const particlesRef = useRef<THREE.Points>(null)
  const particleCount = 200

  // Generate initial particle positions
  const { positions, colors } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)

    for (let i = 0; i < particleCount; i++) {
      // Random position in a sphere
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(Math.random() * 2 - 1)
      const r = 2 + Math.random() * 2

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Default color (will be updated based on emotions)
      colors[i * 3] = 0.5
      colors[i * 3 + 1] = 0.5
      colors[i * 3 + 2] = 0.5
    }

    return { positions, colors }
  }, [])

  // Update colors based on emotions
  useMemo(() => {
    if (emotions.length === 0) return

    const dominantEmotion = emotions.reduce((max, e) =>
      e.intensity > max.intensity ? e : max
    )

    const colorHex = new THREE.Color(dominantEmotion.color)

    for (let i = 0; i < particleCount; i++) {
      colors[i * 3] = colorHex.r
      colors[i * 3 + 1] = colorHex.g
      colors[i * 3 + 2] = colorHex.b
    }
  }, [emotions, colors])

  useFrame((state) => {
    if (!particlesRef.current) return

    const positionsArray = particlesRef.current.geometry.attributes.position.array as Float32Array
    const time = state.clock.elapsedTime

    for (let i = 0; i < particleCount; i++) {
      // Gentle floating motion
      positionsArray[i * 3 + 1] += Math.sin(time + i * 0.1) * 0.005
    }

    particlesRef.current.geometry.attributes.position.needsUpdate = true
    particlesRef.current.rotation.y = time * 0.05
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={particleCount}
          array={positions}
          itemSize={3}
        />
        <bufferAttribute
          attach="attributes-color"
          count={particleCount}
          array={colors}
          itemSize={3}
        />
      </bufferGeometry>
      <pointsMaterial
        size={0.08}
        vertexColors
        transparent
        opacity={0.6}
        sizeAttenuation
      />
    </points>
  )
}

// Brain structure (wireframe sphere)
function BrainStructure() {
  return (
    <group>
      {/* Outer shell */}
      <Sphere args={[5, 32, 32]}>
        <meshStandardMaterial
          color="#1a1a2e"
          wireframe
          transparent
          opacity={0.1}
        />
      </Sphere>

      {/* Inner core */}
      <Sphere args={[1.5, 16, 16]}>
        <meshStandardMaterial
          color="#4A90E2"
          emissive="#4A90E2"
          emissiveIntensity={0.5}
          transparent
          opacity={0.3}
        />
      </Sphere>

      {/* Connection rings */}
      {[2, 3, 4].map((radius, i) => (
        <mesh key={i} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[radius, 0.02, 8, 64]} />
          <meshStandardMaterial
            color="#4A90E2"
            transparent
            opacity={0.2}
          />
        </mesh>
      ))}
    </group>
  )
}

// Connection lines between memories
function MemoryConnections({ memories }: { memories: MemoryVisualization[] }) {
  const connections = useMemo(() => {
    const lines: { start: THREE.Vector3; end: THREE.Vector3 }[] = []

    // Connect nearby activated memories
    const activatedMemories = memories.filter(m => m.activated)

    for (let i = 0; i < activatedMemories.length; i++) {
      for (let j = i + 1; j < activatedMemories.length; j++) {
        const m1 = activatedMemories[i]
        const m2 = activatedMemories[j]

        const distance = Math.sqrt(
          Math.pow(m1.position.x - m2.position.x, 2) +
          Math.pow(m1.position.y - m2.position.y, 2) +
          Math.pow(m1.position.z - m2.position.z, 2)
        )

        if (distance < 4) {
          lines.push({
            start: new THREE.Vector3(m1.position.x, m1.position.y, m1.position.z),
            end: new THREE.Vector3(m2.position.x, m2.position.y, m2.position.z)
          })
        }
      }
    }

    return lines
  }, [memories])

  return (
    <group>
      {connections.map((conn, i) => (
        <Line
          key={i}
          points={[conn.start, conn.end]}
          color="#4A90E2"
          lineWidth={1}
          opacity={0.3}
          transparent
        />
      ))}
    </group>
  )
}

// Visualization legend
function VisualizationLegend() {
  return (
    <div className="absolute bottom-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white text-sm">
      <div className="font-medium mb-2">Legend</div>
      <div className="space-y-1 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-blue-500" />
          <span>Active Memory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span>Dormant Memory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gradient-to-r from-blue-400 to-purple-500" />
          <span>Core</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-yellow-500 opacity-50" />
          <span>Emotional Particles</span>
        </div>
      </div>
    </div>
  )
}

// Loading fallback
function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gray-900 text-white">
      <div className="text-center">
        <div className="animate-spin w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full mx-auto mb-2" />
        <div className="text-sm">Loading visualization...</div>
      </div>
    </div>
  )
}

// Main scene component
function Scene({ vizData }: { vizData: VisualizationData }) {
  return (
    <>
      {/* Lighting */}
      <ambientLight intensity={0.3} />
      <pointLight position={[10, 10, 10]} intensity={0.5} />
      <pointLight position={[-10, -10, -10]} intensity={0.3} />

      {/* Brain structure */}
      <BrainStructure />

      {/* Memory nodes */}
      {vizData.memories.map(memory => (
        <MemoryNode key={memory.id} memory={memory} />
      ))}

      {/* Memory connections */}
      <MemoryConnections memories={vizData.memories} />

      {/* Emotional particles */}
      <EmotionalParticles emotions={vizData.emotionalState} />

      {/* Camera controls */}
      <OrbitControls
        enableZoom
        enablePan={false}
        enableRotate
        autoRotate
        autoRotateSpeed={0.5}
        minDistance={8}
        maxDistance={20}
      />
    </>
  )
}

// Main component
export function NeuralViz({ agent, height = 400, className = '' }: NeuralVizProps) {
  const vizData = useMemo(() => generateVizData(agent), [agent])

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 0, 12], fov: 60 }}
          gl={{ antialias: true, alpha: true }}
          style={{ background: 'linear-gradient(to bottom, #0f0f1a, #1a1a2e)' }}
        >
          <Scene vizData={vizData} />
        </Canvas>
      </Suspense>

      {/* Legend */}
      <VisualizationLegend />

      {/* Info overlay */}
      <div className="absolute top-4 left-4 bg-black/50 backdrop-blur-sm rounded-lg p-3 text-white">
        <div className="text-sm font-medium">{agent.name}&apos;s Mind</div>
        <div className="text-xs text-gray-300 mt-1">
          {vizData.memories.length} memories | {vizData.memories.filter(m => m.activated).length} active
        </div>
      </div>

      {/* Controls hint */}
      <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs">
        Drag to rotate | Scroll to zoom
      </div>
    </div>
  )
}

// Simplified 2D visualization for performance
export function NeuralViz2D({ agent, className = '' }: { agent: AgentRecord; className?: string }) {
  const memories = agent.memoryCount || 0
  const dominantEmotion = agent.emotionalState?.dominantEmotion || 'trust'
  const emotionColor = EMOTION_COLORS[dominantEmotion]

  return (
    <div className={`relative rounded-lg overflow-hidden ${className}`}
         style={{ background: 'linear-gradient(to bottom, #0f0f1a, #1a1a2e)' }}>
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Background circles */}
        {[80, 60, 40].map((r, i) => (
          <circle
            key={i}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="currentColor"
            strokeOpacity={0.1}
            className="text-blue-500"
          />
        ))}

        {/* Memory nodes */}
        {Array.from({ length: Math.min(memories, 20) }).map((_, i) => {
          const angle = (i / Math.min(memories, 20)) * Math.PI * 2
          const radius = 50 + Math.random() * 30
          const x = 100 + Math.cos(angle) * radius
          const y = 100 + Math.sin(angle) * radius
          const size = 3 + Math.random() * 4

          return (
            <circle
              key={i}
              cx={x}
              cy={y}
              r={size}
              fill={i % 3 === 0 ? '#4A90E2' : '#666666'}
              opacity={i % 3 === 0 ? 0.8 : 0.4}
            />
          )
        })}

        {/* Core */}
        <circle
          cx="100"
          cy="100"
          r="20"
          fill={emotionColor}
          opacity={0.5}
        />
        <circle
          cx="100"
          cy="100"
          r="10"
          fill={emotionColor}
          opacity={0.8}
        />
      </svg>

      {/* Info overlay */}
      <div className="absolute bottom-2 left-2 text-white text-xs">
        <div className="font-medium">{agent.name}</div>
        <div className="text-gray-300">{memories} memories</div>
      </div>
    </div>
  )
}

export default NeuralViz
