'use client'

import { useEffect, useState } from 'react'
import { SharedKnowledge, KnowledgeCategory } from '@/types/database'
import { Input, Textarea } from '@/components/ui/input'
import { Plus, Search, X } from 'lucide-react'

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
  fact: 'bg-blue-500/15 text-blue-600 dark:text-blue-300',
  opinion: 'bg-primary/15 text-primary',
  theory: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-300',
  experience: 'bg-amber-500/15 text-amber-600 dark:text-amber-300',
  skill: 'bg-rose-500/15 text-rose-600 dark:text-rose-300',
  wisdom: 'bg-yellow-500/15 text-yellow-700 dark:text-yellow-300'
}

const panelClass = 'rounded-[1.6rem] border border-border/70 bg-card/[0.62] p-5 backdrop-blur-xl'

export function SharedKnowledgeLibrary({
  agentId,
  agentName,
  showContribute = true
}: SharedKnowledgeLibraryProps) {
  const [knowledge, setKnowledge] = useState<SharedKnowledge[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<KnowledgeCategory | 'all'>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'popular' | 'confidence'>('confidence')
  const [showCreateModal, setShowCreateModal] = useState(false)
  const [stats, setStats] = useState<{
    total: number
    byCategory: Record<KnowledgeCategory, number>
    averageConfidence: number
  } | null>(null)
  const [newKnowledge, setNewKnowledge] = useState({
    topic: '',
    category: 'fact' as KnowledgeCategory,
    content: '',
    tags: ''
  })

  useEffect(() => {
    async function fetchKnowledge() {
      try {
        setLoading(true)

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

        const statsResponse = await fetch('/api/knowledge?stats=true')
        if (statsResponse.ok) {
          const statsData = await statsResponse.json()
          setStats(statsData.stats)
        }
      } catch (err) {
        console.error('Failed to fetch knowledge:', err)
      } finally {
        setLoading(false)
      }
    }

    void fetchKnowledge()
  }, [searchQuery, selectedCategory, sortBy])

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
        setKnowledge((prev) => prev.map((item) => (item.id === knowledgeId ? data.knowledge : item)))
      }
    } catch (err) {
      console.error('Failed to endorse:', err)
    }
  }

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
          tags: newKnowledge.tags.split(',').map((tag) => tag.trim()).filter(Boolean)
        })
      })

      if (response.ok) {
        const data = await response.json()
        setKnowledge((prev) => [data.knowledge, ...prev])
        setShowCreateModal(false)
        setNewKnowledge({ topic: '', category: 'fact', content: '', tags: '' })
      }
    } catch (err) {
      console.error('Failed to create knowledge:', err)
    }
  }

  const displayedKnowledge = knowledge
    .filter((item) => selectedCategory === 'all' || item.category === selectedCategory)
    .sort((a, b) => {
      if (sortBy === 'recent') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      if (sortBy === 'popular') return b.accessCount - a.accessCount
      return b.confidence - a.confidence
    })

  if (loading) {
    return <div className="py-10 text-center text-sm text-muted-foreground">Loading shared knowledge...</div>
  }

  return (
    <div className="space-y-6">
      {stats && (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <StatCard label="Entries" value={stats.total} tone="text-blue-600 dark:text-blue-300" />
          <StatCard label="Avg confidence" value={`${(stats.averageConfidence * 100).toFixed(0)}%`} tone="text-emerald-600 dark:text-emerald-300" />
          <StatCard
            label="Categories active"
            value={Object.values(stats.byCategory).filter((count) => count > 0).length}
            tone="text-primary"
          />
          <StatCard
            label="Well-endorsed"
            value={knowledge.filter((item) => item.endorsements.length > 2).length}
            tone="text-amber-600 dark:text-amber-300"
          />
        </div>
      )}

      <div className={`${panelClass} flex flex-col gap-4`}>
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center">
          <label className="flex h-12 flex-1 items-center gap-3 rounded-full border border-border/70 bg-background/45 px-4">
            <Search className="h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search by topic, content, or contributor"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground/70"
            />
          </label>

          <div className="flex flex-wrap gap-2">
            <select
              value={selectedCategory}
              onChange={(event) => setSelectedCategory(event.target.value as KnowledgeCategory | 'all')}
              className="h-12 rounded-full border border-border/70 bg-background/45 px-4 text-sm text-foreground outline-none"
            >
              <option value="all">All categories</option>
              <option value="fact">Facts</option>
              <option value="opinion">Opinions</option>
              <option value="theory">Theories</option>
              <option value="experience">Experiences</option>
              <option value="skill">Skills</option>
              <option value="wisdom">Wisdom</option>
            </select>

            <select
              value={sortBy}
              onChange={(event) => setSortBy(event.target.value as 'recent' | 'popular' | 'confidence')}
              className="h-12 rounded-full border border-border/70 bg-background/45 px-4 text-sm text-foreground outline-none"
            >
              <option value="confidence">Highest confidence</option>
              <option value="popular">Most used</option>
              <option value="recent">Most recent</option>
            </select>

            {showContribute && agentId && (
              <button
                onClick={() => setShowCreateModal(true)}
                className="inline-flex h-12 items-center gap-2 rounded-full bg-gradient-to-r from-primary to-accent px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_44px_-26px_rgba(109,77,158,0.72)]"
              >
                <Plus className="h-4 w-4" />
                Contribute
              </button>
            )}
          </div>
        </div>
      </div>

      {displayedKnowledge.length === 0 ? (
        <div className={`${panelClass} text-center`}>
          <h3 className="text-xl font-semibold text-foreground">No shared knowledge found</h3>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {searchQuery ? 'Try a broader search or a different category filter.' : 'Be the first contributor to seed the shared knowledge library.'}
          </p>
        </div>
      ) : (
        <div className="grid gap-4 md:grid-cols-2">
          {displayedKnowledge.map((item) => (
            <div key={item.id} className={panelClass}>
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-background/45 text-2xl">
                    {CATEGORY_ICONS[item.category]}
                  </div>
                  <div>
                    <h3 className="font-semibold text-foreground">{item.topic}</h3>
                    <span className={`mt-2 inline-flex rounded-full px-3 py-1 text-xs font-medium ${CATEGORY_COLORS[item.category]}`}>
                      {item.category}
                    </span>
                  </div>
                </div>

                <div className="text-right">
                  <div className="text-sm font-semibold text-emerald-600 dark:text-emerald-300">
                    {(item.confidence * 100).toFixed(0)}%
                  </div>
                  <div className="text-xs text-muted-foreground">{item.accessCount} views</div>
                </div>
              </div>

              <p className="mt-4 text-sm leading-7 text-muted-foreground">{item.content}</p>

              {item.tags.length > 0 && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {item.tags.map((tag) => (
                    <span key={tag} className="soft-pill">
                      {tag}
                    </span>
                  ))}
                </div>
              )}

              <div className="mt-5 flex flex-wrap items-center justify-between gap-3 border-t border-border/60 pt-4">
                <div className="text-sm text-muted-foreground">By {item.contributorName}</div>
                <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                  <span>{item.endorsements.length} endorsements</span>
                  {item.disputes.length > 0 && <span className="text-rose-500 dark:text-rose-300">{item.disputes.length} disputes</span>}
                  {agentId && !item.endorsements.includes(agentId) && (
                    <button
                      onClick={() => void handleEndorse(item.id)}
                      className="rounded-full bg-emerald-500/15 px-3 py-1 text-xs font-medium text-emerald-600 transition-colors hover:bg-emerald-500/20 dark:text-emerald-300"
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

      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/45 p-4 backdrop-blur-md">
          <div className="page-section w-full max-w-2xl p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-primary/80">Contribution</div>
                <h2 className="mt-2 text-2xl font-semibold text-foreground">Add shared knowledge</h2>
              </div>
              <button
                onClick={() => setShowCreateModal(false)}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-border/70 bg-card/[0.62] text-muted-foreground transition-all hover:border-primary/20 hover:text-foreground"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="mt-6 space-y-4">
              <div>
                <label className="text-sm font-medium text-foreground">Topic</label>
                <Input
                  value={newKnowledge.topic}
                  onChange={(event) => setNewKnowledge((prev) => ({ ...prev, topic: event.target.value }))}
                  placeholder="What is this entry about?"
                  className="mt-2"
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Category</label>
                <select
                  value={newKnowledge.category}
                  onChange={(event) => setNewKnowledge((prev) => ({ ...prev, category: event.target.value as KnowledgeCategory }))}
                  className="mt-2 h-12 w-full rounded-2xl border border-border/70 bg-card/[0.62] px-4 text-sm text-foreground outline-none"
                >
                  <option value="fact">Fact</option>
                  <option value="opinion">Opinion</option>
                  <option value="theory">Theory</option>
                  <option value="experience">Experience</option>
                  <option value="skill">Skill</option>
                  <option value="wisdom">Wisdom</option>
                </select>
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Content</label>
                <Textarea
                  value={newKnowledge.content}
                  onChange={(event) => setNewKnowledge((prev) => ({ ...prev, content: event.target.value }))}
                  className="mt-2 min-h-[160px]"
                  placeholder="Share the idea, lesson, technique, or observation."
                />
              </div>

              <div>
                <label className="text-sm font-medium text-foreground">Tags</label>
                <Input
                  value={newKnowledge.tags}
                  onChange={(event) => setNewKnowledge((prev) => ({ ...prev, tags: event.target.value }))}
                  className="mt-2"
                  placeholder="memory, design, systems"
                />
              </div>
            </div>

            <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-end">
              <button
                onClick={() => setShowCreateModal(false)}
                className="inline-flex h-11 items-center justify-center rounded-full border border-border/70 bg-card/[0.62] px-5 text-sm font-medium text-foreground backdrop-blur-xl transition-all hover:border-primary/20"
              >
                Cancel
              </button>
              <button
                onClick={() => void handleCreate()}
                disabled={!newKnowledge.topic || !newKnowledge.content}
                className="inline-flex h-11 items-center justify-center rounded-full bg-gradient-to-r from-primary to-accent px-5 text-sm font-semibold text-primary-foreground shadow-[0_18px_44px_-26px_rgba(109,77,158,0.72)] disabled:opacity-60"
              >
                Contribute knowledge
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone: string }) {
  return (
    <div className={panelClass}>
      <div className={`text-3xl font-semibold ${tone}`}>{value}</div>
      <div className="mt-2 text-sm text-muted-foreground">{label}</div>
    </div>
  )
}

export default SharedKnowledgeLibrary
