// SPDX-License-Identifier: AGPL-3.0-or-later
import test from 'node:test';
import assert from 'node:assert/strict';
import { encodePublicWav, normalizePublicRecording, PUBLIC_AUDIO_MAX_SAMPLES } from '../src/communication/public-demo-audio.mts';
import { validatePublicRecording } from '../server/public-demo-audio.mts';
import { createRecording, acquirePublicRecording, PublicRecordingUnavailableError } from '../src/communication/recording.mts';
const payload = (bytes: Uint8Array, durationMs = 1) => ({ id: 'recording:test:001', audioBase64: Buffer.from(bytes).toString('base64'), mimeType: 'audio/wav', durationMs, synthetic: true, recordingConsent: true });

test('canonical public WAV proves duration independently of claimed duration', () => {
  const samples = new Float32Array(16_000); samples[0] = -1; samples[1] = 1;
  const bytes = encodePublicWav(samples), parsed = validatePublicRecording(payload(bytes));
  assert.equal(bytes.length, 32_044); assert.equal(parsed.request.durationMs, 1000); assert.equal(parsed.mime, 'audio/wav');
  const view = new DataView(bytes.buffer); assert.equal(view.getInt16(44, true), -32768); assert.equal(view.getInt16(46, true), 32767);
  assert.equal(validatePublicRecording(payload(encodePublicWav(new Float32Array(PUBLIC_AUDIO_MAX_SAMPLES)))).request.durationMs, 20_000);
  assert.throws(() => encodePublicWav(new Float32Array(PUBLIC_AUDIO_MAX_SAMPLES + 1)));
  assert.throws(() => encodePublicWav(new Float32Array([NaN])));
});

test('public audio rejects alternate codecs, forged rate/duration fields and appended audio', () => {
  const valid = encodePublicWav(new Float32Array(16_000));
  for (const [offset, value, bits] of [[4, 12, 32], [16, 18, 32], [20, 3, 16], [22, 2, 16], [24, 8_000, 32], [28, 16_000, 32], [32, 4, 16], [34, 8, 16], [40, 2, 32]]) {
    const bytes = valid.slice(), view = new DataView(bytes.buffer);
    if (bits === 16) view.setUint16(offset, value, true); else view.setUint32(offset, value, true);
    assert.throws(() => validatePublicRecording(payload(bytes)), /PUBLIC_AUDIO_FORMAT_REQUIRED/);
  }
  for (const offset of [12, 36]) { const bytes = valid.slice(); bytes[offset] = 0; assert.throws(() => validatePublicRecording(payload(bytes))); }
  const appended = new Uint8Array(valid.length + 2); appended.set(valid); assert.throws(() => validatePublicRecording(payload(appended)));
  const tooLong = new Uint8Array(640_046); tooLong.set(valid); assert.throws(() => validatePublicRecording(payload(tooLong)));
  const odd = valid.slice(0, -1); assert.throws(() => validatePublicRecording(payload(odd)));
  assert.throws(() => validatePublicRecording({ ...payload(valid), mimeType: 'audio/wav;codecs=pcm' }));
  assert.throws(() => validatePublicRecording({ ...payload(valid), recordingConsent: false }));
});

test('public conversion mixes channels in memory, caps to 20 seconds, and never uses declared duration', async () => {
  const length = PUBLIC_AUDIO_MAX_SAMPLES + 16_000, channels = [new Float32Array(length).fill(0.5), new Float32Array(length).fill(-0.5)];
  const normalized = await normalizePublicRecording({ blob: new Blob(['encoded fixture']), durationMs: 1 }, new AbortController().signal,
    async () => ({ sampleRate: 16_000, length, numberOfChannels: 2, getChannelData: channel => channels[channel] }));
  assert.equal(normalized.blob.type, 'audio/wav'); assert.equal(normalized.durationMs, 20_000); assert.equal(normalized.blob.size, 640_044);
  const bytes = new Uint8Array(await normalized.blob.arrayBuffer()); assert.equal(validatePublicRecording(payload(bytes)).request.durationMs, 20_000);
  assert.equal(new DataView(bytes.buffer).getInt16(44, true), 0);
});

test('public conversion rejects cancellation, invalid decoded data and oversize input before upload exists', async () => {
  const abort = new AbortController(); abort.abort(); let decoded = false;
  await assert.rejects(normalizePublicRecording({ blob: new Blob(['fixture']), durationMs: 1 }, abort.signal, async () => { decoded = true; throw Error(); }));
  assert.equal(decoded, false);
  const controller = new AbortController();
  let finish!: (value: { sampleRate: number; length: number; numberOfChannels: number; getChannelData: () => Float32Array<ArrayBuffer> }) => void;
  const pending = normalizePublicRecording({ blob: new Blob(['fixture']), durationMs: 1 }, controller.signal, () => new Promise(resolve => { finish = resolve; }));
  await new Promise(resolve => setImmediate(resolve)); controller.abort();
  finish({ sampleRate: 16_000, length: 16, numberOfChannels: 1, getChannelData: () => new Float32Array(16) });
  await assert.rejects(pending);
  const fixture = { blob: new Blob(['fixture']), durationMs: 1 };
  await assert.rejects(normalizePublicRecording(fixture, new AbortController().signal, async () => ({ sampleRate: 48_000, length: 16, numberOfChannels: 1, getChannelData: () => new Float32Array(16) })));
  await assert.rejects(normalizePublicRecording({ blob: new Blob([new Uint8Array(1_048_577)]), durationMs: 1 }, new AbortController().signal, async () => { throw Error('Must not decode'); }));
});

test('cancellation during asynchronous normalization releases microphone and cannot return late converted audio', async () => {
  let stopped = 0, convertSignal: AbortSignal | undefined, finish!: (value: {blob: Blob; durationMs: number}) => void;
  const track = { stop() { stopped++; }, onended: null } as unknown as MediaStreamTrack;
  const recorder = { state: 'inactive', mimeType: 'audio/webm', ondataavailable: null, onstop: null, onerror: null,
    start() { Object.assign(recorder, {state:'recording'}); },
    stop() { Object.assign(recorder, {state:'inactive'}); recorder.ondataavailable?.({data:new Blob(['fixture'])} as BlobEvent); recorder.onstop?.({} as Event); },
  } as unknown as MediaRecorder;
  const recording = createRecording({ getStream: async () => ({getTracks: () => [track]}), recorder: () => recorder,
    normalize: (_capture, signal) => { convertSignal = signal; return new Promise(resolve => { finish = resolve; }); },
  }, () => {});
  await recording.start(); const pending = recording.stop(); assert.equal(stopped, 1);
  recording.cancel(); assert.equal(convertSignal?.aborted, true); await assert.rejects(pending, /canceled/);
  finish({blob: new Blob(['late']),durationMs:1}); await new Promise(resolve => setImmediate(resolve)); assert.equal(stopped, 1);
});


test('public microphone stays off when the current server session is locked, expired or Scribe is unavailable', async () => {
  let microphones = 0, requests = 0;
  for (const status of [
    {access:{authorized:false,expiresAt:20_000},scribe:{available:true}},
    {access:{authorized:true,expiresAt:1000},scribe:{available:true}},
    {access:{authorized:true,expiresAt:20_000},scribe:{available:false}},
    {access:{authorized:true},scribe:{available:true}},
  ]) {
    await assert.rejects(acquirePublicRecording(new AbortController().signal, {
      fetcher: async (url, init) => { requests++; assert.equal(url, '/api/status'); assert.equal(init?.credentials, 'same-origin'); assert.equal(init?.cache, 'no-store'); return Response.json(status); },
      getStream: async () => { microphones++; return {getTracks:()=>[]}; }, now: () => 1000,
    }), PublicRecordingUnavailableError);
  }
  assert.equal(requests,4); assert.equal(microphones,0);
});

test('public microphone requires fresh authorization on each start and stops a permission grant after expiry', async () => {
  let clock = 1000, microphones = 0, stopped = 0;
  const stream = {getTracks: () => [{stop(){stopped++;}} as MediaStreamTrack]};
  const dependencies = { fetcher: (async () => Response.json({access:{authorized:true,expiresAt:2000},scribe:{available:true}})) as typeof fetch,
    getStream: async () => { microphones++; return stream; }, now: () => clock };
  assert.equal(await acquirePublicRecording(new AbortController().signal,dependencies),stream);
  clock=2000;
  await assert.rejects(acquirePublicRecording(new AbortController().signal,dependencies),PublicRecordingUnavailableError);
  assert.equal(microphones,1);
  clock=1000;
  await assert.rejects(acquirePublicRecording(new AbortController().signal,{...dependencies,getStream:async()=>{microphones++;clock=2000;return stream;}}),PublicRecordingUnavailableError);
  assert.equal(stopped,1);
});

test('canceling a public access preflight cannot open a microphone after its late status response', async () => {
  let respond!: (value:Response)=>void, microphones=0;
  const controller=new AbortController();
  const pending=acquirePublicRecording(controller.signal,{
    fetcher:()=>new Promise(resolve=>{respond=resolve;}),getStream:async()=>{microphones++;return {getTracks:()=>[]};},now:()=>1000,
  });
  controller.abort();respond(Response.json({access:{authorized:true,expiresAt:2000},scribe:{available:true}}));
  await assert.rejects(pending,PublicRecordingUnavailableError);assert.equal(microphones,0);
});

test('recording cancellation aborts its acquisition preflight before permission can begin', async () => {
  let granted!: (value:{getTracks:()=>MediaStreamTrack[]})=>void, acquisition:AbortSignal|undefined, stopped=0, recorderCreated=0;
  const recorder=createRecording({getStream:signal=>{acquisition=signal;return new Promise(resolve=>{granted=resolve;});},recorder:()=>{recorderCreated++;throw Error('Must not create recorder');}},()=>{});
  const pending=recorder.start();recorder.cancel();assert.equal(acquisition?.aborted,true);
  granted({getTracks:()=>[{stop(){stopped++;}} as MediaStreamTrack]});await assert.rejects(pending);assert.equal(recorderCreated,0);assert.equal(stopped,1);
});


test('Listening distinguishes locked origin, unavailable provider and failed status verification without opening the microphone', async () => {
  const cases: [() => Promise<Response>, RegExp][] = [
    [async () => Response.json({access:{authorized:false}}), /locked or expired on this website/],
    [async () => new Response(null,{status:401}), /locked or expired/],
    [async () => Response.json({access:{authorized:true,expiresAt:2000},scribe:{available:false}}), /unlocked, but the transcription service is unavailable/],
    [async () => {throw Error('private network details');}, /Could not verify Listening availability/],
    [async () => new Response('invalid'), /Could not verify Listening availability/],
  ];
  let microphones=0;
  for(const [fetcher,message] of cases) await assert.rejects(acquirePublicRecording(new AbortController().signal,{
    fetcher,now:()=>1000,getStream:async()=>{microphones++;return {getTracks:()=>[]};}
  }),error=>error instanceof PublicRecordingUnavailableError && message.test(error.message) && !error.message.includes('private network details'));
  assert.equal(microphones,0);
});
