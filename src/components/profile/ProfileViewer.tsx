'use client'

import React, { useCallback, useEffect, useState } from 'react'
import { Brain, RefreshCw, Sparkles } from 'lucide-react'
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

const panelClass = 'rounded-[1.6rem] border border-border/70 bg-card/[0.62] p-5 backdrop-blur-xl'

export function ProfileViewer({ agentId, agentName }: ProfileViewerProps) {
  const [profile, setProfile] = useState<PsychologicalProfile | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [activeTab, setActiveTab] = useState<'bigfive' | 'mbti' | 'enneagram' | 'insights'>('bigfive')

  const fetchProfile = useCallback(async () => {
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
  }, [agentId])

  useEffect(() => {
    void fetchProfile()
  }, [fetchProfile])

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
    return <div className="py-8 text-center text-sm text-muted-foreground">Loading psychological profile...</div>
  }

  if (!profile) {
    return (
      <div className={`${panelClass} text-center`}>
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-[1.4rem] bg-gradient-to-br from-primary to-accent text-primary-foreground shadow-[0_18px_40px_-24px_rgba(109,77,158,0.68)]">
          <Brain className="h-8 w-8" />
        </div>
        <h3 className="mt-5 text-xl font-semibold text-foreground">No profile generated yet</h3>
        <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
          Generate a psychological profile to understand how {agentName} tends to think, communicate, react, and relate through Big Five, MBTI, and Enneagram views.
        </p>
        <button
          onClick={() => void generateProfile()}
          disabled={generating}
          className="mt-6 inline-flex h-11 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 text-sm font-semibold text-primary-foreground shadow-[0_20px_48px_-26px_rgba(109,77,158,0.72)] disabled:opacity-60"
        >
          <Sparkles className="h-4 w-4" />
          {generating ? 'Generating profile...' : 'Generate profile'}
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <h3 className="text-xl font-semibold text-foreground">Psychological profile</h3>
          <p className="mt-2 text-sm leading-7 text-muted-foreground">
            A structured view of {agentName}&apos;s temperament, cognitive preferences, communication style, and relational tendencies.
          </p>
        </div>
        <button
          onClick={() => void generateProfile()}
          disabled={generating}
          className="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-card/[0.62] px-4 text-sm font-medium text-foreground backdrop-blur-xl transition-all hover:border-primary/20 hover:bg-card/[0.82] disabled:opacity-60"
        >
          <RefreshCw className={`h-4 w-4 ${generating ? 'animate-spin' : ''}`} />
          {generating ? 'Regenerating...' : 'Regenerate'}
        </button>
      </div>

      <div className={`${panelClass} grid gap-5 lg:grid-cols-[0.9fr_1.1fr]`}>
        <div className="flex items-center gap-4">
          <div className="text-5xl">{ENNEAGRAM_TYPES[profile.enneagram.primaryType]?.icon}</div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Profile summary</div>
            <div className="mt-2 text-2xl font-semibold text-foreground">{profile.mbti.type}</div>
            <div className="mt-1 text-sm text-muted-foreground">
              {MBTI_DESCRIPTIONS[profile.mbti.type] || 'Unique personality type'}
            </div>
          </div>
        </div>

        <p className="text-sm leading-7 text-muted-foreground">{profile.summary}</p>
      </div>

      <div className="tab-nav w-fit">
        {(['bigfive', 'mbti', 'enneagram', 'insights'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={activeTab === tab ? 'tab-item tab-item-active' : 'tab-item'}
          >
            {tab === 'bigfive' ? 'Big Five' : tab.charAt(0).toUpperCase() + tab.slice(1)}
          </button>
        ))}
      </div>

      {activeTab === 'bigfive' && <BigFiveView profile={profile.bigFive} />}
      {activeTab === 'mbti' && <MBTIView profile={profile.mbti} />}
      {activeTab === 'enneagram' && <EnneagramView profile={profile.enneagram} />}
      {activeTab === 'insights' && <InsightsView profile={profile} />}
    </div>
  )
}

function BigFiveView({ profile }: { profile: BigFiveProfile }) {
  return (
    <div className="grid gap-4">
      {(Object.entries(BIG_FIVE_LABELS) as [keyof BigFiveProfile, typeof BIG_FIVE_LABELS[keyof BigFiveProfile]][]).map(([key, config]) => (
        <div key={key} className={panelClass}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-medium text-foreground">{config.label}</div>
              <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
                {config.low} to {config.high}
              </div>
            </div>
            <span className="text-sm font-semibold text-foreground">{(profile[key] * 100).toFixed(0)}%</span>
          </div>

          <div className="mt-4 h-3 rounded-full bg-muted/45">
            <div
              className="h-3 rounded-full transition-all"
              style={{
                width: `${profile[key] * 100}%`,
                backgroundColor: config.color,
              }}
            />
          </div>

          <div className="mt-2 flex justify-between text-xs text-muted-foreground">
            <span>{config.low}</span>
            <span>{config.high}</span>
          </div>
        </div>
      ))}
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
      <div className={`${panelClass} text-center`}>
        <div className="inline-flex items-center gap-1 rounded-[1.4rem] bg-background/45 px-6 py-4 text-4xl font-semibold text-foreground">
          {profile.type.split('').map((letter, index) => (
            <span
              key={index}
              className={
                index === 0
                  ? 'text-blue-500'
                  : index === 1
                    ? 'text-emerald-500'
                    : index === 2
                      ? 'text-amber-500'
                      : 'text-primary'
              }
            >
              {letter}
            </span>
          ))}
        </div>
        <p className="mt-4 text-sm leading-7 text-muted-foreground">{MBTI_DESCRIPTIONS[profile.type]}</p>
      </div>

      <div className="grid gap-4">
        {dimensions.map(({ key, left, right, leftLabel, rightLabel }) => {
          const value = profile.dimensions[key]
          const percentage = ((value + 1) / 2) * 100

          return (
            <div key={key} className={panelClass}>
              <div className="flex justify-between gap-4 text-sm font-medium">
                <span className={value < 0 ? 'text-accent' : 'text-muted-foreground'}>
                  {left} • {leftLabel}
                </span>
                <span className={value >= 0 ? 'text-accent' : 'text-muted-foreground'}>
                  {rightLabel} • {right}
                </span>
              </div>

              <div className="relative mt-4 h-3 rounded-full bg-muted/45">
                <div
                  className="h-3 rounded-full bg-accent transition-all"
                  style={{ width: `${percentage}%` }}
                />
                <div
                  className="absolute top-1/2 h-5 w-1 -translate-y-1/2 rounded-full bg-foreground"
                  style={{ left: `${percentage}%` }}
                />
              </div>

              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{(100 - percentage).toFixed(0)}%</span>
                <span>{percentage.toFixed(0)}%</span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

function EnneagramView({ profile }: { profile: EnneagramProfile }) {
  const primaryType = ENNEAGRAM_TYPES[profile.primaryType]
  const wingType = ENNEAGRAM_TYPES[profile.wing]

  return (
    <div className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
      <div className={`${panelClass} text-center`}>
        <div className="text-5xl">{primaryType?.icon}</div>
        <div className="mt-4 text-2xl font-semibold text-foreground">
          Type {profile.primaryType}: {primaryType?.name}
        </div>
        <p className="mt-3 text-sm leading-7 text-muted-foreground">{primaryType?.description}</p>
      </div>

      <div className="grid gap-4">
        <div className={panelClass}>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Wing</div>
          <div className="mt-3 flex items-center gap-3">
            <span className="text-3xl">{wingType?.icon}</span>
            <div>
              <div className="font-medium text-foreground">Type {profile.wing}: {wingType?.name}</div>
              <div className="text-sm text-muted-foreground">{wingType?.description}</div>
            </div>
          </div>
        </div>

        <div className={panelClass}>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Tritype</div>
          <div className="mt-4 flex flex-wrap justify-center gap-4">
            {profile.tritype.map((type) => (
              <div key={type} className="min-w-28 rounded-[1.25rem] bg-background/45 px-4 py-4 text-center">
                <div className="text-2xl">{ENNEAGRAM_TYPES[type]?.icon}</div>
                <div className="mt-2 font-medium text-foreground">Type {type}</div>
                <div className="text-xs text-muted-foreground">{ENNEAGRAM_TYPES[type]?.name}</div>
              </div>
            ))}
          </div>
        </div>

        <div className={panelClass}>
          <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Instinctual variant</div>
          <div className="mt-3 text-lg font-medium capitalize text-foreground">
            {profile.instinctualVariant.replace('-', ' ')}
          </div>
        </div>

        <div className={panelClass}>
          <div className="relative mx-auto h-64 w-64">
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => {
              const angle = ((num - 1) * 40 - 90) * (Math.PI / 180)
              const x = 50 + 40 * Math.cos(angle)
              const y = 50 + 40 * Math.sin(angle)
              const isActive = num === profile.primaryType
              const isWing = num === profile.wing
              const isTritype = profile.tritype.includes(num)

              return (
                <div
                  key={num}
                  className={`absolute flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold transition-all ${
                    isActive
                      ? 'scale-125 bg-accent text-white'
                      : isWing
                        ? 'bg-primary text-white'
                        : isTritype
                          ? 'bg-primary/15 text-primary'
                          : 'bg-muted/60 text-muted-foreground'
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
    </div>
  )
}

function InsightBlock({
  title,
  items,
  accent,
}: {
  title: string
  items: string[]
  accent: string
}) {
  if (items.length === 0) return null

  return (
    <div className={panelClass}>
      <div className="flex items-center gap-2">
        <span className="text-lg">{accent}</span>
        <h4 className="font-semibold text-foreground">{title}</h4>
      </div>
      <ul className="mt-4 space-y-2">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-2 text-sm leading-7 text-muted-foreground">
            <span className="mt-2 h-1.5 w-1.5 rounded-full bg-primary" />
            <span>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

function InsightsView({ profile }: { profile: PsychologicalProfile }) {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <InsightBlock title="Strengths" items={profile.strengths} accent="💪" />
      <InsightBlock title="Growth areas" items={profile.challenges} accent="🎯" />

      <div className={panelClass}>
        <div className="flex items-center gap-2">
          <span className="text-lg">🔥</span>
          <h4 className="font-semibold text-foreground">Motivations</h4>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.motivationalProfile.primaryMotivations.map((motivation) => (
            <span key={motivation} className="rounded-full bg-amber-500/15 px-3 py-1 text-xs font-medium text-amber-600 dark:text-amber-300">
              {motivation}
            </span>
          ))}
        </div>
      </div>

      <div className={panelClass}>
        <div className="flex items-center gap-2">
          <span className="text-lg">⭐</span>
          <h4 className="font-semibold text-foreground">Core values</h4>
        </div>
        <div className="mt-4 flex flex-wrap gap-2">
          {profile.motivationalProfile.coreValues.map((value) => (
            <span key={value} className="rounded-full bg-blue-500/15 px-3 py-1 text-xs font-medium text-blue-600 dark:text-blue-300">
              {value}
            </span>
          ))}
        </div>
      </div>

      <div className={panelClass}>
        <h4 className="font-semibold text-foreground">Communication style</h4>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[
            { label: 'Directness', value: profile.communicationStyle.directness, left: 'Indirect', right: 'Direct' },
            { label: 'Expression', value: profile.communicationStyle.emotionalExpression, left: 'Reserved', right: 'Expressive' },
          ].map((item) => (
            <div key={item.label}>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-muted-foreground">{item.label}</div>
              <div className="mt-3 h-2 rounded-full bg-muted/45">
                <div className="h-2 rounded-full bg-accent" style={{ width: `${item.value * 100}%` }} />
              </div>
              <div className="mt-2 flex justify-between text-xs text-muted-foreground">
                <span>{item.left}</span>
                <span>{item.right}</span>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 text-sm text-muted-foreground">
          Conflict style: <span className="font-medium capitalize text-foreground">{profile.communicationStyle.conflictStyle}</span>
        </div>
      </div>

      <div className="grid gap-4">
        <div className={panelClass}>
          <h4 className="font-semibold text-foreground">Attachment style</h4>
          <div className="mt-3 text-lg font-medium capitalize text-foreground">{profile.attachmentStyle}</div>
        </div>

        <div className={panelClass}>
          <h4 className="font-semibold text-foreground">Emotional intelligence</h4>
          <div className="mt-4 flex items-center gap-4">
            <div className="text-3xl font-semibold text-accent">{(profile.emotionalIntelligence * 100).toFixed(0)}%</div>
            <div className="h-3 flex-1 rounded-full bg-muted/45">
              <div
                className="h-3 rounded-full bg-gradient-to-r from-accent to-primary"
                style={{ width: `${profile.emotionalIntelligence * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
