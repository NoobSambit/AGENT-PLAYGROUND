'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { AudioLines, Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { EmotionalState, LinguisticProfile } from '@/types/database'
import { VoiceProfile } from '@/types/enhancements'
import { emotionalService } from '@/lib/services/emotionalService'

interface RecognitionEventLike {
  results: ArrayLike<ArrayLike<{ transcript: string }>>
}

interface SpeechRecognitionInstanceLike {
  continuous: boolean
  interimResults: boolean
  lang: string
  onresult: ((event: RecognitionEventLike) => void) | null
  onend: (() => void) | null
  onerror: (() => void) | null
  start: () => void
  stop: () => void
}

interface VoiceConsoleProps {
  agentName: string
  messages: Array<{ id: string; type: 'user' | 'agent' | 'system'; content: string }>
  value: string
  onChange: (value: string) => void
  linguisticProfile?: LinguisticProfile
  emotionalState?: EmotionalState
}

function buildVoiceProfile(
  linguisticProfile?: LinguisticProfile,
  emotionalState?: EmotionalState
): VoiceProfile {
  const liveState = emotionalService.normalizeEmotionalState(emotionalState)
  const dominantEmotion = liveState.dominantEmotion
  const dominantIntensity = dominantEmotion ? liveState.currentMood[dominantEmotion] || 0 : 0

  const rate = Math.max(0.8, Math.min(1.25, 0.92 + (linguisticProfile?.verbosity || 0.5) * 0.25))
  const pitchBase = 0.95 + (linguisticProfile?.expressiveness || 0.5) * 0.25
  const pitchEmotionOffset = dominantEmotion === 'joy' || dominantEmotion === 'anticipation'
    ? 0.08
    : dominantEmotion === 'sadness'
      ? -0.08
      : 0

  return {
    rate,
    pitch: Math.max(0.7, Math.min(1.4, pitchBase + pitchEmotionOffset)),
    volume: 1,
    styleHint: dominantIntensity > 0.55 && dominantEmotion
      ? `${dominantEmotion} is currently influencing delivery.`
      : 'Balanced delivery with subtle emotional coloring.',
  }
}

export function VoiceConsole({
  agentName,
  messages,
  value,
  onChange,
  linguisticProfile,
  emotionalState,
}: VoiceConsoleProps) {
  const [isListening, setIsListening] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(false)
  const [autoSpeak, setAutoSpeak] = useState(false)
  const [recognitionAvailable, setRecognitionAvailable] = useState(false)
  const recognitionRef = useRef<SpeechRecognitionInstanceLike | null>(null)
  const lastSpokenMessageId = useRef<string | null>(null)
  const voiceProfile = buildVoiceProfile(linguisticProfile, emotionalState)

  const lastAgentMessage = [...messages].reverse().find((message) => message.type === 'agent')

  const speak = useCallback((text: string) => {
    if (!voiceEnabled || !text.trim()) {
      return
    }

    window.speechSynthesis.cancel()
    const utterance = new SpeechSynthesisUtterance(text)
    utterance.rate = voiceProfile.rate
    utterance.pitch = voiceProfile.pitch
    utterance.volume = voiceProfile.volume
    utterance.lang = 'en-US'

    const voices = window.speechSynthesis.getVoices()
    const preferred = voices.find((voice) => /en/i.test(voice.lang) && /female|male|natural|samantha|daniel/i.test(voice.name))
    if (preferred) {
      utterance.voice = preferred
    }

    window.speechSynthesis.speak(utterance)
  }, [voiceEnabled, voiceProfile.pitch, voiceProfile.rate, voiceProfile.volume])

  useEffect(() => {
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionInstanceLike
      webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike
      speechSynthesis?: SpeechSynthesis
    }

    setRecognitionAvailable(Boolean(speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition))
    setVoiceEnabled(Boolean(speechWindow.speechSynthesis))
  }, [])

  useEffect(() => {
    if (!autoSpeak || !voiceEnabled || !lastAgentMessage || lastSpokenMessageId.current === lastAgentMessage.id) {
      return
    }

    speak(lastAgentMessage.content)
    lastSpokenMessageId.current = lastAgentMessage.id
  }, [autoSpeak, lastAgentMessage, speak, voiceEnabled])

  const startListening = () => {
    const speechWindow = window as Window & {
      SpeechRecognition?: new () => SpeechRecognitionInstanceLike
      webkitSpeechRecognition?: new () => SpeechRecognitionInstanceLike
    }

    const Recognition = speechWindow.SpeechRecognition || speechWindow.webkitSpeechRecognition
    if (!Recognition) {
      return
    }

    if (!recognitionRef.current) {
      const recognition = new Recognition()
      recognition.continuous = false
      recognition.interimResults = true
      recognition.lang = 'en-US'
      recognition.onresult = (event) => {
        const transcript = Array.from(event.results)
          .map((result) => result[0]?.transcript || '')
          .join(' ')
        onChange(transcript.trim())
      }
      recognition.onend = () => setIsListening(false)
      recognition.onerror = () => setIsListening(false)
      recognitionRef.current = recognition
    }

    recognitionRef.current.start()
    setIsListening(true)
  }

  const stopListening = () => {
    recognitionRef.current?.stop()
    setIsListening(false)
  }

  return (
    <section className="overflow-hidden rounded-xl border border-[#5f4a5b] bg-[#21171d] shadow-[0_12px_32px_rgba(0,0,0,0.18)]">
      <div className="flex items-center gap-2 border-b border-[#503a49] px-3.5 py-3">
        <AudioLines className="h-4 w-4 text-[#f3c5d5]" aria-hidden="true" />
        <div>
          <h3 className="text-sm font-semibold tracking-tight text-[#eef5ff]">Voice console</h3>
          <p className="mt-0.5 text-[10px] text-[#8fa4bf]">Browser speech controls for {agentName}</p>
        </div>
      </div>

      <div className="space-y-3 p-3.5">
        <div className="grid grid-cols-2 gap-2 text-[10px]">
          <div className="rounded-lg border border-[#694d5d] bg-[#2a1d26] px-2.5 py-2">
            <span className="block uppercase tracking-[0.14em] text-[#b09aa7]">Rate</span>
            <span className="mt-1 block font-semibold text-[#ffd9df]">{voiceProfile.rate.toFixed(2)}×</span>
          </div>
          <div className="rounded-lg border border-[#4d6959] bg-[#18221c] px-2.5 py-2">
            <span className="block uppercase tracking-[0.14em] text-[#a4b9aa]">Output</span>
            <span className={`mt-1 block font-semibold ${voiceEnabled ? 'text-emerald-200' : 'text-[#9aacbf]'}`}>{voiceEnabled ? 'Available' : 'Unavailable'}</span>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={!recognitionAvailable}
            className={`inline-flex h-9 items-center justify-center gap-2 rounded-lg border px-2 text-xs font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#9bdddb]/80 ${
              isListening
                ? 'border-rose-200/45 bg-rose-300/15 text-rose-100'
                : 'border-[#4b7775] bg-[#102523] text-[#c9f0eb] hover:border-[#9bdddb]/55'
            } disabled:cursor-not-allowed disabled:opacity-45`}
          >
            {isListening ? <MicOff className="h-3.5 w-3.5" aria-hidden="true" /> : <Mic className="h-3.5 w-3.5" aria-hidden="true" />}
            {isListening ? 'Stop dictation' : 'Dictate'}
          </button>

          <button
            type="button"
            onClick={() => speak(lastAgentMessage?.content || value)}
            disabled={!voiceEnabled || !(lastAgentMessage?.content || value)}
            className="inline-flex h-9 items-center justify-center gap-2 rounded-lg border border-[#8b6672]/70 bg-[#2a1d28] px-2 text-xs font-semibold text-[#ffdbe4] transition hover:border-[#ffc0d1]/65 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#ffc0d1]/80 disabled:cursor-not-allowed disabled:opacity-45"
          >
            <Volume2 className="h-3.5 w-3.5" aria-hidden="true" /> Speak reply
          </button>
        </div>

        <button
          type="button"
          onClick={() => {
            window.speechSynthesis.cancel()
          }}
          disabled={!voiceEnabled}
          className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-lg border border-rose-300/35 bg-rose-300/5 text-xs font-semibold text-rose-100 transition hover:bg-rose-300/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-rose-200/80 disabled:cursor-not-allowed disabled:opacity-45"
        >
          <VolumeX className="h-3.5 w-3.5" aria-hidden="true" /> Stop audio
        </button>

        <div className="flex items-center justify-between border-t border-[#503a49] pt-3 text-[10px] text-[#c5adb9]">
          <span>pitch {voiceProfile.pitch.toFixed(2)} · emotion-adaptive</span>
          <label className="inline-flex cursor-pointer items-center gap-1.5 text-[#f0d5df]">
            <input
              type="checkbox"
              checked={autoSpeak}
              onChange={(event) => setAutoSpeak(event.target.checked)}
              className="h-3.5 w-3.5 rounded border-[#876a79] bg-[#2a1d26] text-rose-300 focus:ring-rose-200"
            />
            Auto-speak
          </label>
        </div>
      </div>
    </section>
  )
}

export default VoiceConsole
