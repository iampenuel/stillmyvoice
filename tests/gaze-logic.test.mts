import test from 'node:test';
import assert from 'node:assert/strict';
import { GazeStability, GazeTrialRun, balanced30TrialPlan, balancedTrialPlan, regionAtPoint, type GazeLayout, type GazeSample } from '../src/gaze/gaze-logic.mts';

const viewport = {key:'1000:600:1:1',width:1000,height:600};
const layout: GazeLayout = {viewport,regions:[{id:'left',left:0,top:0,width:450,height:600},{id:'right',left:550,top:0,width:450,height:600}]};
const sample=(at:number,x=200,y=300):GazeSample=>({x,y,capturedAt:at,faceDetected:true});
function stable(filter:GazeStability, start=0, x=200, until=600) {
  let result=filter.snapshot(start);
  for(let t=start;t<=start+until;t+=100) result=filter.observe(sample(t,x),t,layout);
  return result;
}
const seeded=(seed:number)=>()=>{seed=(Math.imul(seed,1664525)+1013904223)>>>0;return seed/4294967296;};

test('diagnostic gaze is disabled by default and after explicit shutdown',()=>{
  const f=new GazeStability();
  assert.equal(stable(f).status,'disabled'); assert.equal(f.snapshot(700).regionId,null);
  f.enable(viewport); assert.equal(stable(f).regionId,'left');
  f.disable(); assert.equal(f.snapshot(700).status,'disabled'); assert.equal(f.snapshot(700).sampleAtMs,null);
  assert.equal(f.observe(sample(800),800,layout).regionId,null);
});

test('calibration viewport and parameters must be valid before diagnostic acquisition',()=>{
  const f=new GazeStability();
  assert.throws(()=>f.enable({...viewport,width:0}));
  assert.throws(()=>new GazeStability({stableMs:0}));
  assert.throws(()=>new GazeStability({minSamples:1}));
  assert.throws(()=>new GazeStability({staleMs:Infinity}));
  assert.throws(()=>new GazeStability({maxSamples:1000}));
  f.enable(viewport); assert.equal(f.snapshot(0).status,'uncertain');
});

test('stable broad-region acquisition needs duration and enough actual samples',()=>{
  const f=new GazeStability({minSamples:8}); f.enable(viewport);
  let result=stable(f);
  assert.equal(result.regionId,null); assert.equal(result.sampleCount,7);
  result=f.observe(sample(700,210),700,layout);
  assert.equal(result.status,'tracking'); assert.equal(result.regionId,'left');
  assert.equal(result.stableSinceMs,700); assert.equal(result.stabilizationMs,700);
  assert.equal(result.observedForMs,700); assert.equal(result.ageMs,0);
  assert.ok(result.point!.x>200 && result.point!.x<210); assert.equal(result.validUntilMs,1050);
});

test('CSS pixel region mapping rejects off-screen, gap, overlap and individual-target grids',()=>{
  assert.equal(regionAtPoint({x:200,y:300},layout),'left');
  assert.equal(regionAtPoint({x:750,y:300},layout),'right');
  for(const point of [{x:450,y:300},{x:500,y:300},{x:-1,y:300},{x:1000,y:300},{x:200,y:600},{x:NaN,y:300}]) assert.equal(regionAtPoint(point,layout),null);
  const touching={...layout,regions:[{...layout.regions[0],width:500},{...layout.regions[1],left:500,width:500}]};
  assert.equal(regionAtPoint({x:500,y:300},touching),'right');
  assert.equal(regionAtPoint({x:400,y:300},{...layout,regions:[{...layout.regions[0],width:600},{...layout.regions[1],left:300}]}),null);
  assert.equal(regionAtPoint({x:200,y:300},{...layout,regions:Array.from({length:26},(_,i)=>({id:String(i),left:i*30,top:0,width:30,height:600}))}),null);
});

test('null and missing-face predictions immediately remove an acquired region',()=>{
  const f=new GazeStability(); f.enable(viewport); stable(f);
  let result=f.observe(null,700,layout);
  assert.equal(result.status,'lost'); assert.equal(result.reason,'no-prediction'); assert.equal(result.regionId,null); assert.equal(result.point,null);
  assert.equal(stable(f,800).regionId,'left');
  result=f.observe({...sample(1500),faceDetected:false},1500,layout);
  assert.equal(result.reason,'missing-face'); assert.equal(result.regionId,null); assert.equal(result.sampleCount,0);
});

test('invalid, future, repeated and obsolete samples cannot manufacture stable observations',()=>{
  const f=new GazeStability(); f.enable(viewport);
  for(const value of [sample(1,NaN),sample(1,Infinity),sample(1,-1),sample(1,1000),sample(2)]) {
    const result=f.observe(value,1,layout); assert.equal(result.regionId,null); assert.equal(result.reason,'invalid-prediction');
  }
  assert.equal(f.observe(sample(0),400,layout).reason,'stale');
  assert.equal(stable(f,500).regionId,'left');
  const duplicate=f.observe(sample(1100),1100,layout);
  assert.equal(duplicate.reason,'non-monotonic'); assert.equal(duplicate.regionId,null);
  assert.equal(f.observe(sample(1000),1200,layout).reason,'non-monotonic');
});

test('freshness polling drops old coordinates without waiting for another camera frame',()=>{
  const f=new GazeStability(); f.enable(viewport); stable(f);
  assert.equal(f.snapshot(950).regionId,'left');
  const stale=f.snapshot(951);
  assert.equal(stale.status,'lost'); assert.equal(stale.reason,'stale'); assert.equal(stale.ageMs,351);
  assert.equal(stale.regionId,null); assert.equal(stale.point,null);
  assert.equal(f.observe(sample(1000),1000,layout).regionId,null);
  assert.equal(stable(f,1100).regionId,'left');
});

test('long inference gaps restart acquisition even without an explicit null frame',()=>{
  const f=new GazeStability(); f.enable(viewport); stable(f);
  const result=f.observe(sample(1000),1000,layout);
  assert.equal(result.regionId,null); assert.equal(result.sampleCount,1); assert.equal(result.observedForMs,0);
});

test('history is bounded and high-frequency samples cannot shortcut the duration gate',()=>{
  const f=new GazeStability({maxSamples:8}); f.enable(viewport);
  for(let t=0;t<3000;t+=100) assert.ok(f.observe(sample(t),t,layout).sampleCount<=8);
  assert.equal(f.snapshot(2900).regionId,'left');
  const fast=new GazeStability({maxSamples:8}); fast.enable(viewport);
  for(let t=0;t<2000;t+=10) assert.equal(fast.observe(sample(t),t,layout).regionId,null);
});

test('large dispersion and rapid region alternation abstain rather than oscillating preferences',()=>{
  const f=new GazeStability(); f.enable(viewport);
  for(let t=0;t<=1600;t+=100) assert.equal(f.observe(sample(t,t%200?350:50),t,layout).regionId,null);
  assert.equal(f.snapshot(1600).reason,'dispersed');
  f.reset(1700);
  for(let t=1700;t<=4000;t+=100) assert.equal(f.observe(sample(t,t%200?200:750),t,layout).regionId,null);
  assert.equal(f.snapshot(4000).reason,'oscillating');
});

test('changing a stable region requires the longer hysteresis interval and clears the old proposal immediately',()=>{
  const f=new GazeStability(); f.enable(viewport); assert.equal(stable(f).regionId,'left');
  for(let t=700;t<=1400;t+=100) assert.equal(f.observe(sample(t,750),t,layout).regionId,null);
  const result=f.observe(sample(1500,750),1500,layout);
  assert.equal(result.regionId,'right'); assert.equal(result.stabilizationMs,800);
});

test('viewport, zoom or display changes require actual recalibration, even when dimensions later revert',()=>{
  const f=new GazeStability(); f.enable(viewport); stable(f);
  const changed={...layout,viewport:{...viewport,key:'1000:600:2:1'}};
  let result=f.observe(sample(700),700,changed);
  assert.equal(result.calibrationRequired,true); assert.equal(result.status,'calibration-required'); assert.equal(result.regionId,null);
  result=f.observe(sample(800),800,layout); assert.equal(result.calibrationRequired,true);
  f.reset(900); assert.equal(f.snapshot(900).calibrationRequired,true);
  f.enable(viewport); assert.equal(stable(f,1000).regionId,'left');
});

test('new DOM region geometry resets stability without treating it as camera recalibration',()=>{
  const f=new GazeStability(); f.enable(viewport); stable(f);
  const changed={...layout,regions:[{...layout.regions[0],width:400},layout.regions[1]]};
  let result=f.observe(sample(700),700,changed);
  assert.equal(result.reason,'layout-changed'); assert.equal(result.calibrationRequired,false); assert.equal(result.regionId,null);
  result=f.observe(sample(650),710,changed); assert.equal(result.reason,'stale');
  for(let t=800;t<=1400;t+=100) result=f.observe(sample(t),t,changed);
  assert.equal(result.regionId,'left');
});

test('trial reset discards history and rejects frames captured before the new prompt',()=>{
  const f=new GazeStability(); f.enable(viewport); stable(f);
  f.reset(1000);
  assert.equal(f.snapshot(1000).regionId,null); assert.equal(f.snapshot(1000).calibrationRequired,false);
  assert.equal(f.observe(sample(950),1000,layout).reason,'stale');
  assert.equal(stable(f,1100).regionId,'left');
});

test('30-trial plans are balanced, randomized and reproducible with an injected seed',()=>{
  for(const ids of [['left','right'],['left','middle','right']]) {
    const plan=balanced30TrialPlan(ids,seeded(7));
    assert.equal(plan.length,30);
    for(const id of ids) assert.equal(plan.filter(x=>x===id).length,30/ids.length);
    assert.deepEqual(plan,balanced30TrialPlan(ids,seeded(7)));
    assert.notDeepEqual(plan,balanced30TrialPlan(ids,seeded(8)));
  }
  assert.throws(()=>balanced30TrialPlan(['left'])); assert.throws(()=>balanced30TrialPlan(['left','left']));
  assert.throws(()=>balanced30TrialPlan(['left','right'],()=>1));
});

test('trial measurement refuses a preceding fixation and an expired cached snapshot',()=>{
  const f=new GazeStability(); f.enable(viewport); const old=stable(f);
  const run=new GazeTrialRun(['left','right'],seeded(1)); run.begin(1000);
  run.observe(old,1000);
  f.reset(1000); const recent=stable(f,1000);
  run.observe(recent,2000); // sample at1600 expired at1950.
  assert.equal(run.finish(2100).outcome,'abstained');
});

test('all 30 trials include incorrect estimates and abstentions in the denominator',()=>{
  const run=new GazeTrialRun(['left','right'],seeded(9)); const f=new GazeStability(); f.enable(viewport);
  for(let i=0;i<30;i++) {
    const start=i*3000; const trial=run.begin(start); f.reset(start);
    if(i<29) {
      const region=i<27 ? trial.promptedRegion : trial.promptedRegion==='left'?'right':'left';
      const snapshot=stable(f,start,region==='left'?200:750);
      run.observe(snapshot,start+600);
    } else {
      run.observe(f.observe(null,start+100,layout),start+100);
      run.observe(f.observe(null,start+200,layout),start+200);
      run.observe(f.observe(sample(start+300),start+300,layout),start+300);
      run.observe(f.observe(null,start+400,layout),start+400);
    }
    run.finish(start+2000);
  }
  assert.deepEqual(run.summary(),{denominator:30,completed:30,pending:0,correct:27,incorrect:2,abstained:1,correctFraction:0.9,trackingLossEvents:2,pilotGoalMet:true});
  const records=run.records(); assert.equal(records.length,30);
  assert.equal(records[0].stabilizationMs,600); assert.equal(records[29].stabilizationMs,null);
  assert.equal(records[29].trackingLossEvents,2); assert.throws(()=>run.begin(100000));
});

test('an incomplete run cannot pass the pilot goal and pending trials never shrink its denominator',()=>{
  const run=new GazeTrialRun(['left','right'],seeded(2)); const f=new GazeStability(); f.enable(viewport);
  for(let i=0;i<27;i++) {
    const start=i*3000,trial=run.begin(start); f.reset(start);
    run.observe(stable(f,start,trial.promptedRegion==='left'?200:750),start+600); run.finish(start+2000);
  }
  assert.equal(run.summary().denominator,30); assert.equal(run.summary().correctFraction,0.9);
  assert.equal(run.summary().pending,3); assert.equal(run.summary().pilotGoalMet,false);
});

test('a wrong first stable estimate remains an incorrect trial rather than being replaced by a later success',()=>{
  const run=new GazeTrialRun(['left','right'],seeded(8)); const f=new GazeStability(); f.enable(viewport);
  const trial=run.begin(0),wrong=trial.promptedRegion==='left'?750:200;
  run.observe(stable(f,0,wrong),600);
  f.reset(1000); run.observe(stable(f,1000,wrong===750?200:750),1600);
  const result=run.finish(2000); assert.equal(result.outcome,'incorrect'); assert.equal(result.stabilizationMs,600);
});


test('measurement clocks cannot move backwards and produce future or impossible results',()=>{
  const f=new GazeStability(); f.enable(viewport); stable(f);
  assert.equal(f.snapshot(500).regionId,null);
  f.reset(1000); const fresh=stable(f,1000);
  const run=new GazeTrialRun(['left','right'],seeded(1)); run.begin(1000); run.observe(fresh,1600);
  assert.throws(()=>run.finish(1500));
  const result=run.finish(1700); assert.equal(result.stabilizationMs,600);
  assert.ok(result.endedAt-result.startedAt>=result.stabilizationMs!);
});


test('inference latency can expire output without polling destroying timestamp-contiguous acquisition',()=>{
  const polled=new GazeStability(), unpolled=new GazeStability(); polled.enable(viewport); unpolled.enable(viewport);
  for(let capturedAt=0;capturedAt<=1500;capturedAt+=300) {
    if(capturedAt) {
      const stale=polled.snapshot(capturedAt+100); // Prior frame expired while current frame is still in flight.
      assert.equal(stale.regionId,null); assert.equal(stale.point,null); assert.equal(stale.status,'lost');
    }
    const next=polled.observe(sample(capturedAt),capturedAt+150,layout);
    const baseline=unpolled.observe(sample(capturedAt),capturedAt+150,layout);
    assert.equal(next.regionId,baseline.regionId);
    assert.equal(next.sampleCount,baseline.sampleCount);
    if(capturedAt>=1200) assert.equal(next.regionId,'left');
  }
  assert.equal(polled.config.staleMs,350); // No freshness threshold relaxation.
});

test('temporarily retained stale history cannot bridge an actual long capture gap or resurrect an invalid frame',()=>{
  const f=new GazeStability(); f.enable(viewport); stable(f);
  const stale=f.snapshot(951); assert.equal(stale.regionId,null); assert.equal(stale.sampleCount,7);
  assert.equal(f.observe(sample(1000),1050,layout).sampleCount,1); // 400ms actual gap starts over.
  stable(f,1100); f.snapshot(2051);
  assert.equal(f.observe(null,2060,layout).sampleCount,0);
  assert.equal(f.observe(sample(2100),2150,layout).regionId,null);
});

test('expired output history is still discarded once its bounded history window has elapsed',()=>{
  const f=new GazeStability(); f.enable(viewport); stable(f);
  assert.ok(f.snapshot(951).sampleCount>0);
  const expired=f.snapshot(1801);
  assert.equal(expired.sampleCount,0); assert.equal(expired.regionId,null); assert.equal(expired.point,null);
});

test('six-trial diagnostic plans are balanced and cannot satisfy the thirty-trial acceptance goal',()=>{
  for(const ids of [['left','right'],['left','middle','right']]) {
    const plan=balancedTrialPlan(ids,6,seeded(4));
    assert.equal(plan.length,6);
    for(const id of ids) assert.equal(plan.filter(x=>x===id).length,6/ids.length);
  }
  const run=new GazeTrialRun(['left','right'],seeded(4),6),f=new GazeStability(); f.enable(viewport);
  for(let i=0;i<6;i++) {
    const start=i*3000,trial=run.begin(start); f.reset(start);
    run.observe(stable(f,start,trial.promptedRegion==='left'?200:750),start+600);run.finish(start+2000);
  }
  assert.deepEqual(run.summary(),{denominator:6,completed:6,pending:0,correct:6,incorrect:0,abstained:0,correctFraction:1,trackingLossEvents:0,pilotGoalMet:false});
  assert.equal(run.count,6); assert.throws(()=>run.begin(20000));
  assert.equal(balanced30TrialPlan(['left','right'],seeded(4)).length,30);
});

test('diagnostic denominator includes abstentions and pending trials without being relabeled acceptance',()=>{
  const run=new GazeTrialRun(['left','right'],seeded(4),6);
  run.begin(0); run.finish(2000);
  assert.deepEqual(run.summary(),{denominator:6,completed:1,pending:5,correct:0,incorrect:0,abstained:1,correctFraction:0,trackingLossEvents:0,pilotGoalMet:false});
});
