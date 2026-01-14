'use client'

import React, { useRef, useMemo, useState, useCallback, Suspense, useEffect } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Sphere, Float, Trail, Sparkles, Stars, Html, MeshDistortMaterial, GradientTexture, Environment, MeshTransmissionMaterial } from '@react-three/drei'
import { EffectComposer, Bloom, ChromaticAberration, Vignette, Noise } from '@react-three/postprocessing'
import { BlendFunction } from 'postprocessing'
import * as THREE from 'three'
import {
  AgentRecord,
  EmotionType,
  EMOTION_COLORS,
  MemoryVisualization,
  EmotionVisualization,
  VisualizationData,
  ThoughtFlow
} from '@/types/database'

interface NeuralVizProps {
  agent: AgentRecord
  height?: number
  className?: string
  isActive?: boolean // Whether agent is currently in conversation
  showThoughtFlow?: boolean
}

// ============================================
// UTILITY FUNCTIONS
// ============================================

function generateVizData(agent: AgentRecord, isActive: boolean = false): VisualizationData {
  const memories: MemoryVisualization[] = []
  const memoryCount = agent.memoryCount || 15

  // Create memory nodes in a DNA helix-like spiral pattern
  for (let i = 0; i < Math.min(memoryCount, 60); i++) {
    const t = i / memoryCount
    const angle = t * Math.PI * 6 // Multiple spiral turns
    const radius = 3 + Math.sin(t * Math.PI * 2) * 1.5
    const height = (t - 0.5) * 8

    memories.push({
      id: `mem-${i}`,
      position: {
        x: Math.cos(angle) * radius,
        y: height,
        z: Math.sin(angle) * radius
      },
      importance: 3 + Math.random() * 7,
      activated: isActive ? Math.random() > 0.5 : Math.random() > 0.7,
      activationStrength: Math.random(),
      label: `Memory ${i + 1}`
    })
  }

  // Get emotional state
  const emotionalState: EmotionVisualization[] = agent.emotionalState
    ? Object.entries(agent.emotionalState.currentMood)
        .filter(([_, intensity]) => intensity > 0.15)
        .map(([emotion, intensity]) => ({
          emotion: emotion as EmotionType,
          intensity,
          color: EMOTION_COLORS[emotion as EmotionType]
        }))
        .sort((a, b) => b.intensity - a.intensity)
    : [{ emotion: 'trust' as EmotionType, intensity: 0.5, color: EMOTION_COLORS.trust }]

  // Generate thought flows for active state
  const thoughtFlow: ThoughtFlow[] = []
  if (isActive) {
    for (let i = 0; i < 8; i++) {
      const startAngle = Math.random() * Math.PI * 2
      const endAngle = Math.random() * Math.PI * 2
      thoughtFlow.push({
        from: {
          x: Math.cos(startAngle) * 5,
          y: (Math.random() - 0.5) * 4,
          z: Math.sin(startAngle) * 5
        },
        to: {
          x: Math.cos(endAngle) * 1.5,
          y: (Math.random() - 0.5) * 2,
          z: Math.sin(endAngle) * 1.5
        },
        progress: Math.random(),
        type: ['input', 'processing', 'output'][Math.floor(Math.random() * 3)] as ThoughtFlow['type']
      })
    }
  }

  return {
    memories,
    emotionalState,
    thoughtFlow,
    attentionFocus: isActive ? { position: { x: 0, y: 0, z: 0 }, radius: 2 } : null
  }
}

// ============================================
// CORE COMPONENTS
// ============================================

// Glowing core with pulsating energy
function NeuralCore({ emotions, isActive }: { emotions: EmotionVisualization[]; isActive: boolean }) {
  const coreRef = useRef<THREE.Mesh>(null)
  const innerRef = useRef<THREE.Mesh>(null)
  const outerRef = useRef<THREE.Mesh>(null)

  const dominantColor = emotions[0]?.color || EMOTION_COLORS.trust
  const secondaryColor = emotions[1]?.color || dominantColor

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (coreRef.current) {
      // Breathing effect
      const breathe = 1 + Math.sin(t * 2) * 0.1
      coreRef.current.scale.setScalar(breathe * (isActive ? 1.2 : 1))
    }

    if (innerRef.current) {
      // Inner rotation
      innerRef.current.rotation.y = t * 0.5
      innerRef.current.rotation.x = Math.sin(t * 0.3) * 0.2
    }

    if (outerRef.current) {
      // Outer counter-rotation
      outerRef.current.rotation.y = -t * 0.3
      outerRef.current.rotation.z = t * 0.2
    }
  })

  return (
    <group>
      {/* Central glowing core */}
      <Float speed={2} rotationIntensity={0.5} floatIntensity={0.5}>
        <mesh ref={coreRef}>
          <icosahedronGeometry args={[1.2, 4]} />
          <MeshDistortMaterial
            color={dominantColor}
            emissive={dominantColor}
            emissiveIntensity={isActive ? 3 : 1.5}
            distort={0.3}
            speed={2}
            roughness={0.2}
            metalness={0.8}
            transparent
            opacity={0.9}
          />
        </mesh>
      </Float>

      {/* Inner energy sphere */}
      <mesh ref={innerRef}>
        <octahedronGeometry args={[0.8, 2]} />
        <meshStandardMaterial
          color={secondaryColor}
          emissive={secondaryColor}
          emissiveIntensity={isActive ? 2 : 1}
          wireframe
          transparent
          opacity={0.6}
        />
      </mesh>

      {/* Outer shell */}
      <mesh ref={outerRef}>
        <icosahedronGeometry args={[1.8, 1]} />
        <meshStandardMaterial
          color={dominantColor}
          emissive={dominantColor}
          emissiveIntensity={0.5}
          wireframe
          transparent
          opacity={0.15}
        />
      </mesh>

      {/* Energy halo */}
      <Sparkles
        count={isActive ? 100 : 40}
        scale={3}
        size={isActive ? 4 : 2}
        speed={0.5}
        color={dominantColor}
        opacity={0.8}
      />
    </group>
  )
}

// Enhanced memory node with glow effect
function MemoryNode({ memory, index, isActive }: { memory: MemoryVisualization; index: number; isActive: boolean }) {
  const meshRef = useRef<THREE.Mesh>(null)
  const [hovered, setHovered] = useState(false)

  const baseScale = (memory.importance / 10) * 0.35 + 0.15
  const color = memory.activated ? '#4FC3F7' : '#546E7A'
  const emissiveColor = memory.activated ? '#00B8D4' : '#37474F'

  useFrame((state) => {
    if (!meshRef.current) return
    const t = state.clock.elapsedTime

    // Floating motion
    meshRef.current.position.y = memory.position.y + Math.sin(t + index * 0.5) * 0.15

    // Pulsing for activated memories
    if (memory.activated) {
      const pulse = 1 + Math.sin(t * 3 + index) * 0.15
      meshRef.current.scale.setScalar(baseScale * pulse * (hovered ? 1.3 : 1))
    } else {
      meshRef.current.scale.setScalar(baseScale * (hovered ? 1.2 : 1))
    }

    // Rotation
    meshRef.current.rotation.y = t * 0.5 + index
    meshRef.current.rotation.x = Math.sin(t * 0.3 + index) * 0.3
  })

  return (
    <group>
      {memory.activated && isActive ? (
        <Trail
          width={0.3}
          length={4}
          color={emissiveColor}
          attenuation={(t) => t * t}
        >
          <mesh
            ref={meshRef}
            position={[memory.position.x, memory.position.y, memory.position.z]}
            onPointerOver={() => setHovered(true)}
            onPointerOut={() => setHovered(false)}
          >
            <dodecahedronGeometry args={[baseScale, 0]} />
            <meshStandardMaterial
              color={color}
              emissive={emissiveColor}
              emissiveIntensity={memory.activated ? 2.5 : 0.3}
              roughness={0.3}
              metalness={0.7}
              transparent
              opacity={memory.activated ? 1 : 0.5}
            />
          </mesh>
        </Trail>
      ) : (
        <mesh
          ref={meshRef}
          position={[memory.position.x, memory.position.y, memory.position.z]}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <dodecahedronGeometry args={[baseScale, 0]} />
          <meshStandardMaterial
            color={color}
            emissive={emissiveColor}
            emissiveIntensity={memory.activated ? 2 : 0.2}
            roughness={0.3}
            metalness={0.7}
            transparent
            opacity={memory.activated ? 0.9 : 0.4}
          />
        </mesh>
      )}

      {/* Hover tooltip */}
      {hovered && (
        <Html position={[memory.position.x, memory.position.y + 0.5, memory.position.z]}>
          <div className="bg-black/80 backdrop-blur-sm px-2 py-1 rounded text-xs text-white whitespace-nowrap">
            {memory.label} | Importance: {memory.importance.toFixed(1)}
          </div>
        </Html>
      )}
    </group>
  )
}

// Neural network connections with flowing energy
function NeuralConnections({ memories, isActive }: { memories: MemoryVisualization[]; isActive: boolean }) {
  const linesRef = useRef<THREE.Group>(null)

  const connections = useMemo(() => {
    const lines: Array<{
      start: THREE.Vector3
      end: THREE.Vector3
      strength: number
    }> = []

    const activatedMemories = memories.filter(m => m.activated)

    // Connect activated memories to core
    for (const memory of activatedMemories) {
      lines.push({
        start: new THREE.Vector3(memory.position.x, memory.position.y, memory.position.z),
        end: new THREE.Vector3(0, 0, 0),
        strength: memory.activationStrength
      })
    }

    // Connect nearby activated memories
    for (let i = 0; i < activatedMemories.length; i++) {
      for (let j = i + 1; j < activatedMemories.length; j++) {
        const m1 = activatedMemories[i]
        const m2 = activatedMemories[j]
        const distance = Math.sqrt(
          Math.pow(m1.position.x - m2.position.x, 2) +
          Math.pow(m1.position.y - m2.position.y, 2) +
          Math.pow(m1.position.z - m2.position.z, 2)
        )

        if (distance < 5) {
          lines.push({
            start: new THREE.Vector3(m1.position.x, m1.position.y, m1.position.z),
            end: new THREE.Vector3(m2.position.x, m2.position.y, m2.position.z),
            strength: Math.max(m1.activationStrength, m2.activationStrength) * (1 - distance / 5)
          })
        }
      }
    }

    return lines
  }, [memories])

  return (
    <group ref={linesRef}>
      {connections.map((conn, i) => (
        <NeuralConnection key={i} start={conn.start} end={conn.end} strength={conn.strength} isActive={isActive} />
      ))}
    </group>
  )
}

// Individual neural connection with animated energy flow
function NeuralConnection({ start, end, strength, isActive }: { start: THREE.Vector3; end: THREE.Vector3; strength: number; isActive: boolean }) {
  const lineRef = useRef<THREE.Line>(null)
  const particleRef = useRef<THREE.Mesh>(null)
  const [progress, setProgress] = useState(0)

  useFrame((state, delta) => {
    if (isActive) {
      setProgress((prev) => (prev + delta * 0.5) % 1)
    }

    if (particleRef.current && isActive) {
      const pos = new THREE.Vector3().lerpVectors(start, end, progress)
      particleRef.current.position.copy(pos)
    }
  })

  const curve = useMemo(() => {
    const mid = new THREE.Vector3().lerpVectors(start, end, 0.5)
    mid.y += 0.5
    return new THREE.QuadraticBezierCurve3(start, mid, end)
  }, [start, end])

  const points = useMemo(() => curve.getPoints(20), [curve])

  return (
    <group>
      <line ref={lineRef}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={points.length}
            array={new Float32Array(points.flatMap(p => [p.x, p.y, p.z]))}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial
          color="#00BCD4"
          transparent
          opacity={strength * 0.6}
          linewidth={1}
        />
      </line>

      {/* Energy particle */}
      {isActive && (
        <mesh ref={particleRef}>
          <sphereGeometry args={[0.08, 8, 8]} />
          <meshBasicMaterial color="#00E5FF" transparent opacity={0.9} />
        </mesh>
      )}
    </group>
  )
}

// Emotional aura - particle cloud showing current emotional state
function EmotionalAura({ emotions, isActive }: { emotions: EmotionVisualization[]; isActive: boolean }) {
  const particlesRef = useRef<THREE.Points>(null)
  const particleCount = isActive ? 500 : 300

  const { positions, colors, sizes } = useMemo(() => {
    const positions = new Float32Array(particleCount * 3)
    const colors = new Float32Array(particleCount * 3)
    const sizes = new Float32Array(particleCount)

    for (let i = 0; i < particleCount; i++) {
      // Spherical distribution
      const theta = Math.random() * Math.PI * 2
      const phi = Math.acos(2 * Math.random() - 1)
      const r = 4 + Math.random() * 3

      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta)
      positions[i * 3 + 2] = r * Math.cos(phi)

      // Color based on emotion
      const emotionIndex = i % emotions.length
      const color = new THREE.Color(emotions[emotionIndex]?.color || '#4FC3F7')
      colors[i * 3] = color.r
      colors[i * 3 + 1] = color.g
      colors[i * 3 + 2] = color.b

      sizes[i] = Math.random() * 0.15 + 0.05
    }

    return { positions, colors, sizes }
  }, [particleCount, emotions])

  useFrame((state) => {
    if (!particlesRef.current) return
    const t = state.clock.elapsedTime

    particlesRef.current.rotation.y = t * 0.05
    particlesRef.current.rotation.x = Math.sin(t * 0.1) * 0.1

    // Update particle positions for swirling effect
    const positionsArray = particlesRef.current.geometry.attributes.position.array as Float32Array
    for (let i = 0; i < particleCount; i++) {
      const idx = i * 3
      const originalY = positionsArray[idx + 1]
      positionsArray[idx + 1] = originalY + Math.sin(t * 2 + i * 0.1) * 0.02
    }
    particlesRef.current.geometry.attributes.position.needsUpdate = true
  })

  return (
    <points ref={particlesRef}>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" count={particleCount} array={positions} itemSize={3} />
        <bufferAttribute attach="attributes-color" count={particleCount} array={colors} itemSize={3} />
        <bufferAttribute attach="attributes-size" count={particleCount} array={sizes} itemSize={1} />
      </bufferGeometry>
      <pointsMaterial
        size={0.12}
        vertexColors
        transparent
        opacity={0.7}
        sizeAttenuation
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

// Thought flow visualization - data streams entering/leaving the brain
function ThoughtFlowVisualization({ flows, isActive }: { flows: ThoughtFlow[]; isActive: boolean }) {
  if (!isActive || flows.length === 0) return null

  return (
    <group>
      {flows.map((flow, i) => (
        <ThoughtStream key={i} flow={flow} index={i} />
      ))}
    </group>
  )
}

function ThoughtStream({ flow, index }: { flow: ThoughtFlow; index: number }) {
  const streamRef = useRef<THREE.Group>(null)
  const [particles, setParticles] = useState<Array<{ pos: THREE.Vector3; speed: number }>>([])

  const color = flow.type === 'input' ? '#00E676' : flow.type === 'output' ? '#E040FB' : '#FFAB40'

  useEffect(() => {
    // Initialize stream particles
    const newParticles = Array.from({ length: 8 }, () => ({
      pos: new THREE.Vector3().lerpVectors(
        new THREE.Vector3(flow.from.x, flow.from.y, flow.from.z),
        new THREE.Vector3(flow.to.x, flow.to.y, flow.to.z),
        Math.random()
      ),
      speed: 0.3 + Math.random() * 0.4
    }))
    setParticles(newParticles)
  }, [flow])

  useFrame((_, delta) => {
    setParticles(prev => prev.map(p => {
      const from = new THREE.Vector3(flow.from.x, flow.from.y, flow.from.z)
      const to = new THREE.Vector3(flow.to.x, flow.to.y, flow.to.z)
      const currentProgress = from.distanceTo(p.pos) / from.distanceTo(to)
      let newProgress = currentProgress + delta * p.speed

      if (newProgress > 1) newProgress = 0

      return {
        ...p,
        pos: new THREE.Vector3().lerpVectors(from, to, newProgress)
      }
    }))
  })

  return (
    <group ref={streamRef}>
      {particles.map((particle, i) => (
        <mesh key={i} position={particle.pos}>
          <sphereGeometry args={[0.06, 6, 6]} />
          <meshBasicMaterial color={color} transparent opacity={0.9} />
        </mesh>
      ))}
    </group>
  )
}

// Synaptic rings - orbiting energy rings
function SynapticRings({ isActive }: { isActive: boolean }) {
  const ring1Ref = useRef<THREE.Mesh>(null)
  const ring2Ref = useRef<THREE.Mesh>(null)
  const ring3Ref = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (ring1Ref.current) {
      ring1Ref.current.rotation.x = t * 0.3
      ring1Ref.current.rotation.y = t * 0.2
    }
    if (ring2Ref.current) {
      ring2Ref.current.rotation.x = t * 0.2
      ring2Ref.current.rotation.z = t * 0.3
    }
    if (ring3Ref.current) {
      ring3Ref.current.rotation.y = t * 0.4
      ring3Ref.current.rotation.z = t * 0.1
    }
  })

  return (
    <group>
      <mesh ref={ring1Ref}>
        <torusGeometry args={[3, 0.02, 8, 64]} />
        <meshStandardMaterial
          color="#00BCD4"
          emissive="#00BCD4"
          emissiveIntensity={isActive ? 2 : 1}
          transparent
          opacity={0.6}
        />
      </mesh>
      <mesh ref={ring2Ref} rotation={[Math.PI / 3, 0, 0]}>
        <torusGeometry args={[3.5, 0.02, 8, 64]} />
        <meshStandardMaterial
          color="#7C4DFF"
          emissive="#7C4DFF"
          emissiveIntensity={isActive ? 2 : 1}
          transparent
          opacity={0.5}
        />
      </mesh>
      <mesh ref={ring3Ref} rotation={[0, Math.PI / 4, Math.PI / 6]}>
        <torusGeometry args={[4, 0.015, 8, 64]} />
        <meshStandardMaterial
          color="#FF4081"
          emissive="#FF4081"
          emissiveIntensity={isActive ? 1.5 : 0.8}
          transparent
          opacity={0.4}
        />
      </mesh>
    </group>
  )
}

// Outer boundary shell
function BoundaryShell() {
  const shellRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    if (shellRef.current) {
      shellRef.current.rotation.y = state.clock.elapsedTime * 0.02
    }
  })

  return (
    <mesh ref={shellRef}>
      <icosahedronGeometry args={[7, 1]} />
      <meshStandardMaterial
        color="#1A237E"
        emissive="#0D47A1"
        emissiveIntensity={0.3}
        wireframe
        transparent
        opacity={0.1}
      />
    </mesh>
  )
}

// ============================================
// POST-PROCESSING & EFFECTS
// ============================================

function PostProcessingEffects({ isActive }: { isActive: boolean }) {
  return (
    <EffectComposer>
      <Bloom
        intensity={isActive ? 1.5 : 0.8}
        luminanceThreshold={0.2}
        luminanceSmoothing={0.9}
        mipmapBlur
      />
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(isActive ? 0.002 : 0.001, isActive ? 0.002 : 0.001)}
      />
      <Vignette
        offset={0.3}
        darkness={0.6}
        blendFunction={BlendFunction.NORMAL}
      />
      <Noise
        opacity={0.02}
        blendFunction={BlendFunction.OVERLAY}
      />
    </EffectComposer>
  )
}

// ============================================
// MAIN SCENE
// ============================================

function Scene({ vizData, isActive }: { vizData: VisualizationData; isActive: boolean }) {
  return (
    <>
      {/* Ambient lighting */}
      <ambientLight intensity={0.2} />

      {/* Key lights */}
      <pointLight position={[10, 10, 10]} intensity={0.8} color="#4FC3F7" />
      <pointLight position={[-10, -5, -10]} intensity={0.5} color="#7C4DFF" />
      <pointLight position={[0, -10, 5]} intensity={0.3} color="#FF4081" />

      {/* Spot light for dramatic effect */}
      <spotLight
        position={[0, 15, 0]}
        angle={0.3}
        penumbra={1}
        intensity={isActive ? 1.5 : 0.8}
        color="#00BCD4"
        castShadow
      />

      {/* Star field background */}
      <Stars
        radius={50}
        depth={50}
        count={2000}
        factor={4}
        saturation={0.5}
        fade
        speed={0.5}
      />

      {/* Boundary shell */}
      <BoundaryShell />

      {/* Synaptic rings */}
      <SynapticRings isActive={isActive} />

      {/* Emotional aura particles */}
      <EmotionalAura emotions={vizData.emotionalState} isActive={isActive} />

      {/* Neural connections */}
      <NeuralConnections memories={vizData.memories} isActive={isActive} />

      {/* Memory nodes */}
      {vizData.memories.map((memory, i) => (
        <MemoryNode key={memory.id} memory={memory} index={i} isActive={isActive} />
      ))}

      {/* Thought flow streams */}
      <ThoughtFlowVisualization flows={vizData.thoughtFlow} isActive={isActive} />

      {/* Central neural core */}
      <NeuralCore emotions={vizData.emotionalState} isActive={isActive} />

      {/* Post-processing effects */}
      <PostProcessingEffects isActive={isActive} />

      {/* Camera controls */}
      <OrbitControls
        enableZoom
        enablePan={false}
        enableRotate
        autoRotate
        autoRotateSpeed={isActive ? 1 : 0.3}
        minDistance={8}
        maxDistance={25}
        dampingFactor={0.05}
        enableDamping
      />
    </>
  )
}

// ============================================
// UI COMPONENTS
// ============================================

function VisualizationLegend({ emotions }: { emotions: EmotionVisualization[] }) {
  return (
    <div className="absolute bottom-4 left-4 bg-black/70 backdrop-blur-md rounded-xl p-4 text-white border border-white/10">
      <div className="font-semibold mb-3 text-sm tracking-wide">Neural Activity</div>
      <div className="space-y-2 text-xs">
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-400/50 animate-pulse" />
          <span className="text-gray-300">Active Memory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-gray-500" />
          <span className="text-gray-300">Dormant Memory</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
          <span className="text-gray-300">Input Stream</span>
        </div>
        <div className="flex items-center gap-2">
          <div className="w-3 h-3 rounded-full bg-fuchsia-400 shadow-lg shadow-fuchsia-400/50" />
          <span className="text-gray-300">Output Stream</span>
        </div>
      </div>

      {/* Emotion indicators */}
      {emotions.length > 0 && (
        <div className="mt-4 pt-3 border-t border-white/10">
          <div className="font-medium mb-2 text-xs text-gray-400">Emotional State</div>
          <div className="space-y-1">
            {emotions.slice(0, 3).map((e) => (
              <div key={e.emotion} className="flex items-center gap-2">
                <div
                  className="w-2 h-2 rounded-full"
                  style={{ backgroundColor: e.color, boxShadow: `0 0 8px ${e.color}` }}
                />
                <span className="text-gray-300 capitalize text-xs">{e.emotion}</span>
                <div className="flex-1 h-1 bg-gray-700 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{ width: `${e.intensity * 100}%`, backgroundColor: e.color }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

function AgentInfoOverlay({ agent, vizData, isActive }: { agent: AgentRecord; vizData: VisualizationData; isActive: boolean }) {
  const activeMemories = vizData.memories.filter(m => m.activated).length

  return (
    <div className="absolute top-4 left-4 bg-black/70 backdrop-blur-md rounded-xl p-4 text-white border border-white/10">
      <div className="flex items-center gap-3">
        {isActive && (
          <div className="relative">
            <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse" />
            <div className="absolute inset-0 w-3 h-3 bg-green-400 rounded-full animate-ping" />
          </div>
        )}
        <div>
          <div className="font-semibold text-lg">{agent.name}&apos;s Mind</div>
          <div className="text-xs text-gray-400">
            {isActive ? 'Processing...' : 'Idle State'}
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-3 text-xs">
        <div className="bg-white/5 rounded-lg p-2">
          <div className="text-gray-400">Memories</div>
          <div className="text-lg font-semibold text-cyan-400">{vizData.memories.length}</div>
        </div>
        <div className="bg-white/5 rounded-lg p-2">
          <div className="text-gray-400">Active</div>
          <div className="text-lg font-semibold text-green-400">{activeMemories}</div>
        </div>
      </div>
    </div>
  )
}

function ControlsHint() {
  return (
    <div className="absolute top-4 right-4 bg-black/50 backdrop-blur-sm rounded-lg px-3 py-2 text-white text-xs border border-white/10">
      <div className="flex items-center gap-3">
        <span className="text-gray-400">🖱️ Drag</span>
        <span className="text-gray-400">🔍 Scroll</span>
      </div>
    </div>
  )
}

function LoadingFallback() {
  return (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-b from-[#0a0a1a] to-[#1a1a2e]">
      <div className="text-center">
        <div className="relative w-16 h-16 mx-auto mb-4">
          <div className="absolute inset-0 rounded-full border-2 border-cyan-500/30 animate-ping" />
          <div className="absolute inset-2 rounded-full border-2 border-purple-500/50 animate-pulse" />
          <div className="absolute inset-4 rounded-full bg-gradient-to-br from-cyan-500 to-purple-500 animate-spin" />
        </div>
        <div className="text-white text-sm font-medium">Initializing Neural Network</div>
        <div className="text-gray-400 text-xs mt-1">Loading visualization...</div>
      </div>
    </div>
  )
}

// ============================================
// MAIN EXPORTED COMPONENTS
// ============================================

export function NeuralViz({
  agent,
  height = 500,
  className = '',
  isActive = false,
  showThoughtFlow = true
}: NeuralVizProps) {
  const vizData = useMemo(() => generateVizData(agent, isActive && showThoughtFlow), [agent, isActive, showThoughtFlow])

  return (
    <div className={`relative ${className}`} style={{ height }}>
      <Suspense fallback={<LoadingFallback />}>
        <Canvas
          camera={{ position: [0, 0, 15], fov: 50 }}
          gl={{
            antialias: true,
            alpha: true,
            powerPreference: 'high-performance',
            stencil: false,
            depth: true
          }}
          dpr={[1, 2]}
          style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0f0f20 100%)' }}
        >
          <Scene vizData={vizData} isActive={isActive} />
        </Canvas>
      </Suspense>

      {/* UI Overlays */}
      <AgentInfoOverlay agent={agent} vizData={vizData} isActive={isActive} />
      <VisualizationLegend emotions={vizData.emotionalState} />
      <ControlsHint />
    </div>
  )
}

// Simplified 2D visualization for performance/mobile
export function NeuralViz2D({ agent, className = '' }: { agent: AgentRecord; className?: string }) {
  const memories = agent.memoryCount || 0
  const dominantEmotion = agent.emotionalState?.dominantEmotion || 'trust'
  const emotionColor = EMOTION_COLORS[dominantEmotion]
  const secondaryEmotion = Object.entries(agent.emotionalState?.currentMood || {})
    .filter(([key]) => key !== dominantEmotion)
    .sort(([,a], [,b]) => (b as number) - (a as number))[0]?.[0] as EmotionType | undefined

  return (
    <div
      className={`relative rounded-xl overflow-hidden ${className}`}
      style={{ background: 'linear-gradient(180deg, #0a0a1a 0%, #1a1a2e 50%, #0f0f20 100%)' }}
    >
      <svg viewBox="0 0 200 200" className="w-full h-full">
        {/* Outer glow */}
        <defs>
          <radialGradient id="coreGlow" cx="50%" cy="50%" r="50%">
            <stop offset="0%" stopColor={emotionColor} stopOpacity="0.6" />
            <stop offset="100%" stopColor={emotionColor} stopOpacity="0" />
          </radialGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="2" result="coloredBlur" />
            <feMerge>
              <feMergeNode in="coloredBlur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        {/* Background rings */}
        {[85, 65, 45, 30].map((r, i) => (
          <circle
            key={i}
            cx="100"
            cy="100"
            r={r}
            fill="none"
            stroke="#4FC3F7"
            strokeOpacity={0.1 - i * 0.02}
            strokeWidth="0.5"
          />
        ))}

        {/* Animated orbital ring */}
        <circle
          cx="100"
          cy="100"
          r="70"
          fill="none"
          stroke={emotionColor}
          strokeOpacity="0.3"
          strokeWidth="1"
          strokeDasharray="10 5"
          className="animate-[spin_20s_linear_infinite]"
        />

        {/* Memory nodes */}
        {Array.from({ length: Math.min(memories, 24) }).map((_, i) => {
          const angle = (i / Math.min(memories, 24)) * Math.PI * 2
          const radius = 50 + Math.sin(i * 0.5) * 15
          const x = 100 + Math.cos(angle) * radius
          const y = 100 + Math.sin(angle) * radius
          const isActive = i % 3 === 0

          return (
            <g key={i}>
              {isActive && (
                <circle
                  cx={x}
                  cy={y}
                  r="6"
                  fill={emotionColor}
                  opacity="0.2"
                  filter="url(#glow)"
                />
              )}
              <circle
                cx={x}
                cy={y}
                r={isActive ? 4 : 2.5}
                fill={isActive ? '#4FC3F7' : '#546E7A'}
                opacity={isActive ? 1 : 0.5}
                filter={isActive ? 'url(#glow)' : undefined}
              />
            </g>
          )
        })}

        {/* Core glow */}
        <circle cx="100" cy="100" r="35" fill="url(#coreGlow)" />

        {/* Core layers */}
        <circle
          cx="100"
          cy="100"
          r="20"
          fill={emotionColor}
          opacity="0.4"
          filter="url(#glow)"
        />
        <circle
          cx="100"
          cy="100"
          r="12"
          fill={secondaryEmotion ? EMOTION_COLORS[secondaryEmotion] : emotionColor}
          opacity="0.6"
        />
        <circle
          cx="100"
          cy="100"
          r="6"
          fill="#ffffff"
          opacity="0.8"
        />
      </svg>

      {/* Info overlay */}
      <div className="absolute bottom-2 left-2 right-2 flex justify-between items-end">
        <div className="text-white">
          <div className="font-semibold text-sm">{agent.name}</div>
          <div className="text-gray-400 text-xs">{memories} memories</div>
        </div>
        <div className="flex items-center gap-1">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: emotionColor, boxShadow: `0 0 6px ${emotionColor}` }}
          />
          <span className="text-xs text-gray-300 capitalize">{dominantEmotion}</span>
        </div>
      </div>
    </div>
  )
}

export default NeuralViz
