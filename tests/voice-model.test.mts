import test from 'node:test';
import assert from 'node:assert/strict';
import { createElevenLabs, resolveApprovedVoices, modelForVoice } from '../server/elevenlabs.mts';
import { approvedVoices, PREMIUM_MODEL, PREVIEW_TEXT } from '../src/communication/cloud-contract.mts';
const rows = () => approvedVoices.map(v => ({ voice_id: v.id, name: v.apiName, sharing: { rate: 1 },
  fine_tuning: { state: { [PREMIUM_MODEL]: v.id === approvedVoices[4].id ? 'failed' : 'fine_tuned', [modelForVoice(v.id)]: 'fine_tuned' } } }));
test('LaSean has an isolated verified English Flash v2 assignment; other five retain v2.5', () => {
  const inventory = rows();
  assert.equal(resolveApprovedVoices(inventory).every(v => v.available), true);
  assert.equal(modelForVoice(approvedVoices[4].id), 'eleven_flash_v2');
  for (const v of approvedVoices.filter((_, i) => i !== 4)) assert.equal(modelForVoice(v.id), PREMIUM_MODEL);
  inventory[4].fine_tuning.state.eleven_flash_v2 = 'failed';
  assert.equal(resolveApprovedVoices(inventory)[4].available, false);
  delete inventory[4].fine_tuning.state.eleven_flash_v2;
  assert.equal(resolveApprovedVoices(inventory)[4].available, false);
});
test('server fixes the LaSean model and rejects client model overrides without synthesis', async () => {
  const sent: Record<string, unknown>[] = [];
  const provider = createElevenLabs({ ELEVENLABS_API_KEY: 'synthetic-model-key', SMV_CLOUD_MODE: 'local-synthetic-demo', SMV_ELEVENLABS_CREDITS_CONFIRMED: 'true' }, async (_url, init) => {
    if (init?.method !== 'POST') return Response.json({ voices: rows() });
    sent.push(JSON.parse(String(init.body))); return new Response(new Uint8Array([1]), { headers: { 'Content-Type': 'audio/mpeg' } });
  });
  const signal = new AbortController().signal; await provider.listVoices(signal);
  const authorization = { id: 'voice-model-test:1', text: PREVIEW_TEXT, revision: 0, voice: approvedVoices[4].id, rate: 1, provider: 'elevenlabs', preview: true };
  await assert.rejects(provider.synthesize({ ...authorization, model_id: 'eleven_v4' }, signal), /INVALID_SPEECH_AUTHORIZATION/);
  assert.equal(sent.length, 0); await provider.synthesize(authorization, signal);
  assert.equal(sent.length, 1); assert.equal(sent[0].model_id, 'eleven_flash_v2'); assert.equal(sent[0].text, PREVIEW_TEXT);
});
