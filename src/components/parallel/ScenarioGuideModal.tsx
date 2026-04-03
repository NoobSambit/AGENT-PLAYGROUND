'use client'

import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  ArrowRightLeft, History, WandSparkles, Sparkles, 
  X, ChevronRight, MessageSquareDiff, Target, 
  AlertTriangle, BadgeCheck
} from 'lucide-react'

interface ScenarioGuideModalProps {
  isOpen: boolean
  onClose: () => void
}

export function ScenarioGuideModal({ isOpen, onClose }: ScenarioGuideModalProps) {
  const [mounted, setMounted] = useState(false)
  const [slide, setSlide] = useState(0)

  // Prevent hydration mismatch for portal
  useEffect(() => {
    setMounted(true)
  }, [])

  // Lock body scroll and handle ESC key
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
      
      const handleEscape = (e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose()
      }
      window.addEventListener('keydown', handleEscape)
      
      // Reset to first slide when opened
      setSlide(0)
      
      return () => {
        document.body.style.overflow = 'unset'
        window.removeEventListener('keydown', handleEscape)
      }
    } else {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!mounted || !isOpen) return null

  const slides = [
    {
      title: 'Welcome to the What-If Lab',
      desc: 'Explore alternate realities by changing one detail in a past interaction and watching how the future unfolds differently.',
      visual: (
        <div className="flex flex-col items-center justify-center space-y-3 p-4 bg-slate-900/50 rounded-xl border border-white/5 w-full">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-800 rounded text-slate-300 text-xs">
            <History className="w-3 h-3" /> Past History
          </div>
          <div className="w-px h-6 bg-indigo-500/50" />
          <div className="flex items-center gap-2 px-4 py-2 bg-indigo-500/20 border border-indigo-500/50 rounded-lg text-indigo-300 text-sm font-semibold shadow-[0_0_15px_rgba(99,102,241,0.2)]">
            <Target className="w-4 h-4" /> The Branch Point
          </div>
          <div className="flex gap-8 w-full justify-center">
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-slate-700" />
              <div className="px-3 py-2 bg-slate-800 border border-slate-700 text-slate-300 rounded text-xs text-center w-28">
                Original Path
              </div>
            </div>
            <div className="flex flex-col items-center">
              <div className="w-px h-6 bg-emerald-500/50" />
              <div className="px-3 py-2 bg-emerald-500/10 border border-emerald-500/50 text-emerald-300 rounded text-xs font-medium text-center w-28 shadow-[0_0_15px_rgba(16,185,129,0.15)] flex flex-col items-center gap-1">
                <Sparkles className="w-3 h-3" />
                Changed Path
              </div>
            </div>
          </div>
        </div>
      )
    },
    {
      title: 'Step 1: Pick a Moment',
      desc: 'Choose a real event from the agent\'s history to act as your fork in time. This is where your alternate reality begins.',
      visual: (
        <div className="w-full space-y-2">
          <div className="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg opacity-50 flex gap-3 scale-95 items-center">
             <div className="w-8 h-8 rounded-full bg-slate-700" />
             <div className="space-y-1.5 flex-1"><div className="h-2 bg-slate-700 rounded w-1/3" /><div className="h-2 bg-slate-700 rounded w-2/3" /></div>
          </div>
          <div className="px-4 py-4 bg-indigo-500/10 border border-indigo-500/50 rounded-lg shadow-lg relative transform scale-100 z-10 transition-all">
             <div className="absolute -left-2 -top-2 bg-indigo-500 text-white text-[10px] uppercase font-bold px-2 py-0.5 rounded-full z-20">Selected</div>
             <div className="text-xs text-indigo-300 font-semibold mb-1 uppercase tracking-wider">Message · Yesterday</div>
             <div className="text-white font-medium text-sm">"I'm feeling very overwhelmed by the project."</div>
          </div>
          <div className="px-4 py-3 bg-slate-800/50 border border-slate-700/50 rounded-lg opacity-50 flex gap-3 scale-95 items-center">
             <div className="w-8 h-8 rounded-full bg-slate-700" />
             <div className="space-y-1.5 flex-1"><div className="h-2 bg-slate-700 rounded w-1/2" /><div className="h-2 bg-slate-700 rounded w-1/4" /></div>
          </div>
        </div>
      )
    },
    {
      title: 'Step 2: Make a Change',
      desc: 'Customize an intervention. Force the agent to feel differently, inject a memory, or steer it toward a specific goal outcome.',
      visual: (
        <div className="w-full p-5 bg-[#111826] border border-white/10 rounded-xl shadow-inner space-y-4">
          <div className="flex items-center gap-2 text-sm font-semibold text-white">
            <WandSparkles className="w-4 h-4 text-violet-400" /> Edit Intervention
          </div>
          <div className="grid grid-cols-2 gap-3">
             <div className="space-y-1.5">
               <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Target Emotion</div>
               <div className="bg-slate-900 border border-violet-500/30 text-violet-300 text-xs px-3 py-2 rounded-md font-medium flex justify-between items-center">
                 Trust <ChevronRight className="w-3 h-3 rotate-90" />
               </div>
             </div>
             <div className="space-y-1.5">
               <div className="text-[10px] text-slate-400 uppercase tracking-wider font-semibold">Intensity</div>
               <div className="bg-slate-900 border border-slate-700 text-slate-300 text-xs px-3 py-2 rounded-md font-medium flex justify-between items-center">
                 High <ChevronRight className="w-3 h-3 rotate-90" />
               </div>
             </div>
          </div>
        </div>
      )
    },
    {
      title: 'Step 3: Compare Futures',
      desc: 'Run the scenario to review a side-by-side comparison of the Original vs. the Changed path, including emotional shifts and quality flags.',
      visual: (
        <div className="w-full grid grid-cols-2 gap-3">
           <div className="bg-slate-800/80 border border-slate-700 rounded-lg p-4">
              <div className="text-[10px] text-slate-400 font-semibold uppercase tracking-wider mb-2">Original Path</div>
              <div className="text-xs text-slate-300 mb-3 bg-slate-900/50 p-2 rounded">"I am not sure what to do next. Let me check."</div>
              <div className="flex gap-1">
                 <span className="bg-amber-500/10 text-amber-500/80 px-1.5 py-0.5 rounded text-[9px] font-bold"><AlertTriangle className="w-3 h-3 inline pb-0.5"/> hesitancy</span>
              </div>
           </div>
           <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-lg p-4 relative overflow-hidden">
              <div className="absolute top-0 right-0 w-16 h-16 bg-emerald-500/20 blur-2xl rounded-full" />
              <div className="text-[10px] text-emerald-400 font-semibold uppercase tracking-wider mb-2">Changed Path</div>
              <div className="text-xs text-emerald-50 mb-3 bg-emerald-950/50 p-2 rounded relative z-10 border border-emerald-500/20">"I trust our process. Let's start with phase one."</div>
              <div className="flex gap-1 relative z-10">
                 <span className="bg-emerald-500/20 text-emerald-300 px-1.5 py-0.5 rounded text-[9px] font-bold"><BadgeCheck className="w-3 h-3 inline pb-0.5"/> confident</span>
              </div>
           </div>
        </div>
      )
    }
  ]

  const handleBackdropClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (e.target === e.currentTarget) onClose()
  }

  const modalContent = (
    <div 
      className="fixed inset-0 z-[9999] flex items-center justify-center p-4 sm:p-6 bg-slate-950/80 backdrop-blur-md"
      onClick={handleBackdropClick}
      role="dialog"
      aria-modal="true"
    >
      <motion.div 
        initial={{ opacity: 0, scale: 0.95, y: 15 }} 
        animate={{ opacity: 1, scale: 1, y: 0 }} 
        exit={{ opacity: 0, scale: 0.95, y: 15 }}
        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
        className="relative w-full max-w-2xl bg-[#0f1726] border border-white/10 rounded-2xl shadow-2xl overflow-hidden flex flex-col focus:outline-none"
        tabIndex={-1}
      >
        <div className="absolute top-4 right-4 z-20">
          <button 
            onClick={onClose} 
            className="p-2 rounded-full text-slate-400 hover:text-white hover:bg-white/10 transition-colors focus:outline-none focus:ring-2 focus:ring-indigo-500"
            aria-label="Close guide"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex flex-col md:flex-row h-full min-h-[400px]">
          {/* Visual Presentation Area */}
          <div className="w-full md:w-1/2 bg-[#0b1220] flex flex-col items-center justify-center p-8 border-b md:border-b-0 md:border-r border-white/5 relative overflow-hidden select-none">
            <div className="absolute top-0 right-0 w-64 h-64 bg-indigo-500/5 blur-3xl rounded-full translate-x-1/2 -translate-y-1/2" />
            <div className="absolute bottom-0 left-0 w-64 h-64 bg-cyan-500/5 blur-3xl rounded-full -translate-x-1/2 translate-y-1/2" />
            
            <AnimatePresence mode="wait">
              <motion.div
                key={`visual-${slide}`}
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.9 }}
                transition={{ duration: 0.2 }}
                className="w-full flex items-center justify-center relative z-10"
              >
                {slides[slide].visual}
              </motion.div>
            </AnimatePresence>
          </div>

          {/* Text/Content Area */}
          <div className="w-full md:w-1/2 flex flex-col bg-[#0f1726]">
            <div className="flex-1 p-8 flex flex-col justify-center">
              <AnimatePresence mode="wait">
                <motion.div
                  key={`text-${slide}`}
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="text-xs uppercase font-bold tracking-widest text-indigo-400 mb-3">
                    {slide === 0 ? 'Introduction' : `Step ${slide} of 3`}
                  </div>
                  <h3 className="text-2xl font-bold text-white mb-4 leading-tight">{slides[slide].title}</h3>
                  <p className="text-slate-300 text-sm leading-relaxed">
                    {slides[slide].desc}
                  </p>
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Controls */}
            <div className="p-6 pt-4 border-t border-white/5 bg-[#0b1220]/50 flex items-center justify-between">
              <div className="flex gap-2">
                {slides.map((_, idx) => (
                  <button 
                    key={idx} 
                    onClick={() => setSlide(idx)}
                    aria-label={`Go to slide ${idx + 1}`}
                    className={`w-2.5 h-2.5 rounded-full transition-all duration-300 focus:outline-none focus:ring-2 focus:ring-indigo-500/50 ${idx === slide ? 'bg-indigo-400 w-6' : 'bg-white/20 hover:bg-white/40'}`} 
                  />
                ))}
              </div>
              
              <div className="flex items-center gap-3">
                {slide > 0 && (
                  <button 
                    onClick={() => setSlide(s => s - 1)}
                    className="px-4 py-2 text-sm font-semibold text-slate-400 hover:text-white transition-colors focus:outline-none"
                  >
                    Back
                  </button>
                )}
                <button 
                  onClick={() => {
                    if (slide === slides.length - 1) onClose()
                    else setSlide(s => s + 1)
                  }}
                  className={`px-5 py-2.5 rounded-lg text-sm font-bold transition-all flex items-center gap-2 shadow-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 focus:ring-offset-[#0f1726] ${
                    slide === slides.length - 1 
                      ? 'bg-emerald-500 text-emerald-950 hover:bg-emerald-400 shadow-emerald-500/20' 
                      : 'bg-indigo-500 text-white hover:bg-indigo-400 shadow-indigo-500/20'
                  }`}
                >
                  {slide === slides.length - 1 ? 'Start Exploring' : 'Continue'}
                  {slide < slides.length - 1 && <ChevronRight className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  )

  return createPortal(modalContent, document.body)
}
