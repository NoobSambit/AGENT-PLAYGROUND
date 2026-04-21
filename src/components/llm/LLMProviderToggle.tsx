'use client'

import { useEffect, useState } from 'react'
import type { LLMProvider } from '@/lib/llmConfig'
import {
  getClientModelForProvider,
  LLM_PROVIDER_LABELS,
} from '@/lib/llm/clientPreference'
import { useLLMPreferenceStore } from '@/stores/llmPreferenceStore'
import { cn } from '@/lib/utils'

interface ProviderStatus {
  provider: LLMProvider
  model: string
  available: boolean
}

interface LLMProviderToggleProps {
  compact?: boolean
  className?: string
}

export function LLMProviderToggle({ compact = false, className }: LLMProviderToggleProps) {
  const provider = useLLMPreferenceStore((state) => state.provider)
  const setProvider = useLLMPreferenceStore((state) => state.setProvider)
  const [statuses, setStatuses] = useState<Record<LLMProvider, ProviderStatus> | null>(null)

  useEffect(() => {
    let active = true

    async function loadProviderStatus() {
      try {
        const response = await fetch('/api/llm', {
          method: 'GET',
          cache: 'no-store',
        })

        if (!response.ok) {
          return
        }

        const data = await response.json() as { providers?: ProviderStatus[] }
        if (!active || !Array.isArray(data.providers)) {
          return
        }

        setStatuses(
          data.providers.reduce<Record<LLMProvider, ProviderStatus>>((acc, item) => {
            acc[item.provider] = item
            return acc
          }, {} as Record<LLMProvider, ProviderStatus>)
        )
      } catch (error) {
        console.error('Failed to load LLM providers:', error)
      }
    }

    void loadProviderStatus()

    return () => {
      active = false
    }
  }, [])

  const providers: LLMProvider[] = ['gemini', 'groq', 'ollama']
  const currentStatus = statuses?.[provider]
  const currentModel = currentStatus?.model || getClientModelForProvider(provider)

  return (
    <div className={cn('space-y-2', className)}>
      {!compact && (
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">LLM Provider</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose which backend model provider powers chat, simulations, and generation features.
          </p>
        </div>
      )}

      <div className={cn('flex flex-wrap gap-2', compact && 'gap-1.5')}>
        {providers.map((option) => {
          const optionStatus = statuses?.[option]
          const isActive = provider === option
          const disabled = optionStatus ? !optionStatus.available : false

          return (
            <button
              key={option}
              type="button"
              disabled={disabled}
              onClick={() => setProvider(option)}
              className={cn(
                'inline-flex items-center justify-center gap-2 rounded-sm border transition-all font-bold',
                compact ? 'flex-1 h-9 text-[11px] px-2' : 'h-10 px-4 text-[12px]',
                isActive
                  ? (compact ? 'border-pastel-purple/40 bg-pastel-purple/10 text-foreground' : 'border-primary bg-primary/10 text-primary')
                  : 'border-border/30 bg-muted/5 text-muted-foreground hover:text-foreground',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <span>{LLM_PROVIDER_LABELS[option]}</span>
              {option === 'ollama' ? <span className="text-[9px] uppercase tracking-[0.2em] opacity-80">local</span> : null}
            </button>
          )
        })}
      </div>

      <div className={cn('flex flex-wrap items-center gap-1.5 text-muted-foreground', compact ? 'text-[10px] uppercase tracking-[0.1em]' : 'text-[11px]')}>
        <span>{LLM_PROVIDER_LABELS[provider]}</span>
        <span className="opacity-40">•</span>
        <span className="truncate max-w-[140px]">{currentModel}</span>
        {!currentStatus?.available && provider !== 'ollama' ? (
          <>
            <span className="opacity-40">•</span>
            <span className="text-pastel-red font-bold">Needs API Key</span>
          </>
        ) : null}
      </div>
    </div>
  )
}
