import test from 'node:test';
import assert from 'node:assert/strict';
import { InputCoordinator, type GazeInput, type GazeNomination } from '../src/communication/input-coordinator.mts';
import type { AdapterCallbacks, DataPort } from '../src/input/web-serial-adapter.mts';
import { GazePointer, pointerTargetAtPoint } from '../src/gaze/gaze-pointer.mts';
import { initialComposeModel } from './communication-fixture.mts';
import { choose,inputView,presented,type Model } from '../src/communication/model.mts';
async function harness(targets=['phrases','spell','back']) {
  let clock=100,enabled=true,candidate:GazeNomination|null={targetId:targets[1]??targets[0],viewId:'compose',revision:1,validUntilMs:450},visible=true,cb!:AdapterCallbacks,epoch='',seq=0,serial=0;
  const selected:string[]=[],port=new EventTarget() as DataPort;
  const controller=new InputCoordinator({id:'compose',revision:1,targets},{changed:()=>{},selected:s=>selected.push(s.targetId),interrupted:()=>{},targetVisible:()=>visible,gaze:():GazeInput=>({enabled,candidate}),now:()=>clock},async(_,__,callbacks)=>{
    cb=callbacks;epoch=cb.epoch('gaze-'+(++serial));let close!:()=>void;const closed=new Promise<void>(resolve=>{close=resolve;});return {closed,stop:()=>close()};
  },()=>true,()=> 'idle-'+(++serial),async()=>{});
  await controller.connect({requestPort:async()=>port},async()=>true);
  const edge=(type:'sync'|'down'|'up')=>cb.input(type==='sync'?{v:2,type,epoch,sequence:seq++,tick_ms:seq,pressed:false}:type==='down'?{v:2,type,epoch,sequence:seq++,tick_ms:seq}:{v:2,type,epoch,sequence:seq++,tick_ms:seq,downSequence:seq-2});
  edge('sync');
  return {controller,selected,edge,set:(change:{clock?:number;candidate?:GazeNomination|null;visible?:boolean;enabled?:boolean})=>{if(change.clock!==undefined)clock=change.clock;if('candidate'in change)candidate=change.candidate!;if(change.visible!==undefined)visible=change.visible;if(change.enabled!==undefined)enabled=change.enabled;}};
}
test('main gaze nominates through kernel ticks but selects only once after a genuine adapter DOWN/UP',async()=>{
  const h=await harness();h.controller.nominate();assert.equal(h.controller.state.index,1);
  for(let i=0;i<20;i++)h.controller.tick();assert.equal(h.controller.state.index,1);assert.deepEqual(h.selected,[]);
  h.edge('down');assert.equal(h.controller.state.capture?.targetId,'spell');h.controller.nominate();assert.deepEqual(h.selected,[]);
  h.edge('up');assert.deepEqual(h.selected,['spell']);h.controller.stop('done',false);
});
for(const reason of ['tracking-loss','stale','target-change','revision-change','occlusion','sample-gap','mode-change'] as const)test('held main gaze abstains on '+reason,async()=>{
  const h=await harness();h.controller.nominate();h.edge('down');const before=h.controller.state.index;
  h.set(reason==='tracking-loss'?{candidate:null}:reason==='stale'?{clock:451}:reason==='occlusion'?{visible:false}:reason==='mode-change'?{enabled:false}:reason==='sample-gap'?{clock:500,candidate:{targetId:'spell',viewId:'compose',revision:1,validUntilMs:850}}:{candidate:{targetId:reason==='target-change'?'back':'spell',viewId:'compose',revision:reason==='revision-change'?2:1,validUntilMs:450}});
  if(reason!=='mode-change')h.controller.nominate();
  assert.equal(h.controller.state.index,before,'held nomination never moves to another control');
  try{h.edge('up');}catch{/* retired adapter callback fails closed */}
  assert.deepEqual(h.selected,[]);assert.equal(h.controller.mode,'none');
});
test('a press without a stable nominated target cancels instead of selecting current scan index',async()=>{
 const h=await harness();h.set({candidate:null});try{h.edge('down');}catch{}assert.equal(h.controller.mode,'none');assert.deepEqual(h.selected,[]);
});
test('application pointer uses eligible dynamic targets without loosening sandbox or edge rules',()=>{
 const viewport={key:'app',width:1000,height:800},layout={viewport,targets:[{id:'row:abcde',left:20,top:20,width:300,height:80},{id:'speak',left:20,top:150,width:300,height:80}]};
 assert.equal(pointerTargetAtPoint({x:150,y:60},layout,true),'row:abcde');
 assert.equal(pointerTargetAtPoint({x:150,y:60},layout),null,'sandbox still requires its fixed four IDs');
 assert.equal(pointerTargetAtPoint({x:32,y:60},layout,true),null);assert.equal(pointerTargetAtPoint({x:150,y:110},layout,true),null);
 const pointer=new GazePointer<string>(true);pointer.enable(viewport);
 for(let t=0;t<=750;t+=150)pointer.observe({x:150,y:60,faceDetected:true,capturedAt:t},t,layout);
 assert.equal(pointer.snapshot(750,layout).candidateTargetId,'row:abcde');assert.equal(pointer.snapshot(1101,layout).candidateTargetId,null);
 pointer.reset(1200);assert.equal(pointer.snapshot(1200,layout).candidateTargetId,null);
});
test('gaze nominations cannot approve speech; review completion and a fresh physical cycle still authorize exact words',async()=>{
 let model=initialComposeModel('gaze-speech-test');model.draft='Please reposition me.';model.settings.voice='fixture';
 model=choose(model,'review',model.uiRevision);assert.equal(model.authorization,null);
 model=presented(model,model.revision,0,model.review!.pages[0]);
 const view=inputView(model);let cb!:AdapterCallbacks,epoch='',serial=0;
 const candidate={targetId:'speak',viewId:view.id,revision:view.revision,validUntilMs:450};
 const controller=new InputCoordinator(view,{changed:()=>{},interrupted:()=>{},selected:s=>{model=choose(model,s.targetId,s.revision);},gaze:()=>({enabled:true,candidate}),now:()=>100},async(_,__,callbacks)=>{cb=callbacks;epoch=cb.epoch('speech-'+(++serial));return{closed:Promise.resolve(),stop:()=>{}};},()=>true,()=> 'idle-'+(++serial),async()=>{});
 await controller.connect({requestPort:async()=>new EventTarget() as DataPort},async()=>true);
 cb.input({v:2,type:'sync',epoch,sequence:0,tick_ms:1,pressed:false});controller.nominate();assert.equal(model.authorization,null);
 cb.input({v:2,type:'down',epoch,sequence:1,tick_ms:2});assert.equal(model.authorization,null);
 cb.input({v:2,type:'up',epoch,sequence:2,downSequence:1,tick_ms:3});assert.equal((model as Model).authorization?.text,'Please reposition me.');controller.stop('done',false);
});
