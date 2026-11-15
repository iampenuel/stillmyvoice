import test from 'node:test';
import assert from 'node:assert/strict';
import { serverEnvironment } from '../server/environment.mts';
import { createElevenLabs } from '../server/elevenlabs.mts';
import { createGemini } from '../server/gemini.mts';
test('server loads fixture keys but forces both cloud services off until account protections are confirmed', async () => {
  const fixture = 'GEMINI_API_KEY=synthetic-gemini\nELEVENLABS_API_KEY=synthetic-eleven\nSMV_CLOUD_MODE=local-synthetic-demo\nSMV_GEMINI_FREE_TIER_CONFIRMED=true\nSMV_ELEVENLABS_CREDITS_CONFIRMED=true';
  const env = serverEnvironment(fixture); let calls = 0;
  assert.equal(env.GEMINI_API_KEY, 'synthetic-gemini'); assert.equal(env.ELEVENLABS_API_KEY, 'synthetic-eleven');
  const eleven = createElevenLabs(env, async () => { calls++; throw Error(); });
  const gemini = createGemini(env, async () => { calls++; return ''; });
  assert.equal(eleven.status().available, false); assert.equal(gemini.status().available, false);
  await assert.rejects(eleven.listVoices(new AbortController().signal), /DISABLED/);
  await assert.rejects(gemini.suggest({}, new AbortController().signal), /DISABLED/);
  assert.equal(calls, 0);
});
test('client-prefixed provider keys are rejected without echoing their contents', () => {
  assert.throws(() => serverEnvironment('VITE_GEMINI_API_KEY=synthetic-sensitive-fixture'),
    error => error instanceof Error && !error.message.includes('synthetic-sensitive-fixture'));
});
