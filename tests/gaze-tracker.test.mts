// SPDX-License-Identifier: AGPL-3.0-or-later
import test, { type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { runInNewContext } from 'node:vm';
import { angularDistance, circularMeanAngle, RealEyeTrackerAdapter, type TrackerCalibration, type TrackerInitialization, type TrackerRequest, type TrackerResponse, type TrackerSample } from '../src/gaze/tracker-adapter.ts';

/** Fake transport only. These tests establish cancellation/ownership, not camera accuracy. */
class FakeWorker {
  messages: TrackerRequest[] = [];
  terminated = 0;
  failPost = false;
  onmessage: ((event: MessageEvent<TrackerResponse>) => void) | null = null;
  onerror: ((event?: unknown) => void) | null = null;
  onmessageerror: ((event?: unknown) => void) | null = null;
  postMessage(value: TrackerRequest, transfer: Transferable[] = []) {
    if (this.failPost) throw new Error('Private transport details must not be exposed');
    // Structured-clone transfer actually detaches the caller's ArrayBuffer in Node.
    this.messages.push(structuredClone(value, { transfer: transfer as ArrayBuffer[] }));
  }
  terminate() { this.terminated++; }
  answer(value: unknown, id = this.messages.at(-1)!.id) { this.onmessage?.({ data: { id, ok: true, value } } as MessageEvent<TrackerResponse>); }
  fail(code: string) { this.onmessage?.({ data: { id: this.messages.at(-1)!.id, ok: false, code } } as MessageEvent<TrackerResponse>); }
}
function environment(t: TestContext) {
  const previousWindow = Object.getOwnPropertyDescriptor(globalThis, 'window');
  const previousNavigator = Object.getOwnPropertyDescriptor(globalThis, 'navigator');
  let cameraRequests = 0;
  Object.defineProperty(globalThis, 'window', { configurable: true, value: { location: { origin: 'http://127.0.0.1:5173' } } });
  Object.defineProperty(globalThis, 'navigator', { configurable: true, value: { mediaDevices: { getUserMedia: () => { cameraRequests++; throw new Error('No camera in transport tests'); } } } });
  t.after(() => {
    if (previousWindow) Object.defineProperty(globalThis, 'window', previousWindow); else Reflect.deleteProperty(globalThis, 'window');
    if (previousNavigator) Object.defineProperty(globalThis, 'navigator', previousNavigator); else Reflect.deleteProperty(globalThis, 'navigator');
  });
  return { cameraRequests: () => cameraRequests };
}
const viewport = { width: 1440, height: 900 };
const initialized = { delegate: 'CPU', points: [{ x: 72, y: 45 }], samplesPerPoint: 5 };
const frame = () => ({ data: new Uint8ClampedArray(16).fill(127), width: 2, height: 2, colorSpace: 'srgb' }) as ImageData;
const fixture = () => {
  const worker = new FakeWorker();
  const adapter = new RealEyeTrackerAdapter(() => worker as unknown as Worker);
  return { worker, adapter };
};
async function ready(adapter: RealEyeTrackerAdapter, worker: FakeWorker) {
  const result = adapter.initialize(viewport); worker.answer(initialized); await result;
}

test('tracker construction requests neither camera nor model initialization; explicit initialize uses local assets', async t => {
  const env = environment(t); const { worker, adapter } = fixture(); t.after(() => adapter.dispose());
  assert.equal(worker.messages.length, 0); assert.equal(env.cameraRequests(), 0);
  const start = adapter.initialize(viewport);
  assert.equal(worker.messages.length, 1);
  const request = worker.messages[0]; assert.equal(request.kind, 'initialize');
  if (request.kind !== 'initialize') assert.fail('Expected initialization');
  assert.deepEqual(request.viewport, viewport); assert.equal(request.assetBase, 'http://127.0.0.1:5173/gaze/');
  worker.answer(initialized); assert.deepEqual(await start, initialized); assert.equal(env.cameraRequests(), 0);
});

test('a second inference or calibration request cannot overlap or queue behind initialization', async t => {
  environment(t); const { worker, adapter } = fixture(); t.after(() => adapter.dispose());
  const start = adapter.initialize(viewport);
  await assert.rejects(adapter.sample(frame()), { code: 'GAZE_BUSY' });
  await assert.rejects(adapter.calibrate(), { code: 'GAZE_BUSY' });
  assert.equal(worker.messages.length, 1);
  worker.answer(initialized); await start;
  const reset = adapter.reset(); worker.answer(undefined); await reset;
  assert.equal(worker.messages.length, 2);
});

test('obsolete replies cannot resolve a newer calibration reset', async t => {
  environment(t); const { worker, adapter } = fixture(); t.after(() => adapter.dispose());
  await ready(adapter, worker); const oldId = worker.messages[0].id;
  let settled = false;
  const reset = adapter.reset().then(() => { settled = true; });
  worker.answer(initialized, oldId); await Promise.resolve(); assert.equal(settled, false);
  worker.answer(undefined); await reset; assert.equal(settled, true);
});

test('camera pixel buffers transfer ownership and target coordinates without becoming other commands', async t => {
  environment(t); const { worker, adapter } = fixture(); t.after(() => adapter.dispose());
  await ready(adapter, worker);
  const image = frame(), target = { x: 72, y: 45 };
  const request = adapter.sample(image, target);
  assert.equal(image.data.byteLength, 0);
  const sent = worker.messages.at(-1)!; assert.equal(sent.kind, 'sample');
  if (sent.kind !== 'sample') assert.fail('Expected sample');
  assert.equal(sent.image.width, 2); assert.equal(sent.image.height, 2);
  assert.deepEqual([...sent.image.data], Array(16).fill(127)); assert.deepEqual(sent.target, target);
  const noFace = { face: false, point: null, stored: 0, inferenceMs: 3, calibrated: false, headMoved: false, uncertain: true };
  worker.answer(noFace); assert.deepEqual(await request, noFace);
  assert.deepEqual(worker.messages.map(message => message.kind), ['initialize', 'sample']);
});

for (const operation of ['initialize', 'calibrate'] as const) {
  test('Stop during ' + operation + ' immediately terminates the worker and rejects late results', async t => {
    environment(t); const { worker, adapter } = fixture();
    if (operation === 'calibrate') await ready(adapter, worker);
    const pending = operation === 'initialize' ? adapter.initialize(viewport) : adapter.calibrate();
    const rejected = assert.rejects(pending, { code: 'GAZE_STOPPED' });
    adapter.dispose(); adapter.dispose(); assert.equal(worker.terminated, 1); await rejected;
    worker.answer(initialized);
    const count = worker.messages.length;
    await assert.rejects(adapter.initialize(viewport), { code: 'GAZE_STOPPED' });
    await assert.rejects(adapter.reset(), { code: 'GAZE_STOPPED' });
    assert.equal(worker.messages.length, count);
  });
}

for (const failure of ['error', 'messageerror', 'postMessage'] as const) {
  test('worker ' + failure + ' failure terminates resources with a content-free error', async t => {
    environment(t); const { worker, adapter } = fixture();
    worker.failPost = failure === 'postMessage';
    const pending = adapter.initialize(viewport);
    if (failure === 'error') worker.onerror?.({ message: 'private runtime text' });
    if (failure === 'messageerror') worker.onmessageerror?.({ data: 'private frame text' });
    await assert.rejects(pending, { code: 'GAZE_WORKER_FAILED', message: 'GAZE_WORKER_FAILED' });
    assert.equal(worker.terminated, 1);
  });
}

for (const operation of ['initialize', 'sample', 'calibrate'] as const) {
  test('unresponsive ' + operation + ' is bounded and terminates the worker', async t => {
    environment(t); t.mock.timers.enable({ apis: ['setTimeout'] });
    const { worker, adapter } = fixture();
    if (operation !== 'initialize') await ready(adapter, worker);
    const pending = operation === 'initialize' ? adapter.initialize(viewport) : operation === 'sample' ? adapter.sample(frame()) : adapter.calibrate();
    const rejected = assert.rejects(pending, { code: 'GAZE_TIMEOUT' });
    t.mock.timers.tick(120_000); await rejected; assert.equal(worker.terminated, 1);
    await assert.rejects(adapter.reset(), { code: 'GAZE_STOPPED' });
  });
}

test('a model initialization rejection reaches the owner lifecycle as a typed failure', async t => {
  environment(t); const { worker, adapter } = fixture(); t.after(() => adapter.dispose());
  const pending = adapter.initialize(viewport); worker.fail('GAZE_INITIALIZATION_FAILED');
  await assert.rejects(pending, { code: 'GAZE_INITIALIZATION_FAILED' });
  // Camera lifecycle owns stream cleanup; this adapter has no stream or selection API.
  assert.deepEqual(worker.messages.map(message => message.kind), ['initialize']);
});


test('head-pose circular math preserves a small movement across the ±π boundary', () => {
  const a = Math.PI - 0.04, b = -Math.PI + 0.04;
  assert.ok(Math.abs(angularDistance(a, b) - 0.08) < 1e-12);
  const reference = circularMeanAngle([a, b]);
  assert.notEqual(reference, null);
  assert.ok(angularDistance(reference!, Math.PI) < 1e-12);
  assert.ok(angularDistance(reference!, a) < 0.15);
  assert.ok(angularDistance(reference!, Math.PI - 0.2) > 0.15);
  assert.equal(circularMeanAngle([]), null);
  assert.equal(circularMeanAngle([0, Math.PI]), null);
  assert.equal(circularMeanAngle([NaN]), null);
  assert.equal(angularDistance(Infinity, 0), Infinity);
});

/** Execute the actual worker boundary with a deterministic tracker, never a webcam/model.
 * The only imports are injected below; no application worker bundle is rebuilt by tests. */
function workerFixture() {
  class TestImageData {
    readonly data: Uint8ClampedArray;
    readonly width: number; readonly height: number;
    constructor(width = 2, height = 2) { this.width = width; this.height = height; this.data = new Uint8ClampedArray(width * height * 4); }
  }
  const state = {
    calibrated: false, face: true, blink: false, prediction: { x: 200, y: 100 },
    pose: { yaw: 0, pitch: 0, roll: Math.PI - 0.04 }, predictCalls: 0, predictionThrows: false,
  };
  class TestTracker {
    async initialize() {}
    isReady() { return true; }
    isCalibrated() { return state.calibrated; }
    detectFace(image: TestImageData) {
      return state.face ? {
        headPose: { ...state.pose }, boundingBox: { x: image.width / 4, y: image.height / 4, width: image.width / 2, height: image.height / 2 },
        blendshapes: { eyeBlinkLeft: state.blink ? 1 : 0, eyeBlinkRight: 0 },
      } : null;
    }
    predictWithDetection() {
      state.predictCalls++;
      if (state.predictionThrows) throw new Error('Private prediction failure');
      return { ...state.prediction };
    }
    predict() { return this.predictWithDetection(); }
    calibrate(samples: unknown[]) { assert.equal(samples.length, 85); state.calibrated = true; }
    getLastTrainingTimeMs() { return 12; }
    reset() { state.calibrated = false; }
    dispose() { state.calibrated = false; }
  }
  const replies: TrackerResponse[] = [];
  const context = {
    WebcamETLight: TestTracker, ImageData: TestImageData, URL, performance,
    angularDistance, circularMeanAngle, RECOMMENDED_SAMPLES_PER_POINT: 5,
    getRecommendedPattern: () => 'synthetic-grid',
    getCalibrationPointsInPixels: () => Array.from({ length: 17 }, (_, i) => ({ x: 20 + i * 20, y: 40 })),
    self: { location: { origin: 'http://127.0.0.1:5173' } },
    console: { log() {}, info() {}, debug() {}, warn() {}, error() {} },
    postMessage: (value: TrackerResponse) => replies.push(structuredClone(value)),
    onmessage: null as ((event: { data: unknown }) => Promise<void>) | null,
  };
  const source = readFileSync(new URL('../src/gaze/tracker.worker.ts', import.meta.url), 'utf8');
  runInNewContext(stripTypeScriptTypes(source.replace(/^import .*;$/gm, ''), { mode: 'strip' }), context);
  let id = 0;
  async function request<T>(command: object): Promise<T> {
    await context.onmessage!({ data: { ...command, id: ++id } });
    const response = replies.at(-1)!;
    assert.equal(response.id, id);
    if (!response.ok) throw new Error(response.code);
    return response.value as T;
  }
  const sample = (width = 2, height = 2) => request<TrackerSample>({ kind: 'sample', image: new TestImageData(width, height) });
  async function calibrate() {
    const init = await request<TrackerInitialization>({ kind: 'initialize', viewport, assetBase: 'http://127.0.0.1:5173/gaze/' });
    for (const target of init.points) {
      for (let i = 0; i < 5; i++) {
        // A real Euler representation can cross ±π while the physical head stays still.
        state.pose.roll = i % 2 ? -Math.PI + 0.04 : Math.PI - 0.04;
        const result = await request<TrackerSample>({ kind: 'sample', image: new TestImageData(), target });
        assert.equal(result.diagnostics.reason, 'calibration-sample');
        assert.equal(result.diagnostics.calibrationSamples, 0);
      }
    }
    return request<TrackerCalibration>({ kind: 'calibrate' });
  }
  return { state, sample, calibrate, request };
}

test('worker retains numeric training provenance after releasing frames and handles wrapped roll', async () => {
  const worker = workerFixture(); const fit = await worker.calibrate();
  assert.equal(fit.samples, 85); assert.deepEqual(fit.samplesPerPoint, Array(17).fill(5));
  assert.deepEqual(fit.frame, { width: 2, height: 2 }); assert.deepEqual(fit.viewport, viewport);
  assert.equal(fit.trainingSampleReprojection.sampleCount, 17); assert.equal(fit.trainingSampleReprojection.finiteCount, 17);
  worker.state.pose.roll = -Math.PI + 0.04;
  const result = await worker.sample();
  assert.equal(result.stored, 0); assert.equal(result.diagnostics.calibrationSamples, 85);
  assert.equal(result.headMoved, false); assert.deepEqual(result.point, worker.state.prediction);
  assert.equal(result.diagnostics.reason, 'prediction-accepted');
  assert.equal(result.diagnostics.rawRange?.samples, 1);
  assert.ok(result.diagnostics.totalMs >= result.diagnostics.detectMs);
  // More than 0.15 rad of roll still suspends the accepted prediction.
  worker.state.pose.roll = Math.PI - 0.3;
  const moved = await worker.sample();
  assert.equal(moved.point, null); assert.equal(moved.headMoved, true);
  assert.equal(moved.diagnostics.headMotion, 'rotation'); assert.equal(moved.diagnostics.reason, 'head-moved');
  assert.deepEqual(moved.diagnostics.rawPoint, worker.state.prediction);
  assert.equal(moved.diagnostics.predictionOutcome, 'in-viewport');
});

test('worker separates face absence, blink, out-of-viewport and invalid predictions without allowing them', async () => {
  const worker = workerFixture(); await worker.calibrate();
  worker.state.face = false;
  let result = await worker.sample();
  assert.equal(result.face, false); assert.equal(result.point, null); assert.equal(result.diagnostics.reason, 'face-missing');
  assert.equal(result.diagnostics.predictionAttempted, false);
  worker.state.face = true; worker.state.blink = true;
  result = await worker.sample();
  assert.equal(result.face, true); assert.equal(result.point, null); assert.equal(result.diagnostics.reason, 'blink');
  assert.equal(result.diagnostics.predictionOutcome, 'in-viewport');
  worker.state.blink = false; worker.state.prediction = { x: viewport.width, y: 100 };
  result = await worker.sample();
  assert.equal(result.face, true); assert.equal(result.point, null); assert.equal(result.diagnostics.reason, 'prediction-outside-viewport');
  assert.equal(result.diagnostics.rawRange?.maxX, viewport.width);
  worker.state.prediction = { x: NaN, y: 100 };
  result = await worker.sample();
  assert.equal(result.point, null); assert.equal(result.diagnostics.rawPoint, null); assert.equal(result.diagnostics.reason, 'prediction-nonfinite');
  worker.state.predictionThrows = true;
  result = await worker.sample();
  assert.equal(result.point, null); assert.equal(result.diagnostics.reason, 'prediction-error');
  assert.equal(JSON.stringify(result).includes('Private'), false);
});

test('camera frame geometry changes invalidate calibration and cannot resume without reset', async () => {
  const worker = workerFixture(); await worker.calibrate();
  const changed = await worker.sample(4, 2);
  assert.equal(changed.requiresCalibration, true); assert.equal(changed.calibrated, false); assert.equal(changed.point, null);
  assert.equal(changed.diagnostics.reason, 'frame-size-changed'); assert.equal(changed.diagnostics.calibrationSamples, 85);
  assert.deepEqual(changed.diagnostics.calibrationFrame, { width: 2, height: 2 });
  assert.deepEqual(changed.diagnostics.frame, { width: 4, height: 2 });
  assert.equal((await worker.sample()).requiresCalibration, true);
  await worker.request({ kind: 'reset' });
  const reset = await worker.sample();
  assert.equal(reset.requiresCalibration, false); assert.equal(reset.diagnostics.calibrationSamples, 0);
  assert.equal(reset.diagnostics.rawRange, null); assert.deepEqual(reset.diagnostics.samplesPerPoint, Array(17).fill(0));
  assert.equal(reset.diagnostics.reason, 'not-calibrated');
});
