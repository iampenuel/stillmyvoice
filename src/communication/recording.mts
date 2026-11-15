import { RELEASE_CAPABILITIES, requireCloudServices } from '../release-capabilities.mts';
/** Ephemeral bounded recording. No storage, network, input or speech capability. */
export type Recording = { blob: Blob; durationMs: number };
type Stream = Pick<MediaStream, 'getTracks'>;
type Recorder = Pick<MediaRecorder, 'start' | 'stop' | 'state' | 'mimeType' | 'ondataavailable' | 'onstop' | 'onerror'>;
type Dependencies = { getStream: () => Promise<Stream>; recorder: (stream: Stream) => Recorder;
  now?: () => number; schedule?: (fn: () => void, ms: number) => ReturnType<typeof setTimeout>; clear?: typeof clearTimeout };
export function createRecording(deps: Dependencies, event: (event: 'limit' | 'error') => void) {
  const now = deps.now ?? (() => performance.now()), schedule = deps.schedule ?? setTimeout, clear = deps.clear ?? clearTimeout;
  let generation = 0, stream: Stream | null = null, recorder: Recorder | null = null, started = 0;
  let timer: ReturnType<typeof setTimeout> | null = null, chunks: Blob[] = [], bytes = 0;
  let result: Promise<Recording> | null = null, resolve: ((value: Recording) => void) | null = null, reject: ((reason: Error) => void) | null = null;
  const tracksOff = () => { if (stream) for (const track of stream.getTracks()) { track.onended = null; track.stop(); } stream = null; };
  const cancel = () => {
    generation++; if (timer) clear(timer); timer = null;
    if (recorder) { recorder.ondataavailable = null; recorder.onstop = null; recorder.onerror = null; if (recorder.state !== 'inactive') recorder.stop(); }
    recorder = null; tracksOff(); chunks = []; bytes = 0; reject?.(Error('Recording canceled')); resolve = null; reject = null;
  };
  const stop = (): Promise<Recording> => {
    if (!result || !recorder) return Promise.reject(Error('No recording'));
    if (timer) clear(timer); timer = null;
    if (recorder.state !== 'inactive') recorder.stop();
    tracksOff(); return result;
  };
  return {
    async start() {
      cancel(); const token = generation;
      const granted = await deps.getStream();
      if (token !== generation) { for (const track of granted.getTracks()) track.stop(); throw Error('Recording canceled'); }
      stream = granted;
      try {
        recorder = deps.recorder(granted); const activeRecorder = recorder;
        result = new Promise<Recording>((yes, no) => { resolve = yes; reject = no; }); void result.catch(() => {});
        const fail = () => { if (token !== generation) return; cancel(); event('error'); };
        for (const track of stream.getTracks()) track.onended = fail;
        recorder.onerror = fail;
        recorder.ondataavailable = e => {
          if (token !== generation || !e.data.size) return;
          bytes += e.data.size; if (bytes > 1024 * 1024) { fail(); return; } chunks.push(e.data);
        };
        recorder.onstop = () => {
          if (token !== generation) return;
          if (timer) clear(timer); timer = null; tracksOff();
          const blob = new Blob(chunks, { type: activeRecorder.mimeType }); chunks = [];
          const durationMs = Math.min(20_000, Math.max(100, Math.round(now() - started)));
          if (!blob.size) reject?.(Error('No audio captured')); else resolve?.({ blob, durationMs });
          resolve = null; reject = null;
        };
        started = now(); recorder.start(250);
        timer = schedule(() => { if (token === generation) { event('limit'); void stop().catch(() => {}); } }, 20_000);
      } catch { cancel(); throw Error('Microphone recording unavailable'); }
    }, stop, cancel,
  };
}
export function browserRecording(event: (event: 'limit' | 'error') => void, cloudAllowed=RELEASE_CAPABILITIES.cloudServices) {
  return createRecording({
    getStream: () => { requireCloudServices(cloudAllowed); return navigator.mediaDevices.getUserMedia({ audio: true, video: false }); },
    recorder: stream => {
      const mimeType = ['audio/webm;codecs=opus', 'audio/webm', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
      if (!mimeType) throw Error('No supported recording format');
      return new MediaRecorder(stream as MediaStream, { mimeType, audioBitsPerSecond: 64_000 });
    },
  }, event);
}
