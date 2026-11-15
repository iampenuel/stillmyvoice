/** Diagnostic proposals only. This module has no DOM, camera, input or speech authority. */
export type GazePoint = Readonly<{ x: number; y: number }>;
export type GazeViewport = Readonly<{ key: string; width: number; height: number }>;
export type GazeRegion = Readonly<{ id: string; left: number; top: number; width: number; height: number }>;
export type GazeClassification = 'rectangles' | 'horizontal-bands';
export type GazeLayout = Readonly<{ viewport: GazeViewport; regions: readonly GazeRegion[]; classification?: GazeClassification }>;
export type GazeSample = Readonly<GazePoint & { capturedAt: number; faceDetected: boolean }>;
export type GazeStatus = 'disabled' | 'uncertain' | 'tracking' | 'lost' | 'calibration-required';
export type GazeReason = 'disabled' | 'collecting' | 'stable' | 'no-prediction' | 'missing-face' | 'stale' | 'invalid-prediction' | 'outside-regions' | 'central-dead-zone' | 'oscillating' | 'dispersed' | 'layout-changed' | 'viewport-changed' | 'invalid-layout' | 'non-monotonic';
export type GazeSnapshot = Readonly<{
  status: GazeStatus; reason: GazeReason; regionId: string | null; point: GazePoint | null;
  sampleCount: number; dispersionPx: number | null; ageMs: number | null; sampleAtMs: number | null; validUntilMs: number | null;
  observedForMs: number; stableSinceMs: number | null; stabilizationMs: number | null;
  calibrationRequired: boolean;
}>;
export type GazeStabilityConfig = Readonly<{
  stableMs: number; windowMs: number; staleMs: number; minSamples: number;
  dispersionPx: number; switchHysteresisMs: number; maxSamples: number;
}>;
/** Engineering defaults, not a confidence score or clinically validated thresholds. */
export const defaultGazeStability: GazeStabilityConfig = Object.freeze({
  stableMs: 600, windowMs: 1200, staleMs: 350, minSamples: 5,
  dispersionPx: 80, switchHysteresisMs: 800, maxSamples: 32,
});
const finite = (n: number) => Number.isFinite(n);
const time = (n: number) => finite(n) && n >= 0;
const viewportValid = (v: GazeViewport) => typeof v.key === 'string' && !!v.key && finite(v.width) && finite(v.height) && v.width > 0 && v.height > 0;
const viewportMatches = (a: GazeViewport, b: GazeViewport) => a.key === b.key && a.width === b.width && a.height === b.height;
function regionsValid(regions: readonly GazeRegion[]): boolean {
  return (regions.length === 2 || regions.length === 3) && new Set(regions.map(r => r.id)).size === regions.length
    && regions.every(r => typeof r.id === 'string' && r.id.trim().length > 0 && r.id.length <= 64
      && [r.left,r.top,r.width,r.height].every(finite) && r.width > 0 && r.height > 0);
}
function classificationValid(layout: GazeLayout): boolean {
  if (!regionsValid(layout.regions)) return false;
  if (layout.classification === undefined || layout.classification === 'rectangles') return true;
  if (layout.classification !== 'horizontal-bands' || layout.regions.length !== 2) return false;
  const left = layout.regions.find(r => r.id === 'Left'), right = layout.regions.find(r => r.id === 'Right');
  return !!left && !!right && left.left+left.width <= right.left
    && layout.regions.every(r => r.left >= 0 && r.top >= 0 && r.left+r.width <= layout.viewport.width && r.top+r.height <= layout.viewport.height);
}
export type GazePointClassification = Readonly<{
  regionId: string | null;
  reason: 'region' | 'invalid-layout' | 'invalid-prediction' | 'outside-viewport' | 'outside-regions' | 'central-dead-zone';
}>;
/** The opt-in horizontal diagnostic uses viewport bands, not nearest-card assignment.
 * Both coordinates must remain in the viewport; the central 20%, including its edges,
 * abstains. The supplied real DOM boxes remain available for target geometry evidence. */
export function classifyGazePoint(point: GazePoint, layout: GazeLayout): GazePointClassification {
  if (!viewportValid(layout.viewport) || !classificationValid(layout)) return {regionId:null,reason:'invalid-layout'};
  if (!finite(point.x) || !finite(point.y)) return {regionId:null,reason:'invalid-prediction'};
  if (point.x < 0 || point.y < 0 || point.x >= layout.viewport.width || point.y >= layout.viewport.height) return {regionId:null,reason:'outside-viewport'};
  if (layout.classification === 'horizontal-bands') {
    if (point.x < layout.viewport.width*0.4) return {regionId:'Left',reason:'region'};
    if (point.x > layout.viewport.width*0.6) return {regionId:'Right',reason:'region'};
    return {regionId:null,reason:'central-dead-zone'};
  }
  // Overlapping rectangles abstain; a shared edge belongs to only one side.
  const matches = layout.regions.filter(r => point.x >= r.left && point.x < r.left+r.width && point.y >= r.top && point.y < r.top+r.height);
  return matches.length === 1 ? {regionId:matches[0].id,reason:'region'} : {regionId:null,reason:'outside-regions'};
}
export function regionAtPoint(point: GazePoint, layout: GazeLayout): string | null {
  return classifyGazePoint(point,layout).regionId;
}
function configFor(options: Partial<GazeStabilityConfig>): GazeStabilityConfig {
  const c = { ...defaultGazeStability, ...options };
  if (!Object.values(c).every(finite) || c.stableMs < 500 || c.switchHysteresisMs < c.stableMs
    || c.windowMs < c.switchHysteresisMs || c.staleMs <= 0 || c.staleMs > c.windowMs || c.dispersionPx <= 0
    || !Number.isInteger(c.minSamples) || c.minSamples < 3 || !Number.isInteger(c.maxSamples) || c.maxSamples < c.minSamples || c.maxSamples > 128) {
    throw Error('Invalid gaze stability parameters');
  }
  return Object.freeze(c);
}

export class GazeStability {
  readonly config: GazeStabilityConfig;
  private enabled = false;
  private calibration: GazeViewport | null = null;
  private calibrationRequired = false;
  private layoutKey: string | null = null;
  private layoutChangedAt = 0;
  private history: GazeSample[] = [];
  private candidate: string | null = null;
  private candidateSince: number | null = null;
  private previousStable: string | null = null;
  private stableSince: number | null = null;
  private stabilizedIn: number | null = null;
  private lastValidAt: number | null = null;
  private lastObservationAt: number | null = null;
  private status: GazeStatus = 'disabled';
  private reason: GazeReason = 'disabled';
  constructor(options: Partial<GazeStabilityConfig> = {}) { this.config = configFor(options); }
  /** Call only after the user opted in AND the actual tracker successfully calibrated. */
  enable(viewport: GazeViewport): void {
    if (!viewportValid(viewport)) throw Error('Valid calibration viewport required');
    this.enabled = true; this.calibration = { ...viewport }; this.calibrationRequired = false;
    this.layoutKey = null; this.layoutChangedAt = 0; this.lastValidAt = null; this.lastObservationAt = null;
    this.clear('uncertain', 'collecting');
  }
  disable(): void {
    this.enabled = false; this.calibration = null; this.calibrationRequired = false;
    this.layoutKey = null; this.lastValidAt = null; this.lastObservationAt = null;
    this.clear('disabled', 'disabled');
  }
  /** Clear measurement history without claiming to recalibrate the actual tracker. */
  reset(now = 0): void {
    if (!time(now)) throw Error('Valid measurement reset time required');
    this.layoutChangedAt = now;
    this.lastValidAt = null; this.lastObservationAt = null;
    this.clear(this.enabled ? this.calibrationRequired ? 'calibration-required' : 'uncertain' : 'disabled',
      this.enabled ? this.calibrationRequired ? 'viewport-changed' : 'collecting' : 'disabled');
  }
  private clear(status: GazeStatus, reason: GazeReason, forgetPreference = true) {
    this.history = []; this.candidate = null; this.candidateSince = null; this.stableSince = null; this.stabilizedIn = null;
    if (forgetPreference) this.previousStable = null;
    this.status = status; this.reason = reason;
  }
  observe(sample: GazeSample | null, now: number, layout: GazeLayout): GazeSnapshot {
    if (!this.enabled) return this.snapshot(now);
    if (!time(now)) { this.clear('lost','invalid-prediction'); return this.snapshot(0); }
    if (!viewportValid(layout.viewport) || !this.calibration || !viewportMatches(this.calibration,layout.viewport)) {
      this.calibrationRequired = true; this.clear('calibration-required','viewport-changed'); return this.snapshot(now);
    }
    // A changed viewport remains invalid even if it later returns to the old size.
    if (this.calibrationRequired) return this.snapshot(now);
    if (!classificationValid(layout)) { this.clear('uncertain','invalid-layout'); return this.snapshot(now); }
    const layoutKey = JSON.stringify({classification:layout.classification ?? 'rectangles',regions:layout.regions});
    if (this.layoutKey !== null && this.layoutKey !== layoutKey) {
      this.layoutKey = layoutKey; this.layoutChangedAt = now;
      this.clear('uncertain','layout-changed'); return this.snapshot(now);
    }
    this.layoutKey = layoutKey;
    if (!sample) { this.clear('lost','no-prediction'); return this.snapshot(now); }
    if (sample.faceDetected !== true) { this.clear('lost','missing-face'); return this.snapshot(now); }
    if (![sample.x,sample.y].every(finite) || !time(sample.capturedAt) || sample.capturedAt > now
      || sample.x < 0 || sample.y < 0 || sample.x >= layout.viewport.width || sample.y >= layout.viewport.height) {
      this.clear('lost','invalid-prediction'); return this.snapshot(now);
    }
    if (now-sample.capturedAt > this.config.staleMs || sample.capturedAt < this.layoutChangedAt) {
      this.clear('lost','stale'); return this.snapshot(now);
    }
    if (this.lastObservationAt !== null && sample.capturedAt <= this.lastObservationAt) {
      this.clear('lost','non-monotonic'); return this.snapshot(now);
    }
    this.lastObservationAt = sample.capturedAt;
    if (this.lastValidAt !== null && sample.capturedAt-this.lastValidAt > this.config.staleMs) this.clear('uncertain','collecting');
    this.lastValidAt = sample.capturedAt;
    const classified = classifyGazePoint(sample,layout), region = classified.regionId;
    if (!region) { this.clear('uncertain',classified.reason === 'central-dead-zone' ? 'central-dead-zone' : 'outside-regions'); return this.snapshot(now); }
    const changed = this.candidate !== null && this.candidate !== region;
    if (this.candidate !== region) {
      this.clear('uncertain',changed ? 'oscillating' : 'collecting',false);
      this.candidate = region; this.candidateSince = sample.capturedAt;
    }
    this.history.push({ ...sample });
    this.history = this.history.filter(p => sample.capturedAt-p.capturedAt <= this.config.windowMs).slice(-this.config.maxSamples);
    const { dispersion } = this.measure();
    const duration = sample.capturedAt-this.candidateSince!;
    const needed = this.previousStable !== null && this.previousStable !== region ? this.config.switchHysteresisMs : this.config.stableMs;
    if (dispersion > this.config.dispersionPx) {
      this.status = 'uncertain'; this.reason = 'dispersed'; this.stableSince = null; this.stabilizedIn = null;
    } else if (duration >= needed && sample.capturedAt-this.history[0].capturedAt >= needed && this.history.length >= this.config.minSamples) {
      this.status = 'tracking'; this.reason = 'stable';
      if (this.stableSince === null) { this.stableSince = sample.capturedAt; this.stabilizedIn = duration; }
      this.previousStable = region;
    } else { this.status = 'uncertain'; if (!changed) this.reason = 'collecting'; }
    return this.snapshot(now);
  }
  private measure(): { point: GazePoint | null; dispersion: number } {
    if (!this.history.length) return { point:null,dispersion:0 };
    const point = { x:this.history.reduce((n,p)=>n+p.x,0)/this.history.length, y:this.history.reduce((n,p)=>n+p.y,0)/this.history.length };
    return { point, dispersion:Math.max(...this.history.map(p=>Math.hypot(p.x-point.x,p.y-point.y))) };
  }
  /** Poll between inference calls: old coordinates immediately stop proposing a region. */
  snapshot(now: number): GazeSnapshot {
    if (this.enabled && !this.calibrationRequired && this.lastValidAt !== null) {
      if (!time(now) || now<this.lastValidAt || now-this.lastValidAt > this.config.windowMs) this.clear('lost','stale');
      else if (now-this.lastValidAt > this.config.staleMs) {
        // A pending inference can contain a fresh, timestamp-contiguous camera
        // frame. Expire the proposal NOW, but do not let polling frequency erase
        // that bounded sample history. observe() still clears it when the actual
        // capture gap is too large, and null/invalid frames clear it immediately.
        this.status='lost'; this.reason='stale'; this.stableSince=null; this.stabilizedIn=null;
      }
    }
    const { point,dispersion } = this.measure();
    return Object.freeze({ status:this.status,reason:this.reason,regionId:this.status==='tracking' ? this.candidate : null,
      point:this.status==='lost' ? null : point, sampleCount:this.history.length,dispersionPx:this.history.length ? dispersion : null,
      ageMs:this.lastValidAt !== null && time(now) ? Math.max(0,now-this.lastValidAt) : null,sampleAtMs:this.lastValidAt,validUntilMs:this.lastValidAt===null ? null : this.lastValidAt+this.config.staleMs,
      observedForMs:this.candidateSince !== null && this.lastValidAt !== null ? this.lastValidAt-this.candidateSince : 0,
      stableSinceMs:this.stableSince,stabilizationMs:this.stabilizedIn,calibrationRequired:this.calibrationRequired });
  }
}

export const GAZE_TRIAL_COUNT = 30;
export const GAZE_DIAGNOSTIC_TRIAL_COUNT = 6;
export type GazeTrialCount = 6 | 30;
/** Balanced counts, then Fisher-Yates shuffle; six trials are diagnostic only. */
export function balancedTrialPlan(regionIds: readonly string[], count: GazeTrialCount = 30, random: () => number = Math.random): readonly string[] {
  if (count!==6 && count!==30) throw Error('Use six diagnostic or thirty acceptance trials');
  if ((regionIds.length !== 2 && regionIds.length !== 3) || new Set(regionIds).size !== regionIds.length || regionIds.some(id=>!id.trim())) {
    throw Error('Use two or three distinct broad regions');
  }
  const plan = Array.from({length:count},(_,i)=>regionIds[i%regionIds.length]);
  for (let i=plan.length-1;i>0;i--) {
    const draw = random(); if (!finite(draw) || draw<0 || draw>=1) throw Error('Random source must return a value in [0,1)');
    const j=Math.floor(draw*(i+1)); [plan[i],plan[j]]=[plan[j],plan[i]];
  }
  return Object.freeze(plan);
}
/** Original acceptance-plan API remains fixed at thirty trials. */
export function balanced30TrialPlan(regionIds: readonly string[], random: () => number = Math.random): readonly string[] {
  return balancedTrialPlan(regionIds,30,random);
}
export type GazeTrialResult = Readonly<{
  trial: number; promptedRegion: string; predictedRegion: string | null; outcome: 'correct' | 'incorrect' | 'abstained';
  trackingLossEvents: number; stabilizationMs: number | null; startedAt: number; endedAt: number;
}>;
export type GazeTrialInterruptionReason = 'user-stopped' | 'camera-stopped' | 'viewport-changed' | 'target-layout-changed' | 'page-hidden'
  | 'stream-interrupted' | 'tracking-failed' | 'calibration-reset' | 'unmounted';
/** An unfinished exposure is evidence, but it is not a scored trial outcome. */
export type GazeTrialInterruption = Readonly<{
  trial: number; promptedRegion: string; predictedRegion: string | null; outcome: 'interrupted';
  trackingLossEvents: number; stabilizationMs: number | null; startedAt: number; interruptedAt: number;
  reason: GazeTrialInterruptionReason;
}>;
export type GazeTrialSummary = Readonly<{
  denominator: GazeTrialCount; completed: number; pending: number; interrupted: 0 | 1; correct: number; incorrect: number; abstained: number;
  correctFraction: number; trackingLossEvents: number; pilotGoalMet: boolean;
}>;
export class GazeTrialRun {
  readonly plan: readonly string[];
  readonly count: GazeTrialCount;
  private results: GazeTrialResult[] = [];
  private partial: GazeTrialInterruption | null = null;
  private current: { startedAt: number; predictedRegion: string | null; stabilizationMs: number | null; trackingLossEvents: number; wasLost: boolean; lastObservedAt: number } | null = null;
  constructor(regionIds: readonly string[], random: () => number = Math.random, count: GazeTrialCount = 30) {
    this.plan=balancedTrialPlan(regionIds,count,random); this.count=count;
  }
  /** Reset GazeStability history at each prompt; never reuse the preceding trial's fixation. */
  begin(now: number): Readonly<{ trial:number; promptedRegion:string; startedAt:number }> {
    if (!time(now) || this.current || this.partial || this.results.length>=this.count || (this.results.length && now<this.results.at(-1)!.endedAt)) throw Error('Invalid trial start');
    this.current={startedAt:now,predictedRegion:null,stabilizationMs:null,trackingLossEvents:0,wasLost:false,lastObservedAt:now};
    return Object.freeze({trial:this.results.length+1,promptedRegion:this.plan[this.results.length],startedAt:now});
  }
  observe(snapshot: GazeSnapshot, now: number): void {
    const trial=this.current; if (!trial || !time(now) || now<trial.lastObservedAt) return;
    trial.lastObservedAt=now;
    const lost=snapshot.status==='lost' || snapshot.status==='calibration-required';
    if (lost&&!trial.wasLost) trial.trackingLossEvents++;
    trial.wasLost=lost;
    if (trial.predictedRegion===null && snapshot.status==='tracking' && snapshot.regionId!==null && this.plan.includes(snapshot.regionId)
      && snapshot.stableSinceMs!==null && snapshot.stableSinceMs>=trial.startedAt && snapshot.stableSinceMs<=now
      && snapshot.sampleAtMs!==null && snapshot.sampleAtMs>=trial.startedAt && snapshot.sampleAtMs<=now
      && snapshot.validUntilMs!==null && now<=snapshot.validUntilMs) {
      trial.predictedRegion=snapshot.regionId; trial.stabilizationMs=now-trial.startedAt;
    }
  }
  /** Score only at the experiment's completed trial deadline; missing estimates abstain.
   * User Stop, camera loss and geometry changes must call interrupt(), not finish(). */
  finish(now: number): GazeTrialResult {
    const trial=this.current; if (!trial || !time(now) || now<trial.lastObservedAt) throw Error('Invalid trial finish');
    const promptedRegion=this.plan[this.results.length];
    const result=Object.freeze({trial:this.results.length+1,promptedRegion,predictedRegion:trial.predictedRegion,
      outcome:trial.predictedRegion===null ? 'abstained' as const : trial.predictedRegion===promptedRegion ? 'correct' as const : 'incorrect' as const,
      trackingLossEvents:trial.trackingLossEvents,stabilizationMs:trial.stabilizationMs,startedAt:trial.startedAt,endedAt:now});
    this.results.push(result); this.current=null; return result;
  }
  /** Retire this run without converting a partial exposure into a correct/incorrect/abstained trial.
   * Repeated cleanup is idempotent. A new calibrated run is required to retry. */
  interrupt(now: number, reason: GazeTrialInterruptionReason = 'user-stopped'): GazeTrialInterruption | null {
    if (this.partial) return this.partial;
    const trial=this.current; if (!trial) return null;
    if (!time(now) || now<trial.lastObservedAt || !['user-stopped','camera-stopped','viewport-changed','target-layout-changed','page-hidden','stream-interrupted','tracking-failed','calibration-reset','unmounted'].includes(reason)) {
      throw Error('Invalid trial interruption');
    }
    this.partial=Object.freeze({trial:this.results.length+1,promptedRegion:this.plan[this.results.length],predictedRegion:trial.predictedRegion,
      outcome:'interrupted',trackingLossEvents:trial.trackingLossEvents,stabilizationMs:trial.stabilizationMs,
      startedAt:trial.startedAt,interruptedAt:now,reason});
    this.current=null; return this.partial;
  }
  interruption(): GazeTrialInterruption | null { return this.partial; }
  records(): readonly GazeTrialResult[] { return Object.freeze([...this.results]); }
  summary(): GazeTrialSummary {
    const correct=this.results.filter(r=>r.outcome==='correct').length;
    return Object.freeze({denominator:this.count,completed:this.results.length,pending:this.count-this.results.length,interrupted:this.partial ? 1 : 0,correct,
      incorrect:this.results.filter(r=>r.outcome==='incorrect').length,abstained:this.results.filter(r=>r.outcome==='abstained').length,
      correctFraction:correct/this.count,trackingLossEvents:this.results.reduce((n,r)=>n+r.trackingLossEvents,0)+(this.partial?.trackingLossEvents??0),pilotGoalMet:!this.partial&&this.count===30&&this.results.length===30&&correct>=27});
  }
}
