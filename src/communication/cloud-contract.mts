/** Public voice identities verified against the owner's account metadata on 2026-11-14.
 * Availability is rechecked server-side; this catalog never authorizes synthesis. */
export const approvedVoices = [
  { id: 'Uc7anshoV8mdBhDnEZEX', name: 'Cecily — Clear and Warm', apiName: 'Cecily - Clear and Warm', group: 'Feminine', description: 'American English · warm conversational voice' },
  { id: 'm1Edok6RLyT2Hz3OljNi', name: 'Zoë — Casual millennial woman', apiName: 'Zoë - Casual millennial woman', group: 'Feminine', description: 'American English · clear, conversational delivery' },
  { id: 'mdpRX5ndZ28fmYwb5P0J', name: 'Gramma Sherry — Narration', apiName: 'Gramma Sherry - Narration', group: 'Feminine', description: 'American English · older-sounding narration' },
  { id: 'mhJNZGgdePh7HbwWYwN2', name: 'James — Gen Z Comforting Southern Man', apiName: 'James -Gen Z Comforting Southern Man', group: 'Masculine', description: 'American English · grounded Southern warmth' },
  { id: 'bQxW1c7YCr6VQgQhw8KX', name: 'LaSean Pickens', apiName: 'LaSean Pickens', group: 'Masculine', description: 'American English · calm conversational voice' },
  { id: 'cjVigY5qzO86Huf0OWal', name: 'Eric — Smooth, Trustworthy', apiName: 'Eric - Smooth, Trustworthy', group: 'Masculine', description: 'American English · smooth conversational voice' },
] as const;
export const PREMIUM_MODEL = 'eleven_flash_v2_5';
export const PREVIEW_TEXT = 'This is the selected voice.';
export type PremiumVoice = { id: string; name: string; description: string; group: string; available: boolean; reason: string; auditioned: false };
export type AssistKind = 'contextual_response' | 'spelling_correction' | 'clarification' | 'wording_alternative' | 'continuation';
export type Suggestion = { text: string; kind: AssistKind };
export type AssistRequest = { id: string; text: string; context: string; kind: AssistKind; synthetic: true };
export type CloudState = { consent: boolean; refresh: number; elevenlabs: boolean; gemini: boolean; elevenReason: string; geminiReason: string; voices: PremiumVoice[] };
export const initialCloud = (): CloudState => ({ consent: false, refresh: 0, elevenlabs: false, gemini: false,
  elevenReason: 'Account checks pending', geminiReason: 'Free-tier checks pending',
  voices: approvedVoices.map(v => ({ ...v, available: false, reason: 'Availability not checked', auditioned: false })) });
