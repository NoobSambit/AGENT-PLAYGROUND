export const DEFAULT_GEMINI_MODEL = 'gemini-2.0-flash'
export const DEFAULT_GROQ_MODEL = 'llama-3.3-70b-versatile'

export function getGeminiModel(): string {
  return process.env.GOOGLE_AI_MODEL || process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL
}

export function getGroqModel(): string {
  return process.env.GROQ_MODEL || DEFAULT_GROQ_MODEL
}
