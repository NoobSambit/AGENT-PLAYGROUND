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
                'inline-flex items-center gap-2 rounded-full border px-3 py-2 text-sm font-medium transition-all',
                compact ? 'h-9 text-xs' : 'h-10',
                isActive
                  ? 'border-primary bg-primary text-primary-foreground'
                  : 'border-border/70 bg-card/[0.62] text-foreground hover:border-primary/25',
                disabled && 'cursor-not-allowed opacity-50'
              )}
            >
              <span>{LLM_PROVIDER_LABELS[option]}</span>
              {option === 'ollama' ? <span className="text-[10px] uppercase tracking-[0.16em]">local</span> : null}
            </button>
          )
        })}
      </div>

      <div className={cn('flex flex-wrap gap-2 text-xs text-muted-foreground', compact && 'gap-1.5')}>
        <span className="soft-pill capitalize">provider: {LLM_PROVIDER_LABELS[provider]}</span>
        <span className="soft-pill">model: {currentModel}</span>
        {!currentStatus?.available && provider !== 'ollama' ? (
          <span className="soft-pill">server credentials required for this provider</span>
        ) : null}
      </div>
    </div>
  )
}
