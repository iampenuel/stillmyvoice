/** Server-only ElevenLabs boundary. Never import this module into the UI. */
import type { Authorization } from '../src/communication/model.mts';
import { approvedVoices, PREMIUM_MODEL, PREVIEW_TEXT, type PremiumVoice } from '../src/communication/cloud-contract.mts';
export type { PremiumVoice } from '../src/communication/cloud-contract.mts';

/** Reviewed per-voice exception; clients cannot supply a model or a fallback. */
export const modelForVoice = (id: string): string => id === 'bQxW1c7YCr6VQgQhw8KX' ? 'eleven_flash_v2' : PREMIUM_MODEL;
const modelLabel = (id: string) => modelForVoice(id) === 'eleven_flash_v2' ? 'Flash v2 · English' : 'Flash v2.5';

export type ErrorMetadata = Readonly<{ source: 'app' | 'provider'; sessionLimit?: number; retryAfterSeconds?: number; providerHttpStatus?: number; providerStatus?: string; quotaMetrics?: readonly string[] }>;
export class ProviderError extends Error {
  readonly status: number;
  readonly code: string;
  readonly metadata?: ErrorMetadata;
  constructor(code: string, status = 503, metadata?: ErrorMetadata) { super(code); this.code = code; this.status = status; this.metadata = metadata; }
}
export function resolveApprovedVoices(raw: unknown[]): PremiumVoice[] {
  return approvedVoices.map(approved => {
    const matches = raw.map(object).filter(v => v?.voice_id === approved.id);
    const voice = matches.length === 1 ? matches[0] : null;
    const fine = object(voice?.fine_tuning), states = object(fine?.state), sharing = object(voice?.sharing);
    const compatible = states?.[modelForVoice(approved.id)] === 'fine_tuned';
    const disabled = typeof sharing?.disable_at_unix === 'number' && sharing.disable_at_unix * 1000 <= Date.now();
    const standardRate = sharing?.rate == null || sharing.rate === 1;
    const identity = voice?.name === approved.apiName;
    const available = !!voice && identity && compatible && !disabled && standardRate;
    const reason = !voice ? 'Not available in this account' : !identity ? 'Voice identity needs verification'
      : !compatible ? `Unavailable with ${modelLabel(approved.id)}` : disabled ? 'Voice withdrawn'
      : !standardRate ? 'Custom usage rate requires review' : `${modelLabel(approved.id)} metadata verified; preview not yet heard`;
    return { id: approved.id, name: approved.name, description: approved.description, group: approved.group, available, reason, auditioned: false };
  });
}
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;
const voiceId = (value: unknown): value is string => typeof value === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(value);
export async function boundedBody(response: Response, maxBytes: number, signal: AbortSignal): Promise<Uint8Array> {
  if (!response.body) throw new ProviderError('EMPTY_PROVIDER_RESPONSE', 502);
  const reader = response.body.getReader(), chunks: Uint8Array[] = []; let size = 0;
  const abort = () => { void reader.cancel(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted(); const part = await reader.read(); signal.throwIfAborted();
      if (part.done) break;
      size += part.value.length;
      if (size > maxBytes) throw new ProviderError('PROVIDER_RESPONSE_TOO_LARGE', 502);
      chunks.push(part.value);
    }
    const joined = new Uint8Array(size); let offset = 0;
    for (const chunk of chunks) { joined.set(chunk, offset); offset += chunk.length; }
    return joined;
  } finally { signal.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}
export function createElevenLabs(env: Record<string, string | undefined>, fetcher: typeof fetch = fetch) {
  const key = env.ELEVENLABS_API_KEY;
  const confirmed = env.SMV_ELEVENLABS_CREDITS_CONFIRMED === 'true';
  const permitted = env.SMV_CLOUD_MODE === 'local-synthetic-demo' && env.NODE_ENV !== 'production';
  const enabled = Boolean(permitted && confirmed && key && key.length >= 12 && !/\s/.test(key));
  const metadataAllowed = Boolean(key && (enabled || env.SMV_METADATA_ALLOWED === 'true'));
  let voices: PremiumVoice[] = [], modelVerified = false, characters = 0, inFlight = false;
  let discovery: Promise<PremiumVoice[]> | null = null;
  const consumed = new Set<string>();
  const status = () => ({ available: enabled, reason: !permitted ? 'Cloud disabled' : !confirmed ? 'Credits and overage settings unconfirmed'
    : !key ? 'API key missing' : enabled ? 'Configured — live verification required' : 'Invalid key configuration',
    metadataAvailable: metadataAllowed, model: PREMIUM_MODEL, charactersSubmitted: characters, sessionCharacterLimit: 10_000, voicesVerified: voices.length, modelVerified });
  const request = async (path: string, signal: AbortSignal, init: RequestInit = {}) => {
    if (!(init.method === 'POST' ? enabled : metadataAllowed)) throw new ProviderError('ELEVENLABS_DISABLED', 403);
    signal.throwIfAborted();
    const result = await fetcher(`https://api.elevenlabs.io${path}`, { ...init, redirect: 'error', signal,
      headers: { 'xi-api-key': key!, ...init.headers } });
    if (!result.ok) { await result.body?.cancel(); throw new ProviderError(result.status === 429 ? 'ELEVENLABS_QUOTA' : 'ELEVENLABS_UNAVAILABLE', result.status === 429 ? 429 : 503); }
    return result;
  };
  const json = async (path: string, signal: AbortSignal) => {
    const bytes = await boundedBody(await request(path, signal), 1024 * 1024, signal);
    return JSON.parse(new TextDecoder().decode(bytes)) as unknown;
  };
  return {
    status,
    async listVoices(signal: AbortSignal): Promise<PremiumVoice[]> {
      if (!metadataAllowed) throw new ProviderError('ELEVENLABS_DISABLED', 403);
      if (voices.length) return voices;
      if (discovery) return discovery;
      discovery = (async () => {
        const bounded = AbortSignal.any([signal, AbortSignal.timeout(10_000)]);
        try {
          const raw: unknown[] = []; let token: string | null = null;
          const tokens = new Set<string>();
          for (let page = 0; page < 10; page++) {
            const result = object(await json('/v2/voices?page_size=100&include_total_count=false' + (token ? '&next_page_token=' + encodeURIComponent(token) : ''), bounded));
            if (!result || !Array.isArray(result.voices)) throw new ProviderError('ELEVENLABS_INVALID_VOICES', 502);
            raw.push(...result.voices);
            if (result.has_more !== true) { token = null; break; }
            if (typeof result.next_page_token !== 'string' || !result.next_page_token || tokens.has(result.next_page_token)) throw new ProviderError('ELEVENLABS_INCOMPLETE_VOICES', 502);
            token = result.next_page_token; tokens.add(token);
          }
          if (token) throw new ProviderError('ELEVENLABS_INCOMPLETE_VOICES', 502);
          voices = resolveApprovedVoices(raw);
          modelVerified = voices.some(v => v.available);
          return voices;
        } catch (error) {
          if (error instanceof ProviderError) throw error;
          throw new ProviderError(bounded.aborted ? 'ELEVENLABS_CANCELLED_OR_TIMEOUT' : 'ELEVENLABS_UNAVAILABLE');
        }
      })();
      try { return await discovery; } finally { discovery = null; }
    },
    async synthesize(value: unknown, signal: AbortSignal): Promise<Uint8Array> {
      if (!enabled) throw new ProviderError('ELEVENLABS_DISABLED', 403);
      const auth = object(value);
      const fields = ['id', 'text', 'revision', 'voice', 'rate', 'provider', 'preview'];
      if (!auth || Object.keys(auth).length !== fields.length || !fields.every(k => Object.hasOwn(auth, k))
        || auth.provider !== 'elevenlabs' || typeof auth.id !== 'string' || !/^[A-Za-z0-9:-]{8,160}$/.test(auth.id)
        || typeof auth.text !== 'string' || !auth.text.trim() || auth.text.length > 4096
        || !Number.isSafeInteger(auth.revision) || Number(auth.revision) < 0 || ![0.75, 1, 1.2].includes(Number(auth.rate))
        || typeof auth.rate !== 'number' || typeof auth.preview !== 'boolean'
        || (auth.preview && auth.text !== PREVIEW_TEXT) || !voiceId(auth.voice)) throw new ProviderError('INVALID_SPEECH_AUTHORIZATION', 422);
      if (!modelVerified || !voices.some(v => v.id === auth.voice && v.available)) throw new ProviderError('VOICE_NOT_VERIFIED', 409);
      if (consumed.has(auth.id)) throw new ProviderError('AUTHORIZATION_ALREADY_USED', 409);
      if (inFlight) throw new ProviderError('SPEECH_BUSY', 409);
      if (characters + auth.text.length > 10_000 || consumed.size >= 100) throw new ProviderError('SESSION_LIMIT_REACHED', 429);
      const approved = auth as unknown as Authorization;
      consumed.add(approved.id); characters += approved.text.length; inFlight = true;
      const bounded = AbortSignal.any([signal, AbortSignal.timeout(12_000)]);
      try {
        const response = await request(`/v1/text-to-speech/${approved.voice}/stream?output_format=mp3_44100_128`, bounded, {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ text: approved.text,
            model_id: modelForVoice(approved.voice), apply_text_normalization: 'off', voice_settings: { stability: 0.5, similarity_boost: 0.75, style: 0, use_speaker_boost: false, speed: approved.rate } }),
        });
        if (!response.headers.get('content-type')?.startsWith('audio/')) { await response.body?.cancel(); throw new ProviderError('INVALID_AUDIO_RESPONSE', 502); }
        const audio = await boundedBody(response, 8 * 1024 * 1024, bounded);
        if (!audio.length) throw new ProviderError('EMPTY_AUDIO_RESPONSE', 502);
        return audio;
      } catch (error) {
        if (error instanceof ProviderError) throw error;
        // Do not retain or surface SDK/provider messages: they may contain keys or text.
        throw new ProviderError(bounded.aborted ? 'ELEVENLABS_CANCELLED_OR_TIMEOUT' : 'ELEVENLABS_UNAVAILABLE');
      } finally { inFlight = false; }
    },
  };
}
