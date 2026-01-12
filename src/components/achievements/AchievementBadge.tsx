'use client'

import React from 'react'
import { Achievement, AchievementRarity } from '@/types/database'
import { CATEGORY_ICONS } from '@/lib/constants/achievements'

interface AchievementBadgeProps {
  achievement: Achievement
  unlocked?: boolean
  progress?: number // 0-100 for partial progress
  showProgress?: boolean
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  className?: string
}

const RARITY_STYLES: Record<AchievementRarity, {
  bg: string
  border: string
  text: string
  glow: string
}> = {
  common: {
    bg: 'bg-gray-100 dark:bg-gray-700',
    border: 'border-gray-300 dark:border-gray-600',
    text: 'text-gray-600 dark:text-gray-300',
    glow: ''
  },
  rare: {
    bg: 'bg-blue-50 dark:bg-blue-900/30',
    border: 'border-blue-400 dark:border-blue-500',
    text: 'text-blue-600 dark:text-blue-400',
    glow: 'shadow-blue-200 dark:shadow-blue-900'
  },
  epic: {
    bg: 'bg-purple-50 dark:bg-purple-900/30',
    border: 'border-purple-400 dark:border-purple-500',
    text: 'text-purple-600 dark:text-purple-400',
    glow: 'shadow-purple-200 dark:shadow-purple-900'
  },
  legendary: {
    bg: 'bg-amber-50 dark:bg-amber-900/30',
    border: 'border-amber-400 dark:border-amber-500',
    text: 'text-amber-600 dark:text-amber-400',
    glow: 'shadow-amber-200 dark:shadow-amber-900 shadow-lg'
  }
}

const SIZE_STYLES = {
  sm: {
    container: 'w-12 h-12',
    icon: 'text-xl',
    badge: 'p-2'
  },
  md: {
    container: 'w-16 h-16',
    icon: 'text-2xl',
    badge: 'p-3'
  },
  lg: {
    container: 'w-24 h-24',
    icon: 'text-4xl',
    badge: 'p-4'
  }
}

export function AchievementBadge({
  achievement,
  unlocked = false,
  progress = 0,
  showProgress = false,
  size = 'md',
  onClick,
  className = ''
}: AchievementBadgeProps) {
  const rarityStyle = RARITY_STYLES[achievement.rarity]
  const sizeStyle = SIZE_STYLES[size]

  return (
    <div
      className={`
        relative inline-flex flex-col items-center gap-1
        ${onClick ? 'cursor-pointer hover:scale-105 transition-transform' : ''}
        ${className}
      `}
      onClick={onClick}
      title={`${achievement.name}: ${achievement.description}`}
    >
      {/* Badge container */}
      <div
        className={`
          ${sizeStyle.container} ${sizeStyle.badge}
          rounded-full border-2 flex items-center justify-center
          transition-all duration-300
          ${unlocked ? rarityStyle.bg : 'bg-gray-200 dark:bg-gray-800'}
          ${unlocked ? rarityStyle.border : 'border-gray-300 dark:border-gray-700'}
          ${unlocked ? rarityStyle.glow : ''}
          ${!unlocked ? 'opacity-50 grayscale' : ''}
        `}
      >
        <span className={sizeStyle.icon}>
          {achievement.icon}
        </span>

        {/* Progress ring for partial progress */}
        {showProgress && !unlocked && progress > 0 && (
          <svg
            className="absolute inset-0 w-full h-full -rotate-90"
            viewBox="0 0 36 36"
          >
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke="currentColor"
              strokeOpacity="0.1"
              strokeWidth="2"
            />
            <circle
              cx="18"
              cy="18"
              r="16"
              fill="none"
              stroke={rarityStyle.text.includes('blue') ? '#3B82F6' :
                     rarityStyle.text.includes('purple') ? '#8B5CF6' :
                     rarityStyle.text.includes('amber') ? '#F59E0B' : '#6B7280'}
              strokeWidth="2"
              strokeDasharray={`${progress} 100`}
              strokeLinecap="round"
            />
          </svg>
        )}
      </div>

      {/* Rarity indicator */}
      {size !== 'sm' && (
        <span
          className={`
            text-xs font-medium capitalize
            ${unlocked ? rarityStyle.text : 'text-gray-400'}
          `}
        >
          {achievement.rarity}
        </span>
      )}
    </div>
  )
}

// Achievement card with full details
export function AchievementCard({
  achievement,
  unlocked = false,
  unlockedAt,
  progress = 0,
  className = ''
}: {
  achievement: Achievement
  unlocked?: boolean
  unlockedAt?: string
  progress?: number
  className?: string
}) {
  const rarityStyle = RARITY_STYLES[achievement.rarity]

  return (
    <div
      className={`
        relative p-4 rounded-lg border-2 transition-all
        ${unlocked ? rarityStyle.bg : 'bg-gray-100 dark:bg-gray-800'}
        ${unlocked ? rarityStyle.border : 'border-gray-200 dark:border-gray-700'}
        ${!unlocked ? 'opacity-70' : ''}
        ${className}
      `}
    >
      <div className="flex items-start gap-4">
        {/* Icon */}
        <div
          className={`
            w-14 h-14 rounded-full flex items-center justify-center text-3xl
            ${unlocked ? rarityStyle.bg : 'bg-gray-200 dark:bg-gray-700'}
            border-2 ${unlocked ? rarityStyle.border : 'border-gray-300 dark:border-gray-600'}
          `}
        >
          {achievement.icon}
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h4 className={`font-semibold ${unlocked ? '' : 'text-gray-500'}`}>
              {achievement.name}
            </h4>
            <span
              className={`
                px-2 py-0.5 rounded-full text-xs font-medium capitalize
                ${rarityStyle.bg} ${rarityStyle.text}
              `}
            >
              {achievement.rarity}
            </span>
          </div>

          <p className={`text-sm ${unlocked ? 'text-gray-600 dark:text-gray-300' : 'text-gray-400'}`}>
            {achievement.description}
          </p>

          <div className="flex items-center gap-4 mt-2 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              {CATEGORY_ICONS[achievement.category]} {achievement.category}
            </span>
            <span>+{achievement.rewardXP} XP</span>
          </div>

          {/* Progress bar for locked achievements */}
          {!unlocked && progress > 0 && (
            <div className="mt-3">
              <div className="flex justify-between text-xs text-gray-500 mb-1">
                <span>Progress</span>
                <span>{progress}%</span>
              </div>
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-500 rounded-full transition-all"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          )}

          {/* Unlock date */}
          {unlocked && unlockedAt && (
            <div className="mt-2 text-xs text-gray-400">
              Unlocked {new Date(unlockedAt).toLocaleDateString()}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Level progress display
export function LevelProgress({
  level,
  xp,
  nextLevelXP,
  progressPercent,
  skillPoints,
  className = ''
}: {
  level: number
  xp: number
  nextLevelXP: number
  progressPercent: number
  skillPoints: number
  className?: string
}) {
  return (
    <div className={`space-y-3 ${className}`}>
      {/* Level badge */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-gradient-to-br from-blue-500 to-purple-600 flex items-center justify-center text-white font-bold text-xl shadow-lg">
            {level}
          </div>
          <div>
            <div className="font-semibold">Level {level}</div>
            <div className="text-sm text-gray-500">{xp.toLocaleString()} XP</div>
          </div>
        </div>

        {skillPoints > 0 && (
          <div className="px-3 py-1 bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400 rounded-full text-sm font-medium">
            {skillPoints} skill {skillPoints === 1 ? 'point' : 'points'}
          </div>
        )}
      </div>

      {/* Progress bar */}
      <div>
        <div className="flex justify-between text-xs text-gray-500 mb-1">
          <span>Progress to Level {level + 1}</span>
          <span>{progressPercent}%</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-blue-500 to-purple-600 rounded-full transition-all duration-500"
            style={{ width: `${progressPercent}%` }}
          />
        </div>
        <div className="flex justify-between text-xs text-gray-400 mt-1">
          <span>{xp} XP</span>
          <span>{nextLevelXP} XP</span>
        </div>
      </div>
    </div>
  )
}

// Achievement grid display
export function AchievementGrid({
  achievements,
  unlockedAchievements,
  columns = 4,
  className = ''
}: {
  achievements: Achievement[]
  unlockedAchievements: Record<string, { unlockedAt: string }>
  columns?: number
  className?: string
}) {
  return (
    <div
      className={`grid gap-4 ${className}`}
      style={{ gridTemplateColumns: `repeat(${columns}, 1fr)` }}
    >
      {achievements.map(achievement => {
        const unlockData = unlockedAchievements[achievement.id]
        const unlocked = !!unlockData

        return (
          <AchievementBadge
            key={achievement.id}
            achievement={achievement}
            unlocked={unlocked}
            size="md"
          />
        )
      })}
    </div>
  )
}

export default AchievementBadge
