import test from 'node:test';
import assert from 'node:assert/strict';
import { InputCoordinator } from '../src/communication/input-coordinator.mts';
import type { DataPort, AdapterCallbacks } from '../src/input/web-serial-adapter.mts';
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
  }, () => true, () => `idle-${++serial}`);
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
  const c = new InputCoordinator({ id: 'a', revision: 0, targets: ['old'] }, { changed: () => {}, selected: s => selected.push(s.targetId), interrupted: () => {} }, undefined, () => true, () => `sim-${++serial}`);
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
  }, () => true, () => `idle-${++serial}`);
  await c.connect({ requestPort: async () => port }, async () => true);
  c.setView({ id: 'review', revision: 2, targets: ['back'] });
  c.setView({ id: 'review', revision: 3, targets: ['speak', 'back'] });
  await flush(); assert.equal(opens, 1, 'presentation update must await the outstanding close');
  finishClose(); await flush(); assert.equal(opens, 2); assert.equal(c.state.view?.revision, 3);
  c.stop('test done', false); finishClose(); await flush();
});
