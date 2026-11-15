import test from 'node:test';
import assert from 'node:assert/strict';
import { GazeDiagnostics, sampleDelay, viewportChanged } from '../src/gaze/gaze-diagnostics.mts';
import { GazeStability } from '../src/gaze/gaze-logic.mts';
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
