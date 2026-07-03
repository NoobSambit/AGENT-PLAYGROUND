import { Library } from 'lucide-react'
import type { LibraryConsumerMetadata, LibraryInfluenceTraceItem } from '@/types/database'

interface LibraryInfluenceTraceProps {
  metadata?: LibraryConsumerMetadata | Record<string, unknown> | null
  compact?: boolean
}

function getItems(metadata: LibraryInfluenceTraceProps['metadata']): LibraryInfluenceTraceItem[] {
  const value = metadata?.libraryContextItems
  return Array.isArray(value) ? value.filter((item): item is LibraryInfluenceTraceItem => (
    Boolean(item && typeof item === 'object' && 'id' in item && 'source' in item)
  )) : []
}

function getItemIds(metadata: LibraryInfluenceTraceProps['metadata']): string[] {
  const value = metadata?.libraryContextItemIds
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : []
}

function truncate(value: string | undefined, maxChars: number) {
  const normalized = value?.replace(/\s+/g, ' ').trim() || ''
  if (normalized.length <= maxChars) return normalized
  return `${normalized.slice(0, Math.max(0, maxChars - 3)).trim()}...`
}

export function LibraryInfluenceTrace({ metadata, compact = false }: LibraryInfluenceTraceProps) {
  const status = metadata?.libraryContextStatus
  const items = getItems(metadata)
  const itemIds = getItemIds(metadata)
  const error = typeof metadata?.libraryContextError === 'string' ? metadata.libraryContextError : undefined
  const recordedAt = typeof metadata?.libraryUsageRecordedAt === 'string' ? metadata.libraryUsageRecordedAt : undefined

  if (!status || (status === 'skipped' && itemIds.length === 0 && !error)) {
    return null
  }

  return (
    <div className="rounded-sm border border-border/30 bg-muted/10 p-3 text-[11px] text-muted-foreground">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2 font-bold uppercase tracking-[0.16em] text-foreground">
          <Library className="h-3.5 w-3.5" />
          <span>Library influence</span>
        </div>
        <span className="rounded-sm border border-border/30 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider">
          {String(status)}
        </span>
      </div>

      {items.length > 0 ? (
        <div className="mt-2 space-y-2">
          {items.slice(0, compact ? 2 : 4).map((item) => (
            <div key={item.id} className="rounded-sm border border-border/20 bg-background/30 p-2">
              <div className="flex items-center justify-between gap-2">
                <div className="truncate font-semibold text-foreground">{item.title}</div>
                <div className="shrink-0 text-[9px] uppercase tracking-wider">
                  conf {Math.round(item.confidence * 100)}% · rel {Math.round(item.relevanceScore * 100)}%
                </div>
              </div>
              <div className="mt-1 leading-5">{truncate(item.claim, compact ? 160 : 220)}</div>
              <div className="mt-1 leading-5 text-muted-foreground/80">
                Source: {item.source.sourceTitle || `${item.source.sourceType}:${item.source.sourceId}`} · {truncate(item.source.evidenceSummary, compact ? 140 : 220)}
              </div>
            </div>
          ))}
        </div>
      ) : itemIds.length > 0 ? (
        <div className="mt-2 leading-5">Items: {itemIds.slice(0, compact ? 3 : 6).join(', ')}</div>
      ) : null}

      {error ? <div className="mt-2 leading-5 text-pastel-red">{error}</div> : null}
      {recordedAt ? <div className="mt-2 text-[10px] uppercase tracking-wider">Usage recorded {new Date(recordedAt).toLocaleString()}</div> : null}
    </div>
  )
}
