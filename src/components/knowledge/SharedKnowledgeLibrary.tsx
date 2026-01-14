'use client'

import { useState, useEffect } from 'react'
import { SharedKnowledge, KnowledgeCategory } from '@/types/database'

interface SharedKnowledgeLibraryProps {
  agentId?: string
  agentName?: string
  showContribute?: boolean
}

const CATEGORY_ICONS: Record<KnowledgeCategory, string> = {
  fact: '📚',
  opinion: '💭',
  theory: '🔬',
  experience: '✨',
  skill: '🛠️',
  wisdom: '🌟'
}

const CATEGORY_COLORS: Record<KnowledgeCategory, string> = {
  fact: 'bg-blue-100 text-blue-800',
  opinion: 'bg-purple-100 text-purple-800',
  theory: 'bg-green-100 text-green-800',
  experience: 'bg-orange-100 text-orange-800',
  skill: 'bg-red-100 text-red-800',
  wisdom: 'bg-yellow-100 text-yellow-800'
}

export function SharedKnowledgeLibrary({
  agentId,
  agentName,
  showContribute = true
}: SharedKnowledgeLibraryProps) {
  const [knowledge, setKnowledge] = useState<SharedKnowledge[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | 'all'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'confidence'>('confidence')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [stats, setStats] = useState<{
    total: number
    byCategory: Record<KnowledgeCategory, number>
    averageConfidence: number
  } | null>(null)

  // Form state for creating new knowledge
  const [newKnowledge, setNewKnowledge] = useState({
    topic: '',
    category: 'fact' as KnowledgeCategory,
    content: '',
    tags: ''
  })

  // Fetch knowledge
  useEffect(() => {
    async function fetchKnowledge() {
      try {
        setLoading(true)

        // Build query params
        const params = new URLSearchParams()
        if (searchQuery) params.set('search', searchQuery)
        if (selectedCategory !== 'all') params.set('category', selectedCategory)
        if (sortBy === 'recent') params.set('recent', 'true')
        if (sortBy === 'popular') params.set('popular', 'true')

        const response = await fetch(`/api/knowledge?${params}`)

        if (!response.ok) {
          throw new Error('Failed to fetch knowledge')
        }

        const data = await response.json()
        setKnowledge(data.knowledge || [])

        // Also fetch stats
        const statsResponse = await fetch('/api/knowledge?stats=true')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData.stats)
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        setLoading(false)
      }
    }

    fetchKnowledge()
  }, [searchQuery, selectedCategory, sortBy])

  // Handle endorsement
  const handleEndorse = async (knowledgeId: string) => {
    if (!agentId) return

    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'endorse',
          knowledgeId,
          agentId
        })
      })

      if (response.ok) {
        const data = await response.json()
        setKnowledge(prev =>
          prev.map(k => k.id === knowledgeId ? data.knowledge : k)
        )
      }
    } catch (err) {
      console.error('Failed to endorse:', err)
    }
  }

  // Handle dispute
  const handleDispute = async (knowledgeId: string, reason: string) => {
    if (!agentId) return

    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'dispute',
          knowledgeId,
          agentId,
          reason
        })
      })

      if (response.ok) {
        const data = await response.json()
        setKnowledge(prev =>
          prev.map(k => k.id === knowledgeId ? data.knowledge : k)
        )
      }
    } catch (err) {
      console.error('Failed to dispute:', err)
    }
  }

  // Create new knowledge
  const handleCreate = async () => {
    if (!agentId || !agentName) return

    try {
      const response = await fetch('/api/knowledge', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          topic: newKnowledge.topic,
          category: newKnowledge.category,
          content: newKnowledge.content,
          contributorId: agentId,
          contributorName: agentName,
          tags: newKnowledge.tags.split(',').map(t => t.trim()).filter(Boolean)
        })
      })

      if (response.ok) {
        const data = await response.json()
        setKnowledge(prev => [data.knowledge, ...prev])
        setShowCreateModal(false)
        setNewKnowledge({ topic: '', category: 'fact', content: '', tags: '' })
      }
    } catch (err) {
      console.error('Failed to create knowledge:', err)
    }
  }

  // Filter and sort knowledge
  const displayedKnowledge = knowledge
    .filter(k => {
      if (selectedCategory !== 'all' && k.category !== selectedCategory) return false
      return true
    })
    .sort((a, b) => {
      if (sortBy === 'recent') {
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      }
      if (sortBy === 'popular') {
        return b.accessCount - a.accessCount
      }
      return b.confidence - a.confidence
    })

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
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-blue-600">{stats.total}</div>
            <div className="text-sm text-gray-500">Total Knowledge</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-green-600">
              {(stats.averageConfidence * 100).toFixed(0)}%
            </div>
            <div className="text-sm text-gray-500">Avg Confidence</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-purple-600">
              {Object.values(stats.byCategory).reduce((a, b) => a + b, 0)}
            </div>
            <div className="text-sm text-gray-500">Categories Used</div>
          </div>
          <div className="bg-white rounded-lg border p-4">
            <div className="text-2xl font-bold text-orange-600">
              {knowledge.filter(k => k.endorsements.length > 2).length}
            </div>
            <div className="text-sm text-gray-500">Well-Endorsed</div>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-wrap gap-4 items-center">
        <input
          type="text"
          placeholder="Search knowledge..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="px-4 py-2 border rounded-lg flex-1 min-w-[200px]"
        />

        <select
          value={selectedCategory}
          onChange={(e) => setSelectedCategory(e.target.value as KnowledgeCategory | 'all')}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="all">All Categories</option>
          <option value="fact">Facts</option>
          <option value="opinion">Opinions</option>
          <option value="theory">Theories</option>
          <option value="experience">Experiences</option>
          <option value="skill">Skills</option>
          <option value="wisdom">Wisdom</option>
        </select>

        <select
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value as 'recent' | 'popular' | 'confidence')}
          className="px-4 py-2 border rounded-lg"
        >
          <option value="confidence">By Confidence</option>
          <option value="popular">Most Popular</option>
          <option value="recent">Most Recent</option>
        </select>

        {showContribute && agentId && (
          <button
            onClick={() => setShowCreateModal(true)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600"
          >
            + Contribute
          </button>
        )}
      </div>

      {/* Knowledge Grid */}
      {displayedKnowledge.length === 0 ? (
        <div className="text-center py-12 text-gray-500">
          <p className="text-lg">No knowledge found</p>
          <p className="text-sm mt-2">
            {searchQuery ? 'Try a different search term' : 'Be the first to contribute!'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {displayedKnowledge.map(item => (
            <div key={item.id} className="bg-white rounded-lg border p-4 hover:shadow-md transition-shadow">
              <div className="flex items-start justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-2xl">{CATEGORY_ICONS[item.category]}</span>
                  <span className={`text-xs px-2 py-1 rounded-full ${CATEGORY_COLORS[item.category]}`}>
                    {item.category}
                  </span>
                </div>
                <div className="text-right">
                  <div className="text-sm font-medium text-green-600">
                    {(item.confidence * 100).toFixed(0)}% confidence
                  </div>
                  <div className="text-xs text-gray-500">
                    {item.accessCount} views
                  </div>
                </div>
              </div>

              <h3 className="font-semibold mt-3">{item.topic}</h3>
              <p className="text-gray-600 text-sm mt-2 line-clamp-3">{item.content}</p>

              {item.tags.length > 0 && (
                <div className="flex flex-wrap gap-1 mt-3">
                  {item.tags.map(tag => (
                    <span
                      key={tag}
                      className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="flex items-center justify-between mt-4 pt-4 border-t">
                <div className="text-sm text-gray-500">
                  By {item.contributorName}
                </div>
                <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-500">
                    {item.endorsements.length} endorsements
                  </span>
                  {item.disputes.length > 0 && (
                    <span className="text-sm text-red-500">
                      {item.disputes.length} disputes
                    </span>
                  )}
                  {agentId && !item.endorsements.includes(agentId) && (
                    <button
                      onClick={() => handleEndorse(item.id)}
                      className="text-xs px-2 py-1 bg-green-100 text-green-700 rounded hover:bg-green-200"
                    >
                      Endorse
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-lg w-full mx-4">
            <h2 className="text-xl font-bold mb-4">Contribute Knowledge</h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Topic</label>
                <input
                  type="text"
                  value={newKnowledge.topic}
                  onChange={(e) => setNewKnowledge(prev => ({ ...prev, topic: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="What is this about?"
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Category</label>
                <select
                  value={newKnowledge.category}
                  onChange={(e) => setNewKnowledge(prev => ({ ...prev, category: e.target.value as KnowledgeCategory }))}
                  className="w-full px-3 py-2 border rounded"
                >
                  <option value="fact">Fact - Verified information</option>
                  <option value="opinion">Opinion - Personal viewpoint</option>
                  <option value="theory">Theory - Hypothesis or idea</option>
                  <option value="experience">Experience - Personal experience</option>
                  <option value="skill">Skill - How to do something</option>
                  <option value="wisdom">Wisdom - Life lesson or insight</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <textarea
                  value={newKnowledge.content}
                  onChange={(e) => setNewKnowledge(prev => ({ ...prev, content: e.target.value }))}
                  className="w-full px-3 py-2 border rounded h-32"
                  placeholder="Share your knowledge..."
                />
              </div>

              <div>
                <label className="block text-sm font-medium mb-1">Tags (comma separated)</label>
                <input
                  type="text"
                  value={newKnowledge.tags}
                  onChange={(e) => setNewKnowledge(prev => ({ ...prev, tags: e.target.value }))}
                  className="w-full px-3 py-2 border rounded"
                  placeholder="science, learning, tips"
                />
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-6">
              <button
                onClick={() => setShowCreateModal(false)}
                className="px-4 py-2 border rounded hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={!newKnowledge.topic || !newKnowledge.content}
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600 disabled:opacity-50"
              >
                Contribute
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SharedKnowledgeLibrary
