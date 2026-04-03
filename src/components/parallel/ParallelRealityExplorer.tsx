'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { ArrowRightLeft, Brain, Clock3, GitBranch, History, Loader2, MessageSquareDiff, Sparkles, Target, AlertTriangle, BadgeCheck, WandSparkles } from 'lucide-react'
import type {
  ScenarioBranchPoint,
  ScenarioAnalyticsSummary,
  ScenarioIntervention,
  ScenarioRunRecord,
} from '@/types/database'

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
    <div className="space-y-4 rounded-sm border border-white/10 bg-[#111826] p-4">
      <div>
        <div className="text-sm font-medium text-white">{intervention.label}</div>
        <p className="mt-1 text-sm text-slate-400">{intervention.description}</p>
      </div>

      {intervention.type === 'rewrite_reply' && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Response style</span>
            <select
              value={intervention.responseStyle || 'warmer'}
              onChange={(event) => onChange({ ...intervention, responseStyle: event.target.value as ScenarioIntervention['responseStyle'] })}
              className="w-full rounded-sm border border-white/10 bg-[#0b1220] px-3 py-2 text-white outline-none"
            >
              <option value="warmer">Warmer</option>
              <option value="more direct">More direct</option>
              <option value="more skeptical">More skeptical</option>
              <option value="more collaborative">More collaborative</option>
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Why change it</span>
            <input
              value={intervention.rationale || ''}
              onChange={(event) => onChange({ ...intervention, rationale: event.target.value })}
              className="w-full rounded-sm border border-white/10 bg-[#0b1220] px-3 py-2 text-white outline-none"
              placeholder="Example: reduce tension and keep momentum"
            />
          </label>
        </div>
      )}

      {intervention.type === 'emotion_shift' && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Target emotion</span>
            <select
              value={intervention.targetEmotion || 'trust'}
              onChange={(event) => onChange({ ...intervention, targetEmotion: event.target.value as ScenarioIntervention['targetEmotion'] })}
              className="w-full rounded-sm border border-white/10 bg-[#0b1220] px-3 py-2 text-white outline-none"
            >
              {['joy', 'sadness', 'anger', 'fear', 'surprise', 'trust', 'anticipation', 'disgust'].map((emotion) => (
                <option key={emotion} value={emotion}>{emotion}</option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Shift strength</span>
            <select
              value={intervention.emotionIntensity || 'medium'}
              onChange={(event) => onChange({ ...intervention, emotionIntensity: event.target.value as ScenarioIntervention['emotionIntensity'] })}
              className="w-full rounded-sm border border-white/10 bg-[#0b1220] px-3 py-2 text-white outline-none"
            >
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
            </select>
          </label>
        </div>
      )}

      {intervention.type === 'memory_injection' && (
        <label className="space-y-2 text-sm text-slate-300">
          <span>Injected memory</span>
          <textarea
            value={intervention.memoryText || ''}
            onChange={(event) => onChange({ ...intervention, memoryText: event.target.value })}
            className="min-h-28 w-full rounded-sm border border-white/10 bg-[#0b1220] px-3 py-2 text-white outline-none"
            placeholder="Add the memory the agent should act as if it strongly recalls."
          />
        </label>
      )}

      {intervention.type === 'goal_outcome' && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Goal</span>
            <input
              value={intervention.goal || ''}
              onChange={(event) => onChange({ ...intervention, goal: event.target.value })}
              className="w-full rounded-sm border border-white/10 bg-[#0b1220] px-3 py-2 text-white outline-none"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Forced outcome</span>
            <select
              value={intervention.forcedOutcome || 'succeeds'}
              onChange={(event) => onChange({ ...intervention, forcedOutcome: event.target.value as ScenarioIntervention['forcedOutcome'] })}
              className="w-full rounded-sm border border-white/10 bg-[#0b1220] px-3 py-2 text-white outline-none"
            >
              <option value="succeeds">Succeeds</option>
              <option value="fails">Fails</option>
            </select>
          </label>
        </div>
      )}

      {intervention.type === 'relationship_shift' && (
        <div className="grid gap-3 md:grid-cols-2">
          <label className="space-y-2 text-sm text-slate-300">
            <span>Counterpart name</span>
            <input
              value={intervention.counterpartName || ''}
              onChange={(event) => onChange({ ...intervention, counterpartName: event.target.value })}
              className="w-full rounded-sm border border-white/10 bg-[#0b1220] px-3 py-2 text-white outline-none"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300">
            <span>Trust delta</span>
            <input
              type="number"
              step="0.01"
              value={intervention.trustDelta ?? 0}
              onChange={(event) => onChange({ ...intervention, trustDelta: Number(event.target.value) })}
              className="w-full rounded-sm border border-white/10 bg-[#0b1220] px-3 py-2 text-white outline-none"
            />
          </label>
          <label className="space-y-2 text-sm text-slate-300 md:col-span-2">
            <span>Respect delta</span>
            <input
              type="number"
              step="0.01"
              value={intervention.respectDelta ?? 0}
              onChange={(event) => onChange({ ...intervention, respectDelta: Number(event.target.value) })}
              className="w-full rounded-sm border border-white/10 bg-[#0b1220] px-3 py-2 text-white outline-none"
            />
          </label>
        </div>
      )}
    </div>
  )
}

function RunSummary({ run }: { run: ScenarioRunRecord }) {
  const [activeTab, setActiveTab] = useState<'overview' | 'turns' | 'context'>('overview')

  return (
    <div className="overflow-hidden rounded-sm border border-white/10 bg-[#0f1726]">
      <div className="border-b border-white/10 bg-[#101a2a] p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-300">
              <GitBranch className="h-4 w-4" />
              Saved Scenario Run
            </div>
            <h3 className="mt-2 text-xl font-semibold text-white">{run.intervention.label}</h3>
            <p className="mt-2 max-w-2xl text-sm text-slate-400">
              Branching from {run.branchPoint.title.toLowerCase()} for {run.agentName}. {run.comparison.firstDivergence}
            </p>
          </div>
          <div className="rounded-sm border border-cyan-400/20 bg-cyan-500/10 px-3 py-2 text-right">
            <div className="text-xs text-cyan-200">Outcome score</div>
            <div className="mt-1 text-sm text-white">
              baseline {run.comparison.outcomeScore.baseline} / alternate {run.comparison.outcomeScore.alternate}
            </div>
          </div>
        </div>

        <div className="mt-4 flex gap-2">
          {(['overview', 'turns', 'context'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`rounded-full px-4 py-2 text-sm transition-colors ${
                activeTab === tab
                  ? 'bg-white text-slate-950'
                  : 'bg-white/5 text-slate-300 hover:bg-white/10'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      <div className="p-5">
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="grid gap-4 lg:grid-cols-2"
            >
              <div className="rounded-sm border border-white/10 bg-[#111826] p-4">
                <div className="text-sm font-medium text-white">Baseline path</div>
                <p className="mt-2 text-sm text-slate-300">{run.comparison.baselineSummary}</p>
              </div>
              <div className="rounded-sm border border-cyan-400/15 bg-cyan-500/8 p-4">
                <div className="text-sm font-medium text-cyan-200">Alternate path</div>
                <p className="mt-2 text-sm text-cyan-50">{run.comparison.alternateSummary}</p>
              </div>
              <div className="rounded-sm border border-white/10 bg-[#111826] p-4">
                <div className="text-sm font-medium text-white">Key differences</div>
                <ul className="mt-3 space-y-2 text-sm text-slate-300">
                  {run.comparison.keyDifferences.map((difference, index) => (
                    <li key={index} className="flex gap-2">
                      <span className="text-cyan-300">•</span>
                      <span>{difference}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div className="rounded-sm border border-white/10 bg-[#111826] p-4">
                <div className="text-sm font-medium text-white">Quality scoreboard</div>
                <div className="mt-3 grid gap-3 md:grid-cols-2">
                  <div className="rounded-sm border border-white/8 bg-[#0b1220] p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Baseline</div>
                    <div className="mt-2 text-lg font-semibold text-white">{run.comparison.qualityScore.baseline}</div>
                    <div className="mt-2 space-y-1 text-sm text-slate-300">
                      <div>Clarity {run.comparison.qualityBreakdown.baseline.clarity}</div>
                      <div>Warmth {run.comparison.qualityBreakdown.baseline.warmth}</div>
                      <div>Specificity {run.comparison.qualityBreakdown.baseline.specificity}</div>
                      <div>Consistency {run.comparison.qualityBreakdown.baseline.consistency}</div>
                    </div>
                  </div>
                  <div className="rounded-sm border border-cyan-400/15 bg-cyan-500/8 p-3">
                    <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/80">Alternate</div>
                    <div className="mt-2 text-lg font-semibold text-cyan-50">{run.comparison.qualityScore.alternate}</div>
                    <div className="mt-2 space-y-1 text-sm text-cyan-50/90">
                      <div>Clarity {run.comparison.qualityBreakdown.alternate.clarity}</div>
                      <div>Warmth {run.comparison.qualityBreakdown.alternate.warmth}</div>
                      <div>Specificity {run.comparison.qualityBreakdown.alternate.specificity}</div>
                      <div>Consistency {run.comparison.qualityBreakdown.alternate.consistency}</div>
                    </div>
                  </div>
                </div>
              </div>
              <div className="rounded-sm border border-emerald-400/15 bg-emerald-500/8 p-4">
                <div className="text-sm font-medium text-emerald-200">Recommendation</div>
                <p className="mt-2 text-sm text-emerald-50">{run.comparison.recommendation}</p>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Quality notes</div>
                    <ul className="mt-2 space-y-2 text-sm text-emerald-50/90">
                      {run.comparison.qualityNotes.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-emerald-200/70">Risk notes</div>
                    <ul className="mt-2 space-y-2 text-sm text-emerald-50/90">
                      {run.comparison.riskNotes.map((note, index) => (
                        <li key={index}>{note}</li>
                      ))}
                    </ul>
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="rounded-sm border border-white/8 bg-[#0b1220] p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <AlertTriangle className="h-4 w-4 text-amber-300" />
                      Baseline flags
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {run.comparison.qualityFlags.baseline.length > 0 ? run.comparison.qualityFlags.baseline.map((flag) => (
                        <span key={flag} className="rounded-full bg-amber-500/10 px-2 py-1 text-xs text-amber-100">{flag}</span>
                      )) : <span className="text-sm text-slate-400">No major flags</span>}
                    </div>
                  </div>
                  <div className="rounded-sm border border-white/8 bg-[#0b1220] p-3">
                    <div className="flex items-center gap-2 text-sm font-medium text-white">
                      <BadgeCheck className="h-4 w-4 text-emerald-300" />
                      Alternate flags
                    </div>
                    <div className="mt-2 flex flex-wrap gap-2">
                      {run.comparison.qualityFlags.alternate.length > 0 ? run.comparison.qualityFlags.alternate.map((flag) => (
                        <span key={flag} className="rounded-full bg-emerald-500/10 px-2 py-1 text-xs text-emerald-100">{flag}</span>
                      )) : <span className="text-sm text-slate-400">No major flags</span>}
                    </div>
                  </div>
                </div>
              </div>
            </motion.div>
          )}

          {activeTab === 'turns' && (
            <motion.div
              key="turns"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="space-y-4"
            >
              <div className="rounded-sm border border-white/10 bg-[#111826] p-4">
                <div className="text-sm font-medium text-white">Fast diff highlights</div>
                <div className="mt-3 space-y-3">
                  {run.comparison.diffHighlights.map((highlight, index) => (
                    <div key={`${highlight.label}-${index}`} className="grid gap-3 lg:grid-cols-2">
                      <div className="rounded-sm border border-white/8 bg-[#0b1220] p-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-slate-500">{highlight.label} baseline</div>
                        <div className="mt-2 text-sm text-slate-200">{highlight.baseline}</div>
                      </div>
                      <div className="rounded-sm border border-cyan-400/15 bg-cyan-500/8 p-3">
                        <div className="text-xs uppercase tracking-[0.2em] text-cyan-200/70">{highlight.label} alternate</div>
                        <div className="mt-2 text-sm text-cyan-50">{highlight.alternate}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              {run.turns.map((turn) => (
                <div key={turn.id} className="rounded-sm border border-white/10 bg-[#111826] p-4">
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <span className="rounded-full bg-cyan-500/10 px-3 py-1 text-cyan-200">{turn.probeLabel}</span>
                    <span className="text-slate-400">{turn.probePrompt}</span>
                  </div>
                  <div className="mt-4 grid gap-4 lg:grid-cols-2">
                    <div className="rounded-sm border border-white/10 bg-[#0b1220] p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-white">
                        <MessageSquareDiff className="h-4 w-4 text-slate-300" />
                        Baseline
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-slate-300">{turn.baselineResponse}</p>
                      <div className="mt-4 text-xs text-slate-500">
                        Dominant emotion: {turn.baselineEmotion.dominantEmotion || 'dormant'}
                      </div>
                    </div>
                    <div className="rounded-sm border border-cyan-400/15 bg-cyan-500/8 p-4">
                      <div className="flex items-center gap-2 text-sm font-medium text-cyan-100">
                        <ArrowRightLeft className="h-4 w-4" />
                        Alternate
                      </div>
                      <p className="mt-3 whitespace-pre-wrap text-sm text-cyan-50">{turn.alternateResponse}</p>
                      <div className="mt-4 text-xs text-cyan-100/80">
                        Dominant emotion: {turn.alternateEmotion.dominantEmotion || 'dormant'}
                      </div>
                    </div>
                  </div>
                  <div className="mt-4 rounded-sm border border-white/8 bg-[#0b1220] p-3 text-sm text-slate-300">
                    {turn.divergenceNotes.join(' ')}
                  </div>
                </div>
              ))}
            </motion.div>
          )}

          {activeTab === 'context' && (
            <motion.div
              key="context"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              className="grid gap-4 lg:grid-cols-2"
            >
              <div className="rounded-sm border border-white/10 bg-[#111826] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Clock3 className="h-4 w-4 text-slate-300" />
                  Branch context
                </div>
                <div className="mt-3 text-sm text-slate-300">
                  <div className="font-medium text-white">{run.branchPoint.title}</div>
                  <p className="mt-2">{run.branchPoint.summary}</p>
                  <div className="mt-4 text-xs text-slate-500">{formatBranchPoint(run.branchPoint)}</div>
                </div>
                {run.branchContext.relationshipSummary && (
                  <div className="mt-4 rounded-sm border border-white/8 bg-[#0b1220] p-3 text-sm text-slate-300">
                    {run.branchContext.relationshipSummary}
                  </div>
                )}
              </div>
              <div className="rounded-sm border border-white/10 bg-[#111826] p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-white">
                  <Brain className="h-4 w-4 text-slate-300" />
                  Scenario setup
                </div>
                <div className="mt-3 space-y-3 text-sm text-slate-300">
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Intervention</div>
                    <div className="mt-1">{run.intervention.label}</div>
                    <div className="mt-1 text-slate-400">{run.intervention.description}</div>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Injected context</div>
                    <ul className="mt-2 space-y-2">
                      {run.alternateState.injectedContext.map((entry, index) => (
                        <li key={index}>{entry}</li>
                      ))}
                    </ul>
                  </div>
                  <div>
                    <div className="text-xs uppercase tracking-[0.2em] text-slate-500">Relevant memories</div>
                    <ul className="mt-2 space-y-2">
                      {run.branchContext.relevantMemories.map((memory) => (
                        <li key={memory.id}>
                          {memory.summary}
                          <span className="ml-2 text-slate-500">importance {memory.importance}</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
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
  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
        <div className="space-y-6 rounded-sm border border-white/10 bg-[#0f1726] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
          <div className="flex items-start justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 text-xs uppercase tracking-[0.2em] text-cyan-300">
                <Sparkles className="h-4 w-4" />
                What-If Lab
              </div>
              <h2 className="mt-2 text-2xl font-semibold text-white">Fork {agentName}&apos;s path from a real point in history</h2>
              <p className="mt-2 max-w-3xl text-sm text-slate-400">
                Choose a real branch point, edit one condition, then replay a short forward run with saved comparisons.
              </p>
            </div>
            <button
              onClick={onRun}
              disabled={!selectedIntervention || !selectedBranchPointId || isRunning}
              className="inline-flex items-center gap-2 rounded-sm bg-white px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-slate-200 disabled:cursor-not-allowed disabled:bg-slate-600 disabled:text-slate-300"
            >
              {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
              {isRunning ? 'Running branch' : 'Run scenario'}
            </button>
          </div>

          <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <History className="h-4 w-4 text-cyan-300" />
                1. Choose a branch point
              </div>
              <div className="space-y-2">
                {branchPoints.map((point) => {
                  const selected = `${point.kind}:${point.id}` === selectedBranchPointId
                  return (
                    <button
                      key={`${point.kind}:${point.id}`}
                      onClick={() => onSelectBranchPoint(point)}
                      className={`w-full rounded-sm border p-3 text-left transition-colors ${
                        selected
                          ? 'border-cyan-400/40 bg-cyan-500/10'
                          : 'border-white/10 bg-[#111826] hover:bg-[#162033]'
                      }`}
                    >
                      <div className="text-sm font-medium text-white">{point.title}</div>
                      <div className="mt-1 text-sm text-slate-400">{point.summary}</div>
                      <div className="mt-2 text-xs text-slate-500">{formatBranchPoint(point)}</div>
                    </button>
                  )
                })}
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm font-medium text-white">
                <Target className="h-4 w-4 text-cyan-300" />
                2. Choose the intervention
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                {templates.map((template) => {
                  const selected = selectedIntervention?.label === template.label
                  return (
                    <button
                      key={template.label}
                      onClick={() => onSelectTemplate(template)}
                      className={`rounded-sm border p-4 text-left transition-colors ${
                        selected
                          ? 'border-cyan-400/40 bg-cyan-500/10'
                          : 'border-white/10 bg-[#111826] hover:bg-[#162033]'
                      }`}
                    >
                      <div className="text-sm font-medium text-white">{template.label}</div>
                      <p className="mt-2 text-sm text-slate-400">{template.description}</p>
                    </button>
                  )
                })}
              </div>

              {selectedIntervention ? (
                <div className="space-y-3">
                  <div className="flex items-center gap-2 text-sm font-medium text-white">
                    <MessageSquareDiff className="h-4 w-4 text-cyan-300" />
                    3. Tune the scenario
                  </div>
                  <InterventionEditor intervention={selectedIntervention} onChange={onUpdateIntervention} />
                </div>
              ) : (
                <div className="rounded-sm border border-dashed border-white/15 bg-[#111826] p-6 text-sm text-slate-400">
                  Pick an intervention template to start editing the alternate branch.
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="space-y-4 rounded-sm border border-white/10 bg-[#0f1726] p-5 shadow-[0_24px_60px_rgba(0,0,0,0.28)]">
          <div>
            <div className="text-xs uppercase tracking-[0.2em] text-cyan-300">Recent runs</div>
            <h3 className="mt-2 text-lg font-semibold text-white">Saved branches</h3>
            <p className="mt-2 text-sm text-slate-400">
              Re-open prior runs to compare the latest scenario against earlier experiments.
            </p>
          </div>
          <div className="space-y-2">
            {analytics && analytics.totalRuns > 0 && (
              <div className="rounded-sm border border-violet-400/20 bg-violet-500/10 p-4">
                <div className="flex items-center gap-2 text-sm font-medium text-violet-100">
                  <WandSparkles className="h-4 w-4" />
                  Scenario playbook
                </div>
                <div className="mt-2 text-sm text-violet-50/90">
                  {analytics.totalRuns} runs tracked. Average alternate score {analytics.averageAlternateScore}.
                </div>
                <ul className="mt-3 space-y-2 text-sm text-violet-50/90">
                  {analytics.recommendedPlaybook.map((note, index) => (
                    <li key={index}>{note}</li>
                  ))}
                </ul>
                {analytics.bestInterventions.length > 0 && (
                  <div className="mt-3 space-y-2">
                    {analytics.bestInterventions.map((entry) => (
                      <div key={entry.label} className="rounded-sm border border-white/8 bg-[#0b1220] p-2 text-xs text-violet-50">
                        {entry.label}: win rate {Math.round(entry.winRate * 100)}%, avg gain {entry.averageGain}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
            {recentRuns.length === 0 ? (
              <div className="rounded-sm border border-dashed border-white/15 bg-[#111826] p-4 text-sm text-slate-400">
                No saved scenario runs yet.
              </div>
            ) : (
              recentRuns.map((run) => (
                <button
                  key={run.id}
                  onClick={() => onOpenRun(run)}
                  className={`w-full rounded-sm border p-3 text-left transition-colors ${
                    activeRun?.id === run.id
                      ? 'border-cyan-400/40 bg-cyan-500/10'
                      : 'border-white/10 bg-[#111826] hover:bg-[#162033]'
                  }`}
                >
                  <div className="text-sm font-medium text-white">{run.intervention.label}</div>
                  <div className="mt-1 text-sm text-slate-400">{run.branchPoint.summary}</div>
                  <div className="mt-2 text-xs text-slate-500">
                    {new Date(run.createdAt).toLocaleString()} · score {run.comparison.outcomeScore.alternate}
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      </div>

      {activeRun ? (
        <RunSummary run={activeRun} />
      ) : (
        <div className="rounded-sm border border-dashed border-white/15 bg-[#0f1726] p-10 text-center text-sm text-slate-400">
          Run a scenario to inspect baseline versus alternate outputs, emotion shifts, and saved context.
        </div>
      )}
    </div>
  )
}

export default ParallelRealityExplorer
