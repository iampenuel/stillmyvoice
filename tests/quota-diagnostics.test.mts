import test from 'node:test';
import assert from 'node:assert/strict';
import { createGemini, normalizedGeminiError } from '../server/gemini.mts';
import { ProviderError } from '../server/elevenlabs.mts';
import { cloudFailure, requestStillCurrent } from '../src/communication/cloud-error.mts';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { IncomingMessage, ServerResponse } from 'node:http';
import { createApiHandler } from '../server/http.mts';
import { createElevenLabs } from '../server/elevenlabs.mts';
const env = { GEMINI_API_KEY: 'synthetic-fixture-key', SMV_GEMINI_FREE_TIER_CONFIRMED: 'true', SMV_CLOUD_MODE: 'local-synthetic-demo' };
const request = (n: number) => ({ id: 'diagnostic-fixture:' + n, text: 'hello', context: '', kind: 'wording_alternative', synthetic: true });
const signal = () => new AbortController().signal;
test('duplicates, busy work, cooldown and local cap have distinct evidence without extra provider calls', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 });
  let finish!: (value: string) => void, first = true;
  const p = createGemini(env, async () => { if (first) { first = false; return new Promise(resolve => { finish = resolve; }); } return '{"suggestions":[]}'; });
  const pending = p.suggest(request(0), signal());
  await assert.rejects(p.suggest(request(0), signal()), /ASSISTANCE_ALREADY_REQUESTED/);
  await assert.rejects(p.suggest(request(1), signal()), /ASSISTANCE_BUSY/);
  finish('{"suggestions":[]}'); await pending;
  await assert.rejects(p.suggest(request(1), signal()), e => e instanceof ProviderError && e.code === 'ASSISTANCE_COOLDOWN' && e.metadata?.retryAfterSeconds === 5);
  for (let n = 1; n < 20; n++) { t.mock.timers.tick(5000); await p.suggest(request(n), signal()); }
  t.mock.timers.tick(5000); await assert.rejects(p.suggest(request(20), signal()), /ASSISTANCE_SESSION_LIMIT/);
  const d = p.status().diagnostics;
  assert.equal(p.status().requests, 20); assert.equal(d.providerCalls, 20); assert.equal(d.attempts, 24);
  assert.equal(d.duplicate, 1); assert.equal(d.busy, 1); assert.equal(d.cooldown, 1); assert.equal(d.cap, 1); assert.equal(d.provider429, 0);
  assert.equal(d.lastError?.code, 'ASSISTANCE_SESSION_LIMIT'); assert.equal(d.lastError?.source, 'app');
  assert.equal(JSON.stringify(d).includes('diagnostic-fixture'), false); assert.equal(JSON.stringify(d).includes('hello'), false);
});
test('provider 429 retains only allowlisted normalized evidence and never retries', async () => {
  const raw = { status: 429, message: JSON.stringify({ error: { code: 429, status: 'RESOURCE_EXHAUSTED', message: 'private-message synthetic-fixture-key', details: [
    { '@type': 'type.googleapis.com/google.rpc.RetryInfo', retryDelay: '3.2s' },
    { '@type': 'type.googleapis.com/google.rpc.QuotaFailure', violations: [
      { quotaMetric: 'generativelanguage.googleapis.com/generate_content_free_tier_requests', description: 'private-message' }, { quotaMetric: 'private-message' },
    ] },
  ] } }) };
  let calls = 0; const p = createGemini(env, async () => { calls++; throw raw; });
  await assert.rejects(p.suggest(request(0), signal()), e => e instanceof ProviderError && e.code === 'GEMINI_QUOTA' && e.metadata?.retryAfterSeconds === 4);
  assert.equal(calls, 1); assert.equal(p.status().diagnostics.provider429, 1);
  assert.equal(p.status().diagnostics.lastError?.providerStatus, 'RESOURCE_EXHAUSTED');
  assert.equal(p.status().diagnostics.lastError?.providerHttpStatus, 429);
  assert.deepEqual(p.status().diagnostics.lastError?.quotaMetrics, ['generativelanguage.googleapis.com/generate_content_free_tier_requests']);
  assert.doesNotMatch(JSON.stringify(p.status()), /private-message|synthetic-fixture-key/);
  assert.equal(normalizedGeminiError({ status: 503, message: 'secret' }).metadata?.providerStatus, undefined);
});
test('local audited clarification is counted separately from actual provider calls', async () => {
  const p = createGemini(env, async () => { throw Error('No generation expected'); });
  await p.expand({ id: 'diagnostic-clarification:1', text: 'belly weak daily hurt', context: 'general', clarification: '', synthetic: true }, signal());
  assert.equal(p.status().requests, 1); assert.equal(p.status().diagnostics.attempts, 1); assert.equal(p.status().diagnostics.providerCalls, 0);
});
test('restart checkpoint preserves used allowance and invalid checkpoint fails closed', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 });
  const p = createGemini({ ...env, SMV_GEMINI_START_REQUESTS: '3' }, async () => '{"suggestions":[]}');
  assert.equal(p.status().requests, 3); assert.equal(p.status().diagnostics.startingRequests, 3);
  for (let n = 0; n < 17; n++) { await p.suggest(request(n), signal()); t.mock.timers.tick(5000); }
  await assert.rejects(p.suggest(request(17), signal()), /ASSISTANCE_SESSION_LIMIT/);
  assert.equal(p.status().requests, 20); assert.equal(p.status().diagnostics.providerCalls, 17);
  for (const invalid of ['-1', '21', '3.5', '03', '', 'secret']) {
    const blocked = createGemini({ ...env, SMV_GEMINI_START_REQUESTS: invalid }, async () => { throw Error('Must not call'); });
    assert.equal(blocked.status().available, false); await assert.rejects(blocked.suggest(request(0), signal()), /GEMINI_DISABLED/);
  }
});
test('UI names each limit accurately and ignores arbitrary service messages', () => {
  assert.match(cloudFailure(429, { error: 'ASSISTANCE_COOLDOWN', retryAfterSeconds: 2 }), /wait 2 seconds/);
  assert.match(cloudFailure(409, { error: 'ASSISTANCE_BUSY' }), /still running/);
  assert.match(cloudFailure(429, { error: 'ASSISTANCE_SESSION_LIMIT' }), /local demo allowance of 20/);
  assert.match(cloudFailure(409, { error: 'ASSISTANCE_ALREADY_REQUESTED' }), /no duplicate was sent/);
  assert.match(cloudFailure(429, { error: 'GEMINI_QUOTA', retryAfterSeconds: 4 }), /Gemini’s API/);
  assert.match(cloudFailure(429, { error: 'LOCAL_RATE_LIMIT' }), /local app/);
  assert.match(cloudFailure(429, { error: 'unrecognized', message: 'secret' }), /cause is unavailable/);
  assert.doesNotMatch(cloudFailure(503, { message: 'secret' }), /secret/);
});
test('effect lifecycle simulation suppresses Strict Mode cleanup and HMR-retired submissions', async () => {
  let id: string | undefined = 'request:1', submissions = 0;
  const start = async (controller: AbortController) => { if (await requestStillCurrent(controller.signal, 'request:1', () => id)) submissions++; };
  const first = new AbortController(); const firstSetup = start(first); first.abort();
  const secondSetup = start(new AbortController()); await Promise.all([firstSetup, secondSetup]); assert.equal(submissions, 1);
  const retained = start(new AbortController()); id = undefined; await retained; assert.equal(submissions, 1);
});
test('HTTP errors carry distinct safe reasons and bounded retry evidence', async () => {
  const p = createGemini(env, async () => '{"suggestions":[]}');
  const handler = createApiHandler(createElevenLabs({}), p);
  const post = async (value: unknown) => {
    const req = Readable.from([Buffer.from(JSON.stringify(value))]) as unknown as IncomingMessage;
    Object.assign(req, { method: 'POST', url: '/api/suggestions', headers: { host: '127.0.0.1:5174', origin: 'http://127.0.0.1:5173', 'content-type': 'application/json' } });
    let status = 0, payload: Record<string, unknown> = {};
    const res = Object.assign(new EventEmitter(), { destroyed: false, writableEnded: false,
      writeHead(code: number) { status = code; }, end(text: string) { payload = JSON.parse(text); this.writableEnded = true; } });
    await handler(req, res as unknown as ServerResponse); return { status, payload };
  };
  assert.equal((await post(request(0))).status, 200);
  const duplicate = await post(request(0)); assert.equal(duplicate.status, 409); assert.deepEqual(duplicate.payload, { error: 'ASSISTANCE_ALREADY_REQUESTED', source: 'app' });
  const cooldown = await post(request(1)); assert.equal(cooldown.status, 429); assert.equal(cooldown.payload.error, 'ASSISTANCE_COOLDOWN');
  assert.equal(cooldown.payload.source, 'app'); assert.ok(Number(cooldown.payload.retryAfterSeconds) > 0 && Number(cooldown.payload.retryAfterSeconds) <= 5);
  assert.doesNotMatch(JSON.stringify(cooldown.payload), /hello|diagnostic-fixture|synthetic-fixture-key/);
});
