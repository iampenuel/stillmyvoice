import test from 'node:test';
import assert from 'node:assert/strict';
import { GazeDiagnostics, sampleDelay, viewportChanged } from '../src/gaze/gaze-diagnostics.mts';
import { GazeStability, type GazeSnapshot } from '../src/gaze/gaze-logic.mts';
import type { TrackerSample } from '../src/gaze/tracker-adapter.ts';
const viewport={key:'1000:800:2:1',width:1000,height:800};
const layout={viewport,regions:[{id:'Left',left:0,top:0,width:500,height:800},{id:'Right',left:500,top:0,width:500,height:800}]};
function sample():TrackerSample{return {face:true,point:{x:250,y:400},stored:0,inferenceMs:150,calibrated:true,headMoved:false,uncertain:false,requiresCalibration:false,
 diagnostics:{reason:'prediction-accepted',predictionOutcome:'in-viewport',predictionAttempted:true,rawPoint:{x:250,y:400},rawRange:null,
 faceDetected:true,poseValid:true,boxValid:true,blinking:false,headMoved:false,headMotion:null,frame:{width:640,height:480},
 calibrationFrame:{width:640,height:480},calibrationViewport:viewport,calibrationSamples:85,samplesPerPoint:Array(17).fill(5),detectMs:140,predictMs:10,totalMs:150}};}
test('resize event alone does not invalidate identical viewport; zoom and CSS geometry do',()=>{
 assert.equal(viewportChanged(null,viewport),false);assert.equal(viewportChanged(viewport,{...viewport}),false);
 assert.equal(viewportChanged(viewport,{...viewport,key:'1000:800:4:1'}),true);
 assert.equal(viewportChanged(viewport,{...viewport,height:700}),true);
});
test('sampling schedules start-to-start without adding inference latency or overlapping work',()=>{
 assert.equal(sampleDelay(1000,1040),110);assert.equal(sampleDelay(1000,1150),0);assert.equal(sampleDelay(1000,1400),0);
});
test('diagnostics distinguish detections, raw estimates and head-gate rejection without image data',()=>{
 const d=new GazeDiagnostics(), s=sample();s.point=null;s.headMoved=true;s.uncertain=true;s.diagnostics.reason='head-moved';s.diagnostics.headMoved=true;s.diagnostics.headMotion='rotation';
 d.observe(s,100,250,layout,null);const report=d.snapshot();
 assert.equal(report.validCameraFrames,1);assert.equal(report.successfulFaceDetections,1);assert.equal(report.finiteRawPredictions,1);
 assert.equal(report.acceptedPredictions,0);assert.equal(report.rawRegion,'Left');assert.equal(report.reasons['head-moved'],1);
 assert.equal(report.calibrationSamples,85);assert.deepEqual(report.samplesPerPoint,Array(17).fill(5));
 assert.doesNotMatch(JSON.stringify(report),/rawPoint|landmarks|imageData|boundingBox|yaw|pitch/);
});
test('each arriving prediction is counted once; stale, unstable and outside are distinct',()=>{
 const d=new GazeDiagnostics(),f=new GazeStability();f.enable(viewport);
 d.observe(sample(),1000,1150,layout,f.observe({...sample().point!,capturedAt:1000,faceDetected:true},1150,layout));
 d.observe(sample(),1300,1700,layout,f.observe({...sample().point!,capturedAt:1300,faceDetected:true},1700,layout));
 const outside=sample();outside.point=null;outside.diagnostics.rawPoint={x:1200,y:400};outside.diagnostics.predictionOutcome='outside-viewport';outside.diagnostics.reason='prediction-outside-viewport';
 d.observe(outside,1600,1750,layout,null);
 const report=d.snapshot();assert.equal(report.predictionsRejectedStale,1);assert.equal(report.predictionsNotYetStable,1);
 assert.equal(report.predictionsOutsideRegions,1);assert.equal(report.medianPredictionIntervalMs,300);assert.equal(report.medianInferenceMs,150);
 assert.deepEqual(d.snapshot(),report);assert.equal(report.validCameraFrames,3);
});
test('missing face does not count as a valid raw prediction',()=>{
 const d=new GazeDiagnostics(),s=sample();s.face=false;s.point=null;s.diagnostics.faceDetected=false;s.diagnostics.rawPoint=null;s.diagnostics.reason='face-missing';s.diagnostics.predictionOutcome='not-attempted';
 d.observe(s,100,250,layout,null);assert.equal(d.snapshot().successfulFaceDetections,0);assert.equal(d.snapshot().finiteRawPredictions,0);
});

function withPoint(x:number,y:number):TrackerSample {
 const value=sample();value.point={x,y};value.diagnostics.rawPoint={x,y};return value;
}
function filtered(overrides:Partial<GazeSnapshot>={}):GazeSnapshot {
 return {...new GazeStability().snapshot(0),reason:'collecting',status:'uncertain',...overrides};
}
test('raw distribution is run-scoped and ignores the worker lifetime range',()=>{
 const d=new GazeDiagnostics(),first=withPoint(100,200);
 first.diagnostics.rawRange={minX:-999,maxX:9999,minY:-888,maxY:8888,samples:55};
 d.observe(first,1000,1020,layout,null);d.observe(withPoint(300,400),1150,1170,layout,null);
 const report=d.snapshot();assert.deepEqual(report.rawRange,{minX:100,maxX:300,minY:200,maxY:400,samples:2});
 assert.equal(report.rawCoordinateDistribution.x.mean,200);assert.equal(report.rawCoordinateDistribution.x.standardDeviation,100);
 assert.equal(report.rawCoordinateDistribution.y.mean,300);assert.equal(report.rawRegionCounts.Left,2);
 assert.equal(new GazeDiagnostics().snapshot().rawRange,null);assert.deepEqual(report.heldOutTrials,[]);
});
test('held-out target checks exclude orientation and compare raw predictions with actual target rectangles',()=>{
 const d=new GazeDiagnostics();
 const targetLayout={viewport,regions:[{id:'Left',left:0,top:100,width:500,height:600},{id:'Right',left:600,top:100,width:400,height:600}]};
 const context={trial:1,promptedRegion:'Left',targetPoint:{x:250,y:400},eligible:false};
 d.observe(withPoint(-5000,-5000),1000,1020,targetLayout,null,context);
 context.eligible=true;
 d.observe(withPoint(250,400),1150,1170,targetLayout,filtered({reason:'stable',status:'tracking',regionId:'Left'}),context);
 d.observe(withPoint(750,400),1300,1320,targetLayout,filtered({reason:'stable',status:'tracking',regionId:'Right'}),context);
 d.observe(withPoint(250,50),1450,1470,targetLayout,filtered({reason:'outside-regions'}),context);
 const left=d.snapshot().heldOutTrials[0];
 assert.equal(left.observedFrames,4);assert.equal(left.orientationFrames,1);assert.equal(left.eligibleFrames,3);
 assert.equal(left.finiteRawPredictions,3);assert.equal(left.rawInsidePromptedRegion,1);assert.equal(left.rawInsideOtherRegion,1);
 assert.equal(left.rawOutsideRegions,1);assert.equal(left.rawOutsideViewport,0);
 assert.equal(left.stableCorrectFrames,1);assert.equal(left.stableIncorrectFrames,1);assert.equal(left.filteredAbstentionFrames,1);
 assert.deepEqual(left.directions,{inside:1,left:0,right:1,above:1,below:0});
 assert.equal(left.distanceOutsideTargetBoxPx.max,250);
 assert.ok(Math.abs(left.errorXPx.mean!-500/3)<1e-9);assert.ok(Math.abs(left.errorYPx.mean!+350/3)<1e-9);
 assert.ok(Math.abs(left.distanceFromTargetPx.rootMeanSquare!-Math.sqrt((500**2+350**2)/3))<1e-9);
 assert.equal(left.filterReasons.stable,2);assert.equal(left.filterReasons['outside-regions'],1);
 // A second prompt stays separate while per-region aggregation also remains available.
 d.observe(withPoint(800,400),1600,1620,targetLayout,null,{trial:2,promptedRegion:'Right',targetPoint:{x:800,y:400},eligible:true});
 assert.equal(d.snapshot().heldOutTrials.length,2);assert.equal(d.snapshot().heldOutTargets.length,2);
 assert.equal(d.snapshot().heldOutTrials[1].distanceFromTargetPx.max,0);
});
test('held-out failed detections remain in the eligible denominator without inventing coordinates',()=>{
 const d=new GazeDiagnostics(),missing=sample();missing.face=false;missing.point=null;
 missing.diagnostics.rawPoint=null;missing.diagnostics.reason='face-missing';
 d.observe(missing,1000,1020,layout,filtered({reason:'no-prediction',status:'lost'}),{trial:1,promptedRegion:'Left',targetPoint:{x:250,y:400},eligible:true});
 const report=d.snapshot().heldOutTrials[0];
 assert.equal(report.eligibleFrames,1);assert.equal(report.finiteRawPredictions,0);assert.equal(report.filteredAbstentionFrames,1);
 assert.equal(report.distanceFromTargetPx.count,0);assert.equal(report.distanceFromTargetPx.mean,null);
 assert.equal(report.workerReasons['face-missing'],1);
});
test('filter arrival reasons, polling reasons, resets and dispersion use separate denominators',()=>{
 const d=new GazeDiagnostics();
 d.observe(sample(),1000,1020,layout,filtered({sampleCount:5,dispersionPx:20}));
 d.observe(sample(),1150,1170,layout,filtered({reason:'dispersed',sampleCount:6,dispersionPx:140}));
 d.observe(sample(),1300,1320,layout,filtered({reason:'outside-regions',sampleCount:0}));
 d.observeFilterPoll(filtered({reason:'stale'}));d.observeFilterPoll(filtered({reason:'stale'}));
 d.recordReset('orientation-complete');
 const report=d.snapshot();
 assert.equal(report.validCameraFrames,3);assert.equal(report.predictionsRejectedStale,0);
 assert.deepEqual(report.filterReasons,{collecting:1,dispersed:1,'outside-regions':1});
 assert.deepEqual(report.filterPollReasons,{stale:2});assert.deepEqual(report.filterResets,{'orientation-complete':1});
 assert.equal(report.filterHistoryDrops['outside-regions'],1);assert.equal(report.filterReasonTransitions['collecting → dispersed'],1);
 assert.equal(report.filterDispersionPx.max,140);assert.equal(report.filterDispersionPx.p95,140);
});
test('timing records capture, inference, arrival and UI updates independently with bounded quantiles',()=>{
 const d=new GazeDiagnostics();
 for(let i=0;i<130;i++) {
  const value=sample();value.inferenceMs=i===0?999:20;
  const capture=1000+i*150;d.observe(value,capture,capture+30,layout,null);d.recordReadout(capture,capture+45);
 }
 const timing=d.snapshot().timing;
 assert.equal(timing.captureIntervalMs.count,129);assert.equal(timing.captureIntervalMs.median,150);
 assert.equal(timing.inferenceMs.count,130);assert.equal(timing.inferenceMs.max,999);
 assert.equal(timing.inferenceMs.p95,20);assert.equal(timing.inferenceMs.quantileSampleCount,120);
 assert.equal(timing.arrivalLatencyMs.median,30);assert.equal(timing.readoutUpdateLatencyMs.median,45);
 assert.equal(timing.readoutUpdateLatencyMs.count,130);
});
test('reported geometry is copied and detects actual target movement without modifying the filter',()=>{
 const d=new GazeDiagnostics();const moving={viewport:{...viewport},regions:layout.regions.map(region=>({...region}))};
 d.observe(sample(),1000,1020,moving,null);moving.regions[0].top=100;
 d.observe(sample(),1150,1170,moving,null);const report=d.snapshot();
 assert.equal(report.geometryChanges,1);assert.equal(report.geometry!.regions[0].top,0);assert.equal(report.lastGeometry!.regions[0].top,100);
 (report.lastGeometry!.regions[0] as {top:number}).top=999;
 assert.equal(d.snapshot().lastGeometry!.regions[0].top,100);
 assert.doesNotMatch(JSON.stringify(report),/rawPoint|landmarks|imageData|boundingBox|yaw|pitch/);
});

test('horizontal diagnostics separate band mapping from DOM rectangles and worker acceptance',()=>{
 const d=new GazeDiagnostics();
 const bands={viewport,classification:'horizontal-bands' as const,regions:[
  {id:'Left',left:20,top:200,width:450,height:400},{id:'Right',left:550,top:200,width:430,height:400}]};
 const target={trial:1,promptedRegion:'Right',targetPoint:{x:765,y:400},eligible:true};
 d.observe(withPoint(750,100),1000,1020,bands,null,target); // Right band, above both DOM boxes.
 d.observe(withPoint(450,300),1150,1170,bands,null,target); // Inside Left box, central dead zone.
 const offscreen=withPoint(1050,300);offscreen.point=null;offscreen.diagnostics.reason='prediction-outside-viewport';
 d.observe(offscreen,1300,1320,bands,null,target);
 const headRejected=withPoint(250,300);headRejected.point=null;headRejected.diagnostics.reason='head-moved';
 d.observe(headRejected,1450,1470,bands,null,target);
 const report=d.snapshot();
 assert.equal(report.classification,'horizontal-bands');assert.equal(report.geometry!.classification,'horizontal-bands');
 assert.equal(report.rawMapping.predictions,4);assert.equal(report.rawMapping.mapped,2);
 assert.deepEqual(report.rawMapping.reasons,{region:2,'central-dead-zone':1,'outside-viewport':1});
 assert.deepEqual(report.rawMapping.regionCounts,{Right:1,Left:1});
 assert.equal(report.rawMapping.rectangleComparison.inside,2);assert.equal(report.rawMapping.rectangleComparison.outside,2);
 assert.equal(report.rawMapping.rectangleComparison.mappedOutsideRectangles,1);
 assert.equal(report.rawMapping.rectangleComparison.rectangleInsideButUnmapped,1);
 assert.equal(report.acceptedMapping.predictions,2);assert.equal(report.acceptedMapping.mapped,1);
 assert.deepEqual(report.acceptedMapping.reasons,{region:1,'central-dead-zone':1});
 assert.deepEqual(report.acceptedMapping.regionCounts,{Right:1}); // Rejected raw Left never becomes accepted.
 assert.equal(report.acceptedMapping.rectangleComparison.mappedOutsideRectangles,1);
 const held=report.heldOutTrials[0];
 assert.equal(held.classification,'horizontal-bands');assert.equal(held.targetErrorGeometry,'dom-target-center-and-rectangle');
 assert.equal(held.rawInsidePromptedRegion,1);assert.equal(held.directions.above,1);
 assert.equal(held.acceptedMapping.predictions,2);
});
test('both horizontal central boundaries remain separately diagnosed as uncertain',()=>{
 const d=new GazeDiagnostics(),bands={...layout,classification:'horizontal-bands' as const};
 d.observe(withPoint(400,400),1000,1020,bands,null);d.observe(withPoint(600,400),1150,1170,bands,null);
 const report=d.snapshot();assert.equal(report.rawMapping.reasons['central-dead-zone'],2);
 assert.equal(report.acceptedMapping.reasons['central-dead-zone'],2);assert.equal(report.acceptedMapping.mapped,0);
 assert.equal(report.rawMapping.rectangleComparison.inside,2);
});

test('unobserved diagnostics do not claim a policy and property order is not a geometry change',()=>{
 const d=new GazeDiagnostics();assert.equal(d.snapshot().classification,null);
 d.observe(sample(),1000,1020,{classification:'horizontal-bands',...layout},null);
 d.observe(sample(),1150,1170,{...layout,classification:'horizontal-bands'},null);
 assert.equal(d.snapshot().geometryChanges,0);assert.equal(d.snapshot().classification,'horizontal-bands');
});
