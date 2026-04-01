'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAgentStore } from '@/stores/agentStore'
import { ArrowLeft, Brain, Plus, Save, Sparkles, Target, Wand2, X } from 'lucide-react'
import { PlaygroundLogo } from '@/components/PlaygroundLogo'
import { GradientOrb } from '@/components/ui/animated-background'
import { Input, Textarea } from '@/components/ui/input'

interface FormData {
  name: string
  persona: string
  goals: string[]
}

export default function NewAgent() {
  const router = useRouter()
  const { createAgent, loading } = useAgentStore()

  const [formData, setFormData] = useState<FormData>({
    name: '',
    persona: '',
    goals: ['']
  })

  const trimmedGoals = useMemo(
    () => formData.goals.map((goal) => goal.trim()).filter(Boolean),
    [formData.goals]
  )

  const handleAddGoal = () => {
    setFormData((prev) => ({
      ...prev,
      goals: [...prev.goals, '']
    }))
  }

  const handleRemoveGoal = (index: number) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index)
    }))
  }

  const handleGoalChange = (index: number, value: string) => {
    setFormData((prev) => ({
      ...prev,
      goals: prev.goals.map((goal, i) => (i === index ? value : goal))
    }))
  }

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault()

    if (!formData.name.trim() || !formData.persona.trim()) {
      return
    }

    try {
      await createAgent({
        name: formData.name.trim(),
        persona: formData.persona.trim(),
        goals: trimmedGoals
      })

      router.push('/dashboard')
    } catch (error) {
      console.error('Failed to create agent:', error)
    }
  }

  return (
    <div className="relative min-h-screen pb-20 pt-28">
      <GradientOrb className="-left-20 -top-10 h-[32rem] w-[32rem] opacity-20" color="violet" />
      <GradientOrb className="right-0 top-[42%] h-[28rem] w-[28rem] opacity-15" color="pink" />

      <div className="page-shell space-y-8">
        <div className="flex items-center justify-between">
          <button
            onClick={() => router.back()}
            className="inline-flex h-11 items-center gap-2 rounded-full border border-border/70 bg-card/[0.62] px-4 text-sm font-medium text-muted-foreground backdrop-blur-xl transition-all hover:border-primary/20 hover:text-foreground"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </button>
        </div>

        <div className="grid gap-8 xl:grid-cols-[0.88fr_1.12fr]">
          <motion.aside
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-6 xl:sticky xl:top-28 xl:self-start"
          >
            <section className="page-section overflow-hidden px-6 py-7 sm:px-8">
              <div className="page-kicker">
                <Wand2 className="h-4 w-4" />
                Agent builder
              </div>
              <h1 className="mt-4 text-4xl font-semibold tracking-tight text-foreground md:text-5xl">
                Shape a personality that can grow.
              </h1>
              <p className="page-intro mt-4">
                This flow turns a name, a persona definition, and a few goals into a full workspace-ready agent with memory, emotional state, psychology, and linguistic profile scaffolding.
              </p>

              <div className="mt-6 grid gap-4">
                {[
                  {
                    icon: Sparkles,
                    title: 'Emotional baseline',
                    text: 'A starting mood profile and emotional history model are prepared automatically.',
                    accent: 'purple',
                  },
                  {
                    icon: Brain,
                    title: 'Psychology and style',
                    text: 'The persona text seeds psychological traits and communication patterns.',
                    accent: 'cyan',
                  },
                  {
                    icon: Target,
                    title: 'Goal-driven direction',
                    text: 'Goals become the basis for learning, planning, and progress systems.',
                    accent: 'pink',
                  },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <div key={item.title} className="rounded-sm border border-border/70 bg-background/45 p-5 backdrop-blur-xl">
                      <div className="flex items-center gap-3">
                        <div className={`icon-container icon-container-${item.accent}`}>
                          <Icon className="h-5 w-5" />
                        </div>
                        <div>
                          <div className="font-medium text-foreground">{item.title}</div>
                          <p className="mt-1 text-sm leading-6 text-muted-foreground">{item.text}</p>
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>

            <section className="page-section px-6 py-7">
              <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Live preview</div>
              <div className="mt-4 rounded-sm border border-border/70 bg-background/45 p-6">
                <div className="flex items-center gap-3">
                  <div className="flex h-14 w-14 items-center justify-center rounded-sm bg-primary text-primary-foreground shadow-[0_18px_44px_-24px_rgba(109,77,158,0.68)]">
                    <PlaygroundLogo className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-lg font-semibold text-foreground">
                      {formData.name.trim() || 'Untitled agent'}
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {trimmedGoals.length > 0 ? `${trimmedGoals.length} focus areas defined` : 'No goals defined yet'}
                    </div>
                  </div>
                </div>

                <p className="mt-5 text-sm leading-7 text-muted-foreground">
                  {formData.persona.trim() || 'Describe the personality, communication style, expertise, and behavior so the system can generate a useful starting profile.'}
                </p>

                {trimmedGoals.length > 0 && (
                  <div className="mt-5 flex flex-wrap gap-2">
                    {trimmedGoals.map((goal) => (
                      <span key={goal} className="soft-pill">
                        {goal}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </section>
          </motion.aside>

          <motion.form
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            onSubmit={handleSubmit}
            className="space-y-6"
          >
            <section className="page-section px-6 py-7 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="icon-container icon-container-purple">
                  <Sparkles className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">Identity</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Start with a clear name and a persona description detailed enough to shape tone, behavior, and domain expertise.
                  </p>
                </div>
              </div>

              <div className="mt-6 grid gap-5">
                <div className="space-y-2">
                  <label htmlFor="name" className="text-sm font-medium text-foreground">
                    Agent name
                  </label>
                  <Input
                    id="name"
                    placeholder="Product strategist, code reviewer, research analyst..."
                    value={formData.name}
                    onChange={(event) => setFormData((prev) => ({ ...prev, name: event.target.value }))}
                    required
                  />
                </div>

                <div className="space-y-2">
                  <label htmlFor="persona" className="text-sm font-medium text-foreground">
                    Persona and behavior
                  </label>
                  <Textarea
                    id="persona"
                    placeholder="Describe communication style, expertise, boundaries, temperament, decision style, and how the agent should interact with users or other agents."
                    className="min-h-[180px]"
                    value={formData.persona}
                    onChange={(event) => setFormData((prev) => ({ ...prev, persona: event.target.value }))}
                    required
                  />
                  <p className="text-sm leading-6 text-muted-foreground">
                    Strong persona text produces better psychological, linguistic, and planning behavior later in the workspace.
                  </p>
                </div>
              </div>
            </section>

            <section className="page-section px-6 py-7 sm:px-8">
              <div className="flex items-start gap-4">
                <div className="icon-container icon-container-cyan">
                  <Target className="h-5 w-5" />
                </div>
                <div>
                  <h2 className="text-2xl font-semibold text-foreground">Goals and operating scope</h2>
                  <p className="mt-2 text-sm leading-7 text-muted-foreground">
                    Goals are used by planning, learning, memory weighting, and future simulation. Keep them concrete and behavior-oriented.
                  </p>
                </div>
              </div>

              <div className="mt-6 space-y-4">
                {formData.goals.map((goal, index) => (
                  <div key={index} className="flex items-center gap-3">
                    <span className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-border/70 bg-card/[0.62] text-sm font-semibold text-muted-foreground">
                      {index + 1}
                    </span>
                    <Input
                      placeholder={`Goal ${index + 1}`}
                      value={goal}
                      onChange={(event) => handleGoalChange(index, event.target.value)}
                    />
                    {formData.goals.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleRemoveGoal(index)}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-sm border border-border/70 bg-card/[0.62] text-muted-foreground transition-all hover:border-destructive/30 hover:text-destructive"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ))}

                <button
                  type="button"
                  onClick={handleAddGoal}
                  className="inline-flex h-12 items-center gap-2 rounded-full border border-dashed border-border/80 px-5 text-sm font-medium text-muted-foreground transition-all hover:border-primary/20 hover:text-foreground"
                >
                  <Plus className="h-4 w-4" />
                  Add another goal
                </button>
              </div>
            </section>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button
                type="submit"
                disabled={loading || !formData.name.trim() || !formData.persona.trim()}
                className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-primary px-6 text-sm font-semibold text-primary-foreground shadow-[0_20px_48px_-26px_rgba(109,77,158,0.72)] transition-all hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-60"
              >
                <Save className="h-4 w-4" />
                {loading ? 'Creating agent...' : 'Create agent'}
              </button>

              <button
                type="button"
                onClick={() => router.back()}
                className="inline-flex h-12 items-center justify-center rounded-full border border-border/70 bg-card/[0.62] px-6 text-sm font-semibold text-foreground backdrop-blur-xl transition-all hover:border-primary/20 hover:bg-card/[0.82]"
              >
                Cancel
              </button>
            </div>
          </motion.form>
        </div>
      </div>
    </div>
  )
}
