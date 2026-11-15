import type { IncomingMessage, ServerResponse } from 'node:http';
import { ProviderError, type createElevenLabs } from './elevenlabs.mts';
import type { createGemini } from './gemini.mts';
import type { createScribe } from './scribe.mts';
type Eleven = ReturnType<typeof createElevenLabs>;
type Gemini = ReturnType<typeof createGemini>;
const origins = new Set(['http://127.0.0.1:5173', 'http://localhost:5173', 'http://127.0.0.1:4173', 'http://localhost:4173']);
const hosts = new Set(['127.0.0.1:5174', 'localhost:5174', '127.0.0.1:4173', 'localhost:4173']);
function send(res: ServerResponse, code: number, body: unknown) {
  if (res.destroyed || res.writableEnded) return;
  res.writeHead(code, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' });
  res.end(JSON.stringify(body));
}
async function body(req: IncomingMessage, limit=32_768): Promise<Record<string, unknown>> {
  if (!/^application\/json(?:;|$)/i.test(req.headers['content-type'] ?? '')) throw new ProviderError('JSON_REQUIRED', 415);
  const text = await new Promise<string>((resolve, reject) => {
    const chunks: Buffer[] = []; let size = 0;
    const cleanup = () => { req.removeListener('data', data); req.removeListener('end', end); req.removeListener('error', error); };
    const error = () => { cleanup(); reject(new ProviderError('INVALID_REQUEST', 400)); };
    const data = (chunk: Buffer) => {
      size += chunk.length;
      if (size > limit) { cleanup(); req.resume(); reject(new ProviderError('REQUEST_TOO_LARGE', 413)); }
      else chunks.push(chunk);
    };
    const end = () => { cleanup(); resolve(Buffer.concat(chunks).toString('utf8')); };
    req.on('data', data); req.once('end', end); req.once('error', error);
  });
  try {
    const value: unknown = JSON.parse(text);
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error();
    return value as Record<string, unknown>;
  } catch { throw new ProviderError('INVALID_JSON', 400); }
}
/** Loopback development API. No CORS, arbitrary upstream URLs, public binding or content logs. */
export function createApiHandler(eleven: Eleven, gemini: Gemini, scribe?: ReturnType<typeof createScribe>) {
  let minute = Date.now(), requests = 0;
  return async (req: IncomingMessage, res: ServerResponse) => {
    if (!hosts.has(req.headers.host ?? '')) { send(res, 403, { error: 'LOCAL_HOST_REQUIRED' }); return; }
    if (req.method === 'GET' && req.url === '/api/status') { send(res, 200, { elevenlabs: eleven.status(), gemini: gemini.status(), scribe: scribe?.status() ?? { available:false,model:'scribe_v3' } }); return; }
    if (req.method !== 'POST') { send(res, 405, { error: 'METHOD_NOT_ALLOWED' }); return; }
    if (!origins.has(req.headers.origin ?? '') || req.headers['sec-fetch-site'] === 'cross-site') { send(res, 403, { error: 'SAME_ORIGIN_REQUIRED' }); return; }
    if (Date.now() - minute >= 60_000) { minute = Date.now(); requests = 0; }
    if (++requests > 60) { send(res, 429, { error: 'LOCAL_RATE_LIMIT' }); return; }
    const abort = new AbortController();
    const disconnected = () => { if (!res.writableEnded) abort.abort(); };
    res.once('close', disconnected); req.once('aborted', disconnected);
    const signal = AbortSignal.any([abort.signal, AbortSignal.timeout(15_000)]);
    try {
      const payload = await body(req,req.url==='/api/transcription'?1_500_000:32_768);
      if (req.url === '/api/voices') {
        if (Object.keys(payload).length !== 0) throw new ProviderError('INVALID_REQUEST', 422);
        send(res, 200, { voices: await eleven.listVoices(signal) });
      } else if (req.url === '/api/speech') {
        if (Object.keys(payload).sort().join(',') !== 'authorization,cloudConsent' || payload.cloudConsent !== true) throw new ProviderError('CLOUD_CONSENT_REQUIRED', 422);
        const audio = await eleven.synthesize(payload.authorization, signal);
        signal.throwIfAborted();
        if (!res.destroyed) { res.writeHead(200, { 'Content-Type': 'audio/mpeg', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff' }); res.end(audio); }
      } else if (req.url === '/api/transcription') {
        if(!scribe) throw new ProviderError('SCRIBE_DISABLED',403);
        send(res,200,await scribe.transcribe(payload,signal));
      } else if (req.url === '/api/expansion') {
        send(res, 200, await gemini.expand(payload, signal));
      } else if (req.url === '/api/suggestions') {
        send(res, 200, { suggestions: await gemini.suggest(payload, signal) });
      } else send(res, 404, { error: 'NOT_FOUND' });
    } catch (error) {
      send(res, error instanceof ProviderError ? error.status : 503, { error: error instanceof ProviderError ? error.code : 'REQUEST_CANCELLED_OR_UNAVAILABLE' });
    } finally { res.removeListener('close', disconnected); req.removeListener('aborted', disconnected); }
  };
}
