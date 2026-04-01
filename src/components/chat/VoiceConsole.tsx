'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, Volume2, VolumeX } from 'lucide-react'
import { EmotionalState, LinguisticProfile } from '@/types/database'
import { VoiceProfile } from '@/types/enhancements'

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
  const dominantEmotion = emotionalState?.dominantEmotion
  const dominantIntensity = dominantEmotion ? emotionalState?.currentMood[dominantEmotion] || 0 : 0

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
    styleHint: dominantIntensity > 0.55
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

  return (
    <div className="mt-4 rounded-sm border border-border/60 bg-background/45 p-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <div className="text-xs font-semibold uppercase tracking-[0.18em] text-primary/80">Voice Console</div>
          <p className="mt-1 text-sm text-muted-foreground">
            Voice delivery for {agentName}. {voiceProfile.styleHint}
          </p>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={isListening ? stopListening : startListening}
            disabled={!recognitionAvailable}
            className={`inline-flex h-10 items-center gap-2 rounded-full px-4 text-sm font-medium transition-all ${
              isListening
                ? 'bg-rose-500 text-white'
                : 'border border-border/70 bg-card/[0.62] text-foreground'
            } disabled:opacity-50`}
          >
            {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
            {isListening ? 'Stop listening' : 'Dictate'}
          </button>

          <button
            type="button"
            onClick={() => speak(lastAgentMessage?.content || value)}
            disabled={!voiceEnabled || !(lastAgentMessage?.content || value)}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-card/[0.62] px-4 text-sm font-medium text-foreground disabled:opacity-50"
          >
            <Volume2 className="h-4 w-4" />
            Speak response
          </button>

          <button
            type="button"
            onClick={() => {
              window.speechSynthesis.cancel()
            }}
            disabled={!voiceEnabled}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-border/70 bg-card/[0.62] px-4 text-sm font-medium text-foreground disabled:opacity-50"
          >
            <VolumeX className="h-4 w-4" />
            Stop audio
          </button>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
        <span className="soft-pill">rate {voiceProfile.rate.toFixed(2)}</span>
        <span className="soft-pill">pitch {voiceProfile.pitch.toFixed(2)}</span>
        <label className="inline-flex items-center gap-2 rounded-full border border-border/60 px-3 py-2">
          <input
            type="checkbox"
            checked={autoSpeak}
            onChange={(event) => setAutoSpeak(event.target.checked)}
            className="rounded"
          />
          Auto-speak replies
        </label>
      </div>
    </div>
  )
}

export default VoiceConsole
