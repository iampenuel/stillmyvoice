import test from 'node:test';
import assert from 'node:assert/strict';
import { cloudFailure } from '../src/communication/cloud-error.mts';
import { releaseCapabilities } from '../src/release-capabilities.mts';
test('public-demo frontend permits server-mediated capabilities without changing local or static modes', () => {
  assert.deepEqual(releaseCapabilities('public-demo'), { frontendDemo: false, cloudServices: true, gazeExperiment: true });
  assert.equal(releaseCapabilities('gaze-demo').cloudServices, false);
  assert.equal(releaseCapabilities(undefined).cloudServices, true);
});
test('public quota and authorization failures stay distinct from local caps and provider limits', () => {
  assert.match(cloudFailure(401, {error:'DEMO_ACCESS_REQUIRED'}), /Unlock Demo access/);
  assert.match(cloudFailure(429, {error:'DEMO_SHARED_BUDGET_EXHAUSTED'}), /shared public demo allowance/);
  assert.match(cloudFailure(429, {error:'GEMINI_QUOTA'}), /Gemini’s API/);
  assert.match(cloudFailure(429, {error:'ELEVENLABS_QUOTA'}), /ElevenLabs reported its provider/);
  assert.match(cloudFailure(503, {error:'DEMO_QUOTA_UNAVAILABLE'}), /No new provider request/);
  assert.match(cloudFailure(409, {error:'DEMO_REQUEST_ALREADY_CONSUMED'}), /No duplicate/);
  assert.doesNotMatch(cloudFailure(503, {error:'unknown',message:'private authored text',token:'secret'}), /private|secret/);
});
