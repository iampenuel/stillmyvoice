import test from 'node:test';
import assert from 'node:assert/strict';
import { GazePointer, gazePointerPolicy, pointerTargetAtPoint, type GazePointerLayout } from '../src/gaze/gaze-pointer.mts';
import type { GazeSample } from '../src/gaze/gaze-logic.mts';
const viewport={key:'1000:800:1:1',width:1000,height:800};
const pointerOnly:GazePointerLayout={viewport,targets:[]};
const sandbox:GazePointerLayout={viewport,targets:[
  {id:'phrases',left:40,top:40,width:420,height:300},{id:'spell',left:540,top:40,width:420,height:300},
  {id:'back',left:40,top:420,width:420,height:300},{id:'scroll',left:540,top:420,width:420,height:300},
]};
const sample=(capturedAt:number,x=200,y=200):GazeSample=>({x,y,capturedAt,faceDetected:true});
function acquire(p:GazePointer,start=0,x=200,y=200,layout=sandbox){let s=p.snapshot(start);for(let t=start;t<=start+600;t+=150)s=p.observe(sample(t,x,y),t,layout);return s;}
function hidden(s:ReturnType<GazePointer['snapshot']>){assert.equal(s.rawPoint,null);assert.equal(s.smoothedPoint,null);assert.equal(s.stabilizedPoint,null);assert.equal(s.candidateTargetId,null);}

test('pointer is opt-in, supports target-free display, and becomes fully hidden on shutdown',()=>{
  const p=new GazePointer();hidden(p.observe(sample(0),0,pointerOnly));assert.equal(p.snapshot(0).status,'disabled');
  assert.throws(()=>p.enable({...viewport,width:0}));p.enable(viewport);
  const first=p.observe(sample(0),0,pointerOnly);assert.deepEqual(first.rawPoint,{x:200,y:200});assert.deepEqual(first.smoothedPoint,first.rawPoint);assert.equal(first.stabilizedPoint,null);
  for(let t=150;t<=600;t+=150)p.observe(sample(t),t,pointerOnly);
  assert.deepEqual(p.snapshot(600).stabilizedPoint,{x:200,y:200});assert.equal(p.snapshot(600).candidateTargetId,null);
  p.disable();hidden(p.snapshot(600));assert.equal(p.snapshot(600).validUntilMs,null);
});

test('EMA display is bounded by accepted positions and never determines the target hit',()=>{
  const p=new GazePointer();p.enable(viewport);acquire(p);
  const moved=p.observe(sample(750,800,200),750,sandbox);
  assert.deepEqual(moved.rawPoint,{x:800,y:200});assert.deepEqual(moved.smoothedPoint,{x:620,y:200});
  assert.equal(moved.candidateTargetId,null);assert.equal(moved.sampleCount,1);assert.equal(moved.stabilizedPoint,null);
  const gap=p.observe(sample(900,500,200),900,sandbox);
  assert.equal(gap.reason,'edge-or-gap');assert.equal(gap.candidateTargetId,null);assert.ok(gap.smoothedPoint!.x>500 && gap.smoothedPoint!.x<620);
});

test('four targets require actual inset direct hits with edges, gaps and viewport limits abstaining',()=>{
  for(const [x,y,id] of [[200,200,'phrases'],[800,200,'spell'],[200,600,'back'],[800,600,'scroll']] as const)assert.equal(pointerTargetAtPoint({x,y},sandbox),id);
  for(const point of [{x:40,y:200},{x:52,y:200},{x:448,y:200},{x:200,y:52},{x:200,y:328},{x:500,y:200},{x:200,y:380},{x:-1,y:200},{x:1000,y:200},{x:200,y:800},{x:NaN,y:200}])assert.equal(pointerTargetAtPoint(point,sandbox),null);
  assert.equal(pointerTargetAtPoint({x:52.001,y:200},sandbox),'phrases');
});

test('invalid, overlapping, partly hidden or non-four target layouts cannot produce pointer or candidates',()=>{
  const invalid:GazePointerLayout[]=[
    {...sandbox,targets:sandbox.targets.slice(0,3)},
    {...sandbox,targets:sandbox.targets.map(t=>t.id==='phrases'?{...t,id:'other' as typeof t.id}:t)},
    {...sandbox,targets:sandbox.targets.map(t=>t.id==='phrases'?{...t,width:600}:t)},
    {...sandbox,targets:sandbox.targets.map(t=>t.id==='phrases'?{...t,top:-1}:t)},
    {...sandbox,targets:sandbox.targets.map(t=>t.id==='phrases'?{...t,width:24}:t)},
  ];
  for(const layout of invalid){const p=new GazePointer();p.enable(viewport);const s=p.observe(sample(0),0,layout);hidden(s);assert.equal(s.reason,'invalid-layout');}
});

test('raw stable target history requires six hundred milliseconds, five samples and full two-dimensional dispersion',()=>{
  const p=new GazePointer();p.enable(viewport);
  for(let t=0;t<600;t+=150){const s=p.observe(sample(t),t,sandbox);assert.equal(s.candidateTargetId,null);assert.equal(s.stabilizedPoint,null);}
  const stable=p.observe(sample(600),600,sandbox);assert.equal(stable.candidateTargetId,'phrases');assert.deepEqual(stable.stabilizedPoint,{x:200,y:200});assert.equal(stable.sampleCount,5);
  p.reset(1000);
  for(let i=0;i<12;i++){const t=1000+i*150;assert.equal(p.observe(sample(t,200,i%2?320:60),t,sandbox).candidateTargetId,null);}
  assert.equal(p.snapshot(2650).reason,'dispersed');assert.equal(p.snapshot(2650).stabilizedPoint,null);
  p.reset(3000);
  for(const t of [3000,3300,3600])assert.equal(p.observe(sample(t),t,sandbox).candidateTargetId,null);
});

test('target switch clears the previous candidate immediately and requires eight hundred milliseconds',()=>{
  const p=new GazePointer();p.enable(viewport);assert.equal(acquire(p).candidateTargetId,'phrases');
  for(let t=750;t<1550;t+=100)assert.equal(p.observe(sample(t,800,200),t,sandbox).candidateTargetId,null);
  assert.equal(p.observe(sample(1550,800,200),1550,sandbox).candidateTargetId,'spell');
  p.observe(sample(1700,500,200),1700,sandbox);
  for(let t=1850;t<2650;t+=100)assert.equal(p.observe(sample(t),t,sandbox).candidateTargetId,null);
  assert.equal(p.observe(sample(2650),2650,sandbox).candidateTargetId,'phrases');
});

test('worker rejection, face loss, invalid coordinates and stale arrival hide every point immediately',()=>{
  for(const rejected of [null,{...sample(750),faceDetected:false},sample(750,NaN),sample(750,-1),sample(750,1000),sample(750,200,800),sample(751)]){
    const p=new GazePointer();p.enable(viewport);acquire(p);hidden(p.observe(rejected,750,sandbox));
  }
  const p=new GazePointer();p.enable(viewport);acquire(p);hidden(p.observe(sample(750),1101,sandbox));assert.equal(p.snapshot(1101).reason,'stale');
});

test('independent polling expires visible points at three hundred fifty milliseconds without poisoning contiguous pending inference',()=>{
  const p=new GazePointer();p.enable(viewport);
  p.observe(sample(0),150,sandbox);p.observe(sample(300),450,sandbox);
  hidden(p.snapshot(651));assert.equal(p.snapshot(651).reason,'stale');
  const next=p.observe(sample(600),750,sandbox);assert.equal(next.sampleCount,3);assert.notEqual(next.rawPoint,null);
  p.observe(sample(900),1050,sandbox);hidden(p.snapshot(1251));
  assert.equal(p.observe(sample(1200),1350,sandbox).candidateTargetId,'phrases');
  hidden(p.snapshot(1551));assert.equal(p.snapshot(1551).candidateTargetId,null);
  hidden(p.snapshot(2401));assert.equal(p.snapshot(2401).sampleCount,0);
});

test('real capture gaps and rejected frames cannot bridge earlier history or smooth from an old position',()=>{
  const p=new GazePointer();p.enable(viewport);acquire(p);
  const gap=p.observe(sample(1000,800,200),1000,sandbox);assert.equal(gap.sampleCount,1);assert.deepEqual(gap.smoothedPoint,{x:800,y:200});assert.equal(gap.candidateTargetId,null);
  p.observe(null,1100,sandbox);const next=p.observe(sample(1200),1200,sandbox);assert.equal(next.sampleCount,1);assert.deepEqual(next.smoothedPoint,{x:200,y:200});
});

test('geometry polling hides a live candidate and rejects pre-change frames; viewport changes latch recalibration',()=>{
  const p=new GazePointer();p.enable(viewport);acquire(p);
  const moved={...sandbox,targets:sandbox.targets.map(t=>({...t,top:t.top+1}))};
  const changed=p.snapshot(700,moved);hidden(changed);assert.equal(changed.reason,'layout-changed');
  hidden(p.observe(sample(650),710,moved));assert.equal(p.snapshot(710).reason,'stale');
  assert.equal(acquire(p,800,200,200,moved).candidateTargetId,'phrases');
  const resized={...moved,viewport:{...viewport,key:'1000:800:2:1'}};
  hidden(p.snapshot(1450,resized));assert.equal(p.snapshot(1450).calibrationRequired,true);
  hidden(p.observe(sample(1500),1500,moved));p.reset(1600);assert.equal(p.snapshot(1600).calibrationRequired,true);
  p.enable(viewport);assert.equal(acquire(p,1700,200,200,moved).candidateTargetId,'phrases');
});

test('target-free to sandbox transition resets history, while target array ordering does not',()=>{
  const p=new GazePointer();p.enable(viewport);acquire(p,0,200,200,pointerOnly);
  hidden(p.observe(sample(750),750,sandbox));assert.equal(p.snapshot(750).reason,'layout-changed');
  acquire(p,900);const reordered=p.snapshot(1500,{...sandbox,targets:[...sandbox.targets].reverse()});assert.equal(reordered.candidateTargetId,'phrases');
});

test('resets, repeated samples and mutable callers cannot resurrect or alter a candidate',()=>{
  const p=new GazePointer();p.enable(viewport);acquire(p);p.reset(1000);hidden(p.observe(sample(900),1000,sandbox));
  const frame=sample(1100) as {x:number;y:number;capturedAt:number;faceDetected:boolean};p.observe(frame,1100,sandbox);frame.x=999;
  assert.equal(p.snapshot(1100).rawPoint!.x,200);hidden(p.observe(sample(1100),1100,sandbox));assert.equal(p.snapshot(1100).reason,'non-monotonic');
  assert.equal(gazePointerPolicy.stableMs,600);assert.equal(gazePointerPolicy.minSamples,5);assert.equal(gazePointerPolicy.dispersionPx,80);assert.equal(gazePointerPolicy.staleMs,350);
});


test('bounded pointer history cannot shortcut duration with high-frequency samples',()=>{
  const p=new GazePointer();p.enable(viewport);
  for(let t=0;t<2000;t+=10){const s=p.observe(sample(t),t,sandbox);assert.ok(s.sampleCount<=32);assert.equal(s.candidateTargetId,null);assert.equal(s.stabilizedPoint,null);}
  assert.equal(p.snapshot(1990).sampleCount,32);
});
