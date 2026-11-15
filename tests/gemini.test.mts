import test from 'node:test';
import assert from 'node:assert/strict';
import { acceptableWording, createGemini, validateSuggestions, validateAssistRequest, type AssistRequest } from '../server/gemini.mts';
const request: AssistRequest = { id: 'synthetic-request:1', text: 'I am not in pain.', context: '', kind: 'wording_alternative', synthetic: true };
const env = { GEMINI_API_KEY: 'synthetic-test-key', SMV_GEMINI_FREE_TIER_CONFIRMED: 'true', SMV_CLOUD_MODE: 'local-synthetic-demo' };
test('negative statements, refusal and directional order cannot be silently reversed', () => {
  assert.equal(acceptableWording('I am not in pain.', 'I am in pain.', 'wording_alternative'), false);
  assert.equal(acceptableWording('Please move my left arm, not my right.', 'Please move my right arm, not my left.', 'wording_alternative'), false);
  assert.equal(acceptableWording('Please stop.', 'Please go.', 'wording_alternative'), false);
  assert.equal(acceptableWording('I am not in pain.', 'I am not in pain.', 'wording_alternative'), true);
});
test('contextual replies remain neutral rather than inventing symptoms, consent or preference', () => {
  for (const text of ['Yes.', 'No.', 'Please repeat that.']) assert.equal(acceptableWording('', text, 'contextual_response'), true);
  for (const text of ['My arm hurts.', 'I consent to treatment.', 'I want medication.']) assert.equal(acceptableWording('', text, 'contextual_response'), false);
});
test('correction does not change authorship or guess an ambiguous word meaning', () => {
  assert.equal(acceptableWording('I am not in pain.', 'They are not in pain.', 'wording_alternative'), false);
  assert.equal(acceptableWording('I am warm.', 'I am harm.', 'spelling_correction'), false);
  assert.equal(acceptableWording('Plese reposition me.', 'Please reposition me.', 'spelling_correction'), true);
});
test('strict response schema rejects unknown actions, wrong kinds, excess choices and oversized text', () => {
  for (const value of [{ suggestions: [], speak: true }, { suggestions: Array(4).fill({ text: request.text, kind: request.kind }) },
    { suggestions: [{ text: 'x'.repeat(241), kind: request.kind }] }, { suggestions: [{ text: request.text, kind: 'speech' }] },
    { suggestions: [{ text: request.text, kind: request.kind, action: 'speak' }] }]) assert.throws(() => validateSuggestions(value, request));
  assert.deepEqual(validateSuggestions({ suggestions: [{ text: 'I am in pain.', kind: request.kind }] }, request), []);
});
test('free-tier confirmation, key, approved model and synthetic local mode are mandatory', async () => {
  let calls = 0;
  for (const config of [{}, { ...env, SMV_GEMINI_FREE_TIER_CONFIRMED: 'false' }, { ...env, SMV_GEMINI_MODEL: 'paid-model' }, { ...env, NODE_ENV: 'production' }, { ...env, GOOGLE_GENAI_USE_VERTEXAI: 'true' }]) {
    const p = createGemini(config, async () => { calls++; return ''; });
    assert.equal(p.status().available, false); await assert.rejects(p.suggest(request, new AbortController().signal), /GEMINI_DISABLED/);
  }
  assert.equal(calls, 0); assert.throws(() => validateAssistRequest({ ...request, synthetic: false }));
});
test('a successful provider returns suggestions only; no controls, speech or automatic mutation', async () => {
  let calls = 0;
  const p = createGemini(env, async (payload, signal) => { calls++; assert.equal(payload.model, 'gemini-3.5-flash-lite');
    assert.equal(JSON.parse(payload.contents).authoredText, request.text); assert.equal(signal.aborted, false);
    return JSON.stringify({ suggestions: [{ text: request.text, kind: request.kind }] }); });
  const result = await p.suggest(request, new AbortController().signal);
  assert.deepEqual(result, [{ text: request.text, kind: request.kind }]); assert.equal(calls, 1);
  await assert.rejects(p.suggest(request, new AbortController().signal)); assert.equal(calls, 1);
});
test('429 and errors are sanitized without retry or paid fallback', async () => {
  let calls = 0;
  const p = createGemini(env, async () => { calls++; throw { status: 429, message: 'private-key-and-text' }; });
  await assert.rejects(p.suggest(request, new AbortController().signal), /GEMINI_QUOTA/); assert.equal(calls, 1);
});
test('late model completion after cancellation is discarded', async () => {
  const abort = new AbortController(); let finish!: (text: string) => void;
  const p = createGemini(env, () => new Promise(resolve => { finish = resolve; }));
  const result = p.suggest(request, abort.signal); abort.abort(); finish(JSON.stringify({ suggestions: [{ text: request.text, kind: request.kind }] }));
  await assert.rejects(result, /GEMINI_CANCELLED_OR_TIMEOUT/);
});
test('eight consequential fictional fixtures retain wording or reject changed meaning', () => {
  for (const [source, changed] of [
    ['Please reposition me.', 'Please do not reposition me.'],
    ['Please do not reposition me.', 'Please reposition me.'],
    ['I am not ready.', 'I am ready.'],
    ['I do not need help.', 'I need help.'],
    ['Please move my left arm, not my right.', 'Please move my right arm, not my left.'],
    ['Please stop.', 'Please continue.'],
    ['I am not sure.', 'I am sure.'],
    ['Please repeat that.', 'Please change that.'],
  ]) {
    assert.equal(acceptableWording(source, source, 'wording_alternative'), true);
    assert.equal(acceptableWording(source, changed, 'wording_alternative'), false);
  }
});
test('the verified free-tier budget enforces five seconds between requests', async t => {
  t.mock.timers.enable({ apis: ['Date'], now: 10000 });
  let calls = 0;
  const p = createGemini(env, async () => { calls++; return '{"suggestions":[]}'; });
  await p.suggest(request, new AbortController().signal);
  t.mock.timers.tick(4999);
  await assert.rejects(p.suggest({ ...request, id: 'synthetic-request:2' }, new AbortController().signal), /ASSISTANCE_LIMIT/);
  t.mock.timers.tick(1);
  await p.suggest({ ...request, id: 'synthetic-request:2' }, new AbortController().signal);
  assert.equal(calls, 2);
});
