// SPDX-License-Identifier: AGPL-3.0-or-later
import { regionAtPoint, type GazeLayout, type GazeSnapshot, type GazeViewport } from './gaze-logic.mts';
import type { TrackerSample } from './tracker-adapter.ts';

/** CSS viewport coordinates are unaffected by a resize event with unchanged geometry. */
export function viewportChanged(before: GazeViewport | null, after: GazeViewport): boolean {
  return !!before && (before.key !== after.key || before.width !== after.width || before.height !== after.height);
}
/** Start-to-start cadence, never an extra idle period after inference. No overlapping calls. */
export function sampleDelay(lastCaptureAt: number, now: number, interval = 150): number {
  return Math.max(0, interval - Math.max(0, now-lastCaptureAt));
}
const median = (values: readonly number[]) => {
  if(!values.length)return null;
  const sorted=[...values].sort((a,b)=>a-b), middle=Math.floor(sorted.length/2);
  return sorted.length%2?sorted[middle]:(sorted[middle-1]+sorted[middle])/2;
};
/** Aggregate numeric diagnostics only. No frames, landmarks, face geometry or stored gaze points. */
export class GazeDiagnostics {
  private frames=0; private faces=0; private rawFinite=0; private rawInViewport=0;
  private stale=0; private unstable=0; private outside=0; private accepted=0;
  private lastPredictionAt:number|null=null;
  private intervals:number[]=[]; private inference:number[]=[];
  private reasons:Record<string,number>={};
  private rawRegion:string|null=null;
  private calibrationSamples=0; private samplesPerPoint:number[]=[];
  private calibrationStatus=false; private frame='—'; private calibrationFrame='—'; private calibrationViewport='—';
  private rawRange:TrackerSample['diagnostics']['rawRange']=null;
  private lastReason='Not started'; private lastPrediction='not-attempted';
  observe(result:TrackerSample,capturedAt:number,now:number,layout:GazeLayout,filtered:GazeSnapshot|null) {
    this.frames++;if(result.face)this.faces++;
    const d=result.diagnostics;
    this.inference.push(result.inferenceMs);this.inference=this.inference.slice(-120);
    this.rawRange=d.rawRange?{...d.rawRange}:null;this.lastReason=d.reason;this.lastPrediction=d.predictionOutcome;
    this.reasons[d.reason]=(this.reasons[d.reason]??0)+1;
    this.frame=d.frame.width+' × '+d.frame.height;
    this.calibrationFrame=d.calibrationFrame?d.calibrationFrame.width+' × '+d.calibrationFrame.height:'—';
    this.calibrationViewport=d.calibrationViewport?d.calibrationViewport.width+' × '+d.calibrationViewport.height:'—';
    this.calibrationSamples=d.calibrationSamples;this.samplesPerPoint=[...d.samplesPerPoint];this.calibrationStatus=result.calibrated;
    this.rawRegion=d.rawPoint?regionAtPoint(d.rawPoint,layout):null;
    if(d.rawPoint){
      this.rawFinite++;
      if(this.lastPredictionAt!==null&&capturedAt>this.lastPredictionAt){this.intervals.push(capturedAt-this.lastPredictionAt);this.intervals=this.intervals.slice(-120);}
      this.lastPredictionAt=capturedAt;
      if(d.predictionOutcome==='in-viewport')this.rawInViewport++;
      if(!this.rawRegion)this.outside++;
    }
    // Count a prediction once on arrival, never once per UI freshness poll.
    if(filtered?.reason==='stale'&&result.point&&now>=capturedAt)this.stale++;
    if(result.point&&filtered&&['collecting','oscillating','dispersed'].includes(filtered.reason))this.unstable++;
    if(result.point)this.accepted++;
  }
  snapshot(){return Object.freeze({validCameraFrames:this.frames,successfulFaceDetections:this.faces,
    finiteRawPredictions:this.rawFinite,inViewportRawPredictions:this.rawInViewport,acceptedPredictions:this.accepted,
    predictionsRejectedStale:this.stale,predictionsNotYetStable:this.unstable,predictionsOutsideRegions:this.outside,
    medianPredictionIntervalMs:median(this.intervals),medianInferenceMs:median(this.inference),rawRegion:this.rawRegion,
    rawRange:this.rawRange?{...this.rawRange}:null,lastReason:this.lastReason,lastPrediction:this.lastPrediction,reasons:{...this.reasons},
    calibrationFitted:this.calibrationStatus,calibrationSamples:this.calibrationSamples,samplesPerPoint:[...this.samplesPerPoint],
    frame:this.frame,calibrationFrame:this.calibrationFrame,calibrationViewport:this.calibrationViewport});}
}
