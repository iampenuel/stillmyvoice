import test from 'node:test';
import assert from 'node:assert/strict';
import { createGemini, GEMINI_MODEL } from '../server/gemini.mts';
const env = { GEMINI_API_KEY: 'synthetic-fixture-key', SMV_GEMINI_FREE_TIER_CONFIRMED: 'true', SMV_CLOUD_MODE: 'local-synthetic-demo', SMV_GEMINI_START_REQUESTS: '4' };
const request = { id: 'metadata-fixture:1', text: 'belly hurts weak today', context: 'healthcare', clarification: '', synthetic: true };
const candidate = { status: 'candidate', candidate: 'My belly hurts, and I feel weak today.', unresolvedCues: [], clarificationQuestion: '', clarificationChoices: [] };
test('successful generation reports actual call count, monotonic elapsed time and validated schema without content', async () => {
  const p = createGemini(env, async () => JSON.stringify(candidate));
  assert.equal(p.status().requests, 4); assert.equal(p.status().diagnostics.lastRequest, null);
  await p.expand(request, new AbortController().signal);
  const evidence = p.status().diagnostics.lastRequest!;
  assert.equal(evidence.model, GEMINI_MODEL); assert.equal(evidence.route, 'expansion'); assert.equal(evidence.requestNumber, 5);
  assert.equal(evidence.outcome, 'success'); assert.equal(evidence.providerOutcome, 'success'); assert.equal(evidence.upstreamCalls, 1); assert.equal(evidence.schemaValidated, true);
  assert.ok(Number.isFinite(evidence.providerLatencyMs) && evidence.providerLatencyMs! >= 0); assert.ok(evidence.totalLatencyMs >= evidence.providerLatencyMs!);
  assert.doesNotMatch(JSON.stringify(evidence), /belly|healthcare|metadata-fixture|synthetic-fixture-key/);
});
test('provider success with invalid schema is not reported as validated generation', async () => {
  const p = createGemini(env, async () => JSON.stringify({ ...candidate, unauthorized: true }));
  await assert.rejects(p.expand(request, new AbortController().signal));
  const evidence = p.status().diagnostics.lastRequest!;
  assert.equal(evidence.outcome, 'failure'); assert.equal(evidence.providerOutcome, 'success'); assert.equal(evidence.schemaValidated, false); assert.equal(evidence.upstreamCalls, 1);
});
test('upstream failure and local audited clarification cannot masquerade as live Gemini success', async () => {
  const failed = createGemini(env, async () => { throw { status: 429, message: 'private' }; });
  await assert.rejects(failed.expand(request, new AbortController().signal));
  const error = failed.status().diagnostics.lastRequest!;
  assert.equal(error.outcome, 'failure'); assert.equal(error.providerOutcome, 'failure'); assert.equal(error.schemaValidated, null); assert.equal(error.errorCode, 'GEMINI_QUOTA');
  const local = createGemini(env, async () => { throw Error('Must not generate'); });
  await local.expand({ ...request, text: 'belly weak daily hurt' }, new AbortController().signal);
  const evidence = local.status().diagnostics.lastRequest!;
  assert.equal(evidence.outcome, 'success'); assert.equal(evidence.providerOutcome, 'not_called'); assert.equal(evidence.upstreamCalls, 0); assert.equal(evidence.providerLatencyMs, null); assert.equal(evidence.schemaValidated, null);
});
