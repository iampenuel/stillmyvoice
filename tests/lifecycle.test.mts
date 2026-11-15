import { initialComposeModel } from './communication-fixture.mts';
import test from 'node:test';
import assert from 'node:assert/strict';
import { InputCoordinator } from '../src/communication/input-coordinator.mts';
import { choose, inputView, interrupt, presented, retireRuntimeAuthorization, speechEvent, type Model } from '../src/communication/model.mts';
import type { AdapterCallbacks, DataPort } from '../src/input/web-serial-adapter.mts';
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
const step = (s: Model, id: string) => choose(s, id, s.uiRevision);

async function fixture(initial?: Model) {
  let model = initial ?? initialComposeModel('lifecycle'); model.draft ||= 'Please reposition me.'; model.settings.voice = 'fixture';
  let active = true, pressed = false, unavailable = false, serial = 0, opens = 0;
  const sessions: { cb: AdapterCallbacks; epoch: string; sequence: number }[] = [], actions: string[] = [];
  const port = new EventTarget() as DataPort;
  const coordinator = new InputCoordinator(inputView(model), {
    changed: () => {},
    selected: selection => {
      actions.push(selection.targetId); model = choose(model, selection.targetId, selection.revision);
      coordinator.setView(inputView(model));
    },
    interrupted: reason => { model = interrupt(model, reason); coordinator.setView(inputView(model)); },
  }, async (_, __, cb) => {
    opens++;
    if (unavailable) throw Error('Port unavailable or owned by another session');
    const epoch = cb.epoch('connection-' + ++serial); sessions.push({ cb, epoch, sequence: 0 });
    cb.input({ v: 2, type: 'sync', epoch, sequence: 0, tick_ms: 0, pressed });
    let finish!: () => void, stopped = false;
    return { closed: new Promise<void>(resolve => { finish = resolve; }), stop: () => {
      if (stopped) return; stopped = true; cb.cancelled('View retired'); finish();
    } };
  }, () => active, () => 'idle-' + ++serial, async () => {});
  await coordinator.connect({ requestPort: async () => port }, async () => true);
  return {
    coordinator, sessions, actions, model: () => model, opens: () => opens,
    inactive: (reason: string) => { active = false; coordinator.suspend(reason); },
    foreground: async () => { active = true; await coordinator.foreground(); await flush(); },
    pressed: (value: boolean) => { pressed = value; }, unavailable: () => { unavailable = true; },
    cycle: async () => {
      const s = sessions.at(-1)!;
      s.cb.input({ v: 2, type: 'down', epoch: s.epoch, sequence: ++s.sequence, tick_ms: 1 });
      const downSequence = s.sequence;
      s.cb.input({ v: 2, type: 'up', epoch: s.epoch, sequence: ++s.sequence, downSequence, tick_ms: 2 });
      await flush();
    },
  };
}
test('temporary window/tab inactivity preserves compose, review and unfinished correction; return only arms Resume', async () => {
  const compose = initialComposeModel('context'); compose.draft = 'Please reposition me.';
  const review = step(compose, 'review');
  const correction = step(step(review, 'edit'), 'word:1');
  const typed = step(step(correction, 'row:abcde'), 'char:d');
  for (const before of [compose, review, typed]) for (const cause of ['Focus lost', 'Page hidden']) {
    const f = await fixture(structuredClone(before)); const draft = f.model().draft, repair = structuredClone(f.model().repair);
    f.inactive(cause); f.inactive('Page hidden');
    assert.equal(f.model().draft, draft); assert.deepEqual(f.model().repair, repair);
    assert.equal(f.coordinator.mode, 'none'); assert.equal(f.model().authorization, null);
    await f.foreground();
    assert.equal(f.model().screen.name, 'paused'); assert.deepEqual(f.actions, []);
    assert.deepEqual(f.coordinator.state.view?.targets, ['resume']);
    await f.cycle();
    assert.deepEqual(f.actions, ['resume']); assert.equal(f.model().screen.name, before.screen.name);
    assert.equal(f.model().draft, draft); assert.deepEqual(f.model().repair, repair);
    f.coordinator.stop('test done', false); await flush();
  }
});
test('held focus loss cancels capture; held foreground snapshot and its release cannot select', async () => {
  const f = await fixture(); const old = f.sessions.at(-1)!; const draft = f.model().draft;
  old.cb.input({ v: 2, type: 'down', epoch: old.epoch, sequence: 1, tick_ms: 0 });
  f.pressed(true); f.inactive('Focus lost'); await f.foreground();
  assert.equal(f.coordinator.state.phase, 'needs-sync'); assert.deepEqual(f.actions, []);
  old.cb.input({ v: 2, type: 'up', epoch: old.epoch, sequence: 2, downSequence: 1, tick_ms: 1 });
  const fresh = f.sessions.at(-1)!; f.pressed(false);
  fresh.cb.input({ v: 2, type: 'sync', epoch: fresh.epoch, sequence: ++fresh.sequence, tick_ms: 2, pressed: false });
  assert.deepEqual(f.actions, []); assert.equal(f.coordinator.state.phase, 'armed');
  await f.cycle(); assert.deepEqual(f.actions, ['resume']); assert.equal(f.model().draft, draft);
  f.coordinator.stop('test done', false); await flush();
});
test('release while away does not replay on return, and duplicate foreground notifications open once', async () => {
  const f = await fixture(); const old = f.sessions.at(-1)!;
  old.cb.input({ v: 2, type: 'down', epoch: old.epoch, sequence: 1, tick_ms: 0 });
  f.inactive('Page hidden'); f.pressed(false);
  old.cb.input({ v: 2, type: 'up', epoch: old.epoch, sequence: 2, downSequence: 1, tick_ms: 1 });
  await Promise.all([f.foreground(), f.foreground()]); assert.equal(f.opens(), 2);
  assert.deepEqual(f.actions, []); assert.equal(f.model().draft, 'Please reposition me.');
  f.coordinator.stop('test done', false); await flush();
});
test('real port faults and explicit disconnect do not auto-reconnect on focus; unavailable foreground attempt never loops', async () => {
  for (const reason of ['Port lost', 'Malformed field tick_ms: decimal number', 'Explicit disconnect', 'Page unloaded']) {
    const f = await fixture(); f.coordinator.stop(reason); await f.foreground();
    assert.equal(f.opens(), 1); assert.equal(f.model().draft, 'Please reposition me.'); assert.deepEqual(f.actions, []);
  }
  const f = await fixture(); f.inactive('Focus lost'); f.unavailable();
  await f.foreground(); await f.foreground();
  assert.equal(f.opens(), 2); assert.equal(f.coordinator.mode, 'none');
  assert.equal(f.model().draft, 'Please reposition me.'); assert.deepEqual(f.actions, []);
});
test('focus loss retires prepared speech authorization; returning and Resume cannot restore it', async () => {
  let m = initialComposeModel('speech'); m.draft = 'Please do not reposition me.'; m.settings.voice = 'fixture';
  m = step(m, 'review'); m = presented(m, m.revision, 0); m = step(m, 'speak');
  assert.ok(m.authorization);
  const f = await fixture(m); f.inactive('Focus lost'); await f.foreground(); await f.cycle();
  assert.equal(f.model().draft, m.draft); assert.equal(f.model().authorization, null);
  assert.equal(f.model().screen.name, 'review'); assert.equal(f.model().speech, 'Stopped');
  assert.equal(initialComposeModel('reload').draft, ''); assert.equal(initialComposeModel('reload').authorization, null);
  f.coordinator.stop('test done', false); await flush();
});
test('controller replacement retires retained approval before a new engine can consume it', () => {
  let m = initialComposeModel('hot-refresh'); m.draft = 'Do not change my words.'; m.settings.voice = 'fixture';
  m = step(m, 'review'); m = presented(m, m.revision, 0); m = step(m, 'speak');
  const id = m.authorization!.id;
  const next = retireRuntimeAuthorization(m);
  assert.equal(next.draft, m.draft); assert.equal(next.authorization, null); assert.equal(next.speech, 'Stopped');
  assert.equal(next.screen.name, 'paused'); assert.equal(speechEvent(next, id, 'end'), next);
});
