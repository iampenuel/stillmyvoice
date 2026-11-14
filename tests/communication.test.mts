import test from 'node:test';
import assert from 'node:assert/strict';
import { choices, choose, initialModel, interrupt, paginate, presented, speechEvent, type Model } from '../src/communication/model.mts';
import { SpeechController, type SpeechEngine } from '../src/communication/speech.mts';

function step(s: Model, id: string) { assert.ok(choices(s).some(x => x.id === id && !x.disabled), `available ${id} on ${s.screen.name}`); return choose(s, id, s.uiRevision); }
function message(text = 'I am not in pain.') {
  const s = initialModel('test-session'); s.draft = text; s.revision = 1;
  s.voices = [{ id: 'fixture', name: 'Test voice', lang: 'en-US', local: true }]; s.settings.voice = 'fixture'; return s;
}
function reviewed(text?: string) {
  let s = step(message(text), 'review');
  for (let page = 0; page < s.review!.pages.length; page++) {
    s = presented(s, s.revision, page);
    if (page + 1 < s.review!.pages.length) s = step(s, 'next');
  }
  return s;
}
test('phrase composition and review never authorize speech; a fresh activation freezes exact text', () => {
  let s = initialModel('instance'); s.settings.voice = 'fixture';
  s = step(step(s, 'phrases'), 'phrase:2');
  assert.equal(s.draft, 'Please reposition me.'); assert.equal(s.authorization, null);
  s = step(s, 'review'); const oldRevision = s.uiRevision;
  assert.equal(s.authorization, null); assert.equal(choose(s, 'speak', s.uiRevision), s);
  s = presented(s, s.revision, 0);
  assert.equal(choose(s, 'speak', oldRevision), s);
  s = step(s, 'speak'); assert.equal(s.authorization?.text, 'Please reposition me.');
  assert.ok(Object.isFrozen(s.authorization)); assert.equal(s.screen.name, 'speaking');
  assert.deepEqual(choices(s).map(x => x.id), ['stop']);
});
test('long-message review needs every exact page and cannot authorize stale or edited content', () => {
  const text = 'Please move my left arm, not my right.  '.repeat(20) + '\nEnd. 🗣️';
  let s = step(message(text), 'review');
  assert.equal(s.review!.pages.join(''), text); assert.equal(paginate(text).join(''), text);
  s = presented(s, s.revision, 0); s = step(s, 'next');
  assert.equal(choose(s, 'speak', s.uiRevision), s);
  s = reviewed(text); s = step(s, 'speak'); const auth = s.authorization!;
  s = interrupt(s, 'Focus lost'); assert.equal(s.authorization, null); assert.equal(s.draft, text);
  assert.equal(speechEvent(s, auth.id, 'end'), s);
  s = step(s, 'resume'); assert.equal(s.authorization, null);
});
test('correction changes one occurrence, preserves punctuation/whitespace, and Undo restores exact text', () => {
  let s = step(step(message('left,  left!'), 'review'), 'edit'); s = step(s, 'word:1');
  for (const [row, char] of [['pqrst', 'r'], ['fghij', 'i'], ['fghij', 'g'], ['fghij', 'h'], ['pqrst', 't']]) {
    s = step(step(s, `row:${row}`), `char:${char}`);
  }
  assert.equal(s.draft, 'left,  left!');
  s = step(s, 'done'); assert.equal(s.draft, 'left,  right!');
  s = step(step(s, 'more'), 'undo'); assert.equal(s.draft, 'left,  left!'); assert.equal(s.authorization, null);
});
test('empty correction is not deletion; explicit deletion stages then applies', () => {
  let s = step(step(step(message('No. Thank you.'), 'review'), 'edit'), 'word:0');
  assert.equal(choose(s, 'done', s.uiRevision), s);
  s = step(s, 'row:editing'); s = step(s, 'delete-word');
  assert.equal(s.draft, 'No. Thank you.'); s = step(s, 'done'); assert.equal(s.draft, '. Thank you.');
});
test('spelling, case, punctuation and intentional clear are switch reachable without text normalization', () => {
  let s = step(initialModel('spelling'), 'spell');
  s = step(step(s, 'row:editing'), 'upper'); s = step(step(s, 'row:rows'), 'row:fghij'); s = step(s, 'char:i');
  s = step(step(s, 'row:editing'), 'char: '); s = step(step(s, 'row:klmno'), 'char:n');
  s = step(s, 'done'); assert.equal(s.draft, 'I n');
  s = step(step(s, 'more'), 'clear'); assert.equal(s.draft, 'I n');
  s = step(s, 'confirm-clear'); assert.equal(s.draft, '');
  s = step(step(s, 'more'), 'undo'); assert.equal(s.draft, 'I n');
});
test('preview contains only the fixed sample; stop preserves the draft and replay needs a new approval', () => {
  let s = step(step(message(), 'more'), 'settings'); s = step(s, 'preview');
  assert.equal(s.authorization?.text, 'This is the selected voice.');
  s = step(s, 'stop'); assert.equal(s.draft, 'I am not in pain.'); assert.equal(s.authorization, null);
  let spoken = step(reviewed(), 'speak'), id = spoken.authorization!.id;
  spoken = speechEvent(spoken, id, 'end'); assert.equal(spoken.screen.name, 'complete');
  spoken = step(spoken, 'review'); assert.equal(spoken.authorization, null);
});
test('speech consumes authorization once, rejects invalid work, and ignores late callbacks after cancellation', () => {
  const events: string[] = [], requests: string[] = []; let callback: ((event: 'start' | 'end' | 'error') => void) | undefined;
  const engine: SpeechEngine = { voices: () => [], cancel: () => {}, speak: (auth, next) => { requests.push(auth.text); callback = next; } };
  const controller = new SpeechController(engine), auth = step(reviewed(), 'speak').authorization!;
  assert.equal(controller.start(auth, () => false, e => events.push(e)), false);
  assert.equal(controller.start(auth, () => true, e => events.push(e)), true);
  assert.equal(controller.start(auth, () => true, e => events.push(e)), false);
  callback!('start'); controller.cancel(); callback!('end');
  assert.deepEqual(requests, ['I am not in pain.']); assert.deepEqual(events, ['start']);
});
test('layout interruption resets review presentation and recovery creates readable pages again', () => {
  let s = reviewed('Fictional wording. '.repeat(30));
  assert.equal(s.review!.seen.length, s.review!.pages.length);
  s = interrupt(s, 'Layout changed — input and speech stopped');
  assert.equal(s.review, null); s = step(s, 'resume');
  assert.equal(s.screen.name, 'review'); assert.deepEqual(s.review!.seen, []);
  assert.equal(s.review!.pages.join(''), s.draft); assert.equal(choose(s, 'speak', s.uiRevision), s);
});
