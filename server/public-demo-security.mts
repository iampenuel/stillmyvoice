// SPDX-License-Identifier: AGPL-3.0-or-later
/** Server-only access and durable spend boundary. Never stores authored content, audio or raw IPs. */
import { createHash, createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';
import { boundedBody, ProviderError } from './elevenlabs.mts';
import { registerPublicReservation, retirePublicReservation } from './public-demo-permit.mts';

export const PUBLIC_DEMO_NAMESPACE = 'smv:{public-demo:hp26}:usage-v1';
export const PUBLIC_SESSION_MS = 2 * 60 * 60 * 1000;
export const PUBLIC_REQUEST_DEADLINE_MS = 15_000;
export const PUBLIC_LOCK_MS = 30_000;
export const PUBLIC_COOKIE_NAME = '__Host-smv-demo';
export type PublicProvider = 'gemini' | 'speech' | 'scribe' | 'metadata';
export type PublicDemoSession = Readonly<{ id: string; clientKey: string; expiresAt: number }>;
export type PublicReservation = Readonly<{ token: string; provider: PublicProvider; sessionId: string; deadlineAt: number; requestId: string; units: number }>;
type Limit = Readonly<{ requests: number; units: number }>;
export const PUBLIC_LIMITS: Readonly<Record<PublicProvider, Readonly<{ global: Limit; client: Limit; session: Limit }>>> = Object.freeze({
  gemini: { global: { requests: 300, units: 300 }, client: { requests: 40, units: 40 }, session: { requests: 20, units: 20 } },
  speech: { global: { requests: 100, units: 10_000 }, client: { requests: 40, units: 4_000 }, session: { requests: 20, units: 2_000 } },
  scribe: { global: { requests: 6, units: 120_000 }, client: { requests: 4, units: 80_000 }, session: { requests: 3, units: 60_000 } },
  metadata: { global: { requests: 100, units: 100 }, client: { requests: 20, units: 20 }, session: { requests: 10, units: 10 } },
});
export type PublicBudgetStatus = { namespace: string; scope: 'shared-public-demo' } & Record<PublicProvider, { requests: number; requestLimit: number; units: number; unitLimit: number }>;
export class PublicDemoSecurityError extends ProviderError {
  constructor(code: string, status = 503, retryAfterSeconds?: number) {
    super(code, status, { source: 'app', ...(retryAfterSeconds === undefined ? {} : { retryAfterSeconds }) });
  }
}
const cookieAttributes = 'Path=/; HttpOnly; Secure; SameSite=Strict';
const digestPattern = /^[a-f0-9]{64}$/;
const idPattern = /^[A-Za-z0-9:-]{8,160}$/;
const providers: readonly PublicProvider[] = ['gemini', 'speech', 'scribe', 'metadata'];
// Fixed namespace intentionally survives sessions, process restarts and Git deployments.
// Never expire/refund global/client usage or replay tombstones: uncertain provider outcomes consume budget.
export const PUBLIC_LOGIN_LUA = `
local maximum = {100, 5}
local retry = 0
for i = 1, 2 do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('PEXPIRE', KEYS[i], 900000) end
  if count > maximum[i] then retry = math.max(retry, redis.call('PTTL', KEYS[i])) end
end
if retry > 0 then return {'RATE', tostring(retry)} end
return {'OK'}
`;
export const PUBLIC_RESERVE_LUA = `
local rateMaximum = {60, 20, 12}
local retry = 0
for i = 1, 3 do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('PEXPIRE', KEYS[i], 60000) end
  if count > rateMaximum[i] then retry = math.max(retry, redis.call('PTTL', KEYS[i])) end
end
if retry > 0 then return {'RATE', tostring(retry)} end
if redis.call('EXISTS', KEYS[11]) == 1 then return {'REVOKED'} end
if redis.call('EXISTS', KEYS[7]) == 1 then return {'REPLAY'} end
if redis.call('EXISTS', KEYS[8]) == 1 or redis.call('EXISTS', KEYS[9]) == 1 then return {'BUSY'} end
local clock = redis.call('TIME')
local now = tonumber(clock[1]) * 1000 + math.floor(tonumber(clock[2]) / 1000)
local cooldown = tonumber(redis.call('GET', KEYS[10]) or '0')
if ARGV[1] == 'gemini' and cooldown > now then return {'COOLDOWN', tostring(cooldown - now)} end
local requestsField = ARGV[1] .. ':requests'
local unitsField = ARGV[1] .. ':units'
for i = 1, 3 do
  local requests = tonumber(redis.call('HGET', KEYS[i + 3], requestsField) or '0')
  local units = tonumber(redis.call('HGET', KEYS[i + 3], unitsField) or '0')
  if requests + 1 > tonumber(ARGV[i * 2 + 1]) or units + tonumber(ARGV[2]) > tonumber(ARGV[i * 2 + 2]) then return {'BUDGET'} end
end
redis.call('SET', KEYS[7], 'consumed')
for i = 4, 6 do
  redis.call('HINCRBY', KEYS[i], requestsField, 1)
  redis.call('HINCRBY', KEYS[i], unitsField, ARGV[2])
end
redis.call('PEXPIRE', KEYS[6], 10800000)
redis.call('SET', KEYS[8], ARGV[9], 'PX', ARGV[10])
redis.call('SET', KEYS[9], ARGV[9], 'PX', ARGV[10])
if ARGV[1] == 'gemini' then redis.call('SET', KEYS[10], tostring(now + 5000), 'PX', 5000) end
return {'OK'}
`;
export const PUBLIC_RELEASE_LUA = `
for i = 1, 2 do
  if redis.call('GET', KEYS[i]) == ARGV[1] then redis.call('DEL', KEYS[i]) end
end
return {'OK'}
`;
const statusLua = `
local count = redis.call('INCR', KEYS[2])
if count == 1 then redis.call('PEXPIRE', KEYS[2], 60000) end
if count > 120 then return {'RATE', tostring(redis.call('PTTL', KEYS[2]))} end
return redis.call('HMGET', KEYS[1], 'gemini:requests', 'gemini:units', 'speech:requests', 'speech:units', 'scribe:requests', 'scribe:units', 'metadata:requests', 'metadata:units')`;
const activeLua = `
local maximum = {120, 60, 30}
local retry = 0
for i = 2, 4 do
  local count = redis.call('INCR', KEYS[i])
  if count == 1 then redis.call('PEXPIRE', KEYS[i], 60000) end
  if count > maximum[i - 1] then retry = math.max(retry, redis.call('PTTL', KEYS[i])) end
end
if retry > 0 then return {'RATE', tostring(retry)} end
return {'OK', redis.call('EXISTS', KEYS[1])}`;
const revokeLua = `redis.call('SET', KEYS[1], 'revoked', 'PX', ARGV[1]); return {'OK'}`;
type Env = Record<string, string | undefined>;
type Headers = Record<string, string | string[] | undefined>;
function redisConfiguration(env: Env): { url: string; token: string } | null {
  const url = env.UPSTASH_REDIS_REST_URL || env.KV_REST_API_URL;
  const token = env.UPSTASH_REDIS_REST_TOKEN || env.KV_REST_API_TOKEN;
  if (!url || !token || token.length < 16 || token.length > 4096 || /\s/.test(token)) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:' || !/^[a-z0-9-]+\.upstash\.io$/.test(parsed.hostname) || parsed.port || parsed.username || parsed.password || parsed.search || parsed.hash || !['', '/'].includes(parsed.pathname)) return null;
    return { url: parsed.origin, token };
  } catch { return null; }
}
/** No SDK retry middleware: each Redis operation is one bounded HTTPS request. */
export function createPublicDemoSecurity(env: Env, options: { fetcher?: typeof fetch; now?: () => number } = {}) {
  const fetcher = options.fetcher ?? fetch, now = options.now ?? Date.now;
  const redis = redisConfiguration(env), secret = env.SMV_DEMO_SESSION_SECRET ?? '', access = env.SMV_DEMO_ACCESS_CODE ?? '';
  const configured = env.VERCEL === '1' && env.SMV_CLOUD_MODE === 'public-demo' && secret.length >= 32 && secret.length <= 512 && !/\s/.test(secret)
    && access.length >= 12 && access.length <= 128 && /^[\x21-\x7e]+$/.test(access) && redis !== null;
  const hmac = (value: string) => createHmac('sha256', secret).update(value).digest('hex');
  const requireConfigured = () => { if (!configured) throw new PublicDemoSecurityError('DEMO_UNAVAILABLE'); };
  const key = (suffix: string) => PUBLIC_DEMO_NAMESPACE + ':' + suffix;
  const validClient = (client: string) => { if (!digestPattern.test(client)) throw new PublicDemoSecurityError('DEMO_CLIENT_UNAVAILABLE', 403); };
  const validSession = (session: PublicDemoSession, client?: string) => {
    if (!session || !/^[a-f0-9]{32}$/.test(session.id) || !digestPattern.test(session.clientKey) || !Number.isSafeInteger(session.expiresAt)
      || session.expiresAt <= now() || session.expiresAt > now() + PUBLIC_SESSION_MS || (client !== undefined && session.clientKey !== client)) throw new PublicDemoSecurityError('DEMO_ACCESS_REQUIRED', 401);
  };
  const revokedKey = (session: PublicDemoSession) => key('revoked:' + session.id);
  const command = async (script: string, keys: string[], args: (string | number)[] = [], signal?: AbortSignal): Promise<unknown> => {
    requireConfigured();
    const bounded = AbortSignal.any([AbortSignal.timeout(2500), ...(signal ? [signal] : [])]);
    try {
      bounded.throwIfAborted();
      const response = await fetcher(redis!.url, { method: 'POST', redirect: 'error', signal: bounded,
        headers: { Authorization: 'Bearer ' + redis!.token, 'Content-Type': 'application/json' },
        body: JSON.stringify(['EVAL', script, keys.length, ...keys, ...args.map(String)]) });
      if (!response.ok) { await response.body?.cancel(); throw Error(); }
      const parsed: unknown = JSON.parse(new TextDecoder().decode(await boundedBody(response, 16_384, bounded)));
      if (!parsed || typeof parsed !== 'object' || !('result' in parsed) || 'error' in parsed) throw Error();
      return parsed.result;
    } catch { throw new PublicDemoSecurityError('DEMO_QUOTA_UNAVAILABLE'); }
  };
  const interpret = (result: unknown) => {
    if (!Array.isArray(result) || typeof result[0] !== 'string') throw new PublicDemoSecurityError('DEMO_QUOTA_UNAVAILABLE');
    const retry = Math.min(900, Math.max(1, Math.ceil(Number(result[1] || 1000) / 1000)));
    switch (result[0]) {
      case 'OK': return;
      case 'RATE': throw new PublicDemoSecurityError('DEMO_RATE_LIMIT', 429, Number.isFinite(retry) ? retry : 60);
      case 'COOLDOWN': throw new PublicDemoSecurityError('ASSISTANCE_COOLDOWN', 429, Number.isFinite(retry) ? retry : 5);
      case 'REPLAY': throw new PublicDemoSecurityError('DEMO_REQUEST_ALREADY_CONSUMED', 409);
      case 'BUSY': throw new PublicDemoSecurityError('DEMO_REQUEST_BUSY', 409);
      case 'BUDGET': throw new PublicDemoSecurityError('DEMO_SHARED_BUDGET_EXHAUSTED', 429);
      case 'REVOKED': throw new PublicDemoSecurityError('DEMO_ACCESS_REQUIRED', 401);
      default: throw new PublicDemoSecurityError('DEMO_QUOTA_UNAVAILABLE');
    }
  };
  const cookieFor = (session: PublicDemoSession, issuedAt: number) => {
    const payload = Buffer.from(JSON.stringify({ v: 1, id: session.id, clientKey: session.clientKey, issuedAt, expiresAt: session.expiresAt })).toString('base64url');
    return PUBLIC_COOKIE_NAME + '=' + payload + '.' + hmac('session:' + payload) + '; ' + cookieAttributes + '; Max-Age=' + PUBLIC_SESSION_MS / 1000;
  };
  return {
    configured,
    clientKey(headers: Headers): string {
      requireConfigured();
      // Only the Vercel edge-supplied address is trusted. No arbitrary Forwarded/X-Real-IP fallback.
      const ip = headers['x-vercel-forwarded-for'];
      if (typeof ip !== 'string' || ip.length > 64 || !isIP(ip)) throw new PublicDemoSecurityError('DEMO_CLIENT_UNAVAILABLE', 403);
      return hmac('client:' + ip.toLowerCase());
    },
    authenticateCookie(cookie: string | undefined, client: string): PublicDemoSession | null {
      if (!configured || !cookie || cookie.length > 4096 || !digestPattern.test(client)) return null;
      const tokens = cookie.split(';').map(part => part.trim()).filter(part => part.startsWith(PUBLIC_COOKIE_NAME + '='));
      if (tokens.length !== 1) return null;
      const value = tokens[0].slice(PUBLIC_COOKIE_NAME.length + 1), parts = value.split('.');
      if (parts.length !== 2 || !/^[A-Za-z0-9_-]{1,1024}$/.test(parts[0]) || !digestPattern.test(parts[1])) return null;
      const expected = Buffer.from(hmac('session:' + parts[0]), 'hex');
      if (!timingSafeEqual(expected, Buffer.from(parts[1], 'hex'))) return null;
      try {
        const decoded = Buffer.from(parts[0], 'base64url');
        if (decoded.toString('base64url') !== parts[0]) return null;
        const parsed = JSON.parse(decoded.toString('utf8'));
        if (!parsed || Object.keys(parsed).sort().join(',') !== 'clientKey,expiresAt,id,issuedAt,v' || parsed.v !== 1 || !Number.isSafeInteger(parsed.issuedAt)
          || parsed.issuedAt > now() || parsed.expiresAt - parsed.issuedAt !== PUBLIC_SESSION_MS) return null;
        const session = Object.freeze({ id: parsed.id, clientKey: parsed.clientKey, expiresAt: parsed.expiresAt });
        validSession(session, client); return session;
      } catch { return null; }
    },
    async authorize(code: unknown, client: string, signal?: AbortSignal): Promise<{ session: PublicDemoSession; cookie: string }> {
      requireConfigured(); validClient(client);
      interpret(await command(PUBLIC_LOGIN_LUA, [key('login:global'), key('login:client:' + client)], [], signal));
      // Compare fixed-length digests only after the durable attempt limiter, including malformed attempts.
      const submitted = typeof code === 'string' && code.length <= 128 ? code : '';
      if (!timingSafeEqual(Buffer.from(hmac('access:' + access), 'hex'), Buffer.from(hmac('access:' + submitted), 'hex'))) throw new PublicDemoSecurityError('DEMO_ACCESS_DENIED', 401);
      const issuedAt = now(), session = Object.freeze({ id: randomBytes(16).toString('hex'), clientKey: client, expiresAt: issuedAt + PUBLIC_SESSION_MS });
      return { session, cookie: cookieFor(session, issuedAt) };
    },
    async sessionActive(session: PublicDemoSession, signal?: AbortSignal): Promise<boolean> {
      requireConfigured(); validSession(session);
      const result = await command(activeLua, [revokedKey(session), key('read:global'), key('read:client:' + session.clientKey), key('read:session:' + session.id)], [], signal);
      interpret(result);
      if (!Array.isArray(result) || (result[1] !== 0 && result[1] !== 1)) throw new PublicDemoSecurityError('DEMO_QUOTA_UNAVAILABLE');
      return result[1] === 0;
    },
    async revoke(session: PublicDemoSession, signal?: AbortSignal): Promise<void> {
      requireConfigured(); validSession(session);
      interpret(await command(revokeLua, [revokedKey(session)], [Math.max(1, session.expiresAt - now())], signal));
    },
    clearCookie: () => PUBLIC_COOKIE_NAME + '=; ' + cookieAttributes + '; Max-Age=0',
    async reserve(input: { session: PublicDemoSession; clientKey: string; id: string; provider: PublicProvider; units?: number }, signal?: AbortSignal): Promise<PublicReservation> {
      requireConfigured(); validClient(input.clientKey); validSession(input.session, input.clientKey);
      if (!providers.includes(input.provider) || typeof input.id !== 'string' || !idPattern.test(input.id)) throw new PublicDemoSecurityError('INVALID_REQUEST', 422);
      const units = input.provider === 'scribe' ? 20_000 : input.provider === 'speech' ? input.units : 1;
      if (!Number.isSafeInteger(units) || Number(units) < 1 || (input.provider === 'speech' && Number(units) > 4096)) throw new PublicDemoSecurityError('INVALID_REQUEST', 422);
      const limits = PUBLIC_LIMITS[input.provider], token = randomBytes(16).toString('hex');
      const keys = [key('rate:global'), key('rate:client:' + input.clientKey), key('rate:session:' + input.session.id),
        key('budget:global'), key('budget:client:' + input.clientKey), key('budget:session:' + input.session.id),
        key('replay:' + createHash('sha256').update('request:' + input.provider + ':' + input.id).digest('hex')), key('lock:provider:' + input.provider),
        key('lock:session:' + input.session.id), key('cooldown:gemini'), revokedKey(input.session)];
      interpret(await command(PUBLIC_RESERVE_LUA, keys, [input.provider, Number(units), limits.global.requests, limits.global.units,
        limits.client.requests, limits.client.units, limits.session.requests, limits.session.units, token, PUBLIC_LOCK_MS], signal));
      return registerPublicReservation(Object.freeze({ token, provider: input.provider, sessionId: input.session.id, deadlineAt: now() + PUBLIC_REQUEST_DEADLINE_MS, requestId: input.id, units: Number(units) }));
    },
    async release(reservation: PublicReservation, signal?: AbortSignal): Promise<void> {
      requireConfigured();
      if (!reservation || !providers.includes(reservation.provider) || !/^[a-f0-9]{32}$/.test(reservation.token) || !/^[a-f0-9]{32}$/.test(reservation.sessionId)) throw new PublicDemoSecurityError('INVALID_REQUEST', 422);
      retirePublicReservation(reservation);
      interpret(await command(PUBLIC_RELEASE_LUA, [key('lock:provider:' + reservation.provider), key('lock:session:' + reservation.sessionId)], [reservation.token], signal));
    },
    async status(signal?: AbortSignal): Promise<PublicBudgetStatus> {
      const result = await command(statusLua, [key('budget:global'), key('read:global')], [], signal);
      if (Array.isArray(result) && result[0] === 'RATE') interpret(result);
      if (!Array.isArray(result) || result.length !== 8) throw new PublicDemoSecurityError('DEMO_QUOTA_UNAVAILABLE');
      const output = { namespace: PUBLIC_DEMO_NAMESPACE, scope: 'shared-public-demo' } as PublicBudgetStatus;
      providers.forEach((provider, i) => {
        const requests = Number(result[i * 2] ?? 0), units = Number(result[i * 2 + 1] ?? 0);
        if (!Number.isSafeInteger(requests) || requests < 0 || !Number.isSafeInteger(units) || units < 0) throw new PublicDemoSecurityError('DEMO_QUOTA_UNAVAILABLE');
        output[provider] = { requests, units, requestLimit: PUBLIC_LIMITS[provider].global.requests, unitLimit: PUBLIC_LIMITS[provider].global.units };
      });
      return output;
    },
  };
}
