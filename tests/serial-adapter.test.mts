import test from 'node:test';
import assert from 'node:assert/strict';
import { SerialSession, type Command, type InputMessage } from '../src/input/serial-protocol.mts';
import { requestSerialAdapter, type DataPort, type Environment } from '../src/input/web-serial-adapter.mts';
import { createSwitchState, reduceSwitch } from '../src/input/switch-machine.mts';

const bytes = (v: unknown) => new TextEncoder().encode(JSON.stringify(v) + '\n');
function fixture(pressed = false) {
  let time = 0;
  let nonce = 0;
  let state = createSwitchState({ id: 'test', revision: 1, targets: ['one', 'two', 'three'] }, 'session');
  state = reduceSwitch(state, { type: 'activity', active: true }).state;
  state = reduceSwitch(state, { type: 'connect' }).state;
  const epoch = state.epoch;
  const sent: Command[] = [];
  const inputs: InputMessage[] = [];
  const cancelled: string[] = [];
  const session = new SerialSession(epoch, {
    now: () => time, nonce: () => `nonce:${++nonce}`, send: c => { sent.push(c); },
    input: m => { inputs.push(m); state = reduceSwitch(state, m).state; },
    cancelled: r => { cancelled.push(r); state = reduceSwitch(state, { type: 'fault' }).state; },
  });
  const message = (type: string, sequence: number, extra = {}) =>
    ({ v: 2, type, epoch, sequence, tick_ms: time, ...extra });
  session.start();
  time = 10;
  session.receive(bytes(message('sync', 0, { pressed })));
  return { session, sent, inputs, cancelled, message,
    time: (n: number) => { time = n; }, state: () => state,
    heartbeat(sequence: number) {
      session.poll();
      const ping = sent.at(-1);
      assert.equal(ping?.type, 'ping');
      if (ping?.type === 'ping') session.receive(bytes(message('pong', sequence, { nonce: ping.nonce })));
    },
  };
}

test('session, heartbeat and a matched cycle cross the first approximately 65-second wrap', () => {
  let time = 0;
  const events: InputMessage[] = [];
  const cancelled: string[] = [];
  const commands: Command[] = [];
  const session = new SerialSession('wrap', { now: () => time, nonce: () => 'challenge',
    input: m => { events.push(m); }, send: c => { commands.push(c); }, cancelled: r => { cancelled.push(r); } });
  const tick = () => (2 ** 29 - 100 + time) % (2 ** 29);
  const receive = (type: string, sequence: number, extra = {}) => session.receive(bytes({ v: 2, type, epoch: 'wrap', sequence, tick_ms: tick(), ...extra }));
  session.start();
  time = 10; receive('sync', 0, { pressed: false });
  time = 90; receive('down', 1);
  time = 110; receive('up', 2, { downSequence: 1 });
  time = 210; session.poll(); receive('pong', 2, { nonce: 'challenge' });
  time = 220; receive('down', 3);
  time = 230; receive('up', 4, { downSequence: 3 });
  assert.deepEqual(events.map(m => m.type), ['sync', 'down', 'up', 'down', 'up']);
  assert.deepEqual(cancelled, []);
  assert.equal(commands.at(-1)?.type, 'ping');
});

test('a timely pong with invalid clock evidence cannot rejuvenate old input', () => {
  const f = fixture(); f.time(210); f.session.poll();
  const ping = f.sent.at(-1);
  if (ping?.type !== 'ping') throw Error('Missing ping');
  f.session.receive(bytes(f.message('pong', 0, { nonce: ping.nonce, tick_ms: 10 })));
  assert.match(f.cancelled[0], /Clock discontinuity/);
  assert.equal(f.inputs.length, 1);
});

test('fragmented wire reads produce ten complete cycles through the selection kernel', () => {
  const f = fixture();
  for (let i = 0; i < 10; i++) {
    f.time(20 + i * 2);
    const down = bytes(f.message('down', i * 2 + 1));
    for (const byte of down) f.session.receive(Uint8Array.of(byte));
    f.time(21 + i * 2);
    f.session.receive(bytes(f.message('up', i * 2 + 2, { downSequence: i * 2 + 1 })));
  }
  assert.equal(f.state().selections, 10);
  assert.equal(f.cancelled.length, 0);
});

test('sixty-second hold with valid heartbeat traffic creates no selections or releases', () => {
  const f = fixture();
  f.time(20); f.session.receive(bytes(f.message('down', 1)));
  for (let time = 210; time <= 60010; time += 200) { f.time(time); f.heartbeat(1); }
  assert.equal(f.state().selections, 0);
  assert.deepEqual(f.inputs.map(m => m.type), ['sync', 'down']);
  f.time(60020); f.session.receive(bytes(f.message('up', 2, { downSequence: 1 })));
  assert.equal(f.state().selections, 1);
  assert.equal(f.cancelled.length, 0);
});

test('reconnect held accepts release only as rearming, then a fresh cycle', () => {
  const f = fixture(true);
  f.time(20); f.session.receive(bytes(f.message('sync', 1, { pressed: false })));
  assert.equal(f.state().selections, 0);
  f.time(30); f.session.receive(bytes(f.message('down', 2)));
  f.time(40); f.session.receive(bytes(f.message('up', 3, { downSequence: 2 })));
  assert.equal(f.state().selections, 1);
});

test('buffered same-epoch DOWN/UP cannot become fresh on a later heartbeat', () => {
  const f = fixture();
  const old = [f.message('down', 1), f.message('up', 2, { downSequence: 1 })];
  f.time(210); f.heartbeat(0);
  f.time(310); f.session.poll();
  f.session.receive(new TextEncoder().encode(old.map(m => JSON.stringify(m)).join('\n') + '\n'));
  assert.equal(f.state().selections, 0);
  assert.match(f.cancelled[0], /Stale/);
});

test('heartbeat timeout, event-loop stall and backwards host clock cancel a held capture', () => {
  for (const scenario of ['timeout', 'stall', 'backwards']) {
    const f = fixture();
    f.time(20); f.session.receive(bytes(f.message('down', 1)));
    if (scenario === 'timeout') { f.time(210); f.session.poll(); f.time(311); }
    else f.time(scenario === 'stall' ? 400 : 19);
    f.session.poll();
    f.session.receive(bytes(f.message('up', 2, { downSequence: 1 })));
    assert.equal(f.state().selections, 0);
    assert.equal(f.state().capture, null);
    assert.equal(f.cancelled.length, 1);
  }
});

test('wrong nonce, replayed pong and wrong heartbeat sequence fail closed', () => {
  for (const wrong of ['nonce', 'sequence', 'replay']) {
    const f = fixture();
    f.time(210); f.session.poll();
    const ping = f.sent.at(-1);
    assert.equal(ping?.type, 'ping');
    if (ping?.type !== 'ping') throw Error('Missing ping');
    const pong = f.message('pong', wrong === 'sequence' ? 1 : 0, { nonce: wrong === 'nonce' ? 'old' : ping.nonce });
    f.session.receive(bytes(pong));
    if (wrong === 'replay') f.session.receive(bytes(pong));
    assert.equal(f.cancelled.length, 1);
    assert.equal(f.inputs.length, 1);
  }
});

test('strict framing, exact keys, version, epoch, sequence and pairing reject invalid input', () => {
  const changes = [
    { v: 1 }, { epoch: 'old-session' }, { sequence: 3 }, { sequence: 1.5 },
    { sequence: Number.MAX_SAFE_INTEGER + 1 }, { tick_ms: -1 }, { tick_ms: 2 ** 29 },
    { tick_ms: 500 }, { extra: true }, { type: 'up', downSequence: 0 }, { type: 'fault' },
  ];
  for (const extra of changes) {
    const f = fixture(); f.time(20);
    f.session.receive(bytes(f.message('down', 1, extra)));
    assert.equal(f.cancelled.length, 1, JSON.stringify(extra));
    assert.equal(f.state().selections, 0);
  }
  for (const raw of ['{}\n', 'not-json\n', '{"v":2,"v":2}\n', 'x'.repeat(512), '\r\n', 'é\n']) {
    const f = fixture(); f.session.receive(new TextEncoder().encode(raw));
    assert.equal(f.cancelled.length, 1, raw.slice(0, 20));
  }
  const f = fixture(); f.session.receive(new Uint8Array(8193));
  assert.equal(f.cancelled.length, 1);
});

test('duplicate DOWN and mismatched UP retire the capture without selecting', () => {
  for (const kind of ['down', 'up']) {
    const f = fixture(); f.time(20); f.session.receive(bytes(f.message('down', 1)));
    f.session.receive(bytes(f.message(kind, kind === 'down' ? 1 : 2, { ...(kind === 'up' ? { downSequence: 0 } : {}) })));
    assert.equal(f.state().selections, 0);
    assert.equal(f.cancelled.length, 1);
  }
});

test('an UP timestamp preceding the captured DOWN is rejected', () => {
  const f = fixture(); f.time(30); f.session.receive(bytes(f.message('down', 1)));
  f.time(40); f.session.receive(bytes(f.message('up', 2, { downSequence: 1, tick_ms: 20 })));
  assert.equal(f.state().selections, 0);
  assert.match(f.cancelled[0], /Reversed/);
});

const flush = async () => { for (let i = 0; i < 12; i++) await Promise.resolve(); };
async function fakeBrowser(verified = true, failWrite = false, picker?: {
  returned: (controls: { focus: () => void; blur: () => void; hide: () => void;
    advance: (ms: number) => void; window: EventTarget; calls: string[]; inputs: InputMessage[]; outputs: Uint8Array[] }) => Promise<void>;
}) {
  let time = 0;
  let active = true;
  let visible = true;
  let poll = () => {};
  const calls: string[] = [];
  const outputs: Uint8Array[] = [];
  const inputs: InputMessage[] = [];
  const cancelled: string[] = [];
  let controller!: ReadableStreamDefaultController<Uint8Array>;
  const port = new class extends EventTarget implements DataPort {
    getInfo() { return { usbVendorId: 0x239a, usbProductId: 0x80f4 }; }
    readable = new ReadableStream<Uint8Array>({ start: c => { controller = c; } });
    writable = new WritableStream<Uint8Array>({ write: async data => {
      // Model OS consumption in fragments; Web Streams resolves only on completion.
      for (let n = 0; n < data.length; n += 7) {
        outputs.push(data.slice(n, n + 7)); await Promise.resolve();
        if (failWrite && n === 7) throw Error('Driver failed after a partial transmission');
      }
    } });
    async open() { calls.push('open'); }
    async setSignals(s: { dataTerminalReady: boolean }) { calls.push(`DTR:${s.dataTerminalReady}`); }
    async close() { calls.push('close'); }
  }();
  const env: Environment = {
    window: new EventTarget(), document: new EventTarget(), now: () => time, nonce: () => 'fresh:uuid',
    visible: () => visible, active: () => active, every: cb => { poll = cb; return () => { poll = () => {}; }; }, settle: async () => {},
  };
  const adapter = await requestSerialAdapter({ requestPort: async () => {
    calls.push('requestPort');
    if (picker) await picker.returned({
      focus: () => { active = true; env.window.dispatchEvent(new Event('focus')); },
      blur: () => { active = false; env.window.dispatchEvent(new Event('blur')); },
      hide: () => { visible = false; env.document.dispatchEvent(new Event('visibilitychange')); },
      advance: ms => { time += ms; poll(); },
      window: env.window, calls, inputs, outputs,
    });
    return port;
  } },
    async () => { calls.push('verifyCDC2'); return verified; },
    { epoch: id => id, input: m => { inputs.push(m); }, cancelled: r => { cancelled.push(r); } }, env);
  await flush();
  return { adapter, env, port, calls, outputs, inputs, cancelled, controller,
    time: (n: number) => { time = n; }, inactive: () => { active = false; }, poll: () => poll() };
}

test('serial picker may resolve before focus returns: wait without opening, then synchronize while held', async () => {
  let restoreFocus!: () => void;
  let calls!: string[];
  let outputs!: Uint8Array[];
  let inputs!: InputMessage[];
  const connecting = fakeBrowser(true, false, { returned: async controls => {
    controls.blur();
    restoreFocus = controls.focus;
    ({ calls, outputs, inputs } = controls);
  } });
  // Native chooser promise resolves while document.hasFocus() is still false.
  await flush();
  assert.deepEqual(calls, ['requestPort', 'verifyCDC2']);
  assert.equal(outputs.length, 0);
  assert.equal(inputs.length, 0);
  restoreFocus();
  const f = await connecting;
  f.time(10);
  f.controller.enqueue(bytes({ v: 2, type: 'sync', epoch: 'fresh:uuid', sequence: 0, tick_ms: 10, pressed: true }));
  await flush();
  assert.equal(f.inputs.length, 1);
  assert.equal(f.inputs[0].type, 'sync');
  assert.equal(f.cancelled.length, 0);
  f.time(20);
  f.controller.enqueue(bytes({ v: 2, type: 'sync', epoch: 'fresh:uuid', sequence: 1, tick_ms: 20, pressed: false }));
  await flush();
  assert.deepEqual(f.inputs.map(m => m.type), ['sync', 'sync']);
  f.adapter.stop(); await f.adapter.closed;
});

test('abandoned picker focus wait expires or cancels without opening, and late focus cannot revive it', async () => {
  for (const cause of ['timeout', 'hidden', 'unload']) {
    let abandon!: () => void;
    let restoreFocus!: () => void;
    let calls!: string[];
    const connecting = fakeBrowser(true, false, { returned: async controls => {
      controls.blur();
      calls = controls.calls;
      restoreFocus = controls.focus;
      abandon = cause === 'timeout' ? () => controls.advance(3000)
        : cause === 'hidden' ? controls.hide : () => controls.window.dispatchEvent(new Event('pagehide'));
    } });
    const rejected = assert.rejects(connecting, /Focus did not return|Page hidden|Page unloaded/);
    await flush();
    abandon();
    await rejected;
    restoreFocus();
    await flush();
    assert.deepEqual(calls, ['requestPort', 'verifyCDC2'], cause);
  }
});

test('browser chooser precedes interface verification/open; DTR is asserted and full frame written once', async () => {
  const f = await fakeBrowser(); await flush();
  assert.deepEqual(f.calls.slice(0, 4), ['requestPort', 'verifyCDC2', 'open', 'DTR:true']);
  const written = new TextDecoder().decode(Buffer.concat(f.outputs));
  assert.deepEqual(JSON.parse(written), { v: 2, type: 'sync', epoch: 'fresh:uuid' });
  assert.equal(written.split('\n').length, 2);
  f.adapter.stop(); await f.adapter.closed;
  assert.equal(f.cancelled.length, 1);
  assert.deepEqual(f.calls.slice(-2), ['DTR:false', 'close']);
  await assert.rejects(fakeBrowser(false), /not verified/);
});

test('browser focus, visibility, unload and port loss immediately cancel without forwarding a release', async () => {
  for (const cause of ['blur', 'visibilitychange', 'pagehide', 'disconnect']) {
    const f = await fakeBrowser();
    f.time(10);
    f.controller.enqueue(bytes({ v: 2, type: 'sync', epoch: 'fresh:uuid', sequence: 0, tick_ms: 10, pressed: false }));
    await flush();
    f.time(20);
    f.controller.enqueue(bytes({ v: 2, type: 'down', epoch: 'fresh:uuid', sequence: 1, tick_ms: 20 }));
    await flush();
    if (cause === 'visibilitychange') f.inactive();
    (cause === 'disconnect' ? f.port : cause === 'visibilitychange' ? f.env.document : f.env.window).dispatchEvent(new Event(cause));
    assert.equal(f.cancelled.length, 1);
    assert.deepEqual(f.inputs.map(m => m.type), ['sync', 'down']);
    await f.adapter.closed;
  }
});

test('a partial write failure closes the session without retrying the command', async () => {
  const f = await fakeBrowser(true, true); await flush();
  await f.adapter.closed;
  assert.deepEqual(f.cancelled, ['Write failed']);
  assert.equal(Buffer.concat(f.outputs).length, 14);
  assert.equal(new TextDecoder().decode(Buffer.concat(f.outputs)).includes('\n'), false);
  assert.equal(f.inputs.length, 0);
});

test('a delayed browser read is rejected before it can complete a held cycle', async () => {
  const f = await fakeBrowser();
  f.time(10); f.controller.enqueue(bytes({ v: 2, type: 'sync', epoch: 'fresh:uuid', sequence: 0, tick_ms: 10, pressed: false }));
  await flush();
  f.time(20); f.controller.enqueue(bytes({ v: 2, type: 'down', epoch: 'fresh:uuid', sequence: 1, tick_ms: 20 }));
  await flush();
  f.time(400); f.controller.enqueue(bytes({ v: 2, type: 'up', epoch: 'fresh:uuid', sequence: 2, downSequence: 1, tick_ms: 30 }));
  await flush();
  assert.deepEqual(f.inputs.map(m => m.type), ['sync', 'down']);
  assert.equal(f.cancelled.length, 1);
  await f.adapter.closed;
});
