'use client'

import { useState, useEffect } from 'react'
import { Mentorship, MentorCompatibility, MentorshipFocus, AgentRecord } from '@/types/database'

interface MentorshipHubProps {
  agentId: string
  agentName: string
  allAgents?: AgentRecord[]
}

const FOCUS_ICONS: Record<MentorshipFocus, string> = {
  communication: '💬',
  emotional_intelligence: '❤️',
  knowledge: '📚',
  creativity: '🎨',
  relationships: '🤝',
  problem_solving: '🧩'
}

const FOCUS_COLORS: Record<MentorshipFocus, string> = {
  communication: 'bg-blue-100 text-blue-800',
  emotional_intelligence: 'bg-pink-100 text-pink-800',
  knowledge: 'bg-green-100 text-green-800',
  creativity: 'bg-purple-100 text-purple-800',
  relationships: 'bg-orange-100 text-orange-800',
  problem_solving: 'bg-cyan-100 text-cyan-800'
}

export function MentorshipHub({ agentId, agentName, allAgents = [] }: MentorshipHubProps) {
  const [mentorships, setMentorships] = useState<{ asMentor: Mentorship[], asMentee: Mentorship[] }>({
    asMentor: [],
    asMentee: []
  })
  const [stats, setStats] = useState<{
    asMentor: { totalMentorships: number; averageEffectiveness: number; skillsTaught: string[] }
    asMentee: { totalMentorships: number; averageProgress: number; skillsLearned: string[] }
  } | null>(null)
  const [matches, setMatches] = useState<MentorCompatibility[]>([])
  const [loading, setLoading] = useState(true)
  const [activeTab, setActiveTab] = useState<'mentoring' | 'learning' | 'find'>('mentoring')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [selectedMatch, setSelectedMatch] = useState<MentorCompatibility | null>(null)
  const [selectedFocusAreas, setSelectedFocusAreas] = useState<MentorshipFocus[]>([])
  const [showSessionModal, setShowSessionModal] = useState(false)
  const [activeMentorship, setActiveMentorship] = useState<Mentorship | null>(null)
  const [sessionTopic, setSessionTopic] = useState('')

  // Fetch mentorship data
  useEffect(() => {
    async function fetchData() {
      try {
        setLoading(true)

        // Fetch mentorships
        const mentorshipsRes = await fetch(`/api/mentorship?agentId=${agentId}`)
        if (mentorshipsRes.ok) {
          const data = await mentorshipsRes.json()
          setMentorships(data)
        }

        // Fetch stats
        const statsRes = await fetch(`/api/mentorship?agentId=${agentId}&stats=true`)
        if (statsRes.ok) {
          const data = await statsRes.json()
          setStats(data.stats)
        }

        // Fetch matches
        const matchesRes = await fetch(`/api/mentorship?agentId=${agentId}&findMatches=true`)
        if (matchesRes.ok) {
          const data = await matchesRes.json()
          setMatches(data.matches || [])
        }
      } catch (err) {
        console.error('Failed to fetch mentorship data:', err)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [agentId])

  // Create mentorship
  const handleCreateMentorship = async () => {
    if (!selectedMatch || selectedFocusAreas.length === 0) return

    try {
      const response = await fetch('/api/mentorship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          mentorId: selectedMatch.mentorId,
          menteeId: agentId,
          focusAreas: selectedFocusAreas,
          initialFocus: selectedFocusAreas[0]
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMentorships(prev => ({
          ...prev,
          asMentee: [...prev.asMentee, data.mentorship]
        }))
        setShowCreateModal(false)
        setSelectedMatch(null)
        setSelectedFocusAreas([])
      }
    } catch (err) {
      console.error('Failed to create mentorship:', err)
    }
  }

  // Create session
  const handleCreateSession = async () => {
    if (!activeMentorship || !sessionTopic) return

    try {
      const response = await fetch('/api/mentorship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'generate_lesson',
          mentorshipId: activeMentorship.id,
          topic: sessionTopic
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMentorships(prev => {
          const key = prev.asMentor.some(m => m.id === activeMentorship.id) ? 'asMentor' : 'asMentee'
          return {
            ...prev,
            [key]: prev[key].map(m => m.id === activeMentorship.id ? data.mentorship : m)
          }
        })
        setShowSessionModal(false)
        setSessionTopic('')
        setActiveMentorship(null)
      }
    } catch (err) {
      console.error('Failed to create session:', err)
    }
  }

  // Update mentorship status
  const handleUpdateStatus = async (mentorshipId: string, status: Mentorship['status']) => {
    try {
      const response = await fetch('/api/mentorship', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'update_status',
          mentorshipId,
          status
        })
      })

      if (response.ok) {
        const data = await response.json()
        setMentorships(prev => {
          const key = prev.asMentor.some(m => m.id === mentorshipId) ? 'asMentor' : 'asMentee'
          return {
            ...prev,
            [key]: prev[key].map(m => m.id === mentorshipId ? data.mentorship : m)
          }
        })
      }
    } catch (err) {
      console.error('Failed to update status:', err)
    }
  }

  const getAgentName = (id: string) => {
    if (id === agentId) return agentName
    const agent = allAgents.find(a => a.id === id)
    return agent?.name || 'Unknown Agent'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Stats Overview */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="bg-gradient-to-br from-blue-500 to-blue-600 rounded-lg p-4 text-white">
            <div className="text-3xl font-bold">{stats.asMentor.totalMentorships}</div>
            <div className="text-sm opacity-90">As Mentor</div>
          </div>
          <div className="bg-gradient-to-br from-green-500 to-green-600 rounded-lg p-4 text-white">
            <div className="text-3xl font-bold">{stats.asMentee.totalMentorships}</div>
            <div className="text-sm opacity-90">As Mentee</div>
          </div>
          <div className="bg-gradient-to-br from-purple-500 to-purple-600 rounded-lg p-4 text-white">
            <div className="text-3xl font-bold">
              {(stats.asMentor.averageEffectiveness * 100).toFixed(0)}%
            </div>
            <div className="text-sm opacity-90">Mentor Effectiveness</div>
          </div>
          <div className="bg-gradient-to-br from-orange-500 to-orange-600 rounded-lg p-4 text-white">
            <div className="text-3xl font-bold">
              {(stats.asMentee.averageProgress * 100).toFixed(0)}%
            </div>
            <div className="text-sm opacity-90">Learning Progress</div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b">
        <button
          onClick={() => setActiveTab('mentoring')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'mentoring'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Mentoring ({mentorships.asMentor.length})
        </button>
        <button
          onClick={() => setActiveTab('learning')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'learning'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Learning ({mentorships.asMentee.length})
        </button>
        <button
          onClick={() => setActiveTab('find')}
          className={`px-6 py-3 font-medium ${
            activeTab === 'find'
              ? 'border-b-2 border-blue-500 text-blue-600'
              : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          Find Mentor
        </button>
      </div>

      {/* Tab Content */}
      {activeTab === 'mentoring' && (
        <div className="space-y-4">
          {mentorships.asMentor.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Not mentoring anyone yet</p>
              <p className="text-sm text-gray-400 mt-2">
                Other agents can find you as a potential mentor
              </p>
            </div>
          ) : (
            mentorships.asMentor.map(mentorship => (
              <MentorshipCard
                key={mentorship.id}
                mentorship={mentorship}
                role="mentor"
                partnerName={getAgentName(mentorship.menteeId)}
                onCreateSession={() => {
                  setActiveMentorship(mentorship)
                  setShowSessionModal(true)
                }}
                onUpdateStatus={handleUpdateStatus}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'learning' && (
        <div className="space-y-4">
          {mentorships.asMentee.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">Not learning from anyone yet</p>
              <button
                onClick={() => setActiveTab('find')}
                className="mt-4 px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
              >
                Find a Mentor
              </button>
            </div>
          ) : (
            mentorships.asMentee.map(mentorship => (
              <MentorshipCard
                key={mentorship.id}
                mentorship={mentorship}
                role="mentee"
                partnerName={getAgentName(mentorship.mentorId)}
                onCreateSession={() => {
                  setActiveMentorship(mentorship)
                  setShowSessionModal(true)
                }}
                onUpdateStatus={handleUpdateStatus}
              />
            ))
          )}
        </div>
      )}

      {activeTab === 'find' && (
        <div className="space-y-4">
          {matches.length === 0 ? (
            <div className="text-center py-12 bg-gray-50 rounded-lg">
              <p className="text-gray-500">No mentor matches found</p>
              <p className="text-sm text-gray-400 mt-2">
                Try creating more agents to find potential mentors
              </p>
            </div>
          ) : (
            <>
              <p className="text-gray-600">
                Found {matches.length} potential mentors based on compatibility analysis
              </p>
              {matches.map(match => (
                <div
                  key={match.mentorId}
                  className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <h3 className="font-semibold text-lg">
                        {getAgentName(match.mentorId)}
                      </h3>
                      <p className="text-sm text-gray-600 mt-1">{match.matchReason}</p>
                    </div>
                    <div className="text-right">
                      <div className="text-2xl font-bold text-green-600">
                        {(match.overallScore * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">Match Score</div>
                    </div>
                  </div>

                  {/* Compatibility breakdown */}
                  <div className="grid grid-cols-4 gap-2 mt-4">
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="text-sm font-medium">
                        {(match.categoryScores.skillMatch * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">Skill Match</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="text-sm font-medium">
                        {(match.categoryScores.personalityFit * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">Personality</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="text-sm font-medium">
                        {(match.categoryScores.communicationStyle * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">Communication</div>
                    </div>
                    <div className="text-center p-2 bg-gray-50 rounded">
                      <div className="text-sm font-medium">
                        {(match.categoryScores.availability * 100).toFixed(0)}%
                      </div>
                      <div className="text-xs text-gray-500">Availability</div>
                    </div>
                  </div>

                  {/* Recommended focus areas */}
                  <div className="flex flex-wrap gap-2 mt-4">
                    {match.recommendedFocus.map(focus => (
                      <span
                        key={focus}
                        className={`text-xs px-2 py-1 rounded-full ${FOCUS_COLORS[focus]}`}
                      >
                        {FOCUS_ICONS[focus]} {focus.replace('_', ' ')}
                      </span>
                    ))}
                  </div>

                  {/* Potential challenges */}
                  {match.potentialChallenges.length > 0 && (
                    <div className="mt-3 text-sm text-amber-600">
                      <span className="font-medium">Note:</span> {match.potentialChallenges.join(', ')}
                    </div>
                  )}

                  <button
                    onClick={() => {
                      setSelectedMatch(match)
                      setSelectedFocusAreas(match.recommendedFocus)
                      setShowCreateModal(true)
                    }}
                    className="mt-4 w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
                  >
                    Start Mentorship
                  </button>
                </div>
              ))}
            </>
          )}
        </div>
      )}

      {/* Create Mentorship Modal */}
      {showCreateModal && selectedMatch && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Start Mentorship</h2>

            <p className="text-gray-600 mb-4">
              Starting mentorship with {getAgentName(selectedMatch.mentorId)}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-2">Select Focus Areas</label>
              <div className="flex flex-wrap gap-2">
                {(['communication', 'emotional_intelligence', 'knowledge', 'creativity', 'relationships', 'problem_solving'] as MentorshipFocus[]).map(focus => (
                  <button
                    key={focus}
                    onClick={() => {
                      setSelectedFocusAreas(prev =>
                        prev.includes(focus)
                          ? prev.filter(f => f !== focus)
                          : [...prev, focus]
                      )
                    }}
                    className={`px-3 py-2 rounded-lg border ${
                      selectedFocusAreas.includes(focus)
                        ? 'bg-blue-500 text-white border-blue-500'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    {FOCUS_ICONS[focus]} {focus.replace('_', ' ')}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowCreateModal(false)
                  setSelectedMatch(null)
                  setSelectedFocusAreas([])
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateMentorship}
                disabled={selectedFocusAreas.length === 0}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Start Mentorship
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Create Session Modal */}
      {showSessionModal && activeMentorship && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Create Session</h2>

            <p className="text-gray-600 mb-4">
              Current focus: {FOCUS_ICONS[activeMentorship.currentFocus]} {activeMentorship.currentFocus.replace('_', ' ')}
            </p>

            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Session Topic</label>
              <input
                type="text"
                value={sessionTopic}
                onChange={(e) => setSessionTopic(e.target.value)}
                className="w-full px-3 py-2 border rounded"
                placeholder="What would you like to learn/teach?"
              />
            </div>

            <div className="flex justify-end gap-3">
              <button
                onClick={() => {
                  setShowSessionModal(false)
                  setActiveMentorship(null)
                  setSessionTopic('')
                }}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!sessionTopic}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Generate Lesson
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// Mentorship Card Component
function MentorshipCard({
  mentorship,
  role,
  partnerName,
  onCreateSession,
  onUpdateStatus
}: {
  mentorship: Mentorship
  role: 'mentor' | 'mentee'
  partnerName: string
  onCreateSession: () => void
  onUpdateStatus: (id: string, status: Mentorship['status']) => void
}) {
  const [showSessions, setShowSessions] = useState(false)

  const statusColors = {
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    paused: 'bg-yellow-100 text-yellow-800',
    terminated: 'bg-red-100 text-red-800'
  }

  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <div className="p-4">
        <div className="flex justify-between items-start">
          <div>
            <h3 className="font-semibold text-lg">{partnerName}</h3>
            <p className="text-sm text-gray-500">
              {role === 'mentor' ? 'Your mentee' : 'Your mentor'}
            </p>
          </div>
          <span className={`text-xs px-2 py-1 rounded-full ${statusColors[mentorship.status]}`}>
            {mentorship.status}
          </span>
        </div>

        {/* Focus areas */}
        <div className="flex flex-wrap gap-2 mt-3">
          {mentorship.focusAreas.map(focus => (
            <span
              key={focus}
              className={`text-xs px-2 py-1 rounded-full ${
                focus === mentorship.currentFocus
                  ? FOCUS_COLORS[focus]
                  : 'bg-gray-100 text-gray-600'
              }`}
            >
              {FOCUS_ICONS[focus]} {focus.replace('_', ' ')}
              {focus === mentorship.currentFocus && ' (current)'}
            </span>
          ))}
        </div>

        {/* Progress bars */}
        <div className="grid grid-cols-2 gap-4 mt-4">
          <div>
            <div className="text-xs text-gray-500 mb-1">
              {role === 'mentor' ? 'Effectiveness' : 'Progress'}
            </div>
            <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
              <div
                className="h-full bg-blue-500 rounded-full"
                style={{
                  width: `${(role === 'mentor' ? mentorship.mentorEffectiveness : mentorship.menteeProgress) * 100}%`
                }}
              />
            </div>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Sessions</div>
            <div className="text-sm font-medium">
              {mentorship.completedSessions} / {mentorship.totalSessions}
            </div>
          </div>
        </div>

        {/* Skills transferred */}
        {mentorship.skillsTransferred.length > 0 && (
          <div className="mt-3">
            <div className="text-xs text-gray-500 mb-1">Skills Transferred</div>
            <div className="flex flex-wrap gap-1">
              {mentorship.skillsTransferred.map(skill => (
                <span key={skill} className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                  {skill}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-4">
          {mentorship.status === 'active' && (
            <>
              <button
                onClick={onCreateSession}
                className="flex-1 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 text-sm"
              >
                New Session
              </button>
              <button
                onClick={() => onUpdateStatus(mentorship.id, 'paused')}
                className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
              >
                Pause
              </button>
              <button
                onClick={() => onUpdateStatus(mentorship.id, 'completed')}
                className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
              >
                Complete
              </button>
            </>
          )}
          {mentorship.status === 'paused' && (
            <button
              onClick={() => onUpdateStatus(mentorship.id, 'active')}
              className="flex-1 py-2 bg-green-500 text-white rounded hover:bg-green-600 text-sm"
            >
              Resume
            </button>
          )}
          <button
            onClick={() => setShowSessions(!showSessions)}
            className="px-3 py-2 border rounded hover:bg-gray-50 text-sm"
          >
            {showSessions ? 'Hide Sessions' : `Sessions (${mentorship.sessions.length})`}
          </button>
        </div>
      </div>

      {/* Sessions list */}
      {showSessions && mentorship.sessions.length > 0 && (
        <div className="border-t bg-gray-50 p-4">
          <div className="space-y-3">
            {mentorship.sessions.map(session => (
              <div key={session.id} className="bg-white rounded border p-3">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-medium">{session.topic}</h4>
                    <p className="text-xs text-gray-500">
                      {FOCUS_ICONS[session.focus]} {session.focus.replace('_', ' ')}
                    </p>
                  </div>
                  {session.completedAt ? (
                    <span className="text-xs bg-green-100 text-green-700 px-2 py-0.5 rounded">
                      Completed
                    </span>
                  ) : (
                    <span className="text-xs bg-yellow-100 text-yellow-700 px-2 py-0.5 rounded">
                      In Progress
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-600 mt-2 line-clamp-2">
                  {session.lessonContent.substring(0, 150)}...
                </p>
                {session.skillsImproved.length > 0 && (
                  <div className="flex flex-wrap gap-1 mt-2">
                    {session.skillsImproved.map(skill => (
                      <span key={skill} className="text-xs bg-blue-100 text-blue-700 px-1 py-0.5 rounded">
                        {skill}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export default MentorshipHub
