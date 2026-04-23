'use client'

import { motion, AnimatePresence } from 'framer-motion'
import { useState } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import { labelStyle } from './RelationshipHelpers'

// ─── MetricBar ──────────────────────────────────────────────────────────────
export function MetricBar({
  label,
  value,
  color,
  hint,
}: {
  label: string
  value: number
  color: string
  hint?: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] text-muted-foreground">{label}</span>
        <span className="text-[11px] font-semibold tabular-nums text-foreground">
          {Math.round(value * 100)}%
        </span>
      </div>
      <div className="h-1 rounded-full bg-muted/30">
        <motion.div
          initial={false}
          animate={{ width: `${Math.max(3, value * 100)}%` }}
          transition={{ duration: 0.4, ease: 'easeOut' }}
          className={`h-full rounded-full ${color}`}
        />
      </div>
      {hint && <div className="text-[10px] italic text-muted-foreground/50">{hint}</div>}
    </div>
  )
}

// ─── HealthPill ──────────────────────────────────────────────────────────────
export function HealthPill({
  label,
  value,
  textColor,
  accentClass,
  hint,
}: {
  label: string
  value: string
  textColor: string
  accentClass: string
  hint?: string
}) {
  return (
    <div
      className={`flex flex-col items-center justify-center rounded-sm border px-3 py-2.5 text-center ${accentClass}`}
    >
      <div className={`text-xl font-bold leading-none tabular-nums ${textColor}`}>{value}</div>
      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
        {label}
      </div>
      {hint && (
        <div className="mt-0.5 text-[9px] text-muted-foreground/60 italic">{hint}</div>
      )}
    </div>
  )
}

// ─── Collapsible ─────────────────────────────────────────────────────────────
export function Collapsible({
  title,
  icon: Icon,
  children,
  defaultOpen = false,
  badge,
  accent,
}: {
  title: string
  icon: React.ElementType
  children: React.ReactNode
  defaultOpen?: boolean
  badge?: string
  accent?: string
}) {
  const [open, setOpen] = useState(defaultOpen)

  return (
    <div className="rounded-sm border border-border/30 bg-muted/10">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        aria-expanded={open}
      >
        <div className="flex items-center gap-2.5">
          <Icon className={`h-3.5 w-3.5 ${accent ?? 'text-muted-foreground'}`} />
          <span className="text-[11px] font-bold uppercase tracking-[0.16em] text-foreground">
            {title}
          </span>
          {badge && (
            <span className="rounded-full border border-border/30 bg-muted/30 px-1.5 py-0.5 text-[9px] font-bold text-muted-foreground">
              {badge}
            </span>
          )}
        </div>
        {open ? (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
        )}
      </button>

      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="border-t border-border/20 px-4 pb-4 pt-3">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── SectionHeader ───────────────────────────────────────────────────────────
export function SectionHeader({
  title,
  subtitle,
  icon: Icon,
  accent,
  action,
}: {
  title: string
  subtitle?: string
  icon?: React.ElementType
  accent?: string
  action?: React.ReactNode
}) {
  return (
    <div className="flex items-start justify-between gap-3">
      <div className="flex items-start gap-2.5">
        {Icon && (
          <div className={`mt-0.5 rounded-sm p-1.5 ${accent ?? 'bg-muted/30'}`}>
            <Icon className="h-3.5 w-3.5 text-muted-foreground" />
          </div>
        )}
        <div>
          <div className="text-[11px] font-bold uppercase tracking-[0.18em] text-foreground">
            {title}
          </div>
          {subtitle && (
            <div className="mt-0.5 text-[11px] text-muted-foreground">{subtitle}</div>
          )}
        </div>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  )
}

// ─── NetworkStatTile ─────────────────────────────────────────────────────────
export function NetworkStatTile({
  label,
  value,
  hint,
  accent,
}: {
  label: string
  value: string | number
  hint: string
  accent?: string
}) {
  return (
    <div className="min-w-0">
      <div className={labelStyle}>{label}</div>
      <div
        className={`mt-1.5 text-2xl font-bold tracking-tight leading-none ${accent ?? 'text-foreground'}`}
      >
        {value}
      </div>
      <div className="mt-1 text-[11px] text-muted-foreground">{hint}</div>
    </div>
  )
}

// ─── EmptyInline ─────────────────────────────────────────────────────────────
export function EmptyInline({ text }: { text: string }) {
  return (
    <div className="rounded-sm border border-dashed border-border/25 px-3 py-5 text-center text-[12px] italic text-muted-foreground/60">
      {text}
    </div>
  )
}
