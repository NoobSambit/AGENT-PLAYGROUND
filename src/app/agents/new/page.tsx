'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useAgentStore } from '@/stores/agentStore'
import { ArrowLeft, Save, Sparkles } from 'lucide-react'

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
    <div className="min-h-screen bg-gradient-to-br from-background via-background/90 to-background/50 p-6">
      <div className="mx-auto max-w-5xl space-y-10">
        {/* Header */}
        <div className="flex items-center gap-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => router.back()}
            className="gap-2 px-4 py-2 rounded-xl hover:bg-primary/10 transition-all duration-200"
          >
            <ArrowLeft className="h-4 w-4" />
            Back
          </Button>
          <div className="space-y-3">
            <h1 className="text-5xl font-bold tracking-tight text-foreground bg-gradient-to-r from-foreground via-primary/80 to-foreground bg-clip-text">
              Create New Agent
            </h1>
            <p className="text-muted-foreground text-lg leading-relaxed">
              Design your AI agent&apos;s personality and objectives
            </p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-10">
          {/* Basic Information */}
          <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-2xl">
            <CardHeader className="space-y-4">
              <CardTitle className="flex items-center gap-3 text-2xl">
                <div className="p-2 rounded-xl bg-primary/10">
                  <Sparkles className="h-6 w-6 text-primary" />
                </div>
                Basic Information
              </CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Give your agent a name and define its core personality
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-8">
              <div className="space-y-3">
                <label htmlFor="name" className="text-sm font-medium text-foreground">
                  Agent Name
                </label>
                <Input
                  id="name"
                  placeholder="e.g., Marketing Assistant, Code Reviewer"
                  value={formData.name}
                  onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                  required
                  className="h-12 px-4 text-base border-2 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all duration-200"
                />
              </div>

              <div className="space-y-3">
                <label htmlFor="persona" className="text-sm font-medium text-foreground">
                  Persona & Personality
                </label>
                <textarea
                  id="persona"
                  placeholder="Describe your agent's personality, communication style, expertise, and behavior..."
                  className="flex min-h-[140px] w-full rounded-xl border-2 border-border bg-input/50 px-4 py-3 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-primary/50 focus-visible:ring-4 focus-visible:ring-primary/10 disabled:cursor-not-allowed disabled:opacity-50 resize-none transition-all duration-200"
                  value={formData.persona}
                  onChange={(e) => setFormData(prev => ({ ...prev, persona: e.target.value }))}
                  required
                />
                <p className="text-sm text-muted-foreground leading-relaxed">
                  This will shape how your agent interacts and responds to users
                </p>
              </div>
            </CardContent>
          </Card>

          {/* Goals */}
          <Card className="backdrop-blur-sm bg-card/80 border-0 shadow-2xl">
            <CardHeader className="space-y-4">
              <CardTitle className="text-2xl">Goals & Objectives</CardTitle>
              <CardDescription className="text-base leading-relaxed">
                Define specific goals for your agent to focus on
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              {formData.goals.map((goal, index) => (
                <div key={index} className="flex gap-4 items-start">
                  <div className="flex-1">
                    <Input
                      placeholder={`Goal ${index + 1}`}
                      value={goal}
                      onChange={(e) => handleGoalChange(index, e.target.value)}
                      className="h-12 px-4 text-base border-2 focus:border-primary/50 focus:ring-4 focus:ring-primary/10 transition-all duration-200"
                    />
                  </div>
                  {formData.goals.length > 1 && (
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => handleRemoveGoal(index)}
                      className="px-4 py-2 rounded-xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/50 transition-all duration-200"
                    >
                      Remove
                    </Button>
                  )}
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddGoal}
                className="gap-2 px-4 py-2 rounded-xl hover:bg-primary/10 hover:border-primary/50 transition-all duration-200"
              >
                <span className="text-lg">+</span>
                Add Goal
              </Button>
            </CardContent>
          </Card>

          {/* Actions */}
          <div className="flex gap-6 pt-4">
            <Button
              type="submit"
              disabled={loading || !formData.name.trim() || !formData.persona.trim()}
              className="gap-3 px-8 py-4 text-base font-medium rounded-xl shadow-lg hover:shadow-xl transition-all duration-200"
            >
              <Save className="h-5 w-5" />
              {loading ? 'Creating...' : 'Create Agent'}
            </Button>
            <Button
              type="button"
              variant="outline"
              onClick={() => router.back()}
              className="px-8 py-4 text-base rounded-xl hover:bg-muted/50 transition-all duration-200"
            >
              Cancel
            </Button>
          </div>
        </form>
      </div>
    </div>
  )
}
