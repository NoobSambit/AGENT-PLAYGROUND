'use client'

import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Stars } from '@react-three/drei'
import {
  EffectComposer,
  Bloom,
  ChromaticAberration,
  Vignette,
  Noise,
  DepthOfField,
  GodRays
} from '@react-three/postprocessing'
import { BlendFunction, KernelSize } from 'postprocessing'
import * as THREE from 'three'
import { ProcessingStage } from '@/lib/services/neuralVisualizationService'

interface EffectsProps {
  isActive: boolean
  processingStage: ProcessingStage
}

// Boundary shell with subtle animation
export function BoundaryShell() {
  const shellRef = useRef<THREE.Mesh>(null)
  const innerShellRef = useRef<THREE.Mesh>(null)

  useFrame((state) => {
    const t = state.clock.elapsedTime

    if (shellRef.current) {
      shellRef.current.rotation.y = t * 0.02
      shellRef.current.rotation.x = Math.sin(t * 0.05) * 0.05
    }

    if (innerShellRef.current) {
      innerShellRef.current.rotation.y = -t * 0.03
      innerShellRef.current.rotation.z = t * 0.02
    }
  })

  return (
    <group>
      {/* Outer boundary */}
      <mesh ref={shellRef}>
        <icosahedronGeometry args={[8, 1]} />
        <meshStandardMaterial
          color="#1A237E"
          emissive="#0D47A1"
          emissiveIntensity={0.2}
          wireframe
          transparent
          opacity={0.08}
        />
      </mesh>

      {/* Inner boundary */}
      <mesh ref={innerShellRef}>
        <icosahedronGeometry args={[6.5, 2]} />
        <meshStandardMaterial
          color="#283593"
          emissive="#3949AB"
          emissiveIntensity={0.15}
          wireframe
          transparent
          opacity={0.05}
        />
      </mesh>
    </group>
  )
}

// Enhanced starfield background
export function StarField({ isActive }: { isActive: boolean }) {
  return (
    <>
      {/* Primary stars */}
      <Stars
        radius={60}
        depth={60}
        count={3000}
        factor={5}
        saturation={0.3}
        fade
        speed={isActive ? 0.8 : 0.3}
      />

      {/* Secondary layer - closer, faster */}
      <Stars
        radius={40}
        depth={30}
        count={1000}
        factor={3}
        saturation={0.5}
        fade
        speed={isActive ? 1.2 : 0.5}
      />
    </>
  )
}

// Lighting setup
export function Lighting({ isActive, processingStage }: EffectsProps) {
  const spotRef = useRef<THREE.SpotLight>(null)

  // Dynamic intensity based on state
  const baseIntensity = isActive ? 1.2 : 0.8
  const processingBoost = processingStage !== 'idle' ? 0.3 : 0

  useFrame((state) => {
    if (spotRef.current) {
      const t = state.clock.elapsedTime
      // Subtle pulsing
      spotRef.current.intensity = baseIntensity + processingBoost + Math.sin(t * 2) * 0.1
    }
  })

  return (
    <>
      {/* Ambient */}
      <ambientLight intensity={0.15} />

      {/* Key lights - colored for mood */}
      <pointLight position={[10, 10, 10]} intensity={0.7} color="#4FC3F7" />
      <pointLight position={[-10, -5, -10]} intensity={0.5} color="#7C4DFF" />
      <pointLight position={[0, -10, 5]} intensity={0.3} color="#FF4081" />
      <pointLight position={[5, 8, -8]} intensity={0.4} color="#00E5FF" />

      {/* Main spotlight */}
      <spotLight
        ref={spotRef}
        position={[0, 15, 0]}
        angle={0.4}
        penumbra={1}
        intensity={baseIntensity}
        color="#00BCD4"
        castShadow
        shadow-mapSize={[512, 512]}
      />

      {/* Fill light from below */}
      <pointLight position={[0, -8, 0]} intensity={0.2} color="#E040FB" />
    </>
  )
}

// Post-processing effects
export function PostProcessing({ isActive, processingStage }: EffectsProps) {
  // Intensity scales with activity
  const bloomIntensity = processingStage !== 'idle' ? 2.5 : isActive ? 1.8 : 1.2

  // Chromatic aberration increases during processing
  const chromaticOffset = processingStage !== 'idle' ? 0.003 : isActive ? 0.0015 : 0.0008

  // Depth of field settings
  const dofEnabled = isActive
  const focusDistance = 0.02
  const focalLength = 0.05
  const bokehScale = processingStage !== 'idle' ? 3 : 2

  return (
    <EffectComposer>
      {/* Bloom for glow effects */}
      <Bloom
        intensity={bloomIntensity}
        luminanceThreshold={0.15}
        luminanceSmoothing={0.9}
        mipmapBlur
        kernelSize={KernelSize.LARGE}
      />

      {/* Chromatic aberration for energy feel */}
      <ChromaticAberration
        blendFunction={BlendFunction.NORMAL}
        offset={new THREE.Vector2(chromaticOffset, chromaticOffset)}
        radialModulation={false}
        modulationOffset={0.5}
      />

      {/* Depth of field for focus effect */}
      {dofEnabled && (
        <DepthOfField
          focusDistance={focusDistance}
          focalLength={focalLength}
          bokehScale={bokehScale}
        />
      )}

      {/* Vignette for cinematic framing */}
      <Vignette
        offset={0.35}
        darkness={0.65}
        blendFunction={BlendFunction.NORMAL}
      />

      {/* Film grain for texture */}
      <Noise
        opacity={0.03}
        blendFunction={BlendFunction.OVERLAY}
      />
    </EffectComposer>
  )
}

export default PostProcessing
