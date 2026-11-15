import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedVoices, PREMIUM_MODEL } from '../src/communication/cloud-contract.mts';
import { createElevenLabs, ProviderError } from '../server/elevenlabs.mts';
import { premiumSpeechEngine } from '../src/communication/premium-speech.mts';
import type { Authorization } from '../src/communication/model.mts';
const env = { ELEVENLABS_API_KEY: 'synthetic-test-key', SMV_ELEVENLABS_CREDITS_CONFIRMED: 'true', SMV_CLOUD_MODE: 'local-synthetic-demo' };
const auth: Authorization = { id: 'synthetic-session:1', text: 'Please move my left arm, not my right.', revision: 1, voice: approvedVoices[0].id, rate: 1, provider: 'elevenlabs', preview: false };
function fixtureFetch(sent: { url: string; body?: string }[]): typeof fetch {
  return async (input, init) => {
    const url = String(input); sent.push({ url, body: typeof init?.body === 'string' ? init.body : undefined });
    if (url.endsWith('/v1/models')) return Response.json([{ model_id: 'eleven_flash_v2_5', can_do_text_to_speech: true }]);
    if (url.includes('/v2/voices')) return Response.json({ voices: approvedVoices.map(v => ({ voice_id: v.id, name: v.apiName, fine_tuning: { state: { [PREMIUM_MODEL]: 'fine_tuned' } }, sharing: { rate: 1 } })) });
    return new Response(new Uint8Array([1, 2, 3]), { headers: { 'Content-Type': 'audio/mpeg' } });
  };
}
test('missing credits/key/explicit local demo mode blocks every live ElevenLabs operation', async () => {
  let calls = 0; const fetcher: typeof fetch = async () => { calls++; throw Error('Must not call'); };
  for (const config of [{}, { ...env, SMV_ELEVENLABS_CREDITS_CONFIRMED: 'false' }, { ...env, NODE_ENV: 'production' }, { ...env, ELEVENLABS_API_KEY: '' }]) {
    const p = createElevenLabs(config, fetcher); assert.equal(p.status().available, false);
    await assert.rejects(p.synthesize(auth, new AbortController().signal), ProviderError);
  }
  assert.equal(calls, 0);
});
test('only verified voice/model accepts exact text; same approval cannot be replayed', async () => {
  const requests: { url: string; body?: string }[] = [], p = createElevenLabs(env, fixtureFetch(requests)), signal = new AbortController().signal;
  await assert.rejects(p.synthesize(auth, signal), /VOICE_NOT_VERIFIED/);
  assert.equal((await p.listVoices(signal))[0].auditioned, false);
  await p.synthesize(auth, signal);
  const payload = JSON.parse(requests.at(-1)!.body!);
  assert.equal(payload.text, auth.text); assert.equal(payload.apply_text_normalization, 'off');
  assert.equal(payload.model_id, 'eleven_flash_v2_5'); assert.equal(Object.hasOwn(payload, 'previous_text'), false);
  await assert.rejects(p.synthesize(auth, signal), /AUTHORIZATION_ALREADY_USED/);
  assert.equal(requests.filter(r => r.body).length, 1);
});
test('invalid previews and unsupported rates are rejected before external speech', async () => {
  const p = createElevenLabs(env, fixtureFetch([])), signal = new AbortController().signal;
  await p.listVoices(signal);
  await assert.rejects(p.synthesize({ ...auth, preview: true }, signal), /INVALID_SPEECH_AUTHORIZATION/);
  await assert.rejects(p.synthesize({ ...auth, rate: 1.25 }, signal), /INVALID_SPEECH_AUTHORIZATION/);
});
test('all five fictional acceptance phrases reach TTS byte-for-byte without normalization', async () => {
  const requests: { url: string; body?: string }[] = [], p = createElevenLabs(env, fixtureFetch(requests));
  const signal = new AbortController().signal; await p.listVoices(signal);
  const phrases = ['Please reposition me.', 'Please stop.', 'I am not ready.',
    'Please move my left arm, not my right.', 'Please do not reposition me.'];
  for (const [i, text] of phrases.entries()) {
    await p.synthesize({ ...auth, id: 'exact-fictional:' + i, text }, signal);
    const payload = JSON.parse(requests.at(-1)!.body!);
    assert.equal(payload.text, text); assert.equal(payload.apply_text_normalization, 'off');
  }
  assert.equal(requests.filter(r => r.body).length, phrases.length);
});
test('provider errors are sanitized and never retried', async () => {
  const requests: { url: string; body?: string }[] = [], base = fixtureFetch(requests);
  const p = createElevenLabs(env, async (url, init) => { if (init?.method === 'POST') throw Error('synthetic-secret and private text'); return base(url, init); });
  const signal = new AbortController().signal; await p.listVoices(signal);
  await assert.rejects(p.synthesize(auth, signal), error => error instanceof ProviderError && error.message === 'ELEVENLABS_UNAVAILABLE');
  await assert.rejects(p.synthesize(auth, signal), /AUTHORIZATION_ALREADY_USED/);
});
test('late audio after Stop cannot create a player, URL, or speech event', async () => {
  let finish!: (blob: Blob) => void, players = 0, urls = 0; const events: string[] = [];
  const engine = premiumSpeechEngine({ request: () => new Promise(resolve => { finish = resolve; }),
    player: () => { players++; throw Error('Must not play'); }, url: () => { urls++; return 'blob:test'; }, revoke: () => {} });
  engine.speak(auth, event => events.push(event)); engine.cancel(); finish(new Blob(['synthetic']));
  await new Promise(resolve => setImmediate(resolve)); assert.equal(players, 0); assert.equal(urls, 0); assert.deepEqual(events, []);
});
test('Stop interrupts playback and late completion cannot complete a newer request', async () => {
  let pauses = 0, revoked = 0; const events: string[] = [];
  const player = { src: '', onplaying: null as (() => void) | null, onended: null as (() => void) | null, onerror: null as (() => void) | null,
    play: async () => {}, pause: () => { pauses++; }, load: () => {} };
  const engine = premiumSpeechEngine({ request: async () => new Blob(['fixture']), player: () => player, url: () => 'blob:fixture', revoke: () => { revoked++; } });
  engine.speak(auth, e => events.push(e)); await new Promise(resolve => setImmediate(resolve));
  player.onplaying!(); const late = player.onended!; engine.cancel(); late();
  assert.equal(pauses, 1); assert.equal(revoked, 1); assert.deepEqual(events, ['start']); assert.equal(player.src, '');
});
