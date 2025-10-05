'use client'

import { useRouter } from 'next/navigation'
import { Card, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Bot, ArrowRight, Sparkles, Users, MessageCircle } from 'lucide-react'

export default function Home() {
  const router = useRouter()

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-background/80 flex items-center justify-center p-6">
      <div className="mx-auto max-w-4xl text-center space-y-8">
        {/* Hero Section */}
        <div className="space-y-6">
          <div className="flex justify-center">
            <div className="p-4 rounded-full bg-primary/10">
              <Bot className="h-16 w-16 text-primary" />
            </div>
          </div>

          <div className="space-y-4">
            <h1 className="text-5xl md:text-6xl font-bold tracking-tight text-foreground">
              AI Agent Playground
            </h1>
            <p className="text-xl md:text-2xl text-muted-foreground max-w-2xl mx-auto leading-relaxed">
              Create, manage, and interact with intelligent AI agents in a professional,
              Apple-quality environment designed for seamless collaboration.
            </p>
          </div>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-12">
          <Card className="group hover:shadow-lg transition-all duration-200 border-border/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Sparkles className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Create Intelligent Agents</CardTitle>
              <CardDescription>
                Design unique AI agents with custom personalities, goals, and expertise
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-200 border-border/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <MessageCircle className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Real-time Conversations</CardTitle>
              <CardDescription>
                Chat with your agents individually or watch them collaborate in multi-agent rooms
              </CardDescription>
            </CardHeader>
          </Card>

          <Card className="group hover:shadow-lg transition-all duration-200 border-border/50">
            <CardHeader>
              <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center mb-4">
                <Users className="h-6 w-6 text-primary" />
              </div>
              <CardTitle>Multi-Agent Simulations</CardTitle>
              <CardDescription>
                Observe how multiple AI agents interact and solve problems together
              </CardDescription>
            </CardHeader>
          </Card>
        </div>

        {/* CTA Section */}
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
            <Button
              size="lg"
              onClick={() => router.push('/dashboard')}
              className="gap-2 text-lg px-8 py-6"
            >
              Enter Dashboard
              <ArrowRight className="h-5 w-5" />
            </Button>
            <Button
              variant="outline"
              size="lg"
              onClick={() => router.push('/agents/new')}
              className="gap-2 text-lg px-8 py-6"
            >
              Create Your First Agent
            </Button>
          </div>

        </div>

        {/* Footer */}
        <div className="pt-8 border-t border-border/50">
          <p className="text-muted-foreground">
            Built with Next.js 15, React 19, and Tailwind CSS • Professional dark theme design
          </p>
        </div>
      </div>
    </div>
  )
}
