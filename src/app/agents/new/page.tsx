'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { useAgentStore } from '@/stores/agentStore'
import { ArrowLeft, Save, Sparkles, Target, Plus, X, Bot } from 'lucide-react'
import { GradientOrb } from '@/components/ui/animated-background'

interface FormData {
  name: string
  persona: string
  goals: string[]
}

const fadeInUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0 },
}

export default function NewAgent() {
  const router = useRouter()
  const { createAgent, loading } = useAgentStore()

  const [formData, setFormData] = useState<FormData>({
    name: '',
    persona: '',
    goals: ['']
  })

  const handleAddGoal = () => {
    setFormData(prev => ({
      ...prev,
      goals: [...prev.goals, '']
    }))
  }

  const handleRemoveGoal = (index: number) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.filter((_, i) => i !== index)
    }))
  }

  const handleGoalChange = (index: number, value: string) => {
    setFormData(prev => ({
      ...prev,
      goals: prev.goals.map((goal, i) => i === index ? value : goal)
    }))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!formData.name.trim() || !formData.persona.trim()) return

    const filteredGoals = formData.goals.filter(goal => goal.trim() !== '')

    try {
      await createAgent({
        name: formData.name.trim(),
        persona: formData.persona.trim(),
        goals: filteredGoals
      })

      router.push('/dashboard')
    } catch (error) {
      console.error('Failed to create agent:', error)
    }
  }

  return (
    <div className="relative min-h-screen pt-28 pb-20">
      {/* Decorative orbs */}
      <GradientOrb className="w-[600px] h-[600px] -top-[200px] -left-[200px] opacity-20" color="violet" />
      <GradientOrb className="w-[400px] h-[400px] bottom-0 right-1/4 opacity-15" color="pink" />

      <div className="relative z-10 mx-auto max-w-4xl px-6 space-y-10">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center gap-6"
        >
          <motion.button
            whileHover={{ x: -4 }}
            whileTap={{ scale: 0.95 }}
            onClick={() => router.back()}
            className="flex items-center gap-2 px-4 py-2 rounded-xl text-muted-foreground hover:text-foreground hover:bg-white/[0.05] transition-all"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </motion.button>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="space-y-4"
        >
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0, 5, -5, 0] }}
              transition={{ duration: 4, repeat: Infinity }}
              className="w-16 h-16 rounded-2xl bg-gradient-to-br from-violet-500 to-purple-600 flex items-center justify-center shadow-2xl shadow-violet-500/30"
            >
              <Bot className="h-8 w-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl md:text-5xl font-bold tracking-tight">
                <span className="text-foreground">Create New </span>
                <span className="gradient-text-vibrant">Agent</span>
              </h1>
              <p className="text-lg text-muted-foreground mt-2">
                Design your AI agent&apos;s personality and objectives
              </p>
            </div>
          </div>
        </motion.div>

        <form onSubmit={handleSubmit} className="space-y-8">
          {/* Basic Information */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.2 }}
            className="p-8 rounded-2xl premium-card"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="icon-container icon-container-purple">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Basic Information</h2>
                <p className="text-sm text-muted-foreground">Give your agent a name and define its core personality</p>
              </div>
            </div>

            <div className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="name" className="text-sm font-medium text-foreground">
                  Agent Name
                </label>
                <input
                  id="name"
                  placeholder="e.g., Marketing Assistant, Code Reviewer"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="w-full h-12 px-4 rounded-xl bg-white/[0.02] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all"
                />
              </div>

              <div className="space-y-2">
                <label htmlFor="persona" className="text-sm font-medium text-foreground">
                  Persona & Personality
                </label>
                <textarea
                  id="persona"
                  placeholder="Describe your agent's personality, communication style, expertise, and behavior..."
                  className="w-full min-h-[140px] px-4 py-3 rounded-xl bg-white/[0.02] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all resize-none"
                  value={formData.persona}
                  onChange={(e) => setFormData(prev => ({ ...prev, persona: e.target.value }))}
                  required
                />
                <p className="text-sm text-muted-foreground">
                  This will shape how your agent interacts and responds to users
                </p>
              </div>
            </div>
          </motion.div>

          {/* Goals */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.3 }}
            className="p-8 rounded-2xl premium-card"
          >
            <div className="flex items-center gap-3 mb-8">
              <div className="icon-container icon-container-cyan">
                <Target className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-foreground">Goals & Objectives</h2>
                <p className="text-sm text-muted-foreground">Define specific goals for your agent to focus on</p>
              </div>
            </div>

            <div className="space-y-4">
              {formData.goals.map((goal, index) => (
                <motion.div
                  key={index}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className="flex gap-3 items-center"
                >
                  <span className="w-8 h-8 rounded-lg bg-white/[0.05] flex items-center justify-center text-sm font-medium text-muted-foreground">
                    {index + 1}
                  </span>
                  <input
                    placeholder={`Enter goal ${index + 1}...`}
                    value={goal}
                    onChange={(e) => handleGoalChange(index, e.target.value)}
                    className="flex-1 h-12 px-4 rounded-xl bg-white/[0.02] border border-white/[0.08] text-foreground placeholder:text-muted-foreground/60 focus:outline-none focus:border-violet-500/50 focus:ring-4 focus:ring-violet-500/10 transition-all"
                  />
                  {formData.goals.length > 1 && (
                    <motion.button
                      type="button"
                      whileHover={{ scale: 1.1 }}
                      whileTap={{ scale: 0.9 }}
                      onClick={() => handleRemoveGoal(index)}
                      className="p-2 rounded-lg hover:bg-red-500/10 text-muted-foreground hover:text-red-400 transition-colors"
                    >
                      <X className="h-5 w-5" />
                    </motion.button>
                  )}
                </motion.div>
              ))}

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={handleAddGoal}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-white/[0.1] text-muted-foreground hover:text-foreground hover:border-violet-500/30 hover:bg-violet-500/5 transition-all"
              >
                <Plus className="h-4 w-4" />
                Add Goal
              </motion.button>
            </div>
          </motion.div>

          {/* Actions */}
          <motion.div
            variants={fadeInUp}
            initial="initial"
            animate="animate"
            transition={{ delay: 0.4 }}
            className="flex gap-4 pt-4"
          >
            <motion.button
              type="submit"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              disabled={loading || !formData.name.trim() || !formData.persona.trim()}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              <Save className="h-5 w-5" />
              {loading ? 'Creating...' : 'Create Agent'}
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.back()}
              className="px-8 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] text-foreground font-semibold hover:bg-white/[0.06] hover:border-white/[0.12] transition-all"
            >
              Cancel
            </motion.button>
          </motion.div>
        </form>
      </div>
    </div>
  )
}
