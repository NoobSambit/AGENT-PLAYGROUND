'use client'

/**
 * Journal Viewer Component - Phase 2
 *
 * Displays an agent's journal entries with filtering and insights.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { JournalEntry, JournalEntryType, JournalMood } from '@/types/database'

interface JournalViewerProps {
  agentId: string
  agentName: string
}

const TYPE_ICONS: Record<JournalEntryType, string> = {
  daily_reflection: '📔',
  emotional_processing: '💭',
  goal_review: '🎯',
  relationship_thoughts: '👥',
  creative_musings: '🎨',
  philosophical_pondering: '🤔',
  memory_recap: '🧠',
  future_plans: '🔮',
}

const MOOD_ICONS: Record<JournalMood, string> = {
  contemplative: '🌊',
  excited: '⚡',
  melancholic: '🌧️',
  grateful: '🙏',
  anxious: '😰',
  hopeful: '🌅',
  nostalgic: '📷',
  determined: '💪',
}

export function JournalViewer({ agentId, agentName }: JournalViewerProps) {
  const [entries, setEntries] = useState<JournalEntry[]>([])
  const [stats, setStats] = useState<{
    totalEntries: number
    byType: Record<string, number>
    byMood: Record<string, number>
    averageWordCount: number
    streakDays: number
  } | null>(null)
  const [insights, setInsights] = useState<{
    allInsights: string[]
    allQuestions: string[]
    allGoals: string[]
    allGratitudes: string[]
    emotionalTrend: string
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [writing, setWriting] = useState(false)
  const [selectedEntry, setSelectedEntry] = useState<JournalEntry | null>(null)
  const [selectedType, setSelectedType] = useState<JournalEntryType | null>(null)
  const [filterType, setFilterType] = useState<JournalEntryType | 'all'>('all')

  const fetchEntries = useCallback(async () => {
    try {
      setLoading(true)
      const url = filterType === 'all'
        ? `/api/agents/${agentId}/journal`
        : `/api/agents/${agentId}/journal?type=${filterType}`

      const response = await fetch(url)
      if (response.ok) {
        const data = await response.json()
        setEntries(data.entries)
        setStats(data.stats)
        setInsights(data.insights)
      }
    } catch (error) {
      console.error('Failed to fetch journal entries:', error)
    } finally {
      setLoading(false)
    }
  }, [agentId, filterType])

  useEffect(() => {
    fetchEntries()
  }, [fetchEntries])

  const writeEntry = async () => {
    try {
      setWriting(true)
      const response = await fetch(`/api/agents/${agentId}/journal`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType }),
      })

      if (response.ok) {
        const data = await response.json()
        setEntries(prev => [data.entry, ...prev])
        setSelectedEntry(data.entry)
      }
    } catch (error) {
      console.error('Failed to write journal entry:', error)
    } finally {
      setWriting(false)
      setSelectedType(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
    })
  }

  const formatTime = (dateStr: string) => {
    return new Date(dateStr).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Journal</h3>
          <p className="text-gray-400 text-sm">
            {agentName}&apos;s personal reflections
          </p>
        </div>
        <button
          onClick={() => setSelectedType('daily_reflection')}
          className="bg-amber-600 hover:bg-amber-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          📝 Write Entry
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Total Entries"
            value={stats.totalEntries}
            icon="📔"
          />
          <StatCard
            label="Streak"
            value={`${stats.streakDays} days`}
            icon="🔥"
          />
          <StatCard
            label="Avg. Length"
            value={`${stats.averageWordCount} words`}
            icon="📊"
          />
          <StatCard
            label="Trend"
            value={insights?.emotionalTrend || 'stable'}
            icon={insights?.emotionalTrend === 'improving' ? '📈' : insights?.emotionalTrend === 'challenging' ? '📉' : '➡️'}
          />
        </div>
      )}

      {/* Insights Panel */}
      {insights && (insights.allInsights.length > 0 || insights.allGoals.length > 0) && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-3">Recent Insights</h4>
          <div className="space-y-3">
            {insights.allInsights.slice(0, 3).map((insight, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span>💡</span>
                <span className="text-gray-300">{insight}</span>
              </div>
            ))}
            {insights.allGoals.slice(0, 2).map((goal, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                <span>🎯</span>
                <span className="text-gray-300">{goal}</span>
              </div>
            ))}
          </div>
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
            onClick={() => setFilterType(type as JournalEntryType)}
          >
            {icon} {type.split('_').map(w => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')}
          </FilterButton>
        ))}
      </div>

      {/* Entries List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading entries...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No journal entries yet. Start writing!
        </div>
      ) : (
        <div className="space-y-4">
          {entries.map(entry => (
            <EntryCard
              key={entry.id}
              entry={entry}
              onClick={() => setSelectedEntry(entry)}
            />
          ))}
        </div>
      )}

      {/* Entry Type Selector Modal */}
      {selectedType !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-lg w-full mx-4">
            <h4 className="text-lg font-semibold text-white mb-4">
              Choose Entry Type
            </h4>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {(Object.entries(TYPE_ICONS) as [JournalEntryType, string][]).map(
                ([type, icon]) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`p-3 rounded-lg text-left transition-colors ${
                      selectedType === type
                        ? 'bg-amber-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <div className="text-white text-sm mt-1 capitalize">
                      {type.replace(/_/g, ' ')}
                    </div>
                  </button>
                )
              )}
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => setSelectedType(null)}
                className="flex-1 bg-gray-600 hover:bg-gray-500 text-white py-2 rounded transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={writeEntry}
                disabled={writing}
                className="flex-1 bg-amber-600 hover:bg-amber-700 text-white py-2 rounded transition-colors disabled:opacity-50"
              >
                {writing ? 'Writing...' : 'Write Entry'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Entry Detail Modal */}
      {selectedEntry && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{TYPE_ICONS[selectedEntry.type]}</span>
                  <span className="text-2xl">{MOOD_ICONS[selectedEntry.mood]}</span>
                  <h4 className="text-xl font-semibold text-white">
                    {selectedEntry.title}
                  </h4>
                </div>
                <div className="text-sm text-gray-400">
                  {formatDate(selectedEntry.createdAt)} at {formatTime(selectedEntry.createdAt)}
                </div>
              </div>
              <button
                onClick={() => setSelectedEntry(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Content */}
            <div className="prose prose-invert max-w-none mb-6">
              <div className="whitespace-pre-wrap text-gray-300">
                {selectedEntry.content}
              </div>
            </div>

            {/* Insights */}
            {selectedEntry.insights.length > 0 && (
              <div className="mb-4">
                <h5 className="text-white font-semibold mb-2">💡 Insights</h5>
                <ul className="text-gray-400 text-sm space-y-1">
                  {selectedEntry.insights.map((insight, i) => (
                    <li key={i}>• {insight}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Goals */}
            {selectedEntry.goals.length > 0 && (
              <div className="mb-4">
                <h5 className="text-white font-semibold mb-2">🎯 Goals</h5>
                <ul className="text-gray-400 text-sm space-y-1">
                  {selectedEntry.goals.map((goal, i) => (
                    <li key={i}>• {goal}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Gratitudes */}
            {selectedEntry.gratitudes.length > 0 && (
              <div className="mb-4">
                <h5 className="text-white font-semibold mb-2">🙏 Gratitudes</h5>
                <ul className="text-gray-400 text-sm space-y-1">
                  {selectedEntry.gratitudes.map((gratitude, i) => (
                    <li key={i}>• {gratitude}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Questions */}
            {selectedEntry.questions.length > 0 && (
              <div className="mb-4">
                <h5 className="text-white font-semibold mb-2">❓ Questions</h5>
                <ul className="text-gray-400 text-sm space-y-1">
                  {selectedEntry.questions.map((question, i) => (
                    <li key={i}>• {question}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Themes */}
            {selectedEntry.themes.length > 0 && (
              <div className="flex gap-2 flex-wrap border-t border-gray-700 pt-4">
                {selectedEntry.themes.map(theme => (
                  <span
                    key={theme}
                    className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                  >
                    {theme}
                  </span>
                ))}
              </div>
            )}
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
      <div className="text-xl font-bold text-white capitalize">{value}</div>
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
          ? 'bg-amber-600 text-white'
          : 'bg-gray-700 text-gray-300 hover:bg-gray-600'
      }`}
    >
      {children}
    </button>
  )
}

function EntryCard({
  entry,
  onClick,
}: {
  entry: JournalEntry
  onClick: () => void
}) {
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    })
  }

  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between mb-2">
        <div className="flex items-center gap-2">
          <span className="text-xl">{TYPE_ICONS[entry.type]}</span>
          <span className="text-xl">{MOOD_ICONS[entry.mood]}</span>
          <h5 className="font-semibold text-white">{entry.title}</h5>
        </div>
        <span className="text-xs text-gray-500">{formatDate(entry.createdAt)}</span>
      </div>
      <p className="text-gray-400 text-sm line-clamp-3">{entry.content}</p>
      <div className="flex justify-between items-center mt-3 text-xs text-gray-500">
        <span>{entry.wordCount} words</span>
        <span className="capitalize">{entry.mood}</span>
      </div>
    </div>
  )
}
