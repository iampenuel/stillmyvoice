import test from 'node:test';
import assert from 'node:assert/strict';
import { googleGenerator } from '../server/google-sdk.mts';
import { GEMINI_MODEL, suggestionSchema } from '../server/gemini.mts';
test('actual official SDK emits one bounded direct-API request with a header key and strict schema', async () => {
  const calls: { url: string; options?: RequestInit }[] = [];
  const run = googleGenerator('synthetic-fixture-secret', async (url, options) => {
    calls.push({ url: String(url), options });
    return Response.json({ candidates: [{ content: { role: 'model', parts: [{ text: '{"suggestions":[]}' }] }, finishReason: 'STOP' }] });
  });
  const response = await run({ model: GEMINI_MODEL, contents: 'fictional fixture', instruction: 'Schema only.', schema: suggestionSchema }, new AbortController().signal);
  assert.equal(response, '{"suggestions":[]}'); assert.equal(calls.length, 1);
  assert.equal(new URL(calls[0].url).origin, 'https://generativelanguage.googleapis.com');
  assert.equal(calls[0].url.includes('synthetic-fixture-secret'), false);
  const payload = JSON.parse(String(calls[0].options?.body));
  assert.equal(payload.generationConfig.maxOutputTokens, 600);
  assert.equal(payload.generationConfig.responseMimeType, 'application/json');
  assert.equal(payload.generationConfig.thinkingConfig.thinkingLevel, 'MINIMAL');
  assert.equal(payload.tools, undefined); assert.equal(payload.cachedContent, undefined);
  const headers = new Headers(calls[0].options?.headers);
  assert.equal(headers.get('x-goog-api-key'), 'synthetic-fixture-secret');
});
test('official SDK does not retry quota failure', async () => {
  let calls = 0;
  const run = googleGenerator('synthetic-fixture-secret', async () => { calls++; return Response.json({ error: { code: 429, message: 'synthetic quota', status: 'RESOURCE_EXHAUSTED' } }, { status: 429 }); });
  await assert.rejects(run({ model: GEMINI_MODEL, contents: 'fictional', instruction: 'Schema only.', schema: suggestionSchema }, new AbortController().signal));
  assert.equal(calls, 1);
});
