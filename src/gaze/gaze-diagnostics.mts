// SPDX-License-Identifier: AGPL-3.0-or-later
import { classifyGazePoint, type GazeLayout, type GazePoint, type GazeSnapshot, type GazeViewport } from './gaze-logic.mts';
import type { TrackerSample } from './tracker-adapter.ts';

/** CSS viewport coordinates are unaffected by a resize event with unchanged geometry. */
export function viewportChanged(before: GazeViewport | null, after: GazeViewport): boolean {
  return !!before && (before.key !== after.key || before.width !== after.width || before.height !== after.height);
}
/** Start-to-start cadence, never an extra idle period after inference. No overlapping calls. */
export function sampleDelay(lastCaptureAt: number, now: number, interval = 150): number {
  return Math.max(0, interval - Math.max(0, now-lastCaptureAt));
}
export type GazeDiagnosticContext = Readonly<{
  trial: number; promptedRegion: string; targetPoint: GazePoint; eligible: boolean;
}>;
const countReason = (counts: Record<string, number>, reason: string) => { counts[reason] = (counts[reason] ?? 0) + 1; };
const finitePoint = (point: GazePoint | null): point is GazePoint => !!point && Number.isFinite(point.x) && Number.isFinite(point.y);
const insideViewport = (point: GazePoint, viewport: GazeViewport) => point.x >= 0 && point.y >= 0 && point.x < viewport.width && point.y < viewport.height;
const median = (values: readonly number[]) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a,b) => a-b), middle = Math.floor(sorted.length/2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle-1]+sorted[middle])/2;
};
/** Online moments retain no individual gaze coordinates. */
class Moments {
  count = 0; mean = 0; private m2 = 0; private min = Infinity; private max = -Infinity;
  add(value: number | null) {
    if (value === null || !Number.isFinite(value)) return;
    this.count++; const delta = value-this.mean; this.mean += delta/this.count;
    this.m2 += delta*(value-this.mean); this.min = Math.min(this.min,value); this.max = Math.max(this.max,value);
  }
  snapshot() {
    const variance = this.count ? Math.max(0,this.m2/this.count) : null;
    return { count:this.count, mean:this.count ? this.mean : null, standardDeviation:variance === null ? null : Math.sqrt(variance),
      min:this.count ? this.min : null, max:this.count ? this.max : null,
      rootMeanSquare:variance === null ? null : Math.sqrt(variance+this.mean*this.mean) };
  }
}
/** Quantiles are bounded to the latest120 values; moments/max cover the complete run. */
class Timing {
  private moments = new Moments(); private recent:number[] = [];
  add(value: number) {
    if (!Number.isFinite(value) || value < 0) return;
    this.moments.add(value); this.recent.push(value); if (this.recent.length > 120) this.recent.shift();
  }
  snapshot() {
    const sorted = [...this.recent].sort((a,b) => a-b);
    return { ...this.moments.snapshot(), median:median(sorted), p95:sorted.length ? sorted[Math.ceil(sorted.length*0.95)-1] : null, quantileSampleCount:sorted.length };
  }
}
function copyLayout(layout: GazeLayout): GazeLayout {
  return { viewport:{...layout.viewport}, regions:layout.regions.map(region => ({...region})), ...(layout.classification ? {classification:layout.classification} : {}) };
}
/** Compare the active mapping with DOM rectangles using aggregate counters only. */
class MappingAggregate {
  private predictions=0; private mapped=0; private reasons:Record<string,number>={}; private regions:Record<string,number>={};
  private rectangleInside=0; private rectangleRegions:Record<string,number>={}; private mappedOutsideRectangles=0; private rectangleInsideButUnmapped=0;
  observe(point:GazePoint,layout:GazeLayout) {
    const active=classifyGazePoint(point,layout), rectangle=classifyGazePoint(point,{...layout,classification:'rectangles'});
    this.predictions++; countReason(this.reasons,active.reason);
    if (active.regionId!==null) { this.mapped++; countReason(this.regions,active.regionId); }
    if (rectangle.regionId!==null) { this.rectangleInside++; countReason(this.rectangleRegions,rectangle.regionId); }
    if (active.regionId!==null && rectangle.regionId===null) this.mappedOutsideRectangles++;
    if (active.regionId===null && rectangle.regionId!==null) this.rectangleInsideButUnmapped++;
    return active.regionId;
  }
  snapshot() {
    return {predictions:this.predictions,mapped:this.mapped,unmapped:this.predictions-this.mapped,reasons:{...this.reasons},regionCounts:{...this.regions},
      rectangleComparison:{inside:this.rectangleInside,outside:this.predictions-this.rectangleInside,regionCounts:{...this.rectangleRegions},
        mappedOutsideRectangles:this.mappedOutsideRectangles,rectangleInsideButUnmapped:this.rectangleInsideButUnmapped}};
  }
}
class TargetAggregate {
  private observed = 0; private orientation = 0; private eligible = 0; private faces = 0; private finite = 0; private accepted = 0;
  private rawInside = 0; private rawOther = 0; private rawOutside = 0; private rawOutsideViewport = 0;
  private stableCorrect = 0; private stableIncorrect = 0; private abstentions = 0;
  private errorsX = new Moments(); private errorsY = new Moments(); private distances = new Moments(); private boxDistances = new Moments();
  private rawX = new Moments(); private rawY = new Moments(); private dispersion = new Timing(); private arrival = new Timing();
  private directions = { inside:0,left:0,right:0,above:0,below:0 };
  private workerReasons:Record<string,number> = {}; private filterReasons:Record<string,number> = {};
  private targetPoint:GazePoint; private targetChanges = 0;
  private classification:NonNullable<GazeLayout['classification']>='rectangles';
  private rawMapping=new MappingAggregate(); private acceptedMapping=new MappingAggregate();
  readonly promptedRegion:string;
  constructor(context:GazeDiagnosticContext) { this.promptedRegion=context.promptedRegion; this.targetPoint={...context.targetPoint}; }
  observe(result:TrackerSample, now:number, capturedAt:number, layout:GazeLayout, filtered:GazeSnapshot|null, context:GazeDiagnosticContext) {
    this.observed++; this.classification=layout.classification??'rectangles';
    if (this.targetPoint.x !== context.targetPoint.x || this.targetPoint.y !== context.targetPoint.y) this.targetChanges++;
    this.targetPoint={...context.targetPoint};
    if (!context.eligible) { this.orientation++; return; }
    this.eligible++; if (result.face) this.faces++; if (result.point) { this.accepted++; this.acceptedMapping.observe(result.point,layout); }
    countReason(this.workerReasons,result.diagnostics.reason); this.arrival.add(now-capturedAt);
    if (filtered) {
      countReason(this.filterReasons,filtered.reason); if (filtered.dispersionPx!==null) this.dispersion.add(filtered.dispersionPx);
      if (filtered.status === 'tracking' && filtered.regionId !== null) {
        if (filtered.regionId === context.promptedRegion) this.stableCorrect++; else this.stableIncorrect++;
      } else this.abstentions++;
    } else this.abstentions++;
    const point=result.diagnostics.rawPoint;
    if (!finitePoint(point)) return;
    this.finite++; this.rawX.add(point.x); this.rawY.add(point.y);
    const region=this.rawMapping.observe(point,layout);
    if (region === context.promptedRegion) this.rawInside++; else if (region !== null) this.rawOther++; else this.rawOutside++;
    if (!insideViewport(point,layout.viewport)) this.rawOutsideViewport++;
    const dx=point.x-context.targetPoint.x, dy=point.y-context.targetPoint.y;
    this.errorsX.add(dx); this.errorsY.add(dy); this.distances.add(Math.hypot(dx,dy));
    const box=layout.regions.find(region => region.id === context.promptedRegion);
    if (box) {
      const left=point.x<box.left, right=point.x>=box.left+box.width, above=point.y<box.top, below=point.y>=box.top+box.height;
      if (left) this.directions.left++; if (right) this.directions.right++; if (above) this.directions.above++; if (below) this.directions.below++;
      if (!left && !right && !above && !below) this.directions.inside++;
      this.boxDistances.add(Math.hypot(Math.max(box.left-point.x,0,point.x-box.left-box.width),Math.max(box.top-point.y,0,point.y-box.top-box.height)));
    }
  }
  snapshot() {
    return { promptedRegion:this.promptedRegion, targetPoint:{...this.targetPoint},targetChanges:this.targetChanges,
      classification:this.classification,targetErrorGeometry:'dom-target-center-and-rectangle' as const,rawMapping:this.rawMapping.snapshot(),acceptedMapping:this.acceptedMapping.snapshot(),
      observedFrames:this.observed,orientationFrames:this.orientation,eligibleFrames:this.eligible,successfulFaceDetections:this.faces,
      finiteRawPredictions:this.finite,acceptedPredictions:this.accepted,rawInsidePromptedRegion:this.rawInside,
      rawInsideOtherRegion:this.rawOther,rawOutsideRegions:this.rawOutside,rawOutsideViewport:this.rawOutsideViewport,
      stableCorrectFrames:this.stableCorrect,stableIncorrectFrames:this.stableIncorrect,filteredAbstentionFrames:this.abstentions,
      errorXPx:this.errorsX.snapshot(),errorYPx:this.errorsY.snapshot(),distanceFromTargetPx:this.distances.snapshot(),
      distanceOutsideTargetBoxPx:this.boxDistances.snapshot(),directions:{...this.directions},
      rawCoordinateDistribution:{x:this.rawX.snapshot(),y:this.rawY.snapshot()},filterDispersionPx:this.dispersion.snapshot(),
      arrivalLatencyMs:this.arrival.snapshot(),workerReasons:{...this.workerReasons},filterReasons:{...this.filterReasons} };
  }
}
/** Aggregate numeric diagnostics only. No frames, landmarks, face geometry or stored gaze points. */
export class GazeDiagnostics {
  private frames=0; private faces=0; private rawFinite=0; private rawInViewport=0;
  private stale=0; private unstable=0; private outside=0; private accepted=0;
  private lastCaptureAt:number|null=null; private lastPredictionAt:number|null=null;
  private captureIntervals=new Timing(); private predictionIntervals=new Timing(); private inference=new Timing();
  private arrivals=new Timing(); private readouts=new Timing(); private detect=new Timing(); private predict=new Timing();
  private rawX=new Moments(); private rawY=new Moments(); private dispersion=new Timing(); private sampleAge=new Timing();
  private reasons:Record<string,number>={}; private filterReasons:Record<string,number>={}; private filterPollReasons:Record<string,number>={};
  private filterTransitions:Record<string,number>={}; private filterHistoryDrops:Record<string,number>={}; private resets:Record<string,number>={};
  private previousFilter:{reason:string;sampleCount:number}|null=null;
  private rawRegionCounts:Record<string,number>={}; private rawRegion:string|null=null;
  private calibrationSamples=0; private samplesPerPoint:number[]=[];
  private calibrationStatus=false; private frame='—'; private calibrationFrame='—'; private calibrationViewport='—';
  private rawRange:TrackerSample['diagnostics']['rawRange']=null;
  private lastReason='Not started'; private lastPrediction='not-attempted';
  private geometry:GazeLayout|null=null; private lastGeometry:GazeLayout|null=null; private geometryChanges=0;
  private rawMapping=new MappingAggregate(); private acceptedMapping=new MappingAggregate();
  private targets=new Map<string,TargetAggregate>(); private trials=new Map<number,TargetAggregate>();
  observe(result:TrackerSample,capturedAt:number,now:number,layout:GazeLayout,filtered:GazeSnapshot|null,context?:GazeDiagnosticContext) {
    this.frames++; if (result.face) this.faces++;
    const d=result.diagnostics;
    this.inference.add(result.inferenceMs); this.detect.add(d.detectMs); this.predict.add(d.predictMs); this.arrivals.add(now-capturedAt);
    if (this.lastCaptureAt !== null && capturedAt > this.lastCaptureAt) this.captureIntervals.add(capturedAt-this.lastCaptureAt);
    this.lastCaptureAt=capturedAt;
    const nextGeometry=copyLayout(layout);
    this.geometry??=nextGeometry;
    if (this.lastGeometry && JSON.stringify(this.lastGeometry)!==JSON.stringify(nextGeometry)) this.geometryChanges++;
    this.lastGeometry=nextGeometry;
    this.lastReason=d.reason; this.lastPrediction=d.predictionOutcome; countReason(this.reasons,d.reason);
    this.frame=d.frame.width+' × '+d.frame.height;
    this.calibrationFrame=d.calibrationFrame?d.calibrationFrame.width+' × '+d.calibrationFrame.height:'—';
    this.calibrationViewport=d.calibrationViewport?d.calibrationViewport.width+' × '+d.calibrationViewport.height:'—';
    this.calibrationSamples=d.calibrationSamples; this.samplesPerPoint=[...d.samplesPerPoint]; this.calibrationStatus=result.calibrated;
    this.rawRegion=d.rawPoint?this.rawMapping.observe(d.rawPoint,layout):null;
    if (finitePoint(d.rawPoint)) {
      this.rawFinite++; this.rawX.add(d.rawPoint.x); this.rawY.add(d.rawPoint.y);
      if (this.lastPredictionAt!==null && capturedAt>this.lastPredictionAt) this.predictionIntervals.add(capturedAt-this.lastPredictionAt);
      this.lastPredictionAt=capturedAt;
      if (insideViewport(d.rawPoint,layout.viewport)) this.rawInViewport++;
      if (!this.rawRegion) this.outside++; else countReason(this.rawRegionCounts,this.rawRegion);
      // Run-scoped range; the worker's lifetime range includes pretrial predictions.
      this.rawRange=this.rawRange?{minX:Math.min(this.rawRange.minX,d.rawPoint.x),maxX:Math.max(this.rawRange.maxX,d.rawPoint.x),
        minY:Math.min(this.rawRange.minY,d.rawPoint.y),maxY:Math.max(this.rawRange.maxY,d.rawPoint.y),samples:this.rawFinite}
        :{minX:d.rawPoint.x,maxX:d.rawPoint.x,minY:d.rawPoint.y,maxY:d.rawPoint.y,samples:1};
    }
    if (filtered) {
      countReason(this.filterReasons,filtered.reason); if (filtered.dispersionPx!==null) this.dispersion.add(filtered.dispersionPx); if (filtered.ageMs!==null) this.sampleAge.add(filtered.ageMs);
      if (this.previousFilter && this.previousFilter.reason!==filtered.reason) countReason(this.filterTransitions,this.previousFilter.reason+' → '+filtered.reason);
      if (this.previousFilter && this.previousFilter.sampleCount>filtered.sampleCount && filtered.sampleCount<=1) countReason(this.filterHistoryDrops,filtered.reason);
      this.previousFilter={reason:filtered.reason,sampleCount:filtered.sampleCount};
    }
    // Count a prediction once on arrival, never once per UI freshness poll.
    if (filtered?.reason==='stale' && result.point && now>=capturedAt) this.stale++;
    if (result.point && filtered && ['collecting','oscillating','dispersed'].includes(filtered.reason)) this.unstable++;
    if (result.point) { this.accepted++; this.acceptedMapping.observe(result.point,layout); }
    if (context && Number.isInteger(context.trial) && context.trial>0 && context.trial<=30 && finitePoint(context.targetPoint)) {
      if (!this.targets.has(context.promptedRegion) && this.targets.size<3) this.targets.set(context.promptedRegion,new TargetAggregate(context));
      if (!this.trials.has(context.trial)) this.trials.set(context.trial,new TargetAggregate(context));
      this.targets.get(context.promptedRegion)?.observe(result,now,capturedAt,layout,filtered,context);
      this.trials.get(context.trial)?.observe(result,now,capturedAt,layout,filtered,context);
    }
  }
  /** UI state-update timestamp, not browser paint or perceived readout latency. */
  recordReadout(capturedAt:number,updatedAt:number) { this.readouts.add(updatedAt-capturedAt); }
  /** Polls use a separate denominator and never inflate frame or rejection counts. */
  observeFilterPoll(snapshot:GazeSnapshot) { countReason(this.filterPollReasons,snapshot.reason); }
  /** Caller reports intentional resets; this method does not change the actual filter. */
  recordReset(reason:string) { countReason(this.resets,reason); this.previousFilter=null; }
  snapshot() {
    const inference=this.inference.snapshot(), predictionInterval=this.predictionIntervals.snapshot();
    return Object.freeze({validCameraFrames:this.frames,successfulFaceDetections:this.faces,
      classification:this.lastGeometry?(this.lastGeometry.classification??'rectangles'):null,rawMapping:this.rawMapping.snapshot(),acceptedMapping:this.acceptedMapping.snapshot(),
      finiteRawPredictions:this.rawFinite,inViewportRawPredictions:this.rawInViewport,acceptedPredictions:this.accepted,
      predictionsRejectedStale:this.stale,predictionsNotYetStable:this.unstable,predictionsOutsideRegions:this.outside,
      medianPredictionIntervalMs:predictionInterval.median,medianInferenceMs:inference.median,rawRegion:this.rawRegion,
      rawRange:this.rawRange?{...this.rawRange}:null,lastReason:this.lastReason,lastPrediction:this.lastPrediction,reasons:{...this.reasons},
      calibrationFitted:this.calibrationStatus,calibrationSamples:this.calibrationSamples,samplesPerPoint:[...this.samplesPerPoint],
      frame:this.frame,calibrationFrame:this.calibrationFrame,calibrationViewport:this.calibrationViewport,
      rawCoordinateDistribution:{x:this.rawX.snapshot(),y:this.rawY.snapshot()},rawRegionCounts:{...this.rawRegionCounts},
      filterReasons:{...this.filterReasons},filterPollReasons:{...this.filterPollReasons},filterReasonTransitions:{...this.filterTransitions},
      filterHistoryDrops:{...this.filterHistoryDrops},filterResets:{...this.resets},filterDispersionPx:this.dispersion.snapshot(),
      timing:{captureIntervalMs:this.captureIntervals.snapshot(),predictionIntervalMs:predictionInterval,inferenceMs:inference,
        detectMs:this.detect.snapshot(),predictMs:this.predict.snapshot(),arrivalLatencyMs:this.arrivals.snapshot(),
        readoutUpdateLatencyMs:this.readouts.snapshot(),filterSampleAgeMs:this.sampleAge.snapshot(),quantileWindow:120},
      geometry:this.geometry?copyLayout(this.geometry):null,lastGeometry:this.lastGeometry?copyLayout(this.lastGeometry):null,geometryChanges:this.geometryChanges,
      heldOutTargets:[...this.targets.values()].map(target=>target.snapshot()),
      heldOutTrials:[...this.trials.entries()].sort(([a],[b])=>a-b).map(([trial,target])=>({trial,...target.snapshot()}))});
  }
}
