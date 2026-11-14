import test from 'node:test';
import assert from 'node:assert/strict';
import { clockSample, clockSamplesAgree, eventIsFresh } from '../src/input/freshness.mts';

test('fresh device events pass while delayed events within the same epoch fail', () => {
  const clock = clockSample(1000, 1020, 500);
  assert.equal(eventIsFresh(550, 1080, clock), true);
  assert.equal(eventIsFresh(550, 1400, clock), false);
});

test('successive clock anchors agree across the early wrap but reject stopped or jumping clocks', () => {
  const previous = clockSample(0, 10, 2 ** 29 - 100);
  assert.equal(clockSamplesAgree(previous, clockSample(200, 210, 100)), true);
  assert.equal(clockSamplesAgree(previous, clockSample(200, 210, 2 ** 29 - 100)), false);
  assert.equal(clockSamplesAgree(previous, clockSample(200, 210, 500)), false);
});
test('device clock wrap is handled without making stale events fresh', () => {
  const clock = clockSample(0, 10, 2 ** 29 - 20);
  assert.equal(eventIsFresh(20, 60, clock), true);
  assert.equal(eventIsFresh(20, 400, clock), false);
});
test('expired heartbeat evidence, future events and malformed timestamps fail closed', () => {
  const clock = clockSample(0, 10, 500);
  assert.equal(eventIsFresh(1500, 1100, clock), false);
  assert.equal(eventIsFresh(900, 20, clock), false);
  for (const tick of [-1, NaN, Infinity, 1.5, 2 ** 29]) assert.equal(eventIsFresh(tick, 20, clock), false);
  assert.throws(() => clockSample(0, 101, 500));
  assert.throws(() => clockSample(10, 0, 500));
});
