// SPDX-License-Identifier: AGPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { GazeSandboxController, SANDBOX_TARGETS, type SandboxTargetId } from '../src/gaze/gaze-sandbox.mts';
import type { InputMessage } from '../src/input/serial-protocol.mts';

/** Synthetic transport messages test the controller contract, never physical hardware. */
function message(c:GazeSandboxController,type:'sync'|'down'|'up',sequence:number,extra:object={}):InputMessage {
 return {v:2,type,epoch:c.snapshot().input.epoch,sequence,tick_ms:0,...extra} as InputMessage;
}
function gaze(c:GazeSandboxController,target:SandboxTargetId|null,now:number,trackingValid=true) {
 return c.updateGaze({candidate:target?{targetId:target,validUntilMs:now+300}:null,trackingValid,trackingValidUntilMs:now+350},now);
}
function ready(target:SandboxTargetId='phrases') {
 const c=new GazeSandboxController('initial');gaze(c,target,0);c.connect('connection-one',0);
 c.input(message(c,'sync',0,{pressed:false}),0);return c;
}
function press(c:GazeSandboxController,now=10) { return c.input(message(c,'down',1),now); }
function release(c:GazeSandboxController,now=20) { return c.input(message(c,'up',2,{downSequence:1}),now); }

test('construction and gaze movement cannot arm input or produce sandbox actions',()=>{
 const c=new GazeSandboxController('initial');
 for(const target of SANDBOX_TARGETS) gaze(c,target,0);
 assert.equal(c.snapshot().paused,true);assert.equal(c.snapshot().input.connected,false);
 assert.equal(c.snapshot().focusTarget,null);assert.equal(c.snapshot().selections,0);
 const epoch=c.connect('connection-one',0);
 assert.equal(c.snapshot().input.phase,'needs-sync');assert.equal(c.snapshot().focusTarget,null);
 assert.equal(c.input({v:2,type:'down',epoch,sequence:1,tick_ms:0},1).selection,null);
 assert.equal(c.snapshot().requiresReconnect,true);
});
test('only a matching physical release emits one captured action; duplicate UP never repeats',()=>{
 const c=ready('spell');assert.equal(c.snapshot().focusTarget,'spell');
 assert.equal(press(c).selection,null);const up=message(c,'up',2,{downSequence:1});
 const selected=c.input(up,20);assert.equal(selected.selection?.targetId,'spell');
 assert.equal(selected.selection?.downSequence,1);assert.equal(selected.state.selections,1);
 assert.equal(c.input(up,21).selection,null);assert.equal(c.snapshot().selections,1);assert.equal(c.snapshot().paused,true);
});
test('valid gaze changes during DOWN freeze the captured target until its matching UP',()=>{
 const c=ready('phrases');press(c);
 gaze(c,'back',100);assert.equal(c.snapshot().focusTarget,'phrases');assert.equal(c.snapshot().heldTarget,'phrases');
 assert.equal(c.snapshot().candidateTarget,'back');c.tick(150);
 const selected=release(c,200);assert.equal(selected.selection?.targetId,'phrases');
 assert.equal(selected.state.focusTarget,'back');assert.equal(selected.state.heldTarget,null);
});
test('a fresh valid central gap does not retarget or cancel an existing physical capture',()=>{
 const c=ready('scroll');press(c);gaze(c,null,100);
 assert.equal(c.snapshot().heldTarget,'scroll');assert.equal(c.snapshot().candidateTarget,null);
 assert.equal(release(c,200).selection?.targetId,'scroll');assert.equal(c.snapshot().focusTarget,null);
});
test('gaze-mode DOWN without a fresh stable target never selects the previously highlighted action',()=>{
 const c=ready('back');gaze(c,null,100);
 const rejected=c.input(message(c,'down',1),110);assert.equal(rejected.selection,null);
 assert.equal(rejected.state.requiresReconnect,true);assert.equal(rejected.state.paused,true);
 assert.equal(release(c,120).selection,null);assert.equal(c.snapshot().selections,0);
});
test('invalid tracking during a press cancels capture and fresh gaze alone cannot rearm it',()=>{
 const c=ready();press(c);const oldUp=message(c,'up',2,{downSequence:1});
 const cancelled=gaze(c,null,100,false);
 assert.equal(cancelled.heldTarget,null);assert.equal(cancelled.requiresReconnect,true);
 gaze(c,'spell',150);assert.equal(c.input(oldUp,200).selection,null);assert.equal(c.snapshot().paused,true);
 c.connect('connection-two',200);c.input(message(c,'sync',0,{pressed:false}),200);
 assert.equal(press(c,210).selection,null);assert.equal(release(c,220).selection?.targetId,'spell');
});
test('tracking expiry cancels a held target even when no new inference callback arrives',()=>{
 const c=ready();press(c);
 const cancelled=c.tick(351);assert.equal(cancelled.paused,true);assert.equal(cancelled.heldTarget,null);
 assert.equal(cancelled.requiresReconnect,true);assert.equal(release(c,400).selection,null);
});
test('expired stable candidate cannot authorize a new press even if raw tracking is still fresh',()=>{
 const c=ready();c.tick(301);
 assert.equal(c.snapshot().focusTarget,null);assert.equal(press(c,310).selection,null);
 assert.equal(c.snapshot().requiresReconnect,true);assert.equal(c.snapshot().selections,0);
});
for(const reason of ['Focus lost','Geometry changed','Camera session changed','Port disconnected','User paused']) {
 test(reason+' retires captured authority and late messages cannot act',()=>{
  const c=ready('back');press(c);const oldUp=message(c,'up',2,{downSequence:1});
  c.invalidate(reason);assert.equal(c.snapshot().heldTarget,null);assert.equal(c.input(oldUp,20).selection,null);
  c.connect('connection-two',30);c.input(message(c,'sync',0,{pressed:false}),30);
  assert.equal(c.input(oldUp,40).selection,null);assert.equal(c.snapshot().paused,true);assert.equal(c.snapshot().selections,0);
 });
}
test('explicit switch-only fallback scans all four actions at bounded cadence and freezes while held',()=>{
 const c=new GazeSandboxController('initial');c.setMode('switch-only');
 assert.equal(c.snapshot().paused,true);c.connect('connection-one',0);c.input(message(c,'sync',0,{pressed:false}),0);
 assert.equal(c.tick(999).focusTarget,'phrases');assert.equal(c.tick(1000).focusTarget,'spell');
 press(c,1010);assert.equal(c.tick(100000).focusTarget,'spell');assert.equal(c.snapshot().selections,0);
 assert.equal(release(c,100001).selection?.targetId,'spell');
 assert.equal(c.tick(101000).focusTarget,'spell');assert.equal(c.tick(101001).focusTarget,'back');
 assert.equal(c.tick(102001).focusTarget,'scroll');assert.equal(c.tick(103001).focusTarget,'phrases');
});
test('changing modes cancels a held capture and never silently falls back or resumes',()=>{
 const c=ready('back');press(c);const changed=c.setMode('switch-only');
 assert.equal(changed.paused,true);assert.equal(changed.requiresReconnect,true);assert.equal(changed.heldTarget,null);
 assert.equal(release(c,20).selection,null);assert.equal(c.tick(2000).focusTarget,null);
 assert.equal(c.setMode('gaze').paused,true);
});
test('pressed synchronization is never interpreted as release; a fresh released snapshot is required',()=>{
 const c=new GazeSandboxController('initial');c.setMode('switch-only');c.connect('connection-one',0);
 c.input(message(c,'sync',0,{pressed:true}),0);assert.equal(c.snapshot().input.phase,'needs-sync');
 assert.equal(c.snapshot().focusTarget,null);assert.equal(c.snapshot().selections,0);
 c.input(message(c,'sync',1,{pressed:false}),10);assert.equal(c.snapshot().input.phase,'armed');
 assert.equal(c.input(message(c,'down',2),20).selection,null);
 assert.equal(c.input(message(c,'up',3,{downSequence:2}),30).selection?.targetId,'phrases');
});
test('forged expiry or unknown targets fail closed; non-monotonic time cancels input',()=>{
 const c=ready();c.updateGaze({candidate:{targetId:'phrases',validUntilMs:Infinity},trackingValid:true,trackingValidUntilMs:Infinity},10);
 assert.equal(c.snapshot().focusTarget,null);assert.equal(press(c,20).selection,null);
 const other=ready();other.updateGaze({candidate:{targetId:'speech' as SandboxTargetId,validUntilMs:300},trackingValid:true,trackingValidUntilMs:350},10);
 assert.equal(press(other,20).selection,null);assert.equal(other.snapshot().selections,0);
 const time=ready();press(time,100);assert.equal(time.tick(50).paused,true);assert.equal(release(time,110).selection,null);
});

test('reusing a connection identity cannot revive a retired epoch or captured press',()=>{
 const c=ready();press(c);const oldUp=message(c,'up',2,{downSequence:1});c.pause();
 assert.throws(()=>c.connect('connection-one',20),/fresh connection identity/);
 assert.equal(c.input(oldUp,30).selection,null);assert.equal(c.snapshot().paused,true);assert.equal(c.snapshot().selections,0);
});

test('an already-captured fresh reading is consumed before expiry of older displayed metadata',()=>{
 const c=ready();press(c);
 // New frame captured at250, delivered to the controller at375. The prior frame
 // was captured at0, so capture continuity remains within350ms.
 c.updateGaze({candidate:{targetId:'back',validUntilMs:600},trackingValid:true,trackingValidUntilMs:600},375);
 assert.equal(c.snapshot().paused,false);assert.equal(c.snapshot().heldTarget,'phrases');
 assert.equal(release(c,400).selection?.targetId,'phrases');
});
test('a late fresh frame cannot conceal a capture gap beyond350ms during a hold',()=>{
 const c=ready();press(c);
 c.updateGaze({candidate:{targetId:'back',validUntilMs:750},trackingValid:true,trackingValidUntilMs:750},400);
 assert.equal(c.snapshot().paused,true);assert.equal(c.snapshot().requiresReconnect,true);
 assert.equal(release(c,410).selection,null);assert.equal(c.snapshot().selections,0);
});
