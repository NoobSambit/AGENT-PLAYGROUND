import type {
  RelationshipAlertFlag,
  RelationshipRosterItem,
  RelationshipSignalKind,
  RelationshipSourceKind,
} from '@/types/database'

export const premiumPanel =
  'rounded-md border border-border/40 bg-card/40 backdrop-blur-md shadow-sm'
export const subPanel = 'rounded-sm border border-border/30 bg-muted/20'
export const labelStyle =
  'text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/80'

export const filterOptions = [
  { id: 'all', label: 'All' },
  { id: 'allies', label: 'Allies' },
  { id: 'rivals', label: 'Rivals' },
  { id: 'mentors', label: 'Mentors' },
  { id: 'tense', label: 'Tense' },
  { id: 'recent', label: 'Recent' },
] as const

export type FilterId = (typeof filterOptions)[number]['id']

export const signalTone: Record<RelationshipSignalKind, string> = {
  support: 'text-pastel-green bg-pastel-green/10 border-pastel-green/20',
  agreement: 'text-pastel-blue bg-pastel-blue/10 border-pastel-blue/20',
  constructive_disagreement: 'text-pastel-yellow bg-pastel-yellow/10 border-pastel-yellow/20',
  dismissal: 'text-pastel-red bg-pastel-red/10 border-pastel-red/20',
  conflict: 'text-pastel-red bg-pastel-red/10 border-pastel-red/20',
  repair: 'text-pastel-green bg-pastel-green/10 border-pastel-green/20',
  follow_through: 'text-pastel-blue bg-pastel-blue/10 border-pastel-blue/20',
  betrayal: 'text-pastel-red bg-pastel-red/10 border-pastel-red/20',
  guidance: 'text-pastel-purple bg-pastel-purple/10 border-pastel-purple/20',
  admiration: 'text-pastel-pink bg-pastel-pink/10 border-pastel-pink/20',
  coalition: 'text-pastel-green bg-pastel-green/10 border-pastel-green/20',
  competition: 'text-pastel-yellow bg-pastel-yellow/10 border-pastel-yellow/20',
  mediation: 'text-pastel-blue bg-pastel-blue/10 border-pastel-blue/20',
}

export const sourceMeta: Record<
  RelationshipSourceKind,
  { text: string; bg: string; label: string }
> = {
  arena: { text: 'text-pastel-blue', bg: 'bg-pastel-blue/10', label: 'Arena' },
  challenge: { text: 'text-pastel-yellow', bg: 'bg-pastel-yellow/10', label: 'Challenge' },
  conflict: { text: 'text-pastel-red', bg: 'bg-pastel-red/10', label: 'Conflict' },
  mentorship: { text: 'text-pastel-purple', bg: 'bg-pastel-purple/10', label: 'Mentorship' },
  manual: { text: 'text-pastel-green', bg: 'bg-pastel-green/10', label: 'Manual' },
  simulation: { text: 'text-muted-foreground', bg: 'bg-muted/20', label: 'Simulation' },
}

export const alertMeta: Record<RelationshipAlertFlag, { label: string; hint: string }> = {
  trust_asymmetry: { label: 'Trust Asymmetry', hint: 'One side trusts far more than the other' },
  high_tension: { label: 'High Tension', hint: 'Friction load is elevated — handle with care' },
  recent_drop: { label: 'Recent Drop', hint: 'Metrics fell significantly in the last cycle' },
  mentor_dependency: { label: 'Mentor Dependency', hint: 'Over-reliance on mentorship detected' },
  repair_window: { label: 'Repair Window', hint: 'A repair opportunity is currently available' },
  stalled_relationship: { label: 'Stalled', hint: 'No meaningful interaction in a long time' },
}

export function statusConfig(status: string): { label: string; chip: string; dot: string } {
  const map: Record<string, { label: string; chip: string; dot: string }> = {
    growing: {
      label: 'Growing',
      chip: 'text-pastel-green border-pastel-green/30 bg-pastel-green/10',
      dot: 'bg-pastel-green',
    },
    stable: {
      label: 'Stable',
      chip: 'text-pastel-blue border-pastel-blue/30 bg-pastel-blue/10',
      dot: 'bg-pastel-blue',
    },
    forming: {
      label: 'Forming',
      chip: 'text-pastel-blue border-pastel-blue/30 bg-pastel-blue/10',
      dot: 'bg-pastel-blue',
    },
    strained: {
      label: 'Strained',
      chip: 'text-pastel-yellow border-pastel-yellow/30 bg-pastel-yellow/10',
      dot: 'bg-pastel-yellow',
    },
    declining: {
      label: 'Declining',
      chip: 'text-pastel-yellow border-pastel-yellow/30 bg-pastel-yellow/10',
      dot: 'bg-pastel-yellow',
    },
    broken: {
      label: 'Broken',
      chip: 'text-pastel-red border-pastel-red/30 bg-pastel-red/10',
      dot: 'bg-pastel-red',
    },
  }
  return (
    map[status] ?? {
      label: status,
      chip: 'text-muted-foreground border-border/30 bg-muted/20',
      dot: 'bg-muted-foreground',
    }
  )
}

export function filterRosterItem(item: RelationshipRosterItem, filter: FilterId): boolean {
  if (filter === 'all') return true
  if (filter === 'allies')
    return (
      item.relationshipTypes.includes('alliance') ||
      item.relationshipTypes.includes('friendship') ||
      item.relationshipTypes.includes('collaborator')
    )
  if (filter === 'rivals')
    return (
      item.relationshipTypes.includes('rivalry') ||
      item.relationshipTypes.includes('adversarial')
    )
  if (filter === 'mentors') return item.relationshipTypes.includes('mentorship')
  if (filter === 'tense')
    return item.alertFlags.includes('high_tension') || item.status === 'strained'
  if (filter === 'recent') {
    const age = Date.now() - new Date(item.lastInteraction).getTime()
    return age < 1000 * 60 * 60 * 24 * 7
  }
  return true
}

export async function parseResponse<T>(response: Response): Promise<T> {
  const raw = await response.text()
  const payload = raw ? (JSON.parse(raw) as Record<string, unknown>) : {}
  if (!response.ok) {
    throw new Error(
      typeof payload.error === 'string'
        ? payload.error
        : `Request failed with status ${response.status}`
    )
  }
  return payload as T
}

export function formatDateTime(value?: string) {
  if (!value) return 'Unknown'
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value))
}

export function formatDateShort(value?: string) {
  if (!value) return '—'
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric' }).format(
    new Date(value)
  )
}

export function percentage(value: number) {
  return `${Math.round(value * 100)}%`
}

export function deltaTone(value?: number) {
  if (!value) return 'text-muted-foreground'
  if (value > 0.01) return 'text-pastel-green'
  if (value < -0.01) return 'text-pastel-red'
  return 'text-muted-foreground'
}
