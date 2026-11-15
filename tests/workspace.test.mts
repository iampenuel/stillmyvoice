import test from 'node:test';
import assert from 'node:assert/strict';
import { choices, choiceSections, choose, initialModel, inputView, presented } from '../src/communication/model.mts';
import { revealDelta } from '../src/communication/view-layout.mts';
import { InputCoordinator } from '../src/communication/input-coordinator.mts';
const step = (s: ReturnType<typeof initialModel>, id: string) => {
  assert.ok(choices(s).some(c => c.id === id && !c.disabled), id); return choose(s, id, s.uiRevision);
};
test('quick phrases reduce category navigation while composition and review remain silent', () => {
  let s = initialModel('quick'); s.settings.voice = 'fixture';
  s = step(step(s, 'phrases'), 'phrase:2');
  assert.equal(s.draft, 'Please reposition me.'); assert.equal(s.authorization, null);
  s = step(s, 'review'); assert.equal(s.authorization, null); assert.equal(choose(s, 'speak', s.uiRevision), s);
  s = presented(s, s.revision, 0); s = step(s, 'speak'); assert.equal(s.authorization?.text, 'Please reposition me.');
});
test('explicit negation shortcut stages exact occurrence replacement, supports rejection, and never speaks', () => {
  let s = initialModel('repair'); s.draft = 'Please reposition me; reposition later.'; s.settings.voice = 'fixture';
  s = step(step(step(s, 'review'), 'edit'), 'word:1');
  const original = s.draft;
  let staged = step(s, 'prefix:not');
  assert.equal(staged.draft, original); assert.equal(staged.repair?.buffer, 'do not reposition');
  assert.equal(staged.authorization, null);
  assert.equal(step(staged, 'back').draft, original);
  const staleRevision = staged.uiRevision;
  staged = step(staged, 'done');
  assert.equal(staged.draft, 'Please do not reposition me; reposition later.');
  assert.equal(staged.authorization, null); assert.equal(staged.review, null);
  assert.equal(choose(staged, 'speak', staleRevision), staged);
});
test('direct Space, Backspace and Done keep the same letter groups and exact characters', () => {
  let s = step(initialModel('typing'), 'spell');
  const groups = choices(s).slice(0, 5).map(x => x.id);
  s = step(step(s, 'row:fghij'), 'char:h'); s = step(s, 'char: ');
  assert.equal(s.draft, 'h '); assert.deepEqual(choices(s).slice(0, 5).map(x => x.id), groups);
  s = step(s, 'erase'); assert.equal(s.draft, 'h'); s = step(s, 'done');
  assert.equal(s.screen.name, 'compose'); assert.equal(s.authorization, null);
});
test('registered scan targets follow rendered content/navigation order, with disabled choices excluded', () => {
  const initial = initialModel('view');
  for (const s of [initial, step(initial, 'phrases'), step(initial, 'spell'), step(initial, 'more')]) {
    const sections = choiceSections(s);
    assert.deepEqual(inputView(s).targets, [...sections.primary, ...sections.navigation].filter(x => !x.disabled).map(x => x.id));
  }
});
test('normal keyboard overview has five stable groups plus Expand and a compact navigation set', () => {
  let s = initialModel('overview'); s.draft = 'fictional keywords'; s.cloud.consent = true; s.cloud.gemini = true;
  s = step(s, 'spell');
  const groups = ['row:abcde', 'row:fghij', 'row:klmno', 'row:pqrst', 'row:uvwxyz'];
  assert.deepEqual(choiceSections(s).primary.map(x => x.id), [...groups, 'expand']);
  assert.deepEqual(choiceSections(s).navigation.map(x => x.id), ['row:editing', 'done', 'char: ', 'erase', 'keyboard-layout', 'review', 'back']);
  s = step(step(s, 'row:fghij'), 'char:h');
  assert.equal(s.screen.value, 'rows'); assert.equal(inputView(s).targets[0], 'row:fghij');
  assert.deepEqual(choiceSections(s).primary.map(x => x.id), [...groups, 'expand']);
  s = step(s, 'row:editing');
  assert.ok(choiceSections(s).primary.some(x => x.id === 'row:numbers'));
  assert.ok(choiceSections(s).navigation.some(x => x.id === 'back'));
  assert.equal(s.authorization, null);
});
test('panel reveal moves only the minimum required offset and leaves visible targets stationary', () => {
  assert.equal(revealDelta(30, 70, 0, 100), 0);
  assert.equal(revealDelta(-10, 30, 0, 100), -10);
  assert.equal(revealDelta(90, 130, 0, 100), 30);
});
test('hidden or obscured target cannot begin or complete a simulated selection either', () => {
  for (const duringHold of [false, true]) {
    let visible = duringHold, selected = 0;
    const c = new InputCoordinator({ id: 'view', revision: 0, targets: ['choice'] }, {
      changed: () => {}, interrupted: () => {}, selected: () => { selected++; }, targetVisible: () => visible,
    }, undefined, () => true, () => 'visible-test', async () => {});
    c.simulate(); c.down(); visible = false; c.up();
    assert.equal(selected, 0); assert.equal(c.mode, 'none'); assert.equal(c.state.capture, null);
  }
});
