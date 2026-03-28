'use client'

import { useEffect, useState } from 'react'
import { AgentRecord } from '@/types/database'
import { ConflictAnalysis } from '@/types/enhancements'
import { Input, Textarea } from '@/components/ui/input'

interface ConflictResolutionPanelProps {
  currentAgent: AgentRecord
  agents: AgentRecord[]
}

const panelClass = 'rounded-[1.6rem] border border-border/70 bg-card/[0.62] p-5 backdrop-blur-xl'

export function ConflictResolutionPanel({ currentAgent, agents }: ConflictResolutionPanelProps) {
  const [topic, setTopic] = useState('')
  const [otherAgentId, setOtherAgentId] = useState<string>('')
  const [mediatorId, setMediatorId] = useState<string>('')
  const [currentPosition, setCurrentPosition] = useState('')
  const [otherPosition, setOtherPosition] = useState('')
  const [analysis, setAnalysis] = useState<ConflictAnalysis | null>(null)
  const [recentConflicts, setRecentConflicts] = useState<ConflictAnalysis[]>([])
  const [loading, setLoading] = useState(false)

  const counterpartAgents = agents.filter((agent) => agent.id !== currentAgent.id)

  useEffect(() => {
    async function fetchConflicts() {
      try {
        const response = await fetch(`/api/conflicts?agentId=${encodeURIComponent(currentAgent.id)}`)
        if (!response.ok) {
          return
        }

        const data = await response.json()
        setRecentConflicts(data.conflicts || [])
      } catch (error) {
        console.error('Failed to fetch conflicts:', error)
      }
    }

    void fetchConflicts()
  }, [currentAgent.id])

  const analyzeConflict = async () => {
    if (!otherAgentId || !topic.trim() || !currentPosition.trim() || !otherPosition.trim()) {
      return
    }

    try {
      setLoading(true)
      const response = await fetch('/api/conflicts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'analyze',
          agentId1: currentAgent.id,
          agentId2: otherAgentId,
          topic: topic.trim(),
          agent1Message: currentPosition.trim(),
          agent2Message: otherPosition.trim(),
          mediatorId: mediatorId || undefined,
        }),
      })

      if (!response.ok) {
        throw new Error('Failed to analyze conflict')
      }

      const data = await response.json()
      setAnalysis(data.conflict)
      setRecentConflicts((prev) => [data.conflict, ...prev].slice(0, 6))
    } catch (error) {
      console.error('Failed to analyze conflict:', error)
    } finally {
      setLoading(false)
    }
  }

  const resolveConflict = async () => {
    if (!analysis) {
      return
    }

    const response = await fetch('/api/conflicts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'resolve',
        conflictId: analysis.id,
      }),
    })

    if (response.ok) {
      setAnalysis((prev) => prev
        ? { ...prev, status: prev.resolutionStyle === 'agree_to_disagree' ? 'stalemate' : 'resolved' }
        : prev)
    }
  }

  return (
    <div className="space-y-6">
      <div className={panelClass}>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Conflict studio</div>
        <p className="mt-2 text-sm leading-7 text-muted-foreground">
          Analyze disagreements, pull in a mediator, and convert relationship tension into a concrete resolution plan.
        </p>

        <div className="mt-5 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-foreground">Counterpart</label>
            <select
              value={otherAgentId}
              onChange={(event) => setOtherAgentId(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card/[0.62] px-4 text-sm text-foreground outline-none"
            >
              <option value="">Select agent</option>
              {counterpartAgents.map((agent) => (
                <option key={agent.id} value={agent.id}>{agent.name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="text-sm font-medium text-foreground">Mediator</label>
            <select
              value={mediatorId}
              onChange={(event) => setMediatorId(event.target.value)}
              className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card/[0.62] px-4 text-sm text-foreground outline-none"
            >
              <option value="">No mediator</option>
              {counterpartAgents
                .filter((agent) => agent.id !== otherAgentId)
                .map((agent) => (
                  <option key={agent.id} value={agent.id}>{agent.name}</option>
                ))}
            </select>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-medium text-foreground">Conflict topic</label>
          <Input
            value={topic}
            onChange={(event) => setTopic(event.target.value)}
            placeholder="What are they disagreeing about?"
            className="mt-2"
          />
        </div>

        <div className="mt-4 grid gap-4 md:grid-cols-2">
          <div>
            <label className="text-sm font-medium text-foreground">{currentAgent.name}&apos;s position</label>
            <Textarea
              value={currentPosition}
              onChange={(event) => setCurrentPosition(event.target.value)}
              className="mt-2 min-h-[140px]"
              placeholder="Describe this agent's argument or stance."
            />
          </div>
          <div>
            <label className="text-sm font-medium text-foreground">Other position</label>
            <Textarea
              value={otherPosition}
              onChange={(event) => setOtherPosition(event.target.value)}
              className="mt-2 min-h-[140px]"
              placeholder="Describe the opposing argument or stance."
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={() => void analyzeConflict()}
            disabled={loading}
            className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_44px_-26px_rgba(109,77,158,0.72)] disabled:opacity-60"
          >
            {loading ? 'Analyzing...' : 'Analyze conflict'}
          </button>
          {analysis && (
            <button
              type="button"
              onClick={() => void resolveConflict()}
              className="inline-flex h-11 items-center justify-center rounded-full border border-border/70 bg-card/[0.62] px-5 text-sm font-medium text-foreground"
            >
              Apply resolution
            </button>
          )}
        </div>
      </div>

      {analysis && (
        <div className={panelClass}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-semibold text-foreground">{analysis.topic}</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                {analysis.resolutionStyle.replace(/_/g, ' ')} · status {analysis.status}
              </p>
            </div>
            <div className="text-right">
              <div className="text-sm text-muted-foreground">Tension</div>
              <div className="text-2xl font-semibold text-rose-500">{(analysis.tension * 100).toFixed(0)}%</div>
            </div>
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Common ground</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.commonGround.length > 0 ? analysis.commonGround.map((item) => (
                  <span key={item} className="soft-pill">{item}</span>
                )) : <span className="text-sm text-muted-foreground">No clear overlap yet.</span>}
              </div>
            </div>
            <div>
              <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Friction points</div>
              <div className="mt-3 flex flex-wrap gap-2">
                {analysis.frictionPoints.map((item) => (
                  <span key={item} className="rounded-full bg-rose-500/10 px-3 py-1 text-xs text-rose-500">{item}</span>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-5">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Action items</div>
            <div className="mt-3 space-y-2">
              {analysis.actionItems.map((item) => (
                <div key={item} className="rounded-[1.2rem] bg-background/45 px-4 py-3 text-sm text-muted-foreground">{item}</div>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className={panelClass}>
        <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Recent cases</div>
        <div className="mt-4 space-y-3">
          {recentConflicts.length === 0 ? (
            <p className="text-sm text-muted-foreground">No conflict analyses stored yet.</p>
          ) : (
            recentConflicts.map((conflict) => (
              <button
                key={conflict.id}
                type="button"
                onClick={() => setAnalysis(conflict)}
                className="block w-full rounded-[1.2rem] border border-border/60 bg-background/45 px-4 py-3 text-left transition-all hover:border-primary/20"
              >
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="font-medium text-foreground">{conflict.topic}</div>
                    <div className="mt-1 text-sm text-muted-foreground">
                      {conflict.participants.map((participant) => participant.agentName).join(' vs ')}
                    </div>
                  </div>
                  <div className="text-sm font-semibold text-rose-500">{(conflict.tension * 100).toFixed(0)}%</div>
                </div>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  )
}

export default ConflictResolutionPanel
