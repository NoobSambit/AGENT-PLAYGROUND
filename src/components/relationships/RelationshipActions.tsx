'use client'

import { useState } from 'react'
import { BookOpen, GitBranch, Handshake, Loader2, ShieldAlert } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input, Textarea } from '@/components/ui/input'
import type { RelationshipWorkspaceDetail } from '@/types/database'
import { Collapsible } from './RelationshipAtoms'
import { labelStyle, percentage, subPanel } from './RelationshipHelpers'

// ─── PromptGuidance ───────────────────────────────────────────────────────────
function PromptGuidance({
  detail,
  agentId,
  agentName,
}: {
  detail: RelationshipWorkspaceDetail
  agentId: string
  agentName: string
}) {
  const { guidance } = detail.relationship

  return (
    <div className="space-y-3">
      <div className="text-[11px] text-muted-foreground leading-relaxed">
        These hints are injected into future prompts to guide how each agent behaves in this relationship context.
      </div>
      {guidance.sides.map((side) => {
        const isLeft = side.agentId === agentId
        const title = isLeft ? agentName : detail.otherAgent.name
        return (
          <div key={side.agentId} className={`${subPanel} p-3 space-y-2`}>
            <div className="text-[11px] font-semibold text-foreground">{title}&apos;s prompt profile</div>
            <div className="text-[11px] text-muted-foreground leading-relaxed">
              {side.speakerSummary || 'No summary available.'}
            </div>
            <div className="grid gap-3 sm:grid-cols-2 mt-1">
              <div>
                <div className={`${labelStyle} mb-1`}>Do More Of</div>
                {side.doMoreOf.length > 0 ? (
                  <ul className="space-y-1">
                    {side.doMoreOf.map((entry) => (
                      <li key={entry} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-pastel-green" />
                        {entry}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[11px] italic text-muted-foreground/50">No positive guidance stored.</div>
                )}
              </div>
              <div>
                <div className={`${labelStyle} mb-1`}>Avoid</div>
                {side.avoid.length > 0 ? (
                  <ul className="space-y-1">
                    {side.avoid.map((entry) => (
                      <li key={entry} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                        <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-pastel-red" />
                        {entry}
                      </li>
                    ))}
                  </ul>
                ) : (
                  <div className="text-[11px] italic text-muted-foreground/50">No caution flags stored.</div>
                )}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

// ─── ConflictStudio ───────────────────────────────────────────────────────────
interface ConflictAnalysis {
  id: string
  topic: string
  tension: number
  resolutionStyle: string
  status: string
  commonGround: string[]
  frictionPoints: string[]
  actionItems: string[]
}

function ConflictStudio({
  detail,
  agentId,
  agentName,
  mediatorOptions,
  onAnalyze,
  onResolve,
}: {
  detail: RelationshipWorkspaceDetail
  agentId: string
  agentName: string
  mediatorOptions: Array<{ id: string; name: string }>
  onAnalyze: (topic: string, currentPos: string, otherPos: string, mediatorId: string) => Promise<ConflictAnalysis | null>
  onResolve: (analysis: ConflictAnalysis) => Promise<void>
}) {
  const [topic, setTopic] = useState('')
  const [currentPos, setCurrentPos] = useState('')
  const [otherPos, setOtherPos] = useState('')
  const [mediatorId, setMediatorId] = useState('')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<ConflictAnalysis | null>(null)

  const canAnalyze = topic.trim() && currentPos.trim() && otherPos.trim()

  async function handleAnalyze() {
    if (!canAnalyze) return
    setLoading(true)
    const analysis = await onAnalyze(topic, currentPos, otherPos, mediatorId)
    setResult(analysis)
    setLoading(false)
  }

  async function handleResolve() {
    if (!result) return
    setLoading(true)
    await onResolve(result)
    setLoading(false)
  }

  return (
    <div className="space-y-4">
      <div className="text-[11px] text-muted-foreground leading-relaxed">
        Simulate a disagreement, then apply the result as relationship evidence through the shared pipeline.
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelStyle} htmlFor="conflict-topic">Conflict topic</label>
          <Input
            id="conflict-topic"
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            placeholder="What are they disagreeing about?"
            className="h-8 text-[12px]"
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelStyle} htmlFor="mediator-select">Mediator (optional)</label>
          <select
            id="mediator-select"
            value={mediatorId}
            onChange={(e) => setMediatorId(e.target.value)}
            className="h-8 w-full rounded-sm border border-border/30 bg-background/30 px-2.5 text-[12px] text-foreground outline-none focus:border-pastel-blue/40"
          >
            <option value="">No mediator</option>
            {mediatorOptions.map((a) => (
              <option key={a.id} value={a.id}>{a.name}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <div className="space-y-1.5">
          <label className={labelStyle} htmlFor="current-position">{agentName}&apos;s position</label>
          <Textarea
            id="current-position"
            value={currentPos}
            onChange={(e) => setCurrentPos(e.target.value)}
            placeholder="Describe this agent's argument."
            className="min-h-[100px] text-[12px]"
          />
        </div>
        <div className="space-y-1.5">
          <label className={labelStyle} htmlFor="other-position">{detail.otherAgent.name}&apos;s position</label>
          <Textarea
            id="other-position"
            value={otherPos}
            onChange={(e) => setOtherPos(e.target.value)}
            placeholder="Describe the opposing view."
            className="min-h-[100px] text-[12px]"
          />
        </div>
      </div>

      <div className="flex gap-2">
        <Button size="sm" onClick={handleAnalyze} disabled={loading || !canAnalyze}>
          {loading ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : <Handshake className="mr-1.5 h-3.5 w-3.5" />}
          Analyze Conflict
        </Button>
        {result && (
          <Button size="sm" variant="outline" onClick={handleResolve} disabled={loading}>
            Apply Resolution
          </Button>
        )}
      </div>

      {result && (
        <div className={`${subPanel} p-3 space-y-3`}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[12px] font-semibold text-foreground">{result.topic}</div>
              <div className="mt-0.5 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                {result.resolutionStyle.replace(/_/g, ' ')} · {result.status}
              </div>
            </div>
            <div className="text-right">
              <div className={labelStyle}>Tension</div>
              <div className="text-lg font-bold text-pastel-yellow">{percentage(result.tension)}</div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <div className={`${labelStyle} mb-1.5`}>Common Ground</div>
              <div className="flex flex-wrap gap-1.5">
                {result.commonGround.length > 0 ? (
                  result.commonGround.map((e) => (
                    <span key={e} className="rounded-full border border-pastel-green/20 bg-pastel-green/10 px-2 py-0.5 text-[10px] text-pastel-green">{e}</span>
                  ))
                ) : (
                  <span className="text-[11px] italic text-muted-foreground/60">None found.</span>
                )}
              </div>
            </div>
            <div>
              <div className={`${labelStyle} mb-1.5`}>Friction Points</div>
              <div className="flex flex-wrap gap-1.5">
                {result.frictionPoints.map((e) => (
                  <span key={e} className="rounded-full border border-pastel-red/20 bg-pastel-red/10 px-2 py-0.5 text-[10px] text-pastel-red">{e}</span>
                ))}
              </div>
            </div>
          </div>

          {result.actionItems.length > 0 && (
            <div>
              <div className={`${labelStyle} mb-1.5`}>Action Items</div>
              <ul className="space-y-1">
                {result.actionItems.map((e) => (
                  <li key={e} className="flex items-start gap-1.5 text-[11px] text-muted-foreground">
                    <span className="mt-1 h-1 w-1 shrink-0 rounded-full bg-pastel-blue" />
                    {e}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

// ─── RelationshipActions ──────────────────────────────────────────────────────
export function RelationshipActions({
  detail,
  agentId,
  agentName,
  mediatorOptions,
  manualSummary,
  manualSaving,
  onManualSummaryChange,
  onSaveCheckpoint,
  onAnalyzeConflict,
  onResolveConflict,
}: {
  detail: RelationshipWorkspaceDetail
  agentId: string
  agentName: string
  mediatorOptions: Array<{ id: string; name: string }>
  manualSummary: string
  manualSaving: boolean
  onManualSummaryChange: (v: string) => void
  onSaveCheckpoint: () => void
  onAnalyzeConflict: (topic: string, curPos: string, otherPos: string, mediatorId: string) => Promise<ConflictAnalysis | null>
  onResolveConflict: (analysis: ConflictAnalysis) => Promise<void>
}) {
  return (
    <div className="space-y-3">
      {/* Conflict Studio */}
      <Collapsible title="Conflict Studio" icon={ShieldAlert} accent="text-pastel-red">
        <ConflictStudio
          detail={detail}
          agentId={agentId}
          agentName={agentName}
          mediatorOptions={mediatorOptions}
          onAnalyze={onAnalyzeConflict}
          onResolve={onResolveConflict}
        />
      </Collapsible>

      {/* Prompt Guidance */}
      <Collapsible title="Prompt Intelligence" icon={BookOpen} accent="text-pastel-purple">
        <PromptGuidance detail={detail} agentId={agentId} agentName={agentName} />
      </Collapsible>

      {/* Manual Checkpoint */}
      <Collapsible title="Manual Checkpoint" icon={GitBranch} accent="text-pastel-green">
        <div className="space-y-3">
          <div className="text-[11px] text-muted-foreground leading-relaxed">
            Capture a reviewed social observation without editing metrics directly. This becomes permanent evidence.
          </div>
          <Textarea
            value={manualSummary}
            onChange={(e) => onManualSummaryChange(e.target.value)}
            placeholder="Example: Arena showed rising respect despite disagreement on execution details."
            className="min-h-[96px] text-[12px]"
          />
          <Button
            size="sm"
            className="w-full"
            onClick={onSaveCheckpoint}
            disabled={manualSaving || !manualSummary.trim()}
          >
            {manualSaving ? (
              <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
            ) : (
              <GitBranch className="mr-1.5 h-3.5 w-3.5" />
            )}
            Save Checkpoint
          </Button>
        </div>
      </Collapsible>
    </div>
  )
}

export type { ConflictAnalysis }
