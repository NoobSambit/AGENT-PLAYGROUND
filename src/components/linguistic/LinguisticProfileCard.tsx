'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  MessageSquare,
  Sparkles,
  BookOpen,
  Smile,
  Zap,
  PenTool,
  ChevronDown,
  ChevronUp,
  Quote,
  Hash,
  Type
} from 'lucide-react'
import { LinguisticProfile } from '@/types/database'

interface LinguisticProfileCardProps {
  profile: LinguisticProfile
  agentName: string
  className?: string
  onUpdate?: (profile: LinguisticProfile) => void
  editable?: boolean
}

// Dimension configuration
const DIMENSIONS = [
  {
    key: 'formality',
    label: 'Formality',
    icon: BookOpen,
    low: 'Casual',
    high: 'Formal',
    lowDescription: 'Relaxed, conversational tone',
    highDescription: 'Professional, structured language',
    color: '#4FC3F7'
  },
  {
    key: 'verbosity',
    label: 'Verbosity',
    icon: MessageSquare,
    low: 'Concise',
    high: 'Elaborate',
    lowDescription: 'Direct and to the point',
    highDescription: 'Detailed and expansive',
    color: '#7C4DFF'
  },
  {
    key: 'humor',
    label: 'Humor',
    icon: Smile,
    low: 'Serious',
    high: 'Playful',
    lowDescription: 'Straightforward and earnest',
    highDescription: 'Witty and lighthearted',
    color: '#FFD54F'
  },
  {
    key: 'technicalLevel',
    label: 'Technical Level',
    icon: Zap,
    low: 'Simple',
    high: 'Technical',
    lowDescription: 'Accessible vocabulary',
    highDescription: 'Specialized terminology',
    color: '#66BB6A'
  },
  {
    key: 'expressiveness',
    label: 'Expressiveness',
    icon: Sparkles,
    low: 'Plain',
    high: 'Metaphorical',
    lowDescription: 'Literal and straightforward',
    highDescription: 'Figurative and vivid',
    color: '#FF7043'
  }
] as const

// Dimension slider component
function DimensionSlider({
  dimension,
  value,
  onChange,
  editable
}: {
  dimension: typeof DIMENSIONS[number]
  value: number
  onChange?: (value: number) => void
  editable: boolean
}) {
  const Icon = dimension.icon
  const percentage = Math.round(value * 100)
  const isLow = value < 0.35
  const isHigh = value > 0.65

  return (
    <div className="group">
      <div className="flex items-center justify-between mb-2">
        <div className="flex items-center gap-2">
          <div
            className="p-1.5 rounded-lg"
            style={{ backgroundColor: `${dimension.color}20` }}
          >
            <Icon className="w-4 h-4" style={{ color: dimension.color }} />
          </div>
          <span className="text-sm font-medium text-white">{dimension.label}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`transition-colors ${isLow ? 'text-white' : 'text-gray-500'}`}>
            {dimension.low}
          </span>
          <span className="text-gray-600">/</span>
          <span className={`transition-colors ${isHigh ? 'text-white' : 'text-gray-500'}`}>
            {dimension.high}
          </span>
        </div>
      </div>

      <div className="relative">
        {/* Track background */}
        <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
          {/* Filled portion */}
          <motion.div
            className="h-full rounded-full"
            style={{ backgroundColor: dimension.color }}
            initial={{ width: 0 }}
            animate={{ width: `${percentage}%` }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
          />
        </div>

        {/* Interactive slider (editable mode) */}
        {editable && onChange && (
          <input
            type="range"
            min="0"
            max="100"
            value={percentage}
            onChange={(e) => onChange(parseInt(e.target.value) / 100)}
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
          />
        )}

        {/* Value indicator */}
        <motion.div
          className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white shadow-lg border-2"
          style={{ borderColor: dimension.color }}
          initial={{ left: 0 }}
          animate={{ left: `calc(${percentage}% - 8px)` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        />
      </div>

      {/* Description */}
      <div className="mt-1 text-xs text-gray-500">
        {isLow ? dimension.lowDescription : isHigh ? dimension.highDescription : 'Balanced approach'}
      </div>
    </div>
  )
}

// Signature expressions display
function SignatureExpressions({ expressions }: { expressions: string[] }) {
  if (expressions.length === 0) return null

  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <Quote className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-white">Signature Expressions</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {expressions.map((expression, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.05 }}
            className="px-3 py-1.5 bg-purple-500/10 border border-purple-500/30 rounded-full text-xs text-purple-300"
          >
            &ldquo;{expression}&rdquo;
          </motion.div>
        ))}
      </div>
    </div>
  )
}

// Preferred words display
function PreferredWords({ words }: { words: string[] }) {
  if (words.length === 0) return null

  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <Hash className="w-4 h-4 text-cyan-400" />
        <span className="text-sm font-medium text-white">Preferred Vocabulary</span>
        <span className="text-xs text-gray-500">({words.length} words)</span>
      </div>
      <div className="flex flex-wrap gap-1.5">
        {words.slice(0, 20).map((word, i) => (
          <motion.span
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.02 }}
            className="px-2 py-1 bg-cyan-500/10 text-cyan-300 rounded text-xs"
          >
            {word}
          </motion.span>
        ))}
        {words.length > 20 && (
          <span className="px-2 py-1 text-gray-500 text-xs">
            +{words.length - 20} more
          </span>
        )}
      </div>
    </div>
  )
}

// Punctuation style display
function PunctuationStyle({ style }: { style: LinguisticProfile['punctuationStyle'] }) {
  return (
    <div className="mt-4 pt-4 border-t border-gray-800">
      <div className="flex items-center gap-2 mb-3">
        <Type className="w-4 h-4 text-amber-400" />
        <span className="text-sm font-medium text-white">Writing Style</span>
      </div>
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl mb-1">!</div>
          <div className="text-xs text-gray-400">Exclamations</div>
          <div className="text-sm font-medium text-white mt-1">
            {style.exclamationFrequency > 0.6 ? 'Frequent' : style.exclamationFrequency > 0.3 ? 'Moderate' : 'Rare'}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl mb-1">...</div>
          <div className="text-xs text-gray-400">Ellipsis</div>
          <div className="text-sm font-medium text-white mt-1">
            {style.ellipsisUsage ? 'Uses' : 'Avoids'}
          </div>
        </div>
        <div className="bg-gray-800/50 rounded-lg p-3 text-center">
          <div className="text-2xl mb-1">😊</div>
          <div className="text-xs text-gray-400">Emoji</div>
          <div className="text-sm font-medium text-white mt-1">
            {style.emojiUsage ? 'Uses' : 'Avoids'}
          </div>
        </div>
      </div>
    </div>
  )
}

// Style summary generator
function generateStyleSummary(profile: LinguisticProfile, agentName: string): string {
  const traits: string[] = []

  if (profile.formality > 0.7) traits.push('formal and professional')
  else if (profile.formality < 0.3) traits.push('casual and conversational')

  if (profile.verbosity > 0.7) traits.push('detailed and elaborate')
  else if (profile.verbosity < 0.3) traits.push('concise and direct')

  if (profile.humor > 0.7) traits.push('witty and playful')
  else if (profile.humor < 0.3) traits.push('serious and earnest')

  if (profile.technicalLevel > 0.7) traits.push('technically sophisticated')
  else if (profile.technicalLevel < 0.3) traits.push('accessible and simple')

  if (profile.expressiveness > 0.7) traits.push('metaphorical and vivid')
  else if (profile.expressiveness < 0.3) traits.push('literal and straightforward')

  if (traits.length === 0) {
    return `${agentName} has a balanced communication style, adapting naturally to different contexts.`
  }

  return `${agentName} communicates in a ${traits.slice(0, -1).join(', ')}${traits.length > 1 ? ' and ' + traits[traits.length - 1] : traits[0]} manner.`
}

// Sample dialogue generator
function generateSampleDialogue(profile: LinguisticProfile): string {
  const responses: string[] = []

  // Base response variations
  if (profile.formality > 0.7) {
    responses.push("I appreciate your inquiry and would be pleased to elaborate on this matter.")
  } else if (profile.formality < 0.3) {
    responses.push("Oh hey, that's a great question!")
  } else {
    responses.push("That's an interesting point to consider.")
  }

  if (profile.verbosity > 0.7) {
    responses.push("Allow me to provide a comprehensive explanation that covers all the relevant aspects and nuances of this topic.")
  } else if (profile.verbosity < 0.3) {
    responses.push("Simply put: yes.")
  }

  if (profile.humor > 0.7) {
    responses.push("Well, as they say, the best things in life are free... except for good advice, which I'm generously providing! 😄")
  }

  if (profile.expressiveness > 0.7) {
    responses.push("It's like watching a sunrise over a calm ocean - gradually illuminating everything with new understanding.")
  }

  // Pick the most characteristic response
  return responses[0] || "I'd be happy to help you with that."
}

// Main component
export function LinguisticProfileCard({
  profile,
  agentName,
  className = '',
  onUpdate,
  editable = false
}: LinguisticProfileCardProps) {
  const [expanded, setExpanded] = useState(false)
  const [localProfile, setLocalProfile] = useState(profile)

  const handleDimensionChange = (key: string, value: number) => {
    const updated = { ...localProfile, [key]: value }
    setLocalProfile(updated)
    onUpdate?.(updated)
  }

  const styleSummary = generateStyleSummary(localProfile, agentName)
  const sampleDialogue = generateSampleDialogue(localProfile)

  return (
    <motion.div
      className={`bg-gradient-to-br from-gray-900 to-gray-950 rounded-2xl border border-gray-800 overflow-hidden ${className}`}
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
    >
      {/* Header */}
      <div className="p-5 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-gradient-to-br from-purple-500/20 to-cyan-500/20 rounded-xl">
              <PenTool className="w-5 h-5 text-purple-400" />
            </div>
            <div>
              <h3 className="font-semibold text-white">Linguistic Profile</h3>
              <p className="text-xs text-gray-400">{agentName}&apos;s communication style</p>
            </div>
          </div>
          <button
            onClick={() => setExpanded(!expanded)}
            className="p-2 hover:bg-gray-800 rounded-lg transition-colors"
          >
            {expanded ? (
              <ChevronUp className="w-5 h-5 text-gray-400" />
            ) : (
              <ChevronDown className="w-5 h-5 text-gray-400" />
            )}
          </button>
        </div>

        {/* Style summary */}
        <p className="mt-3 text-sm text-gray-300 leading-relaxed">{styleSummary}</p>
      </div>

      {/* Dimension sliders */}
      <div className="p-5 space-y-5">
        {DIMENSIONS.map((dimension) => (
          <DimensionSlider
            key={dimension.key}
            dimension={dimension}
            value={localProfile[dimension.key as keyof typeof localProfile] as number}
            onChange={editable ? (value) => handleDimensionChange(dimension.key, value) : undefined}
            editable={editable}
          />
        ))}
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5">
              {/* Sample dialogue */}
              <div className="bg-gray-800/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <MessageSquare className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs font-medium text-gray-400">Sample Response Style</span>
                </div>
                <p className="text-sm text-gray-300 italic">&ldquo;{sampleDialogue}&rdquo;</p>
              </div>

              {/* Signature expressions */}
              <SignatureExpressions expressions={localProfile.signatureExpressions || []} />

              {/* Preferred words */}
              <PreferredWords words={localProfile.preferredWords || []} />

              {/* Punctuation style */}
              {localProfile.punctuationStyle && (
                <PunctuationStyle style={localProfile.punctuationStyle} />
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quick stats footer */}
      <div className="px-5 py-3 bg-gray-800/30 border-t border-gray-800">
        <div className="flex items-center justify-between text-xs">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <Quote className="w-3 h-3 text-gray-500" />
              <span className="text-gray-400">
                {(localProfile.signatureExpressions || []).length} expressions
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Hash className="w-3 h-3 text-gray-500" />
              <span className="text-gray-400">
                {(localProfile.preferredWords || []).length} words
              </span>
            </div>
          </div>
          {!expanded && (
            <button
              onClick={() => setExpanded(true)}
              className="text-cyan-400 hover:text-cyan-300 transition-colors"
            >
              Show more
            </button>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// Compact version for sidebars
export function LinguisticProfileMini({ profile, className = '' }: { profile: LinguisticProfile; className?: string }) {
  return (
    <div className={`bg-gray-800/50 rounded-xl p-4 ${className}`}>
      <div className="flex items-center gap-2 mb-3">
        <PenTool className="w-4 h-4 text-purple-400" />
        <span className="text-sm font-medium text-white">Speech Style</span>
      </div>

      <div className="space-y-2">
        {DIMENSIONS.slice(0, 3).map((dim) => {
          const value = profile[dim.key as keyof typeof profile] as number
          return (
            <div key={dim.key} className="flex items-center gap-2">
              <span className="text-xs text-gray-500 w-16">{dim.label}</span>
              <div className="flex-1 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{ width: `${value * 100}%`, backgroundColor: dim.color }}
                />
              </div>
            </div>
          )
        })}
      </div>

      {(profile.signatureExpressions?.length || 0) > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-700">
          <p className="text-xs text-gray-400 italic truncate">
            &ldquo;{profile.signatureExpressions?.[0]}&rdquo;
          </p>
        </div>
      )}
    </div>
  )
}

export default LinguisticProfileCard
