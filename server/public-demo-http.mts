/** Authenticated public demonstration boundary. No dotenv, private gate files or content logging. */
import { randomUUID } from 'node:crypto';
import { createElevenLabs, ProviderError, validateSpeechAuthorization } from './elevenlabs.mts';
import { createGemini, validateAssistRequest } from './gemini.mts';
import { createScribe } from './scribe.mts';
import { googleGenerator } from './google-sdk.mts';
import { validateExpansionRequest } from './expansion.mts';
import { validatePublicRecording } from './public-demo-audio.mts';
import { createPublicDemoSecurity, type PublicReservation } from './public-demo-security.mts';
import { approvedVoices } from '../src/communication/cloud-contract.mts';
import type { PublicProviderPermit } from './public-demo-permit.mts';
import type { Authorization } from '../src/communication/model.mts';

export type PublicProviders = {
  eleven: Pick<ReturnType<typeof createElevenLabs>, 'status' | 'listVoices' | 'synthesize'>;
  gemini: Pick<ReturnType<typeof createGemini>, 'status' | 'suggest' | 'expand'>;
  scribe: Pick<ReturnType<typeof createScribe>, 'status' | 'transcribe'>;
};
type Security = ReturnType<typeof createPublicDemoSecurity>;
const jsonHeaders = { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Vary': 'Cookie, Origin' };
const json = (value: unknown, status = 200, extra: Record<string, string> = {}) => new Response(JSON.stringify(value), { status, headers: { ...jsonHeaders, ...extra } });
const object = (value: unknown): Record<string, unknown> | null => value !== null && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : null;

export async function boundedPublicJson(request: Request, maximum: number, signal: AbortSignal): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/i.test(request.headers.get('content-type') ?? '')) throw new ProviderError('JSON_REQUIRED', 415);
  if (request.headers.get('content-encoding') && request.headers.get('content-encoding') !== 'identity') throw new ProviderError('CONTENT_ENCODING_NOT_ALLOWED', 415);
  const stated = request.headers.get('content-length');
  if (stated !== null && (!/^\d+$/.test(stated) || Number(stated) > maximum)) throw new ProviderError('REQUEST_TOO_LARGE', 413);
  if (!request.body) throw new ProviderError('INVALID_JSON', 400);
  const reader = request.body.getReader(), parts: Uint8Array[] = [];
  let length = 0;
  const abort = () => { void reader.cancel(); };
  signal.addEventListener('abort', abort, { once: true });
  try {
    while (true) {
      signal.throwIfAborted(); const part = await reader.read(); signal.throwIfAborted();
      if (part.done) break;
      length += part.value.byteLength;
      if (length > maximum) throw new ProviderError('REQUEST_TOO_LARGE', 413);
      parts.push(part.value);
    }
    const bytes = new Uint8Array(length); let offset = 0;
    for (const part of parts) { bytes.set(part, offset); offset += part.byteLength; }
    try {
      const parsed = object(JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes)));
      if (!parsed) throw Error();
      return parsed;
    } catch { throw new ProviderError('INVALID_JSON', 400); }
  } finally { signal.removeEventListener('abort', abort); await reader.cancel().catch(() => {}); reader.releaseLock(); }
}

/** Validate the exact authorized utterance before reserving its complete character cost. */
export function validatePublicSpeech(value: unknown): Authorization {
  const auth = validateSpeechAuthorization(value);
  if (!approvedVoices.some(voice => voice.id === auth.voice)) throw new ProviderError('INVALID_SPEECH_AUTHORIZATION', 422);
  return auth;
}
const providersFor = (env: Record<string, string | undefined>, permit?: PublicProviderPermit): PublicProviders => ({
  eleven: createElevenLabs(env, fetch, permit), gemini: createGemini(env, googleGenerator(env.GEMINI_API_KEY), permit), scribe: createScribe(env, fetch, permit),
});
const lockedStatus = (configured: boolean) => ({ access: { configured, authorized: false },
  elevenlabs: { available: false, metadataAvailable: false, reason: configured ? 'Demo access is locked' : 'Public demo is not configured' },
  gemini: { available: false, reason: configured ? 'Demo access is locked' : 'Public demo is not configured' }, scribe: { available: false } });

export function createPublicDemoHandler(env: Record<string, string | undefined>, dependencies: { security?: Security; providers?: (permit?: PublicProviderPermit) => PublicProviders } = {}) {
  const security = dependencies.security ?? createPublicDemoSecurity(env);
  const createProviders = dependencies.providers ?? ((permit?: PublicProviderPermit) => providersFor(env, permit));
  const origins = new Set(['https://stillmyvoice.club', 'https://stillmyvoice.vercel.app']);
  return async (request: Request): Promise<Response> => {
    let reservation: PublicReservation | undefined, providerComplete = false;
    const signal = AbortSignal.any([request.signal, AbortSignal.timeout(15_000)]);
    try {
      signal.throwIfAborted();
      const url = new URL(request.url), origin = request.headers.get('origin');
      if (!origins.has(url.origin) || (request.headers.has('host') && request.headers.get('host') !== url.host)) throw new ProviderError('PUBLIC_HOST_REQUIRED', 403);
      // Vercel's [...route] adapter appends this exact path-derived routing value.
      const routeEntries = [...url.searchParams];
      const routingOnly = routeEntries.length === 1 && ['route', '...route', '[...route]'].includes(routeEntries[0][0]) && routeEntries[0][1] === url.pathname.slice('/api/'.length);
      if (url.search && !routingOnly) throw new ProviderError('QUERY_PARAMETERS_NOT_ALLOWED', 400);
      if (request.headers.get('sec-fetch-site') === 'cross-site' || (origin !== null && origin !== url.origin)
        || (request.method !== 'GET' && origin !== url.origin)) throw new ProviderError('SAME_ORIGIN_REQUIRED', 403);
      if (!['GET', 'POST', 'DELETE'].includes(request.method)) throw new ProviderError('METHOD_NOT_ALLOWED', 405);
      const path = url.pathname;
      if (!['/api/demo-access', '/api/status', '/api/voices', '/api/speech', '/api/transcription', '/api/expansion', '/api/suggestions'].includes(path)) return json({ error: 'NOT_FOUND' }, 404);
      if (!security.configured) {
        if (path === '/api/status' && request.method === 'GET') return json(lockedStatus(false));
        if (path === '/api/demo-access' && request.method === 'GET') return json({ configured: false, authorized: false });
        if (path === '/api/demo-access' && request.method === 'DELETE') return json({ configured: false, authorized: false }, 200, { 'Set-Cookie': security.clearCookie() });
        throw new ProviderError('PUBLIC_DEMO_NOT_CONFIGURED', 503);
      }
      const clientKey = security.clientKey(Object.fromEntries(request.headers));
      const session = security.authenticateCookie(request.headers.get('cookie') ?? undefined, clientKey);
      if (path === '/api/demo-access') {
        if (request.method === 'GET') {
          const authorized = !!session && await security.sessionActive(session, signal);
          return json({ configured: security.configured, authorized, ...(authorized ? { expiresAt: session!.expiresAt } : {}) });
        }
        if (request.method === 'DELETE') {
          if (session) await security.revoke(session, signal);
          return json({ configured: security.configured, authorized: false }, 200, { 'Set-Cookie': security.clearCookie() });
        }
        const payload = await boundedPublicJson(request, 2048, signal);
        if (Object.keys(payload).join(',') !== 'code') throw new ProviderError('INVALID_DEMO_ACCESS', 422);
        const granted = await security.authorize(payload.code, clientKey, signal);
        return json({ configured: security.configured, authorized: true, expiresAt: granted.session.expiresAt }, 200, { 'Set-Cookie': granted.cookie });
      }
      if (path === '/api/status' && request.method === 'GET') {
        if (!security.configured || !session || !await security.sessionActive(session, signal)) return json(lockedStatus(security.configured));
        const budget = await security.status(signal), providers = createProviders();
        const eleven = providers.eleven.status(), gemini = providers.gemini.status(), scribe = providers.scribe.status();
        return json({ access: { configured: security.configured, authorized: true, expiresAt: session.expiresAt },
          elevenlabs: { available: eleven.available, metadataAvailable: eleven.available, reason: eleven.reason, model: eleven.model,
            usageScope: budget.scope, charactersSubmitted: budget.speech.units, characterLimit: budget.speech.unitLimit },
          gemini: { available: gemini.available, reason: gemini.reason, model: gemini.model, usageScope: budget.scope,
            requests: budget.gemini.requests, requestLimit: budget.gemini.requestLimit },
          scribe: { available: scribe.available, model: scribe.model, usageScope: budget.scope,
            requests: budget.scribe.requests, requestLimit: budget.scribe.requestLimit, reservedMs: budget.scribe.units, durationLimitMs: budget.scribe.unitLimit },
          budget, providerQuotaRemainingKnown: false });
      }
      if (request.method !== 'POST') throw new ProviderError('METHOD_NOT_ALLOWED', 405);
      if (!security.configured) throw new ProviderError('PUBLIC_DEMO_NOT_CONFIGURED', 503);
      if (!session) throw new ProviderError('DEMO_ACCESS_REQUIRED', 401);
      const payload = await boundedPublicJson(request, path === '/api/transcription' ? 900_000 : 32_768, signal);
      let providers = createProviders();
      if (path === '/api/voices') {
        if (Object.keys(payload).join(',') !== 'cloudConsent' || payload.cloudConsent !== true) throw new ProviderError('CLOUD_CONSENT_REQUIRED', 422);
        if (!providers.eleven.status().available) throw new ProviderError('ELEVENLABS_DISABLED', 403);
        reservation = await security.reserve({ session, clientKey, id: 'metadata:' + randomUUID(), provider: 'metadata', units: 1 }, signal);
        signal.throwIfAborted(); providers = createProviders(reservation);
        const voices = await providers.eleven.listVoices(signal); signal.throwIfAborted(); providerComplete = true;
        return json({ voices });
      }
      if (path === '/api/speech') {
        if (Object.keys(payload).sort().join(',') !== 'authorization,cloudConsent' || payload.cloudConsent !== true) throw new ProviderError('CLOUD_CONSENT_REQUIRED', 422);
        const auth = validatePublicSpeech(payload.authorization);
        if (!providers.eleven.status().available) throw new ProviderError('ELEVENLABS_DISABLED', 403);
        reservation = await security.reserve({ session, clientKey, id: auth.id, provider: 'speech', units: auth.text.length }, signal);
        signal.throwIfAborted(); providers = createProviders(reservation);
        // Every instance verifies the six approved identities/models before exact speech.
        await providers.eleven.listVoices(signal);
        const audio = await providers.eleven.synthesize(auth, signal); signal.throwIfAborted();
        if (audio.byteLength > 3_000_000) throw new ProviderError('PROVIDER_RESPONSE_TOO_LARGE', 502);
        providerComplete = true;
        return new Response(new Uint8Array(audio), { headers: { ...jsonHeaders, 'Content-Type': 'audio/mpeg' } });
      }
      if (path === '/api/transcription') {
        const { request: recording } = validatePublicRecording(payload);
        if (!providers.scribe.status().available) throw new ProviderError('SCRIBE_DISABLED', 403);
        reservation = await security.reserve({ session, clientKey, id: recording.id, provider: 'scribe', units: 20_000 }, signal);
        signal.throwIfAborted(); providers = createProviders(reservation);
        const transcript = await providers.scribe.transcribe(recording, signal); signal.throwIfAborted(); providerComplete = true;
        return json(transcript);
      }
      if (path === '/api/expansion' || path === '/api/suggestions') {
        const validated = path === '/api/expansion' ? validateExpansionRequest(payload) : validateAssistRequest(payload);
        if (!providers.gemini.status().available) throw new ProviderError('GEMINI_DISABLED', 403);
        reservation = await security.reserve({ session, clientKey, id: validated.id, provider: 'gemini', units: 1 }, signal);
        signal.throwIfAborted(); providers = createProviders(reservation);
        if (path === '/api/expansion') {
          const expansion = await providers.gemini.expand(validated, signal); signal.throwIfAborted(); providerComplete = true; return json(expansion);
        }
        const suggestions = await providers.gemini.suggest(validated, signal); signal.throwIfAborted(); providerComplete = true;
        return json({ suggestions });
      }
      return json({ error: 'NOT_FOUND' }, 404);
    } catch (error) {
      const known = error instanceof ProviderError;
      const code = known && /^[A-Z][A-Z0-9_]{1,80}$/.test(error.code) ? error.code : 'REQUEST_CANCELLED_OR_UNAVAILABLE';
      return json({ error: code, ...(known ? error.metadata : {}) }, known ? error.status : 503);
    } finally {
      // Usage/replay records are never refunded. Unknown failure/cancellation keeps
      // the full durable lease: aborting HTTP does not prove provider work stopped.
      if (reservation && providerComplete && !signal.aborted) await security.release(reservation, AbortSignal.timeout(2500)).catch(() => {});
    }
  };
}
