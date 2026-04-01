'use client'

import { create } from 'zustand'
import { persist, createJSONStorage } from 'zustand/middleware'
import type { LLMProvider } from '@/lib/llmConfig'
import {
  getDefaultClientLLMProvider,
  LLM_PROVIDER_STORAGE_KEY,
  writeLLMPreferenceCookie,
} from '@/lib/llm/clientPreference'

interface LLMPreferenceState {
  provider: LLMProvider
  hydrated: boolean
  setProvider: (provider: LLMProvider) => void
  setHydrated: (hydrated: boolean) => void
}

export const useLLMPreferenceStore = create<LLMPreferenceState>()(
  persist(
    (set) => ({
      provider: getDefaultClientLLMProvider(),
      hydrated: false,
      setProvider: (provider) => {
        writeLLMPreferenceCookie(provider)
        set({ provider })
      },
      setHydrated: (hydrated) => set({ hydrated }),
    }),
    {
      name: LLM_PROVIDER_STORAGE_KEY,
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({ provider: state.provider }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          state.setHydrated(true)
          writeLLMPreferenceCookie(state.provider)
        }
      },
    }
  )
)
