// SPDX-License-Identifier: AGPL-3.0-or-later
/** Main-thread boundary: no camera, scanner, input or speech authority. */
export type GazePoint = { x: number; y: number };
export type GazeViewport = { width: number; height: number };
export type TrackerInitialization = { delegate: 'GPU' | 'CPU'; points: GazePoint[]; samplesPerPoint: number };
export type TrackerDiagnosticReason =
  | 'face-missing' | 'invalid-pose' | 'invalid-box' | 'blink' | 'head-moved'
  | 'frame-size-changed' | 'calibration-sample' | 'not-calibrated'
  | 'prediction-nonfinite' | 'prediction-outside-viewport' | 'prediction-error' | 'prediction-accepted';
export type TrackerDiagnostics = {
  reason: TrackerDiagnosticReason;
  predictionOutcome: 'not-attempted' | 'in-viewport' | 'outside-viewport' | 'nonfinite' | 'error';
  predictionAttempted: boolean;
  /** Diagnostic coordinates only. They never bypass the accepted-point gates. */
  rawPoint: GazePoint | null;
  rawRange: { minX: number; maxX: number; minY: number; maxY: number; samples: number } | null;
  faceDetected: boolean; poseValid: boolean; boxValid: boolean; blinking: boolean; headMoved: boolean;
  headMotion: 'rotation' | 'translation' | 'scale' | null;
  frame: GazeViewport; calibrationFrame: GazeViewport | null; calibrationViewport: GazeViewport | null;
  /** Successfully fitted source frames, distinct from the current collector length. */
  calibrationSamples: number; samplesPerPoint: number[];
  detectMs: number; predictMs: number; totalMs: number;
};
export type TrackerSample = {
  face: boolean; point: GazePoint | null; stored: number; inferenceMs: number; calibrated: boolean;
  headMoved: boolean; uncertain: boolean; requiresCalibration: boolean; diagnostics: TrackerDiagnostics;
};
export type TrackerCalibration = {
  samples: number; trainingMs: number; samplesPerPoint: number[]; frame: GazeViewport; viewport: GazeViewport;
  /** Reuses training frames; this measures fit, NOT independent prediction accuracy. */
  trainingSampleReprojection: { sampleCount: number; finiteCount: number; meanErrorPx: number | null; maxErrorPx: number | null };
};

/** Euler angles wrap at ±π. A boundary crossing must not become a full-turn movement. */
export function angularDistance(a: number, b: number): number {
  return Number.isFinite(a) && Number.isFinite(b) ? Math.abs(Math.atan2(Math.sin(a - b), Math.cos(a - b))) : Infinity;
}
export function circularMeanAngle(angles: readonly number[]): number | null {
  if (!angles.length || angles.some(angle => !Number.isFinite(angle))) return null;
  const sin = angles.reduce((sum, angle) => sum + Math.sin(angle), 0) / angles.length;
  const cos = angles.reduce((sum, angle) => sum + Math.cos(angle), 0) / angles.length;
  // A degenerate circular mean cannot provide a safe head-pose reference.
  return Math.hypot(sin, cos) > 1e-9 ? Math.atan2(sin, cos) : null;
}
export type TrackerRequest = { id: number } & (
  | { kind: 'initialize'; viewport: GazeViewport; assetBase: string }
  | { kind: 'sample'; image: ImageData; target?: GazePoint }
  | { kind: 'calibrate' | 'reset' }
);
export type TrackerResponse = { id: number; ok: true; value: unknown } | { id: number; ok: false; code: string };
export class GazeTrackerError extends Error {
  readonly code: string;
  constructor(code: string) { super(code); this.name = 'GazeTrackerError'; this.code = code; }
}

/** One request at a time. Termination keeps Stop responsive during synchronous training. */
export class RealEyeTrackerAdapter {
  private readonly worker: Worker;
  private serial = 0;
  private closed = false;
  private pending: { id: number; resolve: (value: unknown) => void; reject: (error: Error) => void; timer: ReturnType<typeof setTimeout> } | null = null;
  constructor(workerFactory: () => Worker = () => new Worker(new URL('/gaze/tracker.worker.js', window.location.origin), { name: 'SMV local gaze' })) {
    this.worker = workerFactory();
    this.worker.onmessage = (event: MessageEvent<TrackerResponse>) => {
      const result = event.data;
      if (!this.pending || !result || result.id !== this.pending.id) return;
      const pending = this.pending; this.pending = null; clearTimeout(pending.timer);
      if (result.ok) pending.resolve(result.value);
      else pending.reject(new GazeTrackerError(typeof result.code === 'string' ? result.code : 'GAZE_WORKER_FAILED'));
    };
    this.worker.onerror = () => this.stop('GAZE_WORKER_FAILED');
    this.worker.onmessageerror = () => this.stop('GAZE_WORKER_FAILED');
  }
  private request<T>(command: Omit<Extract<TrackerRequest, { kind: 'initialize' }>, 'id'> | Omit<Extract<TrackerRequest, { kind: 'sample' }>, 'id'> | { kind: 'calibrate' | 'reset' }, timeout: number, transfer: Transferable[] = []): Promise<T> {
    if (this.closed) return Promise.reject(new GazeTrackerError('GAZE_STOPPED'));
    if (this.pending) return Promise.reject(new GazeTrackerError('GAZE_BUSY'));
    const id = ++this.serial;
    return new Promise<T>((resolve, reject) => {
      this.pending = { id, resolve: value => resolve(value as T), reject, timer: setTimeout(() => this.stop('GAZE_TIMEOUT'), timeout) };
      try { this.worker.postMessage({ ...command, id }, transfer); }
      catch { this.stop('GAZE_WORKER_FAILED'); }
    });
  }
  initialize(viewport: GazeViewport): Promise<TrackerInitialization> {
    return this.request({ kind: 'initialize', viewport, assetBase: new URL('/gaze/', window.location.origin).href }, 35_000);
  }
  sample(image: ImageData, target?: GazePoint): Promise<TrackerSample> {
    // Ownership moves to the worker; callers must capture a fresh frame next time.
    return this.request({ kind: 'sample', image, ...(target ? { target } : {}) }, 3_000, [image.data.buffer]);
  }
  calibrate(): Promise<TrackerCalibration> { return this.request({ kind: 'calibrate' }, 60_000); }
  reset(): Promise<void> { return this.request({ kind: 'reset' }, 3_000); }
  private stop(code: string) {
    if (this.closed) return;
    this.closed = true; this.worker.terminate();
    if (this.pending) { const pending = this.pending; this.pending = null; clearTimeout(pending.timer); pending.reject(new GazeTrackerError(code)); }
  }
  dispose(): void { this.stop('GAZE_STOPPED'); }
}
