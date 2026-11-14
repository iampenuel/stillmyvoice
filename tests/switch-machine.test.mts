import test from 'node:test';
import assert from 'node:assert/strict';
import { createSwitchState, reduceSwitch, type SwitchState } from '../src/input/switch-machine.mts';

const view = { id: 'diagnostic', revision: 1, targets: ['one', 'two', 'three'] };
const send = (state: SwitchState, event: unknown) => reduceSwitch(state, event).state;
const tick = (state: SwitchState) => send(state, { type: 'tick', epoch: state.epoch });
const sync = (state: SwitchState, pressed = false, sequence = 0) =>
  send(state, { type: 'sync', epoch: state.epoch, sequence, pressed });
const down = (state: SwitchState) =>
  send(state, { type: 'down', epoch: state.epoch, sequence: (state.lastSequence ?? 0) + 1 });
const up = (state: SwitchState) => reduceSwitch(state, {
  type: 'up', epoch: state.epoch, sequence: (state.lastSequence ?? 0) + 1,
  downSequence: state.capture?.downSequence ?? 0,
});
function ready(instanceId = 'test-instance'): SwitchState {
  let state = createSwitchState(view, instanceId);
  state = send(state, { type: 'activity', active: true });
  state = send(state, { type: 'connect' });
  return sync(state);
}

test('ten deliberate cycles each emit exactly one captured selection', () => {
  let state = ready();
  const targets: string[] = [];
  for (let i = 0; i < 10; i++) {
    const held = down(state);
    assert.equal(held.selections, i);
    const transition = up(held);
    assert.ok(transition.selection);
    targets.push(transition.selection.targetId);
    assert.equal(transition.selection.ordinal, i + 1);
    assert.equal(transition.selection.revision, 1);
    assert.equal(transition.state.capture, null);
    state = tick(transition.state);
  }
  assert.deepEqual(targets, ['one', 'two', 'three', 'one', 'two', 'three', 'one', 'two', 'three', 'one']);
  assert.equal(state.selections, 10);
});

test('a prolonged hold freezes the captured target and never repeats', () => {
  let state = down(tick(ready()));
  const capture = state.capture;
  for (let i = 0; i < 1000; i++) state = tick(state);
  assert.equal(state.index, 1);
  assert.equal(state.capture, capture);
  assert.equal(state.selections, 0);
  assert.equal(up(state).selection?.targetId, 'two');
});

test('duplicate DOWN cancels; its later UP cannot select', () => {
  const held = down(ready());
  const state = send(held, { type: 'down', epoch: held.epoch, sequence: held.lastSequence });
  assert.equal(state.phase, 'needs-sync');
  assert.equal(up(state).selection, null);
  assert.equal(state.selections, 0);
});

test('duplicate UP never emits a second selection', () => {
  const held = down(ready());
  const event = { type: 'up', epoch: held.epoch, sequence: 2, downSequence: 1 };
  const first = reduceSwitch(held, event);
  const second = reduceSwitch(first.state, event);
  assert.ok(first.selection);
  assert.equal(second.selection, null);
  assert.equal(second.state.selections, 1);
});

test('disconnect while held and reconnect while pressed require a fresh released snapshot', () => {
  const held = down(ready());
  let state = send(held, { type: 'disconnect' });
  assert.equal(state.capture, null);
  state = send(state, { type: 'connect' });
  state = sync(state, true, 20);
  assert.equal(state.phase, 'needs-sync');
  assert.equal(state.pressed, true);
  const release = reduceSwitch(state, { type: 'up', epoch: state.epoch, sequence: 21, downSequence: 1 });
  assert.equal(release.selection, null);
  assert.equal(release.state.phase, 'needs-sync');
  state = sync(release.state, false, 22);
  assert.equal(up(down(state)).selection?.ordinal, 1);
});

test('focus/visibility loss cancels; focus restoration alone does not arm', () => {
  let state = send(down(ready()), { type: 'activity', active: false });
  assert.equal(state.capture, null);
  assert.equal(up(state).selection, null);
  state = send(state, { type: 'activity', active: true });
  assert.equal(state.phase, 'needs-sync');
  assert.equal(up(down(sync(state))).selection?.ordinal, 1);
});

test('screen changes or draft revisions cannot reuse an old press', () => {
  for (const nextView of [
    { ...view, id: 'review', targets: ['approve', 'back'] },
    { ...view, revision: 2 },
    { ...view, targets: ['three', 'two', 'one'] },
  ]) {
    const held = down(ready());
    const state = send(held, { type: 'view', view: nextView });
    assert.equal(state.capture, null);
    assert.equal(up(state).selection, null);
    assert.equal(state.selections, 0);
    assert.equal(state.phase, 'needs-sync');
  }
});

test('reload uses a new instance; old events cannot act in the new instance', () => {
  const held = down(ready('previous-page'));
  const fresh = ready('new-page');
  const transition = reduceSwitch(fresh, { type: 'up', epoch: held.epoch, sequence: 2, downSequence: 1 });
  assert.equal(transition.selection, null);
  assert.equal(transition.state.selections, 0);
  assert.equal(transition.state.phase, 'needs-sync');
});

test('snapshots never complete a held press', () => {
  const held = down(ready());
  const transition = reduceSwitch(held, { type: 'sync', epoch: held.epoch, sequence: 2, pressed: false });
  assert.equal(transition.selection, null);
  assert.equal(transition.state.capture, null);
  assert.equal(transition.state.phase, 'needs-sync');
});

test('old, skipped, mismatched and malformed transport data cancels pending selection', () => {
  const held = down(ready());
  const base = { type: 'up', epoch: held.epoch, sequence: 2, downSequence: 1 };
  const events: unknown[] = [null, 'UP', [], {}, { type: 'speak' },
    { ...base, epoch: 'old' }, { ...base, sequence: 0 }, { ...base, sequence: 3 },
    { ...base, sequence: NaN }, { ...base, sequence: Infinity }, { ...base, sequence: '2' },
    { ...base, sequence: 2.5 }, { ...base, sequence: Number.MAX_SAFE_INTEGER + 1 },
    { ...base, downSequence: 0 }, { ...base, downSequence: undefined },
    { type: 'sync', epoch: held.epoch, sequence: 2, pressed: 'false' }, { type: 'fault' },
  ];
  for (const event of events) {
    const transition = reduceSwitch(held, event);
    assert.equal(transition.selection, null);
    assert.equal(transition.state.capture, null);
    assert.equal(transition.state.phase, 'needs-sync');
    assert.equal(transition.state.selections, 0);
  }
});

test('invalid or empty targets prevent arming', () => {
  for (const invalid of [null, { ...view, targets: [] }, { ...view, targets: ['same', 'same'] },
    { ...view, revision: -1 }, { ...view, targets: [''] }, { ...view, targets: [' '] },
    { ...view, targets: new Array<string>(1) }]) {
    const state = sync(send(ready(), { type: 'view', view: invalid }));
    assert.equal(state.phase, 'needs-sync');
    assert.equal(up(down(state)).selection, null);
  }
});

test('input views and captures are immutable, and effects are never stored for replay', () => {
  const mutableView = { ...view, targets: [...view.targets] };
  const initial = createSwitchState(mutableView, 'immutable');
  mutableView.targets[0] = 'changed';
  assert.equal(initial.view?.targets[0], 'one');
  const held = down(ready());
  assert.ok(Object.isFrozen(held));
  assert.ok(Object.isFrozen(held.capture));
  const selected = up(held);
  assert.ok(Object.isFrozen(selected.selection));
  assert.equal(reduceSwitch(selected.state, { type: 'tick', epoch: selected.state.epoch }).selection, null);
  assert.equal(held.selections, 0);
});

test('stale timers and ticks while inactive cannot move scan focus', () => {
  const state = tick(ready());
  assert.equal(send(state, { type: 'tick', epoch: 'retired' }).index, 1);
  const inactive = send(state, { type: 'activity', active: false });
  assert.equal(tick(inactive).index, 1);
});

test('bounded exhaustive event sequences preserve the press/release safety invariant', () => {
  let transitions = 0;
  let selections = 0;
  function explore(state: SwitchState, depth: number) {
    if (!depth) return;
    const sequence = (state.lastSequence ?? 0) + 1;
    const events = [
      { type: 'down', epoch: state.epoch, sequence },
      { type: 'up', epoch: state.epoch, sequence, downSequence: state.capture?.downSequence ?? 0 },
      { type: 'tick', epoch: state.epoch }, { type: 'disconnect' }, { type: 'connect' },
      { type: 'sync', epoch: state.epoch, sequence, pressed: false },
      { type: 'sync', epoch: state.epoch, sequence, pressed: true },
      { type: 'activity', active: !state.active },
      { type: 'view', view: { ...view, revision: (state.view?.revision ?? 0) + 1 } },
    ];
    for (const event of events) {
      const next = reduceSwitch(state, event);
      transitions++;
      assert.equal(next.state.selections - state.selections, next.selection ? 1 : 0);
      if (next.selection) {
        selections++;
        assert.equal(event.type, 'up');
        assert.equal(state.phase, 'held');
        assert.ok(state.active && state.connected && state.capture);
        assert.equal(next.selection.targetId, state.capture.targetId);
        assert.equal(next.selection.revision, state.capture.revision);
        assert.equal(next.selection.epoch, state.capture.epoch);
      }
      explore(next.state, depth - 1);
    }
  }
  explore(ready(), 5);
  assert.equal(transitions, 66429);
  assert.ok(selections > 0);
});
