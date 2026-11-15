/** Local pointer and target previews only. No DOM, camera, input or speech authority. */
import { defaultGazeStability, type GazePoint, type GazeSample, type GazeViewport, type GazeStatus } from './gaze-logic.mts';

export type GazePointerTargetId = 'phrases' | 'spell' | 'back' | 'scroll';
export type GazePointerTarget<T extends string = GazePointerTargetId> = Readonly<{ id:T; left:number; top:number; width:number; height:number }>;
export type GazePointerLayout<T extends string = GazePointerTargetId> = Readonly<{ viewport:GazeViewport; targets:readonly GazePointerTarget<T>[] }>;
export type GazePointerReason = 'disabled' | 'collecting' | 'stable' | 'edge-or-gap' | 'dispersed' | 'no-prediction'
  | 'missing-face' | 'invalid-prediction' | 'stale' | 'non-monotonic' | 'invalid-layout' | 'layout-changed' | 'viewport-changed';
export type GazePointerSnapshot<T extends string = GazePointerTargetId> = Readonly<{
  status:GazeStatus; reason:GazePointerReason; calibrationRequired:boolean;
  rawPoint:GazePoint|null; smoothedPoint:GazePoint|null; stabilizedPoint:GazePoint|null;
  candidateTargetId:T|null; sampleAtMs:number|null; validUntilMs:number|null; ageMs:number|null;
  sampleCount:number; dispersionPx:number|null; observedForMs:number; stableSinceMs:number|null;
}>;
/** Rendering smoothing is separate from the unchanged temporal and 2D stability gates. */
export const gazePointerPolicy = Object.freeze({ ...defaultGazeStability, edgeInsetPx:12, smoothingAlpha:0.7 });
const targetIds:readonly GazePointerTargetId[] = ['phrases','spell','back','scroll'];
const finite = (n:number) => Number.isFinite(n);
const validTime = (n:number) => finite(n) && n>=0;
const validViewport = (v:GazeViewport) => typeof v.key==='string' && !!v.key && finite(v.width) && finite(v.height) && v.width>0 && v.height>0;
const sameViewport = (a:GazeViewport,b:GazeViewport) => a.key===b.key && a.width===b.width && a.height===b.height;
const inside = (p:GazePoint,v:GazeViewport) => finite(p.x) && finite(p.y) && p.x>=0 && p.y>=0 && p.x<v.width && p.y<v.height;
function validTargets(layout:GazePointerLayout<string>, application=false):boolean {
  const boxes=layout.targets, inset=gazePointerPolicy.edgeInsetPx;
  if(!boxes.length)return true;
  if((!application && boxes.length!==4) || boxes.length>100 || new Set(boxes.map(b=>b.id)).size!==boxes.length)return false;
  if(!boxes.every(b=>(application ? typeof b.id==='string' && b.id.length>0 && b.id.length<=160 : targetIds.includes(b.id as GazePointerTargetId)) && [b.left,b.top,b.width,b.height].every(finite)
    && b.width>inset*2 && b.height>inset*2 && b.left>=0 && b.top>=0
    && b.left+b.width<=layout.viewport.width && b.top+b.height<=layout.viewport.height))return false;
  return boxes.every((a,i)=>boxes.every((b,j)=>i===j || a.left+a.width<=b.left || b.left+b.width<=a.left || a.top+a.height<=b.top || b.top+b.height<=a.top));
}
/** Direct hits only. Inset boundaries and gaps abstain; no nearest target or clamping. */
export function pointerTargetAtPoint<T extends string = GazePointerTargetId>(point:GazePoint,layout:GazePointerLayout<T>,application=false):T|null {
  if(!validViewport(layout.viewport) || !validTargets(layout,application) || !inside(point,layout.viewport))return null;
  const inset=gazePointerPolicy.edgeInsetPx;
  const hits=layout.targets.filter(b=>point.x>b.left+inset && point.x<b.left+b.width-inset && point.y>b.top+inset && point.y<b.top+b.height-inset);
  return hits.length===1 ? hits[0].id : null;
}
function measure(history:readonly GazeSample[]):{point:GazePoint|null;dispersion:number|null;duration:number} {
  if(!history.length)return {point:null,dispersion:null,duration:0};
  const point={x:history.reduce((n,p)=>n+p.x,0)/history.length,y:history.reduce((n,p)=>n+p.y,0)/history.length};
  return {point,dispersion:Math.max(...history.map(p=>Math.hypot(p.x-point.x,p.y-point.y))),duration:history.at(-1)!.capturedAt-history[0].capturedAt};
}

export class GazePointer<T extends string = GazePointerTargetId> {
  private readonly application:boolean;
  constructor(application=false) { this.application=application; }
  private enabled=false;
  private calibration:GazeViewport|null=null;
  private calibrationRequired=false;
  private layoutKey:string|null=null;
  private cutoff=0;
  private lastObservationAt:number|null=null;
  private last:GazeSample|null=null;
  private smooth:GazePoint|null=null;
  private history:GazeSample[]=[];
  private target:T|null|undefined=undefined;
  private previousTarget:T|null=null;
  private candidate:T|null=null;
  private stablePoint:GazePoint|null=null;
  private stableSince:number|null=null;
  private status:GazeStatus='disabled';
  private reason:GazePointerReason='disabled';

  /** Call only after explicit camera opt-in and successful actual tracker calibration. */
  enable(viewport:GazeViewport):void {
    if(!validViewport(viewport))throw Error('Valid calibration viewport required');
    this.enabled=true;this.calibration={...viewport};this.calibrationRequired=false;this.layoutKey=null;this.cutoff=0;this.lastObservationAt=null;
    this.clear('uncertain','collecting');
  }
  disable():void {
    this.enabled=false;this.calibration=null;this.calibrationRequired=false;this.layoutKey=null;this.cutoff=0;this.lastObservationAt=null;
    this.clear('disabled','disabled');
  }
  /** Reset proposals, never pretend to recalibrate the tracker. */
  reset(now=0):void {
    if(!validTime(now))throw Error('Valid pointer reset time required');
    this.cutoff=now;this.lastObservationAt=null;
    this.clear(!this.enabled?'disabled':this.calibrationRequired?'calibration-required':'uncertain',!this.enabled?'disabled':this.calibrationRequired?'viewport-changed':'collecting');
  }
  private clear(status:GazeStatus,reason:GazePointerReason):void {
    this.last=null;this.smooth=null;this.history=[];this.target=undefined;this.previousTarget=null;this.candidate=null;this.stablePoint=null;this.stableSince=null;
    this.status=status;this.reason=reason;
  }
  private layoutValid(layout:GazePointerLayout<T>,now:number):boolean {
    if(!validViewport(layout.viewport) || !this.calibration || !sameViewport(this.calibration,layout.viewport)) {
      this.calibrationRequired=true;this.clear('calibration-required','viewport-changed');return false;
    }
    if(this.calibrationRequired)return false;
    if(!validTargets(layout,this.application)){this.cutoff=now;this.clear('uncertain','invalid-layout');return false;}
    const key=JSON.stringify([...layout.targets].sort((a,b)=>a.id.localeCompare(b.id)));
    if(this.layoutKey!==null && this.layoutKey!==key) {
      this.layoutKey=key;this.cutoff=now;this.clear('uncertain','layout-changed');return false;
    }
    this.layoutKey=key;return true;
  }
  /** sample must come from the worker's accepted point. Rejected diagnostic points must be null. */
  observe(sample:GazeSample|null,now:number,layout:GazePointerLayout<T>):GazePointerSnapshot<T> {
    if(!this.enabled)return this.snapshot(now);
    if(!validTime(now)){this.clear('lost','invalid-prediction');return this.snapshot(0);}
    if(!this.layoutValid(layout,now))return this.snapshot(now);
    if(!sample){this.clear('lost','no-prediction');return this.snapshot(now);}
    if(sample.faceDetected!==true){this.clear('lost','missing-face');return this.snapshot(now);}
    if(!inside(sample,layout.viewport) || !validTime(sample.capturedAt) || sample.capturedAt>now) {
      this.clear('lost','invalid-prediction');return this.snapshot(now);
    }
    if(now-sample.capturedAt>gazePointerPolicy.staleMs || sample.capturedAt<this.cutoff) {
      this.clear('lost','stale');return this.snapshot(now);
    }
    if(this.lastObservationAt!==null && sample.capturedAt<=this.lastObservationAt) {
      this.clear('lost','non-monotonic');return this.snapshot(now);
    }
    this.lastObservationAt=sample.capturedAt;
    if(this.last && sample.capturedAt-this.last.capturedAt>gazePointerPolicy.staleMs)this.clear('uncertain','collecting');
    const alpha=gazePointerPolicy.smoothingAlpha;
    this.smooth=this.smooth ? {x:alpha*sample.x+(1-alpha)*this.smooth.x,y:alpha*sample.y+(1-alpha)*this.smooth.y} : {x:sample.x,y:sample.y};
    this.last={...sample};
    const hit=pointerTargetAtPoint(sample,layout,this.application);
    if(hit!==this.target){this.history=[];this.target=hit;this.candidate=null;this.stablePoint=null;this.stableSince=null;}
    this.history.push({...sample});
    this.history=this.history.filter(p=>sample.capturedAt-p.capturedAt<=gazePointerPolicy.windowMs).slice(-gazePointerPolicy.maxSamples);
    const {point,dispersion,duration}=measure(this.history);
    const enough=this.history.length>=gazePointerPolicy.minSamples;
    const stable=enough && duration>=gazePointerPolicy.stableMs && dispersion!==null && dispersion<=gazePointerPolicy.dispersionPx;
    this.stablePoint=stable?point:null;
    if(stable){this.stableSince??=sample.capturedAt;}else this.stableSince=null;
    const needed=this.previousTarget!==null && this.previousTarget!==hit ? gazePointerPolicy.switchHysteresisMs : gazePointerPolicy.stableMs;
    this.candidate=hit!==null && stable && duration>=needed ? hit : null;
    if(this.candidate)this.previousTarget=this.candidate;
    this.status=stable && (!layout.targets.length || this.candidate!==null)?'tracking':'uncertain';
    this.reason=dispersion!==null && dispersion>gazePointerPolicy.dispersionPx?'dispersed'
      :layout.targets.length && hit===null?'edge-or-gap':this.status==='tracking'?'stable':'collecting';
    return this.snapshot(now);
  }
  /** Pass current geometry when polling so movement invalidates previews before the next frame. */
  snapshot(now:number,layout?:GazePointerLayout<T>):GazePointerSnapshot<T> {
    if(this.enabled && layout && validTime(now))this.layoutValid(layout,now);
    if(this.enabled && !validTime(now))this.clear('lost','invalid-prediction');
    if(this.last && now<this.last.capturedAt)this.clear('lost','non-monotonic');
    let expired=!!this.last && now-this.last.capturedAt>gazePointerPolicy.staleMs;
    if(expired){this.status='lost';this.reason='stale';this.candidate=null;this.stablePoint=null;this.stableSince=null;}
    // Expire outputs immediately, while preserving bounded continuous-capture history
    // during in-flight inference. Real capture gaps/nulls clear it in observe().
    if(this.last && now-this.last.capturedAt>gazePointerPolicy.windowMs){this.clear('lost','stale');expired=true;}
    const visible=this.enabled && !this.calibrationRequired && !expired && this.last!==null;
    const {dispersion,duration}=measure(this.history);
    const copy=(point:GazePoint|null):GazePoint|null=>point?Object.freeze({x:point.x,y:point.y}):null;
    return Object.freeze({status:this.status,reason:this.reason,calibrationRequired:this.calibrationRequired,
      rawPoint:visible?copy(this.last):null,smoothedPoint:visible?copy(this.smooth):null,stabilizedPoint:visible?copy(this.stablePoint):null,
      candidateTargetId:visible?this.candidate:null,sampleAtMs:this.last?.capturedAt??null,
      validUntilMs:this.last?this.last.capturedAt+gazePointerPolicy.staleMs:null,ageMs:this.last?Math.max(0,now-this.last.capturedAt):null,
      sampleCount:this.history.length,dispersionPx:dispersion,observedForMs:duration,stableSinceMs:visible?this.stableSince:null});
  }
}
