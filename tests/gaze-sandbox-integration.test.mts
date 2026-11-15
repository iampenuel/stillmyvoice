import test from 'node:test';
import assert from 'node:assert/strict';
import { GazePointer, type GazePointerLayout, type GazePointerSnapshot } from '../src/gaze/gaze-pointer.mts';
import { GazeSandboxController } from '../src/gaze/gaze-sandbox.mts';
import type { InputMessage } from '../src/input/serial-protocol.mts';

// Synthetic accepted camera samples and mock adapter messages exercise the pure
// integration boundary. These are not camera, DOM, serial or physical-switch tests.
const viewport={key:'integration:1000:800:1',width:1000,height:800};
const layout:GazePointerLayout={viewport,targets:[
  {id:'phrases',left:40,top:40,width:420,height:300},{id:'spell',left:540,top:40,width:420,height:300},
  {id:'back',left:40,top:420,width:420,height:300},{id:'scroll',left:540,top:420,width:420,height:300},
]};
function fixture() {
  const pointer=new GazePointer(),controller=new GazeSandboxController('integration-initial');
  pointer.enable(viewport);
  const epoch=controller.connect('integration-port-one',0);
  controller.input({v:2,type:'sync',epoch,sequence:0,tick_ms:0,pressed:false},0);
  function publish(snapshot:GazePointerSnapshot,now:number) {
    return controller.updateGaze({
      candidate:snapshot.candidateTargetId && snapshot.validUntilMs!==null
        ? {targetId:snapshot.candidateTargetId,validUntilMs:snapshot.validUntilMs}:null,
      trackingValid:snapshot.rawPoint!==null,trackingValidUntilMs:snapshot.validUntilMs??0,
    },now);
  }
  function frame(now:number,x=200,y=200) {
    const snapshot=pointer.observe({x,y,capturedAt:now,faceDetected:true},now,layout);publish(snapshot,now);return snapshot;
  }
  function poll(now:number,currentLayout=layout) {const snapshot=pointer.snapshot(now,currentLayout);publish(snapshot,now);return snapshot;}
  function acquire(start=0,x=200,y=200){for(let t=start;t<=start+600;t+=150)frame(t,x,y);}
  function adapterMessage(type:'down'|'up',sequence:number,now:number,downSequence=sequence-1):InputMessage {
    const base={v:2 as const,type,epoch:controller.snapshot().input.epoch,sequence,tick_ms:Math.floor(now)};
    return type==='down'?{...base,type}:{...base,type,downSequence};
  }
  function deliver(message:InputMessage,now:number,currentLayout=layout) {
    // Mirror the UI's synchronous read of current pointer validity at the serial
    // callback, so a queued render can never lend authority to an old highlight.
    poll(now,currentLayout);return controller.input(message,now);
  }
  return {pointer,controller,frame,poll,acquire,publish,adapterMessage,deliver};
}
function assertHidden(snapshot:GazePointerSnapshot) {
  assert.equal(snapshot.rawPoint,null);assert.equal(snapshot.smoothedPoint,null);
  assert.equal(snapshot.stabilizedPoint,null);assert.equal(snapshot.candidateTargetId,null);
}

test('stable gaze previews across all four targets never emit an action without adapter input',()=>{
  const f=fixture();f.acquire();assert.equal(f.controller.snapshot().focusTarget,'phrases');
  for(const [start,x,y,id] of [[750,800,200,'spell'],[1800,200,600,'back'],[2850,800,600,'scroll']] as const){
    for(let t=start;t<=start+900;t+=150){f.frame(t,x,y);f.controller.tick(t);}
    assert.equal(f.controller.snapshot().focusTarget,id);assert.equal(f.controller.snapshot().selections,0);
    assert.equal(f.controller.snapshot().heldTarget,null);
  }
});

test('fresh adapter DOWN captures the stable pointer target and matching UP selects once only',()=>{
  const f=fixture();f.acquire(0,800,200);assert.equal(f.pointer.snapshot(600).candidateTargetId,'spell');
  const down=f.adapterMessage('down',1,610),up=f.adapterMessage('up',2,620,1);
  assert.equal(f.deliver(down,610).selection,null);assert.equal(f.controller.snapshot().heldTarget,'spell');
  const selected=f.deliver(up,620);assert.equal(selected.selection?.targetId,'spell');assert.equal(selected.selection?.downSequence,1);
  assert.equal(selected.state.selections,1);assert.equal(f.deliver(up,621).selection,null);assert.equal(f.controller.snapshot().selections,1);
});

test('fresh movement to another stable target during hold preserves the original captured action',()=>{
  const f=fixture();f.acquire();f.deliver(f.adapterMessage('down',1,610),610);
  for(let t=750;t<=1550;t+=100){f.frame(t,800,600);assert.equal(f.controller.snapshot().heldTarget,'phrases');}
  assert.equal(f.pointer.snapshot(1550).candidateTargetId,'scroll');assert.equal(f.controller.snapshot().candidateTarget,'scroll');
  assert.equal(f.controller.snapshot().focusTarget,'phrases');assert.equal(f.controller.snapshot().selections,0);
  const up=f.deliver(f.adapterMessage('up',2,1560,1),1560);
  assert.equal(up.selection?.targetId,'phrases');assert.equal(up.state.focusTarget,'scroll');assert.equal(up.state.selections,1);
});

test('fresh accepted gaze in a target gap does not move or synthesize release of a held target',()=>{
  const f=fixture();f.acquire(0,200,600);f.deliver(f.adapterMessage('down',1,610),610);
  const gap=f.frame(750,500,380);assert.notEqual(gap.rawPoint,null);assert.equal(gap.candidateTargetId,null);
  assert.equal(f.controller.snapshot().heldTarget,'back');assert.equal(f.controller.snapshot().selections,0);
  assert.equal(f.deliver(f.adapterMessage('up',2,760,1),760).selection?.targetId,'back');
});

test('worker rejection hides the pointer and cancels capture before any UP; fresh gaze cannot rearm it',()=>{
  const f=fixture();f.acquire();f.deliver(f.adapterMessage('down',1,610),610);
  const oldUp=f.adapterMessage('up',2,760,1),lost=f.pointer.observe(null,750,layout);f.publish(lost,750);
  assertHidden(lost);assert.equal(f.controller.snapshot().heldTarget,null);assert.equal(f.controller.snapshot().requiresReconnect,true);
  assert.equal(f.controller.snapshot().selections,0);f.acquire(900,800,200);
  assert.equal(f.controller.snapshot().paused,true);assert.equal(f.deliver(oldUp,1510).selection,null);
  assert.equal(f.controller.snapshot().selections,0);
});

test('freshness polling cancels held authority without a new frame or release callback',()=>{
  const f=fixture();f.acquire();f.deliver(f.adapterMessage('down',1,610),610);
  const oldUp=f.adapterMessage('up',2,960,1),expired=f.poll(951);assertHidden(expired);
  assert.equal(expired.reason,'stale');assert.equal(f.controller.snapshot().heldTarget,null);assert.equal(f.controller.snapshot().requiresReconnect,true);
  assert.equal(f.controller.snapshot().selections,0);assert.equal(f.deliver(oldUp,960).selection,null);
});

test('a queued release must consult current pointer freshness instead of a previously rendered candidate',()=>{
  const f=fixture();f.acquire();f.deliver(f.adapterMessage('down',1,610),610);
  const oldUp=f.adapterMessage('up',2,951,1);
  // No intervening UI poll: the input boundary itself sees expiration.
  assert.equal(f.deliver(oldUp,951).selection,null);assert.equal(f.controller.snapshot().selections,0);
  assert.equal(f.controller.snapshot().requiresReconnect,true);assert.equal(f.controller.snapshot().heldTarget,null);
});

test('target geometry changes hide the pointer and cancel held capture without manufacturing UP',()=>{
  const f=fixture();f.acquire();f.deliver(f.adapterMessage('down',1,610),610);
  const oldUp=f.adapterMessage('up',2,710,1);
  const moved={...layout,targets:layout.targets.map(target=>({...target,top:target.top+1}))};
  const invalid=f.poll(700,moved);assertHidden(invalid);assert.equal(invalid.reason,'layout-changed');
  assert.equal(f.controller.snapshot().heldTarget,null);assert.equal(f.controller.snapshot().selections,0);
  assert.equal(f.controller.snapshot().requiresReconnect,true);assert.equal(f.controller.input(oldUp,710).selection,null);
});

test('camera-off recovery uses explicit switch-only mode, a fresh connection and released synchronization',()=>{
  const f=fixture();f.acquire();f.deliver(f.adapterMessage('down',1,610),610);const oldUp=f.adapterMessage('up',2,760,1);
  f.pointer.disable();const off=f.poll(750);assertHidden(off);assert.equal(f.controller.snapshot().heldTarget,null);
  assert.equal(f.controller.input(oldUp,760).selection,null);assert.equal(f.controller.tick(780).focusTarget,null);
  f.controller.setMode('switch-only');assert.equal(f.controller.snapshot().paused,true);
  const epoch=f.controller.connect('integration-port-two',800);
  assert.equal(f.controller.snapshot().input.phase,'needs-sync');assert.equal(f.controller.snapshot().focusTarget,null);
  f.controller.input({v:2,type:'sync',epoch,sequence:0,tick_ms:800,pressed:true},800);
  assert.equal(f.controller.snapshot().input.phase,'needs-sync');assert.equal(f.controller.snapshot().selections,0);
  f.controller.input({v:2,type:'sync',epoch,sequence:1,tick_ms:810,pressed:false},810);
  assert.equal(f.controller.snapshot().input.phase,'armed');assert.equal(f.controller.snapshot().focusTarget,'phrases');
  // Pointer remains off: switch-only operation is deliberate, never a gaze-loss fallback.
  assertHidden(f.poll(820));assert.equal(f.controller.input(f.adapterMessage('down',2,820),820).selection,null);
  const up=f.controller.input(f.adapterMessage('up',3,830,2),830);
  assert.equal(up.selection?.targetId,'phrases');assert.equal(up.state.selections,1);assertHidden(f.pointer.snapshot(830));
});


test('queued DOWN and UP recheck current geometry even when no observer or timer has run',()=>{
  const moved={...layout,targets:layout.targets.map(target=>({...target,top:target.top+1}))};
  for(const edge of ['down','up'] as const){
    const f=fixture();f.acquire();
    if(edge==='up')f.deliver(f.adapterMessage('down',1,610),610);
    const queued=f.adapterMessage(edge,edge==='down'?1:2,700,1);
    // The UI boundary must refresh its DOM snapshot before readGaze. This pure
    // pipeline fixture supplies that current snapshot, with no intervening poll.
    assert.equal(f.deliver(queued,700,moved).selection,null);
    assertHidden(f.pointer.snapshot(700));assert.equal(f.controller.snapshot().heldTarget,null);
    assert.equal(f.controller.snapshot().selections,0);assert.equal(f.controller.snapshot().requiresReconnect,true);
  }
});
