import test from 'node:test';
import assert from 'node:assert/strict';
import { InputCoordinator } from '../src/communication/input-coordinator.mts';
import type { DataPort, AdapterCallbacks } from '../src/input/web-serial-adapter.mts';
import { choose, initialModel, inputView, presented, speechEvent } from '../src/communication/model.mts';
const flush = () => new Promise<void>(resolve => setImmediate(resolve));
test('view navigation closes old session before opening same verified port, with no selection from held rearming', async () => {
  let serial = 0, open = 0, maxOpen = 0; const callbacks: AdapterCallbacks[] = [], epochs: string[] = [], selected: string[] = [];
  const port = new EventTarget() as DataPort;
  const controller = new InputCoordinator({ id: 'a', revision: 1, targets: ['first'] }, {
    changed: () => {}, selected: s => selected.push(s.targetId), interrupted: () => {},
  }, async (chooser, verify, cb) => {
    assert.equal(await chooser.requestPort({ filters: [] }), port); assert.equal(await verify(port), true);
    open++; maxOpen = Math.max(maxOpen, open); callbacks.push(cb); epochs.push(cb.epoch(`session-${++serial}`));
    let closed!: () => void, stopped = false;
    const done = new Promise<void>(resolve => { closed = resolve; });
    return { closed: done, stop: () => { if (stopped) return; stopped = true; open--; cb.cancelled('retired'); closed(); } };
  }, () => true, () => `idle-${++serial}`, async () => {});
  await controller.connect({ requestPort: async () => port }, async () => true);
  callbacks[0].input({ v: 2, type: 'sync', epoch: epochs[0], sequence: 0, tick_ms: 1, pressed: false });
  callbacks[0].input({ v: 2, type: 'down', epoch: epochs[0], sequence: 1, tick_ms: 2 });
  controller.setView({ id: 'b', revision: 2, targets: ['second'] }); await flush();
  callbacks[0].input({ v: 2, type: 'up', epoch: epochs[0], sequence: 2, downSequence: 1, tick_ms: 3 });
  assert.deepEqual(selected, []); assert.notEqual(epochs[0], epochs[1]); assert.equal(maxOpen, 1);
  callbacks[1].input({ v: 2, type: 'sync', epoch: epochs[1], sequence: 0, tick_ms: 4, pressed: true });
  assert.equal(controller.state.phase, 'needs-sync');
  callbacks[1].input({ v: 2, type: 'sync', epoch: epochs[1], sequence: 1, tick_ms: 5, pressed: false });
  assert.deepEqual(selected, []);
  callbacks[1].input({ v: 2, type: 'down', epoch: epochs[1], sequence: 2, tick_ms: 6 });
  callbacks[1].input({ v: 2, type: 'up', epoch: epochs[1], sequence: 3, downSequence: 2, tick_ms: 7 });
  assert.deepEqual(selected, ['second']); controller.stop('focus loss'); await flush(); assert.equal(open, 0);
  controller.setView({ id: 'c', revision: 3, targets: ['third'] }); await flush(); assert.equal(callbacks.length, 2);
});
test('simulation release after a replaced view only rearms; it does not select the new target', () => {
  const selected: string[] = []; let serial = 0;
  const c = new InputCoordinator({ id: 'a', revision: 0, targets: ['old'] }, { changed: () => {}, selected: s => selected.push(s.targetId), interrupted: () => {} }, undefined, () => true, () => `sim-${++serial}`, async () => {});
  c.simulate(); c.down(); c.setView({ id: 'b', revision: 1, targets: ['new'] }); c.up();
  assert.equal(c.state.phase, 'armed'); assert.deepEqual(selected, []);
  c.down(); c.up(); assert.deepEqual(selected, ['new']);
});
test('rapid review presentation waits for an in-progress close before opening the newest view', async () => {
  const port = new EventTarget() as DataPort; let serial = 0, opens = 0, active = 0;
  let finishClose!: () => void;
  const c = new InputCoordinator({ id: 'compose', revision: 1, targets: ['review'] }, {
    changed: () => {}, selected: () => {}, interrupted: () => {},
  }, async (chooser, verify, cb) => {
    const selected = await chooser.requestPort({ filters: [] }); assert.equal(await verify(selected), true);
    opens++; active++; assert.equal(active, 1, 'no second port.open before the previous close resolves');
    cb.epoch(`session-${++serial}`);
    let stopped = false;
    const closed = new Promise<void>(resolve => { finishClose = () => { active--; resolve(); }; });
    return { closed, stop: () => { if (!stopped) { stopped = true; cb.cancelled('retired'); } } };
  }, () => true, () => `idle-${++serial}`, async () => {});
  await c.connect({ requestPort: async () => port }, async () => true);
  c.setView({ id: 'review', revision: 2, targets: ['back'] });
  c.setView({ id: 'review', revision: 3, targets: ['speak', 'back'] });
  await flush(); assert.equal(opens, 1, 'presentation update must await the outstanding close');
  finishClose(); await flush(); assert.equal(opens, 2); assert.equal(c.state.view?.revision, 3);
  c.stop('test done', false); finishClose(); await flush();
});
test('DTR-low settling is shared by rapid view changes and focus loss prevents a deferred reopen', async () => {
  const port = new EventTarget() as DataPort; let serial = 0, opens = 0, settles = 0;
  let release!: () => void;
  const c = new InputCoordinator({ id: 'first', revision: 0, targets: ['next'] }, { changed: () => {}, selected: () => {}, interrupted: () => {} },
    async (_, __, cb) => {
      opens++; cb.epoch(`session-${++serial}`); let done!: () => void, stopped = false;
      return { closed: new Promise<void>(resolve => { done = resolve; }), stop: () => { if (!stopped) { stopped = true; cb.cancelled('retired'); done(); } } };
    }, () => true, () => `idle-${++serial}`, () => { settles++; return new Promise<void>(resolve => { release = resolve; }); });
  await c.connect({ requestPort: async () => port }, async () => true);
  c.setView({ id: 'review', revision: 1, targets: ['back'] }); await flush();
  c.setView({ id: 'review', revision: 2, targets: ['speak', 'back'] }); await flush();
  assert.equal(opens, 1); assert.equal(settles, 1);
  c.stop('Focus lost'); release(); await flush();
  assert.equal(opens, 1); assert.equal(c.mode, 'none');
});
test('phrase, playback, negation edit and review each require their own fresh exact-text approval', async () => {
  let model = initialModel('integrated'); model.settings.voice = 'test-voice';
  let callbacks!: AdapterCallbacks, epoch = '', sequence = 0, serial = 0, actions = 0;
  const port = new EventTarget() as DataPort;
  const c = new InputCoordinator(inputView(model), {
    changed: () => {}, interrupted: reason => assert.fail(reason),
    selected: selection => {
      assert.equal(selection.viewId, model.screen.name); actions++;
      model = choose(model, selection.targetId, selection.revision); c.setView(inputView(model));
    },
  }, async (_, __, cb) => {
    callbacks = cb; epoch = cb.epoch(`session-${++serial}`); sequence = 0;
    cb.input({ v: 2, type: 'sync', epoch, sequence, tick_ms: 1, pressed: false });
    let finish!: () => void, stopped = false;
    return { closed: new Promise<void>(resolve => { finish = resolve; }), stop: () => { if (!stopped) { stopped = true; cb.cancelled('retired'); finish(); } } };
  }, () => true, () => `idle-${++serial}`, async () => {});
  await c.connect({ requestPort: async () => port }, async () => true);
  const select = async (target: string) => {
    assert.ok(c.state.view?.targets.includes(target), `${target} is registered for scanning`);
    while (c.state.view!.targets[c.state.index] !== target) c.tick();
    callbacks.input({ v: 2, type: 'down', epoch, sequence: ++sequence, tick_ms: 2 });
    for (let i = 0; i < 10; i++) c.tick();
    const downSequence = sequence;
    callbacks.input({ v: 2, type: 'up', epoch, sequence: ++sequence, downSequence, tick_ms: 3 });
    await flush();
  };
  await select('phrases'); await select('phrase:2');
  await select('review'); assert.equal(model.authorization, null);
  assert.equal(c.state.view?.targets.includes('speak'), false);
  model = presented(model, model.revision, 0); c.setView(inputView(model)); await flush();
  assert.ok(c.state.view?.targets.includes('speak')); assert.equal(model.authorization, null);
  await select('speak'); assert.equal((model as ReturnType<typeof initialModel>).authorization?.text, 'Please reposition me.');
  assert.equal(actions, 4); assert.deepEqual(c.state.view?.targets, ['stop']);
  const first = (model as ReturnType<typeof initialModel>).authorization!;
  model = speechEvent(model, first.id, 'end'); c.setView(inputView(model)); await flush();
  await select('edit'); await select('word:1');
  for (const letter of 'do not reposition') {
    const row = letter === ' ' ? 'editing' : ['abcde', 'fghij', 'klmno', 'pqrst', 'uvwxyz'].find(group => group.includes(letter))!;
    await select(`row:${row}`); await select(`char:${letter}`);
    assert.equal(model.authorization, null);
  }
  await select('done');
  assert.equal(model.draft, 'Please do not reposition me.');
  await select('review'); assert.equal(model.authorization, null);
  model = presented(model, model.revision, 0); c.setView(inputView(model)); await flush();
  // An old playback completion cannot grant approval or navigate this new review.
  assert.equal(speechEvent(model, first.id, 'end'), model);
  await select('speak');
  const second = (model as ReturnType<typeof initialModel>).authorization!;
  assert.equal(second.text, 'Please do not reposition me.'); assert.notEqual(second.id, first.id);
  c.stop('Test complete', false); await flush();
});
