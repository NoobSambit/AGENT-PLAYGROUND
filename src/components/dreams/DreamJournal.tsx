'use client'

/**
 * Dream Journal Component - Phase 2
 *
 * Displays an agent's dreams with symbolism analysis.
 */

import React, { useState, useEffect, useCallback } from 'react'
import { Dream, DreamType, DreamSymbol } from '@/types/database'

interface DreamJournalProps {
  agentId: string
  agentName: string
}

const DREAM_ICONS: Record<DreamType, string> = {
  adventure: '🗺️',
  nightmare: '😱',
  memory_replay: '🔄',
  symbolic: '🔮',
  prophetic: '👁️',
  lucid: '✨',
  recurring: '🔁',
}

export function DreamJournal({ agentId, agentName }: DreamJournalProps) {
  const [dreams, setDreams] = useState<Dream[]>([])
  const [stats, setStats] = useState<{
    totalDreams: number
    byType: Record<string, number>
    commonSymbols: Array<{ symbol: string; count: number }>
    commonThemes: Array<{ theme: string; count: number }>
    averageVividness: number
    nightmareRatio: number
  } | null>(null)
  const [patterns, setPatterns] = useState<{
    recurringSymbols: string[]
    recurringThemes: string[]
    emotionalPatterns: string[]
  } | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [selectedDream, setSelectedDream] = useState<Dream | null>(null)
  const [selectedType, setSelectedType] = useState<DreamType | null>(null)

  const fetchDreams = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(`/api/agents/${agentId}/dream`)
      if (response.ok) {
        const data = await response.json()
        setDreams(data.dreams)
        setStats(data.stats)
        setPatterns(data.patterns)
      }
    } catch (error) {
      console.error('Failed to fetch dreams:', error)
    } finally {
      setLoading(false)
    }
  }, [agentId])

  useEffect(() => {
    fetchDreams()
  }, [fetchDreams])

  const generateDream = async () => {
    try {
      setGenerating(true)
      const response = await fetch(`/api/agents/${agentId}/dream`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: selectedType }),
      })

      if (response.ok) {
        const data = await response.json()
        setDreams(prev => [data.dream, ...prev])
        setSelectedDream(data.dream)
      }
    } catch (error) {
      console.error('Failed to generate dream:', error)
    } finally {
      setGenerating(false)
      setSelectedType(null)
    }
  }

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    })
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h3 className="text-xl font-semibold text-white">Dream Journal</h3>
          <p className="text-gray-400 text-sm">
            {agentName}&apos;s subconscious explorations
          </p>
        </div>
        <button
          onClick={() => setSelectedType('symbolic')}
          className="bg-indigo-600 hover:bg-indigo-700 text-white px-4 py-2 rounded-lg transition-colors"
        >
          🌙 Generate Dream
        </button>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            label="Total Dreams"
            value={stats.totalDreams}
            icon="🌙"
          />
          <StatCard
            label="Vividness"
            value={`${(stats.averageVividness * 100).toFixed(0)}%`}
            icon="✨"
          />
          <StatCard
            label="Nightmares"
            value={`${(stats.nightmareRatio * 100).toFixed(0)}%`}
            icon="😱"
          />
          <StatCard
            label="Symbols Found"
            value={stats.commonSymbols.length}
            icon="🔮"
          />
        </div>
      )}

      {/* Patterns */}
      {patterns && (patterns.recurringSymbols.length > 0 || patterns.recurringThemes.length > 0) && (
        <div className="bg-gray-800 rounded-lg p-4">
          <h4 className="text-white font-semibold mb-3">Recurring Patterns</h4>
          <div className="flex flex-wrap gap-2">
            {patterns.recurringSymbols.map(symbol => (
              <span
                key={symbol}
                className="text-xs bg-indigo-600/30 text-indigo-300 px-2 py-1 rounded"
              >
                🔮 {symbol}
              </span>
            ))}
            {patterns.recurringThemes.map(theme => (
              <span
                key={theme}
                className="text-xs bg-purple-600/30 text-purple-300 px-2 py-1 rounded"
              >
                📚 {theme}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Dreams List */}
      {loading ? (
        <div className="text-center py-8 text-gray-400">Loading dreams...</div>
      ) : dreams.length === 0 ? (
        <div className="text-center py-8 text-gray-400">
          No dreams recorded yet. Generate one!
        </div>
      ) : (
        <div className="space-y-4">
          {dreams.map(dream => (
            <DreamCard
              key={dream.id}
              dream={dream}
              onClick={() => setSelectedDream(dream)}
            />
          ))}
        </div>
      )}

      {/* Dream Type Selector Modal */}
      {selectedType !== null && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
          <div className="bg-gray-800 rounded-lg p-6 max-w-md w-full mx-4">
            <h4 className="text-lg font-semibold text-white mb-4">
              Choose Dream Type
            </h4>

            <div className="grid grid-cols-2 gap-3 mb-6">
              {(Object.entries(DREAM_ICONS) as [DreamType, string][]).map(
                ([type, icon]) => (
                  <button
                    key={type}
                    onClick={() => setSelectedType(type)}
                    className={`p-3 rounded-lg text-left transition-colors ${
                      selectedType === type
                        ? 'bg-indigo-600'
                        : 'bg-gray-700 hover:bg-gray-600'
                    }`}
                  >
                    <span className="text-2xl">{icon}</span>
                    <div className="text-white capitalize mt-1">{type.replace('_', ' ')}</div>
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
                onClick={generateDream}
                disabled={generating}
                className="flex-1 bg-indigo-600 hover:bg-indigo-700 text-white py-2 rounded transition-colors disabled:opacity-50"
              >
                {generating ? 'Dreaming...' : 'Generate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Dream Detail Modal */}
      {selectedDream && (
        <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50 p-4">
          <div className="bg-gray-800 rounded-lg p-6 max-w-2xl w-full max-h-[80vh] overflow-y-auto">
            <div className="flex justify-between items-start mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-2xl">{DREAM_ICONS[selectedDream.type]}</span>
                  <h4 className="text-xl font-semibold text-white">
                    {selectedDream.title}
                  </h4>
                </div>
                <div className="text-sm text-gray-400">
                  {selectedDream.type.replace('_', ' ')} dream • {formatDate(selectedDream.createdAt)}
                </div>
              </div>
              <button
                onClick={() => setSelectedDream(null)}
                className="text-gray-400 hover:text-white text-2xl"
              >
                ✕
              </button>
            </div>

            {/* Narrative */}
            <div className="prose prose-invert max-w-none mb-6">
              <div className="whitespace-pre-wrap text-gray-300">
                {selectedDream.narrative}
              </div>
            </div>

            {/* Symbols */}
            {selectedDream.symbols.length > 0 && (
              <div className="mb-6">
                <h5 className="text-white font-semibold mb-3">Dream Symbols</h5>
                <div className="space-y-2">
                  {selectedDream.symbols.map((symbol, i) => (
                    <SymbolCard key={i} symbol={symbol} />
                  ))}
                </div>
              </div>
            )}

            {/* Themes */}
            {selectedDream.themes.length > 0 && (
              <div className="mb-6">
                <h5 className="text-white font-semibold mb-2">Themes</h5>
                <div className="flex flex-wrap gap-2">
                  {selectedDream.themes.map(theme => (
                    <span
                      key={theme}
                      className="text-xs bg-gray-700 text-gray-300 px-2 py-1 rounded"
                    >
                      {theme}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Hidden Meanings */}
            {selectedDream.hiddenMeanings.length > 0 && (
              <div className="mb-6">
                <h5 className="text-white font-semibold mb-2">Analysis</h5>
                <ul className="text-gray-400 text-sm space-y-1">
                  {selectedDream.hiddenMeanings.map((meaning, i) => (
                    <li key={i}>• {meaning}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Emotional Processing */}
            {selectedDream.emotionalProcessing && (
              <div className="bg-indigo-900/30 rounded-lg p-4 mb-6">
                <div className="text-indigo-300 text-sm">
                  💭 {selectedDream.emotionalProcessing}
                </div>
              </div>
            )}

            {/* Quality Metrics */}
            <div className="grid grid-cols-3 gap-4 text-center border-t border-gray-700 pt-4">
              <QualityMeter label="Vividness" value={selectedDream.vividness} />
              <QualityMeter label="Lucidity" value={selectedDream.lucidity} />
              <QualityMeter label="Coherence" value={selectedDream.coherence} />
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

function DreamCard({
  dream,
  onClick,
}: {
  dream: Dream
  onClick: () => void
}) {
  return (
    <div
      onClick={onClick}
      className="bg-gray-800 rounded-lg p-4 hover:bg-gray-750 transition-colors cursor-pointer"
    >
      <div className="flex items-start gap-3">
        <span className="text-3xl">{DREAM_ICONS[dream.type]}</span>
        <div className="flex-1">
          <h5 className="font-semibold text-white mb-1">{dream.title}</h5>
          <p className="text-gray-400 text-sm line-clamp-2">{dream.narrative}</p>

          <div className="flex gap-2 mt-2 flex-wrap">
            {dream.symbols.slice(0, 3).map((symbol, i) => (
              <span
                key={i}
                className="text-xs bg-indigo-600/30 text-indigo-300 px-2 py-0.5 rounded"
              >
                {symbol.symbol}
              </span>
            ))}
            {dream.symbols.length > 3 && (
              <span className="text-xs text-gray-500">
                +{dream.symbols.length - 3} more
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

function SymbolCard({ symbol }: { symbol: DreamSymbol }) {
  return (
    <div className="bg-gray-700 rounded-lg p-3">
      <div className="flex justify-between items-start">
        <span className="font-medium text-white capitalize">{symbol.symbol}</span>
        <span className="text-xs text-gray-400">{symbol.emotionalAssociation}</span>
      </div>
      <p className="text-gray-400 text-sm mt-1">{symbol.meaning}</p>
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
          className="bg-indigo-500 h-1.5 rounded-full"
          style={{ width: `${value * 100}%` }}
        />
      </div>
    </div>
  )
}
