import { useEffect, useRef, useState } from 'react';
import { createCameraSession } from './camera-session.mts';
import { RealEyeTrackerAdapter, type TrackerCalibration } from './tracker-adapter';
import { GazeStability, GazeTrialRun, type GazePoint, type GazeSnapshot, type GazeTrialResult, type GazeViewport } from './gaze-logic.mts';
import { GazeDiagnostics, viewportChanged, sampleDelay } from './gaze-diagnostics.mts';
import './gaze.css';

const viewport = (): GazeViewport => ({ width: innerWidth, height: innerHeight,
  key: [innerWidth, innerHeight, devicePixelRatio, visualViewport?.scale ?? 1].join(':') });
const TRIAL_MS = 4500, SETTLE_MS = 1400, SAMPLE_MS = 150;
type Calibration = { points: GazePoint[]; index: number; since: number; accepted: number; phase: 'collecting' | 'training' };
type Readout = { status: string; detail: string; camera: string; delegate: string; face: boolean; calibrated: boolean;
  calibrationPoint: GazePoint | null; calibrationIndex: number; captured: number; inferenceMs: number | null;
  snapshot: GazeSnapshot | null; diagnostics: ReturnType<GazeDiagnostics['snapshot']>; viewportChange: string | null; calibrationFit:TrackerCalibration|null; resultDiagnostics:ReturnType<GazeDiagnostics['snapshot']>|null; resultFit:TrackerCalibration|null; denominator: 6 | 30; trial: number; prompted: string | null; results: readonly GazeTrialResult[] };
const initial = (): Readout => ({ status:'Camera off', detail:'Camera use starts only when you choose Start eye gaze.',
  camera:'Off', delegate:'Not initialized', face:false, calibrated:false, calibrationPoint:null, calibrationIndex:0,
  captured:0, inferenceMs:null, snapshot:null, diagnostics:new GazeDiagnostics().snapshot(), viewportChange:null, calibrationFit:null,resultDiagnostics:null,resultFit:null,denominator:6, trial:0, prompted:null, results:[] });

/** Isolated feasibility route. No communication model, scanner, serial, AI or speech authority. */
export function GazeExperiment() {
  const [view, setView] = useState(initial);
  const [preview, setPreview] = useState(false);
  const video = useRef<HTMLVideoElement>(null);
  const calibrationDialog=useRef<HTMLDialogElement>(null);
  const left = useRef<HTMLDivElement>(null), right = useRef<HTMLDivElement>(null);
  const session = useRef<ReturnType<typeof createCameraSession> | null>(null);
  const runtime = useRef({ generation:0, timer:null as ReturnType<typeof setTimeout> | null,
    tracker:null as RealEyeTrackerAdapter | null, canvas:null as HTMLCanvasElement | null,
    pending:null as Promise<unknown> | null, points:[] as GazePoint[], calibration:null as Calibration | null,
    calibrated:false, calibrating:false, calibrationViewport:null as GazeViewport | null, filter:new GazeStability(),
    run:null as GazeTrialRun | null, trialStarted:0, trialSettled:false, lastUi:0, face:false, diagnostics:new GazeDiagnostics(), lastCaptureAt:0, calibrationFit:null as TrackerCalibration|null });
  const mounted = useRef(true);
  const update = (patch: Partial<Readout>) => { if (mounted.current) setView(old=>({...old,...patch})); };
  const clearLoop = () => { const r=runtime.current; r.generation++; if(r.timer)clearTimeout(r.timer); r.timer=null; };
  const release = (expected?:RealEyeTrackerAdapter) => {
    const r=runtime.current;if(expected&&r.tracker!==expected)return; clearLoop(); r.tracker?.dispose(); r.tracker=null; r.pending=null;
    r.calibration=null; r.calibrating=false; r.calibrated=false; r.calibrationViewport=null; r.filter.disable(); r.face=false;
    if(r.run) { try{r.run.finish(performance.now());}catch{/* no active trial */} update({results:r.run.records(),resultDiagnostics:r.diagnostics.snapshot(),resultFit:r.calibrationFit}); r.run=null; }
    if(video.current){video.current.pause();video.current.srcObject=null;}
    if(r.canvas){r.canvas.width=0;r.canvas.height=0;}r.canvas=null;
    update({calibrated:false,calibrationPoint:null,prompted:null,snapshot:null,face:false,camera:'Off',diagnostics:r.diagnostics.snapshot()});
  };
  const stop = (detail='Camera stopped. Calibration frames and model state were discarded.') => {
    session.current?.stop(); release(); update({status:'Camera off',detail});
  };
  const fail = (detail:string) => { stop(detail); update({status:'Gaze unavailable',detail}); };
  const regions = () => [left,right].map((ref,i)=>{
    const b=ref.current?.getBoundingClientRect();
    return {id:i===0?'Left':'Right',left:b?.left??0,top:b?.top??0,width:b?.width??0,height:b?.height??0};
  });
  const schedule = (generation:number) => {
    const r=runtime.current;
    if(generation===r.generation&&r.tracker&&!r.timer&&!r.pending)r.timer=setTimeout(()=>void tick(generation),sampleDelay(r.lastCaptureAt,performance.now(),SAMPLE_MS));
  };
  async function tick(generation:number) {
    const r=runtime.current, tracker=r.tracker, element=video.current;
    if(generation!==r.generation||!tracker||!element)return;r.timer=null;
    if(document.visibilityState!=='visible'){stop('Camera stopped because this page is hidden.');return;}
    const currentViewport=viewport();
    if(checkViewport())return;
    advanceTrial(performance.now());
    if(element.readyState<2||!element.videoWidth||!element.videoHeight){r.lastCaptureAt=performance.now();schedule(generation);return;}
    const canvas=r.canvas??=document.createElement('canvas');
    canvas.width=element.videoWidth;canvas.height=element.videoHeight;
    const context=canvas.getContext('2d',{willReadFrequently:true});
    if(!context){fail('Camera frame capture is unavailable. Switch-only SMV remains available.');return;}
    try {
    context.drawImage(element,0,0,canvas.width,canvas.height);
    const frame=context.getImageData(0,0,canvas.width,canvas.height), capturedAt=performance.now();r.lastCaptureAt=capturedAt;
    const calibration=r.calibration;
    const target=calibration?.phase==='collecting' && capturedAt-calibration.since>=SETTLE_MS ? calibration.points[calibration.index] : undefined;
      const request=tracker.sample(frame,target);r.pending=request;const result=await request;
      if(generation!==r.generation)return;r.pending=null;r.face=result.face;advanceTrial(performance.now());
      if(result.requiresCalibration){r.diagnostics.observe(result,capturedAt,performance.now(),{viewport:currentViewport,regions:regions()},null);stop('Camera frame dimensions changed. Start again and recalibrate.');return;}
      if(calibration){
        r.diagnostics.observe(result,capturedAt,performance.now(),{viewport:currentViewport,regions:regions()},null);
        if(calibration.phase==='collecting'){
          if(target && result.stored>calibration.accepted){
            calibration.accepted=result.stored;update({captured:result.stored});
            if(result.stored>=(calibration.index+1)*5){
              calibration.index++;calibration.since=performance.now();
              if(calibration.index===calibration.points.length){
                calibration.phase='training';update({status:'Calibrating',calibrationPoint:null,detail:'Fitting the calibration. Stop remains available.'});
                const training=tracker.calibrate();r.pending=training;const trained=await training;
                if(generation!==r.generation)return;
                r.pending=null;r.calibration=null;r.calibrated=true;r.calibrationFit=trained;r.filter.enable(currentViewport);
                update({status:'Tracking uncertain',calibrated:true,calibrationFit:trained,calibrationPoint:null,detail:'Calibration fit completed with '+trained.samples+' face-present frames. Accuracy still needs the region test.'});
              }else update({calibrationPoint:calibration.points[calibration.index],calibrationIndex:calibration.index+1});
            }
          }
          if(r.calibration)update({status:'Calibrating',face:result.face,
            detail:result.face?'Look at the point. Timed capture checks face presence, not whether you are fixating.':'Face not detected. The current point will wait; reposition or stop and retry.'});
        }
      } else if(r.calibrated){
        const now=performance.now(), layout={viewport:currentViewport,regions:regions()};advanceTrial(now);
        let snapshot=r.filter.snapshot(now);
        const afterOrientation=!r.run||(r.trialSettled&&capturedAt>=r.trialStarted+SETTLE_MS);
        if(afterOrientation) {
          snapshot=r.filter.observe(result.face&&result.point?{...result.point,capturedAt,faceDetected:true}:null,now,layout);
          if(r.run)r.run.observe(snapshot,now);
        } else if(r.run&&capturedAt>=r.trialStarted) {
          // Orientation is intentionally unclassified. Only a genuine invalid result is a loss.
          r.run.observe({...snapshot,status:result.uncertain?'lost':'uncertain',regionId:null},now);
        }
        r.diagnostics.observe(result,capturedAt,now,layout,afterOrientation?snapshot:null);
        if(performance.now()-r.lastUi>=250){
          r.lastUi=performance.now();update({face:result.face,snapshot,diagnostics:r.diagnostics.snapshot(),inferenceMs:result.inferenceMs,
            status:snapshot.status==='tracking'?'Tracking':snapshot.status==='lost'?'Tracking lost':'Tracking uncertain',
            detail:r.run?'Look at the prompted region. Gaze does not select anything.':
              !result.face?'No face detected. No region is proposed.':result.headMoved?'Head position changed. No region is proposed.':'Region proposals use freshness and stability heuristics, not a confidence percentage.'});
        }
      }else {r.diagnostics.observe(result,capturedAt,performance.now(),{viewport:currentViewport,regions:regions()},null);update({face:result.face,diagnostics:r.diagnostics.snapshot(),status:result.face?'Ready to calibrate':'Finding face',
        detail:result.face?'Sit comfortably, keep your head steady, then start the timed 17-point calibration.':'Face not detected yet. Face the built-in camera in steady light.'});}
    }catch{
      if(generation===r.generation)fail('The local gaze tracker failed or timed out. Camera stopped; switch-only SMV is unchanged.');
      return;
    }
    schedule(generation);
  }
  function advanceTrial(now:number){
    const r=runtime.current;if(!r.run)return;
    if(now>=r.trialStarted+TRIAL_MS){
      r.run.finish(r.trialStarted+TRIAL_MS);update({results:r.run.records()});
      if(r.run.summary().completed===r.run.plan.length){const count=r.run.plan.length;update({resultDiagnostics:r.diagnostics.snapshot(),resultFit:r.calibrationFit});r.run=null;r.filter.reset(now);update({trial:count,prompted:null,diagnostics:r.diagnostics.snapshot(),detail:count+' trials complete. Every trial remains in the denominator.'});}
      else {const next=r.run.begin(now);r.trialStarted=now;r.trialSettled=false;r.filter.reset(now);update({trial:next.trial,prompted:next.promptedRegion});}
    }
    if(r.run&&!r.trialSettled&&now-r.trialStarted>=SETTLE_MS){r.trialSettled=true;r.filter.reset(now);}
  }
  function checkViewport(){
    const r=runtime.current, current=viewport();
    if(!r.tracker||!viewportChanged(r.calibrationViewport,current))return false;
    const previous=r.calibrationViewport!;
    update({viewportChange:previous.key+' → '+current.key});
    stop('Viewport geometry changed. Camera stopped; start again and recalibrate.');return true;
  }
  useEffect(()=>{
    mounted.current=true;
    const controller=createCameraSession({
      getStream:()=>navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},facingMode:'user'}}),
      initialize:async(stream,signal)=>{
        const tracker=new RealEyeTrackerAdapter();runtime.current.tracker=tracker;
        const abort=()=>release(tracker);signal.addEventListener('abort',abort,{once:true});
        try{
          const element=video.current;if(!element)throw Error('Video unavailable');
          element.srcObject=stream as MediaStream;await element.play();signal.throwIfAborted();
          const setupViewport=viewport();runtime.current.calibrationViewport=setupViewport;
          const setup=await tracker.initialize(setupViewport);signal.throwIfAborted();
          if(viewportChanged(setupViewport,viewport()))throw Error('Viewport changed during initialization');
          runtime.current.points=setup.points;
          const tracks=(stream as MediaStream).getVideoTracks();
          update({delegate:setup.delegate,camera:tracks[0]?.label||'Camera enabled',status:'Finding face',detail:'Video stays on this device; only local model assets are used.'});
          return ()=>{signal.removeEventListener('abort',abort);release(tracker);};
        }catch(error){signal.removeEventListener('abort',abort);release(tracker);throw error;}
      },
      onStateChange:state=>{
        if(state.phase==='starting')update({status:'Starting camera',detail:'Approve camera access if Chrome asks. No microphone is requested.'});
        if(state.phase==='initializing')update({status:'Starting camera',detail:'Loading the local eye tracker. Stop is available.'});
        if(state.phase==='unavailable'){release();update({status:'Gaze unavailable',detail:state.error==='permission_denied'?'Camera permission was denied. Allow it in Chrome, then choose Start eye gaze to retry.':state.error==='not_found'?'No suitable camera was found. Connect or enable the MacBook camera and retry.':state.error==='in_use'?'The camera is busy or could not open. Close other camera apps and retry.':state.error==='interrupted'?'The camera stream was interrupted. Camera stopped; choose Start eye gaze to retry.':'The local tracker could not initialize. Camera stopped; check local model assets and retry.'});}
      },
      timeoutMs:45000,
    });session.current=controller;
    const hidden=()=>{if(['starting','initializing','ready'].includes(controller.state().phase)&&document.visibilityState!=='visible')stop('Camera stopped because this page is hidden.');};
    const exiting=()=>stop('Camera stopped when leaving the experiment.');
    const changed=()=>{checkViewport();};
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',exiting);
    window.addEventListener('resize',changed);window.visualViewport?.addEventListener('resize',changed);
    const freshness=setInterval(()=>{
      const r=runtime.current;if(!r.calibrated)return;const now=performance.now();advanceTrial(now);
      const snapshot=r.filter.snapshot(now);
      if(r.run&&r.trialSettled)r.run.observe(snapshot,now);
      if(snapshot.status==='lost'&&now-r.lastUi>=100){r.lastUi=now;update({snapshot,status:'Tracking lost',detail:'No fresh stable estimate. Gaze proposes no region.',diagnostics:r.diagnostics.snapshot()});}
    },100);
    return ()=>{clearInterval(freshness);mounted.current=false;controller.stop();release();document.removeEventListener('visibilitychange',hidden);
      window.removeEventListener('pagehide',exiting);window.removeEventListener('resize',changed);window.visualViewport?.removeEventListener('resize',changed);};
    // The controller owns one explicit opt-in session. Current values live in refs.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  },[]);
  useEffect(()=>{const dialog=calibrationDialog.current;if(view.calibrationPoint&&dialog&&!dialog.open)dialog.showModal();},[!!view.calibrationPoint]);
  async function start(){
    if(session.current&&!['off','unavailable'].includes(session.current.state().phase))return;
    runtime.current.diagnostics=new GazeDiagnostics();runtime.current.lastCaptureAt=0;update({...initial(),results:view.results,resultDiagnostics:view.resultDiagnostics,resultFit:view.resultFit,denominator:view.denominator});setPreview(false);
    if(!navigator.mediaDevices?.getUserMedia){fail('This browser does not provide camera access. Use Chrome on localhost.');return;}
    await session.current?.start();
    if(session.current?.state().phase==='ready'){const generation=runtime.current.generation;schedule(generation);}
  }
  async function calibrate(){
    const r=runtime.current;if(!r.tracker||!r.face||r.calibrating||r.calibration)return;
    r.calibrating=true;r.calibrated=false;r.calibrationFit=null;update({status:'Calibrating',calibrated:false,detail:'Preparing timed calibration.'});
    clearLoop();const generation=r.generation;
    try{
      await r.pending?.catch(()=>{});if(generation!==r.generation||!r.tracker)return;
      const reset=r.tracker.reset();r.pending=reset;await reset;if(generation!==r.generation)return;r.pending=null;r.calibrating=false;
      r.calibrated=false;r.run=null;r.filter.disable();r.calibrationViewport=viewport();
      r.calibration={points:r.points,index:0,since:performance.now(),accepted:0,phase:'collecting'};
      setPreview(false);update({status:'Calibrating',calibrated:false,captured:0,calibrationFit:null,resultDiagnostics:null,resultFit:null,calibrationPoint:r.points[0],calibrationIndex:1,trial:0,prompted:null,results:[],snapshot:null});
      schedule(generation);
    }catch{if(generation===r.generation)fail('Calibration could not start. Stop and retry.');}
  }
  function startTrials(count:6|30){
    const r=runtime.current;if(!r.calibrated||r.run)return;
    setPreview(false);r.filter.reset(performance.now());r.run=new GazeTrialRun(['Left','Right'],Math.random,count);r.diagnostics=new GazeDiagnostics();
    const first=r.run.begin(performance.now());r.trialStarted=first.startedAt;r.trialSettled=false;
    update({denominator:count,trial:first.trial,prompted:first.promptedRegion,results:[],resultDiagnostics:null,resultFit:null,diagnostics:r.diagnostics.snapshot(),detail:'Look at the requested region. All '+count+' trials count, including abstentions.'});
  }
  function stopTrials(){
    const r=runtime.current;if(!r.run)return;
    r.run.finish(performance.now());update({results:r.run.records(),resultDiagnostics:r.diagnostics.snapshot(),resultFit:r.calibrationFit,prompted:null,detail:'Measurement stopped. Uncompleted trials are not reported as passed.'});r.run=null;r.filter.reset();
  }
  const summary={completed:view.results.length,denominator:view.denominator,correct:view.results.filter(x=>x.outcome==='correct').length,
    incorrect:view.results.filter(x=>x.outcome==='incorrect').length,abstained:view.results.filter(x=>x.outcome==='abstained').length,
    trackingLossEvents:view.results.reduce((n,x)=>n+x.trackingLossEvents,0)};
  const d=view.diagnostics;
  const ms=(value:number|null)=>value===null?'—':Math.round(value)+' ms';
  const active=!['Camera off','Gaze unavailable'].includes(view.status);
  return <div className="gaze-experiment" data-trial-active={!!view.prompted}>
    <header className="gaze-heading"><div><span className="wordmark">SMV</span><h1>Eye gaze <span className="gaze-tag">Experimental</span></h1></div>
      <p>Local camera feasibility check. Looking never clicks, selects, or speaks.</p></header>
    <section className="gaze-controls" aria-label="Eye gaze controls">
      <div className="gaze-actions">
        <button onClick={()=>void start()} disabled={active}>Start eye gaze</button>
        <button onClick={()=>void calibrate()} disabled={!active||!view.face||!!view.calibrationPoint||view.status==='Calibrating'}>{view.calibrated?'Recalibrate':'Start calibration'}</button>
        <button onClick={()=>startTrials(6)} disabled={!view.calibrated||!!view.prompted}>Start 6-trial diagnostic</button>
        <button onClick={()=>startTrials(30)} disabled={!view.calibrated||!!view.prompted}>Start 30-trial region test</button>
        {view.prompted?<button onClick={stopTrials}>Stop region test</button>:null}
        <button onClick={()=>stop()} disabled={!active}>Stop eye gaze</button>
      </div>
      <p role="status" aria-live="polite">{view.status}{view.status==='Calibrating'?' · Point '+view.calibrationIndex+' of 17 · '+view.captured+' / 85 frames':''}</p>
      <p className="small">{view.detail}</p>
      <dl className="gaze-readouts"><div><dt>Camera</dt><dd>{view.camera}</dd></div><div><dt>Inference</dt><dd>{view.delegate}</dd></div>
        <div><dt>Stable region</dt><dd>{view.snapshot?.regionId??'None'}</dd></div><div><dt>Sample age</dt><dd>{view.snapshot?.ageMs==null?'—':Math.round(view.snapshot.ageMs)+' ms'}</dd></div>
        <div><dt>Dispersion</dt><dd>{view.snapshot?.dispersionPx==null?'—':Math.round(view.snapshot.dispersionPx)+' px'}</dd></div></dl>
    </section>
    <div className="gaze-trial-prompt" aria-live="polite">{view.prompted?'Trial '+view.trial+' of '+view.denominator+' — Look '+view.prompted.toLowerCase():'Two broad test regions. No scanner integration is active.'}</div>
    <div className="gaze-estimates"><span>Raw region: <strong>{active?d.rawRegion??'None':'None'}</strong></span>
      <span>Stabilized region: <strong>{view.snapshot?.regionId??'None'}</strong></span><span>Filter: {view.snapshot?.reason??'Disabled'}</span></div>
    <div className="gaze-test-regions">
      <div ref={left} className="gaze-test-region" data-prompted={view.prompted==='Left'}><span>Left</span>{view.prompted==='Left'?<span className="gaze-fixation-static" aria-hidden="true"/>:null}</div>
      <div ref={right} className="gaze-test-region" data-prompted={view.prompted==='Right'}><span>Right</span>{view.prompted==='Right'?<span className="gaze-fixation-static" aria-hidden="true"/>:null}</div>
    </div>
    <section className="gaze-diagnostics" aria-label="Temporary gaze diagnostics"><h2>Local diagnostics</h2>
      <dl>
        <div><dt>Valid camera frames</dt><dd>{d.validCameraFrames}</dd></div>
        <div><dt>Successful face detections</dt><dd>{d.successfulFaceDetections}</dd></div>
        <div><dt>Finite raw predictions</dt><dd>{d.finiteRawPredictions}</dd></div>
        <div><dt>Raw predictions in viewport</dt><dd>{d.inViewportRawPredictions}</dd></div>
        <div><dt>Predictions rejected as stale</dt><dd>{d.predictionsRejectedStale}</dd></div>
        <div><dt>Predictions not yet stable</dt><dd>{d.predictionsNotYetStable}</dd></div>
        <div><dt>Predictions outside regions</dt><dd>{d.predictionsOutsideRegions}</dd></div>
        <div><dt>Median prediction interval</dt><dd>{ms(d.medianPredictionIntervalMs)}</dd></div>
        <div><dt>Median inference</dt><dd>{ms(d.medianInferenceMs)}</dd></div>
        <div><dt>Calibration</dt><dd>{view.calibrated?'Fitted, not accuracy-validated':active?'Not fitted':'Off / discarded'}</dd></div>
        <div><dt>Calibration samples</dt><dd>{d.calibrationSamples} / 85</dd></div>
        <div><dt>Camera frame</dt><dd>{d.frame}</dd></div>
      </dl>
      <p>Last frame: {d.lastReason}. Prediction: {d.lastPrediction}. Calibration viewport: {d.calibrationViewport} CSS px. Current viewport: {innerWidth} × {innerHeight}; pixel ratio: {devicePixelRatio}; zoom scale: {visualViewport?.scale??1}.
        {view.viewportChange?' Geometry changed: '+view.viewportChange+'.':''}</p>
      <details><summary>Diagnostic counters — no images</summary><pre>{JSON.stringify({counters:d,calibrationFit:view.calibrationFit},null,2)}</pre></details>
      <p>Counts reset at Start and at each trial run. “Tracking loss” includes stale or rejected estimates; it is not a face-loss count.</p>
    </section>
    <div className="gaze-camera-preview"><button onClick={()=>setPreview(p=>!p)} disabled={!active}>{preview?'Hide camera preview':'Show camera preview'}</button>
      <video ref={video} muted autoPlay playsInline hidden={!preview} aria-label="Local camera preview"/></div>
    {view.results.length&&!view.prompted?<section className="gaze-results"><h2>Measured results</h2>
      <p>{summary.correct}/{view.denominator} correct · {summary.incorrect} incorrect · {summary.abstained} abstained · {view.denominator-summary.completed} pending</p>
      <p>{summary.trackingLossEvents} tracking-loss events. {view.denominator===30?'Pilot goal: at least 27/30 correct.':'Six trials are diagnostic only, not acceptance.'} This is not clinical validation.</p>
      <details><summary>Trial records — no camera frames</summary><pre>{JSON.stringify({summary,diagnostics:view.resultDiagnostics,calibrationFit:view.resultFit,viewportChange:view.viewportChange,trials:view.results},null,2)}</pre></details></section>:null}
    <footer><p>Video frames and calibration stay in memory and are discarded when stopped. Measurement rows remain in this tab only.</p>
      <a href="/gaze/licenses/SMV-AGPL-3.0.txt">AGPL license</a><a href="/">Switch-only SMV</a></footer>
    {view.calibrationPoint?<dialog ref={calibrationDialog} className="gaze-calibration-layer" data-target-bottom={view.calibrationPoint.y>=innerHeight/2} aria-label="Timed calibration" onCancel={event=>{event.preventDefault();stop();}}>
      <p className="gaze-calibration-instruction" role="status">{view.face?'Look at the point':'Face not detected — this point will wait'} · {view.calibrationIndex}/17<br/><span>Keep your head steady. Samples advance automatically when a face is detected.</span></p>
      <div className="gaze-fixation" style={{left:view.calibrationPoint.x,top:view.calibrationPoint.y}} aria-hidden="true"/>
      <button className="gaze-calibration-stop" onClick={()=>stop()}>Stop eye gaze</button>
    </dialog>:null}
  </div>;
}
