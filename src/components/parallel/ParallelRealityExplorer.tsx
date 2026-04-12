'use client'

import { useState, useEffect, useRef, type SVGProps } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Brain,
  Clock3,
  History,
  Loader2,
  MessageSquareDiff,
  Sparkles,
  Target,
  AlertTriangle,
  BadgeCheck,
  WandSparkles,
  BookOpen,
  CheckCircle2,
  Info,
  Archive,
} from 'lucide-react'
import type {
  ScenarioBranchPoint,
  ScenarioAnalyticsSummary,
  ScenarioIntervention,
  ScenarioRunRecord,
} from '@/types/database'
import { ScenarioGuideModal } from './ScenarioGuideModal'
import { PipelineIcon, StageIcon, ArchiveLibraryIcon, ContextIcon, QualityIcon } from '@/components/journal/JournalIcons'

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

const premiumPanel = 'rounded-md border border-border/40 bg-card/40 backdrop-blur-md shadow-sm'
const subPanel = 'rounded-sm border border-border/30 bg-muted/20'
const labelStyle = 'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80'

function formatBranchPoint(point: ScenarioBranchPoint): string {
  const label =
    point.kind === 'message'
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
    <div className="space-y-3 pt-3 border-t border-border/20">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-bold text-foreground flex items-center gap-2">
          <Target className="w-3.5 h-3.5 text-pastel-blue" />
          {intervention.label}
        </div>
        <p className="text-[10px] text-muted-foreground max-w-[140px] truncate" title={intervention.description}>
          {intervention.description}
        </p>
      </div>

      {intervention.type === 'rewrite_reply' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 block">
            <span className={labelStyle}>Response style</span>
            <select
              value={intervention.responseStyle || 'warmer'}
              onChange={(event) =>
                onChange({
                  ...intervention,
                  responseStyle: event.target.value as ScenarioIntervention['responseStyle'],
                })
              }
              className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-1.5 text-[11px] text-foreground outline-none focus:border-pastel-purple/50 transition-all font-bold"
            >
              <option value="warmer">Warmer</option>
              <option value="more direct">More direct</option>
              <option value="more skeptical">More skeptical</option>
              <option value="more collaborative">More collaborative</option>
            </select>
          </label>
          <label className="space-y-1.5 block">
            <span className={labelStyle}>Why change it?</span>
            <input
              value={intervention.rationale || ''}
              onChange={(event) => onChange({ ...intervention, rationale: event.target.value })}
              className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-1.5 text-[11px] text-foreground outline-none focus:border-pastel-purple/50 transition-all font-bold"
              placeholder="e.g. reduce tension"
            />
          </label>
        </div>
      )}

      {intervention.type === 'emotion_shift' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 block">
            <span className={labelStyle}>Target emotion</span>
            <select
              value={intervention.targetEmotion || 'trust'}
              onChange={(event) =>
                onChange({
                  ...intervention,
                  targetEmotion: event.target.value as ScenarioIntervention['targetEmotion'],
                })
              }
              className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-1.5 text-[11px] text-foreground outline-none focus:border-pastel-purple/50 transition-all font-bold capitalize"
            >
              {['joy', 'sadness', 'anger', 'fear', 'surprise', 'trust', 'anticipation', 'disgust'].map(
                (emotion) => (
                  <option key={emotion} value={emotion}>
                    {emotion}
                  </option>
                )
              )}
            </select>
          </label>
          <label className="space-y-1.5 block">
            <span className={labelStyle}>Shift strength</span>
            <select
              value={intervention.emotionIntensity || 'medium'}
              onChange={(event) =>
                onChange({
                  ...intervention,
                  emotionIntensity: event.target.value as ScenarioIntervention['emotionIntensity'],
                })
              }
              className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-1.5 text-[11px] text-foreground outline-none focus:border-pastel-purple/50 transition-all font-bold"
            >
              <option value="low">Subtle</option>
              <option value="medium">Noticeable</option>
              <option value="high">Drastic</option>
            </select>
          </label>
        </div>
      )}

      {intervention.type === 'memory_injection' && (
        <label className="space-y-1.5 block">
          <span className={labelStyle}>Injected memory details</span>
          <textarea
            value={intervention.memoryText || ''}
            onChange={(event) => onChange({ ...intervention, memoryText: event.target.value })}
            className="h-20 w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-2 text-[11px] text-foreground outline-none focus:border-pastel-purple/50 transition-all resize-none font-medium"
            placeholder="Recall that fact..."
          />
        </label>
      )}

      {intervention.type === 'goal_outcome' && (
        <div className="grid gap-3 sm:grid-cols-2">
          <label className="space-y-1.5 block">
            <span className={labelStyle}>Which Goal?</span>
            <input
              value={intervention.goal || ''}
              onChange={(event) => onChange({ ...intervention, goal: event.target.value })}
              className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-1.5 text-[11px] text-foreground outline-none focus:border-pastel-purple/50 transition-all font-bold"
              placeholder="e.g. Finish the launch guide"
            />
          </label>
          <label className="space-y-1.5 block">
            <span className={labelStyle}>Forced outcome</span>
            <select
              value={intervention.forcedOutcome || 'succeeds'}
              onChange={(event) =>
                onChange({
                  ...intervention,
                  forcedOutcome: event.target.value as ScenarioIntervention['forcedOutcome'],
                })
              }
              className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-1.5 text-[11px] text-foreground outline-none focus:border-pastel-purple/50 transition-all font-bold"
            >
              <option value="succeeds">Force Success</option>
              <option value="fails">Force Failure</option>
            </select>
          </label>
        </div>
      )}

      {intervention.type === 'relationship_shift' && (
        <div className="grid gap-3 sm:grid-cols-3">
          <label className="space-y-1.5 block">
            <span className={labelStyle}>Name</span>
            <input
              value={intervention.counterpartName || ''}
              onChange={(event) => onChange({ ...intervention, counterpartName: event.target.value })}
              className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-1.5 text-[11px] text-foreground outline-none focus:border-pastel-purple/50 transition-all font-bold"
              placeholder="Name"
            />
          </label>
          <label className="space-y-1.5 block">
            <span className={labelStyle}>Trust shift</span>
            <input
              type="number"
              step="0.01"
              value={intervention.trustDelta ?? 0}
              onChange={(event) => onChange({ ...intervention, trustDelta: Number(event.target.value) })}
              className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-1.5 text-[11px] text-foreground outline-none focus:border-pastel-purple/50 transition-all font-bold"
            />
          </label>
          <label className="space-y-1.5 block">
            <span className={labelStyle}>Respect shift</span>
            <input
              type="number"
              step="0.01"
              value={intervention.respectDelta ?? 0}
              onChange={(event) => onChange({ ...intervention, respectDelta: Number(event.target.value) })}
              className="w-full rounded-sm border border-border/30 bg-muted/5 px-3 py-1.5 text-[11px] text-foreground outline-none focus:border-pastel-purple/50 transition-all font-bold"
            />
          </label>
        </div>
      )}
    </div>
  )
}

function RunSummary({ run }: { run: ScenarioRunRecord }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'comparison' | 'context'>('overview')
  const tabs: Array<{ id: 'overview' | 'comparison' | 'context'; label: string }> = [
    { id: 'overview', label: 'Analysis' },
    { id: 'comparison', label: 'Diff' },
    { id: 'context', label: 'Context' },
  ]

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex h-full min-w-0 flex-col space-y-6"
    >
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-5 border-b border-border/20">
        <div>
          <div className="flex items-center gap-1.5 text-[10px] font-bold tracking-widest text-pastel-green mb-2 uppercase">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Scenario Completed
          </div>
          <h3 className="text-2xl font-black text-foreground tracking-tight mb-1">{run.intervention.label}</h3>
          <p className="text-muted-foreground text-[11px] font-medium uppercase tracking-wider">
            Branch: {run.branchPoint.title} <span className="mx-1.5 opacity-50">•</span> Starts at: <span className="text-pastel-blue">{run.comparison.firstDivergence}</span>
          </p>
        </div>
        <div className="flex items-center gap-4 bg-muted/10 p-2.5 rounded-sm border border-border/30 shrink-0">
          <div className="text-right">
            <div className={labelStyle}>Alt. Quality</div>
            <div className="text-xl font-black text-pastel-purple leading-none mt-1">{run.comparison.outcomeScore.alternate}</div>
          </div>
          <div className="w-px h-8 bg-border/40" />
          <div className="text-left">
            <div className={labelStyle}>Orig. Quality</div>
            <div className="text-xl font-black text-muted-foreground leading-none mt-1">{run.comparison.outcomeScore.baseline}</div>
          </div>
        </div>
      </div>

      <div className="flex bg-muted/10 p-1 rounded-sm border border-border/30 w-fit self-start shrink-0">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-1.5 text-[11px] font-bold uppercase tracking-wider transition-all rounded-sm ${
              activeTab === tab.id
                ? 'bg-card text-foreground shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="min-w-0 flex-1 overflow-y-auto rounded-sm border border-border/20 bg-muted/5 p-5 scrollbar-thin">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="min-w-0 space-y-8"
            >
              <div className="flex flex-col xl:flex-row gap-6 xl:gap-8">
                <div className="xl:w-3/5">
                  <h4 className="text-[11px] font-bold text-pastel-purple uppercase tracking-widest mb-3 flex items-center gap-2">
                    <BadgeCheck className="w-4 h-4" /> Primary Insight
                  </h4>
                  <p className="text-lg text-foreground font-medium leading-relaxed">
                    {run.comparison.recommendation}
                  </p>

                  {run.comparison.qualityNotes.length > 0 && (
                    <div className="mt-5 flex flex-wrap gap-2">
                      {run.comparison.qualityNotes.map((note, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm bg-pastel-green/10 text-pastel-green text-[10px] font-bold uppercase tracking-wider border border-pastel-green/20">
                          <CheckCircle2 className="w-3 h-3" /> {note}
                        </span>
                      ))}
                    </div>
                  )}
                  {run.comparison.riskNotes.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {run.comparison.riskNotes.map((note, idx) => (
                        <span key={idx} className="inline-flex items-center gap-1.5 px-3 py-1 rounded-sm bg-pastel-red/10 text-pastel-red text-[10px] font-bold uppercase tracking-wider border border-pastel-red/20">
                          <AlertTriangle className="w-3 h-3" /> {note}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="xl:w-2/5 xl:border-l border-border/30 xl:pl-8">
                  <h4 className={labelStyle + ' mb-4'}>Key Divergences</h4>
                  <ul className="space-y-3 m-0 p-0">
                    {run.comparison.keyDifferences.map((difference, idx) => (
                      <li key={idx} className="flex gap-3 text-xs text-muted-foreground items-start">
                        <Sparkles className="w-3.5 h-3.5 text-pastel-blue flex-shrink-0 mt-0.5" />
                        <span className="leading-relaxed font-medium">{difference}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <div className="h-px w-full bg-border/30" />

              <div className="grid xl:grid-cols-2 gap-6 relative">
                <div className={`${subPanel} p-4`}>
                  <div className={labelStyle + ' mb-2 text-muted-foreground'}>Baseline Context</div>
                  <p className="text-[11px] text-muted-foreground leading-relaxed font-medium">
                    {run.comparison.baselineSummary}
                  </p>
                </div>
                <div className={`${subPanel} p-4 border-pastel-green/30 bg-pastel-green/5`}>
                  <div className={labelStyle + ' mb-2 text-pastel-green'}>Alternate Outcome</div>
                  <p className="text-[11px] text-foreground leading-relaxed font-medium">
                    {run.comparison.alternateSummary}
                  </p>
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
              className="min-w-0 space-y-8 pl-1"
            >
              {run.turns.map((turn, tIdx) => (
                <div key={turn.id} className="relative pl-6 xl:pl-8 border-l-2 border-border/40 pb-4">
                  <div className="absolute top-0 left-0 -translate-x-[7px] w-3 h-3 rounded-full bg-pastel-purple border-2 border-background"></div>

                  <div className="mb-4">
                    <span className={labelStyle}>Turn {tIdx + 1}: {turn.probeLabel}</span>
                    <h5 className="text-[13px] font-bold text-foreground mt-1 tracking-tight">{turn.probePrompt}</h5>
                  </div>

                  <div className="grid xl:grid-cols-2 gap-4 xl:gap-6">
                    <div className={`${subPanel} p-4`}>
                      <div className="text-[9px] uppercase font-bold text-muted-foreground tracking-wider border-b border-border/20 pb-2 mb-3">Original Response</div>
                      <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-muted-foreground/80 font-medium">{turn.baselineResponse}</p>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-muted-foreground pt-3 mt-3 border-t border-border/10">
                        Emotion: <span className="text-foreground">{turn.baselineEmotion.dominantEmotion || 'dormant'}</span>
                      </div>
                    </div>
                    <div className={`${subPanel} p-4 border-pastel-blue/30 bg-pastel-blue/5`}>
                      <div className="text-[9px] uppercase font-bold text-pastel-blue tracking-wider border-b border-pastel-blue/20 pb-2 mb-3">Alternate Branch</div>
                      <p className="whitespace-pre-wrap text-[11px] leading-relaxed text-foreground font-medium">{turn.alternateResponse}</p>
                      <div className="text-[9px] font-bold uppercase tracking-widest text-pastel-blue/80 pt-3 mt-3 border-t border-pastel-blue/10">
                        Emotion: <span className="text-pastel-blue">{turn.alternateEmotion.dominantEmotion || 'dormant'}</span>
                      </div>
                    </div>
                  </div>

                  {turn.divergenceNotes.length > 0 && (
                    <div className="mt-4 flex items-start gap-2 bg-pastel-purple/10 px-4 py-3 rounded-sm border border-pastel-purple/20 text-xs text-foreground">
                      <MessageSquareDiff className="w-4 h-4 text-pastel-purple shrink-0 mt-px" />
                      <span className="font-medium leading-relaxed max-w-3xl">{turn.divergenceNotes.join(' ')}</span>
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
              className="grid min-w-0 gap-6 xl:grid-cols-2"
            >
              <div className={`${subPanel} p-5`}>
                <div className="flex items-center gap-2 text-[11px] font-bold text-foreground mb-5 uppercase tracking-[0.2em] border-b border-border/20 pb-3">
                  <Clock3 className="h-4 w-4 text-pastel-blue" />
                  Moment Context
                </div>
                <dl className="space-y-4">
                  <div>
                    <dt className={labelStyle + ' mb-1'}>Event Title</dt>
                    <dd className="text-[13px] font-bold text-foreground">{run.branchPoint.title}</dd>
                  </div>
                  <div>
                    <dt className={labelStyle + ' mb-1'}>Summary</dt>
                    <dd className="text-[11px] font-medium text-muted-foreground leading-relaxed">{run.branchPoint.summary}</dd>
                  </div>
                  <div>
                    <dt className={labelStyle + ' mb-1'}>Timestamp</dt>
                    <dd className="text-[11px] font-bold text-foreground">{formatBranchPoint(run.branchPoint)}</dd>
                  </div>
                </dl>
              </div>

              <div className={`${subPanel} p-5`}>
                <div className="flex items-center gap-2 text-[11px] font-bold text-foreground mb-5 uppercase tracking-[0.2em] border-b border-border/20 pb-3">
                  <Brain className="h-4 w-4 text-pastel-purple" />
                  Applied Configuration
                </div>
                <dl className="space-y-4">
                  <div>
                    <dt className={labelStyle + ' mb-1'}>Action</dt>
                    <dd className="text-[13px] font-bold text-foreground mb-1">{run.intervention.label}</dd>
                    <dd className="text-[11px] font-medium text-muted-foreground leading-relaxed">{run.intervention.description}</dd>
                  </div>
                  {run.alternateState.injectedContext.length > 0 && (
                    <div className="pt-2">
                      <dt className={labelStyle + ' mb-2'}>Injected Data</dt>
                      <dd>
                        <ul className="space-y-1.5 m-0 p-0">
                          {run.alternateState.injectedContext.map((entry, index) => (
                            <li key={index} className="flex gap-2 text-[11px] font-medium text-foreground leading-relaxed">
                              <span className="text-pastel-purple shrink-0 mt-0.5">•</span>{entry}
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
  const resultsRef = useRef<HTMLDivElement>(null)

  const selectedPointObject = branchPoints.find(p => `${p.kind}:${p.id}` === selectedBranchPointId)

  useEffect(() => {
    if (activeRun && !isRunning) {
      setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [activeRun, isRunning])

  return (
    <div className="w-full">
      <ScenarioGuideModal isOpen={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Header Bar */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between px-1 mb-4">
        <div className="flex items-center gap-4">
          <div className="rounded-md bg-pastel-blue/10 p-2.5">
            <Sparkles className="h-5 w-5 text-pastel-blue" />
          </div>
          <div>
             <div className="flex items-center gap-2">
               <h3 className="text-lg font-bold text-foreground leading-tight tracking-tight">
                 What-If Lab
               </h3>
               <button
                 onClick={() => setGuideOpen(true)}
                 className="flex items-center gap-1.5 px-2 py-0.5 text-[9px] font-bold uppercase rounded-sm bg-muted/20 border border-border/40 hover:bg-muted text-muted-foreground hover:text-foreground transition-all ml-1"
               >
                 <BookOpen className="w-3 h-3 text-pastel-blue" /> Guide
               </button>
             </div>
            <p className="text-[11px] mt-0.5 font-medium text-muted-foreground uppercase tracking-widest">
              Alternate branches & scenarios for {agentName}
            </p>
          </div>
        </div>
      </div>

      {/* Grid Layout identical to other tools */}
      <div className="grid min-w-0 gap-4 xl:h-[calc(100vh-220px)] xl:min-h-[700px] xl:grid-cols-[minmax(0,340px)_minmax(0,1fr)_minmax(0,420px)]">
        
        {/* Column 1: Setup Configuration */}
        <div className="flex min-w-0 w-full flex-col gap-4 overflow-hidden min-h-0">
          {/* Moments Picker */}
          <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden h-1/2`}>
            <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center gap-2 shrink-0">
              <ContextIcon className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">1. Select Moment</span>
            </div>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
              {branchPoints.map((point) => {
                const isSelected = `${point.kind}:${point.id}` === selectedBranchPointId
                return (
                  <button
                    key={`${point.kind}:${point.id}`}
                    onClick={() => onSelectBranchPoint(point)}
                    className={`w-full text-left p-2.5 rounded-sm border transition-all duration-200 outline-none ${
                      isSelected
                        ? 'border-pastel-blue/40 bg-pastel-blue/10'
                        : 'border-border/30 bg-muted/5 hover:border-pastel-blue/20'
                    }`}
                  >
                    <div className="flex justify-between items-center mb-0.5">
                       <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-wider">{formatBranchPoint(point).split('·')[0].trim()}</span>
                       {isSelected && <span className="text-[8px] font-bold uppercase text-pastel-blue">Selected</span>}
                    </div>
                    <div className="text-[11px] font-bold text-foreground leading-tight line-clamp-1 mb-0.5">{point.title}</div>
                    <div className="text-[10px] text-muted-foreground line-clamp-1 font-medium">{point.summary}</div>
                  </button>
                )
              })}
              {branchPoints.length === 0 && (
                <div className="p-4 text-center border border-dashed border-border/30 rounded-sm bg-muted/5 text-[11px] text-muted-foreground font-medium italic">
                  No moments available to branch from.
                </div>
              )}
            </div>
          </section>

          {/* Action Configuration */}
          <section className={`${premiumPanel} flex flex-col overflow-hidden shrink-0 h-1/2`}>
            <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
              <div className="flex items-center gap-2">
                <PipelineIcon className="h-4 w-4" />
                <span className="text-[11px] font-bold uppercase tracking-[0.2em]">2. Configuration</span>
              </div>
            </div>
            
            <div className={`flex-1 overflow-y-auto p-3 scrollbar-thin transition-opacity duration-300 ${!selectedBranchPointId ? 'opacity-40 pointer-events-none' : 'opacity-100'}`}>
              <div className="grid grid-cols-2 gap-1.5 mb-3">
                {templates.map((template) => {
                  const isSelected = selectedIntervention?.label === template.label
                  return (
                    <button
                      key={template.label}
                      onClick={() => onSelectTemplate(template)}
                      className={`text-left p-2 rounded-sm border transition-all duration-200 outline-none ${
                        isSelected
                          ? 'border-pastel-purple/40 bg-pastel-purple/10'
                          : 'border-border/30 bg-muted/5 hover:border-pastel-purple/20'
                      }`}
                    >
                      <div className="text-[10px] font-bold text-foreground leading-tight">{template.label}</div>
                    </button>
                  )
                })}
              </div>

              {selectedIntervention && (
                <AnimatePresence>
                  <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }}>
                    <InterventionEditor intervention={selectedIntervention} onChange={onUpdateIntervention} />
                  </motion.div>
                </AnimatePresence>
              )}
            </div>

            {/* Run Footer Area */}
            <div className="p-3 shrink-0 border-t border-border/30 bg-muted/5">
               <button
                  onClick={onRun}
                  disabled={!selectedIntervention || !selectedBranchPointId || isRunning}
                  className="w-full flex items-center justify-center gap-2 h-9 rounded-sm bg-pastel-blue hover:bg-pastel-blue/90 text-primary-foreground text-[10px] uppercase font-bold tracking-wider disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isRunning ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      Running Sim...
                    </>
                  ) : (
                    <>
                      <WandSparkles className="h-3.5 w-3.5" />
                      Run Experiment
                    </>
                  )}
               </button>
            </div>
          </section>
        </div>

        {/* Column 2: The Stage (Results Viewer) */}
        <section className={`${premiumPanel} flex min-w-0 w-full flex-col overflow-hidden min-h-0`} ref={resultsRef}>
          <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
            <div className="flex items-center gap-2">
              <StageIcon className="h-4 w-4" />
              <span className="text-[11px] font-bold uppercase tracking-[0.2em]">The Stage Viewer</span>
            </div>
          </div>
          <div className="flex-1 overflow-y-auto scrollbar-thin p-5 lg:p-8">
            {isRunning ? (
              <div className="h-full flex flex-col items-center justify-center mt-[-20px]">
                <div className="relative flex h-24 w-24 items-center justify-center mb-6">
                  {/* Outer spinning dash ring */}
                  <motion.div
                    animate={{ rotate: 360 }}
                    transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                    className="absolute inset-0 rounded-full border border-dashed border-pastel-blue/30"
                  />
                  {/* Inner pulsing ring */}
                  <motion.div
                    animate={{ scale: [0.8, 1.2, 0.8], opacity: [0.2, 0.5, 0.2] }}
                    transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute inset-2 rounded-full border border-pastel-blue/20 bg-pastel-blue/5 shadow-[0_0_15px_rgba(137,180,250,0.15)]"
                  />
                  {/* Center Icon */}
                  <Sparkles className="relative h-8 w-8 text-pastel-blue" />
                </div>
                <h4 className="text-[11px] font-bold uppercase tracking-[0.25em] text-pastel-blue mb-1.5">Simulating Reality</h4>
                <p className="text-xs text-muted-foreground max-w-[280px] text-center leading-relaxed">
                  Calculating alternate timeline divergence and projecting emotional state...
                </p>
              </div>
            ) : activeRun ? (
              <RunSummary run={activeRun} />
            ) : (
              <div className="h-full flex flex-col items-center justify-center opacity-50 grayscale">
                 <Target className="w-10 h-10 text-muted-foreground mb-4" />
                 <h4 className="text-sm font-semibold mb-1">No Display Data</h4>
                 <p className="text-xs text-muted-foreground max-w-sm text-center">
                    Select a moment from the left, configure how you want to alter the timeline, and run the simulator to view results here.
                 </p>
              </div>
            )}
          </div>
        </section>

        {/* Column 3: History & Preview */}
        <div className="flex min-w-0 w-full flex-col gap-4 overflow-hidden min-h-0">
           {/* Moment Preview block */}
           <section className={`${premiumPanel} flex flex-col h-[280px] overflow-hidden shrink-0`}>
             <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <ArchiveLibraryIcon className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Context Preview</span>
                </div>
                {selectedPointObject && <span className="text-[9px] font-bold text-muted-foreground tracking-widest">{formatBranchPoint(selectedPointObject).split('·')[1]?.trim()}</span>}
             </div>
             <div className="flex-1 overflow-y-auto scrollbar-thin p-4">
                {selectedPointObject ? (
                   <div className="space-y-3">
                      <div>
                         <div className={labelStyle + ' mb-1'}>Title</div>
                         <div className="text-[13px] font-bold text-foreground leading-tight tracking-tight">{selectedPointObject.title}</div>
                      </div>
                      <div>
                         <div className={labelStyle + ' mb-1.5'}>Full Context</div>
                         <div className="text-[11px] font-medium leading-relaxed text-foreground whitespace-pre-wrap">
                            {selectedPointObject.fullContent || selectedPointObject.summary}
                         </div>
                      </div>
                   </div>
                ) : (
                   <div className="h-full flex flex-col items-center justify-center text-center opacity-40">
                      <Archive className="h-6 w-6 mb-2" />
                      <div className="text-[10px] uppercase font-bold tracking-widest">Select to read</div>
                   </div>
                )}
             </div>
           </section>

           {/* History panel */}
           <section className={`${premiumPanel} flex flex-col flex-1 overflow-hidden shrink-0`}>
              <div className="border-b border-border/40 bg-muted/10 px-4 py-3 flex items-center justify-between shrink-0">
                <div className="flex items-center gap-2">
                  <History className="h-4 w-4" />
                  <span className="text-[11px] font-bold uppercase tracking-[0.2em]">Session Archive</span>
                </div>
                <div className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">{analytics?.totalRuns || 0} Runs</div>
              </div>
              <div className="flex-1 overflow-y-auto p-3 space-y-1.5 scrollbar-thin">
                {recentRuns.length === 0 ? (
                   <div className="p-4 text-center border border-dashed border-border/30 rounded-sm bg-muted/5 text-[11px] text-muted-foreground font-medium italic">
                      No experiments saved yet.
                   </div>
                ) : (
                   recentRuns.map((run) => (
                      <button
                        key={run.id}
                        onClick={() => onOpenRun(run)}
                        className={`w-full text-left p-2.5 rounded-sm border transition-all duration-200 outline-none hover:shadow-sm ${
                          activeRun?.id === run.id
                            ? 'border-pastel-purple/40 bg-pastel-purple/10'
                            : 'border-border/30 bg-muted/5 hover:border-pastel-purple/20'
                        }`}
                      >
                         <div className="flex justify-between items-start mb-1">
                           <div className="text-[11px] font-bold text-foreground leading-tight">{run.intervention.label}</div>
                           <div className="text-[9px] font-bold px-1.5 py-0.5 rounded-sm bg-pastel-purple/20 text-pastel-purple leading-none uppercase tracking-wider">{run.comparison.outcomeScore.alternate}</div>
                         </div>
                         <div className="text-[10px] text-muted-foreground leading-relaxed mb-1.5 line-clamp-2 font-medium">{run.branchPoint.summary}</div>
                         <div className="text-[9px] font-bold text-muted-foreground tracking-widest uppercase">
                           {new Date(run.createdAt).toLocaleDateString()}
                         </div>
                      </button>
                   ))
                )}
              </div>
           </section>
        </div>
      </div>
    </div>
  )
}

export default ParallelRealityExplorer
