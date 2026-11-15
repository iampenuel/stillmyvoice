// SPDX-License-Identifier: AGPL-3.0-or-later
import { useEffect, useRef, useState } from 'react';
import { createCameraSession, type CameraSession } from './camera-session.mts';
import { RealEyeTrackerAdapter } from './tracker-adapter';
import { GazePointer, type GazePointerSnapshot, type GazePointerTarget } from './gaze-pointer.mts';
import { viewportChanged, sampleDelay } from './gaze-diagnostics.mts';
import type { GazePoint, GazeViewport } from './gaze-logic.mts';
import type { GazeNomination } from '../communication/input-coordinator.mts';
import './main-gaze.css';
export type MainGazeLayout = { viewId:string;revision:number;targets:readonly GazePointerTarget<string>[] };
export type MainGazeHandle = { read:()=>GazeNomination|null; stop:()=>void };
type Props = { layout:()=>MainGazeLayout; register:(handle:MainGazeHandle|null)=>void; candidate:(id:string|null)=>void; leave:()=>void };
const viewport=():GazeViewport=>({width:innerWidth,height:innerHeight,key:[innerWidth,innerHeight,devicePixelRatio,visualViewport?.width??innerWidth,visualViewport?.height??innerHeight,visualViewport?.scale??1,visualViewport?.offsetLeft??0,visualViewport?.offsetTop??0].join(':')});
type Calibration={points:GazePoint[];index:number;since:number;accepted:number;training:boolean};
/** Main-app local camera/pointer only. It returns nominations, never model actions or speech approval. */
export function MainGaze(props:Props) {
  const latest=useRef(props);latest.current=props;
  const video=useRef<HTMLVideoElement>(null), dialog=useRef<HTMLDialogElement>(null);
  const session=useRef<CameraSession|null>(null), mounted=useRef(false);
  const r=useRef({generation:0,tracker:null as RealEyeTrackerAdapter|null,canvas:null as HTMLCanvasElement|null,timer:null as ReturnType<typeof setTimeout>|null,pending:null as Promise<unknown>|null,
    pointer:new GazePointer<string>(true),points:[] as GazePoint[],calibration:null as Calibration|null,viewport:null as GazeViewport|null,
    calibrated:false,face:false,lastCapture:0,viewKey:'',candidate:null as string|null,geometryAt:0,geometryKey:''});
  const [status,setStatus]=useState('Camera off'),[phase,setPhase]=useState<'off'|'starting'|'ready'|'calibrating'|'tracking'>('off');
  const [face,setFace]=useState(false),[point,setPoint]=useState<GazePoint|null>(null),[progress,setProgress]=useState(0),[snapshot,setSnapshot]=useState<GazePointerSnapshot<string>|null>(null);
  const [settled,setSettled]=useState(false);
  const publish=(next:GazePointerSnapshot<string>)=>{if(mounted.current)setSnapshot(next);if(r.current.candidate!==next.candidateTargetId){r.current.candidate=next.candidateTargetId;latest.current.candidate(next.candidateTargetId);}};
  const layout=()=>{
    const app=latest.current.layout(),key=app.viewId+':'+app.revision;
    if(r.current.viewKey!==key){r.current.viewKey=key;r.current.pointer.reset(performance.now());}
    return {app,pointer:{viewport:viewport(),targets:app.targets}};
  };
  const read=():GazeNomination|null=>{
    const state=r.current;if(!state.calibrated || document.visibilityState!=='visible' || !document.hasFocus())return null;
    const current=layout(), value=state.pointer.snapshot(performance.now(),current.pointer);
    return value.candidateTargetId && value.validUntilMs!==null ? {targetId:value.candidateTargetId,viewId:current.app.viewId,revision:current.app.revision,validUntilMs:value.validUntilMs}:null;
  };
  const release=(expected?:RealEyeTrackerAdapter)=>{
    const state=r.current;if(expected&&state.tracker!==expected)return;state.generation++;if(state.timer)clearTimeout(state.timer);state.timer=null;
    state.tracker?.dispose();state.tracker=null;state.pending=null;state.calibration=null;state.calibrated=false;state.face=false;state.viewport=null;state.pointer.disable();
    if(video.current){video.current.pause();video.current.srcObject=null;}
    if(state.canvas){state.canvas.width=0;state.canvas.height=0;}state.canvas=null;
    if(state.candidate!==null){state.candidate=null;latest.current.candidate(null);}
    if(mounted.current){setSnapshot(null);setPoint(null);setFace(false);setPhase('off');}
    dialog.current?.close();
  };
  const stop=(reason='Camera off. Switch-only communication is available.')=>{release();session.current?.stop();if(mounted.current)setStatus(reason);};
  const geometry=()=>{
    const current=viewport(),state=r.current,now=performance.now();
    if(state.geometryKey!==current.key){state.geometryKey=current.key;state.geometryAt=now;}
    if(mounted.current)setSettled(now-state.geometryAt>=2000);
    if(state.tracker && viewportChanged(state.viewport,current)){stop('Window or zoom changed. Start again and recalibrate.');return false;}
    return true;
  };
  const schedule=(generation:number)=>{const state=r.current;if(generation===state.generation&&state.tracker&&!state.timer&&!state.pending)state.timer=setTimeout(()=>void tick(generation),sampleDelay(state.lastCapture,performance.now(),150));};
  async function tick(generation:number){
    const state=r.current,tracker=state.tracker,element=video.current;state.timer=null;
    if(generation!==state.generation||!tracker||!element)return;
    if(document.visibilityState!=='visible'){stop('Camera stopped because this page is hidden.');return;}
    if(!geometry())return;
    if(element.readyState<2||!element.videoWidth||!element.videoHeight){state.lastCapture=performance.now();schedule(generation);return;}
    try{
      const canvas=state.canvas??=document.createElement('canvas');canvas.width=element.videoWidth;canvas.height=element.videoHeight;
      const context=canvas.getContext('2d',{willReadFrequently:true});if(!context)throw Error();
      context.drawImage(element,0,0,canvas.width,canvas.height);const image=context.getImageData(0,0,canvas.width,canvas.height),capturedAt=performance.now();state.lastCapture=capturedAt;
      const calibration=state.calibration,target=calibration&&!calibration.training&&capturedAt-calibration.since>=1400?calibration.points[calibration.index]:undefined;
      const pending=tracker.sample(image,target);state.pending=pending;const result=await pending;
      if(generation!==state.generation)return;state.pending=null;
      if(document.visibilityState!=='visible'){stop('Camera stopped because this page is hidden.');return;}
      if(!geometry())return;
      if(result.requiresCalibration){stop('Camera dimensions changed. Start again and recalibrate.');return;}
      state.face=result.face;setFace(result.face);
      if(calibration){
        if(target&&result.stored>calibration.accepted){
          calibration.accepted=result.stored;setProgress(result.stored);
          if(result.stored>=(calibration.index+1)*5){
            calibration.index++;calibration.since=performance.now();
            if(calibration.index===calibration.points.length){
              calibration.training=true;setPoint(null);setStatus('Fitting calibration…');
              const training=tracker.calibrate();state.pending=training;const fit=await training;
              if(generation!==state.generation)return;state.pending=null;
              if(document.visibilityState!=='visible'){stop('Camera stopped because this page is hidden.');return;}
              if(!geometry())return;
              if(fit.samples!==state.points.length*5||fit.samplesPerPoint.some(n=>n<5))throw Error();
              state.calibration=null;state.calibrated=true;state.pointer.enable(viewport());state.viewKey='';
              dialog.current?.close();setPhase('tracking');setStatus('Experimental gaze active. Look to focus; press and release to choose.');
            }else setPoint(calibration.points[calibration.index]);
          }
        }
      }else if(state.calibrated){
        const accepted=result.face&&result.point&&!result.headMoved&&!result.uncertain&&result.calibrated?{...result.point,capturedAt,faceDetected:true}:null;
        publish(state.pointer.observe(accepted,performance.now(),layout().pointer));
      }
    }catch{if(generation===state.generation)stop('Local gaze tracking failed. Camera off; switch-only remains available.');return;}
    schedule(generation);
  }
  useEffect(()=>{
    mounted.current=true;
    const controller=createCameraSession({
      getStream:()=>navigator.mediaDevices.getUserMedia({audio:false,video:{width:{ideal:640},height:{ideal:480},facingMode:'user'}}),
      initialize:async(stream,signal)=>{
        const state=r.current,tracker=new RealEyeTrackerAdapter();state.tracker=tracker;
        const abort=()=>release(tracker);signal.addEventListener('abort',abort,{once:true});
        try{
          if(!video.current)throw Error();video.current.srcObject=stream;await video.current.play();signal.throwIfAborted();
          const vp=viewport();state.viewport=vp;const initialized=await tracker.initialize(vp);signal.throwIfAborted();
          if(viewportChanged(vp,viewport()))throw Error();state.points=initialized.points;
          return()=>{signal.removeEventListener('abort',abort);release(tracker);};
        }catch(error){signal.removeEventListener('abort',abort);release(tracker);throw error;}
      },
      onStateChange:state=>{if(state.phase==='unavailable'){release();if(mounted.current)setStatus('Camera unavailable ('+state.error+'). Switch-only remains available.');}},timeoutMs:45000,
    });session.current=controller;
    latest.current.register({read,stop:()=>stop()});
    const hidden=()=>{if(document.visibilityState!=='visible')stop('Camera stopped because this page is hidden.');};
    const exiting=()=>stop('Camera stopped.');
    document.addEventListener('visibilitychange',hidden);window.addEventListener('pagehide',exiting);
    const poll=setInterval(()=>{if(!geometry())return;const state=r.current;if(state.calibrated){const next=state.pointer.snapshot(performance.now(),layout().pointer);publish(document.hasFocus()?next:{...next,smoothedPoint:null,candidateTargetId:null});}},50);
    return()=>{mounted.current=false;clearInterval(poll);latest.current.register(null);release();controller.stop();document.removeEventListener('visibilitychange',hidden);window.removeEventListener('pagehide',exiting);};
  },[]);
  async function start(){
    if(!session.current||!['off','unavailable'].includes(session.current.state().phase))return;
    setPhase('starting');setStatus('Starting local camera. No microphone is requested.');
    await session.current.start();if(!mounted.current)return;
    if(session.current.state().phase==='ready'){setPhase('ready');setStatus('Keep your head steady. Start calibration when your face is detected.');schedule(r.current.generation);}
  }
  async function calibrate(){
    const state=r.current;if(!state.tracker||!state.face||!geometry()||performance.now()-state.geometryAt<2000)return;
    state.generation++;const generation=state.generation;if(state.timer)clearTimeout(state.timer);state.timer=null;
    setPhase('calibrating');setStatus('Follow each point with your eyes. Keep your head steady.');setProgress(0);
    try{
      await state.pending?.catch(()=>{});if(generation!==state.generation||!state.tracker)return;
      await state.tracker.reset();if(generation!==state.generation)return;state.pending=null;
      state.viewport=viewport();state.pointer.disable();state.calibration={points:state.points,index:0,since:performance.now(),accepted:0,training:false};
      setPoint(state.points[0]);dialog.current?.showModal();schedule(generation);
    }catch{if(generation===state.generation)stop('Calibration could not start. Camera off.');}
  }
  const pos=snapshot?.smoothedPoint;
  return <div className="main-gaze" aria-label="Experimental eye gaze">
    <video ref={video} muted playsInline className="main-gaze-video" aria-hidden="true" />
    <span>{status}{phase==='ready'?(face?' Face detected.':' Finding face…'):phase==='tracking'?' '+(snapshot?.candidateTargetId?'Target ready.':snapshot?.reason==='stale'||snapshot?.status==='lost'?'Tracking lost.':'No stable target.') :''}</span>
    {phase==='off'?<button type="button" className="compact-control" onClick={()=>void start()}>Start eye gaze</button>:null}
    {phase==='ready'?<button type="button" className="compact-control" disabled={!face||!settled} onClick={()=>void calibrate()}>Start calibration</button>:null}
    <button type="button" className="compact-control" onClick={()=>{stop();latest.current.leave();}}>Camera off · Switch-only</button>
    {pos?<div className="main-gaze-pointer" aria-hidden="true" style={{left:pos.x,top:pos.y}}><span /></div>:null}
    <dialog ref={dialog} className="main-gaze-calibration" aria-label="Eye gaze calibration" onCancel={event=>{event.preventDefault();stop('Calibration canceled. Camera off.');}}>
      <p>Follow the point · {progress}/85 samples · {face?'Face detected':'Finding face'}</p>
      <button type="button" onClick={()=>stop('Calibration canceled. Camera off.')}>Cancel calibration</button>
      {point?<span className="main-gaze-calibration-point" style={{left:point.x,top:point.y}} aria-hidden="true"/>:null}
    </dialog>
  </div>;
}
