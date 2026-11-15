import test from 'node:test';
import assert from 'node:assert/strict';
import { createRecording } from '../src/communication/recording.mts';
function fixture() {
  let stopped = 0, requested = 0, clock = 100, limit: (() => void) | null = null;
  const track = { stop: () => { stopped++; }, onended: null } as unknown as MediaStreamTrack;
  const stream = { getTracks: () => [track] };
  const recorder = { state: 'inactive', mimeType: 'audio/webm', ondataavailable: null, onerror: null, onstop: null,
    start() { Object.assign(recorder, {state:'recording'}); }, stop() { Object.assign(recorder, {state:'inactive'}); recorder.ondataavailable?.({ data: new Blob(['fictional audio']) } as BlobEvent); recorder.onstop?.({} as Event); } } as unknown as MediaRecorder;
  const events: string[] = [];
  const controller = createRecording({ getStream: async () => { requested++; return stream; }, recorder: () => recorder, now: () => clock,
    schedule: fn => { limit = fn; return 1 as unknown as ReturnType<typeof setTimeout>; }, clear: () => {} }, e => events.push(e));
  return { controller, events, recorder, stream, requested: () => requested, stopped: () => stopped, advance: () => { clock += 20_000; limit?.(); } };
}
test('microphone remains off until deliberate start; Stop releases every track and returns bounded ephemeral audio', async () => {
  const f=fixture(); assert.equal(f.requested(),0); await f.controller.start(); assert.equal(f.requested(),1);
  const recording=await f.controller.stop(); assert.equal(recording.blob.type,'audio/webm'); assert.ok(recording.blob.size>0); assert.equal(f.stopped(),1);
  f.controller.cancel(); assert.equal(f.stopped(),1);
});
test('cancel destroys captured chunks; late permission grant is stopped without recording', async () => {
  const f=fixture(); await f.controller.start(); f.controller.cancel(); assert.equal(f.stopped(),1); await assert.rejects(f.controller.stop());
  let grant!: (s: Pick<MediaStream,'getTracks'>)=>void, recording=0;
  const c=createRecording({getStream:()=>new Promise(resolve=>{grant=resolve;}),recorder:()=>{recording++;return f.recorder;}},()=>{});
  const pending=c.start(); c.cancel(); grant(f.stream); await assert.rejects(pending); assert.equal(recording,0); assert.equal(f.stopped(),2);
});
test('twenty-second limit stops capture and reports lifecycle only; oversized capture fails closed',async()=>{
  const f=fixture();await f.controller.start();f.advance(); const recording=await f.controller.stop(); assert.equal(recording.durationMs,20000);assert.deepEqual(f.events,['limit']);assert.equal(f.stopped(),1);
  const g=fixture();await g.controller.start();g.recorder.ondataavailable?.({data:new Blob([new Uint8Array(1024*1024+1)])} as BlobEvent);assert.deepEqual(g.events,['error']);assert.equal(g.stopped(),1);await assert.rejects(g.controller.stop());
});
test('microphone disconnection cancels capture and never returns audio',async()=>{
  const f=fixture();await f.controller.start();f.stream.getTracks()[0].onended?.({} as Event);assert.deepEqual(f.events,['error']);assert.equal(f.stopped(),1);await assert.rejects(f.controller.stop());
});
