import test from 'node:test';
import assert from 'node:assert/strict';
import { createCameraSession, type CameraCleanup, type CameraState, type CameraTimer, type CameraTrack } from '../src/gaze/camera-session.mts';
function deferred<T>() {
  let resolve!: (value: T) => void, reject!: (error: unknown) => void;
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no; });
  return { promise, resolve, reject };
}
class Track implements CameraTrack {
  readyState = 'live'; stops = 0;
  events = new Map<string, Set<() => void>>();
  stop() { this.stops++; this.readyState = 'ended'; }
  addEventListener(type: string, listener: () => void) { const listeners = this.events.get(type) ?? new Set(); listeners.add(listener); this.events.set(type, listeners); }
  removeEventListener(type: string, listener: () => void) { this.events.get(type)?.delete(listener); }
  emit(type: string) { for (const listener of [...this.events.get(type) ?? []]) listener(); }
}
const stream = (...tracks: Track[]) => ({ getTracks: () => tracks });
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };
function fakeTimer() {
  let callback: (() => void) | null = null, delay = 0, clears = 0;
  const timer: CameraTimer = { set: (fn, ms) => { callback = fn; delay = ms; return 1; }, clear: () => { callback = null; clears++; } };
  return { timer, fire: () => { const fn = callback; callback = null; fn?.(); }, delay: () => delay, clears: () => clears };
}
test('camera stays off on construction and only explicit start initializes it', async () => {
  let requests = 0, initialized = 0, cleaned = 0; const track = new Track(), seen: CameraState[] = [];
  const session = createCameraSession({ getStream: async () => { requests++; return stream(track); },
    initialize: async (_, signal) => { initialized++; assert.equal(signal.aborted, false); return () => { cleaned++; }; }, onStateChange: next => seen.push(next) });
  assert.deepEqual(session.state(), { phase: 'off', error: null }); assert.equal(requests, 0); assert.equal(initialized, 0);
  await session.start(); assert.equal(requests, 1); assert.equal(initialized, 1); assert.equal(session.state().phase, 'ready');
  assert.deepEqual(seen.map(x => x.phase), ['starting', 'initializing', 'ready']);
  session.stop(); assert.equal(cleaned, 1); assert.equal(track.stops, 1);
});
test('repeated start shares the active acquisition and ready session', async () => {
  const permission = deferred<ReturnType<typeof stream>>(); const track = new Track(); let requests = 0;
  const session = createCameraSession({ getStream: () => { requests++; return permission.promise; }, initialize: async () => () => {} });
  const first = session.start(); assert.equal(session.start(), first); assert.equal(requests, 1);
  permission.resolve(stream(track)); await first; await session.start(); assert.equal(requests, 1); session.stop();
});
test('Stop is immediate during permission and a late stream is stopped without initialization', async () => {
  const permission = deferred<ReturnType<typeof stream>>(); const track = new Track(); let initialized = 0;
  const session = createCameraSession({ getStream: () => permission.promise, initialize: async () => { initialized++; return () => {}; } });
  const starting = session.start(); session.stop(); await starting;
  assert.deepEqual(session.state(), { phase: 'off', error: null });
  permission.resolve(stream(track)); await flush(); assert.equal(track.stops, 1); assert.equal(initialized, 0);
});
for (const [name, code] of [['NotAllowedError', 'permission_denied'], ['NotFoundError', 'not_found'], ['NotReadableError', 'in_use'], ['UnknownDriverError', 'camera_failed']] as const) {
  test('camera acquisition maps ' + name + ' without exposing raw messages', async () => {
    let initialized = false;
    const session = createCameraSession({ getStream: async () => { throw { name, message: 'private driver details' }; }, initialize: async () => { initialized = true; return () => {}; } });
    await session.start(); assert.deepEqual(session.state(), { phase: 'unavailable', error: code }); assert.equal(initialized, false);
    session.stop(); assert.equal(session.state().phase, 'off');
  });
}
test('initialization failure aborts and stops every camera track', async () => {
  const a = new Track(), b = new Track(); let captured: AbortSignal | undefined;
  const session = createCameraSession({ getStream: async () => stream(a, b), initialize: async (_, signal) => { captured = signal; throw Error('model failed'); } });
  await session.start(); assert.deepEqual(session.state(), { phase: 'unavailable', error: 'initialization_failed' });
  assert.equal(captured?.aborted, true); assert.equal(a.stops, 1); assert.equal(b.stops, 1);
});
test('bounded initialization timeout stops tracks and disposes late model completion', async () => {
  const clock = fakeTimer(), initializing = deferred<CameraCleanup>(), track = new Track(); let disposed = 0;
  const session = createCameraSession({ getStream: async () => stream(track), initialize: () => initializing.promise, timer: clock.timer, timeoutMs: 25 });
  const starting = session.start(); await flush(); assert.equal(clock.delay(), 25); clock.fire(); await starting;
  assert.deepEqual(session.state(), { phase: 'unavailable', error: 'initialization_timeout' }); assert.equal(track.stops, 1);
  initializing.resolve(() => { disposed++; }); await flush(); assert.equal(disposed, 1); assert.equal(session.state().phase, 'unavailable');
});
test('Stop during model initialization retires its eventual cleanup exactly once', async () => {
  const initializing = deferred<CameraCleanup>(), track = new Track(), clock = fakeTimer(); let disposed = 0, captured: AbortSignal | undefined;
  const session = createCameraSession({ getStream: async () => stream(track), initialize: (_, signal) => { captured = signal; return initializing.promise; }, timer: clock.timer });
  const starting = session.start(); await flush(); session.stop(); await starting;
  assert.equal(captured?.aborted, true); assert.equal(track.stops, 1); assert.equal(clock.clears(), 1);
  initializing.resolve(() => { disposed++; }); await flush(); session.stop(); assert.equal(disposed, 1); assert.equal(session.state().phase, 'off');
});
test('a restarted session ignores old permission results and old failures', async () => {
  const old = deferred<ReturnType<typeof stream>>(), oldTrack = new Track(), newTrack = new Track(); let count = 0;
  const session = createCameraSession({ getStream: () => ++count === 1 ? old.promise : Promise.resolve(stream(newTrack)), initialize: async () => () => {} });
  const first = session.start(); session.stop(); await first; await session.start();
  old.resolve(stream(oldTrack)); await flush(); assert.equal(oldTrack.stops, 1); assert.equal(newTrack.stops, 0); assert.equal(session.state().phase, 'ready');
  session.stop();
});
for (const kind of ['ended', 'mute'] as const) {
  test('stream ' + kind + ' interrupts tracking, cleans resources and removes listeners', async () => {
    const track = new Track(); let disposed = 0;
    const session = createCameraSession({ getStream: async () => stream(track), initialize: async () => () => { disposed++; } });
    await session.start(); track.emit(kind);
    assert.deepEqual(session.state(), { phase: 'unavailable', error: 'interrupted' }); assert.equal(track.stops, 1); assert.equal(disposed, 1);
    assert.ok([...track.events.values()].every(listeners => listeners.size === 0)); track.emit(kind); session.stop(); assert.equal(disposed, 1);
  });
}
test('an already ended or empty stream never initializes the tracker', async () => {
  for (const tracks of [[], [Object.assign(new Track(), { readyState: 'ended' })]]) {
    let initialized = 0;
    const session = createCameraSession({ getStream: async () => stream(...tracks), initialize: async () => { initialized++; return () => {}; } });
    await session.start(); assert.equal(initialized, 0); assert.equal(session.state().error, 'interrupted');
  }
});
test('Stop after readiness is idempotent and a failing disposer cannot keep the camera on', async () => {
  const track = new Track(); let disposals = 0;
  const session = createCameraSession({ getStream: async () => stream(track), initialize: async () => () => { disposals++; throw Error('dispose failed'); } });
  await session.start(); session.stop(); session.stop(); assert.equal(track.stops, 1); assert.equal(disposals, 1); assert.equal(session.state().phase, 'off');
});
test('a failed retired initializer cannot overwrite a new ready session', async () => {
  const firstInit = deferred<CameraCleanup>(), firstTrack = new Track(), secondTrack = new Track(); let count = 0;
  const session = createCameraSession({ getStream: async () => stream(++count === 1 ? firstTrack : secondTrack), initialize: () => count === 1 ? firstInit.promise : () => {} });
  const first = session.start(); await flush(); session.stop(); await first; await session.start();
  firstInit.reject(Error('late failure')); await flush(); assert.equal(session.state().phase, 'ready'); assert.equal(secondTrack.stops, 0); session.stop();
});
