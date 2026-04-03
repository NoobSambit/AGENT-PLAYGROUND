'use client'

import { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRightLeft, Brain, Clock3, History, Loader2, MessageSquareDiff, Sparkles, Target, AlertTriangle, BadgeCheck, WandSparkles, BookOpen, X, ChevronRight, CheckCircle2, Info } from 'lucide-react'
import type {
  ScenarioBranchPoint,
  ScenarioAnalyticsSummary,
  ScenarioIntervention,
  ScenarioRunRecord,
} from '@/types/database'
import { ScenarioGuideModal } from './ScenarioGuideModal'

interface ParallelRealityExplorerProps {
  agentName: string
  branchPoints: ScenarioBranchPoint[]
  templates: ScenarioIntervention[]
  recentRuns: ScenarioRunRecord[]
  analytics: ScenarioAnalyticsSummary | null
  selectedBranchPointId: string
  selectedIntervention: ScenarioIntervention | null
  activeRun: ScenarioRunRecord | null
  isRunning: boolean
  onSelectBranchPoint: (branchPoint: ScenarioBranchPoint) => void
  onSelectTemplate: (intervention: ScenarioIntervention) => void
  onUpdateIntervention: (intervention: ScenarioIntervention) => void
  onOpenRun: (run: ScenarioRunRecord) => void
  onRun: () => void
}

function formatBranchPoint(point: ScenarioBranchPoint): string {
  const label = point.kind === 'message'
    ? 'Message'
    : point.kind === 'memory'
      ? 'Memory'
      : point.kind === 'relationship_event'
        ? 'Relationship'
        : 'Simulation'
  return `${label} · ${new Date(point.timestamp).toLocaleString()}`
}

function InterventionEditor({
  intervention,
  onChange,
}: {
  intervention: ScenarioIntervention
  onChange: (intervention: ScenarioIntervention) => void
}) {
  return (
    <div className="space-y-3 rounded-lg border border-white/5 bg-white/[0.02] p-4">
      <div className="flex items-center justify-between border-b border-white/5 pb-3">
        <div className="text-sm font-semibold text-white flex items-center gap-2">
          <Target className="w-4 h-4 text-cyan-400" />
          {intervention.label}
        </div>
        <p className="text-xs text-slate-400 max-w-[200px] truncate" title={intervention.description}>{intervention.description}</p>
      </div>

      {intervention.type === 'rewrite_reply' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            <span>Response style</span>
            <select
              value={intervention.responseStyle || 'warmer'}
              onChange={(event) => onChange({ ...intervention, responseStyle: event.target.value as ScenarioIntervention['responseStyle'] })}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-white outline-none focus:border-cyan-500/50 transition-all font-normal text-sm"
            >
              <option value="warmer">Warmer</option>
              <option value="more direct">More direct</option>
              <option value="more skeptical">More skeptical</option>
              <option value="more collaborative">More collaborative</option>
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            <span>Why change it?</span>
            <input
              value={intervention.rationale || ''}
              onChange={(event) => onChange({ ...intervention, rationale: event.target.value })}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-white outline-none focus:border-cyan-500/50 transition-all font-normal text-sm"
              placeholder="e.g. reduce tension"
            />
          </label>
        </div>
      )}

      {intervention.type === 'emotion_shift' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            <span>Target emotion</span>
            <select
              value={intervention.targetEmotion || 'trust'}
              onChange={(event) => onChange({ ...intervention, targetEmotion: event.target.value as ScenarioIntervention['targetEmotion'] })}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-white outline-none focus:border-cyan-500/50 transition-all font-normal text-sm capitalize"
            >
              {['joy', 'sadness', 'anger', 'fear', 'surprise', 'trust', 'anticipation', 'disgust'].map((emotion) => (
                <option key={emotion} value={emotion}>{emotion}</option>
              ))}
            </select>
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            <span>Shift strength</span>
            <select
              value={intervention.emotionIntensity || 'medium'}
              onChange={(event) => onChange({ ...intervention, emotionIntensity: event.target.value as ScenarioIntervention['emotionIntensity'] })}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-white outline-none focus:border-cyan-500/50 transition-all font-normal text-sm"
            >
              <option value="low">Subtle (Low)</option>
              <option value="medium">Noticeable (Medium)</option>
              <option value="high">Drastic (High)</option>
            </select>
          </label>
        </div>
      )}

      {intervention.type === 'memory_injection' && (
        <label className="space-y-1.5 block text-xs font-semibold text-slate-300">
          <span>Injected memory details</span>
          <textarea
            value={intervention.memoryText || ''}
            onChange={(event) => onChange({ ...intervention, memoryText: event.target.value })}
            className="min-h-24 w-full rounded-md border border-white/10 bg-black/20 px-3 py-2 text-white outline-none focus:border-cyan-500/50 transition-all resize-none font-normal text-sm"
            placeholder="Recall that fact..."
          />
        </label>
      )}

      {intervention.type === 'goal_outcome' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            <span>Which Goal?</span>
            <input
              value={intervention.goal || ''}
              onChange={(event) => onChange({ ...intervention, goal: event.target.value })}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-white outline-none focus:border-cyan-500/50 transition-all font-normal text-sm"
              placeholder="e.g. Finish the launch guide"
            />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            <span>Forced outcome</span>
            <select
              value={intervention.forcedOutcome || 'succeeds'}
              onChange={(event) => onChange({ ...intervention, forcedOutcome: event.target.value as ScenarioIntervention['forcedOutcome'] })}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-white outline-none focus:border-cyan-500/50 transition-all font-normal text-sm"
            >
              <option value="succeeds">Force Success</option>
              <option value="fails">Force Failure</option>
            </select>
          </label>
        </div>
      )}

      {intervention.type === 'relationship_shift' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            <span>Counterpart Name</span>
            <input
              value={intervention.counterpartName || ''}
              onChange={(event) => onChange({ ...intervention, counterpartName: event.target.value })}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-white outline-none focus:border-cyan-500/50 transition-all font-normal text-sm"
              placeholder="Name"
            />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            <span>Trust shift</span>
            <input
              type="number"
              step="0.01"
              value={intervention.trustDelta ?? 0}
              onChange={(event) => onChange({ ...intervention, trustDelta: Number(event.target.value) })}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-white outline-none focus:border-cyan-500/50 transition-all font-normal text-sm"
            />
          </label>
          <label className="space-y-1.5 text-xs font-semibold text-slate-300">
            <span>Respect shift</span>
            <input
              type="number"
              step="0.01"
              value={intervention.respectDelta ?? 0}
              onChange={(event) => onChange({ ...intervention, respectDelta: Number(event.target.value) })}
              className="w-full rounded-md border border-white/10 bg-black/20 px-3 py-1.5 text-white outline-none focus:border-cyan-500/50 transition-all font-normal text-sm"
            />
          </label>
        </div>
      )}
    </div>
  )
}

function RunSummary({ run }: { run: ScenarioRunRecord }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'context'>('overview')

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="mt-6 overflow-hidden rounded-xl border border-emerald-500/20 bg-slate-900/40 shadow-xl backdrop-blur-md"
    >
      <div className="bg-gradient-to-r from-emerald-500/10 via-emerald-500/5 to-transparent p-4 md:p-5 border-b border-emerald-500/10">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-1.5 text-xs font-bold tracking-widest text-emerald-400 mb-1.5 uppercase">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Scenario Completed
            </div>
            <h3 className="text-xl font-bold text-white mb-0.5">{run.intervention.label}</h3>
            <p className="text-slate-400 text-xs">
              Branch: {run.branchPoint.title} <span className="mx-1">•</span> First change at: <span className="text-emerald-300 font-medium">{run.comparison.firstDivergence}</span>
            </p>
          </div>
          <div className="flex items-center gap-4 bg-black/20 p-2.5 rounded-lg border border-white/5">
            <div className="text-right">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Alt. Quality</div>
              <div className="text-xl font-black text-white leading-none mt-1">{run.comparison.outcomeScore.alternate}</div>
            </div>
            <div className="w-px h-8 bg-white/10" />
            <div className="text-left">
              <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Orig. Quality</div>
              <div className="text-xl font-black text-slate-400 leading-none mt-1">{run.comparison.outcomeScore.baseline}</div>
            </div>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-1 bg-black/20 p-1 rounded-md inline-flex border border-white/5">
          {[
            { id: 'overview', label: 'Analysis' },
            { id: 'comparison', label: 'Diff' },
            { id: 'context', label: 'Context' }
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`px-3 py-1.5 text-xs font-semibold rounded transition-all ${
                activeTab === tab.id
                  ? 'bg-emerald-500/20 text-emerald-300 shadow-sm'
                  : 'text-slate-400 hover:bg-white/5 hover:text-white'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5 md:p-6">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8"
            >
              {/* Primary Insight / Takeaway */}
              <div className="flex flex-col md:flex-row gap-6 lg:gap-10">
                <div className="md:w-3/5">
                  <h4 className="text-sm font-bold text-emerald-400 mb-3 flex items-center gap-2">
                     <BadgeCheck className="w-4 h-4"/> Primary Insight
                  </h4>
                  <p className="text-xl md:text-2xl text-white font-medium leading-snug">
                     {run.comparison.recommendation}
                  </p>
                  
                  {run.comparison.qualityNotes.length > 0 && (
                     <div className="mt-5 flex flex-wrap gap-2">
                        {run.comparison.qualityNotes.map((note, idx) => (
                           <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-emerald-500/10 text-emerald-300 text-xs font-semibold border border-emerald-500/20">
                              <CheckCircle2 className="w-3 h-3" /> {note}
                           </span>
                        ))}
                     </div>
                  )}
                  {run.comparison.riskNotes.length > 0 && (
                     <div className="mt-3 flex flex-wrap gap-2">
                        {run.comparison.riskNotes.map((note, idx) => (
                           <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-amber-500/10 text-amber-300 text-xs font-semibold border border-amber-500/20">
                              <AlertTriangle className="w-3 h-3" /> {note}
                           </span>
                        ))}
                     </div>
                  )}
                </div>
                
                {/* Secondary: What actually changed summary list */}
                <div className="md:w-2/5 border-l-0 md:border-l border-white/5 md:pl-6 lg:pl-10">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-4">Key Divergences</h4>
                  <ul className="space-y-3">
                     {run.comparison.keyDifferences.map((difference, idx) => (
                        <li key={idx} className="flex gap-3 text-sm text-slate-300">
                           <Sparkles className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
                           <span className="leading-relaxed">{difference}</span>
                        </li>
                     ))}
                  </ul>
                </div>
              </div>
              
              <hr className="border-white/5" />
              
              {/* Path Comparison */}
              <div className="grid sm:grid-cols-2 gap-6 relative">
                 <div className="space-y-2">
                    <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Original Context (Baseline)</div>
                    <p className="text-sm text-slate-400 leading-relaxed max-w-sm">{run.comparison.baselineSummary}</p>
                 </div>
                 <div className="space-y-2 relative">
                    <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider flex items-center gap-2">
                      Alternate Path Result <span className="flex h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.5)]"></span>
                    </div>
                    <p className="text-sm text-emerald-100 leading-relaxed max-w-sm relative z-10">{run.comparison.alternateSummary}</p>
                 </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'comparison' && (
            <motion.div
              key="comparison"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-8 pl-2"
            >
              {run.turns.map((turn, tIdx) => (
                <div key={turn.id} className="relative pl-6 md:pl-8 border-l border-white/10 pb-2">
                 <div className="absolute top-0 left-0 -translate-x-[5px] w-2.5 h-2.5 rounded-full bg-emerald-500/40 border-2 border-[#090e17]"></div>
                 
                 <div className="mb-4">
                    <span className="text-[10px] uppercase font-bold text-slate-500 tracking-wider">Turn {tIdx + 1}: {turn.probeLabel}</span>
                    <h5 className="text-sm font-bold text-white mt-1">{turn.probePrompt}</h5>
                 </div>
                 
                 <div className="grid lg:grid-cols-2 gap-4 lg:gap-8">
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-bold text-slate-500 tracking-wider border-b border-white/5 pb-2 mb-2">Original Response</div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-slate-400">{turn.baselineResponse}</p>
                      <div className="text-[10px] font-semibold text-slate-500 pt-1">
                         Emotion: <span className="capitalize">{turn.baselineEmotion.dominantEmotion || 'dormant'}</span>
                      </div>
                    </div>
                    <div className="space-y-2">
                      <div className="text-[10px] uppercase font-bold text-emerald-400 tracking-wider border-b border-emerald-500/10 pb-2 mb-2">Changed Response</div>
                      <p className="whitespace-pre-wrap text-sm leading-relaxed text-emerald-50">{turn.alternateResponse}</p>
                      <div className="text-[10px] font-semibold text-emerald-500/70 pt-1">
                        Emotion: <span className="capitalize">{turn.alternateEmotion.dominantEmotion || 'dormant'}</span>
                      </div>
                    </div>
                 </div>
                 
                 {turn.divergenceNotes.length > 0 && (
                    <div className="mt-5 inline-flex items-start gap-2 bg-emerald-500/5 px-4 py-2.5 rounded border border-emerald-500/10 text-xs text-emerald-200/80">
                       <MessageSquareDiff className="w-4 h-4 text-emerald-400/50 shrink-0 mt-px" />
                       <span>{turn.divergenceNotes.join(' ')}</span>
                    </div>
                 )}
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'context' && (
            <motion.div
              key="context"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="grid gap-10 lg:grid-cols-2"
            >
               <div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-5 uppercase tracking-wider">
                  <Clock3 className="h-4 w-4 text-emerald-400" />
                  Moment Context
                </div>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Event Title</dt>
                    <dd className="text-sm font-bold text-white">{run.branchPoint.title}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Summary</dt>
                    <dd className="text-sm text-slate-400 leading-relaxed max-w-sm">{run.branchPoint.summary}</dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Timestamp</dt>
                    <dd className="text-xs text-slate-500 font-medium">{formatBranchPoint(run.branchPoint)}</dd>
                  </div>
                </dl>
              </div>

               <div>
                <div className="flex items-center gap-2 text-sm font-bold text-slate-300 mb-5 uppercase tracking-wider">
                  <Brain className="h-4 w-4 text-emerald-400" />
                  Applied Configuration
                </div>
                <dl className="space-y-4">
                  <div>
                    <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1">Action</dt>
                    <dd className="text-sm font-bold text-white mb-0.5">{run.intervention.label}</dd>
                    <dd className="text-xs text-slate-400 leading-relaxed">{run.intervention.description}</dd>
                  </div>
                  {run.alternateState.injectedContext.length > 0 && (
                    <div>
                      <dt className="text-[10px] uppercase font-bold text-slate-500 tracking-wider mb-1.5">Injected Data</dt>
                      <dd>
                        <ul className="space-y-1">
                          {run.alternateState.injectedContext.map((entry, index) => (
                            <li key={index} className="flex gap-2 text-sm text-slate-300 leading-relaxed">
                               <span className="text-emerald-500/50 mt-1">•</span>{entry}
                            </li>
                          ))}
                        </ul>
                      </dd>
                    </div>
                  )}
                </dl>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export function ParallelRealityExplorer({
  agentName,
  branchPoints,
  templates,
  recentRuns,
  analytics,
  selectedBranchPointId,
  selectedIntervention,
  activeRun,
  isRunning,
  onSelectBranchPoint,
  onSelectTemplate,
  onUpdateIntervention,
  onOpenRun,
  onRun,
}: ParallelRealityExplorerProps) {
  
  const [guideOpen, setGuideOpen] = useState(false)
  const [viewMode, setViewMode] = useState<'new' | 'history'>('new')
  const resultsRef = useRef<HTMLDivElement>(null)
  
  const selectedPointObject = branchPoints.find(p => `${p.kind}:${p.id}` === selectedBranchPointId)

  useEffect(() => {
    if (activeRun && viewMode === 'new' && !isRunning) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [activeRun, isRunning, viewMode])

  return (
    <div className="w-full pb-12">
      <ScenarioGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Compact Header & Tabs block */}
      <div className="mb-6 pb-6 border-b border-white/5 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-1.5 px-2 py-1 rounded bg-indigo-500/10 text-indigo-400 text-[10px] font-bold tracking-widest uppercase mb-2">
            <Sparkles className="w-3 h-3" /> The What-If Lab
          </div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl text-white font-bold tracking-tight">Explore alternate realities</h1>
            <button 
              onClick={() => setGuideOpen(true)}
              className="flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-full bg-white/5 border border-white/10 hover:bg-white/10 text-slate-300 font-medium transition-all"
            >
              <BookOpen className="w-3 h-3 text-indigo-400" /> Guide
            </button>
          </div>
          <p className="text-sm text-slate-400">
            Go back to a real moment in <strong>{agentName}'s</strong> history and change a single detail.
          </p>
        </div>

        <div className="flex bg-black/40 p-1 rounded-lg border border-white/5 backdrop-blur-sm self-start md:self-auto">
          <button 
            onClick={() => {
              setViewMode('new'); 
              if (activeRun) window.scrollTo({ top: 0, behavior: 'smooth' });
            }}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all ${
              viewMode === 'new' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            New Experiment
          </button>
          <button 
            onClick={() => setViewMode('history')}
            className={`px-4 py-1.5 rounded-md text-xs font-semibold transition-all flex items-center gap-1.5 ${
              viewMode === 'history' ? 'bg-indigo-500/20 text-indigo-300 shadow-sm' : 'text-slate-400 hover:text-white hover:bg-white/5'
            }`}
          >
            <History className="w-3.5 h-3.5" /> Past Results ({analytics?.totalRuns || 0})
          </button>
        </div>
      </div>

      {viewMode === 'new' && (
        <AnimatePresence mode="wait">
          <motion.div 
            key="new-experiment"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
          >
            <div className="grid lg:grid-cols-12 gap-8 items-start">
              {/* Left Column: Flow Step 1 */}
              <div className="lg:col-span-5 flex flex-col h-[650px]">
                <div className="flex items-center gap-3 mb-4 flex-shrink-0">
                  <div className="flex flex-shrink-0 items-center justify-center w-6 h-6 rounded bg-indigo-500/20 text-indigo-400 font-bold text-xs ring-1 ring-indigo-500/30">1</div>
                  <h2 className="text-sm font-bold text-white">Pick a moment</h2>
                </div>
                
                <div className="max-h-[350px] overflow-y-auto pr-2 space-y-2 custom-scrollbar flex-shrink-0">
                  {branchPoints.map((point) => {
                    const isSelected = `${point.kind}:${point.id}` === selectedBranchPointId
                    return (
                      <button
                        key={`${point.kind}:${point.id}`}
                        onClick={() => onSelectBranchPoint(point)}
                        className={`w-full text-left p-2.5 md:p-3 rounded-lg border transition-all duration-200 outline-none group hover:shadow-sm ${
                          isSelected
                            ? 'border-indigo-500/50 bg-indigo-500/10 shadow-sm ring-1 ring-indigo-500/30 ring-offset-0'
                            : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                        }`}
                      >
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center justify-between">
                            <div className="text-[10px] font-bold text-indigo-300 uppercase tracking-wider">{formatBranchPoint(point).split('·')[0].trim()}</div>
                            {isSelected && <span className="text-[9px] font-bold uppercase tracking-wider bg-indigo-500/20 text-indigo-300 px-1.5 py-0.5 rounded">Selected</span>}
                          </div>
                          
                          <div className="text-sm font-semibold text-white leading-tight line-clamp-1">
                            {point.title}
                          </div>
                          
                          <div className="text-xs text-slate-400 line-clamp-1 leading-relaxed">
                            {point.summary}
                          </div>
                        </div>
                      </button>
                    )
                  })}
                  {branchPoints.length === 0 && (
                    <div className="p-6 text-center border border-dashed border-white/10 rounded-lg bg-white/[0.02] text-xs text-slate-400">
                      No moments available to branch from.
                    </div>
                  )}
                </div>

                {/* Selected Preview Panel */}
                <div className={`flex-1 mt-6 rounded-xl border flex flex-col overflow-hidden transition-all duration-300 ${
                   selectedPointObject 
                     ? 'border-indigo-500/20 bg-[#090e16] shadow-inner' 
                     : 'border-white/5 bg-[#090e16]/50'
                }`}>
                  <div className={`px-4 py-2 border-b flex items-center justify-between ${
                    selectedPointObject ? 'border-indigo-500/10 bg-indigo-500/5' : 'border-white/5 bg-black/20'
                  }`}>
                    <span className={`text-[10px] font-bold uppercase tracking-wider flex items-center gap-1.5 ${
                      selectedPointObject ? 'text-indigo-400' : 'text-slate-500'
                    }`}>
                      <Info className="w-3.5 h-3.5" />
                      Moment Preview
                    </span>
                    {selectedPointObject && (
                       <span className="text-[10px] text-indigo-500/70">{formatBranchPoint(selectedPointObject).split('·')[1]?.trim()}</span>
                    )}
                  </div>
                  
                  <div className="flex-1 overflow-y-auto p-4 custom-scrollbar relative">
                     {selectedPointObject ? (
                        <div className="space-y-4 pb-2">
                           <div>
                              <div className="text-xs font-medium text-slate-400 mb-1">Title</div>
                              <div className="text-sm font-bold text-white">{selectedPointObject.title}</div>
                           </div>
                           <div>
                              <div className="text-xs font-medium text-slate-400 mb-1.5">Context Content</div>
                              <div className="text-sm leading-relaxed text-slate-300 whitespace-pre-wrap">
                                 {selectedPointObject.fullContent || selectedPointObject.summary}
                              </div>
                           </div>
                        </div>
                     ) : (
                        <div className="absolute inset-0 flex flex-col items-center justify-center text-center p-6 text-slate-500">
                           <Info className="w-6 h-6 mb-2 opacity-50" />
                           <div className="text-xs leading-relaxed">Select a moment from the list to read its full un-truncated context here.</div>
                        </div>
                     )}
                  </div>
                </div>
              </div>

              {/* Right Column: Flow Steps 2 & 3 */}
              <div className="lg:col-span-7 space-y-8">
                <section className={`transition-opacity duration-300 space-y-4 ${!selectedBranchPointId ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
                  <div className="flex items-center gap-3 mb-2">
                    <div className={`flex flex-shrink-0 items-center justify-center w-6 h-6 rounded font-bold text-xs transition-colors ${selectedBranchPointId ? 'bg-indigo-500/20 text-indigo-400 ring-1 ring-indigo-500/30' : 'bg-white/5 text-slate-500'}`}>2</div>
                    <h2 className="text-sm font-bold text-white">What to change?</h2>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-2">
                    {templates.map((template) => {
                      const isSelected = selectedIntervention?.label === template.label
                      return (
                        <button
                          key={template.label}
                          onClick={() => onSelectTemplate(template)}
                          className={`text-left p-3 rounded-lg border transition-all duration-200 outline-none ${
                            isSelected
                              ? 'border-indigo-500/50 bg-indigo-500/10 ring-1 ring-indigo-500/30'
                              : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                          }`}
                        >
                          <div className="text-xs font-bold text-white mb-0.5">{template.label}</div>
                          <div className="text-[10px] text-slate-400 leading-relaxed line-clamp-2">{template.description}</div>
                        </button>
                      )
                    })}
                  </div>

                  {selectedIntervention && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                      <InterventionEditor intervention={selectedIntervention} onChange={onUpdateIntervention} />
                    </motion.div>
                  )}
                </section>

                <section className={`transition-opacity duration-300 ${(selectedBranchPointId && selectedIntervention) ? 'opacity-100' : 'opacity-40 pointer-events-none'}`}>
                   <div className="pt-4 border-t border-white/5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="text-xs text-slate-500 max-w-sm">
                        Generates a side-by-side path comparison without affecting agent memory.
                      </div>
                      <button
                        onClick={onRun}
                        disabled={!selectedIntervention || !selectedBranchPointId || isRunning}
                        className="flex-shrink-0 group inline-flex items-center justify-center gap-2 rounded-md bg-white px-5 py-2.5 text-sm font-bold text-slate-950 transition-all hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-white/10 disabled:text-slate-500"
                      >
                        {isRunning ? (
                          <>
                            <Loader2 className="h-4 w-4 animate-spin" />
                            Running...
                          </>
                        ) : (
                          <>
                            <WandSparkles className="h-4 w-4" />
                            Run Experiment
                          </>
                        )}
                      </button>
                   </div>
                </section>
              </div>
            </div>

            {/* Results Section spanning full width below Setup */}
            <div ref={resultsRef}>
              {activeRun && (
                <div className="mt-12 pt-8 border-t border-white/5">
                  <RunSummary run={activeRun} />
                </div>
              )}
            </div>
          </motion.div>
        </AnimatePresence>
      )}

      {viewMode === 'history' && (
        <AnimatePresence mode="wait">
          <motion.div 
            key="history"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="space-y-8"
          >
              <div className="grid gap-6 lg:grid-cols-4">
                {/* Sidebar for History List */}
                <div className="lg:col-span-1 border-r border-white/5 pr-0 lg:pr-4 space-y-4">
                   <h3 className="text-sm font-bold text-white mb-4 flex items-center gap-2">
                     <History className="w-4 h-4 text-indigo-400" />
                     Saved Run History
                   </h3>
                   
                   <div className="space-y-2 max-h-[600px] overflow-y-auto pr-2 custom-scrollbar">
                      {recentRuns.length === 0 ? (
                        <div className="p-4 text-center border border-dashed border-white/5 rounded-lg bg-white/[0.02] text-xs text-slate-400">
                           No experiments saved yet.
                        </div>
                      ) : (
                        recentRuns.map((run) => (
                           <button
                             key={run.id}
                             onClick={() => onOpenRun(run)}
                             className={`w-full text-left p-3 rounded-lg border transition-all duration-200 outline-none hover:shadow-sm ${
                               activeRun?.id === run.id
                                 ? 'border-emerald-500/50 bg-emerald-500/10 shadow-sm ring-1 ring-emerald-500/30'
                                 : 'border-white/5 bg-white/[0.02] hover:bg-white/[0.04]'
                             }`}
                           >
                              <div className="flex justify-between items-start mb-1.5">
                                <div className="text-xs font-bold text-white leading-tight">{run.intervention.label}</div>
                                <div className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-white/10 text-emerald-300 leading-none">{run.comparison.outcomeScore.alternate}</div>
                              </div>
                              <div className="text-[10px] text-slate-400 leading-relaxed mb-2 line-clamp-2">{run.branchPoint.summary}</div>
                              <div className="text-[9px] uppercase font-bold text-slate-500 tracking-wider">
                                {new Date(run.createdAt).toLocaleDateString()}
                              </div>
                           </button>
                        ))
                      )}
                   </div>
                </div>

                {/* Main Content for History item View */}
                <div className="lg:col-span-3">
                   {activeRun ? (
                      <RunSummary run={activeRun} />
                   ) : (
                      <div className="h-full min-h-[400px] flex flex-col items-center justify-center p-10 text-center border border-dashed border-white/10 bg-white/5 rounded-2xl">
                         <SearchIcon className="w-12 h-12 text-slate-600 mb-4" />
                         <h4 className="text-lg font-semibold text-slate-300 mb-2">Select a past run to view results</h4>
                         <p className="text-sm text-slate-500 max-w-sm">
                            Click any item from the history list to review its insights, comparison, and technical context.
                         </p>
                      </div>
                   )}
                </div>
             </div>
          </motion.div>
        </AnimatePresence>
      )}
    </div>
  )
}

function SearchIcon(props: any) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="11" cy="11" r="8" />
      <path d="m21 21-4.3-4.3" />
    </svg>
  )
}

export default ParallelRealityExplorer
