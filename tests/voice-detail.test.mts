import { initialComposeModel } from './communication-fixture.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { approvedVoices, PREVIEW_TEXT } from '../src/communication/cloud-contract.mts';
import { choose, choices, inputView, interrupt, speechEvent, type Model } from '../src/communication/model.mts';
import { InputCoordinator } from '../src/communication/input-coordinator.mts';

const step = (model: Model, id: string) => {
  assert.ok(choices(model).some(choice => choice.id === id && !choice.disabled), `${id} is enabled in ${model.screen.name}`);
  return choose(model, id, model.uiRevision);
};
function fixture() {
  const model = initialComposeModel('voice-detail-fixture');
  model.draft = 'Please move my left arm, not my right.';
  model.revision = 7; model.lastPlayed = 'Please stop.';
  model.voices = [{ id: 'system-fixture', name: 'System fixture', lang: 'en-US', local: true }];
  model.settings.voice = 'system-fixture'; model.settings.rate = 1.25;
  model.cloud = { ...model.cloud, consent: true, elevenlabs: true,
    voices: approvedVoices.map(voice => ({ ...voice, available: true, reason: 'Fixture compatibility verified', auditioned: false })) };
  return model;
}
function list(model = fixture()) {
  return step(step(step(step(model, 'more'), 'settings'), 'voices'), 'premium-voices');
}
const authored = (model: Model) => ({ draft: model.draft, revision: model.revision, lastPlayed: model.lastPlayed });

test('all six exact identities open silent staged details with Preview first and three actions', () => {
  for (const [index, voice] of approvedVoices.entries()) {
    const before = list(), saved = structuredClone(before.settings), words = authored(before);
    const detail = step(before, `premium:${index}`);
    assert.equal(detail.screen.name, 'voice-detail'); assert.equal(detail.screen.value, voice.id);
    assert.deepEqual(choices(detail).map(choice => choice.id), ['preview', 'use-voice', 'back-to-voices']);
    assert.deepEqual(inputView(detail).targets, ['preview', 'use-voice', 'back-to-voices']);
    assert.deepEqual(detail.settings, saved); assert.deepEqual(authored(detail), words); assert.equal(detail.authorization, null);
    const returned = step(detail, 'back-to-voices');
    assert.equal(returned.screen.name, 'premium-voices'); assert.deepEqual(returned.settings, saved);
    assert.deepEqual(returned.cloud.voices.map(v => v.id), approvedVoices.map(v => v.id));
  }
});

test('Cecily and Eric preview only the fixed sample; Use alone confirms voice without authorizing the draft', () => {
  for (const index of [0, 5]) {
    let model = step(list(), `premium:${index}`);
    const saved = structuredClone(model.settings), words = authored(model);
    model = step(model, 'preview'); const authorization = model.authorization!;
    assert.equal(authorization.preview, true); assert.equal(model.speechPreview, true); assert.equal(authorization.text, PREVIEW_TEXT);
    assert.equal(authorization.voice, approvedVoices[index].id); assert.equal(authorization.provider, 'elevenlabs');
    assert.equal(authorization.rate, 1); assert.deepEqual(model.settings, saved);
    assert.deepEqual(inputView(model).targets, ['stop']);
    assert.equal(choose(model, 'preview', model.uiRevision), model, 'loading/playing cannot authorize another preview');
    model = speechEvent(model, authorization.id, 'start');
    model = speechEvent(model, authorization.id, 'end');
    assert.equal(model.screen.name, 'voice-detail'); assert.equal(model.screen.value, approvedVoices[index].id);
    assert.equal(inputView(model).targets[0], 'preview'); assert.equal(model.authorization, null);
    assert.deepEqual(model.settings, saved); assert.deepEqual(authored(model), words);
    model = step(model, 'use-voice');
    assert.equal(model.screen.name, 'compose'); assert.equal(model.settings.provider, 'elevenlabs');
    assert.equal(model.settings.voice, approvedVoices[index].id); assert.equal(model.settings.systemVoice, saved.voice);
    assert.equal(model.settings.rate, 1); assert.equal(model.authorization, null); assert.deepEqual(authored(model), words);
  }
});

test('unavailable or unconsented candidate remains inspectable but cannot preview or be confirmed', () => {
  for (const blocked of ['availability', 'consent', 'provider']) {
    const before = fixture();
    if (blocked === 'availability') before.cloud.voices[4].available = false;
    else if (blocked === 'consent') before.cloud.consent = false;
    else before.cloud.elevenlabs = false;
    const model = step(list(before), 'premium:4');
    assert.equal(model.screen.value, approvedVoices[4].id);
    assert.deepEqual(inputView(model).targets, ['back-to-voices']);
    assert.equal(choose(model, 'preview', model.uiRevision), model);
    assert.equal(choose(model, 'use-voice', model.uiRevision), model);
    assert.equal(step(model, 'back-to-voices').screen.name, 'premium-voices');
  }
});

test('Stop and preview failure return to the same staged candidate without confirming it', () => {
  for (const outcome of ['stop', 'error']) {
    let model = step(list(), 'premium:0'); const saved = structuredClone(model.settings), words = authored(model);
    model = step(model, 'preview'); const oldId = model.authorization!.id;
    model = outcome === 'stop' ? step(model, 'stop') : speechEvent(model, oldId, 'error');
    assert.equal(model.screen.name, 'voice-detail'); assert.equal(model.screen.value, approvedVoices[0].id);
    assert.equal(model.authorization, null); assert.deepEqual(model.settings, saved); assert.deepEqual(authored(model), words);
    assert.equal(inputView(model).targets[0], 'preview');
    assert.equal(speechEvent(model, oldId, 'end'), model);
  }
});

test('a canceled Cecily preview cannot affect Eric after Back and a new deliberate preview', () => {
  let model = step(step(list(), 'premium:0'), 'preview'); const oldId = model.authorization!.id;
  model = step(step(step(step(model, 'stop'), 'back-to-voices'), 'premium:5'), 'preview');
  const newId = model.authorization!.id;
  assert.notEqual(newId, oldId); assert.equal(model.authorization!.voice, approvedVoices[5].id);
  for (const event of ['start', 'end', 'error'] as const) assert.equal(speechEvent(model, oldId, event), model);
  model = speechEvent(model, newId, 'end');
  assert.equal(model.screen.value, approvedVoices[5].id); assert.equal(model.settings.provider, 'browser');
});

test('focus loss retires preview; fresh Resume returns to detail without replay or saved-voice changes', () => {
  let model = step(list(), 'premium:5'); const words = authored(model), saved = structuredClone(model.settings);
  model = step(model, 'preview'); const oldId = model.authorization!.id;
  model = interrupt(model, 'Focus lost — communication preserved');
  assert.equal(model.screen.name, 'paused'); assert.equal(model.authorization, null);
  assert.deepEqual(inputView(model).targets, ['resume']);
  model = step(model, 'resume');
  assert.equal(model.screen.name, 'voice-detail'); assert.equal(model.screen.value, approvedVoices[5].id);
  assert.equal(inputView(model).targets[0], 'preview'); assert.equal(model.authorization, null);
  assert.deepEqual(authored(model), words); assert.deepEqual(model.settings, saved);
  assert.equal(speechEvent(model, oldId, 'end'), model);
});

test('simulated list release never previews; only a fresh complete cycle can authorize the fixed sample', () => {
  let model = list(), serial = 0; const selected: string[] = [];
  const coordinator = new InputCoordinator(inputView(model), {
    changed: () => {}, interrupted: reason => assert.fail(reason),
    selected: selection => {
      selected.push(selection.targetId); model = choose(model, selection.targetId, selection.revision);
      coordinator.setView(inputView(model));
    },
  }, undefined, () => true, () => `detail-simulation-${++serial}`, async () => {});
  coordinator.simulate(); const listEpoch = coordinator.state.epoch;
  coordinator.down();
  for (let i = 0; i < 100; i++) { coordinator.tick(); coordinator.down(); }
  assert.equal(model.authorization, null); assert.deepEqual(selected, []);
  coordinator.up();
  assert.deepEqual(selected, ['premium:0']); assert.equal(model.screen.name, 'voice-detail'); assert.equal(model.authorization, null);
  assert.notEqual(coordinator.state.epoch, listEpoch); assert.equal(coordinator.state.view!.targets[coordinator.state.index], 'preview');
  coordinator.up(); assert.equal(model.authorization, null);
  coordinator.down();
  for (let i = 0; i < 100; i++) { coordinator.tick(); coordinator.down(); }
  assert.deepEqual(selected, ['premium:0']); assert.equal(model.authorization, null);
  coordinator.up();
  assert.deepEqual(selected, ['premium:0', 'preview']);
  assert.equal((model as Model).authorization!.text, PREVIEW_TEXT);
  assert.deepEqual(coordinator.state.view!.targets, ['stop']);
  coordinator.up(); assert.deepEqual(selected, ['premium:0', 'preview']);
  coordinator.stop('Fixture complete', false);
});
