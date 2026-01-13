'use client'

/**
 * Psychological Profile Component - Phase 2
 *
 * Displays an agent's psychological profile including Big Five,
 * MBTI, Enneagram, and other personality assessments.
 */

import React, { useState, useEffect } from 'react'
import { PsychologicalProfile, BigFiveProfile, MBTIProfile, EnneagramProfile } from '@/types/database'

interface ProfileViewerProps {
  agentId: string
  agentName: string
}

const BIG_FIVE_LABELS: Record<keyof BigFiveProfile, { label: string; low: string; high: string; color: string }> = {
  openness: { label: 'Openness', low: 'Practical', high: 'Inventive', color: '#9333EA' },
  conscientiousness: { label: 'Conscientiousness', low: 'Spontaneous', high: 'Organized', color: '#3B82F6' },
  extraversion: { label: 'Extraversion', low: 'Reserved', high: 'Outgoing', color: '#F59E0B' },
  agreeableness: { label: 'Agreeableness', low: 'Analytical', high: 'Cooperative', color: '#10B981' },
  neuroticism: { label: 'Neuroticism', low: 'Stable', high: 'Sensitive', color: '#EF4444' },
}

const MBTI_DESCRIPTIONS: Record<string, string> = {
  INTJ: 'The Architect - Strategic and independent thinker',
  INTP: 'The Logician - Innovative and curious problem-solver',
  ENTJ: 'The Commander - Bold and imaginative leader',
  ENTP: 'The Debater - Smart and curious thinker',
  INFJ: 'The Advocate - Quiet and mystical idealist',
  INFP: 'The Mediator - Poetic and kind-hearted altruist',
  ENFJ: 'The Protagonist - Charismatic and inspiring leader',
  ENFP: 'The Campaigner - Enthusiastic and creative free spirit',
  ISTJ: 'The Logistician - Practical and fact-minded individual',
  ISFJ: 'The Defender - Dedicated and warm protector',
  ESTJ: 'The Executive - Excellent administrator',
  ESFJ: 'The Consul - Extraordinarily caring and social',
  ISTP: 'The Virtuoso - Bold and practical experimenter',
  ISFP: 'The Adventurer - Flexible and charming artist',
  ESTP: 'The Entrepreneur - Smart and perceptive go-getter',
  ESFP: 'The Entertainer - Spontaneous and energetic performer',
}

const ENNEAGRAM_TYPES: Record<number, { name: string; description: string; icon: string }> = {
  1: { name: 'The Perfectionist', description: 'Principled, purposeful, self-controlled', icon: '⚖️' },
  2: { name: 'The Helper', description: 'Generous, demonstrative, people-pleasing', icon: '💝' },
  3: { name: 'The Achiever', description: 'Adaptive, excelling, driven', icon: '🏆' },
  4: { name: 'The Individualist', description: 'Expressive, dramatic, self-absorbed', icon: '🎭' },
  5: { name: 'The Investigator', description: 'Perceptive, innovative, secretive', icon: '🔍' },
  6: { name: 'The Loyalist', description: 'Engaging, responsible, anxious', icon: '🛡️' },
  7: { name: 'The Enthusiast', description: 'Spontaneous, versatile, scattered', icon: '✨' },
  8: { name: 'The Challenger', description: 'Self-confident, decisive, confrontational', icon: '💪' },
  9: { name: 'The Peacemaker', description: 'Receptive, reassuring, complacent', icon: '☮️' },
}

export function ProfileViewer({ agentId, agentName }: ProfileViewerProps) {
  const [profile, setProfile] = useState<PsychologicalProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'bigfive' | 'mbti' | 'enneagram' | 'insights'>('bigfive')

  useEffect(() => {
    fetchProfile()
  }, [agentId])

  const fetchProfile = async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/agents/${agentId}/profile`)
      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
      }
    } catch (error) {
      console.error('Failed to fetch profile:', error)
    } finally {
      setLoading(false)
    }
  }

  const generateProfile = async () => {
    try {
      setGenerating(true)
      const response = await fetch(`/api/agents/${agentId}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (response.ok) {
        const data = await response.json()
        setProfile(data.profile)
      }
    } catch (error) {
      console.error('Failed to generate profile:', error)
    } finally {
      setGenerating(false)
    }
  }

  if (loading) {
    return (
      <div className="text-center py-8 text-gray-400">
        Loading psychological profile...
      </div>
    )
  }

  if (!profile) {
    return (
      <div className="text-center py-12">
        <div className="text-6xl mb-4">🧠</div>
        <h3 className="text-xl font-semibold text-white mb-2">
          No Profile Generated Yet
        </h3>
        <p className="text-gray-400 mb-6 max-w-md mx-auto">
          Generate a psychological profile to understand {agentName}&apos;s
          personality through Big Five, MBTI, and Enneagram assessments.
        </p>
        <button
          onClick={generateProfile}
          disabled={generating}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-6 py-3 rounded-lg transition-colors disabled:opacity-50"
        >
          {generating ? 'Generating Profile...' : '🧠 Generate Profile'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Psychological Profile</h3>
          <p className="text-gray-400 text-sm">
            {agentName}&apos;s personality assessment
          </p>
        </div>
        <button
          onClick={generateProfile}
          disabled={generating}
          className="bg-cyan-600 hover:bg-cyan-700 text-white px-4 py-2 rounded-lg transition-colors disabled:opacity-50"
        >
          {generating ? 'Regenerating...' : '🔄 Regenerate'}
        </button>
      </div>

      {/* Quick Summary */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-4 mb-3">
          <div className="text-4xl">{ENNEAGRAM_TYPES[profile.enneagram.primaryType]?.icon}</div>
          <div>
            <div className="text-xl font-bold text-white">{profile.mbti.type}</div>
            <div className="text-gray-400 text-sm">
              {MBTI_DESCRIPTIONS[profile.mbti.type] || 'Unique personality type'}
            </div>
          </div>
        </div>
        <p className="text-gray-300 text-sm">{profile.summary}</p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 border-b border-gray-700">
        {(['bigfive', 'mbti', 'enneagram', 'insights'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              activeTab === tab
                ? 'text-cyan-400 border-cyan-400'
                : 'text-gray-400 border-transparent hover:text-gray-300'
            }`}
          >
            {tab === 'bigfive' ? 'Big Five' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === 'bigfive' && (
        <BigFiveView profile={profile.bigFive} />
      )}

      {activeTab === 'mbti' && (
        <MBTIView profile={profile.mbti} />
      )}

      {activeTab === 'enneagram' && (
        <EnneagramView profile={profile.enneagram} />
      )}

      {activeTab === 'insights' && (
        <InsightsView profile={profile} />
      )}
    </div>
  )
}

function BigFiveView({ profile }: { profile: BigFiveProfile }) {
  return (
    <div className="space-y-4">
      {(Object.entries(BIG_FIVE_LABELS) as [keyof BigFiveProfile, typeof BIG_FIVE_LABELS[keyof BigFiveProfile]][]).map(
        ([key, config]) => (
          <div key={key} className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <span className="font-medium text-white">{config.label}</span>
              <span className="text-gray-400">{(profile[key] * 100).toFixed(0)}%</span>
            </div>
            <div className="relative h-3 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="absolute h-full rounded-full transition-all"
                style={{
                  width: `${profile[key] * 100}%`,
                  backgroundColor: config.color,
                }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>{config.low}</span>
              <span>{config.high}</span>
            </div>
          </div>
        )
      )}
    </div>
  )
}

function MBTIView({ profile }: { profile: MBTIProfile }) {
  const dimensions = [
    { key: 'extraversion_introversion', left: 'I', right: 'E', leftLabel: 'Introverted', rightLabel: 'Extraverted' },
    { key: 'sensing_intuition', left: 'S', right: 'N', leftLabel: 'Sensing', rightLabel: 'Intuitive' },
    { key: 'thinking_feeling', left: 'T', right: 'F', leftLabel: 'Thinking', rightLabel: 'Feeling' },
    { key: 'judging_perceiving', left: 'J', right: 'P', leftLabel: 'Judging', rightLabel: 'Perceiving' },
  ] as const

  return (
    <div className="space-y-6">
      {/* Type Badge */}
      <div className="text-center">
        <div className="inline-flex items-center gap-1 text-4xl font-bold text-white bg-gray-800 px-6 py-3 rounded-lg">
          {profile.type.split('').map((letter, i) => (
            <span
              key={i}
              className={`${
                i === 0 ? 'text-blue-400' :
                i === 1 ? 'text-green-400' :
                i === 2 ? 'text-yellow-400' :
                'text-purple-400'
              }`}
            >
              {letter}
            </span>
          ))}
        </div>
        <p className="text-gray-400 mt-2">
          {MBTI_DESCRIPTIONS[profile.type]}
        </p>
      </div>

      {/* Dimensions */}
      {dimensions.map(({ key, left, right, leftLabel, rightLabel }) => {
        const value = profile.dimensions[key]
        const percentage = ((value + 1) / 2) * 100

        return (
          <div key={key} className="bg-gray-800 rounded-lg p-4">
            <div className="flex justify-between mb-2">
              <span className={`font-bold ${value < 0 ? 'text-cyan-400' : 'text-gray-500'}`}>
                {left} - {leftLabel}
              </span>
              <span className={`font-bold ${value >= 0 ? 'text-cyan-400' : 'text-gray-500'}`}>
                {rightLabel} - {right}
              </span>
            </div>
            <div className="relative h-3 bg-gray-700 rounded-full">
              <div
                className="absolute h-full bg-cyan-500 rounded-full transition-all"
                style={{ width: `${percentage}%` }}
              />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-1 h-5 bg-white rounded"
                style={{ left: `${percentage}%` }}
              />
            </div>
            <div className="flex justify-between mt-1 text-xs text-gray-500">
              <span>{(100 - percentage).toFixed(0)}%</span>
              <span>{percentage.toFixed(0)}%</span>
            </div>
          </div>
        )
      })}
    </div>
  )
}

function EnneagramView({ profile }: { profile: EnneagramProfile }) {
  const primaryType = ENNEAGRAM_TYPES[profile.primaryType]
  const wingType = ENNEAGRAM_TYPES[profile.wing]

  return (
    <div className="space-y-6">
      {/* Primary Type */}
      <div className="bg-gray-800 rounded-lg p-6 text-center">
        <div className="text-5xl mb-3">{primaryType?.icon}</div>
        <div className="text-2xl font-bold text-white">
          Type {profile.primaryType}: {primaryType?.name}
        </div>
        <p className="text-gray-400 mt-2">{primaryType?.description}</p>
      </div>

      {/* Wing */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="flex items-center gap-3">
          <span className="text-3xl">{wingType?.icon}</span>
          <div>
            <div className="text-sm text-gray-400">Wing</div>
            <div className="font-semibold text-white">
              Type {profile.wing}: {wingType?.name}
            </div>
          </div>
        </div>
      </div>

      {/* Tritype */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-2">Tritype</div>
        <div className="flex gap-4 justify-center">
          {profile.tritype.map((type, i) => (
            <div key={i} className="text-center">
              <div className="text-2xl">{ENNEAGRAM_TYPES[type]?.icon}</div>
              <div className="text-white font-semibold">Type {type}</div>
              <div className="text-xs text-gray-500">{ENNEAGRAM_TYPES[type]?.name}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Instinctual Variant */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="text-sm text-gray-400 mb-1">Instinctual Variant</div>
        <div className="font-semibold text-white capitalize">
          {profile.instinctualVariant.replace('-', ' ')}
        </div>
      </div>

      {/* Enneagram Circle */}
      <div className="bg-gray-800 rounded-lg p-4">
        <div className="relative w-64 h-64 mx-auto">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => {
            const angle = ((num - 1) * 40 - 90) * (Math.PI / 180)
            const x = 50 + 40 * Math.cos(angle)
            const y = 50 + 40 * Math.sin(angle)
            const isActive = num === profile.primaryType
            const isWing = num === profile.wing
            const isTritype = profile.tritype.includes(num)

            return (
              <div
                key={num}
                className={`absolute w-8 h-8 rounded-full flex items-center justify-center font-bold transition-all ${
                  isActive
                    ? 'bg-cyan-500 text-white scale-125'
                    : isWing
                    ? 'bg-cyan-700 text-white'
                    : isTritype
                    ? 'bg-cyan-900 text-cyan-300'
                    : 'bg-gray-700 text-gray-400'
                }`}
                style={{
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: 'translate(-50%, -50%)',
                }}
              >
                {num}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

function InsightsView({ profile }: { profile: PsychologicalProfile }) {
  return (
    <div className="space-y-6">
      {/* Strengths */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span>💪</span> Strengths
        </h4>
        <ul className="space-y-2">
          {profile.strengths.map((strength, i) => (
            <li key={i} className="text-gray-300 flex items-start gap-2">
              <span className="text-green-400">•</span>
              {strength}
            </li>
          ))}
        </ul>
      </div>

      {/* Challenges */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span>🎯</span> Growth Areas
        </h4>
        <ul className="space-y-2">
          {profile.challenges.map((challenge, i) => (
            <li key={i} className="text-gray-300 flex items-start gap-2">
              <span className="text-yellow-400">•</span>
              {challenge}
            </li>
          ))}
        </ul>
      </div>

      {/* Motivations */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span>🔥</span> Motivations
        </h4>
        <div className="flex flex-wrap gap-2">
          {profile.motivationalProfile.primaryMotivations.map((motivation, i) => (
            <span
              key={i}
              className="text-xs bg-orange-600/30 text-orange-300 px-2 py-1 rounded"
            >
              {motivation}
            </span>
          ))}
        </div>
      </div>

      {/* Core Values */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span>⭐</span> Core Values
        </h4>
        <div className="flex flex-wrap gap-2">
          {profile.motivationalProfile.coreValues.map((value, i) => (
            <span
              key={i}
              className="text-xs bg-blue-600/30 text-blue-300 px-2 py-1 rounded"
            >
              {value}
            </span>
          ))}
        </div>
      </div>

      {/* Communication Style */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-3 flex items-center gap-2">
          <span>💬</span> Communication Style
        </h4>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <div className="text-xs text-gray-400 mb-1">Directness</div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full"
                style={{ width: `${profile.communicationStyle.directness * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Indirect</span>
              <span>Direct</span>
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-400 mb-1">Expression</div>
            <div className="h-2 bg-gray-700 rounded-full overflow-hidden">
              <div
                className="h-full bg-cyan-500 rounded-full"
                style={{ width: `${profile.communicationStyle.emotionalExpression * 100}%` }}
              />
            </div>
            <div className="flex justify-between text-xs text-gray-500 mt-1">
              <span>Reserved</span>
              <span>Expressive</span>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <span className="text-xs text-gray-400">Conflict Style: </span>
          <span className="text-cyan-400 capitalize">
            {profile.communicationStyle.conflictStyle}
          </span>
        </div>
      </div>

      {/* Attachment Style */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
          <span>🔗</span> Attachment Style
        </h4>
        <div className="text-cyan-400 capitalize text-lg">
          {profile.attachmentStyle}
        </div>
      </div>

      {/* Emotional Intelligence */}
      <div className="bg-gray-800 rounded-lg p-4">
        <h4 className="font-semibold text-white mb-2 flex items-center gap-2">
          <span>❤️</span> Emotional Intelligence
        </h4>
        <div className="flex items-center gap-4">
          <div className="text-3xl font-bold text-cyan-400">
            {(profile.emotionalIntelligence * 100).toFixed(0)}%
          </div>
          <div className="flex-1 h-3 bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-cyan-600 to-cyan-400 rounded-full"
              style={{ width: `${profile.emotionalIntelligence * 100}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  )
}
