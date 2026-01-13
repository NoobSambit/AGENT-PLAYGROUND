'use client'

/**
 * Creative Portfolio Component - Phase 2
 *
 * Displays an agent's creative works with filtering and details.
 */

import React, { useState, useEffect } from 'react'
import { CreativeWork, CreativeWorkType, CreativeWorkStyle } from '@/types/database'

interface CreativePortfolioProps {
  agentId: string
  agentName: string
}

const TYPE_ICONS: Record<CreativeWorkType, string> = {
  story: '📖',
  poem: '📜',
  song: '🎵',
  essay: '📝',
  joke: '😄',
  dialogue: '💬',
  recipe: '🍳',
  advice: '💡',
  analysis: '🔍',
  review: '⭐',
}

export function CreativePortfolio({ agentId, agentName }: CreativePortfolioProps) {
  const [works, setWorks] = useState<CreativeWork[]>([])
  const [stats, setStats] = useState<{
    totalWorks: number
    byType: Record<string, number>
    averageQuality: number
    favorites: number
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [selectedWork, setSelectedWork] = useState<CreativeWork | null>(null)
  const [filterType, setFilterType] = useState<CreativeWorkType | 'all'>('all')

  // Generation form state
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [newType, setNewType] = useState<CreativeWorkType>('story')
  const [newStyle, setNewStyle] = useState<CreativeWorkStyle>('inspirational')
  const [newPrompt, setNewPrompt] = useState('')

  useEffect(() => {
    fetchWorks()
  }, [agentId, filterType])

  const fetchWorks = async () => {
    try {
      setLoading(true)
      const url = filterType === 'all'
        ? `/api/agents/${agentId}/creative`
        : `/api/agents/${agentId}/creative?type=${filterType}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setWorks(data.works)
        setStats(data.stats)
      }
    } catch (error) {
      console.error('Failed to fetch creative works:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    try {
      setCreating(true)
      const response = await fetch(`/api/agents/${agentId}/creative`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: newType,
          style: newStyle,
          prompt: newPrompt || undefined,
        }),
      })

      if (response.ok) {
        const data = await response.json()
        setWorks(prev => [data.creativeWork, ...prev])
        setSelectedWork(data.creativeWork)
        setShowCreateForm(false)
        setNewPrompt('')
      }
    } catch (error) {
      console.error('Failed to create work:', error)
    } finally {
      setCreating(false)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Creative Portfolio</h3>
          <p className="text-gray-400 text-sm">
            {agentName}&apos;s creative works and expressions
          </p>
        </div>
        <button
          onClick={() => setShowCreateForm(true)}
          className="bg-purple-600 hover:bg-purple-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          ✨ Create New
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard label="Total Works" value={stats.totalWorks} icon="📚" />
          <StatCard label="Favorites" value={stats.favorites} icon="⭐" />
          <StatCard
            label="Quality"
            value={`${(stats.averageQuality * 100).toFixed(0)}%`}
            icon="💎"
          />
          <StatCard
            label="Most Common"
            value={Object.entries(stats.byType)
              .sort((a, b) => b[1] - a[1])[0]?.[0] || 'None'}
            icon="📊"
          />
        </div>
      )}

      {/* Filter */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        <FilterButton
          active={filterType === 'all'}
          onClick={() => setFilterType('all')}
        >
          All
        </FilterButton>
        {Object.entries(TYPE_ICONS).map(([type, icon]) => (
          <FilterButton
            key={type}
            active={filterType === type}
            onClick={() => setFilterType(type as CreativeWorkType)}
          >
            {icon} {type}
          </FilterButton>
        ))}
      </div>

      {/* Works Grid */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading works...</div>
      ) : works.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No creative works yet. Create something!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {works.map(work => (
            <WorkCard
              key={work.id}
              work={work}
              onClick={() => setSelectedWork(work)}
            />
          ))}
        </div>
      )}

      {/* Create Form Modal */}
      {showCreateForm && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold text-white mb-4">Create New Work</h4>

            <div className="space-y-4">
              <div>
                <label className="text-sm text-gray-400 block mb-1">Type</label>
                <select
                  value={newType}
                  onChange={e => setNewType(e.target.value as CreativeWorkType)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                >
                  {Object.entries(TYPE_ICONS).map(([type, icon]) => (
                    <option key={type} value={type}>
                      {icon} {type.charAt(0).toUpperCase() + type.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">Style</label>
                <select
                  value={newStyle}
                  onChange={e => setNewStyle(e.target.value as CreativeWorkStyle)}
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white"
                >
                  {['dramatic', 'comedic', 'romantic', 'mysterious', 'philosophical', 'inspirational', 'satirical', 'melancholic'].map(style => (
                    <option key={style} value={style}>
                      {style.charAt(0).toUpperCase() + style.slice(1)}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-sm text-gray-400 block mb-1">
                  Prompt (optional)
                </label>
                <textarea
                  value={newPrompt}
                  onChange={e => setNewPrompt(e.target.value)}
                  placeholder="Give the agent a specific topic or theme..."
                  className="w-full bg-gray-700 rounded px-3 py-2 text-white h-24 resize-none"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowCreateForm(false)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreate}
                disabled={creating}
                className="flex-1 bg-purple-600 hover:bg-purple-700 text-white py-2 rounded transition-colors disabled:opacity-50"
              >
                {creating ? 'Creating...' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Work Detail Modal */}
      {selectedWork && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{TYPE_ICONS[selectedWork.type]}</span>
                  <h4 className="text-xl font-semibold text-white">
                    {selectedWork.title}
                  </h4>
                </div>
                <div className="text-sm text-gray-400">
                  {selectedWork.style} • {formatDate(selectedWork.createdAt)}
                </div>
              </div>
              <button
                onClick={() => setSelectedWork(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            <div className="prose prose-invert max-w-none mb-4">
              <div className="whitespace-pre-wrap text-gray-300">
                {selectedWork.content}
              </div>
            </div>

            {selectedWork.themes.length > 0 && (
              <div className="flex gap-2 flex-wrap mb-4">
                {selectedWork.themes.map(theme => (
                  <span
                    key={theme}
                    className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}

            <div className="grid grid-cols-3 gap-4 text-center border-t border-gray-700 pt-4">
              <QualityMeter label="Creativity" value={selectedWork.creativity} />
              <QualityMeter label="Coherence" value={selectedWork.coherence} />
              <QualityMeter label="Emotion" value={selectedWork.emotionalDepth} />
            </div>
          </div>
        </div>
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

function FilterButton({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      onClick={onClick}
      className={`px-3 py-1.5 rounded-full text-sm whitespace-nowrap transition-colors ${
        active
          ? 'bg-purple-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  )
}

function WorkCard({
  work,
  onClick,
}: {
  work: CreativeWork
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{TYPE_ICONS[work.type]}</span>
          <h5 className="font-semibold text-white line-clamp-1">{work.title}</h5>
        </div>
        {work.isFavorite && <span>⭐</span>}
      </div>
      <p className="text-gray-400 text-sm line-clamp-3 mb-3">{work.content}</p>
      <div className="flex justify-between items-center text-xs text-gray-500">
        <span className="capitalize">{work.style}</span>
        <span>{work.wordCount} words</span>
      </div>
    </div>
  )
}

function QualityMeter({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="text-sm text-gray-400 mb-1">{label}</div>
      <div className="text-lg font-bold text-white">
        {(value * 100).toFixed(0)}%
      </div>
      <div className="w-full bg-gray-700 rounded-full h-1.5 mt-1">
        <div
          className="bg-purple-500 h-1.5 rounded-full"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  )
}
