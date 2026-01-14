'use client'

import { useEffect, useRef } from 'react'
import { motion } from 'framer-motion'

// Floating orbs that create ambient lighting effect
function FloatingOrbs() {
  return (
    <div className="fixed inset-0 overflow-hidden pointer-events-none z-0">
      {/* Primary violet orb */}
      <motion.div
        animate={{
          x: [0, 100, -50, 0],
          y: [0, -100, 50, 0],
          scale: [1, 1.2, 0.9, 1],
        }}
        transition={{
          duration: 20,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/4 left-1/4 w-[600px] h-[600px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Cyan orb */}
      <motion.div
        animate={{
          x: [0, -80, 120, 0],
          y: [0, 80, -60, 0],
          scale: [1, 0.9, 1.1, 1],
        }}
        transition={{
          duration: 25,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute top-1/2 right-1/4 w-[500px] h-[500px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(6, 182, 212, 0.12) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />

      {/* Pink orb */}
      <motion.div
        animate={{
          x: [0, 60, -80, 0],
          y: [0, -50, 100, 0],
          scale: [1, 1.1, 0.95, 1],
        }}
        transition={{
          duration: 22,
          repeat: Infinity,
          ease: 'easeInOut',
        }}
        className="absolute bottom-1/4 left-1/3 w-[400px] h-[400px] rounded-full"
        style={{
          background: 'radial-gradient(circle, rgba(236, 72, 153, 0.1) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
    </div>
  )
}

// Grid pattern overlay
function GridPattern() {
  return (
    <div className="fixed inset-0 pointer-events-none z-0">
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: `
            linear-gradient(rgba(139, 92, 246, 0.03) 1px, transparent 1px),
            linear-gradient(90deg, rgba(139, 92, 246, 0.03) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
          maskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 80% 60% at 50% 50%, black 20%, transparent 100%)',
        }}
      />
    </div>
  )
}

// Particle canvas for subtle particle effect
function ParticleField() {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    let animationFrameId: number
    const particles: Array<{
      x: number
      y: number
      vx: number
      vy: number
      size: number
      alpha: number
    }> = []

    const resize = () => {
      canvas.width = window.innerWidth
      canvas.height = window.innerHeight
    }

    const createParticles = () => {
      const particleCount = Math.min(50, Math.floor((window.innerWidth * window.innerHeight) / 20000))
      for (let i = 0; i < particleCount; i++) {
        particles.push({
          x: Math.random() * canvas.width,
          y: Math.random() * canvas.height,
          vx: (Math.random() - 0.5) * 0.3,
          vy: (Math.random() - 0.5) * 0.3,
          size: Math.random() * 2 + 0.5,
          alpha: Math.random() * 0.5 + 0.1,
        })
      }
    }

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height)

      particles.forEach((particle) => {
        particle.x += particle.vx
        particle.y += particle.vy

        // Wrap around edges
        if (particle.x < 0) particle.x = canvas.width
        if (particle.x > canvas.width) particle.x = 0
        if (particle.y < 0) particle.y = canvas.height
        if (particle.y > canvas.height) particle.y = 0

        // Draw particle
        ctx.beginPath()
        ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2)
        ctx.fillStyle = `rgba(139, 92, 246, ${particle.alpha})`
        ctx.fill()
      })

      // Draw connections between nearby particles
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach((p2) => {
          const dx = p1.x - p2.x
          const dy = p1.y - p2.y
          const distance = Math.sqrt(dx * dx + dy * dy)

          if (distance < 150) {
            ctx.beginPath()
            ctx.moveTo(p1.x, p1.y)
            ctx.lineTo(p2.x, p2.y)
            ctx.strokeStyle = `rgba(139, 92, 246, ${0.1 * (1 - distance / 150)})`
            ctx.lineWidth = 0.5
            ctx.stroke()
          }
        })
      })

      animationFrameId = requestAnimationFrame(animate)
    }

    resize()
    createParticles()
    animate()

    window.addEventListener('resize', resize)

    return () => {
      window.removeEventListener('resize', resize)
      cancelAnimationFrame(animationFrameId)
    }
  }, [])

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-0"
      style={{ opacity: 0.6 }}
    />
  )
}

// Noise texture overlay
function NoiseOverlay() {
  return (
    <div
      className="fixed inset-0 pointer-events-none z-[100]"
      style={{
        opacity: 0.02,
        backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'repeat',
      }}
    />
  )
}

// Main animated background component
export function AnimatedBackground({ variant = 'default' }: { variant?: 'default' | 'minimal' | 'intense' }) {
  return (
    <>
      {/* Base gradient */}
      <div
        className="fixed inset-0 z-[-2]"
        style={{
          background: 'linear-gradient(180deg, #0a0a0f 0%, #0d0d14 50%, #0a0a0f 100%)',
        }}
      />

      {/* Floating orbs */}
      {variant !== 'minimal' && <FloatingOrbs />}

      {/* Grid pattern */}
      <GridPattern />

      {/* Particle field */}
      {variant === 'intense' && <ParticleField />}

      {/* Noise overlay */}
      <NoiseOverlay />

      {/* Vignette effect */}
      <div
        className="fixed inset-0 pointer-events-none z-[50]"
        style={{
          background: 'radial-gradient(ellipse at center, transparent 0%, rgba(0, 0, 0, 0.3) 100%)',
        }}
      />
    </>
  )
}

// Spotlight effect for hero sections
export function Spotlight({ className }: { className?: string }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 1 }}
      className={`pointer-events-none ${className}`}
    >
      <div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(ellipse 50% 80% at 50% 20%, rgba(139, 92, 246, 0.15) 0%, transparent 60%)',
        }}
      />
    </motion.div>
  )
}

// Gradient orb for decorative purposes
export function GradientOrb({ className, color = 'violet' }: { className?: string; color?: 'violet' | 'cyan' | 'pink' }) {
  const colors = {
    violet: 'rgba(139, 92, 246, 0.4)',
    cyan: 'rgba(6, 182, 212, 0.4)',
    pink: 'rgba(236, 72, 153, 0.4)',
  }

  return (
    <div
      className={`absolute rounded-full blur-3xl ${className}`}
      style={{
        background: `radial-gradient(circle, ${colors[color]} 0%, transparent 70%)`,
      }}
    />
  )
}
