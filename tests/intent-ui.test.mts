import { initialComposeModel } from './communication-fixture.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { choose, choices, choiceSections, inputView, finishExpansion, interrupt, retireRuntimeAuthorization, presented, speechEvent, withCloudDefaults, type Model } from '../src/communication/model.mts';
import { contextOptions, type ExpansionResult } from '../src/communication/expansion-contract.mts';
import { approvedVoices } from '../src/communication/cloud-contract.mts';
const step = (m: Model, id: string) => { assert.ok(choices(m).some(c => c.id === id && !c.disabled), id + ' in ' + m.screen.name); return choose(m, id, m.uiRevision); };
const fixture = (text = 'belly hurts weak today') => {
  const m = initialComposeModel('intent-fixture'); m.draft = text; m.settings.voice = 'local';
  m.cloud.consent = true; m.cloud.gemini = true; m.cloud.elevenlabs = true;
  m.cloud.voices = approvedVoices.map(v => ({ ...v, available: true, reason: 'fixture', auditioned: false })); return m;
};
const candidate: ExpansionResult = { status: 'candidate', candidate: 'My belly hurts, and I feel weak today.', unresolvedCues: [], clarificationQuestion: '', clarificationChoices: [] };
const receive = (m: Model, result = candidate) => finishExpansion(m, m.expansion.request!, result);

test('changing voice candidates clears stale preview status without altering authored text or last playback', () => {
  let m = fixture(); m.lastPlayed = 'Please stop.';
  m = step(step(step(step(step(m, 'more'), 'settings'), 'voices'), 'premium-voices'), 'premium:0');
  m = step(m, 'preview'); m = speechEvent(m, m.authorization!.id, 'end'); assert.equal(m.speechPreview, true);
  m = step(step(m, 'back-to-voices'), 'premium:4');
  assert.equal(m.speechPreview, false); assert.equal(m.speech, 'Not spoken'); assert.equal(m.authorization, null);
  assert.equal(m.draft, 'belly hurts weak today'); assert.equal(m.lastPlayed, 'Please stop.');
  let empty = fixture(''); empty.lastPlayed = '';
  empty = step(step(step(step(step(empty, 'more'), 'settings'), 'voices'), 'premium-voices'), 'premium:0');
  assert.equal(empty.speech, 'Not spoken'); assert.equal(empty.authorization, null);
});

test('specific context remains optional through General; context changes stay persistent and silent', () => {
  const original = fixture(); assert.equal(original.context, 'general');
  for (const option of contextOptions) {
    let m = step(original, 'context');
    assert.equal(choiceSections(m).primary.length, 4); assert.ok(choiceSections(m).navigation.some(c => c.id === 'context-set:general'));
    m = step(m, 'context-set:' + option.id); assert.equal(m.context, option.id);
    assert.equal(m.draft, original.draft); assert.equal(m.authorization, null); assert.equal(m.expansion.request, null);
    m = step(m, 'spell'); assert.equal(m.context, option.id);
    assert.deepEqual(choices(m).slice(0, 5).map(c => c.id), ['row:abcde', 'row:fghij', 'row:klmno', 'row:pqrst', 'row:uvwxyz']);
  }
});

test('expansion is explicit, preserves keywords, then requires full Review and fresh Speak', () => {
  let m = fixture(); const original = m.draft; m = step(m, 'expand');
  assert.equal(m.expansion.request!.text, original); assert.equal(m.expansion.request!.context, 'general');
  assert.equal(m.authorization, null); assert.equal(choose(m, 'expand', m.uiRevision), m);
  m = receive(m); assert.equal(m.draft, original); assert.equal(m.authorization, null);
  m = step(m, 'accept-expansion'); assert.equal(m.draft, candidate.candidate); assert.equal(m.screen.name, 'review');
  assert.equal(m.undo.at(-1), original); assert.equal(m.authorization, null); assert.equal(choose(m, 'speak', m.uiRevision), m);
  m = presented(m, m.revision, 0); m = step(m, 'speak'); assert.equal(m.authorization!.text, candidate.candidate);
});

test('candidate editing is staged through the existing keyboard and rejection keeps original keywords', () => {
  let m = receive(step(fixture(), 'expand')); const original = m.draft;
  m = step(m, 'edit-expansion'); m = step(m, 'erase');
  assert.equal(m.draft, original); assert.equal(m.expansion.buffer, candidate.candidate.slice(0, -1));
  m = step(m, 'done'); assert.equal(m.screen.name, 'expansion'); assert.equal(m.draft, original);
  assert.equal(m.expansion.result!.candidate, candidate.candidate.slice(0, -1)); assert.equal(m.authorization, null);
  m = step(m, 'keep-words'); assert.equal(m.screen.name, 'compose'); assert.equal(m.draft, original);
  m = receive(step(m, 'expand')); m = step(m, 'edit-expansion'); m = step(m, 'erase');
  m = step(step(m, 'row:editing'), 'back'); assert.equal(m.screen.name, 'expansion'); assert.equal(m.expansion.result!.candidate, candidate.candidate);
});

test('ambiguous input gets one explicit clarification and never assigns daily without an answer', () => {
  let m = step(fixture('belly weak daily hurt'), 'expand'); const source = m.draft;
  const clarify: ExpansionResult = { status: 'clarify', candidate: '', unresolvedCues: ['daily'], clarificationQuestion: 'Which happens daily?', clarificationChoices: ['Belly pain', 'Weakness', 'Both', 'Keep my words'] };
  m = receive(m, clarify); assert.equal(m.draft, source); assert.equal(m.authorization, null);
  assert.equal(choices(m).filter(c => c.label === 'Keep my words').length, 1);
  const kept = step(m, 'keep-words'); assert.equal(kept.expansion.request, null); assert.equal(kept.draft, source);
  m = step(m, 'clarify-expansion:1'); assert.equal(m.expansion.request!.clarification, 'Weakness');
  assert.equal(m.expansion.request!.text, source); assert.equal(m.draft, source);
});

test('late expansion cannot overwrite edits, changed context, focus loss, cancellation or retired runtime', () => {
  const pending = step(fixture(), 'expand'), request = pending.expansion.request!;
  for (const altered of [
    { ...pending, draft: 'new authored words', revision: pending.revision + 1 },
    { ...pending, context: 'home' as const },
    { ...pending, cloud: { ...pending.cloud, consent: false } },
    interrupt(pending, 'Focus lost'), retireRuntimeAuthorization(pending), step(pending, 'keep-words'), step(pending, 'back'),
  ]) assert.equal(finishExpansion(altered, request, candidate), altered);
  assert.equal(interrupt(pending, 'Focus lost').expansion.request, null);
  let m = receive(pending); const firstId = request.id; m = step(step(m, 'keep-words'), 'expand');
  assert.notEqual(m.expansion.request!.id, firstId); assert.equal(m.expansion.request!.text, request.text);
  assert.equal(finishExpansion(m, request, candidate), m);
});

test('failed and insufficient expansion preserve a complete manual route and never speak', () => {
  const pending = step(fixture(), 'expand');
  for (const m of [finishExpansion(pending, pending.expansion.request!, null, 'Unavailable'), receive(pending, { ...candidate, status: 'insufficient_input', candidate: '' })]) {
    assert.equal(m.draft, pending.draft); assert.equal(m.authorization, null);
    const kept = step(m, 'keep-words'); assert.ok(inputView(kept).targets.includes('spell')); assert.ok(inputView(kept).targets.includes('review'));
  }
});

test('retained live state receives General and empty expansion without replacing its authored content', () => {
  const m = fixture(); const retained = { ...m, context: undefined, expansion: undefined } as unknown as Model;
  const upgraded = withCloudDefaults(retained); assert.equal(upgraded.context, 'general'); assert.equal(upgraded.expansion.request, null);
  assert.equal(upgraded.draft, m.draft); assert.equal(upgraded.cloud, m.cloud);
});
