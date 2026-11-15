import test from 'node:test';
import assert from 'node:assert/strict';
import { execFile, spawn, spawnSync } from 'node:child_process';
import { promisify } from 'node:util';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { createPublicDemoSecurity, PUBLIC_COOKIE_NAME, PUBLIC_DEMO_NAMESPACE, PUBLIC_LIMITS, PUBLIC_SESSION_MS } from '../server/public-demo-security.mts';
import { consumePublicReservation } from '../server/public-demo-permit.mts';
const execute = promisify(execFile);
const env = { VERCEL: '1', SMV_CLOUD_MODE: 'public-demo', SMV_DEMO_ACCESS_CODE: 'fictional-judge-code', SMV_DEMO_SESSION_SECRET: 'a-fictional-test-secret-with-more-than-32-characters',
  UPSTASH_REDIS_REST_URL: 'https://fictional-test.upstash.io', UPSTASH_REDIS_REST_TOKEN: 'fictional-redis-token-not-a-real-credential' };
const headers = { 'x-vercel-forwarded-for': '192.0.2.1' };
const unavailableFetch: typeof fetch = async () => { throw Error('private infrastructure details'); };
const redisServer = ['/opt/homebrew/bin/redis-server', '/usr/bin/redis-server', 'redis-server'].find(binary => spawnSync(binary, ['--version'], { stdio: 'ignore' }).status === 0);
const redisCli = ['/opt/homebrew/bin/redis-cli', '/usr/bin/redis-cli', 'redis-cli'].find(binary => spawnSync(binary, ['--version'], { stdio: 'ignore' }).status === 0);
const errorCode = (code: string) => (error: unknown) => !!error && typeof error === 'object' && 'code' in error && error.code === code;

test('public security configuration fails closed and accepts only explicit public mode, strong secrets and hosted HTTPS Redis', () => {
  for (const changes of [{ VERCEL: undefined }, { SMV_CLOUD_MODE: 'local-synthetic-demo' }, { SMV_DEMO_ACCESS_CODE: 'short' },
    { SMV_DEMO_SESSION_SECRET: 'short' }, { UPSTASH_REDIS_REST_URL: 'http://localhost:6379' }, { UPSTASH_REDIS_REST_URL: 'https://attacker.example' },
    { UPSTASH_REDIS_REST_URL: 'https://fictional-test.upstash.io/private' }, { UPSTASH_REDIS_REST_TOKEN: '' }]) {
    const security = createPublicDemoSecurity({ ...env, ...changes }, { fetcher: unavailableFetch });
    assert.equal(security.configured, false); assert.equal(security.authenticateCookie('anything', 'a'.repeat(64)), null);
    assert.throws(() => security.clientKey(headers), errorCode('DEMO_UNAVAILABLE'));
  }
  const aliases = { ...env, UPSTASH_REDIS_REST_URL: undefined, UPSTASH_REDIS_REST_TOKEN: undefined,
    KV_REST_API_URL: env.UPSTASH_REDIS_REST_URL, KV_REST_API_TOKEN: env.UPSTASH_REDIS_REST_TOKEN };
  assert.equal(createPublicDemoSecurity(aliases).configured, true);
});
test('only the Vercel supplied address becomes a keyed digest; spoofable alternatives are rejected', () => {
  const security = createPublicDemoSecurity(env);
  const client = security.clientKey(headers); assert.match(client, /^[a-f0-9]{64}$/); assert.ok(!client.includes('192.0.2.1'));
  assert.equal(security.clientKey({ ...headers, 'x-forwarded-for': '203.0.113.2' }), client);
  for (const input of [{}, { 'x-forwarded-for': '192.0.2.1' }, { 'x-real-ip': '192.0.2.1' }, { 'x-vercel-forwarded-for': '192.0.2.1, 203.0.113.2' }, { 'x-vercel-forwarded-for': ['192.0.2.1'] }]) {
    assert.throws(() => security.clientKey(input), errorCode('DEMO_CLIENT_UNAVAILABLE'));
  }
});
test('Redis network/status/invalid-body failures are content-free, fail closed and never retry', async () => {
  for (const failure of ['network', 'status', 'body', 'command'] as const) {
    let calls = 0;
    const fetcher: typeof fetch = async (_url, init) => {
      calls++; assert.equal(init?.redirect, 'error'); assert.ok(init?.signal);
      if (failure === 'network') throw Error('private data');
      if (failure === 'status') return new Response('private error', { status: 500 });
      return new Response(failure === 'body' ? 'not-json' : JSON.stringify({ error: 'private command response' }));
    };
    const security = createPublicDemoSecurity(env, { fetcher });
    await assert.rejects(security.authorize(env.SMV_DEMO_ACCESS_CODE, security.clientKey(headers)), errorCode('DEMO_QUOTA_UNAVAILABLE'));
    assert.equal(calls, 1);
  }
});
test('already cancelled authorization does not contact Redis or issue a cookie', async () => {
  let calls = 0;
  const security = createPublicDemoSecurity(env, { fetcher: async () => { calls++; return new Response('{}'); } });
  await assert.rejects(security.authorize(env.SMV_DEMO_ACCESS_CODE, security.clientKey(headers), AbortSignal.abort()), errorCode('DEMO_QUOTA_UNAVAILABLE'));
  assert.equal(calls, 0);
});

test('actual Redis Lua atomically enforces authorization, durable budgets, replay and locks', { skip: !redisServer || !redisCli }, async t => {
  const directory = await mkdtemp(path.join(tmpdir(), 'smv-quota-test-')), socket = path.join(directory, 'redis.sock');
  const process = spawn(redisServer!, ['--port', '0', '--unixsocket', socket, '--unixsocketperm', '700', '--save', '', '--appendonly', 'no', '--dir', directory], { stdio: ['ignore', 'pipe', 'pipe'] });
  const ready = new Promise<void>((resolve, reject) => {
    const timer = setTimeout(() => reject(Error('Isolated Redis test server did not start')), 5000);
    process.stdout.on('data', chunk => { if (String(chunk).includes('Ready to accept connections')) { clearTimeout(timer); resolve(); } });
    process.once('error', error => { clearTimeout(timer); reject(error); });
    process.once('exit', code => { clearTimeout(timer); reject(Error('Isolated Redis exited ' + code)); });
  });
  const commands: unknown[][] = [];
  const command = async (...args: string[]): Promise<unknown> => JSON.parse((await execute(redisCli!, ['-s', socket, '--json', ...args], { maxBuffer: 1_000_000 })).stdout);
  const fetcher: typeof fetch = async (_url, init) => {
    const args = JSON.parse(String(init?.body)) as (string | number)[]; commands.push(args);
    assert.equal(args[0], 'EVAL'); assert.equal(init?.method, 'POST');
    return new Response(JSON.stringify({ result: await command(...args.map(String)) }));
  };
  let clock = Date.now();
  const create = () => createPublicDemoSecurity(env, { fetcher, now: () => clock });
  const login = async (security = create(), ip = '192.0.2.1') => {
    const clientKey = security.clientKey({ 'x-vercel-forwarded-for': ip });
    const auth = await security.authorize(env.SMV_DEMO_ACCESS_CODE, clientKey);
    return { security, clientKey, ...auth };
  };
  const reset = async () => { await command('FLUSHDB'); commands.length = 0; clock = Date.now(); };
  try {
    await ready;
    await t.test('attempt limits run before comparison and persist across service instances', async () => {
      await reset(); const security = create(), client = security.clientKey(headers);
      for (let i = 0; i < 5; i++) await assert.rejects(security.authorize('wrong-' + i, client), errorCode('DEMO_ACCESS_DENIED'));
      await assert.rejects(create().authorize(env.SMV_DEMO_ACCESS_CODE, client), errorCode('DEMO_RATE_LIMIT'));
      assert.equal(await command('GET', PUBLIC_DEMO_NAMESPACE + ':login:client:' + client), '6');
      const stored = JSON.stringify(commands); assert.ok(!stored.includes(env.SMV_DEMO_ACCESS_CODE)); assert.ok(!stored.includes('192.0.2.1'));
      assert.ok(!stored.includes('wrong-')); assert.ok(!stored.includes(env.SMV_DEMO_SESSION_SECRET));
    });
    await t.test('two-hour host-only cookie is authenticated, bound to client, expiring and tamper resistant', async () => {
      await reset(); const auth = await login();
      assert.match(auth.cookie, /^__Host-smv-demo=/); assert.match(auth.cookie, /HttpOnly; Secure; SameSite=Strict; Max-Age=7200$/); assert.ok(!auth.cookie.includes('Domain='));
      assert.equal(auth.session.expiresAt, clock + PUBLIC_SESSION_MS);
      const cookie = auth.cookie.split(';')[0], parsed = create().authenticateCookie(cookie, auth.clientKey); assert.deepEqual(parsed, auth.session);
      assert.equal(create().authenticateCookie(cookie, 'f'.repeat(64)), null);
      assert.equal(create().authenticateCookie(cookie + '; ' + cookie, auth.clientKey), null);
      assert.equal(create().authenticateCookie(cookie.slice(0, -1) + (cookie.endsWith('0') ? '1' : '0'), auth.clientKey), null);
      clock += PUBLIC_SESSION_MS; assert.equal(create().authenticateCookie(cookie, auth.clientKey), null);
    });
    await t.test('simultaneous instances admit one provider request and consume exactly one budget', async () => {
      await reset(); const users = await Promise.all(Array.from({ length: 8 }, (_, i) => login(create(), '192.0.2.' + (i + 1))));
      const results = await Promise.allSettled(users.map((user, i) => user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'parallel-request-' + i, provider: 'gemini' })));
      assert.equal(results.filter(result => result.status === 'fulfilled').length, 1);
      for (const result of results) if (result.status === 'rejected') assert.equal(result.reason.code, 'DEMO_REQUEST_BUSY');
      assert.equal((await create().status()).gemini.requests, 1);
      const success = results.find(result => result.status === 'fulfilled'); assert.ok(success?.status === 'fulfilled');
      assert.equal(success.value.deadlineAt, clock + 15_000);
      const ttl = await command('PTTL', PUBLIC_DEMO_NAMESPACE + ':lock:provider:gemini'); assert.ok(Number(ttl) > 0 && Number(ttl) <= 30_000);
      await users[0].security.release(success.value);
      await assert.rejects(users[1].security.reserve({ session: users[1].session, clientKey: users[1].clientKey, id: 'after-release-cooldown', provider: 'gemini' }), errorCode('ASSISTANCE_COOLDOWN'));
    });
    await t.test('only the successful durable receipt grants one operation bound to the reserved ID and units', async () => {
      await reset(); const user = await login();
      const receipt = await user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'exact-reservation-identity', provider: 'speech', units: 12 });
      assert.equal(consumePublicReservation({ ...receipt }, 'speech', { id: receipt.requestId, units: 12 }), false);
      assert.equal(consumePublicReservation(receipt, 'speech', { id: receipt.requestId, units: 13 }), false);
      assert.equal(consumePublicReservation(receipt, 'speech', { id: 'different-reservation-id', units: 12 }), false);
      assert.equal(consumePublicReservation(receipt, 'scribe', { id: receipt.requestId, units: 12 }), false);
      assert.equal(consumePublicReservation(receipt, 'metadata', { id: receipt.requestId, units: 12 }), true);
      assert.equal(consumePublicReservation(receipt, 'speech', { id: receipt.requestId, units: 12 }), true);
      assert.equal(consumePublicReservation(receipt, 'speech', { id: receipt.requestId, units: 12 }), false);
      await user.security.release(receipt);
      const next = await user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'retired-before-provider', provider: 'metadata' });
      await user.security.release(next);
      assert.equal(consumePublicReservation(next, 'metadata', { id: next.requestId, units: 1 }), false);
    });
    await t.test('session-wide locking prevents simultaneous cross-provider calls and foreign unlock tokens', async () => {
      await reset(); const user = await login();
      const first = await user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'held-speech-request', provider: 'speech', units: 12 });
      await user.security.release({ ...first, token: '0'.repeat(32) });
      await assert.rejects(user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'blocked-transcription', provider: 'scribe' }), errorCode('DEMO_REQUEST_BUSY'));
      await user.security.release(first);
      const next = await user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'fresh-transcription', provider: 'scribe', units: 1 });
      assert.equal((await user.security.status()).scribe.units, 20_000); await user.security.release(next);
    });
    await t.test('replay tombstone and consumed usage survive logout, new sessions, instances and provider failure', async () => {
      await reset(); const first = await login();
      const request = { session: first.session, clientKey: first.clientKey, id: 'unique-spoken-approval', provider: 'speech' as const, units: 15 };
      const reservation = await first.security.reserve(request); await first.security.release(reservation);
      await first.security.revoke(first.session); assert.equal(await first.security.sessionActive(first.session), false);
      const second = await login(create());
      await assert.rejects(second.security.reserve({ ...request, session: second.session }), errorCode('DEMO_REQUEST_ALREADY_CONSUMED'));
      assert.equal((await create().status()).speech.requests, 1); assert.equal((await create().status()).speech.units, 15);
      const keys = await command('KEYS', PUBLIC_DEMO_NAMESPACE + ':replay:*') as string[]; assert.equal(keys.length, 1); assert.equal(await command('TTL', keys[0]), -1);
    });
    await t.test('secret rotation does not reset replay tombstones or global usage', async () => {
      await reset(); const user = await login();
      const first = await user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'survives-secret-rotation', provider: 'speech', units: 5 }); await user.security.release(first);
      const rotated = createPublicDemoSecurity({ ...env, SMV_DEMO_SESSION_SECRET: 'another-fictional-test-secret-with-more-than32characters' }, { fetcher, now: () => clock });
      const next = await login(rotated);
      assert.equal(rotated.authenticateCookie(user.cookie, next.clientKey), null);
      await assert.rejects(rotated.reserve({ session: next.session, clientKey: next.clientKey, id: 'survives-secret-rotation', provider: 'speech', units: 5 }), errorCode('DEMO_REQUEST_ALREADY_CONSUMED'));
      assert.equal((await rotated.status()).speech.units, 5);
    });
    await t.test('authenticated session reads have durable per-session rate enforcement', async () => {
      await reset(); const user = await login();
      for (let i = 0; i < 30; i++) assert.equal(await user.security.sessionActive(user.session), true);
      await assert.rejects(create().sessionActive(user.session), errorCode('DEMO_RATE_LIMIT'));
    });
    await t.test('logout revokes the server-side session before another paid request', async () => {
      await reset(); const user = await login(); assert.equal(await user.security.sessionActive(user.session), true);
      await user.security.revoke(user.session);
      await assert.rejects(create().reserve({ session: user.session, clientKey: user.clientKey, id: 'revoked-request-id', provider: 'speech', units: 20 }), errorCode('DEMO_ACCESS_REQUIRED'));
      assert.equal((await user.security.status()).speech.requests, 0); assert.match(user.security.clearCookie(), new RegExp('^' + PUBLIC_COOKIE_NAME + '=;.*Max-Age=0$'));
    });
    await t.test('durable global, client and session ceilings reject the next reservation without a refund/reset', async () => {
      for (const scope of ['global', 'client', 'session'] as const) {
        await reset(); const user = await login();
        const key = PUBLIC_DEMO_NAMESPACE + ':budget:' + (scope === 'global' ? 'global' : scope + ':' + (scope === 'client' ? user.clientKey : user.session.id));
        const cap = PUBLIC_LIMITS.speech[scope];
        await command('HSET', key, 'speech:requests', '0', 'speech:units', String(cap.units - 1));
        const accepted = await user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'last-budget-character', provider: 'speech', units: 1 }); await user.security.release(accepted);
        await assert.rejects(create().reserve({ session: user.session, clientKey: user.clientKey, id: 'exceeds-budget-character', provider: 'speech', units: 1 }), errorCode('DEMO_SHARED_BUDGET_EXHAUSTED'));
        assert.equal(await command('HGET', key, 'speech:units'), String(cap.units));
      }
    });
    await t.test('scribe reserves a full20 seconds perclip and the shared ceiling admits onlysix', async () => {
      await reset();
      for (let i = 0; i < 6; i++) {
        const user = await login(create(), '192.0.2.' + (i + 1));
        const lease = await user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'scribe-clip-number-' + i, provider: 'scribe', units: 0 }); await user.security.release(lease);
      }
      const user = await login(create(), '192.0.2.30');
      await assert.rejects(user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'seventh-scribe-clip', provider: 'scribe' }), errorCode('DEMO_SHARED_BUDGET_EXHAUSTED'));
      const state = await user.security.status(); assert.equal(state.scribe.requests, 6); assert.equal(state.scribe.units, 120_000);
    });
    await t.test('per-session rate limit counts rejected replays and blocksbefore further work', async () => {
      await reset(); const user = await login();
      const request = { session: user.session, clientKey: user.clientKey, id: 'one-rate-limited-request', provider: 'metadata' as const };
      const first = await user.security.reserve(request); await user.security.release(first);
      for (let i = 1; i < 12; i++) await assert.rejects(user.security.reserve(request), errorCode('DEMO_REQUEST_ALREADY_CONSUMED'));
      await assert.rejects(user.security.reserve({ ...request, id: 'different-after-rate-limit' }), errorCode('DEMO_RATE_LIMIT'));
      assert.equal((await user.security.status()).metadata.requests, 1);
    });
    await t.test('invalid reservation input cannot create counters or consume provider budget', async () => {
      await reset(); const user = await login();
      for (const units of [0, -1, 0.5, 4097, NaN]) await assert.rejects(user.security.reserve({ session: user.session, clientKey: user.clientKey, id: 'invalid-char-count', provider: 'speech', units }), errorCode('INVALID_REQUEST'));
      await assert.rejects(user.security.reserve({ session: user.session, clientKey: 'f'.repeat(64), id: 'wrong-client-key', provider: 'gemini' }), errorCode('DEMO_ACCESS_REQUIRED'));
      assert.equal((await user.security.status()).speech.requests, 0);
    });
  } finally {
    const exited = new Promise<void>(resolve => { if (process.exitCode !== null) resolve(); else process.once('exit', () => resolve()); });
    process.kill('SIGTERM'); await exited; await rm(directory, { recursive: true, force: true });
  }
});
