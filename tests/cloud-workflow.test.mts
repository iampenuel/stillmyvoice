import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedVoices, PREMIUM_MODEL, PREVIEW_TEXT } from '../src/communication/cloud-contract.mts';
import { choose, choices, initialModel, presented, speechEvent, interrupt, finishAssistance, type Model } from '../src/communication/model.mts';
import { createElevenLabs, resolveApprovedVoices } from '../server/elevenlabs.mts';
const step = (s: Model, id: string) => { assert.ok(choices(s).some(c => c.id === id && !c.disabled), id); return choose(s, id, s.uiRevision); };
const inventory = () => approvedVoices.map(v => ({ voice_id: v.id, name: v.apiName, fine_tuning: { state: { [PREMIUM_MODEL]: 'fine_tuned' } }, sharing: { rate: 1 } }));
function model() {
  const s = initialModel('cloud-fixture'); s.draft = 'Please move my left arm, not my right.';
  s.voices = [{ id: 'local', name: 'Local fixture', lang: 'en-US', local: true }]; s.settings.voice = 'local';
  s.cloud = { ...s.cloud, consent: true, elevenlabs: true, gemini: true, voices: resolveApprovedVoices(inventory()) }; return s;
}
test('exact approved collection rejects substitutions, duplicate identities, failed tuning and custom rates', () => {
  const rows = inventory(); rows[4].fine_tuning.state[PREMIUM_MODEL] = 'failed'; rows[3].sharing.rate = 2;
  const result = resolveApprovedVoices([...rows, rows[0], { voice_id: 'other', name: approvedVoices[1].apiName }]);
  assert.equal(result.length, 6); assert.deepEqual(result.map(v => v.id), approvedVoices.map(v => v.id));
  assert.equal(result[0].available, false); assert.equal(result[1].available, true); assert.equal(result[3].available, false); assert.equal(result[4].available, false);
});
test('voice metadata paginates without synthesis or synthesis billing permission', async () => {
  const requests: string[] = [];
  const p = createElevenLabs({ ELEVENLABS_API_KEY: 'synthetic-key', SMV_METADATA_ALLOWED: 'true' }, async (url, init) => {
    assert.notEqual(init?.method, 'POST'); const path = String(url); requests.push(path);
    return Response.json(path.includes('next_page_token') ? { voices: inventory().slice(3), has_more: false }
      : { voices: inventory().slice(0, 3), has_more: true, next_page_token: 'next page' });
  });
  assert.equal(p.status().available, false);
  const voices = await p.listVoices(new AbortController().signal);
  assert.equal(voices.filter(v => v.available).length, 6); assert.equal(requests.length, 2); assert.ok(requests[1].includes('next%20page'));
  await assert.rejects(p.synthesize({}, new AbortController().signal), /DISABLED/);
});
test('premium selection is silent, preview is fixed, failed speech fallback needs new complete review and approval', () => {
  let s = model(); const draft = s.draft;
  s = step(step(step(step(s, 'more'), 'settings'), 'voices'), 'premium-voices'); s = step(s, 'premium:0');
  assert.equal(s.authorization, null); assert.equal(s.settings.provider, 'elevenlabs');
  s = step(s, 'preview'); assert.equal(s.authorization?.text, PREVIEW_TEXT); assert.equal(s.draft, draft);
  s = speechEvent(s, s.authorization!.id, 'end'); s = step(step(s, 'more'), 'home');
  s = step(s, 'review'); s = presented(s, s.revision, 0); s = step(s, 'speak');
  const old = s.authorization!; assert.equal(old.voice, approvedVoices[0].id); assert.equal(old.text, draft);
  s = speechEvent(s, old.id, 'error'); s = step(s, 'fallback');
  assert.equal(s.authorization, null); assert.equal(s.settings.provider, 'browser'); assert.equal(s.draft, draft);
  assert.equal(choose(s, 'speak', s.uiRevision), s); s = presented(s, s.revision, 0); s = step(s, 'speak');
  assert.notEqual(s.authorization!.id, old.id); assert.equal(s.authorization!.provider, 'browser');
  assert.equal(speechEvent(s, old.id, 'end'), s);
});
test('revoking cloud consent prevents premium approval and leaves system fallback available', () => {
  let s = model(); s.settings.provider = 'elevenlabs'; s.settings.voice = approvedVoices[0].id; s.cloud.consent = false;
  s = step(s, 'review'); s = presented(s, s.revision, 0);
  assert.equal(choose(s, 'speak', s.uiRevision), s); assert.ok(choices(s).some(c => c.id === 'fallback' && !c.disabled));
});
test('suggestions never insert or speak; selection changes an editable draft and stale results cannot overwrite it', () => {
  let s = model(); const original = s.draft; s = step(step(s, 'assist'), 'assist-spelling');
  const request = s.assistance.request!; const corrected = 'Please move my left arm, not my right.';
  s = finishAssistance(s, request, [{ text: corrected, kind: 'spelling_correction' }]);
  assert.equal(s.draft, original); assert.equal(s.authorization, null);
  const selected = step(s, 'suggestion:0'); assert.equal(selected.authorization, null); assert.equal(selected.screen.name, 'compose');
  assert.equal(finishAssistance(selected, request, [{ text: 'unwanted late change', kind: 'spelling_correction' }]), selected);
});
test('focus loss, Cancel and leaving assistance preserve draft and retire every pending request', () => {
  for (const action of ['focus', 'reject-suggestions', 'spell', 'phrases']) {
    let s = step(step(model(), 'assist'), 'assist-spelling'); const request = s.assistance.request!, draft = s.draft;
    s = action === 'focus' ? interrupt(s, 'Focus lost') : step(s, action);
    assert.equal(s.assistance.request, null); assert.equal(s.draft, draft);
    assert.equal(finishAssistance(s, request, [{ text: 'stale', kind: 'spelling_correction' }]), s);
  }
});
