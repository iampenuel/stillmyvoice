// SPDX-License-Identifier: AGPL-3.0-or-later
import { WebcamETLight, getRecommendedPattern, getCalibrationPointsInPixels, RECOMMENDED_SAMPLES_PER_POINT, type CalibrationSample } from '@realeye-io/webcam-eyetracker-light-open';
import { angularDistance, circularMeanAngle, type GazePoint, type GazeViewport, type TrackerCalibration, type TrackerDiagnostics, type TrackerRequest, type TrackerResponse, type TrackerSample } from './tracker-adapter';

// The library logs face-derived head-pose values during calibration. Suppress logs
// only in this dedicated worker; nothing from frames or landmarks is retained in logs.
for (const method of ['log', 'info', 'debug', 'warn', 'error'] as const) console[method] = () => {};
const scope = globalThis as unknown as { onmessage: ((event: MessageEvent<TrackerRequest>) => void) | null; postMessage(value: TrackerResponse): void };
const MAX_FRAMES = 85;
const MAX_FRAME_PIXELS = 1280 * 960;
// Experimental conservative gates, not calibrated accuracy/confidence measures.
const HEAD_POSE_DELTA = 0.15;
const FACE_CENTER_DELTA = 0.08;
const FACE_SIZE_DELTA = 0.20;
type Pose = { yaw: number; pitch: number; roll: number };
type FaceBox = { x: number; y: number; width: number; height: number };
let tracker: WebcamETLight | null = null;
let viewport: GazeViewport | null = null;
let points: GazePoint[] = [];
let frames: CalibrationSample[] = [];
let poses: Pose[] = [];
let boxes: FaceBox[] = [];
let reference: { pose: Pose; box: FaceBox } | null = null;
let calibrationFrame: GazeViewport | null = null;
let trainedSampleCount = 0;
let sampleCounts: number[] = [];
let requiresCalibration = false;
let rawRange: TrackerDiagnostics['rawRange'] = null;
let busy = false;
const finitePoint = (v: GazePoint | undefined): v is GazePoint => !!v && Number.isFinite(v.x) && Number.isFinite(v.y);
function fail(code: string): never { throw new Error(code); }
function clearCalibration() {
  frames = []; poses = []; boxes = []; reference = null; calibrationFrame = null;
  trainedSampleCount = 0; sampleCounts = points.map(() => 0); requiresCalibration = false; rawRange = null;
  tracker?.reset();
}
function dispose() { clearCalibration(); tracker?.dispose(); tracker = null; viewport = null; points = []; sampleCounts = []; }
function poseOf(detection: ReturnType<WebcamETLight['detectFace']>): Pose | null {
  if (!detection || !('headPose' in detection) || !detection.headPose) return null;
  const pose = detection.headPose;
  return Number.isFinite(pose.yaw) && Number.isFinite(pose.pitch) && Number.isFinite(pose.roll) ? { yaw: pose.yaw, pitch: pose.pitch, roll: pose.roll } : null;
}
async function initialize(view: GazeViewport, assetBase: string) {
  dispose();
  if (!view || !Number.isFinite(view.width) || !Number.isFinite(view.height) || view.width < 1 || view.height < 1 || view.width > 16000 || view.height > 16000) fail('GAZE_BAD_VIEWPORT');
  const base = new URL(assetBase);
  if (base.origin !== self.location.origin || base.pathname !== '/gaze/') fail('GAZE_BAD_ASSET_ORIGIN');
  viewport = { ...view };
  points = getCalibrationPointsInPixels(getRecommendedPattern(), view.width, view.height);
  sampleCounts = points.map(() => 0);
  for (const delegate of ['GPU', 'CPU'] as const) {
    const candidate = new WebcamETLight({ delegate, faceDetectorMode: 'landmarker', runningMode: 'IMAGE', modelPath: new URL('face_landmarker.task', base).href, wasmPath: new URL('wasm', base).href });
    try {
      await candidate.initialize();
      if (!candidate.isReady()) throw new Error('not ready');
      tracker = candidate;
      return { delegate, points, samplesPerPoint: RECOMMENDED_SAMPLES_PER_POINT };
    } catch { candidate.dispose(); }
  }
  dispose(); fail('GAZE_INITIALIZATION_FAILED');
}
function sample(image: ImageData, target?: GazePoint): TrackerSample {
  if (!tracker?.isReady() || !viewport) fail('GAZE_NOT_READY');
  if (!(image instanceof ImageData) || image.width < 1 || image.height < 1 || image.width * image.height > MAX_FRAME_PIXELS) fail('GAZE_BAD_FRAME');
  const started = performance.now();
  if (calibrationFrame && (image.width !== calibrationFrame.width || image.height !== calibrationFrame.height)) {
    // Camera geometry changes invalidate the model even if the CSS viewport is unchanged.
    // Keep only numeric provenance for diagnosis; discard every retained source frame.
    requiresCalibration = true; tracker.reset(); frames = []; poses = []; boxes = []; reference = null;
  }
  const detection = tracker.detectFace(image);
  const detectMs = Math.max(0, performance.now() - started);
  const calibrated = tracker.isCalibrated() && !requiresCalibration;
  let point: GazePoint | null = null;
  const pose = poseOf(detection);
  const rawBox = detection?.boundingBox;
  const box = rawBox ? { x: (rawBox.x + rawBox.width / 2) / image.width, y: (rawBox.y + rawBox.height / 2) / image.height, width: rawBox.width / image.width, height: rawBox.height / image.height } : null;
  const validBox = !!box && Object.values(box).every(Number.isFinite) && box.width > 0 && box.height > 0;
  const blendshapes = detection && 'blendshapes' in detection ? detection.blendshapes : undefined;
  const blinking = !!blendshapes && (blendshapes.eyeBlinkLeft > 0.5 || blendshapes.eyeBlinkRight > 0.5);
  const validFace = !!detection && !!pose && validBox && !blinking;
  let headMotion: TrackerDiagnostics['headMotion'] = null;
  if (pose && validBox && box && reference) {
    if (angularDistance(pose.yaw, reference.pose.yaw) > HEAD_POSE_DELTA || angularDistance(pose.pitch, reference.pose.pitch) > HEAD_POSE_DELTA || angularDistance(pose.roll, reference.pose.roll) > HEAD_POSE_DELTA) headMotion = 'rotation';
    else if (Math.abs(box.x - reference.box.x) > FACE_CENTER_DELTA || Math.abs(box.y - reference.box.y) > FACE_CENTER_DELTA) headMotion = 'translation';
    else if (Math.abs(box.width / reference.box.width - 1) > FACE_SIZE_DELTA || Math.abs(box.height / reference.box.height - 1) > FACE_SIZE_DELTA) headMotion = 'scale';
  }
  const headMoved = headMotion !== null;
  let predictionOutcome: TrackerDiagnostics['predictionOutcome'] = 'not-attempted';
  let rawPoint: GazePoint | null = null;
  let predictMs = 0;
  if (target && !requiresCalibration) {
    const targetIndex = points.findIndex(p => p.x === target.x && p.y === target.y);
    if (calibrated || !finitePoint(target) || targetIndex < 0) fail('GAZE_BAD_CALIBRATION_TARGET');
    if (frames.length >= MAX_FRAMES || sampleCounts[targetIndex] >= RECOMMENDED_SAMPLES_PER_POINT) fail('GAZE_CALIBRATION_FULL');
    if (validFace && pose && box) {
      calibrationFrame ??= { width: image.width, height: image.height };
      frames.push({ image, gazeX: target.x, gazeY: target.y }); poses.push(pose); boxes.push(box); sampleCounts[targetIndex]++;
    }
  } else if (calibrated && detection && pose && validBox) {
    // Observe the raw numeric result even when a blink or head gate rejects it.
    // Only `point` below can reach stabilization; diagnostics have no selection authority.
    const predictStarted = performance.now();
    try {
      const prediction = tracker.predictWithDetection(image, detection);
      if (!finitePoint(prediction)) predictionOutcome = 'nonfinite';
      else {
        rawPoint = { x: prediction.x, y: prediction.y };
        rawRange = rawRange ? {
          minX: Math.min(rawRange.minX, prediction.x), maxX: Math.max(rawRange.maxX, prediction.x),
          minY: Math.min(rawRange.minY, prediction.y), maxY: Math.max(rawRange.maxY, prediction.y), samples: rawRange.samples + 1,
        } : { minX: prediction.x, maxX: prediction.x, minY: prediction.y, maxY: prediction.y, samples: 1 };
        predictionOutcome = prediction.x >= 0 && prediction.y >= 0 && prediction.x < viewport.width && prediction.y < viewport.height ? 'in-viewport' : 'outside-viewport';
        if (validFace && !headMoved && predictionOutcome === 'in-viewport') point = rawPoint;
      }
    } catch { predictionOutcome = 'error'; }
    predictMs = Math.max(0, performance.now() - predictStarted);
  }
  const reason: TrackerDiagnostics['reason'] = requiresCalibration ? 'frame-size-changed'
    : !detection ? 'face-missing' : !pose ? 'invalid-pose' : !validBox ? 'invalid-box'
    : blinking ? 'blink' : headMoved ? 'head-moved' : target ? 'calibration-sample'
    : !calibrated ? 'not-calibrated' : predictionOutcome === 'error' ? 'prediction-error'
    : predictionOutcome === 'nonfinite' ? 'prediction-nonfinite'
    : predictionOutcome === 'outside-viewport' ? 'prediction-outside-viewport' : 'prediction-accepted';
  const inferenceMs = Math.max(0, performance.now() - started);
  return {
    face: !!detection, point, stored: frames.length, inferenceMs, calibrated, headMoved,
    uncertain: requiresCalibration || !validFace || headMoved || (calibrated && !point), requiresCalibration,
    diagnostics: {
      reason, predictionOutcome, predictionAttempted: predictionOutcome !== 'not-attempted', rawPoint, rawRange,
      faceDetected: !!detection, poseValid: !!pose, boxValid: validBox, blinking, headMoved, headMotion,
      frame: { width: image.width, height: image.height }, calibrationFrame,
      calibrationViewport: calibrationFrame ? { ...viewport } : null,
      calibrationSamples: trainedSampleCount, samplesPerPoint: [...sampleCounts], detectMs, predictMs, totalMs: inferenceMs,
    },
  };
}
function calibrate(): TrackerCalibration {
  if (!tracker?.isReady() || !viewport) fail('GAZE_NOT_READY');
  if (requiresCalibration || !calibrationFrame || frames.length !== MAX_FRAMES || sampleCounts.some(count => count !== RECOMMENDED_SAMPLES_PER_POINT)) fail('GAZE_CALIBRATION_INCOMPLETE');
  const sampleCount = frames.length;
  const mean = <T extends object>(rows: T[], key: keyof T) => rows.reduce((sum, row) => sum + Number(row[key]), 0) / rows.length;
  const yaw = circularMeanAngle(poses.map(pose => pose.yaw));
  const pitch = circularMeanAngle(poses.map(pose => pose.pitch));
  const roll = circularMeanAngle(poses.map(pose => pose.roll));
  try {
    if (yaw === null || pitch === null || roll === null) fail('GAZE_CALIBRATION_FAILED');
    const nextReference = { pose: { yaw, pitch, roll }, box: { x: mean(boxes, 'x'), y: mean(boxes, 'y'), width: mean(boxes, 'width'), height: mean(boxes, 'height') } };
    tracker.calibrate(frames);
    if (!tracker.isCalibrated()) fail('GAZE_CALIBRATION_FAILED');
    reference = nextReference; trainedSampleCount = sampleCount;
    // These are training-frame reprojections only, not a held-out accuracy score.
    // Existing frames are released in finally; no image/landmark data leaves the worker.
    const errors: number[] = [];
    for (const target of points) {
      const source = frames.find(frame => frame.gazeX === target.x && frame.gazeY === target.y)!;
      try {
        const prediction = tracker.predict(source.image);
        if (prediction && finitePoint(prediction)) {
          const error = Math.hypot(prediction.x - target.x, prediction.y - target.y);
          if (Number.isFinite(error)) errors.push(error);
        }
      } catch { /* Count unusable reprojections without exposing library error contents. */ }
    }
    return {
      samples: sampleCount, trainingMs: tracker.getLastTrainingTimeMs(), samplesPerPoint: [...sampleCounts],
      frame: { ...calibrationFrame }, viewport: { ...viewport },
      trainingSampleReprojection: { sampleCount: points.length, finiteCount: errors.length, meanErrorPx: errors.length ? errors.reduce((sum, error) => sum + error, 0) / errors.length : null, maxErrorPx: errors.length ? Math.max(...errors) : null },
    };
  } catch { tracker.reset(); reference = null; trainedSampleCount = 0; fail('GAZE_CALIBRATION_FAILED'); }
  finally { frames = []; poses = []; boxes = []; }
}
scope.onmessage = async event => {
  const request = event.data;
  if (!request || !Number.isSafeInteger(request.id)) return;
  if (busy) { scope.postMessage({ id: request.id, ok: false, code: 'GAZE_BUSY' }); return; }
  busy = true;
  try {
    let value: unknown;
    switch (request.kind) {
      case 'initialize': value = await initialize(request.viewport, request.assetBase); break;
      case 'sample': value = sample(request.image, request.target); break;
      case 'calibrate': value = calibrate(); break;
      case 'reset': clearCalibration(); value = undefined; break;
      default: fail('GAZE_BAD_REQUEST');
    }
    scope.postMessage({ id: request.id, ok: true, value });
  } catch (error) {
    const code = error instanceof Error && /^GAZE_[A-Z_]+$/.test(error.message) ? error.message : 'GAZE_TRACKER_FAILED';
    scope.postMessage({ id: request.id, ok: false, code });
  } finally { busy = false; }
};
