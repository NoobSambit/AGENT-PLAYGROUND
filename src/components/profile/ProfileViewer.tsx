'use client'

import { useCallback, useEffect, useState } from 'react'
import { Brain, Clock3, Languages, RefreshCw, Sparkles, TrendingUp } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { LinguisticProfileCard } from '@/components/linguistic/LinguisticProfileCard'
import {
  AgentRecord,
  BigFiveProfile,
  EnneagramProfile,
  MBTIProfile,
  PersonalityEventRecord,
  PsychologicalProfile,
} from '@/types/database'

interface ProfileViewerProps {
  agent: AgentRecord
  refreshToken?: number
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

const panelClass = 'rounded-sm border border-border/70 bg-card/[0.62] p-5 backdrop-blur-xl'

interface ProfileApiResponse {
  profile: PsychologicalProfile | null
  stale?: boolean
  lastTraitUpdateAt?: string | null
}

interface EvolutionResponse {
  coreTraits: AgentRecord['coreTraits']
  dynamicTraits: AgentRecord['dynamicTraits']
  totalInteractions: number
  lastTraitUpdateAt: string | null
  events: PersonalityEventRecord[]
}

export function ProfileViewer({ agent, refreshToken = 0 }: ProfileViewerProps) {
  const [profile, setProfile] = useState<PsychologicalProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileGenerating, setProfileGenerating] = useState(false)
  const [profileStale, setProfileStale] = useState(false)
  const [lastTraitUpdateAt, setLastTraitUpdateAt] = useState<string | null>(null)
  const [evolution, setEvolution] = useState<EvolutionResponse | null>(null)
  const [evolutionLoading, setEvolutionLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'bigfive' | 'mbti' | 'enneagram' | 'insights'>('bigfive')

  const fetchProfile = useCallback(async () => {
    try {
      setProfileLoading(true)
      const response = await fetch(`/api/agents/${agent.id}/profile`)
      if (!response.ok) {
        setProfile(null)
        setProfileStale(false)
        return
      }

      const data = await response.json() as ProfileApiResponse
      setProfile(data.profile)
      setProfileStale(Boolean(data.stale))
      setLastTraitUpdateAt(data.lastTraitUpdateAt || null)
    } catch (error) {
      console.error('Failed to fetch profile:', error)
      setProfile(null)
      setProfileStale(false)
    } finally {
      setProfileLoading(false)
    }
  }, [agent.id])

  const fetchEvolution = useCallback(async () => {
    try {
      setEvolutionLoading(true)
      const response = await fetch(`/api/agents/${agent.id}/profile/evolution`)
      if (!response.ok) {
        setEvolution(null)
        return
      }

      const data = await response.json() as EvolutionResponse
      setEvolution(data)
      setLastTraitUpdateAt(data.lastTraitUpdateAt || null)
    } catch (error) {
      console.error('Failed to fetch profile evolution:', error)
      setEvolution(null)
    } finally {
      setEvolutionLoading(false)
    }
  }, [agent.id])

  useEffect(() => {
    void Promise.all([fetchProfile(), fetchEvolution()])
  }, [fetchProfile, fetchEvolution, refreshToken])

  const generateProfile = async () => {
    try {
      setProfileGenerating(true)
      const response = await fetch(`/api/agents/${agent.id}/profile`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
      })

      if (!response.ok) {
        return
      }

      const data = await response.json() as ProfileApiResponse
      setProfile(data.profile)
      setProfileStale(Boolean(data.stale))
      setLastTraitUpdateAt(data.lastTraitUpdateAt || null)
    } catch (error) {
      console.error('Failed to generate profile:', error)
    } finally {
      setProfileGenerating(false)
    }
  }

  return (
    <div className="space-y-6">
      <section className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Personality evolution</div>
            <h3 className="mt-2 text-2xl font-semibold text-foreground">Traits and recent changes</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              Core traits stay fixed, dynamic traits shift with meaningful interactions, and recent evolution events explain why {agent.name} changed.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <span className="soft-pill">{agent.totalInteractions || 0} interactions</span>
            <span className="soft-pill">
              last trait update: {lastTraitUpdateAt ? formatDateTime(lastTraitUpdateAt) : 'not yet'}
            </span>
          </div>
        </div>

        <div className="grid gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={`${panelClass} space-y-6`}>
            <div>
              <div className="text-sm font-medium text-muted-foreground">Core Traits (Immutable)</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {Object.entries(agent.coreTraits || {}).map(([trait, score]) => (
                  <TraitBar
                    key={trait}
                    label={trait}
                    score={score}
                    colorClass="bg-primary"
                  />
                ))}
              </div>
            </div>

            <div>
              <div className="text-sm font-medium text-muted-foreground">Dynamic Traits (Evolving)</div>
              <div className="mt-4 grid gap-4 md:grid-cols-2">
                {Object.entries(agent.dynamicTraits || {}).map(([trait, score]) => (
                  <TraitBar
                    key={trait}
                    label={trait}
                    score={score}
                    colorClass="bg-accent"
                  />
                ))}
              </div>
            </div>
          </div>

          <div className={`${panelClass} space-y-4`}>
            <div className="flex items-center gap-3">
              <div className="rounded-sm bg-accent/10 p-2">
                <TrendingUp className="h-5 w-5 text-accent" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Recent evolution events</div>
                <div className="text-sm text-muted-foreground">Why the latest trait updates happened</div>
              </div>
            </div>

            {evolutionLoading ? (
              <div className="py-8 text-center text-sm text-muted-foreground">Loading evolution history...</div>
            ) : !evolution || evolution.events.length === 0 ? (
              <div className="rounded-sm border border-dashed border-border/70 px-4 py-6 text-sm leading-7 text-muted-foreground">
                No evolution events yet. Trait history will appear here after conversation turns generate meaningful personality signals.
              </div>
            ) : (
              <div className="space-y-3">
                {evolution.events.map((event) => (
                  <EvolutionEventCard key={event.id} event={event} />
                ))}
              </div>
            )}
          </div>
        </div>
      </section>

      <section className="space-y-4">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Psychological profile</div>
            <h3 className="mt-2 text-2xl font-semibold text-foreground">Derived analysis</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              A structured view of {agent.name}&apos;s temperament, communication style, motivation, and psychological tendencies.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {profileStale && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-500/30 bg-amber-500/10 px-3 py-1 text-xs font-medium text-amber-300">
                <Clock3 className="h-3.5 w-3.5" />
                Profile is older than the latest trait update
              </span>
            )}
            <Button
              onClick={() => void generateProfile()}
              disabled={profileGenerating}
              variant={profileStale ? 'default' : 'outline'}
              className="gap-2"
            >
              <RefreshCw className={`h-4 w-4 ${profileGenerating ? 'animate-spin' : ''}`} />
              {profileGenerating ? 'Regenerating...' : profile ? 'Regenerate profile' : 'Generate profile'}
            </Button>
          </div>
        </div>

        {profileLoading ? (
          <div className={`${panelClass} py-10 text-center text-sm text-muted-foreground`}>
            Loading psychological profile...
          </div>
        ) : !profile ? (
          <div className={`${panelClass} text-center`}>
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-[0_18px_40px_-24px_rgba(109,77,158,0.68)]">
              <Brain className="h-8 w-8" />
            </div>
            <h4 className="mt-5 text-xl font-semibold text-foreground">No profile generated yet</h4>
            <p className="mx-auto mt-3 max-w-xl text-sm leading-7 text-muted-foreground">
              Generate a psychological profile to understand how {agent.name} tends to think, communicate, react, and relate through Big Five, MBTI, and Enneagram views.
            </p>
            <Button
              onClick={() => void generateProfile()}
              disabled={profileGenerating}
              className="mt-6 gap-2"
            >
              <Sparkles className="h-4 w-4" />
              {profileGenerating ? 'Generating profile...' : 'Generate profile'}
            </Button>
          </div>
        ) : (
          <div className="space-y-6">
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
        )}
      </section>

      {agent.linguisticProfile && (
        <section className="space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Linguistic personality</div>
            <h3 className="mt-2 text-2xl font-semibold text-foreground">Communication fingerprint</h3>
            <p className="mt-2 max-w-3xl text-sm leading-7 text-muted-foreground">
              Tone, vocabulary bias, and expressive tendencies inferred from the base persona and current communication style.
            </p>
          </div>
          <div className={panelClass}>
            <div className="mb-5 flex items-center gap-3">
              <div className="rounded-sm bg-violet-500/10 p-2">
                <Languages className="h-5 w-5 text-violet-500" />
              </div>
              <div>
                <div className="font-semibold text-foreground">Linguistic profile</div>
                <div className="text-sm text-muted-foreground">How {agent.name} tends to sound in conversation</div>
              </div>
            </div>
            <LinguisticProfileCard profile={agent.linguisticProfile} agentName={agent.name} />
          </div>
        </section>
      )}
    </div>
  )
}

function TraitBar({
  label,
  score,
  colorClass,
}: {
  label: string
  score: number
  colorClass: string
}) {
  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm font-medium capitalize text-foreground">{label}</span>
        <span className="text-xs text-muted-foreground">{Math.round(score * 100)}%</span>
      </div>
      <div className="h-2 rounded-full bg-muted/30">
        <div
          className={`h-2 rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${score * 100}%` }}
        />
      </div>
    </div>
  )
}

function EvolutionEventCard({ event }: { event: PersonalityEventRecord }) {
  return (
    <div className="rounded-sm border border-border/70 bg-background/45 p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-medium text-foreground">{event.summary}</div>
          <div className="mt-1 text-xs uppercase tracking-[0.18em] text-muted-foreground">
            {event.source} • {formatDateTime(event.createdAt)}
          </div>
        </div>
        <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
          {event.linkedMessageIds.length} linked messages
        </span>
      </div>

      {event.traitDeltas.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex flex-wrap gap-2">
            {event.traitDeltas.map((delta) => (
              <span key={`${event.id}_${delta.trait}`} className="rounded-full bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
                {delta.trait}
                {typeof delta.delta === 'number'
                  ? ` ${delta.delta > 0 ? '+' : ''}${delta.delta.toFixed(2)}`
                  : ''}
              </span>
            ))}
          </div>
          {event.traitDeltas.some((delta) => delta.indicators?.length) && (
            <div className="text-xs leading-6 text-muted-foreground">
              Evidence:{' '}
              {event.traitDeltas
                .flatMap((delta) => (delta.indicators || []).map((indicator) => `${delta.trait}:${indicator}`))
                .join(' • ')}
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString([], {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  })
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
        <div className="inline-flex items-center gap-1 rounded-sm bg-background/45 px-6 py-4 text-4xl font-semibold text-foreground">
          {profile.type.split('').map((letter, index) => (
            <span
              key={index}
              className={
                index === 0
                  ? 'text-[var(--color-pastel-blue)]'
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
              <div key={type} className="min-w-28 rounded-sm bg-background/45 px-4 py-4 text-center">
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
            <span key={value} className="rounded-full bg-[var(--color-pastel-blue)]/20 px-3 py-1 text-xs font-medium text-[var(--color-pastel-blue)] dark:text-[var(--color-pastel-blue)]">
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
                className="h-3 rounded-full bg-primary "
                style={{ width: `${profile.emotionalIntelligence * 100}%` }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
