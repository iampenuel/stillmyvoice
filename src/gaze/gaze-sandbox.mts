// SPDX-License-Identifier: AGPL-3.0-or-later
import { createSwitchState, reduceSwitch, type Selection, type SwitchState } from '../input/switch-machine.mts';
import type { InputMessage } from '../input/serial-protocol.mts';
import { defaultGazeStability } from './gaze-logic.mts';

/** Isolated fictional actions. This module has no camera, transport, DOM or speech authority. */
export const SANDBOX_TARGETS = Object.freeze(['phrases','spell','back','scroll'] as const);
export const SANDBOX_SCAN_INTERVAL_MS = 1000;
export type SandboxTargetId = typeof SANDBOX_TARGETS[number];
export type SandboxMode = 'gaze' | 'switch-only';
export type SandboxCandidate = Readonly<{targetId:SandboxTargetId;validUntilMs:number}>;
export type SandboxGazeUpdate = Readonly<{
  candidate:SandboxCandidate|null; trackingValid:boolean; trackingValidUntilMs:number;
}>;
export type SandboxSnapshot = Readonly<{
  input:SwitchState;mode:SandboxMode;paused:boolean;focusTarget:SandboxTargetId|null;heldTarget:SandboxTargetId|null;
  candidateTarget:SandboxTargetId|null;selections:number;reason:string|null;requiresReconnect:boolean;
}>;
export type SandboxTransition = Readonly<{state:SandboxSnapshot;selection:Selection|null}>;
const isTarget = (value:unknown):value is SandboxTargetId => SANDBOX_TARGETS.some(target=>target===value);
const validTime = (value:number) => Number.isFinite(value) && value>=0;
const view = Object.freeze({id:'isolated-gaze-sandbox',revision:0,targets:SANDBOX_TARGETS});

/** Only input() can emit a selection, and only the unchanged reducer can create it.
 * All messages must come from the existing verified serial adapter. Lifecycle
 * cancellation requires retiring that adapter; connect never manufactures sync. */
export class GazeSandboxController {
  private kernel:SwitchState;
  private mode:SandboxMode='gaze'; private paused=true; private requiresReconnect=false;
  private reason:string|null='Connect the physical switch'; private selections=0;
  private candidate:SandboxCandidate|null=null; private trackingValid=false; private trackingValidUntil=0;
  private now=0; private lastScanAt=0; private connectionIds=new Set<string>();
  constructor(instanceId:string) { this.kernel=createSwitchState(view,instanceId); this.connectionIds.add(instanceId); }
  private trackingFresh() { return this.trackingValid && this.now<=this.trackingValidUntil; }
  private candidateFresh() { return this.trackingFresh() && this.candidate!==null && this.now<=this.candidate.validUntilMs; }
  private time(now:number,expireTracking=true) {
    if (!validTime(now) || now<this.now) { this.invalidate('Invalid sandbox time'); return false; }
    this.now=now;
    if (expireTracking && !this.paused && this.mode==='gaze' && this.kernel.phase==='held' && !this.trackingFresh()) {
      this.invalidate('Gaze tracking expired during press'); return false;
    }
    return true;
  }
  /** Uses application scan ticks only. No synthesized DOWN, UP or synchronization. */
  private applyCandidate() {
    if (this.paused || this.mode!=='gaze' || this.kernel.phase!=='armed' || !this.candidateFresh()) return;
    for (let steps=0;steps<SANDBOX_TARGETS.length && this.kernel.view?.targets[this.kernel.index]!==this.candidate!.targetId;steps++) {
      this.kernel=reduceSwitch(this.kernel,{type:'tick',epoch:this.kernel.epoch}).state;
    }
  }
  snapshot():SandboxSnapshot {
    const heldTarget=isTarget(this.kernel.capture?.targetId)?this.kernel.capture.targetId:null;
    const eligible=!this.paused && this.kernel.connected && this.kernel.active && this.kernel.phase==='armed'
      && (this.mode==='switch-only' || this.candidateFresh());
    const focused=this.kernel.view?.targets[this.kernel.index];
    return Object.freeze({input:this.kernel,mode:this.mode,paused:this.paused,focusTarget:heldTarget??(eligible&&isTarget(focused)?focused:null),
      heldTarget,candidateTarget:this.candidateFresh()?this.candidate!.targetId:null,selections:this.selections,
      reason:this.reason,requiresReconnect:this.requiresReconnect});
  }
  /** Called by the serial adapter's epoch callback with its fresh connection ID. */
  connect(instanceId:string,now:number):string {
    if (!validTime(now) || now<this.now) { this.invalidate('Invalid connection time'); throw Error('A current connection timestamp is required'); }
    if (this.connectionIds.has(instanceId)) { this.invalidate('Retired connection identity'); throw Error('A fresh connection identity is required'); }
    this.connectionIds.add(instanceId);
    this.now=now; this.lastScanAt=now;
    this.kernel=createSwitchState(view,instanceId);
    this.kernel=reduceSwitch(this.kernel,{type:'activity',active:true}).state;
    this.kernel=reduceSwitch(this.kernel,{type:'connect'}).state;
    this.paused=false; this.requiresReconnect=false; this.reason='Awaiting fresh physical synchronization';
    return this.kernel.epoch;
  }
  updateGaze(update:SandboxGazeUpdate,now:number):SandboxSnapshot {
    // Consume a real fresh reading before testing old metadata expiry. Poll/input
    // without a new reading still expire immediately. Expiries are capture+350ms.
    if (!this.time(now,false)) return this.snapshot();
    const fresh=update.trackingValid===true && validTime(update.trackingValidUntilMs)
      && update.trackingValidUntilMs>=now && update.trackingValidUntilMs-now<=defaultGazeStability.staleMs;
    if (this.mode==='gaze' && this.kernel.phase==='held' && fresh && this.trackingValid
      && update.trackingValidUntilMs-this.trackingValidUntil>defaultGazeStability.staleMs) return this.invalidate('Gaze capture gap during press');
    this.trackingValid=fresh; this.trackingValidUntil=fresh?update.trackingValidUntilMs:0;
    const proposed=update.candidate;
    this.candidate=fresh && proposed && isTarget(proposed.targetId) && validTime(proposed.validUntilMs)
      && proposed.validUntilMs>=now && proposed.validUntilMs<=update.trackingValidUntilMs ? {...proposed}:null;
    if (this.mode==='gaze' && this.kernel.phase==='held' && !fresh) return this.invalidate('Gaze tracking lost during press');
    this.applyCandidate();
    if (!this.paused && this.mode==='gaze' && this.kernel.phase==='armed') this.reason=this.candidateFresh()?null:'No fresh stable gaze target';
    return this.snapshot();
  }
  input(message:InputMessage,now:number):SandboxTransition {
    if (!this.time(now) || this.paused) return Object.freeze({state:this.snapshot(),selection:null});
    if (message?.type==='down' && this.mode==='gaze') {
      if (!this.candidateFresh()) return Object.freeze({state:this.invalidate('Press had no fresh stable gaze target'),selection:null});
      this.applyCandidate();
    }
    const next=reduceSwitch(this.kernel,message); this.kernel=next.state;
    if (this.kernel.epoch!==message?.epoch) {
      return Object.freeze({state:this.invalidate('Physical input rejected: '+(this.kernel.reason??'invalid message')),selection:null});
    }
    let selection:Selection|null=null;
    if (next.selection) {
      if (!isTarget(next.selection.targetId)) return Object.freeze({state:this.invalidate('Unknown sandbox target'),selection:null});
      selection=next.selection; this.selections++; this.lastScanAt=now;
    }
    if (message.type==='down') this.lastScanAt=now;
    this.applyCandidate();
    this.reason=this.kernel.phase==='needs-sync' ? this.kernel.pressed?'Release switch for fresh synchronization':'Awaiting fresh physical synchronization'
      :this.kernel.phase==='held'?'Held target frozen until release':this.mode==='gaze'&&!this.candidateFresh()?'No fresh stable gaze target':null;
    return Object.freeze({state:this.snapshot(),selection});
  }
  /** Poll freely; switch-only scanning advances at most once per1000ms. */
  tick(now:number):SandboxSnapshot {
    if (!this.time(now)) return this.snapshot();
    if (!this.paused && this.mode==='switch-only' && this.kernel.phase==='armed' && now-this.lastScanAt>=SANDBOX_SCAN_INTERVAL_MS) {
      this.kernel=reduceSwitch(this.kernel,{type:'tick',epoch:this.kernel.epoch}).state; this.lastScanAt=now;
    } else this.applyCandidate();
    return this.snapshot();
  }
  setMode(mode:SandboxMode):SandboxSnapshot {
    if (mode!=='gaze' && mode!=='switch-only') return this.invalidate('Invalid sandbox mode');
    if (mode===this.mode) return this.snapshot();
    this.mode=mode; return this.invalidate('Mode changed; reconnect the physical switch');
  }
  /** Call for camera-session, geometry, page focus/visibility, port or user changes.
   * UI must stop/close the retired adapter, then require explicit fresh Connect. */
  invalidate(reason:string):SandboxSnapshot {
    this.kernel=reduceSwitch(this.kernel,{type:'disconnect'}).state;
    this.paused=true; this.requiresReconnect=true; this.reason=reason;
    this.candidate=null; this.trackingValid=false; this.trackingValidUntil=0;
    return this.snapshot();
  }
  pause(reason='Sandbox paused'):SandboxSnapshot { return this.invalidate(reason); }
}
