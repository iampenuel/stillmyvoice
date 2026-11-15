import test from 'node:test';
import assert from 'node:assert/strict';
import { recoveryMessage } from '../src/communication/recovery.mts';
import { SerialSession } from '../src/input/serial-protocol.mts';

test('retired frames and device faults remain distinct, fatal, and never reach input', () => {
  for (const [epoch, type, reason] of [['old', 'up', 'Retired epoch received'], ['new', 'fault', 'Device reported fault']]) {
    const errors: string[] = [], diagnostics: string[] = [], inputs: unknown[] = [];
    const session = new SerialSession('new', { now: () => 0, nonce: () => 'nonce', send: () => {}, input: m => inputs.push(m), cancelled: r => errors.push(r), diagnostic: d => diagnostics.push(d) });
    session.start();
    session.receive(new TextEncoder().encode(JSON.stringify({ v: 2, type, epoch, sequence: 2, tick_ms: 0, ...(type === 'up' ? { downSequence: 1 } : {}) }) + '\n'));
    assert.deepEqual(errors, [reason]); assert.deepEqual(inputs, []); assert.equal(session.closed, true);
    assert.match(diagnostics[0], new RegExp(`RX ${type}`));
  }
});
test('faults remain connection warnings and unarmed recovery never claims switch readiness', () => {
  for (const reason of ['Retired epoch received', 'Device reported fault', 'Stale input or clock evidence', 'Write failed', 'Malformed field tick_ms: decimal number']) {
    assert.equal(recoveryMessage(reason, false, false).label, 'Switch connection needs attention');
  }
  assert.equal(recoveryMessage('Focus lost', false, false).label, 'Communication paused');
  assert.equal(recoveryMessage('Connected', true, false, 'needs-sync').label, 'Release switch to arm');
  assert.notEqual(recoveryMessage('Connected', false, false, 'armed').label, 'Switch ready');
  assert.equal(recoveryMessage('Focus lost', false, false).setup, false);
  assert.equal(recoveryMessage('Restoring switch', false, true).setup, false);
  assert.equal(recoveryMessage('Port lost', false, false).setup, true);
  assert.equal(recoveryMessage('Device reported fault', false, false).setup, true);
});
test('malformed-field diagnostics identify schema shape without echoing arbitrary data', () => {
  const errors: string[] = [];
  const session = new SerialSession('new', { now: () => 0, nonce: () => 'nonce', send: () => {}, input: () => assert.fail('malformed frame reached input'), cancelled: r => errors.push(r) });
  session.start();
  session.receive(new TextEncoder().encode('{"v":2,"type":"sync","epoch":"untrusted private value","sequence":0,"tick_ms":0,"pressed":false}\n'));
  assert.deepEqual(errors, ['Malformed field epoch: invalid string']);
  assert.ok(!errors.join().includes('private value'));
});
