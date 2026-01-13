'use client'

/**
 * Challenge Hub Component - Phase 2
 *
 * Displays and manages collaborative challenges between agents.
 */

import React, { useState, useEffect } from 'react'
import {
  Challenge,
  ChallengeTemplate,
  ChallengeType,
  ChallengeDifficulty,
  ChallengeStatus,
  AgentRecord,
} from '@/types/database'

interface ChallengeHubProps {
  currentAgentId: string
  agents: AgentRecord[]
}

const TYPE_ICONS: Record<ChallengeType, string> = {
  debate: '🎭',
  collaboration: '🤝',
  puzzle: '🧩',
  roleplay: '🎬',
  creative_collab: '🎨',
  negotiation: '⚖️',
  teaching: '📚',
  brainstorm: '💡',
}

const DIFFICULTY_COLORS: Record<ChallengeDifficulty, string> = {
  easy: 'text-green-400 bg-green-400/20',
  medium: 'text-yellow-400 bg-yellow-400/20',
  hard: 'text-orange-400 bg-orange-400/20',
  expert: 'text-red-400 bg-red-400/20',
}

const STATUS_COLORS: Record<ChallengeStatus, string> = {
  pending: 'text-gray-400 bg-gray-400/20',
  in_progress: 'text-blue-400 bg-blue-400/20',
  completed: 'text-green-400 bg-green-400/20',
  failed: 'text-red-400 bg-red-400/20',
  abandoned: 'text-gray-500 bg-gray-500/20',
}

export function ChallengeHub({ currentAgentId, agents }: ChallengeHubProps) {
  const [templates, setTemplates] = useState<ChallengeTemplate[]>([])
  const [challenges, setChallenges] = useState<Challenge[]>([])
  const [stats, setStats] = useState<{
    totalChallenges: number
    completed: number
    winRate: number
    totalXPEarned: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  // Modal states
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<ChallengeTemplate | null>(null)
  const [selectedParticipants, setSelectedParticipants] = useState<string[]>([currentAgentId])
  const [selectedChallenge, setSelectedChallenge] = useState<Challenge | null>(null)

  // Filters
  const [filterType, setFilterType] = useState<ChallengeType | 'all'>('all')
  const [filterStatus, setFilterStatus] = useState<ChallengeStatus | 'all'>('all')

  useEffect(() => {
    fetchData()
  }, [currentAgentId])

  const fetchData = async () => {
    try {
      setLoading(true)

      // Fetch templates
      const templatesRes = await fetch('/api/challenges?templates=true')
      if (templatesRes.ok) {
        const data = await templatesRes.json()
        setTemplates(data.templates)
      }

      // Fetch challenges for current agent
      const challengesRes = await fetch(`/api/challenges?agentId=${currentAgentId}`)
      if (challengesRes.ok) {
        const data = await challengesRes.json()
        setChallenges(data.challenges)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch challenge data:', error)
    } finally {
      setLoading(false)
    }
  }

  const createChallenge = async () => {
    if (!selectedTemplate || selectedParticipants.length < selectedTemplate.minParticipants) {
      return
    }

    try {
      setCreating(true)
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          templateId: selectedTemplate.id,
          participants: selectedParticipants,
          initiator: currentAgentId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setChallenges(prev => [data.challenge, ...prev])
        setShowCreateModal(false)
        setSelectedTemplate(null)
        setSelectedParticipants([currentAgentId])
        setSelectedChallenge(data.challenge)
      }
    } catch (error) {
      console.error('Failed to create challenge:', error)
    } finally {
      setCreating(false)
    }
  }

  const startChallenge = async (challengeId: string) => {
    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'start',
          challengeId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setChallenges(prev =>
          prev.map(c => (c.id === challengeId ? data.challenge : c))
        )
        setSelectedChallenge(data.challenge)
      }
    } catch (error) {
      console.error('Failed to start challenge:', error)
    }
  }

  const generateResponse = async (challengeId: string, agentId: string) => {
    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_response',
          challengeId,
          agentId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setChallenges(prev =>
          prev.map(c => (c.id === challengeId ? data.challenge : c))
        )
        setSelectedChallenge(data.challenge)
      }
    } catch (error) {
      console.error('Failed to generate response:', error)
    }
  }

  const advanceRound = async (challengeId: string) => {
    try {
      const response = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'advance',
          challengeId,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setChallenges(prev =>
          prev.map(c => (c.id === challengeId ? data.challenge : c))
        )
        setSelectedChallenge(data.challenge)
      }
    } catch (error) {
      console.error('Failed to advance round:', error)
    }
  }

  const filteredChallenges = challenges.filter(c => {
    if (filterType !== 'all' && c.type !== filterType) return false
    if (filterStatus !== 'all' && c.status !== filterStatus) return false
    return true
  })

  const getAgentName = (agentId: string) => {
    return agents.find(a => a.id === agentId)?.name || 'Unknown'
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Challenge Hub</h3>
          <p className="text-gray-400 text-sm">
            Collaborative challenges and competitions
          </p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="bg-rose-600 hover:bg-rose-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          ⚔️ New Challenge
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Total Challenges"
            value={stats.totalChallenges}
            icon="⚔️"
          />
          <StatCard
            label="Completed"
            value={stats.completed}
            icon="✅"
          />
          <StatCard
            label="Win Rate"
            value={`${(stats.winRate * 100).toFixed(0)}%`}
            icon="🏆"
          />
          <StatCard
            label="XP Earned"
            value={stats.totalXPEarned}
            icon="⭐"
          />
        </div>
      )}

      {/* Filters */}
      <div className="flex gap-4 flex-wrap">
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Type:</span>
          <select
            value={filterType}
            onChange={e => setFilterType(e.target.value as ChallengeType | 'all')}
            className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm"
          >
            <option value="all">All Types</option>
            {Object.entries(TYPE_ICONS).map(([type, icon]) => (
              <option key={type} value={type}>
                {icon} {type.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-gray-400 text-sm">Status:</span>
          <select
            value={filterStatus}
            onChange={e => setFilterStatus(e.target.value as ChallengeStatus | 'all')}
            className="bg-gray-700 text-white px-3 py-1.5 rounded text-sm"
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
          </select>
        </div>
      </div>

      {/* Challenges List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading challenges...</div>
      ) : filteredChallenges.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No challenges found. Create one to get started!
        </div>
      ) : (
        <div className="space-y-4">
          {filteredChallenges.map(challenge => (
            <ChallengeCard
              key={challenge.id}
              challenge={challenge}
              getAgentName={getAgentName}
              onClick={() => setSelectedChallenge(challenge)}
            />
          ))}
        </div>
      )}

      {/* Create Challenge Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-center mb-4">
              <h4 className="text-lg font-semibold text-white">Create Challenge</h4>
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setSelectedTemplate(null)
                }}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {!selectedTemplate ? (
              // Template Selection
              <div>
                <p className="text-gray-400 mb-4">Choose a challenge template:</p>
                <div className="grid grid-cols-2 gap-4">
                  {templates.map(template => (
                    <button
                      key={template.id}
                      onClick={() => setSelectedTemplate(template)}
                      className="bg-gray-700 hover:bg-gray-600 p-4 rounded-lg text-left transition-colors"
                    >
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-2xl">{TYPE_ICONS[template.type]}</span>
                        <span className="font-semibold text-white">{template.name}</span>
                      </div>
                      <p className="text-gray-400 text-sm mb-2">{template.description}</p>
                      <div className="flex gap-2">
                        <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLORS[template.difficulty]}`}>
                          {template.difficulty}
                        </span>
                        <span className="text-xs text-gray-500">
                          {template.minParticipants}-{template.maxParticipants} agents
                        </span>
                        <span className="text-xs text-yellow-400">
                          +{template.xpReward} XP
                        </span>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              // Participant Selection
              <div>
                <button
                  onClick={() => setSelectedTemplate(null)}
                  className="text-gray-400 hover:text-white mb-4"
                >
                  ← Back to templates
                </button>

                <div className="bg-gray-700 rounded-lg p-4 mb-4">
                  <div className="flex items-center gap-2 mb-2">
                    <span className="text-2xl">{TYPE_ICONS[selectedTemplate.type]}</span>
                    <span className="font-semibold text-white">{selectedTemplate.name}</span>
                  </div>
                  <p className="text-gray-400 text-sm">{selectedTemplate.description}</p>
                </div>

                <p className="text-gray-400 mb-2">
                  Select {selectedTemplate.minParticipants}-{selectedTemplate.maxParticipants} participants:
                </p>

                <div className="space-y-2 mb-6">
                  {agents.map(agent => (
                    <label
                      key={agent.id}
                      className={`flex items-center gap-3 p-3 rounded-lg cursor-pointer transition-colors ${
                        selectedParticipants.includes(agent.id)
                          ? 'bg-rose-600/30 border border-rose-500'
                          : 'bg-gray-700 hover:bg-gray-600'
                      }`}
                    >
                      <input
                        type="checkbox"
                        checked={selectedParticipants.includes(agent.id)}
                        onChange={e => {
                          if (e.target.checked) {
                            if (selectedParticipants.length < selectedTemplate.maxParticipants) {
                              setSelectedParticipants([...selectedParticipants, agent.id])
                            }
                          } else {
                            setSelectedParticipants(selectedParticipants.filter(id => id !== agent.id))
                          }
                        }}
                        className="sr-only"
                      />
                      <div className="w-10 h-10 rounded-full bg-gray-600 flex items-center justify-center text-white font-semibold">
                        {agent.name.charAt(0)}
                      </div>
                      <div>
                        <div className="text-white font-medium">{agent.name}</div>
                        <div className="text-gray-400 text-xs line-clamp-1">{agent.persona}</div>
                      </div>
                      {agent.id === currentAgentId && (
                        <span className="ml-auto text-xs text-rose-400">Current</span>
                      )}
                    </label>
                  ))}
                </div>

                <div className="flex gap-3">
                  <button
                    onClick={() => setShowCreateModal(false)}
                    className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={createChallenge}
                    disabled={creating || selectedParticipants.length < selectedTemplate.minParticipants}
                    className="flex-1 bg-rose-600 hover:bg-rose-700 text-white py-2 rounded transition-colors disabled:opacity-50"
                  >
                    {creating ? 'Creating...' : 'Create Challenge'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Challenge Detail Modal */}
      {selectedChallenge && (
        <ChallengeDetailModal
          challenge={selectedChallenge}
          getAgentName={getAgentName}
          onClose={() => setSelectedChallenge(null)}
          onStart={() => startChallenge(selectedChallenge.id)}
          onGenerateResponse={(agentId) => generateResponse(selectedChallenge.id, agentId)}
          onAdvanceRound={() => advanceRound(selectedChallenge.id)}
        />
      )}
    </div>
  )
}

function StatCard({
  label,
  value,
  icon,
}: {
  label: string
  value: string | number
  icon: string
}) {
  return (
    <div className="bg-gray-800 rounded-lg p-4 text-center">
      <div className="text-2xl mb-1">{icon}</div>
      <div className="text-xl font-bold text-white">{value}</div>
      <div className="text-xs text-gray-400">{label}</div>
    </div>
  )
}

function ChallengeCard({
  challenge,
  getAgentName,
  onClick,
}: {
  challenge: Challenge
  getAgentName: (id: string) => string
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{TYPE_ICONS[challenge.type]}</span>
          <div>
            <h5 className="font-semibold text-white">{challenge.name}</h5>
            <div className="text-sm text-gray-400">{challenge.description}</div>
          </div>
        </div>
        <div className="flex gap-2">
          <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLORS[challenge.difficulty]}`}>
            {challenge.difficulty}
          </span>
          <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[challenge.status]}`}>
            {challenge.status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1">
          <span className="text-gray-400 text-sm">Participants:</span>
          <div className="flex -space-x-2">
            {challenge.participants.slice(0, 4).map(id => (
              <div
                key={id}
                className="w-6 h-6 rounded-full bg-gray-600 border-2 border-gray-800 flex items-center justify-center text-xs text-white"
                title={getAgentName(id)}
              >
                {getAgentName(id).charAt(0)}
              </div>
            ))}
          </div>
        </div>
        <div className="text-sm text-gray-400">
          Round {challenge.currentRound + 1}/{challenge.maxRounds}
        </div>
      </div>

      {challenge.evaluation && (
        <div className="mt-3 pt-3 border-t border-gray-700 flex justify-between items-center">
          <span className={challenge.evaluation.success ? 'text-green-400' : 'text-red-400'}>
            {challenge.evaluation.success ? '✓ Success' : '✕ Failed'}
          </span>
          <span className="text-yellow-400">Score: {challenge.evaluation.score}/100</span>
        </div>
      )}
    </div>
  )
}

function ChallengeDetailModal({
  challenge,
  getAgentName,
  onClose,
  onStart,
  onGenerateResponse,
  onAdvanceRound,
}: {
  challenge: Challenge
  getAgentName: (id: string) => string
  onClose: () => void
  onStart: () => void
  onGenerateResponse: (agentId: string) => void
  onAdvanceRound: () => void
}) {
  const [generating, setGenerating] = useState<string | null>(null)

  const handleGenerateResponse = async (agentId: string) => {
    setGenerating(agentId)
    await onGenerateResponse(agentId)
    setGenerating(null)
  }

  return (
    <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
      <div className="bg-gray-800 rounded-lg p-6 max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <div className="flex justify-between items-start mb-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">{TYPE_ICONS[challenge.type]}</span>
              <h4 className="text-xl font-semibold text-white">{challenge.name}</h4>
            </div>
            <div className="flex gap-2">
              <span className={`text-xs px-2 py-0.5 rounded ${DIFFICULTY_COLORS[challenge.difficulty]}`}>
                {challenge.difficulty}
              </span>
              <span className={`text-xs px-2 py-0.5 rounded ${STATUS_COLORS[challenge.status]}`}>
                {challenge.status.replace('_', ' ')}
              </span>
            </div>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-white text-2xl">
            ✕
          </button>
        </div>

        {/* Objectives */}
        <div className="mb-6">
          <h5 className="text-white font-semibold mb-2">Objectives</h5>
          <div className="space-y-2">
            {challenge.objectives.map(obj => (
              <div
                key={obj.id}
                className={`flex items-center gap-2 p-2 rounded ${
                  obj.isComplete ? 'bg-green-600/20' : 'bg-gray-700'
                }`}
              >
                <span>{obj.isComplete ? '✓' : '○'}</span>
                <span className={obj.isComplete ? 'text-green-400' : 'text-gray-300'}>
                  {obj.description}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Participants */}
        <div className="mb-6">
          <h5 className="text-white font-semibold mb-2">Participants</h5>
          <div className="flex flex-wrap gap-2">
            {challenge.participants.map(id => (
              <div
                key={id}
                className="flex items-center gap-2 bg-gray-700 px-3 py-1.5 rounded"
              >
                <div className="w-6 h-6 rounded-full bg-gray-600 flex items-center justify-center text-xs text-white">
                  {getAgentName(id).charAt(0)}
                </div>
                <span className="text-white text-sm">{getAgentName(id)}</span>
                {challenge.status === 'in_progress' && (
                  <button
                    onClick={() => handleGenerateResponse(id)}
                    disabled={generating !== null}
                    className="text-xs bg-rose-600 hover:bg-rose-700 px-2 py-0.5 rounded disabled:opacity-50"
                  >
                    {generating === id ? '...' : 'Speak'}
                  </button>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Messages/Conversation */}
        {challenge.messages.length > 0 && (
          <div className="mb-6">
            <h5 className="text-white font-semibold mb-2">
              Conversation (Round {challenge.currentRound + 1}/{challenge.maxRounds})
            </h5>
            <div className="space-y-3 max-h-64 overflow-y-auto bg-gray-900 rounded-lg p-4">
              {challenge.messages.map(msg => (
                <div key={msg.id} className="flex gap-3">
                  <div className="w-8 h-8 rounded-full bg-gray-700 flex-shrink-0 flex items-center justify-center text-sm text-white">
                    {msg.agentName.charAt(0)}
                  </div>
                  <div className="flex-1">
                    <div className="flex items-baseline gap-2">
                      <span className="font-semibold text-white">{msg.agentName}</span>
                      <span className="text-xs text-gray-500">Round {msg.round + 1}</span>
                    </div>
                    <p className="text-gray-300 text-sm">{msg.content}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Evaluation */}
        {challenge.evaluation && (
          <div className="mb-6 bg-gray-700 rounded-lg p-4">
            <div className="flex justify-between items-center mb-2">
              <span className={`font-semibold ${challenge.evaluation.success ? 'text-green-400' : 'text-red-400'}`}>
                {challenge.evaluation.success ? '✓ Challenge Completed!' : '✕ Challenge Failed'}
              </span>
              <span className="text-2xl font-bold text-yellow-400">
                {challenge.evaluation.score}/100
              </span>
            </div>
            <p className="text-gray-300 text-sm">{challenge.evaluation.feedback}</p>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3">
          {challenge.status === 'pending' && (
            <button
              onClick={onStart}
              className="flex-1 bg-green-600 hover:bg-green-700 text-white py-2 rounded transition-colors"
            >
              ▶️ Start Challenge
            </button>
          )}
          {challenge.status === 'in_progress' && (
            <button
              onClick={onAdvanceRound}
              className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded transition-colors"
            >
              ⏭️ Next Round
            </button>
          )}
          <button
            onClick={onClose}
            className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
