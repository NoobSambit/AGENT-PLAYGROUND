'use client'

import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { Bot, ArrowRight, Sparkles, Users, MessageCircle, Brain, Zap, Shield, ChevronRight } from 'lucide-react'
import { Spotlight, GradientOrb } from '@/components/ui/animated-background'

const fadeInUp = {
  initial: { opacity: 0, y: 30 },
  animate: { opacity: 1, y: 0 },
}

const staggerContainer = {
  animate: {
    transition: {
      staggerChildren: 0.1,
    },
  },
}

const features = [
  {
    icon: Sparkles,
    title: 'Intelligent Agents',
    description: 'Create AI agents with unique personalities, goals, and emotional intelligence',
    gradient: 'from-violet-500 to-purple-600',
    glow: 'violet',
  },
  {
    icon: MessageCircle,
    title: 'Natural Conversations',
    description: 'Engage in fluid, context-aware dialogues powered by advanced LLMs',
    gradient: 'from-cyan-500 to-blue-600',
    glow: 'cyan',
  },
  {
    icon: Users,
    title: 'Multi-Agent Simulations',
    description: 'Watch agents collaborate, debate, and solve problems together',
    gradient: 'from-pink-500 to-rose-600',
    glow: 'pink',
  },
  {
    icon: Brain,
    title: 'Memory & Learning',
    description: 'Agents remember past conversations and evolve over time',
    gradient: 'from-amber-500 to-orange-600',
    glow: 'amber',
  },
  {
    icon: Zap,
    title: 'Real-time Responses',
    description: 'Lightning-fast streaming responses with tool integration',
    gradient: 'from-emerald-500 to-green-600',
    glow: 'emerald',
  },
  {
    icon: Shield,
    title: 'Knowledge Graphs',
    description: 'Visual representation of agent knowledge and relationships',
    gradient: 'from-indigo-500 to-blue-600',
    glow: 'indigo',
  },
]

export default function Home() {
  const router = useRouter()

  return (
    <div className="relative min-h-screen pt-28 pb-20 overflow-hidden">
      {/* Spotlight effect */}
      <Spotlight className="absolute inset-0" />

      {/* Decorative orbs */}
      <GradientOrb className="w-[800px] h-[800px] -top-[400px] -left-[200px] opacity-30" color="violet" />
      <GradientOrb className="w-[600px] h-[600px] top-1/2 -right-[300px] opacity-20" color="cyan" />

      <div className="relative z-10 mx-auto max-w-7xl px-6">
        {/* Hero Section */}
        <motion.div
          initial="initial"
          animate="animate"
          variants={staggerContainer}
          className="text-center space-y-8 mb-24"
        >
          {/* Badge */}
          <motion.div variants={fadeInUp} className="flex justify-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-violet-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-violet-500"></span>
              </span>
              <span className="text-sm font-medium text-muted-foreground">
                Powered by LangChain & Gemini AI
              </span>
            </div>
          </motion.div>

          {/* Main Heading */}
          <motion.div variants={fadeInUp} className="space-y-6">
            <h1 className="hero-title">
              <span className="block text-foreground">Build Intelligent</span>
              <span className="block gradient-text-vibrant">AI Agents</span>
            </h1>
            <p className="hero-subtitle mx-auto">
              Create, customize, and deploy AI agents with unique personalities,
              emotional intelligence, and the ability to learn and grow from every interaction.
            </p>
          </motion.div>

          {/* CTA Buttons */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center pt-4"
          >
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/dashboard')}
              className="group relative flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-lg shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 transition-all duration-300"
            >
              <span>Enter Dashboard</span>
              <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform" />
              <div className="absolute inset-0 rounded-2xl bg-gradient-to-r from-violet-400 to-purple-500 blur-xl opacity-0 group-hover:opacity-50 transition-opacity -z-10" />
            </motion.button>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/agents/new')}
              className="group flex items-center gap-3 px-8 py-4 rounded-2xl bg-white/[0.03] border border-white/[0.08] backdrop-blur-sm text-foreground font-semibold text-lg hover:bg-white/[0.06] hover:border-white/[0.12] transition-all duration-300"
            >
              <Bot className="h-5 w-5 text-violet-400" />
              <span>Create Your First Agent</span>
            </motion.button>
          </motion.div>

          {/* Stats */}
          <motion.div
            variants={fadeInUp}
            className="flex flex-wrap justify-center gap-8 pt-8"
          >
            {[
              { value: '15+', label: 'Tab Features' },
              { value: '8D', label: 'Emotion System' },
              { value: '3', label: 'Phase System' },
            ].map((stat, index) => (
              <div key={index} className="text-center">
                <div className="text-3xl font-bold gradient-text-vibrant">{stat.value}</div>
                <div className="text-sm text-muted-foreground">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </motion.div>

        {/* Feature Cards */}
        <motion.div
          initial="initial"
          whileInView="animate"
          viewport={{ once: true }}
          variants={staggerContainer}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mb-24"
        >
          {features.map((feature, index) => {
            const Icon = feature.icon
            return (
              <motion.div
                key={index}
                variants={fadeInUp}
                whileHover={{ y: -8, transition: { duration: 0.3 } }}
                className="group relative p-6 rounded-2xl premium-card cursor-pointer"
              >
                {/* Glow effect on hover */}
                <div className={`absolute inset-0 rounded-2xl bg-gradient-to-br ${feature.gradient} opacity-0 group-hover:opacity-10 transition-opacity duration-500 blur-xl`} />

                <div className="relative z-10 space-y-4">
                  <div className={`w-12 h-12 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center shadow-lg`}>
                    <Icon className="h-6 w-6 text-white" />
                  </div>
                  <h3 className="text-xl font-semibold text-foreground group-hover:text-white transition-colors">
                    {feature.title}
                  </h3>
                  <p className="text-muted-foreground leading-relaxed">
                    {feature.description}
                  </p>
                </div>

                {/* Arrow indicator */}
                <div className="absolute bottom-6 right-6 opacity-0 group-hover:opacity-100 transition-opacity">
                  <ChevronRight className="h-5 w-5 text-violet-400" />
                </div>
              </motion.div>
            )
          })}
        </motion.div>

        {/* Bottom CTA Section */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="relative overflow-hidden rounded-3xl p-8 md:p-12"
        >
          {/* Background */}
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/10 via-purple-500/5 to-pink-500/10 rounded-3xl" />
          <div className="absolute inset-[1px] bg-[#0a0a0f] rounded-3xl" />
          <div className="absolute inset-0 bg-gradient-to-br from-violet-500/5 to-transparent rounded-3xl" />

          <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left space-y-4 max-w-xl">
              <h2 className="text-3xl md:text-4xl font-bold text-foreground">
                Ready to create your first agent?
              </h2>
              <p className="text-lg text-muted-foreground">
                Join the future of AI interaction. Build agents that understand, remember, and grow.
              </p>
            </div>

            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => router.push('/agents/new')}
              className="flex items-center gap-3 px-8 py-4 rounded-2xl bg-gradient-to-r from-violet-500 to-purple-600 text-white font-semibold text-lg shadow-2xl shadow-violet-500/30 hover:shadow-violet-500/50 transition-all duration-300 whitespace-nowrap"
            >
              <Sparkles className="h-5 w-5" />
              Get Started Now
            </motion.button>
          </div>

          {/* Decorative elements */}
          <div className="absolute -top-20 -right-20 w-40 h-40 bg-violet-500/20 rounded-full blur-3xl" />
          <div className="absolute -bottom-20 -left-20 w-40 h-40 bg-pink-500/20 rounded-full blur-3xl" />
        </motion.div>

        {/* Footer */}
        <motion.div
          initial={{ opacity: 0 }}
          whileInView={{ opacity: 1 }}
          viewport={{ once: true }}
          transition={{ delay: 0.3 }}
          className="mt-24 pt-8 border-t border-white/[0.06]"
        >
          <div className="flex flex-col md:flex-row items-center justify-between gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-2">
              <Bot className="h-5 w-5 text-violet-400" />
              <span className="font-medium text-foreground">Agent Playground</span>
            </div>
            <p>
              Built with Next.js 15, React 19, LangChain & Tailwind CSS
            </p>
            <div className="flex items-center gap-4">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
                All systems operational
              </span>
            </div>
          </div>
        </motion.div>
      </div>
    </div>
  )
}
