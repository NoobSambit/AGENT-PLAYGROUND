'use client'

import React, { useEffect, useState } from 'react'
import { Achievement, AchievementRarity } from '@/types/database'
import { motion, AnimatePresence } from 'framer-motion'

interface AchievementNotificationProps {
  achievement: Achievement | null
  onClose?: () => void
  autoCloseDelay?: number
}

const RARITY_GRADIENTS: Record<AchievementRarity, string> = {
  common: 'from-gray-400 to-gray-600',
  rare: 'from-blue-400 to-blue-600',
  epic: 'from-purple-400 to-purple-600',
  legendary: 'from-amber-400 via-yellow-500 to-amber-600'
}

const RARITY_GLOWS: Record<AchievementRarity, string> = {
  common: 'shadow-gray-500/50',
  rare: 'shadow-blue-500/50',
  epic: 'shadow-purple-500/50',
  legendary: 'shadow-amber-500/50'
}

export function AchievementNotification({
  achievement,
  onClose,
  autoCloseDelay = 5000
}: AchievementNotificationProps) {
  const [isVisible, setIsVisible] = useState(false)

  useEffect(() => {
    if (achievement) {
      setIsVisible(true)

      if (autoCloseDelay > 0) {
        const timer = setTimeout(() => {
          setIsVisible(false)
          setTimeout(() => onClose?.(), 300)
        }, autoCloseDelay)

        return () => clearTimeout(timer)
      }
    }
  }, [achievement, autoCloseDelay, onClose])

  if (!achievement) return null

  const gradient = RARITY_GRADIENTS[achievement.rarity]
  const glow = RARITY_GLOWS[achievement.rarity]

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: -50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -20, scale: 0.95 }}
          transition={{ type: 'spring', damping: 20, stiffness: 300 }}
          className="fixed top-4 left-1/2 -translate-x-1/2 z-50"
        >
          <div
            className={`
              relative overflow-hidden rounded-2xl p-1
              bg-gradient-to-r ${gradient}
              shadow-xl ${glow}
            `}
          >
            {/* Shimmer effect for legendary */}
            {achievement.rarity === 'legendary' && (
              <motion.div
                className="absolute inset-0 bg-gradient-to-r from-transparent via-white/30 to-transparent"
                animate={{ x: ['-100%', '100%'] }}
                transition={{ repeat: Infinity, duration: 2, ease: 'linear' }}
              />
            )}

            {/* Content */}
            <div className="relative bg-gray-900 rounded-xl p-4 flex items-center gap-4">
              {/* Animated icon */}
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', damping: 10 }}
                className={`
                  w-16 h-16 rounded-full flex items-center justify-center text-4xl
                  bg-gradient-to-br ${gradient}
                `}
              >
                {achievement.icon}
              </motion.div>

              {/* Text content */}
              <div className="text-white">
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.3 }}
                  className="text-sm font-medium text-gray-300 uppercase tracking-wide"
                >
                  Achievement Unlocked!
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.4 }}
                  className="text-xl font-bold"
                >
                  {achievement.name}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.5 }}
                  className="text-sm text-gray-400 mt-1"
                >
                  {achievement.description}
                </motion.div>
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: 0.6 }}
                  className="flex items-center gap-3 mt-2"
                >
                  <span className={`px-2 py-0.5 rounded-full text-xs capitalize bg-gradient-to-r ${gradient}`}>
                    {achievement.rarity}
                  </span>
                  <span className="text-xs text-green-400">
                    +{achievement.rewardXP} XP
                  </span>
                </motion.div>
              </div>

              {/* Close button */}
              <button
                onClick={() => {
                  setIsVisible(false)
                  setTimeout(() => onClose?.(), 300)
                }}
                className="absolute top-2 right-2 w-6 h-6 rounded-full bg-gray-800 hover:bg-gray-700 flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <span className="text-sm">x</span>
              </button>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// Level up notification
export function LevelUpNotification({
  newLevel,
  skillPointsEarned = 1,
  onClose,
  autoCloseDelay = 5000
}: {
  newLevel: number
  skillPointsEarned?: number
  onClose?: () => void
  autoCloseDelay?: number
}) {
  const [isVisible, setIsVisible] = useState(true)

  useEffect(() => {
    if (autoCloseDelay > 0) {
      const timer = setTimeout(() => {
        setIsVisible(false)
        setTimeout(() => onClose?.(), 300)
      }, autoCloseDelay)

      return () => clearTimeout(timer)
    }
  }, [autoCloseDelay, onClose])

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, scale: 0.5 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.9 }}
          transition={{ type: 'spring', damping: 15, stiffness: 200 }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
          onClick={() => {
            setIsVisible(false)
            setTimeout(() => onClose?.(), 300)
          }}
        >
          <motion.div
            initial={{ y: 50 }}
            animate={{ y: 0 }}
            className="relative p-8 rounded-3xl bg-gradient-to-br from-blue-600 via-purple-600 to-pink-600 shadow-2xl"
            onClick={e => e.stopPropagation()}
          >
            {/* Particle effects */}
            {[...Array(12)].map((_, i) => (
              <motion.div
                key={i}
                initial={{
                  opacity: 0,
                  x: 0,
                  y: 0,
                  scale: 0
                }}
                animate={{
                  opacity: [0, 1, 0],
                  x: (Math.random() - 0.5) * 200,
                  y: (Math.random() - 0.5) * 200,
                  scale: [0, 1, 0]
                }}
                transition={{
                  duration: 1.5,
                  delay: i * 0.1,
                  repeat: Infinity,
                  repeatDelay: 1
                }}
                className="absolute left-1/2 top-1/2 w-4 h-4 rounded-full bg-white/50"
              />
            ))}

            <div className="relative text-center text-white">
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 0.2, type: 'spring', damping: 10 }}
                className="text-8xl mb-4"
              >
                {newLevel}
              </motion.div>

              <motion.h2
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="text-3xl font-bold mb-2"
              >
                Level Up!
              </motion.h2>

              <motion.p
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.6 }}
                className="text-lg text-white/80"
              >
                You&apos;ve reached Level {newLevel}
              </motion.p>

              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.8 }}
                className="mt-4 inline-flex items-center gap-2 px-4 py-2 bg-white/20 rounded-full"
              >
                <span>+{skillPointsEarned} Skill {skillPointsEarned === 1 ? 'Point' : 'Points'}</span>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}

// XP gain indicator (small floating +XP)
export function XPGainIndicator({
  amount,
  position = { x: 0, y: 0 }
}: {
  amount: number
  position?: { x: number; y: number }
}) {
  return (
    <motion.div
      initial={{ opacity: 1, y: 0 }}
      animate={{ opacity: 0, y: -50 }}
      transition={{ duration: 1.5, ease: 'easeOut' }}
      className="fixed pointer-events-none z-50 text-green-500 font-bold text-lg"
      style={{ left: position.x, top: position.y }}
    >
      +{amount} XP
    </motion.div>
  )
}

// Hook for managing achievement notifications
export function useAchievementNotifications() {
  const [queue, setQueue] = useState<Achievement[]>([])
  const [current, setCurrent] = useState<Achievement | null>(null)

  useEffect(() => {
    if (!current && queue.length > 0) {
      setCurrent(queue[0])
      setQueue(prev => prev.slice(1))
    }
  }, [current, queue])

  const notify = (achievement: Achievement) => {
    setQueue(prev => [...prev, achievement])
  }

  const notifyMultiple = (achievements: Achievement[]) => {
    setQueue(prev => [...prev, ...achievements])
  }

  const handleClose = () => {
    setCurrent(null)
  }

  return {
    current,
    handleClose,
    notify,
    notifyMultiple,
    queueLength: queue.length
  }
}

export default AchievementNotification
